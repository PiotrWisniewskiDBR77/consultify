/**
 * Naprawa 2026-09-05 (wave3 defekt 5, dyzur "flagi-env-statyczny-odczyt"):
 * `readEnvFlag()` czytal env przez `const meta = import.meta as unknown as
 * {...}; ... meta?.env?.[ENV_KEY]` — dwa OSOBNE wyrazenia po transpilacji TS
 * (`const meta = import.meta;` + `meta?.env`). Vite/esbuild podstawiaja
 * obiekt `import.meta.env` TYLKO gdy `import.meta` i `.env` sa w JEDNYM
 * wyrazeniu (`import.meta.env` jako pojedynczy MemberExpression) — rozdzielone
 * na dwa wyrazenia, `import.meta` zostaje natywnym obiektem bez `.env`, wiec
 * `VITE_ASSESSMENT_DOCX_ENABLED` ustawiony na Railway nigdy nie dzialal w
 * `vite build`.
 *
 * SKORYGOWANE 2026-09-06 (zlecenie Z5 — pomiar empiryczny). Ta wersja testu
 * (do 05.09) twierdzila: "Test RUNTIME'owy tego by nie obronil: vitest sam
 * podstawia prawdziwe import.meta.env, wiec obie wersje (zepsuta i
 * naprawiona) przechodza." To NIGDY nie zostalo sprawdzone `vi.stubEnv` —
 * zmierzone 06.09: fix z 05.09 (`(import.meta as unknown as {...}).env?.[K]`,
 * cast NA `import.meta` przed `.env`) DZIALA w `vite build`/`vite dev`
 * (esbuild usuwa cast z AST przed podstawieniem), ale zwraca `undefined` w
 * Vitest z `vi.stubEnv` — Vitest/vite-node decyduje o wstrzykiwaniu
 * `import.meta.env` na podstawie SUROWEGO zrodla (przed odcieciem typow TS),
 * gdzie "import.meta" i ".env" nie sasiaduja przez cast miedzy nimi.
 *
 * Naprawa Z5: cast przeniesiony na WYNIK `.env`
 * (`(import.meta.env as unknown as Record<...>)`) — literalny token
 * `import.meta.env` zostaje spojny, dziala WSZEDZIE (build, dev, Vitest).
 *
 * DOWOD MUTACYJNY (Z5, wykonany na tym pliku): przywrocenie w
 * `assessmentDocxFlag.ts` ksztaltu
 * `(import.meta as unknown as { env?: ... }).env?.[ENV_KEY]` -> test
 * "flaga czyta env dynamicznie (vi.stubEnv)" ponizej czerwienieje
 * (evidence/z5/mutacja-assessmentDocxFlag.txt).
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ASSESSMENT_DOCX_FLAG_KEYS, isAssessmentDocxEnabled } from '../assessmentDocxFlag';

/** Kod bez komentarzy — dokładnie to, co widzi Vite przy decyzji o preambule. */
function executableSource(relativePath: string): string {
  const raw = fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('assessmentDocxFlag — odczyt env musi być jednym wyrażeniem', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const source = executableSource('../assessmentDocxFlag.ts');

  it(`kod wykonywalny odczytuje klucz ${ASSESSMENT_DOCX_FLAG_KEYS.env} przez import.meta.env w jednym wyrażeniu (cast na WYNIKU .env)`, () => {
    // Cast opakowuje WYNIK `import.meta.env` (nie `import.meta` przed `.env`) —
    // token `import.meta.env` zostaje spójny w źródle.
    expect(source).toMatch(/import\.meta\.env as unknown as Record<string, string \| undefined>\)\?\.\[ENV_KEY\]/);
  });

  it('kod wykonywalny NIE rozdziela import.meta i .env na dwa wyrażenia (cast NA import.meta przed .env)', () => {
    // Ten kształt (cast owija `import.meta` PRZED `.env`, albo `.env` w
    // osobnej instrukcji) jest dokładnie tym, co łamie podstawienie w
    // Vitest/vite-node (patrz komentarz nagłówkowy).
    expect(source).not.toMatch(/\(import\.meta\s+as\s+unknown\s+as\s*\{[^}]*env[^}]*\}\)\.env/);
    expect(source).not.toMatch(/\bconst\s+\w+\s*=\s*import\.meta\s+as\s+unknown\s+as\s*\{[^}]*\};/);
  });

  it('flaga czyta env DYNAMICZNIE w Vitest (vi.stubEnv) — dowód, że cast na WYNIKU .env nie łamie Vitest', () => {
    vi.stubEnv(ASSESSMENT_DOCX_FLAG_KEYS.env, 'true');
    expect(isAssessmentDocxEnabled()).toBe(true);
    vi.stubEnv(ASSESSMENT_DOCX_FLAG_KEYS.env, 'false');
    expect(isAssessmentDocxEnabled()).toBe(false);
  });
});
