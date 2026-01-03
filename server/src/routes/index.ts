/**
 * Routes Index
 * Central export point for all route modules
 * 
 * During migration, routes will be imported and exported here
 */

// Migrated TypeScript routes
import authRoutes from './auth.routes';
import billingRoutes from './billing.routes';
import aiRoutes from './ai.routes';
import projectsRoutes from './projects.routes';

// Export routes
export {
    authRoutes,
    billingRoutes,
    aiRoutes,
    projectsRoutes
};

// Default export for backward compatibility
export default {
    auth: authRoutes,
    billing: billingRoutes,
    ai: aiRoutes,
    projects: projectsRoutes
};

