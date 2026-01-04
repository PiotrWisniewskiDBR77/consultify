export default service;
declare const service: ActivityService;
/**
 * Activity Logging Service
 * Logs user actions for audit trail and SuperAdmin dashboard
 */
declare class ActivityService extends BaseService {
    _requestStore: any;
    _siemService: any;
    /**
     * Initialize dependencies
     */
    init(): Promise<this>;
    /**
     * Set dependencies for testing
     */
    setDependencies(newDeps: any): void;
    /**
     * Log an activity
     */
    log(params: any): Promise<void>;
    /**
     * Get recent activities for SuperAdmin dashboard
     */
    getRecent(limit?: number): Promise<any>;
    /**
     * Get activities by organization
     */
    getByOrganization(organizationId: any, limit?: number): Promise<any>;
    /**
     * Get activity stats
     */
    getStats(): Promise<any>;
}
import BaseService from './BaseService.js';
//# sourceMappingURL=activityService.d.ts.map