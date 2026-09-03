# Wave 3 — Interview acceptance

ID: `INT`
Routes: `/interview`, `/interview/respond/:token`
Current gate: `OWNER_INTAKE_CLOSED / RECOMMENDATION_REGISTER_READY / CREATOR_SKEPTICAL_REVIEW_COMPLETE / PROTOTYPE_GATE_REQUIRED / IMPLEMENTATION_NOT_STARTED`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: create/manage an interview and complete the isolated public
respondent path with durable response readback.

Required boundaries: expired/replayed/foreign token, respondent isolation from
organization navigation, insufficient manager role and duplicate submission.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Routes: authenticated `/interview` and isolated public `/interview/respond/:token`. Task links: `INT-BVP-001`, `INT-DELIVERY-OPS-001`, `INT-UI-CANON-001`; all three exact-current evidence packets report `DONE_CURRENT_SHA`. Mobile, production outreach and production release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS` | Kwalifikacja Day283: trwały manifest `docs/program/waves/WAVE_03_ACCEPTANCE/evidence/day283-g01-environment/02_INTERVIEW.json`; SHA-256 `e85a47318ce9c861c397e891b47efe8f8fc63b032511b62b04d6e3706bec6697`; swiezy `pgvector/pgvector:pg16`, 883 migracje i drugi przebieg 0; realne HTTP przez `ApiGateway`, rejestracja, podpisany JWT i zimny odczyt `200/200/200`; klient nie byl uruchamiany. Poprzedni stan bramki: `NOT_STARTED`. Poprzedni dowod: Rozstrzygnięcie fali A (2026-09-02): jedyny dowód to jednorazowy runtime z 2026-08-22 (porty `:3984`/`:3985`, retained DB `consultify_w3_interview_owner_browser_20260822`, plik `/private/tmp/consultify-wave3-runtime-manifest-interview-retest-20260822.json`). Zmierzone dziś: ten plik fizycznie NIE istnieje w `/private/tmp` (sprawdzono `ls`; katalog ma dziesiątki innych manifestów `consultify-wave3-runtime-manifest-day*.json`, ale nie ten). Runtime/DB z tego przebiegu nie jest dziś dostępny do sprawdzenia (poza zakresem tego dyżuru — praca bez serwera/bazy). Historyczny opis pozostaje wiarygodnym zapisem przeszłości, ale nie spełnia dzisiejszego progu „dowód daje się dziś sprawdzić i się zgadza". Poprzedni stan bramki: `PASS`. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Manager: create/publish/assign/invite/review. Respondent: opaque token → resume/CAS answer → submit. Downstream: approved insight → exactly one initiative candidate. Durable boundaries include token expiry/revoke, anonymity wall, tenant/role access, answer CAS, AI timeout audit, notification fallback and immutable handoff receipt. |
| G03 | Named allowed/denied personas | `PASS` | Rozstrzygnięcie fali A (2026-09-02): zmierzone dziś czytaniem kodu — `server/scripts/seed-wave3-interview-owner-review.ts` zawiera nazwanego OWNERA i granicę revoked/expired token (`revokedDistribution`, `revoked_at`, publiczna trasa `/interview/respond/:token` z tokenem odwołanym). Szersza macierz odmowy (nieaktywny członek, ADMIN obcego najemcy, replay/concurrent stale writer) ma pokrycie w rzeczywistych plikach testowych PostgreSQL, m.in. `server/src/routes/interviewDelivery/__tests__/interviewGetSessionAccessMatrix.pg.test.ts` i sąsiadujące pliki `interviewDelivery/__tests__/*.pg.test.ts` — pliki fizycznie istnieją w repo, ich treść odpowiada opisanym granicom. Same liczby przebiegów (`70/70` itd.) nie zostały dziś ponownie uruchomione (poza zakresem — brak serwera/bazy w tym dyżurze); rozstrzygnięcie opiera się na istnieniu i treści kodu, nie na świeżym przebiegu. Poprzedni stan bramki: `PASS_FOR_PREFLIGHT`. |
| G04 | Reproducible realistic and boundary fixtures | `PASS` | Technical fixture: disposable `int_bvp_*` database with explicit immutable-cleanup opt-in, opaque 256-bit tokens, two isolated organizations and unique `intbvp001-*` identities; residue `0`, immutable trigger enabled (`O`). Owner fixture: local-only idempotent seed `seed-wave3-interview-owner-review.ts`, two coherent sessions, six realistic Polish questions/answers, active anonymous link, submitted manager-review state and revoked-link boundary. Reseeding preserves respondent answers and terminal state. |
| G05 | Functional preflight and cold readback | `PASS` | ZAMKNIĘTE 2026-09-02 pomiarem `G05` na wszystkich 16 modułach naraz. Metoda: świeży PostgreSQL, migracje przepuszczone dwukrotnie (drugi przebieg bezczynny), harness `server/src/scripts/g05-przelot.ts` uruchamiany przez `npx tsx` na realnym `ApiGateway` — **nie przez `vitest`**, który podmienia `fetch` na atrapę zwracającą zawsze sukces. Zapis wykonany realną trasą HTTP, sesja wygaszona, odczyt na zimno nowym żądaniem i nowym tokenem, porównanie **wartości pole po polu** — nie odpowiedzi zapisu (`Database.ts:686` zwraca `changes:1` dla każdego UPDATE, także pustego). Kontrola negatywna tokenem obcej organizacji przeszła. Pełny rejestr: `../../REJESTR_G05_PRZELOT_20260902.md`. Wynik dla tego modułu: **PRZEŻYWA** — zapis wrócił z bazy po wygaszeniu sesji, z zgodnymi wartościami. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PASS` | ZMIERZONE 2026-09-03 PEŁNĄ MACIERZĄ na markerze `fee24bddb0` (nadzorca; `scripts/dev/g06-macierz-uruchom.mjs` → kanoniczny `grafika-zrzuty.mjs` z domyślnym klikiem w wiersz, `--rozwin-sekcje=1 --a11y=1`, skan na `#dev-render-root`): 6 ekranów A/B × 8 kadrów (PL/EN × jasny/ciemny × 1440/1024) = 48 kadrów. Odjęte WYŁĄCZNIE trzy reguły hosta (`landmark-one-main`, `page-has-heading-one`, `region`); 404 na `/api/*` i komunikaty pochodne braku backendu liczone osobno (1 ekranów), nie jako defekt. **Zero realnych naruszeń a11y, zero realnych błędów konsoli, zero złych statusów, PL≠EN na każdym ekranie, pary jasny/ciemny poprawne.** Manifesty w repo: `evidence/grafika/g06-macierz-final-20260903/02_INTERVIEW/`; agregat: `evidence/grafika/g06-macierz-final-20260903/AGREGAT.md`; PNG poza repo: `/private/tmp/g06-final3-20260903-artefakty/02_INTERVIEW/`. Poprzedni stan bramki: `NOT_STARTED` (notatka z poprzedniego pomiaru w historii git tego pliku). |
| G07 | Piotr review card | `PASS` | ZAMKNIĘTE 2026-09-02 przeglądem kart właściciela. Właściciel obejrzał i rozstrzygnął pojedynczo 6 kart tego modułu na stronie odbioru. Ekranów modułu w rejestrze grafiki: 7. Mianownik odbioru: 6 ekranów o ocenie A/B — wszystkie 6 mają decyzję właściciela. Poza odbiorem 1 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `insight-artifact`. Decyzje w bazie dla ekranów tego modułu: ok 6, nie 0, poprawka 0. Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Podstawa: decyzja właściciela z 2026-09-02, który zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd modułowy, wybrał „Uznaj przegląd kart za odbyty przegląd modułów”. Żadna z decyzji tego modułu nie pochodzi z akceptu zbiorowego z 2026-09-02 — objął on wyłącznie 5 ekranów sprzed zalogowania, które leżą poza wszystkimi 16 modułami. Poprzedni stan bramki: `READY_FOR_GUIDED_REPLAY`. |
| G08 | First-impression review | `PASS` | Pierwsze wrażenie właściciela jest zapisane jako imienna decyzja przy każdej z 6 kart. Ekranów modułu w rejestrze grafiki: 7. Mianownik odbioru: 6 ekranów o ocenie A/B — wszystkie 6 mają decyzję właściciela. Poza odbiorem 1 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `insight-artifact`. Decyzje w bazie dla ekranów tego modułu: ok 6, nie 0, poprawka 0. Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Kart z merytoryczną uwagą właściciela: 3 — są wypisane z nazwy w G17 i ten wpis ich NIE zamyka. Podstawa: decyzja właściciela z 2026-09-02, który zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd modułowy, wybrał „Uznaj przegląd kart za odbyty przegląd modułów”. Poprzedni stan bramki: `PARTIAL_TABLE_SURFACES_APPROVED`. |
| G09 | Guided CX journey review | `PASS` | Prowadzona podróż odbyła się w formie przeglądu kart ekranów (6 kart), a nie przebiegu klik-po-kliku; właściciel świadomie uznał tę formę za wystarczającą. Ekranów modułu w rejestrze grafiki: 7. Mianownik odbioru: 6 ekranów o ocenie A/B — wszystkie 6 mają decyzję właściciela. Poza odbiorem 1 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `insight-artifact`. Decyzje w bazie dla ekranów tego modułu: ok 6, nie 0, poprawka 0. Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Podstawa: decyzja właściciela z 2026-09-02, który zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd modułowy, wybrał „Uznaj przegląd kart za odbyty przegląd modułów”. Poprzedni stan bramki: `OWNER_INTAKE_COMPLETE_WITH_FINDINGS`. |
| G10 | Alternate-state owner review | `PASS` | Stany alternatywne objęte tylko w takim zakresie, w jakim rejestr grafiki ma dla tego modułu osobne ekrany stanów; osobnego przebiegu po stanach 2026-09-02 NIE prowadzono. Bramka stoi na decyzji właściciela, nie na osobnym przebiegu. Ekranów modułu w rejestrze grafiki: 7. Mianownik odbioru: 6 ekranów o ocenie A/B — wszystkie 6 mają decyzję właściciela. Poza odbiorem 1 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `insight-artifact`. Decyzje w bazie dla ekranów tego modułu: ok 6, nie 0, poprawka 0. Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Podstawa: decyzja właściciela z 2026-09-02, który zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd modułowy, wybrał „Uznaj przegląd kart za odbyty przegląd modułów”. Poprzedni stan bramki: `NOT_STARTED`. |
| G11 | Every owner observation/screenshot durably registered | `PASS` | Każda decyzja zapisana imiennie: 6 pozycji w bazie `../../../../grafika/odbior.sqlite` i w trwałym eksporcie `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji). Z treści: 3 kart niesie merytoryczną uwagę właściciela. To kompletność rejestru (intake), nie jego rozliczenie. Poprzedni stan bramki: `PASS_CURRENT_INTAKE`. |
| G12 | Owner register reconciled and confirmed | `PASS` | Rejestr potwierdzony przez właściciela 2026-09-02 słowami „wszystkie obrazy dostają ok, możemy uznać za odhaczone” dla 6 kart. Ekranów modułu w rejestrze grafiki: 7. Mianownik odbioru: 6 ekranów o ocenie A/B — wszystkie 6 mają decyzję właściciela. Poza odbiorem 1 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `insight-artifact`. Decyzje w bazie dla ekranów tego modułu: ok 6, nie 0, poprawka 0. Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Uwagi merytoryczne (3) pozostają otwarte i są rozliczane w G17. Poprzedni stan bramki: `PASS_FOR_CURRENT_INTAKE`. |
| G13 | Solution and impact analysis | `PASS` | Poprzedni stan bramki (`READY_FOR_PROTOTYPE_SPEC / NOT_READY_FOR_IMPLEMENTATION`) dotyczył innego zakresu — briefu kreatora treści Teresy (`CREATOR_SKEPTICAL_REVIEW.md`, `REC-INT-001..009`), nie ogólnej analizy wpływu defektów modułu; ten wpis pozostaje aktualny jako osobny, węższy kontrakt i nie jest tu unieważniony. Ten wpis domyka bramkę wg formatu programu (stan wyłącznie `PASS`/`NOT_STARTED`/`OWNER_PENDING`): analiza wpływu 5 znalezisk zbudowana z rejestrów G05/G06/CRIMSON/PODGLAD_RODZINA/TRIAZ_UWAG: `docs/program/waves/WAVE_03_ACCEPTANCE/ANALIZA_G13_MODULY_01_08_20260903.md` sekcja `02_INTERVIEW`. Najważniejsze: kreator wywiadu gotowy, ale za flagą domyślnie OFF, jakość wizualna niepotwierdzona (`UW-02-02`); 2/6 zmierzonych ekranów ma realne naruszenia axe; 4/6 ekranów ma sekcje, które nie rozwijają się mimo próby; crimson minimalny (5 wystąpień); podgląd czysty (0px luki). `PASS` = analiza kompletna wg dostępnego materiału, naprawy nie wykonane (poza zakresem G13). |
| G14 | Remediation with finding-to-commit traceability | `PARTIAL / OWNER_DECISION_PENDING` | 2026-09-03 (nadzorca, marker `117bc9f743`): dyżur agentowy G14 dla tego modułu zakończony — ślad znalezisko→status→commit→dowód w `evidence/g14/G14_01_04_20260903.md`. Każde znalezisko z ANALIZA_G13 ma jeden z czterech statusów: NAPRAWIONE (commit SHA), POTWIERDZONE WCZEŚNIEJ (commit innego dyżuru z 03.09: dostępność `evidence/grafika/a11y-fix-*.md`, język `i18n-pl-en-20260903.md`, przewody `przewody-odbioru-20260903.md`), POMINIĘTE z powodem, NIEPOTWIERDZONE/obalone własnym pomiarem. Bramka nie może paść na PASS, dopóki właściciel nie rozstrzygnie pozycji DUŻE i wymagających decyzji produktowej — lista z rekomendacją CTO: `docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md`; po decyzji każda pozycja dostaje numer DEC i status „w budowie" albo „odłożone", i dopiero wtedy PASS. Poprzedni stan bramki: `NOT_STARTED` (poprzednia notatka w historii git). |
| G15 | Integrator self-QA and impacted regression | `NOT_STARTED` | — |
| G16 | Before/after owner retest packet | `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING` | 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-02_INTERVIEW-20260903-reszta.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `evidence/grafika/g06-macierz-final-20260903/AGREGAT.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`; zrzuty PRZED/PO poza repo w katalogach `/private/tmp/ag-*-artefakty/` wskazanych w plikach śladu; manifesty pełnej macierzy G06 w `evidence/grafika/g06-macierz-final-20260903/02_INTERVIEW/`. Retest właściciela = przelot po stagingu na REALNYCH danych, moduł po module, z otwarciem realnego rekordu z listy (DEC-2026-09-03-346: odbiór na fiksturze pokazowej nie jest odbiorem). Wdrożenie na staging czeka na słowo właściciela (uruchamia je promocja na `develop`). Poprzedni stan bramki: `NOT_STARTED` (poprzednia notatka w historii git). |
| G17 | Owner retest decisions for every finding | `PASS` | ZAMKNIĘTE 2026-09-02 na wprost wyrażonym zatwierdzeniu właściciela: „zatwierdziłem całą grafikę, wszystkie ekrany”. Moduł **nie ma ani jednego rozstrzygnięcia poza „ok”** — sprawdzone maszynowo w `../../../../grafika/ODBIOR_DECYZJE.json`, nie z pamięci. Uwag merytorycznych przy kartach „ok”: 3. **Żadna nie została skasowana** — każda ma własny identyfikator i wiersz w trwałym rejestrze `../../BACKLOG_UWAG_ODBIORU_20260902.md`: `UW-02-01` (`karta-insight`), `UW-02-02` (`interview-creator-shell`), `UW-02-03` (`interview-preview-canon`). Są pozycjami produktowymi do rozliczenia po MVP, nie warunkiem tego zamknięcia. Podstawa formalna: właściciel zapytany o te uwagi 2026-09-02 odpowiedział, że warstwa ekranowa jest zatwierdzona w całości. Poprzedni stan bramki: `PARTIAL`. |
| G18 | Module accepted on exact SHA and checkpointed | `PASS` | Akcept warstwy ekranowej z 2026-09-02 zaczekpointowany na linii grafiki SHA `08775ced657a4d01effcfd5e02b5d3afa92e9f37`; tag `modul-02-wywiad-final-20260902`. Zakres akceptu: **warstwa ekranowa**. Ten wpis NIE podnosi bramek technicznych G05/G06 ani cyklu napraw G13–G16, które w tym module pozostają w swoich stanach. Poprzedni stan bramki: `NOT_STARTED`. |
| G19 | Later-change regression obligations resolved | `NOT_STARTED` | — |
| G20 | Final 16/16 replay | `NOT_STARTED` | — |

### Day 119 — przekrojowy kontrakt trzech stanów

`FIXED_WITH_MUTATION_EVIDENCE / OWNER_REVIEW_PENDING`: na SHA
`70c68154f8770ad41ac76e976aae5591ff789068` osiągalne powierzchnie
`InterviewHub` (Templates) i `InsightViewer` (Findings) używają wspólnego
kontraktu `known/partial/unknown`; błąd odczytu nie jest już prezentowany jako
znane zero. Mutacja unknown→`0` dała dokładnie jeden czerwony przypadek z
`--retry=0`; przywrócenie przez `cp` dało `7/7` i pusty diff. Kanoniczny runtime
z auth bypass OFF pokazał realny alert unknown dla błędu Templates; pakiet
`known/unknown × light/dark` ma `4/4` PNG. Raport:
`../../codex/CODEX_DAY119_TRZY_STANY_REPORT.md`. To nie zamyka G18 ani odbioru
właściciela.

## Piotr review card

| Purpose/value | Starting route | Persona/data | Guided actions | Conscious exclusions | Observation prompts |
|---|---|---|---|---|---|
| _prepare before G07_ | `/interview` | _pending_ | Create/manage interview → open respondent link → submit → readback | Production outreach | Interview clarity, respondent trust, completion friction, result usefulness |

## Persona and fixture ledger

| ID | Type | Purpose | Reproducible setup/reset | Durable readback | Expected access | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `INT-TECH-01` | technical matrix | Invite, respondent, manager, delivery, timeout and candidate boundaries | Fresh disposable DB `int_bvp_wave3_20260821`; unique per-run fixtures; immutable cleanup requires both opt-in and `int_bvp_*` DB prefix | independent SQL assertions and cold-pool assertions in real-PG suites | allowed/denied matrix in G03 | `70/70 PASS` | current source candidate `d3d6de5bfc` |
| `INT-OWNER-01` | owner-review fixture | Credible manager and anonymous-respondent journey | guarded loopback DB `consultify_w3_interview_owner_browser_20260822`; FINAL write-once manifest and durable marker | live public API + PostgreSQL + mounted cold UI replay | local owner + token-only anonymous respondent | `TECHNICAL_BROWSER_COMPLETE_WITH_PROVIDER_UNAVAILABLE` | 2 sessions, 6 questions, 2 distributions; corrected exact-runtime manager and active-public cold readback; revoked `410`; exactly one canonical evaluation `503`, zero compatibility retries and honest `Brak oceny` UI |

Owner fixture identifiers:

- template: `wave3-int-owner-template-v1`
- public session: `wave3-int-owner-public-session-v1`
- submitted manager-review session: `wave3-int-owner-review-session-v1`
- public distribution: `wave3-int-owner-public-distribution-v1`
- revoked distribution: `wave3-int-owner-revoked-distribution-v1`
- the local token routes are emitted by the seed at runtime and are deliberately
  not copied into this durable document

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `INT-PF-001` | The historical exactly-once test tried to delete an immutable handoff receipt and failed during teardown after all functional assertions passed. Cleanup now requires an explicit opt-in, a verified `int_bvp_*` disposable database, transaction-local replica role, zero-residue proof and enabled-trigger readback. | Initial current-SHA replay: `70/70` functional assertions with teardown failure; corrected replay on fresh PostgreSQL: `70/70 PASS`, residue `0`, trigger `O`; commit `9fcff61b7d`. | `FIXED_VERIFIED` |
| `INT-PF-002` | The shared candidate scanner referenced nonexistent `assessments.title` and `assessments.summary` columns. Its fail-soft catch hid the schema error and silently skipped Assessment candidates during an Interview scan. The query now uses canonical `name` and `description` columns. | Real-PG query error on initial replay; corrected exactly-once suite `11/11 PASS` without the missing-column error; commit `291e37340f`. | `FIXED_VERIFIED` |
| `INT-PF-003` | The authenticated hub was blanket-gated by global V8 availability even though authoring remains a supported legacy-canonical contract; V8 assignments/insights silently fell back to legacy, masking contract and tenant failures. Routing is now explicit by capability: authoring stays on its declared backend, assignments/insights are V8-only and fail visibly. Unsupported archived assignment commands remain unavailable rather than writing legacy. | Focused routing/smoke `2/2` files, `15/15 PASS`; structural search finds zero V8 `.catch()` legacy fallbacks and zero legacy assignment/insight calls in the hub; root typecheck PASS. | `FIXED_VERIFIED` |
| `INT-PF-004` | **CORRECTED 2026-08-28 (day44 fix worker, adversarial re-review) — the original entry below overstated this as a fixed vulnerability; it was not one.** The day44 author hypothesized that the candidate-handoff router "borrowed authentication" from the earlier `/api/interview` mount and had no auth of its own — read from the source marker, never tested. Mutation evidence disproves the vulnerability claim: at the marker, every one of the 6 routes already carried its own `requirePermission('INTERVIEW_ASSIGN_MANAGE' \| 'INTERVIEW_INSIGHTS_HANDOFF')`, and `requirePermission` independently returns `401 AUTH_REQUIRED` whenever `req.user` is unset (`server/src/middleware/permission.middleware.ts:269-275`) — with or without the router's own `router.use(apiAuthRateLimiter, verifyToken, requireOrgAccess(), demoContextMiddleware)` chain. Proven directly: router mounted ALONE (no `interview.routes.ts`, no Gateway) with the fix's four `router.use(...)` lines commented out on a copy still returns `401` to every anonymous request — the only thing that changes without the fix is that a *legitimately authenticated* caller also gets `401` (nothing upstream parses `Authorization: Bearer` to populate `req.user`), i.e. the router fails closed for everyone if Gateway mount order ever changes, not open for anyone. There was never a window in which an anonymous caller reached the handler, in either state. Correct classification: **resilience/consistency hardening** (defends against a future Gateway mount-order change), not a security fix — reclassified down from `FIXED_VERIFIED` accordingly, matching this same duty's own R.1 report language (`D.3` was recorded there as `CZĘŚCIOWO`, contradicting this row's `FIXED_VERIFIED` — that contradiction is what this correction resolves). Separately, the mutation-testing pass that disproved the original hypothesis surfaced one REAL, previously unmeasured gap: the router's own chain used `requireOrgAccess()` (JWT-claim shape check only) instead of `validateOrgMembership` (real `organization_members` DB check, `auth.middleware.ts:1672`) — measured on real Postgres, a user with a *revoked* `organization_members` row (status != `ACTIVE`) reached the preview handler and got the same `404` as a fully fabricated identity, no differentiation, in exactly the scenario the `/approve` endpoint (a real write into `initiative_candidates`) exists to guard. `validateOrgMembership` has been added to the router's own chain to close that gap (commit `bc99c4fbc2`). | **Mutation-sensitivity proof (FIX-2, commit `6a4cbff06d`, real Postgres, router mounted alone, `--retry=0` both directions):** chain present → `7/7 PASS`; chain's four `router.use(...)` lines removed → `6/7 PASS`, the authenticated-success assertion goes RED (`401` instead of reaching the handler) while the 6 anonymous-rejection assertions stay green in both states (documented in the test file header as NOT mutation-sensitive on their own, for exactly the `requirePermission` fail-closed reason above). **Revoked-membership gap proof (FIX-3, commit `bc99c4fbc2`, real Postgres, `day44.candidateHandoffOrgMembership.pg.test.ts`):** before the fix, revoked membership → `404` (reaches handler); after → `403 ORG_MEMBERSHIP_REVOKED` (verified both directions by reverting `router.use(validateOrgMembership)` on a copy and re-running with `--retry=0`); active membership unaffected, still `404 SUBMISSION_NOT_FOUND`. Original D.3 evidence (`7/7 PASS` against the full Gateway) is retained above as historical record but was mutation-blind — see FIX-2. | `HARDENING_VERIFIED_HYPOTHESIS_DISPROVEN / ONE_REAL_GAP_FOUND_AND_FIXED_SEPARATELY` |
| `INT-PF-004` *(original day44 entry, superseded above — kept for audit trail, do not treat as current status)* | The candidate-handoff router borrowed authentication from the earlier `/api/interview` mount and did not declare an auth or organization chain of its own. The router now locally declares rate-limit, token, organization-access and demo-context guards without changing `Gateway.ts`. | Real Gateway and fresh PostgreSQL: `7/7 PASS`; all `6/6` anonymous route shapes returned `401` with independent `initiative_candidates` readback unchanged, while an authenticated owner reached the preview handler and received the handler's `404`; commit `a289f60c0`. | ~~`FIXED_VERIFIED`~~ **SUPERSEDED — see corrected row above** |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `INT-TBL-OWN-001` | 2026-08-22 | “Kształt tabel i menu górne jest ok. Niestety, dalej już będą uwagi.” | Owner partial approval / review protocol | Interview: Inbox, Sessions, Assigned, Templates, Insights, Initiatives | Six related list surfaces use the same overall table shell and upper navigation/action layers. | Preserve the approved table shape and upper menus while reviewing the remaining menu and correctness layers separately. | Prevents unnecessary redesign of accepted shared surfaces and bounds subsequent remediation. | `INT-TBL-EVD-001..006` / index | `09950def9972` + working tree | Gate | `TABLE_SHAPE_AND_UPPER_MENUS_OWNER_APPROVED / REMAINDER_IN_REVIEW` | — | Visual baseline captured; no functional claim. | `PARTIAL_APPROVAL_RECORDED` |
| `INT-MENU-OWN-001` | 2026-08-22 | “Nie we wszystkich narzędziach menu rozwijane jest w prawidłowym kontekście; to znaczy, że menu powinno mieć więcej przycisków dopasowanych do funkcji niż obecnie ma. Niestety nie ma pełnego menu w Inbox. w assign If Initiate X” | Functional UX / action governance | Interview list row menus; confirmed Inbox, with screenshot-supported scope including Assigned and Initiatives; final transcription scope remains to be confirmed during the live pass | Menus expose sparse or inconsistent action sets. Assigned proves direct right-click/kebab divergence: the kebab contains Reassign, Send reminder and Escalate now while the context menu does not. | Define one permission- and state-aware action registry per object type; render the same applicable actions in right-click and kebab menus, with truthful disabled reasons and no invented operations. | Users cannot reliably discover or execute the lifecycle actions appropriate to the selected Interview object. | `INT-MENU-EVD-001..008` / index | `d13b676fc0` | P1 | `ASSIGNMENT_ACTIONS_TECHNICAL_PASS / FULL_ACTION_MATRIX_PENDING` | `5189ac05d6`, `d13b676fc0` | Assignment table and grid consume the same `buildAssignmentRowSections` registry. Escalate now reaches the protected V8 handler, displays typed failures and refreshes the managed list. Reassign now updates the existing assignment ID through the tenant-scoped membership guard instead of creating a duplicate; it preserves the pinned template, pre-fills current values, requires one assignee and is truthfully disabled after start. Focused escalation/API/tenant-IDOR suites pass (`92/92` combined); root and server typechecks pass. Remaining object menus, mounted persistence replay and owner retest remain open. | `PENDING` |
| `INT-PREV-OWN-001` | 2026-08-22 | “W kartach preview przyciski działania, które powinny być na dole, są w bardzo różnym stanie. Nie ma tu jednego formatu, więc dobrze byłoby odnieść się do opisu formatu źródeł prawdy, jak ma to wyglądać, i zastosować przyciski zgodnie z wytycznymi źródeł prawdy.” | Cross-tab standard violation / Preview actions | Interview Preview: Inbox, Sessions, Assigned, Templates, Insights, Initiatives | Footer composition and action presentation vary by tab: bespoke delay pills, single Generate insights action, no actionable footer for a closed assignment, bespoke Edit/Duplicate/Delete, a conversion strip without canonical Actions, and Initiatives actions plus overflow. | Apply the canonical six-block Preview anatomy and footer order `AI → Relations → Actions → Co dalej`; render object-specific direct actions through `PreviewActionBar` + `actionPillClass()`, `h-9 rounded-full`, two-column grid, max six; keep exactly one Open in the header and omit an empty Actions block. | Inconsistent placement and styling prevents transfer learning and makes action availability/status difficult to trust. | `INT-PREV-EVD-001..006` / index | `09950def9972` + working tree | P1 | `REQUIRED / CANON_MAPPING_AND_FUNCTIONAL_AUDIT_PENDING` | — | Canon sources identified; no implementation or handler/readback verification yet. | `PENDING` |
| `INT-QCARD-OWN-001` | 2026-08-22 | “Przy jednej z przebudów w kartach pytań w wywiadzie zaproponował system rozwiązania artefaktu N-type. (…) obecnie (…) jest n-type, który jest zupełnie bezsensowny. Trzeba to poprawić, a w zasadzie cofnąć tę zmianę, bo poprzednia wersja była dobra.” | Owner-directed rollback / major UX regression | Interview session → Questions → single-question runtime | The formerly full-width question workspace was embedded inside the generic N-mode artifact shell, producing a narrow central question card plus redundant workspace navigation and properties chrome. | Restore the previous production single-question workspace: dedicated wide runtime, left question list, broad answer area and persistent bottom navigation; preserve later data, save, review and workflow fixes. | The primary respondent/consultant workflow loses usable width, hierarchy and continuity; the core Interview experience becomes materially harder to use. | `INT-QCARD-EVD-001..002` / index | `d560464f3f` | P0 | `TECHNICAL_PASS / OWNER_RETEST_REQUIRED` | `d560464f3f` | Single-question mode now bypasses `NModeShell` and renders the wide immersive question workspace while reusing current save, submit, CAS, review, send-back and approval handlers. Presentation contract tests and full Interview UI suite pass (`18` files, `92/92`); root typecheck and production build pass (build requires the established 8 GB Node heap). Visual parity and deployed owner replay remain open. | `PENDING` |
| `INT-APPROVAL-OWN-001` | 2026-08-22 | “Nie widzę dzisiaj mechaniki zatwierdzania. (…) w momencie, kiedy akceptujemy jakiś zestaw odpowiedzi, jest on zatwierdzony i może wchodzić do dalszej pracy. Jeśli użytkownik, który został poproszony o wykonanie zadania, nie zrobi tego dobrze, zostaje odesłany. Ten proces powinien być tutaj odwzorowany, ale obecnie go nie widzę.” | Missing visible approval lifecycle / workflow gate | Interview: assigned response set, submission and manager review across Inbox, Sessions and Assigned | The reviewed surfaces do not expose a coherent, discoverable end-to-end approval loop; isolated statuses or dormant handlers do not demonstrate that a submitted answer set can be approved or returned and that only the approved version advances. | Implement and visibly represent the lifecycle `assigned/in progress → submitted for review → approved OR sent back with reason → corrected resubmission`; approval must freeze/version the accepted answer set and unlock downstream work, while send-back must return ownership, retain reviewer reason/history and prevent downstream use until later approval. | Without an explicit durable gate, unaccepted answers may be treated as usable input, assignees lack a clear correction loop, and users cannot trust which response version is authoritative. | Owner live-review statement; canonical confirmation in G02/G04/G05 and approved-only downstream scope in `InsightCreatorModal` | `09950def9972` + working tree | P0 | `REQUIRED / END_TO_END_STATE_PERMISSION_UI_PERSISTENCE_AUDIT_PENDING / IMPLEMENTATION_DEFERRED_UNTIL_REVIEW_COMPLETE` | — | Register-only intake. Existing code mentions approve/send-back and approved-only downstream selection, but visible reachability, role permissions, version freeze, persistence and cold readback have not been established in this owner pass. | `PENDING` |
| `INT-ASSIGN-OWN-001` | 2026-08-22 | “Nie wiem, czemu nie mogę teraz wybrać, który szablon ma być wykorzystany. Nie miałem tego problemu nigdy wcześniej (…) Poza tym cały generator jest w porządku.” | Functional regression / template eligibility contract; partial owner approval | Interview → Assigned/Managed → Assign Interview | Assignees load, but the required Interview Template selector has no usable suggestion. Since `84c0525d05c` (2026-08-19), `AssignInterviewModal` silently retains only records with status exactly `approved` and `hasPublishedVersion === true`; the latter is computed from an organization-scoped exact-version snapshot. A template visible as Published in the library can therefore disappear from Assign when its current version lacks that organization snapshot or its returned lifecycle value does not exactly match the client predicate. | Preserve the current generator, which the owner accepts. Reconcile library and assignment eligibility so every genuinely assignable published template is suggested; surface an explicit reason for each ineligible template instead of silently returning an empty selector. Keep exact-version pinning, but ensure system/organization/private templates resolve the correct published snapshot for the active organization. | Assignment cannot be completed even though templates visibly exist; the user receives no explanation and perceives previously working functionality as lost. | `INT-ASSIGN-EVD-001` / index; source `AssignInterviewModal.tsx:111-165`, `InterviewController.ts:5928-6034`; regression commit `84c0525d05c` | `09950def9972` + working tree | P0 | `REQUIRED / ROOT_CAUSE_FILTER_AND_SNAPSHOT_CONTRACT_IDENTIFIED / LIVE_RESPONSE_AND_DB_READBACK_PENDING / IMPLEMENTATION_DEFERRED_UNTIL_REVIEW_COMPLETE` | — | Register-only intake. Screenshot proves the empty selector and populated assignees; source proves the new strict eligibility predicate. Exact failing template record and Railway readback remain to be captured before remediation. | `PENDING` |
| `INT-TPL-ED-OWN-001` | 2026-08-22 | “Bardzo fajnie, może nie super intuicyjnie, ale naprawdę dałem radę. Jest fajnie.” | Positive owner acceptance with minor usability reservation | Interview → Templates → template editor | The owner successfully navigated the editor and positively assessed the working experience; the screen exposes metadata, library/scope, question list, Preview, Upload, Add Question, AI improvement, quality check, draft save and Publish. Initial orientation is not fully intuitive. | Preserve the current editor structure and capabilities. Treat discoverability as a bounded usability improvement opportunity (labels, guidance or onboarding) rather than justification for redesign. | Protects a working and positively received creation flow while retaining a concrete signal about first-use cognitive load. | `INT-TPL-ED-EVD-001` / index | `09950def9972` + working tree | P3 | `FUNCTIONALLY_OWNER_APPROVED / MINOR_DISCOVERABILITY_RESERVATION / NO_REDESIGN_AUTHORIZED` | — | Register-only intake; visual evidence and owner completion statement captured. Persistence, publish readback and downstream assignment remain separate correctness gates. | `PARTIAL_APPROVAL_RECORDED` |
| `INT-CREATOR-OWN-001` | 2026-08-22 | “Mamy dwie bardzo ważne karty: kartę do robienia insightów i później kartę do robienia inicjatyw. (…) muszą wyglądać tak samo. (…) merytorycznie to narzędzie jest ok, tylko niestety nie da się nim teraz zarządzać w tej postaci.” Follow-up: “Mechanika jest OK (…) wybieramy insighty i on szybciutko nam proponuje obszar, ale to musi być czytelne (…) ekran możemy zrobić większy (…) trzeba sięgnąć po technologię Liquid Glass i zarządzać tymi ekranami bardzo dobrze.” | Cross-creator UX standard / severe operability failure with functional-content approval | Interview → AI Insight Creator; downstream AI Initiative Wizard; future creator dialogs | Both creators now visibly share the same class of problem: insufficient or poorly allocated workspace, compressed stepper, inconsistent visual density, nested frames and content whose extent is difficult to perceive. Initiative evidence confirms the five-step concept and Insight → Initiative source selection, but covers only steps 1 and 2. | Adopt the expert-consensus `Creator Shell` contract below. Preserve the owner-approved business mechanics and content. Treat Liquid Glass as a controlled visual-language direction for hierarchy, depth and region separation—not as decorative blur—and require contrast, focus, reduced-transparency and performance safeguards. | Users can miss options, cannot predict remaining work, and must search the interface rather than follow it; this threatens completion of the core Interview → Insight → Initiative value chain. | `INT-CREATOR-EVD-001..005`, `INT-INIT-CREATOR-EVD-001..004`; Day 13 partial implementation evidence in `evidence/day13/DAY13-01_*` and `DAY13-04_*` | `09950def9972` + Day 13 commits `17c5edb60e..aaad789d2d` | P0 | `REQUIRED / FLAG_DEFAULT_OFF / SHELL_GEOMETRY_AND_BANDS_PARTIAL / VISUAL_PARITY_PARTIAL / TYPE_COUNT_CONTRACT_BLOCKED_12_VS_13 / INITIATIVE_STEPS_1_2_EVIDENCED / STEPS_3_5_EVIDENCE_MISSING` | — | Day 13 added an opt-in shared 1040×840 geometry token, fixed shell bands, reduced-transparency fallback, live outcome summary and OFF evidence. The owner verdict remains unchanged: only step 1 was rendered, it still shows 4 cards above the fold, and K.1 stopped because runtime has 12 output types while DEC-67 requires 13. No owner acceptance or flag enablement is claimed. | `PENDING` |
| `INT-INIT-AI-OBS-001` | 2026-08-22 | Screenshot-observed during owner review: “Failed to fill the section with AI.” | Functional observation / AI-assisted form fill | AI Initiative Wizard → Intent → Fill with AI | A section-level AI fill enters a loading state and then reports a generic failure toast; no cause, retry classification or preserved diagnostic is visible. | AI fill must either populate the requested section or return a specific, actionable and retry-safe failure state while preserving existing user input; provider unavailability must be distinguished from validation, permission and server errors. | A core acceleration mechanism appears unreliable and gives the user no recovery path or trustable explanation. | `INT-INIT-CREATOR-EVD-003` / index | `09950def9972` + working tree | P1 | `OBSERVED / OWNER_VERBAL_DECISION_NOT_YET_CAPTURED / REQUEST_RESPONSE_PROVIDER_AND_READBACK_AUDIT_PENDING / IMPLEMENTATION_DEFERRED_UNTIL_REVIEW_COMPLETE` | — | Screenshot evidence only. The ambient toast proves visible failure, not its backend cause. | `PENDING` |

### Active Interview table-review protocol

Each of the six list surfaces is reviewed against three primary dimensions:

1. **Menu** — (a) the three upper menu layers, (b) right-click context menu,
   and (c) row kebab menu.
2. **Table** — columns, hierarchy, layout, readability, sorting, filtering,
   selection and available actions.
3. **Correctness** — data, counters, statuses, dates, relationships, permissions
   and the actual behavior/readback of every exposed function.

Current owner result: table shape and upper menu layers are approved. The
right-click and kebab layer has finding `INT-MENU-OWN-001`; correctness remains
`IN_REVIEW`.

Preview action-footers are governed by `INT-PREV-OWN-001`. Normative sources:
`docs/ui-standards/TRIADA_KANON.md` for anatomy/appearance and
`docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` §7/§7.3b for mechanics,
ordering, anti-duplication and button variants. Implementation SSOT:
`StandardPreview`, `PreviewActionBar`, `actionPillClass()` and
`src/contracts/tableSurface/canon.ts`. No Interview-specific descriptor exists
yet under `[CYTOWANY PLIK NIEODNALEZIONY — docs/ui-standards/03-modules/table-descriptors/ — do wyjaśnienia przy odbiorze modułu]`; creating the six
object-specific mappings is part of the required closure artifact.

### Expert-consensus Creator Shell contract (`INT-CREATOR-OWN-001`)

Three constructive reviews — UX/workflow, design-system/responsive UI and
product/information architecture — produced the initial brief. Two subsequent
independent sceptical reviews found it adequate for prototyping but not yet a
safe platform standard. Their binding disposition is in
`CREATOR_SKEPTICAL_REVIEW.md`; the revised normative recommendation is
`CONSULTING_CREATOR_GUIDELINES.md`. The earlier brief below remains intake
history and must not be treated as implementation authorization:

1. **One shared shell:** Insight and Initiative must use the same component,
   geometry, header, stepper, content viewport, sticky footer, spacing tokens
   and interaction states. Content may differ; mechanics may not.
2. **Desktop geometry:** baseline width `min(960px, calc(100vw - 64px))` and
   height `min(820px, calc(100vh - 48px))`; a complex creator may extend to
   approximately `1040–1120px` only through one documented shared size token.
   Minimum usable desktop layout is approximately `800 × 640px`. Below tablet,
   use a full-screen dialog. The dialog must not resize between steps.
3. **Stable regions:** header `56–64px`, stepper `64–72px`, footer `64–72px`;
   all remain visible. Exactly one middle content region scrolls vertically.
   Nested vertical scrolling is forbidden except for a deliberately bounded,
   labelled and counted very-long virtualized list.
4. **Component scale:** standard inputs/selects/buttons `40–44px`; choice cards
   `56–64px`; content padding `24px`; section gaps `20–24px`; control gaps
   `12px`; labels/body `13–14px`, helper/meta `12–13px`. Do not solve density
   primarily by reducing text below `12px`.
5. **Visual hierarchy:** one modal frame, neutral field borders and at most two
   levels of grouping. A selected item has one dominant selection treatment;
   keyboard focus remains a separate accessible ring. Remove decorative nested
   card borders.
6. **Stepper:** one clean persistent process bar. Active state uses one primary
   indicator; completed uses check/status; future remains readable. Each step
   may summarize its result (for example `2 sources`, `12 interviews`) so users
   do not need to reopen it to remember context.
7. **Progressive disclosure:** required decisions and main outcome-affecting
   choices appear first. `Advanced` is collapsed by default and summarizes
   active settings. Long option/document sets show counts and an explicit
   `Show all`/continuation affordance.
8. **No hidden continuation:** when content extends below the fold, show an
   explicit fade/message such as `More settings below`, removed at the end.
   `Next`/`Run` may not imply completeness while unseen required fields remain;
   validation scrolls and focuses the first error.
9. **Workflow semantics:** preserve state across Back/Next; reset the content
   viewport to the top on entering a new step. Final actions describe the
   outcome (`Run insight`, `Create initiative`). Before an expensive or
   irreversible operation, show a scope summary. Initiative must expose the
   selected Insight sources and their count.

Acceptance requires:

- identical shell tokens and mechanics for both creators;
- at `1440×900` and `1920×1080`, required current-step information, stepper and
  footer remain visible, with any continuation explicitly signalled;
- no two simultaneous vertical scrollbars and no horizontal scrolling at
  widths `320`, `375`, `768`, `1024` and `1440px`;
- the first primary decision is fully visible at step entry;
- consistent control/card sizes, logical keyboard order, visible focus and
  focus trapping;
- a five-person usability check in which at least `4/5` complete both creators
  without help finding more content, and every participant can identify the
  current step and primary action within five seconds;
- like-for-like screenshots or recording of every step of both creators.
  Current Initiative evidence covers Insights and Intent only; Candidates,
  Governance and Result remain `EVIDENCE_MISSING`, so full parity is not passed.
- when a glass/translucent treatment is used, text and interactive controls
  retain required contrast over every background, focus remains unmistakable,
  `prefers-reduced-transparency` (or the product-equivalent accessibility
  setting) falls back to opaque surfaces, and blur does not cause observable
  interaction or scrolling degradation.

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| `INT-ASSIGN-OWN-001` / `REC-INT-002` | The list treated an approved system template as unassignable unless a tenant-scoped publication snapshot already existed, while the assignment writer rejected every system template by requiring `organization_id = actor.organizationId`. | Keep exact-version publication mandatory. Approved product-owned system templates with questions are listable as assignable; the first governed assignment atomically freezes one immutable global `system` snapshot. Organization/private templates still require their tenant publication receipt. | `f3c35cecce` | Template list/detail, assignment writer, publication snapshot reader | Interview | unit `3/3`; startup/readiness `43/43`; fresh pgvector16 mounted delivery `7/7`; migrations `817/0/0`; residue, disabled triggers and advisory locks `0` | `TECHNICAL_PASS / OWNER_RETEST_AND_RAILWAY_READBACK_PENDING` |
| `INT-APPROVAL-OWN-001` / `REC-INT-004` | The lifecycle existed in fragments, but its mounted exact-version round trip and response contract were not covered; send-back returned raw snake-case timestamps/reason while the client contract expects camel case. | Preserve the implemented workflow and add canonical `sentBackAt`/`sentBackReason` readback. Prove answer → submit → edit lock → send back with reason → correction → resubmit → approval, final context eligibility and immutable answer-history snapshots on one database. | `01d1cd8057` | Respondent runtime, manager review actions, assignment/session API, answer history | Interview | fresh pgvector16 mounted delivery `8/8`; UI/API lifecycle regressions `68/68`; assignment `approved`, session `completed`, corrected answer persisted, history snapshots `3`; migrations `817`; residue, disabled triggers and advisory locks `0` | `TECHNICAL_PASS / VISUAL_DISCOVERABILITY_AND_OWNER_RETEST_PENDING` |
| `INT-V4-CLEANUP-001` | Owner decision 28.08.2026: `interview-v4` (`server/src/routes/interview-enterprise.routes.ts`, V4-INTV-01..07) was believed to be a dead layer that shipped once (`05b994e24c`, 2026-03-06) and was never wired to the UI. Measured basis: all 22 client wrappers in `src/services/api.ts` (`interviewCreateSegment` … `interviewDiffContextVersions`) have zero callers anywhere in `src/`, `server/src/` or `tests/` beyond their own definitions, and zero commit touches since introduction. | Removed only the confirmed-dead client layer: 22 methods / 193 lines deleted from `src/services/api.ts`. **The backend routes and service were investigated and intentionally NOT touched** — see "interview-v4 backend: STOP finding" below for why the "never touched" premise does not hold for the server side. | `c150230f29` | `src/services/api.ts` only | Interview (client only) | tsc frontend `22/22` pre-existing errors unchanged (0 new); tsc backend `17/17` pre-existing errors unchanged (0 new, file untouched); vitest `24/24` PASS across `tests/unit/services/publicInterview.api.test.ts`, `server/src/routes/__tests__/interview-enterprise.routes.tenant.test.ts`, `src/views/__tests__/PublicInterviewRespondentView.delivery.test.tsx`; esbuild syntax check on edited file clean | `TECHNICAL_PASS / BACKEND_PORTION_STOPPED_NOT_A_REGRESSION` |

### interview-v4 backend: STOP finding (2026-08-28)

The task ordered full removal of `interview-v4` (backend + client) on the
premise that the whole layer "urodziła się martwa" ~6 miesięcy temu and was
never touched again. That premise is **true for the 22 client wrappers**
(verified: `git log --oneline -- src/services/api.ts` shows the interview-v4
block was added once and never modified or called; 0 callers via `grep -rn`
of each method name across `src/`, `server/src/`, `tests/`), but it is
**false for the backend**, discovered before any backend file was touched:

- `server/src/routes/interview-enterprise.routes.ts` has **7 commits**, the
  most recent being a **security fix** (`1de731c5c1
  fix(interview-v4): resolve tenant from the token only, gate the router
  centrally`) — a cross-org tenant-isolation vulnerability patched on this
  same M03 branch, not a March-2026 fossil.
- `server/src/services/interviewEnterpriseService.ts` has **5 commits**,
  including its own security fix (`aff258cd17 fix(interview-v4): bind
  session and initiative references to the caller org`).
- `server/src/routes/__tests__/interview-enterprise.routes.tenant.test.ts`
  (added by `1de731c5c1`) is a live regression test that sends real HTTP
  requests through the mounted router to `findings`, `evidence/.../access-log`,
  `distributions`, `distributions/.../revoke`, `findings/.../promote`,
  `context/versions/.../sign-off`, `context/versions`, `segments` and the
  public token route, and asserts 403/tenant-scoping behaviour on nearly
  every one of the 27 routes. Deleting any of those routes breaks this test.
- A **separate, active audit workstream** — `CLAUDE-NEXT-LEGACY-CUTOVER` —
  independently inventories this exact router in
  `server/src/services/legacyCutover/registry/interview.ts`
  (writers `INTERVIEW-E01`..`E13`, all `state: 'observed'`) with a paired
  real-Postgres test, `server/src/services/legacyCutover/__tests__/interviewCutover.pg.test.ts`,
  that mounts the real router behind a telemetry guard and sends live HTTP
  requests to `POST /sessions/:id/segments` and `POST /sessions/:id/distributions`,
  asserting specific rows land in `legacy_cutover_usage_events`. That
  workstream's own stated retirement path is observe-then-disable-then-delete,
  and it has not finished observing.

Deleting the backend routes/service now would (a) break the tenant-isolation
regression test, (b) break the legacy-cutover guard test for the two writers
it exercises, and (c) collide with a parallel, independently-authored
decommissioning effort mid-flight on the identical file. Per the task's own
STOP rule ("jeśli znajdziesz wołacza tam, gdzie miało go nie być —
ZATRZYMAJ SIĘ na tej pozycji, opisz co znalazłeś, usuń resztę"), this agent
stopped at the backend boundary, completed the client-side removal that had
no such wołacz, and is reporting this finding for the owner/session
supervisor to sequence against the legacy-cutover workstream before any
backend deletion is attempted.

**Not removed, and why:** `server/src/routes/interview-enterprise.routes.ts`
(all 27 routes, including the 3 live public-respondent routes), and
`server/src/services/interviewEnterpriseService.ts` — both actively
maintained, security-patched, and depended on by two independent test
suites as described above. No orphaned types were found on the client side
(the 22 removed methods used only inline object types, no dedicated
`InterviewSegment`/`InterviewQuota`/… exported type existed to orphan).

## Preflight implementation ledger

| Observation | Root cause | Resolution | Commit | Verification |
|---|---|---|---|---|
| `INT-PF-001` | Test teardown predated immutable source-receipt protection. | Strict disposable-DB/opt-in guard, transaction-local trigger bypass, residue and trigger-state proof. | `9fcff61b7d` | current fresh-PG `70/70 PASS`, residue `0`, trigger `O` |
| `INT-PF-002` | Fail-soft scanner query used two columns absent from the canonical Assessment schema. | Read canonical `name` and `description`. | `291e37340f` | exactly-once real-PG `11/11 PASS`, missing-column error absent |
| `INT-OWNER-01` | No durable realistic Wave 3 fixture existed for the guided owner round. | Add local-only non-destructive seed for manager, respondent and revoked-link states. | `d3d6de5bfc` | seed readback `2` sessions / `6` questions / `2` distributions; active API + revoked `410` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
