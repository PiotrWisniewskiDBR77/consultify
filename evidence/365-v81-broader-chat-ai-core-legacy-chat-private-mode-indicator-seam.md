## V8.1 Evidence - broader `Chat / AI core` parity expansion - legacy chat private mode indicator seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Chat / AI core` parity expansion
Status: `active`

### Packet

`legacy chat private mode indicator seam`

### Why this packet

After the governed V8 control-strip parity packet, the next smallest honest broader chat/AI-core residual was a status-indicator gap. The shared `UnifiedChatPanel` already exposed visible private-mode state in the active chat header, but the legacy full-screen `AIChatWelcomeView` still lacked that governed runtime indicator.

That left a bounded split-brain:

1. both live chat surfaces now exposed the same governed V8 controls
2. only one of them visibly signaled that private mode was active
3. the broader chat/AI-core lane therefore still carried a small but real active-surface status mismatch

This packet stays bounded because it adds the existing private-mode indicator treatment to the legacy full-screen chat surface without changing send behavior, controls, or layout architecture.

### What changed

1. updated `src/views/AIChatWelcomeView.tsx` to mirror private-mode visual treatment from the shared chat panel:
   - visible `Private mode` pill in the chat header
   - matching violet ring state on the chat surface when private mode is active
2. extended `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx` to assert the private-mode indicator on the legacy full-screen chat surface

### Verification

- `npx vitest run tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`
- `ReadLints` clean for:
  - `src/views/AIChatWelcomeView.tsx`
  - `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`

### Result

The active broader chat/AI-core lane now has a fourth real bounded packet. The legacy full-screen `/chat` surface now shows the same private-mode runtime state as the shared chat panel, so visible governed status no longer diverges between the two active chat surfaces on this indicator seam.
