/**
 * executionRiskSignalView — WYGLĄD sygnalizacji ryzyka i śladu przekazania.
 *
 * Podział jak w `executionBankModel` ↔ `ExecutionBankViews`: reguły liczbowe
 * mieszkają w `executionRiskSignal.ts` (czysty model, testowalny), a tutaj jest
 * WYŁĄCZNIE przekład poziom → pastylka. Dzięki temu żaden komponent nie ma
 * własnej tabelki progów.
 *
 * DEC-487 — ZAWSZE KOLOR + TEKST + IKONA. Każda pastylka renderuje wszystkie
 * trzy nośniki naraz; nie ma gałęzi, w której zostaje sama plama koloru.
 * Pastylka niesie też `title`/`aria-label` z pełnym zdaniem, więc czytnik
 * ekranu i podpowiedź mówią to samo co oko.
 *
 * CZERWIEŃ (`c-danger`) WYŁĄCZNIE NA POZIOMIE 3 — CLAUDE.md reguła UI 3
 * („czerwień tylko semantyka krytyczna"). Poziom 2 to mocniejszy bursztyn.
 * Brak danych jest NEUTRALNY (`c-text-muted` na `c-surface-subtle`), nigdy
 * zielony — „nie zmierzono" to nie „w normie".
 *
 * `c-surface-subtle`, nie `c-surface-muted`: tego drugiego tokena NIE MA w
 * `src/index.css` (sprawdzone 14.09) — klasa `bg-c-surface-muted` nie maluje
 * niczego i wygląda jak brak tła, a nie jak błąd.
 */
import {
  CheckCircle2,
  CircleHelp,
  Clock3,
  Handshake,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import React from 'react';

import type { ExecutionBankHandoff } from './executionBankModel';
import type {
  ExecutionRiskAxis,
  ExecutionRiskAxisId,
  ExecutionRiskIconId,
  ExecutionRiskLevel,
  ExecutionRiskSignal,
} from './executionRiskSignal';

/**
 * Ten sam kształt co `ExecutionBankPreviewT` i `BankT` — `Record<string,
 * string | number>`, nie `unknown`. i18next i tak przyjmie więcej, ale
 * rozjazd typu zmuszałby każdego wołacza do rzutowania, a rzutowanie jest
 * miejscem, w którym ginie prawdziwy błąd.
 */
type RiskT = (
  key: string,
  defaultValue: string,
  vars?: Record<string, string | number>
) => string;

const TONE_BY_LEVEL: Record<string, string> = {
  '0': 'border-c-success/30 bg-c-success/10 text-c-success',
  '1': 'border-c-warning/30 bg-c-warning/10 text-c-warning',
  '2': 'border-c-warning/60 bg-c-warning/20 text-c-warning',
  '3': 'border-c-danger/40 bg-c-danger/10 text-c-danger',
  UNKNOWN: 'border-c-border-subtle bg-c-surface-subtle text-c-text-muted',
};

const ICONS: Record<ExecutionRiskIconId, React.ComponentType<{ size?: number | string; className?: string }>> = {
  ok: CheckCircle2,
  watch: Clock3,
  act: TriangleAlert,
  escalate: ShieldAlert,
  unknown: CircleHelp,
};

export const executionRiskToneClass = (level: ExecutionRiskLevel): string =>
  TONE_BY_LEVEL[String(level)] ?? TONE_BY_LEVEL.UNKNOWN;

/** Krótkie słowo werdyktu — to ono jedzie w pastylce obok ikony. */
export const executionRiskLevelLabel = (level: ExecutionRiskLevel, t: RiskT): string => {
  switch (level) {
    case 0:
      return t('execution.risk.level.0', 'In tolerance');
    case 1:
      return t('execution.risk.level.1', 'Watch');
    case 2:
      return t('execution.risk.level.2', 'Act');
    case 3:
      return t('execution.risk.level.3', 'Escalate');
    default:
      return t('execution.risk.level.unknown', 'Not measured');
  }
};

/** Nazwa osi po ludzku — bez skrótów T/Z/W, których nikt poza raportem nie zna. */
export const executionRiskAxisLabel = (axisId: ExecutionRiskAxisId, t: RiskT): string => {
  switch (axisId) {
    case 'schedule':
      return t('execution.risk.axis.schedule', 'Schedule health');
    case 'impact':
      return t('execution.risk.axis.impact', 'Impact gap');
    default:
      return t('execution.risk.axis.promise', 'Delivery promise');
  }
};

/** Pełne zdanie do podpowiedzi i czytnika ekranu — oś, werdykt, wskaźnik. */
export const executionRiskAxisSentence = (axis: ExecutionRiskAxis, t: RiskT): string => {
  const name = executionRiskAxisLabel(axis.id, t);
  const verdict = executionRiskLevelLabel(axis.level, t);
  if (axis.level === 'UNKNOWN' || axis.ratio === null) {
    const reason =
      axis.reason === 'no-value-baseline'
        ? t('execution.risk.reason.noValueBaseline', 'no value baseline')
        : axis.reason === 'no-cost-baseline'
          ? t('execution.risk.reason.noCostBaseline', 'no cost baseline')
          : axis.reason === 'no-schedule-dates'
            ? t('execution.risk.reason.noScheduleDates', 'no schedule dates')
            : axis.reason === 'no-progress'
              ? t('execution.risk.reason.noProgress', 'no progress value')
              : t('execution.risk.reason.noBaselineData', 'no baseline data');
    return t('execution.risk.axisSentenceUnknownReason', '{{axis}}: not measured — {{reason}}', {
      axis: name,
      reason,
    });
  }
  return t('execution.risk.axisSentence', '{{axis}}: {{verdict}} (index {{ratio}})', {
    axis: name,
    verdict,
    ratio: axis.ratio.toFixed(2),
  });
};

export const ExecutionRiskAxisPill: React.FC<{ axis: ExecutionRiskAxis; t: RiskT }> = ({
  axis,
  t,
}) => {
  const Icon = ICONS[axis.iconId];
  const sentence = executionRiskAxisSentence(axis, t);
  return (
    <span
      data-testid={`execution-risk-axis-${axis.id}`}
      data-risk-level={String(axis.level)}
      className={`flex min-w-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-1.5 py-0.5 text-[11px] font-semibold ${executionRiskToneClass(axis.level)}`}
      title={sentence}
      aria-label={sentence}
    >
      <Icon size={12} className="shrink-0" />
      <span className="truncate">{executionRiskLevelLabel(axis.level, t)}</span>
    </span>
  );
};

/**
 * KOMÓRKA „RISK" = JEDNA PASTYLKA AGREGATU, nie trzy osie.
 *
 * POMIAR (harness `fala-b-bank-realizacji`, 1600 px, dwa zrzuty 14.09):
 *  · próba 1 — trzy pastylki `flex-wrap`: łamały się na trzy linie i wychodziły
 *    poza komórkę na sąsiednią kolumnę,
 *  · próba 2 — siatka 3 × 1 z `width: 300px`: tabela Banku ma PIĘTNAŚCIE kolumn
 *    i jest szersza niż obszar, więc każda kolumna wtórna siada na PODŁODZE
 *    swojego `dataType` (`status` = 130 px) — deklarowane 300 px nie ma
 *    znaczenia (ta sama mechanika, którą opisuje nota szerokości w
 *    `ExecutionBankViews`). Efekt: z każdej pastylki zostawała SAMA IKONA,
 *    czyli DEC-487 („zawsze kolor + tekst + ikona") byłby spełniony wyłącznie
 *    na papierze.
 *
 * DECYZJA: w wierszu stoi agregat (najgorsza ze zmierzonych osi) — kolor +
 * TEKST + ikona mieszczą się w 130 px tak samo jak chip „In execution" obok.
 * Trzy osie osobno żyją w PODGLĄDZIE, gdzie jest na nie miejsce. To ta sama
 * decyzja, którą K5-4 podjęło dla postępu i zdrowia: wiersz niesie stan,
 * podgląd niesie rozbiór.
 *
 * Gdy nie wszystkie osie dało się zmierzyć, pastylka mówi to wprost („2/3"),
 * zamiast udawać pełny pomiar.
 */
export const ExecutionRiskCell: React.FC<{ signal: ExecutionRiskSignal | null; t: RiskT }> = ({
  signal,
  t,
}) => {
  if (!signal) {
    const reason = t('execution.risk.noSignal', 'Risk axes have not been computed for this row');
    return (
      <span className="text-c-text-muted" title={reason} aria-label={reason}>
        —
      </span>
    );
  }
  const Icon = ICONS[signal.worstIconId];
  // Podpowiedź niesie PEŁNY rozbiór — nic nie ginie przez agregację.
  const sentence = signal.axes.map((axis) => executionRiskAxisSentence(axis, t)).join(' · ');
  const coverage =
    signal.measuredAxes < 3
      ? t('execution.risk.coverage', '{{measured}}/3', { measured: signal.measuredAxes })
      : null;
  return (
    <span
      data-testid="execution-risk-aggregate"
      data-risk-level={String(signal.worst)}
      data-risk-measured={String(signal.measuredAxes)}
      className={`flex min-w-0 items-center gap-0.5 overflow-hidden rounded-full border px-1.5 py-0.5 text-[11px] font-semibold ${executionRiskToneClass(signal.worst)}`}
      title={sentence}
      aria-label={sentence}
    >
      <Icon size={12} className="shrink-0" />
      <span className="truncate">{executionRiskLevelLabel(signal.worst, t)}</span>
      {coverage ? (
        <span className="shrink-0 text-[10px] font-normal opacity-80">{coverage}</span>
      ) : null}
    </span>
  );
};

/**
 * H2 — plakietka przekazania. Trzy stany, każdy z tekstem i ikoną:
 *  · ACCEPTED             → „Handed over 12 Sep 2026"
 *  · LINKED_WITHOUT_DATE  → „Handed over (date unknown)"
 *  · ABSENT               → „No handoff" albo, gdy inicjatywa jest w toku,
 *                           OSTRZEŻENIE „In execution without handoff".
 * Sanitizer nie chowa wiersza (reguła: rejestr wygrywa ze statusem wiersza —
 * niezgodność ma być WIDOCZNA, nie zamieciona).
 */
export const ExecutionHandoffBadge: React.FC<{
  handoff: ExecutionBankHandoff;
  formatDate: (value: string) => string;
  t: RiskT;
}> = ({ handoff, formatDate, t }) => {
  if (handoff.status === 'ACCEPTED' && handoff.acceptedAt) {
    /*
     * K5-R3 w tej kolumnie: nagłówek mówi już „Handoff", więc komórka niesie
     * SAMĄ DATĘ, a pełne zdanie („Handed over 2 Apr 2026") idzie w podpowiedź.
     * Powód zmierzony: przy podłodze 130 px (kolumna wtórna siada na podłogę
     * typu `status`) zdanie ucinało się na „Handed over…", czyli komórka
     * gubiła JEDYNĄ niosącą informację — datę.
     */
    const sentence = t('execution.bank.handoff.accepted', 'Handed over {{date}}', {
      date: formatDate(handoff.acceptedAt),
    });
    const label = formatDate(handoff.acceptedAt);
    return (
      <span
        data-testid="execution-bank-handoff"
        data-handoff-status="ACCEPTED"
        className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-c-text-secondary"
        title={sentence}
        aria-label={sentence}
      >
        <Handshake size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    );
  }
  if (handoff.missingForInExecution) {
    // Krótkie słowo w komórce, całe zdanie w podpowiedzi — jak wyżej.
    const label = t('execution.bank.handoff.missingShort', 'Missing');
    const hint = t(
      'execution.bank.handoff.missingInExecutionHint',
      'The initiative reports an execution status, but no accepted handoff package backs it.'
    );
    return (
      <span
        data-testid="execution-bank-handoff"
        data-handoff-status="MISSING"
        className="flex min-w-0 items-center gap-1 overflow-hidden rounded-full border border-c-warning/40 bg-c-warning/10 px-1.5 py-0.5 text-[11px] font-semibold text-c-warning"
        title={hint}
        aria-label={hint}
      >
        <TriangleAlert size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    );
  }
  const label =
    handoff.status === 'LINKED_WITHOUT_DATE'
      ? t('execution.bank.handoff.linkedNoDateShort', 'Date unknown')
      : t('execution.bank.handoff.absent', 'No handoff');
  const hint =
    handoff.status === 'LINKED_WITHOUT_DATE'
      ? t('execution.bank.handoff.linkedNoDate', 'Handed over — acceptance date unknown')
      : t('execution.bank.handoff.absentHint', 'No handoff package has been accepted yet');
  return (
    <span
      data-testid="execution-bank-handoff"
      data-handoff-status={handoff.status}
      className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-c-text-muted"
      title={hint}
      aria-label={hint}
    >
      <Handshake size={12} className="shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
};
