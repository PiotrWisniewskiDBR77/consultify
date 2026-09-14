/** Server-side release gate for the Wave 2 Initiatives Plan capability. */
export const isInitiativesPlanEnabled = (): boolean =>
  process.env.ENABLE_INITIATIVES_PLAN === 'true';
