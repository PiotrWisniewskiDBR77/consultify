import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';

export type InitiativeWizardMode =
  | 'create_first_portfolio'
  | 'generate_from_evidence'
  | 'prioritize_by_goal'
  | 'match_existing'
  | 'refresh_portfolio'
  | 'build_waves'
  | 'improve_portfolio';

export type InitiativeCandidateTriageStatus =
  | 'new_candidate'
  | 'accepted_for_shortlist'
  | 'rejected'
  | 'needs_evidence'
  | 'needs_split'
  | 'needs_merge'
  | 'needs_rewrite'
  | 'already_covered'
  | 'ready_for_charter';

export interface InitiativeWizardSessionInput {
  projectId?: string | null;
  mode?: InitiativeWizardMode;
  businessPriorities?: string[];
  targetCount?: number | null;
  timeHorizon?: string | null;
  riskAppetite?: string | null;
  sourceBasket?: unknown[];
  manualNotes?: string | null;
}

export interface InitiativeWizardCandidate {
  id: string;
  wizardSessionId: string;
  title: string;
  problemStatement: string;
  opportunityStatement: string;
  rationale: string;
  confidenceLevel: string;
  limits: string[];
  impactScore: number;
  effortScore: number;
  riskScore: number;
  timeToValueScore: number;
  strategicFitScore: number;
  suggestedOwner?: string | null;
  suggestedKpi?: string | null;
  firstStep?: string | null;
  initiativeLevel: string;
  triageStatus: InitiativeCandidateTriageStatus;
  triageReason?: string | null;
  linkedInitiativeId?: string | null;
  sourceRefs: unknown[];
  evidenceRefs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeWizardAuditEvent {
  id: string;
  organizationId: string;
  wizardSessionId: string | null;
  candidateId: string | null;
  actorId: string | null;
  eventType: string;
  eventPayload: Record<string, unknown>;
  createdAt: string;
}

let ensureTablesPromise: Promise<void> | null = null;

function stringify(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseArray<T = unknown>(value: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function safeNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function ensureTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS initiative_wizard_sessions (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT,
          mode TEXT NOT NULL,
          business_priorities_json TEXT NOT NULL DEFAULT '[]',
          target_count INTEGER,
          time_horizon TEXT,
          risk_appetite TEXT,
          source_basket_json TEXT NOT NULL DEFAULT '[]',
          manual_notes TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          created_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS initiative_wizard_candidates (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          wizard_session_id TEXT NOT NULL,
          title TEXT NOT NULL,
          problem_statement TEXT NOT NULL,
          opportunity_statement TEXT NOT NULL,
          rationale_text TEXT NOT NULL,
          confidence_level TEXT NOT NULL DEFAULT 'medium',
          limits_json TEXT NOT NULL DEFAULT '[]',
          impact_score INTEGER NOT NULL DEFAULT 3,
          effort_score INTEGER NOT NULL DEFAULT 3,
          risk_score INTEGER NOT NULL DEFAULT 3,
          time_to_value_score INTEGER NOT NULL DEFAULT 3,
          strategic_fit_score INTEGER NOT NULL DEFAULT 3,
          suggested_owner TEXT,
          suggested_kpi TEXT,
          first_step TEXT,
          initiative_level TEXT NOT NULL DEFAULT 'standard',
          triage_status TEXT NOT NULL DEFAULT 'new_candidate',
          triage_reason TEXT,
          linked_initiative_id TEXT,
          source_refs_json TEXT NOT NULL DEFAULT '[]',
          evidence_refs_json TEXT NOT NULL DEFAULT '[]',
          created_by TEXT,
          updated_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_initiative_wizard_candidates_session
         ON initiative_wizard_candidates(wizard_session_id)`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_initiative_wizard_candidates_status
         ON initiative_wizard_candidates(triage_status)`
      );
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS initiative_wizard_audit_events (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          wizard_session_id TEXT,
          candidate_id TEXT,
          actor_id TEXT,
          event_type TEXT NOT NULL,
          event_payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_initiative_wizard_audit_session
         ON initiative_wizard_audit_events(wizard_session_id, created_at)`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_initiative_wizard_audit_candidate
         ON initiative_wizard_audit_events(candidate_id, created_at)`
      );
    })();
  }
  await ensureTablesPromise;
}

async function recordWizardAuditEvent(input: {
  organizationId: string;
  wizardSessionId?: string | null;
  candidateId?: string | null;
  actorId?: string | null;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  await queryHelpers.queryRun(
    `INSERT INTO initiative_wizard_audit_events
     (id, organization_id, wizard_session_id, candidate_id, actor_id, event_type, event_payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `iwa_${uuidv4()}`,
      input.organizationId,
      input.wizardSessionId || null,
      input.candidateId || null,
      input.actorId || null,
      input.eventType,
      stringify(input.payload || {}),
      new Date().toISOString(),
    ]
  );
}

function mapCandidate(row: Record<string, any>): InitiativeWizardCandidate {
  return {
    id: String(row.id),
    wizardSessionId: String(row.wizard_session_id),
    title: String(row.title || ''),
    problemStatement: String(row.problem_statement || ''),
    opportunityStatement: String(row.opportunity_statement || ''),
    rationale: String(row.rationale_text || ''),
    confidenceLevel: String(row.confidence_level || 'medium'),
    limits: parseArray<string>(row.limits_json),
    impactScore: safeNumber(row.impact_score, 3),
    effortScore: safeNumber(row.effort_score, 3),
    riskScore: safeNumber(row.risk_score, 3),
    timeToValueScore: safeNumber(row.time_to_value_score, 3),
    strategicFitScore: safeNumber(row.strategic_fit_score, 3),
    suggestedOwner: row.suggested_owner || null,
    suggestedKpi: row.suggested_kpi || null,
    firstStep: row.first_step || null,
    initiativeLevel: String(row.initiative_level || 'standard'),
    triageStatus: String(row.triage_status || 'new_candidate') as InitiativeCandidateTriageStatus,
    triageReason: row.triage_reason || null,
    linkedInitiativeId: row.linked_initiative_id || null,
    sourceRefs: parseArray(row.source_refs_json),
    evidenceRefs: parseArray<string>(row.evidence_refs_json),
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function parseObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mapAuditEvent(row: Record<string, any>): InitiativeWizardAuditEvent {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    wizardSessionId: row.wizard_session_id || null,
    candidateId: row.candidate_id || null,
    actorId: row.actor_id || null,
    eventType: String(row.event_type || ''),
    eventPayload: parseObject(row.event_payload_json),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

// =====================================================
// Evidence-driven candidate generation (P0 #6)
// =====================================================
//
// The wizard MUST generate candidates from real sourceBasket evidence (interview
// insights, findings, tools/assessment results, etc.) instead of returning the
// same five hardcoded templates for every session. Per INITIATIVE_CANONICAL_STANDARD §14
// and FINAL_IMPLEMENTATION_PLAN_10, every candidate has to carry lineage to the
// originating P10 finding/insight (`evidenceRefs`, `sourceRefs`) and inherit
// `confidenceLevel` + `limits` from that source so that a contradicted finding
// blocks downstream automation.
//
// We still keep a small pool of consultant-style "portfolio hygiene" templates as
// a deterministic fallback for greenfield (no evidence) sessions and to top up
// the longlist when the user asks for more candidates than the basket provides.

const CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low', 'insufficient', 'contradicted']);

const ANCHORED_EVIDENCE_TYPES = new Set([
  'interview_insight',
  'interview_finding',
  'interview_session',
  'tools_session',
  'assessment_result',
  'canvas_artifact',
  'kpi_finding',
  'finance_insight',
  'manual_note',
]);

const SOURCE_TYPE_LABELS: Record<string, string> = {
  interview_insight: 'wywiad / insight',
  interview_finding: 'wywiad / finding',
  interview_session: 'wywiad / sesja',
  tools_session: 'narzedzia / sesja',
  assessment_result: 'assessment',
  canvas_artifact: 'canvas / artefakt',
  kpi_finding: 'KPI / finding',
  finance_insight: 'finanse / insight',
  manual_note: 'notatka recznie',
};

interface NormalizedSourceItem {
  type: string;
  id: string;
  title: string;
  description?: string;
  confidence?: string;
  status?: string;
  limits: string[];
  evidencePointers: string[];
  raw: Record<string, unknown>;
}

function normalizeSourceItems(rawItems: unknown[]): NormalizedSourceItem[] {
  const out: NormalizedSourceItem[] = [];
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const type = typeof obj.type === 'string' ? obj.type : '';
    const id = typeof obj.id === 'string' ? obj.id : '';
    if (!type || !id) continue;
    const titleRaw = obj.title || obj.name || obj.summary || obj.headline;
    const title = typeof titleRaw === 'string' && titleRaw.trim() ? String(titleRaw).trim() : '';
    if (!title) continue;
    const descRaw = obj.description || obj.summary;
    const confidenceRaw =
      typeof obj.confidence === 'string'
        ? obj.confidence
        : typeof obj.confidenceLevel === 'string'
          ? obj.confidenceLevel
          : null;
    const confidence =
      confidenceRaw && CONFIDENCE_LEVELS.has(String(confidenceRaw).toLowerCase())
        ? String(confidenceRaw).toLowerCase()
        : undefined;
    const status = typeof obj.status === 'string' ? obj.status : undefined;
    const limits = parseArray<string>(obj.limits)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    const evidencePointers = [
      ...parseArray<string>(obj.evidencePointers).map((entry) => String(entry || '').trim()),
      ...parseArray<string>(obj.evidence_pointers).map((entry) => String(entry || '').trim()),
      ...parseArray<string>(obj.sourceSessionIds).map((entry) => String(entry || '').trim()),
    ]
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index);
    out.push({
      type,
      id,
      title,
      description: typeof descRaw === 'string' ? descRaw : undefined,
      confidence,
      status,
      limits,
      evidencePointers,
      raw: obj,
    });
  }
  return out;
}

function strategicFit(priorities: string[]): number {
  if (!priorities.length) return 3;
  if (priorities.length >= 3) return 5;
  return 4;
}

function timeToValueFromHorizon(horizon: string): number {
  if (horizon === '30_days') return 5;
  if (horizon === '60_days') return 4;
  if (horizon === '90_days') return 4;
  if (horizon === '180_days') return 3;
  return 3;
}

function impactFromConfidence(confidence: string | undefined): number {
  switch (confidence) {
    case 'high':
      return 5;
    case 'medium':
      return 4;
    case 'low':
      return 3;
    case 'insufficient':
      return 2;
    case 'contradicted':
      return 2;
    default:
      return 3;
  }
}

function effortFromType(type: string): number {
  if (type === 'manual_note') return 2;
  if (type === 'interview_session' || type === 'tools_session') return 3;
  if (type === 'assessment_result' || type === 'kpi_finding' || type === 'finance_insight')
    return 4;
  if (type === 'canvas_artifact') return 3;
  return 3;
}

function buildEvidenceDrivenCandidate(
  source: NormalizedSourceItem,
  context: {
    sessionId: string;
    priorities: string[];
    horizon: string;
    notesSnippet: string;
    riskAppetite: string;
  }
): Omit<InitiativeWizardCandidate, 'id' | 'createdAt' | 'updatedAt'> {
  const labelType = SOURCE_TYPE_LABELS[source.type] || source.type;
  const baseLimits =
    source.limits.length > 0
      ? source.limits
      : ['Wymaga potwierdzenia ownera i baseline KPI przed review.'];
  if (
    source.confidence === 'insufficient' &&
    !source.limits.includes('Brak wystarczajacych dowodow.')
  ) {
    baseLimits.push('Brak wystarczajacych dowodow w zrodle - rozszerzyc evidence przed approve.');
  }
  if (source.confidence === 'contradicted') {
    baseLimits.push('Zrodlo oznaczone jako sprzeczne - approve zablokowany do czasu rozwiazania.');
  }
  const evidenceRefs = [source.id, ...source.evidencePointers].filter(
    (value, index, arr) => arr.indexOf(value) === index
  );
  const sourceRefs: Record<string, unknown>[] = [
    {
      type: source.type,
      id: source.id,
      title: source.title,
      ...(source.confidence ? { confidence: source.confidence } : {}),
      ...(source.status ? { status: source.status } : {}),
      ...(source.evidencePointers.length > 0 ? { evidencePointers: source.evidencePointers } : {}),
    },
  ];
  const baseTitle = source.title.length > 80 ? `${source.title.slice(0, 77)}...` : source.title;
  const titlePrefix = source.confidence === 'contradicted' ? '[Wymaga rozstrzygniecia] ' : '';
  const candidateTitle = `${titlePrefix}${baseTitle}`;
  const description = source.description ? `\nSzczegoly z zrodla: ${source.description}` : '';
  const problemStatement = `Z analizy materialu (${labelType}) wynika obszar do rozstrzygniecia: ${source.title}.${description}`;
  const opportunityStatement = `Przekuc obserwacje "${source.title}" w zarzadzalna inicjatywe transformacyjna z ownerem, KPI i evidence trail.`;
  const rationaleParts = [
    `Kandydat wygenerowany z konkretnego zrodla (${labelType}) - id ${source.id}.`,
    source.confidence
      ? `Confidence ze zrodla: ${source.confidence}.`
      : 'Confidence niesprecyzowany w zrodle - traktowac ostroznie.',
    context.notesSnippet ? `Kontekst: ${context.notesSnippet}` : '',
  ].filter(Boolean);
  const initiativeLevel =
    source.confidence === 'high'
      ? 'strategic'
      : source.confidence === 'low' || source.confidence === 'insufficient'
        ? 'quick_win'
        : 'standard';
  const initialTriage: InitiativeCandidateTriageStatus =
    source.confidence === 'contradicted'
      ? 'needs_evidence'
      : source.confidence === 'insufficient'
        ? 'needs_evidence'
        : 'new_candidate';
  return {
    wizardSessionId: context.sessionId,
    title: candidateTitle,
    problemStatement,
    opportunityStatement,
    rationale: rationaleParts.join('\n'),
    confidenceLevel: source.confidence || 'medium',
    limits: baseLimits,
    impactScore: impactFromConfidence(source.confidence),
    effortScore: effortFromType(source.type),
    riskScore:
      source.confidence === 'contradicted' ? 5 : context.riskAppetite === 'aggressive' ? 4 : 3,
    timeToValueScore: timeToValueFromHorizon(context.horizon),
    strategicFitScore: strategicFit(context.priorities),
    suggestedOwner: null,
    suggestedKpi:
      source.type === 'kpi_finding' || source.type === 'finance_insight'
        ? `Walidacja KPI ze zrodla "${source.title}"`
        : 'Owner + baseline KPI ustalone na warsztacie decyzyjnym',
    firstStep:
      'Zweryfikowac zakres, ownera i baseline na warsztacie decyzyjnym z evidence ze zrodla.',
    initiativeLevel,
    triageStatus: initialTriage,
    triageReason:
      initialTriage === 'needs_evidence'
        ? `Confidence "${source.confidence}" ze zrodla wymaga uzupelnienia evidence przed approve.`
        : null,
    linkedInitiativeId: null,
    sourceRefs,
    evidenceRefs,
  };
}

function buildPortfolioHygieneCandidates(
  sessionId: string,
  count: number,
  context: {
    priorities: string[];
    horizon: string;
    notesSnippet: string;
  }
): Array<Omit<InitiativeWizardCandidate, 'id' | 'createdAt' | 'updatedAt'>> {
  const base = [
    {
      title: 'Zbudowac jedno zrodlo prawdy dla priorytetow transformacji',
      problemStatement:
        'Obserwacje wskazuja na rozproszone priorytety, brak jednej listy tematow i trudnosc w ustaleniu, ktore dzialania maja najwiekszy efekt.',
      opportunityStatement:
        'Stworzyc zarzadzalny portfel inicjatyw z ownerami, KPI i regularnym review.',
      suggestedKpi: 'Odsetek inicjatyw z ownerem, KPI i statusem review',
      initiativeLevel: 'standard',
      impactScore: 4,
      effortScore: 2,
      riskScore: 2,
      timeToValueScore: context.horizon === '30_days' ? 5 : 4,
    },
    {
      title: 'Wprowadzic standard wlascicielstwa i decyzji dla tematow miedzydzialowych',
      problemStatement:
        'Czesc tematow blokuje sie miedzy funkcjami, bo brakuje jasnego wlasciciela, eskalacji albo zapisanego punktu decyzyjnego.',
      opportunityStatement:
        'Ustanowic model owner, decision, next step i escalation dla kluczowych tematow transformacyjnych.',
      suggestedKpi: 'Odsetek tematow z przypisanym ownerem i nastepnym krokiem',
      initiativeLevel: 'quick_win',
      impactScore: 4,
      effortScore: 2,
      riskScore: 2,
      timeToValueScore: 5,
    },
    {
      title: 'Powiazac KPI z inicjatywami i walidacja wartosci',
      problemStatement:
        'Inicjatywy bez baseline, targetu i wlasciciela wartosci trudno ocenic i utrzymac w programie transformacji.',
      opportunityStatement:
        'Dodac baseline, target, sposob pomiaru i value ownera do inicjatyw wybranych do realizacji.',
      suggestedKpi: 'Odsetek aktywnych inicjatyw z baseline i target KPI',
      initiativeLevel: 'standard',
      impactScore: 4,
      effortScore: 3,
      riskScore: 2,
      timeToValueScore: 4,
    },
    {
      title: 'Uruchomic kwartalny rytm przegladu portfela transformacji',
      problemStatement:
        'Nowe wywiady, dokumenty i assessmenty moga powtarzac te same tematy lub zmieniac priorytety, ale portfel musi byc aktualizowany bez tworzenia duplikatow.',
      opportunityStatement:
        'Wprowadzic cykl reassessment: confirm, enrich, merge, split, reprioritize.',
      suggestedKpi: 'Liczba duplikatow / czas od nowego evidence do decyzji portfolio',
      initiativeLevel: 'standard',
      impactScore: 3,
      effortScore: 2,
      riskScore: 2,
      timeToValueScore: 4,
    },
    {
      title: 'Ograniczyc reczna integracje danych i raportowania',
      problemStatement:
        'Material sugeruje, ze ludzie lacza dane recznie miedzy narzedziami, plikami i raportami, co podnosi ryzyko bledow oraz opoznia decyzje.',
      opportunityStatement:
        'Zidentyfikowac procesy excel-critical i przeksztalcic je w kontrolowany workflow lub integracje danych.',
      suggestedKpi: 'Liczba recznych przepisan danych / czas przygotowania raportu',
      initiativeLevel: 'strategic',
      impactScore: 5,
      effortScore: 4,
      riskScore: 3,
      timeToValueScore: 3,
    },
  ];
  return base.slice(0, Math.max(0, count)).map((candidate) => ({
    wizardSessionId: sessionId,
    title: candidate.title,
    problemStatement: candidate.problemStatement,
    opportunityStatement: candidate.opportunityStatement,
    rationale: `Kandydat z portfela hygieny (brak konkretnego evidence). Kontekst sesji:\n${context.notesSnippet || '-'}`,
    confidenceLevel: 'low',
    limits: [
      'Brak konkretnego evidence ze zrodel - traktowac jako hipoteze warsztatowa.',
      'Wymaga potwierdzenia ownera i baseline KPI przed review.',
    ],
    impactScore: candidate.impactScore,
    effortScore: candidate.effortScore,
    riskScore: candidate.riskScore,
    timeToValueScore: candidate.timeToValueScore,
    strategicFitScore: strategicFit(context.priorities),
    suggestedOwner: null,
    suggestedKpi: candidate.suggestedKpi,
    firstStep: 'Zweryfikowac zakres, ownera i baseline na warsztacie decyzyjnym.',
    initiativeLevel: candidate.initiativeLevel,
    triageStatus: 'new_candidate' as InitiativeCandidateTriageStatus,
    triageReason: null,
    linkedInitiativeId: null,
    sourceRefs: [],
    evidenceRefs: [],
  }));
}

function buildSeedCandidates(input: {
  sessionId: string;
  organizationId: string;
  userId?: string | null;
  session: Record<string, any>;
}): {
  candidates: Array<Omit<InitiativeWizardCandidate, 'id' | 'createdAt' | 'updatedAt'>>;
  generationMode: 'evidence_driven' | 'evidence_plus_hygiene' | 'hygiene_only';
  evidenceCount: number;
  hygieneCount: number;
} {
  const priorities = parseArray<string>(input.session.business_priorities_json);
  const sources = parseArray(input.session.source_basket_json);
  const notes = String(input.session.manual_notes || '').trim();
  const horizon = String(input.session.time_horizon || '90_days');
  const riskAppetite = String(input.session.risk_appetite || 'balanced');
  const targetCount = Math.min(Math.max(Number(input.session.target_count || 5), 1), 10);
  const notesSnippet = notes.length > 240 ? `${notes.slice(0, 237)}...` : notes;

  const normalizedSources = normalizeSourceItems(sources).filter((item) =>
    ANCHORED_EVIDENCE_TYPES.has(item.type)
  );
  // Prefer findings/insights over plain sessions when present.
  const ranked = [...normalizedSources].sort((a, b) => {
    const order = (item: NormalizedSourceItem) => {
      if (item.type === 'interview_insight' || item.type === 'interview_finding') return 0;
      if (
        item.type === 'kpi_finding' ||
        item.type === 'finance_insight' ||
        item.type === 'assessment_result'
      )
        return 1;
      if (item.type === 'tools_session' || item.type === 'canvas_artifact') return 2;
      if (item.type === 'manual_note') return 3;
      return 4;
    };
    return order(a) - order(b);
  });
  const evidenceCandidates = ranked.slice(0, targetCount).map((source) =>
    buildEvidenceDrivenCandidate(source, {
      sessionId: input.sessionId,
      priorities,
      horizon,
      notesSnippet,
      riskAppetite,
    })
  );
  const remaining = Math.max(0, targetCount - evidenceCandidates.length);
  const hygieneCandidates = buildPortfolioHygieneCandidates(input.sessionId, remaining, {
    priorities,
    horizon,
    notesSnippet,
  });
  const candidates = [...evidenceCandidates, ...hygieneCandidates];
  const generationMode: 'evidence_driven' | 'evidence_plus_hygiene' | 'hygiene_only' =
    evidenceCandidates.length === 0
      ? 'hygiene_only'
      : hygieneCandidates.length === 0
        ? 'evidence_driven'
        : 'evidence_plus_hygiene';
  return {
    candidates,
    generationMode,
    evidenceCount: evidenceCandidates.length,
    hygieneCount: hygieneCandidates.length,
  };
}

export async function createWizardSession(params: {
  organizationId: string;
  userId?: string | null;
  input: InitiativeWizardSessionInput;
}) {
  await ensureTables();
  const id = `iw_${uuidv4()}`;
  const now = new Date().toISOString();
  const input = params.input || {};
  await queryHelpers.queryRun(
    `INSERT INTO initiative_wizard_sessions
     (id, organization_id, project_id, mode, business_priorities_json, target_count, time_horizon, risk_appetite, source_basket_json, manual_notes, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.organizationId,
      input.projectId || null,
      input.mode || 'create_first_portfolio',
      stringify(input.businessPriorities || []),
      input.targetCount || null,
      input.timeHorizon || null,
      input.riskAppetite || null,
      stringify(input.sourceBasket || []),
      input.manualNotes || null,
      'draft',
      params.userId || null,
      now,
      now,
    ]
  );
  await recordWizardAuditEvent({
    organizationId: params.organizationId,
    wizardSessionId: id,
    actorId: params.userId || null,
    eventType: 'wizard_session_created',
    payload: {
      mode: input.mode || 'create_first_portfolio',
      projectId: input.projectId || null,
      sourceCount: Array.isArray(input.sourceBasket) ? input.sourceBasket.length : 0,
      targetCount: input.targetCount || null,
    },
  });
  return getWizardSession(params.organizationId, id);
}

export async function getWizardSession(organizationId: string, sessionId: string) {
  await ensureTables();
  const session = await queryHelpers.queryOne(
    `SELECT * FROM initiative_wizard_sessions WHERE id = ? AND organization_id = ?`,
    [sessionId, organizationId]
  );
  if (!session) return null;
  return {
    id: session.id,
    organizationId: session.organization_id,
    projectId: session.project_id || null,
    mode: session.mode,
    businessPriorities: parseArray<string>(session.business_priorities_json),
    targetCount: session.target_count || null,
    timeHorizon: session.time_horizon || null,
    riskAppetite: session.risk_appetite || null,
    sourceBasket: parseArray(session.source_basket_json),
    manualNotes: session.manual_notes || '',
    status: session.status || 'draft',
    createdBy: session.created_by || null,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

export async function generateCandidates(params: {
  organizationId: string;
  sessionId: string;
  userId?: string | null;
}): Promise<InitiativeWizardCandidate[]> {
  await ensureTables();
  const session = await queryHelpers.queryOne(
    `SELECT * FROM initiative_wizard_sessions WHERE id = ? AND organization_id = ?`,
    [params.sessionId, params.organizationId]
  );
  if (!session) return [];

  const existing = await listCandidates(params.organizationId, params.sessionId);
  if (existing.length > 0) return existing;

  const now = new Date().toISOString();
  const built = buildSeedCandidates({
    sessionId: params.sessionId,
    organizationId: params.organizationId,
    userId: params.userId,
    session,
  });
  const candidates = built.candidates;

  for (const candidate of candidates) {
    await queryHelpers.queryRun(
      `INSERT INTO initiative_wizard_candidates
       (id, organization_id, wizard_session_id, title, problem_statement, opportunity_statement, rationale_text, confidence_level, limits_json, impact_score, effort_score, risk_score, time_to_value_score, strategic_fit_score, suggested_owner, suggested_kpi, first_step, initiative_level, triage_status, triage_reason, linked_initiative_id, source_refs_json, evidence_refs_json, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `iwc_${uuidv4()}`,
        params.organizationId,
        params.sessionId,
        candidate.title,
        candidate.problemStatement,
        candidate.opportunityStatement,
        candidate.rationale,
        candidate.confidenceLevel,
        stringify(candidate.limits),
        candidate.impactScore,
        candidate.effortScore,
        candidate.riskScore,
        candidate.timeToValueScore,
        candidate.strategicFitScore,
        candidate.suggestedOwner || null,
        candidate.suggestedKpi || null,
        candidate.firstStep || null,
        candidate.initiativeLevel,
        candidate.triageStatus,
        candidate.triageReason || null,
        candidate.linkedInitiativeId || null,
        stringify(candidate.sourceRefs),
        stringify(candidate.evidenceRefs),
        params.userId || null,
        params.userId || null,
        now,
        now,
      ]
    );
  }
  await recordWizardAuditEvent({
    organizationId: params.organizationId,
    wizardSessionId: params.sessionId,
    actorId: params.userId || null,
    eventType: 'wizard_candidates_generated',
    payload: {
      candidateCount: candidates.length,
      generationMode: built.generationMode,
      evidenceCount: built.evidenceCount,
      hygieneCount: built.hygieneCount,
    },
  });
  return listCandidates(params.organizationId, params.sessionId);
}

export async function listCandidates(
  organizationId: string,
  sessionId: string
): Promise<InitiativeWizardCandidate[]> {
  await ensureTables();
  const rows = await queryHelpers.queryAll(
    `SELECT * FROM initiative_wizard_candidates
     WHERE organization_id = ? AND wizard_session_id = ?
     ORDER BY created_at ASC`,
    [organizationId, sessionId]
  );
  return (rows || []).map(mapCandidate);
}

// =====================================================
// Shortlist gate (P0 #7)
// =====================================================
//
// Before draft initiatives can be created from accepted candidates, we MUST block
// promotion when any candidate is marked `contradicted` or carries no evidence
// references. Per FINAL_IMPLEMENTATION_PLAN_10:
//
//   "contradicted blocks automatic handoff"
//
// This service exposes a non-mutating check that the route layer / UI can call to
// short-circuit `createInitiativeWriteTruth` calls and surface honest reasons to
// the user instead of silently producing drafts that violate evidence governance.

export interface ShortlistGateBlockedReason {
  candidateId: string;
  title: string;
  reason: 'contradicted_confidence' | 'missing_evidence' | 'needs_evidence_status';
  message: string;
  confidenceLevel: string;
  triageStatus: string;
  evidenceRefsCount: number;
}

export interface ShortlistGateResult {
  ok: boolean;
  shortlistCount: number;
  blocked: ShortlistGateBlockedReason[];
}

export function evaluateShortlistGate(
  candidates: InitiativeWizardCandidate[]
): ShortlistGateResult {
  const shortlist = candidates.filter((candidate) =>
    ['accepted_for_shortlist', 'ready_for_charter'].includes(candidate.triageStatus)
  );
  const blocked: ShortlistGateBlockedReason[] = [];
  for (const candidate of shortlist) {
    const confidence = String(candidate.confidenceLevel || '').toLowerCase();
    const evidenceCount = Array.isArray(candidate.evidenceRefs) ? candidate.evidenceRefs.length : 0;
    const sourceCount = Array.isArray(candidate.sourceRefs) ? candidate.sourceRefs.length : 0;
    if (confidence === 'contradicted') {
      blocked.push({
        candidateId: candidate.id,
        title: candidate.title,
        reason: 'contradicted_confidence',
        message:
          'Confidence ze zrodla jest "contradicted". Nie mozna utworzyc draftu inicjatywy bez rozstrzygniecia sprzecznych obserwacji.',
        confidenceLevel: confidence,
        triageStatus: candidate.triageStatus,
        evidenceRefsCount: evidenceCount,
      });
      continue;
    }
    if (candidate.triageStatus === 'needs_evidence') {
      blocked.push({
        candidateId: candidate.id,
        title: candidate.title,
        reason: 'needs_evidence_status',
        message:
          'Kandydat oznaczony jako "needs_evidence" - uzupelnij evidence przed utworzeniem draftu.',
        confidenceLevel: confidence,
        triageStatus: candidate.triageStatus,
        evidenceRefsCount: evidenceCount,
      });
      continue;
    }
    // Evidence-anchored candidates (sourceRefs.length > 0) MUST carry evidenceRefs
    // - otherwise their lineage to the originating P10 finding is broken.
    // Hygiene candidates (no sourceRefs) are explicit consultant hypotheses and
    // are allowed without evidenceRefs because they were never claimed to be
    // evidence-anchored in the first place; the user still went through proposal
    // -> approval -> execution -> audit when accepting them.
    if (sourceCount > 0 && evidenceCount === 0) {
      blocked.push({
        candidateId: candidate.id,
        title: candidate.title,
        reason: 'missing_evidence',
        message:
          'Kandydat ma sourceRefs ale brak evidenceRefs. Zgodnie z kanonem zlamana lineage - uzupelnij evidence_pointers ze zrodla.',
        confidenceLevel: confidence,
        triageStatus: candidate.triageStatus,
        evidenceRefsCount: 0,
      });
    }
  }
  return {
    ok: blocked.length === 0,
    shortlistCount: shortlist.length,
    blocked,
  };
}

export async function evaluateShortlistGateForSession(
  organizationId: string,
  sessionId: string
): Promise<ShortlistGateResult> {
  const candidates = await listCandidates(organizationId, sessionId);
  return evaluateShortlistGate(candidates);
}

export async function recordShortlistGateBlocked(params: {
  organizationId: string;
  sessionId: string;
  userId?: string | null;
  result: ShortlistGateResult;
}): Promise<void> {
  if (params.result.ok) return;
  await recordWizardAuditEvent({
    organizationId: params.organizationId,
    wizardSessionId: params.sessionId,
    actorId: params.userId || null,
    eventType: 'wizard_shortlist_gate_blocked',
    payload: {
      shortlistCount: params.result.shortlistCount,
      blockedCount: params.result.blocked.length,
      reasons: params.result.blocked.map((entry) => ({
        candidateId: entry.candidateId,
        reason: entry.reason,
        confidenceLevel: entry.confidenceLevel,
        evidenceRefsCount: entry.evidenceRefsCount,
      })),
    },
  });
}

export async function recordShortlistDraftsCreated(params: {
  organizationId: string;
  sessionId: string;
  userId?: string | null;
  draftCount: number;
  candidateIds: string[];
}): Promise<void> {
  await recordWizardAuditEvent({
    organizationId: params.organizationId,
    wizardSessionId: params.sessionId,
    actorId: params.userId || null,
    eventType: 'wizard_drafts_created',
    payload: {
      draftCount: params.draftCount,
      candidateIds: params.candidateIds,
    },
  });
}

export async function listWizardAuditEvents(
  organizationId: string,
  sessionId: string
): Promise<InitiativeWizardAuditEvent[]> {
  await ensureTables();
  const rows = await queryHelpers.queryAll(
    `SELECT * FROM initiative_wizard_audit_events
     WHERE organization_id = ? AND wizard_session_id = ?
     ORDER BY created_at ASC`,
    [organizationId, sessionId]
  );
  return (rows || []).map(mapAuditEvent);
}

export async function triageCandidate(params: {
  organizationId: string;
  candidateId: string;
  userId?: string | null;
  triageStatus: InitiativeCandidateTriageStatus;
  triageReason?: string | null;
  linkedInitiativeId?: string | null;
}) {
  await ensureTables();
  const now = new Date().toISOString();
  await queryHelpers.queryRun(
    `UPDATE initiative_wizard_candidates
     SET triage_status = ?, triage_reason = ?, linked_initiative_id = ?, updated_by = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      params.triageStatus,
      params.triageReason || null,
      params.linkedInitiativeId || null,
      params.userId || null,
      now,
      params.candidateId,
      params.organizationId,
    ]
  );
  const row = await queryHelpers.queryOne(
    `SELECT * FROM initiative_wizard_candidates WHERE id = ? AND organization_id = ?`,
    [params.candidateId, params.organizationId]
  );
  if (row) {
    await recordWizardAuditEvent({
      organizationId: params.organizationId,
      wizardSessionId: String((row as any).wizard_session_id || ''),
      candidateId: params.candidateId,
      actorId: params.userId || null,
      eventType: 'wizard_candidate_triaged',
      payload: {
        triageStatus: params.triageStatus,
        triageReason: params.triageReason || null,
        linkedInitiativeId: params.linkedInitiativeId || null,
      },
    });
  }
  return row ? mapCandidate(row) : null;
}
