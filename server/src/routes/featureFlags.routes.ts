import { randomUUID } from 'crypto';
import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { verifySuperAdmin as requireSuperAdmin } from '../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();

let tableReady = false;

/**
 * The G4 fixture override table is consulted only under the same fail-closed
 * conditions that expose test-support at all: never in production, and only
 * when `ENABLE_TEST_SUPPORT=true`. It is deliberately NOT keyed off `E2E_MODE`,
 * because that flag also switches on an unsigned-token auth bypass which the
 * G4 gate has to prove is inert.
 */
function testFlagOverridesEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ENABLE_TEST_SUPPORT === 'true';
}

async function ensureTable(): Promise<void> {
  if (tableReady) return;

  // Fail-soft: lazy DDL must never propagate to route handlers as a bare 500.
  // Every statement already uses { fallback: true }; this outer guard covers
  // connection-level rejections so read handlers degrade to empty instead of
  // white-screening the caller. tableReady is only latched on full success.
  try {
    await dbRun(
      `CREATE TABLE IF NOT EXISTS feature_flags (
        id TEXT PRIMARY KEY,
        flag_key TEXT NOT NULL UNIQUE,
        description TEXT,
        enabled BOOLEAN DEFAULT false,
        rules TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      [],
      { fallback: true }
    );

    const addCol = async (col: string, def: string) => {
      await dbRun(`ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS ${col} ${def}`, [], {
        fallback: true,
      });
    };
    await addCol('name', "TEXT DEFAULT ''");
    await addCol('flag_type', "TEXT DEFAULT 'boolean'");
    await addCol('targeting_rules', "TEXT DEFAULT '[]'");
    await addCol('rollout_percentage', 'REAL DEFAULT 0');
    await addCol('environment', "TEXT DEFAULT 'production'");
    await addCol('organization_id', 'TEXT');
    await addCol('variants', "TEXT DEFAULT '[]'");

    await dbRun(
      `CREATE TABLE IF NOT EXISTS feature_flag_history (
        id TEXT PRIMARY KEY,
        flag_id TEXT NOT NULL,
        change_type TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by TEXT NOT NULL,
        changed_at TEXT NOT NULL
      )`,
      [],
      { fallback: true }
    );

    tableReady = true;
  } catch (err) {
    console.error('[featureFlags] ensureTable lazy DDL failed (fail-soft):', err);
  }
}

interface FlagRow {
  id: string;
  flag_key: string;
  name: string | null;
  description: string | null;
  enabled: boolean | number;
  rules: string | null;
  flag_type: string | null;
  targeting_rules: string | null;
  rollout_percentage: number | null;
  environment: string | null;
  organization_id: string | null;
  variants: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function safeJsonParse(value: string | null | undefined, fallback: unknown[] = []): unknown[] {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToFlag(row: FlagRow) {
  const enabled = row.enabled === true || row.enabled === 1 || (row.enabled as any) === 't';
  return {
    id: row.id,
    flag_key: row.flag_key,
    name: row.name || row.flag_key || '',
    description: row.description ?? undefined,
    enabled,
    flag_type: row.flag_type || 'boolean',
    targeting_rules: safeJsonParse(row.targeting_rules ?? row.rules),
    rollout_percentage: row.rollout_percentage ?? 0,
    environment: row.environment || 'production',
    organization_id: row.organization_id ?? undefined,
    variants: safeJsonParse(row.variants),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

type ResolvedFeatureFlag = ReturnType<typeof rowToFlag>;

interface FeatureEvaluationContext extends Record<string, unknown> {
  userId?: string;
  user_id?: string;
  orgId?: string;
  org_id?: string;
  email?: string;
  role?: string;
}

interface FeatureEvaluationResult {
  enabled: boolean;
  reason: string;
  variant?: string;
}

function evaluateFeatureFlag(
  flag: ResolvedFeatureFlag,
  context: FeatureEvaluationContext
): FeatureEvaluationResult {
  if (!flag.enabled) {
    return { enabled: false, reason: 'Flag is disabled globally' };
  }

  if (flag.flag_type === 'boolean') {
    return { enabled: true, reason: 'Boolean flag enabled' };
  }

  if (flag.flag_type === 'percentage') {
    const userId = String(context.userId || context.user_id || '');
    if (!userId) {
      return { enabled: false, reason: 'No user context for percentage evaluation' };
    }

    const bucket = Math.abs(hashCode(userId + flag.flag_key) % 100);
    const inRollout = bucket < flag.rollout_percentage;
    return {
      enabled: inRollout,
      reason: inRollout
        ? `User in rollout (${bucket}% < ${flag.rollout_percentage}%)`
        : `User not in rollout (${bucket}% >= ${flag.rollout_percentage}%)`,
    };
  }

  if (flag.flag_type === 'targeting') {
    const rules = (flag.targeting_rules || []) as any[];
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (evaluateRule(rule, context)) {
        return { enabled: true, reason: `Matched rule: ${rule.type}` };
      }
    }
    return { enabled: false, reason: 'No targeting rules matched' };
  }

  if (flag.flag_type === 'ab_test') {
    const userId = String(context.userId || context.user_id || '');
    const variants = (flag.variants || []) as any[];
    if (!userId || variants.length === 0) {
      return { enabled: false, reason: 'No user context or variants for A/B evaluation' };
    }

    const totalWeight = variants.reduce((acc: number, v: any) => acc + (v.weight || 0), 0);
    if (totalWeight <= 0) {
      return { enabled: false, reason: 'No weighted variants configured' };
    }

    let bucket = Math.abs(hashCode(userId + flag.flag_key) % totalWeight);
    for (const variant of variants) {
      bucket -= variant.weight || 0;
      if (bucket < 0) {
        return {
          enabled: true,
          variant: variant.name,
          reason: `A/B test variant: ${variant.name}`,
        };
      }
    }

    return { enabled: false, reason: 'No variant matched' };
  }

  return { enabled: false, reason: 'Unknown flag type' };
}

function buildEvaluationContext(req: AuthRequest): FeatureEvaluationContext {
  return {
    userId: req.user?.id || req.userId || '',
    user_id: req.user?.id || req.userId || '',
    orgId: req.user?.organizationId || req.organizationId || '',
    org_id: req.user?.organizationId || req.organizationId || '',
    email: req.user?.email || '',
    role: req.user?.role || req.userRole || '',
  };
}

router.get(
  '/runtime',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTable();

    const organizationId = req.user?.organizationId || req.organizationId || null;
    const rows = await dbAll<FlagRow>(
      `SELECT * FROM feature_flags
       WHERE environment = ?
         AND (organization_id IS NULL OR organization_id = ?)
       ORDER BY updated_at DESC`,
      ['production', organizationId],
      { fallback: true }
    );

    const context = buildEvaluationContext(req);
    const flags: Record<string, boolean> = {};
    const variants: Record<string, string> = {};

    for (const row of rows) {
      const flag = rowToFlag(row);
      const evaluation = evaluateFeatureFlag(flag, context);
      flags[flag.flag_key] = evaluation.enabled;
      if (evaluation.variant) {
        variants[flag.flag_key] = evaluation.variant;
      }
    }

    // Test-only overrides, resolved last and never in production.
    //
    // The G4 browser gate needs one throwaway tenant to see a flag as enabled.
    // It used to achieve that by rewriting the shared `feature_flags` row —
    // which is UNIQUE per key, so a real definition's type, rules, variants and
    // targets were replaced for the duration of a run. These overrides live in
    // their own per-organization rows instead, so a production definition is
    // never read or written and two runs cannot collide.
    if (testFlagOverridesEnabled() && organizationId) {
      const overrides = await dbAll<{ flag_key: string; enabled: boolean }>(
        `SELECT flag_key, enabled FROM g4_test_flag_overrides WHERE organization_id = ?`,
        [organizationId],
        { fallback: true }
      );
      for (const override of overrides) {
        flags[override.flag_key] = Boolean(override.enabled);
      }
    }

    res.json({ flags, variants });
  })
);

router.use(requireSuperAdmin);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTable();

    const { environment, flag_type, search } = req.query;

    let sql = 'SELECT * FROM feature_flags WHERE 1=1';
    const params: unknown[] = [];

    if (environment && environment !== 'all') {
      sql += ' AND environment = ?';
      params.push(environment);
    }
    if (flag_type && flag_type !== 'all') {
      sql += ' AND flag_type = ?';
      params.push(flag_type);
    }
    if (search) {
      sql += ' AND (COALESCE(name, flag_key) LIKE ? OR flag_key LIKE ? OR description LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY updated_at DESC';

    const rows = await dbAll<FlagRow>(sql, params, { fallback: true });
    res.json(rows.map(rowToFlag));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTable();

    const row = await dbGet<FlagRow>('SELECT * FROM feature_flags WHERE id = ?', [req.params.id], {
      fallback: false,
    });

    if (!row) {
      res.status(404).json({ error: 'Feature flag not found' });
      return;
    }

    res.json(rowToFlag(row));
  })
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTable();

    const {
      flag_key,
      name,
      description,
      enabled,
      flag_type,
      targeting_rules,
      rollout_percentage,
      environment,
      organization_id,
      variants,
    } = req.body;

    if (!flag_key) {
      res.status(400).json({ error: 'flag_key is required' });
      return;
    }

    const existing = await dbGet<FlagRow>('SELECT id FROM feature_flags WHERE flag_key = ?', [
      flag_key,
    ]);
    if (existing) {
      res.status(409).json({ error: 'A flag with this key already exists' });
      return;
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const rulesJson = JSON.stringify(targeting_rules || []);

    const result = await dbRun(
      `INSERT INTO feature_flags (id, flag_key, name, description, enabled, rules, flag_type, targeting_rules, rollout_percentage, environment, organization_id, variants, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        flag_key,
        name || flag_key,
        description || null,
        enabled ? true : false,
        rulesJson,
        flag_type || 'boolean',
        rulesJson,
        rollout_percentage ?? 0,
        environment || 'production',
        organization_id || null,
        JSON.stringify(variants || []),
        req.user?.id || null,
        now,
        now,
      ],
      { fallback: false }
    );

    if (!result.success) {
      res.status(500).json({ error: 'Failed to create feature flag' });
      return;
    }

    await dbRun(
      `INSERT INTO feature_flag_history (id, flag_id, change_type, old_value, new_value, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        id,
        'created',
        null,
        JSON.stringify({ flag_key, name, enabled: !!enabled }),
        req.user?.email || req.userId || 'unknown',
        now,
      ]
    );

    const created = await dbGet<FlagRow>('SELECT * FROM feature_flags WHERE id = ?', [id], {
      fallback: false,
    });

    res.status(201).json(created ? rowToFlag(created) : { id });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTable();

    const { id } = req.params;
    const existing = await dbGet<FlagRow>('SELECT * FROM feature_flags WHERE id = ?', [id], {
      fallback: false,
    });

    if (!existing) {
      res.status(404).json({ error: 'Feature flag not found' });
      return;
    }

    const {
      flag_key,
      name,
      description,
      enabled,
      flag_type,
      targeting_rules,
      rollout_percentage,
      environment,
      organization_id,
      variants,
    } = req.body;

    const now = new Date().toISOString();

    const rulesJson =
      targeting_rules !== undefined
        ? JSON.stringify(targeting_rules)
        : (existing.targeting_rules ?? existing.rules);

    const result = await dbRun(
      `UPDATE feature_flags
       SET flag_key = ?, name = ?, description = ?, enabled = ?, flag_type = ?,
           rules = ?, targeting_rules = ?, rollout_percentage = ?, environment = ?,
           organization_id = ?, variants = ?, updated_at = ?
       WHERE id = ?`,
      [
        flag_key ?? existing.flag_key,
        name ?? existing.name ?? existing.flag_key,
        description !== undefined ? description : existing.description,
        enabled !== undefined ? (enabled ? true : false) : existing.enabled,
        flag_type ?? existing.flag_type ?? 'boolean',
        rulesJson,
        rulesJson,
        rollout_percentage ?? existing.rollout_percentage ?? 0,
        environment ?? existing.environment ?? 'production',
        organization_id !== undefined ? organization_id : existing.organization_id,
        variants !== undefined ? JSON.stringify(variants) : (existing.variants ?? '[]'),
        now,
        id,
      ],
      { fallback: false }
    );

    if (!result.success) {
      res.status(500).json({ error: 'Failed to update feature flag' });
      return;
    }

    await dbRun(
      `INSERT INTO feature_flag_history (id, flag_id, change_type, old_value, new_value, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        id,
        'updated',
        JSON.stringify(rowToFlag(existing)),
        JSON.stringify(req.body),
        req.user?.email || req.userId || 'unknown',
        now,
      ]
    );

    const updated = await dbGet<FlagRow>('SELECT * FROM feature_flags WHERE id = ?', [id], {
      fallback: false,
    });
    res.json(updated ? rowToFlag(updated) : { id });
  })
);

router.put(
  '/:id/toggle',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTable();

    const { id } = req.params;
    const existing = await dbGet<FlagRow>('SELECT * FROM feature_flags WHERE id = ?', [id], {
      fallback: false,
    });

    if (!existing) {
      res.status(404).json({ error: 'Feature flag not found' });
      return;
    }

    const wasEnabled =
      existing.enabled === true || existing.enabled === 1 || (existing.enabled as any) === 't';
    const newEnabled = req.body.enabled !== undefined ? !!req.body.enabled : !wasEnabled;
    const now = new Date().toISOString();

    await dbRun(
      'UPDATE feature_flags SET enabled = ?, updated_at = ? WHERE id = ?',
      [newEnabled, now, id],
      { fallback: false }
    );

    await dbRun(
      `INSERT INTO feature_flag_history (id, flag_id, change_type, old_value, new_value, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        id,
        'toggled',
        JSON.stringify({ enabled: wasEnabled }),
        JSON.stringify({ enabled: newEnabled }),
        req.user?.email || req.userId || 'unknown',
        now,
      ]
    );

    const updated = await dbGet<FlagRow>('SELECT * FROM feature_flags WHERE id = ?', [id], {
      fallback: false,
    });
    res.json(updated ? rowToFlag(updated) : { id, enabled: newEnabled });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTable();

    const { id } = req.params;
    const existing = await dbGet<FlagRow>('SELECT * FROM feature_flags WHERE id = ?', [id], {
      fallback: false,
    });

    if (!existing) {
      res.status(404).json({ error: 'Feature flag not found' });
      return;
    }

    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO feature_flag_history (id, flag_id, change_type, old_value, new_value, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        id,
        'deleted',
        JSON.stringify(rowToFlag(existing)),
        null,
        req.user?.email || req.userId || 'unknown',
        now,
      ]
    );

    await dbRun('DELETE FROM feature_flags WHERE id = ?', [id], { fallback: false });

    res.json({ success: true });
  })
);

router.get(
  '/:id/history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTable();

    const rows = await dbAll<{
      id: string;
      flag_id: string;
      change_type: string;
      old_value: string | null;
      new_value: string | null;
      changed_by: string;
      changed_at: string;
    }>(
      'SELECT * FROM feature_flag_history WHERE flag_id = ? ORDER BY changed_at DESC LIMIT 100',
      [req.params.id],
      { fallback: false }
    );

    res.json(
      rows.map((r) => ({
        ...r,
        old_value: r.old_value ? JSON.parse(r.old_value) : null,
        new_value: r.new_value ? JSON.parse(r.new_value) : null,
      }))
    );
  })
);

router.post(
  '/evaluate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureTable();

    const { flag_key, context } = req.body;

    if (!flag_key) {
      res.status(400).json({ error: 'flag_key is required' });
      return;
    }

    const flag = await dbGet<FlagRow>(
      'SELECT * FROM feature_flags WHERE flag_key = ?',
      [flag_key],
      { fallback: false }
    );

    if (!flag) {
      res.json({ enabled: false, reason: 'Flag not found' });
      return;
    }

    res.json(evaluateFeatureFlag(rowToFlag(flag), context || {}));
  })
);

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

function evaluateRule(rule: any, context: Record<string, any>): boolean {
  let value = '';
  switch (rule.type) {
    case 'email_domain':
      value = (context.email || '').split('@')[1] || '';
      break;
    case 'org_id':
      value = context.orgId || context.org_id || '';
      break;
    case 'user_id':
      value = context.userId || context.user_id || '';
      break;
    case 'role':
      value = context.role || '';
      break;
    case 'attribute':
      value = context[rule.attribute] || '';
      break;
    default:
      return false;
  }

  const values: string[] = rule.values || [];
  switch (rule.operator) {
    case 'equals':
    case 'in':
      return values.includes(value);
    case 'not_in':
      return !values.includes(value);
    case 'contains':
      return values.some((v: string) => value.includes(v));
    case 'starts_with':
      return values.some((v: string) => value.startsWith(v));
    case 'ends_with':
      return values.some((v: string) => value.endsWith(v));
    case 'gt':
      return values.some((v: string) => Number(value) > Number(v));
    case 'lt':
      return values.some((v: string) => Number(value) < Number(v));
    default:
      return false;
  }
}

export default router;
