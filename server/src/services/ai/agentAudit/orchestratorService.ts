import { v4 as uuidv4 } from 'uuid';

import { runAgentRuntime } from '../agentRuntime/agentRuntimeService.js';
import type { AgentRuntimeDefinition } from '../agentRuntime/types.js';
import { retrieveAgentAuditKnowledge } from './agentAuditKnowledgeService.js';
import { logAgentAuditEvent } from './agentAuditMetricsService.js';
import { retrieveAgentAuditWebSources } from './agentAuditWebResearchService.js';
import { getAgentDefinition } from './agentRegistry.js';
import {
  type AgentDefinition,
  AgentReviewSchema,
  type DecisionContext,
  type GateExplanation,
  type OrchestratorVerdict,
  type RiskArea,
  type SourceUsed,
  type SuggestedAgentsSet,
} from './types.js';

/** Per-role audit review, parsed+post-processed. Kept as a type alias so the generic
 *  `AgentRuntimeDefinition<ReviewArgs, AuditReview, OrchestratorVerdict>` below reads clearly. */
type AuditReview = ReturnType<typeof AgentReviewSchema.parse>;

type SuggestArgs = {
  decisionContext: DecisionContext;
  userIntent?: 'validate' | 'stress_test' | 'approve';
  language?: string;
  maxAgents?: 2 | 3 | 4;
};

type ReviewArgs = {
  organizationId?: string | null;
  userId?: string | null;
  conversationId?: string | null;
  decisionContext: DecisionContext;
  deepThinkingReport: string;
  // Optional "force depth" signal from Deep Thinking pipeline (compare before vs after)
  forceDepthDiff?: {
    isSubstantiallyDifferent: boolean;
    jaccardSimilarity?: number;
    rubricDelta?: number;
    newAxesDetected?: boolean;
    failReasons?: string[];
  } | null;
  agentIds: string[];
  userIntent?: 'validate' | 'stress_test' | 'approve';
  language?: string;
  webSearchEnabled?: boolean;
  selectedTier?: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
  selectedModelId?: string | null;
  loopIteration?: 1 | 2;
  emit?: (payload: Record<string, unknown>) => void;
};

function normalizeText(t: unknown): string {
  return String(t || '').trim();
}

function pickIndustryId(decisionContext: DecisionContext): string {
  const hinted = String(decisionContext.industry || '').trim();
  if (hinted) {
    // Accept either canonical agent ids or a few common labels
    const s = hinted.toLowerCase();
    if (s.includes('manufact')) return 'industry.manufacturing';
    if (s.includes('produkc')) return 'industry.manufacturing';
    if (s.includes('logist')) return 'industry.logistics_vertical';
    if (s.includes('real') || s.includes('nieruch')) return 'industry.real_estate';
    if (s.includes('energ') || s.includes('utilit')) return 'industry.energy_utilities';
    if (s.includes('service') || s.includes('usług')) return 'industry.services_field';
    if (hinted.startsWith('industry.')) return hinted;
  }

  const topic = (decisionContext.topic || '').toLowerCase();
  const has = (re: RegExp) => re.test(topic);

  if (has(/\b(oee|tpm|smed|przezbroj|linia|zakład|produkcj|brygada|operator)\b/i))
    return 'industry.manufacturing';
  if (has(/\b(wms|tms|3pl|otif|magazyn|transport|spedycj|kurier|warehouse)\b/i))
    return 'industry.logistics_vertical';
  if (has(/\b(facilit|fm\b|nieruchom|budynek|czynsz|najem|leasing|fit-?out)\b/i))
    return 'industry.real_estate';
  if (has(/\b(utilit|energia|sieć|elektrown|ciepłown|gaz|prąd)\b/i))
    return 'industry.energy_utilities';

  return 'industry.services_field';
}

function detectTags(topic: string): {
  people: boolean;
  automation: boolean;
  integrations: boolean;
  projectRollout: boolean;
  innovation: boolean;
  realEstate: boolean;
  highStakes: boolean;
} {
  const t = topic.toLowerCase();
  const has = (re: RegExp) => re.test(t);

  return {
    people: has(/\b(hr|rotacj|absencj|ludzi|zesp[oó]ł|rekrut|kompetenc|szkolen)\b/i),
    automation: has(/\b(automatyz|robot|plc|mes\b|scada|iot|predykcyj|ai|ml)\b/i),
    integrations: has(
      /\b(integracj|api\b|erp\b|sap\b|sso\b|ldap|idp|security|cyber|zero trust)\b/i
    ),
    projectRollout: has(
      /\b(rollout|transformacj|wdrożen|projekt|program|harmonogram|raci|governance)\b/i
    ),
    innovation: has(/\b(nowy produkt|innowacj|rd\b|r&d|roadmap|eksperyment)\b/i),
    realEstate: has(/\b(nieruchom|facility|budynek|lease|fit-?out)\b/i),
    highStakes: has(
      /\b(bet[- ]the[- ]company|wysokie ryzyko|krytyczn|capex|inwestycj|płynno|cashflow)\b/i
    ),
  };
}

function buildSignals(tags: ReturnType<typeof detectTags>): string[] {
  const out: string[] = [];
  if (tags.people) out.push('people');
  if (tags.automation) out.push('automation');
  if (tags.integrations) out.push('integrations');
  if (tags.projectRollout) out.push('projectRollout');
  if (tags.innovation) out.push('innovation');
  if (tags.realEstate) out.push('realEstate');
  if (tags.highStakes) out.push('highStakes');
  return out;
}

function buildWhySelected(agentId: string): string {
  if (agentId.startsWith('industry.')) return 'Weryfikacja realiów branżowych i ryzyk wdrożenia.';
  if (agentId === 'function.cfo_finance')
    return 'Wysokie ryzyko finansowe: cashflow/CAPEX/ROI i warunki akceptacji.';
  if (agentId === 'function.it_security')
    return 'Ryzyko integracji i bezpieczeństwa: dostęp, dane, dostępność, compliance IT.';
  if (agentId === 'function.hr')
    return 'Ryzyko ludzi i zmiany: kompetencje, rotacja, opór i zdolność wdrożenia.';
  if (agentId === 'function.pm_project_management')
    return 'Ryzyko realizacyjne projektu: governance, RACI, harmonogram, rollout.';
  if (agentId === 'function.maintenance_ur')
    return 'Ryzyko dostępności i serwisowalności: UR, downtime, części, SLA.';
  if (agentId === 'function.plant_manager')
    return 'Egzekucja operacyjna: realność wdrożenia w zakładzie i wpływ na KPI.';
  if (agentId === 'function.procurement')
    return 'Ryzyko dostawców: lead time, single-source, TCO i warunki umów.';
  if (agentId === 'function.ceo') return 'Spójność strategiczna, timing i ryzyko reputacyjne.';
  if (agentId === 'function.owner') return 'Perspektywa bet-the-company i warunki brzegowe.';
  if (agentId === 'function.adversarial')
    return 'Kontrola jakości: falsyfikowalność, ukryte założenia i nadmierna pewność.';
  return `Audyt z perspektywy roli (${agentId}).`;
}

function expectedFindings(agentId: string): string[] {
  switch (agentId) {
    case 'function.cfo_finance':
      return ['cashflow', 'CAPEX/OPEX', 'ROI/payback', 'dane must-have'];
    case 'function.it_security':
      return ['ryzyka danych/dostępu', 'dostępność', 'compliance IT', 'wymagane mitigacje'];
    case 'function.maintenance_ur':
      return ['dostępność', 'serwisowalność', 'części i SLA', 'ryzyka przestojów'];
    case 'function.pm_project_management':
      return ['RACI/governance', 'zależności', 'harmonogram', 'ryzyko rollout'];
    case 'function.hr':
      return ['kompetencje', 'szkolenia', 'opór zmian', 'ryzyka rotacji/absencji'];
    case 'function.adversarial':
      return ['ukryte założenia', 'brak kryteriów', 'nadmierna pewność', 'niefalsyfikowalne tezy'];
    default:
      return ['ryzyka wdrożenia', 'braki danych', 'warunki brzegowe'];
  }
}

export function suggestAgents(args: SuggestArgs): SuggestedAgentsSet {
  const dc = args.decisionContext;
  const maxAgents = args.maxAgents || 3;
  const orchestratorRunId = uuidv4();

  const industryId = pickIndustryId(dc);
  const tags = detectTags(dc.topic || '');
  const signals = buildSignals(tags);

  // Default set: 1 industry + CFO + one execution role
  const picked: string[] = [];

  const add = (id: string) => {
    if (!id) return;
    if (picked.includes(id)) return;
    if (picked.length >= maxAgents) return;
    picked.push(id);
  };

  add(industryId);
  add('function.cfo_finance');

  if (industryId === 'industry.manufacturing') add('function.plant_manager');
  else if (industryId === 'industry.logistics_vertical') add('function.logistics_function');
  else if (industryId === 'industry.real_estate') add('function.procurement');
  else add('function.pm_project_management');

  if (tags.automation) add('function.maintenance_ur');
  if (tags.integrations) add('function.it_security');
  if (tags.people) add('function.hr');
  if (tags.projectRollout) add('function.pm_project_management');
  if (tags.innovation) add('function.cto_architecture');
  if (tags.highStakes && maxAgents >= 4) add('function.owner');

  // Add adversarial in stress-test mode or when topic looks high-stakes/complex.
  if ((args.userIntent || 'validate') === 'stress_test') add('function.adversarial');
  else if ((tags.highStakes || (dc.topic || '').length > 280) && maxAgents >= 4)
    add('function.adversarial');

  const agents = picked.map((agentId, idx) => ({
    agentId,
    type: agentId.startsWith('industry.')
      ? ('industry' as const)
      : agentId === 'function.adversarial'
        ? ('adversarial' as const)
        : ('functional' as const),
    whySelected: buildWhySelected(agentId),
    expectedFindings: expectedFindings(agentId),
    ruleId: 'default_v1',
    signals,
    priority: (idx === 0 || agentId === 'function.cfo_finance' ? 1 : 2) as 1 | 2 | 3,
  }));

  return {
    orchestratorRunId,
    decisionContext: dc,
    agents,
    constraints: { maxAgents, requireManualApproval: true },
  };
}

function containsMustHave(q: string): boolean {
  const t = String(q || '').trim();
  if (!t) return false;
  return /^MUST\s*:|^MUST_HAVE\s*:|must-have/i.test(t);
}

function riskAreaIsFinance(a: RiskArea): boolean {
  return a === 'cashflow' || a === 'capex';
}

function fallbackSourcesUsedFromDT(evidenceFromDT: string[]): SourceUsed[] {
  const uniq = Array.from(
    new Set((evidenceFromDT || []).map((s) => String(s || '').trim()))
  ).filter(Boolean);
  return uniq.slice(0, 6).map((quote) => ({
    type: 'dt_section' as const,
    section: 'DeepThinkingReport',
    quote,
  }));
}

function extractUrls(text: string): string[] {
  const out: string[] = [];
  const re = /https?:\/\/[^\s"'<>]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[0]);
  return out;
}

export function validateReviewWebSources(args: {
  review: any;
  allowedWebUrls: Set<string>;
  webSearchEnabled: boolean;
}): { ok: boolean; reason?: string } {
  const reviewObj = args.review || {};
  const usedWebUrls = new Set<string>();

  try {
    const findings = Array.isArray(reviewObj.findings) ? reviewObj.findings : [];
    for (const f of findings) {
      const su = Array.isArray(f?.sourcesUsed) ? f.sourcesUsed : [];
      for (const s of su) {
        if (s && s.type === 'web_source' && typeof s.url === 'string' && s.url.trim()) {
          usedWebUrls.add(s.url.trim());
        }
      }
    }
  } catch {
    // ignore
  }

  // If web search is disabled, no web URLs are allowed in output
  if (!args.webSearchEnabled) {
    const blob = JSON.stringify(reviewObj || {});
    const urls = extractUrls(blob);
    if (urls.length > 0 || usedWebUrls.size > 0) {
      return { ok: false, reason: 'Web citations present while web search is disabled.' };
    }
    return { ok: true };
  }

  // Web search enabled: sourcesUsed web urls must be subset of allowed list
  for (const url of usedWebUrls) {
    if (!args.allowedWebUrls.has(url)) {
      return { ok: false, reason: `Unauthorized web source in sourcesUsed: ${url}` };
    }
  }

  // Any URL present anywhere in the output must appear in sourcesUsed and be allowed
  const blob = JSON.stringify(reviewObj || {});
  const urlsInText = extractUrls(blob);
  for (const url of urlsInText) {
    if (!usedWebUrls.has(url)) {
      return { ok: false, reason: `URL cited but missing from sourcesUsed: ${url}` };
    }
    if (!args.allowedWebUrls.has(url)) {
      return { ok: false, reason: `URL cited not in allowed list: ${url}` };
    }
  }

  return { ok: true };
}

export function validateNoSolutionRecommendations(args: { review: any; language: string }): {
  ok: boolean;
  reason?: string;
} {
  const lang = (args.language || 'pl').split('-')[0];
  const isPl = lang === 'pl';
  const reviewObj = args.review || {};

  // suggestedDeepening must be a "gap-filling" instruction, not an implementation recommendation
  const allowedStartPl = [
    'Uzupełnij',
    'Dodaj',
    'Opisz',
    'Zweryfikuj',
    'Podaj',
    'Zdefiniuj',
    'Wyjaśnij',
    'Oznacz',
    'Wskaż',
    'Rozpisz',
  ];
  const allowedStartEn = [
    'Add',
    'Fill',
    'Describe',
    'Verify',
    'Provide',
    'Define',
    'Clarify',
    'Mark',
    'List',
    'Specify',
    'Explain',
  ];

  const findings = Array.isArray(reviewObj.findings) ? reviewObj.findings : [];
  for (const f of findings) {
    const s = String(f?.suggestedDeepening || '').trim();
    if (!s) continue;
    const ok = (isPl ? allowedStartPl : allowedStartEn).some((p) =>
      s.toLowerCase().startsWith(p.toLowerCase())
    );
    if (!ok) {
      return {
        ok: false,
        reason: `suggestedDeepening must be gap-filling (starts with allowed verb). Got: "${s.slice(0, 160)}"`,
      };
    }
  }

  // scan for explicit recommendation phrases (heuristic, deterministic)
  const blob = JSON.stringify(reviewObj || {}).toLowerCase();
  const needles = isPl
    ? [
        'rekomenduj',
        'rekomenduję',
        'zalecam',
        'zalecenie',
        'należy wdrożyć',
        'powinniście wdrożyć',
        'wdroż ',
        'zróbcie ',
        'kup ',
        'wybierz ',
        'zatrudnij ',
        'podpisz umowę',
      ]
    : [
        'i recommend',
        'we recommend',
        'recommendation:',
        'should implement',
        'you should implement',
        'deploy ',
        'buy ',
        'choose ',
        'hire ',
        'sign a contract',
      ];
  if (needles.some((n) => blob.includes(n))) {
    return { ok: false, reason: 'Solution recommendation language detected in agent output.' };
  }

  return { ok: true };
}

export function validateAgentContractCompleteness(args: { review: any; language: string }): {
  ok: boolean;
  reason?: string;
} {
  const lang = (args.language || 'pl').split('-')[0];
  const isPl = lang === 'pl';
  const r = args.review || {};

  const obs = Array.isArray(r.observations) ? r.observations.filter(Boolean) : [];
  const chall = Array.isArray(r.challengedAssumptions)
    ? r.challengedAssumptions.filter(Boolean)
    : [];
  const topQ = Array.isArray(r.topQuestions) ? r.topQuestions.filter(Boolean) : [];
  const impact = String(r.impactIfIgnored || '').trim();
  const whenFails = String(r.whenItFails || '').trim();

  const missing: string[] = [];
  if (obs.length < 1) missing.push('observations');
  if (chall.length < 1) missing.push('challengedAssumptions');
  if (!impact) missing.push('impactIfIgnored');
  if (!whenFails) missing.push('whenItFails');
  if (topQ.length < 1) missing.push('topQuestions');
  if (topQ.length > 5) missing.push('topQuestions>5');

  if (missing.length > 0) {
    return {
      ok: false,
      reason: isPl
        ? `Niekompletny kontrakt odpowiedzi agenta. Braki: ${missing.join(', ')}.`
        : `Incomplete agent response contract. Missing: ${missing.join(', ')}.`,
    };
  }

  return { ok: true };
}

function buildDirectedDeepeningPrompt(args: {
  decisionContext: DecisionContext;
  reviews: Array<{ agentId: string; findings: any[] }>;
  iteration: 1 | 2;
  language?: string;
}): string {
  const lang = (args.language || 'pl').split('-')[0];
  const isPl = lang === 'pl';

  const topFindings = args.reviews
    .flatMap((r) => (r.findings || []).map((f: any) => ({ agentId: r.agentId, f })))
    .filter(
      (x) =>
        x?.f?.severity === 'high' || containsMustHave((x?.f?.missingDataQuestions || []).join('\n'))
    )
    .slice(0, 8);

  const lines: string[] = [];
  lines.push(
    isPl
      ? 'ZADANIE: Zaktualizuj raport Deep Thinking, uzupełniając wyłącznie wskazane braki.'
      : 'TASK: Update the Deep Thinking report, filling ONLY the specified gaps.'
  );
  lines.push('');
  lines.push(
    isPl ? `Temat: ${args.decisionContext.topic}` : `Topic: ${args.decisionContext.topic}`
  );
  lines.push('');
  lines.push(isPl ? 'BRAKI / RYZYKA DO UZUPEŁNIENIA:' : 'GAPS / RISKS TO ADDRESS:');

  if (topFindings.length === 0) {
    lines.push(
      isPl
        ? '- Uzupełnij boundary conditions i dane wejściowe must-have.'
        : '- Add boundary conditions and must-have input data.'
    );
  } else {
    for (const { agentId, f } of topFindings) {
      lines.push(
        `- [${agentId}] (${String(f.area || 'other')}, ${String(f.severity)}) ${String(f.claim || '')}`.trim()
      );
      const q = Array.isArray(f.missingDataQuestions) ? f.missingDataQuestions.slice(0, 3) : [];
      if (q.length) {
        lines.push(isPl ? '  Pytania danych:' : '  Data questions:');
        for (const qq of q) lines.push(`  - ${String(qq)}`);
      }
      if (f.suggestedDeepening) {
        lines.push(
          isPl
            ? `  Instrukcja uzupełnienia: ${String(f.suggestedDeepening)}`
            : `  Deepening instruction: ${String(f.suggestedDeepening)}`
        );
      }
    }
  }

  lines.push('');
  lines.push(
    isPl
      ? 'WYMAGANIA: zachowaj format Deep Thinking (Executive Summary, Framing, Options, Recommendation+boundary, Risks/Assumptions, Next actions). Nie dodawaj nowych faktów bez oznaczenia jako założenia.'
      : 'REQUIREMENTS: keep the Deep Thinking format (Executive Summary, Framing, Options, Recommendation+boundary, Risks/Assumptions, Next actions). Do not add new facts unless marked as assumptions.'
  );

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// HP-2 (Harvey-Parity Blok A): audit-specific adapter for the generic agent
// runtime (`agentRuntime/agentRuntimeService.ts`). This block wires the SAME
// logic that used to live inline in `runAgentAudit` into an
// `AgentRuntimeDefinition`. Event type strings, log prefix, prompt text, gate
// logic and validators are byte-identical to the pre-HP-2 implementation —
// only the plan/adapt/interact/aggregate loop moved to the generic runtime.
// ─────────────────────────────────────────────────────────────────────────────

const AUDIT_EVENT_TYPES = {
  state: 'agent_audit_state',
  reviewProgress: 'agent_review_progress',
  sources: 'agent_sources',
} as const;

function resolveAuditAgent(agentId: string): AgentDefinition | null {
  return getAgentDefinition(agentId);
}

async function gatherAuditSources(ctx: {
  runArgs: ReviewArgs;
  agentId: string;
  agentMeta: unknown;
  orchestratorRunId: string;
  emit: (payload: Record<string, unknown>) => void;
}): Promise<{ kb: SourceUsed[]; web: SourceUsed[]; allowedWebUrls: Set<string> }> {
  const def = ctx.agentMeta as AgentDefinition;
  const args = ctx.runArgs;

  const kbQueryParts: string[] = [];
  kbQueryParts.push(String(args.decisionContext?.topic || ''));
  if (args.decisionContext?.industry)
    kbQueryParts.push(`industry: ${String(args.decisionContext.industry)}`);
  if (args.decisionContext?.horizon)
    kbQueryParts.push(`horizon: ${String(args.decisionContext.horizon)}`);
  kbQueryParts.push(`agent: ${def.displayName?.en || def.id}`);
  if (Array.isArray(def.defaultRiskAreas) && def.defaultRiskAreas.length) {
    kbQueryParts.push(`riskAreas: ${def.defaultRiskAreas.join(', ')}`);
  }
  const kbQuery = kbQueryParts.filter(Boolean).join('\n');
  ctx.emit({
    type: AUDIT_EVENT_TYPES.reviewProgress,
    orchestratorRunId: ctx.orchestratorRunId,
    agentId: ctx.agentId,
    stage: 'kb_retrieval',
  });
  const kbSources = await retrieveAgentAuditKnowledge({
    organizationId: args.organizationId || null,
    agentId: ctx.agentId,
    query: kbQuery,
    limit: 4,
  });
  if (kbSources.length) {
    ctx.emit({
      type: AUDIT_EVENT_TYPES.sources,
      orchestratorRunId: ctx.orchestratorRunId,
      agentId: ctx.agentId,
      kind: 'kb',
      sources: kbSources,
    });
  }

  const webQuery = [
    String(args.decisionContext?.topic || ''),
    args.decisionContext?.industry ? `industry: ${String(args.decisionContext.industry)}` : '',
    `agent: ${def.displayName?.en || def.id}`,
    Array.isArray(def.defaultRiskAreas) && def.defaultRiskAreas.length
      ? `riskAreas: ${def.defaultRiskAreas.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const webSources = await retrieveAgentAuditWebSources({
    enabled: args.webSearchEnabled === true,
    agentId: ctx.agentId,
    query: webQuery,
    language: args.language,
    maxResults: 4,
  });
  if (webSources.length) {
    ctx.emit({
      type: AUDIT_EVENT_TYPES.sources,
      orchestratorRunId: ctx.orchestratorRunId,
      agentId: ctx.agentId,
      kind: 'web',
      sources: webSources,
    });
  }

  const allowedWebUrls = new Set(
    webSources
      .filter((s) => s.type === 'web_source')
      .map((s: any) => String(s.url || '').trim())
      .filter(Boolean)
  );

  return { kb: kbSources, web: webSources, allowedWebUrls };
}

function buildAuditPrompt(args: {
  runArgs: ReviewArgs;
  agentId: string;
  agentMeta: unknown;
  kbSources: unknown[];
  webSources: unknown[];
}): { system: string; user: string } {
  const def = args.agentMeta as AgentDefinition;
  const runArgs = args.runArgs;
  const langCode = (runArgs.language || 'pl').split('-')[0];
  const isPl = langCode === 'pl';
  const dt = normalizeText(runArgs.deepThinkingReport);

  const sys = [
    def.systemIdentityPrompt,
    '',
    'KB_SOURCES_JSON:',
    JSON.stringify(args.kbSources, null, 2),
    '',
    'WEB_SOURCES_JSON:',
    JSON.stringify(args.webSources, null, 2),
    '',
    isPl
      ? 'Jesteś agentem-audytorem. Twoim zadaniem jest audyt JAKOŚCI i RYZYK raportu Deep Thinking, nie tworzenie rozwiązań.'
      : 'You are an audit agent. Your job is to audit QUALITY and RISKS of the Deep Thinking report, not to create solutions.',
    isPl
      ? 'Zasady: nie dodawaj faktów spoza raportu. Każde ryzyko poprzyj cytatem/fragmentem z DT w evidenceFromDT.'
      : 'Rules: do not add facts outside the report. For each risk, include evidenceFromDT from the DT report.',
    isPl
      ? 'KONTRAKT ODPOWIEDZI (MUST): observations[], challengedAssumptions[], impactIfIgnored, whenItFails, topQuestions[] (<=5), findings[].'
      : 'RESPONSE CONTRACT (MUST): observations[], challengedAssumptions[], impactIfIgnored, whenItFails, topQuestions[] (<=5), findings[].',
    isPl
      ? 'ZAKAZ: nie dawaj rekomendacji wdrożeniowych ani "zrób X". Jesteś audytorem jakości/ryzyk, nie konsultantem od wdrożeń.'
      : 'FORBIDDEN: do not give implementation recommendations or "do X". You are a risk/quality auditor, not an implementation consultant.',
    isPl
      ? 'Transparentność: w sourcesUsed dla każdego finding podaj listę źródeł użytych do wniosku: dt_section / kb_snippet / web_source. Jeśli nie masz KB/web, użyj dt_section.'
      : 'Transparency: for each finding, fill sourcesUsed with the sources used for the claim: dt_section / kb_snippet / web_source. If no KB/web available, use dt_section.',
    isPl
      ? 'Jeśli używasz KB: w sourcesUsed dodaj kb_snippet i skopiuj docId/title/version/score ze "KB_SOURCES_JSON" (zero halucynacji identyfikatorów).'
      : 'If you use KB: in sourcesUsed add kb_snippet and copy docId/title/version/score from KB_SOURCES_JSON (no hallucinated identifiers).',
    isPl
      ? 'Jeśli używasz WWW: wolno cytować WYŁĄCZNIE źródła z "WEB_SOURCES_JSON". Jeśli cytujesz URL, MUSI być w sourcesUsed jako web_source. Nie wolno wklejać żadnych innych linków.'
      : 'If you use the web: you may cite ONLY sources from WEB_SOURCES_JSON. If you cite a URL, it MUST appear in sourcesUsed as web_source. Do not include any other links.',
    isPl
      ? 'Jeśli brakuje danych, dodaj pytania w missingDataQuestions. Pytania must-have oznacz prefiksem "MUST:".'
      : 'If data is missing, add questions to missingDataQuestions. Mark must-have questions with the "MUST:" prefix.',
    isPl
      ? 'W suggestedDeepening podaj JEDNĄ ukierunkowaną instrukcję uzupełnienia raportu (nie "myśl dalej").'
      : 'In suggestedDeepening provide ONE directed instruction to fill the gap (not "think more").',
    isPl
      ? 'Zwróć WYŁĄCZNIE poprawny JSON zgodny ze schematem.'
      : 'Return ONLY valid JSON matching the schema.',
  ].join('\n');

  const user = [
    isPl ? 'Kontekst decyzji:' : 'Decision context:',
    JSON.stringify(runArgs.decisionContext || {}, null, 2),
    '',
    isPl ? 'Raport Deep Thinking (zamknięty):' : 'Deep Thinking report (closed):',
    dt,
  ].join('\n');

  return { system: sys, user };
}

function postProcessAuditReview(args: {
  raw: unknown;
  agentId: string;
  agentMeta: unknown;
  runArgs: ReviewArgs;
}): AuditReview {
  const def = args.agentMeta as AgentDefinition;
  const parsed = AgentReviewSchema.parse({
    ...(args.raw as any),
    agentId: args.agentId,
    agentVersion: def.version || '1',
  });
  // Ensure sourcesUsed is never empty for transparency (fallback to DT evidence)
  const withSources = {
    ...parsed,
    findings: (parsed.findings || []).map((f: any) => ({
      ...f,
      sourcesUsed:
        Array.isArray(f.sourcesUsed) && f.sourcesUsed.length > 0
          ? f.sourcesUsed
          : fallbackSourcesUsedFromDT(f.evidenceFromDT || []),
    })),
  };
  return withSources;
}

function applyAuditValidation(args: {
  review: AuditReview;
  results: Array<{ ok: boolean; reason?: string }>;
}): { review: AuditReview; hard: boolean } {
  const [webValidation, contractValidation, recValidation] = args.results;
  const hard = args.results.some((r) => r.ok === false);
  return {
    review: {
      ...args.review,
      overreach: hard ? 'hard' : (args.review as any).overreach || 'none',
      overreachReason:
        webValidation?.ok === false
          ? webValidation.reason
          : contractValidation?.ok === false
            ? contractValidation.reason
            : recValidation?.ok === false
              ? recValidation.reason
              : (args.review as any).overreachReason,
    } as AuditReview,
    hard,
  };
}

function aggregateAuditVerdict(args: {
  runArgs: ReviewArgs;
  reviews: AuditReview[];
  orchestratorRunId: string;
}): OrchestratorVerdict {
  return aggregateVerdict({
    decisionContext: args.runArgs.decisionContext,
    reviews: args.reviews,
    userIntent: args.runArgs.userIntent || 'validate',
    iteration: args.runArgs.loopIteration || 1,
    language: args.runArgs.language,
    forceDepthDiff: args.runArgs.forceDepthDiff || null,
  });
}

const AUDIT_AGENT_RUNTIME_DEFINITION: AgentRuntimeDefinition<
  ReviewArgs,
  AuditReview,
  OrchestratorVerdict
> = {
  type: 'audit',
  intents: ['validate', 'stress_test', 'approve'],
  steps: ['plan', 'gather_sources', 'build_prompt', 'interact_llm', 'validate', 'aggregate'],
  capability: 'chat_simple',
  logPrefix: '[AgentAudit]',
  eventTypes: AUDIT_EVENT_TYPES,
  resolveAgent: resolveAuditAgent,
  gatherSources: gatherAuditSources,
  buildPrompt: buildAuditPrompt,
  schema: AgentReviewSchema,
  postProcess: postProcessAuditReview,
  validators: [
    ({ review, allowedWebUrls, runArgs }) =>
      validateReviewWebSources({
        review,
        allowedWebUrls,
        webSearchEnabled: runArgs.webSearchEnabled === true,
      }),
    ({ review, runArgs }) =>
      validateAgentContractCompleteness({ review, language: runArgs.language || 'pl' }),
    ({ review, runArgs }) =>
      validateNoSolutionRecommendations({ review, language: runArgs.language || 'pl' }),
  ],
  applyValidation: applyAuditValidation,
  aggregate: aggregateAuditVerdict,
  describeVerdictForEmit: (verdict) => ({
    qualityStatus: verdict.qualityStatus,
    gatesTriggered: verdict.gatesTriggered,
  }),
  onRunStart: ({ runArgs, orchestratorRunId }) => {
    if (runArgs.organizationId && runArgs.userId) {
      void logAgentAuditEvent({
        organizationId: runArgs.organizationId,
        userId: runArgs.userId,
        runId: orchestratorRunId,
        conversationId: runArgs.conversationId || null,
        eventType: 'run_started',
        payload: {
          agentsCount: Array.isArray(runArgs.agentIds) ? runArgs.agentIds.length : 0,
          userIntent: runArgs.userIntent || 'validate',
          loopIteration: runArgs.loopIteration || 1,
          webSearchEnabled: Boolean(runArgs.webSearchEnabled),
        },
      });
      if ((runArgs.loopIteration || 1) > 1) {
        void logAgentAuditEvent({
          organizationId: runArgs.organizationId,
          userId: runArgs.userId,
          runId: orchestratorRunId,
          conversationId: runArgs.conversationId || null,
          eventType: 'loop_iteration',
          payload: { loopIteration: runArgs.loopIteration || 1 },
        });
      }
    }
  },
};

/**
 * Runs the audit agent. As of HP-2 this is a thin adapter over the generic
 * `runAgentRuntime` — the audit agent is ONE INSTANCE of `AgentRuntimeDefinition`,
 * not a bespoke pipeline. External behaviour (exports, emitted event shapes,
 * gates, validators) is unchanged from the pre-HP-2 implementation.
 */
export async function runAgentAudit(args: ReviewArgs): Promise<{
  orchestratorRunId: string;
  reviews: AuditReview[];
  verdict: OrchestratorVerdict;
}> {
  const dt = normalizeText(args.deepThinkingReport);
  if (!dt) throw new Error('deepThinkingReport is required');
  return runAgentRuntime(AUDIT_AGENT_RUNTIME_DEFINITION, args);
}

export function aggregateVerdict(args: {
  decisionContext: DecisionContext;
  reviews: Array<ReturnType<typeof AgentReviewSchema.parse>>;
  userIntent: 'validate' | 'stress_test' | 'approve';
  iteration: 1 | 2;
  language?: string;
  forceDepthDiff?: {
    isSubstantiallyDifferent: boolean;
    jaccardSimilarity?: number;
    rubricDelta?: number;
    newAxesDetected?: boolean;
    failReasons?: string[];
  } | null;
}): OrchestratorVerdict {
  const gates = new Set<'A' | 'B' | 'C' | 'D'>();
  const gateExplanations: GateExplanation[] = [];
  const actionableFollowups: OrchestratorVerdict['actionableFollowups'] = [];

  // Gate D: exclude hard-overreach agent outputs
  const validReviews = args.reviews.filter((r) => {
    if (r.overreach === 'hard') {
      gates.add('D');
      gateExplanations.push({
        gate: 'D',
        reason:
          String((r as any).overreachReason || '').trim() ||
          `Odrzucono output agenta ${r.agentId} (hard overreach / niedozwolone cytowania).`,
        triggeredBy: { agentId: r.agentId },
      });
      return false;
    }
    return true;
  });

  // If all agent outputs were rejected, audit cannot pass.
  if (args.reviews.length > 0 && validReviews.length === 0) {
    gates.add('D');
    gateExplanations.push({
      gate: 'D',
      reason: 'Wszystkie wyniki agentów zostały odrzucone (policy/overreach). Audyt nieważny.',
    });
    return {
      qualityStatus: 'FAIL',
      gatesTriggered: [...gates],
      gateExplanations,
      agentsSummary: [],
      sourcesSummary: {
        counts: { dt_section: 0, kb_snippet: 0, web_source: 0 },
        kb: [],
        web: [],
      },
      criticalRisks: [],
      actionableFollowups: [],
      directedLoop: {
        iteration: args.iteration,
        deepThinkingPrompt: buildDirectedDeepeningPrompt({
          decisionContext: args.decisionContext,
          reviews: [],
          iteration: args.iteration,
          language: args.language,
        }),
      },
    };
  }

  const agentsSummary = validReviews.map((r) => ({
    agentId: String(r.agentId || ''),
    agentVersion: String((r as any).agentVersion || '1'),
  }));

  const sourcesSummary: OrchestratorVerdict['sourcesSummary'] = {
    counts: { dt_section: 0, kb_snippet: 0, web_source: 0 },
    kb: [],
    web: [],
  };
  const seenKb = new Set<string>();
  const seenWeb = new Set<string>();
  for (const r of validReviews) {
    const findings = Array.isArray((r as any).findings) ? (r as any).findings : [];
    for (const f of findings) {
      const su = Array.isArray(f?.sourcesUsed) ? f.sourcesUsed : [];
      for (const s of su) {
        if (!s?.type) continue;
        if (s.type === 'dt_section') sourcesSummary.counts.dt_section += 1;
        if (s.type === 'kb_snippet') {
          sourcesSummary.counts.kb_snippet += 1;
          const key = `${String(s.kbId || '')}:${String(s.docId || '')}`;
          if (!seenKb.has(key) && s.kbId && s.docId) {
            seenKb.add(key);
            sourcesSummary.kb.push({
              kbId: String(s.kbId),
              docId: String(s.docId),
              title: String(s.title || 'KB'),
              version: s.version ? String(s.version) : undefined,
            });
          }
        }
        if (s.type === 'web_source') {
          sourcesSummary.counts.web_source += 1;
          const url = String(s.url || '').trim();
          if (url && !seenWeb.has(url)) {
            seenWeb.add(url);
            sourcesSummary.web.push({
              url,
              title: s.title ? String(s.title) : undefined,
              domain: s.domain ? String(s.domain) : undefined,
            });
          }
        }
      }
    }
  }

  // Flatten findings with metadata
  const findings = validReviews.flatMap((r) =>
    (r.findings || []).map((f) => ({ agentId: r.agentId, ...f }))
  );

  // Gate C: missing must-have data
  const mustHaveQs = findings.flatMap((f) =>
    (f.missingDataQuestions || []).filter(containsMustHave)
  );
  if (mustHaveQs.length > 0) gates.add('C');
  if (mustHaveQs.length > 0) {
    gateExplanations.push({
      gate: 'C',
      reason: `Brak danych must-have (${mustHaveQs.length}). Uzupełnij dane przed decyzją.`,
    });
  }

  // Force-depth hard fail (spec): if directed deepening did not materially deepen the report
  // then quality must FAIL even if no other gate triggers.
  if (
    args.iteration >= 2 &&
    args.forceDepthDiff &&
    args.forceDepthDiff.isSubstantiallyDifferent === false
  ) {
    gates.add('C');
    gateExplanations.push({
      gate: 'C',
      reason:
        'Ukierunkowane pogłębienie nie wniosło realnej różnicy (force-depth: odpowiedź zbyt podobna). ' +
        `Powód: ${(args.forceDepthDiff.failReasons || []).join(', ') || 'n/a'}.`,
    });
  }

  // Gate A: 1× high finance from CFO (or finance risk area)
  const cfoHigh = findings.some(
    (f) =>
      f.agentId === 'function.cfo_finance' &&
      f.severity === 'high' &&
      riskAreaIsFinance(f.area as any)
  );
  if (cfoHigh) gates.add('A');
  if (cfoHigh) {
    const f = findings.find(
      (x) =>
        x.agentId === 'function.cfo_finance' &&
        x.severity === 'high' &&
        riskAreaIsFinance(x.area as any)
    );
    gateExplanations.push({
      gate: 'A',
      reason: 'Krytyczne ryzyko finansowe (CFO/Risk) — wymagane uzupełnienie przed decyzją.',
      triggeredBy: f
        ? {
            agentId: f.agentId,
            area: f.area as any,
            severity: 'high',
            claim: String(f.claim || ''),
          }
        : { agentId: 'function.cfo_finance' },
    });
  }

  // Gate B: 2× high in same area from different agents
  const highByArea = new Map<RiskArea, Set<string>>();
  for (const f of findings) {
    if (f.severity !== 'high') continue;
    const a = (f.area || 'other') as RiskArea;
    const set = highByArea.get(a);
    if (set) {
      set.add(String(f.agentId || ''));
    } else {
      highByArea.set(a, new Set([String(f.agentId || '')]));
    }
  }
  for (const [_area, agents] of highByArea.entries()) {
    const distinctAgents = [...agents].filter(Boolean);
    if (distinctAgents.length >= 2) {
      gates.add('B');
      break;
    }
  }
  if (gates.has('B')) {
    gateExplanations.push({
      gate: 'B',
      reason:
        'Konsensus krytycznego ryzyka: ≥2 niezależne role wskazują HIGH w tym samym obszarze.',
    });
  }

  // Critical risks = all high
  const criticalRisks = findings.filter((f) => f.severity === 'high');

  // Followups: missingDataQuestions (limit, dedupe)
  const followupSet = new Set<string>();
  for (const f of findings) {
    for (const q of f.missingDataQuestions || []) {
      const qq = String(q || '').trim();
      if (!qq) continue;
      if (followupSet.has(qq)) continue;
      followupSet.add(qq);
      actionableFollowups.push({
        id: uuidv4(),
        owner: 'user',
        question: qq,
        whyCritical: `Agent ${f.agentId} wskazuje brak danych dla obszaru ${String(f.area || 'other')}.`,
      });
      if (actionableFollowups.length >= 12) break;
    }
    if (actionableFollowups.length >= 12) break;
  }

  const shouldFail = gates.has('A') || gates.has('B') || gates.has('C');
  const hasAnyRisk = findings.some((f) => f.severity === 'medium' || f.severity === 'high');

  const qualityStatus: OrchestratorVerdict['qualityStatus'] = shouldFail
    ? 'FAIL'
    : hasAnyRisk
      ? 'PASS_WITH_RISKS'
      : 'PASS';

  const directedLoop =
    qualityStatus === 'FAIL' && args.iteration < 2
      ? {
          iteration: args.iteration,
          deepThinkingPrompt: buildDirectedDeepeningPrompt({
            decisionContext: args.decisionContext,
            reviews: validReviews,
            iteration: args.iteration,
            language: args.language,
          }),
        }
      : null;

  return {
    qualityStatus,
    gatesTriggered: [...gates],
    gateExplanations,
    agentsSummary,
    sourcesSummary,
    criticalRisks,
    actionableFollowups,
    directedLoop,
  };
}
