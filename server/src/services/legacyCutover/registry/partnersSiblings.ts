/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — the Partner writers the cutover never saw.
 *
 * `partners.routes.ts` exports four routers, not one. Historically the cutover
 * guard was applied to the default export only, so writes on the other three
 * were invisible to the Partner cutover:
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
 * W17 is retained as the canonical public ingress. W18-W27 are not awaiting a
 * successor: owner decision AMD-PRT-ECONOMICS-002 explicitly approved Partner
 * economics out of scope and requires those operations to stay unavailable.
 * They are therefore domain-enforced `disabled` writers, not misleadingly
 * `observed` or `owner-blocked`. The policy has no runtime rollback lever: a
 * new owner decision and code change are required to reopen it. W28-W29 have
 * transactional V8 operator-review successors and are disabled.
 */

import type { LegacyCutoverDomainConfig } from '../legacyCutoverKernel.js';

const PARTNER_ROLLBACK_ENV = 'PARTNER_LEGACY_ROLLBACK_ENABLED';
const PARTNER_ROLLBACK_WRITERS_ENV = 'PARTNER_LEGACY_ROLLBACK_WRITERS';

/**
 * PUBLIC. Unauthenticated by design — it is the retained referral-click ingress.
 * Its atomic command resolves the Partner owner tenant before persisting
 * telemetry; this registry entry prevents retirement tooling from treating it
 * as an incomplete legacy writer.
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
  // exchange for a row that answers no retirement question. The production
  // write is not mounted behind this generic guard; its atomic command records
  // resolved owner-tenant telemetry together with the click.
  recordUnmatchedReads: false,
  writers: [
    {
      writerId: 'PRT-W17',
      method: 'POST',
      path: /^\/track-click\/?$/,
      state: 'owner-blocked',
      successor: null,
      reason:
        'RETAINED_CURRENT_CANONICAL_PUBLIC_INGRESS: public referral click intake remains authoritative; its atomic command records resolved Partner-owner telemetry and is not a legacy retirement candidate.',
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
      state: 'disabled',
      enforcedBy: 'domain',
      enforcedByDecision: 'AMD-PRT-ECONOMICS-002',
      successor: null,
      reason:
        'APPROVED_OUT by AMD-PRT-ECONOMICS-002: commission approval is unavailable and fails closed before a writer.',
    },
    {
      writerId: 'PRT-W19',
      method: 'POST',
      path: /^\/process-payout(\/[^/]+)?\/?$/,
      state: 'disabled',
      enforcedBy: 'domain',
      enforcedByDecision: 'AMD-PRT-ECONOMICS-002',
      successor: null,
      reason:
        'APPROVED_OUT by AMD-PRT-ECONOMICS-002: payout processing is unavailable and fails closed before a writer.',
    },
    {
      writerId: 'PRT-W20',
      method: 'POST',
      path: /^\/complete-payout(\/[^/]+)?\/?$/,
      state: 'disabled',
      enforcedBy: 'domain',
      enforcedByDecision: 'AMD-PRT-ECONOMICS-002',
      successor: null,
      reason: 'APPROVED_OUT by AMD-PRT-ECONOMICS-002: payout completion is unavailable.',
    },
    {
      writerId: 'PRT-W21',
      method: 'POST',
      path: /^\/fail-payout(\/[^/]+)?\/?$/,
      state: 'disabled',
      enforcedBy: 'domain',
      enforcedByDecision: 'AMD-PRT-ECONOMICS-002',
      successor: null,
      reason: 'APPROVED_OUT by AMD-PRT-ECONOMICS-002: payout mutation is unavailable.',
    },
    {
      writerId: 'PRT-W22',
      method: 'DELETE',
      path: /^\/attributions\/[^/]+\/?$/,
      state: 'disabled',
      enforcedBy: 'domain',
      enforcedByDecision: 'AMD-PRT-ECONOMICS-002',
      successor: null,
      reason:
        'APPROVED_OUT by AMD-PRT-ECONOMICS-002: attribution deletion is unavailable; historical rows remain read-only.',
    },
    {
      writerId: 'PRT-W23',
      method: 'POST',
      path: /^\/program\/[^/]+\/lifecycle\/?$/,
      state: 'disabled',
      enforcedBy: 'domain',
      enforcedByDecision: 'AMD-PRT-ECONOMICS-002',
      successor: null,
      reason:
        'APPROVED_OUT by AMD-PRT-ECONOMICS-002: payout-bearing operator lifecycle mutation is unavailable.',
    },
    {
      writerId: 'PRT-W24',
      method: 'POST',
      path: /^\/program\/[^/]+\/ledger-entry\/?$/,
      state: 'disabled',
      enforcedBy: 'domain',
      enforcedByDecision: 'AMD-PRT-ECONOMICS-002',
      successor: null,
      reason:
        'APPROVED_OUT by AMD-PRT-ECONOMICS-002: direct accrual/ledger mutation is unavailable.',
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
      state: 'disabled',
      enforcedBy: 'domain',
      enforcedByDecision: 'AMD-PRT-ECONOMICS-002',
      successor: null,
      reason: 'APPROVED_OUT by AMD-PRT-ECONOMICS-002: commission-rate authoring is unavailable.',
    },
    {
      writerId: 'PRT-W26',
      method: 'PUT',
      path: /^\/discount\/?$/,
      state: 'disabled',
      enforcedBy: 'domain',
      enforcedByDecision: 'AMD-PRT-ECONOMICS-002',
      successor: null,
      reason: 'APPROVED_OUT by AMD-PRT-ECONOMICS-002: discount authoring is unavailable.',
    },
    {
      writerId: 'PRT-W27',
      method: 'PUT',
      path: /^\/payout-settings\/?$/,
      state: 'disabled',
      enforcedBy: 'domain',
      enforcedByDecision: 'AMD-PRT-ECONOMICS-002',
      successor: null,
      reason:
        'APPROVED_OUT by AMD-PRT-ECONOMICS-002: superadmin payout settings are unavailable. This remains distinct from retired tenant writer PRT-W08.',
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
