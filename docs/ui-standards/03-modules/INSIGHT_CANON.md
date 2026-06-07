# Canon insightów — Insight Detail View

> **Przeznaczenie.** Ten dokument jest jedyną prawdziwą specyfikacją sekcji widoku szczegółów insightu (`InsightViewer`). Każda nowa sekcja, każde AI-wypełnienie i każdy refactor MUSI tu zaczynać i kończyć.
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
│     TYPE · STATUS · SOURCE · DATE RANGE · SESSIONS · OWNER           │
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
- **Dowód jest subtelny** — cytaty i linki do sesji wzmacniają każdy wniosek, ale nie dominują wizualnie.
- **Genesis = pełne AI-wypełnienie** — wszystkie sekcje oznaczone ★ są automatycznie wypełniane przez AI w momencie tworzenia insightu z powiązanych sesji.
- Kolejność sekcji w sidebarze jest **personalna** (drag & drop + localStorage). Kolejność eksportu jest **kanoniczna** (określona poniżej).

---

## Warstwa 1 — Identity

Stały pasek na górze widoku. Zawsze widoczny, nie scrolluje.

| Element | Spec | Interakcja |
|---------|------|-----------|
| **Title** | `text-[20px] font-semibold text-slate-900 dark:text-slate-100` · max 120 znaków · placeholder "Bez tytułu" | Klik → inline edit. Blur → auto-save. |
| **Status dot** | `w-2.5 h-2.5 rounded-full` · kolor odpowiada polu STATUS w Properties Strip | Zmienia się automatycznie gdy STATUS się zmienia. Nie klikalny. |
| **Artifact ID** | Format: `INS-XXXX` (4 znaki alfanumeryczne) · `text-[11px] text-slate-400 font-mono` | Klik → kopiuje do schowka → inline "Skopiowano ✓" przez 1.5s. |
| **Saved** | `text-[11px] text-slate-400` | "Zapisuję..." gdy trwa zapis. "Zapisano ✓" przez 2s po auto-save. Idle = niewidoczny. |
| **N/C toggle** | `[N]` Normal (z lewą nawigacją) · `[C]` Canvas (pełna szerokość bez nav) | Przełącza widoczność lewej nawigacji. Stan w localStorage. |

---

## Warstwa 2 — Properties Strip

Dokładnie **6 pól** — niezmienne. Zmiany statusu odbywają się przez klik na dane pole w stripie, nie przez przyciski w toolbarze.

| Pole | Wartość | Semantyka kolorów |
|------|---------|-------------------|
| **TYPE** | Interview · FGI · Survey · Mixed · Document | Ikona per typ, neutralny kolor |
| **STATUS** | Draft · In Progress · Complete · Archived | Draft=szary · In Progress=niebieski · Complete=zielony · Archived=wygaszony |
| **SOURCE** | Projekt lub kontekst źródłowy | — |
| **DATE RANGE** | Zakres dat sesji (od–do) | Aktualny=neutralny · Stary >6 mies.=wygaszony |
| **SESSIONS** | Liczba powiązanych sesji (n=X) | 0=czerwony (pusty insight) · ≥1=neutralny |
| **OWNER** | Osoba odpowiedzialna (dropdown z awatarem) | — |

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
| `⎊` | Icon ghost | Fork — nowy insight z tą samą strukturą + tag "Forked from" |
| `▶` | Icon ghost | Present — fullscreen, kolejność sidebarowa, reorder w trybie |
| `⚡ AI Consultant` | Solid teal | `bg-teal-600 text-white` — prawy panel ~360px |

### Zasady

- **Zero czerwonych** przycisków. Zero gradientów.
- Destruktywne akcje (usuń, archiwizuj, share) → kebab `⋯` na poziomie tabeli/listy.
- Zmiany statusu insightu → klik na pole STATUS w Properties Strip.
- Standard: `h-8 · text-[13px] font-medium · rounded-lg · gap-2`

---

## SectionCard — Mark Complete

Każda SectionCard ma własny status niezależny od statusu insightu.

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
| **Artefakt** | `⚡ AI Consultant` top-right | Klik → prawy panel | Chat z pełnym kontekstem insightu + menu: Uzupełnij puste · Synthesize · Quality check · Refresh · Kontynuuj |

**Zasada "Kontynuuj":** AI pamięta ostatnią sesję pracy z tym insightem. `Kontynuuj` wraca do miejsca, gdzie skończyła — bez ponownego tłumaczenia kontekstu.

---

## Grupy nawigacyjne

| Grupa | Sekcje (23 karty) |
|-------|------------------|
| **Synthesis** | Executive Summary, Consulting Readout, Recommendations |
| **Findings** | Themes, Issues & Risks, Opportunities, Benchmarks |
| **Deep Reading** | Perspectives, Consensus & Divergence, Signals, Implicit Assumptions, Silences, Sentiment & Tone, Power Dynamics, Hypothesis Board |
| **Evidence** | Quote Bank, Evidence Map, Analysis Matrix |
| **Sources** | Source Pack |
| **Deliverables** | Report Pack |
| **Audit** | Quality & Trust, Comments, Activity Log |

---

## Szablon kontraktu karty (11 pól)

| # | Pole | Opis |
|---|------|------|
| 1 | **Historia / pytanie** | Jedno zdanie: jakie pytanie ta karta odpowiada |
| 2 | **Bloki treści** | Lista nazwanych sub-bloków z typem UI każdego |
| 3 | **Źródło danych** | Transkrypty sesji · AI analysis · powiązane encje · ręczne |
| 4 | **AI Genesis** | Co ★ AI wypełnia + **Trigger**: tworzenie / nowa sesja / na żądanie |
| 5 | **AI Consultant** | Co robi `⚡ AI Consultant ▾` dla tej karty + menu akcji |
| 6 | **Wymóg dowodu** | Czy i jakie cytaty są wymagane per blok (specyficzne dla insightów) |
| 7 | **Pusty stan** | Komunikat + CTA gdy karta nie ma danych |
| 8 | **Widoczność domyślna** | ✅ domyślnie widoczna / ❌ ukryta w `≡ Sections ▾` |
| 9 | **Mark Complete** | Kryterium akceptacji — co musi być prawdą |
| 10 | **Eksport** | Jak karta renderuje się w eksportowanym raporcie |
| 11 | **Layout** | cSpan · Badge · cHidden |

---

## Sekcje — Kontrakty (23 karty)

### SYNTHESIS

---

#### `recommendations` — Recommendations / Rekomendacje ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co konkretnie robimy z tym odkryciem — przypisane, priorytetowe działania?" |
| **Bloki treści** | **Priority Actions** — karty: akcja (czasownik + obiekt) + owner + priorytet High/Med/Low + link do inicjatywy + status Open/Done · **Strategic Implications** — lista: implikacja + horyzont Short/Med/Long term · **Quick Wins** — lista: działanie + effort Low/Med/High + impact + realizowalne w < 30 dni |
| **Źródło danych** | AI genesis z Consulting Readout + wnioski analizy tematycznej |
| **AI Genesis** | ★ Trigger: tworzenie + nowa sesja. Generuje Priority Actions i Quick Wins. Strategic Implications wymaga weryfikacji ludzkiej. |
| **AI Consultant** | "Każda rekomendacja: konkretna akcja (czasownik + obiekt), nie kierunek. Owner: konkretna rola. Quick Wins: realizowalne w < 30 dni." Menu: Wygeneruj rekomendacje · Priorytetyzuj · Utwórz inicjatywy · Kontynuuj |
| **Wymóg dowodu** | Priority Actions nie wymagają cytatu — są normative. Strategic Implications mogą linkować do Findings per temat. |
| **Pusty stan** | "Insight bez rekomendacji to obserwacja, nie konsulting. Wygeneruj z AI lub dodaj ręcznie." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Priority Actions mają ownerów i statusy. Quick Wins zidentyfikowane. Strategic Implications zatwierdzone przez PM. |
| **Eksport** | Sekcja "Recommendations". Priority Actions jako numbered list. Quick Wins jako callout/sidebar. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: nigdy |

---

#### `executive-summary` — Executive Summary / Podsumowanie ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jedno zdanie dla C-suite: co odkryliśmy i jakie ma to implikacje?" |
| **Bloki treści** | **Headline** — 1 zdanie: najważniejsze odkrycie (twierdzenie, nie opis) · **Key Findings** — 3 bullet points (każdy max 20 słów) · **Implication** — 1 zdanie: co to oznacza dla organizacji · **Call to Action** — 1 zdanie: co należy zrobić najpierw |
| **Źródło danych** | AI genesis z Consulting Readout + pełna analiza sesji |
| **AI Genesis** | ★ Trigger: tworzenie + nowa sesja (refresh). Syntezuje z Consulting Readout i Themes. |
| **AI Consultant** | "Headline musi być insightful, nie opisowy. Każde zdanie wnosi nową informację. Styl BCG one-pager." Menu: Przepisz · Skróć · Zaostrz tezę · Kontynuuj |
| **Wymóg dowodu** | Brak bezpośrednich cytatów — to synteza. Każde twierdzenie musi być poparte w Consulting Readout. |
| **Pusty stan** | "Wygeneruj Executive Summary z AI po dodaniu sesji źródłowych." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Wszystkie 4 bloki wypełnione. Headline to twierdzenie, nie opis. Zaakceptowane przez senior consultanta. |
| **Eksport** | Strona 1 raportu. Bold header. Standalone — działa bez reszty dokumentu. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: nigdy |

---

#### `consulting-readout` — Consulting Readout / Odczyt konsultingowy ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Pełna narracja konsultingowa — kompletna historia odkryć dla klienta" |
| **Bloki treści** | **Situation** — prose: kontekst i tło (co wiemy przed badaniem) · **Complication** — prose: co odkryliśmy co zmienia obraz (kluczowe napięcie) · **Resolution** — prose: jak rozumiemy tę komplikację (interpretacja) · **Recommendation** — prose: co zalecamy i dlaczego (z uzasadnieniem) |
| **Źródło danych** | Transkrypty sesji — pełna analiza AI |
| **AI Genesis** | ★ Trigger: tworzenie + nowa sesja. Struktura SCQR. Input: pełne transkrypty + tematy + wnioski. |
| **AI Consultant** | "Complication musi zaskakiwać — to odkrycie, nie lista tematów. Styl: CEO-ready, zero hedgingu." Menu: Przepisz SCQR · Zaostrz Complication · Dodaj dowody · Kontynuuj |
| **Wymóg dowodu** | Każda sekcja zawiera 1–2 cytaty inline (kursywą, max 30 słów, atrybucja roli bez imienia). |
| **Pusty stan** | "Dodaj sesje źródłowe — AI wygeneruje pełny readout." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Wszystkie 4 sekcje wypełnione. Complication jest konkretnym odkryciem. Zaakceptowane przez klienta lub PM. |
| **Eksport** | Główna sekcja raportu. Full width. Każda sekcja SCQR jako akapit z nagłówkiem. |
| **Layout** | cSpan: 3 · Badge: — · cHidden: nigdy |

---

### FINDINGS

---

#### `themes` — Themes / Tematy ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie powtarzające się wzorce i tematy wyłoniły się z wywiadów?" |
| **Bloki treści** | **Theme cards** — każda: nazwa tematu + definicja (1 zdanie odróżniające od innych tematów) + częstość (ile sesji / ile respondentów) + siła (Strong/Moderate/Emerging) + reprezentatywny cytat (max 40 słów) |
| **Źródło danych** | Transkrypty sesji — AI thematic analysis |
| **AI Genesis** | ★ Trigger: tworzenie + każda nowa sesja (merge/update). 5–10 tematów, granularność dopasowana do liczby sesji. |
| **AI Consultant** | "Granularność: 5–10 tematów. Każdy: unikalny, z definicją która odróżnia go od pozostałych. Sortuj po sile." Menu: Wyodrębnij · Zmień granularność · Scal podobne · Kontynuuj |
| **Wymóg dowodu** | Każdy temat: reprezentatywny cytat + sesja + rola. Opcjonalnie 2–3 dodatkowe cytaty per temat. |
| **Pusty stan** | "Dodaj sesje — AI wyodrębni tematy z transkryptów." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | 5–10 tematów. Każdy z definicją i cytatem. Zatwierdzone przez lead researcher. |
| **Eksport** | Lista tematów z definicjami i cytatami. Opcjonalnie word cloud. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `issues-risks` — Issues & Risks / Problemy i ryzyka ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie problemy, bariery i zagrożenia zidentyfikowali respondenci?" |
| **Bloki treści** | **Issues** — karty: opis + dotkliwość (Critical/High/Med/Low) + częstość (ile sesji) + kategoria + cytat · **Risks** — karty: zagrożenie + prawdopodobieństwo + potencjalny wpływ + cytat |
| **Źródło danych** | Transkrypty sesji — AI negative signal detection |
| **AI Genesis** | ★ Trigger: tworzenie + nowa sesja. Poszukuje barier, skarg, ostrzeżeń, negatywnych sygnałów. |
| **AI Consultant** | "Odróżnij: Issue = problem teraz, Risk = potencjalny. Critical issues: ≥ 2 niezależne cytaty z różnych sesji." Menu: Wyodrębnij · Klasyfikuj dotkliwość · Kontynuuj |
| **Wymóg dowodu** | Każdy issue/risk: cytat + rola. Critical: min 2 niezależne cytaty z różnych sesji. |
| **Pusty stan** | "Brak zidentyfikowanych problemów i ryzyk." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Issues i Risks posortowane po dotkliwości. Każdy Critical ma ≥ 2 cytaty. |
| **Eksport** | Dwie tabele (Issues / Risks) z klasyfikacją. Critical wyróżnione. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `opportunities` — Opportunities / Szanse ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co respondenci widzą jako szansę, potencjał lub możliwość poprawy?" |
| **Bloki treści** | **Opportunity cards** — każda: opis + potencjalny wpływ High/Med/Low + częstość + kategoria + cytat + [→ Utwórz inicjatywę] |
| **Źródło danych** | Transkrypty sesji — AI positive signal detection |
| **AI Genesis** | ★ Trigger: tworzenie + nowa sesja. Poszukuje aspiracji, sugestii, pozytywnych sygnałów. |
| **AI Consultant** | "Priorytetyzuj po impact × frequency. Każda szansa actionable — link do możliwej inicjatywy." Menu: Wyodrębnij · Priorytetyzuj · Utwórz inicjatywy · Kontynuuj |
| **Wymóg dowodu** | Każda szansa: cytat. High impact: min 2 cytaty z różnych sesji lub ról. |
| **Pusty stan** | "Brak zidentyfikowanych szans." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Opportunities posortowane po impact. High impact mają ≥ 2 cytaty. |
| **Eksport** | Lista szans z priorytetem i cytatami. Top 3 jako callout. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `benchmarks` — Benchmarks / Punkty odniesienia

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jak wyniki i obserwacje mają się do standardów branżowych i best practices?" |
| **Bloki treści** | **Benchmark comparisons** — każda: obszar + wynik organizacji + benchmark (wartość + źródło) + gap (Positive/Negative/Neutral) + implikacja · **Industry Context** — prose: krótki opis kontekstu branżowego dla tych danych |
| **Źródło danych** | Zewnętrzne dane benchmarkowe (ręczne) + AI knowledge base; plan pochodzi z zakresu insightu |
| **AI Genesis** | Nie wypełnia — wymaga danych zewnętrznych. AI może sugerować relevantne benchmarki do zbadania. |
| **AI Consultant** | "Zaproponuj benchmarki relevantne dla tej branży i tematu. Każdy z wiarygodnym źródłem. Gap: co konkretnie oznacza dla organizacji?" Menu: Zaproponuj benchmarki · Oceń gap · Kontynuuj |
| **Wymóg dowodu** | Każdy benchmark wymaga źródła (raport/badanie/standard). Nie może być "wg AI" bez cytowania publikacji. |
| **Pusty stan** | "Brak benchmarków. Dodaj punkty odniesienia żeby pokazać klientowi gdzie stoi na tle branży." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | Każdy benchmark ma wiarygodne źródło. Gap zinterpretowany. Zaakceptowane przez lead. |
| **Eksport** | Tabela benchmarków z gap analysis. Wywołanie w Executive Summary jeśli istotne. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: nigdy |

---

### DEEP READING

---

#### `perspectives` — Perspectives / Perspektywy ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jak różne osoby i role widzą ten temat — kto mówi co, z jakim nastawieniem i jak spójnie?" |
| **Bloki treści** | **Perspective cards** — każda: rola/stanowisko + główna teza (1 zdanie) + kluczowy cytat + sentyment (Positive/Neutral/Negative/Mixed) + **spójność wewnętrzna** (Consistent / Minor contradictions / Significant contradictions) + kontrastujące cytaty jeśli contradictions |
| **Źródło danych** | Transkrypty sesji — AI per-respondent analysis |
| **AI Genesis** | ★ Trigger: tworzenie + nowa sesja. Per respondent: teza, sentyment, sprawdzenie wewnętrznej spójności wypowiedzi w całej sesji. |
| **AI Consultant** | "Szukaj unikalnych punktów widzenia. Spójność: zestawiaj wypowiedzi tej samej osoby z różnych części sesji." Menu: Analizuj perspektywy · Sprawdź spójność · Kontynuuj |
| **Wymóg dowodu** | Każda karta: kluczowy cytat. Jeśli contradictions: dwa kontrastujące cytaty z tej samej sesji i osoby. |
| **Pusty stan** | "Dodaj sesje — AI wyodrębni perspektywy respondentów." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Karta per unikalną rolę/grupę. Każda z cytatem i oceną spójności. Contradictions opisane. |
| **Eksport** | Tabela perspektyw z sentimentem i spójnością. Contradictions wyróżnione. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: nigdy |

---

#### `consensus-divergence` — Consensus & Divergence / Zgoda i rozbieżności ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "W czym respondenci są zgodni, a gdzie ich opinie się rozchodzą — co jest sporne?" |
| **Bloki treści** | **Consensus** — lista: temat + stopień zgody + cytaty z min 2 różnych ról · **Divergence** — lista: temat sporu + dwa kontrastujące stanowiska + cytat z każdego stanowiska + hipoteza dlaczego rozbieżność (rola/interes/doświadczenie) |
| **Źródło danych** | Transkrypty sesji — AI cross-respondent analysis |
| **AI Genesis** | ★ Trigger: ≥ 2 sesje. Porównuje stanowiska per temat między respondentami. |
| **AI Consultant** | "Divergence ważniejsza niż Consensus. Dla każdej rozbieżności: hipoteza dlaczego — co wyjaśnia ten podział?" Menu: Znajdź rozbieżności · Zaktualizuj · Kontynuuj |
| **Wymóg dowodu** | Consensus: ≥ 2 cytaty z różnych ról. Divergence: po 1 cytacie z każdego stanowiska. |
| **Pusty stan** | "Potrzebne ≥ 2 sesje żeby znaleźć wzorce zgody i rozbieżności." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Analiza z ≥ 3 sesji. Każda rozbieżność z hipotezą przyczyny. |
| **Eksport** | Dwie kolumny (Consensus / Divergence) z cytatami. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: gdy < 2 sesje |

---

#### `signals` — Signals / Sygnały

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie słabe sygnały i wschodzące wzorce wychwycono między wierszami?" |
| **Bloki treści** | **Signal cards** — każda: opis sygnału + siła (Strong/Moderate/Weak) + typ (Emerging trend / Early warning / Anomaly) + kontekst + implikacja jeśli sygnał się wzmocni |
| **Źródło danych** | Transkrypty — AI anomaly detection (marginalne komentarze, zmiany tonu, niespodziewane powiązania) |
| **AI Genesis** | Trigger: na żądanie. Głęboka analiza, nie rutynowy genesis. |
| **AI Consultant** | "Szukaj: zmiany tonu, tematy pojawiające się raz ale intensywnie, sprzeczności z główną narracją. Gdyby sygnał był prawdziwy — co by to oznaczało?" Menu: Skanuj sygnały · Oceń siłę · Kontynuuj |
| **Wymóg dowodu** | Każdy sygnał: cytat lub opis momentu z transkryptu. Weak: opis kontekstu zamiast bezpośredniego cytatu. |
| **Pusty stan** | "Brak słabych sygnałów. Uruchom AI żeby przeskanować transkrypty." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | Sygnały posortowane po sile. Każdy z implikacją. |
| **Eksport** | Lista sygnałów z oceną siły. Callout dla Strong. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `implicit-assumptions` — Implicit Assumptions / Ukryte założenia

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie założenia respondenci przyjmują za pewnik, nie wypowiadając ich wprost?" |
| **Bloki treści** | **Assumption cards** — każda: treść założenia + dowód pośredni (fragment języka — "oczywiście", "wszyscy wiedzą", "zawsze tak było") + ryzyko jeśli fałszywe + rekomendacja weryfikacji |
| **Źródło danych** | Transkrypty — AI presupposition analysis |
| **AI Genesis** | Trigger: na żądanie. |
| **AI Consultant** | "Szukaj presupozycji i pominięć. Co traktowane jako oczywiste bez uzasadnienia? Dla każdego: co by się stało gdyby było fałszywe?" Menu: Wyodrębnij założenia · Oceń ryzyko · Kontynuuj |
| **Wymóg dowodu** | Każde założenie: fragment języka jako dowód pośredni (konkretne sformułowanie z transkryptu). |
| **Pusty stan** | "Brak zidentyfikowanych ukrytych założeń." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | ≥ 3 założenia z ryzykiem i rekomendacją weryfikacji. |
| **Eksport** | Lista założeń z dowodem i ryzykiem. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `silences` — Silences / Przemilczenia

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Czego respondenci NIE powiedzieli — jakie tematy były omijane lub przemilczane?" |
| **Bloki treści** | **Silence cards** — każda: temat przemilczany + kontekst (kiedy powinien się pojawić a nie pojawił) + hipoteza dlaczego (Taboo / Fear / Ignorance / Not relevant) + rekomendacja (dopytać / zbadać osobno) |
| **Źródło danych** | Transkrypty — AI gap analysis |
| **AI Genesis** | Trigger: na żądanie. |
| **AI Consultant** | "Zdefiniuj jakie tematy powinny się pojawić w tym typie badania. Dla każdej luki: 3 hipotezy dlaczego." Menu: Znajdź przemilczenia · Oceń hipotezy · Kontynuuj |
| **Wymóg dowodu** | Silence = brak — dowód to opis sytuacji gdy temat powinien paść a nie padł (odniesienie do momentu sesji, nie cytat). |
| **Pusty stan** | "Brak zidentyfikowanych przemilczeń." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | ≥ 2 przemilczenia z hipotezami i rekomendacjami. |
| **Eksport** | Lista przemilczeń z hipotezami. Często najcenniejsza sekcja dla doświadczonego klienta. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `sentiment-tone` — Sentiment & Tone / Sentyment i ton ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jaki jest ogólny nastrój rozmów — optymizm, frustracja, zaangażowanie, strach?" |
| **Bloki treści** | **Overall Sentiment** — score 0–100 + etykieta słowna + 1 zdanie interpretacji · **Per-Theme Sentiment** — heatmapa: tematy × sentyment · **Trend** — per sesja: ewolucja nastroju w czasie badania · **Emotional Peaks** — momenty największego ładunku emocjonalnego (co je wywołało) |
| **Źródło danych** | Transkrypty — AI sentiment analysis per sesja i per temat |
| **AI Genesis** | ★ Trigger: tworzenie + nowa sesja. |
| **AI Consultant** | "Znajdź Emotional Peaks — momenty gdy ton dramatycznie się zmienił. Co je wywołało?" Menu: Uruchom analizę · Zaktualizuj trend · Kontynuuj |
| **Wymóg dowodu** | Emotional Peaks: cytat lub opis kontekstu zmiany tonu. Overall Sentiment: wynik analityczny, bez cytatu. |
| **Pusty stan** | "Dodaj sesje — AI przeprowadzi analizę sentymentu." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Wszystkie 4 bloki wypełnione. Trend oparty na ≥ 3 sesjach. |
| **Eksport** | Dashboard z heatmapą. Overall sentiment w Executive Summary. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `power-dynamics` — Power Dynamics / Dynamika władzy

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Kto ma władzę w tej organizacji i jak to wpływa na treść i ton wywiadów?" |
| **Bloki treści** | **Power Map** — aktorzy: rola + wpływ (H/M/L) + postawa + relacje · **Narrative Control** — kto kształtuje dominującą narrację i czyje głosy są marginalizowane · **Interview Bias** — jak hierarchia mogła wpłynąć na to co ludzie mówili lub przemilczeli |
| **Źródło danych** | Transkrypty — AI organizational analysis + metadane stanowisk respondentów |
| **AI Genesis** | Trigger: na żądanie. |
| **AI Consultant** | "Szukaj: czyje opinie inni cytują, kto mówi 'my' vs 'oni', gdzie widać autocenzurę. Interview Bias: oceń wprost." Menu: Mapuj dynamikę · Oceń bias · Kontynuuj |
| **Wymóg dowodu** | Power Map: pośrednie dowody z języka. Interview Bias: konkretne momenty sesji. |
| **Pusty stan** | "Brak analizy dynamiki władzy." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | Wszystkie 3 bloki wypełnione. Power Map + Narrative Control + Bias. |
| **Eksport** | Power Map jako diagram. Narrative Control i Bias jako prose. Opcja "exclude from client export" (poufne). |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

#### `hypothesis-board` — Hypothesis Board / Tablica hipotez

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie hipotezy badawcze potwierdzają lub obalają zebrane dane?" |
| **Bloki treści** | **Hypothesis cards** — każda: treść hipotezy + status (Supported / Refuted / Insufficient Data / Pending) + dowody za (lista cytatów) + dowody przeciw (lista cytatów) + konkluzja (1 zdanie) |
| **Źródło danych** | Hipotezy ręczne (ustawiane przed/podczas badania) + AI testuje z transkryptów |
| **AI Genesis** | Trigger: na żądanie (po dodaniu hipotez ręcznie lub z findings). |
| **AI Consultant** | "Bądź bezstronny — nawet gdy hipoteza należy do sponsora projektu. Insufficient Data = potrzeba więcej sesji." Menu: Testuj hipotezy · Wygeneruj hipotezy z findings · Kontynuuj |
| **Wymóg dowodu** | Każda hipoteza: ≥ 1 cytat za i ≥ 1 przeciw (lub nota "brak dowodów przeciw znalezionych"). |
| **Pusty stan** | "Dodaj hipotezy badawcze — AI przetestuje je z transkryptów." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | Wszystkie hipotezy mają status inny niż Pending. Każda z konkluzją. |
| **Eksport** | Tabela hipotez ze statusem i kluczowymi dowodami. |
| **Layout** | cSpan: 1 · Badge: — · cHidden: nigdy |

---

### EVIDENCE

---

#### `quote-bank` — Quote Bank / Bank cytatów ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Najlepsze i najbardziej reprezentatywne cytaty z badania — skarbiec konsultanta" |
| **Bloki treści** | **Curated quotes** pogrupowane tematycznie — każdy: treść + rola respondenta + sesja + temat (tag) + siła (★ top quote / standard) · **Uncategorized** — nowe cytaty z ostatniej sesji czekające na tagowanie |
| **Źródło danych** | AI ekstrakcja z transkryptów + manualne oznaczenia konsultanta |
| **AI Genesis** | ★ Trigger: tworzenie + nowa sesja. Wybiera 3–5 najsilniejszych cytatów per sesja i taguje do tematów. |
| **AI Consultant** | "Wybierz cytaty: konkretne, zaskakujące lub perfectly illustrative. Unikaj banałów. Taguj do tematów." Menu: Wyodrębnij cytaty · Otaguj · Oznacz top quotes · Kontynuuj |
| **Wymóg dowodu** | Każdy cytat IS dowodem — musi mieć atrybucję roli + sesję. Imię respondenta opcjonalne (privacy). |
| **Pusty stan** | "Dodaj sesje — AI wypełni Quote Bank z transkryptów." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | ≥ 10 cytatów. Wszystkie otagowane. Top quotes (★) oznaczone. |
| **Eksport** | Cytaty per temat. Top quotes callout w raporcie. Opcja "Quote Booklet" — osobny dokument. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: nigdy |

---

#### `evidence-map` — Evidence Map / Mapa dowodów ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Gdzie w transkryptach jest konkretne poparcie dla każdego kluczowego twierdzenia?" |
| **Bloki treści** | **Evidence cards** — każda: twierdzenie (claim) + cytat źródłowy (verbatim) + sesja + rola + timestamp + siła dowodu (Strong/Moderate/Weak) · **Unclaimed findings** — twierdzenia bez dowodu (auto-alert) |
| **Źródło danych** | AI evidence extraction + link do Themes i Findings |
| **AI Genesis** | ★ Trigger: tworzenie + nowa sesja. Mapuje kluczowe twierdzenia do cytatów. |
| **AI Consultant** | "Unclaimed findings = alarm. Sprawdź czy dowody są naprawdę relevantne, nie tylko tematycznie powiązane." Menu: Zbuduj mapę · Sprawdź unclaimed · Kontynuuj |
| **Wymóg dowodu** | Evidence Map IS mapą dowodów — twierdzenie bez cytatu nie może istnieć. Strong claim: ≥ 2 niezależne cytaty. |
| **Pusty stan** | "Dodaj sesje — AI zbuduje mapę dowodów." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Zero Unclaimed findings. Każdy Strong claim ma ≥ 2 cytaty. |
| **Eksport** | Tabela claim → evidence. Używana do obrony wniosków przy pytaniach klienta. |
| **Layout** | cSpan: 2 · Badge: liczba Unclaimed (alert) · cHidden: nigdy |

---

#### `analysis-matrix` — Analysis Matrix / Macierz analizy ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jak tematy rozkładają się między respondentami, rolami i sesjami — struktura danych w jednym widoku?" |
| **Bloki treści** | **Matrix** — tabela: wiersze = tematy, kolumny = role/respondenci, komórki = obecność (●/○) + sentyment (kolor) + licznik cytatów · **Summary row** — per temat: % respondentów którzy go poruszyli · **Summary column** — per respondent: zakres tematyczny |
| **Źródło danych** | AI matrix build z Themes × transkryptów |
| **AI Genesis** | ★ Trigger: ≥ 2 sesje. Rebuild przy każdej nowej sesji. |
| **AI Consultant** | "Zaznacz tematy poruszone przez < 20% (marginal) i > 80% respondentów (universal)." Menu: Odbuduj macierz · Zmień granularność · Kontynuuj |
| **Wymóg dowodu** | Komórki macierzy to wynik analizy — dowody żyją w Quote Bank i Evidence Map. |
| **Pusty stan** | "Potrzebne ≥ 2 sesje i wyodrębnione tematy żeby zbudować macierz." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Macierz z ≥ 3 sesji i ≥ 5 tematów. |
| **Eksport** | Tabela matrix z legendą. Heatmapa kolorów sentymentu. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: gdy < 2 sesje |

---

### SOURCES

---

#### `source-pack` — Source Pack / Źródła

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie sesje i materiały stanowią podstawę tego insightu?" |
| **Bloki treści** | **Session list** — każda: tytuł sesji + typ (Interview/FGI/Survey/Document) + data + liczba uczestników + status (Source/Exported/Draft) + link |
| **Źródło danych** | `insight.sessions` — powiązane sesje |
| **AI Genesis** | Nie dotyczy — lista systemowa. |
| **AI Consultant** | — |
| **Wymóg dowodu** | Nie dotyczy — to lista źródeł, nie analiza. |
| **Pusty stan** | "Brak powiązanych sesji. Dodaj sesje żeby zasilić analizę insightu." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Wszystkie planowane sesje powiązane i mają status Source. |
| **Eksport** | Lista źródeł z datami. Appendix "Metodologia — źródła danych". |
| **Layout** | cSpan: 1 · Badge: liczba sesji · cHidden: nigdy |

---

### DELIVERABLES

---

#### `report-pack` — Report Pack / Pakiet raportu

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Gotowe materiały do dostarczenia klientowi lub zespołowi" |
| **Bloki treści** | **Reports** — karty: typ (Executive Memo / Full Report / Slide Pack / Quote Booklet) + status (Draft/In Review/Final) + data wygenerowania + [Pobierz] + [Udostępnij] + miniaturka podglądu |
| **Źródło danych** | Wygenerowane raporty z insightu |
| **AI Genesis** | Nie — raporty generowane na żądanie. |
| **AI Consultant** | "Wygeneruj raport z zawartości insightu w wybranym formacie." Menu: Executive Memo · Full Report · Slide Pack · Quote Booklet · Kontynuuj |
| **Wymóg dowodu** | Nie dotyczy — to deliverable, nie analiza. |
| **Pusty stan** | "Brak raportów. Wygeneruj raport z AI lub stwórz ręcznie." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | ≥ 1 raport ze statusem Final. |
| **Eksport** | Nie dotyczy — sama jest kontenerem eksportów. |
| **Layout** | cSpan: 3 · Badge: — · cHidden: nigdy |

---

### AUDIT

---

#### `quality-trust` — Quality & Trust / Jakość i zaufanie

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jak wiarygodne i reprezentatywne są zebrane dane — co trzeba uwzględnić przy interpretacji?" |
| **Bloki treści** | **Sample Quality** — próba (n=X) + pokrycie ról + pokrycie hierarchii + czas badania · **Consistency Check** — ile respondentów wykazało wewnętrzne sprzeczności + zagregowany wpływ na pewność wniosków · **Bias Indicators** — lista potencjalnych biasów (social desirability / framing / recall) + ocena wpływu · **Data Gaps** — czego brakuje: role / tematy / perspektywy + rekomendacja czy uzupełnić |
| **Źródło danych** | Metadane sesji + AI quality assessment |
| **AI Genesis** | Trigger: po dodaniu ≥ 1 sesji (auto-refresh). Update przy każdej nowej sesji. |
| **AI Consultant** | "Bądź bezwzględnie szczery. Jeśli próba zbyt mała lub jednorodna — napisz to wprost. Rekomenduj czy potrzeba więcej sesji." Menu: Oceń jakość · Sprawdź luki · Kontynuuj |
| **Wymóg dowodu** | Bias Indicators: przykłady z transkryptów gdy bias był widoczny. Data Gaps: opis co jest nieobecne. |
| **Pusty stan** | "Jakość danych zostanie oceniona automatycznie po dodaniu sesji." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Wszystkie 4 bloki wypełnione. Data Gaps: plan uzupełnienia lub świadoma decyzja o akceptacji luk. |
| **Eksport** | Sekcja "Methodology & Limitations". Transparentność zwiększa wiarygodność raportu. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: nigdy |

---

#### `comments` — Comments / Komentarze

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co zespół dyskutuje na bieżąco w kontekście tego insightu?" |
| **Bloki treści** | **Thread** — wątkowe komentarze: avatar + imię + treść (rich text) + timestamp + reakcje emoji + reply (max 1 poziom) + opcja "Mark as Action Item" |
| **Źródło danych** | Tabela `comments` filtrowana po `insightId` |
| **AI Genesis** | Nie dotyczy. |
| **AI Consultant** | — (komentarze to głos ludzki) |
| **Wymóg dowodu** | Nie dotyczy. |
| **Pusty stan** | "Brak komentarzy. Zacznij dyskusję." |
| **Widoczność domyślna** | ✅ Widoczna domyślnie |
| **Mark Complete** | Nie dotyczy. |
| **Eksport** | Lista komentarzy z datami (opcjonalna przy eksporcie). |
| **Layout** | cSpan: 1 · Badge: liczba komentarzy · cHidden: gdy 0 |

---

#### `activity-log` — Activity Log / Aktywność

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co się zmieniło w tym insighcie, kto to zmienił i kiedy?" |
| **Bloki treści** | **Log** — chronologiczna lista: ikona akcji + opis zmiany + avatar + timestamp + opcjonalny diff |
| **Źródło danych** | Tabela `history` / audit log dla `insightId` |
| **AI Genesis** | Nie dotyczy — dane systemowe. |
| **AI Consultant** | — |
| **Wymóg dowodu** | Nie dotyczy. |
| **Pusty stan** | "Brak historii zmian." |
| **Widoczność domyślna** | ❌ Ukryta domyślnie |
| **Mark Complete** | Nie dotyczy. |
| **Eksport** | Skrócony log (ostatnie 20 zmian) opcjonalnie jako appendix. |
| **Layout** | cSpan: 2 · Badge: — · cHidden: gdy 0 |

---

## Kolejność kanoniczna (eksport / raport)

Kolejność podąża za grupami nawigacyjnymi: Synthesis → Findings → Deep Reading → Evidence → Sources → Deliverables → Audit.

| # | Karta | Grupa |
|---|-------|-------|
| 1 | Executive Summary | Synthesis |
| 2 | Consulting Readout | Synthesis |
| 3 | Recommendations | Synthesis |
| 4 | Themes | Findings |
| 5 | Issues & Risks | Findings |
| 6 | Opportunities | Findings |
| 7 | Benchmarks | Findings |
| 8 | Perspectives | Deep Reading |
| 9 | Consensus & Divergence | Deep Reading |
| 10 | Sentiment & Tone | Deep Reading |
| 11 | Implicit Assumptions | Deep Reading |
| 12 | Silences | Deep Reading |
| 13 | Signals | Deep Reading |
| 14 | Power Dynamics | Deep Reading |
| 15 | Hypothesis Board | Deep Reading |
| 16 | Quote Bank | Evidence |
| 17 | Evidence Map | Evidence |
| 18 | Analysis Matrix | Evidence |
| 19 | Source Pack | Sources |
| 20 | Report Pack | Deliverables |
| 21 | Quality & Trust | Audit |
| 22 | Comments | Audit |
| 23 | Activity Log | Audit |

> Kolejność eksportu jest niezmienna. Kolejność w sidebarze jest personalna i nie wpływa na eksport.

---

## Zasady Genesis (AI przy tworzeniu)

Sekcje oznaczone ★ są wypełniane w całości przez AI. Trigger zależy od karty — tworzenie insightu, dodanie nowej sesji lub na żądanie:

`recommendations`, `executive-summary`, `consulting-readout`, `themes`, `issues-risks`, `opportunities`, `perspectives`, `consensus-divergence`, `sentiment-tone`, `quote-bank`, `evidence-map`, `analysis-matrix`

**12 sekcji Genesis** — największy zakres spośród wszystkich artefaktów w systemie (inicjatywa: 8).

AI genesis używa:
- Transkryptów wszystkich powiązanych sesji wywiadu
- Tematu i opisu insightu podanego przez użytkownika
- Metadanych sesji (role respondentów, daty, typ sesji)

**3 momenty triggera:**
- **tworzenie** — uruchamiane automatycznie przy pierwszym zapisie insightu z powiązanymi sesjami
- **nowa sesja** — AI odświeża oznaczone karty gdy dołączona zostanie nowa sesja (partial update)
- **na żądanie** — użytkownik uruchamia ręcznie z toolbar (≡ AI Consultant)

**Zasada subtelności dowodów:** cytaty w genesis są wybierane jako krótkie, celne fragmenty (max 40 słów). Długie transkrypty nie są wklejane wprost — AI je interpretuje, a pełne cytaty pozostają dostępne przez link do sesji.

Genesis nigdy nie blokuje — użytkownik może edytować każde pole natychmiast po wygenerowaniu.

---

## Reguły walidacji sekcji

- Sekcja ma `badge` tylko gdy zawiera dane zliczalne: komentarze (`comments`), sesje (`source-pack`), unclaimed findings (`evidence-map`)
- Sekcje bez warunku `cHidden` są zawsze widoczne w sidebarze
- `cHidden: gdy < 2 sesje` — `analysis-matrix` (potrzebuje minimum do budowy macierzy)
- `cHidden: gdy 0` — `comments`, `activity-log` (ukryte gdy brak wpisów)
- `cSpan: 2` = karta zajmuje 2 kolumny canvas (`quote-bank`, `evidence-map`, `analysis-matrix`, `quality-trust`, `activity-log`)
- `cSpan: 3` = karta zajmuje pełną szerokość canvas (`consulting-readout`, `report-pack`)
- Brak `cSpan` = standardowa 1-kolumnowa karta

---

## Różnice między Canonem inicjatyw a Canonem insightów

| Wymiar | Inicjatywa | Insight |
|--------|-----------|---------|
| **Cel artefaktu** | Zarządzanie i dostarczenie pracy | Zrozumienie i komunikacja odkryć |
| **Czas życia** | Miesiące–lata | Tygodnie–miesiące |
| **Główny użytkownik** | PM / Initiative Owner | Researcher / Consultant |
| **Liczba kart** | 21 kart w 6 grupach | 23 karty w 7 grupach |
| **Grupy sekcji** | Scope & Plan · Decisions & Risk · Goals · Finance · People · Records | Synthesis · Findings · Deep Reading · Evidence · Sources · Deliverables · Audit |
| **Genesis scope** | 8 sekcji (struktura i plan) | 12 sekcji (cała analiza) |
| **Genesis trigger** | Tworzenie inicjatywy | Tworzenie + nowa sesja + na żądanie |
| **Unikalny kontrakt karty** | 10 pól | 11 pól (+ Wymóg dowodu) |
| **Najważniejsza sekcja** | Initiative Scope | Consulting Readout |
| **Eksport główny** | Project Brief / Status Report | Consulting Readout / Executive Memo |
| **AI Consultant poziom 3** | Health check + gaps + plan alignment | Full synthesis z transkryptów sesji |
| **Dowód jakościowy** | Nie wymagany per blok | Wymóg dowodu — każdy blok ma kontrakt cytatu |
