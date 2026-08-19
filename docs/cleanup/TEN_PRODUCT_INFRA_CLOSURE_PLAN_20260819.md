# Consultify — plan zamknięcia 10 zadań produktowych i infrastrukturalnych

Stan bazowy: `45cbf130630f5c6526a72e2d7a2d717c5523a40e`  
Data audytu: 2026-08-19  
Zakres: dokładnie 10 pozycji `PARTIAL` posiadających rzeczywisty brak produktu lub infrastruktury.

## Reguły wykonania

1. Zadania realizujemy jedno po drugim. Następne nie zaczyna implementacji przed czystym commitem, niezależnym audytem, exact-SHA requalification, aktualizacją evidence/reportera i autoryzowanym push poprzednika.
2. Równoległość jest dozwolona tylko wewnątrz aktywnego zadania: implementacja, read-only audyt i ciężki test na rozłącznych zasobach.
3. Każdy EPIC otrzymuje przed edycją zamrożony allowlist. Rozszerzenie wymaga jawnego `SOURCE_BOUND_RED`.
4. Liczą się wyłącznie zamontowane routery i UI, realna PostgreSQL, rzeczywiste signed sessions i cold readback. Mock, zastępczy router albo niezamontowany komponent nie kwalifikuje DoD.
5. `CODE_COMPLETE`, `READY_FOR_EXTERNAL_GATE` i `DONE_CURRENT_SHA` są odrębnymi stanami. Nie zastępujemy owner/deploy/release gate lokalną symulacją.
6. Każdy flake, harness red i run odrzucony jest raportowany. Kwalifikujący run ma zero retry produktu.

## Kolejność i estymacja

| # | Task | Szacunek | Dlaczego w tej kolejności |
|---:|---|---:|---|
| 1 | `DATA-DR-001` | 3–5 dni | Produkt prawie istnieje; brakuje lifecycle i realnego drill. |
| 2 | `TLS-BVP-001` | 2–3 dni | Mały niezależny packet i mounted G4. |
| 3 | `NFR-PERF-001` | 5–8 dni | Gate potrzebny przed dużymi cutoverami i release. |
| 4 | `SEC-PRIV-001` | 8–15 dni | Zero reachable High i auth/privacy gaps przed dalszą ekspansją. |
| 5 | `EXE-MVP-SPINE-001` | 15–25 dni repo po owner freeze; gate UNKNOWN | Kanoniczny Execution owner i health dla downstreamu. |
| 6 | `EXE-MVP-ACTIONS-001` | 5–8 dni | Dziewięć akcji kwalifikujemy na zamrożonym Spine. |
| 7 | `RES-MVP-LEGACY-CUTOVER-001` | 20–35 dni | Results owner/visibility przed pełnym FLOW. |
| 8 | `FIN-MVP-CUTOVER-001` | 25–45 dni | Finance identity/reconciliation przed pełnym FLOW. |
| 9 | `FLOW-TRANSFORM-MVP-001` | 12–20 dni | Pełny lineage dopiero po Execution, Results i Finance. |
| 10 | `AUD-POL-001` | 1–2 dni repo; gate UNKNOWN | Repo preflight uruchamiamy od razu, a zewnętrzny zegar biegnie równolegle; finalne DONE pozostaje dziesiątym zamknięciem. |

Suma policzalnej pracy repo dla tych 10: **96–166 dni roboczych po wymaganych owner freezes**, około **4,5–8 miesięcy** sekwencyjnie. Czas owner/map/backfill/environment/deployment gates jest obecnie **UNKNOWN**. Reporter po akceptacji Persona UAT wskazuje `47 DONE / 35 PARTIAL`; po odjęciu tych 10 pozostaje 25 innych `PARTIAL`. Szacunek pracy repo dla całego programu wynosi **6–10 miesięcy**; kalendarzowy termin release pozostaje nieograniczony do czasu wyznaczenia zewnętrznych dat. Ten code audit zastępuje historyczny forecast 71–128 agent-days / 3–6 miesięcy, ponieważ ujawnił 28 otwartych drzwi Results, 28 Finance, cztery modele Execution i osobne environment gates.

`AUD-POL-001` ma niezależny preflight przed zadaniem 1: evidence correction i current requalification prowadzą do `READY_FOR_EXTERNAL_GATE`. Oczekiwanie na flagę środowiska nie blokuje sekwencji kodowej, ale bez niej AUD nie jest DONE.

---

## 1. DATA-DR-001

**Cel:** realny szyfrowany backup w lifecycle aplikacji, RPO ≤15 min i izolowany restore ≤60 min.

**EPIC-i**

- `DR-1 Scheduler lifecycle`: start/stop jednej pracy `*/15`, single-flight, brak overlap.
- `DR-2 Fail-closed backup`: key, core owner tables, checksum, manifest, brak plaintext fallback.
- `DR-3 Durable health`: receipt/missed-run/failure state i obserwowalność.
- `DR-4 Isolated restore`: nowa PG16, tenant/owner readback, corrupt/wrong-key/same-target denial.
- `DR-5 Compatibility`: migration/backfill replay i previous-SHA reader matrix.

**IN:** `BackupCron`, `BackupService`, Scheduler/index lifecycle, opcjonalna migracja receipt, unit i RealPG drill.  
**OUT:** production KMS, S3/R2, production restore, destructive deletion.

**DoD:** dokładnie jedna praca na start; clean shutdown; brak duplicate artifacts; missing/wrong key i critical-table export error bez completed artifact; AES-256-GCM + checksum + manifest; backup age ≤15 min; isolated restore ≤60 min z exact markers/counts; corrupt/wrong-key/foreign-row/same-target deny; fresh/repeat/dry; compatibility; residue/locks/drop `0`; exact evidence.

**Testy:** unit lifecycle/overlap/missed tick/key; RealPG scheduled callback→artifact→cold restore; corruption/cross-tenant/same-target negatives; restart/readback; tsc/build.

**Zamknięcie:** repo-only `DONE_CURRENT_SHA` możliwe. External KMS/object-store/production restore pozostają release gate.

---

## 2. TLS-BVP-001

**Cel:** Dynamic SWOT mission/cards/evidence → review → freeze/promote → immutable, nonempty output.

**EPIC-i:** `TLS-1` korekta stale evidence; `TLS-2` mounted signed G4; `TLS-3` CAS/immutability/tenant negatives.

**IN:** nowy signed spec + fixture/helper; produkt tylko po realnym source red; exact TLS RealPG/regressions.  
**OUT:** przebudowa Tools UI i zmiana semantyki innych narzędzi.

**DoD:** realny SWOT przechodzi review/freeze/promote i cold reopen; stable source/output IDs; immutable output; empty conclusions → `409 EMPTY_TOOL_OUTPUT` i zero row; stale/foreign/revoked deny; fresh/repeat/dry; cleanup/residue/locks/drop `0`; evidence opisuje bieżący, nie historyczny stan.

**Testy:** TLS realPG i promote regressions; signed Chromium bez interception; DB/cold restart; typecheck/build.

**Zamknięcie:** repo może osiągnąć `READY_FOR_EXTERNAL_GATE`. Frozen G0–G6 zawiera G4; literalne DONE wymaga nazwanej human G4 acceptance albo autoryzowanej zmiany DoD.

---

## 3. NFR-PERF-001

**Cel:** 30 min / 50 authenticated users dla reprezentatywnego mounted workloadu oraz Web Vitals.

**EPIC-i**

- `PERF-1 Threshold authority`: 1500 ms read, 2500 ms write, errors <1%.
- `PERF-2 Representative load`: Case, My Work, Settings, Initiative, Finance.
- `PERF-3 Write reconciliation`: exact IDs, loss=0, duplicate=0, positive controls.
- `PERF-4 Web Vitals evidence`: repo-owned trace/artifact albo trwały walidowany batch; persistence jest preferowaną obserwowalnością, nie jedyną realizacją.
- `PERF-5 Browser p75`: desktop/mobile cold contexts.

**IN:** performance gate/runner/tests, ograniczone router fixtures i signed E2E; analytics route + jedna migracja tylko w wariancie durable persistence zamiast repo-owned trace/artifact.  
**OUT:** production SLA i tuning tras, które mieszczą się w progu.

**DoD:** 30 min/50 users; read p95≤1500, write p95≤2500, errors<1%; loss/duplicates/tenant false success=0; positive controls działają. Browser Web Vitals wymagają exact-SHA evidence. Desktop LCP≤2.5 s, mobile≤4 s, CLS≤0.10 i INP≤200 ms są **provisional engineering thresholds** wymagającymi owner acceptance, nie częścią zaakceptowanej decyzji 13A. Evidence może być trace/artifact albo cold-readable persistence. Exact SHA, no interception, clean DB i builds są obowiązkowe.

**Testy:** unit thresholds/positive controls; 30-min RealPG load; signed desktop/mobile; DB identity reconciliation i heap trend.

**Zamknięcie:** repo-only DONE możliwe; production availability jest osobnym release gate.

---

## 4. SEC-PRIV-001

**Cel:** zero reachable Critical/High, auth bypass, tenant escape i secret disclosure; pełny fail-closed privacy contract.

**EPIC-i:** `SEC-1` ACTIVE membership dla **deletion** request/cancel/status (export request/download już mają guard); `SEC-2` usunięcie/zastąpienie `pptxgenjs→image-size` High; `SEC-3` current+history secret scan; `SEC-4` mounted auth matrix.

**IN:** GDPR routes/tests; package/lock i export adapters; CI scanner/config; PPTX reopen tests; signed privacy.  
**OUT:** destructive deletion (approved-out) i bezterminowy High allowlist.

**DoD:** exact-SHA audit zero reachable Critical/High; current/history secret scan z pozytywną kontrolą; active/foreign/revoked dla export/request/cancel/status i denial przed write; export receipt/hash/download/cold replay; destructive executor absent/denied; SAML unsigned/unregistered deny; `run_script` nigdy nie wykonuje kodu; mounted auth matrix; cleanup; workflow/tsc/build green.

**Testy:** npm advisory+reachability; secret canary; RealPG auth/privacy; signed export/delete request; real PPTX generation/reopen po zmianie dependency.

**Zamknięcie:** repo-only DONE warunkowo możliwe. Domyślna ścieżka to replacement/remediation, bo PPTXGenJS jest osiągalny z mounted eksportów. `Unreachable` wymaga advisory-to-callsite proof; brak bezpośredniego importu lub allowlist nie wystarcza.

---

## 5. EXE-MVP-SPINE-001

**Cel:** jeden owner dla plan/tasks/milestones/RACI/resources/budget/capacity/RAID/issues/changes/decisions i jedna health formula.

**EPIC-i:** `SPINE-0` owner decision; `SPINE-1` 4-model/4-formula inventory; `SPINE-2` additive bridge/backfill; `SPINE-3` writer cutover; `SPINE-4` consumer/formula cutover; `SPINE-5` retirement/rollback.

**IN:** owner schema, initiative↔case bridge, adapters, four consumers, backfill, registry, mounted tests.  
**OUT:** nowe modelowanie poza frozen contract i produkcyjny backfill bez mapy.

**DoD:** owner-signed model/health; hostile/fresh/repeat migration; każdy old ID mapuje dokładnie raz albo trafia do quarantine; inventory dowodzi jednego write/health authority; Initiative→Execution→Results cold journey; old endpoints adapter-only/deny; foreign/revoked/stale/concurrent/collision negatives; rollback bez duplikacji; exact gates.

**Testy:** migration/backfill checksums; formula parity fixtures; mounted full journey/restart; legacy write denial; rollback rehearsal.

**Zamknięcie:** implementacja nie startuje przed `SPINE-0`. Literalne DONE wymaga zaakceptowanej mapy/backfillu.

---

## 6. EXE-MVP-ACTIONS-001

**Cel:** denominator 13 = 9 governed actions w pełni kwalifikowanych + 4 rzeczywiście hidden.

**EPIC-i:** `ACT-1` inventory freeze; `ACT-2` loading/empty/error/success dla 9 UI; `ACT-3` authority/audit atomicity; `ACT-4` hidden/direct denial.

**IN:** parameterized signed browser/fixture i wyłącznie komponenty z realnym state gap; existing backend suites.  
**OUT:** redesign Execution i nowe actions poza 13.

**DoD:** registry 9+4; każda governed action ma success+cold readback+immutable audit; insufficient/foreign/revoked/not-found/stale/conflict deny; forced audit failure rollback; każde UI ma cztery stany; hidden brak w UI i direct deny; cleanup/static/evidence.

**Testy:** requalify focused 43/43 i RealPG 21/21; signed per action/state; direct route negatives; audit rollback.

**Zamknięcie:** repo może osiągnąć `READY_FOR_EXTERNAL_GATE` po zamrożeniu Spine. Frozen G4 wymaga faktycznej human UX/persona/brand acceptance albo autoryzowanej zmiany DoD.

---

## 7. RES-MVP-LEGACY-CUTOVER-001

**Cel:** jeden kanoniczny Results ownership spine i owner per operation, parity/backfill/usage, zero legacy dual-writer/fallback, read-only archive i rollback.

**EPIC-i:** `RES-1` pełny writer inventory; `RES-2` successor dla 28 reguł i drzwi poza mountem; `RES-3` aliases/backfill/quarantine; `RES-4` caller cutover; `RES-5` retirement/archive/telemetry; `RES-6` rollback.

**IN:** HTTP i non-HTTP writers/readers, missing semantics, migrations, registry, callers, opcjonalny archive UI, RealPG/E2E.  
**OUT:** zmiana Results visibility matrix i inferowanie niejednoznacznych danych.

**DoD:** literalny denominator wszystkich doors; każdy ma successor albo approved-out; deterministic backfill/parity/quarantine; legacy production caller/fallback=0; retired writers disabled; signed same-tenant read-only archive; role/foreign/revoked/cold proof; legacy mutations/duplicates/orphans=0; usage window+owner retirement; rollback; exact migrations/evidence.

**Testy:** inventory compiler/registry; hostile/late backfill; per-writer successor tests; signed visibility/archive; usage i rollback qualification.

**Zamknięcie:** kod można przygotować repozytoryjnie; literalne DONE wymaga usage window, owner retirement i rollback authorization.

---

## 8. FIN-MVP-CUTOVER-001

**Cel:** jeden Finance V8/compatibility spine i ID space dla 30-door inventory, zero legacy fallback.

**EPIC-i:** `FIN-1` current 2 retired/28 open inventory; `FIN-2` canonical semantics; `FIN-3` artifact/BV/WR/alias backfill; `FIN-4` caller cutover; `FIN-5` retirement/telemetry/rollback; `FIN-6` regression integration z osobnym `FIN-MVP-RECONCILIATION-001`, bez przejmowania jego zakresu.

**IN:** 30-door registry/callers, brakujące writers/readers, migrations/backfill, UI cutover, RealPG/browser.  
**OUT:** sync→async substitution bez parity, dual-write i rollout przed telemetry.

**DoD:** 30/30 niekolidujących IDs; bit/contract-equivalent write+cold read per operation; deterministic aliases/backfill/quarantine; legacy callers/fallback=0; retries/concurrency one job/output/version; mapped/unmapped/foreign/revoked/stale deny; no legacy output mutation; osobny reconciliation seam pozostaje green, ale maker-checker DoD należy do `FIN-MVP-RECONCILIATION-001`; all doors retired z selective/global rollback; signed workspace/cold identity i clean DB.

**Testy:** inventory/kernel; per-operation parity; backfill RealPG; signed create/edit/compute/events/delete/baseline; concurrency/restart; rollback i runtime zero-fallback.

**Zamknięcie:** duży program kodowy; literalne DONE wymaga rollout/telemetry i reconciliation authority.

---

## 9. FLOW-TRANSFORM-MVP-001

**Cel:** Organization/Interview/DRD/SWOT → Candidate → Initiative → Execution → Results Actual → Finance reconciliation → PIR, stable IDs.

**EPIC-i:** `FLOW-1` trzy brakujące source adapters; `FLOW-2` candidate authority; `FLOW-3` four-source full-lineage matrix; `FLOW-4` real visibility/SoD bez synthetic policy; `FLOW-5` desktop/mobile/rollback.

**IN:** adapters/receipts/UI dla Organization, Interview, DRD; full RealPG; signed downstream; policy/SoD negatives.  
**OUT:** uznawanie Idea Process Flow z `e070` za substytut trzech źródeł, syntetyczna policy jako production proof i kończenie na Candidate.

**DoD:** każde z 4 źródeł ma immutable snapshot/hash/receipt; approval tworzy jednego candidate; source/candidate/initiative/execution/actual/reconciliation/PIR mają stabilne, trwale powiązane odrębne identities i correlation receipts; restart zachowuje IDs/hash/linkage; concurrency/replay/collision/tenant/stale deny; injected failure zero partial/orphans; real authority+maker-checker; signed desktop/mobile exact SHA; rollback zachowuje immutable history; clean evidence.

**Prerequisites poza tym planem:** przed FLOW muszą być DONE albo jawnie approved-out `RES-MVP-VISIBILITY-001`/aktualna Results visibility authority oraz osobny `FIN-MVP-RECONCILIATION-001`. Nie wolno wchłaniać ich zakresu do FLOW ani FIN cutover.

**Testy:** source-specific RealPG; parameterized four-source full lineage; signed approval/deep links/reload; policy/SoD/concurrency/rollback; deployed SHA/DB/flags readback.

**Zamknięcie:** repo zamyka adapters i technical matrix; literalne DONE wymaga real policy authority, deployed journeys i rollback rehearsal.

---

## 10. AUD-POL-001

**Cel:** tylko internal Transformation Audit Pack, external standards OFF, SoD fail-closed i działający independence detector.

**EPIC-i:** `AUD-1` stale evidence correction; `AUD-2` dynamiczny exact-current denominator i requal (na SHA bazowym 25 testów; plik zawiera literalny NUL i bywa klasyfikowany jako data); `AUD-3` detector environment operationalization; `AUD-4` owner acceptance.

**IN:** głównie evidence/runtime; product tylko po source red; scheduler/observability proof.  
**OUT:** ISO/SOC2/NIST i nowe external packs.

**DoD:** internal pack jedyny dostępny; external presets UI/API/direct deny; self-approval deny; cron true na exact SHA; single claimant, cursor persistence, violation log/alert i observable failure; detector nie mutuje decisions; current suite+owner sign-off; evidence clean.

**Testy:** current rights/policy RealPG; scheduler lease/cursor; mounted external-standard denial; environment log/alert receipt.

**Zamknięcie:** repo blisko gotowe; literalne DONE wymaga environment flag i owner sign-off.

---

## Kontrola programu

Po każdym zadaniu zapisujemy planowane/rzeczywiste dni, liczbę EPIC-ów i ścieżek, source/harness/flaky reds, czas uwagi głównego wykonawcy, reporter 82 przed/po i nową prognozę. Dwa kolejne przekroczenia górnej estymacji o >30% zatrzymują implementację i wymuszają reestymację. Zadanie zależne od zewnętrznego gate kończymy jako `READY_FOR_EXTERNAL_GATE` z jednym precyzyjnym owner action; nie budujemy lokalnego substytutu.
