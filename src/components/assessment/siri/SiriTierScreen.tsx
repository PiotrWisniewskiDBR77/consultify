/**
 * SiriTierScreen — TIER / Prioritisation Matrix, SEPARATE SCREEN (S5, 2026-08-13).
 *
 * Canon (ASSESSMENT_KB_SIRI.md §4): "Nie wolno łączyć wyboru Band z
 * priorytetyzacją w jednym formularzu." This screen is therefore never
 * mounted inside `MethodWorkspaceShell` — `SiriHttpMethodWorkspaceScreen`
 * only reaches it via an explicit "Otwórz TIER" button that appears once
 * `session.state === 'frozen'` (see that file's `FrozenOutputHttpView`).
 *
 * No formula lives here — `runSiriTier()` (`siriTierView.ts`) is a thin
 * wrapper over `siriAdapter.prioritise()`, itself a thin wrapper over the
 * EXISTING `src/services/siriPrioritisation.ts` engine (COORD-08). This file
 * is display shaping only: a planning-horizon picker, the SIRI_PM_V2 flag
 * readout (never silently overridden — an explicit toggle here writes to the
 * SAME localStorage key `isSiriPmV2Enabled()` already reads), and the ranked
 * table with rank/rationale/focus-per-block.
 */
import { ArrowLeft, Layers } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import type { MethodOutputSummary } from '@/method-core/api/methodCoreApi';
import type { MethodSession } from '@/method-core/contracts';
import {
  runSiriTier,
  siriTierAvailability,
  type SiriTierRankedRow,
  type SiriTierViewResult,
} from '@/method-core/methods/siri/siriTierView';
import type { SiriPmPlanningHorizon } from '@/services/siriPrioritisation';
import { isSiriPmV2Enabled } from '@/utils/siriPmV2Flag';

const PLANNING_HORIZONS: readonly SiriPmPlanningHorizon[] = ['strategic', 'tactical', 'operational'];

const SIRI_PM_V2_LS_KEY = 'ff.siri_pm_v2';

// TRIADA canon (CLAUDE.md UI rule #1): the ranked-dimensions result is a
// fixed-schema record list (rows = the 16 dimensions), not a Matryca
// unit×level grid — the StandardTable case, same as
// `siriHttpWorkspaceViewModel.ts`'s SIRI_OUTPUT_UNIT_COLUMNS.
const TIER_RANKED_COLUMNS: TableColumn[] = [
  { id: 'rank', label: 'Rank', align: 'right' },
  { id: 'areaName', label: 'Wymiar' },
  { id: 'buildingBlock', label: 'Block' },
  {
    id: 'isFocus',
    label: 'Focus?',
    render: (row: SiriTierRankedRow) =>
      row.isFocus ? (
        <span className="rounded-full bg-c-success/15 px-2 py-0.5 font-semibold text-c-success">FOCUS</span>
      ) : (
        '—'
      ),
  },
  { id: 'rationale', label: 'Rationale' },
];

export interface SiriTierScreenProps {
  readonly session: MethodSession;
  readonly output: MethodOutputSummary | null;
  readonly onExit: () => void;
}

function readFlagFromStorage(): boolean {
  try {
    return isSiriPmV2Enabled();
  } catch {
    return false;
  }
}

export const SiriTierScreen: React.FC<SiriTierScreenProps> = ({ session, output, onExit }) => {
  const [planningHorizon, setPlanningHorizon] = useState<SiriPmPlanningHorizon>('tactical');
  const [flagOn, setFlagOn] = useState<boolean>(readFlagFromStorage);
  const [result, setResult] = useState<SiriTierViewResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const availability = siriTierAvailability(session.state);

  const frozenUnitLevels = useMemo(() => {
    if (!output) return {};
    const entries: [string, number][] = [];
    for (const [unitId, level] of Object.entries(output.current)) {
      if (typeof level === 'number') entries.push([unitId, level]);
    }
    return Object.fromEntries(entries);
  }, [output]);

  const scoredUnitCount = Object.keys(frozenUnitLevels).length;

  const toggleFlag = (next: boolean) => {
    setFlagOn(next);
    try {
      window.localStorage.setItem(SIRI_PM_V2_LS_KEY, next ? '1' : '0');
    } catch {
      // best-effort — a failed write just means the toggle reverts on reload
    }
  };

  const handleRun = () => {
    setRunError(null);
    if (!availability.available) return;
    if (!session.frozenSnapshotId) {
      setRunError('Sesja nie ma frozenSnapshotId — TIER wymaga potwierdzonego zamrożenia z serwera.');
      return;
    }
    if (scoredUnitCount === 0) {
      setRunError('Żaden wymiar nie ma potwierdzonego Bandu w tym Output — TIER nie ma na czym liczyć rankingu.');
      return;
    }
    try {
      const res = runSiriTier({
        frozenSnapshotId: session.frozenSnapshotId,
        frozenUnitLevels,
        planningHorizon,
      });
      setResult(res);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Nie udało się uruchomić TIER.');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-c-bg p-6" data-testid="siri-tier-screen">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised">
          <ArrowLeft size={13} /> Wróć do sesji
        </button>
        <h1 className="flex items-center gap-2 text-sm font-semibold text-c-text">
          <Layers size={16} /> TIER — Prioritisation Matrix
        </h1>
      </div>

      {!availability.available ? (
        <div role="alert" data-testid="siri-tier-unavailable" className="rounded-xl border border-c-warning/40 bg-c-warning/10 p-4 text-xs text-c-warning">
          {availability.reason}
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-c-border bg-c-surface p-4 text-xs text-c-text-secondary" data-testid="siri-tier-controls">
            <p className="mb-3 text-c-text-muted">
              Assessment Matrix i Prioritisation Matrix to dwie kolejne, oddzielne macierze (ASSESSMENT_KB_SIRI.md §4) — TIER
              nigdy nie łączy się z wyborem Band. Wymiary zaznaczone poniżej mają potwierdzony Band w Output:{' '}
              <strong className="text-c-text">{scoredUnitCount}/16</strong>.
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 font-medium text-c-text-secondary" htmlFor="siri-tier-horizon">
                Planning horizon
              </label>
              <select
                id="siri-tier-horizon"
                data-testid="siri-tier-planning-horizon"
                value={planningHorizon}
                onChange={(e) => setPlanningHorizon(e.target.value as SiriPmPlanningHorizon)}
                className="rounded-md border border-c-border bg-c-surface px-2 py-1 text-xs text-c-text"
              >
                {PLANNING_HORIZONS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>

              <label className="ml-4 flex items-center gap-1.5 font-medium text-c-text-secondary">
                <input
                  type="checkbox"
                  data-testid="siri-tier-v2-flag-toggle"
                  checked={flagOn}
                  onChange={(e) => toggleFlag(e.target.checked)}
                />
                SIRI_PM_V2 (localStorage) — obecnie: {flagOn ? 'ON' : 'OFF'}
              </label>

              <button
                type="button"
                data-testid="siri-tier-run"
                onClick={handleRun}
                className="ml-auto rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 font-semibold text-c-text hover:bg-c-border-subtle"
              >
                Uruchom TIER
              </button>
            </div>
            <p className="text-[10px] text-c-text-muted">
              Bez jawnego `calculationVersion` (nie przekazujemy go z tego ekranu) rezultat czyta flagę
              `SIRI_PM_V2` — domyślnie (flaga OFF) to zawsze <code>legacy_v1</code>; z flagą ON to{' '}
              <code>siri_pm_v2</code> (COORD-08, zero cichej zmiany).
            </p>
          </div>

          {runError && (
            <div role="alert" className="mb-4 rounded-lg border border-c-danger/40 bg-c-danger/10 p-3 text-xs text-c-danger">
              {runError}
            </div>
          )}

          {result && (
            <div data-testid="siri-tier-result" className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-c-border bg-c-surface p-4 text-xs sm:grid-cols-4">
                <div>
                  <p className="text-c-text-muted">calculationVersion</p>
                  <p data-testid="siri-tier-calculation-version" className="font-semibold text-c-text">
                    {result.calculationVersion}
                  </p>
                </div>
                <div>
                  <p className="text-c-text-muted">planningHorizon</p>
                  <p className="font-semibold text-c-text">{result.planningHorizon}</p>
                </div>
                <div>
                  <p className="text-c-text-muted">parametersVersion</p>
                  <p className="font-semibold text-c-text">{result.parametersVersion}</p>
                </div>
                <div>
                  <p className="text-c-text-muted">weights (cost/kpi/proximity)</p>
                  <p className="font-semibold text-c-text">
                    {result.weights.cost} / {result.weights.kpi} / {result.weights.proximity}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-c-border bg-c-surface p-4">
                <h2 className="mb-2 text-sm font-semibold text-c-text">
                  Focus per Building Block (total {result.totalFocusCount})
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="siri-tier-focus-by-block">
                  {result.focusByBlock.map((fb) => (
                    <div key={fb.buildingBlock} className="rounded-lg border border-c-border-subtle p-3 text-xs">
                      <p className="font-semibold text-c-text">{fb.buildingBlock}</p>
                      <p data-testid={`siri-tier-focus-count-${fb.buildingBlock}`} className="text-c-text-secondary">
                        {fb.focusAreaIds.length} focus dimension(s)
                      </p>
                      <ul className="mt-1 list-disc list-inside text-c-text-muted">
                        {fb.focusAreaIds.map((id) => (
                          <li key={id}>{id}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-c-border bg-c-surface" data-testid="siri-tier-ranked-table">
                <StandardTable
                  columns={TIER_RANKED_COLUMNS}
                  data={result.ranked.map((row) => ({ id: row.areaId, ...row }))}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SiriTierScreen;
