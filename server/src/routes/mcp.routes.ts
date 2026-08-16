/**
 * MCP Routes - Model Context Protocol endpoints
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import {
  callRemoteTool,
  listRemoteTools,
  makeIrisHeaders,
  makeMarketplaceHeaders,
  parseStreamableHttpConfig,
} from '../services/mcp/mcpProviderClient.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { decryptSecret, encryptSecret } from '../utils/secretEncryption.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Connector secrets live inside the provider `config` JSON blob (IRIS MES token,
 * marketplace token, and arbitrary auth headers). These keys hold credentials and
 * must be encrypted at rest (L-02). Encryption reuses the shared AES-256-GCM helper
 * (utils/secretEncryption.ts), which degrades gracefully when no key is configured
 * and transparently reads legacy plaintext values (read-compat — no migration needed).
 */
const SECRET_CONFIG_KEYS = new Set([
  'mes_api_token',
  'MES_API_TOKEN',
  'marketplace_token',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'clientSecret',
  'client_secret',
  'password',
]);

/** Encrypt secret-bearing keys (and all header values) within a provider config. */
function encryptProviderConfig(config: unknown): Record<string, unknown> {
  const obj = { ...parseJsonObject(config) };
  for (const key of Object.keys(obj)) {
    if (SECRET_CONFIG_KEYS.has(key) && typeof obj[key] === 'string') {
      obj[key] = encryptSecret(obj[key] as string);
    }
  }
  // Auth headers (e.g. Authorization: Bearer …) are secrets too.
  if (obj.headers && typeof obj.headers === 'object' && !Array.isArray(obj.headers)) {
    const headers = { ...(obj.headers as Record<string, unknown>) };
    for (const hk of Object.keys(headers)) {
      if (typeof headers[hk] === 'string') headers[hk] = encryptSecret(headers[hk] as string);
    }
    obj.headers = headers;
  }
  return obj;
}

/** Decrypt secret-bearing keys within a provider config (for actual connector use). */
function decryptProviderConfig(config: unknown): Record<string, unknown> {
  const obj = { ...parseJsonObject(config) };
  for (const key of Object.keys(obj)) {
    if (SECRET_CONFIG_KEYS.has(key) && typeof obj[key] === 'string') {
      obj[key] = decryptSecret(obj[key] as string);
    }
  }
  if (obj.headers && typeof obj.headers === 'object' && !Array.isArray(obj.headers)) {
    const headers = { ...(obj.headers as Record<string, unknown>) };
    for (const hk of Object.keys(headers)) {
      if (typeof headers[hk] === 'string') headers[hk] = decryptSecret(headers[hk] as string);
    }
    obj.headers = headers;
  }
  return obj;
}

const REDACTION_PLACEHOLDER = '__set__';

/**
 * Merge an incoming config (which may carry the redaction placeholder for secrets
 * the admin did not retype) with the existing stored (encrypted) config. Returns a
 * plaintext config: placeholder secrets are replaced with the decrypted existing
 * value so the subsequent encryptProviderConfig() re-encrypts them cleanly and no
 * credential is lost on a partial edit.
 */
function mergeRedactedSecrets(incoming: unknown, existingStored: unknown): Record<string, unknown> {
  const next = { ...parseJsonObject(incoming) };
  const prev = decryptProviderConfig(existingStored);
  for (const key of Object.keys(next)) {
    if (SECRET_CONFIG_KEYS.has(key) && next[key] === REDACTION_PLACEHOLDER) {
      if (typeof prev[key] === 'string') next[key] = prev[key];
      else delete next[key];
    }
  }
  if (next.headers && typeof next.headers === 'object' && !Array.isArray(next.headers)) {
    const headers = { ...(next.headers as Record<string, unknown>) };
    const prevHeaders =
      prev.headers && typeof prev.headers === 'object' && !Array.isArray(prev.headers)
        ? (prev.headers as Record<string, unknown>)
        : {};
    for (const hk of Object.keys(headers)) {
      if (headers[hk] === REDACTION_PLACEHOLDER) {
        if (typeof prevHeaders[hk] === 'string') headers[hk] = prevHeaders[hk];
        else delete headers[hk];
      }
    }
    next.headers = headers;
  }
  return next;
}

/**
 * Redact secret-bearing keys for client-facing responses. Even admins should not
 * receive raw credentials over the wire — replace with a placeholder so the UI can
 * show "configured" without exposing the value. Non-secret config (baseUrl, mcpPath)
 * passes through unchanged.
 */
function redactProviderConfig(config: unknown): Record<string, unknown> {
  const obj = { ...parseJsonObject(config) };
  for (const key of Object.keys(obj)) {
    if (SECRET_CONFIG_KEYS.has(key) && typeof obj[key] === 'string' && obj[key]) {
      obj[key] = REDACTION_PLACEHOLDER;
    }
  }
  if (obj.headers && typeof obj.headers === 'object' && !Array.isArray(obj.headers)) {
    const headers = { ...(obj.headers as Record<string, unknown>) };
    for (const hk of Object.keys(headers)) {
      if (typeof headers[hk] === 'string' && headers[hk]) headers[hk] = REDACTION_PLACEHOLDER;
    }
    obj.headers = headers;
  }
  return obj;
}

async function getMarketplaceProvider(orgId: string): Promise<any | null> {
  const provider = await dbGet<any>(
    `SELECT id, name, type, status, config
     FROM mcp_providers
     WHERE organization_id = ? AND status = 'active' AND lower(name) LIKE '%marketplace%'
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [orgId]
  ).catch(() => null);
  return provider || null;
}

async function tryGetColumns(table: string): Promise<Set<string>> {
  try {
    const rows = await dbAll<{ name: string }>(
      `SELECT column_name AS name
       FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = ?`,
      [table]
    );
    if (rows?.length) {
      return new Set(rows.map((r) => String(r.name || '')).filter(Boolean));
    }
  } catch {
    // SQLite compatibility fallback below.
  }
  try {
    const rows = await dbAll<{ name: string }>(`PRAGMA table_info(${table})`, []);
    return new Set((rows || []).map((r) => String(r.name || '')).filter(Boolean));
  } catch {
    return new Set();
  }
}

router.get(
  '/providers',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const cols = await tryGetColumns('mcp_providers');
    if (!cols.size) return res.json([]);
    const providers = await dbAll<any>(
      `SELECT id, name, type, status, config, created_at
    FROM mcp_providers WHERE organization_id = ? ORDER BY name`,
      [orgId]
    );
    // Redact connector secrets before sending to the client (L-02): even admins
    // never receive raw credentials over the wire — the UI shows "__set__".
    const safe = (providers || []).map((p: any) => ({
      ...p,
      config: redactProviderConfig(p.config),
    }));
    res.json(safe);
  })
);

router.post(
  '/providers',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { name, type, status, config } = req.body || {};
    const providerName = String(name || '').trim();
    const providerType = String(type || 'streamable_http').trim();
    const providerStatus = String(status || 'active').trim();
    if (!providerName) return res.status(400).json({ error: 'name is required' });

    const id = uuidv4();
    await dbRun(
      `INSERT INTO mcp_providers (id, organization_id, name, type, status, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        id,
        orgId,
        providerName,
        providerType,
        providerStatus,
        JSON.stringify(encryptProviderConfig(config || {})),
      ]
    );

    // Default allowlist: allow all (can be tightened later)
    await dbRun(
      `INSERT INTO mcp_provider_allowlist (id, organization_id, provider_id, mode, tools_json, created_at, updated_at)
       VALUES (?, ?, ?, 'allow', '["*"]', datetime('now'), datetime('now'))
       ON CONFLICT(provider_id) DO NOTHING`,
      [uuidv4(), orgId, id]
    ).catch(() => null);

    return res.status(201).json({ success: true, id });
  })
);

router.put(
  '/providers/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const id = String(req.params.id || '').trim();
    const { name, status, config } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });

    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(String(name));
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(String(status));
    }
    if (config !== undefined) {
      // The client receives redacted secrets ("__set__") from GET and may send them
      // back unchanged on edit. Preserve the existing stored (encrypted) secret when
      // the incoming value is still the placeholder, so a config edit never clobbers
      // a credential the admin didn't actually retype.
      const existing = await dbGet<any>(
        `SELECT config FROM mcp_providers WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      const merged = mergeRedactedSecrets(config || {}, existing?.config);
      updates.push('config = ?');
      params.push(JSON.stringify(encryptProviderConfig(merged)));
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates provided' });
    updates.push("updated_at = datetime('now')");
    params.push(id, orgId);

    await dbRun(
      `UPDATE mcp_providers SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
    return res.json({ success: true });
  })
);

router.delete(
  '/providers/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const id = String(req.params.id || '').trim();
    await dbRun(`DELETE FROM mcp_providers WHERE id = ? AND organization_id = ?`, [id, orgId]);
    return res.json({ success: true });
  })
);

router.get(
  '/providers/:id/allowlist',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const id = String(req.params.id || '').trim();
    const row = await dbGet<any>(
      `SELECT provider_id, mode, tools_json, updated_at FROM mcp_provider_allowlist WHERE provider_id = ? AND organization_id = ?`,
      [id, orgId]
    );
    return res.json(row || { provider_id: id, mode: 'allow', tools_json: '["*"]' });
  })
);

router.put(
  '/providers/:id/allowlist',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const id = String(req.params.id || '').trim();
    const mode = String(req.body?.mode || 'allow').trim();
    const tools = Array.isArray(req.body?.tools)
      ? req.body.tools.map((t: any) => String(t))
      : ['*'];

    await dbRun(
      `INSERT INTO mcp_provider_allowlist (id, organization_id, provider_id, mode, tools_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(provider_id) DO UPDATE SET mode = excluded.mode, tools_json = excluded.tools_json, updated_at = datetime('now')`,
      [uuidv4(), orgId, id, mode, JSON.stringify(tools)]
    );
    return res.json({ success: true });
  })
);

router.post(
  '/providers/:id/test',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const id = String(req.params.id || '').trim();
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const provider = await dbGet<any>(
      `SELECT id, name, type, config FROM mcp_providers WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const decryptedConfig = decryptProviderConfig(provider.config);
    const cfg = parseStreamableHttpConfig(decryptedConfig);
    if (!cfg) return res.status(400).json({ error: 'Invalid provider config (baseUrl required)' });

    try {
      const tools = await listRemoteTools({
        providerId: id,
        orgId,
        userId: req.user?.id,
        config: cfg,
      });
      await dbRun(
        `UPDATE mcp_providers SET last_test_at = datetime('now'), last_error = NULL, updated_at = datetime('now') WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      ).catch(() => null);
      await dbRun(
        `INSERT INTO mcp_provider_tools_cache (provider_id, organization_id, tools_json, fetched_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(provider_id) DO UPDATE SET tools_json = excluded.tools_json, fetched_at = datetime('now')`,
        [id, orgId, JSON.stringify(tools)]
      ).catch(() => null);
      return res.json({ success: true, tools });
    } catch (e: any) {
      await dbRun(
        `UPDATE mcp_providers SET last_test_at = datetime('now'), last_error = ?, updated_at = datetime('now') WHERE id = ? AND organization_id = ?`,
        [e?.message || 'test_failed', id, orgId]
      ).catch(() => null);
      return res.status(502).json({ success: false, error: e?.message || 'test_failed' });
    }
  })
);

router.get(
  '/providers/:id/tools',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const id = String(req.params.id || '').trim();
    const cached = await dbGet<any>(
      `SELECT tools_json, fetched_at FROM mcp_provider_tools_cache WHERE provider_id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (cached?.tools_json) {
      try {
        return res.json({
          tools: JSON.parse(cached.tools_json),
          fetchedAt: cached.fetched_at,
          cached: true,
        });
      } catch {}
    }
    return res.status(404).json({ error: 'No cached tools. Run /test first.' });
  })
);

router.post(
  '/providers/:id/call',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const id = String(req.params.id || '').trim();
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    const toolName = String(req.body?.toolName || '').trim();
    const args = (
      req.body?.args && typeof req.body.args === 'object' && !Array.isArray(req.body.args)
        ? req.body.args
        : {}
    ) as Record<string, unknown>;

    if (!toolName) return res.status(400).json({ error: 'toolName is required' });

    const provider = await dbGet<any>(
      `SELECT id, name, type, config FROM mcp_providers WHERE id = ? AND organization_id = ? AND status = 'active'`,
      [id, orgId]
    );
    if (!provider) return res.status(404).json({ error: 'Provider not found or disabled' });

    const allow = await dbGet<any>(
      `SELECT mode, tools_json FROM mcp_provider_allowlist WHERE provider_id = ? AND organization_id = ?`,
      [id, orgId]
    );
    const tools = (() => {
      try {
        return Array.isArray(JSON.parse(allow?.tools_json || '["*"]'))
          ? JSON.parse(allow?.tools_json || '["*"]')
          : ['*'];
      } catch {
        return ['*'];
      }
    })() as string[];
    const mode = String(allow?.mode || 'allow');
    const isAllowed = tools.includes('*')
      ? mode === 'allow'
      : mode === 'allow'
        ? tools.includes(toolName)
        : !tools.includes(toolName);
    if (!isAllowed)
      return res.status(403).json({ error: 'Tool not allowed by provider allowlist' });

    const cfgObj = decryptProviderConfig(provider.config);
    const cfg = parseStreamableHttpConfig(cfgObj);
    if (!cfg) return res.status(400).json({ error: 'Invalid provider config' });

    const extraHeaders =
      String(provider.name || provider.id)
        .toLowerCase()
        .includes('iris') || toolName.startsWith('iris.')
        ? makeIrisHeaders(cfgObj, (req.body?.context?.factoryId as string | undefined) || null)
        : toolName.startsWith('marketplace.')
          ? makeMarketplaceHeaders(cfgObj)
          : {};

    try {
      const result = await callRemoteTool({
        providerId: id,
        orgId,
        userId,
        config: cfg,
        toolName,
        args,
        extraHeaders,
      });
      return res.json({ success: true, result });
    } catch (e: any) {
      logger.warn('[MCP] provider tool call failed', {
        providerId: id,
        toolName,
        error: e?.message || e,
      });
      return res.status(502).json({ success: false, error: e?.message || 'mcp_call_failed' });
    }
  })
);

router.get(
  '/context',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    // Aggregate context from various sources
    const activeProject = await dbAll(
      `SELECT p.id, p.name FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = ? AND p.organization_id = ? AND p.status = 'active'
    LIMIT 3`,
      [userId, orgId]
    );
    res.json({
      user: { id: userId },
      organization: { id: orgId },
      activeProjects: activeProject,
      timestamp: new Date().toISOString(),
    });
  })
);

router.get(
  '/discovery',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    // Minimal curated list (market scan) - can be expanded later.
    res.json({
      providers: [
        { id: 'iris', name: 'IRIS (Plant Ops)', type: 'streamable_http', defaultMcpPath: '/mcp' },
        {
          id: 'marketplace',
          name: 'DBR77 Marketplace',
          type: 'streamable_http',
          defaultMcpPath: '/mcp',
        },
        {
          id: 'github',
          name: 'GitHub',
          type: 'mcp',
          note: 'Use GitHub MCP or REST via webhook automation',
        },
        {
          id: 'slack',
          name: 'Slack',
          type: 'mcp',
          note: 'Use Slack MCP or webhook-based messaging',
        },
        {
          id: 'msgraph',
          name: 'Microsoft Graph',
          type: 'mcp',
          note: 'Outlook/Teams/SharePoint via Graph',
        },
        {
          id: 'notion',
          name: 'Notion',
          type: 'mcp',
          note: 'Already supported via Report Builder export',
        },
      ],
    });
  })
);

// ============================================================
// V3-M09: MCP-Marketplace (read-only) + minimal import
// ============================================================
router.get(
  '/marketplace/search',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const q = String(req.query.q || '').trim();
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    if (!q) return res.status(400).json({ error: 'q is required' });

    const provider = await getMarketplaceProvider(orgId);
    if (!provider) return res.status(404).json({ error: 'Marketplace provider not configured' });

    const cfgObj = decryptProviderConfig(provider.config);
    const cfg = parseStreamableHttpConfig(cfgObj);
    if (!cfg) return res.status(400).json({ error: 'Invalid provider config (baseUrl required)' });

    const result = await callRemoteTool({
      providerId: String(provider.id),
      orgId,
      userId: req.user?.id || null,
      config: cfg,
      toolName: 'marketplace.catalog.search',
      args: { q, limit },
      extraHeaders: makeMarketplaceHeaders(cfgObj),
    });
    return res.json({ success: true, providerId: String(provider.id), result });
  })
);

router.get(
  '/marketplace/assets/:assetId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const assetId = String(req.params.assetId || '').trim();
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    if (!assetId) return res.status(400).json({ error: 'assetId is required' });

    const provider = await getMarketplaceProvider(orgId);
    if (!provider) return res.status(404).json({ error: 'Marketplace provider not configured' });

    const cfgObj = decryptProviderConfig(provider.config);
    const cfg = parseStreamableHttpConfig(cfgObj);
    if (!cfg) return res.status(400).json({ error: 'Invalid provider config (baseUrl required)' });

    const result = await callRemoteTool({
      providerId: String(provider.id),
      orgId,
      userId: req.user?.id || null,
      config: cfg,
      toolName: 'marketplace.asset.get',
      args: { id: assetId },
      extraHeaders: makeMarketplaceHeaders(cfgObj),
    });
    return res.json({ success: true, providerId: String(provider.id), result });
  })
);

router.post(
  '/marketplace/assets/:assetId/import',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const assetId = String(req.params.assetId || '').trim();
    const targetType = String(req.body?.targetType || 'presentation_template').trim();
    const nameOverride = req.body?.name ? String(req.body.name).trim() : null;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    if (!assetId) return res.status(400).json({ error: 'assetId is required' });

    const provider = await getMarketplaceProvider(orgId);
    if (!provider) return res.status(404).json({ error: 'Marketplace provider not configured' });

    const cfgObj = decryptProviderConfig(provider.config);
    const cfg = parseStreamableHttpConfig(cfgObj);
    if (!cfg) return res.status(400).json({ error: 'Invalid provider config (baseUrl required)' });

    const asset = await callRemoteTool({
      providerId: String(provider.id),
      orgId,
      userId: req.user?.id || null,
      config: cfg,
      toolName: 'marketplace.asset.get',
      args: { id: assetId },
      extraHeaders: makeMarketplaceHeaders(cfgObj),
    });

    const assetObj = (asset && typeof asset === 'object' ? asset : {}) as any;
    const assetJson = JSON.stringify(assetObj);
    const assetKind = String(assetObj.kind || assetObj.type || 'asset');
    const sourceUrl = assetObj.url ? String(assetObj.url) : null;

    // Ensure imports table exists
    const cols = await tryGetColumns('marketplace_imports');
    if (!cols.size)
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });

    let createdTargetId: string | null = null;
    if (targetType === 'presentation_template') {
      const ptCols = await tryGetColumns('presentation_templates');
      if (ptCols.size) {
        const id = uuidv4().replace(/-/g, '');
        const outline =
          assetObj.outline_json ||
          assetObj.outline ||
          assetObj.template?.outline ||
          assetObj.template ||
          [];
        await dbRun(
          `INSERT INTO presentation_templates (
            id, organization_id, name, description, deck_type, audience, goal, language_default,
            confidentiality_default, theme, outline_json, max_slides, min_slides,
            must_have_intents, recommended_visuals, is_system, is_active, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, TRUE, ?, CURRENT_TIMESTAMP)`,
          [
            id,
            orgId,
            nameOverride || String(assetObj.name || assetObj.title || `Marketplace ${assetId}`),
            String(assetObj.description || ''),
            String(assetObj.deck_type || 'marketplace'),
            String(assetObj.audience || ''),
            String(assetObj.goal || ''),
            String(assetObj.language_default || 'en'),
            String(assetObj.confidentiality_default || 'internal'),
            String(assetObj.theme || 'corporate'),
            JSON.stringify(outline),
            Number(assetObj.max_slides || 15),
            Number(assetObj.min_slides || 5),
            JSON.stringify(assetObj.must_have_intents || []),
            JSON.stringify(assetObj.recommended_visuals || []),
            req.user?.id || null,
          ]
        ).catch(() => null);
        createdTargetId = id;
      }
    }

    const importId = `mpi-${uuidv4()}`;
    await dbRun(
      `INSERT INTO marketplace_imports (
        id, organization_id, provider_id, asset_id, asset_kind, target_type, target_id, source_url, imported_by, asset_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        importId,
        orgId,
        String(provider.id),
        assetId,
        assetKind,
        targetType,
        createdTargetId,
        sourceUrl,
        req.user?.id || null,
        assetJson,
      ]
    );

    return res.status(201).json({
      success: true,
      importId,
      providerId: String(provider.id),
      assetId,
      assetKind,
      targetType,
      targetId: createdTargetId,
    });
  })
);

router.get(
  '/audit',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const rows = await dbAll(
      `SELECT id, user_id, tool_name, resource_path, prompt_name, success, error_message, latency_ms, created_at
       FROM mcp_audit_logs
       WHERE organization_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [orgId, limit]
    );
    res.json(rows || []);
  })
);

export default router;
