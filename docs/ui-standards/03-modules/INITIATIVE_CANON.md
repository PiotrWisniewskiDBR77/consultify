# Canon inicjatyw — Initiative Detail View

> **Przeznaczenie.** Ten dokument jest jedyną prawdziwą specyfikacją sekcji widoku szczegółów inicjatywy (`InitiativeDocumentView`). Każda nowa sekcja, każdy refactor i każde AI-wypełnienie MUSI tu zaczynać i kończyć.

---

## Anatomia artefaktu (4 warstwy)

```
┌─────────────────────────────────────────────────────────────┐
│  1. IDENTITY                                                │
│     Title · Status dot · Artifact ID · Saved · N/C toggle  │
├─────────────────────────────────────────────────────────────┤
│  2. PROPERTIES STRIP                                        │
│     STATUS · PHASE · NEXT GATE · PRIORITY · OWNER · TARGET  │
├─────────────────────────────────────────────────────────────┤
│  3. MANAGEMENT TOOLBAR                                      │
│     [Workflow actions]                  [Analyze with AI →] │
├───────────────────┬─────────────────────────────────────────┤
│  4. CONTENT       │                                         │
│                   │  SectionCard stack for active section   │
│  Left nav         │  ┌──────────────────────────────────┐   │
│  (242px)          │  │ Section Title          [✨ AI]   │   │
│                   │  │ Description text                 │   │
│  • Section A ←    │  │ ─────────────────────────────── │   │
│  • Section B      │  │ Card / field / table content     │   │
│  • Section C      │  └──────────────────────────────────┘   │
│                   │  [+ Add item]                           │
└───────────────────┴─────────────────────────────────────────┘
```

**Zasady anatomii:**
- Każde pole tekstowe ma po prawej subtelny przycisk ✨ (FieldAIButton) — zawsze.
- AI działa na 3 poziomach: pole (✨) → sekcja (propose→checkboxes→add) → artefakt ("Analyze with AI").
- Kolejność sekcji w sidebarze jest **personalna** (drag & drop + localStorage). Kolejność eksportu jest **kanoniczna** (określona poniżej).
- **Genesis = pełne AI-wypełnienie** — wszystkie sekcje zaznaczone ★ są automatycznie wypełniane przez AI w momencie tworzenia inicjatywy.

---

## Grupy nawigacyjne

| Grupa | Sekcje |
|-------|--------|
| **Scope & Plan** | Initiative Scope, Tasks, Timeline, Dependencies |
| **Decisions & Risk** | Decisions, Risk & RAID, Gates |
| **Outcomes** | Success Criteria, KPIs & Benefits, Financial Analysis, Financial Impact |
| **People** | Team, RACI |
| **Records** | Resources, Attachments & Links, Used in, Comments, Activity Log |

---

## Sekcje — Kontrakty

### SCOPE & PLAN

---

#### `initiative-definition` — Initiative Scope / Zakres inicjatywy ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co dokładnie robimy i dlaczego teraz?" |
| **Typ treści** | Pola prose: Problem Statement · Objective · Strategic Rationale · Scope In / Scope Out |
| **Źródło (auto-load)** | AI genesis z kontekstu projektu + prompt użytkownika przy tworzeniu |
| **cSpan** | 1 (standard) |
| **Badge** | — |
| **cHidden** | Nigdy — sekcja zawsze widoczna |
| **Kiedy wypełnione** | Zawsze; AI wypełnia genesis w całości |
| **Pusty stan** | "Opisz zakres inicjatywy — problem, cel i co jest, a co nie jest w scope." |
| **AI sekcji (✨)** | Przepisz zakres z konkretnym "Robimy X dla Y, żeby osiągnąć Z. Nie robimy: …" Użyj kontekstu projektu. |

---

#### `tasks` — Tasks / Zadania

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co trzeba zrobić krok po kroku, kto to robi i kiedy?" |
| **Typ treści** | Task list: checkbox + tytuł + assignee (avatar) + due date + status (Open/In Progress/Done) |
| **Źródło (auto-load)** | Tabela `tasks` filtrowana po `initiativeId` |
| **cSpan** | 2 |
| **Badge** | `tasks.length` gdy > 0 |
| **cHidden** | Gdy `tasks.length === 0` |
| **Kiedy wypełnione** | Gdy istnieje ≥ 1 task |
| **Pusty stan** | "Brak zadań. Dodaj pierwsze zadanie lub poproś AI o breakdown." |
| **AI sekcji (✨)** | Wygeneruj listę zadań z podziałem na etapy, bazując na zakresie i harmonogramie. |

---

#### `timeline` — Timeline / Harmonogram ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Kiedy co się wydarzy — kamienie milowe i krytyczne daty?" |
| **Typ treści** | Widok Gantt / kamieni milowych: milestone + data + status + owner |
| **Źródło (auto-load)** | `initiative.startDate` / `endDate` / `milestones`; AI genesis uzupełnia etapy |
| **cSpan** | 3 (szeroki — pełna szerokość canvas) |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Zawsze; AI genesis proponuje fazowanie |
| **Pusty stan** | "Brak harmonogramu. Ustaw daty lub wygeneruj fazowanie." |
| **AI sekcji (✨)** | Zaproponuj realistyczne kamienie milowe na podstawie zakresu, zasobów i daty docelowej. |

---

#### `dependencies` — Dependencies / Zależności

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co nas blokuje lub na czym polegamy, żeby iść do przodu?" |
| **Typ treści** | Dependency cards: typ (blocks/depends on/related) + powiązany artefakt + status (Open/Resolved) |
| **Źródło (auto-load)** | Tabela `initiative_dependencies` |
| **cSpan** | 2 |
| **Badge** | `dependencies.length` gdy > 0 |
| **cHidden** | Gdy `dependencies.length === 0` |
| **Kiedy wypełnione** | Gdy istnieje ≥ 1 zależność |
| **Pusty stan** | "Brak zidentyfikowanych zależności." |
| **AI sekcji (✨)** | Zidentyfikuj typowe zależności dla tego typu inicjatywy i kontekstu organizacyjnego. |

---

### DECISIONS & RISK

---

#### `decisions` — Decisions / Decyzje

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie kluczowe decyzje zostały podjęte, a jakie jeszcze wymagają rozstrzygnięcia?" |
| **Typ treści** | DecisionCard: treść decyzji + status (Open / Made / Deferred) + owner + data + uzasadnienie |
| **Źródło (auto-load)** | Tabela `decisions` filtrowana po `initiativeId` |
| **cSpan** | 2 |
| **Badge** | `decisions.length` gdy > 0 |
| **cHidden** | Gdy `decisions.length === 0` |
| **Kiedy wypełnione** | Gdy istnieje ≥ 1 decyzja |
| **Pusty stan** | "Brak decyzji. Decyzje podjęte w trakcie inicjatywy warto rejestrować tu." |
| **AI sekcji (✨)** | Zaproponuj listę kluczowych decyzji typowych dla tego rodzaju inicjatywy. |

---

#### `risk-raid` — Risk & RAID / Ryzyko i RAID

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co może pójść nie tak? — Risks, Assumptions, Issues, Dependencies" |
| **Typ treści** | RAID card: kategoria (R/A/I/D) + opis + prawdopodobieństwo + wpływ + mitygacja |
| **Źródło (auto-load)** | `raidItems` z tabeli RAID |
| **cSpan** | 2 |
| **Badge** | `raidItems.length` gdy > 0 |
| **cHidden** | Gdy `raidItems.length === 0` |
| **Kiedy wypełnione** | Gdy istnieje ≥ 1 wpis RAID |
| **Pusty stan** | "Brak wpisów RAID. Dobra inicjatywa zaczyna od identyfikacji ryzyk." |
| **AI sekcji (✨)** | Wygeneruj RAID log bazując na zakresie, harmonogramie i kontekście organizacyjnym. |

---

#### `gates` — Gates / Bramy

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie formalne przeglądy i zatwierdzenia są wymagane przed przejściem do kolejnej fazy?" |
| **Typ treści** | Gate card: nazwa bramy + kryteria przejścia + status (Pending / Passed / Failed) + data + approver |
| **Źródło (auto-load)** | `pendingGates` — bramy z faz harmonogramu |
| **cSpan** | 1 |
| **Badge** | `pendingGates.length` gdy > 0 |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Gdy istnieje ≥ 1 brama |
| **Pusty stan** | "Brak bram. Dla formalnych inicjatyw dodaj punkty kontrolne zatwierdzenia." |
| **AI sekcji (✨)** | Zaproponuj bramy i kryteria przejścia adekwatne do typu i fazy inicjatywy. |

---

### OUTCOMES

---

#### `target-state-scope` — Success Criteria / Kryteria sukcesu ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Skąd będziemy wiedzieć, że nam się udało — konkretne, mierzalne kryteria sukcesu?" |
| **Typ treści** | Criteria cards: kryterium (SMART) + metoda pomiaru + wartość docelowa + termin |
| **Źródło (auto-load)** | AI genesis z celu inicjatywy |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Zawsze; AI genesis proponuje 3–5 kryteriów |
| **Pusty stan** | "Zdefiniuj kryteria sukcesu — bez nich nie wiesz, kiedy inicjatywa się kończy." |
| **AI sekcji (✨)** | Wygeneruj SMART kryteria sukcesu z celu inicjatywy. Każde kryterium musi być weryfikowalne. |

---

#### `kpi` — KPIs & Benefits / KPI i korzyści ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie liczby mierzymy i jakich wymiernych korzyści oczekujemy?" |
| **Typ treści** | StatCard: nazwa metryki + baseline + cel + jednostka + kategoria korzyści (finansowa/operacyjna/strategiczna) |
| **Źródło (auto-load)** | AI genesis z kryteriów sukcesu i kontekstu |
| **cSpan** | 2 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Zawsze; AI genesis proponuje KPIs |
| **Pusty stan** | "Dodaj KPI — bez mierników nie można śledzić postępu." |
| **AI sekcji (✨)** | Zaproponuj KPIs i skwantyfikowane korzyści. Każde KPI: wzór pomiaru + baseline + cel + termin. |

---

#### `financial-analysis` — Financial Analysis / Analiza finansowa ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Ile to kosztuje i jak uzasadniamy tę inwestycję finansowo?" |
| **Typ treści** | Budget table: kategoria kosztu + szacunek + rzeczywisty + odchylenie; sekcja narracyjna (uzasadnienie) |
| **Źródło (auto-load)** | AI genesis z zakresu i kontekstu branżowego |
| **cSpan** | 2 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Zawsze; AI genesis szacuje koszty |
| **Pusty stan** | "Brak analizy kosztów. Dodaj szacunki budżetowe." |
| **AI sekcji (✨)** | Wykonaj analizę kosztów-korzyści z podziałem na CAPEX/OPEX. Podaj przedział ufności szacunków. |

---

#### `financial-impact` — Financial Impact / Wpływ finansowy ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jaki jest oczekiwany zwrot z inwestycji i kiedy?" |
| **Typ treści** | MatrixTable: ROI · NPV · Payback period · Break-even; wykres wartości w czasie |
| **Źródło (auto-load)** | AI genesis bazując na `financial-analysis` |
| **cSpan** | 2 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Zawsze; AI genesis modeluje scenariusze |
| **Pusty stan** | "Brak modelu wpływu finansowego." |
| **AI sekcji (✨)** | Modeluj wpływ finansowy w 3 scenariuszach (pesymistyczny / bazowy / optymistyczny). |

---

### PEOPLE

---

#### `team` — Team / Zespół ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Kto jest zaangażowany, w jakich rolach i z jakim zaangażowaniem czasowym?" |
| **Typ treści** | Person cards: imię + rola + alokacja (%) + kontakt + status (Active/Inactive) |
| **Źródło (auto-load)** | `initiative.team` / `stakeholders`; AI genesis sugeruje skład |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Zawsze; AI genesis proponuje strukturę zespołu |
| **Pusty stan** | "Brak członków zespołu. Dodaj osoby zaangażowane w inicjatywę." |
| **AI sekcji (✨)** | Zaproponuj skład zespołu i role bazując na zakresie, budżecie i typie inicjatywy. |

---

#### `raci` — RACI / RACI

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Kto jest Responsible, Accountable, Consulted i Informed dla każdej aktywności?" |
| **Typ treści** | RACI matrix: wiersze = aktywności, kolumny = role/osoby, komórki = R/A/C/I |
| **Źródło (auto-load)** | Budowana z `stakeholders` i `tasks` |
| **cSpan** | 2 |
| **Badge** | `stakeholders.length` gdy > 0 |
| **cHidden** | Gdy `stakeholders.length === 0` |
| **Kiedy wypełnione** | Gdy istnieje ≥ 1 stakeholder |
| **Pusty stan** | "Dodaj stakeholderów, żeby zbudować macierz RACI." |
| **AI sekcji (✨)** | Wygeneruj macierz RACI z listy zadań i struktury zespołu. Każda aktywność musi mieć dokładnie 1 A. |

---

### RECORDS

---

#### `resources` — Resources / Zasoby

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie zasoby — ludzie, narzędzia, budżet — są potrzebne i jaki jest ich status dostępności?" |
| **Typ treści** | Resource list: typ (Human/Tool/Budget/Infrastructure) + ilość + koszt + status (Available/Missing/At Risk) |
| **Źródło (auto-load)** | Ręczne wpisy; AI genesis sugeruje listę |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Gdy zasoby dodane ręcznie lub przez AI |
| **Pusty stan** | "Nie zdefiniowano zasobów." |
| **AI sekcji (✨)** | Oszacuj potrzebne zasoby na podstawie zakresu i harmonogramu. Zaznacz braki (At Risk). |

---

#### `attachments-links` — Attachments & Links / Załączniki i powiązania

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie dokumenty, pliki i linki zewnętrzne są powiązane z tą inicjatywą?" |
| **Typ treści** | Attachment grid (plik + typ + data) + URL list (tytuł + link + opis) |
| **Źródło (auto-load)** | `attachments` + `linkedItems` z tabeli powiązań |
| **cSpan** | 1 |
| **Badge** | `attachments.length + linkedItems.length` gdy > 0 |
| **cHidden** | Gdy oba = 0 |
| **Kiedy wypełnione** | Gdy istnieje ≥ 1 plik lub link |
| **Pusty stan** | "Brak załączników ani linków." |
| **AI sekcji (✨)** | — (sekcja czysto manualna) |

---

#### `used-in` — Used in / Użyte w (backlinks)

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "W jakich innych artefaktach ta inicjatywa jest cytowana lub powiązana?" |
| **Typ treści** | Backlink list: typ artefaktu (ikona) + tytuł + data ostatniej modyfikacji + autor |
| **Źródło (auto-load)** | Graph query — odwrotne linki do tego `initiativeId` |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Gdy istnieją backlinki; pusty stan pokazujemy jako informację, nie błąd |
| **Pusty stan** | "Ta inicjatywa nie jest jeszcze cytowana w innych dokumentach." |
| **AI sekcji (✨)** | — (dane systemowe, nie AI) |

---

#### `comments` — Comments / Komentarze

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co zespół dyskutuje na bieżąco w kontekście tej inicjatywy?" |
| **Typ treści** | Thread comments: avatar + imię + treść + timestamp + reakcje emoji + reply thread |
| **Źródło (auto-load)** | Tabela `comments` filtrowana po `initiativeId` |
| **cSpan** | 1 |
| **Badge** | `comments.length` gdy > 0 |
| **cHidden** | Gdy `comments.length === 0` |
| **Kiedy wypełnione** | Gdy istnieje ≥ 1 komentarz |
| **Pusty stan** | "Brak komentarzy. Rozpocznij dyskusję." |
| **AI sekcji (✨)** | — (komentarze to głos ludzki, nie AI) |

---

#### `activity-log` — Activity Log / Dziennik aktywności

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co się zmieniło, kto to zmienił i kiedy — pełna historia artefaktu?" |
| **Typ treści** | Timeline log: ikona akcji + opis zmiany + user avatar + timestamp + opcjonalnie diff |
| **Źródło (auto-load)** | Tabela `history` / audit log dla `initiativeId` |
| **cSpan** | 2 |
| **Badge** | `history.length` gdy > 0 |
| **cHidden** | Gdy `history.length === 0` |
| **Kiedy wypełnione** | Gdy istnieje ≥ 1 wpis historii |
| **Pusty stan** | "Brak historii zmian." |
| **AI sekcji (✨)** | — (logi systemowe, nie AI) |

---

## Kolejność kanoniczna (eksport / raport)

1. Initiative Scope
2. Success Criteria
3. KPIs & Benefits
4. Timeline
5. Tasks
6. Team
7. Financial Analysis
8. Financial Impact
9. Risk & RAID
10. Decisions
11. Gates
12. Dependencies
13. RACI
14. Resources
15. Attachments & Links
16. Used in
17. Comments
18. Activity Log

> Kolejność eksportu jest niezmienna. Kolejność w sidebarze jest personalna i nie wpływa na eksport.

---

## Zasady Genesis (AI przy tworzeniu)

Sekcje oznaczone ★ są wypełniane w całości przez AI w momencie tworzenia inicjatywy:
`initiative-definition`, `timeline`, `target-state-scope`, `kpi`, `financial-analysis`, `financial-impact`, `team`

AI genesis używa:
- Tytułu inicjatywy + opisu podanego przez użytkownika
- Kontekstu projektu (branża, typ organizacji, faza)
- Szablonów specyficznych dla kategorii inicjatywy (IT / HR / Operations / Product / etc.)

Genesis nigdy nie blokuje — użytkownik może edytować każde pole natychmiast po wygenerowaniu.

---

## Reguły walidacji sekcji

- Sekcja ma `badge` tylko gdy zawiera dane z bazy (nie z AI genesis)
- `cHidden: true` = sekcja schowana w sidebarze do momentu pojawienia się danych
- Sekcja bez `cHidden` jest zawsze widoczna w sidebarze
- `cSpan: 2` = karta zajmuje 2 kolumny canvas (szeroka)
- `cSpan: 3` = karta zajmuje pełną szerokość canvas
- Brak `cSpan` = standardowa 1-kolumnowa karta
