/**
 * DRDLightShell — lightweight, dense redesign of the DRD assessment session
 * surface. Drop-in for `<DRDForm>`: identical `data` + `onChange` + `readOnly`
 * contract (the `data[axisKey] = { actual, target, areaScores }` shape produced
 * by `areasToFormData`), plus a few optional presentational props the parent
 * forwards (status / progress / confidence / report + chat handlers).
 *
 * Composition mirrors the locked visual target (drd_redesign.html):
 *   1. Compact status strip (status · confidence · progress inline).
 *   2. Left rail: 7 axes with progress rings.
 *   3. Center: dense area rows with a maturity heat bar; click to expand.
 *   4. Expanded area: 1–5 maturity segment ("teraz" filled / "cel" dashed)
 *      + calm description panel.
 *   5. Right rail: Teresa assist + "Źródła i założenia" accordion.
 *   6. One neutral primary CTA: "Generuj raport".
 *
 * COLOR DOCTRINE (hard):
 *   - `c-accent` is Harvard Crimson — reserved for critical semantics only, so
 *     it is NOT used here. The mockup's blue accent maps to the blue focus
 *     token (`--c-focus-solid` #2563eb): active axis, rings, "teraz", current
 *     level. Target/"cel" = `c-warning` (amber). Done = `c-success` (green).
 *   - The maturity ramp is a monotonic BLUE alpha ramp over `--c-focus-solid`
 *     (never crimson). Inline styles reference CSS-var tokens (not raw hex) so
 *     both light and dark themes adapt automatically.
 *   - Primary CTA is neutral (`bg-c-text text-c-surface`), inverting per theme.
 */

import {
  FileText,
  MessageSquare,
  FolderOpen,
  Clock,
  ChevronRight,
  Settings,
  Lightbulb,
  TrendingUp,
  Database,
  Users,
  Shield,
  Activity,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DRD_AXIS_KEY_MAP, DRD_STRUCTURE, DRDArea, DRDAxis } from '../../../services/drdStructure';

type AxisScore = {
  actual: number;
  target: number;
  areaScores?: Record<string, [number, number]>;
};

type DRDFormData = Record<string, AxisScore | undefined>;

interface DRDLightShellProps {
  /** Same shape as <DRDForm> — data[axisKey] = { actual, target, areaScores }. */
  data: DRDFormData;
  onChange: (data: DRDFormData) => void;
  onComplete?: () => void;
  readOnly?: boolean;
  showProgress?: boolean;
  /** Presentational extras forwarded by the parent (all optional). */
  assessmentName?: string;
  status?: string;
  progressPercent?: number;
  confidence?: number;
  onGenerateReport?: () => void;
  onOpenChat?: () => void;
}

// Axis markers use the app's real lucide icon set (same as DRDForm's AXIS_META)
// — no decorative glyphs, no stars. Meaningful, on-brand, theme-neutral.
const AXIS_ICON: Record<number, React.ReactNode> = {
  1: <Settings className="h-[13px] w-[13px]" />,
  2: <Lightbulb className="h-[13px] w-[13px]" />,
  3: <TrendingUp className="h-[13px] w-[13px]" />,
  4: <Database className="h-[13px] w-[13px]" />,
  5: <Users className="h-[13px] w-[13px]" />,
  6: <Shield className="h-[13px] w-[13px]" />,
  7: <Activity className="h-[13px] w-[13px]" />,
};

/** Monotonic blue maturity ramp (level 1..5) over the --c-focus-solid token. */
const RAMP_ALPHA = [0.14, 0.3, 0.5, 0.72, 1] as const;
function rampColor(level: number): string {
  const a = RAMP_ALPHA[Math.max(0, Math.min(4, level - 1))] ?? 0.14;
  return `rgb(var(--c-focus-solid-rgb) / ${a})`;
}
const BLUE = 'rgb(var(--c-focus-solid-rgb))';
const BLUE_SOFT = 'rgb(var(--c-focus-solid-rgb) / 0.10)';

export const DRDLightShell: React.FC<DRDLightShellProps> = ({
  data,
  onChange,
  readOnly = false,
  assessmentName,
  status,
  progressPercent,
  confidence,
  onGenerateReport,
  onOpenChat,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [activeAxisId, setActiveAxisId] = useState<number>(1);
  const [openAreaId, setOpenAreaId] = useState<string | null>(
    DRD_STRUCTURE[0]?.areas?.[0]?.id || null
  );

  const axisName = useCallback(
    (axis: DRDAxis) => (isPolish && axis.namePL ? axis.namePL : axis.name),
    [isPolish]
  );
  const areaName = useCallback(
    (area: DRDArea) => (isPolish && area.namePL ? area.namePL : area.name),
    [isPolish]
  );

  const currentAxis = useMemo(
    () => DRD_STRUCTURE.find((a) => a.id === activeAxisId) || DRD_STRUCTURE[0],
    [activeAxisId]
  );
  const currentAxisKey = DRD_AXIS_KEY_MAP[activeAxisId] || 'processes';
  const currentAxisData: AxisScore = data[currentAxisKey] || { actual: 0, target: 0, areaScores: {} };
  const levelCount = currentAxis?.levelCount || 5;

  // Per-axis area completion (for the rail rings + counts).
  const axisStats = useMemo(() => {
    const map: Record<number, { done: number; total: number; percent: number }> = {};
    for (const axis of DRD_STRUCTURE) {
      const key = DRD_AXIS_KEY_MAP[axis.id];
      const scores = (key && data[key]?.areaScores) || {};
      const done = axis.areas.filter((a) => {
        const s = scores[a.id];
        return s && (s[0] > 0 || s[1] > 0);
      }).length;
      const total = axis.areas.length;
      map[axis.id] = { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
    }
    return map;
  }, [data]);

  const scores = (areaId: string): [number, number] =>
    currentAxisData.areaScores?.[areaId] || [0, 0];

  // Write a level back through the identical <DRDForm> contract: recompute the
  // axis actual/target averages exactly as DRDForm does, so all surfaces agree.
  const setAreaScore = useCallback(
    (areaId: string, type: 'actual' | 'target', value: number) => {
      if (readOnly) return;
      const nextAreaScores = { ...(currentAxisData.areaScores || {}) };
      const cur = nextAreaScores[areaId] || [0, 0];
      // Toggle off if the user re-clicks the same level.
      const applied = type === 'actual'
        ? ([cur[0] === value ? 0 : value, cur[1]] as [number, number])
        : ([cur[0], cur[1] === value ? 0 : value] as [number, number]);
      nextAreaScores[areaId] = applied;

      const all = Object.values(nextAreaScores);
      const nonEmpty = all.filter((s) => s[0] > 0 || s[1] > 0);
      const avg = (idx: 0 | 1) =>
        nonEmpty.length > 0
          ? Math.round((nonEmpty.reduce((sum, s) => sum + s[idx], 0) / nonEmpty.length) * 10) / 10
          : 0;

      onChange({
        ...data,
        [currentAxisKey]: {
          actual: avg(0),
          target: avg(1),
          areaScores: nextAreaScores,
        },
      });
    },
    [currentAxisData.areaScores, currentAxisKey, data, onChange, readOnly]
  );

  const axisSummary = useMemo(() => {
    const list = Object.values(currentAxisData.areaScores || {}).filter((s) => s[0] > 0);
    const cur = list.length ? Math.round((list.reduce((a, s) => a + s[0], 0) / list.length) * 10) / 10 : null;
    const tgtList = Object.values(currentAxisData.areaScores || {}).filter((s) => s[1] > 0);
    const tgt = tgtList.length ? Math.round((tgtList.reduce((a, s) => a + s[1], 0) / tgtList.length) * 10) / 10 : null;
    const gap = cur != null && tgt != null ? Math.round((tgt - cur) * 10) / 10 : null;
    return { cur, tgt, gap };
  }, [currentAxisData.areaScores]);

  const statusLabel = (status || 'DRAFT').toUpperCase();
  const statusPill = isPolish
    ? statusLabel === 'APPROVED'
      ? 'Zatwierdzony'
      : statusLabel.includes('REVIEW')
        ? 'W przeglądzie'
        : 'Szkic'
    : statusLabel;
  const pct = Math.round(progressPercent ?? 0);

  const t = (pl: string, en: string) => (isPolish ? pl : en);

  return (
    <div className="flex h-full flex-col bg-c-bg text-c-text">
      {/* ─── Compact status strip ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-c-border bg-c-surface px-5 py-3">
        <span className="text-[12px] text-c-text-muted">
          Assessment <span className="mx-1 text-c-text-secondary">›</span> DRD
        </span>
        <h1 className="m-0 text-[15px] font-semibold tracking-tight text-c-text">
          {assessmentName || 'Digital Readiness'}
        </h1>
        <span className="rounded-full border border-c-border bg-c-surface-raised px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-c-text-secondary">
          {statusPill}
        </span>
        <div className="ml-1 flex items-center gap-4 text-[12px]">
          {confidence != null && (
            <span className="text-c-text-muted">
              {t('pewność', 'confidence')}{' '}
              <span className="font-semibold text-c-text-secondary tabular-nums">
                {confidence.toFixed(1)}/5
              </span>
            </span>
          )}
          <span className="flex items-center gap-2">
            <span className="text-c-text-muted">{t('postęp', 'progress')}</span>
            <span className="h-[5px] w-[120px] overflow-hidden rounded-full bg-c-surface-raised">
              <span
                className="block h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: BLUE }}
              />
            </span>
            <span className="font-semibold text-c-text-secondary tabular-nums">{pct}%</span>
          </span>
        </div>

        <span className="flex-1" />

        {onOpenChat && (
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-[13px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
          >
            <MessageSquare className="h-4 w-4" />
            {t('Zapytaj Teresę', 'Ask Teresa')}
          </button>
        )}
        <button
          type="button"
          onClick={onGenerateReport}
          disabled={!onGenerateReport}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text px-3.5 py-1.5 text-[13px] font-semibold text-c-surface transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <FileText className="h-4 w-4" />
          {t('Generuj raport', 'Generate report')}
        </button>
      </div>

      {/* ─── 3-column work area ─── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[236px_1fr] lg:grid-cols-[236px_1fr_300px]">
        {/* AXIS RAIL */}
        <nav className="hidden overflow-y-auto border-r border-c-border bg-c-surface px-3 py-4 md:block">
          <p className="mx-1.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('7 osi dojrzałości', '7 maturity axes')}
          </p>
          <div className="flex flex-col gap-0.5">
            {DRD_STRUCTURE.map((axis) => {
              const st = axisStats[axis.id];
              const on = axis.id === activeAxisId;
              return (
                <button
                  key={axis.id}
                  type="button"
                  onClick={() => {
                    setActiveAxisId(axis.id);
                    setOpenAreaId(axis.areas[0]?.id || null);
                  }}
                  className={`relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    on ? '' : 'hover:bg-c-surface-raised'
                  }`}
                  style={on ? { backgroundColor: BLUE_SOFT } : undefined}
                >
                  {/* progress ring */}
                  <span
                    className="relative grid h-[26px] w-[26px] flex-shrink-0 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(${BLUE} ${st.percent}%, rgb(var(--c-border-subtle-rgb)) 0)`,
                    }}
                  >
                    <span
                      className="grid h-[19px] w-[19px] place-items-center rounded-full text-[11px] text-c-text-secondary"
                      style={{ backgroundColor: on ? 'var(--c-surface)' : 'var(--c-surface)' }}
                    >
                      {AXIS_ICON[axis.id]}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] leading-tight tracking-tight ${
                        on ? 'font-semibold' : 'text-c-text'
                      }`}
                      style={on ? { color: BLUE } : undefined}
                    >
                      {axisName(axis)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-c-text-muted tabular-nums">
                      {st.done} / {st.total} {t('obszarów', 'areas')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* CENTER */}
        <main className="min-w-0 overflow-y-auto px-6 py-5">
          {/* axis header + summary scores */}
          <div className="mb-1 flex items-end justify-between gap-4">
            <div>
              <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
                {axisName(currentAxis)}
              </h2>
              <div className="mt-0.5 text-[12.5px] text-c-text-muted">
                {t('Oś', 'Axis')} {currentAxis.id} {t('z', 'of')} 7 · {currentAxis.areas.length}{' '}
                {t('obszarów do oceny', 'areas to assess')}
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right">
                <div className="text-[20px] font-bold tracking-tight tabular-nums" style={{ color: BLUE }}>
                  {axisSummary.cur ?? '—'}
                </div>
                <div className="text-[10.5px] uppercase tracking-wide text-c-text-muted">
                  {t('teraz', 'now')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[20px] font-bold tracking-tight tabular-nums text-c-warning">
                  {axisSummary.tgt ?? '—'}
                </div>
                <div className="text-[10.5px] uppercase tracking-wide text-c-text-muted">
                  {t('cel', 'target')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[20px] font-bold tracking-tight tabular-nums text-c-text-secondary">
                  {axisSummary.gap ?? '—'}
                </div>
                <div className="text-[10.5px] uppercase tracking-wide text-c-text-muted">
                  {t('luka', 'gap')}
                </div>
              </div>
            </div>
          </div>

          {/* area rows */}
          <div className="mt-4 flex flex-col gap-1.5">
            {currentAxis.areas.map((area) => {
              const [actual, target] = scores(area.id);
              const open = openAreaId === area.id;
              const assessed = actual > 0 || target > 0;
              return (
                <div
                  key={area.id}
                  className={`overflow-hidden rounded-xl border bg-c-surface transition-colors ${
                    open ? 'border-c-border-strong shadow-sm' : 'border-c-border hover:border-c-border-strong'
                  }`}
                  style={open ? { borderColor: BLUE } : undefined}
                >
                  <button
                    type="button"
                    onClick={() => setOpenAreaId(open ? null : area.id)}
                    className="grid w-full grid-cols-[26px_1fr_auto_auto] items-center gap-3.5 px-4 py-3 text-left"
                  >
                    <span className="font-mono text-[12px] font-semibold text-c-text-muted">
                      {area.id}
                    </span>
                    <span className="truncate text-[14px] font-medium text-c-text">
                      {areaName(area)}
                    </span>
                    {/* maturity heat bar */}
                    <span className="flex gap-[3px]">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <span
                          key={lvl}
                          className="h-1.5 w-[15px] rounded-sm"
                          style={{
                            backgroundColor:
                              actual >= lvl ? rampColor(lvl) : 'rgb(var(--c-surface-raised-rgb))',
                          }}
                        />
                      ))}
                    </span>
                    <span className="flex items-center gap-3">
                      {!open && (
                        <span className="min-w-[92px] whitespace-nowrap text-right text-[12px] text-c-text-muted">
                          {assessed ? (
                            <>
                              <span className="text-c-text-secondary tabular-nums">{actual || '—'}</span>
                              {' → '}
                              <span className="text-c-text-secondary tabular-nums">{target || '—'}</span>
                            </>
                          ) : (
                            t('nie oceniono', 'not assessed')
                          )}
                        </span>
                      )}
                      <ChevronRight
                        className="h-4 w-4 text-c-text-muted transition-transform"
                        style={open ? { transform: 'rotate(90deg)' } : undefined}
                      />
                    </span>
                  </button>

                  {open && (
                    <div className="border-t border-c-border bg-c-surface-raised px-4 pb-5 pt-1">
                      {/* current-level segment */}
                      <div className="mb-2.5 mt-3.5 flex items-center justify-between px-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-c-text-muted">
                          {t('Wybierz poziom dojrzałości', 'Choose the maturity level')}
                        </span>
                        {target > 0 && (
                          <span className="text-[11px] text-c-text-muted">
                            {t('cel', 'target')}:{' '}
                            <span className="font-semibold text-c-warning tabular-nums">{target}</span>
                          </span>
                        )}
                      </div>
                      <div
                        className="grid gap-1.5"
                        style={{ gridTemplateColumns: `repeat(${levelCount}, minmax(0, 1fr))` }}
                      >
                        {area.levels.map((lv) => {
                            const isCur = actual === lv.level;
                            const isTgt = target === lv.level;
                            return (
                              <button
                                key={lv.level}
                                type="button"
                                disabled={readOnly}
                                onClick={() => setAreaScore(area.id, 'actual', lv.level)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setAreaScore(area.id, 'target', lv.level);
                                }}
                                title={
                                  readOnly
                                    ? undefined
                                    : t(
                                        'Klik = teraz · prawy klik = cel',
                                        'Click = now · right-click = target'
                                      )
                                }
                                className={`relative rounded-lg border px-2.5 py-2.5 text-left transition-colors ${
                                  readOnly ? 'cursor-default' : 'cursor-pointer'
                                } ${
                                  isCur
                                    ? ''
                                    : isTgt
                                      ? 'border-dashed'
                                      : 'border-c-border-strong bg-c-surface hover:border-c-border-strong'
                                }`}
                                style={
                                  isCur
                                    ? { borderColor: BLUE, backgroundColor: BLUE_SOFT }
                                    : isTgt
                                      ? { borderColor: 'var(--c-warning)' }
                                      : undefined
                                }
                              >
                                {isCur && (
                                  <span
                                    className="absolute -top-2 right-2 rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-c-surface"
                                    style={{ backgroundColor: BLUE }}
                                  >
                                    {t('teraz', 'now')}
                                  </span>
                                )}
                                {isTgt && (
                                  <span className="absolute -top-2 left-2 rounded-full bg-c-warning px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-c-surface">
                                    {t('cel', 'target')}
                                  </span>
                                )}
                                <span
                                  className="block font-mono text-[11px] font-semibold text-c-text-muted"
                                  style={isCur ? { color: BLUE } : undefined}
                                >
                                  {String(lv.level).padStart(2, '0')}
                                </span>
                                <span className="mt-0.5 block text-[12px] font-medium leading-tight text-c-text">
                                  {lv.title}
                                </span>
                              </button>
                            );
                          })}
                      </div>

                      {/* calm description panel for the chosen (or hovered) level */}
                      {(() => {
                        const shown = area.levels.find((l) => l.level === (actual || 1));
                        if (!shown) return null;
                        return (
                          <div className="mt-3.5 flex gap-3 rounded-lg border border-c-border bg-c-surface px-4 py-3 text-[13px] leading-relaxed text-c-text-secondary">
                            <span
                              className="grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-md font-mono text-[12px] font-bold text-c-surface"
                              style={{ backgroundColor: BLUE }}
                            >
                              {shown.level}
                            </span>
                            <span>
                              <span className="font-semibold text-c-text">{shown.title}.</span>{' '}
                              {shown.description}
                            </span>
                          </div>
                        );
                      })()}

                      {onOpenChat && (
                        <button
                          type="button"
                          onClick={onOpenChat}
                          className="mt-3 inline-flex items-center gap-2 text-[12.5px] font-medium transition-opacity hover:opacity-80"
                          style={{ color: BLUE }}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {t(
                            'Nie wiesz? Poproś Teresę o diagnozę tego obszaru',
                            "Not sure? Ask Teresa to diagnose this area"
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>

        {/* ASIDE */}
        <aside className="hidden overflow-y-auto border-l border-c-border bg-c-surface px-4 py-4 lg:block">
          <p className="mx-0.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Wsparcie', 'Support')}
          </p>

          {/* Źródła i założenia */}
          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <FolderOpen className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Źródła i założenia', 'Sources & assumptions')}
              <span
                className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                style={{ backgroundColor: BLUE_SOFT, color: BLUE }}
              >
                {Object.values(currentAxisData.areaScores || {}).filter((s) => s[0] > 0).length}
              </span>
            </div>
            <div className="px-3.5 pb-3.5 text-[12.5px] leading-snug text-c-text-secondary">
              {t(
                'Ocena oparta o metodę ',
                'Assessment based on the '
              )}
              <span className="font-semibold text-c-text">Digital Pathfinder</span>
              {t(
                ' — cytowaną w raporcie. Dowody dopięte do obszaru zostają widoczne przed publikacją.',
                ' method — cited in the report. Evidence pinned to an area stays visible before publishing.'
              )}
            </div>
          </div>

          {/* Aktywność */}
          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <Clock className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Aktywność', 'Activity')}
            </div>
            <div className="px-3.5 pb-3.5 text-[12.5px] leading-snug text-c-text-secondary">
              {t('Utworzono i edytowano dziś.', 'Created and edited today.')}
            </div>
          </div>

          <div className="mt-2.5 border-t border-c-border pt-2.5 text-[11.5px] text-c-text-muted">
            {t('Raport zaciągnie cytaty ', 'The report pulls citations ')}
            <span className="font-semibold text-c-text-secondary">
              „wg Digital Pathfinder / DBR77, Piotr Wiśniewski, PhD"
            </span>{' '}
            {t('dla każdej osi.', 'for each axis.')}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DRDLightShell;
