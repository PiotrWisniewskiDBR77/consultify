/**
 * CriterionWorkspaceGate — flag switch between the existing shell
 * (`CriterionWorkspace`, V1) and the SPEC-A reshell (`v2/CriterionWorkspaceV2`,
 * DEC-88). Mounted at the SAME route as V1 today
 * (`/audit-programs/:programId/criteria/:criterionId`, `AppRoutes.tsx`) — no
 * route/URL change, so this is a pure swap-in-place.
 *
 * Default OFF (`ff_criterionWorkspaceV2`, see
 * `src/utils/criterionWorkspaceV2Flag.ts`): renders V1 UNCHANGED. Flip via
 * `?ff_criterionWorkspaceV2=1` (query, instant) or
 * `localStorage["ff.criterion_workspace_v2"]` to preview V2 — CLAUDE.md
 * regułą 7: nie promuj do demo bez akceptu właściciela na zrzutach.
 */
import React from 'react';

import { isCriterionWorkspaceV2Enabled } from '@/utils/criterionWorkspaceV2Flag';

import { CriterionWorkspace } from './CriterionWorkspace';
import { CriterionWorkspaceV2 } from './v2/CriterionWorkspaceV2';

export const CriterionWorkspaceGate: React.FC = () => {
  return isCriterionWorkspaceV2Enabled() ? <CriterionWorkspaceV2 /> : <CriterionWorkspace />;
};

export default CriterionWorkspaceGate;
