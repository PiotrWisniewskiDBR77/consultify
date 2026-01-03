/**
 * Billing Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Delegates to granulated billing modules for queries, commands, and events.
 */

import { BillingDependencyLoader } from './billing/billingDependencyLoader.js';
import { BillingQueryService } from './billing/BillingQueryService.js';
import { BillingCommandService } from './billing/BillingCommandService.js';
import { BillingEventService } from './billing/BillingEventService.js';
import type Stripe from 'stripe';
import type {
    BillingPlan,
    CreatePlanData,
    UpdatePlanData,
    CreateUserPlanData,
    UpdateUserPlanData,
    UpsertBillingData,
    SetupIntent,
    UpdateBillingAlertsData,
    UpdateTaxSettingsData,
    BillingServiceDependencies
} from './billing/types.js';

class BillingServiceClass {
    readonly #depsLoader = new BillingDependencyLoader();
    readonly #eventService = new BillingEventService();
    readonly #queryService = new BillingQueryService(() => this.#depsLoader.deps);
    readonly #commandService = new BillingCommandService(
        () => this.#depsLoader.deps,
        this.#queryService,
        this.#eventService
    );

    async #ensureInitialized(): Promise<void> {
        await this.#depsLoader.init();
    }

    async setDependencies(newDeps: Partial<BillingServiceDependencies>) {
        await this.#ensureInitialized();
        this.#depsLoader.setDependencies(newDeps);
    }

    async getPlans() {
        await this.#ensureInitialized();
        return this.#queryService.getPlans();
    }

    async getPlanById(planId: string) {
        await this.#ensureInitialized();
        return this.#queryService.getPlanById(planId);
    }

    async createPlan(data: CreatePlanData) {
        await this.#ensureInitialized();
        return this.#commandService.createPlan(data);
    }

    async updatePlan(planId: string, updates: UpdatePlanData) {
        await this.#ensureInitialized();
        return this.#commandService.updatePlan(planId, updates);
    }

    async deletePlan(planId: string) {
        await this.#ensureInitialized();
        return this.#commandService.deletePlan(planId);
    }

    async getUserPlans() {
        await this.#ensureInitialized();
        return this.#queryService.getUserPlans();
    }

    async createUserPlan(data: CreateUserPlanData) {
        await this.#ensureInitialized();
        return this.#commandService.createUserPlan(data);
    }

    async updateUserPlan(planId: string, data: UpdateUserPlanData) {
        await this.#ensureInitialized();
        return this.#commandService.updateUserPlan(planId, data);
    }

    async deleteUserPlan(planId: string) {
        await this.#ensureInitialized();
        return this.#commandService.deleteUserPlan(planId);
    }

    async getOrganizationBilling(orgId: string) {
        await this.#ensureInitialized();
        return this.#queryService.getOrganizationBilling(orgId);
    }

    async upsertOrgBilling(orgId: string, data: UpsertBillingData) {
        await this.#ensureInitialized();
        return this.#commandService.upsertOrgBilling(orgId, data);
    }

    async getOrCreateStripeCustomer(orgId: string, email: string, orgName: string) {
        await this.#ensureInitialized();
        return this.#commandService.getOrCreateStripeCustomer(orgId, email, orgName);
    }

    async createSubscription(orgId: string, planId: string, paymentMethodId: string, email: string, orgName: string) {
        await this.#ensureInitialized();
        return this.#commandService.createSubscription(orgId, planId, paymentMethodId, email, orgName);
    }

    async cancelSubscription(orgId: string) {
        await this.#ensureInitialized();
        return this.#commandService.cancelSubscription(orgId);
    }

    async changePlan(orgId: string, newPlanId: string) {
        await this.#ensureInitialized();
        return this.#commandService.changePlan(orgId, newPlanId);
    }

    async getInvoices(orgId: string) {
        await this.#ensureInitialized();
        return this.#queryService.getInvoices(orgId);
    }

    async recordInvoice(orgId: string, stripeInvoice: Stripe.Invoice) {
        await this.#ensureInitialized();
        return this.#commandService.recordInvoice(orgId, stripeInvoice);
    }

    async getRevenueStats() {
        await this.#ensureInitialized();
        return this.#queryService.getRevenueStats();
    }

    async getPaymentMethods(orgId: string) {
        await this.#ensureInitialized();
        return this.#queryService.getPaymentMethods(orgId);
    }

    async getPaymentMethod(paymentMethodId: string) {
        await this.#ensureInitialized();
        return this.#queryService.getPaymentMethod(paymentMethodId);
    }

    async addPaymentMethod(orgId: string, paymentMethodId: string) {
        await this.#ensureInitialized();
        return this.#commandService.addPaymentMethod(orgId, paymentMethodId);
    }

    async removePaymentMethod(paymentMethodId: string, orgId: string) {
        await this.#ensureInitialized();
        return this.#commandService.removePaymentMethod(paymentMethodId, orgId);
    }

    async setDefaultPaymentMethod(paymentMethodId: string, orgId: string) {
        await this.#ensureInitialized();
        return this.#commandService.setDefaultPaymentMethod(paymentMethodId, orgId);
    }

    async createSetupIntent(orgId: string, email: string, orgName: string) {
        await this.#ensureInitialized();
        return this.#commandService.createSetupIntent(orgId, email, orgName);
    }

    async getBillingAlerts(orgId: string) {
        await this.#ensureInitialized();
        return this.#queryService.getBillingAlerts(orgId);
    }

    async updateBillingAlerts(orgId: string, settings: UpdateBillingAlertsData) {
        await this.#ensureInitialized();
        return this.#commandService.updateBillingAlerts(orgId, settings);
    }

    async getTaxSettings(orgId: string) {
        await this.#ensureInitialized();
        return this.#queryService.getTaxSettings(orgId);
    }

    async updateTaxSettings(orgId: string, settings: UpdateTaxSettingsData) {
        await this.#ensureInitialized();
        return this.#commandService.updateTaxSettings(orgId, settings);
    }

    async validateDiscountCode(code: string, planId: string) {
        await this.#ensureInitialized();
        return this.#commandService.validateDiscountCode(code, planId);
    }

    async incrementDiscountCodeUsage(codeId: string) {
        await this.#ensureInitialized();
        return this.#commandService.incrementDiscountCodeUsage(codeId);
    }

    async getSeatPricing(planId: string) {
        await this.#ensureInitialized();
        return this.#queryService.getSeatPricing(planId);
    }

    async calculateSeatCost(orgId: string, quantity: number) {
        await this.#ensureInitialized();
        return this.#commandService.calculateSeatCost(orgId, quantity);
    }

    async processSeatPurchase(orgId: string, quantity: number, paymentMethodId: string) {
        await this.#ensureInitialized();
        return this.#commandService.processSeatPurchase(orgId, quantity, paymentMethodId);
    }

    async getBillingModel(orgId: string) {
        await this.#ensureInitialized();
        return this.#queryService.getBillingModel(orgId);
    }
}

const billingServiceInstance = new BillingServiceClass();

export const setDependencies = (newDeps: Partial<BillingServiceDependencies>) =>
    billingServiceInstance.setDependencies(newDeps);
export const getPlans = () => billingServiceInstance.getPlans();
export const getPlanById = (planId: string) => billingServiceInstance.getPlanById(planId);
export const createPlan = (planData: CreatePlanData) => billingServiceInstance.createPlan(planData);
export const updatePlan = (planId: string, updates: UpdatePlanData) => billingServiceInstance.updatePlan(planId, updates);
export const deletePlan = (planId: string) => billingServiceInstance.deletePlan(planId);
export const getUserPlans = () => billingServiceInstance.getUserPlans();
export const createUserPlan = (planData: CreateUserPlanData) => billingServiceInstance.createUserPlan(planData);
export const updateUserPlan = (planId: string, updates: UpdateUserPlanData) => billingServiceInstance.updateUserPlan(planId, updates);
export const deleteUserPlan = (planId: string) => billingServiceInstance.deleteUserPlan(planId);
export const getOrganizationBilling = (orgId: string) => billingServiceInstance.getOrganizationBilling(orgId);
export const upsertOrganizationBilling = (orgId: string, billingData: UpsertBillingData) => billingServiceInstance.upsertOrgBilling(orgId, billingData);
export const getOrCreateStripeCustomer = (orgId: string, email: string, orgName: string) => billingServiceInstance.getOrCreateStripeCustomer(orgId, email, orgName);
export const createSubscription = (orgId: string, planId: string, paymentMethodId: string, email: string, orgName: string) =>
    billingServiceInstance.createSubscription(orgId, planId, paymentMethodId, email, orgName);
export const cancelSubscription = (orgId: string) => billingServiceInstance.cancelSubscription(orgId);
export const changePlan = (orgId: string, newPlanId: string) => billingServiceInstance.changePlan(orgId, newPlanId);
export const getInvoices = (orgId: string) => billingServiceInstance.getInvoices(orgId);
export const recordInvoice = (orgId: string, stripeInvoice: Stripe.Invoice) => billingServiceInstance.recordInvoice(orgId, stripeInvoice);
export const getRevenueStats = () => billingServiceInstance.getRevenueStats();
export const getPaymentMethods = (orgId: string) => billingServiceInstance.getPaymentMethods(orgId);
export const getPaymentMethod = (paymentMethodId: string) => billingServiceInstance.getPaymentMethod(paymentMethodId);
export const addPaymentMethod = (orgId: string, stripePaymentMethodId: string) => billingServiceInstance.addPaymentMethod(orgId, stripePaymentMethodId);
export const removePaymentMethod = (paymentMethodId: string, orgId: string) => billingServiceInstance.removePaymentMethod(paymentMethodId, orgId);
export const setDefaultPaymentMethod = (paymentMethodId: string, orgId: string) => billingServiceInstance.setDefaultPaymentMethod(paymentMethodId, orgId);
export const createSetupIntent = (orgId: string, email: string, orgName: string) => billingServiceInstance.createSetupIntent(orgId, email, orgName);
export const getBillingAlerts = (orgId: string) => billingServiceInstance.getBillingAlerts(orgId);
export const updateBillingAlerts = (orgId: string, alertSettings: UpdateBillingAlertsData) => billingServiceInstance.updateBillingAlerts(orgId, alertSettings);
export const getTaxSettings = (orgId: string) => billingServiceInstance.getTaxSettings(orgId);
export const updateTaxSettings = (orgId: string, taxSettings: UpdateTaxSettingsData) => billingServiceInstance.updateTaxSettings(orgId, taxSettings);
export const validateDiscountCode = (code: string, planId: string) => billingServiceInstance.validateDiscountCode(code, planId);
export const incrementDiscountCodeUsage = (codeId: string) => billingServiceInstance.incrementDiscountCodeUsage(codeId);
export const getSeatPricing = (planId: string) => billingServiceInstance.getSeatPricing(planId);
export const calculateSeatCost = (orgId: string, quantity: number) => billingServiceInstance.calculateSeatCost(orgId, quantity);
export const processSeatPurchase = (orgId: string, quantity: number, paymentMethodId: string) =>
    billingServiceInstance.processSeatPurchase(orgId, quantity, paymentMethodId);
export const getBillingModel = (orgId: string) => billingServiceInstance.getBillingModel(orgId);
