/**
 * DRDMatrixPreview — read-only DEMONSTRATION prototype (NOT a production flow).
 *
 * Reconnects Piotr's original "Digital Pathfinder" maturity matrix
 * (DRD_STRUCTURE + MaturityMatrix), which had 0 importers, onto an
 * achievable URL so it can be reviewed live.
 *
 * What this prototype does:
 *  - Local score state only ({ [areaId]: number[] }) — no backend.
 *  - Axis switcher (1..7) feeding getQuestionsForAxis(axisId).
 *  - Renders <MaturityMatrix/> for the selected axis (click level -> blue select).
 *  - Adds a compact "matrix overview" grid: every area is a cell that
 *    CHANGES COLOR by its highest selected level (c.tag-* ramp) — this is the
 *    heart of the demo ("macierz, która zmienia kolory wg poziomu").
 *  - onComplete advances to the next axis; onDiagnose is a lightweight stub.
 *
 * Isolated on purpose: does NOT touch drdStructure.ts (Piotr's content) or the
 * production DRDAssessmentEditor.
 */
import React, { useMemo, useState } from 'react';

import { MaturityMatrix } from '@/components/MaturityMatrix';
import {
  DRD_AXIS_KEY_MAP,
  DRD_STRUCTURE,
  getAxisById,
  getQuestionsForAxis,
  type DRDArea,
} from '@/services/drdStructure';
import type { AxisId } from '@/types';

// c.tag-* ramp keyed by level (1..7). Tags are equal-weight category swatches;
// here we (re)purpose the ordered subset as a "low -> high maturity" ramp for
// the overview grid. Never crimson (brand) as a data color.
const LEVEL_TAG_CLASS: Record<number, string> = {
  1: 'bg-c-tag-9', // slate/grey-ish low
  2: 'bg-c-tag-8',
  3: 'bg-c-tag-4',
  4: 'bg-c-tag-3',
  5: 'bg-c-tag-2',
  6: 'bg-c-tag-1',
  7: 'bg-c-tag-6', // top
};

const EMPTY_CELL_CLASS = 'bg-c-surface-raised';

function highestLevel(scores: number[] | undefined): number {
  if (!scores || scores.length === 0) return 0;
  return Math.max(...scores);
}

export const DRDMatrixPreview: React.FC = () => {
  // Axis id 1..7
  const [axisId, setAxisId] = useState<number>(1);
  // Local, in-memory scores: { areaId: number[] }
  const [scores, setScores] = useState<Record<string, number[]>>({});

  const axis = getAxisById(axisId);
  const axisKey = (DRD_AXIS_KEY_MAP[axisId] || 'processes') as AxisId;
  const areas: DRDArea[] = useMemo(() => getQuestionsForAxis(axisId), [axisId]);

  const handleScoreSelect = (areaId: string, level: number) => {
    setScores((prev) => {
      const current = prev[areaId] || [];
      // Toggle the level (multi-select, matching MaturityMatrix semantics)
      const next = current.includes(level)
        ? current.filter((l) => l !== level)
        : [...current, level].sort((a, b) => a - b);
      return { ...prev, [areaId]: next };
    });
  };

  const handleComplete = () => {
    setAxisId((prev) => (prev >= DRD_STRUCTURE.length ? 1 : prev + 1));
  };

  // Optional AI diagnose — simple deterministic stub (no backend).
  const handleDiagnose = async (
    _areaId: string,
    input: string
  ): Promise<{ level: number; justification: string }> => {
    const words = input.trim().split(/\s+/).filter(Boolean).length;
    const level = Math.min(7, Math.max(1, Math.ceil(words / 6)));
    return {
      level,
      justification:
        'Stub diagnosis (prototype only) — level derived from input length. ' +
        'The production flow would call the Digital Pathfinder model here.',
    };
  };

  const totalAreas = useMemo(
    () => DRD_STRUCTURE.reduce((sum, a) => sum + a.areas.length, 0),
    []
  );

  return (
    <div className="flex flex-col h-screen bg-c-bg text-c-text">
      {/* Header + axis switcher */}
      <header className="shrink-0 border-b border-c-border px-6 py-4 bg-c-surface">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-c-text-muted">
              Prototype · read-only demo
            </div>
            <h1 className="text-lg font-semibold text-c-text">
              Digital Pathfinder — Maturity Matrix
            </h1>
            <p className="text-xs text-c-text-secondary mt-0.5">
              {DRD_STRUCTURE.length} axes · {totalAreas} areas · click a level → the matrix cell
              changes color by maturity level.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {DRD_STRUCTURE.map((a) => {
              const active = a.id === axisId;
              return (
                <button
                  key={a.id}
                  onClick={() => setAxisId(a.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    active
                      ? 'bg-c-accent text-c-tag-foreground border-c-accent'
                      : 'bg-c-surface text-c-text-secondary border-c-border hover:border-c-border-strong'
                  }`}
                  title={a.namePL || a.name}
                >
                  {a.id}. {a.name}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* LEFT: color-graded matrix overview (the "changes colors" heart) */}
        <aside className="w-72 shrink-0 border-r border-c-border bg-c-surface overflow-y-auto p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-c-text-muted mb-2">
            Matrix overview
          </h2>
          <p className="text-[11px] text-c-text-secondary mb-3 leading-relaxed">
            Every area of the selected axis. Cell color = highest selected maturity level.
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {areas.map((area) => {
              const lvl = highestLevel(scores[area.id]);
              const cls = lvl > 0 ? LEVEL_TAG_CLASS[lvl] || EMPTY_CELL_CLASS : EMPTY_CELL_CLASS;
              return (
                <div
                  key={area.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 border border-c-border transition-colors duration-300 ${cls}`}
                >
                  <div className="min-w-0">
                    <div
                      className={`text-xs font-semibold truncate ${lvl > 0 ? 'text-c-tag-foreground' : 'text-c-text'}`}
                    >
                      {area.id} · {area.name}
                    </div>
                    <div
                      className={`text-[10px] truncate ${lvl > 0 ? 'text-c-tag-foreground/80' : 'text-c-text-muted'}`}
                    >
                      {area.namePL || ''}
                    </div>
                  </div>
                  <div
                    className={`ml-2 shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      lvl > 0
                        ? 'bg-white/25 text-c-tag-foreground'
                        : 'bg-c-surface-raised text-c-text-muted'
                    }`}
                  >
                    {lvl > 0 ? lvl : '–'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-5">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-c-text-muted mb-2">
              Level ramp
            </h3>
            <div className="flex items-center gap-1">
              {Array.from({ length: axis?.levelCount || 7 }, (_, i) => i + 1).map((l) => (
                <div key={l} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-6 h-6 rounded ${LEVEL_TAG_CLASS[l] || EMPTY_CELL_CLASS}`}
                    title={`Level ${l}`}
                  />
                  <span className="text-[9px] text-c-text-muted">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* RIGHT: the original MaturityMatrix, wired to local state */}
        <main className="flex-1 min-w-0">
          <MaturityMatrix
            key={axisId}
            axisId={axisId}
            axisKey={axisKey}
            currentScores={scores}
            onScoreSelect={handleScoreSelect}
            onComplete={handleComplete}
            onDiagnose={handleDiagnose}
          />
        </main>
      </div>
    </div>
  );
};

export default DRDMatrixPreview;
