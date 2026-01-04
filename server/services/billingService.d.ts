/**
 * Set dependencies (for testing)
 */
export function setDependencies(newDeps?: {}): void;
/**
 * Get all subscription plans
 */
export function getPlans(): Promise<any>;
/**
 * Get plan by ID
 */
export function getPlanById(planId: any): Promise<any>;
/**
 * Create a new subscription plan (Superadmin only)
 */
export function createPlan(planData: any): Promise<any>;
/**
 * Update subscription plan
 */
export function updatePlan(planId: any, updates: any): Promise<any>;
/**
 * Delete subscription plan (soft delete by setting is_active = 0)
 */
export function deletePlan(planId: any): Promise<any>;
export function getUserPlans(): Promise<any>;
export function createUserPlan(planData: any): Promise<any>;
export function updateUserPlan(planId: any, updates: any): Promise<any>;
export function deleteUserPlan(planId: any): Promise<any>;
/**
 * Get organization billing info
 */
export function getOrganizationBilling(orgId: any): Promise<any>;
/**
 * Create or update organization billing record
 */
export function upsertOrgBilling(orgId: any, billingData: any): Promise<any>;
/**
 * Create Stripe customer if not exists
 */
export function getOrCreateStripeCustomer(orgId: any, email: any, orgName: any): Promise<any>;
/**
 * Create subscription for organization
 */
export function createSubscription(orgId: any, planId: any, paymentMethodId: any, email: any, orgName: any): Promise<any>;
/**
 * Cancel subscription
 */
export function cancelSubscription(orgId: any): Promise<any>;
/**
 * Change subscription plan
 */
export function changePlan(orgId: any, newPlanId: any): Promise<{
    status: string;
    plan: any;
}>;
/**
 * Get invoices for organization
 */
export function getInvoices(orgId: any): Promise<any>;
/**
 * Record invoice from Stripe webhook
 */
export function recordInvoice(orgId: any, stripeInvoice: any): Promise<any>;
/**
 * Get revenue statistics (Superadmin)
 */
export function getRevenueStats(): Promise<any>;
/**
 * Get all payment methods for an organization
 */
export function getPaymentMethods(orgId: any): Promise<any>;
/**
 * Get a single payment method
 */
export function getPaymentMethod(paymentMethodId: any): Promise<any>;
/**
 * Add a new payment method
 */
export function addPaymentMethod(orgId: any, stripePaymentMethodId: any): Promise<any>;
/**
 * Remove a payment method
 */
export function removePaymentMethod(paymentMethodId: any, orgId: any): Promise<any>;
/**
 * Set a payment method as default
 */
export function setDefaultPaymentMethod(paymentMethodId: any, orgId: any): Promise<any>;
/**
 * Create a Stripe SetupIntent for adding a new payment method
 */
export function createSetupIntent(orgId: any, email: any, orgName: any): Promise<{
    clientSecret: any;
    id: any;
}>;
/**
 * Get billing alert configuration for an organization
 */
export function getBillingAlerts(orgId: any): Promise<any>;
/**
 * Update billing alert configuration
 */
export function updateBillingAlerts(orgId: any, alertSettings: any): Promise<any>;
/**
 * Get tax settings for an organization
 */
export function getTaxSettings(orgId: any): Promise<any>;
/**
 * Update tax settings
 */
export function updateTaxSettings(orgId: any, taxSettings: any): Promise<any>;
/**
 * Validate and apply a discount code
 */
export function validateDiscountCode(code: any, planId: any): Promise<any>;
/**
 * Increment discount code usage
 */
export function incrementDiscountCodeUsage(codeId: any): Promise<any>;
/**
 * Get seat pricing for a plan
 */
export function getSeatPricing(planId: any): Promise<any>;
/**
 * Calculate seat cost
 */
export function calculateSeatCost(orgId: any, quantity: any): Promise<any>;
/**
 * Process seat purchase (with Stripe integration)
 */
export function processSeatPurchase(orgId: any, quantity: any, paymentMethodId: any): Promise<{
    success: boolean;
    quantity: any;
    unitPrice: any;
    totalCost: any;
    paymentMethodId: any;
}>;
/**
 * Get billing model for organization
 */
export function getBillingModel(orgId: any): Promise<any>;
/**
 * Update billing model
 */
export function updateBillingModel(orgId: any, model: any): Promise<any>;
declare namespace _default {
    export { setDependencies };
    export { getPlans };
    export { getPlanById };
    export { createPlan };
    export { updatePlan };
    export { deletePlan };
    export { getOrganizationBilling };
    export { upsertOrgBilling as upsertOrganizationBilling };
    export { getOrCreateStripeCustomer };
    export { createSubscription };
    export { cancelSubscription };
    export { changePlan };
    export { getInvoices };
    export { recordInvoice };
    export { getRevenueStats };
    export { getUserPlans };
    export { createUserPlan };
    export { updateUserPlan };
    export { deleteUserPlan };
    export { getPaymentMethods };
    export { getPaymentMethod };
    export { addPaymentMethod };
    export { removePaymentMethod };
    export { setDefaultPaymentMethod };
    export { createSetupIntent };
    export { getBillingAlerts };
    export { updateBillingAlerts };
    export { getTaxSettings };
    export { updateTaxSettings };
    export { validateDiscountCode };
    export { incrementDiscountCodeUsage };
    export { getSeatPricing };
    export { calculateSeatCost };
    export { processSeatPurchase };
    export { getBillingModel };
    export { updateBillingModel };
}
export default _default;
//# sourceMappingURL=billingService.d.ts.map