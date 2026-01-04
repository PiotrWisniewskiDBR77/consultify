export default MyWorkService;
declare const MyWorkService: typeof BaseService & {
    /**
     * Get aggregated My Work view for a user
     * REFACTORED: Uses BaseService caching + Work Mode visibility filtering
     */
    getMyWork: (userId: any, organizationId: any) => any;
    /**
     * Get user's tasks with work mode visibility filtering
     * REFACTORED: Uses BaseService query helpers + WorkModeService visibility rules
     *
     * @param {string} userId - User ID
     * @param {string} organizationId - Organization ID for work mode rules
     * @param {Array} locationIds - Legacy location filter (optional)
     */
    _getMyTasks: (userId: string, organizationId?: string, locationIds?: any[]) => any;
    /**
     * Get initiatives owned by user
     * REFACTORED: Uses BaseService query helpers
     */
    _getMyInitiatives: (userId: any) => any;
    /**
     * Get decisions awaiting user
     * REFACTORED: Uses BaseService query helpers
     */
    _getMyDecisions: (userId: any) => any;
    /**
     * Get alerts for user
     * REFACTORED: Uses BaseService query helpers
     */
    _getMyAlerts: (userId: any) => any;
    /**
     * Check if user is initiative owner or PM
     * REFACTORED: Uses BaseService query helpers
     */
    _isInitiativeOwnerOrPM: (userId: any) => any;
    /**
     * Check if user is decision owner
     * REFACTORED: Uses BaseService query helpers
     */
    _isDecisionOwner: (userId: any) => any;
};
import BaseService from './BaseService.js';
//# sourceMappingURL=myWorkService.d.ts.map