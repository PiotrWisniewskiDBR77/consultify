---
id: AGT-009
tytul: BRAMA — pełny przebieg generatora od nowego projektu do uruchomienia z bramką
typ: zadanie
waga: wysoka
obszar: AGT
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "SPEC _SPEC_AGENT_VAULT_2026-07-22.md §1/§5 (v1 generatora, DEC-002)"
utworzone: 2026-07-22
---

## 1. PROBLEM

Trzeba potwierdzić, że generator procesu działa end-to-end, zanim uznamy partię 2 za gotową do akceptu Piotra.

## 2. PRZYCZYNA

Nie dotyczy — to brama jakości (składa AGT-006 backend + AGT-007 canvas + AGT-008 klocki).

## 3. ROZWIĄZANIE

Master przechodzi cały przepływ na demo: nowy projekt → agent kładzie gotowy schemat (① AI proponuje) → user przestawia klocki (② ręcznie) → uruchomienie → wykonanie krok po kroku w tle → bramka (zatrzymaj → popraw → wznów, DEC-002 c). Zrzuty każdego etapu.

## 4. KRYTERIUM ODBIORU

Master pokazuje Piotrowi komplet zrzutów pełnego przebiegu (gotowy schemat → przestawienie → uruchomienie → bramka z poprawką i wznowieniem). **Zamknięte, gdy Piotr zaakceptuje, że generator procesu v1 działa** — wtedy partia 2 idzie do deployu (za jego „tak") i wchodzi partia 3 (orkiestracja modułów).

## 5. DOWODY

Gałąź `feat/agt-009-flow` (baza `integr/agent-vault`), scalona do integr (`a06102b83a`). Nie pushowana.
- `server/src/services/ai/agentPlannerService.ts` — `replaceSteps()` (guard `planning`, DELETE+reinsert z nowym step_index, sync plan_json/total_steps).
- `server/src/routes/ai/agent-plan.routes.ts` — flaga `draft` w POST (`draft:true`→plan zostaje w `planning`, dispatch deferred); `PATCH /:id/steps` (zapis przestawionego schematu, guard 409); `POST /:id/run` (jawne Uruchom: opc. replaceSteps + dispatch).
- `src/services/api/agentPlan.api.ts` — `updateAgentPlanSteps()`, `runAgentPlan()`, `draft` w create.
- `src/components/AIChat/AgentPlanPanel.tsx` — `handleRunSchema`→`runAgentPlan` (realny zapis+dispatch); `blocksToSteps` zachowuje `toolInput` po id. Bramka approval nietknięta.
- **★ Master zweryfikował vitest: 37/37 zielone** (11 nowych): plan generatora ZOSTAJE w `planning`; replaceSteps utrwala przestawiony step_index; guard poza-planning 409; draft=deferred bez queueAdd; POST run dispatch. esbuild node+browser zielone.
- **CZEKA NA MASTER (reguła #7):** pełny przebieg wizualny (nowy projekt→schemat→przestaw→Uruchom→bramka) + sonda live po deployu. Uwaga: caller generatora w UI musi wołać `createAgentPlan({draft:true})` — dziś `AgentManifestLauncher` tworzy bez draft (dispatch od razu); podpięcie draftu w UI generatora = domena partii 2.

## 6. DZIENNIK

**2026-07-22** — utworzone przez Mastera (partia 2) jako brama. Zależne od AGT-006/007/008. Reguła #7: pełny przebieg + zrzuty robi Master; Piotr patrzy do akceptu.
**2026-07-23 — odblokowane i w toku (Master).** AGT-006 (generator) + AGT-007 (canvas) wykonane i scalone do `integr/agent-vault`. Zależność [AGT-006,007] usunięta (spełniona). **AGT-008 pominięte jako blokada** — realny flow (rozdzielenie tworzenia od dispatchu + zapis przestawionych kroków) NIE wymaga klocka Vault-kontekst (AGT-008 to wzbogacenie, w dużej części pokryte: faza Wejście generatora już używa `search_knowledge_base` = Vault retrieval; typ klocka Vault-kontekst jest w canvas UI). Wykonawca (Opus) buduje na `integr/agent-vault`: rozdzielenie POST create od dispatch (plan zostaje w `planning` do „Uruchom"), zapis przestawionych kroków, wpięcie „Uruchom" z canvas. Gałąź `feat/agt-009-flow`.
**2026-07-23 — wykonane i scalone do integr** (`a06102b83a`). draft flag + PATCH steps + POST run + canvas Uruchom. Master zweryfikował 37/37. → do-odbioru. Pełny przebieg wizualny + live = Master (reguła #7). **Wątpliwość: nowe klocki dodane w canvas są „lossy"** (domyślny `toolName=search_knowledge_base`) — przestawianie/usuwanie zachowuje toolInput, ale „dodaj etap z realnym narzędziem" wymaga bogatszego modelu klocka (kandydat na osobne zadanie, ewentualnie zakres AGT-008).
