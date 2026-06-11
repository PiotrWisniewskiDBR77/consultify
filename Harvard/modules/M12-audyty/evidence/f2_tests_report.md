# M12 — Audyty (Audit Orchestrator) — FAZA 2: Testy

**Agent:** TESTY · **Data:** 2026-06-11 · **Branch:** feat/deliverables-light
**Repo:** /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify

---

## Wynik jednozdaniowy

**Modul M12 ma ZERO testow (FE / BE / E2E).** Nie ma czego uruchomic — `PASS=0, FAIL=0, SKIP=0`. Cala logika (kreator, presety, fan-out do realnego `interviewAssignmentService`, SQL-owy rollup completion, 7 endpointow) jest **niepokryta**. Modul jest dodatkowo **beta-CLOSED** (`MODULE_AUDITS: 'closed'`), wiec realny ruch produkcyjny jest minimalny — ale to nie zastepuje testow przy wlaczeniu funkcji.

---

## 1. Inwentarz testow

| Plik testowy | Dotyczy | Liczba testow |
|---|---|---|
| _(brak)_ | — | **0** |

Wyszukiwania (wykluczone: `node_modules`, `.drive-sync-backup`, `.claude/worktrees`, `_quarantine`, `dist/`):

- `grep -rlE "auditProgram|audit-programs|AuditsHub|auditProgramService|AuditProgram" --include="*.test.*" --include="*.spec.*"` -> **0 plikow**
- `grep -rlE "generateSurveys|computeCompletion|buildPlanFromPreset|getPresetById|/programs/|generate-surveys|AuditOrchestratorWizard|auditApi" tests/ server/src/ src/` (tylko pliki testowe) -> **0 plikow**

> UWAGA o szumie: w repo sa setki trafien na slowo "audit", ale dotycza INNYCH domen — audit **logs** (`auditLog.middleware`, `AuditEventsService`, `superadminAuditLogs`), **presentation** audit (`presentationAudit*`, `layoutAudit`), **governance/agent** audit (`AgentAuditOrchestrator`, `governanceAudit`), **trust** audit (`trustAuditService`). Zaden z nich nie testuje M12 (programy audytowe / Audit Orchestrator). Latwa pomylka — zwlaszcza `AgentAuditOrchestrator` brzmi jak nasz modul, ale to orkiestrator agentow AI, nie audytow.

## 2. Uruchomienie

```
$ npx vitest run --reporter=verbose -t "x_no_match_token_zzz" src/components/Audit
 RUN  v4.1.8
 No test files found, exiting with code 1
 filter: src/components/Audit
```

Wzorce `include` w vitest (FE + server) **nie obejmuja zadnego pliku** dla `src/components/Audit/**`, `server/src/routes/audit-programs*`, `server/src/services/auditProgramService*`.

**PASS=0 · FAIL=0 · SKIP=0 · czas=n/d** (nic do uruchomienia — to nie jest "zielono", to **pusto**).

Root-cause "zerowej zieleni": modul jest **nowy** (pliki z 2026-06-06/07), powstal po sprincie deliverables i nie dostal ani jednego testu. Nie ma mock-driftu/stale-importu/schema-driftu do zdiagnozowania, bo nie ma testow.

## 3. Mapa pokrycia S1-S7

| Scenariusz | FE | BE | E2E | PR-gate | Uwagi |
|---|:--:|:--:|:--:|:--:|---|
| **S1** lista + paginacja + filtr | ❌ | ❌ | ❌ | ❌ | `GET /programs` + render w `AuditsHub.tsx` — 0 testow |
| **S2** kreator 4 kroki -> create -> trwalosc | ❌ | ❌ | ❌ | ❌ | `AuditOrchestratorWizard.tsx` + `POST /programs` + `ensureSchema/upsert` — 0 testow |
| **S3** presety iso27001 / new-company | ❌ | ❌ | ❌ | ❌ | `getPresetById` + `buildPlanFromPreset` (czysta funkcja, latwa do testu) — 0 testow |
| **S4** dashboard liczniki | ❌ | ❌ | ❌ | ❌ | liczniki w `AuditsHub.tsx` — 0 testow |
| **S5** fan-out generuj ankiety | ❌ | ❌ | ❌ | ❌ | `generateSurveys()` -> REALNY `interviewAssignmentService.create()` — 0 testow |
| **S6** completion rollup | ❌ | ❌ | ❌ | ❌ | `computeCompletion()` REALNY SQL `GROUP BY status` — 0 testow |
| **S7** edycja / usuwanie | ❌ | ❌ | ❌ | ❌ | `PATCH` / `DELETE /programs/:id` — 0 testow |

**PR-gate (wszystkie ❌):** `test-suite.yml` odpala sie tylko na `push/PR` do `[main, develop]`. Default branch = **Londyn**, branch roboczy = **feat/deliverables-light** -> gate **nie dotyka** tego modulu na zadnym istotnym branchu. Brak E2E w `tests/e2e/`.

## 4. Pulapki (sprawdzone)

- **S5 fan-out — realny serwis czy mock?** -> **Nieistotne, bo 0 testow**, ale waznie: produkcyjnie `generateSurveys()` wola **REALNY** `interviewAssignmentService.create()` (import L31, wywolanie L416, idempotencja L392). Czyli gdy testy powstana, mozna je zrobic **prawdziwie integracyjnie** (cala sciezka przydzialow) — i to **trzeba** zrobic, bo mock tej granicy ukrylby najwiekszy obszar ryzyka (kartezjanski fan-out template x assignee).
- **S6 rollup — realne liczby czy mock?** -> Produkcyjnie **REALNY SQL** (`SELECT status, COUNT(*) ... GROUP BY status` na `interview_assignments`, `DONE_STATUSES = submitted/approved/completed`, mianownik = liczba zapisanych id = honest completion). Test musi uderzac w realna tabele (lub seeded test-db), nie w mock, inaczej "falszywa zielen".
- **Falszywa zielen (fetch bez serwera):** brak testow FE = brak ryzyka teraz, ale przyszle testy `auditApi.ts` musza miec realny lub porzadnie zamockowany serwer — inaczej testy "przejda" na pustych odpowiedziach.
- **Flaga beta OFF:** `MODULE_AUDITS: 'closed'` — testy FE musza pamietac o gatingu (render moze byc zablokowany dla nie-admina). To **pulapka pokrycia**: latwo napisac test, ktory renderuje pusta plyte beta i raportuje "zielono", nie testujac wlasciwego flow.

## 5. Backlog testow

| # | Typ | Plik (proponowany) | Scenariusz | Priorytet |
|---|---|---|---|:--:|
| T1 | BE integ. | `server/src/services/__tests__/auditProgramService.fanout.test.ts` | S5: `generateSurveys()` przez **REALNY** `interviewAssignmentService.create()`; weryfikuj kartezjanski fan-out (N templates x M assignees = N*M przydzialow), idempotencje (drugie wywolanie nie dubluje), zapis `generatedAssignmentIds` | **P0** |
| T2 | BE integ. | `server/src/services/__tests__/auditProgramService.completion.test.ts` | S6: `computeCompletion()` na seeded `interview_assignments`; realne liczenie done/total/percent, byStatus, honest denominator po usunieciu przydzialu | **P0** |
| T3 | BE route | `server/src/routes/__tests__/audit-programs.routes.test.ts` | S1/S2/S7: 7 endpointow (lista/create/get/patch/delete/generate-surveys/completion); org-scoping (cross-org IDOR — patrz systemowy watek z MEMORY), auth, walidacja | **P0** |
| T4 | FE unit | `src/components/Audit/__tests__/auditPresets.test.ts` | S3: `getPresetById('iso27001'/'new-company')`, `buildPlanFromPreset` (mapowanie obszar->rola, lokalizacja PL/EN); czysta funkcja — szybki, wysoki zwrot | **P1** |
| T5 | FE comp. | `tests/components/Audit/AuditOrchestratorWizard.test.tsx` | S2: kreator 4 kroki -> walidacja kazdego kroku -> submit; mock i18next zgodny z SSOT; flaga beta ON | **P1** |
| T6 | FE comp. | `tests/components/Audit/AuditsHub.test.tsx` | S1+S4: lista, filtr, paginacja, dashboard liczniki; uwzglednic beta-CLOSED render (nie raportowac zieleni na plycie beta) | **P1** |
| T7 | E2E | `tests/e2e/audit-orchestrator-flow.spec.ts` | S2->S5->S6 happy path: create program -> generate-surveys -> przydzialy widoczne w Wywiadzie -> completion rosnie | **P2** |
| T8 | CI | `.github/workflows/test-suite.yml` (lub dedykowany) | Dodac branch `Londyn` (default) do triggerow ALBO module-contract dla M12, by gate w ogole obejmowal ten modul | **P2** |

---

### Najwazniejsze ryzyka (TL;DR)
1. **Caly modul niepokryty** — 0 testow przy nietrywialnej logice (fan-out + SQL rollup + 7 endpointow).
2. **Granica S5/S6 jest realna** (nie mock) — to dobrze do testow integracyjnych, ale ZNACZY, ze bledy w `interviewAssignmentService` lub schemacie `interview_assignments` rozlewaja sie na M12 bez zadnej siatki bezpieczenstwa.
3. **PR-gate nie obejmuje modulu** na branchu roboczym ani default (Londyn).
4. **Cross-org org-scoping** (endpointy z `:id`) niesprawdzony testem — spojne z systemowym watkiem IDOR z notatek projektu (P0 dla T3).
