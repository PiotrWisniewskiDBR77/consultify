export default securityServiceInstance;
declare const securityServiceInstance: SecurityService;
declare class SecurityService {
    /**
     * Create a security event
     */
    createEvent(eventData: any): Promise<any>;
    /**
     * Get security events with filtering
     */
    getEvents(filters?: {}, pagination?: {
        page: number;
        pageSize: number;
    }): Promise<any>;
    /**
     * Get security event by ID
     */
    getEventById(id: any): Promise<any>;
    /**
     * Resolve a security event
     */
    resolveEvent(id: any, resolvedBy: any): Promise<any>;
    /**
     * Detect suspicious activity
     */
    detectSuspiciousActivity(userId: any, ipAddress: any, activity: any): Promise<{
        suspicious: boolean;
        reason: string;
    } | {
        suspicious: boolean;
        reason?: undefined;
    }>;
    /**
     * Get recent failed login attempts
     */
    getRecentFailedLogins(userId: any, ipAddress: any): Promise<any>;
    /**
     * Get security statistics
     */
    getStats(filters?: {}): Promise<any>;
}
//# sourceMappingURL=securityService.d.ts.map