/**
 * Seed / upsert LLM providers from environment variables.
 *
 * Usage:
 *   OPENAI_API_KEY=... GEMINI_API_KEY=... pnpm tsx server/scripts/seed-llm-providers.ts
 *
 * Environment (read-only):
 *   OPENAI_API_KEY
 *   GEMINI_API_KEY or GOOGLE_API_KEY
 *   ANTHROPIC_API_KEY
 *   ZHIPU_API_KEY
 *   DEEPSEEK_API_KEY
 *   OLLAMA_ENDPOINT (defaults to http://localhost:11434)
 *
 * The script:
 *   - Upserts rows in llm_providers for the keys found.
 *   - Sets is_active=1 when key/endpoint is present.
 *   - Provides sensible defaults for models and costs (can be edited later in UI).
 */

import { v4 as uuidv4 } from 'uuid';
import { all, get, run } from '../src/utils/DbPromise.js';

type ProviderSeed = {
  id: string;
  name: string;
  provider: string;
  apiKey?: string;
  endpoint?: string;
  modelId?: string;
  costPer1k?: number;
};

const LEGACY_IDS = ['gemini-flash', 'gemini-pro', 'deepseek'];

const seeds: ProviderSeed[] = [
  {
    id: 'openai-gpt4o',
    name: 'OpenAI GPT-4o',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    modelId: 'gpt-4o',
    costPer1k: 0.03,
  },
  {
    id: 'openai-gpt4o-mini',
    name: 'OpenAI GPT-4o-mini',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    modelId: 'gpt-4o-mini',
    costPer1k: 0.005,
  },
  {
    id: 'google-gemini-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    modelId: 'gemini-1.5-pro',
    costPer1k: 0.01,
  },
  {
    id: 'google-gemini-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    modelId: 'gemini-2.0-flash',
    costPer1k: 0.002,
  },
  {
    id: 'anthropic-claude-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    modelId: 'claude-3-5-sonnet',
    costPer1k: 0.012,
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    apiKey: process.env.DEEPSEEK_API_KEY,
    modelId: 'deepseek-chat',
    costPer1k: 0.002,
  },
  {
    id: 'zai-chat',
    name: 'Zhipu GLM-4 Flash',
    provider: 'zhipu',
    apiKey: process.env.ZHIPU_API_KEY,
    modelId: 'glm-4-flash',
    costPer1k: 0.001,
  },
  {
    id: 'nvidia-nim',
    name: 'NVIDIA NIM (Llama 3.1 70B)',
    provider: 'nvidia',
    apiKey: process.env.NVIDIA_API_KEY,
    endpoint: process.env.NVIDIA_ENDPOINT || 'https://integrate.api.nvidia.com/v1/chat/completions',
    modelId: 'meta/llama-3.1-70b-instruct',
    costPer1k: 0.005,
  },
  {
    id: 'cohere-command-r-plus',
    name: 'Cohere Command R+',
    provider: 'cohere',
    apiKey: process.env.COHERE_API_KEY,
    endpoint: process.env.COHERE_ENDPOINT || 'https://api.cohere.ai/v1/chat',
    modelId: 'command-r-plus',
    costPer1k: 0.003,
  },
  {
    id: 'ollama-gemma',
    name: 'Ollama Gemma 3 27B (Local)',
    provider: 'ollama',
    endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
    modelId: 'gemma3:27b',
    costPer1k: 0,
  },
];

async function ensureTable() {
  const table = await all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='llm_providers';",
    []
  );
  if (!table || table.length === 0) {
    throw new Error('llm_providers table not found. Run migrations first.');
  }
}

async function cleanupLegacy() {
  if (!LEGACY_IDS.length) return;
  const placeholders = LEGACY_IDS.map(() => '?').join(',');
  await run(`DELETE FROM llm_providers WHERE id IN (${placeholders})`, LEGACY_IDS);
}

async function upsertProvider(seed: ProviderSeed) {
  const hasKey = Boolean(seed.apiKey || seed.endpoint);
  const existing = (await get('SELECT id FROM llm_providers WHERE id = ?', [seed.id])) as
    | { id: string }
    | undefined;

  if (!hasKey) {
    console.log(`⚠️  Skipping ${seed.id} — no key/endpoint provided.`);
    return;
  }

  const now = new Date().toISOString();

  if (existing) {
    await run(
      `UPDATE llm_providers
             SET name = ?, provider = ?, api_key = ?, endpoint = ?, model_id = ?, cost_per_1k = ?, is_active = 1, updated_at = ?
             WHERE id = ?`,
      [
        seed.name,
        seed.provider,
        seed.apiKey || null,
        seed.endpoint || null,
        seed.modelId || null,
        seed.costPer1k ?? 0,
        now,
        seed.id,
      ]
    );
    console.log(`✅ Updated ${seed.id}`);
  } else {
    await run(
      `INSERT INTO llm_providers (
                 id, name, provider, api_key, endpoint, model_id,
                 cost_per_1k, is_active, visibility, tier, context_window,
                 created_at, updated_at
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'public', 'standard', 4096, ?, ?)`,
      [
        seed.id || uuidv4(),
        seed.name,
        seed.provider,
        seed.apiKey || null,
        seed.endpoint || null,
        seed.modelId || null,
        seed.costPer1k ?? 0,
        now,
        now,
      ]
    );
    console.log(`✅ Inserted ${seed.id}`);
  }
}

async function main() {
  await ensureTable();
  await cleanupLegacy();
  console.log('🔄 Seeding LLM providers from environment...');
  for (const seed of seeds) {
    await upsertProvider(seed);
  }
  console.log(
    '✅ Done. Verify with: sqlite3 server/consultinity.db "SELECT id, provider, is_active FROM llm_providers"'
  );
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
