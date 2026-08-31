/**
 * 146-aios — Internal Tools / AI OS (submenu 8 pozycji), harness odbioru
 * grafiki 2026-08-31 (decyzja właściciela: submenu wchodzi do rundy).
 *
 * Menu: `getInternalToolsMenuItem` (src/components/navigation/Sidebar/menuConfig.ts:210-268)
 * deklaruje 8 pozycji AI_OS_HOME/ACTIONS/RESEARCH/ARTIFACTS/MEMORY/CONNECTORS/
 * AGENTS/OUTCOMES. Trasy: `ROUTES.AI_OS.*` (src/routes/routeConfig.ts:301-314),
 * zamontowane w `AppRoutes.tsx:1732-1801` przez `renderInternalToolsShell` (gate:
 * `InternalToolsGate` — dbr77.com/SUPERADMIN·ADMIN·OWNER, `VITE_INTERNAL_TOOLS_ENABLED`,
 * DEV zawsze true). Każdy wpis montuje REALNY komponent produktu, wprost z
 * `src/components/AIChat/`:
 *   HOME       -> AIOSHub.tsx (statyczny hub kart + AIOSWave0GateReport +
 *                 V10TeresaRuntimeWorkspace)
 *   ACTIONS    -> ActionCenter.tsx
 *   RESEARCH   -> ResearchSessionsDock.tsx
 *   ARTIFACTS  -> Wave5ArtifactRuntimePanel.tsx
 *   MEMORY     -> Wave6ContextLearningPanel.tsx
 *   CONNECTORS -> Wave7ConnectorAdminPanel.tsx
 *   AGENTS     -> Wave8AgentCatalogPanel.tsx
 *   OUTCOMES   -> Wave9OutcomeAIOpsPanel.tsx
 *
 * Ten harness montuje SAM komponent ekranu (bez MainLayout/sidebar — wzór
 * `assessment-five-surfaces.tsx`) wewnątrz `AppProviders`, z sesją zasianą
 * (`seedRealisticSession`) i `Api` monkey-patchowanym na metody, które te
 * ekrany REALNIE wołają (grep `Api\.\w*(` w każdym pliku — zero mocków dla
 * metod, których dany ekran nie woła, żeby pustka nie udawała defektu).
 *
 * URL params (harness top-level `?screen=aios-<nazwa>` już wybiera wpis w
 * main.tsx SCREENS — ten plik czyta go i ucina prefiks `aios-`; `&view=`
 * nadpisuje jawnie, gdy trzeba):
 *   &view=home|actions|research|artifacts|memory|connectors|agents|outcomes
 *   &theme=light|dark (domyślnie light)
 */
import React from 'react';

import { ActionCenter } from '../../src/components/AIChat/ActionCenter';
import { AIOSHub } from '../../src/components/AIChat/AIOSHub';
import { ResearchSessionsDock } from '../../src/components/AIChat/ResearchSessionsDock';
import { Wave5ArtifactRuntimePanel } from '../../src/components/AIChat/Wave5ArtifactRuntimePanel';
import { Wave6ContextLearningPanel } from '../../src/components/AIChat/Wave6ContextLearningPanel';
import { Wave7ConnectorAdminPanel } from '../../src/components/AIChat/Wave7ConnectorAdminPanel';
import { Wave8AgentCatalogPanel } from '../../src/components/AIChat/Wave8AgentCatalogPanel';
import { Wave9OutcomeAIOpsPanel } from '../../src/components/AIChat/Wave9OutcomeAIOpsPanel';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
  isAuthInitializing: false,
} as any);

// ── HOME: V10TeresaRuntimeWorkspace -> useV10TeresaRuntime -> Api.get(path) ──
const originalApiGet = Api.get?.bind(Api);
Api.get = (async (path: string, ...rest: unknown[]) => {
  if (typeof path === 'string' && path.includes('/api/v10/teresa/voice-config')) {
    return {
      enabled: true,
      voiceEnabled: true,
      model: 'claude-sonnet-5-teresa',
      voiceName: 'Teresa (PL)',
      unavailableReason: null,
    };
  }
  if (originalApiGet) return originalApiGet(path, ...(rest as [any]));
  return {};
}) as typeof Api.get;

// ── ACTIONS: ActionCenter ────────────────────────────────────────────────
const MOCK_AI_ACTIONS = [
  {
    id: 'action-1',
    runId: 'run-8841',
    title: 'Zaktualizuj status inicjatywy „Wdrożenie CRM"',
    description: 'Zmiana statusu na „W realizacji" na podstawie ostatniej notatki z warsztatu.',
    actionType: 'update_initiative_status',
    status: 'pending_review',
    severity: 'low',
    trigger: 'Sugestia Teresy z czatu',
    proposedAt: '2026-08-30T09:12:00Z',
  },
  {
    id: 'action-2',
    runId: 'run-8839',
    title: 'Wyślij podsumowanie warsztatu do klienta',
    description: 'E-mail z podsumowaniem warsztatu discovery do zespołu klienta.',
    actionType: 'send_email',
    status: 'approved',
    severity: 'medium',
    trigger: 'Zatwierdzone przez konsultanta',
    proposedAt: '2026-08-29T14:03:00Z',
  },
  {
    id: 'action-3',
    runId: 'run-8820',
    title: 'Usuń zduplikowany rekord Insightu',
    description: 'Wykryto duplikat wniosku „Braki kompetencyjne w zespole IT".',
    actionType: 'delete_record',
    status: 'executed',
    severity: 'high',
    trigger: 'Sugestia porządkowania danych',
    proposedAt: '2026-08-28T08:40:00Z',
  },
  {
    id: 'action-4',
    runId: null,
    title: 'Utwórz zadanie followup dla właściciela ryzyka',
    description: 'Ryzyko „Brak zasobów wdrożeniowych" wymaga właściciela i terminu.',
    actionType: 'create_task',
    status: 'rejected',
    severity: 'medium',
    trigger: 'Sugestia z panelu ryzyk',
    proposedAt: '2026-08-27T11:00:00Z',
  },
];

const MOCK_AI_RUNS = [
  {
    id: 'run-8841',
    runId: 'run-8841',
    status: 'pending_review',
    actionType: 'update_initiative_status',
  },
  { id: 'run-8839', runId: 'run-8839', status: 'approved', actionType: 'send_email' },
  { id: 'run-8820', runId: 'run-8820', status: 'executed', actionType: 'delete_record' },
];

const MOCK_AUDIT = {
  id: 'action-1',
  runId: 'run-8841',
  status: 'pending_review',
  audit: { rollbackStatus: 'rollback_available' },
  outputRefs: [{ type: 'initiative', id: 'init-crm-rollout' }],
  events: [
    { id: 'ev-1', createdAt: '2026-08-30T09:12:00Z', eventType: 'proposed', actorUserId: 'teresa' },
  ],
};

Api.getAIActionCenter = (async ({ scope }: { scope: string; limit?: number }) => {
  if (scope === 'mine') return { actions: MOCK_AI_ACTIONS };
  return { actions: MOCK_AI_ACTIONS };
}) as typeof Api.getAIActionCenter;
Api.getAIActionAuditTrail = (async () => ({
  audit: MOCK_AUDIT,
})) as typeof Api.getAIActionAuditTrail;
Api.getAIRunLedger = (async () => ({
  runs: MOCK_AI_RUNS,
  success: true,
})) as typeof Api.getAIRunLedger;
Api.approveAIAction = (async () => ({ success: true })) as typeof Api.approveAIAction;
Api.rejectAIAction = (async () => ({ success: true })) as typeof Api.rejectAIAction;
Api.executeAIAction = (async () => ({ success: true })) as typeof Api.executeAIAction;

// ── RESEARCH: ResearchSessionsDock ───────────────────────────────────────
const MOCK_RESEARCH_SESSIONS = [
  {
    sessionId: 'rs-1',
    status: 'running',
    mission: 'Ocena ryzyk modernizacji ERP dla klienta Fabryka XYZ',
    scope: 'Moduły finansowe i magazynowe, horyzont 18 miesięcy',
    allowedSources: ['web', 'attachment', 'org'],
    progress: { stage: 'Synteza dowodów', percent: 62, totalSources: 14, citationCount: 9 },
    evidenceGraph: [
      {
        nodeId: 'ev-1',
        sourceClass: 'org',
        claim: 'Obecny system ERP nie wspiera wielowalutowości wymaganej po fuzji.',
        confidence: 0.81,
        contradiction: false,
        freshness: '2026-08-20',
      },
      {
        nodeId: 'ev-2',
        sourceClass: 'web',
        claim: 'Dostawca deklaruje 6-miesięczny czas wdrożenia modułu finansowego.',
        confidence: 0.54,
        contradiction: true,
        freshness: '2026-07-02',
      },
    ],
    updatedAt: '2026-08-30T10:00:00Z',
  },
  {
    sessionId: 'rs-2',
    status: 'completed',
    mission: 'Analiza konkurencji na rynku doradztwa cyfrowego PL',
    scope: 'Top 10 firm doradczych, ceny i pozycjonowanie',
    allowedSources: ['web'],
    progress: { stage: 'Zakończone', percent: 100, totalSources: 22, citationCount: 18 },
    evidenceGraph: [],
    finalArtifact: {
      artifactId: 'art-research-2',
      title: 'Raport konkurencyjny — rynek doradztwa cyfrowego PL',
      contentMarkdown: '# Raport konkurencyjny\n\n## Streszczenie\nRynek jest rozdrobniony...',
    },
    updatedAt: '2026-08-25T16:30:00Z',
  },
  {
    sessionId: 'rs-3',
    status: 'planned',
    mission: 'Wpływ regulacji AI Act na klientów sektora finansowego',
    scope: '',
    allowedSources: ['web', 'attachment', 'product', 'org'],
    progress: { stage: 'planned', percent: 0 },
    evidenceGraph: [],
    updatedAt: '2026-08-29T08:00:00Z',
  },
  {
    sessionId: 'rs-4',
    status: 'failed',
    mission: 'Benchmark kosztów wdrożenia CRM w branży produkcyjnej',
    scope: 'Porównanie 5 dostawców',
    allowedSources: ['web', 'org'],
    progress: { stage: 'Błąd pobierania źródeł', percent: 34 },
    evidenceGraph: [],
    error: 'Źródło org niedostępne (403).',
    updatedAt: '2026-08-28T12:00:00Z',
  },
];

Api.listResearchSessions = (async () => ({
  sessions: MOCK_RESEARCH_SESSIONS,
})) as typeof Api.listResearchSessions;
Api.getResearchSession = (async (sessionId: string) => ({
  session:
    MOCK_RESEARCH_SESSIONS.find((s) => s.sessionId === sessionId) || MOCK_RESEARCH_SESSIONS[0],
})) as typeof Api.getResearchSession;
Api.createResearchSession = (async () => ({
  success: true,
  session: MOCK_RESEARCH_SESSIONS[2],
})) as typeof Api.createResearchSession;
Api.approveResearchSession = (async () => ({
  session: MOCK_RESEARCH_SESSIONS[2],
})) as typeof Api.approveResearchSession;
Api.startResearchSession = (async () => ({
  session: MOCK_RESEARCH_SESSIONS[0],
})) as typeof Api.startResearchSession;
Api.cancelResearchSessionV1 = (async () => ({
  session: MOCK_RESEARCH_SESSIONS[0],
})) as typeof Api.cancelResearchSessionV1;
Api.resumeResearchSession = (async () => ({
  session: MOCK_RESEARCH_SESSIONS[0],
})) as typeof Api.resumeResearchSession;
Api.retryResearchSession = (async () => ({
  session: MOCK_RESEARCH_SESSIONS[3],
})) as typeof Api.retryResearchSession;

// ── ARTIFACTS: Wave5ArtifactRuntimePanel ─────────────────────────────────
const MOCK_WAVE5_ARTIFACT = {
  artifactId: 'w5-art-1',
  artifactType: 'report',
  status: 'proposed',
  title: 'Raport zarządczy — Wdrożenie CRM Q3',
  content: '# Raport zarządczy\n\nStatus: w realizacji. Kluczowe ryzyka: zasoby, harmonogram.',
  version: 3,
  provenance: { createdBy: 'teresa', createdFrom: 'wave5_runtime_panel' },
  mutations: [
    {
      mutationId: 'mut-1',
      status: 'proposed',
      summary: 'Aktualizacja sekcji ryzyk po warsztacie',
      diff: [
        { line: 12, type: 'added', after: 'Nowe ryzyko: brak dostępności kluczowego integratora.' },
        { line: 8, type: 'removed', before: 'Ryzyko: brak budżetu (zamknięte).' },
      ],
    },
    {
      mutationId: 'mut-2',
      status: 'approved',
      summary: 'Dodanie wniosków z sesji sponsora',
      diff: [{ line: 20, type: 'added', after: 'Sponsor potwierdził priorytet na Q4.' }],
    },
  ],
  versions: [
    { version: 1, createdAt: '2026-08-10T09:00:00Z' },
    { version: 2, createdAt: '2026-08-18T09:00:00Z', mutationId: 'mut-0' },
    { version: 3, createdAt: '2026-08-28T09:00:00Z', mutationId: 'mut-2' },
  ],
};

const MOCK_WAVE5_ARTIFACTS_LIST = [
  {
    artifactId: 'w5-art-1',
    artifactType: 'report',
    status: 'proposed',
    title: 'Raport zarządczy — Wdrożenie CRM Q3',
    version: 3,
  },
  {
    artifactId: 'w5-art-2',
    artifactType: 'slide_deck',
    status: 'committed',
    title: 'Prezentacja dla zarządu — Wyniki Q2',
    version: 5,
  },
  {
    artifactId: 'w5-art-3',
    artifactType: 'financial_model',
    status: 'draft',
    title: 'Model finansowy — Case biznesowy CRM',
    version: 1,
  },
];

Api.getWave5ArtifactSchema = (async () => ({
  artifactTypes: [
    'note',
    'decision',
    'task',
    'initiative',
    'report',
    'research_report',
    'slide_deck',
    'spreadsheet',
    'diagram',
    'survey_insight',
    'financial_model',
  ],
})) as typeof Api.getWave5ArtifactSchema;
Api.listWave5Artifacts = (async () => ({
  artifacts: MOCK_WAVE5_ARTIFACTS_LIST,
})) as typeof Api.listWave5Artifacts;
Api.getWave5Artifact = (async () => ({
  artifact: MOCK_WAVE5_ARTIFACT,
})) as typeof Api.getWave5Artifact;
Api.createWave5Artifact = (async () => ({
  success: true,
  artifact: MOCK_WAVE5_ARTIFACT,
})) as typeof Api.createWave5Artifact;
Api.proposeWave5ArtifactMutation = (async () => ({
  success: true,
  mutation: MOCK_WAVE5_ARTIFACT.mutations[0],
})) as typeof Api.proposeWave5ArtifactMutation;
Api.approveWave5ArtifactMutation = (async () => ({
  success: true,
})) as typeof Api.approveWave5ArtifactMutation;
Api.commitWave5ArtifactMutation = (async () => ({
  success: true,
})) as typeof Api.commitWave5ArtifactMutation;
Api.rejectWave5ArtifactMutation = (async () => ({
  success: true,
})) as typeof Api.rejectWave5ArtifactMutation;
Api.fillWave5DocumentTemplate = (async () => ({
  artifact: MOCK_WAVE5_ARTIFACT,
})) as typeof Api.fillWave5DocumentTemplate;
Api.generateWave5StructuredArtifact = (async () => ({
  success: true,
  artifact: MOCK_WAVE5_ARTIFACT,
})) as typeof Api.generateWave5StructuredArtifact;
Api.getWave5ArtifactExportManifest = (async () => ({
  manifest: { format: 'pdf', sections: ['summary', 'risks', 'timeline'] },
})) as typeof Api.getWave5ArtifactExportManifest;

// ── MEMORY: Wave6ContextLearningPanel ────────────────────────────────────
const MOCK_WAVE6_PANEL = {
  snapshots: [
    {
      snapshotId: 'snap-1',
      snapshotType: 'user',
      freshnessAt: '2026-08-30T08:00:00Z',
      facts: {
        conversationId: 'conv-882',
        focusMode: 'deep_work',
        userWorkProfilePreferences: 4,
        capturedBy: 'wave6_context_panel',
      },
    },
    {
      snapshotId: 'snap-2',
      snapshotType: 'org',
      freshnessAt: '2026-08-27T08:00:00Z',
      facts: { scope: 'org', projectId: null },
    },
  ],
  memories: [
    {
      candidateId: 'mem-1',
      assistantScope: 'teresa_tenant',
      memoryScope: 'user',
      status: 'candidate',
      key: 'communication_style',
      value: 'Preferuje krótkie, konkretne podsumowania bez żargonu.',
      sourceLabel: 'Wave 6 panel user request',
      privateMode: false,
    },
    {
      candidateId: 'mem-2',
      assistantScope: 'teresa_tenant',
      memoryScope: 'project',
      status: 'retained',
      key: 'decision_criteria',
      value: 'Priorytet: redukcja ryzyka > szybkość wdrożenia.',
      sourceLabel: 'Warsztat discovery 2026-08-15',
      privateMode: false,
    },
  ],
};

Api.getWave6ContextPanel = (async () => ({
  panel: MOCK_WAVE6_PANEL,
})) as typeof Api.getWave6ContextPanel;
Api.captureWave6ContextSnapshot = (async () => ({
  success: true,
})) as typeof Api.captureWave6ContextSnapshot;
Api.captureWave6MemoryCandidate = (async () => ({
  candidate: MOCK_WAVE6_PANEL.memories[0],
})) as typeof Api.captureWave6MemoryCandidate;
Api.decideWave6MemoryCandidate = (async () => ({
  success: true,
})) as typeof Api.decideWave6MemoryCandidate;

// ── CONNECTORS: Wave7ConnectorAdminPanel ─────────────────────────────────
const MOCK_WAVE7_CONNECTORS = [
  {
    connectorId: 'conn-1',
    provider: 'google_drive',
    displayName: 'Google Drive — Klient Fabryka XYZ',
    status: 'connected',
    authState: 'active',
    accessState: 'granted',
    scopes: ['read', 'search'],
    projectIds: ['proj-crm-rollout'],
    freshnessAgeMinutes: 12,
    freshnessTtlMinutes: 240,
    tokenExpiresAt: '2026-09-15T10:00:00Z',
    tokenExpired: false,
    reconnectRequired: false,
    tenantPolicy: { externalConnectorId: 'tp-conn-9911' },
  },
  {
    connectorId: 'conn-2',
    provider: 'sharepoint',
    displayName: 'SharePoint — Dokumentacja wewnętrzna',
    status: 'stale',
    authState: 'expiring',
    accessState: 'granted',
    scopes: ['read'],
    projectIds: [],
    freshnessAgeMinutes: 260,
    freshnessTtlMinutes: 240,
    tokenExpiresAt: '2026-08-31T09:00:00Z',
    tokenExpired: false,
    reconnectRequired: true,
  },
  {
    connectorId: 'conn-3',
    provider: 'slack',
    displayName: 'Slack — Kanał zespołu wdrożeniowego',
    status: 'disconnected',
    authState: 'revoked',
    accessState: 'revoked',
    scopes: ['read', 'search'],
    projectIds: [],
    freshnessAgeMinutes: null,
    freshnessTtlMinutes: 120,
    tokenExpired: true,
    reconnectRequired: true,
    accessRevokedAt: '2026-08-20T10:00:00Z',
    revokedReason: 'oauth_access_revoked',
    failureState: 'revoked_access',
  },
];

Api.getWave7ConnectorCatalog = (async () => ({
  catalog: [
    { provider: 'google_drive', displayName: 'Google Drive' },
    { provider: 'sharepoint', displayName: 'SharePoint' },
    { provider: 'slack', displayName: 'Slack' },
  ],
})) as typeof Api.getWave7ConnectorCatalog;
Api.listWave7Connectors = (async () => ({
  connectors: MOCK_WAVE7_CONNECTORS,
})) as typeof Api.listWave7Connectors;
Api.getWave7ConnectorHealth = (async () => ({
  health: { total: 3, connected: 1, stale: 1, failed: 0, organizationId: 'org-dbr77-demo' },
})) as typeof Api.getWave7ConnectorHealth;
Api.listWave7ConnectorRuns = (async () => ({
  runs: [
    {
      runId: 'w7-run-1',
      toolName: 'connector_search',
      toolKind: 'search',
      status: 'completed',
      aclDecision: { reason: 'project_scope_match' },
      sourceTrace: { accessState: 'granted', tokenExpiresAt: '2026-09-15T10:00:00Z' },
    },
    {
      runId: 'w7-run-2',
      toolName: 'connector_tool',
      toolKind: 'write',
      status: 'blocked',
      aclDecision: { reason: 'missing_airun_for_write' },
      sourceTrace: { accessState: 'expiring' },
      error: 'Zapis wymaga zatwierdzonego AIRun.',
    },
  ],
})) as typeof Api.listWave7ConnectorRuns;
Api.registerWave7Connector = (async () => ({
  connector: MOCK_WAVE7_CONNECTORS[0],
})) as typeof Api.registerWave7Connector;
Api.executeWave7ConnectorTool = (async () => ({
  allowed: true,
  run: { status: 'completed' },
})) as typeof Api.executeWave7ConnectorTool;
Api.linkWave7Connector = (async () => ({ success: true })) as typeof Api.linkWave7Connector;
Api.disconnectWave7Connector = (async () => ({
  success: true,
})) as typeof Api.disconnectWave7Connector;
Api.updateWave7Connector = (async () => ({ success: true })) as typeof Api.updateWave7Connector;
Api.reindexWave7Connector = (async () => ({ success: true })) as typeof Api.reindexWave7Connector;

// ── AGENTS: Wave8AgentCatalogPanel ───────────────────────────────────────
const MOCK_WAVE8_AGENTS = [
  {
    agentId: 'research-agent',
    name: 'Agent badawczy',
    role: 'research',
    purpose: 'Prowadzi głębokie badania rynkowe i konkurencyjne na zlecenie konsultanta.',
    persona: 'Analityczny, precyzyjny, cytuje źródła.',
    allowedTools: ['search_knowledge_base', 'connector_search'],
    blockedTools: ['delete_record'],
    outputSchema: { type: 'research_report', required: ['claims', 'sources'] },
    approvalPolicy: 'auto_below_medium_risk',
    costClass: 'medium',
    riskLevel: 'low',
    examples: ['Zbadaj konkurencję w segmencie SaaS B2B'],
    editable: true,
    source: 'code',
  },
  {
    agentId: 'governance-agent',
    name: 'Agent nadzoru',
    role: 'governance',
    purpose: 'Waliduje wyjścia innych agentów pod kątem zgodności i jakości.',
    persona: 'Krytyczny, formalny, odwołuje się do polityk.',
    allowedTools: ['read_audit_log'],
    blockedTools: ['send_email', 'delete_record'],
    outputSchema: { type: 'eval_result', required: ['score', 'issues'] },
    approvalPolicy: 'always_manual',
    costClass: 'low',
    riskLevel: 'high',
    examples: ['Zweryfikuj raport przed wysyłką do klienta'],
    editable: false,
    source: 'code',
  },
];

Api.getWave8AgentCatalog = (async () => ({
  agents: MOCK_WAVE8_AGENTS,
})) as typeof Api.getWave8AgentCatalog;
Api.listWave8AgentRuns = (async () => ({
  runs: [
    {
      runId: 'w8-run-1',
      agentId: 'research-agent',
      status: 'completed',
      schemaValid: true,
      audit: {
        toolDecision: { reason: 'within_scope' },
        swarmDecision: { reason: 'not_requested' },
        approvalDecision: { reason: 'auto_approved' },
        scheduler: { status: 'manual', trigger: 'user' },
      },
    },
    {
      runId: 'w8-run-2',
      agentId: 'governance-agent',
      status: 'blocked',
      schemaValid: false,
      audit: {
        toolDecision: { reason: 'blocked_tool_requested' },
        swarmDecision: { reason: 'not_requested' },
        approvalDecision: { reason: 'missing_airun' },
      },
    },
  ],
})) as typeof Api.listWave8AgentRuns;
Api.listWave8AgentSchedules = (async () => ({
  schedules: [
    {
      scheduleId: 'sch-1',
      agentId: 'research-agent',
      cadence: 'weekly',
      ownerUserId: 'user-piotr-demo',
      schedulerMode: 'manual_process_due_endpoint',
      nextRunAt: '2026-09-05T08:00:00Z',
    },
  ],
})) as typeof Api.listWave8AgentSchedules;
Api.listWave8AgentNotifications = (async () => ({
  notifications: [
    {
      notificationId: 'notif-1',
      notificationType: 'agent_run_completed',
      runId: 'w8-run-1',
      ownerUserId: 'user-piotr-demo',
      payload: { delivery: { dispatchMode: 'audit_log_only' } },
    },
  ],
})) as typeof Api.listWave8AgentNotifications;
Api.launchWave8Agent = (async () => ({
  allowed: true,
  run: { status: 'accepted', schemaValid: true },
})) as typeof Api.launchWave8Agent;
Api.executeWave8AgentTool = (async () => ({ allowed: true })) as typeof Api.executeWave8AgentTool;
Api.upsertWave8AgentDefinition = (async () => ({
  success: true,
})) as typeof Api.upsertWave8AgentDefinition;
Api.processDueWave8AgentSchedules = (async () => ({
  processed: ['sch-1'],
})) as typeof Api.processDueWave8AgentSchedules;

// ── OUTCOMES: Wave9OutcomeAIOpsPanel ─────────────────────────────────────
const MOCK_WAVE9_OUTCOMES = [
  {
    outcomeId: 'oc-1',
    kpiName: 'Skrócenie czasu wdrożenia CRM',
    baseline: 10,
    target: 35,
    confidence: 0.75,
    roi: { available: true, riskAdjustedRoiPercent: 42 },
  },
  {
    outcomeId: 'oc-2',
    kpiName: 'Redukcja kosztów obsługi klienta',
    baseline: 5,
    target: 20,
    confidence: 0.6,
    roi: { available: false },
  },
];

Api.listWave9Outcomes = (async () => ({
  outcomes: MOCK_WAVE9_OUTCOMES,
})) as typeof Api.listWave9Outcomes;
Api.getWave9AIOpsDashboard = (async () => ({
  dashboard: {
    providerHealth: [{ provider: 'primary-llm', status: 'healthy' }],
    costDashboard: { totalCostUsd: 482.5 },
    evalDashboard: { latestGate: 'PASS' },
    acceptanceRuns: [{ runType: 'regression_pack', status: 'pass' }],
    incidentLog: [],
  },
})) as typeof Api.getWave9AIOpsDashboard;
Api.registerWave9Evidence = (async () => ({ success: true })) as typeof Api.registerWave9Evidence;
Api.createWave9Outcome = (async () => ({
  outcome: MOCK_WAVE9_OUTCOMES[0],
})) as typeof Api.createWave9Outcome;
Api.buildWave9Report = (async () => ({
  report: {
    title: 'Raport dla klienta — Wdrożenie CRM',
    businessEffectSummary: { assumptions: ['Adopcja w docelowej grupie'], confidence: 0.75 },
  },
})) as typeof Api.buildWave9Report;
Api.recordWave9ProviderHealth = (async () => ({
  success: true,
})) as typeof Api.recordWave9ProviderHealth;
Api.recordWave9Incident = (async () => ({ success: true })) as typeof Api.recordWave9Incident;
Api.recordWave9EvalRun = (async () => ({ success: true })) as typeof Api.recordWave9EvalRun;
Api.registerWave9AcceptanceRun = (async () => ({
  acceptanceRun: { runId: 'acc-1' },
})) as typeof Api.registerWave9AcceptanceRun;
Api.runWave9FinalAcceptance = (async () => ({
  decision: 'PASS',
  report: { blockers: [], acceptanceRunEvidence: {} },
})) as typeof Api.runWave9FinalAcceptance;

const SCREEN_MAP: Record<string, React.ComponentType> = {
  home: AIOSHub,
  actions: ActionCenter,
  research: ResearchSessionsDock,
  artifacts: Wave5ArtifactRuntimePanel,
  memory: Wave6ContextLearningPanel,
  connectors: Wave7ConnectorAdminPanel,
  agents: Wave8AgentCatalogPanel,
  outcomes: Wave9OutcomeAIOpsPanel,
};

// NOTE: the harness's OWN top-level `?screen=<registry-key>` param (main.tsx)
// picks the SCREENS entry (e.g. `aios-actions`) — it is NOT free for this
// file's own sub-screen switch. `&view=` is the sub-screen switch instead;
// as a convenience, if `&view=` is absent this also strips a leading
// `aios-` off the top-level `?screen=` value so each registry entry works
// standalone without needing a second param.
export default function AiosScreen() {
  const search = new URLSearchParams(window.location.search);
  const view = search.get('view') || search.get('screen')?.replace(/^aios-/, '') || 'home';
  const Screen = SCREEN_MAP[view] || AIOSHub;
  return (
    <AppProviders>
      <div className="min-h-screen bg-slate-50 dark:bg-navy-950">
        <Screen />
      </div>
    </AppProviders>
  );
}
