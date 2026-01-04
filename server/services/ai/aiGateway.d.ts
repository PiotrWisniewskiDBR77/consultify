export class AIGateway {
    piiEnabled: boolean;
    strictMode: boolean;
    emergencyStop: boolean;
    process(request: any): Promise<void>;
    /**
     * Check organization budget thresholds
     * - 110% usage: Block Premium/Reasoning tiers
     * - 150% usage: Block ALL AI calls
     */
    checkBudgetThreshold(request: any): Promise<void>;
    /**
     * Check rate limits using sliding window algorithm
     * Supports both Redis (distributed) and in-memory (fallback)
     */
    checkRateLimit(request: any): Promise<boolean>;
    scrubPII(request: any): void;
    redactPII(text: any): any;
    /**
     * Guard against prompt injection attacks
     * Includes: Plain text patterns, Base64 encoding, ROT13 rotation
     */
    guardPromptInjection(request: any): {
        blocked: boolean;
        warnings: never[];
        pattern: null;
    };
    /**
     * ROT13 decode/encode
     */
    rot13(str: any): any;
    /**
     * Normalize common Unicode homoglyphs to ASCII
     */
    normalizeHomoglyphs(str: any): any;
}
//# sourceMappingURL=aiGateway.d.ts.map