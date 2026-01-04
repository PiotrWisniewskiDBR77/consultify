/**
 * Routes Index
 * Central export point for all route modules
 *
 * During migration, routes will be imported and exported here
 */

// Migrated TypeScript routes
import aiRoutes from './ai.routes.js';
import authRoutes from './auth.routes.js';
import billingRoutes from './billing.routes.js';
import projectsRoutes from './projects.routes.js';

// Export routes
export { aiRoutes, authRoutes, billingRoutes, projectsRoutes };

// Default export for backward compatibility
export default {
    auth: authRoutes,
    billing: billingRoutes,
    ai: aiRoutes,
    projects: projectsRoutes,
};
