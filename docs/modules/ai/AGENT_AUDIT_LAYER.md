# Agent Audit Layer (Post-DeepThinking) — Specyfikacja

> **Status:** DRAFT v0.1  
> **Wersja:** IRIS 6.0 / Enterprise MVP  
> **Ostatnia aktualizacja:** 2026-02-06  
> **Cel:** Warstwa agentów-audytorów uruchamiana po „Deep Thinking CLOSED”, która nadaje status jakości i generuje ukierunkowane pętle uzupełnień.

---

## 1. Jedno zdanie, które ustawia wszystko zespołowi

**Agenci nie są ekspertami od rozwiązań. Są reprezentantami ról, które w realnej firmie powiedzą „tak”, „nie” albo „jeszcze nie”.**

---

## 2. Scope / Non-scope

### Scope (w zakresie)

- **Context Scan**: rozpoznanie kontekstu decyzji (branża/funkcje/ryzyka/horyzont).
- **Suggested Agents Set (pre-DT)**: propozycja agentów + manual approval (użytkownik może edytować).
- **Post-DT Reviews**: uruchomienie agentów równolegle po zakończeniu Deep Thinking.
- **Walidacja outputów agentów**: format, spójność, gate overreach (konfabulacje).
- **Agregacja**: deduplikacja ryzyk/braków, detekcja konfliktów.
- **Quality Status**: `PASS` / `PASS_WITH_RISKS` / `FAIL`.
- **Directed Deepening Loop**: powrót do Deep Thinking z listą braków (max 2 iteracje).

### Non-scope (poza zakresem)

- Orchestrator **nie tworzy rekomendacji** i **nie pisze raportu**.
- Agenci **nie ingerują w proces myślenia** i **nie modyfikują raportu Deep Thinking**.
- Orchestrator **nie rozstrzyga sporów merytorycznych** — wykrywa konflikt, ocenia ryzyko i eskaluje do pętli uzupełnień.

---

## 3. Glossary

- **DT**: Deep Thinking report (zamknięty output).
- **Agent review**: audyt DT z perspektywy roli/branży.
- **Directed deepening**: uzupełnienie DT o konkretne braki (nie „myśl dalej”).
- **Overreach**: roszczenia faktów/cytowań bez podstawy w dostarczonym kontekście.

---

## 4. Finalna matryca agentów (Industry × Functional)

### 4.1 Agenci branżowi (Industry / Vertical)

Odpowiadają na pytanie: **„czy to zadziała w tej branży?”**

Core:

- `industry.manufacturing` — Produkcja
- `industry.logistics_vertical` — Logistyka (branża: transport/warehouse/3PL)
- `industry.real_estate` — Nieruchomości / Facilities
- `industry.energy_utilities` — Energia / Utilities
- `industry.services_field` — Usługi (field / professional services)

> Kolejne branże można dokładać bez zmiany architektury (tylko konfiguracja + KB).

### 4.2 Agenci funkcjonalni (Function / Process-based)

Odpowiadają na pytanie: **„czy to przejdzie przez tę funkcję/proces w firmie?”**

Strategia / własność:

- `function.owner` — Owner / Founder
- `function.ceo` — CEO

Finanse i zakupy:

- `function.cfo_finance` — CFO / Finanse
- `function.procurement` — Zakupy / Procurement

Ludzie i organizacja:

- `function.hr` — HR
- `function.pm_project_management` — PM / Project Management

Technologia i rozwój:

- `function.cto_architecture` — CTO / Architecture
- `function.it_security` — IT / Security
- `function.rd` — R&D

Operacje:

- `function.plant_manager` — Plant Manager
- `function.maintenance_ur` — UR / Maintenance
- `function.logistics_function` — Logistyka (funkcjonalna)

> **Uwaga:** `industry.logistics_vertical` ≠ `function.logistics_function` (branża vs proces wewnętrzny).

### 4.3 Agent kontrariański (Adversarial)

Odpowiada na pytanie: **„co tu jest nieweryfikowalne / zbyt pewne / bez kryteriów falsyfikacji?”**

- `function.adversarial`

---

## 5. Orchestrator — specyfikacja

### 5.1 ID

- `agent.orchestrator`

### 5.2 Rola

**Dyrygent procesu decyzyjnego, strażnik jakości.**  
Nie tworzy rozwiązań. Zarządza przepływem, doborem agentów i pętlą pogłębiania.

### 5.3 Cele

- Dobrać właściwy zestaw agentów do tematu.
- Uruchomić ich we właściwym momencie (**po Deep Thinking CLOSED**).
- Skonsolidować wyniki i nadać status jakości.
- Wymusić ukierunkowane pogłębienie, jeśli są braki lub ryzyka krytyczne.

### 5.4 Wejścia (Input)

- `DecisionContext` (temat, branża, ryzyko, horyzont).
- `DeepThinkingReport` (zamknięty).
- `UserIntent`: `validate` / `stress_test` / `approve`.

### 5.5 Wyjścia (Output)

- `SuggestedAgentsSet` (pre-DT).
- `AgentReviewSummary` (post-DT).
- `QualityStatus`: `PASS` / `PASS_WITH_RISKS` / `FAIL`.
- `ActionableFollowups` (konkretne braki do uzupełnienia).
- `DirectedDeepeningLoop` (max 2).

---

## 6. Reguły doboru agentów (ostateczne)

### 6.1 Reguła nadrzędna (default)

- **1 agent BRANŻOWY + 2 agenci FUNKCJONALNI**
- Limit: **2–4 agentów** (anty-chaos)

### 6.2 Heurystyki doboru (twarde)

- Zawsze: **1 agent branżowy** (jeśli domena znana).
- Zawsze: **1 agent funkcjonalny high-risk**: `function.cfo_finance` (lub „risk” jeśli kiedyś wydzielimy).
- Często: **1 agent kontrariański** (`function.adversarial`) przy:
  - wysokiej stawce (bet-the-company),
  - niskiej jakości DT (PASS_WITH_RISKS/FAIL),
  - tematach o dużej złożoności i wielu założeniach.

### 6.3 Przykładowe mapowania (referencyjne)

- **Problem ludzi / absencji / rotacji**
  - branżowy: `industry.manufacturing` lub `industry.services_field`
  - funkcjonalni: `function.hr` + `function.plant_manager`
  - opcjonalnie: `function.owner` jeśli bet-the-company

- **Automatyzacja / robot / technologia**
  - branżowy: `industry.manufacturing` lub `industry.logistics_vertical`
  - funkcjonalni: `function.maintenance_ur` + `function.cfo_finance`
  - opcjonalnie: `function.it_security` jeśli integracje

- **Projekt / transformacja / rollout**
  - branżowy: wg domeny
  - funkcjonalni: `function.pm_project_management` + `function.ceo`
  - opcjonalnie: `function.cfo_finance` przy CAPEX

- **Nowy produkt / innowacja**
  - branżowy: `industry.services_field` lub `industry.manufacturing`
  - funkcjonalni: `function.rd` + `function.cto_architecture`
  - opcjonalnie: `function.ceo` jeśli strategiczne

- **Nieruchomości / infrastruktura**
  - branżowy: `industry.real_estate` lub `industry.energy_utilities`
  - funkcjonalni: `function.cfo_finance` + `function.it_security`
  - opcjonalnie: `function.plant_manager` jeśli zakład

---

## 7. Flow całego systemu (text-based)

```
[User starts topic]
        |
        v
[Orchestrator: Context Scan]
        |
        v
[Suggest Agents Set] ----> [User approves / edits]
        |
        v
[Deep Thinking Session]
  - framing
  - options
  - trade-offs
  - assumptions
  - closure
        |
        v
[Deep Thinking CLOSED]
        |
        v
[Orchestrator triggers Agents]
        |
        v
+-----------------------------+
| Parallel Specialist Reviews |
|  - Industry Agent           |
|  - Functional Agent         |
|  - Adversarial (optional)   |
+-----------------------------+
        |
        v
[Agent Outputs Validated]
        |
        v
[Orchestrator Aggregation]
  - deduplicate risks
  - detect conflicts
  - assess severity
        |
        v
[Quality Status]
  PASS | PASS WITH RISKS | FAIL
        |
        +-----------------------------+
        |                             |
        v                             v
 [Decision Ready]          [Directed Deepening Loop]
                                   |
                                   v
                           [Deep Thinking Update]
                                   |
                                   v
                             (max 2 loops)
```

**Zasada kluczowa:** Agenci nigdy nie ingerują w sam proces myślenia — tylko audytują wynik.

---

## 8. Kontrakty danych (deterministyczne)

> Zasada: Orchestrator i agenci muszą mówić wspólnym, sztywnym formatem. Brak formatu = brak automatycznej agregacji/gate’ów.

### 8.1 SuggestedAgentsSet (pre-DT)

- `orchestratorRunId: string`
- `decisionContext: { industry?: string; functions: string[]; horizon?: string; riskFocus?: string[] }`
- `agents[]: { agentId; type; whySelected; expectedFindings[]; priority }`
- `constraints: { maxAgents: 2|3|4; requireManualApproval: true }`

### 8.2 AgentReview (post-DT)

- `agentId: string`
- `verdict: "ok" | "risk" | "blocker"`
- `overreach: "none" | "suspected" | "hard"` (Gate D)
- `findings[]`:
  - `area: string` (kanoniczne `riskArea`)
  - `severity: "low" | "medium" | "high"`
  - `claim: string`
  - `evidenceFromDT: string[]` (cytaty/sekcje z DT)
  - `missingDataQuestions: string[]`
  - `suggestedDeepening: string` (jedno ukierunkowane uzupełnienie)
- `conflicts[]: { withAgentId; aboutArea; conflictStatement }`

### 8.3 OrchestratorVerdict

- `qualityStatus: "PASS" | "PASS_WITH_RISKS" | "FAIL"`
- `gatesTriggered: ("A"|"B"|"C"|"D")[]`
- `criticalRisks` (tylko `severity=high`)
- `actionableFollowups[]`:
  - `owner: "user" | "deep_thinking"`
  - `question: string`
  - `whyCritical: string`
- `directedLoop: null | { iteration: 1|2; deepThinkingPrompt: string }`

---

## 9. Bramki jakości (Quality Gates)

Gate A — **Critical Risk**

- 1× `severity=high` w obszarze finansowym (`cashflow`/`capex`) od agenta CFO/Risk ⇒ `FAIL`.

Gate B — **Consensus Risk**

- 2× `severity=high` w tym samym znormalizowanym `riskArea` od różnych agentów ⇒ `FAIL`.

Gate C — **Missing Must-have Data**

- brak must-have danych (zdefiniowanych przez reguły) ⇒ `FAIL` (lub `PASS_WITH_RISKS` zależnie od `UserIntent`).

Gate D — **Overreach**

- `overreach=hard` ⇒ output agenta odrzucony (nie wchodzi do konsensusu / Gate B).

---

## 10. Directed Deepening Loop (max 2)

Orchestrator wraca do Deep Thinking z listą **konkretnych braków**:

- brakujące dane wejściowe,
- brakujące sekcje/elementy (np. boundary conditions),
- brakujące kryteria falsyfikacji,
- brakujące alternatywy/trade-offy.

Zabronione: ogólne „go deeper / myśl dalej” bez wskazania braków.

---

## 11. Knowledge Base (KB) dla agentów — zasady

### 11.1 KB jako playbook audytowy (nie encyklopedia)

Agenci mają działać stabilnie i tanio. KB to:

- checklisty,
- heurystyki,
- typowe failure modes,
- pytania must-have.

### 11.2 Warstwy KB

- **KB-1 Foundational (wspólna):** definicje KPI, podstawy ROI/MTBF/OTIF, governance.
- **KB-2 Role Playbook (per funkcja):** „jak ta rola mówi NIE”, braki danych, ryzyka.
- **KB-3 Industry Constraints (per branża):** realia domeny + typowe pułapki wdrożeń.
- **KB-4 Organization-specific (per klient):** procesy, KPI history, stack, vendorzy, ograniczenia.

### 11.3 Retrieval (guideline)

- 3–8 snippetów KB + pełny DT report (DT ma najwyższy priorytet).
- Każdy snippet musi mieć metadane źródła (dla compliance / audytu).

---

## 12. Testing (minimum)

- Unit: mapping problem → agent set (golden cases).
- Contract: AgentReview JSON (schema) + zakaz linków i overreach.
- Integration: DT CLOSED → reviews → verdict → directed loop (max 2).

---

## 13. Security / Compliance

- Agenci **nie cytują internetu** i nie używają linków w outputach.
- Evidence MUST pochodzić z DT lub jawnych dokumentów wewnętrznych z metadanymi źródła.
