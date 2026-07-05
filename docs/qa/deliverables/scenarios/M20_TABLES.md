# M20 Tabele — 30 scenariuszy testowych (Seria B+X • W4+W5)

> **Kanon graficzny** (`DELIVERABLES_GRAPHIC_PARAMETERS.md`):
> - Pole types z Table Platform: singleLineText, longText, number, currency, percent, checkbox, date, singleSelect, multiSelect, url, email, phone, rating
> - singleSelect/multiSelect z hex colors per option (palette: zielony#16A34A=good/low, amber#D97706=medium, czerwony#DC2626=bad/high, niebieski#2563EB=neutral)
> - numberFormat: currency `#,##0.00`, percent `0.00%`, number `#,##0.##`, date `YYYY-MM-DD`
> - Conditional Formatting (X2): dataBar / colorScale 2-3 color / iconSet (3Arrows/3TrafficLights1/etc) / cellIs
> - Header row: bold, fontColor white, bgColor #4472C4 lub paleta DBR77
> - Freeze panes: row 1 (header) zawsze; columns 1-2 opcjonalnie
> - Alternating row colors: opcjonalne, jasne pasy
>
> **Quality-gate B4 (tableSchemaGeneratorService)**:
> - ≥1 typed field (nie sam singleLineText)
> - select-y mają hex w options
> - ≥3 seed rows
>
> **WorkbookBuilder ExcelJS** zachowuje fills, borders, numFmt, freeze, merges, CF — w przeciwieństwie do SheetJS który dropuje style (fasada w żywym ExportService.ts)
>
> **Trudność**: Sml (3-5 kolumn, 5-10 rows) · Med (6-10 kolumn z typami) · Lrg (z CF i wieloma typami) · Xtr (multi-sheet, formuły, merged cells)

---

## Tier 1 — Sml (3-5 kolumn, fundamenty) · S01-S05

### S01 [Sml] — Lista zadań (TODO)
- **intent**: "Tabela zadań: nazwa, owner, deadline, status"
- **context**: `lang=PL`
- **substantive**:
  - fields: `3 <= fields.length <= 5`
  - field types: ≥1 `singleLineText` (nazwa), ≥1 `date` (deadline), ≥1 `singleSelect` (status)
  - seedRows: `3 <= rows.length <= 6`
  - status options: zawiera "todo" + "in progress" + "done" (lub PL równoważniki)
- **graphic**:
  - status singleSelect: każda opcja ma hex color
  - status colors semantic: todo=neutral, in_progress=amber, done=green
- **pass**: ALL
- **self-heal hint**: status bez kolorów → B4 quality-gate (select-y mają hex) nie zadziałał

### S02 [Sml] — Budżet projektu (4 kolumny)
- **intent**: "Tabela budżetu: kategoria, plan, wykonanie, % realizacji"
- **context**: `lang=PL`
- **substantive**:
  - fields: 4
  - field types: `singleLineText` (kategoria) + 2× `currency` (plan, wykonanie) + 1× `percent` (% realizacji)
  - ≥4 rows
- **graphic**:
  - currency cells: numberFormat=`#,##0.00`
  - percent cell: numberFormat=`0.00%`
- **pass**: ALL
- **self-heal hint**: number cells bez numFmt → B4 musi mapować type→numberFormat

### S03 [Sml] — Lista kontaktów (CRM-style)
- **intent**: "Tabela kontaktów: imię, email, telefon, stanowisko, firma"
- **context**: `lang=PL`
- **substantive**:
  - fields: 5
  - field types: ≥1 `singleLineText` + ≥1 `email` + ≥1 `phone`
  - ≥5 rows
- **graphic**:
  - email cells: link styling (auto-clickable w Excel)
- **pass**: ALL
- **self-heal hint**: email type bez detekcji → B4 mapping pattern email

### S04 [Sml] — Ocena pracowników (rating)
- **intent**: "Tabela ocen: imię, performance (1-5 stars), goal achievement (%)"
- **context**: `lang=PL`
- **substantive**:
  - fields: 3
  - field types: `singleLineText` + `rating` (1-5) + `percent`
  - ≥3 rows
- **graphic**:
  - rating values 1-5 integer
  - percent z numFmt
- **pass**: ALL
- **self-heal hint**: rating jako text → typowanie failed

### S05 [Sml] — Tabela ryzyk (5 ryzyk, severity z kolorami)
- **intent**: "Tabela ryzyk projektu ERP: nazwa, severity (Low/Med/High), likelihood, mitygation"
- **context**: `lang=PL`
- **substantive**:
  - fields: 4
  - severity singleSelect z 3 opcjami: Low/Med/High
  - ≥5 rows
- **graphic**:
  - Low=green#16A34A, Med=amber#D97706, High=red#DC2626 (semantic mapping)
- **pass**: ALL
- **self-heal hint**: severity bez semantic colors → B4 prompt example "risk = traffic-light"

---

## Tier 2 — Med (6-10 kolumn z typami) · S06-S15

### S06 [Med] — CRM accounts (10 kolumn)
- **intent**: "Tabela klientów CRM: company, contact, email, phone, account_type (singleSelect), MRR (currency), churn_risk (singleSelect), last_contact (date), notes, owner"
- **context**: `lang=PL`
- **substantive**:
  - fields: `9 <= fields.length <= 11`
  - 4 typed types (email, phone, currency, date) + 2 singleSelect
  - ≥6 rows
- **graphic**:
  - account_type colors (preferowane Enterprise=indigo, SMB=teal, Mid=harvard)
  - churn_risk: low=green, high=red
- **pass**: ALL
- **self-heal hint**: brak typowania mimo prompt → B4 musi mocniej infer typy z kontekstu

### S07 [Med] — Project portfolio (Airtable-style)
- **intent**: "Portfolio 8 projektów: nazwa, owner, status (To Do/In Progress/Review/Done), priority (P0/P1/P2/P3), start_date, end_date, budget (currency), progress (percent)"
- **context**: `lang=PL`
- **substantive**:
  - fields: 8
  - 2× singleSelect (status, priority) z kolorami
  - 2× date, 1× currency, 1× percent
  - ≥8 rows
- **graphic**:
  - priority colors: P0=red/critical, P1=amber, P2=blue, P3=gray
  - status colors traffic-light gradient
- **pass**: ALL
- **self-heal hint**: priority spread bez P0 alert color → enrichment hint

### S08 [Med] — Sales pipeline
- **intent**: "Pipeline sprzedaży: deal, stage (singleSelect 5 stages), value (currency), close_date, owner, probability (percent)"
- **context**: `lang=PL`
- **substantive**:
  - stage singleSelect z 5 opcjami (Discovery/Qualification/Proposal/Negotiation/Closed)
  - ≥1 currency, ≥1 percent, ≥1 date
  - ≥10 rows
- **graphic**:
  - stage colors gradient (zimne→ciepłe lub neutral→green)
- **pass**: ALL
- **self-heal hint**: stage bez gradient → B4 hint dla "pipeline stages = gradient"

### S09 [Med] — Inventory (kolumny z multiSelect)
- **intent**: "Inwentaryzacja: SKU, name, categories (multiSelect), stock (number), price (currency), low_stock (checkbox), supplier"
- **context**: `lang=PL`
- **substantive**:
  - fields: 7
  - categories `multiSelect` z opcjami i kolorami
  - 1× number, 1× currency, 1× checkbox
  - ≥6 rows
- **graphic**:
  - multiSelect categories: każda opcja ma hex
- **pass**: ALL
- **self-heal hint**: multiSelect detected jako singleSelect → B4 musi rozpoznać liczbę mnogą

### S10 [Med] — Recruitment funnel
- **intent**: "Funnel rekrutacji: candidate, position, source, stage (singleSelect z 6 etapów), applied_date, last_action, owner"
- **context**: `lang=PL`
- **substantive**:
  - stage 6 opcji: Applied/Screened/Interviewed/Offered/Hired/Rejected
  - ≥1 date
  - ≥8 rows
- **graphic**:
  - stage colors: Rejected=red, Hired=green, middle stages=gradient blues/ambers
- **pass**: ALL
- **self-heal hint**: Hired bez green → B4 hint outcome colors

### S11 [Med] — KPI tracker monthly
- **intent**: "Tabela 6 KPI miesięcznie: KPI, owner, target (number), actual (number), variance (percent), status (singleSelect: above/on/below)"
- **context**: `lang=PL`
- **substantive**:
  - 3× number/percent
  - 1× singleSelect status (above=green, on=blue, below=red)
  - ≥6 rows
- **graphic**:
  - status semantic colors
- **pass**: ALL
- **self-heal hint**: status colors odwrócone (above=red) → wrong semantic

### S12 [Med] — Compliance checklist
- **intent**: "Lista kontrolna RODO: 8 wymogów, status (singleSelect: compliant/partial/non-compliant), evidence_url, owner, deadline, last_review"
- **context**: `lang=PL`
- **substantive**:
  - 1× url (evidence)
  - 2× date
  - status colors: compliant=green, partial=amber, non=red
  - ≥8 rows
- **graphic**:
  - status colors traffic-light
- **pass**: ALL
- **self-heal hint**: brak url type → email/url disambiguation w B4

### S13 [Med] — Vendor scorecard
- **intent**: "Karta wyniku 5 dostawców na 5 kryteriach: vendor, criterion_1..5 (każdy rating 1-5), total (number), recommendation (singleSelect)"
- **context**: `lang=PL`
- **substantive**:
  - 5× rating fields
  - 1× number (total)
  - 1× singleSelect recommendation (recommend/conditional/reject)
- **graphic**:
  - rating fields z color scale (1=red, 5=green)
- **pass**: ALL
- **self-heal hint**: rating bez color scale → CF dataBar lub colorScale wymagana per kolumna

### S14 [Med] — Event registration
- **intent**: "Lista uczestników konferencji: name, email, ticket_type (singleSelect), payment_status (paid/pending/refunded), dietary (multiSelect), notes"
- **context**: `lang=PL`
- **substantive**:
  - 2× singleSelect z kolorami
  - 1× multiSelect dietary
  - 1× email
  - ≥10 rows
- **graphic**:
  - paid=green, pending=amber, refunded=gray
- **pass**: ALL
- **self-heal hint**: dietary jako singleLineText → multiSelect rozpoznanie

### S15 [Med] — Help desk tickets
- **intent**: "Zgłoszenia helpdesk: ticket_id, subject, priority (singleSelect P1-P4), status (singleSelect), assignee, created, resolved (opcjonalne)"
- **context**: `lang=PL`
- **substantive**:
  - 2× singleSelect z kolorami
  - 2× date
  - ≥8 rows
- **graphic**:
  - P1=red, P2=amber, P3=blue, P4=gray
- **pass**: ALL
- **self-heal hint**: priority gradient odwrócony (P1=blue) → B4 hint

---

## Tier 3 — Lrg (z CF i wieloma typami) · S16-S25

### S16 [Lrg] — Project portfolio z CF dataBar (10 kolumn)
- **intent**: "Portfolio 12 projektów z conditional formatting: progress jako dataBar (zielony), budget vs actual jako colorScale (red-amber-green)"
- **context**: `lang=PL, requireCF=true`
- **substantive**:
  - fields: ≥10
  - ≥12 rows
  - typed: 2× currency, 1× percent, 2× singleSelect, 2× date
- **graphic**:
  - **CF block: dataBar na progress column** (auto-checkable: workbook XML contains dataBar element)
  - **CF block: 3-color colorScale na variance** (red#DC2626 → amber#F59E0B → green#16A34A)
- **pass**: ALL
- **self-heal hint**: brak CF w wygenerowanym .xlsx → B4 nie zwraca cf rules; rozszerz schema o conditionalFormatting

### S17 [Lrg] — Risk register z iconSet (8 ryzyk)
- **intent**: "Rejestr 8 ryzyk: severity (singleSelect: critical/high/med/low z kolorami) + likelihood (1-5 rating z iconSet 3Arrows) + impact (1-5 z colorScale)"
- **context**: `lang=PL, requireCF=true`
- **substantive**:
  - 1× singleSelect z 4 opcjami (critical/high/med/low)
  - 2× rating fields
  - ≥8 rows
- **graphic**:
  - severity: critical=#DC2626, high=#F59E0B, med=#FBBF24, low=#16A34A
  - likelihood: iconSet 3Arrows (up=high, side=med, down=low)
  - impact: colorScale red→amber→green
- **pass**: ALL
- **self-heal hint**: iconSet bez wsparcia → X2 builder wpięcie

### S18 [Lrg] — Sales pipeline z cellIs (15 deal)
- **intent**: "Pipeline 15 deals: value (currency), highlight value>100k z bold red (cellIs greaterThan)"
- **context**: `lang=PL, requireCF=true`
- **substantive**:
  - ≥15 rows
  - ≥1 currency field
  - ≥1 cellIs rule (greaterThan 100000)
- **graphic**:
  - cellIs style: bold + red fill dla matching cells
- **pass**: ALL
- **self-heal hint**: brak cellIs → X2 schema rozszerzony, B4 powinien go zwracać dla numerycznych progów

### S19 [Lrg] — Multi-criteria scoring (vendor selection)
- **intent**: "Macierz scoringowa 6 dostawców × 8 kryteriów: każdy score 1-5, total z formułą SUM, ranking z color scale"
- **context**: `lang=PL, requireFormulas=true`
- **substantive**:
  - ≥8 rating columns
  - 1 column total (formuła `=SUM(B2:I2)` lub równoważna)
  - ranking column
  - ≥6 rows
- **graphic**:
  - total column z color scale (najwyższy=green)
  - per-criterion color scale per row OR per column
- **pass**: ALL
- **self-heal hint**: brak formuł → B4 schema musi wspierać `cell.formula` (już jest, sprawdzić użycie)

### S20 [Lrg] — Employee performance review (rating + CF)
- **intent**: "Tabela 10 pracowników × 6 wymiarów oceny + total + bonus_pct + bonus_amount (formuła: bonus_pct × salary)"
- **context**: `lang=PL, requireFormulas=true`
- **substantive**:
  - 6× rating
  - 1× number salary
  - 1× percent bonus_pct
  - 1× currency bonus_amount (formuła)
  - ≥10 rows
- **graphic**:
  - rating z CF colorScale
  - bonus_amount formula reference cells
- **pass**: ALL
- **self-heal hint**: bonus_amount jako static value zamiast formuły → B4 hint o "obliczanej kolumnie"

### S21 [Lrg] — Time tracking weekly
- **intent**: "Time tracking 8 osób × 5 dni: hours per day + weekly total (formuła) + utilization % (formuła: total / 40)"
- **context**: `lang=PL, requireFormulas=true`
- **substantive**:
  - 5× number (dni)
  - 1× formuła SUM (total)
  - 1× formuła division (utilization)
  - ≥8 rows
- **graphic**:
  - utilization % z color scale (≤80=amber, ≥100=green, between=blue)
- **pass**: ALL
- **self-heal hint**: formula columns hardcoded → B4 prompt "calculated columns use formulas"

### S22 [Lrg] — Customer LTV cohort
- **intent**: "Cohort analysis: 6 kohort × 12 miesięcy retention, każda komórka percent, heatmap colorScale (red→green)"
- **context**: `lang=PL, requireCF=true`
- **substantive**:
  - 12 percent columns (M1-M12)
  - 1 cohort name column
  - ≥6 rows (kohorty)
- **graphic**:
  - **całość heatmap colorScale red→white→green** (CF z 3-color)
  - merged header dla "Months since acquisition"
- **pass**: ALL
- **self-heal hint**: brak heatmap → X2 CF colorScale brak; szeroka tabela potrzebuje CF całej macierzy

### S23 [Lrg] — OKR tracker
- **intent**: "OKR Q3: 4 Obiektywy + 12 Key Results (3 per O), progress %, owner, status (singleSelect on track/at risk/off track)"
- **context**: `lang=PL`
- **substantive**:
  - ≥12 rows (KR)
  - merged header per Obiektyw (lub osobne sekcje)
  - status z 3 kolorami semantic
  - progress percent z dataBar CF
- **graphic**:
  - status colors: on=green, at_risk=amber, off=red
  - dataBar dla progress (zielony)
- **pass**: ALL
- **self-heal hint**: brak merged headers → schema musi wspierać sheet.merges (już wspiera)

### S24 [Lrg] — Marketing campaign performance
- **intent**: "10 kampanii × 8 metryk (impressions, clicks, CTR, conversions, CR, CPA, spend, ROAS), CF wyróżnia top performers"
- **context**: `lang=PL, requireCF=true`
- **substantive**:
  - 8 number/percent/currency fields
  - ≥10 rows
- **graphic**:
  - CTR i CR z colorScale
  - ROAS z dataBar
  - CPA z odwrotnym color scale (niższy=lepiej=green)
- **pass**: ALL
- **self-heal hint**: CPA z color scale odwróconym → B4 musi rozumieć "lower is better"

### S25 [Lrg] — Operations dashboard table
- **intent**: "Dashboard operacyjny: 6 procesów × KPIs (SLA met %, avg time, error rate, satisfaction), heatmap + status icons"
- **context**: `lang=PL, requireCF=true`
- **substantive**:
  - 4 number/percent fields
  - 1 singleSelect overall status
  - ≥6 rows
- **graphic**:
  - SLA met %: colorScale
  - error rate: odwrotny colorScale
  - status: iconSet 3TrafficLights
- **pass**: ALL
- **self-heal hint**: iconSet wybrany inny niż TrafficLights → B4 hint dla "status icons"

---

## Tier 4 — Xtr (multi-sheet, formuły, merged cells) · S26-S30

### S26 [Xtr] — Annual budget workbook 4 sheety
- **intent**: "Roczny budżet: Sheet1=Summary, Sheet2=OpEx, Sheet3=CapEx, Sheet4=HC; cross-sheet formulas (Summary sumuje z OpEx+CapEx)"
- **context**: `lang=PL, multiSheet=true, requireFormulas=true`
- **substantive**:
  - sheets: 4
  - Summary ma formuły cross-sheet (`=OpEx!B10+CapEx!B10` lub równoważne)
  - kazdy sheet ≥6 rows
  - typy: currency, percent, date
- **graphic**:
  - freeze panes na każdym sheet (row 1)
  - tabColor per sheet
  - Summary header bold + bg
- **pass**: ALL
- **self-heal hint**: brak multi-sheet → B4 schema wspiera ale prompt musi wskazać; B4 sugeruje multi-sheet TYLKO gdy explicit

### S27 [Xtr] — Financial model 12-month projection
- **intent**: "Model finansowy 12 miesięcy: revenue, COGS, gross margin (formuła), OpEx, EBITDA (formuła), Cash (formuła z poprzedniego miesiąca)"
- **context**: `lang=PL, requireFormulas=true`
- **substantive**:
  - ≥6 rows (KPI)
  - 12 month columns
  - formuły: gross margin, EBITDA, Cash (rolling) — co najmniej 3 distinct formuły
- **graphic**:
  - currency numFmt
  - EBITDA row bold (summary)
  - Cash row z CF colorScale (red dla negatywnego)
- **pass**: ALL
- **self-heal hint**: rolling Cash formula failed → B4 musi wspierać cell-reference relative formulas

### S28 [Xtr] — Constraint: 0× singleLineText (force typed schema)
- **intent**: "Tabela 15 kolumn BEZ singleLineText — każda kolumna z konkretnego typu numerycznego/datowego/selectowego"
- **context**: `lang=PL`
- **substantive**:
  - fields: 15
  - **0× singleLineText** (constraint test)
  - mix: number/currency/percent/date/singleSelect/multiSelect/checkbox/rating/url/email/phone
- **graphic**:
  - distinct field types: ≥7
- **pass**: ALL — constraint test
- **self-heal hint**: LLM ucieka w singleLineText → constraint EXPLICIT w prompt

### S29 [Xtr] — Adversarial: ambiguous data type ("kwota" — number czy currency?)
- **intent**: "Tabela z kolumną 'kwota' (mogą być pieniądze lub liczby procesów); B4 musi inferować z kontekstu lub zapytać"
- **context**: `lang=PL`
- **substantive**:
  - field "kwota" z prawidłowym typem dla kontekstu
  - context mentions PLN/USD → currency
  - context mentions "liczba" → number
- **graphic**:
  - numberFormat zgodny z typem
- **pass**: ALL
- **self-heal hint**: domyślnie number bez sprawdzenia kontekstu — B4 powinien inferować z kluczowych słów

### S30 [Xtr] — Complex pivot-like multi-dim (cohort×product×region)
- **intent**: "Multi-dim raport: 5 produktów × 4 regionów × 6 miesięcy = 120 komórek wartości + summary rows + summary columns z formułami"
- **context**: `lang=PL, requireFormulas=true`
- **substantive**:
  - merged headers (region tier, product tier)
  - ≥1 summary row (formuły SUM)
  - ≥1 summary column (formuły SUM)
- **graphic**:
  - 3-level header hierarchy (możliwe przez merges)
  - CF colorScale na całej macierzy danych (red→green)
  - summary rows/cols bold + accent bg
- **pass**: ALL — najwyższy standard generatora tabel
- **self-heal hint**: multi-dim trudny dla LLM — B4 potrzebuje examples w prompt z merged + summary

---

## Podsumowanie M20

- **30 scenariuszy**: Sml 5 / Med 10 / Lrg 10 / Xtr 5
- **Pokrycie typów pól**: singleLineText, longText, number, currency, percent, checkbox, date, singleSelect, multiSelect, url, email, phone, rating — wszystkie w ≥1 scenariuszu
- **Pokrycie CF**: dataBar, colorScale (2/3-color), iconSet (3TrafficLights/3Arrows), cellIs — wszystkie w ≥1 scenariuszu (Lrg+)
- **Pokrycie formuł**: SUM, division, cross-sheet, rolling — w Lrg+Xtr
- **Pokrycie patternów**: simple list, typed CRM, scorecard, heatmap, multi-sheet, financial model, constraint, adversarial

> Mapowanie na FT-1/FT-4 z X2 + FT-1 z B4: każdy scenariusz testuje INPUT (intent) i OUTPUT (struktura + render .xlsx evidence-grade).
