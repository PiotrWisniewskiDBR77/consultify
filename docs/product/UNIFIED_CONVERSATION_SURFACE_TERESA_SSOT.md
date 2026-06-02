# Unified Conversation Surface (Teresa) — Source Of Truth

Status: `DRAFT / PRODUCT + ARCHITECTURE SSOT`
Owner: Product + Architecture
Created: 2026-05-08
Scope: Architektura warstwy konwersacyjnej w całej aplikacji Consultify. Ten dokument definiuje, że istnieje **jedna powierzchnia czatu (Teresa)** i jak moduły (Prezentacje, Wordy, Excele, Tabele, Canvas, DeckBuilder, itd.) podpinają się do niej zamiast hodować własne czaty.

## 1. Po co ten dokument

Obecnie w aplikacji równolegle istnieją trzy powierzchnie konwersacyjne:

1. Teresa — boczny / dolny panel ("Ask Teresa") oraz `UnifiedChatPanel` w split mode.
2. Prompt modułu — np. "Generuj prezentację" w `/prezentacje`, własne pole tekstowe w `/wordy`, `/excele`.
3. Agent AI w narzędziach — `AgentPanel` w `DeckBuilder`, planowane analogi w innych edytorach.

Każda z nich:

- ma własną pamięć / wątek,
- ma własny intent router lub jego brak,
- duplikuje sugestie i quick actions,
- nie wie nawzajem o swoim kontekście,
- zmusza użytkownika do uczenia się trzech UX zamiast jednego.

To jest dług architektoniczny. Niniejszy dokument zamraża decyzję: **w aplikacji jest jeden czat, Teresa**. Wszystko inne, co dziś wygląda jak czat, staje się albo akcją kontekstową w Teresie, albo widokiem artefaktu.

Ten dokument jest też kontraktem dla równoległych zespołów / agentów (Wordy, Excele, Tabele, DeckBuilder, Canvas, Document Studio), żeby nie powielać tego błędu w nowo dodawanym kodzie.

## 2. Hierarchia źródeł i powiązania

Ten dokument:

- jest źródłem prawdy dla wszystkich nowych decyzji o czacie / agencie w UI,
- nadpisuje fragmenty dotyczące "module-local chat" w:
  - `consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_20_PREZENTACJE_2026-03-29.md`
  - `consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_22_WORDY_2026-03-29.md`
  - `consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_23_EXCELE_2026-03-29.md`
- współpracuje, ale nie zastępuje:
  - `consultify/docs/product/CANVAS_SOURCE_OF_TRUTH.md` (Canvas = prawa strona)
  - `DRD/UI_UX_SOURCE_OF_TRUTH.md`
  - `consultify/docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`
  - `.cursor/rules/ai-actions-menu3.mdc`
  - `consultify/docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`

W razie konfliktu z planami modułowymi — wygrywa ten dokument.

## 3. Diagnoza obecnego stanu (z dowodami w kodzie)

Komponenty które realizują dziś czat / agenta w równoległych miejscach:

- `src/components/AIChat/UnifiedChatPanel.tsx` — właściwa, kanoniczna powierzchnia konwersacji (Teresa).
- `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` — używa `UnifiedChatPanel` w trybie split (lewa strona) — to jest OK, to jest "ta sama Teresa" w innym layoucie.
- `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` — uruchamia `useKimiArtifactPipeline('prezentacje')` z własnym `PREZENTACJE_SYSTEM_PROMPT` i wyświetla osobny prompt + przycisk "Generuj prezentację".
- `src/components/AIChat/KimiWorkspace/WordyView.tsx` — analogicznie własny `WORDY_SYSTEM_PROMPT_BASE`.
- `src/components/AIChat/KimiWorkspace/ExceleView.tsx` — analogicznie własny `EXCELE_SYSTEM_PROMPT`.
- `src/components/Presentations/DeckBuilder/AgentPanel.tsx` — drugi, niezależny czat z agentem operującym na decku, własna historia, własne propozycje, własne UI.

Skutki widoczne dla użytkownika (dowód: zrzuty z 2026-05-08 w `/prezentacje` i `Deck Builder`):

- W `/prezentacje` jednocześnie widać dolny pasek "Zapytaj Teresę..." i osobne pole "Stwórz prezentację zarządczą... Generuj prezentację".
- W Deck Builder pojawia się osobny panel "Agent AI / Cześć! Wiem, że ten deck powstał z Template-based output...", który nic nie wie o tym, co użytkownik mówił Teresie 30 sekund wcześniej w tym samym wątku.
- Sugestie ("Dodaj streszczenie zarządcze", "Skróć wszystkie slajdy", "Dodaj notatki prelegenta", "Załaduj dane ze źródeł", "Popraw spójność wizualną") są zamknięte w Agent AI, niedostępne z Teresy.

## 4. Zasady (invarianty)

Te reguły są twarde i obowiązują dla każdego nowego kodu w `src/`:

1. **Jedna powierzchnia czatu.** W całej aplikacji istnieje dokładnie jedna konwersacyjna powierzchnia użytkownika: Teresa, renderowana przez `UnifiedChatPanel`. Każdy nowy moduł, który chce "porozmawiać z AI", podpina się do Teresy.
2. **Moduł nie ma własnego inputu czatowego.** Żaden moduł produktowy (Wordy, Excele, Prezentacje, Tabele, DeckBuilder, dowolny edytor) nie renderuje własnego pola "wpisz prompt" ani własnego okna z wiadomościami AI.
3. **Moduł nie ma własnego "Agent AI" panelu.** Operacje typu "edytuj slajd", "skróć dokument", "dodaj kolumnę", "popraw styl" są intencjami w Teresie, a nie osobnym czatem osadzonym w narzędziu.
4. **Canvas to prawa strona, Teresa to lewa.** Moduł renderuje wyłącznie artefakt (deck, dokument, arkusz, tabelę) i ewentualne lokalne narzędzia bezpośredniej manipulacji (drag, format, zoom, undo). Zgodnie z `CANVAS_SOURCE_OF_TRUTH.md`.
5. **Kontekst jest zwirtualizowany.** Teresa wie, jaki moduł i jaki artefakt jest aktywny, dzięki `ChatSurfaceContext` (rozszerzenie istniejącego `ContextBadge` + `WorkspaceContext`). Moduł deklaruje swój kontekst jednym wywołaniem.
6. **Sugestie i quick actions to chipy w Teresie.** Każdy moduł publikuje swoją listę "Suggested Actions" przez rejestr; Teresa renderuje je jako chipy nad inputem. Lista zmienia się dynamicznie zależnie od aktywnego artefaktu i jego stanu.
7. **Pamięć rozmowy jest ciągła.** Jeden conversation thread pokrywa pracę nad różnymi artefaktami. Przejście Wordy → Prezentacje nie kasuje wątku — Teresa pamięta, że użytkownik najpierw napisał brief, a potem chciał z niego deck.
8. **Brak ukrytych autoprompts.** Każdy auto-prompt typu "Cześć, wiem że ten deck powstał z Template-based output" musi być widzialnym wkładem do widocznego wątku Teresy, nie wiadomością w równoległym, ukrytym czacie.
9. **Brak ukrytych wpisów AI.** Operacje agentyczne (np. modyfikacja decku przez AI) generują widoczne propozycje w Teresie z explicit accept/reject (zgodnie z `ai-actions-menu3.mdc` i kanonem proposal → review → apply).
10. **Bezpieczeństwo i ACL działa identycznie.** `KimiModuleGate` / module-access dla Wordy/Excele/Prezentacje musi być honorowany na poziomie akcji Teresy (Teresa nie obchodzi gate'u tylko dlatego, że jest "globalna").

## 5. Architektura docelowa

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Layout aplikacji                                                         │
│                                                                          │
│   [ Sidebar / Menu 1 ] │ [ Module View / Canvas / Artifact Surface ]     │
│                        │                                                 │
│                        │   • renderuje TYLKO artefakt + lokalne tooling  │
│                        │   • żadnego pola promptu, żadnego Agent AI      │
│                        │                                                 │
│   ────────────────────────────────────────────────────────────────────   │
│                                                                          │
│   [ Teresa: UnifiedChatPanel — jedyna powierzchnia konwersacji ]         │
│      • input + historia                                                  │
│      • ContextBadge: aktywny moduł + artifact id + scope                 │
│      • Suggested Actions (chipy z modułowych rejestrów)                  │
│      • Voice (TeresaVoiceContext)                                        │
│      • Proposals → review → apply (jednolity przepływ)                   │
└──────────────────────────────────────────────────────────────────────────┘
```

Komponenty kanoniczne:

- `UnifiedChatPanel` — istniejący, jedyny dopuszczony renderer konwersacji.
- `ChatSurfaceContext` (nowy lekki provider) — globalny stan: `{ moduleKey, artifactKind, artifactId, capabilities, suggestionRegistry }`. Każdy moduł rejestruje swój kontekst gdy użytkownik wchodzi w jego widok i wyrejestrowuje przy wyjściu.
- `useTeresaModuleBinding(moduleKey, payload)` — hook, którym moduł publikuje swój kontekst i listę sugestii do Teresy.
- `TeresaIntentRouter` (rozszerzenie istniejących detektorów: `documentIntentDetector`, `tableIntentDetector`, `whiteboardIntentDetector`) — kieruje intencję użytkownika do właściwego runtime (`useKimiArtifactPipeline`, `WorkCanvas`, `DeckBuilder agent-edit`, `Document Studio`, itd.).
- `TeresaProposalCard` — istnieje, używamy go jako jedynego renderera propozycji AI. Rezygnujemy z wewnętrznych dialogów propozycji w `AgentPanel`.

Co znika:

- Lokalne pole "wpisz prompt" w `PrezentacjeView`, `WordyView`, `ExceleView`, `TabeleView`.
- Lokalny przycisk "Generuj prezentację / dokument / arkusz" jako oddzielne pole.
- `AgentPanel` jako równoległy czat w `DeckBuilder` (zostaje wyłącznie jako *passive history view*: lista wykonanych edycji AI z możliwością revert — bez inputu konwersacyjnego).
- Per-module `chatSystemPrompt` jako prop `KimiWorkspaceShell` — system prompt staje się funkcją kontekstu w Teresie, dobierany dynamicznie przez router.

Co zostaje:

- `useKimiArtifactPipeline` jako runtime generacji artefaktu — jest wywoływany przez Teresę, nie renderuje już własnego UI rozmowy.
- `KimiWorkspaceShell` jako split layout (lewa: `UnifiedChatPanel`, prawa: artefakt) — ale przestaje przyjmować `chatSystemPrompt` / `onStartGeneration` jako props "z modułu". Te wchodzą przez Teresę.
- `TeresaVoiceContext`, `useV10TeresaRuntime` — bez zmian.
- `ContextBadge` — rozszerzony o aktywny artefakt modułu (już ma `canvas`, dodać `prezentacje | wordy | excele | tabele`).

## 6. Kontrakt: Teresa ↔ Moduł

### 6.1 Co publikuje moduł (jeden hook)

```ts
useTeresaModuleBinding({
  moduleKey: 'prezentacje',           // 'wordy' | 'excele' | 'prezentacje' | 'tabele' | 'deckBuilder' | ...
  artifactKind: 'deck',               // 'document' | 'sheet' | 'deck' | 'table' | 'canvas-doc'
  artifactId: deckId ?? null,
  title: deckTitle,
  capabilities: [
    'generate', 'edit-section', 'change-theme', 'add-summary',
    'export-pdf', 'export-pptx', 'open-builder',
  ],
  suggestions: [
    { id: 'add-exec-summary', labelKey: 'prezentacje.suggest.addExec', intent: 'add_executive_summary' },
    { id: 'shorten',          labelKey: 'prezentacje.suggest.shorten', intent: 'make_concise' },
    { id: 'add-notes',        labelKey: 'prezentacje.suggest.addNotes', intent: 'add_speaker_notes' },
    { id: 'change-theme',     labelKey: 'prezentacje.suggest.theme',   intent: 'change_theme' },
  ],
  onIntent: async (intent, payload) => { /* moduł realizuje intent */ },
});
```

Kontrakt:

- `moduleKey + artifactId` jest jedynym kluczem łączącym wiadomość Teresy z runtime modułu.
- `capabilities` deklaruje co Teresa może wywołać; nieznane intencje są blokowane (deny-by-default per `40-security-tenancy.mdc`).
- `suggestions` to dane (nie React tree) — Teresa renderuje chipy w jednolitym stylu.
- `onIntent` jest kontraktem akcji — moduł zwraca `Result<ProposalEnvelope>` którą Teresa wyświetla jako kartę propozycji do akceptacji.

### 6.2 Co Teresa daje modułowi

- Auto-rendering propozycji AI z `TeresaProposalCard`.
- Wątek (jednowątkowa pamięć rozmowy) z dostępem read-only przez moduł, gdyby potrzebował np. zacytować ostatnią decyzję użytkownika.
- Voice / language / focus mode bez żadnej pracy modułu.
- Suggestion chips, intent routing, system prompts, accessibility, i18n.

### 6.3 Czego moduł nie wolno robić

- Renderować własnego inputu konwersacji.
- Trzymać własnej historii wiadomości.
- Wywoływać `Api.post('/ai/...')` z UI bez bramki Teresy.
- Wstrzykiwać "ukrytego" pierwszego prompta przy wejściu w widok ("Cześć, ten deck powstał z..."). Jeśli chcemy taki onboard, to jest wiadomość Teresy w wątku, widoczna i kasowalna.
- Hodować własnego "Agent AI" panelu z polem tekstowym.

## 7. Migracja w fazach

### Faza 0 — zamrożenie (TEN dokument)

- Akceptacja zasad z sekcji 4.
- Wpisanie tego dokumentu do `.cursor/SOURCE_OF_TRUTH_INDEX.md`.
- Komunikacja do równoległych agentów (Wordy/Excele/Tabele/DocumentStudio): patrz sekcja 11.

Wynik: nikt nie dodaje nowego module-local chatu, nawet "tymczasowo".

### Faza 1 — Teresa z kontekstem modułu (1 sprint, frontend only)

- Implementacja `ChatSurfaceContext` + `useTeresaModuleBinding`.
- Rozszerzenie `ContextBadge` o lane'y modułowe.
- Wprowadzenie chipów Suggested Actions w `UnifiedChatPanel` (już istnieje `ChatSmartSuggestions` — przepiąć źródło na `suggestionRegistry`).
- Brak usuwania starych UI — tylko addytywnie.

Definition of Done fazy 1:

- W każdym widoku modułu Teresa widzi `moduleKey + artifactId + capabilities` w devtools.
- Chipy z sugestiami modułu pojawiają się dynamicznie po zmianie aktywnego artefaktu.

### Faza 2 — Prezentacje (pierwszy moduł na nowy kontrakt)

- `PrezentacjeView`: usunięcie własnego pola promptu i przycisku "Generuj prezentację". Pozostaje wyłącznie powierzchnia podglądu (canvas + lista slajdów) i wywołanie `useTeresaModuleBinding`.
- `useKimiArtifactPipeline('prezentacje')` traci publiczne API "uruchom z UI" — wystawia metody wywoływane przez `onIntent` (`startGeneration`, `regenerate`, `editSection`, `setTheme`).
- `DeckBuilder/AgentPanel`: wycięcie inputu i listy wiadomości. Pozostaje *History view* (lista AI operacji + revert) — to nie jest czat.

Definition of Done fazy 2:

- W `/prezentacje` widać tylko jedno pole tekstowe — Teresę.
- DeckBuilder nie ma `Send` ani `Type a message`. Ma tylko historię AI edycji i przyciski revert.
- Generacja decka, edycja, eksport — wszystko inicjowane przez Teresę.
- Test E2E: "wpisz w Teresie 'stwórz deck o X' → deck pojawia się w prawej stronie".
- Test E2E: "otwarty Deck Builder → wpisz w Teresie 'skróć slajdy' → propozycja w Teresie → accept → diff w History view".

### Faza 3 — Wordy + Excele równolegle

- Analogiczna konwersja `WordyView` i `ExceleView`.
- `WORDY_SYSTEM_PROMPT_BASE` i `EXCELE_SYSTEM_PROMPT` przeniesione do `TeresaIntentRouter` jako system prompts wybierane na podstawie `ChatSurfaceContext`.
- Suggested chips per moduł.

### Faza 4 — Tabele + Canvas + Document Studio

- `TabeleView` na ten sam kontrakt.
- `WorkCanvas` — sprawdzić czy nie wprowadza własnego inputu (jeśli tak — usunąć).
- `Document Studio` — potwierdzić, że refiner / proposal flow korzysta z `TeresaProposalCard`.

### Faza 5 — sprzątanie

- Usunięcie martwego kodu module-local chatów.
- Usunięcie propów `chatSystemPrompt` / `onStartGeneration` z `KimiWorkspaceShell`.
- Aktualizacja planów modułowych (sekcja 2).
- Wpisy w `CONTROL_BOARD.md` i changelog.

## 8. Definition of Done (całość)

Ten projekt jest "done" gdy spełnione są wszystkie poniższe:

- W żadnym widoku produktowym nie da się zobaczyć dwóch pól tekstowych "do AI" jednocześnie.
- `grep` po `chatSystemPrompt=` w `src/` zwraca tylko `UnifiedChatPanel` / `TeresaIntentRouter`.
- `grep` po nowych komponentach `*AgentPanel*` z polem `<input>` zwraca 0.
- `useKimiArtifactPipeline` nie jest wywoływane bezpośrednio z `*View` przez prompt UI, tylko z routera Teresy.
- Test akceptacyjny: użytkownik prowadzi jedną ciągłą rozmowę "zrób mi brief → zrób z tego deck → wyślij PDF" — wszystko w jednym wątku Teresy.
- ACL: użytkownik bez dostępu do Excele nie widzi sugestii Excele w Teresie i nie może wywołać excele-intencji (deny by default).
- Audyt: każdy AI action wywołany z Teresy ląduje w audit logu z `moduleKey + artifactId + intent + actor`.

## 9. Quality Gates / Testy

Minimalny zestaw walidujący zasady z sekcji 4:

- Unit: `TeresaIntentRouter` rozpoznaje intencje po module aktywnym w `ChatSurfaceContext` (per-lane fixtures).
- Unit: `useTeresaModuleBinding` cleanup — zmiana modułu wyrejestrowuje poprzednie suggestions w jednym tick.
- Component: `UnifiedChatPanel` renderuje chipy z `suggestionRegistry`, klik dispatchuje intencję.
- Integration: brak module-local input — test snapshot na `PrezentacjeView`, `WordyView`, `ExceleView`, `TabeleView`, `DeckBuilder` szuka `<textarea>` / `<input type="text">` z atrybutem `data-chat-surface` i wymaga, by go nie było.
- E2E (Playwright):
  - `e2e/teresa-unified-surface/single-input-per-route.spec.ts` — w każdym chronionym route'ie istnieje dokładnie 1 widoczny input czatu.
  - `e2e/teresa-unified-surface/cross-module-thread.spec.ts` — przejście Wordy → Prezentacje zachowuje wątek.
  - `e2e/teresa-unified-surface/deck-edit-via-teresa.spec.ts` — edycja decku z Teresy zwraca proposal.
- Regression: zachowanie obecnego flow generacji prezentacji jest testowo pokryte przez nowy router (przeniesienie z dotychczasowego module-local promptu na intencje Teresy).

Bramki ze starszego rule pack:

- `30-testing-and-quality-gates.mdc` — minimum validation, evidence required.
- `40-security-tenancy.mdc` — deny-by-default, no hidden writes.
- `ai-actions-menu3.mdc` — kontekstowe akcje w Menu 3 nadal obowiązują dla *non-conversational* AI actions; konwersacyjne idą do Teresy.

## 10. Ryzyka

- **Regres flow generacji**: jeśli odetniemy module-local prompt zanim Teresa potrafi wywołać pipeline, użytkownik traci możliwość generacji. Dlatego faza 1 (kontekst) musi poprzedzać fazę 2 (usunięcie UI).
- **Pamięć kontekstu**: jeden ciągły wątek przez wiele modułów może rozdmuchać prompt token. Mitigacja: `ChatSurfaceContext` daje routerowi jasny scope, a system prompt jest budowany z aktywnego scope, nie z całej historii.
- **ACL drift**: `KimiModuleGate` musi działać po stronie Teresy. Test e2e + capability check w intent routerze.
- **Migracja DeckBuilder AgentPanel**: 1658 linii, dużo logiki diff/proposal. Przenosimy LOGIKĘ (proposal building, revert, history) do warstwy serwisowej; UI redukujemy do *History view*. Bez przepisu logiki, tylko reasignacja UI ownership.
- **Voice mode**: `TeresaVoiceContext` musi pozostać jedynym posiadaczem mikrofonu; żaden moduł nie może otwierać własnego.
- **Demo / Onboarding skrypty**: jeśli używają module-local promptów, wymagają update.

## 11. Handoff dla równoległych agentów (Wordy / Excele / Tabele / Document Studio / DeckBuilder)

Ta sekcja jest **kontraktem dla agentów**, którzy aktualnie piszą kod w równoległych modułach. Czytajcie ją przed dodaniem czegokolwiek konwersacyjnego.

### 11.1 NIE WOLNO

- Dodawać `<EnhancedChatInput>` ani żadnego własnego `<textarea>` / `<input>` jako "pole do AI" w widoku modułu.
- Renderować osobnego panelu typu "Agent AI", "AI Assistant", "Ask AI", "Chat with the document" wewnątrz edytora.
- Trzymać własnej historii wiadomości AI w lokalnym `useState` modułu.
- Dodawać `chatSystemPrompt` jako prop do nowego komponentu modułu.
- Wstrzykiwać "ukrytego" auto-promptu przy wejściu w widok (np. greeting AI). Jeśli potrzebujecie onboarding message — to jest wiadomość Teresy do wątku, widoczna w `UnifiedChatPanel`, nie u was.
- Wywoływać `Api.post('/ai/...')` z UI modułu jako reakcja na tekst użytkownika. Tekst użytkownika należy do Teresy; wy realizujecie intencje, które Teresa do was deleguje.

### 11.2 WOLNO i NALEŻY

- Renderować artefakt (dokument / arkusz / deck / tabelę) i lokalne narzędzia bezpośredniej manipulacji (drag, resize, format, undo, hotkeys).
- Renderować *passive AI history* — listę zaaplikowanych edycji AI z timestamp + actor + revert. To nie jest czat (brak inputu).
- Publikować swoje suggestions do Teresy przez `useTeresaModuleBinding` — chipy "Skróć", "Dodaj sekcję X", "Eksportuj jako Y".
- Implementować `onIntent(intent, payload)` jako kontrakt akcji. Wynik akcji to propozycja, którą Teresa pokaże w `TeresaProposalCard`.
- Używać istniejącego `useKimiArtifactPipeline` jako runtime — ale wywoływanego przez Teresę, nie z waszego UI.

### 11.3 Konkretne wytyczne per moduł

Wordy (`src/components/AIChat/KimiWorkspace/WordyView.tsx`):

- Usuwacie zależność na `chatSystemPrompt` i własny `WORDY_SYSTEM_PROMPT_BASE` zostawiacie wyłącznie jako STAŁĄ przekazaną do `TeresaIntentRouter` przy rejestracji modułu (`useTeresaModuleBinding({ moduleKey: 'wordy', systemPrompt: WORDY_SYSTEM_PROMPT_BASE, ... })`).
- Lista sugestii startowa: "Streszczenie wykonawcze", "Skróć dokument", "Dodaj sekcję ryzyk", "Generuj wnioski", "Eksportuj PDF".

Excele (`src/components/AIChat/KimiWorkspace/ExceleView.tsx`):

- Analogicznie. `EXCELE_SYSTEM_PROMPT` → przekazany przez binding do routera.
- Lista sugestii startowa: "Dodaj arkusz Cash Flow", "Połącz z Założeniami", "Dodaj wykres", "Sprawdź formuły", "Eksport XLSX".
- Dodatkowo: jeśli aktywny jest konkretny arkusz, suggestions są skontekstualizowane do tego arkusza (intent payload niesie `sheetId`).

Tabele (`src/components/AIChat/KimiWorkspace/TabeleView.tsx`):

- To samo. `TABLE_SYSTEM_PROMPT` → binding.
- Lista sugestii startowa: "Dodaj kolumnę X", "Wykryj relacje", "Zaproponuj typy", "Pokaż braki danych".

DeckBuilder (`src/components/Presentations/DeckBuilder/`):

- `AgentPanel` przestaje być powierzchnią konwersacji. Po refaktorze pozostaje tylko jako "AI Edit History" — lista zaaplikowanych edycji AI z możliwością revert. Bez `<textarea>`, bez `Send`, bez `MessageSquare` jako wejścia.
- Endpointy `/api/presentations/decks/:deckId/agent-edit` zostają, ale wywoływane są z routera Teresy, nie z `AgentPanel`.

Document Studio (`src/components/DocumentStudio/`):

- Refiner / proposal builder pozostaje jako serwis. UI propozycji renderuje `TeresaProposalCard`, nie własny dialog. Jeśli macie własny `DocumentStudioQaPanel` — sprawdźcie czy to jest *passive* (lista issues/QA), czy konwersacyjny. Jeśli konwersacyjny — wytnijcie input.

Canvas (`src/components/AIChat/WorkCanvas/`):

- Canvas już architektonicznie deklaruje, że "Teresa = lewa, Canvas = prawa" (`CANVAS_SOURCE_OF_TRUTH.md`). Trzymajcie się tego. Każda chęć dodania "command bar" w Canvas niech idzie przez intent w Teresie.

### 11.4 Code review checklist (dla każdego PR z nowym modułem AI)

Reviewer odrzuca PR jeśli:

- [ ] Pojawia się nowy `<textarea>` / `<input>` którego label sugeruje rozmowę z AI.
- [ ] Pojawia się nowy state typu `messages: ChatMessage[]` w widoku modułu.
- [ ] Pojawia się nowy `Api.post('/ai/...')` wywoływany z UI w odpowiedzi na free-form text.
- [ ] Pojawia się prop `chatSystemPrompt` lub `onStartGeneration` w nowym komponencie poza `UnifiedChatPanel` / `TeresaIntentRouter`.
- [ ] Brak `useTeresaModuleBinding` w nowo dodawanym widoku modułu produktowego.

## 12. Open questions

- Czy w trybie offline / fallback (Teresa down) potrzebujemy *break-glass* lokalnego promptu w module? Decyzja produktowa: domyślnie nie; jeśli tak — jednoznaczne UI "Teresa offline – emergency mode" z auditem.
- Migracja istniejących wątków: czy wątek z `/prezentacje` sprzed zmiany ma być merge'owany do głównego wątku Teresy, czy pokazujemy go jako *legacy thread*? Rekomendacja: legacy thread read-only przez 30 dni, po czym archiwizacja.
- Multi-tenant: czy chcemy izolację wątków na poziomie projektu (`projectId`) czy organizacji? Dziś jest po userze. Decyzja: dopisać w fazie 1.
- Voice barge-in między modułami: jedna kolejka (jest), więcej nie potrzeba.

## 13. Audit trail

- 2026-05-08 — utworzenie dokumentu, wywołane regresją w `/prezentacje` (dwa pola promptu) i osobnym `Agent AI` w DeckBuilder.
- Powiązany BUG: `DRD/testy_antygravity/reports/2026-05-07_2223_BUG-presentations-preview-404.md` (404 preview rozwiązany; ten dokument adresuje warstwę nadrzędną).
