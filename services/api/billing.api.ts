/**
 * Billing API Module
 * Enterprise SaaS Architecture - Subscriptions, Payments, Invoices
 */

import { API_URL, fetchWithRetry, handleResponse, getHeaders, httpClient } from './baseClient';
import type { SubscriptionPlan, PaymentMethod, Invoice, TokenBalance, TokenTransaction } from './types';

export const BillingApi = {
    // ==========================================
    // SUBSCRIPTION PLANS
    // ==========================================
    
    getSubscriptionPlans: async (): Promise<SubscriptionPlan[]> => {
        const res = await fetch(`${API_URL}/billing/plans`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch plans');
        return json;
    },

    getUserPlans: async (): Promise<SubscriptionPlan[]> => {
        const res = await fetch(`${API_URL}/billing/user-plans`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch user plans');
        return json;
    },

    getCurrentBilling: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/current`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch billing');
        return json;
    },

    getUsage: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/usage`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch usage');
        return json;
    },

    // ==========================================
    // SUBSCRIPTIONS
    // ==========================================
    
    subscribeToPlan: async (planId: string, paymentMethodId?: string): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/subscribe`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ planId, paymentMethodId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Subscription failed');
        return json;
    },

    changePlan: async (newPlanId: string): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/change-plan`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ newPlanId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Plan change failed');
        return json;
    },

    cancelSubscription: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/cancel`, {
            method: 'POST',
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Cancellation failed');
        return json;
    },

    // ==========================================
    // INVOICES
    // ==========================================
    
    getInvoices: async (): Promise<Invoice[]> => {
        const res = await fetch(`${API_URL}/billing/invoices`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch invoices');
        return json.invoices || [];
    },

    // ==========================================
    // PAYMENT METHODS
    // ==========================================
    
    getPaymentMethods: async (): Promise<{ methods: PaymentMethod[]; defaultId?: string }> => {
        const res = await fetch(`${API_URL}/billing/payment-methods`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch payment methods');
        return json;
    },

    addPaymentMethod: async (paymentMethodId: string): Promise<PaymentMethod> => {
        const res = await fetch(`${API_URL}/billing/payment-methods`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ paymentMethodId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to add payment method');
        return json;
    },

    removePaymentMethod: async (paymentMethodId: string): Promise<void> => {
        const res = await fetch(`${API_URL}/billing/payment-methods/${paymentMethodId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || 'Failed to remove payment method');
        }
    },

    setDefaultPaymentMethod: async (paymentMethodId: string): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/payment-methods/${paymentMethodId}/default`, {
            method: 'PUT',
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to set default payment method');
        return json;
    },

    createSetupIntent: async (): Promise<{ clientSecret: string; id: string }> => {
        const res = await fetch(`${API_URL}/billing/setup-intent`, {
            method: 'POST',
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create setup intent');
        return json;
    },

    // ==========================================
    // BILLING ALERTS
    // ==========================================
    
    getBillingAlerts: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/alerts`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch billing alerts');
        return json;
    },

    updateBillingAlerts: async (alerts: unknown): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/alerts`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(alerts)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to update billing alerts');
        return json;
    },

    // ==========================================
    // TAX SETTINGS
    // ==========================================
    
    getTaxSettings: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/tax-settings`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch tax settings');
        return json;
    },

    updateTaxSettings: async (settings: unknown): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/tax-settings`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to update tax settings');
        return json;
    },

    // ==========================================
    // DISCOUNT CODES
    // ==========================================
    
    validateDiscountCode: async (code: string, planId?: string): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/validate-discount`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ code, planId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to validate discount code');
        return json;
    },

    // ==========================================
    // SEAT MANAGEMENT
    // ==========================================
    
    getSeatConfiguration: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/seats`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch seat configuration');
        return json.config;
    },

    purchaseSeats: async (quantity: number, paymentMethodId?: string): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/seats/purchase`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ quantity, paymentMethodId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to purchase seats');
        return json;
    },

    toggleAutoAddSeats: async (enabled: boolean, threshold?: number): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/seats/auto-add`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ enabled, threshold })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to update auto-add settings');
        return json;
    },

    getSeatTransactions: async (limit = 50): Promise<unknown[]> => {
        const res = await fetch(`${API_URL}/billing/seats/transactions?limit=${limit}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch seat transactions');
        return json.transactions;
    },

    releaseSeat: async (userId: string): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/seats/release`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ userId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to release seat');
        return json;
    },

    // ==========================================
    // PAY-AS-YOU-GO
    // ==========================================
    
    getPayAsYouGoUsage: async (periodStart?: string, periodEnd?: string): Promise<unknown> => {
        const params = new URLSearchParams();
        if (periodStart) params.append('periodStart', periodStart);
        if (periodEnd) params.append('periodEnd', periodEnd);
        const res = await fetch(`${API_URL}/billing/payg/usage?${params}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to get PAYG usage');
        return json.usage;
    },

    getPayAsYouGoForecast: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/payg/forecast`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to get PAYG forecast');
        return json.forecast;
    },

    generatePayAsYouGoInvoice: async (periodStart: string, periodEnd: string): Promise<unknown> => {
        const res = await fetch(`${API_URL}/billing/payg/invoice`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ periodStart, periodEnd })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to generate PAYG invoice');
        return json;
    },

    // ==========================================
    // TOKEN BILLING
    // ==========================================
    
    getTokenBalance: async (): Promise<TokenBalance> => {
        const res = await fetch(`${API_URL}/token-billing/balance`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get balance');
        return data.balance;
    },

    getTokenPackages: async (): Promise<unknown[]> => {
        const res = await fetch(`${API_URL}/token-billing/packages`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get packages');
        return data.packages;
    },

    getTokenTransactions: async (limit = 50, offset = 0): Promise<TokenTransaction[]> => {
        const res = await fetch(`${API_URL}/token-billing/transactions?limit=${limit}&offset=${offset}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get transactions');
        return data.transactions;
    },

    purchaseTokens: async (packageId: string): Promise<unknown> => {
        const res = await fetch(`${API_URL}/token-billing/purchase`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ packageId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Purchase failed');
        return data;
    },

    // ==========================================
    // BUDGET MANAGEMENT
    // ==========================================
    
    getUserBudget: async (userId: string): Promise<unknown> => {
        const res = await fetch(`${API_URL}/budgets/user/${userId}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch user budget');
        return json.budget;
    },

    setUserBudget: async (userId: string, budget: unknown): Promise<unknown> => {
        const res = await fetch(`${API_URL}/budgets/user/${userId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(budget)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to set user budget');
        return json;
    },

    getProjectBudget: async (projectId: string): Promise<unknown> => {
        const res = await fetch(`${API_URL}/budgets/project/${projectId}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch project budget');
        return json.budget;
    },

    setProjectBudget: async (projectId: string, budget: unknown): Promise<unknown> => {
        const res = await fetch(`${API_URL}/budgets/project/${projectId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(budget)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to set project budget');
        return json;
    },

    getOrgBudget: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/budgets/organization`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch organization budget');
        return json.budget;
    },

    setOrgBudget: async (budget: unknown): Promise<unknown> => {
        const res = await fetch(`${API_URL}/budgets/organization`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(budget)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to set organization budget');
        return json;
    },

    getBudgetStatus: async (userId?: string, projectId?: string): Promise<unknown> => {
        const params = new URLSearchParams();
        if (userId) params.append('userId', userId);
        if (projectId) params.append('projectId', projectId);
        const res = await fetch(`${API_URL}/budgets/status?${params}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to get budget status');
        return json.budget;
    }
};


