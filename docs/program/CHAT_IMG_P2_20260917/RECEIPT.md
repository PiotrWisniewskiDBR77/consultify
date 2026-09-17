# CHAT-IMG P2 — W179/W181 receipt

Status: **READY FOR CTO REVIEW**.

- Base: `be57c5dae677844a224d78d874d3ab52444a882d`.
- Scope: P2 corrections from W179 plus the legacy `/api/ai/chat` image contract from W181.
- Product migrations: none.
- Feature flags remain default OFF: `ENABLE_CHAT_IMAGES` and `VITE_CHAT_IMAGES`.

## Delivered behavior

- Multimodal history is classified from text content instead of `"[object Object]"`.
- Model capability selection uses the canonical normalized model id.
- A provider without vision support produces the stable, non-retryable `AI_MODEL_NO_VISION` contract and one actionable EN/PL message.
- The attachment chip uses canonical `c-*` colors and the persisted thumbnail uses the translated preview alt text.
- A failed replacement writes an explicit empty image context and cannot resurrect the previous image on a later turn.
- `conversation_messages.metadata.images` is validated only while the server feature is ON. OFF preserves the former open metadata contract. ON accepts one image up to 5 MiB and validates MIME, canonical base64, decoded size, declared size, name and dimensions.
- Legacy `POST /api/ai/chat` rejects an image before orchestration or audit: OFF returns `404 CHAT_IMAGES_DISABLED`; ON returns `422 CHAT_IMAGES_REQUIRE_STREAM`.

## Verification

- Focused final suite: **10 files / 127 tests PASS**, `--retry=0`.
- Post-mutation restoration suite: **3 files / 19 tests PASS**, `--retry=0`.
- Independent review: **ACCEPT, P0=0, P1=0, P2=0**; reviewer reran **41/41** server/integration and **86/86** client/API tests.
- Real PostgreSQL: disposable local `pgvector/pgvector:pg16` at `127.0.0.1:6454`; canonical strict migration run **925/925**, replay `Applying migrations: 0`; exact 5 MiB high-entropy image passed HTTP POST → JSONB → direct SQL readback → fresh HTTP GET, **1/1 PASS**. Container and volume removed.
- TypeScript: server **0 diagnostics / RC=0** with exact-lock `@types/node 22.19.3`; frontend exact-lock **152 diagnostics**, equal to the current exact-lock baseline **152**. The only diagnostic in a changed product file is the inherited `UnifiedChatPanel.tsx:2077 TS2559`. The authoritative line-environment count from W179 is **169**; this checkout does not claim an independent line-environment rerun.
- Repository gates: `check:jezyk:ci` PASS with no increase; flags `196 analyzed / 0 missing`; list canon `346=346`; artifact crimson `8=8`; `git diff --check` PASS.
- No screenshots were created, as required by the channel header.

## Mutation evidence

All mutations were applied only to the working tree, produced the expected red test, and were restored byte-for-byte before the final green run.

1. Replacing the image-context tombstone with a backward scan resurrected `previous.png`: **RED, RC=1**.
2. Emitting the no-vision error as an ordinary SSE chunk produced a duplicate assistant message: **RED, RC=1**.
3. Removing the legacy `/api/ai/chat` image middleware changed OFF from 404 to 200 and invoked the orchestrator path: **RED, RC=1**.

## Limits

- Evidence uses the application router and a local 10 MiB Express parser. The deployed reverse-proxy body limit is outside this package and remains a staging smoke concern for CTO.
- Known `act(...)` and `res.clone` warnings in the existing panel test remain warning-only and unchanged; the independent review classified them as pre-existing noise.
