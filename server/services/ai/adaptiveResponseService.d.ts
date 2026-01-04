declare namespace _default {
    export { AdaptiveResponseService };
    export { adaptiveResponseService };
    export { RESPONSE_LENGTH_TOKENS };
    export { INTENT_SIGNALS };
}
export default _default;
export class AdaptiveResponseService {
    userPreferencesCache: Map<any, any>;
    feedbackBuffer: any[];
    /**
     * Determine the response mode based on user preferences and message intent
     *
     * @param {string} userId - User ID
     * @param {string} userMessage - The user's message
     * @param {Object} preferences - User's AI preferences
     * @returns {Object} Response mode configuration
     */
    determineResponseMode(userId: string, userMessage: string, preferences?: Object): Object;
    /**
     * Detect intent from user message
     */
    detectIntent(message: any): {
        mode: null;
        confidence: number;
        signals?: undefined;
    } | {
        mode: string;
        confidence: number;
        signals: string[];
    } | {
        mode: string;
        confidence: number;
        signals?: undefined;
    };
    /**
     * Get learned preference based on past feedback
     */
    getLearnedPreference(userId: any, message: any): Promise<any>;
    /**
     * Get length setting for a mode from preferences
     */
    getLengthSetting(mode: any, preferences: any): any;
    /**
     * Build the response mode prompt modifier
     */
    buildResponseModePrompt(modeConfig: any, preferences?: {}): any;
    /**
     * Process user feedback and learn from it
     */
    processFeedback(userId: any, messageId: any, conversationId: any, feedback: any, context?: {}): Promise<any>;
    /**
     * Trigger learning adjustments based on accumulated feedback
     */
    triggerLearningAdjustments(userId: any, latestFeedback: any): Promise<any>;
    /**
     * Adjust user's length preference
     */
    adjustLengthPreference(userId: any, direction: any): Promise<any>;
    /**
     * Update user's default mode preference
     */
    updateUserModePreference(userId: any, mode: any): Promise<any>;
    /**
     * Get user's feedback statistics
     */
    getUserFeedbackStats(userId: any): Promise<any>;
    /**
     * Get recommended mode based on historical data
     */
    getRecommendedMode(userId: any): Promise<any>;
}
export const adaptiveResponseService: AdaptiveResponseService;
export namespace RESPONSE_LENGTH_TOKENS {
    namespace quick {
        namespace ultra_short {
            let min: number;
            let max: number;
            let target: number;
        }
        namespace short {
            let min_1: number;
            export { min_1 as min };
            let max_1: number;
            export { max_1 as max };
            let target_1: number;
            export { target_1 as target };
        }
        namespace medium {
            let min_2: number;
            export { min_2 as min };
            let max_2: number;
            export { max_2 as max };
            let target_2: number;
            export { target_2 as target };
        }
    }
    namespace standard {
        export namespace short_1 {
            let min_3: number;
            export { min_3 as min };
            let max_3: number;
            export { max_3 as max };
            let target_3: number;
            export { target_3 as target };
        }
        export { short_1 as short };
        export namespace medium_1 {
            let min_4: number;
            export { min_4 as min };
            let max_4: number;
            export { max_4 as max };
            let target_4: number;
            export { target_4 as target };
        }
        export { medium_1 as medium };
        export namespace long {
            let min_5: number;
            export { min_5 as min };
            let max_5: number;
            export { max_5 as max };
            let target_5: number;
            export { target_5 as target };
        }
    }
    namespace deepStudy {
        export namespace medium_2 {
            let min_6: number;
            export { min_6 as min };
            let max_6: number;
            export { max_6 as max };
            let target_6: number;
            export { target_6 as target };
        }
        export { medium_2 as medium };
        export namespace long_1 {
            let min_7: number;
            export { min_7 as min };
            let max_7: number;
            export { max_7 as max };
            let target_7: number;
            export { target_7 as target };
        }
        export { long_1 as long };
        export namespace comprehensive {
            let min_8: number;
            export { min_8 as min };
            let max_8: number;
            export { max_8 as max };
            let target_8: number;
            export { target_8 as target };
        }
    }
}
export namespace INTENT_SIGNALS {
    export namespace quick_1 {
        let en: string[];
        let pl: string[];
    }
    export { quick_1 as quick };
    export namespace deepStudy_1 {
        let en_1: string[];
        export { en_1 as en };
        let pl_1: string[];
        export { pl_1 as pl };
    }
    export { deepStudy_1 as deepStudy };
}
//# sourceMappingURL=adaptiveResponseService.d.ts.map