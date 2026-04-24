import logger from './Logger.js';

let ensurePromise: Promise<void> | null = null;

export function ensureUserOnboardingStatusTable(db: {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}) {
  if (!ensurePromise) {
    ensurePromise = db
      .query(
        `
        CREATE TABLE IF NOT EXISTS user_onboarding_status (
          user_id TEXT PRIMARY KEY,
          terms_accepted BOOLEAN DEFAULT FALSE,
          terms_accepted_at TIMESTAMP NULL,
          terms_version TEXT NULL,
          privacy_accepted BOOLEAN DEFAULT FALSE,
          privacy_accepted_at TIMESTAMP NULL,
          privacy_version TEXT NULL,
          pricing_tier TEXT NULL,
          pricing_tier_selected_at TIMESTAMP NULL,
          payment_setup BOOLEAN DEFAULT FALSE,
          payment_setup_at TIMESTAMP NULL,
          stripe_setup_intent_id TEXT NULL,
          completed BOOLEAN DEFAULT FALSE,
          completed_at TIMESTAMP NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
      )
      .then(() => undefined)
      .catch((error) => {
        ensurePromise = null;
        logger.error('[Onboarding] Failed to ensure user_onboarding_status table:', error);
        throw error;
      });
  }

  return ensurePromise;
}
