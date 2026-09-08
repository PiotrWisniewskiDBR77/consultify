export interface ExecutionMenu3Contract {
  activePreset?: string;
  onCountsChange?: (counts: Record<string, number>) => void;
}

/**
 * JEDEN primary CTA zakładki, rejestrowany przez powierzchnię do prawego
 * skraju Menu 2 gospodarza (`StandardModuleBar.primaryCta`).
 *
 * Świadomie WĘŻSZY niż `StandardPrimaryCta` — powierzchnie Realizacji nie
 * mają dziś potrzeby na `locked`/`lockedReason` (pilot lock żyje w
 * `ExecutionHub`, nie w powierzchniach), a wąski kontrakt nie kusi do
 * dokładania drugiego przycisku tą drogą. Kształt zgodny strukturalnie ze
 * `StandardPrimaryCta`, więc hub przekazuje go dalej bez mapowania.
 *
 * Kanon TRIADA §A2/§C4 (uwaga właściciela 08.09.2026, „w menu też chaos"):
 * akcja tworzenia NIE należy do slotu filtrów i nie ma prawa wyglądać jak
 * przycisk pomocniczy.
 */
export interface ExecutionSurfacePrimaryCta {
  label: string;
  onClick: () => void;
  testId?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export const countExecutionPresets = <T>(
  rows: T[],
  presets: readonly string[],
  matches: (row: T, preset: string) => boolean
) =>
  Object.fromEntries(
    presets.map((preset) => [preset, rows.filter((row) => matches(row, preset)).length])
  );
