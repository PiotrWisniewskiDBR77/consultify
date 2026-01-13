/**
 * Type declarations for 'stripe' module
 * Note: Install @types/stripe or stripe package for full types
 */

declare module 'stripe' {
    export interface StripeConfig {
        apiVersion?: string;
        [key: string]: any;
    }

    export default class Stripe {
        constructor(apiKey: string, config?: StripeConfig);
        customers: any;
        subscriptions: any;
        invoices: any;
        paymentIntents: any;
        setupIntents: any;
        products: any;
        prices: any;
        [key: string]: any;
    }
}
