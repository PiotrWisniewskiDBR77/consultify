// @ts-nocheck
/**
 * Onboarding Routes
 * Enterprise onboarding flow: Terms → Pricing → Payment
 * T093: accept-terms now also records in legal_document_acceptances (single source of truth)
 */

import { Response, Router } from 'express';

import { getDatabase } from '../database/index.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import legalService from '../services/legalService.js';
import { ensureUserOnboardingStatusTable } from '../utils/ensureUserOnboardingStatusTable.js';
import logger from '../utils/Logger.js';

const router = Router();
const db = getDatabase();

function getOrganizationId(req: AuthRequest): string | null {
  return req.organizationId || req.user?.organizationId || null;
}

// Apply auth middleware to all routes
router.use(verifyToken);
router.use(async (_req, _res, next) => {
  try {
    await ensureUserOnboardingStatusTable(db as any);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/onboarding/status
 * Get current user's onboarding status
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const organizationId = getOrganizationId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get onboarding status
    const result = await db.query(`SELECT *FROM user_onboarding_status WHERE user_id = $1`, [
      userId,
    ]);

    const status = result.rows[0] || {
      user_id: userId,
      terms_accepted: false,
      privacy_accepted: false,
      pricing_tier: null,
      payment_setup: false,
      completed: false,
    };

    let organizationOnboardingStatus = 'NOT_STARTED';
    if (organizationId) {
      const orgResult = await db.query(
        `SELECT onboarding_status FROM organizations WHERE id = $1`,
        [organizationId]
      );
      organizationOnboardingStatus = orgResult.rows[0]?.onboarding_status || 'NOT_STARTED';
    }

    res.json({
      ...status,
      organizationId,
      organizationOnboardingStatus,
      organizationSetupCompleted: organizationOnboardingStatus === 'ORG_SETUP_COMPLETED',
    });
  } catch (error) {
    logger.error('Error fetching onboarding status:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding status' });
  }
});

/**
 * POST /api/onboarding/accept-terms
 * Accept Terms & Conditions and Privacy Policy
 */
router.post('/accept-terms', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { termsVersion = 'v1.0', privacyVersion = 'v1.0' } = req.body;

    // Upsert onboarding status (legacy table)
    await db.query(
      `INSERT INTO user_onboarding_status (
                user_id, terms_accepted, terms_accepted_at, terms_version,
                privacy_accepted, privacy_accepted_at, privacy_version, updated_at
            ) VALUES ($1, true, NOW(), $2, true, NOW(), $3, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                terms_accepted = true,
                terms_accepted_at = NOW(),
                terms_version = $2,
                privacy_accepted = true,
                privacy_accepted_at = NOW(),
                privacy_version = $3,
                updated_at = NOW()`,
      [userId, termsVersion, privacyVersion]
    );

    // T093: Also record in legal_document_acceptances (single source of truth)
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '';
    const userAgent = (req.headers['user-agent'] as string) || '';
    const organizationId = getOrganizationId(req);

    try {
      await legalService.acceptDocuments(
        userId,
        ['TOS', 'PRIVACY'],
        'USER',
        ipAddress,
        userAgent,
        organizationId
      );
    } catch (legalErr) {
      logger.warn('[Onboarding] Legal acceptance sync failed (non-blocking):', legalErr);
    }

    res.json({ success: true, message: 'Terms accepted' });
  } catch (error) {
    logger.error('Error accepting terms:', error);
    res.status(500).json({ error: 'Failed to accept terms' });
  }
});

/**
 * POST /api/onboarding/select-tier
 * Select pricing tier
 */
router.post('/select-tier', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tier } = req.body;
    const validTiers = ['starter', 'professional', 'enterprise'];

    if (!tier || !validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid pricing tier' });
    }

    // Update pricing tier
    await db.query(
      `INSERT INTO user_onboarding_status (user_id, pricing_tier, pricing_tier_selected_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                pricing_tier = $2,
                pricing_tier_selected_at = NOW(),
                updated_at = NOW()`,
      [userId, tier]
    );

    res.json({ success: true, tier, message: 'Pricing tier selected' });
  } catch (error) {
    logger.error('Error selecting tier:', error);
    res.status(500).json({ error: 'Failed to select pricing tier' });
  }
});

/**
 * POST /api/onboarding/setup-payment
 * Mark payment method as setup (after Stripe integration)
 */
router.post('/setup-payment', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { setupIntentId } = req.body;

    // Update payment setup status
    await db.query(
      `INSERT INTO user_onboarding_status (
                user_id, payment_setup, payment_setup_at, 
                stripe_setup_intent_id, updated_at
            ) VALUES ($1, true, NOW(), $2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                payment_setup = true,
                payment_setup_at = NOW(),
                stripe_setup_intent_id = $2,
                updated_at = NOW()`,
      [userId, setupIntentId]
    );

    res.json({ success: true, message: 'Payment method setup complete' });
  } catch (error) {
    logger.error('Error setting up payment:', error);
    res.status(500).json({ error: 'Failed to setup payment method' });
  }
});

/**
 * POST /api/onboarding/complete
 * Mark onboarding as completed
 */
router.post('/complete', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify all steps are completed
    const statusResult = await db.query(`SELECT * FROM user_onboarding_status WHERE user_id = $1`, [
      userId,
    ]);

    const status = statusResult.rows[0];
    if (!status) {
      return res.status(400).json({ error: 'No onboarding status found' });
    }

    if (!status.terms_accepted || !status.privacy_accepted) {
      return res.status(400).json({ error: 'Terms not accepted' });
    }

    if (!status.pricing_tier) {
      return res.status(400).json({ error: 'Pricing tier not selected' });
    }

    // Payment setup is optional for now (can be "Skip for now")
    // if (!status.payment_setup) {
    //     return res.status(400).json({ error: 'Payment not setup' });
    // }

    // Mark as completed
    await db.query(
      `UPDATE user_onboarding_status SET
                completed = true,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE user_id = $1`,
      [userId]
    );

    // Also update users table
    await db.query(`UPDATE users SET onboarding_completed = true WHERE id = $1`, [userId]);

    res.json({ success: true, message: 'Onboarding completed!' });
  } catch (error) {
    logger.error('Error completing onboarding:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

/**
 * POST /api/onboarding/context
 *
 * S1.14b / B4 (pomiar 13.09, staging): the front has called this route since
 * Phase E (`src/services/api.ts` saveOnboardingContext, `users.api.ts`), but the
 * server NEVER defined it — `POST /api/onboarding/context` answered 404
 * API_ROUTE_NOT_FOUND, so "Generate My Strategy" died on its first step and the
 * only wizard that could set `onboarding_status='ORG_SETUP_COMPLETED'` from that
 * screen could not be finished. Phantom wołacz, zero implementacji serwerowej
 * (grep: dwa wołacze w `src/`, zero definicji w `server/src`).
 *
 * This persists the supplied context on the organization (merged into
 * `attribution_data.onboardingContext`) and marks org setup complete — the one
 * field the trial AI gate reads (`accessPolicyService.ts`, TRIAL + 'ai_call').
 * It does NOT generate anything: `POST /api/onboarding/generate-plan` and
 * `/accept-plan` remain undefined on the server and are reported as a separate,
 * owner-level gap rather than invented here.
 */
router.post('/context', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = getOrganizationId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!orgId) {
      // Kod, nie zdanie: tekst dla uzytkownika bierze sie z katalogu i18n
      // frontu (bramka jezykowa J0 liczy angielskie zdania serwera w UI).
      return res.status(400).json({ error: 'ORG_CONTEXT_REQUIRED', code: 'ORG_CONTEXT_REQUIRED' });
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const str = (value: unknown, max = 4000): string | null => {
      const normalized = String(value ?? '').trim();
      return normalized ? normalized.slice(0, max) : null;
    };

    const context = {
      role: str(body.role, 200),
      industry: str(body.industry, 200),
      problems: str(body.problems),
      urgency: str(body.urgency, 50),
      targets: str(body.targets),
      savedAt: new Date().toISOString(),
      savedBy: userId,
    };

    const existingRow = await db.query(
      `SELECT attribution_data FROM organizations WHERE id = $1`,
      [orgId]
    );
    let attribution: Record<string, unknown> = {};
    const rawAttribution = existingRow?.rows?.[0]?.attribution_data;
    if (rawAttribution) {
      try {
        attribution =
          typeof rawAttribution === 'string' ? JSON.parse(rawAttribution) : rawAttribution;
      } catch {
        attribution = {};
      }
    }
    if (!attribution || typeof attribution !== 'object') attribution = {};
    attribution.onboardingContext = context;

    await db.query(
      `UPDATE organizations
          SET attribution_data = $1,
              onboarding_status = 'ORG_SETUP_COMPLETED',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
      [JSON.stringify(attribution), orgId]
    );

    return res.json({ success: true, organizationId: orgId, context });
  } catch (error) {
    logger.error('Error saving onboarding context:', error);
    return res.status(500).json({ error: 'ONBOARDING_CONTEXT_SAVE_FAILED', code: 'ONBOARDING_CONTEXT_SAVE_FAILED' });
  }
});

/**
 * POST /api/onboarding/skip
 * Skip org setup wizard — marks organization onboarding as completed
 */
router.post('/skip', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = getOrganizationId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (orgId) {
      await db.query(
        `UPDATE organizations SET onboarding_status = 'ORG_SETUP_COMPLETED' WHERE id = $1`,
        [orgId]
      );
    }

    await db.query(`UPDATE users SET onboarding_completed = true WHERE id = $1`, [userId]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error skipping onboarding:', error);
    res.status(500).json({ error: 'Failed to skip onboarding' });
  }
});

export default router;
