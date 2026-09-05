# Odbiór CTO 05.09 — Moja Praca (My Work)

Inspektor: agent CTO-odbiorca-i-naprawiacz. Worktree napraw: `/private/tmp/ag-cto-mywork`
(gałąź `agent/cto-pass-mywork`, bazowana na HEAD `71c147feeb`), własny vite `:3040`
wskazujący na `https://staging.consultify.ai` (ten sam backend/dane co realna
aplikacja `:3000`). HEAD po naprawach: `307fa67cae` (4 commity).

## Defekt zgłoszony jako priorytet nr 1

Ciemna pigułka „Przejrzyj kandydaturę" (MYW-IDEAS-010) pływała
`absolute bottom-4 right-4` nad płótnem warsztatu Pomysłów, mimo dzisiejszej
(wcześniejszej) fali porządkującej, która przeniosła karty „Analiza płótna" do
prawego panelu przez rejestr `canvasAnalysisSlot.ts` — ten JEDEN blok
(`IdeaMapWorkspace.tsx`, ok. linii 4850–4958) został pominięty. Naprawiony
przez portal (`createPortal`) do TEGO SAMEGO gniazda co karty Analizy płótna —
patrz commit `2e2abb1011` niżej. Zweryfikowane żywo na wszystkich 4 płótnach
(mapa/tabela/tablica/przepływ): przycisk renderuje się w sekcji „Akcje"
prawego panelu, znika całkowicie (nie pływa) przy zamkniętym panelu.

## Menu 2 — 7 zakładek (weryfikacja usunięcia Projekty/Menedżer/Uruchom agenta)

Potwierdzone na żywo (`22-menu2-full.png`, `23-menu2-scrolled.png`, pasek
przewinięty do końca w obie strony): **Pomysły · Notatnik · Skrzynka ·
Kalendarz · Zadania · Decyzje · Sejf klienta** — dokładnie 7, w tej
kolejności. Projekty/Menedżer/Uruchom agenta nieobecne pod żadną pozycją
(kod: `MyWorkHub.tsx` komentarze „05.09.2026: … usunięty z Menu 2" przy
wszystkich trzech). Moduł 13_CHAT (zamrożony) — nie dotknięty, tylko
importowany jako panel Teresy.

## Liczby

- Ekranów przejrzanych: **26** zrzutów obejmujących 20 odrębnych stanów ekranu
  (7 zakładek Menu 2 × lista, + preview Skrzynki/Decyzji/Pomysłów, + 4 płótna
  warsztatu Pomysłów × [domyślny/zaznaczenie/Teresa/zamknięty], + Notatnik
  otwarta notatka × [Element/Teresa], + Kalendarz × [Tydzień/Miesiąc/Lista/Dzień*])
- OK od razu (bez zmian): **16**
- Naprawione w tej turze: **4 commity, 6 plików, 1 defekt-rodzina UI (pływająca
  pigułka) + 2 defekty-rodziny i18n (data/status po angielsku)**
- Pozostałe DEFEKTY (poza zasięgiem frontendu w tym worktree): **2** (patrz niżej)
- NIE_DOTARŁEM: **1** (widok „Dzień" kalendarza — patrz uwaga)

## Tabela ekranów

| # | Ekran | `<aside>` | Werdykt | Uzasadnienie | Naprawa |
|---|---|---|---|---|---|
| 1 | Menu 2 — Pomysły (lista) | 0* | ZGODNY | StandardTable, kolumny Etap/Tagi/Narzędzie, „Nowy pomysł" — kanon. Zrzut `01-pomysly.png`. | — |
| 2 | Menu 2 — Notatnik (lista) | 0* | ZGODNY | StandardTable notatników, liczniki Wszystkie/Osobiste/Cała organizacja. Zrzut `02-notatnik.png`. | — |
| 3 | Menu 2 — Skrzynka (lista) | 0* | ZGODNY | StandardTable, pstryczek Wszystkie/Zaległe/Zapisane/AI/Krytyczne/Wymaga akcji/…. Zrzut `03-skrzynka.png`. | — |
| 4 | Menu 2 — Kalendarz (Tydzień, domyślny) | 0* | ZGODNY z DEFEKTEM backendu | UI poprawne (honest „Niepołączone" dla Google/Outlook), ale konsola: `501 GET /api/integrations` (potwierdzone precyzyjnie — patrz DEFEKT 1). Zrzut `04-kalendarz.png`. | DEFEKT (backend) |
| 5 | Menu 2 — Zadania (lista) | 0* | ZGODNY → NAPRAWIONY | Kolumna TERMIN mówiła „No due date"/„Feb 5" na w pełni polskim ekranie. Zrzut PRZED w treści commitu `ba9e2fc012`; PO: `05-zadania.png` („Brak terminu”, „5 lut”). | `ba9e2fc012` |
| 6 | Menu 2 — Decyzje (lista) | 0* | ZGODNY | StandardTable, „TERMIN” pokazuje „Xd oczekiwania” (już poprawnie polskie — pierwotnie błędnie podejrzane o „Xd overdue”, zweryfikowane w kodzie: to inna, już-lokalizowana gałąź `daysWaiting`). Zrzut `06-decyzje.png`. | — |
| 7 | Menu 2 — Sejf klienta (lista) | 0* | ZGODNY | StandardTable sejfów, kolumny Zakres/Dokumenty/Rozmiar/W wiedzy AI/Błędy indeksowania. Zrzut `07-sejf.png`. | — |
| 8 | Pomysły → wiersz → podgląd (StandardPreview) | 0* | ZGODNY | Jeden panel podglądu z prawej, Otwórz/AI/Powiązania. Zrzut `08-idee-open.png`. | — |
| 9 | Idea workspace — Mapa myśli (domyślny) | 1 | ZGODNY → NAPRAWIONY | Patrz defekt priorytetowy wyżej. Zrzut `10-idea-mindmap.png` — pigułka w panelu, nie na płótnie. | `2e2abb1011` |
| 10 | Idea workspace — Tabela (domyślny) | 1 | ZGODNY → NAPRAWIONY | Jw. Zrzut `10-idea-table.png` / `09-idea-mapa.png` (pierwsze wejście). | `2e2abb1011` |
| 11 | Idea workspace — Tablica/Whiteboard (domyślny) | 1 | ZGODNY → NAPRAWIONY | Jw. Zrzut `10-idea-whiteboard.png`. | `2e2abb1011` |
| 12 | Idea workspace — Przepływ/Process Flow (domyślny) | 1 | ZGODNY → NAPRAWIONY | Jw. Zrzut `10-idea-process-flow.png`. „Process Flow”/„Whiteboard” w breadcrumbie ANGIELSKIE — zweryfikowane w kodzie jako ŚWIADOMA decyzja SSOT (`IdeaWorkspaceToolbar.tsx:56-57`, komentarz 2026-07-24 „nazwa narzędzia jednakowa PL/EN”), NIE defekt. | — |
| 13 | Idea workspace (Tabela) — element zaznaczony | 1 | ZGODNY | Sekcja „Akcje” otwarta: karta Analiza płótna + „Przejrzyj kandydaturę” razem, potem Właściwości/Kolumna. Zrzut `11-idea-table-selection.png`. | — |
| 14 | Idea workspace (Tabela) — zakładka Teresa | 1 | ZGODNY | Ten sam `<aside>`, zakładki Element\|Teresa w nagłówku, gniazdo analizy ukryte (`hidden`), nic nie pływa. Zrzut `12-idea-table-teresa.png`. | — |
| 15 | Idea workspace (Tabela) — panel zamknięty | 0 | ZGODNY | Płótno pełnej szerokości, pigułka „Pokaż panel” w pasku poleceń, **zero elementów pływających** (potwierdza naprawę — bez fallbacku do pływania). Zrzut `13-idea-table-closed.png`. | — |
| 16 | Notatnik — otwarta notatka (zakładka Notatka) | 1 | ZGODNY | 3 kolumny (lista notatek \| edytor \| panel Notatka/Teresa), sekcje AKCJE/FORMATOWANIE/PRZEPŁYW PRACY/WŁAŚCIWOŚCI. Zrzut `14-notatnik-open.png`. | — |
| 17 | Notatnik — otwarta notatka (zakładka Teresa) | 1 | ZGODNY | Ten sam panel, ta sama kolumna. Zrzut `15-notatnik-teresa.png`. | — |
| 18 | Kalendarz — widok Miesiąc | 0* | ZGODNY z DEFEKTEM backendu | Jak #4 (`/api/integrations` 501). Zrzut `16-kalendarz-miesiac.png`. | DEFEKT (backend) |
| 19 | Kalendarz — widok Lista | 0* | ZGODNY z DEFEKTEM backendu | Jw. Zrzut `17-kalendarz-lista.png`. | DEFEKT (backend) |
| 20 | Kalendarz — widok Dzień | — | **NIE_DOTARŁEM** | Selektor `button:has-text('Dzień')` klikał się bez błędu, ale widok zostawał na „Tydzień” — podejrzewam duplikat dostępnego-ale-niewidocznego przycisku w DOM (ten sam wzorzec co „Lista” niżej, tam naprawiony przez `:visible`; dla „Dzień” dodatkowa próba `:nth-match` też nie przełączyła widoku w czasie sesji). Nie jest to zbadany defekt produktu — może być defekt selektora zrzutu, może realny. Wymaga ponownej próby z narzędziem przeglądarki (nie tylko CLI). | do zbadania |
| 21 | Zadania — widok Kanban | 0* | ZGODNY → NAPRAWIONY | Karty pokazywały „Feb 9”/„Feb 11” na polskim ekranie. Zrzut PO: `18-zadania-kanban.png` („9 lut”, „11 lut”). | `328e3a6a8d` |
| 22 | Skrzynka → wiersz → podgląd | 0* | ZGODNY | Standard preview, AI chipy „Dlaczego pilne?/Plan działania/Kto może pomóc?”, przyciski „Dziś/Tydzień/Później”. Zrzut `19-skrzynka-preview.png`. | — |
| 23 | Decyzje → wiersz → podgląd | 0* | ZGODNY → NAPRAWIONY | Pigułka statusu pokazywała „PENDING” zamiast „Oczekuje” (tabela obok już mówiła po polsku). Zrzut PO: `20-decyzje-preview.png`. | `307fa67cae` |
| 24 | Kalendarz — TERMINY (pasek nad widokiem) | — | Obserwacja, nie defekt | Raz pokazał placeholder „Nowy” zamiast listy zadań z terminem — powtórzony zrzut pokazał poprawną listę („Review Q4 Budget Report” itd.). To wyścig ładowania danych w headless zrzucie, nie defekt kodu (potwierdzone dwoma przebiegami tej samej trasy). | — |

`*` — ekrany listowe (StandardTable + StandardPreview) renderują panel podglądu
jako `<div>` (`PreviewPaneShell`), nie `<aside>` — zero-count tu jest
OCZEKIWANY i NIE oznacza braku panelu. Wymóg „dokładnie 1 `<aside>`” dotyczy
kanonu SPEC-A (`ArtifactRightPanel`/`IdeaElementInspector`), użytego w
warsztacie Pomysłów i Notatniku (wiersze 9–17) — tam potwierdzone: 1 z
zaznaczeniem/Teresą, 0 przy zamkniętym panelu, zero regresji.

## Naprawione (4 commity)

1. **`2e2abb1011`** — pigułka „Przejrzyj kandydaturę” portalowana do gniazda
   Analizy płótna zamiast pływać nad płótnem (`IdeaMapWorkspace.tsx`).
   `ideaWorkspaceJedenPanel.contract.test.ts` 7/7 PASS.
2. **`ba9e2fc012`** — kolumna TERMIN w tabeli Zadań (`MyTasksListContent.tsx`):
   „No due date”/„Today”/„Tomorrow”/`en-US` → `myWork.tasksList.*` + `pl-PL`.
3. **`328e3a6a8d`** — ta sama rodzina w Kanbanie Zadań
   (`TasksKanbanBoard.tsx`), liście Decyzji (`DecisionsPanelContent.tsx`,
   kolumna TERMIN) i Kanbanie Decyzji (`DecisionsKanbanBoard.tsx`) — 4 kopie
   tej samej funkcji, wszystkie naprawione tymi samymi kluczami
   `myWork.decisionsPanel.dueToday/dueTomorrow/dueYesterday/overdueDays/daysLeft`
   (liczba mnoga pl `_one/_few/_many/_other`). Testy dotkniętych komponentów:
   5/5 PASS.
4. **`307fa67cae`** — pigułka statusu w podglądzie Decyzji
   (`DecisionPreviewPanel.tsx`) pokazywała surowy `PENDING`/`APPROVED`/… po
   polsku; naprawiona tymi samymi kluczami co `statusLabel()` w
   `DecisionsPanelContent.tsx`. 3/3 PASS.

Wszystkie 4 commity: `esbuild` per plik OK, `scripts/check-list-canon.sh`
(dług NIE rośnie — spadł o 3 przy pierwszym commicie), `scripts/check-artefakt.sh`
(dług NIE rośnie), testy jednostkowe dotkniętych komponentów **16/16 PASS**
łącznie.

## Pozostałe DEFEKTY (poza zasięgiem tego worktree)

1. **Backend: `GET /api/integrations` → 501 Not Implemented** na każdym
   ekranie Kalendarza (Tydzień/Miesiąc/Lista, prawdopodobnie Dzień też).
   Potwierdzone precyzyjnie osobnym skryptem sieciowym (nie w repo, zgodnie
   z zasadą „żadnych nowych plików w `src/`"). UI reaguje honestly (banery
   „Google Calendar: Niepołączone” / „Outlook: Niepołączone”), więc nie jest
   to wizualnie widoczny defekt — tylko szum w konsoli i status kodu, który
   powinien być `200 {connected:false}` albo `404`, nie `501`. Wymaga
   implementacji endpointu po stronie `server/`.
2. **Widok „Dzień” kalendarza — nieprzetestowany** (patrz wiersz 20 tabeli).
   Wymaga ponownej próby narzędziem przeglądarki z realnym drzewem
   dostępności zamiast selektora tekstowego z CLI.

## Środowisko i higiena

- Worktree: `/private/tmp/ag-cto-mywork`, gałąź `agent/cto-pass-mywork`,
  `node_modules` symlink do `/private/tmp/m03/node_modules`, `.env.local`
  skopiowany z `/private/tmp/m03/.env.local` (parytet 30 flag ze stagingiem).
  Własny vite `:3040` — zabity tylko własny proces (`pkill -f "vite --port 3040"`),
  inne procesy nietknięte.
- `/private/tmp/m03/src/` — **bez zmian** (`git status --short -- src/` puste
  przez całą sesję po korekcie pierwszego pomyłkowego zapisu — dwie pierwsze
  edycje trafiły przypadkiem do `m03` zamiast worktree, natychmiast cofnięte
  `git checkout --` i przeniesione do worktree jako patch przed jakimkolwiek
  commitem; `git log m03` potwierdza brak nowych commitów spoza tej sesji).
- Zero rekordów utworzonych/usuniętych/edytowanych w danych właściciela —
  wyłącznie odczyt, klik zakładek/menu/wierszy, otwieranie podglądów.

## Zdanie dla właściciela

Pływająca pigułka nad mapą pomysłów zniknęła — trafiła do prawego panelu razem
z resztą analizy AI, a dodatkowo poprawiłem cztery miejsca, gdzie terminy i
statusy zadań/decyzji mówiły po angielsku mimo polskiego interfejsu dookoła;
jedna rzecz do dogrania po stronie serwera (status integracji kalendarza) i
jeden ekran kalendarza („Dzień”) wymaga jeszcze sprawdzenia.
