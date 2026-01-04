/**
 * Production Logger (Winston)
 * Enterprise SaaS Architecture
 *
 * Replaces custom console logger with structured Winston logging.
 * Supports log rotation, levels, and JSON formatting.
 */
import { NextFunction, Request, Response } from 'express';
import winston from 'winston';
interface LogMeta {
    [key: string]: unknown;
}
declare const logger: {
    info: (message: string, meta?: LogMeta) => winston.Logger;
    warn: (message: string, meta?: LogMeta) => winston.Logger;
    error: (message: string, error?: Error | null, meta?: LogMeta) => void;
    debug: (message: string, meta?: LogMeta) => winston.Logger;
    http: (message: string, meta?: LogMeta) => winston.Logger;
    requestLogger: (req: Request, res: Response, next: NextFunction) => void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map