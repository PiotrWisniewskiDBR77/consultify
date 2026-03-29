interface RefreshExecutiveSnapshot {
  (opts?: { refresh?: boolean }): Promise<void> | void;
}

interface RefreshExecutionWriteTruthParams {
  activeTab: string;
  currentProjectId?: string | null;
  queueExecutionTruthRefresh: () => void;
  refreshExecutiveSnapshot?: RefreshExecutiveSnapshot;
}

export async function refreshExecutionWriteTruth({
  activeTab,
  currentProjectId,
  queueExecutionTruthRefresh,
  refreshExecutiveSnapshot,
}: RefreshExecutionWriteTruthParams): Promise<void> {
  queueExecutionTruthRefresh();

  if (activeTab !== 'list' || !currentProjectId || !refreshExecutiveSnapshot) {
    return;
  }

  await refreshExecutiveSnapshot({ refresh: true });
}
