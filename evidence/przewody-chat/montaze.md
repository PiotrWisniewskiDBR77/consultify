# Montaże `UnifiedChatPanel` — marker 9715bab7

Pomiar: `grep -rn '<UnifiedChatPanel' src/ | grep -v 'export const UnifiedChatPanel' | grep -v teresaEntityContext.ts`, wykonany przed dodaniem testu.

1. `src/components/layout/SplitLayout.tsx:271`
2. `src/components/layout/SplitLayout.tsx:364`
3. `src/components/shared/NModeLayout/AIConsultantPanel.tsx:326`
4. `src/components/AIChat/WorkCanvas/WorkCanvasShell.tsx:1094`
5. `src/components/AIChat/ChatOverlay.tsx:208`
6. `src/layouts/MainLayout.tsx:485`
7. `src/views/AIChatView.tsx:8`
8. `src/views/FreeAssessmentView.tsx:481`
9. `src/views/Module1ContextView.tsx:198`
10. `src/routes/AppRoutes.tsx:1778`
11. `src/routes/AppRoutes.tsx:1865`

Wynik: 11 montaży w 9 plikach. Żaden nie przekazywał `onNavigateToActions`. Trasy `/chat` i `/chat/:id` przekazywały wyłącznie `mode="full"`. `MainLayout` przekazywał `kickoffMessage`, `onKickoffConsumed`, `quickPrompts` i `contextActions`; `AIConsultantPanel` przekazywał własne `kickoffMessage` oraz `quickPrompts`.
