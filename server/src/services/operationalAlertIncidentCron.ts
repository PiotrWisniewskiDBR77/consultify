import os from 'node:os';

import { persistOperationalAlertSnapshot } from './operationalAlertIncidentService.js';
import { operationalAlerts } from './operationalAlertService.js';

let inFlight = false;

function evaluatorId(): string {
  const raw =
    process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || os.hostname() || `pid-${process.pid}`;
  const safe = raw.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 96);
  return `${safe || 'unknown'}:${process.pid}`.slice(0, 128);
}

export async function persistCurrentOperationalAlerts(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    await persistOperationalAlertSnapshot({
      alerts: operationalAlerts.evaluate(),
      evaluatorId: evaluatorId(),
    });
  } finally {
    inFlight = false;
  }
}

export const __private__ = { evaluatorId };
