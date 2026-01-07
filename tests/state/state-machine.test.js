/**
 * State Machine Tests
 * Tests for finite state machine implementation
 * 
 * @module tests/state/state-machine.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// State machine implementation
const createStateMachine = (config) => {
    let currentState = config.initial;
    const history = [currentState];
    const listeners = [];
    const guards = config.guards || {};
    const actions = config.actions || {};

    return {
        getState: () => currentState,
        getHistory: () => [...history],

        can: (event) => {
            const stateConfig = config.states[currentState];
            if (!stateConfig || !stateConfig.on) return false;

            const transition = stateConfig.on[event];
            if (!transition) return false;

            if (transition.guard) {
                const guardFn = guards[transition.guard];
                if (guardFn && !guardFn()) return false;
            }

            return true;
        },

        send: (event, payload) => {
            const stateConfig = config.states[currentState];
            if (!stateConfig || !stateConfig.on) {
                return { changed: false, state: currentState };
            }

            const transition = stateConfig.on[event];
            if (!transition) {
                return { changed: false, state: currentState };
            }

            // Check guard
            const target = typeof transition === 'string' ? transition : transition.target;
            if (typeof transition === 'object' && transition.guard) {
                const guardFn = guards[transition.guard];
                if (guardFn && !guardFn(payload)) {
                    return { changed: false, state: currentState };
                }
            }

            // Execute exit action
            if (stateConfig.exit) {
                const exitAction = actions[stateConfig.exit];
                if (exitAction) exitAction(payload);
            }

            // Execute transition action
            if (typeof transition === 'object' && transition.action) {
                const transitionAction = actions[transition.action];
                if (transitionAction) transitionAction(payload);
            }

            const previousState = currentState;
            currentState = target;
            history.push(currentState);

            // Execute entry action
            const newStateConfig = config.states[currentState];
            if (newStateConfig && newStateConfig.entry) {
                const entryAction = actions[newStateConfig.entry];
                if (entryAction) entryAction(payload);
            }

            // Notify listeners
            listeners.forEach(listener => {
                listener({
                    previousState,
                    currentState,
                    event,
                    payload,
                });
            });

            return { changed: true, state: currentState };
        },

        subscribe: (listener) => {
            listeners.push(listener);
            return () => {
                const index = listeners.indexOf(listener);
                if (index !== -1) listeners.splice(index, 1);
            };
        },

        matches: (state) => currentState === state,

        reset: () => {
            currentState = config.initial;
            history.length = 0;
            history.push(currentState);
        },
    };
};

describe('State Machine Tests', () => {
    let machine;

    beforeEach(() => {
        machine = createStateMachine({
            initial: 'idle',
            states: {
                idle: {
                    on: {
                        START: 'loading',
                        QUICK_START: { target: 'active', action: 'logQuickStart' },
                    },
                },
                loading: {
                    entry: 'onLoadingEntry',
                    exit: 'onLoadingExit',
                    on: {
                        SUCCESS: 'active',
                        FAILURE: 'error',
                        CANCEL: 'idle',
                    },
                },
                active: {
                    on: {
                        PAUSE: 'paused',
                        STOP: 'idle',
                        ERROR: 'error',
                    },
                },
                paused: {
                    on: {
                        RESUME: 'active',
                        STOP: 'idle',
                    },
                },
                error: {
                    on: {
                        RETRY: 'loading',
                        RESET: 'idle',
                    },
                },
            },
            actions: {
                onLoadingEntry: vi.fn(),
                onLoadingExit: vi.fn(),
                logQuickStart: vi.fn(),
            },
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // INITIAL STATE
    // ═══════════════════════════════════════════════════════════════════

    describe('Initial State', () => {
        it('should start in initial state', () => {
            expect(machine.getState()).toBe('idle');
        });

        it('should have initial state in history', () => {
            expect(machine.getHistory()).toEqual(['idle']);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TRANSITIONS
    // ═══════════════════════════════════════════════════════════════════

    describe('Transitions', () => {
        it('should transition on valid event', () => {
            const result = machine.send('START');

            expect(result.changed).toBe(true);
            expect(result.state).toBe('loading');
            expect(machine.getState()).toBe('loading');
        });

        it('should not transition on invalid event', () => {
            const result = machine.send('INVALID');

            expect(result.changed).toBe(false);
            expect(machine.getState()).toBe('idle');
        });

        it('should track history', () => {
            machine.send('START');
            machine.send('SUCCESS');
            machine.send('PAUSE');

            expect(machine.getHistory()).toEqual(['idle', 'loading', 'active', 'paused']);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CAN CHECK
    // ═══════════════════════════════════════════════════════════════════

    describe('Can Check', () => {
        it('should return true for valid transition', () => {
            expect(machine.can('START')).toBe(true);
        });

        it('should return false for invalid transition', () => {
            expect(machine.can('PAUSE')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MATCHES
    // ═══════════════════════════════════════════════════════════════════

    describe('Matches', () => {
        it('should match current state', () => {
            expect(machine.matches('idle')).toBe(true);
            expect(machine.matches('loading')).toBe(false);
        });

        it('should update after transition', () => {
            machine.send('START');
            expect(machine.matches('loading')).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SUBSCRIBE
    // ═══════════════════════════════════════════════════════════════════

    describe('Subscribe', () => {
        it('should notify on transition', () => {
            const listener = vi.fn();
            machine.subscribe(listener);

            machine.send('START');

            expect(listener).toHaveBeenCalledWith({
                previousState: 'idle',
                currentState: 'loading',
                event: 'START',
                payload: undefined,
            });
        });

        it('should pass payload', () => {
            const listener = vi.fn();
            machine.subscribe(listener);

            machine.send('START', { data: 'test' });

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({ payload: { data: 'test' } })
            );
        });

        it('should unsubscribe', () => {
            const listener = vi.fn();
            const unsubscribe = machine.subscribe(listener);

            unsubscribe();
            machine.send('START');

            expect(listener).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // RESET
    // ═══════════════════════════════════════════════════════════════════

    describe('Reset', () => {
        it('should reset to initial state', () => {
            machine.send('START');
            machine.send('SUCCESS');

            machine.reset();

            expect(machine.getState()).toBe('idle');
            expect(machine.getHistory()).toEqual(['idle']);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // COMPLEX FLOWS
    // ═══════════════════════════════════════════════════════════════════

    describe('Complex Flows', () => {
        it('should handle error flow', () => {
            machine.send('START');
            machine.send('FAILURE');

            expect(machine.getState()).toBe('error');

            machine.send('RETRY');
            expect(machine.getState()).toBe('loading');
        });

        it('should handle pause/resume flow', () => {
            machine.send('START');
            machine.send('SUCCESS');
            machine.send('PAUSE');

            expect(machine.getState()).toBe('paused');

            machine.send('RESUME');
            expect(machine.getState()).toBe('active');
        });

        it('should handle cancel flow', () => {
            machine.send('START');
            machine.send('CANCEL');

            expect(machine.getState()).toBe('idle');
        });
    });
});
