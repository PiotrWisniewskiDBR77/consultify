/**
 * EnterpriseSecurity Unit Tests
 * 
 * Tests for enterprise-grade AI security features.
 */

const { enterpriseSecurity, EnterpriseSecurityService } = require('../../../server/services/ai/enterpriseSecurity');

describe('EnterpriseSecurity', () => {
    describe('PII Detection', () => {
        it('should detect email addresses', () => {
            const text = 'Contact me at john.doe@example.com for more info';
            const service = new EnterpriseSecurityService();
            
            const hasPII = service.detectPII(text);
            
            expect(hasPII).toContain('email');
        });

        it('should detect phone numbers', () => {
            const text = 'Call me at +1 (555) 123-4567';
            const service = new EnterpriseSecurityService();
            
            const hasPII = service.detectPII(text);
            
            expect(hasPII).toContain('phone');
        });

        it('should detect Polish PESEL numbers', () => {
            const text = 'My PESEL is 90010112345';
            const service = new EnterpriseSecurityService();
            
            const hasPII = service.detectPII(text);
            
            expect(hasPII.length).toBeGreaterThan(0);
        });

        it('should return empty array for clean text', () => {
            const text = 'This is a generic business document about strategy.';
            const service = new EnterpriseSecurityService();
            
            const hasPII = service.detectPII(text);
            
            expect(hasPII).toEqual([]);
        });
    });

    describe('PII Sanitization', () => {
        it('should redact email addresses', () => {
            const text = 'Contact john.doe@example.com for details';
            const service = new EnterpriseSecurityService();
            
            const sanitized = service.sanitizePII(text);
            
            expect(sanitized).not.toContain('john.doe@example.com');
            expect(sanitized).toContain('[EMAIL_REDACTED]');
        });

        it('should redact multiple PII types', () => {
            const text = 'Email: test@test.com, Phone: 123-456-7890';
            const service = new EnterpriseSecurityService();
            
            const sanitized = service.sanitizePII(text);
            
            expect(sanitized).not.toContain('test@test.com');
            expect(sanitized).not.toContain('123-456-7890');
        });
    });

    describe('Risk Assessment', () => {
        it('should assess low risk for normal requests', () => {
            const service = new EnterpriseSecurityService();
            
            const risk = service.assessRisk({
                content: 'Help me improve our project management processes',
                capability: 'recommendation'
            });
            
            expect(risk.level).toBe('LOW');
            expect(risk.score).toBeLessThan(50);
        });

        it('should assess high risk for sensitive operations', () => {
            const service = new EnterpriseSecurityService();
            
            const risk = service.assessRisk({
                content: 'Execute database query with admin credentials',
                capability: 'tool_use',
                containsPII: true
            });
            
            expect(risk.level).toBe('HIGH');
            expect(risk.score).toBeGreaterThan(70);
        });

        it('should assess medium risk for PII-containing requests', () => {
            const service = new EnterpriseSecurityService();
            
            const risk = service.assessRisk({
                content: 'Send report to john@example.com',
                capability: 'report',
                containsPII: true
            });
            
            expect(['MEDIUM', 'HIGH']).toContain(risk.level);
        });
    });

    describe('Rate Limiting', () => {
        it('should allow requests within limit', async () => {
            const result = await enterpriseSecurity.checkRateLimit('test-org-1', 'chat');
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('allowed');
        });

        it('should track request counts', async () => {
            const orgId = 'test-org-rate-' + Date.now();
            
            // First request should be allowed
            const first = await enterpriseSecurity.checkRateLimit(orgId, 'chat');
            expect(first.allowed).toBe(true);
            
            // Remaining should be less than initial limit
            expect(first.remaining).toBeLessThanOrEqual(first.limit);
        });
    });

    describe('Audit Logging', () => {
        it('should create audit log entry', async () => {
            const logEntry = {
                userId: 'test-user',
                organizationId: 'test-org',
                action: 'ai_request',
                resourceType: 'chat',
                requestSummary: 'Test request',
                responseSummary: 'Test response'
            };

            // Should not throw
            await expect(
                enterpriseSecurity.logAudit(logEntry)
            ).resolves.not.toThrow();
        });

        it('should handle missing optional fields', async () => {
            const logEntry = {
                userId: 'test-user',
                organizationId: 'test-org',
                action: 'ai_request'
            };

            await expect(
                enterpriseSecurity.logAudit(logEntry)
            ).resolves.not.toThrow();
        });
    });

    describe('Organization Settings', () => {
        it('should return default settings for new organizations', async () => {
            const settings = await enterpriseSecurity.getOrganizationSettings('new-org-' + Date.now());
            
            expect(settings).toBeDefined();
            expect(settings).toHaveProperty('enabled_features');
            expect(settings).toHaveProperty('disabled_models');
        });
    });
});









