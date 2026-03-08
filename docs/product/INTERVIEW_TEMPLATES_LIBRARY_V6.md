# Interview Templates Library v6 (System / Organization / Private)

> **Status:** Draft (to-be v6)  
> **Cel:** zdefiniować bibliotekę template'ów do wysyłek/interview oraz zasady ich budowy, scope, jakości pytań i modalności odpowiedzi.
>
> **Powiązany SSOT:** `docs/product/INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md`

## 1) Rola biblioteki

Biblioteka template'ów w V6 ma trzy funkcje:

1. dać gotowe, wysokiej jakości zestawy pytań dla najczęstszych diagnoz,
2. skrócić czas tworzenia nowych wysyłek,
3. zapewnić spójność w tym, **jakie dane i evidence zbieramy**.

Template nie jest tylko listą pytań.  
To jest **kontrakt wiedzy**, który definiuje:

- o co pytamy,
- kogo pytamy,
- jakiej odpowiedzi oczekujemy,
- jakie evidence warto dołączyć,
- jak potem czytamy te odpowiedzi w insightach.

---

## 2) Scope biblioteki

### 2.1 `System`

Template'y dostarczane z aplikacją.

MUST:

- być wersjonowane,
- mieć opis celu i respondentów,
- mieć zdefiniowaną expected duration,
- mieć zdefiniowane recommended answer modalities,
- mieć gotowe guidance dla insight engine.

### 2.2 `Organization`

Template'y współdzielone w jednej organizacji.

Use cases:

- branżowe warianty pytań,
- język klienta,
- własne standardy audytowe,
- pakiety onboardingowe.

### 2.3 `Private`

Template'y prywatne autora.

Use cases:

- eksperymentalne flow,
- prywatne przygotowanie do warsztatu,
- draft przed publikacją do organizacji.

---

## 3) Formaty wysyłek

Każdy template powinien należeć do jednego z trzech formatów:

### 3.1 `Pulse`

- 5–8 pytań
- 3–7 minut
- niski próg wejścia
- wysoka częstotliwość użycia

### 3.2 `Standard`

- 10–18 pytań
- 8–15 minut
- główny format discovery

### 3.3 `Deep Dive`

- 18–35 pytań
- 15–35 minut
- wymaga sekcji, evidence i zwykle kilku respondentów

Rule:

- system musi ostrzegać, jeśli template jest zbyt długi jak na deklarowany format.

---

## 4) Canonical template schema

Każdy template w bibliotece musi mieć:

- `slug`
- `name`
- `scope`
- `format`
- `goal`
- `best_for`
- `respondent_types[]`
- `estimated_time_minutes`
- `sections[]`
- `default_answer_modalities`
- `evidence_policy`
- `insight_focus`
- `question_quality_notes`

### 4.1 Canonical question metadata

Każde pytanie SHOULD definiować:

- `intent`
- `answer_type`
- `expected_answer_shape`
- `allow_voice`
- `allow_attachment`
- `allow_link`
- `allow_context_note`
- `evidence_prompt?`
- `common_mistakes?`

---

## 5) System library — canonical starter set

## 5.1 Quick Discovery Pack

### T01 — Quick Company Snapshot

- **Format:** Pulse
- **Goal:** szybki obraz firmy, celu rozmowy i głównego bólu
- **Best for:** pierwsza rozmowa, lead qualification, pre-diagnosis
- **Respondents:** owner, manager, sponsor
- **Sections:**
  - Context
  - Biggest pain
  - Current priorities
  - Constraints
- **Modalities:** short text, long text, voice
- **Evidence prompts:** link do strony, deck, notatka, org chart
- **Insight focus:** priorities, urgency, problem framing

### T02 — Leadership Alignment Pulse

- **Format:** Pulse
- **Goal:** sprawdzić zgodność zarządu / liderów co do celu, problemu i priorytetów
- **Best for:** start programu, steering alignment
- **Respondents:** leadership team
- **Sections:**
  - Objective
  - Current friction
  - Success definition
  - Risks
- **Modalities:** short text, rating, voice
- **Evidence prompts:** strategy note, board deck
- **Insight focus:** contradictions, alignment gaps, shared narrative

## 5.2 Strategy Pack

### T03 — Strategic Direction Discovery

- **Format:** Standard
- **Goal:** zrozumieć kierunek strategiczny, ambicje, bariery i luki wykonawcze
- **Best for:** sponsor interviews, strategy refresh
- **Respondents:** CEO, BU heads, transformation lead
- **Sections:**
  - Strategic goals
  - Value drivers
  - Current blockers
  - Decision bottlenecks
  - Risks and assumptions
- **Modalities:** long text, rating, voice
- **Evidence prompts:** strategic plan, KPI deck, market notes
- **Insight focus:** strategic ambiguity, blocked bets, value pools

### T04 — Operating Model Fit

- **Format:** Standard
- **Goal:** ocenić dopasowanie operating modelu do celów strategicznych
- **Best for:** TOM discovery, org redesign preparation
- **Respondents:** management, PMO, process owners
- **Sections:**
  - Current model
  - Governance
  - Decision rights
  - Hand-offs
  - Metrics
- **Modalities:** long text, single choice, voice
- **Evidence prompts:** RACI, org chart, governance decks
- **Insight focus:** org friction, missing ownership, governance debt

## 5.3 Operations Pack

### T05 — Operational Excellence Discovery

- **Format:** Standard
- **Goal:** znaleźć miejsca strat, opóźnień i chaosu operacyjnego
- **Best for:** ops review, plant/process discovery
- **Respondents:** operations leaders, supervisors, process owners
- **Sections:**
  - Core flow
  - Delays and rework
  - Exceptions
  - Visibility and escalation
  - Improvement ideas
- **Modalities:** long text, yes/no, number, voice
- **Evidence prompts:** SOP, KPI screenshots, examples of incidents
- **Insight focus:** bottlenecks, rework, systemic waste

### T06 — Process Pain Mapping

- **Format:** Standard
- **Goal:** zebrać granularne pain points po procesie end-to-end
- **Best for:** workflow redesign, automation discovery
- **Respondents:** frontline users, process owners
- **Sections:**
  - Process entry
  - Steps and handoffs
  - Pain points
  - Workarounds
  - Desired future state
- **Modalities:** long text, multi choice, voice, attachment
- **Evidence prompts:** screenshots, forms, examples, recordings
- **Insight focus:** pain clusters, workaround taxonomy, automation candidates

### T07 — Manufacturing Walkthrough

- **Format:** Deep Dive
- **Goal:** diagnoza hali / produkcji / gemba przez serię pytań i evidence
- **Best for:** plant discovery, operational audit
- **Respondents:** plant manager, shift leaders, quality, maintenance
- **Sections:**
  - Flow overview
  - Downtime and quality
  - Standards and training
  - Planning and changeovers
  - Escalations and safety
- **Modalities:** voice, number, long text, attachment
- **Evidence prompts:** line photos, OEE reports, SOP, checklists
- **Insight focus:** losses, standard work gaps, quality/system instability

## 5.4 Digital & Automation Pack

### T08 — Digital Landscape Discovery

- **Format:** Standard
- **Goal:** zmapować systemy, narzędzia i problemy integracyjne
- **Best for:** digital maturity baseline
- **Respondents:** IT, OT, ops, analytics
- **Sections:**
  - Systems in use
  - Integrations
  - Manual work
  - Reporting pain
  - Ownership
- **Modalities:** long text, dropdown, attachment, voice
- **Evidence prompts:** system map, architecture sketch, reports
- **Insight focus:** fragmented stack, integration debt, shadow systems

### T09 — Automation Readiness

- **Format:** Standard
- **Goal:** ocenić, które obszary są gotowe na AI/RPA/workflow automation
- **Best for:** automation pipeline intake
- **Respondents:** ops, back office, IT, finance
- **Sections:**
  - Repetitive work
  - Exceptions
  - Inputs and outputs
  - Rules and controls
  - Automation blockers
- **Modalities:** yes/no, number, voice, attachment
- **Evidence prompts:** sample files, forms, screenshots, SOP
- **Insight focus:** candidate scoring, rule complexity, exception burden

### T10 — Data & Reporting Maturity

- **Format:** Standard
- **Goal:** zbadać jakość danych, reporting burden i trust in numbers
- **Best for:** BI, analytics, controlling, PMO
- **Respondents:** data owners, analysts, managers
- **Sections:**
  - Key metrics
  - Source of truth
  - Data quality
  - Reporting effort
  - Missing visibility
- **Modalities:** long text, rating, number, attachment
- **Evidence prompts:** KPI reports, dashboards, exports, definitions
- **Insight focus:** metric distrust, reporting effort, data ownership gaps

## 5.5 Finance Pack

### T11 — Finance Baseline

- **Format:** Standard
- **Goal:** zebrać obraz finansowy i ograniczenia ekonomiczne programu
- **Best for:** sponsor alignment, benefit case prep
- **Respondents:** finance, controlling, sponsor
- **Sections:**
  - Financial baseline
  - Cost pressure
  - Margin dynamics
  - Investment constraints
  - Expected benefits
- **Modalities:** number, long text, attachment, voice
- **Evidence prompts:** P&L extracts, budget, forecast, management slides
- **Insight focus:** pressure zones, baseline credibility, benefit uncertainty

### T12 — Cost & Efficiency Review

- **Format:** Standard
- **Goal:** znaleźć koszty do redukcji i szybkie źródła efektywności
- **Best for:** cost programs, SG&A/operations reviews
- **Respondents:** finance + business owners
- **Sections:**
  - Cost drivers
  - Waste and duplication
  - Manual effort
  - Procurement / external spend
  - Quick wins
- **Modalities:** long text, number, voice, link
- **Evidence prompts:** spend reports, team structures, contract lists
- **Insight focus:** hidden cost drivers, no-owner spend, quick efficiency pockets

### T13 — Working Capital & Cash

- **Format:** Standard
- **Goal:** zrozumieć napięcia cashowe i procesy wpływające na working capital
- **Best for:** turnaround, cash focus
- **Respondents:** finance, procurement, operations, sales ops
- **Sections:**
  - Inventory
  - Receivables
  - Payables
  - Forecasting
  - Cash controls
- **Modalities:** number, long text, attachment
- **Evidence prompts:** aging, stock reports, forecast sheets
- **Insight focus:** cash leaks, forecasting friction, policy gaps

## 5.6 Customer & Commercial Pack

### T14 — Customer Experience Discovery

- **Format:** Standard
- **Goal:** uchwycić tarcia w customer journey i service delivery
- **Best for:** CX/service redesign
- **Respondents:** customer service, operations, sales, account teams
- **Sections:**
  - Journey stages
  - Complaints and delays
  - Internal handoffs
  - Customer signals
  - Improvement ideas
- **Modalities:** long text, rating, voice, link
- **Evidence prompts:** NPS/CSAT reports, complaints, recordings
- **Insight focus:** friction hotspots, journey breakdowns, unmet needs

### T15 — Commercial Pipeline & Forecast Discipline

- **Format:** Standard
- **Goal:** ocenić jakość pipeline managementu i forecastu
- **Best for:** sales ops, GTM improvement
- **Respondents:** sales leaders, account managers, finance
- **Sections:**
  - Pipeline hygiene
  - Forecasting
  - Deal blockers
  - Handoffs to delivery
  - Metrics discipline
- **Modalities:** long text, rating, number, attachment
- **Evidence prompts:** CRM screenshots, forecast files, review cadence docs
- **Insight focus:** forecast noise, pipeline blind spots, delivery misalignment

## 5.7 People, Change, Risk Pack

### T16 — Organization & Roles Clarity

- **Format:** Standard
- **Goal:** zbadać role, odpowiedzialność i decyzje
- **Best for:** org redesign, governance cleanup
- **Respondents:** managers, PMO, team leads
- **Sections:**
  - Roles
  - Decision rights
  - Escalations
  - Cross-team collaboration
  - Capability gaps
- **Modalities:** long text, single choice, voice
- **Evidence prompts:** org chart, RACI, escalation examples
- **Insight focus:** ownership ambiguity, decision latency, capability holes

### T17 — Change Readiness

- **Format:** Standard
- **Goal:** ocenić gotowość ludzi do zmiany i ryzyko oporu
- **Best for:** transformation prep, change program
- **Respondents:** leadership, middle management, selected teams
- **Sections:**
  - Awareness
  - Motivation
  - Fears and blockers
  - Capability and training
  - Communication quality
- **Modalities:** rating, long text, voice
- **Evidence prompts:** comms plans, training plans, examples of resistance
- **Insight focus:** adoption risk, missing comms, readiness pockets

### T18 — Quality, Compliance & Risk Signals

- **Format:** Standard
- **Goal:** wychwycić główne ryzyka operacyjne, jakościowe i compliance
- **Best for:** audit prep, risk review
- **Respondents:** quality, compliance, operations, management
- **Sections:**
  - Recurring incidents
  - Controls
  - Documentation gaps
  - Escalation and remediation
  - Near misses
- **Modalities:** yes/no, long text, attachment, voice
- **Evidence prompts:** audits, NCR/CAPA, policies, logs
- **Insight focus:** repeated control failures, undocumented work, hidden risks

---

## 6) Template quality rules

Każdy system template MUST:

- mieć max jedną główną intencję na pytanie,
- używać prostego języka,
- unikać pytań sugerujących odpowiedź,
- jasno wskazywać expected answer shape,
- wiedzieć, kiedy prosić o evidence,
- nie przekraczać deklarowanego czasu.

### 6.1 Suggested writing heuristics

- jedno pytanie = jeden temat
- pytania specyficzne zamiast ogólnych
- pytania otwarte tam, gdzie potrzebna narracja
- pytania zamknięte tam, gdzie potrzebna porównywalność
- evidence prompts tylko tam, gdzie realnie podnoszą jakość insightu

---

## 7) AI generation rules for template library

AI tworzące template MUST:

- dobierać format `Pulse / Standard / Deep Dive`,
- proponować sekcje przed pytaniami,
- szacować czas wypełnienia,
- dobierać answer type do intencji pytania,
- proponować `voice` dla pytań narracyjnych,
- proponować `attachment/link` dla pytań evidence-heavy,
- ostrzegać przed przeładowaniem template'u.

### 7.1 AI output pack

Minimalny draft AI SHOULD zwracać:

- `template_summary`
- `audience`
- `duration_estimate`
- `sections[]`
- `questions[]`
- `answer_modalities[]`
- `evidence_prompts[]`
- `quality_warnings[]`

---

## 8) Związek biblioteki z systemem wiedzy

Biblioteka template'ów musi zasilać knowledge collection system na dwa sposoby:

1. **Before send**
   - definiuje jakie evidence warto zbierać,
   - definiuje expected answer shape,
   - ustawia good prompts dla insight engine.

2. **After answers**
   - odpowiada za to, że dane są porównywalne,
   - ułatwia theme extraction,
   - ułatwia issue/opportunity clustering.

---

## 9) Roadmap biblioteki

### R0

- uruchomić 18 system templates z tego dokumentu,
- podzielić je na `Pulse / Standard / Deep Dive`,
- wdrożyć scopes `System / Organization / Private`.

### R1

- branżowe warianty template'ów,
- multilingual optimization,
- template benchmarking by completion rate,
- AI quality score dla template'ów.

### R2

- diagnostics packs,
- branching variants,
- aggregate template performance analytics.
