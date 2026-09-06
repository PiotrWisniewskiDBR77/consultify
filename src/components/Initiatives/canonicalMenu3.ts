export interface CanonicalMenu3Contract {
  activePreset: string;
  onCountsChange?: (counts: Record<string, number>) => void;
  /** Rosnący sygnał z CTA Menu 2; powierzchnia otwiera własny kreator dokładnie raz. */
  createRequestId?: number;
}

export const countPresets = <T>(
  rows: T[],
  presets: readonly string[],
  matches: (row: T, preset: string) => boolean
): Record<string, number> =>
  Object.fromEntries(
    presets.map((preset) => [preset, rows.filter((row) => matches(row, preset)).length])
  );
