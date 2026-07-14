/**
 * Dev-render host for the REAL `<PartnerSettlementsView />` (SuperAdmin →
 * Revenue → Partner Settlements), migrated off 4 bespoke HTML tables
 * (Commissions/Attribution/Expiring/Analytics) onto the production
 * <StandardTable>/<StandardModuleBar>/<StandardPreview> facades (kanon TRIADA
 * §27-todo backlog item). The Payouts tab stays a process card-list (not a
 * list of entities) — untouched, out of kanon-list scope. No re-implementation:
 * the component fetches through `Api.get()` (services/api.ts, backed by
 * `fetch('/api/...')`), so we stub `window.fetch` with engine-shaped mock JSON
 * keyed by URL path (pattern from dev-render/screens/assessment-reports-table.tsx).
 *
 * Exercises: Menu2 tab switcher (5 tabs) driving StandardModuleBar, per-tab
 * search (Commissions/Attribution — Attribution search pre-existed, Commissions
 * search was previously decorative/unwired and is now functional), bulk-select
 * + Approve Selected (Commissions), Create Attribution CTA, expiring-days
 * select in filterControls, filterable Status column (Attribution), kebab
 * (Approve/Remove attribution/preview-only for read-only tabs), side preview
 * panel per tab.
 */
import React from 'react';

import { PartnerSettlementsView } from '../../src/views/superadmin/revenue/PartnerSettlementsView';

const SUMMARY = {
  totalPendingCommissions: 12,
  totalPendingPayouts: 3,
  pendingCommissionAmount: 4820.5,
  pendingPayoutAmount: 15200,
  thisMonthCommissions: 9840.25,
  thisMonthPayouts: 21500,
};

const COMMISSIONS = [
  {
    id: 'comm-1',
    partnerOrgId: 'partner-1',
    partnerName: 'Nordic Consulting Group',
    organizationId: 'org-1',
    organizationName: 'Atelier Toys AB',
    transactionType: 'SUBSCRIPTION',
    transactionDate: '2026-07-10',
    grossAmount: 2400,
    commissionRate: 15,
    commissionAmount: 360,
    currency: 'EUR',
    status: 'PENDING',
    createdAt: '2026-07-10T08:00:00Z',
  },
  {
    id: 'comm-2',
    partnerOrgId: 'partner-2',
    partnerName: 'DBR77 Partners',
    organizationId: 'org-2',
    organizationName: 'Manufacturing Co.',
    transactionType: 'ONE_TIME',
    transactionDate: '2026-07-12',
    grossAmount: 890,
    commissionRate: 10,
    commissionAmount: 89,
    currency: 'EUR',
    status: 'PENDING',
    createdAt: '2026-07-12T08:00:00Z',
  },
  {
    id: 'comm-3',
    partnerOrgId: 'partner-1',
    partnerName: 'Nordic Consulting Group',
    organizationId: 'org-3',
    organizationName: 'Retail SA',
    transactionType: 'SUBSCRIPTION',
    transactionDate: '2026-07-13',
    grossAmount: 1500,
    commissionRate: 15,
    commissionAmount: 225,
    currency: 'EUR',
    status: 'PENDING',
    createdAt: '2026-07-13T08:00:00Z',
  },
];

const PAYOUTS = [
  {
    id: 'payout-1',
    partnerOrgId: 'partner-1',
    partnerName: 'Nordic Consulting Group',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    grossAmount: 5200,
    fees: 120,
    netAmount: 5080,
    currency: 'EUR',
    transactionCount: 18,
    status: 'PENDING',
    requestedAt: '2026-07-01T08:00:00Z',
  },
  {
    id: 'payout-2',
    partnerOrgId: 'partner-2',
    partnerName: 'DBR77 Partners',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    grossAmount: 3100,
    fees: 60,
    netAmount: 3040,
    currency: 'EUR',
    transactionCount: 9,
    status: 'PROCESSING',
    requestedAt: '2026-07-02T08:00:00Z',
  },
];

const ATTRIBUTIONS = [
  {
    id: 'attr-1',
    partnerOrgId: 'partner-1',
    partnerName: 'Nordic Consulting Group',
    organizationId: 'org-1',
    organizationName: 'Atelier Toys AB',
    attributionType: 'REFERRAL_CODE',
    referralCodeUsed: 'NORDIC15',
    status: 'ACTIVE',
    attributedAt: '2026-05-01T08:00:00Z',
  },
  {
    id: 'attr-2',
    partnerOrgId: 'partner-2',
    partnerName: 'DBR77 Partners',
    organizationId: 'org-2',
    organizationName: 'Manufacturing Co.',
    attributionType: 'MANUAL_LINK',
    status: 'PENDING',
    attributedAt: '2026-06-15T08:00:00Z',
  },
  {
    id: 'attr-3',
    partnerOrgId: 'partner-1',
    partnerName: 'Nordic Consulting Group',
    organizationId: 'org-4',
    organizationName: 'Old Client GmbH',
    attributionType: 'REFERRAL_CODE',
    referralCodeUsed: 'NORDIC15',
    status: 'EXPIRED',
    attributedAt: '2026-01-01T08:00:00Z',
  },
];

const EXPIRING_ATTRIBUTIONS = [
  {
    id: 'exp-1',
    partnerOrgId: 'partner-1',
    partnerName: 'Nordic Consulting Group',
    organizationId: 'org-1',
    organizationName: 'Atelier Toys AB',
    referralCodeUsed: 'NORDIC15',
    status: 'ACTIVE',
    attributedAt: '2026-05-01T08:00:00Z',
    discountEndDate: '2026-07-18',
    daysRemaining: 5,
    discountPercent: 15,
    lifetimeValue: 12400,
    totalCommissionEarned: 1860,
  },
  {
    id: 'exp-2',
    partnerOrgId: 'partner-2',
    partnerName: 'DBR77 Partners',
    organizationId: 'org-2',
    organizationName: 'Manufacturing Co.',
    status: 'ACTIVE',
    attributedAt: '2026-06-01T08:00:00Z',
    daysRemaining: 12,
    lifetimeValue: 3900,
    totalCommissionEarned: 390,
  },
];

const CODE_ANALYTICS = [
  {
    referralCode: 'NORDIC15',
    partnerOrgId: 'partner-1',
    partnerName: 'Nordic Consulting Group',
    totalClicks: 842,
    totalSignups: 96,
    totalConversions: 24,
    conversionRate: 25,
    totalRevenue: 48200,
    totalCommissions: 7230,
    avgCommissionRate: 15,
    activeAttributions: 14,
    firstUsed: '2026-01-01T08:00:00Z',
    lastUsed: '2026-07-13T08:00:00Z',
  },
  {
    referralCode: 'DBR77WELCOME',
    partnerOrgId: 'partner-2',
    partnerName: 'DBR77 Partners',
    totalClicks: 310,
    totalSignups: 22,
    totalConversions: 4,
    conversionRate: 12.9,
    totalRevenue: 9800,
    totalCommissions: 980,
    avgCommissionRate: 10,
    activeAttributions: 5,
    firstUsed: '2026-03-01T08:00:00Z',
    lastUsed: '2026-07-10T08:00:00Z',
  },
  {
    referralCode: 'COLDSTART',
    partnerOrgId: 'partner-3',
    partnerName: 'New Partner Inc.',
    totalClicks: 40,
    totalSignups: 2,
    totalConversions: 0,
    conversionRate: 5,
    totalRevenue: 0,
    totalCommissions: 0,
    avgCommissionRate: 0,
    activeAttributions: 0,
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Install the offline fetch stub once (idempotent across HMR).
const g = window as unknown as { __PARTNER_SETTLEMENTS_VIEW_FETCH__?: boolean };
if (!g.__PARTNER_SETTLEMENTS_VIEW_FETCH__) {
  g.__PARTNER_SETTLEMENTS_VIEW_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (url.includes('/superadmin/partner-settlements/summary')) {
        return jsonResponse({ success: true, data: SUMMARY });
      }
      if (url.includes('/superadmin/partner-settlements/pending-commissions')) {
        return jsonResponse({ success: true, data: COMMISSIONS });
      }
      if (url.includes('/superadmin/partner-settlements/pending-payouts')) {
        return jsonResponse({ success: true, data: PAYOUTS });
      }
      if (url.includes('/superadmin/partner-settlements/expiring-attributions')) {
        return jsonResponse({ success: true, data: EXPIRING_ATTRIBUTIONS });
      }
      if (url.includes('/superadmin/partner-settlements/code-analytics')) {
        return jsonResponse({ success: true, data: CODE_ANALYTICS });
      }
      if (url.includes('/superadmin/partner-settlements/attributions')) {
        return jsonResponse({ success: true, data: ATTRIBUTIONS });
      }
      if (url.includes('/superadmin/partner-settlements/approve-commissions')) {
        return jsonResponse({ success: true });
      }
      if (url.match(/\/partner-settlements\/(process|complete)-payout\//)) {
        return jsonResponse({ success: true });
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

class DebugBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ padding: 16, color: 'red', whiteSpace: 'pre-wrap' }}>
          {this.state.error.stack || this.state.error.message}
        </pre>
      );
    }
    return this.props.children;
  }
}

export default function PartnerSettlementsViewScreen(): React.ReactElement {
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px' }}>
      <DebugBoundary>
        <PartnerSettlementsView />
      </DebugBoundary>
    </div>
  );
}
