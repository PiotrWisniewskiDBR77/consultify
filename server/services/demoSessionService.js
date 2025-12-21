/**
 * Demo Session Service
 * 
 * Manages demo session state (in-memory, no persistence).
 * Tracks user progress through the 5-step narrative flow.
 * Triggers AI narrative events on step transitions.
 */

const DEMO_STEPS = {
    REALITY: { id: 1, key: 'reality', title: 'Reality', path: '/demo/reality' },
    FOCUS: { id: 2, key: 'focus', title: 'Focus', path: '/demo/focus' },
    DECISION: { id: 3, key: 'decision', title: 'Decision', path: '/demo/decision' },
    EXECUTION: { id: 4, key: 'execution', title: 'Execution', path: '/demo/execution' },
    FEEDBACK: { id: 5, key: 'feedback', title: 'Feedback', path: '/demo/feedback' }
};

// In-memory session store (cleared on restart)
const sessions = new Map();

// Step narratives (AI will use these as context)
const STEP_NARRATIVES = {
    reality: {
        intro: 'Zanim podejmiesz jakąkolwiek decyzję, musisz zobaczyć rzeczywistość taką, jaka jest. To jest diagnoza — DRD.',
        insight: 'AI analizuje dane, ale NIE podejmuje decyzji za Ciebie. Pokazuje wzorce, których sam możesz nie dostrzec.',
        limitation: 'W Demo widzisz przykładowe dane. Twoja firma będzie miała własny obraz.'
    },
    focus: {
        intro: 'Strategia to sztuka trade-offów. Co zdecydujesz się NIE robić?',
        insight: 'Osie priorytetów pomagają zrozumieć, gdzie koncentrować energię. Nie wszystko jest jednakowo ważne.',
        limitation: 'Te osie są demonstracyjne. W Trial będziesz mógł zdefiniować własne.'
    },
    decision: {
        intro: 'To są decyzje zarządcze, nie lista zadań. Inicjatywy to zobowiązania strategiczne.',
        insight: 'Każda inicjatywa ma swojego właściciela i mierzalne kryteria sukcesu.',
        limitation: 'W Demo nie możesz tworzyć inicjatyw. To wymaga Twojego kontekstu biznesowego.'
    },
    execution: {
        intro: 'Dyscyplina ponad automatyzację. Własność ponad przypisanie.',
        insight: 'System śledzi postęp, ale odpowiedzialność pozostaje po stronie ludzi.',
        limitation: 'Taski są tylko do odczytu. Prawdziwa praca zaczyna się w Trial.'
    },
    feedback: {
        intro: 'System pamięta. Każdy cykl uczy. To jest learning loop.',
        insight: 'Metryki i postęp budują obraz transformacji w czasie.',
        limitation: 'To jest koniec Demo. Jeśli chcesz zrobić to dla swojej firmy — zacznij Trial.'
    }
};

const DemoSessionService = {
    DEMO_STEPS,
    STEP_NARRATIVES,

    /**
     * Create a new demo session
     * @param {string} sessionId - Demo session ID (from JWT or org ID)
     * @returns {Object} - Session object
     */
    createSession(sessionId) {
        const session = {
            id: sessionId,
            currentStep: 'reality',
            stepHistory: [],
            startedAt: Date.now(),
            lastActivityAt: Date.now(),
            interactions: 0,
            narrativesSeen: [],
            completed: false
        };
        sessions.set(sessionId, session);
        return session;
    },

    /**
     * Get existing session or create new one
     * @param {string} sessionId 
     * @returns {Object}
     */
    getOrCreateSession(sessionId) {
        if (!sessions.has(sessionId)) {
            return this.createSession(sessionId);
        }
        return sessions.get(sessionId);
    },

    /**
     * Get session by ID
     * @param {string} sessionId 
     * @returns {Object|null}
     */
    getSession(sessionId) {
        return sessions.get(sessionId) || null;
    },

    /**
     * Update session step
     * @param {string} sessionId 
     * @param {string} stepKey - One of: reality, focus, decision, execution, feedback
     * @returns {Object} - Updated session with narrative trigger
     */
    updateStep(sessionId, stepKey) {
        const session = this.getOrCreateSession(sessionId);
        const previousStep = session.currentStep;

        // Record step history
        if (previousStep !== stepKey) {
            session.stepHistory.push({
                from: previousStep,
                to: stepKey,
                at: Date.now()
            });
        }

        session.currentStep = stepKey;
        session.lastActivityAt = Date.now();
        session.interactions++;

        // Check if completed (reached feedback step)
        if (stepKey === 'feedback') {
            session.completed = true;
        }

        sessions.set(sessionId, session);

        return {
            session,
            previousStep,
            narrativeTrigger: previousStep !== stepKey ? 'step_transition' : null
        };
    },

    /**
     * Get narrative for current step
     * @param {string} sessionId 
     * @param {string} narrativeType - intro, insight, or limitation
     * @returns {Object}
     */
    getNarrative(sessionId, narrativeType = 'intro') {
        const session = this.getSession(sessionId);
        if (!session) {
            return { error: 'Session not found' };
        }

        const stepKey = session.currentStep;
        const narratives = STEP_NARRATIVES[stepKey];

        if (!narratives) {
            return { error: 'Invalid step' };
        }

        // Track which narratives have been seen
        const narrativeId = `${stepKey}_${narrativeType}`;
        if (!session.narrativesSeen.includes(narrativeId)) {
            session.narrativesSeen.push(narrativeId);
            sessions.set(sessionId, session);
        }

        return {
            step: stepKey,
            type: narrativeType,
            message: narratives[narrativeType],
            isNew: !session.narrativesSeen.includes(narrativeId)
        };
    },

    /**
     * Record an interaction event (for metrics)
     * @param {string} sessionId 
     * @param {string} eventType 
     * @param {Object} metadata 
     */
    recordEvent(sessionId, eventType, metadata = {}) {
        const session = this.getSession(sessionId);
        if (!session) return null;

        session.interactions++;
        session.lastActivityAt = Date.now();
        sessions.set(sessionId, session);

        return {
            sessionId,
            eventType,
            step: session.currentStep,
            timestamp: Date.now(),
            ...metadata
        };
    },

    /**
     * Get session progress summary
     * @param {string} sessionId 
     * @returns {Object}
     */
    getProgress(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return null;

        const stepOrder = ['reality', 'focus', 'decision', 'execution', 'feedback'];
        const currentIndex = stepOrder.indexOf(session.currentStep);

        return {
            currentStep: session.currentStep,
            currentStepNumber: currentIndex + 1,
            totalSteps: 5,
            percentComplete: Math.round(((currentIndex + 1) / 5) * 100),
            timeSpent: Date.now() - session.startedAt,
            interactions: session.interactions,
            completed: session.completed,
            canConvert: session.completed // CTA only after full flow
        };
    },

    /**
     * End demo session
     * @param {string} sessionId 
     * @returns {Object} - Session summary for metrics
     */
    endSession(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return null;

        const summary = {
            id: sessionId,
            totalTime: Date.now() - session.startedAt,
            stepsVisited: session.stepHistory.length + 1,
            interactions: session.interactions,
            completed: session.completed,
            dropoutStep: session.completed ? null : session.currentStep,
            endedAt: Date.now()
        };

        // Remove from memory
        sessions.delete(sessionId);

        return summary;
    },

    /**
     * Cleanup expired sessions (> 30 min inactive)
     * @returns {number} - Number of cleaned sessions
     */
    cleanupExpired() {
        const expiryTime = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();
        let cleaned = 0;

        for (const [id, session] of sessions) {
            if (now - session.lastActivityAt > expiryTime) {
                sessions.delete(id);
                cleaned++;
            }
        }

        return cleaned;
    },

    /**
     * Get all active sessions count (for metrics)
     * @returns {number}
     */
    getActiveSessionCount() {
        return sessions.size;
    }
};

module.exports = DemoSessionService;
