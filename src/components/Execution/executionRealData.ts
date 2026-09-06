/**
 * Realizacja — REGUŁY NA DANYCH ZASTANYCH (1.12-R1, plan
 * `docs/program/PROGRAM_NAPRAWCZY_20260905/1_12_REALIZACJA_PLAN.md`, B1).
 *
 * POMIAR (06.09, org DBR77, API 127.0.0.1:4100), który wymusił ten plik:
 *   · `runtime-v1/execution-cases` → 0 rekordów; `runtime-v1/.../work` → 0;
 *     `management-signals` → 0; `interventions` → 0,
 *   · a obok, w tabelach zastanych: `/api/tasks` 84, `/api/decisions` 35
 *     (25 otwartych, 12 po terminie), `/api/raid` 16, `/api/initiatives` 72
 *     (26 w toku: EXECUTING 17 · BLOCKED 6 · TRACKING 3).
 * Zakładki Realizacja czytały wyłącznie pierwszą listę, więc były puste.
 *
 * DRUGI POMIAR, ważniejszy niż wygląda: `GET /api/decisions` zwraca dla DBR77
 * **zero** decyzji o statusie `PENDING`, które są po terminie — wszystkie 12
 * przeterminowanych ma status `ESCALATED`. Filtr „PENDING && po terminie",
 * który stał w `ExecutionHub`, dawał więc DOKŁADNIE 0 — i to jest przyczyna
 * kafla „Do rozstrzygnięcia = 1" przy 25 otwartych decyzjach, a nie sam filtr
 * po projekcie. Dlatego „otwarta decyzja" ma tu JEDNĄ definicję, w jednym
 * miejscu, obok testu.
 *
 * Plik jest CZYSTY (zero React, zero fetch) — reguły dają się zmierzyć testem
 * jednostkowym bez renderu, a powierzchnie (Kokpit / Realizacje / Praca /
 * Decyzje i ryzyka) liczą z tego samego źródła, więc kafel i tabela nie mogą
 * się rozjechać.
 */

/** Statusy inicjatywy, które w Realizacji znaczą „w toku" (DEC CTO, pytanie C5.1:
 *  wszystkie w toku, handoff = opcjonalna bramka, nie warunek istnienia). */
export const EXECUTION_IN_FLIGHT_STATUSES = ['EXECUTING', 'BLOCKED', 'TRACKING'] as const;

/** Statusy decyzji, które znaczą „jeszcze nie rozstrzygnięta". */
export const OPEN_DECISION_STATUSES = ['PENDING', 'ESCALATED', 'DEFERRED', 'OPEN'] as const;

export interface RealInitiativeLike {
  id?: string;
  name?: string | null;
  status?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  /** R3 — plan ZAMROŻONY (baseline). Od tego liczy się odchylenie. */
  baselineStartDate?: string | null;
  baselineEndDate?: string | null;
  actualEndDate?: string | null;
  scheduleShiftCount?: number | null;
  currentStage?: string | null;
  [key: string]: unknown;
}

export interface RealDecisionLike {
  id?: string;
  status?: string | null;
  dueDate?: string | null;
  isOverdue?: boolean | null;
  daysOverdue?: number | null;
  [key: string]: unknown;
}

export interface RealTaskLike {
  id?: string;
  status?: string | null;
  dueDate?: string | null;
  [key: string]: unknown;
}

export type ExecutionRag = 'red' | 'amber' | 'green' | 'grey';

const DAY_MS = 86_400_000;

const upper = (value: unknown): string => String(value ?? '').toUpperCase();

const parseDate = (value: unknown): number | null => {
  if (!value) return null;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * DWA SŁOWNIKI STATUSU INICJATYWY — zmierzone na żywo 06.09.
 *
 * `GET /api/initiatives` na tym samym koncie i tej samej trasie zwróciło
 * o 18:35 statusy z enumu frontu (`EXECUTING` 17 · `BLOCKED` 6 · `SCHEDULED` 7
 * · `TRACKING` 3 · `DONE` 5 · `CANCELLED` 3 · `ARCHIVED` 1 …), a o 19:15 —
 * WSZYSTKIE 72 te same rekordy pod innymi nazwami (`IN_EXECUTION` 23 ·
 * `PENDING_APPROVAL` 16 · `APPROVED` 12 · `DRAFT` 9 · `CLOSED` 9 ·
 * `REJECTED` 3). Bez restartu serwera (PID 44370 od 17:56), bez zmiany
 * tokenu, przy niezmienionych `/api/decisions` (35) i `/api/tasks` (84).
 * Liczby się sumują parami (23 = 17 EXECUTING + 6 BLOCKED; 9 CLOSED =
 * 5 DONE + 3 CANCELLED + 1 ARCHIVED), więc to nie są inne rekordy — to ten
 * sam portfel opisany drugim słownikiem.
 *
 * Żadnej z nowych nazw NIE MA w `InitiativeStatus` (src/types/core.ts:732),
 * więc `EXECUTION_STATUSES.includes(status)` odrzucał KAŻDY wiersz i zakładka
 * „Realizacje" pokazywała pustą tabelę przy 72 inicjatywach w API.
 *
 * Ta mapa jest OSŁONĄ, nie rozstrzygnięciem: przywraca widoczność danych bez
 * względu na to, który słownik siedzi w bazie. Skąd wzięła się druga postać
 * i który słownik jest kanoniczny — zgłoszone jako STOP (poza zakresem R1,
 * dotyka Inicjatyw i wspólnego `initiativeLifecycle`).
 */
const STATUS_ALIASES: Record<string, string> = {
  IN_EXECUTION: 'EXECUTING',
  IN_PROGRESS: 'EXECUTING',
  PENDING_APPROVAL: 'REVIEW',
  CLOSED: 'DONE',
  COMPLETED: 'DONE',
  REJECTED: 'CANCELLED',
};

/** Status inicjatywy sprowadzony do enumu frontu (patrz STATUS_ALIASES). */
export function normalizeInitiativeStatus(status: unknown): string {
  const raw = upper(status);
  return STATUS_ALIASES[raw] ?? raw;
}

/** Inicjatywa jest „w toku” (EXECUTING/BLOCKED/TRACKING). */
export function isInFlightInitiative(initiative: RealInitiativeLike): boolean {
  return (EXECUTION_IN_FLIGHT_STATUSES as readonly string[]).includes(
    normalizeInitiativeStatus(initiative?.status)
  );
}

export function filterInFlightInitiatives<T extends RealInitiativeLike>(initiatives: T[]): T[] {
  return (initiatives ?? []).filter(isInFlightInitiative);
}

/** Decyzja jeszcze nierozstrzygnięta (patrz nagłówek: 12/12 po terminie to ESCALATED). */
export function isOpenDecision(decision: RealDecisionLike): boolean {
  return (OPEN_DECISION_STATUSES as readonly string[]).includes(upper(decision?.status));
}

/**
 * Decyzja po terminie. Serwer LICZY to sam (`isOverdue`/`daysOverdue`
 * w `DecisionController.getDecisions`) — ufamy jego liczbie, a datę
 * przeliczamy tylko wtedy, gdy pola nie ma (starsza odpowiedź / atrapa).
 */
export function isDecisionOverdue(decision: RealDecisionLike, now = Date.now()): boolean {
  if (typeof decision?.isOverdue === 'boolean') return decision.isOverdue;
  const due = parseDate(decision?.dueDate);
  return due != null && due < now;
}

export function decisionDaysOverdue(
  decision: RealDecisionLike,
  now = Date.now()
): number | null {
  if (typeof decision?.daysOverdue === 'number') return Math.max(0, decision.daysOverdue);
  const due = parseDate(decision?.dueDate);
  if (due == null || due >= now) return null;
  return Math.max(1, Math.floor((now - due) / DAY_MS));
}

/** Otwarte decyzje po terminie — jedna definicja dla kafla i dla tabeli. */
export function overdueOpenDecisions<T extends RealDecisionLike>(
  decisions: T[],
  now = Date.now()
): T[] {
  return (decisions ?? []).filter((d) => isOpenDecision(d) && isDecisionOverdue(d, now));
}

export function openDecisions<T extends RealDecisionLike>(decisions: T[]): T[] {
  return (decisions ?? []).filter(isOpenDecision);
}

/**
 * ODCHYLENIE OD PLANU BAZOWEGO w dniach (dodatnie = później niż zobowiązanie).
 *
 * POMIAR, KTÓRY TO ZMIENIŁ (06.09, ekran Realizacja › Realizacje, zrzut
 * `evidence/realizacja-filtr/PO-realizacje.png`): kolumna „Odchylenie (dni)"
 * pokazywała −55, −48, −35, −90 obok RAG „Na czas" w każdym wierszu. Liczyła
 * `dziś − plannedEndDate`, czyli DNI POZOSTAŁE DO KOŃCA AKTUALNEGO PLANU —
 * a nie odchylenie od czegokolwiek. Gorzej: liczona od `plannedEndDate` jest
 * z definicji ślepa na to, co ma mierzyć, bo wystarczy PRZESUNĄĆ tę datę
 * i opóźnienie znika z raportu bez śladu (R3, uzasadnienie właściciela:
 * „bez baseline'u nie ma uczciwego opóźnienia").
 *
 * Teraz liczy od `baselineEndDate` — daty planowanej ZAMROŻONEJ (migracja
 * `20262106_r3_milestone_baseline_rebaseline.sql`, serwer odmawia jej zmiany
 * bez decyzji z zatwierdzającym od DRUGIEGO przesunięcia):
 *   · jest FAKT (`actualEndDate`) → fakt − baseline; sprawa zamknięta,
 *   · nie ma faktu → PÓŹNIEJSZA z dwóch dat: aktualny plan i DZIŚ (bez `max`
 *     opóźnienie przestawałoby rosnąć dokładnie wtedy, gdy zaczyna boleć),
 *   · brak baseline'u → `null` („—"), NIGDY zero: zero znaczy „zgodnie
 *     z zobowiązaniem" i nie wolno go zmyślać z braku danych.
 */
export function initiativeDeviationDays(
  initiative: RealInitiativeLike,
  now = Date.now()
): number | null {
  const baseline = parseDate(initiative?.baselineEndDate);
  if (baseline == null) return null;
  const actual = parseDate(initiative?.actualEndDate);
  if (actual != null) return Math.round((actual - baseline) / DAY_MS);
  const planned = parseDate(initiative?.plannedEndDate);
  const reference = planned == null ? now : Math.max(planned, now);
  return Math.round((reference - baseline) / DAY_MS);
}

/**
 * RAG inicjatywy (metodyka A1 pkt 8 — SZARY to osobny kolor „luka danych",
 * nie fałszywa zieleń):
 *   · po terminie              → red
 *   · termin za ≤ 7 dni        → amber
 *   · dalej niż 7 dni          → green
 *   · brak `plannedEndDate`    → grey
 */
export function initiativeRag(initiative: RealInitiativeLike, now = Date.now()): ExecutionRag {
  const end = parseDate(initiative?.plannedEndDate);
  if (end == null) return 'grey';
  if (end < now) return 'red';
  if (end - now <= 7 * DAY_MS) return 'amber';
  return 'green';
}

export interface ExecutionOnTime {
  onTimePercent: number | null;
  onTrackCount: number;
  atRiskCount: number;
  delayedCount: number;
  unknownCount: number;
  totalInitiatives: number;
}

/**
 * Kafel „Na czas" liczony z REALNYCH dat inicjatyw (a nie z licznika
 * „wszystko poza zablokowanymi", który do 06.09 pokazywał ~100 % niezależnie
 * od terminów). Mianownik to inicjatywy Z DATĄ — inicjatywy bez daty nie
 * podbijają ani nie zaniżają procentu, tylko są jawnie policzone osobno.
 */
export function onTimeFromInitiatives(
  initiatives: RealInitiativeLike[],
  now = Date.now()
): ExecutionOnTime {
  let onTrack = 0;
  let atRisk = 0;
  let delayed = 0;
  let unknown = 0;
  for (const initiative of initiatives ?? []) {
    const rag = initiativeRag(initiative, now);
    if (rag === 'grey') unknown += 1;
    else if (rag === 'red') delayed += 1;
    else if (rag === 'amber') atRisk += 1;
    else onTrack += 1;
  }
  const measurable = onTrack + atRisk + delayed;
  return {
    onTimePercent: measurable > 0 ? Math.round((onTrack / measurable) * 100) : null,
    onTrackCount: onTrack,
    atRiskCount: atRisk,
    delayedCount: delayed,
    unknownCount: unknown,
    totalInitiatives: (initiatives ?? []).length,
  };
}

const DONE_TASK_STATUSES = new Set(['DONE', 'COMPLETED', 'CANCELLED', 'CANCELED', 'ARCHIVED']);

export function isClosedTask(task: RealTaskLike): boolean {
  return DONE_TASK_STATUSES.has(upper(task?.status));
}

/**
 * Poślizg zadania w dniach (dodatnie = po terminie, `null` = brak terminu
 * albo zadanie zamknięte). Zastępuje kolumnę „SLA", która dla realnych zadań
 * była PUSTA W KAŻDYM WIERSZU (`slaAt` nie istnieje w tabeli `tasks` —
 * pomiar B5 planu).
 */
export function taskSlipDays(task: RealTaskLike, now = Date.now()): number | null {
  if (isClosedTask(task)) return null;
  const due = parseDate(task?.dueDate);
  if (due == null || due >= now) return null;
  // Minimum 1: termin, który minął dziś rano, to poślizg jednego dnia, a nie
  // „+0". „+0" pojawiło się na zrzucie zakładki Praca (06.09) w wierszach
  // z terminem wczorajszym wieczorem — liczba, która nic nie znaczy.
  return Math.max(1, Math.floor((now - due) / DAY_MS));
}

export function isTaskOverdue(task: RealTaskLike, now = Date.now()): boolean {
  return taskSlipDays(task, now) != null;
}

export function isTaskBlocked(task: RealTaskLike): boolean {
  return upper(task?.status) === 'BLOCKED';
}

/**
 * Poziom bramki L0–L5. POMIAR 06.09: kolumna `currentStage` istnieje na
 * wszystkich 72 inicjatywach i jest `null` na WSZYSTKICH — dlatego kolumna
 * „Poziom" pokazuje „—", a nie zmyślone L2. Gdy silnik zacznie ją wypełniać,
 * ta funkcja podaje wartość bez zmiany w tabeli.
 */
export function initiativeLevelLabel(initiative: RealInitiativeLike): string {
  const raw = initiative?.currentStage;
  if (raw == null || String(raw).trim() === '') return '—';
  const value = String(raw).trim();
  return /^l[0-9]$/i.test(value) ? value.toUpperCase() : value;
}

const truthy = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1';

/**
 * Inicjatywa zablokowana — 1.12-R1b, KROK 2. POMIAR: kafel „Blokery" i
 * `actionCenter.blocked` (Kokpit) porównywały `status === 'BLOCKED'` wprost.
 * Migracja P12 (Codex, w toku przy pisaniu tego pliku) usuwa status `BLOCKED`
 * na rzecz `IN_EXECUTION` (→ `EXECUTING` po `normalizeInitiativeStatus`) +
 * flaga `on_hold`/`onHold` — dzień, w którym migracja wejdzie, licznik
 * spadłby cicho do zera (bez błędu, bez czerwonego testu — dokładnie kształt
 * „Zamknięte przez wygaszenie"). Ta funkcja rozpoznaje OBA słowniki: stary
 * (`BLOCKED` wprost) i nowy (`EXECUTING`/`IN_EXECUTION` + `on_hold` prawda).
 */
export function isBlockedInitiative(initiative: RealInitiativeLike): boolean {
  const status = normalizeInitiativeStatus(initiative?.status);
  if (status === 'BLOCKED') return true;
  if (status !== 'EXECUTING') return false;
  const record = initiative as Record<string, unknown>;
  return truthy(record?.onHold ?? record?.on_hold);
}

// ─────────────────────────────────────────────────────────────────────────
// RAID (Risks/Actions/Issues/Dependencies) — 1.12-R1b, KROK 1.
//
// POMIAR: kafel „Ryzyka" Kokpitu i tabela pod nim czytały
// `execSnapshot.risks.topRisks`, które dla DBR77 = 0 (silnik wykonawczy —
// `executiveAggregateService.getProjectRaidRisks` — łączy `raid_items` z
// `initiatives.project_id`, filtruje `type = 'RISK'` i status
// OPEN/IN_PROGRESS; portfel bez tej kombinacji pól znika bez śladu). Obok,
// nieczytane: `GET /api/raid` → 16 pozycji (RISK/ISSUE/DEPENDENCY/ASSUMPTION),
// dokładnie ten sam rejestr, który zakładka „Decyzje i ryzyka"
// (`ExecutionControlSurface`) już pokazuje poprawnie od R1 (C). Reguły niżej
// są WSPÓLNE dla Kokpitu i tej zakładki — jeden dom normalizacji, żeby kafel,
// tabela Kokpitu i rejestr „Decyzje i ryzyka" nigdy nie pokazały różnej liczby
// dla tego samego zapytania `GET /api/raid`.
// ─────────────────────────────────────────────────────────────────────────

export interface RealRaidItemLike {
  id?: string;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  initiativeId?: string | null;
  initiativeName?: string | null;
  dueDate?: string | null;
  probability?: string | null;
  impact?: string | null;
  severity?: string | null;
  riskScore?: number | null;
  mitigationPlan?: string | null;
  [key: string]: unknown;
}

const RAID_TYPE_LABELS_PL: Record<string, string> = {
  RISK: 'Ryzyko',
  ISSUE: 'Problem',
  DEPENDENCY: 'Zależność',
  ASSUMPTION: 'Założenie',
  ACTION: 'Działanie',
};
const RAID_TYPE_LABELS_EN: Record<string, string> = {
  RISK: 'Risk',
  ISSUE: 'Issue',
  DEPENDENCY: 'Dependency',
  ASSUMPTION: 'Assumption',
  ACTION: 'Action',
};

/** Typ pozycji RAID po polsku/angielsku — ten sam słownik co `ExecutionControlSurface`. */
export function raidTypeLabel(type: unknown, isPolish = true): string {
  const key = String(type ?? '').toUpperCase();
  const map = isPolish ? RAID_TYPE_LABELS_PL : RAID_TYPE_LABELS_EN;
  return map[key] ?? (type == null || String(type).trim() === '' ? '—' : String(type));
}

const RAID_LEVEL_SCORE: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

/**
 * Poziom ryzyka = P × I (skala 1–4 na oś, ta sama, na której działa istniejący
 * `riskBand` w `ExecutionSummaryOneLook`). Liczymy WPROST z `probability`/
 * `impact`, nie z `riskScore` zapisanego w bazie — ten bywa `null` na
 * pozycjach dodanych poza `POST /api/raid` (np. migracją, seedem). Gdy
 * `probability`/`impact` nie ma ANI JEDNEGO pola, cofamy się do `riskScore`,
 * a gdy i tego brak — `null` ([]„—"] w UI, nie zmyślone 0/1).
 */
export function raidLevelScore(item: RealRaidItemLike): number | null {
  const p = RAID_LEVEL_SCORE[String(item?.probability ?? '').toUpperCase()];
  const i = RAID_LEVEL_SCORE[String((item?.impact ?? item?.severity) ?? '').toUpperCase()];
  if (p && i) return p * i;
  if (typeof item?.riskScore === 'number' && Number.isFinite(item.riskScore)) {
    return item.riskScore;
  }
  return null;
}

const RAID_SEVERITY_LABEL_PL: Record<string, string> = {
  LOW: 'Niskie',
  MEDIUM: 'Umiarkowane',
  HIGH: 'Wysokie',
  CRITICAL: 'Krytyczne',
};
const RAID_SEVERITY_LABEL_EN: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Moderate',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

/**
 * Poziom w słowach, gdy P×I się nie liczy (brakuje `probability` ALBO
 * `impact`) — fallback na `impact`/`severity` samo w sobie. `null`, gdy i
 * tego nie ma (UI pokazuje wtedy „—", nie zmyśloną etykietę).
 */
export function raidSeverityLabel(item: RealRaidItemLike, isPolish = true): string | null {
  const key = String((item?.impact ?? item?.severity) ?? '').toUpperCase();
  const map = isPolish ? RAID_SEVERITY_LABEL_PL : RAID_SEVERITY_LABEL_EN;
  return map[key] ?? null;
}

/**
 * Właściciel pozycji RAID dla Kokpitu: gotowa nazwa z API → katalog
 * organizacji → `null`. CELOWO różni się od `ExecutionControlSurface`
 * (rejestr „Decyzje i ryzyka" pokazuje tam „Nieznany użytkownik" dla ID spoza
 * katalogu — POMIAR 06.09: 16/16 pozycji RAID ma `ownerId` spoza
 * `organization_members`). Kokpit ma pokazywać PUSTKĘ („—"), nie fałszywy
 * komunikat o koncie — `null` tutaj, wołający dokłada „—" w UI.
 */
export function raidOwnerDisplayName(
  item: RealRaidItemLike,
  resolveMemberName?: (userId: string) => string | null
): string | null {
  if (item?.ownerName) return String(item.ownerName);
  const id = String(item?.ownerId ?? '').trim();
  if (!id) return null;
  return resolveMemberName?.(id) ?? null;
}

/**
 * TOP pozycje RAID posortowane malejąco po poziomie — brak poziomu (`null`)
 * zawsze na końcu, nigdy nie wypycha policzonych pozycji z TOP N. Sort jest
 * stabilny (Array#sort w V8 jest stabilny od Node 11) — pozycje o równym
 * poziomie zostają w kolejności `created_at DESC` zwróconej przez serwer.
 */
export function topRaidItemsByLevel<T extends RealRaidItemLike>(
  items: T[],
  limit = 10
): T[] {
  return [...(items ?? [])]
    .sort((a, b) => {
      const sa = raidLevelScore(a);
      const sb = raidLevelScore(b);
      if (sa == null && sb == null) return 0;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sb - sa;
    })
    .slice(0, limit);
}
