# WS2 — L2 UI Critical (Auth + Sidebar + AI Chat)

## 2026-02-21T19:55:59Z — Iteration report (branch: `codex/l2-ui-20260221-2030`)

### AUDIT
- `npm run test:quality-check`: **PASS** (PLACEHOLDER: 0)
- `npm run test:l2:coverage`: **PASS** (thresholds OK; per-file gates met)

### PLAN (scenarios domknięte)
**Auth**
- `MFAChallenge`: blocked path, trust-device (fingerprint), backup-code invalid clears input, verify-step UX (disabled state) w `MFASetup`.

**Sidebar**
- `NavItem` / `FloatingSubmenu` / `SidebarFooter`: aktualne a11y/styling (m.in. `aria-current`, aktualne klasy dark/light, `Log out` aria-label).
- `Sidebar`: tablet close-on-navigate (kiedy sidebar otwarty).

**AI Chat**
- `ConversationList`: stable toggle (role button), active item, group ordering, show-more guard.
- `ToolsMenu`: stabilne otwieranie submenu + styl odpowiedzi (name match), disabled state, error path zapisu instrukcji, showReasoning toggle on/off.
- `UnifiedChatPanel`: stabilizacja hoisted mocks + dodatkowe ścieżki (history toggle, abort stream, copy, artifacts panel).

### EXECUTE
- Dodane/rozszerzone **~25+ realnych przypadków komponentowych** (zero snapshot-only, brak `*.skip`).
- Naprawione flaki/false-negatives wynikające z i18n/aria-label oraz Vitest `vi.mock` hoisting.

### VERIFY
- `npm run test:quality-check`: **PASS**
- `npm run test:l2:coverage`: **PASS**

## 2026-02-21T17:52:06Z — Iteration report (branch: `Londyn`)

### AUDIT
- `npm run test:l2:coverage`: **PASS** (thresholds OK; overall: 99.31% statements, 95.15% branches)
- `npm run test:quality-check`: **PASS** (PLACEHOLDER: 0)

### PLAN (scenarios domknięte)
**Auth**
- `LoginView`: brak tokena/MFA → brak side‑effectów; `window.location.reload()` może rzucać i nie psuje loginu.
- `MFAChallenge`: fallback błędu gdy API zwraca `{}`; fallback błędu gdy `fetch` reject bez `message` (TOTP + backup).

**Sidebar**
- `Sidebar`: klasy `translate-x-*` dla sidebar zamkniętego (mobile vs tablet).
- `Sidebar`: collapsed + hover na item bez `subItems` → flyout działa; flyout navigate nie auto‑zamyka sidebar przy szerokim oknie.
- `SidebarFooter`: collapsed → brak labeli (tylko `title`), bez regressji partner/logout.

**AI Chat**
- `ChatToggleButton`: tytuł EN/PL, klik → `toggleChat`, kontekstowy “green dot” gdy jest `projectId`.
- `AIRoleBadge`: label + inline opis.
- `ArtifactBadge`: open/download wywołują callbacki i stopują propagację.
- `PendingActionsIndicator`: `[]` → `null`; compact → count i expand; approve success usuwa akcję i woła callback; reject fail → toast error i akcja zostaje.

### EXECUTE
- Dodane **20 realnych przypadków komponentowych** (zero snapshot‑only).
- Nowe testy:
  - `tests/components/AIChat/AIRoleBadge.test.tsx`
  - `tests/components/AIChat/ArtifactBadge.test.tsx`
  - `tests/components/AIChat/ChatToggleButton.test.tsx`
  - `tests/components/AIChat/PendingActionsIndicator.test.tsx`
- Rozszerzone testy:
  - `tests/components/auth/MFAChallenge.test.tsx`
  - `tests/components/auth/LoginView.test.tsx`
  - `tests/components/navigation/Sidebar/Sidebar.test.tsx`
  - `tests/components/navigation/Sidebar/SidebarFooter.test.tsx`

### VERIFY
- `npm run test:quality-check`: **PASS**
- `npm run test:l2:coverage`: **PASS**

### NEXT (opcjonalne)
- Jeśli chcemy “VC‑proof” coverage także dla `src/components/AIChat/**` w L2 gates: dodać je do profilu/threshold listy (obecnie nie pojawiają się w tabeli L2 coverage).
