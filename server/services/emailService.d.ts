/**
 * Email Service
 * Handles sending system notifications and alerts.
 * Currently configured for console output, ready for SMTP integration.
 */
import nodemailer from 'nodemailer';
interface Database {
    all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
}
interface EmailAttachment {
    filename?: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
}
export interface EmailOptions {
    to: string;
    subject: string;
    html?: string;
    template?: string;
    data?: unknown;
    attachments?: EmailAttachment[];
}
interface Dependencies {
    db: Database;
    nodemailer: typeof nodemailer;
    config: unknown;
}
export interface EmailServiceInterface {
    setDependencies: (newDeps: Partial<Dependencies>) => void;
    send: (options: EmailOptions) => Promise<boolean>;
    sendEmail: (to: string, subject: string, html: string) => Promise<boolean>;
}
declare const EmailService: EmailServiceInterface;
export default EmailService;
//# sourceMappingURL=emailService.d.ts.map