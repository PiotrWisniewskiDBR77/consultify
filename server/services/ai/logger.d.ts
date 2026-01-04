export namespace aiLogger {
    let currentLevel: any;
    function getTraceContext(): any;
    function setTraceContext(context: any): void;
    function debug(component: any, message: any, data?: null): void;
    function info(component: any, message: any, data?: null): void;
    function warn(component: any, message: any, data?: null): void;
    function error(component: any, message: any, error?: null): void;
    function pipeline(action: any, data?: null): void;
    function rag(action: any, data?: null): void;
    function tool(toolName: any, status: any, data?: null): void;
    function cache(action: any, hit?: boolean): void;
    function audit(action: any, data: any): void;
    /**
     * Start a new trace
     * @param {string} operationName - Name of the operation being traced
     * @param {Object} attributes - Initial span attributes
     * @returns {TraceContext} The new trace context
     */
    function startTrace(operationName: string, attributes?: Object): TraceContext;
    /**
     * Start a child span within current trace
     * @param {string} operationName - Name of the span
     * @param {Object} attributes - Span attributes
     * @returns {TraceContext} The child span context
     */
    function startSpan(operationName: string, attributes?: Object): TraceContext;
    /**
     * End a span and record its duration
     * @param {TraceContext} context - The span context to end
     * @param {string} status - 'OK' or 'ERROR'
     * @param {Object} finalAttributes - Additional attributes to record
     */
    function endSpan(context: TraceContext, status?: string, finalAttributes?: Object): TraceContext | undefined;
    /**
     * Record an event within the current span
     * @param {string} name - Event name
     * @param {Object} attributes - Event attributes
     */
    function recordEvent(name: string, attributes?: Object): void;
    /**
     * Add attribute to current span
     * @param {string} key - Attribute key
     * @param {any} value - Attribute value
     */
    function setAttribute(key: string, value: any): void;
    /**
     * Execute a function within a traced span
     * @param {string} operationName - Name of the operation
     * @param {Function} fn - Function to execute
     * @param {Object} attributes - Initial span attributes
     * @returns {Promise<any>} Result of the function
     */
    function withSpan(operationName: string, fn: Function, attributes?: Object): Promise<any>;
    /**
     * Get W3C traceparent header for propagation
     * @returns {string|null} Traceparent header value
     */
    function getTraceparent(): string | null;
    /**
     * Set trace context from incoming traceparent header
     * @param {string} traceparent - W3C traceparent header
     */
    function setTraceparentContext(traceparent: string): void;
    /**
     * Persist span to database (for analysis)
     * @private
     */
    function _persistSpan(context: any): void;
    /**
     * Get all active spans (for debugging)
     * @returns {Array} Active span contexts
     */
    function getActiveSpans(): any[];
    /**
     * Clear all spans (for testing)
     */
    function clearSpans(): void;
}
export namespace LOG_LEVELS {
    let DEBUG: number;
    let INFO: number;
    let WARN: number;
    let ERROR: number;
}
/**
 * Trace Context for distributed tracing
 * Compatible with W3C Trace Context and OpenTelemetry
 */
export class TraceContext {
    static generateTraceId(): string;
    static generateSpanId(): string;
    static fromTraceparent(header: any): TraceContext | null;
    constructor(traceId?: null, spanId?: null, parentSpanId?: null);
    traceId: string;
    spanId: string;
    parentSpanId: any;
    startTime: number;
    attributes: {};
    events: any[];
    setAttribute(key: any, value: any): this;
    addEvent(name: any, attributes?: {}): this;
    getDuration(): number;
    toJSON(): {
        traceId: string;
        spanId: string;
        parentSpanId: any;
        duration: number;
        attributes: {};
        events: any[];
    };
    toTraceparent(): string;
}
//# sourceMappingURL=logger.d.ts.map