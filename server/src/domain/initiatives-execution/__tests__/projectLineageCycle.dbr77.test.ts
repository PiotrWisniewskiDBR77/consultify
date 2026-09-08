/**
 * [ODMROZENIE 06_EXECUTION DEC-453] Rodowod projektu nie moze krecic sie w kolo.
 *
 * POMIAR PRZED (2026-09-08, kopia bazy stagingu, organizacja DBR77):
 * `GET /api/initiatives/runtime-v1/execution-cases/a3e05d4a-…--acceptance--execution-case/work`
 * nie odpowiadal wcale (`curl -m 45` → `http=000 t=45.0`), a proces API po 25
 * takich porzuconych wywolaniach trzymal ~30 % CPU i rosl o ~0,5 MB/s.
 *
 * KSZTALT DANYCH, ktory to wywolal (odczytany z `ie_aggregate_state`):
 * kazdy agregat `initiative` niesie w `payload_json.initiativeId` WLASNE id
 * (16/16 wierszy DBR77), a inicjatywa akceptacyjna jako jedyna nie ma
 * `projectId`, wiec nie ratowal jej wczesniejszy `return [payload.projectId]`.
 *
 * Ten test uzywa ATRAPY puli, ktora liczy zapytania — bo defekt nie objawia sie
 * zlym WYNIKIEM, tylko brakiem konca. Bez straznika cyklu licznik zapytan rosnie
 * bez ograniczenia i test przekracza swoj czas (mutacja RED).
 */
import { describe, expect, it } from 'vitest';

import { PostgresInitiativeReader } from '../postgresInitiativeReader.js';

const ORG = 'a3e05d4a-5397-419d-b486-8e44366c0063';

/** Atrapa `pg.Pool` — tylko `query`, tylko odczyt `ie_aggregate_state`. */
function atrapaPuli(agregaty: Record<string, Record<string, unknown>>) {
  let liczbaZapytan = 0;
  const pool = {
    query: async (_sql: string, params: unknown[]) => {
      liczbaZapytan += 1;
      if (liczbaZapytan > 200) {
        throw new Error(`PETLA BEZ KONCA: ${liczbaZapytan} zapytan o rodowod projektu`);
      }
      const klucz = `${String(params[1])}|${String(params[2])}`;
      const payload = agregaty[klucz];
      return { rows: payload ? [{ payload_json: payload }] : [], rowCount: payload ? 1 : 0 };
    },
  };
  return { pool, liczbaZapytan: () => liczbaZapytan };
}

describe('rodowod projektu — straznik cyklu (dane DBR77)', () => {
  it('konczy sie przy inicjatywie wskazujacej sama siebie i bez projectId', async () => {
    const initiativeId = `${ORG}--acceptance--initiative`;
    const executionCaseId = `${ORG}--acceptance--execution-case`;
    const { pool, liczbaZapytan } = atrapaPuli({
      [`execution_case|${executionCaseId}`]: { initiativeId, executionCaseId },
      // Dokladny ksztalt z bazy: `initiativeId` = wlasne id, zero `projectId`.
      [`initiative|${initiativeId}`]: { initiativeId, title: 'Poprawa realizacji korzyści' },
    });
    const reader = new PostgresInitiativeReader(pool as never);

    const projectIds = await reader.resolveProjectIdsForAggregate(
      ORG,
      'execution_case',
      executionCaseId
    );

    expect(projectIds).toEqual([]);
    // Dwa wezly rodowodu = dokladnie dwa zapytania. Bez straznika atrapa rzuca.
    expect(liczbaZapytan()).toBe(2);
  });

  it('nie zmienia wyniku dla rodowodu bez cyklu (15/16 inicjatyw DBR77)', async () => {
    const initiativeId = 'demo-story-20260826-initiative-oee';
    const executionCaseId = 'demo-story-20260826-execution-oee';
    const { pool } = atrapaPuli({
      [`execution_case|${executionCaseId}`]: { initiativeId, executionCaseId },
      [`initiative|${initiativeId}`]: { initiativeId, projectId: 'projekt-oee' },
    });
    const reader = new PostgresInitiativeReader(pool as never);

    await expect(
      reader.resolveProjectIdsForAggregate(ORG, 'execution_case', executionCaseId)
    ).resolves.toEqual(['projekt-oee']);
  });

  it('konczy sie takze przy cyklu przez dwa agregaty', async () => {
    const { pool } = atrapaPuli({
      'material_change|mc-1': { target: { aggregateType: 'archive_manifest', aggregateId: 'am-1' } },
      'archive_manifest|am-1': { initiativeId: 'ini-1' },
      'initiative|ini-1': { executionCaseId: 'ec-1' },
      'execution_case|ec-1': { initiativeId: 'ini-1' },
    });
    const reader = new PostgresInitiativeReader(pool as never);

    await expect(
      reader.resolveProjectIdsForAggregate(ORG, 'material_change', 'mc-1')
    ).resolves.toEqual([]);
  });
});
