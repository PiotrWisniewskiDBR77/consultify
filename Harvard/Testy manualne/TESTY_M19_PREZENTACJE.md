# TESTY — M19 Prezentacje (Presentation Studio P20 / DeckBuilder)

> **Moduł:** M19 Prezentacje (`/prezentacje`, `/presentations/builder/:deckId`, `/presentations/wizard`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki:** cały pipeline generacji V8 przez PrezentacjeView + wizard, DeckBuilder WYSIWYG (MELS default ON), typy bloków, agent Teresa edit + accept/reject/revert, wersjonowanie (snapshoty serwerowe mig.752), share + analityka, governance + quality-gates, eksporty PPTX/PDF/PNG/HTML, collaborate STUB (no-op), ścieżki cross-module.
> **Cel:** agent piszący i testujący moduł ma na tej podstawie dogłębnie przetestować każdą sekcję — z weryfikacją end-to-end (UI + payload Network + stan DB/store). Każda asercja E2E musi być potwierdzona w zakładce Network — sama zmiana wyglądu interfejsu to NIE dowód.
> **Bazuje na:** `Harvard/wdrozenie-100/M19-prezentacje.md` · `Harvard/modules/M19-prezentacje/KARTA_AUDYTU.md` · `Harvard/podzial/inventory/INV_E_outputs_studia_meeting.md` (PREZENTACJE poz. 1-16)
> **Legenda:** `[MANUAL]` = ręczna weryfikacja; `[FLAG]` = zależne od flagi/capability/roli; `[DB]` = dowód obejmuje wiersz w bazie; `[STUB]` = znany no-op — sprawdź zachowanie, nie oczekuj handlerów.
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

### Mapa komponentów i pliki

| Powierzchnia | Komponent główny | Plik | Stan/store |
|---|---|---|---|
| Home modułu (split-view) | `PrezentacjeView` | `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` | `useConversationStore`, `useKimiArtifactPipeline` |
| Hub biblioteki (lista decków) | `PresentationsHub` | `src/components/Presentations/PresentationsHub.tsx` | `Api.get('/presentations/decks')` |
| Kreator 5-krokowy | `PresentationWizard` | `src/components/Presentations/PresentationWizard.tsx` | lokalne stany kroków |
| DeckBuilder WYSIWYG | `DeckBuilder` | `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` (~1400 l.) | `useDeckState`, `useVersionHistory` |
| MELS adapter (default ON) | `DeckBuilderMelsView` | `src/components/Presentations/DeckBuilder/DeckBuilderMelsView.tsx` | `ExecutiveModuleShell` |
| Bloki kart | `CardRenderer` + `blocks/*` | `src/components/Presentations/DeckBuilder/CardRenderer.tsx`, `blocks/*.tsx` | lokalne |
| Panel agenta Teresy | `AgentActivityPanel` | `src/components/Presentations/DeckBuilder/AgentActivityPanel.tsx` | polling 30s |
| Historia wersji | `VersionHistoryPanel` + `useVersionHistory` | `…/VersionHistoryPanel.tsx`, `useVersionHistory.ts` | fetch `/decks/:id/versions` |
| Quality Gates | `DeckQualityGatesPanel` | `…/DeckQualityGatesPanel.tsx` | fetch `/decks/:id/quality-gates` |
| Governance | `DeckGovernanceCardModal`, `DeckAuditLogModal` | `…/DeckGovernanceCardModal.tsx`, `DeckAuditLogModal.tsx` | fetch governance API |
| Share / Collaborate / Eksport | `ShareModal` | `…/ShareModal.tsx` | fetch `/decks/:id/share`, `Api.post` |
| Share Analytics | `ShareAnalyticsPanel` | `…/ShareAnalyticsPanel.tsx` | fetch `/decks/:id/analytics` |
| Publiczny viewer | `SharedPresentationView` | `src/components/Presentations/SharedPresentationView.tsx` | brak auth |
| Eksport serwis | `presentationExport.ts` | `src/services/presentationExport.ts` | `fetch` + `blob` download |

### Flagi i gating (krytyczne)

| Flaga | Wartość default | OFF oznacza |
|---|---|---|
| `ENABLE_V8_GLOBAL` (env serwera) | **OFF** na staging/prod | Endpoint `/api/artifact-runs` → **404 `V8_DISABLED`**. Tylko pipeline generacji (`PrezentacjeView` + `PresentationWizard`). Reszta modułu nie jest za tą flagą — działa zawsze. |
| `melsDeckBuilder` (`?ff_melsDeckBuilder=`) | **ON** (default) | OFF = legacy 3-panelowy DeckBuilder (dostępny przez `?ff_melsDeckBuilder=0`). MELS = ExecutiveModuleShell z chip-bar + right-rail. |
| `MODULE_PREZENTACJE_GEN` (betaAccess) | **`'open'`** | Badge `beta` w sidebarze; dostępne dla wszystkich zalogowanych (nie-blokowane). |

### Zasada weryfikacji E2E (obowiązkowa)

Każda akcja wymagająca persystencji (autosave, wersja, share, eksport, agent-edit accept) MUSI być potwierdzona w trzech warstwach:
1. **UI** — widoczna zmiana stanu bez błędów w konsoli.
2. **Network** — odpowiedni endpoint z kodem 200/201/204 (lista endpointów per sekcja poniżej).
3. **Persistencja** — odśwież stronę (F5) i sprawdź, że stan przetrwał; dla [DB] sprawdź wiersz w tabeli.

### Dane testowe

- **Deck testowy 1:** temat „AI w logistyce", 8 slajdów, styl Corporate, język PL.
- **Deck testowy 2:** temat „Quarterly Business Review", 6 slajdów, styl Executive, język EN.
- Konto testowe: OWNER DBR77 (dostęp do wszystkich funkcji, override quality-gate).
- Konto testowe 2: zwykły MEMBER (brak override quality-gate — krytyczne dla §7).

---

## Setup środowiska testowego

1. Uruchom dev server: frontend `:3000`, backend `:3001`.
2. Zaloguj się jako **OWNER DBR77** (pełne uprawnienia).
3. Otwórz DevTools → zakładka **Network** z filtrami: `/api/presentations`, `/api/artifact-runs`.
4. Otwórz zakładkę **Console** — zero błędów JS to wymóg bezwzględny (wyjątek: `net::ERR_ABORTED` na anulowanych żądaniach).
5. Sprawdź, że `ENABLE_V8_GLOBAL` jest włączone w `.env.local` (potrzebne do §1). Bez tej flagi testy §1 i §1.6 testują ścieżkę OFF.
6. Przejdź na `/prezentacje` — moduł powinien się załadować bez ekranu blokady beta.

---

## §1 — Generacja decku — pipeline V8 [FLAG: ENABLE_V8_GLOBAL]

### 1.1 Home modułu `/prezentacje` — stan wejściowy

- Wejście na `/prezentacje` → strona PrezentacjeView ładuje się (nie biały ekran, nie 500).
- Lewy panel = czat z Teresą (pole wpisywania, placeholder PL lub EN wg języka konta).
- Prawy panel = podgląd artefaktu (pusty / stan „Zacznij pisać…" gdy brak aktywnego decku) lub lista ostatnich decków z M17 Outputs (`?artifactId=` z biblioteki).
- **Asercja:** brak żądania do `/api/artifact-runs` przy wejściu na stronę bez wiadomości.

### 1.2 Wysłanie pierwszej wiadomości — auto-trigger pipeline [FLAG]

- Wpisz: „Stwórz deck na temat AI w logistyce — 8 slajdów, styl Corporate, po polsku".
- Wyślij (Enter lub przycisk Wyślij).
- **Oczekiwane:** pipeline V8 uruchamia się automatycznie.
  - Krok 1: `POST /api/artifact-runs` z payloadem zawierającym `lane: 'presentation'` (lub odpowiednikiem) → 201.
  - Krok 2: preflight — `POST /api/artifact-runs/:runId/preflight` → 200.
  - Krok 3: accept — `POST /api/artifact-runs/:runId/accept` → 200.
  - Krok 4: materialize — `POST /api/artifact-runs/:runId/materialize` → 200/201.
- **Wskaźnik postępu:** prawy panel pokazuje kroki pipeline z etykietami (Validate preflight checks, Accept plan…, Materialize artifact) z animacją.
- **Po zakończeniu:** w prawym panelu pojawia się podgląd slajdów (lista kart z tytułami i bullet points).
- **E2E:** w Network widoczna sekwencja 4 żądań z kodami 2xx. Sprawdź payload kroku 1 — powinien zawierać treść wiadomości użytkownika.

### 1.3 Podgląd wygenerowanego decku

- W prawym panelu lista slajdów z tytułami i max. 4 bullet points na slajd.
- Badge cyklu życia (status decku: `draft`, `review`, `approved`) widoczny nad podglądem.
- Klik „Otwórz w DeckBuilderze" (lub analogiczny CTA) → nawigacja do `/presentations/builder/:deckId`.
- **Asercja:** `deckId` w URL odpowiada `id` zwróconemu przez pipeline.

### 1.4 Kreator 5-krokowy `/presentations/wizard` — przepływ alternatywny

- Wejście na `/presentations/wizard` (lub klik „Nowy deck" → Wizard z PresentationsHub).
- Kroki: **Sources** → **Setup** → **Outline** → **Generate** → **Result**.
- **Sources:** wybierz 1 źródłowy artefakt (np. z biblioteki) lub przejdź bez źródła.
- **Setup:** wypełnij tytuł, styl, liczbę slajdów (min 3, max 20), język (PL/EN), wybierz motyw.
- **Outline:** edytuj zaproponowany konspekt (dodaj/usuń/przesuń punkt).
  - `POST /presentations/generate/outline` z payloadem ustawień → 200 + lista punktów konspektu.
- **Generate:** klik „Generuj" → `POST /presentations/generate/deck` z payloadem konspektu → 201 + `deckId`.
  - Wskaźnik generacji widoczny (spinner lub progress).
- **Result:** wynik z liczbą slajdów i ostrzeżeniami (jeśli są). Przycisk „Otwórz w DeckBuilderze" → `/presentations/builder/:deckId`.
- **E2E:** weryfikuj 2 endpointy (outline + deck) w Network.

### 1.5 Regeneracja / nowy styl

- W `PrezentacjeView` po wygenerowanym decku wpisz: „Zmień styl na minimalistyczny, 6 slajdów".
- **Oczekiwane:** nowe żądanie pipeline (nowy `runId`), nowy deck w podglądzie.
- Poprzedni deck NIE jest nadpisany — nowy `deckId` w URL/bibliotece.
- **Asercja:** `GET /presentations/decks` pokazuje oba decki po regeneracji.

### 1.6 ENABLE_V8_GLOBAL OFF — graceful degradation [FLAG]

- Wyłącz flagę (lub przeprowadź test na środowisku bez `ENABLE_V8_GLOBAL=true`).
- Wyślij wiadomość w `PrezentacjeView`.
- **Oczekiwane:** brak crasha; użytkownik widzi komunikat o niedostępności generacji (toast lub inline message); brak białego ekranu.
- Weryfikuj: `POST /api/artifact-runs` → **404** `V8_DISABLED`; UI obsługuje ten błąd.
- **Asercja:** PresentationsHub (`/presentations/wizard`) nadal ładuje się bez błędu — reszta modułu nie jest za flagą.

### 1.7 Auto-trigger z `?templatePrompt=` i `?templateArtifactId=`

- Wejdź na `/prezentacje?templatePrompt=Strategia+wzrostu` → pole czatu jest pre-wypełnione tekstem.
- Wejdź na `/prezentacje?templateArtifactId=<existingId>` → pipeline startuje z kontekstem szablonu.
- **Asercja:** brak błędu 400/500 przy walidacji parametrów; pipeline (jeśli V8 ON) uruchamia się z dodatkowym kontekstem.

---

## §2 — DeckBuilder WYSIWYG (MELS default ON)

### 2.1 Wejście do DeckBuildera

- Otwórz deck przez `/presentations/builder/:deckId`.
- **MELS ON (default):** `ExecutiveModuleShell` ładuje się z chip-bar na górze i right-rail po prawej.
- Sprawdź: brak `?ff_melsDeckBuilder=0` w URL → shell = MELS.
- **Asercja:** lewy panel = `SlideSorter`, środek = `CardCanvas`/`CardRenderer`, prawy = panele MELS (right-rail).
- Brak błędów konsoli, brak 500 na `GET /api/presentations/decks/:deckId`.

### 2.2 MELS chip-bar — nawigacja po narzędziach

- Chip-bar na górze zawiera narzędzia DeckBuildera: np. History, Share, Quality, Governance, Audit Log, Theme.
- Klik każdego chipa → otwiera odpowiedni panel/modal w right-rail lub jako overlay.
- **Asercja:** otwieranie paneli nie powoduje błędu konsoli; panel renderuje się w obrębie shellu.

### 2.3 MELS OFF — legacy 3-panelowy tryb [FLAG]

- Otwórz `/presentations/builder/:deckId?ff_melsDeckBuilder=0`.
- **Oczekiwane:** legacy 3-panelowy layout (bez ExecutiveModuleShell).
- Weryfikuj: animacje, SlideSorter, CardCanvas nadal działają w tym trybie.
- **Asercja:** brak regresi funkcjonalności przy MELS OFF.

### 2.4 Edycja tekstu w slajdzie (TipTap)

- Klik na blok tekstowy w aktywnym slajdzie → pojawia się TipTap editor z toolbar (bold, italic, link, listy).
- Wpisz/zmień treść.
- Klik poza edytor → zmiana zapisana lokalnie (stan `deck` zaktualizowany w `useDeckState`).
- **Asercja autosave:** po ~1,5s od zakończenia edycji (timeout autosave) → `PUT /api/presentations/decks/:deckId/autosave` z payloadem `deck_json` → 200/204.
  - Sprawdź Network: payload zawiera zaktualizowaną treść bloku.
  - Odśwież stronę → tekst przetrwał. [DB]

### 2.5 Undo/Redo

- Dokonaj zmiany tekstu → kliknij Undo (ikona lub Ctrl+Z).
- **Oczekiwane:** zmiana cofnięta w UI; `canUndo` = false po dojściu do poczàtku stosu.
- Redo (Ctrl+Shift+Z lub ikona) → zmiana przywrócona.
- **Asercja:** undo/redo operuje na lokalnym stosie `useDeckState` — NIE wywołuje żądania sieciowego; autosave jednak wykona się po ~1,5s (sprawdź Network, tylko 1 żądanie na koniec).

### 2.6 Dodawanie slajdu [MANUAL]

- Klik „+" (dodaj slajd) w `SlideSorter` lub przez Command Palette (`Ctrl+K` → „New slide").
- **Oczekiwane:** nowy pusty slajd pojawia się na końcu listy (lub w wybranej pozycji), staje się aktywny.
- Sprawdź: tytuł domyślny (np. „Nowy slajd" lub „Slide N").
- **Asercja autosave:** po dodaniu slajdu → autosave się wykona (Network: `PUT .../autosave`).

### 2.7 Usunięcie slajdu [MANUAL]

- Zaznacz slajd w `SlideSorter` → klik „Usuń" (trash icon lub right-click menu).
- **Oczekiwane:** slajd znika z listy; aktywny slajd zmienia się na sąsiedni.
- **Edge:** próba usunięcia jedynego slajdu → UI powinno zablokować akcję lub wyświetlić komunikat.
- **Asercja autosave:** po usunięciu → autosave z nową listą kart.

### 2.8 Przeciąganie (zmiana kolejności slajdów) [MANUAL]

- W `SlideSorter` przeciągnij slajd nr 3 na pozycję nr 1.
- **Oczekiwane:** lista slajdów aktualizuje się natychmiast; `reorderCards` wywoływane.
- **Asercja:** autosave z nową kolejnością kart `deck_json`.

### 2.9 Zmiana layoutu slajdu

- W `CardCanvas` dla aktywnego slajdu → ikona layoutu (lub prawy-klik) → menu wyboru layoutu.
- Wybierz inny `layoutId` (np. `two-column`, `title-only`, `hero`).
- **Oczekiwane:** karta rerenderuje się z nowym układem bloków.
- **Asercja:** `onChangeLayout(cardIndex, layoutId)` wywoływane; autosave z `layout_id` w karcie.

### 2.10 Command Palette

- Otwórz przez `Ctrl+K` lub ikona w TopBar.
- Wpisz „Add slide" / „Dodaj slajd" → akcja wykonuje się.
- Wpisz „Theme" → otwiera ThemeSwitcher.
- **Asercja:** brak błędu konsoli przy otwieraniu i zamykaniu palety (Escape).

### 2.11 Present Mode [MANUAL]

- Klik „Prezentuj" (PresentMode) w TopBar.
- **Tryb fullscreen:** prezentacja w pełnym ekranie, nawigacja strzałkami.
- **Tryb presenter:** podgląd z notatkami prezentującego po prawej.
- Wyjście (Escape lub X) → powrót do DeckBuildera.
- **Asercja:** brak żądań sieciowych w trakcie pokazu (dane z lokalnego stanu), brak błędów konsoli.

---

## §3 — Slajdy — typy bloków i edycja

### 3.1 Zidentyfikowane typy bloków (z `CardRenderer.tsx` + `blocks/`)

DeckBuilder zawiera następujące typy bloków (importowane explicite w `CardRenderer`):

| Typ bloku | Komponent | Plik |
|---|---|---|
| Heading (tytuł) | `HeadingBlock` | `blocks/HeadingBlock.tsx` |
| Paragraph (tekst) | `ParagraphBlock` | `blocks/ParagraphBlock.tsx` |
| Bullet list | `BulletListBlock` | `blocks/BulletListBlock.tsx` |
| Image | `ImageBlock` | `blocks/ImageBlock.tsx` |
| Chart | `ChartBlock` | `blocks/ChartBlock.tsx` |
| Table | `TableBlock` | `blocks/TableBlock.tsx` |
| KPI widget | `KpiWidgetBlock` | `blocks/KpiWidgetBlock.tsx` |
| Metric strip | `MetricStripBlock` | `blocks/MetricStripBlock.tsx` |
| Callout | `CalloutBlock` | `blocks/CalloutBlock.tsx` |
| Divider | `DividerBlock` | `blocks/DividerBlock.tsx` |
| Timeline | `TimelineBlock` | `blocks/TimelineBlock.tsx` |
| Smart Diagram | `SmartDiagramBlock` | `blocks/SmartDiagramBlock.tsx` |
| Smart Layout | `SmartLayoutBlock` | `blocks/SmartLayoutBlock.tsx` |
| Artifact Embed | `ArtifactEmbedBlock` | `blocks/ArtifactEmbedBlock.tsx` |

### 3.2 Test Heading + Paragraph

- Klik na blok `HeadingBlock` → edytor aktywny; zmień tekst nagłówka; Tab/klik dalej → zapis.
- Klik na `ParagraphBlock` → TipTap aktywny; wpisz tekst wieloakapitowy; użyj toolbar (bold, italic, link).
- **Asercja:** zmiana odzwierciedlona w `CardRenderer` natychmiast; autosave po ~1,5s.

### 3.3 Test BulletListBlock

- Aktywny slajd z `BulletListBlock` → klik na punkt → edycja inline (Enter = nowy punkt, Backspace na pustym = usuń).
- Dodaj min. 4 punkty, usuń jeden.
- **Asercja:** lista aktualizuje się w UI; autosave z nową listą items.

### 3.4 Test ImageBlock [MANUAL]

- Klik na `ImageBlock` → pojawia się kontrolka do wgrania/zmiany obrazu lub URL.
- Wgraj obraz PNG/JPG (MediaLibraryBrowser lub bezpośredni upload).
- **Oczekiwane:** obraz renderuje się w karcie; autosave z URL/ref obrazu.
- **Edge:** wgraj plik >10 MB lub błędny format → komunikat błędu (toast), brak crasha.

### 3.5 Test ChartBlock

- Slajd z `ChartBlock` → edycja danych wykresu (jeśli dostępna inline) lub weryfikacja, że wykres renderuje się bez błędów.
- **Asercja:** brak błędów konsoli przy renderowaniu ChartBlock; dane wykresu zapisane w `deck_json`.

### 3.6 Test KpiWidgetBlock i MetricStripBlock

- Otwórz slajd z KPI widget → sprawdź, że metryki (etykieta, wartość, trend) renderują się.
- Edytuj wartość KPI (jeśli dostępna edycja inline) → autosave.
- **Asercja:** brak białego bloku przy renderowaniu KPI.

### 3.7 Notatki prezentującego (speaker notes)

- W DeckBuilderze klik ikonę „Notatki" (eye/notes toggle) lub `showNotes` button w TopBar.
- **Oczekiwane:** pod `CardCanvas` pojawia się pole notatek; `showNotes = true`.
- Wpisz notatki dla aktywnego slajdu.
- Przełącz na inny slajd → notatki znikają (dla poprzedniego) i pojawiają się notatki nowego slajdu.
- **Asercja:** notatki zapisane w `card.speaker_notes`; autosave z `speaker_notes` w payloadzie.

### 3.8 BlockToolbar — akcje na bloku

- Hover nad blokiem → `BlockToolbar` pojawia się (move up/down, duplicate, delete).
- Klik „Usuń blok" → blok usunięty z karty; autosave.
- **Edge:** usunięcie ostatniego bloku z karty → karta pusta (sprawdź pusty stan `card.blocks.length === 0` renderuje placeholder, nie biały ekran).

---

## §4 — Teresa Agent — interakcja AI

> **Kontekst:** agent Teresa w DeckBuilderze to edycja przez czat Teresy w `UnifiedChatPanel`. Deck Builder rejestruje propozycje edycji w `presentation_ai_operations` (mig.641). Flow: wyślij żądanie do Teresy → system wywoła `POST /api/presentations/decks/:deckId/agent-edit` → propozycja wraca jako `pendingAgentEdit` banner → Accept / Reject.

### 4.1 Wysłanie żądania edycji do Teresy

- Z poziomu DeckBuildera (panel agenta lub czat Teresy) wpisz: „Popraw tytuł slajdu 1 — uczyń go bardziej analitycznym".
- **E2E:** `POST /api/presentations/decks/:deckId/agent-edit` z payloadem `instruction` → 200.
  - Sprawdź payload: zawiera `deckId`, `instruction`, opcjonalnie `targetCardIndex`.
  - Odpowiedź: `{ operationId, deck, reply, actions, diff }`.
- **Po odpowiedzi:** banner `pendingAgentEdit` pojawia się nad/pod slajdem z treścią `reply` i listą `actions`.

### 4.2 Accept propozycji agenta

- Klik „Akceptuj" (Accept) w bannerze `pendingAgentEdit`.
- **E2E:** `POST /api/presentations/decks/:deckId/agent-edit/:operationId/accept` → 200/204.
- **Oczekiwane:** deck zaktualizowany propozycją agenta; banner znika; autosave wywołany.
- **Asercja:** odśwież stronę → zmiany przetrwały. [DB — wiersz `status='applied'` w `presentation_ai_operations`]

### 4.3 Reject propozycji agenta

- Poproś o inną edycję → klik „Odrzuć" (Reject).
- **E2E:** `POST /api/presentations/decks/:deckId/agent-edit/:operationId/reject` → 200/204.
- **Oczekiwane:** deck NIE jest zmieniany; stan wraca do poprzedniego; banner znika.
- **Asercja:** odśwież → deck bez zmian z propozycji. [DB — `status='rejected'`]

### 4.4 Historia operacji agenta — AgentActivityPanel

- W `AgentActivityPanel` (right-rail lub lewy panel) sprawdź listę ostatnich 10 zdarzeń.
- Zdarzenia z statusem `proposal` (żółty dot), `applied` (zielony), `rejected` (czerwony).
- **E2E:** `GET /api/presentations/decks/:deckId/agent-history` → 200 + lista operacji.
- **Asercja:** panel polling 30s (sprawdź w Network regularne `GET …/agent-history` co ~30s przy otwartym DeckBuilderze).
- **Degraded state:** jeśli backend nieosiągalny → panel pokazuje komunikat „Activity feed degraded" + reason; brak crasha.

### 4.5 Revert operacji agenta

- W historii agenta (jeśli dostępna kontrolka „Cofnij") lub przez bulk-revert.
- **E2E:** `POST /api/presentations/decks/:deckId/agent-edit/:operationId/revert` → 200.
- **Asercja:** deck wraca do stanu sprzed operacji; odśwież → stan przetrwał. [DB]

### 4.6 Payload E2E — agent-edit

Sprawdź w Network dla żądania `POST .../agent-edit`:
- Body zawiera: `instruction` (string), `cardIndex` (opcjonalny), ewentualnie `targetCardId`.
- Response zawiera: `deck` (zaktualizowany), `reply` (string dla banneraa), `actions` (tablica stringów), `diff` (opcjonalny obiekt `cardsAdded/Removed/changedCards`), `operationId`.
- **Asercja:** `diff` w bannerze wyświetla liczbę zmian (np. „+1/-0, zmienione 2").

---

## §5 — Wersje (snapshoty serwerowe mig.752)

> **Kontekst:** `useVersionHistory` rozróżnia snapshoty lokalne (efemeryczne, `persisted:false`) od serwerowych (`persisted:true` — wiersz w `presentation_deck_versions`). Każdy autosave tworzy trwały wiersz serwerowy. Lokalne checkpointy istnieją tylko w bieżącej sesji.

### 5.1 Automatyczny snapshot przy autosave [DB]

- Dokonaj edycji tekstu → poczekaj na autosave (`PUT .../autosave` → 200).
- Otwórz `VersionHistoryPanel` (klik chip „History" w MELS lub ikona zegarze w TopBar).
- **Oczekiwane:** lista wersji zawiera nową pozycję z typem `auto`, timestamp i opisem.
- **E2E:** `GET /api/presentations/decks/:deckId/versions` → 200 + tablica wersji.
- **Asercja trwałości [DB]:** odśwież przeglądarkę → wersja nadal widoczna w panelu (nie zniknęła po odświeżeniu — to kluczowy dowód persystencji serwerowej vs. in-memory M18).

### 5.2 Ręczny checkpoint (manual save)

- W `VersionHistoryPanel` wpisz etykietę (np. „Przed spotkaniem z klientem") → klik „Zapisz checkpoint".
- **Oczekiwane:** `saveManualCheckpoint(label)` wywołane; `PUT .../autosave` z dodatkową etykietą; nowy wpis w historii z typem `checkpoint`.
- **Asercja:** odśwież → checkpoint widoczny z etykietą. [DB]
- **Edge:** pusty label → przycisk „Zapisz" disabled; brak żądania sieciowego.

### 5.3 Restore wersji — dwukrokowe potwierdzenie

- W panelu historii klik „Przywróć" przy starszej wersji → pojawia się potwierdzenie (confirm button, 3s timeout).
- Kliknij ponownie „Przywróć" (lub poczekaj na timeout — confirm resetuje) → `restoreVersion(versionId)`.
- **E2E:** `POST /api/presentations/decks/:deckId/versions/:versionId/restore` → 200 + przywrócony `deck`.
- **Oczekiwane:** DeckBuilder ładuje przywróconą wersję; `SlideSorter` i `CardCanvas` aktualizują się.
- **Asercja:** odśwież → deck w stanie przywróconej wersji. [DB]

### 5.4 Wskaźnik niezapisanych zmian

- Dokonaj edycji BEZ czekania na autosave → `VersionHistoryPanel` pokazuje pulsujący żółty dot „Unsaved changes".
- Poczekaj na autosave → zmienia się na zielony „All changes saved" + czas `lastSavedAt`.
- **Asercja:** indykator reaktywny; brak błędów konsoli.

### 5.5 Cold-start trwałość [DB] — krytyczny test persystencji

1. Otwórz DeckBuilder → edytuj deck → poczekaj na autosave.
2. Zamknij przeglądarkę (lub zatrzymaj dev server i uruchom ponownie).
3. Otwórz `/presentations/builder/:deckId` od nowa.
4. **Oczekiwane:** deck w stanie po ostatnim autosave (NIE pusty, NIE wersja sprzed edycji).
5. **Asercja [DB]:** wiersz w `presentation_deck_versions` istnieje; `GET .../versions` zwraca wersje sprzed restartu.
6. Ten test odróżnia M19 (persistencja realna) od M18 (in-memory — zepsute przy restarcie).

---

## §6 — Share i Analytics

### 6.1 Generowanie linku share

- W DeckBuilderze klik „Share" (ikona/chip) → otwiera `ShareModal`, zakładka `share` (domyślna).
- Toggle „Public link" OFF → ON → klik lub `handleTogglePublicLink`.
- **E2E:** `POST /api/presentations/decks/:deckId/share` z `{ expiresInDays: 7 }` → 200 + `{ shareToken }`.
- **Oczekiwane:** pole URL pojawia się z linkiem `https://{origin}/presentations/shared/{shareToken}`.
- Klik „Kopiuj" → link w schowku; ikona zmienia się na `Check` na 2s.
- **Asercja:** link skopiowany poprawnie (nawet jeśli clipboard API wymaga secure context).

### 6.2 Publiczny viewer bez auth [MANUAL]

- Skopiuj link share i otwórz w oknie incognito (bez zalogowania) lub nowej przeglądarce.
- **Route:** `/presentations/shared/:shareToken` → `SharedPresentationView`.
- **Oczekiwane:** deck wyświetla się w trybie read-only; brak pola edycji; brak paneli DeckBuildera.
- **Asercja bezpieczeństwa (post-fix `1b67579d7a`):** sprawdź odpowiedź `GET /api/presentations/shared/:shareToken` w Network.
  - Response NIE powinien zawierać pól: `organization_id`, `confidentiality`, `share_token`, `created_by`.
  - Whitelist pól: tylko tytuł, slajdy, metadata publiczne.
- **Asercja:** brak błędów 401/403/500; widok renderuje się poprawnie.

### 6.3 Wygaśnięcie linku i revoke [FLAG]

> **Uwaga:** revoke (unshare) jest opisany jako brak w v1 (`L-03` otwarta). Sprawdź, czy przycisk revoke istnieje w UI — jeśli tak, przetestuj; jeśli nie, odnotuj jako znany brak.

- Sprawdź UI `ShareModal` → czy jest opcja „Revoke" / „Unshare" / „Usuń link".
- Jeśli przycisk istnieje: klik → `DELETE /api/presentations/decks/:deckId/share` → 200; link staje się martwy (viewer zwraca 404/410).
- Jeśli przycisku brak: odnotuj `[STUB/BRAK]` — nie failuj testu, tylko zaraportuj.

### 6.4 Kod do osadzenia (Embed)

- W `ShareModal` przejdź do zakładki `embed`.
- **Oczekiwane:** pole z kodem `<iframe src="…/presentations/embed/:shareToken"…>` — tylko gdy `shareToken` wygenerowany.
- Klik „Kopiuj" → kod w schowku.
- **Asercja:** iframe URL ma prawidłowy token; brak XSS w kodzie embed (brak `<script>` w iframe src).

### 6.5 ShareAnalyticsPanel

- W DeckBuilderze klik „Analytics" (chip w MELS lub przycisk) → otwiera `ShareAnalyticsPanel`.
- **E2E:** `GET /api/presentations/decks/:deckId/analytics` → 200 + `{ summary: { unique_viewers, total_views }, perCard, dailyViews }`.
- **Oczekiwane:** panel pokazuje: unikalni widzowie, łączne wyświetlenia, wykres dzienny (jeśli dostępny), per-slajd engagement (karta `card_index`, `views`, `avg_duration_ms`).
- **Pusty stan (brak danych):** panel pokazuje „Brak danych / No analytics yet" bez crasha.
- **Asercja:** `totalCards` prop przekazany poprawnie (sprawdź czy `perCard` nie generuje błędów dla `card_index > totalCards`).

### 6.6 Analytics beacon — publiczny viewer wysyła zdarzenie

- Otwórz link publiczny w incognito → `POST /api/presentations/decks/:deckId/analytics/view` → 200/204.
- Wróć do `ShareAnalyticsPanel` jako zalogowany → odśwież → `total_views` wzrósł o 1.
- **Asercja bezpieczeństwa:** beacon endpoint (`presentations.routes.ts:5923`) akceptuje write telemetrii bez ujawniania treści; cross-org beacon NIE zwraca danych decku.

---

## §7 — Governance i Quality-gates

### 7.1 Quality Gates Panel — struktura raportu

- W DeckBuilderze klik „Quality" (chip/ikona w MELS) → otwiera `DeckQualityGatesPanel`.
- **E2E:** `GET /api/presentations/decks/:deckId/quality-gates` → 200 + `DeckQualityReport`.
- Raport zawiera: `canExport` (bool), `canShare` (bool), `gates` (lista `DeckQualityGateResult`), `score` (0-100), `result` (PASS/PASS_WITH_P2/BLOCKED_P1/INCONCLUSIVE).
- **Oczekiwane UI:** lista bramek pogrupowana po kategorii (structure/content/brand/traceability/quality) z ikonami severity (error=czerwony, warning=żółty, info=niebieski) + badge priorytetu (P0/P1/P2).
- Klik na bramkę z `cardIndex` → `onJumpToCard(cardIndex)` → deck skacze do wskazanego slajdu.

### 7.2 canExport = false — eksport zablokowany

- Użyj decku z niekompletną zawartością (brak tytułu na slajdzie 1, lub pusty slajd).
- Sprawdź Quality Gates → `canExport = false`, `result = BLOCKED_P1`.
- Spróbuj wyeksportować (klik „Eksportuj" / „Download") → `exportPresentationDeck` wywoływane.
- **E2E:** `GET /api/presentations/decks/:deckId/download` → **422** z payloadem `{ code: 'QUALITY_GATE_BLOCKED', result, gates }`.
- **Oczekiwane UI:** `PresentationExportError` złapany → toast z komunikatem „Export failed" / opis bramki blokującej.
- **Asercja:** brak pliku do pobrania; brak crash białego ekranu.

### 7.3 Override quality-gate — tylko ADMIN/OWNER [FLAG]

> **Kontekst:** kod serwera `presentations.routes.ts:1465,1607,1925,5779` — `allowOverride` jest aktywny TYLKO gdy `req.user?.role` należy do `['ADMIN','OWNER','SUPERADMIN']`. Finding L-02 = STALE (już role-gated). Ten test jest **testem regresji** — sprawdza, że nie-admin NIE omija bramki.

- **Test A — konto OWNER (powinien omijać):** eksportuj deck z `canExport=false` dodając parametr `?overrideQualityGate=true` (przez `exportPresentationDeck({ overrideQualityGate: true })`).
  - **Oczekiwane:** eksport przechodzi (200 + plik) mimo bramki.
- **Test B — konto MEMBER (NIE powinien omijać):** zaloguj się jako zwykły MEMBER; spróbuj eksportować z `overrideQualityGate=true`.
  - **Oczekiwane:** serwer zwraca **422** (nie 200); plik NIE pobiera się.
  - **Asercja regresji:** `enforceQualityGateForExport:366` honoruje `allowOverride` tylko gdy rola pasuje.
- **Ten test MUSI być potwierdzony w Network** — sam UI nie wystarczy.

### 7.4 Governance Card Modal

- W DeckBuilderze klik „Governance" (chip/modal) → otwiera `DeckGovernanceCardModal`.
- **E2E:** `GET /api/presentations/decks/:deckId/governance-card` → 200 + `PresentationGovernanceCard`.
- **Oczekiwane:** karta governance pokazuje: `overallVerdict` (PASS/PASS_WITH_P2/BLOCKED_P1/BLOCKED_P0/INCONCLUSIVE) z kolorem i etykietą, sekcje (source, confidentiality, integrity, traceability), timestamp.
- Potwierdzenie (Approve) przez przycisk w modalu → `governanceVerdict` w DeckBuilderze aktualizuje się.
- **Asercja:** po approve badge governance w chip-bar zmienia kolor na zielony.

### 7.5 Audit Log

- W DeckBuilderze klik „Audit Log" (chip lub URL `?audit_log=true`) → otwiera `DeckAuditLogModal`.
- **E2E:** `GET /api/presentations/decks/:deckId/audit-log` → 200 + lista zdarzeń.
- **Oczekiwane:** lista zdarzeń (typ, user, timestamp) — co najmniej autosave i agent-edit visible.
- **Asercja:** modal otwiera się bez błędu; zamknięcie (X) → powrót do DeckBuildera.

### 7.6 Legal-hold i confidentiality

- W `DeckGovernanceCardModal` sprawdź pole `confidentiality` (public/internal/confidential).
- Deck z `confidentiality='confidential'` i nałożonym legal-hold → eksport powinien zwrócić **422** z `code: 'LEGAL_HOLD'` lub podobnym.
- **E2E:** `GET .../download` → 422 `LEGAL_HOLD`.
- **Asercja UI:** komunikat błędu wskazuje powód (legal-hold), nie generyczny toast.

---

## §8 — Eksport

### 8.1 Eksport PPTX [FLAG: canExport=true]

- Deck z `canExport=true` (wszystkie bramki zielone lub deck nowy/prosty).
- Klik „Eksportuj" → wybierz PPTX w `ShareModal` (zakładka export) lub przez chip.
- **Oczekiwane:** `exportPresentationDeck({ deckId, format: 'pptx' })` wywoływane.
- **E2E:** `GET /api/presentations/decks/:deckId/download` → **200** + `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation`.
- **Plik:** przeglądarka pobiera plik `.pptx`; nazwa = `{deckTitle}.pptx`.
- **Asercja:** plik niezerowy (>0 bajtów); brak błędu Network.

### 8.2 Eksport PDF

- Klik „Eksportuj PDF" w ShareModal (zakładka export).
- **E2E:** `GET /api/presentations/decks/:deckId/export/pdf` → **200** + `Content-Type: application/pdf`.
- **Plik:** `.pdf` pobiera się; nazwa = `{deckTitle}.pdf`.
- **Asercja:** plik niezerowy.

### 8.3 Eksport PNG (slajdy jako obrazy — ZIP)

- Klik „Eksportuj PNG" w ShareModal.
- **E2E:** `POST /api/presentations/decks/:deckId/export/png` → **200** + `Content-Type: application/zip`.
- **Plik:** `.zip` pobiera się; po rozpakowaniu — pliki PNG per slajd.
- **Asercja:** ZIP niezerowy; liczba plików PNG = liczba slajdów (sprawdź w ZIP viewer).

### 8.4 Eksport HTML

- Klik „Eksportuj HTML" w ShareModal lub bezpośrednia ścieżka.
- **E2E:** `POST /api/presentations/decks/:deckId/export/html` → **200** + `Content-Type: text/html`.
- **Asercja:** plik HTML zawiera strukturę slajdów; brak wycieków danych organizacji w HTML.

### 8.5 Export-parity check

- Po eksportach PPTX i PDF — sprawdź czy w DeckBuilderze jest opcja „Export parity" lub odpowiedni endpoint.
- **E2E:** `GET /api/presentations/decks/:deckId/export-parity` (jeśli istnieje) → 200 + raport.
- **Asercja:** brak błędów; raporty parytetu logowane lub widoczne w UI governance.

### 8.6 Eksport przy canExport=false — edge case

- Spróbuj wszystkich 4 formatów eksportu na decku z `canExport=false` (bez `overrideQualityGate`).
- **Asercja:** każdy format zwraca **422** (nie 200, nie 500); UI wyświetla komunikat błędu per format; brak pliku.

---

## §9 — Collaborate STUB [STUB]

> **Kontekst:** `ShareModal.tsx:134-171` — zakładka `collaborate` ma input email bez `value/onChange`, przyciski bez `onClick`, brak API call. Decyzja D-01 = DP-5: ukryć za flagą w v1. Poniższe testy weryfikują, że STUB nie powoduje błędów ani nie ma handlerów.

### 9.1 Otwarcie zakładki Collaborate

- W `ShareModal` klik zakładkę „Collaborate".
- **Oczekiwane:** zakładka renderuje się (pole email, przyciski View/Comment, Permission section).
- **Asercja:** brak błędu konsoli JS przy przejściu na zakładkę.

### 9.2 Wpisanie emaila i klik Send

- Wpisz email w polu `type="email"` → sprawdź: brak `onChange` = pole może nie aktualizować się w stanie React.
- Klik przycisku z ikoną `Mail` (Send invite).
- **Oczekiwane:** NIE wysyła żadnego żądania sieciowego (brak `POST .../collaborate` lub `POST .../invite`).
- **Asercja STUB:** Network = zero nowych żądań po kliknięciu. Klik NIE powoduje crasha, NIE powoduje 500.

### 9.3 Klik przycisku Permission (View/Comment)

- Klik przycisk „View" lub „Comment" (jest klasy `<button>` bez `onClick`).
- **Oczekiwane:** wizualnie może wyglądać jak zaznaczenie (CSS :active), ale brak żadnego handlerów.
- **Asercja:** zero żądań sieciowych, zero błędów konsoli.

### 9.4 Modal zamknięcie

- Po eksploracji STUB klik X lub klik tła → modal zamknięty poprawnie.
- **Asercja:** brak memory leak (event listenery usunięte).

---

## §10 — Ścieżki cross-module

### 10.1 M02 Canvas → M19 (promote deck z Canvas) [FLAG]

- W M02 Canvas (czat z generacją, deliverables-light) wyślij prompt generujący deck.
- **Oczekiwane (gdy `ENABLE_DELIVERABLES_LIGHT=true` i `VITE_ENABLE_DELIVERABLES_LIGHT=true`):** deck pojawia się w prawym panelu Canvas z opcją „Otwórz w DeckBuilderze".
- Klik → nawigacja do `/presentations/builder/:deckId`.
- **Asercja:** deckId poprawny; deck ładuje się; brak błędu 404.
- **Jeśli flaga OFF:** odnotuj jako [FLAG OFF] — nie failuj; weryfikuj tylko brak crasha przy próbie promote.

### 10.2 M13 Inicjatywy → M19 (deck o inicjatywie)

- Z widoku inicjatywy (`/initiatives/:id`) sprawdź, czy istnieje akcja „Stwórz deck z tej inicjatywy" lub „Eksportuj jako prezentację".
- Jeśli tak: wykonaj akcję → powinno otworzyć `/prezentacje` lub `/presentations/wizard` z kontekstem inicjatywy (np. `?templatePrompt=` lub `?sourceId=`).
- **Asercja:** nawigacja poprawna; brak błędu 404/500; deck odzwierciedla dane inicjatywy.
- Jeśli akcji brak: odnotuj jako `[BRAK CTA — nie failuj]`.

### 10.3 M19 → M17 Outputs (rejestracja w bibliotece)

- Po wygenerowaniu decku przejdź do M17 Outputs (`/presentations`).
- Sprawdź zakładkę „Presentations" (lub „All") — nowy deck powinien być widoczny.
- **E2E:** `GET /api/artifacts?tab=presentations` → 200 + lista artefaktów zawiera nowy deckId.
- Klik „Otwórz" na decku → `resolveArtifactOpenPath` → nawigacja do `/presentations/builder/:deckId`.
- **Asercja:** reopen z biblioteki działa (brak 404); deck ładuje się z poprawnym deckId.

### 10.4 M10 Wywiad → M19 (deck z wniosków wywiadowych)

- Z widoku Wywiadu (`/discovery`) sprawdź, czy jest akcja „Stwórz prezentację z tych insightów".
- Jeśli tak: wykonaj → nawigacja do `/prezentacje` lub `/presentations/wizard` z kontekstem insightów.
- **Asercja:** brak błędu; jeśli parametry przekazane poprawnie, deck odzwierciedla treść insightów.
- Jeśli akcji brak: odnotuj jako `[BRAK CTA — nie failuj]`.

### 10.5 Reopen z biblioteki przez `?artifactId=`

- Wejdź na `/prezentacje?artifactId=<deckId>`.
- **Oczekiwane:** `PrezentacjeView` rozpoznaje parametr i ładuje deck do podglądu w prawym panelu (lub otwiera DeckBuilder bezpośrednio).
- **E2E:** `GET /api/artifacts/:deckId` → 200; lub `GET /api/presentations/decks/:deckId` → 200.
- **Asercja:** brak białego ekranu; badge cyklu życia (trust-state) widoczny.

---

## §11 — Mapa Epików → sekcje (ZERO niepokrytych)

| Epik | Story | Sekcja w tym pliku |
|---|---|---|
| EPIK 1 — Domknąć stub (L-01) | 1.1 Collaborate UI bez handlerów | §9 w całości |
| EPIK 2 — Bezpieczeństwo | 2.1 beta-guard + share rate-limit/revoke | §6.3, §11.1 |
| EPIK 2 | 2.2 org-scope analytics-beacon | §6.6 |
| EPIK 2 | 2.3 override role-gate regresja (L-02, STALE) | §7.3 |
| EPIK 3 — Test prawdy | 3.1 vacuous testy (L-07) | §przekrojowe/regresja |
| EPIK 3 | 3.1 round-trip snapshot DB (S4) | §5.5 |
| EPIK 3 | 3.1 route 422 (S5) | §7.2 |
| EPIK 4 — Kanony | 4.1 i18n (L-05) | §przekrojowe/i18n |
| EPIK 4 | 4.1 tokeny hex (L-06) | §przekrojowe/ciemny motyw |
| INV_E poz.1 | Home + grid szablonów | §1.1 |
| INV_E poz.2 | Pipeline V8 generacji | §1.2, §1.3 |
| INV_E poz.3 | Auto-trigger czat | §1.2, §1.7 |
| INV_E poz.4 | Reopen z biblioteki | §10.3, §10.5 |
| INV_E poz.5 | Intent-routing po generacji | §1.3 |
| INV_E poz.6 | Quality gates eksportu | §7.1–§7.6 |
| INV_E poz.7 | DeckBuilder WYSIWYG | §2, §3 |
| INV_E poz.8 | MELS shell | §2.1–§2.3 |
| INV_E poz.9 | Motywy + brand kit | §11.2 |
| INV_E poz.10 | Historia wersji | §5 w całości |
| INV_E poz.11 | Collaborate STUB | §9 |
| INV_E poz.12 | Share + analityka | §6 |
| INV_E poz.13 | Agent Teresa | §4 |
| INV_E poz.14 | Governance | §7.4–§7.6 |
| INV_E poz.15 | Eksporty | §8 |
| INV_E poz.16 | Presentation Studio S5/S7 (UKRYTE) | §11.3 |

---

## §11 uzupełnienia — testy dodatkowe

### 11.1 Beta gating i nawigacja

- Sidebar: badge „beta" widoczny przy „Prezentacje" w menu.
- `MODULE_PREZENTACJE_GEN = 'open'` → dostęp dla wszystkich zalogowanych (brak blokady `AccessBlockedModal`).
- Sprawdź oba konta: OWNER i MEMBER mogą wejść na `/prezentacje`.
- **Direct URL:** wejdź na `/presentations/builder/:deckId` bez kliku w sidebarze → ładuje się (beta-lock tylko nawigacyjny, nie routerowy).

### 11.2 Motywy i Brand Kit

- W DeckBuilderze klik „Theme" (chip lub ikona) → otwiera `ThemeSwitcher`.
- Wybierz inny motyw (np. z „Corporate" na „Minimal") → deck renderuje się z nowym motywem (kolory, czcionki).
- **E2E:** zmiana motywu → autosave z nowym `theme_id` w `deck_json`.
- **Brand Kit:** `BrandKitSettings` → `GET /api/presentations/brand-kit` → 200 + `{ primary_color, secondary_color, accent_color, logo_url, font_title, font_body }`.
  - Jeśli brand kit skonfigurowany → kolory i czcionki z kit powinny być używane w renderze slajdów.
  - Jeśli nie skonfigurowany → fallback do domyślnych kolorów motywu; brak błędu konsoli.

### 11.3 Presentation Studio S5 (UKRYTE — tylko URL) [FLAG]

- Wejdź bezpośrednio na `/presentation-studio`.
- **Oczekiwane:** studio ładuje się (DZIAŁA, brak wpisu w nawigacji — ukryte celowo).
- Sprawdź: approval-ticket flow — `POST /presentations/generate` bez ticketu → **403**.
- **Asercja:** brak błędu 500; brak wycieku danych z innych organizacji.

### 11.4 PresentationsHub (biblioteka decków) — §27

- Wejdź na `/presentations` (M17 Outputs / PresentationsHub).
- **§27 compliance:** tabela z `TableWithPreviewLayout`, `EntityStatusChip`, `RowActionsMenu` — najlepsza zgodność §27 w audycie.
- Filtry: source type (tool/assessment/finance/upload), owner, data.
- View modes: lista (table) i siatka (grid) — toggle ViewMode.
- Akcje wierszowe (RowActionsMenu): Otwórz w DeckBuilderze, Eksportuj (ponowny eksport), Archiwizuj, Usuń.
- **E2E:** `GET /api/presentations/decks` → 200 + `{ data: [...], unavailable: false }`.
  - `unavailable: true` (np. brak schematu) → hub pokazuje stan „unavailable" zamiast pustej tabeli (NIE 500).
- **Asercja:** klik „Otwórz" na wierszu → `/presentations/builder/:deckId`; brak błędu 404.

---

## §przekrojowe — testy systemowe

### P1 — V8 ON/OFF (kluczowe)

- Przeprowadź §1 raz z `ENABLE_V8_GLOBAL=true` i raz z `false`.
- Z V8 ON: pipeline działa, decks generowane.
- Z V8 OFF: pipeline zwraca 404; UI pokazuje komunikat (nie crash); DeckBuilder, Hub, wersje, eksport — nadal działają (nie za flagą).
- **Asercja:** dwie oddzielne sesje; wyniki zaraportowane per stan flagi.

### P2 — MELS ON/OFF

- Przeprowadź §2 raz z `?ff_melsDeckBuilder=0` (legacy) i raz bez (MELS ON).
- Verify: funkcje §2.4–§2.11 działają w obu trybach.
- **Asercja:** brak regresi przy MELS OFF; MELS ON = `ExecutiveModuleShell` widoczny.

### P3 — Persistencja (po F5)

- Po każdym z poniższych działań wykonaj hard refresh (`Ctrl+Shift+R`):
  - Edycja tekstu + autosave → po F5 tekst przetrwał.
  - Checkpoint wersji → po F5 widoczny w historii.
  - Generacja share token → po F5 token nadal w `ShareModal`.
- **Asercja:** każda z 3 akcji przetrwała refresh. Brak regresi in-memory.

### P4 — i18n PL / EN

- Przełącz język na EN → DeckBuilder UI po angielsku (etykiety chipów, tooltips, placeholdery).
- Przełącz na PL → UI po polsku.
- Sprawdź: brak surowych kluczy `presentations.builder.xxx` widocznych w UI (all i18n keys resolved).
- **Znany dług techniczny [L-05]:** `DeckBuilder.tsx` używa 30× `isPolish ? 'PL' : 'EN'` zamiast `t()`. Zaraportuj które elementy są wciąż hardkodowane — ale brak crasha to warunek minimalny.

### P5 — Dark mode

- Przełącz na dark mode → cały DeckBuilder w ciemnym motywie (dark:bg-navy-*, dark:text-white).
- Sprawdź: brak tekstu niewidocznego (czarny na czarnym); brak hardkodowanych jasnych kolorów.
- **Znany dług [L-06]:** 127 `#RRGGBB` hex w kodzie `Presentations/`; część legitna w render (ColorsView itp.). Zaraportuj widoczne artefakty kolorystyczne, ale nie failuj testu za sam count hex.

### P6 — Zero błędów konsoli

- Otwórz DeckBuilder → wykonaj pełny cykl (load → edit → autosave → version → share → export → agent edit).
- **Asercja:** Console = 0 błędów JS (wyjątki: `net::ERR_ABORTED` na anulowanych żądaniach, `WARN` z bibliotek zewnętrznych).
- Sprawdź szczególnie: brak niezłapanych `Promise rejection`; brak `Cannot read properties of undefined`.

### P7 — A11y (dostępność podstawowa)

- DeckBuilder ładuje się bez `aria-*` błędów w konsoli.
- `AgentActivityPanel` ma `aria-label="AI Activity"` → screen reader czyta panel.
- SlideSorter — miniatury slajdów mają `alt` lub `aria-label`.
- Nawigacja klawiaturą: `Tab` przechodzi przez chip-bar; `Enter` otwiera panel; `Escape` zamyka modal.

### P8 — Wydajność (edge cases)

- Deck z 20 slajdami (max Wizard) → DeckBuilder ładuje się bez timeout; SlideSorter renderuje wszystkie miniatury.
- Autosave z dużym `deck_json` (>50 KB) → Network nie zwraca 413; 200 bez timeout.
- AgentActivityPanel polling 30s z 10 zdarzeniami → brak memory leak po 5 minutach (sprawdź heap w DevTools > Memory).

---

## §regresja — testy automatyczne do uruchomienia

Przed lub po testach manualnych uruchom istniejące testy automatyczne:

```bash
# Z katalogu głównego projektu
npx vitest run tests/components/Presentations/DeckBuilder.test.tsx
npx vitest run tests/components/ReportsAndPresentations/PresentationsTabContent.deeplink.test.tsx
npx vitest run src/components/Presentations/DeckBuilder/__tests__/
npx vitest run src/services/__tests__/presentationWatchlistPresetTransfer.test.ts
npx vitest run src/services/__tests__/presentationGovernanceDeepLinks.test.ts
npx vitest run src/services/__tests__/presentationAuditLogSavedViews.test.ts
npx vitest run src/services/__tests__/presentationGovernanceWatchlistDiff.test.ts
npx vitest run src/services/api/__tests__/presentationStudioLayoutCapacityAdmin.api.test.ts
```

**Znane problemy z testami automatycznymi (L-07 — fałszywa zieleń):**

Testy integracyjne p20 (15/21) to `fetch(localhost:3001)` z `if(status!==201)return` — **przechodzą nawet bez serwera** (0,68s total). Wynik PASS nie jest dowodem poprawności działania. Testy te należy:
1. Uruchomić z aktywnym dev serverem (`:3001`).
2. Sprawdzić, czy asercje faktycznie się wykonują (dodać `console.log` do asercji lub sprawdzić pokrycie).
3. Zaraportować liczbę asercji faktycznie uruchomionych vs. vacuous pass.

**Krytyczne testy brakujące (L-07):**
- `[BRAK]` Test round-trip DB: autosave → snapshot w `presentation_deck_versions` → restore → weryfikacja wiersza.
- `[BRAK]` Test route 422: export z `canExport=false` → 422 (nie 200, nie 500).
- `[BRAK]` Test regresji override role-gate: nie-admin + `?overrideQualityGate=true` → 422.

---

## Format raportu z testów

Każda sekcja raportowana jako:

```
## §<N> — <Nazwa> — [PASS|FAIL|PARTIAL|N/A]
### <N>.<M> <Opis testu>
- Wynik: PASS / FAIL
- Dowód UI: <screenshot lub opis>
- Dowód Network: <endpoint> → <kod HTTP> + <kluczowy fragment payloadu>
- Dowód DB (jeśli [DB]): <tabela> <warunek WHERE> → <wynik SELECT>
- Uwagi: <opcjonalne>
```

---

## Definition of Done (DoD) — M19 Prezentacje

Test paczka M19 jest ZALICZONA gdy:

| # | Kryterium | Dowód |
|---|-----------|-------|
| 1 | §1 pipeline V8 — generacja PASS lub graceful OFF | Network sekwencja 4 żądań lub 404 z komunikatem |
| 2 | §2 DeckBuilder WYSIWYG — edycja + autosave PASS | Network `PUT .../autosave` + persistencja po F5 |
| 3 | §3 Typy bloków — min. 5 z 14 przetestowanych bez błędów | Console = 0 błędów przy renderowaniu |
| 4 | §4 Teresa agent — accept/reject cykl PASS | Network `POST .../agent-edit`, `.../accept`, `.../reject` |
| 5 | §5 Wersje — cold-start trwałość PASS [DB] | Wiersz w `presentation_deck_versions` po restarcie |
| 6 | §6 Share — generacja linku + publiczny viewer PASS | `POST .../share` → `shareToken`; viewer bez over-disclosure |
| 7 | §7.3 Override role-gate — MEMBER = 422 PASS | Network: nie-admin → 422 mimo `?overrideQualityGate=true` |
| 8 | §8 Eksport — min. PPTX + PDF bez `canExport` blokady | Pobrane pliki niezerowe; `.../download` → 200 |
| 9 | §9 Collaborate STUB — brak crasha + zero API calls | Network = 0 żądań po kliknięciu Invite |
| 10 | §przekrojowe — zero błędów konsoli przez pełny cykl | Console = 0 JS errors |

**Paczka jest NIEZALICZONA** jeśli którykolwiek z poniższych:
- Biały ekran (crash) w DeckBuilderze przy normalnym użyciu.
- Cold-start: deck gubi dane po restarcie serwera (L-07 wciąż FAIL).
- Nie-admin omija quality gate (regresja L-02).
- Public viewer ujawnia `organization_id`/`confidentiality` (regresja fix `1b67579d7a`).
- Collaborate STUB wywołuje żądanie sieciowe (handler musi być brak).

---

## Testy manualne — Generatory Deliverable (premium DECK quality)

> **APPEND 2026-06-23.** Sekcja NOWA i ROZŁĄCZNA z §1–§11 powyżej. Powyżej = istniejący DeckBuilder (pipeline V8, edycja, wersje, share, eksport, quality-gates). Tutaj = **premium warstwa generatora prezentacji** (program „Generatory Deliverable", fale W2/W4/W5): R4 Gamma-flow, **B1 AI Layout Director**, B2 warianty/remix, X1 parytet eksportu. Cel: dowieść, że deck z mózgu premium jest **klasy Gamma**.
>
> **Bazuje na:** `Harvard/wdrozenie-100/M19-prezentacje.md` → sekcja „Generatory Deliverable — premium DECK" · `docs/product/DELIVERABLES_GENERATORS_SPEC.md` (R4/B1/B2/X1) · `docs/qa/deliverables/test-plan/{R,B,X}-series.md` · `docs/qa/deliverables/scenarios/M19_DECKS.md` (30 deck quality) · run dowodowy `docs/qa/deliverables/runs/2026-06-22-VTS-generated.md`.
> **Rubryka jakości (operacyjna):** kanon graficzny z `M19_DECKS.md` (ONE palette/deck, ≥8 distinct layouts gdy ≥8 slajdów, no >2 consecutive identical, image-brief presence) + ocena ekspercka 4-osiowa (layout-fit / hierarchia / motyw / „gotowe do klienta", mediana ≥4/5) z `test-plan/B-series.md` §B1-S08.
>
> **Decyzje jakości (zablokowane):** Q1 = ≥85% deck quality · Q3 = golden VTS · Q5 = Unsplash.

### Stan wykonalności (PRZECZYTAJ NAJPIERW — uczciwie)

| Co | Jak testować DZIŚ | Status flagi/wpięcia |
|---|---|---|
| **Jakość B1 (layouty/paleta/brief/scoring)** | **Warstwa 1 — Scoring-auto** przez runner FT-6 (plain-node, klucz ze stagingu) + inspekcja artefaktu JSON / VTS golden. **Testowalne TERAZ.** | premium ON tylko w runnerze (`ENABLE_DELIVERABLES_PREMIUM=true`) |
| **R4/B2 przez UI, dark mode, present mode, persyst/undo** | **Warstwa 2 — Manual-UI** przez żywy deck builder. **BLOCKED** — premium niewpięty w pipeline UI; flaga OFF na Railway. | wymaga: flaga ON na Railway + wpięcie + deploy |
| **X1 parytet eksportu (deterministyczny)** | **Export-fidelity-vitest** (parsowanie pliku PNG/PDF). Testowalne TERAZ bez deploya. | n/d (mock playwright) |
| **X1 parytet manualny + head-to-head Gamma** | **Manual** (otwarcie PDF/PNG, ocena ekspercka). Head-to-head = render artefaktu + porównanie. | część testowalna teraz (z artefaktu), reszta po wpięciu |

> **Reguła uczciwości:** NIE wolno raportować „jakość premium przez UI potwierdzona", dopóki premium nie jest wpięte i nie ma żywego LLM przez UI. Dziś dowód jakości = warstwa 1 (runner + scoring + golden), NIE żywy deck builder.

### Setup warstwy 1 (Scoring-auto) — premium runner FT-6

1. Uzyskaj **ważny klucz Anthropic ze stagingu Railway** (lokalnie zwykle brak → mierzysz podłogę, nie mózg — patrz `finding_deliverables_ft6_pilot_blocker`).
2. Z katalogu głównego repo uruchom runner z flagą premium ON:
   ```bash
   ANTHROPIC_API_KEY=<klucz-staging> ENABLE_DELIVERABLES_PREMIUM=true \
     node --import tsx scripts/deliverables/live-pilot-ft6.mts
   ```
   - Runner ustawia `DOTENV_IGNORE_LOCAL=1` → NIE dotyka `.env.local` (PROD centerbeam), NIE inicjalizuje DB. PROD-safe.
3. Wynik trafia do `docs/qa/deliverables/runs/<data>-live-pilot-<model>.json`:
   - `byModule[deck].avgScorePct`, `rows[deck].scorePct/passed/failures`,
   - `rows[deck].sample.{distinctLayouts, layouts, palettes, withBrief, sampleBrief}`,
   - `rows[deck].{tierUsed, source, fallbackUsed}`.
4. Dla dowodu „board deck 10–12 slajdów" użyj golden **S16** (`M19_DECKS.md`, Lrg, ~12 slajdów) lub VTS golden (`runs/2026-06-22-VTS-generated.md` = 11 slajdów).

### Setup warstwy 2 (Manual-UI) — po wpięciu premium (BLOCKED dziś)

Wymaga kolejno: (a) `ENABLE_DELIVERABLES_PREMIUM=true` na Railway staging, (b) wpięcia generatorów premium w pipeline UI (chat→canvas→studio / deck builder), (c) deployu i live-verify w przeglądarce. Dopóki to nie wykonane — scenariusze [FLAG]/[MANUAL-UI] poniżej oznaczone **BLOCKED**: opisane, gotowe do egzekucji, NIE do odhaczenia.

---

### Zasada weryfikacji 3-warstwowej (obowiązkowa)

Każda asercja jakości premium MUSI być potwierdzona w trzech warstwach (analogia do §0 powyżej):
1. **UI / artefakt** — widoczny deck (golden render / żywy builder po wpięciu) bez błędów.
2. **Network / dane** — dla warstwy 1: wpis w runie JSON (`source='llm'`, `tierUsed='PREMIUM'`); dla warstwy 2: `POST` generacji premium → 200 z artefaktem premium.
3. **Dowód mierzalny** — liczby z `scoreDeck` (distinctLayouts, palettes count, withBrief, noTripleRun) LUB ocena ekspercka 4-osiowa zapisana.

---

### MD-01 [SCORING-AUTO] Wygeneruj board deck (10–12 slajdów) → kanon graficzny ✅ testowalne TERAZ

**Mapuje:** B1-S01/S02/S03 · M19_DECKS S16 · EPIK G-1 (Story G-1.1..1.4).
**Preconditions:** premium runner skonfigurowany (Setup warstwy 1); `ENABLE_DELIVERABLES_PREMIUM=true`; ważny klucz LLM.

**Kroki:**
1. Uruchom runner FT-6 z golden S16 (intent: „Pełna diagnoza Apator Powogaz: exec summary, 3 obszary problemowe, 5 rekomendacji, roadmapa, ryzyko, next steps ~12 slajdów", `lang=PL`). Alternatywnie użyj gotowego VTS golden (`runs/2026-06-22-VTS-generated.md`).
2. Otwórz run JSON → `rows[deck].sample`.

**Expected (każde MUSI być ✓):**
- **count:** `slides.length` w `[10,14]` (board deck).
- **≥8 distinct layouts:** `distinctLayouts ≥ 8` (gdy ≥8 slajdów — kanon). *VTS golden = 11 slajdów / 11 distinct = ✓.*
- **single palette:** dokładnie **1** distinct `paletteId`, ∈ catalog13 (harvard/ocean/slate/forest/ember/midnight/arctic/sand/indigo/graphite/olive/burgundy/teal). *VTS = `midnight` = ✓.*
- **image brief per slide:** każdy slajd ma nonempty `imageBrief` (≥10 znaków) + `reasoning`. *VTS = brief+reasoning na 11/11 = ✓.*
- **no triple-run:** `noTripleRun = 0 violations` (brak >2 identycznych layoutów pod rząd).
- **premium aktywny:** `tierUsed='PREMIUM'`, `source='llm'`, `fallbackUsed=false`.
- **scorePct:** ≥85% (Q1 cel) — VTS/FT-6 Sonnet 4.6 ≈100%.

**Evidence:**
- **UI/artefakt:** lista slajdów z layoutami (golden md lub render).
- **Network/dane:** run JSON `rows[deck].{tierUsed:'PREMIUM', source:'llm', fallbackUsed:false}`.
- **Mierzalny:** `sample.{distinctLayouts, palettes, withBrief}` + `failures` puste dla reguł kanonu.
- **Screenshot:** zapisz render decka do `docs/qa/screens/deliverables-B-<data>/MD-01-board-deck.png` (po renderze do PNG/PDF — sekcja MD-05).

---

### MD-02 [SCORING-AUTO] Narracyjny flow + dopasowanie layoutu do tematu ✅ testowalne TERAZ

**Mapuje:** B1-S04/S05 · M19_DECKS S06/S08/S09 · EPIK G-1 (Story G-1.5).
**Preconditions:** jak MD-01.

**Kroki:**
1. Z runu board-deck (MD-01) odczytaj sekwencję `slides[].intent`.

**Expected:**
- **Narracyjny flow:** `slides[0].intent === 'cover'`, `slides[last].intent === 'next_steps'`; między nimi sensowna progresja (np. `cover → executive_summary → key_messages → assessment → performance_overview → comparison → root_cause → recommendation_portfolio → roadmap → risk_management → next_steps` — dokładnie taka jest w VTS golden).
- **Dopasowanie layoutu do tematu (≥1 z poniższych trafień):**
  - temat z KPI/metrykami → obecny `performance_overview`,
  - temat „harmonogram/plan/roadmapa" → obecny `roadmap`,
  - temat „ryzyko/audyt ryzyk" → obecny `risk_management`,
  - temat „rekomendacje/portfel działań" → obecny `recommendation_single` lub `recommendation_portfolio`.
- **Layout intents tylko z 17-katalogu** (Zod enum — brak śmieci).

**Evidence:** run JSON `sample.layouts` (pełna lista intentów); porównaj z sekwencją VTS golden. Screenshot listy intentów.

---

### MD-03 [MANUAL-UI / FLAG] R4 Gamma-flow w żywym builderze ⚠ BLOCKED (po wpięciu)

**Mapuje:** R4-S01..S07 · test-plan R-series R4 · EPIK G-2.
**Preconditions:** premium wpięty w UI + `ENABLE_DELIVERABLES_PREMIUM=true` na Railway + deploy (Setup warstwy 2). **Dziś BLOCKED.**

**Kroki + Expected:**
1. Otwórz `/presentations/builder/:deckId` (deck z generatora premium). → `deck-builder-mels-root` widoczny; SlideSorter + CardCanvas renderują slajdy (R4-S01).
2. Wybierz slajd, wpisz w pole „Przerób ten slajd…", wywołaj regenerację (`presentations.builder.regenerateSlide`). → status „Regenerating…", treść slajdu się zmienia (R4-S02).
3. Zmień motyw (ThemeSwitcher / CommandPalette → „Theme"). → kolory/typografia zmieniają się na WSZYSTKICH slajdach, paleta nadal jedna (R4-S03).
4. Present Mode (przycisk „Present"). → fullscreen, nawigacja strzałkami, ESC wychodzi (R4-S04).
5. Branding org (logo/kolory). → logo/kolory marki widoczne zgodnie z motywem (R4-S05).
6. Undo (Cmd+Z) po zmianie bloku. → ostatnia zmiana cofnięta (R4-S06).

**Evidence (po wpięciu):** screenshoty `docs/qa/screens/deliverables-R-<data>/R4-S0x-*.png`; Network: `POST` regeneracji premium → 200 z `source='llm'`. **Dziś:** odnotuj `[BLOCKED — premium niewpięty w UI]`, NIE failuj.

---

### MD-04 [SCORING-AUTO + MANUAL-UI] B2 warianty / remix slajdu

**Mapuje:** B2-S01..S05 · test-plan B-series B2 · EPIK G-3.

**Część A — warstwa 1 (Scoring-auto) ⚠ wymaga rozszerzenia runnera:**
- **Preconditions:** runner rozszerzony o N-krotne wołanie layout-directora na 1 slajdzie z różnym seedem (B2-S01 — dziś runner woła `planDeckLayout` raz; remix = osobna ścieżka).
- **Kroki:** zawołaj generator remix 3× na tym samym slajdzie.
- **Expected:** 3 warianty; **≥2 distinct `layoutIntent`**; każdy waliduje schema; `key_message`/headline semantycznie ten sam (keyword-overlap ≥ próg); wszystkie trzymają **paletę deck** (single palette — brak driftu).
- **Evidence:** nowy run `runs/<data>-remix.json` (3 plany) + diff.

**Część B — warstwa 2 (Manual-UI) ⚠ BLOCKED (po wpięciu):**
- Wybierz wariant 2, reload → po reloadzie ten sam wariant (persyst — B2-S04).
- Remix → Undo → slajd = stan sprzed remixu (B2-S05).
- **Evidence:** screenshot przed/po reload. **Dziś:** `[BLOCKED]`.

---

### MD-05 [MANUAL / EXPORT-FIDELITY] X1 parytet eksportu PDF/PNG

**Mapuje:** X1-S01..S07, X1-M01..M06 · test-plan X-series X1 · EPIK G-4.

**Część A — deterministyczna (Export-fidelity-vitest) ✅ testowalne TERAZ:**
```bash
npx vitest run tests/unit/deliverables/playwrightHtmlToPng.test.ts
```
- **Expected:** `status==='ok'`, buffer PNG magic `0x89 50 4E 47`, viewport default 1920×1080 honorowany; brak chromium → `status==='unavailable'` (fail-open, nie crash).
- **Evidence:** wynik vitest (parsowany Buffer).

**Część B — manualna (po wpięciu lub z renderu artefaktu):**
- Deck → Export PDF → otwórz PDF. → wizualnie identyczny z ekranem; kolory/logo zachowane; tabele z ramkami; wykres jako rastr (X1-M01/M04/M05/M06).
- Slajd → Export PNG. → ostry (deviceScaleFactor), pełny slajd 1920×1080 (X1-M03).
- **Evidence:** PDF/PNG + screenshot porównawczy side-by-side do `docs/qa/screens/deliverables-X-<data>/MD-05-*.png`. **Bez wpięcia:** render z artefaktu premium (skill `pptx` → `export_pdf` lub `playwrightPdfRenderer`).

---

### MD-06 [SCORING-AUTO] Fallback gdy AI OFF = podłoga deterministyczna ✅ testowalne TERAZ

**Mapuje:** B1-S06 · test-plan B-series · EPIK G-1 (Story G-1.6) · FT-8.
**Preconditions:** runner; flaga premium OFF.

**Kroki:**
1. Uruchom runner **bez** premium: `ENABLE_DELIVERABLES_PREMIUM=false node --import tsx scripts/deliverables/live-pilot-ft6.mts`.

**Expected:**
- `fallbackUsed=true`, `tierUsed='STANDARD'`, `source≠'llm'`.
- **Brak crasha**; deck nadal waliduje schema (layouty/palety ∈ catalog).
- Jakość = podłoga deterministyczna (NIE Gamma-class — i to jest poprawne zachowanie OFF).

**Evidence:** run JSON STANDARD z `fallbackUsed=true`. To test regresji fail-open (`deliverableGenerationTier.ts:13`).

---

### MD-07 [HEAD-TO-HEAD / MANUAL] Premium deck vs Gamma na temacie VTS golden ⚠ ocena ekspercka

**Mapuje:** B1-S08 · test-plan B-series §B1-S08 · EPIK G-5 (Story G-5.1).
**Preconditions:** wygenerowany deck premium (MD-01 / VTS golden) wyrenderowany do PNG/PDF; konto Gamma; ten sam intent w Gamma.

**Kroki:**
1. Wyrenderuj nasz deck z artefaktu `plans[]` do PNG/PDF (skill `pptx` → `export_pdf`, lub renderer prezentacji / zrzut z UI po wpięciu). Zapisz do `docs/qa/deliverables/runs/<data>/h2h-deck/nasz-VTS.png`.
2. Wygeneruj ten sam temat („Diagnoza gotowości na AI — VTS Group", board, ~11 slajdów) w Gamma. Zapisz `gamma-VTS.png` obok.
3. Oceń oba w **4 osiach 1–5** (rubryka B-series): **layout-fit** (dobór layoutu do treści) · **hierarchia** (czytelność, tytuł→treść) · **motyw** (spójność palety, board-grade) · **„gotowe do klienta"** (czy można wysłać bez poprawek).

**Expected (PASS):** **mediana ocen naszego ≥ 4/5** ORAZ **brak osi < 3**.

**Evidence:** tabela ocen (per oś, nasz vs Gamma, mediana, podpis oceniającego) + 2× PNG w `runs/<data>/h2h-deck/`. **Ocena jest z definicji ekspercka** (człowiek/Piotr) — nie automatyzujemy.

---

### Mapa MD → źródła (ZERO niepokrytych)

| MD | Mapuje (test-plan / scenariusz) | EPIK (teczka) | Warstwa | Status dziś |
|---|---|---|---|---|
| MD-01 board deck + kanon | B1-S01/S02/S03 · M19_DECKS S16 | G-1.1..1.4 | Scoring-auto | ✅ testowalne TERAZ |
| MD-02 flow + layout-fit | B1-S04/S05 · S06/S08/S09 | G-1.5 | Scoring-auto | ✅ testowalne TERAZ |
| MD-03 R4 Gamma-flow UI | R4-S01..S07 | G-2 | Manual-UI | ⚠ BLOCKED (po wpięciu) |
| MD-04 B2 remix/warianty | B2-S01..S05 | G-3 | Scoring-auto (A) + Manual-UI (B) | ⚠ A: po rozszerzeniu runnera; B: BLOCKED |
| MD-05 X1 parytet eksportu | X1-S01..S07, M01..M06 | G-4 | Export-fidelity + Manual | ✅ A: TERAZ; B: po wpięciu/renderze |
| MD-06 fallback AI OFF | B1-S06 (FT-8) | G-1.6 | Scoring-auto | ✅ testowalne TERAZ |
| MD-07 head-to-head Gamma | B1-S08 | G-5.1 | Head-to-head (ekspercki) | ⚠ ocena ręczna |

### DoD premium DECK — paczka ZALICZONA gdy

| # | Kryterium | Dowód |
|---|-----------|-------|
| 1 | MD-01 board deck: ≥8 distinct layouts + single palette + brief per slide + noTripleRun=0 | run JSON `sample` + golden VTS 11/11 |
| 2 | MD-01 premium aktywny: `tierUsed='PREMIUM'`, `source='llm'`, `fallbackUsed=false` | run JSON |
| 3 | MD-01 scorePct ≥85% (Q1) | run JSON `scorePct` (FT-6 Sonnet 4.6 ≈100%) |
| 4 | MD-02 narracyjny flow (cover→…→next_steps) + layout-fit do tematu | run JSON `sample.layouts` |
| 5 | MD-06 fallback OFF = STANDARD, brak crasha, schema waliduje | run JSON STANDARD `fallbackUsed=true` |
| 6 | MD-05 część A: PNG/PDF magic + viewport (parytet deterministyczny) | wynik vitest |
| 7 | MD-07 head-to-head: mediana ≥4/5, brak osi <3 | tabela ocen + 2× PNG |

**Paczka NIEZALICZONA jeśli:** premium deck łamie kanon (≥2 identyczne layouty pod rząd / >1 paleta / slajd bez briefu); `fallbackUsed=true` mimo premium ON (mierzy podłogę, nie mózg); fallback OFF crashuje zamiast dać STANDARD; head-to-head mediana <4 lub jakakolwiek oś <3.

**Pozycje [MANUAL-UI]/[FLAG] (MD-03, MD-04 część B) pozostają BLOCKED do wpięcia premium w UI + flaga Railway + deploy** — opisane i gotowe, NIE liczone do odhaczenia przed wpięciem (reguła „Verify before claiming").
