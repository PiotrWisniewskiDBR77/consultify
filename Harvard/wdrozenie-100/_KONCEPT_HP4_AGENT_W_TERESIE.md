# KONCEPT HP-4/HP-5 — „Uruchom agenta z Teresy" (tryb Plan)

> Sesja PROJEKTOWA (decyzja Piotra #3). Wynik = koncept, NIE kod. Podstawa: `_PLAN_HARVEY_PARITY_2026-07-11.md`
> (P-H1: agenci = TRYB Teresy, nie osobny byt). Rama: AUDYT, NIE GREENFIELD — poniżej najpierw „co JUŻ istnieje", potem „co dobudować".

## 0. Kluczowe ustalenie zwiadu — silniki ISTNIEJĄ, są OSIEROCONE i ROZDROBNIONE

Plan-mode NIE jest greenfieldem. W repo (worktree `wt-integrate-f6`) żyją **cztery** równoległe silniki agentowe — problem to fragmentacja i brak wpięcia, nie brak kodu:

| Silnik | Plik | Co robi | Stan wpięcia |
|---|---|---|---|
| **agentPlannerService** | `server/src/services/ai/agentPlannerService.ts` (405 l.) | Pełna pętla plan→execute→observe: persystencja `ai_agent_plans`/`ai_agent_plan_steps` (migracja **672 istnieje**), statusy `planning→awaiting_approval→executing→paused→completed/failed/cancelled`, per-step approval dla `SIDE_EFFECT_TOOLS`, SSE emitter, tło | **Osierocony** — wpięty TYLKO do `aiWorker.ts` (background), zero UI/route synchronicznego |
| **wave8AgentRuntimeService** | `server/src/services/wave8AgentRuntimeService.ts` (1003 l.) | Definicje agentów **edytowalne** (role, persona, allowedTools/blockedTools, `approvalPolicy: none\|tool_scope\|airun_required\|budget_gate`, costClass, riskLevel) + gating + runs/schedules/notifications | Zamontowany `/api/ai-agents` (Gateway:851), ale **wykonanie kroków = STUB** (`outputForAgent` canned) |
| **toolChainExecutor** | `server/src/services/ai/toolChainExecutor.ts` (197 l.) | DAG kroków z zależnościami + interpolacja `$step.X.pole` (wyjście→wejście), równoległość, approval | **Całkowicie osierocony** (0 callerów) |
| **agentRuntime (HP-2)** | `server/src/services/ai/agentRuntime/*` | Generyczny runtime plan→adapt→interact→validate→aggregate — ale to **fan-out RECENZENTÓW** (N agentów ocenia→werdykt), nie sekwencyjne zadanie | Używany przez `agentAudit/orchestratorService` |
| decisionAuditService | `server/src/services/ai/decisionAuditService.ts` (280 l.) | Ślad decyzji stage-by-stage (`logStage`, `getAuditTrail`, `exportForCompliance` PDF/JSON), tabela `ai_decision_audit_log` | Zbudowany dla Deep Thinking, gotowy do reużycia |
| Katalog manifestów | `agentRuntime/discoveryAgentManifestCatalog.ts` + `/api/ai/agent-manifests` | 31 Discovery Tools jako metadane (kroki/źródła/wyjścia), read-only | Wpięty, read-only |

**Rekomendacja architektoniczna (rozstrzygnięcie fragmentacji):**
`agentPlannerService` = **kanoniczny KRĘGOSŁUP wykonania**. `wave8` = **warstwa DEFINICJI + gate** (jego `approvalPolicy`/`allowedTools` podłączamy do plannera; jego stubowego `outputForAgent` NIE używamy jako executor). `toolChainExecutor` = opcjonalny tryb kroków zależnych (DAG). `agentRuntime` HP-2 = użyty tylko dla kroków typu „panel recenzentów". Jeden executor, nie cztery.

---

## 1. Semantyka wykonania

**Cykl (5 faz, spójny z Harvey/Copilot plan-mode):**

1. **Intencja** — czat Teresy wykrywa, że wiadomość to wieloetapowe zlecenie (playbook / discovery / analiza), a nie zwykłe pytanie. Lekki klasyfikator (heurystyka + tani model), NIE zmiana w rdzeniu pipeline'u.
2. **Plan** — `PlanBuilder` (nowy, cienki) woła LLM z listą dostępnych narzędzi/manifestów → zwraca **listę kroków** `{toolName, toolInput, rationale}`. Zapis przez istniejące `agentPlannerService.createPlan` (status `planning`).
3. **Potwierdzenie** — plan renderowany w **panelu po prawej** (podgląd przed wykonaniem). User może: edytować argument kroku, usunąć/przestawić krok, odrzucić całość. Dopiero „Uruchom" przełącza status na `executing`.
4. **Wykonanie kroków** — `agentPlannerService.executePlan(planId, executor, sseEmitter)`. **Krok = jedno wywołanie istniejącego narzędzia** przez `executeToolCall` (rejestr `toolDefinitions.ts`) — czyli realny silnik (raport/inicjatywa/discovery/query), NIE nowy byt. Kroki mutujące (`SIDE_EFFECT_TOOLS`) zatrzymują się na `awaiting_approval` → checkpoint → user zatwierdza (`approveStep`) → dalej.
5. **Raport** — po `completed` karta podsumowania wraca do czatu (co zrobiono, artefakty, czas, koszt). Ślad pełny w audit-trail.

**Gdzie żyje stan:** tabele `ai_agent_plans` + `ai_agent_plan_steps` (migracja 672 — już jest; org/user/conversation-scoped). Nic w pamięci procesu → przetrwa restart, umożliwia tryb tła i wznowienie.

**Błąd kroku:** planner dziś = **fail-fast** (status `failed`, zatrzymanie, raport co się udało do momentu błędu). Alternatywa continue-on-error → pytanie do Piotra (Q1).

**Limity (twarde, w konfiguracji flagi):** max kroków na plan (proponuję 12); timeout per krok (np. 90 s) i całościowy (np. 10 min); budżet tokenów/kosztu przez istniejący `ai_run_ledger` + `approvalPolicy: budget_gate` z wave8. Przekroczenie → `paused` z powodem, nie ciche ucięcie.

**Przerwanie przez użytkownika:** `agentPlannerService.cancelPlan` (istnieje) → status `cancelled`, kroki `pending/awaiting_approval` → `skipped`. Przycisk „Zatrzymaj" w panelu po prawej.

---

## 2. Architektura wpięcia BEZ dotykania 9000-liniowego pipeline

**Zasada: czat tylko WYKRYWA i LINKUJE. Wykonanie żyje w osobnym serwisie/route.**

- **Nowy router `/api/ai/agent-plan`** (osobny plik, obok `ai.routes.ts`, ~150 l.): `POST /` (buduje plan), `GET /:id`, `POST /:id/approve-step`, `POST /:id/cancel`, `GET /:id/stream` (własny SSE). Zero dopisywania do 9294-liniowego `ai.routes.ts`.
- **Minimalna zmiana w czacie (1 miejsce):** po zbudowaniu odpowiedzi, jeśli klasyfikator zwrócił `intent=plan`, dołącz do strumienia lekki event `plan_available` (id + tytuł). Wykorzystujemy **istniejący wzorzec** `TeresaProposalCard.tsx` + endpoint `/chat/confirm` (linia 1186 — pattern propozycja→potwierdź JUŻ w kodzie). Czat nie wykonuje planu, tylko pokazuje link „Zobacz plan →".
- **Serwis-orkiestrator planu** spina: `PlanBuilder` (nowy) → `agentPlannerService` (istnieje) → `executeToolCall` (istnieje) → `decisionAuditService` (istnieje). Cienka warstwa kleju, nie nowy silnik.
- **UI — panel planu PO PRAWEJ** (doktryna „panel-Teresy-zawsze-po-prawej", #56): nowy `AgentPlanPanel` dokowany po prawej, wg powłoki `ArtifactRightPanel` (accordion, tokeny `c-*`, fokus `c-focus`, zero crimson poza semantyką krytyczną). Sekcje: Plan (lista kroków edytowalna) · Postęp (pasek + per-step status) · Aprobaty (checkpointy) · Raport. Zgodny ze SPEC-A/`consultify-artefakty`.

Efekt: rdzeń czatu dostaje ~1 wstawkę (detekcja intencji + event), całość Plan-mode jest odseparowana i można ją trzymać za flagą.

---

## 3. Bezpieczeństwo

- **Org-scope:** każde zapytanie plannera już nosi `organizationId` (i `userId`). Executor (`executeToolCall`) wołany z kontekstem `{organizationId, userId}` — narzędzia dziedziczą istniejący org-gate. SSE strumień weryfikuje właściciela planu.
- **Capability-gate per krok:** przed wykonaniem kroku sprawdzamy (a) `betaAccess`/capability użytkownika dla danego narzędzia, (b) **`approvalPolicy` z wave8** (`validateApprovalPolicy`/`validateToolScope` — istnieją): `tool_scope` = narzędzie musi być w `allowedTools` agenta; `airun_required` = ważny wpis w `ai_run_ledger`; `budget_gate` = w budżecie. Krok bez uprawnień → `blocked`, nie wykonany.
- **Aprobata przed krokami mutującymi:** `SIDE_EFFECT_TOOLS` (create_initiative_draft, generate_report_section, schedule_meeting, create_notebook_entry, query_structured_data) już wymuszają `requiresApproval` → `awaiting_approval` → jawny klik użytkownika. Zero cichej mutacji danych klienta.
- **Audit-trail:** reużyć **`decisionAuditService`** (osierocony poza Deep Thinking) — rozszerzyć `AuditStage` o etapy planu (`plan_built`, `step_approved`, `step_executed`, `step_failed`, `plan_completed`), zapis do istniejącej `ai_decision_audit_log`, eksport compliance (PDF/JSON) już gotowy. To zasila też HP-12 (ślad decyzji agentów w Command Center).

---

## 4. Plan floty (Sonnet, ≤1 dzień/zadanie, flagi OFF)

Wszystko za flagą `ff_agent_plan` (default OFF) do akceptu Piotra na zrzutach. Świeża gałąź per krok z `origin/demo`, commit-per-krok, NIE push.

| # | Zadanie | Pliki | Reuse osieroconego | Kryterium odbioru |
|---|---|---|---|---|
| **F1** | `PlanBuilder` — LLM planner: intencja + manifesty → lista kroków `{toolName,toolInput}` | nowy `server/src/services/ai/agentPlan/planBuilderService.ts` | `discoveryAgentManifestCatalog` (źródło szablonów) + `agentPlannerService.createPlan` | Dla 3 zleceń (playbook/discovery/analiza) generuje sensowny plan 3-8 kroków, zweryfikowany panelem adwersaryjnym |
| **F2** | Router `/api/ai/agent-plan` (create/get/approve-step/cancel/stream) + bridge SSE do `executePlan` z realnym executorem `executeToolCall` (org+user scope) | nowy `server/src/routes/ai/agent-plan.routes.ts`, mount w `routes/ai/index.ts` | **agentPlannerService** (kręgosłup) | Plan wykonuje 3 kroki realnymi narzędziami, zatrzymuje się na kroku mutującym, wznawia po approve — test API |
| **F3** | Detekcja intencji w czacie + event `plan_available` (minimalna wstawka) | 1 miejsce w `ai.routes.ts`, `UnifiedChatPanel.tsx`, reuse `TeresaProposalCard.tsx` | wzorzec `/chat/confirm` (propozycja→potwierdź) | Zlecenie w czacie pokazuje kartę „Zobacz plan →", zwykłe pytanie NIE — zrzut |
| **F4** | `AgentPlanPanel` po prawej: podgląd/edycja/reorder kroków, pasek postępu, per-step approval, raport | nowy `src/components/AIChat/AgentPlanPanel.tsx` | powłoka `ArtifactRightPanel` (accordion, tokeny `c-*`) | Prototyp→OK Piotra→JA renderuję realny ekran z mock-planem→zrzut czysty→dopiero Piotr (reguła #7); dark+light |
| **F5** | Bezpieczeństwo: capability-gate + wave8 `approvalPolicy` per krok + audit-trail | integracja w F2, `decisionAuditService` (rozszerzyć `AuditStage`) | **wave8** `validateApprovalPolicy`/`validateToolScope` + **decisionAuditService** | Krok bez uprawnień=blocked; każdy krok w `ai_decision_audit_log`; eksport compliance działa |
| **F6** | Limity + przerwanie: max kroków, timeout per-step/total, budżet (`ai_run_ledger`), pauza/cancel | `agentPlannerService` (rozszerzyć), F4 przycisk „Zatrzymaj" | `cancelPlan` (istnieje) + `ai_run_ledger` | Plan przekraczający limit→`paused` z powodem; „Zatrzymaj"→`cancelled`, kroki→`skipped` |

**HP-5 (Agent Builder)** — osobna, późniejsza fala: edycja definicji agenta (zakres/kroki/allowedTools) instrukcją NL. Reużyć edytowalne definicje **wave8** (`upsertWave8AgentDefinition`, pole `editable`) — surowiec gotowy, brakuje UI. Zależy od akceptu MVP F1-F6 i Q3.

---

## 5. Pytania do Piotra (produktowe)

1. **Błąd kroku — fail-fast czy dalej?** Planner dziś zatrzymuje cały plan przy pierwszym błędzie (fail-fast) i raportuje co zdążył. Czy dla części zleceń chcesz „pomiń błędny krok i kontynuuj" (jak asystent researchu)? Wpływa na F2/F6.
2. **Tryb wykonania — na żywo czy w tle?** Czy po zatwierdzeniu planu user CZEKA z panelem otwartym (na żywo, SSE), czy agent leci w TLE z powiadomieniem po skończeniu (jak wave8 schedules)? Silnik wspiera oba; UX i domyślne różne.
3. **Zakres HP-5 (Agent Builder) w MVP:** edytujemy pełną definicję agenta (allowedTools/approvalPolicy/kroki — jak wave8), czy tylko zawężamy zakres istniejącego szablonu instrukcją w prostym języku? To decyzja „ile mocy vs ile ryzyka" na start.

---

*Zwiad kodu 2026-07-15: agentPlannerService (405 l.) + migracja 672, wave8AgentRuntimeService (1003 l., /api/ai-agents), toolChainExecutor (197 l., 0 callerów), agentRuntime HP-2 (fan-out recenzentów), decisionAuditService (280 l.), agent-manifests catalog (31 tooli), TeresaProposalCard + /chat/confirm. Doktryna: P-H1 (agent=tryb Teresy), panel-po-prawej #56, reguła #7 (Piotr nie pierwszym testerem), flagi OFF do akceptu.*
