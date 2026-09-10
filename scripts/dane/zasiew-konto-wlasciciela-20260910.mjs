#!/usr/bin/env node
/**
 * zasiew-konto-wlasciciela-20260910.mjs — zadanie S-1 (Tokio).
 *
 * CEL: konto właściciela `piotr.wisniewski@dbr77.com`
 * (users.id = 1bd98637-14ad-45d5-a120-b92ff0d4dfcd, org DBR77) na ŻYWEJ bazie
 * STAGING (thomas) ma być PEŁNE we wszystkich modułach MVP — tak, żeby po
 * odświeżeniu ekranów zespół na targach w Tokio widział realną pracę, a nie
 * puste listy.
 *
 * ============================================================================
 * KROK 0 — CZYTELNIKI PER UŻYTKOWNIK (zmierzone w kodzie PRZED zapisem)
 * ============================================================================
 * Każde przepięcie niżej ma udokumentowanego czytelnika (plik:linia) — nic nie
 * jest zgadywane po nazwie kolumny.
 *
 *  Moja Praca → Zadania         tasks.assignee_id
 *      my-work.routes.ts:1134 (`AND t.assignee_id = ?`)
 *      my-work.routes.ts:1727/1752/1779 (inbox: overdue / blocked / open)
 *      personal-tasks: my-work.routes.ts:716+1234 (buildPersonalTaskOwnerScope
 *      → `t.assignee_id = ?`, wariant e-mailowy tylko przy fladze/demo)
 *  Moja Praca → Skrzynka (kanoniczna)  canonical_inbox_items.user_id
 *      inboxService.ts:359-390 (`WHERE user_id = ? AND organization_id = ?`),
 *      getInboxStats: inboxService.ts:589-595
 *  Moja Praca → Skrzynka (legacy)      notifications.user_id + read=0
 *      my-work.routes.ts:1856
 *  Moja Praca → Decyzje / Decyzje do mojej akceptacji
 *      decisions.decision_maker_id — my-work/decisions.routes.ts:93/185/193,
 *      my-work/stats.routes.ts:246 (`decision_maker_id = ? OR created_by = ?`),
 *      my-work/home.routes.ts:327/1460, my-work.routes.ts:1810 (inbox,
 *      status IN ('pending','escalated')).
 *      decision_owner_id NIE jest czytane przez żaden ekran (80/80 NULL).
 *  Moja Praca → Kalendarz        meetings.created_by OR attendees_json LIKE
 *      '%"<userId>"%' — my-work/calendar.routes.ts:609-618; v8/my-work.routes
 *      .ts:2617 (tylko created_by); decyzje w kalendarzu: created_by/assigned_to
 *      (v8/my-work.routes.ts:3064)
 *  Moja Praca → Pomysły          my_ideas.user_id (+ my_idea_maps.user_id)
 *      my-work.routes.ts:2777 / 2845
 *  Moja Praca → kamienie milowe inicjatyw
 *      initiatives.owner_execution_id | owner_business_id | sponsor_id |
 *      created_by — my-work/calendar.routes.ts:381-386,
 *      v8/my-work.routes.ts:2395-2398
 *  Inicjatywy (lista)            org-scoped; kolumna „Owner" bierze
 *      owner_business_id → owner_execution_id
 *      (initiativeUnifiedReader.ts:207, InitiativeController.ts:234/424)
 *  Realizacja (kokpit/zasoby)    initiatives.owner_execution_id
 *      (v8/execution-control.routes.ts:1129) + tasks.assignee_id
 *      (workloadCapacityService.ts:827+)
 *  Spotkania (lista)             ORG-scoped (meetingService.ts:216-240) —
 *      właściciel widzi wszystkie 15; DOSTĘP do karty spotkania wymaga
 *      created_by == user LUB udziału w attendees (meeting.routes.ts:150-160)
 *  Wywiad → moje przypisania     interview_assignments.assignee_user_id
 *      (InterviewController.ts:3743/4190/4275/5567,
 *      InterviewAssignmentService.ts:787) — alternatywnie
 *      interview_assignment_members.user_id
 *  Notatnik                      notebook_pages.owner_user_id
 *      (v8/my-work.routes.ts:1025 lista + canAccessNotebookRow:361-383 —
 *      visibility='private' ⇒ WYŁĄCZNIE owner_user_id) + notebooks.owner_user_id
 *  Materiały / baza wiedzy       knowledge_docs.owner_id
 *  Wyniki / KPI                  rvn_kpi_definitions.owner_user_id,
 *      rvn_kpi_scorecards.owner_user_id, okr_vnext_key_results.owner_user_id
 *  Audyty                        audit_programs.program_owner_id, audits.created_by
 *  Ocena                         assessments.created_by
 *  Czat (Teresa)                 conversations.user_id
 *      (conversations.routes.ts:274 `WHERE c.user_id = ?`, 289, 586) —
 *      historia w conversation_messages (BEZ wektorów, lista ich nie wymaga)
 *  Organizacja / Ustawienia      organization_members + users (już OK) — NIE RUSZAM
 *
 * ============================================================================
 * ZMIERZONY STAN PRZED (2026-09-10, ta sama baza)
 * ============================================================================
 * Konto nowe (1bd98637) miało ZERO wierszy biznesowych. Znalezione DWA
 * naturalne, uczciwe źródła przepięcia:
 *
 *  (1) `piotr@dbr77.com` = bf0f01a2-9ada-4cb8-a331-4dce1930e4f3 — TEN SAM
 *      CZŁOWIEK (Piotr Wiśniewski, ADMIN, ta sama org, starsze konto z
 *      2026-04-03). Jego wiersze: tasks.assignee_id 4, tasks.owner_id 2,
 *      decisions.decision_maker_id 12 (7 w stanie escalated/ESCALATED, więc
 *      widocznych w „do mojej akceptacji"), my_ideas 8, my_idea_maps 8,
 *      meetings.created_by 5 (angielskie tytuły), meeting_participants 5,
 *      conversations 6, projects.owner_id 1, initiative_resources 1, tp_* 16.
 *
 *  (2) `d2b6a316-08c5-47cf-9bf7-4ba50311d5a2` — UŻYTKOWNIK-WIDMO: NIE MA GO
 *      w tabeli `users` (SELECT count(*) = 0), a jest właścicielem 569/573
 *      pozycji skrzynki DBR77, 458 rozmów czatu, 46 stron notatnika, 25
 *      definicji KPI, 10 spotkań, 10 ocen, 7 dokumentów, 6 kluczowych
 *      rezultatów, 3 kart wyników, 1 programu audytu. Te dane są dziś
 *      NIEWIDOCZNE DLA NIKOGO — żaden żywy login ich nie odczyta. Przepięcie
 *      CZĘŚCI z nich na właściciela to jednocześnie naprawa sieroctwa.
 *
 * ============================================================================
 * TECHNIKI
 * ============================================================================
 *  (A) PRZEPIĘCIE — UPDATE kolumny właściciela na istniejących wierszach:
 *      A1 = całość ze starego konta właściciela (ten sam człowiek),
 *      A2 = KWOTOWANY wycinek z użytkownika-widma (właściciel ma być głównym
 *           bohaterem, nie jedynym — reszta zostaje jak była),
 *      A3 = wiersze NICZYJE w org (assignee_id/decision_maker_id/owner_*
 *           = NULL) — bez odbierania czegokolwiek żywym członkom zespołu.
 *      NIE zmienia tytułów, statusów, terminów ani treści istniejących wierszy.
 *
 *  (B) DOSIEW — INSERT nowych wierszy PO ANGIELSKU, tam gdzie w organizacji
 *      czegoś fizycznie nie ma: przyszłe spotkania (org ma 0 spotkań w
 *      przyszłości), zadania z terminem w przyszłości przypisane właścicielowi
 *      (org ma 0 nieprzypisanych zadań z przyszłym terminem), notatki EN,
 *      powiadomienia EN.
 *
 * IDEMPOTENCJA: przepięcia kwotowane liczą, ile wierszy właściciel JUŻ ma w
 * danej puli, i dobierają tylko brakującą różnicę (`max(0, kwota - posiadane)`)
 * — drugi przebieg wybiera 0. Dosiew używa STAŁYCH id `s1-tokio-*` +
 * `ON CONFLICT (id) DO NOTHING`.
 *
 * ============================================================================
 * UŻYCIE
 * ============================================================================
 *   node scripts/dane/zasiew-konto-wlasciciela-20260910.mjs --op=measure
 *   node scripts/dane/zasiew-konto-wlasciciela-20260910.mjs --op=all --dry-run
 *   FORCE_S1=true node scripts/dane/... --op=all --apply
 *
 * Adres bazy: DATABASE_URL albo plik ~/.s1_dburl (nie trafia do repo).
 * Host-guard: WYŁĄCZNIE `thomas` (staging). `centerbeam` (produkcja) i
 * `trolley` (demo) są twardo odrzucane.
 * Manifesty (pełne wiersze PRZED zmianą) → ~/Developer/consultify-dumps/manifesty
 * + kopia w evidence/s1-tokio/manifesty. CSV PRZED/PO → evidence/s1-tokio/.
 * PUNKT COFNIĘCIA: ~/Developer/consultify-dumps/staging-thomas-przed-tokio-20260910-2040.dump
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const KAT_DOWODOW = path.join(REPO_ROOT, 'evidence', 's1-tokio');
const KAT_MANIFEST_REPO = path.join(KAT_DOWODOW, 'manifesty');
const KAT_MANIFEST_DUMPS = path.join(
  process.env.HOME || '.',
  'Developer',
  'consultify-dumps',
  'manifesty'
);

const ORG = 'a3e05d4a-5397-419d-b486-8e44366c0063';
const NOWY = '1bd98637-14ad-45d5-a120-b92ff0d4dfcd'; // piotr.wisniewski@dbr77.com
const STARY = 'bf0f01a2-9ada-4cb8-a331-4dce1930e4f3'; // piotr@dbr77.com (ten sam człowiek)
const WIDMO = 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2'; // brak wiersza w users
const PUNKT_COFNIECIA =
  '~/Developer/consultify-dumps/staging-thomas-przed-tokio-20260910-2040.dump';

const HOST_STAGING = 'thomas.proxy.rlwy.net';

// ---------------------------------------------------------------------------
// Host-guard
// ---------------------------------------------------------------------------
function sprawdzHost(databaseUrl) {
  const u = new URL(databaseUrl);
  if (/centerbeam/i.test(u.hostname)) {
    throw new Error('PRODUKCJA (centerbeam) — STOP.');
  }
  if (/trolley/i.test(u.hostname)) {
    throw new Error('DEMO (trolley) — STOP. S-1 dotyczy WYŁĄCZNIE staging.');
  }
  const lokalne = ['127.0.0.1', 'localhost', '::1', '0.0.0.0'];
  if (lokalne.includes(u.hostname)) return;
  if (u.hostname !== HOST_STAGING) {
    throw new Error(`Host ${u.hostname} nie jest hostem STAGING — STOP.`);
  }
}

function adresBazy() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const plik = path.join(process.env.HOME || '.', '.s1_dburl');
  if (fs.existsSync(plik)) return fs.readFileSync(plik, 'utf8').trim();
  throw new Error('Brak DATABASE_URL i brak ~/.s1_dburl');
}

// ---------------------------------------------------------------------------
// Manifest + CSV
// ---------------------------------------------------------------------------
function zapiszManifest(op, dane) {
  fs.mkdirSync(KAT_MANIFEST_REPO, { recursive: true });
  const znacznik = new Date().toISOString().replace(/[:.]/g, '-');
  const nazwa = `manifest-s1-${op}-${znacznik}.json`;
  const tresc = JSON.stringify(dane, null, 2);
  const plikRepo = path.join(KAT_MANIFEST_REPO, nazwa);
  fs.writeFileSync(plikRepo, tresc, 'utf8');
  try {
    fs.mkdirSync(KAT_MANIFEST_DUMPS, { recursive: true });
    fs.writeFileSync(path.join(KAT_MANIFEST_DUMPS, nazwa), tresc, 'utf8');
  } catch (e) {
    console.error('[uwaga] kopia manifestu w consultify-dumps nieudana:', e.message);
  }
  return plikRepo;
}

function piszCsv(nazwaPliku, naglowki, wiersze) {
  fs.mkdirSync(KAT_DOWODOW, { recursive: true });
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linie = [
    naglowki.join(','),
    ...wiersze.map((w) => naglowki.map((h) => esc(w[h])).join(',')),
  ];
  const sciezka = path.join(KAT_DOWODOW, nazwaPliku);
  fs.writeFileSync(sciezka, linie.join('\n') + '\n', 'utf8');
  return sciezka;
}

// ---------------------------------------------------------------------------
// POMIAR — replika zapytań czytelników z KROKU 0, 1:1 co do WHERE
// ---------------------------------------------------------------------------
const CZYTELNIKI = [
  {
    ekran: 'Moja Praca → Zadania (GET /api/my-work/tasks)',
    zrodlo: 'my-work.routes.ts:1134',
    sql: `SELECT count(*) n FROM tasks WHERE organization_id=$1 AND assignee_id=$2
          AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')`,
  },
  {
    ekran: 'Moja Praca → Skrzynka: zaległe zadania',
    zrodlo: 'my-work.routes.ts:1727',
    sql: `SELECT count(*) n FROM tasks WHERE organization_id=$1 AND assignee_id=$2
          AND due_date IS NOT NULL AND date(due_date) < CURRENT_DATE
          AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')`,
  },
  {
    ekran: 'Moja Praca → Skrzynka: otwarte zadania (nie zaległe)',
    zrodlo: 'my-work.routes.ts:1779',
    sql: `SELECT count(*) n FROM tasks WHERE organization_id=$1 AND assignee_id=$2
          AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')
          AND lower(coalesce(status,'')) <> 'blocked'
          AND blocked_by_decision_id IS NULL AND (blocked_reason IS NULL OR blocked_reason='')
          AND (due_date IS NULL OR date(due_date) >= CURRENT_DATE)`,
  },
  {
    ekran: 'Moja Praca → Skrzynka kanoniczna (GET /inbox/canonical)',
    zrodlo: 'inboxService.ts:359-390',
    sql: `SELECT count(*) n FROM canonical_inbox_items WHERE user_id=$2 AND organization_id=$1`,
  },
  {
    ekran: 'Moja Praca → Skrzynka kanoniczna: nierozliczone (pending)',
    zrodlo: 'inboxService.ts:589',
    sql: `SELECT count(*) n FROM canonical_inbox_items WHERE user_id=$2 AND organization_id=$1
          AND status='pending'`,
  },
  {
    ekran: 'Moja Praca → Skrzynka: nieprzeczytane powiadomienia',
    zrodlo: 'my-work.routes.ts:1856',
    sql: `SELECT count(*) n FROM notifications WHERE user_id=$2 AND coalesce(read,0)=0
          AND $1::text IS NOT NULL`,
  },
  {
    ekran: 'Decyzje do mojej akceptacji (pending/escalated)',
    zrodlo: 'my-work/decisions.routes.ts:93',
    sql: `SELECT count(*) n FROM decisions WHERE organization_id=$1 AND decision_maker_id=$2
          AND lower(coalesce(status,'')) IN ('pending','escalated')`,
  },
  {
    ekran: 'Decyzje — wszystkie moje (decydent lub wnioskodawca)',
    zrodlo: 'my-work/stats.routes.ts:246',
    sql: `SELECT count(*) n FROM decisions WHERE organization_id=$1
          AND (decision_maker_id=$2 OR created_by=$2)`,
  },
  {
    ekran: 'Inicjatywy — moje (owner/sponsor/autor)',
    zrodlo: 'v8/my-work.routes.ts:2395-2398',
    sql: `SELECT count(*) n FROM initiatives WHERE organization_id=$1
          AND (owner_execution_id=$2 OR owner_business_id=$2 OR sponsor_id=$2 OR created_by=$2)`,
  },
  {
    ekran: 'Realizacja — inicjatywy z właścicielem realizacji = ja',
    zrodlo: 'v8/execution-control.routes.ts:1129',
    sql: `SELECT count(*) n FROM initiatives WHERE organization_id=$1 AND owner_execution_id=$2`,
  },
  {
    ekran: 'Kalendarz → spotkania (organizator lub uczestnik)',
    zrodlo: 'my-work/calendar.routes.ts:609-618',
    sql: `SELECT count(*) n FROM meetings WHERE organization_id=$1
          AND (created_by=$2 OR attendees_json LIKE '%"'||$2||'"%')`,
  },
  {
    ekran: 'Kalendarz → spotkania PRZYSZŁE (moje)',
    zrodlo: 'my-work/calendar.routes.ts:621',
    sql: `SELECT count(*) n FROM meetings WHERE organization_id=$1
          AND (created_by=$2 OR attendees_json LIKE '%"'||$2||'"%')
          AND left(start_at::text,10) >= to_char(now(),'YYYY-MM-DD')`,
  },
  {
    ekran: 'Moje pomysły (GET /my-ideas)',
    zrodlo: 'my-work.routes.ts:2777',
    sql: `SELECT count(*) n FROM my_ideas WHERE user_id=$2 AND organization_id=$1`,
  },
  {
    ekran: 'Wywiad → moje przypisania',
    zrodlo: 'InterviewController.ts:4190',
    sql: `SELECT count(*) n FROM interview_assignments WHERE organization_id=$1 AND assignee_user_id=$2`,
  },
  {
    ekran: 'Notatnik → moje strony',
    zrodlo: 'v8/my-work.routes.ts:1025 + canAccessNotebookRow:369',
    sql: `SELECT count(*) n FROM notebook_pages WHERE organization_id=$1 AND owner_user_id=$2`,
  },
  {
    ekran: 'Notatnik → moje notatniki',
    zrodlo: 'notebooks.owner_user_id',
    sql: `SELECT count(*) n FROM notebooks WHERE organization_id=$1 AND owner_user_id=$2`,
  },
  {
    ekran: 'Materiały → moje dokumenty',
    zrodlo: 'knowledge_docs.owner_id',
    sql: `SELECT count(*) n FROM knowledge_docs WHERE organization_id=$1 AND owner_id=$2`,
  },
  {
    ekran: 'Wyniki → KPI, których jestem właścicielem',
    zrodlo: 'rvn_kpi_definitions.owner_user_id',
    sql: `SELECT count(*) n FROM rvn_kpi_definitions WHERE organization_id=$1 AND owner_user_id=$2`,
  },
  {
    ekran: 'Wyniki → karty wyników (scorecards) moje',
    zrodlo: 'rvn_kpi_scorecards.owner_user_id',
    sql: `SELECT count(*) n FROM rvn_kpi_scorecards WHERE organization_id=$1 AND owner_user_id=$2`,
  },
  {
    ekran: 'Wyniki → kluczowe rezultaty (OKR) moje',
    zrodlo: 'okr_vnext_key_results.owner_user_id',
    sql: `SELECT count(*) n FROM okr_vnext_key_results WHERE organization_id=$1 AND owner_user_id=$2`,
  },
  {
    ekran: 'Audyty → programy, których jestem właścicielem',
    zrodlo: 'audit_programs.program_owner_id',
    sql: `SELECT count(*) n FROM audit_programs WHERE organization_id=$1 AND program_owner_id=$2`,
  },
  {
    ekran: 'Ocena → sesje, które prowadzę',
    zrodlo: 'assessments.created_by',
    sql: `SELECT count(*) n FROM assessments WHERE organization_id=$1 AND created_by=$2`,
  },
  {
    ekran: 'Czat (Teresa) → moje rozmowy',
    zrodlo: 'conversations.routes.ts:274',
    sql: `SELECT count(*) n FROM conversations WHERE user_id=$2
          AND (organization_id=$1 OR organization_id IS NULL) AND deleted_at IS NULL`,
  },
  {
    ekran: 'Czat → wiadomości w moich rozmowach',
    zrodlo: 'conversation_messages przez conversation_id',
    sql: `SELECT count(*) n FROM conversation_messages cm
          WHERE $1::text IS NOT NULL
            AND cm.conversation_id IN (SELECT id FROM conversations WHERE user_id=$2 AND deleted_at IS NULL)`,
  },
  {
    ekran: 'Projekty, których jestem właścicielem',
    zrodlo: 'projects.owner_id',
    sql: `SELECT count(*) n FROM projects WHERE organization_id=$1 AND owner_id=$2`,
  },
];

async function zmierz(c, userId) {
  const wynik = [];
  for (const r of CZYTELNIKI) {
    try {
      const res = await c.query(r.sql, [ORG, userId]);
      wynik.push({ ekran: r.ekran, zrodlo: r.zrodlo, wierszy: Number(res.rows[0].n) });
    } catch (e) {
      wynik.push({ ekran: r.ekran, zrodlo: r.zrodlo, wierszy: 'BŁĄD: ' + e.message });
    }
  }
  return wynik;
}

// ---------------------------------------------------------------------------
// A1 — całość ze starego konta właściciela (ten sam człowiek)
// ---------------------------------------------------------------------------
const A1_TABELE = [
  ['tasks', 'assignee_id'],
  ['tasks', 'owner_id'],
  ['tasks', 'reporter_id'],
  ['decisions', 'decision_maker_id'],
  ['decisions', 'created_by'],
  ['my_ideas', 'user_id'],
  ['my_idea_maps', 'user_id'],
  ['meetings', 'created_by'],
  ['meeting_participants', 'user_id'],
  ['conversations', 'user_id'],
  ['conversations', 'created_by'],
  ['projects', 'owner_id'],
  ['initiative_resources', 'user_id'],
  ['my_work_session_context', 'user_id'],
  ['tp_bases', 'created_by'],
  ['tp_tables', 'created_by'],
  ['tp_views', 'created_by'],
  ['tp_records', 'created_by'],
  ['tp_base_members', 'user_id'],
];

// ---------------------------------------------------------------------------
// A2 — kwotowany wycinek z użytkownika-widma
//   `filtr` zawęża pulę (np. tylko pozycje pending / tylko angielskie rozmowy);
//   `kolejnosc` czyni wybór deterministycznym;
//   `kwota` to docelowa liczba wierszy właściciela w TEJ SAMEJ puli.
// ---------------------------------------------------------------------------
const BEZ_POLSKICH = `title !~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'`;
// Dane demo = twarz produktu (CLAUDE.md): zero rekordów testowych na koncie
// właściciela. POMIAR: pula `approvals_gates` zawierała 5 artefaktów testowych
// („E2E Bulk BULK-q0y5wf", „E2E ToDecision-…", „TEST P0 link 178149…"),
// które pierwszy przebieg wciągnął do skrzynki.
const BEZ_TESTOWYCH = `title !~* '(^|[^a-z])(e2e|test|smoke|probe|qa[ -]|\\[m13seed\\]|BULK-|__)'`;

const A2_PULE = [
  {
    nazwa: 'skrzynka-zadania',
    tabela: 'canonical_inbox_items',
    dedupPo: [['source_entity_type', 'source_entity_id'], 'title'],
    kolumna: 'user_id',
    filtr: `organization_id = '${ORG}' AND status='pending' AND ${BEZ_TESTOWYCH} AND section='assigned_tasks' AND ${BEZ_POLSKICH}`,
    kolejnosc: `CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, created_at DESC, id`,
    kwota: 14,
  },
  {
    nazwa: 'skrzynka-akceptacje',
    tabela: 'canonical_inbox_items',
    dedupPo: [['source_entity_type', 'source_entity_id'], 'title'],
    kolumna: 'user_id',
    filtr: `organization_id = '${ORG}' AND status='pending' AND ${BEZ_TESTOWYCH} AND section='approvals_gates'`,
    kolejnosc: `CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, created_at DESC, id`,
    kwota: 8,
  },
  {
    nazwa: 'skrzynka-decyzje',
    tabela: 'canonical_inbox_items',
    dedupPo: [['source_entity_type', 'source_entity_id'], 'title'],
    kolumna: 'user_id',
    filtr: `organization_id = '${ORG}' AND status='pending' AND ${BEZ_TESTOWYCH} AND section='decisions_required'`,
    kolejnosc: `created_at DESC, id`,
    kwota: 4,
  },
  {
    nazwa: 'skrzynka-eskalacje',
    tabela: 'canonical_inbox_items',
    dedupPo: [['source_entity_type', 'source_entity_id'], 'title'],
    kolumna: 'user_id',
    filtr: `organization_id = '${ORG}' AND status='pending' AND ${BEZ_TESTOWYCH} AND section='blocked_escalations'`,
    kolejnosc: `created_at DESC, id`,
    // POMIAR: w puli `blocked_escalations` (77 pending) WSZYSTKIE wiersze mają
    // ten sam tytuł „Interview Assignment Overdue" — po odsiewie zostaje 1.
    // Kwota 2 zostawiona świadomie: skrzynka ma pokazać eskalację, ale nie
    // pięć klonów tego samego wiersza.
    kwota: 2,
  },
  {
    nazwa: 'skrzynka-kpi-i-sygnaly',
    tabela: 'canonical_inbox_items',
    dedupPo: [['source_entity_type', 'source_entity_id'], 'title'],
    kolumna: 'user_id',
    filtr: `organization_id = '${ORG}' AND status='pending' AND ${BEZ_TESTOWYCH} AND section IN ('ai_insights','fyi_system','fyi_mentions')`,
    kolejnosc: `CASE section WHEN 'ai_insights' THEN 0 WHEN 'fyi_mentions' THEN 1 ELSE 2 END, created_at DESC, id`,
    kwota: 7,
  },
  {
    nazwa: 'czat-rozmowy-EN',
    tabela: 'conversations',
    kolumna: 'user_id',
    // ★ POMIAR: `conversations.message_count` KŁAMIE — 6 rozmów przeniesionych ze
    // starego konta właściciela ma licznik 7-20, a w `conversation_messages`
    // ZERO wierszy (otwierają się puste). Warunek `EXISTS` liczy tylko rozmowy z
    // PRAWDZIWĄ historią, więc kwota nie zapełnia się pustymi kartami.
    filtr: `organization_id = '${ORG}' AND deleted_at IS NULL AND ${BEZ_POLSKICH}
            AND EXISTS (SELECT 1 FROM conversation_messages cm WHERE cm.conversation_id = conversations.id)`,
    kolejnosc: `message_count DESC, last_message_at DESC NULLS LAST, id`,
    kwota: 8,
    dedupPo: ['title'],
    takze: ['created_by'],
  },
  {
    nazwa: 'notatnik-notatniki',
    tabela: 'notebooks',
    kolumna: 'owner_user_id',
    filtr: `organization_id = '${ORG}'`,
    kolejnosc: `updated_at DESC NULLS LAST, id`,
    kwota: 2,
  },
  {
    nazwa: 'notatnik-strony',
    tabela: 'notebook_pages',
    kolumna: 'owner_user_id',
    filtr: `organization_id = '${ORG}'`,
    kolejnosc: `pinned DESC, updated_at DESC NULLS LAST, id`,
    kwota: 10,
  },
  {
    nazwa: 'materialy',
    tabela: 'knowledge_docs',
    kolumna: 'owner_id',
    filtr: `organization_id = '${ORG}' AND deleted_at IS NULL`,
    kolejnosc: `updated_at DESC NULLS LAST, id`,
    kwota: 5,
  },
  {
    nazwa: 'kpi-definicje',
    tabela: 'rvn_kpi_definitions',
    kolumna: 'owner_user_id',
    filtr: `organization_id = '${ORG}'`,
    kolejnosc: `updated_at DESC NULLS LAST, kpi_id`,
    kwota: 5,
    klucz: 'kpi_id',
  },
  {
    nazwa: 'kpi-karty-wynikow',
    tabela: 'rvn_kpi_scorecards',
    kolumna: 'owner_user_id',
    filtr: `organization_id = '${ORG}'`,
    kolejnosc: `updated_at DESC NULLS LAST, scorecard_id`,
    kwota: 2,
    klucz: 'scorecard_id',
  },
  {
    nazwa: 'okr-kluczowe-rezultaty',
    tabela: 'okr_vnext_key_results',
    kolumna: 'owner_user_id',
    filtr: `organization_id = '${ORG}'`,
    kolejnosc: `updated_at DESC NULLS LAST, key_result_id`,
    kwota: 4,
    klucz: 'key_result_id',
  },
  {
    nazwa: 'spotkania-widmo',
    tabela: 'meetings',
    kolumna: 'created_by',
    filtr: `organization_id = '${ORG}'`,
    kolejnosc: `start_at DESC, id`,
    kwota: 8, // razem z 5 przepiętymi z A1
  },
  {
    nazwa: 'audyty-programy',
    tabela: 'audit_programs',
    kolumna: 'program_owner_id',
    filtr: `organization_id = '${ORG}'`,
    kolejnosc: `updated_at DESC NULLS LAST, id`,
    kwota: 1,
  },
  {
    nazwa: 'oceny',
    tabela: 'assessments',
    kolumna: 'created_by',
    filtr: `organization_id = '${ORG}' AND upper(coalesce(status,'')) <> 'ARCHIVED'`,
    kolejnosc: `updated_at DESC NULLS LAST, id`,
    kwota: 1,
  },
];

// ---------------------------------------------------------------------------
// A3 — wiersze NICZYJE w organizacji (nikomu ich nie odbieramy)
// ---------------------------------------------------------------------------
const A3_PULE = [
  {
    nazwa: 'zadania-nieprzypisane-otwarte',
    tabela: 'tasks',
    kolumna: 'assignee_id',
    zrodloWartosc: null, // NULL
    pula: `organization_id = '${ORG}' AND lower(coalesce(status,'')) IN ('todo','in_progress')`,
    filtr: `organization_id = '${ORG}' AND assignee_id IS NULL
            AND lower(coalesce(status,'')) IN ('todo','in_progress')`,
    kolejnosc: `(CASE WHEN title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' THEN 1 ELSE 0 END),
                CASE lower(coalesce(priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                due_date ASC NULLS LAST, id`,
    kwota: 10,
    dedupPo: ['title'], // POMIAR: pula zawiera 4× ten sam „Audyt 3 maszyn krytycznych pod PdM"
    takze: ['owner_id'],
  },
  {
    nazwa: 'decyzje-bez-decydenta',
    tabela: 'decisions',
    kolumna: 'decision_maker_id',
    zrodloWartosc: null,
    pula: `organization_id = '${ORG}' AND lower(coalesce(status,'')) = 'pending'`,
    filtr: `organization_id = '${ORG}' AND decision_maker_id IS NULL
            AND lower(coalesce(status,'')) = 'pending'`,
    kolejnosc: `deadline ASC NULLS LAST, created_at DESC, id`,
    kwota: 6,
  },
  {
    nazwa: 'inicjatywy-wlasciciel-realizacji',
    tabela: 'initiatives',
    kolumna: 'owner_execution_id',
    zrodloWartosc: null,
    pula: `organization_id = '${ORG}'
            AND upper(coalesce(status,'')) IN ('IN_EXECUTION','APPROVED','PENDING_APPROVAL')
            AND id NOT LIKE '%acceptance%' AND name NOT LIKE '%(kopia)%'`,
    filtr: `organization_id = '${ORG}' AND owner_execution_id IS NULL
            AND upper(coalesce(status,'')) IN ('IN_EXECUTION','APPROVED','PENDING_APPROVAL')
            AND id NOT LIKE '%acceptance%' AND name NOT LIKE '%(kopia)%'`,
    kolejnosc: `(SELECT count(*) FROM tasks t WHERE t.initiative_id = initiatives.id) DESC, id`,
    kwota: 6,
  },
  {
    nazwa: 'inicjatywy-sponsor',
    tabela: 'initiatives',
    kolumna: 'sponsor_id',
    zrodloWartosc: null,
    pula: `organization_id = '${ORG}'
            AND upper(coalesce(status,'')) IN ('IN_EXECUTION','APPROVED','PENDING_APPROVAL')
            AND id NOT LIKE '%acceptance%' AND name NOT LIKE '%(kopia)%'`,
    filtr: `organization_id = '${ORG}' AND sponsor_id IS NULL
            AND upper(coalesce(status,'')) IN ('IN_EXECUTION','APPROVED','PENDING_APPROVAL')
            AND id NOT LIKE '%acceptance%' AND name NOT LIKE '%(kopia)%'`,
    kolejnosc: `(SELECT count(*) FROM tasks t WHERE t.initiative_id = initiatives.id) DESC, id`,
    kwota: 3,
  },
  {
    nazwa: 'wywiad-przypisania-sieroce',
    tabela: 'interview_assignments',
    kolumna: 'assignee_user_id',
    zrodloWartosc: 'SIEROTA',
    pula: `organization_id = '${ORG}' AND status = 'assigned'`,
    filtr: `organization_id = '${ORG}' AND status = 'assigned'
            AND assignee_user_id NOT IN (SELECT id::text FROM users)`,
    kolejnosc: `created_at DESC, id`,
    kwota: 3,
  },
];

// ---------------------------------------------------------------------------
// B — DOSIEW (po angielsku, realistycznie dla firmy doradczej DBR77)
// ---------------------------------------------------------------------------
const dni = (n) => {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString();
};
const dataDnia = (n) => dni(n).slice(0, 10);

const B_ZADANIA = [
  {
    id: 's1-tokio-task-01',
    title: 'Finalise MES rollout readiness pack for the Tokyo showcase',
    status: 'in_progress',
    priority: 'urgent',
    due: dataDnia(1),
    hours: 6,
    phase: 'execute',
  },
  {
    id: 's1-tokio-task-02',
    title: 'Review quality management gate criteria with the QA workstream',
    status: 'todo',
    priority: 'high',
    due: dataDnia(3),
    hours: 8,
    phase: 'design',
  },
  {
    id: 's1-tokio-task-03',
    title: 'Approve the transformation programme budget re-forecast (Q4)',
    status: 'todo',
    priority: 'high',
    due: dataDnia(5),
    hours: 4,
    phase: 'decide',
  },
  {
    id: 's1-tokio-task-04',
    title: 'Prepare the steering committee pack: benefits realisation to date',
    status: 'todo',
    priority: 'medium',
    due: dataDnia(8),
    hours: 10,
    phase: 'design',
  },
  {
    id: 's1-tokio-task-05',
    title: 'Close out supplier due diligence for the IoT sensor programme',
    status: 'in_progress',
    priority: 'medium',
    due: dataDnia(12),
    hours: 12,
    phase: 'execute',
  },
  {
    id: 's1-tokio-task-06',
    title: 'Agree the operating model for the new digital delivery unit',
    status: 'todo',
    priority: 'medium',
    due: dataDnia(15),
    hours: 16,
    phase: 'design',
  },
  {
    id: 's1-tokio-task-07',
    title: 'Sign off the data migration cutover plan with the plant team',
    status: 'todo',
    priority: 'low',
    due: dataDnia(21),
    hours: 6,
    phase: 'plan',
  },
];

const B_SPOTKANIA = [
  {
    id: 's1-tokio-meeting-01',
    title: 'Transformation Steering Committee — Q4 checkpoint',
    start: dni(1),
    endH: 90,
    location: 'Warsaw HQ — Board Room',
    agenda: [
      'Programme status and benefits realisation to date',
      'Budget re-forecast — decision required',
      'MES rollout: readiness for wave 2 plants',
      'Risks and escalations',
    ],
  },
  {
    id: 's1-tokio-meeting-02',
    title: 'MES Rollout — wave 2 readiness review',
    start: dni(4),
    endH: 60,
    location: 'Microsoft Teams',
    agenda: [
      'Site readiness scorecard (5 plants)',
      'Integration test results and open defects',
      'Training and change readiness',
      'Go / no-go recommendation',
    ],
  },
  {
    id: 's1-tokio-meeting-03',
    title: 'Quality Management 4.0 — monthly performance review',
    start: dni(9),
    endH: 60,
    location: 'Poznań plant — Meeting Room 2',
    agenda: [
      'First pass yield and scrap trend',
      'CAPA backlog and ageing',
      'Vision inspection pilot — results',
      'Next month priorities',
    ],
  },
];

const B_NOTATKI = [
  {
    id: 's1-tokio-note-01',
    title: 'Tokyo showcase — narrative and demo running order',
    tresc:
      'Opening: the client problem we solve — fragmented transformation delivery.\n' +
      'Demo order: My Work → Initiatives → Execution → Results → AI chat.\n' +
      'Proof points: 106 initiatives under governance, 248 tasks, gated decisions with an audit trail.\n' +
      'Close: what a 90-day pilot looks like for a mid-size manufacturer.',
  },
  {
    id: 's1-tokio-note-02',
    title: 'MES rollout — lessons learned from wave 1',
    tresc:
      'What worked: single site readiness scorecard, one owner per plant, weekly gate.\n' +
      'What did not: master data clean-up started too late; training booked before UAT closed.\n' +
      'Change for wave 2: freeze master data four weeks before cutover; UAT exit gate blocks training.',
  },
  {
    id: 's1-tokio-note-03',
    title: 'Quality management 4.0 — value case assumptions',
    tresc:
      'Baseline: first pass yield 91.4%, scrap 2.8% of production cost.\n' +
      'Target after 12 months: FPY 95%, scrap 1.9%.\n' +
      'Assumption to validate with the plant controller: 60% of the scrap reduction is addressable by inspection, the remainder needs process change.',
  },
];

const B_POWIADOMIENIA = [
  {
    id: 's1-tokio-notif-01',
    type: 'DECISION_REQUESTED',
    title: 'Decision requested: transformation budget re-forecast (Q4)',
    message:
      'The programme office has submitted the Q4 budget re-forecast for your approval. Deadline: end of this week.',
    priority: 'high',
  },
  {
    id: 's1-tokio-notif-02',
    type: 'KPI_DEVIATION',
    title: 'KPI out of tolerance: first pass yield (Poznań plant)',
    message:
      'First pass yield fell to 89.7% against a 93% threshold for the second week running. A recovery card has been opened.',
    priority: 'high',
  },
  {
    id: 's1-tokio-notif-03',
    type: 'TASK_ASSIGNED',
    title: 'You were assigned: MES rollout readiness pack',
    message: 'Due tomorrow. Linked to the Tokyo showcase preparation.',
    priority: 'normal',
  },
  {
    id: 's1-tokio-notif-04',
    type: 'MENTION',
    title: 'Katarzyna Wójcik mentioned you in the CAPA backlog review',
    message:
      'They asked whether the vision inspection pilot should be extended to the second welding cell before the next gate.',
    priority: 'normal',
  },
];


// ---------------------------------------------------------------------------
// KOREKTA — cofnięcie NADMIAROWEGO przepięcia A3 (incydent 2026-09-10)
// ---------------------------------------------------------------------------
// CO SIĘ STAŁO: pierwsze trzy uruchomienia `--apply` przerwały się na błędach
// schematu (uuid=text, participant_kind NOT NULL, pinned INTEGER) już PO
// wykonaniu etapu A3, a manifest zapisywał się dopiero na końcu — więc te
// przebiegi nie zostawiły manifestu. Do tego licznik `posiadane` w A3 liczył po
// filtrze zawierającym warunek źródła (`... IS NULL`), więc zawsze zwracał 0 i
// każdy przebieg dobierał kolejną PEŁNĄ kwotę. Efekt: A3 wykonało się 3×.
//
// CO NAPRAWIA TA OPERACJA: zbiór DOCELOWY jest znany dokładnie — pochodzi z
// manifestu DRY-RUN sprzed pierwszego `--apply` (evidence/s1-tokio/manifesty/
// manifest-s1-all-dryrun-2026-09-10T18-59-42-356Z.json). Wszystko, co dziś
// wskazuje na właściciela w populacjach A3, a NIE należy do tego zbioru (ani do
// A1, ani do dosiewu), wraca do wartości pierwotnej = NULL.
//
// ★ NIEODWRACALNE: `interview_assignments.assignee_user_id`. Pierwotne wartości
// to były identyfikatory NIEISTNIEJĄCYCH użytkowników (sieroty — potwierdzone:
// 0 wierszy w `users`, 0 członków, 0 zdarzeń, brak sesji). Manifest ma tylko 3
// z 9; pozostałych 6 nie da się odtworzyć, a kolumna nie przyjmuje NULL bez
// ryzyka dla czytelnika. Zostają przypisane właścicielowi — zgłoszone jako STOP.
const KOREKTA = [
  {
    tabela: 'tasks',
    kolumna: 'assignee_id',
    takze: ['owner_id'],
    populacja: `organization_id = '${ORG}' AND lower(coalesce(status,'')) IN ('todo','in_progress')`,
    zostaw: [
      // A1 — ze starego konta właściciela (ten sam człowiek)
      'task-dbr77-load-030', '4b9c9ad3-307a-44e2-9821-ce94dbedcf16',
      'task-dbr77-load-029', '4d63149c-9dcf-4f0b-b2b7-6d450b81f1da',
      // A3 — pierwsza (jedyna zamierzona) partia z puli nieprzypisanych
      '9cd03a9a-360c-45b0-a733-6f6bdeac626c', 'f8df57ed-3f2e-421e-89cd-1911d4c39984',
      '6d88220c-a40b-40eb-a52c-95c286f515f4', 'bdda17a7-fa6a-428a-9cc8-8d09fbaec1df',
      '4ad5b26a-7acb-4a45-b493-9c0f6af3e9fe', '83b929e4-b567-4f34-a7e2-34469cb0a207',
      '7795c3b1-2e86-4a8b-82fc-fef33bb3b9eb', '5d13b4ae-a457-442c-865c-7052628cf371',
      '0732411e-a663-4806-bd16-317aeaf91654', 'b0d14d36-e313-44ea-b8c4-8b6e6cbd1d4b',
      // B — dosiew (nowe zadania EN)
      ...B_ZADANIA.map((t) => t.id),
    ],
  },
  {
    tabela: 'decisions',
    kolumna: 'decision_maker_id',
    populacja: `organization_id = '${ORG}' AND lower(coalesce(status,'')) = 'pending'`,
    zostaw: [
      // A1 (12 decyzji ze starego konta — część ma status pending)
      'c1c8cac3-7ebe-4934-8732-a3bb8d6786aa', '12682911-847c-48d4-b6f4-012439c74b4f',
      'ce6d80a7-047a-42dd-8230-6c086581d3cf', 'dd76d480-d3b1-439c-8b8a-0f24b9321c32',
      '5cd13199-b44e-472e-a071-585b2296f2d0', 'a37a359f-26a1-4da9-a537-cacdb38b91cc',
      'ec425792-3ee8-48e8-98dc-41076a730d0b', 'ff916b26-3396-4842-a590-ff97eb8d946d',
      'ad544506-cd18-4c11-afc6-6d5c6e33009c', 'ed9f6dbc-70bb-41ad-9ff0-e5170cf35a99',
      '728f62da-7d44-4e45-b331-5e3e859405a8', '93736e7b-798e-4d94-9eaf-54c87cdef77f',
      // A3 — zamierzona partia 6 decyzji bez decydenta
      'c13de36b-7c9f-4075-a30c-82c873dee6cd', '1e749e1e-aaa1-4836-ae2d-a3a473ca3c85',
      '483a0bdd-bc28-4cb9-8f14-de594fa4e588', '56736322-a685-4b17-b731-698f926abd38',
      '02556b45-329e-4ee9-87c9-87c901a683cb', 'b3c2a7f0-6b75-467e-b9be-ff91adbca7f9',
    ],
  },
  {
    tabela: 'initiatives',
    kolumna: 'owner_execution_id',
    populacja: `organization_id = '${ORG}'`,
    zostaw: [
      '5317c99f-1710-4e92-a65f-c56e5c38b3dd', 'e3b0a66a-dc86-4730-84e0-cdffb66cbed6',
      '7eb944f9-c5b9-4162-8bff-23b0d620f9f3', 'b8f28cea-36b4-4f12-802e-634bf10c4d5a',
      'd3bc32b2-ca68-456f-8af9-a432d6f10442', 'bb9038c3-d5e0-41e4-8d3d-f695d9c045f9',
    ],
  },
  {
    tabela: 'initiatives',
    kolumna: 'sponsor_id',
    populacja: `organization_id = '${ORG}'`,
    zostaw: [
      '84baaa08-5249-42e4-a292-3921e67d29d1', 'c55f3b10-e04e-44dd-a2e0-178046902520',
      '5317c99f-1710-4e92-a65f-c56e5c38b3dd',
    ],
  },
];

async function korekta(c, apply, manifest, log) {
  for (const k of KOREKTA) {
    const cols = await kolumny(c, k.tabela);
    const nadmiar = await c.query(
      `SELECT * FROM ${k.tabela}
       WHERE ${k.populacja} AND ${k.kolumna} = $1 AND NOT (id::text = ANY($2::text[]))`,
      [NOWY, k.zostaw]
    );
    if (nadmiar.rowCount === 0) {
      log.push({ etap: 'KOREKTA', tabela: k.tabela, kolumna: k.kolumna, wierszy: 0, wynik: 'brak nadmiaru' });
      continue;
    }
    manifest.push({
      etap: 'KOREKTA',
      tabela: k.tabela,
      kolumna: k.kolumna,
      takze: k.takze || [],
      przywracam: null,
      wiersze: nadmiar.rows,
    });
    if (apply) {
      const sety = [k.kolumna, ...(k.takze || []).filter((x) => cols.has(x))]
        .map((kol) => `${kol} = NULL`)
        .join(', ');
      const r = await c.query(
        `UPDATE ${k.tabela} SET ${sety}
         WHERE ${k.populacja} AND ${k.kolumna} = $1 AND NOT (id::text = ANY($2::text[]))`,
        [NOWY, k.zostaw]
      );
      log.push({ etap: 'KOREKTA', tabela: k.tabela, kolumna: k.kolumna, wierszy: r.rowCount, wynik: 'COFNIĘTE do NULL' });
    } else {
      log.push({ etap: 'KOREKTA', tabela: k.tabela, kolumna: k.kolumna, wierszy: nadmiar.rowCount, wynik: 'dry-run' });
    }
  }
}


// ---------------------------------------------------------------------------
// HIGIENA — cofnięcie rekordów testowych i duplikatów wciągniętych do skrzynki
// i do zadań przez pierwszy (jeszcze nieodsiany) przebieg.
// Pozycje skrzynki wracają do pierwotnego właściciela (użytkownik-widmo),
// zduplikowane zadania — do wartości pierwotnej NULL.
// ---------------------------------------------------------------------------
async function higiena(c, apply, manifest, log) {
  const testowe = await c.query(
    `SELECT * FROM canonical_inbox_items
     WHERE user_id = $1 AND organization_id = $2 AND NOT (${BEZ_TESTOWYCH})`,
    [NOWY, ORG]
  );
  if (testowe.rowCount > 0) {
    manifest.push({ etap: 'HIGIENA', tabela: 'canonical_inbox_items', przywracam: WIDMO, wiersze: testowe.rows });
    if (apply) {
      const r = await c.query(
        `UPDATE canonical_inbox_items SET user_id = $3
         WHERE user_id = $1 AND organization_id = $2 AND NOT (${BEZ_TESTOWYCH})`,
        [NOWY, ORG, WIDMO]
      );
      log.push({ etap: 'HIGIENA', tabela: 'canonical_inbox_items', wierszy: r.rowCount, wynik: 'ODDANE widmu (rekordy testowe)' });
    } else {
      log.push({ etap: 'HIGIENA', tabela: 'canonical_inbox_items', wierszy: testowe.rowCount, wynik: 'dry-run' });
    }
  } else {
    log.push({ etap: 'HIGIENA', tabela: 'canonical_inbox_items', wierszy: 0, wynik: 'brak rekordów testowych' });
  }

  // Duplikaty tytułów wśród zadań przepiętych z puli „niczyich" (A1 i dosiew
  // zostawiamy nietknięte — mają własne, jawne identyfikatory).
  // Chronione = TYLKO zadania ze starego konta właściciela (A1). Zadania z
  // dosiewu mają prefiks `s1-tokio-` i są wyłączone osobno. Partia A3 CELOWO
  // wchodzi do skanu — to w niej wylądowały 4 kopie „Audyt 3 maszyn
  // krytycznych pod PdM"; nadmiarowe wracają do NULL, a kolejny przebieg
  // `--op=przepiecie` dobierze zamienniki (pula ma teraz odsiew po tytule).
  const chronione = [
    'task-dbr77-load-030', '4b9c9ad3-307a-44e2-9821-ce94dbedcf16',
    'task-dbr77-load-029', '4d63149c-9dcf-4f0b-b2b7-6d450b81f1da',
  ];
  const dupl = await c.query(
    `SELECT * FROM (
       SELECT *, row_number() OVER (PARTITION BY title ORDER BY due_date NULLS LAST, id) rn
       FROM tasks
       WHERE organization_id = $1 AND assignee_id = $2
         AND lower(coalesce(status,'')) IN ('todo','in_progress')
         AND id NOT LIKE 's1-tokio-%'
         AND NOT (id::text = ANY($3::text[]))
     ) q WHERE rn > 1`,
    [ORG, NOWY, chronione]
  );
  if (dupl.rowCount > 0) {
    manifest.push({ etap: 'HIGIENA', tabela: 'tasks', przywracam: null, wiersze: dupl.rows });
    if (apply) {
      const r = await c.query(
        `UPDATE tasks SET assignee_id = NULL, owner_id = NULL WHERE id::text = ANY($1::text[])`,
        [dupl.rows.map((x) => String(x.id))]
      );
      log.push({ etap: 'HIGIENA', tabela: 'tasks', wierszy: r.rowCount, wynik: 'COFNIĘTE do NULL (duplikaty tytułów)' });
    } else {
      log.push({ etap: 'HIGIENA', tabela: 'tasks', wierszy: dupl.rowCount, wynik: 'dry-run' });
    }
  } else {
    log.push({ etap: 'HIGIENA', tabela: 'tasks', wierszy: 0, wynik: 'brak duplikatów' });
  }
}

// ---------------------------------------------------------------------------
// Wykonanie
// ---------------------------------------------------------------------------
async function kolumny(c, tabela) {
  const r = await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [tabela]
  );
  return new Set(r.rows.map((x) => x.column_name));
}

async function tabelaIstnieje(c, tabela) {
  const r = await c.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [tabela]
  );
  return r.rowCount > 0;
}

async function przepnijCalosc(c, apply, manifest, log) {
  for (const [tabela, kolumna] of A1_TABELE) {
    if (!(await tabelaIstnieje(c, tabela))) {
      log.push({ etap: 'A1', tabela, kolumna, wynik: 'POMINIĘTE — brak tabeli' });
      continue;
    }
    const cols = await kolumny(c, tabela);
    if (!cols.has(kolumna)) {
      log.push({ etap: 'A1', tabela, kolumna, wynik: 'POMINIĘTE — brak kolumny' });
      continue;
    }
    const orgFiltr = cols.has('organization_id') ? ` AND organization_id = '${ORG}'` : '';
    const przed = await c.query(
      `SELECT * FROM ${tabela} WHERE ${kolumna} = $1${orgFiltr}`,
      [STARY]
    );
    if (przed.rowCount === 0) {
      log.push({ etap: 'A1', tabela, kolumna, wierszy: 0, wynik: 'nic do przepięcia' });
      continue;
    }
    manifest.push({ etap: 'A1', tabela, kolumna, z: STARY, na: NOWY, wiersze: przed.rows });
    if (apply) {
      const r = await c.query(
        `UPDATE ${tabela} SET ${kolumna} = $1 WHERE ${kolumna} = $2${orgFiltr}`,
        [NOWY, STARY]
      );
      log.push({ etap: 'A1', tabela, kolumna, wierszy: r.rowCount, wynik: 'PRZEPIĘTE' });
    } else {
      log.push({ etap: 'A1', tabela, kolumna, wierszy: przed.rowCount, wynik: 'dry-run' });
    }
  }
}

async function przepnijPule(c, pule, zrodlo, etap, apply, manifest, log) {
  for (const p of pule) {
    if (!(await tabelaIstnieje(c, p.tabela))) {
      log.push({ etap, pula: p.nazwa, wynik: 'POMINIĘTE — brak tabeli' });
      continue;
    }
    const cols = await kolumny(c, p.tabela);
    if (!cols.has(p.kolumna)) {
      log.push({ etap, pula: p.nazwa, wynik: 'POMINIĘTE — brak kolumny ' + p.kolumna });
      continue;
    }
    const klucz = p.klucz || 'id';

    // ile właściciel JUŻ ma w tej samej puli → idempotencja przez zbieżność do kwoty
    // ★ BŁĄD ZŁAPANY 2026-09-10 (3 nadmiarowe przebiegi na ŻYWEJ bazie):
    // licznik „ile właściciel już ma" MUSI liczyć po POPULACJI, nie po filtrze
    // kandydatów. W pulach A3 filtr zawiera warunek źródła (`... IS NULL`),
    // więc `posiadane` zawsze wychodziło 0 i każdy kolejny przebieg dobierał
    // kolejną pełną kwotę. `pula` (bez warunku źródła) naprawia idempotencję.
    const populacja = p.pula || p.filtr;
    const posiadane = await c.query(
      `SELECT count(*) n FROM ${p.tabela} WHERE ${populacja} AND ${p.kolumna} = $1`,
      [NOWY]
    );
    const juz = Number(posiadane.rows[0].n);
    const brakuje = Math.max(0, p.kwota - juz);
    if (brakuje === 0) {
      log.push({ etap, pula: p.nazwa, posiadane: juz, kwota: p.kwota, wynik: 'kwota osiągnięta' });
      continue;
    }

    // warunek źródła
    let warunekZrodla;
    if (zrodlo === 'WIDMO') warunekZrodla = `${p.kolumna} = '${WIDMO}'`;
    else if (p.zrodloWartosc === null) warunekZrodla = `${p.kolumna} IS NULL`;
    else if (p.zrodloWartosc === 'SIEROTA')
      warunekZrodla = `${p.kolumna} NOT IN (SELECT id::text FROM users)`;
    else warunekZrodla = `${p.kolumna} = '${p.zrodloWartosc}'`;

    // Nadmiarowy wybór + odsianie duplikatów: (a) klucz unikalności bazy
    // (canonical_inbox_items UNIQUE(user_id, source_entity_type, source_entity_id)
    // — przepięcie MUSI dać rozłączny zbiór, inaczej UPDATE wywróci się na
    // ograniczeniu), (b) powtórzone tytuły (3× „Interview Assignment Overdue"
    // w jednej skrzynce to nie jest twarz produktu).
    const dedup = p.dedupPo || [];
    const surowe = await c.query(
      `SELECT * FROM ${p.tabela}
       WHERE ${p.filtr} AND ${warunekZrodla}
       ORDER BY ${p.kolejnosc}
       LIMIT ${dedup.length ? brakuje * 8 : brakuje}`
    );
    // `dedupPo` to LISTA NIEZALEŻNYCH kluczy — każdy element to jedna kolumna
    // albo tablica kolumn tworzących jeden klucz. Wiersz przechodzi tylko wtedy,
    // gdy jest nowy względem KAŻDEGO z nich.
    const widziane = dedup.map(() => new Set());
    // IDEMPOTENCJA odsiewu: zbiory „już widziane" startują od wierszy, które
    // właściciel MA JUŻ w tej puli — bez tego drugi przebieg dobrałby kolejny
    // wiersz o tym samym tytule (np. piąte z rzędu „Interview Assignment
    // Overdue") zamiast zameldować „nic do zrobienia".
    if (dedup.length) {
      const posiadaneWiersze = await c.query(
        `SELECT * FROM ${p.tabela} WHERE ${populacja} AND ${p.kolumna} = $1`,
        [NOWY]
      );
      for (const w of posiadaneWiersze.rows) {
        for (let d = 0; d < dedup.length; d += 1) {
          const czesci = Array.isArray(dedup[d]) ? dedup[d] : [dedup[d]];
          widziane[d].add(czesci.map((kol) => String(w[kol] ?? '')).join('||'));
        }
      }
    }
    const odsiane = [];
    for (const w of surowe.rows) {
      if (odsiane.length >= brakuje) break;
      let kolizja = false;
      const klucze = [];
      for (let d = 0; d < dedup.length; d += 1) {
        const czesci = Array.isArray(dedup[d]) ? dedup[d] : [dedup[d]];
        const k = czesci.map((kol) => String(w[kol] ?? '')).join('||');
        klucze.push(k);
        if (widziane[d].has(k)) kolizja = true;
      }
      if (kolizja) continue;
      klucze.forEach((k, d) => widziane[d].add(k));
      odsiane.push(w);
    }
    const wybor = { rows: odsiane, rowCount: odsiane.length };
    if (wybor.rowCount === 0) {
      log.push({ etap, pula: p.nazwa, posiadane: juz, kwota: p.kwota, wynik: 'brak kandydatów' });
      continue;
    }
    const ids = wybor.rows.map((r) => r[klucz]);
    manifest.push({
      etap,
      pula: p.nazwa,
      tabela: p.tabela,
      kolumna: p.kolumna,
      takze: p.takze || [],
      na: NOWY,
      klucz,
      wiersze: wybor.rows,
    });
    if (apply) {
      const sety = [p.kolumna, ...(p.takze || []).filter((x) => cols.has(x))]
        .map((kol) => `${kol} = $1`)
        .join(', ');
      const r = await c.query(
        `UPDATE ${p.tabela} SET ${sety} WHERE ${klucz}::text = ANY($2::text[])`,
        [NOWY, ids.map(String)]
      );
      log.push({
        etap,
        pula: p.nazwa,
        posiadane: juz,
        kwota: p.kwota,
        wierszy: r.rowCount,
        wynik: 'PRZEPIĘTE',
      });
    } else {
      log.push({
        etap,
        pula: p.nazwa,
        posiadane: juz,
        kwota: p.kwota,
        wierszy: wybor.rowCount,
        wynik: 'dry-run',
        przyklady: wybor.rows.slice(0, 3).map((r) => String(r.title || r.name || r[klucz]).slice(0, 60)),
      });
    }
  }
}

async function dosiej(c, apply, manifest, log) {
  const teraz = new Date().toISOString();

  // --- projekt/inicjatywa do podpięcia zadań (istniejące, bez zmiany treści)
  const inic = await c.query(
    `SELECT id, project_id FROM initiatives WHERE organization_id=$1 AND owner_execution_id=$2
     ORDER BY id LIMIT 4`,
    [ORG, NOWY]
  );
  const inicjatywy = inic.rows;
  const projektDomyslny = await c.query(
    `SELECT id FROM projects WHERE organization_id=$1 ORDER BY created_at LIMIT 1`,
    [ORG]
  );
  const projId = projektDomyslny.rows[0]?.id || null;

  // --- ZADANIA
  const taskCols = await kolumny(c, 'tasks');
  let dodaneZadania = 0;
  for (let i = 0; i < B_ZADANIA.length; i += 1) {
    const t = B_ZADANIA[i];
    const przypiete = inicjatywy.length ? inicjatywy[i % inicjatywy.length] : null;
    const rekord = {
      id: t.id,
      organization_id: ORG,
      project_id: przypiete?.project_id || projId,
      initiative_id: przypiete?.id || null,
      title: t.title,
      status: t.status,
      priority: t.priority,
      assignee_id: NOWY,
      owner_id: NOWY,
      reporter_id: NOWY,
      due_date: `${t.due}T22:00:00.000Z`,
      estimated_hours: t.hours,
      task_type: 'execution',
      step_phase: t.phase,
      source: 'manual',
      tags: '[]',
      assignees: '[]',
      created_at: teraz,
      updated_at: teraz,
    };
    const uzyte = Object.keys(rekord).filter((k) => taskCols.has(k));
    manifest.push({ etap: 'B', operacja: 'INSERT tasks', id: t.id, rekord });
    if (apply) {
      const r = await c.query(
        `INSERT INTO tasks (${uzyte.join(', ')}) VALUES (${uzyte.map((_, n) => '$' + (n + 1)).join(', ')})
         ON CONFLICT (id) DO NOTHING`,
        uzyte.map((k) => rekord[k])
      );
      dodaneZadania += r.rowCount;
    }
  }
  log.push({ etap: 'B', co: 'zadania EN (przyszłe terminy)', planowane: B_ZADANIA.length, dodane: apply ? dodaneZadania : 'dry-run' });

  // --- SPOTKANIA (+ uczestnicy)
  const meetCols = await kolumny(c, 'meetings');
  const zespol = await c.query(
    `SELECT id, email, first_name, last_name FROM users
     WHERE organization_id=$1 AND id <> $2 AND email NOT LIKE '%consultify.local'
     ORDER BY email LIMIT 5`,
    [ORG, NOWY]
  );
  let dodaneSpotkania = 0;
  for (const m of B_SPOTKANIA) {
    const koniec = new Date(new Date(m.start).getTime() + m.endH * 60000).toISOString();
    const uczestnicy = [NOWY, ...zespol.rows.slice(0, 4).map((u) => u.id)];
    const rekord = {
      id: m.id,
      organization_id: ORG,
      project_id: projId,
      title: m.title,
      start_at: m.start,
      end_at: koniec,
      location: m.location,
      status: 'scheduled',
      created_by: NOWY,
      attendees_json: JSON.stringify(uczestnicy),
      agenda_json: JSON.stringify({
        calendarSource: 'consultify',
        meetingType: 'team',
        items: m.agenda.map((tytul, n) => ({ order: n + 1, title: tytul })),
      }),
      pre_read_json: JSON.stringify([]),
      decisions_json: JSON.stringify([]),
      timezone: 'Europe/Warsaw',
      created_at: teraz,
      updated_at: teraz,
    };
    const uzyte = Object.keys(rekord).filter((k) => meetCols.has(k));
    manifest.push({ etap: 'B', operacja: 'INSERT meetings', id: m.id, rekord });
    if (apply) {
      const r = await c.query(
        `INSERT INTO meetings (${uzyte.join(', ')}) VALUES (${uzyte.map((_, n) => '$' + (n + 1)).join(', ')})
         ON CONFLICT (id) DO NOTHING`,
        uzyte.map((k) => rekord[k])
      );
      dodaneSpotkania += r.rowCount;
      if (await tabelaIstnieje(c, 'meeting_participants')) {
        const pCols = await kolumny(c, 'meeting_participants');
        const wszyscy = [
          { id: NOWY, email: 'piotr.wisniewski@dbr77.com', nm: 'Piotr Wiśniewski', rola: 'organizer' },
          ...zespol.rows.slice(0, 4).map((u) => ({
            id: u.id,
            email: u.email,
            nm: `${u.first_name} ${u.last_name}`,
            rola: 'attendee',
          })),
        ];
        for (let n = 0; n < wszyscy.length; n += 1) {
          const u = wszyscy[n];
          const p = {
            id: `${m.id}-p${n + 1}`,
            meeting_id: m.id,
            organization_id: ORG,
            participant_kind: 'user', // NOT NULL — zmierzone w schemacie stagingu
            user_id: u.id,
            email: u.email,
            display_name: u.nm,
            role: u.rola,
            invitation_status: n === 0 ? 'accepted' : 'invited',
            delivery_status: 'pending',
            invited_by: NOWY,
            created_at: teraz,
            updated_at: teraz,
          };
          const pu = Object.keys(p).filter((k) => pCols.has(k));
          await c.query(
            `INSERT INTO meeting_participants (${pu.join(', ')})
             VALUES (${pu.map((_, q) => '$' + (q + 1)).join(', ')}) ON CONFLICT (id) DO NOTHING`,
            pu.map((k) => p[k])
          );
        }
      }
    }
  }
  log.push({ etap: 'B', co: 'spotkania EN (przyszłe, z agendą)', planowane: B_SPOTKANIA.length, dodane: apply ? dodaneSpotkania : 'dry-run' });

  // --- NOTATKI
  const nbCols = await kolumny(c, 'notebook_pages');
  const mojNotatnik = await c.query(
    `SELECT id FROM notebooks WHERE organization_id=$1 AND owner_user_id=$2 ORDER BY id LIMIT 1`,
    [ORG, NOWY]
  );
  const nbId = mojNotatnik.rows[0]?.id || null;
  let dodaneNotatki = 0;
  for (const n of B_NOTATKI) {
    const rekord = {
      id: n.id,
      owner_user_id: NOWY,
      organization_id: ORG,
      notebook_id: nbId,
      visibility: 'private',
      title: n.title,
      content_text: n.tresc,
      content_json: JSON.stringify({
        type: 'doc',
        content: n.tresc.split('\n').map((linia) => ({
          type: 'paragraph',
          content: [{ type: 'text', text: linia }],
        })),
      }),
      tags_json: JSON.stringify(['tokyo', 'transformation']),
      status: 'active',
      maturity: 'draft',
      pinned: 0, // kolumna INTEGER NOT NULL na stagingu (nie boolean)
      capture_source: 'manual',
      created_at: teraz,
      updated_at: teraz,
    };
    const uzyte = Object.keys(rekord).filter((k) => nbCols.has(k));
    manifest.push({ etap: 'B', operacja: 'INSERT notebook_pages', id: n.id, rekord });
    if (apply) {
      const r = await c.query(
        `INSERT INTO notebook_pages (${uzyte.join(', ')})
         VALUES (${uzyte.map((_, q) => '$' + (q + 1)).join(', ')}) ON CONFLICT (id) DO NOTHING`,
        uzyte.map((k) => rekord[k])
      );
      dodaneNotatki += r.rowCount;
    }
  }
  log.push({ etap: 'B', co: 'notatki EN', planowane: B_NOTATKI.length, dodane: apply ? dodaneNotatki : 'dry-run' });

  // --- POWIADOMIENIA
  const noCols = await kolumny(c, 'notifications');
  let dodanePowiadomienia = 0;
  for (const p of B_POWIADOMIENIA) {
    const rekord = {
      id: p.id,
      user_id: NOWY,
      organization_id: ORG,
      type: p.type,
      title: p.title,
      message: p.message,
      body: p.message,
      priority: p.priority,
      severity: p.priority === 'high' ? 'WARNING' : 'INFO',
      read: 0,
      is_read: 0,
      is_dismissed: 0,
      is_actionable: 1,
      data: '{}',
      metadata: '{}',
      channels_sent: '[]',
      created_at: teraz,
    };
    const uzyte = Object.keys(rekord).filter((k) => noCols.has(k));
    manifest.push({ etap: 'B', operacja: 'INSERT notifications', id: p.id, rekord });
    if (apply) {
      const r = await c.query(
        `INSERT INTO notifications (${uzyte.join(', ')})
         VALUES (${uzyte.map((_, q) => '$' + (q + 1)).join(', ')}) ON CONFLICT (id) DO NOTHING`,
        uzyte.map((k) => rekord[k])
      );
      dodanePowiadomienia += r.rowCount;
    }
  }
  log.push({ etap: 'B', co: 'powiadomienia EN', planowane: B_POWIADOMIENIA.length, dodane: apply ? dodanePowiadomienia : 'dry-run' });
}

// ---------------------------------------------------------------------------
// WIDMO-CAŁOŚĆ — zadanie S-2 (Tokio, 2026-09-10).
// ---------------------------------------------------------------------------
// KROK 0 (skan information_schema, 2026-09-10, host thomas) pokazał, że
// d2b6a316 (widmo) jest kolumną właściciela/aktora w ~260 kombinacjach
// tabela.kolumna w PRAWIE CAŁYM schemacie — nie tylko w 8 modułach MVP, które
// zmierzyło i częściowo przepięło S-1. Zdecydowana większość to telemetria/
// audyt/koszt AI/lineage/prezencja (ai_cost_usage 995, ai_quality_metrics 996,
// collab_sessions 2633, wave6_context_ledger 2788, tool_session_presence 1901,
// organization_context_items 1690, audit_log 6076, v8_artifact_run_audit_log
// 521, finance_*/financial_* dziesiątki tabel...). Przepisanie TYCH kolumn na
// nowe konto zafałszowałoby historię (kto naprawdę wykonał/kosztował daną
// akcję) — to nie jest "własność biznesowa", to log. CLAUDE.md (higiena danych
// demo, zakaz masowego działania) i zasada „nie rób nieodwracalnych rzeczy bez
// wyraźnej potrzeby" każą tu STANĄĆ, nie przepinać automatycznie.
//
// APLIKUJEMY WYŁĄCZNIE dokończenie modułów MVP, które S-1 już zmierzyło,
// zweryfikowało czytelnikami i częściowo przepięło kwotowo — teraz BEZ LIMITU
// KWOTY (transfer całej pozostałej, jakościowo przefiltrowanej puli) + 4 nowe
// kolumny czytelnikowe znalezione w skanie, których S-1 nie objęło:
//   initiatives.created_by/updated_by, my_ideas.user_id,
//   meeting_participants.user_id, interview_assignments.assignee_user_id +
//   .created_by.
// Wszystko INNE ze skanu KROK 0 zostaje NIETKNIĘTE i wypisane jako WYJĄTEK
// „poza zakresem S-2 — wymaga osobnej decyzji" w manifeście/logu.
// ---------------------------------------------------------------------------

// ★ ZŁAPANE W DRY-RUN (2026-09-10): kwota=999999 = domknięcie CAŁEJ puli, nie
// tylko ręcznie wybranych 8-10 "ładnych" wierszy jak w S-1 — więc pule bez
// filtra BEZ_TESTOWYCH zaczynają wciągać rekordy testowe, których S-1 unikało
// przez dobór kolejności/kwoty. Znalezione na tym przebiegu:
//  `notatnik-strony`: '[ARCHIVED-TEST] DBR77 Scale-Up - Notatka Robocza',
//  `czat-rozmowy-EN` (i jej domknięcie): 'QA MOCK RESPONSE...'.
// CLAUDE.md: "Dane demo = twarz produktu... zero rekordów testowych" —
// dokładamy BEZ_TESTOWYCH tam, gdzie oryginalna pula S-1 (kwota mała, dobór
// ręczny) go nie miała, żeby domknięcie „widmo-całość" nie przemyciło ich na
// konto właściciela.
const DOLOZ_BEZ_TESTOWYCH = new Set(['notatnik-strony', 'czat-rozmowy-EN']);
const A2_PULE_CALOSC = A2_PULE.map((p) => ({
  ...p,
  kwota: 999999,
  filtr: DOLOZ_BEZ_TESTOWYCH.has(p.nazwa) ? `${p.filtr} AND ${BEZ_TESTOWYCH}` : p.filtr,
}));
A2_PULE_CALOSC.push(
  {
    nazwa: 'skrzynka-reszta',
    tabela: 'canonical_inbox_items',
    dedupPo: [['source_entity_type', 'source_entity_id'], 'title'],
    kolumna: 'user_id',
    filtr: `organization_id = '${ORG}' AND ${BEZ_TESTOWYCH}`,
    kolejnosc: `created_at DESC, id`,
    kwota: 999999,
  },
  {
    nazwa: 'czat-reszta',
    tabela: 'conversations',
    kolumna: 'user_id',
    filtr: `organization_id = '${ORG}' AND deleted_at IS NULL AND ${BEZ_TESTOWYCH}`,
    kolejnosc: `message_count DESC, last_message_at DESC NULLS LAST, id`,
    kwota: 999999,
    dedupPo: ['title'],
    takze: ['created_by'],
  }
);

// Proste przepięcia całości (bez konfliktu unikalności) — org-scoped.
// ★ DRUGI PRZEBIEG (ten sam dzień): po pierwszym apply doszły 4 kolumny tej
// samej kategorii („kto to stworzył/do kogo należy" na tabeli biznesowej),
// pominięte w pierwszym cięciu przez przeoczenie, nie przez celową decyzję:
// tasks.created_by/owner_id (analogiczne do już przepiętych
// initiatives.created_by/updated_by), my_idea_maps.user_id (siostrzana
// tabela my_ideas, już przepiętej), audit_programs.created_by (audit_programs
// .program_owner_id miało 0 kandydatów — to inna kolumna tej samej tabeli).
// NIE dodaję my_idea_maps.last_editor_user_id ani assessments.updated_by —
// to pola „kto ostatnio dotknął", bliższe audytowi niż własności; zostają
// przy widmie i są wypisane jako wyjątek.
const WIDMO_PROSTE = [
  { tabela: 'initiatives', kolumna: 'created_by' },
  { tabela: 'initiatives', kolumna: 'updated_by' },
  { tabela: 'my_ideas', kolumna: 'user_id' },
  { tabela: 'tasks', kolumna: 'created_by' },
  { tabela: 'tasks', kolumna: 'owner_id' },
  { tabela: 'audit_programs', kolumna: 'created_by' },
];

async function przepnijProste(c, apply, manifest, log) {
  for (const { tabela, kolumna } of WIDMO_PROSTE) {
    if (!(await tabelaIstnieje(c, tabela))) {
      log.push({ etap: 'WIDMO-PROSTE', tabela, kolumna, wynik: 'POMINIĘTE — brak tabeli' });
      continue;
    }
    const cols = await kolumny(c, tabela);
    if (!cols.has(kolumna)) {
      log.push({ etap: 'WIDMO-PROSTE', tabela, kolumna, wynik: 'POMINIĘTE — brak kolumny' });
      continue;
    }
    const przed = await c.query(
      `SELECT * FROM ${tabela} WHERE ${kolumna} = $1 AND organization_id = $2`,
      [WIDMO, ORG]
    );
    if (przed.rowCount === 0) {
      log.push({ etap: 'WIDMO-PROSTE', tabela, kolumna, wierszy: 0, wynik: 'nic do przepięcia' });
      continue;
    }
    manifest.push({ etap: 'WIDMO-PROSTE', tabela, kolumna, z: WIDMO, na: NOWY, wiersze: przed.rows });
    if (apply) {
      const r = await c.query(
        `UPDATE ${tabela} SET ${kolumna} = $1 WHERE ${kolumna} = $2 AND organization_id = $3`,
        [NOWY, WIDMO, ORG]
      );
      log.push({ etap: 'WIDMO-PROSTE', tabela, kolumna, wierszy: r.rowCount, wynik: 'PRZEPIĘTE' });
    } else {
      log.push({ etap: 'WIDMO-PROSTE', tabela, kolumna, wierszy: przed.rowCount, wynik: 'dry-run' });
    }
  }
}

// meeting_participants.user_id — konflikt: uq_meeting_participant_user
// (meeting_id, user_id) WHERE user_id IS NOT NULL. Wiersz, dla którego NOWY
// już jest uczestnikiem TEGO SAMEGO spotkania, zostaje przy widmie (wypisany).
async function przepnijUczestnikowSpotkan(c, apply, manifest, log) {
  const tabela = 'meeting_participants';
  if (!(await tabelaIstnieje(c, tabela))) {
    log.push({ etap: 'WIDMO-UCZESTNICY', tabela, wynik: 'POMINIĘTE — brak tabeli' });
    return;
  }
  const kandydaci = await c.query(
    `SELECT mp.* FROM meeting_participants mp
     JOIN meetings m ON m.id = mp.meeting_id
     WHERE mp.user_id = $1 AND m.organization_id = $2`,
    [WIDMO, ORG]
  );
  if (kandydaci.rowCount === 0) {
    log.push({ etap: 'WIDMO-UCZESTNICY', tabela, wierszy: 0, wynik: 'nic do przepięcia' });
    return;
  }
  const konfliktRes = await c.query(
    `SELECT meeting_id FROM meeting_participants WHERE user_id = $1`,
    [NOWY]
  );
  const zajete = new Set(konfliktRes.rows.map((r) => String(r.meeting_id)));
  const mozna = kandydaci.rows.filter((r) => !zajete.has(String(r.meeting_id)));
  const konflikt = kandydaci.rows.filter((r) => zajete.has(String(r.meeting_id)));
  if (konflikt.length) {
    manifest.push({ etap: 'WIDMO-UCZESTNICY', tabela, przywracam: 'ZOSTAJE PRZY WIDMIE (konflikt uq_meeting_participant_user)', wiersze: konflikt });
    log.push({ etap: 'WIDMO-UCZESTNICY', tabela, wierszy: konflikt.length, wynik: 'WYJĄTEK — NOWY już uczestnikiem tego spotkania' });
  }
  if (mozna.length === 0) {
    log.push({ etap: 'WIDMO-UCZESTNICY', tabela, wierszy: 0, wynik: 'brak bezkonfliktowych' });
    return;
  }
  manifest.push({ etap: 'WIDMO-UCZESTNICY', tabela, z: WIDMO, na: NOWY, wiersze: mozna });
  if (apply) {
    const r = await c.query(
      `UPDATE meeting_participants SET user_id = $1 WHERE id::text = ANY($2::text[])`,
      [NOWY, mozna.map((x) => String(x.id))]
    );
    log.push({ etap: 'WIDMO-UCZESTNICY', tabela, wierszy: r.rowCount, wynik: 'PRZEPIĘTE' });
  } else {
    log.push({ etap: 'WIDMO-UCZESTNICY', tabela, wierszy: mozna.length, wynik: 'dry-run' });
  }
}

// interview_assignments — assignee_user_id (bez ryzyka konfliktu) +
// created_by (konflikt: ux_interview_assignment_create_request
// (organization_id, created_by, create_request_key) WHERE create_request_key
// IS NOT NULL).
async function przepnijWywiadPrzypisania(c, apply, manifest, log) {
  const tabela = 'interview_assignments';
  if (!(await tabelaIstnieje(c, tabela))) {
    log.push({ etap: 'WIDMO-WYWIAD', tabela, wynik: 'POMINIĘTE — brak tabeli' });
    return;
  }

  // assignee_user_id — proste
  const przedAssignee = await c.query(
    `SELECT * FROM interview_assignments WHERE assignee_user_id = $1 AND organization_id = $2`,
    [WIDMO, ORG]
  );
  if (przedAssignee.rowCount > 0) {
    manifest.push({ etap: 'WIDMO-WYWIAD', tabela, kolumna: 'assignee_user_id', z: WIDMO, na: NOWY, wiersze: przedAssignee.rows });
    if (apply) {
      const r = await c.query(
        `UPDATE interview_assignments SET assignee_user_id = $1 WHERE assignee_user_id = $2 AND organization_id = $3`,
        [NOWY, WIDMO, ORG]
      );
      log.push({ etap: 'WIDMO-WYWIAD', tabela, kolumna: 'assignee_user_id', wierszy: r.rowCount, wynik: 'PRZEPIĘTE' });
    } else {
      log.push({ etap: 'WIDMO-WYWIAD', tabela, kolumna: 'assignee_user_id', wierszy: przedAssignee.rowCount, wynik: 'dry-run' });
    }
  } else {
    log.push({ etap: 'WIDMO-WYWIAD', tabela, kolumna: 'assignee_user_id', wierszy: 0, wynik: 'nic do przepięcia' });
  }

  // created_by — z kontrolą konfliktu na create_request_key
  const kandydaci = await c.query(
    `SELECT * FROM interview_assignments WHERE created_by = $1 AND organization_id = $2`,
    [WIDMO, ORG]
  );
  if (kandydaci.rowCount === 0) {
    log.push({ etap: 'WIDMO-WYWIAD', tabela, kolumna: 'created_by', wierszy: 0, wynik: 'nic do przepięcia' });
    return;
  }
  const kluczeRes = await c.query(
    `SELECT create_request_key FROM interview_assignments
     WHERE created_by = $1 AND organization_id = $2 AND create_request_key IS NOT NULL`,
    [NOWY, ORG]
  );
  const zajeteKlucze = new Set(kluczeRes.rows.map((r) => r.create_request_key));
  const mozna = kandydaci.rows.filter((r) => !(r.create_request_key && zajeteKlucze.has(r.create_request_key)));
  const konflikt = kandydaci.rows.filter((r) => r.create_request_key && zajeteKlucze.has(r.create_request_key));
  if (konflikt.length) {
    manifest.push({ etap: 'WIDMO-WYWIAD', tabela, kolumna: 'created_by', przywracam: 'ZOSTAJE PRZY WIDMIE (konflikt ux_interview_assignment_create_request)', wiersze: konflikt });
    log.push({ etap: 'WIDMO-WYWIAD', tabela, kolumna: 'created_by', wierszy: konflikt.length, wynik: 'WYJĄTEK — konflikt create_request_key' });
  }
  if (mozna.length === 0) {
    log.push({ etap: 'WIDMO-WYWIAD', tabela, kolumna: 'created_by', wierszy: 0, wynik: 'brak bezkonfliktowych' });
    return;
  }
  manifest.push({ etap: 'WIDMO-WYWIAD', tabela, kolumna: 'created_by', z: WIDMO, na: NOWY, wiersze: mozna });
  if (apply) {
    const r = await c.query(
      `UPDATE interview_assignments SET created_by = $1 WHERE id::text = ANY($2::text[])`,
      [NOWY, mozna.map((x) => String(x.id))]
    );
    log.push({ etap: 'WIDMO-WYWIAD', tabela, kolumna: 'created_by', wierszy: r.rowCount, wynik: 'PRZEPIĘTE' });
  } else {
    log.push({ etap: 'WIDMO-WYWIAD', tabela, kolumna: 'created_by', wierszy: mozna.length, wynik: 'dry-run' });
  }
}

// my_idea_maps.user_id — konflikt: ux_my_idea_maps_user_idea (user_id,
// idea_id). Wiersz, dla którego NOWY już ma mapę dla TEGO SAMEGO pomysłu,
// zostaje przy widmie (wypisany).
async function przepnijMapyPomyslow(c, apply, manifest, log) {
  const tabela = 'my_idea_maps';
  if (!(await tabelaIstnieje(c, tabela))) {
    log.push({ etap: 'WIDMO-MAPY-POMYSLOW', tabela, wynik: 'POMINIĘTE — brak tabeli' });
    return;
  }
  const kandydaci = await c.query(
    `SELECT * FROM my_idea_maps WHERE user_id = $1 AND organization_id = $2`,
    [WIDMO, ORG]
  );
  if (kandydaci.rowCount === 0) {
    log.push({ etap: 'WIDMO-MAPY-POMYSLOW', tabela, wierszy: 0, wynik: 'nic do przepięcia' });
    return;
  }
  const konfliktRes = await c.query(`SELECT idea_id FROM my_idea_maps WHERE user_id = $1`, [NOWY]);
  const zajete = new Set(konfliktRes.rows.map((r) => String(r.idea_id)));
  const mozna = kandydaci.rows.filter((r) => !zajete.has(String(r.idea_id)));
  const konflikt = kandydaci.rows.filter((r) => zajete.has(String(r.idea_id)));
  if (konflikt.length) {
    manifest.push({ etap: 'WIDMO-MAPY-POMYSLOW', tabela, przywracam: 'ZOSTAJE PRZY WIDMIE (konflikt ux_my_idea_maps_user_idea)', wiersze: konflikt });
    log.push({ etap: 'WIDMO-MAPY-POMYSLOW', tabela, wierszy: konflikt.length, wynik: 'WYJĄTEK — NOWY już ma mapę tego pomysłu' });
  }
  if (mozna.length === 0) {
    log.push({ etap: 'WIDMO-MAPY-POMYSLOW', tabela, wierszy: 0, wynik: 'brak bezkonfliktowych' });
    return;
  }
  manifest.push({ etap: 'WIDMO-MAPY-POMYSLOW', tabela, z: WIDMO, na: NOWY, wiersze: mozna });
  if (apply) {
    const r = await c.query(
      `UPDATE my_idea_maps SET user_id = $1 WHERE id::text = ANY($2::text[])`,
      [NOWY, mozna.map((x) => String(x.id))]
    );
    log.push({ etap: 'WIDMO-MAPY-POMYSLOW', tabela, wierszy: r.rowCount, wynik: 'PRZEPIĘTE' });
  } else {
    log.push({ etap: 'WIDMO-MAPY-POMYSLOW', tabela, wierszy: mozna.length, wynik: 'dry-run' });
  }
}

async function widmoCalosc(c, apply, manifest, log) {
  await przepnijPule(c, A2_PULE_CALOSC, 'WIDMO', 'A2-CALOSC', apply, manifest, log);
  await przepnijProste(c, apply, manifest, log);
  await przepnijUczestnikowSpotkan(c, apply, manifest, log);
  await przepnijWywiadPrzypisania(c, apply, manifest, log);
  await przepnijMapyPomyslow(c, apply, manifest, log);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const op = (argv.find((a) => a.startsWith('--op=')) || '--op=measure').split('=')[1];
  // op: measure | all | przepiecie | dosiew | korekta | higiena | widmo-calosc
  const apply = argv.includes('--apply');
  if (apply && process.env.FORCE_S1 !== 'true') {
    throw new Error('--apply wymaga FORCE_S1=true');
  }
  const url = adresBazy();
  sprawdzHost(url);

  const c = new pg.Client({ connectionString: url, ssl: false, statement_timeout: 120000 });
  await c.connect();
  const manifest = [];
  const log = [];
  try {
    console.log(`# S-1 Tokio — op=${op} tryb=${apply ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`# punkt cofnięcia: ${PUNKT_COFNIECIA}`);

    const przed = await zmierz(c, NOWY);
    if (op === 'measure') {
      console.table(przed);
      piszCsv(
        `pomiar-${new Date().toISOString().slice(0, 19).replace(/[:]/g, '')}.csv`,
        ['ekran', 'zrodlo', 'wierszy'],
        przed
      );
      return;
    }

    if (op === 'all' || op === 'przepiecie') {
      await przepnijCalosc(c, apply, manifest, log);
      await przepnijPule(c, A2_PULE, 'WIDMO', 'A2', apply, manifest, log);
      await przepnijPule(c, A3_PULE, 'NICZYJE', 'A3', apply, manifest, log);
    }
    if (op === 'all' || op === 'dosiew') {
      await dosiej(c, apply, manifest, log);
    }
    if (op === 'korekta') {
      await korekta(c, apply, manifest, log);
    }
    if (op === 'higiena') {
      await higiena(c, apply, manifest, log);
    }
    if (op === 'widmo-calosc') {
      await widmoCalosc(c, apply, manifest, log);
    }

    const po = await zmierz(c, NOWY);
    const porownanie = przed.map((r, i) => ({
      ekran: r.ekran,
      zrodlo: r.zrodlo,
      przed: r.wierszy,
      po: po[i].wierszy,
    }));

    console.log('\n## OPERACJE');
    console.table(log);
    console.log('\n## CZYTELNIKI PRZED → PO');
    console.table(porownanie);

    const znacznik = new Date().toISOString().slice(0, 19).replace(/[:]/g, '');
    const plikManifestu = zapiszManifest(op + (apply ? '-apply' : '-dryrun'), {
      zadanie: 'S-1 Tokio',
      op,
      tryb: apply ? 'APPLY' : 'DRY-RUN',
      czas: new Date().toISOString(),
      punktCofniecia: PUNKT_COFNIECIA,
      org: ORG,
      kontoDocelowe: NOWY,
      zrodla: { stareKontoWlasciciela: STARY, uzytkownikWidmo: WIDMO },
      operacje: log,
      czytelnicyPrzedPo: porownanie,
      wierszePrzedZmiana: manifest,
    });
    piszCsv(`przed-po-${op}-${apply ? 'apply' : 'dryrun'}-${znacznik}.csv`,
      ['ekran', 'zrodlo', 'przed', 'po'], porownanie);
    piszCsv(`operacje-${op}-${apply ? 'apply' : 'dryrun'}-${znacznik}.csv`,
      ['etap', 'tabela', 'kolumna', 'pula', 'co', 'posiadane', 'kwota', 'wierszy', 'planowane', 'dodane', 'wynik'], log);
    console.log('\nmanifest:', plikManifestu);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error('BŁĄD:', e.message);
  process.exit(1);
});
