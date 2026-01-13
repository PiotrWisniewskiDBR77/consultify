-- GAP-INVOICE-005: Invoice reminders tracking
-- Migration: 243_invoice_reminders.sql

CREATE TABLE IF NOT EXISTS invoice_reminders_sent (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    days_before INTEGER NOT NULL, -- 7, 3, 1, 0, or negative for overdue
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(invoice_id, days_before)
);

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice ON invoice_reminders_sent(invoice_id);
