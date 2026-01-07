/**
 * Strategy Pattern Tests
 * Tests for strategy pattern implementations
 * 
 * @module tests/patterns/strategy.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Strategy context
const createStrategyContext = (defaultStrategy = null) => {
    let currentStrategy = defaultStrategy;

    return {
        setStrategy: (strategy) => {
            currentStrategy = strategy;
        },

        getStrategy: () => currentStrategy,

        execute: (...args) => {
            if (!currentStrategy) {
                throw new Error('No strategy set');
            }
            return currentStrategy.execute(...args);
        },

        hasStrategy: () => currentStrategy !== null,
    };
};

// Strategy registry
const createStrategyRegistry = () => {
    const strategies = new Map();

    return {
        register: (name, strategy) => {
            strategies.set(name, strategy);
        },

        get: (name) => {
            const strategy = strategies.get(name);
            if (!strategy) {
                throw new Error(`Strategy not found: ${name}`);
            }
            return strategy;
        },

        has: (name) => strategies.has(name),

        getNames: () => [...strategies.keys()],

        createContext: (strategyName) => {
            const strategy = strategies.get(strategyName);
            return createStrategyContext(strategy);
        },
    };
};

// Composite strategy (combines multiple strategies)
const createCompositeStrategy = (strategies, combiner = 'all') => {
    return {
        execute: async (...args) => {
            if (combiner === 'all') {
                const results = await Promise.all(
                    strategies.map(s => s.execute(...args))
                );
                return results;
            }

            if (combiner === 'race') {
                return Promise.race(
                    strategies.map(s => s.execute(...args))
                );
            }

            if (combiner === 'first') {
                for (const strategy of strategies) {
                    const result = await strategy.execute(...args);
                    if (result !== null && result !== undefined) {
                        return result;
                    }
                }
                return null;
            }

            if (combiner === 'chain') {
                let result = args[0];
                for (const strategy of strategies) {
                    result = await strategy.execute(result);
                }
                return result;
            }
        },
    };
};

// Conditional strategy
const createConditionalStrategy = (conditions) => {
    return {
        execute: (...args) => {
            for (const { condition, strategy } of conditions) {
                if (condition(...args)) {
                    return strategy.execute(...args);
                }
            }
            throw new Error('No matching condition');
        },

        addCondition: (condition, strategy) => {
            conditions.push({ condition, strategy });
        },
    };
};

// Example strategies for testing
const sortStrategies = {
    quickSort: {
        name: 'quickSort',
        execute: (arr) => [...arr].sort((a, b) => a - b),
    },
    bubbleSort: {
        name: 'bubbleSort',
        execute: (arr) => {
            const result = [...arr];
            for (let i = 0; i < result.length; i++) {
                for (let j = 0; j < result.length - 1; j++) {
                    if (result[j] > result[j + 1]) {
                        [result[j], result[j + 1]] = [result[j + 1], result[j]];
                    }
                }
            }
            return result;
        },
    },
    reverseSort: {
        name: 'reverseSort',
        execute: (arr) => [...arr].sort((a, b) => b - a),
    },
};

const pricingStrategies = {
    regular: {
        name: 'regular',
        execute: (price) => price,
    },
    discount10: {
        name: 'discount10',
        execute: (price) => price * 0.9,
    },
    discount20: {
        name: 'discount20',
        execute: (price) => price * 0.8,
    },
    premium: {
        name: 'premium',
        execute: (price) => price * 1.2,
    },
};

const validationStrategies = {
    email: {
        execute: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    },
    phone: {
        execute: (value) => /^\d{10,}$/.test(value.replace(/\D/g, '')),
    },
    required: {
        execute: (value) => value !== null && value !== undefined && value !== '',
    },
    minLength: (min) => ({
        execute: (value) => value && value.length >= min,
    }),
};

describe('Strategy Pattern Tests', () => {
    // ═══════════════════════════════════════════════════════════════════
    // STRATEGY CONTEXT
    // ═══════════════════════════════════════════════════════════════════

    describe('Strategy Context', () => {
        let context;

        beforeEach(() => {
            context = createStrategyContext();
        });

        it('should set and execute strategy', () => {
            context.setStrategy(sortStrategies.quickSort);

            const result = context.execute([3, 1, 4, 1, 5]);

            expect(result).toEqual([1, 1, 3, 4, 5]);
        });

        it('should change strategy at runtime', () => {
            const arr = [3, 1, 4];

            context.setStrategy(sortStrategies.quickSort);
            expect(context.execute(arr)).toEqual([1, 3, 4]);

            context.setStrategy(sortStrategies.reverseSort);
            expect(context.execute(arr)).toEqual([4, 3, 1]);
        });

        it('should throw when no strategy set', () => {
            expect(() => context.execute()).toThrow('No strategy set');
        });

        it('should check if strategy is set', () => {
            expect(context.hasStrategy()).toBe(false);

            context.setStrategy(sortStrategies.quickSort);
            expect(context.hasStrategy()).toBe(true);
        });

        it('should get current strategy', () => {
            context.setStrategy(sortStrategies.bubbleSort);

            expect(context.getStrategy().name).toBe('bubbleSort');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // STRATEGY REGISTRY
    // ═══════════════════════════════════════════════════════════════════

    describe('Strategy Registry', () => {
        let registry;

        beforeEach(() => {
            registry = createStrategyRegistry();
            registry.register('quick', sortStrategies.quickSort);
            registry.register('bubble', sortStrategies.bubbleSort);
        });

        it('should register and get strategy', () => {
            const strategy = registry.get('quick');

            expect(strategy.name).toBe('quickSort');
        });

        it('should throw for unknown strategy', () => {
            expect(() => registry.get('unknown')).toThrow('not found');
        });

        it('should check if strategy exists', () => {
            expect(registry.has('quick')).toBe(true);
            expect(registry.has('merge')).toBe(false);
        });

        it('should list strategy names', () => {
            expect(registry.getNames()).toContain('quick');
            expect(registry.getNames()).toContain('bubble');
        });

        it('should create context with strategy', () => {
            const context = registry.createContext('quick');

            expect(context.execute([5, 2, 8])).toEqual([2, 5, 8]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // COMPOSITE STRATEGY
    // ═══════════════════════════════════════════════════════════════════

    describe('Composite Strategy', () => {
        it('should execute all strategies', async () => {
            const composite = createCompositeStrategy([
                { execute: (x) => x * 2 },
                { execute: (x) => x + 10 },
                { execute: (x) => x - 5 },
            ], 'all');

            const results = await composite.execute(5);

            expect(results).toEqual([10, 15, 0]);
        });

        it('should chain strategies', async () => {
            const composite = createCompositeStrategy([
                { execute: (x) => x * 2 },
                { execute: (x) => x + 10 },
                { execute: (x) => x * 3 },
            ], 'chain');

            const result = await composite.execute(5);

            expect(result).toBe(60); // (5 * 2 + 10) * 3
        });

        it('should return first non-null result', async () => {
            const composite = createCompositeStrategy([
                { execute: () => null },
                { execute: () => undefined },
                { execute: () => 'found!' },
                { execute: () => 'ignored' },
            ], 'first');

            const result = await composite.execute();

            expect(result).toBe('found!');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CONDITIONAL STRATEGY
    // ═══════════════════════════════════════════════════════════════════

    describe('Conditional Strategy', () => {
        it('should execute matching strategy', () => {
            const conditional = createConditionalStrategy([
                {
                    condition: (user) => user.type === 'premium',
                    strategy: pricingStrategies.discount20,
                },
                {
                    condition: (user) => user.type === 'member',
                    strategy: pricingStrategies.discount10,
                },
                {
                    condition: () => true, // default
                    strategy: pricingStrategies.regular,
                },
            ]);

            expect(conditional.execute({ type: 'premium' }, 100)).toBe(80);
            expect(conditional.execute({ type: 'member' }, 100)).toBe(90);
            expect(conditional.execute({ type: 'guest' }, 100)).toBe(100);
        });

        it('should add conditions dynamically', () => {
            const conditional = createConditionalStrategy([]);

            conditional.addCondition(
                (x) => x > 0,
                { execute: () => 'positive' }
            );
            conditional.addCondition(
                (x) => x < 0,
                { execute: () => 'negative' }
            );

            expect(conditional.execute(5)).toBe('positive');
            expect(conditional.execute(-5)).toBe('negative');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // REAL-WORLD EXAMPLES
    // ═══════════════════════════════════════════════════════════════════

    describe('Real-World Examples', () => {
        it('should apply pricing strategies', () => {
            const context = createStrategyContext(pricingStrategies.regular);

            expect(context.execute(100)).toBe(100);

            context.setStrategy(pricingStrategies.discount20);
            expect(context.execute(100)).toBe(80);
        });

        it('should validate with different strategies', () => {
            const emailValidator = createStrategyContext(validationStrategies.email);
            const phoneValidator = createStrategyContext(validationStrategies.phone);

            expect(emailValidator.execute('test@example.com')).toBe(true);
            expect(emailValidator.execute('invalid')).toBe(false);
            expect(phoneValidator.execute('123-456-7890')).toBe(true);
        });

        it('should compose validation strategies', async () => {
            const composite = createCompositeStrategy([
                validationStrategies.required,
                validationStrategies.email,
            ], 'all');

            const results = await composite.execute('test@example.com');
            expect(results.every(r => r === true)).toBe(true);

            const invalidResults = await composite.execute('');
            expect(invalidResults.some(r => r === false)).toBe(true);
        });
    });
});
