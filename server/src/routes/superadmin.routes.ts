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

import { Router, Response } from 'express';
import { verifySuperAdmin as requireSuperAdmin } from '../middleware/superAdmin.middleware.js';
import { validateBody, validateParams } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import SuperAdminController from '../controllers/SuperAdminController.js';
import {
    UpdateOrganizationAdminSchema,
    CreateUserAdminSchema,
    UpdateUserAdminSchema,
    ImpersonateUserSchema,
    CreateAccessCodeSchema,
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
router.post('/users/invite', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.inviteUser(req, res);
}));
router.post('/users/:id/reset-password', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.resetUserPassword(req, res);
}));

// ==========================================
// ACCESS REQUESTS
// ==========================================

router.get('/access-requests', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getAccessRequests(req, res);
}));
router.post('/access-requests/:id/approve', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.approveAccessRequest(req, res);
}));
router.post('/access-requests/:id/reject', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.rejectAccessRequest(req, res);
}));

// ==========================================
// ACCESS CODES
// ==========================================

router.get('/access-codes', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getAccessCodes(req, res);
}));
router.post('/access-codes', validateBody(CreateAccessCodeSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.createAccessCode(req, res);
}));

// ==========================================
// IMPERSONATION
// ==========================================

router.post('/impersonate', validateBody(ImpersonateUserSchema), SuperAdminController.impersonateUser);

// ==========================================
// DATABASE EXPLORER
// ==========================================

router.get('/database/tables', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getDatabaseTables(req, res);
}));
router.get('/database/rows/:tableName', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getDatabaseRows(req, res);
}));

// ==========================================
// STORAGE
// ==========================================

router.get('/storage/usage', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getStorageUsage(req, res);
}));
router.get('/storage/files/:orgId', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getStorageFiles(req, res);
}));
router.delete('/storage/files', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.deleteStorageFile(req, res);
}));

// ==========================================
// LEGAL DOCUMENT MANAGEMENT
// ==========================================

router.get('/legal/all', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getAllLegalDocs(req, res);
}));
router.post('/legal/publish', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.publishLegalDoc(req, res);
}));
router.put('/legal/:id/toggle-active', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.toggleLegalDocActive(req, res);
}));
router.get('/legal/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getLegalDocById(req, res);
}));

// ==========================================
// LEGAL EVENTS AUDIT LOG
// ==========================================

router.get('/legal-events', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getLegalEvents(req, res);
}));
router.get('/legal-events/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getLegalEventStats(req, res);
}));

// ==========================================
// ATTRIBUTION SYSTEM
// ==========================================

router.get('/organizations/:id/attribution', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getOrgAttribution(req, res);
}));
router.get('/attribution/export', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.exportAttribution(req, res);
}));
router.get('/attribution/partner-summary', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getPartnerSummary(req, res);
}));

// ==========================================
// USAGE STATS BY ORGANIZATION
// ==========================================

router.get('/usage/by-organization', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getUsageByOrganization(req, res);
}));

// ==========================================
// INVOICES
// ==========================================

router.get('/invoices', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getInvoices(req, res);
}));
router.get('/invoices/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getInvoiceStats(req, res);
}));
router.post('/invoices/:id/remind', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.remindInvoice(req, res);
}));
router.post('/invoices/:id/mark-paid', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.markInvoicePaid(req, res);
}));
router.get('/invoices/:id/pdf', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getInvoicePdf(req, res);
}));

// ==========================================
// BRANDING
// ==========================================

router.post('/branding/:orgId/logo', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.uploadBrandingLogo(req, res);
}));

// ==========================================
// API KEYS
// ==========================================

router.get('/api-keys', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getApiKeys(req, res);
}));
router.post('/api-keys', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.createApiKey(req, res);
}));
router.delete('/api-keys/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.deleteApiKey(req, res);
}));
router.get('/api-keys/:id/usage', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getApiKeyUsage(req, res);
}));

// ==========================================
// COMPLIANCE
// ==========================================

router.get('/compliance/frameworks', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getComplianceFrameworks(req, res);
}));
router.get('/compliance/status/:frameworkId', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getComplianceStatus(req, res);
}));
router.get('/compliance/dsar', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getDsarRequests(req, res);
}));
router.get('/compliance/audits', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getComplianceAudits(req, res);
}));

// ==========================================
// SYSTEM HEALTH
// ==========================================

router.get('/system-health', SuperAdminController.getSystemHealth);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Organizations
// ==========================================

router.get('/organizations/:id/metadata', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getOrganizationMetadata(req, res);
}));
router.put('/organizations/:id/metadata', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.updateOrganizationMetadata(req, res);
}));
router.get('/organizations/:id/tags', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getOrganizationTags(req, res);
}));
router.post('/organizations/:id/tags', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.addOrganizationTag(req, res);
}));
router.delete('/organizations/:id/tags/:tagId', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.removeOrganizationTag(req, res);
}));
router.get('/organizations/:id/health', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getOrganizationHealth(req, res);
}));
router.get('/organizations/:id/relationships', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getOrganizationRelationships(req, res);
}));
router.get('/organizations/:id/analytics', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getOrganizationAnalytics(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Users
// ==========================================

router.get('/users/:id/profile-extended', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getUserProfileExtended(req, res);
}));
router.put('/users/:id/profile-extended', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.updateUserProfileExtended(req, res);
}));
router.get('/users/:id/activity', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getUserActivity(req, res);
}));
router.get('/users/:id/sessions', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getUserSessions(req, res);
}));
router.delete('/users/:id/sessions/:sessionId', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.revokeUserSession(req, res);
}));
router.get('/users/:id/groups', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getUserGroups(req, res);
}));
router.get('/users/:id/onboarding', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getUserOnboardingProgress(req, res);
}));
router.put('/users/:id/onboarding', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.updateUserOnboardingProgress(req, res);
}));
router.get('/users/:id/license', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getUserLicense(req, res);
}));
router.put('/users/:id/license', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.assignUserLicense(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Security
// ==========================================

router.get('/organizations/:id/ip-whitelist', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getIPWhitelist(req, res);
}));
router.post('/organizations/:id/ip-whitelist', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.addIPWhitelist(req, res);
}));
router.delete('/ip-whitelist/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.removeIPWhitelist(req, res);
}));
router.get('/users/:id/devices', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getUserDevices(req, res);
}));
router.post('/devices/:id/block', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.blockDevice(req, res);
}));
router.get('/users/:id/mfa', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getMFAMethods(req, res);
}));
router.post('/users/:id/mfa/totp/setup', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.setupTOTP(req, res);
}));
router.post('/users/:id/mfa/totp/verify', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.verifyTOTP(req, res);
}));
router.get('/organizations/:id/password-policy', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getPasswordPolicy(req, res);
}));
router.put('/organizations/:id/password-policy', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.updatePasswordPolicy(req, res);
}));
router.get('/security-events', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getSecurityEvents(req, res);
}));
router.post('/security-events/:id/resolve', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.resolveSecurityEvent(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Support
// ==========================================

router.get('/support/tickets', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getSupportTickets(req, res);
}));
router.post('/support/tickets', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.createSupportTicket(req, res);
}));
router.put('/support/tickets/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.updateSupportTicket(req, res);
}));
router.post('/support/tickets/:id/comments', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.addTicketComment(req, res);
}));
router.get('/organizations/:id/customer-success/notes', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getCustomerSuccessNotes(req, res);
}));
router.post('/organizations/:id/customer-success/notes', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.createCustomerSuccessNote(req, res);
}));
router.get('/organizations/:id/customer-success/health', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getCustomerHealthCheck(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Feedback
// ==========================================

router.get('/feedback', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getFeedbackItems(req, res);
}));
router.post('/feedback', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.createFeedbackItem(req, res);
}));
router.post('/feedback/:id/vote', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.voteFeedback(req, res);
}));
router.post('/feedback/:id/comments', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.addFeedbackComment(req, res);
}));
router.get('/feature-roadmap', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getFeatureRoadmap(req, res);
}));
router.put('/feature-roadmap/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.updateFeatureRoadmap(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Analytics
// ==========================================

router.get('/users/:id/adoption-metrics', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getUserAdoptionMetrics(req, res);
}));
router.get('/organizations/:id/churn-prediction', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getChurnPrediction(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Compliance
// ==========================================

router.get('/compliance/retention-policies', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getDataRetentionPolicies(req, res);
}));
router.post('/compliance/retention-policies', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.createDataRetentionPolicy(req, res);
}));
router.get('/compliance/gdpr-requests', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getGDPRRequests(req, res);
}));
router.post('/compliance/gdpr-requests', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.createGDPRRequest(req, res);
}));
router.get('/users/:id/consents', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getUserConsents(req, res);
}));
router.put('/users/:id/consents', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.updateUserConsent(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Automation
// ==========================================

router.get('/automation/rules', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getAutomationRules(req, res);
}));
router.post('/automation/rules', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.createAutomationRule(req, res);
}));
router.put('/automation/rules/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.updateAutomationRule(req, res);
}));
router.get('/webhooks', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getWebhookSubscriptions(req, res);
}));
router.post('/webhooks', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.createWebhookSubscription(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Communication
// ==========================================

router.get('/email/templates', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getEmailTemplates(req, res);
}));
router.post('/email/templates', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.createEmailTemplate(req, res);
}));
router.get('/email/campaigns', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getEmailCampaigns(req, res);
}));
router.post('/email/campaigns', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.createEmailCampaign(req, res);
}));
router.get('/users/:id/notification-preferences', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.getNotificationPreferences(req, res);
}));
router.put('/users/:id/notification-preferences', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.updateNotificationPreferences(req, res);
}));

// ==========================================
// REFRESH TOKEN
// ==========================================

router.post('/refresh-token', asyncHandler(async (req: AuthRequest, res: Response) => {
    await SuperAdminController.refreshToken(req, res);
}));

export default router;
