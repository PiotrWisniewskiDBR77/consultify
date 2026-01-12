declare namespace _default {
    export { setDependencies };
    export { getOrganizations };
    export { getActivities };
    export { getDashboardStats };
    export { updateOrganization };
    export { deleteOrganization };
    export { getOrgBilling };
    export { getUsers };
    export { updateUser };
    export { createUser };
    export { inviteUser };
    export { resetUserPassword };
    export { getAccessRequests };
    export { approveAccessRequest };
    export { rejectAccessRequest };
    export { getAccessCodes };
    export { createAccessCode };
    export { impersonateUser };
    export { getDatabaseTables };
    export { getDatabaseRows };
    export { getStorageUsage };
    export { getStorageFiles };
    export { deleteStorageFile };
    export { getAllLegalDocs };
    export { publishLegalDoc };
    export { toggleLegalDocActive };
    export { getLegalDocById };
    export { getLegalEvents };
    export { getLegalEventStats };
    export { getOrgAttribution };
    export { exportAttribution };
    export { getPartnerSummary };
    export { getUsageByOrganization };
    export { getInvoices };
    export { getInvoiceStats };
    export { getSystemHealth };
    export { remindInvoice };
    export { markInvoicePaid };
    export { getInvoicePdf };
    export { uploadBrandingLogo };
    export { getApiKeys };
    export { createApiKey };
    export { deleteApiKey };
    export { getApiKeyUsage };
    export { getComplianceFrameworks };
    export { getComplianceStatus };
    export { getDsarRequests };
    export { getComplianceAudits };
    export { refreshToken };
    export { getOrganizationMetadata };
    export { updateOrganizationMetadata };
    export { getOrganizationTags };
    export { addOrganizationTag };
    export { removeOrganizationTag };
    export { getOrganizationHealth };
    export { getOrganizationRelationships };
    export { getOrganizationAnalytics };
    export { getUserProfileExtended };
    export { updateUserProfileExtended };
    export { getUserActivity };
    export { getUserSessions };
    export { revokeUserSession };
    export { getUserGroups };
    export { getUserOnboardingProgress };
    export { updateUserOnboardingProgress };
    export { getUserLicense };
    export { assignUserLicense };
    export { getIPWhitelist };
    export { addIPWhitelist };
    export { removeIPWhitelist };
    export { getUserDevices };
    export { blockDevice };
    export { getMFAMethods };
    export { setupTOTP };
    export { verifyTOTP };
    export { getPasswordPolicy };
    export { updatePasswordPolicy };
    export { getSecurityEvents };
    export { resolveSecurityEvent };
    export { getSupportTickets };
    export { createSupportTicket };
    export { updateSupportTicket };
    export { addTicketComment };
    export { getCustomerSuccessNotes };
    export { createCustomerSuccessNote };
    export { getCustomerHealthCheck };
    export { getFeedbackItems };
    export { createFeedbackItem };
    export { voteFeedback };
    export { addFeedbackComment };
    export { getFeatureRoadmap };
    export { updateFeatureRoadmap };
    export { getUserAdoptionMetrics };
    export { getChurnPrediction };
    export { getDataRetentionPolicies };
    export { createDataRetentionPolicy };
    export { getGDPRRequests };
    export { createGDPRRequest };
    export { getUserConsents };
    export { updateUserConsent };
    export { getAutomationRules };
    export { createAutomationRule };
    export { updateAutomationRule };
    export { getWebhookSubscriptions };
    export { createWebhookSubscription };
    export { getEmailTemplates };
    export { createEmailTemplate };
    export { getEmailCampaigns };
    export { createEmailCampaign };
    export { getNotificationPreferences };
    export { updateNotificationPreferences };
    export { getAdminSessions };
    export { createAdminSession };
    export { revokeAdminSession };
    export { revokeAllAdminSessions };
    export { getAdminSessionStats };
    export { getAdminAuditLogs };
    export { getAdminAuditStats };
    export { resolveAdminAuditLog };
    export { exportAuditLogs };
    export { getRecentHighRiskActions };
    export { getAdminPermissions };
    export { createAdminPermission };
    export { updateAdminPermission };
    export { deleteAdminPermission };
    export { getPermissionsMatrix };
    export { updateRolePermissions };
    export { toggleRolePermission };
    export { copyRolePermissions };
    export { compareRoles };
    export { getPermissionsStats };
    export { getApprovalWorkflows };
    export { createApprovalWorkflow };
    export { updateApprovalWorkflow };
    export { deleteApprovalWorkflow };
    export { getApprovalRequests };
    export { approveRequest };
    export { rejectRequest };
    export { getAnalyticsDashboards };
    export { createAnalyticsDashboard };
    export { updateAnalyticsDashboard };
    export { deleteAnalyticsDashboard };
    export { getAnalyticsDashboardData };
    export { shareAnalyticsDashboard };
    export { getAnalyticsReports };
    export { createAnalyticsReport };
    export { updateAnalyticsReport };
    export { deleteAnalyticsReport };
    export { executeAnalyticsReport };
    export { scheduleAnalyticsReport };
    export { getReportExecutions };
    export { getBusinessMetrics };
    export { createBusinessMetric };
    export { updateBusinessMetric };
    export { deleteBusinessMetric };
    export { calculateBusinessMetric };
    export { getMetricHistory };
    export { getMetricsStats };
    export { getPredictiveModels };
    export { createPredictiveModel };
    export { updatePredictiveModel };
    export { deletePredictiveModel };
    export { trainPredictiveModel };
    export { makePrediction };
    export { getModelPredictions };
    export { evaluatePredictiveModel };
    export { getLifecycleStages };
    export { createLifecycleStage };
    export { updateLifecycleStage };
    export { deleteLifecycleStage };
    export { transitionOrganization };
    export { getLifecycleTransitions };
    export { getLifecycleStats };
    export { getSuccessPlaybooks };
    export { createSuccessPlaybook };
    export { updateSuccessPlaybook };
    export { deleteSuccessPlaybook };
    export { executeSuccessPlaybook };
    export { getSuccessActions };
    export { getPlaybookStats };
    export { getCustomerContracts };
    export { createCustomerContract };
    export { updateCustomerContract };
    export { deleteCustomerContract };
    export { createContractAmendment };
    export { getContractAmendments };
    export { getUpcomingRenewals };
    export { getContractStats };
    export { getPricingPlans };
    export { createPricingPlan };
    export { updatePricingPlan };
    export { deletePricingPlan };
    export { getPlanFeatures };
    export { addPlanFeature };
    export { removePlanFeature };
    export { comparePricingPlans };
    export { getSubscriptionChanges };
    export { createSubscriptionChange };
    export { approveSubscriptionChange };
    export { rejectSubscriptionChange };
    export { calculateProration };
    export { getSubscriptionChangeStats };
    export { getRevenueRecognitions };
    export { createRevenueRecognition };
    export { updateRevenueRecognition };
    export { recognizeRevenue };
    export { getRecognitionSchedule };
    export { getRevenueRecognitionStats };
    export { getRevenueForecasts };
    export { createRevenueForecast };
    export { updateRevenueForecast };
    export { deleteRevenueForecast };
    export { generateRevenueForecast };
    export { getRevenueForecastStats };
    export { getPaymentMethods };
    export { addPaymentMethod };
    export { updatePaymentMethod };
    export { deletePaymentMethod };
    export { getPaymentFailures };
    export { retryPayment };
    export { getPaymentFailureStats };
    export { getSecurityIncidents };
    export { getSecurityIncidentStats };
    export { getSecurityIncidentById };
    export { createSecurityIncident };
    export { updateSecurityIncident };
    export { resolveSecurityIncident };
    export { deleteSecurityIncident };
    export { getThreats };
    export { getThreatStats };
    export { getThreatById };
    export { addThreat };
    export { updateThreat };
    export { blockThreat };
    export { unblockThreat };
    export { deleteThreat };
    export { checkIPReputation };
    export { checkDomainReputation };
    export { getBlockedIPs };
    export { getBlockedDomains };
    export { bulkImportThreats };
    export { getDLPPolicies };
    export { getDLPPolicyById };
    export { createDLPPolicy };
    export { updateDLPPolicy };
    export { toggleDLPPolicy };
    export { deleteDLPPolicy };
    export { getDLPViolations };
    export { getDLPViolationById };
    export { resolveDLPViolation };
    export { getDLPStats };
    export { scanResourceDLP };
    export { getDashboards };
    export { getDashboardBuilderStats };
    export { getDashboardById };
    export { createDashboard };
    export { updateDashboard };
    export { cloneDashboard };
    export { toggleDashboardShare };
    export { deleteDashboard };
    export { addDashboardWidget };
    export { updateDashboardWidget };
    export { removeDashboardWidget };
    export { reorderDashboardWidgets };
    export { getDashboardWidgetData };
}
export default _default;
/**
 * Inject mock dependencies for testing
 */
declare function setDependencies(newDeps: any): void;
/**
 * GET All Organizations
 */
declare const getOrganizations: any;
/**
 * GET Recent Activities
 */
declare const getActivities: any;
/**
 * GET Dashboard Stats
 */
declare const getDashboardStats: any;
/**
 * UPDATE Organization
 */
declare const updateOrganization: any;
declare const deleteOrganization: any;
/**
 * GET Organization Billing Details
 */
declare const getOrgBilling: any;
/**
 * GET All Users
 */
declare const getUsers: any;
/**
 * UPDATE User
 */
declare const updateUser: any;
/**
 * CREATE Super Admin User
 */
declare const createUser: any;
/**
 * INVITE USER
 */
declare const inviteUser: any;
/**
 * RESET PASSWORD LINK
 */
declare const resetUserPassword: any;
/**
 * GET Access Requests
 */
declare const getAccessRequests: any;
/**
 * APPROVE Access Request
 */
declare const approveAccessRequest: any;
/**
 * REJECT Access Request
 */
declare const rejectAccessRequest: any;
/**
 * GET Access Codes
 */
declare const getAccessCodes: any;
/**
 * CREATE Access Code
 */
declare const createAccessCode: any;
/**
 * IMPERSONATE USER
 */
declare const impersonateUser: any;
/**
 * DATABASE EXPLORER - TABLES
 */
declare const getDatabaseTables: any;
/**
 * DATABASE EXPLORER - ROWS
 */
declare const getDatabaseRows: any;
/**
 * STORAGE STATS
 */
declare const getStorageUsage: any;
/**
 * STORAGE LIST FILES
 */
declare const getStorageFiles: any;
/**
 * STORAGE DELETE FILE
 */
declare const deleteStorageFile: any;
/**
 * LEGAL DASHBOARD
 */
declare const getAllLegalDocs: any;
/**
 * LEGAL PUBLISH
 */
declare const publishLegalDoc: any;
/**
 * LEGAL TOGGLE ACTIVE
 */
declare const toggleLegalDocActive: any;
/**
 * GET LEGAL DOC BY ID
 */
declare const getLegalDocById: any;
/**
 * LEGAL EVENTS
 */
declare const getLegalEvents: any;
/**
 * LEGAL EVENT STATS
 */
declare const getLegalEventStats: any;
/**
 * ATTRIBUTION BY ORG
 */
declare const getOrgAttribution: any;
/**
 * EXPORT ATTRIBUTION
 */
declare const exportAttribution: any;
/**
 * PARTNER SUMMARY
 */
declare const getPartnerSummary: any;
/**
 * GET Usage Stats by Organization
 */
declare const getUsageByOrganization: any;
/**
 * GET Invoices
 */
declare const getInvoices: any;
/**
 * GET Invoice Stats
 */
declare const getInvoiceStats: any;
/**
 * GET System Health
 */
declare const getSystemHealth: any;
/**
 * Remind about an invoice (send reminder)
 */
declare const remindInvoice: any;
/**
 * Mark an invoice as paid
 */
declare const markInvoicePaid: any;
/**
 * Get invoice PDF (placeholder)
 */
declare const getInvoicePdf: any;
/**
 * Upload branding logo (placeholder)
 */
declare const uploadBrandingLogo: any;
/**
 * Get all API keys
 */
declare const getApiKeys: any;
/**
 * Create a new API key
 */
declare const createApiKey: any;
/**
 * Delete an API key
 */
declare const deleteApiKey: any;
/**
 * Get API key usage stats
 */
declare const getApiKeyUsage: any;
/**
 * Get compliance frameworks list
 */
declare const getComplianceFrameworks: any;
/**
 * Get compliance status for a framework
 */
declare const getComplianceStatus: any;
/**
 * Get DSAR requests
 */
declare const getDsarRequests: any;
/**
 * Get compliance audits list (placeholder)
 */
declare const getComplianceAudits: any;
/**
 * Refresh SuperAdmin token
 */
declare const refreshToken: any;
declare const getOrganizationMetadata: any;
declare const updateOrganizationMetadata: any;
declare const getOrganizationTags: any;
declare const addOrganizationTag: any;
declare const removeOrganizationTag: any;
declare const getOrganizationHealth: any;
declare const getOrganizationRelationships: any;
declare const getOrganizationAnalytics: any;
declare const getUserProfileExtended: any;
declare const updateUserProfileExtended: any;
declare const getUserActivity: any;
declare const getUserSessions: any;
declare const revokeUserSession: any;
declare const getUserGroups: any;
declare const getUserOnboardingProgress: any;
declare const updateUserOnboardingProgress: any;
declare const getUserLicense: any;
declare const assignUserLicense: any;
declare const getIPWhitelist: any;
declare const addIPWhitelist: any;
declare const removeIPWhitelist: any;
declare const getUserDevices: any;
declare const blockDevice: any;
declare const getMFAMethods: any;
declare const setupTOTP: any;
declare const verifyTOTP: any;
declare const getPasswordPolicy: any;
declare const updatePasswordPolicy: any;
declare const getSecurityEvents: any;
declare const resolveSecurityEvent: any;
declare const getSupportTickets: any;
declare const createSupportTicket: any;
declare const updateSupportTicket: any;
declare const addTicketComment: any;
declare const getCustomerSuccessNotes: any;
declare const createCustomerSuccessNote: any;
declare const getCustomerHealthCheck: any;
declare const getFeedbackItems: any;
declare const createFeedbackItem: any;
declare const voteFeedback: any;
declare const addFeedbackComment: any;
declare const getFeatureRoadmap: any;
declare const updateFeatureRoadmap: any;
declare const getUserAdoptionMetrics: any;
declare const getChurnPrediction: any;
declare const getDataRetentionPolicies: any;
declare const createDataRetentionPolicy: any;
declare const getGDPRRequests: any;
declare const createGDPRRequest: any;
declare const getUserConsents: any;
declare const updateUserConsent: any;
declare const getAutomationRules: any;
declare const createAutomationRule: any;
declare const updateAutomationRule: any;
declare const getWebhookSubscriptions: any;
declare const createWebhookSubscription: any;
declare const getEmailTemplates: any;
declare const createEmailTemplate: any;
declare const getEmailCampaigns: any;
declare const createEmailCampaign: any;
declare const getNotificationPreferences: any;
declare const updateNotificationPreferences: any;
declare const getAdminSessions: any;
declare const createAdminSession: any;
declare const revokeAdminSession: any;
declare const revokeAllAdminSessions: any;
declare const getAdminSessionStats: any;
declare const getAdminAuditLogs: any;
declare const getAdminAuditStats: any;
declare const resolveAdminAuditLog: any;
declare const exportAuditLogs: any;
declare const getRecentHighRiskActions: any;
declare const getAdminPermissions: any;
declare const createAdminPermission: any;
declare const updateAdminPermission: any;
declare const deleteAdminPermission: any;
declare const getPermissionsMatrix: any;
declare const updateRolePermissions: any;
declare const toggleRolePermission: any;
declare const copyRolePermissions: any;
declare const compareRoles: any;
declare const getPermissionsStats: any;
declare const getApprovalWorkflows: any;
declare const createApprovalWorkflow: any;
declare const updateApprovalWorkflow: any;
declare const deleteApprovalWorkflow: any;
declare const getApprovalRequests: any;
declare const approveRequest: any;
declare const rejectRequest: any;
declare const getAnalyticsDashboards: any;
declare const createAnalyticsDashboard: any;
declare const updateAnalyticsDashboard: any;
declare const deleteAnalyticsDashboard: any;
declare const getAnalyticsDashboardData: any;
declare const shareAnalyticsDashboard: any;
declare const getAnalyticsReports: any;
declare const createAnalyticsReport: any;
declare const updateAnalyticsReport: any;
declare const deleteAnalyticsReport: any;
declare const executeAnalyticsReport: any;
declare const scheduleAnalyticsReport: any;
declare const getReportExecutions: any;
declare const getBusinessMetrics: any;
declare const createBusinessMetric: any;
declare const updateBusinessMetric: any;
declare const deleteBusinessMetric: any;
declare const calculateBusinessMetric: any;
declare const getMetricHistory: any;
declare const getMetricsStats: any;
declare const getPredictiveModels: any;
declare const createPredictiveModel: any;
declare const updatePredictiveModel: any;
declare const deletePredictiveModel: any;
declare const trainPredictiveModel: any;
declare const makePrediction: any;
declare const getModelPredictions: any;
declare const evaluatePredictiveModel: any;
declare const getLifecycleStages: any;
declare const createLifecycleStage: any;
declare const updateLifecycleStage: any;
declare const deleteLifecycleStage: any;
declare const transitionOrganization: any;
declare const getLifecycleTransitions: any;
declare const getLifecycleStats: any;
declare const getSuccessPlaybooks: any;
declare const createSuccessPlaybook: any;
declare const updateSuccessPlaybook: any;
declare const deleteSuccessPlaybook: any;
declare const executeSuccessPlaybook: any;
declare const getSuccessActions: any;
declare const getPlaybookStats: any;
declare const getCustomerContracts: any;
declare const createCustomerContract: any;
declare const updateCustomerContract: any;
declare const deleteCustomerContract: any;
declare const createContractAmendment: any;
declare const getContractAmendments: any;
declare const getUpcomingRenewals: any;
declare const getContractStats: any;
declare const getPricingPlans: any;
declare const createPricingPlan: any;
declare const updatePricingPlan: any;
declare const deletePricingPlan: any;
declare const getPlanFeatures: any;
declare const addPlanFeature: any;
declare const removePlanFeature: any;
declare const comparePricingPlans: any;
declare const getSubscriptionChanges: any;
declare const createSubscriptionChange: any;
declare const approveSubscriptionChange: any;
declare const rejectSubscriptionChange: any;
declare const calculateProration: any;
declare const getSubscriptionChangeStats: any;
declare const getRevenueRecognitions: any;
declare const createRevenueRecognition: any;
declare const updateRevenueRecognition: any;
declare const recognizeRevenue: any;
declare const getRecognitionSchedule: any;
declare const getRevenueRecognitionStats: any;
declare const getRevenueForecasts: any;
declare const createRevenueForecast: any;
declare const updateRevenueForecast: any;
declare const deleteRevenueForecast: any;
declare const generateRevenueForecast: any;
declare const getRevenueForecastStats: any;
declare const getPaymentMethods: any;
declare const addPaymentMethod: any;
declare const updatePaymentMethod: any;
declare const deletePaymentMethod: any;
declare const getPaymentFailures: any;
declare const retryPayment: any;
declare const getPaymentFailureStats: any;
/**
 * Get all security incidents
 */
declare const getSecurityIncidents: any;
/**
 * Get security incident statistics
 */
declare const getSecurityIncidentStats: any;
/**
 * Get security incident by ID
 */
declare const getSecurityIncidentById: any;
/**
 * Create a new security incident
 */
declare const createSecurityIncident: any;
/**
 * Update a security incident
 */
declare const updateSecurityIncident: any;
/**
 * Resolve a security incident
 */
declare const resolveSecurityIncident: any;
/**
 * Delete a security incident
 */
declare const deleteSecurityIncident: any;
/**
 * Get all threats
 */
declare const getThreats: any;
/**
 * Get threat statistics
 */
declare const getThreatStats: any;
/**
 * Get threat by ID
 */
declare const getThreatById: any;
/**
 * Add a new threat
 */
declare const addThreat: any;
/**
 * Update a threat
 */
declare const updateThreat: any;
/**
 * Block a threat
 */
declare const blockThreat: any;
/**
 * Unblock a threat
 */
declare const unblockThreat: any;
/**
 * Delete a threat
 */
declare const deleteThreat: any;
/**
 * Check IP reputation
 */
declare const checkIPReputation: any;
/**
 * Check domain reputation
 */
declare const checkDomainReputation: any;
/**
 * Get blocked IPs
 */
declare const getBlockedIPs: any;
/**
 * Get blocked domains
 */
declare const getBlockedDomains: any;
/**
 * Bulk import threats
 */
declare const bulkImportThreats: any;
/**
 * Get all DLP policies
 */
declare const getDLPPolicies: any;
/**
 * Get DLP policy by ID
 */
declare const getDLPPolicyById: any;
/**
 * Create a new DLP policy
 */
declare const createDLPPolicy: any;
/**
 * Update a DLP policy
 */
declare const updateDLPPolicy: any;
/**
 * Toggle DLP policy active status
 */
declare const toggleDLPPolicy: any;
/**
 * Delete a DLP policy
 */
declare const deleteDLPPolicy: any;
/**
 * Get all DLP violations
 */
declare const getDLPViolations: any;
/**
 * Get DLP violation by ID
 */
declare const getDLPViolationById: any;
/**
 * Resolve a DLP violation
 */
declare const resolveDLPViolation: any;
/**
 * Get DLP statistics
 */
declare const getDLPStats: any;
/**
 * Scan a resource for DLP violations
 */
declare const scanResourceDLP: any;
/**
 * Get all dashboards
 */
declare const getDashboards: any;
/**
 * Get dashboard statistics
 */
declare const getDashboardBuilderStats: any;
/**
 * Get dashboard by ID
 */
declare const getDashboardById: any;
/**
 * Create a new dashboard
 */
declare const createDashboard: any;
/**
 * Update a dashboard
 */
declare const updateDashboard: any;
/**
 * Clone a dashboard
 */
declare const cloneDashboard: any;
/**
 * Toggle dashboard sharing
 */
declare const toggleDashboardShare: any;
/**
 * Delete a dashboard
 */
declare const deleteDashboard: any;
/**
 * Add widget to dashboard
 */
declare const addDashboardWidget: any;
/**
 * Update widget in dashboard
 */
declare const updateDashboardWidget: any;
/**
 * Remove widget from dashboard
 */
declare const removeDashboardWidget: any;
/**
 * Reorder widgets in dashboard
 */
declare const reorderDashboardWidgets: any;
/**
 * Get widget data
 */
declare const getDashboardWidgetData: any;
//# sourceMappingURL=superAdminController.d.ts.map