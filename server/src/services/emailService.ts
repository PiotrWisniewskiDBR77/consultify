// @ts-nocheck
/**
 * Email Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/emailService.js (ES Modules) to TypeScript (ES Modules)
 * Handles sending system notifications and alerts.
 * Currently configured for console output, ready for SMTP integration.
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import {
  renderTemplate as renderEmailTemplate,
  templateExists as emailTemplateExists,
} from './email/emailTemplateRenderer.js';

// ==========================================
// TYPES
// ==========================================

interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  template?: string;
  data?: Record<string, unknown>;
  /** Return false unless a configured provider acknowledges the message. */
  requireDelivery?: boolean;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: string;
    contentType?: string;
  }>;
}

interface SMTPConfig {
  host?: string;
  port?: number;
  secure: boolean;
  auth?: {
    user?: string;
    pass?: string;
  };
  from: string;
}

interface SettingRow {
  key: string;
  value: string;
}

// ==========================================
// TEMPLATE ALIASES
// ==========================================

/**
 * Map legacy / short template names passed by existing callers to the actual
 * `.hbs` file paths under templates/emails. Callers may also pass the real path
 * directly (e.g. "billing/invoice_created"), in which case no alias is needed.
 *
 * Only entries that have a real .hbs on disk get wired; unmapped names (e.g.
 * "dunning_retry_1", "welcome") fall through to the caller's inline content.
 */
const TEMPLATE_ALIASES: Record<string, string> = {
  invoice: 'billing/invoice_created',
  invoice_created: 'billing/invoice_created',
  invoice_paid: 'billing/invoice_paid',
  invoice_overdue: 'billing/invoice_overdue',
  payment_failed: 'billing/payment_failed',
  payment_method_expiring: 'billing/payment_method_expiring',
  credit_note_issued: 'billing/credit_note_issued',
  subscription_renewed: 'billing/subscription_renewed',
  subscription_canceled: 'billing/subscription_canceled',
};

/**
 * Resolve a caller template name to a renderable .hbs path, or null if no
 * template file exists for it (caller keeps its inline content).
 */
function resolveTemplatePath(template?: string): string | null {
  if (!template) return null;
  const aliased = TEMPLATE_ALIASES[template] ?? template;
  return emailTemplateExists(aliased) ? aliased : null;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();
let nodemailer: any;
let config: any;

/**
 * Initialize dependencies lazily
 */
async function initDeps(): Promise<void> {
  if (nodemailer && config) return;

  // Always use the runtime database instance (sqlite/postgres) from Database.js.
  // Importing ../database/index.js returns the module namespace (pool helpers),
  // not an IDatabase instance, which breaks DbPromise(db, ...) calls.
  db = getDatabase();

  const [nodemailerModule, configModule] = await Promise.all([
    // @ts-ignore
    import('nodemailer') as any,
    import('../config/Config.js'),
  ]);

  nodemailer = nodemailerModule.default || nodemailerModule;
  config = configModule.default || configModule;
}

/**
 * Set dependencies for testing
 */
export function setDependencies(
  newDeps: { db?: IDatabase; nodemailer?: any; config?: any } = {}
): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
  if (newDeps.nodemailer) {
    nodemailer = newDeps.nodemailer;
  }
  if (newDeps.config) {
    config = newDeps.config;
  }
}

/**
 * Send an email
 */
export async function send(options: SendEmailOptions): Promise<boolean> {
  await initDeps();

  const { to, subject, html, template, data, attachments = [], requireDelivery = false } = options;

  // 0. Render Handlebars .hbs template when one exists for `template`.
  //    An explicit `html` always wins (caller opted out of the template).
  //    Any render failure MUST fall back to the previous behaviour and never
  //    block the send (Task #84, fallback requirement).
  let renderedHtml: string | undefined = html;
  if (!renderedHtml && template) {
    const templatePath = resolveTemplatePath(template);
    if (templatePath) {
      const out = renderEmailTemplate(templatePath, {
        subject,
        recipientName: (data as Record<string, unknown>)?.recipientName,
        ...(data ?? {}),
      });
      if (out) {
        renderedHtml = out;
      } else {
        logger.warn(
          `[EMAIL SERVICE] Template "${template}" (${templatePath}) failed to render; falling back to inline content`
        );
      }
    }
  }

  // 1. Fetch SMTP Settings from DB
  const settingsRows = await DbPromise.all<SettingRow>(
    db,
    "SELECT key, value FROM settings WHERE key LIKE 'smtp_%'",
    []
  );

  const settings: Record<string, string> = {};
  settingsRows.forEach((r) => {
    settings[r.key] = r.value;
  });

  const smtpConfig: SMTPConfig = {
    host: settings['smtp_host'] || process.env.SMTP_HOST,
    port: parseInt(settings['smtp_port'] || process.env.SMTP_PORT || '587', 10),
    secure: false, // true for 465, false for other ports
    auth: {
      user: settings['smtp_user'] || process.env.SMTP_USER,
      pass: settings['smtp_pass'] || process.env.SMTP_PASS,
    },
    from:
      settings['smtp_from'] ||
      process.env.SMTP_FROM ||
      '"Consultify System" <system@consultify.com>',
  };

  // For logging and debugging
  const displayHtml = renderedHtml || `Template: ${template}`;
  logger.info(`\n--- [EMAIL SERVICE] Sending to ${to} ---`);
  logger.info(`Using Host: ${smtpConfig.host || 'Mock (Console)'}`);
  logger.info(`Subject: ${subject}`);
  logger.info(`Content: ${displayHtml.substring(0, 100)}...`);
  logger.info('------------------------------------------\n');

  // IF REAL CONFIG EXISTS, TRY SENDING
  if (smtpConfig.host && smtpConfig.auth?.user) {
    try {
      const transporter = nodemailer.createTransport(smtpConfig);
      await transporter.sendMail({
        from: smtpConfig.from,
        to,
        subject,
        html:
          renderedHtml ||
          `<h1>${subject}</h1><p>Template: ${template}</p><pre>${JSON.stringify(data, null, 2)}</pre>`,
        attachments,
      });
      logger.info('[EMAIL SERVICE] Sent successfully via SMTP');
    } catch (e: unknown) {
      const error = e as Error;
      logger.error('[EMAIL SERVICE] SMTP Failed:', error.message);
      if (requireDelivery) return false;
    }
  } else if (requireDelivery) {
    return false;
  }

  return true;
}

/**
 * Legacy method name
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  return send({ to, subject, html });
}

// Default export for backward compatibility
const EmailService = {
  setDependencies,
  send,
  sendEmail,
};

export default EmailService;
