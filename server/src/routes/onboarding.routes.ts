/**
 * Onboarding Routes
 * Enterprise onboarding flow: Terms → Pricing → Payment
 */

import { Response, Router } from 'express';

import { getDatabase } from '../database/index.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import logger from '../utils/Logger.js';

const router = Router();
const db = getDatabase();

// Apply auth middleware to all routes
router.use(verifyToken);

/**
 * GET /api/onboarding/status
 * Get current user's onboarding status
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
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

    res.json(status);
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

    // Upsert onboarding status
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

export default router;
