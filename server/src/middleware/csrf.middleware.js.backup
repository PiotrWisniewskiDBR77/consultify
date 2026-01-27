/**
 * CSRF middleware (no-op fallback for tests).
 */
export const csrfTokenMiddleware = (_req, _res, next) => next();

export const getCsrfTokenHandler = (_req, res) => {
  res.json({ token: 'test-csrf-token' });
};

export default csrfTokenMiddleware;
