/**
 * DemoSessionService Tests
 * 
 * Tests for demo session state management.
 */

const { describe, it, expect, beforeEach } = require('vitest');
const DemoSessionService = require('../../../server/services/demoSessionService');

describe('DemoSessionService', () => {
    const testSessionId = 'test-session-123';

    beforeEach(() => {
        // Clear sessions before each test
        const session = DemoSessionService.getSession(testSessionId);
        if (session) {
            // Reset session
            DemoSessionService.createSession(testSessionId);
        }
    });

    describe('createSession', () => {
        it('should create new session', () => {
            const session = DemoSessionService.createSession(testSessionId);

            expect(session).toBeDefined();
            expect(session.id).toBe(testSessionId);
            expect(session.currentStep).toBe('reality');
            expect(session.stepHistory).toEqual([]);
            expect(session.completed).toBe(false);
        });

        it('should initialize session with correct defaults', () => {
            const session = DemoSessionService.createSession(testSessionId);

            expect(session.interactions).toBe(0);
            expect(session.narrativesSeen).toEqual([]);
            expect(session.startedAt).toBeDefined();
            expect(session.lastActivityAt).toBeDefined();
        });
    });

    describe('getOrCreateSession', () => {
        it('should return existing session', () => {
            const session1 = DemoSessionService.createSession(testSessionId);
            const session2 = DemoSessionService.getOrCreateSession(testSessionId);

            expect(session2.id).toBe(session1.id);
            expect(session2.startedAt).toBe(session1.startedAt);
        });

        it('should create new session if not exists', () => {
            const session = DemoSessionService.getOrCreateSession('new-session-id');

            expect(session).toBeDefined();
            expect(session.id).toBe('new-session-id');
        });
    });

    describe('getSession', () => {
        it('should return session by ID', () => {
            DemoSessionService.createSession(testSessionId);
            const session = DemoSessionService.getSession(testSessionId);

            expect(session).toBeDefined();
            expect(session.id).toBe(testSessionId);
        });

        it('should return null for non-existent session', () => {
            const session = DemoSessionService.getSession('non-existent');

            expect(session).toBeNull();
        });
    });

    describe('updateStep', () => {
        it('should update session step', () => {
            DemoSessionService.createSession(testSessionId);
            const result = DemoSessionService.updateStep(testSessionId, 'focus');

            expect(result.currentStep).toBe('focus');
            expect(result.stepHistory).toContain('reality');
        });

        it('should track step history', () => {
            DemoSessionService.createSession(testSessionId);
            DemoSessionService.updateStep(testSessionId, 'focus');
            DemoSessionService.updateStep(testSessionId, 'decision');

            const session = DemoSessionService.getSession(testSessionId);
            expect(session.stepHistory).toEqual(['reality', 'focus']);
        });

        it('should update lastActivityAt', () => {
            DemoSessionService.createSession(testSessionId);
            const sessionBefore = DemoSessionService.getSession(testSessionId);
            const beforeTime = sessionBefore.lastActivityAt;

            // Wait a bit
            setTimeout(() => {
                DemoSessionService.updateStep(testSessionId, 'focus');
                const sessionAfter = DemoSessionService.getSession(testSessionId);
                expect(sessionAfter.lastActivityAt).toBeGreaterThan(beforeTime);
            }, 10);
        });

        it('should return narrative for step', () => {
            DemoSessionService.createSession(testSessionId);
            const result = DemoSessionService.updateStep(testSessionId, 'focus');

            expect(result.narrative).toBeDefined();
            expect(result.narrative.intro).toBeDefined();
        });
    });

    describe('recordInteraction', () => {
        it('should increment interaction count', () => {
            DemoSessionService.createSession(testSessionId);
            DemoSessionService.recordInteraction(testSessionId);

            const session = DemoSessionService.getSession(testSessionId);
            expect(session.interactions).toBe(1);
        });

        it('should update lastActivityAt', () => {
            DemoSessionService.createSession(testSessionId);
            const sessionBefore = DemoSessionService.getSession(testSessionId);
            const beforeTime = sessionBefore.lastActivityAt;

            setTimeout(() => {
                DemoSessionService.recordInteraction(testSessionId);
                const sessionAfter = DemoSessionService.getSession(testSessionId);
                expect(sessionAfter.lastActivityAt).toBeGreaterThan(beforeTime);
            }, 10);
        });
    });

    describe('markNarrativeSeen', () => {
        it('should track seen narratives', () => {
            DemoSessionService.createSession(testSessionId);
            DemoSessionService.markNarrativeSeen(testSessionId, 'reality_intro');

            const session = DemoSessionService.getSession(testSessionId);
            expect(session.narrativesSeen).toContain('reality_intro');
        });

        it('should not duplicate narrative IDs', () => {
            DemoSessionService.createSession(testSessionId);
            DemoSessionService.markNarrativeSeen(testSessionId, 'reality_intro');
            DemoSessionService.markNarrativeSeen(testSessionId, 'reality_intro');

            const session = DemoSessionService.getSession(testSessionId);
            const count = session.narrativesSeen.filter(id => id === 'reality_intro').length;
            expect(count).toBe(1);
        });
    });

    describe('completeSession', () => {
        it('should mark session as completed', () => {
            DemoSessionService.createSession(testSessionId);
            DemoSessionService.completeSession(testSessionId);

            const session = DemoSessionService.getSession(testSessionId);
            expect(session.completed).toBe(true);
        });
    });

    describe('DEMO_STEPS', () => {
        it('should have all required steps', () => {
            expect(DemoSessionService.DEMO_STEPS.REALITY).toBeDefined();
            expect(DemoSessionService.DEMO_STEPS.FOCUS).toBeDefined();
            expect(DemoSessionService.DEMO_STEPS.DECISION).toBeDefined();
            expect(DemoSessionService.DEMO_STEPS.EXECUTION).toBeDefined();
            expect(DemoSessionService.DEMO_STEPS.FEEDBACK).toBeDefined();
        });

        it('should have correct step structure', () => {
            const step = DemoSessionService.DEMO_STEPS.REALITY;

            expect(step).toHaveProperty('id');
            expect(step).toHaveProperty('key');
            expect(step).toHaveProperty('title');
            expect(step).toHaveProperty('path');
        });
    });

    describe('STEP_NARRATIVES', () => {
        it('should have narratives for all steps', () => {
            expect(DemoSessionService.STEP_NARRATIVES.reality).toBeDefined();
            expect(DemoSessionService.STEP_NARRATIVES.focus).toBeDefined();
            expect(DemoSessionService.STEP_NARRATIVES.decision).toBeDefined();
            expect(DemoSessionService.STEP_NARRATIVES.execution).toBeDefined();
            expect(DemoSessionService.STEP_NARRATIVES.feedback).toBeDefined();
        });

        it('should have correct narrative structure', () => {
            const narrative = DemoSessionService.STEP_NARRATIVES.reality;

            expect(narrative).toHaveProperty('intro');
            expect(narrative).toHaveProperty('insight');
            expect(narrative).toHaveProperty('limitation');
        });
    });
});

