import { makeTestApp } from '../../_helpers/testApp';

export async function loadInitiativesRouter(): Promise<any> {
  return (await import('../../../../server/src/routes/pmo/initiatives.routes.ts')).default;
}

export async function makeInitiativesApp(opts?: {
  user?: { id?: string; organizationId?: string; role?: string };
}): Promise<import('express').Express> {
  const router = await loadInitiativesRouter();
  return makeTestApp({
    mountPath: '/api/initiatives',
    router,
    beforeMount: (app) => {
      app.use((req, _res, next) => {
        (req as any).user = {
          id: opts?.user?.id ?? 'test-user-id',
          organizationId: opts?.user?.organizationId ?? 'test-org-id',
          role: opts?.user?.role ?? 'ADMIN',
        };
        (req as any).userId = (req as any).user.id;
        (req as any).organizationId = (req as any).user.organizationId;
        next();
      });
    },
  });
}
