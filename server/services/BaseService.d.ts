export default BaseService;
declare class BaseService {
    _db: any;
    _cache: any;
    _queryHelpers: any;
    /**
     * Initialize dependencies lazily
     */
    init(): Promise<this>;
    /**
     * Set dependencies manually (useful for testing)
     */
    setDependencies(deps?: {}): void;
    /**
     * Execute SELECT query returning multiple rows
     */
    queryAll(sql: any, params?: any[], options?: {}): Promise<any>;
    /**
     * Execute SELECT query returning single row
     */
    queryOne(sql: any, params?: any[], options?: {}): Promise<any>;
    /**
     * Execute INSERT/UPDATE/DELETE query
     */
    queryRun(sql: any, params?: any[]): Promise<any>;
    /**
     * Log info message
     */
    logInfo(message: any, meta?: {}): void;
    /**
     * Log error message
     */
    logError(message: any, error?: {}): void;
}
//# sourceMappingURL=BaseService.d.ts.map