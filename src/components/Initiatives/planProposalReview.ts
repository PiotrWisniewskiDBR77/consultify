export function applyAcceptedPlanProposal<T extends { initiativeId: string }>(
  windows: T[],
  changes: Array<{ initiativeId: string; after: T }>,
  reviewedStatus: string | undefined
): T[] {
  if (reviewedStatus !== 'ACCEPTED') return windows;
  const proposed = new Map(changes.map((change) => [change.initiativeId, change.after]));
  return windows.map((window) => proposed.get(window.initiativeId) ?? window);
}
