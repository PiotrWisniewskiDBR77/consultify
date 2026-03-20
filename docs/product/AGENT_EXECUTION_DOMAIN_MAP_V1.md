# Agent execution domain map v1

> Status: Draft v1
> Cel: Uporzadkowac znaczenie slowa `agent` w `consultify`, rozdzielic istniejace systemy i ustawic jeden poprawny punkt startu dla budowy agenta wykonujacego realna prace w aplikacji.

---

## 1. Po co istnieje ten dokument

W repo `consultify` slowo `agent` jest dzis uzywane dla kilku roznych rzeczy.
To tworzy ryzyko, ze dalsza architektura bedzie budowana na blednym fundamencie.

Przed projektowaniem agenta "w rozumieniu Replita lub Cursora", czyli systemu, ktory:
- rozumie cel,
- planuje kroki,
- wykonuje realne operacje w produkcie,
- proponuje i aplikuje zmiany,

musimy najpierw rozdzielic, co juz istnieje i czym to naprawde jest.

Ten dokument robi wlasnie to.

---

## 2. Decyzja nadrzedna

W `consultify` musimy od teraz rozrozniac cztery oddzielne domeny:

1. `Execution Agent`
2. `Audit Agents`
3. `Virtual Workers`
4. `User/Org RAG Management`

One nie sa tym samym produktem.
Nie powinny dzielic jednego SSOT tylko dlatego, ze kazda z tych rzeczy ma w nazwie slowo `agent`.

---

## 3. Canonical definitions

### 3.1 Execution Agent

To docelowy system, ktory:
- przyjmuje cel od usera,
- planuje sequence of work,
- proponuje konkretne zmiany w artefaktach,
- pokazuje preview / diff / consequences,
- po akceptacji wykonuje operacje,
- zapisuje audit trail.

Execution Agent jest bliski temu, co user ma na mysli mowiac:
- "agent jak Replit/Cursor",
- "agent ktory robi faktyczna prace",
- "agent ktory nie tylko odpowiada, ale wykonuje".

### 3.2 Audit Agents

To wyspecjalizowane role audytorskie uruchamiane wobec juz wygenerowanego materialu lub decyzji.

Ich rola:
- ocena ryzyk,
- quality gate,
- kontrarianskie sprawdzanie,
- wskazywanie brakow.

Ich rola nie jest:
- wykonywanie pracy,
- modyfikacja artefaktow,
- prowadzenie ogolnego execution workflow.

### 3.3 Virtual Workers

To konfigurowalne persony / branded assistants z profilem, promptem, powierzonym zakresem wiedzy i analytics.

Ich rola:
- obslugiwac konkretna surface lub use case,
- miec odrebna persone,
- korzystac z przypisanej wiedzy,
- byc administrowane jako odrebne "workers".

Virtual Worker nie jest automatycznie execution agentem.

### 3.4 User/Org RAG Management

To osobny system zarzadzania wiedza:
- co nalezy do usera,
- co nalezy do organizacji,
- jakie sa zrodla,
- kto ma dostep,
- jak retrieval jest scope'owany i governance'owany.

RAG management jest warstwa wiedzy i source governance.
Nie jest sam w sobie agentem.

---

## 4. Current repo mapping

### 4.1 Audit Agents

To jest realny, obecny system audit-agentow:

- `server/src/services/ai/agentAudit/agentRegistry.ts`
- `server/src/services/ai/agentAudit/orchestratorService.ts`
- `server/src/routes/ai/agent-audit.routes.ts`
- `docs/modules/ai/AGENT_AUDIT_LAYER.md`

Interpretation:
- to jest system audytu po `Deep Thinking`,
- agenci sa reprezentantami rol,
- system jest quality gate / review layer,
- system nie jest punktem startu dla execution agent.

### 4.2 Legacy / generic multi-agent orchestration

To jest szeroki, starszy runtime "multi-agent":

- `server/src/services/aiOrchestrator.ts`
- `server/src/routes/agents.routes.ts`
- `server/src/services/ai/agents/*`
- `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`

Interpretation:
- dokument `AI_AGENT_ORCHESTRATION_V3.md` jest nadal wartosciowy jako general operating model,
- ale runtime `ai/agents/*` wyglada dzis bardziej jak warstwa kompatybilnosci / migracji niz pewny canonical execution spine,
- ta warstwa nie powinna byc bezkrytycznie uznana za gotowy produkt `Execution Agent`.

### 4.3 Execution-style pattern already present

Najblizszy prawdziwemu execution agentowi istnieje w:

- `server/src/services/reportAgentService.ts`

Interpretation:
- ten serwis juz ma:
  - action parsing,
  - structured actions,
  - diff preview,
  - apply phase,
  - persistence of proposals,
- to jest najlepszy runtime wzorzec dla przyszlego execution agent.

### 4.4 Virtual Workers

To jest osobny system:

- `server/src/routes/virtual-workers.routes.ts`
- `server/src/services/ai/virtualWorkerService.ts`
- `server/src/services/ai/virtualWorkerKnowledgeService.ts`
- `server/migrations/737_virtual_workers.sql`

Interpretation:
- worker ma profile, prompt, knowledge assignments, conversations i insights,
- to jest osobny produkt/persona framework,
- nie nalezy go utozsamiac z execution agentem.

---

## 5. What is not the correct foundation for Execution Agent

### 5.1 Not `Agent Audit`

Powod:
- audit agents sa gatekeeperami,
- nie tworza i nie wykonuja zmian,
- nie zarzadzaja artefact mutation lifecycle.

### 5.2 Not `Virtual Workers`

Powod:
- virtual worker jest persona + surface + assigned knowledge,
- to framework workerow i asystentow,
- nie ma jeszcze kontraktu planowania i wykonywania pracy w artefaktach.

### 5.3 Not current `ai/agents/*` wrappers by themselves

Powod:
- aktualne pliki wygladaja jak lazy wrappers / compatibility layer,
- nie daja pewnosci, ze sa canonical live execution engine,
- nie powinny byc traktowane jako build-ready spine bez dodatkowej weryfikacji.

---

## 6. Correct foundation for Execution Agent

Execution Agent powinien byc budowany na styku czterech rzeczy:

### 6.1 Product operating model

Reference:
- `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`

What to reuse:
- agent jako workflow + steps,
- `purpose`-based model routing,
- budget / queue / degraded mode thinking,
- `propose -> accept` jako zasada nadrzedna.

### 6.2 Real mutation pattern

Reference:
- `server/src/services/reportAgentService.ts`

What to reuse:
- structured action contract,
- diff preview before apply,
- explicit `apply` phase,
- persisted message + proposal history.

### 6.3 Context / prompt / policy runtime

References:
- `server/src/services/ai/AIPipeline.ts`
- `docs/product/CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `docs/product/CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md`

What to reuse:
- context assembly,
- prompt governance,
- source honesty,
- approval semantics,
- privacy and mode handling.

### 6.4 Artifact system of Consultify

Execution Agent ma pracowac na prawdziwych artefaktach:
- reports,
- presentations,
- notes,
- tasks,
- decisions,
- tables,
- workspace objects.

To oznacza, ze execution agent nie jest tylko "chat feature".
To jest cross-artifact execution layer.

---

## 7. Boundary decision before further work

Before we design `Execution Agent`, we freeze these boundaries:

### 7.1 In scope for next stream

`Execution Agent` as:
- planner,
- proposer,
- approver-aware executor,
- artifact mutation engine,
- audit-traceable worker.

### 7.2 Out of scope for the next stream

The following are separate streams:
- audit-agent system,
- virtual worker platform,
- user/org RAG governance and assignment system,
- generic branded assistant strategy.

### 7.3 Shared but separate foundations

These systems may share:
- prompt governance,
- retrieval infrastructure,
- policy engine,
- usage logging,
- evaluation framework.

But they must not be collapsed into one product concept.

---

## 8. Design rules for upcoming Execution Agent work

### 8.1 One meaning of "agent" in the new package

In the upcoming execution-agent package, `agent` means only:
- system that can plan and execute work in the app.

If we refer to audit roles, use `audit agents`.
If we refer to persona workers, use `virtual workers`.
If we refer to retrieval governance, use `RAG management`.

### 8.2 Propose first, apply second

Execution Agent must not mutate canonical artifacts silently.
The canonical lifecycle is:

`understand -> plan -> propose -> preview -> approve -> apply -> audit`

### 8.3 Structured actions over vague chat magic

Execution Agent should not rely only on free-form prose.
It needs:
- typed actions,
- target artifact references,
- validation,
- previewable deltas,
- explicit apply semantics.

### 8.4 Auditability is mandatory

Every meaningful execution action should preserve:
- initiator,
- proposed changes,
- accepted changes,
- execution result,
- failure state if any.

### 8.5 RAG is dependency, not identity

Execution Agent will consume retrieval and knowledge context.
But RAG management is not the same thing as the execution agent product.

---

## 9. Recommended documentation split from this point

### 9.1 Execution Agent package

Recommended next canonical docs:
- `AGENT_EXECUTION_V1_SSOT.md`
- `AGENT_EXECUTION_V1_AS_IS.md`
- `AGENT_EXECUTION_V1_GAP_MATRIX.md`
- `AGENT_EXECUTION_V1_IMPLEMENTATION_PLAN.md`

### 9.2 RAG management package

Recommended separate docs:
- `RAG_GOVERNANCE_V1_SSOT.md`
- `RAG_GOVERNANCE_V1_AS_IS.md`
- `RAG_GOVERNANCE_V1_GAP_MATRIX.md`
- `RAG_GOVERNANCE_V1_IMPLEMENTATION_PLAN.md`

This split is not optional.
It is needed to avoid mixing:
- work execution,
- personas,
- review agents,
- and knowledge governance.

---

## 10. Final conclusion

The repo already contains useful pieces for the future execution agent.
But they are distributed across different systems with different meanings.

So the correct next move is not:
- "build on any file that says agent".

The correct next move is:
- freeze the vocabulary,
- separate the domains,
- take `AI_AGENT_ORCHESTRATION_V3.md` as operating inspiration,
- take `reportAgentService.ts` as the best current execution pattern,
- and design `Execution Agent` as a new, explicit product layer.

Related references:
- `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`
- `docs/modules/ai/AGENT_AUDIT_LAYER.md`
- `server/src/services/reportAgentService.ts`
- `server/src/services/ai/virtualWorkerService.ts`
- `server/src/services/ai/virtualWorkerKnowledgeService.ts`
