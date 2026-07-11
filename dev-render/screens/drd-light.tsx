/**
 * Mock host for <DRDLightShell> — the DRD assessment session surface.
 *
 * Reuses the REAL component (no re-implementation) and feeds it realistic
 * partial-assessment mock data shaped exactly like <DRDForm>'s contract:
 *   data[axisKey] = { actual, target, areaScores: { [areaId]: [now, target] } }
 * where axisKey comes from DRD_AXIS_KEY_MAP and areaId matches DRD_STRUCTURE.
 *
 * All callbacks are no-ops (except onChange, which keeps local state live so the
 * click/right-click interactions still work when the supervisor pokes the UI).
 */
import React, { useState } from 'react';

import DRDLightShell from '../../src/components/assessment/drd/DRDLightShell';
import { DRD_AXIS_KEY_MAP } from '../../src/services/drdStructure';

type AxisScore = { actual: number; target: number; areaScores?: Record<string, [number, number]> };
type DRDFormData = Record<string, AxisScore | undefined>;

/** Build an axis entry from area [now, target] pairs, recomputing averages. */
function axis(areaScores: Record<string, [number, number]>): AxisScore {
  const vals = Object.values(areaScores);
  const nonEmpty = vals.filter((s) => s[0] > 0 || s[1] > 0);
  const avg = (idx: 0 | 1) =>
    nonEmpty.length
      ? Math.round((nonEmpty.reduce((sum, s) => sum + s[idx], 0) / nonEmpty.length) * 10) / 10
      : 0;
  return { actual: avg(0), target: avg(1), areaScores };
}

// Realistic partial diagnosis: axis 1 mostly done, axis 4 half, axis 5 started,
// the rest untouched — so the rail rings, heat bars and summary all show range.
const MOCK_DATA: DRDFormData = {
  [DRD_AXIS_KEY_MAP[1]]: axis({
    '1A': [3, 6],
    '1B': [2, 5],
    '1C': [4, 6],
    '1D': [2, 4],
    '1E': [3, 5],
    '1F': [1, 4],
    '1G': [3, 5],
    // 1H, 1I intentionally left unassessed
  }),
  [DRD_AXIS_KEY_MAP[4]]: axis({
    '4A': [2, 5],
    '4B': [3, 6],
    // 4C..4E unassessed
  }),
  [DRD_AXIS_KEY_MAP[5]]: axis({
    '5A': [4, 5],
  }),
};

export function DrdLightScreen(): React.ReactElement {
  const [data, setData] = useState<DRDFormData>(MOCK_DATA);
  const noop = () => {};
  return (
    <DRDLightShell
      data={data}
      onChange={setData}
      assessmentName="DBR77 · Digital Readiness Diagnosis"
      status="IN_REVIEW"
      progressPercent={42}
      confidence={3.4}
      onGenerateReport={noop}
      onOpenChat={noop}
    />
  );
}

export default DrdLightScreen;
