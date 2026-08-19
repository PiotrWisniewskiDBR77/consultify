/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — the Partner writers the cutover never saw.
 *
 * `partners.routes.ts` exports four routers, not one. The cutover guard was
 * applied to the default export only (`router.use(partnerLegacyCutoverGuard)` at
 * partners.routes.ts:229), so every write on the other three has been invisible
 * to the Partner cutover since it began:
 *
 *   publicPartnerRouter      -> /api/public/partner            (Gateway.ts:630)
 *   superAdminPartnerRouter  -> /api/superadmin/partner-settlements (Gateway.ts:1264)
 *   partnerConfigRouter      -> /api/superadmin/partner-config  (Gateway.ts:1265)
 *
 * Two of those three carry the money: settlement approval, payout processing and
 * commission rate configuration. A cutover report that counted only the guarded
 * router was therefore describing a subset of the domain while reading as though
 * it described the domain.
 *
 * Every writer here is `observed`. None has a V8 successor located in code, and
 * the superadmin surfaces have no V8 equivalent at all. The value of registering
 * them is that their traffic becomes attributable per tenant before anyone
 * proposes retiring anything in this domain.
 */

import type { LegacyCutoverDomainConfig } from '../legacyCutoverKernel.js';

const PARTNER_ROLLBACK_ENV = 'PARTNER_LEGACY_ROLLBACK_ENABLED';
const PARTNER_ROLLBACK_WRITERS_ENV = 'PARTNER_LEGACY_ROLLBACK_WRITERS';

/**
 * PUBLIC. Unauthenticated by design — it is the referral-click tracker. It is
 * registered here because an unauthenticated writer is exactly the kind that
 * telemetry must be able to name; the kernel will record it with
 * `tenant_resolution = 'unresolved'`, which is the honest answer.
 */
export const PARTNERS_PUBLIC_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'partners',
  rollbackEnv: PARTNER_ROLLBACK_ENV,
  rollbackWritersEnv: PARTNER_ROLLBACK_WRITERS_ENV,
  disabledCode: 'PARTNER_LEGACY_WRITER_DISABLED',
  unmappedCode: 'PARTNER_LEGACY_IDENTITY_UNMAPPED',
  // This mount is unauthenticated and takes referral-code traffic. An anonymous
  // GET here matches no writer rule and cannot be attributed to a tenant, so a
  // telemetry row per read would be write amplification on a public endpoint in
  // exchange for a row that answers no retirement question. Writes are still
  // recorded, always.
  recordUnmatchedReads: false,
  writers: [
    {
      writerId: 'PRT-W17',
      method: 'POST',
      path: /^\/track-click\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Public, unauthenticated referral click tracker (partners.routes.ts:2309) on a router the Partner cutover guard was never applied to. Recorded with an unresolved tenant rather than an assumed one.',
    },
  ],
};

/** SUPERADMIN SETTLEMENTS — the payout money path. */
export const PARTNERS_SUPERADMIN_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'partners',
  rollbackEnv: PARTNER_ROLLBACK_ENV,
  rollbackWritersEnv: PARTNER_ROLLBACK_WRITERS_ENV,
  disabledCode: 'PARTNER_LEGACY_WRITER_DISABLED',
  unmappedCode: 'PARTNER_LEGACY_IDENTITY_UNMAPPED',
  writers: [
    {
      writerId: 'PRT-W18',
      method: 'POST',
      path: /^\/approve-commissions\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Commission approval (partners.routes.ts:2416) on the unguarded superadmin settlements router. No V8 counterpart located.',
    },
    {
      writerId: 'PRT-W19',
      method: 'POST',
      path: /^\/process-payout(\/[^/]+)?\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Payout processing (partners.routes.ts:2460), registered for both the collection and the :payoutId form. No V8 counterpart located.',
    },
    {
      writerId: 'PRT-W20',
      method: 'POST',
      path: /^\/complete-payout(\/[^/]+)?\/?$/,
      state: 'observed',
      successor: null,
      reason: 'Payout completion (partners.routes.ts:2501). No V8 counterpart located.',
    },
    {
      writerId: 'PRT-W21',
      method: 'POST',
      path: /^\/fail-payout(\/[^/]+)?\/?$/,
      state: 'observed',
      successor: null,
      reason: 'Payout failure marking (partners.routes.ts:2542). No V8 counterpart located.',
    },
    {
      writerId: 'PRT-W22',
      method: 'DELETE',
      path: /^\/attributions\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Attribution deletion (partners.routes.ts:2594) — the only DELETE on this surface, and the one whose retirement would need the strongest evidence because it removes rows rather than adding them.',
    },
    {
      writerId: 'PRT-W23',
      method: 'POST',
      path: /^\/program\/[^/]+\/lifecycle\/?$/,
      state: 'observed',
      successor: null,
      reason: 'Partner program lifecycle transition (partners.routes.ts:2699).',
    },
    {
      writerId: 'PRT-W24',
      method: 'POST',
      path: /^\/program\/[^/]+\/ledger-entry\/?$/,
      state: 'observed',
      successor: null,
      reason: 'Partner program ledger entry (partners.routes.ts:2748).',
    },
  ],
};

/** SUPERADMIN CONFIG — commission and discount policy. */
export const PARTNERS_CONFIG_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'partners',
  rollbackEnv: PARTNER_ROLLBACK_ENV,
  rollbackWritersEnv: PARTNER_ROLLBACK_WRITERS_ENV,
  disabledCode: 'PARTNER_LEGACY_WRITER_DISABLED',
  unmappedCode: 'PARTNER_LEGACY_IDENTITY_UNMAPPED',
  writers: [
    {
      writerId: 'PRT-W25',
      method: 'PUT',
      path: /^\/commission-rates\/?$/,
      state: 'observed',
      successor: null,
      reason: 'Commission rate configuration (partners.routes.ts:2829).',
    },
    {
      writerId: 'PRT-W26',
      method: 'PUT',
      path: /^\/discount\/?$/,
      state: 'observed',
      successor: null,
      reason: 'Partner discount configuration (partners.routes.ts:2866).',
    },
    {
      writerId: 'PRT-W27',
      method: 'PUT',
      path: /^\/payout-settings\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Superadmin payout settings (partners.routes.ts:2898). Note the path collides with PRT-W08, which IS retired on the tenant-facing router — the same router-local path, two different mounts, two different states. This is why telemetry records the full path.',
    },
    {
      writerId: 'PRT-W28',
      method: 'POST',
      path: /^\/review-queue\/[^/]+\/?$/,
      state: 'disabled',
      successor: '/api/v8/admin/partners/certifications/:certificationId/review',
      reason: 'V8 global-superadmin certification review command is the canonical owner.',
    },
    {
      writerId: 'PRT-W29',
      method: 'POST',
      path: /^\/applications\/[^/]+\/review\/?$/,
      state: 'disabled',
      successor: '/api/v8/admin/partners/applications/:applicationId/review',
      reason: 'V8 global-superadmin application review command is the canonical owner.',
    },
  ],
};
