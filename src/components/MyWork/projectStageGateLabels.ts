import type { TFunction } from 'i18next';

import type { ProjectStageGateType } from './projectStageGateModel';

export const PROJECT_PHASE_LABEL_KEYS = {
  Context: 'context',
  Assessment: 'assessment',
  Initiatives: 'initiatives',
  Roadmap: 'roadmap',
  Execution: 'execution',
  Stabilization: 'stabilization',
} as const;

export const PROJECT_GATE_LABEL_KEYS: Record<ProjectStageGateType, string> = {
  READINESS_GATE: 'readiness',
  DESIGN_GATE: 'design',
  PLANNING_GATE: 'planning',
  EXECUTION_GATE: 'execution',
  CLOSURE_GATE: 'closure',
};

export function projectPhaseLabel(t: TFunction, phase: string): string {
  const key = PROJECT_PHASE_LABEL_KEYS[phase as keyof typeof PROJECT_PHASE_LABEL_KEYS];
  return key ? t(`myWork.projects.stageGates.phases.${key}`, { defaultValue: phase }) : phase;
}
