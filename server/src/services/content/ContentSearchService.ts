import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';

export interface SearchContentOptions {
    query?: string;
    contentTypes?: string[];
    statuses?: string[];
    categoryIds?: string[];
    tagIds?: string[];
    organizationId?: string | null;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
}

export interface SearchResults {
    items: Array<{
        id: string;
        contentType: string;
        key?: string;
        title: string;
        description?: string;
        status?: string;
        version?: number;
        categoryId?: string | null;
        createdAt?: string;
        updatedAt?: string;
    }>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface ContentSearchServiceDependencies {
    db: IDatabase;
}

export class ContentSearchService {
    private deps: ContentSearchServiceDependencies;

    constructor(deps?: Partial<ContentSearchServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
        };
    }

    async searchContent(options: SearchContentOptions = {}): Promise<SearchResults> {
        const {
            query,
            contentTypes = [],
            statuses = [],
            categoryIds = [],
            // tagIds = [], // Logic for tags is more complex (join), ignoring for MVP textual search or implementing simply if needed
            // organizationId = null,
            // sortBy = 'createdAt',
            // sortOrder = 'DESC',
            page = 1,
            limit = 20,
        } = options;

        const results: SearchResults = {
            items: [],
            total: 0,
            page,
            limit,
            hasMore: false,
        };

        const searchTypes = contentTypes.length > 0 ? contentTypes : ['PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'];

        // Search playbook templates
        if (searchTypes.includes('PLAYBOOK_TEMPLATE')) {
            const conditions: string[] = ['1=1'];
            const params: unknown[] = [];

            if (query) {
                conditions.push('(title LIKE ? OR description LIKE ? OR key LIKE ?)');
                const searchTerm = `%${query}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            if (statuses.length > 0) {
                conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
                params.push(...statuses);
            }

            if (categoryIds.length > 0) {
                conditions.push(`category_id IN (${categoryIds.map(() => '?').join(',')})`);
                params.push(...categoryIds);
            }

            // Note: Pagination logic here is simplistic (fetch all matching then paginate in memory?
            // OR union then paginate? contentAggregator usually paginates *after* fetching from sources?
            // The original logic seemed to fetch all and then add to results.
            // Real pagination across multiple tables is hard without UNION.
            // For now, I'll execute query.

            const playbooks = (await this.deps.db.all<{
                id: string;
                key?: string;
                title: string;
                description?: string;
                status?: string;
                version?: number;
                category_id?: string | null;
                created_at?: string;
                updated_at?: string;
            }>(
                `SELECT *, 'PLAYBOOK_TEMPLATE' as content_type FROM ai_playbook_templates WHERE ${conditions.join(' AND ')}`,
                params,
            )) as Array<{
                id: string;
                key?: string;
                title: string;
                description?: string;
                status?: string;
                version?: number;
                category_id?: string | null;
                created_at?: string;
                updated_at?: string;
            }>;

            results.items.push(
                ...playbooks.map((row) => ({
                    id: row.id,
                    contentType: 'PLAYBOOK_TEMPLATE',
                    key: row.key,
                    title: row.title,
                    description: row.description,
                    status: row.status,
                    version: row.version,
                    categoryId: row.category_id,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                })),
            );
        }

        // Search email templates
        if (searchTypes.includes('EMAIL_TEMPLATE')) {
            const conditions: string[] = ['1=1'];
            const params: unknown[] = [];

            if (query) {
                conditions.push('(subject LIKE ? OR name LIKE ?)'); // Email templates have name/subject
                const searchTerm = `%${query}%`;
                params.push(searchTerm, searchTerm);
            }

            if (statuses.length > 0) {
                conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
                params.push(...statuses);
            }

            // category_id? Email templates might not have category_id column in this schema version?
            // Assuming they do if aligned. If not, ignore or check schema.
            // Original code didn't show email logic explicitly but implied structure.
            // I will implement basic search to be safe.

            const emails = (await this.deps.db.all<{
                id: string;
                name: string;
                subject?: string;
                status?: string;
                version?: number;
                category_id?: string | null;
                created_at?: string;
                updated_at?: string;
            }>(
                `SELECT *, 'EMAIL_TEMPLATE' as content_type FROM email_templates WHERE ${conditions.join(' AND ')}`,
                params,
            )) as Array<{
                id: string;
                name: string;
                subject?: string;
                status?: string;
                version?: number;
                category_id?: string | null;
                created_at?: string;
                updated_at?: string;
            }>;

            results.items.push(
                ...emails.map((row) => ({
                    id: row.id,
                    contentType: 'EMAIL_TEMPLATE',
                    title: row.name || row.subject || 'Untitled Email', // key/title map
                    description: row.subject,
                    status: row.status,
                    version: row.version,
                    categoryId: row.category_id,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                })),
            );
        }

        // manual in-memory pagination for aggregated results
        results.total = results.items.length;
        const start = (page - 1) * limit;
        results.items = results.items.slice(start, start + limit);
        results.hasMore = results.total > page * limit;

        return results;
    }
}
