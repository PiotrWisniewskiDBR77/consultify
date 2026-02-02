/**
 * EmailService - Unit Tests (L1)
 * Tests for email sending functionality
 *
 * Coverage target: 95%+
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock database
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
};

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn().mockResolvedValue(mockDb),
}));

// Mock nodemailer
const mockNodemailer = {
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  }),
};

vi.mock('nodemailer', () => ({
  default: mockNodemailer,
}));

// Mock config
const mockConfig = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: 587,
  SMTP_USER: 'user@example.com',
  SMTP_PASS: 'password',
  SMTP_FROM: 'noreply@example.com',
};

vi.mock('../../../server/src/config/Config.js', () => ({
  default: mockConfig,
  config: mockConfig,
}));

// Mock logger
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks are set up
let emailService: typeof import('../../../server/src/services/emailService');

describe('EmailService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import after mocks are set up
    emailService = await import('../../../server/src/services/emailService');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('send', () => {
    it('should send email successfully', async () => {
      mockDb.get.mockResolvedValue({ key: 'SMTP_ENABLED', value: 'true' });

      const result = await emailService.send({
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      });

      expect(result).toBe(true);
    });

    it('should handle email sending failure', async () => {
      mockDb.get.mockResolvedValue({ key: 'SMTP_ENABLED', value: 'true' });
      mockNodemailer.createTransport().sendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await emailService.send({
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      });

      expect(result).toBe(false);
    });

    it('should use console output when SMTP is disabled', async () => {
      mockDb.get.mockResolvedValue({ key: 'SMTP_ENABLED', value: 'false' });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await emailService.send({
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      });

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle template-based emails', async () => {
      mockDb.get.mockResolvedValue({ key: 'SMTP_ENABLED', value: 'true' });

      const result = await emailService.send({
        to: 'test@example.com',
        subject: 'Welcome',
        template: 'welcome',
        data: { name: 'John' },
      });

      expect(result).toBe(true);
    });

    it('should handle emails with attachments', async () => {
      mockDb.get.mockResolvedValue({ key: 'SMTP_ENABLED', value: 'true' });

      const result = await emailService.send({
        to: 'test@example.com',
        subject: 'Test with Attachment',
        html: '<p>Test</p>',
        attachments: [
          {
            filename: 'test.pdf',
            content: 'base64content',
            contentType: 'application/pdf',
          },
        ],
      });

      expect(result).toBe(true);
    });
  });

  describe('setDependencies', () => {
    it('should allow dependency injection for testing', () => {
      const mockDb = {} as any;
      const mockNodemailer = {} as any;
      const mockConfig = {} as any;

      emailService.setDependencies({
        db: mockDb,
        nodemailer: mockNodemailer,
        config: mockConfig,
      });

      // Dependencies should be set (tested indirectly through send)
      expect(() => setDependencies({})).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle missing SMTP configuration gracefully', async () => {
      mockDb.get.mockResolvedValue(null);

      const result = await emailService.send({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      // Should fallback to console output
      expect(result).toBe(true);
    });
  });
});
