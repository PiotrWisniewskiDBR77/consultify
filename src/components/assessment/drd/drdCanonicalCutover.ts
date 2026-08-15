/** Build-time rollback for the canonical DRD HTTP workspace cutover. */
export function isDrdCanonicalHttpWorkspaceBuildEnabled(
  rawValue: string | boolean | undefined = import.meta.env.VITE_DRD_CANONICAL_HTTP_WORKSPACE
): boolean {
  return rawValue !== false && rawValue !== 'false';
}

export function shouldMountDrdCanonicalWorkspace(
  framework: string | undefined,
  buildEnabled = isDrdCanonicalHttpWorkspaceBuildEnabled()
): boolean {
  return framework === 'drd' && buildEnabled;
}

/** Stable per-assessment key: retries/re-entry replay the same canonical session. */
export function drdLegacyAssessmentCreateKey(assessmentId: string): string {
  return `drd-ui-cutover:${assessmentId}`;
}
