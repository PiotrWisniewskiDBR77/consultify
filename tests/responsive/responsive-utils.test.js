/**
 * Responsive Design Tests
 * Tests for responsive utilities and breakpoints
 * 
 * @module tests/responsive/responsive-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Breakpoint manager
const createBreakpointManager = (breakpoints = {
    xs: 0,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    xxl: 1400,
}) => {
    let currentWidth = 1024;
    const listeners = [];

    const getBreakpoint = (width) => {
        const entries = Object.entries(breakpoints).sort((a, b) => b[1] - a[1]);
        for (const [name, minWidth] of entries) {
            if (width >= minWidth) {
                return name;
            }
        }
        return 'xs';
    };

    return {
        setWidth: (width) => {
            const oldBreakpoint = getBreakpoint(currentWidth);
            currentWidth = width;
            const newBreakpoint = getBreakpoint(currentWidth);

            if (oldBreakpoint !== newBreakpoint) {
                listeners.forEach(fn => fn(newBreakpoint, oldBreakpoint));
            }
        },

        getWidth: () => currentWidth,

        getBreakpoint: () => getBreakpoint(currentWidth),

        isAtLeast: (breakpoint) => {
            return currentWidth >= breakpoints[breakpoint];
        },

        isAtMost: (breakpoint) => {
            const nextBreakpoint = Object.entries(breakpoints)
                .sort((a, b) => a[1] - b[1])
                .find(([_, value]) => value > breakpoints[breakpoint]);

            return nextBreakpoint
                ? currentWidth < nextBreakpoint[1]
                : true;
        },

        isBetween: (min, max) => {
            return this.isAtLeast(min) && this.isAtMost(max);
        },

        onChange: (callback) => {
            listeners.push(callback);
            return () => {
                const idx = listeners.indexOf(callback);
                if (idx !== -1) listeners.splice(idx, 1);
            };
        },

        getBreakpoints: () => ({ ...breakpoints }),

        isMobile: () => currentWidth < breakpoints.md,

        isTablet: () => currentWidth >= breakpoints.md && currentWidth < breakpoints.lg,

        isDesktop: () => currentWidth >= breakpoints.lg,
    };
};

// Media query matcher
const createMediaQueryMatcher = () => {
    const queries = new Map();

    return {
        matches: (query) => {
            // Parse simple queries
            const widthMatch = query.match(/\((?:min|max)-width:\s*(\d+)px\)/);
            if (!widthMatch) return false;

            const width = parseInt(widthMatch[1]);
            const currentWidth = queries.get('width') || 1024;

            if (query.includes('min-width')) {
                return currentWidth >= width;
            }
            if (query.includes('max-width')) {
                return currentWidth <= width;
            }

            return false;
        },

        setWidth: (width) => {
            queries.set('width', width);
        },

        addListener: (query, callback) => {
            // Simplified - would use matchMedia in real impl
        },

        matchesOrientation: (orientation) => {
            const width = queries.get('width') || 1024;
            const height = queries.get('height') || 768;

            if (orientation === 'portrait') {
                return height > width;
            }
            return width >= height;
        },

        setDimensions: (width, height) => {
            queries.set('width', width);
            queries.set('height', height);
        },

        prefersDarkMode: () => queries.get('darkMode') || false,

        setDarkMode: (value) => {
            queries.set('darkMode', value);
        },

        prefersReducedMotion: () => queries.get('reducedMotion') || false,

        setReducedMotion: (value) => {
            queries.set('reducedMotion', value);
        },
    };
};

// Responsive value resolver
const createResponsiveResolver = (breakpointManager) => {
    return {
        resolve: (values) => {
            if (typeof values !== 'object' || values === null) {
                return values;
            }

            const breakpoint = breakpointManager.getBreakpoint();
            const breakpointOrder = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
            const currentIndex = breakpointOrder.indexOf(breakpoint);

            // Find value for current or smaller breakpoint
            for (let i = currentIndex; i >= 0; i--) {
                const bp = breakpointOrder[i];
                if (values[bp] !== undefined) {
                    return values[bp];
                }
            }

            return values.default || values.xs || Object.values(values)[0];
        },

        resolveAll: (valueMap) => {
            const result = {};
            for (const [key, values] of Object.entries(valueMap)) {
                result[key] = this.resolve(values);
            }
            return result;
        },
    };
};

// Container query simulator
const createContainerQuery = () => {
    const containers = new Map();

    return {
        registerContainer: (id, width, height) => {
            containers.set(id, { width, height });
        },

        updateContainer: (id, width, height) => {
            const container = containers.get(id);
            if (container) {
                container.width = width;
                container.height = height;
            }
        },

        query: (id, conditions) => {
            const container = containers.get(id);
            if (!container) return false;

            if (conditions.minWidth && container.width < conditions.minWidth) {
                return false;
            }
            if (conditions.maxWidth && container.width > conditions.maxWidth) {
                return false;
            }
            if (conditions.minHeight && container.height < conditions.minHeight) {
                return false;
            }
            if (conditions.maxHeight && container.height > conditions.maxHeight) {
                return false;
            }

            return true;
        },

        getSize: (id) => containers.get(id) || null,

        removeContainer: (id) => containers.delete(id),
    };
};

// Aspect ratio calculator
const createAspectRatioCalculator = () => {
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

    return {
        calculate: (width, height) => {
            const divisor = gcd(width, height);
            return `${width / divisor}:${height / divisor}`;
        },

        getWidth: (height, ratio) => {
            const [w, h] = ratio.split(':').map(Number);
            return (height * w) / h;
        },

        getHeight: (width, ratio) => {
            const [w, h] = ratio.split(':').map(Number);
            return (width * h) / w;
        },

        isWide: (ratio) => {
            const [w, h] = ratio.split(':').map(Number);
            return w > h;
        },

        isTall: (ratio) => {
            const [w, h] = ratio.split(':').map(Number);
            return h > w;
        },

        isSquare: (ratio) => {
            const [w, h] = ratio.split(':').map(Number);
            return w === h;
        },

        toDecimal: (ratio) => {
            const [w, h] = ratio.split(':').map(Number);
            return w / h;
        },
    };
};

describe('Breakpoint Manager Tests', () => {
    let manager;

    beforeEach(() => {
        manager = createBreakpointManager();
    });

    it('should detect current breakpoint', () => {
        manager.setWidth(800);

        expect(manager.getBreakpoint()).toBe('md');
    });

    it('should check isAtLeast', () => {
        manager.setWidth(1000);

        expect(manager.isAtLeast('md')).toBe(true);
        expect(manager.isAtLeast('xl')).toBe(false);
    });

    it('should detect mobile', () => {
        manager.setWidth(500);

        expect(manager.isMobile()).toBe(true);
    });

    it('should detect desktop', () => {
        manager.setWidth(1200);

        expect(manager.isDesktop()).toBe(true);
    });

    it('should notify on breakpoint change', () => {
        const callback = vi.fn();
        manager.onChange(callback);

        manager.setWidth(500); // md -> sm

        expect(callback).toHaveBeenCalled();
    });
});

describe('Media Query Matcher Tests', () => {
    let matcher;

    beforeEach(() => {
        matcher = createMediaQueryMatcher();
    });

    it('should match min-width', () => {
        matcher.setWidth(1024);

        expect(matcher.matches('(min-width: 768px)')).toBe(true);
        expect(matcher.matches('(min-width: 1200px)')).toBe(false);
    });

    it('should match max-width', () => {
        matcher.setWidth(600);

        expect(matcher.matches('(max-width: 768px)')).toBe(true);
    });

    it('should detect orientation', () => {
        matcher.setDimensions(800, 1200);

        expect(matcher.matchesOrientation('portrait')).toBe(true);
    });

    it('should track dark mode preference', () => {
        matcher.setDarkMode(true);

        expect(matcher.prefersDarkMode()).toBe(true);
    });
});

describe('Responsive Resolver Tests', () => {
    let manager;
    let resolver;

    beforeEach(() => {
        manager = createBreakpointManager();
        resolver = createResponsiveResolver(manager);
    });

    it('should resolve for current breakpoint', () => {
        manager.setWidth(800); // md

        const result = resolver.resolve({
            xs: 1,
            md: 2,
            lg: 3,
        });

        expect(result).toBe(2);
    });

    it('should fallback to smaller breakpoint', () => {
        manager.setWidth(800); // md

        const result = resolver.resolve({
            xs: 1,
            lg: 3,
        });

        expect(result).toBe(1);
    });

    it('should resolve all values', () => {
        manager.setWidth(800);

        const result = resolver.resolveAll({
            columns: { xs: 1, md: 2, lg: 3 },
            gap: { xs: 8, md: 16 },
        });

        expect(result.columns).toBe(2);
        expect(result.gap).toBe(16);
    });
});

describe('Container Query Tests', () => {
    let cq;

    beforeEach(() => {
        cq = createContainerQuery();
    });

    it('should register container', () => {
        cq.registerContainer('card', 300, 200);

        expect(cq.getSize('card')).toEqual({ width: 300, height: 200 });
    });

    it('should query container', () => {
        cq.registerContainer('card', 400, 300);

        expect(cq.query('card', { minWidth: 300 })).toBe(true);
        expect(cq.query('card', { minWidth: 500 })).toBe(false);
    });

    it('should update container', () => {
        cq.registerContainer('card', 300, 200);
        cq.updateContainer('card', 500, 400);

        expect(cq.getSize('card').width).toBe(500);
    });
});

describe('Aspect Ratio Calculator Tests', () => {
    let calc;

    beforeEach(() => {
        calc = createAspectRatioCalculator();
    });

    it('should calculate ratio', () => {
        expect(calc.calculate(1920, 1080)).toBe('16:9');
    });

    it('should get width from ratio', () => {
        expect(calc.getWidth(100, '16:9')).toBeCloseTo(177.78, 1);
    });

    it('should get height from ratio', () => {
        expect(calc.getHeight(160, '16:9')).toBe(90);
    });

    it('should detect wide ratio', () => {
        expect(calc.isWide('16:9')).toBe(true);
        expect(calc.isWide('9:16')).toBe(false);
    });

    it('should convert to decimal', () => {
        expect(calc.toDecimal('16:9')).toBeCloseTo(1.78, 1);
    });
});
