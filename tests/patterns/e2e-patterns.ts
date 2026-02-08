/**
 * Professional E2E Test Patterns
 *
 * Patterns for end-to-end testing with browser automation
 */

// ============================================================================
// Types
// ============================================================================

export interface E2ETestContext {
    baseUrl: string;
    timeout: number;
    screenshotDir: string;
    videoDir: string;
}

export interface PageObject<T> {
    url: string;
    selectors: Record<keyof T, string>;
    actions: Record<string, () => Promise<void>>;
}

export interface UserFlow {
    name: string;
    steps: FlowStep[];
}

export interface FlowStep {
    name: string;
    action: () => Promise<void>;
    validation?: () => Promise<boolean>;
    screenshot?: boolean;
}

// ============================================================================
// Page Object Pattern
// ============================================================================

export abstract class BasePage {
    protected abstract url: string;
    protected abstract selectors: Record<string, string>;

    /**
     * Navigate to the page
     */
    async goto(navigate: (url: string) => Promise<void>): Promise<void> {
        await navigate(this.url);
    }

    /**
     * Get selector by name
     */
    getSelector(name: string): string {
        const selector = this.selectors[name];
        if (!selector) {
            throw new Error(`Selector "${name}" not found in ${this.constructor.name}`);
        }
        return selector;
    }

    /**
     * Wait for page to be ready
     */
    abstract waitForReady(): Promise<void>;
}

/**
 * Example: Login Page Object
 */
export class LoginPage extends BasePage {
    protected url = '/login';
    protected selectors = {
        emailInput: '[data-testid="email-input"]',
        passwordInput: '[data-testid="password-input"]',
        submitButton: '[data-testid="login-submit"]',
        errorMessage: '[data-testid="login-error"]',
        forgotPasswordLink: '[data-testid="forgot-password"]',
    };

    async waitForReady(): Promise<void> {
        // Implementation would wait for page elements
    }

    async login(
        email: string,
        password: string,
        actions: {
            type: (selector: string, text: string) => Promise<void>;
            click: (selector: string) => Promise<void>;
        }
    ): Promise<void> {
        await actions.type(this.selectors.emailInput, email);
        await actions.type(this.selectors.passwordInput, password);
        await actions.click(this.selectors.submitButton);
    }
}

/**
 * Example: Dashboard Page Object
 */
export class DashboardPage extends BasePage {
    protected url = '/dashboard';
    protected selectors = {
        welcomeMessage: '[data-testid="welcome-message"]',
        projectList: '[data-testid="project-list"]',
        createProjectButton: '[data-testid="create-project"]',
        userMenu: '[data-testid="user-menu"]',
        logoutButton: '[data-testid="logout"]',
        notifications: '[data-testid="notifications"]',
    };

    async waitForReady(): Promise<void> {
        // Implementation would wait for dashboard elements
    }
}

// ============================================================================
// User Flow Pattern
// ============================================================================

/**
 * Execute a user flow with validation
 */
export async function executeUserFlow(
    flow: UserFlow,
    options: {
        onStepStart?: (step: FlowStep) => void;
        onStepComplete?: (step: FlowStep) => void;
        onStepFailed?: (step: FlowStep, error: Error) => void;
        takeScreenshot?: (name: string) => Promise<void>;
    } = {}
): Promise<{ success: boolean; failedStep?: string; error?: Error }> {
    for (const step of flow.steps) {
        options.onStepStart?.(step);

        try {
            await step.action();

            if (step.validation) {
                const valid = await step.validation();
                if (!valid) {
                    throw new Error(`Validation failed for step: ${step.name}`);
                }
            }

            if (step.screenshot && options.takeScreenshot) {
                await options.takeScreenshot(`${flow.name}-${step.name}`);
            }

            options.onStepComplete?.(step);
        } catch (error) {
            options.onStepFailed?.(step, error as Error);
            return {
                success: false,
                failedStep: step.name,
                error: error as Error,
            };
        }
    }

    return { success: true };
}

/**
 * Create common user flows
 */
export const CommonFlows = {
    login: (
        email: string,
        password: string,
        actions: {
            navigate: (url: string) => Promise<void>;
            type: (selector: string, text: string) => Promise<void>;
            click: (selector: string) => Promise<void>;
            waitForUrl: (url: string) => Promise<void>;
        }
    ): UserFlow => ({
        name: 'login',
        steps: [
            {
                name: 'navigate-to-login',
                action: () => actions.navigate('/login'),
            },
            {
                name: 'enter-credentials',
                action: async () => {
                    await actions.type('[data-testid="email-input"]', email);
                    await actions.type('[data-testid="password-input"]', password);
                },
            },
            {
                name: 'submit-form',
                action: () => actions.click('[data-testid="login-submit"]'),
                screenshot: true,
            },
            {
                name: 'wait-for-dashboard',
                action: () => actions.waitForUrl('/dashboard'),
                validation: async () => true,
            },
        ],
    }),

    logout: (actions: {
        click: (selector: string) => Promise<void>;
        waitForUrl: (url: string) => Promise<void>;
    }): UserFlow => ({
        name: 'logout',
        steps: [
            {
                name: 'open-user-menu',
                action: () => actions.click('[data-testid="user-menu"]'),
            },
            {
                name: 'click-logout',
                action: () => actions.click('[data-testid="logout"]'),
            },
            {
                name: 'wait-for-login-page',
                action: () => actions.waitForUrl('/login'),
            },
        ],
    }),

    createProject: (
        projectData: { name: string; description: string },
        actions: {
            click: (selector: string) => Promise<void>;
            type: (selector: string, text: string) => Promise<void>;
            waitForSelector: (selector: string) => Promise<void>;
        }
    ): UserFlow => ({
        name: 'create-project',
        steps: [
            {
                name: 'open-create-dialog',
                action: () => actions.click('[data-testid="create-project"]'),
            },
            {
                name: 'fill-project-details',
                action: async () => {
                    await actions.type('[data-testid="project-name"]', projectData.name);
                    await actions.type('[data-testid="project-description"]', projectData.description);
                },
            },
            {
                name: 'submit-project',
                action: () => actions.click('[data-testid="submit-project"]'),
                screenshot: true,
            },
            {
                name: 'wait-for-project-page',
                action: () => actions.waitForSelector('[data-testid="project-header"]'),
            },
        ],
    }),
};

// ============================================================================
// Visual Regression Pattern
// ============================================================================

export interface VisualRegressionConfig {
    baselineDir: string;
    currentDir: string;
    diffDir: string;
    threshold: number;
}

export interface VisualComparisonResult {
    match: boolean;
    diffPercentage: number;
    baselinePath: string;
    currentPath: string;
    diffPath?: string;
}

/**
 * Compare screenshots for visual regression
 * Note: Actual implementation would use a library like pixelmatch
 */
export async function compareScreenshots(
    name: string,
    currentScreenshot: Buffer,
    _config: VisualRegressionConfig
): Promise<VisualComparisonResult> {
    // This is a placeholder - actual implementation would use image comparison
    return {
        match: true,
        diffPercentage: 0,
        baselinePath: `${_config.baselineDir}/${name}.png`,
        currentPath: `${_config.currentDir}/${name}.png`,
    };
}

// ============================================================================
// Accessibility Testing Pattern
// ============================================================================

export interface A11yViolation {
    id: string;
    impact: 'minor' | 'moderate' | 'serious' | 'critical';
    description: string;
    nodes: { html: string; target: string[] }[];
}

export interface A11yResult {
    violations: A11yViolation[];
    passes: number;
    incomplete: number;
}

/**
 * Check page accessibility
 * Note: Actual implementation would use axe-core
 */
export async function checkAccessibility(
    _pageHtml: string,
    options: { rules?: string[] } = {}
): Promise<A11yResult> {
    // Placeholder - actual implementation would use axe-core
    return {
        violations: [],
        passes: 10,
        incomplete: 0,
    };
}

/**
 * Assert no critical accessibility violations
 */
export function assertNoA11yViolations(
    result: A11yResult,
    options: { allowedImpacts?: ('minor' | 'moderate')[] } = {}
): void {
    const { allowedImpacts = [] } = options;

    const criticalViolations = result.violations.filter(
        (v) => !allowedImpacts.includes(v.impact as 'minor' | 'moderate')
    );

    if (criticalViolations.length > 0) {
        const messages = criticalViolations.map(
            (v) => `[${v.impact}] ${v.id}: ${v.description}`
        );
        throw new Error(`Accessibility violations:\n${messages.join('\n')}`);
    }
}

// ============================================================================
// Test Data Seeding Pattern
// ============================================================================

export interface SeedConfig {
    users?: number;
    projects?: number;
    tasks?: number;
}

export interface SeededData {
    users: { id: string; email: string }[];
    projects: { id: string; name: string }[];
    tasks: { id: string; title: string }[];
}

/**
 * Seed test data for E2E tests
 */
export async function seedTestData(
    config: SeedConfig,
    apiClient: {
        post: (path: string, data: unknown) => Promise<{ data: { id: string } & Record<string, unknown> }>;
    }
): Promise<SeededData> {
    const seeded: SeededData = {
        users: [],
        projects: [],
        tasks: [],
    };

    // Seed users
    for (let i = 0; i < (config.users || 0); i++) {
        const res = await apiClient.post('/api/users', {
            email: `testuser${i}@example.com`,
            password: 'TestPassword123!',
        });
        seeded.users.push({ id: res.data.id, email: `testuser${i}@example.com` });
    }

    // Seed projects
    for (let i = 0; i < (config.projects || 0); i++) {
        const res = await apiClient.post('/api/projects', {
            name: `Test Project ${i}`,
        });
        seeded.projects.push({ id: res.data.id, name: `Test Project ${i}` });
    }

    // Seed tasks
    for (let i = 0; i < (config.tasks || 0); i++) {
        const projectId = seeded.projects[i % seeded.projects.length]?.id;
        const res = await apiClient.post('/api/tasks', {
            title: `Test Task ${i}`,
            projectId,
        });
        seeded.tasks.push({ id: res.data.id, title: `Test Task ${i}` });
    }

    return seeded;
}

/**
 * Cleanup seeded test data
 */
export async function cleanupTestData(
    seeded: SeededData,
    apiClient: {
        delete: (path: string) => Promise<void>;
    }
): Promise<void> {
    // Delete in reverse order to respect foreign keys
    for (const task of seeded.tasks) {
        await apiClient.delete(`/api/tasks/${task.id}`).catch(() => { });
    }
    for (const project of seeded.projects) {
        await apiClient.delete(`/api/projects/${project.id}`).catch(() => { });
    }
    for (const user of seeded.users) {
        await apiClient.delete(`/api/users/${user.id}`).catch(() => { });
    }
}
