# Claude E2 — Safe Legacy Cutover Build (15 tasks)

## Rola i odpowiedzialność

Jesteś właścicielem technicznym drugiej fali legacy cutover. Pracujesz jako Opus (szef), a Sonnety są wykonawcami. Masz **budować, naprawiać i dowodzić**, nie tylko audytować. Pracujesz aż każde zadanie przejdzie literalny DoD albo otrzyma precyzyjny `BLOCKED_OWNER`/`FIX_REQUIRED` z wykonanym całym zakresem niezależnym od blokera.

Nie wolno: push, merge, deploy, release, produkcyjny rollout, usuwanie branchy/worktree, masowe cherry-picki ani wyłączanie kolejnych writerów bez dowodu kwalifikacyjnego i decyzji właściciela.

## Start i izolacja

1. Utwórz nową gałąź `codex/claude-e2-safe-legacy-cutover` z canonical SHA
   `3e16c031d92d47fee45120ca4f946a2cc5ae4bf3`. Nie kontynuuj na starym
   tipie `97dd6077f6`. Ten SHA zawiera selektywnie zintegrowany kernel
   `bf0c28e3b77cf726899cb91fc42b011623248413`; E2-01 zaczyna się więc od
   weryfikacji i adaptacji tego kernela, a nie od ponownego portowania E1.
2. Stary branch `codex/claude-next-legacy-cutover` jest źródłem diffów i dowodów, nie bazą integracji.
3. Przed każdą edycją zapisz `pwd`, branch, HEAD, status i merge-base. Zatrzymaj się przy obcej zmianie w owned path.
4. Każdy nowy plik i migracja muszą należeć do jawnej allowlisty w handoffie.

### Allowlista E2

- `server/src/services/legacyCutover/**`
- `server/scripts/legacy-cutover-*.{ts,mjs}`
- nowe migracje wyłącznie `server/migrations/20260926_legacy_cutover_*.sql`
  lub późniejsze; **nie edytuj zastosowanych** `20260923` i `20260924`
- nowe testy pod `server/src/services/legacyCutover/__tests__/**` oraz
  `tests/integration/legacy-cutover/**`
- route-local pliki posiadające konkretny writer tylko dla minimalnego mountu
  po istniejącym auth/membership; każdy taki plik musi znaleźć się w
  `E2_ROUTE_MOUNT_ALLOWLIST.json` z writer IDs i uzasadnieniem hunków
- `docs/program/evidence/closure/claude-e2/**` oraz wygenerowane raporty E2

Denylista: `server/src/Gateway.ts`, `server/src/routes/v8/index.ts`, globalne
mounty, auth middleware, zmiany domyślnego rollout flag, usuwanie istniejących
tabel/tras, edycja zastosowanych migracji, automatyczne przejście do `DISABLED`.

### Mierzalny budżet E2-03/E2-05

Test: 30 minut, 50 równoległych uwierzytelnionych klientów oraz ciągły drugi
tenant jako kontrola negatywna. Porównanie observation OFF vs ON:

- przy zdrowym storage: wzrost p95 <= 10 ms, wzrost p99 <= 25 ms;
- przy niedostępnym storage: wzrost p95 <= 10 ms, wzrost p99 <= 25 ms,
  zero dodatkowych 5xx dla `OBSERVED/PROTECTED`;
- `DISABLED` pozostaje 100% fail-closed także przy awarii storage;
- zdrowy storage: 0 utraconych zaakceptowanych eventów i 0 tenant leak;
- kolejka jest ograniczona, a każdy drop/overflow ma licznik; wymuszony overflow
  nie może zwiększyć heapu po warm-up o >=20%;
- średnio nie więcej niż 1 DB round-trip na 100 observation events (bulk/batch)
  w stabilnym oknie;
- request error rate <0.5%; p95 całego non-AI API nadal <=750 ms i p99 <=1500 ms.

Przekroczenie któregokolwiek progu to literalny `FAIL`, nie ostrzeżenie ani
średnia ukrywająca czerwony przebieg.

## Cel końcowy

Zbudować na aktualnym canonical bezpieczny mechanizm, który potrafi wiarygodnie odpowiedzieć dla każdego legacy writera:

- kto i z którego tenanta go wywołał;
- czy request przeszedł prawdziwe auth i membership;
- czy istnieje jednoznaczny następca oraz pełna tożsamość rekordu;
- czy dane zostały zbackfillowane i są zgodne;
- czy writer można wyłączyć bez fałszywego sukcesu;
- jak go odwracalnie przywrócić;
- jaki jest zmierzony koszt telemetryki.

## Piętnaście zadań wykonawczych

### E2-01 — Rebase semantyczny kernela

Przenieś wyłącznie aktualne, potrzebne elementy kernela/registry/identity/denominator ze starego brancha na nowy canonical. Żadnego wholesale cherry-pick. Usuń założenia niezgodne z bieżącym schematem.

**DoD:** fresh migration, repeat 0, dry-run 0; unit + realPG kernel; exact lista portowanych i odrzuconych hunków.

### E2-02 — Auth-before-observation invariant

Usuń możliwość zapisu telemetryki przed `verifyToken`, aktywnym membership i tenant resolution. Observation ma być montowane route-local lub za wspólną, dowiedzioną granicą auth.

**DoD:** unsigned, expired, inactive-member i cross-tenant request nie tworzą eventu; prawidłowy request tworzy tenant-bound event.

### E2-03 — Non-blocking observation path

Zaprojektuj bounded observation sink bez synchronicznego `await INSERT` na każdej niepasującej trasie. Dopuszczalny jest trwały outbox/batch z ograniczoną kolejką i fail-open dla `OBSERVED`; `DISABLED` zawsze fail-closed niezależnie od awarii telemetryki.

**DoD:** DB outage/timeout nie zwiększa latencji observed ponad ustalony budżet i nigdy nie odblokowuje disabled writera; utrata/overflow jest jawnie liczona.

### E2-04 — Bezpieczeństwo i minimalizacja danych

Telemetryka nie może przechowywać payloadów, tokenów, sekretów ani PII. Dodaj limit długości, allowlistę pól, retencję i tenant-bound indeksy.

**DoD:** testy secret/PII negative, oversized input, injection/control chars, direct cross-tenant read denial oraz udokumentowana retencja.

### E2-05 — Pomiar kosztu i kontrola przeciążenia

Zbuduj benchmark dla 50 równoległych uwierzytelnionych klientów i drugiego tenanta. Porównaj observation OFF/ON oraz awarię storage.

**DoD:** p50/p95/p99, write amplification, heap, event loss/overflow; brak tenant leak; przekroczenie progu daje literalny FAIL, nie ostrzeżenie.

### E2-06 — Finance: wszystkie drzwi tego samego writera

Zmapuj i route-local obserwuj oba wejścia `approveModel()` oraz wszystkie inne aliasy tego samego efektu. Zachowaj obecne zachowanie do decyzji cutover.

**DoD:** real JWT/membership, tenant, oba endpointy, jeden writer identity, stable canonical identity, cold readback, brak nieautoryzowanego 410→409 contract drift.

### E2-07 — Partner: pieniądze i cztery routery

Obejmij route-local telemetryką payout, commission, settlement, rate/settings i superadmin paths, bez obchodzenia policy/approval.

**DoD:** każdy money writer ma ID, auth boundary, tenant/policy metadata, successor lub explicit null; testy approve/process/fail/reversal oraz cross-tenant.

### E2-08 — Results, Audits, Materials, Interview i Meetings

Zamontuj observation wyłącznie za właściwymi granicami auth każdej domeny. Nie używaj globalnego Gateway mount.

**DoD:** mounted real-auth test per domena; brak telemetryki dla odrzuconych przed auth; event dla dopuszczonego requestu; brak zmiany semantyki domenowej.

### E2-09 — Settings, Admin/Organization i pozostałe writery

Domknij registry oraz route-local observation pozostałych powierzchni, w szczególności security-sensitive i tenant-admin.

**DoD:** kompletna liczba zarejestrowanych writerów równa deterministycznemu inventory albo każdy brak ma jawny werdykt; zero anonimowych eventów.

### E2-10 — Canonical identity coverage

Rozszerz identity bridge poza cztery tabele Finance tylko tam, gdzie następca jest rzeczywiście dowiedziony. Nie wymyślaj mapowania.

**DoD:** legacy → artifact → business version → working revision albo explicit unresolved reason; collision, deleted successor i foreign tenant fail closed.

### E2-11 — Backfill i parity verifier

Zbuduj idempotentny, wznawialny backfill z checkpointem, dry-runem i raportem różnic. Nie modyfikuj biznesowych rekordów bez transakcji i receipt.

**DoD:** fresh fixture + istniejące rekordy; restart/reclaim; concurrent workers; same-key replay; zero orphanów; hash/count parity; rollback rehearsal.

### E2-12 — Deployed-window collector (bez deployu)

Zbuduj operator-ready collector i format raportu dla realnego okna telemetrycznego. W repo nie wolno udawać, że okno zostało wykonane.

**DoD:** start/end SHA, środowisko, tenant denominator, request count, last-seen, unresolved identities, error/overflow; `WINDOW_NOT_RUN` różne od zera.

### E2-13 — Safe-cutover verifier

Zbuduj maszynową bramę, która odmawia zmiany `OBSERVED/PROTECTED → DISABLED`, jeśli brakuje: okna, identity denominator=0 lub wyjątku ownera, backfill parity, successor contract, rollback i testów tenant/auth.

**DoD:** kompletna pozytywna fixture oraz osobne negatywne kontrole dla każdego wymogu; brak opcji force w normalnym workflow.

### E2-14 — Rollback i kompatybilność klienta

Dla Finance i Partner przygotuj realny rollback drill bez utraty danych. Zweryfikuj obecne klienty UI i kontrakty HTTP, zwłaszcza 410/409.

**DoD:** old/new client matrix, disabled→rollback→disabled, telemetry continuity, no duplicate writes, cold restart; żadnej zmiany publicznego kodu bez testu kompatybilności.

### E2-15 — Jednoznaczne rozliczenie programu

Wygeneruj 15 oddzielnych `TASK_EVIDENCE.json`, zbiorczy handoff i aktualny raport. Nie używaj jednego umbrella verdict.

**DoD:** każdy task ma baselineSha/productSha, changedPaths+rationale, exact commands/exits, denominators, fixtures, negativeControls, rollback, browserArtifacts, verdict i jeden konkretny blocker. Raport rozróżnia `DONE_CURRENT_SHA`, `PARTIAL`, `FIX_REQUIRED`, `BLOCKED_OWNER`, `NOT_VERIFIED`.

## Wspólne bramy końcowe

- worktree czysty; logiczne commity; brak push/merge/deploy;
- `git diff --check`;
- frontend i backend typecheck;
- backend i frontend build;
- strict migration od zera, repeat 0, dry-run 0, pełne checksumy;
- wszystkie repo-owned focused testy bez retry i bez skipów udających PASS;
- real PostgreSQL, prawdziwy podpisany JWT, aktywny membership, dwa tenanty;
- brak globalnego observation mountu przed auth;
- brak nowo wyłączonego writera bez jawnej decyzji właściciela i kompletnej bramy E2-13;
- finalny handoff zawiera commit-by-commit allowlist dla integratora.

## Zasada raportowania

Raportuj po dowiezionych zmianach, nie po samym odkryciu. Jeśli znajdziesz defekt, który mieści się w owned paths, napraw go i dowiedź. Eskaluj tylko decyzje produktowe, prawne, produkcyjny rollout lub konflikt ownership, którego nie da się ominąć bez zmiany zakresu.
