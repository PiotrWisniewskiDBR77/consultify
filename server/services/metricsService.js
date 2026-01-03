/**
 * Metrics Service
 * 
 * Collects and aggregates system metrics.
 * Features:
 * - Metric collection (gauge, counter, histogram)
 * - Time-series data storage
 * - Metric aggregation
 * - Querying and analytics
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');

class MetricsService {
    /**
     * Record a metric
     */
    async recordMetric(metricData) {
        const {
            metric_name,
            metric_value,
            metric_type = 'gauge',
            tags = {}
        } = metricData;

        const id = uuidv4();
        const timestamp = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO system_metrics (
                    id, metric_name, metric_value, metric_type, tags, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    id, metric_name, metric_value, metric_type,
                    JSON.stringify(tags), timestamp
                ],
                function (err) {
                    if (err) {
                        console.error('[Metrics] Error recording metric:', err);
                        return reject(err);
                    }
                    resolve({ id, timestamp });
                }
            );
        });
    }

    /**
     * Get metrics with filtering
     */
    async getMetrics(filters = {}, limit = 1000) {
        const {
            metric_name,
            metric_type,
            startDate,
            endDate,
            tags
        } = filters;

        let query = 'SELECT * FROM system_metrics WHERE 1=1';
        const params = [];

        if (metric_name) {
            query += ' AND metric_name = ?';
            params.push(metric_name);
        }

        if (metric_type) {
            query += ' AND metric_type = ?';
            params.push(metric_type);
        }

        if (startDate) {
            query += ' AND timestamp >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND timestamp <= ?';
            params.push(endDate);
        }

        if (tags && Object.keys(tags).length > 0) {
            // Filter by tags (simple JSON contains check)
            const tagFilters = Object.entries(tags).map(([key, value]) => {
                params.push(`%"${key}":"${value}"%`);
                return 'tags LIKE ?';
            });
            query += ` AND (${tagFilters.join(' AND ')})`;
        }

        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Metrics] Error fetching metrics:', err);
                    return reject(err);
                }

                const metrics = rows.map(row => ({
                    ...row,
                    tags: row.tags ? JSON.parse(row.tags) : {}
                }));

                resolve(metrics);
            });
        });
    }

    /**
     * Get aggregated metrics
     */
    async getAggregatedMetrics(metricName, aggregation = 'avg', timeRange = '1h') {
        const timeRanges = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-24 hours')",
            '7d': "datetime('now', '-7 days')",
            '30d': "datetime('now', '-30 days')"
        };

        const timeFilter = timeRanges[timeRange] || timeRanges['1h'];

        const aggregationFunctions = {
            avg: 'AVG(metric_value)',
            sum: 'SUM(metric_value)',
            min: 'MIN(metric_value)',
            max: 'MAX(metric_value)',
            count: 'COUNT(*)'
        };

        const aggFunc = aggregationFunctions[aggregation] || aggregationFunctions.avg;

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    ${aggFunc} as value,
                    COUNT(*) as count,
                    MIN(timestamp) as first_seen,
                    MAX(timestamp) as last_seen
                 FROM system_metrics
                 WHERE metric_name = ?
                 AND timestamp >= ${timeFilter}`,
                [metricName],
                (err, row) => {
                    if (err) {
                        console.error('[Metrics] Error aggregating metrics:', err);
                        return reject(err);
                    }
                    resolve(row || { value: 0, count: 0 });
                }
            );
        });
    }

    /**
     * Get metric statistics
     */
    async getMetricStats(metricName, timeRange = '24h') {
        const timeRanges = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-24 hours')",
            '7d': "datetime('now', '-7 days')",
            '30d': "datetime('now', '-30 days')"
        };

        const timeFilter = timeRanges[timeRange] || timeRanges['24h'];

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    COUNT(*) as count,
                    AVG(metric_value) as avg,
                    MIN(metric_value) as min,
                    MAX(metric_value) as max,
                    SUM(metric_value) as sum
                 FROM system_metrics
                 WHERE metric_name = ?
                 AND timestamp >= ${timeFilter}`,
                [metricName],
                (err, row) => {
                    if (err) {
                        console.error('[Metrics] Error getting stats:', err);
                        return reject(err);
                    }
                    resolve(row || {
                        count: 0, avg: 0, min: 0, max: 0, sum: 0
                    });
                }
            );
        });
    }

    /**
     * Cleanup old metrics (retention policy)
     */
    async cleanupOldMetrics(retentionDays = 90) {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM system_metrics 
                 WHERE timestamp < datetime('now', '-${retentionDays} days')`,
                [],
                function (err) {
                    if (err) {
                        console.error('[Metrics] Error cleaning up metrics:', err);
                        return reject(err);
                    }
                    resolve({ deleted: this.changes });
                }
            );
        });
    }
}

module.exports = new MetricsService();




