/** F2-1 is dark by default. Local overrides are intentionally unsupported. */
export const isInitiativesFourButtonsEnabled = (): boolean =>
  import.meta.env.VITE_INITIATIVES_FOUR_BUTTONS === 'true';
