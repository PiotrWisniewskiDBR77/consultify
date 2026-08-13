/**
 * auditTrailService — ścieżka audytowa DOMENY (nie platformy).
 *
 * `audit_domain_events` niesie zdarzenia biznesowe (kto zmienił kryterium,
 * wniosek, istotność, kto zatwierdził) w kształcie czytelnym dla raportu i dla
 * kontroli niezależności — odrębnie od technicznego `audit_events`, który
 * obsługuje platformę.
 *
 * `getIndependenceReport` jest RAPORTEM WYKRYWAJĄCYM: nie ufa temu, że
 * segregacja obowiązków (permissions.ts: `assertNotConcludingOwnResponse`,
 * `assertIndependentVerifier`, `assertNotReviewingOwnFinding`) faktycznie
 * zablokowała każde naruszenie w momencie zapisu — te asercje chronią ścieżkę
 * API, ale dane mogły powstać poza nią (import, migracja, ręczna korekta w
 * bazie, luka w starszym kodzie). Dlatego ten raport skanuje żywe tabele
 * WPROST, niezależnie od tego, jak naruszenie powstało.
 */

import { AuditNotFoundError, auditAll, auditGet, parseJson, toIso } from './auditsDb.js';

// ---------------------------------------------------------------------------
// Zdarzenia domenowe
// ---------------------------------------------------------------------------

export interface DomainEventRecord {
  id: string;
  programId: string | null;
  organizationId: string;
  entityType: string;
  entityId: string | null;
  eventType: string;
  actorId: string | null;
  actorRole: string | null;
  summary: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

function mapEventRow(row: Record<string, unknown>): DomainEventRecord {
  return {
    id: String(row.id),
    programId: (row.program_id as string | null) ?? null,
    organizationId: String(row.organization_id),
    entityType: String(row.entity_type),
    entityId: (row.entity_id as string | null) ?? null,
    eventType: String(row.event_type),
    actorId: (row.actor_id as string | null) ?? null,
    actorRole: (row.actor_role as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    payload: parseJson(row.payload, {}),
    occurredAt: toIso(row.occurred_at) ?? '',
  };
}

export interface ListEventsFilters {
  programId?: string;
  entityType?: string;
  entityId?: string;
  eventType?: string;
  actorId?: string;
  /** ISO — dolna granica `occurred_at` (włącznie). */
  from?: string;
  /** ISO — górna granica `occurred_at` (włącznie). */
  to?: string;
  limit?: number;
  offset?: number;
}

export interface ListEventsResult {
  items: DomainEventRecord[];
  total: number;
  limit: number;
  offset: number;
}

/** Zdarzenia z paginacją i filtrami — widok „dziennik" ścieżki audytowej. */
export async function listEvents(
  organizationId: string,
  filters: ListEventsFilters,
): Promise<ListEventsResult> {
  const clauses = ['organization_id = $1'];
  const params: unknown[] = [organizationId];
  const eq = (col: string, value: unknown) => {
    params.push(value);
    clauses.push(`${col} = $${params.length}`);
  };
  if (filters.programId) eq('program_id', filters.programId);
  if (filters.entityType) eq('entity_type', filters.entityType);
  if (filters.entityId) eq('entity_id', filters.entityId);
  if (filters.eventType) eq('event_type', filters.eventType);
  if (filters.actorId) eq('actor_id', filters.actorId);
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`occurred_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`occurred_at <= $${params.length}`);
  }
  const where = clauses.join(' AND ');

  const countRow = await auditGet<{ count: string }>(
    `SELECT COUNT(*) AS count FROM audit_domain_events WHERE ${where}`,
    params,
  );
  const total = Number(countRow?.count ?? 0);

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);
  const rows = await auditAll<Record<string, unknown>>(
    `SELECT * FROM audit_domain_events
      WHERE ${where}
      ORDER BY occurred_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return { items: rows.map(mapEventRow), total, limit, offset };
}

/** Pełna historia jednego obiektu, w porządku chronologicznym (rosnąco). */
export async function getEntityHistory(
  organizationId: string,
  entityType: string,
  entityId: string,
): Promise<DomainEventRecord[]> {
  const rows = await auditAll<Record<string, unknown>>(
    `SELECT * FROM audit_domain_events
      WHERE organization_id=$1 AND entity_type=$2 AND entity_id=$3
      ORDER BY occurred_at ASC`,
    [organizationId, entityType, entityId],
  );
  return rows.map(mapEventRow);
}

// ---------------------------------------------------------------------------
// Oś czasu programu
// ---------------------------------------------------------------------------

export interface TimelineStageGroup {
  /** Etap lifecycle aktywny w chwili tych zdarzeń; `planning` domyślnie, dopóki
   *  nie pojawi się pierwsze zdarzenie z rozpoznawalnym `payload` przejścia. */
  stage: string;
  events: DomainEventRecord[];
}

function pickLifecycleStage(payload: Record<string, unknown>): string | null {
  const candidates = [payload.lifecycleState, payload.to, payload.toState, payload.newState];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
  }
  return null;
}

/**
 * Oś czasu audytu pogrupowana po etapie lifecycle. Grupowanie jest oparte na
 * treści `payload` zdarzeń przejścia (klucze `lifecycleState`/`to`/`toState`/
 * `newState` — dowolny z nich, cokolwiek zapisze serwis odpowiedzialny za
 * przejścia stanu), nie na sztywno zakodowanej nazwie `event_type`: kernel
 * lifecycle (`lifecycle.ts`) jest czystą maszyną stanów bez własnej
 * persystencji, więc ten moduł nie zakłada, jaki dokładnie `event_type`
 * zapisze wołający.
 */
export async function getProgramTimeline(
  organizationId: string,
  programId: string,
): Promise<TimelineStageGroup[]> {
  const rows = await auditAll<Record<string, unknown>>(
    `SELECT * FROM audit_domain_events WHERE organization_id=$1 AND program_id=$2 ORDER BY occurred_at ASC`,
    [organizationId, programId],
  );

  const groups: TimelineStageGroup[] = [];
  let currentStage = 'planning';
  let currentGroup: DomainEventRecord[] = [];
  const pushGroup = () => {
    if (currentGroup.length) groups.push({ stage: currentStage, events: currentGroup });
  };

  for (const raw of rows) {
    const event = mapEventRow(raw);
    const nextStage = pickLifecycleStage(event.payload);
    if (nextStage && nextStage !== currentStage) {
      pushGroup();
      currentStage = nextStage;
      currentGroup = [];
    }
    currentGroup.push(event);
  }
  pushGroup();
  return groups;
}

// ---------------------------------------------------------------------------
// Eksport do załącznika raportu
// ---------------------------------------------------------------------------

export interface TrailExportEntry {
  who: string | null;
  role: string | null;
  what: string;
  entityType: string;
  entityId: string | null;
  when: string;
  summary: string | null;
}

export interface TrailExport {
  programId: string;
  generatedAt: string;
  entries: TrailExportEntry[];
}

/** Struktura „kto, co, kiedy, w jakiej roli" — do załącznika raportu. */
export async function exportTrail(organizationId: string, programId: string): Promise<TrailExport> {
  const rows = await auditAll<Record<string, unknown>>(
    `SELECT * FROM audit_domain_events WHERE organization_id=$1 AND program_id=$2 ORDER BY occurred_at ASC`,
    [organizationId, programId],
  );
  const entries: TrailExportEntry[] = rows.map((raw) => {
    const event = mapEventRow(raw);
    return {
      who: event.actorId,
      role: event.actorRole,
      what: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      when: event.occurredAt,
      summary: event.summary,
    };
  });
  return { programId, generatedAt: new Date().toISOString(), entries };
}

// ---------------------------------------------------------------------------
// Kontrola niezależności — raport wykrywający
// ---------------------------------------------------------------------------

export type IndependenceViolationKind =
  | 'criterion_self_conclusion'
  | 'action_self_verification'
  | 'finding_self_review';

export interface IndependenceViolation {
  kind: IndependenceViolationKind;
  entityType: 'criterion' | 'corrective_action' | 'finding';
  entityId: string;
  personId: string;
  detail: string;
}

export interface IndependenceReport {
  programId: string;
  checkedAt: string;
  violations: IndependenceViolation[];
}

/**
 * Skanuje żywe dane programu i wypisuje przypadki, w których ta sama osoba
 * wystąpiła w rolach, które powinny być rozdzielone:
 *   1. odpowiadała jako strona audytowana I sama wyciągnęła wniosek audytora
 *      dla tego samego kryterium (`auditee_responded_by = concluded_by`);
 *   2. była właścicielem/wykonawcą działania korygującego I sama zweryfikowała
 *      jego skuteczność (`owner_user_id`/`implemented_by` = `performed_by`
 *      weryfikacji);
 *   3. była autorem ustalenia I jego recenzentem (`author_id = reviewed_by`).
 * Nie zależy od tego, czy naruszenie powstało przez API — sprawdza to, co
 * faktycznie leży w tabelach, niezależnie od ścieżki zapisu.
 */
export async function getIndependenceReport(
  organizationId: string,
  programId: string,
): Promise<IndependenceReport> {
  const program = await auditGet<Record<string, unknown>>(
    `SELECT id FROM audit_programs WHERE organization_id=$1 AND id=$2`,
    [organizationId, programId],
  );
  if (!program) throw new AuditNotFoundError('Program audytowy');

  const violations: IndependenceViolation[] = [];

  const criteriaRows = await auditAll<Record<string, unknown>>(
    `SELECT id, ref_code, title, auditee_responded_by
       FROM audit_program_criteria
      WHERE organization_id=$1 AND program_id=$2
        AND auditee_responded_by IS NOT NULL AND auditee_responded_by = concluded_by`,
    [organizationId, programId],
  );
  for (const row of criteriaRows) {
    const personId = String(row.auditee_responded_by);
    violations.push({
      kind: 'criterion_self_conclusion',
      entityType: 'criterion',
      entityId: String(row.id),
      personId,
      detail: `Kryterium ${row.ref_code || row.id} ("${row.title}"): ta sama osoba (${personId}) odpowiedziała jako strona audytowana i sama wyciągnęła wniosek audytora.`,
    });
  }

  const actionRows = await auditAll<Record<string, unknown>>(
    `SELECT ca.id AS action_id, ca.title, ca.owner_user_id, ca.implemented_by, v.performed_by
       FROM audit_corrective_actions ca
       JOIN audit_verifications v ON v.corrective_action_id = ca.id
      WHERE ca.organization_id=$1 AND ca.program_id=$2 AND v.performed_by IS NOT NULL
        AND (v.performed_by = ca.owner_user_id OR v.performed_by = ca.implemented_by)`,
    [organizationId, programId],
  );
  for (const row of actionRows) {
    const personId = String(row.performed_by);
    violations.push({
      kind: 'action_self_verification',
      entityType: 'corrective_action',
      entityId: String(row.action_id),
      personId,
      detail: `Działanie „${row.title}": ta sama osoba (${personId}) była właścicielem lub wykonawcą działania i sama zweryfikowała jego skuteczność.`,
    });
  }

  const findingRows = await auditAll<Record<string, unknown>>(
    `SELECT id, statement, author_id
       FROM audit_program_findings
      WHERE organization_id=$1 AND program_id=$2
        AND author_id IS NOT NULL AND author_id = reviewed_by`,
    [organizationId, programId],
  );
  for (const row of findingRows) {
    const personId = String(row.author_id);
    const statement = String(row.statement || '');
    violations.push({
      kind: 'finding_self_review',
      entityType: 'finding',
      entityId: String(row.id),
      personId,
      detail: `Ustalenie „${statement.slice(0, 80)}${statement.length > 80 ? '...' : ''}": ta sama osoba (${personId}) była jego autorem i recenzentem.`,
    });
  }

  return { programId, checkedAt: new Date().toISOString(), violations };
}
