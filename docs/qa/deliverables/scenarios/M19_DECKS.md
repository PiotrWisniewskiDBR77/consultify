# M19 Prezentacje — 30 scenariuszy testowych (Seria B+X • W4+W5)

> **Format SSOT** dla self-healing test harness. Każdy scenariusz opisuje INPUT
> (intent + kontekst) i precyzyjne KRYTERIA wyniku (merytoryczne + graficzne).
> Wszystkie kryteria są **autochecker-able** (mierzalne programowo).
>
> **Kanon graficzny**: `docs/.../DELIVERABLES_GRAPHIC_PARAMETERS.md`
> - Canvas: 1920×1080 16:9
> - Layout catalog: 17 SlideIntent (`presentationLayoutDirectorService.ts:37`)
> - Palette catalog: 13 CURATED_COLOR_SETS (harvard/ocean/slate/forest/ember/midnight/arctic/sand/indigo/graphite/olive/burgundy/teal)
> - Hard rules: ONE palette/deck, ≥8 distinct layouts (gdy ≥8 slides), no >2 consecutive identical layouts, body ≥24pt projected, ≤6 bullets/slide, ≤3 dominant colors per slide, contrast ≥4.5:1
>
> **Trudność**: Sml (1-3 slajdy) · Med (4-9) · Lrg (10-15) · Xtr (16+ z ograniczeniami)

---

## Format wpisu

```
### S## [tier] — Tytuł
- intent: "..."           (jaki prompt dostaje generator)
- context: {client, project, language, template}
- substantive (✓ each):   (kryteria merytoryczne)
  - <criterion>: <expectation>
- graphic (✓ each):       (kryteria graficzne)
  - <criterion>: <expectation>
- pass: ALL above
- self-heal hint: (gdzie szukać przyczyny gdy ❌)
```

---

## Tier 1 — Sml (1-3 slajdy, fundamenty) · S01-S05

### S01 [Sml] — Cover-only welcome slide
- **intent**: "Slajd otwierający dla prezentacji o cyfryzacji w MŚP"
- **context**: `lang=PL, client="MŚP klient", template="corporate"`
- **substantive**:
  - count: `slides.length === 1`
  - layout: `slides[0].intent === 'cover'`
  - title: nonempty, contains "cyfryzacja" OR "MŚP" (case-insensitive)
  - key_message present (string, ≥10 chars)
- **graphic**:
  - paletteId ∈ catalog13
  - source: `'llm'` (premium aktywne, nie fallback)
  - imageBrief: nonempty string ≥10 chars (cover sugeruje obraz)
- **pass**: ALL above
- **self-heal hint**: gdy `title` nie zawiera intent → wzmocnij `summarizeSlideForLlm` żeby brief przekazywał kluczowe słowa

### S02 [Sml] — Pojedyncze key_messages (3 slajdy)
- **intent**: "3 kluczowe wiadomości z diagnozy procesu rekrutacji"
- **context**: `lang=PL`
- **substantive**:
  - count: `3 <= slides.length <= 4`
  - layouts: `slides[0].intent === 'cover'`, `slides[last].intent === 'next_steps'`
  - middle slides: `intent === 'key_messages' OR 'single_insight'`
  - every non-cover slide has `key_message` ≥15 chars
- **graphic**:
  - paletteId: identyczna dla wszystkich slajdów
  - layouts: `≥2 distinct` (cover + middle distinct from next_steps)
- **pass**: ALL
- **self-heal hint**: jeśli middle slide=cover → enforceNoTripleRun nie pomógł (sprawdź źródło)

### S03 [Sml] — Single comparison (2 slajdy)
- **intent**: "Porównaj 2 dostawców HR-tech: ATS-A vs ATS-B"
- **context**: `lang=PL`
- **substantive**:
  - count: `slides.length === 2` (cover + comparison)
  - `slides[1].intent === 'comparison'`
  - `slides[1].content` lub `key_message` zawiera oba: "ATS-A" AND "ATS-B"
- **graphic**:
  - paletteId ∈ catalog13
  - source: all `'llm'`
- **pass**: ALL
- **self-heal hint**: jeśli comparison nie wybrane → katalog hint w prompt; sprawdź czy LLM_TEMP not too low

### S04 [Sml] — Cover + single insight + next steps (krótki insight pitch)
- **intent**: "Najważniejszy insight z badania satysfakcji + co dalej (3 slajdy)"
- **context**: `lang=PL`
- **substantive**:
  - count: exactly 3
  - sequence: `[cover, single_insight, next_steps]`
  - middle slide `key_message` ≥20 chars
- **graphic**:
  - palette: single
  - no triple-run violation (n/a dla 3 slajdów)
- **pass**: ALL
- **self-heal hint**: jeśli middle slide!=single_insight → zbyt mało hintów w summary; rozważ injection słowa "insight" w prompt

### S05 [Sml] — Executive summary stand-alone (1 slide complex)
- **intent**: "Jednostronicowe streszczenie wykonawcze dla zarządu (1 slajd)"
- **context**: `lang=PL, client="Zarząd"`
- **substantive**:
  - count: exactly 1
  - `slides[0].intent === 'executive_summary'`
  - key_message ≥30 chars, references "zarząd" OR "kierownictwo" OR "exec"
- **graphic**:
  - paletteId ∈ catalog13
  - source: `'llm'`
- **pass**: ALL
- **self-heal hint**: gdy intent=`cover` (default first) → kategorię "exec" promuj w przykładzie systemPromptu

---

## Tier 2 — Med (4-9 slajdów, standardowe diagnozy) · S06-S15

### S06 [Med] — Diagnoza procesu HR (7 slajdów, ATS workflow)
- **intent**: "Diagnoza procesu rekrutacji ACME: cover + status + 3 problemy + 1 rekomendacja + next_steps"
- **context**: `lang=PL, client="ACME", project="HR diagnostic"`
- **substantive**:
  - count: `6 <= slides.length <= 8`
  - sequence: `slides[0]=cover, slides[last]=next_steps`
  - exactly 1× `executive_summary` OR `performance_overview` w pierwszej połowie
  - ≥1× `recommendation_single` lub `recommendation_portfolio`
  - ≥1× `key_messages` lub `single_insight`
  - title cover zawiera "ACME"
- **graphic**:
  - paletteId: single, ∈ catalog13
  - layouts distinct: `≥4 unique` (z 8 slajdów ≥8 by było wymagane — tu mniejszy zestaw)
  - no >2 consecutive identical
  - imageBriefs: ≥3 slajdy mają nonempty brief
- **pass**: ALL
- **self-heal hint**: brak recommendation → dodaj przykład "diagnostic→recommendation" w systemPrompt B1

### S07 [Med] — Comparison-heavy deck (4 dostawców)
- **intent**: "Porównaj 4 dostawców LMS: TalentLMS, Docebo, SAP SuccessFactors, Cornerstone"
- **context**: `lang=PL`
- **substantive**:
  - count: `5 <= slides.length <= 7` (cover + 4 comparison + next_steps)
  - ≥3× `comparison` OR `assessment`
  - co najmniej 1 slajd wymienia wszystkich 4 dostawców
- **graphic**:
  - palette: single
  - no >2 consecutive identical (ważne: 4 comparisony pod rząd = naruszenie!)
  - distinct layouts: `≥3`
- **pass**: ALL
- **self-heal hint**: jeśli 3 comparisony pod rząd → `enforceNoTripleRun` zadziałał? sprawdź logikę swap

### S08 [Med] — Roadmap + initiative portfolio (6 slajdów)
- **intent**: "Roadmapa wdrożenia AI w call center na 2 lata + portfolio 5 inicjatyw"
- **context**: `lang=PL, client="Call center"`
- **substantive**:
  - count: `5 <= slides.length <= 7`
  - ≥1× `roadmap`
  - ≥1× `initiative_portfolio`
  - ≥1× `prioritization_matrix` LUB `recommendation_portfolio`
  - title/key_message zawiera "2 lata" OR "24 mies" OR "2025-2027"
- **graphic**:
  - palette: single
  - imageBriefs: ≥4 slajdy
- **pass**: ALL
- **self-heal hint**: brak roadmap → wzmocnij keywords w prompcie ("plan/etapy/lata→roadmap")

### S09 [Med] — Risk management deck (5 slajdów)
- **intent**: "Mapa ryzyk wdrożenia ERP w Apatorze: 5 głównych ryzyk + plan mitygacji"
- **context**: `lang=PL, client="Apator", project="ERP rollout"`
- **substantive**:
  - count: `4 <= slides.length <= 6`
  - ≥1× `risk_management`
  - ≥1× `recommendation_single` OR `recommendation_portfolio` (plan mitygacji)
  - cover zawiera "Apator" AND "ERP"
- **graphic**:
  - palette: single — preferowane "ember" lub "burgundy" (motyw ryzyko)
  - source all `'llm'`
- **pass**: ALL
- **self-heal hint**: palette neutralna (np harvard) dla risk decka = wzmocnij hint motywu w systemPrompt

### S10 [Med] — Root cause + recommendation (6 slajdów)
- **intent**: "Analiza root cause spadku NPS w VTS + rekomendacja portfolio działań"
- **context**: `lang=PL, client="VTS", project="NPS recovery"`
- **substantive**:
  - count: `5 <= slides.length <= 7`
  - ≥1× `root_cause`
  - ≥1× `recommendation_portfolio` (multiple actions)
  - cover zawiera "VTS" AND ("NPS" OR "satysfakcja")
- **graphic**:
  - palette: single
  - distinct layouts: ≥4
- **pass**: ALL
- **self-heal hint**: brak root_cause → mapping "spadek/przyczyna/dlaczego" w prompt

### S11 [Med] — Assessment matrix (8 slajdów)
- **intent**: "Ocena 6 inicjatyw cyfryzacji wg matrycy impact×effort"
- **context**: `lang=PL`
- **substantive**:
  - count: `7 <= slides.length <= 9`
  - ≥1× `prioritization_matrix`
  - ≥1× `assessment`
  - ≥1× `initiative_portfolio`
- **graphic**:
  - palette: single
  - distinct layouts: `≥5`
  - no >2 consecutive identical
- **pass**: ALL
- **self-heal hint**: jeśli intent ID nieobecny → katalog hints w systemPromptu

### S12 [Med] — Performance overview KPI deck (5 slajdów)
- **intent**: "Wyniki kwartalne Elkomtech Q3: 4 KPI + komentarz CFO"
- **context**: `lang=PL, client="Elkomtech", project="Q3 review"`
- **substantive**:
  - count: `4 <= slides.length <= 6`
  - ≥1× `performance_overview`
  - ≥1× `executive_summary` OR `key_messages`
  - title/key_message: zawiera "Q3" OR "kwartał"
- **graphic**:
  - palette: single, neutralna (preferowane harvard/slate/midnight dla CFO)
- **pass**: ALL
- **self-heal hint**: palette zbyt jaskrawa (ember/burgundy) dla CFO → hint motywu

### S13 [Med] — Section-bridged deck (z section_intro)
- **intent**: "Prezentacja 2-częściowa: część 1 status, część 2 plan (6 slajdów z section_intro między częściami)"
- **context**: `lang=PL`
- **substantive**:
  - count: `5 <= slides.length <= 7`
  - ≥1× `section_intro` w środku decka (nie 0, nie last)
- **graphic**:
  - palette: single
  - no triple-run
- **pass**: ALL
- **self-heal hint**: section_intro nigdy nie wybrane → katalog hint o "rozdziałach"

### S14 [Med] — Appendix + main (7 slajdów)
- **intent**: "Pełna prezentacja + 1 slajd appendix z metodologią"
- **context**: `lang=PL`
- **substantive**:
  - count: `6 <= slides.length <= 8`
  - `slides[last].intent === 'appendix'` LUB `appendix in last 2 slides`
  - `slides[0].intent === 'cover'`
- **graphic**:
  - palette: single
- **pass**: ALL
- **self-heal hint**: appendix zawsze ostatni — wzmocnij regułę w hint

### S15 [Med] — Bilingual labels (PL+EN deck)
- **intent**: "Bilingual deck (PL primary + EN subtitle on each slide)"
- **context**: `lang=PL, template="bilingual_corporate"`
- **substantive**:
  - count: `5 <= slides.length <= 8`
  - cover: `key_message` lub title zawiera słowo PL AND EN (np "Strategia/Strategy")
- **graphic**:
  - palette: single
- **pass**: ALL
- **self-heal hint**: gdy LLM ignoruje bilingual → strong hint w prompt

---

## Tier 3 — Lrg (10-15 slajdów, pełne diagnostyki) · S16-S25

### S16 [Lrg] — Full diagnostic deck 12 slides (DBR77 flagship format)
- **intent**: "Pełna diagnoza Apator Powogaz: exec summary, 3 obszary problemowe, 5 rekomendacji, roadmapa, ryzyko, next steps (~12 slajdów)"
- **context**: `lang=PL, client="Apator Powogaz", project="Process diagnostic"`
- **substantive**:
  - count: `10 <= slides.length <= 14`
  - sequence: cover, executive_summary, ..., next_steps
  - ≥1× executive_summary, ≥2× single_insight LUB key_messages, ≥1× root_cause, ≥1× recommendation_portfolio, ≥1× roadmap, ≥1× risk_management
- **graphic**:
  - palette: single, ∈ catalog13
  - **distinct layouts: ≥8** (kanon ≥8 distinct for ≥8 slides)
  - no >2 consecutive identical
  - imageBriefs: ≥6 slajdów z brief
- **pass**: ALL — ten test ujawnia czy LLM ma pełen repertuar
- **self-heal hint**: distinct<8 → temperature za niska? prompt: "favor variety"

### S17 [Lrg] — Strategic plan 15-slide
- **intent**: "Plan strategiczny VTS Group 2026-2028: 5 priorytetów + 3 enablery + ryzyka + KPI"
- **context**: `lang=PL, client="VTS Group"`
- **substantive**:
  - count: `13 <= slides.length <= 16`
  - ≥1× initiative_portfolio (priorytety)
  - ≥1× recommendation_portfolio (enablery)
  - ≥1× risk_management
  - ≥1× performance_overview (KPI)
  - ≥1× roadmap
- **graphic**:
  - distinct layouts: `≥8`
  - palette: single
- **pass**: ALL
- **self-heal hint**: brak różnorodności w środku → "no >2 consecutive" zadziałało? sprawdź enforceNoTripleRun

### S18 [Lrg] — Quarterly review 14 slides (full KPI breakdown)
- **intent**: "Q3 deep-dive Elkomtech: 8 KPI breakdownów + komentarz + plan korekt"
- **context**: `lang=PL, client="Elkomtech"`
- **substantive**:
  - count: `12 <= slides.length <= 16`
  - ≥3× performance_overview OR single_insight (per KPI)
  - ≥1× root_cause (dla KPI poza targetem)
  - ≥1× recommendation_single LUB recommendation_portfolio
- **graphic**:
  - distinct layouts: `≥8`
  - palette: single neutralna
- **pass**: ALL
- **self-heal hint**: jeśli wszystkie 8 KPI to ten sam layout → triple-run guard zadziałał?

### S19 [Lrg] — Industry benchmark 12 slides (heavy comparison)
- **intent**: "Benchmark technologii ATS: 5 dostawców na 6 wymiarach"
- **context**: `lang=PL`
- **substantive**:
  - count: `10 <= slides.length <= 14`
  - ≥4× comparison OR assessment
  - ≥1× recommendation_single (winner)
- **graphic**:
  - distinct layouts: `≥6` (dużo porównań — naturalnie mniej różnorodne)
  - no >2 consecutive comparison/assessment (mimo dużo) — wykrywaj naruszenie
- **pass**: ALL
- **self-heal hint**: gdy violation triple-run → sprawdź RELATED_INTENT mapping comparison↔assessment

### S20 [Lrg] — Process redesign 13 slides
- **intent**: "Redesign procesu obsługi klienta w call center: as-is, gap, to-be, plan wdrożenia"
- **context**: `lang=PL, client="Call center"`
- **substantive**:
  - count: `11 <= slides.length <= 15`
  - ≥2× section_intro (as-is, to-be)
  - ≥1× root_cause (gap)
  - ≥1× roadmap
  - ≥1× recommendation_portfolio
- **graphic**:
  - distinct layouts: ≥7
  - palette: single
- **pass**: ALL
- **self-heal hint**: section_intro pomijane → strong hint w prompt o "rozdziałach"

### S21 [Lrg] — Risk-first deck 12 slides
- **intent**: "Audyt ryzyk wdrożenia Salesforce w VTS: 8 ryzyk + plan mitygacji + governance"
- **context**: `lang=PL, client="VTS"`
- **substantive**:
  - count: `10 <= slides.length <= 14`
  - ≥3× risk_management
  - ≥1× recommendation_portfolio
- **graphic**:
  - distinct layouts: `≥7`
  - palette: preferowane ember/burgundy/crimson tone
  - no >2 consecutive risk_management
- **pass**: ALL
- **self-heal hint**: gdy 3 risk slides pod rząd → RELATED_INTENT[risk_management] swap powinien zadziałać

### S22 [Lrg] — Innovation pipeline 14 slides
- **intent**: "Pipeline innowacji R&D Apator 2026: 6 inicjatyw w 3 stagach"
- **context**: `lang=PL, client="Apator R&D"`
- **substantive**:
  - count: `12 <= slides.length <= 16`
  - ≥1× initiative_portfolio
  - ≥1× prioritization_matrix
  - ≥1× roadmap
  - ≥1× section_intro
- **graphic**:
  - distinct layouts: `≥8`
  - palette: single (preferowane indigo/teal — innovation tone)
- **pass**: ALL
- **self-heal hint**: palette zbyt klasyczna (harvard) → motyw hint w prompt dla "innowacja"

### S23 [Lrg] — Cross-functional alignment 11 slides
- **intent**: "Cross-functional alignment HR+IT+Finance dla wdrożenia HRIS"
- **context**: `lang=PL`
- **substantive**:
  - count: `9 <= slides.length <= 13`
  - ≥1× section_intro per dział (3× section_intro = ideał)
  - ≥1× recommendation_portfolio
- **graphic**:
  - distinct layouts: ≥7
- **pass**: ALL
- **self-heal hint**: brak section_intro mimo 3 części → wzmocnij hint

### S24 [Lrg] — Maturity assessment 13 slides
- **intent**: "Ocena dojrzałości danych: 5 wymiarów × 4 poziomy"
- **context**: `lang=PL`
- **substantive**:
  - count: `11 <= slides.length <= 15`
  - ≥2× assessment OR prioritization_matrix
  - ≥1× key_messages (executive)
  - ≥1× recommendation_portfolio (next steps per wymiar)
- **graphic**:
  - distinct layouts: ≥7
- **pass**: ALL
- **self-heal hint**: scenariusz „macierzowy" — assessment vs prioritization_matrix; jeśli żaden → katalog hint

### S25 [Lrg] — Customer journey 14 slides
- **intent**: "Customer journey klienta B2B: 6 touchpointów + pain points + opportunities"
- **context**: `lang=PL`
- **substantive**:
  - count: `12 <= slides.length <= 16`
  - ≥2× single_insight (per touchpoint kluczowy)
  - ≥1× root_cause (pain points)
  - ≥1× recommendation_portfolio (opportunities)
  - ≥1× roadmap
- **graphic**:
  - distinct layouts: ≥7
- **pass**: ALL
- **self-heal hint**: jeśli touchpointy ujednolicone w 1 layout → triple-run guard?

---

## Tier 4 — Xtr (16+ slajdów, board-level z ograniczeniami) · S26-S30

### S26 [Xtr] — Board presentation 18 slides (CEO/CFO/CHRO governance)
- **intent**: "Prezentacja zarządcza dla rady nadzorczej VTS Group: strategia 5-letnia, finanse, ryzyko, sukcesja"
- **context**: `lang=PL, client="VTS Group", template="board"`
- **substantive**:
  - count: `17 <= slides.length <= 20`
  - ≥1× executive_summary (slajd 2-3)
  - ≥2× performance_overview
  - ≥2× initiative_portfolio
  - ≥1× risk_management
  - ≥1× roadmap
  - ≥1× appendix (metodologia/źródła)
  - cover.title formalny ton (nie zawiera kolokwializmów; rygor: starts with słowo wielką literą)
- **graphic**:
  - distinct layouts: **≥9**
  - palette: single (preferowane harvard/slate/midnight — board tone)
  - **0 violations triple-run**
  - imageBriefs: ≥10 slajdów
- **pass**: ALL — najwyższy standard
- **self-heal hint**: distinct<9 mimo 18 slajdów → temperature/prompt failed; rozważ multi-pass remix

### S27 [Xtr] — Multi-section IPO pitch 20 slides
- **intent**: "Pitch IPO dla inwestorów: company, market, product, team, finanse, plan, risks (20 slajdów)"
- **context**: `lang=EN, client="Startup X"`
- **substantive**:
  - count: `18 <= slides.length <= 22`
  - ≥3× section_intro (między sekcjami)
  - ≥2× performance_overview (finanse historyczne + projekcja)
  - ≥1× initiative_portfolio
  - ≥1× risk_management
  - ≥1× appendix
- **graphic**:
  - distinct layouts: ≥9
  - palette: single (preferowane indigo/midnight/teal — investor tone)
  - imageBriefs: ≥12
- **pass**: ALL
- **self-heal hint**: brak section_intro między 7 sekcjami → fundamentalny problem z prompt; wzmocnij

### S28 [Xtr] — Constraint-heavy: 0 use of `key_messages` (force variety)
- **intent**: "Diagnoza HR 16 slajdów BEZ użycia generycznego layoutu 'key_messages' — same specyficzne (single_insight, comparison, assessment, recommendation, etc.)"
- **context**: `lang=PL`
- **substantive**:
  - count: `15 <= slides.length <= 18`
  - **0× key_messages** (constraint testuje zdolność LLM do wyboru specyficznych)
- **graphic**:
  - distinct layouts: ≥10 (z 17 katalogu wykluczamy key_messages → 16 dostępnych, oczekujemy bogactwa)
  - palette: single
  - 0 violations triple-run
- **pass**: ALL — twardy constraint test
- **self-heal hint**: jeśli LLM nadal używa key_messages → constraint trzeba podać EXPLICIT w prompt

### S29 [Xtr] — Multilingual board deck (PL+EN+DE)
- **intent**: "Multilingual deck rady: PL primary, EN+DE subtitles, 16 slajdów, finanse rok-do-roku"
- **context**: `lang=PL, template="board", extra="EN+DE subtitles"`
- **substantive**:
  - count: `15 <= slides.length <= 18`
  - co najmniej 2 slajdy `key_message` ma trójjęzyczny (PL/EN/DE markery — np "/" separator)
  - ≥2× performance_overview
  - ≥1× appendix
- **graphic**:
  - distinct layouts: ≥9
  - palette: harvard/slate (formalne)
- **pass**: ALL
- **self-heal hint**: multilingual zbyt rzadko stosowane → wzmocnij prompt z template

### S30 [Xtr] — Adversarial: kontrastowe wymagania (CEO chce "wow", CFO chce "ostrożnie")
- **intent**: "Slajdy dla mieszanego audytorium CEO (wizjonerskie) i CFO (ostrożne, dane): 16 slajdów wyważone"
- **context**: `lang=PL, template="dual_audience"`
- **substantive**:
  - count: `15 <= slides.length <= 18`
  - ≥1× executive_summary (visionary tone)
  - ≥2× performance_overview (hard data)
  - ≥1× risk_management (CFO compliance)
  - ≥1× recommendation_portfolio (visionary)
  - cover.title wyważony (nie sam "wow", nie sam "ostrożność")
- **graphic**:
  - distinct layouts: ≥8
  - palette: single — preferowane indigo (mostek vision+rigor)
  - no >2 consecutive identical
- **pass**: ALL — najtrudniejszy: dwie persony, jeden deck
- **self-heal hint**: dominacja jednego tonu → wprowadź "balance check" w prompt; ew. multi-pass z B2.remix

---

## Podsumowanie M19

- **30 scenariuszy**: Sml 5 / Med 10 / Lrg 10 / Xtr 5
- **Pokrycie layoutów**: wszystkie 17 SlideIntent są wymagane w ≥1 scenariuszu
- **Pokrycie palet**: 13 palet — testy walidują że LLM wybiera z katalogu, NIE wymagamy konkretnych palet (oprócz hints motywu w Med/Lrg/Xtr)
- **Pokrycie reguł graficznych**: pojedyncza paleta, no triple-run, ≥8 distinct, imageBrief presence — wszystkie testowane w wielu scenariuszach
- **Trudność**: progresywnie rosnąca; ostatnie 5 (Xtr) to constraint/adversarial testy

> Mapowanie na FT-6 (acceptance) z DELIVERABLES-STAN-PRACY-ODBIORY.md — każdy scenariusz = jeden test w korpusie golden-prompty Q3.
