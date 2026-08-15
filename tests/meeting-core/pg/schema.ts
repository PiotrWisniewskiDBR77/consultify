/**
 * schema.ts — minimalny schemat Meeting Core dla scratch-bazy testowej.
 *
 * ŹRÓDŁO PRAWDY: kolumny SKOPIOWANE (nie wymyślone) z realnej migracji repo
 * `server/migrations-v2/001_baseline_20260413.sql`:
 *   - meetings            (linia ~19727)
 *   - meeting_follow_ups  (linia ~19677)
 *   - tasks               (linia ~28497)
 *   - decisions           (linia ~10927)
 *   - audit_events        (linia ~5823)
 *
 * Rozjazd schematu testowego z produkcyjnym to DOKŁADNIE ta pułapka, której
 * ten plik ma unikać (patrz CLAUDE.md → ZŁOTE REGUŁY). Dlatego: kolumny
 * poniżej są przepisane 1:1 z baseline (nazwa, typ, default), nie
 * "improwizowane". Tam, gdzie z tabeli wzięto tylko PODZBIÓR kolumn (tasks,
 * decisions — bo pełne tabele mają dziesiątki kolumn niezwiązanych z Meeting
 * Core), jest to jawnie udokumentowane niżej przy każdej tabeli.
 *
 * CO CELOWO POMINIĘTO I DLACZEGO
 * --------------------------------
 * - meetings, meeting_follow_ups, audit_events: PEŁNY zestaw kolumn z
 *   baseline — te tabele są już małe/płaskie, nie było powodu do cięcia.
 * - tasks: baseline ma >60 kolumn (SLA/eskalacje, budżet, evidence, AI
 *   insight, notify_on_*, weight, backup_assignee_id, itd. — mechanika
 *   Execution/Workflow niezwiązana z Meeting Core). Zostawiono tylko
 *   kolumny potrzebne testom Meeting Core: identyfikację/scoping
 *   (id, organization_id, project_id, initiative_id), treść (title,
 *   description, status, priority), przypisanie (assignee_id, reporter_id,
 *   created_by), terminy (due_date, completed_at, created_at, updated_at)
 *   oraz ślad pochodzenia z meetingu (source_type, source_id) — to pole jest
 *   tym, przez które task odwołuje się z powrotem do meetingu/follow-upu.
 * - decisions: baseline ma dodatkowo workflow/playbook/PMO-domain/
 *   escalation-deadline/required_fields_status itd. (mechanika Decision
 *   Workflow niezwiązana z Meeting Core). Zostawiono identyfikację/scoping
 *   (id, organization_id, project_id, initiative_id, task_id), treść
 *   (title, description, type), właściciela decyzji (decision_maker_id,
 *   created_by), status/wynik (status, selected_option,
 *   decision_rationale, decided_at) oraz ślad pochodzenia (source_type,
 *   source_id) — analogicznie do tasks, to nim decision łączy się z
 *   powrotem do meetingu.
 *
 * Jeśli test Meeting Core potrzebuje kolumny, której tu brak — dopisz ją
 * TUTAJ, przepisując definicję z baseline (nie zgadując typu/defaultu).
 */

interface QueryRunner {
  query(sql: string): Promise<unknown>;
}

const MEETINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS meetings (
    id text PRIMARY KEY,
    organization_id text NOT NULL,
    project_id text,
    title text NOT NULL,
    start_at text NOT NULL,
    end_at text NOT NULL,
    location text DEFAULT ''::text,
    attendees_json text DEFAULT '[]'::text,
    pre_read_json text DEFAULT '[]'::text,
    agenda_json text DEFAULT '[]'::text,
    decisions_json text DEFAULT '[]'::text,
    status text DEFAULT 'scheduled'::text,
    created_by text NOT NULL,
    created_at text DEFAULT now(),
    updated_at text DEFAULT now()
  );
`;

const MEETING_FOLLOW_UPS_TABLE = `
  CREATE TABLE IF NOT EXISTS meeting_follow_ups (
    id text PRIMARY KEY,
    meeting_id text NOT NULL REFERENCES meetings(id),
    title text NOT NULL,
    owner text DEFAULT ''::text,
    status text DEFAULT 'open'::text,
    created_at text DEFAULT now(),
    updated_at text DEFAULT now()
  );
`;

// Podzbiór kolumn tasks — patrz komentarz nagłówkowy pliku.
const TASKS_TABLE = `
  CREATE TABLE IF NOT EXISTS tasks (
    id text PRIMARY KEY,
    project_id text,
    organization_id text NOT NULL,
    initiative_id text,
    title text NOT NULL,
    description text,
    status text DEFAULT 'todo'::text,
    priority text DEFAULT 'medium'::text,
    assignee_id text,
    reporter_id text,
    due_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    created_by text,
    source_type text,
    source_id text
  );
`;

// Podzbiór kolumn decisions — patrz komentarz nagłówkowy pliku.
const DECISIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS decisions (
    id text PRIMARY KEY,
    organization_id text NOT NULL,
    project_id text,
    initiative_id text,
    task_id text,
    title text NOT NULL,
    description text,
    type text NOT NULL,
    decision_maker_id text NOT NULL,
    status text DEFAULT 'pending'::text,
    selected_option text,
    decision_rationale text,
    decided_at timestamp without time zone,
    created_by text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_type text,
    source_id text
  );
`;

const AUDIT_EVENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS audit_events (
    id text PRIMARY KEY,
    ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    actor_user_id text,
    actor_type text DEFAULT 'USER'::text NOT NULL,
    org_id text,
    action_type text NOT NULL,
    entity_type text,
    entity_id text,
    metadata_json text DEFAULT '{}'::text,
    ip text,
    user_agent text,
    before_json text,
    after_json text,
    actor_id text,
    action text,
    resource_type text,
    resource_id text
  );
`;

/**
 * Zakłada minimalny schemat Meeting Core w podanej (scratch) bazie.
 * Idempotentne (CREATE TABLE IF NOT EXISTS) — bezpieczne do wywołania
 * wielokrotnie w jednym procesie testowym.
 */
export async function createMeetingCoreSchema(db: QueryRunner): Promise<void> {
  // Kolejność ma znaczenie: meeting_follow_ups ma FK na meetings.
  await db.query(MEETINGS_TABLE);
  await db.query(MEETING_FOLLOW_UPS_TABLE);
  await db.query(TASKS_TABLE);
  await db.query(DECISIONS_TABLE);
  await db.query(AUDIT_EVENTS_TABLE);
}
