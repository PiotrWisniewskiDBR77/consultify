import cors from 'cors';
import express from 'express';

import { ApiGateway } from '../../../server/src/Gateway.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
// Shell-only endpoints normally mounted by server/index.ts before ApiGateway.
// The E2 business routes below are never intercepted or stubbed.
app.get('/api/csrf-token', (_req, res) => res.json({ csrfToken: 'f23-browser-proof' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.post('/api/analytics/web-vitals', (_req, res) => res.status(204).end());
ApiGateway.getInstance().initializeRoutes(app);
app.use(errorHandlerMiddleware);

app.listen(4217, '127.0.0.1', () => {
  console.log('F2-3 E2 browser ApiGateway listening on 4217');
});
