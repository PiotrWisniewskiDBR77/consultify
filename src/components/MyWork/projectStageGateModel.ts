export const PROJECT_STAGE_GATES = [
  { gateType: 'READINESS_GATE', fromPhase: 'Context', toPhase: 'Assessment' },
  { gateType: 'DESIGN_GATE', fromPhase: 'Assessment', toPhase: 'Initiatives' },
  { gateType: 'PLANNING_GATE', fromPhase: 'Initiatives', toPhase: 'Roadmap' },
  { gateType: 'EXECUTION_GATE', fromPhase: 'Roadmap', toPhase: 'Execution' },
  { gateType: 'CLOSURE_GATE', fromPhase: 'Execution', toPhase: 'Stabilization' },
] as const;

export type ProjectStageGateType = (typeof PROJECT_STAGE_GATES)[number]['gateType'];

export interface ProjectStageGateEvaluation {
  gateType: ProjectStageGateType;
  status: 'READY' | 'NOT_READY';
  completionCriteria: Array<{ criterion: string; isMet: boolean; evidence: string }>;
  missingElements: string[];
}

export interface ProjectStageGateHistoryItem {
  id: string;
  gate_type: ProjectStageGateType;
  status: 'PENDING' | 'PASSED' | 'REJECTED';
  approved_at?: string | null;
  notes?: string | null;
}

export interface ProjectStageGateRow {
  id: ProjectStageGateType;
  gateType: ProjectStageGateType;
  fromPhase: string;
  toPhase: string;
  state: 'PASSED' | 'READY' | 'NOT_READY' | 'PENDING_REVIEW' | 'UPCOMING';
  actionable: boolean;
  action: 'REQUEST' | 'APPROVE' | null;
  missingElements: string[];
  approvedAt: string | null;
}

export function buildProjectStageGateRows(input: {
  currentPhase: string;
  nextGate: ProjectStageGateEvaluation | null;
  history: ProjectStageGateHistoryItem[];
  actorDuty?: 'EXECUTOR' | 'REVIEWER' | null;
  pendingRequest?: { id: string; requestedBy: string } | null;
}): ProjectStageGateRow[] {
  const passedByType = new Map<ProjectStageGateType, ProjectStageGateHistoryItem>();
  for (const item of input.history) {
    if (item.status === 'PASSED' && !passedByType.has(item.gate_type)) {
      passedByType.set(item.gate_type, item);
    }
  }

  return PROJECT_STAGE_GATES.map((definition) => {
    const passed = passedByType.get(definition.gateType);
    if (passed) {
      return {
        id: definition.gateType,
        ...definition,
        state: 'PASSED' as const,
        actionable: false,
        action: null,
        missingElements: [],
        approvedAt: passed.approved_at ?? null,
      };
    }
    if (input.nextGate?.gateType === definition.gateType) {
      const action = input.pendingRequest
        ? input.actorDuty === 'REVIEWER'
          ? 'APPROVE'
          : null
        : input.actorDuty === 'EXECUTOR' || input.actorDuty === undefined
          ? 'REQUEST'
          : null;
      return {
        id: definition.gateType,
        ...definition,
        state: input.pendingRequest ? ('PENDING_REVIEW' as const) : input.nextGate.status,
        actionable: input.nextGate.status === 'READY' && action !== null,
        action,
        missingElements: input.nextGate.missingElements,
        approvedAt: null,
      };
    }
    return {
      id: definition.gateType,
      ...definition,
      state: 'UPCOMING' as const,
      actionable: false,
      action: null,
      missingElements: [],
      approvedAt: null,
    };
  });
}
