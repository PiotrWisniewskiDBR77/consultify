import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * WAŻNY audytu evidence/audyt-mvp-20260906/B3/RAPORT_B3.md (defekt #6):
 * "PL · Silesia" w `organization_context.location` mimo poprawki seeda —
 * REKORD istniejącej organizacji demo (DBR77) nie był odświeżony. Naprawiony
 * skryptem `server/scripts/napraw-region-silesia.ts` (dry-run→apply,
 * zweryfikowany żywo na lokalnej bazie NOC: 1 wiersz naprawiony
 * "PL · Silesia" → "PL · Śląskie", powtórny --apply = 0 wierszy).
 *
 * Ten test jest statycznym strażnikiem kontraktu skryptu (bez uruchamiania
 * bazy — to robi dry-run/apply na żywo, patrz raport): pilnuje, żeby ktoś
 * po cichu nie usunął trybu dry-run, nie zrobił zapisu bezwarunkowego (bez
 * --apply), i żeby transformacja obejmowała PODCIĄG "Silesia" (nie tylko
 * dokładne dopasowanie całej wartości — bezpieczne dla dowolnego otoczenia
 * słowa, np. "PL · Silesia").
 */
const SOURCE = readFileSync(
  path.join(process.cwd(), 'server/scripts/napraw-region-silesia.ts'),
  'utf8'
);

describe('server/scripts/napraw-region-silesia.ts — kontrakt skryptu naprawczego', () => {
  it('wymaga jawnego --dry-run albo --apply (brak domyślnej operacji)', () => {
    expect(SOURCE).toMatch(/dryRun === apply/);
    expect(SOURCE).toMatch(/process\.exit\(2\)/);
  });

  it('zapis (UPDATE) następuje tylko pod warunkiem apply', () => {
    const updateIndex = SOURCE.indexOf('UPDATE organization_context');
    expect(updateIndex).toBeGreaterThan(-1);
    // Musi być wewnątrz bloku for poprzedzonego wczesnym `return` gdy !apply.
    const before = SOURCE.slice(0, updateIndex);
    expect(before).toMatch(/if \(!apply\) \{/);
  });

  it('transformacja zamienia PODCIĄG "Silesia" → "Śląskie" (globalnie)', () => {
    expect(SOURCE).toMatch(/replace\(\/Silesia\/g,\s*'Śląskie'\)/);
  });

  it('SELECT filtruje po ILIKE %Silesia% — powtórne uruchomienie po naprawie zwraca 0 wierszy (idempotencja)', () => {
    expect(SOURCE).toMatch(/location ILIKE '%Silesia%'/);
  });

  it('opcjonalny --org zawęża naprawę do jednej organizacji', () => {
    expect(SOURCE).toMatch(/organization_id = \$\$\{params\.length\}/);
  });
});
