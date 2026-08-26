/**
 * Dev-render host for the REAL `<AdminCommandCenterPanel />` (org-admin hub
 * → "command" section, "Trust & Control", F-CC1…F-CC4, Harvey-Parity
 * HP-10…13). Fala 6 domknęła 5 zakładek (Audyt SOC2 / DLP / Rezydencja /
 * Retencja / Polityka AI) — ten story fotografuje wszystkie, wybierane przez
 * `&tab=` (fotograf floty, CLAUDE.md #7 — zrzut PRZED odbiorem Piotra):
 *   ?screen=admin-command-center-panel               → Overview (już zdjęte fala 4/5, pomiń)
 *   ?screen=admin-command-center-panel&tab=audit      → SOC2 audit export (StandardTable)
 *   ?screen=admin-command-center-panel&tab=dlp        → DLP rules (StandardTable+kebab+form)
 *   ?screen=admin-command-center-panel&tab=retention  → Retention schedules (StandardTable+inline edit)
 *   ?screen=admin-command-center-panel&tab=residency  → Data residency (form)
 *   ?screen=admin-command-center-panel&tab=ai-policy  → Org AI policy (form)
 *
 * No re-implementation: the component calls the typed
 * `enterpriseComplianceApi.ts` client (itself `apiGet/apiPut/apiPost` →
 * `fetch('/api/admin/enterprise-compliance/...')`), so we stub
 * `window.fetch` with the real `{success,data}` envelope shape, keyed by URL
 * substring (pattern from dev-render/screens/assessment-reports-panel.tsx).
 * The stub is narrow (specific enterprise-compliance path substrings, falls
 * through to the real fetch otherwise) — NOT a `/api/*` catch-all, so it is
 * safe under main.tsx's eager story imports (see i18n-fala1-smoke.tsx header
 * comment for the trap this avoids).
 * Needs a Router context (`useSearchParams`) — wrapped in `MemoryRouter`,
 * pattern from dev-render/screens/assessment-reports-panel.tsx.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AdminCommandCenterPanel } from '../../src/components/Admin/AdminCommandCenterPanel';

const AI_POLICY = {
  organizationId: 'org-atelier-toys-0001',
  allowedTopics: [],
  blockedTopics: ['competitor strategy', 'unreleased pricing'],
  maxTokensPerConversation: 200000,
  maxTokensPerMessage: 8000,
  mandatoryDisclaimers: ['AI-generated content — verify before client delivery.'],
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
    organizationId: 'org-atelier-toys-0001',
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
    organizationId: 'org-atelier-toys-0001',
    ruleName: 'Nieopublikowany cennik',
    ruleType: 'keyword',
    pattern: 'unreleased pricing',
    action: 'redact',
    appliesTo: 'output',
    severity: 'high',
    isActive: true,
  },
  {
    id: 'dlp-3',
    organizationId: 'org-atelier-toys-0001',
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
    organizationId: 'org-atelier-toys-0001',
    ruleName: 'Wzmianka o konkurencie',
    ruleType: 'keyword',
    pattern: 'competitor strategy',
    action: 'warn',
    appliesTo: 'both',
    severity: 'medium',
    isActive: false,
  },
  {
    id: 'dlp-5',
    organizationId: 'org-atelier-toys-0001',
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
    organizationId: 'org-atelier-toys-0001',
    dataType: 'conversations',
    retentionDays: 365,
    nextCleanupAt: '2026-08-01T02:00:00Z',
    lastCleanupAt: '2026-07-01T02:00:00Z',
    itemsDeletedTotal: 412,
    notificationSent: true,
    isActive: true,
  },
  {
    id: 'ret-2',
    organizationId: 'org-atelier-toys-0001',
    dataType: 'documents',
    retentionDays: 730,
    nextCleanupAt: '2026-09-15T02:00:00Z',
    lastCleanupAt: '2026-06-15T02:00:00Z',
    itemsDeletedTotal: 58,
    notificationSent: true,
    isActive: true,
  },
  {
    id: 'ret-3',
    organizationId: 'org-atelier-toys-0001',
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
    organizationId: 'org-atelier-toys-0001',
    dataType: 'exported_files',
    retentionDays: 90,
    nextCleanupAt: '2026-07-20T02:00:00Z',
    lastCleanupAt: '2026-06-20T02:00:00Z',
    itemsDeletedTotal: 231,
    notificationSent: true,
    isActive: true,
  },
  {
    id: 'ret-5',
    organizationId: 'org-atelier-toys-0001',
    dataType: 'search_index_snapshots',
    retentionDays: 30,
    nextCleanupAt: '2026-07-16T02:00:00Z',
    lastCleanupAt: '2026-07-09T02:00:00Z',
    itemsDeletedTotal: 19,
    notificationSent: false,
    isActive: false,
  },
];

const AUDIT_ENTRIES = [
  {
    id: 'audit-1',
    organizationId: 'org-atelier-toys-0001',
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
    createdAt: '2026-07-14T09:12:00Z',
  },
  {
    id: 'audit-2',
    organizationId: 'org-atelier-toys-0001',
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
    createdAt: '2026-07-14T11:45:00Z',
  },
  {
    id: 'audit-3',
    organizationId: 'org-atelier-toys-0001',
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
    createdAt: '2026-07-13T15:02:00Z',
  },
  {
    id: 'audit-4',
    organizationId: 'org-atelier-toys-0001',
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
    createdAt: '2026-07-12T08:30:00Z',
  },
  {
    id: 'audit-5',
    organizationId: 'org-atelier-toys-0001',
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
    policyDecisions: [
      { policy: 'dlp', decision: 'block', reason: 'critical severity rule matched' },
    ],
    metadata: {},
    createdAt: '2026-07-11T17:20:00Z',
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Install the offline fetch stub once (idempotent across HMR), scoped by
// URL substrings unique to /admin/enterprise-compliance/* — never a bare
// `/api/*` catch-all (see i18n-fala1-smoke.tsx for why that shape breaks
// other eagerly-imported stories).
const g = window as unknown as { __ADMIN_COMMAND_CENTER_FETCH__?: boolean };
if (!g.__ADMIN_COMMAND_CENTER_FETCH__) {
  g.__ADMIN_COMMAND_CENTER_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
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
      if (url.includes('/admin/enterprise-compliance/audit-trail/export')) {
        return jsonResponse({
          success: true,
          data: {
            entries: AUDIT_ENTRIES,
            totalCount: AUDIT_ENTRIES.length,
            exportedAt: '2026-07-15T09:00:00Z',
          },
        });
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

export default function AdminCommandCenterPanelScreen(): React.ReactElement {
  // DEC night-fixes-b-20260826 (ADM-OWN-001): the internal horizontal
  // pill-nav (driven by its own `?tab=` query param) is gone — each screen
  // is now its own slot in the vertical AdminSettingsSidebar, and
  // AdminCommandCenterPanel just renders whichever one it's told to via the
  // `screen` prop, exactly like every other admin domain. This harness
  // mirrors that: `?tab=` still selects which screen to photograph, it just
  // passes straight through as a prop instead of round-tripping the panel's
  // own router state.
  const requestedTab = new URLSearchParams(window.location.search).get('tab') || 'overview';
  const screen = requestedTab === 'overview' ? undefined : (requestedTab as never);
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <DebugBoundary>
        <MemoryRouter initialEntries={['/']}>
          <AdminCommandCenterPanel screen={screen} aggregationOnly={false} />
        </MemoryRouter>
      </DebugBoundary>
    </div>
  );
}
