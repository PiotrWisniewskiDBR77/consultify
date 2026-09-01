/**
 * Dev-render host for Admin → domena "Stan systemu" (health), komplet
 * 7 ekranów z `src/components/Admin/adminNavigation.ts` (ADMIN_DOMAINS →
 * id 'health'). Runda odbioru grafiki 146-admin-audit-health (decyzja
 * właściciela 2026-08-31: cały panel Administracji wchodzi do rundy
 * odbioru; ta domena robiona razem z 'audit' w jednym dyżurze).
 *
 * Mapowanie ekran→komponent skopiowane 1:1 z realnego routingu w
 * `src/views/admin/AdminSettingsModule.tsx`:
 *   service-status       → <AdminHealthPanel canRunDiagnostics={false} />   (case 'health', linia ~526, domyślny)
 *   diagnostics          → <AdminHealthPanel canRunDiagnostics={false} />   (ALIAS service-status — brak własnej gałęzi)
 *   dependencies          → <AdminDependenciesPanel />
 *   incident-history      → <AdminIncidentHistoryPanel />
 *   queues-jobs           → <AdminJobsPanel />
 *   sla-slo               → <AdminSlaSloPanel />
 *   platform-operations   → gate UNAUTHORIZED (linie 314-328), NIE dociera
 *                            do case 'health' w ogóle — sprawdzane w komponencie
 *                            NADRZĘDNYM (content useMemo) PRZED switchem, bo
 *                            `CAN_ACCESS_PLATFORM_OPERATIONS` jest na sztywno
 *                            `false` (linia 79: "Fail closed until the backend
 *                            exposes a verified Platform Operator capability").
 *
 * ★ WAŻNE ZNALEZISKO (nie defekt harnessu — realny, zamierzony stan produktu):
 * `CAN_ACCESS_PLATFORM_OPERATIONS = false` na sztywno w AdminSettingsModule.tsx
 * oznacza, że `AdminHealthPanel` DOSTAJE `canRunDiagnostics={false}` zawsze —
 * dla KAŻDEGO admina klienta, bez wyjątku. Przy `canRunDiagnostics=false`
 * komponent (AdminHealthPanel.tsx:77-85) w ogóle NIE WOŁA
 * `Api.getHealthPanelProbes()` — `load()` wraca natychmiast z pustym stanem —
 * i renderuje na stałe kartę „Status odczytu: UNKNOWN" z tekstem „Nie istnieje
 * jeszcze zweryfikowany endpoint zbiorczy bez szczegółów operatora." Innymi
 * słowy: `service-status` i jego alias `diagnostics` są dziś ZAWSZE tym samym,
 * statycznym ekranem — nie ma żadnych żywych danych, mimo że nav-slot jest
 * oznaczony jako „connected" w switchu. To jest UCZCIWA pustka (kod mówi
 * wprost dlaczego), ale NIE jest to działający ekran z danymi — oceniane
 * poniżej jako placeholder zamierzony, z opisem, nie jako zwykły „ekran
 * z danymi".
 *
 * Druga para: `platform-operations` jest równocześnie (a) odfiltrowany z
 * nawigacji (`AdminSettingsSidebar.tsx:48-51`, `!canAccessPlatformOperations`
 * usuwa ten slot z domeny 'health' w menu) i (b) twardo zablokowany na
 * poziomie trasy (UNAUTHORIZED alert, zero CTA). Nie jest to
 * `AdminCapabilityState` („niezweryfikowane") — to osobny, dedykowany gate
 * fail-closed. Rejestrujemy i fotografujemy mimo braku wejścia z menu, bo
 * ekran istnieje pod bezpośrednim URL-em i jest realnym stanem produktu.
 *
 * Żadnej reimplementacji: montujemy REALNE komponenty
 * (`AdminHealthPanel` / `AdminDependenciesPanel` / `AdminIncidentHistoryPanel`
 * / `AdminJobsPanel` / `AdminSlaSloPanel`), które wołają prawdziwe endpointy:
 *   GET  /api/admin/health-panel/probes        (Api.getHealthPanelProbes — NIE wołany gdy canRunDiagnostics=false)
 *   GET  /api/admin/health-panel/dependencies  (getAdminDependencies)
 *   GET  /api/admin/health-panel/summary       (Api.getHealthPanelSummary)
 *   GET  /api/admin/health-panel/jobs          (getAdminJobs)
 *   GET  /api/enterprise-v4/slos               (getTenantSlos)
 *   GET  /api/ai-operations/sla/status         (getAiSlaStatus)
 * Wszystkie zweryfikowane w server/src/routes/admin/health-panel.routes.ts,
 * server/src/routes/enterprise-platform.routes.ts,
 * server/src/routes/ai/ai-operations.routes.ts, zamontowane w
 * server/src/Gateway.ts — nie są to fantomy.
 *
 * Dane demo: fikcyjna organizacja „Atelier Toys" (ten sam org-id co inne
 * harnesse Admina, dla spójności).
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AdminDependenciesPanel } from '../../src/components/Admin/AdminDependenciesPanel';
import { AdminHealthPanel } from '../../src/components/Admin/AdminHealthPanel';
import { AdminIncidentHistoryPanel } from '../../src/components/Admin/AdminIncidentHistoryPanel';
import { AdminJobsPanel } from '../../src/components/Admin/AdminJobsPanel';
import { AdminSlaSloPanel } from '../../src/components/Admin/AdminSlaSloPanel';

export type AdminHealthScreenId =
  | 'service-status'
  | 'diagnostics'
  | 'dependencies'
  | 'incident-history'
  | 'queues-jobs'
  | 'sla-slo'
  | 'platform-operations';

const DEPENDENCIES = {
  success: true,
  dependencies: [
    {
      dependencyId: 'dep-postgres',
      label: 'Baza danych (PostgreSQL)',
      kind: 'database',
      status: 'healthy',
      probeIds: ['db-roundtrip', 'db-write-read'],
      lastCheckedAt: '2026-08-31T07:12:00Z',
    },
    {
      dependencyId: 'dep-llm-gateway',
      label: 'Brama LLM (Anthropic)',
      kind: 'external_provider',
      status: 'degraded',
      probeIds: ['llm-completion'],
      lastCheckedAt: '2026-08-31T07:10:00Z',
    },
    {
      dependencyId: 'dep-job-queue',
      label: 'Kolejka zadań (admin_iam_jobs)',
      kind: 'queue',
      status: 'healthy',
      probeIds: ['queue-drain'],
      lastCheckedAt: '2026-08-31T07:11:00Z',
    },
    {
      dependencyId: 'dep-storage',
      label: 'Magazyn plików',
      kind: 'internal_service',
      status: 'unknown',
      probeIds: [],
      lastCheckedAt: null,
    },
  ],
  undeclaredProbes: ['legacy-cache-warm'],
  generatedAt: '2026-08-31T07:12:30Z',
};

const HEALTH_SUMMARY = {
  success: true,
  envAllowed: true,
  summary: { total: 9, passed: 7, failed: 1, unknown: 1, overall: 'fail' },
  probes: [
    { probeId: 'db-roundtrip', module: 'core', title: 'Baza danych — round-trip', status: 'pass', durationMs: 42, ranAt: '2026-08-31T07:12:00Z' },
    { probeId: 'llm-completion', module: 'ai', title: 'LLM — dokończenie', status: 'fail', durationMs: 3100, ranAt: '2026-08-31T07:10:00Z' },
  ],
};

const JOBS = {
  success: true,
  jobs: [
    { id: 'job-1', job_type: 'send_invite_email', status: 'succeeded', attempt_count: 1, max_attempts: 5, last_error: null, available_at: '2026-08-31T07:00:00Z', created_at: '2026-08-31T06:59:00Z' },
    { id: 'job-2', job_type: 'sync_scim_group', status: 'failed', attempt_count: 5, max_attempts: 5, last_error: 'Upstream 503', available_at: '2026-08-31T06:45:00Z', created_at: '2026-08-31T06:30:00Z' },
    { id: 'job-3', job_type: 'export_audit_logs', status: 'running', attempt_count: 1, max_attempts: 3, last_error: null, available_at: '2026-08-31T07:15:00Z', created_at: '2026-08-31T07:14:00Z' },
    { id: 'job-4', job_type: 'recalculate_seats', status: 'queued', attempt_count: 0, max_attempts: 3, last_error: null, available_at: '2026-08-31T07:20:00Z', created_at: '2026-08-31T07:16:00Z' },
    { id: 'job-5', job_type: 'send_invite_email', status: 'succeeded', attempt_count: 1, max_attempts: 5, last_error: null, available_at: '2026-08-30T18:02:00Z', created_at: '2026-08-30T18:01:00Z' },
  ],
  pagination: { limit: 50, offset: 0 },
};

const SLOS = {
  slos: [
    { id: 'slo-1', slo_name: 'Dostępność API (30 dni)', target_percentage: 99.9, window_days: 30, current_percentage: 99.94, budget_remaining: 62 },
    { id: 'slo-2', slo_name: 'Czas odpowiedzi LLM p95', target_percentage: 98, window_days: 7, current_percentage: 96.2, budget_remaining: -3 },
    { id: 'slo-3', slo_name: 'Sukces zadań w tle', target_percentage: 99, window_days: 30, current_percentage: null, budget_remaining: null },
  ],
};

const AI_SLA_STATUS = { status: 'ok', lastCheckedAt: '2026-08-31T07:00:00Z', breaches: 1 };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Instalacja stuba `window.fetch` raz (idempotentnie na HMR), scoped do
// URL-i realnie wołanych przez ekrany domeny 'health' — NIE catch-all
// `/api/*` (patrz komentarz w admin-billing.tsx / i18n-fala1-smoke.tsx).
// `/admin/health-panel/probes` i `/run` są tu zarejestrowane mimo że
// `service-status`/`diagnostics` ich dziś NIE wołają (canRunDiagnostics=false
// wycina wywołanie — patrz nagłówek pliku) — trzymamy stub na wypadek, gdyby
// ktoś ręcznie podniósł capability podczas przeglądu.
const g = window as unknown as { __ADMIN_HEALTH_FETCH__?: boolean };
if (!g.__ADMIN_HEALTH_FETCH__) {
  g.__ADMIN_HEALTH_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      if (url.includes('/admin/health-panel/dependencies')) return jsonResponse(DEPENDENCIES);
      if (url.includes('/admin/health-panel/summary')) return jsonResponse(HEALTH_SUMMARY);
      if (url.includes('/admin/health-panel/jobs')) return jsonResponse(JOBS);
      if (url.includes('/admin/health-panel/run') && method === 'POST')
        return jsonResponse({ success: true, results: [], summary: HEALTH_SUMMARY.summary });
      if (url.includes('/admin/health-panel/probes'))
        return jsonResponse({
          success: true,
          envAllowed: true,
          catalog: [],
          results: HEALTH_SUMMARY.probes,
          summary: HEALTH_SUMMARY.summary,
        });
      if (url.includes('/enterprise-v4/slos')) return jsonResponse(SLOS);
      if (url.includes('/ai-operations/sla/status')) return jsonResponse(AI_SLA_STATUS);
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

// Kopia 1:1 gate'u UNAUTHORIZED z AdminSettingsModule.tsx (linie 314-328) —
// nie jest to `AdminCapabilityState`, tylko osobny, dedykowany blok. Ta
// gałąź wykonuje się w produkcie PRZED switchem case 'health', bo
// CAN_ACCESS_PLATFORM_OPERATIONS jest na sztywno `false`.
function PlatformOperationsUnauthorized(): React.ReactElement {
  return (
    <section
      role="alert"
      className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6"
    >
      <h2 className="text-base font-semibold text-[var(--c-text)]">UNAUTHORIZED</h2>
      <p className="mt-2 text-sm text-[var(--c-text-secondary)]">
        Operacje platformowe nie należą do administracji klienta i wymagają jawnej capability
        operatora platformy.
      </p>
    </section>
  );
}

// Mapowanie 1:1 z AdminSettingsModule.tsx (case 'health' + gate przed switchem).
function renderHealthScreen(adminScreen: AdminHealthScreenId): React.ReactElement {
  if (adminScreen === 'platform-operations') return <PlatformOperationsUnauthorized />;
  if (adminScreen === 'incident-history') return <AdminIncidentHistoryPanel />;
  if (adminScreen === 'dependencies') return <AdminDependenciesPanel />;
  if (adminScreen === 'queues-jobs') return <AdminJobsPanel />;
  if (adminScreen === 'sla-slo') return <AdminSlaSloPanel />;
  // service-status, diagnostics (ALIAS) — CAN_ACCESS_PLATFORM_OPERATIONS
  // jest na sztywno false w produkcie, patrz nagłówek pliku.
  return <AdminHealthPanel canRunDiagnostics={false} />;
}

export default function AdminHealthScreen(props: {
  adminScreen: AdminHealthScreenId;
}): React.ReactElement {
  // `&ekran=` w URL nadpisuje prop domyślny — pozwala odpalić dowolny
  // z 7 ekranów spod jednego wpisu w main.tsx.
  const requested = new URLSearchParams(window.location.search).get(
    'ekran'
  ) as AdminHealthScreenId | null;
  const adminScreen = requested || props.adminScreen;
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <DebugBoundary>
        <MemoryRouter initialEntries={['/']}>{renderHealthScreen(adminScreen)}</MemoryRouter>
      </DebugBoundary>
    </div>
  );
}
