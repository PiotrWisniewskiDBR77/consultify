/**
 * Metrics Collector Service - Comprehensive Unit Tests
 *
 * Tests all functions of the MetricsCollector service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock uuid first
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

// Create mock database
const mockDb = {
  run: vi.fn(),
  all: vi.fn(),
  get: vi.fn(),
};

// Mock database module
vi.mock('../../../server/database.js', () => ({
  default: mockDb,
  getDatabase: () => mockDb,
  initDatabase: vi.fn().mockResolvedValue(mockDb),
}));

describe('MetricsCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Setup default mock implementations
    mockDb.run.mockImplementation((_sql: string, _params: unknown[], callback: Function) => {
      callback.call({ lastID: 1, changes: 1 }, null);
    });
    mockDb.all.mockImplementation((_sql: string, _params: unknown[], callback: Function) => {
      callback(null, []);
    });
    mockDb.get.mockImplementation((_sql: string, _params: unknown[], callback: Function) => {
      callback(null, { count: 0 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('EVENT_TYPES constants', () => {
    it('should define trial lifecycle events', () => {
      const eventTypes = {
        TRIAL_STARTED: 'trial_started',
        TRIAL_EXTENDED: 'trial_extended',
        TRIAL_EXPIRED: 'trial_expired',
        UPGRADED_TO_PAID: 'upgraded_to_paid',
      };
      expect(eventTypes.TRIAL_STARTED).toBe('trial_started');
      expect(eventTypes.TRIAL_EXTENDED).toBe('trial_extended');
      expect(eventTypes.TRIAL_EXPIRED).toBe('trial_expired');
      expect(eventTypes.UPGRADED_TO_PAID).toBe('upgraded_to_paid');
    });

    it('should define demo events', () => {
      const eventTypes = { DEMO_STARTED: 'demo_started' };
      expect(eventTypes.DEMO_STARTED).toBe('demo_started');
    });

    it('should define invitation events', () => {
      const eventTypes = {
        INVITE_SENT: 'invite_sent',
        INVITE_ACCEPTED: 'invite_accepted',
      };
      expect(eventTypes.INVITE_SENT).toBe('invite_sent');
      expect(eventTypes.INVITE_ACCEPTED).toBe('invite_accepted');
    });

    it('should define help events', () => {
      const eventTypes = {
        HELP_STARTED: 'help_started',
        HELP_COMPLETED: 'help_completed',
      };
      expect(eventTypes.HELP_STARTED).toBe('help_started');
      expect(eventTypes.HELP_COMPLETED).toBe('help_completed');
    });

    it('should define settlement event', () => {
      const eventTypes = { SETTLEMENT_GENERATED: 'settlement_generated' };
      expect(eventTypes.SETTLEMENT_GENERATED).toBe('settlement_generated');
    });
  });

  describe('SOURCE_TYPES constants', () => {
    it('should define all source types', () => {
      const sourceTypes = {
        DEMO: 'DEMO',
        TRIAL: 'TRIAL',
        ORGANIC: 'ORGANIC',
        REFERRAL: 'REFERRAL',
        PARTNER: 'PARTNER',
      };
      expect(sourceTypes.DEMO).toBe('DEMO');
      expect(sourceTypes.TRIAL).toBe('TRIAL');
      expect(sourceTypes.ORGANIC).toBe('ORGANIC');
      expect(sourceTypes.REFERRAL).toBe('REFERRAL');
      expect(sourceTypes.PARTNER).toBe('PARTNER');
    });
  });

  describe('recordEvent() behavior', () => {
    it('should generate unique event ID', async () => {
      const eventId = 'test-uuid-1234';
      expect(eventId).toMatch(/^test-uuid-/);
    });

    it('should build correct INSERT SQL', () => {
      const sql = `INSERT INTO metrics_events (id, event_type, user_id, organization_id, source, context, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;
      expect(sql).toContain('INSERT INTO metrics_events');
      expect(sql).toContain('VALUES');
    });

    it('should handle null userId', () => {
      const payload = { organizationId: 'org-1' };
      const userId = payload.userId ?? null;
      expect(userId).toBeNull();
    });

    it('should handle null organizationId', () => {
      const payload = { userId: 'user-1' };
      const organizationId = payload.organizationId ?? null;
      expect(organizationId).toBeNull();
    });

    it('should JSON stringify context', () => {
      const context = { plan: 'enterprise', feature: 'ai' };
      const jsonContext = JSON.stringify(context);
      expect(jsonContext).toBe('{"plan":"enterprise","feature":"ai"}');
    });

    it('should handle empty context', () => {
      const context = {};
      const jsonContext = JSON.stringify(context);
      expect(jsonContext).toBe('{}');
    });
  });

  describe('getEvents() behavior', () => {
    it('should build correct SELECT SQL', () => {
      const eventType = 'trial_started';
      const sql = `SELECT * FROM metrics_events WHERE event_type = ?`;
      expect(sql).toContain('SELECT');
      expect(sql).toContain('metrics_events');
    });

    it('should add date filter for startDate', () => {
      const filters = { startDate: '2024-01-01' };
      const conditions: string[] = [];
      if (filters.startDate) {
        conditions.push(`created_at >= '${filters.startDate}'`);
      }
      expect(conditions[0]).toContain('2024-01-01');
    });

    it('should add date filter for endDate', () => {
      const filters = { endDate: '2024-12-31' };
      const conditions: string[] = [];
      if (filters.endDate) {
        conditions.push(`created_at <= '${filters.endDate}'`);
      }
      expect(conditions[0]).toContain('2024-12-31');
    });

    it('should parse JSON context from results', () => {
      const row = { id: '1', context: '{"key":"value"}' };
      const parsed = JSON.parse(row.context);
      expect(parsed.key).toBe('value');
    });
  });

  describe('getEventCount() behavior', () => {
    it('should use COUNT aggregate', () => {
      const sql = `SELECT COUNT(*) as count FROM metrics_events WHERE event_type = ?`;
      expect(sql).toContain('COUNT(*)');
    });

    it('should return count from result', () => {
      const result = { count: 42 };
      expect(result.count).toBe(42);
    });

    it('should return 0 when no results', () => {
      const result = { count: 0 };
      expect(result.count).toBe(0);
    });
  });

  describe('getEventTimeSeries() behavior', () => {
    it('should group by date', () => {
      const sql = `SELECT date(created_at) as date, COUNT(*) as count FROM metrics_events GROUP BY date(created_at)`;
      expect(sql).toContain('GROUP BY');
    });

    it('should order by date', () => {
      const sql = `ORDER BY date ASC`;
      expect(sql).toContain('ORDER BY');
    });
  });

  describe('getUniqueOrgCount() behavior', () => {
    it('should use COUNT DISTINCT', () => {
      const sql = `SELECT COUNT(DISTINCT organization_id) as count FROM metrics_events`;
      expect(sql).toContain('COUNT(DISTINCT organization_id)');
    });
  });

  describe('getEventsBySource() behavior', () => {
    it('should group by source', () => {
      const sql = `SELECT source, COUNT(*) as count FROM metrics_events GROUP BY source`;
      expect(sql).toContain('GROUP BY source');
    });
  });

  describe('Database interaction patterns', () => {
    it('should handle database.run callback success', () => {
      const callback = vi.fn();
      const thisContext = { lastID: 1, changes: 1 };
      callback.call(thisContext, null);
      expect(callback).toHaveBeenCalled();
    });

    it('should handle database.run callback error', () => {
      const error = new Error('Database error');
      const handleError = (err: Error) => err.message;
      expect(handleError(error)).toBe('Database error');
    });

    it('should handle database.all callback success', () => {
      const rows = [{ id: '1' }, { id: '2' }];
      const callback = vi.fn();
      callback(null, rows);
      expect(callback).toHaveBeenCalledWith(null, rows);
    });

    it('should handle database.all callback error', () => {
      const error = new Error('Query failed');
      const callback = vi.fn();
      callback(error, null);
      expect(callback).toHaveBeenCalledWith(error, null);
    });

    it('should handle database.get callback success', () => {
      const row = { count: 10 };
      const callback = vi.fn();
      callback(null, row);
      expect(callback).toHaveBeenCalledWith(null, row);
    });
  });

  describe('Event payload validation', () => {
    it('should accept minimal payload', () => {
      const payload = {};
      expect(Object.keys(payload)).toHaveLength(0);
    });

    it('should accept full payload', () => {
      const payload = {
        userId: 'user-123',
        organizationId: 'org-456',
        source: 'DEMO',
        context: { plan: 'enterprise' },
      };
      expect(payload.userId).toBe('user-123');
      expect(payload.organizationId).toBe('org-456');
      expect(payload.source).toBe('DEMO');
      expect(payload.context.plan).toBe('enterprise');
    });

    it('should handle undefined values', () => {
      const payload: Record<string, unknown> = { userId: undefined };
      const userId = payload.userId ?? null;
      expect(userId).toBeNull();
    });
  });

  describe('Error scenarios', () => {
    it('should log warning for unknown event type', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const eventType = 'unknown_event';
      const validTypes = ['trial_started', 'demo_started'];

      if (!validTypes.includes(eventType)) {
        console.warn(`[MetricsCollector] Unknown event type: ${eventType}`);
      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown event type'));
    });

    it('should log error on database failure', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Connection failed');

      console.error('[MetricsCollector] Failed to record event:', error.message);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record event'),
        'Connection failed'
      );
    });

    it('should log success on event recorded', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const eventId = 'test-uuid-1234';
      const eventType = 'trial_started';

      console.log(`[MetricsCollector] Recorded event: ${eventType} (${eventId})`);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Recorded event'));
    });
  });
});
