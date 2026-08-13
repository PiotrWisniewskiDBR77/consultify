/**
 * MethodReportView — client-facing Report View (CEL 8 / MPQ, 2026-08-13).
 *
 * Renders strictly from a `ReportSnapshot` (`src/method-core/outputs/
 * reportSnapshot.ts`'s `buildReportSnapshot`) — never a live session, never
 * a screenshot. Before this file, no React component rendered a
 * `ReportSnapshot`/`AssessmentOutput` at all (verified by search — the only
 * UI touching that data model was a raw debug table inside
 * `DrdHttpMethodWorkspaceScreen`'s frozen-state panel).
 *
 * Domain-agnostic like the rest of `method-workspace/`: no DRD/SIRI-specific
 * string appears here — the caller's `ReportSnapshot` supplies unit names,
 * scope, findings.
 *
 * MPQ design decisions (docs/qa/mpq-2026-08-13/MPQ_SCORECARD.md):
 *  1. Each finding's headline is `finding.recommendation` — an action/
 *     conclusion sentence ("Wdroż jednego właściciela procesu…"), never a
 *     section label like "Wyniki osi 1".
 *  2. ONE dominant geometry — a single horizontal gap chart across every
 *     unit, sorted by gap size — not a grid of small stat tiles.
 *  3. current/target/gap are printed as numbers directly on the chart row
 *     (e.g. "2 → 4"), no legend needed to read a single row.
 *  4. An unscored unit (`current === null`) renders as a dashed, neutral-gray
 *     track labelled "Nieocenione" — never the amber/red used for a real gap.
 *  5. Missing evidence (`E0`/no supporting evidence) renders in NEUTRAL gray,
 *     never red — red is reserved for nothing in this view (a Report only
 *     ever contains accepted findings; there is no "blocker" concept here).
 *  6. Level, evidence strength and approval are THREE separate chips with
 *     different shapes/positions — never one dot standing in for all three.
 *  7. Document layout (generous whitespace, one accent color, no bordered
 *     stat-tile grid) — deliberately not an admin dashboard.
 */
import { CheckCircle2, FileText } from 'lucide-react';
import React from 'react';

import type { EvidenceLocator, Finding, ReportSnapshot, ReportUnitResult } from '@/method-core/outputs';
import { evidenceCountLabel } from '@/method-core/outputs/evidencePlural';

export interface MethodReportViewProps {
  report: ReportSnapshot;
  /**
   * The accepted `Finding` objects behind this report's `recommendations`/
   * `unitResults`. `ReportSnapshot` itself does not carry full `Finding`
   * objects (only the extracted strings/numbers — see reportSnapshot.ts) so
   * the caller passes them separately. The caller is responsible for
   * passing ONLY accepted findings (the same filter `buildReportSnapshot`
   * applies internally) — this component does not re-derive approval state,
   * it trusts and labels what it is given.
   */
  findings: readonly Finding[];
  /**
   * Mapa `unitId -> nazwa`. Bez niej karta wniosku pokazuje `finding.unitName`,
   * które bywa równe `unitId` — czyli klientowi wyświetla się `1A`.
   */
  unitNames?: Readonly<Record<string, string>>;
  methodName: string;
  className?: string;
}

function strongestEvidence(evidence: readonly EvidenceLocator[]): EvidenceLocator | null {
  if (evidence.length === 0) return null;
  const order = ['E4', 'E3', 'E2', 'E1', 'E0'];
  return [...evidence].sort((a, b) => order.indexOf(a.strength) - order.indexOf(b.strength))[0];
}

const EVIDENCE_LABEL: Record<string, string> = {
  E0: 'Brak dowodu',
  E1: 'Dowód poszlakowy',
  E2: 'Dowód częściowy',
  E3: 'Dowód udokumentowany',
  E4: 'Dowód zweryfikowany',
};

/** Neutral for every strength — evidence completeness is a fact to state,
 * never a red flag (MPQ criterion 5). Only the LABEL communicates strength. */
function EvidenceChip({ evidence }: { evidence: readonly EvidenceLocator[] }): React.ReactElement {
  const strongest = strongestEvidence(evidence);
  const label = strongest ? EVIDENCE_LABEL[strongest.strength] ?? strongest.strength : 'Brak dowodu';
  return (
    <span
      data-testid="report-evidence-chip"
      className="inline-flex items-center gap-1 rounded-full border border-c-border bg-c-surface px-2 py-0.5 text-[11px] text-c-text-secondary"
    >
      <FileText size={11} className="text-c-text-muted" />
      {label}
    </span>
  );
}

/** Every finding in a ReportSnapshot is already accepted-only
 * (buildReportSnapshot filters at construction) — this chip states that
 * fact plainly rather than implying it through color. Deliberately its own
 * shape (pill + check icon), never the same visual carrier as level/evidence. */
function ApprovalChip(): React.ReactElement {
  return (
    <span
      data-testid="report-approval-chip"
      className="inline-flex items-center gap-1 rounded-full bg-c-success/10 px-2 py-0.5 text-[11px] font-medium text-c-success"
    >
      <CheckCircle2 size={11} />
      Zaakceptowane
    </span>
  );
}

function LevelChip({ current, target }: { current: number | null; target: number | null }): React.ReactElement {
  return (
    <span
      data-testid="report-level-chip"
      className="inline-flex items-center gap-1 rounded-md bg-c-info/10 px-2 py-0.5 text-[11px] font-semibold text-c-info"
    >
      {current ?? '—'} → {target ?? '—'}
    </span>
  );
}

function GapChartRow({ row }: { row: ReportUnitResult }): React.ReactElement {
  const unscored = row.current === null;
  // Per-row proportional scale (not a fixed axis) — each unit's own level
  // scale can differ across method packs; a minimum of 5 keeps small values
  // from rendering as a nearly-full bar.
  const scale = Math.max(row.target ?? 0, row.current ?? 0, 5);
  const pct = (v: number | null) => (v == null ? 0 : Math.min(100, (v / scale) * 100));

  return (
    <div
      data-testid="report-gap-row"
      data-unit-id={row.unitId}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1.5"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-c-text">{row.unitName}</p>
        <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-c-surface-raised">
          {unscored ? (
            <div
              data-testid="report-unscored-track"
              className="absolute inset-y-0 left-0 w-full rounded-full border border-dashed border-c-border-subtle"
              title="Nieocenione — nie oznacza blokera ani problemu."
            />
          ) : (
            <>
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-c-info"
                style={{ width: `${pct(row.current)}%` }}
              />
              {row.target != null && (
                <div
                  className="absolute inset-y-0 w-0.5 bg-c-text"
                  style={{ left: `${pct(row.target)}%` }}
                  title={`Cel: ${row.target}`}
                />
              )}
            </>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {unscored ? (
          <span className="text-[11px] font-medium text-c-text-muted" data-testid="report-unscored-label">
            Nieocenione
          </span>
        ) : (
          <>
            <span className="text-xs font-semibold text-c-text">
              {row.current} → {row.target ?? '—'}
            </span>
            {row.gap != null && (
              <span
                className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  row.gap > 0 ? 'bg-c-warning/10 text-c-warning' : 'bg-c-success/10 text-c-success'
                }`}
              >
                {row.gap > 0 ? `luka ${row.gap}` : 'cel osiągnięty'}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const FindingCard: React.FC<{ finding: Finding; unitLabel: string }> = ({ finding, unitLabel }) => {
  // Criterion 1: the headline IS the conclusion/action, not a section label.
  const actionTitle = finding.recommendation?.trim() || finding.riskOrOpportunity?.trim() || unitLabel;
  return (
    <article data-testid="report-finding-card" className="border-t border-c-border-subtle py-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <LevelChip current={finding.currentLevel} target={finding.targetLevel} />
        <EvidenceChip evidence={finding.supportingEvidence} />
        <ApprovalChip />
      </div>
      <h3 className="text-base font-semibold leading-snug text-c-text">{actionTitle}</h3>
      <p className="mt-1 text-xs uppercase tracking-wide text-c-text-muted">{unitLabel}</p>
      {finding.businessMeaning && <p className="mt-2 text-sm text-c-text-secondary">{finding.businessMeaning}</p>}
    </article>
  );
};

function TextList({ title, items }: { title: string; items: readonly string[] }): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted mb-1.5">{title}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-c-text-secondary leading-snug">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const MethodReportView: React.FC<MethodReportViewProps> = ({ report, findings, unitNames, methodName, className = '' }) => {
  const sortedRows = [...report.unitResults].sort((a, b) => (b.gap ?? -1) - (a.gap ?? -1));
  const findingsByGap = [...findings].sort((a, b) => (b.gap ?? -1) - (a.gap ?? -1));
  // Dowody liczone po UNIKALNYM identyfikatorze — ten sam dokument
  // podpięty pod trzy wnioski to jeden dowód, nie trzy.
  const evidenceCount = new Set(
    findings.flatMap((f) => f.supportingEvidence.map((e) => e.evidenceId))
  ).size;

  return (
    <div data-testid="method-report-view" className={`mx-auto max-w-3xl px-8 py-10 text-c-text ${className}`}>
      {/* Header — document, not dashboard chrome */}
      {/*
        ★ Nagłówek dokumentu to WNIOSEK, nie etykieta zakresu.
        Do 2026-08-13 `<h1>` niósł `report.scope` („Sesja <uuid> — drd@2.0.0…"),
        a prawdziwy wniosek był zepchnięty do akapitu pod spodem. To odwrotność
        kanonu materiału doradczego — i niespójność wewnątrz jednego builda, bo
        `MethodPresentationView` (ten sam autor, ten sam dzień) robił to już
        poprawnie. Zakres schodzi do metadanych, gdzie jego miejsce.
      */}
      <header className="mb-8 border-b border-c-border pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-c-info">{methodName}</p>
        <h1
          className="mt-1 text-2xl font-bold leading-tight text-c-text"
          data-testid="report-action-title"
        >
          {report.executiveSummary}
        </h1>
        <p className="mt-2 text-xs text-c-text-muted">
          {report.scope} · Metodyka {report.methodology.methodPackId} {report.methodology.version} · Uczestnicy: {report.participants.join(', ') || '—'}
        </p>
      </header>

      {/* ONE dominant geometry: gap chart across every unit, worst gap first */}
      <section className="mb-10" aria-label="Bieżący vs docelowy poziom, wszystkie jednostki">
        <h2 className="text-sm font-semibold text-c-text mb-3">Bieżący i docelowy poziom</h2>
        <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
          {sortedRows.map((row) => (
            <GapChartRow key={row.unitId} row={row} />
          ))}
        </div>
      </section>

      {/* Findings — each headline is a conclusion, not a label (criterion 1) */}
      {findingsByGap.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-c-text mb-1">Wnioski</h2>
          {findingsByGap.map((finding) => (
            <FindingCard key={finding.id} finding={finding} unitLabel={unitNames?.[finding.unitId] ?? finding.unitName} />
          ))}
        </section>
      )}

      <div className="grid grid-cols-2 gap-8 mb-10">
        <TextList title="Mocne strony" items={report.strengths} />
        <TextList title="Ryzyka i luki" items={report.gapsAndRisks} />
      </div>

      {report.limitations.length > 0 && (
        <div className="mt-10 rounded-lg border border-c-border-subtle bg-c-surface-raised p-3">
          <TextList title="Ograniczenia" items={report.limitations} />
        </div>
      )}

      {/*
        ★ Stopka kanonu materiału doradczego: liczba dowodów źródłowych +
        klauzula poufności + data. Do 2026-08-13 były tu tylko id i wersja —
        mimo że `MethodPresentationView` miał komplet. Klient musi widzieć,
        na ilu dowodach stoi dokument i czy wolno go przekazać dalej.
      */}
      <footer className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-c-border-subtle pt-4 text-[11px] text-c-text-muted">
        <span data-testid="report-evidence-count">{evidenceCountLabel(evidenceCount)}</span>
        <span aria-hidden="true">·</span>
        <span data-testid="report-confidentiality">🔒 Materiał dla klienta</span>
        <span aria-hidden="true">·</span>
        <span>Stan na {new Date(report.createdAt).toLocaleDateString('pl-PL')}</span>
        <span aria-hidden="true">·</span>
        {/* ★ Skrócony identyfikator — pełny UUID w materiale dla klienta to
            szum, a nie informacja. Pełna wartość zostaje w `title` dla kogoś,
            kto naprawdę musi go odczytać. */}
        <span title={`Output ${report.outputId}`}>
          Output {report.outputId.slice(0, 8)} · wersja {report.outputVersion}
        </span>
      </footer>
    </div>
  );
};

export default MethodReportView;
