/**
 * Parameter Helper Utilities
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Helper functions for handling Express request parameters
 */

/**
 * Safely extract a string parameter from req.params or req.query
 * Handles both string and string[] types
 */
export function getStringParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Safely extract a required string parameter from req.params or req.query
 * Throws if missing or empty
 */
export function getRequiredStringParam(
  value: string | string[] | undefined,
  paramName: string
): string {
  const result = getStringParam(value);
  if (!result) {
    throw new Error(`Missing required parameter: ${paramName}`);
  }
  return result;
}

type RequestParameterSource = {
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

/**
 * Read a scalar route or query parameter without leaking Express' array type
 * into route handlers. Route parameters take precedence over query values.
 */
export function queryString(req: RequestParameterSource, key: string): string {
  const raw = req.params?.[key] ?? req.query?.[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value : '';
}
