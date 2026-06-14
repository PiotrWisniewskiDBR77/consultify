# Canon inicjatyw — Initiative Detail View

> **Przeznaczenie.** Ten dokument jest jedyną prawdziwą specyfikacją sekcji widoku szczegółów inicjatywy (`InitiativeDocumentView`). Każda nowa sekcja, każdy refactor i każde AI-wypełnienie MUSI tu zaczynać i kończyć.
>
> **Typy bloków treści** (jak renderuje się zawartość kart) → [BLOCK_TYPES_CANON.md](./BLOCK_TYPES_CANON.md)

---

## Anatomia artefaktu (4 warstwy)

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. IDENTITY                                                         │
│     Title · Status dot · Artifact ID (copy) · Saved · N/C toggle    │
├──────────────────────────────────────────────────────────────────────┤
│  2. PROPERTIES STRIP                                                 │
│     STATUS · PHASE · NEXT GATE · PRIORITY · OWNER · TARGET           │
├──────────────────────────────────────────────────────────────────────┤
│  3. TOOLBAR                                              [⚡ AI Consultant] │
│     [≡ Sections ▾]  [New]  [Export]  │  [⚡ AI Consultant ▾]        │
├────────────────────┬─────────────────────────────────────────────────┤
│  4. CONTENT        │                                                 │
│                    │  SectionCard stack dla aktywnej sekcji          │
│  Left nav (242px)  │  ┌───────────────────────────────────────────┐  │
│                    │  │ Section Title            [✓ Mark Complete] │  │
│  ✓ Section A ←     │  │ Description                               │  │
│  · Section B       │  │ ────────────────────────────────────────  │  │
│  · Section C       │  │ field text           [✨]                 │  │
│                    │  │ field text           [✨]                 │  │
│                    │  └───────────────────────────────────────────┘  │
│                    │  [+ Add item]                                   │
└────────────────────┴─────────────────────────────────────────────────┘
```

**Zasady anatomii:**
- Każde pole tekstowe ma po prawej subtelny przycisk ✨ (FieldAIButton) — zawsze.
- AI działa na 3 poziomach: pole (✨) → sekcja (AI Consultant w toolbarze) → artefakt (AI Consultant prawy panel).
- Kolejność sekcji w sidebarze jest **personalna** (drag & drop + localStorage). Kolejność eksportu jest **kanoniczna** (określona poniżej).
- **Genesis = pełne AI-wypełnienie** — wszystkie sekcje zaznaczone ★ są automatycznie wypełniane przez AI w momencie tworzenia inicjatywy.

---

## Warstwa 1 — Identity

Stały pasek na górze widoku. Zawsze widoczny, nie scrolluje.

| Element | Spec | Interakcja |
|---------|------|-----------|
| **Title** | `text-[20px] font-semibold text-slate-900 dark:text-slate-100` · max 120 znaków · placeholder "Bez tytułu" | Klik → inline edit. Blur → auto-save. |
| **Status dot** | `w-2.5 h-2.5 rounded-full` · kolor odpowiada polu STATUS w Properties Strip | Zmienia się automatycznie gdy STATUS się zmienia. Nie klikalny. |
| **Artifact ID** | Format: `INI-XXXX` (4 znaki alfanumeryczne) · `text-[11px] text-slate-400 font-mono` | Klik → kopiuje do schowka → inline "Skopiowano ✓" przez 1.5s. |
| **Saved** | `text-[11px] text-slate-400` | "Zapisuję..." gdy trwa zapis. "Zapisano ✓" przez 2s po auto-save. Idle = niewidoczny. |
| **N/C toggle** | `[N]` Normal (z lewą nawigacją) · `[C]` Canvas (pełna szerokość bez nav) | Przełącza widoczność lewej nawigacji. Stan w localStorage. |

---

## Warstwa 2 — Properties Strip

Dokładnie **6 pól** — niezmienne. Zmiany statusu odbywają się przez klik na dane pole w stripie, nie przez przyciski w toolbarze.

| Pole | Wartość | Semantyka kolorów |
|------|---------|-------------------|
| **STATUS** | Executing · Planning · On Hold · Blocked · Complete · Cancelled | Executing=niebieski · Planning=szary · On Hold=żółty · Blocked=czerwony · Complete=zielony · Cancelled=szary (wygaszony) |
| **PHASE** | Faza w metodologii (np. Discovery · Design · Execution · Closure) | Kolor wg aktywnej fazy projektu |
| **NEXT GATE** | Nazwa następnej bramy do przejścia | Pending=żółty · Passed=zielony · Overdue=czerwony |
| **PRIORITY** | Critical · High · Medium · Low | Critical=czerwony · High=pomarańczowy · Medium=żółty · Low=szary |
| **OWNER** | Osoba odpowiedzialna (dropdown z awatarem) | — |
| **TARGET** | Data docelowa zakończenia | Przyszłość=neutralny · ≤7 dni=żółty · Przeterminowany=czerwony |

---

## Warstwa 3 — Toolbar

> Pełna specyfikacja toolbara → [BLOCK_TYPES_CANON.md § Toolbar artefaktu](./BLOCK_TYPES_CANON.md)

### Układ

```
[≡ Sections ▾]  [New]  [Export ▾]    · aktywna sekcja ·    │    [⚡ AI ▾]    [⎊]  [▶]    [⚡ AI Consultant]
```

### Elementy (skrót — pełna spec w BLOCK_TYPES_CANON)

| Element | Typ | Kolor |
|---------|-----|-------|
| `≡ Sections ▾` | Ghost | `border-slate-200 text-slate-600` |
| `New` | Subtle fill | `bg-slate-100 text-slate-700` |
| `Export ▾` | Ghost | → Notatki · → Idee · → Prezentacja · → PDF |
| `· aktywna sekcja ·` | Label | `text-[12px] text-slate-400` centered |
| `│` | Separator | `w-px h-5 bg-slate-200 dark:bg-navy-700` |
| `⚡ AI Consultant ▾` | Split · teal | `bg-teal-50 border-teal-200 text-teal-700` |
| `⎊` | Icon ghost | Fork — nowy artefakt z tą samą strukturą + tag "Forked from" |
| `▶` | Icon ghost | Present — fullscreen, kolejność sidebarowa, reorder w trybie |
| `⚡ AI Consultant` | Solid teal | `bg-teal-600 text-white` — prawy panel ~360px |

### Zasady

- **Zero czerwonych** przycisków. Zero gradientów.
- Destruktywne akcje (usuń, archiwizuj, share) → kebab `⋯` na poziomie tabeli/listy.
- Zmiany statusu artefaktu → klik na pole STATUS w Properties Strip.
- Standard: `h-8 · text-[13px] font-medium · rounded-lg · gap-2`

---

## SectionCard — Mark Complete

Każda SectionCard ma własny status niezależny od statusu artefaktu.

| Stan | Znaczenie |
|------|-----------|
| **Open** (default) | AI może modyfikować tę sekcję podczas refreshów i genesis |
| **Complete** | Sekcja zatwierdzona przez człowieka — AI **nie nadpisuje** |

**Zachowanie Mark Complete:**
- Przycisk `[✓ Mark Complete]` w nagłówku każdej SectionCard (prawy róg).
- Po kliknięciu: karta zmienia kolor (subtelne zielone tło / border), w lewym nav pojawia się `✓` przy nazwie sekcji.
- Odwracalne: `[Reopen]` przywraca stan Open i odblokowuje AI.
- AI przy każdym refreshu i genesis sprawdza status karty przed modyfikacją — Complete = skip.

---

## Architektura AI (3 poziomy)

| Poziom | Element UI | Wyzwalacz | Co robi |
|--------|-----------|-----------|---------|
| **Pole** | `✨` FieldAIButton | Klik przy polu | Uzupełnia / przepisuje jedno pole tekstowe |
| **Sekcja** | `⚡ AI Consultant ▾` w toolbarze | Klik = chat; ▾ = menu | Chat osadzony w kontekście aktywnej sekcji; AI zagaja. Menu: Uzupełnij · Proponuj · Refresh · Kontynuuj |
| **Artefakt** | `⚡ AI Consultant` top-right | Klik → prawy panel | Chat z pełnym kontekstem artefaktu + menu: Uzupełnij puste · Health check · Synthesize · Refresh · Kontynuuj |

**Zasada "Kontynuuj":** AI pamięta ostatnią sesję pracy z tym artefaktem. `Kontynuuj` wraca do miejsca, gdzie skończyła — bez ponownego tłumaczenia kontekstu.

---

## Grupy nawigacyjne

| Grupa | Sekcje (21 kart) |
|-------|-----------------|
| **Scope & Plan** | Initiative Scope, Tasks, Timeline, Dependencies |
| **Decisions & Risk** | Decisions, Risk & RAID, Gates |
| **Goals** | Success Criteria, KPIs & Benefits |
| **Finance** | Financial Analysis, Financial Impact, Budget Tracker |
| **People** | Team, RACI, Stakeholder Map |
| **Records** | Resources, Lessons Learned, Attachments & Links, Used in, Comments, Activity Log |

---

## Szablon kontraktu karty

Każda karta musi mieć opisane wszystkie 10 pól. Karta bez kompletnego kontraktu nie może być implementowana.

| # | Pole | Opis |
|---|------|------|
| 1 | **Historia / pytanie** | Jedno zdanie: jakie pytanie ta karta odpowiada |
| 2 | **Bloki treści** | Lista nazwanych sub-bloków z typem UI każdego |
| 3 | **Źródło danych** | DB · AI genesis · powiązane encje · ręczne |
| 4 | **AI Genesis** | Co ★ AI wypełnia przy tworzeniu, z jakich inputów |
| 5 | **AI Consultant** | Co robi `⚡ AI Consultant ▾` dla tej karty |
| 6 | **Pusty stan** | Komunikat + CTA gdy karta nie ma danych |
| 7 | **Widoczność domyślna** | ✅ domyślnie widoczna / ❌ ukryta w `≡ Sections ▾` |
| 8 | **Mark Complete** | Kryterium akceptacji — co musi być prawdą |
| 9 | **Eksport** | Jak karta renderuje się w eksportowanym dokumencie |
| 10 | **Layout** | cSpan · Badge · cHidden |

---

## Sekcje — Kontrakty (21 kart)

### SCOPE & PLAN

---

#### `initiative-definition` — Initiative Scope / Zakres inicjatywy ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co dokładnie robimy i dlaczego teraz?" |
| **Bloki treści** | **Problem Statement** (prose, max 200 słów) · **Objective** (prose SMART, max 100 słów) · **Strategic Rationale** (prose — dlaczego teraz, link do strategii) · **Scope In** (lista itemów) · **Scope Out** (lista itemów — równie ważne) |
| **Źródło danych** | AI genesis z tytułu + opisu użytkownika + kontekst projektu |
| **AI Genesis** | ★ Wypełnia wszystkie 5 bloków. Styl: precyzyjny, business-ready, bez hedgingu. |
| **AI Consultant** | "Przepisz zakres — każde zdanie musi być konkretne i weryfikowalne. Scope Out musi zawierać ≥ 3 pozycje." Menu: Uzupełnij · Przepisz · Dodaj Scope Out · Kontynuuj |
| **Pusty stan** | "Opisz inicjatywę — AI uzupełni zakres na tej podstawie." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Wszystkie 5 bloków wypełnione · Scope In i Out mają ≥ 2 pozycje · zaakceptowane przez właściciela |
| **Eksport** | Rozdział 1 dokumentu. Pełna treść wszystkich bloków. Scope In/Out jako wypunktowane listy. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `tasks` — Tasks / Zadania

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co trzeba zrobić krok po kroku, kto to robi i kiedy?" |
| **Bloki treści** | **Task list** — każde zadanie: checkbox + tytuł + assignee (avatar) + due date + status (Open / In Progress / Done / Blocked) + priorytet (High/Med/Low) + opcjonalny opis |
| **Źródło danych** | Tabela `tasks` filtrowana po `initiativeId` |
| **AI Genesis** | ★ Generuje 5–10 zadań z podziałem na etapy. Sugeruje assignee z listy Team, daty zgodne z Timeline. |
| **AI Consultant** | "Wygeneruj task breakdown. Każde zadanie: konkretny deliverable, nie aktywność. Sugeruj assignee." Menu: Wygeneruj breakdown · Dodaj etap · Sprawdź luki · Kontynuuj |
| **Pusty stan** | "Brak zadań. Kliknij '+ New' lub poproś AI o wygenerowanie breakdown." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Wszystkie taski mają status Done lub Cancelled. Zero tasków Open/In Progress. |
| **Eksport** | Lista zadań pogrupowana po statusie. W executive summary: % ukończenia. |
| **Layout** | cSpan: 2 · Badge: liczba tasków · cHidden: gdy 0 |

---

#### `timeline` — Timeline / Harmonogram ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Kiedy co się wydarzy — kamienie milowe i krytyczne daty?" |
| **Bloki treści** | **Milestones** — lista: nazwa + data + owner + status (Upcoming / In Progress / Achieved / Missed) + opis · **Phases** (opcjonalnie) — faza + start + end + kolor · Widok Gantt renderuje się z tych danych automatycznie |
| **Źródło danych** | `initiative.startDate` / `endDate` + tabela milestones; AI genesis uzupełnia fazy |
| **AI Genesis** | ★ Proponuje fazowanie i milestones bazując na zakresie, TARGET date i priorytecie. Dodaje realistyczne bufory. |
| **AI Consultant** | "Sprawdź czy daty są realistyczne wobec zasobów i zależności. Zaznacz ścieżkę krytyczną." Menu: Wygeneruj harmonogram · Dodaj milestone · Sprawdź konflikty · Kontynuuj |
| **Pusty stan** | "Ustaw daty START i TARGET w Properties Strip — AI wygeneruje harmonogram." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Wszystkie milestones mają status Achieved lub Cancelled z uzasadnieniem. |
| **Eksport** | Tabela milestones (nazwa · data · status · owner). Opcjonalnie Gantt jako obraz. |
| **Layout** | cSpan: 3 · Badge: — · cHidden: nigdy |

---

#### `dependencies` — Dependencies / Zależności

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co nas blokuje lub na czym polegamy, żeby iść do przodu?" |
| **Bloki treści** | **Blockers** — lista: co blokuje + źródło (inicjatywa/system/decyzja) + status (Active/Resolved) + owner + data · **Depends on** — lista: na czym polegamy + link do artefaktu + wpływ jeśli nie spełnione · **Enables** — lista: co ta inicjatywa odblokowuje dla innych |
| **Źródło danych** | Tabela `initiative_dependencies` + backlinki z innych inicjatyw |
| **AI Genesis** | Nie wypełnia — zależności wymagają wiedzy o ekosystemie projektu. |
| **AI Consultant** | "Zidentyfikuj typowe zależności dla tego typu inicjatywy. Sprawdź inne inicjatywy w projekcie." Menu: Sugeruj zależności · Sprawdź blockers · Kontynuuj |
| **Pusty stan** | "Brak zidentyfikowanych zależności. To rzadkie — sprawdź czy inicjatywa naprawdę nic nie blokuje." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Wszystkie Active blockers mają plan rozwiązania lub są Resolved. Sekcja Enables wypełniona. |
| **Eksport** | Trzy listy (Blockers / Depends on / Enables). Aktywne blokery wyróżnione. |
| **Layout** | cSpan: 2 · Badge: liczba Active blockers · cHidden: gdy 0 |

---

### DECISIONS & RISK

---

#### `decisions` — Decisions / Decyzje

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie kluczowe decyzje zostały podjęte, czekają na podjęcie lub zostały odroczone?" |
| **Bloki treści** | **Open Decisions** — lista: treść + deadline + owner + opcje do rozważenia + wpływ jeśli nie podjęta · **Made Decisions** — lista: treść + data + owner + uzasadnienie + alternatywy które odrzucono · **Deferred Decisions** — lista: treść + powód odroczenia + data ponownego rozważenia |
| **Źródło danych** | Tabela `decisions` filtrowana po `initiativeId` |
| **AI Genesis** | Nie wypełnia — decyzje są specyficzne dla kontekstu. |
| **AI Consultant** | "Zaproponuj kluczowe decyzje do podjęcia. Dla każdej: deadline, decydent, opcje." Menu: Zaproponuj decyzje · Uzupełnij uzasadnienie · Kontynuuj |
| **Pusty stan** | "Brak zarejestrowanych decyzji. Każda istotna decyzja powinna być tu udokumentowana." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Zero decyzji Open po terminie. Wszystkie Made Decisions mają uzasadnienie. |
| **Eksport** | Trzy sekcje (Open/Made/Deferred). Open decisions wyróżnione jako "do działania". |
| **Layout** | cSpan: 2 · Badge: liczba Open decisions · cHidden: gdy 0 |

---

#### `risk-raid` — Risk & RAID / Ryzyko i RAID ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co może pójść nie tak? — Risks, Assumptions, Issues, Dependencies" |
| **Bloki treści** | **Risks** — lista: opis + prawdopodobieństwo (H/M/L) + wpływ (H/M/L) + kategoria + mitygacja + owner · **Assumptions** — lista: założenie + ryzyko jeśli fałszywe + jak zweryfikować + status (Unverified/Confirmed/False) · **Issues** — lista: opis + dotkliwość + owner + plan rozwiązania + termin |
| **Źródło danych** | Tabela `raid_items` filtrowana po kategorii |
| **AI Genesis** | ★ Generuje wstępny RAID log: 3–5 ryzyk, 3–5 założeń, typowe issues dla tego typu projektu. |
| **AI Consultant** | "Wygeneruj kompletny RAID. Dla każdego ryzyka: macierz P×I, konkretna mitygacja z właścicielem." Menu: Wygeneruj RAID · Zaktualizuj · Sprawdź luki · Kontynuuj |
| **Pusty stan** | "Inicjatywa bez zidentyfikowanych ryzyk to inicjatywa z nieidentyfikowanymi ryzykami." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Wszystkie ryzyka mają mitygację i ownera. Zero Unverified assumptions bez planu weryfikacji. Zero Issues bez planu rozwiązania. |
| **Eksport** | Trzy tabele (R/A/I). Heatmapa ryzyk opcjonalnie jako obraz. |
| **Layout** | cSpan: 2 · Badge: liczba High-impact ryzyk + aktywnych Issues · cHidden: gdy 0 |

---

#### `gates` — Gates / Bramy

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie formalne punkty kontrolne są wymagane przed przejściem do kolejnej fazy?" |
| **Bloki treści** | **Gate list** — lista: nazwa bramy + faza której dotyczy + kryteria przejścia (checkboxy) + approver + status (Upcoming/In Review/Passed/Failed/Waived) + data · **Gate history** — log zatwierdzeń: kto, kiedy, z jakimi uwagami |
| **Źródło danych** | Tabela `gates` powiązana z milestones w Timeline |
| **AI Genesis** | Nie wypełnia — bramy zależą od metodologii projektu. |
| **AI Consultant** | "Zaproponuj bramy i kryteria wejścia/wyjścia adekwatne do faz. Każda brama: co musi być prawdą, kto zatwierdza." Menu: Zaproponuj bramy · Dodaj kryterium · Kontynuuj |
| **Pusty stan** | "Brak bram. Dla formalnych inicjatyw bramy zapewniają kontrolę jakości na każdym etapie." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | Wszystkie bramy mają status Passed lub Waived z uzasadnieniem. |
| **Eksport** | Tabela bram z kryteriami i statusami. Historia zatwierdzeń. |
| **Layout** | cSpan: 1 · Badge: liczba Upcoming/In Review · cHidden: nigdy |

---

### GOALS

---

#### `target-state-scope` — Success Criteria / Kryteria sukcesu ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Skąd będziemy wiedzieć że nam się udało — konkretne, weryfikowalne kryteria?" |
| **Bloki treści** | **Target State** — lista: opis stanu docelowego (co będzie prawdą gdy inicjatywa się zakończy) · **Success Criteria** — lista: mierzalne warunki sukcesu (SMART: co, ile, kiedy) · **Deliverables** — lista: konkretne produkty/wyniki do dostarczenia |
| **Źródło danych** | AI genesis z Objective w Initiative Scope |
| **AI Genesis** | ★ Wypełnia wszystkie 3 bloki. Target State: 3–5 itemów. Criteria: 3–5 SMART. Deliverables: konkretne artefakty. |
| **AI Consultant** | "Przepisz kryteria jako SMART. Każde: co mierzymy + jak + wartość docelowa + termin. Deliverables: artefakty, nie aktywności." Menu: Przepisz SMART · Wygeneruj Deliverables · Kontynuuj |
| **Pusty stan** | "Bez kryteriów sukcesu inicjatywa nigdy się nie kończy." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Wszystkie 3 bloki wypełnione. Każde kryterium weryfikowalne. Deliverables zatwierdzone przez stakeholderów. |
| **Eksport** | Trzy sekcje z wypunktowanymi listami. Kluczowe deliverables w executive summary. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `kpi` — KPIs & Benefits / KPI i korzyści ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie liczby mierzymy i jakich wymiernych korzyści oczekujemy?" |
| **Bloki treści** | **KPIs** — lista: nazwa metryki + definicja + baseline (obecna wartość) + target + jednostka + częstotliwość pomiaru + owner · **Benefits** — lista: opis korzyści + kategoria (finansowa/operacyjna/strategiczna/HR) + wartość (ilościowa lub jakościowa) + termin realizacji + owner · **Measurement Plan** — prose: jak i kiedy mierzymy po zakończeniu |
| **Źródło danych** | AI genesis z Success Criteria + kontekst biznesowy projektu |
| **AI Genesis** | ★ Wypełnia KPIs i Benefits. Dla każdego KPI szacuje baseline jeśli nie podany. Benefits kategoryzuje i kwantyfikuje. |
| **AI Consultant** | "KPIs muszą być faktycznie mierzalne. Każde: wzór pomiaru + źródło danych + owner. Benefits: każda musi mieć właściciela który ją zrealizuje." Menu: Zaproponuj KPIs · Skwantyfikuj korzyści · Kontynuuj |
| **Pusty stan** | "Bez KPIs nie możesz udowodnić że inicjatywa przyniosła wartość." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Każde KPI ma baseline + target + właściciela. Measurement Plan opisuje działania po zakończeniu inicjatywy. |
| **Eksport** | Tabela KPIs z baseline/target. Tabela benefits z kategorią i wartością. Measurement Plan jako prose. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: nigdy |

---

### FINANCE

---

#### `financial-analysis` — Financial Analysis / Analiza finansowa ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Ile to kosztuje i jak uzasadniamy tę inwestycję finansowo?" |
| **Bloki treści** | **Cost Breakdown** — tabela: kategoria (CAPEX/OPEX) + opis + szacunek (min–max) + rzeczywisty koszt + odchylenie · **Cost Assumptions** — lista: założenie kosztowe + wpływ na szacunek · **Business Case Summary** — prose: uzasadnienie finansowe inwestycji (max 150 słów) |
| **Źródło danych** | AI genesis + aktualizacje ręczne w trakcie realizacji |
| **AI Genesis** | ★ Wypełnia Cost Breakdown z szacunkami (min–max) i Business Case Summary. Oznacza szacunki jako przybliżone z przedziałem ufności. |
| **AI Consultant** | "Sprawdź podział CAPEX/OPEX. Podaj przedział ufności. Zaznacz największą zmienną kosztową." Menu: Uzupełnij koszty · Wygeneruj Business Case · Kontynuuj |
| **Pusty stan** | "Brak analizy kosztów. Bez niej nie uzyskasz zatwierdzenia budżetu." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Cost Breakdown ma rzeczywiste koszty (nie tylko szacunki). Business Case zatwierdzony przez sponsora finansowego. |
| **Eksport** | Tabela kosztów z planem/rzeczywistym/odchyleniem. Business Case jako osobny akapit. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: nigdy |

---

#### `financial-impact` — Financial Impact / Wpływ finansowy ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jaki jest oczekiwany zwrot z inwestycji i kiedy?" |
| **Bloki treści** | **ROI Summary** — karty statystyk: ROI (%) · NPV · Payback Period · Break-even Date · **Scenarios** — tabela 3 scenariuszy (Pesymistyczny/Bazowy/Optymistyczny) × kluczowe założenia + wynikowy ROI · **Value Timeline** — prose/tabela: kiedy jakie korzyści zaczną się materializować |
| **Źródło danych** | AI genesis bazując na Financial Analysis (koszty) + KPIs & Benefits (korzyści) |
| **AI Genesis** | ★ Modeluje 3 scenariusze. Oblicza ROI/NPV/payback dla każdego. |
| **AI Consultant** | "Pokaż które założenie ma największy wpływ na ROI (sensitivity). Value Timeline: konkretne daty gdy korzyści będą widoczne." Menu: Modeluj scenariusze · Sensitivity analysis · Kontynuuj |
| **Pusty stan** | "Uzupełnij najpierw Financial Analysis i KPIs — Financial Impact korzysta z tych danych." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Wszystkie 3 scenariusze wypełnione. ROI Summary zaakceptowane przez CFO/sponsora. |
| **Eksport** | Karty statystyk ROI/NPV/Payback. Tabela scenariuszy. Value Timeline jako prose. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: nigdy |

---

#### `budget-tracker` — Budget Tracker / Śledzenie budżetu

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jak rzeczywiste wydatki mają się do planu — gdzie jesteśmy na osi budżetu?" |
| **Bloki treści** | **Budget vs Actuals** — tabela: kategoria + budżet zatwierdzony + wydane do tej pory + pozostało + % utilizacji + prognoza do końca · **Budget Alerts** — automatyczna lista: przekroczenia + zbliżające się limity + anomalie · **Spend Log** — log wydatków: data + kategoria + kwota + opis + zatwierdzone przez |
| **Źródło danych** | Ręczne wpisy + opcjonalna integracja z systemem finansowym; plan z Financial Analysis |
| **AI Genesis** | Nie wypełnia — rzeczywiste koszty muszą pochodzić od ludzi. Tworzy strukturę kategorii z Financial Analysis. |
| **AI Consultant** | "Przeanalizuj trend wydatków. Prognozuj końcowy koszt na podstawie burn rate. Wskaż kategorie z ryzykiem przekroczenia." Menu: Prognozuj · Analiza burn rate · Kontynuuj |
| **Pusty stan** | "Brak wpisów budżetowych. Dodaj pierwsze wydatki lub skonfiguruj integrację." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | Wszystkie wydatki zaksięgowane. Final actuals zatwierdzone przez sponsora finansowego. |
| **Eksport** | Tabela budget vs actuals z odchyleniami. Spend log jako załącznik. |
| **Layout** | cSpan: 2 · Badge: ikona alertu gdy przekroczenie > 10% · cHidden: nigdy |

---

### PEOPLE

---

#### `team` — Team / Zespół ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Kto jest zaangażowany, w jakich rolach i z jakim zaangażowaniem czasowym?" |
| **Bloki treści** | **Core Team** — karty: avatar + imię + rola + alokacja (%) + kontakt + status (Active/Inactive) · **Extended Team** — karty: osoby zaangażowane sporadycznie (niższy priorytet wizualny) · **Roles Needed** — lista: brakująca rola + opis + pilność |
| **Źródło danych** | `initiative.team` / `stakeholders`; AI genesis sugeruje skład |
| **AI Genesis** | ★ Sugeruje Core Team z rolami (PM, Tech Lead, BA, etc.) bazując na zakresie i typie inicjatywy. |
| **AI Consultant** | "Oceń kompletność zespołu wobec zakresu. Zidentyfikuj braki kompetencji i ryzyka przeciążenia." Menu: Zaproponuj skład · Sprawdź luki · Kontynuuj |
| **Pusty stan** | "Bez zdefiniowanego zespołu inicjatywa nie ma właściciela wykonania." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Core Team wypełniony. Żadnych Roles Needed bez planu obsadzenia. |
| **Eksport** | Tabela zespołu z rolami i alokacją. Roles Needed jako osobna lista. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `raci` — RACI / RACI

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Kto jest Responsible, Accountable, Consulted i Informed dla każdej kluczowej aktywności?" |
| **Bloki treści** | **RACI Matrix** — tabela: wiersze = aktywności/deliverables, kolumny = role/osoby, komórki = R/A/C/I · **RACI Rules** — auto-walidacja: każda aktywność ma dokładnie 1 A, ≥ 1 R; alert gdy naruszenie |
| **Źródło danych** | Budowana z Team + Tasks; generowana przez AI Consultant |
| **AI Genesis** | Nie wypełnia przy genesis — wymaga najpierw Team i Tasks. |
| **AI Consultant** | "Wygeneruj macierz RACI z zadań i zespołu. Sprawdź: każda aktywność ma dokładnie 1 A. Zaznacz przeciążenia." Menu: Wygeneruj RACI · Sprawdź reguły · Kontynuuj |
| **Pusty stan** | "Uzupełnij najpierw Team i Tasks — RACI buduje się z tych danych." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | Macierz wypełniona dla wszystkich kluczowych aktywności. Żadna aktywność bez A. Zatwierdzona przez właściciela. |
| **Eksport** | Tabela RACI. Eksportowana jako osobna strona gdy duża. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: gdy stakeholders = 0 |

---

#### `stakeholder-map` — Stakeholder Map / Mapa interesariuszy

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Kto ma wpływ na tę inicjatywę lub jest przez nią dotknięty — i jak zarządzać tymi relacjami?" |
| **Bloki treści** | **Stakeholder List** — karty: imię/rola + organizacja + wpływ (H/M/L) + zainteresowanie (H/M/L) + postawa (Champion/Supporter/Neutral/Skeptic/Blocker) · **Engagement Plan** — lista: stakeholder + forma komunikacji + częstotliwość + key messages · **Influence Map** — 2×2 macierz Wpływ × Zainteresowanie z ikonami osób |
| **Źródło danych** | Ręczne + AI sugestie |
| **AI Genesis** | Nie wypełnia — stakeholderzy są specyficzni dla organizacji. |
| **AI Consultant** | "Zidentyfikuj kluczowych stakeholderów. Dla Skeptics i Blockers: konkretne działania żeby zmienić postawę lub zarządzać ryzykiem." Menu: Zaproponuj stakeholderów · Wygeneruj Engagement Plan · Kontynuuj |
| **Pusty stan** | "Brak mapy interesariuszy. Każda inicjatywa ma stakeholderów — nawet jeśli nie są oczywisti." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | Wszyscy kluczowi stakeholderzy zidentyfikowani. Engagement Plan wypełniony dla High Influence osób. |
| **Eksport** | Lista stakeholderów z postawami. Engagement Plan jako tabela. Influence Map jako obraz. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: nigdy |

---

### RECORDS

---

#### `resources` — Resources / Zasoby

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie zasoby są potrzebne do realizacji i jaki jest ich status dostępności?" |
| **Bloki treści** | **Human Resources** — lista: rola + FTE/alokacja + status (Available/Partial/Missing) + koszt · **Tools & Systems** — lista: narzędzie + licencje + status + koszt · **Infrastructure** — lista: zasoby infra + status + koszt · **Budget Line** — pole: całkowity budżet zasobów vs. zatwierdzony |
| **Źródło danych** | Ręczne + AI sugestie z zakresu |
| **AI Genesis** | Sugeruje typowe zasoby dla tego typu inicjatywy jako punkt startowy. |
| **AI Consultant** | "Oceń kompletność zasobów wobec zakresu i harmonogramu. Wskaż Missing i ich wpływ na timeline." Menu: Zaproponuj zasoby · Sprawdź braki · Kontynuuj |
| **Pusty stan** | "Brak zdefiniowanych zasobów." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | Wszystkie zasoby mają status. Żadnych Missing bez planu pozyskania. |
| **Eksport** | Tabela zasobów pogrupowana po typie z kosztami. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `lessons-learned` — Lessons Learned / Wnioski końcowe

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co zadziałało, co nie zadziałało i co zrobimy inaczej następnym razem?" |
| **Bloki treści** | **What Worked** — lista: opis + kategoria (Process/People/Technology/Planning) + rekomendacja na przyszłość · **What Didn't Work** — lista: opis + root cause + jak uniknąć · **Key Decisions Review** — lista: decyzja (link) + ocena (Good/Mixed/Wrong) + co byśmy zmienili · **Recommendations** — lista: konkretne rekomendacje dla podobnych przyszłych inicjatyw |
| **Źródło danych** | Ręczne (przy zamykaniu inicjatywy) + AI synteza z historii aktywności |
| **AI Genesis** | Nie wypełnia — wymaga refleksji ludzkiej. Karta aktywna gdy STATUS = Complete/Cancelled. |
| **AI Consultant** | "Na podstawie historii aktywności i decyzji zaproponuj draft Lessons Learned. Znajdź powtarzające się wzorce problemów." Menu: Wygeneruj draft · Uzupełnij · Kontynuuj |
| **Pusty stan** | "Lessons Learned wypełnia się przy zamykaniu inicjatywy. To najważniejsza inwestycja w przyszłe projekty." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie (pojawia się gdy STATUS → Complete/Cancelled) |
| **Mark Complete** | Wszystkie 4 bloki mają ≥ 3 wpisy. Recommendations zatwierdzone przez właściciela. |
| **Eksport** | Osobny rozdział dokumentu końcowego. Recommendations jako executive summary. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: gdy STATUS ≠ Complete/Cancelled |

---

#### `attachments-links` — Attachments & Links / Załączniki i powiązania

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie dokumenty, pliki i linki zewnętrzne są powiązane z tą inicjatywą?" |
| **Bloki treści** | **Files** — grid: plik + typ (PDF/DOCX/XLSX/IMG) + rozmiar + data + uploader + [Pobierz] · **Links** — lista: tytuł + URL + opis (1 zdanie) + data dodania |
| **Źródło danych** | `attachments` + `linkedItems` |
| **AI Genesis** | Nie wypełnia. |
| **AI Consultant** | — (sekcja czysto manualna) |
| **Pusty stan** | "Brak załączników. Przeciągnij pliki lub wklej linki." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Nie dotyczy — sekcja zawsze "w trakcie". |
| **Eksport** | Lista plików z linkami. Lista URLi z opisami. |
| **Layout** | cSpan: 1 · Badge: liczba plików + linków · cHidden: gdy oba = 0 |

---

#### `used-in` — Used in / Użyte w (backlinks)

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "W jakich innych artefaktach ta inicjatywa jest cytowana lub powiązana?" |
| **Bloki treści** | **Backlinks** — lista automatyczna: ikona typu artefaktu + tytuł + autor + data modyfikacji + kontekst powiązania |
| **Źródło danych** | Graph query — odwrotne linki do `initiativeId` |
| **AI Genesis** | Nie dotyczy — dane systemowe. |
| **AI Consultant** | — |
| **Pusty stan** | "Ta inicjatywa nie jest jeszcze cytowana w innych dokumentach." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Nie dotyczy. |
| **Eksport** | Lista powiązań. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `comments` — Comments / Komentarze

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co zespół dyskutuje na bieżąco w kontekście tej inicjatywy?" |
| **Bloki treści** | **Thread** — wątkowe komentarze: avatar + imię + treść (rich text) + timestamp + reakcje emoji + reply (max 1 poziom zagnieżdżenia) + opcja "Mark as Action Item" |
| **Źródło danych** | Tabela `comments` filtrowana po `initiativeId` |
| **AI Genesis** | Nie dotyczy. |
| **AI Consultant** | — (komentarze to głos ludzki) |
| **Pusty stan** | "Brak komentarzy. Zacznij dyskusję." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Nie dotyczy. |
| **Eksport** | Lista komentarzy z datami i autorami (opcjonalna przy eksporcie). |
| **Layout** | cSpan: 1 · Badge: liczba komentarzy · cHidden: gdy 0 |

---

#### `activity-log` — Activity Log / Dziennik aktywności

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co się zmieniło w tej inicjatywie, kto to zmienił i kiedy?" |
| **Bloki treści** | **Log** — chronologiczna lista: ikona akcji + opis zmiany (np. "Status: Planning → Executing") + avatar + timestamp + opcjonalny diff (pokaż/ukryj) |
| **Źródło danych** | Tabela `history` / audit log dla `initiativeId` |
| **AI Genesis** | Nie dotyczy — dane systemowe. |
| **AI Consultant** | — |
| **Pusty stan** | "Brak historii zmian." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | Nie dotyczy. |
| **Eksport** | Skrócony log (ostatnie 20 zmian) opcjonalnie jako appendix. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: gdy 0 |

---

## Kolejność kanoniczna (eksport / raport)

1. Initiative Scope
2. Success Criteria
3. KPIs & Benefits
4. Timeline
5. Tasks
6. Team
7. Stakeholder Map
8. Financial Analysis
9. Financial Impact
10. Budget Tracker
11. Risk & RAID
12. Decisions
13. Gates
14. Dependencies
15. RACI
16. Resources
17. Lessons Learned
18. Attachments & Links
19. Used in
20. Comments
21. Activity Log

> Kolejność eksportu jest niezmienna. Kolejność w sidebarze jest personalna i nie wpływa na eksport.

---

## Zasady Genesis (AI przy tworzeniu)

Sekcje oznaczone ★ wypełniane przez AI w momencie tworzenia inicjatywy:
`initiative-definition` · `timeline` · `target-state-scope` · `kpi` · `financial-analysis` · `financial-impact` · `risk-raid` · `team`

AI genesis używa:
- Tytułu inicjatywy + opisu podanego przez użytkownika
- Kontekstu projektu (branża, typ organizacji, faza)
- Szablonów specyficznych dla kategorii inicjatywy (IT / HR / Operations / Product / etc.)

Genesis nigdy nie blokuje — użytkownik może edytować każde pole natychmiast po wygenerowaniu.

---

## Reguły layoutu sekcji

- `cSpan: 1` = standardowa karta (1 kolumna)
- `cSpan: 2` = szeroka karta (2 kolumny)
- `cSpan: 3` = pełna szerokość canvas
- `cHidden: true` = karta schowana w sidebarze do pojawienia się danych lub spełnienia warunku
- Badge pokazuje tylko dane z bazy (nie z AI genesis)

---

## Checkpointy walidacji — InitiativeDocumentView

> **Cel:** Lista kontrolna do weryfikowania poprawności BUILD-u widoku inicjatyw.
> Uzupełnia master checklist z [BLOCK_TYPES_CANON.md § Checkpointy walidacji implementacji](./BLOCK_TYPES_CANON.md).
>
> **Kolejność weryfikacji:** Master (Bloki A–F) → Poniższe bloki (IN-1 do IN-4).
> Oba muszą przejść przed mergem.

---

### IN-1 — Kompletność widoku: 21 kart w 6 grupach

```
□ GRUPA 1 — SCOPE & PLAN (5 kart):
     □ initiative-definition    genesis ★
     □ timeline                 genesis ★
     □ target-state-scope       genesis ★
     □ deliverables-milestones  cSpan 2
     □ dependencies             (non-genesis)

□ GRUPA 2 — DECISIONS & RISK (4 karty):
     □ decision-log             cSpan 1, badge: decisions count
     □ risk-raid                cSpan 2, genesis ★ (RAID table)
     □ change-log               badge: changes count
     □ lessons-learned          (non-genesis)

□ GRUPA 3 — GOALS (3 karty):
     □ kpi                      genesis ★, MetricCard array
     □ okr                      (non-genesis), MetricCard array
     □ hypothesis                (non-genesis)

□ GRUPA 4 — FINANCE (2 karty):
     □ financial-analysis       genesis ★, DataTable
     □ financial-impact         genesis ★, MetricCard + DataTable

□ GRUPA 5 — PEOPLE (3 karty):
     □ team                     genesis ★, DataTable / LabeledCardGrid
     □ stakeholders             DataTable
     □ workstream-owners        LabeledCardGrid

□ GRUPA 6 — RECORDS (4 karty):
     □ documents-resources      FileAttachment list
     □ related-initiatives      SourcePack (links)
     □ comments                 cHidden: gdy 0, badge: count, CommentThread
     □ activity-log             cHidden: gdy 0, Timeline

□ ŁĄCZNA LICZBA: 21 kart (nie 20, nie 22)
```

---

### IN-2 — Właściwości specyficzne dla inicjatyw

**Kontrakt 10-polowy (bez Wymogu dowodu)**

```
□ Każda karta ma 10 pól (nie 11 — Wymóg dowodu nie dotyczy inicjatyw)
□ Brak BlockQuote jako wymogu — cytaty opcjonalne (nie kontraktowe)
□ DataTable jest głównym blokiem danych (nie RichText) w finance i team
```

**AI Genesis — 8 sekcji oznaczonych ★**

```
□ Sekcje genesis: initiative-definition · timeline · target-state-scope ·
  financial-analysis · financial-impact · risk-raid · team · kpi
□ Genesis trigger: tworzenie inicjatywy (NIE nowa sesja — inicjatywy nie mają sesji)
□ Genesis używa: tytuł + opis + kategoria inicjatywy (IT/HR/Ops/Product)
□ Genesis spinner/skeleton podczas wypełniania (nie pusty ekran)
□ Genesis nie blokuje edycji — pola edytowalne natychmiast
□ AI pomija sekcje z completed=true przy kolejnych run
```

**Properties Strip — pola specyficzne dla inicjatyw**

```
□ STATUS:     Draft (slate) / Planning (blue) / Active (green) / On Hold (amber)
              / Done (success) / Cancelled (red)
□ PHASE:      Discovery / Design / Build / Launch / Stabilize / Closed
□ NEXT GATE:  data następnego gate review (date picker)
□ PRIORITY:   P1 (red) / P2 (amber) / P3 (green) / P4 (slate)
□ OWNER:      avatar + imię (nie ID)
□ TARGET:     data docelowa ukończenia (date picker)
```

**RAID (risk-raid) — specyfika tabeli**

```
□ RAID = Risks · Assumptions · Issues · Dependencies (4 typy wierszy)
□ Każdy wiersz: Type · Title · Impact (H/M/L) · Owner · Status · Due Date
□ Impact: High = red badge, Medium = amber, Low = green
□ Status: Open / In Progress / Closed / Accepted
□ Lazy ALTER: raid_items tabela lub JSONB w initiatives.raid_data
□ Eksport: pełna tabela RAID (nie summary)
```

---

### IN-3 — Eksport inicjatyw: kolejność kanoniczna

> Kolejność eksportu jest stała. Drag w sidebarze NIE zmienia kolejności eksportu.

```
□ 1.  Initiative Definition
□ 2.  Timeline
□ 3.  Target State & Scope
□ 4.  Deliverables & Milestones
□ 5.  Dependencies
□ 6.  Decision Log
□ 7.  Risk & RAID
□ 8.  Change Log
□ 9.  Lessons Learned
□ 10. KPI
□ 11. OKR
□ 12. Hypothesis
□ 13. Financial Analysis
□ 14. Financial Impact
□ 15. Team
□ 16. Stakeholders
□ 17. Workstream Owners
□ 18. Documents & Resources
□ 19. Related Initiatives
□ 20. Comments           ← pomijany w eksporcie
□ 21. Activity Log       ← pomijany w eksporcie

□ Eksport PDF/Prezentacja: sekcje 1–19 (bez records audit)
□ "Project Brief" = sekcje 1–5 (scope + plan)
□ "Status Report" = sekcje 1, 6, 7, 10, 14 (definition + risks + KPIs + finance)
```

---

### IN-4 — Stany specjalne inicjatyw

**Inicjatywa w fazie Draft (nowa)**

```
□ initiative-definition: po genesis wypełniona z nazwy + opisu
□ timeline: po genesis zawiera przynajmniej 3 kamienie milowe (placeholder)
□ kpi: po genesis zawiera ≥ 2 metryki (placeholder z wartościami TBD)
□ deliverables-milestones: empty state z CTA "Dodaj milestone"
□ dependencies: empty state z CTA "Dodaj zależność"
□ risk-raid: po genesis ≥ 2 ryzyka z Impact=High lub Medium
□ financial-analysis: po genesis tabela kosztów z kategoriami
□ team: po genesis zawiera Owner jako pierwszy wiersz
```

**Inicjatywa Active / Done**

```
□ decision-log badge: aktualna liczba decyzji (live)
□ change-log badge: aktualna liczba zmian (live)
□ comments badge: aktualna liczba komentarzy (live)
□ activity-log: pojawia się automatycznie gdy ≥ 1 aktywność
```

**Mark Complete flow (InitiativeDocumentView-specific)**

```
□ Mark Complete button: widoczny w NModeSectionWrapper per sekcja
□ Kliknięcie → optimistic UI (border-success pojawia się natychmiast)
□ API call: PATCH /initiatives/:id z { sectionCompletions: { "section-id": true } }
□ lazy ALTER działa: section_completions kolumna tworzona w initiatives jeśli nie istnieje
□ Odczyt przy otwarciu: section_completions parsowany, completed prop przekazany
□ ✓ badge w NModeLeftNav pojawia się natychmiast po mark complete
□ Pasek postępu aktualizuje się natychmiast
□ Pola sekcji POZOSTAJĄ edytowalne (nie disabled po mark complete)
□ AI Consultant level 3: "Health check" — analizuje completed vs open sekcje
     i wskazuje luki w dokumentacji inicjatywy
```

---

## §Archiwizacja (cykl życia rekordu)

> Wzorzec odziedziczony z TABLE_AND_PREVIEW_CANON §14. Pilot: Insights (wdrożony). Inicjatywy: do wdrożenia.

### Reguły

| Element | Specyfikacja |
|---|---|
| **Trigger archiwizacji** | Kebab → Archiwizuj (strefa FIXED BOTTOM). Potwierdzenie: toast z "Cofnij" (5s). |
| **Trigger przywracania** | Kebab → Przywróć (gdy scope=archived). |
| **Scope chip (Menu 3)** | Trzy wartości: `Active` (domyślny) · `Archived` · `All`. Chip widoczny zawsze gdy tabela obsługuje archiwizację. |
| **Filtr SQL** | `WHERE archived_at IS NULL` (active) · `IS NOT NULL` (archived) · brak filtru (all). |
| **Backend** | `PATCH /initiatives/:id { archived: true/false }` → serwer ustawia `archived_at = NOW()` / `NULL` + `archived_by`. |
| **DB schema** | `archived_at TIMESTAMPTZ` + `archived_by TEXT` — lazy ALTER jeśli kolumny nie istnieją (wzorzec DatabaseInitializer). |
| **Preview pane** | Zarchiwizowana inicjatywa: baner `Archived — [data]` w nagłówku preview (kolor: `bg-slate-100 dark:bg-navy-800`). Akcje edycji disabled. |
| **Full view** | Zarchiwizowana inicjatywa otwiera się w trybie read-only. NModeToolbar: przycisk "Przywróć" zamiast normalnych akcji. |

### Checklist wdrożenia

```
□ Kebab: Archiwizuj / Przywróć (toggle, FIXED BOTTOM slot 3)
□ Scope chip w Menu 3 z 3 wartościami (Active / Archived / All)
□ API: PATCH /initiatives/:id obsługuje archived: true/false
□ lazy ALTER: archived_at TIMESTAMPTZ, archived_by TEXT
□ SQL: filtr archived_at IS NULL / IS NOT NULL / brak wg scope
□ Preview header: baner "Archived" gdy archived_at != null
□ Full view: read-only guard + "Przywróć" CTA gdy archived
□ NModeLeftNav: zarchiwizowane sekcje nie dostępne przez J/K (skip)
□ Liczniki (Menu 3 badges): odzwierciedlają tylko active scope domyślnie
```
