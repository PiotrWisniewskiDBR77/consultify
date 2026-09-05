/**
 * ZMIERZONY DEFEKT (2026-09-05): `.env.local` ustawiał `VITE_IDEA_FINANCIAL_CASE=true`,
 * a „Case finansowy" w menu „Więcej narzędzi" pojawiał się WYŁĄCZNIE po ręcznym
 * `?ff_ideaFinancialCase=1`.
 *
 * PRZYCZYNA (pomiar na transformacie Vite, nie z lektury kodu):
 * `readEnvFlag()` we WSZYSTKICH 109 plikach flag pisał
 *     const meta = import.meta as unknown as { env?: … };
 *     parseFlag(meta?.env?.[ENV_KEY])
 * Vite podstawia obiekt środowiska tylko tam, gdzie w module STOI DOSŁOWNY
 * token `import.meta.env` — a tu stał sam `import.meta`. Moduł pobrany
 * z serwera dev (`curl http://localhost:PORT/src/utils/ideaFinancialCaseFlag.ts`)
 * zaczynał się od `const meta = import.meta;` BEZ prologu `import.meta.env = {…}`,
 * który Vite dokłada modułom odwołującym się do env. W przeglądarce
 * `import.meta` ma tylko `url`, więc `meta.env` było `undefined` i env NIGDY
 * nie działał — w żadnej ze 109 flag, w dev i w buildzie (`vite build` też
 * podstawia wyłącznie dosłowny token).
 *
 * NAPRAWA: `const meta = { env: import.meta.env } as unknown as { env?: … };`
 * — dosłowny token wraca, wszystkie odczyty `meta?.env?.[…]` niżej zostają bez
 * zmiany. Zweryfikowane na żywo: `isIdeaFinancialCaseEnabled()` false → true
 * bez parametru URL, po samym `.env.local`.
 *
 * DOWÓD MUTACYJNY: przywróć w dowolnym pliku flagi `const meta = import.meta as
 * unknown as …` — test „żaden plik nie czyta env przez sam `import.meta`" pada.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { isIdeaFinancialCaseEnabled } from '../ideaFinancialCaseFlag';

const KORZEN = path.resolve(__dirname, '../..');

function plikiZrodlowe(dir: string, acc: string[] = []): string[] {
  for (const wpis of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, wpis.name);
    if (wpis.isDirectory()) {
      if (wpis.name === 'node_modules' || wpis.name === '__tests__') continue;
      plikiZrodlowe(p, acc);
    } else if (/\.(ts|tsx)$/.test(wpis.name)) {
      acc.push(p);
    }
  }
  return acc;
}

describe('flagi środowiskowe — odczyt musi trafiać w dosłowny `import.meta.env`', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('żaden plik nie czyta env przez sam `import.meta` przypisany do zmiennej', () => {
    const winne = plikiZrodlowe(KORZEN)
      .filter((p) => {
        const s = fs.readFileSync(p, 'utf8');
        // Zmienna dostaje SAM `import.meta` (bez `.env`), a niżej sięga po `.env`.
        return /const\s+\w+\s*=\s*import\.meta\s+as\b/.test(s);
      })
      .map((p) => path.relative(KORZEN, p));
    expect(winne).toEqual([]);
  });

  it('każdy plik odwołujący się do `meta.env` niesie dosłowny token `import.meta.env`', () => {
    const winne = plikiZrodlowe(KORZEN)
      .filter((p) => {
        const s = fs.readFileSync(p, 'utf8');
        const uzywaMetaEnv = /\bmeta\??\.env\b/.test(s);
        return uzywaMetaEnv && !s.includes('import.meta.env');
      })
      .map((p) => path.relative(KORZEN, p));
    expect(winne).toEqual([]);
  });

  it('flaga „Case finansowy" włącza się z samego env (bez URL i localStorage)', () => {
    vi.stubEnv('VITE_IDEA_FINANCIAL_CASE', 'true');
    expect(isIdeaFinancialCaseEnabled()).toBe(true);
  });

  it('env=false nadal wyłącza — sufit nie jest „zawsze true"', () => {
    vi.stubEnv('VITE_IDEA_FINANCIAL_CASE', 'false');
    expect(isIdeaFinancialCaseEnabled()).toBe(false);
  });
});
