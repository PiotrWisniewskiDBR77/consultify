/**
 * Deliverables — WARSTWA PIPELINE (H3.6): WATCHDOG timeoutu generacji.
 *
 * Problem (audyt): generatory doc/deck/sheet startują w tle (wzorzec Gamma:
 * odpowiedź 202 + poll statusu). Gdy proces w tle zawiśnie (LLM nigdy nie wróci,
 * hang na I/O, wyjątek nieprzechwycony w rzadkiej ścieżce), stan zostaje w
 * 'generating' BEZ KOŃCA:
 *   • deck  — persystowane w `presentation_decks.status = 'generating'`
 *             (przeżywa restart → wieczny spinner nawet po deployu);
 *   • doc/sheet — WYŁĄCZNIE w mapie in-memory `docRuntimeState` (brak kolumny
 *             statusu na work_canvas_drafts) → wieczne 'generating' do restartu.
 *
 * Watchdog okresowo zamiata oba źródła: wiersz/wpis w 'generating' starszy niż
 * `timeoutMs` → 'error'/'failed' z jawnym powodem. Użytkownik dostaje uczciwy
 * stan zamiast wiecznego spinnera i może ponowić.
 *
 * To jest warstwa PIPELINE (statusy/timeout/obserwowalność) — nie dotyka logiki
 * budowania treści (prozy/tabel/slajdów) ani startDoc.
 */
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { sweepStaleDocGenerations } from './docGenerationRuntime.js';

const LOG_PREFIX = '[GenerationWatchdog]';

/** Domyślny limit czasu generacji (nadpisywalny env `DELIVERABLES_GENERATION_TIMEOUT_MS`). */
const DEFAULT_TIMEOUT_MS = 8 * 60 * 1000; // 8 minut
/** Domyślny odstęp zamiatania (nadpisywalny env `DELIVERABLES_WATCHDOG_INTERVAL_MS`). */
const DEFAULT_INTERVAL_MS = 2 * 60 * 1000; // 2 minuty

export function resolveTimeoutMs(): number {
  const raw = Number(process.env.DELIVERABLES_GENERATION_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

function resolveIntervalMs(): number {
  const raw = Number(process.env.DELIVERABLES_WATCHDOG_INTERVAL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INTERVAL_MS;
}

interface StaleDeckRow {
  id: string;
  validation_warnings: string | null;
}

/**
 * Zamiata przeterminowane decki (SSOT w DB). status='generating' i updated_at
 * starsze niż cutoff → 'failed', a powód dopisujemy do `validation_warnings`
 * (JSON array) — to samo pole, które czyta `status()` przy stanie 'error', więc
 * powód jest widoczny w pollu i przeżywa restart. Aktualizacja jest warunkowa
 * (status='generating' w WHERE), więc nie wyścignie się z realnym zakończeniem.
 */
export async function sweepStaleDeckGenerations(
  timeoutMs: number,
  now: number = Date.now()
): Promise<{ swept: string[] }> {
  const cutoffIso = new Date(now - Math.max(0, timeoutMs)).toISOString();
  let rows: StaleDeckRow[] = [];
  try {
    rows = await dbAll<StaleDeckRow>(
      `SELECT id, validation_warnings
         FROM presentation_decks
        WHERE status = 'generating'
          AND updated_at < ?`,
      [cutoffIso]
    );
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} deck sweep query failed (skipping): ${err instanceof Error ? err.message : String(err)}`
    );
    return { swept: [] };
  }

  const swept: string[] = [];
  const reason = `Generacja przekroczyła limit czasu (${Math.round(timeoutMs / 60000)} min) — proces w tle nie zakończył się. Spróbuj ponownie.`;
  for (const row of rows) {
    let warnings: string[] = [];
    try {
      const parsed = row.validation_warnings ? JSON.parse(row.validation_warnings) : null;
      if (Array.isArray(parsed)) warnings = parsed.map((w) => String(w));
    } catch {
      /* nieparsowalne — zaczynamy od pustej listy */
    }
    warnings.push(reason);
    // Warunkowy UPDATE: przegrywa z realnym zakończeniem, które już zmieniło status.
    const res = await dbRun(
      `UPDATE presentation_decks
          SET status = 'failed', validation_warnings = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'generating'`,
      [JSON.stringify(warnings), row.id]
    );
    if (res.success && (res.changes ?? 0) > 0) {
      swept.push(row.id);
      logger.warn(
        `${LOG_PREFIX} watchdog: stale deck → failed: generation=${row.id} timeoutMs=${timeoutMs}`
      );
    }
  }
  return { swept };
}

/**
 * Jeden przebieg watchdoga: deck (DB) + doc/sheet (in-memory).
 */
export async function sweepStaleGenerations(options?: {
  timeoutMs?: number;
  now?: number;
}): Promise<{ deckSwept: string[]; docSwept: string[] }> {
  const timeoutMs = options?.timeoutMs ?? resolveTimeoutMs();
  const now = options?.now ?? Date.now();
  const deck = await sweepStaleDeckGenerations(timeoutMs, now);
  const doc = sweepStaleDocGenerations(timeoutMs, now);
  if (deck.swept.length || doc.swept.length) {
    logger.info(
      `${LOG_PREFIX} sweep complete: decks=${deck.swept.length} docsSheets=${doc.swept.length} timeoutMs=${timeoutMs}`
    );
  }
  return { deckSwept: deck.swept, docSwept: doc.swept };
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Uruchamia okresowe zamiatanie. Idempotentne — druga próba to no-op.
 */
export function startGenerationWatchdog(): void {
  if (intervalHandle) return;
  const intervalMs = resolveIntervalMs();
  const timeoutMs = resolveTimeoutMs();

  intervalHandle = setInterval(() => {
    void sweepStaleGenerations().catch((err) => {
      logger.warn(
        `${LOG_PREFIX} sweep failed: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  }, intervalMs);
  intervalHandle.unref?.();

  logger.info(
    `${LOG_PREFIX} Scheduled (interval=${Math.round(intervalMs / 1000)}s, timeout=${Math.round(timeoutMs / 60000)}min)`
  );
}

export function stopGenerationWatchdog(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export default { sweepStaleGenerations, startGenerationWatchdog, stopGenerationWatchdog };
