/**
 * P02 §2.3.12 — Calendar Webhook Routes
 *
 * Receives push notifications from Google Calendar (watch) and
 * Microsoft Graph (subscriptions) to trigger immediate sync.
 */

import type { Request, Response } from 'express';
import { Router } from 'express';

import { handleWebhookNotification } from '../../services/v8/calendarSyncRuntime.js';
import logger from '../../utils/Logger.js';

const router = Router();
const LOG_PREFIX = '[P02-CalendarWebhook]';

/**
 * Google Calendar watch() callback.
 * Google sends POST with headers: X-Goog-Channel-ID, X-Goog-Resource-ID, X-Goog-Resource-State.
 */
router.post('/google', async (req: Request, res: Response) => {
  const channelId = req.get('X-Goog-Channel-ID');
  const resourceId = req.get('X-Goog-Resource-ID');
  const resourceState = req.get('X-Goog-Resource-State');

  logger.info(
    `${LOG_PREFIX} Google webhook: channel=${channelId}, resource=${resourceId}, state=${resourceState}`
  );

  if (resourceState === 'sync') {
    return res.status(200).send();
  }

  if (resourceId) {
    handleWebhookNotification('google', resourceId).catch((err) => {
      logger.error(`${LOG_PREFIX} Google webhook handler error: ${(err as Error).message}`);
    });
  }

  return res.status(200).send();
});

/**
 * Microsoft Graph subscription callback.
 * Graph sends POST with validationToken (for subscription creation) or change notifications.
 */
router.post('/microsoft', async (req: Request, res: Response) => {
  if (req.query.validationToken) {
    return res
      .status(200)
      .contentType('text/plain')
      .send(req.query.validationToken as string);
  }

  const notifications = req.body?.value;
  if (Array.isArray(notifications)) {
    for (const notification of notifications) {
      const resourceId = (notification.resource as string) || '';
      logger.info(
        `${LOG_PREFIX} Microsoft webhook: resource=${resourceId}, changeType=${notification.changeType}`
      );

      handleWebhookNotification('microsoft', resourceId).catch((err) => {
        logger.error(`${LOG_PREFIX} Microsoft webhook handler error: ${(err as Error).message}`);
      });
    }
  }

  return res.status(202).send();
});

export default router;
