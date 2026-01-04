/**
 * Stripe Mock Server
 * 
 * Provides mock Stripe API responses for testing without live API calls.
 * Can be used with Jest or integrated into test server.
 */

import { v4 as uuidv4 } from 'uuid';

// Mock data stores
const mockData = {
    customers: new Map(),
    subscriptions: new Map(),
    invoices: new Map(),
    paymentMethods: new Map(),
    paymentIntents: new Map(),
    checkoutSessions: new Map(),
    prices: new Map(),
    products: new Map()
};

// ID generators
const generateId = (prefix) => `${prefix}_mock_${uuidv4().split('-')[0]}`;

/**
 * Mock Stripe Customers API
 */
export const mockStripeCustomers = () => ({
    create: jest.fn(async (params) => {
        const customer = {
            id: generateId('cus'),
            object: 'customer',
            email: params.email,
            name: params.name,
            metadata: params.metadata || {},
            created: Math.floor(Date.now() / 1000),
            invoice_settings: {
                default_payment_method: null
            }
        };
        mockData.customers.set(customer.id, customer);
        return customer;
    }),

    retrieve: jest.fn(async (customerId) => {
        const customer = mockData.customers.get(customerId);
        if (!customer) {
            const error = new Error('No such customer');
            error.type = 'StripeInvalidRequestError';
            throw error;
        }
        return customer;
    }),

    update: jest.fn(async (customerId, params) => {
        const customer = mockData.customers.get(customerId);
        if (!customer) {
            const error = new Error('No such customer');
            error.type = 'StripeInvalidRequestError';
            throw error;
        }
        Object.assign(customer, params);
        return customer;
    }),

    del: jest.fn(async (customerId) => {
        mockData.customers.delete(customerId);
        return { id: customerId, object: 'customer', deleted: true };
    })
});

/**
 * Mock Stripe Subscriptions API
 */
export const mockStripeSubscriptions = () => ({
    create: jest.fn(async (params) => {
        const subscription = {
            id: generateId('sub'),
            object: 'subscription',
            customer: params.customer,
            status: 'active',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            items: {
                data: params.items?.map((item, index) => ({
                    id: generateId('si'),
                    price: {
                        id: item.price,
                        nickname: 'Test Plan'
                    }
                })) || []
            },
            metadata: params.metadata || {},
            cancel_at_period_end: false,
            canceled_at: null,
            trial_start: params.trial_period_days ? Math.floor(Date.now() / 1000) : null,
            trial_end: params.trial_period_days 
                ? Math.floor(Date.now() / 1000) + params.trial_period_days * 24 * 60 * 60 
                : null
        };
        mockData.subscriptions.set(subscription.id, subscription);
        return subscription;
    }),

    retrieve: jest.fn(async (subscriptionId) => {
        const subscription = mockData.subscriptions.get(subscriptionId);
        if (!subscription) {
            const error = new Error('No such subscription');
            error.type = 'StripeInvalidRequestError';
            throw error;
        }
        return subscription;
    }),

    update: jest.fn(async (subscriptionId, params) => {
        const subscription = mockData.subscriptions.get(subscriptionId);
        if (!subscription) {
            const error = new Error('No such subscription');
            error.type = 'StripeInvalidRequestError';
            throw error;
        }
        Object.assign(subscription, params);
        return subscription;
    }),

    cancel: jest.fn(async (subscriptionId) => {
        const subscription = mockData.subscriptions.get(subscriptionId);
        if (!subscription) {
            const error = new Error('No such subscription');
            error.type = 'StripeInvalidRequestError';
            throw error;
        }
        subscription.status = 'canceled';
        subscription.canceled_at = Math.floor(Date.now() / 1000);
        return subscription;
    })
});

/**
 * Mock Stripe Invoices API
 */
export const mockStripeInvoices = () => ({
    create: jest.fn(async (params) => {
        const invoice = {
            id: generateId('in'),
            object: 'invoice',
            customer: params.customer,
            subscription: params.subscription,
            status: 'draft',
            amount_due: params.amount_due || 9900,
            amount_paid: 0,
            currency: params.currency || 'usd',
            number: `INV-${Date.now()}`,
            created: Math.floor(Date.now() / 1000),
            due_date: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            lines: {
                data: params.lines || []
            },
            metadata: params.metadata || {}
        };
        mockData.invoices.set(invoice.id, invoice);
        return invoice;
    }),

    retrieve: jest.fn(async (invoiceId) => {
        const invoice = mockData.invoices.get(invoiceId);
        if (!invoice) {
            const error = new Error('No such invoice');
            error.type = 'StripeInvalidRequestError';
            throw error;
        }
        return invoice;
    }),

    pay: jest.fn(async (invoiceId) => {
        const invoice = mockData.invoices.get(invoiceId);
        if (!invoice) {
            const error = new Error('No such invoice');
            error.type = 'StripeInvalidRequestError';
            throw error;
        }
        invoice.status = 'paid';
        invoice.amount_paid = invoice.amount_due;
        invoice.paid_at = Math.floor(Date.now() / 1000);
        return invoice;
    }),

    list: jest.fn(async (params) => {
        const invoices = Array.from(mockData.invoices.values())
            .filter(inv => !params.customer || inv.customer === params.customer);
        return {
            object: 'list',
            data: invoices,
            has_more: false
        };
    })
});

/**
 * Mock Stripe Payment Methods API
 */
export const mockStripePaymentMethods = () => ({
    create: jest.fn(async (params) => {
        const paymentMethod = {
            id: generateId('pm'),
            object: 'payment_method',
            type: params.type || 'card',
            card: {
                brand: 'visa',
                last4: '4242',
                exp_month: 12,
                exp_year: 2030
            },
            billing_details: params.billing_details || {},
            created: Math.floor(Date.now() / 1000)
        };
        mockData.paymentMethods.set(paymentMethod.id, paymentMethod);
        return paymentMethod;
    }),

    retrieve: jest.fn(async (paymentMethodId) => {
        const pm = mockData.paymentMethods.get(paymentMethodId);
        if (!pm) {
            const error = new Error('No such payment method');
            error.type = 'StripeInvalidRequestError';
            throw error;
        }
        return pm;
    }),

    attach: jest.fn(async (paymentMethodId, params) => {
        const pm = mockData.paymentMethods.get(paymentMethodId);
        if (!pm) {
            const error = new Error('No such payment method');
            error.type = 'StripeInvalidRequestError';
            throw error;
        }
        pm.customer = params.customer;
        return pm;
    }),

    detach: jest.fn(async (paymentMethodId) => {
        const pm = mockData.paymentMethods.get(paymentMethodId);
        if (!pm) {
            const error = new Error('No such payment method');
            error.type = 'StripeInvalidRequestError';
            throw error;
        }
        pm.customer = null;
        return pm;
    }),

    list: jest.fn(async (params) => {
        const methods = Array.from(mockData.paymentMethods.values())
            .filter(pm => pm.customer === params.customer);
        return {
            object: 'list',
            data: methods,
            has_more: false
        };
    })
});

/**
 * Mock Stripe Checkout Sessions API
 */
export const mockStripeCheckout = () => ({
    sessions: {
        create: jest.fn(async (params) => {
            const session = {
                id: generateId('cs'),
                object: 'checkout.session',
                url: `https://checkout.stripe.com/c/pay/cs_mock_${Date.now()}`,
                mode: params.mode,
                customer: params.customer,
                success_url: params.success_url,
                cancel_url: params.cancel_url,
                status: 'open',
                amount_total: params.line_items?.[0]?.price ? 9900 : 0,
                metadata: params.metadata || {},
                expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60
            };
            mockData.checkoutSessions.set(session.id, session);
            return session;
        }),

        retrieve: jest.fn(async (sessionId) => {
            const session = mockData.checkoutSessions.get(sessionId);
            if (!session) {
                const error = new Error('No such checkout session');
                error.type = 'StripeInvalidRequestError';
                throw error;
            }
            return session;
        })
    }
});

/**
 * Mock Stripe Billing Portal
 */
export const mockStripeBillingPortal = () => ({
    sessions: {
        create: jest.fn(async (params) => {
            return {
                id: generateId('bps'),
                object: 'billing_portal.session',
                url: `https://billing.stripe.com/p/session/mock_${Date.now()}`,
                customer: params.customer,
                return_url: params.return_url,
                created: Math.floor(Date.now() / 1000)
            };
        })
    }
});

/**
 * Mock Stripe Payment Intents API
 */
export const mockStripePaymentIntents = () => ({
    create: jest.fn(async (params) => {
        const paymentIntent = {
            id: generateId('pi'),
            object: 'payment_intent',
            amount: params.amount,
            currency: params.currency || 'usd',
            customer: params.customer,
            status: 'requires_payment_method',
            client_secret: `${generateId('pi')}_secret_mock`,
            metadata: params.metadata || {},
            created: Math.floor(Date.now() / 1000)
        };
        mockData.paymentIntents.set(paymentIntent.id, paymentIntent);
        return paymentIntent;
    }),

    retrieve: jest.fn(async (paymentIntentId) => {
        const pi = mockData.paymentIntents.get(paymentIntentId);
        if (!pi) {
            const error = new Error('No such payment intent');
            error.type = 'StripeInvalidRequestError';
            throw error;
        }
        return pi;
    }),

    confirm: jest.fn(async (paymentIntentId, params) => {
        const pi = mockData.paymentIntents.get(paymentIntentId);
        if (!pi) {
            const error = new Error('No such payment intent');
            error.type = 'StripeInvalidRequestError';
            throw error;
        }
        pi.status = 'succeeded';
        pi.payment_method = params.payment_method;
        return pi;
    })
});

/**
 * Mock Stripe Webhooks
 */
export const mockStripeWebhooks = () => ({
    constructEvent: jest.fn((payload, signature, secret) => {
        // In mock mode, just parse the payload
        const event = typeof payload === 'string' ? JSON.parse(payload) : payload;
        return event;
    })
});

/**
 * Create complete mock Stripe instance
 */
export function createMockStripe() {
    return {
        customers: mockStripeCustomers(),
        subscriptions: mockStripeSubscriptions(),
        invoices: mockStripeInvoices(),
        paymentMethods: mockStripePaymentMethods(),
        checkout: mockStripeCheckout(),
        billingPortal: mockStripeBillingPortal(),
        paymentIntents: mockStripePaymentIntents(),
        webhooks: mockStripeWebhooks()
    };
}

/**
 * Reset all mock data
 */
export function resetMockData() {
    mockData.customers.clear();
    mockData.subscriptions.clear();
    mockData.invoices.clear();
    mockData.paymentMethods.clear();
    mockData.paymentIntents.clear();
    mockData.checkoutSessions.clear();
    mockData.prices.clear();
    mockData.products.clear();
}

/**
 * Seed mock data for testing
 */
export function seedMockData() {
    // Create a test customer
    const customer = {
        id: 'cus_test_123',
        object: 'customer',
        email: 'test@example.com',
        name: 'Test Customer',
        created: Math.floor(Date.now() / 1000)
    };
    mockData.customers.set(customer.id, customer);

    // Create a test subscription
    const subscription = {
        id: 'sub_test_123',
        object: 'subscription',
        customer: 'cus_test_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
            data: [{
                id: 'si_test_123',
                price: { id: 'price_test_123', nickname: 'Pro Plan' }
            }]
        }
    };
    mockData.subscriptions.set(subscription.id, subscription);

    // Create a test payment method
    const paymentMethod = {
        id: 'pm_test_123',
        object: 'payment_method',
        type: 'card',
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
        customer: 'cus_test_123'
    };
    mockData.paymentMethods.set(paymentMethod.id, paymentMethod);

    // Create test invoices
    const invoice = {
        id: 'in_test_123',
        object: 'invoice',
        customer: 'cus_test_123',
        subscription: 'sub_test_123',
        status: 'paid',
        amount_due: 9900,
        amount_paid: 9900,
        currency: 'usd',
        number: 'INV-001'
    };
    mockData.invoices.set(invoice.id, invoice);

    return { customer, subscription, paymentMethod, invoice };
}

export default {
    createMockStripe,
    resetMockData,
    seedMockData,
    mockStripeCustomers,
    mockStripeSubscriptions,
    mockStripeInvoices,
    mockStripePaymentMethods,
    mockStripeCheckout,
    mockStripeBillingPortal,
    mockStripePaymentIntents,
    mockStripeWebhooks
};

