/**
 * CriterionWorkspaceGate — flag switch between the existing shell
 * (`CriterionWorkspace`, V1) and the SPEC-A reshell (`v2/CriterionWorkspaceV2`,
 * DEC-88). Mounted at the SAME route as V1 today
 * (`/audit-programs/:programId/criteria/:criterionId`, `AppRoutes.tsx`) — no
 * route/URL change, so this is a pure swap-in-place.
 *
 * Default ON since DEC-97 (owner accept, 2026-08-26) — see
 * `src/utils/criterionWorkspaceV2Flag.ts`: renders V2 by default. V1 stays
 * reachable via the explicit `?ff_criterionWorkspaceV2=0` (query, instant)
 * or `localStorage["ff.criterion_workspace_v2"] = "off"` escape hatch for
 * regression comparison.
 */
import React from 'react';

import { isCriterionWorkspaceV2Enabled } from '@/utils/criterionWorkspaceV2Flag';

import { CriterionWorkspace } from './CriterionWorkspace';
import { CriterionWorkspaceV2 } from './v2/CriterionWorkspaceV2';

export const CriterionWorkspaceGate: React.FC = () => {
  return isCriterionWorkspaceV2Enabled() ? <CriterionWorkspaceV2 /> : <CriterionWorkspace />;
};

export default CriterionWorkspaceGate;
