import { Router } from 'express';

import verifyToken from '../../middleware/auth.middleware.js';
import { requireV8OrgContext, attachV8Context } from '../../middleware/v8Auth.middleware.js';
import featureFlagRoutes from './admin/feature-flags.routes.js';
import healthRoutes from './health.routes.js';

const v8Router = Router();

v8Router.use(verifyToken);
v8Router.use(requireV8OrgContext);
v8Router.use(attachV8Context);

v8Router.use('/health', healthRoutes);
v8Router.use('/admin/flags', featureFlagRoutes);

export default v8Router;
