/**
 * Step 1/7 — Source (OWN-FIN-021 point 1): the valuation must point at an exact, APPROVED,
 * immutable Baseline/Scenario version — never "latest" — and lineage must PROVE it.
 *
 * ★ GAP CLOSED 2026-09-05 (decyzja właściciela). Until this date there was no HTTP endpoint under
 * `/api/v8/finance-v2/*` that CREATED the lineage edge this step displays, so this step could only
 * render pre-existing edges and otherwise print a dead-end warning — measured live in round 4 of
 * the 05.09 acceptance: all three APPROVED CD PROJEKT valuations stuck on „Źródło ZABLOKOWANE",
 * with the Results tab unreachable for EVERY valuation record in the org. The write path now
 * exists (`POST /valuation/variants/:businessVersionId/source`, rules in
 * `server/src/services/finance/canonical/valuationSourceBindingService.ts`) and the empty state is
 * a real chooser over APPROVED Baseline/Scenario versions instead of an apology.
 *
 * ★ What the chooser deliberately does NOT offer: changing an existing source.
 * `finance_lineage_edges` is append-only at the DB level (`trg_finance_lineage_no_update` /
 * `trg_finance_lineage_no_delete`), so once a valuation has a source, the chooser is gone and the
 * chain is shown read-only — the remedy for a wrong source is a new valuation version, and
 * pretending otherwise would be a button that always 409s.
 *
 * ★ FIXC (martwa przestrzeń, gate-e): `getAncestors()` (`lineageService.ts`) walks the FULL
 * lineage chain with a recursive CTE (`WITH RECURSIVE ancestors ... JOIN ancestors a ON
 * e.target_version_id = a.source_version_id`, depth up to 50) — a real valuation typically
 * descends from Statement Pack -> Baseline -> Scenario, i.e. `lineage.ancestors` legitimately
 * holds MULTIPLE edges. This step previously read only `lineage.ancestors[0]`, silently dropping
 * every edge past the first — real, already-fetched data that never reached the screen. That is
 * what the dead-space audit (`AP_MOUNT_report.md` §"Audyt martwej przestrzeni") had misread as
 * "only 4 lineage facts exist to show": the facts existed, the component just never rendered
 * them. Fixed by mapping over the whole array — see `FIXC_LAYOUT_report.md`.
 *
 * ★ FIXC also drops the `max-w-5xl` cap this step still carried (same defect class as the six
 * sibling steps fixed in `e36d275410`, just not caught in that pass because it only measured
 * width, and Source's remaining shortfall after that fix was mostly HEIGHT, not width) — a
 * multi-card lineage chain benefits from the full available width for its 4-column fact grid,
 * same as the other six steps already do at `max-w-5xl`.
 *
 * ★ 2026-08-26 night-fixes-a P0 (NIGHT_SWEEP_A_REPORT_20260826.md #2): the per-edge card used to
 * put the raw database graph — `edge-*` ids, `sha256:*` hashes, `run-*` compute ids, `user-*`
 * author ids — front and center as the card's MAIN content, handed straight to a CFO/owner. That
 * is exactly the "zero żargonu deweloperskiego w UI" line the module's own review card draws.
 * Fixed by splitting each step into a readable headline (artifact type -> artifact type, the
 * human date, the already-localized transformation kind) and folding every raw identifier
 * (`edgeId`/`sourceVersionId`/`targetVersionId`/`assumptionSnapshotHash`/`computeRunId`/
 * `authorId`/raw `edgeType`) into a collapsed native `<details>` "Szczegóły techniczne" section —
 * still fully honest (nothing hidden, nothing invented: there is no user-directory wired into this
 * workspace to resolve `authorId` to a real name, so it stays labeled as an ID rather than being
 * dressed up as a name), just not the primary thing the reader's eye lands on.
 */
import { ChevronRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { MENU_3_ACTION_NEUTRAL } from '@/components/shared/ModuleMenu3';

import {
  describeFinanceV2Error,
  financeArtifactTypeLabel,
  financeLineageTransformationKindLabel,
  type ValuationLineageDto,
  type ValuationSourceKind,
  type ValuationVariantDto,
} from '@/services/api/financeV2.types';

/** One selectable source: an exact, APPROVED Baseline/Scenario business version. */
export interface ValuationSourceOption {
  sourceKind: ValuationSourceKind;
  businessVersionId: string;
  /** Already-human label built by the caller (artifact name + version number). */
  label: string;
}

export interface SourceStepProps {
  businessVersionId: string;
  variant: ValuationVariantDto | null;
  lineage: ValuationLineageDto | null;
  /**
   * Loads the APPROVED Baseline/Scenario versions this valuation may point at. Omitted (undefined)
   * = the host does not offer binding at all, and the empty state stays purely informational —
   * that is what keeps this component honest in hosts that have no write path.
   */
  loadSourceOptions?: () => Promise<ValuationSourceOption[]>;
  /** Writes the binding and re-fetches the lineage. Rejects with a FinanceV2 API error on refusal. */
  onBindSource?: (params: { sourceKind: ValuationSourceKind; sourceVersionId: string }) => Promise<void>;
}

/**
 * `edgeType` (`ValuationLineageEdgeType = string`, financeV2.types.ts) is open-ended free text —
 * no dedicated label helper exists for it anywhere in the codebase (the one other renderer,
 * `RelatedArtifactsSection.tsx`, shows it raw too). Still, never paint a bare SCREAMING_SNAKE_CASE
 * token — apply the SAME readable fallback `financeLineageTransformationKindLabel` already uses
 * for an unrecognized `transformationKind`, so `VALUATION_SOURCE`/`derived_from` both render as
 * plain sentence-case text instead of a raw code.
 */
function formatFreeformLineageCode(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** Human date for the provenance headline — `pl-PL`, matches the format `FinancialStatementImportWizard.tsx` already uses for a lineage timestamp elsewhere in Finance. */
function formatLineageDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium' }).format(parsed);
}

export function SourceStep(props: SourceStepProps): React.ReactElement {
  const { businessVersionId, variant, lineage, loadSourceOptions, onBindSource } = props;
  const { t } = useTranslation();
  // ★ FIXC: full chain, chronological (root/oldest first) — the DB query has no ORDER BY of its
  // own (`SELECT DISTINCT ... FROM ancestors`, see `lineageService.ts`), so this component owns
  // the display order rather than depending on incidental SQL row order.
  const sourceEdges = lineage
    ? [...lineage.ancestors].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];
  const immediateEdge = sourceEdges[sourceEdges.length - 1] ?? null;

  const canBind = typeof loadSourceOptions === 'function' && typeof onBindSource === 'function';
  const missingSource = lineage !== null && sourceEdges.length === 0;

  const [options, setOptions] = React.useState<ValuationSourceOption[] | null>(null);
  const [optionsError, setOptionsError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [bindError, setBindError] = React.useState<string | null>(null);

  // Only fetch the candidate list once the empty state is actually on screen — a valuation that
  // already has its source never pays for this call.
  React.useEffect(() => {
    if (!missingSource || !canBind || !loadSourceOptions) return;
    let cancelled = false;
    setOptionsError(null);
    loadSourceOptions()
      .then((next) => {
        if (!cancelled) setOptions(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setOptions([]);
          setOptionsError(describeFinanceV2Error(err).detail);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [missingSource, canBind, loadSourceOptions]);

  const baselineOptions = (options ?? []).filter((o) => o.sourceKind === 'baseline');
  const scenarioOptions = (options ?? []).filter((o) => o.sourceKind === 'scenario');

  async function handleBind(): Promise<void> {
    if (!onBindSource || !selected) return;
    const chosen = (options ?? []).find(
      (o) => `${o.sourceKind}:${o.businessVersionId}` === selected
    );
    if (!chosen) return;
    setSaving(true);
    setBindError(null);
    try {
      await onBindSource({ sourceKind: chosen.sourceKind, sourceVersionId: chosen.businessVersionId });
    } catch (err: unknown) {
      setBindError(describeFinanceV2Error(err).detail);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-4" data-testid="valuation-source-step">
      <h2 className="text-sm font-semibold text-c-text">Źródło wyceny</h2>
      <p className="text-xs text-c-text-muted">
        Ta wersja wyceny (<span className="font-mono">{businessVersionId}</span>
        {variant ? `, wariant „${variant.name}"` : ''}) musi wskazywać dokładną, zatwierdzoną wersję
        Baseline/Scenario — nigdy „najnowszą". Poniżej pokazujemy realny, pełny łańcuch pochodzenia
        (lineage) z rejestru, nie deklarację.
      </p>

      {lineage === null && (
        <p className="text-xs text-c-text-muted" data-testid="source-step-loading">
          Wczytywanie powiązania źródła…
        </p>
      )}

      {lineage && sourceEdges.length > 0 && (
        <div className="space-y-3" data-testid="source-edge-present">
          <p className="text-sm text-c-text">
            Powiązano z{' '}
            {immediateEdge ? financeArtifactTypeLabel(immediateEdge.sourceArtifactType) : 'źródłem'}
            {immediateEdge ? ` z ${formatLineageDate(immediateEdge.createdAt)}` : ''} przez łańcuch{' '}
            {sourceEdges.length} {sourceEdges.length === 1 ? 'powiązania' : 'powiązań'} pochodzenia.
          </p>
          {sourceEdges.map((edge, index) => (
            <div
              key={edge.edgeId}
              className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
              data-testid={`source-edge-${edge.edgeId}`}
            >
              <p className="text-sm font-medium text-c-text">
                Krok {index + 1}/{sourceEdges.length}: {financeArtifactTypeLabel(edge.sourceArtifactType)}
                {' → '}
                {financeArtifactTypeLabel(edge.targetArtifactType)}
              </p>
              <p className="mt-1 text-xs text-c-text-muted">
                Utworzono {formatLineageDate(edge.createdAt)} ·{' '}
                {financeLineageTransformationKindLabel(edge.transformationKind)}
              </p>

              {/* ★ 2026-09-02 — „Szczegóły techniczne" było gołym słowem
                  z natywnym trójkącikiem `<summary>`: bez ramki, bez tła, bez
                  wysokości z kanonu. Właściciel o tym ekranie: „przyciski
                  u góry są po prostu słowami, nie przyciskami okrągłymi.
                  Popraw je graficznie, żeby wyglądały tak jak reszta naszego
                  dokumentu" (30.08). Teraz to pastylka z `MENU_3_ACTION_NEUTRAL`
                  — ta sama wysokość (h-8) i promień (rounded-full) co akcje
                  Menu 3 w każdym module. `[&::-webkit-details-marker]:hidden`
                  + `list-none` zdejmują natywny trójkąt przeglądarki, który
                  nie należy do żadnego kanonu. */}
              <details className="mt-3 group">
                <summary className={`w-fit cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden ${MENU_3_ACTION_NEUTRAL}`}>
                  <ChevronRight
                    size={13}
                    aria-hidden
                    className="transition-transform duration-150 group-open:rotate-90"
                  />
                  Szczegóły techniczne
                </summary>
                <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 text-xs text-c-text-muted md:grid-cols-4">
                  <dt>ID wersji źródłowej</dt>
                  <dd className="font-mono text-c-text">{edge.sourceVersionId}</dd>
                  <dt>ID wersji docelowej</dt>
                  <dd className="font-mono text-c-text">{edge.targetVersionId}</dd>
                  <dt>Typ powiązania</dt>
                  <dd className="text-c-text">{formatFreeformLineageCode(edge.edgeType)}</dd>
                  <dt>Hash migawki założeń</dt>
                  <dd className="font-mono text-c-text">{edge.assumptionSnapshotHash ?? '—'}</dd>
                  <dt>Compute run</dt>
                  <dd className="font-mono text-c-text">{edge.computeRunId ?? '—'}</dd>
                  <dt>Autor (ID techniczne)</dt>
                  <dd className="font-mono text-c-text">{edge.authorId ?? '—'}</dd>
                  <dt>ID powiązania</dt>
                  <dd className="font-mono text-c-text">{edge.edgeId}</dd>
                </dl>
              </details>
            </div>
          ))}
        </div>
      )}

      {missingSource && (
        <div
          className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
          data-testid="source-edge-missing"
        >
          <p className="text-sm font-medium text-c-text">
            {t('finance.valuation.sourceBinding.emptyTitle')}
          </p>
          <p className="mt-1 text-xs text-c-text-muted">
            {canBind
              ? t('finance.valuation.sourceBinding.emptyHelp')
              : t('finance.valuation.sourceBinding.emptyHelpReadOnly')}
          </p>

          {canBind && (
            <div className="mt-3 space-y-2" data-testid="source-chooser">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="valuation-source-select" className="text-xs text-c-text-muted">
                  {t('finance.valuation.sourceBinding.selectLabel')}
                </label>
                <select
                  id="valuation-source-select"
                  data-testid="source-chooser-select"
                  className="h-8 min-w-[18rem] max-w-full rounded-full border border-c-border-subtle bg-c-surface px-3 text-xs text-c-text transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 disabled:cursor-not-allowed disabled:opacity-45"
                  value={selected}
                  disabled={options === null || saving}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <option value="">
                    {options === null
                      ? t('finance.valuation.sourceBinding.loading')
                      : t('finance.valuation.sourceBinding.placeholder')}
                  </option>
                  {baselineOptions.length > 0 && (
                    <optgroup label={t('finance.valuation.sourceBinding.groupBaseline')}>
                      {baselineOptions.map((option) => (
                        <option
                          key={`baseline:${option.businessVersionId}`}
                          value={`baseline:${option.businessVersionId}`}
                        >
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {scenarioOptions.length > 0 && (
                    <optgroup label={t('finance.valuation.sourceBinding.groupScenario')}>
                      {scenarioOptions.map((option) => (
                        <option
                          key={`scenario:${option.businessVersionId}`}
                          value={`scenario:${option.businessVersionId}`}
                        >
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button
                  type="button"
                  data-testid="source-chooser-submit"
                  className={MENU_3_ACTION_NEUTRAL}
                  disabled={!selected || saving}
                  onClick={() => void handleBind()}
                >
                  {saving
                    ? t('finance.valuation.sourceBinding.submitting')
                    : t('finance.valuation.sourceBinding.submit')}
                </button>
              </div>

              {options !== null && options.length === 0 && !optionsError && (
                <p className="text-xs text-c-text-muted" data-testid="source-chooser-empty">
                  {t('finance.valuation.sourceBinding.noCandidates')}
                </p>
              )}
              {optionsError && (
                <p className="text-xs text-c-danger" data-testid="source-chooser-options-error">
                  {optionsError}
                </p>
              )}
              {bindError && (
                <p className="text-xs text-c-danger" data-testid="source-chooser-error">
                  {bindError}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SourceStep;
