export const EXECUTION_MANAGEMENT_SNAPSHOT_CONTRACT = 'execution_management_snapshot_v1' as const;

export type SnapshotSectionState = 'available' | 'degraded';

export interface SnapshotSectionProvenance {
  source: string;
  state: SnapshotSectionState;
  reason?: string;
}

export interface ExecutionManagementSnapshot {
  contractVersion: typeof EXECUTION_MANAGEMENT_SNAPSHOT_CONTRACT;
  asOf: string;
  initiative: {
    id: string;
    projectId: string | null;
    name: string;
    status: string;
    ownerId: string | null;
    ownerName: string | null;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
    actualStartDate: string | null;
    actualEndDate: string | null;
  };
  milestones: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
  provenance: {
    initiative: SnapshotSectionProvenance;
    milestones: SnapshotSectionProvenance;
    tasks: SnapshotSectionProvenance;
    decisions: SnapshotSectionProvenance;
  };
  degradedSections: Array<'milestones' | 'tasks' | 'decisions'>;
}
