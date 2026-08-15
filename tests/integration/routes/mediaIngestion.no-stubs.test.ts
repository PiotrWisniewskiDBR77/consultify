import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Media ingestion routes (no degraded fake success)', () => {
  const basePath = '/api/media-ingestion';

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
  });

  const mount = async () => {
    const router = (await import('../../../server/src/routes/media-ingestion.routes.ts')).default;
    return makeTestApp({ mountPath: basePath, router });
  };

  it('GET /supported-types returns 503 when service is unavailable (no fake [])', async () => {
    const res = await request(await mount()).get(`${basePath}/supported-types`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({ status: false, type: 'not_configured' })
    );
  });

  it('GET /capabilities returns 503 when service is unavailable (no fake {})', async () => {
    const res = await request(await mount()).get(`${basePath}/capabilities`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({ status: false, type: 'not_configured' })
    );
  });

  it('POST /validate returns 400 when filename/mimeType missing', async () => {
    const res = await request(await mount()).post(`${basePath}/validate`).send({});
    expect(res.status).toBe(400);
  });

  it('POST /validate returns 503 when service is unavailable', async () => {
    const res = await request(await mount())
      .post(`${basePath}/validate`)
      .send({ filename: 'x.png', mimeType: 'image/png' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({ status: false, type: 'not_configured' })
    );
  });

  it('POST /ingest/batch returns 503 (UI endpoint)', async () => {
    const res = await request(await mount()).post(`${basePath}/ingest/batch`).send({});
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ status: false, type: 'not_configured' }));
  });

  it('POST /ingest/youtube returns 503 (UI endpoint)', async () => {
    const res = await request(await mount())
      .post(`${basePath}/ingest/youtube`)
      .send({ url: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ status: false, type: 'not_configured' }));
  });

  it('POST /ingest/url returns 503 (UI endpoint)', async () => {
    const res = await request(await mount())
      .post(`${basePath}/ingest/url`)
      .send({ url: 'https://example.com' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ status: false, type: 'not_configured' }));
  });
});
