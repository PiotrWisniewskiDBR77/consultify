/**
 * Validation Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Higher-order function to validate request body against a Zod schema.
 */

import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import logger from '../utils/Logger.js';

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Validate request body against a Zod schema
 * @param schema - The Zod schema to validate against
 * @returns Express middleware
 */
export const validateBody = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                // Format Zod errors into a readable structure
                const errors =
                    result.error?.issues?.map((err: any) => ({
                        field: err.path.join('.'),
                        message: err.message,
                        code: err.code,
                    })) || [];

                res.status(400).json({
                    error: 'Validation Error',
                    details: errors,
                });
                return;
            }

            // Replace body with parsed (sanitized/coerced) data
            req.body = result.data;
            next();
        } catch (error: any) {
            logger.error('Validation Middleware Error:', error);
            res.status(500).json({ error: 'Internal Server Error during validation' });
        }
    };
};

/**
 * Validate request query parameters against a Zod schema
 * @param schema - The Zod schema to validate against
 * @returns Express middleware
 */
export const validateQuery = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const result = schema.safeParse(req.query);
            if (!result.success) {
                const errors =
                    result.error?.issues?.map((err: any) => ({
                        field: err.path.join('.'),
                        message: err.message,
                        code: err.code,
                    })) || [];

                res.status(400).json({
                    error: 'Validation Error',
                    details: errors,
                });
                return;
            }

            req.query = result.data as unknown as typeof req.query;
            next();
        } catch (error: any) {
            logger.error('Validation Middleware Error:', error);
            res.status(500).json({ error: 'Internal Server Error during validation' });
        }
    };
};

/**
 * Validate request path parameters against a Zod schema
 * @param schema - The Zod schema to validate against
 * @returns Express middleware
 */
export const validateParams = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const result = schema.safeParse(req.params);
            if (!result.success) {
                const errors =
                    result.error?.issues?.map((err: any) => ({
                        field: err.path.join('.'),
                        message: err.message,
                        code: err.code,
                    })) || [];

                res.status(400).json({
                    error: 'Validation Error',
                    details: errors,
                });
                return;
            }

            req.params = result.data as unknown as typeof req.params;
            next();
        } catch (error: any) {
            logger.error('Validation Middleware Error:', error);
            res.status(500).json({ error: 'Internal Server Error during validation' });
        }
    };
};
