import express from 'express';
const router = express.Router();
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';
import superAdminControllerRaw from '../controllers/SuperAdminController.js';
const superAdminController = superAdminControllerRaw as any;

router.use(verifySuperAdmin);

// Organizations
router.get('/organizations', superAdminController.getOrganizations);
router.get('/activities', superAdminController.getActivities);
router.get('/activities/stats', superAdminController.getActivities);
router.get('/dashboard', superAdminController.getDashboardStats);
router.put('/organizations/:id', superAdminController.updateOrganization);

// DELETE Organization
router.delete('/organizations/:id', superAdminController.deleteOrganization);

// GET Organization Billing Details
router.get('/organizations/:id/billing', superAdminController.getOrgBilling);

// GET All Users (Super Admin)
router.get('/users', superAdminController.getUsers);

// UPDATE User (Super Admin - e.g. move org, change role)
router.put('/users/:id', superAdminController.updateUser);

// CREATE Super Admin User
router.post('/users', superAdminController.createUser);

// INVITE USER (Super Admin)
router.post('/users/invite', superAdminController.inviteUser);

// RESET PASSWORD LINK (Super Admin)
router.post('/users/:id/reset-password', superAdminController.resetUserPassword);

// ACCESS REQUESTS
router.get('/access-requests', superAdminController.getAccessRequests);
router.post('/access-requests/:id/approve', superAdminController.approveAccessRequest);
router.post('/access-requests/:id/reject', superAdminController.rejectAccessRequest);

// ACCESS CODES
router.get('/access-codes', superAdminController.getAccessCodes);
router.post('/access-codes', superAdminController.createAccessCode);

// IMPERSONATE USER
router.post('/impersonate', superAdminController.impersonateUser);

// DATABASE EXPLORER
router.get('/database/tables', superAdminController.getDatabaseTables);
router.get('/database/rows/:tableName', superAdminController.getDatabaseRows);

// STORAGE
router.get('/storage/usage', superAdminController.getStorageUsage);
router.get('/storage/files/:orgId', superAdminController.getStorageFiles);
router.delete('/storage/files', superAdminController.deleteStorageFile);

// LEGAL DOCUMENT MANAGEMENT
router.get('/legal/all', superAdminController.getAllLegalDocs);
router.post('/legal/publish', superAdminController.publishLegalDoc);
router.put('/legal/:id/toggle-active', superAdminController.toggleLegalDocActive);
router.get('/legal/:id', superAdminController.getLegalDocById);

// LEGAL EVENTS AUDIT LOG
router.get('/legal-events', superAdminController.getLegalEvents);
router.get('/legal-events/stats', superAdminController.getLegalEventStats);

// ATTRIBUTION SYSTEM
router.get('/organizations/:id/attribution', superAdminController.getOrgAttribution);
router.get('/attribution/export', superAdminController.exportAttribution);
router.get('/attribution/partner-summary', superAdminController.getPartnerSummary);

// USAGE STATS BY ORGANIZATION
router.get('/usage/by-organization', superAdminController.getUsageByOrganization);

// INVOICES
router.get('/invoices', superAdminController.getInvoices);
router.get('/invoices/stats', superAdminController.getInvoiceStats);
router.post('/invoices/:id/remind', superAdminController.remindInvoice);
router.post('/invoices/:id/mark-paid', superAdminController.markInvoicePaid);
router.get('/invoices/:id/pdf', superAdminController.getInvoicePdf);

// BRANDING
router.post('/branding/:orgId/logo', superAdminController.uploadBrandingLogo);

// API KEYS
router.get('/api-keys', superAdminController.getApiKeys);
router.post('/api-keys', superAdminController.createApiKey);
router.delete('/api-keys/:id', superAdminController.deleteApiKey);
router.get('/api-keys/:id/usage', superAdminController.getApiKeyUsage);

// COMPLIANCE
router.get('/compliance/frameworks', superAdminController.getComplianceFrameworks);
router.get('/compliance/status/:frameworkId', superAdminController.getComplianceStatus);
router.get('/compliance/dsar', superAdminController.getDsarRequests);
router.get('/compliance/audits', superAdminController.getComplianceAudits);

// SYSTEM HEALTH
router.get('/system-health', superAdminController.getSystemHealth);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Organizations
// ==========================================
router.get('/organizations/:id/metadata', superAdminController.getOrganizationMetadata);
router.put('/organizations/:id/metadata', superAdminController.updateOrganizationMetadata);
router.get('/organizations/:id/tags', superAdminController.getOrganizationTags);
router.post('/organizations/:id/tags', superAdminController.addOrganizationTag);
router.delete('/organizations/:id/tags/:tagId', superAdminController.removeOrganizationTag);
router.get('/organizations/:id/health', superAdminController.getOrganizationHealth);
router.get('/organizations/:id/relationships', superAdminController.getOrganizationRelationships);
router.get('/organizations/:id/analytics', superAdminController.getOrganizationAnalytics);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Users
// ==========================================
router.get('/users/:id/profile-extended', superAdminController.getUserProfileExtended);
router.put('/users/:id/profile-extended', superAdminController.updateUserProfileExtended);
router.get('/users/:id/activity', superAdminController.getUserActivity);
router.get('/users/:id/sessions', superAdminController.getUserSessions);
router.delete('/users/:id/sessions/:sessionId', superAdminController.revokeUserSession);
router.get('/users/:id/groups', superAdminController.getUserGroups);
router.get('/users/:id/onboarding', superAdminController.getUserOnboardingProgress);
router.put('/users/:id/onboarding', superAdminController.updateUserOnboardingProgress);
router.get('/users/:id/license', superAdminController.getUserLicense);
router.put('/users/:id/license', superAdminController.assignUserLicense);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Security
// ==========================================
router.get('/organizations/:id/ip-whitelist', superAdminController.getIPWhitelist);
router.post('/organizations/:id/ip-whitelist', superAdminController.addIPWhitelist);
router.delete('/ip-whitelist/:id', superAdminController.removeIPWhitelist);
router.get('/users/:id/devices', superAdminController.getUserDevices);
router.post('/devices/:id/block', superAdminController.blockDevice);
router.get('/users/:id/mfa', superAdminController.getMFAMethods);
router.post('/users/:id/mfa/totp/setup', superAdminController.setupTOTP);
router.post('/users/:id/mfa/totp/verify', superAdminController.verifyTOTP);
router.get('/organizations/:id/password-policy', superAdminController.getPasswordPolicy);
router.put('/organizations/:id/password-policy', superAdminController.updatePasswordPolicy);
router.get('/security-events', superAdminController.getSecurityEvents);
router.post('/security-events/:id/resolve', superAdminController.resolveSecurityEvent);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Support
// ==========================================
router.get('/support/tickets', superAdminController.getSupportTickets);
router.post('/support/tickets', superAdminController.createSupportTicket);
router.put('/support/tickets/:id', superAdminController.updateSupportTicket);
router.post('/support/tickets/:id/comments', superAdminController.addTicketComment);
router.get('/organizations/:id/customer-success/notes', superAdminController.getCustomerSuccessNotes);
router.post('/organizations/:id/customer-success/notes', superAdminController.createCustomerSuccessNote);
router.get('/organizations/:id/customer-success/health', superAdminController.getCustomerHealthCheck);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Feedback
// ==========================================
router.get('/feedback', superAdminController.getFeedbackItems);
router.post('/feedback', superAdminController.createFeedbackItem);
router.post('/feedback/:id/vote', superAdminController.voteFeedback);
router.post('/feedback/:id/comments', superAdminController.addFeedbackComment);
router.get('/feature-roadmap', superAdminController.getFeatureRoadmap);
router.put('/feature-roadmap/:id', superAdminController.updateFeatureRoadmap);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Analytics
// ==========================================
router.get('/users/:id/adoption-metrics', superAdminController.getUserAdoptionMetrics);
router.get('/organizations/:id/churn-prediction', superAdminController.getChurnPrediction);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Compliance
// ==========================================
router.get('/compliance/retention-policies', superAdminController.getDataRetentionPolicies);
router.post('/compliance/retention-policies', superAdminController.createDataRetentionPolicy);
router.get('/compliance/gdpr-requests', superAdminController.getGDPRRequests);
router.post('/compliance/gdpr-requests', superAdminController.createGDPRRequest);
router.get('/users/:id/consents', superAdminController.getUserConsents);
router.put('/users/:id/consents', superAdminController.updateUserConsent);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Automation
// ==========================================
router.get('/automation/rules', superAdminController.getAutomationRules);
router.post('/automation/rules', superAdminController.createAutomationRule);
router.put('/automation/rules/:id', superAdminController.updateAutomationRule);
router.get('/webhooks', superAdminController.getWebhookSubscriptions);
router.post('/webhooks', superAdminController.createWebhookSubscription);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Communication
// ==========================================
router.get('/email/templates', superAdminController.getEmailTemplates);
router.post('/email/templates', superAdminController.createEmailTemplate);
router.get('/email/campaigns', superAdminController.getEmailCampaigns);
router.post('/email/campaigns', superAdminController.createEmailCampaign);
router.get('/users/:id/notification-preferences', superAdminController.getNotificationPreferences);
router.put('/users/:id/notification-preferences', superAdminController.updateNotificationPreferences);

// =========================================
// PHASE 1: ADVANCED IAM MODULE
// =========================================

// Admin Sessions
router.get('/admin/sessions', superAdminController.getAdminSessions);
router.post('/admin/sessions', superAdminController.createAdminSession);
router.delete('/admin/sessions/:id', superAdminController.revokeAdminSession);
router.post('/admin/sessions/revoke-all', superAdminController.revokeAllAdminSessions);
router.get('/admin/sessions/stats', superAdminController.getAdminSessionStats);

// Admin Audit Logs
router.get('/admin/audit-logs', superAdminController.getAdminAuditLogs);
router.get('/admin/audit-logs/stats', superAdminController.getAdminAuditStats);
router.get('/admin/audit-logs/export', superAdminController.exportAuditLogs);
router.get('/admin/audit-logs/high-risk', superAdminController.getRecentHighRiskActions);
router.post('/admin/audit-logs/:id/resolve', superAdminController.resolveAdminAuditLog);

// Admin Permissions
router.get('/admin/permissions', superAdminController.getAdminPermissions);
router.post('/admin/permissions', superAdminController.createAdminPermission);
router.put('/admin/permissions/:key', superAdminController.updateAdminPermission);
router.delete('/admin/permissions/:key', superAdminController.deleteAdminPermission);
router.get('/admin/permissions/matrix', superAdminController.getPermissionsMatrix);
router.put('/admin/permissions/roles/:roleId', superAdminController.updateRolePermissions);
router.post('/admin/permissions/roles/:roleId/permissions/:permissionKey', superAdminController.toggleRolePermission);
router.post('/admin/permissions/copy', superAdminController.copyRolePermissions);
router.get('/admin/permissions/compare', superAdminController.compareRoles);
router.get('/admin/permissions/stats', superAdminController.getPermissionsStats);

// Approval Workflows
router.get('/admin/approval-workflows', superAdminController.getApprovalWorkflows);
router.post('/admin/approval-workflows', superAdminController.createApprovalWorkflow);
router.put('/admin/approval-workflows/:id', superAdminController.updateApprovalWorkflow);
router.delete('/admin/approval-workflows/:id', superAdminController.deleteApprovalWorkflow);
router.get('/admin/approval-requests', superAdminController.getApprovalRequests);
router.post('/admin/approval-requests/:id/approve', superAdminController.approveRequest);
router.post('/admin/approval-requests/:id/reject', superAdminController.rejectRequest);

// =========================================
// PHASE 2: ADVANCED SECURITY MODULE
// =========================================

// Security Incidents
router.get('/security/incidents', superAdminController.getSecurityIncidents);
router.post('/security/incidents', superAdminController.createSecurityIncident);
router.put('/security/incidents/:id', superAdminController.updateSecurityIncident);
router.post('/security/incidents/:id/resolve', superAdminController.resolveSecurityIncident);
router.get('/security/incidents/stats', superAdminController.getSecurityIncidentStats);

// Threat Intelligence
router.get('/security/threats', superAdminController.getThreats);
router.post('/security/threats', superAdminController.addThreat);
router.post('/security/threats/:id/block', superAdminController.blockThreat);
router.post('/security/threats/:id/unblock', superAdminController.unblockThreat);
router.get('/security/threats/check-ip/:ip', superAdminController.checkIPReputation);
router.get('/security/threats/stats', superAdminController.getThreatStats);

// DLP Policies
router.get('/security/dlp/policies', superAdminController.getDLPPolicies);
router.post('/security/dlp/policies', superAdminController.createDLPPolicy);
router.put('/security/dlp/policies/:id', superAdminController.updateDLPPolicy);
router.delete('/security/dlp/policies/:id', superAdminController.deleteDLPPolicy);
router.post('/security/dlp/scan', superAdminController.scanResourceDLP);
router.get('/security/dlp/violations', superAdminController.getDLPViolations);
router.post('/security/dlp/violations/:id/resolve', superAdminController.resolveDLPViolation);

// =========================================
// PHASE 3: ANALYTICS MODULE
// =========================================

// Custom Dashboards
router.get('/analytics/dashboards', superAdminController.getAnalyticsDashboards);
router.post('/analytics/dashboards', superAdminController.createAnalyticsDashboard);
router.put('/analytics/dashboards/:id', superAdminController.updateAnalyticsDashboard);
router.delete('/analytics/dashboards/:id', superAdminController.deleteAnalyticsDashboard);
router.get('/analytics/dashboards/:id/data', superAdminController.getAnalyticsDashboardData);
router.post('/analytics/dashboards/:id/share', superAdminController.shareAnalyticsDashboard);

// Saved Reports
router.get('/analytics/reports', superAdminController.getAnalyticsReports);
router.post('/analytics/reports', superAdminController.createAnalyticsReport);
router.put('/analytics/reports/:id', superAdminController.updateAnalyticsReport);
router.delete('/analytics/reports/:id', superAdminController.deleteAnalyticsReport);
router.post('/analytics/reports/:id/execute', superAdminController.executeAnalyticsReport);
router.post('/analytics/reports/:id/schedule', superAdminController.scheduleAnalyticsReport);
router.get('/analytics/reports/:id/executions', superAdminController.getReportExecutions);

// Business Metrics
router.get('/analytics/metrics', superAdminController.getBusinessMetrics);
router.post('/analytics/metrics', superAdminController.createBusinessMetric);
router.put('/analytics/metrics/:id', superAdminController.updateBusinessMetric);
router.delete('/analytics/metrics/:id', superAdminController.deleteBusinessMetric);
router.post('/analytics/metrics/:id/calculate', superAdminController.calculateBusinessMetric);
router.get('/analytics/metrics/:id/history', superAdminController.getMetricHistory);
router.get('/analytics/metrics/stats', superAdminController.getMetricsStats);

// Predictive Analytics
router.get('/analytics/predictive/models', superAdminController.getPredictiveModels);
router.post('/analytics/predictive/models', superAdminController.createPredictiveModel);
router.put('/analytics/predictive/models/:id', superAdminController.updatePredictiveModel);
router.delete('/analytics/predictive/models/:id', superAdminController.deletePredictiveModel);
router.post('/analytics/predictive/models/:id/train', superAdminController.trainPredictiveModel);
router.post('/analytics/predictive/models/:id/predict', superAdminController.makePrediction);
router.get('/analytics/predictive/models/:id/predictions', superAdminController.getModelPredictions);
router.get('/analytics/predictive/models/:id/evaluate', superAdminController.evaluatePredictiveModel);

// =========================================
// PHASE 4: CUSTOMER MANAGEMENT MODULE
// =========================================

// Customer Lifecycle
router.get('/customers/lifecycle/stages', superAdminController.getLifecycleStages);
router.post('/customers/lifecycle/stages', superAdminController.createLifecycleStage);
router.put('/customers/lifecycle/stages/:id', superAdminController.updateLifecycleStage);
router.delete('/customers/lifecycle/stages/:id', superAdminController.deleteLifecycleStage);
router.post('/customers/lifecycle/transitions', superAdminController.transitionOrganization);
router.get('/customers/lifecycle/transitions', superAdminController.getLifecycleTransitions);
router.get('/customers/lifecycle/stats', superAdminController.getLifecycleStats);

// Customer Success Playbooks
router.get('/customers/success/playbooks', superAdminController.getSuccessPlaybooks);
router.post('/customers/success/playbooks', superAdminController.createSuccessPlaybook);
router.put('/customers/success/playbooks/:id', superAdminController.updateSuccessPlaybook);
router.delete('/customers/success/playbooks/:id', superAdminController.deleteSuccessPlaybook);
router.post('/customers/success/playbooks/:id/execute', superAdminController.executeSuccessPlaybook);
router.get('/customers/success/actions', superAdminController.getSuccessActions);
router.get('/customers/success/playbooks/stats', superAdminController.getPlaybookStats);

// Customer Contracts
router.get('/customers/contracts', superAdminController.getCustomerContracts);
router.post('/customers/contracts', superAdminController.createCustomerContract);
router.put('/customers/contracts/:id', superAdminController.updateCustomerContract);
router.delete('/customers/contracts/:id', superAdminController.deleteCustomerContract);
router.post('/customers/contracts/:id/amendments', superAdminController.createContractAmendment);
router.get('/customers/contracts/:id/amendments', superAdminController.getContractAmendments);
router.get('/customers/contracts/renewals', superAdminController.getUpcomingRenewals);
router.get('/customers/contracts/stats', superAdminController.getContractStats);

// =========================================
// PHASE 5: REVENUE MANAGEMENT MODULE
// =========================================

// Pricing Plans
router.get('/revenue/pricing-plans', superAdminController.getPricingPlans);
router.post('/revenue/pricing-plans', superAdminController.createPricingPlan);
router.put('/revenue/pricing-plans/:id', superAdminController.updatePricingPlan);
router.delete('/revenue/pricing-plans/:id', superAdminController.deletePricingPlan);
router.get('/revenue/pricing-plans/:id/features', superAdminController.getPlanFeatures);
router.post('/revenue/pricing-plans/:id/features', superAdminController.addPlanFeature);
router.delete('/revenue/pricing-plans/:id/features/:featureId', superAdminController.removePlanFeature);
router.get('/revenue/pricing-plans/compare', superAdminController.comparePricingPlans);

// Subscription Changes
router.get('/revenue/subscription-changes', superAdminController.getSubscriptionChanges);
router.post('/revenue/subscription-changes', superAdminController.createSubscriptionChange);
router.post('/revenue/subscription-changes/:id/approve', superAdminController.approveSubscriptionChange);
router.post('/revenue/subscription-changes/:id/reject', superAdminController.rejectSubscriptionChange);
router.post('/revenue/subscription-changes/calculate-proration', superAdminController.calculateProration);
router.get('/revenue/subscription-changes/stats', superAdminController.getSubscriptionChangeStats);

// Revenue Recognition
router.get('/revenue/recognition', superAdminController.getRevenueRecognitions);
router.post('/revenue/recognition', superAdminController.createRevenueRecognition);
router.put('/revenue/recognition/:id', superAdminController.updateRevenueRecognition);
router.post('/revenue/recognition/:id/recognize', superAdminController.recognizeRevenue);
router.get('/revenue/recognition/:id/schedule', superAdminController.getRecognitionSchedule);
router.get('/revenue/recognition/stats', superAdminController.getRevenueRecognitionStats);

// Revenue Forecasting
router.get('/revenue/forecasts', superAdminController.getRevenueForecasts);
router.post('/revenue/forecasts', superAdminController.createRevenueForecast);
router.put('/revenue/forecasts/:id', superAdminController.updateRevenueForecast);
router.delete('/revenue/forecasts/:id', superAdminController.deleteRevenueForecast);
router.post('/revenue/forecasts/generate', superAdminController.generateRevenueForecast);
router.get('/revenue/forecasts/stats', superAdminController.getRevenueForecastStats);

// Payment Management
router.get('/revenue/payment-methods', superAdminController.getPaymentMethods);
router.post('/revenue/payment-methods', superAdminController.addPaymentMethod);
router.put('/revenue/payment-methods/:id', superAdminController.updatePaymentMethod);
router.delete('/revenue/payment-methods/:id', superAdminController.deletePaymentMethod);
router.get('/revenue/payment-failures', superAdminController.getPaymentFailures);
router.post('/revenue/payment-failures/:id/retry', superAdminController.retryPayment);
router.get('/revenue/payment-failures/stats', superAdminController.getPaymentFailureStats);

// =========================================
// SECURITY INCIDENT MANAGEMENT
// =========================================
router.get('/security-incidents', superAdminController.getSecurityIncidents);
router.get('/security-incidents/stats', superAdminController.getSecurityIncidentStats);
router.get('/security-incidents/:id', superAdminController.getSecurityIncidentById);
router.post('/security-incidents', superAdminController.createSecurityIncident);
router.put('/security-incidents/:id', superAdminController.updateSecurityIncident);
router.post('/security-incidents/:id/resolve', superAdminController.resolveSecurityIncident);
router.delete('/security-incidents/:id', superAdminController.deleteSecurityIncident);

// =========================================
// THREAT INTELLIGENCE
// =========================================
router.get('/threats', superAdminController.getThreats);
router.get('/threats/stats', superAdminController.getThreatStats);
router.get('/threats/blocked-ips', superAdminController.getBlockedIPs);
router.get('/threats/blocked-domains', superAdminController.getBlockedDomains);
router.get('/threats/check-ip/:ip', superAdminController.checkIPReputation);
router.get('/threats/check-domain/:domain', superAdminController.checkDomainReputation);
router.get('/threats/:id', superAdminController.getThreatById);
router.post('/threats', superAdminController.addThreat);
router.post('/threats/bulk-import', superAdminController.bulkImportThreats);
router.put('/threats/:id', superAdminController.updateThreat);
router.post('/threats/:id/block', superAdminController.blockThreat);
router.post('/threats/:id/unblock', superAdminController.unblockThreat);
router.delete('/threats/:id', superAdminController.deleteThreat);

// =========================================
// DATA LOSS PREVENTION (DLP)
// =========================================
router.get('/dlp/policies', superAdminController.getDLPPolicies);
router.get('/dlp/policies/:id', superAdminController.getDLPPolicyById);
router.post('/dlp/policies', superAdminController.createDLPPolicy);
router.put('/dlp/policies/:id', superAdminController.updateDLPPolicy);
router.post('/dlp/policies/:id/toggle', superAdminController.toggleDLPPolicy);
router.delete('/dlp/policies/:id', superAdminController.deleteDLPPolicy);
router.get('/dlp/violations', superAdminController.getDLPViolations);
router.get('/dlp/violations/:id', superAdminController.getDLPViolationById);
router.post('/dlp/violations/:id/resolve', superAdminController.resolveDLPViolation);
router.get('/dlp/stats', superAdminController.getDLPStats);
router.post('/dlp/scan', superAdminController.scanResourceDLP);

// =========================================
// DASHBOARD BUILDER
// =========================================
router.get('/dashboards', superAdminController.getDashboards);
router.get('/dashboards/stats', superAdminController.getDashboardBuilderStats);
router.get('/dashboards/:id', superAdminController.getDashboardById);
router.post('/dashboards', superAdminController.createDashboard);
router.put('/dashboards/:id', superAdminController.updateDashboard);
router.post('/dashboards/:id/clone', superAdminController.cloneDashboard);
router.post('/dashboards/:id/share', superAdminController.toggleDashboardShare);
router.delete('/dashboards/:id', superAdminController.deleteDashboard);
router.post('/dashboards/:id/widgets', superAdminController.addDashboardWidget);
router.put('/dashboards/:id/widgets/:widgetId', superAdminController.updateDashboardWidget);
router.delete('/dashboards/:id/widgets/:widgetId', superAdminController.removeDashboardWidget);
router.post('/dashboards/:id/widgets/reorder', superAdminController.reorderDashboardWidgets);
router.post('/dashboards/widget-data', superAdminController.getDashboardWidgetData);

// REFRESH TOKEN - Force token refresh for SuperAdmin (useful when role changes)
router.post('/refresh-token', superAdminController.refreshToken);

export default router;
