/**
 * Email Template Renderer — unit tests (Task #84)
 *
 * Verifies the Handlebars renderer that wires the branded billing .hbs
 * templates into the email pipeline: real template compilation, branding
 * defaults, caller-data precedence, name normalization / traversal guards, and
 * the non-throwing fallback contract (returns null on failure, never throws).
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  renderTemplate,
  templateExists,
  normalizeTemplateName,
  brandingDefaults,
  clearTemplateCache,
} from '../../../../server/src/services/email/emailTemplateRenderer.js';

describe('emailTemplateRenderer', () => {
  beforeEach(() => {
    clearTemplateCache();
  });

  describe('templateExists', () => {
    it('finds a real billing template on disk', () => {
      expect(templateExists('billing/invoice_created')).toBe(true);
    });

    it('accepts a name with the .hbs extension', () => {
      expect(templateExists('billing/invoice_created.hbs')).toBe(true);
    });

    it('returns false for a non-existent template', () => {
      expect(templateExists('billing/does_not_exist')).toBe(false);
    });
  });

  describe('normalizeTemplateName', () => {
    it('strips extension and templates/emails prefix', () => {
      expect(normalizeTemplateName('emails/billing/invoice_created.hbs')).toBe(
        'billing/invoice_created'
      );
    });

    it('rejects path traversal', () => {
      expect(normalizeTemplateName('../../secrets')).toBeNull();
      expect(normalizeTemplateName('/etc/passwd')).toBeNull();
    });

    it('rejects illegal characters', () => {
      expect(normalizeTemplateName('billing/invoice;rm -rf')).toBeNull();
    });
  });

  describe('renderTemplate', () => {
    it('renders an invoice_created template with caller data', () => {
      const html = renderTemplate('billing/invoice_created', {
        recipientName: 'Ada Lovelace',
        invoiceNumber: 'INV-202607-0001',
        amount: '199.00',
        currency: 'USD',
        invoiceDate: '2026-07-01',
        dueDate: '2026-07-31',
        invoiceUrl: 'https://app.example.com/invoices/1',
      });

      expect(html).toBeTypeOf('string');
      expect(html).toContain('Ada Lovelace');
      expect(html).toContain('INV-202607-0001');
      expect(html).toContain('199.00');
      expect(html).toContain('https://app.example.com/invoices/1');
      // Handlebars {{#if}} branch: no plan -> block omitted, no literal braces.
      expect(html).not.toContain('{{');
    });

    it('injects branding defaults when caller omits them', () => {
      const html = renderTemplate('billing/invoice_created', {
        recipientName: 'Ada',
        invoiceNumber: 'X',
        amount: '1',
        currency: 'USD',
      });
      // companyName default = Consultify (or COMPANY_NAME env)
      expect(html).toContain(brandingDefaults().companyName as string);
    });

    it('lets caller data override branding defaults', () => {
      const html = renderTemplate('billing/subscription_canceled', {
        recipientName: 'Ada',
        companyName: 'AcmeCorp',
        planName: 'Pro',
        cancellationDate: '2026-07-01',
        accessUntilDate: '2026-07-31',
      });
      expect(html).toContain('AcmeCorp');
    });

    it('returns null for a missing template (does not throw)', () => {
      expect(renderTemplate('billing/nope')).toBeNull();
    });

    it('returns null for an invalid/traversal name (does not throw)', () => {
      expect(renderTemplate('../../evil')).toBeNull();
    });
  });

  describe('caching', () => {
    it('renders identically across repeated calls (cache hit path)', () => {
      const data = { recipientName: 'Same', invoiceNumber: 'C1', amount: '5', currency: 'USD' };
      const a = renderTemplate('billing/invoice_created', data);
      const b = renderTemplate('billing/invoice_created', data);
      expect(a).toBe(b);
    });
  });
});
