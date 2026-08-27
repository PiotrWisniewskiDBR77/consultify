/**
 * ★ BEZPIECZNIK Z29 — ZERO PONOWIEN W KONFIGURACJI VITEST (dyzur 42, 28.08.2026).
 *
 * Powod: `retry: process.env.CI ? 3 : 1` w vitest.config.ts zamieniał realną
 * dziurę IDOR w ZIELONY raport. Test bezpieczeństwa o kształcie „atak
 * odrzucony + readback bez zmian" leczy się skutkiem własnego ataku: pierwsza
 * próba niszczy zasób, ponowienie dostaje 404 (oczekiwany kod) na nieistniejący
 * już wiersz i przechodzi.
 *
 * Ten test pilnuje, żeby nikt nie przywrócił ponowień globalnie. Jednorazowy
 * wyjątek dla konkretnego uruchomienia nadal wolno podać przez CLI: `--retry=N`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');

/** Konfiguracje, które same deklarują `test:` (nie dziedziczą z bazy). */
const CONFIGS = [
  'vitest.config.ts',
  'vitest.acceptance.config.ts',
  'vitest.security.config.ts',
  'vitest.migration.config.ts',
  'vitest.orphans.config.ts',
  'vitest.perf.config.ts',
  'server/vitest.config.ts',
  'server/vitest.config.v8-db.ts',
];

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8');
}

/** Usuwa komentarze, żeby dokumentacja o dawnym `retry` nie fałszowała testu. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('Z29 — vitest nie ponawia testów', () => {
  it('vitest.config.ts deklaruje retry: 0', () => {
    const code = stripComments(read('vitest.config.ts'));
    expect(code).toMatch(/\bretry:\s*0\b/);
  });

  it('żadna konfiguracja nie ustawia retry różnego od 0', () => {
    const offenders: string[] = [];
    for (const rel of CONFIGS) {
      const code = stripComments(read(rel));
      for (const match of code.matchAll(/\bretry:\s*([^,\n]+)/g)) {
        const value = match[1].trim();
        if (value !== '0') offenders.push(`${rel}: retry: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('nie wraca warunkowe ponawianie zależne od CI', () => {
    for (const rel of CONFIGS) {
      const code = stripComments(read(rel));
      expect(code, rel).not.toMatch(/retry:\s*process\.env\.CI/);
    }
  });

  it('nie deklarujemy nieistniejącej opcji retryMode (fantom w Vitest 4)', () => {
    for (const rel of CONFIGS) {
      expect(stripComments(read(rel)), rel).not.toMatch(/\bretryMode\b/);
    }
  });
});
