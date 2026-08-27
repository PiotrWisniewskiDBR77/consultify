import { test, expect } from '@playwright/test';

test.describe('Security Flow Tests', () => {
    test.describe('Authentication Security', () => {
        test('should prevent brute force attacks with rate limiting', async ({ page }) => {
            await page.goto('/');

            // Attempt multiple failed logins
            for (let i = 0; i < 5; i++) {
                // Click "Log In" on Welcome Page
                await page.click('text=Log In');

                // Fill login form with bad data
                await page.fill('input[type="email"]', `attack${i}@example.com`);
                await page.fill('input[type="password"]', 'wrongpass');

                // Submit
                await page.click('button[type="submit"]');

                // Wait for error message
                await expect(page.locator('text=Invalid credentials')).toBeVisible();

                // Navigate back to login
                await page.goto('/');
            }

            // Should be rate limited on next attempt
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'attack5@example.com');
            await page.fill('input[type="password"]', 'wrongpass');
            await page.click('button[type="submit"]');

            // Should show rate limit message
            await expect(page.locator('text=Too many login attempts')).toBeVisible();
        });

        test('should enforce password complexity requirements', async ({ page }) => {
            await page.goto('/settings');

            // Navigate to password change section
            await page.click('text=Security');

            // Try weak password
            await page.fill('input[name="currentPassword"]', 'currentpass123');
            await page.fill('input[name="newPassword"]', 'weak');
            await page.fill('input[name="confirmPassword"]', 'weak');

            await page.click('button:has-text("Update Password")');

            // Should show password complexity error
            await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible();
            await expect(page.locator('text=Password must contain uppercase letter')).toBeVisible();
            await expect(page.locator('text=Password must contain number')).toBeVisible();
        });

        test('should log out user on suspicious activity', async ({ page }) => {
            // Login first
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await expect(page.locator('h1:has-text("System Overview")')).toBeVisible();

            // Simulate suspicious activity (rapid page navigation)
            const pages = ['/projects', '/initiatives', '/assessments', '/reports'];
            for (const pagePath of pages) {
                await page.goto(pagePath);
            }

            // Should be logged out due to security policy
            await expect(page.locator('text=Session expired for security reasons')).toBeVisible();
        });

        test('should handle session timeout securely', async ({ page }) => {
            // Login
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await expect(page.locator('h1:has-text("System Overview")')).toBeVisible();

            // Wait for session timeout (simulate by clearing session storage)
            await page.evaluate(() => {
                localStorage.clear();
                sessionStorage.clear();
            });

            // Try to access protected page
            await page.goto('/projects');

            // Should redirect to login
            await expect(page.locator('text=Log In')).toBeVisible();
        });
    });

    test.describe('Data Protection', () => {
        test('should encrypt sensitive data in transit', async ({ page }) => {
            // Monitor network requests
            const requests: any[] = [];

            page.on('request', (request) => {
                requests.push({
                    url: request.url(),
                    method: request.method(),
                    headers: request.headers()
                });
            });

            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            // Check that login request uses HTTPS
            const loginRequest = requests.find(r => r.url.includes('/api/auth/login'));
            expect(loginRequest).toBeDefined();
            expect(loginRequest.url.startsWith('https://')).toBe(true);
        });

        test('should prevent XSS attacks in user input', async ({ page }) => {
            // Login first
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/initiatives');

            // Try to create initiative with XSS payload
            await page.click('button:has-text("New Initiative")');
            await page.fill('input[name="name"]', '<script>alert("XSS")</script>Test Initiative');
            await page.fill('textarea[name="description"]', '<img src=x onerror=alert("XSS")>');
            await page.click('button:has-text("Create")');

            // Navigate to initiatives list
            await page.goto('/initiatives');

            // Should not execute JavaScript
            const alerts = page.locator('.alert, .notification');
            await expect(alerts).not.toContainText('<script>');
            await expect(alerts).not.toContainText('onerror');
        });

        test('should validate file uploads for security', async ({ page }) => {
            // Login first
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/documents');

            // Try to upload malicious file
            const fileInput = page.locator('input[type="file"]');
            await fileInput.setInputFiles({
                name: 'malicious.exe',
                mimeType: 'application/x-msdownload',
                buffer: Buffer.from('malicious content')
            });

            await page.click('button:has-text("Upload")');

            // Should reject malicious file
            await expect(page.locator('text=File type not allowed')).toBeVisible();
        });
    });

    test.describe('Access Control', () => {
        test('should enforce role-based access to admin features', async ({ page }) => {
            // Login as regular user
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            // Try to access admin-only pages
            const adminPages = ['/admin/users', '/admin/organizations', '/admin/system'];

            for (const adminPage of adminPages) {
                await page.goto(adminPage);
                await expect(page.locator('text=Access Denied')).toBeVisible();
                await expect(page.locator('text=Insufficient permissions')).toBeVisible();
            }
        });

        test('should prevent unauthorized API access', async ({ page }) => {
            // Try to access protected API endpoints without authentication
            const protectedEndpoints = [
                '/api/projects',
                '/api/initiatives',
                '/api/assessments',
                '/api/admin/users'
            ];

            for (const endpoint of protectedEndpoints) {
                const response = await page.request.get(endpoint);
                expect(response.status()).toBe(401);
            }
        });

        test('should validate organization-level data isolation', async ({ page }) => {
            // Login to org A
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@orgA.com');
            await page.fill('input[type="password"]', 'password');
            await page.click('button[type="submit"]');

            // Create a project
            await page.goto('/projects');
            await page.click('button:has-text("New Project")');
            await page.fill('input[name="name"]', 'Org A Project');
            await page.click('button:has-text("Create")');

            // Verify project is visible
            await expect(page.locator('text=Org A Project')).toBeVisible();

            // Login to org B in new context
            const newPage = await page.context().newPage();
            await newPage.goto('/');
            await newPage.click('text=Log In');
            await newPage.fill('input[type="email"]', 'user@orgB.com');
            await newPage.fill('input[type="password"]', 'password');
            await newPage.click('button[type="submit"]');

            // Org B should not see Org A's project
            await newPage.goto('/projects');
            await expect(newPage.locator('text=Org A Project')).not.toBeVisible();
        });
    });

    test.describe('Audit Logging', () => {
        test('should log security events', async ({ page }) => {
            // Login
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            // Perform security-relevant action (password change)
            await page.goto('/settings');
            await page.click('text=Security');
            await page.fill('input[name="currentPassword"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.fill('input[name="newPassword"]', 'NewSecurePass123!');
            await page.fill('input[name="confirmPassword"]', 'NewSecurePass123!');
            await page.click('button:has-text("Update Password")');

            // Navigate to audit log
            await page.goto('/admin/audit');

            // Should show password change event
            await expect(page.locator('text=Password changed')).toBeVisible();
            await expect(page.locator('text=Security')).toBeVisible();
        });

        test('should track failed login attempts', async ({ page }) => {
            // Attempt failed login
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'wrong@example.com');
            await page.fill('input[type="password"]', 'wrongpass');
            await page.click('button[type="submit"]');

            // Login as admin
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            // Check audit log for failed login
            await page.goto('/admin/audit');
            await expect(page.locator('text=Failed login attempt')).toBeVisible();
            await expect(page.locator('text=wrong@example.com')).toBeVisible();
        });
    });

    test.describe('Security Headers', () => {
        test('should set proper security headers', async ({ page }) => {
            const response = await page.request.get('/');
            const headers = response.headers();

            // Check for security headers
            expect(headers['x-content-type-options']).toBe('nosniff');
            expect(headers['x-frame-options']).toBe('DENY');
            expect(headers['x-xss-protection']).toBe('1; mode=block');
            expect(headers['strict-transport-security']).toBeDefined();
            expect(headers['content-security-policy']).toBeDefined();
        });

        test('should prevent clickjacking attacks', async ({ page }) => {
            // Try to load page in iframe
            await page.setContent(`
                <iframe src="${page.url()}" width="800" height="600"></iframe>
            `);

            // Should not load due to X-Frame-Options
            const iframe = page.locator('iframe');
            await expect(iframe).toHaveAttribute('src', '');
        });
    });

    test.describe('Input Validation', () => {
        test('should validate email format', async ({ page }) => {
            await page.goto('/');

            // Try to register with invalid email
            await page.click('text=Sign Up');
            await page.fill('input[name="email"]', 'invalid-email');
            await page.fill('input[name="password"]', 'password123');
            await page.click('button[type="submit"]');

            await expect(page.locator('text=Invalid email format')).toBeVisible();
        });

        test('should prevent SQL injection attempts', async ({ page }) => {
            await page.goto('/projects');

            // Try SQL injection in search
            const searchInput = page.locator('input[placeholder*="Search"]');
            await searchInput.fill("'; DROP TABLE projects; --");
            await searchInput.press('Enter');

            // Should not crash or show error
            await expect(page.locator('text=Internal server error')).not.toBeVisible();
            await expect(page.locator('text=Database error')).not.toBeVisible();
        });

        test('should sanitize HTML in user content', async ({ page }) => {
            // Login first
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            // Create initiative with HTML content
            await page.goto('/initiatives');
            await page.click('button:has-text("New Initiative")');
            await page.fill('input[name="name"]', 'Test Initiative');
            await page.fill('textarea[name="description"]', '<b>Bold text</b> and <script>alert("xss")</script>');
            await page.click('button:has-text("Create")');

            // View initiative details
            await page.click('text=Test Initiative');

            // Should show sanitized HTML (bold text) but not execute script
            await expect(page.locator('b:has-text("Bold text")')).toBeVisible();
            // Script should not execute (no alerts)
        });
    });

    test.describe('Session Management', () => {
        test('should invalidate sessions on logout', async ({ page }) => {
            // Login
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await expect(page.locator('h1:has-text("System Overview")')).toBeVisible();

            // Logout
            await page.click('button[aria-label="User menu"]');
            await page.click('text=Logout');

            // Try to access protected page
            await page.goto('/projects');

            // Should redirect to login
            await expect(page.locator('text=Log In')).toBeVisible();
        });

        test('should prevent concurrent sessions from different devices', async ({ page }) => {
            // Login from first device
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            // Login from "second device" (new page context)
            const newPage = await page.context().newPage();
            await newPage.goto('/');
            await newPage.click('text=Log In');
            await newPage.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await newPage.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await newPage.click('button[type="submit"]');

            // First session should be invalidated
            await page.reload();
            await expect(page.locator('text=Session expired')).toBeVisible();
        });
    });

    test.describe('API Security', () => {
        test('should validate API request origins', async ({ page }) => {
            // Try API call from unauthorized origin
            const response = await page.request.post('/api/initiatives', {
                data: { name: 'Test' },
                headers: {
                    'Origin': 'https://malicious-site.com'
                }
            });

            // Should be blocked by CORS
            expect([403, 0]).toContain(response.status());
        });

        test('should rate limit API calls', async ({ page }) => {
            // Make many rapid API calls
            const promises = [];
            for (let i = 0; i < 100; i++) {
                promises.push(
                    page.request.get('/api/projects')
                );
            }

            const responses = await Promise.all(promises);
            const rateLimitedResponses = responses.filter(r => r.status() === 429);

            // Should have some rate limited responses
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });

        test('should validate request size limits', async ({ page }) => {
            // Try to send very large request
            const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB

            const response = await page.request.post('/api/initiatives', {
                data: { description: largeData }
            });

            // Should be rejected due to size limit
            expect([413, 400]).toContain(response.status());
        });
    });
});














