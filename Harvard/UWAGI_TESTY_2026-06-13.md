# Uwagi z testów właścicielskich — 2026-06-13

> Sesja żywych testów Piotra (OWNER, org DBR77) po otwarciu bramki beta. Format: jedna uwaga = jeden wpis, z triażem (P0–P3), modułem, objawem, diagnozą w kodzie (`plik:linia`) i statusem. Diagnoza = prawda kodu, nie domysł.

## 🔝 TOP / PRIORYTET (do naprawy najpierw)
- **#15 — Nie da się otworzyć inicjatywy** (M13) — blokuje cały przepływ inicjatyw, na który właściciel chce wejść. Szczegóły niżej.

## ZASADA SESJI (ustalona 2026-06-13): uwagi = sygnały programowe, nie tickety

Każdą uwagę traktujemy jako **sygnał dla całego wdrożenia programu Harvard**, nie jako izolowany bug. Decyzja właściciela: „jeżeli na pierwszym kroku Teresa nie działa, to nie zadziała też dalej." Dwupoziomowa klasyfikacja:

- **SYSTEMOWE** — objaw we wspólnej warstwie (sterowanie Teresą, artefakty, generacja deliverables, wiązanie chat→panel). Jeden fix podnosi N modułów. Eskalacja na **poziom programu** (P0/P1-program), nie modułu. Konsekwencja: oceny „D — żywa użyteczność" w `_TRACKER.md` są zawyżone, bo smoke testował render, nie sterowanie. Po naprawie warstwy → re-ocena D dla wszystkich modułów dotykających Teresy.
- **LOKALNE** — objaw w jednym module/widoku, fix nie promieniuje.

Wspólna warstwa sterująca (kręgosłup): `UnifiedChatPanel` + `useArtifactsStore` + `canvasStreamIntentDetector` + persona Teresy + pipeline `deliverables:draft-ready` → `WorkCanvasDocumentPanel`. Renderuje deliverables także dla M18 Document Studio / M19 Presentation Studio / M20 Table Studio → **pęknięcie wiązania promieniuje na te moduły**.

---

## UWAGA #1 — Czat NIE steruje aplikacją (chat-as-controller) · M02 Canvas · **SYSTEMOWE / P0-program**

> **PEŁNY WORK-PACKAGE: `Harvard/SPEC_ZADANIE_01_chat_controller.md`** (sporządzony 2026-06-13 po 2 rozpoznaniach kodu). Poniżej skrót; szczegóły, projekt naprawy fazami i DoD w specu.
>
> Klasa: SYSTEMOWE — wspólna warstwa sterująca (kręgosłup `UnifiedChatPanel`+detektory+persona+pipeline→`WorkCanvasDocumentPanel`). Każdy przepływ „z czatu zrób deck/doc/sheet" idzie tędy. Czy standalone studia M18/M19/M20 reużywają tego panelu (czy to osobne powierzchnie, flaga OFF → legacy `/wordy`) — DO POTWIERDZENIA przy fixie, nie nadinterpretować. Niezależnie: po naprawie → re-ocena wymiaru D w `_TRACKER.md`.
>
> **🟢 PRZEŁOM 2026-06-14 (test na żywo, lokalnie):** kręgosłup **DZIAŁA** — w czacie „Napisz dokument: plan testów…" → prawy panel zamontował realny dokument („Plan testów modułu Czat / Executive Summary / treść"), **brak redirectu /wordy**, **trwałe po reload**. Tryb B (commit `8a0e64b866`) zweryfikowany end-to-end. **ROOT CAUSE „nigdy nie zadziałało u Piotra":** flaga `VITE_ENABLE_DELIVERABLES_LIGHT=true` jest TYLKO w `.env.local` (plik prod-local Piotra). Vite lokalnie ją ładuje → ON. Ale na **zdeployowanym staging/demo brak `.env.local` → flaga OFF → front spada do legacy-redirect** → panel nigdy się nie wypełnia. **FIX (infra, dla Piotra):** ustawić `VITE_ENABLE_DELIVERABLES_LIGHT=true` w env builda Railway (staging+prod). Kod jest OK.
>
> **Rozszerzona weryfikacja 2026-06-14 (noc):** triada w panelu na żywo — **doc** (edytor + treść + trwałe po reload) ✅, **deck** (split-view czat↔panel + dynamiczne zakładki artefaktów + „Otwórz w Deck Builder") ✅. Zero redirectu legacy, **konsola czysta**. Drobiazg: miniatury slajdów decku puste na 1. renderze (lazy/render — do dojrzenia, nie błąd JS). Testy: M01 **360/360** + M02 unit **59/59** (osierocony `canvasMutationRisk` naprawiony realnym modułem — commit `f31ec6e010`).
>
> **Korekta vs pierwsza diagnoza:** to DWA odrębne tryby awarii — **A (halucynacja, brak akcji)** gdy fraza chybia wąski regex `documentIntentDetector.ts:1-51` i Teresa łamie własny zakaz persony `persona.ts:303-319`; **B (realna-ale-zerwana więź)** gdy draft powstaje (`work_canvas_drafts`) ale panel ściga się do szablonu „Company Work Note" (`WorkCanvasDocumentPanel.tsx:704-726`). Rekomendowany pierwszy fix: Fala 1 / Tryb B (mały, niskie ryzyko).

**Objaw (żywy, screenshot):** W widoku Chat (Teresa po lewej, Canvas po prawej) Teresa twierdzi „Plan został dodany do Twojego Canvasa jako dokument", ale po prawej dalej wisi pusty szablon „Company Work Note". Chip „Dzienny plan 7 lutego" nie ładuje się do widoku. Użytkownik: „Ciągle na ekranie nie widzę tego." Teresa: „Przepraszam… wygląda na to, że nie dokończyłem." Z czatu nie da się też wydać polecenia zmiany treści dokumentu po prawej.

**Oczekiwanie właściciela:** czat ma sterować tym, co widać po prawej — tworzyć, podmieniać i edytować dokument na żywo (agentic canvas).

**Diagnoza (potwierdzona w kodzie, 3 złożone przyczyny):**

1. **[HIGH] Zerwana więź przy dostarczeniu.** Backend tworzy draft i odpala `deliverables:draft-ready`, ale prawy panel nie przełącza się na nowy dokument — listener wychodzi wcześniej, bo porównuje `readyDraftId === documentState.draftId` (świeży draft ≠ aktualny). Dowód: `src/components/AIChat/WorkCanvasDocumentPanel.tsx:1039-1043`. Auto-mount przez `setMountOverride` (`:711-720`) działa tylko przy wyścigu czasowym; reset przy nowej rozmowie `:704-706`.
2. **[MEDIUM] Halucynowane potwierdzenie.** „Plan został dodany do Twojego Canvasa" to czysta proza LLM bez tool-calla — grep nie znajduje komunikatu w kodzie, brak transakcyjnej walidacji że draft jest widoczny.
3. **[HIGH] Dwa rozłączne systemy artefaktów.** Legacy `ArtifactsPanel` + `useArtifactsStore` (render `src/components/layout/SplitLayout.tsx:461`) vs nowy `WorkCanvasDocumentPanel` (render `src/components/AIChat/UnifiedChatPanel.tsx:5905`). Niełączone typy: `Artifact.type` (`src/types/core.ts:2248`) vs `ActiveCanvasDocument.kind`. Artefakt ląduje w jednym store, użytkownik patrzy na drugi panel; bez ręcznego `CanvasArtifactSwitcher` (`src/components/AIChat/CanvasArtifactSwitcher.tsx:68-140`) nie zobaczy.

**Co DZIAŁA (granica):** patch-mode + streaming do TipTap działają, ale tylko gdy dokument jest już otwarty (`activeCanvasDocument !== null`, `src/components/AIChat/UnifiedChatPanel.tsx:2956`) i polecenie pasuje do regexów intencji (`src/components/AIChat/canvasStreamIntentDetector.ts:91-101`). Inaczej cicho spada do zwykłego czatu. Pipeline: `src/components/AIChat/CanvasEditor/useCanvasAIStream.ts:81-182`.

**Niezweryfikowane (do domknięcia przy fixie):** czy generacja `doc`/`sheet` wpisuje artefakt do `useArtifactsStore` (`server/src/services/deliverables/docGenerationRuntime.ts` niedoczytany). Brak agentic „interpretacji poleceń wpisanych wewnątrz dokumentu" — z założenia (nie do naprawy bez decyzji produktowej).

**Powiązane:** `[[project_canvas_overhaul]]`, `[[project_canvas_program]]`, karta `Harvard/modules/M02-canvas/KARTA_AUDYTU.md` (linia 56 już sygnalizowała dwa równoległe silniki jako kandydat do konsolidacji).

**Status:** ZDIAGNOZOWANE. Fix nie rozpoczęty (tryb zbierania uwag). Kierunek naprawy: (a) auto-mount świeżego draftu w panelu po `draft-ready` niezależnie od bieżącego `draftId`, (b) zastąpić halucynowane „dodałem" realnym tool-callem z potwierdzeniem widoczności, (c) konsolidacja dwóch systemów artefaktów lub most store↔panel.

---

## UWAGA #2 — „Ramka w ramce" w polu czatu (composer) · M01 Czat / UI · **LOKALNE / P3**

**Objaw (żywy, screenshot):** Pole „Ask Teresa about your work…" pokazuje podwójną ramkę — zewnętrzny (czerwony, focus) prostokąt obejmuje textarea + pasek ikon, a w środku jest druga, jaśniejsza ramka wokół samego textarea. Ma zostać tylko zewnętrzna.

**Namiar w kodzie:** composer = `src/components/AIChat/EnhancedChatInput.tsx`. Główny kontener „Main Input Container" `:1076-1084` ma `rounded-xl border` + `border-c-focus-solid` przy focusie (to czerwona ramka zewnętrzna). Textarea (`:1171-1175`, `bg-transparent`, bez bordera) i action-bar (`:1186-1192`, bez bordera) same nie rysują ramki — więc wewnętrzna ramka pochodzi z dodatkowego zagnieżdżonego elementu/wrappera (prawdopodobnie wrapper wokół textarea albo styl nakładany na poziomie `UnifiedChatPanel.tsx:5459` `<div id="chat-input">`). Rendered z `src/components/AIChat/UnifiedChatPanel.tsx:5482`.

**Do domknięcia przy fixie (2 min):** DOM-inspect żywego composera (preview_inspect) by wskazać dokładnie który z dwóch elementów rysuje wewnętrzną ramkę → usunąć `border` z wewnętrznego, zostawić zewnętrzny focus-border. Drobiazg kosmetyczny, zero ryzyka.

**Status:** ZDIAGNOZOWANE (namiar zawężony do composera). Fix nie rozpoczęty.

---

## UWAGA #3 — „Show reasoning" nie pokazuje toku myślenia w ogóle · M01 Czat · **SYSTEMOWE / P2**

> Klasa: SYSTEMOWE — dotyczy każdej rozmowy i każdego modelu, gdy przełącznik ON.

**Objaw (żywy):** Po włączeniu „show reasoning" Teresa nie pokazuje rozumowania. Pojawia się tylko „Thinking…" w trakcie streamu, ale realny tok myślenia nigdy się nie renderuje.

**Mechanizm (jak jest):** Przełącznik `showReasoning` (store `src/store/slices/chatSlice.ts:101`) → przekazany w `aiModes.showReasoning` (`src/components/AIChat/UnifiedChatPanel.tsx:3620`, `src/services/api.ts:2347`) → backend `server/src/routes/ai.routes.ts:1204,1451` → `server/src/services/ai/AIPipeline.ts:2052-2067`: gdy ON, dokleja do system-promptu MIĘKKĄ instrukcję „dodaj sekcję `<thinking>…</thinking>`". Front parsuje `<thinking>` (`src/hooks/useAIStream.ts:251-266,705-712`, `splitThinking`), zapisuje do `message.metadata.reasoning` (`:812`), renderuje `<ReasoningTrace>` tylko gdy pole istnieje (`src/components/AIChat/MessageRenderer.tsx:513-520`).

**Przyczyna (werdykt A — nigdy nie żądane od modelu):** `showReasoning=true` ustawia tylko prozaiczną instrukcję w promptcie, ale pipeline **NIE ustawia żadnego parametru modelu** (`extended_thinking`/`thinking budget`/`reasoning`) ani nie wymusza tieru modelu wspierającego reasoning. Model bez trybu thinking ignoruje prośbę → brak `<thinking>` → `metadata.reasoning` puste → `ReasoningTrace` się nie renderuje. „Thinking…" to statyczny placeholder streamu, nie wiązanie do realnego rozumowania.

**Kierunek naprawy:** w `AIPipeline.ts:~2052` przy `showReasoning` ustawić realny parametr reasoning w wywołaniu modelu (zależnie od dostawcy/tieru) i/lub wymusić model wspierający thinking; dopiero wtedy miękka instrukcja ma pokrycie. (Uwaga: warstwa AI — testować na staging, prod za zgodą.)

**Status:** ZDIAGNOZOWANE. Fix nie rozpoczęty.

---

## UWAGA #4 — Odpowiedź po angielsku na pytanie po polsku · M01 Czat / język · **SYSTEMOWE / P1**

> Klasa: SYSTEMOWE — warstwa decyzji o języku; jeden fix (detekcja + utrwalanie języka rozmowy) podnosi wszystkie interakcje. Powtarzający się błąd.

**Objaw (żywy):** Użytkownik napisał po polsku („Z pierwszej informacji na temat DBR77."), Teresa odpowiedziała po angielsku.

**Mechanizm (jak jest):** Język odpowiedzi = `effectiveChatLanguage = detectMessageLanguage(content) || chatLanguage` (`src/components/AIChat/UnifiedChatPanel.tsx:2000-2001`). Detektor `src/utils/detectMessageLanguage.ts:152-186` zwraca `null` gdy brak pewności (próg: `topScore>=2` i ścisła przewaga; remis → null). Fallback `chatLanguage` (`UnifiedChatPanel.tsx:834-849`): `explicitPref || activeConversationLang || uiLang`, a `uiLang` defaultuje do `'en'` (`:844`). Backend przy braku/niepewności: `ai.routes.ts:1256-1258` i `persona.ts:544` defaultują do **English** + twarda instrukcja „You MUST always respond in English".

**Przyczyna (werdykt C — detekcja zawodzi → zły język do serwera → angielski default):** próg detekcji za wysoki dla krótkich/mieszanych fraz PL (nazwa „DBR77" + kilka polskich stopwords) → `null` → fallback na język UI (EN) → serwer buduje angielską personę. Język rozmowy **nie jest utrwalany** po udanej detekcji, więc każdy kolejny message znów może wpaść w EN.

**Kierunek naprawy:** (1) obniżyć próg / dodać silny sygnał diakrytyków PL (ąćęłńóśźż ⇒ PL) w `detectMessageLanguage.ts:183-184`; (2) po udanej detekcji wołać `setConversationChatLanguage()` i używać tego jako fallback zamiast UI-lang; (3) opcjonalnie jawny przełącznik języka per-rozmowa (stan już istnieje). Rozważyć też w personie twardą regułę „odpowiadaj w języku ostatniej wiadomości użytkownika".

**Status:** ZDIAGNOZOWANE. Fix nie rozpoczęty.

---

## UWAGA #5 — Crash strony „Coś poszło nie tak" na My Work · M03 Moja Praca · **LOKALNE / P1 (WIDOCZNE-ALE-ZEPSUTE)**

**Objaw (żywy, screenshot):** Wejście na My Work → error boundary „Coś poszło nie tak / Strona napotkała problem i została bezpiecznie zatrzymana" + „Crash diagnostics were sent successfully". Render-time wyjątek złapany przez granicę błędu.

**Namiar (kandydaci):** widok `src/views/MyWorkView.tsx` → hub `src/components/MyWork/MyWorkHub.tsx`; granice błędu `src/components/RouteErrorBoundary.tsx`, `src/components/MyWork/table/ViewErrorBoundary.tsx`. Hak danych `src/hooks/useV8MyWorkRoof.ts`, API `src/services/api/v8/my-work.ts`. Kontekst historyczny: `/api/my-work/home` i `/radar` bywały 404 (Fala 14), `home/brief+spark` miało 500 naprawione (`f3724dbb2e`) — możliwy nawrót lub nowa ścieżka.

**Do domknięcia (wymaga dowodu):** dokładny wyjątek **nieznany bez konsoli/stack-trace**. Crash-diagnostics są wysyłane („sent successfully") — sprawdzić backend/telemetrię crashy. Alternatywnie repro przez preview (preview_console_logs + preview_snapshot na `/my-work`) by złapać stack. Bez tego nie kwalifikuję przyczyny — verify-before-claiming.

**Status:** ZGŁOSZONE, przyczyna NIEustalona (brak stack-trace). Priorytet P1 — crash łamie protokół (hard cap WIDOCZNE-ALE-ZEPSUTE dla M03).

---

## UWAGA #6 — Notatniki niewplecione w strukturę pracy (brak trwałego „trzeciego panelu") · M04 Notatnik / powłoka nawigacji · **SYSTEMOWE / P1-design**

> Klasa: SYSTEMOWE — to zmiana w POWŁOCE nawigacyjnej, nie w samym module. Ten sam motyw co Uwaga #1 (trwały trzeci panel roboczy). **Wymaga decyzji produktowej przed budową** — dotyka globalnego layoutu wszystkich modułów.

**Objaw / oczekiwanie (żywy, słowami właściciela):** Otwarcie notatki z listy otwiera ją „bez panelu trzeciego". Docelowo: otwarcie notatnika ma otwierać **dynamiczną listwę-panel (trzeci panel)** z nazwą tego notatnika; z lewej lista **otwartych** notatników (kilka jednocześnie = kilka linków/zakładek); zmiana modułu **nie zamyka** tej listy — notatniki zostają dostępne w trzecim panelu. Innymi słowy: „wpleść notatnik w całą strukturę pracy" = notatniki jako pierwszoklasowy, dokowalny, wielo-instancyjny workspace w globalnej powłoce.

**Stan obecny (zweryfikowany):** Warstwa kontenerów L0→L1 (biblioteka notatników)→L2 (workspace: lista stron + edytor)→L3 (notatka) **została zbudowana 2026-06-02** (`NotebookLibraryContent.tsx` + `NotebookContent.tsx` + `MyWorkHub.tsx`; migracja `notebooks` + `notebook_id`; SSOT `docs/product/NOTEBOOK_STRUCTURE_SSOT.md`). To, o co teraz prosi właściciel, **wykracza poza tamten plan** — SSOT NIE opisuje trwałego trzeciego panelu, zakładek wielu notatników, ani przeżywania zmiany modułu (grep potwierdza brak „trzeci panel/right rail/tabs/cross-module/persist" w SSOT/V3).

**Reużywalny mechanizm (do oparcia fixu, nie budować od zera):** powłoka prawego panelu istnieje w kilku miejscach — `src/components/shared/ExecutiveModuleShell/RightRail.tsx` (+ `index.tsx`), split czatu z Canvas (`SplitLayout.tsx` + `WorkCanvasDocumentPanel`), oraz `src/components/AIChat/KimiWorkspace/tabeleShell/useTabeleRightRailPanels.tsx`. **Synergia z Uwagą #1 Tryb C:** to wołanie o JEDEN globalny, wielo-instancyjny „workspace/trzeci panel", który hostuje notatniki, dokumenty Canvas, tabele — czyli ta sama konsolidacja, której wymaga kręgosłup Teresy. Warto projektować łącznie.

**Otwarte pytanie produktowe (do decyzji):** czy „trzeci panel" to globalny dok przeżywający nawigację (jak IDE-tabs), czy kontekstowy panel per-moduł? Zakres (ile otwartych naraz, czy współdzielony z Canvas/Tabelami) determinuje architekturę. To NIE jest fix — to mini-redesign powłoki.

**Status:** ZGŁOSZONE jako żądanie architektury. Rozszerza `[[project_notebook_structure_overhaul]]`. Czeka na decyzję zakresu powłoki + projekt łączny z Uwagą #1 (konsolidacja workspace).

---

## UWAGA #7 — Lekki workspace notatnika (odchudzić Canonical Path + skonsolidować prawy panel) · M04 Notatnik · **SYSTEMOWE / P1-design**

> **PEŁNA PROPOZYCJA: `Harvard/SPEC_ZADANIE_07_notebook_workspace.md`** — oparta na 2 analizach (inwentarz kodu + standardy rynkowe), na zlecenie właściciela.

**Diagnoza:** „CANONICAL NOTEBOOK PATH" (`NotebookCanonicalPathStrip.tsx:25-179`) to gigantyczny pasek zjadający ~40% kanwy, który DUPLIKUJE akcje już obecne w prawym panelu (sources/AI/review/convert). Prawy panel rozproszony: 2 toggle (Tools `AIChatInlinePanel`, Context `NotebookContextPanel`) + 2 panele zdarzeniowe (ActionItems, Topics) + niejasny 3. przycisk (dymek). Spuścizna „aplikacji-jako-tabeli".

**Propozycja (skrót):** (a) usunąć wielki pasek → slim progres-chip `①Sources ②AI ③Review ④Convert` w nagłówku; (b) 3 okna → JEDEN rail z 2 zakładkami: **A „Praca"** (Insert/AI/Convert×7/Transform/Attrybuty — scala Tools+ActionItems+Topics+Canonical) + **B „Kontekst AI"** (żarówka — backlinks/outputs/suggestions, ZOSTAJE); 3. przycisk usunąć/scalić; (c) budować jako reużywalny `workspace right-rail` wspólny z Uwagą #1/#6. Mapa „nic nie ginie" w specu §5.

**Standardy rynkowe:** jeden inspector-rail z zakładkami (Notion/Obsidian/Craft), AI inline nie jako panel, backlinks pasywny kontekst, auto-surfacing (Mem/Tana). Źródła w specu §2.

**Otwarte decyzje (właściciel):** (1) czym jest 3. przycisk-dymek; (2) zakres trzeciego panelu (globalny dok vs per-notatka); (3) chip w nagłówku vs ikony w toolbarze.

**Status:** PROPOZYCJA gotowa do akceptacji. Build nie rozpoczęty.

---

## UWAGA #8 — Menu 3 w Notebooku pokazuje filtry zadań (Overdue/Urgent/Inbox), nie notatek · M04 Notatnik · **LOKALNE / P2** (część #7)

**Objaw (żywy, screenshot):** W widoku Notebook (notatnik otwarty, lista stron) command-row/„Menu 3" u góry pokazuje chipy `Overdue 175 · Urgent 39 · Inbox 256` — liczniki domeny ZADAŃ, niezwiązane z pracą na notatkach.

**Diagnoza (zweryfikowana częściowo w kodzie):** `renderCommandRow()` w `src/components/MyWork/MyWorkHub.tsx:2374` ma dedykowaną gałąź notatnika **tylko dla L1 (biblioteka)** — warunek `activeTab === 'notebook' && !notebookOpenId` (`:2443`) renderuje chipy zakresu (Wszystkie/Osobiste/Zespołowe). Dla **L2 (notatnik otwarty, `notebookOpenId` ustawiony)** brak gałęzi note-domenowej → command-row pokazuje liczniki cross-domenowe. Definicje task/inbox-presetów: taskFilters `:1480-1525` (overdue/urgent), inbox presets `:2585-2612`. **Do potwierdzenia (2 min):** dokładna gałąź renderująca Overdue/Urgent/Inbox w L2 (czy to fall-through, czy osobny globalny pasek triage) — nie domykam bez DOM-inspect, ale kierunek pewny: brak note-domenowego Menu 3 dla otwartego notatnika.

**Kierunek naprawy:** dodać gałąź `renderCommandRow` dla notatnika-L2 z kontrolkami notatek (status Inbox/Active/All + scope, albo verification/tags), zamiast dziedziczenia liczników zadań. Naturalnie wpina się w Uwagę #7 (lekki workspace notatnika) — robić razem.

**Status:** ZDIAGNOZOWANE (kierunek pewny, dokładna gałąź L2 do potwierdzenia). Fix nie rozpoczęty.

---

## UWAGA #9 — Kalendarz: „Connect in Integrations" to martwy tekst; podłączenie Google/Outlook niepełne · M03 Calendar / Integracje · **LOKALNE / P2**

**Objaw (żywy, screenshot):** W kalendarzu lewy panel SOURCES pokazuje Google Calendar i Outlook jako „Not connected" z napisem „Connect in Integrations / Podłącz w Integracjach". Właściciel: „musisz dodać możliwość podłączenia."

**Diagnoza (zweryfikowana w kodzie — częściowo zbudowane, dwa braki):**
1. **Martwy CTA.** „Podłącz w Integracjach" to zwykły `<span>` w środku `<button>`, którego `onClick` = `toggleSource(source)` (`src/components/MyWork/Calendar/CalendarSidebar.tsx:166,184-192`) — czyli klik tylko przełącza źródło on/off, **NIE nawiguje do Integracji**. Brak actionable ścieżki do podłączenia z poziomu kalendarza.
2. **Connect kalendarza niedokończony.** Zaplecze istnieje: `server/src/services/integrationOAuthEngine.ts` ma providerów `google` (scope Gmail!) i `outlook`/`teams` + sekcję Calendar od `:113`; route `server/src/routes/integrations/calendarIntegrations.routes.ts:124-163` zwraca status `google_calendar`/`outlook` connected, ale sygnał oznaczony komentarzem **„(future)"** (`:132`) — pełny OAuth-connect kalendarza nie jest dopięty. Strona Integracji istnieje (`src/views/settings/IntegrationsModule.tsx`, `IntegrationsMarketplace.tsx`). ICS-feed działa niezależnie od OAuth (`:163`).

**Kierunek naprawy:** (1) zrobić z „Podłącz w Integracjach" realny link nawigujący do `IntegrationsModule` (deep-link do sekcji kalendarzy); (2) dopiąć OAuth-connect kalendarza end-to-end w Integracjach — provider `google_calendar` z właściwymi scope'ami kalendarza (obecny `google` ma scope Gmail) + Outlook/Graph calendar; (3) po połączeniu źródło w `CalendarSidebar` staje się `isAvailable`. Wymaga env: `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` na Railway.

**Status:** ZDIAGNOZOWANE. Zaplecze OAuth częściowo gotowe; brakuje wiringu connect + actionable CTA. Fix nie rozpoczęty.

---

## UWAGA #10 — Otwarcie inicjatywy ZAWSZE przerzuca do modułu Inicjatyw (zamiast karty w bieżącym widoku) · M13/M03 nawigacja · **SYSTEMOWE / P1**

> Klasa: SYSTEMOWE. Należy do KLASTRA „trzeci panel / in-context open" razem z #1, #6, #7, #8. Jeden wzorzec rozwiązuje wszystkie.

**Objaw (żywy):** Klik inicjatywy w kalendarzu (i „gdziekolwiek w aplikacji") natychmiast hard-nawiguje do panelu Inicjatyw, zamiast otworzyć kartę inicjatywy w trzecim panelu/dynamicznej zakładce bieżącego widoku (kalendarza).

**Diagnoza (zweryfikowana — asymetria potwierdzona w kodzie):**
- Kalendarz: `onInitiativeClick` → `navigate(getArtifactPath('initiative', id))` — twarda nawigacja (`src/components/MyWork/MyWorkHub.tsx:3192-3194`).
- Generyczny handler `mywork-open-item` (`MyWorkHub.tsx:1235-1251`): dla KLASY typów `initiative, assessment, report, presentation, meeting, financial_model, budget, valuation, analysis, tool` robi `navigate(getArtifactPath(...))` — zawsze przerzuca.
- KONTRAST: `task, decision, idea, notification, notebook` (`:1252-1273`) otwierają się **in-context** przez `handleOpenDocument` (dynamiczne zakładki) / `setNotebookOpenPageId`. Czyli mechanizm in-context ISTNIEJE, ale inicjatywy (i 9 typów deliverables) z niego nie korzystają.

**Kierunek naprawy:** przepiąć `initiative` (+ pozostałe typy deliverables, gdzie ma to sens) na ten sam in-context `handleOpenDocument`/dynamiczna-zakładka, zamiast `navigate(getArtifactPath)`. To dokładnie wymaga reużywalnego „trzeciego panelu" z #1/#6/#7. **Decyzja: które z 10 typów otwieramy in-context, a które słusznie nawigują do pełnego modułu** (np. report/presentation = Canvas; budget/valuation = pełny moduł finansów).

**Status:** ZDIAGNOZOWANE. Konwerguje z klastrem trzeciego panelu. Fix nie rozpoczęty.

---

## UWAGA #11 — Kalendarz: długie paski multi-day przytłaczają widok miesiąca · M03 Calendar · **LOKALNE / P2-design**

**Objaw (żywy, screenshot):** Widok miesiąca renderuje wielodniowe inicjatywy/zadania jako pełnoszerokie paski (RPA Implementation, Cloud Migration Phase 2 ×N) powtarzane w każdym tygodniu → ściana fioletowych linii spychająca numery dni i „+N more". Bałagan. Dodatkowo: paski są jednolicie fioletowe — **gubią kolor źródła** (legenda SOURCES: Tasks niebieski / Initiatives czerwony / Decisions pomarańcz), więc kodowanie kolorem nie działa.

**Propozycja „sprzątania" (na bazie konkurencji + wzorców):**
1. **Rozdzielić dwa gatunki danych:** punktowe (taski/decyzje/eventy) zostają w komórkach dnia; **długotrwałe inicjatywy WYJĄĆ z siatki dni** do osobnej, zwijanej „listwy Timeline/Roadmap" nad gridem (lub reprezentować w komórce tylko cienkim kolorowym brzegiem/kropką, bez pełnego paska z etykietą). To największa wygrana — inicjatywa trwa tygodnie, nie jest „eventem dnia".
2. **Twardy cap + overflow:** max 2 widoczne wiersze/dzień, reszta → „+N", klik = popover dnia (standard rynkowy).
3. **Wskaźnik gęstości zamiast etykiet** dla zajętych dni (kropki/heat 0–N) — pełne etykiety tylko po najechaniu/kliknięciu.
4. **Przywrócić kolory źródła** na paskach (teraz wszystko fioletowe — realny regres kodowania).
5. **Domyślny Month = lekki (eventy/taski); dodać widok „Timeline/Roadmap"** do istniejącego przełącznika Month/Week/Day/List — tam żyją wielotygodniowe inicjatywy jako lane'y (model roadmapy: Linear/Motion/monday).

Źródła: [Calendar UI best practices (setproduct)](https://www.setproduct.com/blog/calendar-ui-design), [Calendar UI examples (eleken)](https://www.eleken.co/blog-posts/calendar-ui), [Mobiscroll month/week event view](https://demo.mobiscroll.com/eventcalendar/month-week-view). Render obecny: `src/components/MyWork/Calendar/CalendarView.tsx` (handleEventClick `:331`, render eventów + „+N more").

**Status:** PROPOZYCJA naszkicowana. Build nie rozpoczęty. Sub-bug kolorów źródła do naprawy razem.

---

## UWAGA #12 — PROD P0: nagranie głosowe w Wywiadzie „ładnie się napisało, a nie wkleiło" · M10 Wywiad · **P0 (produkcja, VTS wave 2)**

> Wysłane do masy ludzi na prod jako działające. Właściciel: „duży fakap… przez weekend wypchnąć na produkcję". Tryb: DIAGNOZA→FIX (nie „później").

**Objaw (żywy, 3 screenshoty):** Odpowiedź głosowa — tekst pojawia się NA ŻYWO w polu, ale przy Stop toast „Nie udało się przetworzyć nagrania", tekst nie zapisany. Retry tej samej akcji → działa, chip audio + „Transkrypcja dodana (przeglądarka)".

**Przyczyna (POTWIERDZONA w kodzie, DWUCZĘŚCIOWA):**
1. **[FE, deterministyczny] Interim transcript gubiony przy Stop.** `recognition.onresult` dopisuje do `liveTranscriptRef` tylko wyniki FINAL (`InterviewSingleQuestionRuntime.tsx:838-839`); interim idzie tylko do `setLiveInterim` (widoczny na ekranie, `:844`). `recorder.onstop` czyta `browserTranscript = liveTranscriptRef.current.trim()` (`:903`) — SYNCHRONICZNIE. `stopRecording` woła `recognition.stop()`+`recorder.stop()` (`:814-817`) — oba async; finalizacja Web Speech tail-a często ląduje PO `recorder.onstop`. Efekt: widoczny tekst (interim) nie trafia do bufora → `browserTranscript` pusty.
2. **[Serwer/env] STT prawdopodobnie niedostępny na prod.** `/voice/stt` → `VoiceService` wymaga `OPENAI_API_KEY` lub `GROQ_API_KEY` (lub llmConfig openai), inaczej rzuca „No STT provider available" → 503/500 (`server/src/services/ai/VoiceService.ts:26-66`, `voice.controller.ts:24-51`). Wtedy `serverText=''` ZAWSZE. Fakt, że retry pokazał „(przeglądarka)" = serwerowy STT na prod NIE działał. Gdy oba puste → throw → catch → `browserTranscript` też pusty → **error toast** (`:962-966`), mimo widocznego tekstu.

**FIX WDROŻONY (część 1, FE) — commit pending na `Londyn`:** dodany `liveInterimRef` (`:264`), mirror interim w `onresult` (`:846`), flush przy Stop `browserTranscript = (liveTranscriptRef + interim)` (`:903`), reset przy starcie (`:826`). Dzięki temu widoczny tekst NIE ginie nawet gdy STT serwerowy padnie (dla przeglądarek z Web Speech: Chrome/Edge).

**POZOSTAJE (część 2, KRYTYCZNA dla „masy ludzi"):** zweryfikować `OPENAI_API_KEY`/`GROQ_API_KEY` na prod (centerbeam) i staging — Web Speech NIE działa w Firefox/części mobile, więc dla wszystkich użytkowników serwerowy STT MUSI działać. To env-check (nie kod) — **wymaga zgody/dostępu właściciela do env Railway**.

**Weryfikacja:** FE-fix type-spójny; **dowód wymaga żywego testu mikrofonem na staging** (preview nie poda mikrofonu) — NIE twierdzę „działa" bez tego. Deploy `Londyn`→prod = **osobna jawna zgoda** (`[[feedback_prod_caution]]`).

**Status:** FE-FIX WDROŻONY (niezweryfikowany live). Część serwerowa (env STT) do potwierdzenia. P0.

---

## UWAGA #13 — Wywiad jako jeden przepływ + bramka oceny AI+człowiek · M10 Wywiad · **SYSTEMOWE / P1-design**

> **PEŁNA ANALIZA + PROPOZYCJA: `Harvard/SPEC_ZADANIE_13_interview_flow_approval.md`** (głęboki inwentarz kodu + rynek). Należy do klastra „flow/następny krok" (#1/#6/#7/#10).

**Żądanie właściciela:** (1) system dopuszczania odpowiedzi — AI ocenia+podpowiada braki, poniżej progu nie wypuszcza usera, po przekroczeniu nadawca dostaje score+rekomendację i Zatwierdza / Wysyła do poprawy; (2) cały moduł jako jeden przepływ template→przydział→wypełnienie→dopuszczenie→insighty→inicjatywy, z pipeline w menu bocznym i przyciskami „następny krok" wewnątrz narzędzi.

**Kluczowa rewelacja:** ~70% maszynerii JUŻ ISTNIEJE, ale doradczo/ukryto: AI-ocena na submit (`ai_review_snapshot_json`: score/verdict/weakAnswerMap/recommendations, `InterviewController.ts:3519-3542`), approve z bramką completeness≥50% (`:3799,:3850`), send-back z checklistą (`:3592`), audyt decyzji, 6-statusowa state machine (`InterviewHub.tsx:637`). **BRAKUJE:** persystencji score, egzekucji progu jakości (gate bypassowalny), score+rekomendacji w powiadomieniu, wizualizacji pipeline w menu, przycisków stage→stage.

**Propozycja (skrót):** bramka dwustopniowa (respondent: twardy block tylko dla obiektywnej niedostateczności+wymagane, reszta = eskalacja — HITL; nadawca: score+rekomendacja+Zatwierdź/Wyślij-do-poprawy, oba istnieją→uwidocznić); menu jako numerowany pipeline z badge'ami; przyciski „następny krok" w narzędziach (approve→„Utwórz wniosek"). Reużyć istniejącą maszynerię — praca = egzekucja+ujawnienie+flow, nie budowa od zera. Rynek: human-in-the-loop, AI doradza/człowiek decyduje.

**Otwarte decyzje (właściciel):** (1) próg twardego blocku (obiektywna niedostateczność vs min. score); (2) „nie wypuszcza" = block submit czy wyjścia; (3) kto zatwierdza (przydzielający vs manager-permission); (4) pipeline zastępuje zakładki czy pasek nad nimi.

**Status:** PROPOZYCJA gotowa. Build nie rozpoczęty.

---

## UWAGA #14 — Domknąć kompletny system inicjatyw (statusy, bramki, kto zatwierdza, preview, menu boczne) · M13 Inicjatywy · **SYSTEMOWE / P1-design**

> Klasa: SYSTEMOWE — inicjatywy to kluczowy etap przepływu; łączy się z klastrem flow/trzeci-panel (#10/#13). Zalogowane w trybie zbierania — analiza/build ODŁOŻONE (nie ruszam teraz).

**Żądanie właściciela:** dokładnie przeanalizować system inicjatyw: skąd wchodzą (entry points), jakie mają statusy, jak statusy przechodzą przez etapy, mechanika zatwierdzania bramek (KTO może zatwierdzić dalej). To wszystko odwzorować w **preview**, w **oznaczeniach statusów**, w **menu bocznym** oraz w **zarządzaniu wewnątrz inicjatywy**. „Było kiedyś opisane — poszukaj, ustabilizuj, odnieś do menu i wnętrza." Zbuduj/dopnij kompletny system.

**Namierzone „było opisane" (SSOT — istnieje bogaty korpus, do ustabilizowania i pogodzenia z kodem):**
- `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md` — **status × rola × CTA** = dokładnie „kto może zatwierdzić dalej".
- `docs/product/INITIATIVE_AUTOMATION_AND_TRANSITIONS.md` — **state machine** przejść statusów.
- `docs/product/INITIATIVE_GOVERNANCE_MODEL.md` — model governance/akceptacji bramek.
- `docs/product/INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` — **skąd inicjatywy wchodzą** (entry points/źródła).
- `docs/product/PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md` — rozwiązywanie ról (sponsor/steering/PMO).
- `docs/initiatives/INITIATIVE_FORMULA.md` — doktryna (`[[project_initiative_formula]]`).
- **Kod bramek:** `server/src/services/stageGateService.ts` (+ `effectiveAccessService`, uprawnienie `MANAGE_STAGE_GATES→initiative.approve` z Fali 6). Statusy z UI: In Review / Promoted / Planning / Approved / Scheduled; NEXT GATE: Promote to Initiatives / Approve for Execution / Schedule for Execution; właściciele bramek: Project Sponsor / Steering Committee / PMO; kolumny V8 (snapshot/WBS/critical-path/dependencies/decisions).

**Zakres realizacji (ODŁOŻONY):** (1) zebrać+ustabilizować SSOT statusów/bramek/entry-points (pogodzić docs ↔ `stageGateService`/kod, bo korpus duży i może być rozjazd — patrz `[[finding_gap_reports_overstate]]`); (2) odwzorować w preview (panel inicjatywy: status, next gate, kto zatwierdza); (3) oznaczenia statusów spójne; (4) menu boczne pokazujące przepływ statusów; (5) zarządzanie statusami wewnątrz inicjatywy (przyciski przejścia bramki z egzekucją „kto może"). HITL/role jak w `INITIATIVE_STATUS_ROLE_CTA_MATRIX`.

**ROZBICIE NA DWA ZADANIA (decyzja właściciela 2026-06-13):**
- **#14a — „Opisanie / stworzenie kompletnej dokumentacji funkcjonalności" (inicjatywy)** — zebrać+ustabilizować SSOT (statusy, bramki, entry-points, kto-zatwierdza), pogodzić docs↔kod (`stageGateService` i in.), opisać kompletny system jako jeden dokument prawdy. To krok PIERWSZY (dokumentacja przed budową).
- **#14b — „Wdrożenie tego planu zarządzania inicjatywami"** — realizacja udokumentowanego planu: preview (status/next-gate/kto-zatwierdza), spójne oznaczenia statusów, menu boczne pokazujące przepływ, zarządzanie statusami wewnątrz inicjatywy z egzekucją uprawnień. Po #14a.

**Status:** ZGŁOSZONE + SSOT namierzony, rozbite na #14a (dokumentacja) → #14b (wdrożenie). Build ODŁOŻONY (tryb zbierania).

---

## UWAGA #15 — 🔝 Nie da się otworzyć inicjatywy (brak osiągalnej akcji „Otwórz" z board-preview) · M13 Inicjatywy · **P1 — TOP**

> Priorytet na górę (właściciel): blokuje cały przepływ inicjatyw, który chcemy domknąć (#14a/#14b).

**Objaw (żywy, screenshot):** Klik karty na Portfolio/Kanban otwiera tylko panel-preview po prawej (Czat / Kopiuj link / Finanse / AI / Analiza finansowa) — **brak działającego „Otwórz"** do pełnego widoku inicjatywy. „W ogóle nie ma jak tego otworzyć."

**Diagnoza (zweryfikowana — ścieżka istnieje, ale nieosiągalna):** pełny widok ISTNIEJE — `src/components/Initiatives/InitiativeFullView.tsx`; generyczny opener „Open full" (kebab canon §9) w `InitiativesHub.tsx:662`; przycisk „Otwórz/Open" w `InitiativePreviewV3.tsx:402`. Ale w board-preview, który widać, ten przycisk się NIE pojawia (panel pokazuje Czat/Kopiuj link/Finanse). Hipoteza: „Otwórz" (`:402`) renderuje się warunkowo / nie w kontekście board-preview, albo kebab „Open full" niedostępny na kartach kanbana. **Dokładny powód = DOM-inspect przy fixie** (czemu `:402` niewidoczny). Należy do klastra „in-context open / trzeci panel" (#10).

**Kierunek naprawy:** udostępnić „Otwórz" z board-preview (i/lub kebab „Open full" na kartach) → `InitiativeFullView`. Szybki, blokuje resztę pracy na inicjatywach.

**Status:** ZDIAGNOZOWANE (kierunek pewny, dokładny warunek do potwierdzenia live). TOP priorytet. Fix nie rozpoczęty (tryb zbierania — ale oznaczone do naprawy najpierw).

---

## UWAGA #16 — Wnętrze inicjatywy: formuła „jak AI ma to uzupełniać" (standard McKinsey) + czytelność · M13 Inicjatywy · **SYSTEMOWE / P1-design**

> Siostrzane do #14a (dokumentacja inicjatyw) — oba stabilizują doktrynę inicjatyw; #16 dotyczy WNĘTRZA (sekcje + rola AI), #14 statusów/bramek/przepływu. Skoordynować przy realizacji.

**Żądanie właściciela:** wnętrze inicjatywy jest dobrze podzielone (sekcje: Zakres / Zadania / Harmonogram / Zależności / Produkty i kamienie / Decyzje / Ryzyko i RAID / Bramy / Sugerowane zmiany / Dziennik zmian / Zespół), ale ma być **maksymalnie czytelne** i — kluczowe — ma być **pełna koncepcja formuły, jak AI ma to uzupełniać i jakie role przejmuje**. „Robiliśmy to, były dyskusje o standardzie McKinsey, po czym to się nie dzieje." Audyt: jak ma być, jak ma działać, w jakim zakresie jeszcze NIE zrobione.

**Namierzone „już robiliśmy" (SSOT standardu — istnieje):**
- `docs/initiatives/INITIATIVE_FORMULA.md` — doktryna inicjatyw (MECE/Kerzner/Kaplan-Norton/McKinsey) — `[[project_initiative_formula]]`.
- `docs/standards/CARD_CONTENT_FORMULA.md` — McKinsey-grade SSOT treści kart Insight & Initiative — `[[project_card_content_formula]]`.
- `docs/initiatives/INITIATIVE_GENERATOR_HANDOFF.md` — handoff generatora.
- **Kod AI-fill:** `server/src/services/initiativeGenerationService.ts` (generacja), `src/components/Initiatives/InitiativeDocumentView.tsx` (wnętrze + per-section AI: „AI sekcja"/„AI Konsultant"), `src/components/Initiatives/sections/*`.

**ROZBICIE NA DWA ZADANIA (właściciel):**
- **#16a — Audyt + uzupełnienie dokumentacji:** porównać standard (INITIATIVE_FORMULA + CARD_CONTENT_FORMULA: jak AI ma uzupełniać każdą sekcję, jakie role) ↔ co realnie robi `initiativeGenerationService`/`InitiativeDocumentView` → opisać gap („co się nie dzieje") + docelową formułę + koncepcję czytelności wnętrza. Skoordynować z #14a.
- **#16b — Wdrożenie:** doprowadzić AI-fill sekcji do standardu + poprawić czytelność wnętrza.

**Status:** ZGŁOSZONE + SSOT namierzony, rozbite na #16a (audyt+doc) → #16b (wdrożenie). Build ODŁOŻONY (tryb zbierania). Uwaga `[[finding_gap_reports_overstate]]`: weryfikować runtime, nie tylko docs.
