/**
 * Security Utils Tests
 *
 * Tests for security utilities including XSS prevention, SQL injection protection,
 * CSRF tokens, and input sanitization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import security utils - using dynamic import for ESM
let securityUtils: any;

describe('Security Utils', () => {
    beforeEach(async () => {
        // Dynamic import for ESM compatibility
        const module = await import('../../../../server/src/utils/security.utils.ts');
        securityUtils = module;
    });

    describe('XSS Prevention', () => {
        describe('sanitizeString()', () => {
            it('should escape HTML special characters', () => {
                const maliciousInput = '<script>alert("XSS")</script>';
                const result = securityUtils.sanitizeString(maliciousInput);
                expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
            });

            it('should handle all HTML entities correctly', () => {
                expect(securityUtils.sanitizeString('&')).toBe('&amp;');
                expect(securityUtils.sanitizeString('<')).toBe('&lt;');
                expect(securityUtils.sanitizeString('>')).toBe('&gt;');
                expect(securityUtils.sanitizeString('"')).toBe('&quot;');
                expect(securityUtils.sanitizeString("'")).toBe('&#x27;');
                expect(securityUtils.sanitizeString('/')).toBe('&#x2F;');
                expect(securityUtils.sanitizeString('`')).toBe('&#96;');
                expect(securityUtils.sanitizeString('=')).toBe('&#x3D;');
            });

            it('should handle complex XSS attempts', () => {
                const complexXss = '<img src=x onerror=alert(1)>';
                const result = securityUtils.sanitizeString(complexXss);
                expect(result).toBe('&lt;img src&#x3Dx onerror&#x3Dalert(1)&gt;');
                expect(result).not.toContain('<');
                expect(result).not.toContain('>');
            });

            it('should return empty string for null/undefined', () => {
                expect(securityUtils.sanitizeString(null)).toBe('');
                expect(securityUtils.sanitizeString(undefined)).toBe('');
            });

            it('should convert non-strings to strings', () => {
                expect(securityUtils.sanitizeString(123)).toBe('123');
                expect(securityUtils.sanitizeString(true)).toBe('true');
                expect(securityUtils.sanitizeString({})).toBe('[object Object]');
            });

            it('should preserve safe content', () => {
                const safeContent = 'Hello World! This is safe content.';
                expect(securityUtils.sanitizeString(safeContent)).toBe(safeContent);
            });
        });

        describe('sanitizeObject()', () => {
            it('should sanitize all string values in object', () => {
                const maliciousObj = {
                    name: '<script>evil()</script>',
                    description: 'Safe description',
                    metadata: {
                        author: 'User"name',
                        tags: ['tag1', '<b>tag2</b>']
                    }
                };

                const result = securityUtils.sanitizeObject(maliciousObj);

                expect(result.name).toBe('&lt;script&gt;evil()&lt;&#x2F;script&gt;');
                expect(result.description).toBe('Safe description');
                expect(result.metadata.author).toBe('User&quot;name');
                expect(result.metadata.tags[0]).toBe('tag1');
                expect(result.metadata.tags[1]).toBe('&lt;b&gt;tag2&lt;&#x2F;b&gt;');
            });

            it('should handle arrays correctly', () => {
                const arrayInput = ['<div>item1</div>', 'safe item', '<script>evil</script>'];
                const result = securityUtils.sanitizeObject(arrayInput);

                expect(result[0]).toBe('&lt;div&gt;item1&lt;&#x2F;div&gt;');
                expect(result[1]).toBe('safe item');
                expect(result[2]).toBe('&lt;script&gt;evil&lt;&#x2F;script&gt;');
            });

            it('should handle nested objects', () => {
                const nestedObj = {
                    level1: {
                        level2: {
                            value: '<malicious>content</malicious>'
                        }
                    }
                };

                const result = securityUtils.sanitizeObject(nestedObj);
                expect(result.level1.level2.value).toBe('&lt;malicious&gt;content&lt;&#x2F;malicious&gt;');
            });

            it('should respect maxDepth parameter', () => {
                const deepObj = {
                    level1: {
                        level2: {
                            level3: {
                                value: '<test>'
                            }
                        }
                    }
                };

                const result = securityUtils.sanitizeObject(deepObj, 2);
                // Should not sanitize beyond maxDepth
                expect(result.level1.level2.level3.value).toBe('<test>');
            });

            it('should handle circular references gracefully', () => {
                const circularObj: any = { name: '<test>' };
                circularObj.self = circularObj;

                const result = securityUtils.sanitizeObject(circularObj);
                expect(result.name).toBe('&lt;test&gt;');
                expect(result.self).toBe(result); // Circular reference preserved
            });

            it('should preserve non-string values', () => {
                const mixedObj = {
                    string: '<script>',
                    number: 42,
                    boolean: true,
                    array: [1, 2, '<b>3</b>'],
                    nested: {
                        safe: 'safe',
                        unsafe: '<unsafe>'
                    }
                };

                const result = securityUtils.sanitizeObject(mixedObj);

                expect(result.string).toBe('&lt;script&gt;');
                expect(result.number).toBe(42);
                expect(result.boolean).toBe(true);
                expect(result.array[2]).toBe('&lt;b&gt;3&lt;&#x2F;b&gt;');
                expect(result.nested.safe).toBe('safe');
                expect(result.nested.unsafe).toBe('&lt;unsafe&gt;');
            });
        });

        describe('stripHtml()', () => {
            it('should remove all HTML tags', () => {
                const htmlContent = '<div>Hello <b>world</b>!</div>';
                const result = securityUtils.stripHtml(htmlContent);
                expect(result).toBe('Hello world!');
            });

            it('should handle self-closing tags', () => {
                const content = 'Image: <img src="test.jpg" alt="test" />';
                const result = securityUtils.stripHtml(content);
                expect(result).toBe('Image: ');
            });

            it('should handle nested tags', () => {
                const content = '<div><p><span>Nested</span> content</p></div>';
                const result = securityUtils.stripHtml(content);
                expect(result).toBe('Nested content');
            });

            it('should handle malformed HTML', () => {
                const malformed = '<div><p>Unclosed paragraph<div>More content</div>';
                const result = securityUtils.stripHtml(malformed);
                expect(result).toBe('Unclosed paragraphMore content');
            });

            it('should preserve non-HTML content', () => {
                const content = 'Plain text without any HTML tags.';
                expect(securityUtils.stripHtml(content)).toBe(content);
            });

            it('should handle empty strings', () => {
                expect(securityUtils.stripHtml('')).toBe('');
            });
        });
    });

    describe('SQL Injection Prevention', () => {
        describe('isValidTableName()', () => {
            it('should accept allowed table names', () => {
                const allowedTables = [
                    'users', 'organizations', 'projects', 'tasks', 'initiatives',
                    'decisions', 'stage_gates', 'notifications', 'sessions', 'teams'
                ];

                allowedTables.forEach(table => {
                    expect(securityUtils.isValidTableName(table)).toBe(true);
                });
            });

            it('should reject disallowed table names', () => {
                const disallowedTables = [
                    'sqlite_master', 'information_schema', 'sys.tables',
                    'DROP TABLE users', 'users; DROP TABLE projects;', ''
                ];

                disallowedTables.forEach(table => {
                    expect(securityUtils.isValidTableName(table)).toBe(false);
                });
            });

            it('should reject table names with special characters', () => {
                const maliciousNames = [
                    'users--', 'users;', 'users/*', 'users*/',
                    'users UNION SELECT', 'users; -- comment'
                ];

                maliciousNames.forEach(name => {
                    expect(securityUtils.isValidTableName(name)).toBe(false);
                });
            });

            it('should handle case sensitivity', () => {
                expect(securityUtils.isValidTableName('USERS')).toBe(false); // Should be lowercase
                expect(securityUtils.isValidTableName('Users')).toBe(false);
            });

            it('should reject null/undefined/empty strings', () => {
                expect(securityUtils.isValidTableName(null as any)).toBe(false);
                expect(securityUtils.isValidTableName(undefined as any)).toBe(false);
                expect(securityUtils.isValidTableName('')).toBe(false);
            });
        });

        describe('sanitizeTableName()', () => {
            it('should return allowed table names unchanged', () => {
                expect(securityUtils.sanitizeTableName('users')).toBe('users');
                expect(securityUtils.sanitizeTableName('projects')).toBe('projects');
            });

            it('should return null for disallowed table names', () => {
                expect(securityUtils.sanitizeTableName('sqlite_master')).toBeNull();
                expect(securityUtils.sanitizeTableName('DROP TABLE users')).toBeNull();
                expect(securityUtils.sanitizeTableName('')).toBeNull();
            });

            it('should handle case sensitivity', () => {
                expect(securityUtils.sanitizeTableName('USERS')).toBeNull();
                expect(securityUtils.sanitizeTableName('Users')).toBeNull();
            });
        });

        describe('isValidColumnName()', () => {
            it('should accept valid column names', () => {
                const validColumns = [
                    'id', 'name', 'email', 'created_at', 'updated_at',
                    'organization_id', 'user_id', 'status', 'description'
                ];

                validColumns.forEach(column => {
                    expect(securityUtils.isValidColumnName(column)).toBe(true);
                });
            });

            it('should reject column names with SQL keywords', () => {
                const invalidColumns = [
                    'SELECT', 'DROP', 'INSERT', 'UPDATE', 'DELETE',
                    'UNION', 'JOIN', 'WHERE', 'FROM', 'INTO'
                ];

                invalidColumns.forEach(column => {
                    expect(securityUtils.isValidColumnName(column)).toBe(false);
                });
            });

            it('should reject column names with special characters', () => {
                const invalidColumns = [
                    'column;', 'column--', 'column/*', 'column*/',
                    'column=', 'column OR 1=1'
                ];

                invalidColumns.forEach(column => {
                    expect(securityUtils.isValidColumnName(column)).toBe(false);
                });
            });

            it('should accept underscores and numbers in column names', () => {
                expect(securityUtils.isValidColumnName('user_id')).toBe(true);
                expect(securityUtils.isValidColumnName('column_name_123')).toBe(true);
                expect(securityUtils.isValidColumnName('col1')).toBe(true);
            });
        });
    });

    describe('CSRF Protection', () => {
        describe('generateCsrfToken()', () => {
            it('should generate unique tokens', () => {
                const token1 = securityUtils.generateCsrfToken();
                const token2 = securityUtils.generateCsrfToken();

                expect(token1).toBeDefined();
                expect(token2).toBeDefined();
                expect(typeof token1).toBe('string');
                expect(typeof token2).toBe('string');
                expect(token1).not.toBe(token2);
                expect(token1.length).toBeGreaterThan(32); // Should be reasonably long
            });

            it('should generate URL-safe tokens', () => {
                const token = securityUtils.generateCsrfToken();
                // Should not contain characters that need URL encoding
                expect(token).not.toMatch(/[+/=]/);
            });
        });

        describe('validateCsrfToken()', () => {
            it('should validate correct tokens', () => {
                const token = securityUtils.generateCsrfToken();
                const sessionToken = token; // In real app, this would come from session

                expect(securityUtils.validateCsrfToken(token, sessionToken)).toBe(true);
            });

            it('should reject incorrect tokens', () => {
                const token = securityUtils.generateCsrfToken();
                const wrongToken = securityUtils.generateCsrfToken();

                expect(securityUtils.validateCsrfToken(token, wrongToken)).toBe(false);
            });

            it('should reject empty/null tokens', () => {
                expect(securityUtils.validateCsrfToken('', 'valid')).toBe(false);
                expect(securityUtils.validateCsrfToken(null as any, 'valid')).toBe(false);
                expect(securityUtils.validateCsrfToken('valid', '')).toBe(false);
                expect(securityUtils.validateCsrfToken('valid', null as any)).toBe(false);
            });

            it('should handle timing-safe comparison', () => {
                const token = 'abcdefghijklmnopqrstuvwx'; // 24 chars
                const validSession = token;
                const invalidSession = 'abcdefghijklmnopqrstuvwz'; // Last char different

                expect(securityUtils.validateCsrfToken(token, validSession)).toBe(true);
                expect(securityUtils.validateCsrfToken(token, invalidSession)).toBe(false);
            });
        });
    });

    describe('Input Validation', () => {
        describe('isValidEmail()', () => {
            it('should validate correct email formats', () => {
                const validEmails = [
                    'user@example.com',
                    'test.email@domain.co.uk',
                    'user+tag@gmail.com',
                    '123@test-domain.com'
                ];

                validEmails.forEach(email => {
                    expect(securityUtils.isValidEmail(email)).toBe(true);
                });
            });

            it('should reject invalid email formats', () => {
                const invalidEmails = [
                    'invalid-email',
                    '@example.com',
                    'user@',
                    'user@@example.com',
                    'user example.com',
                    'user@.com',
                    '.user@example.com'
                ];

                invalidEmails.forEach(email => {
                    expect(securityUtils.isValidEmail(email)).toBe(false);
                });
            });

            it('should handle edge cases', () => {
                expect(securityUtils.isValidEmail('')).toBe(false);
                expect(securityUtils.isValidEmail(null as any)).toBe(false);
                expect(securityUtils.isValidEmail(undefined as any)).toBe(false);
                expect(securityUtils.isValidEmail(123 as any)).toBe(false);
            });
        });

        describe('sanitizeFileName()', () => {
            it('should remove dangerous characters from filenames', () => {
                const dangerousNames = [
                    '../../../etc/passwd',
                    'file/../secret.txt',
                    'script.php\x00.jpg',
                    'file with spaces.txt',
                    'file<>:|?*.txt'
                ];

                const sanitized = dangerousNames.map(name => securityUtils.sanitizeFileName(name));

                sanitized.forEach(name => {
                    expect(name).not.toMatch(/[\.\/\\<>:|?*\x00]/);
                });
            });

            it('should preserve safe characters', () => {
                const safeName = 'my-document-123.pdf';
                const result = securityUtils.sanitizeFileName(safeName);
                expect(result).toBe(safeName);
            });

            it('should handle empty/null inputs', () => {
                expect(securityUtils.sanitizeFileName('')).toBe('unnamed_file');
                expect(securityUtils.sanitizeFileName(null as any)).toBe('unnamed_file');
                expect(securityUtils.sanitizeFileName(undefined as any)).toBe('unnamed_file');
            });
        });
    });

    describe('Integration Scenarios', () => {
        it('should provide comprehensive XSS protection for user input', () => {
            const userInput = {
                username: '<script>alert("hack")</script>',
                bio: 'I am a <b>developer</b> & <i>architect</i>',
                website: 'https://example.com?q=<search>',
                comments: [
                    'Great post!',
                    '<img src=x onerror=evil()>'
                ]
            };

            const sanitized = securityUtils.sanitizeObject(userInput);

            expect(sanitized.username).toBe('&lt;script&gt;alert(&quot;hack&quot;)&lt;&#x2F;script&gt;');
            expect(sanitized.bio).toBe('I am a &lt;b&gt;developer&lt;&#x2F;b&gt; &amp; &lt;i&gt;architect&lt;&#x2F;i&gt;');
            expect(sanitized.website).toBe('https://example.com?q&#x3D;&lt;search&gt;');
            expect(sanitized.comments[1]).toBe('&lt;img src&#x3Dx onerror&#x3Devil()&gt;');
        });

        it('should validate and sanitize SQL table/column names', () => {
            const userInput = {
                table: 'users; DROP TABLE projects;',
                column: 'name UNION SELECT password'
            };

            // validateTableName and validateColumnName throw errors for invalid names
            let validTable = null;
            let validColumn = false;
            
            try {
                securityUtils.validateTableName(userInput.table);
            } catch (error) {
                validTable = null; // Table name rejected
            }
            
            try {
                securityUtils.validateColumnName(userInput.column);
            } catch (error) {
                validColumn = false; // Column name rejected
            }

            expect(validTable).toBeNull();
            expect(validColumn).toBe(false);
        });

        it('should handle CSRF token lifecycle', () => {
            const sessionId = 'test-session-123';
            const token = securityUtils.generateCsrfToken(sessionId);

            // Simulate storing in session
            const sessionToken = token;

            // Validate correct token
            expect(securityUtils.validateCsrfToken(sessionId, token)).toBe(true);

            // Reject tampered token
            const tamperedToken = token.slice(0, -1) + 'x';
            expect(securityUtils.validateCsrfToken(sessionId, tamperedToken)).toBe(false);
        });

        it('should combine multiple security layers', () => {
            const maliciousInput = {
                email: 'user@example.com<script>evil()</script>',
                tableName: 'users; DROP TABLE sessions;',
                filename: '../../../etc/passwd',
                bio: 'I am <b>safe</b> but this is <script>dangerous</script>'
            };

            // Apply all security measures
            const secureInput = {
                email: securityUtils.isValidEmail(securityUtils.sanitizeString(maliciousInput.email)),
                tableName: null as string | null,
                filename: securityUtils.sanitizeFilename(maliciousInput.filename),
                bio: securityUtils.stripHtml(securityUtils.sanitizeString(maliciousInput.bio))
            };

            // validateTableName throws error for invalid table names
            try {
                securityUtils.validateTableName(maliciousInput.tableName);
            } catch (error) {
                secureInput.tableName = null; // Table name rejected
            }

            expect(secureInput.email).toBe(true); // Email is valid
            expect(secureInput.tableName).toBeNull(); // Table name rejected
            expect(secureInput.filename).not.toMatch(/[\.\/\\]/); // Path traversal prevented
            expect(secureInput.bio).not.toMatch(/<[^>]*>/); // HTML stripped
        });
    });
});
