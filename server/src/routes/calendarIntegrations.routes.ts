/**
 * CalendarIntegrations Routes (legacy path — honest stub)
 *
 * HISTORY: This file used to dynamically `import('../../routes/calendarIntegrations.js')`,
 * a JS module that was lost during the TS migration. That import throws at runtime
 * (module not found), so any route mounted from here would 500 / be dead. The lost JS
 * also never implemented real Google/Outlook OAuth.
 *
 * The LIVE calendar-integration routes are `routes/integrations/calendarIntegrations.routes.ts`
 * (mounted by Gateway + integrations/index.ts under `/api/integrations/calendar`). This file
 * is NOT mounted anywhere in current source — it is kept only as a defensive, honest fallback
 * so that if anything ever resolves this legacy path it returns a clear `not_configured`
 * status instead of crashing or pretending a connection is possible.
 *
 * No silent lies: we never report a provider as connectable here. Internal Consultify
 * calendar events (tasks/decisions/milestones) are served by the live routes, untouched.
 */

import { type Request, type Response, Router } from 'express';

const router = Router();

const NOT_CONFIGURED_PAYLOAD = {
  status: 'not_configured' as const,
  message:
    'Google/Outlook calendar OAuth integration is not available yet. Internal Consultify ' +
    'calendar events still work; use the ICS feed at /api/integrations/calendar/ics to ' +
    'subscribe from an external calendar.',
  providers: [
    { id: 'google', name: 'Google Calendar', connected: false, status: 'not_configured' },
    { id: 'outlook', name: 'Outlook', connected: false, status: 'not_configured' },
  ],
};

// Status / list — honest "not configured" rather than a fake "disconnected, click Connect".
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json(NOT_CONFIGURED_PAYLOAD);
});

// Any attempt to connect / authorize must NOT pretend to work.
router.all('/connect', (_req: Request, res: Response) => {
  res.status(501).json(NOT_CONFIGURED_PAYLOAD);
});
router.all('/:provider/connect', (_req: Request, res: Response) => {
  res.status(501).json(NOT_CONFIGURED_PAYLOAD);
});

export default router;
