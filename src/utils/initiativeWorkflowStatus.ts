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
  // `status` and `displayStatus` intentionally belong to different vocabularies:
  // the first is the detailed initiative workflow, while the second is the
  // normalized portfolio lifecycle used by the registry. Their values are not
  // expected to be equal. The V8 read service performs the actual schema-drift
  // check and exposes its result explicitly, so the UI must not infer drift by
  // comparing the two legitimate representations.
  return initiative?.statusReadDrift === true;
}
