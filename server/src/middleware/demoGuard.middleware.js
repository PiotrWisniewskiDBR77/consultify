/**
 * Demo guard middleware (no-op fallback for tests).
 */
export const DEMO_ORG_ID = 'demo-org';
export const DEMO_ORG_NAME = 'Demo Organization';

export const demoContextMiddleware = (_req, _res, next) => next();
export const demoWriteProtection = (_options = {}) => (_req, _res, next) => next();
export const demoGuard = demoContextMiddleware;

export const checkUserDemoPreference = async (_userId) => false;

export const setUserDemoPreference = async (_userId, _enabled) => {};

export const getDemoOrganization = async () => ({
  id: DEMO_ORG_ID,
  name: DEMO_ORG_NAME,
  slug: 'demo-org',
  description: 'Demo organization',
  settings: {},
});

export const getDemoStats = async () => ({
  initiatives: 0,
  tasks: 0,
  decisions: 0,
  users: 0,
});

export default demoContextMiddleware;
