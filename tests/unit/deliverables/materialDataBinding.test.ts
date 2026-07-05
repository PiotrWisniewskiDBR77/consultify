// @vitest-environment node
/**
 * W5.1/W5.2 — materialDataBinding: kompozycja F5 (connectorFramework + formularze)
 * → MaterialDataset → intent tabeli. Konektor testujemy przez fałszywą rejestrację,
 * formularz przez DI (bez DB).
 */
import { describe, expect, it, beforeAll } from 'vitest';
import {
  connectorDataset,
  formDataset,
  datasetToTableIntent,
  MATERIAL_DATASET_MAX_ROWS,
  type MaterialDataset,
} from '../../../server/src/services/deliverables/materialDataBinding.js';
import { connectorRegistry, type IConnector } from '../../../server/src/services/dataCollection/connectorFramework.js';

// Fałszywy konektor zwracający deterministyczne rekordy.
const FAKE_ROWS = [
  { id: '1', name: 'Apator', revenue: 1200, region: 'PL' },
  { id: '2', name: 'Elkomtech', revenue: 800, region: 'PL' },
  { id: '3', name: 'VTS', revenue: 2100 }, // brak region → kolumna pojawia się z 1. wiersza
];
const fakeConnector: IConnector = {
  type: 'fake_test_src',
  async testConnection() { return { success: true }; },
  async fetchSchema() { return { tables: [] }; },
  async fetchRecords(_config, options) {
    const limit = options?.limit ?? FAKE_ROWS.length;
    return FAKE_ROWS.slice(0, limit).map((data) => ({ externalId: String(data.id), data }));
  },
};

describe('W5.1 — connectorDataset (kompozycja connectorFramework)', () => {
  beforeAll(() => { connectorRegistry.register('fake_test_src', fakeConnector); });

  it('zwraca dataset z kolumnami w kolejności pierwszego-widzianego', async () => {
    const ds = await connectorDataset('fake_test_src', {});
    expect(ds).not.toBeNull();
    expect(ds!.columns).toEqual(['id', 'name', 'revenue', 'region']);
    expect(ds!.rowCount).toBe(3);
    expect(ds!.source).toEqual({ kind: 'connector', ref: 'fake_test_src' });
  });

  it('wiersze = data z ExternalRecord (realne wartości, nie zmyślone)', async () => {
    const ds = await connectorDataset('fake_test_src', {});
    expect(ds!.rows[0]).toMatchObject({ name: 'Apator', revenue: 1200 });
  });

  it('respektuje limit', async () => {
    const ds = await connectorDataset('fake_test_src', {}, { limit: 2 });
    expect(ds!.rowCount).toBe(2);
  });

  it('nieznany typ konektora → null (fail-soft)', async () => {
    expect(await connectorDataset('nieistnieje_xyz', {})).toBeNull();
  });

  it('limit cap = MATERIAL_DATASET_MAX_ROWS', async () => {
    const ds = await connectorDataset('fake_test_src', {}, { limit: 99999 });
    // fetchRecords dostaje min(limit, cap); fake ma 3 wiersze
    expect(ds!.rowCount).toBeLessThanOrEqual(MATERIAL_DATASET_MAX_ROWS);
  });
});

describe('W5.2 — formDataset (DI, bez DB)', () => {
  it('zgłoszenia → wiersze; etykiety pól → nagłówki kolumn', async () => {
    const ds = await formDataset('form-1', {
      fetchSubmissions: async () => ({
        records: [
          { id: 'r1', data: { f_name: 'Anna', f_score: 9 } },
          { id: 'r2', data: { f_name: 'Piotr', f_score: 7 } },
        ],
        total: 2,
      }),
      fieldLabels: { f_name: 'Imię', f_score: 'Ocena' },
    });
    expect(ds).not.toBeNull();
    expect(ds!.columns).toEqual(['Imię', 'Ocena']);
    expect(ds!.rows[0]).toEqual({ Imię: 'Anna', Ocena: 9 });
    expect(ds!.source).toEqual({ kind: 'form', ref: 'form-1' });
  });

  it('brak etykiet → klucze surowe', async () => {
    const ds = await formDataset('form-2', {
      fetchSubmissions: async () => ({ records: [{ id: 'r1', data: { raw_key: 'x' } }], total: 1 }),
    });
    expect(ds!.columns).toEqual(['raw_key']);
  });

  it('fetchSubmissions rzuca → null (fail-soft)', async () => {
    const ds = await formDataset('form-err', {
      fetchSubmissions: async () => { throw new Error('DB down'); },
    });
    expect(ds).toBeNull();
  });
});

describe('datasetToTableIntent', () => {
  const ds: MaterialDataset = {
    columns: ['name', 'revenue'],
    rows: [{ name: 'Apator', revenue: 1200 }],
    rowCount: 1,
    source: { kind: 'connector', ref: 'postgres' },
  };

  it('niesie kolumny + próbkę realnych danych + źródło', () => {
    const intent = datasetToTableIntent(ds, 'Klienci');
    expect(intent).toContain('Klienci');
    expect(intent).toContain('name, revenue');
    expect(intent).toContain('konektor postgres');
    expect(intent).toContain('Apator');
  });

  it('pusty dataset → pusty string', () => {
    expect(datasetToTableIntent(null, 'X')).toBe('');
    expect(datasetToTableIntent({ ...ds, columns: [] }, 'X')).toBe('');
  });
});
