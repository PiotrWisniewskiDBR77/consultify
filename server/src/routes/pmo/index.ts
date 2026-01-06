/**
 * PMO Routes Index
 * Aggregates all PMO (Project Management Office) related routes
 */

import { Router } from 'express';

import capacityRoutes from './capacity.routes.js';
import decisionsRoutes from './decisions.routes.js';
import executionRoutes from './execution.routes.js';
import governanceRoutes from './governance.routes.js';
import initiativesRoutes from './initiatives.routes.js';
import pmoAnalysisRoutes from './pmo-analysis.routes.js';
import pmoContextRoutes from './pmo-context.routes.js';
import pmoRoutes from './pmo.routes.js';
import pmoDomainsRoutes from './pmoDomains.routes.js';
import pmoRolesRoutes from './pmoRoles.routes.js';
import projectMembersRoutes from './project-members.routes.js';
import projectsRoutes from './projects.routes.js';
import roadmapRoutes from './roadmap.routes.js';
import stageGatesRoutes from './stage-gates.routes.js';
import tasksRoutes from './tasks.routes.js';
import workstreamsRoutes from './workstreams.routes.js';

const router = Router();

// Mount all PMO sub-routes
router.use('/capacity', capacityRoutes);
router.use('/decisions', decisionsRoutes);
router.use('/execution', executionRoutes);
router.use('/governance', governanceRoutes);
router.use('/initiatives', initiativesRoutes);
router.use('/analysis', pmoAnalysisRoutes);
router.use('/context', pmoContextRoutes);
router.use('/domains', pmoDomainsRoutes);
router.use('/roles', pmoRolesRoutes);
router.use('/project-members', projectMembersRoutes);
router.use('/projects', projectsRoutes);
router.use('/roadmap', roadmapRoutes);
router.use('/stage-gates', stageGatesRoutes);
router.use('/tasks', tasksRoutes);
router.use('/workstreams', workstreamsRoutes);
router.use('/', pmoRoutes);

export default router;


