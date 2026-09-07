/**
 * P16 / R3 (DEC-453) — AUTOMAT ESKALACJI DECYZJI PO TERMINIE.
 *
 * Reguła (AUDYT_RYNKU_PMO_20260907.md §4.3, wiersz „Eskalacja"):
 *   raz na dobę, dla decyzji, której `deadline` już minął, a status wciąż jest
 *   otwarty (`pending` albo `escalated`) — podnieś POZIOM ESKALACJI o 1,
 *   maksymalnie do 3. Trzy poziomy: 1 = właściciel inicjatywy, 2 = PMO,
 *   3 = komitet.
 *
 * POPRAWKA WOBEC RYNKU (§4.3, wprost): automat MUSI zadziałać WSTECZNIE przy
 * pierwszym uruchomieniu — monday.com tego nie robi i dlatego istniejące
 * zaległości nie generują u nich nic. Tutaj pierwszy przebieg podnosi KAŻDĄ
 * przeterminowaną decyzję z poziomu 0 na 1; drugi przebieg tego samego dnia
 * nie robi nic (bramka „raz na dobę"), a przebieg następnego dnia podnosi
 * 1 → 2, potem 2 → 3 i zatrzymuje się na 3.
 *
 * GDZIE MIESZKA POZIOM — i dlaczego NIE w `decisions.escalation_level`:
 *   `decisions.escalation_level` to kolumna TEKSTOWA o wartościach
 *   `none|amber|red`, którą `DecisionController.getDecisions` PRZELICZA I
 *   NADPISUJE przy KAŻDYM odczycie listy (`computeEscalationLevel` z terminu,
 *   priorytetu i wpływu). To jest DOTKLIWOŚĆ, nie licznik: gdyby automat
 *   wpisywał tam kroki, pierwszy `GET /api/decisions` skasowałby je bez śladu.
 *   Dlatego licznik kroków żyje w `decision_escalation_log` (tabela istniała
 *   w schemacie, miała 0 wierszy i 0 pisarzy — patrz meldunek R3), gdzie
 *   `to_level` jest liczbą całkowitą, a `created_at` daje bramkę dobową.
 *   Poziom bieżący decyzji = `MAX(to_level)`, brak wiersza = poziom 0.
 *
 * TRYB SUCHY (`dryRun: true`, wymóg P16 §8 „ryzyka i cofanie"): przelicza
 * dokładnie tę samą listę tym samym zapytaniem i zwraca ją, ale NIE wykonuje
 * ani jednego zapisu. Pierwsze uruchomienie na stagingu ma iść wyłącznie po
 * obejrzeniu tej listy.
 */

import { randomUUID } from 'node:crypto';

import logger from '../utils/Logger.js';
import { queryAll, queryRun } from '../utils/queryHelpers.js';

/** Najwyższy poziom eskalacji: 1 właściciel inicjatywy → 2 PMO → 3 komitet. */
export const ESCALATION_MAX_LEVEL = 3;

/** Statusy, które znaczą „decyzja wciąż nie zapadła" — tylko te eskalują. */
export const ESCALATABLE_STATUSES = ['pending', 'escalated'] as const;

export interface EscalationCandidate {
  decisionId: string;
  organizationId: string;
  title: string;
  deadline: string | null;
  status: string;
  /** Poziom PRZED podniesieniem (0 = jeszcze nie eskalowana). */
  fromLevel: number;
  /** Poziom PO podniesieniu (fromLevel + 1, nigdy > ESCALATION_MAX_LEVEL). */
  toLevel: number;
  /** Osoba, na którą wskazuje ten poziom (decydent — najlepsze, co mamy w MVP). */
  escalateToUserId: string | null;
}

export interface EscalationTickResult {
  dryRun: boolean;
  /** Ile decyzji kwalifikuje się do podniesienia w tym przebiegu. */
  candidates: EscalationCandidate[];
  /** Ile faktycznie podniesiono (0 w trybie suchym). */
  escalated: number;
  /** Ile pominięto, bo już osiągnęły poziom maksymalny. */
  skippedAtMax: number;
  /** Ile pominięto, bo już były podnoszone dzisiaj. */
  skippedAlreadyToday: number;
  errors: number;
}

/**
 * Czysta reguła kroku — bez bazy, żeby dała się zmierzyć testem wprost.
 * Zwraca `null`, gdy decyzja NIE kwalifikuje się do podniesienia.
 */
export function nextEscalationLevel(input: {
  status: string | null | undefined;
  deadline: string | null | undefined;
  currentLevel: number;
  escalatedToday: boolean;
  now?: Date;
}): number | null {
  const { status, deadline, currentLevel, escalatedToday } = input;
  const now = input.now ?? new Date();

  if (escalatedToday) return null;
  if (!ESCALATABLE_STATUSES.includes(String(status || '').toLowerCase() as any)) return null;
  if (!deadline) return null;

  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return null;
  if (due.getTime() >= now.getTime()) return null;

  if (currentLevel >= ESCALATION_MAX_LEVEL) return null;
  return currentLevel + 1;
}

/**
 * Kandydaci do podniesienia — JEDNO zapytanie, ten sam kod dla trybu suchego
 * i ostrego (żeby „lista, którą obejrzałeś" i „to, co się zapisze" nie mogły
 * się rozjechać). Poziom bieżący i bramka dobowa liczone z
 * `decision_escalation_log` w podzapytaniach, nie w pętli po wierszach.
 */
export async function collectEscalationCandidates(params?: {
  organizationId?: string;
  now?: Date;
}): Promise<{
  candidates: EscalationCandidate[];
  skippedAtMax: number;
  skippedAlreadyToday: number;
}> {
  const now = params?.now ?? new Date();
  const nowIso = now.toISOString();
  const orgId = params?.organizationId;

  const rows = await queryAll<{
    id: string;
    organization_id: string;
    title: string;
    deadline: string | null;
    status: string | null;
    decision_maker_id: string | null;
    current_level: string | number | null;
    escalated_today: string | number | null;
  }>(
    `SELECT
        d.id,
        d.organization_id,
        d.title,
        d.deadline,
        d.status,
        d.decision_maker_id,
        COALESCE((SELECT MAX(el.to_level) FROM decision_escalation_log el
                   WHERE el.decision_id = d.id), 0) AS current_level,
        (SELECT COUNT(*) FROM decision_escalation_log el2
          WHERE el2.decision_id = d.id
            AND substr(el2.created_at, 1, 10) = substr(?, 1, 10)) AS escalated_today
      FROM decisions d
     WHERE d.deadline IS NOT NULL
       AND d.deadline < ?
       AND LOWER(COALESCE(d.status, 'pending')) IN ('pending', 'escalated')
       ${orgId ? 'AND d.organization_id = ?' : ''}
     ORDER BY d.deadline ASC`,
    orgId ? [nowIso, nowIso, orgId] : [nowIso, nowIso]
  );

  const candidates: EscalationCandidate[] = [];
  let skippedAtMax = 0;
  let skippedAlreadyToday = 0;

  for (const row of rows || []) {
    const currentLevel = Number(row.current_level ?? 0) || 0;
    const escalatedToday = Number(row.escalated_today ?? 0) > 0;
    const toLevel = nextEscalationLevel({
      status: row.status,
      deadline: row.deadline,
      currentLevel,
      escalatedToday,
      now,
    });
    if (toLevel === null) {
      if (escalatedToday) skippedAlreadyToday += 1;
      else if (currentLevel >= ESCALATION_MAX_LEVEL) skippedAtMax += 1;
      continue;
    }
    candidates.push({
      decisionId: row.id,
      organizationId: row.organization_id,
      title: row.title,
      deadline: row.deadline,
      status: String(row.status || 'pending').toLowerCase(),
      fromLevel: currentLevel,
      toLevel,
      escalateToUserId: row.decision_maker_id ?? null,
    });
  }

  return { candidates, skippedAtMax, skippedAlreadyToday };
}

/**
 * Jeden przebieg automatu. `dryRun: true` → zero zapisów, sama lista.
 *
 * Ślad zapisujemy w DWÓCH miejscach, celowo:
 *   · `decision_escalation_log` — licznik poziomu (from/to) + bramka dobowa,
 *   · `decision_history` — jeden wiersz audytu widoczny w karcie decyzji,
 *     tam gdzie człowiek go szuka (`GET /api/decisions/:id/history`).
 * `decisions.decision_rationale` NIE JEST DOTYKANE — to pole uzasadnienia
 * człowieka, automat nie ma prawa go nadpisać.
 */
export async function runDecisionEscalationTick(params?: {
  dryRun?: boolean;
  organizationId?: string;
  now?: Date;
}): Promise<EscalationTickResult> {
  const dryRun = params?.dryRun === true;
  const now = params?.now ?? new Date();
  const { candidates, skippedAtMax, skippedAlreadyToday } = await collectEscalationCandidates({
    organizationId: params?.organizationId,
    now,
  });

  if (dryRun) {
    return { dryRun: true, candidates, escalated: 0, skippedAtMax, skippedAlreadyToday, errors: 0 };
  }

  let escalated = 0;
  let errors = 0;
  for (const candidate of candidates) {
    try {
      await queryRun(
        `INSERT INTO decision_escalation_log
           (id, decision_id, organization_id, from_level, to_level, from_user_id, to_user_id,
            reason, triggered_by, trigger_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'system', 'AUTO_OVERDUE', ?)`,
        [
          randomUUID(),
          candidate.decisionId,
          candidate.organizationId,
          candidate.fromLevel,
          candidate.toLevel,
          candidate.escalateToUserId,
          candidate.escalateToUserId,
          `Termin minął, decyzja wciąż nierozstrzygnięta — poziom ${candidate.fromLevel} → ${candidate.toLevel}.`,
          now.toISOString(),
        ]
      );
      // Status otwarty przechodzi na `escalated`, żeby rejestr nazywał stan
      // tym samym słowem, którym nazywa go kolumna Status na ekranie.
      // `decision_maker_id` zostaje NIETKNIĘTY — decydent to nie jest pole,
      // które automat ma prawo podmienić (patrz escalateDecision w kontrolerze).
      await queryRun(
        `UPDATE decisions SET status = 'escalated', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND LOWER(COALESCE(status, 'pending')) IN ('pending', 'escalated')`,
        [candidate.decisionId]
      );
      await queryRun(
        `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
         VALUES (?, ?, 'escalated', ?, 'escalated', 'system', ?)`,
        [
          randomUUID(),
          candidate.decisionId,
          candidate.status,
          JSON.stringify({
            auto: true,
            fromLevel: candidate.fromLevel,
            toLevel: candidate.toLevel,
            reason: 'AUTO_OVERDUE',
          }),
        ]
      );
      escalated += 1;
    } catch (err: any) {
      errors += 1;
      logger.error('[decisionEscalationJob] Podniesienie poziomu nie powiodło się', {
        decisionId: candidate.decisionId,
        error: err?.message || String(err),
      });
    }
  }

  if (escalated > 0 || errors > 0) {
    logger.info('[decisionEscalationJob] Przebieg zakończony', {
      escalated,
      errors,
      skippedAtMax,
      skippedAlreadyToday,
    });
  }

  return { dryRun: false, candidates, escalated, skippedAtMax, skippedAlreadyToday, errors };
}

export default runDecisionEscalationTick;
