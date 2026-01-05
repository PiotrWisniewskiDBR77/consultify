import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    timeout: 60000, // 60 seconds per test
    expect: {
        timeout: 10000, // 10 seconds for assertions
    },
    reporter: [['list'], ['junit', { outputFile: 'e2e-results.xml' }]],
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        actionTimeout: 15000, // 15 seconds for actions
        navigationTimeout: 30000, // 30 seconds for navigation
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        // Visual regression tests
        {
            name: 'visual-regression',
            testMatch: '**/visual-regression.spec.ts',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1280, height: 720 },
                screenshot: 'on',
            },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        env: {
            NODE_ENV: 'test',
            E2E_MODE: 'true',
            PORT: '3005',
            MOCK_DB: 'false',
            SQLITE_PATH: './e2e-test.db',
        },
    },
});
