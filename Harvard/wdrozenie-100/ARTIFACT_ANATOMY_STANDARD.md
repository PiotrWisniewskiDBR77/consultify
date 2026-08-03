# ARTIFACT ANATOMY STANDARD (v1.0)
**Data:** 2026-07-01 | **Autorzy:** Piotr (wizja + rola konsumenta) + Harvard Strateg (ekspert CTO)
**Status:** **KOMPLETNY — kontrakt budowy.** Warstwa `03-modules/artifact-anatomy-standard` pod [CANON](../../docs/ui-standards/CANON.md) (§20 AUTH). Poprzeczka: Tech-2026.
**Powiązania:** [RESKIN_AUDIT](RESKIN_AUDIT_2026-06-30.md) · [RAPORT_UIUX_WALKTHROUGH](RAPORT_UIUX_WALKTHROUGH_2026-06-30.md) · [CANON](../../docs/ui-standards/CANON.md) · [TABLE_AND_PREVIEW_CANON](../../docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md) · editor-shell-canon
**Mapa:** §0C powierzchnie · §1-2 filary/anatomia · §3 archetypy · §4B mapa 47 · §5-6 menu/akcje · §9 elementy light/dark · §10-11 kompozycja/build-ready · §12 nawigacja · §13 instancjacja · §14 SPEC-L tabela · §15 instrumenty · §16 SPEC-K chat · §17 SPEC-H hub · §18 DoD · §19 cross-cutting · §20 decyzje

---

## 0. Jak czytać ten dokument

Aplikacja ma **~40 typów artefaktów** (obiektów pracy). Gdybyśmy specyfikowali każdy z osobna = 40 niespójnych ekranów = dokładnie ten chaos, który dziś mamy.

**Kluczowa teza tego standardu:**
> 40 artefaktów = **5 archetypów × 2 klasy wielkości**. Specyfikujemy archetypy raz. Każdy konkretny artefakt tylko wskazuje: "jestem archetypem X, klasa Y". Koniec chaosu.

Czytaj w kolejności: §1 (zasady) → §2 (anatomia) → §3 (archetypy) → §4 (mapa 40→archetyp) → §5 (spec menu per archetyp) → §6 (katalog elementów) → §7 (sugestie).

---

## 0C. MAPA POWIERZCHNI — cała aplikacja opisana w 4 typach

**Teza (najważniejsza w całym dokumencie):** cała aplikacja = **4 typy powierzchni**. Każdy typ opisujemy graficznie RAZ. To zamienia „200 ekranów do naprawy" w „~9 specyfikacji". To jest dźwignia jakości klasy miliardowej.

### Test klasyfikacji (sortuje każdy ekran w aplikacji)
1. Czy to *rozmowa*? → **KONWERSACJA**
2. Czy pokazuje *listę innych obiektów*? → **LISTA**
3. Czy otwiera się *samodzielnie, z własną tożsamością* (link/status/cykl życia)? → **ARTEFAKT**
4. Czy to *przyrząd sterujący wbudowany w proces* (nie samodzielny)? → **INSTRUMENT**

Pochodne: **HUB** (landing modułu) = kompozycja Listy/Instrumentu + zakładki Menu 2. **Preview** = skrócony Artefakt. To nie nowe typy — to złożenia.

### Typ 1 — KONWERSACJA (1 powierzchnia)
Chat z Teresą (+ Canvas split-view). Model interakcji inny niż reszta: bąble, streaming, wywołania narzędzi.

### Typ 2 — LISTA (tabele zbioru)
Indeks każdego modułu. Wiersze = wiele artefaktów. Wspólny standard: TABLE_AND_PREVIEW_CANON.
- My Work: Tasks · Decisions · Notebook · Ideas · Inbox · Calendar
- Interview: Sesje · Templates · Inbox · Assigned
- Tools: Biblioteka narzędzi · Assessment (lista)
- Initiatives: Lista/Portfolio · Reports · Sessions
- Results: KPI · KPI Reports
- Materiały: Dokumenty · Prezentacje · Tabele
- Globalne: Notyfikacje

### Typ 3 — ARTEFAKT (~33, dzielą się na 5 archetypów — patrz §3)
- **A Canvas:** Mind Map · Process Flow · Whiteboard · Discovery Tool · Studio Diagram · Playbook
- **B Dokument:** Notatka · Wordy · Report · Assessment Report · Audit Report · Executive Summary · KB · Legal · Partner · Meeting Notes
- **C Rekord:** Initiative · Task · Decision · KPI · Insight · Idea · RAID · Milestone · Change Request · Stage Gate · Action Proposal
- **D Matryca (samodzielna):** Assessment Session · Table/Spreadsheet · Idea Table · Megatrend
- **E Deck:** Presentation

### Typ 4 — INSTRUMENT (przyrządy wbudowane)
Nie samodzielne, sterują procesem. Cztery podrodzaje:
- **Tablice/osie:** Kanban (portfolio/zadania) · Gantt/Roadmap · Portfolio Matrix · Timeline
- **Tabele sterujące:** obłożenie/capacity · alokacja · RACI (embedded) · Value Driver Tree
- **Dashboardy:** Portfolio Health · ROI/Benefits Workspace · Project Intelligence · Finance · Execution Plan
- **Kreatory (wizardy):** Context Builder · Generatory (inicjatyw/raportów) · Onboarding · Audit Orchestrator · Stage Gate checklist

### Co z tego wynika — zestaw specyfikacji graficznych (cały produkt)

| Spec | Pokrywa | Ile powierzchni |
|------|---------|:---:|
| **SPEC-K** Konwersacja | Chat | 1 |
| **SPEC-L** Lista | wszystkie tabele zbioru | ~20 |
| **SPEC-A** Artefakt-Canvas | 6 canvasów | 6 |
| **SPEC-B** Artefakt-Dokument | 10 dokumentów | 10 |
| **SPEC-C** Artefakt-Rekord | 11 rekordów | 11 |
| **SPEC-D** Artefakt-Matryca | 4 matryce | 4 |
| **SPEC-E** Artefakt-Deck | prezentacje | 1 |
| **SPEC-I** Instrument | tablice/tabele/dashboardy/wizardy | ~18 |
| **SPEC-H** Hub | reguły składania landingów modułów | 5 |

**9 specyfikacji = cała aplikacja spójna.** Każdy nowy ekran musi wskazać swój SPEC. Koniec wymyślania lokalnego wyglądu.

---

## 1. Cztery filary żelaznej metodyki (ustalone w rozmowie)

| # | Filar | Zasada |
|---|-------|--------|
| 1 | **Anatomia stref** | 6 stref przestrzennych; 5 identycznych dla każdego artefaktu, tylko centrum wolne |
| 2 | **Zejście w głąb** | Moduł ustępuje artefaktowi (nie nakłada się); max ~3 paski poziome, nigdy 6 |
| 3 | **Model akcji** | Jedna akcja / wiele dróg (przycisk + prawy klik + skrót później); stała kolejność w menu |
| 4 | **Zasada przycisków** | Mało, duże, opisane (z etykietą); nadmiar → jedna rozwijana lista, nie 10 ikon |

**Zasada nadrzędna (z CANON §1):** *Ekrany funkcjonalne nie wymyślają wyglądu. Składają zatwierdzone komponenty.* Chaos z walkthrough = łamanie tej zasady w 90% miejsc. Nie brak zasady — brak egzekwowania.

---

## 2. Anatomia artefaktu — 6 stref

```
╔════════════════════════════════════════════════════╗
║  MENU 1 aplikacji (globalny topbar — POZA zakresem)║
╠════════════════════════════════════════════════════╣
║  ← Tytuł · status · zapis · [indeks]   [PRIMARY ▸] ║  Menu 1 artefaktu (cienki)
╟────────────────────────────────────────────────────╢
║  B I U · A⁺A⁻ · ≡ · 1. •   (listwa edycji)         ║  Menu 2 artefaktu (gdy tekst)
╟────────────────────────────────────────────────────╢
║  [chipy akcji widoku]        [filtr][sort][AI]      ║  Menu 3 artefaktu (kontekst widoku)
╟──────┬──────────────────────────────┬──────────────╢
║ lewy │                              │  PRAWY PANEL  ║
║ rail │        CENTRUM               │  ▸ Akcje 2rz. ║
║ narz │      (treść / canvas)        │  ▸ Właściwości║
║(czas.│                              │  ▸ Powiązania ║
║ znika│      + prawy klik (lustro)   │  ▸ Historia/AI║
╚══════╧══════════════════════════════╧══════════════╝
   STOPKA (opcjonalna): zapis · zoom · meta
```

### Definicje stref

**Menu 1 artefaktu — cienki pasek tożsamości.** Tylko: powrót (breadcrumb), tytuł (edytowalny inline), status lifecycle, stan zapisu, link do indeksu (pod przyszłe linkowanie), **jeden** primary CTA po prawej (duży, opisany). Nic więcej.

**Menu 2 artefaktu — listwa edycji.** Tylko przy artefaktach tekstowych. Wielkość/odstępy czcionki, pogrubienie, punktowanie, nagłówki. Uspójnić z tym co już mamy. Canvas/matryca — nie ma tego paska.

**Menu 3 artefaktu — akcje kontekstowe bieżącego widoku.** Chipy akcji dla aktualnego ekranu wewnętrznego + kontrolki view-local (filtr, sort, grupuj, toggle lista/grid, zoom) + akcje AI (prawa strona). Lustro prawego kliku.

**Lewy rail — narzędzia (CZASOWNIKI).** Rób coś na centrum: dodaj węzeł, rysuj, komentuj. Piękny wzorzec z Ideas → przenieść wszędzie. **Znika całkowicie gdy pusty** (nie rezerwujemy miejsca).

**Centrum — jedyna strefa naprawdę wolna.** Tu Inicjatywa ma 20 ekranów, arkusz ma 1, Tool ma canvas, Assessment matrycę.

**Prawy panel — właściwości (RZECZOWNIKI) + akcje drugorzędne.** Rozwijane sekcje (accordion): akcje drugorzędne, właściwości (owner/daty/budżet), powiązania (linki do artefaktów), historia/AI. Ma dużo miejsca → tu spycha się większość rzeczy. Zostaje zawsze.

**Prawy klik — menu kontekstowe.** Lustro architektury przycisków, przefiltrowane przez to na co kliknięto. Stała kolejność (§6).

### Reguła zejścia w głąb (rozwiązuje ból "traci się ekran")

```
Poziom modułu:          Poziom artefaktu (po wejściu):
Menu 1 (app)            Menu 1 (app)          ← zostaje
Menu 2 (moduł)          Menu 1 (artefakt) ◄── zastępuje
Menu 3 (moduł)          Menu 2 (artefakt) ◄── zastępuje (gdy tekst)
[lista artefaktów]      Menu 3 (artefakt) ◄── zastępuje
                        [rail + centrum + panel]
```
Wchodzisz w obiekt = widzisz jego menu, nie menu modułu. Breadcrumb = droga powrotna. Nigdy >3 paski naraz.

---

## 3. Pięć archetypów (× 2 klasy wielkości)

Podział wg **typu centrum** (co jest w środku ekranu):

| Archetyp | Centrum | Menu 2 (listwa edycji)? | Lewy rail | Prawy panel |
|----------|---------|:---:|:---:|:---:|
| **A — Canvas** | Wolna przestrzeń, węzły/kształty | ✗ | ✓ narzędzia canvasu | ✓ właściwości węzła |
| **B — Dokument** | Tekst ciągły (rich text) | ✓ formatowanie | ✗ (lub outline) | ✓ meta + AI |
| **C — Rekord** | Sekcje pól/formularze | ✗ | ✗ | ✓ główny nośnik |
| **D — Matryca/Tabela** | Siatka komórek/matryca | ✗ (toolbar tabeli) | opcj. struktura | ✓ komórka/formuła |
| **E — Deck** | Slajdy | ✗ (toolbar slajdu) | ✓ nawigator slajdów | ✓ layout/brand |

**Klasa wielkości** (druga oś):
- **Klasa S (simple)** — jeden widok, otwiera się w panelu bocznym lub modalu. Brak Menu 2/3 artefaktu. Np. Task, Decyzja, KPI, Insight, prosty pomysł.
- **Klasa L (large)** — wiele widoków wewnętrznych, pełna przestrzeń robocza, Menu 2+3 artefaktu aktywne. Np. Inicjatywa, Assessment, Interview, Deck, Report.

> **Każdy z 40 artefaktów = jeden archetyp (A–E) + jedna klasa (S/L). To wszystko czego potrzeba żeby wiedzieć jak wygląda.**

---

## 4. Mapa: 40 artefaktów → archetyp + klasa

| Artefakt | Archetyp | Klasa | Uwaga |
|----------|:---:|:---:|-------|
| Idea — Mind Map / Process Flow / Whiteboard | A Canvas | L | wzorzec raila |
| Studio Diagram | A Canvas | L | |
| Playbook (workflow) | A Canvas | L | superadmin |
| Discovery Tool (31 narzędzi) | A Canvas | L | **serce konsultingu — priorytet** |
| Idea Table (My Work) | D Matryca | L | canvas-table hybryda |
| — | | | |
| Notatka (Notebook) | B Dokument | S/L | **do przebudowy** |
| Document / Wordy | B Dokument | L | |
| Report (edytowalny) | B Dokument | L | |
| Executive Summary | B Dokument | L | read-first |
| Assessment Report | B Dokument | L | **DRD odcięty** |
| Audit Report | B Dokument | L | |
| Knowledge Base Article | B Dokument | L | read-first |
| Legal Document | B Dokument | L | |
| Partner Agreement | B Dokument | L | |
| Meeting Notes | B Dokument | S | |
| — | | | |
| Initiative | C Rekord | L | 10 ekranów wewn. |
| Task | C Rekord | S | |
| Decision | C Rekord | S | |
| KPI | C Rekord | S | |
| Insight | C Rekord | S | |
| Idea / Concept (pre-initiative) | C Rekord | S | |
| RAID (Risk/Assumption/Issue/Dependency) | C Rekord | S | embedded |
| Milestone | C Rekord | S | embedded |
| Change Request | C Rekord | S | |
| Stage Gate | C Rekord | S | embedded |
| Action Proposal (AI) | C Rekord | S | |
| — | | | |
| Assessment Session (DRD/SIRI/ADMA) | D Matryca | L | **macierz gotowości** |
| Maturity Matrix | D Matryca | S | embedded |
| RACI Matrix | D Matryca | S | embedded |
| Table / Spreadsheet (Tabele) | D Matryca | L | |
| Megatrend Scan | D Matryca | L | Context Builder |
| — | | | |
| Presentation / Deck | E Deck | L | |
| — | | | |
| Interview Session | C Rekord (konwersacja) | L | hybryda: chat+rekord |
| Template (report/interview/deck/playbook) | meta | — | edytuje strukturę innego archetypu |
| Context Builder (moduły) | mieszany | L | sekwencja form+canvas |

**Nie-artefakty (to są HUBY/dashboardy modułu, nie obiekty pracy):** Project Intelligence, Portfolio Health, Benefits/ROI Workspace, Execution Plan. Podlegają standardowi ModuleHub, nie temu dokumentowi. **To ważne rozróżnienie** — nie mieszać hubu z artefaktem.

---

## 4B. Mapa nawigacyjna — gdzie MIESZKA każdy artefakt (wg sidebara, góra→dół)

Kolejność sidebara jest **zamrożona** (FROZEN_LAYOUTS §1):
`Chat → My Work → Interview → Tools → Initiatives → Execution → Results → Finance → Audits → Materiały → Meeting` + stopka (Organization/Admin/SuperAdmin/Internal Tools/Settings).

Jedna tabela, jeden wiersz = jeden artefakt. Kolumny: **Lp · Moduł · Funkcjonalność · Artefakt · Archetyp · Klasa · Uwaga**. Kolejność ściśle wg sidebara. Kolumny Archetyp/Klasa/Uwaga są WSTĘPNE — to punkt wyjścia do dyskusji, nie decyzja.

| Lp | Moduł | Funkcjonalność | Artefakt | Arch. | Kl. | Uwaga |
|---:|-------|----------------|----------|:---:|:---:|-------|
| 1 | Chat | Rozmowa z Teresą | Idea (przechwyt) | C | S | lekki; konwersja → Initiative |
| 2 | Chat | Rozmowa z Teresą | Insight | C | S | reużywany w Interview |
| 3 | Chat | Rozmowa z Teresą | Action Proposal (AI) | C | S | propozycja AI do akceptacji |
| 4 | My Work | Ideas → Mind Map | Mind Map | A | L | wzorzec lewego raila |
| 5 | My Work | Ideas → Process Flow | Process Flow | A | L | 16 problemów UI (D-I) |
| 6 | My Work | Ideas → Whiteboard | Whiteboard | A | L | |
| 7 | My Work | Ideas → Table | Idea Table | D | L | canvas-tabela hybryda |
| 8 | My Work | Notebook | Notatka | B | S/L | do przebudowy (artefakt) |
| 9 | My Work | Tasks | Task | C | S | reużywany w Initiatives/Execution |
| 10 | My Work | Decisions | Decision | C | S | reużywany w Initiatives |
| 11 | Interview | Sesja wywiadu | Interview Session | C* | L | hybryda chat+rekord (Q2) |
| 12 | Interview | Templates | Interview Template | meta | L | edytuje strukturę wywiadu |
| 13 | Tools | Library (31 narzędzi) | Discovery Tool | A | L | **serce konsultingu — priorytet** |
| 14 | Tools | Assessment → Ocena | Assessment Session (DRD/SIRI/ADMA) | D | L | macierz gotowości cyfrowej |
| 15 | Tools | Assessment → Mapa | Macierz gotowości (Maturity Matrix) | D | L | brak DRDAssessmentMap.tsx |
| 16 | Tools | Assessment → Reports | Assessment Report | B | L | DRDReportTemplate odcięty |
| 17 | Initiatives | Lista / Portfolio | Initiative | C | L | ~10 ekranów wewn. |
| 18 | Initiatives | Governance | Stage Gate | C | S | embedded |
| 19 | Initiatives | Governance | RACI Matrix | D | S | embedded |
| 20 | Initiatives | RAID | RAID (Risk/Assumption/Issue/Dependency) | C | S | embedded |
| 21 | Initiatives | Timeline | Milestone | C | S | embedded |
| 22 | Initiatives | Reports | Report (PMO) | B | L | Report Builder ⚠ przenieść do Materiały |
| 23 | Execution | Plan wdrożenia | Execution Plan | HUB | L | to HUB, nie artefakt |
| 24 | Execution | Zmiany | Change Request | C | S | |
| 25 | Results | KPI | KPI | C | S | reużywany w Initiatives |
| 26 | Results | Value Driver Tree | Value Driver Tree | HUB | L | to HUB; dziś nieinteraktywne |
| 27 | Results | KPI Reports | KPI Report | B | L | |
| 28 | Results | Dashboard | Portfolio Health | HUB | L | to HUB |
| 29 | Finance | ROI / Valuation / Budget | Benefits/ROI Workspace | HUB | L | to HUB |
| 30 | Audits | Program audytu | Audit Report | B | L | |
| 31 | Materiały | Dokumenty | Document / Wordy | B | L | |
| 32 | Materiały | Prezentacje | Presentation / Deck | E | L | vs Gamma |
| 33 | Materiały | Tabele | Table / Spreadsheet | D | L | |
| 34 | Materiały | Szablony | Template | meta | L | meta-artefakt |
| 35 | Meeting | Spotkanie | Meeting | B | L | Piotr: rozważ usunięcie z sidebara |
| 36 | Meeting | Notatki | Meeting Notes | B | S | |
| 37 | Organization *(stopka)* | Profil org | Organization Context | mieszany | L | |
| 38 | Admin/SuperAdmin *(stopka)* | Playbook Editor | Playbook | A | L | superadmin |
| 39 | Internal Tools *(stopka)* | AI OS → Artifacts | Rejestr artefaktów | HUB | L | dbr77-internal |
| — | — SIEROTY (brak wejścia w sidebarze) — | | | | | ↓ decyzja D-NAV |
| 40 | *(sierota)* | `/studio` | Studio Diagram | A | L | wchłonąć do Materiały/Ideas? |
| 41 | *(sierota)* | `/knowledge-base` | Knowledge Base Article | B | L | do Help/Settings? |
| 42 | *(sierota)* | `/legal` | Legal Document | B | L | dbr77-internal? |
| 43 | *(sierota)* | `/partner` | Partner Agreement | B | L | dbr77-internal? |
| 44 | *(sierota)* | `/context` | Context Builder | mieszany | L | do Organization/onboarding? |
| 45 | *(sierota)* | `/context/megatrends` | Megatrend Scan | D | L | pod Context Builder |
| 46 | *(sierota)* | `/project-intelligence` | Project Intelligence | HUB | L | do Execution/Results |
| 47 | *(sierota)* | `/reports` | Executive Summary | B | L | do Materiały |

`*` Interview = hybryda (chat + rekord) — patrz Q2 §8. `HUB` = dashboard/hub modułu, NIE artefakt (własny standard ModuleHub). `⚠` = w złym miejscu. `meta` = edytuje strukturę innego archetypu.

**Jak czytać liczby:** 47 wierszy = 39 z domem w nawigacji + 8 sierot. Z tego 6 to HUBy (nie artefakty w sensie tego standardu). Realnych artefaktów-obiektów-pracy do specyfikacji: **~33**. Reszta to reużycia (Task/Decision/KPI/Insight pojawiają się w wielu miejscach — jeden artefakt, wiele domów).

### Artefakty-sieroty (istnieją w kodzie, brak jasnego wejścia w sidebarze)

To wyjaśnia „nie wiem gdzie to jest" — bo część naprawdę nie ma domu w nawigacji:

| Artefakt | Route | Problem nawigacyjny | Rekomendacja |
|----------|-------|--------------------|--------------|
| Studio Diagram | `/studio` | Brak w sidebarze | Wchłonąć do Materiały lub Ideas (archetyp A) |
| Knowledge Base | `/knowledge-base` | Brak w sidebarze | Do Help/Settings lub osobny |
| Legal Document | `/legal` | Brak w sidebarze | dbr77-internal? decyzja |
| Partner Agreement | `/partner` | Brak w sidebarze | dbr77-internal |
| Context Builder | `/context` | Brak w sidebarze (onboarding?) | Wpiąć w Organization lub onboarding |
| Megatrend Scan | `/context/megatrends` | Pod Context Builder | j.w. |
| Project Intelligence | `/project-intelligence` | Brak w sidebarze | Do Execution lub Results (to HUB) |
| Executive Summary | `/reports` | Niejasne wejście | Do Materiały (generated output) |

**Wniosek nawigacyjny:** 8 artefaktów bez domu = realny dług nawigacji. Przed re-skinem trzeba zdecydować: (a) wchłonąć do istniejącego modułu, (b) oznaczyć jako dbr77-internal, (c) usunąć jeśli martwe. To osobna decyzja D-NAV do rana.

---

## 5. Specyfikacja menu per archetyp

Legenda: **M1** = Menu 1 artefaktu · **M2** = Menu 2 (listwa edycji) · **M3** = Menu 3 (akcje widoku) · **RAIL** = lewy rail · **PANEL** = prawy panel · **PPM** = prawy przycisk myszy.

### Archetyp A — CANVAS (Idea, Tool, Studio, Playbook)

| Strefa | Zawartość |
|--------|-----------|
| **M1** | ← powrót · ikona-typ + tytuł · status · zapis · [indeks] · **PRIMARY**: zależny (Idea: „Konwertuj na inicjatywę"; Tool: „Generuj inicjatywy"; Report-gen: „Generuj") |
| **M2** | — (canvas nie ma listwy tekstu) |
| **M3** | Widok: zoom ± · dopasuj · minimapa toggle · siatka toggle · **[AI: podpowiedz]** (prawa) |
| **RAIL** | Kursor/select · Dodaj węzeł · Połącz · Rysuj · Tekst · Kształt · Komentarz · Sticky — **narzędzia specyficzne dla narzędzia** |
| **PANEL** | ▸ Właściwości węzła (kolor/rozmiar/typ) · ▸ Powiązania (do inicjatyw/źródeł) · ▸ Warstwy/struktura · ▸ Historia/AI |
| **PPM na płótnie** | Wklej · Dodaj węzeł tutaj · Zaznacz wszystko · Dopasuj widok |
| **PPM na węźle** | Edytuj · Powiel · Połącz z… · Kolor ▸ · Komentarz · —— · Usuń |

### Archetyp B — DOKUMENT (Notatka, Wordy, Report, KB, Legal)

| Strefa | Zawartość |
|--------|-----------|
| **M1** | ← powrót · tytuł · status · zapis · [indeks] · **PRIMARY**: „Udostępnij" lub „Publikuj"/„Generuj" |
| **M2** | **Listwa formatowania**: Nagłówek ▾ · B I U · lista • / 1. · wyrównanie · link · obraz/tabela · blok kodu |
| **M3** | Widok: tryb czytania toggle · TOC toggle · komentarze toggle · **[AI: napisz/podsumuj/popraw]** (prawa) |
| **RAIL** | — (lub outline dokumentu gdy długi) |
| **PANEL** | ▸ Akcje (eksport ▸, udostępnij) · ▸ Właściwości (autor/daty/tagi) · ▸ Powiązania · ▸ Komentarze · ▸ Wersje/AI |
| **PPM na zaznaczeniu** | Wytnij/Kopiuj/Wklej · Formatuj ▸ · Link · Komentarz · **AI: przepisz/skróć/rozwiń** |
| **PPM na bloku** | Duplikuj blok · Przenieś ↑↓ · Zmień typ ▸ · —— · Usuń blok |

### Archetyp C — REKORD (Initiative, Task, Decision, KPI, RAID…)

| Strefa | Zawartość |
|--------|-----------|
| **M1** | ← powrót · ikona-typ + tytuł · status lifecycle · zapis · [indeks] · **PRIMARY**: przejście stanu („Submit for Review"/„Approve"/„Zamknij") |
| **M2** | — (rekord nie edytuje tekstu ciągłego) |
| **M3** (tylko klasa L) | Nawigacja wewn. jako pill: Summary · Tasks · RAID · Finance · Timeline… + **[AI: uzupełnij]** (prawa). Klasa S: brak M3 |
| **RAIL** | — |
| **PANEL** | **Główny nośnik treści** dla klasy S: ▸ Właściwości (owner/sponsor/daty/budżet/oś) · ▸ Powiązania (KPI/tasks/źródła) · ▸ Akcje 2rz. (eksport/udostępnij) · ▸ Historia/AI |
| **PPM na rekordzie (w liście)** | Otwórz · Podgląd · —— · Edytuj · Powiel · Zmień nazwę · —— · Eksport ▸ · Udostępnij · Przenieś ▸ · —— · AI: uzupełnij · —— · Archiwizuj · Usuń |

### Archetyp D — MATRYCA/TABELA (Assessment, Tabele, RACI, Megatrend)

| Strefa | Zawartość |
|--------|-----------|
| **M1** | ← powrót · tytuł · status · zapis · [indeks] · **PRIMARY**: „Generuj raport" / „Generuj inicjatywy" |
| **M2** | Toolbar tabeli (gdy edytowalna): wstaw wiersz/kolumnę · format komórki · formuła · sortowanie |
| **M3** (klasa L) | Nawigacja wewn. pill: Ocena · Mapa · Raporty · Inicjatywy (Assessment) · **[AI]** (prawa) |
| **RAIL** | Struktura/nawigator (osie DRD, wymiary SIRI, obszary) — **znika w prostej tabeli** |
| **PANEL** | ▸ Szczegół komórki/obszaru (poziom, dowody, notatki) · ▸ Formuła/scoring · ▸ Powiązania · ▸ Historia/AI |
| **PPM na komórce** | Ustaw poziom ▸ · Dodaj dowód · Notatka · —— · Wyczyść |
| **PPM na wierszu/obszarze** | Rozwiń · Oceń · Historia · —— · Reset |

### Archetyp E — DECK (Presentation)

| Strefa | Zawartość |
|--------|-----------|
| **M1** | ← powrót · tytuł · status · zapis · [indeks] · **PRIMARY**: „Eksportuj/Prezentuj" |
| **M2** | Toolbar slajdu: układ ▾ · tekst · obraz · kształt · wykres/tabela |
| **M3** | Widok: dodaj slajd · duplikuj · przejście · **[AI: komponuj slajd]** (prawa) |
| **RAIL** | Nawigator slajdów (miniatury) + biblioteka źródeł-artefaktów |
| **PANEL** | ▸ Układ slajdu · ▸ Brand kit · ▸ Właściwości · ▸ Eksport · ▸ AI |
| **PPM na slajdzie** | Duplikuj · Przenieś ▸ · Ukryj · Zmień układ ▸ · —— · Usuń |

---

## 6. Katalog elementów — jeden alfabet dla całej aplikacji

**Zasada:** jedna ikona = jedno znaczenie, wszędzie. Jedno miejsce kanoniczne dla każdej akcji.
**Biblioteka ikon:** `lucide-react`, zgodnie z `docs/ui-standards/00-foundation/ICONOGRAPHY_AND_ACTION_STANDARD.md`. Nazwy poniżej są mapowaniem kanonicznym; odstępstwo wymaga zmiany centralnego rejestru akcji.

### 6.1 Akcje na obiekcie (globalne)

| Akcja | Ikona kanoniczna | Miejsce kanoniczne | Też w |
|-------|-----|-------------------|-------|
| Otwórz | `maximize-2` / `arrow-up-right` | klik w wiersz | PPM (1) |
| Podgląd | `eye` | kebab | PPM (1) |
| Edytuj | `pencil` | PANEL / PPM | M3 gdy widok |
| Zmień nazwę | `text-cursor` | PPM | inline w M1 |
| Powiel | `copy` | PPM | kebab |
| Przenieś do | `folder-input` | PPM ▸ | kebab |
| Eksportuj | `download` / `file-output` | PANEL ▸ (PDF/Word/PPTX) | PPM ▸ |
| Udostępnij | `share-2` | M1 primary lub PANEL | PPM |
| Kopiuj link | `link` | PANEL | PPM |
| Komentarz | `message-square` | M3 toggle | PPM |
| Historia/wersje | `history` | PANEL | PPM |
| AI akcja | `sparkles` | M3 prawa / PANEL | PPM |
| Archiwizuj | `archive` | PPM | kebab |
| Usuń (danger) | `trash-2` (kolor danger) | PPM (koniec) | kebab |

### 6.2 Kontrolki widoku (view-local → zawsze M3)

| Akcja | Ikona | Miejsce |
|-------|-----|---------|
| Nowy/Dodaj | `plus` | M3 lewa (primary widoku) |
| Filtruj | `sliders-horizontal` | M3 |
| Sortuj | `arrow-up-down` | M3 |
| Grupuj | `rows-3` | M3 |
| Toggle lista/grid | `layout-grid` / `list` | M3 prawa |
| Szukaj | `search` | M3 lewa |
| Konfiguruj kolumny | `columns-3` | M3 prawa (→ napraw Edit Columns!) |
| Zoom (canvas) | `plus`/`minus`/`maximize` | M3 (canvas) |

### 6.3 Status i cykl życia

| Element | Reguła |
|---------|--------|
| Lifecycle badge | Draft / In Review / Approved / Generated / Failed — jeden system znaczników (statusColors.ts) |
| Stan zapisu | Saved / Saving / Save failed — **OSOBNY** od lifecycle (CANON §4.2) |
| Priorytet | Low/Med/High/Critical — jeden system (getPriorityStyle) |

### 6.4 Stała kolejność w menu prawego kliku (nienaruszalna)

```
1. NAWIGACJA      Otwórz · Podgląd
   ──────────
2. MANIPULACJA    Edytuj · Zmień nazwę · Powiel
   ──────────
3. RELACJE/WYJŚCIE Eksport ▸ · Udostępnij · Kopiuj link · Przenieś ▸
   ──────────
4. AI             AI: uzupełnij · AI: podsumuj
   ──────────
5. DESTRUKCYJNE   Archiwizuj · Usuń (danger, zawsze na końcu)
```
Ta sama kolejność w kebab. Kto zna prawy klik = zna kebab. Przewidywalność = szybkość.

---

## 7. Moje sugestie uzupełnień (jako ekspert — czego jeszcze warto dołożyć)

Piotr prosił o wzbogacenie inwentaryzacji. Rzeczy których jeszcze nie dotknęliśmy, a warto zdecydować teraz niż łatać później:

1. **Stany puste / ładowania / błędu jako część archetypu.** Każdy archetyp potrzebuje zaprojektowanego empty state (nie „No data" — tylko „co zrobić żeby zacząć"), skeletona ładowania i uczciwego błędu (CANON §4.1). Dziś to loteria per moduł.

2. **Preview panel = skrócony archetyp, nie osobny byt.** Gdy klikasz artefakt na liście i otwiera się z prawej — to ma być **M1 artefaktu + centrum (read-only) + „Otwórz pełny"**. Ten sam język, mniej stref. Rozwiązuje „większość preview to dramat".

3. **Tryb read vs edit.** Dokumenty (archetyp B) i Rekordy (C) mają dwa tryby: czytanie (czysto, do prezentacji klientowi) i edycja. Jeden toggle w M3. Dziś pomieszane.

4. **Relacje między artefaktami = pierwszoklasowe.** Skoro wszystko się łączy (źródło→inicjatywa→rezultaty), sekcja „Powiązania" w prawym panelu musi być **standardem w każdym archetypie**, z jednakowym UI linkowania (indeks!). To jest przewaga produktu.

5. **Slot AI wszędzie w tym samym miejscu.** `sparkles` zawsze prawa strona M3 + sekcja AI w prawym panelu. Nigdy AI-akcja wciśnięta losowo. To buduje zaufanie („AI mieszka tu").

6. **Meta-artefakt Template.** Szablon (report/interview/deck) edytuje strukturę innego archetypu → dziedziczy jego anatomię + dokłada tryb „edycja szablonu" (definiujesz sloty, nie treść). Jeden wzorzec zamiast 4 różnych builderów.

7. **Klasa wielkości może się zmieniać.** Prosty rekord (S) który urośnie (dodasz zadania, finanse) → awansuje do L i dostaje M3. Jeden komponent, próg przełączania — nie dwa osobne ekrany.

8. **Skróty klawiszowe = przewidziane teraz, wdrożone później — z WYJĄTKIEM canvasu.** Model akcji (§6)
   już ma sloty; dodanie skrótów globalnych (Cmd+S zapis, Cmd+K paleta, Cmd+Enter primary) = podłączenie
   do istniejących akcji, nie przebudowa. **Dla Archetypu A (Canvas) to NIE jest odłożone bez
   konsekwencji** — patrz §13.3c: brak minimalnego zestawu klawiaturowego canvasu jest zapisany jako
   świadoma luka runtime (CANON §3.2), blokuje `runtime_status` > `PARTIAL` i odbiór DoD §18.1.

9. **Command palette (Cmd+K).** Skoro model akcji jest jednolity, „szukaj akcji" staje się trywialny i daje poczucie aplikacji za miliard $. Warto zaplanować jako naturalną konsekwencję §6.

10. **Densność / rytm.** Jeden system odstępów, wysokości wierszy, rozmiarów ikon (np. 4px grid). „Grafika z lat 90" bierze się często nie z kolorów, a z niespójnej densności. Do skodyfikowania w Alfabecie.

---

## 9. STRUKTURA GRAFICZNA — foundation + elementy (light + dark)

> **Wartości poniżej = wyciągnięte z kodu (src/index.css, tailwind.config, statusColors.ts, typography.ts).** To nie propozycja — to co JEST. Fundament jest kompletny i dobry. Problem = ~4% adherencji. Ten rozdział = przepisy do egzekwowania.

### 9.0 Diagnoza jednym zdaniem
System ma pełną dwutrybowość, paletę HBS, skale HIG, fokus niebieski i danger≠crimson. **Nie brakuje systemu — brakuje jego użycia.** Re-skin = zamiana navy-*/slate-*/hex/primary na role `c.*` + egzekucja przepisów z §9.2.

---

### 9.1 FOUNDATION — atomy (referuje każdy element)

**Role kolorów (zawsze token `c.*`, nigdy hex/navy/slate):**

| Rola | Light | Dark | Użycie |
|------|-------|------|--------|
| `c.bg` | `#fafaf9` | `#0a0f1e` | tło aplikacji |
| `c.surface` | `#ffffff` | `#0f172a` | karty, panele, wiersze |
| `c.surface-raised` | `#f8fafc` | `#15213b` | popovery, chipy, kebab |
| `c.border-subtle` | `#e6e9ed` | `rgba(148,163,184,.12)` | włoskowate linie, dzielniki |
| `c.border` | `#cbd2da` | `rgba(148,163,184,.22)` | ramki domyślne |
| `c.border-strong` | `#9aa6b5` | `rgba(148,163,184,.36)` | hover/active ramki |
| `c.text` | `#0f172a` | `#f4f7fb` | tekst główny |
| `c.text-secondary` | `#475569` | `#b8c4d6` | tekst drugorzędny |
| `c.text-muted` | `#64748b` | `#8a99b0` | placeholder, timestamp |
| `c.accent` | `#85182f` | `#c8324a` | **TYLKO brand moment** (nie fokus, nie status) |
| `c.accent-soft` | `rgba(133,24,47,.08)` | `rgba(200,50,74,.14)` | tło zaznaczenia/selected |
| `c.focus` | `rgba(37,99,235,.4)` | `rgba(91,141,239,.45)` | ring fokus — **NIEBIESKI** |
| `c.success` | `#026833` | `#3fb950` | status pozytywny |
| `c.warning` | `#ae6429` | `#e8a33d` | status ostrzegawczy |
| `c.danger` | `#e80538` | `#ed5565` | błąd/destrukcja — **≠ crimson** |
| `c.info` | `#3b2883` | `#58a6ff` | status informacyjny |
| `c.tag-1…12` | paleta 12 tożsamości | wersje lifted | tagi/właściciele/kategorie (NIE crimson) |

**Typografia (typography.ts — używaj tokenów, nie ad-hoc):**

| Token | Definicja | Użycie |
|-------|-----------|--------|
| L1 | 11px semibold UPPERCASE tracking .16em, text-muted | kicker sekcji |
| L2 | 13px semibold, text | tytuł elementu/wiersza/karty |
| L3 | 13px normal 1.6, text-secondary | treść główna |
| L4 | 12px normal, text-muted | treść wspierająca |
| L5 | 11px normal, text-muted | caption, timestamp |
| N | 22px semibold tabular-nums | metryka/KPI |
| Q | 13px italic 1.65 | cytat uczestnika |

Font: **Inter** (UI). Playfair Display TYLKO brand/editorial — nie w produkcie.

**Kształt / głębia / rytm:**

| Wymiar | Wartości | Reguła |
|--------|----------|--------|
| Radius | xs 6 · sm 8 · **md 12** · lg 16 · xl 20 · pill 9999 | input=md, karta/przycisk=lg, modal=xl, chip/pill=pill |
| Spacing | 4·8·12·16·20·24·32·40·48 (skala hig) | siatka 4px; nic poza skalą |
| Shadow | hig-sm…2xl (light) / hig-dark-* (dark, mocniejsze) | karta=md, popover=lg, modal=2xl |
| Fokus | `0 0 0 3px c.focus` (niebieski) | **każdy** interaktywny; nigdy crimson |
| Ikony | lucide-react; 12 / **16** / 20 / 24 | wiersz=16, przycisk=16, topbar=20, micro=12 |
| Motion | 100/200/300/400ms; ease `cubic-bezier(.4,0,.2,1)` | ≤220ms; zero bounce w produkcie |

---

### 9.1a Nota rozstrzygająca — szerokość prawego panelu / preview (SYS-2, KOREKTA 2026-08-02)

**Ta nota była błędna w poprzedniej redakcji (patrz CHANGELOG 2026-08-02, wpis 1) i jest tu poprawiona.**
Poprzednia wersja sprowadzała pięć niezgodnych liczb do jednej wartości (420px dla preview listowego),
na błędnej przesłance że preview listowy i prawy panel artefaktu to jedna powierzchnia. Weryfikacja w
kodzie (`grep -rn "clamp(340px" src/components/`, `grep -rln "TableWithPreviewLayout" src/ | wc -l`) oraz
w `docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md` §4 (który niezależnie doszedł do tego
samego rozstrzygnięcia) pokazuje, że to są **DWIE RÓŻNE powierzchnie**, którym wolno mieć różne wartości:

**Uzupełnienie K-22 (panel adwersaryjny, 2026-08-02): ta korekta NIE była kompletna.** Ten sam dokument
miał jeszcze DWA wystąpienia szerokości nieobjęte powyższą redakcją — §9.2b ⑯ Drawer/Sheet i §15.2
prawy panel instrumentu. Poniższa numeracja (1-4) to niezmieniony tekst korekty SYS-2; punkty 5-6 to
domknięcie tych dwóch pominiętych wystąpień.

**1. Preview listowy** (SPEC-L, panel podglądu przy tabeli — §9.2⑬, §11.1, §14.5): **`clamp(340px, 28%,
480px)`**. To NIE jest dług do zamknięcia — to zaimplementowany i wdrożony kanon. SSOT kodu:
`shared/TableWithPreviewLayout.tsx:437,455` (kanoniczny orkiestrator preview, **18 konsumentów JSX** —
`grep -rl "<TableWithPreviewLayout" src/`, metoda K-28, 2026-08-02: MyTasksListContent,
DecisionsPanelContent, IdeasTableContent, MyIdeasListContent, DiscoveryToolsHub, InitiativesHub,
PortfolioAnalysisView, AgentHubShell, Results*, InterviewHub, QuestionsList, BenefitsHub, ReportsHub i
in. — surowa wzmianka stringa `TableWithPreviewLayout`, licząc import+typy+komentarze, daje 28, patrz
§14.0. Osobno, POWTÓRZONA NIEZALEŻNIE jako skopiowana wartość liczbowa — nie import komponentu — w
`InboxContent.tsx:3977`, `DecisionPreviewPanel.tsx:813,830`, `FocusView.tsx:1847,1856`). Wartość
identyczna z `TRIADA_KANON.md` §C9 — kanon list i kod **już się zgadzają**.

**2. Prawy panel właściwości / drawer formularzowy** (SPEC-A, powierzchnia artefaktu — §9.2⑪, §11.2):
domyślnie **360 px**, dozwolony zakres **320–420 px**, drawer formularzowy szeroki **420 px** — zgodnie
z FOUNDATION_TOKEN_CONTRACT §4. To inna strefa (prawy panel artefaktu ⑪, nie preview ⑬) — wolno jej mieć
własną wartość, niezależną od preview listowego.

**3. Wycofane jako kanon** (bez implementacji w kodzie — były wewnętrznymi sprzecznościami tego
dokumentu, nie realnymi wariantami): **320–380** (dawne §9.2⑪ sprzed korekty SYS-2), **400–480** (dawne
§9.2⑬ sprzed korekty SYS-2). FOUNDATION_TOKEN_CONTRACT §4 ich nie zna, kod ich nie implementuje.

**4. Zarejestrowany dług** (poza zakresem tej redakcji, nie kanon):
`src/components/MyWork/MyProjects.tsx:864,1084` (`w-[420px] shrink-0`) — bespoke `<aside>` omijający
`TableWithPreviewLayout` (poza SSOT §14.0). MyProjects to LISTA, więc powinien używać preview listowego
(`clamp(340px,28%,480px)`), nie własnej stałej 420px. `src/components/MyWork/IdeaTableTool.tsx` używa
**460 i 480 px** — poza zakresem obu powierzchni, dług do zamknięcia, nie dozwolony wariant.

**5. Drawer/Sheet ogólny (⑯, §9.2b)** — INNA powierzchnia niż preview listowy (pkt 1) i prawy panel
artefaktu (pkt 2): komponent nakładkowy ogólnego przeznaczenia (formularze, ustawienia, dowolna treść
boczna wywołana z dowolnego miejsca), nie tylko artefakt. Realny kod
(`src/components/ui/primitives/Drawer.tsx` `sizeStyles`, l.48-59) ma **cztery dyskretne warianty, nie
zakres ciągły**: `sm`=256px · `md`=320px · `lg`=384px · `xl`=480px (+`full`=100vw). Poprzedni zapis w
§9.2b („360–480") nie odpowiada żadnej z tych granic — **poprawiony na 256–480px, warianty sm/md/lg/xl**,
z jawną adnotacją, że to cztery ustalone wartości `Drawer.tsx`, nie `clamp()`. Zbieżność z „drawerem
formularzowym szerokim = 420px" (pkt 2) jest **przybliżeniowa** — 420px leży między `lg`(384) i
`xl`(480), nie jest żadnym z czterech wariantów kodu; to zarejestrowany dług, nie kanon zamknięty.

**6. Prawy panel instrumentu (§15.2)** — TA SAMA powierzchnia co prawy panel artefaktu ⑪ (pkt 2), nie
osobna, i nie miała powodu mieć własnej wartości. Poprzedni zapis „320–360" był węższym, nieuzasadnionym
podzbiorem kanonu 320–420: `grep` po komponentach instrumentów (Kanban/Gantt/Dashboard/Matrix) nie
znalazł żadnej odrębnej stałej szerokości panelu instrumentu w kodzie — nie ma tam nic do
zaimplementowania osobno. **Poprawiony na 360 (zakres 320–420), zgodnie z ⑪** — patrz też §11.3 „panel
360" (Reguła twarda SPEC-I), który już zgadzał się z tą wartością.

---

### 9.2 ELEMENTY — anatomia + light/dark

Każdy element referuje 9.1. Podane tylko odchylenia od foundation.

**① Przycisk** (rozstrzyga „czarne przyciski — lepiej"?: TAK, primary=navy/high-contrast, NIE crimson)

| Wariant | Light | Dark | Kiedy |
|---------|-------|------|-------|
| primary | bg `#0f172a` / text biały | bg `#f4f7fb` / text navy | jedna główna akcja (M1 CTA) |
| secondary | bg transp, border `c.border`, text `c.text` | j.w. | akcje drugorzędne |
| danger | bg `c.danger`, text biały | j.w. lifted | tylko destrukcja |
| ghost | transp, hover `c.surface-raised` | j.w. | akcje w wierszu/toolbarze |
| Wspólne | radius lg, 12px×h-9, ikona 16 + label, fokus niebieski | | **przycisk ZAWSZE z etykietą** (filar 4) |

**② Chip akcji (Menu 3)** — problem z walkthrough „bez ramek":
- struktura: ikona 16 + label, radius pill, border `c.border`, bg `c.surface`
- hover: bg `c.surface-raised`, border `c.border-strong`
- active/selected: bg `bg-state-selected` (neutralne, token `--state-selected`), text `c.text` — **NIE `c.accent-soft`** (SYS-1, rozszerzone §14.2)
- **fix A-3:** każdy chip Menu 3 dostaje `border c.border` (dziś brak)

**③ Tab Menu 2 (pill)** — regresja z walkthrough „plain text zamiast pill":
- kontener: bg `c.surface-raised`, radius pill, padding 4
- tab nieaktywny: text `c.text-secondary`, transparent
- tab aktywny: bg `c.surface`, text `c.text`, shadow hig-sm, radius pill
- **fix A-2:** przywrócić ten wzorzec (My Work go ma) w Notebook/Interview/Results

**④ Badge statusu** (3-tier, już w statusColors.ts — egzekwować):

| Tier | Light | Dark | Statusy |
|------|-------|------|---------|
| alarm | bg danger-100, text danger-700, kropka danger-500 | bg danger-500/20 | BLOCKED, REJECTED, overdue |
| subtle-green | bg emerald-50/70, text emerald-600 | bg emerald-500/10 | DONE, APPROVED, ACTIVE |
| subtle-blue | bg blue-50/70, text blue-600 | bg blue-500/10 | IN_PROGRESS, SCHEDULED |
| subtle-amber | bg amber-50/70, text amber-600 | bg amber-500/10 | PENDING, IN_REVIEW |
| neutral | bg slate-100, text slate-600 | bg navy-800/60 | DRAFT, ARCHIVED |
- struktura: kropka 6px + label L5; radius pill. **Nigdy crimson na status** (crimson≠semantyka).

**⑤ Input / Select / Search**
- bg `c.surface`, border `c.border`, radius md, text L3, placeholder `c.text-muted`
- focus: border `c.focus-solid` + ring niebieski; hover: border `c.border-strong`
- ikona wiodąca 16 `c.text-muted` (search/select)

**⑥ Karta**
- bg `c.surface`, border `c.border-subtle`, radius lg, shadow hig-md (dark: hig-dark-md)
- hover (klikalna): border `c.border`, shadow hig-lg, transform none
- padding 16; tytuł L2, treść L3/L4

**⑦ Wiersz listy + nagłówek** (SPEC-L rdzeń)
- nagłówek: L1 (UPPERCASE) `c.text-muted`, bg `c.surface`, border-bottom `c.border-subtle`, ikona sortu 12
- wiersz: h-11/12, tytuł L2, meta L4, dzielnik `c.border-subtle`
- hover: bg `c.surface-raised`; **selected: neutralne/niebieskie** `bg-slate-50 dark:bg-white/[.06]` + lewy pasek neutralny 2px (**NIE crimson** — SYS-1; szczegół §14.2)
- checkbox multi-select: h-3.5 (body)/h-4 (all), border `c.border`, checked neutralny — **fix A-1 (multi-select systemowy)**

**⑧ Kebab / menu kontekstowe (PPM)** (SPEC wspólny, kolejność z §6.4)
- kontener: bg `c.surface-raised`, border `c.border`, radius md, shadow hig-lg, padding 4
- pozycja: ikona 16 + label L3, h-8, radius sm, hover bg `c.surface`
- sekcje oddzielone dzielnikiem `c.border-subtle`; „Usuń" = text `c.danger`, na końcu
- **fix A-6:** ubogie kebaby (Notebook) → pełen zestaw wg §6.4

**⑨ Konfigurator kolumn (Edit Columns)** — dramat z walkthrough (A-4):
- ZASTĄP: ikony eye 16 `c.text-muted` (NIE czerwone); label kolumny = L3 normalny case (NIE UPPERCASE)
- instrukcja „drag to reorder" → `title`/tooltip, NIE body text
- struktura: uchwyt-drag 12 + label L3 + toggle eye; wiersze radius sm hover `c.surface-raised`

**⑩ Lewy rail (narzędzia canvasu)** — wzorzec z Ideas do rozniesienia:
- kontener: bg `c.surface`, border-right `c.border-subtle`, szer. ~56 (ikony) lub ~200 (z label)
- narzędzie: ikona 20, h-10, radius md, tooltip; active bg `bg-state-selected` (neutralne — **NIE `c.accent-soft`**, SYS-1)
- **znika całkowicie gdy pusty** (nie rezerwuje miejsca)

**⑪ Prawy panel (sekcje rozwijane)**
- kontener: bg `c.surface`, border-left `c.border-subtle`, szer. **360 (zakres 320–420)** — SYS-2 §9.1a
- sekcja accordion: nagłówek L1 + chevron 16; treść padding 16
- pole właściwości: label L4 `c.text-muted` + wartość L3; dzielnik `c.border-subtle`

**⑫ Menu 1 artefaktu (pasek tożsamości)**
- wys. 48, bg `c.surface`, border-bottom `c.border-subtle`
- lewa: ← 20 + ikona-typ 16 + tytuł L2 (edytowalny inline) + status badge + „zapisano" L5 `c.text-muted`
- prawa: [indeks] ghost + jeden primary (navy)

**⑬ Preview pane** (= skrócony Artefakt, A-5):
- struktura: Menu 1 artefaktu (read-only) + centrum read-only + stopka „Otwórz pełny" (primary)
- ten sam język co pełny artefakt, mniej stref; szer. **`clamp(340px, 28%, 480px)`** (preview listowy — INNA powierzchnia niż prawy panel artefaktu), border-left `c.border` — SYS-2 §9.1a

**⑭ Stany empty / loading / error** (część każdej powierzchni):
- empty: ikona 24 `c.text-muted` + L2 tytuł + L4 opis + primary „co zrobić" (NIE „No data")
- loading: skeleton bg `c.surface-raised` puls higSkeleton; zachowaj layout
- error: ikona `c.danger` + komunikat ludzki L3 + akcja retry (CANON §4.1 — nigdy raw/`[object Object]`)

---

### 9.2b ELEMENTY — dopełnienie ze skanu kodu (26 powtarzalnych, wszystkie referują 9.1)

Skan realnych komponentów (src/components/ui/**) wykrył 26 typów poza pierwszymi 14. Podane tylko odchylenia od foundation.

**A) Overlaye (nakładki)**

| # | Element | Struktura + light/dark | Uwaga |
|---|---------|------------------------|-------|
| ⑮ | Modal / Dialog | bg `c.surface`, radius xl, shadow hig-2xl, backdrop `rgba(0,0,0,.4)`+blur; nagłówek L2 + ×; stopka = przyciski; rozmiary sm/md/lg/xl/full | ≠ preview (⑬); focus-trap+Esc |
| ⑯ | Drawer / Sheet | bg `c.surface`, border `c.border`, slide 200ms; szer. **256–480** (warianty dyskretne sm/md/lg/xl `Drawer.tsx`, NIE zakres ciągły — SYS-2 §9.1a pkt 5); nagłówek L2 + × | boczny panel akcji |
| ⑰ | Popover | bg `c.surface-raised`, border `c.border`, radius md, shadow hig-lg | edycja inline w komórce |
| ⑱ | Tooltip | bg `c.text` / text `c.bg` (odwrócone), radius sm, L5, delay 300ms | krótka podpowiedź hover |
| ⑲ | Toast / snackbar | bg `c.surface`, border-left 3px semantyczny (success/danger/warn/info), radius md, shadow hig-lg, auto-dismiss | wariant = kolor semantyczny, NIE crimson |
| ⑳ | Command Palette (Cmd+K) | modal centralny, bg `c.surface`, search L3 + lista wyników ikona 16+L3, grupy L1 | już istnieje — spiąć z modelem akcji §6 |

**B) Kontrolki formularza**

| # | Element | Struktura + light/dark | Uwaga |
|---|---------|------------------------|-------|
| ㉑ | Checkbox | 16, border `c.border`, radius xs, checked bg `c.info` + check biały (**NIE `c.accent`** — SYS-1; zgodne z realną implementacją `bg-c-focus-solid` w `src/components/ui/checkbox.tsx`, ta sama niebieska rodzina); indeterminate = myślnik | rdzeń multi-select (A-1) |
| ㉒ | Radio | 16, border `c.border`, selected kropka `c.info` (**NIE `c.accent`** — SYS-1, sama rodzina co checkbox ㉑ `bg-c-focus-solid`) | grupy wyboru |
| ㉓ | Toggle / Switch | tor 36×20 radius pill; off bg `c.border`, on bg `c.success` (**NIE `c.accent`** — usunięto dwuznaczność „lub", SYS-1); gałka biała | ustawienia binarne |
| ㉔ | Slider | tor `c.border` h-1, wypełnienie `c.info` (**NIE `c.accent`** — SYS-1, sygnał kierunkowy jak progress), gałka 16 biała border `c.border` | parametry AI/workload |
| ㉕ | Textarea / Input / Label | jak ⑤; Label = L4 `c.text-secondary` nad polem | spójne z input |

**C) Sprzężenie zwrotne (feedback)**

| # | Element | Struktura + light/dark | Uwaga |
|---|---------|------------------------|-------|
| ㉖ | Progress bar | tor `c.surface-raised` h-1.5 radius pill, wypełnienie `c.info` (@100% `c.success`) — **NIE `c.accent`** (SYS-1; zgodne z §14.2: „wypełnienie `bg-c-info`, @100% `bg-c-success`"); label N/L5 | 235 użyć — ujednolicić |
| ㉗ | Progress ring | okrąg `c.border`, łuk `c.info` (@100% `c.success`) — **NIE `c.accent`** (SYS-1, ten sam wzorzec co ㉖); środek = N | KPI/gate readiness |
| ㉘ | Skeleton | bg `c.surface-raised`, puls higSkeleton; kształt = docelowy layout | wariant per powierzchnia |
| ㉙ | Spinner | okrąg 16–24, `c.info` (**NIE `c.accent`** — SYS-1, spójne z progress ㉖㉗), higSpin | inline loading |
| ㉚ | Alert / Banner inline | bg semantyczny-soft, border-left 3px, ikona 16 + L2 tytuł + L3 opis | info/warn/error w treści |

**D) Nawigacja / struktura**

| # | Element | Struktura + light/dark | Uwaga |
|---|---------|------------------------|-------|
| ㉛ | Breadcrumb | L4 `c.text-muted`, separator „/" `c.border-strong`, ostatni `c.text` | ścieżka powrotu (Menu 1) |
| ㉜ | Tabs underline | NIE mylić z pill ③; underline `c.info` 2px (**NIE `c.accent`** — SYS-1, sygnał kierunkowy „która zakładka aktywna", ta sama rola co checkbox/stepper), tab `c.text-secondary`→`c.text` | **decyzja: pill=Menu 2 modułu, underline=wewnątrz artefaktu** |
| ㉝ | Accordion / Collapsible | nagłówek L2 + chevron 16 obrót 200ms; body padding 16 | poza prawym panelem |
| ㉞ | Stepper / Wizard | krok = kółko 24 (aktywny bg `c.info` — **NIE `c.accent`**, SYS-1, sygnał kierunkowy; zrobiony `c.success`✓, przyszły `c.border`) + L4; łącznik `c.border` | generatory/onboarding — zachowanie: §13.7 |
| ㉟ | Pagination | przyciski ghost 32, aktywny bg `bg-state-selected` (neutralne — **NIE `c.accent-soft`**, SYS-1) text `c.text` | listy z paginacją |
| ㊱ | Divider / Separator | `c.border-subtle` 1px | sekcje |

**E) Tożsamość / dane**

| # | Element | Struktura + light/dark | Uwaga |
|---|---------|------------------------|-------|
| ㊲ | Avatar / user chip | okrąg 24/32, inicjały L5 na `c.tag-n` (z palety 12, deterministyczny hash), ring `c.surface`; grupa = stack -8 | NIE crimson dla usera |
| ㊳ | Metric card / KPI tile | bg `c.surface`, border `c.border-subtle`, radius lg; N wartość + L1 label + trend semantyczny + sparkline | dashboardy/Results |
| ㊴ | DataTable (composed) | = wiersz ⑦ + nagłówek + paginacja ㉟ + filtr; sortowalny | generyczna tabela |
| ㊵ | SearchInput (composed) | = input ⑤ + ikona search 16 + podpowiedzi popover ⑰ | wyszukiwarki |

**F) Wizualizacje domenowe (instrumenty)** — reguła palety krytyczna

| # | Element | Struktura + light/dark | Uwaga |
|---|---------|------------------------|-------|
| ㊶ | Kanban card | = karta ⑥ mniejsza; pasek statusu 3px semantyczny; drag = shadow hig-lg + opacity | tablice zadań/decyzji |
| ㊷ | Gantt / timeline bar | belka radius sm, kolor = `c.tag-n` per workstream (NIE crimson); dziś=teraz linia `c.accent` | Roadmap/capacity |
| ㊸ | Wykresy (radar/heatmap/donut/funnel/bar) | serie danych z palety `c.tag-1…12` + semantyczne dla stanów; osie `c.text-muted`, siatka `c.border-subtle` | **crimson NIGDY jako seria danych** |

**Reguła nadrzędna dla wizualizacji (㊷㊸):** kolory serii = paleta 12 tożsamości (`c.tag-*`), stany = semantyczne (success/warn/danger). Crimson `c.accent` = tylko akcent brandu/„teraz", nigdy dane. To rozwiązuje losowe kolory (lime/pomarańcz) z walkthrough M15.

---

### 9.3 Reguły egzekucji (żeby nie wrócił dług)
1. Kolor tylko przez `c.*`. Zero `navy-*`/`slate-*`/hex w nowym kodzie (ESLint gate — Fala 0).
2. `primary`(crimson) NIGDY na: fokus, status, badge domyślny, tło AI-bąbla, ikonę empty-state.
3. Fokus zawsze niebieski `c.focus`. Danger zawsze `c.danger` (nie crimson).
4. Każdy element = jeden z §9.2. Brak lokalnych wariantów (CANON §1).
5. Light i dark testowane oba (DoD §5).

---

## 10. SPECYFIKACJE POWIERZCHNI — z czego się składają (kompozycja)

> **Zasada rdzenia:** Lista i Artefakt to **ta sama powłoka** (Menu 1/3, kebab, prawy panel, preview, stany, overlaye). Różni je **wyłącznie centrum**: Lista ma tabelę wierszy, Artefakt ma centrum archetypu. Instrument reużywa te same atomy, wolność ma tylko w układzie centrum. **Żadna powierzchnia nie wymyśla własnych atomów — składa z puli 40 (§9).**

### 10.0 Macierz kompozycji (co, gdzie, z czego)

Odwołania `①…㊸` = numery elementów z §9.2 / §9.2b.

| Strefa | LISTA | ARTEFAKT | INSTRUMENT |
|--------|-------|----------|------------|
| Menu 1 | pasek modułu: tytuł + `①`Nowy | pasek artefaktu `⑫`: `㉛`breadcrumb + ikona-typ + tytuł-inline + `④`status + zapis + [indeks] + `①`primary | zależnie od hosta (często brak / dziedziczy) |
| Menu 2 | `③`pill-tabs (funkcjonalności) | wg archetypu: B=formatowanie · D/E=toolbar · A/C=brak | zwykle brak |
| Menu 3 | `㊵`search · `⑰`filtr · sort · group · `⑨`kolumny · view-toggle · `②`chipy(multi-select) · `①`[AI] | nawigacja wewn. `③`/`㉜` + view-local + `①`[AI] | akcje instrumentu jako `②`chipy + `①`[AI] |
| Lewy rail | — | `⑩` tylko archetyp A (znika gdy pusty) | opcjonalnie (biblioteka węzłów/źródeł) |
| **Centrum** | `⑦`nagłówek+wiersze · `㉑`checkbox · `④`badge · `㊲`avatar · `㉟`paginacja | **archetyp**: A canvas · B rich-text · C sekcje-pól · D grid · E slajdy | **wolne**: `㊶`kanban / `㊷`gantt / `㊴`tabela-steruj. / `㊳`+`㊸`dashboard / `㊞`wizard |
| Prawy panel | `⑬`preview (skrócony artefakt) | `⑪` `㉝`accordion: akcje·właściwości·powiązania·historia/AI·komentarze | `⑪` szczegół zaznaczenia |
| PPM / kebab | `⑧` (kolejność §6.4) | `⑧` kontekstowy | `⑧` na elemencie |
| Stany | `⑭` empty/`㉘`loading/error | `⑭` | `⑭` |
| Overlaye | `⑮`modal · `⑲`toast · `⑱`tooltip · `⑳`Cmd+K | te same | te same |

### 10.1 SPEC-L — LISTA (tabela zbioru)

**Z czego się składa (kolejno):**
1. **Menu 1 (modułu):** tytuł modułu + `①`primary „Nowy" (prawa).
2. **Menu 2:** `③`pill-tabs = funkcjonalności modułu (np. My Work: Ideas/Notebook/Tasks/Decisions). **Zawsze pill, nigdy plain** (fix A-2).
3. **Menu 3:** `㊵`search (lewa) · `⑰`filtr · sort · group · `⑨`konfig-kolumn · view-toggle lista/grid (prawa) · `①`[AI] (skraj prawy). Po zaznaczeniu wierszy → w tym samym pasku `②`chipy akcji **w ramkach** (fix A-3).
4. **Centrum:** `⑦`nagłówek (L1 UPPERCASE, sort) → `⑦`wiersze (`㉑`checkbox multi-select · tytuł L2 · `④`status · `㊲`avatar · meta L4) → `㉟`paginacja. Multi-select = `㉑` systemowy (fix A-1).
5. **Prawy panel (opcjonalny):** `⑬`preview po zaznaczeniu = Menu 1 read-only + centrum read-only + „Otwórz pełny".
6. **PPM/kebab:** `⑧` wg §6.4.
7. **Stany:** `⑭` empty (ikona+L2+L4+`①`CTA) / `㉘`loading / error.
8. **Overlaye:** `⑮`quick-create/confirm-delete · `⑲`toast po akcji · `⑱`tooltip.

**Reguły:** dokładnie jeden Menu 3 (CANON §4.5); brak 2. rzędu toolbara; kolumny stałe = `⑨` a nie ad-hoc; SSOT = TABLE_AND_PREVIEW_CANON.

### 10.2 SPEC-A — ARTEFAKT (wspólne dla A–E, delty per archetyp)

**Powłoka wspólna (identyczna dla wszystkich 5 archetypów — TO JEST RDZEŃ):**
1. **Menu 1 `⑫`:** `㉛`breadcrumb ← · ikona-typ · tytuł inline (L2) · `④`status lifecycle · „zapisano" L5 · [indeks] · `①`primary (przejście stanu / udostępnij / generuj).
2. **Menu 3:** nawigacja wewn. (klasa L) jako `③`pill (poziom modułu) lub `㉜`underline (wewnątrz artefaktu) + view-local + `①`[AI] (prawa). Klasa S: brak Menu 3.
3. **Prawy panel `⑪`:** `㉝`accordion — sekcje w stałej kolejności: **Akcje 2rz.** (`①`eksport▸/udostępnij) · **Właściwości** (pola: label L4 + wartość L3, `㊲`avatar, `㉓`switch, `㉔`slider) · **Powiązania** (linki do artefaktów — first-class) · **Komentarze** · **Historia/AI** (`sparkles`).
4. **PPM/kebab `⑧`, stany `⑭`, overlaye `⑮⑰⑱⑲`** — identyczne jak Lista.

**Delty centrum + Menu 2 per archetyp:**

| Arch. | Centrum | Menu 2 | Lewy rail |
|-------|---------|--------|-----------|
| A Canvas | React-flow / spatial | — | `⑩` narzędzia (znika gdy pusty) |
| B Dokument | rich-text bloki | `③`+formatowanie (B/I/U, nagłówki, listy) | — (lub outline) |
| C Rekord | sekcje pól (klasa S: nośnik=prawy panel) | — | — |
| D Matryca | grid komórek | toolbar tabeli/matrycy | struktura (osie/wymiary) |
| E Deck | slajdy | toolbar slajdu (`㊸`wykresy) | `⑩` nawigator slajdów + źródła |

**Reguła:** archetyp zmienia TYLKO centrum + Menu 2 + rail. Cała reszta powłoki = wspólna. Inicjatywa (C-L, 20 ekranów) i arkusz pytań (C-S, 1 ekran) mają **tę samą powłokę**, różną gęstość.

### 10.3 SPEC-I — INSTRUMENT (przyrządy — zmienne, ale z tych samych atomów)

**Nienaruszalne:** instrument **nie tworzy własnych elementów** — składa z puli 40. Wolność = tylko układ centrum.

**Wspólny minimalny zestaw:** `①`przyciski · `②`chipy · `④`badge · `⑥`karta · `⑧`kebab · `⑱`tooltip · `⑭`empty/loading · `⑪`panel szczegółu.

**Podtypy (centrum):**
| Podtyp | Centrum z | Reguła |
|--------|-----------|--------|
| Tablice | `㊶`kanban-card / `㊷`gantt-bar / matrix-grid | drag=shadow hig-lg; kolor belek=`c.tag-*` nie crimson |
| Tabele sterujące | `㊴`DataTable + `⑰`inline-edit popover | edycja w komórce, nie osobny ekran |
| Dashboardy | `㊳`metric-tile + `㊸`wykresy | serie=`c.tag-*`; nagłówki L1 |
| Wizardy | `㊞`stepper + kontrolki formularza `㉑㉒㉓㉔⑤` | krok zrobiony=`c.success`✓ |

**Reguła palety (krytyczna):** serie danych/kategorie = paleta 12 (`c.tag-*`), stany = semantyczne, „teraz/akcent" = `c.accent`. Crimson **nigdy** jako dane (fix losowych lime/pomarańcz z M15).

### 10.4 Dlaczego to działa (dla Piotra)
Napisz powłokę raz (Menu 1/3 + kebab + prawy panel + preview + stany + overlaye) — dostajesz ją **za darmo w każdej Liście i każdym Artefakcie**. Programista budujący nowy ekran nie projektuje wyglądu — wybiera powierzchnię, wskazuje centrum, resztę dziedziczy. To jest mechanizm, który sprawia że apka wygląda na wartą miliardy: **wewnętrzna spójność nie z dyscypliny, tylko z architektury.**

---

## 11. SPECYFIKACJE BUILD-READY — 3 powierzchnie (wymiary · tokeny · stany · zachowania)

> Precyzja do wdrożenia. Wymiary w px (siatka 4). Tokeny `c.*` (light/dark z §9.1). Elementy `①…㊸` z §9. Gdzie istnieje SSOT (app-topbar, TABLE_AND_PREVIEW) — ten spec go doprecyzowuje, nie nadpisuje.

---

### 11.1 SPEC-L — LISTA (build-ready)

**Wymiary stref (góra→dół):**
| Strefa | Wys. | Padding-x | Tło | Dolna krawędź |
|--------|-----:|----------:|-----|---------------|
| Menu 1 modułu | 56 | 24 | `c.surface` | `c.border-subtle` |
| Menu 2 pill | 44 | 24 | `c.bg` | — |
| Menu 3 | 44 | 24 | `c.bg` | `c.border-subtle` |
| Nagłówek tabeli | 40 | 16 | `c.surface` (sticky) | `c.border-subtle` |
| Wiersz | 44 | 16 | `c.surface` | `c.border-subtle` |
| Paginacja | 48 | 24 | `c.surface` | — |

**Elementy per strefa (dokł.):**
- **Menu 1:** tytuł modułu 15px/semibold/`c.text` (lewa); `①`primary „Nowy" h-36 radius-lg (prawa). Zero innych przycisków.
- **Menu 2:** `③`kontener pill bg `c.surface-raised` radius-pill p-4; tab h-32 px-12 L3; aktywny bg `c.surface` +shadow-hig-sm.
- **Menu 3 (lewa→prawa):** `㊵`search w-256 h-32 · `⑰`Filtr · Sortuj · Grupuj (chipy `②` h-32 border `c.border` radius-pill) ‖ (prawa) view-toggle lista/grid seg 2×32 · `⑨`kolumny ikon-32 · `①`[AI] `sparkles`. **Multi-select aktywny → w tym samym pasku wchodzą `②`chipy akcji (Eksport/Przenieś/Archiwizuj/Usuń) w ramkach + licznik „N zazn."**
- **Nagłówek:** kol. checkbox 40 (`㉑`select-all) · kolumny L1-UPPERCASE `c.text-muted` + ikona-sort 12; klik=sort, drugi klik=odwróć.
- **Wiersz:** `㉑`checkbox 40 · tytuł L2 `c.text` (link→open) · kolumny L4 `c.text-muted` · `④`status-badge · `㊲`avatar-24 · na hover z prawej mikro-`⑧`kebab.

**Stany wiersza:**
| Stan | Tło | Dodatek |
|------|-----|---------|
| default | `c.surface` | — |
| hover | `c.surface-raised` | pokaż kebab |
| selected | neutralne/niebieskie (NIE crimson, SYS-1) | lewy pasek 2px neutralny — patrz §14.2 |
| focus (klawiatura) | `c.surface-raised` | ring `0 0 0 2px c.focus` inset |
| disabled/locked | `c.surface` | ikona-lock 12 `c.text-muted`, opacity-60 |

**Prawy panel (preview):** szer. `clamp(340px, 28%, 480px)` (preview listowy, SYS-2 §9.1a), border-left `c.border`. `⑬` = Menu1 read-only + centrum read-only + stopka `①`„Otwórz pełny". Pojawia się przy zaznaczeniu 1 wiersza; przy multi → zamiast preview „N zaznaczonych" + akcje zbiorcze.

**Zachowania:**
- Klik w wiersz → preview. Klik w tytuł → pełny artefakt. `㉑`checkbox → multi-select.
- Multi: Shift=zakres, Cmd/Ctrl=toggle, nagłówek=wszystko.
- Klawiatura: ↑↓ nawigacja, Space=zaznacz, Enter=otwórz, `⑳`Cmd+K=paleta.
- Responsywność: <1024 preview → `⑯`drawer; kolumny znikają wg priorytetu (tytuł+status zostają).
- Stany zbioru: `⑭`empty (ikona-24+L2+L4+`①`CTA) · `㉘`skeleton-rows loading · error z retry.

**Zakazy:** brak 2. rzędu toolbara (CANON §4.5) · brak kolumn ad-hoc (tylko `⑨`) · **brak kolorowych czcionek — cały tekst wyłącznie `c.text`/`-secondary`/`-muted`** (fix „różne kolory czcionki" z M15/M13).

---

### 11.2 SPEC-A — ARTEFAKT (build-ready, powłoka wspólna A–E)

**Wymiary powłoki:**
| Strefa | Wys./Szer. | Padding | Tło | Krawędź |
|--------|-----------:|--------:|-----|---------|
| Menu 1 artefaktu | 60 | px-16 | `c.surface` | dół `c.border-subtle` |
| Menu 2 (archetyp) | 48 | px-16 | `c.bg` | dół `c.border-subtle` |
| Menu 3 | 44 | px-16 | `c.bg` | dół `c.border-subtle` |
| Lewy rail (A) | szer. 56 / 240 | — | `c.surface` | prawo `c.border-subtle` |
| Centrum | wypełnia | wg archetypu | `c.bg`/`c.surface` | — |
| Prawy panel | szer. 360 (320–420) — SYS-2 §9.1a | — | `c.surface` | lewo `c.border-subtle` |

**Menu 1 `⑫` (dokł., lewa→prawa):** `←`back ikon-20 h-32 · `㊱`divider · ikona-typ 16 `c.text-secondary` · tytuł inline L2 (klik→`⑤`input) · `④`status-lifecycle · „Zapisano •" L5 `c.text-muted` ‖ (prawa) `[indeks]` ghost h-32 · `①`primary h-36.

> **★ AKTUALIZACJA 2026-07-22 — kontrakt Menu 1 wg decyzji Piotra (D-A…D-D, fazy 1-2 wdrożone i odebrane).**
> Powód: analiza `_ANALIZA_MENU1_KART_N_2026-07-22.md` (defekty D1-D13) + werdykt `_WERDYKT_KARTY_N_2026-07-22.md`.
> Odbiór niezależny: `_ODBIOR_KARTY_N_2026-07-22/RAPORT.md` (7/7 kart PASS w Menu 1, oba motywy). Implementacja:
> `src/components/shared/NModeLayout/NModeHeader.tsx`. Te cztery punkty **doprecyzowują** linię wyżej — nie zastępują jej.
>
> 1. **Status-lifecycle = ETYKIETA-PIGUŁKA z TEKSTEM, nie naga kropka (D-B).** Pigułka niesie słowo
>    („Szkic"/„Do przeglądu"/„W recenzji"/„Zatwierdzona"/„Odrzucona"…), `shrink-0`, `whitespace-nowrap`,
>    h-5 px-2 rounded-md, 11px medium. Ton→token c-* (mapa jak `ArtifactApprovalStatusBar.tsx:55-60`,
>    `NModeHeader.tsx:50-57`), **crimson ZAKAZANY** (status ≠ semantyka krytyczna):
>
>    | Ton (`statusTone`) | Tło | Tekst | Dla stanów |
>    |---|---|---|---|
>    | `draft` / `neutral` | `c.surface-raised` | `c.text-muted` | Szkic, Archiwum, stany ciche |
>    | `review` | `c.info` @15% (`color-mix`) | `c.info` | Do przeglądu / W recenzji |
>    | `approved` | `c.success` @15% | `c.success` | Zatwierdzona / Aktywna / W realizacji |
>    | `rejected` | `c.danger` @15% | `c.danger` | Odrzucona / Zablokowana |
>
>    Powód porzucenia kropki: kropka 12px bez podpisu **zapadała się do 0px** poniżej ~1200px na 3 kartach
>    (D3/D4/D5) — element był, informacji nie było. Deprecated `statusDotColor` = martwy typem, nie destrukturyzowany.
> 2. **Wskaźnik zapisu = TEKST NIEKLIKALNY, OSOBNO od statusu (D-C, CANON §4.2).** `<span>` `clickable=false`
>    („Zapisywanie…"/„Zapisano"/„Błąd zapisu"), 12px, `c.text-muted` (błąd → `c.text-danger`), `shrink-0`.
>    Autozapis (onBlur) zostaje. **Znika drugi przycisk akcji** obok primary, w który stara „Zapisz"-pigułka
>    zamieniała się w trybie edycji (D7). To NIE jest kontrolka — to komunikat stanu.
> 3. **Kod obiektu + permalink SCHODZĄ z paska do KEBABA `⋮` (menu przepełnienia, D-D).** Na pasku Menu 1
>    **zero** przycisków kodu/permalinku. W kebabie dokładnie: „Skopiuj kod obiektu" + „Kopiuj link".
>    Powód: rozpychały pasek 62→77px (D2) i wnosiły ukrytą czerwień (D9 — stary `ArtifactPermalinkButton`
>    miał `hover:text-primary-400` = crimson). Kebab renderowany do `<body>` (wrapper paska = `overflow-hidden`).
> 4. **Tytuł = TEKST z `truncate`/wielokropkiem, `⑤`input dopiero po kliknięciu (D6).** W spoczynku tytuł to
>    `<span class="truncate">` (`min-w-0`), nie input — długi tytuł kończy się „…" zamiast rozpychać pasek
>    ani rwać w połowie znaku. Klik → edycja inline (o ile `titleReadOnly=false`).
>
> **Tryb otwarcia (D-A) — reguła stanu, nie własność karty:** karta w stanie SZKIC/pusta → otwiera się w
> **EDYCJI** (gotowa do pisania); karta ZATWIERDZONA/gotowa → **PODGLĄD** (czysta prezentacja klientowi).
> Wyjątki twarde: **Tool** = tylko-do-odczytu z założenia; **Notification** = arkusz do wypełnienia (Edycja);
> **Interview** = aktywny warsztat (Edycja). Reszta (Task·Decision·Insight·Initiative) wg reguły stanu.
> Mapowanie stanów pośrednich: „W recenzji” i inne stany decyzyjne otwierają widok podglądu z akcjami decyzji; „W realizacji” otwiera workspace wykonawczy w trybie edycji zgodnym z capabilities.
>
> **Wysokość paska:** Menu 1 artefaktu ma kanoniczne 60px. Menu 2 ma 48px, a kontekstowe Menu 3 ma 44px. Nie obniżamy Menu 1 do 48px.
> **Dług doc↔kod (2026-08-02):** realna wysokość Menu 3 w kodzie (`MENU_3_ROW_CLASS` w
> `src/components/shared/ModuleMenu3.tsx`: `py-2` + `min-h-8` ⇒ ≈48px) przekracza wartość docelową 44px
> zapisaną tutaj — dług do rozstrzygnięcia osobno (albo kod zejdzie do 44px, albo dokument podniesie
> cel do 48px); do czasu decyzji dokument utrzymuje **44px jako wartość docelową**.

**Menu 3:** nawigacja wewn. (klasa L) — `③`pill gdy sekcje równorzędne / `㉜`underline gdy pod-widoki; + view-local ‖ `①`[AI] (skraj prawy). **Klasa S: Menu 2+3 nie istnieją** — artefakt otwiera się jako `⑯`drawer/`⑮`modal, treść w prawym-panelu-jako-centrum.

**Prawy panel `⑪` — sekcje `㉝`accordion (stała kolejność):**
1. **Akcje** — `①`Eksport▸ (PDF/Word/PPTX) · Udostępnij · Kopiuj-link
2. **Właściwości** — pola: label L4 `c.text-muted` + wartość L3; `㊲`owner-avatar · daty · `㉓`switch-flagi · `㉔`slider-parametry
3. **Powiązania** — linki do artefaktów (ikona-typ 16 + tytuł L3 + `→`); „+ Powiąż"
4. **Komentarze** — wątek (`㊲`avatar + L3 + L5-czas)
5. **Historia / AI** — timeline zmian + `sparkles`AI-akcje
Nagłówek sekcji h-44 L1 + chevron-16 (obrót 200ms).

**Stany:** tytuł inline edit → `⑤`; zapis `Saved/Saving/Save failed` (osobno od lifecycle, CANON §4.2); prawy panel collapsible (chevron przy krawędzi); klasa L tryb read/edit toggle (B,C) w Menu 3.

**Zachowania:** Cmd+S=zapis · Cmd+Enter=primary · Esc=back/zamknij · `㊱`breadcrumb=nawigacja w górę · <1280 prawy panel→`⑯`drawer.

**Delty per archetyp (TYLKO centrum + Menu 2 + rail):**
| Arch. | Centrum (padding, tło) | Menu 2 | Lewy rail `⑩` |
|-------|------------------------|--------|---------------|
| A Canvas | pełne, `c.bg`, zoom/minimapa | — | narzędzia 20px, znika gdy pusty |
| B Dokument | max-w 760 wyśrodk., `c.surface`, p-32 | formatowanie (B/I/U/nagłówki/listy) | — / outline |
| C Rekord | sekcje pól, `c.bg`, p-24 | — | — |
| D Matryca | grid, `c.surface` | toolbar tabeli | struktura (osie/wymiary) |
| E Deck | slajd 16:9 wyśrodk., `c.bg` | toolbar slajdu | `㊸`nawigator miniatur + źródła |

**Zakaz:** archetyp NIE zmienia powłoki (Menu1/panel/kebab/stany identyczne). Inicjatywa C-L i arkusz C-S = ta sama powłoka.

---

### 11.3 SPEC-I — INSTRUMENT (build-ready, per podtyp)

**Reguła twarda:** brak własnych atomów — tylko z puli 40, w wymiarach jak wyżej (przycisk h-36, chip h-32, karta radius-lg, panel 360). Host = centrum Artefaktu lub Hub.

**Podtypy (dokł. centrum):**
| Podtyp | Wymiary centrum | Elementy | Kolor |
|--------|-----------------|----------|-------|
| **Kanban** | kolumna w-300 gap-12; `㊶`card radius-lg p-12 | nagłówek kol. L1 + `④`licznik; drag→shadow-hig-lg | pasek karty = status semantyczny |
| **Gantt/Timeline** | wiersz h-40; `㊷`belka h-24 radius-sm | „dziś" linia 2px `c.accent` | belka = `c.tag-n` per workstream |
| **Tabela sterująca** | `㊴`DataTable wiersz h-40 | `⑰`inline-edit popover w komórce | wartości semantyczne (over/under) |
| **Dashboard** | `㊳`tile min-w-200 grid gap-16 | N-metryka + trend + `㊸`wykres | serie = `c.tag-*` |
| **Wizard** | `㊞`stepper góra h-56; treść max-w-720 wyśr.; stopka h-64 | kontrolki `⑤㉑㉒㉓㉔` | krok✓=`c.success`, aktywny=`c.info` (**NIE `c.accent`** — SYS-1, spójne z ㉞) |

**Reguła palety (krytyczna):** serie/kategorie=`c.tag-1…12` · stany=semantyczne · akcent/„teraz"=`c.accent`. **Crimson NIGDY jako dana** (fix lime/pomarańcz z M15).

**Stany + overlaye:** `⑭`empty/loading · `⑱`tooltip na węzłach/belkach · `⑧`kebab na elemencie · `⑲`toast po akcji.

---

### 11.4 Kontrakt dla dewelopera (jednozdaniowo)
Nowy ekran = wybierz powierzchnię (L/A/I) → weź jej powłokę z §11 bez zmian → wskaż centrum → dla Artefaktu podaj archetyp (delta) → dla Instrumentu wybierz podtyp. **Nie projektujesz wyglądu. Składasz.** Cokolwiek nie pasuje = zgłoś lukę (CANON §3), nie twórz lokalnego wariantu.

---

## 12. NAWIGACJA I OTWIERANIE — jak wchodzimy, gdzie są menu, jak wracamy

> Warstwa, której brakowało: *jak* artefakt się otwiera, *gdzie fizycznie* są menu, *jak* je wywołujemy, *jak* wracamy. Bez tego elementy wiszą w próżni.

### 12.1 Gdzie fizycznie są menu i jak je wywołujemy

| Menu | Lokalizacja | Widoczność | Wywołanie |
|------|-------------|-----------|-----------|
| Menu 1 app (global topbar) | najwyższy pasek | zawsze | — (persistent) |
| Menu 1 artefaktu `⑫` | pod topbarem, po wejściu w artefakt | zawsze w artefakcie | zastępuje Menu 2 modułu (zejście §2) |
| Menu 2 | pod Menu 1 | gdy są funkcjonalności/formatowanie | klik zakładki |
| Menu 3 | pod Menu 2 | zawsze (1 rząd) | klik chip/tab |
| Lewy rail | krawędź lewa | tylko canvas A; znika gdy pusty | — |
| Prawy panel | krawędź prawa | toggle | chevron przy krawędzi |
| Kebab `⑧` | koniec wiersza / róg elementu | hover pokazuje `⋮` | **klik `⋮` LUB prawy przycisk** (to samo menu) |
| Command palette `⑳` | overlay centralny | na żądanie | **Cmd/Ctrl+K** |
| Tooltip `⑱` | przy elemencie | hover 300ms | hover |

**Reguła:** to samo menu z `⋮` i z prawego kliku (lustro, kolejność §6.4). Kto zna jedno — zna drugie.

### 12.2 Drabina otwierania (canonical open ladder)

| Skąd | Akcja | Co się otwiera |
|------|-------|----------------|
| Lista, klik w wiersz | pojedynczy | `⑬`**preview** w prawym panelu (read-only) |
| Lista, klik w tytuł / „Otwórz pełny" | — | **pełna strona** (klasa L) / `⑯`**drawer** (klasa S) |
| Lista, `①`„Nowy" | — | `⑮`**modal quick-create** (min. pola) → po zapisie pełny |
| Powiązanie w prawym panelu | klik linku | artefakt docelowy (pełny/drawer) |
| Deep-link URL `/moduł/:typ/:id` | — | **pełna strona**, breadcrumb odtworzony |
| Instrument (węzeł/belka) | klik | artefakt źródłowy (drawer nad instrumentem) |

**Klasa S vs L (rozstrzyga Q3):**
- **Klasa S** (Task, Decision, KPI, RAID, Insight…) = `⑯`**drawer** z prawej nad bieżącym kontekstem (nie tracisz miejsca). Dostęp bezpośredni (deep-link) = pełna strona.
- **Klasa L** (Initiative, Assessment, Deck…) = **pełna strona** z własną powłoką.
- **Quick-create** zawsze = `⑮`modal (nie drawer) — krótki, wraca do listy.

### 12.3 Nawigacja: wewnątrz · między · powrót

- **Wewnątrz artefaktu:** `③`/`㉜` Menu 3 — bez przeładowania, stan zachowany (scroll/edycja per zakładka).
- **Między artefaktami:** sekcja „Powiązania" (prawy panel) + `㊱`breadcrumb w górę + `←`back.
- **Powrót:** `←`/breadcrumb → poprzedni poziom; Esc → zamknij drawer/modal; pełna strona → route poprzedni.
- **Cross-surface:** Lista ↔ Artefakt ↔ Instrument spięte linkami; deep-link zawsze odtwarza breadcrumb.

### 12.4 Strażnicy i przejścia (honest UI)
- **Niezapisane zmiany:** zamknięcie/back z brudnym stanem → `⑮`confirm („Zapisać / Odrzucić / Anuluj"). Nigdy ciche porzucenie.
- **Zapis:** autosave gdzie możliwe; wskaźnik `Saved/Saving/Save failed` w Menu 1 (osobno od lifecycle).
- **Przejścia:** 200ms ease-hig; drawer=slide, modal=scale-in, pełna strona=route + breadcrumb; zero bounce.
- **Locked/brak uprawnień:** artefakt otwiera się read-only z `㉚`banerem „tylko podgląd — dlaczego", nie 403 w twarz.

---

## 13. INSTANCJACJA PER ARTEFAKT — porównywalne wypełnienie szablonu

> Cel: każdy artefakt tego samego archetypu ma **tę samą strukturę**, różni się tylko treścią. Ikony pochodzą z Lucide i podlegają kanonowi ikonografii. To definiuje STAN DOCELOWY — zastępuje dzisiejsze niespójne implementacje.

### 13.1 Archetyp C — REKORD (bazowa nawigacja = **Przegląd · Powiązania · Aktywność**; klasa S bez zakładek)

| Artefakt | Ikona | Otwiera | Menu 1 primary | Menu 3 (dodatkowe zakładki) | Prawy panel — sekcje kluczowe |
|----------|-------|---------|----------------|------------------------------|-------------------------------|
| Initiative (L) | `target` | pełna | „Submit for Review" → wg statusu | Zadania · Definicja · Wdrożenie · Ekonomia · Governance · Zespół | Właściwości(owner/sponsor/budżet/oś)·Powiązania·Historia |
| Task (S) | `check-square` | drawer | „Oznacz done" | — | Właściwości(status/prio/owner/termin)·Podzadania·Powiązania |
| Decision (S) | `scale` | drawer | „Zatwierdź" | — | Opcje·Wpływ·Zatwierdzenia·Powiązania |
| KPI (S) | `gauge` | drawer | „Zapisz pomiar" | — | Formuła·Cel/baza·Powiązane inicjatywy·Historia |
| Insight (S) | `gem` | drawer | „Konwertuj → inicjatywa" | — | Dowody·Kategoria·Powiązania |
| Idea (S) | `lightbulb` | drawer | „Konwertuj → inicjatywa" | — | Tagi·Źródło·Powiązania |
| RAID (S) | `shield-alert` | drawer | „Zamknij" | — | Kategoria·Prawdopod./wpływ·Mitygacja·Owner |
| Milestone (S) | `flag` | drawer | „Oznacz osiągnięty" | — | Data·Powiązane dostawy·Zależności |
| Change Request (S) | `git-pull-request` | drawer | „Zatwierdź zmianę" | — | Wpływ·Plan wdrożenia·CCB·Historia |
| Stage Gate (S) | `shield-check` | drawer | „Zatwierdź bramę" | — | Kryteria·Dostawy·Zatwierdzający |
| Action Proposal (S) | `wand-2` | drawer | „Akceptuj" / „Odrzuć" | — | Uzasadnienie AI·Wpływ·Dowody |

### 13.2 Archetyp B — DOKUMENT (bazowa: Menu 3 = **Czytaj/Edytuj · Komentarze · Wersje**; Menu 2 = formatowanie)

| Artefakt | Ikona | Otwiera | Menu 1 primary | Uwaga treści |
|----------|-------|---------|----------------|--------------|
| Notatka | `notebook-pen` | pełna/drawer | „Udostępnij" | @mention + linki dwustr. |
| Document/Wordy | `file-text` | pełna | „Eksportuj ▸" | bloki KIMI, inline-AI |
| Report (PMO) | `file-bar-chart-2` | pełna | „Publikuj" | bloki + tabele + wykresy |
| Assessment Report | `file-check` | pełna | „Generuj ▸" | radar+heatmap (DRD) |
| Audit Report | `clipboard-check` | pełna | „Publikuj" | checklist + findings |
| Executive Summary | `file-badge` | pełna | „Eksportuj ▸" | read-first |
| KB Article | `book-open` | pełna | „Edytuj" (jeśli owner) | read-first |
| Legal Document | `gavel` | pełna | „Poproś o podpis" | klauzule + podpisy |
| Partner Agreement | `handshake` | pełna | „Podpisz" | sekcje umowy |
| Meeting Notes | `file-text` | drawer | „Powiąż z zadaniami" | agenda+decyzje+akcje |

### 13.3 Archetyp A — CANVAS (bazowa: Menu 3 = zoom/dopasuj/minimapa; rail = narzędzia)

| Artefakt | Ikona | Menu 1 primary | Narzędzia raila (kluczowe) |
|----------|-------|----------------|----------------------------|
| Mind Map | `network` | „Konwertuj → inicjatywa" | węzeł·gałąź·kolor·sticky |
| Process Flow | `workflow` | „Konwertuj → inicjatywa" | krok·decyzja·strzałka·swimlane |
| Whiteboard | `pen-tool` | „Konwertuj → inicjatywa" | rysuj·kształt·tekst·sticky |
| Discovery Tool | `wrench` | „Generuj inicjatywy" | wg narzędzia (per template) |
| Studio Diagram | `git-branch` | „Powiąż z artefaktem" | węzeł·połącz·layout |
| Playbook | `route` | „Uruchom test" | node·warunek·połącz |

### 13.3a Kontrakt zakresu AI na canvasie (Archetyp A) — normatywny, zakres bramki SKORYGOWANY 2026-08-02 (K-44)

`UI_UX_IMPLEMENTATION_STANDARD.md` §7.4 obiecuje: „AI działa na zaznaczonym węźle, gałęzi albo całej
mapie — zakres jest jawny." Ten dokument, SSOT anatomii canvasu, dotąd opisywał wyłącznie **miejsce**
slotu AI (§5 M3 `[AI: podpowiedz]`, §2 `▸Historia/AI`) — nie **zakres** jego działania. Uzupełnienie:

**Nazewnictwo zestrojone z N-mode (K-44) — nie trzecia, niepowiązana taksonomia.** N-mode ma już
udokumentowaną i wdrożoną taksonomię trzech poziomów AI — **tool → section → field**
(`src/components/shared/NModeLayout/types.ts`, `NModeShellProps.toolAIActions`/`aiContextActions`
l.291-302 „3-level AI model: tool / section / field"; `FieldAIButton.tsx` = poziom field). Trzy poziomy
zakresu canvasu poniżej to TA SAMA drabina field<section<tool, zastosowana do centrum-canvas zamiast
centrum-formularza — nie osobne pojęcie:

1. **Trzy poziomy zakresu — MUST, wybieralne z UI:**
   - **Węzeł zaznaczony** (poziom **field**) — pojedynczy element z zaznaczenia; odpowiednik
     `FieldAIButton` przy pojedynczym polu formularza.
   - **Gałąź/poddrzewo** (poziom **section**) — zaznaczony węzeł + wszyscy potomkowie; odpowiednik AI
     sekcyjnego (`aiContextActions`) w N-mode.
   - **Cały canvas** (poziom **tool**) — wszystkie węzły bieżącego widoku; odpowiednik `toolAIActions`
     w `NModeShellProps`.
2. **Zakres MUSI być nazwany w UI PRZED uruchomieniem.** Etykieta/chip obok akcji AI pokazuje na czym
   AI zadziała i ile elementów obejmuje, np. „AI: podpowiedz · gałąź/section (12 węzłów)". **ZAKAZ**
   uruchamiania akcji AI bez widocznej etykiety zakresu.
3. **Brak zaznaczenia → zakres domyślny jawny, nie domyślany po cichu.** Gdy nic nie jest zaznaczone,
   domyślny zakres (typowo „cały canvas"/tool) jest **napisany** w chipie/etykiecie — użytkownik widzi,
   na czym AI zadziała, zanim kliknie.
4. **Wynik AI = propozycja/diff — NIGDY natychmiastowa mutacja grafu.** Nowe/zmienione węzły wchodzą
   jako warstwa „do zatwierdzenia" (wizualnie odróżnialna: obrys/badge „proponowane"), z akcjami
   approve/reject/edit **per-węzeł** ORAZ **zbiorczo** („Zatwierdź wszystko" / „Odrzuć wszystko").
5. **Undo = jedna jednostka.** Cofnięcie operacji AI cofa **całą** operację jednym Cmd+Z — nie N
   osobnych cofnięć per zmieniony/dodany węzeł.
6. **Anulowanie streamu = zero efektu ubocznego.** Przerwanie generowania (Stop) w trakcie streamingu
   propozycji zostawia graf **w stanie sprzed operacji** — żaden częściowo wygenerowany węzeł nie zostaje
   na płótnie bez akceptacji.

**Realny stan dziś (punkt wyjścia, NIE kontrakt spełniony — K-44).** System powyżej nie istnieje w
żadnym canvasie. `src/components/MyWork/mindmap/aiSidekickContext.ts` (`detectMindmapIntent`) to
HEURYSTYKA: wnioskuje intencję (`blank_canvas`/`editing_node`/`expanding_branch`/`gap_analysis`/…) z
zaznaczenia i stanu mapy, ale nie pokazuje użytkownikowi chipa/etykiety zakresu przed uruchomieniem (pkt
2 złamany wszędzie) i nie ma jawnego trybu „cały canvas" jako wyboru użytkownika — zakres jest zawsze
domyślany po cichu. `src/components/MyWork/mindmap/AIProposalDiffModal.tsx`
(`onApply: (selectedNodeIndices: Record<number, boolean>) => void`) implementuje CZĘŚCIOWO pkt 4 —
approve/reject per-węzeł po fakcie — ale bez poprzedzającego wyboru zakresu i bez jednego miejsca na
zbiorcze „Zatwierdź/Odrzuć wszystko" opisane w pkt 4.

**Status DoD — SKORYGOWANY (K-44, 2026-08-02).** Wcześniejsza redakcja wpisywała ten kontrakt jako
DoD-blocking MUST w §18.1 dla WSZYSTKICH sześciu artefaktów archetypu A jednocześnie (Mind Map,
Whiteboard, Process Flow, Discovery Tool, Studio, Playbook), mimo że system nie istnieje w ŻADNYM z
nich. Wymóg blokujący odbiór 6 artefaktów bez planu wdrożenia, kosztu i właściciela jest martwym
zapisem, nie egzekwowalną bramką. Korekta:
- `spec_status` kontraktu = `APPROVED_SPEC` — bez zmian, to WCIĄŻ jest właściwy cel docelowy.
- **DoD §18.1, punkt „zakres AI na canvasie" przestaje być bramką bezwarunkową.** Blokuje odbiór
  KONKRETNEGO canvasu dopiero od momentu, gdy ten canvas w ogóle ma UI wyboru zakresu AI (czyli chroni
  przed REGRESJĄ wobec już wdrożonego wyboru) — nie blokuje canvasów, które (jak dziś wszystkie sześć)
  nie mają żadnego wyboru zakresu, bo tam nie ma czego regresować. Dopóki żaden canvas nie implementuje
  pkt 1-3, ten punkt DoD jest **nieaktywny** dla danego canvasu (nie liczy się do przechodzi/nie
  przechodzi), a nie cicho-niespełniony.
- Podniesienie z powrotem do bezwarunkowego MUST dla wszystkich sześciu wymaga: (1) referencyjnej
  implementacji na JEDNYM canvasie (kandydat naturalny: Mind Map — ma już
  `aiSidekickContext.ts`+`AIProposalDiffModal.tsx` jako częściowy fundament), (2) daty i właściciela dla
  pozostałych pięciu.

Weryfikowane per canvas przy odbiorze DoD §18.1 (dopisany punkt, patrz warunek wyżej); nie podnosi
automatycznie `runtime_status` istniejących implementacji.

### 13.3b Limity wydajności canvasu (Archetyp A) — cel vs. realny kod (KOREKTA 2026-08-02, K-43)

Próg **docelowy** mieszka WYŁĄCZNIE w
`docs/ui-standards/02-components/COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md` — ten SSOT anatomii go nie
niósł. Wpisany tu przez odwołanie (liczby stamtąd, nie nowe). Panel adwersaryjny (K-43, 2026-08-02)
zweryfikował trzy pliki: próg docelowy **nie jest mierzony automatycznie**, a realny kod ma WŁASNE, inne
progi — trzy niezależne liczby, żadna nie zgadza się z appendixem:

- **Próg docelowy (COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md, aspiracyjny, nieodbierany dziś):** ≤500
  węzłów / ≤750 krawędzi, pan/zoom bez zadań renderu >50ms.
- **Realne progi w kodzie (rozjechane, żaden nie mierzy 50ms):**
  - `src/components/MyWork/mindmap/virtualization.ts:18` — `VIRTUALIZATION_NODE_THRESHOLD = 300`
    (viewport culling ReactFlow włącza się od 300 węzłów, nie od 500).
  - `src/components/MyWork/mindmap/LargeMapOptimizer.tsx:10-14` — własna trójstopniowa skala:
    `WARNING=150` (ostrzeżenie) · `CRITICAL=300` · `AUTO_SIMPLIFY=500` (wymuszony tryb uproszczony).
  - Żadna z tych liczb nie pochodzi z appendixu ani nie jest z nim uzgodniona.
- **Brak automatycznej metody pomiaru.** `tests/e2e/m06/m06-21-large-maps.spec.ts` (21.1 „Simplified
  mode", 21.2 „Performance na dużej mapie") to `test.skip(true, '[MANUAL]')` — nikt nie mierzy progu w
  CI. Kod przyznaje to wprost we własnym komentarzu testu 21.2: „no occlusion culling above ~300 nodes →
  P2 delta (deferred)" — czyli powyżej ~300 węzłów płynność **sam kod deklaruje, że nie jest** dotrzymana,
  mimo że appendix zapisuje 500 jako twardy próg.
- **Ten dokument NIE udaje, że próg 500/750/50ms jest dziś odbieralnym MUST-em.** Dopóki nie istnieje
  automatyczny test wydajności w CI zastępujący `[MANUAL]` skip, punkt „limity wydajności canvasu"
  **NIE jest bramką DoD §18.1** — jest zapisanym celem architektonicznym, nie wymogiem egzekwowalnym na
  odbiorze. Podniesienie z powrotem do bramki wymaga: (1) automatycznego testu w CI mierzącego realny
  czas renderu na syntetycznym grafie 500/750 węzłów, zastępującego dzisiejszy `[MANUAL]` skip, (2)
  uzgodnienia trzech rozjechanych progów kodu (150/300/500 vs 300 vs 500/750) w jedną liczbę.
- **Po przekroczeniu progu (cel, bez zmian) — MUST przynajmniej jedno z:**
  1. **Ostrzeżenie + degradacja świadoma:** baner `㉚` „Duży graf (>500 węzłów) — nawigacja może
     zwolnić" + automatyczne wyłączenie kosztownych efektów (cienie węzłów, animacje krawędzi, live
     minimapa) na rzecz płynności pan/zoom.
  2. **Wirtualizacja:** renderuj tylko węzły w viewport + bufor, reszta poza DOM. Preferowane dla
     narzędzi, gdzie przekroczenie progu jest regularne (np. Discovery Tool na dużych projektach), nie
     wyjątkowe.
- **Obowiązek alternatywnego widoku.** Graf, którego rozmiar realnie uniemożliwia sensowną nawigację
  przestrzenną, MUSI mieć alternatywny **widok listy/detail** (tabela węzłów z filtrem/szukajką, SPEC-L)
  — canvas przestaje być jedynym sposobem dotarcia do węzła.

### 13.3c Klawiatura na canvasie — świadoma luka runtime, bramka (CANON §3.2)

`UI_UX_IMPLEMENTATION_STANDARD.md` §13 wymaga WCAG 2.2 AA („wszystkie funkcje dostępne bez myszy"), DoD
§18.1 wymaga pełnego cyklu Tab. §7 pkt 8 tego dokumentu dotąd mówił „skróty przewidziane teraz, wdrożone
później" — bez terminu i bez bramki. To nieuczciwe wobec obu wymogów. Korekta — nie obietnica
implementacji, tylko jawne nazwanie luki i jej konsekwencji:

**Minimalny wymagany zestaw klawiaturowy dla canvasu (kontrakt docelowy, każde bez myszy):**
1. **Utworzenie węzła** — skrót (np. `N`, lub `Enter` na zaznaczonym węźle = nowy sąsiad).
2. **Nawigacja między węzłami** — strzałki/Tab przechodzą po grafie w spójnej kolejności (wg struktury
   drzewa, nie wg przypadkowego DOM-order).
3. **Przesunięcie węzła** — strzałki + modyfikator (np. Shift+strzałki) przesuwają zaznaczony węzeł.
4. **Połączenie węzłów** — skrót wchodzi w „tryb połącz" z zaznaczonego węzła; strzałki/Tab wybierają
   cel; Enter zatwierdza.
5. **Usunięcie** — `Delete`/`Backspace` na zaznaczonym węźle/krawędzi (z potwierdzeniem, gdy ma dzieci).
6. **Wyjście z canvasu** — `Esc` zwraca fokus poza płótno (rail/panel/back), zgodnie z §12.4.

**Status: świadoma luka runtime (CANON §3.2), NIE przypis.** Dopóki powyższy zestaw nie jest wdrożony i
zweryfikowany klawiaturą (bez myszy, oba motywy) na danym canvasie:
- Ten canvas **NIE MOŻE** otrzymać `runtime_status` wyższego niż `PARTIAL`.
- Ten canvas **NIE przechodzi** DoD §18.1 — pozycja „Pełny cykl Tab/Shift+Tab" §18.1 rozszerza się o
  punkty 1–6 powyżej dla archetypu A, nie ogranicza do przejścia fokusa między elementami chrome.
- To jest **bramka odbioru**, nie deklaracja intencji — audytor sprawdza WZROKIEM + klawiaturą (złota
  reguła CLAUDE.md: realny runtime, nie flaga/doc).

### 13.4 Archetyp D — MATRYCA (bazowa: Menu 3 = **Dane · Mapa/Wizualizacja · Raporty**)

| Artefakt | Ikona | Menu 1 primary | Menu 3 specyfika | Rail |
|----------|-------|----------------|-------------------|------|
| Assessment Session | `radar` | „Generuj raport" | Ocena·Mapa·Raporty·Inicjatywy | osie/wymiary/obszary |
| Table/Spreadsheet | `table-2` | „Eksportuj ▸" | Dane·Wizualizacje·Wglądy | zakresy nazwane |
| Idea Table | `table` | „Konwertuj → inicjatywa" | Dane·Widok | — |
| Megatrend Scan | `telescope` | „Generuj syntezę" | Matryca·Trendy·Wpływ | kategorie trendów |

### 13.5 Archetyp E — DECK

| Artefakt | Ikona | Menu 1 primary | Menu 3 | Rail |
|----------|-------|----------------|--------|------|
| Presentation/Deck | `presentation` | „Eksportuj/Prezentuj" | Slajdy·Układ·Motyw | miniatury + źródła |

### 13.6 Przypadki graniczne
- **Interview** `messages-square` — hybryda (Q2): centrum=czat, ale reszta powłoki = Rekord (Menu 1/panel/kebab). Propozycja: **wariant Rekordu z centrum-konwersacją**, nie osobny archetyp.
- **Template** `layout-template` (meta) — dziedziczy powłokę archetypu docelowego + tryb „edycja slotów".
- **Chat** `message-circle` — jedyna KONWERSACJA; osobny SPEC-K (Q: 4. typ potwierdzony).

### 13.7 Kontrakt generatora / wizarda (SPEC-W) — zachowanie, nie tylko wygląd

> Wymagany przez `CANON.md` §8 i `UI_UX_IMPLEMENTATION_STANDARD.md` §8. Ten dokument dotąd opisywał
> Stepper (㉞, §9.2b) wyłącznie jako atom wizualny — „krok = kółko 24 + L4" — czyli jak wizard WYGLĄDA,
> nie jak się ZACHOWUJE. Dotyczy każdego ekranu wieloetapowego tworzącego/mutującego artefakt:
> generatory (inicjatyw/raportów), Onboarding, Audit Orchestrator, Context Builder, Stage Gate checklist
> (§0C Typ 4 „Kreatory"). Zapisy poniżej są **normatywne i mierzalne** (MUST/ZAKAZ), egzekwowalne na
> odbiorze — patrz powiązanie z DoD §18.1 na końcu.

1. **Postęp — MUST.** „Krok N z M" widoczny **tekstowo** obok kółek stepper (nie same kółka bez liczby —
   L4 tuż nad/pod stepperem). Aktywny krok ma `aria-current="step"`. Zmiana kroku ogłaszana czytnikowi
   (region `aria-live="polite"` z tekstem „Krok N z M: {nazwa kroku}").
2. **Back — MUST.** Przycisk „Wstecz" dostępny na **każdym** kroku poza pierwszym i poza krokiem
   wykonania mutacji (submit/generowanie w toku). Powrót **NIE czyści** pól już wypełnionych na
   wcześniejszych krokach — stan trzymany w pamięci wizarda przez cały cykl, nie per-krok.
3. **Save draft.** Jasno zdefiniowane: kiedy szkic powstaje (automatycznie przy zmianie kroku, albo
   jawnym przyciskiem „Zapisz szkic" — jedno z dwóch, nie domyślanie), gdzie żyje (rekord z lifecycle
   `draft`, §6.3, widoczny w liście modułu macierzystego), jak długo (minimum do końca sesji; TTL dłuższy
   = decyzja per narzędzie, ale MUSI być udokumentowana przy implementacji).
4. **Cancel — MUST, ZAKAZ dwuznaczności.** Przycisk „Anuluj" niesie **jawną informację o skutku**: albo
   „Anuluj i zachowaj szkic", albo „Anuluj i odrzuć zmiany". **Goły „Anuluj" bez etykiety skutku jest
   zakazany.** Gdy skutkiem jest odrzucenie danych → potwierdzenie `⑮`modal (guard niezapisanych zmian,
   §12.4), nie natychmiastowe zamknięcie.
5. **Resume po odświeżeniu/utracie sesji.** Wizard z istniejącym szkicem (pkt 3) odtwarza się na tym
   samym kroku po powrocie na jego URL/route. Krok wykonania mutacji (generowanie w toku) **nie jest**
   krokiem, do którego wraca się przez proste odświeżenie — patrz pkt 10 (recovery generowania).
6. **Walidacja — MUST.** Błąd pola pokazany **inline przy polu** (L4, `c.danger`), nie tylko zbiorczo na
   końcu. Próba „Dalej" z błędem → fokus przenosi się na **pierwsze** niepoprawne pole. Blokada „Dalej"
   TYLKO na realnej walidacji (nie: puste opcjonalne pole, nie: obowiązkowe-ale-jeszcze-nietknięte przy
   pierwszym renderze kroku).
7. **Review przed mutacją — MUST.** Ostatni krok przed nieodwracalną akcją (submit/generuj) pokazuje
   **zakres skutków** (co powstanie/zmieni się — liczba obiektów, zasięg, koszt jeśli dotyczy), zanim
   użytkownik kliknie. Zakaz „kliknij i zobacz co się stanie".
8. **Idempotency — MUST, mechanizm (KOREKTA 2026-08-02, K-42 — nie tylko zakres).** Poprzednia redakcja
   nazywała zakres („klucz per sesja × krok wykonania") bez odpowiedzi na kto/gdzie/TTL/kolizja —
   niesprawdzalne na odbiorze. Konkretny kontrakt:
   - **Kto generuje:** klient, w momencie wejścia na krok wykonania (nie na starcie wizarda) — jeden
     klucz per (sesja wizarda × krok wykonania), np. `${wizardSessionId}:${stepId}` (UUID v4 lub
     równoważnie unikalny).
   - **Gdzie żyje:** nagłówek HTTP `Idempotency-Key` na żądaniu mutującym (POST/PUT) — NIE pole
     payloadu. Payload może się nieznacznie różnić przy ręcznym retry (np. drobna korekta pola przed
     ponowieniem); klucz musi to przetrwać niezmieniony.
   - **TTL backendu:** serwer pamięta klucz→wynik minimum 24h (typowy czas między nieudaną próbą a
     ręcznym powrotem użytkownika, który zamknął kartę). Dłuższy TTL = decyzja per endpoint,
     udokumentowana przy implementacji.
   - **Kolizja (ten sam klucz, drugie żądanie):** backend **NIE tworzy drugiego rekordu** — zwraca
     albo `200`/`201` z odpowiedzią z cache (ten sam obiekt co przy pierwszym sukcesie), albo `409` z
     odsyłaczem do istniejącego zasobu (gdy endpoint nie cache'uje odpowiedzi). Jedna z tych dwóch
     opcji jest wymagana per endpoint; ciche utworzenie duplikatu jest zakazane w obu wariantach.
   Ponów po nieudanej próbie = **ten sam klucz**, nie nowy request.

   **Kontrprzykład w kodzie, nie wzorzec (K-42).** `src/components/Audit/AuditOrchestratorWizard.tsx`
   (`handleCreate`, ok. l.167–193) ŁAMIE ten kontrakt: `createProgram({...})` nie niesie żadnego klucza
   idempotency. Jedyna ochrona jest `disabled={submitting || !name.trim()}` na przycisku (l.474) — to
   chroni przed podwójnym kliknięciem w trakcie żądania, NIE przed timeout+ręczny retry (`submitting`
   wraca na `false` w `finally` po błędzie; użytkownik klika ponownie → drugi POST → drugi rekord
   programu). Pole `surveysGenerated: false` (l.183, ten sam plik) to **INNY, niepowiązany** mechanizm —
   flaga run-once dla późniejszego, osobnego fan-outu ankiet z poziomu strony programu
   (`generateSurveys`), nie ochrona `createProgram` przed duplikatem. Ten plik referuje się tu jako
   **kontrprzykład do naprawy**, nie jako implementacja wzorcowa.
9. **Partial failure — MUST, własny UI.** Wynik „wygenerowano X z Y, Z nieudanych" ma **dedykowany
   ekran stanu**: lista sukcesów (✓ `c.success`) i porażek (✗ `c.danger` + powód) osobno. „Ponów"
   działa **tylko na nieudanych elementach**, nie ponawia całości. **Zakaz** cichego udawania pełnego
   sukcesu (sam toast „Gotowe" gdy część się nie powiodła). **Relacja do pkt 8 (K-42):** retry
   per-element używa **NOWEGO klucza idempotency na element** (`${wizardSessionId}:${stepId}:${elementId}`),
   nie klucza z pkt 8 — ten jest zdefiniowany per sesja×krok całościowy i nie ma znaczenia dla
   pojedynczego elementu partial-failure; ponawianie jednego elementu nie może kolidować z kluczem,
   który już oznacza sukces (lub porażkę) całego kroku.
10. **Stan generowania.** Widoczny postęp (pasek/spinner `c.info` — §14.2 SYS-1) · przycisk Stop/Anuluj
    bezpieczny w trakcie (nie zawiesza UI, nie gubi już wykonanej pracy) · bezpieczne wyjście (zamknięcie
    karty w trakcie generowania nie gubi wyniku — recovery: po powrocie wizard pokazuje wynik albo stan
    „generowanie przerwane, wznów/odrzuć"). Sukces prowadzi do **workspace nowo utworzonego artefaktu**
    (`①`„Otwórz"), nie do samego `⑲`toast.

**Powiązanie z DoD:** wizard/generator, który nie spełnia punktów 1–10, **nie przechodzi odbioru DoD
§18.1** — patrz dopisany punkt w §18.1 DoD Artefaktu. `spec_status` tego kontraktu = `APPROVED_SPEC`;
nie podnosi automatycznie `runtime_status` istniejących wizardów — każdy weryfikowany osobno.

---

## 14. SPEC-L PRECYZYJNIE — jak budujemy tabelę (zgodne z kanonem + referencją MyWork)

> **To nie jest nowy standard — to konsolidacja istniejącego.** SSOT = `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`. Referencja działająca = MyWork. Gdzie §11.1 podał inne liczby → **§14 wygrywa** (zgodny z kodem). Wartości podane jak SĄ + docelowy token; migracja `slate-*`→`c.*` = robota re-skinu (nie przeprojektowanie).

### 14.0 SSOT — kod

**Metodologia liczenia „Użyć" (K-27/K-28, 2026-08-02) — obowiązuje cały §14:**
- **import** — `grep -rln "import.*<Nazwa>" src/` (lub, gdy import jest rozbity na wiele linii,
  `grep -rlE "from ['\"].*<Nazwa>['\"]" src/`, żeby złapać zamykającą linię destrukturyzacji)
- **JSX** — `grep -rl "<Nazwa" src/` (realni konsumenci renderujący komponent — domyślna miara „ile
  ekranów faktycznie go używa")
- **wzmianka** — `grep -rln "Nazwa" src/` (najmniej wiarygodne — łapie importy typów, komentarze, nazwy
  testów; NIE liczba konsumentów)
Każda liczba niżej podana z metodą i datą. Kolizje nazw (dwa różne komponenty o tej samej nazwie w
różnych katalogach) sprawdzone ręcznie przed policzeniem.

| Rola | Plik | Użyć |
|------|------|-----:|
| Orkiestracja tabela+preview (J/K, historia, pin) | `shared/TableWithPreviewLayout.tsx` | **18** (JSX, 2026-08-02; surowa wzmianka stringa = 28 — import + typy + komentarze, K-28) |
| Tabela (nagłówki, resize, filtry, row-actions, persistKey) | `shared/ModuleHub/FilterableTable.tsx` | **26** (JSX, 2026-08-02) |
| Menu 3 klasy | `shared/ModuleMenu3.tsx` | **27** (import, 2026-08-02; wcześniej „1" — K-27, drastycznie zaniżone) |
| Kebab | `shared/RowActionsMenu.tsx` | — |
| Widok kart (alt) | `shared/ModuleHub/GridView.tsx` | **8** (JSX, 2026-08-02; wyklucza kolizję nazwy z niepowiązanym `MyWork/table/GridView.tsx`, który ma własnych 4 konsumentów pod inną nazwą importu — nie mylić) |

Referencja wzorcowa: `MyTasksListContent`, `IdeasTableContent`, `DecisionsPanelContent`.

### 14.1 Menu 1 / 2 / 3 — zarządzanie (dokł.)
- **Menu 1** (global sidebar): nietykalne przez tabelę/moduł.
- **Menu 2** (module topbar, kontrolki **h-9 rounded-full**): lewa = search-toggle → taby modułu **BEZ liczników**. Prawa, kolejność **od prawej krawędzi:** Area → Primary CTA (bez wiodącego `+`) → Tool → View-modes (segment ikon) → Filters (**maks 1** dropdown).
  - **Podział filtrów:** per-kolumna → nagłówek (lejek + `FilterDropdown` multiselect) · scope/preset → Menu 3 counter-chipy · globalny/złożony → Menu 2 `Filters`.
- **Menu 3** (jeden rząd, SSOT `ModuleMenu3.tsx`) — **3 formuły:**
  - **F1 STANDARD:** counter-chipy **h-7 px-2.5 text-[11px]** = presety/statusy z **realnymi licznikami** (0 też widoczne) + scope (Active/Archive/Trash). **MUST: ta sama rola tabeli → ten sam zestaw chipów na KAŻDEJ zakładce** (koniec „Sessions ma liczniki, Inbox nie").
  - **F2 MULTI-SELECT:** przy ≥1 zaznaczonym Menu 3 **natychmiast** → „**N selected · Clear · [≥1 akcja]**". Przyciski **outline, h-8 px-3 rounded-full**, ikona+label. Standard: Export CSV · Tag · Assign · Change due · Archive · Delete (+ kontekst per moduł). **MUST: nigdy sam „N selected", nigdy sam „Clear".**
  - **F3 OTWARTE KARTY:** single-click = preview (NIE tab). „Open" = pełna karta + **trwały tab** w Menu 3. Menu 3 pokazuje wszystkie otwarte karty **CROSS-MODULE**. *(tego brakowało w moim §11.1 — realny mechanizm nawigacji)*

### 14.2 Wiersz — anatomia + wyrównanie wg roli (KANON Linear/Notion)
Kolejność: **tytuł (left) → metadane → akcje (right)**. Wyrównanie:
- tytuł/nazwa → `text-left`
- chipy tag/typ/źródło **oraz status** → `text-left` + **wiodąca kropka** (identity/signal dot) = pionowa „szyna skanu"
- liczby (counts/%/kwoty) → `text-right` `tabular-nums`
- assignee, daty/DueChip → `text-left` · akcje → `text-right`
- **ZAKAZ:** centrowane chipy/statusy

**Klasy dokł. (jak są → docelowy token):**
| Część | Klasa (obecna) | Docelowo |
|-------|----------------|----------|
| Nagłówek | `text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400` `sticky top-0 z-10` (rodzic bez `overflow-hidden`) | `text-c-text-muted` |
| Padding komórki | `px-4 py-3` (comfort) / `px-4 py-2` (compact); wys. stała na hover | — |
| Tytuł wiersza | `text-sm font-semibold text-slate-900 dark:text-slate-100` — bez `font-medium`, bez custom size | `text-c-text` |
| Opis/podtytuł | `text-[11px] leading-4 text-slate-500 dark:text-slate-400` — **ZERO opacity-slash** | `text-c-text-muted` |
| Pusta komórka | `—` `text-slate-400` | `text-c-text-muted` |
| Progress | `h-1.5 bg-c-border-subtle` → wypełnienie `bg-c-info`, `@100% bg-c-success` — **NIGDY danger/crimson** | ✅ już token |
| Status | `EntityStatusChip` + `statusChipTone()` → `c.info/warning/success/danger` | ✅ |

**Stany wiersza (KOREKTA vs §9.2⑦/§11.1):** zaznaczenie = **neutralne/niebieskie**, `bg-slate-50 dark:bg-white/[0.06]` + 4px lewy akcent neutralny. **NIE `c.accent-soft` (crimson)** — commit SYS-1 „selection token = neutral/blue, not crimson". hover = `bg-slate-50/70 dark:bg-white/[0.03]`.

**Zakres korekty SYS-1 (rozszerzony 2026-08-02, uzupełniony 2026-08-02 o kolejne pięć pozycji):** ta
poprawka obejmuje **CAŁE §9.2 i §11.3**, nie tylko wiersz tabeli. Poprawione: chip Menu 3 (②,
active/selected → `bg-state-selected`), lewy rail (⑩, active → `bg-state-selected`), checkbox (㉑,
checked → `c.info`), toggle/switch (㉓, on → wyłącznie `c.success`, usunięta dwuznaczność z `c.accent`),
slider (㉔, wypełnienie → `c.info`), progress bar/ring (㉖㉗, wypełnienie/łuk → `c.info`, @100%
`c.success`), pagination (㉟, aktywny → `bg-state-selected`), **radio (㉒, selected kropka → `c.info`,
sama rodzina co checkbox), spinner (㉙, → `c.info`, spójne z progress), tabs underline (㉜, aktywna
zakładka → `c.info`), stepper/wizard (㉞ i duplikat w §11.3, aktywny krok → `c.info`), highlight
zaznaczenia w Instrumencie (§15.3, → `bg-state-selected`)**. Reguła: **neutralne (`--state-selected`)
dla zaznaczenia/wyboru bez kierunku; `c.info` (niebieski) tam, gdzie potrzebny sygnał
kierunkowy/wypełnienia.** Crimson (`c.accent`) zostaje wyłącznie jako moment marki (M1 primary CTA,
streaming ramka czatu) lub tam, gdzie dokument jawnie wskazuje semantykę destrukcyjną — a i tam
docelowo `c.danger`, nie `c.accent` (§9.3 reguła 2-3). Po tej redakcji jedyne pozostałe `c.accent` w
dokumencie to: definicja roli w §9.1, marker „dziś/teraz" na osi czasu (㊷ Gantt, §11.3, §15.4 — akcent
brandu na linii, nie na danych), reguła palety wizualizacji (§9.2b, §10.3, §15.1 pkt 4 — wszystkie
definicyjne, nie stan kontrolki) i ramka streamingu czatu (§16) — wszystkie zgodne z regułą „TYLKO
moment marki/destrukcja", nie „stan aktywny/wybrany".

### 14.3 Multi-select (dokł.)
- checkbox **h-3.5 w-3.5** (body), **h-4 w-4** (select-all); wyciszony, reveal-on-hover, zaznaczony zawsze widoczny.
- API: `selectedIds · onToggleRow · onToggleAll · isAllSelected · isIndeterminate`.
- Pasek bulk = Menu 3 F2. **Dokładnie jeden rząd Menu 3** (bez dodatkowych stripów).
- **Fix A-1 (walkthrough):** ten mechanizm istnieje w MyWork — braki w Ideas/Tasks/Decisions/Interview/Tools/Assessment = brak spięcia `selection` API, nie brak komponentu.

### 14.4 Kolumny + konfigurator
- `TableColumn{ id, label, width, align, filterable, filterOptions, sortable, render }`.
- `persistKey` → `localStorage: filterableTable.cols.${persistKey}` (szerokości/widoczność/kolejność/desc-toggle).
- Konfig kolumn = **portalowy popover** (ikona `Settings2`).
- **Fix A-4 (Edit Columns):** ikony eye NIE czerwone (`c.text-muted`), label NIE UPPERCASE (L3), instrukcja „drag to reorder" → `title`/tooltip nie body.

### 14.5 Preview pane — żelazny układ (§7.3b)
Szer. **`clamp(340px, 28%, 480px)`** (SYS-2 §9.1a — preview listowy, powierzchnia SPEC-L; RÓŻNA od
prawego panelu artefaktu 360px/320–420px, §9.1a pkt 2), separacja `gap-1.5` **bez `border-l`**. SSOT
kodu i implementacja **zgodne**: `shared/TableWithPreviewLayout.tsx:437,455` (orkiestracja §14.0, **18
konsumentów JSX** — `grep -rl "<TableWithPreviewLayout" src/`, 2026-08-02; surowa wzmianka stringa daje
28, patrz §14.0) implementuje dokładnie tę wartość — zero długu na tym wymiarze. Zgodne też z
`TRIADA_KANON.md` §C9.

**Kolejność (MUST, KOREKTA 2026-08-02 — K-16).** Poprzednia redakcja tego paragrafu stawiała „Co dalej"
jako blok 6 i „Actions" jako blok 7 — sprzeczne z kodem (`StandardPreview.tsx` ok. l.309–370 renderuje
`whatsNext` bezwarunkowo PO `actionRows`) i z siostrzanym `TABLE_AND_PREVIEW_CANON.md` §7.3/§A7, który tę
samą sprzeczność już nazwał i naprawił tego samego dnia. Poprawione tutaj, zgodnie z kodem:
1. **Header sticky:** kicker + tytuł (1 linia truncate) + [pin/link] + **Open** + ×
2. **Meta bar:** status · typ · data (`p-4 rounded-lg`)
3. **Details (⋮ Copy/Export/Download):** bogaty szablon (cel/zakres/kontekst) + word-count + scroll
4. **AI:** chipy Summarize/Suggest
5. **Relations:** (jeśli są) klikalne pills
6. **Actions:** OPCJONALNE — pełny blok akcji (`ActionGridRow`), renderowany tylko gdy po odjęciu
   duplikatów (Open już w headerze, Export/Download już w ⋮ Details) zostaje sensowna akcja
**Poza numeracją TRIADY, zawsze na końcu, PO bloku 6:** **„Co dalej" (create-strip):** `h-8
rounded-full` pills (Raport/Deck/Tabela/Idea/Note/Initiative) — opcjonalny, renderowany bezwarunkowo po
`actionRows` w `StandardPreview.tsx`, nigdy przed akcjami.

Stopka **`space-y-2.5`, BEZ dividerów**. **Anty-duplikacja:** dokładnie 1 „Open" (w headerze); Export/Download **tylko** w ⋮ Details.

### 14.6 Kebab (RowActionsMenu) — 3 strefy
- **GÓRA — kontekstowa** (per status/rola; pusta strefa = ukryta)
- —
- **DÓŁ — FIXED MANIFEST** (zawsze, kolejność): 1. Otwórz podgląd `ChevronRight` · 2. Edytuj `Pencil` · 3. Archiwizuj/Przywróć `Archive`/`RotateCcw` · 4. Delay ▸ `Clock` (tylko gdy `due_date`)
- —
- **DANGER:** Usuń `Trash2` — ostatni, ton danger, confirm

### 14.7 Parity Gate (§27) — „czy tabela ma komplet maszynerii"
9 czerwonych MUST: preview pane · filtry kolumn · sort · resize · sticky header · popover kolumn · kebab z treścią (≥2) · bulk bar z akcjami · stany empty/loading/error. **Tabele z walkthrough do domknięcia:** Tools, Assessment, Results (nie mają parytetu MyWork).

### 14.8 Delta re-skin (co faktycznie robimy — to nie redesign)
1. `slate-*`/`navy-*`/`white/[.0x]` → tokeny `c.*`.
2. Selection = neutral/blue (SYS-1), nie crimson.
3. Egzekwować Parity Gate w tabelach bez parytetu (Tools/Assessment/Results).
4. Menu 2 pill regresja → przywrócić (Notebook/Interview/Results).
5. Edit Columns fix (14.4).
6. Spiąć `selection` API tam gdzie multi-select martwy (A-1).
**Cel:** wszystkie tabele = poziom MyWork. Referencja istnieje; to praca doprowadzenia, nie wymyślania.

---

## 15. INSTRUMENTY — standaryzacja (rama + zasady, gdy centrum bywa różne)

> Instrumentów nie ujednolicimy w centrum — kanban ≠ gantt ≠ dashboard. Ale **ramę, zasady i atomy — tak**. Standaryzujemy wszystko dookoła centrum + doktrynę czytelności. Efekt: różne przyrządy, jeden charakter — klasa światowa.

### 15.1 Doktryna czytelności (7 zasad — mój standard specjalisty)
1. **Cicha rama, głośne dane.** Chrome (nagłówki, ramki, tła) = `c.text-muted`/`c.border-subtle`. Kolor i kontrast należą do DANYCH, nie do dekoracji.
2. **Jeden punkt ogniskowy.** Instrument ma jedną rzecz najważniejszą (metryka / dziś / krytyczny węzeł). Reszta ustępuje.
3. **Progresywne ujawnianie.** Przegląd → klik → szczegół w prawym panelu. Nigdy wszystko naraz na węźle.
4. **Kolor coś znaczy, zawsze.** Żaden kolor bez legendy. Kategorie=`c.tag-*`, stany=semantyczne, „teraz/akcent"=`c.accent`. **Crimson nigdy jako dana.**
5. **Nigdy sam kolor.** Znaczenie = kolor + etykieta/ikona/kształt (daltonizm, druk, kontrast).
6. **Gęstość ze skali.** Wszystko na siatce 4px; liczby `tabular-nums`; równe rozmiary węzłów/belek/kafli.
7. **Pusto uczy, nie straszy.** `⑭`empty tłumaczy „jak zacząć". **Zero danych testowych w produkcji** (lekcja M15: E2E/DEMO śmieci = P1).

### 15.2 Rama instrumentu (STAŁA — niezależna od centrum)
Każdy instrument, cokolwiek w środku, ma tę samą ramę:

| Część ramy | Zawartość | Token/wymiar |
|------------|-----------|--------------|
| Pasek tytułu | L1 tytuł · `④`licznik/„N pozycji" · (prawa) `②`chipy akcji + `①`[AI] | h-44, px-16, dół `c.border-subtle` |
| Kontrolki widoku | zoom/dopasuj (spatial) · zakres czasu (timeline) · filtr `⑰` · grupowanie | w pasku tytułu lub pod nim h-40 |
| **Centrum** | **wolne** (podtyp §15.4) | `c.bg`/`c.surface` |
| Legenda | gdy >1 seria: kropka `c.tag-n` + etykieta L5 | dół lub róg, `c.surface-raised` |
| Prawy panel `⑪` | szczegół zaznaczonego elementu (progresywne ujawnianie) | szer. **360 (zakres 320–420)** — ta sama powierzchnia co ⑪ prawy panel artefaktu, SYS-2 §9.1a pkt 6 |
| Stany | `⑭`empty/`㉘`loading/error; `⑱`tooltip; `⑧`kebab elementu | wg §9 |

### 15.3 Niezmienniki interakcji (te same we WSZYSTKICH instrumentach)
- **Zaznaczenie:** klik element → highlight `bg-state-selected` (neutralne — **NIE `c.accent-soft`**, SYS-1, ta sama reguła co wiersz tabeli §14.2) + szczegół w prawym panelu. Klik tła = odznacz.
- **Hover:** ujawnia akcje elementu (`⋮`) + `⑱`tooltip po 300ms.
- **Edycja inline:** `⑰`popover w miejscu (nie osobny ekran) — tam gdzie edytowalne.
- **Drag:** feedback = shadow-hig-lg + opacity-70; upuszczenie = `⑲`toast potwierdzenia.
- **Przestrzenne (canvas/graf/mapa):** zoom scroll, pan drag-tła, „dopasuj" reset, minimapa gdy duże.
- **Klawiatura:** ↑↓←→ nawigacja, Enter=otwórz szczegół, Esc=odznacz.

### 15.4 Katalog podtypów — co stałe, co wolne
| Podtyp | Centrum (wolne) | Stałe (rama+atomy) | Element |
|--------|-----------------|---------------------|---------|
| Tablica (Kanban) | kolumny + karty | nagłówek·licznik·drag·panel szczegółu | `㊶` |
| Oś czasu (Gantt) | belki na osi | linia „dziś" `c.accent`·zakres·zoom | `㊷` |
| Matryca/siatka | komórki 2D | osie L1·legenda·inline-edit | grid |
| Drzewo/graf | węzły+krawędzie | zoom·minimapa·progresywne ujawnianie | `㊸` |
| Mapa/heatmapa | pola koloru | legenda skali·tooltip wartości | `㊸` |
| Dashboard | kafle+wykresy | `㊳`tile min-w-200·serie `c.tag-*` | `㊳㊸` |
| Miernik (gauge/ring) | łuk/tarcza | `㊷`próg semantyczny·N w środku | `㊗` |
| Wizard | kroki+formularz | `㊞`stepper·treść max-w-720·stopka nav | `㊞` |

### 15.5 Test: instrument czy co innego?
- Pokazuje listę obiektów do wyboru? → to **Lista**, nie instrument.
- Otwiera się sam z tożsamością/linkiem? → to **Artefakt** (nawet jeśli wygląda jak tabela).
- Steruje/monitoruje proces, wbudowany, bez własnego cyklu życia? → **Instrument**.

### 15.6 Definicja „gotowe" dla instrumentu
Rama §15.2 · niezmienniki §15.3 · atomy tylko z puli 40 · paleta §15.1.4 · legenda gdy >1 seria · progresywne ujawnianie · empty uczący · light+dark czytelne · zero danych testowych · brak lokalnych atomów. Cokolwiek poza tym = zgłoś lukę (CANON §3), nie twórz wariantu.

---

## 16. SPEC-K — KONWERSACJA (Chat) — build-ready

> Jedyna powierzchnia tego typu. Model interakcji inny niż L/A/I: strumień + kompozytor + panel Canvas. Referencja: `UnifiedChatPanel`. Bar Tech-2026: cicho, przestrzennie, dane/treść głośne.

**Układ (split):**
| Strefa | Wys./Szer. | Zawartość | Token |
|--------|-----------|-----------|-------|
| Menu 1 | 56 | tytuł wątku (inline) · `②`model-selector · `①`„Nowy czat" · historia-toggle | `c.surface`, dół `c.border-subtle` |
| Strumień | wypełnia | bąble wiadomości + karty tool-call + quick-prompts | `c.bg`, max-w-760 wyśrodk. |
| Kompozytor | auto (min-56, max-200) | `⑤`textarea + załączniki + `sparkles` + send | `c.surface`, border `c.border`, radius-xl |
| Canvas (prawy) | 40–50% | `⑬`preview/edycja artefaktu gdy wygenerowany | slide-in gdy jest treść |

**Bąble:**
- **AI:** bg `c.surface-raised`, text L3, radius-xl (róg dolny-lewy ostry), avatar „C" 24. **NIE crimson** (fix walkthrough — bąble były czerwone).
- **User:** bg transparentny / `c.surface`, wyrównany do prawej, bez avatara lub inicjały na `c.tag-n`.
- **Streaming:** kursor migający + **ramka akcentu wokół CAŁEGO czatu** (nie pola) — puls `c.accent` 1.5s (uwaga Piotra: ramka ma obejmować cały czat).
- **Tool-call card:** collapsible, ikona-narzędzia 16 + nazwa L4 + status (`㉙`spinner→`✓`); rozwiń=wynik.

**Kompozytor (dokł.):** placeholder L3 `c.text-muted`; wysyłka **Cmd/Ctrl+Enter**; `sparkles` = szybkie akcje AI; enter=nowa linia. Disabled podczas streamingu (z „Stop").

**Stany:** empty = logo wyśrodk. niżej (uwaga Piotra) + quick-prompts jako `②`chipy; streaming = typing; error = `㉚`baner + retry.

**Zachowania:** historia wątków = lewy panel toggle; `⑳`Cmd+K; auto-scroll do dołu (z „nowe wiadomości ↓" gdy user przewinął w górę).

---

## 17. SPEC-H — HUB (landing modułu) — build-ready

> Hub NIE jest powierzchnią — to **kompozycja**: rama modułu, która hostuje powierzchnie. Nie wymyśla chrome. Referencja: `ModuleHub` (owija M13/14/15/16/23).

**Struktura:**
| Strefa | Zawartość | Reguła |
|--------|-----------|--------|
| Menu 1 modułu | tytuł modułu + `①`primary („Nowy…") | h-56; jeden primary |
| Menu 2 | `③`pill-tabs = funkcjonalności modułu (h-9) | BEZ liczników (te w Menu 3 F1) |
| Powierzchnia aktywnej zakładki | **LISTA** (domyślnie) lub **INSTRUMENT** (dashboard) | hub hostuje, nie modyfikuje |
| Menu 3 | należy do **aktywnej powierzchni** (nie do huba) | jeden rząd |

**Reguły:**
- Hub = `c.bg`, zero własnych elementów poza Menu 1+2.
- Każda zakładka Menu 2 = jedna powierzchnia (Lista/Instrument). Przełączenie zakładki = zmiana powierzchni, powłoka zostaje.
- Empty modułu (brak danych w ogóle) = `⑭` na poziomie huba z `①`CTA onboarding.
- Uprawnienia/beta: zakładka zablokowana = `④`badge „beta/locked" + `㉚`baner przy wejściu (nie ukrywać bez śladu, chyba że rola tego wymaga).

---

## 18. DEFINITION OF DONE — Artefakt i Instrument (egzekwowalne checklisty)

> Parytet z §14.7 (tabele). Bez tego „zgodność" jest niesprawdzalna.

### 18.1 DoD Artefaktu (czerwone MUST)
- [ ] Menu 1 `⑫`: back/breadcrumb · ikona-typ · tytuł inline · `④`status lifecycle · wskaźnik zapisu (osobno od lifecycle) · [indeks] · jeden `①`primary
- [ ] Powłoka wg archetypu — TYLKO centrum/Menu2/rail się różni; panel/kebab/stany identyczne
- [ ] Prawy panel: sekcje w kolejności Akcje·Właściwości·Powiązania·Komentarze·Historia/AI
- [ ] Powiązania = klikalne, first-class
- [ ] Slot AI (`sparkles`) w stałym miejscu (Menu 3 prawa + sekcja panelu)
- [ ] Otwieranie wg §12.2 (klasa L=pełna, S=drawer); guard niezapisanych zmian
- [ ] Stany empty/loading/error uczciwe (`⑭`)
- [ ] Light + dark czytelne; tokeny `c.*` (zero navy/slate/hex)
- [ ] Zero crimson na: fokus/status/badge domyślny/selection
- [ ] Pełny cykl Tab/Shift+Tab przez powłokę (Menu 1 → panel → sekcje → akcje)
      bez pułapki fokusa; każdy element klikalny (także `<div onClick>`
      karty/wiersza) osiągalny klawiaturą (`tabIndex=0` + `role="button"` +
      Enter/Space)
- [ ] Esc zamyka aktywną warstwę (kebab/dropdown → preview → modal/drawer),
      najbardziej lokalna wygrywa
- [ ] Fokus WIDOCZNY (`focus-visible:ring-2 ring-c.focus`, nigdy `primary-*`/
      crimson) na KAŻDYM interaktywnym; zero `focus:outline-none` bez
      widocznego zamiennika
- [ ] Streaming Teresy (czat/panel AI, karty `generating`) w kontenerze
      `role="log"` + `aria-live="polite"` + `aria-relevant="additions text"`
      (wzór: `UnifiedChatPanel.tsx`)
- [ ] Jeśli ekran to generator/wizard (§0C Typ 4 „Kreatory"): kontrakt §13.7 spełniony w całości
      (postęp N/M ogłaszany · back bez utraty danych · save draft jawny · cancel jednoznaczny ·
      resume po odświeżeniu · walidacja inline+fokus · review przed mutacją · klucz idempotency ·
      partial-failure UI · stan generowania z bezpiecznym wyjściem)
- [ ] Jeśli archetyp to A/Canvas: zakres akcji AI jawny przed uruchomieniem (§13.3a — węzeł[field]/
      gałąź[section]/canvas[tool] nazwany + policzalny), wynik = propozycja z approve/reject (nie
      natychmiastowa mutacja), undo operacji AI jako jedna jednostka. **Warunkowe (K-44, 2026-08-02)** —
      patrz §13.3a „Status DoD — SKORYGOWANY": nieaktywne dla canvasów bez ŻADNEGO wyboru zakresu z UI
      (dziś wszystkie sześć); aktywne jako bramka od momentu, gdy dany canvas wdroży pierwszy wybór
      zakresu — od tej chwili chroni przed regresją
- [ ] Jeśli archetyp to A/Canvas: minimalny zestaw klawiaturowy (§13.3c — utwórz/nawiguj/przesuń/
      połącz/usuń/wyjdź) zweryfikowany bez myszy; **brak = ten canvas nie przechodzi DoD niezależnie od
      pozostałych punktów** i nie może mieć `runtime_status` > `PARTIAL`

### 18.2 DoD Instrumentu (czerwone MUST)
- [ ] Rama §15.2 (pasek tytułu + licznik + akcje + legenda + panel szczegółu)
- [ ] Niezmienniki interakcji §15.3 (zaznaczenie→panel, hover, inline-edit, drag, klawiatura)
- [ ] Atomy tylko z puli 40 (zero lokalnych)
- [ ] Paleta: serie `c.tag-*`, stany semantyczne, **crimson nigdy jako dana**; legenda gdy >1 seria
- [ ] Progresywne ujawnianie (przegląd→klik→szczegół)
- [ ] Znaczenie nie tylko kolorem (kolor+etykieta/ikona)
- [ ] Zero danych testowych w produkcji
- [ ] Empty uczący; light+dark czytelne

---

## 19. STANDARD CROSS-CUTTING (obowiązuje każdą powierzchnię)

### 19.1 Responsywność (desktop-first — Consultify to narzędzie pracy)
| Breakpoint | Zachowanie |
|-----------|-----------|
| ≥1280 | pełny układ: rail + centrum + prawy panel obok siebie |
| 1024–1280 | prawy panel → `⑯`drawer (toggle); rail zostaje |
| 768–1024 | rail → drawer; jedna kolumna; preview → pełny; Menu 3 scroll-x |
| <768 (mobile) | stack; klasa-S → bottom-sheet; Menu 2 scroll-x; **tryb read + lekkie akcje** (nie pełna edycja canvasu) |
Reguła: mobile = przegląd i lekkie akcje, nie budowa artefaktów. Nie udajemy że canvas działa na telefonie.

### 19.2 Treść / copy / i18n
- PL + EN, **sentence case** (UPPERCASE tylko L1-kicker); przyciski = **czasownik pierwszy** („Zapisz", nie „Zapisywanie").
- Puste stany **uczą** („Dodaj pierwszą inicjatywę", nie „No data"). Błędy **ludzkie** (nie raw/`[object Object]`/kod).
- Zero żargonu deweloperskiego w UI. Owner = i18n sweep; zakaz bare-missing keys.

### 19.3 Dostępność (a11y)
- Fokus zawsze widoczny, niebieski `c.focus`; pełna nawigacja klawiaturą (mapa skrótów §6/§12).
- Kontrast tekst ≥4.5:1, duży ≥3:1 (tokeny już to spełniają).
- **Nigdy sam kolor** jako nośnik znaczenia (status = kolor+etykieta+kropka).
- ARIA na interaktywnych; `prefers-reduced-motion` respektowane.

### 19.4 Motion (inwentarz)
- Animujemy: wejścia paneli/drawerów/modali (200ms ease-hig), streaming, skeleton-puls, hover-reveal (100ms).
- NIE animujemy w produkcie: bounce/spring (tylko brand-moment), skoki layoutu, migotanie.
- Wszystko ≤220ms; `prefers-reduced-motion` = wyłącza nieistotne.

### 19.5 Gęstość
- Domyślnie „comfortable"; toggle „compact" (tabele mają — rozszerzyć na grid/instrument).
- Liczby `tabular-nums` wszędzie; siatka 4px bez wyjątków.

---

## 20. DECYZJE ROZSTRZYGNIĘTE (CTO, poprzeczka Tech-2026)

| ID | Decyzja | Rozstrzygnięcie |
|----|---------|-----------------|
| Q2 | Interview = archetyp? | **Wariant Rekordu z centrum-konwersacją** (nie 6. archetyp). Powłoka Rekordu, centrum = czat. |
| Q3 | Klasa S = panel/modal? | **Drawer** nad kontekstem; deep-link = pełna strona; quick-create = modal. |
| — | Chat = 4. typ? | **Tak** — KONWERSACJA, SPEC-K §16. |
| D-NAV | 8 sierot | Studio→**Materiały** · KB→**Settings/Help** · Legal→**dbr77-internal** · Partner→**dbr77-internal** · Context Builder→**Organization/onboarding** · Megatrend→pod Context · Project Intelligence→**Execution** (HUB) · Executive Summary→**Materiały**. |
| §7 | 10 sugestii do v1 | **Wszystkie 10 wchodzą** (to tania doktryna: empty/loading/error, preview=skrócony artefakt, tryb read/edit, relacje first-class, slot AI, meta-Template, klasa fluid, skróty zarezerwowane, Cmd+K, gęstość/rytm). |
| AUTH | Autorytet vs CANON | Ten dokument = **nowa warstwa `03-modules/artifact-anatomy-standard`** pod CANON.md. `TABLE_AND_PREVIEW_CANON` zostaje szczegółem tabel (§14 do niego referuje). Zero konfliktu: CANON §2 hierarchia obowiązuje. |

---

## 8. Status i następny krok

**Kontrakt budowy KOMPLETNY:**
- [x] 4 powierzchnie + test klasyfikacji (§0C)
- [x] Filary, anatomia, reguła zejścia w głąb (§1-2)
- [x] 5 archetypów × 2 klasy + mapa 47 wg sidebara (§3, §4B)
- [x] Menu per archetyp + katalog akcji/ikon + kolejność PPM (§5-6)
- [x] 40 elementów, struktura graficzna light/dark z realnego kodu (§9)
- [x] Kompozycja 3 powierzchni + build-ready wymiary/tokeny/stany (§10-11)
- [x] Nawigacja i otwieranie (§12) + instancjacja per artefakt (§13)
- [x] SPEC-L tabela (zgodny z kanonem+MyWork, §14) · SPEC-I instrumenty (§15) · SPEC-K chat (§16) · SPEC-H hub (§17)
- [x] DoD Artefakt/Instrument (§18) · cross-cutting: responsywność/copy/a11y/motion/gęstość (§19)
- [x] 4 decyzje rozstrzygnięte + autorytet vs CANON (§20)

**Jedyny checkpoint przy budowie (nie blokuje planu):** §13 (ikony lucide + zakładki/pola per artefakt) to STAN DOCELOWY zaprojektowany — przy kodowaniu każdego artefaktu potwierdzić realne pola encji (agent read-only per archetyp). Nie wymaga zmian w kodzie teraz.

**Następny krok (decyzja Piotra):** spiąć §14.8/§18/§19 z falami RESKIN_AUDIT i wydać zadania Cloud → wtedy otworzyć gate rundy 1 (dziś zamknięty). Rekomendacja startu: **tabele** (§14 uziemiony, referencja MyWork istnieje = najniższe ryzyko).

---

## CHANGELOG

**2026-08-02 — redakcja: usunięcie trzech klas sprzeczności wewnętrznych** (bez zmian numeracji sekcji,
bez nowej treści merytorycznej poza notami rozstrzygającymi):

1. **Szerokość prawego panelu / preview (SYS-2, nowe §9.1a). SKORYGOWANE — patrz wpis 4.** Wpis
   poniżej opisuje przesłankę, którą wpis 4 tego samego dnia unieważnił jako błędną (preview listowy i
   prawy panel artefaktu to DWIE różne powierzchnie, nie jedna) — czytaj oba, nie sam ten wpis. Pięć niezgodnych wartości (§9.2⑪
   320–380 · §9.2⑬ 400–480 · §11.1 420 · §11.2 360(320–420) · §14.5 `clamp(340px,28%,480px)`)
   sprowadzone do jednej: prawy panel/drawer ogólny = domyślnie 360, zakres 320–420; preview listowy
   SPEC-L = 420 (górna granica); drawer formularzowy szeroki = 420 — zgodnie z
   `FOUNDATION_TOKEN_CONTRACT.md` §4. Udokumentowany, nie ukryty, dług realnego kodu:
   `shared/TableWithPreviewLayout.tsx` (SSOT preview, ~18 callerów) dziś przekracza 420 (`clamp(340px,
   28%, 480px)`) — do sprowadzenia do kanonu; `IdeaTableTool.tsx` używa 460/480 (poza zakresem).
2. **Wysokość Menu 2 w §11.2 (40 → 48).** Wiersz tabeli build-ready poprawiony na 48px, zgodnie z prozą
   tego samego paragrafu i z `FOUNDATION_TOKEN_CONTRACT.md` §4. Dopisany jawny dług doc↔kod: realna
   wysokość Menu 3 (`MENU_3_ROW_CLASS`, `src/components/shared/ModuleMenu3.tsx`) ≈48px wobec
   dokumentowego celu 44px — do rozstrzygnięcia osobno.
3. **Crimson jako stan aktywny/zaznaczony w §9.2 (rozszerzenie SYS-1).** Poprawka „selection = neutral/
   blue, not crimson", wcześniej udokumentowana tylko przy wierszu tabeli (§14.2), rozszerzona na
   wszystkie kontrolki §9.2, które nadal wskazywały `c.accent`/`c.accent-soft` jako stan aktywny: chip
   Menu 3 (②) i lewy rail (⑩) → `bg-state-selected` (neutralne); checkbox (㉑) → `c.info`; toggle/switch
   (㉓) → wyłącznie `c.success` (usunięta dwuznaczność „lub `c.accent`"); slider (㉔) i progress bar/ring
   (㉖㉗) → `c.info` (@100% `c.success` dla progress, spójnie z §14.2); pagination (㉟) →
   `bg-state-selected`. Nota SYS-1 w §14.2 rozszerzona, żeby jawnie obejmować całe §9.2. Wszystkie
   użyte tokeny (`--state-selected`, `--c-info`, `--c-focus`) zweryfikowane w `src/index.css` i
   `tailwind.config.js`.

4. **Korekta błędnej przesłanki w §9.1a (SYS-2) — przesłanka Piotra była nietrafna, poprzedni agent miał
   rację.** Wpis 1 powyżej sprowadzał 5 wartości do jednej (420px dla preview listowego) na błędnym
   założeniu, że preview listowy i prawy panel artefaktu to jedna powierzchnia. Weryfikacja w kodzie
   (`grep -rn "clamp(340px" src/components/`, `grep -rln "TableWithPreviewLayout" src/ | wc -l` → 28
   callerów) i w `FOUNDATION_TOKEN_CONTRACT.md` §4 potwierdza: to są DWIE różne powierzchnie. **Preview
   listowy** (§9.2⑬, §11.1, §14.5) = `clamp(340px, 28%, 480px)` — już zaimplementowane w
   `TableWithPreviewLayout.tsx:437,455`, zero długu, zgodne z `TRIADA_KANON.md` §C9. **Prawy panel
   artefaktu / drawer formularzowy** (§9.2⑪, §11.2) = 360px domyślnie / 320–420px zakres / 420px drawer
   szeroki — bez zmian, to była poprawna wartość. Dług przeniesiony z powrotem tam gdzie faktycznie jest:
   `MyProjects.tsx:864,1084` (bespoke `w-[420px]` omijający SSOT) i `IdeaTableTool.tsx` (460/480px).
5. **Dokończenie SYS-1 — pięć kontrolek poza mandatem poprzedniej redakcji.** Ten sam błąd (crimson jako
   stan aktywny/zaznaczony) naprawiony w: radio (㉒, selected → `c.info`), spinner (㉙, → `c.info`), tabs
   underline (㉜, aktywna zakładka → `c.info`), stepper/wizard (㉞ w §9.2b i duplikat w §11.3, aktywny
   krok → `c.info`), highlight zaznaczenia w Instrumencie (§15.3, → `bg-state-selected`). Nota SYS-1 w
   §14.2 rozszerzona po raz drugi, żeby jawnie wymieniać te pięć pozycji.
6. **Nowy §13.7 „Kontrakt generatora / wizarda".** Stepper był dotąd opisany wyłącznie jako atom
   wizualny (kółko 24 + L4) — bez zachowania. Dodano normatywny, mierzalny kontrakt (postęp ogłaszany
   `aria-current="step"` · back bez utraty danych · save draft · cancel jednoznaczny co do skutku ·
   resume po odświeżeniu · walidacja inline z przeniesieniem fokusa · review przed mutacją · klucz
   idempotency · dedykowany UI partial-failure · stan generowania z bezpiecznym wyjściem), zgodnie z
   `CANON.md` §8 i `UI_UX_IMPLEMENTATION_STANDARD.md` §8, powiązany z dopisanym punktem w DoD §18.1.
7. **Nowy §13.3a „Kontrakt zakresu AI na canvasie".** `UI_UX_IMPLEMENTATION_STANDARD.md` §7.4 obiecuje
   jawny zakres AI (węzeł/gałąź/cała mapa) — ten SSOT anatomii Canvasu dotąd opisywał tylko miejsce slotu
   AI, nie zakres. Dodano trzy poziomy zakresu, wymóg nazwania zakresu przed uruchomieniem, propozycję/
   diff zamiast natychmiastowej mutacji, undo jako jedna jednostka, bezpieczne anulowanie streamu.
8. **Nowy §13.3b „Limity wydajności canvasu".** Próg 500 węzłów / 750 krawędzi / pan-zoom bez zadań
   >50ms (SSOT liczb: `COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`, dotąd nieobecny w tym dokumencie)
   wpisany do SSOT anatomii przez odwołanie, wraz z wymaganą reakcją po przekroczeniu (ostrzeżenie +
   degradacja świadoma, lub wirtualizacja) i obowiązkiem alternatywnego widoku listy/detail.
9. **Nowy §13.3c „Klawiatura na canvasie — bramka" + korekta §7 pkt 8.** Dotychczasowe „przewidziane
   teraz, wdrożone później" bez terminu i bez bramki zastąpione jawnym kontraktem minimalnego zestawu
   (utwórz/nawiguj/przesuń/połącz/usuń/wyjdź — każde bez myszy) i jawnym oznaczeniem jako świadomej luki
   runtime (CANON §3.2): dopóki niewdrożone, dany canvas nie może mieć `runtime_status` > `PARTIAL` i nie
   przechodzi DoD §18.1 — dopisane jako punkt bramkujący w §18.1, nie jako przypis.

---

**2026-08-02 — redakcja: panel adwersaryjny, naprawa defektów po dwóch poprzednich redakcjach tego samego
dnia (K-16/K-22/K-27/K-28/K-42/K-43/K-44/K-45).** Każde twierdzenie o kodzie zweryfikowane realnym
poleceniem przed wpisaniem (patrz treść przy każdym punkcie). Statusy nigdzie nie podniesione —
poprawki idą w kierunku uczciwości, nie optymizmu.

1. **K-16 (P0) — §14.5 kolejność bloków preview sprzeczna z kodem i z `TABLE_AND_PREVIEW_CANON.md`.**
   Poprzedni zapis miał „6. Co dalej" przed „7. Actions" — sprzecznie z `StandardPreview.tsx` (ok.
   l.309–370, `whatsNext` renderowany bezwarunkowo PO `actionRows`) i z siostrzanym dokumentem, który tę
   samą sprzeczność już nazwał i naprawił tego samego dnia. Poprawione: Actions = blok 6 (numerowany,
   opcjonalny), „Co dalej" = poza numeracją, zawsze PO bloku 6.
2. **K-22 (P1) — nota SYS-2 (§9.1a) pominęła dwa kolejne niezgodne wystąpienia szerokości.** §9.2b ⑯
   Drawer/Sheet („360–480") i §15.2 prawy panel instrumentu („320–360") nie były objęte pierwotną
   korektą mimo że ta twierdziła, że sprowadza „pięć niezgodnych wartości do dwóch". Rozstrzygnięcie po
   weryfikacji w kodzie: Drawer/Sheet to osobna powierzchnia z REALNĄ, ale błędnie opisaną wartością —
   `src/components/ui/primitives/Drawer.tsx` ma cztery dyskretne warianty 256/320/384/480px, nie zakres
   ciągły „360–480" — poprawione na 256–480 z adnotacją o dyskretności. Panel instrumentu w §15.2 to NIE
   osobna powierzchnia — to ten sam prawy panel ⑪ (320–420, domyślnie 360) bez uzasadnienia dla własnej,
   węższej wartości — poprawione na zgodność z ⑪. Nota SYS-2 rozszerzona o pkt 5-6, żeby nie twierdzić
   nieprawdy o kompletności.
3. **K-27 (P1) — §14.0 drastycznie zaniżona liczba użyć `ModuleMenu3.tsx` („1").** `grep -rlE "from
   ['\"].*ModuleMenu3['\"]" src/ | grep -v ModuleMenu3.tsx | wc -l` (2026-08-02, metoda uwzględniająca
   wieloliniowe importy destrukturyzowane) → **27**. Poprawione, z jawną metodą i datą.
4. **K-28 (P1) — trzy różne liczby dla `TableWithPreviewLayout.tsx` w trzech miejscach (§14.0 „25",
   §9.1a „28 realnych callerów", §14.5 „28 callerów").** Zdefiniowana i zastosowana metodologia dla
   całego §14: import (`grep -rln "import.*<Nazwa>"` / wariant wieloliniowy) · JSX (`grep -rl "<Nazwa"`,
   domyślna miara konsumenta) · wzmianka (`grep -rln "Nazwa"`, najmniej wiarygodne). Realni konsumenci
   JSX `TableWithPreviewLayout` = **18** (2026-08-02); surowa wzmianka stringa (import+typy+komentarze)
   = 28 — obie liczby teraz podane z etykietą metody, nie sprzeczne ze sobą. Ujednolicone we wszystkich
   trzech miejscach. Przy okazji przejrzane inne liczby adopcji w §14.0: `FilterableTable.tsx` „24" →
   **26** (JSX, kod się zmienił od poprzedniego pomiaru); `GridView.tsx` „8" zweryfikowane jako
   POPRAWNE po wykryciu kolizji nazwy z niepowiązanym `MyWork/table/GridView.tsx` (bez rozróżnienia JSX
   „<GridView" dałby fałszywe 14).
5. **K-42 (P1) — §13.7 pkt 8 nazywał idempotency, nie projektował jej.** Dopisany konkretny mechanizm:
   kto generuje klucz (klient, na wejściu w krok wykonania) · gdzie żyje (nagłówek HTTP
   `Idempotency-Key`, nie payload) · TTL backendu (min. 24h) · zachowanie przy kolizji (200/201 z cache
   albo 409 z odsyłaczem — nigdy cichy duplikat). `AuditOrchestratorWizard.tsx` przywołany dotąd jako
   przykład opisany uczciwie jako **kontrprzykład**: `handleCreate` (l.167–193) nie niesie żadnego
   klucza idempotency, `disabled={submitting}` nie chroni przed retry po timeout; `surveysGenerated:
   false` (l.183) to inny, niepowiązany mechanizm run-once dla osobnego fan-outu ankiet. Domknięta luka
   między pkt 8 i pkt 9: retry partial-failure używa NOWEGO klucza per element, nie klucza sesja×krok.
6. **K-43 (P1) — §13.3b próg wydajności canvasu bez metody pomiaru.** Dopisane realne progi z kodu obok
   progu docelowego: `virtualization.ts` (`VIRTUALIZATION_NODE_THRESHOLD=300`), `LargeMapOptimizer.tsx`
   (`WARNING=150/CRITICAL=300/AUTO_SIMPLIFY=500`) — żaden nie zgadza się z appendixem (500/750/50ms) ani
   ze sobą nawzajem. Jawnie stwierdzone: `tests/e2e/m06/m06-21-large-maps.spec.ts` jest
   `test.skip(true,'[MANUAL]')`, brak automatycznego pomiaru w CI; kod sam przyznaje „no occlusion
   culling above ~300 nodes" — próg nie jest dziś dotrzymywany ani mierzalny. Punkt zdegradowany z
   „odbieralny MUST" do „cel architektoniczny bez bramki", z warunkiem podniesienia (test CI + jedna
   uzgodniona liczba).
7. **K-44 (P1) — §13.3a zakres AI na canvasie jako DoD-blocking MUST dla systemu, który nie istnieje.**
   Status DoD skorygowany: punkt bramkujący §18.1 przestaje blokować bezwarunkowo wszystkie sześć
   artefaktów archetypu A — jest nieaktywny dla canvasu bez ŻADNEGO wyboru zakresu z UI (dziś
   wszystkie sześć), aktywny (chroni przed regresją) od pierwszej implementacji referencyjnej.
   Nazewnictwo trzech poziomów (węzeł/gałąź/canvas) powiązane z istniejącą taksonomią N-mode
   tool→section→field (`NModeLayout/types.ts`, `FieldAIButton.tsx`) zamiast tworzyć trzecią. Opisany
   realny punkt wyjścia: `aiSidekickContext.ts` (`detectMindmapIntent`, heurystyka bez UI zakresu) i
   `AIProposalDiffModal.tsx` (`selectedNodeIndices`, częściowe approve/reject per-węzeł).
8. **K-45 (P3) — changelog sam sobie przeczył.** Wpis 1 (2026-08-02, powyżej) opisywał przesłankę, którą
   wpis 4 tego samego dnia unieważnił jako błędną, bez wzajemnej adnotacji — czytelnik idący od góry
   przyjąłby nieaktualną wersję. Dopisane do wpisu 1: „SKORYGOWANE — patrz wpis 4".
