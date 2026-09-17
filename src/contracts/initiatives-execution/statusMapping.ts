import type { InitiativeStatus as InitiativeStatusCode } from '../../../packages/shared/src/constants/initiativeStatuses.generated';
import {
  INITIATIVE_STAGE_SETS_ARCHIVED_FLAG,
  INITIATIVE_STAGE_TO_STATUS,
  INITIATIVE_STATUS_TO_STAGES,
  resolveInitiativeLifecycleStage,
  type InitiativeLifecycleStage,
} from '../../../server/src/constants/initiativeLifecycleStages';

type InitiativeLifecycleStatus = InitiativeLifecycleStage;

export interface InitiativeStatusProjection {
  status: InitiativeStatusCode;
  archived: boolean;
}

function projectRuntimeStatus(lifecycle: InitiativeLifecycleStatus): InitiativeStatusProjection {
  return {
    status: INITIATIVE_STAGE_TO_STATUS[lifecycle] as InitiativeStatusCode,
    archived: INITIATIVE_STAGE_SETS_ARCHIVED_FLAG[lifecycle],
  };
}

export function mapInitiativeStatus(input: {
  direction: 'runtime-to-status'; lifecycle: InitiativeLifecycleStatus;
}): InitiativeStatusProjection;
export function mapInitiativeStatus(input: {
  direction: 'status-to-runtime'; status: InitiativeStatusCode;
}): readonly InitiativeLifecycleStatus[];
export function mapInitiativeStatus(input: {
  direction: 'legacy-to-runtime'; status: string;
}): InitiativeLifecycleStatus | null;
export function mapInitiativeStatus(input:
  | { direction: 'runtime-to-status'; lifecycle: InitiativeLifecycleStatus }
  | { direction: 'status-to-runtime'; status: InitiativeStatusCode }
  | { direction: 'legacy-to-runtime'; status: string }
): InitiativeStatusProjection | readonly InitiativeLifecycleStatus[] | InitiativeLifecycleStatus | null {
  if (input.direction === 'runtime-to-status') return projectRuntimeStatus(input.lifecycle);
  if (input.direction === 'status-to-runtime') {
    return INITIATIVE_STATUS_TO_STAGES[input.status] as readonly InitiativeLifecycleStatus[];
  }
  return resolveInitiativeLifecycleStage(input.status);
}
