## V8.1 Evidence - broader `Chat / AI core` parity expansion - stream session metadata continuity seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Chat / AI core` parity expansion
Status: `active`

### Packet

`stream session metadata continuity seam`

### Why this packet

After the broader chat/AI-core split-brain map, the smallest honest first packet was not a broad send-path rewrite. It was a turn-level continuity seam between the live legacy `/chat` surface and the already-governed stream/runtime spine.

The backend and streaming client already emitted `stream_meta.sessionId`, but `useAIStream` dropped that identity before `onStreamDone`, and `AIChatWelcomeView` persisted a thinner AI-response metadata shape than the unified chat surface.

This packet stays bounded because it:

1. closes one turn-level persistence seam without redesigning the broader chat send path
2. preserves accepted bounded `Chat` and `AI core` cuts as done work
3. aligns the two live chat surfaces through shared persisted metadata instead of introducing another split-brain

### What changed

1. updated `src/hooks/useAIStream.ts` so `stream_meta.sessionId` is retained and forwarded in `onStreamDone`
2. added shared persisted AI-response metadata helpers in `src/utils/chatPersistence.ts`
3. updated `src/views/AIChatWelcomeView.tsx` to persist the same richer metadata family as the unified chat surface:
   - `thinkingSteps`
   - normalized `artifacts`
   - `citations`
   - `streamSessionId`
4. updated `src/components/AIChat/UnifiedChatPanel.tsx` to use the same shared metadata builder so legacy `/chat` and unified chat no longer diverge in persisted AI-response shape
5. added focused regression coverage in:
   - `tests/unit/hooks/useAIStream.test.ts`
   - `tests/unit/utils/chatPersistence.test.ts`

### Verification

- `npx vitest run tests/unit/hooks/useAIStream.test.ts tests/unit/utils/chatPersistence.test.ts`
- `ReadLints` clean for:
  - `src/hooks/useAIStream.ts`
  - `src/views/AIChatWelcomeView.tsx`
  - `src/components/AIChat/UnifiedChatPanel.tsx`
  - `src/utils/chatPersistence.ts`
  - `tests/unit/hooks/useAIStream.test.ts`
  - `tests/unit/utils/chatPersistence.test.ts`

### Result

The active broader chat/AI-core lane now has its first real bounded packet after the split-brain map. Stream session identity is no longer dropped at hook level, and the live legacy `/chat` surface now persists AI-response metadata on the same governed family as the unified chat surface instead of keeping a thinner, divergent metadata shape.
