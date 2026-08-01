/**
 * DRDMatrixSession — the DEFAULT surface of a live DRD assessment session.
 *
 * This is Piotr's "Digital Pathfinder" experience: walk the client axis-by-axis
 * through the maturity areas, click a level → the matrix cell changes color.
 * It reuses the original <MaturityMatrix/> (Piotr's content-driven UX) and adds
 * a persistent "Matrix overview" panel across ALL axes (like DRDMatrixPreview),
 * but — unlike the read-only prototype — it is WIRED to the real session answers.
 *
 * Persistence contract (SSOT):
 *   answers.drd.areas[areaId] = { achievedLevel, targetLevel?, levelNotes?, ... }
 * This is the EXACT shape DRDAssessmentEditor reads/writes, so the Matrix and the
 * Table view stay fully interoperable (round-trip in both directions).
 *
 * Mapping between MaturityMatrix (multi-select number[]) and DRD (single
 * achievedLevel):
 *   - We treat maturity as CUMULATIVE: achievedLevel = L means levels 1..L hold.
 *   - Hydration: currentScores[areaId] = [1..achievedLevel]. Highest = achieved.
 *   - onScoreSelect(areaId, L): clicking a not-yet-achieved level sets
 *     achievedLevel = L; clicking the exact current achieved level toggles it
 *     down to L-1 (deselect). This keeps a single, honest "AS-IS" per area and
 *     never fabricates a scoreSummary (P28 no-silent-scoring respected — we only
 *     write answers; formal scoring/promotion still flows through the workbench).
 */
import { Target } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DRDEditorAnswers } from '@/components/assessment/drd/DRDAssessmentEditor';
import { MaturityMatrix } from '@/components/MaturityMatrix';
import {
  DRD_AXIS_KEY_MAP,
  DRD_STRUCTURE,
  type DRDArea,
  getAxisById,
  getQuestionsForAxis,
} from '@/services/drdStructure';
import type { AxisId } from '@/types';

type Props = {
  value: DRDEditorAnswers | undefined;
  onChange: (next: DRDEditorAnswers) => void;
  readOnly?: boolean;
  currentAxisId: number;
  onAxisChange: (axisId: number) => void;
  currentAreaId?: string;
  onAreaChange?: (areaId: string) => void;
};

// c.tag-* ramp keyed by level (1..7). Ordered low → high maturity. Never crimson
// (brand) as a data color — matches DRDMatrixPreview's palette.
const LEVEL_TAG_CLASS: Record<number, string> = {
  1: 'bg-c-tag-9',
  2: 'bg-c-tag-8',
  3: 'bg-c-tag-4',
  4: 'bg-c-tag-3',
  5: 'bg-c-tag-2',
  6: 'bg-c-tag-1',
  7: 'bg-c-tag-6',
};

const EMPTY_CELL_CLASS = 'bg-c-surface-raised';

function getAchievedLevel(value: DRDEditorAnswers | undefined, areaId: string): number {
  const raw = Number(value?.areas?.[areaId]?.achievedLevel || 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

// ASM-001A: DRDMatrixSession never read `targetLevel` before this — only
// `achievedLevel`. Form (DRDAssessmentEditor) and Table both already show
// achieved ("AS {n}") alongside target ("TO {n}") using this exact labeling;
// the Matrix needs the same pairing so "Matrix shows the same achieved/
// target values as Form" is true on screen, not only in the shared data.
function getTargetLevel(value: DRDEditorAnswers | undefined, areaId: string): number {
  const raw = Number(value?.areas?.[areaId]?.targetLevel || 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/**
 * Build MaturityMatrix's `currentScores` for one axis from the session answers.
 * Cumulative model: achievedLevel L → [1..L] selected.
 */
function buildScoresForAxis(
  value: DRDEditorAnswers | undefined,
  areas: DRDArea[]
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const area of areas) {
    const achieved = getAchievedLevel(value, area.id);
    if (achieved > 0) {
      out[area.id] = Array.from({ length: achieved }, (_, i) => i + 1);
    }
  }
  return out;
}

export const DRDMatrixSession: React.FC<Props> = ({
  value,
  onChange,
  readOnly = false,
  currentAxisId,
  onAxisChange,
  currentAreaId,
  onAreaChange,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = (i18n.language || '').toLowerCase().startsWith('pl');

  const axis = getAxisById(currentAxisId) || DRD_STRUCTURE[0];
  const axisKey = (DRD_AXIS_KEY_MAP[axis.id] || 'processes') as AxisId;
  const areas: DRDArea[] = useMemo(() => getQuestionsForAxis(axis.id), [axis.id]);

  const currentScores = useMemo(() => buildScoresForAxis(value, areas), [value, areas]);

  // Which axis is expanded in the overview (defaults to the current one).
  const [openOverviewAxis, setOpenOverviewAxis] = useState<number>(axis.id);
  React.useEffect(() => {
    setOpenOverviewAxis(axis.id);
  }, [axis.id]);

  const setAchievedLevel = (areaId: string, level: number) => {
    if (readOnly) return;
    const areasMap = { ...(value?.areas || {}) };
    const prev = areasMap[areaId] || { achievedLevel: 0 };
    const prevAchieved = Number(prev.achievedLevel || 0);
    // Clicking the exact current achieved level toggles it down (deselect).
    const nextAchieved = prevAchieved === level ? Math.max(0, level - 1) : level;
    areasMap[areaId] = { ...prev, achievedLevel: nextAchieved };
    onChange({ ...(value || {}), areas: areasMap });
    onAreaChange?.(areaId);
  };

  const handleComplete = () => {
    // Advance to the next axis (wrap around like the prototype).
    const nextAxisId = axis.id >= DRD_STRUCTURE.length ? 1 : axis.id + 1;
    onAxisChange(nextAxisId);
  };

  const totalAreas = useMemo(() => DRD_STRUCTURE.reduce((sum, a) => sum + a.areas.length, 0), []);
  const assessedAreas = useMemo(() => {
    let n = 0;
    for (const ax of DRD_STRUCTURE) {
      for (const area of ax.areas) {
        if (getAchievedLevel(value, area.id) > 0) n += 1;
      }
    }
    return n;
  }, [value]);

  return (
    <div className="flex h-full min-h-0 bg-c-bg text-c-text">
      {/* LEFT: color-graded matrix overview across ALL axes (the "changes colors" heart) */}
      <aside className="w-72 shrink-0 border-r border-c-border bg-c-surface overflow-y-auto p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-c-text-muted mb-1">
          {t('assessment.drd.matrix.overviewTitle', 'Matrix overview')}
        </h2>
        <p className="text-[11px] text-c-text-secondary mb-3 leading-relaxed">
          {t(
            'assessment.drd.matrix.overviewSubtitle',
            'Cell color = achieved maturity level. Click an axis to open it.'
          )}
        </p>

        <div className="space-y-2">
          {DRD_STRUCTURE.map((ax) => {
            const isActive = ax.id === axis.id;
            const isOpen = ax.id === openOverviewAxis;
            const axAssessed = ax.areas.filter((a) => getAchievedLevel(value, a.id) > 0).length;
            return (
              <div
                key={ax.id}
                className={`rounded-lg border transition-colors ${
                  isActive ? 'border-c-border-strong' : 'border-c-border'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenOverviewAxis((cur) => (cur === ax.id ? -1 : ax.id));
                    if (ax.id !== axis.id) onAxisChange(ax.id);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-lg transition-colors ${
                    isActive
                      ? 'bg-c-surface-raised text-c-text'
                      : 'text-c-text-secondary hover:bg-c-surface-raised'
                  }`}
                  title={isPl ? ax.namePL || ax.name : ax.name}
                >
                  <span className="text-xs font-semibold truncate">
                    {ax.id}. {isPl ? ax.namePL || ax.name : ax.name}
                  </span>
                  <span className="text-[10px] tabular-nums text-c-text-muted shrink-0">
                    {axAssessed}/{ax.areas.length}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-2 pb-2 pt-1 grid grid-cols-1 gap-1.5">
                    {ax.areas.map((area) => {
                      const lvl = getAchievedLevel(value, area.id);
                      const tgt = getTargetLevel(value, area.id);
                      const cls =
                        lvl > 0 ? LEVEL_TAG_CLASS[lvl] || EMPTY_CELL_CLASS : EMPTY_CELL_CLASS;
                      const isSelectedArea = ax.id === axis.id && area.id === (currentAreaId || '');
                      return (
                        <button
                          key={area.id}
                          type="button"
                          onClick={() => {
                            if (ax.id !== axis.id) onAxisChange(ax.id);
                            onAreaChange?.(area.id);
                          }}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border transition-colors duration-300 text-left ${cls} ${
                            isSelectedArea
                              ? 'ring-2 ring-c-focus border-c-border-strong'
                              : 'border-c-border'
                          }`}
                          title={isPl ? area.namePL || area.name : area.name}
                        >
                          <span
                            className={`text-[11px] font-medium truncate ${
                              lvl > 0 ? 'text-c-tag-foreground' : 'text-c-text'
                            }`}
                          >
                            {area.id} · {isPl ? area.namePL || area.name : area.name}
                          </span>
                          <span className="ml-2 shrink-0 flex items-center gap-1">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                lvl > 0
                                  ? 'bg-white/25 text-c-tag-foreground'
                                  : 'bg-c-surface-raised text-c-text-muted'
                              }`}
                              title={
                                isPl
                                  ? `Osiągnięty poziom: ${lvl || '—'}`
                                  : `Achieved (AS-IS) level: ${lvl || '—'}`
                              }
                            >
                              {lvl > 0 ? lvl : '–'}
                            </span>
                            {tgt > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded-full border border-dashed border-blue-500/50 bg-blue-500/10 text-[9px] font-bold text-blue-700 dark:text-blue-200"
                                title={
                                  isPl
                                    ? `Poziom docelowy: ${tgt}`
                                    : `Target (TO-BE) level: ${tgt}`
                                }
                              >
                                <Target size={9} />
                                {tgt}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Level ramp legend */}
        <div className="mt-5">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-c-text-muted mb-2">
            {t('assessment.drd.matrix.levelRamp', 'Level ramp')}
          </h3>
          <div className="flex items-center gap-1 flex-wrap">
            {Array.from({ length: axis.levelCount || 7 }, (_, i) => i + 1).map((l) => (
              <div key={l} className="flex flex-col items-center gap-1">
                <div
                  className={`w-6 h-6 rounded ${LEVEL_TAG_CLASS[l] || EMPTY_CELL_CLASS}`}
                  title={`Level ${l}`}
                />
                <span className="text-[9px] text-c-text-muted">{l}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-c-text-muted tabular-nums">
            {t('assessment.drd.matrix.areasAssessed', 'Areas assessed')}: {assessedAreas}/
            {totalAreas}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-c-text-muted">
            <span className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-blue-500/50 bg-blue-500/10 px-1 text-blue-700 dark:text-blue-200">
              <Target size={9} />
            </span>
            <span>
              {t(
                'assessment.drd.matrix.targetLegend',
                'Dashed blue = target level (TO-BE), alongside the achieved (AS-IS) circle.'
              )}
            </span>
          </div>
        </div>
      </aside>

      {/* RIGHT: Piotr's original MaturityMatrix, wired to the real session answers */}
      <main className="flex-1 min-w-0">
        <MaturityMatrix
          key={axis.id}
          axisId={axis.id}
          axisKey={axisKey}
          currentScores={currentScores}
          onScoreSelect={setAchievedLevel}
          onComplete={handleComplete}
        />
      </main>
    </div>
  );
};

export default DRDMatrixSession;
