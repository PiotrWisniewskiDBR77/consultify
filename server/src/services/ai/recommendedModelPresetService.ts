import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

type PurposeKind = 'TEXT_LLM' | 'IMAGE_MODEL' | 'BUSINESS_MODEL';
type Tier = 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING' | 'FREE';

type ProviderKey =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'zai'
  | 'replicate';

export type ApplyRecommendedPresetResult = {
  success: boolean;
  dryRun: boolean;
  createdProviders: number;
  updatedProviders: number;
  createdTierAssignments: number;
  createdPurposes: number;
  createdPurposeAssignments: number;
  notes: string[];
};

type ProviderRow = {
  id: string;
  provider: string;
  name: string;
  api_key?: string | null;
  endpoint?: string | null;
  model_id?: string | null;
  kind?: string | null;
  provider_type?: string | null;
  origin_vendor?: string | null;
  execution_regions?: string | null;
  allowed_data_classes?: string | null;
  is_active?: any;
};

const DEFAULT_PURPOSES: Array<{
  purpose: string;
  kind: PurposeKind;
  default_tier?: Tier | null;
  requirements?: any;
  description?: string;
}> = [
  // Chat
  { purpose: 'chat_simple', kind: 'TEXT_LLM', default_tier: 'BUDGET' },
  { purpose: 'chat_complex', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  { purpose: 'chat_confirm', kind: 'TEXT_LLM', default_tier: 'BUDGET' },
  // Tools / sessions
  { purpose: 'tool_recommendation', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  { purpose: 'session_missing_items', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  { purpose: 'session_summary', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  { purpose: 'assessment_explain', kind: 'TEXT_LLM', default_tier: 'PREMIUM' },
  // Initiatives / governance
  { purpose: 'validate_initiative', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  { purpose: 'governance_risk_scan', kind: 'TEXT_LLM', default_tier: 'REASONING' },
  { purpose: 'build_roadmap', kind: 'TEXT_LLM', default_tier: 'REASONING' },
  // Results
  { purpose: 'results_anomaly_insights', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  { purpose: 'results_report_draft', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  // Reports / decks
  { purpose: 'report_section', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  { purpose: 'full_report', kind: 'TEXT_LLM', default_tier: 'REASONING' },
  { purpose: 'deck_outline', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  { purpose: 'deck_copy_polish', kind: 'TEXT_LLM', default_tier: 'BUDGET' },
  // Deep Research (Evidence Ledger chain)
  { purpose: 'deep_research_plan', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  { purpose: 'deep_research_claims_extract', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  { purpose: 'deep_research_synthesis', kind: 'TEXT_LLM', default_tier: 'REASONING' },
  { purpose: 'deep_research_contradictions', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  { purpose: 'deep_research_export_polish', kind: 'TEXT_LLM', default_tier: 'BUDGET' },
  { purpose: 'deep_research_quality_gate', kind: 'TEXT_LLM', default_tier: 'STANDARD' },
  // Vision
  {
    purpose: 'vision_extract',
    kind: 'TEXT_LLM',
    default_tier: 'STANDARD',
    requirements: { vision: true },
  },
  {
    purpose: 'vision_compare',
    kind: 'TEXT_LLM',
    default_tier: 'REASONING',
    requirements: { vision: true },
  },
  // Images
  { purpose: 'image_cover', kind: 'IMAGE_MODEL' },
  { purpose: 'image_diagram', kind: 'IMAGE_MODEL' },
  { purpose: 'image_slide_asset', kind: 'IMAGE_MODEL' },
  // Business models (placeholders for v3)
  { purpose: 'lean_suggestions', kind: 'BUSINESS_MODEL' },
  { purpose: 'waste_detection', kind: 'BUSINESS_MODEL' },
  { purpose: 'process_optimization', kind: 'BUSINESS_MODEL' },
];

function envKeyForProvider(provider: ProviderKey): string | null {
  if (provider === 'openrouter') return 'OPENROUTER_API_KEY';
  if (provider === 'openai') return 'OPENAI_API_KEY';
  if (provider === 'anthropic') return 'ANTHROPIC_API_KEY';
  if (provider === 'gemini') return 'GEMINI_API_KEY';
  if (provider === 'deepseek') return 'DEEPSEEK_API_KEY';
  if (provider === 'zai') return 'ZAI_API_KEY';
  if (provider === 'replicate') return 'REPLICATE_API_TOKEN';
  return null;
}

function getApiKey(provider: ProviderKey): string | null {
  if (provider === 'gemini') {
    return (
      String(process.env.GEMINI_API_KEY || '').trim() ||
      String(process.env.GOOGLE_AI_API_KEY || '').trim() ||
      String((process.env as any).GOOGLE_API_KEY || '').trim() ||
      null
    );
  }
  if (provider === 'replicate') {
    return (
      String(process.env.REPLICATE_API_TOKEN || '').trim() ||
      String(process.env.REPLICATE_API_KEY || '').trim() ||
      null
    );
  }
  const key = envKeyForProvider(provider);
  if (!key) return null;
  return String(process.env[key] || '').trim() || null;
}

function normalizeModelId(id: string): string {
  // Gemini list returns "models/xxx" often
  return String(id || '')
    .trim()
    .replace(/^models\//, '');
}

function scoreModelId(id: string, mode: 'fast' | 'deep'): number {
  const s = normalizeModelId(id).toLowerCase();
  let score = 0;

  const fastTokens = ['mini', 'flash', 'haiku', 'fast', 'lite', 'small'];
  const deepTokens = ['pro', 'sonnet', 'opus', 'reasoner', 'thinking', 'advanced', 'large', 'max'];

  for (const t of fastTokens) if (s.includes(t)) score += mode === 'fast' ? 40 : -15;
  for (const t of deepTokens) if (s.includes(t)) score += mode === 'deep' ? 40 : -15;

  if (mode === 'deep' && (s.includes('gpt-4') || s.includes('4.1') || s.includes('4o')))
    score += 20;
  if (mode === 'fast' && (s.includes('gpt-4') || s.includes('4.1') || s.includes('4o'))) score += 5;

  // penalize obvious non-chat / embedding / audio models when picking text LLMs
  const bad = [
    'embedding',
    'tts',
    'whisper',
    'speech',
    'audio',
    'moderation',
    'rerank',
    'image',
    'vision',
  ];
  for (const b of bad) if (s.includes(b)) score -= 50;

  // prefer stable/latest style IDs
  if (s.includes('latest')) score += 5;

  return score;
}

function pickRecommended(models: string[], mode: 'fast' | 'deep'): string | null {
  const ids = (models || []).map(normalizeModelId).filter(Boolean);
  if (ids.length === 0) return null;
  const ranked = ids
    .map((id) => ({ id, score: scoreModelId(id, mode) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.id || null;
}

async function listOpenAIModels(apiKey: string, endpoint?: string | null): Promise<string[]> {
  const base = String(endpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`OpenAI /models HTTP ${res.status}`);
  const json: any = await res.json();
  return Array.isArray(json?.data) ? json.data.map((m: any) => m?.id).filter(Boolean) : [];
}

async function listOpenRouterModels(apiKey: string, endpoint?: string | null): Promise<string[]> {
  const base = String(endpoint || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`OpenRouter /models HTTP ${res.status}`);
  const json: any = await res.json();
  // OpenRouter returns { data: [{id: "vendor/model", ...}] }
  return Array.isArray(json?.data) ? json.data.map((m: any) => m?.id).filter(Boolean) : [];
}

async function listAnthropicModels(apiKey: string, endpoint?: string | null): Promise<string[]> {
  const base = String(endpoint || 'https://api.anthropic.com').replace(/\/+$/, '');
  const res = await fetch(`${base}/v1/models`, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Anthropic /v1/models HTTP ${res.status}`);
  const json: any = await res.json();
  return Array.isArray(json?.data) ? json.data.map((m: any) => m?.id).filter(Boolean) : [];
}

async function listOpenAICompatibleModels(apiKey: string, endpoint: string): Promise<string[]> {
  const base = String(endpoint || '')
    .trim()
    .replace(/\/+$/, '');
  if (!base) return [];
  const url = base.toLowerCase().endsWith('/v1') ? `${base}/models` : `${base}/v1/models`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`OpenAI-compatible /models HTTP ${res.status}`);
  const json: any = await res.json();
  return Array.isArray(json?.data) ? json.data.map((m: any) => m?.id).filter(Boolean) : [];
}

async function listGeminiModels(apiKey: string): Promise<string[]> {
  // Gemini API (generativelanguage) supports list models via API key query param
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Gemini list models HTTP ${res.status}`);
  const json: any = await res.json();
  return Array.isArray(json?.models) ? json.models.map((m: any) => m?.name).filter(Boolean) : [];
}

async function listReplicateModels(apiKey: string, endpoint?: string | null): Promise<boolean> {
  const base = String(endpoint || 'https://api.replicate.com/v1').replace(/\/+$/, '');
  const res = await fetch(`${base}/models?limit=1`, {
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  return res.ok;
}

async function findExistingProviderRow(
  provider: ProviderKey,
  modelId: string
): Promise<ProviderRow | null> {
  const row = (await dbGet(
    `SELECT * FROM llm_providers WHERE provider = ? AND model_id = ? LIMIT 1`,
    [provider, modelId],
    { fallback: true } as any
  )) as any;
  return row || null;
}

async function upsertProviderRow(params: {
  provider: ProviderKey;
  name: string;
  modelId: string;
  kind: PurposeKind;
  provider_type: 'direct' | 'aggregator' | 'hosted' | 'local' | 'customer_managed';
  origin_vendor: string;
  endpoint?: string | null;
  execution_regions?: string[]; // stored as JSON
  allowed_data_classes?: Array<'no_pii' | 'pii' | 'confidential'>; // stored as JSON
  is_active?: boolean;
  tier?: Tier;
  api_key?: string | null; // optional (usually blank if env-managed)
  dryRun: boolean;
  overwrite?: boolean;
}): Promise<{ id: string; created: boolean; updated: boolean }> {
  const existing = await findExistingProviderRow(params.provider, params.modelId);
  const id = existing?.id || randomUUID();

  const updates: any = {
    id,
    name: params.name,
    provider: params.provider,
    model_id: params.modelId,
    kind: params.kind,
    provider_type: params.provider_type,
    origin_vendor: params.origin_vendor,
    endpoint: params.endpoint || null,
    execution_regions: params.execution_regions ? JSON.stringify(params.execution_regions) : null,
    allowed_data_classes: params.allowed_data_classes
      ? JSON.stringify(params.allowed_data_classes)
      : null,
    is_active: params.is_active === false ? 0 : 1,
    tier: params.tier || 'STANDARD',
  };
  if (params.overwrite && typeof params.api_key === 'string') {
    updates.api_key = params.api_key;
  }

  if (params.dryRun) {
    return { id, created: !existing, updated: !!existing };
  }

  if (!existing) {
    await dbRun(
      `INSERT INTO llm_providers
       (id, name, provider, model_id, kind, provider_type, origin_vendor, endpoint, execution_regions, allowed_data_classes, api_key, is_active, tier, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        updates.id,
        updates.name,
        updates.provider,
        updates.model_id,
        updates.kind,
        updates.provider_type,
        updates.origin_vendor,
        updates.endpoint,
        updates.execution_regions,
        updates.allowed_data_classes,
        updates.api_key || null,
        updates.is_active,
        updates.tier,
      ],
      { fallback: true } as any
    );
    return { id, created: true, updated: false };
  }

  await dbRun(
    `UPDATE llm_providers
     SET name = ?,
         kind = ?,
         provider_type = ?,
         origin_vendor = ?,
         endpoint = ?,
         execution_regions = ?,
         allowed_data_classes = ?,
         is_active = ?,
         tier = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      updates.name,
      updates.kind,
      updates.provider_type,
      updates.origin_vendor,
      updates.endpoint,
      updates.execution_regions,
      updates.allowed_data_classes,
      updates.is_active,
      updates.tier,
      id,
    ],
    { fallback: true } as any
  );
  return { id, created: false, updated: true };
}

async function upsertTierAssignment(params: {
  providerId: string;
  tier: Tier;
  priority: number;
  dryRun: boolean;
}): Promise<boolean> {
  if (params.dryRun) return true;
  const id = `${params.providerId}-${params.tier}`;
  await dbRun(
    `INSERT INTO llm_tier_assignments (id, provider_id, tier, priority, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(provider_id, tier) DO UPDATE SET
       priority = excluded.priority,
       is_active = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [id, params.providerId, params.tier, params.priority],
    { fallback: true } as any
  );
  return true;
}

async function upsertPurpose(params: {
  purpose: string;
  kind: PurposeKind;
  defaultTier?: Tier | null;
  requirements?: any;
  description?: string;
  dryRun: boolean;
}): Promise<boolean> {
  if (params.dryRun) return true;
  await dbRun(
    `INSERT INTO ai_purposes (purpose, kind, default_tier, requirements, description, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(purpose) DO UPDATE SET
       kind = excluded.kind,
       default_tier = excluded.default_tier,
       requirements = excluded.requirements,
       description = excluded.description,
       is_active = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [
      params.purpose,
      params.kind,
      params.defaultTier || null,
      params.requirements ? JSON.stringify(params.requirements) : null,
      params.description || null,
    ],
    { fallback: true } as any
  );
  return true;
}

async function upsertPurposeAssignment(params: {
  purpose: string;
  providerId: string;
  modelId?: string; // optional override (if blank, uses provider.model_id)
  priority: number;
  dryRun: boolean;
}): Promise<boolean> {
  const modelId = String(params.modelId || '').trim();
  const id = `global-${params.purpose}-${params.providerId}-${modelId || 'default'}`;
  if (params.dryRun) return true;
  await dbRun(
    `INSERT INTO ai_purpose_assignments (id, organization_id, purpose, provider_id, model_id, priority, is_active, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(organization_id, purpose, provider_id, model_id) DO UPDATE SET
       priority = excluded.priority,
       is_active = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [id, params.purpose, params.providerId, modelId, params.priority],
    { fallback: true } as any
  );
  return true;
}

async function discoverRecommendedTextModels(params: {
  provider: ProviderKey;
  apiKey: string;
  endpoint?: string | null;
}): Promise<{ fast: string | null; deep: string | null; notes: string[] }> {
  const notes: string[] = [];
  try {
    let models: string[] = [];
    if (params.provider === 'openai')
      models = await listOpenAIModels(params.apiKey, params.endpoint);
    else if (params.provider === 'openrouter')
      models = await listOpenRouterModels(params.apiKey, params.endpoint);
    else if (params.provider === 'anthropic')
      models = await listAnthropicModels(params.apiKey, params.endpoint);
    else if (params.provider === 'gemini') models = await listGeminiModels(params.apiKey);
    else if (params.provider === 'deepseek' || params.provider === 'zai') {
      const ep = params.endpoint || '';
      models = await listOpenAICompatibleModels(params.apiKey, ep);
    } else {
      return { fast: null, deep: null, notes: [`No discovery adapter for ${params.provider}`] };
    }

    const fast = pickRecommended(models, 'fast');
    const deep = pickRecommended(models, 'deep');
    if (!fast)
      notes.push(`${params.provider}: could not pick fast model from ${models.length} models`);
    if (!deep)
      notes.push(`${params.provider}: could not pick deep model from ${models.length} models`);
    return { fast, deep, notes };
  } catch (e: any) {
    notes.push(`${params.provider}: discovery failed (${String(e?.message || e)})`);
    return { fast: null, deep: null, notes };
  }
}

function providerMeta(provider: ProviderKey): {
  provider_type: 'direct' | 'aggregator' | 'hosted';
  origin_vendor: string;
  endpoint?: string;
} {
  if (provider === 'openrouter')
    return { provider_type: 'aggregator', origin_vendor: 'OpenRouter' };
  if (provider === 'openai') return { provider_type: 'direct', origin_vendor: 'OpenAI' };
  if (provider === 'anthropic') return { provider_type: 'direct', origin_vendor: 'Anthropic' };
  if (provider === 'gemini') return { provider_type: 'direct', origin_vendor: 'Google' };
  if (provider === 'deepseek') return { provider_type: 'direct', origin_vendor: 'DeepSeek' };
  if (provider === 'zai') return { provider_type: 'direct', origin_vendor: 'ZhipuAI' };
  if (provider === 'replicate') return { provider_type: 'hosted', origin_vendor: 'Replicate' };
  return { provider_type: 'direct', origin_vendor: 'Unknown' };
}

function defaultEndpointFor(provider: ProviderKey): string | null {
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  if (provider === 'openai') return 'https://api.openai.com/v1';
  if (provider === 'anthropic') return 'https://api.anthropic.com';
  if (provider === 'deepseek') return 'https://api.deepseek.com';
  if (provider === 'zai') return 'https://api.z.ai/api/paas/v4';
  if (provider === 'replicate') return 'https://api.replicate.com/v1';
  return null;
}

export async function applyRecommendedModelPreset(params: {
  dryRun?: boolean;
  overwrite?: boolean;
  replicateImageModel?: string | null;
  openaiImageModel?: string | null;
}): Promise<ApplyRecommendedPresetResult> {
  const dryRun = params.dryRun === true;
  const overwrite = params.overwrite === true;
  const notes: string[] = [];

  let createdProviders = 0;
  let updatedProviders = 0;
  let createdTierAssignments = 0;
  let createdPurposes = 0;
  let createdPurposeAssignments = 0;

  // 1) Seed purposes (idempotent)
  for (const p of DEFAULT_PURPOSES) {
    const existed = await dbGet(`SELECT purpose FROM ai_purposes WHERE purpose = ?`, [p.purpose], {
      fallback: true,
    } as any);
    await upsertPurpose({
      purpose: p.purpose,
      kind: p.kind,
      defaultTier: p.default_tier || null,
      requirements: p.requirements,
      description: p.description,
      dryRun,
    });
    if (!existed) createdPurposes += 1;
  }

  // 2) Discover and upsert recommended TEXT providers
  const textProviders: ProviderKey[] = [
    'openrouter',
    'openai',
    'anthropic',
    'gemini',
    'deepseek',
    'zai',
  ];
  const createdIds: Record<string, { fast?: string; deep?: string; image?: string }> = {};

  for (const provider of textProviders) {
    const apiKey = getApiKey(provider);
    if (!apiKey) {
      notes.push(`${provider}: skipped (missing env key ${envKeyForProvider(provider) || 'n/a'})`);
      continue;
    }

    const endpoint = defaultEndpointFor(provider);
    // z.ai / deepseek are OpenAI-compatible; allow endpoint override if env provides base URL
    const endpointOverride =
      provider === 'deepseek'
        ? String(process.env.DEEPSEEK_BASE_URL || '').trim()
        : provider === 'zai'
          ? String(process.env.ZAI_BASE_URL || '').trim()
          : '';

    const {
      fast,
      deep,
      notes: n,
    } = await discoverRecommendedTextModels({
      provider,
      apiKey,
      endpoint: endpointOverride || endpoint,
    });
    notes.push(...n);

    if (fast) {
      const meta = providerMeta(provider);
      const r = await upsertProviderRow({
        provider,
        name: `${provider.toUpperCase()} — FAST`,
        modelId: fast,
        kind: 'TEXT_LLM',
        provider_type: meta.provider_type,
        origin_vendor: meta.origin_vendor,
        endpoint: endpointOverride || endpoint,
        execution_regions: ['UNKNOWN'],
        allowed_data_classes: ['no_pii', 'pii'],
        tier: 'BUDGET',
        dryRun,
        overwrite,
      });
      createdIds[provider] = { ...(createdIds[provider] || {}), fast: r.id };
      if (r.created) createdProviders += 1;
      if (r.updated) updatedProviders += 1;
      await upsertTierAssignment({ providerId: r.id, tier: 'BUDGET', priority: 10, dryRun });
      createdTierAssignments += dryRun ? 0 : 1;
    }

    if (deep) {
      const meta = providerMeta(provider);
      const r = await upsertProviderRow({
        provider,
        name: `${provider.toUpperCase()} — DEEP`,
        modelId: deep,
        kind: 'TEXT_LLM',
        provider_type: meta.provider_type,
        origin_vendor: meta.origin_vendor,
        endpoint: endpointOverride || endpoint,
        execution_regions: ['UNKNOWN'],
        allowed_data_classes: ['no_pii', 'pii', 'confidential'],
        tier: 'REASONING',
        dryRun,
        overwrite,
      });
      createdIds[provider] = { ...(createdIds[provider] || {}), deep: r.id };
      if (r.created) createdProviders += 1;
      if (r.updated) updatedProviders += 1;
      await upsertTierAssignment({ providerId: r.id, tier: 'REASONING', priority: 10, dryRun });
      createdTierAssignments += dryRun ? 0 : 1;
    }
  }

  // 3) Image providers: OpenAI image (direct) + Replicate (hosted)
  // OpenAI image model id is not reliably discoverable via /models, so allow env override.
  const openaiKey = getApiKey('openai');
  const openaiImageModel =
    String(params.openaiImageModel || '').trim() ||
    String(process.env.OPENAI_IMAGE_MODEL_ID || '').trim() ||
    'gpt-image-1';

  if (openaiKey) {
    const r = await upsertProviderRow({
      provider: 'openai',
      name: `OPENAI — IMAGE`,
      modelId: openaiImageModel,
      kind: 'IMAGE_MODEL',
      provider_type: 'direct',
      origin_vendor: 'OpenAI',
      endpoint: defaultEndpointFor('openai'),
      execution_regions: ['UNKNOWN'],
      allowed_data_classes: ['no_pii', 'pii'],
      tier: 'PREMIUM',
      dryRun,
      overwrite,
    });
    createdIds.openai = { ...(createdIds.openai || {}), image: r.id };
    if (r.created) createdProviders += 1;
    if (r.updated) updatedProviders += 1;
  }

  const replicateKey = getApiKey('replicate');
  const replicateImageModel =
    String(params.replicateImageModel || '').trim() ||
    String(process.env.REPLICATE_DEFAULT_IMAGE_MODEL || '').trim() ||
    '';

  if (replicateKey) {
    const ok = await listReplicateModels(replicateKey, defaultEndpointFor('replicate'));
    if (!ok) notes.push('replicate: auth check failed, skipping provider row');
    else if (!replicateImageModel) {
      notes.push('replicate: configured, but no model id set (set REPLICATE_DEFAULT_IMAGE_MODEL)');
    } else {
      const r = await upsertProviderRow({
        provider: 'replicate',
        name: `REPLICATE — IMAGE`,
        modelId: replicateImageModel,
        kind: 'IMAGE_MODEL',
        provider_type: 'hosted',
        origin_vendor: 'Replicate',
        endpoint: defaultEndpointFor('replicate'),
        execution_regions: ['UNKNOWN'],
        allowed_data_classes: ['no_pii'],
        tier: 'PREMIUM',
        dryRun,
        overwrite,
      });
      createdIds.replicate = { ...(createdIds.replicate || {}), image: r.id };
      if (r.created) createdProviders += 1;
      if (r.updated) updatedProviders += 1;
    }
  }

  // 4) Purpose assignments (global chains). We keep this conservative:
  // - fast chain used for chat_simple / copy polish
  // - deep chain used for full_report / roadmap / risk scan
  const chainFast = [
    createdIds.openai?.fast,
    createdIds.anthropic?.fast,
    createdIds.gemini?.fast,
    createdIds.openrouter?.fast,
    createdIds.deepseek?.fast,
    createdIds.zai?.fast,
  ].filter(Boolean) as string[];

  const chainDeep = [
    createdIds.openai?.deep,
    createdIds.anthropic?.deep,
    createdIds.gemini?.deep,
    createdIds.openrouter?.deep,
    createdIds.deepseek?.deep,
    createdIds.zai?.deep,
  ].filter(Boolean) as string[];

  const assignMany = async (purpose: string, providerIds: string[], basePriority: number) => {
    let pr = basePriority;
    for (const pid of providerIds) {
      await upsertPurposeAssignment({ purpose, providerId: pid, priority: pr, dryRun });
      createdPurposeAssignments += dryRun ? 0 : 1;
      pr += 10;
    }
  };

  await assignMany('chat_simple', chainFast, 10);
  await assignMany('chat_confirm', chainFast, 10);
  await assignMany('deck_copy_polish', chainFast, 10);

  await assignMany('chat_complex', [...chainFast, ...chainDeep], 10);
  await assignMany('tool_recommendation', [...chainFast, ...chainDeep], 10);
  await assignMany('session_missing_items', [...chainFast, ...chainDeep], 10);

  await assignMany('session_summary', chainDeep.length ? chainDeep : chainFast, 10);
  await assignMany('report_section', chainDeep.length ? chainDeep : chainFast, 10);
  await assignMany('deck_outline', chainDeep.length ? chainDeep : chainFast, 10);

  // Deep Research purposes: prefer deep chain (quality + citations), fallback to fast.
  const chainResearchDeep = chainDeep.length ? chainDeep : chainFast;
  await assignMany('deep_research_plan', chainResearchDeep, 10);
  await assignMany('deep_research_claims_extract', chainResearchDeep, 10);
  await assignMany('deep_research_synthesis', chainResearchDeep, 10);
  await assignMany('deep_research_contradictions', chainResearchDeep, 10);
  await assignMany('deep_research_quality_gate', chainResearchDeep, 10);
  await assignMany('deep_research_export_polish', chainFast, 10);

  await assignMany('full_report', chainDeep, 10);
  await assignMany('build_roadmap', chainDeep, 10);
  await assignMany('governance_risk_scan', chainDeep, 10);
  await assignMany('validate_initiative', chainDeep.length ? chainDeep : chainFast, 10);

  // Vision purposes: prefer deep chain (usually better multimodal), fallback to fast chain
  await assignMany('vision_extract', chainDeep.length ? chainDeep : chainFast, 10);
  await assignMany('vision_compare', chainDeep.length ? chainDeep : chainFast, 10);

  // Image purposes: prefer OpenAI image row, then Replicate
  const imageChain = [createdIds.openai?.image, createdIds.replicate?.image].filter(
    Boolean
  ) as string[];
  if (imageChain.length > 0) {
    await assignMany('image_cover', imageChain, 10);
    await assignMany('image_diagram', imageChain, 10);
    await assignMany('image_slide_asset', imageChain, 10);
  } else {
    notes.push('images: no image provider rows created (configure OpenAI and/or Replicate)');
  }

  if (dryRun) {
    notes.push('dryRun=true: no DB changes applied');
  }

  logger.info('[RecommendedPreset] applied', {
    dryRun,
    createdProviders,
    updatedProviders,
    createdTierAssignments,
    createdPurposes,
    createdPurposeAssignments,
  });

  return {
    success: true,
    dryRun,
    createdProviders,
    updatedProviders,
    createdTierAssignments,
    createdPurposes,
    createdPurposeAssignments,
    notes,
  };
}
