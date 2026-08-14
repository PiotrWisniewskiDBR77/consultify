/**
 * proposalService — Initiative Proposal Drafts (audit_initiative_proposals).
 *
 * Piąta powierzchnia audytu: przemienia POTWIERDZONE ustalenia w kandydatów
 * na inicjatywy — nigdy automatycznie z każdej niezgodności (to byłaby
 * fabryka szumu w Initiatives), zawsze na jawnie wskazanych, potwierdzonych
 * ustaleniach. Rejestracja jako inicjatywa woła KANONICZNY lejek tworzenia
 * (`createInitiativeService.createInitiative`) — nigdy własny INSERT — bo to
 * jedyne miejsce, które gwarantuje spójny kontrakt inicjatywy (status
 * startowy, kotwiczenie do projektu, bramka jakości karty, audyt).
 */

import { createInitiative } from '../initiative/createInitiativeService.js';

import {
  AuditDomainError,
  AuditNotFoundError,
  AuditStateError,
  auditAll,
  auditGet,
  auditRun,
  newId,
  parseJson,
  recordAuditEvent,
  toBool,
  toIso,
} from './auditsDb.js';
import { requireCapability } from './permissions.js';
import type {
  AuditActor,
  AuditInitiativeProposal,
  FindingStatus,
  ProposalStatus,
} from './types.js';

type Row = Record<string, unknown>;

/**
 * Ustalenia kwalifikujące się do draftu propozycji: `confirmed` lub później
 * w cyklu życia, ale NIGDY `draft`/`in_review` (jeszcze nie ustalone) ani
 * `rejected` (odrzucone — nie ma czego naprawiać).
 */
const ELIGIBLE_FINDING_STATUSES: FindingStatus[] = [
  'confirmed',
  'response_pending',
  'remediation_in_progress',
  'verification_pending',
  'closed',
  'risk_accepted',
];

const STOPWORDS = new Set([
  'oraz',
  'dla',
  'przy',
  'tego',
  'tych',
  'które',
  'który',
  'która',
  'jest',
  'były',
  'będzie',
  'przez',
  'albo',
  'czy',
  'ale',
  'nad',
  'pod',
  'oraz,',
  'oraz.',
  'jako',
  'tylko',
  'także',
  'wraz',
]);

// ---------------------------------------------------------------------------
// Mapowanie / helpers
// ---------------------------------------------------------------------------

function mapProposalRow(row: Row): AuditInitiativeProposal {
  return {
    id: String(row.id),
    programId: String(row.program_id),
    organizationId: String(row.organization_id),
    title: String(row.title),
    problemStatement: (row.problem_statement as string) ?? null,
    systemicCause: (row.systemic_cause as string) ?? null,
    intendedOutcome: (row.intended_outcome as string) ?? null,
    scope: (row.scope as string) ?? null,
    priority: (row.priority as string) ?? null,
    proposedOwnerId: (row.proposed_owner_id as string) ?? null,
    timeframe: (row.timeframe as string) ?? null,
    dependencies: (row.dependencies as string) ?? null,
    successMeasures: parseJson<string[]>(row.success_measures, []),
    sourceFindingIds: parseJson<string[]>(row.source_finding_ids, []),
    verificationLink: (row.verification_link as string) ?? null,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    status: String(row.status) as ProposalStatus,
    registeredInitiativeId: (row.registered_initiative_id as string) ?? null,
    registeredAt: toIso(row.registered_at),
    feedbackNote: (row.feedback_note as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: toIso(row.created_at) ?? String(row.created_at),
    updatedAt: toIso(row.updated_at) ?? String(row.updated_at),
  };
}

function highestSeverityToPriority(severities: string[]): string {
  if (severities.includes('critical') || severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  return 'low';
}

function buildProposalTitle(findings: Row[]): string {
  const first = String(
    findings[0]?.statement || findings[0]?.reference_code || 'ustalenie audytu'
  ).trim();
  const prefix =
    findings.length > 1
      ? `Działanie naprawcze (${findings.length} ustaleń): `
      : 'Działanie naprawcze: ';
  return `${prefix}${first}`.slice(0, 200);
}

function groupByCriterion(rows: Row[]): Record<string, Row[]> {
  const groups: Record<string, Row[]> = {};
  for (const r of rows) {
    const key = (r.criterion_id as string) || 'none';
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return groups;
}

function extractKeywords(text: string): string[] {
  const words = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return Array.from(new Set(words));
}

function normalizeInitiativePriority(
  priority: string | null
): 'critical' | 'high' | 'medium' | 'low' {
  const v = String(priority || '').toLowerCase();
  if (v === 'critical' || v === 'high' || v === 'medium' || v === 'low') return v;
  return 'medium';
}

async function insertProposalDraft(
  orgId: string,
  actor: AuditActor,
  programId: string,
  findings: Row[],
  titleOverride?: string
): Promise<AuditInitiativeProposal> {
  const title = (titleOverride || '').trim() || buildProposalTitle(findings);
  const problemStatement = findings
    .map((f) => String(f.statement || ''))
    .filter(Boolean)
    .join('\n\n');
  const rootCauses = Array.from(
    new Set(findings.map((f) => String(f.root_cause || '').trim()).filter(Boolean))
  );
  const severities = findings
    .map((f) => (f.severity as string) || null)
    .filter(Boolean) as string[];
  const priority = highestSeverityToPriority(severities);
  const sourceFindingIds = findings.map((f) => String(f.id));

  const id = newId('aprop');
  await auditRun(
    `INSERT INTO audit_initiative_proposals
       (id, program_id, organization_id, title, problem_statement, systemic_cause,
        priority, success_measures, source_finding_ids, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10)`,
    [
      id,
      programId,
      orgId,
      title,
      problemStatement || null,
      rootCauses.join('; ') || null,
      priority,
      JSON.stringify([]),
      JSON.stringify(sourceFindingIds),
      actor.userId,
    ]
  );

  await recordAuditEvent({
    organizationId: orgId,
    programId,
    entityType: 'audit_initiative_proposal',
    entityId: id,
    eventType: 'proposal.drafted',
    actorId: actor.userId,
    summary: `Draft propozycji „${title}" z ${findings.length} ustaleń`,
    payload: { sourceFindingIds },
  });

  const created = await getProposal(orgId, id);
  if (!created)
    throw new AuditDomainError(
      'Propozycja nie została poprawnie zapisana',
      500,
      'AUDIT_PROPOSAL_WRITE_FAILED'
    );
  return created;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface DraftProposalsInput {
  findingIds: string[];
  /**
   * 'none' (domyślnie) — scala WSZYSTKIE wskazane, kwalifikujące się ustalenia
   * w JEDNĄ propozycję („jedna inicjatywa może wynikać z kilku ustaleń").
   * 'criterion' — dzieli je na osobne propozycje wg kryterium.
   */
  splitBy?: 'none' | 'criterion';
  title?: string;
}

export async function draftProposalsFromFindings(
  orgId: string,
  actor: AuditActor,
  programId: string,
  input: DraftProposalsInput
): Promise<AuditInitiativeProposal[]> {
  await requireCapability(actor, programId, 'proposal.draft');

  const ids = Array.from(new Set((input.findingIds || []).filter(Boolean)));
  if (ids.length === 0) {
    throw new AuditDomainError(
      'Wskaż co najmniej jedno ustalenie',
      400,
      'AUDIT_PROPOSAL_NO_FINDINGS'
    );
  }

  const placeholders = ids.map((_, i) => `$${i + 3}`).join(', ');
  const rows = await auditAll<Row>(
    `SELECT * FROM audit_program_findings
      WHERE organization_id = $1 AND program_id = $2 AND id IN (${placeholders})`,
    [orgId, programId, ...ids]
  );

  // NIGDY automatycznie z każdej niezgodności: filtrujemy do statusów
  // confirmed+ i tylko wśród JAWNIE wskazanych ustaleń — funkcja nie skanuje
  // programu w poszukiwaniu kandydatów sama z siebie.
  const eligible = rows.filter((r) =>
    ELIGIBLE_FINDING_STATUSES.includes(String(r.status) as FindingStatus)
  );
  if (eligible.length === 0) {
    throw new AuditDomainError(
      'Żadne ze wskazanych ustaleń nie ma statusu confirmed lub późniejszego — draft propozycji wymaga potwierdzonego ustalenia',
      409,
      'AUDIT_PROPOSAL_NO_ELIGIBLE_FINDINGS'
    );
  }

  const groups: Row[][] =
    input.splitBy === 'criterion' ? Object.values(groupByCriterion(eligible)) : [eligible];

  const created: AuditInitiativeProposal[] = [];
  for (const groupFindings of groups) {
    if (groupFindings.length === 0) continue;
    created.push(await insertProposalDraft(orgId, actor, programId, groupFindings, input.title));
  }
  return created;
}

export interface SuggestedProposal {
  suggestedTitle: string;
  problemStatement: string;
  systemicCause: string;
  priority: string;
  sourceFindingIds: string[];
}

/** Zwraca TREŚĆ propozycji pogrupowanych wg potwierdzonej przyczyny źródłowej — nie zapisuje niczego. */
export async function suggestSystemicProposals(
  orgId: string,
  programId: string
): Promise<SuggestedProposal[]> {
  const rows = await auditAll<Row>(
    `SELECT * FROM audit_program_findings WHERE organization_id=$1 AND program_id=$2`,
    [orgId, programId]
  );

  const eligible = rows.filter(
    (r) =>
      ELIGIBLE_FINDING_STATUSES.includes(String(r.status) as FindingStatus) &&
      toBool(r.root_cause_confirmed) &&
      String(r.root_cause || '').trim()
  );

  const groups = new Map<string, Row[]>();
  for (const r of eligible) {
    const key = String(r.root_cause).trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const suggestions: SuggestedProposal[] = [];
  for (const findings of groups.values()) {
    if (findings.length === 0) continue;
    const cause = String(findings[0].root_cause).trim();
    const severities = findings
      .map((f) => (f.severity as string) || null)
      .filter(Boolean) as string[];
    suggestions.push({
      suggestedTitle: `Działanie systemowe: ${cause}`.slice(0, 200),
      problemStatement: findings
        .map((f) => String(f.statement || ''))
        .filter(Boolean)
        .join('\n\n'),
      systemicCause: cause,
      priority: highestSeverityToPriority(severities),
      sourceFindingIds: findings.map((f) => String(f.id)),
    });
  }
  return suggestions;
}

export interface UpdateProposalInput {
  title?: string;
  problemStatement?: string | null;
  systemicCause?: string | null;
  intendedOutcome?: string | null;
  scope?: string | null;
  priority?: string | null;
  proposedOwnerId?: string | null;
  timeframe?: string | null;
  dependencies?: string | null;
  successMeasures?: string[];
  verificationLink?: string | null;
  confidence?: number | null;
}

export async function updateProposal(
  orgId: string,
  actor: AuditActor,
  id: string,
  patch: UpdateProposalInput
): Promise<AuditInitiativeProposal> {
  const proposal = await getProposal(orgId, id);
  if (!proposal) throw new AuditNotFoundError('Propozycja');
  await requireCapability(actor, proposal.programId, 'proposal.draft');

  if (proposal.status !== 'draft') {
    throw new AuditStateError(`Propozycja w statusie „${proposal.status}" nie może być edytowana`);
  }

  const params: unknown[] = [];
  const sets: string[] = [];
  const setIf = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.title !== undefined) setIf('title', patch.title);
  if (patch.problemStatement !== undefined) setIf('problem_statement', patch.problemStatement);
  if (patch.systemicCause !== undefined) setIf('systemic_cause', patch.systemicCause);
  if (patch.intendedOutcome !== undefined) setIf('intended_outcome', patch.intendedOutcome);
  if (patch.scope !== undefined) setIf('scope', patch.scope);
  if (patch.priority !== undefined) setIf('priority', patch.priority);
  if (patch.proposedOwnerId !== undefined) setIf('proposed_owner_id', patch.proposedOwnerId);
  if (patch.timeframe !== undefined) setIf('timeframe', patch.timeframe);
  if (patch.dependencies !== undefined) setIf('dependencies', patch.dependencies);
  if (patch.successMeasures !== undefined)
    setIf('success_measures', JSON.stringify(patch.successMeasures));
  if (patch.verificationLink !== undefined) setIf('verification_link', patch.verificationLink);
  if (patch.confidence !== undefined) setIf('confidence', patch.confidence);

  if (sets.length === 0) return proposal;

  sets.push('updated_at = NOW()');
  params.push(orgId, id);
  await auditRun(
    `UPDATE audit_initiative_proposals SET ${sets.join(', ')} WHERE organization_id = $${params.length - 1} AND id = $${params.length}`,
    params
  );

  const updated = await getProposal(orgId, id);
  if (!updated) throw new AuditNotFoundError('Propozycja');
  return updated;
}

export async function listProposals(
  orgId: string,
  filters: { programId?: string; status?: ProposalStatus } = {}
): Promise<AuditInitiativeProposal[]> {
  const params: unknown[] = [orgId];
  let sql = `SELECT * FROM audit_initiative_proposals WHERE organization_id = $1`;
  if (filters.programId) {
    params.push(filters.programId);
    sql += ` AND program_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    sql += ` AND status = $${params.length}`;
  }
  const rows = await auditAll<Row>(sql, params);
  return rows
    .map(mapProposalRow)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

export async function getProposal(
  orgId: string,
  id: string
): Promise<AuditInitiativeProposal | null> {
  const row = await auditGet<Row>(
    `SELECT * FROM audit_initiative_proposals WHERE organization_id=$1 AND id=$2`,
    [orgId, id]
  );
  return row ? mapProposalRow(row) : null;
}

export async function dismissProposal(
  orgId: string,
  actor: AuditActor,
  id: string,
  reason?: string | null
): Promise<AuditInitiativeProposal> {
  const proposal = await getProposal(orgId, id);
  if (!proposal) throw new AuditNotFoundError('Propozycja');
  await requireCapability(actor, proposal.programId, 'proposal.draft');

  if (proposal.status === 'registered') {
    throw new AuditStateError('Zarejestrowanej propozycji nie można odrzucić');
  }

  await auditRun(
    `UPDATE audit_initiative_proposals SET status='dismissed', feedback_note=$1, updated_at=NOW()
      WHERE organization_id=$2 AND id=$3`,
    [reason ?? null, orgId, id]
  );

  await recordAuditEvent({
    organizationId: orgId,
    programId: proposal.programId,
    entityType: 'audit_initiative_proposal',
    entityId: id,
    eventType: 'proposal.dismissed',
    actorId: actor.userId,
    summary: `Odrzucono propozycję ${id}`,
  });

  const updated = await getProposal(orgId, id);
  if (!updated) throw new AuditNotFoundError('Propozycja');
  return updated;
}

export async function deferProposal(
  orgId: string,
  actor: AuditActor,
  id: string,
  reason?: string | null
): Promise<AuditInitiativeProposal> {
  const proposal = await getProposal(orgId, id);
  if (!proposal) throw new AuditNotFoundError('Propozycja');
  await requireCapability(actor, proposal.programId, 'proposal.draft');

  if (proposal.status === 'registered') {
    throw new AuditStateError('Zarejestrowanej propozycji nie można odroczyć');
  }

  await auditRun(
    `UPDATE audit_initiative_proposals SET status='deferred', feedback_note=$1, updated_at=NOW()
      WHERE organization_id=$2 AND id=$3`,
    [reason ?? null, orgId, id]
  );

  await recordAuditEvent({
    organizationId: orgId,
    programId: proposal.programId,
    entityType: 'audit_initiative_proposal',
    entityId: id,
    eventType: 'proposal.deferred',
    actorId: actor.userId,
    summary: `Odroczono propozycję ${id}`,
  });

  const updated = await getProposal(orgId, id);
  if (!updated) throw new AuditNotFoundError('Propozycja');
  return updated;
}

/**
 * Rejestruje propozycję jako inicjatywę przez KANONICZNY lejek tworzenia.
 * Jeśli lejek odrzuci wejście (np. przez bramkę jakości karty albo walidację
 * Zod), NIE obchodzimy go ręcznym INSERT-em — rzucamy czytelny błąd domenowy
 * i zostawiamy propozycję w dotychczasowym stanie, żeby dało się poprawić
 * dane i spróbować ponownie.
 */
export async function registerAsInitiative(
  orgId: string,
  actor: AuditActor,
  id: string
): Promise<AuditInitiativeProposal> {
  const proposal = await getProposal(orgId, id);
  if (!proposal) throw new AuditNotFoundError('Propozycja');
  await requireCapability(actor, proposal.programId, 'proposal.register');

  if (proposal.status === 'registered') {
    throw new AuditStateError('Propozycja jest już zarejestrowana jako inicjatywa');
  }
  if (proposal.status === 'dismissed') {
    throw new AuditStateError('Odrzuconej propozycji nie można zarejestrować jako inicjatywy');
  }

  let created: { id: string };
  try {
    created = await createInitiative(
      orgId,
      {
        title: proposal.title,
        description: proposal.problemStatement ?? undefined,
        problemStatement: proposal.problemStatement ?? undefined,
        priority: normalizeInitiativePriority(proposal.priority),
        sourceType: 'audit',
        sourceId: proposal.id,
        successCriteria: proposal.successMeasures?.length ? proposal.successMeasures : undefined,
      },
      { actor: { id: actor.userId } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AuditDomainError(
      `Kanoniczny kreator inicjatyw odrzucił rejestrację propozycji „${proposal.title}" — ${message}. ` +
        'Rejestracja NIE została obejściona ręcznym zapisem; uzupełnij brakujące dane propozycji (np. tytuł/opis) i spróbuj ponownie.',
      422,
      'AUDIT_PROPOSAL_REGISTER_FAILED'
    );
  }

  await auditRun(
    `UPDATE audit_initiative_proposals
        SET status='registered', registered_initiative_id=$1, registered_at=NOW(), updated_at=NOW()
      WHERE organization_id=$2 AND id=$3`,
    [created.id, orgId, id]
  );

  await recordAuditEvent({
    organizationId: orgId,
    programId: proposal.programId,
    entityType: 'audit_initiative_proposal',
    entityId: id,
    eventType: 'proposal.registered',
    actorId: actor.userId,
    summary: `Propozycja zarejestrowana jako inicjatywa ${created.id}`,
    payload: { initiativeId: created.id },
  });

  const updated = await getProposal(orgId, id);
  if (!updated) throw new AuditNotFoundError('Propozycja');
  return updated;
}

export interface OverlapCandidate {
  initiativeId: string;
  title: string;
  status: string;
  score: number;
  matchedKeywords: string[];
}

/**
 * Heurystyka nakładania się po słowach kluczowych tytułu/opisu propozycji
 * względem istniejących inicjatyw organizacji. To sygnał ostrzegawczy do
 * przeglądu przez człowieka, nie automatyczna blokada rejestracji.
 */
export async function checkOverlap(orgId: string, proposalId: string): Promise<OverlapCandidate[]> {
  const proposal = await getProposal(orgId, proposalId);
  if (!proposal) throw new AuditNotFoundError('Propozycja');

  const keywords = extractKeywords(
    `${proposal.title} ${proposal.problemStatement ?? ''} ${proposal.systemicCause ?? ''}`
  );
  if (keywords.length === 0) return [];

  const rows = await auditAll<{
    id: string;
    title: string | null;
    name: string | null;
    status: string | null;
  }>(`SELECT id, title, name, status FROM initiatives WHERE organization_id = $1`, [orgId]);

  const candidates: OverlapCandidate[] = [];
  for (const row of rows) {
    const label = String(row.title || row.name || '');
    if (!label) continue;
    const candidateKeywords = extractKeywords(label);
    const matched = keywords.filter((k) => candidateKeywords.includes(k));
    if (matched.length === 0) continue;
    candidates.push({
      initiativeId: row.id,
      title: label,
      status: String(row.status || ''),
      score: matched.length / keywords.length,
      matchedKeywords: matched,
    });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 10);
}
