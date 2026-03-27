# V8.1 Chat Split-Brain Map

Date: 2026-03-26
Lane: `Chat`
Taxonomy: `T2`
Status: `active`

## Why this lane is promotable

Chat already has a governed V8 route/client spine plus visible V8 indicators on the active chat surface, but
the broader happy-path chat chain still mixes those governed pieces with legacy or non-governed runtime paths.

## Current split-brain map

1. Governed V8 chat spine
   - `src/services/api/v8/chat.ts`
   - `src/hooks/useV8Chat.ts`
   - `server/src/routes/v8/chat.routes.ts`
   - governed reads and writes already exist for `snapshots`, `handoffs`, and chat/execution/retrieval
     `bindings`

2. Live chat surface continuity
   - `src/components/AIChat/UnifiedChatPanel.tsx`
   - `src/components/AIChat/V8ArtifactRunControl.tsx`
   - `src/components/AIChat/V8ContextIndicator.tsx`
   - the active chat panel already renders visible V8 execution/retrieval indicators on the same operator
     surface where broader chat happy-path work still runs

3. Gated mixed-truth chat plane
   - `src/hooks/useV8Gate.ts`
   - `src/components/AIChat/UnifiedChatPanel.tsx`
   - V8 chat and AI-core capabilities are still exposed through feature gating while the broader chat path is
     not yet a single governed V8-first chain

4. Neighboring AI-core overlap
   - `src/services/api/v8/ai-core.ts`
   - `server/src/routes/v8/ai-core.routes.ts`
   - operator-facing AI-core reads exist, but `chat-turn` breadth should stay outside this first chat packet
     to avoid silently merging the Chat and AI-core lanes

## Bounded first packet

Start with `chat-execution-retrieval closure`:

- add one governed V8-first chat happy-path slice on the active chat surface
- build on existing `snapshots`, `handoffs`, and `bindings` endpoints plus the visible V8 context/execution
  indicators already present in `UnifiedChatPanel`
- keep broad AI-core exposure, provider lifecycle, and full chat-send architecture breadth outside this first
  packet
