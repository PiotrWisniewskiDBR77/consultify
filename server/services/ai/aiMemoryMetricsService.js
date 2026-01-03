/**
 * AI Memory Metrics Service
 * 
 * Tracks and reports on AI memory usage, performance, and efficiency.
 * Part of the Enterprise AI Readiness initiative for memory management visibility.
 * 
 * @version 1.0.0
 */

const db = require('../../database');
const { v4: uuidv4 } = require('uuid');
const AIMemoryManager = require('../aiMemoryManager');

const AIMemoryMetricsService = {
    /**
     * Record memory operation metrics
     */
    recordOperation: async (operationType, context, metrics) => {
        const { organizationId, projectId, userId } = context;
        const now = new Date();
        const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
        const hourEnd = new Date(hourStart.getTime() + 3600000);

        return new Promise((resolve, reject) => {
            // Upsert hourly record
            const id = uuidv4();
            const sql = `
                INSERT INTO ai_memory_metrics (
                    id, organization_id, project_id, user_id,
                    session_memory_tokens, project_memory_tokens, org_memory_tokens, user_pref_tokens, total_memory_tokens,
                    memory_reads, memory_writes, memory_trims, memory_cleanups,
                    relevance_score_avg, relevance_hits, relevance_misses,
                    tokens_saved_by_trim, estimated_cost_saved,
                    avg_retrieval_time_ms, p95_retrieval_time_ms,
                    period_type, period_start, period_end
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HOURLY', ?, ?)
                ON CONFLICT(organization_id, period_start) DO UPDATE SET
                    memory_reads = memory_reads + CASE WHEN ? = 'READ' THEN 1 ELSE 0 END,
                    memory_writes = memory_writes + CASE WHEN ? IN ('WRITE', 'RECORD') THEN 1 ELSE 0 END,
                    memory_trims = memory_trims + CASE WHEN ? = 'TRIM' THEN 1 ELSE 0 END,
                    memory_cleanups = memory_cleanups + CASE WHEN ? = 'CLEANUP' THEN 1 ELSE 0 END,
                    total_memory_tokens = ?,
                    tokens_saved_by_trim = tokens_saved_by_trim + COALESCE(?, 0),
                    updated_at = CURRENT_TIMESTAMP
            `;

            // Note: SQLite doesn't support ON CONFLICT UPDATE well with multiple columns
            // We'll use a simpler approach - INSERT OR IGNORE + UPDATE
            db.run(`
                INSERT OR IGNORE INTO ai_memory_metrics (
                    id, organization_id, project_id, user_id,
                    period_type, period_start, period_end
                ) VALUES (?, ?, ?, ?, 'HOURLY', ?, ?)
            `, [id, organizationId, projectId, userId, hourStart.toISOString(), hourEnd.toISOString()], (err) => {
                if (err) {
                    console.error('[AIMemoryMetrics] Insert error:', err);
                    return resolve({ success: false });
                }

                // Now update the metrics
                const updateSql = `
                    UPDATE ai_memory_metrics SET
                        memory_reads = memory_reads + ?,
                        memory_writes = memory_writes + ?,
                        memory_trims = memory_trims + ?,
                        memory_cleanups = memory_cleanups + ?,
                        total_memory_tokens = COALESCE(?, total_memory_tokens),
                        tokens_saved_by_trim = tokens_saved_by_trim + COALESCE(?, 0),
                        avg_retrieval_time_ms = COALESCE(?, avg_retrieval_time_ms),
                        relevance_score_avg = CASE 
                            WHEN ? IS NOT NULL THEN (relevance_score_avg * relevance_hits + ?) / (relevance_hits + 1)
                            ELSE relevance_score_avg
                        END,
                        relevance_hits = relevance_hits + CASE WHEN ? > 0.5 THEN 1 ELSE 0 END,
                        relevance_misses = relevance_misses + CASE WHEN ? IS NOT NULL AND ? <= 0.5 THEN 1 ELSE 0 END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE organization_id = ? AND period_start = ?
                `;

                const isRead = operationType === 'READ' ? 1 : 0;
                const isWrite = ['WRITE', 'RECORD'].includes(operationType) ? 1 : 0;
                const isTrim = operationType === 'TRIM' ? 1 : 0;
                const isCleanup = operationType === 'CLEANUP' ? 1 : 0;

                db.run(updateSql, [
                    isRead, isWrite, isTrim, isCleanup,
                    metrics.totalTokens || null,
                    metrics.tokensSaved || 0,
                    metrics.retrievalTimeMs || null,
                    metrics.relevanceScore || null,
                    metrics.relevanceScore || null,
                    metrics.relevanceScore || 0,
                    metrics.relevanceScore || null,
                    metrics.relevanceScore || null,
                    organizationId,
                    hourStart.toISOString()
                ], (updateErr) => {
                    if (updateErr) {
                        console.error('[AIMemoryMetrics] Update error:', updateErr);
                    }
                    resolve({ success: !updateErr });
                });
            });
        });
    },

    /**
     * Get memory metrics for dashboard
     */
    getDashboardMetrics: async (organizationId, periodDays = 7) => {
        return new Promise((resolve, reject) => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - periodDays);

            // Get hourly metrics aggregated
            const sql = `
                SELECT 
                    DATE(period_start) as date,
                    SUM(memory_reads) as total_reads,
                    SUM(memory_writes) as total_writes,
                    SUM(memory_trims) as total_trims,
                    SUM(memory_cleanups) as total_cleanups,
                    MAX(total_memory_tokens) as peak_tokens,
                    AVG(total_memory_tokens) as avg_tokens,
                    SUM(tokens_saved_by_trim) as tokens_saved,
                    AVG(avg_retrieval_time_ms) as avg_latency,
                    AVG(relevance_score_avg) as avg_relevance
                FROM ai_memory_metrics
                WHERE organization_id = ? AND period_start >= ?
                GROUP BY DATE(period_start)
                ORDER BY date DESC
            `;

            db.all(sql, [organizationId, cutoffDate.toISOString()], (err, rows) => {
                if (err) {
                    console.error('[AIMemoryMetrics] Dashboard query error:', err);
                    return resolve({ daily: [], summary: {} });
                }

                // Calculate summary
                const summary = rows.reduce((acc, row) => {
                    acc.totalReads += row.total_reads || 0;
                    acc.totalWrites += row.total_writes || 0;
                    acc.totalTrims += row.total_trims || 0;
                    acc.totalTokensSaved += row.tokens_saved || 0;
                    acc.peakTokens = Math.max(acc.peakTokens, row.peak_tokens || 0);
                    return acc;
                }, {
                    totalReads: 0,
                    totalWrites: 0,
                    totalTrims: 0,
                    totalTokensSaved: 0,
                    peakTokens: 0
                });

                // Calculate averages
                if (rows.length > 0) {
                    summary.avgLatency = rows.reduce((sum, r) => sum + (r.avg_latency || 0), 0) / rows.length;
                    summary.avgRelevance = rows.reduce((sum, r) => sum + (r.avg_relevance || 0), 0) / rows.length;
                    summary.avgTokensPerDay = rows.reduce((sum, r) => sum + (r.avg_tokens || 0), 0) / rows.length;
                }

                // Estimate cost saved (assuming $0.00001 per token for GPT-4)
                summary.estimatedCostSaved = (summary.totalTokensSaved * 0.00001).toFixed(4);

                resolve({
                    daily: rows,
                    summary,
                    period: {
                        days: periodDays,
                        start: cutoffDate.toISOString(),
                        end: new Date().toISOString()
                    }
                });
            });
        });
    },

    /**
     * Get current memory state for a project
     */
    getCurrentMemoryState: async (projectId, organizationId) => {
        try {
            // Get project memory count
            const projectMemory = await AIMemoryManager.getProjectMemory(projectId);
            const memoryContent = projectMemory ? JSON.stringify(projectMemory) : '';
            const projectTokens = AIMemoryManager.estimateTokens(memoryContent);

            // Get org memory
            const orgMemory = await AIMemoryManager.getOrganizationMemory(organizationId);
            const orgContent = orgMemory ? JSON.stringify(orgMemory) : '';
            const orgTokens = AIMemoryManager.estimateTokens(orgContent);

            return {
                projectMemory: {
                    tokens: projectTokens,
                    itemCount: projectMemory?.memoryCount || 0,
                    majorDecisions: projectMemory?.majorDecisions?.length || 0,
                    phaseTransitions: projectMemory?.phaseTransitions?.length || 0,
                    recommendations: projectMemory?.aiRecommendations?.length || 0
                },
                organizationMemory: {
                    tokens: orgTokens,
                    patterns: orgMemory?.recurringPatterns?.length || 0,
                    style: orgMemory?.governanceStyle || 'standard'
                },
                totalTokens: projectTokens + orgTokens,
                efficiency: {
                    utilizationPercent: Math.min(100, ((projectTokens + orgTokens) / 50000) * 100).toFixed(1),
                    recommendedLimit: 50000
                }
            };
        } catch (err) {
            console.error('[AIMemoryMetrics] getCurrentMemoryState error:', err);
            return {
                projectMemory: { tokens: 0, itemCount: 0 },
                organizationMemory: { tokens: 0, patterns: 0 },
                totalTokens: 0,
                efficiency: { utilizationPercent: 0, recommendedLimit: 50000 }
            };
        }
    },

    /**
     * Get latency percentiles for memory operations
     */
    getLatencyPercentiles: async (organizationId, windowHours = 24) => {
        return new Promise((resolve) => {
            const cutoff = new Date();
            cutoff.setHours(cutoff.getHours() - windowHours);

            db.all(`
                SELECT avg_retrieval_time_ms as latency
                FROM ai_memory_metrics
                WHERE organization_id = ? AND period_start >= ? AND avg_retrieval_time_ms > 0
                ORDER BY avg_retrieval_time_ms ASC
            `, [organizationId, cutoff.toISOString()], (err, rows) => {
                if (err || !rows || rows.length === 0) {
                    return resolve({ p50: 0, p95: 0, p99: 0, count: 0 });
                }

                const latencies = rows.map(r => r.latency);
                const getPercentile = (arr, p) => {
                    const idx = Math.ceil(arr.length * p / 100) - 1;
                    return arr[Math.max(0, idx)] || 0;
                };

                resolve({
                    p50: getPercentile(latencies, 50),
                    p95: getPercentile(latencies, 95),
                    p99: getPercentile(latencies, 99),
                    count: latencies.length,
                    avg: latencies.reduce((a, b) => a + b, 0) / latencies.length
                });
            });
        });
    },

    /**
     * Aggregate daily metrics (called by cron job)
     */
    aggregateDailyMetrics: async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        return new Promise((resolve) => {
            db.all(`
                SELECT 
                    organization_id,
                    SUM(total_memory_tokens) as total_tokens,
                    MAX(total_memory_tokens) as peak_tokens,
                    AVG(total_memory_tokens) as avg_tokens,
                    SUM(memory_reads) as total_reads,
                    SUM(memory_writes) as total_writes,
                    SUM(memory_trims) as total_trims,
                    SUM(tokens_saved_by_trim) as tokens_saved,
                    SUM(estimated_cost_saved) as cost_saved,
                    AVG(avg_retrieval_time_ms) as avg_latency,
                    MAX(p95_retrieval_time_ms) as p95_latency
                FROM ai_memory_metrics
                WHERE DATE(period_start) = ?
                GROUP BY organization_id
            `, [dateStr], async (err, rows) => {
                if (err) {
                    console.error('[AIMemoryMetrics] Aggregation error:', err);
                    return resolve({ aggregated: 0 });
                }

                let aggregated = 0;
                for (const row of rows || []) {
                    await new Promise((res) => {
                        db.run(`
                            INSERT OR REPLACE INTO ai_memory_metrics_daily (
                                id, organization_id, date,
                                total_memory_tokens, peak_memory_tokens, avg_memory_tokens,
                                total_reads, total_writes, total_trims,
                                tokens_saved, cost_saved,
                                avg_latency_ms, p95_latency_ms
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            uuidv4(),
                            row.organization_id,
                            dateStr,
                            row.total_tokens || 0,
                            row.peak_tokens || 0,
                            Math.round(row.avg_tokens || 0),
                            row.total_reads || 0,
                            row.total_writes || 0,
                            row.total_trims || 0,
                            row.tokens_saved || 0,
                            row.cost_saved || 0,
                            Math.round(row.avg_latency || 0),
                            Math.round(row.p95_latency || 0)
                        ], () => {
                            aggregated++;
                            res();
                        });
                    });
                }

                console.log(`[AIMemoryMetrics] Aggregated ${aggregated} daily records for ${dateStr}`);
                resolve({ aggregated, date: dateStr });
            });
        });
    }
};

module.exports = AIMemoryMetricsService;


