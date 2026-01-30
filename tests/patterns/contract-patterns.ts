/**
 * Professional Contract Testing Patterns
 *
 * Patterns for API contract testing and schema validation
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export interface ContractSchema {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
    properties?: Record<string, ContractSchema>;
    items?: ContractSchema;
    required?: string[];
    enum?: unknown[];
    pattern?: string;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    format?: 'email' | 'date' | 'datetime' | 'uri' | 'uuid';
    nullable?: boolean;
}

export interface ApiContract {
    name: string;
    version: string;
    endpoints: EndpointContract[];
}

export interface EndpointContract {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    description?: string;
    request?: {
        query?: Record<string, ContractSchema>;
        body?: ContractSchema;
        headers?: Record<string, ContractSchema>;
    };
    responses: {
        status: number;
        body?: ContractSchema;
        headers?: Record<string, ContractSchema>;
    }[];
}

export interface ValidationError {
    path: string;
    message: string;
    expected: string;
    actual: string;
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Validate value against contract schema
 */
export function validateSchema(
    value: unknown,
    schema: ContractSchema,
    path = '$'
): ValidationError[] {
    const errors: ValidationError[] = [];

    // Handle nullable
    if (value === null) {
        if (schema.nullable) {
            return [];
        }
        errors.push({
            path,
            message: 'Value is null but schema does not allow null',
            expected: schema.type,
            actual: 'null',
        });
        return errors;
    }

    // Type check
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (schema.type !== actualType) {
        errors.push({
            path,
            message: `Type mismatch`,
            expected: schema.type,
            actual: actualType,
        });
        return errors;
    }

    // Validate based on type
    switch (schema.type) {
        case 'string':
            errors.push(...validateString(value as string, schema, path));
            break;
        case 'number':
            errors.push(...validateNumber(value as number, schema, path));
            break;
        case 'object':
            errors.push(...validateObject(value as Record<string, unknown>, schema, path));
            break;
        case 'array':
            errors.push(...validateArray(value as unknown[], schema, path));
            break;
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
        errors.push({
            path,
            message: `Value not in enum`,
            expected: `one of: ${schema.enum.join(', ')}`,
            actual: String(value),
        });
    }

    return errors;
}

function validateString(value: string, schema: ContractSchema, path: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({
            path,
            message: `String too short`,
            expected: `minLength: ${schema.minLength}`,
            actual: `length: ${value.length}`,
        });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({
            path,
            message: `String too long`,
            expected: `maxLength: ${schema.maxLength}`,
            actual: `length: ${value.length}`,
        });
    }

    if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
            errors.push({
                path,
                message: `Pattern mismatch`,
                expected: `pattern: ${schema.pattern}`,
                actual: value,
            });
        }
    }

    if (schema.format) {
        const formatValid = validateFormat(value, schema.format);
        if (!formatValid) {
            errors.push({
                path,
                message: `Format invalid`,
                expected: `format: ${schema.format}`,
                actual: value,
            });
        }
    }

    return errors;
}

function validateNumber(value: number, schema: ContractSchema, path: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
            path,
            message: `Number too small`,
            expected: `minimum: ${schema.minimum}`,
            actual: String(value),
        });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
            path,
            message: `Number too large`,
            expected: `maximum: ${schema.maximum}`,
            actual: String(value),
        });
    }

    return errors;
}

function validateObject(
    value: Record<string, unknown>,
    schema: ContractSchema,
    path: string
): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check required fields
    if (schema.required) {
        for (const field of schema.required) {
            if (!(field in value)) {
                errors.push({
                    path: `${path}.${field}`,
                    message: `Required field missing`,
                    expected: 'field present',
                    actual: 'field missing',
                });
            }
        }
    }

    // Validate properties
    if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
            if (propName in value) {
                errors.push(...validateSchema(value[propName], propSchema, `${path}.${propName}`));
            }
        }
    }

    return errors;
}

function validateArray(value: unknown[], schema: ContractSchema, path: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (schema.items) {
        for (let i = 0; i < value.length; i++) {
            errors.push(...validateSchema(value[i], schema.items, `${path}[${i}]`));
        }
    }

    return errors;
}

function validateFormat(value: string, format: string): boolean {
    switch (format) {
        case 'email':
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        case 'date':
            return /^\d{4}-\d{2}-\d{2}$/.test(value);
        case 'datetime':
            return !isNaN(Date.parse(value));
        case 'uri':
            try {
                new URL(value);
                return true;
            } catch {
                return false;
            }
        case 'uuid':
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
        default:
            return true;
    }
}

// ============================================================================
// Contract Test Generator
// ============================================================================

/**
 * Generate contract tests for an API
 */
export function generateContractTests(
    contract: ApiContract,
    options: {
        baseUrl: string;
        getAuthToken?: () => Promise<string>;
        beforeEach?: () => Promise<void>;
    }
): void {
    describe(`${contract.name} v${contract.version} Contract`, () => {
        for (const endpoint of contract.endpoints) {
            describe(`${endpoint.method} ${endpoint.path}`, () => {
                for (const response of endpoint.responses) {
                    it(`returns ${response.status} with valid schema`, async () => {
                        // This would make the actual API call and validate
                        const url = `${options.baseUrl}${endpoint.path}`;
                        const headers: Record<string, string> = {
                            'Content-Type': 'application/json',
                        };

                        if (options.getAuthToken) {
                            headers['Authorization'] = `Bearer ${await options.getAuthToken()}`;
                        }

                        const res = await fetch(url, {
                            method: endpoint.method,
                            headers,
                        });

                        expect(res.status).toBe(response.status);

                        if (response.body) {
                            const body = await res.json();
                            const errors = validateSchema(body, response.body);
                            expect(errors).toHaveLength(0);
                        }
                    });
                }
            });
        }
    });
}

// ============================================================================
// Common Schema Definitions
// ============================================================================

export const CommonSchemas = {
    id: {
        type: 'string' as const,
        minLength: 1,
    },

    email: {
        type: 'string' as const,
        format: 'email' as const,
    },

    datetime: {
        type: 'string' as const,
        format: 'datetime' as const,
    },

    uuid: {
        type: 'string' as const,
        format: 'uuid' as const,
    },

    pagination: {
        type: 'object' as const,
        properties: {
            page: { type: 'number' as const, minimum: 1 },
            limit: { type: 'number' as const, minimum: 1, maximum: 100 },
            total: { type: 'number' as const, minimum: 0 },
            totalPages: { type: 'number' as const, minimum: 0 },
        },
        required: ['page', 'limit', 'total', 'totalPages'],
    },

    error: {
        type: 'object' as const,
        properties: {
            error: { type: 'string' as const },
            code: { type: 'string' as const },
            details: { type: 'object' as const },
        },
        required: ['error'],
    },

    user: {
        type: 'object' as const,
        properties: {
            id: { type: 'string' as const },
            email: { type: 'string' as const, format: 'email' as const },
            firstName: { type: 'string' as const },
            lastName: { type: 'string' as const },
            role: { type: 'string' as const, enum: ['admin', 'manager', 'member', 'viewer'] },
            status: { type: 'string' as const, enum: ['active', 'pending', 'suspended'] },
            createdAt: { type: 'string' as const, format: 'datetime' as const },
        },
        required: ['id', 'email', 'role', 'status'],
    },

    project: {
        type: 'object' as const,
        properties: {
            id: { type: 'string' as const },
            name: { type: 'string' as const },
            slug: { type: 'string' as const },
            status: { type: 'string' as const, enum: ['draft', 'active', 'on_hold', 'completed', 'archived'] },
            organizationId: { type: 'string' as const },
            createdAt: { type: 'string' as const, format: 'datetime' as const },
        },
        required: ['id', 'name', 'status', 'organizationId'],
    },
};

// ============================================================================
// Consumer-Driven Contract Testing
// ============================================================================

export interface ConsumerContract {
    consumer: string;
    provider: string;
    interactions: Interaction[];
}

export interface Interaction {
    description: string;
    request: {
        method: string;
        path: string;
        query?: Record<string, string>;
        headers?: Record<string, string>;
        body?: unknown;
    };
    response: {
        status: number;
        headers?: Record<string, string>;
        body?: unknown;
    };
}

/**
 * Verify provider against consumer contracts
 */
export async function verifyProviderContract(
    contract: ConsumerContract,
    providerBaseUrl: string
): Promise<{ passed: number; failed: Interaction[] }> {
    const failed: Interaction[] = [];
    let passed = 0;

    for (const interaction of contract.interactions) {
        try {
            const url = new URL(interaction.request.path, providerBaseUrl);

            if (interaction.request.query) {
                for (const [key, value] of Object.entries(interaction.request.query)) {
                    url.searchParams.set(key, value);
                }
            }

            const response = await fetch(url.toString(), {
                method: interaction.request.method,
                headers: {
                    'Content-Type': 'application/json',
                    ...interaction.request.headers,
                },
                body: interaction.request.body ? JSON.stringify(interaction.request.body) : undefined,
            });

            if (response.status !== interaction.response.status) {
                failed.push(interaction);
                continue;
            }

            if (interaction.response.body) {
                const body = await response.json();
                // Simple equality check - could be more sophisticated
                if (JSON.stringify(body) !== JSON.stringify(interaction.response.body)) {
                    failed.push(interaction);
                    continue;
                }
            }

            passed++;
        } catch {
            failed.push(interaction);
        }
    }

    return { passed, failed };
}
