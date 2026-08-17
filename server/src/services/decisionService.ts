/**
 * Decision Service
 * FLOW-DECISION-001: Core decision management - "Heart of Consultify"
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';
import { withPgTransaction } from '../utils/queryHelpers.js';

// ==========================================
// TYPES
// ==========================================

export interface Decision {
  id: string;
  organizationId: string;
  projectId?: string;
  initiativeId?: string;
  taskId?: string;
  title: string;
  description?: string;
  type: 'GO_NO_GO' | 'APPROVAL' | 'RESOURCE_ALLOCATION' | 'OTHER';
  decisionMakerId: string;
  options: DecisionOption[];
  criteria?: string;
  deadline?: string;
  escalationDeadline?: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired' | 'cancelled';
  selectedOption?: string;
  decisionRationale?: string;
  decidedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
}

export interface CreateDecisionInput {
  organizationId: string;
  projectId?: string;
  initiativeId?: string;
  taskId?: string;
  title: string;
  description?: string;
  type: 'GO_NO_GO' | 'APPROVAL' | 'RESOURCE_ALLOCATION' | 'OTHER';
  decisionMakerId: string;
  options?: DecisionOption[];
  criteria?: string;
  deadline?: string;
  stakeholderIds?: string[];
  createdBy: string;
  idempotencyKey?: string;
  sourceType?: string;
  sourceId?: string;
  /** Internal acceptance hook; never exposed by an HTTP schema. */
  faultInjection?: 'AFTER_CORE' | 'AFTER_HISTORY';
}

export interface MakeDecisionInput {
  decisionId: string;
  selectedOption: string;
  rationale?: string;
  decidedBy: string;
}

// ==========================================
// AI SECTION GENERATION (wzorzec N — karty Decyzji)
// ==========================================
//
// Decision cards have NO `decision_section_types` table (unlike Initiative's
// `initiative_section_types.ai_prompt_template`). Per _WZORZEC_N §12 / P0.2 the
// prompts live as CODE CONSTANTS here — the BCG per-card instructions from
// `_ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md §2`, wrapped by the BCG doctrine (§0)
// in the system prompt. AI proposes → human reviews/edits/accepts in the UI;
// nothing here auto-mutates or transitions the decision.

/** Section keys aligned with the DecisionDetailView N-cards (camelCase). */
export type DecisionSectionKey = 'description' | 'alternatives' | 'risk' | 'consequencesOfInaction';

/** BCG doctrine (§0) — one system prompt for every Decision card. */
const DECISION_DOCTRINE_SYSTEM_PROMPT_PL = `Jesteś partnerem konsultingowym poziomu BCG, przygotowującym JEDNĄ kartę (sekcję) decyzji dla kadry zarządzającej.
REGUŁY BEZWZGLĘDNE (złamanie = FAIL):
1. ANSWER-FIRST (piramida Minto): pierwsze zdanie niesie konkluzję/tezę, nie rozgrzewkę.
2. MECE: listy wzajemnie wykluczające się i wyczerpujące; brak nakładania i luk.
3. KWANTYFIKACJA Z JAWNYM ZAŁOŻENIEM: każda liczba ma źródło LUB oznaczenie „szacunek: [założenie]". Nigdy gołe liczby.
4. UGRUNTOWANIE: opieraj się TYLKO na dostarczonym kontekście decyzji. NIE zmyślaj faktów o firmie.
5. ZERO FILLERA: bez ozdobników, każde zdanie niesie informację.
6. FALSYFIKOWALNOŚĆ: tezy testowalne („Jeśli X, to Y, bo Z"), nie życzeniowe.
7. UCZCIWA NIEPEWNOŚĆ: gdy brak danych — powiedz wprost + co trzeba zbadać.
8. JĘZYK: cała proza po POLSKU (wyjątek: akronimy/metodyki: RACI, RAID, KPI, MECE, ROI, CAPEX, OPEX).
Anty-wzorce = FAIL: ogólniki bez liczb, listy 1-elementowe tam gdzie wymagane ≥2, „TBD" bez planu uzupełnienia, przepisanie tytułu jako treści.
Gdy proszą o JSON — zwróć WYŁĄCZNIE poprawny JSON (bez markdown, bez komentarza). Gdy o prozę — answer-first.`;

const DECISION_DOCTRINE_SYSTEM_PROMPT_EN = `You are a BCG-grade consulting partner drafting ONE card (section) of an executive decision.
ABSOLUTE RULES (breaking any = FAIL):
1. ANSWER-FIRST (Minto pyramid): the first sentence carries the conclusion, not a preamble.
2. MECE: lists mutually exclusive and collectively exhaustive; no overlaps, no gaps.
3. QUANTIFICATION WITH EXPLICIT ASSUMPTIONS: every number has a source OR is marked "estimate: [assumption]". Never bare numbers.
4. GROUNDING: rely ONLY on the supplied decision context. Do NOT fabricate facts about the company.
5. ZERO FILLER: no ornament; every sentence carries information.
6. FALSIFIABILITY: testable claims ("If X, then Y, because Z"), not wishful.
7. HONEST UNCERTAINTY: when data is missing, say so + what must be investigated.
Anti-patterns = FAIL: generic claims without numbers, single-item lists where ≥2 are required, "TBD" without a plan, restating the title as content.
When JSON is requested — return ONLY valid JSON (no markdown, no commentary). When prose — answer-first.`;

/**
 * Per-card USER prompt instructions (BCG §2). `{{title}}`, `{{description}}`,
 * `{{context}}`, `{{alternatives}}`, `{{risks}}`, `{{language}}` are interpolated
 * from the decision record. Prose sections return prose; structured sections
 * request JSON with the exact shape the UI already consumes.
 */
const DECISION_SECTION_PROMPTS: Record<
  DecisionSectionKey,
  { returnsJson: boolean; template: string }
> = {
  // Description/Context — problem decyzyjny 1 zdanie + tło + „dlaczego TERAZ".
  description: {
    returnsJson: false,
    template: `Napisz kartę „Opis / Kontekst" tej decyzji (proza, {{language}}).
Struktura (answer-first): (1) problem decyzyjny w JEDNYM zdaniu — co dokładnie jest rozstrzygane; (2) tło 2–3 zdania (fakty z kontekstu, bez zmyślania); (3) dlaczego TERAZ — koszt zwłoki (skwantyfikowany z założeniem, jeśli brak danych → „do ustalenia: [co]").
Tytuł decyzji: {{title}}
Dotychczasowy opis: {{description}}
Dodatkowy kontekst: {{context}}`,
  },
  // Alternatives — ≥2 realne opcje + „nie robić nic", każda pros/cons MECE + koszt/czas.
  alternatives: {
    returnsJson: true,
    template: `Zaproponuj realne opcje decyzyjne. Zwróć WYŁĄCZNIE poprawny JSON:
{"alternatives":[{"title":"...","description":"...","pros":["...","..."],"cons":["...","..."],"estimatedCostTime":"..."}]}
Wymogi: ≥2 realne opcje PLUS zawsze opcja „Nie robić nic" z jej konsekwencją. pros[] i cons[] MECE, ≥2 pozycje każda, konkretne (nie ogólniki). estimatedCostTime = rząd wielkości + jednostka + założenie (np. „~150k PLN, 3 mies., zakł. 2 FTE").
Tytuł decyzji: {{title}}
Opis/kontekst: {{description}} {{context}}
Język treści: {{language}}`,
  },
  // Risk/Impact — wpływ na scope/schedule/cost/quality (low/med/high) + uzasadnienie.
  risk: {
    returnsJson: true,
    template: `Oceń ryzyko i wpływ tej decyzji. Zwróć WYŁĄCZNIE poprawny JSON:
{"risks":[{"title":"...","probability":"low|medium|high","impact":"low|medium|high","category":"scope|schedule|cost|quality|business|operational","mitigation":"...","contingency":"..."}]}
Wymogi: ≥2 ryzyka. mitigation (prewencja) ≠ contingency (plan B). Każde ryzyko z konkretnym, krótkim uzasadnieniem w title/mitigation. Pokryj wpływ na scope/schedule/cost/quality tam gdzie istotny.
Tytuł decyzji: {{title}}
Opis/kontekst: {{description}} {{context}}
Rozważane opcje: {{alternatives}}
Język treści: {{language}}`,
  },
  // Consequences of Inaction — najważniejsza karta: co jeśli NIE zdecydujemy + REKOMENDACJA + horyzont.
  consequencesOfInaction: {
    returnsJson: false,
    template: `Napisz kartę „Konsekwencje bezczynności + Rekomendacja" (proza, {{language}}). To NAJWAŻNIEJSZA karta — tu konsultant mówi co zrobić.
Struktura (answer-first): (1) co się stanie, jeśli decyzja NIE zostanie podjęta — konkretne konsekwencje w horyzoncie 7/30/90 dni (skwantyfikowane z założeniem); (2) JEDNA rekomendacja, jednoznaczna i uzasadniona (dlaczego ta opcja, nie inne); (3) horyzont realizacji rekomendacji.
Tytuł decyzji: {{title}}
Opis/kontekst: {{description}} {{context}}
Opcje: {{alternatives}}
Ryzyka: {{risks}}`,
  },
};

let _decisionLlmInstance: any = null;
async function getDecisionLLM(): Promise<any> {
  if (_decisionLlmInstance) return _decisionLlmInstance;
  try {
    const mod = await import('./ai/llmService.js');
    _decisionLlmInstance = (mod as any).llmService || (mod as any).default;
    return _decisionLlmInstance;
  } catch {
    logger.warn('[DecisionService] LLM Service not available');
    return null;
  }
}

function interpolateDecisionTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key) => {
    const v = vars[key];
    if (v === undefined || v === null || v === '') return '[nie podano]';
    return String(v);
  });
}

export interface GenerateDecisionSectionResult {
  sectionKey: DecisionSectionKey;
  /** Raw model text (prose sections) or the JSON string (structured sections). */
  content: string;
  isJson: boolean;
  /** Parsed JSON for structured sections (undefined for prose / parse failure). */
  parsedContent?: any;
  model: string;
  tokensUsed: number;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class DecisionService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Create a new decision request
   */
  async createDecision(input: CreateDecisionInput): Promise<Decision> {
    if (input.idempotencyKey && input.sourceType === 'myw_agent_proposal') return this.createIdempotentDecision(input);
    const db = await this.getDb();
    if (input.idempotencyKey) {
      const replay = await db.get<{id:string;source_type?:string;source_id?:string}>(
        `SELECT id,source_type,source_id FROM decisions WHERE organization_id=? AND idempotency_key=?`,
        [input.organizationId,input.idempotencyKey]);
      if (replay) {
        if (replay.source_type!==input.sourceType || replay.source_id!==input.sourceId) throw new Error('DECISION_IDEMPOTENCY_COLLISION');
        return this.getDecision(replay.id) as Promise<Decision>;
      }
    }
    const id = `decision-${uuidv4()}`;
    const now = new Date().toISOString();

    // Calculate escalation deadline (default: 7 days after deadline)
    const deadline = input.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const escalationDeadline = new Date(
      new Date(deadline).getTime() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Default options for GO_NO_GO
    const options =
      input.options ||
      (input.type === 'GO_NO_GO'
        ? [
            { id: 'go', label: 'Go', description: 'Proceed' },
            { id: 'no-go', label: 'No-Go', description: 'Do not proceed' },
          ]
        : [
            { id: 'approve', label: 'Approve' },
            { id: 'reject', label: 'Reject' },
          ]);

    await db.run(
      `INSERT INTO decisions (
                id, organization_id, project_id, initiative_id, task_id,
                title, description, type, decision_maker_id,
                options, criteria, deadline, escalation_deadline,
                status, created_by, created_at, updated_at, idempotency_key, source_type, source_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.projectId || null,
        input.initiativeId || null,
        input.taskId || null,
        input.title,
        input.description || null,
        input.type,
        input.decisionMakerId,
        JSON.stringify(options),
        input.criteria || null,
        deadline,
        escalationDeadline,
        input.createdBy,
        now,
        now,
        input.idempotencyKey || null,
        input.sourceType || null,
        input.sourceId || null,
      ]
    );

    // Add stakeholders
    if (input.stakeholderIds && input.stakeholderIds.length > 0) {
      for (const stakeholderId of input.stakeholderIds) {
        await db.run(
          `INSERT INTO decision_stakeholders (id, decision_id, user_id, role)
                     VALUES (?, ?, ?, 'informed')`,
          [uuidv4(), id, stakeholderId]
        );
      }
    }

    // Record history
    await this.recordHistory(id, 'created', null, 'pending', input.createdBy);

    // Send notification to decision maker
    await this.notifyDecisionMaker(id, input.decisionMakerId, input.title);

    logger.info(`[DecisionService] Created decision ${id}: ${input.title}`);

    return this.getDecision(id) as Promise<Decision>;
  }

  /**
   * Durable canonical command path used by approved materialization. Each
   * committed step is idempotently resumed after a process crash; replay never
   * returns merely because the core row exists.
   */
  private async createIdempotentDecision(input: CreateDecisionInput): Promise<Decision> {
    const commandKey = input.idempotencyKey!;
    const options = input.options || (input.type === 'GO_NO_GO'
      ? [{id:'go',label:'Go',description:'Proceed'},{id:'no-go',label:'No-Go',description:'Do not proceed'}]
      : [{id:'approve',label:'Approve'},{id:'reject',label:'Reject'}]);
    const deadline = input.deadline || new Date(Date.now()+7*24*60*60*1000).toISOString();
    const escalationDeadline = new Date(new Date(deadline).getTime()+7*24*60*60*1000).toISOString();
    const targetId = await withPgTransaction(async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?))`,[`decision-command:${input.organizationId}:${commandKey}`]);
      const existing = await tx.query<any>(`SELECT id,source_type,source_id FROM decisions
        WHERE organization_id=? AND idempotency_key=? AND source_type='myw_agent_proposal'`,[input.organizationId,commandKey]);
      if (existing.rows[0]) {
        if (existing.rows[0].source_type!==input.sourceType || existing.rows[0].source_id!==input.sourceId) {
          throw new Error('DECISION_IDEMPOTENCY_COLLISION');
        }
        return existing.rows[0].id as string;
      }
      const id=`decision-${uuidv4()}`, now=new Date().toISOString();
      await tx.query(`INSERT INTO decisions (id,organization_id,project_id,initiative_id,task_id,title,description,type,
        decision_maker_id,options,criteria,deadline,escalation_deadline,status,created_by,created_at,updated_at,
        idempotency_key,source_type,source_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?)`,
      [id,input.organizationId,input.projectId||null,input.initiativeId||null,input.taskId||null,input.title,input.description||null,
        input.type,input.decisionMakerId,JSON.stringify(options),input.criteria||null,deadline,escalationDeadline,input.createdBy,now,now,
        commandKey,input.sourceType||null,input.sourceId||null]);
      return id;
    });
    if (input.faultInjection==='AFTER_CORE') throw new Error('DECISION_TEST_CRASH_AFTER_CORE');

    await withPgTransaction(async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?))`,[`decision-command:${input.organizationId}:${commandKey}`]);
      for (const stakeholderId of input.stakeholderIds || []) {
        await tx.query(`INSERT INTO decision_stakeholders(id,decision_id,user_id,role)
          SELECT ?,?,?, 'informed' WHERE NOT EXISTS(SELECT 1 FROM decision_stakeholders WHERE decision_id=? AND user_id=?)`,
        [uuidv4(),targetId,stakeholderId,targetId,stakeholderId]);
      }
      await tx.query(`INSERT INTO decision_history(id,decision_id,action,old_status,new_status,changed_by,details)
        SELECT ?,?,'created',NULL,'pending',?,NULL WHERE NOT EXISTS(
          SELECT 1 FROM decision_history WHERE decision_id=? AND action='created' AND changed_by=?)`,
      [uuidv4(),targetId,input.createdBy,targetId,input.createdBy]);
    });
    if (input.faultInjection==='AFTER_HISTORY') throw new Error('DECISION_TEST_CRASH_AFTER_HISTORY');

    await withPgTransaction(async (tx) => {
      await tx.query(`INSERT INTO myw_agent_canonical_outbox(organization_id,command_key,target_kind,target_id,event_type,payload)
        VALUES(?,?, 'decision',?,'decision.created',?::jsonb) ON CONFLICT(organization_id,command_key,event_type) DO NOTHING`,
      [input.organizationId,commandKey,targetId,JSON.stringify({decisionMakerId:input.decisionMakerId,title:input.title})]);
    });
    logger.info(`[DecisionService] Created/reconciled decision ${targetId}: ${input.title}`);
    return this.getDecision(targetId) as Promise<Decision>;
  }

  /**
   * Get a decision by ID
   */
  async getDecision(id: string): Promise<Decision | null> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      organization_id: string;
      project_id: string | null;
      initiative_id: string | null;
      task_id: string | null;
      title: string;
      description: string | null;
      type: string;
      decision_maker_id: string;
      options: string;
      criteria: string | null;
      deadline: string | null;
      escalation_deadline: string | null;
      status: string;
      selected_option: string | null;
      decision_rationale: string | null;
      decided_at: string | null;
      created_by: string;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM decisions WHERE id = ?', [id]);

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id || undefined,
      initiativeId: row.initiative_id || undefined,
      taskId: row.task_id || undefined,
      title: row.title,
      description: row.description || undefined,
      type: row.type as Decision['type'],
      decisionMakerId: row.decision_maker_id,
      options: JSON.parse(row.options || '[]'),
      criteria: row.criteria || undefined,
      deadline: row.deadline || undefined,
      escalationDeadline: row.escalation_deadline || undefined,
      status: row.status as Decision['status'],
      selectedOption: row.selected_option || undefined,
      decisionRationale: row.decision_rationale || undefined,
      decidedAt: row.decided_at || undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Make a decision
   */
  async makeDecision(input: MakeDecisionInput): Promise<Decision> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const decision = await this.getDecision(input.decisionId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    if (decision.status !== 'pending' && decision.status !== 'escalated') {
      throw new Error(`Cannot make decision in status: ${decision.status}`);
    }

    const normalizedOption = input.selectedOption.toLowerCase();
    const nextStatus =
      normalizedOption === 'reject' || normalizedOption === 'no-go' ? 'rejected' : 'approved';

    await db.run(
      `UPDATE decisions SET
                status = ?,
                selected_option = ?,
                decision_rationale = ?,
                decided_at = ?,
                updated_at = ?
             WHERE id = ?`,
      [nextStatus, input.selectedOption, input.rationale || null, now, now, input.decisionId]
    );

    // Record history
    await this.recordHistory(
      input.decisionId,
      'decided',
      decision.status,
      nextStatus,
      input.decidedBy,
      {
        selectedOption: input.selectedOption,
        rationale: input.rationale,
      }
    );

    // Notify requester and stakeholders
    await this.notifyDecisionMade(input.decisionId, decision);

    // Unblock related task/initiative if applicable
    await this.unblockRelatedItems(decision);

    // AI Learning - record this decision for pattern learning
    await this.recordForAILearning(decision, input);

    logger.info(`[DecisionService] Decision ${input.decisionId} made: ${input.selectedOption}`);

    return this.getDecision(input.decisionId) as Promise<Decision>;
  }

  /**
   * Get pending decisions for a user (as decision maker)
   */
  async getPendingDecisions(userId: string, orgId: string): Promise<Decision[]> {
    const db = await this.getDb();

    const rows = await db.all<{
      id: string;
      organization_id: string;
      project_id: string | null;
      initiative_id: string | null;
      task_id: string | null;
      title: string;
      description: string | null;
      type: string;
      decision_maker_id: string;
      options: string;
      deadline: string | null;
      status: string;
      created_at: string;
    }>(
      `SELECT * FROM decisions 
             WHERE organization_id = ? 
             AND decision_maker_id = ? 
             AND status IN ('pending', 'escalated')
             ORDER BY deadline ASC`,
      [orgId, userId]
    );

    return (rows || []).map(
      (row) =>
        ({
          id: row.id,
          organizationId: row.organization_id,
          projectId: row.project_id || undefined,
          initiativeId: row.initiative_id || undefined,
          taskId: row.task_id || undefined,
          title: row.title,
          description: row.description || undefined,
          type: row.type as Decision['type'],
          decisionMakerId: row.decision_maker_id,
          options: JSON.parse(row.options || '[]'),
          deadline: row.deadline || undefined,
          status: row.status as Decision['status'],
          createdAt: row.created_at,
        }) as Decision
    );
  }

  /**
   * Escalate a decision
   */
  async escalateDecision(
    decisionId: string,
    escalatedBy: string,
    reason?: string
  ): Promise<Decision> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const decision = await this.getDecision(decisionId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    if (decision.status !== 'pending') {
      throw new Error(`Cannot escalate decision in status: ${decision.status}`);
    }

    await db.run(
      `UPDATE decisions SET
                status = 'escalated',
                updated_at = ?
             WHERE id = ?`,
      [now, decisionId]
    );

    // Record history
    await this.recordHistory(decisionId, 'escalated', 'pending', 'escalated', escalatedBy, {
      reason,
    });

    // TODO: Notify next-level decision maker
    logger.info(`[DecisionService] Decision ${decisionId} escalated`);

    return this.getDecision(decisionId) as Promise<Decision>;
  }

  /**
   * Cancel a decision
   */
  async cancelDecision(
    decisionId: string,
    cancelledBy: string,
    reason?: string
  ): Promise<Decision> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const decision = await this.getDecision(decisionId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    if (
      decision.status === 'approved' ||
      decision.status === 'rejected' ||
      decision.status === 'cancelled'
    ) {
      throw new Error(`Cannot cancel a decision in status: ${decision.status}`);
    }

    await db.run(
      `UPDATE decisions SET
                status = 'cancelled',
                updated_at = ?
             WHERE id = ?`,
      [now, decisionId]
    );

    await this.recordHistory(decisionId, 'cancelled', decision.status, 'cancelled', cancelledBy, {
      reason,
    });

    logger.info(`[DecisionService] Decision ${decisionId} cancelled`);

    return this.getDecision(decisionId) as Promise<Decision>;
  }

  /**
   * Get decisions for a project
   */
  async getProjectDecisions(projectId: string, orgId: string): Promise<Decision[]> {
    const db = await this.getDb();

    const rows = await db.all<{ id: string }>(
      `SELECT id FROM decisions 
             WHERE organization_id = ? AND project_id = ?
             ORDER BY created_at DESC`,
      [orgId, projectId]
    );

    const decisions: Decision[] = [];
    for (const row of rows || []) {
      const decision = await this.getDecision(row.id);
      if (decision) decisions.push(decision);
    }

    return decisions;
  }

  /**
   * Get decision history
   */
  async getDecisionHistory(decisionId: string): Promise<
    {
      id: string;
      action: string;
      oldStatus: string | null;
      newStatus: string | null;
      changedBy: string;
      changedAt: string;
      details: Record<string, unknown>;
    }[]
  > {
    const db = await this.getDb();

    const rows = await db.all<{
      id: string;
      action: string;
      old_status: string | null;
      new_status: string | null;
      changed_by: string;
      changed_at: string;
      details: string | null;
    }>(`SELECT * FROM decision_history WHERE decision_id = ? ORDER BY changed_at ASC`, [
      decisionId,
    ]);

    return (rows || []).map((row) => ({
      id: row.id,
      action: row.action,
      oldStatus: row.old_status,
      newStatus: row.new_status,
      changedBy: row.changed_by,
      changedAt: row.changed_at,
      details: row.details ? JSON.parse(row.details) : {},
    }));
  }

  /**
   * Process expired decisions (called by cron)
   */
  async processExpiredDecisions(): Promise<{ expired: number; escalated: number }> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const results = { expired: 0, escalated: 0 };

    // Get decisions past escalation deadline that should expire
    const toExpire = await db.all<{ id: string }>(
      `SELECT id FROM decisions 
             WHERE status = 'escalated' 
             AND escalation_deadline < ?`,
      [now]
    );

    for (const row of toExpire || []) {
      await db.run(`UPDATE decisions SET status = 'expired', updated_at = ? WHERE id = ?`, [
        now,
        row.id,
      ]);
      await this.recordHistory(row.id, 'expired', 'escalated', 'expired', 'system');
      results.expired++;
    }

    // Get decisions past deadline that should be escalated
    const toEscalate = await db.all<{ id: string }>(
      `SELECT id FROM decisions 
             WHERE status = 'pending' 
             AND deadline < ?`,
      [now]
    );

    for (const row of toEscalate || []) {
      await this.escalateDecision(row.id, 'system', 'Auto-escalated: deadline passed');
      results.escalated++;
    }

    if (results.expired > 0 || results.escalated > 0) {
      logger.info(
        `[DecisionService] Processed: ${results.escalated} escalated, ${results.expired} expired`
      );
    }

    return results;
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private async recordHistory(
    decisionId: string,
    action: string,
    oldStatus: string | null,
    newStatus: string | null,
    changedBy: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const db = await this.getDb();
    await db.run(
      `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        decisionId,
        action,
        oldStatus,
        newStatus,
        changedBy,
        details ? JSON.stringify(details) : null,
      ]
    );
  }

  private async notifyDecisionMaker(
    decisionId: string,
    decisionMakerId: string,
    title: string
  ): Promise<void> {
    try {
      // TODO: Integrate with notification service
      logger.info(
        `[DecisionService] Notification sent to ${decisionMakerId} for decision ${decisionId}`
      );
    } catch (err) {
      logger.warn(`[DecisionService] Failed to notify decision maker:`, err);
    }
  }

  private async notifyDecisionMade(decisionId: string, decision: Decision): Promise<void> {
    try {
      // TODO: Notify requester and stakeholders
      logger.info(`[DecisionService] Decision made notification sent for ${decisionId}`);
    } catch (err) {
      logger.warn(`[DecisionService] Failed to notify decision made:`, err);
    }
  }

  /**
   * Generate BCG-grade draft content for ONE decision card (wzorzec N).
   *
   * Grounds the prompt in the live decision record (title/description/context/
   * options/risks) and calls the PREMIUM LLM tier with the BCG doctrine system
   * prompt. Returns the draft to the caller — the UI shows it as `ai-draft` for
   * the human to review/edit/accept. This method NEVER writes to the DB; it is a
   * pure proposer (AI proposes → human accepts), matching the Decision N-card
   * lifecycle and the Initiative generation pattern.
   *
   * @param decisionId  target decision (org-scoped check done by the controller)
   * @param sectionKey  one of DECISION_SECTION_PROMPTS keys
   * @param opts.language 'pl' | 'en' (defaults to 'pl')
   * @param opts.context extra free-text context (Additional context field)
   */
  async generateSection(
    decisionId: string,
    sectionKey: DecisionSectionKey,
    opts?: { language?: 'pl' | 'en'; context?: string }
  ): Promise<GenerateDecisionSectionResult> {
    const spec = DECISION_SECTION_PROMPTS[sectionKey];
    if (!spec) {
      throw new Error(`Unknown decision section "${sectionKey}"`);
    }

    const decision = await this.getDecision(decisionId);
    if (!decision) {
      throw new Error(`Decision "${decisionId}" not found`);
    }

    const language = opts?.language === 'en' ? 'en' : 'pl';
    const optionsSummary = Array.isArray(decision.options)
      ? decision.options
          .map((o) => `${o.label}${o.description ? ` — ${o.description}` : ''}`)
          .join('; ')
      : '';

    const userPrompt = interpolateDecisionTemplate(spec.template, {
      title: decision.title || '',
      description: decision.description || '',
      context: opts?.context || decision.criteria || '',
      alternatives: optionsSummary,
      risks: decision.decisionRationale || '',
      language: language === 'pl' ? 'Polish' : 'English',
    });

    // FIX (naprawa-r8Hygiene, DEFEKT #1) — reguła temporalna. r6a naprawił daty
    // przeszłe tylko w initiativeGenerationService; createDecision → generateSection
    // NIE miał żadnej reguły, więc karty decyzji recyklingowały przeszłe terminy
    // ("Q1 2024", "15 stycznia 2024") w projekcie 2026+. Doklejamy TĘ SAMĄ regułę
    // (dynamiczny rok z zegara serwera) do system-promptu decyzji, tak jak r6a robi
    // to dla inicjatyw. Reguła nie starzeje się (rok liczony przy każdym wywołaniu).
    const { buildTemporalRule } = await import('./initiativeGenerationService.js');
    const systemPrompt =
      (language === 'pl'
        ? DECISION_DOCTRINE_SYSTEM_PROMPT_PL
        : DECISION_DOCTRINE_SYSTEM_PROMPT_EN) + buildTemporalRule(language === 'pl');

    const llm = await getDecisionLLM();
    if (!llm) {
      // Honest degraded path — no LLM provider configured.
      const msg =
        language === 'pl'
          ? '[Sekcja wymaga skonfigurowanego dostawcy AI. Spróbuj ponownie później.]'
          : '[This section requires a configured AI provider. Please try again later.]';
      return {
        sectionKey,
        content: msg,
        isJson: false,
        parsedContent: undefined,
        model: 'placeholder',
        tokensUsed: 0,
      };
    }

    const result = await llm.call({
      type: 'text',
      modelConfig: { id: 'premium' },
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 3072,
      temperature: 0.4,
      cache: true,
      cacheTtl: 3600,
      timeoutMs: 150000,
    });

    const content = String(result?.content || '');
    const usage = (result?.usage || {}) as Record<string, number>;
    const tokensUsed =
      usage.totalTokens || usage.completionTokens || Math.floor(content.length / 4);
    const model = String(result?.model || result?.modelId || 'llm-premium');

    let parsedContent: any = undefined;
    if (spec.returnsJson) {
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
        parsedContent = JSON.parse(jsonMatch[1] || content);
      } catch {
        parsedContent = undefined;
      }
    }

    return {
      sectionKey,
      content,
      isJson: spec.returnsJson,
      parsedContent,
      model,
      tokensUsed,
    };
  }

  private async unblockRelatedItems(decision: Decision): Promise<void> {
    // TODO: Update task/initiative status to unblocked
    if (decision.taskId) {
      logger.info(`[DecisionService] Unblocking task ${decision.taskId}`);
    }
    if (decision.initiativeId) {
      logger.info(`[DecisionService] Unblocking initiative ${decision.initiativeId}`);
    }
  }

  private async recordForAILearning(decision: Decision, input: MakeDecisionInput): Promise<void> {
    try {
      // TODO: Send to AI learning system
      logger.info(`[DecisionService] Recording decision for AI learning: ${decision.id}`);
    } catch (err) {
      logger.warn(`[DecisionService] Failed to record for AI learning:`, err);
    }
  }
}

// Export singleton
const decisionService = new DecisionService();
export default decisionService;

// Named exports
export const createDecision = (input: CreateDecisionInput) => decisionService.createDecision(input);
export const getDecision = (id: string) => decisionService.getDecision(id);
export const makeDecision = (input: MakeDecisionInput) => decisionService.makeDecision(input);
export const getPendingDecisions = (userId: string, orgId: string) =>
  decisionService.getPendingDecisions(userId, orgId);
export const escalateDecision = (id: string, by: string, reason?: string) =>
  decisionService.escalateDecision(id, by, reason);
export const cancelDecision = (id: string, by: string, reason?: string) =>
  decisionService.cancelDecision(id, by, reason);
export const getProjectDecisions = (projectId: string, orgId: string) =>
  decisionService.getProjectDecisions(projectId, orgId);
export const getDecisionHistory = (id: string) => decisionService.getDecisionHistory(id);
export const generateDecisionSection = (
  decisionId: string,
  sectionKey: DecisionSectionKey,
  opts?: { language?: 'pl' | 'en'; context?: string }
) => decisionService.generateSection(decisionId, sectionKey, opts);
export const processExpiredDecisions = () => decisionService.processExpiredDecisions();
