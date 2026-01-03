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
import { requireSuperAdmin } from '../middleware/superAdmin.middleware.js';
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
const superAdminController = require('../../controllers/superAdminController');

// Apply super admin middleware to all routes
router.use(requireSuperAdmin);

// ==========================================
// ORGANIZATIONS
// ==========================================

router.get('/organizations', SuperAdminController.getOrganizations);
router.get('/activities', superAdminController.getActivities);
router.get('/activities/stats', superAdminController.getActivities);
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
    await superAdminController.inviteUser(req, res);
}));
router.post('/users/:id/reset-password', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.resetUserPassword(req, res);
}));

// ==========================================
// ACCESS REQUESTS
// ==========================================

router.get('/access-requests', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getAccessRequests(req, res);
}));
router.post('/access-requests/:id/approve', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.approveAccessRequest(req, res);
}));
router.post('/access-requests/:id/reject', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.rejectAccessRequest(req, res);
}));

// ==========================================
// ACCESS CODES
// ==========================================

router.get('/access-codes', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getAccessCodes(req, res);
}));
router.post('/access-codes', validateBody(CreateAccessCodeSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.createAccessCode(req, res);
}));

// ==========================================
// IMPERSONATION
// ==========================================

router.post('/impersonate', validateBody(ImpersonateUserSchema), SuperAdminController.impersonateUser);

// ==========================================
// DATABASE EXPLORER
// ==========================================

router.get('/database/tables', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getDatabaseTables(req, res);
}));
router.get('/database/rows/:tableName', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getDatabaseRows(req, res);
}));

// ==========================================
// STORAGE
// ==========================================

router.get('/storage/usage', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getStorageUsage(req, res);
}));
router.get('/storage/files/:orgId', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getStorageFiles(req, res);
}));
router.delete('/storage/files', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.deleteStorageFile(req, res);
}));

// ==========================================
// LEGAL DOCUMENT MANAGEMENT
// ==========================================

router.get('/legal/all', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getAllLegalDocs(req, res);
}));
router.post('/legal/publish', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.publishLegalDoc(req, res);
}));
router.put('/legal/:id/toggle-active', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.toggleLegalDocActive(req, res);
}));
router.get('/legal/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getLegalDocById(req, res);
}));

// ==========================================
// LEGAL EVENTS AUDIT LOG
// ==========================================

router.get('/legal-events', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getLegalEvents(req, res);
}));
router.get('/legal-events/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getLegalEventStats(req, res);
}));

// ==========================================
// ATTRIBUTION SYSTEM
// ==========================================

router.get('/organizations/:id/attribution', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getOrgAttribution(req, res);
}));
router.get('/attribution/export', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.exportAttribution(req, res);
}));
router.get('/attribution/partner-summary', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getPartnerSummary(req, res);
}));

// ==========================================
// USAGE STATS BY ORGANIZATION
// ==========================================

router.get('/usage/by-organization', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getUsageByOrganization(req, res);
}));

// ==========================================
// INVOICES
// ==========================================

router.get('/invoices', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getInvoices(req, res);
}));
router.get('/invoices/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getInvoiceStats(req, res);
}));
router.post('/invoices/:id/remind', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.remindInvoice(req, res);
}));
router.post('/invoices/:id/mark-paid', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.markInvoicePaid(req, res);
}));
router.get('/invoices/:id/pdf', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getInvoicePdf(req, res);
}));

// ==========================================
// BRANDING
// ==========================================

router.post('/branding/:orgId/logo', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.uploadBrandingLogo(req, res);
}));

// ==========================================
// API KEYS
// ==========================================

router.get('/api-keys', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getApiKeys(req, res);
}));
router.post('/api-keys', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.createApiKey(req, res);
}));
router.delete('/api-keys/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.deleteApiKey(req, res);
}));
router.get('/api-keys/:id/usage', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getApiKeyUsage(req, res);
}));

// ==========================================
// COMPLIANCE
// ==========================================

router.get('/compliance/frameworks', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getComplianceFrameworks(req, res);
}));
router.get('/compliance/status/:frameworkId', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getComplianceStatus(req, res);
}));
router.get('/compliance/dsar', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getDsarRequests(req, res);
}));
router.get('/compliance/audits', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getComplianceAudits(req, res);
}));

// ==========================================
// SYSTEM HEALTH
// ==========================================

router.get('/system-health', SuperAdminController.getSystemHealth);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Organizations
// ==========================================

router.get('/organizations/:id/metadata', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getOrganizationMetadata(req, res);
}));
router.put('/organizations/:id/metadata', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.updateOrganizationMetadata(req, res);
}));
router.get('/organizations/:id/tags', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getOrganizationTags(req, res);
}));
router.post('/organizations/:id/tags', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.addOrganizationTag(req, res);
}));
router.delete('/organizations/:id/tags/:tagId', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.removeOrganizationTag(req, res);
}));
router.get('/organizations/:id/health', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getOrganizationHealth(req, res);
}));
router.get('/organizations/:id/relationships', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getOrganizationRelationships(req, res);
}));
router.get('/organizations/:id/analytics', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getOrganizationAnalytics(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Users
// ==========================================

router.get('/users/:id/profile-extended', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getUserProfileExtended(req, res);
}));
router.put('/users/:id/profile-extended', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.updateUserProfileExtended(req, res);
}));
router.get('/users/:id/activity', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getUserActivity(req, res);
}));
router.get('/users/:id/sessions', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getUserSessions(req, res);
}));
router.delete('/users/:id/sessions/:sessionId', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.revokeUserSession(req, res);
}));
router.get('/users/:id/groups', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getUserGroups(req, res);
}));
router.get('/users/:id/onboarding', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getUserOnboardingProgress(req, res);
}));
router.put('/users/:id/onboarding', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.updateUserOnboardingProgress(req, res);
}));
router.get('/users/:id/license', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getUserLicense(req, res);
}));
router.put('/users/:id/license', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.assignUserLicense(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Security
// ==========================================

router.get('/organizations/:id/ip-whitelist', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getIPWhitelist(req, res);
}));
router.post('/organizations/:id/ip-whitelist', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.addIPWhitelist(req, res);
}));
router.delete('/ip-whitelist/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.removeIPWhitelist(req, res);
}));
router.get('/users/:id/devices', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getUserDevices(req, res);
}));
router.post('/devices/:id/block', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.blockDevice(req, res);
}));
router.get('/users/:id/mfa', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getMFAMethods(req, res);
}));
router.post('/users/:id/mfa/totp/setup', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.setupTOTP(req, res);
}));
router.post('/users/:id/mfa/totp/verify', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.verifyTOTP(req, res);
}));
router.get('/organizations/:id/password-policy', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getPasswordPolicy(req, res);
}));
router.put('/organizations/:id/password-policy', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.updatePasswordPolicy(req, res);
}));
router.get('/security-events', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getSecurityEvents(req, res);
}));
router.post('/security-events/:id/resolve', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.resolveSecurityEvent(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Support
// ==========================================

router.get('/support/tickets', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getSupportTickets(req, res);
}));
router.post('/support/tickets', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.createSupportTicket(req, res);
}));
router.put('/support/tickets/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.updateSupportTicket(req, res);
}));
router.post('/support/tickets/:id/comments', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.addTicketComment(req, res);
}));
router.get('/organizations/:id/customer-success/notes', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getCustomerSuccessNotes(req, res);
}));
router.post('/organizations/:id/customer-success/notes', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.createCustomerSuccessNote(req, res);
}));
router.get('/organizations/:id/customer-success/health', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getCustomerHealthCheck(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Feedback
// ==========================================

router.get('/feedback', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getFeedbackItems(req, res);
}));
router.post('/feedback', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.createFeedbackItem(req, res);
}));
router.post('/feedback/:id/vote', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.voteFeedback(req, res);
}));
router.post('/feedback/:id/comments', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.addFeedbackComment(req, res);
}));
router.get('/feature-roadmap', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getFeatureRoadmap(req, res);
}));
router.put('/feature-roadmap/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.updateFeatureRoadmap(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Analytics
// ==========================================

router.get('/users/:id/adoption-metrics', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getUserAdoptionMetrics(req, res);
}));
router.get('/organizations/:id/churn-prediction', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getChurnPrediction(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Compliance
// ==========================================

router.get('/compliance/retention-policies', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getDataRetentionPolicies(req, res);
}));
router.post('/compliance/retention-policies', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.createDataRetentionPolicy(req, res);
}));
router.get('/compliance/gdpr-requests', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getGDPRRequests(req, res);
}));
router.post('/compliance/gdpr-requests', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.createGDPRRequest(req, res);
}));
router.get('/users/:id/consents', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getUserConsents(req, res);
}));
router.put('/users/:id/consents', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.updateUserConsent(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Automation
// ==========================================

router.get('/automation/rules', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getAutomationRules(req, res);
}));
router.post('/automation/rules', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.createAutomationRule(req, res);
}));
router.put('/automation/rules/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.updateAutomationRule(req, res);
}));
router.get('/webhooks', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getWebhookSubscriptions(req, res);
}));
router.post('/webhooks', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.createWebhookSubscription(req, res);
}));

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Communication
// ==========================================

router.get('/email/templates', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getEmailTemplates(req, res);
}));
router.post('/email/templates', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.createEmailTemplate(req, res);
}));
router.get('/email/campaigns', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getEmailCampaigns(req, res);
}));
router.post('/email/campaigns', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.createEmailCampaign(req, res);
}));
router.get('/users/:id/notification-preferences', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.getNotificationPreferences(req, res);
}));
router.put('/users/:id/notification-preferences', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.updateNotificationPreferences(req, res);
}));

// ==========================================
// REFRESH TOKEN
// ==========================================

router.post('/refresh-token', asyncHandler(async (req: AuthRequest, res: Response) => {
    await superAdminController.refreshToken(req, res);
}));

export default router;
