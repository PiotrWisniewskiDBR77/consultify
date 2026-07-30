# HANDOFF — narzędzia IDEE, odbiór i naprawy (2026-07-28 → 29)

> Dokument dla następcy przejmującego pracę. Czytaj w całości przed pierwszą zmianą w kodzie.
> Stan na: 2026-07-29, demo `e62623cb99` (zweryfikowane żywym `/api/health`, nie z gita).

---

## 1. MISJA — co realizowałem

**Punkt wyjścia.** Piotr przeklikał na żywo cztery narzędzia modułu IDEE (Mapa myśli ·
Tablica · Proces · Tabela) i zgłosił **51 uwag**, jedna po drugiej, z wyraźnym poleceniem:
*„robimy po prostu przeklikiwany odbiór. Ja tobie wrzucam uwagi i ty lotujesz, a później
z tych notatek zrobisz program, kompletny program naprawczy."*

**Dyrektywa nadrzędna właściciela** — obowiązuje dalej:
> *„generalnie chcemy robić możliwie dużo nawigacji i zasad pracy wspólnie i identycznie"*

Lewy pasek, prawy panel, górne menu i dolny pasek mają być zbudowane **identycznie we
wszystkich czterech narzędziach — jedna implementacja, nie cztery kopie.**

**Co z tego powstało:**
1. Program naprawczy (`_PROGRAM_NAPRAWCZY_IDEE_2026-07-27.md`) — 48 pozycji, po trzech
   audytach adwersaryjnych (v1 → v2 → v3.1).
2. Przebudowa powłoki — **38 z 48 pozycji**, na demo, 7 flag domyślnie ON.
3. Runda odbioru na żywo → trzy duże tematy (IDE-025/026/027), wszystkie domknięte.
4. Poszukiwanie zgłoszeń zewnętrznego testera → odkrycie, że **system zgłoszeń gubi zgłoszenia**.

---

## 2. STAN NA DEMO

Wdrożone i **domyślnie włączone** (7 flag powłoki):
`ff_ideaTopBarOneLine` · `ff_ideaPanel6Sections` · `ff_ideaBottomBarUnified` ·
`ff_canvasObjectEditBar` · `ff_ideaTableGuidedBar` · `ff_canvasUndoInRailOnly` ·
`ff_whiteboardSessionInPanel`

> ★ Właściciel **świadomie** wybrał włączenie wszystkich naraz, wbrew mojej rekomendacji
> i wbrew regule #9 z `CLAUDE.md`. Zgłosiłem ryzyko, podtrzymał. Nie „poprawiaj" tego.

Droga odwrotu — **pojedynczą część gasi się adresem**, bez wdrożenia:
`?ff_ideaTopBarOneLine=0` (analogicznie pozostałe).

**Punkty cofania (tagi):**
| tag | co to jest |
|---|---|
| `demo-safe-2026-07-28-trzy-tematy` | ostatni stan zaakceptowany, PO naprawach IDE-025/026/027 |
| `demo-rollback-pre-trzy-tematy-2026-07-28` | przed tymi trzema naprawami |
| `demo-safe-2026-07-28-powloka` | po przebudowie powłoki, przed trzema tematami |
| `demo-rollback-pre-idee-powloka-2026-07-28` | przed całą przebudową powłoki |

Cofanie: **nigdy force-push na demo.** Procedura w `Harvard/wdrozenie-100/_RUNBOOK_COFANIA.md`.

---

## 3. CO ZOSTAŁO ZROBIONE W OSTATNIEJ RUNDZIE (trzy tematy)

### IDE-027 — wybór narzędzia ginął przy tworzeniu Idei *(regresja, wracała 2×)*
Objaw: wybierasz „Schemat procesu", dostajesz Mapę myśli.

**Łańcuch czterech ogniw** — każde z osobna wyglądało rozsądnie, dlatego dwie wcześniejsze
„naprawki" (dokładające kolejne siatki bezpieczeństwa) nie pomogły:
1. `patchIdeaWorkspaceState` — strażnik „bez zmian" NIE zakłada wpisu, gdy łatka jest równa
   stanowi domyślnemu. Dla świeżej Idei jest równa **co do joty**.
2. `moveIdeaWorkspaceState` — zaczynał od `if (!current[fromId]) return`, więc przeniesienie
   na prawdziwy identyfikator było **ciche**.
3. `handleDocumentSaved` — `data: updatedData` **nadpisywało** całe dane dokumentu rekordem
   z serwera, który nie zna `initialTool`.
4. `activeTool = stan?.activeTool || ideaActiveTool` — awaryjne `||` **nigdy nie strzelało**,
   bo stan domyślny zawsze się produkuje i zawsze jest prawdziwy (`'mindmap'`).

Naprawa: ogniwa 2 i 3. Bezpiecznik: **4 testy, po jednym na ogniwo** (pojedynczy test na
„efekt końcowy" już raz to przegapił). Zweryfikowane obalaniem: po cofnięciu naprawy test pada.
Szkoda w danych: **jeden rekord**, migracji nie trzeba.

### IDE-026 — automatyczne przybliżenia
Pomiar przed naprawą: samo kliknięcie **nie zmieniało zoomu** (44,00% → 43,94%) — winowajcą
była któraś z **dwudziestu kilku** innych ścieżek kadrujących w Mapie myśli.

Rozwiązanie: **jeden sufit na wejściu** — opakowany `fitView` w `IdeaRecommendationMap`
(hook `useMindMapNodes` dostaje ten sam uchwyt, więc obejmuje też jego 6 wywołań).
Zasada: kadrowanie automatyczne może **oddalić**, nigdy nie przybliża. Jawne polecenia
(pierwsze otwarcie · „Dopasuj widok" · Auto-układ) przekazują `jawne: true`.

Przepływ i Tablica kadrują **wyłącznie** na jawne polecenie — tam nie było czego wyłączać.

### IDE-025 — wielkie okno szczegółów do prawego panelu *(flaga OFF!)*
Inwentarz **obalił moje własne założenie**: nie ma czterech implementacji do zunifikowania.
Jest **jeden** wspólny `UnifiedNodeDetailDrawer` (2101 linii). Problemem była PREZENTACJA
(`fixed top-0 right-0 bottom-0 w-[420px]`), nie duplikacja.

Zrobione: slot w sekcji „Właściwości", portal, tryb sterowany prawego paska (API istniało
w `ExecutiveModuleShell`, nie było przepuszczone przez `IdeaCanvasMelsView`), plus zgaszenie
**dwóch dubli wychwyconych wzrokiem na zrzucie**: nazwa elementu powtarzała się trzy razy,
a po jej usunięciu został pusty nagłówek karty.

> ★ **`ff_ideaDetailsInPanel` jest domyślnie OFF.** Właściciel NIE widział jeszcze tego
> układu (reguła #7: Piotr nigdy nie jest pierwszym testerem wizualnym). Podgląd:
> `?ff_ideaDetailsInPanel=1`. **Pierwsze zadanie następcy: pokazać mu to i zapytać
> o włączenie na stałe.**

---

## 4. OTWARTE — kolejka dla następcy

### Priorytet 1 — zgłoszenia z sesji testera (29.07)
**FB-002 · okno zgłaszania błędów gubi zgłoszenia** ← *moja rekomendacja: to pierwsze*
Tester zgłosił 3 błędy, do bazy dotarł **1**. Dowód: `feedback_items` = 1 wiersz z 7 dni,
`api_logs` = dokładnie 1 `POST /api/feedback` (200), **zero** prób nieudanych — czyli dwa
zgłoszenia nigdy nie opuściły przeglądarki.

Przyczyna w `src/components/Feedback/FeedbackSidePanel.tsx`: formularz ma sześć pól
(Tytuł · Opis · Kroki · Oczekiwane · Faktyczne · Wpływ), ale wysyłkę blokuje **wyłącznie**
puste pole „Opis" — `disabled={isSubmitting || !message.trim()}` (~1063) plus ciche
`if (!message.trim()) return;` (~467). **Nic nie mówi, które pole blokuje.** Zero zapisu
roboczego (`grep localStorage` w tym pliku = 0 trafień), więc zamknięcie panelu = utrata treści.

Dopóki to żyje, **każda sesja testowa może po cichu gubić zgłoszenia**.

**FB-001 · czat: rozmowy nachodzą na siebie**
Jedyne zgłoszenie, które dotarło. Rozmowa z zakończonego czatu nakłada się na nową, klient
nie widzi rozmowy z Teresą. Zgłoszone przy `?tool=whiteboard`, priorytet wysoki.
Trop: brak czyszczenia listy wiadomości przy zmianie `conversationId` — sprawdzić
`UnifiedChatPanel`.

**Dwa opisy są bezpowrotnie stracone** — trzeba poprosić testera o odtworzenie z pamięci.

### Priorytet 2 — reszta programu (10 z 48 pozycji)
- Właściwości **wiersza Tabeli** w prawym panelu — dziś uczciwy pusty stan („pola tego
  wiersza edytujesz w siatce"); wiersz nie jest węzłem grafu, wymaga własnego adaptera.
- Jedno menu kontekstowe zamiast trzech plików *(bug zamykania naprawiony we wszystkich)*.
- 55 kolorów gałęzi — nieuspokojone.
- Convert → Word/PPT/Excel/Notatka — **decyzja właściciela: po domknięciu powłoki**.
- What-if bez kontekstu · podpowiedzi 7 akcji AI · `computeBranchHealth` na odrzuconych
  wagach · stara ścieżka eksportu z lewego paska · 2 martwe kliknięcia w Tabeli ·
  nawigacja na obiektach w Przepływie.
- Drobne: pasek pokazuje **„1 ELEMENTS SELECTED"** — liczba mnoga przy jednym elemencie,
  do tego po angielsku.

---

## 5. ★★★ PUŁAPKI WERYFIKACJI — przeczytaj, zanim coś ogłosisz

Każda z nich dała mi **fałszywy wniosek** w ciągu dwóch dni. Nie powtarzaj ich.

1. **Ekran testowy karmił cztery narzędzia jednym grafem.** `mywork-idea-topbar` podawał
   Tablicy i Przepływowi węzły typu `idea`/`branch`, których te narzędzia nie znają →
   ReactFlow degradował je do typu zastępczego. Płótno wyglądało na sprawne, ale węzły
   nie dawały się zaznaczyć. Napisałem „pasek edycji nie działa w Tablicy" — nieprawda.
   **Sygnał w konsoli: „Node type «X» not found. Using fallback type «default»".** Naprawione.

2. **`tsc --noEmit` NIE obejmuje `dev-render/`.** Sprawdzone celowym błędem: w ekranie
   testowym bramka go NIE złapała (kod 0), w `src/` złapała natychmiast (kod 2).
   Ekrany testowe weryfikuje się uruchomieniem.

3. **Współrzędne kliknięcia licz z DOM, nie z podglądu zrzutu.** Zrzut ma 800×450, okno
   1280×720. Czytałem punkty z powiększonego podglądu i klikałem poza ekranem — stąd wniosek
   „kliknięcie w puste płótno nie odznacza", który był mój, nie produktu.
   Wzór: `Math.round((r.left + r.width/2) * 800 / window.innerWidth)`.

4. **Nie zgaduj przyczyny z kodu — zmierz.** Przy IDE-026 kod wskazywał na sześć podejrzanych
   miejsc; pomiar pokazał, że żadne z nich nie odpalało przy kliknięciu.

5. **`useViewport`/`useStore` MUSZĄ iść z barrela `reactflow`**, nigdy z `@reactflow/core` —
   to osobna instancja magazynu zustand niż ta z `<ReactFlowProvider>`. Mój „czysto techniczny"
   fix importu zabił całe Process Flow czerwonym ekranem mimo zielonych bramek.

6. **Mock w ekranie testowym MUSI być stanowy.** Zamrożony kłamie po pierwszej edycji.

---

## 6. INCYDENT, KTÓRY MOŻE SIĘ POWTÓRZYĆ

Piotr zgłosił „zniknęły wszystkie dane na demo". **Nic nie zostało skasowane** — jego konto
`piotr.wisniewski@dbr77.com` było przełączone na organizację **Atelier Toys**, a wszystkie
jego dane (8 idei, 153 zadania, 3 notatniki, 67 decyzji) leżą w organizacji **DBR77**
(`a3e05d4a-5397-419d-b486-8e44366c0063`).

Moduł „My Work" filtruje po **użytkowniku ORAZ organizacji**. Przełącznik organizacji
(`auth.routes.ts:783`) zapisuje `users.organization_id`. Rozwiązanie: menu profilu → DBR77.

> **To jest też defekt produktu:** pusty stan mówi *„Your Idea Garden awaits — plant your
> first idea"*, kiedy masz 8 idei o jedną organizację dalej. **Pusty stan kłamie** — ani słowa
> o innej organizacji, ani skrótu do przełączenia. Warte osobnego zadania.

---

## 7. DOSTĘPY I NARZĘDZIA

- **Baza demo** = `trolley.proxy.rlwy.net:28146` (`DATABASE_URL` w `.env.staging.local`).
  **Baza PROD** = `centerbeam.proxy.rlwy.net:37823` (`.env.local`) — PROD wymaga
  `ssl:{rejectUnauthorized:false}`, demo działa bez SSL.
- **`psql` NIE jest zainstalowany.** Sondy pisz jako skrypt `.cjs` z `pg` i uruchamiaj
  **z katalogu repo** (w `/tmp` nie widzi `node_modules`). Sprzątaj plik po sobie.
- **Weryfikacja wdrożenia:** `curl -s https://demo.consultify.ai/api/health` — zwraca żywy
  `gitSha`. Nie ufaj samemu gitowi; sprawdź, co realnie stoi.
- **Worktree:** `/private/tmp/idee-3` (gałąź `fix/idee-trzy-tematy-2026-07-28`).
  Świeży worktree **nie ma `node_modules`** — zalinkuj z głównego repo, inaczej vite umiera cicho.
- **Serwer podglądu:** wpis `idee-3-tematy` w `.claude/launch.json`, port 3295.
  Ekran: `?screen=mywork-idea-topbar&tool=mindmap|whiteboard|process_flow|table`.

---

## 8. JAK PRACUJE WŁAŚCICIEL — czytaj to jak instrukcję

- **Komunikacja PO POLSKU, krótko, obrazkami.** Piotr jest właścicielem produktu, nie koderem.
- **Woli klikać niż oglądać zrzuty**, ale reguła #7 jest nienaruszalna: **nigdy nie jest
  pierwszym testerem wizualnym**. Zanim zobaczy ekran — Ty go renderujesz i robisz zrzut sam.
- **Mandat: decyzje techniczne podejmujesz sam i raportujesz.** Piotr = CEO (biznes),
  Ty = CTO. Nie odsyłaj mu do rozstrzygnięcia rzeczy, które są Twoje.
- **Nie zaokrąglaj liczb w górę.** Gdy zapytał „czy wszystko wdrożone", odpowiedź brzmiała
  „38 z 48" z listą braków — i to było dobrze przyjęte. „Gotowe" bez pokrycia niszczy zaufanie.
- **Gdy się mylisz, mów wprost i krótko**, bez rozwlekłego biczowania się. Trzy razy w ciągu
  dwóch dni odwoływałem własny wniosek — za każdym razem wystarczyło jedno zdanie i korekta.
- Piotr pracuje nad tym produktem **rok**. Ma cierpliwość, ale nie do fałszywych „gotowe".

---

## 9. ŹRÓDŁA PRAWDY

- `docs/SOURCE_OF_TRUTH.md` — punkt wejścia do dokumentacji.
- `CLAUDE.md` — reguły nienaruszalne (#5 akcept właściciela · #7 nie pierwszy tester ·
  #9 zakaz masowego włączania flag).
- `Harvard/wdrozenie-100/_PROGRAM_NAPRAWCZY_IDEE_2026-07-27.md` — program 48 pozycji.
- `Harvard/wdrozenie-100/_RAPORT_NOC_IDEE_2026-07-27.md` — raport z nocy napraw.
- `rejestr/3-DO-ODBIORU/IDE-023`, `IDE-024` — karty odbioru powłoki i napraw.
- Pamięć sesji: `memory/powloka-idee-na-demo-2026-07-28.md` (+ indeks `MEMORY.md`).
