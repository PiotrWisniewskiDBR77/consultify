/**
 * Organization Memory Store (Layer 3)
 *
 * Stores organization-wide patterns and learnings with vector embeddings.
 */

import { v4 as uuidv4 } from 'uuid';

import { aiLogger } from '../../../services/ai/logger.js';
import { getDatabase } from '../../database/Database.js';
import * as DbPromise from '../../utils/DbPromise.ts';
import { embeddingService } from './embeddingService.js';

export const ORG_MEMORY_TYPES = {
    SUCCESS_PATTERN: { weight: 1.2, minApplicability: 0.7 },
    FAILURE_PATTERN: { weight: 1.1, minApplicability: 0.6 },
    BEST_PRACTICE: { weight: 1.0, minApplicability: 0.8 },
    LESSON_LEARNED: { weight: 0.9, minApplicability: 0.5 },
    BENCHMARK: { weight: 0.8, minApplicability: 0.9 },
    TEMPLATE: { weight: 0.7, minApplicability: 0.9 },
    STANDARD: { weight: 1.0, minApplicability: 0.95 },
    AI_INSIGHT: { weight: 0.6, minApplicability: 0.4 },
} as const;

type OrgMemoryType = keyof typeof ORG_MEMORY_TYPES;

type OrgPatternInput = {
    type: OrgMemoryType | string;
    title: string;
    description: string;
    content: string | Record<string, unknown>;
    sourceProjectId?: string;
    sourceAssessmentId?: string;
    applicabilityScore?: number;
    tags?: string[];
    industry?: string;
    companySize?: string;
    createdBy?: string;
};

type SearchOptions = {
    types?: string[];
    limit?: number;
    minSimilarity?: number;
    industry?: string;
    includeInactive?: boolean;
};

type OrgMemoryRow = {
    id: string;
    organization_id: string;
    memory_type: string;
    title: string;
    description: string;
    content: string | Record<string, unknown> | null;
    embedding: string | null;
    source_project_id?: string | null;
    source_assessment_id?: string | null;
    applicability_score?: number | null;
    usage_count?: number | null;
    last_used_at?: string | null;
    tags?: string | string[] | null;
    industry?: string | null;
    company_size?: string | null;
    is_active?: number | boolean | null;
    created_by?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    similarity?: number;
};

type ExtractedPatterns = {
    successPatterns?: Array<{ title: string; description: string; keyFactors?: string[] }>;
    failurePatterns?: Array<{ title: string; description: string; warning?: string }>;
    bestPractices?: Array<{ title: string; description: string; steps?: string[] }>;
};

type LLMServiceCall = (args: {
    type: string;
    modelConfig: unknown;
    messages: Array<{ role: string; content: string }>;
    stream: boolean;
}) => Promise<{ content?: string }>;

type LLMServiceCtor = new () => { call: LLMServiceCall };
type ModelRouterCtor = new () => { getProviderConfig: (model: string, tier: string) => Promise<unknown> };

const parseJson = <T>(value: unknown, fallback: T): T => {
    if (!value) return fallback;
    if (typeof value === 'object') return value as T;
    try {
        return JSON.parse(String(value)) as T;
    } catch {
        return fallback;
    }
};

export class OrganizationMemoryStore {
    private isPg: boolean;

    constructor() {
        this.isPg = process.env.DB_TYPE === 'postgres';
        void this.ensureTable();
    }

    /**
     * Ensure the organization_memory table exists
     */
    async ensureTable(): Promise<void> {
        if (this.isPg) {
            return;
        }

        try {
            await DbPromise.run(
                `
                    CREATE TABLE IF NOT EXISTS organization_memory (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        memory_type TEXT NOT NULL,
                        title TEXT NOT NULL,
                        description TEXT NOT NULL,
                        content TEXT NOT NULL,
                        embedding TEXT,
                        source_project_id TEXT,
                        source_assessment_id TEXT,
                        applicability_score REAL DEFAULT 1.0,
                        usage_count INTEGER DEFAULT 0,
                        last_used_at TEXT,
                        tags TEXT,
                        industry TEXT,
                        company_size TEXT,
                        is_active INTEGER DEFAULT 1,
                        created_by TEXT,
                        created_at TEXT DEFAULT (datetime('now')),
                        updated_at TEXT DEFAULT (datetime('now'))
                    )
                `,
                [],
                { fallback: true },
            );
        } catch (error: unknown) {
            const err = error as Error;
            aiLogger.warn('OrgMemoryStore', `Table creation: ${err.message}`);
        }
    }

    /**
     * Add a pattern to organization memory
     */
    async addPattern(
        organizationId: string,
        pattern: OrgPatternInput,
    ): Promise<{ id: string; organizationId: string; type: string; title: string }> {
        const {
            type,
            title,
            description,
            content,
            sourceProjectId,
            sourceAssessmentId,
            applicabilityScore = 1.0,
            tags = [],
            industry,
            companySize,
            createdBy,
        } = pattern;

        const id = uuidv4();

        let embedding: number[] | null = null;
        try {
            const textToEmbed = `${title}. ${description}. ${JSON.stringify(content)}`.substring(0, 8000);
            embedding = await embeddingService.generateEmbedding(textToEmbed);
        } catch (error: unknown) {
            const err = error as Error;
            aiLogger.warn('OrgMemoryStore', `Embedding generation failed: ${err.message}`);
        }

        if (this.isPg) {
            const db = getDatabase();
            await db.query(
                `
                    INSERT INTO organization_memory
                    (id, organization_id, memory_type, title, description, content, embedding,
                     source_project_id, source_assessment_id, applicability_score, tags,
                     industry, company_size, created_by, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
                `,
                [
                    id,
                    organizationId,
                    type,
                    title,
                    description,
                    typeof content === 'string' ? content : JSON.stringify(content),
                    embedding ? JSON.stringify(embedding) : null,
                    sourceProjectId ?? null,
                    sourceAssessmentId ?? null,
                    applicabilityScore,
                    JSON.stringify(tags),
                    industry ?? null,
                    companySize ?? null,
                    createdBy ?? null,
                ],
            );
        } else {
            await DbPromise.run(
                `
                    INSERT INTO organization_memory 
                    (id, organization_id, memory_type, title, description, content, embedding, 
                     source_project_id, source_assessment_id, applicability_score, tags, 
                     industry, company_size, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                `,
                [
                    id,
                    organizationId,
                    type,
                    title,
                    description,
                    typeof content === 'string' ? content : JSON.stringify(content),
                    embedding ? JSON.stringify(embedding) : null,
                    sourceProjectId ?? null,
                    sourceAssessmentId ?? null,
                    applicabilityScore,
                    JSON.stringify(tags),
                    industry ?? null,
                    companySize ?? null,
                    createdBy ?? null,
                ],
                { fallback: false },
            );
        }

        aiLogger.info('OrgMemoryStore', `Added pattern ${id} to org ${organizationId}`);
        return { id, organizationId, type, title };
    }

    /**
     * Add a success pattern from a completed project
     */
    async addSuccessPattern(
        organizationId: string,
        successData: {
            projectId: string;
            title?: string;
            description: string;
            keyFactors?: string[];
            metrics?: Record<string, unknown>;
            recommendations?: string[];
            createdBy?: string;
        },
    ): Promise<{ id: string; organizationId: string; type: string; title: string }> {
        const { projectId, title, description, keyFactors, metrics, recommendations, createdBy } = successData;

        return this.addPattern(organizationId, {
            type: 'SUCCESS_PATTERN',
            title: title || 'Project Success Pattern',
            description,
            content: {
                keyFactors: keyFactors || [],
                metrics: metrics || {},
                recommendations: recommendations || [],
                extractedAt: new Date().toISOString(),
            },
            sourceProjectId: projectId,
            applicabilityScore: 0.8,
            tags: ['success', 'pattern'],
            createdBy,
        });
    }

    /**
     * Add a best practice
     */
    async addBestPractice(
        organizationId: string,
        practiceData: {
            title: string;
            description: string;
            steps?: string[];
            benefits?: string[];
            applicableContexts?: string[];
            industry?: string;
            createdBy?: string;
        },
    ): Promise<{ id: string; organizationId: string; type: string; title: string }> {
        const { title, description, steps, benefits, applicableContexts, industry, createdBy } = practiceData;

        return this.addPattern(organizationId, {
            type: 'BEST_PRACTICE',
            title,
            description,
            content: {
                steps: steps || [],
                benefits: benefits || [],
                applicableContexts: applicableContexts || [],
                validatedAt: new Date().toISOString(),
            },
            applicabilityScore: 0.9,
            tags: ['best-practice'],
            industry,
            createdBy,
        });
    }

    /**
     * Search patterns using semantic similarity
     */
    async searchPatterns(organizationId: string, query: string, options: SearchOptions = {}): Promise<OrgMemoryRow[]> {
        const { types, limit = 10 } = options;

        if (!query || query.trim().length === 0) {
            return this.getRecentPatterns(organizationId, { types, limit });
        }

        try {
            const queryEmbedding = await embeddingService.generateEmbedding(query);

            if (this.isPg) {
                return this._searchPg(organizationId, queryEmbedding, options);
            }
            return this._searchSqlite(organizationId, queryEmbedding, options);
        } catch (error: unknown) {
            const err = error as Error;
            aiLogger.error('OrgMemoryStore', `Search error: ${err.message}`);
            return this._keywordSearch(organizationId, query, options);
        }
    }

    /**
     * SQLite semantic search (cosine similarity in JS)
     */
    private async _searchSqlite(
        organizationId: string,
        queryEmbedding: number[],
        options: SearchOptions,
    ): Promise<OrgMemoryRow[]> {
        const { types, limit = 10, minSimilarity = 0.5, includeInactive = false } = options;

        let sql = `SELECT * FROM organization_memory WHERE organization_id = ?`;
        const params: unknown[] = [organizationId];

        if (!includeInactive) {
            sql += ` AND is_active = 1`;
        }

        if (types && types.length > 0) {
            sql += ` AND memory_type IN (${types.map(() => '?').join(',')})`;
            params.push(...types);
        }

        const rows = await DbPromise.all<OrgMemoryRow>(sql, params, { fallback: false });
        if (!rows || rows.length === 0) {
            return [];
        }

        const results = rows
            .map((row) => {
                const embedding = parseJson<number[] | null>(row.embedding, null);
                if (!embedding || embedding.length === 0) {
                    return { ...row, similarity: 0 };
                }
                const similarity = this._cosineSimilarity(queryEmbedding, embedding);
                return {
                    ...row,
                    similarity,
                    content: parseJson(row.content, row.content),
                    tags: parseJson(row.tags, []),
                };
            })
            .filter((row) => (row.similarity ?? 0) >= minSimilarity)
            .sort((a, b) => {
                const weightA = ORG_MEMORY_TYPES[a.memory_type as OrgMemoryType]?.weight || 1;
                const weightB = ORG_MEMORY_TYPES[b.memory_type as OrgMemoryType]?.weight || 1;
                return (b.similarity ?? 0) * weightB - (a.similarity ?? 0) * weightA;
            })
            .slice(0, limit);

        await this._updateUsageCounts(results.map((row) => row.id));
        return results;
    }

    /**
     * PostgreSQL semantic search (pgvector)
     */
    private async _searchPg(
        organizationId: string,
        queryEmbedding: number[],
        options: SearchOptions,
    ): Promise<OrgMemoryRow[]> {
        const { types, limit = 10, minSimilarity = 0.5, includeInactive = false } = options;
        const vectorLiteral = `[${queryEmbedding.join(',')}]`;

        let sql = `
            SELECT *,
                   1 - (embedding <=> $1::vector) as similarity
            FROM organization_memory
            WHERE organization_id = $2
            AND 1 - (embedding <=> $1::vector) > $3
        `;
        const params: Array<string | number> = [vectorLiteral, organizationId, minSimilarity];
        let paramIndex = 4;

        if (!includeInactive) {
            sql += ` AND is_active = true`;
        }

        if (types && types.length > 0) {
            sql += ` AND memory_type IN (${types.map((_, i) => `$${paramIndex + i}`).join(',')})`;
            params.push(...types);
            paramIndex += types.length;
        }

        sql += ` ORDER BY embedding <=> $1::vector LIMIT $${paramIndex}`;
        params.push(limit);

        const db = getDatabase();
        const result = await db.query<OrgMemoryRow>(sql, params);
        const rows = (result.rows || []).map((row) => ({
            ...row,
            content: parseJson(row.content, row.content),
            tags: parseJson(row.tags, []),
        }));

        await this._updateUsageCounts(rows.map((row) => row.id));
        return rows;
    }

    /**
     * Keyword-based search fallback
     */
    private async _keywordSearch(
        organizationId: string,
        query: string,
        options: SearchOptions,
    ): Promise<OrgMemoryRow[]> {
        const { types, limit = 10, includeInactive = false } = options;
        const searchTerm = `%${query.toLowerCase()}%`;

        if (this.isPg) {
            let sql = `
                SELECT * FROM organization_memory 
                WHERE organization_id = $1
                AND (LOWER(title) LIKE $2 OR LOWER(description) LIKE $2 OR LOWER(tags) LIKE $2)
            `;
            const params: Array<string | number> = [organizationId, searchTerm];
            let paramIndex = 3;

            if (!includeInactive) {
                sql += ` AND is_active = true`;
            }

            if (types && types.length > 0) {
                sql += ` AND memory_type IN (${types.map((_, i) => `$${paramIndex + i}`).join(',')})`;
                params.push(...types);
                paramIndex += types.length;
            }

            sql += ` ORDER BY usage_count DESC, created_at DESC LIMIT $${paramIndex}`;
            params.push(limit);

            const db = getDatabase();
            const result = await db.query<OrgMemoryRow>(sql, params);
            return (result.rows || []).map((row) => ({
                ...row,
                similarity: 0.5,
                content: parseJson(row.content, row.content),
                tags: parseJson(row.tags, []),
            }));
        }

        let sql = `
            SELECT * FROM organization_memory 
            WHERE organization_id = ?
            AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags) LIKE ?)
        `;
        const params: unknown[] = [organizationId, searchTerm, searchTerm, searchTerm];

        if (!includeInactive) {
            sql += ` AND is_active = 1`;
        }

        if (types && types.length > 0) {
            sql += ` AND memory_type IN (${types.map(() => '?').join(',')})`;
            params.push(...types);
        }

        sql += ` ORDER BY usage_count DESC, created_at DESC LIMIT ?`;
        params.push(limit);

        const rows = await DbPromise.all<OrgMemoryRow>(sql, params, { fallback: false });
        return (rows || []).map((row) => ({
            ...row,
            similarity: 0.5,
            content: parseJson(row.content, row.content),
            tags: parseJson(row.tags, []),
        }));
    }

    /**
     * Get recent patterns without search
     */
    async getRecentPatterns(
        organizationId: string,
        options: { types?: string[]; limit?: number } = {},
    ): Promise<OrgMemoryRow[]> {
        const { types, limit = 10 } = options;

        if (this.isPg) {
            let sql = `
                SELECT * FROM organization_memory 
                WHERE organization_id = $1 AND is_active = true
            `;
            const params: Array<string | number> = [organizationId];
            let paramIndex = 2;

            if (types && types.length > 0) {
                sql += ` AND memory_type IN (${types.map((_, i) => `$${paramIndex + i}`).join(',')})`;
                params.push(...types);
                paramIndex += types.length;
            }

            sql += ` ORDER BY usage_count DESC, created_at DESC LIMIT $${paramIndex}`;
            params.push(limit);

            const db = getDatabase();
            const result = await db.query<OrgMemoryRow>(sql, params);
            return (result.rows || []).map((row) => ({
                ...row,
                content: parseJson(row.content, row.content),
                tags: parseJson(row.tags, []),
            }));
        }

        let sql = `
            SELECT * FROM organization_memory 
            WHERE organization_id = ? AND is_active = 1
        `;
        const params: unknown[] = [organizationId];

        if (types && types.length > 0) {
            sql += ` AND memory_type IN (${types.map(() => '?').join(',')})`;
            params.push(...types);
        }

        sql += ` ORDER BY usage_count DESC, created_at DESC LIMIT ?`;
        params.push(limit);

        const rows = await DbPromise.all<OrgMemoryRow>(sql, params, { fallback: false });
        return (rows || []).map((row) => ({
            ...row,
            content: parseJson(row.content, row.content),
            tags: parseJson(row.tags, []),
        }));
    }

    /**
     * Extract patterns from a completed project using AI
     */
    async extractPatternsFromProject(
        organizationId: string,
        projectData: {
            id: string;
            name: string;
            industry?: string;
            duration?: string;
            outcomes?: Record<string, unknown>;
            decisions?: unknown[];
            learnings?: unknown[];
        },
    ): Promise<{ extracted: number; error?: string }> {
        try {
            const llmModule = await import('../../../services/ai/llmService.js');
            const LLMService = llmModule.LLMService as LLMServiceCtor | undefined;
            const modelModule = await import('../../../services/ai/modelRouter.js');
            const modelExport = (modelModule.default ?? modelModule) as { ModelRouter?: ModelRouterCtor };
            const ModelRouter = modelExport.ModelRouter;

            if (!LLMService || !ModelRouter) {
                throw new Error('LLM services unavailable');
            }

            const llmService = new LLMService();
            const modelRouter = new ModelRouter();

            const modelConfig = await modelRouter.getProviderConfig('gpt-4o-mini', 'STANDARD');

            const prompt = `Analyze this completed project and extract reusable patterns:

Project: ${projectData.name}
Industry: ${projectData.industry || 'Unknown'}
Duration: ${projectData.duration || 'Unknown'}
Outcomes: ${JSON.stringify(projectData.outcomes || {})}
Key Decisions: ${JSON.stringify(projectData.decisions || [])}
Lessons Learned: ${JSON.stringify(projectData.learnings || [])}

Extract:
1. 2-3 success patterns (what worked well)
2. 1-2 failure patterns (what to avoid)
3. Key best practices

Return JSON:
{
  "successPatterns": [{ "title": "...", "description": "...", "keyFactors": [...] }],
  "failurePatterns": [{ "title": "...", "description": "...", "warning": "..." }],
  "bestPractices": [{ "title": "...", "description": "...", "steps": [...] }]
}`;

            const response = await llmService.call({
                type: 'chat',
                modelConfig,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
            });

            const patterns = parseJson<ExtractedPatterns | null>(response.content, null);
            if (!patterns) {
                aiLogger.warn('OrgMemoryStore', 'Could not parse pattern extraction response');
                return { extracted: 0 };
            }

            let extractedCount = 0;

            for (const pattern of patterns.successPatterns || []) {
                await this.addSuccessPattern(organizationId, {
                    projectId: projectData.id,
                    ...pattern,
                    createdBy: 'ai',
                });
                extractedCount++;
            }

            for (const pattern of patterns.failurePatterns || []) {
                await this.addPattern(organizationId, {
                    type: 'FAILURE_PATTERN',
                    title: pattern.title,
                    description: pattern.description,
                    content: { warning: pattern.warning },
                    sourceProjectId: projectData.id,
                    applicabilityScore: 0.7,
                    tags: ['failure', 'warning'],
                    createdBy: 'ai',
                });
                extractedCount++;
            }

            for (const practice of patterns.bestPractices || []) {
                await this.addBestPractice(organizationId, {
                    ...practice,
                    industry: projectData.industry,
                    createdBy: 'ai',
                });
                extractedCount++;
            }

            aiLogger.info('OrgMemoryStore', `Extracted ${extractedCount} patterns from project ${projectData.id}`);
            return { extracted: extractedCount };
        } catch (error: unknown) {
            const err = error as Error;
            aiLogger.error('OrgMemoryStore', `Pattern extraction failed: ${err.message}`);
            return { extracted: 0, error: err.message };
        }
    }

    /**
     * Update usage count for accessed patterns
     */
    private async _updateUsageCounts(ids: string[]): Promise<void> {
        if (!ids || ids.length === 0) return;

        if (this.isPg) {
            const db = getDatabase();
            await db.query(
                `
                    UPDATE organization_memory
                    SET usage_count = usage_count + 1,
                        last_used_at = NOW()
                    WHERE id = ANY($1::text[])
                `,
                [ids],
            );
            return;
        }

        const placeholders = ids.map(() => '?').join(',');
        await DbPromise.run(
            `
                UPDATE organization_memory 
                SET usage_count = usage_count + 1,
                    last_used_at = datetime('now')
                WHERE id IN (${placeholders})
            `,
            ids,
            { fallback: true },
        );
    }

    /**
     * Deactivate low-value patterns
     */
    async deactivateLowValuePatterns(
        organizationId: string,
        minUsage = 0,
        daysOld = 180,
    ): Promise<{ deactivated: number }> {
        if (this.isPg) {
            const db = getDatabase();
            const result = await db.query(
                `
                    UPDATE organization_memory 
                    SET is_active = false, updated_at = NOW()
                    WHERE organization_id = $1
                    AND usage_count <= $2
                    AND created_at < NOW() - ($3 * INTERVAL '1 day')
                    AND memory_type NOT IN ('STANDARD', 'TEMPLATE')
                `,
                [organizationId, minUsage, daysOld],
            );
            return { deactivated: result.rowCount ?? 0 };
        }

        const result = await DbPromise.run(
            `
                UPDATE organization_memory 
                SET is_active = 0, updated_at = datetime('now')
                WHERE organization_id = ?
                AND usage_count <= ?
                AND created_at < datetime('now', '-' || ? || ' days')
                AND memory_type NOT IN ('STANDARD', 'TEMPLATE')
            `,
            [organizationId, minUsage, daysOld],
            { fallback: false },
        );

        return { deactivated: result.changes ?? 0 };
    }

    /**
     * Compute cosine similarity
     */
    private _cosineSimilarity(a: number[], b: number[]): number {
        if (!a || !b || a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

export const organizationMemoryStore = new OrganizationMemoryStore();

export default {
    OrganizationMemoryStore,
    organizationMemoryStore,
    ORG_MEMORY_TYPES,
};
