# Canon insightów — Insight Detail View

> **Przeznaczenie.** Ten dokument jest jedyną prawdziwą specyfikacją sekcji widoku szczegółów insightu (`InsightViewer`). Każda nowa sekcja, każde AI-wypełnienie i każdy refactor MUSI tu zaczynać i kończyć.

---

## Anatomia artefaktu (4 warstwy)

```
┌─────────────────────────────────────────────────────────────┐
│  1. IDENTITY                                                │
│     Title · Status dot · Artifact ID · Saved · N/C toggle  │
├─────────────────────────────────────────────────────────────┤
│  2. PROPERTIES STRIP                                        │
│     TYPE · STATUS · SOURCE · DATE RANGE · SESSIONS · OWNER  │
├─────────────────────────────────────────────────────────────┤
│  3. MANAGEMENT TOOLBAR                                      │
│     [Export · Share · Link to Initiative]  [Analyze with AI →] │
├───────────────────┬─────────────────────────────────────────┤
│  4. CONTENT       │                                         │
│                   │  SectionCard stack dla aktywnej sekcji  │
│  Left nav         │  ┌──────────────────────────────────┐   │
│  (242px)          │  │ Section Title          [✨ AI]   │   │
│                   │  │ Description                      │   │
│  • Section A ←    │  │ ─────────────────────────────── │   │
│  • Section B      │  │ Karty / cytaty / tabela / prose  │   │
│  • Section C      │  └──────────────────────────────────┘   │
│                   │  [+ Add item]                           │
└───────────────────┴─────────────────────────────────────────┘
```

**Zasady anatomii:**
- Każde pole tekstowe ma po prawej subtelny przycisk ✨ (FieldAIButton) — zawsze.
- AI działa na 3 poziomach: pole (✨) → sekcja (propose→checkboxes→add) → artefakt ("Analyze with AI").
- **Dowód jest subtelny** — cytaty i linki do sesji wzmacniają każdy wniosek, ale nie dominują wizualnie.
- **Genesis = pełne AI-wypełnienie** — wszystkie sekcje oznaczone ★ są automatycznie wypełniane przez AI w momencie tworzenia insightu z powiązanych sesji.
- Kolejność sekcji w sidebarze jest **personalna** (drag & drop + localStorage). Kolejność eksportu jest **kanoniczna** (określona poniżej).

---

## Grupy nawigacyjne

| Grupa | Sekcje |
|-------|--------|
| *(bez nagłówka — top)* | Next Actions, Executive Summary, Consulting Readout, Themes, Issues & Risks, Opportunities |
| **Między wierszami** | People, Signals, Analysis Matrix, Consensus & Divergence, Implicit Assumptions, Silences, Quote Comparison, Sentiment & Tone, Power Dynamics, Hypothesis Board |
| **Dowody** | Evidence Map, Findings & Evidence, Sources |
| **Dostarczane** | Report Pack |
| **Audyt** | Quality & Trust, Comments, Activity Log |

---

## Sekcje — Kontrakty

### TOP (bez grupy)

---

#### `artifact-actions` — Next Actions / Dalsze akcje ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co robimy z tym odkryciem — jakie są konkretne, przypisane następne kroki?" |
| **Typ treści** | Action cards: treść akcji + owner + priorytet (High/Medium/Low) + link do powiązanej inicjatywy + status (Open/Done) |
| **Źródło (auto-load)** | AI genesis z wniosków executive summary i consulting readout |
| **cSpan** | 2 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Zawsze; AI genesis proponuje 3–5 akcji |
| **Pusty stan** | "Brak rekomendowanych działań. Dodaj ręcznie lub wygeneruj z AI." |
| **AI sekcji (✨)** | Wygeneruj listę konkretnych rekomendacji z właścicielami i priorytetem na podstawie wniosków insightu. |

---

#### `executive-summary` — Executive Summary / Podsumowanie ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jedno zdanie dla C-suite: co odkryliśmy i co z tym zrobić?" |
| **Typ treści** | Prose: headline (1 zdanie) + 3 bullet points (kluczowe wnioski) + rekomendacja (1 zdanie) |
| **Źródło (auto-load)** | AI genesis z transkryptów sesji + tematu insightu |
| **cSpan** | 2 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Zawsze; AI genesis wypełnia w całości |
| **Pusty stan** | "Brak podsumowania. Wygeneruj z AI lub wpisz ręcznie." |
| **AI sekcji (✨)** | Przepisz executive summary w formacie: Stwierdzenie → 3 dowody → Implikacja. Max 150 słów. |

---

#### `consulting-readout` — Consulting Readout / Odczyt konsultingowy ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Pełna narracja konsultingowa — co odkryliśmy, dlaczego to ważne i jakie są implikacje?" |
| **Typ treści** | Rich prose sections (McKinsey pyramid): Situation → Complication → Resolution → Recommendation; każda z cytatami dowodowymi |
| **Źródło (auto-load)** | AI genesis z pełnych transkryptów sesji |
| **cSpan** | 3 (pełna szerokość) |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Zawsze; AI genesis wypełnia pełny readout |
| **Pusty stan** | "Brak readoutu. Wygeneruj pełną analizę konsultingową z AI." |
| **AI sekcji (✨)** | Przepisz readout używając struktury piramidy McKinsey'a (SCQR). Utrzymaj styl CEO-ready: precyzja, implikacje, brak hedgingu. |

---

#### `themes` — Themes / Tematy ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie powtarzające się wzorce i tematy wyłoniły się z wywiadów?" |
| **Typ treści** | Theme cards: nazwa tematu + definicja (1 zdanie) + częstość (ile sesji/respondentów) + reprezentatywny cytat |
| **Źródło (auto-load)** | AI thematic analysis z transkryptów |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po analizie AI; genesis proponuje tematy |
| **Pusty stan** | "Brak tematów. Uruchom analizę AI lub dodaj ręcznie." |
| **AI sekcji (✨)** | Wyodrębnij tematy z transkryptów. Granularność: 5–10 tematów. Każdy z definicją i dowodem w postaci cytatu. |

---

#### `issues-risks` — Issues & Risks / Problemy i ryzyka ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie problemy, bariery i zagrożenia zidentyfikowali respondenci?" |
| **Typ treści** | Issue/risk cards: opis + dotkliwość (Critical/High/Medium/Low) + częstość (ile sesji) + reprezentatywny cytat |
| **Źródło (auto-load)** | AI analysis — poszukuje negatywnych sygnałów, barier, problemów |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po analizie AI |
| **Pusty stan** | "Brak zidentyfikowanych problemów lub ryzyk." |
| **AI sekcji (✨)** | Zidentyfikuj i zaklasyfikuj problemy i ryzyka według dotkliwości. Każde z cytatem potwierdzającym. |

---

#### `opportunities` — Opportunities / Szanse ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co rozmówcy widzą jako szansę, potencjał lub możliwość poprawy?" |
| **Typ treści** | Opportunity cards: opis + potencjalny wpływ (High/Medium/Low) + częstość + cytat + link "Create Initiative" |
| **Źródło (auto-load)** | AI analysis — poszukuje pozytywnych sygnałów, aspiracji, sugestii |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po analizie AI |
| **Pusty stan** | "Brak zidentyfikowanych szans." |
| **AI sekcji (✨)** | Wyodrębnij szanse i oceń potencjalny wpływ. Priorytetyzuj według częstości pojawiania się. |

---

### MIĘDZY WIERSZAMI

---

#### `people` — People / Perspektywy ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jak różne osoby i role widzą ten temat — kto mówi co i z jakim nastawieniem?" |
| **Typ treści** | Person perspective cards: rola/stanowisko + główna teza (1 zdanie) + kluczowy cytat + sentyment (Positive/Neutral/Negative/Mixed) |
| **Źródło (auto-load)** | AI per-respondent analysis z transkryptów |
| **cSpan** | 2 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po analizie AI |
| **Pusty stan** | "Brak perspektyw per osoba. Uruchom analizę AI." |
| **AI sekcji (✨)** | Wyodrębnij perspektywę każdej osoby/roli. Szukaj unikalnych punktów widzenia, nie tylko konsensusu. |

---

#### `signals` — Signals / Sygnały

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie słabe sygnały, wczesne ostrzeżenia i wschodzące wzorce wychwycono między wierszami?" |
| **Typ treści** | Signal cards: opis sygnału + siła (Strong/Moderate/Weak) + kontekst + zdanie o implikacji |
| **Źródło (auto-load)** | AI deep-reading — poszukuje anomalii, zmian tonu, marginalnych komentarzy |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po analizie AI |
| **Pusty stan** | "Brak słabych sygnałów." |
| **AI sekcji (✨)** | Przeskanuj transkrypty pod kątem słabych sygnałów i wschodzących wzorców. Uwzględnij zmiany tonu i tematy marginalne. |

---

#### `analysis-matrix` — Analysis Matrix / Macierz Analizy ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jak tematy rozkładają się między rozmówcami, sesjami i rolami?" |
| **Typ treści** | Matrix table: wiersze = tematy, kolumny = respondenci/role, komórki = obecność + sentyment (ikona) |
| **Źródło (auto-load)** | AI matrix build z tematów × respondentów |
| **cSpan** | 2 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po ekstrakcji tematów i analizie per-osoba |
| **Pusty stan** | "Macierz wymaga najpierw analizy tematów i perspektyw." |
| **AI sekcji (✨)** | Odbuduj macierz na bieżącym zestawie tematów. Aktualizuj po każdej nowej sesji. |

---

#### `consensus-divergence` — Consensus & Divergence / Zgoda i rozbieżności ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "W czym rozmówcy są zgodni, a gdzie ich opinie się rozchodzą — co jest sporne?" |
| **Typ treści** | Split view: lewa kolumna = lista konsensusów (każdy z cytatami), prawa kolumna = lista rozbieżności (każda z kontrastującymi cytatami) |
| **Źródło (auto-load)** | AI consensus/divergence analysis |
| **cSpan** | 2 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po analizie AI |
| **Pusty stan** | "Brak analizy zgodności i rozbieżności." |
| **AI sekcji (✨)** | Zidentyfikuj tematy konsensusu i rozbieżności. Dla każdej rozbieżności: pokaż kontrastujące cytaty. |

---

#### `implicit-assumptions` — Implicit Assumptions / Ukryte założenia

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie założenia rozmówcy przyjmują za pewnik, nie wypowiadając ich wprost?" |
| **Typ treści** | Assumption cards: treść założenia + dowód z języka (cytat pośredni) + ryzyko jeśli założenie jest błędne |
| **Źródło (auto-load)** | AI deep reading — analiza języka, presupozycji, pominięć |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po analizie AI |
| **Pusty stan** | "Brak zidentyfikowanych ukrytych założeń." |
| **AI sekcji (✨)** | Wyodrębnij ukryte założenia z języka respondentów. Każde: co jest zakładane + co by się stało gdyby było fałszywe. |

---

#### `silences` — Silences / Przemilczenia

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Czego rozmówcy NIE powiedzieli — jakie tematy były omijane, skracane lub przemilczane?" |
| **Typ treści** | Silence cards: temat przemilczany + kontekst (kiedy temat się nie pojawił, a powinien) + hipoteza dlaczego |
| **Źródło (auto-load)** | AI gap analysis — porównuje oczekiwane tematy z tym co faktycznie padło |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po analizie AI |
| **Pusty stan** | "Brak zidentyfikowanych przemilczeń." |
| **AI sekcji (✨)** | Zidentyfikuj tematy, które powinny się pojawić w tych wywiadach, ale nie padły. Podaj hipotezę dlaczego. |

---

#### `quote-comparison` — Quote Comparison / Porównanie cytatów

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jak te same tematy brzmią w ustach różnych rozmówców — jakie są różnice w narracji?" |
| **Typ treści** | Quote groups: temat + 2–4 cytaty zestawione obok siebie z atrybucją (rola + data sesji) |
| **Źródło (auto-load)** | AI quote extraction grouped by theme |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po ekstrakcji cytatów |
| **Pusty stan** | "Brak zestawionych cytatów." |
| **AI sekcji (✨)** | Wyciągnij kontrastujące cytaty na kluczowe tematy. Zestawiaj cytaty różniące się tonem lub treścią. |

---

#### `sentiment-tone` — Sentiment & Tone / Sentyment i ton ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jaki jest ogólny nastrój rozmów — optymizm, frustracja, niepewność, zaangażowanie?" |
| **Typ treści** | Sentiment dashboard: ogólny score (0–100 / etykieta) + per-temat sentyment (heatmap) + trend sentymentu w czasie sesji |
| **Źródło (auto-load)** | AI sentiment analysis per sesja i per temat |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po analizie AI |
| **Pusty stan** | "Brak analizy sentymentu." |
| **AI sekcji (✨)** | Uruchom analizę sentymentu per temat i per sesja. Zidentyfikuj tematy o wysokim ładunku emocjonalnym. |

---

#### `power-dynamics` — Power Dynamics / Dynamika władzy

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Kto ma władzę w tej organizacji i jak to wpływa na treść i ton wywiadów?" |
| **Typ treści** | Power map: aktor (rola/imię) + poziom wpływu + postawa wobec tematu + relacje z innymi aktorami |
| **Źródło (auto-load)** | AI organizational analysis z wzorców językowych i hierarchii |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po analizie AI |
| **Pusty stan** | "Brak mapy dynamiki władzy." |
| **AI sekcji (✨)** | Zmapuj dynamikę władzy z wywiadów. Zidentyfikuj kto kształtuje narrację i czyje opinie są pomijane. |

---

#### `hypothesis-board` — Hypothesis Board / Tablica hipotez

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie hipotezy badawcze potwierdzają lub obalają zebrane dane?" |
| **Typ treści** | Hypothesis cards: treść hipotezy + status (Supported / Refuted / Insufficient Data / Pending) + dowody za + dowody przeciw |
| **Źródło (auto-load)** | AI hypothesis generation + manual |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Gdy hipotezy dodane ręcznie lub przez AI |
| **Pusty stan** | "Brak hipotez. Dodaj hipotezy badawcze i sprawdź je z danymi." |
| **AI sekcji (✨)** | Wygeneruj hipotezy z wniosków insightu i przetestuj każdą z dowodami z transkryptów. |

---

### DOWODY

---

#### `evidence-map` — Evidence Map / Mapa dowodów ★

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Gdzie w transkryptach jest konkretne poparcie dla każdego wniosku insightu?" |
| **Typ treści** | Evidence cards: wniosek (claim) + cytat źródłowy + sesja + speaker (rola) + timestamp w nagraniu |
| **Źródło (auto-load)** | AI evidence extraction — mapuje wnioski do konkretnych fragmentów transkryptów |
| **cSpan** | 2 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po ekstrakcji AI |
| **Pusty stan** | "Brak mapy dowodów. Uruchom analizę AI." |
| **AI sekcji (✨)** | Zbuduj mapę dowodów: dla każdego kluczowego wniosku znajdź 2–3 cytaty potwierdzające z konkretnych sesji. |

---

#### `candidate-triage` — Findings & Evidence / Wnioski i dowody

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie pojedyncze wnioski i fragmenty dowodów czekają na włączenie lub odrzucenie?" |
| **Typ treści** | Triage list: treść wniosku + sesja źródłowa + status (Include / Exclude / Review) + link do evidence-map |
| **Źródło (auto-load)** | AI candidate extraction z sesji powiązanych z insightem |
| **cSpan** | 2 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Po ekstrakcji kandydatów z sesji |
| **Pusty stan** | "Brak kandydatów do triaży. Powiąż sesje z insightem." |
| **AI sekcji (✨)** | Wyodrębnij kandydatów na wnioski ze wszystkich powiązanych sesji. Wstępnie klasyfikuj według trafności. |

---

#### `source-pack` — Sources / Źródła

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie sesje, materiały i dokumenty stanowią podstawę tego insightu?" |
| **Typ treści** | Source list: tytuł sesji + typ (Interview/FGI/Survey/Document) + data + liczba uczestników + status (Exported/Source/Draft) |
| **Źródło (auto-load)** | `insight.sessions` — powiązane sesje wywiadu |
| **cSpan** | 1 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Gdy sesje powiązane z insightem |
| **Pusty stan** | "Brak powiązanych źródeł. Dodaj sesje do insightu." |
| **AI sekcji (✨)** | — (lista systemowa, nie AI) |

---

### DOSTARCZANE

---

#### `report-pack` — Report Pack / Pakiet raportu

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jakie gotowe materiały są dostępne do dostarczenia klientowi lub zespołowi?" |
| **Typ treści** | Report cards: typ raportu + status (Draft/Final) + data wygenerowania + [Pobierz] + [Udostępnij]; podgląd miniaturki |
| **Źródło (auto-load)** | Wygenerowane raporty powiązane z insightem |
| **cSpan** | 3 (pełna szerokość) |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Gdy istnieją wygenerowane raporty |
| **Pusty stan** | "Brak raportów. Wygeneruj raport z zawartości insightu." |
| **AI sekcji (✨)** | Wygeneruj pełny raport z insightu w wybranym formacie (Executive Memo / Full Report / Slide Pack). |

---

### AUDYT

---

#### `material-quality` — Quality & Trust / Jakość i zaufanie

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Jak wiarygodne i reprezentatywne są zebrane dane — co trzeba wziąć pod uwagę przy interpretacji?" |
| **Typ treści** | Quality dashboard: próba (n=X) + pokrycie ról + wskaźniki biasu + luki danych + ocena reprezentatywności |
| **Źródło (auto-load)** | AI quality assessment z metadanych sesji |
| **cSpan** | 2 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Zawsze; AI genesis ocenia jakość po powiązaniu sesji |
| **Pusty stan** | "Brak oceny jakości. Uruchom audyt AI." |
| **AI sekcji (✨)** | Oceń jakość i reprezentatywność danych. Zidentyfikuj luki próby i potencjalne biasy. |

---

#### `comments` — Comments / Komentarze

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co zespół dyskutuje na bieżąco w kontekście tego insightu?" |
| **Typ treści** | Thread comments: avatar + imię + treść + timestamp + reakcje emoji + reply thread |
| **Źródło (auto-load)** | Tabela `comments` filtrowana po `insightId` |
| **cSpan** | 1 |
| **Badge** | `comments.length` gdy > 0 |
| **cHidden** | Gdy `comments.length === 0` |
| **Kiedy wypełnione** | Gdy istnieje ≥ 1 komentarz |
| **Pusty stan** | "Brak komentarzy. Rozpocznij dyskusję." |
| **AI sekcji (✨)** | — (komentarze to głos ludzki, nie AI) |

---

#### `activity-log` — Activity Log / Aktywność

| Pole | Wartość |
|------|---------|
| **Historia / pytanie** | "Co się zmieniło w tym insighcie, kto to zmienił i kiedy?" |
| **Typ treści** | Timeline log: ikona akcji + opis zmiany + user avatar + timestamp |
| **Źródło (auto-load)** | Tabela `history` / audit log dla `insightId` |
| **cSpan** | 2 |
| **Badge** | — |
| **cHidden** | Nigdy |
| **Kiedy wypełnione** | Od momentu pierwszej akcji |
| **Pusty stan** | "Brak historii zmian." |
| **AI sekcji (✨)** | — (logi systemowe, nie AI) |

---

## Kolejność kanoniczna (eksport / raport)

1. Executive Summary
2. Consulting Readout
3. Themes
4. Issues & Risks
5. Opportunities
6. Next Actions
7. People
8. Consensus & Divergence
9. Analysis Matrix
10. Sentiment & Tone
11. Implicit Assumptions
12. Silences
13. Signals
14. Power Dynamics
15. Quote Comparison
16. Hypothesis Board
17. Evidence Map
18. Findings & Evidence
19. Sources
20. Quality & Trust
21. Report Pack
22. Comments
23. Activity Log

> Kolejność eksportu jest niezmienna. Kolejność w sidebarze jest personalna i nie wpływa na eksport.

---

## Zasady Genesis (AI przy tworzeniu)

Sekcje oznaczone ★ są wypełniane w całości przez AI w momencie tworzenia insightu z powiązanych sesji:
`artifact-actions`, `executive-summary`, `consulting-readout`, `themes`, `issues-risks`, `opportunities`, `people`, `analysis-matrix`, `consensus-divergence`, `sentiment-tone`, `evidence-map`

AI genesis używa:
- Transkryptów wszystkich powiązanych sesji wywiadu
- Tematu i opisu insightu podanego przez użytkownika
- Metadanych sesji (role respondentów, daty, typ sesji)

**Zasada subtelności dowodów:** cytaty w genesis są wybierane jako krótkie, celne fragmenty (max 40 słów). Długie transkrypty nie są wklejane wprost — AI je interpretuje, a pełne cytaty pozostają dostępne przez link do sesji.

Genesis nigdy nie blokuje — użytkownik może edytować każde pole natychmiast po wygenerowaniu.

---

## Reguły walidacji sekcji

- Sekcja ma `badge` tylko gdy zawiera dane z bazy (komentarze)
- Sekcje bez `cHidden` są zawsze widoczne w sidebarze
- `cHidden: true` = sekcja schowana do momentu pojawienia się danych (tylko `comments`)
- `cSpan: 2` = karta zajmuje 2 kolumny canvas
- `cSpan: 3` = karta zajmuje pełną szerokość canvas (consulting-readout, report-pack)
- Brak `cSpan` = standardowa 1-kolumnowa karta

---

## Różnice między Canonem inicjatyw a Canonem insightów

| Wymiar | Inicjatywa | Insight |
|--------|-----------|---------|
| **Cel artefaktu** | Zarządzanie i dostarczenie pracy | Zrozumienie i komunikacja odkryć |
| **Czas życia** | Miesiące–lata | Tygodnie–miesiące |
| **Główny użytkownik** | PM / Initiative Owner | Researcher / Consultant |
| **Grupy sekcji** | Scope/Risk/Outcomes/People/Records | Findings/Deep/Evidence/Deliverables/Audit |
| **Genesis scope** | 7 sekcji (struktura i plan) | 11 sekcji (cała analiza) |
| **Najważniejsza sekcja** | Initiative Scope | Consulting Readout |
| **Eksport główny** | Project Brief / Status Report | Consulting Readout / Executive Memo |
| **AI poziom 3** | "Analyze with AI" → health check + gaps | "Analyze with AI" → full synthesis z sesji |
