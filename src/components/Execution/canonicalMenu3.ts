export interface ExecutionMenu3Contract {
  activePreset?: string;
  onCountsChange?: (counts: Record<string, number>) => void;
}

export const countExecutionPresets = <T>(
  rows: T[],
  presets: readonly string[],
  matches: (row: T, preset: string) => boolean
) =>
  Object.fromEntries(
    presets.map((preset) => [preset, rows.filter((row) => matches(row, preset)).length])
  );
