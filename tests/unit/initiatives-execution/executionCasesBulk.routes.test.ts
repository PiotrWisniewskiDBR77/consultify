/**
 * GET /execution-cases/bulk — zbiorczy odczyt pracy i przydzialow.
 *
 * DLACZEGO TA TRASA ISTNIEJE (pomiar wydajnosci stagingu 2026-09-11,
 * `POMIAR_WYDAJNOSCI_STAGING_20260911.md`: Realizacja LCP 11,4 s): zakladka
 * Praca wolala `…/<id>/work` osobno dla kazdej realizacji (1 + N zadan), a
 * Zasoby dodatkowo `…/<id>/allocations` (1 + 2N).
 *
 * CZEGO PILNUJE TEN TEST — kontraktu, nie wydajnosci:
 *  · ROUTING: slowo `bulk` NIE moze zostac zlapane przez `/:executionCaseId`
 *    (trasa zbiorcza jest zarejestrowana wczesniej) — inaczej 404 zawsze,
 *  · WIDOCZNOSC: realizacja, ktorej uzytkownik nie moze ogladac, NIE WCHODZI do
 *    odpowiedzi i wraca w `missingIds` (fail-closed, ta sama regula co trasy
 *    pojedyncze),
 *  · TENANT: czytamy WYLACZNIE z `organizationId` aktora,
 *  · SUFIT: powyzej 100 identyfikatorow trasa odmawia, zamiast mielic cala
 *    organizacje w jednym zapytaniu,
 *  · KSZTALT: `work` i `allocations` identyczne jak z tras pojedynczych.
 *
 * DOWOD MUTACYJNY (wykonany 2026-09-11): usuniecie warunku `canViewAggregate`
 * z petli -> przypadek „realizacja niewidoczna" jest czerwony (wyciek danych
 * obcego projektu). Przeniesienie rejestracji trasy ZA `/:executionCaseId` ->
 * przypadek routingu czerwony (404).
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

const WIDOCZNE = new Set(['exec-1', 'exec-2']);

function buildApp() {
  const uzyteOrganizacje: string[] = [];
  const reader = {
    resolveProjectIdsForAggregate: vi.fn(
      async (_organizationId: string, aggregateType: string, aggregateId: string) => {
        if (aggregateType !== 'execution_case') return [];
        // `exec-obcy` nalezy do projektu, do ktorego aktor nie ma dostepu.
        if (WIDOCZNE.has(aggregateId)) return ['proj-1'];
        return ['proj-obcy'];
      }
    ),
    listExecutionTasks: vi.fn(async (organizationId: string, executionCaseId: string) => {
      uzyteOrganizacje.push(organizationId);
      return [{ taskId: `${executionCaseId}-t1`, title: 'Zadanie', status: 'IN_PROGRESS' }];
    }),
    listExecutionDecisions: vi.fn(async (_organizationId: string, executionCaseId: string) => [
      { decisionId: `${executionCaseId}-d1`, state: 'REQUESTED' },
    ]),
    listOperationalAllocations: vi.fn(async (_organizationId: string, executionCaseId: string) => [
      { allocationId: `${executionCaseId}-a1`, taskId: `${executionCaseId}-t1` },
    ]),
  };
  const deps = {
    unitOfWork: {} as never,
    reader: reader as never,
    authorize: vi.fn(async (_actor: unknown, projectId: string) => projectId === 'proj-1'),
    resolvePolicy: vi.fn(async () => ({ policyId: 'p', version: 1 }) as never),
  };
  const app: Express = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { user: Record<string, unknown> }).user = {
      id: 'user-1',
      organizationId: 'org-1',
      role: 'ADMIN',
    };
    next();
  });
  app.use('/api/initiatives/runtime-v1', createInitiativesExecutionRuntimeRouter(deps as never));
  return { app, reader, uzyteOrganizacje };
}

describe('GET /execution-cases/bulk', () => {
  it('zwraca prace i przydzialy WIELU realizacji w JEDNEJ odpowiedzi', async () => {
    const { app, reader } = buildApp();
    const res = await request(app)
      .get('/api/initiatives/runtime-v1/execution-cases/bulk')
      .query({ ids: 'exec-1,exec-2' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.cases).toHaveLength(2);
    expect(res.body.missingIds).toEqual([]);
    const pierwszy = res.body.cases.find((c: any) => c.executionCaseId === 'exec-1');
    // KSZTALT 1:1 z trasami pojedynczymi: {tasks,decisions} oraz {items}.
    expect(pierwszy.work.tasks[0].taskId).toBe('exec-1-t1');
    expect(pierwszy.work.decisions[0].decisionId).toBe('exec-1-d1');
    expect(pierwszy.allocations.items[0].allocationId).toBe('exec-1-a1');
    expect(reader.listExecutionTasks).toHaveBeenCalledTimes(2);
  });

  it('TENANT: czyta wylacznie z organizacji aktora', async () => {
    const { app, uzyteOrganizacje } = buildApp();
    await request(app)
      .get('/api/initiatives/runtime-v1/execution-cases/bulk')
      .query({ ids: 'exec-1,exec-2' });
    expect(new Set(uzyteOrganizacje)).toEqual(new Set(['org-1']));
  });

  it('FAIL-CLOSED: realizacja niewidoczna nie wchodzi do danych, wraca w missingIds', async () => {
    const { app, reader } = buildApp();
    const res = await request(app)
      .get('/api/initiatives/runtime-v1/execution-cases/bulk')
      .query({ ids: 'exec-1,exec-obcy' });
    expect(res.status).toBe(200);
    expect(res.body.cases.map((c: any) => c.executionCaseId)).toEqual(['exec-1']);
    expect(res.body.missingIds).toEqual(['exec-obcy']);
    // Dowod, ze to NIE jest filtr na wyjsciu: danych obcej realizacji nawet nie czytamy.
    expect(reader.listExecutionTasks).toHaveBeenCalledTimes(1);
    expect(reader.listOperationalAllocations).toHaveBeenCalledTimes(1);
  });

  it('SUFIT: powyzej 100 identyfikatorow trasa odmawia', async () => {
    const { app, reader } = buildApp();
    const ids = Array.from({ length: 101 }, (_, i) => `exec-${i}`).join(',');
    const res = await request(app)
      .get('/api/initiatives/runtime-v1/execution-cases/bulk')
      .query({ ids });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOO_MANY_IDS');
    expect(reader.listExecutionTasks).not.toHaveBeenCalled();
  });

  it('bez `ids` odmawia zamiast czytac cokolwiek', async () => {
    const { app, reader } = buildApp();
    const res = await request(app).get('/api/initiatives/runtime-v1/execution-cases/bulk');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IDS_REQUIRED');
    expect(reader.listExecutionTasks).not.toHaveBeenCalled();
  });

  it('ROUTING: `bulk` nie jest traktowane jak identyfikator realizacji', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .get('/api/initiatives/runtime-v1/execution-cases/bulk')
      .query({ ids: 'exec-1' });
    // Gdyby `/:executionCaseId` zlapalo sciezke pierwsze, dostalibysmy 404
    // (findExecutionCase nie istnieje w tej atrapie) — nie 200 z `cases`.
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cases)).toBe(true);
  });

  it('powtorzone identyfikatory czytane sa RAZ', async () => {
    const { app, reader } = buildApp();
    const res = await request(app)
      .get('/api/initiatives/runtime-v1/execution-cases/bulk')
      .query({ ids: 'exec-1,exec-1,exec-1' });
    expect(res.status).toBe(200);
    expect(res.body.cases).toHaveLength(1);
    expect(reader.listExecutionTasks).toHaveBeenCalledTimes(1);
  });
});
