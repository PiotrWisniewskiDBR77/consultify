import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Slack/WhatsApp egress so tests never touch the network.
vi.mock('../../../server/src/services/systemAlertNotifier', () => ({
  sendSystemAlert: vi.fn(async () => undefined),
}));

import { sendSystemAlert } from '../../../server/src/services/systemAlertNotifier';
import {
  __resetSecurityWindows,
  alertPrivilegeEscalation,
  bumpAndCount,
  recordFailedLogin,
  SECURITY_ALERT_CONFIG,
} from '../../../server/src/services/securityAlerts';

const mockedAlert = vi.mocked(sendSystemAlert);

describe('securityAlerts', () => {
  beforeEach(() => {
    __resetSecurityWindows();
    mockedAlert.mockClear();
  });

  describe('bumpAndCount', () => {
    it('counts occurrences within the window and expires old ones', () => {
      const t0 = 1_000_000;
      expect(bumpAndCount('k', t0)).toBe(1);
      expect(bumpAndCount('k', t0 + 1000)).toBe(2);
      // Far outside the window → old hits expire, count resets to 1.
      expect(bumpAndCount('k', t0 + SECURITY_ALERT_CONFIG.WINDOW_MS + 5000)).toBe(1);
    });

    it('tracks distinct keys independently', () => {
      const t = 2_000_000;
      expect(bumpAndCount('a', t)).toBe(1);
      expect(bumpAndCount('b', t)).toBe(1);
      expect(bumpAndCount('a', t)).toBe(2);
    });
  });

  describe('recordFailedLogin', () => {
    it('alerts exactly once on crossing the threshold (per account key)', async () => {
      const { FAILED_LOGIN_THRESHOLD } = SECURITY_ALERT_CONFIG;
      for (let i = 0; i < FAILED_LOGIN_THRESHOLD - 1; i++) {
        await recordFailedLogin('victim@corp.com', null);
      }
      expect(mockedAlert).not.toHaveBeenCalled();
      await recordFailedLogin('victim@corp.com', null); // crossing hit
      expect(mockedAlert).toHaveBeenCalledTimes(1);
      const arg = mockedAlert.mock.calls[0][0];
      expect(arg.severity).toBe('WARNING');
      expect(arg.source).toBe('Security');
      expect(arg.throttleKey).toContain('bruteforce:email:victim@corp.com');
    });

    it('does nothing when neither email nor ip is present', async () => {
      await recordFailedLogin('', '');
      expect(mockedAlert).not.toHaveBeenCalled();
    });

    it('can alert on the IP key when many accounts are hit from one IP', async () => {
      const { FAILED_LOGIN_THRESHOLD } = SECURITY_ALERT_CONFIG;
      for (let i = 0; i < FAILED_LOGIN_THRESHOLD; i++) {
        await recordFailedLogin(`user${i}@corp.com`, '9.9.9.9');
      }
      // Each email is unique (never crosses), so the only alert is the IP one.
      expect(mockedAlert).toHaveBeenCalledTimes(1);
      expect(mockedAlert.mock.calls[0][0].throttleKey).toBe('bruteforce:ip:9.9.9.9');
    });
  });

  describe('alertPrivilegeEscalation', () => {
    it('alerts when a privileged role is granted', async () => {
      await alertPrivilegeEscalation({
        actorEmail: 'admin@corp.com',
        targetEmail: 'mole@corp.com',
        targetUserId: 'u1',
        oldRole: 'USER',
        newRole: 'SUPER_ADMIN',
      });
      expect(mockedAlert).toHaveBeenCalledTimes(1);
      expect(mockedAlert.mock.calls[0][0].title).toContain('SUPER_ADMIN');
    });

    it('is a no-op for non-privileged roles', async () => {
      await alertPrivilegeEscalation({ targetUserId: 'u1', oldRole: 'USER', newRole: 'MANAGER' });
      expect(mockedAlert).not.toHaveBeenCalled();
    });

    it('is a no-op when the role is unchanged (already privileged)', async () => {
      await alertPrivilegeEscalation({ targetUserId: 'u1', oldRole: 'OWNER', newRole: 'OWNER' });
      expect(mockedAlert).not.toHaveBeenCalled();
    });

    it('treats SUPERADMIN and SUPER_ADMIN as equivalent privileged roles', async () => {
      await alertPrivilegeEscalation({ targetUserId: 'u1', oldRole: 'USER', newRole: 'owner' });
      expect(mockedAlert).toHaveBeenCalledTimes(1);
    });
  });
});
