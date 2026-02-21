import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbAll = vi.fn().mockResolvedValue([]);
const dbGet = vi.fn().mockResolvedValue(null);
const dbRun = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));
vi.mock('../../../../server/src/utils/Logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('uuid', () => ({ v4: () => 'test-uuid-sellix' }));

import { getConfig, upsertConfig, signPayload, verifySignature, processInboundEvent, sendReadinessSignal, getDeliveryStatus } from '../../../../server/src/services/sellixIntegrationService.js';

describe('sellixIntegrationService', () => {
  beforeEach(() => { vi.clearAllMocks(); dbAll.mockResolvedValue([]); dbGet.mockResolvedValue(null); dbRun.mockResolvedValue(undefined); });

  describe('HMAC signing', () => {
    it('signs and verifies payload correctly', () => {
      const payload = JSON.stringify({ org: 'test' });
      const sig = signPayload(payload, 'my-secret-key');
      expect(typeof sig).toBe('string');
      expect(sig.length).toBe(64);
      expect(verifySignature(payload, sig, 'my-secret-key')).toBe(true);
    });
    it('rejects tampered payload', () => { const sig = signPayload('original', 'my-secret'); expect(verifySignature('tampered', sig, 'my-secret')).toBe(false); });
    it('rejects wrong secret', () => { const sig = signPayload('data', 'secret-a'); expect(verifySignature('data', sig, 'secret-b')).toBe(false); });
  });

  describe('getConfig', () => {
    it('returns null when no config exists', async () => { expect(await getConfig()).toBeNull(); });
    it('maps row to config correctly', async () => {
      dbGet.mockResolvedValueOnce({ id: 'cfg-1', enabled: true, threshold_score: 80, cooldown_hours: 24, webhook_secret: 'sec', sellix_endpoint: 'https://sellix.test/webhook', default_pathway: 'TRIAL_UPGRADE_EMAIL_1', updated_at: '2026-03-01' });
      const config = await getConfig();
      expect(config).not.toBeNull();
      expect(config!.enabled).toBe(true);
      expect(config!.thresholdScore).toBe(80);
    });
  });

  describe('upsertConfig', () => {
    it('inserts new config when none exists', async () => {
      await upsertConfig({ enabled: true, thresholdScore: 75 }, 'admin-1');
      expect(dbRun).toHaveBeenCalled();
      expect(dbRun.mock.calls[0][0]).toContain('INSERT INTO sellix_config');
    });
  });

  describe('processInboundEvent', () => {
    it('returns duplicate for existing eventId', async () => {
      dbGet.mockResolvedValueOnce({ id: 'existing-id' });
      const result = await processInboundEvent({ eventId: 'evt-dup', eventType: 'sellix.pathway_started', organizationId: 'org-1' });
      expect(result.ok).toBe(true);
      expect(result.duplicate).toBe(true);
      expect(dbRun).not.toHaveBeenCalled();
    });
    it('processes new event and writes journey event', async () => {
      const result = await processInboundEvent({ eventId: 'evt-new', eventType: 'cta_clicked', organizationId: 'org-2', data: { source: 'email' } });
      expect(result.ok).toBe(true);
      expect(result.duplicate).toBe(false);
      expect(dbRun).toHaveBeenCalledTimes(2);
      expect(dbRun.mock.calls[0][0]).toContain('INSERT INTO sellix_events');
      expect(dbRun.mock.calls[1][0]).toContain('INSERT INTO journey_events');
    });
  });

  describe('sendReadinessSignal', () => {
    it('returns disabled when integration is off', async () => {
      dbGet.mockResolvedValueOnce({ id: 'c', enabled: false, threshold_score: 80, cooldown_hours: 24 });
      const result = await sendReadinessSignal('org-1', 90, 'READY', [], 'v1');
      expect(result.sent).toBe(false);
      expect(result.reason).toContain('disabled');
    });
    it('returns below threshold when score is low', async () => {
      dbGet.mockResolvedValueOnce({ id: 'c', enabled: true, threshold_score: 80, cooldown_hours: 24, sellix_endpoint: 'https://sellix.test/hook', webhook_secret: 'sec', default_pathway: 'TEST', updated_at: '2026-03-01' });
      const result = await sendReadinessSignal('org-1', 60, 'HIGH', [], 'v1');
      expect(result.sent).toBe(false);
      expect(result.reason).toContain('below threshold');
    });
  });

  describe('getDeliveryStatus', () => {
    it('returns delivery log entries', async () => {
      dbAll.mockResolvedValueOnce([{ id: 'd1', success: true }]);
      const deliveries = await getDeliveryStatus(10);
      expect(deliveries).toHaveLength(1);
    });
  });
});
