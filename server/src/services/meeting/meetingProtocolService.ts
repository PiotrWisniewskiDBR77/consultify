import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

/**
 * MTG-2 rework etap 2a / DEC-607 (U-52, DEC-592 pkt 5) — protokół spotkania
 * jako DOKUMENT archetypu B, składany WYŁĄCZNIE z DANYCH strukturalnych
 * (metryka · role · obecność · agenda · przebieg · decyzje · akcje · stopka),
 * nie z wolnego tekstu AI. Warstwa serwisowa nad `meeting_protocols`
 * (migracja 20262303) i kolumnami protokołu decyzji/akcji (20262302).
 *
 * Model wersji (P3, rekomendacja z PROPOZYCJA.md przyjęta w KROK 0):
 *   draft -> (akcept prowadzącego) -> approved v1.0 ZAMROŻONA;
 *   edycja zatwierdzonej tworzy NOWY wiersz v1.1 z erratą, v1.0 nietknięta.
 */

export type ProtocolBlockKind =
  | 'meta'
  | 'roles'
  | 'attendance'
  | 'agenda'
  | 'proceedings'
  | 'decisions'
  | 'actions'
  | 'footer';

export interface ProtocolMetaBlock {
  kind: 'meta';
  title: string;
  startAt: string;
  endAt: string;
  timezone: string | null;
  location: string;
  meetingType: string | null;
  lifecycleState: string;
}

export interface ProtocolRolesBlock {
  kind: 'roles';
  chair: string | null;
  scribe: string | null;
  approver: string | null;
}

export interface ProtocolAttendanceBlock {
  kind: 'attendance';
  accepted: string[];
  declined: string[];
  pending: string[];
}

export interface ProtocolAgendaPoint {
  position: number;
  title: string;
  durationMinutes: number;
  purpose: string;
  lead: string | null;
  notes: string;
}

export interface ProtocolAgendaBlock {
  kind: 'agenda';
  items: ProtocolAgendaPoint[];
}

export interface ProtocolProceedingPoint {
  position: number;
  title: string;
  notes: string;
  decisionCount: number;
  actionCount: number;
}

export interface ProtocolProceedingsBlock {
  kind: 'proceedings';
  points: ProtocolProceedingPoint[];
}

export interface ProtocolDecision {
  statement: string;
  rationale: string;
  owner: string | null;
  decisionType: string | null;
  impact: string | null;
  rejectedAlternative: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  status: string;
}

export interface ProtocolDecisionsBlock {
  kind: 'decisions';
  items: ProtocolDecision[];
}

export interface ProtocolAction {
  title: string;
  owner: string | null;
  dueAt: string | null;
  status: string;
  taskId: string | null;
  taskStatus: string | null;
  agendaItemTitle: string | null;
}

export interface ProtocolActionsBlock {
  kind: 'actions';
  items: ProtocolAction[];
}

export interface ProtocolVersionInfo {
  version: string;
  status: string;
  approvedAt: string | null;
  approvedBy: string | null;
  errata: string;
}

export interface ProtocolFooterBlock {
  kind: 'footer';
  nextOccurrence: string | null;
  versions: ProtocolVersionInfo[];
}

export type ProtocolBlock =
  | ProtocolMetaBlock
  | ProtocolRolesBlock
  | ProtocolAttendanceBlock
  | ProtocolAgendaBlock
  | ProtocolProceedingsBlock
  | ProtocolDecisionsBlock
  | ProtocolActionsBlock
  | ProtocolFooterBlock;

export interface ProtocolContent {
  meetingId: string;
  generatedAt: string;
  blocks: ProtocolBlock[];
}

export class MeetingProtocolError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'MeetingProtocolError';
    this.code = code;
  }
}

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
};

function displayNameOf(row: UserRow): string {
  const full = `${row.first_name || ''} ${row.last_name || ''}`.trim();
  return full || String(row.display_name || '').trim() || String(row.email || '').trim();
}

/** Bezpieczny parse JSON-tablicy (obiekty lub łańcuchy) z kolumny TEXT. */
function parseJsonArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Rozwiązuje identyfikatory użytkowników org na imienne etykiety (jak
 * uczestnicy — „użytkownicy org po nazwisku"). Zwraca mapę id -> nazwa.
 */
async function resolveUserNames(
  organizationId: string,
  userIds: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(userIds.map((id) => String(id || '').trim()).filter(Boolean))
  );
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await dbAll<UserRow>(
    `SELECT id, first_name, last_name, display_name, email FROM users
     WHERE organization_id = ? AND id IN (${placeholders})`,
    [organizationId, ...ids],
    { fallback: false }
  );
  for (const row of rows || []) out.set(row.id, displayNameOf(row));
  return out;
}

type MeetingProtocolRow = {
  id: string;
  organization_id: string;
  meeting_id: string;
  version: string;
  status: string;
  content_json: string;
  source_digest: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  errata_note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export interface MeetingProtocol {
  id: string;
  organizationId: string;
  meetingId: string;
  version: string;
  status: 'draft' | 'approved';
  content: ProtocolContent;
  sourceDigest: string | null;
  approvedByUserId: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  errataNote: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function parseContent(raw: string | null): ProtocolContent {
  if (!raw || !raw.trim()) return { meetingId: '', generatedAt: '', blocks: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.blocks)) return parsed as ProtocolContent;
  } catch {
    /* fall through to empty */
  }
  return { meetingId: '', generatedAt: '', blocks: [] };
}

/** "1.0" -> "1.1"; "1.9" -> "1.10"; nieparsowalne -> "1.1". */
export function nextProtocolVersion(current: string): string {
  const match = /^(\d+)\.(\d+)$/.exec(String(current || '').trim());
  if (!match) return '1.1';
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return `${major}.${minor + 1}`;
}

type MeetingRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  timezone: string | null;
  location: string | null;
  type: string | null;
  lifecycle_state: string | null;
  chair_user_id: string | null;
  scribe_user_id: string | null;
  recurrence_rule: string | null;
  agenda_json: string | null;
};

type MeetingNoteRow = {
  decisions_json: string | null;
  action_items_json: string | null;
};

type ParticipantRow = {
  user_id: string | null;
  display_name: string | null;
  email: string | null;
  invitation_status: string | null;
};

type AgendaRow = {
  id: string;
  position: number | string;
  title: string;
  duration_minutes: number | string;
  purpose: string | null;
  lead_user_id: string | null;
  notes: string | null;
  decision_id: string | null;
};

type DecisionRow = {
  statement: string;
  rationale: string | null;
  decided_by: string | null;
  decided_at: string | null;
  status: string | null;
  owner_user_id: string | null;
  decision_type: string | null;
  impact_text: string | null;
  rejected_alternative: string | null;
};

type FollowUpRow = {
  title: string;
  owner: string | null;
  owner_user_id: string | null;
  due_at: string | null;
  status: string | null;
  task_id: string | null;
  agenda_item_id: string | null;
};

/**
 * Składa treść protokołu (8 bloków) z DANYCH spotkania. Puste bloki są
 * UKRYTE (nie wchodzą do `blocks`) — oprócz `meta` (zawsze) i `footer`
 * (zawsze: niesie historię wersji). `approverName`/`versions` wchodzą z
 * utrwalonego wiersza protokołu (draft nie ma jeszcze zatwierdzającego).
 */
export async function buildProtocolContent(input: {
  organizationId: string;
  meetingId: string;
  approverName?: string | null;
  versions?: ProtocolVersionInfo[];
}): Promise<ProtocolContent> {
  const org = input.organizationId;
  const meeting = await dbGet<MeetingRow>(
    `SELECT id, title, start_at, end_at, timezone, location, type,
            lifecycle_state, chair_user_id, scribe_user_id, recurrence_rule,
            agenda_json
     FROM meetings WHERE organization_id = ? AND id = ? LIMIT 1`,
    [org, input.meetingId],
    { fallback: false }
  );
  if (!meeting) throw new MeetingProtocolError('MEETING_NOT_FOUND');

  const participants = await dbAll<ParticipantRow>(
    `SELECT user_id, display_name, email, invitation_status
     FROM meeting_participants
     WHERE organization_id = ? AND meeting_id = ?
     ORDER BY display_name ASC, id ASC`,
    [org, input.meetingId],
    { fallback: false }
  );
  const agenda = await dbAll<AgendaRow>(
    `SELECT id, position, title, duration_minutes, purpose, lead_user_id, notes, decision_id
     FROM meeting_agenda_items
     WHERE organization_id = ? AND meeting_id = ?
     ORDER BY position ASC, id ASC`,
    [org, input.meetingId],
    { fallback: false }
  );
  const decisions = await dbAll<DecisionRow>(
    `SELECT statement, rationale, decided_by, decided_at, status,
            owner_user_id, decision_type, impact_text, rejected_alternative
     FROM meeting_decisions
     WHERE organization_id = ? AND meeting_id = ?
     ORDER BY created_at ASC, id ASC`,
    [org, input.meetingId],
    { fallback: false }
  );
  const followUps = await dbAll<FollowUpRow>(
    `SELECT title, owner, owner_user_id, due_at, status, task_id, agenda_item_id
     FROM meeting_follow_ups
     WHERE organization_id = ? AND meeting_id = ?
     ORDER BY created_at ASC, id ASC`,
    [org, input.meetingId],
    { fallback: false }
  );

  // FALLBACK ŹRÓDŁA (pomiar na kopii dumpu staging-pre-wdrozenie17b, MTG-2a):
  // strukturalne rejestry `meeting_decisions`/`meeting_follow_ups`/
  // `meeting_agenda_items` są na linii PUSTE dla realnych spotkań — ustalenia
  // żyją w ZATWIERDZONEJ notatce (`meeting_notes.decisions_json` /
  // `action_items_json`, strukturalny JSON pól, NIE wolny tekst `summary`) i w
  // legacy `meetings.agenda_json`. Czytamy je TYLKO gdy odpowiedni rejestr jest
  // pusty, żeby protokół realnego spotkania Northwind „Weekly PMO Review" miał
  // ≥1 decyzję i ≥1 akcję Z DANYCH. Po MTG-2b (DEC-592 pkt 3: materializacja
  // nota->rejestr) rejestr stanie się źródłem nadrzędnym, a ten fallback zgaśnie.
  const note = await dbGet<MeetingNoteRow>(
    `SELECT decisions_json, action_items_json
     FROM meeting_notes
     WHERE organization_id = ? AND meeting_id = ? AND status = 'approved'
     ORDER BY created_at DESC LIMIT 1`,
    [org, input.meetingId],
    { fallback: false }
  );
  const noteDecisions = parseJsonArray(note?.decisions_json);
  const noteActions = parseJsonArray(note?.action_items_json);
  const legacyAgenda = parseJsonArray(meeting.agenda_json);

  // Status powrotny zadania (blok „Akcje"): odczyt `tasks.status` po task_id.
  const taskIds = Array.from(
    new Set((followUps || []).map((f) => String(f.task_id || '').trim()).filter(Boolean))
  );
  const taskStatusById = new Map<string, string>();
  if (taskIds.length) {
    const placeholders = taskIds.map(() => '?').join(', ');
    const taskRows = await dbAll<{ id: string; status: string | null }>(
      `SELECT id, status FROM tasks WHERE organization_id = ? AND id IN (${placeholders})`,
      [org, ...taskIds],
      { fallback: false }
    );
    for (const t of taskRows || []) taskStatusById.set(t.id, String(t.status || ''));
  }

  const names = await resolveUserNames(org, [
    meeting.chair_user_id,
    meeting.scribe_user_id,
    ...(agenda || []).map((a) => a.lead_user_id),
    ...(decisions || []).map((d) => d.owner_user_id),
    ...(followUps || []).map((f) => f.owner_user_id),
    ...(participants || []).map((p) => p.user_id),
  ]);
  const nameOf = (id: string | null | undefined): string | null => {
    const key = String(id || '').trim();
    return key ? names.get(key) || null : null;
  };

  const agendaById = new Map<string, AgendaRow>();
  for (const a of agenda || []) agendaById.set(a.id, a);

  const blocks: ProtocolBlock[] = [];

  // 1. Metryka — zawsze obecna.
  blocks.push({
    kind: 'meta',
    title: meeting.title,
    startAt: meeting.start_at,
    endAt: meeting.end_at,
    timezone: meeting.timezone || null,
    location: String(meeting.location || '').trim(),
    meetingType: meeting.type || null,
    lifecycleState: meeting.lifecycle_state || 'scheduled',
  });

  // 2. Role — ukryte, jeśli żadna nieznana.
  const chair = nameOf(meeting.chair_user_id);
  const scribe = nameOf(meeting.scribe_user_id);
  const approver = input.approverName || null;
  if (chair || scribe || approver) {
    blocks.push({ kind: 'roles', chair, scribe, approver });
  }

  // 3. Obecność (RSVP) — ukryta, jeśli brak uczestników.
  const accepted: string[] = [];
  const declined: string[] = [];
  const pending: string[] = [];
  for (const p of participants || []) {
    const label =
      nameOf(p.user_id) ||
      String(p.display_name || '').trim() ||
      String(p.email || '').trim();
    if (!label) continue;
    const st = String(p.invitation_status || '').toLowerCase();
    if (st === 'accepted') accepted.push(label);
    else if (st === 'declined' || st === 'rejected') declined.push(label);
    else pending.push(label);
  }
  if (accepted.length || declined.length || pending.length) {
    blocks.push({ kind: 'attendance', accepted, declined, pending });
  }

  // 4. Agenda — ukryta, jeśli brak punktów. Fallback: legacy `agenda_json`.
  let agendaItems: ProtocolAgendaPoint[] = (agenda || []).map((a) => ({
    position: Number(a.position || 0),
    title: a.title,
    durationMinutes: Number(a.duration_minutes || 0),
    purpose: a.purpose || 'information',
    lead: nameOf(a.lead_user_id),
    notes: String(a.notes || '').trim(),
  }));
  if (!agendaItems.length && legacyAgenda.length) {
    agendaItems = legacyAgenda
      .map((raw) => String(typeof raw === 'string' ? raw : raw?.title || '').trim())
      .filter(Boolean)
      .map((title, index) => ({
        position: index + 1,
        title,
        durationMinutes: 0,
        purpose: 'information',
        lead: null,
        notes: '',
      }));
  }
  if (agendaItems.length) blocks.push({ kind: 'agenda', items: agendaItems });

  // 5. Przebieg per punkt — tylko punkty z notatką LUB decyzją/akcją.
  // Decyzja jest przypięta do punktu przez `meeting_agenda_items.decision_id`
  // (relacja 1:1), akcje przez `meeting_follow_ups.agenda_item_id`.
  const actionCountByAgenda = new Map<string, number>();
  for (const f of followUps || []) {
    const key = String(f.agenda_item_id || '').trim();
    if (!key) continue;
    actionCountByAgenda.set(key, (actionCountByAgenda.get(key) || 0) + 1);
  }
  const proceedings: ProtocolProceedingPoint[] = (agenda || [])
    .map((a) => ({
      position: Number(a.position || 0),
      title: a.title,
      notes: String(a.notes || '').trim(),
      decisionCount: String(a.decision_id || '').trim() ? 1 : 0,
      actionCount: actionCountByAgenda.get(a.id) || 0,
    }))
    .filter((p) => p.notes || p.decisionCount > 0 || p.actionCount > 0);
  if (proceedings.length) blocks.push({ kind: 'proceedings', points: proceedings });

  // 6. Decyzje — ukryte, jeśli brak. Fallback: strukturalne pozycje z
  //    zatwierdzonej notatki (decisions_json), gdy rejestr `meeting_decisions`
  //    jest pusty (patrz komentarz FALLBACK wyżej).
  let decisionItems: ProtocolDecision[] = (decisions || []).map((d) => ({
    statement: d.statement,
    rationale: String(d.rationale || '').trim(),
    owner: nameOf(d.owner_user_id) || String(d.decided_by || '').trim() || null,
    decisionType: d.decision_type || null,
    impact: d.impact_text || null,
    rejectedAlternative: d.rejected_alternative || null,
    decidedBy: String(d.decided_by || '').trim() || null,
    decidedAt: d.decided_at || null,
    status: String(d.status || 'recorded'),
  }));
  if (!decisionItems.length && noteDecisions.length) {
    decisionItems = noteDecisions
      .map((raw) => {
        const statement = String(raw?.decision || raw?.statement || '').trim();
        if (!statement) return null;
        const decidedBy = String(raw?.decidedBy || raw?.decided_by || '').trim() || null;
        return {
          statement,
          rationale: String(raw?.rationale || '').trim(),
          owner: decidedBy,
          decisionType: null,
          impact: null,
          rejectedAlternative: null,
          decidedBy,
          decidedAt: null,
          status: 'recorded',
        } as ProtocolDecision;
      })
      .filter((d): d is ProtocolDecision => d !== null);
  }
  if (decisionItems.length) blocks.push({ kind: 'decisions', items: decisionItems });

  // 7. Akcje — ukryte, jeśli brak. Fallback: strukturalne pozycje z
  //    zatwierdzonej notatki (action_items_json), gdy rejestr
  //    `meeting_follow_ups` jest pusty (patrz komentarz FALLBACK wyżej).
  let actionItems: ProtocolAction[] = (followUps || []).map((f) => {
    const agendaItem = f.agenda_item_id ? agendaById.get(String(f.agenda_item_id)) : null;
    return {
      title: f.title,
      owner: nameOf(f.owner_user_id) || String(f.owner || '').trim() || null,
      dueAt: f.due_at || null,
      status: String(f.status || 'open'),
      taskId: f.task_id || null,
      taskStatus: f.task_id ? taskStatusById.get(String(f.task_id)) || null : null,
      agendaItemTitle: agendaItem ? agendaItem.title : null,
    };
  });
  if (!actionItems.length && noteActions.length) {
    actionItems = noteActions
      .map((raw) => {
        const title = String(raw?.task || raw?.title || '').trim();
        if (!title) return null;
        return {
          title,
          owner: String(raw?.owner || '').trim() || null,
          dueAt: raw?.deadline ? String(raw.deadline) : null,
          status: 'open',
          taskId: null,
          taskStatus: null,
          agendaItemTitle: null,
        } as ProtocolAction;
      })
      .filter((a): a is ProtocolAction => a !== null);
  }
  if (actionItems.length) blocks.push({ kind: 'actions', items: actionItems });

  // 8. Stopka — zawsze: następne spotkanie (z serii) + historia wersji.
  blocks.push({
    kind: 'footer',
    nextOccurrence: meeting.recurrence_rule || null,
    versions: input.versions || [],
  });

  return {
    meetingId: meeting.id,
    generatedAt: new Date().toISOString(),
    blocks,
  };
}

/** Skrót danych źródłowych do wykrywania rozjazdu po edycji (bez `generatedAt`). */
export function computeSourceDigest(content: ProtocolContent): string {
  const stable = JSON.stringify(
    content.blocks.map((b) => ({ ...b }))
  );
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 32);
}

async function mapProtocolRow(
  row: MeetingProtocolRow,
  organizationId: string
): Promise<MeetingProtocol> {
  let approvedByName: string | null = null;
  if (row.approved_by_user_id) {
    const names = await resolveUserNames(organizationId, [row.approved_by_user_id]);
    approvedByName = names.get(row.approved_by_user_id) || null;
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    meetingId: row.meeting_id,
    version: row.version,
    status: row.status === 'approved' ? 'approved' : 'draft',
    content: parseContent(row.content_json),
    sourceDigest: row.source_digest || null,
    approvedByUserId: row.approved_by_user_id || null,
    approvedByName,
    approvedAt: row.approved_at || null,
    errataNote: row.errata_note || '',
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listVersionInfo(
  organizationId: string,
  meetingId: string
): Promise<ProtocolVersionInfo[]> {
  const rows = await dbAll<MeetingProtocolRow>(
    `SELECT * FROM meeting_protocols
     WHERE organization_id = ? AND meeting_id = ?
     ORDER BY created_at ASC, id ASC`,
    [organizationId, meetingId],
    { fallback: false }
  );
  const names = await resolveUserNames(
    organizationId,
    (rows || []).map((r) => r.approved_by_user_id)
  );
  return (rows || []).map((r) => ({
    version: r.version,
    status: r.status,
    approvedAt: r.approved_at || null,
    approvedBy: r.approved_by_user_id
      ? names.get(r.approved_by_user_id) || null
      : null,
    errata: r.errata_note || '',
  }));
}

/** Najnowsza OPUBLIKOWANA (approved) wersja protokołu lub null. Draft NIE jest
 *  utrwalany — widok roboczy składa się żywo ze źródeł (W109b: `content_json`
 *  przechowuje WYŁĄCZNIE migawkę wersji published). */
export async function getLatestApprovedProtocol(input: {
  organizationId: string;
  meetingId: string;
}): Promise<MeetingProtocol | null> {
  const row = await dbGet<MeetingProtocolRow>(
    `SELECT * FROM meeting_protocols
     WHERE organization_id = ? AND meeting_id = ? AND status = 'approved'
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [input.organizationId, input.meetingId],
    { fallback: false }
  );
  return row ? mapProtocolRow(row, input.organizationId) : null;
}

/** Zamrożona migawka konkretnej OPUBLIKOWANEJ wersji — odczyt bajt-w-bajt z
 *  `content_json`, BEZ przebudowy ze źródeł (dowód W109b(i): publikacja v1.0 →
 *  edycja źródła → v1.0 nie zmienia się). */
export async function getPublishedProtocol(input: {
  organizationId: string;
  meetingId: string;
  version: string;
}): Promise<MeetingProtocol | null> {
  const row = await dbGet<MeetingProtocolRow>(
    `SELECT * FROM meeting_protocols
     WHERE organization_id = ? AND meeting_id = ? AND version = ? AND status = 'approved'
     LIMIT 1`,
    [input.organizationId, input.meetingId, input.version],
    { fallback: false }
  );
  return row ? mapProtocolRow(row, input.organizationId) : null;
}

export interface ProtocolPreview {
  /** Zawsze null — draft nie jest utrwalany (W109b). */
  id: string | null;
  /** "1.0" przed pierwszą publikacją, inaczej next(opublikowana). */
  version: string;
  /** Widok roboczy jest ZAWSZE 'draft' (migawka żyje tylko w approved). */
  status: 'draft' | 'approved';
  /** ZAWSZE żywo ze źródeł — nigdy `content_json`. */
  content: ProtocolContent;
  /** Ostatnia OPUBLIKOWANA wersja (approved) lub null przed pierwszą publikacją. */
  publishedVersion: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  errataNote: string;
  /** Zawsze false — draft nie zapisuje wiersza. */
  persisted: boolean;
}

/**
 * Czysty odczyt protokołu do renderu — widok roboczy. W109b: draft składa się
 * ŻYWO ze źródeł (agenda, decyzje, akcje, uczestnicy) i NIGDY nie zwraca
 * migawki `content_json`; ta przechowuje wyłącznie wersję OPUBLIKOWANĄ. GET nie
 * zaśmieca `meeting_protocols`. `publishedVersion` mówi, czy coś już zamrożono
 * (viewer bramkuje tym „Approve"/erratę, bo `status` jest tu zawsze 'draft').
 */
export async function previewProtocol(input: {
  organizationId: string;
  meetingId: string;
}): Promise<ProtocolPreview> {
  const published = await getLatestApprovedProtocol(input);
  const history = await listVersionInfo(input.organizationId, input.meetingId);
  const draftVersion = published ? nextProtocolVersion(published.version) : '1.0';
  const content = await buildProtocolContent({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
    approverName: null,
    versions: [
      ...history,
      { version: draftVersion, status: 'draft', approvedAt: null, approvedBy: null, errata: '' },
    ],
  });
  return {
    id: null,
    version: draftVersion,
    status: 'draft',
    content,
    publishedVersion: published?.version || null,
    approvedByName: published?.approvedByName || null,
    approvedAt: published?.approvedAt || null,
    errataNote: published?.errataNote || '',
    persisted: false,
  };
}

/**
 * W109b: jedyna ścieżka zapisu `meeting_protocols` — publikacja wersji
 * ZAMROŻONEJ (approved). Treść składana ŻYWO ze źródeł w momencie publikacji,
 * potem już nieodtwarzalna (migawka). Draft nigdy nie przechodzi tędy.
 */
async function insertApprovedVersion(input: {
  organizationId: string;
  meetingId: string;
  actorId: string;
  version: string;
  errataNote: string;
}): Promise<MeetingProtocol> {
  const now = new Date().toISOString();
  const actorName =
    (await resolveUserNames(input.organizationId, [input.actorId])).get(input.actorId) || null;
  const history = await listVersionInfo(input.organizationId, input.meetingId);
  const content = await buildProtocolContent({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
    approverName: actorName,
    versions: [
      ...history,
      {
        version: input.version,
        status: 'approved',
        approvedAt: now,
        approvedBy: actorName,
        errata: input.errataNote,
      },
    ],
  });
  const id = uuidv4();
  const digest = computeSourceDigest(content);
  await dbRun(
    `INSERT INTO meeting_protocols (
       id, organization_id, meeting_id, version, status, content_json,
       source_digest, approved_by_user_id, approved_at, errata_note,
       created_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.organizationId,
      input.meetingId,
      input.version,
      JSON.stringify(content),
      digest,
      input.actorId,
      now,
      input.errataNote,
      input.actorId,
      now,
      now,
    ],
    { fallback: false }
  );
  const row = await dbGet<MeetingProtocolRow>(
    `SELECT * FROM meeting_protocols WHERE organization_id = ? AND id = ? LIMIT 1`,
    [input.organizationId, id],
    { fallback: false }
  );
  if (!row) throw new MeetingProtocolError('MEETING_PROTOCOL_INSERT_UNREADABLE');
  return mapProtocolRow(row, input.organizationId);
}

/**
 * Akcept prowadzącego: PIERWSZA publikacja — zamraża v1.0 z żywych źródeł.
 * Rzuca MEETING_PROTOCOL_ALREADY_APPROVED, gdy opublikowana wersja już istnieje
 * (kolejne zmiany idą przez createErrataVersion, nie przez ponowny akcept).
 */
export async function approveProtocol(input: {
  organizationId: string;
  meetingId: string;
  actorId: string;
}): Promise<MeetingProtocol> {
  const published = await getLatestApprovedProtocol({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
  });
  if (published) {
    throw new MeetingProtocolError('MEETING_PROTOCOL_ALREADY_APPROVED');
  }
  return insertApprovedVersion({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
    actorId: input.actorId,
    version: '1.0',
    errataNote: '',
  });
}

/**
 * Edycja zatwierdzonego protokołu: publikuje NOWĄ zamrożoną wersję (v1.1, v1.2,
 * …) z erratą, złożoną żywo ze źródeł; poprzednia wersja zostaje nietknięta
 * (historia wersji). Rzuca MEETING_PROTOCOL_NOT_APPROVED, gdy brak opublikowanej.
 */
export async function createErrataVersion(input: {
  organizationId: string;
  meetingId: string;
  actorId: string;
  errataNote: string;
}): Promise<MeetingProtocol> {
  const published = await getLatestApprovedProtocol({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
  });
  if (!published) {
    throw new MeetingProtocolError('MEETING_PROTOCOL_NOT_APPROVED');
  }
  return insertApprovedVersion({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
    actorId: input.actorId,
    version: nextProtocolVersion(published.version),
    errataNote: input.errataNote,
  });
}
