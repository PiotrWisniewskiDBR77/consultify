/**
 * Chain of Responsibility Pattern Tests
 * Tests for request handling chains
 * 
 * @module tests/chain/chain-of-responsibility.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Chain handler
const createHandler = (name, canHandle, handle) => {
    let next = null;

    return {
        name,

        setNext: (handler) => {
            next = handler;
            return handler;
        },

        handle: async (request) => {
            if (canHandle(request)) {
                return handle(request);
            }

            if (next) {
                return next.handle(request);
            }

            return null;
        },

        getNext: () => next,
    };
};

// Middleware chain
const createMiddlewareChain = () => {
    const middlewares = [];

    return {
        use: (middleware) => {
            middlewares.push(middleware);
        },

        execute: async (context) => {
            let index = 0;

            const next = async () => {
                if (index < middlewares.length) {
                    const middleware = middlewares[index++];
                    await middleware(context, next);
                }
            };

            await next();
            return context;
        },

        getCount: () => middlewares.length,

        clear: () => {
            middlewares.length = 0;
        },
    };
};

// Pipeline chain
const createPipeline = () => {
    const stages = [];

    return {
        pipe: (stage) => {
            stages.push(stage);
            return this;
        },

        process: async (input) => {
            let result = input;

            for (const stage of stages) {
                result = await stage(result);
            }

            return result;
        },

        processParallel: async (inputs) => {
            return Promise.all(inputs.map(input => this.process(input)));
        },

        getStages: () => [...stages],
    };
};

// Validation chain
const createValidationChain = () => {
    const validators = [];

    return {
        add: (validator) => {
            validators.push(validator);
            return this;
        },

        required: (field) => {
            return this.add({
                field,
                validate: (value) => value !== undefined && value !== null && value !== '',
                message: `${field} is required`,
            });
        },

        minLength: (field, length) => {
            return this.add({
                field,
                validate: (value) => !value || value.length >= length,
                message: `${field} must be at least ${length} characters`,
            });
        },

        email: (field) => {
            return this.add({
                field,
                validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
                message: `${field} must be a valid email`,
            });
        },

        custom: (field, validateFn, message) => {
            return this.add({
                field,
                validate: validateFn,
                message,
            });
        },

        validate: (data) => {
            const errors = [];

            for (const validator of validators) {
                const value = data[validator.field];
                if (!validator.validate(value, data)) {
                    errors.push({
                        field: validator.field,
                        message: validator.message,
                    });
                }
            }

            return {
                valid: errors.length === 0,
                errors,
            };
        },
    };
};

// Interceptor chain
const createInterceptorChain = () => {
    const interceptors = [];

    return {
        add: (interceptor) => {
            interceptors.push(interceptor);
            return this;
        },

        intercept: async (request, executor) => {
            let index = 0;

            const chain = {
                request,

                proceed: async (req) => {
                    if (index < interceptors.length) {
                        const interceptor = interceptors[index++];
                        return interceptor.intercept(req, chain);
                    }
                    return executor(req);
                },
            };

            return chain.proceed(request);
        },
    };
};

describe('Handler Chain Tests', () => {
    it('should handle if can', async () => {
        const handler = createHandler(
            'numeric',
            (r) => typeof r === 'number',
            (r) => r * 2
        );

        const result = await handler.handle(5);

        expect(result).toBe(10);
    });

    it('should pass to next if cannot handle', async () => {
        const handler1 = createHandler(
            'numeric',
            (r) => typeof r === 'number',
            (r) => r * 2
        );

        const handler2 = createHandler(
            'string',
            (r) => typeof r === 'string',
            (r) => r.toUpperCase()
        );

        handler1.setNext(handler2);

        const result = await handler1.handle('hello');

        expect(result).toBe('HELLO');
    });

    it('should return null if no handler', async () => {
        const handler = createHandler(
            'numeric',
            (r) => typeof r === 'number',
            (r) => r * 2
        );

        const result = await handler.handle('hello');

        expect(result).toBeNull();
    });
});

describe('Middleware Chain Tests', () => {
    let chain;

    beforeEach(() => {
        chain = createMiddlewareChain();
    });

    it('should execute in order', async () => {
        const order = [];

        chain.use(async (ctx, next) => {
            order.push('a-before');
            await next();
            order.push('a-after');
        });

        chain.use(async (ctx, next) => {
            order.push('b');
            await next();
        });

        await chain.execute({});

        expect(order).toEqual(['a-before', 'b', 'a-after']);
    });

    it('should modify context', async () => {
        chain.use(async (ctx, next) => {
            ctx.step1 = true;
            await next();
        });

        chain.use(async (ctx, next) => {
            ctx.step2 = true;
            await next();
        });

        const result = await chain.execute({});

        expect(result.step1).toBe(true);
        expect(result.step2).toBe(true);
    });

    it('should short-circuit', async () => {
        const handler = vi.fn();

        chain.use(async (ctx, next) => {
            ctx.stopped = true;
            // Don't call next
        });

        chain.use(async (ctx, next) => {
            handler();
            await next();
        });

        await chain.execute({});

        expect(handler).not.toHaveBeenCalled();
    });
});

describe('Pipeline Chain Tests', () => {
    let pipeline;

    beforeEach(() => {
        pipeline = createPipeline();
    });

    it('should process through stages', async () => {
        pipeline
            .pipe((x) => x + 1)
            .pipe((x) => x * 2)
            .pipe((x) => x - 3);

        const result = await pipeline.process(5);

        expect(result).toBe(9); // ((5+1) * 2) - 3
    });

    it('should process async stages', async () => {
        pipeline
            .pipe(async (x) => x + 1)
            .pipe(async (x) => x * 2);

        const result = await pipeline.process(5);

        expect(result).toBe(12);
    });

    it('should process parallel', async () => {
        pipeline.pipe((x) => x * 2);

        const results = await pipeline.processParallel([1, 2, 3]);

        expect(results).toEqual([2, 4, 6]);
    });
});

describe('Validation Chain Tests', () => {
    let validation;

    beforeEach(() => {
        validation = createValidationChain();
    });

    it('should validate required', () => {
        validation.required('name');

        const result = validation.validate({});

        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('name');
    });

    it('should validate minLength', () => {
        validation.minLength('password', 8);

        const result = validation.validate({ password: '123' });

        expect(result.valid).toBe(false);
    });

    it('should validate email', () => {
        validation.email('email');

        expect(validation.validate({ email: 'invalid' }).valid).toBe(false);
        expect(validation.validate({ email: 'test@example.com' }).valid).toBe(true);
    });

    it('should chain validations', () => {
        validation
            .required('email')
            .email('email')
            .required('name');

        const result = validation.validate({
            email: 'test@example.com',
            name: 'John',
        });

        expect(result.valid).toBe(true);
    });
});

describe('Interceptor Chain Tests', () => {
    let chain;

    beforeEach(() => {
        chain = createInterceptorChain();
    });

    it('should intercept request', async () => {
        chain.add({
            intercept: async (req, chain) => {
                req.modified = true;
                return chain.proceed(req);
            },
        });

        const result = await chain.intercept({}, (req) => req);

        expect(result.modified).toBe(true);
    });

    it('should intercept response', async () => {
        chain.add({
            intercept: async (req, chain) => {
                const response = await chain.proceed(req);
                return { ...response, intercepted: true };
            },
        });

        const result = await chain.intercept({}, () => ({ data: 'test' }));

        expect(result.data).toBe('test');
        expect(result.intercepted).toBe(true);
    });
});
