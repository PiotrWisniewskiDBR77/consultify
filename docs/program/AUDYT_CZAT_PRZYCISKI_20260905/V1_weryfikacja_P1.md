# V1 — Weryfikacja adwersaryjna 5 defektów P1 (ekran `/chat`)

Katalog: `/private/tmp/m03` (tryb: tylko odczyt). Uwaga metodologiczna: BRIEF podaje HEAD
`4332ade1c6`, realny HEAD katalogu w chwili weryfikacji to `a3af36b61b` (branch
`codex/m03-admin-20260824`) — inny commit niż zadeklarowany w briefie. Nie zmienia to
wniosków poniżej (weryfikowane pliki/linie istnieją i są spójne), ale odnotowuję rozjazd
zgodnie z zasadą „dowód poza repo/rozjazd commitów wyparowuje".

---

## 1. A2_kebab_kanwy.md D-1 — „AI on selection"/„Dodaj element" to deterministyczna podmiana tekstu, nie LLM

**Werdykt: POTWIERDZONY**

Własny, niezależny dowód (poza tym co podał audytor):
- `src/components/AIChat/WorkCanvasDocumentPanel.tsx:2407-2418` (`applySelectionMenuAction`) —
  buduje statyczny prefiks (`'Expand this thought...'` itd.) i wkleja go razem z zaznaczonym
  tekstem do `selectionAiPrompt` przez `setSelectionAiPrompt`. Zero wywołania sieciowego.
- `src/components/AIChat/WorkCanvasDocumentPanel.tsx:2521-2537` (`previewSelectionEdit`) —
  wysyła `replacementMd: selectionEditDraft.trim()` (czyli dosłowny tekst z pola) jako
  operację `replace_selection` do `Api.workCanvasApplyOperation`.
- `server/src/routes/work-canvas.routes.ts:1710-1763` (`applyEditOperation`) — dla
  `replace_selection`/`append_section`/`update_document` robi wyłącznie
  `draft.contentMd.replace(selectedText, replacementMd)` / konkatenację stringów. Sprawdziłem
  **cały plik** `work-canvas.routes.ts` (`grep -n "aiService\|llmService\|openai\|anthropic\|generate\|complete"`)
  — zero trafień, żaden import serwisu AI nie istnieje w tym pliku w ogóle (nie tylko w
  cytowanych liniach — w CAŁYM handlerze `/drafts/:draftId/operations`, linie 3847-3900+).
- `insertQuickAddElement` (`WorkCanvasDocumentPanel.tsx:2397-2404`) + `buildQuickAddMarkdown`
  (`:2378-2394`) — czysty szablon markdown, potwierdzone.

Porównanie z B_edytor.md: to rzeczywiście DWA różne mechanizmy pod tą samą etykietą „AI".
`canvas-stream-request` (prawdziwe AI, `useCanvasAIStream.ts`) jest wysyłany z jednego
jedynego miejsca w całym `src/`: `UnifiedChatPanel.tsx:4125` (zweryfikowane
`grep -rn "canvas-stream-request" src/` — 3 trafienia: 1 dispatch w UnifiedChatPanel, 2 listener
w WorkCanvasDocumentPanel, komentarz). Kebab kanwy nigdy nie dispatchuje tego eventu — potwierdza
to, że kebab i menu pływające edytora (B) to naprawdę odrębne tory, a kebab jest atrapą.

**Jedno zdanie dla właściciela:** przyciski „AI on selection" i „Dodaj element" w menu kebab
kanwy nie proszą Teresy o nic — tylko wklejają gotowy szablon tekstu, więc to co widzisz w
podglądzie to Twoja własna instrukcja wpisana od nowa, nie odpowiedź modelu.

---

## 2. B_edytor.md D-1 — akcje AI menu pływającego milczą przy błędzie

**Werdykt: OSŁABIONY** (defekt realny dla większości akcji, ale zasięg „WSZYSTKIE" jest
zawyżony — jedna z wymienionych w zakresie pozycji ma widoczną obsługę błędu)

Dowód potwierdzający większość zakresu:
- `CanvasRichEditor.tsx:282-285` (`handleAIRequest`, `if (!response.ok) { setAiProcessing(false); return null; }`)
  i `:337-340` (catch) — zgodnie z audytem, brak jakiegokolwiek stanu błędu.
- `CanvasAIFloatingMenu.tsx:228-237` (`handleQuickAction`) i `:252-257` (`handleCustomPrompt`) —
  wołają `onAIRequest(...)` i **ignorują wartość zwracaną** (`await onAIRequest(...)` bez `if`).
  Dotyczy to pozycji #19 (custom prompt), #20-21 (Condense/Expand), #23-24 (Ton), #27-37
  (10 pozycji „Akcje") — dla nich D-1 jest w pełni potwierdzony: użytkownik nie dostaje
  ŻADNEGO sygnału o błędzie.

Kontrdowód dla części zakresu — pozycja **#25 „Wyjaśnij"** (którą audytor sam wymienił w
zakresie „#19-25"):
- `CanvasAIFloatingMenu.tsx:242-250` (`handleExplain`) — **jawnie** obsługuje błąd:
  `setExplainState(text ? { status: 'done', text } : { status: 'error' })`.
- `CanvasAIFloatingMenu.tsx:359-363` — renderuje przy `status === 'error'` widoczny komunikat
  `t('canvas.aiMenu.explainError', 'Could not get an explanation. Please try again.')` w
  czerwonym tekście wewnątrz popoveru.
- To jest realna, widoczna informacja zwrotna — zaprzecza zdaniu audytora „Brak JAKIEJKOLWIEK
  informacji zwrotnej dla użytkownika przy błędzie" zastosowanemu do całego zakresu #19-25/27-37,
  bo #25 należy do tego zakresu i akurat ma pełną obsługę.

Sprawdziłem też alternatywne drogi komunikacji błędu ogólnie w apce: brak globalnego
interceptora `fetch` pokazującego toast przy nie-2xx (`grep -rn "window.fetch\s*="` — jedyne
realne monkey-patche to `RouteErrorBoundary.tsx`/`ErrorBoundary.tsx` (dot. renderowania, nie
sieci), `NetworkBuffer.ts` (telemetria feedbacku, nie UX) i plik demo/harness
`CaseWorkspace/podglad/main.tsx`). Więc dla #19-21/23-24/27-37 błąd naprawdę ginie bez śladu —
audytor ma rację co do mechanizmu, tylko przesadził z „wszystkie".

**Poprawiona klasa/opis:** P1 pozostaje zasadne (10+ akcji naprawdę milczy przy błędzie — to
wystarczy do klasy P1 „widoczna funkcja martwa/urwana" przy przekroczeniu limitu 8000 znaków),
ale opis powinien brzmieć: „Wszystkie akcje AI menu pływającego OPRÓCZ „Wyjaśnij" (poz. #19-21,
23-24, 27-37) milczą przy błędzie; „Wyjaśnij" (#25) poprawnie pokazuje komunikat błędu w
popoverze."

**Jedno zdanie dla właściciela:** większość przycisków AI w menu nad zaznaczonym tekstem (Rozwiń,
Skróć, Ton, 10 pozycji w „Akcje") po prostu nic nie robi przy błędzie i wygląda jakby zawisła —
tylko „Wyjaśnij" pokazuje komunikat, że coś poszło nie tak.

---

## 3. C_naglowek_historia.md D-1 — „Akcje biznesowe" nie renderuje się na `/chat` (brak propsa)

**Werdykt: POTWIERDZONY** (z mocniejszym dowodem niż podał audytor — defekt jest szerszy)

Zweryfikowałem WSZYSTKIE miejsca montowania `<UnifiedChatPanel` w całym `src/`
(`grep -rn "<UnifiedChatPanel" src/`, 10 trafień) oraz WSZYSTKIE miejsca użycia
`onNavigateToActions` w całym `src/` (`grep -rn "onNavigateToActions" src/`, 4 trafienia):

- Prop `onNavigateToActions` istnieje TYLKO wewnątrz `UnifiedChatPanel.tsx` samego —
  deklaracja typu (`:745`), destrukturyzacja (`:798`) i użycie w warunku renderu (`:6786`,
  `:6793`). **Żaden z 9 pozostałych plików montujących `UnifiedChatPanel`** (`SplitLayout.tsx`
  x2, `AIConsultantPanel.tsx`, `ChatOverlay.tsx`, `WorkCanvasShell.tsx`, `FreeAssessmentView.tsx`,
  `MainLayout.tsx`, `Module1ContextView.tsx`, `AIChatView.tsx`, plus `AppRoutes.tsx` x2) nie
  przekazuje tego propsa — nie tylko trasa `/chat` (`AppRoutes.tsx:1778`), ale kompletnie
  WSZĘDZIE w aplikacji.
- Potwierdzone `ROUTES.AI_CHAT === '/chat'` (`src/routes/routeConfig.ts:31`), więc
  `AppRoutes.tsx:1778` faktycznie obsługuje trasę `/chat`.

To oznacza, że przycisk „Akcje biznesowe" jest martwy w skali całego produktu, nie tylko na
tym jednym ekranie — audytor miał rację co do mechanizmu (brak propsa), ale nie zauważył, że
brak propsa jest uniwersalny, więc realna klasa bliżej `MARTWY`/martwej funkcji niż wąsko
rozumiany `NIEWIDOCZNY` per-trasa.

**Jedno zdanie dla właściciela:** przycisk „Akcje biznesowe" (teczka) w nagłówku czatu nie
istnieje nigdzie w aplikacji — kod na niego pozwala, ale żaden ekran nie podaje mu adresu,
gdzie ma przenieść użytkownika.

---

## 4. D_pole_wpisywania.md D-1 — „Zarządzaj źródłami w chmurze" to atrapa (brak OAuth)

**Werdykt: POTWIERDZONY** (z dodatkowym, ważnym kontekstem, który zmienia trudność naprawy)

Potwierdzenie rdzenia zarzutu:
- `server/src/routes/cloud.routes.ts:82-113` (`POST /sources`) — waliduje TYLKO `provider` i
  `name` (`if (!provider || !name) return res.status(400)...`); `accessToken`/`refreshToken`
  są opcjonalne i nigdzie nie są wymagane przed zapisem źródła jako „connected".
- `CloudDataSettings.tsx:162-171` (`openInProvider`) — `window.open(url, '_blank', ...)` na
  stronę główną dostawcy, zero przepływu logowania.

Ważne dopełnienie (czego audytor nie sprawdził — realny mechanizm transferu plików ISTNIEJE,
tylko jest odcięty od tego ekranu):
- `server/src/services/cloudDataService.ts` ma w pełni zaimplementowane, realne wywołania do
  `googleapis.com/drive/v3` (linie 167-274, 426), `graph.microsoft.com` (460-550) i
  `dropboxapi.com` (569-655) — to NIE jest w 100% fikcja, mechanizm transferu jest prawdziwy.
  Ale każda z tych funkcji ma na wejściu strażnika: `if (!source.accessToken) throw new Error('Google Drive access token not configured')` (linie 403, 460, 495, 539, 565, 610, 648) —
  więc źródło utworzone przez opisany atrapowy formularz (bez tokenu) wywali błąd przy KAŻDEJ
  próbie realnego użycia (listowanie/pobranie/upload pliku).
- Co ciekawsze: w kodzie ISTNIEJE osobny, prawdziwy silnik OAuth
  (`server/src/services/integrationOAuthEngine.ts`) z zarejestrowanymi konektorami
  `google_drive` (:265-276), `onedrive` (:278-286), `dropbox` (:289-296) — realny
  `authorizeUrl`/`tokenUrl`, funkcje `generateAuthUrl`/`exchangeCode`/`storeTokens`
  (`server/src/routes/settings.routes.ts:2147,2210,2218` — Settings→Integrations, INNY ekran
  niż audytowany). Tokeny z TEGO przepływu trafiają do tabeli `integration_oauth_tokens`
  (`integrationOAuthEngine.ts:676` `INSERT INTO integration_oauth_tokens...`) —
  **kompletnie innej niż `cloud_sources`**, którą czyta `cloudDataService.ts`. Potwierdzone
  brakiem jakiegokolwiek odwołania: `grep -n "integration_oauth_tokens\|getStoredToken" server/src/services/cloudDataService.ts server/src/routes/cloud.routes.ts` → zero trafień.

Wniosek: to nie jest brak IMPLEMENTACJI OAuth w całej apce (jak można by wywnioskować z opisu
audytora) — to przypadek „zbudowane, ale niepodłączone": realny silnik OAuth dla tych samych
3 dostawców istnieje w Ustawieniach→Integracje, ale ekran „Zarządzaj źródłami w chmurze"
dostępny z pola czatu korzysta z zupełnie innej, osobnej (i faktycznie atrapowej) ścieżki
zapisu źródeł. Nie obala to defektu P1 — użytkownik z tego konkretnego ekranu naprawdę nie
połączy się z żadnym dostawcą — ale zmienia szacunek trudności naprawy (nie trzeba pisać OAuth
od zera, trzeba spiąć dwa istniejące mechanizmy).

**Jedno zdanie dla właściciela:** przycisk „Połącz" przy Google Drive/OneDrive/Dropbox w polu
czatu tworzy fikcyjne, „podłączone" źródło bez żadnego logowania — realne pobieranie plików z
Twojego dysku w chmurze przez tę drogę nigdy nie zadziała, mimo że silnik do prawdziwego
logowania istnieje gdzie indziej w Ustawieniach i tylko czeka na spięcie.

---

## 5. E_wiadomosci.md D-1 — „Konwertuj na inicjatywę" = „Zapisz jako decyzję", zero inicjatywy

**Werdykt: POTWIERDZONY** (sprawdzony do końca łańcucha — defekt sięga też serwera)

- `src/components/AIChat/MessageRenderer.tsx:2412` i `:2422` — identyczne
  `onClick={() => handleSaveAsDecision(msg.id, userVisibleContent)}` dla obu przycisków
  („Save as Decision" i „Convert to Initiative"), zero parametru rozróżniającego typ.
- `handleSaveAsDecision` (`src/components/AIChat/UnifiedChatPanel.tsx:5627-5644`) — prop
  przyjmuje wyłącznie `(messageId, content)`, wewnątrz woła
  `Api.saveDeepThinkingDecision({ sessionId, conversationId, content })` — **bez pola `type`**,
  mimo że sam klient API je obsługuje.
- `Api.saveDeepThinkingDecision` (`src/services/Api.ts:2212-2229`) — sygnatura DOPUSZCZA
  `type?: 'decision' | 'initiative'`, ale skoro handler wywołujący nigdy go nie ustawia,
  parametr jest zawsze `undefined`.
- Sprawdziłem do końca serwer: `POST /api/ai/deep-thinking/save-decision`
  (`server/src/routes/ai/deep-thinking.routes.ts:62-141`) — **niezależnie od wartości `type`**
  (`saveType`), zawsze robi dokładnie jeden `INSERT INTO ai_decision_outcomes` (:99-114);
  `saveType` trafia WYŁĄCZNIE jako tag w kolumnie JSON `tags`
  (`JSON.stringify([saveType || 'decision', 'deep_thinking'])`, :112) i do logu metryki
  (`:132`). Żadna tabela `initiatives` nie jest tu w ogóle dotykana — nawet gdyby front wysłał
  `type: 'initiative'`, serwer i tak zapisałby zwykłą decyzję, tylko oznaczoną innym tagiem.

To wzmacnia defekt: problem nie jest tylko „front woła zły handler" (co sugerowałoby prostą
naprawę frontu) — nawet po naprawieniu frontu (przekazanie `type: 'initiative'`) serwer nie ma
kodu tworzącego prawdziwy rekord inicjatywy. Cała funkcja „Konwertuj na inicjatywę" jest fasadą
od przycisku aż po tabelę bazy danych.

**Jedno zdanie dla właściciela:** przycisk „Konwertuj na inicjatywę" pod wynikiem Deep Thinking
zawsze zapisuje zwykłą decyzję — żadna inicjatywa nigdy nie powstaje, bo ani przycisk, ani
serwer nie mają kodu, który faktycznie tworzy inicjatywę.

---

## Podsumowanie werdyktów

| # | Plik | Defekt | Werdykt |
|---|------|--------|---------|
| 1 | A2_kebab_kanwy.md | D-1 (AI on selection / Dodaj element = deterministyczny tekst) | POTWIERDZONY |
| 2 | B_edytor.md | D-1 (akcje AI menu pływającego milczą przy błędzie) | OSŁABIONY — „Wyjaśnij" (#25) ma widoczny komunikat błędu, reszta (#19-21,23-24,27-37) faktycznie milczy |
| 3 | C_naglowek_historia.md | D-1 (Akcje biznesowe nie renderuje się na /chat) | POTWIERDZONY — i szerszy niż zgłoszono (brak propsa w CAŁEJ apce, nie tylko na /chat) |
| 4 | D_pole_wpisywania.md | D-1 (Zarządzaj źródłami w chmurze = atrapa OAuth) | POTWIERDZONY — z zastrzeżeniem: prawdziwy silnik OAuth dla tych samych dostawców istnieje w Ustawieniach, tylko jest niepodłączony do tego ekranu |
| 5 | E_wiadomosci.md | D-1 (Konwertuj na inicjatywę = Zapisz jako decyzję) | POTWIERDZONY — do końca łańcucha, wada jest też po stronie serwera (brak tabeli initiatives w handlerze) |
