import os from 'os';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();



class SystemHealthService {

    async getDetailedHealth() {
        const [dbStatus, errorRate, aiServicesStatus] = await Promise.all([
            this.checkDb(),
            this.getErrorRate(),
            this.checkAIServices()
        ]);

        const memoryUsage = process.memoryUsage();
        const memoryTotal = os.totalmem();
        const memoryUsed = memoryUsage.heapUsed;
        const memoryPercent = (memoryUsed / memoryTotal) * 100;

        return {
            status: 'operational',
            timestamp: new Date().toISOString(),
            api: {
                status: 'healthy',
                responseTime: 0,
                version: process.env.npm_package_version || '2.5.0'
            },
            database: {
                status: dbStatus.connected ? 'healthy' : 'error',
                responseTime: dbStatus.latencyMs,
                type: 'SQLite'
            },
            ai: aiServicesStatus,
            system: {
                nodeVersion: process.version,
                environment: process.env.NODE_ENV || 'development',
                uptime: {
                    seconds: Math.floor(process.uptime()),
                    formatted: this.formatUptime(process.uptime())
                },
                memory: {
                    used: Math.round(memoryUsed / 1024 / 1024), // MB
                    total: Math.round(memoryTotal / 1024 / 1024), // MB
                    percent: Math.round(memoryPercent * 100) / 100
                },
                loadAvg: os.loadavg(),
                cpus: os.cpus().length
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

    async checkAIServices() {
        // Check if AI provider keys are configured
        return new Promise((resolve) => {
            db.all(
                `SELECT provider, api_key FROM llm_providers WHERE is_active = 1`,
                [],
                (err, rows) => {
                    if (err) {
                        return resolve({
                            status: 'unknown',
                            providers: { openai: false, anthropic: false, groq: false }
                        });
                    }

                    const providers = {
                        openai: false,
                        anthropic: false,
                        groq: false
                    };

                    rows.forEach(row => {
                        if (row.provider === 'openai' && row.api_key) providers.openai = true;
                        if (row.provider === 'anthropic' && row.api_key) providers.anthropic = true;
                        if (row.provider === 'groq' && row.api_key) providers.groq = true;
                    });

                    const hasAnyProvider = Object.values(providers).some(v => v);

                    resolve({
                        status: hasAnyProvider ? 'online' : 'no_keys',
                        providers
                    });
                }
            );
        });
    }

    async getErrorRate() {
        // Calculate error rate from recent API requests (last hour)
        return new Promise((resolve) => {
            db.get(`
                SELECT 
                    COUNT(CASE WHEN risk_level IN ('HIGH', 'CRITICAL') THEN 1 END) as errors,
                    COUNT(*) as total
                FROM audit_logs
                WHERE timestamp > datetime('now', '-1 hour')
            `, [], (err, row) => {
                if (err || !row || row.total === 0) {
                    resolve(0);
                    return;
                }
                const errorRate = (row.errors / row.total) * 100;
                resolve(Math.round(errorRate * 100) / 100);
            });
        });
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    /**
     * Get system metrics
     */
    async getMetrics() {
        const [dbMetrics, apiMetrics, aiMetrics] = await Promise.all([
            this.getDatabaseMetrics(),
            this.getAPIMetrics(),
            this.getAIMetrics()
        ]);

        return {
            database: dbMetrics,
            api: apiMetrics,
            ai: aiMetrics,
            timestamp: new Date().toISOString()
        };
    }

    async getDatabaseMetrics() {
        return new Promise((resolve) => {
            db.get(`
                SELECT 
                    COUNT(*) as total_queries,
                    AVG(CASE WHEN timestamp > datetime('now', '-1 hour') THEN 1 ELSE 0 END) as queries_last_hour
                FROM audit_logs
            `, [], (err, row) => {
                if (err) {
                    return resolve({ total_queries: 0, queries_last_hour: 0 });
                }
                resolve({
                    total_queries: row.total_queries || 0,
                    queries_last_hour: row.queries_last_hour || 0
                });
            });
        });
    }

    async getAPIMetrics() {
        return new Promise((resolve) => {
            db.get(`
                SELECT 
                    COUNT(*) as total_requests,
                    COUNT(CASE WHEN timestamp > datetime('now', '-1 hour') THEN 1 END) as requests_last_hour
                FROM audit_logs
                WHERE action_type LIKE 'api_%'
            `, [], (err, row) => {
                if (err) {
                    return resolve({ total_requests: 0, requests_last_hour: 0 });
                }
                resolve({
                    total_requests: row.total_requests || 0,
                    requests_last_hour: row.requests_last_hour || 0
                });
            });
        });
    }

    async getAIMetrics() {
        return new Promise((resolve) => {
            db.get(`
                SELECT 
                    COUNT(*) as total_requests,
                    SUM(input_tokens) as total_input_tokens,
                    SUM(output_tokens) as total_output_tokens,
                    AVG(latency_ms) as avg_latency
                FROM ai_logs
                WHERE created_at > datetime('now', '-24 hours')
            `, [], (err, row) => {
                if (err) {
                    return resolve({
                        total_requests: 0,
                        total_input_tokens: 0,
                        total_output_tokens: 0,
                        avg_latency: 0
                    });
                }
                resolve({
                    total_requests: row.total_requests || 0,
                    total_input_tokens: row.total_input_tokens || 0,
                    total_output_tokens: row.total_output_tokens || 0,
                    avg_latency: Math.round(row.avg_latency || 0)
                });
            });
        });
    }

    /**
     * Get service status
     */
    async getServiceStatus() {
        const [dbStatus, aiStatus] = await Promise.all([
            this.checkDb(),
            this.checkAIServices()
        ]);

        return {
            api: { status: 'up', responseTime: 0 },
            database: {
                status: dbStatus.connected ? 'up' : 'down',
                latency: dbStatus.latencyMs
            },
            ai: {
                status: aiStatus.status === 'online' ? 'up' : 'down',
                providers: aiStatus.providers
            },
            storage: { status: 'up' }
        };
    }
}

const systemHealthServiceInstance = new SystemHealthService();
export default systemHealthServiceInstance;
