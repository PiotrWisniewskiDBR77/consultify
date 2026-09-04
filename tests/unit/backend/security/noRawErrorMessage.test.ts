import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const routesRoot = resolve(process.cwd(), 'server/src/routes');

// Dyzur 296 naprawil TYLKO ten wariant (pola `error`/`message` z `err`/`error`/`e` bez castu `e`).
const day296Pattern = /(?:error|message):\s*(?:\((?:err|error) as Error\)|(?:err|error|e))\.message/;
// Pelna rodzina wyciekow: dochodzi cast `(e as Error)` oraz pole `details`.
const fullFamilyPattern =
  /(?:error|message|details):\s*(?:\((?:err|error|e) as Error\)|(?:err|error|e))\.message/;
const alternateLeakPatterns = [
  /(?:error|message|details):\s*String\((?:err|error|e)\)/,
  /res\.send\(\s*(?:err|error|e)\.stack\s*\)/,
  /(?:error|message|details):\s*(?:err|error|e)\?\.message/,
];
const ALTERNATE_LEAK_BASELINE = 44;

// Wyciek liczy sie tylko w ODPOWIEDZI HTTP. Logger ma prawo (i obowiazek) do surowej tresci,
// a linie komentarza nie sa kodem.
function isResponseLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith('*') || trimmed.startsWith('//')) return false;
  if (/logger\.\w+\(/.test(trimmed) && !/res\.|\.json\(/.test(trimmed)) return false;
  return true;
}

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : routeFiles(path);
    }
    return extname(entry.name) === '.ts' && !/\.(?:test|spec)\.ts$/.test(entry.name) ? [path] : [];
  });
}

function violations(pattern: RegExp): string[] {
  return routeFiles(routesRoot).flatMap((file) => {
    const lines = readFileSync(file, 'utf8').split('\n');
    const out: string[] = [];
    let loggerWindow = 0;
    lines.forEach((line, index) => {
      if (/logger\.\w+\(/.test(line)) loggerWindow = 3;
      if (pattern.test(line) && isResponseLine(line)) {
        const insideLoggerCall = loggerWindow > 0 && !/res\.|\.json\(/.test(line);
        if (!insideLoggerCall) out.push(`${relative(process.cwd(), file)}:${index + 1}:${line.trim()}`);
      }
      if (loggerWindow > 0) loggerWindow -= 1;
    });
    return out;
  });
}

describe('raw route error response guard', () => {
  it('keeps the day-296 err.message response family at zero', () => {
    const found = violations(day296Pattern);
    expect(found, found.join('\n')).toEqual([]);
  });

  // Odbior 04.09: dyzur 296 zamknal jedna galaz rodziny. Wariant `(e as Error)` oraz pole
  // `details` nigdy nie byly objete ani codemodem, ani pierwotnym guardem 312 — to dlug
  // policzony, nie naprawiony. Ratchet pilnuje, zeby nie rosl.
  const REMAINING_LEAK_BASELINE = 0;
  it('does not grow the remaining (e as Error) / details leak debt', () => {
    const found = violations(fullFamilyPattern);
    expect(found.length, `dlug wyciekow wzrosl:\n${found.join('\n')}`).toBeLessThanOrEqual(
      REMAINING_LEAK_BASELINE
    );
  });

  it('rejects alternate raw error response spellings', () => {
    const found = alternateLeakPatterns.flatMap(violations);
    expect(found.length, `alternate leak debt grew:\n${found.join('\n')}`).toBeLessThanOrEqual(
      ALTERNATE_LEAK_BASELINE
    );
  });
});
