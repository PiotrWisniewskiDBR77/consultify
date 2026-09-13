/**
 * JEDNA FORMA PUSTKI (K5-7, 2026-09-13) — kanon tabel §0 pkt 12 i §3.3:
 * „Puste komórki: `—` (em dash, wyciszony), nigdy puste".
 *
 * ODCHYLENIE ZMIERZONE (odbiór właściciela, staging `cf3fded7e4`): ta sama
 * pustka pokazywała się na jednym ekranie w CZTERECH formach naraz —
 * „Unknown", „None", „v—", „—" — bo każdy ekran wymyślał własny placeholder
 * w swoim `render`/formatterze. To jest dokładnie kształt „naprawa
 * per-wywołanie odrasta": poprawiony w jednym module wraca w kolejnym.
 *
 * ZASADA: JEDNA forma („—") + `title` z powodem, gdy powód jest znany.
 * „Unknown"/„None" zostają WARTOŚCIĄ tylko tam, gdzie to realny stan
 * słownika (np. `initiativeHealthState`), i wtedy przechodzą przez `enumLabel`,
 * a nie przez ten helper.
 */

export const EMPTY_DASH = '—';

/**
 * Napisy, które NIE są wartością, tylko cudzym placeholderem. Świadomie BEZ
 * „Unknown"/„None"/„Nieznane": to bywają realne stany słownikowe i ich
 * automatyczne kasowanie skłamałoby o danych. Placeholder rozpoznajemy po
 * kształcie (myślnik, „n/a", technicznym `null`), nie po znaczeniu.
 */
const PLACEHOLDER_TOKENS = new Set([
  '',
  '-',
  '--',
  '---',
  '–',
  '—',
  '−',
  'n/a',
  'n.a.',
  'na',
  'brak danych',
  'null',
  'undefined',
  'nan',
  'v—',
  'v-',
  'v –',
  'v—.',
]);

/** `true`, gdy wartość jest pustką w dowolnym z zastanych przebrań. */
export const isPlaceholderValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  if (typeof value !== 'string') return false;
  const znormalizowana = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (PLACEHOLDER_TOKENS.has(znormalizowana)) return true;
  // „v—", „v –", „ver. —" — wersja, której nie ma.
  if (/^v(er\.?)?\s*[-–—−]$/.test(znormalizowana)) return true;
  // Sam myślnik dowolnej długości.
  if (/^[-–—−]+$/.test(znormalizowana)) return true;
  return false;
};

export interface EmptyValueDisplay {
  text: string;
  title?: string;
}

/**
 * Jedna forma pustki do renderu: „—" + `title` z powodem.
 * `reason` jest opcjonalny, bo brak pomiaru ≠ znany powód — i lepiej nie mieć
 * dymka niż mieć dymek kłamiący („brak uprawnień", gdy po prostu nie ma pola).
 */
export const formatEmpty = (reason?: string): EmptyValueDisplay => ({
  text: EMPTY_DASH,
  ...(reason && reason.trim() ? { title: reason.trim() } : {}),
});

/**
 * Wartość do wyświetlenia: realna treść albo kanoniczna pustka.
 * Zwraca też `empty`, żeby wołający mógł wyciszyć kolor bez zgadywania.
 */
export const displayValue = (
  value: unknown,
  reason?: string
): EmptyValueDisplay & { empty: boolean } => {
  if (isPlaceholderValue(value)) return { ...formatEmpty(reason), empty: true };
  return { text: String(value), empty: false };
};
