declare namespace _default {
    export { DraftService };
    export { draftService };
    export { DRAFT_TYPES };
}
export default _default;
export class DraftService {
    /**
     * Ensure the ai_drafts table exists
     */
    ensureTable(): Promise<any>;
    /**
     * Create a new draft
     * @param {Object} draftData - Draft data
     */
    createDraft(draftData: Object): Promise<any>;
    /**
     * Get a draft by ID
     * @param {string} draftId - Draft ID
     */
    getDraft(draftId: string): Promise<any>;
    /**
     * Get pending drafts for a user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     */
    getPendingDrafts(userId: string, options?: Object): Promise<any>;
    /**
     * Get drafts for a specific entity
     * @param {string} entityType - Entity type
     * @param {string} entityId - Entity ID
     */
    getDraftsForEntity(entityType: string, entityId: string): Promise<any>;
    /**
     * Approve a draft
     * @param {string} draftId - Draft ID
     * @param {Object} approvalData - Approval data
     */
    approveDraft(draftId: string, approvalData: Object): Promise<any>;
    /**
     * Reject a draft
     * @param {string} draftId - Draft ID
     * @param {Object} rejectionData - Rejection data
     */
    rejectDraft(draftId: string, rejectionData: Object): Promise<any>;
    /**
     * Expire old drafts
     */
    expireOldDrafts(): Promise<any>;
    /**
     * Get draft statistics for a user
     * @param {string} userId - User ID
     */
    getDraftStats(userId: string, organizationId: any): Promise<any>;
    /**
     * Generate diff data between original and suggested content
     * @private
     */
    private _generateDiff;
    /**
     * Parse a draft row from database
     * @private
     */
    private _parseDraft;
    /**
     * Safely parse JSON
     * @private
     */
    private _parseJSON;
}
export const draftService: DraftService;
export namespace DRAFT_TYPES {
    namespace INITIATIVE {
        let expiryHours: number;
        let requiresApproval: boolean;
    }
    namespace REPORT_SECTION {
        let expiryHours_1: number;
        export { expiryHours_1 as expiryHours };
        let requiresApproval_1: boolean;
        export { requiresApproval_1 as requiresApproval };
    }
    namespace TASK_BREAKDOWN {
        let expiryHours_2: number;
        export { expiryHours_2 as expiryHours };
        let requiresApproval_2: boolean;
        export { requiresApproval_2 as requiresApproval };
    }
    namespace RECOMMENDATION {
        let expiryHours_3: number;
        export { expiryHours_3 as expiryHours };
        let requiresApproval_3: boolean;
        export { requiresApproval_3 as requiresApproval };
    }
    namespace RISK_ANALYSIS {
        let expiryHours_4: number;
        export { expiryHours_4 as expiryHours };
        let requiresApproval_4: boolean;
        export { requiresApproval_4 as requiresApproval };
    }
    namespace FIELD_SUGGESTION {
        let expiryHours_5: number;
        export { expiryHours_5 as expiryHours };
        let requiresApproval_5: boolean;
        export { requiresApproval_5 as requiresApproval };
    }
    namespace PATTERN {
        let expiryHours_6: number;
        export { expiryHours_6 as expiryHours };
        let requiresApproval_6: boolean;
        export { requiresApproval_6 as requiresApproval };
    }
    namespace SUMMARY {
        let expiryHours_7: number;
        export { expiryHours_7 as expiryHours };
        let requiresApproval_7: boolean;
        export { requiresApproval_7 as requiresApproval };
    }
}
//# sourceMappingURL=draftService.d.ts.map