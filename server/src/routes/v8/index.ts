import { Router } from 'express';

import verifyToken from '../../middleware/auth.middleware.js';
import { requireV8OrgContext, attachV8Context } from '../../middleware/v8Auth.middleware.js';
import { v8OrgGate } from '../../middleware/v8FeatureGate.middleware.js';
import { v8MetricsMiddleware } from '../../middleware/v8Metrics.middleware.js';
import featureFlagRoutes from './admin/feature-flags.routes.js';
import adminHealthRoutes from './admin/health.routes.js';
import adminMetricsRoutes from './admin/metrics.routes.js';
import shadowRoutes from './admin/shadow.routes.js';
import aiCoreRoutes from './ai-core.routes.js';
import chatRoutes from './chat.routes.js';
import healthRoutes from './health.routes.js';

const v8Router = Router();

v8Router.use(verifyToken);
v8Router.use(requireV8OrgContext);
v8Router.use(v8OrgGate);
v8Router.use(attachV8Context);
v8Router.use(v8MetricsMiddleware);

v8Router.use('/health', healthRoutes);
v8Router.use('/admin/flags', featureFlagRoutes);
v8Router.use('/admin/health', adminHealthRoutes);
v8Router.use('/admin/metrics', adminMetricsRoutes);
v8Router.use('/admin/shadow', shadowRoutes);
v8Router.use('/chat', chatRoutes);
v8Router.use('/ai-core', aiCoreRoutes);

export default v8Router;
