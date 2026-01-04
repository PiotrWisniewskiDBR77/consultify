export default FacilityUserService;
declare namespace FacilityUserService {
    export { ASSIGNMENT_TYPES };
    export { FACILITY_ROLES };
    /**
     * Assign user to a facility
     *
     * @param {string} userId - User ID
     * @param {string} facilityId - Facility ID
     * @param {Object} options - Assignment options
     * @param {string} options.role - Role within facility (manager, lead, member, viewer)
     * @param {string} options.assignmentType - Type of assignment (primary, secondary, temporary)
     * @param {boolean} options.canViewAllTasks - Can view all tasks in facility
     * @param {boolean} options.canManageUsers - Can manage facility users
     * @param {boolean} options.canEditFacility - Can edit facility details
     * @param {Date} options.validUntil - Expiration date for temporary assignments
     * @param {string} options.notes - Assignment notes
     * @param {string} options.assignedBy - ID of user making the assignment
     * @returns {Promise<Object>} Created assignment
     */
    export function assignUserToFacility(userId: string, facilityId: string, options?: {
        role: string;
        assignmentType: string;
        canViewAllTasks: boolean;
        canManageUsers: boolean;
        canEditFacility: boolean;
        validUntil: Date;
        notes: string;
        assignedBy: string;
    }): Promise<Object>;
    /**
     * Remove user from facility
     *
     * @param {string} userId - User ID
     * @param {string} facilityId - Facility ID
     * @param {string} removedBy - ID of user removing the assignment
     * @returns {Promise<boolean>} Success
     */
    export function removeUserFromFacility(userId: string, facilityId: string, removedBy?: string): Promise<boolean>;
    /**
     * Get a specific assignment
     *
     * @param {string} facilityId - Facility ID
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} Assignment details
     */
    export function getAssignment(facilityId: string, userId: string): Promise<Object | null>;
    /**
     * Get all users in a facility
     *
     * @param {string} facilityId - Facility ID
     * @param {Object} options - Filter options
     * @param {string} options.role - Filter by role
     * @param {string} options.assignmentType - Filter by assignment type
     * @returns {Promise<Array>} List of user assignments
     */
    export function getFacilityUsers(facilityId: string, options?: {
        role: string;
        assignmentType: string;
    }): Promise<any[]>;
    /**
     * Get all facilities for a user
     *
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID (optional filter)
     * @returns {Promise<Array>} List of facility assignments
     */
    export function getUserFacilities(userId: string, orgId?: string): Promise<any[]>;
    /**
     * Get user's primary facility
     *
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} Primary facility assignment
     */
    export function getUserPrimaryFacility(userId: string): Promise<Object | null>;
    /**
     * Update user's role in a facility
     *
     * @param {string} userId - User ID
     * @param {string} facilityId - Facility ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated assignment
     */
    export function updateAssignment(userId: string, facilityId: string, updates: Object): Promise<Object>;
    /**
     * Get facility assignment statistics
     *
     * @param {string} facilityId - Facility ID
     * @returns {Promise<Object>} Statistics
     */
    export function getFacilityStats(facilityId: string): Promise<Object>;
    /**
     * Bulk assign users to facility
     *
     * @param {string} facilityId - Facility ID
     * @param {Array<Object>} assignments - List of {userId, role, assignmentType}
     * @param {string} assignedBy - ID of user making assignments
     * @returns {Promise<Array>} Created assignments
     */
    export function bulkAssignUsers(facilityId: string, assignments: Array<Object>, assignedBy: string): Promise<any[]>;
    /**
     * Format assignment from DB row
     * @private
     */
    export function _formatAssignment(row: any): {
        facilityId: any;
        facilityName: any;
        facilityCode: any;
        userId: any;
        userName: string | null;
        userEmail: any;
        userRole: any;
        userAvatar: any;
        role: any;
        assignmentType: any;
        permissions: {
            canViewAllTasks: boolean;
            canManageUsers: boolean;
            canEditFacility: boolean;
        };
        assignedAt: any;
        assignedBy: any;
        validUntil: any;
        notes: any;
    };
    /**
     * Log assignment event
     * @private
     */
    export function _logAssignmentEvent(orgId: any, eventType: any, metadata: any): Promise<void>;
}
declare namespace ASSIGNMENT_TYPES {
    let PRIMARY: string;
    let SECONDARY: string;
    let TEMPORARY: string;
}
declare namespace FACILITY_ROLES {
    let MANAGER: string;
    let LEAD: string;
    let MEMBER: string;
    let VIEWER: string;
}
//# sourceMappingURL=facilityUserService.d.ts.map