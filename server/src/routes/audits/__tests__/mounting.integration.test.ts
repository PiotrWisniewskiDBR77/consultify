/**
 * Dowód montażu tras Audits w realnym Gateway.
 *
 * DLACZEGO TEN TEST ISTNIEJE:
 * Ten projekt ma udokumentowaną historię tras, które istnieją w pliku, ale nie
 * są zamontowane — `server/src/routes/audit.routes.ts` jest właśnie takim
 * przypadkiem (montowany przez `mountStub`, który na demo i produkcji go
 * pomija, więc endpoint zwraca 404 mimo kompletnego kodu). Test sprawdzający
 * wyłącznie serwis przeszedłby, a użytkownik dostałby 404.
 *
 * Test buduje aplikację przez ten sam `initializeRoutes`, którego używa
 * produkcyjny bootstrap, i pyta o odpowiedzi HTTP. 401 jest tu wynikiem
 * POZYTYWNYM: znaczy, że żądanie dotarło do routera i zostało odrzucone przez
 * uwierzytelnienie. 404 znaczyłoby, że trasy nie ma.
 */
import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let app: express.Express;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  const { apiGateway } = await import('../../../Gateway.js');
  apiGateway.initializeRoutes(app);
}, 120_000);

const MOUNTED_PATHS = [
  '/api/audits/sources',
  '/api/audits/packs',
  '/api/audits/programs',
  '/api/audits/criteria',
  '/api/audits/evidence',
  '/api/audits/findings',
  '/api/audits/actions',
  '/api/audits/outputs',
  '/api/audits/reports',
  '/api/audits/proposals',
  '/api/audits/ai/proposals',
  '/api/audits/trail/events',
];

describe('Audits — montaż tras w Gateway', () => {
  it.each(MOUNTED_PATHS)('%s jest zamontowana i chroniona (nie 404)', async (path) => {
    const res = await request(app).get(path);
    expect(
      res.status,
      `${path} zwróciło ${res.status}. 404 oznacza, że router nie jest zamontowany.`,
    ).not.toBe(404);
    expect([401, 403]).toContain(res.status);
  });

  /**
   * Uwierzytelnienie jest założone na CAŁEJ przestrzeni `/api/audits`
   * (`router.use(verifyToken)` w agregatorze), więc nieznana podtrasa też
   * kończy się na 401, a nie na 404. To celowe i lepsze: anonim nie może
   * odpytać serwera o mapę istniejących endpointów audytu.
   *
   * Test pilnuje, żeby ta przestrzeń nigdy nie zaczęła odpowiadać anonimowo —
   * 200 albo 500 tutaj oznaczałoby dziurę w bramce.
   */
  it('nieznana podtrasa Audits nie odpowiada anonimowi niczym poza odmową', async () => {
    const res = await request(app).get('/api/audits/nie-ma-takiej-trasy');
    expect([401, 403, 404]).toContain(res.status);
  });

  it('stary hub orkiestratora pozostaje działający pod /api/audit', async () => {
    const res = await request(app).get('/api/audit/programs');
    expect(res.status).not.toBe(404);
    expect([401, 403]).toContain(res.status);
  });
});
