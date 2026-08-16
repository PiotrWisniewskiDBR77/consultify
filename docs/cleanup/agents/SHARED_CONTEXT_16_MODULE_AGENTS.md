# Consultify — wspólny kontekst dla 16 agentów modułowych

Wersja: `1.0.0`

Data: `2026-08-16`

Status programu: `LOCAL_ACCEPTANCE_DONE_BOUNDED / DEPLOY_PARITY_PENDING / NOT_RELEASE_READY`

Ten plik jest obowiązkowym kontekstem startowym dla agentów wykonujących
zadania z `MODULE_AGENT_TASK_QUEUE.md`. Nie jest opisem historycznym. Gdy
starszy raport lub packet jest z nim sprzeczny, obowiązuje ten plik, kolejka
zadań oraz bieżący kod na wskazanym SHA.

## 1. Graf autorytetów — nie wolno mieszać SHA

| Rola                                       | SHA / artefakt                             | Do czego służy                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trwały kanon dokumentacyjny i integracyjny | `59a804d572b76bd53fe6939a77588d123db6bb03` | Jeden czysty persistent worktree, raporty, dowody i pełna historia integracji.                                                                                         |
| Produkt/runtime przeznaczony do deployu    | `6e31012fbe3458dd6a3faccde2e6540f7837d613` | Jedyny bieżący kandydat aplikacji. Deployment i browser parity zaczynają się od tego SHA, chyba że integrator utworzy nowszy product SHA i formalnie unieważni dowody. |
| Acceptance code/test authority             | `14c8852a71cdc5c8bf723a9b21f5e1cc00a467f5` | Produkt `6e3` plus testowe/matrycowe naprawy harnessu użyte w finalnej lokalnej bramie. Nie jest automatycznie nowym runtime product SHA.                              |
| Browser evidence                           | `7a25a88a59193c24a0516ae78c293e0e5774a357` | `32/32 PASS` dla produktu `6e3`, desktop i mobile.                                                                                                                     |
| System-gate evidence                       | `d1ee32a4381ae5745181cc8106e5626682ebd86b` | Standard, isolated, realDB i machine proof dla acceptance `14c`.                                                                                                       |
| Finalny raport/cleanup                     | `59a804d572b76bd53fe6939a77588d123db6bb03` | Rozliczenie siedmiu etapów, 16 kart modułów i kolejka domknięcia.                                                                                                      |

Chronione recovery:

- produkt: `refs/recovery/final-product-20260816/6e31012fbe`, tag
  `final-product-6e31012fbe-20260816`, bundle
  `Consultify_FINAL_PRODUCT_6e31012fbe_20260816.bundle`;
- acceptance: `refs/recovery/final-acceptance-20260816/59a804d572`, tag
  `final-acceptance-59a804d572-20260816`, bundle
  `Consultify_FINAL_ACCEPTANCE_59a804d572_20260816.bundle`.

Zasada: agent wdrożeniowy używa produktu `6e3`. Agent naprawiający
reprodukowalny błąd tworzy nowy produkt od product authority wskazanego przez
integratora. Agent nie cherry-pickuje losowo różnicy `59a → 6e3` ani odwrotnie.

## 2. Stan wejściowy, którego nie wolno odkrywać ponownie

- Jest dokładnie jeden zarejestrowany, czysty persistent worktree:
  `/Users/piotrwisniewski/Developer/consultify-canonical-full-20260814`.
- Recovery inventory: `224/224` głów sklasyfikowanych; brak kandydatów,
  semantic review i owner decision.
- Product static: root/server typecheck PASS; build 8 GiB PASS; 931 unikalnych
  migracji w repo bez kolizji; świeży PostgreSQL wykonał 719 migracji; schema
  completeness PASS.
- Browser: 16 modułów × desktop/mobile = `32/32 PASS`, zwykły zalogowany OWNER,
  zero błędów konsoli/API/request/Axe/layout. Dwa przerwane requesty Chat były
  wyłącznie skutkiem `page.reload`.
- Standard: 4058 plików, 40 206 testów, 39 562 PASS, 0 FAIL, 625 pending,
  19 todo; scope-equivalent dla acceptance `14c`.
- Isolated: 72/72 pliki, 1590/1590 PASS.
- RealDB: 64/64 pliki, 427 PASS, 0 FAIL, jeden jawny pending
  `MYW-REALDB-FIXTURE-AUTH-001`.
- Deployment demo i parity `P` nie zostały wykonane. Push/deploy i zastosowanie
  oczekujących migracji demo są `NOT_AUTHORIZED`, dopóki użytkownik nie udzieli
  dokładnej zgody release.

## 3. Zasada nadrzędna dla wszystkich 16 agentów

Kod modułowy jest już zintegrowany jako `DONE_CODE_D` albo
`DONE_CODE_D_BOUNDED`. Agent nie odbudowuje modułu, nie reaktywuje starego
tasku i nie rozszerza MVP. Bieżącą pracą jest:

1. zamknięcie wskazanego tasku `*-BVP-001` na deployed exact SHA;
2. w My Work — dodatkowo materialne rozstrzygnięcie jednego pending fixture;
3. zatrzymanie się i utworzenie osobnego defect packetu, jeśli bieżący,
   reprodukowalny test ujawni prawdziwy błąd produktu;
4. pozostawienie zadań policyjnych i post-MVP bez implementacji, dopóki owner
   nie zatwierdzi kontraktu.

Stare sekcje `READY`, `PARTIAL`, `VERIFYING` w raportach są historią. Aktualny
werdykt znajduje się w sekcjach 10–12 raportu finalnego i w kolejce agentów.

## 4. Skala dowodu i literalne DONE

- `C` — kod podłączony do mounted route/UI/API/service;
- `F` — focused tests;
- `D` — świeży/upgrade/replay real PostgreSQL;
- `S` — system/static gate;
- `B` — signed-in browser;
- `V` — visual/a11y;
- `P` — deployed parity: server/client SHA, migracje, flagi i dane.

`DONE` modułu wymaga wszystkich liter wskazanych w jego tasku na tym samym
product SHA, z zerem nieznanych błędów, odczytem DB/flag/data po cold restart
oraz udanym rollback rehearsal. `PENDING`, `UNKNOWN`, `EVIDENCE_MISSING` i
`BLOCKED_ON_POLICY_OWNER` pozostają literalne — nie są błędem stylistycznym.

Minimalny record dowodu zawiera:

- exact product SHA i commit agenta;
- pełną komendę, exit code, start/koniec;
- discovered/executed/pass/fail/pending/todo/unhandled;
- Node/npm/Vitest/Playwright/PostgreSQL/pgvector;
- świeży i upgrade ledger migracji;
- tenant/org/actor/fixture IDs oraz capability/role;
- server/client SHA, flagi i seed/readback;
- screenshoty, trace/log oraz SHA-256 artefaktów;
- cleanup kontenera/fixture/portów;
- wynik rollbacku.

Proza „PASS” bez tych pól nie jest dowodem.

## 5. Wspólny kontrakt scenariusza

Każdy zapisujący moduł sprawdza co najmniej:

1. happy path od mounted UI do owner table;
2. reload i cold reopen ze stabilnymi ID;
3. tenant negative oraz role/capability negative;
4. stale/CAS i retry/replay;
5. dwa lub więcej requestów współbieżnych: dokładnie jeden efekt albo ten sam
   idempotentny rezultat;
6. brak orphan row/receipt/snapshot po przegranym writerze;
7. jawny provider/schema failure bez fałszywego success;
8. desktop i mobile bez poważnego Axe, technicznego UUID/enumu, stuck loading,
   overflow i niezgłoszonego API >=400.

Jeżeli moduł tylko czyta, negatywy mutation zastępuje się dowodem braku zapisu
i poprawnego filtrowania tenant/visibility.

## 6. Granice architektury i ownership

- Chat posiada conversation/message, nie Initiative, Idea ani artefakt.
- My Work jest projekcją; Agent posiada `transformation_cases`; nie wolno pisać
  równolegle do `case_core` lub `ai_agent_plans`.
- Interview posiada odpowiedzi/evidence/insights, nie Initiative.
- Tools posiada ToolSession/ToolOutput, nie Initiative.
- Assessment posiada method/session/report lineage; MVP = DRD.
- Initiatives jest jedynym ownerem lifecycle Initiative.
- Execution posiada case/work/evidence; upstream Initiative pozostaje ownerem.
- Results ma osobnych ownerów KPI, ROI i OKR.
- Finance posiada finance-v3 po bridge; nie przejmuje Results Actual.
- Materials posiada registry i native DOC/PPT/XLSX versions.
- Audits w release obejmuje wyłącznie bounded beta CRUD.
- Meeting posiada minutes; Task i Decision pozostają downstream ownerami.
- Organization posiada zatwierdzony immutable context snapshot.
- Admin posiada tenant control plane; SuperAdmin i Settings są osobne.
- Settings posiada user preferences/integrations, nigdy tenant policy.
- Partner release obejmuje bounded V8 connect/read, bez wymyślonego payout.

Cross-module handoff musi mieć versioned payload, owner receipt, stabilny source
ID oraz contract test po obu stronach. Agent nie dodaje nowego writera.

## 7. Git, worktree i współbieżność

Persistent canonical worktree jest tylko dla integratora i pozostaje czysty.
Agent otrzymuje krótkotrwały worktree oraz:

- `agentId`, `taskId`, exact baseline, branch `codex/<task-id>`;
- zaakceptowany allowlist i hash packetu;
- lease `startedAt/expiresAt`;
- listę zastrzeżonych plików współdzielonych;
- numer/slot migracji, jeśli migracja została zaakceptowana.

Zakazy: bez `reset --hard`, `clean`, stash, broad staging, force, merge całości,
push/deploy/delete, zmian menu/Gateway/AppRoutes/global types/barrels/flags lub
migratora poza przydziałem. Agent stage'uje tylko allowlist, wykonuje
`git diff --check`, commit i przekazuje SHA. Integrator cherry-pickuje
sekwencyjnie. Konflikt wraca do agenta; integrator nie improwizuje semantyki.

Po integracji i dowodach worktree usuwa się bez `--force`, branch/ref zostaje,
a kanon wraca do jednego persistent worktree.

## 8. Shared files — wyłączna własność integratora

Bez osobnego przydziału agent nie zmienia:

- `server/src/AppRoutes*`, `server/src/Gateway*`, root route registries;
- globalnych API barrels, shared DTO/types i capability registries;
- sidebar/menu/global flags i environment templates;
- migration runner/order registry oraz numeracji migracji;
- `scripts/testing/cleanup-test-matrix.json`;
- czterech finalnych raportów cleanup;
- release/deploy scripts i Railway configuration.

Zmiana wymagająca takiego pliku trafia do `INTEGRATOR_CHANGE_REQUEST`, nie do
commita modułowego.

## 9. Macierz unieważniania dowodów

| Zmiana                                         | Obowiązkowe ponowienie                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| Test/fixture tylko w realDB, standard-excluded | focused + exact realDB + machine scope proof                                    |
| UI/a11y/copy/mounted routing                   | focused + typecheck + pełne 32/32 B/V                                           |
| Service/route writer/CAS/idempotency           | focused + fresh/upgrade realDB + affected B/V + system gate                     |
| Schema/migration                               | fresh + upgrade + double-apply + completeness + wszystkie consumer suites + B/V |
| Shared DTO/API/Gateway/flag                    | focused consumers + full standard/isolated/realDB + 32/32                       |
| Product SHA lub deploy config                  | static/build + migration readback + 32/32 deployed + rollback                   |
| Wyłącznie dokument/evidence                    | link/schema/diff/typecheck według wpływu; nie zmienia product SHA               |

## 10. Integracja i release

Integrator wykonuje kolejno:

1. zweryfikuj parent/allowlist/diff-check/clean worker;
2. cherry-pick w kolejności zależności;
3. zapisz `taskId → source SHA → canonical SHA → product SHA → evidence SHA`;
4. uruchom bramy z macierzy unieważniania;
5. zamroź nowy product SHA i zabezpiecz ref/tag/bundle/restore/fsck;
6. dopiero po autoryzacji: push nazwanej gałęzi bez force;
7. snapshot/preflight demo, migracje, deploy exact SHA, readback SHA/ledger/flags;
8. 16 agentów wykonuje swoje deployed `*-BVP-001` bez równoległych mutacji
   wspólnych fixtures;
9. rollback rehearsal;
10. integrator zamyka `REL-001-T01` i dopiero wtedy nadaje `P=PASS`.

## 11. Autorytatywne dokumenty pomocnicze

- `docs/cleanup/FINAL_16_MODULE_READINESS_AND_EXECUTION_PLAN_2026-08-15.md`
  — sekcje 10–12;
- `docs/cleanup/MODULE_COMPLETION_TASK_REGISTRY_2026-08-15.md` — finalne
  reconciliation;
- `docs/cleanup/MODULE_GAP_AND_INTEGRATION_PLAN_2026-08-15.md`;
- `docs/cleanup/HANDOFF_2026-08-15_CANONICAL_COMPLETION.md`;
- `docs/program/evidence/FINAL_ACCEPTANCE_14C8852A7.md`;
- `docs/program/gates/LOCAL_BROWSER_16_EVIDENCE_6e31012f.json`;
- `docs/cleanup/agents/MODULE_AGENT_TASK_QUEUE.md`.

Agent czyta ten plik w całości, następnie wyłącznie swoją kartę w kolejce oraz
bezpośrednio wskazane źródła. Nie interpretuje historycznych sekcji jako
aktywnego backlogu.
