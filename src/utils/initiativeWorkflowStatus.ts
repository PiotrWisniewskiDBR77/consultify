/**
 * P11 read/write coherence: prefer V8 planning `displayStatus` (normalized DB lifecycle)
 * when present so list, detail, and gate-readiness agree on PMO workflow keys.
 */
export function getWorkflowStatusForInitiative(
  initiative: { status?: string | null; displayStatus?: string | null } | null | undefined
): string {
  const v = initiative?.displayStatus ?? initiative?.status ?? 'DRAFT';
  return String(v).toUpperCase();
}

export function hasInitiativeStatusReadDrift(
  initiative:
    | { statusReadDrift?: boolean; status?: string | null; displayStatus?: string | null }
    | null
    | undefined
): boolean {
  if (initiative?.statusReadDrift === true) return true;
  const raw = String(initiative?.status ?? '')
    .trim()
    .toUpperCase();
  const disp = String(initiative?.displayStatus ?? '')
    .trim()
    .toUpperCase();
  if (!raw || !disp) return false;
  return raw !== disp;
}
