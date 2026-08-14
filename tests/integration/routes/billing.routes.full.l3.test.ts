import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

import { TestDatabaseFactory } from '../../utils/TestDatabaseFactory.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'true';
  process.env.TEST_TYPE = 'integration';
  process.env.NODE_ENV = 'test';
  process.env.MOCK_REDIS = 'true';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

  const workerId = process.env.VITEST_WORKER_ID || '0';
  const runId = process.env.VITEST_RUN_ID || Date.now().toString(36);
  process.env.SQLITE_PATH = `./test-l3-${workerId}-${runId}.db`;
});

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    if (!req.user) {
      req.user = {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'guest',
        organizationId: 'test-org-id',
        isSuperAdmin: false,
        isDemo: false,
      };
      req.userId = req.user.id;
      req.organizationId = req.user.organizationId;
      req.userRole = req.user.role;
    }
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: any) => {
    if (req.user?.isSuperAdmin) {
      next();
      return;
    }
    res.status(403).json({ error: 'Superadmin access required' });
  },
}));

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

describe('Billing routes integration (L3) - full', () => {
  let db: any;
  let resetConnection: (() => Promise<void>) | null = null;
  let initializeDatabase: (() => Promise<any>) | null = null;

  const dbRun = (sql: string, params: any[] = []) =>
    new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err: any) => (err ? reject(err) : resolve()));
    });

  const dbGet = <T,>(sql: string, params: any[] = []) =>
    new Promise<T | undefined>((resolve, reject) => {
      db.get(sql, params, (err: any, row: any) => (err ? reject(err) : resolve(row)));
    });

  const dbAll = <T,>(sql: string, params: any[] = []) =>
    new Promise<T[]>((resolve, reject) => {
      db.all(sql, params, (err: any, rows: any[]) => (err ? reject(err) : resolve(rows as T[])));
    });

  const ensureSqliteColumn = async (table: string, column: string, type: string) => {
    try {
      await dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!msg.toLowerCase().includes('duplicate column') && !msg.toLowerCase().includes('already exists')) {
        throw e;
      }
    }
  };

  const makeApp = async () => {
    const router = (await import('../../../server/src/routes/billing/billing.routes.ts')).default;
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      delete req.headers.authorization;
      delete req.headers.Authorization;
      if (req.cookies) {
        delete req.cookies.access_token;
        delete req.cookies.token;
      }
      if (req.query?.token) {
        delete req.query.token;
      }
      if (req.body?.token) {
        delete req.body.token;
      }

      const testRole = req.headers['x-test-role'];
      const testOrgId = req.headers['x-test-org-id'];
      const testUserId = req.headers['x-test-user-id'];
      const testIsSuperAdmin = req.headers['x-test-superadmin'];

      if (testRole || testOrgId || testUserId || testIsSuperAdmin) {
        req.user = {
          id: String(testUserId || 'test-user'),
          name: 'Test User',
          email: 'test@example.com',
          role: String(testRole || 'guest'),
          organizationId: String(testOrgId || 'test-org-id'),
          isSuperAdmin: String(testIsSuperAdmin || 'false') === 'true',
        };
        req.userId = req.user.id;
        req.organizationId = req.user.organizationId;
        req.userRole = req.user.role;
      }

      next();
    });
    app.use('/api/billing', router);
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ success: false, error: err?.message || 'Internal error' });
    });
    return app;
  };

  const dispatch = async (
    app: express.Express,
    {
      method,
      url,
      headers = {},
      body,
      user,
      query,
    }: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: any;
      user?: any;
      query?: Record<string, any>;
    }
  ) => {
    let httpRequest = request(app)[method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch'](
      url
    );

    const effectiveHeaders = { ...headers };
    if (user) {
      effectiveHeaders['x-test-user-id'] = user.id;
      effectiveHeaders['x-test-org-id'] = user.organizationId;
      effectiveHeaders['x-test-role'] = user.role;
      effectiveHeaders['x-test-superadmin'] = user.isSuperAdmin ? 'true' : 'false';
    }

    for (const [name, value] of Object.entries(effectiveHeaders)) {
      httpRequest = httpRequest.set(name, value);
    }

    if (query && Object.keys(query).length > 0) {
      httpRequest = httpRequest.query(query);
    }

    if (body !== undefined) {
      httpRequest = httpRequest.send(body);
    }

    const res = await httpRequest;
    return {
      status: res.status,
      headers: res.headers as Record<string, string>,
      body: res.body,
      text: res.text,
      redirectedTo: res.headers.location,
      sentFile: undefined as string | undefined,
    };
  };

  const superAdminUser = {
    id: 'u-superadmin',
    organizationId: uuid(101),
    role: 'SUPERADMIN',
    isSuperAdmin: true,
  };

  const ownerUser = {
    id: 'u-owner',
    organizationId: uuid(101),
    role: 'owner',
    isSuperAdmin: false,
  };

  const otherOrgUser = {
    id: 'u-other',
    organizationId: uuid(202),
    role: 'owner',
    isSuperAdmin: false,
  };

  beforeAll(async () => {
    const testDb = await TestDatabaseFactory.create();
    (global as any).__TEST_DB_MOCK__ = testDb;
    (process as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = testDb;
    (globalThis as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = testDb;

    const dbModule = await import('../../../server/src/database/Database.js');
    const initializerModule = await import('../../../server/src/database/DatabaseInitializer.js');

    resetConnection = dbModule.resetConnection;
    initializeDatabase = initializerModule.initializeDatabase;
    db = dbModule.getDatabase();

    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;

	    await dbRun(
	      `CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT, plan TEXT, status TEXT, is_active INTEGER DEFAULT 1)`
	    );
	    await ensureSqliteColumn('organizations', 'token_balance', 'REAL');
	    await ensureSqliteColumn('organizations', 'trial_tokens_used', 'INTEGER');
	    await ensureSqliteColumn('organizations', 'trial_expires_at', 'TEXT');
	    await dbRun(
	      `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, organization_id TEXT, email TEXT, password TEXT, role TEXT, status TEXT, first_name TEXT, last_name TEXT)`
	    );
	    await dbRun(
	      `CREATE TABLE IF NOT EXISTS organization_members (id TEXT PRIMARY KEY, organization_id TEXT, user_id TEXT, role TEXT, status TEXT)`
    );

    await dbRun(
      `CREATE TABLE IF NOT EXISTS subscription_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price_monthly REAL NOT NULL DEFAULT 0,
        price_yearly REAL,
        currency TEXT DEFAULT 'USD',
        features TEXT DEFAULT '[]',
        limits TEXT DEFAULT '{}',
        trial_days INTEGER DEFAULT 0,
        is_public INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
	    );
	    await ensureSqliteColumn('subscription_plans', 'token_overage_rate', 'REAL');
	    await ensureSqliteColumn('subscription_plans', 'storage_overage_rate', 'REAL');
	    await ensureSqliteColumn('subscription_plans', 'token_limit', 'REAL');
	    await ensureSqliteColumn('subscription_plans', 'storage_limit_gb', 'REAL');

    await dbRun(
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        current_period_start TEXT,
        current_period_end TEXT,
        trial_start TEXT,
        trial_end TEXT,
        cancel_at_period_end INTEGER DEFAULT 0,
        canceled_at TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    );

    await dbRun(
      `CREATE TABLE IF NOT EXISTS subscription_events (
        id TEXT PRIMARY KEY,
        subscription_id TEXT,
        organization_id TEXT,
        event_type TEXT,
        mrr_delta REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )`
    );

    await dbRun(
      `CREATE TABLE IF NOT EXISTS organization_billing (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL UNIQUE,
        subscription_plan_id TEXT,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        billing_email TEXT,
        status TEXT,
        current_period_start TEXT,
        current_period_end TEXT,
        grace_period_ends_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );
    await ensureSqliteColumn('organization_billing', 'billing_rail', 'TEXT');
    await ensureSqliteColumn('organization_billing', 'contract_status', 'TEXT');
    await ensureSqliteColumn('organization_billing', 'contract_type', 'TEXT');
    await ensureSqliteColumn('organization_billing', 'renewal_at', 'TEXT');
    await ensureSqliteColumn('organization_billing', 'grace_until', 'TEXT');
    await ensureSqliteColumn('organization_billing', 'access_expires_at', 'TEXT');
    await ensureSqliteColumn('organization_billing', 'external_invoice_ref', 'TEXT');
    await ensureSqliteColumn('organization_billing', 'notes', 'TEXT');
    await ensureSqliteColumn('organization_billing', 'managed_by_user_id', 'TEXT');
    await ensureSqliteColumn('organization_billing', 'is_manual_override', 'INTEGER DEFAULT 0');
    await ensureSqliteColumn('organization_billing', 'billing_address', 'TEXT');
    await ensureSqliteColumn('organization_billing', 'payment_method_last4', 'TEXT');
    await ensureSqliteColumn('organization_billing', 'payment_method_brand', 'TEXT');

    await dbRun(
      `CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        stripe_invoice_id TEXT,
        invoice_number TEXT,
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        amount_paid REAL DEFAULT 0,
        amount_due REAL DEFAULT 0,
        credit_note_id TEXT,
        currency TEXT DEFAULT 'USD',
        status TEXT,
        due_date TEXT,
        paid_at TEXT,
        period_start TEXT,
        period_end TEXT,
        pdf_url TEXT,
        line_items TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );

    await dbRun(`DROP TABLE IF EXISTS credit_notes`);
    await dbRun(
      `CREATE TABLE IF NOT EXISTS credit_notes (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        invoice_id TEXT,
        credit_note_number TEXT,
        total REAL NOT NULL,
        amount_applied REAL DEFAULT 0,
        amount_remaining REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        reason TEXT,
        memo TEXT,
        status TEXT DEFAULT 'issued',
        issued_at TEXT,
        applied_at TEXT,
        refund_amount REAL,
        refund_method TEXT,
        refund_notes TEXT,
        refunded_at TEXT,
        void_reason TEXT,
        voided_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );

    await dbRun(
      `CREATE TABLE IF NOT EXISTS credit_applications (
        id TEXT PRIMARY KEY,
        credit_note_id TEXT NOT NULL,
        invoice_id TEXT NOT NULL,
        amount REAL NOT NULL,
        applied_at TEXT DEFAULT (datetime('now')),
        applied_by TEXT
      )`
    );

	    await dbRun(
	      `CREATE TABLE IF NOT EXISTS usage_records (
	        id TEXT PRIMARY KEY,
	        organization_id TEXT NOT NULL,
	        user_id TEXT,
	        type TEXT,
	        amount INTEGER,
	        metric_name TEXT,
	        quantity INTEGER,
	        action TEXT,
	        metadata TEXT,
	        recorded_at TEXT DEFAULT (datetime('now'))
	      )`
	    );
	    await ensureSqliteColumn('usage_records', 'metric_name', 'TEXT');
	    await ensureSqliteColumn('usage_records', 'quantity', 'INTEGER');

    await dbRun(
      `CREATE TABLE IF NOT EXISTS spending_alerts (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        type TEXT NOT NULL,
        threshold REAL NOT NULL,
        threshold_type TEXT NOT NULL,
        action TEXT NOT NULL,
        notify_emails TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );

    await dbRun(
      `CREATE TABLE IF NOT EXISTS payment_methods (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        type TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`
    );
    await ensureSqliteColumn('payment_methods', 'stripe_payment_method_id', 'TEXT');
    await ensureSqliteColumn('payment_methods', 'brand', 'TEXT');
    await ensureSqliteColumn('payment_methods', 'last4', 'TEXT');
    await ensureSqliteColumn('payment_methods', 'exp_month', 'INTEGER');
    await ensureSqliteColumn('payment_methods', 'exp_year', 'INTEGER');
    await ensureSqliteColumn('payment_methods', 'holder_name', 'TEXT');
    await ensureSqliteColumn('payment_methods', 'is_default', 'INTEGER DEFAULT 0');

    await dbRun(
      `CREATE TABLE IF NOT EXISTS billing_alerts (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        token_threshold_80 INTEGER DEFAULT 0,
        token_threshold_90 INTEGER DEFAULT 0,
        token_threshold_100 INTEGER DEFAULT 0,
        cost_cap_monthly REAL DEFAULT 0,
        email_notifications INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );

    // Recreate with UNIQUE(organization_id) so ON CONFLICT(organization_id) works in SQLite.
    await dbRun(`DROP TABLE IF EXISTS billing_tax_settings`);
    await dbRun(
      `CREATE TABLE IF NOT EXISTS billing_tax_settings (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL UNIQUE,
        tax_id TEXT,
        tax_id_type TEXT,
        tax_exempt INTEGER DEFAULT 0,
        billing_name TEXT,
        billing_email TEXT,
        billing_address_line1 TEXT,
        billing_address_line2 TEXT,
        billing_city TEXT,
        billing_state TEXT,
        billing_postal_code TEXT,
        billing_country TEXT,
        invoice_prefix TEXT,
        po_number TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );

    await dbRun(
      `CREATE TABLE IF NOT EXISTS tax_rates (
        id TEXT PRIMARY KEY,
        display_name TEXT,
        jurisdiction TEXT,
        percentage REAL,
        tax_type TEXT,
        country TEXT,
        region TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );

    await dbRun(
      `CREATE TABLE IF NOT EXISTS vat_validations (
        id TEXT PRIMARY KEY,
        vat_number TEXT,
        country_code TEXT,
        is_valid INTEGER DEFAULT 0,
        company_name TEXT,
        company_address TEXT,
        validation_source TEXT,
        validated_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT
      )`
    );
    await ensureSqliteColumn('vat_validations', 'validation_source', 'TEXT');
    await ensureSqliteColumn('vat_validations', 'expires_at', 'TEXT');

    await dbRun(
      `CREATE TABLE IF NOT EXISTS invoice_templates (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        name TEXT,
        description TEXT,
        template_type TEXT,
        layout_type TEXT,
        header_content TEXT,
        footer_content TEXT,
        primary_color TEXT,
        secondary_color TEXT,
        font_family TEXT,
        show_logo INTEGER DEFAULT 1,
        show_payment_terms INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        is_system INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );

    await dbRun(
      `CREATE TABLE IF NOT EXISTS billing_alerts (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL UNIQUE,
        token_threshold_80 INTEGER DEFAULT 1,
        token_threshold_90 INTEGER DEFAULT 1,
        token_threshold_100 INTEGER DEFAULT 1,
        cost_cap_monthly REAL DEFAULT 2000,
        email_notifications INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );

    await dbRun(
      `CREATE TABLE IF NOT EXISTS billing_addons (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );

    await dbRun(
      `CREATE TABLE IF NOT EXISTS revenue_forecasts (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        forecast_type TEXT,
        forecast_date TEXT,
        period_start TEXT,
        period_end TEXT,
        revenue_amount REAL DEFAULT 0,
        confidence_level REAL DEFAULT 0,
        assumptions TEXT,
        scenario TEXT,
        forecast_data TEXT,
        accuracy REAL DEFAULT 0,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );
    await ensureSqliteColumn('revenue_forecasts', 'forecast_date', 'TEXT');
    await ensureSqliteColumn('revenue_forecasts', 'scenario', 'TEXT');
    await ensureSqliteColumn('revenue_forecasts', 'forecast_data', 'TEXT');
    await ensureSqliteColumn('revenue_forecasts', 'accuracy', 'REAL');
    await ensureSqliteColumn('revenue_forecasts', 'created_by', 'TEXT');

    await dbRun(
      `CREATE TABLE IF NOT EXISTS revenue_recognition (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        invoice_id TEXT,
        total_amount REAL DEFAULT 0,
        recognized_amount REAL DEFAULT 0,
        amount REAL,
        recognition_date TEXT,
        description TEXT,
        recognition_method TEXT,
        start_date TEXT,
        end_date TEXT,
        status TEXT,
        schedule TEXT,
        recognized_at TEXT,
        recognized_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );
    await ensureSqliteColumn('revenue_recognition', 'amount', 'REAL');
    await ensureSqliteColumn('revenue_recognition', 'recognition_date', 'TEXT');
    await ensureSqliteColumn('revenue_recognition', 'description', 'TEXT');
    await ensureSqliteColumn('revenue_recognition', 'recognized_at', 'TEXT');
    await ensureSqliteColumn('revenue_recognition', 'recognized_by', 'TEXT');

	    await dbRun(
	      `CREATE TABLE IF NOT EXISTS subscription_changes (
	        id TEXT PRIMARY KEY,
	        organization_id TEXT,
	        subscription_id TEXT,
	        change_type TEXT,
	        from_plan_id TEXT,
	        to_plan_id TEXT,
	        status TEXT,
	        requested_by TEXT,
	        approved_by TEXT,
	        requested_at TEXT DEFAULT (datetime('now')),
	        approved_at TEXT,
	        created_at TEXT DEFAULT (datetime('now')),
	        proration_amount REAL DEFAULT 0,
	        metadata TEXT
	      )`
	    );
	    await ensureSqliteColumn('subscription_changes', 'created_at', 'TEXT');
	    await ensureSqliteColumn('subscription_changes', 'proration_amount', 'REAL');
	    await ensureSqliteColumn('subscription_changes', 'rejection_reason', 'TEXT');
	    await ensureSqliteColumn('subscription_changes', 'updated_at', 'TEXT');

    await dbRun(
      `CREATE TABLE IF NOT EXISTS billing_webhook_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        event_type TEXT,
        payload TEXT,
        status TEXT,
        target_url TEXT,
        attempt_count INTEGER DEFAULT 0,
        last_attempt_at TEXT,
        next_retry_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );

	    await dbRun(
	      `INSERT OR IGNORE INTO organizations (id, name, plan, status, is_active) VALUES (?, ?, ?, ?, 1)`,
	      [uuid(101), 'Org A', 'enterprise', 'active']
	    );
	    await dbRun(`UPDATE organizations SET token_balance = 0, trial_tokens_used = 0 WHERE id = ?`, [uuid(101)]);
	    await dbRun(
	      `INSERT OR IGNORE INTO organizations (id, name, plan, status, is_active) VALUES (?, ?, ?, ?, 1)`,
	      [uuid(202), 'Org B', 'enterprise', 'active']
	    );

    for (const u of [
      { ...superAdminUser, roleDb: 'SUPERADMIN', email: 'sa@example.com' },
      { ...ownerUser, roleDb: 'OWNER', email: 'owner@example.com' },
      { ...otherOrgUser, roleDb: 'OWNER', email: 'other@example.com' },
    ]) {
      await dbRun(
        `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, u.organizationId, u.email, 'x', u.roleDb, 'active', 'T', u.id]
      );
      await dbRun(
        `INSERT OR REPLACE INTO organization_members (id, organization_id, user_id, role, status)
         VALUES (?, ?, ?, ?, 'ACTIVE')`,
        [`om-${u.id}`, u.organizationId, u.id, u.roleDb]
      );
    }

	    await dbRun(
	      `INSERT OR IGNORE INTO subscription_plans (id, name, description, price_monthly, price_yearly, currency, features, limits, trial_days, is_public, is_active, sort_order)
	       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	      [
	        uuid(1),
        'Basic',
        'Basic plan',
        10,
        100,
        'USD',
        JSON.stringify(['feature-a']),
        JSON.stringify({ seats: 3 }),
        0,
        1,
        1,
	        1,
	      ]
	    );
	    await dbRun(`UPDATE subscription_plans SET token_limit = 1000, storage_limit_gb = 5 WHERE id = ?`, [uuid(1)]);
	    await dbRun(
	      `INSERT OR IGNORE INTO subscription_plans (id, name, description, price_monthly, price_yearly, currency, features, limits, trial_days, is_public, is_active, sort_order)
	       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	      [
	        uuid(2),
        'Pro',
        'Pro plan',
        20,
        200,
        'USD',
        JSON.stringify(['feature-a', 'feature-b']),
        JSON.stringify({ seats: 10 }),
        14,
        1,
        1,
	        2,
	      ]
	    );
	    await dbRun(`UPDATE subscription_plans SET token_limit = 5000, storage_limit_gb = 50 WHERE id = ?`, [uuid(2)]);

    await dbRun(
      `INSERT OR IGNORE INTO subscriptions (id, organization_id, plan_id, status, billing_cycle, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '-10 days'))`,
      [uuid(11), uuid(101), uuid(1), 'active', 'monthly']
    );
    await dbRun(
      `INSERT OR IGNORE INTO subscriptions (id, organization_id, plan_id, status, billing_cycle, canceled_at, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '-2 days'), datetime('now', '-40 days'))`,
      [uuid(12), uuid(202), uuid(2), 'canceled', 'monthly']
    );

    await dbRun(
      `INSERT OR IGNORE INTO subscription_events (id, subscription_id, organization_id, event_type, mrr_delta, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '-7 days'))`,
      [uuid(21), uuid(11), uuid(101), 'new', 10]
    );
    await dbRun(
      `INSERT OR IGNORE INTO subscription_events (id, subscription_id, organization_id, event_type, mrr_delta, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '-5 days'))`,
      [uuid(22), uuid(11), uuid(101), 'expansion', 5]
    );
    await dbRun(
      `INSERT OR IGNORE INTO subscription_events (id, subscription_id, organization_id, event_type, mrr_delta, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '-3 days'))`,
      [uuid(23), uuid(11), uuid(101), 'churn', -10]
    );

    await dbRun(
      `INSERT OR IGNORE INTO organization_billing (id, organization_id, subscription_plan_id, status, current_period_end)
       VALUES (?, ?, ?, ?, datetime('now', '+7 days'))`,
      [uuid(201), uuid(101), uuid(1), 'canceling']
    );

    await dbRun(
      `INSERT OR IGNORE INTO invoices (id, organization_id, invoice_number, status, currency, subtotal, tax_amount, total, amount_paid, amount_due, paid_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 day'), datetime('now', '-2 days'))`,
      [uuid(31), uuid(101), 'INV-000001', 'paid', 'USD', 100, 0, 100, 100, 0]
    );
    await dbRun(
      `INSERT OR IGNORE INTO invoices (id, organization_id, invoice_number, status, currency, subtotal, tax_amount, total, amount_paid, amount_due, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 day'))`,
      [uuid(32), uuid(101), 'INV-000002', 'open', 'USD', 50, 0, 50, 0, 50]
    );
    await dbRun(
      `INSERT OR IGNORE INTO invoices (id, organization_id, invoice_number, status, currency, subtotal, tax_amount, total, amount_paid, amount_due, stripe_invoice_id, pdf_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(33), uuid(101), 'INV-000003', 'open', 'USD', 10, 0, 10, 0, 10, 'in_stripe', 'https://stripe.com/invoice.pdf']
    );

	    await dbRun(
	      `INSERT OR IGNORE INTO credit_notes (id, organization_id, invoice_id, credit_note_number, total, amount_remaining, currency, reason, memo, status, issued_at)
	       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 day'))`,
	      [uuid(41), uuid(101), uuid(31), 'CN-000001', 20, 20, 'USD', 'Test credit', null, 'issued']
	    );
    await dbRun(
      `INSERT OR IGNORE INTO credit_notes (id, organization_id, invoice_id, credit_note_number, total, amount_remaining, currency, reason, memo, status, issued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 day'))`,
      [uuid(42), uuid(101), null, 'CN-000002', 10, 10, 'USD', 'Void me', null, 'issued']
    );

	    await dbRun(
	      `INSERT OR IGNORE INTO spending_alerts (id, organization_id, type, threshold, threshold_type, action, notify_emails, is_active)
	       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
	      [uuid(51), uuid(101), 'usage', 80, 'percentage', 'notify', JSON.stringify(['a@example.com'])]
	    );

	    await dbRun(
	      `INSERT OR IGNORE INTO usage_records (id, organization_id, metric_name, quantity, metadata, recorded_at)
	       VALUES (?, ?, ?, ?, ?, datetime('now', '-1 day'))`,
	      [uuid(301), uuid(101), 'tokens', 123, JSON.stringify({})]
	    );
	    await dbRun(
	      `INSERT OR IGNORE INTO usage_records (id, organization_id, metric_name, quantity, metadata, recorded_at)
	       VALUES (?, ?, ?, ?, ?, datetime('now', '-2 day'))`,
	      [uuid(302), uuid(101), 'storage_gb', 2, JSON.stringify({})]
	    );
	    await dbRun(
	      `INSERT OR IGNORE INTO usage_records (id, organization_id, metric_name, quantity, metadata, recorded_at)
	       VALUES (?, ?, ?, ?, ?, datetime('now', '-3 day'))`,
	      [uuid(303), uuid(101), 'spend_usd', 50, JSON.stringify({})]
	    );

    await dbRun(
      `INSERT OR IGNORE INTO payment_methods (id, organization_id, stripe_payment_method_id, type, brand, last4, exp_month, exp_year, holder_name, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(61), uuid(101), 'pm_1', 'card', 'visa', '4242', 1, 2030, 'Test', 1]
    );

    await dbRun(
      `INSERT OR IGNORE INTO billing_tax_settings (id, organization_id, tax_id, tax_id_type, tax_exempt, billing_name, billing_email, billing_country, invoice_prefix)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(71), uuid(101), 'TAX123', 'VAT', 0, 'Org A', 'billing@orga.test', 'US', 'INV']
    );

    await dbRun(
      `INSERT OR IGNORE INTO tax_rates (id, display_name, jurisdiction, percentage, tax_type, country, region, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [uuid(81), 'US Sales', 'US', 7.5, 'sales', 'US', 'CA']
    );

    await dbRun(
      `INSERT OR IGNORE INTO vat_validations (id, vat_number, country_code, is_valid, company_name, company_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuid(91), 'EU123', 'DE', 1, 'ACME GmbH', 'Berlin']
    );
    await dbRun(
      `UPDATE vat_validations
       SET validation_source = 'cache', expires_at = datetime('now', '+1 day')
       WHERE id = ?`,
      [uuid(91)]
    );

	    await dbRun(
	      `INSERT OR IGNORE INTO invoice_templates (id, organization_id, name, description, template_type, layout_type, is_default, is_system)
	       VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
	      [uuid(1011), uuid(101), 'Default', 'Default', 'standard', 'classic']
	    );

	    await dbRun(
	      `INSERT OR IGNORE INTO billing_addons (id, name, description, is_active)
	       VALUES (?, ?, ?, 1)`,
	      [uuid(1511), 'Advanced seats', 'Seat overage add-on']
	    );

	    await dbRun(
	      `INSERT OR IGNORE INTO revenue_forecasts (id, organization_id, forecast_type, forecast_date, period_start, period_end, revenue_amount, confidence_level, assumptions)
	       VALUES (?, ?, ?, date('now'), date('now'), date('now','+30 day'), ?, ?, ?)`,
	      [uuid(111), uuid(101), 'manual', 1234, 0.8, JSON.stringify({ note: 'test' })]
	    );
	    await dbRun(
	      `UPDATE revenue_forecasts
	       SET scenario = 'baseline', accuracy = 0.8
	       WHERE id = ?`,
	      [uuid(111)]
	    );

	    await dbRun(
	      `INSERT OR IGNORE INTO revenue_recognition (id, organization_id, invoice_id, total_amount, recognized_amount, recognition_method, start_date, end_date, status, schedule)
	       VALUES (?, ?, ?, ?, ?, ?, date('now','-10 day'), date('now','+20 day'), ?, ?)`,
	      [uuid(121), uuid(101), uuid(31), 100, 10, 'straight_line', 'active', JSON.stringify([])]
	    );
	    await dbRun(
	      `UPDATE revenue_recognition
	       SET recognition_date = datetime('now', '+1 day'), description = 'Init'
	       WHERE id = ?`,
	      [uuid(121)]
	    );

    await dbRun(
      `INSERT OR IGNORE INTO subscription_changes (id, organization_id, subscription_id, change_type, from_plan_id, to_plan_id, status, requested_by, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(131), uuid(101), uuid(11), 'upgrade', uuid(1), uuid(2), 'pending', ownerUser.id, JSON.stringify({})]
    );

    await dbRun(
      `INSERT OR IGNORE INTO billing_webhook_events (id, organization_id, event_type, payload, status, target_url, attempt_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid(141), uuid(101), 'invoice.paid', JSON.stringify({ ok: true }), 'failed', 'https://example.com', 1]
    );
  });

  afterAll(async () => {
    await resetConnection?.();
    delete (global as any).__TEST_DB_MOCK__;
    delete (process as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__;
    delete (globalThis as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__;
  });

  it('covers analytics endpoints', async () => {
    const app = await makeApp();

    const mrr = await dispatch(app, { method: 'GET', url: '/api/billing/analytics/mrr', user: superAdminUser });
    expect(mrr.status).toBe(200);
    expect(mrr.body.mrr).toEqual(
      expect.objectContaining({
        totalMRR: expect.any(Number),
        arr: expect.any(Number),
        activeSubscriptions: expect.any(Number),
        byPlan: expect.any(Array),
      })
    );

    const trend = await dispatch(app, {
      method: 'GET',
      url: '/api/billing/analytics/mrr/trend',
      user: superAdminUser,
      query: { days: '7' },
    });
    expect(trend.status).toBe(200);
    expect(trend.body.trend.summary).toEqual(
      expect.objectContaining({ startMRR: expect.any(Number), endMRR: expect.any(Number) })
    );

    const churn = await dispatch(app, { method: 'GET', url: '/api/billing/analytics/churn', user: superAdminUser });
    expect(churn.status).toBe(200);

    const ltv = await dispatch(app, { method: 'GET', url: '/api/billing/analytics/ltv', user: superAdminUser });
    expect(ltv.status).toBe(200);

    const cohorts = await dispatch(app, { method: 'GET', url: '/api/billing/analytics/cohorts', user: superAdminUser });
    expect(cohorts.status).toBe(200);

    const expansion = await dispatch(app, { method: 'GET', url: '/api/billing/analytics/expansion', user: superAdminUser });
    expect(expansion.status).toBe(200);
  });

  it('covers admin mocks + placeholder admin endpoints', async () => {
    const app = await makeApp();

    const revenue = await dispatch(app, { method: 'GET', url: '/api/billing/admin/revenue', user: superAdminUser });
    expect(revenue.status).toBe(200);

    const usage = await dispatch(app, { method: 'GET', url: '/api/billing/admin/usage', user: superAdminUser });
    expect(usage.status).toBe(200);

    const costs = await dispatch(app, {
      method: 'GET',
      url: '/api/billing/admin/operational-costs',
      user: superAdminUser,
    });
    expect(costs.status).toBe(200);

    const userPlans = await dispatch(app, { method: 'GET', url: '/api/billing/admin/user-plans', user: superAdminUser });
    expect(userPlans.status).toBe(503);

    const userPlansCreate = await dispatch(app, { method: 'POST', url: '/api/billing/admin/user-plans', user: superAdminUser, body: {} });
    expect(userPlansCreate.status).toBe(503);

    const userPlansUpdate = await dispatch(app, { method: 'PUT', url: `/api/billing/admin/user-plans/${uuid(999)}`, user: superAdminUser, body: {} });
    expect(userPlansUpdate.status).toBe(503);

    const userPlansDelete = await dispatch(app, { method: 'DELETE', url: `/api/billing/admin/user-plans/${uuid(999)}`, user: superAdminUser });
    expect(userPlansDelete.status).toBe(503);

    const tx = await dispatch(app, { method: 'GET', url: '/api/billing/admin/transactions', user: superAdminUser });
    expect(tx.status).toBe(503);
  });

  it('covers billing stats', async () => {
    const app = await makeApp();
    const res = await dispatch(app, { method: 'GET', url: '/api/billing/stats', user: superAdminUser, query: { period: '30' } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        mrr: expect.any(Number),
        arr: expect.any(Number),
        revenue: expect.any(Object),
        subscriptions: expect.any(Object),
        unpaidInvoices: expect.any(Object),
      })
    );
  });

  it('covers invoice list/get/update/create/send/pdf flows + access control', async () => {
    const app = await makeApp();

    const listAsOwner = await dispatch(app, {
      method: 'GET',
      url: '/api/billing/invoices',
      user: ownerUser,
      query: { page: '1', pageSize: '20' },
    });
    expect(listAsOwner.status).toBe(200);
    expect(listAsOwner.body).toEqual(expect.objectContaining({ invoices: expect.any(Array) }));

    const listAsSuper = await dispatch(app, {
      method: 'GET',
      url: '/api/billing/invoices',
      user: superAdminUser,
      query: { organizationId: uuid(101), page: '1', pageSize: '20' },
    });
    expect(listAsSuper.status).toBe(200);

    const get = await dispatch(app, { method: 'GET', url: `/api/billing/invoices/${uuid(31)}`, user: ownerUser });
    expect(get.status).toBe(200);
    expect(get.body.invoice).toEqual(expect.objectContaining({ id: uuid(31) }));

    const getNotFound = await dispatch(app, { method: 'GET', url: `/api/billing/invoices/${uuid(999)}`, user: ownerUser });
    expect(getNotFound.status).toBe(404);

    const getDenied = await dispatch(app, { method: 'GET', url: `/api/billing/invoices/${uuid(31)}`, user: otherOrgUser });
    expect([403, 404]).toContain(getDenied.status);

    const pdfStripe = await dispatch(app, { method: 'GET', url: `/api/billing/invoices/${uuid(33)}/pdf`, user: ownerUser });
    expect([200, 302]).toContain(pdfStripe.status);
    expect(pdfStripe.redirectedTo).toBe('https://stripe.com/invoice.pdf');

    const create = await dispatch(app, {
      method: 'POST',
      url: '/api/billing/invoices',
      user: superAdminUser,
      body: {
        organizationId: uuid(101),
        currency: 'USD',
        lineItems: [{ description: 'Item', amount: 10, quantity: 1 }],
      },
    });
    expect(create.status).toBe(201);
    expect(create.body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));

    const updateNoop = await dispatch(app, { method: 'PUT', url: `/api/billing/invoices/${uuid(31)}`, user: superAdminUser, body: {} });
    expect(updateNoop.status).toBe(400);

	    const updatePaid = await dispatch(app, {
	      method: 'PUT',
	      url: `/api/billing/invoices/${uuid(32)}`,
	      user: superAdminUser,
	      body: { status: 'paid' },
	    });
	    expect(updatePaid.status).toBe(200);
    const paidRow = await dbGet<any>(`SELECT status, amount_due, amount_paid FROM invoices WHERE id = ?`, [uuid(32)]);
    expect(paidRow?.status).toBe('paid');
	    expect(Number(paidRow?.amount_due || 0)).toBe(0);
	    expect(Number(paidRow?.amount_paid || 0)).toBeGreaterThanOrEqual(0);

	    const updateLineItems = await dispatch(app, {
	      method: 'PUT',
	      url: `/api/billing/invoices/${uuid(31)}`,
	      user: superAdminUser,
	      body: {
	        lineItems: [
	          { description: 'A', amount: 10, quantity: 1 },
	          { description: 'B', amount: 5, quantity: 1 },
	        ],
	      },
	    });
	    expect(updateLineItems.status).toBe(200);
	    const updatedInvoice = await dbGet<any>(`SELECT subtotal, total FROM invoices WHERE id = ?`, [uuid(31)]);
	    expect(Number(updatedInvoice?.subtotal || 0)).toBeGreaterThan(0);

	    const sendInvoice = await dispatch(app, { method: 'POST', url: `/api/billing/invoices/${uuid(31)}/send`, user: superAdminUser });
	    expect(sendInvoice.status).toBe(200);
	  });

	  it('covers subscription self-serve + admin subscription CRUD', async () => {
	    const app = await makeApp();

	    const current = await dispatch(app, { method: 'GET', url: '/api/billing/current', user: ownerUser });
	    expect(current.status).toBe(200);

	    await dbRun(
	      `INSERT INTO organization_billing (id, organization_id, subscription_plan_id, status)
	       VALUES (?, ?, NULL, 'inactive')
	       ON CONFLICT(organization_id) DO UPDATE SET
	         subscription_plan_id = NULL,
	         status = 'inactive',
	         updated_at = datetime('now')`,
	      [uuid(2021), uuid(101)]
	    );
	    const currentFallback = await dispatch(app, { method: 'GET', url: '/api/billing/current', user: ownerUser });
	    expect(currentFallback.status).toBe(200);
	    expect(currentFallback.body?.billing?.subscription_plan_id ?? null).toBeNull();

	    const plans = await dispatch(app, { method: 'GET', url: '/api/billing/plans', user: ownerUser, query: { includeInactive: 'true' } });
	    expect(plans.status).toBe(200);
	    expect(plans.body).toEqual(expect.objectContaining({ plans: expect.any(Array) }));

	    const getSub = await dispatch(app, { method: 'GET', url: '/api/billing/subscription', user: ownerUser });
	    expect(getSub.status).toBe(200);
	    expect(getSub.body).toHaveProperty('data');

	    await dbRun(
	      `INSERT INTO organization_billing (id, organization_id, subscription_plan_id, status, current_period_end)
	       VALUES (?, ?, ?, 'active', datetime('now', '+30 day'))
	       ON CONFLICT(organization_id) DO UPDATE SET
	         subscription_plan_id = excluded.subscription_plan_id,
	         status = excluded.status,
	         current_period_end = excluded.current_period_end,
	         updated_at = datetime('now')`,
	      [uuid(2022), uuid(101), uuid(1)]
	    );
	    const getSubWithPlan = await dispatch(app, { method: 'GET', url: '/api/billing/subscription', user: ownerUser });
	    expect(getSubWithPlan.status).toBe(200);
	    expect(getSubWithPlan.body).toEqual(
	      expect.objectContaining({
	        data: expect.objectContaining({
	          plan: uuid(1),
	          planName: expect.any(String),
	        }),
	      })
	    );

    const getUsage = await dispatch(app, { method: 'GET', url: '/api/billing/usage', user: ownerUser });
    expect(getUsage.status).toBe(200);

    const subscribe = await dispatch(app, { method: 'POST', url: '/api/billing/subscribe', user: ownerUser, body: { planId: uuid(1) } });
    expect(subscribe.status).toBe(200);

    const change = await dispatch(app, { method: 'POST', url: '/api/billing/change-plan', user: ownerUser, body: { newPlanId: uuid(2) } });
    expect(change.status).toBe(200);

    const cancel = await dispatch(app, { method: 'POST', url: '/api/billing/cancel', user: ownerUser, body: { immediately: false } });
    expect(cancel.status).toBe(200);

    const list = await dispatch(app, { method: 'GET', url: '/api/billing/subscriptions', user: superAdminUser, query: { page: '1', pageSize: '20' } });
    expect(list.status).toBe(200);
    expect(list.body).toEqual(expect.objectContaining({ subscriptions: expect.any(Array) }));

	    const create = await dispatch(app, {
	      method: 'POST',
	      url: '/api/billing/subscriptions',
	      user: superAdminUser,
	      body: { organizationId: uuid(202), planId: uuid(1), billingCycle: 'monthly', trialDays: 0 },
	    });
    expect(create.status).toBe(200);
    const createdId = create.body?.id as string;
    expect(createdId).toBeTruthy();

    const get = await dispatch(app, { method: 'GET', url: `/api/billing/subscriptions/${createdId}`, user: superAdminUser });
    expect(get.status).toBe(200);
    expect(get.body.subscription).toEqual(expect.objectContaining({ id: createdId }));

    const update = await dispatch(app, { method: 'PUT', url: `/api/billing/subscriptions/${createdId}`, user: superAdminUser, body: { cancelAtPeriodEnd: true } });
    expect(update.status).toBe(200);

	    const cancelSub = await dispatch(app, { method: 'POST', url: `/api/billing/subscriptions/${createdId}/cancel`, user: superAdminUser, body: { immediately: true } });
	    expect(cancelSub.status).toBe(200);

	    const cancelAtPeriodEnd = await dispatch(app, {
	      method: 'POST',
	      url: `/api/billing/subscriptions/${createdId}/cancel`,
	      user: superAdminUser,
	      body: { immediately: false },
	    });
	    expect(cancelAtPeriodEnd.status).toBe(200);
	  });

	  it('covers plan admin CRUD via /plans and /admin/plans', async () => {
	    const app = await makeApp();

    const listAdmin = await dispatch(app, { method: 'GET', url: '/api/billing/admin/plans', user: superAdminUser });
    expect(listAdmin.status).toBe(200);

    const create = await dispatch(app, {
      method: 'POST',
      url: '/api/billing/admin/plans',
      user: superAdminUser,
      body: {
        name: 'Enterprise',
        description: 'Ent',
        priceMonthly: 99,
        priceYearly: 999,
        currency: 'USD',
        features: ['x'],
        limits: { seats: 100 },
        trialDays: 0,
        isPublic: true,
        sortOrder: 3,
      },
    });
    expect(create.status).toBe(200);
    const createdPlanId = create.body?.id as string;
    expect(createdPlanId).toBeTruthy();

    const updateNoop = await dispatch(app, { method: 'PUT', url: `/api/billing/admin/plans/${createdPlanId}`, user: superAdminUser, body: {} });
    expect(updateNoop.status).toBe(400);

    const update = await dispatch(app, {
      method: 'PUT',
      url: `/api/billing/admin/plans/${createdPlanId}`,
      user: superAdminUser,
      body: { description: 'Updated', features: ['x', 'y'], limits: { seats: 200 } },
    });
    expect(update.status).toBe(200);

    const delMissing = await dispatch(app, { method: 'DELETE', url: `/api/billing/admin/plans/${uuid(999)}`, user: superAdminUser });
    expect(delMissing.status).toBe(404);

    const del = await dispatch(app, { method: 'DELETE', url: `/api/billing/admin/plans/${createdPlanId}`, user: superAdminUser });
    expect(del.status).toBe(200);

	    const listPublic = await dispatch(app, { method: 'GET', url: '/api/billing/plans', user: ownerUser, query: { includeInactive: 'false' } });
	    expect(listPublic.status).toBe(200);

	    const createPublic = await dispatch(app, {
	      method: 'POST',
	      url: '/api/billing/plans',
	      user: superAdminUser,
	      body: {
	        name: 'Team',
	        description: 'Team plan',
	        priceMonthly: 15,
	        priceYearly: 150,
	        currency: 'USD',
	        features: ['f1'],
	        limits: { seats: 5 },
	        trialDays: 0,
	        isPublic: true,
	        sortOrder: 3,
	      },
	    });
	    expect(createPublic.status).toBe(200);
	    const createdPublicId = createPublic.body?.id as string;
	    expect(createdPublicId).toBeTruthy();

	    const updatePublicNoop = await dispatch(app, {
	      method: 'PUT',
	      url: `/api/billing/plans/${createdPublicId}`,
	      user: superAdminUser,
	      body: {},
	    });
	    expect(updatePublicNoop.status).toBe(400);

	    const updatePublic = await dispatch(app, {
	      method: 'PUT',
	      url: `/api/billing/plans/${createdPublicId}`,
	      user: superAdminUser,
	      body: { description: 'Updated', features: ['f1', 'f2'], limits: { seats: 6 } },
	    });
	    expect(updatePublic.status).toBe(200);
	  });

  it('covers credit notes endpoints', async () => {
    const app = await makeApp();

    const list = await dispatch(app, { method: 'GET', url: '/api/billing/credit-notes', user: ownerUser });
    expect(list.status).toBe(200);

    const create = await dispatch(app, {
      method: 'POST',
      url: '/api/billing/credit-notes',
      user: superAdminUser,
      body: { organizationId: uuid(101), amount: 10, reason: 'Test', invoiceId: uuid(31) },
    });
    expect(create.status).toBe(200);

    const adminList = await dispatch(app, { method: 'GET', url: '/api/billing/admin/credit-notes', user: superAdminUser });
    expect(adminList.status).toBe(200);

	    const adminStats = await dispatch(app, { method: 'GET', url: '/api/billing/admin/credit-notes/stats', user: superAdminUser });
	    expect(adminStats.status).toBe(200);

	    const applyMissingInvoice = await dispatch(app, {
	      method: 'POST',
	      url: `/api/billing/credit-notes/${uuid(41)}/apply`,
	      user: superAdminUser,
	      body: { invoiceId: uuid(999), amount: 5 },
	    });
	    expect(applyMissingInvoice.status).toBe(404);

	    const apply = await dispatch(app, {
	      method: 'POST',
	      url: `/api/billing/credit-notes/${uuid(41)}/apply`,
	      user: superAdminUser,
	      body: { invoiceId: uuid(32), amount: 5 },
	    });
	    expect(apply.status).toBe(200);
	    expect(apply.body).toEqual(
	      expect.objectContaining({
	        success: true,
	        amountApplied: 5,
	      })
	    );

	    const refund = await dispatch(app, {
	      method: 'POST',
	      url: `/api/billing/credit-notes/${uuid(41)}/refund`,
	      user: superAdminUser,
	      body: { amount: 15, refundMethod: 'manual', notes: 'Refund remaining' },
	    });
	    expect(refund.status).toBe(200);

	    const applyAfterRefund = await dispatch(app, {
	      method: 'POST',
	      url: `/api/billing/credit-notes/${uuid(41)}/apply`,
	      user: superAdminUser,
	      body: { invoiceId: uuid(32), amount: 1 },
	    });
	    expect(applyAfterRefund.status).toBe(400);

	    const voidNote = await dispatch(app, {
	      method: 'POST',
	      url: `/api/billing/credit-notes/${uuid(42)}/void`,
	      user: superAdminUser,
	      body: { reason: 'Test void' },
	    });
	    expect(voidNote.status).toBe(200);

	    const applyVoided = await dispatch(app, {
	      method: 'POST',
	      url: `/api/billing/credit-notes/${uuid(42)}/apply`,
	      user: superAdminUser,
	      body: { invoiceId: uuid(32), amount: 1 },
	    });
	    expect(applyVoided.status).toBe(400);
	  });

	  it('covers payment methods endpoints', async () => {
	    const app = await makeApp();

	    const list = await dispatch(app, { method: 'GET', url: '/api/billing/payment-methods', user: ownerUser });
	    expect(list.status).toBe(200);

	    const prevStripe = {
	      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
	      STRIPE_API_KEY: process.env.STRIPE_API_KEY,
	      STRIPE_SECRET: process.env.STRIPE_SECRET,
	      STRIPE_KEY: process.env.STRIPE_KEY,
	    };
	    delete process.env.STRIPE_SECRET_KEY;
	    delete process.env.STRIPE_API_KEY;
	    delete process.env.STRIPE_SECRET;
	    delete process.env.STRIPE_KEY;
	    const setupIntentNoStripe = await dispatch(app, { method: 'POST', url: '/api/billing/setup-intent', user: ownerUser });
	    expect(setupIntentNoStripe.status).toBe(503);
	    process.env.STRIPE_SECRET_KEY = prevStripe.STRIPE_SECRET_KEY;
	    process.env.STRIPE_API_KEY = prevStripe.STRIPE_API_KEY;
	    process.env.STRIPE_SECRET = prevStripe.STRIPE_SECRET;
	    process.env.STRIPE_KEY = prevStripe.STRIPE_KEY;

	    const setupIntent = await dispatch(app, { method: 'POST', url: '/api/billing/setup-intent', user: ownerUser });
	    expect(setupIntent.status).toBe(200);

	    const create = await dispatch(app, { method: 'POST', url: '/api/billing/payment-methods', user: ownerUser, body: { paymentMethodId: 'pm_2' } });
	    expect(create.status).toBe(201);

    const makeDefaultPut = await dispatch(app, { method: 'PUT', url: `/api/billing/payment-methods/${uuid(61)}/default`, user: ownerUser });
    expect(makeDefaultPut.status).toBe(200);

    const makeDefaultPost = await dispatch(app, { method: 'POST', url: `/api/billing/payment-methods/${uuid(61)}/default`, user: ownerUser });
    expect(makeDefaultPost.status).toBe(200);

    const del = await dispatch(app, { method: 'DELETE', url: `/api/billing/payment-methods/${uuid(61)}`, user: ownerUser });
    expect(del.status).toBe(400);
  });

	  it('covers usage endpoints (record + list + summary)', async () => {
	    const app = await makeApp();

	    const record = await dispatch(app, { method: 'POST', url: '/api/billing/usage', user: ownerUser, body: { metricName: 'tokens', quantity: 5 } });
	    expect(record.status).toBe(200);
	    expect(record.body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));

	    const list = await dispatch(app, { method: 'GET', url: '/api/billing/usage-records', user: superAdminUser, query: { organizationId: uuid(101) } });
	    expect(list.status).toBe(200);
	    expect(list.body).toEqual(expect.objectContaining({ usage: expect.any(Array), structuredUsage: expect.any(Object) }));

	    const summary = await dispatch(app, { method: 'GET', url: '/api/billing/usage-summary', user: superAdminUser, query: { organizationId: uuid(101) } });
	    expect(summary.status).toBe(200);
	  });

	  it('covers spending alerts CRUD + toggles', async () => {
	    const app = await makeApp();

    const list = await dispatch(app, { method: 'GET', url: '/api/billing/spending-alerts', user: ownerUser });
    expect(list.status).toBe(200);

    const create = await dispatch(app, {
      method: 'POST',
      url: '/api/billing/spending-alerts',
      user: ownerUser,
      body: {
        type: 'usage',
        threshold: 90,
        thresholdType: 'percentage',
        action: 'notify',
        notifyEmails: ['x@example.com'],
        isActive: true,
      },
    });
    expect(create.status).toBe(200);

    const update = await dispatch(app, {
      method: 'PUT',
      url: `/api/billing/spending-alerts/${uuid(51)}`,
      user: ownerUser,
      body: { threshold: 95 },
    });
    expect(update.status).toBe(200);

	    const toggle = await dispatch(app, {
	      method: 'POST',
	      url: `/api/billing/spending-alerts/${uuid(51)}/toggle`,
	      user: ownerUser,
	      body: { enabled: false },
	    });
	    expect(toggle.status).toBe(200);

	    const del = await dispatch(app, { method: 'DELETE', url: `/api/billing/spending-alerts/${uuid(51)}`, user: ownerUser });
	    expect(del.status).toBe(200);
	  });

	  it('covers tax settings + tax rates + VAT validation', async () => {
	    const app = await makeApp();

	    const getTax = await dispatch(app, { method: 'GET', url: '/api/billing/tax-settings', user: ownerUser });
	    expect(getTax.status).toBe(200);

	    await dbRun(`DELETE FROM billing_tax_settings WHERE organization_id = ?`, [uuid(101)]);
	    const getTaxMissing = await dispatch(app, { method: 'GET', url: '/api/billing/tax-settings', user: ownerUser });
	    expect(getTaxMissing.status).toBe(200);
	    expect(getTaxMissing.body).toEqual(
	      expect.objectContaining({
	        company: expect.objectContaining({ legalName: null, billingEmail: null }),
	        tax: expect.objectContaining({ taxIdType: null, taxId: null, taxExempt: false }),
	      })
	    );

	    const putTax = await dispatch(app, {
	      method: 'PUT',
	      url: '/api/billing/tax-settings',
	      user: ownerUser,
      body: {
        company: { legalName: 'Org A', billingEmail: 'billing@orga.test' },
        tax: { taxIdType: 'VAT', taxId: 'TAX', taxExempt: false },
        address: { line1: 'Line', city: 'City', country: 'US' },
        invoicePrefix: 'INV',
        poNumber: 'PO-1',
      },
    });
    expect(putTax.status).toBe(200);

    const listRates = await dispatch(app, { method: 'GET', url: '/api/billing/tax/rates', user: ownerUser, query: { country: 'US' } });
    expect(listRates.status).toBe(200);

    const listLegacyRates = await dispatch(app, { method: 'GET', url: '/api/billing/tax-rates', user: ownerUser, query: { country: 'US' } });
    expect(listLegacyRates.status).toBe(200);

    const createRate = await dispatch(app, { method: 'POST', url: '/api/billing/tax-rates', user: superAdminUser, body: { displayName: 'EU VAT', jurisdiction: 'EU', percentage: 20, taxType: 'vat', country: 'DE', region: 'BE', isActive: true } });
    expect(createRate.status).toBe(200);

    const adminCreateRate = await dispatch(app, { method: 'POST', url: '/api/billing/admin/tax/rates', user: superAdminUser, body: { displayName: 'Admin VAT', jurisdiction: 'EU', percentage: 21, taxType: 'vat', country: 'DE', region: 'BW' } });
    expect(adminCreateRate.status).toBe(200);
    const adminRateId = adminCreateRate.body?.id as string | undefined;
    if (adminRateId) {
      const adminUpdate = await dispatch(app, { method: 'PUT', url: `/api/billing/admin/tax/rates/${adminRateId}`, user: superAdminUser, body: { isActive: false } });
      expect(adminUpdate.status).toBe(200);
      const adminDelete = await dispatch(app, { method: 'DELETE', url: `/api/billing/admin/tax/rates/${adminRateId}`, user: superAdminUser });
      expect(adminDelete.status).toBe(200);
    }

    const validateVat = await dispatch(app, { method: 'POST', url: '/api/billing/tax/validate-vat', user: ownerUser, body: { vatNumber: 'EU123', countryCode: 'DE' } });
    expect(validateVat.status).toBe(200);

    const calc = await dispatch(app, { method: 'POST', url: '/api/billing/tax/calculate', user: ownerUser, body: { amount: 100, currency: 'USD', country: 'US', taxIdNumber: '' } });
    expect(calc.status).toBe(200);
  });

  it(
    'covers invoice templates endpoints',
    async () => {
    const app = await makeApp();

    const list = await dispatch(app, { method: 'GET', url: '/api/billing/templates', user: ownerUser });
    expect(list.status).toBe(200);

    const listLegacy = await dispatch(app, { method: 'GET', url: '/api/billing/invoice-templates', user: ownerUser });
    expect(listLegacy.status).toBe(200);

    const previewMissing = await dispatch(app, { method: 'GET', url: `/api/billing/templates/${uuid(9999)}/preview`, user: ownerUser });
    expect(previewMissing.status).toBe(404);

    const preview = await dispatch(app, { method: 'GET', url: `/api/billing/templates/${uuid(1011)}/preview`, user: ownerUser });
    expect(preview.status).toBe(200);

    const create = await dispatch(app, { method: 'POST', url: '/api/billing/templates', user: ownerUser, body: { name: 'T1', templateType: 'standard', layoutType: 'classic' } });
    expect(create.status).toBe(200);
    const createdId = create.body?.id as string | undefined;

    const createLegacy = await dispatch(app, { method: 'POST', url: '/api/billing/invoice-templates', user: ownerUser, body: { name: 'Legacy', templateType: 'standard', layoutType: 'classic' } });
    expect(createLegacy.status).toBe(200);

    if (createdId) {
      const update = await dispatch(app, { method: 'PUT', url: `/api/billing/templates/${createdId}`, user: ownerUser, body: { name: 'Updated', isDefault: true } });
      expect(update.status).toBe(200);

      const clone = await dispatch(app, { method: 'POST', url: `/api/billing/templates/${createdId}/clone`, user: ownerUser, body: { name: 'Clone' } });
      expect(clone.status).toBe(200);

      const del = await dispatch(app, { method: 'DELETE', url: `/api/billing/templates/${createdId}`, user: ownerUser });
      expect(del.status).toBe(200);
    }
    },
    120_000
  );

	  it('covers revenue forecasts + revenue recognition endpoints (both legacy and new paths)', async () => {
	    const app = await makeApp();

    const listForecasts = await dispatch(app, { method: 'GET', url: '/api/billing/revenue-forecasts', user: superAdminUser });
    expect(listForecasts.status).toBe(200);

    const statsForecasts = await dispatch(app, { method: 'GET', url: '/api/billing/revenue-forecasts/stats', user: superAdminUser });
    expect(statsForecasts.status).toBe(200);

    const generateForecasts = await dispatch(app, { method: 'POST', url: '/api/billing/revenue-forecasts/generate', user: superAdminUser, body: { periodDays: 30 } });
    expect(generateForecasts.status).toBe(200);

    const deleteForecastMissing = await dispatch(app, { method: 'DELETE', url: `/api/billing/revenue-forecasts/${uuid(999)}`, user: superAdminUser });
    expect(deleteForecastMissing.status).toBe(404);

    const listRecog = await dispatch(app, { method: 'GET', url: '/api/billing/revenue-recognitions', user: superAdminUser });
    expect(listRecog.status).toBe(200);

    const statsRecog = await dispatch(app, { method: 'GET', url: '/api/billing/revenue-recognitions/stats', user: superAdminUser });
    expect(statsRecog.status).toBe(200);

    const schedule = await dispatch(app, { method: 'GET', url: `/api/billing/revenue-recognitions/${uuid(121)}/schedule`, user: superAdminUser });
    expect(schedule.status).toBe(200);

    const recognize = await dispatch(app, { method: 'POST', url: `/api/billing/revenue-recognitions/${uuid(121)}/recognize`, user: superAdminUser, body: { amount: 5 } });
    expect(recognize.status).toBe(200);

    const legacyList = await dispatch(app, { method: 'GET', url: '/api/billing/revenue-recognition', user: superAdminUser });
    expect(legacyList.status).toBe(200);

    const legacyStats = await dispatch(app, { method: 'GET', url: '/api/billing/revenue-recognition/stats', user: superAdminUser });
    expect(legacyStats.status).toBe(200);

	    const legacyForecastList = await dispatch(app, { method: 'GET', url: '/api/billing/revenue-forecast', user: superAdminUser });
	    expect(legacyForecastList.status).toBe(200);

	    const legacyForecastStats = await dispatch(app, { method: 'GET', url: '/api/billing/revenue-forecast/stats', user: superAdminUser });
	    expect(legacyForecastStats.status).toBe(200);

	    const legacyForecastGenerate = await dispatch(app, {
	      method: 'POST',
	      url: '/api/billing/revenue-forecast/generate',
	      user: superAdminUser,
	      body: { scenario: 'baseline', months: 2, assumptions: { growthRate: 0.1, churnRate: 0.01 } },
	    });
	    expect(legacyForecastGenerate.status).toBe(200);

	    if (legacyForecastGenerate.status === 200) {
	      const id = legacyForecastGenerate.body?.id as string;
	      expect(id).toBeTruthy();
	      const del = await dispatch(app, { method: 'DELETE', url: `/api/billing/revenue-forecast/${id}`, user: superAdminUser });
	      expect(del.status).toBe(200);
	    }

	    const legacyCreateRec = await dispatch(app, {
	      method: 'POST',
	      url: '/api/billing/revenue-recognition',
	      user: superAdminUser,
	      body: { organization_id: uuid(101), invoice_id: uuid(31), amount: 10, recognition_date: new Date().toISOString(), description: 'Test' },
	    });
	    expect(legacyCreateRec.status).toBe(200);

	    const legacyRecognize = await dispatch(app, { method: 'POST', url: `/api/billing/revenue-recognition/${uuid(121)}/recognize`, user: superAdminUser });
	    expect(legacyRecognize.status).toBe(200);
	  });

	  it('covers billing alerts + addons endpoints', async () => {
	    const app = await makeApp();

	    const addons = await dispatch(app, { method: 'GET', url: '/api/billing/addons', user: ownerUser });
	    expect(addons.status).toBe(200);

	    const getAlerts = await dispatch(app, { method: 'GET', url: '/api/billing/alerts', user: ownerUser });
	    expect(getAlerts.status).toBe(200);
	    if (getAlerts.status === 200) {
	      expect(getAlerts.body).toEqual(expect.objectContaining({ alerts: expect.any(Array) }));
	    }

	    const putAlerts = await dispatch(app, {
	      method: 'PUT',
	      url: '/api/billing/alerts',
	      user: ownerUser,
	      body: { alerts: [{ type: 'tokens' }, { type: 'spend', threshold: 90 }] },
	    });
	    expect(putAlerts.status).toBe(200);
	  });

  it('covers webhook events endpoints + retry/pending/failed admin endpoints', async () => {
    const app = await makeApp();

    const types = await dispatch(app, { method: 'GET', url: '/api/billing/webhook-event-types', user: ownerUser });
    expect(types.status).toBe(200);

    const listDenied = await dispatch(app, { method: 'GET', url: '/api/billing/webhook-events', user: { ...ownerUser, role: 'guest' } });
    expect(listDenied.status).toBe(403);

    const list = await dispatch(app, { method: 'GET', url: '/api/billing/webhook-events', user: ownerUser, query: { limit: '10' } });
    expect(list.status).toBe(200);

    const stats = await dispatch(app, { method: 'GET', url: '/api/billing/webhook-events/stats', user: ownerUser, query: { period: '30 days' } });
    expect(stats.status).toBe(200);

    const getBadId = await dispatch(app, { method: 'GET', url: '/api/billing/webhook-events/not-a-uuid', user: ownerUser });
    expect(getBadId.status).toBe(400);

    const getOk = await dispatch(app, { method: 'GET', url: `/api/billing/webhook-events/${uuid(141)}`, user: ownerUser });
    expect(getOk.status).toBe(200);

    const retry = await dispatch(app, { method: 'POST', url: `/api/billing/admin/webhook-events/${uuid(141)}/retry`, user: superAdminUser });
    expect(retry.status).toBe(200);

    const failed = await dispatch(app, { method: 'GET', url: '/api/billing/admin/webhook-events/failed', user: superAdminUser, query: { limit: '10' } });
    expect(failed.status).toBe(200);

    const pending = await dispatch(app, { method: 'GET', url: '/api/billing/admin/webhook-events/pending', user: superAdminUser, query: { limit: '10' } });
    expect(pending.status).toBe(200);
  });

	  it('covers subscription changes endpoints (approve/reject + stats)', async () => {
	    const app = await makeApp();

	    const list = await dispatch(app, { method: 'GET', url: '/api/billing/subscription-changes', user: superAdminUser });
	    expect(list.status).toBe(200);

	    const stats = await dispatch(app, { method: 'GET', url: '/api/billing/subscription-changes/stats', user: superAdminUser });
	    expect(stats.status).toBe(200);
	    expect(stats.body).toEqual(
	      expect.objectContaining({
	        total: expect.any(Number),
	        pending: expect.any(Number),
	      })
	    );

	    const approve = await dispatch(app, { method: 'POST', url: `/api/billing/subscription-changes/${uuid(131)}/approve`, user: superAdminUser });
	    expect(approve.status).toBe(200);

	    const reject = await dispatch(app, { method: 'POST', url: `/api/billing/subscription-changes/${uuid(131)}/reject`, user: superAdminUser, body: { reason: 'no' } });
	    expect(reject.status).toBe(200);
	  });

  it('covers grace-period + reactivate endpoints', async () => {
    const app = await makeApp();

    await dbRun(
      `INSERT INTO organization_billing (id, organization_id, subscription_plan_id, status, current_period_end)
       VALUES (?, ?, ?, ?, datetime('now', '+7 days'))
       ON CONFLICT(organization_id) DO UPDATE SET
         subscription_plan_id = excluded.subscription_plan_id,
         status = excluded.status,
         current_period_end = excluded.current_period_end,
         updated_at = datetime('now')`,
      [uuid(201), uuid(101), uuid(1), 'canceling']
    );

    const grace = await dispatch(app, { method: 'GET', url: '/api/billing/grace-period', user: ownerUser });
    expect(grace.status).toBe(200);
    expect(grace.body).toEqual(
      expect.objectContaining({
        isInGracePeriod: true,
        accessUntil: expect.any(String),
        daysRemaining: expect.any(Number),
      })
    );

    const reactivate = await dispatch(app, { method: 'POST', url: '/api/billing/reactivate', user: ownerUser });
    expect(reactivate.status).toBe(200);
    expect(reactivate.body).toEqual(
      expect.objectContaining({
        success: true,
      })
    );

    const graceAfter = await dispatch(app, { method: 'GET', url: '/api/billing/grace-period', user: ownerUser });
    expect(graceAfter.status).toBe(200);
    expect(graceAfter.body).toEqual(
      expect.objectContaining({
        isInGracePeriod: false,
      })
    );
  });

  it('covers per-org billing usage settings endpoints', async () => {
    const app = await makeApp();

    await dbRun(
      `CREATE TABLE IF NOT EXISTS billing_addons (id TEXT PRIMARY KEY, organization_id TEXT, addon_key TEXT, is_enabled INTEGER DEFAULT 0, config TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`
    );

    const get = await dispatch(app, { method: 'GET', url: '/api/billing/usage-billing', user: ownerUser });
    expect(get.status).toBe(200);

    const put = await dispatch(app, { method: 'PUT', url: '/api/billing/usage-billing', user: superAdminUser, body: { tokenOverageRate: 0.01, storageOverageRate: 0.2 } });
    expect(put.status).toBe(200);
  });

  it('sanity: key billing tables contain expected seeded rows', async () => {
    const plans = await dbAll<any>(`SELECT id, name FROM subscription_plans ORDER BY sort_order`, []);
    expect(plans.length).toBeGreaterThanOrEqual(2);

    const inv = await dbGet<any>(`SELECT id, status FROM invoices WHERE id = ?`, [uuid(31)]);
    expect(inv?.status).toBe('paid');
  });
});
