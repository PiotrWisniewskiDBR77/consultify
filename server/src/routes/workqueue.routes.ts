/**
 * workqueue.routes — intencjonalny STUB.
 *
 * Tło: commit `5dc7d21090` (refactor M14/F0 „usunięcie martwego kodu + workqueue stub")
 * USUNĄŁ pełną implementację workqueue, ale plik-stub nie został zacommitowany, podczas
 * gdy importy w `routes/index.ts` i `Gateway.ts` (mount przez `mountStub('/api/workqueue')`)
 * pozostały → serwer nie wstawał z obecnego źródła (ERR_MODULE_NOT_FOUND). Ten plik
 * przywraca spójność builda zgodnie z intencją „stub" (NIE pełna impl — ta żyje w osobnej
 * gałęzi/worktree i ma być wprowadzona świadomie, jeśli funkcja wraca).
 *
 * Zachowanie: każdy endpoint /api/workqueue zwraca 501 (Not Implemented) — jawnie,
 * zamiast 404 czy crashu. Przywrócono 2026-06-24 (sprzątanie po nocnym runie M05–M09).
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

router.use((_req: Request, res: Response) => {
  res.status(501).json({
    error: 'workqueue is not implemented (intentional stub)',
    code: 'WORKQUEUE_STUB',
  });
});

export default router;
