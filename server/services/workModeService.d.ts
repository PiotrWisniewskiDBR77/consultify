export default WorkModeService;
declare namespace WorkModeService {
    export { WORK_MODES };
    export { WORK_MODE_INFO };
    /**
     * Get organization work mode configuration
     *
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object>} Work mode configuration
     */
    export function getWorkMode(orgId: string): Promise<Object>;
    /**
     * Set organization work mode
     *
     * @param {string} orgId - Organization ID
     * @param {string} mode - Work mode (SIMPLE, LOCATION_BASED, PROJECT_BASED, FULL)
     * @param {Object} options - Additional options
     * @param {string} options.projectLabel - Custom label for projects
     * @param {string} options.locationLabel - Custom label for locations
     * @param {string} options.teamLabel - Custom label for teams
     * @returns {Promise<Object>} Updated configuration
     */
    export function setWorkMode(orgId: string, mode: string, options?: {
        projectLabel: string;
        locationLabel: string;
        teamLabel: string;
    }): Promise<Object>;
    /**
     * Get all available work modes
     *
     * @returns {Array<Object>} List of work modes with info
     */
    export function getAllWorkModes(): Array<Object>;
    /**
     * Get effective capabilities for a user in an organization
     *
     * Aggregates capabilities from:
     * 1. Organization role (ADMIN, etc.)
     * 2. Facility assignments (if location-based)
     * 3. Project PMO roles (if project-based)
     *
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @param {Object} context - Optional context (projectId, facilityId)
     * @returns {Promise<Object>} Effective capabilities
     */
    export function getEffectiveCapabilities(userId: string, orgId: string, context?: Object): Promise<Object>;
    /**
     * Check if user has a specific capability
     *
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @param {string} capability - Capability code to check
     * @param {Object} context - Optional context (projectId, facilityId)
     * @returns {Promise<boolean>} Has capability
     */
    export function hasCapability(userId: string, orgId: string, capability: string, context?: Object): Promise<boolean>;
    /**
     * Get task visibility rules for a user
     *
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object>} Visibility rules
     */
    export function getTaskVisibilityRules(userId: string, orgId: string): Promise<Object>;
    /**
     * Get base role capabilities
     * @private
     */
    export function _getBaseRoleCapabilities(role: any): any;
    /**
     * Get facility role capabilities
     * @private
     */
    export function _getFacilityRoleCapabilities(assignment: any): string[];
    /**
     * Log work mode change
     * @private
     */
    export function _logWorkModeChange(orgId: any, newMode: any, options: any): Promise<void>;
}
declare namespace WORK_MODES {
    let SIMPLE: string;
    let LOCATION_BASED: string;
    let PROJECT_BASED: string;
    let FULL: string;
}
/**
 * Work Mode Descriptions
 */
declare const WORK_MODE_INFO: {
    [WORK_MODES.SIMPLE]: {
        name: string;
        namePl: string;
        description: string;
        descriptionPl: string;
        hasLocations: boolean;
        hasProjects: boolean;
    };
    [WORK_MODES.LOCATION_BASED]: {
        name: string;
        namePl: string;
        description: string;
        descriptionPl: string;
        hasLocations: boolean;
        hasProjects: boolean;
    };
    [WORK_MODES.PROJECT_BASED]: {
        name: string;
        namePl: string;
        description: string;
        descriptionPl: string;
        hasLocations: boolean;
        hasProjects: boolean;
    };
    [WORK_MODES.FULL]: {
        name: string;
        namePl: string;
        description: string;
        descriptionPl: string;
        hasLocations: boolean;
        hasProjects: boolean;
    };
};
//# sourceMappingURL=workModeService.d.ts.map