/**
 * Super Admin Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All super admin API endpoints (requires SUPERADMIN role)
 *
 * Note: This route file uses wrappers to the existing JS controller
 * for backward compatibility during migration. Full TypeScript migration
 * of the controller logic will be done in subsequent stages.
 */

import { Response, Router } from 'express';

import SuperAdminController from '../controllers/SuperAdminController.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifySuperAdmin as requireSuperAdmin } from '../middleware/superAdmin.middleware.js';
import { validateParams, validateBody } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
    CreateAccessCodeSchema,
    CreateUserAdminSchema,
    ImpersonateUserSchema,
    UpdateOrganizationAdminSchema,
    UpdateUserAdminSchema,
} from '../validators/admin.validators.js';

const router = Router();
// Note: SuperAdminController is imported as SuperAdminController above
// Legacy require removed - using SuperAdminController import instead

// Apply super admin middleware to all routes
router.use(requireSuperAdmin);

// ==========================================
// ORGANIZATIONS
// ==========================================

router.get('/organizations', SuperAdminController.getOrganizations);
router.get('/activities', SuperAdminController.getActivities);
router.get('/activities/stats', SuperAdminController.getActivities);
router.get('/dashboard', SuperAdminController.getDashboardStats);
router.put('/organizations/:id', validateBody(UpdateOrganizationAdminSchema), SuperAdminController.updateOrganization);
router.delete('/organizations/:id', SuperAdminController.deleteOrganization);
router.get('/organizations/:id/billing', SuperAdminController.getOrgBilling);

// ==========================================
// USERS
// ==========================================

router.get('/users', SuperAdminController.getUsers);
router.put('/users/:id', validateBody(UpdateUserAdminSchema), SuperAdminController.updateUser);
router.post('/users', validateBody(CreateUserAdminSchema), SuperAdminController.createUser);
router.post(
    '/users/invite',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).inviteUser(req, res);
    }),
);
router.post(
    '/users/:id/reset-password',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).resetUserPassword(req, res);
    }),
);

// ==========================================
// ACCESS REQUESTS
// ==========================================

router.get(
    '/access-requests',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getAccessRequests(req, res);
    }),
);
router.post(
    '/access-requests/:id/approve',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).approveAccessRequest(req, res);
    }),
);
router.post(
    '/access-requests/:id/reject',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).rejectAccessRequest(req, res);
    }),
);

// ==========================================
// ACCESS CODES
// ==========================================

router.get(
    '/access-codes',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getAccessCodes(req, res);
    }),
);
router.post(
    '/access-codes',
    validateBody(CreateAccessCodeSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).createAccessCode(req, res);
    }),
);

// ==========================================
// IMPERSONATION
// ==========================================

router.post('/impersonate', validateBody(ImpersonateUserSchema), SuperAdminController.impersonateUser);

// ==========================================
// DATABASE EXPLORER
// ==========================================

router.get(
    '/database/tables',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getDatabaseTables(req, res);
    }),
);
router.get(
    '/database/rows/:tableName',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getDatabaseRows(req, res);
    }),
);

// ==========================================
// STORAGE
// ==========================================

router.get(
    '/storage/usage',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getStorageUsage(req, res);
    }),
);
router.get(
    '/storage/files/:orgId',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getStorageFiles(req, res);
    }),
);
router.delete(
    '/storage/files',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).deleteStorageFile(req, res);
    }),
);

// ==========================================
// LEGAL DOCUMENT MANAGEMENT
// ==========================================

router.get(
    '/legal/all',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getAllLegalDocs(req, res);
    }),
);
router.post(
    '/legal/publish',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).publishLegalDoc(req, res);
    }),
);
router.put(
    '/legal/:id/toggle-active',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).toggleLegalDocActive(req, res);
    }),
);
router.get(
    '/legal/:id',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getLegalDocById(req, res);
    }),
);

// ==========================================
// LEGAL EVENTS AUDIT LOG
// ==========================================

router.get(
    '/legal-events',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getLegalEvents(req, res);
    }),
);
router.get(
    '/legal-events/stats',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getLegalEventStats(req, res);
    }),
);

// ==========================================
// ATTRIBUTION SYSTEM
// ==========================================

router.get(
    '/organizations/:id/attribution',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getOrgAttribution(req, res);
    }),
);
router.get(
    '/attribution/export',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).exportAttribution(req, res);
    }),
);
router.get(
    '/attribution/partner-summary',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getPartnerSummary(req, res);
    }),
);

// ==========================================
// USAGE STATS BY ORGANIZATION
// ==========================================

router.get(
    '/usage/by-organization',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getUsageByOrganization(req, res);
    }),
);

// ==========================================
// INVOICES
// ==========================================

router.get(
    '/invoices',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getInvoices(req, res);
    }),
);
router.get(
    '/invoices/stats',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getInvoiceStats(req, res);
    }),
);
router.post(
    '/invoices/:id/remind',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).remindInvoice(req, res);
    }),
);
router.post(
    '/invoices/:id/mark-paid',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).markInvoicePaid(req, res);
    }),
);
router.get(
    '/invoices/:id/pdf',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getInvoicePdf(req, res);
    }),
);

// ==========================================
// BRANDING
// ==========================================

router.post(
    '/branding/:orgId/logo',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).uploadBrandingLogo(req, res);
    }),
);

// ==========================================
// API KEYS
// ==========================================

router.get(
    '/api-keys',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getApiKeys(req, res);
    }),
);
router.post(
    '/api-keys',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).createApiKey(req, res);
    }),
);
router.delete(
    '/api-keys/:id',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).deleteApiKey(req, res);
    }),
);
router.get(
    '/api-keys/:id/usage',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getApiKeyUsage(req, res);
    }),
);

// ==========================================
// COMPLIANCE
// ==========================================

router.get(
    '/compliance/frameworks',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getComplianceFrameworks(req, res);
    }),
);
router.get(
    '/compliance/status/:frameworkId',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getComplianceStatus(req, res);
    }),
);
router.get(
    '/compliance/dsar',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getDsarRequests(req, res);
    }),
);
router.get(
    '/compliance/audits',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getComplianceAudits(req, res);
    }),
);

// ==========================================
// SYSTEM HEALTH
// ==========================================

router.get('/system-health', SuperAdminController.getSystemHealth);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Organizations
// ==========================================

router.get(
    '/organizations/:id/metadata',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getOrganizationMetadata(req, res);
    }),
);
router.put(
    '/organizations/:id/metadata',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).updateOrganizationMetadata(req, res);
    }),
);
router.get(
    '/organizations/:id/tags',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getOrganizationTags(req, res);
    }),
);
router.post(
    '/organizations/:id/tags',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).addOrganizationTag(req, res);
    }),
);
router.delete(
    '/organizations/:id/tags/:tagId',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).removeOrganizationTag(req, res);
    }),
);
router.get(
    '/organizations/:id/health',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getOrganizationHealth(req, res);
    }),
);
router.get(
    '/organizations/:id/relationships',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getOrganizationRelationships(req, res);
    }),
);
router.get(
    '/organizations/:id/analytics',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getOrganizationAnalytics(req, res);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Users
// ==========================================

router.get(
    '/users/:id/profile-extended',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getUserProfileExtended(req, res);
    }),
);
router.put(
    '/users/:id/profile-extended',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).updateUserProfileExtended(req, res);
    }),
);
router.get(
    '/users/:id/activity',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getUserActivity(req, res);
    }),
);
router.get(
    '/users/:id/sessions',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getUserSessions(req, res);
    }),
);
router.delete(
    '/users/:id/sessions/:sessionId',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).revokeUserSession(req, res);
    }),
);
router.get(
    '/users/:id/groups',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getUserGroups(req, res);
    }),
);
router.get(
    '/users/:id/onboarding',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getUserOnboardingProgress(req, res);
    }),
);
router.put(
    '/users/:id/onboarding',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).updateUserOnboardingProgress(req, res);
    }),
);
router.get(
    '/users/:id/license',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getUserLicense(req, res);
    }),
);
router.put(
    '/users/:id/license',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).assignUserLicense(req, res);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Security
// ==========================================

router.get(
    '/organizations/:id/ip-whitelist',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getIPWhitelist(req, res);
    }),
);
router.post(
    '/organizations/:id/ip-whitelist',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).addIPWhitelist(req, res);
    }),
);
router.delete(
    '/ip-whitelist/:id',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).removeIPWhitelist(req, res);
    }),
);
router.get(
    '/users/:id/devices',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getUserDevices(req, res);
    }),
);
router.post(
    '/devices/:id/block',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).blockDevice(req, res);
    }),
);
router.get(
    '/users/:id/mfa',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getMFAMethods(req, res);
    }),
);
router.post(
    '/users/:id/mfa/totp/setup',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).setupTOTP(req, res);
    }),
);
router.post(
    '/users/:id/mfa/totp/verify',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).verifyTOTP(req, res);
    }),
);
router.get(
    '/organizations/:id/password-policy',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getPasswordPolicy(req, res);
    }),
);
router.put(
    '/organizations/:id/password-policy',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).updatePasswordPolicy(req, res);
    }),
);
router.get(
    '/security-events',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getSecurityEvents(req, res);
    }),
);
router.post(
    '/security-events/:id/resolve',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).resolveSecurityEvent(req, res);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Support
// ==========================================

router.get(
    '/support/tickets',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getSupportTickets(req, res);
    }),
);
router.post(
    '/support/tickets',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).createSupportTicket(req, res);
    }),
);
router.put(
    '/support/tickets/:id',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).updateSupportTicket(req, res);
    }),
);
router.post(
    '/support/tickets/:id/comments',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).addTicketComment(req, res);
    }),
);
router.get(
    '/organizations/:id/customer-success/notes',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getCustomerSuccessNotes(req, res);
    }),
);
router.post(
    '/organizations/:id/customer-success/notes',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).createCustomerSuccessNote(req, res);
    }),
);
router.get(
    '/organizations/:id/customer-success/health',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getCustomerHealthCheck(req, res);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Feedback
// ==========================================

router.get(
    '/feedback',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getFeedbackItems(req, res);
    }),
);
router.post(
    '/feedback',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).createFeedbackItem(req, res);
    }),
);
router.post(
    '/feedback/:id/vote',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).voteFeedback(req, res);
    }),
);
router.post(
    '/feedback/:id/comments',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).addFeedbackComment(req, res);
    }),
);
router.get(
    '/feature-roadmap',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getFeatureRoadmap(req, res);
    }),
);
router.put(
    '/feature-roadmap/:id',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).updateFeatureRoadmap(req, res);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Analytics
// ==========================================

router.get(
    '/users/:id/adoption-metrics',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getUserAdoptionMetrics(req, res);
    }),
);
router.get(
    '/organizations/:id/churn-prediction',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getChurnPrediction(req, res);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Compliance
// ==========================================

router.get(
    '/compliance/retention-policies',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getDataRetentionPolicies(req, res);
    }),
);
router.post(
    '/compliance/retention-policies',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).createDataRetentionPolicy(req, res);
    }),
);
router.get(
    '/compliance/gdpr-requests',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getGDPRRequests(req, res);
    }),
);
router.post(
    '/compliance/gdpr-requests',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).createGDPRRequest(req, res);
    }),
);
router.get(
    '/users/:id/consents',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getUserConsents(req, res);
    }),
);
router.put(
    '/users/:id/consents',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).updateUserConsent(req, res);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Automation
// ==========================================

router.get(
    '/automation/rules',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getAutomationRules(req, res);
    }),
);
router.post(
    '/automation/rules',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).createAutomationRule(req, res);
    }),
);
router.put(
    '/automation/rules/:id',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).updateAutomationRule(req, res);
    }),
);
router.get(
    '/webhooks',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getWebhookSubscriptions(req, res);
    }),
);
router.post(
    '/webhooks',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).createWebhookSubscription(req, res);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Communication
// ==========================================

router.get(
    '/email/templates',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getEmailTemplates(req, res);
    }),
);
router.post(
    '/email/templates',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).createEmailTemplate(req, res);
    }),
);
router.get(
    '/email/campaigns',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getEmailCampaigns(req, res);
    }),
);
router.post(
    '/email/campaigns',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).createEmailCampaign(req, res);
    }),
);
router.get(
    '/users/:id/notification-preferences',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).getNotificationPreferences(req, res);
    }),
);
router.put(
    '/users/:id/notification-preferences',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).updateNotificationPreferences(req, res);
    }),
);

// ==========================================
// REFRESH TOKEN
// ==========================================

router.post(
    '/refresh-token',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        await (SuperAdminController as any).refreshToken(req, res);
    }),
);

export default router;
