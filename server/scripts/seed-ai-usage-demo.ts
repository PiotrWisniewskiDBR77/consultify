/**
 * Seed AI usage demo data for dashboards (Mission Control, Costs, Analytics).
 *
 * Usage:
 *   pnpm tsx server/scripts/seed-ai-usage-demo.ts
 *   or
 *   npm  run db:migrate && pnpm tsx server/scripts/seed-ai-usage-demo.ts
 *
 * The script:
 * - Removes previous demo inserts (metadata.demoSeed = true)
 * - Adds fresh rows to ai_usage_logs with realistic latencies, tokens, costs
 * - Targets the current SQLite database (consultinity.db)
 */

import { v4 as uuidv4 } from 'uuid';

import { all, run } from '../src/utils/DbPromise.js';

type ProviderSeed = {
  provider: string;
  model: string;
  requests: number;
  tokens: number; // total tokens across all synthetic requests
  baseLatencyMs: number;
  statusMix?: { success: number; error: number }; // percent mix
};

const providers: ProviderSeed[] = [
  {
    provider: 'openai',
    model: 'gpt-4o',
    requests: 3500,
    tokens: 4_000_000,
    baseLatencyMs: 1500,
    statusMix: { success: 97, error: 3 },
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    requests: 3200,
    tokens: 3_000_000,
    baseLatencyMs: 1100,
    statusMix: { success: 98, error: 2 },
  },
  {
    provider: 'google',
    model: 'gemini-1.5-pro',
    requests: 1200,
    tokens: 1_100_000,
    baseLatencyMs: 1400,
    statusMix: { success: 96, error: 4 },
  },
  {
    provider: 'deepseek',
    model: 'deepseek-chat',
    requests: 700,
    tokens: 800_000,
    baseLatencyMs: 1800,
    statusMix: { success: 94, error: 6 },
  },
  {
    provider: 'zhipu',
    model: 'glm-4-flash',
    requests: 600,
    tokens: 500_000,
    baseLatencyMs: 900,
    statusMix: { success: 98, error: 2 },
  },
  {
    provider: 'ollama',
    model: 'gemma3:27b',
    requests: 400,
    tokens: 450_000,
    baseLatencyMs: 2100,
    statusMix: { success: 93, error: 7 },
  },
];

const DEMO_METADATA = { demoSeed: true };

async function seed() {
  console.log('🔄 Seeding demo AI usage data...');

  // Safety: ensure llm_providers exists
  const providersTable = await all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='llm_providers'",
    []
  );
  if (!providersTable || providersTable.length === 0) {
    throw new Error('llm_providers table not found. Run migrations first.');
  }

  // Clean previous demo rows
  await run('DELETE FROM ai_usage_logs WHERE metadata LIKE \'%"demoSeed":true%\'', []);

  // Prefer seeding for DBR77 tenant if present (to satisfy “DBR77 data” test runs)
  const orgRows = await all(
    "SELECT id FROM organizations WHERE id = 'dbr77' OR name LIKE '%DBR77%' LIMIT 1",
    []
  );
  const organizationId = orgRows?.[0]?.id || null;

  const now = Date.now();

  for (const seed of providers) {
    const entries = Math.min(200, Math.max(20, Math.round(seed.requests / 50)));
    const tokensPerEntry = Math.round(seed.tokens / entries);

    for (let i = 0; i < entries; i++) {
      // Distribute across last 30 days
      const hoursAgo = Math.round((i / entries) * 24 * 30);
      const createdAt = new Date(now - hoursAgo * 3600 * 1000).toISOString();

      const latency = Math.max(200, Math.round(seed.baseLatencyMs * (0.7 + Math.random() * 0.6)));

      const statusRoll = Math.random() * 100;
      const successThreshold = seed.statusMix?.success ?? 97;
      const status = statusRoll <= successThreshold ? 'success' : 'error';

      const promptTokens = Math.round(tokensPerEntry * (0.4 + Math.random() * 0.2));
      const completionTokens = Math.max(0, tokensPerEntry - promptTokens);

      await run(
        `INSERT INTO ai_usage_logs (
                    id, user_id, organization_id, provider, model, action,
                    prompt_tokens, completion_tokens, tokens_used,
                    latency_ms, status, error_message, metadata, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          null,
          organizationId,
          seed.provider,
          seed.model,
          'chat',
          promptTokens,
          completionTokens,
          promptTokens + completionTokens,
          latency,
          status,
          status === 'error' ? 'Synthetic demo failure' : null,
          JSON.stringify(DEMO_METADATA),
          createdAt,
        ]
      );
    }
  }

  console.log('✅ Demo data seeded into ai_usage_logs.');
  if (organizationId) {
    console.log(`✅ Seeded under organization_id=${organizationId} (DBR77).`);
  }
  console.log('Tip: open AI Operations > Costs/Analytics to verify non-zero metrics.');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
