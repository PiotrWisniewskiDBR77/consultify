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
      // Guard against undefined or invalid schemas
      if (!schema) {
        logger.error('[ValidationMiddleware] Schema is undefined', { 
          path: req.path, 
          method: req.method 
        });
        res.status(500).json({ error: 'Validation schema is undefined' });
        return;
      }

      if (typeof schema.safeParse !== 'function') {
        logger.error('[ValidationMiddleware] Schema does not have safeParse method', { 
          path: req.path, 
          method: req.method,
          schemaType: typeof schema,
          schemaKeys: schema ? Object.keys(schema) : []
        });
        res.status(500).json({ error: 'Invalid validation schema - missing safeParse method' });
        return;
      }

      let result;
      try {
        result = schema.safeParse(req.body);
      } catch (parseError: any) {
        // Catch errors during schema parsing (e.g., undefined nested schemas, corrupted schema structure)
        // This specifically handles the "Cannot read properties of undefined (reading '_zod')" error
        logger.error('[ValidationMiddleware] Error during schema.safeParse', {
          path: req.path,
          method: req.method,
          error: parseError?.message || String(parseError),
          stack: parseError?.stack,
          errorType: parseError?.constructor?.name,
          schemaType: typeof schema,
          schemaConstructor: schema?.constructor?.name,
          isZodError: parseError?.message?.includes('_zod') || false
        });
        res.status(500).json({ 
          error: 'Internal Server Error during validation',
          details: parseError?.message || 'Schema validation error'
        });
        return;
      }
      if (!result.success) {
        // Format Zod errors into a readable structure
        const errors =
          result.error?.issues?.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })) || [];

        console.log(
          `[ValidationMiddleware] Validation failed for ${req.method} ${req.path}:`,
          JSON.stringify(errors, null, 2)
        );

        const firstError = errors[0];
        const errorMessage = firstError ? firstError.message : 'Validation Error';

        res.status(400).json({
          error: errorMessage,
          details: errors,
        });
        return;
      }

      // Replace body with parsed (sanitized/coerced) data
      try {
        req.body = result.data;
      } catch (e) {
        // Fallback for read-only body property
        Object.defineProperty(req, 'body', {
          value: result.data,
          writable: true,
          configurable: true,
        });
      }
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
      // Guard against undefined or invalid schemas
      if (!schema) {
        logger.error('[ValidationMiddleware] Schema is undefined', { 
          path: req.path, 
          method: req.method 
        });
        res.status(500).json({ error: 'Validation schema is undefined' });
        return;
      }

      if (typeof schema.safeParse !== 'function') {
        logger.error('[ValidationMiddleware] Schema does not have safeParse method', { 
          path: req.path, 
          method: req.method,
          schemaType: typeof schema,
          schemaKeys: schema ? Object.keys(schema) : []
        });
        res.status(500).json({ error: 'Invalid validation schema - missing safeParse method' });
        return;
      }

      let result;
      try {
        result = schema.safeParse(req.query);
      } catch (parseError: any) {
        logger.error('[ValidationMiddleware] Error during schema.safeParse', {
          path: req.path,
          method: req.method,
          error: parseError?.message || String(parseError),
          stack: parseError?.stack,
          errorType: parseError?.constructor?.name
        });
        res.status(500).json({ 
          error: 'Internal Server Error during validation',
          details: parseError?.message || 'Schema validation error'
        });
        return;
      }
      if (!result.success) {
        const errors =
          result.error?.issues?.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })) || [];

        const firstError = errors[0];
        const errorMessage = firstError ? firstError.message : 'Validation Error';

        res.status(400).json({
          error: errorMessage,
          details: errors,
        });
        return;
      }

      try {
        req.query = result.data as unknown as typeof req.query;
      } catch (e) {
        // Fallback for cases where req.query has only a getter (e.g. some test environments)
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
        });
      }
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
      // Guard against undefined or invalid schemas
      if (!schema) {
        logger.error('[ValidationMiddleware] Schema is undefined', { 
          path: req.path, 
          method: req.method 
        });
        res.status(500).json({ error: 'Validation schema is undefined' });
        return;
      }

      if (typeof schema.safeParse !== 'function') {
        logger.error('[ValidationMiddleware] Schema does not have safeParse method', { 
          path: req.path, 
          method: req.method,
          schemaType: typeof schema,
          schemaKeys: schema ? Object.keys(schema) : []
        });
        res.status(500).json({ error: 'Invalid validation schema - missing safeParse method' });
        return;
      }

      let result;
      try {
        result = schema.safeParse(req.params);
      } catch (parseError: any) {
        logger.error('[ValidationMiddleware] Error during schema.safeParse', {
          path: req.path,
          method: req.method,
          error: parseError?.message || String(parseError),
          stack: parseError?.stack,
          errorType: parseError?.constructor?.name
        });
        res.status(500).json({ 
          error: 'Internal Server Error during validation',
          details: parseError?.message || 'Schema validation error'
        });
        return;
      }
      if (!result.success) {
        const errors =
          result.error?.issues?.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })) || [];

        const firstError = errors[0];
        const errorMessage = firstError ? firstError.message : 'Validation Error';

        res.status(400).json({
          error: errorMessage,
          details: errors,
        });
        return;
      }

      try {
        req.params = result.data as unknown as typeof req.params;
      } catch (e) {
        // Fallback for cases where req.params has only a getter
        Object.defineProperty(req, 'params', {
          value: result.data,
          writable: true,
          configurable: true,
        });
      }
      next();
    } catch (error: any) {
      logger.error('Validation Middleware Error:', error);
      res.status(500).json({ error: 'Internal Server Error during validation' });
    }
  };
};
