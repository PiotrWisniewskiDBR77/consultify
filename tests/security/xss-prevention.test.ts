/**
 * XSS (Cross-Site Scripting) Prevention Tests
 * 
 * Tests for DOM-based, stored, and reflected XSS attack vectors
 * @see OWASP XSS Prevention Cheat Sheet
 */
import { describe, it, expect, vi } from 'vitest';

describe('XSS Prevention', () => {
    describe('DOM-based XSS Prevention', () => {
        it('should escape HTML entities in user input', () => {
            const escapeHtml = (unsafe: string): string => {
                return unsafe
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            };

            const maliciousInputs = [
                { input: '<script>alert("XSS")</script>', expected: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;' },
                { input: '<img src=x onerror=alert(1)>', expected: '&lt;img src=x onerror=alert(1)&gt;' },
                { input: '"><script>document.cookie</script>', expected: '&quot;&gt;&lt;script&gt;document.cookie&lt;/script&gt;' },
                { input: "javascript:alert('XSS')", expected: "javascript:alert(&#039;XSS&#039;)" },
                { input: '<svg onload=alert(1)>', expected: '&lt;svg onload=alert(1)&gt;' }
            ];

            for (const { input, expected } of maliciousInputs) {
                expect(escapeHtml(input)).toBe(expected);
            }
        });

        it('should sanitize URLs to prevent javascript: protocol', () => {
            const sanitizeUrl = (url: string): string => {
                const dangerous = /^(javascript|vbscript|data):/i;
                if (dangerous.test(url.trim())) {
                    return '#';
                }
                return url;
            };

            expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
            expect(sanitizeUrl('  javascript:alert(1)')).toBe('#');
            expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
            expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('#');
            expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
            expect(sanitizeUrl('/relative/path')).toBe('/relative/path');
        });

        it('should remove event handlers from HTML attributes', () => {
            const removeEventHandlers = (html: string): string => {
                // Remove all on* event handlers
                return html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
            };

            expect(removeEventHandlers('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
            expect(removeEventHandlers('<div onclick="steal()" onmouseover="track()">')).toBe('<div>');
            expect(removeEventHandlers('<a href="#" onfocus="alert(document.cookie)">')).toBe('<a href="#">');
        });
    });

    describe('Stored XSS Prevention', () => {
        it('should sanitize content before storing in database', () => {
            const sanitizeForStorage = (content: string): string => {
                // Strip all HTML tags
                const withoutTags = content.replace(/<[^>]*>/g, '');
                // Encode special characters
                return withoutTags
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            };

            expect(sanitizeForStorage('<script>evil()</script>Hello')).toBe('evil()Hello');
            expect(sanitizeForStorage('Normal text')).toBe('Normal text');
            expect(sanitizeForStorage('<b>Bold</b> text')).toBe('Bold text');
        });

        it('should use allowlist for permitted HTML tags', () => {
            const allowedTags = ['b', 'i', 'u', 'p', 'br', 'ul', 'ol', 'li', 'a'];

            const sanitizeWithAllowlist = (html: string): string => {
                // First remove content between disallowed tags, then remove the tags
                const result = html.replace(/<script[^>]*>.*?<\/script>/gi, '');
                const tagPattern = /<\/?([a-z]+)[^>]*>/gi;
                return result.replace(tagPattern, (match, tagName) => {
                    return allowedTags.includes(tagName.toLowerCase()) ? match : '';
                });
            };

            expect(sanitizeWithAllowlist('<b>bold</b><script>evil()</script>')).toBe('<b>bold</b>');
            expect(sanitizeWithAllowlist('<div>blocked</div><p>allowed</p>')).toBe('blocked<p>allowed</p>');
            expect(sanitizeWithAllowlist('<a href="link">text</a>')).toBe('<a href="link">text</a>');
        });

        it('should validate and sanitize href attributes in allowed links', () => {
            const sanitizeLinkHref = (href: string): string => {
                // Only allow http, https, mailto, and relative paths
                const allowed = /^(https?:\/\/|mailto:|\/|#)/i;
                if (!allowed.test(href.trim())) {
                    return '#';
                }
                // Encode special characters
                return encodeURI(href);
            };

            expect(sanitizeLinkHref('https://example.com')).toBe('https://example.com');
            expect(sanitizeLinkHref('mailto:test@example.com')).toBe('mailto:test@example.com');
            expect(sanitizeLinkHref('/relative/path')).toBe('/relative/path');
            expect(sanitizeLinkHref('javascript:alert(1)')).toBe('#');
            expect(sanitizeLinkHref('data:text/html,<script>')).toBe('#');
        });
    });

    describe('Reflected XSS Prevention', () => {
        it('should encode URL parameters before reflecting in response', () => {
            const encodeForUrl = (value: string): string => {
                return encodeURIComponent(value);
            };

            expect(encodeForUrl('<script>alert(1)</script>')).toBe('%3Cscript%3Ealert(1)%3C%2Fscript%3E');
            expect(encodeForUrl('" onclick="evil()"')).toBe('%22%20onclick%3D%22evil()%22');
            // Note: encodeURIComponent encodes single quotes as %27
            const encoded = encodeForUrl("' onmouseover='bad()'");
            expect(encoded).toContain('onmouseover');
        });

        it('should sanitize search query display', () => {
            const displaySearchQuery = (query: string): string => {
                // For displaying "You searched for: X"
                return query
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .slice(0, 100); // Limit length
            };

            const result = displaySearchQuery('<script>alert("XSS")</script>');
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        it('should validate Content-Type header for JSON responses', () => {
            const validateJsonContentType = (contentType: string): boolean => {
                return contentType.includes('application/json');
            };

            expect(validateJsonContentType('application/json')).toBe(true);
            expect(validateJsonContentType('application/json; charset=utf-8')).toBe(true);
            expect(validateJsonContentType('text/html')).toBe(false); // Can be used for XSS
        });
    });

    describe('CSP (Content Security Policy) Headers', () => {
        it('should generate valid CSP header string', () => {
            const generateCSP = (config: Record<string, string[]>): string => {
                return Object.entries(config)
                    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
                    .join('; ');
            };

            const cspConfig = {
                'default-src': ["'self'"],
                'script-src': ["'self'", "'unsafe-inline'"],
                'style-src': ["'self'", "'unsafe-inline'"],
                'img-src': ["'self'", 'data:', 'https:'],
                'connect-src': ["'self'", 'https://api.example.com'],
                'frame-ancestors': ["'none'"]
            };

            const csp = generateCSP(cspConfig);

            expect(csp).toContain("default-src 'self'");
            expect(csp).toContain("script-src 'self' 'unsafe-inline'");
            expect(csp).toContain("frame-ancestors 'none'");
        });

        it('should include nonce for inline scripts when strict CSP is enabled', () => {
            const generateNonce = (): string => {
                // In real implementation, use crypto.randomBytes
                return 'R4nd0mN0nc3V4lu3';
            };

            const cspWithNonce = (nonce: string): string => {
                return `script-src 'self' 'nonce-${nonce}'`;
            };

            const nonce = generateNonce();
            const csp = cspWithNonce(nonce);

            expect(csp).toContain(`'nonce-${nonce}'`);
            expect(csp).not.toContain("'unsafe-inline'");
        });
    });

    describe('Template Injection Prevention', () => {
        it('should escape template syntax in user input', () => {
            const escapeTemplateChars = (input: string): string => {
                // Escape common template delimiters
                return input
                    .replace(/\{\{/g, '&#123;&#123;')
                    .replace(/\}\}/g, '&#125;&#125;')
                    .replace(/\${/g, '&#36;{')
                    .replace(/<%/g, '&lt;%')
                    .replace(/%>/g, '%&gt;');
            };

            expect(escapeTemplateChars('{{constructor.constructor("alert(1)")()}}')).not.toContain('{{');
            expect(escapeTemplateChars('${process.env.SECRET}')).not.toContain('${');
            expect(escapeTemplateChars('<%= userInput %>')).not.toMatch(/<%.*%>/);
        });
    });
});
