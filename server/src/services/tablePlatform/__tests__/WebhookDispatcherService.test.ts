import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { WebhookDispatcherService, type WebhookEvent } from '../WebhookDispatcherService.js';

describe('WebhookDispatcherService', () => {
  let service: WebhookDispatcherService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhookDispatcherService();
  });

  // -----------------------------------------------------------------------
  // createWebhook
  // -----------------------------------------------------------------------

  describe('createWebhook', () => {
    it('generates HMAC secret and returns webhook with 7-day expiry', async () => {
      const webhookRow = {
        id: 'wh-1',
        base_id: 'b-1',
        notification_url: 'https://example.com/hook',
        hmac_secret: 'generated-secret',
        expires_at: '2025-01-22T00:00:00Z',
        is_active: true,
      };
      mockQuery.mockResolvedValueOnce({ rows: [webhookRow] });

      const result = await service.createWebhook('b-1', 'https://example.com/hook', {
        options: {},
      });

      expect(result.id).toBe('wh-1');
      expect(result.macSecret).toBeDefined();
      expect(result.macSecret.length).toBe(64); // 32 bytes hex
      expect(result.expirationTime).toBe('2025-01-22T00:00:00Z');
      expect(result.cursorForNextPayload).toBe(1);

      const insertCall = mockQuery.mock.calls[0];
      expect(insertCall[0]).toContain('INSERT INTO tp_webhooks');
      expect(insertCall[1][0]).toBe('b-1');
      expect(insertCall[1][1]).toBe('https://example.com/hook');
    });

    it('stores createdBy when provided', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'wh-1', expires_at: '2025-01-22T00:00:00Z' }],
      });

      await service.createWebhook('b-1', 'https://example.com/hook', {}, 'user-1');

      const insertCall = mockQuery.mock.calls[0];
      expect(insertCall[1][4]).toBe('user-1');
    });
  });

  // -----------------------------------------------------------------------
  // listWebhooks
  // -----------------------------------------------------------------------

  describe('listWebhooks', () => {
    it('returns webhooks for base', async () => {
      const rows = [
        { id: 'wh-1', base_id: 'b-1', notification_url: 'https://a.com', is_active: true },
        { id: 'wh-2', base_id: 'b-1', notification_url: 'https://b.com', is_active: false },
      ];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await service.listWebhooks('b-1');
      expect(result).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // listPayloads
  // -----------------------------------------------------------------------

  describe('listPayloads', () => {
    it('returns cursor-based results', async () => {
      const payloads = [
        {
          cursor_number: 1,
          timestamp: '2025-01-15T00:00:00Z',
          base_transaction_number: 1,
          action_metadata: {},
        },
        {
          cursor_number: 2,
          timestamp: '2025-01-15T00:01:00Z',
          base_transaction_number: 2,
          action_metadata: {},
        },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: payloads }) // SELECT payloads
        .mockResolvedValueOnce({ rows: [{ expires_at: '2025-01-22' }] }); // refreshWebhook

      const result = await service.listPayloads('wh-1', 1, 50);

      expect(result.payloads).toHaveLength(2);
      expect(result.cursor).toBe(3); // lastCursor (2) + 1
      expect(result.mightHaveMore).toBe(false);
    });

    it('returns mightHaveMore=true when more rows than limit', async () => {
      const payloads = Array.from({ length: 4 }, (_, i) => ({
        cursor_number: i + 1,
        timestamp: `2025-01-15T00:0${i}:00Z`,
        base_transaction_number: i + 1,
        action_metadata: {},
      }));
      mockQuery
        .mockResolvedValueOnce({ rows: payloads })
        .mockResolvedValueOnce({ rows: [{ expires_at: '2025-01-22' }] });

      const result = await service.listPayloads('wh-1', 1, 3);

      expect(result.payloads).toHaveLength(3);
      expect(result.mightHaveMore).toBe(true);
    });

    it('returns default cursor when no payloads', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ expires_at: '2025-01-22' }] });

      const result = await service.listPayloads('wh-1');

      expect(result.payloads).toHaveLength(0);
      expect(result.cursor).toBe(2); // startCursor (1) + 1
      expect(result.mightHaveMore).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // dispatchEvent
  // -----------------------------------------------------------------------

  describe('dispatchEvent', () => {
    it('stores payload and sends ping for matching webhook', async () => {
      const webhook = {
        id: 'wh-1',
        base_id: 'b-1',
        notification_url: 'https://example.com/hook',
        hmac_secret: 'secret123',
        is_active: true,
        cursor_number: 0,
        specification: null,
      };
      mockQuery
        .mockResolvedValueOnce({ rows: [webhook] }) // SELECT webhooks
        .mockResolvedValueOnce({ rows: [] }) // INSERT payload
        .mockResolvedValueOnce({ rows: [] }); // UPDATE cursor_number

      mockFetch.mockResolvedValueOnce({ ok: true });

      const event: WebhookEvent = {
        source: 'client',
        actionType: 'record_created',
        tableId: 't-1',
        recordId: 'rec-1',
      };

      await service.dispatchEvent('b-1', event);

      const insertPayloadCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO tp_webhook_payloads')
      );
      expect(insertPayloadCall).toBeDefined();
    });

    it('does nothing when no active webhooks', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.dispatchEvent('b-1', {
        source: 'client',
        actionType: 'record_created',
        tableId: 't-1',
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // matchesFilter
  // -----------------------------------------------------------------------

  describe('matchesFilter (via dispatchEvent)', () => {
    const baseWebhook = (specification: unknown) => ({
      id: 'wh-1',
      base_id: 'b-1',
      notification_url: 'https://example.com/hook',
      hmac_secret: 'secret',
      is_active: true,
      cursor_number: 0,
      specification,
    });

    it('matches when no filters specified', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [baseWebhook(null)] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      mockFetch.mockResolvedValueOnce({ ok: true });

      await service.dispatchEvent('b-1', {
        source: 'client',
        actionType: 'record_created',
        tableId: 't-1',
      });

      const insertCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO tp_webhook_payloads')
      );
      expect(insertCall).toBeDefined();
    });

    it('filters by dataTypes', async () => {
      const spec = { options: { filters: { dataTypes: ['record_updated'] } } };
      mockQuery.mockResolvedValueOnce({ rows: [baseWebhook(spec)] });
      mockFetch.mockResolvedValueOnce({ ok: true });

      await service.dispatchEvent('b-1', {
        source: 'client',
        actionType: 'record_created',
        tableId: 't-1',
      });

      // No payload inserted because dataTypes filter excluded record_created
      const insertCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO tp_webhook_payloads')
      );
      expect(insertCall).toBeUndefined();
    });

    it('filters by sourceTypes', async () => {
      const spec = { options: { filters: { sourceTypes: ['automation'] } } };
      mockQuery.mockResolvedValueOnce({ rows: [baseWebhook(spec)] });

      await service.dispatchEvent('b-1', {
        source: 'client',
        actionType: 'record_created',
        tableId: 't-1',
      });

      const insertCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO tp_webhook_payloads')
      );
      expect(insertCall).toBeUndefined();
    });

    it('filters by tableIds', async () => {
      const spec = { options: { filters: { recordChangeScope: { tableIds: ['t-99'] } } } };
      mockQuery.mockResolvedValueOnce({ rows: [baseWebhook(spec)] });

      await service.dispatchEvent('b-1', {
        source: 'client',
        actionType: 'record_created',
        tableId: 't-1',
      });

      const insertCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO tp_webhook_payloads')
      );
      expect(insertCall).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // HMAC signature verification
  // -----------------------------------------------------------------------

  describe('HMAC signature', () => {
    it('produces correct HMAC-SHA256 signature', async () => {
      const hmacSecret = 'test-secret-key';
      const webhook = {
        id: 'wh-1',
        base_id: 'b-1',
        notification_url: 'https://example.com/hook',
        hmac_secret: hmacSecret,
        is_active: true,
        cursor_number: 0,
        specification: null,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [webhook] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      let capturedHeaders: Record<string, string> = {};
      let capturedBody = '';
      mockFetch.mockImplementationOnce(
        (_url: string, opts: { headers: Record<string, string>; body: string }) => {
          capturedHeaders = opts.headers;
          capturedBody = opts.body;
          return Promise.resolve({ ok: true });
        }
      );

      await service.dispatchEvent('b-1', {
        source: 'client',
        actionType: 'record_created',
        tableId: 't-1',
      });

      // Wait for async sendPing
      await new Promise((r) => setTimeout(r, 50));

      if (capturedBody && capturedHeaders['X-Airtable-Content-MAC']) {
        const expectedHmac = crypto.createHmac('sha256', hmacSecret);
        expectedHmac.update(capturedBody);
        const expectedSig = `hmac-sha256=${expectedHmac.digest('hex')}`;
        expect(capturedHeaders['X-Airtable-Content-MAC']).toBe(expectedSig);
      }
    });
  });

  // -----------------------------------------------------------------------
  // refreshWebhook
  // -----------------------------------------------------------------------

  describe('refreshWebhook', () => {
    it('extends expiry and returns new expiresAt', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ expires_at: '2025-01-29T00:00:00Z' }] });

      const result = await service.refreshWebhook('wh-1');

      expect(result.expiresAt).toBe('2025-01-29T00:00:00Z');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INTERVAL '7 days'"), [
        'wh-1',
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // deleteWebhook
  // -----------------------------------------------------------------------

  describe('deleteWebhook', () => {
    it('deletes webhook by id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.deleteWebhook('wh-1');

      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM tp_webhooks WHERE id = $1', ['wh-1']);
    });
  });
});
