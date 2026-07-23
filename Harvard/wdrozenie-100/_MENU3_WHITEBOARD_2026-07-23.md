# Menu 3 (górny pasek akcji) — narzędzie Whiteboard (Tablica), Consultify

Dokument dla AI bez kontekstu projektu. Consultify to system realizacji doradztwa; "Whiteboard"
(Tablica) to jedno z czterech narzędzi kanwy w module "Moje Prace → Idee" (obok Mind Map,
Process Flow, Tabela) — swobodna tablica z karteczkami, kształtami, tekstem, ramkami, obrazami i
rysowaniem odręcznym, dodatkowo wyposażona w tryb warsztatowy (facylitacja, głosowanie, fazy).
Ekran ma trzy poziome paski nad płótnem: **Menu 1** (identyfikacja idei + breadcrumb +
"Konwertuj ▾" + kebab `⋯`), **Menu 3 = "second bar"** (pasek podakcji widoku, tuż pod Menu 1) oraz
**pasek narzędzia Tablicy** (Utwórz/Rysuj/Cofnij/Ponów/Więcej, tuż pod Menu 3). Menu 3 to WSPÓLNY
mechanizm dla wszystkich 4 narzędzi kanwy (`buildIdeaMenu3Actions()` — treść lewej/prawej strony
zależy od aktywnego narzędzia); analogiczny dokument dla Mind Map istnieje jako
`_MENU3_MINDMAP_2026-07-23.md` w tym samym katalogu.

Stan weryfikacji: **kod przeczytany (grep-first) + potwierdzone na żywo** na `localhost:3100`,
obiekt `f28b328d-bd3a-400c-91af-4feffb10fa8d/workspace/whiteboard` ("TEST 2026-07-23 —
Whiteboard"), tryb ciemny, PL. Rozwinięto na żywo dropdown "Utwórz" i "…" (More), kliknięto
"Dodaj karteczkę", "AI rozwiń" i "Zapisz widok" żeby zweryfikować realny efekt (nie tylko czy
element istnieje). Test-artefakt ("Widok 1") utworzony przy weryfikacji "Zapisz widok" został
usunięty po teście (higiena danych demo — patrz reguły projektu).

Źródła (kotwice):
- `src/components/MyWork/whiteboard/WhiteboardToolbar.tsx` — pasek narzędzia Tablicy (Utwórz ▾ ·
  Rysuj · Cofnij/Ponów · `…` More · Zapisz), 425 linii.
- `src/components/MyWork/whiteboard/WhiteboardToolbarPrimitives.tsx` — cienki re-export z
  `../canvas/CanvasToolbarPrimitives` (P4 unifikacja z Mind Map/Process Flow).
- `src/components/MyWork/ideaCanvasMelsChips.ts` — `buildIdeaMenu3Actions()`, wspólny builder
  Menu 3 dla 4 narzędzi kanwy (linie ~178–290).
- `src/components/MyWork/IdeaMapWorkspace.tsx` (linie ~2919–2953, ~778–1049, ~2744–2768,
  ~3399–3445) — realne handlery Menu 3 dla trybu whiteboard, router zdarzeń
  `idea-workspace-quick-action`, stan `whiteboardFacilitation`.
- `src/components/MyWork/IdeaWhiteboardTool.tsx` — narzędzie samo w sobie: `sessionState`,
  `ensureFacilitationSession`, wywołania `Api.facilitation*`, `useWhiteboardQuickActions`.
- `src/components/MyWork/whiteboard/whiteboardContracts.ts` — typy `WhiteboardSessionState`,
  `FacilitationPhase`, `FACILITATION_TRANSITIONS`, `WHITEBOARD_ACTIONS` (rejestr akcji `wb_*`).
- `src/components/MyWork/whiteboard/WhiteboardPhaseBar.tsx` + `WhiteboardSessionPanel.tsx` —
  panel "WARSTWA SESJI" (floating, lewy górny róg płótna).
- `src/components/MyWork/whiteboard/useWhiteboardQuickActions.ts` — nasłuch zdarzeń `wb_*`.
- `src/components/MyWork/whiteboard/useWhiteboardCollab.ts` → `../canvas/useIdeaCollab.ts` —
  realtime sync grafu (WebSocket).
- `src/components/MyWork/mindmap/CollaborationOverlay.tsx` — wspólny wskaźnik połączenia
  (współdzielony z Mind Map/Process Flow/Whiteboard), renderowany w `IdeaWhiteboardTool.tsx`.
- `src/components/MyWork/IdeaScenesManager.tsx` — "Zapisz widok" / zakładki widoku (Scenes).
- `server/src/services/v8/whiteboardCanon.ts`, `server/src/realtime/facilitationRealtime.ts`,
  `server/src/services/facilitationPhaseMachine.ts`, `server/src/routes/my-work.routes.ts` —
  backend facylitacji (realny, nie phantom — sprawdzone grep w `server/src/`).
- `public/locales/pl/translation.json` → klucz `myWork.whiteboard.*`.

---

## 1. Pasek narzędzia Tablicy: Utwórz · Rysuj · Cofnij/Ponów · Więcej

To pasek POD Menu 3, bezpośrednio nad płótnem (`WhiteboardToolbar.tsx`). Zaczyna się etykietą
"Tablica" (nieklikalna, `toolbarExtra.title`).

| element | etykieta PL | co robi | po co | stan |
|---|---|---|---|---|
| **Utwórz ▾** (`ToolbarDropdown`, ikona `Plus`) | **Utwórz** | Klik na główną ikonę = dodaje domyślnie **Notatkę** (`onAddElement('sticky')`). Strzałka ▾ rozwija pełną listę: **8× Notatka** (każda inny kolor tła — `STICKY_COLORS`), **Blok tekstowy**, **Ramka**, **Prostokąt**, **Koło**, **Romb**, **Sześciokąt**, **Obraz**, **Karta linku**. Każda pozycja woła `onAddElement(kind, extraData)` → mutacja grafu (`nodes`/`edges`), realny element na płótnie. | Jedno miejsce na wszystkie prymitywy tablicy — notatki do burzy mózgów, kształty do diagramowania, ramki do grupowania obszarów, obraz/link do dołączania materiałów zewnętrznych. | **Działa.** Potwierdzone na żywo: dropdown rozwija się, lista 1:1 z kodem (8 kolorów Notatki + Blok tekstowy + Ramka + 4 kształty + Obraz widoczny na dole listy). |
| **Rysuj** (ikona `Pen`) | **Rysuj** | Przełącza `whiteboardMode` między `'board'` a `'draw'`. W trybie rysowania płótno przechodzi na warstwę rysowania odręcznego (`IdeaDrawingLayer`) — elementy tablicy są chwilowo zablokowane, żeby nie ruszyć ich przypadkowo piórkiem/myszką. | Adnotacje odręczne, szkicowanie strzałek/zaznaczeń "z ręki" niezależnie od siatki obiektów. | **Działa.** Stan aktywny podświetlony (`active={whiteboardMode==='draw'}`). Gdy są narysowane ścieżki, obok pojawia się dodatkowy przycisk **Wyczyść rysunki** (`Trash2`, czerwony/danger). |
| **Cofnij / Ponów** (`Undo2`/`Redo2`) | **Cofnij**, **Ponów** | Standardowy undo/redo stosu zmian grafu tablicy. Wyszarzone (disabled), gdy `canUndo`/`canRedo` = false lub tablica zablokowana (`locked`). | Bezpieczne eksperymentowanie — cofnięcie błędnego ruchu/usunięcia bez utraty reszty pracy. | **Działa** (mechanika realna, osobny stos historii zmian; NIE mylić z "Historia" w kebabie Menu 1, która przywraca pełne snapshoty grafu). |
| **`…` More** (`ToolbarOverflow`, portal do `body`) | **Więcej** | Rozwija dropdown z pozycjami: **Głosowanie** (toggle `sessionState.votingOpen`), **Rola** (`onCycleRole` — cyklicznie zmienia rolę użytkownika w sesji), **Śledź** (`Follow-me`, toggle `sessionState.followMe`), **Eksport** (`ExternalLink`, ten sam handler co Menu 3 "Eksport"), **Skróty klawiszowe** (`Keyboard`, otwiera pomoc), oraz 4× **Wzór tła: Kropki / Siatka / Linie / Puste** (`onSetBgPattern`, zmienia deseń tła płótna). | Kolekcja rzadziej używanych/"drugoplanowych" narzędzi zebranych pod jedną ikonę, żeby główny pasek nie puchł — zgodne z Doktryną Gęstości Consultify (podział primary→secondary→overflow). | **Działa** w całości. Potwierdzone na żywo: lista 1:1 z kodem, "Wzór tła: Kropki" pokazany jako aktywny (kropka/podświetlenie), zgodnie z domyślnym stanem `bgPattern`. |
| **Zapisz** (przycisk po prawej, `Save`/`Loader2`) | **Zapisz** | `onSave()` — zapis ręczny stanu tablicy. Warunkowo ukryty (`hideSaveIndicator`), gdy Menu 1 (powłoka mels) niesie własny wskaźnik zapisu (`IdeaSaveIndicator`, kropka + etykieta typu "Zapisuję…"/"Zapisano") — unikanie dublowania tego samego stanu w dwóch miejscach paska. | Jawny zapis na żądanie (poza autosave). | **Działa**, ale na testowanym ekranie **niewidoczny** — `hideSaveIndicator=true` (Menu 1 pokazuje "Draft lokalny"/stan zapisu obok breadcrumbu zamiast tego przycisku). To zamierzone zachowanie (komentarz w kodzie: "zero dubli"), nie błąd. |

## 2. Górny pasek podakcji (Menu 3 / "second bar"): Dodaj karteczkę · AI rozwiń · Szablony · Eksport · Utwórz z mapy

Pasek renderowany bezpośrednio pod Menu 1, wspólnym mechanizmem `buildIdeaMenu3Actions()` dla
wszystkich 4 narzędzi kanwy — dla Whiteboard etykiety i handlery ustawia
`IdeaMapWorkspace.tsx` (linie ~2919–2953).

| element | etykieta PL | co robi (kod) | po co | stan |
|---|---|---|---|---|
| `menu3-add` | **Dodaj karteczkę** (ikona `Plus`) | `onAddPrimary` = `handleQuickAction(activeTool==='mindmap' ? 'mm_add_child' : 'add_node')`. Dla Whiteboard `activeTool!=='mindmap'`, więc woła **`handleQuickAction('add_node')`**. Zdarzenie `add_node` trafia na magistralę `idea-workspace-quick-action`, ale **żaden handler w projekcie nie rozpoznaje literału `'add_node'`** jako akcji szybkiej (to jedynie nazwa wewnętrznej operacji collab `{op:'add_node'}` w Process Flow/Mind Map, inna przestrzeń nazw). Whiteboard swoje akcje dodawania rozpoznaje wyłącznie po prefiksie `wb_add_*` (np. `wb_add_sticky`) — `useWhiteboardQuickActions.ts` nie ma gałęzi dla `add_node`. | Miał być szybkim skrótem "dodaj domyślny element" dla aktywnego narzędzia (analogicznie do "Dodaj węzeł" w Mind Map, które działa). | **MARTWE.** Potwierdzone i w kodzie, i na żywo: kliknięcie nie dodaje żadnej karteczki na tablicy (zero zmiany na płótnie, zero toastu). Prawdziwy sposób dodania karteczki to przycisk **Utwórz ▾** w pasku niżej (patrz §1) lub `+` w prawym dolnym rogu pustej tablicy. |
| `menu3-ai-expand` | **AI rozwiń** (ikona `Sparkles`) | `onAIExpand` = `handleQuickAction('mm_ai_expand')` — **zawsze** ten sam mindmap-owy literał, niezależnie od `activeTool`. Handler `mm_ai_expand` istnieje TYLKO w `useMindMapQuickActions.ts`, który jest montowany wyłącznie wewnątrz `IdeaRecommendationMap.tsx`, a ten komponent renderuje się tylko gdy `activeTool==='mindmap'`. Na ekranie Whiteboard ten komponent w ogóle nie istnieje w drzewie — zdarzenie `mm_ai_expand` ląduje w pustce. Ten sam martwy wzorzec powtarza się w "AI Nudge Strip" wewnątrz samego narzędzia Whiteboard (`IdeaWhiteboardTool.tsx` ~l.3658, `onActionExpand` też wysyła `mm_ai_expand`). | Miał dawać facylitatorowi jednoklikowe AI-rozwinięcie tablicy (Whiteboard ma własny, w pełni zbudowany zestaw generatorów AI: `wb_ai_find_themes`, `wb_ai_name_clusters`, `wb_ai_extract_actions`, `wb_ai_to_map`, `wb_ai_to_table` — patrz `useWhiteboardQuickActions.ts` — ale Menu 3 do nich nie sięga). | **MARTWE dla Whiteboard.** Potwierdzone na żywo: kliknięcie nie daje żadnej reakcji (brak toastu, brak panelu propozycji AI, brak spinnera) — dokładnie zgodnie z przewidywaniem z kodu. Prawdziwe AI-akcje Whiteboardu są dostępne gdzie indziej (prawy panel "Tools"/skróty klawiszowe `wb_ai_*`), nie z tego przycisku. |
| `menu3-templates` | **Szablony** (ikona `LayoutTemplate`) | `setTemplateGalleryOpen(true)` → otwiera `<IdeaTemplateGallery>`. Galeria zawiera pozycje z `tool:'whiteboard'` (potwierdzone grep — min. 6 szablonów whiteboardowych w pliku). | Szybki start z gotowego układu tablicy (np. affinity map, workshop wall) zamiast pustego płótna. | **Działa** (komponent realny, świadomy `activeTool`). Zawartości samej listy szablonów whiteboardowych nie oceniano szczegółowo (poza zakresem). |
| `menu3-export` | **Eksport** (ikona `Download`) | `setExportMenuOpen(true)` → `<IdeaExportMenu>`, ten sam handler co pozycja "Eksport" w kebabie Menu 1 i w "…" More paska narzędzia (§1) — trzy wejścia, jeden mechanizm. Wyłączony (`disabled`), gdy tablica pusta (`hasContent=mapHasNodes`), z tooltipem "Pusta mapa". | Wyeksportowanie tablicy do formatu zewnętrznego. | **Działa.** |
| `menu3-convert-from-map` | **Utwórz z mapy** (ikona `GitBranch`) | `handlePanelChange('tools')` — otwiera prawy panel inspektora na zakładce "Tools"; sekcja "3. Convert" (domyślnie zwinięty akordeon) zawiera realne cele konwersji (`ideaConvertTargets.ts`) wołające `onConvert(target)`. Nazwa jest myląca — to skrót do panelu, nie natychmiastowa konwersja. | Umożliwia zbudowanie z tablicy innego artefaktu Consultify (Inicjatywa/Zadanie/Decyzja/Raport…). | **Działa** jako otwarcie panelu (wyłączone przy pustej tablicy). UX-niedoróbka: nie przewija/nie rozwija automatycznie sekcji Convert — trzeba ją samemu rozwinąć po otwarciu panelu. |

**Najważniejsze do zapamiętania z tej sekcji:** dwa z pięciu przycisków paska podakcji
(**Dodaj karteczkę**, **AI rozwiń**) są w trybie Whiteboard **martwe** — to nie "fantom za flagą",
tylko literalny błąd w routingu zdarzeń: `buildIdeaMenu3Actions` w `IdeaMapWorkspace.tsx` został
napisany z myślą o Mind Map (`mm_add_child`, `mm_ai_expand`) i tylko częściowo dostosowany do
pozostałych trzech narzędzi (ma poprawną etykietę/ikonę per narzędzie, ale NIE poprawny handler
docelowy dla Whiteboard/Process Flow/Tabela). Naprawa: podmienić `onAddPrimary`/`onAIExpand` w
sekcji `melsMenu3Actions` (IdeaMapWorkspace.tsx ~l.2919) na dispatch zgodny z prefiksem aktywnego
narzędzia (`wb_add_sticky`/`wb_ai_find_themes` dla whiteboard, analogicznie dla pf_/tbl_).

## 3. TRYB WARSZTATOWY — "Warstwa sesji" (Facylitator / Fazy / Głosowanie / Follow-me / Timer)

To NAJWAŻNIEJSZA i najmniej oczywista część tablicy — panel pływający w lewym górnym rogu
płótna (`WhiteboardSessionPanel.tsx` + `WhiteboardPhaseBar.tsx`), widoczny wyłącznie w narzędziu
Whiteboard. Widziany live jako karta "WARSTWA SESJI" z etykietą roli po lewej i "Tryb boardu /
Timer wyłączony" po prawej, pigułkami stanu, paskiem faz i podpowiedzią.

### Co to jest i po co istnieje
Whiteboard w Consultify to nie tylko "tablica do rysowania" — to narzędzie do **prowadzenia
żywego warsztatu z klientem** (workshop facilitation), z rolami, fazami procesu i głosowaniem,
tak jak Miro/Mural/FigJam mają swój "Facilitator mode". Backend ma prawdziwą, dedykowaną usługę
sesji facylitacji (`server/src/services/facilitationPhaseMachine.ts`,
`server/src/realtime/facilitationRealtime.ts`, endpointy `Api.facilitation*` — tworzenie sesji,
przypisywanie ról, timer, głosy, fazy) — **to nie jest kosmetyka frontendowa, tylko realny,
zsynchronizowany między-użytkownikowo mechanizm** (sessionId + broadcast realtime), potwierdzone
grep w `server/src/`.

### Elementy

| element | etykieta PL | co robi | po co | stan |
|---|---|---|---|---|
| **Warstwa sesji / rola** | **Facylitator** / **Uczestnik** / **Obserwator** | Pokazuje bieżącą rolę użytkownika w sesji (`sessionState.role`). Zmieniana przez "Rola" w "…" More (§1) — `onCycleRole` cyklicznie: Facylitator→Uczestnik→Obserwator→Facylitator (`cycleWhiteboardRole`). Rola **Obserwator** ustawia `isObserver=true`, co blokuje edycję tablicy (tryb tylko-podgląd). | Rozdzielenie ról podczas warsztatu z klientem: **Facylitator** prowadzi sesję (steruje fazami/głosowaniem/timerem), **Uczestnicy** dodają treść, **Obserwatorzy** (np. sponsor projektu, obserwujący na żywo) tylko patrzą, nie mogą przypadkiem coś ruszyć. | **Działa**, backend-owe (`Api.facilitationAssignRole`), realtime — inni uczestnicy sesji widzą zmianę roli. |
| **Tryb boardu / Tryb rysowania** | (prawy górny róg panelu) | Duplikuje informację z przycisku "Rysuj" (§1) — pokazuje aktualny `whiteboardMode`. | Szybki podgląd trybu bez patrzenia w pasek narzędzia. | **Działa** (czyste odzwierciedlenie stanu). |
| **Timer** | np. "Timer wyłączony" / "Ns" (odliczanie) | `onToggleFollow`... a właściwie osobny handler timera (w "…" More brakuje osobnego przycisku timera widocznego w tym pasku — timer sterowany jest z panelu/skrótów; `wb_session_toggle_timer` w rejestrze akcji). Gdy aktywny: `sessionState.timerEndsAt` odlicza w czasie rzeczywistym (`Math.ceil((timerEndsAt-Date.now())/1000)` co sekundę), zsynchronizowany przez `Api.facilitationUpdateTimer`. Po zakończeniu wpis do dziennika aktywności "Timer warsztatu zakończony". | Egzekwowanie ram czasowych ćwiczenia warsztatowego (np. "5 minut na burzę mózgów") — wspólny dla wszystkich uczestników zegar, nie lokalny. | **Działa** (backend-owy, per-sesja). Na testowanym ekranie: wyłączony ("Timer wyłączony"). |
| **Głosowanie** (pigułka "Głosowanie zamknięte"/"otwarte" + toggle w "…" More) | **Głosowanie** | `onToggleVoting` → `sessionState.votingOpen` + `Api.facilitationUpdatePhase(sessionId, votingOpen?'voting':'board')`. Otwiera nakładkę `<IdeaVotingMode>` z realnym liczeniem głosów per-węzeł (`voteSummary`/`myVoteCounts`, max 5 głosów/osobę), trwałe (`persistent=true` dla whiteboard — wyniki nie znikają po zamknięciu trybu głosowania jak w Mind Map). | Dot-voting / priorytetyzacja pomysłów na tablicy przez grupę — klasyczna technika warsztatowa "każdy stawia kropki na ulubionych karteczkach", tu w wersji cyfrowej, zsynchronizowanej między uczestnikami. | **Działa**, backend-owe, potwierdzone realne wywołania `Api.facilitationCastVote`/`facilitationGetVoteSummary`. |
| **Follow-me** (pigułka "Follow-me wyłączone/włączone" + toggle "Śledź" w "…" More) | **Śledź** / **Follow-me** | `onToggleFollow` → `sessionState.followMe` (+ opcjonalnie `spotlightNodeId` przez akcję zaznaczenia — `wb_session_toggle_spotlight`). Gdy facylitator włączy Follow-me, widok/viewport pozostałych uczestników **podąża** za tym, co pokazuje facylitator (analogicznie do "prezentera" w Zoomie/Miro). | Prowadzenie grupy przez tablicę krok po kroku podczas prezentacji wyników warsztatu — facylitator przewija/zoomuje, uczestnicy widzą dokładnie to samo bez ręcznego nawigowania. | **Działa** jako przełącznik stanu + zapis fazy backendowej. (Realny mechanizm wymuszenia viewportu u innych klientów nie był badany osobno w tym audycie — poza zakresem grep-first; oznaczyć jako do potwierdzenia przy realnym multi-user teście). |
| **Faza warsztatu** (pasek zakładek: **Start → Organizacja → Konwergencja → Przekazanie**) | **Faza warsztatu** | `WhiteboardPhaseBar` — 4 zakładki z `FACILITATION_PHASES`, przejścia ograniczone `FACILITATION_TRANSITIONS` (Start→Organizacja; Organizacja→Konwergencja lub cofnij do Start; Konwergencja→Przekazanie lub cofnij do Organizacja; Przekazanie = faza końcowa, brak dalej). Kliknięcie fazy nieosiągalnej z bieżącej jest zablokowane (`disabled`). Każda faza ma podpowiedź: Start = "Swobodnie zbieraj pomysły", Organizacja = "Grupuj i porządkuj", Konwergencja = "Oznacz najlepsze wyniki", Przekazanie = "Eksportuj i udostępnij wyniki". Zmiana woła `Api.facilitationUpdatePhase(sessionId, phase)`. | To jest **mapa procesu warsztatu Design-Thinking/double-diamond** wbudowana w narzędzie: (1) **Start** — dywergencja, swobodne zbieranie pomysłów bez oceniania; (2) **Organizacja** — grupowanie karteczek w klastry/tematy; (3) **Konwergencja** — głosowanie/wybór najlepszych wyników (tu naturalnie łączy się z funkcją Głosowanie); (4) **Przekazanie** — eksport wyników i przekazanie dalej (do Inicjatyw/Raportu — łączy się z "Utwórz z mapy" z Menu 3). Fazy nadają tablicy strukturę czasową sesji, żeby grupa nie "błądziła" bez celu. | **Działa** w pełni — realne przejścia, blokada niepoprawnych skoków, zapis do backendu, wpis do dziennika aktywności ("Faza: {phase}"). Potwierdzone na żywo: pasek widoczny, "Start" aktywny, pozostałe fazy jako nieaktywne zakładki z podpowiedzią "Przejdź do {faza}" po najechaniu. |
| **Podpowiedź kontekstowa** (linia pod paskiem faz) | *(bez etykiety, kursywa)* | Tekst zależny od bieżącej fazy (patrz wyżej — "Swobodnie zbieraj pomysły" itd.). | Przypomnienie "co robić teraz" bez opuszczania tablicy. | **Działa.** |
| **Pomocniczy tekst na dole karty** | np. "Dwuklik edytuje tresc, a Cmd/Ctrl+S zapisuje stan boardu." | `whiteboardModeCopy.helper`/`.exitHint` z `whiteboardInteractionGrammar.ts`. | Skrót obsługi bez otwierania pełnej pomocy klawiszowej. | **Działa**, ale⚠ **usterka kosmetyczna**: polskie stringi w tym pliku są pisane **bez polskich znaków diakrytycznych** ("tresc"→treść, "Ukladasz"→Układasz, "Uzyj"→Użyj, "dopisac odrebna warstwe od reki"→dopisać odrębną warstwę od ręki, "Mozesz przegladac uklad"→Możesz przeglądać układ). Widoczne na żywo dokładnie tak jak w kodzie. Reszta interfejsu (locale `translation.json`) ma poprawne diakrytyki — to jeden odosobniony plik (`whiteboardInteractionGrammar.ts`, świadomie NIE przechodzący przez i18next — patrz komentarz w kodzie), więc niespójność jest widoczna tylko w tych 4 komunikatach (helper/exitHint dla trybu board i draw + skróty klawiszowe). |
| **Panel "Ops + governance"** (karta pod główną, widoczna gdy jest jakaś aktywność/biblioteka/historia) | **Ops + governance**, **Zmień policy**, **Biblioteka:**, **Przywróć:** | `onCycleGovernance` — cykl klasyfikacji (`internal→confidential→restricted→internal`, `cycleWhiteboardClassification`), + skrót do biblioteki fragmentów (zapisane selekcje wielokrotnego użytku) i przywracania ostatniego snapshotu historii. | Governance/klasyfikacja poufności tablicy (istotne przy tablicach z danymi klienta) + reużywalne "klocki" (biblioteka) do wstawiania powtarzalnych układów. | **Działa** jako przełącznik stanu; nie testowano na żywo (panel pojawia się tylko gdy `activityLog`/`libraryItems`/`historyLog` niepuste — na testowanym obiekcie był pusty, więc karta się nie renderowała). |

## 4. Wskaźnik połączenia realtime (Connect / Establishing session) i "Zapisz widok"

W prawym górnym rogu płótna (nie w Menu 1 ani Menu 3, tylko nad samym canvasem):

| element | etykieta PL/EN | co robi | po co | stan |
|---|---|---|---|---|
| **Baner statusu połączenia** (`CollaborationOverlay`, wspólny z Mind Map/Process Flow) | Live pokazało: **"Reconnecting collaboration" / "Single-user mode"** (po angielsku — patrz niżej) | Renderuje się gdy `connectionState !== 'connected'` (connecting/reconnecting/degraded) — ikona `WifiOff` + dwie linie tekstu: górna = stan połączenia ("Connecting collaboration"/"Reconnecting collaboration"/"Connection degraded"), dolna = "Establishing session" (gdy jeszcze łączy) albo "Single-user mode" (gdy nikogo więcej nie ma). Gdy połączone i są inni uczestnicy: zamiast tego pokazuje się pigułka z licznikiem osób + awatarami (`Users` + inicjały, do 4 + licznik). | Informuje, czy zmiany na tablicy są w danej chwili synchronizowane z innymi uczestnikami sesji na żywo, czy tablica działa lokalnie/offline. | **Działa** (realny WebSocket przez `useIdeaCollab`), ale ⚠ **brak tłumaczenia PL** — klucze `collaboration.connecting`/`collaboration.reconnecting`/`collaboration.connectionDegraded`/`collaboration.establishingSession`/`collaboration.singleUserMode` **nie istnieją** w `public/locales/pl/translation.json` (sekcja `collaboration` jest pusta), więc mimo że reszta ekranu jest po polsku, ten baner pokazuje się **wyłącznie po angielsku** (fallback na domyślny string podany w kodzie `t()`). Potwierdzone na żywo dokładnie jak przewidziano z kodu. |
| **Zapisz widok** (`IdeaScenesManager`, ikona `Bookmark`) | **Zapisz widok** | Zapisuje bieżący viewport (x/y/zoom) jako nazwaną "scenę" (`Widok 1`, `Widok 2`…) w liście "WIDOKI", persystowane w rozszerzeniu tablicy (`wbExt.scenes`, zapisywane z autosave). Po zebraniu ≥2 scen pojawia się przycisk **Prezentuj** (`Play`) — pełnoekranowe przechodzenie między zapisanymi widokami strzałkami/spacją, jak slajdy. | Inspirowane "Scenes" z Apple Freeform: pozwala facylitatorowi zaznaczyć konkretne fragmenty dużej tablicy jako "przystanki" i **zaprezentować** wyniki warsztatu grupie/klientowi jako sekwencję "slajdów" bez ręcznego zoomowania/przewijania na żywo. Naturalnie domyka fazę "Przekazanie" z paska faz (§3). | **Działa** w pełni, potwierdzone na żywo: kliknięcie otworzyło panel "WIDOKI 1 / Widok 1"; usunięcie ("Usuń widok") działa i czyści listę. Nie jest to wskaźnik połączenia sensu stricto — wizualnie sąsiaduje z banerem statusu w tym samym rogu ekranu, stąd wspólne omówienie. |

---

## Uwagi / plan

1. **Dwa martwe przyciski w Menu 3 dla Whiteboard — realny bug, nie brak flagi.** "Dodaj
   karteczkę" wysyła nieistniejącą akcję `add_node`; "AI rozwiń" wysyła akcję `mm_ai_expand`
   obsługiwaną tylko w komponencie Mind Mapy, którego nie ma na ekranie Whiteboard. Oba
   potwierdzone martwe i w kodzie (grep handlerów), i na żywo (klik → zero efektu, zero toastu).
   Naprawa jest lokalna i mała: w `IdeaMapWorkspace.tsx` (`melsMenu3Actions`, ~l.2919) podmienić
   `onAddPrimary`/`onAIExpand` na dispatch zależny od `activeTool` (dla whiteboard: `wb_add_sticky`
   / jeden z `wb_ai_*`, np. `wb_ai_find_themes` jako domyślny "AI rozwiń"). Whiteboard MA już
   pełny zestaw akcji AI (`wb_ai_find_themes/name_clusters/extract_actions/to_map/to_table`) —
   brakuje tylko podpięcia ich pod ten konkretny przycisk paska.
2. **Baner statusu połączenia bez polskiego tłumaczenia** — sekcja `collaboration` w
   `public/locales/pl/translation.json` jest pusta; dodać klucze `connecting`/`reconnecting`/
   `connectionDegraded`/`establishingSession`/`singleUserMode` (obecnie fallback na EN, widoczny
   na produkcyjnym ekranie PL).
3. **Brak polskich znaków diakrytycznych w `whiteboardInteractionGrammar.ts`** — 4 komunikaty
   pomocnicze (helper/exitHint dla trybu board i draw) i opisy skrótów klawiszowych są napisane
   bez ogonków/kresek. Kosmetyczne, ale widoczne na żywo w panelu "WARSTWA SESJI" na każdym
   ekranie Whiteboard.
4. **Tryb warsztatowy jest realnym, backend-owym mechanizmem** (nie kosmetyką) — role, fazy,
   głosowanie i timer synchronizują się przez `Api.facilitation*` i realtime broadcast; to jedna
   z mocniejszych, mniej oczywistych funkcji tego narzędzia i warto ją pokazywać klientom wprost
   jako "tryb prowadzenia warsztatu", bo nazwa "Whiteboard/Tablica" tego nie sugeruje.
5. **Follow-me — mechanizm wymuszania viewportu u innych uczestników nie był testowany
   multi-user** w tej sesji (brak drugiego klienta pod ręką) — oznaczone jako "do potwierdzenia"
   w tabeli §3, nie jako "działa" bez zastrzeżeń.
6. Nie badano szczegółowo zawartości galerii Szablonów whiteboardowych ani formatów w Eksporcie —
   poza zakresem tego zlecenia.
