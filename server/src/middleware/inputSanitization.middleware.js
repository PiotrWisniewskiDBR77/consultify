/**
 * Input sanitization middleware (no-op fallback).
 * Keeps API behavior stable in test environments.
 */
export const inputSanitizationMiddleware = (_req, _res, next) => next();

export default inputSanitizationMiddleware;
