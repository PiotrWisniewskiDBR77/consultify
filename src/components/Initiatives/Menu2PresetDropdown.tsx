/**
 * Re-eksport zgodnościowy.
 *
 * `Menu2PresetDropdown` powstał przy DEC-420 (Inicjatywy), ale od DEC-423b/c/d
 * (Materiały, 06.09.2026) jest KANONICZNYM dropdownem Menu 2 dla wielu modułów —
 * więc mieszka w `src/components/standard/`, razem z resztą kanonu
 * (StandardModuleBar · StandardTable · StandardPreview). Ten plik zostaje, żeby
 * nie ruszać istniejących importów Inicjatyw.
 */
export {
  default,
  Menu2PresetDropdown,
  type Menu2PresetDropdownProps,
  type Menu2PresetOption,
} from '@/components/standard/Menu2PresetDropdown';
