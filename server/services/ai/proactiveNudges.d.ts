declare namespace _default {
    export { ProactiveNudgesService };
    export { proactiveNudgesService };
    export { proactiveNudgesService as proactiveNudges };
    export { NUDGE_TRIGGERS };
}
export default _default;
export class ProactiveNudgesService {
    userStates: Map<any, any>;
    nudgeHistory: Map<any, any>;
    cooldownPeriod: number;
    /**
     * Track user activity
     */
    trackActivity(userId: any, activityType: any, metadata?: {}): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        nudgeId: any;
        userId: any;
        message: any;
        capability: any;
        metadata: any;
        priority: number;
        createdAt: number;
        expiresAt: number;
    }[]>;
    /**
     * Check if any nudges should be triggered
     */
    checkTriggers(userId: any, activityType: any, metadata: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        nudgeId: any;
        userId: any;
        message: any;
        capability: any;
        metadata: any;
        priority: number;
        createdAt: number;
        expiresAt: number;
    }[]>;
    /**
     * Check if nudge should be shown (respects cooldown)
     */
    shouldShowNudge(userId: any, nudgeId: any): Promise<boolean>;
    /**
     * Create nudge object
     */
    createNudge(trigger: any, userId: any, metadata: any): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        nudgeId: any;
        userId: any;
        message: any;
        capability: any;
        metadata: any;
        priority: number;
        createdAt: number;
        expiresAt: number;
    };
    /**
     * Calculate nudge priority
     */
    calculatePriority(trigger: any, metadata: any): number;
    /**
     * Mark nudge as shown
     */
    markNudgeShown(userId: any, nudgeId: any): Promise<void>;
    /**
     * Mark nudge as dismissed
     */
    dismissNudge(userId: any, nudgeId: any): Promise<void>;
    /**
     * Mark nudge as acted upon
     */
    nudgeActedUpon(userId: any, nudgeId: any, action: any): Promise<void>;
    /**
     * Alias for nudgeActedUpon for API compatibility
     */
    markNudgeActed(userId: any, nudgeId: any, action: any): Promise<void>;
    /**
     * Check and generate nudges based on context
     */
    checkAndGenerateNudges(userId: any, organizationId: any, context?: {}): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        nudgeId: any;
        userId: any;
        message: any;
        capability: any;
        metadata: any;
        priority: number;
        createdAt: number;
        expiresAt: number;
    }[]>;
    /**
     * Suppress a type of nudge for a user
     */
    suppressNudgeType(userId: any, nudgeType: any, duration?: string): Promise<void>;
    /**
     * Get pending nudges for user
     */
    getPendingNudges(userId: any, context?: {}): Promise<any[]>;
    /**
     * Get nudge analytics
     */
    getNudgeAnalytics(organizationId?: null): Promise<any>;
}
export const proactiveNudgesService: ProactiveNudgesService;
export namespace NUDGE_TRIGGERS {
    namespace ASSESSMENT_STARTED {
        let id: string;
        let delay: number;
        let message: string;
        let capability: string;
    }
    namespace ASSESSMENT_STALLED {
        let id_1: string;
        export { id_1 as id };
        let delay_1: number;
        export { delay_1 as delay };
        let message_1: string;
        export { message_1 as message };
        let capability_1: string;
        export { capability_1 as capability };
    }
    namespace REPORT_EMPTY {
        let id_2: string;
        export { id_2 as id };
        let delay_2: number;
        export { delay_2 as delay };
        let message_2: string;
        export { message_2 as message };
        let capability_2: string;
        export { capability_2 as capability };
    }
    namespace NO_INITIATIVES {
        let id_3: string;
        export { id_3 as id };
        let delay_3: number;
        export { delay_3 as delay };
        let message_3: string;
        export { message_3 as message };
        let capability_3: string;
        export { capability_3 as capability };
    }
    namespace TASK_OVERDUE {
        let id_4: string;
        export { id_4 as id };
        let delay_4: number;
        export { delay_4 as delay };
        let message_4: string;
        export { message_4 as message };
        let capability_4: string;
        export { capability_4 as capability };
    }
    namespace LOW_SCORE_DETECTED {
        let id_5: string;
        export { id_5 as id };
        let delay_5: number;
        export { delay_5 as delay };
        let message_5: string;
        export { message_5 as message };
        let capability_5: string;
        export { capability_5 as capability };
    }
    namespace FIRST_LOGIN {
        let id_6: string;
        export { id_6 as id };
        let delay_6: number;
        export { delay_6 as delay };
        let message_6: string;
        export { message_6 as message };
        let capability_6: string;
        export { capability_6 as capability };
    }
}
//# sourceMappingURL=proactiveNudges.d.ts.map