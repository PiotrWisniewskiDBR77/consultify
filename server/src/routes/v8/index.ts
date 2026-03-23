import { Router } from 'express';

import featureFlagRoutes from './admin/feature-flags.routes.js';
import healthRoutes from './health.routes.js';

const v8Router = Router();

v8Router.use('/health', healthRoutes);
v8Router.use('/admin/flags', featureFlagRoutes);

export default v8Router;
