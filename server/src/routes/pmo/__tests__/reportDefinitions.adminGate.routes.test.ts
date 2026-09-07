/**
 * [ODMROZENIE 06_EXECUTION DEC-453] P16-R6 (D6, test m z §6):
 * „serwer: POST definicji dla MEMBER → 403".
 *
 * POMIAR 07.09 (`ExecutionReportsSurface.tsx:789-799`, komentarz teraz
 * usunięty): `POST /report-definitions/:definitionId` i jego `/transitions`
 * nie miały ŻADNEGO ograniczenia roli — ukryty przycisk „Nowa definicja" w
 * Menu 2/Menu 3 nie był bramką, MEMBER mógł wywołać obie trasy wprost z
 * konsoli. Naprawa: `requireOrgRole('admin')` w łańcuchu middleware PRZED
 * `asyncHandler`.
 *
 * Zakres projektu (`scope.projectIds`) jest w body CELOWO niepusty i
 * `deps.authorize`/`deps.reader.resolveProjectIdsForAggregate` CELOWO
 * mockowane na sukces — inaczej ten sam router ma WCZEŚNIEJSZĄ, ogólną bramkę
 * `CAPABILITY_REQUIRED` (pusty zakres projektów → 403 dla KAŻDEJ roli,
 * `initiativesExecutionRuntime.routes.ts:1563-1568`), która zamaskowałaby
 * bramkę roli testowaną tutaj — zmierzone przy pierwszym uruchomieniu tego
 * pliku (empty body dawał 403 nawet dla ADMIN, z innego powodu).
 *
 * MUTACJA, na którą ten plik reaguje: usunięcie `requireOrgRole('admin')`
 * z jednej z dwóch tras (create/transitions) ma przewrócić odpowiedni test
 * 403 poniżej — payload jest celowo NIEWAŻNY wg kontraktu definicji (brak
 * `expectedVersion`/`clientRequestId`/pól formuł), więc jeśli bramka
 * zniknie, odpowiedź spadnie do 400 (walidacja), nie 403 (rola), i test to
 * złapie.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

describe('P16-R6 — POST /report-definitions[/transitions] wymaga roli admin', () => {
  const resolveProjectIdsForAggregate = vi.fn();
  const authorize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resolveProjectIdsForAggregate.mockResolvedValue(['project-x']);
    authorize.mockResolvedValue(true);
  });

  const makeApp = (role: string | undefined) => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = role ? { id: 'user-a', organizationId: 'org-a', role } : {
        id: 'user-a',
        organizationId: 'org-a',
      };
      if (role) (req as any).userRole = role;
      next();
    });
    app.use(
      '/api/v8/pmo/initiatives-execution',
      createInitiativesExecutionRuntimeRouter({
        unitOfWork: {} as any,
        reader: { resolveProjectIdsForAggregate } as any,
        authorize,
        resolvePolicy: vi.fn(),
      })
    );
    return app;
  };

  const CREATE_BODY = { scope: { projectIds: ['project-x'] } };

  it('MEMBER (role "user") → 403 na create definicji, mimo poprawnego zakresu projektu', async () => {
    const response = await request(makeApp('user'))
      .post('/api/v8/pmo/initiatives-execution/report-definitions/def-1')
      .send(CREATE_BODY);
    expect(response.status).toBe(403);
  });

  it('MEMBER (role "user") → 403 na transitions definicji', async () => {
    const response = await request(makeApp('user'))
      .post('/api/v8/pmo/initiatives-execution/report-definitions/def-1/transitions')
      .send({});
    expect(response.status).toBe(403);
  });

  it('ADMIN → NIE zablokowany przez rolę (przechodzi bramkę, pada dopiero na walidacji body = 400)', async () => {
    const response = await request(makeApp('admin'))
      .post('/api/v8/pmo/initiatives-execution/report-definitions/def-1')
      .send(CREATE_BODY);
    // Body ma poprawny zakres projektu, ale brakuje reszty kontraktu
    // (`expectedVersion`/`clientRequestId`/formuł) — 400 dowodzi, że bramka
    // roli PRZEPUŚCIŁA żądanie do handlera (gdyby nadal blokowała admina,
    // dostalibyśmy 403, nie 400).
    expect(response.status).toBe(400);
  });

  it('ADMIN → NIE zablokowany przez rolę na transitions (przechodzi bramkę, pada na walidacji = 400)', async () => {
    const response = await request(makeApp('admin'))
      .post('/api/v8/pmo/initiatives-execution/report-definitions/def-1/transitions')
      .send({});
    expect(response.status).toBe(400);
  });

  it('OWNER (superadmin canonical) → też przechodzi bramkę roli (400 na walidacji, nie 403)', async () => {
    const response = await request(makeApp('owner'))
      .post('/api/v8/pmo/initiatives-execution/report-definitions/def-1')
      .send(CREATE_BODY);
    expect(response.status).toBe(400);
  });

  it('brak roli w ogóle (undefined) → 403, nie przechodzi cicho', async () => {
    const response = await request(makeApp(undefined))
      .post('/api/v8/pmo/initiatives-execution/report-definitions/def-1')
      .send(CREATE_BODY);
    expect(response.status).toBe(403);
  });
});
