/**
 * Deep-freeze helper shared by every constructor in this package
 * (AssessmentOutput, Finding, ReportSnapshot, PresentationSourceBlock,
 * InitiativeProposalDraft). Split into its own module so `assessmentOutput.ts`
 * and `finding.ts` don't need to import from each other.
 */
export function deepFreeze<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}
