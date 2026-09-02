/**
 * Harness dowodowy cross-org (dyżur weryfikacyjny 2026-09-02).
 * REALNY ApiGateway + REALNY Postgres. Zero atrap fetch, zero atrapy bazy.
 */
import express from 'express';
import cookieParser from 'cookie-parser';

const PORT = Number(process.env.PROOF_PORT || 5262);

async function main() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // dowód, że baza jest REALNA (nie atrapa)
  const { get: dbGet } = await import('../../server/src/utils/DbPromise.js');
  const probe: any = await dbGet('SELECT current_database() AS db, version() AS v');
  // eslint-disable-next-line no-console
  console.log('[HARNESS] DB PROBE: ' + JSON.stringify(probe));

  const { apiGateway } = await import('../../server/src/Gateway.js');
  apiGateway.initializeRoutes(app);

  const { errorHandlerMiddleware } = await import('../../server/src/utils/ErrorHandler.js');
  app.use(errorHandlerMiddleware as any);

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[HARNESS] LISTENING ${PORT}`);
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[HARNESS] FATAL', e);
  process.exit(1);
});
