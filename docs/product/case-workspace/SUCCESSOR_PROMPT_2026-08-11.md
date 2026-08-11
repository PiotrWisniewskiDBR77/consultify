# PROMPT DLA NASTĘPCY — skopiuj wszystko poniżej linii

---

CASE WORKSPACE V1 — CONTINUE TO COMPLETE CANDIDATE
OPUS COORDINATOR + SONNET WORKERS

Kontynuujesz istniejący program. Nie zaczynaj od nowa, nie twórz alternatywnego
Case Workspace, nie zmieniaj zatwierdzonej architektury, nie cofaj poprawnych
zmian.

## Punkt startowy

```
worktree:   /Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809
branch:     claude/case-workspace-v1-20260809
BASE_SHA:   9d17cac11484a82f729a51044e30453e39fbcb02
HEAD:       8c763a5a98   (WIP fal A+B — NIE kandydat, NIE "FINAL PASS")
```

**Najpierw przeczytaj w całości:**
`docs/product/case-workspace/RESUME_HANDOFF_2026-08-11.md`

Tam jest: stan zmierzony, pięć pułapek środowiskowych, lista otwartych
defektów, ograniczenia zgłoszone przez agentów i zasady, które muszą przetrwać
zmianę sesji. Nie zaczynaj pracy przed przeczytaniem — trzy z tych pułapek
kosztowały poprzednią sesję realny czas.

**Potem przeczytaj kanon:** `docs/product/case-workspace/00`–`15`,
`docs/product/AGENT_EXECUTION_V8_SSOT.md`, `docs/ui-standards/TRIADA_KANON.md`,
`Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`, właściwe `CLAUDE.md`.

## WAVE 0 — odzyskanie baseline (Opus, sam)

1. `git rev-parse HEAD`, `git status --porcelain`, `git branch --show-current`.
2. Nie zakładaj, że drzewo jest czyste ani że HEAD to nadal `8c763a5a98`.
3. Uruchom pełną suitę **na stabilnym drzewie** (żadnych agentów w tle).
4. `git diff --check BASE_SHA..HEAD`.
5. Oba typechecki.
6. Zbuduj collision map przed uruchomieniem agentów równoległych.

Po WAVE 0 **natychmiast** przechodź do wykonania. Nie zatrzymuj się, żeby
wysłać raport pośredni.

## Pierwsza fala — pakiety gotowe do uruchomienia

Fala C poprzedniej sesji została zatrzymana w locie. Pięć pakietów, rozłączne
allowlisty, wszystkie na **Sonnecie**:

**C1 — wyciek enumeracyjny w Plays (P1, bezpieczeństwo).**
Allowlist: `playService.ts`, `play.routes.ts`, ich testy, nowy
`__tests__/security/playsEnumeration.security.pg.test.ts`.
Cross-tenant Plays ujawniają istnienie przez 403-vs-404. Wzorzec naprawy
istnieje w repo (`caseCoreService.getCase`, 12 tras plan-version): odmowa
autoryzacji zwija się do „nie znaleziono", **każdy inny błąd nadal propaguje**.
Kontrola negatywna obowiązkowa. Po naprawie asercja `KNOWN DEFECT
CW-SEC-ENUM-PLAYS-01` w `errorAndAuthz.contract.pg.test.ts` wymaga odwrócenia —
to plik innego właściciela, więc niech agent poda koordynatorowi dokładną linię.

**C2 — parzystość OpenAPI.**
Allowlist: `docs/product/case-workspace/api/openapi.yaml`,
`openapiRouteParity.contract.test.ts`.
Router montuje 125 operacji, spec deklaruje 110. Brakuje m.in.
`GET /cases/{caseId}/runs` i 13 innych. Jest też duplikat `operationId`
(112 vs 111). Opisywać z **realnych handlerów**, nie zmyślać pól. Zachować
wyjątek `EXTERNALLY_MOUNTED_OPERATIONS` dla `/{source}/deliveries`.

**C3 — live E2E po restarcie backendu.**
Allowlist: `__tests__/e2e/**`, katalog zrzutów. Kod produkcyjny tylko do
odczytu; defekty się **zgłasza**, nie naprawia.
Dwa testy były czerwone przy backendzie ze starym kodem. Backend został
zrestartowany. Zadanie: rozstrzygnąć, co było artefaktem martwego procesu,
a co realnym defektem. **To rozróżnienie jest całym sensem pakietu.**

**C4 — UI deliverable open/return.**
Allowlist: `src/components/CaseWorkspace/**`, `enumLabels.ts` (dopisywanie),
katalog zrzutów.
Backend gotowy: `GET /artifact-links/:linkId/open` zwraca `deepLink`, jawny
`state` (AVAILABLE|STALE|UNAVAILABLE|DELETED) i `returnContext`. UI ma to
podłączyć przez **istniejący** `getArtifactPath` z `src/utils/artifactLinks.ts`
— nie budować własnej tablicy tras. Zamyka PARTIAL scenariusza 12.

**C5 — rejestry na SHA.**
Allowlist: `acceptance/*.csv`, `LEDGER_SNAPSHOT.md`, `ledger-report.mjs`.
Dopisać wiersze (append-only) za realne dokonania fal A/B z `test_ref` do
testów, które agent **sam uruchomi**. `IMPLEMENTED_AND_PROVEN` tylko gdy kod
istnieje, konsument go woła, test pokrywa dokładnie wymaganie i dowód pochodzi
z właściwej warstwy. Kod bez testu = `PARTIAL`.

## Kolejne fale

Po fan-inie fali C: pełne bramki, nowa lista usterek, kolejna fala równoległa.
Powtarzaj implementacja → fan-in → testy → naprawa aż do DoD albo literalnego
BLOCKED. Nie wracaj do właściciela po każdej fali.

Główne pozostałe obszary: adaptery Assessment / Results / Documents-Presentation
(wymagają śledztwa API, tak jak Finance); polityki join ANY/N_OF_M; `SKIPPED`
dla gałęzi niewybranej; 30-minutowy Run; walidacja schematu OpenAPI
(potrzebny walidator offline); pełna matryca a11y (VoiceOver, axe).

## Zasady nienaruszalne

Bez push. Bez merge do demo. Bez deployu. Bez zapisów do staging/demo.
Bez `git reset --hard`, `git clean`, stashowania cudzych zmian, szerokiego
`git add -A`. Nie czyścić cudzych worktree.

Agenci wykonawczy na **Sonnecie**, koordynator na **Opusie**. Jeden agent =
rozłączny allowlist. Pliki integracyjne (`routes/caseWorkspace/index.ts`,
`Gateway.ts`, `src/App.tsx`, komponenty współdzielone) edytuje **wyłącznie
koordynator** przy fan-in. Żaden agent nie ogłasza finalnego PASS.

Zrzut z `podglad/` nie jest dowodem żywego stacku. Przechodzący test nie jest
automatycznie dowodem funkcjonalności. Kontrola negatywna obowiązkowa przy
poprawkach bezpieczeństwa.

Nie zmniejszaj licznika GAP przez mechaniczną zmianę statusów. Każde wyłączenie
z V1 wymaga cytatu z kanonu albo numeru decyzji właściciela.

## Stan terminalny

Wracasz wyłącznie jako **`READY_FOR_CODEX_REVIEW — CANDIDATE ONLY`** albo
z jednym literalnym **BLOCKED**, którego nie da się usunąć po trzech różnych
bezpiecznych próbach i który wymaga decyzji właściciela lub zewnętrznego zasobu.

Czerwony test, awaria agenta, flaky, limit kontekstu, potrzeba kolejnej
migracji ani potrzeba nowej rundy agentów **nie są** HARD BLOCK.

`FINAL PASS` należy do Codex i Foundera. Nie ogłaszaj go.
