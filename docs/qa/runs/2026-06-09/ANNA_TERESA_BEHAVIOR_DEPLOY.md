# Deploy verification — Anna & Teresa behavior development

**Date:** 2026-06-09
**Commit promoted:** `23ccc49df4` — feat(ai): develop Anna & Teresa behaviors + reconcile voice-config contract
**Branch:** `qa/remediation-2026-06-08`

## What was promoted
- **Teresa chat** (`server/src/ai/persona.ts`): added "Agency & Operating Model" (copilot, not autopilot — propose/await approval, never fake execution, honest about reach, route to the right module, one step at a time). PL+EN. Response discipline stays last.
- **Anna text** (`ANNA_PUBLIC_BEHAVIOR` in `server/src/routes/public-anna.routes.ts`): added "Qualify and Convert" (read intent, one qualifying question when unclear, match next step to signal, one CTA at a time).
- **Voice-config contract** (`server/src/services/ai/voiceRuntimeService.ts`): restored strict worker authority for Anna; `fallbackToEnvWhenInactive` for Teresa so a stale worker row never kills workspace voice.

## Where it went
| Target | Result |
|--------|--------|
| GitHub `origin/qa/remediation-2026-06-08` | pushed `9bc33bbfe0..23ccc49df4` |
| GitHub `origin/staging` | fast-forward `f847e6a6b8 → 23ccc49df4` (clean FF, no force) |
| Railway **staging** deploy | run `27231560162` — **success** |

## Deploy verification (run 27231560162)
- Deploy Staging: **success** · Deploy Production: **skipped** (prod untouched)
- Steps: Deploy app to staging → success; **Verify staging deployment → success** (health gate passed)

## Pre-deploy checks (local)
- `persona`/`public-anna.routes`/`teresa.voice-config` tests: **29/29 pass**
- Anna voice-config (local): `enabled:true` (no regression)
- Agency section present in EN+PL; response discipline remains last

## Behavior sources of truth (for future edits)
- Teresa chat: `server/src/ai/persona.ts`
- Anna text: `ANNA_PUBLIC_BEHAVIOR` (`server/src/routes/public-anna.routes.ts`)
- Teresa voice: `src/utils/teresaVoiceInstruction.ts`
- Anna voice: `buildVoiceSystemInstruction` (`src/components/Landing/AnnaAssistantWidget.tsx`)
- Voice enable/persona/tone contract: `server/src/services/ai/voiceRuntimeService.ts`

## Not part of this deploy (left in working tree, other sessions' work)
- `src/components/MyWork/MyWorkHub.tsx` (RADAR_ENABLED=false pause), deleted `server/scripts/diag-*.ts`, `docs/benchmarks/` — untouched and uncommitted by this task.
