/**
 * Production Logger
 * Outputs structured JSON logs for easy parsing by log aggregators
 */
import { NextFunction, Request, Response } from 'express';
interface LogMeta {
    [key: string]: unknown;
    error?: Error;
}
interface Logger {
    info: (message: string, meta?: LogMeta) => void;
    warn: (message: string, meta?: LogMeta) => void;
    error: (message: string, error?: Error | null, meta?: LogMeta) => void;
    debug: (message: string, meta?: LogMeta) => void;
    requestLogger: (req: Request, res: Response, next: NextFunction) => void;
}
declare const logger: Logger;
export default logger;
//# sourceMappingURL=logger.d.ts.map