# AI agentic system — next phase v8

> Status: Draft v8  
> Owner: Product + Engineering  
> Cel: jeden spójny opis **dalszego rozwoju** całego układu agentowego (execution, multi-agent, multi-LLM, virtual workers, governance, ops), zsynchronizowany z istniejącymi planami — bez zastępowania SSOT poszczególnych pakietów.

---

## 1. Jak czytać ten dokument

Ten plik **nie** zastępuje:

- `AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md` (szczegóły workstreamów execution),
- `AGENT_AND_KNOWLEDGE_V8_MASTER_PLAN.md` (execution + knowledge jako jeden program),
- `MULTI_LLM_AND_MULTI_AGENT_READINESS_AUDIT_V8.md` (werdykt i scorecard),
- `VIRTUAL_WORKERS_SUPERADMIN_*` (control plane workerów).

Ten plik **scala** je w **jedną kolejkę faz i zależności**, zgodnie z:

- sekwencją strategiczną z `AGENT_EXECUTION_V8_GAP_MATRIX.md` (najpierw model, potem proposal/approval, potem adaptery),
- falami delivery z `AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md` §6–7,
- trzema falami hardeningu z `MULTI_LLM_AND_MULTI_AGENT_READINESS_AUDIT_V8.md` §10,
- zasadą przeglądu z `SYSTEMATYKA_PRZEGLADU_V8.md` §6 (najpierw domykać braki blokujące „spine”, potem dokumentację słabszych gałęzi produktu).

---

## 2. North star (bez zmiany definicji)

Docelowy kształt pozostaje zgodny z `AGENT_EXECUTION_V8_SSOT.md` i `AGENT_AND_KNOWLEDGE_V8_MASTER_PLAN.md`:

`chat intake -> execution run -> governed plan/proposals -> approval/HITL -> module adapters -> audit -> (optional) multi-agent branches -> retrieval/working memory under policy`

Granice domen z `AGENT_EXECUTION_DOMAIN_MAP_V8.md` pozostają zamrożone: Virtual Workers ≠ Execution Agent ≠ Multi-Agent engine jako substitute.

---

## 3. Fazy programu (zsynchronizowane z planami)

Poniższe fazy numerują **program wdrożeniowy**, nie pojedynczy sprint. W jednej fazie mogą pracować równolegle zespoły backend / product / superadmin, o ile respektują zależności.

### Faza A — Runtime spine execution (Execution plan: Wave 1 + początek Wave 2)

**Wejścia:** `AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md` §5.1–5.3, §6 Wave 1.

**Cel:** jeden trwały byt runu i jeden kontrakt proposal/approval na poziomie danych i serwisu.

| Pakiet prac | Odniesienie | Wynik (definition of ready) |
| --- | --- | --- |
| A1 — domena runu | Workstream A | `ExecutionAgentRun`, plan/krok, statusy cyklu życia, rozdzielenie fazy propose vs approve vs execute |
| A2 — proposal spine | Workstream B | wspólny schemat proposal, stany approval, ścieżki refine/reject; migracja świadoma z `ai_actions` / modułów |
| A3 — orchestrator (szkielet) | Workstream C | tworzenie runu z intake czatu, kolejka kroków, widoczny partial progress, brak „cichego apply” |

**Blokery:** bez A1–A2 nie wolno rozszerzać autonomii narzędzi ani multi-agent w produkcji (zgodnie z `AGENT_EXECUTION_V8_GAP_MATRIX.md` i `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md`).

**Równolegle (minimalny zakres):** spięcie z `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` — handshake kontekstu workspace/project/artifact dla runu (gap P0 z macierzy).

---

### Faza B — Adaptery i pierwszy dowód cross-artifact (Execution plan: Wave 2)

**Wejścia:** §5.4, §6 Wave 2, §7 kroki 5–6.

**Cel:** `orchestrator -> adapter -> owning service` na wybranych artefaktach o najsilniejszym as-is (`AGENT_EXECUTION_V8_AS_IS.md`).

| Kolejność sugerowana | Artefakt | Uzasadnienie |
| --- | --- | --- |
| B1 | Report | Najbliższy wzorzec `reportAgentService` |
| B2 | Task / Initiative / Decision | Powiązanie z workflow canon |
| B3 | Table, Notebook | Istniejące proposal cards — mapowanie na wspólny kontrakt |

**Wyjście fazy:** jeden run może adresować więcej niż jeden typ artefaktu przez wspólny interfejs adaptera; audit runu obejmuje powiązanie proposal → wykonanie.

---

### Faza C — Governance, narzędzia, HITL operacyjnie (Execution plan: Wave 3 + security/HITL)

**Wejścia:** §5.5, `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md`, `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md`, `MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md`.

**Cel:** jedna ścieżka decyzji dla narzędzi i mutacji; audyt rozróżnia human vs policy; MCP `REQUIRES_APPROVAL` mapuje się na ten sam kręgosłup co execution (luka P1 z macierzy — tutaj domykana przed szerokim MCP).

| Pakiet | Wynik |
| --- | --- |
| C1 — execution policy layer | role, gate workflow, taksonomia ryzyka, komunikaty blokady |
| C2 — tool catalog + pipeline | manifest narzędzia, consumer class, allow/deny, trace powodu |
| C3 — HITL | batch approval wg reguł ryzyka, stany expired/escalated, odrębny zapis policy-approved vs human-approved |

**Blokery dla autonomii:** C1–C2 przed „szerokim” tool-calling i subagentami z mutacjami.

---

### Faza D — Multi-LLM intelligence layer (Readiness audit: Wave 1)

**Wejścia:** `MULTI_LLM_AND_MULTI_AGENT_READINESS_AUDIT_V8.md` §10 Wave 1, `AI_LLM_MODEL_MANAGEMENT_V8.md` §2.1–3.

**Cel:** runtime doboru profilu wykonania nie redukowany do `tier`.

| Komponent | Rola |
| --- | --- |
| `ExecutionProfileResolver` | Łączy purpose, politykę org, budżet, kontekst, fallback |
| `TaskShapeClassifier` | Drugi wymiar obok purpose (kształt zadania) |
| `ReasoningEffortPolicy` | Osobno od wyboru modelu (LOW/MEDIUM/HIGH effort) |

**Zależność:** stabilny kontrakt „co jest zadaniem” z Fazy A (run/step) ułatwia klasyfikację kształtu.

---

### Faza E — Multi-Agent Work Manager (Readiness audit: Wave 2 + `AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md` §13)

**Wejścia:** §13.2–13.5 (pierwszy slice: 1 lead, 2–3 subagenty, read-heavy, jedna synteza, jedna powierzchnia approval).

**Cel:** kanoniczny komponent `MultiAgentWorkManager` jako właściciel grafu zadań, budżetów gałęzi, merge/cancel/retry — **dopiero po** działającym runie i proposal spine (Faza A).

**Nie w scope pierwszego slice:** peer-to-peer subagentów, swobodna komunikacja między agentami.

---

### Faza F — AI ops, release, eval jako pętla (Readiness audit: Wave 3 + `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`)

**Wejścia:** `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §4, `AI_LLM_MODEL_MANAGEMENT_V8.md` (release bundles, brakujący canary controller w macierzy 2.1).

**Cel:**

- `AIReleaseBundle` jako jednostka zmiany (model + prompt + policy + workload refs gdzie dotyczy),
- bramki eval (jakości, trust, latency, koszt, failure rate),
- canary + rollback + ślad dla supportu (który bundle, czy canary, czy rollback).

**Virtual Workers:** zgodnie z `VIRTUAL_WORKERS_SUPERADMIN_CONTROL_PLANE_V8.md` — warstwy Evals, Rollout and Audit oraz powiązanie insight → zmiana profilu → eval → rollout.

---

### Faza G — Observability, UX jednolite, eval execution-agent (Execution plan: Wave 4 + Workstream F/G)

**Wejścia:** §5.6–5.7, §6 Wave 4.

**Cel:** timeline runu, diagnostyka support, wspólne UI stanów w czacie; pakiet ewaluacji execution-agent (macierz: P2 jako „przed wzrostem autonomii” — tutaj jako faza po zamknięciu spine).

**Uzupełnienie multi-LLM:** support/admin surface dla `routingTrace` (`AI_LLM_MODEL_MANAGEMENT_V8.md` — partial).

---

## 4. Mapowanie na `SYSTEMATYKA_PRZEGLADU_V8.md`

Wiersz **Chat → Multi-LLM i multi-agent gotowość całości** (§3 tabeli): brakujący „runtime spine” zastępuje się konkretnym programem Fazy **A, D, E**, przy czym dokumentacja innych gałęzi (Landing, MyWork, …) nadal postępuje według §5–6 systematyki **osobno** — ten program nie zwalnia z domykania słabych pakietów produktowych, ale **priorytetyzuje** inżynierię AI core zgodnie z §4.1 systematyki (Chat / AI core / Execution jako najmocniejszy filar).

---

## 5. Zasady anty-regresji (skrót z execution plan §8–10)

- Brak nowych lokalnych systemów proposal-only bez implementacji wspólnego kontraktu.
- Mutacje canonical artifacts wyłącznie: orchestrator → adapter → owning service.
- Zatwierdzenie ≠ wykonanie, chyba że jawnie policy + audyt.
- Multi-agent i narzędzia nie obchodzą governance — tylko węższy scope i ślad.

---

## 6. Minimalna lista kontrolna „go / no-go” przed zwiększeniem autonomii

1. Run + proposal + approval jako jeden model danych (Faza A).  
2. Permission/gate jako warstwa execution-native (Faza C1).  
3. Narzędzia podpisane ryzykiem i consumer class z audytem deny/allow (Faza C2).  
4. Background/job model dla długich runów (zgodnie z `AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md` + expectation z `AGENT_EXECUTION_V8_SSOT.md`).  
5. Dla multi-agent: `MultiAgentWorkManager` + pierwszy read-heavy slice (Faza E).  
6. Dla zmian modeli/promptów routingu: bundle + eval gate + rollback path (Faza F).

---

## 7. Powiązane dokumenty (read order dla tej fazy)

1. `AGENT_AND_KNOWLEDGE_V8_MASTER_PLAN.md`  
2. `AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md`  
3. `AGENT_EXECUTION_V8_GAP_MATRIX.md`  
4. `MULTI_LLM_AND_MULTI_AGENT_READINESS_AUDIT_V8.md`  
5. `AI_LLM_MODEL_MANAGEMENT_V8.md`  
6. `AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`  
7. `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md`  
8. `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md`  
9. `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`  
10. `VIRTUAL_WORKERS_SUPERADMIN_IMPLEMENTATION_PLAN_V8.md`  
11. `SYSTEMATYKA_PRZEGLADU_V8.md`  

---

## 8. Historia zmian

- 2026-03-22: Utworzenie dokumentu — scalenie fal execution implementation plan, readiness audit i systematyki przeglądu w jeden program następnej fazy.
