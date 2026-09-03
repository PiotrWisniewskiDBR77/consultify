# Wave 3 — Tools acceptance

ID: `TLS`
Routes: `/discovery-tools`
Current gate: `TECHNICAL_BROWSER_COMPLETE / OWNER_QUALITY_REVIEW_IN_PROGRESS / SPEC_A_CANVAS_REPLAY_BLOCKED_ON_LOCAL_FIXTURE / LIVE_REGISTER_OPEN / NO_REMEDIATION_AUTHORIZED`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: open Dynamic SWOT, complete meaningful input, inspect
analysis, create/promote an output and cold-reopen exact lineage.

Required boundaries: wrong tool/tenant, rejected proposal, stale lineage,
provider unavailable without false success and owner header at 1440/768.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Wave 3 scope is Dynamic SWOT on `/discovery-tools`; other catalog entries remain `COMING_SOON`. Task links: `TLS-BVP-001`, `TLS-CATALOG-001`, `TLS-UI-CANON-001`; all three exact-current evidence packets report `DONE_CURRENT_SHA`. Mobile and production AI-provider behavior are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS` | Kwalifikacja Day283: trwały manifest `docs/program/waves/WAVE_03_ACCEPTANCE/evidence/day283-g01-environment/03_TOOLS.json`; SHA-256 `b10856290b03e9f5204f061e48c41a5387ce88ca578ce849fc361b29a21e0c68`; swiezy `pgvector/pgvector:pg16`, 883 migracje i drugi przebieg 0; realne HTTP przez `ApiGateway`, rejestracja, podpisany JWT i zimny odczyt `200/200/200`; klient nie byl uruchamiany. Poprzedni stan bramki: `NOT_STARTED`. Poprzedni dowod: Rozstrzygnięcie fali A (2026-09-02): jedyny dowód to jednorazowy runtime z 2026-08-22 (porty `:3980`/`:3981`, retained DB `consultify_w3_tools_owner_browser_20260822`). Ten wiersz nie cytuje konkretnej ścieżki manifestu; zmierzone dziś: `ls /private/tmp/*tools*20260822*` nie zwraca żadnego pliku (katalog ma dziesiątki innych manifestów `consultify-wave3-runtime-manifest-day*.json`, żaden nie dotyczy tego przebiegu Tools). Runtime/DB z tego przebiegu nie jest dziś dostępny do sprawdzenia (poza zakresem tego dyżuru — praca bez serwera/bazy). Historyczny opis pozostaje wiarygodnym zapisem przeszłości, ale nie spełnia dzisiejszego progu „dowód daje się dziś sprawdzić i się zgadza". Poprzedni stan bramki: `PASS`. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Create/resume Dynamic SWOT → capture items and evidence → tensions → conclusions/recommended move → review/approve → immutable nonempty output → downstream promotion → cold reopen exact lineage. Boundaries cover tenant, role, stale writes, rejected proposals, wrong-tool lineage and provider failure without false success. |
| G03 | Named allowed/denied personas | `PASS` | Rozstrzygnięcie fali A (2026-09-02): zmierzone dziś czytaniem kodu — `server/scripts/seed-wave3-tools-owner-review.ts` zawiera nazwanego OWNERA (`w3.tools.owner@local.test`). Szersza macierz odmowy (nieaktywny członek, obcy najemca, złe narzędzie/sesja, stale writer) ma pokrycie w rzeczywistym pliku testowym `tests/integration/crossflow/cf-04-tools-swot-governance.realdb.test.ts` (governance/tenant boundary dla Dynamic SWOT) — plik fizycznie istnieje w repo. Same liczby przebiegów nie zostały dziś ponownie uruchomione (poza zakresem — brak serwera/bazy w tym dyżurze); rozstrzygnięcie opiera się na istnieniu i treści kodu, nie na świeżym przebiegu. Poprzedni stan bramki: `PASS_FOR_PREFLIGHT`. |
| G04 | Reproducible realistic and boundary fixtures | `PASS` | Technical fixtures create active memberships and clean by organization identity; tested-prefix residue is `0`. Local-only idempotent owner seed creates a guided `70%` journey and an approved `100%` cold-readback example without touching Piotr's existing session or overwriting review progress. |
| G05 | Functional preflight and cold readback | `PASS` | ZAMKNIĘTE 2026-09-02 pomiarem `G05` na wszystkich 16 modułach naraz. Metoda: świeży PostgreSQL, migracje przepuszczone dwukrotnie (drugi przebieg bezczynny), harness `server/src/scripts/g05-przelot.ts` uruchamiany przez `npx tsx` na realnym `ApiGateway` — **nie przez `vitest`**, który podmienia `fetch` na atrapę zwracającą zawsze sukces. Zapis wykonany realną trasą HTTP, sesja wygaszona, odczyt na zimno nowym żądaniem i nowym tokenem, porównanie **wartości pole po polu** — nie odpowiedzi zapisu (`Database.ts:686` zwraca `changes:1` dla każdego UPDATE, także pustego). Kontrola negatywna tokenem obcej organizacji przeszła. Pełny rejestr: `../../REJESTR_G05_PRZELOT_20260902.md`. Wynik dla tego modułu: **PRZEŻYWA** — zapis wrócił z bazy po wygaszeniu sesji, z zgodnymi wartościami. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `NOT_STARTED` | ZMIERZONE 2026-09-03 na markerze `2954ec8d37` (**po** naprawie zakresu skanu dostępności z dyżuru 285): **pełna macierz 8/8 kombinacji** (PL/EN × jasny/ciemny × 1440/1024) na 7 ekranach o ocenie A/B. Wynik: **18 kadrów z realnym naruszeniem dostępności** i **152 błędów konsoli lub żądań HTTP**. Naruszenia są liczone **po** podniesieniu kontrastu tokenów ostrzegawczych i naprawie czterech współdzielonych źródeł nazw — to jest dług pozostały, nie szum przyrządu. ★ **Uczciwe zastrzeżenie:** dane zebrał robotnik, który zablokował się w pętli czekania i **nie zacommitował ich ani razu**; nadzorca zatrzymał go, uratował 280 zrzutów z katalogu roboczego i zagregował. Surowe pliki poza repo: `/private/tmp/ag-g06f-a-artefakty/`. Bramka **nie może paść**, dopóki te naruszenia nie zostaną naprawione. Poprzedni stan bramki: `NOT_STARTED`. |
| G07 | Piotr review card | `PASS` | ZAMKNIĘTE 2026-09-02 przeglądem kart właściciela. Właściciel obejrzał i rozstrzygnął pojedynczo 7 kart tego modułu na stronie odbioru. Ekranów modułu w rejestrze grafiki: 9. Mianownik odbioru: 7 ekranów o ocenie A/B — wszystkie 7 mają decyzję właściciela. Poza odbiorem 2 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `tool-outputs-panel`, `tools-swot-live`. Decyzje w bazie dla ekranów tego modułu: ok 8, nie 0, poprawka 0 (w tym 1 na ekranach C/D, które dostały decyzję mimo bycia poza mianownikiem). Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Podstawa: decyzja właściciela z 2026-09-02, który zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd modułowy, wybrał „Uznaj przegląd kart za odbyty przegląd modułów”. Żadna z decyzji tego modułu nie pochodzi z akceptu zbiorowego z 2026-09-02 — objął on wyłącznie 5 ekranów sprzed zalogowania, które leżą poza wszystkimi 16 modułami. Poprzedni stan bramki: `READY_FOR_GUIDED_REPLAY`. |
| G08 | First-impression review | `PASS` | Pierwsze wrażenie właściciela jest zapisane jako imienna decyzja przy każdej z 7 kart. Ekranów modułu w rejestrze grafiki: 9. Mianownik odbioru: 7 ekranów o ocenie A/B — wszystkie 7 mają decyzję właściciela. Poza odbiorem 2 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `tool-outputs-panel`, `tools-swot-live`. Decyzje w bazie dla ekranów tego modułu: ok 8, nie 0, poprawka 0 (w tym 1 na ekranach C/D, które dostały decyzję mimo bycia poza mianownikiem). Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Kart z merytoryczną uwagą właściciela: 3 — są wypisane z nazwy w G17 i ten wpis ich NIE zamyka. Podstawa: decyzja właściciela z 2026-09-02, który zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd modułowy, wybrał „Uznaj przegląd kart za odbyty przegląd modułów”. Poprzedni stan bramki: `PARTIAL_BASELINE_APPROVED / INFORMATION_ARCHITECTURE_FINDINGS_OPEN`. |
| G09 | Guided CX journey review | `PASS` | Prowadzona podróż odbyła się w formie przeglądu kart ekranów (7 kart), a nie przebiegu klik-po-kliku; właściciel świadomie uznał tę formę za wystarczającą. Ekranów modułu w rejestrze grafiki: 9. Mianownik odbioru: 7 ekranów o ocenie A/B — wszystkie 7 mają decyzję właściciela. Poza odbiorem 2 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `tool-outputs-panel`, `tools-swot-live`. Decyzje w bazie dla ekranów tego modułu: ok 8, nie 0, poprawka 0 (w tym 1 na ekranach C/D, które dostały decyzję mimo bycia poza mianownikiem). Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Podstawa: decyzja właściciela z 2026-09-02, który zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd modułowy, wybrał „Uznaj przegląd kart za odbyty przegląd modułów”. Poprzedni stan bramki: `IN_PROGRESS_WITH_ARCHITECTURE_DECISIONS`. |
| G10 | Alternate-state owner review | `PASS` | Stany alternatywne objęte tylko w takim zakresie, w jakim rejestr grafiki ma dla tego modułu osobne ekrany stanów; osobnego przebiegu po stanach 2026-09-02 NIE prowadzono. Bramka stoi na decyzji właściciela, nie na osobnym przebiegu. Ekranów modułu w rejestrze grafiki: 9. Mianownik odbioru: 7 ekranów o ocenie A/B — wszystkie 7 mają decyzję właściciela. Poza odbiorem 2 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `tool-outputs-panel`, `tools-swot-live`. Decyzje w bazie dla ekranów tego modułu: ok 8, nie 0, poprawka 0 (w tym 1 na ekranach C/D, które dostały decyzję mimo bycia poza mianownikiem). Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Podstawa: decyzja właściciela z 2026-09-02, który zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd modułowy, wybrał „Uznaj przegląd kart za odbyty przegląd modułów”. Poprzedni stan bramki: `NOT_STARTED`. |
| G11 | Every owner observation/screenshot durably registered | `PASS` | Każda decyzja zapisana imiennie: 7 pozycji w bazie `../../../../grafika/odbior.sqlite` i w trwałym eksporcie `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji). Z treści: 3 kart niesie merytoryczną uwagę właściciela. To kompletność rejestru (intake), nie jego rozliczenie. Poprzedni stan bramki: `CAPTURE_COMPLETE_FOR_THIS_ROUND / FINAL_REPORT_WRITTEN`. |
| G12 | Owner register reconciled and confirmed | `PASS` | Rejestr potwierdzony przez właściciela 2026-09-02 słowami „wszystkie obrazy dostają ok, możemy uznać za odhaczone” dla 7 kart. Ekranów modułu w rejestrze grafiki: 9. Mianownik odbioru: 7 ekranów o ocenie A/B — wszystkie 7 mają decyzję właściciela. Poza odbiorem 2 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `tool-outputs-panel`, `tools-swot-live`. Decyzje w bazie dla ekranów tego modułu: ok 8, nie 0, poprawka 0 (w tym 1 na ekranach C/D, które dostały decyzję mimo bycia poza mianownikiem). Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Uwagi merytoryczne (3) pozostają otwarte i są rozliczane w G17. Poprzedni stan bramki: `OWNER_RECONCILIATION_PENDING`. |
| G13 | Solution and impact analysis | `PASS` | Poprzedni stan bramki (`RECOMMENDATION_COMPLETE / IMPLEMENTATION_NOT_AUTHORIZED`) dotyczył innego zakresu — rekomendacji platformowej narzędzi (`TOOLS_OWNER_REVIEW_FINAL_REPORT_2026-08-22.md`), nie ogólnej analizy wpływu defektów modułu; ten wpis pozostaje aktualny jako osobny, szerszy kontrakt i nie jest tu unieważniony. Ten wpis domyka bramkę wg formatu programu (stan wyłącznie `PASS`/`NOT_STARTED`/`OWNER_PENDING`): analiza wpływu 5 znalezisk zbudowana z rejestrów G06/CRIMSON/TRIAZ_UWAG + własnego grepa `focus:(ring\|border)-primary`: `docs/program/waves/WAVE_03_ACCEPTANCE/ANALIZA_G13_MODULY_01_08_20260903.md` sekcja `03_TOOLS`. Najważniejsze: `tools-swot-report` ma zepsute przełączanie języka (PL=EN) i realne naruszenia axe; pierścień fokusu = crimson zamiast `c-focus` w 23 miejscach `components/DiscoveryTools` (naruszenie CLAUDE.md wprost); crimson ogólny 287 wystąpień w >40 plikach (moduł w „5. pakiecie" rekomendowanej kolejności napraw całej aplikacji); 5/7 ekranów ma sekcje, które nie rozwijają się mimo próby. `PASS` = analiza kompletna wg dostępnego materiału, naprawy nie wykonane (poza zakresem G13). |
| G14 | Remediation with finding-to-commit traceability | `NOT_STARTED` | — |
| G15 | Integrator self-QA and impacted regression | `NOT_STARTED` | — |
| G16 | Before/after owner retest packet | `NOT_STARTED` | — |
| G17 | Owner retest decisions for every finding | `PASS` | ZAMKNIĘTE 2026-09-02 na wprost wyrażonym zatwierdzeniu właściciela: „zatwierdziłem całą grafikę, wszystkie ekrany”. Moduł **nie ma ani jednego rozstrzygnięcia poza „ok”** — sprawdzone maszynowo w `../../../../grafika/ODBIOR_DECYZJE.json`, nie z pamięci. Uwag merytorycznych przy kartach „ok”: 3. **Żadna nie została skasowana** — każda ma własny identyfikator i wiersz w trwałym rejestrze `../../BACKLOG_UWAG_ODBIORU_20260902.md`: `UW-03-01` (`karta-tool`), `UW-03-02` (`tools-swot-report`), `UW-03-03` (`tools-swot-session-workspace`). Są pozycjami produktowymi do rozliczenia po MVP, nie warunkiem tego zamknięcia. Podstawa formalna: właściciel zapytany o te uwagi 2026-09-02 odpowiedział, że warstwa ekranowa jest zatwierdzona w całości. Poprzedni stan bramki: `PARTIAL`. |
| G18 | Module accepted on exact SHA and checkpointed | `PASS` | Akcept warstwy ekranowej z 2026-09-02 zaczekpointowany na linii grafiki SHA `08775ced657a4d01effcfd5e02b5d3afa92e9f37`; tag `modul-03-narzedzia-final-20260902`. Zakres akceptu: **warstwa ekranowa**. Ten wpis NIE podnosi bramek technicznych G05/G06 ani cyklu napraw G13–G16, które w tym module pozostają w swoich stanach. Poprzedni stan bramki: `NOT_STARTED`. |
| G19 | Later-change regression obligations resolved | `NOT_STARTED` | — |
| G20 | Final 16/16 replay | `NOT_STARTED` | — |

## Piotr review card

| Purpose/value | Starting route | Persona/data | Guided actions | Conscious exclusions | Observation prompts |
|---|---|---|---|---|---|
| _prepare before G07_ | `/discovery-tools` | _pending_ | Start session → input → analysis → output → reopen lineage | Mobile; production AI provider | Consulting workflow, graphics, hierarchy, AI trust, actionable output |

## Persona and fixture ledger

| ID | Type | Purpose | Reproducible setup/reset | Durable readback | Expected access | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `TLS-TECH-01` | technical matrix | Catalog, tenant/role, CAS, immutable output and lineage boundaries | Local real PostgreSQL; unique fixtures; cleanup by exact organization/session identity | SQL/API/component assertions and tested-prefix residue query | allowed/denied matrix in G03 | `123/123 PASS` | source candidate `fbf400a8e3`; residue `0` |
| `TLS-OWNER-01` | owner-review fixture | Credible end-to-end Dynamic SWOT consulting journey | guarded retained DB `consultify_w3_tools_owner_browser_20260822`; FINAL manifest and durable marker | PostgreSQL plus mounted UI cold reopen | local owner in current organization | `TECHNICAL_BROWSER_COMPLETE / OWNER_REVIEW_PENDING` | guided: `80%`, 5 items, 1 tension; approved: `100%`, 5 items, 2 tensions, 1 move; both stable IDs cold-reopened after the fixture was aligned with the current five-phase mission/output model |

Owner fixture identifiers:

- guided session: `wave3-tools-owner-guided-v1`
- approved session: `wave3-tools-owner-approved-v1`

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `TLS-PF-001` | The catalog real-PG fixture sent authenticated headers but created no active organization memberships, so current authorization correctly rejected it. The fixture now seeds active ADMIN memberships in both isolated organizations. | Initial catalog replay stopped on `ORG_MEMBERSHIP_REVOKED`; corrected replay `6/6 PASS`; commit `fbf400a8e3`. | `FIXED_VERIFIED` |
| `TLS-PF-002` | The BVP teardown selected generated target rows by a session-ID prefix that their UUID identifiers did not contain, leaving two test lineage rows. Cleanup now scopes them by the exact fixture organizations. | Initial residue `2`; corrected BVP replay `11/11 PASS`; tested-prefix residue `0`; commit `fbf400a8e3`. | `FIXED_VERIFIED` |
| `TLS-PF-003` | Focused component tests pass but repeatedly emit React updates-not-wrapped-in-`act(...)` warnings. | Component/output replay `9/9` files, `78/78 PASS` with warning output. | `OPEN_NONBLOCKING_TEST_QUALITY` |
| `TLS-PF-004` | The frontend persistence adapter documentation and types still described optimistic concurrency as absent/optional after the server had already made it mandatory, risking saves without an authoritative expected version. | Adapter types now require numeric versions on create/GET/update; the sync hook re-reads a missing version before PUT and advances it only from the successful server receipt. Focused adapter/hook replay `2/2` files, `23/23 PASS`. | `FIXED_VERIFIED` |
| `TLS-PF-005` | Day 96 could not start the SPEC-A Canvas owner replay on the marker database: after `863` migrations the Tools fixture seeder required a pre-existing owner, while the canonical browser-persona seeder rejected the required `consultify_w3_tools_owner_*` database prefix. | `CODEX_DAY96_SPEC_A_CANVAS_REPORT.md`: three guarded attempts, `0/12` screenshots, `0/3` keyboard contracts measured; no manual SQL/persona fabrication and no product/runtime change. | `OPEN_FIXTURE_CONTRACT_BLOCKER / PARTIAL` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `W3-TLS-CX-001` | `2026-08-21` | „akceptuję jak jest — jest źle, ale zrobimy to w przejściu w fali 3” | `CUSTOMER_JOURNEY / VISUAL_DESIGN` | Full Dynamic SWOT journey | Wave 2 bounded header gate accepted; broader UX remains unspecified and unsatisfactory to Piotr. | Use the guided Wave 3 review to split the broad concern into exact testable visual and workflow findings without losing the original statement. | High risk of an unusable or visually weak consulting journey despite technical correctness. | Wave 2 P4 manifest and screenshot | `a36d9d51edc87bb63e7211754e22106d02d2d3d0` | `P2` | `CAPTURED / OWNER_SPECIFICATION_REQUIRED` | — | — | — |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

## Preflight implementation ledger

| Observation | Root cause | Resolution | Commit | Verification |
|---|---|---|---|---|
| `TLS-PF-001` | Historical fixture predated active-membership enforcement. | Seed two isolated organizations, user and active ADMIN memberships; clean the identity graph. | `fbf400a8e3` | catalog real-PG `6/6 PASS` |
| `TLS-PF-002` | Teardown assumed generated UUIDs inherited a human-readable prefix. | Delete fixture links by exact organization identity. | `fbf400a8e3` | BVP `11/11 PASS`; residue `0` |
| `TLS-OWNER-01` | The existing local session contained no meaningful inputs and could not support a credible owner round. | Add a guarded, non-overwriting local seed for guided and approved consulting states. | `dcbc89fde0` | PostgreSQL readback: 2 sessions; guided `5/1/0`, approved `5/2/1` items/tensions/moves |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: Wave 2 bounded acceptance does not replace Wave 3 Tools review.
Evidence manifest: —

## Day225 — sprostowanie komentarza i lokalny retest (2026-09-01)

Na markerze `0a35699021` sprostowano trzy nieaktualne bloki komentarza w
`toolsInsightsWiringFlag.ts`; kod wykonywalny i domyślne `false` nie zmieniły się.
Lokalny retest na świeżym PostgreSQL przeszedł przez realny `ApiGateway`, podpisany JWT
i `GET /api/tool-outputs`: pusty owner read `200 { outputs: [] }`, SQL→HTTP readback
wiersza organizacji `200`, brak tokenu `401`. Kanoniczny lokalny runtime z flagą włączoną
query zwrócił `/api/tool-outputs` `200` i wyrenderował zakładkę Insighty bez błędu
pełnoekranowego. Jest to dowód techniczny, nie akcept właścicielski i nie zmienia
`OWNER_QUALITY_REVIEW_IN_PROGRESS` ani domyślnego stanu flagi. Szczegóły i hashe:
`../../codex/CODEX_DAY225_NARZEDZIA_REPORT.md`.
