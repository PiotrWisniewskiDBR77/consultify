// @vitest-environment node
/**
 * Unit test — W6.2: deliverViaEmail un-stub.
 * Previously logged only (0 sends). Now actually calls emailService.send per
 * recipient. Tests via injected mock emailService + private-method invocation.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { scheduledReportService } from '../../../server/src/services/scheduledReportService.js';

function scheduleWith(recipients: string[], subject?: string) {
  return {
    name: 'Raport tygodniowy',
    deliveryMethods: ['email'],
    deliveryConfig: { email: { recipients, subject, attachmentFormat: 'pdf' } },
  } as any;
}

describe('W6.2 — deliverViaEmail un-stub', () => {
  it('wysyła realnie przez wstrzyknięty emailService.send dla KAŻDEGO odbiorcy', async () => {
    const send = vi.fn().mockResolvedValue(true);
    (scheduledReportService as any).setDependencies({ db: {}, emailService: { send } });

    await (scheduledReportService as any).deliverViaEmail(
      scheduleWith(['a@x.com', 'b@x.com'], 'Custom subject'),
      'rep-123'
    );

    expect(send).toHaveBeenCalledTimes(2);
    const firstArg = send.mock.calls[0][0];
    expect(firstArg.to).toBe('a@x.com');
    expect(firstArg.subject).toBe('Custom subject');
    expect(firstArg.html).toContain('rep-123');
  });

  it('domyślny subject gdy nie podano', async () => {
    const send = vi.fn().mockResolvedValue(true);
    (scheduledReportService as any).setDependencies({ db: {}, emailService: { send } });
    await (scheduledReportService as any).deliverViaEmail(scheduleWith(['c@x.com']), 'rep-9');
    expect(send.mock.calls[0][0].subject).toMatch(/Raport tygodniowy/);
  });

  it('brak odbiorców → nic nie wysyła (no throw)', async () => {
    const send = vi.fn();
    (scheduledReportService as any).setDependencies({ db: {}, emailService: { send } });
    await (scheduledReportService as any).deliverViaEmail(scheduleWith([]), 'rep-0');
    expect(send).not.toHaveBeenCalled();
  });

  it('błąd wysyłki jednego odbiorcy nie wywraca reszty (fail-soft)', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('SMTP down'))
      .mockResolvedValueOnce(true);
    (scheduledReportService as any).setDependencies({ db: {}, emailService: { send } });
    await expect(
      (scheduledReportService as any).deliverViaEmail(scheduleWith(['x@x.com', 'y@x.com']), 'rep-1')
    ).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
  });
});
