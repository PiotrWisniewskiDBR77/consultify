## V8.1 Evidence - broader `Chat / AI core` parity expansion - legacy chat governed V8 controls seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Chat / AI core` parity expansion
Status: `active`

### Packet

`legacy chat governed V8 controls seam`

### Why this packet

After stream-session continuity and operator trust readback landed, the next smallest honest broader chat/AI-core packet was not another runtime mutation. It was active-surface parity: the shared `UnifiedChatPanel` already exposed governed V8 context and artifact-run controls, but the legacy full-screen `AIChatWelcomeView` still lacked that same visible read/control strip.

That left a bounded split-brain:

1. one live chat surface exposed governed V8 context, handoff/retrieval visibility, and artifact-run controls
2. the other live full-screen chat surface persisted richer metadata but still stopped short of the same governed controls
3. broader chat/AI-core parity therefore remained uneven across the two live chat surfaces

This packet stays bounded because it reuses the existing governed V8 controls on the legacy chat header without broadening into a full chat-layout rewrite or send-path redesign.

### What changed

1. updated `src/views/AIChatWelcomeView.tsx` to render `V8ArtifactRunControl` and `V8ContextIndicator` on the legacy full-screen chat header
2. derived the same bounded goal hint and snapshot context family already used by the shared chat panel:
   - latest user goal hint
   - governed workspace/project snapshot targeting
   - normalized role ref
   - privacy-mode flag
3. added focused integration coverage in `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`

### Verification

- `npx vitest run tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`
- `ReadLints` clean for:
  - `src/views/AIChatWelcomeView.tsx`
  - `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`

### Result

The active broader chat/AI-core lane now has a third real bounded packet. The legacy full-screen `/chat` surface no longer stops short of the governed V8 context/artifact controls already available in the shared chat panel, so visible chat-surface parity is tighter without reopening the lane into a larger chat redesign.
