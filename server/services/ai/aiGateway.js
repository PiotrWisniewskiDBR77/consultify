/**
 * AI Gateway Layer
 * Responsibility: Security, Rate Limiting, PII Scrubbing, Injection Guard
 */

const PII_PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(?:\+?48[\s-]?)?(?:\d{3}[\s-]?\d{3}[\s-]?\d{3}|\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})/g,
    pesel: /\b\d{11}\b/g,
    nip: /\b\d{10}\b|\b\d{3}[-]?\d{3}[-]?\d{2}[-]?\d{2}\b/g,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    iban: /[A-Z]{2}\d{2}[\s]?\d{4}/g
};

// Dangerous prompt injection patterns
const INJECTION_PATTERNS = [
    // Direct override attempts
    /ignore previous instructions/i,
    /disregard all prior/i,
    /forget everything/i,
    /you are now/i,
    /new persona/i,
    /system override/i,
    /pretend you are/i,
    /roleplay as/i,

    // Jailbreak attempts
    /DAN mode/i,
    /developer mode/i,
    /jailbreak/i,
    /bypass safety/i,

    // Encoded instruction markers (often used in Base64 attacks)
    /\[INST\]/i,
    /\[SYSTEM\]/i,
    /<<SYS>>/i
];

// Base64 pattern - detects Base64 encoded strings
const BASE64_PATTERN = /(?:[A-Za-z0-9+/]{4}){2,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;

const { aiLogger } = require('./logger');
const { rateLimiter } = require('./rateLimiter');

class AIGateway {
    constructor() {
        this.piiEnabled = true;
        this.strictMode = process.env.AI_STRICT_MODE === 'true';
        this.emergencyStop = process.env.AI_EMERGENCY_STOP === 'true';
    }

    async process(request) {
        // 0. Global Emergency Stop
        if (this.emergencyStop) {
            aiLogger.error('Gateway', 'Global Emergency Stop active');
            throw new Error('AI services are temporarily disabled (Emergency Stop)');
        }

        // 1. Check Budget Thresholds (Emergency Stop)
        await this.checkBudgetThreshold(request);

        // 2. Check Rate Limits (User → Organization)
        await this.checkRateLimit(request);

        // 3. PII Scrubbing
        if (this.piiEnabled) {
            this.scrubPII(request);
        }

        // 4. Prompt Injection Guard
        const injectionResult = this.guardPromptInjection(request);
        if (injectionResult.blocked && this.strictMode) {
            aiLogger.error('Gateway', `Prompt injection blocked: ${injectionResult.pattern}`);
            throw new Error(`Prompt injection detected: ${injectionResult.pattern}`);
        }
    }

    /**
     * Check organization budget thresholds
     * - 110% usage: Block Premium/Reasoning tiers
     * - 150% usage: Block ALL AI calls
     */
    async checkBudgetThreshold(request) {
        try {
            const { quotaService } = require('./quotaService');
            const usage = await quotaService.getUsage('organization', request.organizationId);

            if (!usage) return; // No quota = no limit (for now)

            const percentUsed = usage.monthly.percentUsed;
            const tier = request.options?.tier || 'STANDARD';

            // 150% - Complete shutdown
            if (percentUsed >= 150) {
                aiLogger.error('Gateway', `EMERGENCY STOP: Org ${request.organizationId} at ${percentUsed}% budget`);
                throw new Error('Organization budget exceeded (150%). All AI services blocked.');
            }

            // 110% - Block expensive tiers only
            if (percentUsed >= 110 && ['PREMIUM', 'REASONING'].includes(tier)) {
                aiLogger.warn('Gateway', `Budget limit (110%) reached for Org ${request.organizationId} - blocking ${tier}`);
                throw new Error(`Organization budget exceeded (110%). ${tier} tier blocked. Use BUDGET tier.`);
            }

            // 100% - Warning log
            if (percentUsed >= 100) {
                aiLogger.warn('Gateway', `Budget limit reached: Org ${request.organizationId} at ${percentUsed}%`);
            }
        } catch (e) {
            if (e.message.includes('budget')) throw e;
            aiLogger.error('Gateway', 'Budget check error', e);
        }
    }

    /**
     * Check rate limits using sliding window algorithm
     * Supports both Redis (distributed) and in-memory (fallback)
     */
    async checkRateLimit(request) {
        const result = await rateLimiter.check({
            userId: request.userId,
            organizationId: request.organizationId,
            capability: request.capability || 'chat',
            ip: request.ip
        });

        if (!result.allowed) {
            aiLogger.warn('Gateway', `Rate limit exceeded: ${result.reason}`, {
                userId: request.userId,
                organizationId: request.organizationId,
                resetIn: result.resetIn
            });

            const error = new Error(result.reason);
            error.statusCode = 429;
            error.retryAfter = result.resetIn;
            throw error;
        }

        return true;
    }

    scrubPII(request) {
        if (request.prompt) {
            request.prompt = this.redactPII(request.prompt);
        }

        if (request.messages && Array.isArray(request.messages)) {
            request.messages = request.messages.map(msg => ({
                ...msg,
                content: typeof msg.content === 'string'
                    ? this.redactPII(msg.content)
                    : msg.content
            }));
        }

        if (request.screenContext && typeof request.screenContext === 'object') {
            const contextStr = JSON.stringify(request.screenContext);
            const redacted = this.redactPII(contextStr);
            try {
                request.screenContext = JSON.parse(redacted);
            } catch (e) {
                console.warn('[AIGateway] Failed to parse redacted screenContext');
            }
        }
    }

    redactPII(text) {
        if (!text) return text;

        let result = text;
        result = result.replace(PII_PATTERNS.email, '[REDACTED_EMAIL]');
        result = result.replace(PII_PATTERNS.phone, '[REDACTED_PHONE]');
        result = result.replace(PII_PATTERNS.pesel, '[REDACTED_PESEL]');
        result = result.replace(PII_PATTERNS.nip, '[REDACTED_NIP]');
        result = result.replace(PII_PATTERNS.creditCard, '[REDACTED_CC]');
        result = result.replace(PII_PATTERNS.iban, '[REDACTED_IBAN]');

        return result;
    }

    /**
     * Guard against prompt injection attacks
     * Includes: Plain text patterns, Base64 encoding, ROT13 rotation
     */
    guardPromptInjection(request) {
        const result = { blocked: false, warnings: [], pattern: null };

        const checkContent = (content, source) => {
            if (!content || typeof content !== 'string') return;

            // 1. Check plain text patterns
            for (const pattern of INJECTION_PATTERNS) {
                if (pattern.test(content)) {
                    result.warnings.push({
                        source,
                        type: 'PLAIN_TEXT',
                        pattern: pattern.toString()
                    });
                    result.pattern = pattern.toString();
                    console.warn(`[AIGateway] Injection detected in ${source}: ${pattern}`);
                }
            }

            // 2. Check Base64 encoded content
            const base64Matches = content.match(BASE64_PATTERN) || [];
            for (const match of base64Matches) {
                if (match.length >= 20) { // Only check substantial Base64 strings
                    try {
                        const decoded = Buffer.from(match, 'base64').toString('utf8');
                        // Check if decoded content contains injection patterns
                        for (const pattern of INJECTION_PATTERNS) {
                            if (pattern.test(decoded)) {
                                result.blocked = true;
                                result.warnings.push({
                                    source,
                                    type: 'BASE64_ENCODED',
                                    pattern: pattern.toString()
                                });
                                result.pattern = `BASE64: ${pattern}`;
                                console.warn(`[AIGateway] BASE64 injection in ${source}: ${pattern}`);
                            }
                        }
                    } catch (e) {
                        // Not valid Base64, ignore
                    }
                }
            }

            // 3. Check ROT13 encoded content
            const rot13Decoded = this.rot13(content);
            for (const pattern of INJECTION_PATTERNS) {
                if (pattern.test(rot13Decoded)) {
                    result.warnings.push({
                        source,
                        type: 'ROT13_ENCODED',
                        pattern: pattern.toString()
                    });
                    console.warn(`[AIGateway] ROT13 injection in ${source}: ${pattern}`);
                }
            }

            // 4. Check for Unicode homoglyph obfuscation
            const normalized = this.normalizeHomoglyphs(content);
            if (normalized !== content) {
                for (const pattern of INJECTION_PATTERNS) {
                    if (pattern.test(normalized)) {
                        result.warnings.push({
                            source,
                            type: 'HOMOGLYPH_OBFUSCATION',
                            pattern: pattern.toString()
                        });
                        console.warn(`[AIGateway] Homoglyph injection in ${source}`);
                    }
                }
            }
        };

        if (request.prompt) {
            checkContent(request.prompt, 'prompt');
        }

        if (request.messages) {
            request.messages.forEach((msg, i) => checkContent(msg.content, `message[${i}]`));
        }

        return result;
    }

    /**
     * ROT13 decode/encode
     */
    rot13(str) {
        return str.replace(/[a-zA-Z]/g, c => {
            const base = c <= 'Z' ? 65 : 97;
            return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
        });
    }

    /**
     * Normalize common Unicode homoglyphs to ASCII
     */
    normalizeHomoglyphs(str) {
        const homoglyphMap = {
            'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x',  // Cyrillic
            'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g',           // More Cyrillic
            '𝐚': 'a', '𝐛': 'b', '𝐜': 'c', '𝐝': 'd', '𝐞': 'e',           // Math bold
            'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e',         // Fullwidth
            '０': '0', '１': '1', '２': '2', '３': '3', '４': '4'        // Fullwidth numbers
        };

        return str.split('').map(c => homoglyphMap[c] || c).join('');
    }
}

module.exports = { AIGateway };
