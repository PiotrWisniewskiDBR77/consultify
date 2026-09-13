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

import type { PoolClient } from 'pg';

import { isInitiativeUnifiedReadEnabled } from '../../server/src/domain/initiatives-execution/initiativeUnifiedReader';
import { exportOrganizationData } from '../../server/src/services/organizationExportService';
import { ORGANIZATION_EXPORT_TABLES } from '../../server/src/services/organizationExportContract';
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

/**
 * K3b — REGRESJE PARYTETU ZMIERZONE NA ŻYWYM STANOWISKU (2026-09-13).
 *
 * Stanowisko: jedna baza (ścisły migrator kandydata), dwa API na tej samej
 * bazie, flagi NIEUSTAWIONE — baza 60051310d7 na 4305, kandydat na 4306.
 * Poniższe przypadki zamrażają to, co pomiar pokazał jako złamany parytet,
 * żeby regresja nie wróciła cicho przy kolejnym scaleniu.
 */
describe('K3b parytet: eksport organizacji znosi rozjazd kolumn zamiast dawać 500', () => {
  const ORGANIZATIONS = ORGANIZATION_EXPORT_TABLES.find(
    (entry) => entry.schema === 'public' && entry.table === 'organizations'
  )!;
  /** Kolumny kontraktu, których NIE MA baza ze ścisłego migratora (000_initdb… nigdy nie biegnie). */
  const BRAKUJACE = [
    'trial_extension_count',
    'trial_warning_sent_at',
    'onboarding_accept_idempotency_key',
  ];

  /** Atrapa katalogu Postgresa: odpowiada dokładnie na trzy zapytania systemowe eksportu. */
  function katalog(pominieteKolumny: string[] = []) {
    const wyslaneSql: string[] = [];
    const kolumny = Object.entries(ORGANIZATIONS.columnTypes).filter(
      ([name]) => !pominieteKolumny.includes(name)
    );
    const client = {
      query: async (sql: string, args: unknown[]) => {
        wyslaneSql.push(sql);
        if (sql.includes('format_type('))
          return {
            rows: kolumny.map(([column_name, data_type]) => ({
              schema_name: 'public',
              table_name: 'organizations',
              column_name,
              data_type,
            })),
          };
        if (sql.includes("con.contype='p'"))
          return {
            rows: [
              { schema_name: 'public', table_name: 'organizations', columns: ORGANIZATIONS.primaryKey },
            ],
          };
        if (sql.includes("con.contype='f'"))
          return {
            rows: ORGANIZATIONS.foreignKeys.map((fk) => ({
              child_schema: 'public',
              child_table: 'organizations',
              parent_schema: fk.parentSchema,
              parent_table: fk.parentTable,
              child_columns: fk.columns,
              parent_columns: fk.parentColumns,
              delete_action: fk.deleteAction,
            })),
          };
        return { rows: [{ id: args[0], name: 'Parytet K3b' }] };
      },
    } as unknown as PoolClient;
    return { client, wyslaneSql };
  }

  it('układ A (kolumny SĄ w bazie): eksport kompletny, zero pominięć', async () => {
    const { client } = katalog();
    const wynik = await exportOrganizationData(client, 'org-a', [ORGANIZATIONS]);
    expect(wynik.organization).not.toBeNull();
    expect(wynik.skipped).toEqual([]);
  });

  it('układ B (kolumn NIE MA): 200 z eksportem częściowym, nigdy wyjątek', async () => {
    const { client, wyslaneSql } = katalog(BRAKUJACE);
    const wynik = await exportOrganizationData(client, 'org-a', [ORGANIZATIONS]);
    // Regresja brzmiała: korzeń pominięty -> organization null -> 500 ORG_EXPORT_FAILED.
    expect(wynik.organization).not.toBeNull();
    for (const kolumna of BRAKUJACE) {
      expect(wynik.skipped).toContainEqual({
        tabela: 'organizations',
        kolumna,
        reason: 'declared_column_missing_in_schema',
      });
      expect(wyslaneSql.find((sql) => sql.includes('FROM "public"."organizations"'))).not.toContain(
        kolumna
      );
    }
    expect(wynik.securityManifest.unresolvedTables).toContainEqual({
      table: 'organizations',
      reason: 'schema_column_drift_partial_export',
    });
    expect(wynik.securityManifest.complete).toBe(false);
  });
});

describe('K3b parytet: ścieżki, które pomiar wskazał jako zmienione', () => {
  it('StaffingPlanController przy fladze OFF sprawdza plan w pełnym zakresie dzierżawcy', () => {
    // Pomiar: PUT na ISTNIEJĄCYM planie = 200 na obu API; 404 dostaje wyłącznie
    // plan nieistniejący (baza kłamała `{"success":true}`). Warunkiem tej
    // równoważności jest zakres zapytania: id + initiative_id + organization_id
    // (wszystkie trzy kolumny są NOT NULL, więc legalny plan zawsze się trafia).
    const source = readSource('server/src/controllers/StaffingPlanController.ts').replace(/\s+/g, '');
    expect(source).toContain(
      "SELECTidFROMstaffing_plansWHEREid=?ANDinitiative_id=?ANDorganization_id=?"
    );
  });

  it('GET /api/initiatives/:id nie wypuszcza aliasów SQL forecast_*_day', () => {
    const source = readSource('server/src/services/v8/planningPortfolioReadService.ts').replace(
      /\s+/g,
      ''
    );
    // Alias musi zostać ZDJĘTY z wiersza przed rozsypaniem go do odpowiedzi.
    expect(source).toContain('forecast_start_date_day:forecastStartDay');
    expect(source).toContain('forecast_end_date_day:forecastEndDay');
    expect(source).not.toContain('return{...initiative,');
  });
});
