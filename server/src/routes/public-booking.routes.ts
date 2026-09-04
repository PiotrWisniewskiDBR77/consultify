/**
 * #24c — Public Booking Routes (Calendly-like, NIEZALOGOWANE).
 *
 * Publiczne endpointy widgetu rezerwacji. Bez auth, rate-limited.
 * Montowane w Gateway.ts pod `/api/public/booking` PRZED routerami z auth.
 *
 *   GET  /api/public/booking/:consultantSlug/availability
 *   POST /api/public/booking/:consultantSlug/book   { name, email, topic, startAt, utm? }
 */

import { Request, Response, Router } from 'express';

import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import * as bookingService from '../services/v8/publicBookingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import { mapAppErrorResponse } from '../middleware/appErrorMapper.js';

const router = Router();

router.use(authRateLimiter);

router.get('/health', (_req, res) => {
  res.json({ success: true });
});

router.get(
  '/:consultantSlug/availability',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = String(req.params.consultantSlug);
    try {
      const result = await bookingService.getAvailability(slug);
      res.json({ success: true, ...result });
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      if (status === 404)
        return res.status(404).json({ success: false, error: 'Consultant not found' });
      logger.error(`[#24c] availability failed for ${slug}: ${(err as Error).message}`);
      return res.status(500).json({ success: false, error: 'Failed to load availability' });
    }
  })
);

router.post(
  '/:consultantSlug/book',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = String(req.params.consultantSlug);
    const { name, email, topic, startAt, utm } = req.body ?? {};
    try {
      const result = await bookingService.createBooking({ slug, name, email, topic, startAt, utm });
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      if (status >= 400 && status < 500) {
        return res.status(status).json({ success: false, ...mapAppErrorResponse((err as Error), undefined, 'error') });
      }
      logger.error(`[#24c] booking failed for ${slug}: ${(err as Error).message}`);
      return res.status(500).json({ success: false, error: 'Failed to create booking' });
    }
  })
);

export default router;
