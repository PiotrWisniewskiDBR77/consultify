---
id: AGT-012
tytul: Bramka akceptu dla create_task/update_task/create_decision (wszędzie, nie tylko warsztat)
typ: zadanie
waga: wysoka
obszar: agent
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Piotr, 2026-07-26, decyzja na pytanie Mastera (rekomendacja przyjęta)"
utworzone: 2026-07-26
---

# AGT-012 — Bramka akceptu dla create_task/update_task/create_decision

## 1. PROBLEM

Agent wywołany z czatu Teresy zapisuje zadania i decyzje od razu, bez pytania —
użytkownik może zastać w projekcie wpisy, których nie zatwierdził. W warsztacie
agenta bramka akceptu działa, poza nim nie. Harvey (benchmark) w takich
miejscach zawsze pyta. Piotr 2026-07-26: objąć bramką wszędzie.

## 2. PRZYCZYNA

`server/src/services/ai/sideEffectTools.ts:17-23` — zbiór `SIDE_EFFECT_TOOLS`
zawiera 5 narzędzi (create_initiative_draft, generate_report_section,
schedule_meeting, create_notebook_entry, query_structured_data), a nie zawiera
`create_task` / `update_task` / `create_decision`, mimo że to realne narzędzia
mutujące („Persists immediately" — `toolDefinitions.ts:464,496,523`, handlery
`toolDefinitions.ts:674,676,678`). Potwierdzone audytem podłączenia 2026-07-26.

## 3. ROZWIĄZANIE

Dodać trzy narzędzia do `SIDE_EFFECT_TOOLS`; zaktualizować opisy narzędzi
(model czyta opisy — „Persists immediately" przestaje być prawdą); sprawdzić,
że łańcuch `awaiting_approval` (backend + UI zatwierdzania) obsługuje je bez
większych zmian. Duże zmiany w UI = STOP i raport zamiast budowy.

## 4. KRYTERIUM ODBIORU

Piotr w czacie Teresy prosi agenta o utworzenie zadania → zamiast natychmiast
zapisanego wpisu widzi propozycję do zatwierdzenia; po kliknięciu „zatwierdź"
wpis powstaje, po odrzuceniu — nie. To samo dla zmiany zadania i utworzenia
decyzji.

## 5. DOWODY

- Gałąź `feat/bramka-akceptu-task-decision`, commit `ceec32de85` — scalona i
  wdrożona na demo (push `252159f6ec`, 2026-07-26).
- Set rozszerzony: `server/src/services/ai/sideEffectTools.ts:17-30` (8 wpisów).
- Bramka generyczna po `toolName`: `agentPlannerService.ts:103-106`
  (requiresApproval z Setu), `:202-214` (executePlan NIE woła toolExecutor dla
  `awaiting_approval` — zwraca wcześniej), wznowienie po akcepcie:
  `agent-plan.routes.ts` POST /:id/approve-step.
- Realny zapis dopiero po akcepcie: `toolDefinitions.ts:674-679` (dispatch),
  `:693-710`/`:744-770` (implementacje); opisy narzędzi bez „Persists
  immediately" (`:466`, `:498`, `:525`).
- UI zatwierdzania istniało wcześniej (`agentWorkshopCatalog.ts:322-350`,
  `approval: true` + polskie etykiety) — brakowało tylko backendu.
- Testy: nowy `tests/unit/backend/sideEffectTools.test.ts` 4/4 PASS
  (uruchomiony NIEZALEŻNIE przez Mastera) + 72 istniejące testy plannera
  zielone bez modyfikacji.
- ★ ZASTRZEŻENIE ZAKRESU (uczciwie): bramka kryje ścieżkę
  warsztat/agent-planner. Trzy ścieżki NADAL ją omijają (świadomie nieruszone,
  wymagają osobnych decyzji): Wave 8 (`wave8AgentRuntimeService.ts:880-885`,
  ma własny approvalPolicy), Playbooki (`playbookExecutor.ts:171-239`, brak
  mechanizmu pauzy w ogóle), czat Teresy (`tools/createTask.ts:10-12` —
  OSOBNA implementacja tych samych nazw, jawnie „no approval gate").

## 6. DZIENNIK

- 2026-07-26 — Master: zadanie utworzone z decyzji Piotra; wykonawca (Sonnet)
  uruchomiony na gałęzi `feat/bramka-akceptu-task-decision` (baza origin/demo
  po wdrożeniu integracji `1992061ad7`), stan → w-toku.

**2026-07-26 — wykonawca (Sonnet):** zrealizowane w worktree, raport z pełnym
łańcuchem dowodowym. Master zweryfikował test 4/4 samodzielnie, scalił i
wdrożył na demo `252159f6ec`. Stan → do-odbioru. UWAGA dla Piotra przy
odbiorze: „wszędzie" pokrywa dziś ścieżkę warsztatu; Wave 8 / Playbooki /
czat Teresy = osobne decyzje (opisane w DOWODACH).
