import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export class AppleHigClient {
    baseUrl = 'https://developer.apple.com/design/human-interface-guidelines';
    cacheDir = path.join(os.homedir(), '.cache', 'apple-hig-mcp');
    memoryCache = new Map();
    topicIndex = [];
    indexLoadedAt = 0;
    indexTtlMs = 1000 * 60 * 60 * 24; // 24 hours
    // Sub-indices covering 100% of Apple HIG categories and components
    subIndices = [
        { slug: 'getting-started', category: 'Platforms & Fundamentals' },
        { slug: 'foundations', category: 'Foundations' },
        { slug: 'patterns', category: 'Patterns' },
        { slug: 'inputs', category: 'Inputs' },
        { slug: 'technologies', category: 'Technologies' },
        { slug: 'menus-and-actions', category: 'Components (Menus & Actions)' },
        { slug: 'layout-and-organization', category: 'Components (Layout & Organization)' },
        { slug: 'navigation-and-search', category: 'Components (Navigation & Search)' },
        { slug: 'presentation', category: 'Components (Presentation)' },
        { slug: 'selection-and-input', category: 'Components (Selection & Input)' },
        { slug: 'status', category: 'Components (Status)' },
        { slug: 'system-experiences', category: 'Components (System Experiences)' }
    ];
    constructor() {
        try {
            if (!fs.existsSync(this.cacheDir)) {
                fs.mkdirSync(this.cacheDir, { recursive: true });
            }
        }
        catch {
            // Ignore cache dir creation errors, will use memory cache
        }
    }
    /**
     * Initializes or refreshes the complete topic index across all categories.
     */
    async ensureIndex() {
        const now = Date.now();
        if (this.topicIndex.length > 80 && now - this.indexLoadedAt < this.indexTtlMs) {
            return this.topicIndex;
        }
        const diskIndexPath = path.join(this.cacheDir, 'index.json');
        if (this.topicIndex.length === 0 && fs.existsSync(diskIndexPath)) {
            try {
                const raw = fs.readFileSync(diskIndexPath, 'utf8');
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 80) {
                    this.topicIndex = parsed;
                    this.indexLoadedAt = now;
                }
            }
            catch {
                // Fallback to network
            }
        }
        try {
            const allTopics = new Map();
            // 1. Fetch master index
            const masterMd = await this.fetchRawMarkdown('');
            const masterTopics = this.parseIndex(masterMd, 'General');
            for (const t of masterTopics)
                allTopics.set(t.slug, t);
            // 2. Fetch all sub-indices in parallel
            const subResults = await Promise.allSettled(this.subIndices.map(async (sub) => {
                const text = await this.fetchRawMarkdown(sub.slug);
                return { category: sub.category, topics: this.parseIndex(text, sub.category) };
            }));
            for (const res of subResults) {
                if (res.status === 'fulfilled') {
                    for (const t of res.value.topics) {
                        allTopics.set(t.slug, t);
                    }
                }
            }
            this.topicIndex = Array.from(allTopics.values());
            this.indexLoadedAt = now;
            try {
                fs.writeFileSync(diskIndexPath, JSON.stringify(this.topicIndex, null, 2), 'utf8');
            }
            catch {
                // Ignore cache write errors
            }
        }
        catch {
            if (this.topicIndex.length === 0) {
                this.topicIndex = this.getFallbackIndex();
            }
        }
        return this.topicIndex;
    }
    /**
     * Parses topics and summaries from an Apple HIG markdown file.
     */
    parseIndex(markdown, defaultCategory) {
        const topics = [];
        const lines = markdown.split('\n');
        let currentCategory = defaultCategory;
        const linkRegex = /\[([^\]]+)\]\(\/design\/Human-Interface-Guidelines\/([^)]+)\)/i;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('## ')) {
                const heading = line.replace('## ', '').trim();
                if (heading && !heading.toLowerCase().includes('discussion') && !heading.toLowerCase().includes('topics')) {
                    currentCategory = heading;
                }
                continue;
            }
            const match = line.match(linkRegex);
            if (match) {
                const title = match[1].trim();
                const rawSlug = match[2].trim().toLowerCase();
                const slug = rawSlug.split('#')[0];
                let summary = '';
                if (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].trim().startsWith('[')) {
                    summary = lines[i + 1].trim();
                }
                else if (i + 2 < lines.length && lines[i + 2].trim() && !lines[i + 2].trim().startsWith('[')) {
                    summary = lines[i + 2].trim();
                }
                if (slug && !topics.some(t => t.slug === slug)) {
                    topics.push({
                        slug,
                        title,
                        category: currentCategory,
                        summary,
                        url: `${this.baseUrl}/${slug}`
                    });
                }
            }
        }
        return topics;
    }
    /**
     * Fetches raw markdown from Apple HIG CDN.
     */
    async fetchRawMarkdown(slug) {
        const cleanSlug = slug.replace(/^\/+|\.md$/g, '').toLowerCase();
        const targetUrl = cleanSlug
            ? `${this.baseUrl}/${cleanSlug}.md`
            : `${this.baseUrl}.md`;
        const res = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                'Accept': 'text/markdown, text/plain, */*'
            },
            redirect: 'follow'
        });
        if (!res.ok) {
            throw new Error(`Apple HIG returned HTTP ${res.status}: ${res.statusText} for '${cleanSlug}'`);
        }
        return await res.text();
    }
    /**
     * Fetches full guideline markdown with metadata.
     */
    async getGuideline(slugOrQuery) {
        await this.ensureIndex();
        let cleanSlug = slugOrQuery.trim().toLowerCase().replace(/^\/+|\.md$/g, '');
        const aliases = {
            'liquid-glass': 'materials',
            'glass': 'materials',
            'button': 'buttons',
            'icon': 'app-icons',
            'icons': 'icons',
            'font': 'typography',
            'fonts': 'typography',
            'colors': 'color',
            'darkmode': 'dark-mode',
            'ios': 'designing-for-ios',
            'macos': 'designing-for-macos',
            'visionos': 'designing-for-visionos',
            'spatial': 'designing-for-visionos',
            'principles': 'design-principles',
            'window': 'windows',
            'menu': 'menus',
            'tab-bar': 'tab-bars',
            'sidebar': 'sidebars',
            'toolbar': 'toolbars',
            'toggle': 'toggles',
            'slider': 'sliders',
            'haptic': 'feedback',
            'haptics': 'feedback'
        };
        if (aliases[cleanSlug]) {
            cleanSlug = aliases[cleanSlug];
        }
        // Check memory cache
        const cached = this.memoryCache.get(cleanSlug);
        if (cached && Date.now() - cached.doc.cachedAt < this.indexTtlMs) {
            return cached.doc;
        }
        // Check disk cache
        const diskPath = path.join(this.cacheDir, `${cleanSlug}.json`);
        if (fs.existsSync(diskPath)) {
            try {
                const fileContent = fs.readFileSync(diskPath, 'utf8');
                const parsed = JSON.parse(fileContent);
                if (Date.now() - parsed.cachedAt < this.indexTtlMs) {
                    this.memoryCache.set(cleanSlug, { doc: parsed });
                    return parsed;
                }
            }
            catch {
                // Fallback to fresh fetch
            }
        }
        // Fetch from Apple
        let markdown = '';
        try {
            markdown = await this.fetchRawMarkdown(cleanSlug);
        }
        catch {
            // Fuzzy lookup in full index
            const matched = this.topicIndex.find(t => t.slug === cleanSlug || t.title.toLowerCase() === cleanSlug || t.slug.includes(cleanSlug));
            if (matched) {
                cleanSlug = matched.slug;
                markdown = await this.fetchRawMarkdown(cleanSlug);
            }
            else {
                throw new Error(`Topic '${slugOrQuery}' not found in Apple Human Interface Guidelines.`);
            }
        }
        const { metadata, content } = this.extractFrontmatter(markdown);
        const title = metadata.title || this.extractTitle(content) || cleanSlug;
        const matchedTopic = this.topicIndex.find(t => t.slug === cleanSlug);
        const doc = {
            slug: cleanSlug,
            title,
            category: matchedTopic?.category,
            metadata,
            content,
            url: `${this.baseUrl}/${cleanSlug}`,
            cachedAt: Date.now()
        };
        this.memoryCache.set(cleanSlug, { doc });
        try {
            fs.writeFileSync(diskPath, JSON.stringify(doc, null, 2), 'utf8');
        }
        catch {
            // Ignore disk write failure
        }
        return doc;
    }
    /**
     * Search across titles, summaries, slugs, categories, and smart synonyms.
     */
    async search(query, categoryFilter) {
        await this.ensureIndex();
        const q = query.toLowerCase().trim();
        const terms = q.split(/\s+/).filter(Boolean);
        const synonymMap = {
            'liquid': ['materials'],
            'glass': ['materials'],
            'vibrancy': ['materials'],
            'blur': ['materials'],
            'traffic': ['windows'],
            'traffic-lights': ['windows'],
            'haptic': ['feedback'],
            'haptics': ['feedback'],
            'squircle': ['app-icons', 'layout'],
            'symbols': ['icons'],
            'symbol': ['icons'],
            'font': ['typography'],
            'fonts': ['typography'],
            'spring': ['motion'],
            'animation': ['motion'],
            'polish': ['materials', 'color', 'layout', 'design-principles'],
            'redesign': ['materials', 'layout', 'design-principles', 'getting-started']
        };
        const expandedSlugs = new Set();
        for (const term of terms) {
            if (synonymMap[term]) {
                for (const s of synonymMap[term])
                    expandedSlugs.add(s);
            }
        }
        return this.topicIndex
            .filter(topic => {
            if (categoryFilter && !topic.category.toLowerCase().includes(categoryFilter.toLowerCase())) {
                return false;
            }
            if (expandedSlugs.has(topic.slug))
                return true;
            const text = `${topic.title} ${topic.slug} ${topic.summary} ${topic.category}`.toLowerCase();
            return terms.every(term => text.includes(term));
        })
            .slice(0, 25);
    }
    /**
     * List all categories and their topic count.
     */
    async listCategories() {
        await this.ensureIndex();
        const counts = new Map();
        for (const t of this.topicIndex) {
            counts.set(t.category, (counts.get(t.category) || 0) + 1);
        }
        return Array.from(counts.entries()).map(([category, count]) => ({
            category,
            count
        }));
    }
    /**
     * List all topics within a category.
     */
    async listTopics(category) {
        await this.ensureIndex();
        if (!category)
            return this.topicIndex;
        const cat = category.toLowerCase().trim();
        return this.topicIndex.filter(t => t.category.toLowerCase().includes(cat));
    }
    /**
     * Extracts JSON frontmatter metadata enclosed in <!-- ... -->.
     */
    extractFrontmatter(markdown) {
        const commentMatch = markdown.match(/^<!--\s*([\s\S]*?)\s*-->/);
        if (!commentMatch) {
            return { metadata: {}, content: markdown.trim() };
        }
        let metadata = {};
        try {
            metadata = JSON.parse(commentMatch[1]);
        }
        catch {
            // Ignore malformed json
        }
        const content = markdown.slice(commentMatch[0].length).trim();
        return { metadata, content };
    }
    extractTitle(markdown) {
        const match = markdown.match(/^#\s+(.+)$/m);
        return match ? match[1].trim() : null;
    }
    getFallbackIndex() {
        return [
            { slug: 'materials', title: 'Materials & Liquid Glass', category: 'Foundations', summary: 'Liquid Glass and standard materials for depth, layering, and hierarchy.', url: `${this.baseUrl}/materials` },
            { slug: 'buttons', title: 'Buttons', category: 'Components', summary: 'Button styles, roles, content, press states, and 44pt touch targets.', url: `${this.baseUrl}/buttons` },
            { slug: 'color', title: 'Color', category: 'Foundations', summary: 'Judicious use of color, light/dark appearance, and Liquid Glass color adaptivity.', url: `${this.baseUrl}/color` },
            { slug: 'typography', title: 'Typography', category: 'Foundations', summary: 'System typefaces, SF Pro, Dynamic Type, optical alignment, and legibility.', url: `${this.baseUrl}/typography` },
            { slug: 'design-principles', title: 'Design principles', category: 'Platforms & Fundamentals', summary: 'Purpose, Agency, Responsibility, Familiarity, Flexibility, Simplicity, Craft, Delight.', url: `${this.baseUrl}/design-principles` },
            { slug: 'dark-mode', title: 'Dark Mode', category: 'Foundations', summary: 'Dynamic semantic palettes and low-light environmental adaptations.', url: `${this.baseUrl}/dark-mode` },
            { slug: 'accessibility', title: 'Accessibility', category: 'Foundations', summary: 'Accessible user interfaces, VoiceOver, high contrast, and reduced motion.', url: `${this.baseUrl}/accessibility` },
            { slug: 'layout', title: 'Layout', category: 'Foundations', summary: 'Adapting across display sizes, orientations, and multitasking configurations.', url: `${this.baseUrl}/layout` },
            { slug: 'designing-for-macos', title: 'Designing for macOS', category: 'Platforms & Fundamentals', summary: 'Window chrome, toolbars, sidebars, traffic lights, and keyboard shortcuts.', url: `${this.baseUrl}/designing-for-macos` },
            { slug: 'designing-for-ios', title: 'Designing for iOS', category: 'Platforms & Fundamentals', summary: 'Ergonomics, gestures, touch targets, and iOS multitasking.', url: `${this.baseUrl}/designing-for-ios` },
            { slug: 'designing-for-visionos', title: 'Designing for visionOS', category: 'Platforms & Fundamentals', summary: 'Spatial computing, ornaments, windows, volumes, and 60pt gaze/pinch targets.', url: `${this.baseUrl}/designing-for-visionos` }
        ];
    }
}
