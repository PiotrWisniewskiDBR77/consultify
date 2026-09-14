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

type RiskT = (key: string, defaultValue: string, vars?: Record<string, unknown>) => string;

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
    return t('execution.risk.axisSentenceUnknown', '{{axis}}: not measured — no baseline data', {
      axis: name,
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
      className={`inline-flex min-w-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold ${executionRiskToneClass(axis.level)}`}
      title={sentence}
      aria-label={sentence}
    >
      <Icon size={12} className="shrink-0" />
      <span className="truncate">{executionRiskLevelLabel(axis.level, t)}</span>
    </span>
  );
};

/**
 * Trzy pastylki w komórce tabeli. Brak sygnału (flaga ON, ale raport nie zna
 * tej inicjatywy) to MYŚLNIK z powodem w podpowiedzi — kanon C7, nie pusta
 * komórka i nie udawana zieleń.
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
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {signal.axes.map((axis) => (
        <ExecutionRiskAxisPill key={axis.id} axis={axis} t={t} />
      ))}
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
    const label = t('execution.bank.handoff.accepted', 'Handed over {{date}}', {
      date: formatDate(handoff.acceptedAt),
    });
    return (
      <span
        data-testid="execution-bank-handoff"
        data-handoff-status="ACCEPTED"
        className="inline-flex min-w-0 items-center gap-1 text-xs text-c-text-secondary"
        title={label}
      >
        <Handshake size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    );
  }
  if (handoff.missingForInExecution) {
    const label = t('execution.bank.handoff.missingInExecution', 'In execution without handoff');
    const hint = t(
      'execution.bank.handoff.missingInExecutionHint',
      'The initiative reports an execution status, but no accepted handoff package backs it.'
    );
    return (
      <span
        data-testid="execution-bank-handoff"
        data-handoff-status="MISSING"
        className="inline-flex min-w-0 items-center gap-1 rounded-full border border-c-warning/40 bg-c-warning/10 px-1.5 py-0.5 text-[11px] font-semibold text-c-warning"
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
      ? t('execution.bank.handoff.linkedNoDate', 'Handed over (date unknown)')
      : t('execution.bank.handoff.absent', 'No handoff');
  return (
    <span
      data-testid="execution-bank-handoff"
      data-handoff-status={handoff.status}
      className="inline-flex min-w-0 items-center gap-1 text-xs text-c-text-muted"
      title={label}
    >
      <Handshake size={12} className="shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
};
