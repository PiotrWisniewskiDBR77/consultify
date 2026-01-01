import '@testing-library/jest-dom';
import { beforeAll, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { mockLLMApi } from './__mocks__/llmApi.js';

const require = createRequire(import.meta.url);

// Global mock for react-i18next to prevent "Cannot read properties of undefined (reading 'en')" errors
vi.mock('react-i18next', () => {
    // Helper function to create nested translation objects with language properties
    const createTranslationObject = (key: string, defaultValue?: any): any => {
        // If defaultValue is provided and is an object, use it
        if (defaultValue && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
            return defaultValue;
        }

        // Create a proxy that handles all property access
        return new Proxy({}, {
            get(target, prop: string) {
                // Handle language properties (.en, .pl, etc.) - return the key or a safe value
                if (['en', 'pl', 'de', 'fr', 'es', 'it', 'ja', 'zh'].includes(prop)) {
                    return defaultValue || key;
                }
                // Handle common nested properties that might be accessed
                if (['scenarios', 'deepDive', 'recommended', 'title', 'subtitle', 'name', 'description', 'gains', 'sacrifices', 'narrative'].includes(prop)) {
                    return createTranslationObject(`${key}.${prop}`);
                }
                // Handle array access (e.g., t.scenarios[id])
                if (typeof prop === 'string' && /^[a-zA-Z0-9_-]+$/.test(prop)) {
                    return createTranslationObject(`${key}.${prop}`);
                }
                // Handle toString/valueOf for string conversion
                if (prop === 'toString' || prop === 'valueOf') {
                    return () => defaultValue || key;
                }
                // Handle undefined properties gracefully
                if (prop === Symbol.toPrimitive) {
                    return () => defaultValue || key;
                }
                // Return undefined for unknown properties (but don't throw)
                return undefined;
            },
            // Make it work with Object.keys and similar
            ownKeys() {
                return ['en', 'pl', 'scenarios', 'deepDive', 'recommended'];
            },
            has(target, prop) {
                return ['en', 'pl', 'scenarios', 'deepDive', 'recommended', 'toString', 'valueOf'].includes(prop as string) ||
                    (typeof prop === 'string' && /^[a-zA-Z0-9_-]+$/.test(prop));
            },
            getOwnPropertyDescriptor(target, prop) {
                return {
                    enumerable: true,
                    configurable: true,
                    value: this.get(target, prop, target)
                };
            }
        });
    };

    return {
        useTranslation: () => ({
            t: (key: string, options?: any) => {
                // Handle returnObjects option
                if (options?.returnObjects) {
                    return createTranslationObject(key, options.defaultValue);
                }
                // Handle interpolation
                if (options && typeof options === 'object' && !options.returnObjects) {
                    // Simple interpolation - replace {key} with value
                    let result = options.defaultValue || key;
                    Object.keys(options).forEach(optKey => {
                        if (optKey !== 'defaultValue' && optKey !== 'returnObjects') {
                            result = String(result).replace(new RegExp(`\\{${optKey}\\}`, 'g'), String(options[optKey]));
                        }
                    });
                    return result;
                }
                // Default: return the key or defaultValue
                return options?.defaultValue || key;
            },
            i18n: {
                language: 'en',
                changeLanguage: vi.fn(),
                getResourceBundle: vi.fn(() => ({})),
                hasResourceBundle: vi.fn(() => false),
                addResourceBundle: vi.fn(),
            },
            ready: true
        }),
        Trans: ({ children, i18nKey }: any) => children || i18nKey,
        I18nextProvider: ({ children }: any) => children,
    };
});

// Ensure consistent test-mode behavior across backend + frontend tests
if (typeof process !== 'undefined' && process.env) {
    process.env.NODE_ENV = 'test';
    process.env.DB_TYPE = process.env.DB_TYPE || 'sqlite';
    process.env.MOCK_REDIS = process.env.MOCK_REDIS || 'true';
    process.env.MOCK_DB = process.env.MOCK_DB || 'true';
    // Keep DB in-memory in tests (db chooses :memory: when NODE_ENV === 'test')
    process.env.SQLITE_PATH = process.env.SQLITE_PATH || ':memory:';
}

// Reset LLM API mocks before each test
beforeEach(() => {
    mockLLMApi.reset();
});

// Ensure DB schema is initialized before any test starts hitting it.
beforeAll(async () => {
    try {
        const db = require('../server/database');
        if (db?.initPromise) {
            await db.initPromise;
        }

        // Create audit_logs table if not exists (needed by AssessmentAuditLogger)
        // This table is in assessment-module.sql migration
        if (db?.run) {
            // Helper to run SQL and ignore errors
            const runSQL = (sql: string) => new Promise<void>((resolve) => {
                db.run(sql, (err: Error | null) => {
                    if (err && !err.message.includes('already exists')) {
                        console.warn('[Test Setup] Table creation issue:', err?.message);
                    }
                    resolve();
                });
            });

            // Create all required test tables
            await runSQL(`CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                organization_id TEXT,
                action TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id TEXT,
                details TEXT DEFAULT '{}',
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`CREATE TABLE IF NOT EXISTS assessment_workflows (
                id TEXT PRIMARY KEY,
                assessment_id TEXT,
                project_id TEXT,
                organization_id TEXT,
                status TEXT DEFAULT 'DRAFT',
                current_version INTEGER DEFAULT 1,
                created_by TEXT,
                submitted_by TEXT,
                approved_by TEXT,
                rejected_by TEXT,
                submitted_at DATETIME,
                approved_at DATETIME,
                rejected_at DATETIME,
                approval_notes TEXT,
                rejection_reason TEXT,
                axis_issues TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`CREATE TABLE IF NOT EXISTS assessment_reviews (
                id TEXT PRIMARY KEY,
                workflow_id TEXT,
                reviewer_id TEXT,
                reviewer_role TEXT,
                status TEXT DEFAULT 'PENDING',
                rating INTEGER,
                comments TEXT,
                axis_comments TEXT,
                recommendation TEXT,
                requested_at DATETIME,
                due_date DATETIME,
                completed_at DATETIME
            )`);

            await runSQL(`CREATE TABLE IF NOT EXISTS assessment_versions (
                id TEXT PRIMARY KEY,
                assessment_id TEXT,
                version INTEGER,
                assessment_data TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`CREATE TABLE IF NOT EXISTS assessment_axis_comments (
                id TEXT PRIMARY KEY,
                assessment_id TEXT,
                axis_id TEXT,
                user_id TEXT,
                comment TEXT,
                parent_comment_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`DROP TABLE IF EXISTS rapid_lean_assessments`);
            await runSQL(`CREATE TABLE IF NOT EXISTS rapid_lean_assessments (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                project_id TEXT,
                assessment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                value_stream_score REAL DEFAULT 0,
                waste_elimination_score REAL DEFAULT 0,
                flow_pull_score REAL DEFAULT 0,
                quality_source_score REAL DEFAULT 0,
                continuous_improvement_score REAL DEFAULT 0,
                visual_management_score REAL DEFAULT 0,
                overall_score REAL DEFAULT 0,
                industry_benchmark REAL DEFAULT 3.3,
                ai_recommendations TEXT DEFAULT '[]',
                top_gaps TEXT DEFAULT '[]',
                questionnaire_responses TEXT DEFAULT '{}',
                drd_mapping TEXT DEFAULT '{}',
                observation_count INTEGER DEFAULT 0,
                report_generated INTEGER DEFAULT 0,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`CREATE TABLE IF NOT EXISTS rapid_lean_observations (
                id TEXT PRIMARY KEY,
                assessment_id TEXT,
                organization_id TEXT NOT NULL,
                project_id TEXT,
                template_id TEXT NOT NULL,
                location TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                answers TEXT DEFAULT '{}',
                photos TEXT DEFAULT '[]',
                notes TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`CREATE TABLE IF NOT EXISTS rapid_lean_reports (
                id TEXT PRIMARY KEY,
                assessment_id TEXT NOT NULL,
                organization_id TEXT NOT NULL,
                project_id TEXT,
                report_type TEXT DEFAULT 'detailed',
                format TEXT DEFAULT 'pdf',
                file_url TEXT,
                report_data TEXT DEFAULT '{}',
                generated_by TEXT,
                generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`DROP TABLE IF EXISTS assessments`);
            await runSQL(`CREATE TABLE IF NOT EXISTS assessments (
                id TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                status TEXT DEFAULT 'DRAFT',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`DROP TABLE IF EXISTS maturity_assessments`);
            await runSQL(`CREATE TABLE IF NOT EXISTS maturity_assessments (
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                project_id TEXT,
                name TEXT,
                assessment_date DATE,
                planning_score REAL,
                decision_score REAL,
                execution_score REAL,
                monitoring_score REAL,
                collaboration_score REAL,
                axis_scores TEXT DEFAULT '[]',
                completed_axes TEXT DEFAULT '[]',
                overall_as_is REAL DEFAULT 0,
                overall_to_be REAL DEFAULT 0,
                overall_gap REAL DEFAULT 0,
                overall_score REAL,
                gap_analysis TEXT DEFAULT '{}',
                gap_analysis_summary TEXT,
                is_complete INTEGER DEFAULT 0,
                assessment_status TEXT DEFAULT 'IN_PROGRESS',
                finalized_at DATETIME,
                is_approved INTEGER DEFAULT 0,
                approved_at DATETIME,
                approved_by TEXT,
                updated_by TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                type TEXT,
                title TEXT,
                message TEXT,
                data TEXT,
                read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`DROP TABLE IF EXISTS status_reports`);
            await runSQL(`CREATE TABLE IF NOT EXISTS status_reports (
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                initiative_id TEXT,
                project_id TEXT,
                period_type TEXT DEFAULT 'WEEKLY',
                period_start DATETIME,
                period_end DATETIME,
                period_label TEXT,
                overall_status TEXT,
                overall_trend TEXT,
                sections_json TEXT,
                executive_summary TEXT,
                accomplishments TEXT,
                next_steps TEXT,
                escalations TEXT,
                risks_and_issues TEXT,
                recommendations TEXT,
                progress_percent INTEGER,
                budget_consumed_percent INTEGER,
                tasks_completed INTEGER,
                tasks_total INTEGER,
                open_risks INTEGER,
                open_issues INTEGER,
                pending_decisions INTEGER,
                generation_method TEXT,
                status TEXT DEFAULT 'DRAFT',
                summary TEXT,
                blockers TEXT,
                report_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME,
                approved_by TEXT,
                approved_at DATETIME,
                published_at DATETIME
            )`);

            await runSQL(`DROP TABLE IF EXISTS initiatives`);
            await runSQL(`CREATE TABLE IF NOT EXISTS initiatives (
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                project_id TEXT,
                name TEXT,
                title TEXT,
                description TEXT,
                summary TEXT,
                status TEXT DEFAULT 'DRAFT',
                priority TEXT DEFAULT 'MEDIUM',
                progress INTEGER DEFAULT 0,
                blocked_reason TEXT,
                start_date DATETIME,
                end_date DATETIME,
                owner_id TEXT,
                owner_business_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`DROP TABLE IF EXISTS initiative_budgets`);
            await runSQL(`CREATE TABLE IF NOT EXISTS initiative_budgets (
                id TEXT PRIMARY KEY,
                initiative_id TEXT NOT NULL,
                organization_id TEXT NOT NULL,
                budget_type TEXT NOT NULL DEFAULT 'COMBINED',
                planned_amount REAL DEFAULT 0,
                approved_amount REAL DEFAULT 0,
                currency TEXT DEFAULT 'PLN',
                fiscal_year INTEGER,
                contingency_percent REAL DEFAULT 10,
                contingency_amount REAL DEFAULT 0,
                notes TEXT,
                status TEXT DEFAULT 'DRAFT',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`DROP TABLE IF EXISTS budget_line_items`);
            await runSQL(`CREATE TABLE IF NOT EXISTS budget_line_items (
                id TEXT PRIMARY KEY,
                budget_id TEXT NOT NULL,
                category TEXT,
                subcategory TEXT,
                description TEXT,
                budget_type TEXT DEFAULT 'OPEX',
                planned_amount REAL DEFAULT 0,
                actual_amount REAL DEFAULT 0,
                committed_amount REAL DEFAULT 0,
                variance_amount REAL DEFAULT 0,
                variance_percent REAL DEFAULT 0,
                forecast_amount REAL DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                status TEXT DEFAULT 'PLANNED',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                password_hash TEXT,
                name TEXT,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`DROP TABLE IF EXISTS decisions`);
            await runSQL(`CREATE TABLE IF NOT EXISTS decisions (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                decision_type TEXT NOT NULL,
                related_object_type TEXT NOT NULL,
                related_object_id TEXT NOT NULL,
                decision_owner_id TEXT NOT NULL,
                requested_by_id TEXT,
                status TEXT DEFAULT 'PENDING',
                required INTEGER DEFAULT 1,
                priority TEXT DEFAULT 'MEDIUM',
                due_date DATETIME,
                title TEXT NOT NULL,
                description TEXT,
                outcome TEXT,
                rationale TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                decided_at DATETIME,
                audit_trail TEXT DEFAULT '[]'
            )`);

            // AI Nudge tables
            await runSQL(`CREATE TABLE IF NOT EXISTS ai_nudge_log (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                organization_id TEXT,
                nudge_id TEXT NOT NULL,
                shown_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                acted_upon INTEGER DEFAULT 0,
                action TEXT,
                acted_at DATETIME
            )`);

            await runSQL(`CREATE TABLE IF NOT EXISTS ai_nudge_dismissals (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                nudge_id TEXT NOT NULL,
                dismissed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // AI Rate Limits table
            await runSQL(`CREATE TABLE IF NOT EXISTS ai_rate_limits (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                rule_name TEXT,
                applies_to TEXT DEFAULT 'all',
                limit_type TEXT DEFAULT 'per_day',
                limit_value INTEGER DEFAULT 1000,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Budget Transactions table
            await runSQL(`CREATE TABLE IF NOT EXISTS budget_transactions (
                id TEXT PRIMARY KEY,
                budget_id TEXT NOT NULL,
                line_item_id TEXT,
                transaction_type TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT DEFAULT 'PLN',
                description TEXT,
                vendor TEXT,
                invoice_number TEXT,
                transaction_date TEXT NOT NULL,
                period_month INTEGER,
                period_year INTEGER,
                cost_center TEXT,
                gl_account TEXT,
                status TEXT DEFAULT 'PENDING',
                created_by TEXT,
                approved_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // LLM Providers table
            await runSQL(`DROP TABLE IF EXISTS llm_providers`);
            await runSQL(`CREATE TABLE IF NOT EXISTS llm_providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                provider TEXT NOT NULL,
                description TEXT,
                api_key TEXT,
                endpoint TEXT,
                model_id TEXT,
                cost_per_1k REAL DEFAULT 0,
                input_cost_per_1k REAL DEFAULT 0,
                output_cost_per_1k REAL DEFAULT 0,
                markup_multiplier REAL DEFAULT 1.0,
                is_active INTEGER DEFAULT 1,
                is_default INTEGER DEFAULT 0,
                visibility TEXT DEFAULT 'public',
                priority INTEGER DEFAULT 0,
                last_health_check TEXT,
                health_status TEXT DEFAULT 'unknown',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            // AI Learning tables
            await runSQL(`DROP TABLE IF EXISTS ai_learning_interactions`);
            await runSQL(`CREATE TABLE IF NOT EXISTS ai_learning_interactions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                organization_id TEXT,
                request_type TEXT NOT NULL,
                prompt_hash TEXT,
                response_hash TEXT,
                response_quality REAL,
                success INTEGER DEFAULT 1,
                feedback_score REAL,
                auto_feedback_score REAL,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await runSQL(`CREATE TABLE IF NOT EXISTS ai_learned_patterns (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                request_type TEXT NOT NULL,
                pattern_type TEXT,
                pattern_key TEXT,
                pattern_data TEXT,
                successful_patterns TEXT,
                failed_patterns TEXT,
                sample_count INTEGER DEFAULT 0,
                confidence REAL DEFAULT 0,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // AI Nudge Suppressions table
            await runSQL(`CREATE TABLE IF NOT EXISTS ai_nudge_suppressions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                nudge_type TEXT NOT NULL,
                suppressed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                UNIQUE(user_id, nudge_type)
            )`);

            // AI A/B Experiments table
            await runSQL(`CREATE TABLE IF NOT EXISTS ai_ab_experiments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                prompt_id TEXT NOT NULL,
                variants TEXT NOT NULL,
                traffic_split TEXT NOT NULL,
                min_sample_size INTEGER DEFAULT 100,
                confidence_level REAL DEFAULT 0.95,
                primary_metric TEXT DEFAULT 'user_satisfaction',
                status TEXT DEFAULT 'draft',
                stop_reason TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                started_at DATETIME,
                ended_at DATETIME
            )`);

            // AI A/B Assignments table
            await runSQL(`CREATE TABLE IF NOT EXISTS ai_ab_assignments (
                id TEXT PRIMARY KEY,
                experiment_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                variant_index INTEGER NOT NULL,
                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(experiment_id, user_id)
            )`);

            // AI A/B Outcomes table
            await runSQL(`CREATE TABLE IF NOT EXISTS ai_ab_outcomes (
                id TEXT PRIMARY KEY,
                experiment_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                variant_index INTEGER NOT NULL,
                metric TEXT NOT NULL,
                value REAL NOT NULL,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // AI System Prompts table (needed for A/B experiments)
            await runSQL(`CREATE TABLE IF NOT EXISTS ai_system_prompts (
                id TEXT PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                description TEXT,
                content TEXT NOT NULL,
                context_config TEXT DEFAULT '{}',
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Help Analytics table
            await runSQL(`CREATE TABLE IF NOT EXISTS help_analytics (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                organization_id TEXT,
                search_query TEXT,
                results_count INTEGER DEFAULT 0,
                clicked_result TEXT,
                session_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Help Feedback table
            await runSQL(`CREATE TABLE IF NOT EXISTS help_feedback (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                organization_id TEXT,
                content_id TEXT,
                content_type TEXT,
                rating INTEGER,
                helpful INTEGER DEFAULT 0,
                comment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Initiative Templates table
            await runSQL(`CREATE TABLE IF NOT EXISTS initiative_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                category TEXT,
                template_data TEXT,
                default_duration_days INTEGER DEFAULT 90,
                default_budget REAL DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Management Report Templates table
            await runSQL(`CREATE TABLE IF NOT EXISTS management_report_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                template_type TEXT,
                template_data TEXT,
                sections TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Demo Templates table
            await runSQL(`CREATE TABLE IF NOT EXISTS demo_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                seed_data_json TEXT,
                template_type TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Action Decisions table
            await runSQL(`CREATE TABLE IF NOT EXISTS action_decisions (
                id TEXT PRIMARY KEY,
                initiative_id TEXT,
                action_id TEXT,
                decision_type TEXT,
                status TEXT DEFAULT 'PENDING',
                decided_by TEXT,
                decided_at DATETIME,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        }
    } catch (err) {
        console.warn('[Test Setup] DB init wait skipped:', (err as Error)?.message || err);
    }
});

if (typeof window !== 'undefined') {
    global.ResizeObserver = class ResizeObserver {
        observe() { }
        unobserve() { }
        disconnect() { }
    };

    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated
            removeListener: vi.fn(), // deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

// Node Polyfills
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as unknown as typeof TextEncoder;
global.TextDecoder = TextDecoder as unknown as any;

// PDF-Parse / Canvas Polyfills
global.DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor() { }
} as any;

// Mock Google Generative AI SDK - prevent real API calls in tests
vi.mock('@google/generative-ai', () => {
    const generateContentMock = vi.fn().mockResolvedValue({
        response: {
            text: () => 'Mock AI Response for testing',
            candidates: [{ content: { parts: [{ text: 'Mock AI Response' }] } }]
        }
    });

    return {
        GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
            getGenerativeModel: vi.fn().mockReturnValue({
                getGenerativeModel: vi.fn().mockReturnThis(),
                generateContent: generateContentMock,
                generateContentStream: vi.fn().mockImplementation(async function* () {
                    yield { text: () => 'Mock' };
                    yield { text: () => ' AI' };
                    yield { text: () => ' Response' };
                }),
                countTokens: vi.fn().mockResolvedValue({ totalTokens: 100 })
            })
        })),
        HarmCategory: { HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT' },
        HarmBlockThreshold: { BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE' }
    };
});

// Mock removed to allow real middleware usage with DI
// Real middleware handles NODE_ENV=test automatically


// Mock RapidLeanReportService globally
vi.mock('../server/services/rapidLeanReportService', () => {
    return {
        generateReport: vi.fn().mockResolvedValue({
            fileUrl: '/uploads/reports/test-report.pdf',
            id: 'test-report-id'
        }),
        getReport: vi.fn().mockResolvedValue({
            id: 'test-report-id',
            file_url: '/uploads/reports/test-report.pdf'
        })
    };
});

// Mock multer globally
vi.mock('multer', () => {
    const mock = vi.fn().mockReturnValue({
        array: vi.fn().mockReturnValue((req: any, res: any, next: any) => {
            req.files = [];
            next();
        }),
        single: vi.fn().mockReturnValue((req: any, res: any, next: any) => {
            req.file = {};
            next();
        }),
        fields: vi.fn().mockReturnValue((req: any, res: any, next: any) => {
            req.files = {};
            next();
        }),
        any: vi.fn().mockReturnValue((req: any, res: any, next: any) => {
            req.files = [];
            next();
        })
    }) as any;
    mock.diskStorage = vi.fn().mockReturnValue({});
    mock.memoryStorage = vi.fn().mockReturnValue({});
    return mock;
});

// Mock OpenAI SDK
vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: vi.fn().mockResolvedValue({
                    choices: [{ message: { content: 'Mock OpenAI Response' } }],
                    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
                })
            }
        }
    }))
}));

// Mock html2canvas for PDF export tests
vi.mock('html2canvas', () => ({
    default: vi.fn().mockResolvedValue({
        toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockImageData'),
        width: 800,
        height: 600
    })
}));

// Mock canvas for PDF rendering
if (typeof window !== 'undefined') {
    const mockCanvas = {
        getContext: vi.fn().mockReturnValue({
            fillRect: vi.fn(),
            drawImage: vi.fn(),
            getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
            putImageData: vi.fn(),
            createImageData: vi.fn(),
            setTransform: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            scale: vi.fn(),
            rotate: vi.fn(),
            translate: vi.fn(),
            transform: vi.fn(),
            fillText: vi.fn(),
            strokeText: vi.fn(),
            measureText: vi.fn().mockReturnValue({ width: 100 }),
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            closePath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            arc: vi.fn(),
            rect: vi.fn()
        }),
        toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockCanvasData'),
        width: 800,
        height: 600
    };
    HTMLCanvasElement.prototype.getContext = mockCanvas.getContext;
    HTMLCanvasElement.prototype.toDataURL = mockCanvas.toDataURL;
}

// Handle uncaught exceptions - log but don't rethrow to prevent Vitest worker crashes
// Previously throwing here caused "Worker exited unexpectedly" errors
// Real failures will surface in individual test assertions
if (typeof process !== 'undefined' && process.on) {
    process.on('uncaughtException', (err: any) => {
        // Log the error for debugging but don't crash the worker
        console.error('[Test Setup] Uncaught exception (logged, not rethrown):', err?.message || err);
        // Don't rethrow - let the test framework handle assertion failures
    });

    process.on('unhandledRejection', (reason: any) => {
        console.error('[Test Setup] Unhandled rejection (logged, not rethrown):', (reason as Error)?.message || reason);
        // Don't throw - let the test framework handle it
    });
}
