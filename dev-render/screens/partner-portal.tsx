/**
 * DEV-RENDER: Moduł 16 „Partner" (Partner Portal), pierwszy komplet zrzutów
 * dla przeglądu właściciela (żaden ekran tego modułu nie ma dotąd wpisu w
 * rejestrze grafiki — CLAUDE.md #7: właściciel nie może być pierwszym
 * testerem, więc ten harness renderuje REALNY komponent produktu, nie
 * odtworzenie).
 *
 * Montujemy 1:1 realny wołacz z `src/routes/AppRoutes.tsx:3494` —
 * `<PartnerPortalViewNew />` pod trasą `/partner/*` (patrz komentarz tam:
 * gate jest WYŁĄCZNIE `requireAuth`, zero flagi frontendowej). Dane wchodzą
 * przez `window.fetch` na `/api/v8/partner/*` (V8PartnerApi, próbowane jako
 * pierwsze) i `/api/partners/*` (legacy fallback, m.in. dashboard/certyfikaty/
 * materiały/profil, które w ogóle nie mają odpowiednika V8) — stub poniżej
 * pokrywa oba, scoped po substringach URL (nie catch-all, patrz i18n-fala1
 * -smoke.tsx / admin-team.tsx).
 *
 * `?wariant=` wybiera który ekran/stan portalu się renderuje — patrz WARIANTY
 * niżej. Fikcyjny partner demo: „Zenit Consulting Sp. z o.o." (Polska firma
 * doradcza), zespół polski, waluta PLN.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { PartnerPortalViewNew } from '../../src/views/partner/PartnerPortalView';

export type PartnerPortalVariant =
  | 'start-unconnected'
  | 'start-active'
  | 'start-error'
  | 'dashboard'
  | 'referral-tools-filled'
  | 'referral-tools-empty'
  | 'organizations-filled'
  | 'organizations-empty'
  | 'earnings-filled'
  | 'academy-filled'
  | 'resources-filled'
  | 'profile-filled';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Dane demo: „Zenit Consulting Sp. z o.o." ──────────────────────────────
const CURRENCY = 'PLN';

const CLIENTS_FILLED = [
  {
    id: 'org-metalpol',
    organizationId: 'org-metalpol',
    name: 'Metalpol Group',
    organizationName: 'Metalpol Group',
    clientName: 'Metalpol Group',
    status: 'active',
    accessLevel: 'FULL',
    users: 14,
    userCount: 14,
    projects: 2,
    assessmentScore: 3.6,
    industry: 'Produkcja',
    region: 'CEE',
    plan: 'enterprise',
    onboardedAt: '2026-03-11T00:00:00Z',
    contractValue: 240000,
  },
  {
    id: 'org-hurtnord',
    organizationId: 'org-hurtnord',
    name: 'HurtNord Logistyka',
    organizationName: 'HurtNord Logistyka',
    clientName: 'HurtNord Logistyka',
    status: 'onboarding',
    accessLevel: 'FULL',
    users: 6,
    userCount: 6,
    projects: 1,
    assessmentScore: 2.9,
    industry: 'Logistyka',
    region: 'CEE',
    plan: 'growth',
    onboardedAt: '2026-08-02T00:00:00Z',
    contractValue: 96000,
  },
  {
    id: 'org-atelier',
    organizationId: 'org-atelier',
    name: 'Atelier Toys',
    organizationName: 'Atelier Toys',
    clientName: 'Atelier Toys',
    status: 'active',
    accessLevel: 'FULL',
    users: 9,
    userCount: 9,
    projects: 3,
    assessmentScore: 4.1,
    industry: 'Handel detaliczny',
    region: 'CEE',
    plan: 'enterprise',
    onboardedAt: '2026-01-20T00:00:00Z',
    contractValue: 180000,
  },
];

const PROJECTS_FILLED = [
  {
    id: 'prj-1',
    name: 'Transformacja operacyjna Metalpol',
    clientId: 'org-metalpol',
    clientName: 'Metalpol Group',
    framework: 'DRD',
    progress: 62,
    status: 'in_progress',
    startDate: '2026-04-01T00:00:00Z',
    targetEndDate: '2026-11-30T00:00:00Z',
  },
  {
    id: 'prj-2',
    name: 'Wdrożenie SIRI — linia B',
    clientId: 'org-atelier',
    clientName: 'Atelier Toys',
    framework: 'SIRI',
    progress: 34,
    status: 'in_progress',
    startDate: '2026-06-10T00:00:00Z',
    targetEndDate: '2027-02-15T00:00:00Z',
  },
];

const EMPLOYEES_FILLED = [
  {
    id: 'emp-1',
    employeeName: 'Marta Zielińska',
    email: 'marta.zielinska@zenit-consulting.pl',
    accessType: 'ADMIN',
    permissionSet: 'Pełny dostęp',
    clients: ['org-metalpol', 'org-atelier'],
    clientCount: 2,
    status: 'ACTIVE',
    lastActive: '2026-09-01T09:20:00Z',
  },
];

const REFERRAL_TOOLS_FILLED = {
  referralCode: 'ZENIT-CONSULT-24',
  referralLink: 'https://consultify.ai/r/ZENIT-CONSULT-24',
  referralLinkSlug: 'ZENIT-CONSULT-24',
  qrCodeUrl: null,
  campaignLinks: [
    {
      id: 'camp-1',
      name: 'Newsletter Q3',
      slug: 'newsletter-q3',
      fullUrl: 'https://consultify.ai/r/ZENIT-CONSULT-24?c=newsletter-q3',
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmCampaign: 'q3-2026',
      clickCount: 412,
      signupCount: 38,
      conversionCount: 9,
      isActive: true,
      createdAt: '2026-07-01T00:00:00Z',
    },
    {
      id: 'camp-2',
      name: 'Konferencja Przemysł 4.0',
      slug: 'konf-przemysl40',
      fullUrl: 'https://consultify.ai/r/ZENIT-CONSULT-24?c=konf-przemysl40',
      utmSource: 'event',
      utmMedium: 'offline',
      utmCampaign: 'przemysl40-2026',
      clickCount: 156,
      signupCount: 21,
      conversionCount: 6,
      isActive: true,
      createdAt: '2026-05-14T00:00:00Z',
    },
    {
      id: 'camp-3',
      name: 'LinkedIn organiczny',
      slug: 'linkedin-organic',
      fullUrl: 'https://consultify.ai/r/ZENIT-CONSULT-24?c=linkedin-organic',
      utmSource: 'linkedin',
      utmMedium: 'social',
      utmCampaign: 'organic',
      clickCount: 89,
      signupCount: 7,
      conversionCount: 1,
      isActive: false,
      createdAt: '2026-02-02T00:00:00Z',
    },
  ],
};

const REFERRAL_TOOLS_EMPTY = {
  referralCode: 'ZENIT-CONSULT-24',
  referralLink: 'https://consultify.ai/r/ZENIT-CONSULT-24',
  referralLinkSlug: 'ZENIT-CONSULT-24',
  qrCodeUrl: null,
  campaignLinks: [] as unknown[],
};

const REFERRAL_ANALYTICS = {
  totalClicks: 657,
  uniqueClicks: 412,
  signups: 66,
  trials: 41,
  paidCustomers: 16,
  conversionRate: 24.2,
  clicksByDay: [
    { date: '2026-08-28', clicks: 34 },
    { date: '2026-08-29', clicks: 51 },
  ],
  clicksBySource: [
    { source: 'newsletter', clicks: 412 },
    { source: 'event', clicks: 156 },
    { source: 'linkedin', clicks: 89 },
  ],
};

const ATTRIBUTIONS_FILLED = [
  {
    id: 'attr-1',
    organizationName: 'Metalpol Group',
    campaignName: 'Newsletter Q3',
    status: 'CONVERTED',
    attributedAt: '2026-07-18T00:00:00Z',
  },
];

const COMMISSION_TRANSACTIONS_FILLED = [
  {
    id: 'tx-1',
    partnerOrgId: 'partner-zenit',
    organizationId: 'org-metalpol',
    organizationName: 'Metalpol Group',
    transactionType: 'SUBSCRIPTION_RENEWAL',
    transactionDate: '2026-08-05T00:00:00Z',
    grossAmount: 24000,
    commissionRate: 15,
    commissionAmount: 3600,
    currency: CURRENCY,
    status: 'PAID',
    approvedAt: '2026-08-06T00:00:00Z',
    payoutId: 'payout-1',
    createdAt: '2026-08-05T00:00:00Z',
  },
  {
    id: 'tx-2',
    partnerOrgId: 'partner-zenit',
    organizationId: 'org-atelier',
    organizationName: 'Atelier Toys',
    transactionType: 'NEW_CONTRACT',
    transactionDate: '2026-08-21T00:00:00Z',
    grossAmount: 60000,
    commissionRate: 18,
    commissionAmount: 10800,
    currency: CURRENCY,
    status: 'APPROVED',
    approvedAt: '2026-08-22T00:00:00Z',
    createdAt: '2026-08-21T00:00:00Z',
  },
  {
    id: 'tx-3',
    partnerOrgId: 'partner-zenit',
    organizationId: 'org-hurtnord',
    organizationName: 'HurtNord Logistyka',
    transactionType: 'NEW_CONTRACT',
    transactionDate: '2026-08-29T00:00:00Z',
    grossAmount: 32000,
    commissionRate: 15,
    commissionAmount: 4800,
    currency: CURRENCY,
    status: 'PENDING',
    createdAt: '2026-08-29T00:00:00Z',
  },
];

const PAYOUTS_FILLED = [
  {
    id: 'payout-1',
    status: 'COMPLETED',
    netAmount: 3600,
    grossAmount: 3600,
    transactionCount: 1,
    periodStart: '2026-07-01T00:00:00Z',
    periodEnd: '2026-07-31T00:00:00Z',
    completedAt: '2026-08-06T00:00:00Z',
    currency: CURRENCY,
  },
  {
    id: 'payout-2',
    status: 'PROCESSING',
    netAmount: 10800,
    grossAmount: 10800,
    transactionCount: 1,
    periodStart: '2026-08-01T00:00:00Z',
    periodEnd: '2026-08-31T00:00:00Z',
    completedAt: null,
    currency: CURRENCY,
  },
];

const PAYOUT_SETTINGS = {
  payoutMethod: 'BANK_TRANSFER',
  bankAccountLast4: '4821',
  minimumThreshold: 500,
  currency: CURRENCY,
};

const EARNINGS_SUMMARY = {
  totalEarned: 19200,
  totalPending: 4800,
  totalApproved: 10800,
  totalPaid: 3600,
  thisMonth: 10800,
  thisMonthCount: 1,
  lastMonth: 3600,
  readyForPayout: 10800,
  payoutEligibility: {
    eligible: true,
    eligibleGross: 10800,
    eligibleNet: 10800,
    minimumThreshold: 500,
    currency: CURRENCY,
    reason: 'ELIGIBLE',
  },
  currency: CURRENCY,
  lifecyclePhase: 'earn',
  whatNext: ['Zatwierdź wypłatę za sierpień', 'Uzupełnij dane do faktury'],
  hold: null,
};

const CERTIFICATIONS_FILLED = [
  {
    id: 'cert-drd',
    name: 'DRD Practitioner',
    type: 'certification',
    track: 'DRD',
    level: 'Practitioner',
    status: 'completed',
    progress: 100,
    duration: '6 tygodni',
    modules: 8,
    completedModules: 8,
    reviewState: 'approved',
    validUntil: '2027-06-01T00:00:00Z',
    completedAt: '2026-06-01T00:00:00Z',
    certificateId: 'CERT-DRD-2026-0113',
  },
  {
    id: 'cert-siri',
    name: 'SIRI Assessor',
    type: 'certification',
    track: 'SIRI',
    level: 'Assessor',
    status: 'in_progress',
    progress: 45,
    duration: '8 tygodni',
    modules: 10,
    completedModules: 4,
    reviewState: 'pending',
    startedAt: '2026-07-15T00:00:00Z',
  },
  {
    id: 'cert-ai',
    name: 'AI Transformation Advisor',
    type: 'certification',
    track: 'AI',
    level: 'Advisor',
    status: 'not_started',
    progress: 0,
    duration: '4 tygodnie',
    modules: 5,
    completedModules: 0,
  },
];

const RESOURCES_FILLED = {
  documentation: [
    { id: 'doc-1', title: 'Podręcznik wdrożeniowy DRD', type: 'pdf', size: '4.2 MB', category: 'documentation' },
    { id: 'doc-2', title: 'Standard oceny SIRI 2026', type: 'pdf', size: '2.8 MB', category: 'documentation' },
  ],
  marketing: [
    { id: 'mkt-1', title: 'Zestaw slajdów sprzedażowych', type: 'pptx', size: '11 MB', category: 'marketing' },
  ],
  caseStudies: [
    { id: 'cs-1', title: 'Metalpol Group — studium przypadku', type: 'pdf', size: '1.6 MB', category: 'case-study' },
  ],
  templates: [
    { id: 'tpl-1', title: 'Szablon raportu z oceny', type: 'docx', size: '340 KB', category: 'template' },
  ],
  capability: 'FULL' as const,
  resourcesReadable: true,
};

const ORGANIZATION_PROFILE = {
  id: 'partner-zenit',
  name: 'Zenit Consulting Sp. z o.o.',
  legalName: 'Zenit Consulting Sp. z o.o.',
  taxId: 'PL5213456789',
  contactEmail: 'kontakt@zenit-consulting.pl',
  contactPhone: '+48 22 555 10 20',
  website: 'https://zenit-consulting.pl',
  tier: 'Gold',
  status: 'active',
  partnerSince: '2025-11-03T00:00:00Z',
  licenseDiscountPercent: 12,
  commissionRatePercent: 15,
  performanceScore: 4.3,
  publicListingEnabled: true,
  specializations: ['DRD', 'SIRI', 'Lean 4.0'],
  regions: ['CEE', 'Baltics'],
};

const DASHBOARD_FILLED = {
  stats: {
    activeClients: 3,
    activeProjects: 2,
    certificationLevel: 'Gold',
    monthlyRevenue: 10800,
    revenueChange: 12.4,
    totalLicenses: 40,
    activeLicenses: 29,
    availableLicenses: 11,
  },
  recentActivity: [
    { type: 'commission', text: 'Nowa prowizja: Atelier Toys', time: '21 sierpnia 2026' },
    { type: 'client', text: 'HurtNord Logistyka rozpoczęła onboarding', time: '2 sierpnia 2026' },
  ],
  certificationProgress: {
    completed: 1,
    total: 3,
    courses: [{ id: 'cert-siri', name: 'SIRI Assessor', progress: 45 }],
  },
};

function programStatus(lifecyclePhase: 'onboard' | 'activate' | 'earn' | 'payout') {
  return {
    lifecyclePhase,
    partnerOrganizationStatus: 'active',
    onboardChecklist: {},
    payoutSettingsComplete: true,
    balances: {
      grossEarned: 19200,
      paidOut: 3600,
      heldAmount: 0,
      availableToPayout: 10800,
      currency: CURRENCY,
    },
    whatNext: ['Zatwierdź wypłatę za sierpień', 'Uzupełnij dane do faktury'],
    hold: null,
  };
}

function buildFetchStub(variant: PartnerPortalVariant): typeof window.fetch {
  const empty = variant.endsWith('-empty');
  const connected = variant !== 'start-unconnected';

  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const method = (init?.method || 'GET').toUpperCase();

    // Connection gate (partner-home + całej otoczki portalu).
    if (url.includes('/api/v8/partner/connection')) {
      if (variant === 'start-error') return jsonResponse({}, 500);
      return jsonResponse({ data: { connected } });
    }

    if (url.includes('/api/v8/partner/program/status')) {
      return jsonResponse({ data: programStatus('earn') });
    }
    if (url.includes('/api/v8/partner/onboarding-status')) {
      return jsonResponse({
        data: { status: { termsAccepted: true, privacyAccepted: true, pricingTier: 'gold', paymentSetup: true, completed: true } },
      });
    }
    if (url.includes('/api/v8/partner/participant-ledger')) {
      return jsonResponse({ data: { entries: [] } });
    }
    if (url.includes('/api/v8/partner/clients')) {
      return jsonResponse({ data: { clients: empty ? [] : CLIENTS_FILLED } });
    }
    if (url.includes('/api/v8/partner/projects')) {
      return jsonResponse({ data: { projects: empty ? [] : PROJECTS_FILLED } });
    }
    if (url.includes('/api/v8/partner/employees')) {
      return jsonResponse({ data: { employees: empty ? [] : EMPLOYEES_FILLED } });
    }
    if (url.includes('/api/v8/partner/referral-tools')) {
      return jsonResponse({ data: { tools: empty ? REFERRAL_TOOLS_EMPTY : REFERRAL_TOOLS_FILLED } });
    }
    if (url.includes('/api/v8/partner/referral-analytics')) {
      return jsonResponse({ data: { analytics: REFERRAL_ANALYTICS, days: 30 } });
    }
    if (url.includes('/api/v8/partner/attributions')) {
      return jsonResponse({ data: { attributions: empty ? [] : ATTRIBUTIONS_FILLED } });
    }
    if (url.includes('/api/v8/partner/commission-transactions')) {
      return jsonResponse({ data: { transactions: empty ? [] : COMMISSION_TRANSACTIONS_FILLED } });
    }
    if (url.includes('/api/v8/partner/payouts')) {
      return jsonResponse({ data: { payouts: empty ? [] : PAYOUTS_FILLED } });
    }
    if (url.includes('/api/v8/partner/payout-settings')) {
      return jsonResponse({ data: { settings: PAYOUT_SETTINGS } });
    }
    if (url.includes('/api/v8/partner/earnings-summary')) {
      return jsonResponse({ data: { earnings: EARNINGS_SUMMARY } });
    }

    // Legacy `/api/partners/*` — no V8 equivalent for these four.
    if (url.includes('/api/partners/dashboard')) {
      return jsonResponse({ success: true, data: DASHBOARD_FILLED });
    }
    if (url.includes('/api/partners/certifications')) {
      return jsonResponse({ success: true, data: empty ? [] : CERTIFICATIONS_FILLED });
    }
    if (url.includes('/api/partners/resources')) {
      return jsonResponse({ success: true, data: empty ? { ...RESOURCES_FILLED, documentation: [], marketing: [], caseStudies: [], templates: [] } : RESOURCES_FILLED });
    }
    if (url.includes('/api/partners/organization')) {
      return jsonResponse({ success: true, data: ORGANIZATION_PROFILE });
    }
    if (url.includes('/api/partners/catalog')) {
      return jsonResponse({ success: true, data: { frameworks: [], regions: [] } });
    }

    // i18n /locales/** i inne zasoby harnessu — REALNY fetch, nie stub (stub
    // podmienia window.fetch na SIEBIE, więc gołe `fetch(...)` tutaj
    // rekurencyjnie wywołałoby ten sam stub w nieskończoność).
    return g.__PARTNER_PORTAL_FETCH_REAL__!(input as RequestInfo, init);
  };
}

const g = window as unknown as { __PARTNER_PORTAL_FETCH_REAL__?: typeof window.fetch };
if (!g.__PARTNER_PORTAL_FETCH_REAL__) {
  g.__PARTNER_PORTAL_FETCH_REAL__ = window.fetch.bind(window);
}

const VARIANT_TAB: Record<PartnerPortalVariant, string> = {
  'start-unconnected': 'partner-home',
  'start-active': 'partner-home',
  'start-error': 'partner-home',
  dashboard: 'dashboard',
  'referral-tools-filled': 'referral-tools',
  'referral-tools-empty': 'referral-tools',
  'organizations-filled': 'organizations',
  'organizations-empty': 'organizations',
  'earnings-filled': 'earnings',
  'academy-filled': 'learning-path',
  'resources-filled': 'documentation',
  'profile-filled': 'company-info',
};

class DebugBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
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

// Wariant + instalacja stuba NA POZIOMIE MODUŁU — musi być zainstalowany
// PRZED pierwszym renderem `<PartnerPortalViewNew>`, bo jej własny efekt
// (fetchConnection, montowany jako DZIECKO tego ekranu) odpaliłby się PRZED
// efektem rodzica, gdyby stub siedział w useEffect tutaj (kolejność
// commitowania efektów: dziecko przed rodzicem). Bezpieczne, bo harness
// ładuje ten moduł raz na pełną nawigację strony (świeży kontekst
// Playwrighta na każdy zrzut, patrz grafika-zrzuty.mjs).
const MODULE_URL_WARIANT = new URLSearchParams(window.location.search).get(
  'wariant'
) as PartnerPortalVariant | null;
const RESOLVED_WARIANT: PartnerPortalVariant = MODULE_URL_WARIANT || 'start-active';
window.fetch = buildFetchStub(RESOLVED_WARIANT);

export default function PartnerPortalScreen(props: {
  wariant?: PartnerPortalVariant;
}): React.ReactElement {
  // `props.wariant` (domyślny z rejestru main.tsx) wygrywa tylko gdy adres
  // NIE podał `&wariant=` — ten sam priorytet co stub zainstalowany wyżej.
  const wariant = MODULE_URL_WARIANT || props.wariant || 'start-active';
  const tab = VARIANT_TAB[wariant];

  return (
    <div className="min-h-screen bg-c-bg">
      <DebugBoundary>
        <MemoryRouter initialEntries={[`/partner?tab=${tab}`]}>
          <React.Suspense fallback={<div className="p-8 text-c-text">Ładowanie…</div>}>
            <PartnerPortalViewNew />
          </React.Suspense>
        </MemoryRouter>
      </DebugBoundary>
    </div>
  );
}
