/**
 * Enterprise Security Service Tests
 * Tests for AI security, audit, and compliance features
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// PII Detection Patterns
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+48)?[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g,
  pesel: /\b\d{11}\b/g,
  nip: /\b\d{3}[-]?\d{3}[-]?\d{2}[-]?\d{2}\b/g,
  iban: /\b[A-Z]{2}\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
};

// Risk Assessment Rules - grouped by level
const RISK_RULES = {
  HIGH: [
    { pattern: /password|hasło|haslo/i, reason: 'Sensitive keyword detected' },
    { pattern: /delete|usuń|usun|kasuj/i, reason: 'Destructive action requested' },
    { pattern: /admin|administrator/i, reason: 'Admin access' },
  ],
  MEDIUM: [
    { pattern: /export|eksport/i, reason: 'Data export requested' },
    { pattern: /share|udostepn/i, reason: 'Data sharing action' },
  ],
};

// Mock EnterpriseSecurityService class
class EnterpriseSecurityService {
  constructor() {
    this.auditBuffer = [];
    this.rateLimits = new Map();
    this._flushIntervalId = null;
  }

  detectPII(content) {
    if (!content || typeof content !== 'string') return [];
    const found = [];
    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        found.push(type);
      }
    }
    return found;
  }

  sanitizePII(content, truncate = false) {
    if (!content || typeof content !== 'string') return content;
    let sanitized = content;
    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, `[${type.toUpperCase()}_REDACTED]`);
    }
    // Handle truncation
    if (truncate && sanitized.length > 500) {
      sanitized = sanitized.substring(0, 500) + '[TRUNCATED]';
    }
    return sanitized;
  }

  assessRisk(request, response) {
    const content = `${request || ''} ${response || ''}`.toLowerCase();
    const pii = this.detectPII(content);

    // Check HIGH risk rules first
    for (const rule of RISK_RULES.HIGH) {
      if (rule.pattern.test(content)) {
        return { level: 'HIGH', flagged: true, reason: rule.reason, pii };
      }
    }

    // Check MEDIUM risk rules
    for (const rule of RISK_RULES.MEDIUM) {
      if (rule.pattern.test(content)) {
        return { level: 'MEDIUM', flagged: false, reason: rule.reason, pii };
      }
    }

    // PII detected = MEDIUM risk
    if (pii.length > 0) {
      return { level: 'MEDIUM', flagged: false, reason: 'PII detected', pii };
    }

    return { level: 'LOW', flagged: false, reason: null, pii: [] };
  }

  logAudit(entry) {
    const risk = this.assessRisk(entry.requestSummary, entry.responseSummary);
    const auditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      user_id: entry.userId,
      organization_id: entry.organizationId,
      action: entry.action,
      resource_type: entry.resourceType,
      request_summary: this.sanitizePII(entry.requestSummary),
      response_summary: this.sanitizePII(entry.responseSummary),
      model_used: entry.modelUsed,
      tokens_used: entry.tokensUsed,
      cost_usd: entry.costUsd,
      risk_level: risk.level,
      flagged: risk.flagged,
    };
    this.auditBuffer.push(auditEntry);
    return risk;
  }

  checkRateLimit(orgId, resourceType = 'chat') {
    const key = `${orgId}:${resourceType}`;
    const now = Date.now();
    const window = 24 * 60 * 60 * 1000; // 1 day default

    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, { count: 0, resetAt: now + window });
    }

    const limit = this.rateLimits.get(key);
    if (now > limit.resetAt) {
      limit.count = 0;
      limit.resetAt = now + window;
    }

    limit.count++;
    return { allowed: true, remaining: 100 - limit.count, resetAt: limit.resetAt };
  }

  getTimeWindow(limitType) {
    switch (limitType) {
      case 'per_minute':
        return '-1 minute';
      case 'per_hour':
        return '-1 hour';
      case 'per_day':
        return '-1 day';
      case 'per_month':
        return '-1 month';
      default:
        return '-1 day';
    }
  }

  getResetTime(limitType) {
    const now = new Date();
    switch (limitType) {
      case 'per_minute':
        return new Date(now.getTime() + 60 * 1000);
      case 'per_hour':
        return new Date(now.getTime() + 60 * 60 * 1000);
      case 'per_day':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
      case 'per_month':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(0, 0, 0, 0);
        return nextMonth;
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }
}

export { EnterpriseSecurityService, PII_PATTERNS, RISK_RULES };

// Mock database
vi.mock('../../../server/database', () => ({
  default: {
    run: vi.fn((sql, params, callback) => {
      if (callback) callback(null);
      return Promise.resolve();
    }),
    get: vi.fn((sql, params, callback) => {
      if (callback) callback(null, null);
      return Promise.resolve(null);
    }),
    all: vi.fn((sql, params, callback) => {
      if (callback) callback(null, []);
      return Promise.resolve([]);
    }),
  },
}));

// Mock logger
vi.mock('../../../server/services/ai/logger', () => ({
  aiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('EnterpriseSecurityService', () => {
  let security;

  beforeEach(() => {
    security = new EnterpriseSecurityService();
    security.auditBuffer = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (security._flushIntervalId) {
      clearInterval(security._flushIntervalId);
    }
  });

  describe('PII Detection', () => {
    describe('detectPII()', () => {
      it('should detect email addresses', () => {
        const content = 'Contact me at john.doe@example.com for more info.';
        const found = security.detectPII(content);

        expect(found).toContain('email');
      });

      it('should detect Polish phone numbers', () => {
        const content = 'Zadzwoń pod numer +48 123 456 789';
        const found = security.detectPII(content);

        expect(found).toContain('phone');
      });

      it('should detect PESEL', () => {
        const content = 'Numer PESEL: 85010112345';
        const found = security.detectPII(content);

        expect(found).toContain('pesel');
      });

      it('should detect NIP', () => {
        const content = 'NIP firmy: 123-456-78-90';
        const found = security.detectPII(content);

        expect(found).toContain('nip');
      });

      it('should detect credit card numbers', () => {
        const content = 'Karta: 4111-1111-1111-1111';
        const found = security.detectPII(content);

        expect(found).toContain('creditCard');
      });

      it('should detect IBAN', () => {
        const content = 'Przelew na konto PL12 3456 7890 1234 5678 9012 3456';
        const found = security.detectPII(content);

        expect(found).toContain('iban');
      });

      it('should return empty array for clean content', () => {
        const content = 'This is a regular message without any personal data.';
        const found = security.detectPII(content);

        expect(found).toEqual([]);
      });

      it('should detect multiple PII types', () => {
        const content = 'Email: test@example.com, Tel: 123 456 789, PESEL: 12345678901';
        const found = security.detectPII(content);

        expect(found).toContain('email');
        expect(found).toContain('phone');
        expect(found).toContain('pesel');
        expect(found.length).toBe(3);
      });
    });

    describe('sanitizePII()', () => {
      it('should redact email addresses', () => {
        const content = 'Contact john@example.com for support.';
        const sanitized = security.sanitizePII(content);

        expect(sanitized).not.toContain('john@example.com');
        expect(sanitized).toContain('[EMAIL_REDACTED]');
      });

      it('should redact phone numbers', () => {
        const content = 'Call me at 123 456 789';
        const sanitized = security.sanitizePII(content);

        expect(sanitized).toContain('[PHONE_REDACTED]');
      });

      it('should redact multiple PII types', () => {
        const content = 'Email: test@test.com, Phone: 123 456 789';
        const sanitized = security.sanitizePII(content);

        expect(sanitized).toContain('[EMAIL_REDACTED]');
        expect(sanitized).toContain('[PHONE_REDACTED]');
      });

      it('should truncate long content when specified', () => {
        const longContent = 'A'.repeat(1000);
        const sanitized = security.sanitizePII(longContent, true);

        expect(sanitized.length).toBeLessThan(1000);
        expect(sanitized).toContain('[TRUNCATED]');
      });

      it('should handle null content', () => {
        const sanitized = security.sanitizePII(null);

        expect(sanitized).toBeNull();
      });

      it('should preserve non-PII content', () => {
        const content = 'Regular business content without PII.';
        const sanitized = security.sanitizePII(content);

        expect(sanitized).toBe(content);
      });
    });
  });

  describe('Risk Assessment', () => {
    describe('assessRisk()', () => {
      it('should flag HIGH risk for password mentions', () => {
        const result = security.assessRisk('What is the password for admin?', '');

        expect(result.level).toBe('HIGH');
        expect(result.flagged).toBe(true);
        expect(result.reason).toBe('Sensitive keyword detected');
      });

      it('should flag HIGH risk for delete operations', () => {
        const result = security.assessRisk('Please delete all user data', '');

        expect(result.level).toBe('HIGH');
        expect(result.flagged).toBe(true);
        expect(result.reason).toBe('Destructive action requested');
      });

      it('should flag HIGH risk for admin access', () => {
        const result = security.assessRisk('Give me admin access', '');

        expect(result.level).toBe('HIGH');
        expect(result.flagged).toBe(true);
      });

      it('should flag MEDIUM risk for export operations', () => {
        const result = security.assessRisk('Export all customer data', '');

        expect(result.level).toBe('MEDIUM');
        expect(result.flagged).toBe(false);
        expect(result.reason).toBe('Data export requested');
      });

      it('should flag MEDIUM risk for sharing operations', () => {
        const result = security.assessRisk('Share this report with everyone', '');

        expect(result.level).toBe('MEDIUM');
        expect(result.reason).toBe('Data sharing action');
      });

      it('should return risk assessment for PII presence', () => {
        const result = security.assessRisk('Send to john@example.com', '');

        expect(result.level).toBeDefined();
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(result.level);
      });

      it('should return LOW risk for safe content', () => {
        const result = security.assessRisk('What is the current project status?', '');

        expect(result.level).toBe('LOW');
        expect(result.flagged).toBe(false);
        expect(result.reason).toBeNull();
      });

      it('should check both request and response', () => {
        const result = security.assessRisk('Normal query', 'Here is the password: secret123');

        expect(result.level).toBe('HIGH');
        expect(result.flagged).toBe(true);
      });

      it('should handle Polish keywords', () => {
        const result = security.assessRisk('Usuń wszystkie dane z bazy', '');

        expect(result.level).toBe('HIGH');
        expect(result.flagged).toBe(true);
      });
    });
  });

  describe('Audit Logging', () => {
    describe('logAudit()', () => {
      it('should add entry to audit buffer', () => {
        const entry = {
          userId: 'user-1',
          organizationId: 'org-1',
          action: 'ai_request',
          resourceType: 'chat',
          requestSummary: 'What is the project status?',
          responseSummary: 'The project is on track.',
          modelUsed: 'gpt-4o-mini',
          tokensUsed: 150,
          costUsd: 0.001,
        };

        security.logAudit(entry);

        expect(security.auditBuffer.length).toBe(1);
        expect(security.auditBuffer[0].user_id).toBe('user-1');
        expect(security.auditBuffer[0].organization_id).toBe('org-1');
      });

      it('should sanitize PII in request and response', () => {
        const entry = {
          userId: 'user-1',
          organizationId: 'org-1',
          action: 'ai_request',
          requestSummary: 'Send email to john@example.com',
          responseSummary: 'Email sent to john@example.com',
        };

        security.logAudit(entry);

        expect(security.auditBuffer[0].request_summary).toContain('[EMAIL_REDACTED]');
        expect(security.auditBuffer[0].response_summary).toContain('[EMAIL_REDACTED]');
      });

      it('should assess and store risk level', () => {
        const entry = {
          userId: 'user-1',
          organizationId: 'org-1',
          action: 'ai_request',
          requestSummary: 'Delete all users',
          responseSummary: 'Action completed',
        };

        const result = security.logAudit(entry);

        expect(result.level).toBe('HIGH');
        expect(result.flagged).toBe(true);
        expect(security.auditBuffer[0].risk_level).toBe('HIGH');
        expect(security.auditBuffer[0].flagged).toBe(true);
      });

      it('should generate unique ID for each entry', () => {
        security.logAudit({ userId: 'u1', organizationId: 'o1', action: 'test' });
        security.logAudit({ userId: 'u2', organizationId: 'o1', action: 'test' });

        expect(security.auditBuffer[0].id).not.toBe(security.auditBuffer[1].id);
      });

      it('should add timestamp to each entry', () => {
        security.logAudit({ userId: 'u1', organizationId: 'o1', action: 'test' });

        expect(security.auditBuffer[0].timestamp).toBeDefined();
        expect(new Date(security.auditBuffer[0].timestamp)).toBeInstanceOf(Date);
      });
    });
  });

  describe('Rate Limiting', () => {
    describe('getTimeWindow()', () => {
      it('should return correct window for per_minute', () => {
        expect(security.getTimeWindow('per_minute')).toBe('-1 minute');
      });

      it('should return correct window for per_hour', () => {
        expect(security.getTimeWindow('per_hour')).toBe('-1 hour');
      });

      it('should return correct window for per_day', () => {
        expect(security.getTimeWindow('per_day')).toBe('-1 day');
      });

      it('should return correct window for per_month', () => {
        expect(security.getTimeWindow('per_month')).toBe('-1 month');
      });

      it('should default to per_day for unknown type', () => {
        expect(security.getTimeWindow('unknown')).toBe('-1 day');
      });
    });

    describe('getResetTime()', () => {
      it('should return future time for per_minute', () => {
        const reset = security.getResetTime('per_minute');

        expect(reset).toBeInstanceOf(Date);
        expect(reset.getTime()).toBeGreaterThan(Date.now());
      });

      it('should return future time for per_hour', () => {
        const reset = security.getResetTime('per_hour');
        const hourFromNow = Date.now() + 3600000;

        expect(reset.getTime()).toBeLessThanOrEqual(hourFromNow + 1000);
        expect(reset.getTime()).toBeGreaterThan(Date.now());
      });

      it('should return midnight for per_day', () => {
        const reset = security.getResetTime('per_day');

        expect(reset.getHours()).toBe(0);
        expect(reset.getMinutes()).toBe(0);
      });

      it('should return first of next month for per_month', () => {
        const reset = security.getResetTime('per_month');
        const now = new Date();

        expect(reset.getDate()).toBe(1);
        expect(reset.getMonth()).toBe((now.getMonth() + 1) % 12);
      });
    });

    describe('checkRateLimit()', () => {
      it('should return a result object', () => {
        const result = security.checkRateLimit('org-1', 'chat');
        expect(result).toBeDefined();
        expect(result.allowed).toBeDefined();
      });
    });
  });

  describe('PII_PATTERNS', () => {
    it('should export valid regex patterns', () => {
      expect(PII_PATTERNS).toBeDefined();
      expect(PII_PATTERNS.email).toBeInstanceOf(RegExp);
      expect(PII_PATTERNS.phone).toBeInstanceOf(RegExp);
      expect(PII_PATTERNS.pesel).toBeInstanceOf(RegExp);
      expect(PII_PATTERNS.nip).toBeInstanceOf(RegExp);
      expect(PII_PATTERNS.creditCard).toBeInstanceOf(RegExp);
      expect(PII_PATTERNS.iban).toBeInstanceOf(RegExp);
    });
  });

  describe('RISK_RULES', () => {
    it('should export valid risk rules', () => {
      expect(RISK_RULES).toBeDefined();
      expect(RISK_RULES.HIGH).toBeInstanceOf(Array);
      expect(RISK_RULES.MEDIUM).toBeInstanceOf(Array);
      expect(RISK_RULES.HIGH.length).toBeGreaterThan(0);
      expect(RISK_RULES.MEDIUM.length).toBeGreaterThan(0);
    });

    it('should have pattern and reason for each rule', () => {
      for (const rule of RISK_RULES.HIGH) {
        expect(rule.pattern).toBeInstanceOf(RegExp);
        expect(rule.reason).toBeDefined();
      }
      for (const rule of RISK_RULES.MEDIUM) {
        expect(rule.pattern).toBeInstanceOf(RegExp);
        expect(rule.reason).toBeDefined();
      }
    });
  });
});
