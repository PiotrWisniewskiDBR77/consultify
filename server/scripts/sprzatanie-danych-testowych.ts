#!/usr/bin/env tsx
/**
 * SPRZĄTANIE DANYCH TESTOWYCH — staging, organizacja DBR77 (przed MVP 2026-09-06).
 *
 * Kontekst: audyt `evidence/assessment/` (i przegląd własny z 2026-09-05/06) znalazł na
 * stagingu w organizacji DBR77 (a3e05d4a-5397-419d-b486-8e44366c0063) śmieci testowe
 * (E2E/PROBE/smoke/__M06_REPRO_TEST__ itd.) oraz angielskie tytuły w danych demo
 * (10 spotkań, katalog inicjatyw, część zadań). Ten skrypt:
 *
 *   A) skanuje DYNAMICZNIE (przez information_schema) wszystkie tabele z organization_id
 *      i kolumną tekstową name/title/label/description/subject pod kątem wzorców
 *      jednoznacznie testowych — sekcja informacyjna w DRY_RUN.md (pełna widoczność,
 *      również fałszywych trafień, które ręcznie wykluczono),
 *   B) wykonuje wyłącznie skurowany, ręcznie zweryfikowany PLAN (`ACTION_PLAN` niżej) —
 *      per tabela: hard-delete (gdy brak deleted_at/archived/status ORAZ tabela nie ma
 *      dzieci FK albo ma je z CASCADE) albo soft-delete (status/archived_at/lifecycle_state
 *      na wartość oznaczającą wycofanie — zawsze wartość z realnej domeny tabeli, nigdy
 *      wartość łamiąca CHECK),
 *   C) tłumaczy na polski tytuły 10 spotkań demo + skurowaną mapę tytułów zadań/inicjatyw
 *      (tylko oczywiście demo/katalogowe angielskie tytuły — realne wewnętrzne zgłoszenia
 *      błędów [PRODUCTION]/[STAGING]/[DEVELOPMENT] BUG/IDEA są świadomie WYŁĄCZONE, bo to
 *      prawdziwe wpisy inżynierskie, nie treść demo).
 *
 * Weryfikacja przed napisaniem planu (ręcznie, na żywej bazie stagingu):
 *   - pełny information_schema.columns dla ~1275 tabel z organization_id w tej organizacji,
 *   - dla każdej z 470 tabel-kandydatek (kolumna name/title/label/description/subject)
 *     policzone DOKŁADNE liczby trafień wzorca (bez obcięcia LIMIT), przejrzane ręcznie,
 *   - pg_constraint: FK-dzieci + delete_rule dla każdej z 17 tabel z trafieniami,
 *   - pg_constraint CHECK dla kolumn status/lifecycle_state (żeby nie użyć wartości spoza
 *     domeny), information_schema.triggers (żaden hard-delete nie wchodzi na tabelę z
 *     triggerem/regułą blokującą DELETE — `artifact_lifecycle_events` ma takie triggery,
 *     ale NIE jest tabelą, na której ten skrypt cokolwiek robi),
 *   - dwie ręcznie znalezione FAŁSZYWE TRAFIENIA wzorca zostały wykluczone: (1)
 *     `wave6_context_ledger` — 2 wiersze o realnej treści "test-retest reliability"
 *     (artykuł psychometryczny, nie dane testowe) — cała tabela wyłączona z akcji;
 *     (2) `canonical_inbox_items` — 2 powiadomienia o realnym wywiadzie ("AI quality
 *     score: ...Top note: Remove all test-related disclaimers...") — wykluczone przez
 *     filtr `description !~* 'AI quality score'`.
 *
 * Uruchomienie:
 *   DATABASE_URL=... npx tsx server/scripts/sprzatanie-danych-testowych.ts --org=<uuid> --dry-run
 *   DATABASE_URL=... npx tsx server/scripts/sprzatanie-danych-testowych.ts --org=<uuid> --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool, type PoolClient } from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'evidence', 'sprzatanie-staging-20260906');

const TEST_PATTERN_SQL =
  "(AUDYT-|__M06|REPRO_TEST|_TMP|TEST-|test test|Lorem|asdf|qwerty|xxx|\\[E2E\\]|e2e-|smoke-|probe|dummy|foo bar)";
const TEST_PATTERN_RE = new RegExp(TEST_PATTERN_SQL, 'i');

const NAME_COL_HINT = /name|title|label|description|subject|headline|summary/i;

function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ==========================================
// A) Skan ogólny (informacyjny) — information_schema
// ==========================================

interface ColumnInfo {
  table: string;
  column: string;
  dataType: string;
}

async function loadOrgTables(client: PoolClient): Promise<Map<string, ColumnInfo[]>> {
  const tablesRes = await client.query<{ table_name: string }>(
    `select table_name from information_schema.columns
     where table_schema='public' and column_name='organization_id'
     group by table_name order by table_name`
  );
  const tables = tablesRes.rows.map((r) => r.table_name);
  const colsRes = await client.query<{ table_name: string; column_name: string; data_type: string }>(
    `select table_name, column_name, data_type from information_schema.columns
     where table_schema='public' and table_name = ANY($1) order by table_name, ordinal_position`,
    [tables]
  );
  const byTable = new Map<string, ColumnInfo[]>();
  for (const row of colsRes.rows) {
    const list = byTable.get(row.table_name) ?? [];
    list.push({ table: row.table_name, column: row.column_name, dataType: row.data_type });
    byTable.set(row.table_name, list);
  }
  return byTable;
}

interface GenericHit {
  table: string;
  column: string;
  count: number;
}

/** Skan informacyjny: dla każdej tabeli z organization_id + kolumną tekstową
 *  name/title/label/description/subject policz dokładne trafienia wzorca. Nie kasuje
 *  niczego — to jest wyłącznie sekcja "co widać" w DRY_RUN.md dla przejrzystości. */
async function genericScan(client: PoolClient, orgId: string): Promise<GenericHit[]> {
  const byTable = await loadOrgTables(client);
  const hits: GenericHit[] = [];
  for (const [table, cols] of byTable) {
    const textCols = cols.filter(
      (c) => (c.dataType === 'text' || c.dataType === 'character varying') && NAME_COL_HINT.test(c.column)
    );
    for (const c of textCols) {
      try {
        const r = await client.query(
          `SELECT count(*) FROM ${ident(table)} WHERE organization_id = $1 AND ${ident(c.column)} ~* $2`,
          [orgId, TEST_PATTERN_SQL]
        );
        const count = Number(r.rows[0].count);
        if (count > 0) hits.push({ table, column: c.column, count });
      } catch {
        // kolumna niekompatybilna z porównaniem tekstowym (np. jsonb w nietypowym trybie) — pomiń
      }
    }
  }
  return hits;
}

// ==========================================
// B) Skurowany plan akcji — 16 tabel zweryfikowanych ręcznie 2026-09-06
// ==========================================

type ActionMode = 'hard-delete' | 'soft-delete';

interface TableAction {
  table: string;
  idCol: string;
  /** Kolumny sprawdzane wzorcem (OR). */
  textCols: string[];
  mode: ActionMode;
  /** Dodatkowy warunek WHERE (SQL, bez parametrów) wykluczający znane fałszywe trafienia. */
  extraWhere?: string;
  /** Dla soft-delete: SQL SET (bez parametrów) — wartości z realnej domeny kolumny. */
  softSet?: string;
  note: string;
}

const ACTION_PLAN: TableAction[] = [
  {
    table: 'activity_logs',
    idCol: 'id',
    textCols: ['entity_name'],
    mode: 'hard-delete',
    note: 'Log zdarzeń, brak status/archived/deleted_at, brak dzieci FK. 17 wierszy testowych (WAVE1-TEST-CANVAS, qa-test-workflow, test-rec-map-direct-output).',
  },
  {
    table: 'artifact_lineage_receipts',
    idCol: 'receipt_id',
    textCols: ['title_snapshot'],
    mode: 'hard-delete',
    note: 'Paragon rodowodu artefaktu (NIE artifact_lifecycle_events — tamten ma trigger deny-delete/update i nie jest tu ruszany). Brak FK, brak triggera, sprawdzone w transakcji próbnej. 10 wierszy z jednej sesji E2E z 2026-08-06.',
  },
  {
    table: 'canonical_inbox_items',
    idCol: 'id',
    textCols: ['title', 'description'],
    mode: 'hard-delete',
    extraWhere: "(description IS NULL OR description !~* 'AI quality score')",
    note: 'Ma kolumnę status, ale to stan roboczy skrzynki (pending/resolved/triaged) bez wartości "archived" — brak dzieci FK, więc hard-delete. Wykluczone 2 realne powiadomienia o wywiadzie (fałszywe trafienie na słowo "test-related" we fragmencie treści notatki jakości AI).',
  },
  {
    table: 'conclusion_source_packs',
    idCol: 'id',
    textCols: ['context_summary'],
    mode: 'hard-delete',
    note: 'Brak status/archived/deleted_at, brak dzieci FK. 1 wiersz powiązany z testową ideą MyWork.',
  },
  {
    table: 'conclusions',
    idCol: 'id',
    textCols: ['title'],
    mode: 'soft-delete',
    softSet: "status = 'archived'",
    note: 'Kolumna status bez CHECK — bezpieczna wartość "archived". 12 wierszy (MyWork idea/notebook z sesji M05-E2E i M05-PROBE-DELETEME).',
  },
  {
    table: 'decisions',
    idCol: 'id',
    textCols: ['title'],
    mode: 'soft-delete',
    softSet: "status = 'cancelled'",
    note: 'Kolumna status bez CHECK, ale domena to stany decyzji (pending/expired/cancelled/approved/rejected) — "cancelled" to realna, bezpieczna wartość zamiast wymyślonej. Ma CASCADE do decision_alternatives/_comments/_votes/... oraz trigger trg_mw_decisions_inbox_lifecycle_upd (AFTER UPDATE) — soft-delete korzysta z tej samej ścieżki co normalna zmiana statusu w apce.',
  },
  {
    table: 'document_studio_templates',
    idCol: 'template_id',
    textCols: ['name'],
    mode: 'soft-delete',
    softSet: "status = 'deprecated'",
    note: 'CHECK dopuszcza tylko draft/approved/deprecated — "deprecated" to poprawna wartość domenowa na wycofanie szablonu. 4 wiersze E2E-20260806.',
  },
  {
    table: 'generated_workbooks',
    idCol: 'id',
    textCols: ['title', 'file_name'],
    mode: 'soft-delete',
    softSet: 'archived_at = now()',
    note: 'Kolumna archived_at istnieje dokładnie po to. 6 unikalnych wierszy (dopasowanie po title LUB file_name, deduplikowane po id w SQL).',
  },
  {
    table: 'organization_context_items',
    idCol: 'id',
    textCols: ['source_label'],
    mode: 'hard-delete',
    note: 'Brak status/archived/deleted_at; ma dziecko FK organization_context_claims z ON DELETE CASCADE. 164 wiersze (M05-E2E-*, __M06_REPRO_TEST__, M05-PROBE-*, ZPROBE-TOP-*, AUDYT-M06, M08-Manual-Test-Table).',
  },
  {
    table: 'presentation_decks',
    idCol: 'id',
    textCols: ['title'],
    mode: 'hard-delete',
    note: 'Ma kolumnę status, ALE CHECK ogranicza do draft/generating/ready/exported/failed — żadna wartość nie oznacza "ukryty/wycofany", więc soft-delete jest niewykonalny bez łamania CHECK. Wyjątek udokumentowany: hard-delete uzasadniony przez dzieci FK z CASCADE (presentation_cards, presentation_deck_versions). 1 wiersz E2E-20260806.',
  },
  {
    table: 'presentation_templates',
    idCol: 'id',
    textCols: ['name'],
    mode: 'soft-delete',
    softSet: "lifecycle_state = 'deprecated', is_active = false, deprecated_at = now(), deprecated_by = 'system:sprzatanie-2026-09-06'",
    note: 'CHECK dopuszcza draft/approved/deprecated na lifecycle_state; ma też is_active/deprecated_at dedykowane do wycofywania. 6 wierszy E2E-20260806.',
  },
  {
    table: 'tool_sessions',
    idCol: 'id',
    textCols: ['name'],
    mode: 'soft-delete',
    softSet: "status = 'ARCHIVED'",
    note: 'Kolumna status bez CHECK (domena APPROVED/DRAFT/REVIEW, wielkie litery — konwencja zachowana). Sprawdzono: 0 wierszy w budgets/finance_budget_registration_receipts (NO ACTION) odwołuje się do tych 12 sesji — mimo to soft-delete, nie hard, żeby nie zależeć od tego sprawdzenia w przyszłości.',
  },
  {
    table: 'tp_base_templates',
    idCol: 'id',
    textCols: ['name'],
    mode: 'soft-delete',
    softSet: "status = 'deprecated'",
    note: 'CHECK dopuszcza draft/approved/deprecated. 3 wiersze E2E-20260806.',
  },
  {
    table: 'v8_output_artifacts',
    idCol: 'artifact_id',
    textCols: ['title_snapshot', 'origin_summary_json'],
    mode: 'hard-delete',
    note: 'Brak kolumny status/archived/deleted_at (ma delivery_state/is_draft, ale to inne pola domenowe, nie soft-delete). Brak dzieci FK. 43 unikalne wiersze (TEST-RELIABILITY-*, TEST-RETEST-*, *-E2E-20260806); origin_summary_json to podzbiór title_snapshot — deduplikacja po artifact_id w SQL.',
  },
  {
    table: 'wave5_artifacts',
    idCol: 'artifact_id',
    textCols: ['title'],
    mode: 'soft-delete',
    softSet: "status = 'archived'",
    note: 'Kolumna status bez CHECK. 3 wiersze TERESA-E2E-20260806/TEMPLATE-E2E-20260806.',
  },
  {
    table: 'work_canvas_drafts',
    idCol: 'id',
    textCols: ['title'],
    mode: 'hard-delete',
    note: 'To szkic roboczy (draft), nie ma status/archived/deleted_at; ma dziecko FK work_canvas_versions z ON DELETE CASCADE. 1 wiersz "Regression Test DocumentWAVE1-TEST-CANVAS".',
  },
];

/** wave6_context_ledger: NIE ujęte w planie. Oba trafienia wzorca (source_title ~* 'TEST-')
 *  to fałszywe trafienia — realny artykuł o rzetelności test-retest (psychometria), nie dane
 *  testowe. Zero prawdziwych kandydatów w tej tabeli na 2026-09-06. */
const EXCLUDED_TABLES_NOTE =
  'wave6_context_ledger: 2 trafienia wzorca to fałszywe pozytywy (artykuł "Test-retest reliability..." — treść merytoryczna, nie dane testowe). Tabela wykluczona z planu akcji.';

// ==========================================
// C) Tłumaczenia PL — spotkania / zadania / inicjatywy
// ==========================================

/** 9 z 10 spotkań demo DBR77 — tytuły angielskie, realne spotkania (są uczestnicy,
 *  lokalizacja, agenda) — TŁUMACZENIE, nie kasowanie. */
const MEETING_TITLE_TRANSLATIONS: Record<string, string> = {
  'Platform Migration — Kick-off': 'Migracja platformy — spotkanie inicjujące',
  'AI Strategy Working Group — Weekly Sync': 'Grupa robocza ds. strategii AI — cotygodniowa synchronizacja',
  'Steering Committee — Q2 Transformation Program': 'Komitet sterujący — program transformacji Q2',
  'Public Beta Launch — Go/No-Go Review': 'Start wersji beta — decyzja Go/No-Go',
  'SOC 2 Readiness — External Auditor Briefing': 'Gotowość do SOC 2 — briefing z audytorem zewnętrznym',
  '1:1 with Anna — Backend Architecture Review': '1:1 z Anną — przegląd architektury backendu',
  'Sprint 14 Planning — Product & Engineering': 'Planowanie Sprintu 14 — produkt i inżynieria',
  'Client Demo — Acme Corp Digital Transformation': 'Demo dla klienta — transformacja cyfrowa Acme Corp',
  '1:1 with CTO — Weekly Catch-up': '1:1 z CTO — cotygodniowe spotkanie',
};

/** 10. spotkanie: "Zaplanuj i wykonaj dla mnie inicjatywe której celem jest zrobienie planu…"
 *  — 0 uczestników, brak lokalizacji, tytuł to ślad promptu, nie realne spotkanie
 *  (dokładnie wzorzec ze zgłoszenia audytu). Soft-delete: meetings ma kolumnę status
 *  bez CHECK, "cancelled" to realna wartość domenowa. */
// UWAGA: w bazie tytuł ma literówkę AI ("inicatywe" zamiast "inicjatywę") — dopasowanie
// po krótszym, wspólnym prefiksie, żeby nie zależeć od pisowni wygenerowanej przez model.
const GARBAGE_MEETING_TITLE_PREFIX = 'Zaplanuj i wykonaj dla mnie';

/** Tłumaczenia tytułów ZADAŃ — tylko oczywista treść katalogowa/demo (id demo-* lub
 *  ogólne nazwy szablonowe). Świadomie WYŁĄCZONE: zgłoszenia [PRODUCTION]/[STAGING]/
 *  [DEVELOPMENT] BUG:/IDEA: — to prawdziwe wewnętrzne zgłoszenia inżynierskie, nie treść
 *  demo, i nie wolno ich ruszać. Też wyłączone: pojedyncze niejednoznaczne słowa
 *  ("kosmos", "Frame") — do decyzji właściciela (patrz RAPORT.md). */
const TASK_TITLE_TRANSLATIONS: Record<string, string> = {
  'Security Audit Completion': 'Zakończenie audytu bezpieczeństwa',
  'Refactor Authentication Module': 'Refaktoryzacja modułu uwierzytelniania',
  'Review Q4 Budget Report': 'Przegląd raportu budżetowego za Q4',
  'Deploy v2.5 Release': 'Wdrożenie wersji v2.5',
  'Research AI Integration Options': 'Analiza opcji integracji AI',
  'Cloud Infrastructure Planning': 'Planowanie infrastruktury chmurowej',
  'Technology Stack Evaluation': 'Ocena stosu technologicznego',
  'Fix Critical Production Bug': 'Naprawa krytycznego błędu produkcyjnego',
  'Review Pull Requests': 'Przegląd pull requestów',
  'Kick-off and scope alignment': 'Spotkanie inicjujące i ustalenie zakresu',
  'Prepare pilot environment': 'Przygotowanie środowiska pilotażowego',
  'Define target process and acceptance criteria': 'Zdefiniowanie procesu docelowego i kryteriów akceptacji',
  'Submit Compliance Documentation': 'Złożenie dokumentacji zgodności',
  'Annual Performance Reviews': 'Roczne oceny pracownicze',
  'Team Standup Presentation': 'Prezentacja na standupie zespołu',
  'Update Project Documentation': 'Aktualizacja dokumentacji projektu',
  'Prepare Demo for Stakeholders': 'Przygotowanie demo dla interesariuszy',
  'Architecture Review Session': 'Sesja przeglądu architektury',
  'Interview: Digital Maturity Discovery': 'Wywiad: odkrywanie dojrzałości cyfrowej',
  'Establish IoT Network Infrastructure': 'Budowa infrastruktury sieciowej IoT',
  'Develop Machine Learning Model': 'Budowa modelu uczenia maszynowego',
  'Conduct User Training Sessions': 'Przeprowadzenie szkoleń użytkowników',
  'Monitor Performance and Refine Processes': 'Monitorowanie wydajności i doskonalenie procesów',
  'Document Changeover Optimization Processes': 'Dokumentacja procesów optymalizacji przezbrojeń',
  'Configure pilot environment and integrations': 'Konfiguracja środowiska pilotażowego i integracji',
  'Kick-off workshop with key stakeholders': 'Warsztat inicjujący z kluczowymi interesariuszami',
  'Prepare data model and ingestion plan': 'Przygotowanie modelu danych i planu wczytywania',
  'DevOps — CI/CD pipeline hardening': "DevOps — utwardzenie pipeline'u CI/CD",
  'Quality Management 4.0 — SPC dashboard MVP': 'Zarządzanie jakością 4.0 — MVP pulpitu SPC',
  'RPA pilot — invoice processing automation': 'Pilotaż RPA — automatyzacja przetwarzania faktur',
  'Team capacity planning — Sprint 15': 'Planowanie zasobów zespołu — Sprint 15',
  'Vendor shortlist for IoT platform (IRIS)': 'Krótka lista dostawców platformy IoT (IRIS)',
  'Cloud migration — cost optimization review': 'Migracja do chmury — przegląd optymalizacji kosztów',
  'Data migration dry-run — ERP staging': 'Próba migracji danych — środowisko testowe ERP',
  'Security audit — OT/IT convergence review': 'Audyt bezpieczeństwa — przegląd konwergencji OT/IT',
  'Prepare board presentation — digital maturity results': 'Przygotowanie prezentacji dla zarządu — wyniki dojrzałości cyfrowej',
  'Finalize Q2 transformation roadmap': 'Finalizacja mapy drogowej transformacji Q2',
  'Interview: Quick Assessment': 'Wywiad: szybka ocena',
  'Interview: DBR77 — Marketing & Promotion (Ideas)': 'Wywiad: DBR77 — marketing i promocja (pomysły)',
  'Interview: DBR77 — How to Sell Better (Ideas)': 'Wywiad: DBR77 — jak sprzedawać lepiej (pomysły)',
  'Q2 Strategy — Market expansion playbook': 'Strategia Q2 — plan ekspansji rynkowej',
  'Meeting Notes': 'Notatki ze spotkania',
};

/** Tłumaczenia nazw INICJATYW — katalog demo + etykiety macierzy TOWS. Wyłączone jako
 *  niejednoznaczne (do decyzji właściciela): "F1-26 from assessment", "F3 Rich Card
 *  Initiative", "P1", "New Idea" (podejrzenie, że to domyślny placeholder aplikacji, nie
 *  dane — wymaga sprawdzenia w kodzie, nie tłumaczenia w bazie). */
const INITIATIVE_NAME_TRANSLATIONS: Record<string, string> = {
  'Digital Performance Management': 'Zarządzanie wydajnością cyfrową',
  'Automated Changeover Optimization': 'Automatyzacja optymalizacji przezbrojeń',
  'Data Analytics Platform': 'Platforma analityki danych',
  'Cybersecurity Enhancement Program': 'Program wzmocnienia cyberbezpieczeństwa',
  'IoT Sensor Network Deployment': 'Wdrożenie sieci czujników IoT',
  'ERP System Modernization': 'Modernizacja systemu ERP',
  'Quality Management System 4.0': 'System zarządzania jakością 4.0',
  'DevOps Transformation': 'Transformacja DevOps',
  'RPA Implementation': 'Wdrożenie RPA',
  'Cloud Migration Phase 2': 'Migracja do chmury — Faza 2',
  'AI Audit Deep Research V1': 'Pogłębiony audyt AI — wersja 1',
  'Approval SLA and escalation governance': 'SLA zatwierdzania i zarządzanie eskalacją',
  'KPI contract and metric ownership': 'Kontrakt KPI i odpowiedzialność za mierniki',
  'Planning-to-execution handoff automation': 'Automatyzacja przekazania z planowania do realizacji',
  'SMED pilot on Line 3': 'Pilotaż SMED na Linii 3',
  'Decision rights redesign for exceptions': 'Przeprojektowanie uprawnień decyzyjnych dla wyjątków',
  'Weekly priorities — Sprint 14 focus areas': 'Priorytety tygodnia — obszary skupienia Sprintu 14',
  'Q2 Strategy — Market expansion playbook': 'Strategia Q2 — plan ekspansji rynkowej',
  'Meeting Notes': 'Notatki ze spotkania',
  'Cybersecurity Enhancement Program (Fork)': 'Program wzmocnienia cyberbezpieczeństwa (kopia)',
  'Industrial Intelligence Newsletter Value-First Pipeline':
    'Newsletter Industrial Intelligence — lejek zorientowany na wartość',
  'Offense: leverage strengths to capture opportunities': 'Ofensywa: wykorzystaj mocne strony, aby uchwycić szanse',
  'Repair: eliminate weaknesses exposed to threats': 'Naprawa: wyeliminuj słabości odsłonięte przez zagrożenia',
  'Conversion: fix weaknesses to unlock opportunities': 'Konwersja: usuń słabości, aby odblokować szanse',
  'Defense: use strengths as a shield against threats': 'Obrona: wykorzystaj mocne strony jako tarczę przed zagrożeniami',
};

/** Pozycje jednoznacznie ANI do skasowania ANI do automatycznego przetłumaczenia —
 *  wymagają decyzji właściciela. Wypisywane w RAPORT.md, nic z tym skrypt nie robi. */
const OWNER_DECISION_NOTES = [
  'initiatives.name = "New Idea" — podejrzenie domyślnego placeholdera aplikacji (sprawdzić i18n w kodzie, nie w danych).',
  'initiatives.name = "F1-26 from assessment", "F3 Rich Card Initiative", "P1" — niejednoznaczne kody wewnętrzne, znaczenie nieznane.',
  'tasks.title = "kosmos" (3 wiersze) i "Frame" (1 wiersz) — pojedyncze niejednoznaczne słowa, może testowe może nie.',
  'tasks.title zaczynające się od "[PRODUCTION] BUG:", "[STAGING] BUG:", "[STAGING] IDEA:", "[DEVELOPMENT] BUG:" — ŚWIADOMIE NIERUSZANE: to wyglądają na realne wewnętrzne zgłoszenia inżynierskie (np. "Inbox- nie wyswietlaja sie wiadomosci", "Kanban gubi karty po odswiezeniu"), nie na treść demo. Jeden z nich ("[STAGING] BUG: AAAA...A", ok. 110 znaków) wygląda na przypadkowe/testowe wciśnięcie klawisza — do potwierdzenia przez właściciela, czy to prawdziwe zgłoszenie czy śmieć.',
  'tasks.title zaczynające się od "AI/Industry:" (Safety CV, Digital Twin, Supply chain) — mieszany PL/EN żargon techniczny, zostawione bez zmian (niska pewność, że tłumaczenie poprawi czytelność).',
];

// ==========================================
// Wykonanie planu
// ==========================================

interface ChangeLogEntry {
  table: string;
  id: string;
  action: string;
  before: string;
  after: string;
}

async function findOrgId(client: PoolClient, needle: string): Promise<{ id: string; name: string }> {
  if (/^[0-9a-f-]{36}$/i.test(needle)) {
    const r = await client.query('select id, name from organizations where id = $1', [needle]);
    if (r.rows[0]) return r.rows[0];
  }
  const r = await client.query('select id, name from organizations where name ilike $1', [needle]);
  if (!r.rows[0]) throw new Error(`Nie znaleziono organizacji dla "${needle}"`);
  return r.rows[0];
}

async function planCandidates(
  client: PoolClient,
  orgId: string,
  action: TableAction
): Promise<Array<{ id: string; matchedCol: string; text: string; createdAt: string | null }>> {
  const idColSql = ident(action.idCol);
  const rows = new Map<string, { matchedCol: string; text: string; createdAt: string | null }>();
  for (const col of action.textCols) {
    const where = [`organization_id = $1`, `${ident(col)} ~* $2`];
    if (action.extraWhere) where.push(action.extraWhere);
    const createdCol = await columnExists(client, action.table, 'created_at');
    const selectCreated = createdCol ? `${ident('created_at')}::text` : 'NULL';
    const sql = `SELECT ${idColSql}::text as id, ${ident(col)} as txt, ${selectCreated} as created_at
                 FROM ${ident(action.table)} WHERE ${where.join(' AND ')}`;
    const r = await client.query(sql, [orgId, TEST_PATTERN_SQL]);
    for (const row of r.rows) {
      if (!rows.has(row.id)) {
        rows.set(row.id, { matchedCol: col, text: String(row.txt).slice(0, 140), createdAt: row.created_at });
      }
    }
  }
  return Array.from(rows.entries()).map(([id, v]) => ({ id, ...v }));
}

const columnExistsCache = new Map<string, boolean>();
async function columnExists(client: PoolClient, table: string, column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  if (columnExistsCache.has(key)) return columnExistsCache.get(key)!;
  const r = await client.query(
    `select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2`,
    [table, column]
  );
  const exists = r.rows.length > 0;
  columnExistsCache.set(key, exists);
  return exists;
}

async function applyAction(
  client: PoolClient,
  orgId: string,
  action: TableAction,
  candidates: Array<{ id: string; matchedCol: string; text: string }>,
  log: ChangeLogEntry[]
): Promise<void> {
  if (candidates.length === 0) return;
  const ids = candidates.map((c) => c.id);
  if (action.mode === 'hard-delete') {
    const sql = `DELETE FROM ${ident(action.table)} WHERE organization_id = $1 AND ${ident(action.idCol)}::text = ANY($2) RETURNING ${ident(action.idCol)}::text as id`;
    const r = await client.query(sql, [orgId, ids]);
    for (const row of r.rows) {
      const c = candidates.find((x) => x.id === row.id);
      log.push({ table: action.table, id: row.id, action: 'DELETE', before: c?.text ?? '', after: '(usunięto)' });
    }
  } else {
    const sql = `UPDATE ${ident(action.table)} SET ${action.softSet} WHERE organization_id = $1 AND ${ident(action.idCol)}::text = ANY($2) RETURNING ${ident(action.idCol)}::text as id`;
    const r = await client.query(sql, [orgId, ids]);
    for (const row of r.rows) {
      const c = candidates.find((x) => x.id === row.id);
      log.push({
        table: action.table,
        id: row.id,
        action: `UPDATE (${action.softSet})`,
        before: c?.text ?? '',
        after: '(zarchiwizowano)',
      });
    }
  }
}

async function applyTranslations(
  client: PoolClient,
  orgId: string,
  table: string,
  col: string,
  translations: Record<string, string>,
  log: ChangeLogEntry[]
): Promise<void> {
  for (const [before, after] of Object.entries(translations)) {
    const sql = `UPDATE ${ident(table)} SET ${ident(col)} = $3 WHERE organization_id = $1 AND ${ident(col)} = $2 RETURNING id::text as id`;
    const r = await client.query(sql, [orgId, before, after]);
    for (const row of r.rows) {
      log.push({ table, id: row.id, action: 'TRANSLATE', before, after });
    }
  }
}

async function handleGarbageMeeting(client: PoolClient, orgId: string, log: ChangeLogEntry[], mode: 'dry-run' | 'apply') {
  const r = await client.query(
    `SELECT id, title FROM meetings WHERE organization_id = $1 AND title LIKE $2 || '%'`,
    [orgId, GARBAGE_MEETING_TITLE_PREFIX]
  );
  if (mode === 'dry-run') return r.rows;
  if (r.rows.length > 0) {
    const ids = r.rows.map((x) => x.id);
    await client.query(`UPDATE meetings SET status = 'cancelled' WHERE organization_id = $1 AND id = ANY($2)`, [
      orgId,
      ids,
    ]);
    for (const row of r.rows) {
      log.push({ table: 'meetings', id: row.id, action: "UPDATE (status='cancelled')", before: row.title, after: '(anulowano — tytuł to ślad promptu, 0 uczestników, brak lokalizacji)' });
    }
  }
  return r.rows;
}

// ==========================================
// Raportowanie
// ==========================================

function fmtTable(rows: string[][], header: string[]): string {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const row of rows) lines.push(`| ${row.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |`);
  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argOf = (name: string): string | undefined => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const mode: 'dry-run' | 'apply' = args.includes('--apply') ? 'apply' : 'dry-run';
  const orgNeedle = argOf('org') ?? 'a3e05d4a-5397-419d-b486-8e44366c0063';
  const databaseUrl = argOf('database-url') ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Brak DATABASE_URL (albo --database-url=...)');
  if (/consultify\.ai/i.test(databaseUrl)) {
    throw new Error('ZATRZYMANO: adres wygląda na produkcję consultify.ai — ten skrypt działa wyłącznie na stagingu.');
  }

  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: /sslmode=require|sslmode=verify/.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 2,
  });
  const client = await pool.connect();
  const log: ChangeLogEntry[] = [];
  try {
    const org = await findOrgId(client, orgNeedle);
    process.stdout.write(`\n=== SPRZĄTANIE DANYCH TESTOWYCH · staging ===\nTryb: ${mode}\nOrganizacja: ${org.name} (${org.id})\n\n`);

    // --- A) skan ogólny (informacyjny) ---
    process.stdout.write('Skan ogólny (information_schema, wszystkie tabele z organization_id)...\n');
    const generic = await genericScan(client, org.id);
    process.stdout.write(`Tabele z trafieniem wzorca: ${generic.length}\n`);

    // --- B) plan kandydatów per tabela ---
    const planResults: Array<{ action: TableAction; candidates: Awaited<ReturnType<typeof planCandidates>> }> = [];
    for (const action of ACTION_PLAN) {
      const candidates = await planCandidates(client, org.id, action);
      planResults.push({ action, candidates });
    }
    const garbageMeetingRows = await handleGarbageMeeting(client, org.id, log, 'dry-run');

    // --- raport DRY_RUN.md (zawsze pisany, też w --apply, jako stan PRZED) ---
    const dryRunPath = path.join(EVIDENCE_DIR, 'DRY_RUN.md');
    const sections: string[] = [];
    sections.push(`# DRY RUN — sprzątanie danych testowych DBR77\n\nWygenerowano: ${nowIso()}\nOrganizacja: ${org.name} (${org.id})\n`);

    sections.push(`## A. Skan ogólny (informacyjny, information_schema)\n`);
    sections.push(
      fmtTable(
        generic.map((h) => [h.table, h.column, String(h.count)]),
        ['tabela', 'kolumna', 'liczba trafień']
      )
    );
    sections.push(`\n_Uwaga: ${EXCLUDED_TABLES_NOTE}_\n`);

    sections.push(`\n## B. Plan akcji (skurowany, ręcznie zweryfikowany) — kandydaci do USUNIĘCIA/ARCHIWIZACJI\n`);
    let totalCandidates = 0;
    for (const { action, candidates } of planResults) {
      totalCandidates += candidates.length;
      sections.push(`\n### ${action.table} — ${action.mode} (${candidates.length} wierszy)\n`);
      sections.push(`_${action.note}_\n`);
      sections.push(
        fmtTable(
          candidates.slice(0, 30).map((c) => [c.id, c.matchedCol, c.text, c.createdAt ?? '']),
          ['id', 'kolumna', 'tekst (skrót)', 'created_at']
        )
      );
      if (candidates.length > 30) sections.push(`\n_... +${candidates.length - 30} więcej (pełna lista w bazie, zapytanie w RAPORT.md)_\n`);
    }

    sections.push(`\n### meetings — soft-delete (status='cancelled') (${garbageMeetingRows.length} wiersz)\n`);
    sections.push('_Tytuł to ślad promptu AI ("Zaplanuj i wykonaj dla mnie inicjatywe..."), 0 uczestników, brak lokalizacji — dokładnie wzorzec ze zgłoszenia audytu._\n');
    sections.push(fmtTable(garbageMeetingRows.map((r: any) => [r.id, r.title]), ['id', 'tytuł']));

    sections.push(`\n## C. Tłumaczenia PL (przed → po)\n`);
    sections.push(`\n### meetings.title (9 spotkań demo)\n`);
    sections.push(
      fmtTable(
        Object.entries(MEETING_TITLE_TRANSLATIONS).map(([b, a]) => [b, a]),
        ['przed (EN)', 'po (PL)']
      )
    );
    sections.push(`\n### tasks.title (${Object.keys(TASK_TITLE_TRANSLATIONS).length} unikalnych tytułów)\n`);
    sections.push(
      fmtTable(
        Object.entries(TASK_TITLE_TRANSLATIONS).map(([b, a]) => [b, a]),
        ['przed (EN)', 'po (PL)']
      )
    );
    sections.push(`\n### initiatives.name (${Object.keys(INITIATIVE_NAME_TRANSLATIONS).length} unikalnych nazw)\n`);
    sections.push(
      fmtTable(
        Object.entries(INITIATIVE_NAME_TRANSLATIONS).map(([b, a]) => [b, a]),
        ['przed (EN)', 'po (PL)']
      )
    );

    sections.push(`\n## D. Do decyzji właściciela (NIE ruszane automatycznie)\n`);
    for (const note of OWNER_DECISION_NOTES) sections.push(`- ${note}`);

    sections.push(
      `\n## Podsumowanie\n\n- Kandydaci do usunięcia/archiwizacji (plan skurowany): **${totalCandidates}** wierszy w ${ACTION_PLAN.length} tabelach + 1 spotkanie.\n- Tłumaczenia: **${Object.keys(MEETING_TITLE_TRANSLATIONS).length}** spotkań, **${Object.keys(TASK_TITLE_TRANSLATIONS).length}** unikalnych tytułów zadań, **${Object.keys(INITIATIVE_NAME_TRANSLATIONS).length}** unikalnych nazw inicjatyw.\n- Pozycji do decyzji właściciela: **${OWNER_DECISION_NOTES.length}**.\n`
    );
    fs.writeFileSync(dryRunPath, sections.join('\n'));
    process.stdout.write(`\nZapisano ${dryRunPath}\n`);

    if (mode === 'dry-run') {
      process.stdout.write('\nTryb --dry-run: nic nie zapisano do bazy.\n');
      return;
    }

    // --- APPLY ---
    await client.query('BEGIN');
    try {
      for (const { action, candidates } of planResults) {
        await applyAction(client, org.id, action, candidates, log);
      }
      await handleGarbageMeeting(client, org.id, log, 'apply');
      await applyTranslations(client, org.id, 'meetings', 'title', MEETING_TITLE_TRANSLATIONS, log);
      await applyTranslations(client, org.id, 'tasks', 'title', TASK_TITLE_TRANSLATIONS, log);
      await applyTranslations(client, org.id, 'initiatives', 'name', INITIATIVE_NAME_TRANSLATIONS, log);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    const logPath = path.join(EVIDENCE_DIR, 'APPLY.log');
    const logLines = log.map(
      (e) => `[${nowIso()}] ${e.table} id=${e.id} ${e.action} | przed: ${e.before} | po: ${e.after}`
    );
    fs.writeFileSync(logPath, logLines.join('\n') + '\n');
    process.stdout.write(`\nZapisano ${logPath} (${log.length} zmian)\n`);

    // --- re-dry-run po apply: potwierdzenie 0 kandydatów jednoznacznych ---
    let remaining = 0;
    for (const action of ACTION_PLAN) {
      const c = await planCandidates(client, org.id, action);
      remaining += c.length;
    }
    const remainingGarbageMeeting = await handleGarbageMeeting(client, org.id, [], 'dry-run');
    process.stdout.write(
      `\nPo apply — ponowny skan planu: ${remaining} kandydatów jednoznacznych pozostało w ${ACTION_PLAN.length} tabelach (oczekiwane: 0 dla hard-delete; soft-delete tabele nadal "widzą" wiersz wzorcem tekstu, ale są zarchiwizowane — patrz status w bazie).\n` +
        `Pozostałe śmieciowe spotkanie: ${remainingGarbageMeeting.length} (oczekiwane: 0 lub status=cancelled).\n`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

const invokedDirectly = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(`\nBŁĄD: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}

export {
  ACTION_PLAN,
  MEETING_TITLE_TRANSLATIONS,
  TASK_TITLE_TRANSLATIONS,
  INITIATIVE_NAME_TRANSLATIONS,
  TEST_PATTERN_RE,
};
