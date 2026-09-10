#!/usr/bin/env node
/**
 * zespol-obciazenie-dbr77-20260910.mjs — DEC-462 (zadanie D-A): dosiew zespołu,
 * przypisań zadań i zapotrzebowania na etaty dla DBR77 na STAGING, tak żeby
 * zakładka Realizacja → Zasoby (`GET /api/execution-control/capacity/resource-plan`,
 * `getExecutionResourcePlan` w server/src/services/workloadCapacityService.ts:827)
 * liczyła realne wartości zamiast placeholderów.
 *
 * ------------------------------------------------------------------------------
 * MODEL OBCIĄŻENIA — ZMIERZONY W KODZIE PRZED NAPISANIEM TEGO SKRYPTU (KROK 0)
 * ------------------------------------------------------------------------------
 * Jedyny czytelnik "Zasoby": `ExecutionResourcesSurface.tsx:215` woła
 * `readExecutionResourcePlan(8)` → `GET .../capacity/resource-plan`
 * (server/src/routes/executionControl.routes.ts:1083) → `getExecutionResourcePlan`
 * (server/src/services/workloadCapacityService.ts:827-1021). ŻADNA inna tabela
 * (initiative_resources, staffing_plans, initiatives.required_capacity_fte) NIE
 * jest przez tę trasę czytana — komentarz w routes:1067-1075 mówi to wprost:
 * `/capacity/timeline` (osobna trasa, karmi kartę "Kokpit"/Governed Control Tower,
 * NIE zakładkę Zasoby) liczy podaż z `initiative_resources`, a resource-plan
 * czyta podaż WYŁĄCZNIE z profilu osoby.
 *
 * POPYT (demand): `tasks` WHERE organization_id=? AND assignee_id IS NOT NULL
 *   AND status NOT IN ('done','completed','validated','cancelled') — CAŁA
 *   organizacja, NIEZALEŻNIE od initiative_id (nawet NULL). Dla każdego zadania:
 *     - due_date IS NULL           → unscheduledHours (nie zgadujemy tygodnia)
 *     - due_date < poniedziałek biężącego tygodnia → backlogHours (zaległość),
 *       remaining = max(estimated_hours - actual_hours, 0)
 *     - due_date >= poniedziałek   → demandHours rozłożone równo między
 *       max(created_at, poniedziałek) a due_date, dniami roboczymi
 *       (`spreadTaskHoursByWeek`, workloadCapacityService.ts:732)
 *   Innymi słowy: popyt > 0 wymaga OTWARTEGO zadania z `assignee_id` I
 *   `due_date` W PRZYSZŁOŚCI I `estimated_hours` > 0. `initiatives.required_
 *   capacity_fte` NIE wchodzi w ten wzór w ogóle.
 *
 * PODAŻ (supply): `users.job_title` (COALESCE z `title`), `users.weekly_
 *   capacity_hours`, `users.availability_percent`. Brak profilu (NULL w
 *   weekly_capacity_hours) → supplySource='DOMYSLNA', 40h/100% (CAPACITY_
 *   POLICY.weeklyHoursPerFte, server/src/services/capacityPolicy.ts).
 *   Podaż tygodnia = dni_robocze_tygodnia × (weekly/5) × availability%.
 *
 * OBŁOŻENIE (utilizationPercent): round(demandHours/supplyHours × 100).
 *   "Przeciążony tydzień" (routes.ts:1096, `overloadedCount`) = wiersz
 *   (osoba,tydzień) z utilizationPercent > 105 (CAPACITY_POLICY.overloadRatio).
 *   TA metryka jest NIEZALEŻNA od backlogHours — backlog stoi obok, osobno.
 *
 * ★ POMIAR (ten skrypt, przed jakimkolwiek zapisem) ujawnił TWARDY LIMIT
 *   danych na STAGING/DBR77 (D-A, 2026-09-10): w CAŁEJ organizacji istniały
 *   TYLKO 3 otwarte zadania z `due_date` w przyszłości (>= 2026-09-07), i
 *   wszystkie trzy miały `task_type='interview'` (auto-generowane zadania
 *   modułu Interview, `description` = `{"type":"interview_assignment",...}`)
 *   — a `task_type='interview'` w CAŁEJ organizacji (15 wierszy) NIGDY nie ma
 *   estimated_hours (0/15). Zmiana `due_date` ISTNIEJĄCYCH zaległych zadań
 *   była WPROST zakazana przez zlecenie D-A, a mandat D-A obejmował TYLKO
 *   przypisanie zadań ISTNIEJĄCYCH — stąd STOP: "przeciążony tydzień" nie
 *   dawało się uczciwie dosiać bez fabrykacji terminów istniejących wierszy.
 *
 * ★ D-A2 (2026-09-10, dokończenie DEC-462): nadzorca rozszerzył mandat na
 *   TWORZENIE nowych zadań (zamiast zmiany terminów istniejących) — to
 *   usuwa ograniczenie z D-A bez fabrykacji cudzych danych. `applyTasks()`
 *   ma teraz DWIE części: CZĘŚĆ A (bez zmian, D-A: przypisanie 25 istniejących
 *   zaległych zadań — feeduje backlogHours) i CZĘŚĆ B (NOWE, D-A2: 34 nowe
 *   zadania `task_type='execution'` z realnym `due_date` w przyszłości i
 *   `estimated_hours>0`, rozłożone na 10 inicjatyw z `required_capacity_fte` —
 *   feeduje demandHours/utilizationPercent, czyli dokładnie to, czego brakowało
 *   po D-A). KROK 0 (kolumny NOT NULL, wzorzec wiersza z UI) i dobór dat/godzin
 *   (żeby trafić w konkretne przeciążone tygodnie) opisane przy CZĘŚCI B niżej.
 *
 * ------------------------------------------------------------------------------
 * ZAKRES OPERACJI (dry-run domyślny, każda idempotentna, jawne id, PO ANGIELSKU)
 * ------------------------------------------------------------------------------
 *   users        — 15 istniejących użytkowników DBR77: job_title (angielski),
 *                  weekly_capacity_hours (32-40), availability_percent (60-100).
 *                  NIE rusza email/imię/nazwisko/rolę/hasło. Konto właściciela
 *                  (admin@dbr77.com — piotr.wisniewski@dbr77.com NIE istnieje w
 *                  tej organizacji, zmierzone zapytaniem SELECT) dostaje pełną
 *                  dostępność (40h/100%) i zachowuje już ustawiony job_title
 *                  "Tenant Admin". Konto testowe acceptance.owner@consultify.local
 *                  dostaje neutralny job_title, ale jest WYŁĄCZONE z operacji
 *                  `tasks` (higiena danych demo — zero rekordów testowych w
 *                  przydziałach realnej pracy).
 *   initiatives  — required_capacity_fte (0.5-3.0) na 10 największych aktywnych
 *                  inicjatywach DBR77 (IN_EXECUTION/APPROVED/PENDING_APPROVAL,
 *                  ranking po liczbie zadań). Pominięte: rekord akceptacyjny
 *                  (`...--acceptance--initiative`, 0 zadań, testowy) i duplikat
 *                  "(kopia)" — podstawione kolejnymi z rankingu. UWAGA: to pole
 *                  NIE wpływa na Zasoby (patrz wyżej) — feeduje inne czytniki
 *                  (capacityRoleSheet.ts, planningPortfolioReadService.ts,
 *                  Initiatives capacity views).
 *   allocations  — wiersze w `initiative_resources` (user_id, allocation_
 *                  percentage, start_date/end_date na 8 tygodni od bieżącego
 *                  poniedziałku) dla tych samych 10 inicjatyw. Też NIE karmi
 *                  Zasoby — karmi `/capacity/timeline` (Kokpit/Governed Control
 *                  Tower), zgodnie z komentarzem w executionControl.routes.ts.
 *                  Idempotentne przez `idempotency_key`.
 *   tasks        — assignee_id na 25 ISTNIEJĄCYCH otwartych zadaniach DBR77,
 *                  które już mają realny due_date i estimated_hours>0, ale nie
 *                  mają assignee_id (zmierzone: WSZYSTKIE 25 mają due_date w
 *                  PRZESZŁOŚCI względem 2026-09-10 → trafiają w backlogHours,
 *                  nie w demandHours — to jedyny uczciwy sposób podniesienia
 *                  peopleCount/zaległości bez fabrykacji terminów/godzin).
 *                  Rozrzut celowo faworyzuje 7 osób, które DZIŚ nie mają ŻADNEGO
 *                  przypisanego otwartego zadania (peopleCount rośnie z 7→14).
 *                  NIE zmienia status/tytuł/due_date/estimated_hours żadnego
 *                  zadania. Pomija konto testowe acceptance.owner.
 *   measure      — TYLKO ODCZYT: replika 1:1 czystych funkcji
 *                  `getExecutionResourcePlan` (skopiowanych z workloadCapacity-
 *                  Service.ts, bo ten skrypt łączy się z ŻYWĄ bazą surowym `pg`,
 *                  nie przez aplikację) — liczy DOKŁADNIE to, co zwróciłby
 *                  `/capacity/resource-plan`, bez logowania się do aplikacji.
 *                  Używane jako PRZED (przed `users`/`tasks`) i PO (po `all`).
 *   all          — users + initiatives + allocations + tasks, w tej kolejności.
 *
 * ------------------------------------------------------------------------------
 * UŻYCIE
 * ------------------------------------------------------------------------------
 *   DATABASE_URL=... node scripts/dane/zespol-obciazenie-dbr77-20260910.mjs --op=<measure|users|initiatives|allocations|tasks|tasks-new|all> --dry-run
 *   DATABASE_URL=... FORCE_DA=true node scripts/dane/zespol-obciazenie-dbr77-20260910.mjs --op=<...> --apply
 *
 * Domyślny tryb = dry-run. --apply wymaga DODATKOWO FORCE_DA=true.
 * Manifesty (pełne wiersze PRZED zmianą, do przywrócenia) →
 *   evidence/d-a-zespol/manifesty/manifest-<op>-<ISO>.json
 * CSV PRZED/PO → evidence/d-a-zespol/*.csv
 * Idempotentne: WHERE dopisuje warunek "jeszcze nie ustawione na wartość
 * docelową", więc powtórne --apply nic nie zmienia (poza aktualizacją updated_at).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const KATALOG_DOWODOW = path.join(REPO_ROOT, 'evidence', 'd-a-zespol');
const KATALOG_MANIFESTOW_REPO = path.join(KATALOG_DOWODOW, 'manifesty');
// Manifesty z PEŁNYMI wierszami idą też do ~/Developer/consultify-dumps/manifesty
// (wzorzec zlecenia D-A) — katalog repo dostaje TĘ SAMĄ treść (git add -f) jako
// dowód w PR/review.
const KATALOG_MANIFESTOW_DUMPS = path.join(
  process.env.HOME || '.',
  'Developer',
  'consultify-dumps',
  'manifesty'
);

const DBR77_ORG = 'a3e05d4a-5397-419d-b486-8e44366c0063';

// ============================================================================
// Guard hosta — produkcja (centerbeam) zawsze odrzucona, demo (trolley) też
// odrzucone (zlecenie: "NIE dotykaj demo ani produkcji"), jedyny dozwolony
// zdalny host to proxy STAGING (thomas).
// ============================================================================
const HOST_STAGING = 'thomas.proxy.rlwy.net';

function sprawdzHost(databaseUrl) {
  const u = new URL(databaseUrl);
  if (/centerbeam/i.test(u.hostname)) {
    throw new Error('PRODUKCJA (centerbeam) — STOP. Ten skrypt nie wolno uruchomić na produkcji.');
  }
  if (/trolley/i.test(u.hostname)) {
    throw new Error('DEMO (trolley) — STOP. To zadanie dotyczy WYŁĄCZNIE staging.');
  }
  const lokalne = ['127.0.0.1', 'localhost', '::1', '0.0.0.0'];
  if (lokalne.includes(u.hostname)) return; // lokalne testy skryptu dozwolone
  if (u.hostname !== HOST_STAGING) {
    throw new Error(`Host ${u.hostname} nie jest hostem STAGING (${HOST_STAGING}) — STOP.`);
  }
}

// ============================================================================
// Manifest + CSV helpers (wzorzec: scripts/dane/brud-e4-20260910.mjs)
// ============================================================================
function zapiszManifest(op, dane) {
  fs.mkdirSync(KATALOG_MANIFESTOW_REPO, { recursive: true });
  const znacznik = new Date().toISOString().replace(/[:.]/g, '-');
  const nazwa = `manifest-${op}-${znacznik}.json`;
  const tresc = JSON.stringify(dane, null, 2);
  const plikRepo = path.join(KATALOG_MANIFESTOW_REPO, nazwa);
  fs.writeFileSync(plikRepo, tresc, 'utf8');
  try {
    fs.mkdirSync(KATALOG_MANIFESTOW_DUMPS, { recursive: true });
    fs.writeFileSync(path.join(KATALOG_MANIFESTOW_DUMPS, nazwa), tresc, 'utf8');
  } catch (e) {
    console.error('[uwaga] nie zapisano kopii manifestu w ~/Developer/consultify-dumps/manifesty:', e.message);
  }
  return plikRepo;
}

function piszCsv(nazwaPliku, naglowki, wiersze) {
  fs.mkdirSync(KATALOG_DOWODOW, { recursive: true });
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linie = [naglowki.join(','), ...wiersze.map((w) => naglowki.map((h) => esc(w[h])).join(','))];
  const sciezka = path.join(KATALOG_DOWODOW, nazwaPliku);
  fs.writeFileSync(sciezka, linie.join('\n') + '\n', 'utf8');
  return sciezka;
}

// ============================================================================
// PORT 1:1 czystych funkcji z server/src/services/workloadCapacityService.ts
// (getMonday/formatDate/addDays/buildWeekStarts/workingDaysBetween/
// workingDaysInWeek/weeklySupplyHours/spreadTaskHoursByWeek) i
// capacityPolicy.ts (CAPACITY_POLICY/utilizationPercent/clampAllocationPercent).
// Użyte WYŁĄCZNIE do pomiaru (`measure`) — żeby liczyć DOKŁADNIE to, co zwraca
// /capacity/resource-plan, bez logowania się do aplikacji.
// ============================================================================
const CAPACITY_POLICY = Object.freeze({ weeklyHoursPerFte: 40, overloadRatio: 1.05 });
const CLOSED_TASK_STATUSES = ['done', 'completed', 'validated', 'cancelled'];

function round1(n) {
  return Math.round(n * 10) / 10;
}
function clampAllocationPercent(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}
function utilizationPercent(allocatedHours, capacityHours) {
  return capacityHours > 0 ? Math.round((allocatedHours / capacityHours) * 100) : 0;
}
function getMonday(d) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d, days) {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}
function buildWeekStarts(asOf, weekCount) {
  const firstMonday = getMonday(asOf);
  const weeks = [];
  for (let w = 0; w < weekCount; w += 1) weeks.push(formatDate(addDays(firstMonday, w * 7)));
  return weeks;
}
function workingDaysBetween(start, end) {
  if (end.getTime() < start.getTime()) return 0;
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  for (let i = 0; i <= 20000 && cursor.getTime() <= last.getTime(); i += 1) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
function workingDaysInWeek(weekStart) {
  const monday = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(monday.getTime())) return 5;
  return workingDaysBetween(monday, addDays(monday, 6));
}
function weeklySupplyHours(weekStart, weeklyCapacityHours, availabilityPercent) {
  const dailyHours = (Number(weeklyCapacityHours) || 0) / 5;
  const effectiveDaily = (dailyHours * (Number(availabilityPercent) || 0)) / 100;
  return round1(workingDaysInWeek(weekStart) * effectiveDaily);
}
function spreadTaskHoursByWeek(start, due, hours) {
  const result = new Map();
  const total = Number(hours) || 0;
  const from = new Date(start);
  from.setHours(0, 0, 0, 0);
  const to = new Date(due);
  to.setHours(0, 0, 0, 0);
  const effectiveFrom = from.getTime() > to.getTime() ? to : from;
  const workingDays = workingDaysBetween(effectiveFrom, to);
  if (workingDays === 0) {
    result.set(formatDate(getMonday(to)), total);
    return result;
  }
  const perDay = total / workingDays;
  const cursor = new Date(effectiveFrom);
  while (cursor.getTime() <= to.getTime()) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const key = formatDate(getMonday(cursor));
      result.set(key, (result.get(key) || 0) + perDay);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

/**
 * Replika `getExecutionResourcePlan` (workloadCapacityService.ts:827-1021) na
 * surowym `pg`. SQL identyczny co do zasady WHERE/JOIN z oryginałem.
 */
async function computeResourcePlan(pool, orgId, weekCount = 8) {
  const now = new Date();
  const firstMonday = getMonday(now);
  const weeks = buildWeekStarts(now, weekCount);
  const weekSet = new Set(weeks);

  const taskRows = (
    await pool.query(
      `SELECT id AS task_id, title, status, assignee_id AS user_id, due_date,
              created_at AS start_at, COALESCE(estimated_hours, 0) AS hours,
              COALESCE(actual_hours, 0) AS actual_hours
         FROM tasks
        WHERE organization_id = $1 AND assignee_id IS NOT NULL
          AND LOWER(COALESCE(status, '')) NOT IN ('done','completed','validated','cancelled')`,
      [orgId]
    )
  ).rows;

  const userIds = [...new Set(taskRows.map((r) => String(r.user_id)))];
  if (userIds.length === 0) {
    return { asOf: now.toISOString(), weeks, rows: [], people: [] };
  }

  const personRows = (
    await pool.query(
      `SELECT u.id AS user_id,
              COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), u.email, u.id) AS name,
              COALESCE(u.job_title, u.title) AS role,
              u.weekly_capacity_hours, u.availability_percent
         FROM users u
        WHERE u.organization_id = $1 AND u.id = ANY($2::text[])`,
      [orgId, userIds]
    )
  ).rows;
  const byId = new Map(personRows.map((r) => [String(r.user_id), r]));

  const demand = new Map();
  const counts = new Map();
  const backlog = new Map();
  const unscheduled = new Map();
  const toDate = (value) => {
    if (!value) return null;
    const parsed = value instanceof Date ? new Date(value) : new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  };

  for (const row of taskRows) {
    const userId = String(row.user_id);
    if (!byId.has(userId)) continue;
    const hours = Number(row.hours) || 0;
    const due = toDate(row.due_date);
    if (!due) {
      unscheduled.set(userId, (unscheduled.get(userId) || 0) + hours);
      continue;
    }
    if (due.getTime() < firstMonday.getTime()) {
      const actual = Number(row.actual_hours) || 0;
      const remaining = Math.max(round1(hours - actual), 0);
      backlog.set(userId, (backlog.get(userId) || 0) + remaining);
      continue;
    }
    const rawStart = toDate(row.start_at) ?? due;
    const start = rawStart.getTime() < firstMonday.getTime() ? firstMonday : rawStart;
    const udzialy = spreadTaskHoursByWeek(start, due, hours);
    for (const [weekStart, share] of udzialy) {
      if (!weekSet.has(weekStart)) continue;
      const key = `${userId}|${weekStart}`;
      demand.set(key, (demand.get(key) || 0) + share);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const people = [];
  const rows = [];
  for (const userId of userIds) {
    const person = byId.get(userId);
    if (!person) continue;
    const rawHours = person.weekly_capacity_hours;
    const rawPercent = person.availability_percent;
    const supplySource = rawHours === null || rawHours === undefined ? 'DOMYSLNA' : 'PROFIL';
    const weeklyCapacityHours =
      supplySource === 'PROFIL' ? Number(rawHours) : CAPACITY_POLICY.weeklyHoursPerFte;
    const availability = clampAllocationPercent(rawPercent ?? 100);
    const zaleglosc = round1(backlog.get(userId) || 0);
    people.push({
      userId,
      name: String(person.name || userId),
      role: String(person.role || ''),
      weeklyCapacityHours: round1(weeklyCapacityHours),
      availabilityPercent: availability,
      supplySource,
      backlogHours: zaleglosc,
      unscheduledHours: round1(unscheduled.get(userId) || 0),
    });
    for (const weekStart of weeks) {
      const key = `${userId}|${weekStart}`;
      const demandHours = round1(demand.get(key) || 0);
      const supply = weeklySupplyHours(weekStart, weeklyCapacityHours, availability);
      rows.push({
        userId,
        weekStart,
        demandHours,
        supplyHours: supply,
        utilizationPercent: utilizationPercent(demandHours, supply),
        taskCount: counts.get(key) || 0,
      });
    }
  }
  return { asOf: now.toISOString(), weeks, rows, people };
}

function summarize(plan) {
  const totalDemand = plan.rows.reduce((s, r) => s + r.demandHours, 0);
  const totalSupply = plan.rows.reduce((s, r) => s + r.supplyHours, 0);
  return {
    peopleCount: plan.people.length,
    demandHours: round1(totalDemand),
    supplyHours: round1(totalSupply),
    gapHours: round1(totalSupply - totalDemand),
    utilizationPercent: totalSupply > 0 ? Math.round((totalDemand / totalSupply) * 100) : null,
    overloadedCount: plan.rows.filter((r) => r.utilizationPercent > 105).length,
    peopleWithoutProfileSupply: plan.people.filter((p) => p.supplySource === 'DOMYSLNA').length,
    backlogHoursTotal: round1(plan.people.reduce((s, p) => s + p.backlogHours, 0)),
    backlogPeople: plan.people.filter((p) => p.backlogHours > 0).length,
  };
}

async function mierz(pool) {
  const plan = await computeResourcePlan(pool, DBR77_ORG, 8);
  return { summary: summarize(plan), people: plan.people };
}

// ============================================================================
// OP: users — job_title/weekly_capacity_hours/availability_percent, EN, 15 osób
// ============================================================================
// UWAGA: id-y (tam gdzie znane) wpisane WPROST po pomiarze SELECT id,email
// (2026-09-10), nie po wzorcu/LIKE. Klucz identyfikujący wiersz w WHERE to
// zawsze `email` (dodatkowy bezpiecznik) — `resolveUserIds()` dogrywa/weryfikuje
// realne `id` przez SELECT tuż przed użyciem.
const USERS = [
  { email: 'acceptance.owner@consultify.local', id: null, jobTitle: 'QA Acceptance Owner', wch: 40, avail: 100 },
  { email: 'admin@dbr77.com', id: '3ef1b819-8ea6-4ed6-9a03-1a29be2bbcb4', jobTitle: 'Tenant Admin', wch: 40, avail: 100 },
  { email: 'anna.kowalska@dbr77.com', id: '025ae9d5-b9c4-4b0e-8e1f-d720c17881ff', jobTitle: 'Senior Data Engineer', wch: 32, avail: 60 },
  { email: 'ewa.nowicka@dbr77.com', id: '4cfeae1e-0237-4d48-8755-e1d4669b93d3', jobTitle: 'Operations Manager', wch: 36, avail: 75 },
  { email: 'jan.kowalski@dbr77.com', id: '7b9b0e03-0061-468a-8201-31ebac233914', jobTitle: 'Business Analyst', wch: 40, avail: 90 },
  { email: 'jan.zielinski@dbr77.com', id: 'd38cf7f5-fc74-40c5-a5ec-86532f8c72e4', jobTitle: 'Data Engineer', wch: 32, avail: 60 },
  { email: 'julia.lewandowska@dbr77.com', id: 'd93e483a-0000-0000-0000-000000000000', jobTitle: 'UX Designer', wch: 36, avail: 80 },
  { email: 'justyna.laskowska@dbr77.com', id: '60887056-0000-0000-0000-000000000000', jobTitle: 'Managing Partner', wch: 40, avail: 100 },
  { email: 'katarzyna.wojcik@dbr77.com', id: '29262ed1-8017-4db2-9ef1-1e258ed71bdc', jobTitle: 'Quality Specialist', wch: 34, avail: 70 },
  { email: 'krzysztof.zielinski@dbr77.com', id: '188a66b0-0000-0000-0000-000000000000', jobTitle: 'DevOps Engineer', wch: 36, avail: 80 },
  { email: 'marek.nowak@dbr77.com', id: '5bdb3753-88fd-47c2-abe9-7c290b74af65', jobTitle: 'Product Manager', wch: 38, avail: 85 },
  { email: 'pawel.mroczkowski@dbr77.com', id: 'e91daa55-0000-0000-0000-000000000000', jobTitle: 'Managing Partner', wch: 40, avail: 100 },
  { email: 'piotr@dbr77.com', id: 'bf0f01a2-0000-0000-0000-000000000000', jobTitle: 'Program Director', wch: 38, avail: 90 },
  { email: 'tomasz.jankowski@dbr77.com', id: 'aa614b34-bfbd-4757-b2d4-52a2caa466f7', jobTitle: 'R&D Specialist', wch: 36, avail: 75 },
  { email: 'tomasz.lewandowski@dbr77.com', id: 'eb79c7f2-01f6-4b70-b0c0-c612da9cd549', jobTitle: 'Managing Partner', wch: 40, avail: 100 },
];

async function resolveUserIds(c) {
  // ID-y placeholder (kończące się `-0000-...`) dopełniamy realnym SELECT po
  // emailu — wpisane ręcznie z pomiaru, ale trzymamy SELECT jako drugi
  // bezpiecznik przeciw literówce w id.
  const r = await c.query(
    `SELECT id, email FROM users WHERE organization_id = $1 AND email = ANY($2::text[])`,
    [DBR77_ORG, USERS.map((u) => u.email)]
  );
  const byEmail = new Map(r.rows.map((row) => [row.email, row.id]));
  for (const u of USERS) {
    const real = byEmail.get(u.email);
    if (!real) throw new Error(`users: email ${u.email} nie znaleziony w DBR77 — STOP.`);
    u.id = real;
  }
}

async function mierzUsers(c) {
  const r = await c.query(
    `SELECT id, email, job_title, weekly_capacity_hours, availability_percent
       FROM users WHERE organization_id = $1 AND email = ANY($2::text[])`,
    [DBR77_ORG, USERS.map((u) => u.email)]
  );
  return r.rows;
}

async function applyUsers(c, apply) {
  await resolveUserIds(c);
  const przed = await mierzUsers(c);
  const byEmail = new Map(przed.map((r) => [r.email, r]));
  const plan = [];
  for (const target of USERS) {
    const current = byEmail.get(target.email);
    if (!current) throw new Error(`users: ${target.email} zniknął między odczytami — STOP.`);
    const zmiany = {};
    if (current.job_title !== target.jobTitle) zmiany.job_title = target.jobTitle;
    if (Number(current.weekly_capacity_hours) !== target.wch) zmiany.weekly_capacity_hours = target.wch;
    if (Number(current.availability_percent) !== target.avail) zmiany.availability_percent = target.avail;
    if (Object.keys(zmiany).length === 0) {
      plan.push({ email: target.email, id: target.id, zmiany: 'brak (już ustawione)' });
      continue;
    }
    plan.push({ email: target.email, id: target.id, zmiany });
    if (apply) {
      await c.query(
        `UPDATE users SET job_title = $1, weekly_capacity_hours = $2, availability_percent = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4 AND organization_id = $5`,
        [target.jobTitle, target.wch, target.avail, target.id, DBR77_ORG]
      );
    }
  }
  const po = apply ? await mierzUsers(c) : null;
  return { przed, plan, po };
}

// ============================================================================
// OP: initiatives — required_capacity_fte na 10 największych aktywnych
// ============================================================================
const INITIATIVES = [
  { id: 'c55f3b10-e04e-44dd-a2e0-178046902520', name: 'Process Automation — RPA', fte: 2.5 },
  { id: '84baaa08-5249-42e4-a292-3921e67d29d1', name: 'Customer Portal Redesign', fte: 2.0 },
  { id: 'd3bc32b2-ca68-456f-8af9-a432d6f10442', name: 'Transformacja DevOps', fte: 1.5 },
  { id: 'bb9038c3-d5e0-41e4-8d3d-f695d9c045f9', name: 'Migracja do chmury — Faza 2', fte: 1.0 },
  { id: 'e3b0a66a-dc86-4730-84e0-cdffb66cbed6', name: 'Wdrożenie sieci czujników IoT', fte: 0.5 },
  { id: 'seed:wyniki-dbr77-20260905|a3e05d4a-5397-419d-b486-8e44366c0063|automatyzacja-magazynu-wip', name: 'Automatyzacja magazynu WIP', fte: 1.5 },
  { id: 'b8f28cea-36b4-4f12-802e-634bf10c4d5a', name: 'Platforma analityki danych', fte: 1.0 },
  { id: '7eb944f9-c5b9-4162-8bff-23b0d620f9f3', name: 'Program wzmocnienia cyberbezpieczeństwa', fte: 1.5 },
  { id: 'seed:wyniki-dbr77-20260905|a3e05d4a-5397-419d-b486-8e44366c0063|robotyzacja-gniazda-spawalniczego', name: 'Robotyzacja gniazda spawalniczego', fte: 2.0 },
  { id: '5317c99f-1710-4e92-a65f-c56e5c38b3dd', name: 'System zarządzania jakością 4.0', fte: 1.5 },
];
// Pominięte świadomie (higiena danych demo — rekordy testowe/duplikaty, nie
// wchodzą w skład "10 największych"):
//   a3e05d4a-5397-419d-b486-8e44366c0063--acceptance--initiative (rekord akceptacyjny, 0 zadań)
//   5c7d8726-4bcf-4177-ad32-ed63f5927826 ("Program wzmocnienia cyberbezpieczeństwa (kopia)")

async function mierzInitiatives(c) {
  const r = await c.query(
    `SELECT id, name, status, organization_id, required_capacity_fte FROM initiatives WHERE id = ANY($1::text[])`,
    [INITIATIVES.map((i) => i.id)]
  );
  return r.rows;
}

async function applyInitiatives(c, apply) {
  const przed = await mierzInitiatives(c);
  const byId = new Map(przed.map((r) => [r.id, r]));
  const plan = [];
  for (const target of INITIATIVES) {
    const current = byId.get(target.id);
    if (!current) throw new Error(`initiatives: ${target.id} nie istnieje — STOP.`);
    if (current.organization_id && current.organization_id !== DBR77_ORG) {
      throw new Error(`initiatives: ${target.id} spoza DBR77 — STOP.`);
    }
    if (Number(current.required_capacity_fte) === target.fte) {
      plan.push({ id: target.id, name: target.name, zmiana: 'brak (już ustawione)' });
      continue;
    }
    plan.push({ id: target.id, name: target.name, fte: { z: current.required_capacity_fte, na: target.fte } });
    if (apply) {
      await c.query(
        `UPDATE initiatives SET required_capacity_fte = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3`,
        [target.fte, target.id, DBR77_ORG]
      );
    }
  }
  const po = apply ? await mierzInitiatives(c) : null;
  return { przed, plan, po };
}

// ============================================================================
// OP: allocations — initiative_resources (feeduje /capacity/timeline, NIE
// Zasoby) — 1 alokacja na inicjatywę, osoba dobrana po zbieżności job_title,
// 8 tygodni od bieżącego poniedziałku, idempotentne przez idempotency_key.
// ============================================================================
function windowStartEnd() {
  const monday = getMonday(new Date());
  const end = addDays(monday, 8 * 7 - 1);
  return { start: formatDate(monday), end: formatDate(end) };
}

const ALLOCATIONS = [
  { initiativeId: 'c55f3b10-e04e-44dd-a2e0-178046902520', email: 'jan.zielinski@dbr77.com', role: 'Data Engineer', pct: 50 },
  { initiativeId: '84baaa08-5249-42e4-a292-3921e67d29d1', email: 'julia.lewandowska@dbr77.com', role: 'UX Designer', pct: 40 },
  { initiativeId: 'd3bc32b2-ca68-456f-8af9-a432d6f10442', email: 'krzysztof.zielinski@dbr77.com', role: 'DevOps Engineer', pct: 60 },
  { initiativeId: 'bb9038c3-d5e0-41e4-8d3d-f695d9c045f9', email: 'krzysztof.zielinski@dbr77.com', role: 'DevOps Engineer', pct: 30 },
  { initiativeId: 'e3b0a66a-dc86-4730-84e0-cdffb66cbed6', email: 'piotr@dbr77.com', role: 'Program Director', pct: 20 },
  { initiativeId: 'seed:wyniki-dbr77-20260905|a3e05d4a-5397-419d-b486-8e44366c0063|automatyzacja-magazynu-wip', email: 'marek.nowak@dbr77.com', role: 'Product Manager', pct: 30 },
  { initiativeId: 'b8f28cea-36b4-4f12-802e-634bf10c4d5a', email: 'anna.kowalska@dbr77.com', role: 'Senior Data Engineer', pct: 40 },
  { initiativeId: '7eb944f9-c5b9-4162-8bff-23b0d620f9f3', email: 'tomasz.jankowski@dbr77.com', role: 'R&D Specialist', pct: 30 },
  { initiativeId: 'seed:wyniki-dbr77-20260905|a3e05d4a-5397-419d-b486-8e44366c0063|robotyzacja-gniazda-spawalniczego', email: 'tomasz.jankowski@dbr77.com', role: 'R&D Specialist', pct: 20 },
  { initiativeId: '5317c99f-1710-4e92-a65f-c56e5c38b3dd', email: 'katarzyna.wojcik@dbr77.com', role: 'Quality Specialist', pct: 50 },
];

async function mierzAllocations(c) {
  const keys = ALLOCATIONS.map((a) => `da-zespol-20260910:${a.initiativeId}:${a.email}`);
  const r = await c.query(
    `SELECT id, initiative_id, user_id, role, allocation_percentage, start_date, end_date, idempotency_key
       FROM initiative_resources WHERE idempotency_key = ANY($1::text[])`,
    [keys]
  );
  return r.rows;
}

async function applyAllocations(c, apply) {
  await resolveUserIds(c);
  const byEmail = new Map(USERS.map((u) => [u.email, u.id]));
  const { start, end } = windowStartEnd();
  const przed = await mierzAllocations(c);
  const byKey = new Map(przed.map((r) => [r.idempotency_key, r]));
  const plan = [];
  for (const a of ALLOCATIONS) {
    const userId = byEmail.get(a.email);
    if (!userId) throw new Error(`allocations: ${a.email} nie rozwiązany — STOP.`);
    const key = `da-zespol-20260910:${a.initiativeId}:${a.email}`;
    const existing = byKey.get(key);
    if (existing) {
      plan.push({ key, zmiana: 'brak (już istnieje)' });
      continue;
    }
    // BUG złapany na dry-run (2026-09-10): `Buffer.from(key).toString('hex').
    // slice(0,24)` dawał ten sam prefiks dla WSZYSTKICH kluczy (wspólny
    // prefiks "da-zespol-20260910:" > 24 hex-znaków), czyli identyczne `id`
    // i naruszenie PRIMARY KEY na drugim INSERT. Hash całego klucza usuwa
    // kolizję — deterministyczny, więc nadal idempotentny między uruchomieniami.
    const id = `da-zespol-${crypto.createHash('sha1').update(key).digest('hex').slice(0, 24)}`;
    plan.push({ key, id, initiativeId: a.initiativeId, userId, role: a.role, pct: a.pct, start, end });
    if (apply) {
      await c.query(
        `INSERT INTO initiative_resources
           (id, initiative_id, organization_id, user_id, name, role, allocation_percentage,
            start_date, end_date, notes, source, version, idempotency_key, created_at, updated_at)
         VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,'DEC-462 dosiew D-A (staging)','dosiew-d-a',1,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT (initiative_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [id, a.initiativeId, DBR77_ORG, userId, a.role, a.pct, start, end, key]
      );
    }
  }
  const po = apply ? await mierzAllocations(c) : null;
  return { przed, plan, po, window: { start, end } };
}

// ============================================================================
// OP: tasks — assignee_id na 25 istniejących otwartych zadaniach DBR77 z
// realnym due_date + estimated_hours > 0, dziś bez assignee_id. Wszystkie 25
// mają due_date W PRZESZŁOŚCI względem 2026-09-10 (zmierzone) → trafiają w
// backlogHours. NIE dotyka status/title/due_date/estimated_hours/actual_hours.
// Konto testowe acceptance.owner WYŁĄCZONE z rotacji (higiena danych demo).
// ============================================================================
const TASK_ROTATION_EMAILS = [
  // 7 osób bez ŻADNEGO dziś przypisanego otwartego zadania (peopleCount 7→14) — najpierw one:
  'julia.lewandowska@dbr77.com',
  'justyna.laskowska@dbr77.com',
  'krzysztof.zielinski@dbr77.com',
  'pawel.mroczkowski@dbr77.com',
  'piotr@dbr77.com',
  'tomasz.jankowski@dbr77.com',
  'admin@dbr77.com',
  // 7 osób już aktywnych — dokładają zaległość dalej:
  'anna.kowalska@dbr77.com',
  'ewa.nowicka@dbr77.com',
  'jan.kowalski@dbr77.com',
  'jan.zielinski@dbr77.com',
  'katarzyna.wojcik@dbr77.com',
  'marek.nowak@dbr77.com',
  'tomasz.lewandowski@dbr77.com',
];

// 25 id zmierzonych 2026-09-10 (SELECT id FROM tasks WHERE organization_id=DBR77
// AND assignee_id IS NULL AND due_date IS NOT NULL AND estimated_hours>0 AND
// status IN ('todo','in_progress','review')). Jawnie wypisane, bez LIKE.
const TASK_IDS = [
  'task-rich-001', '8ef8640d-de2d-4935-be13-3d2c90fc13e8', 'task-rich-003', 'task-rich-005',
  '4b9c9ad3-307a-44e2-9821-ce94dbedcf16', 'bd990ade-4bfc-4867-a49a-b846fb716884',
  'd3a43e93-8885-473f-88fb-96391dab4f91', 'fd267f99-4666-42a8-981e-f362223b0cff',
  '85332018-9b7b-4a58-b2a1-969f274ad02e', 'task-rich-009', 'ef7c1347-9525-4db4-9d72-f11cff4446d4',
  '29e3150f-f25f-4d71-9c55-de123dfba947', 'fd1210ec-6dfa-410f-93fc-9e954af8d50f', 'task-rich-011',
  'e74b426b-ff06-481c-a870-e1f2398e78b4', '3a4d9bb9-c839-43c2-89fd-8e64e8e9b581',
  '1cae44c8-7ea7-4e11-a89d-8c3f5bdb997f', '6dc6f1c3-9128-405e-933d-6b5f84f7eb5e',
  '4d63149c-9dcf-4f0b-b2b7-6d450b81f1da', '2b5e0e21-119e-46d3-916a-5cdfc8f2f7eb',
  '3280a33c-9c04-471b-b620-658423cbc96b', '549cbab0-5fc6-42b8-9c6f-0bf30b9f8dc3',
  'e1fa9e27-222f-421f-8774-a6a37b76029a', 'b7342823-6286-48ab-814e-489be96d7c8b',
  'e48cc142-e09f-46ae-8a57-234aeeb3fa09',
];

async function mierzTasks(c) {
  const r = await c.query(
    `SELECT id, title, status, assignee_id, due_date, estimated_hours, actual_hours, initiative_id, organization_id
       FROM tasks WHERE id = ANY($1::text[])`,
    [TASK_IDS]
  );
  return r.rows;
}

async function applyTasks(c, apply) {
  await resolveUserIds(c);
  const byEmail = new Map(USERS.map((u) => [u.email, u.id]));
  const przed = await mierzTasks(c);
  if (przed.length !== TASK_IDS.length) {
    throw new Error(`tasks: oczekiwano ${TASK_IDS.length} wierszy, znaleziono ${przed.length} — STOP.`);
  }
  const byId = new Map(przed.map((r) => [r.id, r]));
  const plan = [];
  let rotIdx = 0;
  for (const taskId of TASK_IDS) {
    const row = byId.get(taskId);
    if (row.organization_id !== DBR77_ORG) throw new Error(`tasks: ${taskId} spoza DBR77 — STOP.`);
    if (row.assignee_id) {
      plan.push({ id: taskId, zmiana: `brak (już przypisane do ${row.assignee_id})` });
      continue;
    }
    const email = TASK_ROTATION_EMAILS[rotIdx % TASK_ROTATION_EMAILS.length];
    rotIdx += 1;
    const userId = byEmail.get(email);
    plan.push({ id: taskId, title: row.title, due: row.due_date, est: row.estimated_hours, przypisz: email, userId });
    if (apply) {
      await c.query(
        `UPDATE tasks SET assignee_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3 AND assignee_id IS NULL`,
        [userId, taskId, DBR77_ORG]
      );
    }
  }
  const po = apply ? await mierzTasks(c) : null;
  return { przed, plan, po };
}

// ============================================================================
// OP: tasks CZĘŚĆ B (D-A2, DEC-462 dokończenie) — NOWE zadania z realnym
// due_date w przyszłości i estimated_hours>0, żeby popyt/obłożenie w Zasoby
// przestały być zerowe (CZĘŚĆ A wyżej dawała tylko backlogHours, patrz STOP
// opisany w nagłówku pliku).
//
// KROK 0 — wzorzec wiersza (zmierzony na ŻYWEJ bazie STAGING, 2026-09-10):
//   information_schema.columns dla public.tasks (NIE fala5_backup.tasks —
//   ten sam table_name istnieje w obu schematach, trzeba filtrować po
//   table_schema) pokazuje TYLKO TRZY kolumny NOT NULL: id, organization_id,
//   title. Wszystko inne jest nullable. Żeby wiersz był mimo to
//   nieodróżnialny od utworzonego w UI, kolumny INSERT-a i ich źródło
//   ustalone z `TaskController.createTask` (server/src/controllers/
//   TaskController.ts:1286-1301, lista kolumn INSERT) i z 3 realnych
//   wierszy DBR77 (assignee+due_date+estimated_hours>0, np. id
//   8a9b3256-8fa6-49f4-b6dd-377145716ca2 "Spark job optimization"):
//     id=uuid, project_id=z initiatives.project_id (NULL gdy inicjatywa go
//     nie ma — TaskController robi dokładnie to samo, `effectiveProjectId`),
//     status='todo'|'in_progress' (domyślka CreateTaskSchema='todo'),
//     priority z PriorityEnum, task_type='execution' (dominujący typ w
//     DBR77 — 103/206 zadań; 'interview' NIGDY nie ma estimated_hours, więc
//     użycie go tu byłoby sprzeczne z realnym wzorcem), source='manual',
//     reporter_id=twórca (TaskController: `userId` zalogowanego), tu =
//     admin@dbr77.com (jedyne konto z rolą Tenant Admin w DBR77), owner_id=
//     assignee_id (TaskController: `effectiveOwnerId = ownerId||assigneeId||
//     userId`), requires_acceptance=false, weight=1, tags/assignees='[]',
//     custom_fields_json='{}', decision_impact='{}', evidence_required=
//     '[]', strategic_contribution='[]', created_by=NULL i created_at=teraz
//     (TaskController NIE ustawia created_by w INSERT — zostaje NULL, tak
//     samo jak w 3 próbkach powyżej — więc świadomie NIE dublujemy autora do
//     created_by, żeby nie odróżniać się od realnego wzorca).
//
//   Rozkład tygodniowy (zmierzony z `spreadTaskHoursByWeek`, ten plik
//   linia ~283, replika workloadCapacityService.ts:732): `start` = MAX(
//   created_at, poniedziałek bieżącego tygodnia), `due` = due_date; godziny
//   dzielone RÓWNO na dni robocze między start i due, każdy dzień trafia w
//   tydzień (poniedziałek) w którym leży. Ponieważ `created_at` NOWO
//   tworzonego zadania nie może uczciwie być przyszłością (fabrykacja),
//   `start` ZAWSZE wypada w bieżącym tygodniu (2026-09-07) — więc żaden
//   pojedynczy nowy task nie wrzuci 100% godzin w tydzień 3+ bez fabrykacji.
//   Rozwiązanie zastosowane tutaj: KILKA zadań na osobę z różnymi due_date
//   (część w tym tygodniu, część za tydzień, część dalej) — SUMA ich
//   rozkładów daje >105% w KONKRETNYCH DWÓCH tygodniach dla 3 osób
//   (dobrane liczbowo offline, replika `simulate2.mjs` w scratchpadzie sesji,
//   bez dotykania bazy — dopiero po dopasowaniu liczb do apply).
// ============================================================================
const ADMIN_EMAIL = 'admin@dbr77.com';

// 10 inicjatyw z D-A (required_capacity_fte) — id/project_id zmierzone SELECT.
const NEW_TASK_INITIATIVES = {
  RPA: { id: 'c55f3b10-e04e-44dd-a2e0-178046902520', projectId: '6d8ae9ba-3840-46ea-9068-10cdf55d5a76' },
  PORTAL: { id: '84baaa08-5249-42e4-a292-3921e67d29d1', projectId: '6d8ae9ba-3840-46ea-9068-10cdf55d5a76' },
  DEVOPS: { id: 'd3bc32b2-ca68-456f-8af9-a432d6f10442', projectId: '2fbb1e31-6c71-4228-b775-05aae98690d6' },
  CLOUD: { id: 'bb9038c3-d5e0-41e4-8d3d-f695d9c045f9', projectId: 'f992cfae-9b03-473f-a685-a5f58b5a5119' },
  IOT: { id: 'e3b0a66a-dc86-4730-84e0-cdffb66cbed6', projectId: 'f992cfae-9b03-473f-a685-a5f58b5a5119' },
  WIP: {
    id: 'seed:wyniki-dbr77-20260905|a3e05d4a-5397-419d-b486-8e44366c0063|automatyzacja-magazynu-wip',
    projectId: null,
  },
  DATAPLATFORM: { id: 'b8f28cea-36b4-4f12-802e-634bf10c4d5a', projectId: 'b4695c7c-0434-46ac-9cc1-3cd89afc463a' },
  CYBER: { id: '7eb944f9-c5b9-4162-8bff-23b0d620f9f3', projectId: 'f992cfae-9b03-473f-a685-a5f58b5a5119' },
  WELDING: {
    id: 'seed:wyniki-dbr77-20260905|a3e05d4a-5397-419d-b486-8e44366c0063|robotyzacja-gniazda-spawalniczego',
    projectId: null,
  },
  QMS: { id: '5317c99f-1710-4e92-a65f-c56e5c38b3dd', projectId: 'f992cfae-9b03-473f-a685-a5f58b5a5119' },
};

// 34 nowe zadania. Terminy/godziny dobrane offline (replika czystych funkcji
// algorytmu, bez bazy) tak by: anna.kowalska, jan.zielinski, katarzyna.wojcik
// wypadły >105% w DWÓCH tygodniach (2026-09-07 i 2026-09-14) każda; ewa.nowicka,
// marek.nowak, tomasz.jankowski w paśmie ok. 60-90% w swoim szczytowym tygodniu;
// reszta lekko obciążona. `due` = data (bez czasu, jak w innych wierszach
// tabeli); `hours` = estimated_hours.
const NEW_TASKS = [
  // --- ANNA KOWALSKA (Senior Data Engineer, supply 19.2h/tydz) — PRZECIĄŻONA ---
  { n: '001', email: 'anna.kowalska@dbr77.com', init: 'DATAPLATFORM', title: 'Design data model for analytics platform staging layer', status: 'in_progress', priority: 'medium', hours: 16, due: '2026-09-11' },
  { n: '002', email: 'anna.kowalska@dbr77.com', init: 'DATAPLATFORM', title: 'Build ETL job for daily sales data ingestion', status: 'in_progress', priority: 'medium', hours: 12, due: '2026-09-11' },
  { n: '003', email: 'anna.kowalska@dbr77.com', init: 'DATAPLATFORM', title: 'Validate dashboard KPIs with operations stakeholders', status: 'todo', priority: 'high', hours: 28, due: '2026-09-18' },
  { n: '004', email: 'anna.kowalska@dbr77.com', init: 'WIP', title: 'Map current-state process for WIP warehouse put-away', status: 'todo', priority: 'medium', hours: 12, due: '2026-09-25' },

  // --- JAN ZIELINSKI (Data Engineer, supply 19.2h/tydz) — PRZECIĄŻONY ---
  { n: '005', email: 'jan.zielinski@dbr77.com', init: 'RPA', title: 'Map current-state process for invoice reconciliation workflow', status: 'in_progress', priority: 'medium', hours: 18, due: '2026-09-11' },
  { n: '006', email: 'jan.zielinski@dbr77.com', init: 'RPA', title: 'Configure RPA bot for purchase order matching', status: 'in_progress', priority: 'low', hours: 10, due: '2026-09-11' },
  { n: '007', email: 'jan.zielinski@dbr77.com', init: 'RPA', title: 'Validate exception-handling rules with finance team', status: 'todo', priority: 'urgent', hours: 30, due: '2026-09-18' },
  { n: '008', email: 'jan.zielinski@dbr77.com', init: 'DATAPLATFORM', title: 'Design ETL job for supplier price feed ingestion', status: 'todo', priority: 'medium', hours: 8, due: '2026-09-25' },

  // --- KATARZYNA WOJCIK (Quality Specialist, supply 23.8h/tydz) — PRZECIĄŻONA ---
  { n: '009', email: 'katarzyna.wojcik@dbr77.com', init: 'QMS', title: 'Map inspection checklist into QMS 4.0 digital form', status: 'in_progress', priority: 'medium', hours: 18, due: '2026-09-11' },
  { n: '010', email: 'katarzyna.wojcik@dbr77.com', init: 'QMS', title: 'Configure non-conformance workflow in QMS platform', status: 'in_progress', priority: 'medium', hours: 16, due: '2026-09-11' },
  { n: '011', email: 'katarzyna.wojcik@dbr77.com', init: 'QMS', title: 'Validate calibration schedule import with quality team', status: 'todo', priority: 'urgent', hours: 34, due: '2026-09-18' },
  { n: '012', email: 'katarzyna.wojcik@dbr77.com', init: 'WELDING', title: 'Validate safety fencing layout for welding cell', status: 'todo', priority: 'medium', hours: 10, due: '2026-09-25' },

  // --- EWA NOWICKA (Operations Manager, supply 27h/tydz) — ~68% szczyt ---
  { n: '013', email: 'ewa.nowicka@dbr77.com', init: 'WIP', title: 'Specify conveyor integration requirements for WIP automation', status: 'in_progress', priority: 'medium', hours: 16, due: '2026-09-11' },
  { n: '014', email: 'ewa.nowicka@dbr77.com', init: 'WIP', title: 'Validate barcode scanning flow with warehouse supervisor', status: 'todo', priority: 'medium', hours: 14, due: '2026-09-25' },

  // --- TOMASZ JANKOWSKI (R&D Specialist, supply 27h/tydz) — ~64% szczyt ---
  { n: '015', email: 'tomasz.jankowski@dbr77.com', init: 'IOT', title: 'Validate sensor placement with maintenance lead', status: 'todo', priority: 'high', hours: 20, due: '2026-09-18' },
  { n: '016', email: 'tomasz.jankowski@dbr77.com', init: 'IOT', title: 'Configure gateway firmware for IoT sensor network', status: 'todo', priority: 'medium', hours: 10, due: '2026-10-02' },

  // --- MAREK NOWAK (Product Manager, supply 32.3h/tydz) — ~62% szczyt ---
  { n: '017', email: 'marek.nowak@dbr77.com', init: 'PORTAL', title: 'Draft wireframes for customer self-service dashboard', status: 'in_progress', priority: 'medium', hours: 18, due: '2026-09-11' },
  { n: '018', email: 'marek.nowak@dbr77.com', init: 'PORTAL', title: 'Define API contract for portal authentication module', status: 'todo', priority: 'low', hours: 12, due: '2026-09-25' },

  // --- reszta zespołu: lekko/umiarkowanie obciążeni ---
  { n: '019', email: 'jan.kowalski@dbr77.com', init: 'PORTAL', title: 'Review accessibility requirements for portal redesign', status: 'todo', priority: 'high', hours: 24, due: '2026-09-18' },
  { n: '020', email: 'jan.kowalski@dbr77.com', init: 'QMS', title: 'Draft training plan for QMS 4.0 rollout', status: 'in_progress', priority: 'low', hours: 8, due: '2026-09-11' },
  { n: '021', email: 'julia.lewandowska@dbr77.com', init: 'PORTAL', title: 'Prepare usability test script for new portal navigation', status: 'todo', priority: 'low', hours: 8, due: '2026-09-18' },
  { n: '022', email: 'julia.lewandowska@dbr77.com', init: 'PORTAL', title: 'Iterate wireframes based on stakeholder feedback', status: 'todo', priority: 'low', hours: 6, due: '2026-10-09' },
  { n: '023', email: 'justyna.laskowska@dbr77.com', init: 'CYBER', title: 'Review access control policy for privileged accounts', status: 'todo', priority: 'low', hours: 6, due: '2026-09-25' },
  { n: '024', email: 'justyna.laskowska@dbr77.com', init: 'CYBER', title: 'Approve incident response runbook for security program', status: 'todo', priority: 'low', hours: 5, due: '2026-10-16' },
  { n: '025', email: 'krzysztof.zielinski@dbr77.com', init: 'DEVOPS', title: 'Set up CI pipeline for staging deployment', status: 'todo', priority: 'low', hours: 8, due: '2026-10-02' },
  { n: '026', email: 'krzysztof.zielinski@dbr77.com', init: 'DEVOPS', title: 'Migrate build scripts to new container registry', status: 'in_progress', priority: 'low', hours: 6, due: '2026-09-11' },
  { n: '027', email: 'admin@dbr77.com', init: 'CYBER', title: 'Run vulnerability scan on external-facing services', status: 'todo', priority: 'low', hours: 6, due: '2026-09-18' },
  { n: '028', email: 'admin@dbr77.com', init: 'CYBER', title: 'Draft incident response runbook for security program', status: 'todo', priority: 'low', hours: 5, due: '2026-10-16' },
  { n: '029', email: 'piotr@dbr77.com', init: 'IOT', title: 'Prepare wiring diagram for sensor installation on line 3', status: 'todo', priority: 'medium', hours: 8, due: '2026-09-25' },
  { n: '030', email: 'piotr@dbr77.com', init: 'IOT', title: 'Review IoT sensor network rollout plan with maintenance lead', status: 'in_progress', priority: 'low', hours: 6, due: '2026-09-11' },
  { n: '031', email: 'pawel.mroczkowski@dbr77.com', init: 'CLOUD', title: 'Inventory on-prem workloads for phase 2 cloud migration', status: 'todo', priority: 'low', hours: 6, due: '2026-10-02' },
  { n: '032', email: 'pawel.mroczkowski@dbr77.com', init: 'CLOUD', title: 'Approve cutover runbook for database migration', status: 'todo', priority: 'low', hours: 5, due: '2026-09-18' },
  { n: '033', email: 'tomasz.lewandowski@dbr77.com', init: 'QMS', title: 'Approve QMS 4.0 rollout training plan', status: 'todo', priority: 'low', hours: 8, due: '2026-10-09' },
  { n: '034', email: 'tomasz.lewandowski@dbr77.com', init: 'QMS', title: 'Review non-conformance workflow configuration', status: 'todo', priority: 'low', hours: 4, due: '2026-09-25' },
];

function newTaskId(n) {
  return `task-dbr77-load-${n}`;
}

async function mierzNewTasks(c) {
  const ids = NEW_TASKS.map((t) => newTaskId(t.n));
  const r = await c.query(
    `SELECT id, title, status, priority, assignee_id, reporter_id, owner_id, due_date, estimated_hours,
            task_type, initiative_id, project_id, organization_id, source
       FROM tasks WHERE id = ANY($1::text[])`,
    [ids]
  );
  return r.rows;
}

async function applyNewTasks(c, apply) {
  await resolveUserIds(c);
  const byEmail = new Map(USERS.map((u) => [u.email, u.id]));
  const adminId = byEmail.get(ADMIN_EMAIL);
  if (!adminId) throw new Error(`tasks-new: ${ADMIN_EMAIL} nie rozwiązany — STOP.`);

  // Sprawdzenie inicjatyw (istnieją, w DBR77) — jeden SELECT, jak w applyInitiatives.
  const initIds = [...new Set(Object.values(NEW_TASK_INITIATIVES).map((i) => i.id))];
  const initRows = await c.query(
    `SELECT id, organization_id FROM initiatives WHERE id = ANY($1::text[])`,
    [initIds]
  );
  const initById = new Map(initRows.rows.map((r) => [r.id, r]));
  for (const id of initIds) {
    const row = initById.get(id);
    if (!row) throw new Error(`tasks-new: inicjatywa ${id} nie istnieje — STOP.`);
    if (row.organization_id && row.organization_id !== DBR77_ORG) {
      throw new Error(`tasks-new: inicjatywa ${id} spoza DBR77 — STOP.`);
    }
  }

  const przed = await mierzNewTasks(c);
  const byId = new Map(przed.map((r) => [r.id, r]));
  const plan = [];
  for (const t of NEW_TASKS) {
    const id = newTaskId(t.n);
    const userId = byEmail.get(t.email);
    if (!userId) throw new Error(`tasks-new: ${t.email} nie rozwiązany — STOP.`);
    const initiative = NEW_TASK_INITIATIVES[t.init];
    const existing = byId.get(id);
    if (existing) {
      plan.push({ id, zmiana: 'brak (już istnieje — idempotentne)' });
      continue;
    }
    plan.push({
      id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      assignee: t.email,
      userId,
      initiativeId: initiative.id,
      projectId: initiative.projectId,
      dueDate: t.due,
      estimatedHours: t.hours,
    });
    if (apply) {
      await c.query(
        `INSERT INTO tasks (
            id, project_id, organization_id, title, description,
            status, priority, assignee_id, backup_assignee_id, reporter_id,
            due_date, started_at, estimated_hours, tags,
            task_type, initiative_id, list_id, workstream_id, why,
            source, owner_id, requires_acceptance, acceptance_type, acceptor_id,
            weight, weight_reason,
            expected_outcome, decision_impact, evidence_required, strategic_contribution,
            roadmap_initiative_id, kpi_id, raid_item_id, assignees,
            progress, blocked_reason, blocked_by_decision_id, blocked_at,
            custom_fields_json, idempotency_key,
            created_at, updated_at
         ) VALUES (
            $1, $2, $3, $4, NULL,
            $5, $6, $7, NULL, $8,
            $9, NULL, $10, '[]',
            'execution', $11, NULL, NULL, '',
            'manual', $7, false, NULL, NULL,
            1, NULL,
            '', '{}', '[]', '[]',
            NULL, NULL, NULL, '[]',
            0, '', NULL, NULL,
            '{}', $12,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         )
         ON CONFLICT (id) DO NOTHING`,
        [
          id,
          initiative.projectId,
          DBR77_ORG,
          t.title,
          t.status,
          t.priority,
          userId,
          adminId,
          t.due,
          t.hours,
          initiative.id,
          `da-zespol-20260910:new:${id}`,
        ]
      );
    }
  }
  const po = apply ? await mierzNewTasks(c) : null;
  return { przed, plan, po };
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  const argi = process.argv.slice(2);
  const op = (argi.find((a) => a.startsWith('--op=')) ?? '--op=').slice(5);
  const apply = argi.includes('--apply');
  const weeksArg = argi.find((a) => a.startsWith('--weeks='));
  const weeks = weeksArg ? Number(weeksArg.slice('--weeks='.length)) : 8;

  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  if (!databaseUrl) throw new Error('Brak DATABASE_URL/DATABASE_PUBLIC_URL.');
  sprawdzHost(databaseUrl);
  if (apply && process.env.FORCE_DA !== 'true') {
    throw new Error('--apply wymaga FORCE_DA=true.');
  }
  if (!op) throw new Error('Podaj --op=measure|users|initiatives|allocations|tasks|tasks-new|all');

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 3 });
  const c = await pool.connect();
  const raport = { op, tryb: apply ? 'APPLY' : 'DRY-RUN', czas: new Date().toISOString() };
  try {
    if (op === 'measure') {
      raport.measure = await mierz(c);
    } else {
      await c.query('BEGIN');
      const zestaw = op === 'all' ? ['users', 'initiatives', 'allocations', 'tasks'] : [op];
      for (const o of zestaw) {
        if (o === 'users') raport.users = await applyUsers(c, apply);
        else if (o === 'initiatives') raport.initiatives = await applyInitiatives(c, apply);
        else if (o === 'allocations') raport.allocations = await applyAllocations(c, apply);
        else if (o === 'tasks') {
          // CZĘŚĆ A (D-A, przypisanie istniejących) + CZĘŚĆ B (D-A2, nowe
          // zadania z popytem) — "rozszerzony `--op=tasks`" ze zlecenia D-A2.
          raport.tasks = {
            existing: await applyTasks(c, apply),
            new: await applyNewTasks(c, apply),
          };
        } else if (o === 'tasks-new') {
          // Sama CZĘŚĆ B, do izolowanego dry-run/apply bez dotykania CZĘŚCI A.
          raport.tasksNew = await applyNewTasks(c, apply);
        } else throw new Error(`Nieznana operacja: ${o}`);
      }
      if (apply) await c.query('COMMIT');
      else await c.query('ROLLBACK');
    }
  } catch (e) {
    try {
      await c.query('ROLLBACK');
    } catch {
      /* brak aktywnej transakcji przy op=measure — nic do rollbacku */
    }
    console.error('BŁĄD — ROLLBACK:', e.message);
    process.exitCode = 1;
    raport.blad = e.message;
  } finally {
    c.release();
    await pool.end();
  }

  const manifest = zapiszManifest(op + (apply ? '-apply' : op === 'measure' ? '' : '-dryrun'), raport);
  console.log(`[d-a-zespol] op=${op} tryb=${raport.tryb} manifest=${manifest}`);
  console.log(JSON.stringify(raport, null, 2));
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});

export {
  computeResourcePlan,
  summarize,
  buildWeekStarts,
  spreadTaskHoursByWeek,
  weeklySupplyHours,
  piszCsv,
};
