## V10 runtimes + Teresa voice — transfer checklist

This checklist is meant to help move the whole local package to another env
(staging/prod) without re-discovering missing env vars, flags, or routing.

### Environment variables (server)

- **`GEMINI_API_KEY`**: required for Teresa bidirectional voice (`/api/v10/teresa/voice-config`).
- **`TERESA_VOICE_NAME`**: optional override (defaults to the client-side default voice name).

### Runtime feature flags (frontend)

These are the minimal flags used by the admin `Chat V10` panel to expose the new
endpoints.

- **Reasoning**: `VITE_PIPELINES_REASONING_FAST_CHAT_PIPELINE=1`
- **Research**: `VITE_PIPELINES_RESEARCH_MISSION_PIPELINE=1`
- **Connectors**: `VITE_PIPELINES_CONNECTORS_INGEST_PIPELINE=1`
- **Learning**: `VITE_PIPELINES_LEARNING_FEEDBACK_PIPELINE=1`
- **Outcome**: `VITE_PIPELINES_OUTCOME_ROLLUP_PIPELINE=1`
- **Onboarding (persona capture UI)**: `VITE_ONBOARD_PERSONA_CAPTURE=1`

### Telemetry flags (frontend)

Used by the V10 admin panel instrumentation. Default-off.

- **Reasoning telemetry**: `VITE_REASONING_TELEMETRY=1`
- **Research telemetry**: `VITE_RESEARCH_TELEMETRY=1`
- **Connectors telemetry**: `VITE_CONNECTORS_TELEMETRY_FULL=1`
- **Learning telemetry**: `VITE_LEARNING_TELEMETRY=1`
- **Outcome telemetry**: `VITE_OUTCOME_TELEMETRY=1`
- **Onboarding telemetry**: `VITE_ONBOARD_TELEMETRY=1`

### Routing / API

- **Backend**: ensure `/api/v10` is mounted and reachable.
- **Auth**: V10 runtime routes are authenticated; verify the env has valid JWT/cookies and org context.
- **Teresa voice config**: verify `GET /api/v10/teresa/voice-config` returns `{ enabled: true, apiKey: "...", voiceName }` for an authenticated user.

### Smoke tests (local → target env)

- **Teresa voice**
  - Log in, open chat, press the conversation mic button.
  - If config missing, UI should show a clear error state + retry (not a silent no-op).
- **V10 runtimes (admin)**
  - Open Admin → AI Module → Chat V10.
  - Toggle the pipeline flags above ON and verify each section returns a JSON payload.
- **Telemetry contract invariants**
  - Run `npx vitest run src/utils/__tests__/chatV9FeatureFlags.test.ts`
  - Run `npx vitest run src/utils/__tests__/chatV10FeatureFlags.test.ts`

### Deployment order (recommended)

- **Server first**, then frontend.
  - Server exposes `/api/v10/*` and `/api/v10/teresa/voice-config`.
  - Frontend depends on those routes; deploying frontend first can surface “voice unavailable” / runtime call errors.

