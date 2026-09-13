/**
 * K3 — TEST STRAŻNICZY PARYTETU PRZY FLAGACH WYŁĄCZONYCH.
 *
 * Powód istnienia: kandydat MVP wchodzi na staging/demo z flagami
 * NIEUSTAWIONYMI. Warunkiem wdrożenia jest, żeby przy braku zmiennej
 * środowiskowej każdy czytnik dawał `false` — czyli żeby demo dostało
 * ścieżkę legacy, a nie nową.
 *
 * Pułapka, przed którą broni ten plik (pamięć projektu: „heurystyka domyślnej
 * flagi kłamie"): domyślną wartość flagi łatwo przestawić NIECHCĄCY, zmieniając
 * `=== 'true'` na `!== 'false'`, `?? true`, ternary albo wczesny `return true`.
 * Każda taka zmiana czyni flagę domyślnie WŁĄCZONĄ i wypuszcza nowy kod na
 * demo bez decyzji właściciela. Dlatego testujemy DWIE warstwy:
 *   (1) zachowanie — importujemy REALNE czytniki i sprawdzamy wynik;
 *   (2) kształt źródła — czytnik musi być ścisłym porównaniem `=== 'true'`.
 * Sama warstwa (1) nie wystarcza dla czytnika, którego moduł nie eksportuje.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

import { isInitiativeUnifiedReadEnabled } from '../../server/src/domain/initiatives-execution/initiativeUnifiedReader';
import { definitionApprovalEnabled } from '../../server/src/routes/pmo/definitionApprovalAdapter';

const REPO_ROOT = path.resolve(__dirname, '../..');

/** Flagi, które kandydat wprowadza/utrzymuje nad bazą 60051310d7. */
const FLAGS = [
  'ENABLE_INITIATIVE_UNIFIED_WRITE',
  'ENABLE_INITIATIVE_UNIFIED_READ',
  'ENABLE_INITIATIVE_APPROVAL_V2',
] as const;

/** Realne czytniki w kodzie produktu: plik → dokładne wyrażenie. */
const READERS: Array<{ flag: (typeof FLAGS)[number]; file: string }> = [
  { flag: 'ENABLE_INITIATIVE_UNIFIED_WRITE', file: 'server/src/controllers/InitiativeController.ts' },
  { flag: 'ENABLE_INITIATIVE_UNIFIED_WRITE', file: 'server/src/controllers/StaffingPlanController.ts' },
  {
    flag: 'ENABLE_INITIATIVE_UNIFIED_READ',
    file: 'server/src/domain/initiatives-execution/initiativeUnifiedReader.ts',
  },
  { flag: 'ENABLE_INITIATIVE_APPROVAL_V2', file: 'server/src/routes/pmo/definitionApprovalAdapter.ts' },
];

const readSource = (relative: string): string =>
  fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');

describe('K3 parytet: flagi nieustawione = wyłączone', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const flag of FLAGS) {
      saved[flag] = process.env[flag];
      delete process.env[flag];
    }
  });

  afterEach(() => {
    for (const flag of FLAGS) {
      if (saved[flag] === undefined) delete process.env[flag];
      else process.env[flag] = saved[flag];
    }
  });

  describe('warstwa 1 — zachowanie realnych czytników', () => {
    it('isInitiativeUnifiedReadEnabled() = false gdy zmienna NIEUSTAWIONA', () => {
      expect(process.env.ENABLE_INITIATIVE_UNIFIED_READ).toBeUndefined();
      expect(isInitiativeUnifiedReadEnabled()).toBe(false);
    });

    it('definitionApprovalEnabled() = false gdy zmienna NIEUSTAWIONA', () => {
      expect(process.env.ENABLE_INITIATIVE_APPROVAL_V2).toBeUndefined();
      expect(definitionApprovalEnabled()).toBe(false);
    });

    // Wartości „prawie prawdziwe" muszą dawać false — inaczej literówka w
    // zmiennej Railway (`True`, `1`, `yes`) po cichu włączyłaby nowy kod.
    it.each(['', 'false', 'False', '0', '1', 'yes', 'TRUE', 'True', ' true'])(
      'wartość %o nie włącza flagi',
      (value) => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = value;
        process.env.ENABLE_INITIATIVE_APPROVAL_V2 = value;
        expect(isInitiativeUnifiedReadEnabled()).toBe(false);
        expect(definitionApprovalEnabled()).toBe(false);
      }
    );

    it('dokładnie "true" włącza flagi (dowód, że test mierzy realny czytnik)', () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
      process.env.ENABLE_INITIATIVE_APPROVAL_V2 = 'true';
      expect(isInitiativeUnifiedReadEnabled()).toBe(true);
      expect(definitionApprovalEnabled()).toBe(true);
    });
  });

  describe('warstwa 2 — kształt źródła czytnika', () => {
    it.each(READERS)(
      '$file czyta $flag wyłącznie przez ścisłe === \'true\'',
      ({ flag, file }) => {
        const source = readSource(file);
        const occurrences = source
          .split('\n')
          .map((line, index) => ({ line, number: index + 1 }))
          .filter((entry) => entry.line.includes(`process.env.${flag}`));

        expect(
          occurrences.length,
          `brak czytnika ${flag} w ${file} — czytnik zniknął albo zmienił nazwę`
        ).toBeGreaterThan(0);

        for (const entry of occurrences) {
          const normalized = entry.line.replace(/\s+/g, '');
          expect(
            normalized,
            `${file}:${entry.number} — czytnik ${flag} musi być \`process.env.${flag} === 'true'\`; ` +
              `każda inna forma (!== 'false', ?? true, ternary, Boolean()) czyni flagę domyślnie WŁĄCZONĄ`
          ).toContain(`process.env.${flag}==='true'`);
        }
      }
    );

    it('żaden czytnik flagi nie używa formy domyślnie włączonej', () => {
      const forbidden = [/!==['"]false['"]/, /\?\?true/, /\|\|true/];
      for (const { flag, file } of READERS) {
        const lines = readSource(file)
          .split('\n')
          .filter((line) => line.includes(`process.env.${flag}`))
          .map((line) => line.replace(/\s+/g, ''));
        for (const line of lines) {
          for (const pattern of forbidden) {
            expect(pattern.test(line), `${file}: ${flag} — forma domyślnie ON: ${line}`).toBe(false);
          }
        }
      }
    });
  });
});

/**
 * Zamrożenie powierzchni API. Pomiar K3 (skan wieloliniowy obu drzew
 * server/src) dał: 0 tras USUNIĘTYCH względem bazy 60051310d7, 9 dodanych.
 * Trasa usunięta lub przemianowana = złamany parytet, bo front na demo
 * wywołuje ją dalej. Ten test zamraża trasy, które demo woła dziś.
 */
describe('K3 parytet: trasy bazy 60051310d7 nadal istnieją w kandydacie', () => {
  const FROZEN: Array<{ file: string; method: string; route: string }> = [
    // Rdzeń: Inicjatywy (router montowany pod prefiksem, stąd ścieżki `/:id`).
    { file: 'server/src/routes/pmo/initiatives.routes.ts', method: 'get', route: '/:id' },
    { file: 'server/src/routes/pmo/initiatives.routes.ts', method: 'delete', route: '/:id' },
    // Superadmin: eksport i usuwanie organizacji (trasa nadal zamontowana).
    { file: 'server/src/routes/superadmin.routes.ts', method: 'get', route: '/organizations/:id/export' },
    { file: 'server/src/routes/superadmin.routes.ts', method: 'delete', route: '/organizations/:id' },
  ];

  it.each(FROZEN)('$method $route nadal zamontowana w $file', ({ file, method, route }) => {
    const source = readSource(file).replace(/\s+/g, '');
    const needle = `router.${method}('${route}'`;
    expect(source, `${file}: brak ${method.toUpperCase()} ${route} — trasa zniknęła względem bazy`).toContain(
      needle
    );
  });
});
