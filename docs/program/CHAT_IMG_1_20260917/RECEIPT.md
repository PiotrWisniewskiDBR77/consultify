# CHAT-IMG-1 v2 — receipt

Status: **READY FOR CTO REVIEW** after final independent **ACCEPT** (`P0=0`, `P1=0`).

## Scope

- `VITE_CHAT_IMAGES` and `ENABLE_CHAT_IMAGES` remain strict `true` gates and default to OFF.
- With both flags ON, the chat accepts one PNG, JPEG, WebP, or GIF up to 5 MB through picker, paste, or drop. The dedicated `/api/ai/chat/images` route remains behind JWT and active tenant membership; images do not enter document/RAG ingest.
- The originating user message persists one validated image in `metadata.images`. The transcript renders a 40×40 thumbnail. A later user turn in the same conversation reuses the latest valid user image in `context.images`; a new upload replaces it. The base64 payload is not copied into every later message.
- Persisted metadata is treated as untrusted: only image/png, image/jpeg, image/webp, and image/gif data URLs with bounded name, decoded size, declared size, and positive bounded dimensions are accepted. AI-message metadata is ignored as an image source.
- With either flag OFF, historical image metadata is neither rendered nor attached to a request. Existing File/Link behavior is unchanged.

## W174 closure

- The five frontend TypeScript diagnostics were one test-harness defect. `startStream` now uses the exact `UseAIStreamReturn['startStream']` contract instead of a one-argument tuple.
- The second-turn proof uses a real decodable 1×1 PNG, production `prepareChatImages`, production `attachChatImagesToLastUserMessage`, a three-turn history, and the real AI SDK OpenAI adapter with only `fetch` intercepted. The third provider message contains the processed image as `image_url`.
- The original review HOLD for a synthetic invalid PNG was corrected. Final independent review: **ACCEPT, P0=0, P1=0**.

## Evidence

- Full CHAT-IMG family after v2: **9 files / 81 tests PASS**, `--retry=0`.
- Focused corrected proof after the review fix: **4 files / 41 tests PASS**; independent reviewer rerun: **4 files / 43 tests PASS**.
- Mutation: replacing reuse of `persistedConversationImage` with an empty image list makes the second-turn test RED (**1 failed**); restoring production code makes it GREEN (**1 passed**).
- Exact lock: clean `npm ci`; installed and locked `@types/node` are both **22.19.3**.
- Server TypeScript: **RC=0 / 0 diagnostics**.
- Full frontend TypeScript after v2: **152 diagnostics**, the same current-line count recorded in W172; the former five CHAT-IMG test diagnostics are absent. The only diagnostic matching a changed production file is inherited `UnifiedChatPanel.tsx:2077 TS2559`, present unchanged on base `8ca34fb518`.
- No migrations and no new flags. Existing Docker flag contract remains unchanged.
- `git diff --check`: PASS.

## Honest limits and P2

- No paid external model was called. The proof reaches the exact provider request body through the real adapter.
- Front reload is simulated by remounting with metadata in the conversation store. Persistence uses the existing JSONB metadata and `z.record` route contract; a RealPG POST→GET roundtrip near the 5 MB boundary remains a P2 hardening test.
- If a new image upload fails, the current turn can still reuse the previous conversation image while showing the upload error. A clearer UX decision remains P2.
- Existing P2 from W174 remains registered: multimodal creation-intent text extraction, model-id normalization in one router call, a specific non-vision error code, and conservative fallback token accounting.
