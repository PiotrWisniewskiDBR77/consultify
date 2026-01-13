/**
 * Type declarations for 'stripe' module
 * Note: Install @types/stripe or stripe package for full types
 */

declare module 'stripe' {
    export interface StripeConfig {
        apiVersion?: string;
        [key: string]: any;
    }

    export namespace Stripe {
        export interface Customer {
            id: string;
            email?: string | null;
            [key: string]: any;
        }
        export interface Invoice {
            id: string;
            amount_due?: number;
            amount_paid?: number;
            currency?: string;
            metadata?: Record<string, string>;
            payment_intent?: string | null;
            last_payment_error?: { message?: string; code?: string } | null;
            [key: string]: any;
        }
        export interface Subscription {
            id: string;
            status: string;
            customer: string | Customer;
            current_period_start: number;
            current_period_end: number;
            [key: string]: any;
        }
        export interface PaymentIntent {
            id: string;
            amount: number;
            currency: string;
            metadata?: Record<string, string>;
            last_payment_error?: { message?: string; code?: string } | null;
            [key: string]: any;
        }
        export interface Price {
            id: string;
            [key: string]: any;
        }
        export interface Plan {
            id: string;
            [key: string]: any;
        }
        export interface Event {
            type: string;
            data: {
                object: any;
            };
            [key: string]: any;
        }
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
        webhooks: {
            constructEvent(payload: string | Buffer, sig: string, secret: string): Stripe.Event;
        };
        [key: string]: any;
    }
    
    // Export namespace at module level for direct access
    export import StripeTypes = Stripe;
}
