/**
 * CSS Transitions & Animations Tests
 * Tests for CSS transition utilities, animation timing, and keyframe management
 * 
 * @module tests/animation/cssTransitions.test.js
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// HELPER IMPLEMENTATIONS (inline mocks)
// ============================================

/**
 * Creates a mock animation controller for managing CSS animations
 */
const createAnimationController = () => {
    const animations = new Map();
    const listeners = new Map();

    return {
        register: (id, config) => {
            animations.set(id, {
                id,
                state: 'idle',
                progress: 0,
                duration: config.duration || 300,
                easing: config.easing || 'ease',
                delay: config.delay || 0,
                iterations: config.iterations || 1,
                direction: config.direction || 'normal',
                fillMode: config.fillMode || 'none',
                ...config
            });
            return animations.get(id);
        },

        play: (id) => {
            const anim = animations.get(id);
            if (!anim) throw new Error(`Animation ${id} not found`);
            anim.state = 'running';
            anim.startTime = Date.now();
            listeners.get(id)?.forEach(cb => cb({ type: 'start', animation: anim }));
            return anim;
        },

        pause: (id) => {
            const anim = animations.get(id);
            if (!anim) throw new Error(`Animation ${id} not found`);
            anim.state = 'paused';
            anim.pausedAt = Date.now();
            listeners.get(id)?.forEach(cb => cb({ type: 'pause', animation: anim }));
            return anim;
        },

        resume: (id) => {
            const anim = animations.get(id);
            if (!anim || anim.state !== 'paused') return null;
            anim.state = 'running';
            listeners.get(id)?.forEach(cb => cb({ type: 'resume', animation: anim }));
            return anim;
        },

        cancel: (id) => {
            const anim = animations.get(id);
            if (!anim) return false;
            anim.state = 'idle';
            anim.progress = 0;
            listeners.get(id)?.forEach(cb => cb({ type: 'cancel', animation: anim }));
            return true;
        },

        finish: (id) => {
            const anim = animations.get(id);
            if (!anim) return false;
            anim.state = 'finished';
            anim.progress = 1;
            listeners.get(id)?.forEach(cb => cb({ type: 'finish', animation: anim }));
            return true;
        },

        getState: (id) => animations.get(id)?.state || null,
        getProgress: (id) => animations.get(id)?.progress || 0,

        on: (id, callback) => {
            if (!listeners.has(id)) listeners.set(id, []);
            listeners.get(id).push(callback);
            return () => {
                const cbs = listeners.get(id);
                const idx = cbs?.indexOf(callback);
                if (idx > -1) cbs.splice(idx, 1);
            };
        },

        getAllAnimations: () => Array.from(animations.values()),
        clear: () => { animations.clear(); listeners.clear(); }
    };
};

/**
 * Creates a transition manager for CSS transitions
 */
const createTransitionManager = () => {
    const transitions = new Map();
    const queue = [];
    let isProcessing = false;

    return {
        add: (element, properties, options = {}) => {
            const id = `transition-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const transition = {
                id,
                element,
                properties,
                duration: options.duration || 300,
                easing: options.easing || 'ease',
                delay: options.delay || 0,
                state: 'pending'
            };
            transitions.set(id, transition);
            queue.push(id);
            return id;
        },

        start: async (id) => {
            const transition = transitions.get(id);
            if (!transition) return null;
            transition.state = 'running';
            transition.startTime = Date.now();
            return transition;
        },

        complete: (id) => {
            const transition = transitions.get(id);
            if (!transition) return false;
            transition.state = 'completed';
            transition.endTime = Date.now();
            return true;
        },

        processQueue: async () => {
            if (isProcessing) return;
            isProcessing = true;

            while (queue.length > 0) {
                const id = queue.shift();
                const transition = transitions.get(id);
                if (transition && transition.state === 'pending') {
                    transition.state = 'running';
                }
            }

            isProcessing = false;
        },

        getTransition: (id) => transitions.get(id),
        getPendingCount: () => queue.length,
        clear: () => { transitions.clear(); queue.length = 0; }
    };
};

/**
 * Easing function calculator
 */
const createEasingCalculator = () => {
    const easings = {
        linear: t => t,
        easeIn: t => t * t,
        easeOut: t => t * (2 - t),
        easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        easeInCubic: t => t * t * t,
        easeOutCubic: t => (--t) * t * t + 1,
        easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
        easeInQuart: t => t * t * t * t,
        easeOutQuart: t => 1 - (--t) * t * t * t,
        bounce: t => {
            if (t < 1 / 2.75) return 7.5625 * t * t;
            if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
            if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
            return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
        }
    };

    return {
        calculate: (name, progress) => {
            const fn = easings[name] || easings.linear;
            return fn(Math.max(0, Math.min(1, progress)));
        },
        register: (name, fn) => { easings[name] = fn; },
        getAvailable: () => Object.keys(easings)
    };
};

// ============================================
// TESTS
// ============================================

describe('CSS Transitions & Animations Tests', () => {
    let controller;
    let transitionManager;
    let easingCalc;

    beforeEach(() => {
        controller = createAnimationController();
        transitionManager = createTransitionManager();
        easingCalc = createEasingCalculator();
        vi.useFakeTimers();
    });

    afterEach(() => {
        controller.clear();
        transitionManager.clear();
        vi.useRealTimers();
    });

    describe('Animation Controller', () => {
        it('should register animation with default config', () => {
            const anim = controller.register('fade-in', {});

            expect(anim.id).toBe('fade-in');
            expect(anim.state).toBe('idle');
            expect(anim.duration).toBe(300);
            expect(anim.easing).toBe('ease');
        });

        it('should register animation with custom config', () => {
            const anim = controller.register('slide', {
                duration: 500,
                easing: 'ease-in-out',
                delay: 100,
                iterations: 2
            });

            expect(anim.duration).toBe(500);
            expect(anim.easing).toBe('ease-in-out');
            expect(anim.delay).toBe(100);
            expect(anim.iterations).toBe(2);
        });

        it('should play and track animation state', () => {
            controller.register('bounce', { duration: 400 });

            expect(controller.getState('bounce')).toBe('idle');

            controller.play('bounce');
            expect(controller.getState('bounce')).toBe('running');
        });

        it('should pause and resume animations', () => {
            controller.register('rotate', {});
            controller.play('rotate');

            controller.pause('rotate');
            expect(controller.getState('rotate')).toBe('paused');

            controller.resume('rotate');
            expect(controller.getState('rotate')).toBe('running');
        });

        it('should cancel animation and reset progress', () => {
            controller.register('scale', {});
            controller.play('scale');

            controller.cancel('scale');
            expect(controller.getState('scale')).toBe('idle');
            expect(controller.getProgress('scale')).toBe(0);
        });

        it('should finish animation and set progress to 1', () => {
            controller.register('opacity', {});
            controller.play('opacity');

            controller.finish('opacity');
            expect(controller.getState('opacity')).toBe('finished');
            expect(controller.getProgress('opacity')).toBe(1);
        });

        it('should emit events on state changes', () => {
            const callback = vi.fn();
            controller.register('pulse', {});
            controller.on('pulse', callback);

            controller.play('pulse');
            expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'start' }));

            controller.pause('pulse');
            expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'pause' }));

            controller.finish('pulse');
            expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'finish' }));
        });

        it('should unsubscribe from events', () => {
            const callback = vi.fn();
            controller.register('shake', {});
            const unsubscribe = controller.on('shake', callback);

            controller.play('shake');
            expect(callback).toHaveBeenCalledTimes(1);

            unsubscribe();
            controller.pause('shake');
            expect(callback).toHaveBeenCalledTimes(1); // Not called again
        });

        it('should get all registered animations', () => {
            controller.register('anim1', {});
            controller.register('anim2', {});
            controller.register('anim3', {});

            const all = controller.getAllAnimations();
            expect(all).toHaveLength(3);
            expect(all.map(a => a.id)).toEqual(['anim1', 'anim2', 'anim3']);
        });
    });

    describe('Transition Manager', () => {
        it('should add transition to queue', () => {
            const id = transitionManager.add('element', ['opacity', 'transform']);

            expect(id).toMatch(/^transition-/);
            expect(transitionManager.getPendingCount()).toBe(1);
        });

        it('should start transition and update state', async () => {
            const id = transitionManager.add('el', ['opacity'], { duration: 200 });
            const transition = await transitionManager.start(id);

            expect(transition.state).toBe('running');
            expect(transition.startTime).toBeDefined();
        });

        it('should complete transition', () => {
            const id = transitionManager.add('el', ['height']);
            transitionManager.start(id);

            const completed = transitionManager.complete(id);
            expect(completed).toBe(true);

            const t = transitionManager.getTransition(id);
            expect(t.state).toBe('completed');
        });

        it('should process queue of transitions', async () => {
            transitionManager.add('el1', ['opacity']);
            transitionManager.add('el2', ['transform']);
            transitionManager.add('el3', ['color']);

            expect(transitionManager.getPendingCount()).toBe(3);

            await transitionManager.processQueue();
            expect(transitionManager.getPendingCount()).toBe(0);
        });
    });

    describe('Easing Calculator', () => {
        it('should calculate linear easing', () => {
            expect(easingCalc.calculate('linear', 0)).toBe(0);
            expect(easingCalc.calculate('linear', 0.5)).toBe(0.5);
            expect(easingCalc.calculate('linear', 1)).toBe(1);
        });

        it('should calculate easeIn (starts slow)', () => {
            const mid = easingCalc.calculate('easeIn', 0.5);
            expect(mid).toBeLessThan(0.5); // Slower at start
        });

        it('should calculate easeOut (ends slow)', () => {
            const mid = easingCalc.calculate('easeOut', 0.5);
            expect(mid).toBeGreaterThan(0.5); // Faster at start
        });

        it('should calculate easeInOut (slow at both ends)', () => {
            const quarter = easingCalc.calculate('easeInOut', 0.25);
            const mid = easingCalc.calculate('easeInOut', 0.5);
            const threeQuarter = easingCalc.calculate('easeInOut', 0.75);

            expect(quarter).toBeLessThan(0.25);
            expect(mid).toBe(0.5);
            expect(threeQuarter).toBeGreaterThan(0.75);
        });

        it('should calculate bounce easing', () => {
            const result = easingCalc.calculate('bounce', 1);
            expect(result).toBeCloseTo(1, 2);
        });

        it('should clamp progress to 0-1 range', () => {
            expect(easingCalc.calculate('linear', -0.5)).toBe(0);
            expect(easingCalc.calculate('linear', 1.5)).toBe(1);
        });

        it('should register custom easing function', () => {
            easingCalc.register('custom', t => t * t * t);
            expect(easingCalc.calculate('custom', 0.5)).toBe(0.125);
        });

        it('should list available easings', () => {
            const available = easingCalc.getAvailable();
            expect(available).toContain('linear');
            expect(available).toContain('easeIn');
            expect(available).toContain('bounce');
        });
    });
});
