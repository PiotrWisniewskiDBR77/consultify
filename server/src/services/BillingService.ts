/**
 * Billing Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Handles Stripe integration, subscriptions, and invoice management
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 */

import type { IDatabase, RunResult } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import { createRequire } from 'module';
import logger from '../utils/Logger.js';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const billingServiceJS = require('../../services/billingService.js');

// Re-export all functions with proper types
export const setDependencies = billingServiceJS.setDependencies;
export const getPlans = billingServiceJS.getPlans;
export const getPlanById = billingServiceJS.getPlanById;
export const createPlan = billingServiceJS.createPlan;
export const updatePlan = billingServiceJS.updatePlan;
export const deletePlan = billingServiceJS.deletePlan;
export const getOrganizationBilling = billingServiceJS.getOrganizationBilling;
export const upsertOrganizationBilling = billingServiceJS.upsertOrganizationBilling;
export const getOrCreateStripeCustomer = billingServiceJS.getOrCreateStripeCustomer;
export const createSubscription = billingServiceJS.createSubscription;
export const cancelSubscription = billingServiceJS.cancelSubscription;
export const changePlan = billingServiceJS.changePlan;
export const getInvoices = billingServiceJS.getInvoices;
export const recordInvoice = billingServiceJS.recordInvoice;
export const getRevenueStats = billingServiceJS.getRevenueStats;
export const getUserPlans = billingServiceJS.getUserPlans;
export const createUserPlan = billingServiceJS.createUserPlan;
export const updateUserPlan = billingServiceJS.updateUserPlan;
export const deleteUserPlan = billingServiceJS.deleteUserPlan;
export const getPaymentMethods = billingServiceJS.getPaymentMethods;
export const getPaymentMethod = billingServiceJS.getPaymentMethod;
export const addPaymentMethod = billingServiceJS.addPaymentMethod;
export const removePaymentMethod = billingServiceJS.removePaymentMethod;
export const setDefaultPaymentMethod = billingServiceJS.setDefaultPaymentMethod;
export const createSetupIntent = billingServiceJS.createSetupIntent;
export const getBillingAlerts = billingServiceJS.getBillingAlerts;
export const updateBillingAlerts = billingServiceJS.updateBillingAlerts;
export const getTaxSettings = billingServiceJS.getTaxSettings;
export const updateTaxSettings = billingServiceJS.updateTaxSettings;
export const validateDiscountCode = billingServiceJS.validateDiscountCode;
export const incrementDiscountCodeUsage = billingServiceJS.incrementDiscountCodeUsage;
export const getSeatPricing = billingServiceJS.getSeatPricing;
export const calculateSeatCost = billingServiceJS.calculateSeatCost;
export const processSeatPurchase = billingServiceJS.processSeatPurchase;
export const getBillingModel = billingServiceJS.getBillingModel;

// Default export for backward compatibility
const billingService = {
    setDependencies,
    getPlans,
    getPlanById,
    createPlan,
    updatePlan,
    deletePlan,
    getOrganizationBilling,
    upsertOrganizationBilling,
    getOrCreateStripeCustomer,
    createSubscription,
    cancelSubscription,
    changePlan,
    getInvoices,
    recordInvoice,
    getRevenueStats,
    getUserPlans,
    createUserPlan,
    updateUserPlan,
    deleteUserPlan,
    getPaymentMethods,
    getPaymentMethod,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    createSetupIntent,
    getBillingAlerts,
    updateBillingAlerts,
    getTaxSettings,
    updateTaxSettings,
    validateDiscountCode,
    incrementDiscountCodeUsage,
    getSeatPricing,
    calculateSeatCost,
    processSeatPurchase,
    getBillingModel
};

export default billingService;

