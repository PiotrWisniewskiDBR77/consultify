/**
 * Dev-render host for Admin → domena "Centrum administracyjne" (command),
 * komplet 11 ekranów z `src/components/Admin/adminNavigation.ts`
 * (ADMIN_DOMAINS → id 'command'). Runda odbioru grafiki 146-admin-command
 * (decyzja właściciela: rejestr grafiki miał tylko JEDEN wiersz
 * `admin-command-center-panel` opisujący kilka zakładek naraz — ta runda
 * fotografuje KAŻDY nav-slot osobno, wzorem 146-admin-billing/-security/
 * -team/-ai/-audit-health).
 *
 * Mapowanie ekran→komponent skopiowane 1:1 z realnego routingu w
 * `src/views/admin/AdminSettingsModule.tsx` (case 'command', linie ~495-520):
 *   overview                → <AdminCommandCenterPanel screen={undefined} aggregationOnly />
 *   attention-queue          → <AdminCommandCenterPanel screen="attention-queue" />
 *   cost-capacity            → <AdminCommandCenterPanel screen="cost-capacity" />
 *   organization-defaults    → <AdminOrganizationDefaultsPanel />           (osobny komponent, BEZ StandardTable — to formularz)
 *   agent-trace              → <AdminCommandCenterPanel screen="agent-trace" />
 *   audit                    → <AdminCommandCenterPanel screen="audit" />
 *   dlp                      → <AdminCommandCenterPanel screen="dlp" />
 *   residency                → <AdminCommandCenterPanel screen="residency" />
 *   retention                → <AdminCommandCenterPanel screen="retention" />
 *   ai-policy                → <AdminCommandCenterPanel screen="ai-policy" />
 *   benchmark                → <AdminCommandCenterPanel screen="benchmark" />
 *
 * ADM-OWN-001 zweryfikowane w `AdminCommandCenterPanel.tsx:834-840`: dawny
 * WEWNĘTRZNY poziomy pill-nav (`?tab=`) jest USUNIĘTY — komponent renderuje
 * WYŁĄCZNIE tę zakładkę, którą dostał przez prop `screen` z zewnętrznego
 * pionowego AdminSettingsSidebar. Żadnych aliasów treści w tej domenie: 11
 * nav-slotów → 11 różnych renderów (organization-defaults ma zupełnie inny
 * komponent; pozostałe 10 mają odrębną treść wewnątrz AdminCommandCenterPanel
 * — overview to kafle+podsumowania, attention-queue/cost-capacity mają WŁASNY
 * układ bez wspólnego nagłówka "commandCenter.title", reszta dzieli nagłówek
 * ale różni się treścią zakładki).
 *
 * Żadnej reimplementacji: montujemy REALNE komponenty
 * (`AdminCommandCenterPanel`, `AdminOrganizationDefaultsPanel`), które wołają
 * `Api.*` (src/services/api.ts) i `enterpriseComplianceApi.ts` /
 * `V8FinanceApi` (src/services/api/v8/finance.ts) — wszystko przez
 * `window.fetch`. Stubujemy fetch po URL-u, scoped do `/admin/risk`,
 * `/admin/audit-logs/stats`, `/admin/billing/*`, `/admin/health-panel`,
 * `/admin/enterprise-compliance/*`, `/admin/organization-profile`,
 * `/v8/finance/settings` — NIE catch-all `/api/*`.
 *
 * ★ ZNALEZISKO (nie naprawiane tu — to harness, nie produkt): mock
 * `/admin/risk/summary` poniżej zwraca PRAWDZIWY kształt backendu
 * (`{ organizationId, summary: { audit: { highRiskCount, ... }, incidents } }`,
 * 1:1 z `server/src/routes/adminP32.routes.ts:2942-2950` i `readRiskSummary`
 * linia 2139). Ale `CommandCenterAttentionQueue` w
 * `AdminCommandCenterPanel.tsx:106` czyta `risk?.highRiskCount` — ścieżka
 * płaska, nie `risk?.summary?.audit?.highRiskCount`. Efekt: sygnał "ryzyko"
 * w kolejce uwagi NIGDY nie pokaże realnej liczby ani statusu critical,
 * zawsze wygląda jak `info`/„0 zdarzeń wysokiego ryzyka" — niezależnie od
 * stanu bazy. Widoczne na zrzucie `admin-command-attention-queue`. Sygnał
 * "audit" korzysta z INNEGO, płaskiego endpointu (`/admin/audit-logs/stats`
 * → `{ unresolvedCount, highRiskCount }` wprost) i działa poprawnie.
 *
 * Dane demo: ta sama fikcyjna organizacja „Atelier Toys" co inne harnesse
 * Admina (org-atelier-toys-0001), dla spójności między rundami.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AdminCommandCenterPanel } from '../../src/components/Admin/AdminCommandCenterPanel';
import { AdminOrganizationDefaultsPanel } from '../../src/components/Admin/AdminOrganizationDefaultsPanel';

export type AdminCommandScreenId =
  | 'overview'
  | 'attention-queue'
  | 'cost-capacity'
  | 'organization-defaults'
  | 'agent-trace'
  | 'audit'
  | 'dlp'
  | 'residency'
  | 'retention'
  | 'ai-policy'
  | 'benchmark';

const ORG_ID = 'org-atelier-toys-0001';

// ── Enterprise-compliance (Audyt SOC2 / DLP / Rezydencja / Retencja / AI policy) ──
// Koperta `{ success, data }`, 1:1 z `enterpriseComplianceApi.ts` (BASE
// `/admin/enterprise-compliance`), tożsame dane co
// `admin-command-center-panel.tsx` (spójność między starym i nowym rejestrem).
const AI_POLICY = {
  organizationId: ORG_ID,
  allowedTopics: [],
  blockedTopics: ['strategia konkurencji', 'niepublikowany cennik'],
  maxTokensPerConversation: 200000,
  maxTokensPerMessage: 8000,
  mandatoryDisclaimers: ['Treść wygenerowana przez AI — zweryfikuj przed dostawą do klienta.'],
  requiredCitationMode: 'required',
  blockedTools: [],
  allowedModels: ['claude-opus', 'claude-sonnet'],
  dataResidencyRegion: 'eu-west-1',
  enforceEuOnly: true,
  customSafetyRules: [],
};

const DATA_RESIDENCY = {
  enforceEuOnly: true,
  dataResidencyRegion: 'eu-west-1',
  allowedRegions: ['eu-west-1', 'eu-central-1'],
  deniedRegions: ['us-east-1'],
};

const DLP_RULES = [
  {
    id: 'dlp-1',
    organizationId: ORG_ID,
    ruleName: 'Blokada numerów kart płatniczych',
    ruleType: 'regex',
    pattern: '\\b(?:\\d[ -]*?){13,16}\\b',
    action: 'block',
    appliesTo: 'both',
    severity: 'critical',
    isActive: true,
  },
  {
    id: 'dlp-2',
    organizationId: ORG_ID,
    ruleName: 'Niepublikowany cennik',
    ruleType: 'keyword',
    pattern: 'niepublikowany cennik',
    action: 'redact',
    appliesTo: 'output',
    severity: 'high',
    isActive: true,
  },
  {
    id: 'dlp-3',
    organizationId: ORG_ID,
    ruleName: 'PESEL / dane osobowe',
    ruleType: 'entity',
    pattern: 'PESEL',
    action: 'block',
    appliesTo: 'input',
    severity: 'critical',
    isActive: true,
  },
  {
    id: 'dlp-4',
    organizationId: ORG_ID,
    ruleName: 'Wzmianka o konkurencie',
    ruleType: 'keyword',
    pattern: 'strategia konkurencji',
    action: 'warn',
    appliesTo: 'both',
    severity: 'medium',
    isActive: false,
  },
  {
    id: 'dlp-5',
    organizationId: ORG_ID,
    ruleName: 'Adres e-mail klienta',
    ruleType: 'regex',
    pattern: '[\\w.-]+@[\\w.-]+\\.\\w+',
    action: 'log',
    appliesTo: 'output',
    severity: 'low',
    isActive: true,
  },
];

const RETENTION_SCHEDULES = [
  {
    id: 'ret-1',
    organizationId: ORG_ID,
    dataType: 'conversations',
    retentionDays: 365,
    nextCleanupAt: '2026-09-01T02:00:00Z',
    lastCleanupAt: '2026-08-01T02:00:00Z',
    itemsDeletedTotal: 412,
    notificationSent: true,
    isActive: true,
  },
  {
    id: 'ret-2',
    organizationId: ORG_ID,
    dataType: 'documents',
    retentionDays: 730,
    nextCleanupAt: '2026-10-15T02:00:00Z',
    lastCleanupAt: '2026-07-15T02:00:00Z',
    itemsDeletedTotal: 58,
    notificationSent: true,
    isActive: true,
  },
  {
    id: 'ret-3',
    organizationId: ORG_ID,
    dataType: 'audit_logs',
    retentionDays: 2555,
    nextCleanupAt: null,
    lastCleanupAt: null,
    itemsDeletedTotal: 0,
    notificationSent: false,
    isActive: true,
  },
  {
    id: 'ret-4',
    organizationId: ORG_ID,
    dataType: 'exported_files',
    retentionDays: 90,
    nextCleanupAt: '2026-08-20T02:00:00Z',
    lastCleanupAt: '2026-07-20T02:00:00Z',
    itemsDeletedTotal: 231,
    notificationSent: true,
    isActive: true,
  },
  {
    id: 'ret-5',
    organizationId: ORG_ID,
    dataType: 'search_index_snapshots',
    retentionDays: 30,
    nextCleanupAt: '2026-08-16T02:00:00Z',
    lastCleanupAt: '2026-08-09T02:00:00Z',
    itemsDeletedTotal: 19,
    notificationSent: false,
    isActive: false,
  },
];

const AUDIT_ENTRIES = [
  {
    id: 'audit-1',
    organizationId: ORG_ID,
    userId: 'usr-piotr',
    conversationId: 'conv-101',
    eventType: 'chat.completion',
    requestHash: 'sha256:9f1a…c4e2',
    responseHash: 'sha256:71bd…0a33',
    modelId: 'claude-opus-4',
    tokensInput: 3200,
    tokensOutput: 1180,
    costUsd: 0.1842,
    latencyMs: 3120,
    policyDecisions: [{ policy: 'dlp', decision: 'allow' }],
    metadata: {},
    createdAt: '2026-08-14T09:12:00Z',
  },
  {
    id: 'audit-2',
    organizationId: ORG_ID,
    userId: 'usr-anna',
    eventType: 'document.export',
    requestHash: 'sha256:22de…88f1',
    responseHash: 'sha256:c901…5b7a',
    modelId: undefined,
    tokensInput: 0,
    tokensOutput: 0,
    costUsd: 0,
    latencyMs: 420,
    policyDecisions: [{ policy: 'residency', decision: 'allow' }],
    metadata: {},
    createdAt: '2026-08-14T11:45:00Z',
  },
  {
    id: 'audit-3',
    organizationId: ORG_ID,
    userId: 'usr-piotr',
    eventType: 'admin.settings.update',
    requestHash: 'sha256:a41c…f902',
    responseHash: 'sha256:0091…2dce',
    tokensInput: 0,
    tokensOutput: 0,
    costUsd: 0,
    latencyMs: 88,
    policyDecisions: [],
    metadata: {},
    createdAt: '2026-08-13T15:02:00Z',
  },
  {
    id: 'audit-4',
    organizationId: ORG_ID,
    userId: 'usr-marek',
    eventType: 'sso.login',
    requestHash: 'sha256:5cf0…33a1',
    responseHash: 'sha256:7712…9de4',
    tokensInput: 0,
    tokensOutput: 0,
    costUsd: 0,
    latencyMs: 210,
    policyDecisions: [{ policy: 'sso', decision: 'allow' }],
    metadata: {},
    createdAt: '2026-08-12T08:30:00Z',
  },
  {
    id: 'audit-5',
    organizationId: ORG_ID,
    userId: 'usr-piotr',
    conversationId: 'conv-99',
    eventType: 'dlp.violation.blocked',
    requestHash: 'sha256:e803…19bd',
    responseHash: 'sha256:6a2f…44c0',
    modelId: 'claude-sonnet-4',
    tokensInput: 512,
    tokensOutput: 0,
    costUsd: 0.0031,
    latencyMs: 95,
    policyDecisions: [{ policy: 'dlp', decision: 'block', reason: 'reguła krytyczna dopasowana' }],
    metadata: {},
    createdAt: '2026-08-11T17:20:00Z',
  },
];

// Ślad agentów (agent-trace) — z audit-trail/agent-decisions, kształt
// `AgentDecisionEntry` (enterpriseComplianceApi.ts:100-110).
const AGENT_DECISIONS = [
  {
    id: 'agent-1',
    createdAt: '2026-08-30T14:12:00Z',
    userId: 'usr-piotr',
    userName: 'Piotr Wiśniewski',
    actionType: 'SUGGESTION',
    actionDescription: 'Propozycja treści rozdziału „Analiza rynku" w dokumencie strategii.',
    aiRole: 'consultant-copilot',
    aiSuggestion: 'Wstawiono 3 akapity z benchmarkiem rynkowym.',
    userDecision: 'ACCEPTED',
    confidenceLevel: 'high',
    projectId: 'proj-atelier-2026',
  },
  {
    id: 'agent-2',
    createdAt: '2026-08-30T11:05:00Z',
    userId: 'usr-anna',
    userName: 'Anna Kowalska',
    actionType: 'AUTO_TAG',
    actionDescription: 'Automatyczne oznaczenie ryzyka na inicjatywie „Ekspansja EU".',
    aiRole: 'risk-scanner',
    aiSuggestion: 'Ryzyko: opóźnienie dostawcy (severity: medium).',
    userDecision: 'MODIFIED',
    confidenceLevel: 'medium',
    projectId: 'proj-atelier-2026',
  },
  {
    id: 'agent-3',
    createdAt: '2026-08-29T09:40:00Z',
    userId: 'usr-marek',
    userName: 'Marek Nowicki',
    actionType: 'SUGGESTION',
    actionDescription: 'Propozycja przeklasyfikowania zadania na „blokujące".',
    aiRole: 'planner',
    aiSuggestion: 'Zadanie zależy od nieukończonego wywiadu klienta.',
    userDecision: 'REJECTED',
    confidenceLevel: 'low',
    projectId: null,
  },
  {
    id: 'agent-4',
    createdAt: '2026-08-28T16:22:00Z',
    userId: 'usr-piotr',
    userName: 'Piotr Wiśniewski',
    actionType: 'DRAFT_GENERATION',
    actionDescription: 'Wygenerowano szkic maila podsumowującego warsztat.',
    aiRole: 'consultant-copilot',
    aiSuggestion: null,
    userDecision: null,
    confidenceLevel: 'high',
    projectId: 'proj-atelier-2026',
  },
];

// ── Attention queue / cost-capacity (Api.* — inny nagłówek URL-i) ──
// `/admin/risk/summary`: PRAWDZIWY kształt backendu — patrz komentarz
// ZNALEZISKO u góry pliku. Ustawiamy highRiskCount=4 celowo wysoko, żeby
// zrzut jednoznacznie pokazał, że frontend go i tak zignoruje (płaska
// ścieżka `risk?.highRiskCount` zawsze czyta undefined→0).
const RISK_SUMMARY_REAL = {
  organizationId: ORG_ID,
  summary: {
    audit: { totalLogs: 812, unresolvedCount: 9, highRiskCount: 4 },
    incidents: [
      { id: 'inc-1', provider: 'Anthropic', status: 'resolved', severity: 'medium' },
    ],
  },
};

const AUDIT_STATS = { totalLogs: 812, unresolvedCount: 9, highRiskCount: 4 };

const BILLING_ALERTS = {
  organizationId: ORG_ID,
  available: true,
  alerts: [
    { id: 'alert-1', threshold: 4000 },
    { id: 'alert-2', threshold: 8000 },
  ],
};

const HEALTH_SUMMARY = {
  summary: { total: 9, passed: 7, failed: 1, unknown: 1, overall: 'fail' },
};

const BILLING_SUMMARY = {
  summary: {
    plan: { name: 'Growth', tokenLimit: 2000000 },
    billing: { status: 'active' },
    usage: { tokensUsed: 1284000, tokenBalance: 716000 },
    alerts: { costCapMonthly: 5000, emailNotifications: true },
  },
  currentCost: 2490.0,
  forecast: 2680.5,
  seatsUsed: 18,
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
  utilizationPercent: 64,
};

const COST_ATTRIBUTION = {
  totalCost: 2490.0,
  byUser: [
    { userId: 'usr-piotr', cost: 1120.4, messageCount: 812 },
    { userId: 'usr-anna', cost: 840.15, messageCount: 511 },
    { userId: 'usr-marek', cost: 529.45, messageCount: 298 },
  ],
  byModel: [
    { modelId: 'claude-opus-4', cost: 1620.0, tokenCount: 1820000 },
    { modelId: 'claude-sonnet-4', cost: 870.0, tokenCount: 980000 },
  ],
  byDay: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-08-${String(24 + i).padStart(2, '0')}`,
    cost: Number((300 + i * 12.5).toFixed(2)),
  })),
};

// ── Organization defaults (Api.get/put + V8FinanceApi) ──
const ORG_PROFILE = {
  profile: {
    defaultTimezone: 'Europe/Warsaw',
    defaultLanguage: 'pl',
    dateFormat: 'DD.MM.YYYY',
  },
};

const V8_FINANCE_SETTINGS = {
  data: {
    defaultCurrency: 'PLN',
    defaultWacc: 0.095,
    defaultHorizonYears: 5,
    version: 3,
  },
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Instalacja stuba `window.fetch` raz (idempotentnie na HMR), scoped do
// URL-i realnie wołanych przez ekrany domeny `command` — NIE catch-all
// `/api/*` (patrz komentarz w admin-command-center-panel.tsx /
// i18n-fala1-smoke.tsx dla powodu, dla którego to jest ważne przy
// eager-importowanych story).
const g = window as unknown as { __ADMIN_COMMAND_FETCH__?: boolean };
if (!g.__ADMIN_COMMAND_FETCH__) {
  g.__ADMIN_COMMAND_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      // Enterprise-compliance (audyt/DLP/rezydencja/retencja/AI-policy/agent-trace)
      if (url.includes('/admin/enterprise-compliance/ai-policy')) {
        return jsonResponse({ success: true, data: AI_POLICY });
      }
      if (url.includes('/admin/enterprise-compliance/data-residency')) {
        return jsonResponse({ success: true, data: DATA_RESIDENCY });
      }
      if (url.includes('/admin/enterprise-compliance/dlp/rules') && method === 'GET') {
        return jsonResponse({ success: true, data: DLP_RULES });
      }
      if (url.includes('/admin/enterprise-compliance/retention/schedules') && method === 'GET') {
        return jsonResponse({ success: true, data: RETENTION_SCHEDULES });
      }
      if (url.includes('/admin/enterprise-compliance/audit-trail/agent-decisions')) {
        return jsonResponse({
          success: true,
          data: {
            entries: AGENT_DECISIONS,
            totalCount: AGENT_DECISIONS.length,
            exportedAt: '2026-08-30T18:00:00Z',
          },
        });
      }
      if (url.includes('/admin/enterprise-compliance/audit-trail/cost-attribution')) {
        return jsonResponse({ success: true, data: COST_ATTRIBUTION });
      }
      if (url.includes('/admin/enterprise-compliance/audit-trail/export')) {
        return jsonResponse({
          success: true,
          data: {
            entries: AUDIT_ENTRIES,
            totalCount: AUDIT_ENTRIES.length,
            exportedAt: '2026-08-30T18:00:00Z',
          },
        });
      }
      // Attention queue / cost capacity signals
      if (url.includes('/admin/risk/summary')) return jsonResponse(RISK_SUMMARY_REAL);
      if (url.includes('/admin/audit-logs/stats')) return jsonResponse(AUDIT_STATS);
      if (url.includes('/admin/billing/alerts')) return jsonResponse(BILLING_ALERTS);
      if (url.includes('/admin/health-panel/summary')) return jsonResponse(HEALTH_SUMMARY);
      if (url.includes('/admin/billing/summary')) return jsonResponse(BILLING_SUMMARY);
      if (url.includes('/admin/billing/usage-details')) return jsonResponse(USAGE_DETAILS);
      // Organization defaults
      if (url.includes('/admin/organization-profile')) {
        if (method === 'PUT') return jsonResponse(ORG_PROFILE);
        return jsonResponse(ORG_PROFILE);
      }
      if (url.includes('/v8/finance/settings')) return jsonResponse(V8_FINANCE_SETTINGS);
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

// Mapowanie 1:1 z AdminSettingsModule.tsx case 'command'.
function renderCommandScreen(adminScreen: AdminCommandScreenId): React.ReactElement {
  if (adminScreen === 'organization-defaults') {
    return <AdminOrganizationDefaultsPanel organizationId={ORG_ID} />;
  }
  return (
    <AdminCommandCenterPanel
      screen={
        adminScreen === 'overview'
          ? undefined
          : (adminScreen as React.ComponentProps<typeof AdminCommandCenterPanel>['screen'])
      }
      aggregationOnly={adminScreen === 'overview'}
    />
  );
}

export default function AdminCommandScreen(props: {
  adminScreen: AdminCommandScreenId;
}): React.ReactElement {
  // `&ekran=` w URL nadpisuje prop domyślny — pozwala odpalić dowolny
  // z 11 ekranów spod jednego wpisu w main.tsx, gdyby był potrzebny ad-hoc
  // podgląd bez dodawania nowego klucza rejestru.
  const requested = new URLSearchParams(window.location.search).get(
    'ekran'
  ) as AdminCommandScreenId | null;
  const adminScreen = requested || props.adminScreen;
  return (
    /*
      SZEROKOSC = SZEROKOSC WOLACZA (naprawa przyrzadu 2026-09-02).
      Zgloszenie wlasciciela na `admin-command-attention-queue`: "to nie jest
      szerokosc strony". Stal tu wlasny inline `maxWidth: 1200` - liczba,
      ktorej NIE MA u zadnego wolacza produkcyjnego. Realny wolacz kazdego
      z tych paneli to `src/views/admin/AdminSettingsModule.tsx:599`:
      `w-full space-y-6 p-4 sm:p-5 lg:p-6` (od 2026-09-02 BEZ `max-w-[1280px]`
      — sufit zdjety w produkcie, patrz nota tamze). Harness
      zwezal produkt o 80 px i gubil responsywny padding - defekt PRZYRZADU,
      nie produktu (ta sama klasa co Z-32b: `max-w-3xl` wklejony w harnessie
      Finansow). Bramka R3 tego nie zlapala, bo szuka klas `max-w-*`, a to
      byl inline `style`.
    */
    <div className="w-full space-y-6 p-4 sm:p-5 lg:p-6">
      <DebugBoundary>
        <MemoryRouter initialEntries={['/']}>{renderCommandScreen(adminScreen)}</MemoryRouter>
      </DebugBoundary>
    </div>
  );
}
