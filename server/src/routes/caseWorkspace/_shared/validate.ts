/**
 * Case Workspace routes — zod validation helpers.
 *
 * Thin wrappers that turn a `ZodError` into the same `AppError` shape
 * (400 VALIDATION_ERROR) every other route file in this codebase uses (see
 * server/src/utils/ErrorHandler.ts's `validationError`), so a case-workspace
 * 400 response looks identical to any other router's 400 response. Called
 * directly inside a `caseWorkspaceHandler` body — throwing here is caught by
 * that wrapper exactly like a domain-service error.
 */

import type { ZodType, z } from 'zod';

import { AppError } from '../../../utils/ErrorHandler.js';

function formatIssues(error: z.ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
}

export function parseBody<T extends ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new AppError('Request body failed validation.', 400, 'VALIDATION_ERROR', formatIssues(result.error));
  }
  return result.data;
}

export function parseQuery<T extends ZodType>(schema: T, query: unknown): z.infer<T> {
  const result = schema.safeParse(query ?? {});
  if (!result.success) {
    throw new AppError('Query parameters failed validation.', 400, 'VALIDATION_ERROR', formatIssues(result.error));
  }
  return result.data;
}

export function parseParams<T extends ZodType>(schema: T, params: unknown): z.infer<T> {
  const result = schema.safeParse(params ?? {});
  if (!result.success) {
    throw new AppError('Route parameters failed validation.', 400, 'VALIDATION_ERROR', formatIssues(result.error));
  }
  return result.data;
}
