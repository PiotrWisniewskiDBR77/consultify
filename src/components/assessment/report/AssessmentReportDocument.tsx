/**
 * AssessmentReportDocument — pure renderer of a frozen Assessment Output.
 *
 * ★ HARD RULE (task brief): this component is a RENDERER, not a calculator.
 * Every number shown here is read verbatim from `data.output` (the
 * immutable `method_outputs` / `method_findings` snapshot) or from
 * adjacent, already-persisted facts (`data.session`, `data.approvals`).
 * Nothing is re-derived from `method_events`, nothing is re-scored against
 * a method pack. The only "computation" this file performs on numbers is:
 *   - counting/partitioning existing frozen values (e.g. "how many findings
 *     have gap > 0") — reading, not scoring;
 *   - `maturityBands.describeMaturityPosition` — a display-only banding of
 *     an existing number into one of 5 fixed phrases (same class of
 *     operation as a progress bar picking a colour from a percentage).
 *
 * Zero crimson brand-accent token, zero `primary-*` — signal tones only via
 * `StatusChip` (`c-info`/`c-success`/`c-warning`/`c-danger`), focus via
 * `c-focus`. The per-dimension table is `StandardTable` — no bespoke,
 * hand-rolled table markup.
 *
 * Licence boundary: does NOT render DRD's curated level titles/definitions
 * (see `drdLabels.ts` header comment) — only structural labels (area/axis
 * name) and generic, non-method-specific interpretive wording
 * (`maturityBands.ts`).
 */
import { AlertTriangle, CheckCircle2, FileWarning, HelpCircle, Lightbulb, ShieldAlert } from 'lucide-react';
import React, { useMemo } from 'react';

import { StandardTable, type TableColumn, type TableRow } from '../../standard/StandardTable';
import { StatusChip } from '../../ui/primitives/chips';
import { resolveDrdUnitLabel } from './drdLabels';
import { describeMaturityPosition } from './maturityBands';
import type { AssessmentReportData, ReportFinding } from './types';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

const SectionCard: React.FC<{
  title: string;
  eyebrow?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  id?: string;
}> = ({ title, eyebrow, icon: Icon, children, id }) => (
  <section
    id={id}
    className="rounded-2xl border border-c-border-subtle bg-c-surface p-5 sm:p-6"
    aria-labelledby={id ? `${id}-heading` : undefined}
  >
    <div className="mb-4 flex items-center gap-2">
      {Icon ? <Icon size={16} className="shrink-0 text-c-text-muted" aria-hidden="true" /> : null}
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">{eyebrow}</p>
        ) : null}
        <h2 id={id ? `${id}-heading` : undefined} className="text-sm font-semibold text-c-text">
          {title}
        </h2>
      </div>
    </div>
    {children}
  </section>
);

const Property: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-medium uppercase tracking-wide text-c-text-muted">{label}</dt>
    <dd className={`mt-0.5 truncate text-sm text-c-text ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</dd>
  </div>
);

/** Two-tone bar (current vs target) over a unit's own pinned level scale.
 * Purely a visual re-expression of numbers already in `data.output.current`
 * / `.target` — no new value is computed. */
const LevelBar: React.FC<{
  current: number | null;
  target: number | null;
  min: number;
  max: number;
}> = ({ current, target, min, max }) => {
  const range = Math.max(1, max - min);
  const pct = (v: number | null): number | null =>
    v === null ? null : Math.min(100, Math.max(0, ((v - min) / range) * 100));
  const currentPct = pct(current);
  const targetPct = pct(target);
  return (
    <div
      className="relative h-2 w-full min-w-[96px] rounded-full bg-c-surface-raised"
      role="img"
      aria-label={`Poziom obecny ${current ?? 'brak'}, cel ${target ?? 'brak'}, skala ${min}-${max}`}
    >
      {currentPct !== null ? (
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-c-info"
          style={{ width: `${currentPct}%` }}
        />
      ) : null}
      {targetPct !== null ? (
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-c-success"
          style={{ left: `${targetPct}%` }}
          title="Cel"
        />
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export interface AssessmentReportDocumentProps {
  data: AssessmentReportData;
}

export const AssessmentReportDocument: React.FC<AssessmentReportDocumentProps> = ({ data }) => {
  const { output, session, approvals, superseded, supersededByOutputId } = data;

  const latestApproval = useMemo(() => {
    const approved = approvals.filter((a) => a.decision === 'approved');
    if (approved.length === 0) return null;
    return [...approved].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [approvals]);

  // Every unit the Output touched — union of current/target/gap keys, NOT
  // just `findings` (a unit without accepted evidence still appears here,
  // with `hasFinding: false` — this is what powers §5 "nie wiem").
  const unitIds = useMemo(() => {
    const set = new Set<string>([
      ...Object.keys(output.current ?? {}),
      ...Object.keys(output.target ?? {}),
      ...Object.keys(output.gap ?? {}),
    ]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [output.current, output.target, output.gap]);

  const findingByUnit = useMemo(() => {
    const map = new Map<string, ReportFinding>();
    for (const f of output.findings ?? []) map.set(f.unitId, f);
    return map;
  }, [output.findings]);

  const dimensionRows: TableRow[] = useMemo(
    () =>
      unitIds.map((unitId) => {
        const label = resolveDrdUnitLabel(output.methodPackId, output.methodPackVersion, unitId);
        const finding = findingByUnit.get(unitId) ?? null;
        const current = output.current?.[unitId] ?? null;
        const target = output.target?.[unitId] ?? null;
        const gap = output.gap?.[unitId] ?? null;
        const band = label ? describeMaturityPosition(current, Math.min(...label.levelScale), Math.max(...label.levelScale)) : null;
        return {
          id: unitId,
          unitId,
          unitName: label?.unitName ?? finding?.unitName ?? unitId,
          axisName: label?.axisName ?? '—',
          current,
          target,
          gap,
          bandLabel: band?.label ?? null,
          hasFinding: !!finding,
          scaleMin: label ? Math.min(...label.levelScale) : null,
          scaleMax: label ? Math.max(...label.levelScale) : null,
        } as TableRow;
      }),
    [unitIds, findingByUnit, output.methodPackId, output.methodPackVersion, output.current, output.target, output.gap]
  );

  const dimensionColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'unitName',
        label: 'Jednostka oceny',
        sortable: true,
        render: (row) => (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-c-text">{row.unitName as string}</div>
            <div className="truncate text-[11px] font-mono text-c-text-muted">{row.unitId as string}</div>
          </div>
        ),
      },
      { id: 'axisName', label: 'Wymiar (oś)', width: '160px', sortable: true },
      {
        id: 'levels',
        label: 'Obecny / Cel',
        width: '220px',
        render: (row) => (
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs tabular-nums text-c-text">
              {row.current === null || row.current === undefined ? '—' : String(row.current)}
              {' / '}
              {row.target === null || row.target === undefined ? '—' : String(row.target)}
            </span>
            {row.scaleMin !== null && row.scaleMax !== null ? (
              <LevelBar
                current={row.current as number | null}
                target={row.target as number | null}
                min={row.scaleMin as number}
                max={row.scaleMax as number}
              />
            ) : null}
          </div>
        ),
      },
      {
        id: 'gap',
        label: 'Luka',
        width: '90px',
        sortable: true,
        render: (row) => {
          const gap = row.gap as number | null;
          if (gap === null || gap === undefined) return <span className="text-c-text-muted">—</span>;
          const tone = gap > 0 ? 'text-c-danger' : 'text-c-success';
          return <span className={`text-xs font-semibold tabular-nums ${tone}`}>{gap > 0 ? `+${gap}` : gap}</span>;
        },
      },
      {
        id: 'bandLabel',
        label: 'Pozycja na skali',
        width: '170px',
        render: (row) => (row.bandLabel ? <span className="text-xs text-c-text-secondary">{row.bandLabel as string}</span> : <span className="text-c-text-muted">—</span>),
      },
      {
        id: 'hasFinding',
        label: 'Dowody',
        width: '150px',
        render: (row) =>
          row.hasFinding ? (
            <StatusChip label="Potwierdzone dowodem" tone="success" size="sm" />
          ) : (
            <StatusChip label="Brak dowodu" tone="warning" size="sm" />
          ),
      },
    ],
    []
  );

  const strengths = useMemo(
    () => (output.findings ?? []).filter((f) => f.gap === null || f.gap <= 0),
    [output.findings]
  );
  const gaps = useMemo(
    () => [...(output.findings ?? [])].filter((f) => f.gap !== null && f.gap > 0).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0)),
    [output.findings]
  );

  const unitsWithoutFinding = useMemo(
    () => unitIds.filter((id) => !findingByUnit.has(id)),
    [unitIds, findingByUnit]
  );

  const recommendations = useMemo(
    () => [...(output.findings ?? [])].sort((a, b) => (b.gap ?? -Infinity) - (a.gap ?? -Infinity)),
    [output.findings]
  );

  const evidenceRows = useMemo(() => {
    const rows: { id: string; unitId: string; unitName: string; evidenceId: string; evidenceType: string; strength: string; locator: string }[] = [];
    for (const f of output.findings ?? []) {
      for (const ev of f.supportingEvidence ?? []) {
        rows.push({
          id: `${f.id}:${ev.evidenceId}`,
          unitId: f.unitId,
          unitName: f.unitName,
          evidenceId: ev.evidenceId,
          evidenceType: ev.evidenceType,
          strength: ev.strength,
          locator: ev.locator,
        });
      }
    }
    return rows;
  }, [output.findings]);

  const aggregation = output.aggregation ?? null;
  const aggregationEntries = aggregation?.byGroup ? Object.entries(aggregation.byGroup) : [];
  const evidenceCompleteness = output.evidenceCompleteness ?? null;

  const lifecycleTone = superseded ? 'neutral' : 'success';
  const lifecycleLabel = superseded ? 'Zamrożony — zastąpiony nowszą rewizją' : 'Zamrożony (niezmienny)';

  return (
    <article className="mx-auto flex max-w-[880px] flex-col gap-4 pb-16">
      {/* ── Demo bypass banner — never hidden (CLAUDE.md #7) ───────────── */}
      {output.demoBypassActive ? (
        <div className="flex items-start gap-2 rounded-xl border border-c-warning/40 bg-c-warning/10 px-4 py-3 text-xs text-c-warning">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            Ten Output pochodzi z sesji utworzonej przez tryb demo (ominięcie bramki gotowości pakietu). To
            NIE jest wynik produkcyjny — nie może być przedstawiony jako zatwierdzony wynik pilota/produkcji.
          </p>
        </div>
      ) : null}

      {/* ── 1. Header ───────────────────────────────────────────────────── */}
      <header className="rounded-2xl border border-c-border-subtle bg-c-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              Raport oceny dojrzałości
            </p>
            <h1 className="mt-1 text-lg font-semibold text-c-text">
              {output.methodPackId.toUpperCase()} · {output.methodPackVersion}
            </h1>
            <p className="mt-1 text-xs text-c-text-secondary">{output.scope}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <StatusChip label={lifecycleLabel} tone={lifecycleTone} />
            {output.demoBypassActive ? <StatusChip label="Tryb demo" tone="warning" /> : null}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Property label="Projekt" value={session?.projectId ?? 'Brak przypisanego projektu'} mono={!!session?.projectId} />
          <Property label="Sesja" value={output.sessionId} mono />
          <Property label="Wersja Outputu" value={`v${output.outputVersion}`} />
          <Property label="Data zamrożenia" value={formatDateTime(output.frozenAt)} />
          <Property
            label="Zatwierdził"
            value={
              latestApproval ? (
                <span>
                  <span className="font-mono text-[12px]">{latestApproval.actorUserId}</span>
                  {' · '}
                  {formatDate(latestApproval.createdAt)}
                </span>
              ) : (
                <span className="italic text-c-text-muted">Brak zarejestrowanego zatwierdzenia</span>
              )
            }
          />
          <Property label="Moduł" value={output.module} />
        </dl>

        {superseded ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs text-c-text-secondary">
            <FileWarning size={14} className="mt-0.5 shrink-0 text-c-text-muted" aria-hidden="true" />
            <span>
              Ten Output został zastąpiony nowszą rewizją{supersededByOutputId ? ` (${supersededByOutputId})` : ''}.
              Poniższa treść pozostaje niezmiennym zapisem TEJ rewizji — nie jest aktualizowana.
            </span>
          </div>
        ) : null}
      </header>

      {/* ── Ograniczenia i założenia — widoczne od razu, nie schowane ──── */}
      {output.limitations && output.limitations.length > 0 ? (
        <SectionCard id="limitations" title="Ograniczenia i założenia" icon={AlertTriangle}>
          <ul className="list-disc space-y-1.5 pl-5 text-xs text-c-text-secondary">
            {output.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {/* ── 2. Wynik ogólny ─────────────────────────────────────────────── */}
      <SectionCard id="overall" title="Wynik ogólny" icon={CheckCircle2}>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat label="Ocenionych jednostek" value={unitIds.length} />
          <SummaryStat label="Z potwierdzonym dowodem" value={output.findings?.length ?? 0} />
          <SummaryStat label="Bez przyjętego dowodu" value={unitsWithoutFinding.length} />
          <SummaryStat label="Jednostek z luką" value={gaps.length} />
        </div>
        {aggregationEntries.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              Wynik per wymiar (oś)
            </p>
            {aggregationEntries.map(([axisId, value]) => {
              const targetsInAxis = Object.entries(output.gap ?? {});
              void targetsInAxis;
              return (
                <div key={axisId} className="flex items-center justify-between gap-3 rounded-lg border border-c-border-subtle px-3 py-2">
                  <span className="text-xs font-medium text-c-text">{axisId}</span>
                  <span className="text-xs tabular-nums text-c-text-secondary">
                    {value === null ? '—' : value}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs italic text-c-text-muted">
            Ten Output nie zawiera zagregowanego wyniku per wymiar (oś) — kernel liczy tę agregację poza
            momentem zamrożenia (patrz „Ograniczenia i założenia" powyżej). Poniżej pełny wynik per
            jednostka, z których taka agregacja by się składała.
          </p>
        )}
      </SectionCard>

      {/* ── 3. Wynik per jednostka ──────────────────────────────────────── */}
      <SectionCard id="dimensions" title="Wynik per jednostka oceny" icon={CheckCircle2}>
        <StandardTable columns={dimensionColumns} data={dimensionRows} minTableWidth="auto" persistKey="assessment.report.dimensions" />
      </SectionCard>

      {/* ── 4. Mocne strony i luki ──────────────────────────────────────── */}
      <SectionCard id="strengths-gaps" title="Mocne strony i luki" icon={Lightbulb}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-c-success">
              Mocne strony ({strengths.length})
            </p>
            <ul className="space-y-2">
              {strengths.length === 0 ? (
                <li className="text-xs italic text-c-text-muted">Brak jednostek bez luki w tym Outpucie.</li>
              ) : (
                strengths.map((f) => (
                  <li key={f.id} className="rounded-lg border border-c-border-subtle px-3 py-2">
                    <p className="text-xs font-medium text-c-text">
                      {f.unitName} <span className="font-mono text-c-text-muted">({f.unitId})</span>
                    </p>
                    <p className="mt-0.5 text-xs text-c-text-secondary">{f.businessMeaning}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-c-danger">
              Luki ({gaps.length})
            </p>
            <ul className="space-y-2">
              {gaps.length === 0 ? (
                <li className="text-xs italic text-c-text-muted">Brak zidentyfikowanych luk w tym Outpucie.</li>
              ) : (
                gaps.map((f) => (
                  <li key={f.id} className="rounded-lg border border-c-border-subtle px-3 py-2">
                    <p className="text-xs font-medium text-c-text">
                      {f.unitName} <span className="font-mono text-c-text-muted">({f.unitId})</span>
                      <span className="ml-2 text-c-danger">luka {f.gap}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-c-text-secondary">{f.riskOrOpportunity ?? f.businessMeaning}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </SectionCard>

      {/* ── 5. Odpowiedzi „nie wiem" / brak dowodu ───────────────────────── */}
      <SectionCard id="unknowns" title="Brak wiedzy w organizacji („nie wiem” / brak dowodu)" icon={HelpCircle}>
        <p className="mb-3 text-xs text-c-text-secondary">
          To nie jest „zero punktów" — to osobna, diagnostyczna kategoria: organizacja nie potrafiła w
          momencie oceny dostarczyć wystarczającego dowodu dla poniższych jednostek. Zamrożony Output nie
          rozróżnia dziś „odpowiedziano nie wiem" od „nikt jeszcze nie odpowiedział" na poziomie pojedynczej
          jednostki (patrz „Ograniczenia i założenia") — poniższa lista pokazuje jednostki BEZ przyjętego
          dowodu, czyli obie te sytuacje razem, uczciwie nierozróżnione.
        </p>
        {evidenceCompleteness ? (
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Jednostek łącznie" value={evidenceCompleteness.totalUnits} />
            <SummaryStat label="Z przyjętym dowodem" value={evidenceCompleteness.unitsWithAcceptedEvidence} />
            <SummaryStat label="Bez przyjętego dowodu" value={evidenceCompleteness.unitsMissingEvidence} />
            <SummaryStat
              label="Kompletność dowodowa"
              value={`${Math.round((evidenceCompleteness.completenessRatio ?? 0) * 100)}%`}
            />
          </div>
        ) : null}
        {unitsWithoutFinding.length === 0 ? (
          <p className="text-xs italic text-c-text-muted">Każda oceniana jednostka ma przyjęty dowód.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {unitsWithoutFinding.map((unitId) => {
              const label = resolveDrdUnitLabel(output.methodPackId, output.methodPackVersion, unitId);
              return (
                <li
                  key={unitId}
                  className="rounded-full border border-c-warning/40 bg-c-warning/10 px-2.5 py-1 text-[11px] font-medium text-c-warning"
                  title={unitId}
                >
                  {label?.unitName ?? unitId}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* ── 6. Dowody ───────────────────────────────────────────────────── */}
      <SectionCard id="evidence" title="Dowody" icon={FileWarning}>
        {evidenceRows.length === 0 ? (
          <p className="text-xs italic text-c-text-muted">Ten Output nie ma zarejestrowanych dowodów.</p>
        ) : (
          <StandardTable
            columns={[
              { id: 'unitName', label: 'Kryterium', render: (row) => (
                <span className="text-xs text-c-text">
                  {row.unitName as string} <span className="font-mono text-c-text-muted">({row.unitId as string})</span>
                </span>
              ) },
              { id: 'evidenceType', label: 'Typ dowodu', width: '140px' },
              {
                id: 'strength',
                label: 'Siła',
                width: '90px',
                render: (row) => <span className="font-mono text-xs">{row.strength as string}</span>,
              },
              { id: 'locator', label: 'Lokalizacja / odniesienie', render: (row) => (
                <span className="truncate font-mono text-[11px] text-c-text-muted">{row.locator as string}</span>
              ) },
            ]}
            data={evidenceRows}
            minTableWidth="auto"
            persistKey="assessment.report.evidence"
          />
        )}
      </SectionCard>

      {/* ── 7. Rekomendacje priorytetowe ────────────────────────────────── */}
      <SectionCard id="recommendations" title="Rekomendacje priorytetowe" icon={Lightbulb}>
        {recommendations.length === 0 ? (
          <p className="text-xs italic text-c-text-muted">Brak rekomendacji w tym Outpucie.</p>
        ) : (
          <ol className="space-y-3">
            {recommendations.map((f, idx) => (
              <li key={f.id} className="rounded-lg border border-c-border-subtle px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-c-text">
                    {idx + 1}. {f.unitName} <span className="font-mono text-c-text-muted">({f.unitId})</span>
                  </p>
                  {f.gap !== null ? (
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-c-danger">luka {f.gap}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-c-text-secondary">{f.recommendation}</p>
                {f.priorityRationale ? (
                  <p className="mt-1 text-[11px] italic text-c-text-muted">Uzasadnienie priorytetu: {f.priorityRationale}</p>
                ) : null}
                {f.expectedOutcome ? (
                  <p className="mt-1 text-[11px] text-c-text-muted">Oczekiwany efekt: {f.expectedOutcome}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      {/* ── 8. Stopka ───────────────────────────────────────────────────── */}
      <footer className="rounded-2xl border border-c-border-subtle bg-c-surface-raised p-5 text-[11px] text-c-text-muted">
        <p className="mb-2 font-semibold text-c-text-secondary">
          Ten dokument jest odczytem zamrożonego, niezmiennego Outputu. Treść nie jest przeliczana przy
          wyświetlaniu — pokazuje dokładnie to, co zostało zatwierdzone w momencie zamrożenia.
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Property label="Identyfikator Outputu" value={output.id} mono />
          <Property label="Skrót treści (hash)" value={output.contentHash} mono />
          <Property label="Wersja Outputu" value={`v${output.outputVersion}`} />
          <Property label="Zamrożono" value={formatDateTime(output.frozenAt)} />
        </dl>
      </footer>
    </article>
  );
};

const SummaryStat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">{label}</p>
    <p className="mt-0.5 text-lg font-semibold tabular-nums text-c-text">{value}</p>
  </div>
);

export default AssessmentReportDocument;
