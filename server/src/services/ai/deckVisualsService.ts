/**
 * Deck Visuals Service (v3)
 *
 * Gamma-like enhancement for PPTX generation:
 * - Select IMAGE_MODEL providers via v3 Purpose Assignments (`image_cover`, ...)
 * - Generate images (best-effort) and attach as slide visuals
 *
 * Safe by default: failures only add warnings and never block PPTX export.
 */
import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import { selectStockImageProvider } from '../deliverables/stockImageProvider.js';
import { routeImage } from '../deliverables/imageRouter.js';
import logger from '../../utils/Logger.js';
import type { SlideVisualSpec, UnifiedReportMeta } from '../report/pptx/types.js';

type VisualPriority = 'quality' | 'cost';

type ProviderRow = {
  id: string;
  provider: string;
  model_id?: string | null;
  api_key?: string | null;
  endpoint?: string | null;
  provider_type?: string | null;
  origin_vendor?: string | null;
  execution_regions?: any;
  tier?: string | null;
};

type PurposeAssignmentRow = {
  provider_id: string;
  model_id?: string | null;
  priority?: number | null;
  organization_id?: string | null;
};

function normalizeStringSet(value: any): Set<string> {
  const out = new Set<string>();
  if (!value) return out;
  if (Array.isArray(value)) {
    for (const v of value) {
      const s = String(v || '')
        .trim()
        .toLowerCase();
      if (s) out.add(s);
    }
    return out;
  }
  const s = String(value || '').trim();
  if (!s) return out;
  for (const item of s.split(',')) {
    const v = String(item || '')
      .trim()
      .toLowerCase();
    if (v) out.add(v);
  }
  return out;
}

function normalizeRegions(value: any): string[] {
  try {
    if (!value) return ['UNKNOWN'];
    if (Array.isArray(value)) {
      return value.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
    }
    const s = String(value || '').trim();
    if (!s) return ['UNKNOWN'];
    if (s.startsWith('[')) {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        return arr.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
      }
    }
    return s
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);
  } catch {
    return ['UNKNOWN'];
  }
}

async function getOrgPolicy(organizationId: string): Promise<any | null> {
  const orgId = String(organizationId || '').trim();
  if (!orgId) return null;
  try {
    const row = await dbGet(`SELECT policy FROM organization_ai_policy WHERE organization_id = ?`, [
      orgId,
    ]);
    const raw = (row as any)?.policy ?? null;
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return raw;
  } catch {
    return null;
  }
}

function isAllowedByPolicy(row: ProviderRow, policy: any | null, dataClass: string): boolean {
  const pt = String(row.provider_type || '').toLowerCase() || 'unknown';
  const origin = String(row.origin_vendor || '').toLowerCase() || 'unknown';
  const regions = normalizeRegions(row.execution_regions);

  if (policy && typeof policy === 'object') {
    const denyProviderTypes = normalizeStringSet(
      policy.deny_provider_types || policy.denyProviderTypes
    );
    if (denyProviderTypes.size > 0 && denyProviderTypes.has(pt)) return false;

    const allowProviderTypes = normalizeStringSet(
      policy.allow_provider_types || policy.allowProviderTypes
    );
    if (allowProviderTypes.size > 0 && !allowProviderTypes.has(pt)) return false;

    const denyOrigins = normalizeStringSet(policy.deny_origin_vendors || policy.denyOrigins);
    if (denyOrigins.size > 0 && denyOrigins.has(origin)) return false;

    const allowOrigins = normalizeStringSet(policy.allow_origin_vendors || policy.allowOrigins);
    if (allowOrigins.size > 0 && !allowOrigins.has(origin)) return false;

    const denyRegions = normalizeStringSet(policy.deny_regions || policy.denyRegions);
    if (denyRegions.size > 0 && regions.some((r) => denyRegions.has(r))) return false;

    const allowRegions = normalizeStringSet(policy.allow_regions || policy.allowRegions);
    if (allowRegions.size > 0 && !regions.some((r) => allowRegions.has(r))) return false;

    const requireLocalFor = normalizeStringSet(
      policy.require_local_for_data_classes || policy.requireLocalForDataClasses
    );
    if (requireLocalFor.size > 0 && requireLocalFor.has(dataClass)) {
      if (pt !== 'local' && pt !== 'customer_managed') return false;
    }
  } else {
    // Default safe rule: confidential -> local/customer_managed only
    if (dataClass === 'confidential') {
      if (pt !== 'local' && pt !== 'customer_managed') return false;
    }
  }

  return true;
}

function resolveApiKey(provider: string, apiKeyFromDb?: string | null): string | null {
  const fromDb = String(apiKeyFromDb || '').trim();
  if (fromDb) return fromDb;
  const p = String(provider || '')
    .trim()
    .toLowerCase();
  if (p === 'openai') return String(process.env.OPENAI_API_KEY || '').trim() || null;
  return null;
}

async function selectProviderForPurpose(params: {
  organizationId: string;
  purpose: 'image_cover' | 'image_diagram' | 'image_slide_asset';
  priority: VisualPriority;
  dataClass: 'no_pii' | 'pii' | 'confidential';
}): Promise<{
  provider: ProviderRow;
  assignment: PurposeAssignmentRow;
  apiKey: string;
  modelId: string;
} | null> {
  const { organizationId, purpose, priority, dataClass } = params;
  try {
    const orgPolicy = await getOrgPolicy(organizationId);

    // Prefer org-specific assignments, fallback to global (organization_id IS NULL)
    const assignments = (await dbAll(
      `SELECT provider_id, model_id, priority, organization_id
       FROM ai_purpose_assignments
       WHERE purpose = ?
         AND is_active = 1
         AND (organization_id = ? OR organization_id IS NULL)
       ORDER BY CASE WHEN organization_id = ? THEN 1 ELSE 0 END DESC,
                priority DESC,
                created_at DESC`,
      [purpose, organizationId, organizationId]
    )) as any[];

    for (const a of assignments || []) {
      const provider = (await dbGet(`SELECT * FROM llm_providers WHERE id = ? AND is_active = 1`, [
        a.provider_id,
      ])) as any;
      if (!provider) continue;

      // Optional quality vs cost gating via provider.tier (if populated)
      const tier = String(provider.tier || '').toUpperCase();
      if (priority === 'cost' && tier && !['BUDGET', 'STANDARD'].includes(tier)) continue;
      if (priority === 'quality' && tier && ['BUDGET'].includes(tier)) continue;

      if (!isAllowedByPolicy(provider as ProviderRow, orgPolicy, dataClass)) continue;

      const apiKey = resolveApiKey(String(provider.provider || ''), provider.api_key);
      if (!apiKey) continue;

      const modelId = String(a.model_id || provider.model_id || '').trim();
      if (!modelId) continue;

      return {
        provider: provider as ProviderRow,
        assignment: a as PurposeAssignmentRow,
        apiKey,
        modelId,
      };
    }
  } catch (err: any) {
    logger.warn(`[DeckVisuals] Provider selection failed for ${params.purpose}: ${err.message}`);
  }
  return null;
}

async function generateWithOpenAI(params: {
  apiKey: string;
  endpoint?: string | null;
  model: string;
  prompt: string;
  size: '1024x1024' | '1792x1024' | '1024x1792';
}): Promise<Buffer> {
  const baseUrl = String(params.endpoint || '').trim() || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/images/generations`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      size: params.size,
      n: 1,
      response_format: 'b64_json',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI image generation failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json: any = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (b64 && typeof b64 === 'string') {
    return Buffer.from(b64, 'base64');
  }

  const imageUrl = json?.data?.[0]?.url;
  if (imageUrl && typeof imageUrl === 'string') {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`OpenAI image download failed (${imgRes.status})`);
    const arr = await imgRes.arrayBuffer();
    return Buffer.from(arr);
  }

  throw new Error('OpenAI image generation returned no image data');
}

export async function generateWithReplicate(params: {
  apiToken: string;
  endpoint?: string | null;
  model: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<Buffer> {
  const baseUrl = String(params.endpoint || '').trim() || 'https://api.replicate.com/v1';
  const base = baseUrl.replace(/\/+$/, '');
  const timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : 120_000;

  const headers = {
    Authorization: `Token ${String(params.apiToken).trim()}`,
    'Content-Type': 'application/json',
  };

  // Replicate accepts either a `version` (UUID-ish) on /predictions, or an
  // `owner/name` slug on the model-scoped /models/{owner}/{name}/predictions
  // endpoint. The bare-slug `{model}` field on /predictions is NOT accepted for
  // official models (422 "version is required") — so route owner/name slugs to
  // the model-scoped endpoint instead.
  const modelId = String(params.model || '').trim();
  const looksLikeVersion = /^[a-f0-9]{8,}[-a-f0-9]{16,}$/i.test(modelId) || modelId.length >= 30;
  const slugMatch = /^([\w.-]+)\/([\w.-]+?)(?::(.+))?$/.exec(modelId);

  const body: any = {
    input: {
      prompt: params.prompt,
    },
  };

  let createUrl = `${base}/predictions`;
  if (looksLikeVersion) {
    body.version = modelId;
  } else if (slugMatch && !slugMatch[3]) {
    // owner/name (no pinned :version) → model-scoped predictions endpoint.
    createUrl = `${base}/models/${slugMatch[1]}/${slugMatch[2]}/predictions`;
  } else if (slugMatch && slugMatch[3]) {
    // owner/name:version → pin the version on the generic endpoint.
    body.version = slugMatch[3];
  } else {
    body.model = modelId;
  }

  const created = await fetch(createUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!created.ok) {
    const text = await created.text().catch(() => '');
    throw new Error(`Replicate create failed (${created.status}): ${text.slice(0, 300)}`);
  }
  const pred: any = await created.json();
  const id = String(pred?.id || '').trim();
  if (!id) throw new Error('Replicate returned no prediction id');

  const startedAt = Date.now();
  let status = String(pred?.status || '').toLowerCase();
  let last: any = pred;

  // Poll until succeeded / failed / canceled
  while (Date.now() - startedAt < timeoutMs) {
    if (status === 'succeeded') break;
    if (status === 'failed' || status === 'canceled' || status === 'cancelled') {
      const err = last?.error || last?.logs || 'Replicate prediction failed';
      throw new Error(String(err).slice(0, 400));
    }

    // backoff
    await new Promise((r) => setTimeout(r, 1200));
    const res = await fetch(`${base}/predictions/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Replicate poll failed (${res.status}): ${text.slice(0, 300)}`);
    }
    last = await res.json();
    status = String(last?.status || '').toLowerCase();
  }

  if (status !== 'succeeded') throw new Error('Replicate prediction timed out');

  const output = last?.output;
  const url =
    (typeof output === 'string' && output) ||
    (Array.isArray(output) && typeof output[0] === 'string' ? output[0] : '') ||
    '';
  if (!url) throw new Error('Replicate returned no output URL');

  const imgRes = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!imgRes.ok) throw new Error(`Replicate image download failed (${imgRes.status})`);
  const arr = await imgRes.arrayBuffer();
  return Buffer.from(arr);
}

/**
 * Gemini "nano-banana" (Gemini 2.5 Flash Image) image generation.
 *
 * POST :generateContent with responseModalities:["IMAGE"]; the image bytes come
 * back as base64 inside candidates[0].content.parts[].inlineData.data.
 * Default model `gemini-2.5-flash-image`; on 404 we retry the `-preview` slug.
 * Throws on no image so the dispatcher can fail-open to the next provider/stock.
 */
export async function generateWithGemini(params: {
  apiKey: string;
  endpoint?: string | null;
  model: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<Buffer> {
  const apiKey = String(params.apiKey || '').trim();
  if (!apiKey) throw new Error('Gemini API key missing (GEMINI_API_KEY)');

  const base =
    String(params.endpoint || '').trim().replace(/\/+$/, '') ||
    'https://generativelanguage.googleapis.com/v1beta';
  const timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : 60_000;

  const requestedModel = String(params.model || '').trim() || 'gemini-2.5-flash-image';
  // Candidate models: requested first, then a preview fallback (nano-banana
  // ships under both slugs depending on the API rollout state).
  const candidates =
    requestedModel === 'gemini-2.5-flash-image'
      ? ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview']
      : [requestedModel, 'gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview'];
  const tried = new Set<string>();

  const body = {
    contents: [{ parts: [{ text: params.prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };

  let lastErr = 'Gemini image generation returned no image data';
  for (const model of candidates) {
    if (tried.has(model)) continue;
    tried.add(model);

    const url = `${base}/models/${encodeURIComponent(model)}:generateContent`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err: any) {
      lastErr = `Gemini request failed (${model}): ${err?.message || err}`;
      continue;
    }

    if (res.status === 404) {
      // Model slug not available — try next candidate.
      lastErr = `Gemini model not found (${model}, 404)`;
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini image generation failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const json: any = await res.json().catch(() => null);
    const parts: any[] = json?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      const b64 = part?.inlineData?.data ?? part?.inline_data?.data;
      if (b64 && typeof b64 === 'string') {
        return Buffer.from(b64, 'base64');
      }
    }
    lastErr = `Gemini returned no image data (${model})`;
  }

  throw new Error(lastErr);
}

type ImageProviderSelection = {
  provider: ProviderRow;
  apiKey: string;
  modelId: string;
};

/**
 * ENV-default image provider chooser — used when no DB purpose-assignment exists.
 *
 * Reads DELIVERABLE_IMAGE_PROVIDER (gemini | replicate | openai | off; default
 * `gemini`) + optional DELIVERABLE_IMAGE_MODEL override. Returns a synthetic
 * selection wired to the matching env API key, or null when the provider is
 * `off` / no key is present (fail-open: callers fall through to stock).
 */
export function resolveDefaultImageProvider(): ImageProviderSelection | null {
  const choice = String(process.env.DELIVERABLE_IMAGE_PROVIDER || 'gemini')
    .trim()
    .toLowerCase();
  if (choice === 'off' || choice === 'none' || choice === 'disabled') return null;

  const modelOverride = String(process.env.DELIVERABLE_IMAGE_MODEL || '').trim();

  if (choice === 'gemini' || choice === 'google') {
    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return null;
    return {
      provider: { id: 'env-default', provider: 'gemini', endpoint: null, api_key: null },
      apiKey,
      modelId: modelOverride || 'gemini-2.5-flash-image',
    };
  }

  if (choice === 'replicate') {
    const apiKey = String(
      process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || ''
    ).trim();
    if (!apiKey) return null;
    return {
      provider: { id: 'env-default', provider: 'replicate', endpoint: null, api_key: null },
      apiKey,
      modelId: modelOverride || 'qwen/qwen-image',
    };
  }

  if (choice === 'openai') {
    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) return null;
    return {
      provider: { id: 'env-default', provider: 'openai', endpoint: null, api_key: null },
      apiKey,
      modelId: modelOverride || 'dall-e-3',
    };
  }

  return null;
}

/**
 * Stock-image fallback (Unsplash by default when UNSPLASH_ACCESS_KEY is set).
 * Downloads the chosen photo to the deck assets dir so the PPTX renderer gets a
 * local path. Returns null on any miss (fail-open).
 *
 * P2.1 — routed through `imageRouter.routeImage()` (F9.1/F9.3) so the
 * tier/provider/credit decision for this "photo" content type is made by the
 * same SSOT the bundle pipeline already uses (`bundleGenerationRuntime.ts`
 * W1.7), instead of duplicating the T0-vs-explicit-provider logic ad hoc.
 * `package: 'lite'` clamps content-type routing to T0/T1 — `photo` always
 * prefers T0 (stock) regardless, so this NEVER selects a paid/premium tier;
 * T2/T3 (Ideogram/Recraft) stay untouched pending Piotr's decision.
 * Self-gating: with no provider keys configured, `selectStockImageProvider`
 * still falls back to the null provider below — behavior is byte-identical
 * to pre-P2.1 when UNSPLASH_ACCESS_KEY/PEXELS_API_KEY are absent.
 */
async function tryStockFallback(params: {
  deckId: string;
  prompt: string;
  query: string;
  slot: SlideVisualSpec['slot'];
  purpose: SlideVisualSpec['purpose'];
  label: string;
  styleHint?: string;
  brandColor?: string;
  filenamePrefix: string;
}): Promise<SlideVisualSpec | null> {
  try {
    // Default to Unsplash when its key exists and no explicit STOCK_IMAGE_PROVIDER set.
    const explicit = String(process.env.STOCK_IMAGE_PROVIDER || '').trim();
    const hasUnsplash = !!String(process.env.UNSPLASH_ACCESS_KEY || '').trim();

    // imageRouter decision (F9.1/F9.3): 'photo' content-type always routes to
    // T0/stock regardless of package — this call never escalates to a paid
    // tier (route.creditCost is always 0 for T0). Kept as an explicit,
    // auditable step rather than only implicit env sniffing; the resolved
    // provider name is ignored when an explicit STOCK_IMAGE_PROVIDER env
    // override is set.
    const route = routeImage({ contentType: 'photo', package: 'lite' });
    const providerCfg = explicit
      ? {}
      : hasUnsplash
        ? { provider: 'unsplash' as const }
        : route.provider === 'unsplash'
          ? { provider: 'unsplash' as const }
          : {};
    const provider = selectStockImageProvider(providerCfg);
    if (provider.name === 'null') return null;

    const result = await provider.fetchImage(params.query, { orientation: 'landscape' });
    if (!result?.url) return null;

    let assetPath: string | undefined;
    try {
      const imgRes = await fetch(result.url, { signal: AbortSignal.timeout(30_000) });
      if (imgRes.ok) {
        const arr = await imgRes.arrayBuffer();
        const buf = Buffer.from(arr);
        if (buf.length > 0) {
          const fs = await import('fs');
          const path = await import('path');
          const assetsDir = path.default.join(
            process.cwd(),
            'exports',
            'presentations',
            'assets',
            params.deckId
          );
          if (!fs.default.existsSync(assetsDir))
            fs.default.mkdirSync(assetsDir, { recursive: true });
          const filename = `${params.filenamePrefix}_stock_${uuidv4().slice(0, 8)}.jpg`;
          assetPath = path.default.join(assetsDir, filename);
          fs.default.writeFileSync(assetPath, buf);
        }
      }
    } catch (err: any) {
      logger.warn(`[DeckVisuals] Stock image download failed: ${err?.message || err}`);
    }

    const visual: SlideVisualSpec = {
      slot: params.slot,
      purpose: params.purpose,
      label: `${params.label} (stock: ${result.provider})`,
      prompt: params.prompt,
      styleHint: params.styleHint,
      palette: params.brandColor ? { primary: params.brandColor.replace('#', '') } : undefined,
      aspect: '16:9',
      asset: assetPath
        ? { path: assetPath, provider: `stock:${result.provider}` }
        : { url: result.url, provider: `stock:${result.provider}` },
    };
    return visual;
  } catch (err: any) {
    logger.warn(`[DeckVisuals] Stock fallback failed: ${err?.message || err}`);
    return null;
  }
}

async function generateImageVisual(params: {
  deckId: string;
  organizationId: string;
  meta: UnifiedReportMeta;
  purpose: 'image_cover' | 'image_diagram' | 'image_slide_asset';
  slot: SlideVisualSpec['slot'];
  label: string;
  prompt: string;
  styleHint?: string;
  brandColor?: string;
  priority: VisualPriority;
  dataClass?: 'no_pii' | 'pii' | 'confidential';
  filenamePrefix: string;
}): Promise<{ visual?: SlideVisualSpec; warning?: string }> {
  const priority = params.priority || 'quality';
  const dataClass = params.dataClass || 'no_pii';

  // DB-driven purpose assignment first; else env-default chain (gemini→…).
  const dbSelection = await selectProviderForPurpose({
    organizationId: params.organizationId,
    purpose: params.purpose,
    priority,
    dataClass,
  });
  const selection: ImageProviderSelection | null =
    dbSelection
      ? {
          provider: dbSelection.provider,
          apiKey: dbSelection.apiKey,
          modelId: dbSelection.modelId,
        }
      : resolveDefaultImageProvider();

  const stockQuery = String(params.styleHint || params.label || params.prompt || '').slice(0, 200);

  if (!selection) {
    // No AI provider configured/available — try stock before giving up.
    const stock = await tryStockFallback({
      deckId: params.deckId,
      prompt: params.prompt,
      query: stockQuery || params.prompt,
      slot: params.slot,
      purpose: params.purpose,
      label: params.label,
      styleHint: params.styleHint,
      brandColor: params.brandColor,
      filenamePrefix: params.filenamePrefix,
    });
    if (stock) return { visual: stock };
    return {
      warning: `No configured image provider for purpose=${params.purpose} (DB + env default off, no stock).`,
    };
  }

  try {
    const size: '1024x1024' | '1792x1024' = priority === 'quality' ? '1792x1024' : '1024x1024';
    const providerName = String(selection.provider.provider || '').toLowerCase();

    let buf: Buffer;
    if (providerName === 'openai') {
      buf = await generateWithOpenAI({
        apiKey: selection.apiKey,
        endpoint: selection.provider.endpoint,
        model: selection.modelId,
        prompt: params.prompt,
        size,
      });
    } else if (providerName === 'google' || providerName === 'gemini') {
      const apiKey = selection.apiKey || process.env.GEMINI_API_KEY || '';
      if (!apiKey.trim()) {
        throw new Error('No Gemini API key configured (GEMINI_API_KEY).');
      }
      // Gemini returns square images; size hint is ignored (tolerant).
      buf = await generateWithGemini({
        apiKey,
        endpoint: selection.provider.endpoint,
        model: selection.modelId,
        prompt: params.prompt,
      });
    } else if (providerName === 'replicate') {
      const token =
        selection.apiKey || process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || '';
      if (!token.trim())
        throw new Error('No Replicate API token configured (REPLICATE_API_TOKEN).');
      buf = await generateWithReplicate({
        apiToken: token,
        endpoint: selection.provider.endpoint,
        model: selection.modelId,
        prompt: params.prompt,
      });
    } else {
      throw new Error(`Unsupported image provider adapter: ${providerName}`);
    }

    const fs = await import('fs');
    const path = await import('path');
    const assetsDir = path.default.join(
      process.cwd(),
      'exports',
      'presentations',
      'assets',
      params.deckId
    );
    if (!fs.default.existsSync(assetsDir)) fs.default.mkdirSync(assetsDir, { recursive: true });
    const filename = `${params.filenamePrefix}_${uuidv4().slice(0, 8)}.png`;
    const outPath = path.default.join(assetsDir, filename);
    fs.default.writeFileSync(outPath, buf);

    const visual: SlideVisualSpec = {
      slot: params.slot,
      purpose: params.purpose,
      label: params.label,
      prompt: params.prompt,
      styleHint: params.styleHint,
      palette: params.brandColor ? { primary: params.brandColor.replace('#', '') } : undefined,
      aspect: '16:9',
      asset: {
        path: outPath,
        provider: providerName,
        model_id: selection.modelId,
      },
    };

    return { visual };
  } catch (err: any) {
    logger.warn(
      `[DeckVisuals] Image generation failed (${params.purpose}/${params.slot}): ${err.message} — trying stock fallback`
    );
    // AI generation failed → fall back to stock (Unsplash) before warning.
    const stock = await tryStockFallback({
      deckId: params.deckId,
      prompt: params.prompt,
      query: stockQuery || params.prompt,
      slot: params.slot,
      purpose: params.purpose,
      label: params.label,
      styleHint: params.styleHint,
      brandColor: params.brandColor,
      filenamePrefix: params.filenamePrefix,
    });
    if (stock) return { visual: stock };
    return {
      warning: `Image generation failed (${params.purpose}/${params.slot}): ${err.message}`,
    };
  }
}

export async function generateCoverVisual(params: {
  deckId: string;
  organizationId: string;
  meta: UnifiedReportMeta;
  title: string;
  goal: string;
  audience: string;
  brandColor?: string;
  priority: VisualPriority;
  dataClass?: 'no_pii' | 'pii' | 'confidential';
}): Promise<{ visual?: SlideVisualSpec; warning?: string }> {
  const priority = params.priority || 'quality';
  const dataClass = params.dataClass || 'no_pii';

  const style =
    params.meta.template === 'minimal'
      ? 'minimal, clean, lots of whitespace, subtle gradients'
      : params.meta.template === 'modern'
        ? 'modern, vibrant, premium SaaS, abstract shapes'
        : 'corporate, BCG-grade, elegant, understated';

  const langHint =
    params.meta.language === 'pl'
      ? 'Bez tekstu w obrazie. Zero napisów.'
      : 'No text in the image. Zero lettering.';

  const prompt = [
    `${style}.`,
    `A premium 16:9 hero cover image for a consulting PowerPoint deck.`,
    `Topic: "${params.title}".`,
    `Audience: ${params.audience}. Goal: ${params.goal}.`,
    params.brandColor ? `Color palette anchored on #${params.brandColor.replace('#', '')}.` : '',
    `Feel: confident, sharp, business, high-end.`,
    langHint,
    `No logos, no watermarks.`,
  ]
    .filter(Boolean)
    .join(' ');

  return generateImageVisual({
    deckId: params.deckId,
    organizationId: params.organizationId,
    meta: params.meta,
    purpose: 'image_cover',
    slot: 'cover_bg',
    label: 'AI cover hero',
    prompt,
    styleHint: style,
    brandColor: params.brandColor,
    priority,
    dataClass,
    filenamePrefix: 'cover',
  });
}

export async function generateBackgroundTextureVisual(params: {
  deckId: string;
  organizationId: string;
  meta: UnifiedReportMeta;
  title: string;
  slideTitle?: string;
  keyMessage?: string;
  brandColor?: string;
  priority: VisualPriority;
  dataClass?: 'no_pii' | 'pii' | 'confidential';
  intentHint: 'section_intro' | 'key_messages';
}): Promise<{ visual?: SlideVisualSpec; warning?: string }> {
  const priority = params.priority || 'quality';
  const dataClass = params.dataClass || 'no_pii';

  const style =
    params.meta.template === 'minimal'
      ? 'minimal, clean, subtle paper grain texture, soft gradients'
      : params.meta.template === 'modern'
        ? 'modern, vibrant, abstract soft shapes, premium SaaS background'
        : 'corporate, understated, subtle geometric texture, BCG-grade background';

  const langHint =
    params.meta.language === 'pl'
      ? 'Bez tekstu w obrazie. Zero napisów.'
      : 'No text in the image. Zero lettering.';

  const prompt = [
    `${style}.`,
    `A subtle 16:9 background image for a consulting PowerPoint slide.`,
    `Deck topic: "${params.title}".`,
    params.slideTitle ? `Slide: "${params.slideTitle}".` : '',
    params.keyMessage ? `Key message: "${params.keyMessage}".` : '',
    params.brandColor ? `Color palette anchored on #${params.brandColor.replace('#', '')}.` : '',
    `Very low visual noise, high readability for overlay text and cards.`,
    `No logos, no watermarks.`,
    langHint,
  ]
    .filter(Boolean)
    .join(' ');

  return generateImageVisual({
    deckId: params.deckId,
    organizationId: params.organizationId,
    meta: params.meta,
    purpose: 'image_slide_asset',
    slot: 'background_texture',
    label: `AI background texture (${params.intentHint})`,
    prompt,
    styleHint: style,
    brandColor: params.brandColor,
    priority,
    dataClass,
    filenamePrefix: 'bg',
  });
}

/**
 * Materialize a pre-planned visual (slot+purpose+prompt) into an asset on disk.
 * Best-effort: returns warning on failure.
 */
export async function materializePlannedVisual(params: {
  deckId: string;
  organizationId: string;
  meta: UnifiedReportMeta;
  visual: SlideVisualSpec;
  brandColor?: string;
  priority: VisualPriority;
  dataClass?: 'no_pii' | 'pii' | 'confidential';
}): Promise<{ visual?: SlideVisualSpec; warning?: string }> {
  const v = params.visual;
  if (!v?.purpose || !v?.slot) return { warning: 'Invalid planned visual (missing purpose/slot).' };
  if (v.asset?.path || v.asset?.dataUri || v.asset?.url) return { visual: v };
  const prompt = String(v.prompt || '').trim();
  if (!prompt) return { warning: `Planned visual ${v.purpose}/${v.slot} missing prompt.` };

  const filenamePrefix =
    v.purpose === 'image_cover'
      ? 'cover'
      : v.slot === 'background_texture'
        ? 'bg'
        : v.slot === 'side_illustration'
          ? 'side'
          : v.slot === 'diagram'
            ? 'diagram'
            : 'img';

  const { visual, warning } = await generateImageVisual({
    deckId: params.deckId,
    organizationId: params.organizationId,
    meta: params.meta,
    purpose: v.purpose,
    slot: v.slot,
    label: v.label || `AI visual (${v.purpose}/${v.slot})`,
    prompt,
    styleHint: v.styleHint,
    brandColor: params.brandColor,
    priority: params.priority,
    dataClass: params.dataClass,
    filenamePrefix,
  });

  if (warning) return { warning };
  if (!visual) return { warning: `Failed to materialize visual ${v.purpose}/${v.slot}.` };

  // Preserve original planning metadata if not overridden by generator result
  return {
    visual: {
      ...v,
      ...visual,
      label: v.label || visual.label,
      prompt: v.prompt || visual.prompt,
      styleHint: v.styleHint || visual.styleHint,
      palette: v.palette || visual.palette,
    },
  };
}
