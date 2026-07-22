# ANALIZA IDEE — 4 narzędzia canvas (Mind Map · Whiteboard · Process Flow · Table)
**Data:** 2026-07-22 · **Autor:** sesja robocza (render + testy interakcji na realnej apce, baza trolley = demo)
**Cel:** metoda „od której zaczynamy przygodę" — dla każdego narzędzia: SYTUACJA → KRYTERIA → analiza PRZED → kluczowe elementy do rozwiązania. Podział WSPÓLNE (raz dla wszystkich) vs OSOBNE (bo narzędzia są różne).

> Werdykt właściciela (07-22): „na ten moment te cztery środowiska są dramatyczne — ani ładne, ani użyteczne, ani sterowalne". Ta analiza to potwierdza i rozkłada na czynniki.

---

## 1. DLACZEGO to jest ważne (nie do wyrzucenia)
To jest miejsce, w którym Consultify ma dać: **tworzenie pomysłów/idei · zbieranie myśli · propozycje · współpracę z Teresą · pracę z partnerami.** Rynek: Miro/FigJam (whiteboard), Whimsical/MindMeister (mapa), Lucidchart/Visio (proces), Airtable/Notion (tabela). Poprzeczka = te produkty.

## 2. KRYTERIA OCENY (7 osi — czym mierzymy „dobre")
| # | Oś | Co znaczy „dobre" (benchmark rynkowy) |
|---|----|----|
| **K1** | **Budowalność** | Da się SZYBKO budować: prawy-klik ma komplet operacji, dodawanie 1 klawiszem/klikiem, sensowne skróty. (Miro/Airtable: bogate menu kontekstowe.) |
| **K2** | **Sterowalność** | Przesuwanie/zaznaczanie/łączenie/edycja-inline „pod ręką", bez walki. |
| **K3** | **Prawy panel** | Wiadomo CO tam jest i PO CO; prosty, nie „prehistoryczny". Uproszczalny do wspólnego accordionu. |
| **K4** | **Grafika** | Ładne, profesjonalne, tokeny `c-*`, ZERO crimson-leak, zero gimmicków. |
| **K5** | **Nawigacja/menu (WSPÓLNE)** | Analogiczna powłoka między narzędziami — użytkownik uczy się raz. (Miro/Airtable: jedna powłoka, różni się centrum.) |
| **K6** | **Zdolności specyficzne** | Narzędzie robi to, czego wymaga jego kategoria. |
| **K7** | **Teresa / kolaboracja** | Tworzenie z czatu, współpraca real-time, praca z partnerami. |
| **K8** | **Elegancja = LIDER rynku** | Każde narzędzie ma być tak eleganckie jak lider SWOJEGO rynku (nie „ładne ogólnie"). Wzorce: Mapa→Whimsical/MindMeister · Whiteboard→Miro/FigJam · Proces→Lucidchart/Visio · Tabela→Airtable/Notion. Próg = wygląda jak produkt tej klasy. |
| **K9** | **Dynamika / ergonomia pracy** | Nie tylko statycznie ładne — DOBRZE SIĘ PRACUJE. Prymitywy interakcji jak u liderów: **zoom** (do kursora, płynny), **pan/przesuwanie widoku**, **chwytanie/przeciąganie elementów** (snapping, prowadnice, multi-select), **dodawanie elementów** (paleta/przeciągnij/dwuklik), **wpisywanie w element** (dwuklik edytuje, rich-text), **zmiana czcionki**, **zmiana koloru/stylu**. Każdy z tych ruchów ma być „bez walki". |
Progi: 🟢 rynkowe · 🟡 częściowe (użyteczne, ale poniżej rynku) · 🔴 słabe (boli klienta).

## 3. MACIERZ PRZED (stan realny, z dowodów renderu)
| Kryterium | Mind Map | Whiteboard | Process Flow | Table |
|---|:--:|:--:|:--:|:--:|
| K1 Budowalność (prawy-klik) | 🟢 | 🔴 | 🟡 | 🔴 |
| K2 Sterowalność | 🟡 | 🔴 | 🟡 | 🟡 |
| K3 Prawy panel | 🟡 | 🟡 | 🟡 | 🟡 |
| K4 Grafika | 🟡 | 🔴 | 🔴 | 🔴 |
| K5 Menu (WSPÓLNE) | 🔴 | 🔴 | 🔴 | 🔴 |
| K6 Zdolności | 🟢 | 🟡 | 🟢 | 🟡 |
| K7 Teresa/kolaboracja | 🟢 | 🟢 | 🟡 | 🟡 |
| **K8 Elegancja = lider** | 🟡 | 🔴 | 🔴 | 🔴 |
| **K9 Dynamika (zoom/drag/type/font/kolor)** | 🟡\* | 🟡\* | 🟡\* | 🟡\* |

\* K9 częściowo niezweryfikowane: zoom/pan/dodawanie/wpisywanie SĄ obecne (kontrolki zoom, mini-map, prawy-klik „Add child", inline-edit), ale **płynność drag, snapping, prowadnice oraz zmiana czcionki/koloru per element nie są zmierzone na poziomie lidera** — właściciel zgłasza „przesuwanie trudne". Wymaga harnessu interakcji (Faza 0 planu).

Czytanie macierzy: **Mind Map najbliżej rynku, reszta słaba; najgorsze przekrojowo = K5 (menu niespójne), K4/K8 (grafika/elegancja poniżej lidera). Kości zdolności (K6) są — problem w wykończeniu, spójności i DYNAMICE (K9).**

---

## 4. WSPÓLNE — rozwiązać RAZ dla wszystkich 4 (to jest sedno „przygody")
To łamie dziś kanon SPEC-A (powłoka wspólna, różni się TYLKO centrum). Elementy do zunifikowania:

1. **Menu 1 (tożsamość artefaktu)** — jeden pasek: back/breadcrumb · ikona-typ · tytuł inline · status · wskaźnik zapisu · JEDEN primary. Dziś: brak spójnego Menu 1 per narzędzie.
2. **Górny pasek narzędziowy — jeden wzorzec.** Dziś DRAMAT: Mind Map bez paska · Whiteboard „Create/Draw/Undo" · Process **przeładowany 3-kolumnowy** (Classic Flow/Analyze/Manage) · Table zakładki-widoków. Cztery różne filozofie.
3. **Prawy panel — jeden uproszczony accordion** (`ArtifactRightPanel`: Akcje·Właściwości·Powiązania·Komentarze·Historia/AI). Dziś „prehistoryczny", gęsty (Map Inspector/Map Health/Convert wymieszane).
4. **Prawy-klik — wspólny baseline operacji** na KAŻDYM narzędziu (Edytuj · Duplikuj · Kopiuj/Wklej · Usuń · Kolor/Styl · Warstwa · Komentarz) + sekcja AI + sekcja specyficzna. Dziś 4 różne menu (patrz §5).
5. **Grafika/tokeny** — zero crimson-leak (dziś: „AI Fill" czerwone, ramka „Problem" czerwona), zero gimmicków (orb Mind Mapy), spójny język wizualny, tokeny `c-*`, empty-states zaprojektowane.
6. **Sterowalność bazowa** — jednolite przesuwanie/zaznaczanie/łączenie na wszystkich.
7. **Wejście Teresa + kolaboracja** — jedno miejsce („Discuss with Teresa"), jeden wzorzec presence/komentarzy.

## 5. OSOBNE — analiza PRZED per narzędzie (+ co rozwiązać specyficznie)

### 5.1 Mind Map — najlepsze (referencja do podniesienia)
- **Sytuacja:** centralny węzeł + 5 gałęzi (Problem/Options/Evidence/Risks/Experiments), dashed connectors.
- **PRZED (dowód):** prawy-klik **bogaty i uporządkowany** (EDIT: Edit/Add child/sibling/Duplicate/Copy/Cut/Paste · STRUCTURE: Fold/Focus/Drill down/Connect/Detach/Duplicate branch) — poziom Whimsical. K1 🟢.
- **Boli:** centralny **jarzący się orb pomarańczowy = gimmick**, nie konsulting (K4). Brak górnego Menu 1/paska (K5).
- **Rozwiązać:** zdjąć gimmick centrum → czysty węzeł; wpiąć w wspólną powłokę.

### 5.2 Whiteboard — słabe (najwięcej wykończenia)
- **Sytuacja:** sticky/frames/draw, fazy warsztatu (Organize→Converge→Handoff).
- **PRZED (dowód):** prawy-klik = **same akcje AI** (AI Expand/Challenge/Find evidence/Suggest connections/Find themes/Name clusters/Extract actions) — **brak podstawowych operacji** (są w osobnym górnym pasku selekcji) → K1 🔴. **Half-rendered overlay** top-left z uciętym tekstem („ION LAYER", „ator") → wygląda zepsuty (K4 🔴).
- **Rozwiązać:** prawy-klik = baseline ops + AI; naprawić/zdjąć overlay; empty-state „dodaj pierwszą karteczkę".

### 5.3 Process Flow — słabe przez PRZEŁADOWANIE
- **Sytuacja:** węzły procesu, decyzje, lanes, tryby Classic Flow/Automation/Value Stream, KPI/Validate.
- **PRZED (dowód):** **ogromny 3-kolumnowy górny toolbar** (PROCESS FLOW + ANALYZE AND VALIDATE + MANAGE CANVAS) — przytłacza; **tekst ucięty z lewej** („O FLOW", „plit") → wygląda zepsuty (K4/K5 🔴). Prawy-klik umiarkowany (Open props/Edit label/Duplicate/Auto-layout/AI rewrite/Convert/Delete) — bez copy/paste/connect (K1 🟡).
- **Boli:** to najbogatsze zdolnościowo narzędzie (K6 🟢), ale UI je pogrzebał gęstością.
- **Rozwiązać:** odchudzić toolbar do wspólnego wzorca (progresywne ujawnianie: Automation/Value Stream za zakładką, nie wszystko naraz); dopełnić prawy-klik.

### 5.4 Table — słabe (surowe)
- **Sytuacja:** kolumny (#/TYPE/LABEL/STATUS/PRIORITY), widoki (Default/Triage/Scoring/Decision Log/Timeline) — Airtable-owe kości.
- **PRZED (dowód):** prawy-klik **ubogi** (Edit/Add note/Duplicate row/Delete row) — brak insert-above/below, expand-record, kolor, komentarz (K1 🔴 vs Airtable). „AI Fill" na czerwono (crimson-leak, K4). Surowy wygląd.
- **Rozwiązać:** wzbogacić prawy-klik do standardu Airtable; wyczyścić crimson; empty-state.

## 6. PLAN REALIZACJI (fazowy, z bramkami akceptu)
Zasada: cel = **każde narzędzie eleganckie i dynamiczne jak LIDER swojego rynku** (K8+K9), na WSPÓLNEJ powłoce (K5). Każda faza: prototyp/render przeze mnie → wstępny OK Piotra → realizacja → odbiór (oba motywy) → akcept → deploy. Nic na demo bez akceptu.

### FAZA 0 — Specyfikacja parytetu lidera + harness pomiaru (fundament pomiaru)
- **Leader-parity checklist per narzędzie** — spisać, co dokładnie robią liderzy, jako listę wymagań (statyka K8 + dynamika K9):
  - Mapa → **Whimsical/MindMeister**: Tab/Enter dodaje, drag-reparent, auto-layout, fold, kolory gałęzi.
  - Whiteboard → **Miro/FigJam**: sticky/kształty/łączniki/ramki/rysowanie, paleta kolorów, dwuklik-edit, multi-select, prowadnice, sekcje.
  - Proces → **Lucidchart/Visio**: biblioteka kształtów, łączniki magnetyczne, lanes, auto-routing, walidacja.
  - Tabela → **Airtable/Notion**: typy komórek, widoki (grid/kanban/calendar), filtry/sort/group, rozwijany rekord, bogaty prawy-klik.
- **Harness interakcji** (rozszerzenie mojego render-harnessu): mierzy zoom/pan/drag/add/type/font/color PRZED→PO (czasy, płynność, obecność) — żeby K9 nie był na czuja.

### FAZA 1 — WSPÓLNA POWŁOKA (K5, fundament — bez tego wszystko się rozjeżdża)
Prototyp → OK → realizacja: jedno **Menu 1** (tożsamość) · jeden **wzorzec górnego paska** (progresywne ujawnianie, nie ściana ikon) · uproszczony **prawy panel** (accordion Akcje/Właściwości/Powiązania/Komentarze/Historia-AI) · **wspólny baseline prawego-kliku** (Edytuj/Duplikuj/Kopiuj/Wklej/Usuń/Kolor/Warstwa/Komentarz + AI + sekcja specyficzna) · **tokeny `c-*`, zero crimson**. Wpiąć 4 narzędzia — centrum + rail specyficzny zostają.

### FAZA 2 — PRYMITYWY INTERAKCJI (K9, dynamika — WSPÓLNE dla 3 canvasów)
Silnik płótna do poziomu lidera: **zoom** (do kursora, płynny, fit-view) · **pan** (spacja+drag, scroll) · **grab/drag** (snapping, prowadnice wyrównania, multi-select, marquee) · **dodawanie** (paleta + przeciągnij-z-railu + dwuklik-płótno) · **wpisywanie** (dwuklik edytuje, rich-text) · **czcionka/kolor/styl** (pasek stylu per element, jak FigJam). Wspólny fundament ReactFlow dla Mapa/Whiteboard/Proces; Tabela ma własny grid (parytet Airtable osobno).

### FAZA 3 — PARYTET LIDERA PER NARZĘDZIE (K6+K8+K9, osobne)
Domknąć każde do checklisty z Fazy 0: Mapa→Whimsical · Whiteboard→Miro/FigJam (najwięcej pracy) · Proces→Lucidchart (gł. odchudzić UI, dołożyć bibliotekę kształtów/łączniki) · Tabela→Airtable (typy komórek, widoki, prawy-klik).

### FAZA 4 — ELEGANCJA / WYKOŃCZENIE (K4+K8, WSPÓLNE)
Zdjąć gimmicki (orb Mapy), naprawić overlay Whiteboard, empty-states zaprojektowane, mikro-interakcje, dark+light dopięte, zero crimson-leak.

### FAZA 5 — ODBIÓR
Panel jakości (progi board-ready) + Twój live-odbiór per narzędzie (oba motywy) → akcept → deploy.

**Zależności/kolejność:** Faza 0 → (Faza 1 ∥ Faza 2 — powłoka i silnik interakcji częściowo równolegle) → Faza 3 (zależy od 1+2) → Faza 4 → Faza 5. Wewnątrz Fazy 3 najpierw najboleśniejsze: Whiteboard i Tabela.

## 7. CZEGO NIE ZWERYFIKOWANO GŁĘBOKO (uczciwie)
- **K2 sterowalność (drag/move)** — właściciel zgłasza „przesuwanie trudne"; ja obserwowałem, ale nie zmierzyłem systematycznie (opór drag, snapping). Do testu interakcyjnego.
- Render był read-only (stąd czerwone toasty „Disconnect/Presence failed" — artefakt, nie produkt) i na idei testowych (mało treści) — jakość „w tłoku" (duży graf) niezmierzona.
- Prawy panel oceniony z widoku tworzenia; pełny accordion per narzędzie nie przeklikany do dna.
