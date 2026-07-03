# M18 Raporty — 30 scenariuszy testowych (Seria B+X • W4+W5)

> **Kanon graficzny** (`DELIVERABLES_GRAPHIC_PARAMETERS.md`):
> - Format A4 portrait, marginesy 1 inch (25mm)
> - Line-height 1.5, measure 50-75ch, type scale 1.25 (modular)
> - Hierarchia heading: H1 28pt → H2 22pt → H3 18pt → body 11pt
> - Maks 2 fonts (serif heading + sans body lub jeden font z weight'ami)
> - Kontrast tekstu ≥4.5:1 vs tło
> - Wykresy: paleta clamp ≤7 kolorów, ≤6 serii
> - KPI strip: 3-5 KPI per pasek, każdy z label+value+delta
>
> **Block types** (`documentStudioTypes.ts:88`):
> - `text` (paragraph), `heading`, `bulletList`, `numberedList`, `quote`, `callout`
> - `chart` (6 kinds: bar/line/pie/donut/scatter/area)
> - `table`, `kpi`, `image`, `divider`
>
> **Bramki jakości** (B3 documentStructureGenerator):
> - ≥1 typed block (nie sama proza) — patrz B3 quality-gate
> - ≥1 section_heading per dokument >1 page
> - Cytowania/źródła osobne (citations[], source_refs[])
>
> **Trudność**: Sml (1 sekcja) · Med (3-5 sekcji) · Lrg (6-10 sekcji + KPI/wykresy) · Xtr (multi-page strategic z cross-references)

---

## Tier 1 — Sml (1 sekcja, fundamenty) · S01-S05

### S01 [Sml] — Single-section memo (5 paragrafów)
- **intent**: "Krótki memo do zarządu: stan prac nad wdrożeniem CRM (5 paragrafów)"
- **context**: `lang=PL, project="CRM rollout", audience="zarząd"`
- **substantive**:
  - sections: `1`
  - blocks: `5 <= blocks.length <= 7`
  - ≥1 block type `heading` (sekcja tytuł)
  - reszta `text` (paragrafy) lub 1 `callout`
  - sections[0].heading zawiera "CRM"
- **graphic**:
  - prose density: ≤80 słów per blok text
  - 0 wykresów (nie wymaganych dla memo)
- **pass**: ALL
- **self-heal hint**: jeśli ≥1 chart/table → LLM nadinterpretował; prompt: "memo = sama proza + 1 callout"

### S02 [Sml] — KPI-only one-pager
- **intent**: "Jednostronicowy KPI dashboard: 4 KPI Q3 dla Elkomtech"
- **context**: `lang=PL, client="Elkomtech"`
- **substantive**:
  - sections: `1`
  - ≥1 block type `kpi` z 3-5 itemami
  - każdy KPI ma {label, value, delta} (numerycznie value, delta z %)
- **graphic**:
  - KPI strip: 3-5 itemów (kanon)
  - kolor delta: zielony dla + / czerwony dla − (auto-checkable: positive%↔greenColor lub semantic 'good')
- **pass**: ALL
- **self-heal hint**: brak kpi block → B3 nie wybrał typed block; wzmocnij quality-gate

### S03 [Sml] — Single callout warning
- **intent**: "Krótki dokument z ostrzeżeniem o ryzyku GDPR (1 callout + 2 paragrafy)"
- **context**: `lang=PL`
- **substantive**:
  - blocks: `3 <= blocks.length <= 4`
  - ≥1 block type `callout` z tone "warning" lub "danger"
  - callout.text zawiera "GDPR" OR "RODO"
- **graphic**:
  - callout tone-based fill (warning=amber, danger=red)
  - ≤1 callout (nie spam)
- **pass**: ALL
- **self-heal hint**: callout pominięty → strong type hint w prompt

### S04 [Sml] — Quote-driven brief (1 sekcja z citation)
- **intent**: "Brief otwierający z cytatem CEO + 3 paragrafy kontekstu"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 block type `quote`
  - quote.text + quote.author obecne
  - ≥3 text blocks (kontekst)
- **graphic**:
  - quote highlighted (italic OR left-border) — sprawdzaj atrybut styling
- **pass**: ALL
- **self-heal hint**: brak quote block → keyword "cytat" w mapping

### S05 [Sml] — Bullet-only list (executive summary in 5 punktów)
- **intent**: "Streszczenie wykonawcze w 5 punktach (sama lista, bez prozy)"
- **context**: `lang=PL`
- **substantive**:
  - blocks: `1 <= blocks.length <= 2`
  - ≥1 block type `bulletList` z 5 itemami
- **graphic**:
  - bullet indent zgodny z kanonem (1 poziom; ≤6 per slide; tu 5 OK)
- **pass**: ALL
- **self-heal hint**: jeśli LLM zwrócił 5 text blocks zamiast listy → strong "lista" hint

---

## Tier 2 — Med (3-5 sekcji, mieszane bloki) · S06-S15

### S06 [Med] — Diagnoza procesu HR (4 sekcje, mieszane bloki)
- **intent**: "Diagnoza procesu rekrutacji ACME: wprowadzenie, stan obecny (z KPI), 3 problemy (callouts), rekomendacja (lista)"
- **context**: `lang=PL, client="ACME"`
- **substantive**:
  - sections: `3 <= sections.length <= 5`
  - ≥1 block type `kpi`
  - ≥2 block type `callout`
  - ≥1 block type `bulletList`
  - section "rekomendacja" obecna (heading zawiera "rekomendacja" OR "next steps")
- **graphic**:
  - KPI ≥3 itemy
  - callouts NIE spam (≤4 total)
- **pass**: ALL
- **self-heal hint**: brak różnorodności bloków (sama proza) → B3 quality-gate (≥1 typed) zadziałał?

### S07 [Med] — Quarterly performance report (5 sekcji + wykres)
- **intent**: "Raport Q3 Elkomtech: KPI, wykres trendu, komentarz, top 3 issues, plan korekt"
- **context**: `lang=PL, client="Elkomtech"`
- **substantive**:
  - ≥1 block type `kpi`
  - ≥1 block type `chart` (preferowany kind=`line` lub `bar`)
  - ≥1 block type `callout` lub `bulletList` (issues)
  - ≥1 block type `bulletList` lub `numberedList` (plan korekt)
- **graphic**:
  - chart palette ≤7 kolorów (clamp z kanonu)
  - chart.series count ≤6
  - chart.title obecny
- **pass**: ALL
- **self-heal hint**: chart bez title → B3 prompt wzmocnić

### S08 [Med] — Comparison report — 3 dostawców
- **intent**: "Porównaj 3 dostawców LMS na 5 kryteriach: wprowadzenie, tabela, rekomendacja"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 block type `table` z columns ≥5 (kryteria) + rows ≥3 (dostawcy)
  - ≥1 block type `callout` lub heading z rekomendacją
- **graphic**:
  - table.style: zebra rows OR alternating fill
  - table headers wyróżnione (bold/bg)
- **pass**: ALL
- **self-heal hint**: brak table → B3 quality-gate zadziałał? alternatywnie raport prozą = porażka

### S09 [Med] — Risk assessment (matrix-style)
- **intent**: "Ocena ryzyk wdrożenia ERP: 5 ryzyk, prawdopodobieństwo×wpływ, mitygacje"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 block type `table` z columns include "ryzyko" + "prawdopodobieństwo" + "wpływ" + "mitygacja"
  - ≥5 rows
  - ≥1 callout z severity high (CTA mitygacji najpilniejszej)
- **graphic**:
  - table z risk-tone colors (red/amber/green per severity) — auto-checkable jako cell.style.bgColor
- **pass**: ALL
- **self-heal hint**: brak kolorów risk → table render bez CF; potrzeba X2 wireup

### S10 [Med] — Customer feedback synthesis
- **intent**: "Synteza 20 wywiadów z klientami: tematy, częstość, ilustracje cytatami"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 block type `chart` (kind=`bar` częstość tematów)
  - ≥2 block type `quote` (ilustracje)
  - ≥1 block type `kpi` (top 3 tematy)
- **graphic**:
  - chart.series.values: integer counts
  - quote.author obecny
- **pass**: ALL
- **self-heal hint**: gdy chart=line zamiast bar dla "częstość" → block-type hint w prompt

### S11 [Med] — Process documentation (5 etapów)
- **intent**: "Procedura onboardingu nowego pracownika: 5 etapów, każdy z opisem + responsibility"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 block type `numberedList` z 5 itemami
  - kazdy item ma description (≥30 chars)
  - ≥1 block type `table` z responsibility per etap (kolumny: etap, owner, deadline)
- **graphic**:
  - numbered list spacing zgodny (≤6 itemów, 5 OK)
- **pass**: ALL
- **self-heal hint**: numberedList vs bulletList — keyword "etap/krok" → numbered

### S12 [Med] — Strategy memo (4 sekcje executive)
- **intent**: "Memo strategiczne: kontekst, 3 priorytety, ryzyka, rekomendowane decyzje (4 sekcje)"
- **context**: `lang=PL`
- **substantive**:
  - sections: `4`
  - ≥1 callout per sekcja "priorytety" (3 priorytety → 3 callouts? Lub 1 callout + 3 paragrafy)
  - ≥1 bulletList "decyzje"
- **graphic**:
  - body density: 80-150 słów per text block
- **pass**: ALL
- **self-heal hint**: priorytety jako sama proza → struktura niewidoczna; B3 hint "3 priorytety = 3 oddzielne bloki"

### S13 [Med] — Financial analysis (KPI + wykres + tabela)
- **intent**: "Analiza finansowa: 5 KPI, wykres trendu marży, tabela kosztów per kategoria"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 kpi z 5 itemami (label/value/delta)
  - ≥1 chart kind=`line` LUB `area`
  - ≥1 table z columns "kategoria" + "wartość" + "udział%"
- **graphic**:
  - chart x-axis label (np "miesiąc"), y-axis label (np "PLN", "%")
  - table cell.style.numberFormat: currency dla "wartość", percent dla "udział%"
- **pass**: ALL
- **self-heal hint**: brak numberFormat → cell.value=raw number, brak typowania; prompt o number format

### S14 [Med] — Research summary (multi-source)
- **intent**: "Streszczenie badań (5 źródeł): finding, evidence, citation"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 sekcja "findings" z bulletList
  - ≥5 citations (artifact.citations array)
  - kazdy text block referencjuje co najmniej 1 cytowanie (np "[1]", "[Smith2024]")
- **graphic**:
  - citations layout: list bottom of section
- **pass**: ALL
- **self-heal hint**: brak citations → B3 musi zwracać citations[] w schemacie

### S15 [Med] — Compliance report (5 wymogów, status per)
- **intent**: "Status zgodności z 5 wymogami RODO: per wymóg status + dowód + plan jeśli niezgodne"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 table z columns "wymóg" + "status" (green/amber/red) + "evidence" + "next_action"
  - ≥5 rows
- **graphic**:
  - status column singleSelect z kolorami (auto-checkable: cell.style.bgColor per status value)
- **pass**: ALL
- **self-heal hint**: brak kolorów statusu → CF/styling brak; X2-style enforcement

---

## Tier 3 — Lrg (6-10 sekcji, pełne raporty) · S16-S25

### S16 [Lrg] — Full diagnostic report 8 sekcji (DBR77 flagship)
- **intent**: "Pełny raport diagnostyczny Apator: executive summary, kontekst, metodyka, 3 obszary problemowe (z KPI+callout), rekomendacje (lista), roadmapa (tabela), ryzyko, appendix"
- **context**: `lang=PL, client="Apator"`
- **substantive**:
  - sections: `7 <= sections.length <= 9`
  - ≥1 executive_summary heading
  - ≥3 KPI sets (jeden per obszar problemowy)
  - ≥3 callouts (jeden per problem)
  - ≥1 bulletList "rekomendacje"
  - ≥1 table "roadmapa" (faza/działanie/owner/termin)
  - ≥1 risk_management section z table 5 ryzyk
- **graphic**:
  - 7-9 sekcji z distinct headings (poziom H2)
  - body density 100-200 słów per text block
  - chart count: 0-2 (raport diagnostyczny — wykresy opcjonalne)
- **pass**: ALL
- **self-heal hint**: brak typowanych bloków mimo 8 sekcji → B3 quality-gate fundamentalnie zawodzi

### S17 [Lrg] — Strategic plan 10 sekcji (VTS-style)
- **intent**: "Plan strategiczny 2026-2028: wizja, 5 priorytetów, 3 enablery, governance, KPI, ryzyko, roadmapa, finansowanie, sukcesja, appendix"
- **context**: `lang=PL, client="VTS"`
- **substantive**:
  - sections: `9 <= sections.length <= 11`
  - ≥1 sekcja "priorytety" z 5 callouts/bulletów
  - ≥1 sekcja "roadmapa" z timeline-style table
  - ≥1 KPI strip
  - ≥1 risk_management table
- **graphic**:
  - distinct block types ≥5 (heading, text, kpi, table, callout, bulletList)
  - body density 100-200 słów
- **pass**: ALL
- **self-heal hint**: mało różnorodności typów → B3 prompt: "vary block types"

### S18 [Lrg] — Industry benchmark 8 sekcji (heavy tables + charts)
- **intent**: "Benchmark technologii ATS: 5 dostawców × 8 wymiarów + winnik + uzasadnienie + risks"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 large table (5×8)
  - ≥1 chart radar-like LUB scatter (positioning)
  - ≥1 callout "winner"
  - ≥1 bulletList "rationale"
- **graphic**:
  - table fit on page (≤10 columns max)
  - chart palette ≤7
- **pass**: ALL
- **self-heal hint**: chart kind=bar mimo prośby o radar → B3 hint kind="scatter" dla positioning

### S19 [Lrg] — Process redesign 9 sekcji
- **intent**: "Redesign procesu obsługi klienta: as-is (3 problemy), gap analysis, to-be, plan wdrożenia, governance, ryzyka, KPI, koszty, harmonogram"
- **context**: `lang=PL`
- **substantive**:
  - ≥2 section_intro headings (as-is vs to-be)
  - ≥1 table "gap analysis" (3 columns: as-is/to-be/gap)
  - ≥1 callout per problem
  - ≥1 numbered list "plan wdrożenia" (z fazami)
  - ≥1 KPI strip
- **graphic**:
  - clean as-is vs to-be visualization (preferowane 2 tabele OR 1 macierz)
- **pass**: ALL
- **self-heal hint**: brak as-is/to-be struktury → prompt nie przekazał kontrastu

### S20 [Lrg] — Vendor selection report 7 sekcji
- **intent**: "Selekcja dostawcy CRM: 4 kandydatów, criteria, scoring, demo notes, decision, transition plan"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 table 4×N (kandydaci × kryteria z score)
  - ≥1 callout "rekomendacja" z winnerem
  - ≥1 numberedList "transition plan"
  - ≥1 KPI "savings/effort"
- **graphic**:
  - score column: numeric, can have CF (color scale)
  - winner callout: tone=success
- **pass**: ALL
- **self-heal hint**: brak score CF → table block bez stylowania per cell

### S21 [Lrg] — Annual report 10 sekcji (mixed media)
- **intent**: "Roczny raport firmy: highlights, biznes, finanse (3 wykresy), zasoby ludzkie, technologia, klienci, ryzyko, ESG, perspektywa, appendix"
- **context**: `lang=PL`
- **substantive**:
  - sections: 10
  - ≥3 charts (różne kinds: bar+line+pie)
  - ≥1 KPI strip
  - ≥1 quote (CEO)
  - ≥1 table (finanse)
- **graphic**:
  - distinct chart kinds ≥3
  - chart palette consistent across all charts
- **pass**: ALL
- **self-heal hint**: chart palette niespójny → B3 powinien wymusić jedną paletę dla wykresów

### S22 [Lrg] — Customer journey deep-dive 8 sekcji
- **intent**: "Customer journey B2B: 6 touchpointów, pain points, opportunities, plan działań, ROI projection"
- **context**: `lang=PL`
- **substantive**:
  - ≥6 bullet items reprezentujących touchpointy
  - ≥3 callouts pain points (różne tony: warning/danger)
  - ≥1 chart "ROI projection" (kind=line/area, x=miesiące)
  - ≥1 numbered "plan działań"
- **graphic**:
  - ROI chart x-axis: time-like; y-axis: PLN/%
- **pass**: ALL
- **self-heal hint**: brak ROI chart → B3 musi mapować "projekcja" → chart

### S23 [Lrg] — Audit report 9 sekcji
- **intent**: "Audyt bezpieczeństwa IT: 6 obszarów, severity, evidence, recommendations, timeline"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 table z columns "obszar" + "severity" + "evidence" + "recommendation"
  - severity values: ∈ {low, medium, high, critical}
  - ≥3 critical callouts (jeśli severity=high+)
- **graphic**:
  - severity column color-coded (status singleSelect z kolorami)
  - critical callouts: tone=danger
- **pass**: ALL
- **self-heal hint**: severity bez kolorów → integration X2 (CF) brakująca

### S24 [Lrg] — Innovation pipeline 8 sekcji
- **intent**: "R&D pipeline: 8 inicjatyw w 4 stagach, każda z scorem + koszt + ETA + ryzyko"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 large table (8 rows × stage/score/cost/eta/risk)
  - ≥1 chart funnel/bar (stage→count)
  - ≥1 bulletList top 3 ranked
- **graphic**:
  - score column: numeric z color scale (X2 CF style)
  - cost numFmt currency
- **pass**: ALL
- **self-heal hint**: brak typowania number formats → cell.style.numberFormat absent

### S25 [Lrg] — Talent strategy 9 sekcji
- **intent**: "Strategia talentu: as-is rotacja, attrition drivers, employer brand, retention plan, comp framework, leadership pipeline, DEI, learning, KPI"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 chart attrition trend (line)
  - ≥3 callouts (per kluczowy driver)
  - ≥1 KPI strip
  - ≥1 bulletList retention plan
- **graphic**:
  - attrition chart preferowany trend in red palette
- **pass**: ALL
- **self-heal hint**: chart bez kontekstu → B3 nie przekazał semantyki "trend"

---

## Tier 4 — Xtr (multi-page strategic) · S26-S30

### S26 [Xtr] — Board-level annual review 14 sekcji
- **intent**: "Raport roczny dla rady: 14 sekcji, ≥4 wykresy, ≥3 KPI strips, ≥2 tabele, citations z 8+ źródeł"
- **context**: `lang=PL, template="board"`
- **substantive**:
  - sections: `13 <= sections.length <= 16`
  - ≥4 charts (mix kinds)
  - ≥3 KPI strips
  - ≥2 tables
  - ≥1 quote (CEO)
  - ≥1 appendix
  - ≥8 citations
- **graphic**:
  - consistent chart palette
  - body density 100-150 słów (board-tone — concise)
- **pass**: ALL — najwyższy standard
- **self-heal hint**: niewystarczająca różnorodność typów → multi-pass remix LLM

### S27 [Xtr] — IPO prospectus excerpt 12 sekcji (EN, regulatory tone)
- **intent**: "IPO prospectus excerpt EN: company, market, product, finances (3 historical + 3 projection charts), risk factors (≥10 risks), use of proceeds, mgmt team"
- **context**: `lang=EN, template="regulatory"`
- **substantive**:
  - sections: `11 <= sections.length <= 13`
  - ≥6 charts (3 historical + 3 projection)
  - ≥1 table risk factors (≥10 rows)
  - formal tone: 0 contractions, 0 colloquialisms (auto-check via regex)
- **graphic**:
  - palette: neutral (grays + 1 accent)
  - chart legends explicit
- **pass**: ALL
- **self-heal hint**: ton casualowy → strong "regulatory tone" hint w prompt

### S28 [Xtr] — Constraint: 0 prose (data-only report)
- **intent**: "Raport BEZ paragrafów prozy — same KPI, tabele, wykresy, callouts (≥8 sekcji)"
- **context**: `lang=PL`
- **substantive**:
  - **0× block type `text`** (constraint)
  - ≥8 sections
  - mix: kpi + table + chart + callout + heading
- **graphic**:
  - distinct typed blocks ≥4
- **pass**: ALL — constraint test
- **self-heal hint**: LLM nadal generuje text bloki → constraint EXPLICIT w prompt

### S29 [Xtr] — Multilingual whitepaper PL+EN side-by-side
- **intent**: "Whitepaper bilingual PL+EN (każda sekcja w obu językach), 10 sekcji, 4 wykresy"
- **context**: `lang=PL+EN, template="whitepaper"`
- **substantive**:
  - 10 sekcji, każda ma podsekcję PL + podsekcję EN
  - ≥4 charts (labels w obu językach lub przynajmniej tytuł bilingual)
  - ≥1 table (headers bilingual)
- **graphic**:
  - layout bilingual side-by-side LUB serial (PL→EN)
- **pass**: ALL
- **self-heal hint**: brak bilingual w sekcjach → strong prompt template hint

### S30 [Xtr] — Adversarial: contradictory data + needs reconciliation
- **intent**: "Raport gdy 2 źródła dają sprzeczne dane (KPI Q3 ze sales=120, z finance=95). Generator musi zaznaczyć rozjazd, podać oba, zaproponować weryfikację"
- **context**: `lang=PL`
- **substantive**:
  - ≥1 callout type="warning" lub "info" zawiera "rozbieżność" OR "discrepancy"
  - obie wartości obecne (120, 95) w tekście/tabeli
  - ≥1 bulletList "weryfikacja" (next steps)
- **graphic**:
  - obie wartości wizualnie wyróżnione (np w jednej tabeli z highlight)
- **pass**: ALL — sprawdza umiejętność LLM w obsłudze ambiguity
- **self-heal hint**: LLM wybiera jedną wartość bez wskazania rozjazdu → quality issue, prompt: "highlight inconsistencies"

---

## Podsumowanie M18

- **30 scenariuszy**: Sml 5 / Med 10 / Lrg 10 / Xtr 5
- **Pokrycie typów bloków**: wszystkie (text/heading/bulletList/numberedList/quote/callout/chart/table/kpi/image/divider) w ≥1 scenariuszu
- **Pokrycie wykresów**: bar, line, pie, area, scatter — wszystkie obecne w ≥1 scenariuszu
- **Pokrycie patternów**: KPI-only, callout-only, table-heavy, chart-heavy, mixed, multi-page, multilingual, constraint, adversarial
- **Trudność**: progresywna; Xtr testuje constraint+adversarial — najwyższy poziom B3 jakości
