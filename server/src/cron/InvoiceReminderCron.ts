/**
 * Invoice Reminder Cron Job
 * GAP-INVOICE-005: Send invoice reminders before due date
 *
 * Sends reminder emails for unpaid invoices:
 * - 7 days before due date
 * - 3 days before due date
 * - 1 day before due date
 * - On due date
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface UnpaidInvoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  amount_due: number;
  currency: string;
  due_date: string;
  status: string;
  org_name?: string;
}

interface ReminderSent {
  invoice_id: string;
  days_before: number;
}

// ==========================================
// MAIN FUNCTIONS
// ==========================================

/**
 * Run invoice reminder job
 */
export async function runInvoiceReminders(): Promise<{
  checked: number;
  reminders_sent: number;
  errors: string[];
}> {
  const results = {
    checked: 0,
    reminders_sent: 0,
    errors: [] as string[],
  };

  try {
    const db = await getDatabase();

    // Get unpaid invoices with due dates in the next 7 days or past due
    const invoices = await db.all<UnpaidInvoice>(`
            SELECT i.*, o.name as org_name
            FROM invoices i
            LEFT JOIN organizations o ON i.organization_id = o.id
            WHERE i.status IN ('open', 'draft')
            AND i.amount_due > 0
            AND i.due_date IS NOT NULL
            AND i.due_date <= date('now', '+7 days')
            ORDER BY i.due_date ASC
        `);

    results.checked = invoices.length;

    for (const invoice of invoices) {
      try {
        const daysUntilDue = getDaysUntilDue(invoice.due_date);
        const reminderType = getReminderType(daysUntilDue);

        if (!reminderType) continue;

        // Check if reminder already sent
        const alreadySent = await db.get<ReminderSent>(
          `SELECT invoice_id FROM invoice_reminders_sent
                     WHERE invoice_id = ? AND days_before = ?`,
          [invoice.id, reminderType.daysBefore]
        );

        if (alreadySent) continue;

        // Send reminder email
        await sendInvoiceReminder(invoice, reminderType);

        // Record that reminder was sent
        await db.run(
          `INSERT INTO invoice_reminders_sent (id, invoice_id, days_before, sent_at)
                     VALUES (?, ?, ?, datetime('now'))`,
          [uuidv4(), invoice.id, reminderType.daysBefore]
        );

        results.reminders_sent++;
        logger.info(
          `[InvoiceReminder] Sent ${reminderType.type} reminder for invoice ${invoice.invoice_number}`
        );
      } catch (err: any) {
        results.errors.push(`Invoice ${invoice.id}: ${err.message}`);
        logger.error(`[InvoiceReminder] Error processing invoice ${invoice.id}:`, err);
      }
    }

    if (results.reminders_sent > 0) {
      logger.info(
        `[InvoiceReminder] Sent ${results.reminders_sent} reminders out of ${results.checked} invoices`
      );
    }
  } catch (err: any) {
    logger.error('[InvoiceReminder] Job failed:', err);
    results.errors.push(err.message);
  }

  return results;
}

/**
 * Calculate days until due date
 */
function getDaysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get reminder type based on days until due
 */
function getReminderType(daysUntilDue: number): { type: string; daysBefore: number } | null {
  if (daysUntilDue === 7) return { type: 'first', daysBefore: 7 };
  if (daysUntilDue === 3) return { type: 'second', daysBefore: 3 };
  if (daysUntilDue === 1) return { type: 'urgent', daysBefore: 1 };
  if (daysUntilDue === 0) return { type: 'due_today', daysBefore: 0 };
  if (daysUntilDue < 0) return { type: 'overdue', daysBefore: daysUntilDue };
  return null;
}

/**
 * Send invoice reminder email
 */
async function sendInvoiceReminder(
  invoice: UnpaidInvoice,
  reminderType: { type: string; daysBefore: number }
): Promise<void> {
  const db = await getDatabase();

  // Get admin emails for the organization
  const admins = await db.all<{ email: string; first_name: string }>(
    `SELECT email, first_name FROM users
         WHERE organization_id = ? AND role IN ('ADMIN', 'SUPERADMIN')`,
    [invoice.organization_id]
  );

  if (!admins || admins.length === 0) return;

  const EmailService = (await import('../services/emailService.js')).default;

  for (const admin of admins) {
    await EmailService.send({
      to: admin.email,
      subject: getSubjectLine(invoice, reminderType),
      html: generateReminderEmailHtml({
        firstName: admin.first_name,
        invoiceNumber: invoice.invoice_number,
        amount: invoice.amount_due,
        currency: invoice.currency,
        dueDate: new Date(invoice.due_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        reminderType: reminderType.type,
        orgName: invoice.org_name || 'Your organization',
      }),
    });
  }
}

/**
 * Get email subject line based on reminder type
 */
function getSubjectLine(invoice: UnpaidInvoice, reminderType: { type: string }): string {
  const amount = `${invoice.currency} ${invoice.amount_due.toFixed(2)}`;

  switch (reminderType.type) {
    case 'first':
      return `📋 Invoice ${invoice.invoice_number} due in 7 days (${amount})`;
    case 'second':
      return `⏰ Reminder: Invoice ${invoice.invoice_number} due in 3 days (${amount})`;
    case 'urgent':
      return `⚠️ Urgent: Invoice ${invoice.invoice_number} due tomorrow (${amount})`;
    case 'due_today':
      return `🔴 Action Required: Invoice ${invoice.invoice_number} due TODAY (${amount})`;
    case 'overdue':
      return `🚨 OVERDUE: Invoice ${invoice.invoice_number} (${amount})`;
    default:
      return `Invoice ${invoice.invoice_number} Reminder`;
  }
}

/**
 * Generate reminder email HTML
 */
function generateReminderEmailHtml(data: {
  firstName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  reminderType: string;
  orgName: string;
}): string {
  const colors: Record<string, string> = {
    first: '#3b82f6',
    second: '#f59e0b',
    urgent: '#ef4444',
    due_today: '#dc2626',
    overdue: '#7f1d1d',
  };

  const color = colors[data.reminderType] || '#3b82f6';
  const isUrgent = ['urgent', 'due_today', 'overdue'].includes(data.reminderType);

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${color}; padding: 20px; border-radius: 8px 8px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 20px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .invoice-box { background: white; border: 2px solid ${color}; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .amount { font-size: 32px; font-weight: bold; color: ${color}; }
        .due-date { font-size: 16px; color: #6b7280; margin-top: 10px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${isUrgent ? '⚠️' : '📋'} Invoice Payment Reminder</h1>
        </div>
        <div class="content">
            <p>Hi ${data.firstName},</p>
            
            <p>This is a reminder that invoice <strong>${data.invoiceNumber}</strong> for <strong>${data.orgName}</strong> ${
              data.reminderType === 'overdue'
                ? 'is overdue'
                : data.reminderType === 'due_today'
                  ? 'is due today'
                  : `is due on ${data.dueDate}`
            }.</p>
            
            <div class="invoice-box">
                <div class="amount">${data.currency} ${data.amount.toFixed(2)}</div>
                <div class="due-date">Due: ${data.dueDate}</div>
            </div>
            
            ${
              isUrgent
                ? `
            <p style="color: ${color}; font-weight: bold;">
                ${
                  data.reminderType === 'overdue'
                    ? 'This invoice is past due. Please pay immediately to avoid service interruption.'
                    : 'Please ensure payment is made promptly to avoid any service interruption.'
                }
            </p>
            `
                : `
            <p>Please ensure payment is made by the due date to maintain uninterrupted service.</p>
            `
            }
            
            <p>
                <a href="${process.env.FRONTEND_URL || 'https://app.consultify.com'}/settings/billing" 
                   style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Pay Now
                </a>
            </p>
            
            <p>If you have already made this payment, please disregard this reminder.</p>
            
            <p>Best regards,<br>The Consultify Team</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} Consultify. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
}

export default {
  runInvoiceReminders,
};
