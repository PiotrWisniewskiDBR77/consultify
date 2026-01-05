/**
 * Logger Utility
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import winston from 'winston';

export interface LoggerMeta {
    [key: string]: unknown;
}

export interface Logger {
    error: (message: string, ...meta: any[]) => void;
    warn: (message: string, ...meta: any[]) => void;
    info: (message: string, ...meta: any[]) => void;
    http: (message: string, ...meta: any[]) => void;
    debug: (message: string, ...meta: any[]) => void;
}

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const level = () => {
    const env = process.env.NODE_ENV || 'development';
    const isDevelopment = env === 'development' || env === 'test';
    return isDevelopment ? 'debug' : 'warn';
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
);

const transports = [
    new winston.transports.Console(),
    new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
    }),
    new winston.transports.File({ filename: 'logs/all.log' }),
];

const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
});

export default logger;
