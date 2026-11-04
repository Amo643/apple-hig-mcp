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
    expiresAt?: number;
}
export declare class AppleHigClient {
    private readonly baseUrl;
    private readonly userCacheDir;
    private readonly memoryCache;
    private readonly pendingGuidelineRequests;
    private pendingIndexRequest;
    private readonly maxCacheFiles;
    private topicIndex;
    private indexLoadedAt;
    private readonly indexTtlMs;
    private isRefreshingIndex;
    private readonly subIndices;
    constructor();
    /**
     * Initializes or returns the cached index in sub-millisecond time.
     * Employs deduplication and stale-while-revalidate pattern.
     */
    ensureIndex(): Promise<HigTopic[]>;
    private triggerBackgroundIndexRefresh;
    private fetchIndexFromNetwork;
    private parseIndex;
    private fetchRawMarkdown;
    /**
     * Fetches full guideline markdown with metadata in sub-millisecond time.
     * Deduplicates concurrent requests, caches extracted text, and self-cleans.
     */
    getGuideline(slugOrQuery: string): Promise<HigDocument>;
    private fetchAndStoreGuideline;
    /**
     * Asynchronously prunes expired and excess cache files without blocking execution.
     */
    private autoPruneCache;
    /**
     * Synchronously removes expired cache files and enforces LRU max cache limits.
     */
    pruneExpiredSync(): void;
    /**
     * Manually clears all memory and disk caches.
     */
    clearCache(): void;
    /**
     * Search across titles, summaries, slugs, categories, and smart synonyms (0.1ms).
     */
    search(query: string, categoryFilter?: string): Promise<HigTopic[]>;
    listCategories(): Promise<{
        category: string;
        count: number;
    }[]>;
    listTopics(category?: string): Promise<HigTopic[]>;
    private extractFrontmatter;
    private extractTitle;
    private getFallbackIndex;
}
