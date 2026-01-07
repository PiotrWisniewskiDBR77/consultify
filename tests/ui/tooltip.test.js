/**
 * Tooltip Tests
 * Tests for tooltip positioning and management
 * 
 * @module tests/ui/tooltip.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Tooltip manager implementation
const createTooltipManager = () => {
    const tooltips = new Map();
    const activeTooltip = { current: null };
    let defaultDelay = 200;
    let defaultDuration = 0;

    return {
        register: (id, config) => {
            tooltips.set(id, {
                id,
                content: config.content,
                position: config.position || 'top',
                delay: config.delay ?? defaultDelay,
                duration: config.duration ?? defaultDuration,
                trigger: config.trigger || 'hover',
                offset: config.offset || 8,
            });
        },

        unregister: (id) => {
            tooltips.delete(id);
        },

        show: (id) => {
            const tooltip = tooltips.get(id);
            if (!tooltip) return null;

            activeTooltip.current = { ...tooltip, visible: true, shownAt: Date.now() };
            return activeTooltip.current;
        },

        hide: () => {
            const was = activeTooltip.current;
            activeTooltip.current = null;
            return was;
        },

        getActive: () => activeTooltip.current,

        isVisible: (id) => activeTooltip.current?.id === id,

        getConfig: (id) => tooltips.get(id),

        setDefaults: (options) => {
            if (options.delay !== undefined) defaultDelay = options.delay;
            if (options.duration !== undefined) defaultDuration = options.duration;
        },

        getRegistered: () => [...tooltips.keys()],
    };
};

// Tooltip position calculator
const createPositionCalculator = () => {
    return {
        calculate: (targetRect, tooltipRect, position, offset = 8) => {
            const positions = {
                top: {
                    x: targetRect.left + (targetRect.width - tooltipRect.width) / 2,
                    y: targetRect.top - tooltipRect.height - offset,
                    arrow: 'bottom',
                },
                bottom: {
                    x: targetRect.left + (targetRect.width - tooltipRect.width) / 2,
                    y: targetRect.bottom + offset,
                    arrow: 'top',
                },
                left: {
                    x: targetRect.left - tooltipRect.width - offset,
                    y: targetRect.top + (targetRect.height - tooltipRect.height) / 2,
                    arrow: 'right',
                },
                right: {
                    x: targetRect.right + offset,
                    y: targetRect.top + (targetRect.height - tooltipRect.height) / 2,
                    arrow: 'left',
                },
                'top-start': {
                    x: targetRect.left,
                    y: targetRect.top - tooltipRect.height - offset,
                    arrow: 'bottom-start',
                },
                'top-end': {
                    x: targetRect.right - tooltipRect.width,
                    y: targetRect.top - tooltipRect.height - offset,
                    arrow: 'bottom-end',
                },
                'bottom-start': {
                    x: targetRect.left,
                    y: targetRect.bottom + offset,
                    arrow: 'top-start',
                },
                'bottom-end': {
                    x: targetRect.right - tooltipRect.width,
                    y: targetRect.bottom + offset,
                    arrow: 'top-end',
                },
            };

            return positions[position] || positions.top;
        },

        adjustForViewport: (position, viewportWidth, viewportHeight, tooltipRect) => {
            const adjusted = { ...position };

            // Horizontal bounds
            if (adjusted.x < 0) adjusted.x = 0;
            if (adjusted.x + tooltipRect.width > viewportWidth) {
                adjusted.x = viewportWidth - tooltipRect.width;
            }

            // Vertical bounds
            if (adjusted.y < 0) adjusted.y = 0;
            if (adjusted.y + tooltipRect.height > viewportHeight) {
                adjusted.y = viewportHeight - tooltipRect.height;
            }

            return adjusted;
        },

        getBestPosition: (targetRect, tooltipRect, viewportWidth, viewportHeight, offset = 8) => {
            const positions = ['top', 'bottom', 'left', 'right'];

            for (const pos of positions) {
                const calculated = this.calculate(targetRect, tooltipRect, pos, offset);

                const fitsHorizontally = calculated.x >= 0 &&
                    calculated.x + tooltipRect.width <= viewportWidth;
                const fitsVertically = calculated.y >= 0 &&
                    calculated.y + tooltipRect.height <= viewportHeight;

                if (fitsHorizontally && fitsVertically) {
                    return { position: pos, ...calculated };
                }
            }

            // Fallback to top with adjustment
            return { position: 'top', ...this.calculate(targetRect, tooltipRect, 'top', offset) };
        },
    };
};

// Tooltip trigger handler
const createTriggerHandler = (manager) => {
    const timers = new Map();

    return {
        handleMouseEnter: (id) => {
            const config = manager.getConfig(id);
            if (!config || config.trigger !== 'hover') return;

            const timer = setTimeout(() => {
                manager.show(id);
            }, config.delay);

            timers.set(id, timer);
        },

        handleMouseLeave: (id) => {
            const timer = timers.get(id);
            if (timer) {
                clearTimeout(timer);
                timers.delete(id);
            }

            if (manager.isVisible(id)) {
                manager.hide();
            }
        },

        handleFocus: (id) => {
            const config = manager.getConfig(id);
            if (!config || !['focus', 'hover'].includes(config.trigger)) return;

            manager.show(id);
        },

        handleBlur: (id) => {
            if (manager.isVisible(id)) {
                manager.hide();
            }
        },

        handleClick: (id) => {
            const config = manager.getConfig(id);
            if (!config || config.trigger !== 'click') return;

            if (manager.isVisible(id)) {
                manager.hide();
            } else {
                manager.show(id);
            }
        },

        clearAll: () => {
            for (const timer of timers.values()) {
                clearTimeout(timer);
            }
            timers.clear();
        },
    };
};

describe('Tooltip Manager Tests', () => {
    let manager;

    beforeEach(() => {
        manager = createTooltipManager();
    });

    // ═══════════════════════════════════════════════════════════════════
    // REGISTER / UNREGISTER
    // ═══════════════════════════════════════════════════════════════════

    describe('register / unregister', () => {
        it('should register tooltip', () => {
            manager.register('btn-1', { content: 'Click me' });

            expect(manager.getConfig('btn-1')).toBeDefined();
        });

        it('should unregister tooltip', () => {
            manager.register('btn-1', { content: 'Click me' });
            manager.unregister('btn-1');

            expect(manager.getConfig('btn-1')).toBeUndefined();
        });

        it('should store config', () => {
            manager.register('btn-1', {
                content: 'Tooltip text',
                position: 'bottom',
                delay: 500,
            });

            const config = manager.getConfig('btn-1');
            expect(config.content).toBe('Tooltip text');
            expect(config.position).toBe('bottom');
            expect(config.delay).toBe(500);
        });

        it('should use defaults', () => {
            manager.register('btn-1', { content: 'Test' });

            const config = manager.getConfig('btn-1');
            expect(config.position).toBe('top');
            expect(config.trigger).toBe('hover');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SHOW / HIDE
    // ═══════════════════════════════════════════════════════════════════

    describe('show / hide', () => {
        it('should show tooltip', () => {
            manager.register('btn-1', { content: 'Test' });
            manager.show('btn-1');

            expect(manager.isVisible('btn-1')).toBe(true);
        });

        it('should hide tooltip', () => {
            manager.register('btn-1', { content: 'Test' });
            manager.show('btn-1');
            manager.hide();

            expect(manager.isVisible('btn-1')).toBe(false);
        });

        it('should get active tooltip', () => {
            manager.register('btn-1', { content: 'Test' });
            manager.show('btn-1');

            expect(manager.getActive().id).toBe('btn-1');
        });

        it('should return null for non-existent tooltip', () => {
            expect(manager.show('non-existent')).toBeNull();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEFAULTS
    // ═══════════════════════════════════════════════════════════════════

    describe('defaults', () => {
        it('should set defaults', () => {
            manager.setDefaults({ delay: 500, duration: 3000 });
            manager.register('btn-1', { content: 'Test' });

            const config = manager.getConfig('btn-1');
            expect(config.delay).toBe(500);
            expect(config.duration).toBe(3000);
        });
    });
});

describe('Position Calculator Tests', () => {
    let calculator;
    const targetRect = { left: 100, top: 100, right: 200, bottom: 150, width: 100, height: 50 };
    const tooltipRect = { width: 80, height: 30 };

    beforeEach(() => {
        calculator = createPositionCalculator();
    });

    it('should calculate top position', () => {
        const pos = calculator.calculate(targetRect, tooltipRect, 'top');

        expect(pos.y).toBeLessThan(targetRect.top);
        expect(pos.arrow).toBe('bottom');
    });

    it('should calculate bottom position', () => {
        const pos = calculator.calculate(targetRect, tooltipRect, 'bottom');

        expect(pos.y).toBeGreaterThan(targetRect.bottom);
        expect(pos.arrow).toBe('top');
    });

    it('should calculate left position', () => {
        const pos = calculator.calculate(targetRect, tooltipRect, 'left');

        expect(pos.x).toBeLessThan(targetRect.left);
        expect(pos.arrow).toBe('right');
    });

    it('should calculate right position', () => {
        const pos = calculator.calculate(targetRect, tooltipRect, 'right');

        expect(pos.x).toBeGreaterThan(targetRect.right);
        expect(pos.arrow).toBe('left');
    });

    it('should adjust for viewport', () => {
        const position = { x: -50, y: 100 };
        const adjusted = calculator.adjustForViewport(position, 800, 600, tooltipRect);

        expect(adjusted.x).toBe(0);
    });

    it('should find best position', () => {
        const result = calculator.getBestPosition(
            targetRect,
            tooltipRect,
            800,
            600
        );

        expect(result.position).toBeDefined();
        expect(result.x).toBeDefined();
        expect(result.y).toBeDefined();
    });
});

describe('Trigger Handler Tests', () => {
    let manager;
    let handler;

    beforeEach(() => {
        vi.useFakeTimers();
        manager = createTooltipManager();
        handler = createTriggerHandler(manager);

        manager.register('btn-hover', { content: 'Hover', trigger: 'hover', delay: 100 });
        manager.register('btn-click', { content: 'Click', trigger: 'click' });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should show tooltip on hover after delay', () => {
        handler.handleMouseEnter('btn-hover');

        expect(manager.isVisible('btn-hover')).toBe(false);

        vi.advanceTimersByTime(100);

        expect(manager.isVisible('btn-hover')).toBe(true);
    });

    it('should hide tooltip on mouse leave', () => {
        handler.handleMouseEnter('btn-hover');
        vi.advanceTimersByTime(100);
        handler.handleMouseLeave('btn-hover');

        expect(manager.isVisible('btn-hover')).toBe(false);
    });

    it('should toggle tooltip on click', () => {
        handler.handleClick('btn-click');
        expect(manager.isVisible('btn-click')).toBe(true);

        handler.handleClick('btn-click');
        expect(manager.isVisible('btn-click')).toBe(false);
    });

    it('should cancel show on early leave', () => {
        handler.handleMouseEnter('btn-hover');
        vi.advanceTimersByTime(50);
        handler.handleMouseLeave('btn-hover');
        vi.advanceTimersByTime(100);

        expect(manager.isVisible('btn-hover')).toBe(false);
    });
});
