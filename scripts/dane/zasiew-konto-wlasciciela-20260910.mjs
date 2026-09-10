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

const A2_PULE = [
  {
    nazwa: 'skrzynka-zadania',
    tabela: 'canonical_inbox_items',
    dedupPo: [['source_entity_type', 'source_entity_id'], 'title'],
    kolumna: 'user_id',
    filtr: `organization_id = '${ORG}' AND status='pending' AND section='assigned_tasks' AND ${BEZ_POLSKICH}`,
    kolejnosc: `CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, created_at DESC, id`,
    kwota: 14,
  },
  {
    nazwa: 'skrzynka-akceptacje',
    tabela: 'canonical_inbox_items',
    dedupPo: [['source_entity_type', 'source_entity_id'], 'title'],
    kolumna: 'user_id',
    filtr: `organization_id = '${ORG}' AND status='pending' AND section='approvals_gates'`,
    kolejnosc: `CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, created_at DESC, id`,
    kwota: 8,
  },
  {
    nazwa: 'skrzynka-decyzje',
    tabela: 'canonical_inbox_items',
    dedupPo: [['source_entity_type', 'source_entity_id'], 'title'],
    kolumna: 'user_id',
    filtr: `organization_id = '${ORG}' AND status='pending' AND section='decisions_required'`,
    kolejnosc: `created_at DESC, id`,
    kwota: 4,
  },
  {
    nazwa: 'skrzynka-eskalacje',
    tabela: 'canonical_inbox_items',
    dedupPo: [['source_entity_type', 'source_entity_id'], 'title'],
    kolumna: 'user_id',
    filtr: `organization_id = '${ORG}' AND status='pending' AND section='blocked_escalations'`,
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
    filtr: `organization_id = '${ORG}' AND status='pending' AND section IN ('ai_insights','fyi_system','fyi_mentions')`,
    kolejnosc: `CASE section WHEN 'ai_insights' THEN 0 WHEN 'fyi_mentions' THEN 1 ELSE 2 END, created_at DESC, id`,
    kwota: 7,
  },
  {
    nazwa: 'czat-rozmowy-EN',
    tabela: 'conversations',
    kolumna: 'user_id',
    filtr: `organization_id = '${ORG}' AND deleted_at IS NULL AND message_count >= 4 AND ${BEZ_POLSKICH}`,
    kolejnosc: `last_message_at DESC NULLS LAST, id`,
    kwota: 5,
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
    filtr: `organization_id = '${ORG}' AND assignee_id IS NULL
            AND lower(coalesce(status,'')) IN ('todo','in_progress')`,
    kolejnosc: `(CASE WHEN title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' THEN 1 ELSE 0 END),
                CASE lower(coalesce(priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                due_date ASC NULLS LAST, id`,
    kwota: 10,
    takze: ['owner_id'],
  },
  {
    nazwa: 'decyzje-bez-decydenta',
    tabela: 'decisions',
    kolumna: 'decision_maker_id',
    zrodloWartosc: null,
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
    const posiadane = await c.query(
      `SELECT count(*) n FROM ${p.tabela} WHERE ${p.filtr} AND ${p.kolumna} = $1`,
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
        `SELECT * FROM ${p.tabela} WHERE ${p.filtr} AND ${p.kolumna} = $1`,
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
        `UPDATE ${p.tabela} SET ${sety} WHERE ${klucz} = ANY($2::text[])`,
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
            user_id: u.id,
            email: u.email,
            display_name: u.nm,
            role: u.rola,
            response_status: n === 0 ? 'accepted' : 'needs_action',
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
      pinned: false,
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
// main
// ---------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const op = (argv.find((a) => a.startsWith('--op=')) || '--op=measure').split('=')[1];
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
