import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUNDLED_DATA_DIR = path.resolve(__dirname, '..', 'data');
export class AppleHigClient {
    baseUrl = 'https://developer.apple.com/design/human-interface-guidelines';
    userCacheDir = path.join(os.homedir(), '.cache', 'apple-hig-mcp');
    memoryCache = new Map();
    pendingGuidelineRequests = new Map();
    pendingIndexRequest = null;
    maxCacheFiles = 60;
    topicIndex = [];
    indexLoadedAt = 0;
    indexTtlMs = 1000 * 60 * 60 * 24 * 7; // 7 days cache TTL
    isRefreshingIndex = false;
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
            if (!fs.existsSync(this.userCacheDir)) {
                fs.mkdirSync(this.userCacheDir, { recursive: true });
            }
            else {
                this.autoPruneCache();
            }
        }
        catch {
            // Ignore cache dir creation errors, memory cache will be used
        }
        if (typeof process !== 'undefined') {
            process.once('beforeExit', () => {
                try {
                    this.pruneExpiredSync();
                }
                catch { }
            });
        }
    }
    /**
     * Initializes or returns the cached index in sub-millisecond time.
     * Employs deduplication and stale-while-revalidate pattern.
     */
    async ensureIndex() {
        const now = Date.now();
        // 1. In-memory check (0.001 ms)
        if (this.topicIndex.length > 80) {
            if (now - this.indexLoadedAt > this.indexTtlMs && !this.isRefreshingIndex) {
                this.triggerBackgroundIndexRefresh();
            }
            return this.topicIndex;
        }
        // Reuse pending index request if in-flight
        if (this.pendingIndexRequest) {
            return await this.pendingIndexRequest;
        }
        // 2. User disk cache check (0.05 ms)
        const diskIndexPath = path.join(this.userCacheDir, 'index.json');
        if (fs.existsSync(diskIndexPath)) {
            try {
                const raw = fs.readFileSync(diskIndexPath, 'utf8');
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 80) {
                    this.topicIndex = parsed;
                    this.indexLoadedAt = now;
                    return this.topicIndex;
                }
            }
            catch {
                // Fallback to bundled
            }
        }
        // 3. Bundled pre-packaged index check (0.05 ms)
        const bundledIndexPath = path.join(BUNDLED_DATA_DIR, 'index.json');
        if (fs.existsSync(bundledIndexPath)) {
            try {
                const raw = fs.readFileSync(bundledIndexPath, 'utf8');
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 80) {
                    this.topicIndex = parsed;
                    this.indexLoadedAt = now;
                    // Seed the user cache
                    try {
                        fs.writeFileSync(diskIndexPath, raw, 'utf8');
                    }
                    catch { }
                    return this.topicIndex;
                }
            }
            catch {
                // Fallback to network
            }
        }
        // 4. Synchronous network fetch as last resort (deduplicated)
        this.pendingIndexRequest = this.fetchIndexFromNetwork().finally(() => {
            this.pendingIndexRequest = null;
        });
        await this.pendingIndexRequest;
        return this.topicIndex;
    }
    triggerBackgroundIndexRefresh() {
        if (this.isRefreshingIndex)
            return;
        this.isRefreshingIndex = true;
        this.fetchIndexFromNetwork()
            .catch(() => { })
            .finally(() => {
            this.isRefreshingIndex = false;
        });
    }
    async fetchIndexFromNetwork() {
        const allTopics = new Map();
        try {
            const masterMd = await this.fetchRawMarkdown('');
            const masterTopics = this.parseIndex(masterMd, 'General');
            for (const t of masterTopics)
                allTopics.set(t.slug, t);
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
            this.indexLoadedAt = Date.now();
            const diskIndexPath = path.join(this.userCacheDir, 'index.json');
            try {
                fs.writeFileSync(diskIndexPath, JSON.stringify(this.topicIndex, null, 2), 'utf8');
            }
            catch { }
        }
        catch (err) {
            if (this.topicIndex.length === 0) {
                this.topicIndex = this.getFallbackIndex();
            }
        }
        return this.topicIndex;
    }
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
    async fetchRawMarkdown(slug) {
        const cleanSlug = slug.replace(/^\/+|\.md$/g, '').toLowerCase();
        const targetUrl = cleanSlug
            ? `${this.baseUrl}/${cleanSlug}.md`
            : `${this.baseUrl}.md`;
        const res = await fetch(targetUrl, {
            signal: AbortSignal.timeout(6000),
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
     * Fetches full guideline markdown with metadata in sub-millisecond time.
     * Deduplicates concurrent requests, caches extracted text, and self-cleans.
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
        // 1. Check in-memory cache (0.001 ms)
        const cached = this.memoryCache.get(cleanSlug);
        if (cached) {
            return cached.doc;
        }
        // 2. Check user disk cache (0.05 ms)
        const userDiskPath = path.join(this.userCacheDir, `${cleanSlug}.json`);
        if (fs.existsSync(userDiskPath)) {
            try {
                const fileContent = fs.readFileSync(userDiskPath, 'utf8');
                const parsed = JSON.parse(fileContent);
                const isExpired = parsed.expiresAt ? Date.now() > parsed.expiresAt : (Date.now() - parsed.cachedAt > this.indexTtlMs);
                if (!isExpired) {
                    this.memoryCache.set(cleanSlug, { doc: parsed });
                    return parsed;
                }
            }
            catch { }
        }
        // 3. Check bundled offline pre-packaged cache (0.05 ms)
        const bundledDocPath = path.join(BUNDLED_DATA_DIR, 'guidelines', `${cleanSlug}.json`);
        if (fs.existsSync(bundledDocPath)) {
            try {
                const fileContent = fs.readFileSync(bundledDocPath, 'utf8');
                const parsed = JSON.parse(fileContent);
                this.memoryCache.set(cleanSlug, { doc: parsed });
                return parsed;
            }
            catch { }
        }
        // 4. In-flight request deduplication: reuse running request if topic already being fetched
        const pending = this.pendingGuidelineRequests.get(cleanSlug);
        if (pending) {
            return await pending;
        }
        // 5. Fetch live from Apple once, parse, store in cache, and trigger auto-prune
        const fetchPromise = this.fetchAndStoreGuideline(cleanSlug, slugOrQuery)
            .finally(() => {
            this.pendingGuidelineRequests.delete(cleanSlug);
        });
        this.pendingGuidelineRequests.set(cleanSlug, fetchPromise);
        return await fetchPromise;
    }
    async fetchAndStoreGuideline(cleanSlug, originalQuery) {
        let markdown = '';
        let resolvedSlug = cleanSlug;
        try {
            markdown = await this.fetchRawMarkdown(resolvedSlug);
        }
        catch {
            const matched = this.topicIndex.find(t => t.slug === cleanSlug || t.title.toLowerCase() === cleanSlug || t.slug.includes(cleanSlug));
            if (matched) {
                resolvedSlug = matched.slug;
                markdown = await this.fetchRawMarkdown(resolvedSlug);
            }
            else {
                throw new Error(`Topic '${originalQuery}' not found in Apple Human Interface Guidelines.`);
            }
        }
        const { metadata, content } = this.extractFrontmatter(markdown);
        const title = metadata.title || this.extractTitle(content) || resolvedSlug;
        const matchedTopic = this.topicIndex.find(t => t.slug === resolvedSlug);
        const doc = {
            slug: resolvedSlug,
            title,
            category: matchedTopic?.category,
            metadata,
            content,
            url: `${this.baseUrl}/${resolvedSlug}`,
            cachedAt: Date.now(),
            expiresAt: Date.now() + this.indexTtlMs
        };
        this.memoryCache.set(resolvedSlug, { doc });
        if (cleanSlug !== resolvedSlug) {
            this.memoryCache.set(cleanSlug, { doc });
        }
        const userDiskPath = path.join(this.userCacheDir, `${resolvedSlug}.json`);
        try {
            fs.writeFileSync(userDiskPath, JSON.stringify(doc, null, 2), 'utf8');
            this.autoPruneCache();
        }
        catch { }
        return doc;
    }
    /**
     * Asynchronously prunes expired and excess cache files without blocking execution.
     */
    autoPruneCache() {
        setImmediate(() => {
            try {
                this.pruneExpiredSync();
            }
            catch { }
        });
    }
    /**
     * Synchronously removes expired cache files and enforces LRU max cache limits.
     */
    pruneExpiredSync() {
        if (!fs.existsSync(this.userCacheDir))
            return;
        try {
            const files = fs.readdirSync(this.userCacheDir);
            const now = Date.now();
            const validFiles = [];
            for (const file of files) {
                if (!file.endsWith('.json') || file === 'index.json')
                    continue;
                const fullPath = path.join(this.userCacheDir, file);
                try {
                    const stat = fs.statSync(fullPath);
                    if (now - stat.mtimeMs > this.indexTtlMs) {
                        fs.unlinkSync(fullPath);
                        continue;
                    }
                    validFiles.push({ fullPath, mtime: stat.mtimeMs });
                }
                catch { }
            }
            // LRU eviction if exceeding maxCacheFiles limit
            if (validFiles.length > this.maxCacheFiles) {
                validFiles.sort((a, b) => a.mtime - b.mtime);
                const excessCount = validFiles.length - this.maxCacheFiles;
                for (let i = 0; i < excessCount; i++) {
                    try {
                        fs.unlinkSync(validFiles[i].fullPath);
                    }
                    catch { }
                }
            }
        }
        catch { }
    }
    /**
     * Manually clears all memory and disk caches.
     */
    clearCache() {
        this.memoryCache.clear();
        try {
            if (fs.existsSync(this.userCacheDir)) {
                fs.rmSync(this.userCacheDir, { recursive: true, force: true });
                fs.mkdirSync(this.userCacheDir, { recursive: true });
            }
        }
        catch { }
    }
    /**
     * Search across titles, summaries, slugs, categories, and smart synonyms (0.1ms).
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
    async listTopics(category) {
        await this.ensureIndex();
        if (!category)
            return this.topicIndex;
        const cat = category.toLowerCase().trim();
        return this.topicIndex.filter(t => t.category.toLowerCase().includes(cat));
    }
    extractFrontmatter(markdown) {
        const commentMatch = markdown.match(/^<!--\s*([\s\S]*?)\s*-->/);
        if (!commentMatch) {
            return { metadata: {}, content: markdown.trim() };
        }
        let metadata = {};
        try {
            metadata = JSON.parse(commentMatch[1]);
        }
        catch { }
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
