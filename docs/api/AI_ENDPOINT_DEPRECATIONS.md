# AI API — Deprecation & Rollout Notes

> **Created:** 2026-02-23  
> **Scope:** S1 (T116–T122) rollout without breaking changes

## Canonical endpoints (new code)
- **Prompt SSOT**: `/api/ai-prompts/*`
- **Chat runtime**: `/api/ai/chat/stream`

## Legacy aliases (supported, deprecated)

### Prompt registry alias
- **Alias**: `/api/ai/prompts/*` → use `/api/ai-prompts/*`
- **Telemetry**:
  - Response headers: `X-Deprecated-Endpoint`, `X-Deprecated-Replacement`
  - Server log: `[DEPRECATED] ...`

### Legacy controller-based prompt API
- **Legacy**: `/api/ai/ai-prompts/*` (admin/migration surface)
- **Telemetry**:
  - Response headers: `X-Deprecated-Endpoint`, `X-Deprecated-Replacement`
  - Server log: `[DEPRECATED] ...`

## Release plan (recommended)
- **Release 1**: canonical endpoints + legacy aliases (with deprecation telemetry)
- **Release 2**: frontend/admin tooling fully switched to canonical (aliases remain as proxy)
- **Release 3**: remove legacy aliases after telemetry confirms no usage

