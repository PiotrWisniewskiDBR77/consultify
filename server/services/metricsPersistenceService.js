const db = require('../database');

const performanceMetrics = require('../middleware/performanceMetrics');

/**
 * Service to manage long-term persistence of performance metrics
 */
const MetricsPersistenceService = {

    /**
     * Takes a snapshot of current in-memory metrics and saves to DB.
     * Optionally resets the in-memory counters after saving.
     */
    async saveSnapshot(reset = true, dbInstance = db) {
        try {
            // Get current in-memory metrics (last 60 mins window by default)
            const summary = performanceMetrics.getMetricsSummary(60);
            const memory = performanceMetrics.getMemoryMetrics();

            const snapshot = {
                timestamp: new Date().toISOString(),
                window_minutes: 60,

                // Request Stats
                total_requests: summary.totalRequests,
                avg_response_time: summary.avgResponseTime,
                error_rate: summary.errorRate,
                slow_requests_count: summary.slowRequests,

                // System Stats
                memory_heap_used_mb: memory.heapUsed,
                memory_rss_mb: memory.rss,

                // DB Stats
                avg_db_query_time: summary.avgDbQueryTime,
                db_query_count: summary.avgDbQueryCount // Note: summary provides avg per request
            };

            await new Promise((resolve, reject) => {
                const query = `
                    INSERT INTO metrics_snapshots (
                        timestamp, window_minutes, 
                        total_requests, avg_response_time, error_rate, slow_requests_count,
                        memory_heap_used_mb, memory_rss_mb,
                        avg_db_query_time, db_query_count
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                const params = [
                    snapshot.timestamp, snapshot.window_minutes,
                    snapshot.total_requests, snapshot.avg_response_time, snapshot.error_rate, snapshot.slow_requests_count,
                    snapshot.memory_heap_used_mb, snapshot.memory_rss_mb,
                    snapshot.avg_db_query_time, snapshot.db_query_count
                ];

                dbInstance.run(query, params, function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });

            console.log('[MetricsPersistence] Snapshot saved successfully.');

            if (reset && typeof performanceMetrics.resetMetrics === 'function') {
                performanceMetrics.resetMetrics();
            }

            return true;
        } catch (error) {
            console.error('[MetricsPersistence] Failed to save snapshot:', error);
            return false;
        }
    },

    /**
     * Retrieves historical metrics for charting
     * @param {number} days - Number of days to look back
     */
    async getHistory(days = 7, dbInstance = db) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM metrics_snapshots 
                WHERE timestamp > datetime('now', ?) 
                ORDER BY timestamp ASC
            `;

            dbInstance.all(query, [`-${days} days`], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

module.exports = MetricsPersistenceService;
