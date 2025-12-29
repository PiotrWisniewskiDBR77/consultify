const os = require('os');
const db = require('../database');

class SystemHealthService {

    async getDetailedHealth() {
        const [dbStatus, errorRate] = await Promise.all([
            this.checkDb(),
            this.getErrorRate()
        ]);

        return {
            status: 'operational',
            timestamp: new Date().toISOString(),
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                loadAvg: os.loadavg(),
                cpus: os.cpus().length
            },
            database: dbStatus,
            application: {
                errorRateLastHour: errorRate,
                version: process.env.npm_package_version || '1.0.0'
            }
        };
    }

    async checkDb() {
        const start = Date.now();
        return new Promise(resolve => {
            db.get('SELECT 1', [], (err) => {
                const duration = Date.now() - start;
                resolve({
                    connected: !err,
                    latencyMs: duration
                });
            });
        });
    }

    async getErrorRate() {
        // Calculate error rate from recent API requests (last hour)
        // Query from audit_log or error_log table if available
        return new Promise((resolve) => {
            db.get(`
                SELECT 
                    COUNT(CASE WHEN status >= 400 THEN 1 END) as errors,
                    COUNT(*) as total
                FROM audit_logs
                WHERE created_at > datetime('now', '-1 hour')
            `, [], (err, row) => {
                if (err || !row || row.total === 0) {
                    // If no audit_logs table or no data, return 0
                    resolve(0);
                    return;
                }
                const errorRate = (row.errors / row.total) * 100;
                resolve(Math.round(errorRate * 100) / 100); // Round to 2 decimal places
            });
        });
    }
}

module.exports = new SystemHealthService();
