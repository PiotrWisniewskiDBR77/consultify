# CHAT-IMG-1 — receipt

Status: **READY FOR CTO REVIEW** after independent ACCEPT (`P0=0`, `P1=0`, `P2=0`).

## Scope

- `VITE_CHAT_IMAGES` and `ENABLE_CHAT_IMAGES` are strict `true` gates and default to OFF.
- With both flags ON, the chat composer accepts one PNG, JPEG, WebP, or GIF image up to 5 MB through picker, paste, or drop and shows a local thumbnail.
- Images use the dedicated authenticated `/api/ai/chat/images` transport, active tenant membership, server-side byte validation, fail-closed decoding, and do not enter the document/RAG ingestion path.
- The validated image reaches the Vercel AI SDK v6 as an `ImagePart`; routing requires a vision-capable model and fails closed for a text-only explicit model.
- Server error codes are mapped to localized EN/PL UI messages before display or persistence.
- With either flag OFF, the existing CHAT-IMG-0 rejection path remains in force. Existing File/Link badges and non-image capability routing are unchanged.

## Limits

- One image per message.
- Maximum original image size: 5 MB.
- No external paid model was called. The provider boundary is proven with the real AI SDK OpenAI adapter and an intercepted request body.

## Evidence

- Independent focused Vitest: 8 files, 76/76 PASS, `--retry=0`.
- Real AI SDK v6 adapter contract: valid `ImagePart` accepted and serialized to provider `image_url`.
- Real Sharp decode probe: PNG/JPEG/WebP/GIF PASS; truncated magic-only PNG returns HTTP 415 `INVALID_IMAGE_DATA`.
- Exact-lock server TypeScript (`npm ci`, `@types/node 22.19.3`): base **1** → candidate **1**, exit 2 in both runs. The sole diagnostic is the known line defect `presentations.routes.ts:611 TS2559` from W169; CHAT-IMG-1 adds no server diagnostic. The developer dependency tree (`@types/node 22.20.2`) reports 0, but is recorded only as secondary evidence.
- Exact-lock frontend full TypeScript: TIMEOUT at the mandatory 120 s command limit, no diagnostics emitted; not reported as PASS. The line baseline recorded by CTO before this packet was 169 diagnostics.
- Changed frontend files: focused component/service tests PASS and esbuild PASS.
- Docker flag guard: 196 flags, 208 ARGs, 13 exceptions, 0 missing.
- Language gate: PASS; no increase (`K5en -1`).
- `git diff --check`: PASS.

## Review findings closed

1. Replaced the invalid OpenAI REST-shaped input part with the AI SDK v6 `ImagePart` contract and removed the hiding cast.
2. Changed image decoding from fail-open to fail-closed.
3. Kept vendor/model normalization local to vision routing to preserve OFF behavior.
4. Localized new image failures by stable code before they reach the user or failed-attachment metadata.
