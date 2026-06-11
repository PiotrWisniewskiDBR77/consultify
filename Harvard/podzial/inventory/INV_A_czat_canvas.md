# Inwentarz funkcjonalności A — CZAT + CANVAS

Część mapy modułów V2 (`Harvard/podzial/_MODULE_MAP_V2.md`). Zweryfikowane w kodzie 2026-06-11, branch `feat/deliverables-light`.

---

## MODUŁ: CZAT (AI_CHAT)

**Route'y / punkty wejścia:**
- `/chat` → `AppView.AI_CHAT` → `MainLayout` + `ConversationRouteSync` + `UnifiedChatPanel mode="full"` (`src/routes/routeConfig.ts:30`, `src/routes/AppRoutes.tsx:1215`)
- `/chat/:conversationId` — deep-link do konkretnej rozmowy
- **Split-mode na każdym module**: `UnifiedChatPanel mode="split"` montowany w `src/layouts/MainLayout.tsx:356` (lewy panel z resizerem, collapse, workspaceContext)
- `/share/:token` — publiczny, read-only viewer udostępnionej rozmowy (`src/App.tsx:464`)

**Opis:** Główny czat z Teresą AI — pełnoekranowy i split-view towarzyszący wszystkim modułom; streaming SSE, tryby badawcze, głos (Gemini Live), załączniki, kontekst organizacji i handoffy do studiów/Ideas/Canvas.

### A. Zarządzanie rozmowami
1. **Nowa rozmowa** — przycisk + slash `/new`. [DZIAŁA] `useConversationStore.ts`, `conversations.routes.ts:402`
2. **Historia rozmów (sidebar)** — grupowanie czasowe, zwijalne grupy, archiwum. [DZIAŁA] `ChatHistorySidebar.tsx`
3. **Wyszukiwanie rozmów** — lokalne + server-side. [DZIAŁA] `conversations.routes.ts:1634`
4. **Rename / gwiazdka / archiwizacja / usunięcie** — [DZIAŁA] `ConversationActions.tsx`
5. **Auto-tytuł rozmowy** — `POST /:id/title/generate`. [DZIAŁA] `conversations.routes.ts:1186`
6. **Projekty (foldery) rozmów + członkowie** — [DZIAŁA] `MoveToProjectModal.tsx`, `useChatProjectsRealtime.ts`
7. **Udostępnienie rozmowy linkiem publicznym** — `/share/:token`. [DZIAŁA]
8. **Eksport rozmowy** — json | markdown | text. [DZIAŁA] `conversations.routes.ts:2037`
9. **Branch rozmowy** — `POST /:id/branch`. [DZIAŁA] `conversations.routes.ts:2219`
10. **Podsumowanie / bulk-operacje / auto-archive / migracja z localStorage** — [DZIAŁA] `conversations.routes.ts:1502, 1314, 2161, 1414`
11. **Menu czatu (hamburger)** — nowa rozmowa, dzienny brief, mini-historia, przypięte prompty, eksport. [DZIAŁA] `ChatMenu.tsx`

### B. Kompozer
12. **Pole wejściowe ze streamingiem i stop/abort** — [DZIAŁA] `EnhancedChatInput.tsx`, `useAIStream.ts`
13. **Slash-commands (15)** — `/research /search /market /reasoning /private /agents /consultant /ideas /analyst /auditor /editor /summarize /table /image /clear /new` (`/image` = tylko szablon tekstu). [DZIAŁA] `composer/slashCommands.ts`
14. **Wzmianki `@`** — załączniki, dokumenty, projekty, rozmowy jako kontekst. [DZIAŁA] `composer/useMentionSources.ts`
15. **Załączniki plikowe** — PDF/TXT/MD/CSV/JSON, ingest serwerowy + z URL. [DZIAŁA] `ai.routes.ts:351,540`
16. **Pliki z chmury** — [DZIAŁA] `CloudFilePicker.tsx`
17. **Menu narzędzi (ToolsMenu)** — deep research, show reasoning, multi-agent, private mode, TTS; style odpowiedzi (normal/concise/executive/analyst/formal/coach). [DZIAŁA]
18. **Co-Thinker (persony)** — consultant / idea_creator / analyst / auditor / editor / market_researcher. [DZIAŁA]
19. **Focus mode (zakres źródeł)** — Wszystko / PMO / Projekt / Analiza / Web. [DZIAŁA]
20. **Selektor narzędzia wyjściowego** — auto / wordy / excele / prezentacje. [DZIAŁA] `OutputToolSelector.tsx`
21. **Licznik znaków / hint strip / soft-limit toast / PII-toast** — [ZA FLAGĄ (rodzina chatV9)] `chatV9FeatureFlags.ts`

### C. Wiadomości i odpowiedzi
22. **Streaming SSE** — `POST /api/ai/chat/stream` + partial recovery. [DZIAŁA] `ai.routes.ts:1423,5341`
23. **Markdown + bloki kodu z kopiowaniem** — [DZIAŁA]
24. **Edycja wiadomości i regeneracja** — truncate-from-message + retry. [DZIAŁA] `conversations.routes.ts:1057`
25. **Akcje odpowiedzi** — kopiuj, pobierz, TTS, feedback inline. [DZIAŁA]
26. **Zapis wiadomości do Context OS** — bookmark. [DZIAŁA] `conversations.routes.ts:973`
27. **Cytowania i źródła** — CitationList, SourcesStrip, walidacja serwerowa. [DZIAŁA] `ai.routes.ts:8540`
28. **Trust badge / panel zaufania** — [ZA FLAGĄ (trustBadge*, chatV9)]
29. **Ślad rozumowania (thinking/reasoning)** — [DZIAŁA]
30. **Karty propozycji AI** — TeresaProposalCard, ChatTableProposalCard, ExecutionProposalMessage (`POST /chat/confirm`). [DZIAŁA]
31. **Strukturalne bloki wyjścia** — [DZIAŁA]
32. **Chipy artefaktów w transkrypcie** — otwierają Canvas z deckiem/dokiem/sheetem, reload-safe. [DZIAŁA] `ArtifactChip.tsx`
33. **Inteligentne sugestie follow-up** — [DZIAŁA] `ChatSmartSuggestions.tsx`
34. **Wskaźnik jakości odpowiedzi / status myślenia** — [DZIAŁA]

### D. Deep research / orkiestracja
35. **Deep Thinking Orchestrator v2** — light/standard/hard, fazy research→thinking→synthesis→closure, iteracyjne pogłębianie (Tavily), kontekst organizacji. [DZIAŁA] `deepThinkingOrchestrator.ts`
36. **Pytania doprecyzowujące** — `POST /deep-research/clarify`. [DZIAŁA]
37. **Postęp badania w czacie** — [DZIAŁA] `ResearchProgress.tsx`
38. **Eksport raportu badawczego** — [DZIAŁA] `ai.routes.ts:1026`
39. **Dock sesji badawczych** — [UKRYTE — internal tools, rola+domena dbr77]

### E. Głos (Teresa voice)
40. **Rozmowa głosowa live (Gemini Live)** — sesja przez `TeresaVoiceContext`, transkrypt dopisywany do rozmowy. [DZIAŁA — wymaga `GEMINI_LIVE_API_KEY` + `TERESA_VOICE_*`]
41. **Globalny overlay głosowy** — pływający bąbel + mini-panel. [DZIAŁA] `VoiceConversationOverlay.tsx`
42. **Dyktowanie (mic → tekst)** — [DZIAŁA]
43. **Auto-czytanie odpowiedzi (TTS web)** — [DZIAŁA]
44. **Legenda trybów głosu + skrót** — [ZA FLAGĄ (voiceModeLegend, chatV9)]

### F. Kontekst organizacji / encji
45. **Chat z kontekstem encji** — pmoContext + workspaceContext + split-panel. [DZIAŁA] `useOpenChatWithContext.ts`
46. **Badge kontekstu** — [DZIAŁA] `ContextBadge.tsx`
47. **Kontekst organizacji (OrgContext)** — przełączanie org zasila czat i orkiestrator. [DZIAŁA]
48. **Pamięć AI (user/projekt/org)** — endpointy CRUD [DZIAŁA]; `OrganizationMemoryPanel.tsx` [UKRYTE — orphan]
49. **Tryb prywatny** — [DZIAŁA; popover ZA FLAGĄ]
50. **Kickoff message / quick prompts per moduł** — [DZIAŁA] `MainLayout.tsx:356-373`
51. **Sygnały (Important signals)** — [ZA FLAGĄ `myWorkSignalsV2`]
52. **V8: wskaźnik kontekstu + run-control artefaktów** — [ZA FLAGĄ `ENABLE_V8_GLOBAL`]

### G. Handoffy / intercepty intencji
53. **Intent → Prezentacja (deck)** — przy `VITE_ENABLE_DELIVERABLES_LIGHT` generacja in-place w Canvas, off → `/prezentacje`. [DZIAŁA / część ZA FLAGĄ]
54. **Intent → Dokument (doc)** — Canvas doc (light) lub `/wordy` (legacy). [DZIAŁA / jw.]
55. **Intent → Arkusz/tabela** — `/excele`; ChatToSchemaPanel. [DZIAŁA]
56. **Intent → Ideas tools** — mindmap / process flow / whiteboard interceptory. [DZIAŁA]
57. **Intent → pisanie do otwartego Canvasa** — stream prosto do aktywnego dokumentu. [DZIAŁA]

### H. Martwy/niezamontowany kod
58. WorkModeMenu, ChatOverlay+ChatToggleButton, CodeInterpreter, ActiveModeStrip — [UKRYTE/MARTWE]
59. Panele Wave5–9 / AIOSHub / ActionCenter — tylko na `/internal`/AI OS za `canUseInternalTools`. [UKRYTE dla klientów]

---

## MODUŁ: CANVAS (split-view dokumentów w czacie)

**Route'y / punkty wejścia:**
- Brak własnego route'u — prawy panel w `UnifiedChatPanel` (`WorkCanvasDocumentPanel`), otwierany przez intercepty intencji, chipy artefaktów, startery, przycisk panelu
- `/public/artifacts/:token` — publiczny read-only viewer (`src/App.tsx:449`)
- `/ai/work-canvas` — standalone shell [UKRYTE — internal tools]
- Backend: `work-canvas.routes.ts` (drafty) + `deliverablesGenerations.routes.ts` (generacja, za flagą)

**Opis:** Claude-Artifacts-owy panel roboczy obok czatu: edytowalny dokument TipTap z edycją AI, generacją deliverables (deck/doc/sheet), wersjami, udostępnianiem publicznym, eksportem i promocją treści do encji domenowych.

### A. Dokument i edycja
1. **Startery dokumentu (5)** — thoughts / document / research / decision / plan. [DZIAŁA]
2. **Szablony workflow (5)** — market_research_to_report, meeting_note_to_initiatives, kpi_review_to_dashboard, client_proposal_to_deck, decision_memo_to_execution_plan. [DZIAŁA — części partial] `work-canvas.routes.ts:2779-3131`
3. **Edytor rich-text TipTap (CanvasRichEditor)** — edycja ręczna + AI, markdown↔TipTap, bloki artefaktowe. [DZIAŁA]
4. **Autosave draftu** — z guardem anty-szkieletowym (fix P0-1). [DZIAŁA] `work-canvas.routes.ts:3283`
5. **Bloki artefaktowe w dokumencie** — np. blok decyzji z zaznaczenia. [DZIAŁA]
6. **Tryby widoku canvas** — podgląd/edycja. [DZIAŁA]

### B. Edycja AI
7. **AI floating menu na zaznaczeniu** — Rozwiń / Skróć / Przepisz / Doszlifuj / długość / odbiorca / tłumacz EN↔PL — diff accept/reject. [DZIAŁA] `CanvasAIFloatingMenu.tsx`
8. **Skróty zaznaczenia w toolbarze (E1)** — Condense/Expand/Tone. [DZIAŁA — live-proven; P2: brak guarda granic bloków]
9. **Streaming AI do canvasa** — [DZIAŁA] `useCanvasAIStream.ts`
10. **Zaznaczenie canvas → kontekst Teresy** — [DZIAŁA]

### C. Generacja deliverables — TRIADA (deliverables-light)
11. **Kontrakt plan→generate→poll** — `POST /api/deliverables/generations` + rate-limit + capability. [ZA FLAGĄ `ENABLE_DELIVERABLES_LIGHT` + `VITE_ENABLE_DELIVERABLES_LIGHT`]
12. **Deck (L1)** — checklista w transkrypcie → żywy deck w panelu → „Otwórz w Deck Builder". [ZA FLAGĄ; live-proven 2026-06-10; P1: surowe `##` i `[Fact:…]` w slajdach]
13. **Doc (L2)** — markdown z anti-placeholder gate; finał do edytora bez reloadu. [ZA FLAGĄ]
14. **Sheet (L3)** — GFM-table z twardą walidacją i round-tripem. [ZA FLAGĄ]
15. **Entity grounding (B2)** — ContextPack organizacji w promptcie generatora. [ZA FLAGĄ] `contextPackBuilder.ts`
16. **Telemetria generacji (D2)** — [ZA FLAGĄ]
17. **sourceRefs w kontrakcie** — przyjęte, żadne UI nie wysyła. [STUB]

### D. Cykl życia artefaktów
18. **Chip artefaktu w transkrypcie** — persisted, otwiera artefakt po reloadzie. [DZIAŁA — live-proven]
19. **Switcher artefaktów nad panelem** — base-dokument / decki / doce / sheety rozmowy. [DZIAŁA]
20. **Historia wersji + restore (B1)** — [DZIAŁA — live-proven] `work-canvas.routes.ts:3727,3847`

### E. Udostępnianie i eksport
21. **Public share + revoke** — `/public/artifacts/:token`, capability `canvas.share` serwerowo (fix P0-2). [DZIAŁA — pełny cykl live-proven]
22. **Eksport draftu** — markdown / csv / json / pdf / docx / xlsx / pptx. [DZIAŁA] `work-canvas.routes.ts:3242`
23. **Dostęp dla członków (capabilities canvas.\*)** — [DZIAŁA — fix `a669cb6e3e`; re-weryfikacja na koncie MEMBER wskazana]

### F. Promocja do encji / Outputs / registry
24. **Promote strip (5 celów)** — Pomysł / Notatka / Inicjatywa / Decyzja / Zadanie; org-guard C8. [DZIAŁA; P1: notatka bez toasta/linku]
25. **Outputs (3 cele)** — prezentacja / tabela / raport. [DZIAŁA]
26. **Rejestracja w Outputs registry (C7)** — `register-in-outputs` + test (uncommitted). [DZIAŁA]
27. **Panel artefaktów na inicjatywie (C7)** — [DZIAŁA] `InitiativeDocumentView.tsx:654`
28. **Pętla provenance (C4)** — ledger NIE pisany na żywej ścieżce akceptu (dead-code path). [CZĘŚCIOWE/STUB]
29. **Propozycje canvas (approve/reject)** — [DZIAŁA] `work-canvas.routes.ts:3482-3574`

### G. Retrieval Teresy (C6)
30. **Narzędzia READ po treściach org** — odpala się tylko przy literalnym UUID, nigdy tematycznie. [ZA FLAGĄ `ENABLE_TERESA_RETRIEVAL` (default false)]

### H. Powierzchnie poboczne
31. **Standalone Work Canvas shell** — `/ai/work-canvas` + targety konwersji. [UKRYTE — internal tools]
32. **Kimi Workspace (Wordy/Excele/Prezentacje/Tabele)** — legacy-cele redirectów przy flagach off. [DZIAŁA — osobne moduły]
33. **ArtifactsPanel/ArtifactViewer/ArtifactEditor** — starszy panel artefaktów. [DZIAŁA, częściowo równoległy]

### Znane otwarte luki (po commitach P0/P1 z 2026-06-10)
- C4 provenance na żywej ścieżce — częściowe
- Deck: surowe `##`/`[Fact:…]` (P1), brak guarda granic bloków (P2), szkielet PL-only dla EN (P2)
- Zapis-jako-notatka bez feedbacku UX (P1)
- `POST /:id/generate` defaultuje do 'deck' (P2); endpoint M-5 500 (P3)
- Afordancje na encjach + L4 retire-list — nie zaczęte
