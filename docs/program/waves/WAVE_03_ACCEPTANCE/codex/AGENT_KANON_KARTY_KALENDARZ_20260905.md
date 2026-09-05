# Kanon kart (kanban/grid) i kalendarz — naprawa (2026-09-05)

Gałąź: `agent/kanon-karty-kalendarz-20260905` (baza: `m03` @ `2797be574e`)
Worktree: `/private/tmp/ag-kanon-karty`

Zlecenie: pakiet `16-kanon` odbioru na żywo 05.09
(`evidence/odbior-zywo-20260905/16-kanon/{RAPORT.md,wyniki.json}`) — 3 pozycje
ROZNI_SIE, 6 NIE_DOTARLEM, 2 ZGODNE.

---

## 1. Wynik — 3 defekty naprawione, 3 commity

| # | id (wyniki.json) | Werdykt PRZED | Co było nie tak | Naprawa | Commit |
|---|---|---|---|---|---|
| 1 | `standard-kanban-card` | ROZNI_SIE | My Work → Zadania → Kanban (`TasksKanbanBoard.tsx`) renderował WŁASNĄ kartę (`KanbanCardContent`), nie `StandardKanbanCard` (#75b, jedyny dozwolony renderer). Priorytet = tekst+kropka zamiast cichej pigułki; kolumny po angielsku (To Do/In Progress/Blocked/Done); medium/low dostawały własny (niebieski/szary) kolor paska, czego kanon A9 zabrania. | `SortableKanbanCard`/`DragOverlay` renderują teraz `StandardKanbanCard`; priorytet → `chips` z tonem; kolumny → i18n `myWork.kanban.columns.*` (PL/EN dodane). | `cc9f2fa755` |
| 2 | `standard-grid-card` | ROZNI_SIE | Inicjatywy → Siatka renderował `InitiativeGridCard` (bespoke) zamiast `PortfolioGridView` — a `PortfolioGridView` (#76a) **już budował** poprawną `StandardGridCard` (akcent, progress), tylko **nie miał wołacza w `InitiativesHub.tsx`** (klasyczna „biblioteka bez wywołania"). Brakowało: paska akcentu, paska postępu, kebaba. | `InitiativesHub.tsx` renderuje teraz `PortfolioGridView`. `PortfolioGridView` dostał `onArchive`/`onOpenFull` → `rowMenuSections` (te same 5 bloków co `InitiativeGridCard` miał). | `d6802fe037` |
| 3 | `mw-007-calendar-narrow-viewport` | ROZNI_SIE | Przełącznik widoku kalendarza (My Work → Kalendarz) miał 3 pozycje (Miesiąc/Tydzień/Dzień) zamiast 4 z zatwierdzonego obrazu — brakowało „Lista". Przyczyna: `CalendarGrid.tsx` chowała przycisk „Lista" w trybie `v2` (Calendar V2, domyślnie ON od `be0d6e6b2c`), bez uzasadnienia w commit message. | `viewButtons` zawiera teraz zawsze 4 pozycje — FullCalendar renderuje `listWeek` identycznie w obu trybach, więc nie ma powodu do wykluczenia. | `d8203681b8` |

Każdy commit ma test RTL z **dowodem mutacyjnym**: uruchomiony na przed-fixem
pliku (przywróconym z `git show HEAD:…`) → czerwony; po przywróceniu fixu →
zielony. Szczegóły w commit message / plikach testowych.

`bash scripts/check-list-canon.sh <pliki>` — 0 nowych naruszeń na każdym z 3 kroków.

### Świadomie NIE ruszone (poza zleceniem, zanotowane)

- **Język pigułek statusu inicjatyw** (Executing/Scheduled/Draft/…) — `STATUS_METADATA`
  w `src/services/initiativeLifecycle.ts` niesie WYŁĄCZNIE angielskie etykiety
  (nie i18n keys). To osobny, dużo szerszy dług (dotyka też tabeli/kanbanu inicjatyw,
  nie tylko siatki) — zgłoszony w RAPORT.md jako „Znalezisko poboczne — Język", nie
  jako jeden z 3 formalnych ROZNI_SIE. Naprawa punktowa tylko w Siatce dałaby
  niespójność z resztą modułu.
- **Lista ŹRÓDEŁ kalendarza** (3 pozycje zamiast 4, zniknięcie crimsonowych kolorów
  kategorii) — opisane w tym samym `mw-007-calendar-narrow-viewport`, ale zlecenie
  literalnie wskazywało TYLKO przełącznik widoku „Lista". Usunięcie crimsonowych
  kolorów kategorii może być samo w sobie zamierzoną naprawą kanonu (A10: primary=
  crimson tylko semantyka krytyczna) — nie cofam tego bez decyzji nadzorcy.
- **`InitiativeGridCard.tsx`** jest teraz osierocony (zero wołaczy — potwierdzone
  `rg -rln InitiativeGridCard src/`, tylko komentarze w plikach, które go zastąpiły).
  Zostawiony w repo (usuwanie plików poza zleceniem); kandydat do martwego kodu.
- **`PortfolioKanbanView.tsx`** (Inicjatywy → Kanban, osobny ekran od audytowanego
  Zadania → Kanban) ma WŁASNY bespoke `KanbanCard` z priorytetem jako **pełną
  kolorowaną pigułką** (`rounded-full px-1.5 py-0.5` + `bg`/`text` z priorytetu) —
  dokładnie to, czego kanon A9 zabrania („pełne czerwone pigułki priorytetów").
  Poza zleceniem (nie było w pakiecie 16-kanon) — zgłoszone nadzorcy osobno
  (spawn_task) jako kandydat do kolejnego dyżuru.

---

## 2. Weryfikacja (esbuild + testy + canon)

```
npx esbuild <każdy zmieniony plik> --bundle --platform=browser --format=esm ... --outfile=/dev/null   # 0 błędów
npx vitest run src/components/MyWork/__tests__/TasksKanbanBoard.canonCard.test.tsx                     # 1 passed
npx vitest run src/components/Portfolio/__tests__/PortfolioGridView.canonCard.test.tsx                 # 2 passed
npx vitest run src/components/MyWork/Calendar/__tests__/CalendarGrid.listView.canonToggle.test.tsx     # 2 passed
npx vitest run src/components/Initiatives/__tests__/InitiativesHub.previewDetails.t25.test.tsx         # 120 passed (bez regresji)
bash scripts/check-list-canon.sh <pliki>                                                                # 0 nowych naruszeń, wszystkie 3 kroki
```

Pełny `tsc`/`vitest` całego repo NIE uruchamiany (zakaz robotnika) — testy tylko
wskazanych plików, esbuild per plik.

---

## 3. Zrzuty PO — NIE WYKONANE (sesja ODBIOR_AUTH_STATE martwa)

Próba: własny `vite --port 3088 --strictPort` (kopia `.env.local` z `/private/tmp/m03`,
proxy do `staging.consultify.ai`), `scripts/dev/odbior-zywo/zrzut.mjs` z
`ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json`.

- Nawigacja bez czekania/kliknięć: strona zostaje na `/my-work` (tytuł render OK,
  0 błędów konsoli), ale zrzut wychodzi **czysto biały** — vite dalej kompiluje
  ogromny graf modułów My Work przy pierwszym realnym żądaniu.
- Z dłuższym oczekiwaniem (20s) LUB z kliknięciami (Zadania → Kanban) —
  **przekierowanie na `/login?redirect=…`**, `page.title()` = „Logowanie — Consultify".
  Powtórzone 2×, wynik identyczny.

To jest DOKŁADNIE ten sam objaw, jaki `16-kanon/wyniki.json` już opisał dla pozycji
`rn-g3-class-l-record-shell` („w trakcie pakietu wygasła zalogowana sesja automatu…
każde wejście kończy się przekierowaniem na /login i HTTP 401 na
/api/auth/refresh”) — sesja we wspólnym pliku `auth.json` jest już martwa dla
WSZYSTKICH tras wymagających odświeżenia tokenu, nie tylko dla jednej. Odnowienie
wymaga ręcznego logowania właściciela (`scripts/dev/odbior-zywo/zaloguj.mjs` otwiera
okno i czeka na hasło Piotra — nie mogę tego zrobić za niego).

**Do zrobienia przez nadzorcę**: odśwież `/private/tmp/odbior-auth/auth.json`
(`node scripts/dev/odbior-zywo/zaloguj.mjs`), potem zrzuty PO na porcie 3088+ dla:
`/my-work` → Zadania → Kanban, `/initiatives` → Siatka, `/my-work` → Kalendarz
(przełącznik widoku, 900px). Do tego czasu dowód poprawności = testy RTL z
mutacją (sekcja 1) — świadome PRZYZNANIE, nie „testy przeszły więc działa".

Własne procesy (vite `:3088`, PID 5688/5233) zatrzymane po sobie; katalog roboczy
`evidence/kanon-karty-20260905/` pusty (usunięty razem z niedokończonym zrzutem
strony logowania — nie ma sensu trzymać zrzutu ekranu logowania jako „dowodu PO").

---

## 4. NIE_DOTARLEM (6 pozycji z pakietu) — gdzie w aplikacji szukać

Zgodnie ze zleceniem: dla pozycji, do których pomiar żywy nie dotarł, zapisuję
trasę + kliki, żeby nadzorca mógł je pokazać właścicielowi bez ponownego audytu
od zera. Żadna z tych 6 pozycji nie jest naprawą kodu — to dokumentacja stanu.

1–4. **`prawy-pas-jedna-formula-{idea,notatka}-{artefakt,teresa}`** — z definicji
   NIE ISTNIEJE w aplikacji: pakiet sam opisuje ten ekran jako **PROTOTYP DO
   DECYZJI** („nie ma tego jeszcze w aplikacji", zero zmian w kodzie
   produkcyjnym). Najbliższe realne odpowiedniki:
   - Idea (Teresa/Artefakt): `/my-work/ideas/.../workspace/mindmap` → szyna
     paneli PO LEWEJ (Przegląd/Właściwości/Powiązania/AI/Aktywność/Wygląd),
     bez przełącznika trybów Artefakt/Teresa w jednym pasie.
   - Notatka (Teresa/Artefakt): `/my-work?notebook=...` → ikona panelu w pasku
     notatki otwiera akordeon (Akcje/Właściwości/Powiązania/Źródła i
     założenia/Komentarze/Historia), też bez przełącznika trybów.
   - Decyzja produktowa potrzebna: czy budować wspólną formułę Artefakt/Teresa
     w jednym prawym pasie, czy zostawić dwie różne powłoki (kanwa idei vs
     notatnik) jak dziś.

5. **`standard-module-bar-children`** — zatwierdzony obraz to galeria WARIANTÓW
   komponentu z harnessu `dev-render` (sześć wariantów A–F obok siebie); w
   aplikacji nie ma ekranu, który by tak wyglądał — sam pakiet rekomenduje
   zdjęcie tej pozycji z odbioru ekran-po-ekranie. Warianty A–E widoczne
   rozproszone po aplikacji:
   - A/B (pasek z własną treścią / bez niej): `/my-work` (Moja Praca), Sejf
     klienta, Agent Hub.
   - C (CTA modułu): `/initiatives` → „Nowa inicjatywa", Zadania → „Nowe
     zadanie", Idee → „Nowy pomysł".
   - D (filtry statusu, chipy z licznikami): Realizacja, Skrzynka, Inicjatywy.
   - E (dwa CTA naraz): Wywiad → „Przydziel" + przełącznik widoku.
   - F (przyciski kategorii Benefits) — NIE sprawdzone w tej sesji ani
     poprzedniej.

6. **`rn-g3-class-l-record-shell`** — trasy `/results/kpi` i
   `/results/kpi/:kpiId`, komponent `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx`,
   za flagą `kpiRegistry`. Poprzedni pomiar nie dotarł z powodu wygasłej sesji
   (patrz sekcja 3 — dokładnie ten sam problem uderzył mnie dzisiaj ponownie).
   Do sprawdzenia po odnowieniu `auth.json`.

---

## 5. Pliki zmienione

- `src/components/MyWork/TasksKanbanBoard.tsx` — migracja na `StandardKanbanCard`.
- `src/components/MyWork/__tests__/TasksKanbanBoard.canonCard.test.tsx` — nowy test.
- `src/components/Initiatives/InitiativesHub.tsx` — Siatka → `PortfolioGridView`.
- `src/components/Portfolio/PortfolioGridView.tsx` — dodany kebab (`onArchive`/`onOpenFull`).
- `src/components/Portfolio/__tests__/PortfolioGridView.canonCard.test.tsx` — nowy test.
- `src/components/MyWork/Calendar/CalendarGrid.tsx` — przywrócony przycisk „Lista".
- `src/components/MyWork/Calendar/__tests__/CalendarGrid.listView.canonToggle.test.tsx` — nowy test.
- `public/locales/{en,pl}/translation.json` — `myWork.kanban.columns.*`, `myWork.tasksList.untitled`.
