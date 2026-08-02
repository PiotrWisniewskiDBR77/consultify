/**
 * MAT-007/009 test-only harness (NOT part of the app, not imported anywhere).
 *
 * The full Gateway (server/src/Gateway.ts) has a pre-existing, unrelated
 * ordering issue: server/src/routes/pmo/workstreams.routes.ts:77 calls
 * `router.use(verifyToken)` with no path scope while mounted at bare '/api'
 * (Gateway.ts:984, `app.use('/api', workstreamsRoutes)`), BEFORE the
 * presentations router mounts (Gateway.ts:1025). Since Express dispatches
 * middleware in registration order, every '/api/*' request — including the
 * intentionally-public `GET /api/presentations/shared/:token` viewer — hits
 * that blanket verifyToken first and gets 401'd before ever reaching
 * presentations.routes.ts. Confirmed locally via req.baseUrl === '/api' at
 * the point verifyToken rejects. This is NOT something MAT-007/009 touches
 * or introduced; it's flagged separately (see report).
 *
 * To verify the presentations router's OWN share/revoke contract in
 * isolation from that unrelated bug, this harness mounts ONLY
 * presentations.routes.ts on a bare Express app — exactly the code this
 * task is responsible for — and exercises GET /shared/:token before and
 * after revoke.
 */
import express from 'express';

import '../src/config/loadEnv.js';
import presentationsRoutes from '../src/routes/presentations.routes.js';

async function main() {
  const app = express();
  app.use(express.json());
  app.use('/api/presentations', presentationsRoutes);

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}/api/presentations`;

  const token = process.argv[2];
  const deckId = process.argv[3];
  const authToken = process.argv[4];

  const before = await fetch(`${base}/shared/${token}`);
  console.log('public read BEFORE revoke: status', before.status);
  const beforeBody = await before.json();
  console.log('has cards:', Array.isArray(JSON.parse(beforeBody?.data?.deck_json || 'null')?.cards));

  const revoke = await fetch(`${base}/decks/${deckId}/share`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  console.log('revoke via isolated app: status', revoke.status, JSON.stringify(await revoke.json()));

  const after = await fetch(`${base}/shared/${token}`);
  console.log('public read AFTER revoke: status', after.status);

  server.close();
  process.exit(after.status === 404 && before.status === 200 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
