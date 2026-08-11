# Case Workspace V1 — HANDOFF, 2026-08-11

> Sesja zatrzymana z powodu wyczerpania limitu tokenów, nie z powodu blokera
> technicznego. Cała praca jest zacommitowana. Drzewo jest czyste.

---

## 1. Punkty odniesienia (wpisz je do pierwszego promptu następcy)

| co | wartość |
|---|---|
| worktree | `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809` |
| branch | `claude/case-workspace-v1-20260809` |
| **BASE_SHA** (jedyna podstawa statystyk) | `9d17cac11484a82f729a51044e30453e39fbcb02` |
| poprzedni checkpoint (zaakceptowany przez właściciela) | `292bafd4e8689ceae1fe72fc17e5d4075c179256` |
| **HEAD na moment przekazania** | `8c763a5a98` (WIP fal A+B) |
| stan drzewa | czyste (`git status --porcelain` = 0) |

`8c763a5a98` to **WIP CHECKPOINT**, nie kandydat. Nie wolno go nazywać
`FINAL PASS` ani `CANDIDATE READY`.

---

## 2. Stan zmierzony, nie deklarowany

Wszystko poniżej uruchomione osobiście przez koordynatora na **stabilnym
drzewie** (żaden agent nie edytował plików w trakcie pomiaru):

| bramka | wynik |
|---|---|
| testy domenowe + trasy + kontrakt (realny PG) | **583 / 588 PASS** |
| `server tsc --noEmit` | **0 błędów** |
| `frontend tsc --noEmit` | **0 błędów** |
| `git diff --check` (working tree) | **0 naruszeń** |
| migracje | przechodzą; replay idempotentny |
| bramki kanonu repo | wszystkie ✓, dług fokusa **spadł** 130→129 plików |

### Komenda testowa — ZAWSZE z tą zmienną

```bash
cd server
DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
POSTGRES_SKIP_INIT_IN_TEST=1 \
DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
npx vitest run src/services/caseWorkspace/ src/routes/caseWorkspace/__tests__/ --environment node
```

Bez `POSTGRES_SKIP_INIT_IN_TEST=1` równoległe pliki testowe ścigają się
o `CREATE INDEX` w `initDb()` i dostajesz losowe czerwone. To zostało
zdiagnozowane pomiarem: 0 wystąpień w trybie serial, 76/3/37 w trzech
przebiegach równoległych.

---

## 3. Pięć pułapek, które kosztowały czas w tej sesji

Przeczytaj to **zanim** zaczniesz diagnozować cokolwiek.

1. **Backend chodzi przez `tsx` BEZ watch.** Po każdej zmianie kodu serwera
   trzeba go zrestartować, inaczej testujesz stary proces. Wystąpiło
   **pięciokrotnie**.
2. **Restart potrafi CICHO paść na `EADDRINUSE`**, zostawiając stary proces
   obsługujący ruch — wygląda jak działający restart. Procedura:
   `lsof -ti tcp:3001` → `kill -9` → czekaj aż port wolny → start → **potwierdź
   nowym zapytaniem**, że nowy kod odpowiada.
3. **Zimny start kłamie.** Pierwszy przebieg na świeżej bazie dał 180 czerwonych,
   powtórka 251/252. Powtórz ZANIM postawisz diagnozę. Ale „powtórz aż przejdzie"
   **nie jest bramką** — niewyjaśniona awaria zostaje FLAKY.
4. **Pomiar w trakcie pracy agentów jest bezwartościowy.** Jeden przebieg
   pokazał 95 czerwonych, bo siedmiu agentów edytowało pliki w tle. Prawdziwy
   wynik na stabilnym drzewie: 583/588. Nie wyciągaj wniosków ze skażonego biegu.
5. **`grep -c` zwraca exit 1 przy zerze trafień** — czyli „zero błędów
   TypeScript" ustawia kod wyjścia na porażkę. Nie buduj bramek na `grep -c`.

---

## 4. Co realnie powstało w falach A i B

### Fala A (6 strumieni)
- **Runtime Run/NodeRun** — `runLifecycleService.ts` + tabela
  `case_workspace_runs` (migracja `20260811a`). Wcześniej istniał tylko NodeRun
  i wiązanie run→plan, ale **żaden byt nie niósł statusu Run**. 26 testów,
  w tym restart w **osobnym procesie V8**, konkurencyjny claim i podwójny
  `startRun` dający jeden NodeRun. Kontrola negatywna wykonana.
- **Klasyfikator intencji przestał być angielską atrapą** — wzorce polskie
  dołożone obok angielskich, te zostawione **bajt w bajt**, żeby nie zmienić
  zachowania istniejących callerów.
- **Trzy kompletne adaptery** (Decision, Initiative/Execution, KPI), po 6 testów
  — świadomie zamiast ośmiu pozornych.
- **12/12 scenariuszy Golden Case** pokrytych; scenariusz 12 uczciwie zostawiony
  jako PARTIAL, bo nie istniało API do otwierania deliverable.

### Fala B (7 strumieni)
- **Ewaluacja bramek** domknęła PARTIAL z fali A. `DECISION_GATEWAY` czyta
  zapisaną ewaluację i **nigdy nie zgaduje gałęzi**; `PARALLEL_SPLIT` odblokowuje
  wszystkie; `PARALLEL_JOIN` czeka na wszystkie. Znalezisko z praktyki: węzeł,
  w którym zbiegają się dwie gałęzie, potrzebuje semantyki OR — inaczej Run
  **nigdy się nie domknie**, czekając na gałąź świadomie niewybraną.
- **Adapter Finance** + realny defekt, przed którym musiał się bronić:
  `DbPromise.run()` ma domyślne `fallback:true`, więc **błąd SQL nie rzuca,
  tylko zwraca `{success:false}`**, a `createModel` i tak oddaje wygenerowane
  id. Udowodnione na żywo błędną datą. Adapter czyta ponownie po zapisie
  i zamienia fałszywy `SUCCEEDED` w uczciwą porażkę.
- **Worker outboxa**: dead-letter, backoff, reconciliation, metryki.
- **Deliverable open/return (backend)** — jawne stany
  `AVAILABLE|STALE|UNAVAILABLE|DELETED` z provenance i kontekstem powrotu,
  bezpieczne wg SEC-009.
- **Deduplikacja semantyczna rejestrów**: 1505 wierszy → **836 grup**;
  adjudykacja wymaga cytatu z kanonu dla każdego wyłączenia z V1.

### Praca koordynatora na plikach współdzielonych
- Zamontowanie tras `runLifecycle`.
- **Wpięcie `startCaseWorkspaceOutboxWorker` w produkcyjny boot** — miał
  **ZERO callerów**. Strona zapisu była poprawna, ale dostawa nigdy nie
  startowała: każde zdarzenie leżało w tabeli na zawsze, żaden konsument się
  nie uruchamiał.
- **10 rejestrów CSV z CRLF na LF** (1824 insercje = 1824 delecje, liczba
  wierszy niezmieniona). To była **prawdziwa przyczyna** padania
  `git diff --check`, a nie „trailing whitespace", jak wcześniej zakładałem.

---

## 5. Co jest OTWARTE — dokładna lista dla następcy

### 5.1 Fala C została zatrzymana w locie (5 pakietów, praca NIE weszła)

Workflow `wiulzzj9w` zatrzymany celowo przy końcu limitu. Skrypt do wznowienia:
`/private/tmp/claude-501/.../scratchpad/wave-c.js` — ale **nie licz na to, że
przetrwa**; treść pakietów jest odtworzona poniżej.

| pakiet | zadanie | dlaczego |
|---|---|---|
| **C1** | wyciek enumeracyjny w Plays | cross-tenant Plays ujawniają istnienie przez **403-vs-404**; test sam się przyznaje jako `KNOWN DEFECT CW-SEC-ENUM-PLAYS-01`. Wzorzec naprawy istnieje w repo (`caseCoreService.getCase`, 12 tras plan-version) — użyć go, nie wymyślać nowego |
| **C2** | parzystość OpenAPI | router montuje **125 operacji, spec deklaruje 110**; brakuje m.in. `GET /cases/{caseId}/runs` i 13 innych (skutek montaży z fal A/B). Do tego **duplikat `operationId`** (112 vs 111) |
| **C3** | live E2E po restarcie | dwa testy były czerwone, bo uderzały w backend ze starym kodem. Backend **został zrestartowany** — trzeba rozstrzygnąć, co było artefaktem, a co realnym defektem |
| **C4** | UI deliverable open/return | backend gotowy (B5), UI nie podłączony — zamyka PARTIAL scenariusza 12 |
| **C5** | rejestry na SHA | dopisać wiersze za realne dokonania fal A/B; podmienić `PENDING-CANDIDATE-SHA` na finalny |

### 5.2 Pięć realnych awarii testów na `8c763a5a98`

```
FAIL errorAndAuthz.contract.pg.test.ts > KNOWN DEFECT CW-SEC-ENUM-PLAYS-01
FAIL openapiRouteParity.contract.test.ts > (3 testy: brakujące operacje, 125 vs 110, duplikat operationId)
FAIL fullChainObservability.pg.test.ts > socket hang up (prawdopodobnie stary backend — sprawdzić po restarcie)
FAIL liveStack.e2e.part2.pg.test.ts > 5. TRANSFORMATION (expected 404 to be 200)
FAIL liveStack.e2e.part2.pg.test.ts > 6. Approval REJECT (expected 400 to be 201)
```

### 5.3 Znane ograniczenia zgłoszone przez agentów (nie ukryte)

- `advanceRun` **nigdy nie deklaruje Run FAILED automatycznie** — zablokowany Run
  osiada w BLOCKED; FAILED wymaga jawnej decyzji człowieka. Świadome.
- Polityki join **ANY / N_OF_M nie zaimplementowane** (tylko `ALL`).
- Gałąź niewybrana przez `DECISION_GATEWAY` **nie dostaje `SKIPPED`** w
  `node_result_acceptances` — wystarcza do domknięcia Run, nie wystarcza do
  pełnego audytu.
- Adaptery **Assessment / Results / Documents-Presentation NIE zbudowane** —
  brak w nich prostego `create+read` API tej samej postaci; wymagają osobnego
  śledztwa (Finance wymagał i dostał).
- `recordInboxProcessingFailure` to **martwy kod** — brak ścieżki, która
  zostawia wiersz w `RECEIVED`.
- Backoff workera jest **per-tick, nie per-row** — schemat nie ma `next_retry_at`.
- **30-minutowy Run**: `EVIDENCE_MISSING`.
- **Walidacja schematu OpenAPI**: `BLOCKED` — brak walidatora offline
  (`ENOTCACHED`), wykonano tylko parse YAML.
- **Generator rejestrów sam brudzi worktree** — stempluje timestamp przy każdym
  uruchomieniu. Wymóg właściciela: generować **przed** finalnym commitem
  i potwierdzić, że dwa przebiegi dają bajtowo identyczny plik.
- `CANDIDATE_GATES_REPORT.md` **nie zawiera żadnego SHA** → formalnie nie jest
  dowodem dla żadnego stanu kodu. Raport bramek musi powstać na finalnym SHA.

### 5.4 Rejestry — stan z parsera (nie z oka)

```
Wiersze efektywne: 1682
NOT_IMPLEMENTED: 1273 · PARTIAL: 201 · IMPLEMENTED_AND_PROVEN: 187
EVIDENCE_MISSING: 16 · OUT_OF_SCOPE_THIS_WAVE: 5
PROVEN bez dowodu: 0
```

Po deduplikacji semantycznej: **836 grup** (1505 wierszy z `requirement_text`).

**Zakaz właściciela, literalnie:** „Nie wolno zmniejszać licznika GAP przez
mechaniczną zmianę statusów." Każde wyłączenie z V1 wymaga **cytatu z kanonu**
albo numeru decyzji z `11_OWNER_DECISION_REGISTER.md`. Bez podstawy — wymaganie
zostaje otwarte.

---

## 6. Środowisko

```bash
# Postgres jednorazowy (colima, profil pgtest)
colima start --profile pgtest          # jeśli VM nie żyje
docker start case-workspace-test-pg    # jeśli kontener stoi
# baza: postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test

# Backend na żywo
bash scripts/dev/case-workspace-local-backend.sh    # :3001
# login: cw.local@local.test / CaseWorkspaceLocal!2026
# runbook: docs/product/case-workspace/LIVE_STACK_RUNBOOK.md
```

**ZAKAZ:** `npm run dev:staging` i `dev:railway` celują w **żywą bazę
zewnętrzną**. Nigdy nie używać do testów — dane demo to twarz produktu.

Jeśli colima nie wstaje z `failed to attach disk ... in use`, to zombie-lock po
nagłym ubiciu: `colima stop --profile pgtest --force`, potem start.

---

## 7. Zasady, które muszą przetrwać zmianę sesji

- **Bez push. Bez merge do demo. Bez deployu. Bez zapisów do staging/demo.**
- Bez `git reset --hard`, `git clean`, stashowania cudzych zmian, szerokiego
  `git add -A`.
- Nie czyścić cudzych worktree.
- Agenci wykonawczy: **Sonnet**. Koordynator: **Opus**.
- Jeden agent = rozłączny allowlist. Pliki integracyjne
  (`routes/caseWorkspace/index.ts`, `Gateway.ts`, `src/App.tsx`, komponenty
  współdzielone) edytuje **wyłącznie koordynator** przy fan-in.
- Żaden agent nie ogłasza finalnego PASS.
- Zrzut z `podglad/` **nie jest dowodem żywego stacku** — harness to test
  komponentu.
- Kontrola negatywna obowiązkowa przy poprawkach bezpieczeństwa: zepsuj,
  potwierdź czerwień, przywróć.

---

## 8. Decyzje zamrożone przez właściciela (nie pytać ponownie)

Jeden byt `Case`, po polsku **Zlecenie**. Wiele Case w jednym projekcie
(UNIQUE `project_id` zdjęty migracją `20260810d` — to była **decyzja modelu**,
nie obejście). Moduły działają bez Case i bez Teresy. Obiekty modułów są
**linkowane, nigdy kopiowane**; Case nie przejmuje ownership. Plan Definition /
Plan Version / Run / NodeRun to różne byty. Prosty / Ekspercki / Lista to
projekcje **jednego** grafu. STANDARD i TRANSFORMATION nie startują przed
publikacją planu i jawnym startem; LIGHT może mieć bezpieczny one-click.
Trzy tryby governance egzekwowane **serwerowo**. Nie powstaje drugi runtime,
drugi approval system ani drugi model Chat/Case.

Akcept W2-V0.1: `PIOTR-W2-V0.1-APPROVED-20260810` — akcept **kierunku
wizualnego**, nie finalny odbiór UI.

---

## 9. Definition of Done nowego kandydata

37 punktów w dyrektywie właściciela z 2026-08-11. Najkrócej: żaden wymagany
element V1 nie może zostać `PARTIAL`, `NOT_IMPLEMENTED`, `EVIDENCE_MISSING`,
`BLOCKED` ani `FAILED`; oba typechecki 0; migracja fresh 0; replay bez nowych
migracji; `git diff --check BASE..CANDIDATE` = 0; drzewo czyste; aktywne
rejestry wskazują **dokładny** CANDIDATE_SHA; raport bramek odpowiada
faktycznemu stanowi finalnego SHA.

Jedyna pozytywna formuła terminalna: **`READY_FOR_CODEX_REVIEW — CANDIDATE ONLY`**.
`FINAL PASS` należy do Codex i Foundera, nie do agenta.
