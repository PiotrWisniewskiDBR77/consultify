/**
 * Middleware Pipeline Tests
 * Tests for middleware pattern implementation
 * 
 * @module tests/middleware/middleware-pipeline.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Middleware pipeline implementation
const createPipeline = () => {
    const middleware = [];
    const errorHandlers = [];

    const compose = (middlewares) => {
        return async (context, next) => {
            let index = -1;

            const dispatch = async (i) => {
                if (i <= index) {
                    throw new Error('next() called multiple times');
                }
                index = i;

                let fn = middlewares[i];
                if (i === middlewares.length) fn = next;
                if (!fn) return;

                await fn(context, () => dispatch(i + 1));
            };

            return dispatch(0);
        };
    };

    return {
        use: (fn) => {
            if (typeof fn !== 'function') {
                throw new TypeError('Middleware must be a function');
            }
            middleware.push(fn);
            return this;
        },

        useIf: (condition, fn) => {
            const conditionalMiddleware = async (ctx, next) => {
                if (await condition(ctx)) {
                    return fn(ctx, next);
                }
                return next();
            };
            middleware.push(conditionalMiddleware);
            return this;
        },

        useAsync: (fn) => {
            return this.use(fn);
        },

        onError: (handler) => {
            errorHandlers.push(handler);
            return this;
        },

        run: async (context = {}) => {
            const composed = compose(middleware);

            try {
                await composed(context, async () => { });
                return { success: true, context };
            } catch (error) {
                // Run error handlers
                for (const handler of errorHandlers) {
                    try {
                        await handler(error, context);
                    } catch (handlerError) {
                        // Error in error handler
                        console.error('Error handler failed:', handlerError);
                    }
                }
                return { success: false, error, context };
            }
        },

        getMiddlewareCount: () => middleware.length,

        clear: () => {
            middleware.length = 0;
            errorHandlers.length = 0;
        },
    };
};

// Named middleware wrapper
const createNamedMiddleware = (name, fn) => {
    const wrapper = async (ctx, next) => {
        ctx._middlewareStack = ctx._middlewareStack || [];
        ctx._middlewareStack.push(name);
        await fn(ctx, next);
    };
    wrapper._name = name;
    return wrapper;
};

describe('Middleware Pipeline Tests', () => {
    let pipeline;

    beforeEach(() => {
        pipeline = createPipeline();
    });

    // ═══════════════════════════════════════════════════════════════════
    // USE
    // ═══════════════════════════════════════════════════════════════════

    describe('use', () => {
        it('should add middleware', () => {
            pipeline.use(async (ctx, next) => next());

            expect(pipeline.getMiddlewareCount()).toBe(1);
        });

        it('should chain multiple uses', () => {
            pipeline
                .use(async (ctx, next) => next())
                .use(async (ctx, next) => next())
                .use(async (ctx, next) => next());

            expect(pipeline.getMiddlewareCount()).toBe(3);
        });

        it('should throw for non-function', () => {
            expect(() => pipeline.use('not a function')).toThrow('must be a function');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // RUN
    // ═══════════════════════════════════════════════════════════════════

    describe('run', () => {
        it('should run middleware in order', async () => {
            const order = [];

            pipeline
                .use(async (ctx, next) => { order.push(1); await next(); })
                .use(async (ctx, next) => { order.push(2); await next(); })
                .use(async (ctx, next) => { order.push(3); await next(); });

            await pipeline.run();

            expect(order).toEqual([1, 2, 3]);
        });

        it('should modify context', async () => {
            pipeline
                .use(async (ctx, next) => { ctx.a = 1; await next(); })
                .use(async (ctx, next) => { ctx.b = 2; await next(); });

            const result = await pipeline.run({});

            expect(result.context.a).toBe(1);
            expect(result.context.b).toBe(2);
        });

        it('should support upstream and downstream', async () => {
            const order = [];

            pipeline.use(async (ctx, next) => {
                order.push('1-down');
                await next();
                order.push('1-up');
            });

            pipeline.use(async (ctx, next) => {
                order.push('2-down');
                await next();
                order.push('2-up');
            });

            await pipeline.run();

            expect(order).toEqual(['1-down', '2-down', '2-up', '1-up']);
        });

        it('should stop if next not called', async () => {
            const order = [];

            pipeline
                .use(async (ctx, next) => { order.push(1); /* no next */ })
                .use(async (ctx, next) => { order.push(2); await next(); });

            await pipeline.run();

            expect(order).toEqual([1]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // USE IF
    // ═══════════════════════════════════════════════════════════════════

    describe('useIf', () => {
        it('should run if condition true', async () => {
            const spy = vi.fn(async (ctx, next) => next());

            pipeline.useIf(
                (ctx) => ctx.enabled,
                spy
            );

            await pipeline.run({ enabled: true });

            expect(spy).toHaveBeenCalled();
        });

        it('should skip if condition false', async () => {
            const spy = vi.fn(async (ctx, next) => next());

            pipeline.useIf(
                (ctx) => ctx.enabled,
                spy
            );

            await pipeline.run({ enabled: false });

            expect(spy).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════════

    describe('Error Handling', () => {
        it('should catch errors', async () => {
            pipeline.use(async (ctx, next) => {
                throw new Error('Test error');
            });

            const result = await pipeline.run();

            expect(result.success).toBe(false);
            expect(result.error.message).toBe('Test error');
        });

        it('should call error handlers', async () => {
            const errorHandler = vi.fn();

            pipeline
                .use(async (ctx, next) => {
                    throw new Error('Middleware error');
                })
                .onError(errorHandler);

            await pipeline.run();

            expect(errorHandler).toHaveBeenCalled();
        });

        it('should pass error and context to handler', async () => {
            const errorHandler = vi.fn();

            pipeline
                .use(async (ctx, next) => {
                    throw new Error('Test');
                })
                .onError(errorHandler);

            await pipeline.run({ foo: 'bar' });

            expect(errorHandler).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({ foo: 'bar' })
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // NAMED MIDDLEWARE
    // ═══════════════════════════════════════════════════════════════════

    describe('Named Middleware', () => {
        it('should track middleware stack', async () => {
            pipeline
                .use(createNamedMiddleware('auth', async (ctx, next) => next()))
                .use(createNamedMiddleware('validate', async (ctx, next) => next()))
                .use(createNamedMiddleware('handler', async (ctx, next) => next()));

            const result = await pipeline.run({});

            expect(result.context._middlewareStack).toEqual(['auth', 'validate', 'handler']);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CLEAR
    // ═══════════════════════════════════════════════════════════════════

    describe('clear', () => {
        it('should clear all middleware', () => {
            pipeline
                .use(async (ctx, next) => next())
                .use(async (ctx, next) => next())
                .onError(() => { });

            pipeline.clear();

            expect(pipeline.getMiddlewareCount()).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ASYNC MIDDLEWARE
    // ═══════════════════════════════════════════════════════════════════

    describe('Async Middleware', () => {
        it('should handle async operations', async () => {
            pipeline.use(async (ctx, next) => {
                await new Promise(r => setTimeout(r, 10));
                ctx.step1 = true;
                await next();
            });

            pipeline.use(async (ctx, next) => {
                await new Promise(r => setTimeout(r, 10));
                ctx.step2 = true;
                await next();
            });

            const result = await pipeline.run({});

            expect(result.context.step1).toBe(true);
            expect(result.context.step2).toBe(true);
        });
    });
});
