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
    })();
  }
  await ensureTablesPromise;
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

function buildSeedCandidates(input: {
  sessionId: string;
  organizationId: string;
  userId?: string | null;
  session: Record<string, any>;
}): Array<Omit<InitiativeWizardCandidate, 'id' | 'createdAt' | 'updatedAt'>> {
  const priorities = parseArray<string>(input.session.business_priorities_json);
  const sources = parseArray(input.session.source_basket_json);
  const notes = String(input.session.manual_notes || '').trim();
  const horizon = String(input.session.time_horizon || '90_days');
  const targetCount = Math.min(Math.max(Number(input.session.target_count || 5), 1), 10);
  const contextLabel =
    notes || priorities.length > 0
      ? [notes, priorities.length ? `Priorytety: ${priorities.join(', ')}` : '']
          .filter(Boolean)
          .join('\n')
      : 'Wybrane zrodla wskazuja na potrzebe uporzadkowania transformacji.';

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
      timeToValueScore: horizon === '30_days' ? 5 : 4,
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
  ];

  return base.slice(0, targetCount).map((candidate) => ({
    wizardSessionId: input.sessionId,
    title: candidate.title,
    problemStatement: candidate.problemStatement,
    opportunityStatement: candidate.opportunityStatement,
    rationale: `Kandydat wygenerowany z trybu konsultingowego. Kontekst:\n${contextLabel}`,
    confidenceLevel: sources.length > 0 || notes ? 'medium' : 'low',
    limits:
      sources.length > 0 || notes
        ? ['Wymaga potwierdzenia ownera i baseline KPI przed review.']
        : ['Brak wybranych mocnych zrodel. Traktowac jako hipoteze warsztatowa.'],
    impactScore: candidate.impactScore,
    effortScore: candidate.effortScore,
    riskScore: candidate.riskScore,
    timeToValueScore: candidate.timeToValueScore,
    strategicFitScore: priorities.length > 0 ? 4 : 3,
    suggestedOwner: null,
    suggestedKpi: candidate.suggestedKpi,
    firstStep: 'Zweryfikowac zakres, ownera i baseline na warsztacie decyzyjnym.',
    initiativeLevel: candidate.initiativeLevel,
    triageStatus: 'new_candidate' as InitiativeCandidateTriageStatus,
    triageReason: null,
    linkedInitiativeId: null,
    sourceRefs: sources,
    evidenceRefs: [],
  }));
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
  const candidates = buildSeedCandidates({
    sessionId: params.sessionId,
    organizationId: params.organizationId,
    userId: params.userId,
    session,
  });

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
  return row ? mapCandidate(row) : null;
}
