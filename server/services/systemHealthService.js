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
        // Mock error rate calculation from logs or Sentry stub
        // In real app, query Sentry API or parse logs
        return 0.05; // 0.05% dummy value
    }
}

module.exports = new SystemHealthService();
