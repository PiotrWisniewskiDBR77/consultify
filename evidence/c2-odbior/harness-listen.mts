// C2-ODBIÓR — minimalny nasłuch HTTP bez server/src/index.ts (Z30-bezpieczny:
// zero Schedulera, zero cronów, zero drenaży outboxu). Realne trasy przez ApiGateway.
import express from 'express';
import { ApiGateway } from '../../server/src/Gateway.js';

const port = Number(process.env.PORT || 4231);
const app = express();
app.use(express.json({ limit: '10mb' }));
ApiGateway.getInstance().initializeRoutes(app);
app.listen(port, '127.0.0.1', () => {
  console.log(`C2_HARNESS_LISTENING port=${port} unified=${process.env.ENABLE_INITIATIVE_UNIFIED_READ}`);
});
