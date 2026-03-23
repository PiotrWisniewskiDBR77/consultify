import { Router } from 'express';

import healthRoutes from './health.routes.js';

const v8Router = Router();

v8Router.use('/health', healthRoutes);

export default v8Router;
