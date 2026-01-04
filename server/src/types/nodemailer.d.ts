/**
 * Type declarations for nodemailer module
 * Basic types for email sending functionality
 */

declare module 'nodemailer' {
    export interface TransportOptions {
        host?: string;
        port?: number;
        secure?: boolean;
        auth?: {
            user?: string;
            pass?: string;
        };
        [key: string]: unknown;
    }

    export interface SendMailOptions {
        from?: string;
        to: string | string[];
        subject: string;
        text?: string;
        html?: string;
        attachments?: Array<{
            filename?: string;
            path?: string;
            content?: string | Buffer;
            contentType?: string;
            [key: string]: unknown;
        }>;
        [key: string]: unknown;
    }

    export interface SentMessageInfo {
        messageId: string;
        response: string;
        [key: string]: unknown;
    }

    export interface Transporter {
        sendMail(mailOptions: SendMailOptions): Promise<SentMessageInfo>;
        verify(): Promise<boolean>;
        close(): Promise<void>;
    }

    export function createTransport(options: TransportOptions): Transporter;
    export function createTransport(transport: string, defaults?: TransportOptions): Transporter;

    const nodemailer: {
        createTransport: typeof createTransport;
    };

    export default nodemailer;
}

