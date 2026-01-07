/**
 * Input Sanitization Tests
 * Tests for XSS prevention and input cleaning
 * 
 * @module tests/security/input-sanitization.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// HTML sanitizer
const createHtmlSanitizer = (options = {}) => {
    const {
        allowedTags = ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'span'],
        allowedAttributes = { a: ['href', 'title'], '*': ['class'] },
        allowedProtocols = ['http', 'https', 'mailto'],
    } = options;

    const escapeHtml = (str) => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    };

    const isValidProtocol = (url) => {
        try {
            const parsed = new URL(url);
            return allowedProtocols.includes(parsed.protocol.replace(':', ''));
        } catch {
            return url.startsWith('#') || url.startsWith('/');
        }
    };

    return {
        sanitize: (html) => {
            // Remove script tags and event handlers
            let clean = html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/on\w+\s*=\s*(['"])[^'"]*\1/gi, '')
                .replace(/javascript:/gi, '');

            // Remove dangerous tags
            const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'];
            for (const tag of dangerousTags) {
                const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis');
                clean = clean.replace(regex, '');
                clean = clean.replace(new RegExp(`<${tag}[^>]*>`, 'gi'), '');
            }

            return clean;
        },

        escape: escapeHtml,

        stripTags: (html) => {
            return html.replace(/<[^>]*>/g, '');
        },

        sanitizeUrl: (url) => {
            if (!url) return '';
            const clean = url.replace(/javascript:/gi, '').replace(/data:/gi, '');
            return isValidProtocol(clean) ? clean : '';
        },
    };
};

// SQL injection prevention
const createSqlSanitizer = () => {
    return {
        escape: (value) => {
            if (value === null || value === undefined) return 'NULL';
            if (typeof value === 'number') return String(value);
            if (typeof value === 'boolean') return value ? '1' : '0';

            return `'${String(value)
                .replace(/'/g, "''")
                .replace(/\\/g, '\\\\')
                .replace(/\x00/g, '\\0')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\x1a/g, '\\Z')}'`;
        },

        escapeIdentifier: (identifier) => {
            return `"${identifier.replace(/"/g, '""')}"`;
        },

        detectInjection: (input) => {
            const patterns = [
                /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
                /--/,
                /;.*$/,
                /\/\*.*\*\//,
                /'\s*OR\s*'1'\s*=\s*'1/i,
                /'\s*OR\s+1\s*=\s*1/i,
            ];

            for (const pattern of patterns) {
                if (pattern.test(input)) {
                    return { detected: true, pattern: pattern.toString() };
                }
            }

            return { detected: false };
        },
    };
};

// Input validator
const createInputValidator = () => {
    return {
        isAlphanumeric: (str) => /^[a-zA-Z0-9]+$/.test(str),

        isAlpha: (str) => /^[a-zA-Z]+$/.test(str),

        isNumeric: (str) => /^[0-9]+$/.test(str),

        isEmail: (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str),

        isUrl: (str) => {
            try { new URL(str); return true; } catch { return false; }
        },

        isUuid: (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),

        isPhone: (str) => /^\+?[1-9]\d{6,14}$/.test(str.replace(/[\s\-\(\)]/g, '')),

        isSlug: (str) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(str),

        isHex: (str) => /^[0-9a-fA-F]+$/.test(str),

        isBase64: (str) => /^[A-Za-z0-9+/]+=*$/.test(str),

        isSafeFilename: (str) => {
            const dangerous = /[<>:"/\\|?*\x00-\x1f]/;
            const reserved = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
            return !dangerous.test(str) && !reserved.test(str) && str.length > 0;
        },

        normalize: (str) => {
            return str
                .trim()
                .normalize('NFC')
                .replace(/\s+/g, ' ');
        },
    };
};

// Path traversal prevention
const createPathSanitizer = () => {
    return {
        sanitize: (path) => {
            return path
                .replace(/\.\./g, '')
                .replace(/\/+/g, '/')
                .replace(/^\//, '')
                .replace(/\0/g, '');
        },

        isWithinBase: (path, basePath) => {
            const resolvedPath = this.sanitize(path);
            return !resolvedPath.includes('..') &&
                !resolvedPath.startsWith('/') &&
                !resolvedPath.includes('\0');
        },

        getExtension: (filename) => {
            const parts = filename.split('.');
            if (parts.length < 2) return '';
            return parts.pop().toLowerCase();
        },

        isAllowedExtension: (filename, allowed) => {
            const ext = this.getExtension(filename);
            return allowed.includes(ext);
        },
    };
};

describe('HTML Sanitizer Tests', () => {
    let sanitizer;

    beforeEach(() => {
        sanitizer = createHtmlSanitizer();
    });

    it('should remove script tags', () => {
        const dirty = '<p>Hello</p><script>alert("xss")</script>';
        const clean = sanitizer.sanitize(dirty);

        expect(clean).not.toContain('script');
        expect(clean).toContain('<p>Hello</p>');
    });

    it('should remove event handlers', () => {
        const dirty = '<img onerror="alert(1)" src="x">';
        const clean = sanitizer.sanitize(dirty);

        expect(clean).not.toContain('onerror');
    });

    it('should escape HTML', () => {
        expect(sanitizer.escape('<script>')).toBe('&lt;script&gt;');
    });

    it('should strip all tags', () => {
        expect(sanitizer.stripTags('<p>Hello <b>World</b></p>')).toBe('Hello World');
    });

    it('should sanitize URLs', () => {
        expect(sanitizer.sanitizeUrl('javascript:alert(1)')).toBe('');
        expect(sanitizer.sanitizeUrl('https://example.com')).toBe('https://example.com');
    });
});

describe('SQL Sanitizer Tests', () => {
    let sql;

    beforeEach(() => {
        sql = createSqlSanitizer();
    });

    it('should escape strings', () => {
        expect(sql.escape("O'Brien")).toBe("'O''Brien'");
    });

    it('should handle null', () => {
        expect(sql.escape(null)).toBe('NULL');
    });

    it('should handle numbers', () => {
        expect(sql.escape(42)).toBe('42');
    });

    it('should detect injection', () => {
        expect(sql.detectInjection("' OR '1'='1").detected).toBe(true);
        expect(sql.detectInjection("Robert'); DROP TABLE users;--").detected).toBe(true);
        expect(sql.detectInjection('John Smith').detected).toBe(false);
    });

    it('should escape identifiers', () => {
        expect(sql.escapeIdentifier('user"name')).toBe('"user""name"');
    });
});

describe('Input Validator Tests', () => {
    let validator;

    beforeEach(() => {
        validator = createInputValidator();
    });

    it('should validate alphanumeric', () => {
        expect(validator.isAlphanumeric('abc123')).toBe(true);
        expect(validator.isAlphanumeric('abc 123')).toBe(false);
    });

    it('should validate email', () => {
        expect(validator.isEmail('test@example.com')).toBe(true);
        expect(validator.isEmail('invalid')).toBe(false);
    });

    it('should validate UUID', () => {
        expect(validator.isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(validator.isUuid('invalid-uuid')).toBe(false);
    });

    it('should validate slug', () => {
        expect(validator.isSlug('hello-world')).toBe(true);
        expect(validator.isSlug('Hello World')).toBe(false);
    });

    it('should check safe filename', () => {
        expect(validator.isSafeFilename('document.pdf')).toBe(true);
        expect(validator.isSafeFilename('../secret.txt')).toBe(false);
        expect(validator.isSafeFilename('CON')).toBe(false);
    });
});

describe('Path Sanitizer Tests', () => {
    let path;

    beforeEach(() => {
        path = createPathSanitizer();
    });

    it('should remove traversal', () => {
        expect(path.sanitize('../../../etc/passwd')).toBe('etc/passwd');
    });

    it('should normalize slashes', () => {
        expect(path.sanitize('path//to///file')).toBe('path/to/file');
    });

    it('should get extension', () => {
        expect(path.getExtension('file.PDF')).toBe('pdf');
    });

    it('should check allowed extensions', () => {
        expect(path.isAllowedExtension('image.jpg', ['jpg', 'png'])).toBe(true);
        expect(path.isAllowedExtension('script.js', ['jpg', 'png'])).toBe(false);
    });
});
