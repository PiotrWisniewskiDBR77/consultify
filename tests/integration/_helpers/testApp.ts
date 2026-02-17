import express from 'express';
import net from 'node:net';

export async function canBindEphemeralPort(): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(0, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}

export function makeTestApp(opts: {
  mountPath: string;
  router: any;
  sessionId?: string;
  beforeMount?: (app: express.Express) => void;
}): express.Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  if (opts.sessionId) {
    app.use((req, _res, next) => {
      (req as any).sessionId = opts.sessionId;
      next();
    });
  }
  opts.beforeMount?.(app);
  app.use(opts.mountPath, opts.router);
  return app;
}
