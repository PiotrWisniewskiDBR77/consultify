import { makeTestApp } from '../../_helpers/testApp';

export async function loadChatProjectsRouter(): Promise<any> {
  return (await import('../../../../server/src/routes/chat-projects.routes.ts')).default;
}

export async function makeChatProjectsApp(opts?: {
  user?: { id?: string; organizationId?: string | null };
}): Promise<import('express').Express> {
  const router = await loadChatProjectsRouter();
  return makeTestApp({
    mountPath: '/api/chat-projects',
    router,
    beforeMount: (app) => {
      app.use((req, _res, next) => {
        const organizationId =
          opts?.user?.organizationId === undefined ? 'test-org-id' : opts.user.organizationId;
        (req as any).user = {
          id: opts?.user?.id ?? 'test-user-id',
          organizationId,
        };
        (req as any).userId = (req as any).user.id;
        (req as any).organizationId = (req as any).user.organizationId;
        next();
      });
    },
  });
}
