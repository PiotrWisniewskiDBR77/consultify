import express from 'express';

import partnerRoutes from '../../../server/src/routes/partners.routes.js';

const token = String(process.env.PRT_BVP_COLD_TOKEN || '');
if (!token) throw new Error('PRT_BVP_COLD_TOKEN is required');

const app = express();
app.use(express.json());
app.use('/api/partners', partnerRoutes);
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ success: false, error: error.message });
});
const server = app.listen(0, '127.0.0.1', async () => {
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Cold HTTP server has no TCP port');
    const base = `http://127.0.0.1:${address.port}/api/partners`;
    const headers = { Authorization: `Bearer ${token}` };
    const read = async (path: string) => {
      const response = await fetch(`${base}${path}`, { headers });
      const body = await response.json();
      if (!response.ok) throw new Error(`${path} -> ${response.status}: ${JSON.stringify(body)}`);
      return body;
    };
    const result = {
      connection: await read('/connection'),
      certifications: await read('/certifications'),
      referralTools: await read('/referral-tools'),
      attributions: await read('/attributions'),
    };
    process.stdout.write(`PRT_BVP_COLD_RESULT=${JSON.stringify(result)}\n`);
    server.close(() => process.exit(0));
  } catch (error) {
    process.stderr.write(`${(error as Error).stack || error}\n`);
    server.close(() => process.exit(1));
  }
});
