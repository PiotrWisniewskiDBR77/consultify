/**
 * AI Workload Assessment Service (#24d)
 *
 * Łączy DWA źródła sygnału obciążenia dla każdej osoby w organizacji:
 *   1. OBCIĄŻENIE ZADANIAMI — z workloadCapacityService.getCapacityOverview()
 *      (estymaty × alokacja, model D3, bez timesheetów).
 *   2. CZAS ZAJĘTY W KALENDARZU — suma czasu trwania eventów (meeting /
 *      external_event) z v8_calendar_items dla bieżącego tygodnia, per osoba
 *      (link przez source_id → v8_calendar_sources.user_id).
 *
 * WARSTWA AI: JEDNO wywołanie LLM na CAŁY zespół (batch), które SYNTETYZUJE te
 * deterministycznie policzone liczby w ocenę (przeciążony / optymalny /
 * niedociążony) + krótką rekomendację. AI NIE zgaduje liczb — tylko interpretuje
 * te, które już policzyliśmy. Wynik jest cache'owany per (org, tydzień), więc koszt
 * to maksymalnie jedno wywołanie AI na organizację na tydzień (z TTL 6h).
 *
 * Read-only: nic nie zapisuje do danych domenowych.
 */

import { generateChatResponse } from './aiService.js';
import type { CapacityOverviewUser } from './workloadCapacityService.js';
import { getCapacityOverview } from './workloadCapacityService.js';
import DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const LOG = '[ai-workload-assessment]';

export type WorkloadStatus = 'overloaded' | 'optimal' | 'underutilized';

export interface WorkloadAssessmentUser {
  userId: string;
  name: string;
  // ── sygnały deterministyczne (policzone, NIE halucynowane) ──
  capacityHours: number;
  /** allocatedHours z modelu zadań (estymaty × alokacja, okno tygodnia) */
  taskLoadHours: number;
  /** niezaplanowany backlog (zadania bez due_date) */
  backlogHours: number;
  /** utylizacja zadaniami: taskLoadHours / capacityHours */
  taskUtilizationPercent: number;
  /** suma godzin spotkań w kalendarzu (tydzień) */
  meetingHours: number;
  meetingCount: number;
  /** meetingHours / capacityHours */
  meetingLoadPercent: number;
  /** łączna presja: utylizacja zadaniami + obciążenie spotkaniami */
  combinedLoadPercent: number;
  // ── interpretacja AI ──
  status: WorkloadStatus;
  assessment: string;
  recommendation: string;
}

export interface WorkloadAssessmentResult {
  weekStart: string;
  weekEnd: string;
  users: WorkloadAssessmentUser[];
  generatedAt: string;
  /** czy wynik pochodzi z cache */
  cached: boolean;
  /** czy warstwa AI faktycznie wygenerowała oceny (false = fallback heurystyczny) */
  aiUsed: boolean;
}

interface CalendarBusyRow {
  user_id: string;
  start_at: string;
  end_at: string | null;
}

// ── Cache per (org, tydzień). TTL 6h żeby nie wołać AI per-request. ──
interface CacheEntry {
  at: number;
  result: WorkloadAssessmentResult;
}
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Deterministyczna klasyfikacja fallbackowa — używana jako HINT dla AI oraz
 * jako pełny fallback, gdy AI jest niedostępne. Bramki:
 *   combinedLoad > 100% → przeciążony; < 55% → niedociążony; wpp optymalny.
 */
function heuristicStatus(combinedLoadPercent: number): WorkloadStatus {
  if (combinedLoadPercent > 100) return 'overloaded';
  if (combinedLoadPercent < 55) return 'underutilized';
  return 'optimal';
}

function heuristicText(u: {
  name: string;
  meetingLoadPercent: number;
  taskLoadHours: number;
  meetingHours: number;
  status: WorkloadStatus;
}): { assessment: string; recommendation: string } {
  const meetingPart = `${u.meetingHours}h spotkań (${u.meetingLoadPercent}% czasu)`;
  const taskPart = `${u.taskLoadHours}h zadań`;
  if (u.status === 'overloaded') {
    return {
      assessment: `Przeciążony: ${meetingPart} + ${taskPart} przekracza dostępny czas.`,
      recommendation: 'Przenieś część zadań lub przełóż mniej krytyczne spotkania.',
    };
  }
  if (u.status === 'underutilized') {
    return {
      assessment: `Niedociążony: ${meetingPart} + ${taskPart}, jest wolna przepustowość.`,
      recommendation: 'Można dołożyć zadania lub wesprzeć przeciążonych członków zespołu.',
    };
  }
  return {
    assessment: `Optymalne obciążenie: ${meetingPart} + ${taskPart}.`,
    recommendation: 'Utrzymaj bieżący rozkład, monitoruj backlog.',
  };
}

/**
 * Suma godzin spotkań z kalendarza per osoba w oknie [windowStart, windowEnd].
 * Czyta v8_calendar_items (typy meeting/external_event), linkuje do usera przez
 * v8_calendar_sources. Duration liczony w JS (DB-agnostycznie na kolumnach TEXT).
 */
async function getCalendarBusyHours(
  orgId: string,
  windowStart: string,
  windowEnd: string
): Promise<Map<string, { hours: number; count: number }>> {
  const byUser = new Map<string, { hours: number; count: number }>();
  try {
    const rows = await DbPromise.all<CalendarBusyRow>(
      `SELECT s.user_id AS user_id, i.start_at AS start_at, i.end_at AS end_at
       FROM v8_calendar_items i
       JOIN v8_calendar_sources s ON s.calendar_source_id = i.source_id
       WHERE i.organization_id = ?
         AND i.item_type IN ('meeting', 'external_event')
         AND i.all_day = 0
         AND i.end_at IS NOT NULL
         AND i.start_at >= ? AND i.start_at <= ?
       ORDER BY i.start_at ASC
       LIMIT 2000`,
      [orgId, `${windowStart}T00:00:00`, `${windowEnd}T23:59:59`]
    );

    for (const r of rows || []) {
      if (!r.user_id || !r.start_at || !r.end_at) continue;
      const startMs = new Date(r.start_at).getTime();
      const endMs = new Date(r.end_at).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
      const hours = (endMs - startMs) / 3_600_000;
      // odrzuć nierealne (>16h) — prawdopodobnie all-day źle oznaczone
      if (hours > 16) continue;
      const cur = byUser.get(r.user_id) || { hours: 0, count: 0 };
      cur.hours += hours;
      cur.count += 1;
      byUser.set(r.user_id, cur);
    }
  } catch (err) {
    // v8_calendar_* mogą nie istnieć w danym środowisku → brak sygnału kalendarzowego
    logger.warn(`${LOG} calendar busy query skipped: ${(err as Error)?.message}`);
  }
  return byUser;
}

/**
 * Buduje deterministyczne sygnały per-osoba z dwóch źródeł.
 */
function buildSignals(
  capacityUsers: CapacityOverviewUser[],
  calendar: Map<string, { hours: number; count: number }>
): WorkloadAssessmentUser[] {
  return capacityUsers.map((u) => {
    const cal = calendar.get(u.userId) || { hours: 0, count: 0 };
    const meetingHours = round1(cal.hours);
    const meetingLoadPercent =
      u.capacityHours > 0 ? Math.round((meetingHours / u.capacityHours) * 100) : 0;
    const combinedLoadPercent = u.utilizationPercent + meetingLoadPercent;
    const status = heuristicStatus(combinedLoadPercent);
    const { assessment, recommendation } = heuristicText({
      name: u.name,
      meetingLoadPercent,
      taskLoadHours: u.allocatedHours,
      meetingHours,
      status,
    });
    return {
      userId: u.userId,
      name: u.name,
      capacityHours: u.capacityHours,
      taskLoadHours: u.allocatedHours,
      backlogHours: u.backlogHours,
      taskUtilizationPercent: u.utilizationPercent,
      meetingHours,
      meetingCount: cal.count,
      meetingLoadPercent,
      combinedLoadPercent,
      status,
      assessment,
      recommendation,
    };
  });
}

/**
 * Warstwa AI: jedno wywołanie LLM syntetyzujące oceny dla całego zespołu.
 * Zwraca mapę userId → {status, assessment, recommendation} albo null gdy AI padło.
 */
async function synthesizeWithAI(
  users: WorkloadAssessmentUser[]
): Promise<Map<string, { status: WorkloadStatus; assessment: string; recommendation: string }> | null> {
  if (users.length === 0) return new Map();

  const roster = users.map((u, idx) => ({
    i: idx,
    name: u.name,
    capacity_h: u.capacityHours,
    task_load_h: u.taskLoadHours,
    backlog_h: u.backlogHours,
    task_util_pct: u.taskUtilizationPercent,
    meeting_h: u.meetingHours,
    meeting_count: u.meetingCount,
    meeting_load_pct: u.meetingLoadPercent,
    combined_load_pct: u.combinedLoadPercent,
    heuristic_status: u.status,
  }));

  const systemPrompt =
    'Jesteś analitykiem operacyjnym w firmie konsultingowej. Oceniasz REALNE obciążenie ' +
    'pracowników na podstawie już policzonych liczb. NIE wymyślaj nowych liczb — używaj TYLKO ' +
    'wartości z danych wejściowych. Odpowiadaj wyłącznie poprawnym JSON, po polsku.';

  const userPrompt =
    'Dla każdej osoby oceń obciążenie i wydaj rekomendację. Kluczowa zasada: patrz na REALNE ' +
    'obciążenie = zadania (task_load_h/task_util_pct) + spotkania (meeting_h/meeting_load_pct), ' +
    'nie samą liczbę spotkań. combined_load_pct to suma presji zadaniowej i spotkaniowej.\n\n' +
    'Zasady statusu: >100% = "overloaded"; 55–100% = "optimal"; <55% = "underutilized". ' +
    'heuristic_status to podpowiedź — możesz ją potwierdzić lub skorygować jeśli rozkład ' +
    '(np. dużo spotkań ale mało zadań, lub duży backlog) tego wymaga.\n\n' +
    'Zwróć obiekt JSON: {"assessments":[{"i":<indeks>,"status":"overloaded|optimal|underutilized",' +
    '"assessment":"<1 zdanie: co składa się na obciążenie, z liczbami z danych>",' +
    '"recommendation":"<1 zdanie: konkretna akcja>"}]}. ' +
    'Bez markdown, bez komentarzy.\n\nDANE:\n' +
    JSON.stringify(roster);

  try {
    const { content } = await generateChatResponse({
      messages: [{ role: 'user', content: userPrompt }],
      systemPrompt,
      maxTokens: 1200,
    });

    // Wyłuskaj JSON (na wypadek gdyby model owinął go tekstem)
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd <= jsonStart) return null;
    const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as {
      assessments?: Array<{
        i: number;
        status: string;
        assessment: string;
        recommendation: string;
      }>;
    };

    const out = new Map<
      string,
      { status: WorkloadStatus; assessment: string; recommendation: string }
    >();
    for (const a of parsed.assessments || []) {
      const target = users[a.i];
      if (!target) continue;
      const status: WorkloadStatus =
        a.status === 'overloaded' || a.status === 'underutilized' || a.status === 'optimal'
          ? (a.status as WorkloadStatus)
          : target.status;
      out.set(target.userId, {
        status,
        assessment: String(a.assessment || target.assessment).slice(0, 280),
        recommendation: String(a.recommendation || target.recommendation).slice(0, 280),
      });
    }
    return out.size > 0 ? out : null;
  } catch (err) {
    logger.warn(`${LOG} AI synthesis failed, using heuristic fallback: ${(err as Error)?.message}`);
    return null;
  }
}

/**
 * Główne wejście. Zwraca ocenę obciążenia AI dla całej organizacji na bieżący
 * tydzień. Cache'owane per (org, tydzień) z TTL 6h → koszt AI ograniczony.
 */
export async function getWorkloadAssessment(
  orgId: string,
  opts: { refresh?: boolean } = {}
): Promise<WorkloadAssessmentResult> {
  const overview = await getCapacityOverview(orgId);
  const { windowStart, windowEnd } = overview;
  const cacheKey = `${orgId}:${windowStart}`;

  if (!opts.refresh) {
    const hit = CACHE.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return { ...hit.result, cached: true };
    }
  }

  const calendar = await getCalendarBusyHours(orgId, windowStart, windowEnd);
  const signals = buildSignals(overview.users, calendar);

  let aiUsed = false;
  const aiMap = await synthesizeWithAI(signals);
  if (aiMap) {
    aiUsed = true;
    for (const u of signals) {
      const a = aiMap.get(u.userId);
      if (a) {
        u.status = a.status;
        u.assessment = a.assessment;
        u.recommendation = a.recommendation;
      }
    }
  }

  const result: WorkloadAssessmentResult = {
    weekStart: windowStart,
    weekEnd: windowEnd,
    users: signals,
    generatedAt: new Date().toISOString(),
    cached: false,
    aiUsed,
  };

  CACHE.set(cacheKey, { at: Date.now(), result });
  return result;
}

export default { getWorkloadAssessment };
