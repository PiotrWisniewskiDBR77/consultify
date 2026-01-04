declare namespace _default {
    export { FrameworkRBACService };
    export { FRAMEWORK_ROLES };
    export { ACTION_PERMISSIONS };
}
export default _default;
export class FrameworkRBACService {
    /**
     * Check if user has permission for action on framework
     * @param {string} userId - User ID
     * @param {string} framework - Framework (SIRI, ADMA, CMMI, LEAN)
     * @param {string} action - Action to perform
     * @param {Object} context - Additional context (organizationId, projectId)
     * @returns {Promise<boolean>} Has permission
     */
    static hasPermission(userId: string, framework: string, action: string, context?: Object): Promise<boolean>;
    /**
     * Get user's framework roles
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Role IDs
     */
    static getUserRoles(userId: string): Promise<any[]>;
    /**
     * Assign framework role to user
     * @param {string} userId - User ID
     * @param {string} roleId - Role ID
     * @param {string} assignedBy - Assigning user ID
     * @returns {Promise<void>}
     */
    static assignRole(userId: string, roleId: string, assignedBy: string): Promise<void>;
    /**
     * Remove framework role from user
     * @param {string} userId - User ID
     * @param {string} roleId - Role ID
     * @returns {Promise<void>}
     */
    static removeRole(userId: string, roleId: string): Promise<void>;
    /**
     * Get available roles for a framework
     * @param {string} framework - Framework ID
     * @returns {Array} Available roles
     */
    static getFrameworkRoles(framework: string): any[];
    /**
     * Get all framework roles
     * @returns {Object} All roles
     */
    static getAllRoles(): Object;
    /**
     * Check if user can approve framework assessment
     * @param {string} userId - User ID
     * @param {string} framework - Framework
     * @returns {Promise<boolean>}
     */
    static canApprove(userId: string, framework: string): Promise<boolean>;
    /**
     * Check if user can certify framework assessment (for official certifications)
     * @param {string} userId - User ID
     * @param {string} framework - Framework
     * @returns {Promise<boolean>}
     */
    static canCertify(userId: string, framework: string): Promise<boolean>;
    /**
     * Get users who can approve a specific framework
     * @param {string} framework - Framework
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Array>} Users with approval rights
     */
    static getApprovers(framework: string, organizationId: string): Promise<any[]>;
    /**
     * Validate workflow transition based on user role
     * @param {string} userId - User ID
     * @param {string} framework - Framework
     * @param {string} fromStatus - Current status
     * @param {string} toStatus - Target status
     * @returns {Promise<{allowed: boolean, reason: string}>}
     */
    static validateWorkflowTransition(userId: string, framework: string, fromStatus: string, toStatus: string): Promise<{
        allowed: boolean;
        reason: string;
    }>;
}
export namespace FRAMEWORK_ROLES {
    namespace SIRI_ASSESSOR {
        let id: string;
        let name: string;
        let description: string;
        let framework: string;
        let permissions: string[];
    }
    namespace SIRI_REVIEWER {
        let id_1: string;
        export { id_1 as id };
        let name_1: string;
        export { name_1 as name };
        let description_1: string;
        export { description_1 as description };
        let framework_1: string;
        export { framework_1 as framework };
        let permissions_1: string[];
        export { permissions_1 as permissions };
    }
    namespace SIRI_CERTIFIED {
        let id_2: string;
        export { id_2 as id };
        let name_2: string;
        export { name_2 as name };
        let description_2: string;
        export { description_2 as description };
        let framework_2: string;
        export { framework_2 as framework };
        let permissions_2: string[];
        export { permissions_2 as permissions };
    }
    namespace ADMA_ASSESSOR {
        let id_3: string;
        export { id_3 as id };
        let name_3: string;
        export { name_3 as name };
        let description_3: string;
        export { description_3 as description };
        let framework_3: string;
        export { framework_3 as framework };
        let permissions_3: string[];
        export { permissions_3 as permissions };
    }
    namespace ADMA_REVIEWER {
        let id_4: string;
        export { id_4 as id };
        let name_4: string;
        export { name_4 as name };
        let description_4: string;
        export { description_4 as description };
        let framework_4: string;
        export { framework_4 as framework };
        let permissions_4: string[];
        export { permissions_4 as permissions };
    }
    namespace ADMA_DIH_CERTIFIED {
        let id_5: string;
        export { id_5 as id };
        let name_5: string;
        export { name_5 as name };
        let description_5: string;
        export { description_5 as description };
        let framework_5: string;
        export { framework_5 as framework };
        let permissions_5: string[];
        export { permissions_5 as permissions };
    }
    namespace CMMI_ASSESSOR {
        let id_6: string;
        export { id_6 as id };
        let name_6: string;
        export { name_6 as name };
        let description_6: string;
        export { description_6 as description };
        let framework_6: string;
        export { framework_6 as framework };
        let permissions_6: string[];
        export { permissions_6 as permissions };
    }
    namespace CMMI_REVIEWER {
        let id_7: string;
        export { id_7 as id };
        let name_7: string;
        export { name_7 as name };
        let description_7: string;
        export { description_7 as description };
        let framework_7: string;
        export { framework_7 as framework };
        let permissions_7: string[];
        export { permissions_7 as permissions };
    }
    namespace CMMI_LEAD_APPRAISER {
        let id_8: string;
        export { id_8 as id };
        let name_8: string;
        export { name_8 as name };
        let description_8: string;
        export { description_8 as description };
        let framework_8: string;
        export { framework_8 as framework };
        let permissions_8: string[];
        export { permissions_8 as permissions };
    }
    namespace LEAN_CONSULTANT {
        let id_9: string;
        export { id_9 as id };
        let name_9: string;
        export { name_9 as name };
        let description_9: string;
        export { description_9 as description };
        let framework_9: string;
        export { framework_9 as framework };
        let permissions_9: string[];
        export { permissions_9 as permissions };
    }
    namespace LEAN_REVIEWER {
        let id_10: string;
        export { id_10 as id };
        let name_10: string;
        export { name_10 as name };
        let description_10: string;
        export { description_10 as description };
        let framework_10: string;
        export { framework_10 as framework };
        let permissions_10: string[];
        export { permissions_10 as permissions };
    }
    namespace LEAN_MASTER {
        let id_11: string;
        export { id_11 as id };
        let name_11: string;
        export { name_11 as name };
        let description_11: string;
        export { description_11 as description };
        let framework_11: string;
        export { framework_11 as framework };
        let permissions_11: string[];
        export { permissions_11 as permissions };
    }
    namespace MULTI_FRAMEWORK_ADMIN {
        let id_12: string;
        export { id_12 as id };
        let name_12: string;
        export { name_12 as name };
        let description_12: string;
        export { description_12 as description };
        let framework_12: string;
        export { framework_12 as framework };
        let permissions_12: string[];
        export { permissions_12 as permissions };
    }
}
export namespace ACTION_PERMISSIONS {
    export let create: string[];
    export let edit: string[];
    export let view: string[];
    let _delete: string[];
    export { _delete as delete };
    export let submit: string[];
    export let review: string[];
    export let approve: string[];
    export let reject: string[];
    export let certify: string[];
    let _export: string[];
    export { _export as export };
    export let generate_report: string[];
    export let generate_initiatives: string[];
}
//# sourceMappingURL=frameworkRBACService.d.ts.map