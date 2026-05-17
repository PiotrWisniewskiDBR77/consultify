# TBL-FU-3 — Artifact Lane Production Parity

**Priority:** P2  
**Owner:** Frontend / Product  
**Source:** Table Studio Foundation closeout

> [!IMPORTANT] Conversation surface bramka.
> Ten work packet podlega `DRD/consultify/docs/product/UNIFIED_CONVERSATION_SURFACE_TERESA_SSOT.md`.
> W żadnym z lane'ów (`/wordy`, `/excele`, `/prezentacje`, `/tabele`) nie wolno dodawać własnego pola promptu do AI ani osobnego "Agent AI" panelu. Każda nowa konwersacyjna interakcja idzie przez Teresę (`UnifiedChatPanel`) z bindingiem `useTeresaModuleBinding`. Patrz sekcja 11 (Handoff) tego SSOT-u.

## Goal

Audit Wordy, Excele, and Prezentacje route production behavior against the new Tabele lane so all four artifact lanes expose consistent entry, reopen, routing, and shell behavior.

## Acceptance Criteria

- `/wordy`, `/excele`, `/prezentacje`, `/tabele` route behavior is documented and aligned.
- Any placeholder or coming-soon asymmetry is explicitly approved or removed.
- Shared shell actions remain in Menu 3/right command slot only.
- Existing lane tests remain green.
- No lane renders a module-local chat input or "Agent AI" side panel; conversational entry is unified in Teresa per the SSOT above.
