/**
 * Weryfikacja 2026-09-05 (wave3 defekt 5, dyzur "flagi-env-statyczny-odczyt").
 * `readEnv()` w tym pliku BYL JUZ poprawny przed dyzurem (`.env` jest w TYM
 * SAMYM wyrazeniu co cast: `const env = (import.meta as unknown as
 * {...}).env;`), ale plik wchodzil do listy "na pewno obejmij" zlecenia (bo
 * ma wlasna funkcje `readEnv`, ktora latwo bylo rozdzielic tak jak w 108
 * innych plikach). Ten test blokuje regresje do rozdzielonego wzorca —
 * pelne wyjasnienie mechanizmu w
 * `src/utils/__tests__/assessmentDocxFlag.envStaticRead.test.ts`.
 *
 * DOWOD MUTACYJNY (wykonany recznie przy pisaniu tego testu): zamiana
 * `const env = (import.meta as unknown as {...}).env;` na
 * `const meta = import.meta as unknown as {...}; const env = meta?.env;`
 * -> drugi test ponizej czerwienieje.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('resultsVNextFeatureFlags — readEnv() musi czytać import.meta.env w jednym wyrażeniu', () => {
  const raw = fs.readFileSync(
    path.resolve(__dirname, '../resultsVNextFeatureFlags.ts'),
    'utf8'
  );
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('readEnv() ma .env w TYM SAMYM wyrażeniu co cast import.meta', () => {
    expect(source).toMatch(/\(import\.meta as unknown as \{[^}]*\}\)\.env\b/);
  });

  it('kod wykonywalny NIE deklaruje osobnej zmiennej trzymającej samo import.meta (bez .env w tej samej instrukcji)', () => {
    expect(source).not.toMatch(/\bconst\s+\w+\s*=\s*import\.meta\s+as\s+unknown\s+as\s*\{[^}]*\};/);
  });
});
