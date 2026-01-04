/**
 * AI Logger - Production-ready logging for AI services
 * Replaces console.log with structured logging.
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/Logger.js';

export const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

type TraceAttributes = Record<string, unknown>;

type TraceEvent = {
    name: string;
    timestamp: number;
    attributes: TraceAttributes;
};

/**
 * Trace Context for distributed tracing
 * Compatible with W3C Trace Context and OpenTelemetry
 */
export class TraceContext {
    traceId: string;
    spanId: string;
    parentSpanId: string | null;
    startTime: number;
    attributes: TraceAttributes;
    events: TraceEvent[];

    constructor(traceId: string | null = null, spanId: string | null = null, parentSpanId: string | null = null) {
        this.traceId = traceId || TraceContext.generateTraceId();
        this.spanId = spanId || TraceContext.generateSpanId();
        this.parentSpanId = parentSpanId;
        this.startTime = Date.now();
        this.attributes = {};
        this.events = [];
    }

    static generateTraceId(): string {
        return uuidv4().replace(/-/g, '');
    }

    static generateSpanId(): string {
        return uuidv4().replace(/-/g, '').substring(0, 16);
    }

    setAttribute(key: string, value: unknown): this {
        this.attributes[key] = value;
        return this;
    }

    addEvent(name: string, attributes: TraceAttributes = {}): this {
        this.events.push({
            name,
            timestamp: Date.now(),
            attributes,
        });
        return this;
    }

    getDuration(): number {
        return Date.now() - this.startTime;
    }

    toJSON(): Record<string, unknown> {
        return {
            traceId: this.traceId,
            spanId: this.spanId,
            parentSpanId: this.parentSpanId,
            duration: this.getDuration(),
            attributes: this.attributes,
            events: this.events,
        };
    }

    toTraceparent(): string {
        return `00-${this.traceId}-${this.spanId}-01`;
    }

    static fromTraceparent(header: string | null | undefined): TraceContext | null {
        if (!header) return null;
        const parts = header.split('-');
        if (parts.length !== 4) return null;
        return new TraceContext(parts[1], parts[2]);
    }
}

const activeSpans = new Map<string, TraceContext>();
let currentTraceContext: TraceContext | null = null;

const getCurrentLevel = (): number => {
    const env = process.env.NODE_ENV || 'development';
    const configuredLevel = process.env.AI_LOG_LEVEL?.toUpperCase() as LogLevel | undefined;

    if (configuredLevel && LOG_LEVELS[configuredLevel] !== undefined) {
        return LOG_LEVELS[configuredLevel];
    }

    return env === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
};

const formatMessage = (
    level: string,
    component: string,
    message: string,
    data: unknown = null,
    traceContext: TraceContext | null = null,
): string => {
    const timestamp = new Date().toISOString();
    const traceInfo = traceContext
        ? ` [trace:${traceContext.traceId.substring(0, 8)}] [span:${traceContext.spanId}]`
        : '';
    const base = `[${timestamp}] [${level}] [AI:${component}]${traceInfo} ${message}`;

    if (data && process.env.NODE_ENV !== 'production') {
        return `${base} ${JSON.stringify(data)}`;
    }

    return base;
};

export const aiLogger = {
    currentLevel: getCurrentLevel(),

    getTraceContext(): TraceContext | null {
        return currentTraceContext;
    },

    setTraceContext(context: TraceContext | null): void {
        currentTraceContext = context;
    },

    debug(component: string, message: string, data: unknown = null): void {
        if (this.currentLevel <= LOG_LEVELS.DEBUG) {
            logger.info(formatMessage('DEBUG', component, message, data, currentTraceContext));
        }
    },

    info(component: string, message: string, data: unknown = null): void {
        if (this.currentLevel <= LOG_LEVELS.INFO) {
            logger.info(formatMessage('INFO', component, message, data, currentTraceContext));
        }
    },

    warn(component: string, message: string, data: unknown = null): void {
        if (this.currentLevel <= LOG_LEVELS.WARN) {
            logger.warn(formatMessage('WARN', component, message, data, currentTraceContext));
        }
    },

    error(component: string, message: string, error: unknown = null): void {
        if (this.currentLevel <= LOG_LEVELS.ERROR) {
            const errorData = error instanceof Error ? { message: error.message, stack: error.stack } : error;
            logger.error(formatMessage('ERROR', component, message, errorData, currentTraceContext));
        }
    },

    pipeline(action: string, data: unknown = null): void {
        this.info('Pipeline', action, data);
    },

    rag(action: string, data: unknown = null): void {
        this.info('RAG', action, data);
    },

    tool(toolName: string, status: string, data: unknown = null): void {
        this.info('MCP', `${toolName}: ${status}`, data);
    },

    cache(action: string, hit = true): void {
        this.debug('Cache', `${action}: ${hit ? 'HIT' : 'MISS'}`);
    },

    audit(action: string, data: unknown): void {
        logger.info(formatMessage('AUDIT', 'Audit', action, data, currentTraceContext));
    },

    startTrace(operationName: string, attributes: TraceAttributes = {}): TraceContext {
        const context = new TraceContext();
        context.setAttribute('operation', operationName);
        Object.entries(attributes).forEach(([key, value]) => context.setAttribute(key, value));

        currentTraceContext = context;
        activeSpans.set(context.spanId, context);

        this.debug('Tracing', `Started trace: ${operationName}`, {
            traceId: context.traceId,
            spanId: context.spanId,
        });

        return context;
    },

    startSpan(operationName: string, attributes: TraceAttributes = {}): TraceContext {
        const parentContext = currentTraceContext;
        const context = new TraceContext(
            parentContext?.traceId ?? null,
            TraceContext.generateSpanId(),
            parentContext?.spanId ?? null,
        );

        context.setAttribute('operation', operationName);
        Object.entries(attributes).forEach(([key, value]) => context.setAttribute(key, value));

        currentTraceContext = context;
        activeSpans.set(context.spanId, context);

        this.debug('Tracing', `Started span: ${operationName}`, {
            traceId: context.traceId,
            spanId: context.spanId,
            parentSpanId: context.parentSpanId,
        });

        return context;
    },

    endSpan(context: TraceContext, status = 'OK', finalAttributes: TraceAttributes = {}): TraceContext | undefined {
        if (!context) return;

        context.setAttribute('status', status);
        context.setAttribute('duration_ms', context.getDuration());
        Object.entries(finalAttributes).forEach(([key, value]) => context.setAttribute(key, value));

        activeSpans.delete(context.spanId);

        if (context.parentSpanId && activeSpans.has(context.parentSpanId)) {
            currentTraceContext = activeSpans.get(context.parentSpanId) || null;
        } else if (activeSpans.size > 0) {
            currentTraceContext = activeSpans.values().next().value || null;
        } else {
            currentTraceContext = null;
        }

        this.debug('Tracing', `Ended span: ${String(context.attributes.operation)}`, {
            traceId: context.traceId,
            spanId: context.spanId,
            duration: context.getDuration(),
            status,
        });

        if (process.env.TRACING_PERSIST === 'true') {
            this._persistSpan(context);
        }

        return context;
    },

    recordEvent(name: string, attributes: TraceAttributes = {}): void {
        if (currentTraceContext) {
            currentTraceContext.addEvent(name, attributes);
            this.debug('Tracing', `Event: ${name}`, attributes);
        }
    },

    setAttribute(key: string, value: unknown): void {
        if (currentTraceContext) {
            currentTraceContext.setAttribute(key, value);
        }
    },

    async withSpan<T>(
        operationName: string,
        fn: (context: TraceContext) => Promise<T>,
        attributes: TraceAttributes = {},
    ): Promise<T> {
        const span = this.startSpan(operationName, attributes);
        try {
            const result = await fn(span);
            this.endSpan(span, 'OK');
            return result;
        } catch (error: unknown) {
            span.setAttribute('error', true);
            span.setAttribute('error.message', error instanceof Error ? error.message : error);
            this.endSpan(span, 'ERROR', { error: error instanceof Error ? error.message : error });
            throw error;
        }
    },

    getTraceparent(): string | null {
        return currentTraceContext?.toTraceparent() || null;
    },

    setTraceparentContext(traceparent: string): void {
        const context = TraceContext.fromTraceparent(traceparent);
        if (context) {
            currentTraceContext = context;
            activeSpans.set(context.spanId, context);
        }
    },

    _persistSpan(context: TraceContext): void {
        const spanData = {
            type: 'AI_TRACE_SPAN',
            ...context.toJSON(),
            timestamp: new Date().toISOString(),
        };

        if (process.env.NODE_ENV === 'production') {
            logger.info(JSON.stringify(spanData));
        }
    },

    getActiveSpans(): Array<Record<string, unknown>> {
        return Array.from(activeSpans.values()).map((span) => span.toJSON());
    },

    clearSpans(): void {
        activeSpans.clear();
        currentTraceContext = null;
    },
};

export default aiLogger;
