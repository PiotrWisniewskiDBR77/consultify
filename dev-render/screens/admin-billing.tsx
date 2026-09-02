/**
 * Dev-render host for Admin → domena "Rozliczenia i plany" (billing), komplet
 * 9 ekranów z `src/components/Admin/adminNavigation.ts` (ADMIN_DOMAINS →
 * id 'billing'). Runda odbioru grafiki 146-admin-billing (decyzja właściciela
 * 2026-08-31: cały panel Administracji wchodzi do rundy).
 *
 * Mapowanie ekran→komponent skopiowane 1:1 z realnego routingu w
 * `src/views/admin/AdminSettingsModule.tsx` (case 'billing', linie ~433-465):
 *   overview        → <AdminBillingFinOpsPanel screen="summary" />
 *   plan-limits     → <AdminBillingFinOpsPanel screen="plan" />
 *   usage-costs     → <AdminBillingFinOpsPanel screen="summary" />   (ALIAS overview — ta sama zakładka)
 *   payment-methods → <AdminBillingFinOpsPanel screen="payments" />
 *   invoices        → <AdminBillingFinOpsPanel screen="invoices" />
 *   seats-licences  → <AdminSeatsLicencesPanel />                    (osobny komponent, StandardTable)
 *   billing-details → <AdminBillingFinOpsPanel screen="controls" />  (ALIAS budgets-alerts — ta sama zakładka)
 *   budgets-alerts  → <AdminBillingFinOpsPanel screen="controls" />
 *   plan-history    → <AdminPlanHistoryPanel />                      (osobny komponent, StandardTable)
 *
 * Dwie pary aliasów (usage-costs≡overview, billing-details≡budgets-alerts)
 * NIE są błędem harnessu — to WIRE_ONLY skrót w produkcie (komentarz przy
 * `AdminSettingsModule.tsx:447` mówi wprost: „Billing details" nie ma
 * jeszcze własnej zakładki). Zrzuty obu par będą pikselowo identyczne —
 * fotografujemy mimo to KAŻDY z 9 nav-slotów osobno, bo to jest realny stan
 * produktu i sposób, w jaki Piotr go zobaczy pod każdą z 9 nazw menu.
 *
 * Żadnej reimplementacji: montujemy REALNE komponenty
 * (`AdminBillingFinOpsPanel` / `AdminSeatsLicencesPanel` /
 * `AdminPlanHistoryPanel`), które wołają `Api.getAdminBilling*` (src/services/api.ts,
 * fetch pod `/api/admin/billing/*`) i `getAdminSeats*`/`getPlanHistory`
 * (src/services/adminSeatsApi.ts, adminBillingHistoryApi.ts, przez
 * apiGet/apiPut → też `window.fetch`). Stubujemy `window.fetch` po URL-u,
 * scoped do `/admin/billing`, `/admin/seats`, `/admin/billing-history` —
 * NIE catch-all `/api/*` (pułapka opisana w i18n-fala1-smoke.tsx).
 *
 * Dane demo: fikcyjna organizacja „Atelier Toys" (ten sam org-id co inne
 * harnesse Admina, dla spójności), kwoty w PLN, polskie numery faktur i NIP.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AdminBillingFinOpsPanel } from '../../src/components/Admin/AdminBillingFinOpsPanel';
import { AdminPlanHistoryPanel } from '../../src/components/Admin/AdminPlanHistoryPanel';
import { AdminSeatsLicencesPanel } from '../../src/components/Admin/AdminSeatsLicencesPanel';

export type AdminBillingScreenId =
  | 'overview'
  | 'plan-limits'
  | 'usage-costs'
  | 'payment-methods'
  | 'invoices'
  | 'seats-licences'
  | 'billing-details'
  | 'budgets-alerts'
  | 'plan-history';

const ORG_ID = 'org-atelier-toys-0001';

const PLAN_OPTIONS = [
  { id: 'plan-starter', name: 'Starter', price_monthly: 990, token_limit: 500000, storage_limit_gb: 20 },
  { id: 'plan-growth', name: 'Growth', price_monthly: 2490, token_limit: 2000000, storage_limit_gb: 100 },
  { id: 'plan-enterprise', name: 'Enterprise', price_monthly: 6900, token_limit: 8000000, storage_limit_gb: 500 },
];

const BILLING_SUMMARY = {
  summary: {
    plan: { name: 'Growth', tokenLimit: 2000000 },
    billing: { status: 'active' },
    usage: { tokensUsed: 1284000, tokenBalance: 716000 },
    alerts: { costCapMonthly: 5000, emailNotifications: true },
  },
};

const USAGE_RECORDS = Array.from({ length: 8 }, (_, i) => ({
  id: `usage-${i + 1}`,
  date: `2026-08-${String(i + 1).padStart(2, '0')}`,
  tokens: 40000 + i * 3200,
  cost_pln: Number((36 + i * 2.4).toFixed(2)),
}));

const USAGE_DETAILS = {
  summary: {
    overageRates: { tokenOverageRate: 0.0009, storageOverageRate: 1.2 },
    usageRecords: USAGE_RECORDS,
  },
};

const PAYMENT_METHODS = [
  { id: 'pm_1', brand: 'Visa', last4: '4242', exp_month: 9, exp_year: 2027, is_default: true },
  { id: 'pm_2', brand: 'Mastercard', last4: '0058', exp_month: 3, exp_year: 2026, is_default: false },
];

const INVOICES = [
  { id: 'inv_1', invoice_number: 'FV/2026/08/0142', status: 'paid', amount_due: 2490.0, amount_paid: 2490.0, due_date: '2026-08-05' },
  { id: 'inv_2', invoice_number: 'FV/2026/07/0119', status: 'paid', amount_due: 2490.0, amount_paid: 2490.0, due_date: '2026-07-05' },
  { id: 'inv_3', invoice_number: 'FV/2026/06/0098', status: 'paid', amount_due: 2490.0, amount_paid: 2490.0, due_date: '2026-06-05' },
  { id: 'inv_4', invoice_number: 'FV/2026/09/0163', status: 'open', amount_due: 2490.0, amount_paid: 0, due_date: '2026-09-05' },
  { id: 'inv_5', invoice_number: 'FV/2026/05/0071', status: 'void', amount_due: 0, amount_paid: 0, due_date: '2026-05-05' },
];

const BILLING_ALERTS = {
  available: true,
  alerts: [
    { id: 'alert-1', threshold: 4000 },
    { id: 'alert-2', threshold: 8000 },
  ],
};

const TAX_SETTINGS = {
  settings: {
    company: { legalName: 'Atelier Toys Sp. z o.o.' },
    tax: { taxId: 'PL 527-020-46-93' },
  },
};

const SEATS_CONFIG = {
  config: {
    total_seats_available: 25,
    seats_used: 18,
    seats_remaining: 7,
    utilization_percent: '72',
    auto_add_seats_on_invite: 1,
    auto_add_seats_threshold: 80,
  },
};

const SEATS_HISTORY = {
  transactions: [
    {
      id: 'seat-tx-1',
      transaction_type: 'purchase',
      seats_count: 5,
      total_amount: 495.0,
      triggered_by_email: 'piotr@atelier-toys.pl',
      first_name: 'Piotr',
      last_name: 'Wiśniewski',
      created_at: '2026-08-01T09:12:00Z',
    },
    {
      id: 'seat-tx-2',
      transaction_type: 'auto_add',
      seats_count: 2,
      total_amount: 198.0,
      triggered_by_email: null,
      first_name: null,
      last_name: null,
      created_at: '2026-07-18T14:30:00Z',
    },
    {
      id: 'seat-tx-3',
      transaction_type: 'manual_adjustment',
      seats_count: -1,
      total_amount: null,
      triggered_by_email: 'anna@atelier-toys.pl',
      first_name: 'Anna',
      last_name: 'Kowalska',
      created_at: '2026-06-22T11:05:00Z',
    },
    {
      id: 'seat-tx-4',
      transaction_type: 'purchase',
      seats_count: 10,
      total_amount: 990.0,
      triggered_by_email: 'piotr@atelier-toys.pl',
      first_name: 'Piotr',
      last_name: 'Wiśniewski',
      created_at: '2026-05-10T08:00:00Z',
    },
  ],
};

const PLAN_HISTORY = {
  success: true,
  data: [
    {
      id: 'ph-1',
      action: 'upgrade',
      from_plan: 'Starter',
      to_plan: 'Growth',
      reason: 'Wzrost zespołu do 18 osób',
      performed_by: 'piotr@atelier-toys.pl',
      created_at: '2026-06-01T10:00:00Z',
      metadata: null,
    },
    {
      id: 'ph-2',
      action: 'renewal',
      from_plan: 'Growth',
      to_plan: 'Growth',
      reason: 'Automatyczne odnowienie',
      performed_by: null,
      created_at: '2026-07-01T02:00:00Z',
      metadata: null,
    },
    {
      id: 'ph-3',
      action: 'renewal',
      from_plan: 'Growth',
      to_plan: 'Growth',
      reason: 'Automatyczne odnowienie',
      performed_by: null,
      created_at: '2026-08-01T02:00:00Z',
      metadata: null,
    },
  ],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Instalacja stuba `window.fetch` raz (idempotentnie na HMR), scoped do
// URL-i /admin/billing*, /admin/seats*, /admin/billing-history — NIE catch-all
// `/api/*` (patrz komentarz w admin-command-center-panel.tsx / i18n-fala1-smoke.tsx
// dla powodu, dla którego to jest ważne przy eager-importowanych story).
const g = window as unknown as { __ADMIN_BILLING_FETCH__?: boolean };
if (!g.__ADMIN_BILLING_FETCH__) {
  g.__ADMIN_BILLING_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      if (url.includes('/admin/billing/summary')) return jsonResponse(BILLING_SUMMARY);
      if (url.includes('/admin/billing/plans')) return jsonResponse({ plans: PLAN_OPTIONS });
      if (url.includes('/admin/billing/plan') && method === 'PUT')
        return jsonResponse({ success: true });
      if (url.includes('/admin/billing/payment-methods')) {
        if (method === 'POST')
          return jsonResponse({ success: true, paymentMethod: PAYMENT_METHODS[0] });
        if (method === 'PUT') return jsonResponse({ success: true });
        if (method === 'DELETE') return jsonResponse({ success: true });
        return jsonResponse({ paymentMethods: PAYMENT_METHODS });
      }
      if (url.includes('/admin/billing/invoices')) return jsonResponse({ invoices: INVOICES });
      if (url.includes('/admin/billing/usage-details')) return jsonResponse(USAGE_DETAILS);
      if (url.includes('/admin/billing/alerts')) {
        if (method === 'PUT') return jsonResponse({ success: true, alerts: BILLING_ALERTS.alerts });
        return jsonResponse(BILLING_ALERTS);
      }
      if (url.includes('/admin/billing/tax-settings')) {
        if (method === 'PUT') return jsonResponse(TAX_SETTINGS);
        return jsonResponse(TAX_SETTINGS);
      }
      if (url.includes('/admin/seats/history')) return jsonResponse(SEATS_HISTORY);
      if (url.includes('/admin/seats/auto-add') && method === 'PUT')
        return jsonResponse(SEATS_CONFIG);
      if (url.includes('/admin/seats')) return jsonResponse(SEATS_CONFIG);
      if (url.includes('/admin/billing-history')) return jsonResponse(PLAN_HISTORY);
    } catch {
      /* fall through to real fetch (np. i18n /locales/**) */
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

// Mapowanie 1:1 z AdminSettingsModule.tsx case 'billing'.
function renderBillingScreen(adminScreen: AdminBillingScreenId): React.ReactElement {
  if (adminScreen === 'plan-history') return <AdminPlanHistoryPanel />;
  if (adminScreen === 'seats-licences') return <AdminSeatsLicencesPanel />;
  const tab = (
    {
      overview: 'summary',
      'plan-limits': 'plan',
      'usage-costs': 'summary',
      'payment-methods': 'payments',
      invoices: 'invoices',
      'budgets-alerts': 'controls',
      'billing-details': 'controls',
    } as const
  )[adminScreen];
  return <AdminBillingFinOpsPanel screen={tab} />;
}

export default function AdminBillingScreen(props: {
  adminScreen: AdminBillingScreenId;
}): React.ReactElement {
  // `&ekran=` w URL nadpisuje prop domyślny — pozwala odpalić dowolny
  // z 9 ekranów spod jednego wpisu w main.tsx, gdyby był potrzebny ad-hoc
  // podgląd bez dodawania nowego klucza rejestru.
  const requested = new URLSearchParams(window.location.search).get(
    'ekran'
  ) as AdminBillingScreenId | null;
  const adminScreen = requested || props.adminScreen;
  return (
    /*
      SZEROKOSC = SZEROKOSC WOLACZA (naprawa przyrzadu 2026-09-02).
      Zgloszenie wlasciciela na `admin-command-attention-queue`: "to nie jest
      szerokosc strony". Stal tu wlasny inline `maxWidth: 1200` - liczba,
      ktorej NIE MA u zadnego wolacza produkcyjnego. Realny wolacz kazdego
      z tych paneli to `src/views/admin/AdminSettingsModule.tsx:599`:
      `mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-5 lg:p-6`. Harness
      zwezal produkt o 80 px i gubil responsywny padding - defekt PRZYRZADU,
      nie produktu (ta sama klasa co Z-32b: `max-w-3xl` wklejony w harnessie
      Finansow). Bramka R3 tego nie zlapala, bo szuka klas `max-w-*`, a to
      byl inline `style`.
    */
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-5 lg:p-6">
      <DebugBoundary>
        <MemoryRouter initialEntries={['/']}>{renderBillingScreen(adminScreen)}</MemoryRouter>
      </DebugBoundary>
    </div>
  );
}
