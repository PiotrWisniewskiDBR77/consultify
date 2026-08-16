import { describe, expect, it } from 'vitest';

import { OperationalAlertService } from '../../../server/src/services/operationalAlertService.js';

describe('OPS-OBS-001 operational alert seam', () => {
  it('rejects incomplete or unsafe cross-flow write evidence without retaining payload content', () => {
    const service = new OperationalAlertService(() => 1_000);
    expect(service.recordWrite({ correlationId: '', tenantId: 't1', actorId: 'a1', sourceId: 's1', result: 'SUCCESS' })).toBe(false);
    expect(service.recordWrite({ correlationId: 'contains secret', tenantId: 't1', actorId: 'a1', sourceId: 's1', result: 'SUCCESS' })).toBe(false);
    expect(service.evaluate().find((alert) => alert.kind === 'WRITE_FAILURE_RATE')?.value).toBe(0);
  });

  it('detects the positive-control write failure threshold and records recovery acknowledgment', () => {
    let now = 1_000_000;
    const service = new OperationalAlertService(() => now);
    for (let index = 0; index < 99; index += 1) {
      expect(service.recordWrite({ correlationId: `c-${index}`, tenantId: 'tenant-1', actorId: 'actor-1', sourceId: `task-${index}`, result: 'SUCCESS' })).toBe(true);
    }
    service.recordWrite({ correlationId: 'c-failure', tenantId: 'tenant-1', actorId: 'actor-1', sourceId: 'task-failure', result: 'FAILURE' });

    const breached = service.evaluate().find((alert) => alert.kind === 'WRITE_FAILURE_RATE')!;
    expect(breached).toMatchObject({ active: true, value: 0.01, threshold: 0.01, runbookId: 'OPS-OBS-001', correlationId: 'c-failure' });
    expect(service.acknowledgeRecovery('WRITE_FAILURE_RATE')).toBe(false);

    now += 5 * 60 * 1000 + 1;
    const recovered = service.evaluate().find((alert) => alert.kind === 'WRITE_FAILURE_RATE')!;
    expect(recovered.active).toBe(false);
    expect(recovered.recoveredAt).not.toBeNull();
    expect(service.acknowledgeRecovery('WRITE_FAILURE_RATE')).toBe(true);
    expect(service.evaluate().find((alert) => alert.kind === 'WRITE_FAILURE_RATE')?.acknowledgedAt).not.toBeNull();
  });

  it('evaluates outbox age, sustained DB saturation and repeated auth denial thresholds', () => {
    let now = 10 * 60 * 1000;
    const service = new OperationalAlertService(() => now);
    service.recordOutboxOldestAge(5 * 60 * 1000, 'outbox-correlation');
    service.recordDbSaturation(85, 'db-start');
    for (let index = 0; index < 5; index += 1) service.recordAuthDenial(`auth-${index}`);
    now += 10 * 60 * 1000;
    service.recordDbSaturation(82, 'db-end');

    const alerts = Object.fromEntries(service.evaluate().map((alert) => [alert.kind, alert]));
    expect(alerts.OUTBOX_OLDEST_AGE.active).toBe(false);
    expect(alerts.DB_SATURATION).toMatchObject({ active: true, value: 82, threshold: 80 });
    expect(alerts.REPEATED_AUTH_DENIALS.active).toBe(false);

    now += 1;
    service.recordOutboxOldestAge(5 * 60 * 1000, 'outbox-current');
    for (let index = 0; index < 5; index += 1) service.recordAuthDenial(`current-auth-${index}`);
    const currentAlerts = Object.fromEntries(service.evaluate().map((alert) => [alert.kind, alert]));
    expect(currentAlerts.OUTBOX_OLDEST_AGE.active).toBe(true);
    expect(currentAlerts.REPEATED_AUTH_DENIALS.active).toBe(true);
  });
});
