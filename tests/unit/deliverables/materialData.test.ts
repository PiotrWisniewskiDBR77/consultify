// @vitest-environment node
/**
 * W5.3 (FE bridge) — materialData klient: listConnectorTypes / previewConnector /
 * fetchFormDataset. Mockujemy `./api` + global fetch. Fail-soft → []/null.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({ Authorization: 'Bearer test' }),
}));

import {
  listConnectorTypes,
  previewConnector,
  fetchFormDataset,
} from '../../../src/services/materialData.js';

const okJson = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response;
const fail = (status = 500) => ({ ok: false, status, json: async () => ({}) }) as unknown as Response;

describe('W5.3 FE — materialData klient', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('listConnectorTypes → tablica typów', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ success: true, types: ['postgres', 'airtable'] })));
    expect(await listConnectorTypes()).toEqual(['postgres', 'airtable']);
  });

  it('listConnectorTypes — błąd HTTP → [] (fail-soft)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail()));
    expect(await listConnectorTypes()).toEqual([]);
  });

  it('listConnectorTypes — fetch rzuca → [] (fail-soft)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await listConnectorTypes()).toEqual([]);
  });

  it('previewConnector → dataset; POST z type+config+limit', async () => {
    const ds = { columns: ['a'], rows: [{ a: 1 }], rowCount: 1, source: { kind: 'connector', ref: 'postgres' } };
    const f = vi.fn().mockResolvedValue(okJson({ success: true, dataset: ds }));
    vi.stubGlobal('fetch', f);
    const out = await previewConnector('postgres', { host: 'x' }, 10);
    expect(out).toEqual(ds);
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain('/data/connectors/preview');
    expect(JSON.parse((init as any).body)).toEqual({ type: 'postgres', config: { host: 'x' }, limit: 10 });
  });

  it('previewConnector — błąd → null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(502)));
    expect(await previewConnector('postgres', {})).toBeNull();
  });

  it('fetchFormDataset → dataset; URL koduje formId', async () => {
    const ds = { columns: ['Imię'], rows: [{ 'Imię': 'Anna' }], rowCount: 1, source: { kind: 'form', ref: 'f 1' } };
    const f = vi.fn().mockResolvedValue(okJson({ success: true, dataset: ds }));
    vi.stubGlobal('fetch', f);
    const out = await fetchFormDataset('f 1');
    expect(out).toEqual(ds);
    expect(String(f.mock.calls[0][0])).toContain('/data/forms/f%201/dataset');
  });

  it('fetchFormDataset — fetch rzuca → null (fail-soft)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    expect(await fetchFormDataset('f1')).toBeNull();
  });
});
