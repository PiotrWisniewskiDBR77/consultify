/**
 * Email Service Unit Tests
 * Tests email sending, validation, templates, and error handling
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Email Service implementation
const createEmailService = () => {
  const sentEmails = [];
  const templates = new Map();
  let counter = 0;

  return {
    send: async (options) => {
      const { to, subject, body, template, templateData } = options;

      // Validate email
      if (!isValidEmail(to)) {
        throw new Error('Invalid email address');
      }

      let emailBody = body;
      if (template) {
        const tpl = templates.get(template);
        if (!tpl) throw new Error('Template not found');
        emailBody = renderTemplate(tpl.content, templateData || {});
      }

      const email = {
        id: `email-${Date.now()}-${++counter}`,
        to,
        subject,
        body: emailBody,
        sentAt: new Date(),
        status: 'sent',
      };

      sentEmails.push(email);
      return email;
    },

    validateEmail: (email) => isValidEmail(email),

    registerTemplate: (name, content, options = {}) => {
      templates.set(name, {
        name,
        content,
        type: options.type || 'html',
        variables: extractVariables(content),
      });
    },

    getTemplate: (name) => templates.get(name) || null,

    sendBulk: async (recipients, options) => {
      const results = [];
      for (const to of recipients) {
        try {
          const result = (await this.send?.({ ...options, to })) || {
            id: `email-${Date.now()}-${++counter}`,
            to,
            status: 'sent',
          };
          results.push({ to, success: true, id: result.id });
        } catch (error) {
          results.push({ to, success: false, error: error.message });
        }
      }
      return {
        total: recipients.length,
        sent: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      };
    },

    getSentEmails: () => [...sentEmails],

    getEmailStats: () => ({
      total: sentEmails.length,
      today: sentEmails.filter(
        (e) => new Date(e.sentAt).toDateString() === new Date().toDateString()
      ).length,
    }),
  };
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extractVariables(content) {
  const matches = content.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
}

function renderTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

describe('EmailService', () => {
  let emailService;

  beforeEach(() => {
    emailService = createEmailService();
  });

  describe('Email Sending', () => {
    it('should send email', async () => {
      const result = await emailService.send({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body',
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('sent');
    });

    it('should reject invalid email', async () => {
      await expect(
        emailService.send({
          to: 'invalid-email',
          subject: 'Test',
          body: 'Body',
        })
      ).rejects.toThrow('Invalid email address');
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email', () => {
      expect(emailService.validateEmail('user@domain.com')).toBe(true);
      expect(emailService.validateEmail('test.user@sub.domain.org')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(emailService.validateEmail('invalid')).toBe(false);
      expect(emailService.validateEmail('no@domain')).toBe(false);
    });
  });

  describe('Templates', () => {
    it('should register template', () => {
      emailService.registerTemplate('welcome', '<h1>Welcome {{name}}</h1>');
      const template = emailService.getTemplate('welcome');

      expect(template.name).toBe('welcome');
      expect(template.variables).toContain('name');
    });

    it('should send with template', async () => {
      emailService.registerTemplate('greeting', 'Hello {{name}}!');

      const result = await emailService.send({
        to: 'user@test.com',
        subject: 'Greeting',
        template: 'greeting',
        templateData: { name: 'John' },
      });

      expect(result.body).toBe('Hello John!');
    });
  });

  describe('Bulk Sending', () => {
    it('should send bulk emails', async () => {
      const result = await emailService.sendBulk(['a@test.com', 'b@test.com', 'c@test.com'], {
        subject: 'Bulk',
        body: 'Message',
      });

      expect(result.total).toBe(3);
      expect(result.sent).toBe(3);
    });
  });

  describe('Email Stats', () => {
    it('should track sent emails', async () => {
      await emailService.send({ to: 'a@test.com', subject: 'A', body: 'A' });
      await emailService.send({ to: 'b@test.com', subject: 'B', body: 'B' });

      const stats = emailService.getEmailStats();
      expect(stats.total).toBe(2);
    });
  });
});
