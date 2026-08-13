/**
 * COORD-09 — kontrakt kształtu kompilatorów Method Packa.
 *
 * Każdy kompilator metody zwraca `{ pack, report }`. Powód nie jest estetyczny:
 * `report` jest jedynym dowodem, na podstawie którego wolno **uczciwie** ustawić
 * `manifest.readiness` (ASSESSMENT_METHOD_PACK_CONTRACT.md §6). Kompilator bez
 * raportu może po cichu ogłosić metodę gotową.
 *
 * Ten test istnieje, żeby ADMA, CMMI i Lean nie odtworzyły rozjazdu, który
 * DRD i SIRI miały przez jedną falę.
 *
 * NOWA METODA: dopisz ją do `COMPILERS` poniżej. Jeśli tego nie zrobisz,
 * ostatni test w tym pliku upadnie i powie ci o tym wprost.
 */

import { describe, it, expect } from 'vitest';
import { compileDrdPack } from '@/method-core/methods/drd/compileDrdPack';
import { compileSiriPack } from '@/method-core/methods/siri/compileSiriPack';
import { METHOD_PACK_READINESS } from '@/method-core/contracts';
import type { MethodCompileResult } from '@/method-core/contracts';

const COMPILERS: ReadonlyArray<{
  readonly method: string;
  readonly compile: () => MethodCompileResult;
}> = [
  { method: 'drd', compile: compileDrdPack },
  { method: 'siri', compile: compileSiriPack },
];

/** Metody, dla których kompilator MUSI istnieć — wykryje brak wpisu wyżej. */
const METHODS_REQUIRING_A_COMPILER = ['drd', 'siri'] as const;

describe('COORD-09 — jednolity kształt wyniku kompilatora', () => {
  it.each(COMPILERS)('$method zwraca { pack, report }', ({ compile }) => {
    const result = compile();
    expect(result).toHaveProperty('pack');
    expect(result).toHaveProperty('report');
    expect(result.pack).toBeTypeOf('object');
    expect(result.report).toBeTypeOf('object');
  });

  it.each(COMPILERS)('$method — pack ma komplet wymaganych sekcji', ({ compile }) => {
    const { pack } = compile();
    expect(Array.isArray(pack.units)).toBe(true);
    expect(Array.isArray(pack.levels)).toBe(true);
    expect(Array.isArray(pack.questions)).toBe(true);
    expect(Array.isArray(pack.sources)).toBe(true);
    expect(Array.isArray(pack.scoringFixtures)).toBe(true);
    expect(pack.units.length).toBeGreaterThan(0);
    expect(METHOD_PACK_READINESS).toContain(pack.manifest.readiness);
  });

  it.each(COMPILERS)(
    '$method — report uzasadnia readiness i wymienia rozbieżności',
    ({ compile }) => {
      const { report } = compile();
      // Uzasadnienie musi być realnym zdaniem, nie pustym stringiem-zaślepką.
      expect(report.readinessRationale.trim().length).toBeGreaterThan(40);
      expect(Array.isArray(report.discrepancies)).toBe(true);
    }
  );

  it.each(COMPILERS)(
    '$method — każda jednostka ma niepustą skalę poziomów i stabilne id',
    ({ compile }) => {
      const { pack } = compile();
      const ids = new Set<string>();
      for (const unit of pack.units) {
        expect(unit.unitId.length, 'unitId nie może być pusty').toBeGreaterThan(0);
        expect(ids.has(unit.unitId), `zduplikowany unitId: ${unit.unitId}`).toBe(false);
        ids.add(unit.unitId);
        expect(
          unit.levelScale.length,
          `jednostka ${unit.unitId} ma pustą skalę poziomów`
        ).toBeGreaterThan(0);
      }
    }
  );

  it('każda metoda wymagająca kompilatora ma go zarejestrowany', () => {
    const registered = COMPILERS.map((c) => c.method);
    for (const method of METHODS_REQUIRING_A_COMPILER) {
      expect(
        registered,
        `metoda "${method}" nie ma kompilatora w COMPILERS — dopisz ją, ` +
          'inaczej jej kształt wyniku nie jest niczym pilnowany'
      ).toContain(method);
    }
  });
});
