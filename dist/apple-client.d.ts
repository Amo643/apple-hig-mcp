export interface HigTopic {
    slug: string;
    title: string;
    category: string;
    summary: string;
    url: string;
}
export interface HigDocument {
    slug: string;
    title: string;
    category?: string;
    metadata: Record<string, unknown>;
    content: string;
    url: string;
    cachedAt: number;
}
export declare class AppleHigClient {
    private readonly baseUrl;
    private readonly cacheDir;
    private readonly memoryCache;
    private topicIndex;
    private indexLoadedAt;
    private readonly indexTtlMs;
    private readonly subIndices;
    constructor();
    /**
     * Initializes or refreshes the complete topic index across all categories.
     */
    ensureIndex(): Promise<HigTopic[]>;
    /**
     * Parses topics and summaries from an Apple HIG markdown file.
     */
    private parseIndex;
    /**
     * Fetches raw markdown from Apple HIG CDN.
     */
    private fetchRawMarkdown;
    /**
     * Fetches full guideline markdown with metadata.
     */
    getGuideline(slugOrQuery: string): Promise<HigDocument>;
    /**
     * Search across titles, summaries, slugs, categories, and smart synonyms.
     */
    search(query: string, categoryFilter?: string): Promise<HigTopic[]>;
    /**
     * List all categories and their topic count.
     */
    listCategories(): Promise<{
        category: string;
        count: number;
    }[]>;
    /**
     * List all topics within a category.
     */
    listTopics(category?: string): Promise<HigTopic[]>;
    /**
     * Extracts JSON frontmatter metadata enclosed in <!-- ... -->.
     */
    private extractFrontmatter;
    private extractTitle;
    private getFallbackIndex;
}
