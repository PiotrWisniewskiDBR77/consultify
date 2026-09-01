/**
 * Dev-render host for Admin → domena "Sterowanie AI" (ai), komplet 10
 * ekranów z `src/components/Admin/adminNavigation.ts` (ADMIN_DOMAINS → id
 * 'ai'). Runda odbioru grafiki 146-admin-ai (decyzja właściciela 2026-08-31:
 * cały panel Administracji wchodzi do rundy). Wzorzec 1:1 z
 * `dev-render/screens/admin-billing.tsx` / `admin-security.tsx`.
 *
 * Mapowanie ekran→komponent skopiowane 1:1 z realnego routingu w
 * `src/views/admin/AdminSettingsModule.tsx` (case 'ai', linie ~466-476 +
 * AI_MODULE_TAB_BY_SCREEN linie ~227-233):
 *   policy-autonomy        → <AdminAIControlCenterPanel /> (initialAiModuleTab=undefined
 *                             → activeTab default 'settings' → <OrgAISettingsView />, tab 'policy')
 *   personas                → <PersonasPanel />
 *   models-providers        → <AdminAIControlCenterPanel initialAiModuleTab="models-providers" />
 *                             → tab 'operations' → <AIModule initialTab="models-providers" />
 *                             → <ModelsProvidersTab />
 *   ai-limits-budgets       → AIModule initialTab="access-limits" → <AccessLimitsTab />
 *   data-privacy            → AIModule initialTab="features-privacy" → <FeaturesPrivacyTab />
 *   quality-evaluations     → <AdminAiQualityPanel /> (StandardTable ×2)
 *   ai-incidents            → <AdminAiIncidentsPanel /> (StandardTable)
 *   configuration-versions  → <AdminConfigurationVersionsPanel /> (StandardTable, V8 prompt-os)
 *   ai-operations           → AIModule initialTab="ai-health" → <AIMissionControl />
 *   ai-audit                → AIModule initialTab="audit-compliance" → <AuditComplianceTab />
 *
 * ★ ALIAS/ZAGNIEŻDŻENIE (analogiczne do "billing miało aliasy słotów" —
 * patrz nagłówek admin-billing.tsx): TE PIĘĆ ekranów (models-providers,
 * ai-limits-budgets, data-privacy, ai-operations, ai-audit) NIE są proste
 * aliasy jednej zakładki (różnią się treścią) — ale wszystkie pięć dzielą
 * DOKŁADNIE tę samą powłokę `<AdminAIControlCenterPanel>` (3 karty KPI +
 * własny pill-tabs "Governance settings/AI operations", zob.
 * AdminAIControlCenterPanel.tsx:129-146), a pod spodem `<AIModule>` ma WŁASNY
 * drugi pill-tabs (`TabLayout`, 9 zakładek: llm-config/access-limits/
 * policy-governance/models-providers/features-privacy/audit-compliance/
 * ai-health/help-analytics/token-management — AIModule.tsx:58-104). Z tych 9
 * zakładek TYLKO 5 mają odpowiadający slot w głównym menu Admina — llm-config,
 * policy-governance, help-analytics, token-management NIE MAJĄ ŻADNEGO wejścia
 * z głównej nawigacji Admina i są osiągalne WYŁĄCZNIE klikając wewnętrzny
 * pill-tab po wejściu na jeden z pięciu wpiętych ekranów. To jest podwójne
 * zagnieżdżenie nawigacji (Admin nav → AdminAIControlCenterPanel tabs → AIModule
 * tabs), gorsze niż płaski alias — ZGŁASZAM.
 *
 * `policy-autonomy` ląduje w `<OrgAISettingsView>`, która ma WŁASNY, TRZECI
 * poziom pill-tabs (policy/limits/features/audit — OrgAISettingsView.tsx:361-382,
 * domyślnie 'policy'). Zakładki "Limits & Budget" i "Audit Log" WEWNĄTRZ tego
 * widoku nazewniczo kolidują z osobnymi slotami menu Admina "Limity i budżety"
 * (ai-limits-budgets) i "Audyt AI" (ai-audit) — ale renderują INNĄ treść
 * (AccessLimitsTab/AuditComplianceTab pod AIModule, nie te same komponenty).
 * Realna szansa na dezorientację: dwie różne ścieżki do "coś o limitach AI" i
 * dwie różne do "coś o audycie AI" — ZGŁASZAM.
 *
 * Kilka głęboko zagnieżdżonych zakładek (AccessLimitsTab, AuditComplianceTab)
 * mają JESZCZE WŁASNE sub-taby (activeSubTab) — czwarty poziom. Ten harness
 * pokazuje domyślny (pierwszy) sub-tab każdego ekranu — to jest to, co Piotr
 * zobaczy klikając wyłącznie z głównego menu Admina, bez dalszych kliknięć.
 *
 * Żadnej reimplementacji: montujemy REALNE komponenty. Stubujemy
 * `window.fetch`, scoped po substringach URL-i realnie używanych przez te
 * ekrany (`/ai-settings/org`, `/ai-prompts`, `/admin/ai-quality`,
 * `/llm/incidents`, `/ai-operations/analytics/llm-observatory`,
 * `/api/v8/prompt-os`, `/llm/providers`, `/llm/status`,
 * `/llm/org/*\/available-models`, `/admin-data/user-tiers`,
 * `/admin-data/cost-attribution`, `/admin-data/custom-templates`,
 * `/admin-data/security-events`, `/admin-data/compliance-reports`,
 * `/ai-settings/audit`, `/llm/health/status`, `/admin/ai/summary`) — NIE
 * catch-all `/api/*` (pułapka opisana w i18n-fala1-smoke.tsx).
 *
 * `seedRealisticSession()` (dev-render/mocks/seedStore.ts) — AccessLimitsTab/
 * FeaturesPrivacyTab/AuditComplianceTab gate on `useAppStore().currentOrganization`;
 * bez seeda te trzy renderują puste stany zamiast realnych danych.
 *
 * Dane demo: fikcyjna organizacja „Atelier Toys" (spójna etykieta z
 * admin-billing/admin-team/admin-security), org-id ze store to prawdziwe
 * `org-dbr77-demo` (seedRealisticSession) — dopasowania URL po substringu,
 * NIGDY po dokładnym ID.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AdminAiIncidentsPanel } from '../../src/components/Admin/AdminAiIncidentsPanel';
import { AdminAiQualityPanel } from '../../src/components/Admin/AdminAiQualityPanel';
import { PersonasPanel } from '../../src/components/Admin/AI/PersonasPanel';
import { AdminAIControlCenterPanel } from '../../src/components/Admin/AdminAIControlCenterPanel';
import { AdminConfigurationVersionsPanel } from '../../src/components/Admin/AdminConfigurationVersionsPanel';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

export type AdminAiScreenId =
  | 'policy-autonomy'
  | 'personas'
  | 'models-providers'
  | 'ai-limits-budgets'
  | 'data-privacy'
  | 'quality-evaluations'
  | 'ai-incidents'
  | 'configuration-versions'
  | 'ai-operations'
  | 'ai-audit';

const ORG_ID = 'org-atelier-toys-0001';

// --- /ai-settings/org/:id — dzielony przez OrgAISettingsView / AccessLimitsTab
// / FeaturesPrivacyTab (jeden endpoint, trzy różne ekrany go czytają). ---
const ORG_AI_SETTINGS = {
  organizationId: ORG_ID,
  policyLevel: 'ADVISORY',
  maxPolicyLevel: 'AUTOPILOT',
  defaultProactivityMode: 'REACTIVE',
  activeRoles: ['ADVISOR', 'ANALYST'],
  defaultRole: 'ADVISOR',
  enabledModelIds: ['gpt-4o', 'claude-3.5-sonnet', 'gpt-4o-mini'],
  maxAICallsPerDay: 500,
  maxTokensPerMonth: 2000000,
  monthlyBudgetUSD: 1200,
  hardLimitUSD: 1800,
  freezeOnLimit: true,
  webSearchEnabled: true,
  artifactsEnabled: true,
  thinkingStepsEnabled: false,
  focusModesEnabled: true,
  voiceEnabled: false,
  autoTierEnabled: true,
  autoTierDirection: 'down',
  autoTierThreshold: 80,
  systemPrompts: [],
  defaultSystemPromptId: 'prompt-advisor-default',
  auditAllRequests: true,
  auditPolicyChanges: true,
  createdAt: '2026-02-10T09:00:00Z',
  updatedAt: '2026-08-20T14:32:00Z',
  updatedBy: 'piotr@atelier-toys.pl',
};

// --- /ai-prompts (personas) ---
const SYSTEM_PROMPTS = [
  {
    id: 'sp-1',
    key: 'advisor_default',
    name: 'Doradca — domyślny',
    description: 'Podstawowa persona doradcza dla nowych projektów.',
    content:
      'Jesteś doświadczonym konsultantem strategicznym. Odpowiadaj rzeczowo, po polsku, opieraj się na dostarczonym kontekście projektu.',
    category: 'default',
    isActive: true,
    version: 3,
    context_config: {
      include_project_context: true,
      include_user_profile: true,
      include_assessment_data: false,
      include_kb_articles: true,
      include_task_history: false,
    },
    createdAt: '2026-01-05T08:00:00Z',
    updatedAt: '2026-08-12T10:00:00Z',
  },
  {
    id: 'sp-2',
    key: 'analyst_financial',
    name: 'Analityk finansowy',
    description: 'Persona do modeli finansowych i wyceny.',
    content: 'Jesteś analitykiem finansowym. Skup się na liczbach, założeniach i ryzyku.',
    category: 'persona',
    isActive: true,
    version: 1,
    context_config: {
      include_project_context: true,
      include_user_profile: false,
      include_assessment_data: true,
      include_kb_articles: false,
      include_task_history: true,
    },
    createdAt: '2026-03-18T08:00:00Z',
    updatedAt: '2026-07-01T08:00:00Z',
  },
  {
    id: 'sp-3',
    key: 'facilitator_workshop',
    name: 'Facylitator warsztatu',
    description: 'Persona wspierająca prowadzenie warsztatów z klientem.',
    content: 'Jesteś facylitatorem warsztatu strategicznego. Zadawaj pytania otwierające.',
    category: 'persona',
    isActive: false,
    version: 2,
    context_config: {
      include_project_context: false,
      include_user_profile: true,
      include_assessment_data: false,
      include_kb_articles: false,
      include_task_history: false,
    },
    createdAt: '2026-04-02T08:00:00Z',
    updatedAt: '2026-06-15T08:00:00Z',
  },
];

// --- /admin/ai-quality/* ---
const AI_QUALITY_METRICS = {
  metrics: {
    satisfactionRate: 82,
    totalFeedback: 146,
    activePatternsCount: 9,
    userProfilesCount: 24,
  },
};
const AI_QUALITY_FEEDBACK = {
  feedback: [
    {
      id: 'fb-1',
      user_name: 'Anna Kowalska',
      screen_context: 'Assessment — Executive Summary',
      feedback_type: 'positive',
      reviewed_at: '2026-08-20T09:00:00Z',
    },
    {
      id: 'fb-2',
      user_name: 'Marek Zieliński',
      screen_context: 'Initiatives — Business Case',
      feedback_type: 'negative',
      reviewed_at: null,
    },
    {
      id: 'fb-3',
      user_name: 'Piotr Wiśniewski',
      screen_context: 'Finance — Prognoza',
      feedback_type: 'negative',
      reviewed_at: null,
    },
  ],
};
const AI_QUALITY_PATTERNS = {
  patterns: [
    {
      id: 'pat-1',
      pattern_type: 'ton_odpowiedzi',
      pattern_value: 'Zbyt formalny język w podsumowaniach',
      confidence_score: 0.78,
      status: 'pending',
    },
    {
      id: 'pat-2',
      pattern_type: 'dlugosc_odpowiedzi',
      pattern_value: 'Za długie akapity w rekomendacjach',
      confidence_score: 0.64,
      status: 'applied',
    },
  ],
};
const AI_QUALITY_CONTEXTS = { contexts: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] };
const AI_QUALITY_FORMATS = { formats: [{ id: 'f1' }, { id: 'f2' }] };
const AI_QUALITY_ISSUES = { issues: [{ id: 'i1' }] };

// --- /llm/incidents + /ai-operations/analytics/llm-observatory ---
const LLM_INCIDENTS = {
  incidents: [
    {
      start: '2026-08-29T03:12:00Z',
      end: '2026-08-29T03:41:00Z',
      durationMs: 1740000,
      samples: 34,
      lastError: 'Provider timeout (OpenAI) po 20s',
      provider: 'openai',
    },
  ],
};
const LLM_OBSERVATORY = {
  incidents: [
    {
      start: '2026-08-25T11:00:00Z',
      end: '2026-08-25T11:07:00Z',
      durationMs: 420000,
      samples: 12,
      lastError: 'Rate limit 429 (Anthropic)',
      provider: 'anthropic',
    },
  ],
};

// --- /api/v8/prompt-os/* ---
const V8_RUNTIME_SUMMARY = {
  data: {
    contract: '2.3.0',
    purposeFamiliesSupported: ['advisory', 'analysis', 'drafting'],
    presetCount: 6,
    bundleCount: 4,
    activeBundleCount: 1,
  },
};
const V8_BUNDLES = {
  data: [
    {
      bundleId: 'bundle-1',
      version: '2026.08.3',
      presetId: 'preset-advisory-standard',
      promptVersion: 'p12',
      modelVersion: 'gpt-4o@2026-05',
      policyVersion: 'pol-7',
      runtimeConfigVersion: 'rc-9',
      status: 'active',
    },
    {
      bundleId: 'bundle-2',
      version: '2026.07.1',
      presetId: 'preset-advisory-standard',
      promptVersion: 'p11',
      modelVersion: 'gpt-4o@2026-05',
      policyVersion: 'pol-6',
      runtimeConfigVersion: 'rc-8',
      status: 'rolled_back',
    },
    {
      bundleId: 'bundle-3',
      version: '2026.08.4-canary',
      presetId: 'preset-advisory-standard',
      promptVersion: 'p13',
      modelVersion: 'claude-3.5-sonnet@2026-06',
      policyVersion: 'pol-7',
      runtimeConfigVersion: 'rc-9',
      status: 'canary',
    },
    {
      bundleId: 'bundle-4',
      version: '2026.08.5-draft',
      presetId: 'preset-financial-analysis',
      promptVersion: 'p14',
      modelVersion: 'gpt-4o@2026-05',
      policyVersion: 'pol-7',
      runtimeConfigVersion: 'rc-9',
      status: 'draft',
    },
  ],
};

// --- /llm/providers + /llm/status + /llm/org/:id/available-models ---
const LLM_PROVIDERS = [
  {
    id: 'prov-1',
    provider: 'openai',
    name: 'OpenAI',
    model: 'gpt-4o',
    model_id: 'gpt-4o',
    displayName: 'GPT-4o',
    isEnabled: true,
    isDefault: true,
    is_active: true,
    is_enabled_for_org: true,
    tier: 'STANDARD',
    maxTokens: 128000,
    contextWindow: 128000,
    capabilities: ['vision', 'tools', 'streaming'],
    costPerInputToken: 0.000005,
    costPerOutputToken: 0.000015,
    healthStatus: { status: 'healthy', latency: 420, lastCheck: '2026-08-31T07:00:00Z' },
  },
  {
    id: 'prov-2',
    provider: 'anthropic',
    name: 'Anthropic',
    model: 'claude-3.5-sonnet',
    model_id: 'claude-3.5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    isEnabled: true,
    isDefault: false,
    is_active: true,
    is_enabled_for_org: true,
    tier: 'PREMIUM',
    maxTokens: 200000,
    contextWindow: 200000,
    capabilities: ['vision', 'tools'],
    costPerInputToken: 0.000003,
    costPerOutputToken: 0.000015,
    healthStatus: { status: 'healthy', latency: 380, lastCheck: '2026-08-31T07:00:00Z' },
  },
  {
    id: 'prov-3',
    provider: 'deepseek',
    name: 'DeepSeek',
    model: 'deepseek-chat',
    model_id: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    isEnabled: false,
    isDefault: false,
    is_active: false,
    is_enabled_for_org: false,
    tier: 'BUDGET',
    maxTokens: 64000,
    contextWindow: 64000,
    capabilities: ['streaming'],
    costPerInputToken: 0.0000005,
    costPerOutputToken: 0.0000015,
    healthStatus: { status: 'unknown', latency: null, lastCheck: null },
  },
];
const LLM_STATUS = {
  success: true,
  timestamp: '2026-08-31T07:05:00Z',
  providers: LLM_PROVIDERS.map((p) => ({
    id: p.id,
    provider: p.provider,
    name: p.name,
    model: p.model,
    endpoint: `https://api.${p.provider}.com`,
    isConfigured: true,
    isActive: p.is_active,
    isDefault: p.isDefault,
    tier: p.tier,
    healthStatus: p.healthStatus.status,
    lastHealthCheck: p.healthStatus.lastCheck,
    supportsVision: p.capabilities.includes('vision'),
    supportsStreaming: p.capabilities.includes('streaming'),
    supportsTools: p.capabilities.includes('tools'),
    priority: 1,
    costPer1k: p.costPerOutputToken * 1000,
  })),
  defaultProvider: { provider: 'openai', model: 'gpt-4o', name: 'GPT-4o' },
  fallbackChains: {},
  circuitBreakers: {},
  summary: { total: 3, configured: 2, active: 2, healthy: 2, degraded: 0, unhealthy: 0 },
  startupValidation: {
    timestamp: '2026-08-31T06:00:00Z',
    duration: 820,
    healthy: 2,
    criticalErrors: [],
  },
};
const AVAILABLE_MODELS = {
  tiers: {
    BUDGET: [
      {
        id: 'm1',
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        model_id: 'deepseek-chat',
        health_status: 'unknown',
      },
    ],
    STANDARD: [
      { id: 'm2', name: 'GPT-4o', provider: 'openai', model_id: 'gpt-4o', health_status: 'healthy' },
    ],
    PREMIUM: [
      {
        id: 'm3',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        model_id: 'claude-3.5-sonnet',
        health_status: 'healthy',
      },
    ],
    REASONING: [],
  },
};

// --- /admin-data/user-tiers, /admin-data/cost-attribution ---
const USER_TIERS = [
  {
    userId: 'u1',
    userName: 'Anna Kowalska',
    email: 'anna@atelier-toys.pl',
    currentTier: 'PREMIUM',
    usage: 812,
    cost: 64.2,
  },
  {
    userId: 'u2',
    userName: 'Marek Zieliński',
    email: 'marek@atelier-toys.pl',
    currentTier: 'STANDARD',
    usage: 340,
    cost: 21.5,
  },
];
const COST_ATTRIBUTION = [
  {
    entityType: 'user',
    entityId: 'u1',
    entityName: 'Anna Kowalska',
    requests: 412,
    tokens: 890000,
    cost: 64.2,
    percentage: 42,
  },
  {
    entityType: 'project',
    entityId: 'proj-1',
    entityName: 'Atelier Toys — Growth',
    requests: 260,
    tokens: 510000,
    cost: 38.1,
    percentage: 25,
  },
];

// --- /admin-data/custom-templates, /security-events, /compliance-reports ---
const CUSTOM_TEMPLATES = [
  {
    id: 'tpl-1',
    name: 'RODO — rozszerzony',
    description: 'Własny szablon zgodności RODO dla klientów UE.',
    basedOn: 'GDPR',
    sectionsCount: 6,
    checkpointsCount: 24,
    createdAt: '2026-05-01T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z',
  },
];
const SECURITY_EVENTS = [
  {
    id: 'sec-1',
    timestamp: '2026-08-30T14:20:00Z',
    type: 'pii_detected',
    severity: 'medium',
    userId: 'u2',
    userEmail: 'marek@atelier-toys.pl',
    details: 'Wykryto numer PESEL w treści promptu — zamaskowano automatycznie.',
    resolved: true,
  },
  {
    id: 'sec-2',
    timestamp: '2026-08-31T06:10:00Z',
    type: 'rate_limit',
    severity: 'low',
    userId: 'u1',
    userEmail: 'anna@atelier-toys.pl',
    details: 'Przekroczono limit 60 zapytań/min.',
    resolved: false,
  },
];
const COMPLIANCE_REPORTS = [
  {
    id: 'rep-1',
    name: 'SOC2 — Q3 2026',
    standard: 'SOC2',
    generatedAt: '2026-08-01T08:00:00Z',
    status: 'compliant',
    findings: 0,
  },
  {
    id: 'rep-2',
    name: 'RODO — przegląd sierpień',
    standard: 'GDPR',
    generatedAt: '2026-08-15T08:00:00Z',
    status: 'partial',
    findings: 2,
  },
];

// --- /ai-settings/audit ---
const AI_SETTINGS_AUDIT = [
  {
    id: 'aud-1',
    timestamp: '2026-08-20T14:32:00Z',
    level: 'admin',
    actorId: 'user-piotr-demo',
    actorEmail: 'piotr@atelier-toys.pl',
    actorRole: 'ADMIN',
    targetId: ORG_ID,
    settingKey: 'policyLevel',
    oldValue: 'REACTIVE',
    newValue: 'ADVISORY',
    ipAddress: '81.190.4.22',
  },
  {
    id: 'aud-2',
    timestamp: '2026-08-12T10:00:00Z',
    level: 'admin',
    actorId: 'user-piotr-demo',
    actorEmail: 'piotr@atelier-toys.pl',
    actorRole: 'ADMIN',
    targetId: ORG_ID,
    settingKey: 'monthlyBudgetUSD',
    oldValue: '900',
    newValue: '1200',
    ipAddress: '81.190.4.22',
  },
];

// --- /llm/analytics + /llm/logs (AdminLLMView, zakladka "Panel stanu") ---
// POWOD ISTNIENIA (dyzur crimson/odwrocona semantyka 2026-09-01): bez tych dwoch
// wpisow `loadAnalytics()` leci wyjatkiem, AdminLLMView pokazuje pusty stan
// "Analityka LLM niedostepna" i CZTERY karty KPI (w tym "ERROR RATE") w ogole
// sie nie renderuja — czyli nie da sie zrobic zrzutu ekranu, ktory sie ocenia.
// `error_rate` celowo ZDROWY (0.012 < prog 0.05), bo oceniany jest wlasnie
// wyglad stanu zdrowego.
const LLM_ANALYTICS = {
  total_requests: 18432,
  avg_latency: 842,
  total_cost: 12.4137,
  error_rate: 0.012,
  error_count: 221,
};
const LLM_LOGS = { logs: [] };

// --- /llm/health/status (AIMissionControl) ---
const LLM_HEALTH_STATUS = {
  // AIMissionControl.tsx:279 filters `p.status === 'ACTIVE'` (exact literal,
  // not a health-style enum) to populate "Aktywni dostawcy" — verified in
  // source before mocking so the screenshot doesn't show a false empty state.
  providers: [
    { name: 'OpenAI', type: 'llm', status: 'ACTIVE', visibility: 'public' },
    { name: 'Anthropic', type: 'llm', status: 'ACTIVE', visibility: 'public' },
    { name: 'DeepSeek', type: 'llm', status: 'INACTIVE', visibility: 'internal' },
  ],
  metrics: { uptime50: 99.4, avgLatencyMs: 640, totalRequests: 18240 },
  timestamp: '2026-08-31T07:05:00Z',
};

// --- /admin/ai/summary (AdminAIControlCenterPanel KPI cards, wspólne dla
// wszystkich pięciu ekranów pod AdminAIControlCenterPanel) ---
const ADMIN_AI_SUMMARY = {
  summary: {
    governanceSummary: { policyLevel: 'ADVISORY', modelCount: 3, budgetStatus: 'W normie' },
    llmPolicy: { review_state: 'approved', mode: 'advisory' },
    contextPolicy: { allowExternalContext: false, defaultSensitivity: 'internal' },
  },
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const g = window as unknown as { __ADMIN_AI_FETCH__?: boolean };
if (!g.__ADMIN_AI_FETCH__) {
  g.__ADMIN_AI_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      // ModelsProvidersTab (models-providers) probes `/api/auth/me` on mount
      // even when `organizationId` is already provided — a stray real fetch
      // would 404 against the dev-render harness (no backend). Mocked so the
      // console-error count stays at zero, matching the sibling billing/security
      // harnesses.
      if (url.includes('/auth/me'))
        return jsonResponse({ user: { organizationId: ORG_ID, email: 'piotr@atelier-toys.pl' } });
      if (url.includes('/admin/ai/summary')) return jsonResponse(ADMIN_AI_SUMMARY);
      if (url.includes('/ai-prompts')) {
        if (method === 'PUT') return jsonResponse({ success: true });
        return jsonResponse(SYSTEM_PROMPTS);
      }
      if (url.includes('/ai-settings/audit')) return jsonResponse(AI_SETTINGS_AUDIT);
      if (url.includes('/ai-settings/org/')) {
        if (method === 'PUT') return jsonResponse(ORG_AI_SETTINGS);
        return jsonResponse(ORG_AI_SETTINGS);
      }
      if (url.includes('/admin/ai-quality/metrics')) return jsonResponse(AI_QUALITY_METRICS);
      if (url.includes('/admin/ai-quality/feedback')) {
        if (method === 'POST') return jsonResponse({ success: true });
        return jsonResponse(AI_QUALITY_FEEDBACK);
      }
      if (url.includes('/admin/ai-quality/patterns')) {
        if (method === 'POST') return jsonResponse({ success: true });
        return jsonResponse(AI_QUALITY_PATTERNS);
      }
      if (url.includes('/admin/ai-quality/analytics/contexts')) return jsonResponse(AI_QUALITY_CONTEXTS);
      if (url.includes('/admin/ai-quality/analytics/formats')) return jsonResponse(AI_QUALITY_FORMATS);
      if (url.includes('/admin/ai-quality/analytics/issues')) return jsonResponse(AI_QUALITY_ISSUES);
      if (url.includes('/llm/incidents')) return jsonResponse(LLM_INCIDENTS);
      if (url.includes('/ai-operations/analytics/llm-observatory')) return jsonResponse(LLM_OBSERVATORY);
      if (url.includes('/prompt-os/runtime/summary')) return jsonResponse(V8_RUNTIME_SUMMARY);
      if (url.includes('/prompt-os/bundles') && !url.includes('/eval-gates') && !url.includes('/canary'))
        return jsonResponse(V8_BUNDLES);
      if (url.includes('/llm/providers')) return jsonResponse(LLM_PROVIDERS);
      if (url.includes('/llm/status/refresh')) return jsonResponse({ success: true, summary: LLM_STATUS.summary });
      if (url.includes('/llm/status/test/')) return jsonResponse({ success: true });
      if (url.includes('/llm/status')) return jsonResponse(LLM_STATUS);
      if (url.includes('/available-models')) return jsonResponse(AVAILABLE_MODELS);
      if (url.includes('/admin-data/user-tiers/')) return jsonResponse(USER_TIERS);
      if (url.includes('/admin-data/cost-attribution/')) return jsonResponse(COST_ATTRIBUTION);
      if (url.includes('/admin-data/custom-templates/')) return jsonResponse(CUSTOM_TEMPLATES);
      if (url.includes('/admin-data/security-events/')) return jsonResponse(SECURITY_EVENTS);
      if (url.includes('/admin-data/compliance-reports/')) return jsonResponse(COMPLIANCE_REPORTS);
      if (url.includes('/llm/health/status')) return jsonResponse(LLM_HEALTH_STATUS);
      if (url.includes('/llm/analytics')) return jsonResponse(LLM_ANALYTICS);
      if (url.includes('/llm/logs')) return jsonResponse(LLM_LOGS);
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

// Mapowanie 1:1 z AdminSettingsModule.tsx case 'ai'.
function renderAiScreen(adminScreen: AdminAiScreenId): React.ReactElement {
  if (adminScreen === 'personas') return <PersonasPanel />;
  if (adminScreen === 'quality-evaluations') return <AdminAiQualityPanel />;
  if (adminScreen === 'ai-incidents') return <AdminAiIncidentsPanel />;
  if (adminScreen === 'configuration-versions') return <AdminConfigurationVersionsPanel />;
  if (adminScreen === 'policy-autonomy') return <AdminAIControlCenterPanel />;
  const tab = (
    {
      'models-providers': 'models-providers',
      'ai-limits-budgets': 'access-limits',
      'data-privacy': 'features-privacy',
      'ai-operations': 'ai-health',
      'ai-audit': 'audit-compliance',
    } as const
  )[adminScreen as 'models-providers' | 'ai-limits-budgets' | 'data-privacy' | 'ai-operations' | 'ai-audit'];
  return <AdminAIControlCenterPanel initialAiModuleTab={tab} />;
}

// Ekrany dla których wolimy zamontować sam liść (bez otaczających kart KPI +
// pill-tabs AdminAIControlCenterPanel + TabLayout AIModule) NIE istnieją w
// realnym routingu — AdminSettingsModule ZAWSZE montuje pełną powłoę dla tych
// pięciu ekranów. Zostawiamy `renderAiScreen` 1:1 z produktem (żadnego skrótu).
export default function AdminAiScreen(props: {
  adminScreen: AdminAiScreenId;
}): React.ReactElement {
  // `&ekran=` w URL nadpisuje prop domyślny — pozwala odpalić dowolny
  // z 10 ekranów spod jednego wpisu w main.tsx.
  const requested = new URLSearchParams(window.location.search).get('ekran') as AdminAiScreenId | null;
  const adminScreen = requested || props.adminScreen;
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <DebugBoundary>
        <MemoryRouter initialEntries={['/']}>{renderAiScreen(adminScreen)}</MemoryRouter>
      </DebugBoundary>
    </div>
  );
}
