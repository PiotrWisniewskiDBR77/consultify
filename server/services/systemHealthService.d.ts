export default systemHealthServiceInstance;
declare const systemHealthServiceInstance: SystemHealthService;
declare class SystemHealthService {
    getDetailedHealth(): Promise<{
        status: string;
        timestamp: string;
        api: {
            status: string;
            responseTime: number;
            version: string;
        };
        database: {
            status: string;
            responseTime: any;
            type: string;
        };
        ai: any;
        system: {
            nodeVersion: string;
            environment: string;
            uptime: {
                seconds: number;
                formatted: string;
            };
            memory: {
                used: number;
                total: number;
                percent: number;
            };
            loadAvg: number[];
            cpus: number;
        };
    }>;
    checkDb(): Promise<any>;
    checkAIServices(): Promise<any>;
    getErrorRate(): Promise<any>;
    formatUptime(seconds: any): string;
    /**
     * Get system metrics
     */
    getMetrics(): Promise<{
        database: any;
        api: any;
        ai: any;
        timestamp: string;
    }>;
    getDatabaseMetrics(): Promise<any>;
    getAPIMetrics(): Promise<any>;
    getAIMetrics(): Promise<any>;
    /**
     * Get service status
     */
    getServiceStatus(): Promise<{
        api: {
            status: string;
            responseTime: number;
        };
        database: {
            status: string;
            latency: any;
        };
        ai: {
            status: string;
            providers: any;
        };
        storage: {
            status: string;
        };
    }>;
}
//# sourceMappingURL=systemHealthService.d.ts.map