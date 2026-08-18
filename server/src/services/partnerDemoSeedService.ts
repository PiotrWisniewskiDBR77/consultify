import crypto from 'node:crypto';

import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { isPartnerEconomicsOperationAvailable } from './partnerEconomicsPolicy.js';
import { ensurePartnerReferralIdentity } from './partnerReferralService.js';

const DEMO_CURRENCY = 'EUR';

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function dateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function countValue(row: { count?: number | string | null } | null | undefined): number {
  return Number(row?.count || 0);
}

async function tableExists(tableName: string): Promise<boolean> {
  try {
    return await DbPromise.tableExists(tableName);
  } catch {
    return false;
  }
}

/**
 * Demo partner data must NEVER auto-seed into production (owner decision D19/D22).
 * This guard makes the function a no-op in production unless an explicit demo
 * flag is set. In non-production it remains available for local/preview demos.
 * Partner demo data otherwise lives only in the canonical Atelier Toys seed
 * (npm run db:seed:atelier).
 *
 * Production override flags (default behavior is unchanged — both must be
 * explicitly set to 'true' to enable seeding in production):
 *  - DEMO_WRITES_ENABLED=true        — global demo-writes escape hatch.
 *  - PARTNER_DEMO_SEED_ENABLED=true  — partner-specific override that allows
 *                                      seeding even in production for a
 *                                      controlled, intentional demo.
 */
function isPartnerDemoSeedAllowed(): boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  const explicitDemoEnabled = process.env.DEMO_WRITES_ENABLED === 'true';
  const partnerDemoSeedEnabled = process.env.PARTNER_DEMO_SEED_ENABLED === 'true';
  return !isProduction || explicitDemoEnabled || partnerDemoSeedEnabled;
}

export async function ensurePartnerDemoDataset(partnerOrgId: string): Promise<void> {
  if (!partnerOrgId) return;
  if (!isPartnerDemoSeedAllowed()) {
    return;
  }
  const db = getDatabase();

  // AMD-PRT-ECONOMICS-002 (GAP A). This function runs as router-level
  // middleware (via requirePartnerOrgId / the v8 partner bridge) on
  // effectively every partner request, including plain GETs, and its whole
  // body below is already wrapped in a single try/catch that swallows any
  // error as a generic warning (see the catch at the bottom of this
  // function). That matters for HOW this guard is implemented:
  //
  // Calling `assertPartnerEconomicsOperationAllowed()` (throw-based) here
  // would NOT break ordinary requests — the outer catch already swallows any
  // throw — but it WOULD abort the rest of THIS function on the first
  // economic block, silently skipping the non-economic seeding that runs
  // afterwards (campaign links, referral clicks), which the owner decision
  // requires to keep working. So this guard instead reads the predicate
  // (`isPartnerEconomicsOperationAvailable()`) once and SKIPS only the two
  // economic write blocks (attributions, commission transactions/payouts)
  // with a log line, letting every non-economic block after them still run.
  const economicsSeedWritesAllowed = isPartnerEconomicsOperationAvailable();
  if (!economicsSeedWritesAllowed) {
    logger.info(
      '[PartnerDemoSeedService] Skipping economics demo seed writes (attributions/commissions/payouts) — disallowed by owner policy AMD-PRT-ECONOMICS-002',
      { partnerOrgId }
    );
  }

  try {
    await ensurePartnerReferralIdentity(partnerOrgId);

    const hasAttributions = await tableExists('partner_attributions');
    const hasCommissions = await tableExists('partner_commission_transactions');
    const hasPayouts = await tableExists('partner_payouts');
    const hasCampaignLinks = await tableExists('partner_campaign_links');
    const hasClicks = await tableExists('partner_referral_clicks');

    const [attrCountRow, txCountRow] = await Promise.all([
      hasAttributions
        ? DbPromise.get<{ count: number }>(
            db,
            `SELECT COUNT(*) as count FROM partner_attributions WHERE partner_org_id = ?`,
            [partnerOrgId]
          )
        : Promise.resolve({ count: 0 }),
      hasCommissions
        ? DbPromise.get<{ count: number }>(
            db,
            `SELECT COUNT(*) as count FROM partner_commission_transactions WHERE partner_org_id = ?`,
            [partnerOrgId]
          )
        : Promise.resolve({ count: 0 }),
    ]);
    const attrCount = countValue(attrCountRow);
    const txCount = countValue(txCountRow);

    const demoOrganizations = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    const attributionIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

    if (economicsSeedWritesAllowed && hasAttributions && attrCount === 0) {
      await DbPromise.transaction([
        {
          sql: `INSERT INTO partner_attributions
                  (id, partner_org_id, organization_id, attribution_type, referral_code_used,
                   signup_completed_at, first_payment_at, lifetime_value, total_commission_earned,
                   commission_rate_percent, commission_duration_months, status, attributed_at,
                   created_at, updated_at)
                VALUES (?, ?, ?, 'REFERRAL_LINK', 'PARTNER-DEMO', ?, ?, ?, ?, 12.5, 12, 'ACTIVE', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          params: [
            attributionIds[0],
            partnerOrgId,
            demoOrganizations[0],
            isoDaysAgo(48),
            isoDaysAgo(36),
            18500,
            1120,
            isoDaysAgo(50),
          ],
        },
        {
          sql: `INSERT INTO partner_attributions
                  (id, partner_org_id, organization_id, attribution_type, referral_code_used,
                   signup_completed_at, first_payment_at, lifetime_value, total_commission_earned,
                   commission_rate_percent, commission_duration_months, status, attributed_at,
                   created_at, updated_at)
                VALUES (?, ?, ?, 'PROMO_CODE', 'PARTNER-DEMO', ?, ?, ?, ?, 10.0, 12, 'ACTIVE', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          params: [
            attributionIds[1],
            partnerOrgId,
            demoOrganizations[1],
            isoDaysAgo(22),
            isoDaysAgo(14),
            9200,
            640,
            isoDaysAgo(24),
          ],
        },
        {
          sql: `INSERT INTO partner_attributions
                  (id, partner_org_id, organization_id, attribution_type, referral_code_used,
                   signup_completed_at, lifetime_value, total_commission_earned,
                   commission_rate_percent, commission_duration_months, status, attributed_at,
                   created_at, updated_at)
                VALUES (?, ?, ?, 'DEAL_REGISTRATION', 'PARTNER-DEMO', ?, ?, ?, 15.0, 12, 'PENDING', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          params: [
            attributionIds[2],
            partnerOrgId,
            demoOrganizations[2],
            isoDaysAgo(7),
            2800,
            0,
            isoDaysAgo(9),
          ],
        },
      ]);
    }

    if (economicsSeedWritesAllowed && hasCommissions && txCount === 0) {
      const paidPayoutId = crypto.randomUUID();
      const pendingPayoutId = crypto.randomUUID();
      const t1 = crypto.randomUUID();
      const t2 = crypto.randomUUID();
      const t3 = crypto.randomUUID();
      const t4 = crypto.randomUUID();
      const t5 = crypto.randomUUID();

      const payoutQueries =
        hasPayouts === true
          ? [
              {
                sql: `INSERT INTO partner_payouts
                        (id, partner_org_id, payout_period_start, payout_period_end, gross_amount, fees,
                         tax_withheld, net_amount, currency, transaction_count, status, payout_method,
                         payout_reference, requested_at, processed_at, completed_at, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 2, 'COMPLETED', 'BANK_TRANSFER',
                              'DEMO-SETTLEMENT-01', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                params: [
                  paidPayoutId,
                  partnerOrgId,
                  dateDaysAgo(62),
                  dateDaysAgo(30),
                  520,
                  5.2,
                  514.8,
                  DEMO_CURRENCY,
                  isoDaysAgo(29),
                  isoDaysAgo(28),
                  isoDaysAgo(27),
                ],
              },
              {
                sql: `INSERT INTO partner_payouts
                        (id, partner_org_id, payout_period_start, payout_period_end, gross_amount, fees,
                         tax_withheld, net_amount, currency, transaction_count, status, payout_method,
                         requested_at, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 1, 'PENDING', 'BANK_TRANSFER',
                              ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                params: [
                  pendingPayoutId,
                  partnerOrgId,
                  dateDaysAgo(29),
                  dateDaysAgo(1),
                  310,
                  3.1,
                  306.9,
                  DEMO_CURRENCY,
                  isoDaysAgo(1),
                ],
              },
            ]
          : [];

      await DbPromise.transaction([
        ...payoutQueries,
        {
          sql: `INSERT INTO partner_commission_transactions
                  (id, partner_org_id, attribution_id, organization_id, transaction_type, transaction_date,
                   gross_amount, commission_rate, commission_amount, currency, status, payout_id, notes,
                   created_at, updated_at)
                VALUES (?, ?, ?, ?, 'SUBSCRIPTION', ?, 2400, 12.5, 300, ?, 'PAID', ?, 'Demo paid transaction',
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          params: [
            t1,
            partnerOrgId,
            attributionIds[0],
            demoOrganizations[0],
            isoDaysAgo(45),
            DEMO_CURRENCY,
            paidPayoutId,
          ],
        },
        {
          sql: `INSERT INTO partner_commission_transactions
                  (id, partner_org_id, attribution_id, organization_id, transaction_type, transaction_date,
                   gross_amount, commission_rate, commission_amount, currency, status, payout_id, notes,
                   created_at, updated_at)
                VALUES (?, ?, ?, ?, 'RENEWAL', ?, 1760, 12.5, 220, ?, 'PAID', ?, 'Demo paid renewal',
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          params: [
            t2,
            partnerOrgId,
            attributionIds[1],
            demoOrganizations[1],
            isoDaysAgo(34),
            DEMO_CURRENCY,
            paidPayoutId,
          ],
        },
        {
          sql: `INSERT INTO partner_commission_transactions
                  (id, partner_org_id, attribution_id, organization_id, transaction_type, transaction_date,
                   gross_amount, commission_rate, commission_amount, currency, status, notes,
                   created_at, updated_at)
                VALUES (?, ?, ?, ?, 'SUBSCRIPTION', ?, 2480, 12.5, 310, ?, 'APPROVED', 'Demo approved ready-for-payout',
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          params: [
            t3,
            partnerOrgId,
            attributionIds[0],
            demoOrganizations[0],
            isoDaysAgo(8),
            DEMO_CURRENCY,
          ],
        },
        {
          sql: `INSERT INTO partner_commission_transactions
                  (id, partner_org_id, attribution_id, organization_id, transaction_type, transaction_date,
                   gross_amount, commission_rate, commission_amount, currency, status, notes,
                   created_at, updated_at)
                VALUES (?, ?, ?, ?, 'UPSELL', ?, 1160, 10, 116, ?, 'APPROVED', 'Demo approved upsell',
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          params: [
            t4,
            partnerOrgId,
            attributionIds[1],
            demoOrganizations[1],
            isoDaysAgo(4),
            DEMO_CURRENCY,
          ],
        },
        {
          sql: `INSERT INTO partner_commission_transactions
                  (id, partner_org_id, attribution_id, organization_id, transaction_type, transaction_date,
                   gross_amount, commission_rate, commission_amount, currency, status, notes,
                   created_at, updated_at)
                VALUES (?, ?, ?, ?, 'INITIAL', ?, 980, 15, 147, ?, 'PENDING', 'Demo pending approval',
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          params: [
            t5,
            partnerOrgId,
            attributionIds[2],
            demoOrganizations[2],
            isoDaysAgo(2),
            DEMO_CURRENCY,
          ],
        },
      ]);
    }

    if (hasCampaignLinks) {
      const existingCampaigns = await DbPromise.get<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM partner_campaign_links WHERE partner_org_id = ?`,
        [partnerOrgId]
      );
      if (countValue(existingCampaigns) === 0) {
        await DbPromise.transaction([
          {
            sql: `INSERT INTO partner_campaign_links
                    (id, partner_org_id, name, description, slug, destination_url,
                     utm_source, utm_medium, utm_campaign, click_count, signup_count, conversion_count,
                     is_active, created_at, updated_at)
                  VALUES (?, ?, 'Demo LinkedIn Campaign', 'Auto-seeded partner demo campaign',
                          'demo-linkedin', '/pricing', 'partner', 'social', 'demo_linkedin', 42, 8, 3,
                          TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            params: [crypto.randomUUID(), partnerOrgId],
          },
          {
            sql: `INSERT INTO partner_campaign_links
                    (id, partner_org_id, name, description, slug, destination_url,
                     utm_source, utm_medium, utm_campaign, click_count, signup_count, conversion_count,
                     is_active, created_at, updated_at)
                  VALUES (?, ?, 'Demo Webinar Campaign', 'Auto-seeded partner webinar campaign',
                          'demo-webinar', '/trial/start', 'partner', 'event', 'demo_webinar', 18, 5, 2,
                          TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            params: [crypto.randomUUID(), partnerOrgId],
          },
        ]);
      }
    }

    if (hasClicks) {
      const existingClicks = await DbPromise.get<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM partner_referral_clicks WHERE partner_org_id = ?`,
        [partnerOrgId]
      );
      if (countValue(existingClicks) === 0) {
        await DbPromise.transaction([
          {
            sql: `INSERT INTO partner_referral_clicks
                    (id, partner_org_id, referral_code, clicked_at, ip_hash, user_agent, referer, landing_page,
                     utm_source, utm_medium, utm_campaign, converted, conversion_type, cookie_id)
                  VALUES (?, ?, 'PARTNER-DEMO', ?, 'demo-ip-01', 'DemoAgent/1.0', 'https://linkedin.com',
                          '/pricing', 'partner', 'social', 'demo_linkedin', TRUE, 'SIGNUP', 'demo-cookie-1')`,
            params: [crypto.randomUUID(), partnerOrgId, isoDaysAgo(6)],
          },
          {
            sql: `INSERT INTO partner_referral_clicks
                    (id, partner_org_id, referral_code, clicked_at, ip_hash, user_agent, referer, landing_page,
                     utm_source, utm_medium, utm_campaign, converted, conversion_type, cookie_id)
                  VALUES (?, ?, 'PARTNER-DEMO', ?, 'demo-ip-02', 'DemoAgent/1.0', 'https://google.com',
                          '/trial/start', 'partner', 'search', 'demo_webinar', TRUE, 'TRIAL', 'demo-cookie-2')`,
            params: [crypto.randomUUID(), partnerOrgId, isoDaysAgo(3)],
          },
          {
            sql: `INSERT INTO partner_referral_clicks
                    (id, partner_org_id, referral_code, clicked_at, ip_hash, user_agent, referer, landing_page,
                     utm_source, utm_medium, utm_campaign, converted, cookie_id)
                  VALUES (?, ?, 'PARTNER-DEMO', ?, 'demo-ip-03', 'DemoAgent/1.0', 'https://newsletter.example',
                          '/business-cases', 'partner', 'email', 'demo_newsletter', FALSE, 'demo-cookie-3')`,
            params: [crypto.randomUUID(), partnerOrgId, isoDaysAgo(1)],
          },
        ]);
      }
    }
  } catch (error) {
    logger.warn('[PartnerDemoSeedService] Could not seed demo dataset', error);
  }
}

export default {
  ensurePartnerDemoDataset,
};
