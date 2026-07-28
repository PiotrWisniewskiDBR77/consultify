---
temat: Doktryna „na naszych oczach" — co user widzi i kiedy podczas generowania treści (Materiały)
data: 2026-07-27
status: doktryna do akceptu Piotra (opis + rekomendacje; nie wdrożenie)
grounding: kod (grep na `origin/demo`, plik:linia niżej) + `docs/benchmarks/chat-and-ai.md` (Kimi)
powiązane: `Harvard/wdrozenie-100/_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md` (N16, N7),
  `docs/plans/DELIVERABLES_LIGHT_TARGET.md` §11.4, `docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md`
---

# Doktryna „na naszych oczach"

> Piotr (nagranie, N16): „gdy dajemy mu taska, musi mieć UMYSŁ, który zaplanuje co ma być
> w treściach, a potem bierze się do roboty i robi to NA NASZYCH OCZACH — tak jak robią to inni."
> N7: wzorzec Airtable — „opisujemy założenia, z boku zaczyna czat sobie żyć, a tu zaczyna
> się tworzyć dokument."

Ten dokument formalizuje, co to znaczy w praktyce dla trzech formatów Materiałów (Dokument/Word,
Prezentacja/Deck, Arkusz/Excel) i mówi wprost, co z tego DZIEJE SIĘ DZIŚ naprawdę (zweryfikowane
w kodzie na `origin/demo`, nie na podstawie starszych audytów), a co jest tylko postulatem.

**Skrót dla niecierpliwych:** infrastruktura SSE jest realna i w dwóch miejscach robi dokładnie
to, o co chodzi Piotrowi (generowanie dokumentu Word sekcja-po-sekcji; Teresa piszącą na żywo
w Canvasie). W trzecim miejscu (Deck/Excel przez potok V8/Kimi) NIE MA jednostki treści —
jest tylko odpytywanie co 3s o etap mechaniki (`snapshot→plan→preflight→…→materialize`), czyli
user widzi checklistę „zrobiłem infrastrukturę", nie checklistę „napisałem treść". To jest
główna dziura do zamknięcia.

---

## 1. Fazy widoczne dla użytkownika — nazwane, w kolejności

Rozdzielam na TRZY realnie różne dziś ścieżki (mają różny kod, różny stan dojrzałości). Sekundy
są orientacyjne (zależą od modelu/długości), ale KOLEJNOŚĆ i NAZWY faz są tym, co user ma zobaczyć.

### 1A. Dokument Word — Document Studio, Tryb 1 (Czysto/Z AI, bez szablonu)
Kod: `server/src/routes/document-studio.routes.ts:785-918` (SSE `/generate/stream`),
`src/components/DocumentStudio/DocumentStudioView.tsx:313-408` (orkiestracja faz FE),
`src/components/DocumentStudio/DocumentStudioOutlinePanel.tsx`,
`src/components/DocumentStudio/DocumentStudioGeneratingPanel.tsx`.

| Sekunda | Faza (nazwa) | Co user widzi | Zdarzenie/kod |
|---|---|---|---|
| 0 | **Przyjąłem zadanie** | formularz intake znika, spinner „Planning the outline…" | `POST /document-studio/plan` |
| ~2–5 | **Oto plan, N sekcji** | pełna lista sekcji (tytuł + `purpose` + `expectedLengthHint`), przycisk „Generate document" | `DocumentStudioOutlinePanel.tsx` (fazа `outline`) |
| po kliknięciu „Generate" | **Zaczynam pisać** | panel generowania, pasek postępu 0/N, 3 wiersze-szkielety | `DocumentStudioGeneratingPanel.tsx:36-82`, event `plan` (SSE) |
| 10…30…N | **Sekcja k gotowa** | wiersz `k` zmienia się ze szkieletu (pulsujące belki) na ✓ + realny tytuł, pasek rośnie | event `section` (SSE), `document-studio.routes.ts:866-876` |
| koniec | **Gotowe, oto dokument** | nawigacja do edytora dokumentu z pełną treścią | event `done`, `DocumentStudioView.tsx:327-334` |

To jest DOKŁADNIE wzorzec z N16/N7 i z benchmarku Kimi (`docs/benchmarks/chat-and-ai.md` §2:
„Task Progress 6/6", split-view). Różnica względem Kimi: u nas plan to LISTA SEKCJI w panelu,
nie czat obok — ale idea (widoczny plan → widoczny postęp per jednostka) jest ta sama.

### 1B. Dokument Word — Tryb 3 (z szablonu, „Use template")
Ta sama trasa SSE, ale `DocumentStudioView.tsx:417-421` pomija fazę `outline` — leci prosto do
`generating`. User NIE widzi planu przed startem pisania (patrz §2 — to jest świadome uproszczenie
dla trybu „mam już strukturę z szablonu", ale warto to nazwać wprost, bo różni się od trybu 1).

### 1C. Teresa pisze W Canvasie (czat → dokument otwarty w edytorze)
Kod: `src/components/AIChat/UnifiedChatPanel.tsx:3488` (emisja `canvas-stream-request`),
`src/components/AIChat/WorkCanvasDocumentPanel.tsx:2038-2061` (nasłuch),
`src/components/AIChat/CanvasEditor/useCanvasAIStream.ts` (cała logika).

| Sekunda | Faza | Co user widzi | Kod |
|---|---|---|---|
| 0 | **Przyjąłem prompt** | edytor blokuje się do edycji (`editor.setEditable(false)`), kursor ustawiony na pozycji wstawiania | `useCanvasAIStream.ts:276-279` |
| ~1 | **Piszę** | tekst pojawia się chunk-po-chunku DOKŁADNIE w miejscu kursora (nie w losowej selekcji) | `useCanvasAIStream.ts:340-360`, `/api/ai/chat/stream` |
| w trakcie | (brak nazwanej fazy pośredniej — ciągły strumień) | rosnący tekst, bez wskaźnika „ile zostało" | — |
| koniec | **Porządkuję** | krótki, niewidoczny dla usera krok: zamiana tekstu-projekcji na sparsowane bloki (nagłówki/listy renderują się poprawnie), potem odblokowanie edytora | `useCanvasAIStream.ts:394-422` |

Uwaga: tu NIE MA fazy „oto plan" — Teresa zaczyna pisać od razu po promptcie. To jest zgodne
z trybem „append/generate" (kontynuacja/dopisanie), gdzie plan nie ma sensu (nie ma z góry znanej
struktury sekcji). Dla trybu „patch" (chirurgiczna edycja fragmentu) jest zupełnie inna, NIE-streamowana
ścieżka (`/api/ai/chat/quick`, `useCanvasAIStream.ts:172-247`) — user widzi wynik od razu, bez
progresywnego pisania (uzasadnione: to punktowa poprawka, nie generowanie od zera).

### 1D. Deck/Excel — potok V8 (Kimi Workspace)
Kod: `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts:78-127`,
`src/hooks/useV8Execution.ts:35` (`refetchInterval: runId ? 3000 : false`).

| Sekunda | Faza | Co user widzi | Kod |
|---|---|---|---|
| 0 | Capture context snapshot | krok 1/8 „running" | `PIPELINE_STEPS[0]` |
| ~3, ~6, ~9… | Create plan → Preflight → Accept → Review → Approve → Materialize → Generate content | kolejne kroki 2-8 zmieniają się z „pending" na „running"/„completed" co ~3s (POLLING, nie SSE) | `useV8Execution.ts:35`, `mapRunToSteps` |
| koniec | artefakt gotowy | podgląd (grid/slajdy) | `loadTabelePreviewByTableId`, `buildWorkbookGridSheets` |

To jest checklista **etapów mechaniki potoku** (snapshot/preflight/approve/materialize — słowa,
które mają sens dla inżyniera, nie dla klienta), NIE checklista **jednostek treści** (slajd 3/10,
kolumna „Marża" policzona). User widzi, że „coś się dzieje", ale nie widzi, CO konkretnie
powstaje — sprzeczne z N16 („na naszych oczach" ma pokazywać TREŚĆ, nie infrastrukturę).

---

## 2. Plan przed treścią — czy widoczny i czy dotykalny

Piotr (N16): „umysł zaplanuje CO ma być, a POTEM bierze się do roboty" — plan ma poprzedzać pisanie.

**Stan dziś:**
- Dokument Tryb 1: plan JEST widoczny (`DocumentStudioOutlinePanel.tsx`) i user musi kliknąć
  „Generate document", żeby ruszyło pisanie — więc jest bramka, ale plan jest **tylko do
  odczytu**: nie da się zmienić tytułu sekcji, kolejności, dodać/usunąć sekcji. Jedyna interakcja
  to „Back" (cofnij do intake i zacznij od nowa z innym wejściem) albo „Generate" (zatwierdź
  jak jest).
- Dokument Tryb 3 (szablon): plan wcale się nie pokazuje — generowanie startuje natychmiast.
- Canvas (Teresa append/generate): nie ma planu w ogóle — to naturalne dla dopisywania, ale
  dla trybu `generate` (pisanie od zera w pustym dokumencie) brak planu jest niespójne z zasadą.
- Deck/Excel (V8): nie ma etapu „oto plan treści" widocznego userowi — `useKimiArtifactPipeline`
  ma krok `plan` (`ArtifactRunPlan`), ale to jest PLAN TECHNICZNY potoku (co ma zrobić backend),
  a nie plan TREŚCI (jakie slajdy/kolumny powstaną) pokazany do wglądu przed materializacją.

**Rekomendacja:** plan powinien być **widoczny zawsze** (żaden tryb, łącznie z „z szablonu", nie
powinien pomijać pokazania struktury — nawet na 1 sekundę, ekran przejściowy „Oto X sekcji z
szablonu Y" jest tani do zrobienia i domyka spójność) i **edytowalny co najmniej na poziomie
listy** (usuń sekcję / zmień kolejność / zmień tytuł) — NIE pełny WYSIWYG edytor planu, to
zbyt drogie na ten tydzień. Uzasadnienie: koszt edytowalnej listy (drag+usuń+rename) jest niski
(to jest ten sam komponent co `DocumentStudioOutlinePanel`, dodajemy inputy i `onChange`), a
korzyść — user łapie zły kierunek PRZED 30 sekundami czekania na złą treść, nie PO.
Pełna edycja treści planu (dopisywanie własnych sekcji z opisem) — faza późniejsza.

---

## 3. Jednostka postępu per format

| Format | Jednostka | Stan dziś | Uzasadnienie |
|---|---|---|---|
| **Dokument (Word)** | **Sekcja** | ✅ REALNE — `section` SSE event, 1:1 z `DocumentSection` | Dokument jest z natury liniowy (spis treści = kolejność sekcji) |
| **Prezentacja (Deck)** | **Slajd** (proponowane) | ❌ nie istnieje — deck materializuje się w całości, brak hooków `onSlide` analogicznych do `onSection` | Slajd to naturalny, już istniejący atom danych (`DeckStyler.ts` operuje na bulletach per slajd) — najmniejszy krok to dodać `onSlide(index,total,title)` hook w miejscu, gdzie dziś powstaje cały deck naraz |
| **Arkusz (Excel)** | **Warstwa**: założenia → model → wyniki → wykresy (proponowane) | ❌ nie istnieje — brak dedykowanego generatora arkusza z etapami; dziś to jeden strzał LLM przez wspólny potok V8 | Arkusz NIE powstaje liniowo (nie ma „sekcji"), ale POWSTAJE w naturalnych warstwach: (1) dane wejściowe/założenia, (2) formuły/model obliczeniowy na tych danych, (3) wynikowe wiersze/tabele, (4) wykresy nad wynikami. To jest kolejność, w jakiej i tak trzeba to policzyć (wykres nie istnieje bez wyników, wyniki nie istnieją bez modelu) — więc jednostka progresu pokrywa się z kolejnością wykonania, nie jest sztuczna |

Dla Deck/Excel warstwa/slajd to dziś TYLKO propozycja jednostki — wymaga dodania hooków
analogicznych do `onPlan`/`onSection` w miejscu, gdzie te artefakty faktycznie się budują
(dziś tego miejsca de facto nie ma jako osobnego serwisu — building dzieje się wewnątrz
ogólnego kroku `materialize`/`generate` potoku V8, patrz §6).

---

## 4. Zachowanie przy błędzie i przy przerwaniu

**Dokument (SSE `/generate/stream`):**
- Serwer: błąd fatalny → event `error` zamiast HTTP-statusu (nagłówki już wysłane) —
  `document-studio.routes.ts:900-916`.
- Klient: `error` event → `throw new DocumentStreamError` (`api.ts:301-307`) → w
  `DocumentStudioView.runStreamingGeneration` (poza `MissingRequiredSourceError`, które jest
  terminalne i pokazuje komunikat) KAŻDY inny błąd streamu **cicho** uruchamia pełny fallback
  na synchroniczny `/generate` (`DocumentStudioView.tsx:375-383`) — **od zera**, nie od sekcji,
  na której padło. User nie widzi żadnej informacji „strumień padł, generuję ponownie w trybie
  zapasowym" — jeśli fallback się uda, wygląda to jak nic się nie stało (dłuższy czas czekania
  bez wyjaśnienia); jeśli fallback też padnie, user widzi błąd, ale bez kontekstu że to już
  DRUGA próba.
  **To jest cichy fallback w rozumieniu żelaznej zasady projektu** (`CLAUDE.md` „Weryfikuj
  REALNY runtime" / zakaz cichych fallbacków) — dziś złamanej w drobnej, ale realnej formie.
  Rekomendacja: pokazać krótki, nieblokujący komunikat („Strumień przerwany — generuję ponownie…")
  zanim ruszy fallback. Tani fix (jeden `setError`/toast przed `generateDocumentStudioArtifact`).
- Wznowienie OD MIEJSCA przerwania (np. od sekcji 3/7) **nie istnieje** — architektura tego nie
  wspiera (`materializeDocumentArtifact` nie ma checkpointów per-sekcja do wznowienia, tylko
  hooki-obserwatory). To jest świadomy koszt do zaakceptowania: pełne wznowienie wymagałoby
  trwałego stanu generacji (co dziś nie istnieje) — realistyczne minimum to PEŁNY retry z jasną
  informacją, nie milczący.
- Przerwanie przez usera: brak przycisku „Stop" w `DocumentStudioGeneratingPanel.tsx` — jedyny
  sposób przerwania to zamknięcie karty/nawigacja (co zamyka SSE połączenie po stronie klienta,
  `req.on('close', …)` po stronie serwera sprząta poprawnie, ale generacja po stronie serwera
  (LLM-wołania) może kontynuować się „w tle" bez konsumenta — brak `AbortController` przekazanego
  do `materializeDocumentArtifact`).

**Canvas (Teresa pisze w edytorze):**
- Przycisk „Stop" ISTNIEJE (`stopStream` w `useCanvasAIStream.ts:123-131`) i realnie przerywa
  fetch przez `AbortController` — to jest wzorcowe zachowanie, WARTE skopiowania do Document
  Studio.
- Błąd sieci/parsowania → `onError` callback, komunikat widoczny userowi (nie cichy) —
  `useCanvasAIStream.ts:439-451`.
- Zamknięcie panelu mid-stream aborta fetch (`useEffect` cleanup, linia 136-141) — poprawne.

**Deck/Excel (potok V8):**
- Stan `failed`/`rejected`/`cancelled` jest w modelu (`deriveEffectiveStatus`,
  `useKimiArtifactPipeline.ts:41-76`) i jest widoczny w UI jako status kroku — retry istnieje
  jako osobna mutacja `useV8RetryArtifactRun`. To jest NAJLEPSZY z trzech pod względem
  przejrzystości błędu (bo to explicit state machine z bazą danych, nie efemeryczny SSE), ale
  najsłabszy pod względem WIDOCZNOŚCI TREŚCI po drodze (§1D, §3).

**Wniosek do zasady projektu:** żaden z trzech formatów nie łamie zasady „zero cichych
fallbacków" w sposób jaskrawy, ALE Document Studio ma jeden realny, konkretny cichy fallback
(retry na sync bez komunikatu) — to jest punkt do naprawy w tym tygodniu (§7), bo to dokładnie
wzorzec, który już raz kosztował projekt zaufanie (patrz `CLAUDE.md` „Testy przeszły ≠ działa" /
zakaz cichych fallbacków).

---

## 5. Co pokazujemy o źródłach w trakcie

**Chat (Teresa rozmowa, `/api/ai/chat/stream`):** REALNY, bogaty system — event `trust_bundle`
niesie `citations`, `sourceClasses`, `sourceLedgerSummary`, `policyDecision`
(`server/src/routes/ai.routes.ts:2659-2730`+). To dokładnie to, o czym mówi benchmark Kimi/
Perplexity (§2 `chat-and-ai.md`: „cytowania inline") — i u nas to działa w warstwie CZATU.

**Dokument (Document Studio SSE):** dane SĄ w kształcie do pokazania — `DocumentBlock.sourceRef`
i `DocumentSection.sourceRefs` istnieją w schemacie (`src/components/DocumentStudio/types.ts:85-126`)
i `blocks` (z `sourceRef` per blok) jest częścią payloadu eventu `section`
(`document-studio.routes.ts:866-876`) — **ale `DocumentStudioGeneratingPanel.tsx` ich nie
renderuje**. User widzi tytuł sekcji i ✓, nie widzi „ta sekcja oparta na: Wywiad #4, Insight #12".
To jest czysto kosmetyczny brak (dane już płyną przez SSE) — tani do domknięcia.

**Canvas (Teresa pisze w edytorze):** `canvasContextPacket` jedzie do `/chat/stream`
(`useCanvasAIStream.ts:312-317`), ale strumień do Canvasa konsumuje tylko `content`/`text`/`delta`
(linia 350) — **odrzuca** `trust_bundle`/`citations`, które ten sam endpoint potrafi wysyłać w
trybie czatu. Więc źródła istnieją w backendzie, ale FE Canvasa ich nie odbiera.

**Deck/Excel (V8):** brak odpowiednika — `factRefs`/cytowania istnieją gdzieś indziej w systemie
(np. `drdReportGenerator.ts`, `financeConclusionService.ts`), ale nie są częścią widocznego
strumienia postępu artefaktu w Kimi Workspace.

**Rekomendacja:** to jest nasza faktyczna przewaga (liczby ugruntowane w danych klienta, nie
halucynacje) i dziś jest NIEWIDOCZNA tam, gdzie klient patrzy na budowanie treści. Najtańszy
krok: dociągnąć `sourceRef`/`sourceRefs`, które już płyną przez `section` event, do
`DocumentStudioGeneratingPanel` jako mały chip pod tytułem sekcji.

---

## 6. Stan dzisiejszy vs docelowy

| Co | Stan dziś | Dowód (plik:linia) | Ocena |
|---|---|---|---|
| SSE dla generowania dokumentu Word (plan+sekcje) | **REALNE, wpięte, bez flagi** | `server/src/routes/document-studio.routes.ts:785-918`; FE: `src/components/DocumentStudio/DocumentStudioView.tsx:313-408`, `DocumentStudioGeneratingPanel.tsx` | ✅ działa |
| Plan (outline) widoczny przed pisaniem (Tryb 1) | **REALNE** | `DocumentStudioOutlinePanel.tsx` (faza `outline`, `DocumentStudioView.tsx:433`) | ✅ działa, ale read-only (§2) |
| Plan pominięty w Trybie 3 (szablon) | REALNE zachowanie (świadome uproszczenie) | `DocumentStudioView.tsx:417-421` | ⚠️ niespójne z zasadą — do naprawy |
| `canvas-stream-request` → Teresa pisze na żywo w edytorze | **REALNE — NAPRAWIONE od audytu 06-10.** Audyt `docs/audit/2026-06-10/DOC_ENTRY_UX_AUDIT.md` i `docs/plans/DELIVERABLES_LIGHT_TARGET.md:246` nazywały to „cichym no-op" — **to jest NIEAKTUALNE**, kod dziś realnie wstawia streamowane chunki do TipTap z poprawnym pozycjonowaniem, blokadą edytora, rekoncyliacją markdown na końcu | `src/components/AIChat/CanvasEditor/useCanvasAIStream.ts` (cały plik, zwł. 143-458), nasłuch: `WorkCanvasDocumentPanel.tsx:2038-2061`, emisja: `UnifiedChatPanel.tsx:3488` | ✅ działa (audyt starzeje się w tygodnie — patrz `CLAUDE.md` złota reguła #1) |
| Przycisk Stop podczas streamu (Canvas) | **REALNE** | `useCanvasAIStream.ts:123-131` (`stopStream`, `AbortController`) | ✅ działa |
| Przycisk Stop podczas streamu (Document Studio) | **BRAK** | brak `AbortController` przekazanego do `materializeDocumentArtifact`; `DocumentStudioGeneratingPanel.tsx` nie ma przycisku | ❌ brak |
| Cichy fallback SSE→sync przy błędzie (Document Studio) | **REALNE, bez komunikatu dla usera** | `DocumentStudioView.tsx:375-383` | ⚠️ narusza zasadę „zero cichych fallbacków" |
| Cytowania/źródła w strumieniu czatu (`trust_bundle`) | **REALNE, bogate** | `server/src/routes/ai.routes.ts:2659 nn.` | ✅ działa (w czacie) |
| Źródła (`sourceRef`) widoczne PODCZAS pisania dokumentu | Dane płyną w SSE, ale **UI ich nie renderuje** | dane: `document-studio.routes.ts:866-876` + `types.ts:85-126`; UI: `DocumentStudioGeneratingPanel.tsx` (brak renderu) | ⚠️ kosmetyczna dziura, tani fix |
| Jednostka postępu treści dla Deck | **BRAK** — tylko etapy potoku (snapshot/plan/preflight/…/materialize) co 3s | `useKimiArtifactPipeline.ts:78-127`, `useV8Execution.ts:35` | ❌ brak |
| Jednostka postępu treści dla Excel/Sheet | **BRAK** — jak wyżej, brak nawet dedykowanego serwisu generującego (jeden strzał LLM przez wspólny potok V8) | jw.; brak wyników na `materializeSheetArtifact`/`SheetGenerator` w repo | ❌ brak |
| Plan treści widoczny przed materializacją Deck/Excel | **BRAK** — `ArtifactRunPlan` to plan TECHNICZNY potoku, nie plan treści do wglądu | `useKimiArtifactPipeline.ts` (krok `plan`) | ❌ brak |

---

## 7. Minimalna wersja do wdrożenia w tym tygodniu (80% efektu, najmniejszy koszt)

W kolejności malejącego stosunku efekt/koszt:

1. **Zablokuj cichy fallback w Document Studio (§4).** Jeden `toast`/`setError` nieblokujący
   przed uruchomieniem `generateDocumentStudioArtifact` w catch-bloku `runStreamingGeneration`.
   Koszt: kilka linii. Efekt: usuwa jedyne realne naruszenie „zero cichych fallbacków" znalezione
   w tym audycie.
2. **Pokaż `sourceRef` per sekcja w `DocumentStudioGeneratingPanel` (§5).** Dane już płyną przez
   SSE (`section.blocks[].sourceRef`) — brakuje tylko małego chipa pod tytułem. Koszt: jeden
   komponent, zero zmian backendu. Efekt: pokazuje przewagę „liczby ugruntowane" dokładnie w
   momencie, gdy user na to patrzy.
3. **Dodaj przycisk Stop do `DocumentStudioGeneratingPanel`** (kopiuj wzorzec `stopStream` z
   `useCanvasAIStream.ts`). Koszt: przekazać `AbortController` przez `generateDocumentStudioArtifactStream`
   (już przyjmuje `signal` — `api.ts:252`) do UI. Efekt: parytet z Canvasem, spełnia „przerwanie
   widoczne dla usera" z §4.
4. **Nie pomijaj planu w Trybie 3 (szablon) — pokaż go na 1 ekran, nawet bez edycji (§2).**
   Reużyj `DocumentStudioOutlinePanel` z sekcjami z szablonu zamiast przeskakiwać prosto do
   `generating`. Koszt: przestawienie jednej gałęzi w `handleIntakeSubmit`. Efekt: spójność
   zasady „plan zawsze widoczny" bez dodatkowego kodu UI.

Pełniejsze, ale droższe (NIE na ten tydzień — do zaplanowania osobno):
- Edytowalna lista planu (usuń/reorder/rename sekcję) — wymaga nowego stanu w
  `DocumentStudioOutlinePanel` + walidacji po stronie `handleGenerate`.
- Jednostka `onSlide` dla Deck — wymaga wydzielenia generowania treści slajdów z potoku V8 do
  osobnego kroku z hookami (analogicznie do `materializeDocumentArtifact`), co jest realną
  robotą architektoniczną, nie kosmetyką.
- Jednostka „warstwa" dla Excel — jak wyżej, plus zaprojektowanie samych warstw (dziś nie istnieją
  jako pojęcie w kodzie generatora arkusza).
- Odbiór `trust_bundle`/cytowań w Canvasie (dziś strumień do edytora ignoruje ten typ eventu) —
  wymaga rozszerzenia `useCanvasAIStream.ts` o obsługę drugiego typu payloadu i miejsca w UI
  do ich pokazania (np. margines/adnotacja przy wstawionym akapicie).
