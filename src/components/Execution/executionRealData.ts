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

/** Inicjatywa jest „w toku” (EXECUTING/BLOCKED/TRACKING). */
export function isInFlightInitiative(initiative: RealInitiativeLike): boolean {
  return (EXECUTION_IN_FLIGHT_STATUSES as readonly string[]).includes(upper(initiative?.status));
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
  return Math.max(0, Math.floor((now - due) / DAY_MS));
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
 * Odchylenie terminu inicjatywy w dniach (dodatnie = po terminie).
 * `null` = nie da się policzyć (brak `plannedEndDate`) — SZARY, nie zielony.
 */
export function initiativeDeviationDays(
  initiative: RealInitiativeLike,
  now = Date.now()
): number | null {
  const end = parseDate(initiative?.plannedEndDate);
  if (end == null) return null;
  return Math.floor((now - end) / DAY_MS);
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
  return Math.max(0, Math.floor((now - due) / DAY_MS));
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
