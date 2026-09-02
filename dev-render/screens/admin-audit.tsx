/**
 * Dev-render host for Admin → domena "Dziennik audytu" (audit), komplet
 * 7 ekranów z `src/components/Admin/adminNavigation.ts` (ADMIN_DOMAINS →
 * id 'audit'). Runda odbioru grafiki 146-admin-audit-health (decyzja
 * właściciela 2026-08-31: cały panel Administracji wchodzi do rundy
 * odbioru; ta domena robiona razem z 'health' w jednym dyżurze).
 *
 * Mapowanie ekran→komponent skopiowane 1:1 z realnego routingu w
 * `src/views/admin/AdminSettingsModule.tsx` (case 'audit', linie ~488-494):
 *   events               → <AdminAuditLogPanel />
 *   high-risk-changes    → <AdminAuditLogPanel />   (ALIAS events — brak własnej gałęzi w switchu)
 *   retention-export     → <AdminAuditLogPanel />   (ALIAS events — brak własnej gałęzi w switchu)
 *   compliance-evidence  → <AdminComplianceEvidencePanel />
 *   integrity            → <AdminAuditIntegrityPanel />
 *   legal-hold           → <AdminLegalHoldPanel />
 *   export-history       → <AdminAuditExportHistoryPanel />
 *
 * Para aliasów (high-risk-changes≡events, retention-export≡events) NIE jest
 * błędem harnessu — to WIRE_ONLY skrót w produkcie (komentarz przy
 * `AdminSettingsModule.tsx:374-378` mówi wprost: oba sloty nawigacyjne nie
 * mają własnej pod-widoku, AdminAuditLogPanel — już domyślny `events` —
 * pokazuje licznik wysokiego ryzyka i kontrolki retencji/eksportu
 * bezwarunkowo). Zrzuty tej trójki będą pikselowo identyczne — fotografujemy
 * mimo to KAŻDY z 3 nav-slotów osobno, bo to jest realny stan produktu.
 *
 * Żadnej reimplementacji: montujemy REALNE komponenty
 * (`AdminAuditLogPanel` / `AdminComplianceEvidencePanel` /
 * `AdminAuditIntegrityPanel` / `AdminLegalHoldPanel` /
 * `AdminAuditExportHistoryPanel`), które wołają prawdziwe endpointy:
 *   GET  /api/admin/audit-logs                       (Api.getTenantAdminAuditLogs)
 *   GET  /api/admin/audit-logs/stats                  (Api.getTenantAdminAuditStats)
 *   GET  /api/admin/risk/summary                      (Api.getAdminRiskSummary)
 *   GET  /api/admin/compliance/summary                (Api.getAdminComplianceSummary)
 *   PUT  /api/admin/compliance/data-retention          (Api.updateAdminComplianceDataRetention)
 *   GET  /api/admin/audit-logs/export                  (Api.exportTenantAdminAuditLogs, Blob CSV)
 *   GET  /api/admin/enterprise-compliance/data-residency        (getDataResidency)
 *   GET  /api/admin/enterprise-compliance/retention/schedules   (getRetentionSchedules)
 *   GET  /api/admin/enterprise-compliance/ai-policy              (getAiPolicy)
 *   GET  /api/admin/legal-hold                         (getLegalHold)
 *   GET  /api/admin/audit-export-history                (getAuditExportHistory)
 * Wszystkie zweryfikowane w server/src/routes/{adminP32.routes.ts,
 * admin/legal-hold.routes.ts, admin/audit-export-history.routes.ts},
 * zamontowane w server/src/Gateway.ts — nie są to fantomy.
 *
 * ★ ZNALEZISKO PRZY BUDOWIE HARNESSU (nie defekt harnessu — defekt produktu):
 * `AdminComplianceEvidencePanel` (compliance-evidence) i `AdminAuditLogPanel`
 * (events) wołają TEN SAM endpoint `/admin/audit-logs`, ale czytają go
 * DWOMA różnymi kształtami pól. Backend (`readTenantAdminAuditProjection` /
 * `normalizeIamAuditEvent` / `normalizeUnifiedAuditEvent`,
 * adminP32.routes.ts:2208-2296) zwraca WYŁĄCZNIE snake_case:
 * `action_type`, `admin_id`, `risk_level`, `risk_score`, `status`,
 * `created_at`, `metadata_json`. `AdminAuditLogPanel` mapuje je poprawnie
 * (`log.action_type`, `log.admin_id`, ...). `AdminComplianceEvidencePanel`
 * (linie 81-110) NIE mapuje — czyta wprost `row.action`, `row.actor`,
 * `row.risk` z surowego rekordu, których tam NIE MA (tylko `createdAt ??
 * created_at` ma fallback). Efekt: w produkcyjnym compliance-evidence
 * kolumny „Zdarzenie"/„Aktor"/„Ryzyko" tabeli zdarzeń audytowych są PUSTE
 * dla każdego wiersza — tylko kolumna czasu się wypełnia. Mock poniżej
 * CELOWO podaje surowy, snake_case kształt (a nie wygodny, obchodzący ten
 * błąd) — zgodnie z regułą „weryfikuj realny runtime, nie wygodę mocka".
 *
 * Dane demo: fikcyjna organizacja „Atelier Toys" (ten sam org-id co inne
 * harnesse Admina, dla spójności), polskie nazwy zdarzeń/operatorów.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AdminAuditExportHistoryPanel } from '../../src/components/Admin/AdminAuditExportHistoryPanel';
import { AdminAuditIntegrityPanel } from '../../src/components/Admin/AdminAuditIntegrityPanel';
import { AdminAuditLogPanel } from '../../src/components/Admin/AdminAuditLogPanel';
import { AdminComplianceEvidencePanel } from '../../src/components/Admin/AdminComplianceEvidencePanel';
import { AdminLegalHoldPanel } from '../../src/components/Admin/AdminLegalHoldPanel';

export type AdminAuditScreenId =
  | 'events'
  | 'high-risk-changes'
  | 'compliance-evidence'
  | 'retention-export'
  | 'integrity'
  | 'legal-hold'
  | 'export-history';

const ORG_ID = 'org-atelier-toys-0001';

// Surowy kształt z backendu (adminP32.routes.ts readTenantAdminAuditProjection)
// — snake_case, BEZ camelCase aliasów. Patrz „ZNALEZISKO" w nagłówku pliku.
const AUDIT_LOGS = [
  {
    id: 'audit-1',
    organization_id: ORG_ID,
    admin_id: 'piotr@atelier-toys.pl',
    action_type: 'member_removed',
    resource_type: 'organization_member',
    resource_id: 'user-anna-k',
    metadata_json: JSON.stringify({ removedUser: 'anna@atelier-toys.pl' }),
    risk_score: 80,
    risk_level: 'critical',
    status: 'OPEN',
    created_at: '2026-08-30T14:22:00Z',
  },
  {
    id: 'audit-2',
    organization_id: ORG_ID,
    admin_id: 'piotr@atelier-toys.pl',
    action_type: 'role_change',
    resource_type: 'organization_member',
    resource_id: 'user-marek-n',
    metadata_json: JSON.stringify({ from: 'member', to: 'admin' }),
    risk_score: 60,
    risk_level: 'high',
    status: 'RESOLVED',
    created_at: '2026-08-29T09:05:00Z',
  },
  {
    id: 'audit-3',
    organization_id: ORG_ID,
    admin_id: 'anna@atelier-toys.pl',
    action_type: 'update_collaboration_controls',
    resource_type: 'organization',
    resource_id: ORG_ID,
    metadata_json: JSON.stringify({ guestAccessEnabled: false }),
    risk_score: 40,
    risk_level: 'medium',
    status: 'RESOLVED',
    created_at: '2026-08-27T16:40:00Z',
  },
  {
    id: 'audit-4',
    organization_id: ORG_ID,
    admin_id: 'piotr@atelier-toys.pl',
    action_type: 'update_data_retention_policy',
    resource_type: 'compliance',
    resource_id: null,
    metadata_json: JSON.stringify({ auditLogRetentionDays: 730 }),
    risk_score: 20,
    risk_level: 'low',
    status: 'RESOLVED',
    created_at: '2026-08-22T11:15:00Z',
  },
  {
    id: 'audit-5',
    organization_id: ORG_ID,
    admin_id: 'marek@atelier-toys.pl',
    action_type: 'create_scim_token',
    resource_type: 'security',
    resource_id: 'scim-token-7',
    metadata_json: JSON.stringify({ scopes: ['users:read', 'users:write'] }),
    risk_score: 55,
    risk_level: 'medium',
    status: 'PENDING',
    created_at: '2026-08-18T08:02:00Z',
  },
  {
    id: 'audit-6',
    organization_id: ORG_ID,
    admin_id: 'piotr@atelier-toys.pl',
    action_type: 'export_audit_logs',
    resource_type: 'compliance',
    resource_id: null,
    metadata_json: JSON.stringify({ rows: 214, format: 'csv' }),
    risk_score: 15,
    risk_level: 'low',
    status: 'RESOLVED',
    created_at: '2026-08-12T13:50:00Z',
  },
];

const AUDIT_STATS = { totalLogs: 214, unresolvedCount: 3, highRiskCount: 2 };

const RISK_SUMMARY = {
  organizationId: ORG_ID,
  summary: {
    incidents: [
      { id: 'llm-inc-1', module: 'ai', severity: 'high' },
      { id: 'llm-inc-2', module: 'ai', severity: 'medium' },
    ],
    audit: { highRiskCount: 2 },
  },
};

const COMPLIANCE_SUMMARY = {
  organizationId: ORG_ID,
  summary: {
    gdpr: { enabled: true },
    dataRetention: { auditLogRetentionDays: 730 },
  },
};

const DATA_RESIDENCY = {
  success: true,
  data: {
    enforceEuOnly: true,
    dataResidencyRegion: 'eu-west-1',
    allowedRegions: ['eu-west-1', 'eu-central-1'],
    deniedRegions: ['us-east-1'],
  },
};

const RETENTION_SCHEDULES = {
  success: true,
  data: [
    {
      id: 'ret-1',
      organizationId: ORG_ID,
      dataType: 'audit_logs',
      retentionDays: 730,
      nextCleanupAt: '2026-09-15T02:00:00Z',
      lastCleanupAt: '2026-08-15T02:00:00Z',
      itemsDeletedTotal: 1420,
      notificationSent: true,
      isActive: true,
    },
    {
      id: 'ret-2',
      organizationId: ORG_ID,
      dataType: 'conversation_transcripts',
      retentionDays: 365,
      nextCleanupAt: '2026-09-01T02:00:00Z',
      lastCleanupAt: '2026-08-01T02:00:00Z',
      itemsDeletedTotal: 302,
      notificationSent: false,
      isActive: true,
    },
  ],
};

const AI_POLICY = {
  success: true,
  data: {
    maxTokensPerMessage: 4000,
    mandatoryDisclaimers: ['ai-generated-content'],
    requiredCitationMode: 'recommended',
    blockedTools: [],
    allowedModels: ['claude-sonnet', 'claude-opus'],
    dataResidencyRegion: 'eu-west-1',
    enforceEuOnly: true,
    customSafetyRules: [],
  },
};

const LEGAL_HOLD = {
  success: true,
  legalHoldEnabled: false,
  blockedOperations: ['data_export', 'organization_deletion'],
  matterRegistryAvailable: false,
};

const AUDIT_EXPORT_HISTORY = {
  success: true,
  receipts: [
    {
      id: 'export-1',
      requested_by: 'piotr@atelier-toys.pl',
      export_kind: 'audit_logs_csv',
      filters_json: JSON.stringify({ riskScoreMin: 60 }),
      row_count: 214,
      output_format: 'csv',
      created_at: '2026-08-30T10:00:00Z',
    },
    {
      id: 'export-2',
      requested_by: 'anna@atelier-toys.pl',
      export_kind: 'compliance_summary_pdf',
      filters_json: null,
      row_count: null,
      output_format: 'pdf',
      created_at: '2026-08-10T09:30:00Z',
    },
    {
      id: 'export-3',
      requested_by: 'piotr@atelier-toys.pl',
      export_kind: 'audit_logs_csv',
      filters_json: JSON.stringify({ status: 'OPEN' }),
      row_count: 12,
      output_format: 'csv',
      created_at: '2026-07-22T14:12:00Z',
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
// URL-i realnie wołanych przez ekrany domeny 'audit' — NIE catch-all
// `/api/*` (patrz komentarz w admin-billing.tsx / i18n-fala1-smoke.tsx).
const g = window as unknown as { __ADMIN_AUDIT_FETCH__?: boolean };
if (!g.__ADMIN_AUDIT_FETCH__) {
  g.__ADMIN_AUDIT_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      if (url.includes('/admin/audit-logs/stats')) return jsonResponse(AUDIT_STATS);
      if (url.includes('/admin/audit-logs/export'))
        return new Response('id,action_type\naudit-1,member_removed\n', {
          status: 200,
          headers: { 'Content-Type': 'text/csv' },
        });
      if (url.includes('/admin/audit-logs')) return jsonResponse({ logs: AUDIT_LOGS });
      if (url.includes('/admin/risk/summary')) return jsonResponse(RISK_SUMMARY);
      if (url.includes('/admin/compliance/summary')) return jsonResponse(COMPLIANCE_SUMMARY);
      if (url.includes('/admin/compliance/data-retention') && method === 'PUT')
        return jsonResponse({ success: true });
      if (url.includes('/admin/enterprise-compliance/data-residency'))
        return jsonResponse(DATA_RESIDENCY);
      if (url.includes('/admin/enterprise-compliance/retention/schedules'))
        return jsonResponse(RETENTION_SCHEDULES);
      if (url.includes('/admin/enterprise-compliance/ai-policy')) return jsonResponse(AI_POLICY);
      if (url.includes('/admin/legal-hold')) return jsonResponse(LEGAL_HOLD);
      if (url.includes('/admin/audit-export-history')) return jsonResponse(AUDIT_EXPORT_HISTORY);
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

// Mapowanie 1:1 z AdminSettingsModule.tsx case 'audit'.
function renderAuditScreen(adminScreen: AdminAuditScreenId): React.ReactElement {
  if (adminScreen === 'compliance-evidence') return <AdminComplianceEvidencePanel />;
  if (adminScreen === 'legal-hold') return <AdminLegalHoldPanel />;
  if (adminScreen === 'export-history') return <AdminAuditExportHistoryPanel />;
  if (adminScreen === 'integrity') return <AdminAuditIntegrityPanel />;
  // events, high-risk-changes (ALIAS), retention-export (ALIAS)
  return <AdminAuditLogPanel />;
}

export default function AdminAuditScreen(props: {
  adminScreen: AdminAuditScreenId;
}): React.ReactElement {
  // `&ekran=` w URL nadpisuje prop domyślny — pozwala odpalić dowolny
  // z 7 ekranów spod jednego wpisu w main.tsx.
  const requested = new URLSearchParams(window.location.search).get(
    'ekran'
  ) as AdminAuditScreenId | null;
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
        <MemoryRouter initialEntries={['/']}>{renderAuditScreen(adminScreen)}</MemoryRouter>
      </DebugBoundary>
    </div>
  );
}
