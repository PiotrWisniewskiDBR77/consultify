/**
 * Dev-render host for the REAL `<ModelCatalogTable />` (SuperAdmin → Model
 * Registry → Catalog), migrated off a bespoke HTML table onto the production
 * <StandardTable>/<StandardModuleBar>/<StandardPreview> facades (kanon
 * TRIADA §27-todo backlog item). No re-implementation: the component fetches
 * through raw `fetch('/api/llm/providers')`, so we stub `window.fetch` with
 * engine-shaped mock JSON keyed by URL path (pattern from
 * dev-render/screens/assessment-reports-table.tsx).
 *
 * Exercises: stats cards (unchanged), Menu2/3 (search + Add Model CTA +
 * All/TEXT_LLM/IMAGE_MODEL/BUSINESS_MODEL chips), StandardTable columns
 * (Name/Provider/Kind/Status/Health/Capabilities/Regions/Cost/Latency) with
 * filterable lejki (Provider Type/Kind/Status/Health), kebab (Edit + Activate-
 * Deactivate + Test Connection, universal Preview/Edit, destructive Delete),
 * side preview panel with resolution actions. Also exercises the fix for the
 * pre-existing crimson trap in IMAGE_MODEL's KIND_BADGE_STYLES (primary-* →
 * purple-*, types.ts).
 */
import React from 'react';

import { ModelCatalogTable } from '../../src/components/SuperAdmin/ModelRegistry/ModelCatalogTable';

const PROVIDERS = [
  {
    id: 'prov-1',
    name: 'GPT-4o',
    provider: 'openai',
    provider_type: 'direct',
    origin_vendor: 'OpenAI',
    model_id: 'gpt-4o',
    kind: 'TEXT_LLM',
    is_active: true,
    health_status: 'healthy',
    avg_latency_ms: 850,
    cost_per_1k: 0.005,
    vision: true,
    tools: true,
    streaming: true,
    json_mode: true,
    context_window: 128000,
    execution_regions: ['us-east', 'eu-west'],
    allowed_data_classes: ['no_pii'],
    created_at: '2026-01-01T08:00:00Z',
    updated_at: '2026-06-01T08:00:00Z',
  },
  {
    id: 'prov-2',
    name: 'Claude Sonnet',
    provider: 'anthropic',
    provider_type: 'direct',
    origin_vendor: 'Anthropic',
    model_id: 'claude-sonnet-4-5',
    kind: 'TEXT_LLM',
    is_active: true,
    health_status: 'healthy',
    avg_latency_ms: 620,
    cost_per_1k: 0.003,
    vision: true,
    tools: true,
    streaming: true,
    json_mode: false,
    context_window: 200000,
    execution_regions: ['us-east'],
    allowed_data_classes: ['no_pii'],
    created_at: '2026-01-05T08:00:00Z',
    updated_at: '2026-07-01T08:00:00Z',
  },
  {
    id: 'prov-3',
    name: 'GLM-4.6 (fallback)',
    provider: 'openrouter',
    provider_type: 'aggregator',
    origin_vendor: 'Zhipu via OpenRouter',
    model_id: 'glm-4.6',
    kind: 'TEXT_LLM',
    is_active: false,
    health_status: 'degraded',
    last_error_category: 'rate_limit',
    last_error_http_status: 429,
    avg_latency_ms: 3400,
    cost_per_1k: 0.0009,
    vision: false,
    tools: true,
    streaming: true,
    json_mode: true,
    context_window: 128000,
    execution_regions: ['us-east'],
    allowed_data_classes: ['no_pii'],
    created_at: '2026-02-01T08:00:00Z',
    updated_at: '2026-07-10T08:00:00Z',
  },
  {
    id: 'prov-4',
    name: 'DALL-E 3',
    provider: 'openai',
    provider_type: 'direct',
    origin_vendor: 'OpenAI',
    model_id: 'dall-e-3',
    kind: 'IMAGE_MODEL',
    is_active: true,
    health_status: 'healthy',
    avg_latency_ms: 4200,
    cost_per_1k: 0.04,
    vision: false,
    tools: false,
    streaming: false,
    json_mode: false,
    context_window: 0,
    execution_regions: ['us-east'],
    allowed_data_classes: ['no_pii'],
    created_at: '2026-01-15T08:00:00Z',
    updated_at: '2026-06-20T08:00:00Z',
  },
  {
    id: 'prov-5',
    name: 'Local Llama (on-prem)',
    provider: 'local',
    provider_type: 'local',
    origin_vendor: 'Self-hosted',
    model_id: 'llama-3.1-70b',
    kind: 'TEXT_LLM',
    is_active: false,
    health_status: 'unhealthy',
    last_error_category: 'network',
    last_error_http_status: 503,
    avg_latency_ms: 0,
    cost_per_1k: 0,
    vision: false,
    tools: false,
    streaming: true,
    json_mode: false,
    context_window: 32000,
    execution_regions: [],
    allowed_data_classes: ['confidential'],
    created_at: '2026-03-01T08:00:00Z',
    updated_at: '2026-07-12T08:00:00Z',
  },
  {
    id: 'prov-6',
    name: 'Lean Suggestions Engine',
    provider: 'customer_managed',
    provider_type: 'customer_managed',
    origin_vendor: 'Customer VPC',
    model_id: 'business-lean-v2',
    kind: 'BUSINESS_MODEL',
    is_active: true,
    health_status: 'unknown',
    avg_latency_ms: 1200,
    cost_per_1k: 0.001,
    vision: false,
    tools: true,
    streaming: false,
    json_mode: true,
    context_window: 16000,
    execution_regions: ['eu-west'],
    allowed_data_classes: ['pii'],
    created_at: '2026-04-01T08:00:00Z',
    updated_at: '2026-07-13T08:00:00Z',
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Install the offline fetch stub once (idempotent across HMR).
const g = window as unknown as { __MODEL_CATALOG_TABLE_FETCH__?: boolean };
if (!g.__MODEL_CATALOG_TABLE_FETCH__) {
  g.__MODEL_CATALOG_TABLE_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (url.includes('/api/llm/providers')) {
        if (init?.method === 'PUT' || init?.method === 'DELETE') {
          return jsonResponse({ ok: true });
        }
        return jsonResponse(PROVIDERS);
      }
      if (url.includes('/api/llm/test')) {
        return jsonResponse({ ok: true, message: 'Connection OK (mock)' });
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function ModelCatalogTableScreen(): React.ReactElement {
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <ModelCatalogTable />
    </div>
  );
}
