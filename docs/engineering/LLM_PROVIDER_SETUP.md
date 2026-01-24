# LLM Provider Setup (Keys & Seeding)

Use this checklist to connect real LLM providers locally or in staging/production. **Do not commit secrets to the repo.** Store keys only in environment files or secret managers.

## Required environment variables

Set these in `.env.local` (local dev) or your secret store (staging/prod):

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Google / Gemini
GEMINI_API_KEY=...
# or
GOOGLE_API_KEY=...

# Anthropic
ANTHROPIC_API_KEY=...

# DeepSeek
DEEPSEEK_API_KEY=...

# Zhipu (Z.ai)
ZHIPU_API_KEY=...

# Ollama (local)
OLLAMA_ENDPOINT=http://localhost:11434
```

## One-time/refresh seed after keys are set

Upsert providers into `llm_providers` and mark active:

```bash
npx tsx server/scripts/seed-llm-providers.ts
```

Optional: seed demo usage data (for Costs/Analytics dashboards):

```bash
npx tsx server/scripts/seed-ai-usage-demo.ts
```

### Quick script (loads .env.local automatically)

1. Put keys in `.env.local` (not committed):

```
OPENAI_API_KEY=...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
DEEPSEEK_API_KEY=...
ZHIPU_API_KEY=...
OLLAMA_ENDPOINT=http://localhost:11434
```

2. Run helper (providers only):

```bash
chmod +x scripts/seed-llm.sh
./scripts/seed-llm.sh
```

Or providers + demo usage:

```bash
./scripts/seed-llm.sh demo
```

## Verify

SQL quick check:

```bash
sqlite3 server/consultinity.db "SELECT id, provider, is_active FROM llm_providers"
```

UI:

- SuperAdmin → AI Infrastructure → LLM Providers (should show active providers)
- SuperAdmin → AI Operations → Mission Control / Costs / Analytics

## Notes

- Keys are read at seed time; rerun the seed after adding/updating keys.
- Costs/Analytics require `ai_usage_logs` entries; use the demo seed or real traffic.
- Respect secret handling: never commit `.env.local` or keys to git.
