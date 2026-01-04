export default DemoSessionService;
declare namespace DemoSessionService {
    export { DEMO_STEPS };
    export { STEP_NARRATIVES };
    /**
     * Create a new demo session
     * @param {string} sessionId - Demo session ID (from JWT or org ID)
     * @returns {Object} - Session object
     */
    export function createSession(sessionId: string): Object;
    /**
     * Get existing session or create new one
     * @param {string} sessionId
     * @returns {Object}
     */
    export function getOrCreateSession(sessionId: string): Object;
    /**
     * Get session by ID
     * @param {string} sessionId
     * @returns {Object|null}
     */
    export function getSession(sessionId: string): Object | null;
    /**
     * Update session step
     * @param {string} sessionId
     * @param {string} stepKey - One of: reality, focus, decision, execution, feedback
     * @returns {Object} - Updated session with narrative trigger
     */
    export function updateStep(sessionId: string, stepKey: string): Object;
    /**
     * Get narrative for current step
     * @param {string} sessionId
     * @param {string} narrativeType - intro, insight, or limitation
     * @returns {Object}
     */
    export function getNarrative(sessionId: string, narrativeType?: string): Object;
    /**
     * Record an interaction event (for metrics)
     * @param {string} sessionId
     * @param {string} eventType
     * @param {Object} metadata
     */
    export function recordEvent(sessionId: string, eventType: string, metadata?: Object): {
        constructor: Function;
        toString(): string;
        toLocaleString(): string;
        valueOf(): Object;
        hasOwnProperty(v: PropertyKey): boolean;
        isPrototypeOf(v: Object): boolean;
        propertyIsEnumerable(v: PropertyKey): boolean;
        sessionId: string;
        eventType: string;
        step: any;
        timestamp: number;
    } | null;
    /**
     * Get session progress summary
     * @param {string} sessionId
     * @returns {Object}
     */
    export function getProgress(sessionId: string): Object;
    /**
     * End demo session
     * @param {string} sessionId
     * @returns {Object} - Session summary for metrics
     */
    export function endSession(sessionId: string): Object;
    /**
     * Cleanup expired sessions (> 30 min inactive)
     * @returns {number} - Number of cleaned sessions
     */
    export function cleanupExpired(): number;
    /**
     * Get all active sessions count (for metrics)
     * @returns {number}
     */
    export function getActiveSessionCount(): number;
}
declare namespace DEMO_STEPS {
    namespace REALITY {
        let id: number;
        let key: string;
        let title: string;
        let path: string;
    }
    namespace FOCUS {
        let id_1: number;
        export { id_1 as id };
        let key_1: string;
        export { key_1 as key };
        let title_1: string;
        export { title_1 as title };
        let path_1: string;
        export { path_1 as path };
    }
    namespace DECISION {
        let id_2: number;
        export { id_2 as id };
        let key_2: string;
        export { key_2 as key };
        let title_2: string;
        export { title_2 as title };
        let path_2: string;
        export { path_2 as path };
    }
    namespace EXECUTION {
        let id_3: number;
        export { id_3 as id };
        let key_3: string;
        export { key_3 as key };
        let title_3: string;
        export { title_3 as title };
        let path_3: string;
        export { path_3 as path };
    }
    namespace FEEDBACK {
        let id_4: number;
        export { id_4 as id };
        let key_4: string;
        export { key_4 as key };
        let title_4: string;
        export { title_4 as title };
        let path_4: string;
        export { path_4 as path };
    }
}
declare namespace STEP_NARRATIVES {
    namespace reality {
        let intro: string;
        let insight: string;
        let limitation: string;
    }
    namespace focus {
        let intro_1: string;
        export { intro_1 as intro };
        let insight_1: string;
        export { insight_1 as insight };
        let limitation_1: string;
        export { limitation_1 as limitation };
    }
    namespace decision {
        let intro_2: string;
        export { intro_2 as intro };
        let insight_2: string;
        export { insight_2 as insight };
        let limitation_2: string;
        export { limitation_2 as limitation };
    }
    namespace execution {
        let intro_3: string;
        export { intro_3 as intro };
        let insight_3: string;
        export { insight_3 as insight };
        let limitation_3: string;
        export { limitation_3 as limitation };
    }
    namespace feedback {
        let intro_4: string;
        export { intro_4 as intro };
        let insight_4: string;
        export { insight_4 as insight };
        let limitation_4: string;
        export { limitation_4 as limitation };
    }
}
//# sourceMappingURL=demoSessionService.d.ts.map