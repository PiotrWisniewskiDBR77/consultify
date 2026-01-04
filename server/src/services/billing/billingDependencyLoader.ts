import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { BillingServiceDependencies } from './types.js';

export class BillingDependencyLoader {
    #deps: BillingServiceDependencies | null = null;
    #initPromise: Promise<void> | null = null;

    async init(): Promise<void> {
        if (this.#deps) return;
        if (this.#initPromise) return this.#initPromise;

        this.#initPromise = (async () => {
            const db = getDatabase();
            let stripe: Stripe | null = null;

            if (process.env.STRIPE_SECRET_KEY) {
                try {
                    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                        apiVersion: '2025-12-15.clover' as any,
                    });
                } catch (error: unknown) {
                    console.warn('[BillingDependencyLoader] Stripe initialization failed:', error);
                }
            }

            this.#deps = {
                db,
                uuidv4,
                stripe,
            };
        })();

        await this.#initPromise;
    }

    setDependencies(newDeps: Partial<BillingServiceDependencies>) {
        if (!this.#deps) throw new Error('Dependencies not initialized');
        this.#deps = {
            ...this.#deps,
            ...newDeps,
        };
    }

    get deps(): BillingServiceDependencies {
        if (!this.#deps) throw new Error('Dependencies not initialized');
        return this.#deps;
    }
}
