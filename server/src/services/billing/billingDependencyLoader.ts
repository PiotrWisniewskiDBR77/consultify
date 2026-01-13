import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

import { config } from '../../config/index.js';
import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
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

      // 1. If MOCK_BILLING is enabled, we explicitly SKIP Stripe initialization
      // 2. If STRIPE_SECRET_KEY is present (and not mocked), we initialize Stripe
      // 3. If neither, we log a warning (dev/test env)

      if (config.MOCK_BILLING) {
        logger.info(
          '[BillingDependencyLoader] MOCK_BILLING enabled. Skipping Stripe initialization.'
        );
      } else if (config.STRIPE_SECRET_KEY) {
        try {
          stripe = new Stripe(config.STRIPE_SECRET_KEY, {
            apiVersion: '2025-12-15.clover' as any,
          });
        } catch (error: unknown) {
          logger.warn('[BillingDependencyLoader] Stripe initialization failed:', error);
        }
      } else {
        // Should be unreachable in PRODUCTION due to Config.ts validation
        logger.warn('[BillingDependencyLoader] No Stripe Key found. Falling back to MOCK mode.');
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
