/**
 * User Routes Index
 * Aggregates all user-related routes
 */

import { Router } from 'express';

import loginHistoryRoutes from './loginHistory.routes.js';
import preferencesRoutes from './preferences.routes.js';
import sessionsRoutes from './sessions.routes.js';
import userAppearanceRoutes from './user-appearance.routes.js';
import userAvailabilityRoutes from './user-availability.routes.js';
import userContactRoutes from './user-contact.routes.js';
import userDataControlsRoutes from './user-data-controls.routes.js';
import userKeyboardShortcutsRoutes from './user-keyboard-shortcuts.routes.js';
import userPrivacyExtendedRoutes from './user-privacy-extended.routes.js';
import userProfessionalProfileRoutes from './user-professional-profile.routes.js';
import userProfileCompletenessRoutes from './user-profile-completeness.routes.js';
import userProfileExtendedRoutes from './user-profile-extended.routes.js';
import userSecurityAdvancedRoutes from './user-security-advanced.routes.js';
import userSettingsHistoryRoutes from './user-settings-history.routes.js';
import userSettingsTemplatesRoutes from './user-settings-templates.routes.js';
import userGoalsRoutes from './userGoals.routes.js';
import userIntegrationsRoutes from './userIntegrations.routes.js';
import userOrgsRoutes from './userOrgs.routes.js';
import usersRoutes from './users.routes.js';

const router = Router();

// Mount all user sub-routes
router.use('/login-history', loginHistoryRoutes);
router.use('/preferences', preferencesRoutes);
router.use('/sessions', sessionsRoutes);
router.use('/appearance', userAppearanceRoutes);
router.use('/availability', userAvailabilityRoutes);
router.use('/contact', userContactRoutes);
router.use('/data-controls', userDataControlsRoutes);
router.use('/keyboard-shortcuts', userKeyboardShortcutsRoutes);
router.use('/privacy', userPrivacyExtendedRoutes);
router.use('/professional-profile', userProfessionalProfileRoutes);
router.use('/profile-completeness', userProfileCompletenessRoutes);
router.use('/profile-extended', userProfileExtendedRoutes);
router.use('/security-advanced', userSecurityAdvancedRoutes);
router.use('/settings-history', userSettingsHistoryRoutes);
router.use('/settings-templates', userSettingsTemplatesRoutes);
router.use('/goals', userGoalsRoutes);
router.use('/integrations', userIntegrationsRoutes);
router.use('/orgs', userOrgsRoutes);
router.use('/', usersRoutes);

export default router;


