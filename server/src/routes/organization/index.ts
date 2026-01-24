/**
 * Organization Routes Index
 * Aggregates all organization-related routes
 */

import { Router } from 'express';

import approvedDomainsRoutes from './approved-domains.routes.js';
import brandingRoutes from './branding.routes.js';
import invitationsRoutes from './invitations.routes.js';
import organizationDataRoutes from './organization-data.routes.js';
import organizationLimitsRoutes from './organization-limits.routes.js';
import organizationProfilesRoutes from './organization-profiles.routes.js';
import organizationsRoutes from './organizations.routes.js';
import ownershipRoutes from './ownership.routes.js';
import partnerCodeRoutes from './partner-code.routes.js';
import rbacRoutes from './rbac.routes.js';
import teamsRoutes from './teams.routes.js';

const router = Router();

// Mount all organization sub-routes
router.use('/branding', brandingRoutes);
router.use('/invitations', invitationsRoutes);
router.use('/data', organizationDataRoutes);
router.use('/limits', organizationLimitsRoutes);
router.use('/profiles', organizationProfilesRoutes);
router.use('/rbac', rbacRoutes);
router.use('/teams', teamsRoutes);
// Partner code routes (mounted at root level)
router.use('/', partnerCodeRoutes);
// Routes mounted at root level for /organizations/:orgId/* paths
router.use('/', approvedDomainsRoutes);
router.use('/', ownershipRoutes);
router.use('/', organizationsRoutes);

export default router;
