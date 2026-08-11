import express from 'express';
import { Pool } from 'pg';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as express.Request & { user: Record<string, string> }).user = {
    id: req.header('x-e2e-actor') || 'validator',
    organizationId: 'nordwerk-browser',
    role: 'USER',
  };
  next();
});

// Local full-shell preview support. These endpoints deliberately expose only
// the isolated ACO identity/project used by this runtime; they do not connect
// the preview to the main application database or any remote environment.
app.get('/api/auth/me', (_req, res) => {
  res.json({
    user: {
      id: 'validator',
      email: 'local-preview@consultify.test',
      firstName: 'Local',
      lastName: 'Preview',
      role: 'ADMIN',
      organizationId: 'nordwerk-browser',
      organizationName: 'NordWerk ACO Preview',
      isAuthenticated: true,
      language: 'pl',
    },
  });
});
app.post('/api/auth/login', (_req, res) => {
  res.json({
    token: 'local-ie-preview-token',
    refreshToken: 'local-ie-preview-refresh',
    user: {
      id: 'validator',
      email: 'local-preview@consultify.test',
      firstName: 'Local',
      lastName: 'Preview',
      role: 'ADMIN',
      organizationId: 'nordwerk-browser',
      organizationName: 'NordWerk ACO Preview',
      isAuthenticated: true,
      hasWorkspace: true,
      language: 'pl',
    },
  });
});
app.get('/api/organizations/current', (_req, res) => {
  res.json({
    organizations: [
      {
        id: 'nordwerk-browser',
        name: 'NordWerk ACO Preview',
        role: 'ADMIN',
        is_current: true,
      },
    ],
  });
});
app.get('/api/projects', (_req, res) => {
  res.json([
    {
      id: 'operations-transformation-2027',
      name: 'Operations Transformation 2027',
      organization_id: 'nordwerk-browser',
      status: 'ACTIVE',
    },
  ]);
});
app.get('/api/projects/my-memberships', (_req, res) => {
  res.json([
    {
      id: 'operations-transformation-2027',
      name: 'Operations Transformation 2027',
      organization_id: 'nordwerk-browser',
      role: 'OWNER',
    },
  ]);
});
app.get('/api/v8/admin/flags', (_req, res) => {
  res.json({
    data: {
      execution: true,
      initiatives: true,
      my_work: true,
    },
  });
});
app.use(
  '/api/initiatives/runtime-v1',
  createInitiativesExecutionRuntimeRouter({
    unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
    reader: new PostgresInitiativeReader(pool),
    authorize: async (_actor, projectId) => projectId === 'operations-transformation-2027',
    resolvePolicy: async () => ({
      policyId: 'standard-industrial',
      version: 3,
      baseline: 'STANDARD',
      strictness: 3,
      source: 'PROJECT',
      config: { selfApproval: false },
    }),
  })
);

const server = app.listen(3311, '127.0.0.1', () => console.log('visual runtime on 3311'));
const close = () => server.close(() => pool.end().finally(() => process.exit(0)));
process.on('SIGINT', close);
process.on('SIGTERM', close);
