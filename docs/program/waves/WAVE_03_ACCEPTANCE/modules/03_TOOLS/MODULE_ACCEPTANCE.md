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
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS` | Exact adopted runtime on product/client/server `3d61730fd8ad18d19cf9967cb5513697659003cc`: server `:3980`, client `:3981`, retained DB `consultify_w3_tools_owner_browser_20260822`, `817` migrations. Health/ready/frontend `200`, exact SHA/client marker, SQL ledger and `W3-TOOLS-OWNER-v1` durable marker passed; auth/test bypasses were OFF. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Create/resume Dynamic SWOT → capture items and evidence → tensions → conclusions/recommended move → review/approve → immutable nonempty output → downstream promotion → cold reopen exact lineage. Boundaries cover tenant, role, stale writes, rejected proposals, wrong-tool lineage and provider failure without false success. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active same-tenant owner/ADMIN and legitimate session participant. Denied: inactive member, foreign tenant, wrong tool/session and stale writer. The mounted fixture binds stable OWNER `w3.tools.owner@local.test`; the wider denied matrix remains policy/RealPG-backed and was not manually browser-replayed in full. |
| G04 | Reproducible realistic and boundary fixtures | `PASS` | Technical fixtures create active memberships and clean by organization identity; tested-prefix residue is `0`. Local-only idempotent owner seed creates a guided `70%` journey and an approved `100%` cold-readback example without touching Piotr's existing session or overwriting review progress. |
| G05 | Functional preflight and cold readback | `PASS_WITH_TEST_WARNING` | Existing `123/123` technical replay and `23/23` persistence/CAS lane remain green. The exact adopted browser authenticated the owner and cold-read both stable Dynamic SWOT fixtures: guided `wave3-tools-owner-guided-v1` and approved `wave3-tools-owner-approved-v1`, including their history/comments and exact server-backed session reads. No Tools HTTP 4xx/5xx was recorded in that sweep. React `act(...)` warnings remain test-quality debt; this does not resolve Piotr's captured Wave 3 UX/visual concern. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PASS_TECHNICAL / OWNER_QUALITY_DEBT_OPEN` | Desktop entry and stable guided/approved deep links cold-reopened on the exact runtime; the guided and approved states were distinct and server-backed. Technical HTTP replay was clean for Tools. The write-once fixture receipt remains `deepLinkVerified:false`; this later exact-runtime evidence is recorded here instead of rewriting that receipt. PL/EN, tablet, themes and full a11y/console coverage were not exhaustively repeated. Mobile is non-gating, and `W3-TLS-CX-001` remains explicitly open for Piotr's visual/CX review; therefore this is not `OWNER_ACCEPTED`. |
| G07 | Piotr review card | `PASS` | ZAMKNIĘTE 2026-09-02 przeglądem kart właściciela. Właściciel obejrzał i rozstrzygnął pojedynczo 7 kart tego modułu na stronie odbioru. Ekranów modułu w rejestrze grafiki: 9. Mianownik odbioru: 7 ekranów o ocenie A/B — wszystkie 7 mają decyzję właściciela. Poza odbiorem 2 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `tool-outputs-panel`, `tools-swot-live`. Decyzje w bazie dla ekranów tego modułu: ok 8, nie 0, poprawka 0 (w tym 1 na ekranach C/D, które dostały decyzję mimo bycia poza mianownikiem). Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Podstawa: decyzja właściciela z 2026-09-02, który zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd modułowy, wybrał „Uznaj przegląd kart za odbyty przegląd modułów”. Żadna z decyzji tego modułu nie pochodzi z akceptu zbiorowego z 2026-09-02 — objął on wyłącznie 5 ekranów sprzed zalogowania, które leżą poza wszystkimi 16 modułami. Poprzedni stan bramki: `READY_FOR_GUIDED_REPLAY`. |
| G08 | First-impression review | `PASS` | Pierwsze wrażenie właściciela jest zapisane jako imienna decyzja przy każdej z 7 kart. Ekranów modułu w rejestrze grafiki: 9. Mianownik odbioru: 7 ekranów o ocenie A/B — wszystkie 7 mają decyzję właściciela. Poza odbiorem 2 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `tool-outputs-panel`, `tools-swot-live`. Decyzje w bazie dla ekranów tego modułu: ok 8, nie 0, poprawka 0 (w tym 1 na ekranach C/D, które dostały decyzję mimo bycia poza mianownikiem). Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Kart z merytoryczną uwagą właściciela: 3 — są wypisane z nazwy w G17 i ten wpis ich NIE zamyka. Podstawa: decyzja właściciela z 2026-09-02, który zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd modułowy, wybrał „Uznaj przegląd kart za odbyty przegląd modułów”. Poprzedni stan bramki: `PARTIAL_BASELINE_APPROVED / INFORMATION_ARCHITECTURE_FINDINGS_OPEN`. |
| G09 | Guided CX journey review | `PASS` | Prowadzona podróż odbyła się w formie przeglądu kart ekranów (7 kart), a nie przebiegu klik-po-kliku; właściciel świadomie uznał tę formę za wystarczającą. Ekranów modułu w rejestrze grafiki: 9. Mianownik odbioru: 7 ekranów o ocenie A/B — wszystkie 7 mają decyzję właściciela. Poza odbiorem 2 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `tool-outputs-panel`, `tools-swot-live`. Decyzje w bazie dla ekranów tego modułu: ok 8, nie 0, poprawka 0 (w tym 1 na ekranach C/D, które dostały decyzję mimo bycia poza mianownikiem). Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Podstawa: decyzja właściciela z 2026-09-02, który zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd modułowy, wybrał „Uznaj przegląd kart za odbyty przegląd modułów”. Poprzedni stan bramki: `IN_PROGRESS_WITH_ARCHITECTURE_DECISIONS`. |
| G10 | Alternate-state owner review | `PASS` | Stany alternatywne objęte tylko w takim zakresie, w jakim rejestr grafiki ma dla tego modułu osobne ekrany stanów; osobnego przebiegu po stanach 2026-09-02 NIE prowadzono. Bramka stoi na decyzji właściciela, nie na osobnym przebiegu. Ekranów modułu w rejestrze grafiki: 9. Mianownik odbioru: 7 ekranów o ocenie A/B — wszystkie 7 mają decyzję właściciela. Poza odbiorem 2 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `tool-outputs-panel`, `tools-swot-live`. Decyzje w bazie dla ekranów tego modułu: ok 8, nie 0, poprawka 0 (w tym 1 na ekranach C/D, które dostały decyzję mimo bycia poza mianownikiem). Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Podstawa: decyzja właściciela z 2026-09-02, który zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd modułowy, wybrał „Uznaj przegląd kart za odbyty przegląd modułów”. Poprzedni stan bramki: `NOT_STARTED`. |
| G11 | Every owner observation/screenshot durably registered | `PASS` | Każda decyzja zapisana imiennie: 7 pozycji w bazie `../../../../grafika/odbior.sqlite` i w trwałym eksporcie `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji). Z treści: 3 kart niesie merytoryczną uwagę właściciela. To kompletność rejestru (intake), nie jego rozliczenie. Poprzedni stan bramki: `CAPTURE_COMPLETE_FOR_THIS_ROUND / FINAL_REPORT_WRITTEN`. |
| G12 | Owner register reconciled and confirmed | `PASS` | Rejestr potwierdzony przez właściciela 2026-09-02 słowami „wszystkie obrazy dostają ok, możemy uznać za odhaczone” dla 7 kart. Ekranów modułu w rejestrze grafiki: 9. Mianownik odbioru: 7 ekranów o ocenie A/B — wszystkie 7 mają decyzję właściciela. Poza odbiorem 2 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `tool-outputs-panel`, `tools-swot-live`. Decyzje w bazie dla ekranów tego modułu: ok 8, nie 0, poprawka 0 (w tym 1 na ekranach C/D, które dostały decyzję mimo bycia poza mianownikiem). Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Uwagi merytoryczne (3) pozostają otwarte i są rozliczane w G17. Poprzedni stan bramki: `OWNER_RECONCILIATION_PENDING`. |
| G13 | Solution and impact analysis | `RECOMMENDATION_COMPLETE / IMPLEMENTATION_NOT_AUTHORIZED` | The final recommendation covers Preview Content, menu governance, the Dynamic SWOT session, shared creator shell, approval/send-back, `Outputs → Insights → Reports → Initiatives`, and the platform blueprint for every consulting tool. Exact contract: `TOOLS_OWNER_REVIEW_FINAL_REPORT_2026-08-22.md` plus `SWOT-003-finalny-model-pracy-dynamic-swot.md`. Technical decomposition starts only after owner reconciliation and authorization. |
| G14 | Remediation with finding-to-commit traceability | `NOT_STARTED` | — |
| G15 | Integrator self-QA and impacted regression | `NOT_STARTED` | — |
| G16 | Before/after owner retest packet | `NOT_STARTED` | — |
| G17 | Owner retest decisions for every finding | `PARTIAL` | Otwarte po przeglądzie 2026-09-02: 3 kart zamkniętych jako „ok”, ale z merytoryczną uwagą właściciela, do której nie ma decyzji retestowej: `karta-tool`, `tools-swot-report`, `tools-swot-session-workspace`. Ekranów modułu w rejestrze grafiki: 9. Mianownik odbioru: 7 ekranów o ocenie A/B — wszystkie 7 mają decyzję właściciela. Poza odbiorem 2 ekranów o ocenie C („nie pokazujemy”) lub D („odłożone”): `tool-outputs-panel`, `tools-swot-live`. Decyzje w bazie dla ekranów tego modułu: ok 8, nie 0, poprawka 0 (w tym 1 na ekranach C/D, które dostały decyzję mimo bycia poza mianownikiem). Źródło: `../../../../grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19, 265 decyzji); mapowanie ekran→moduł: `../../MAPA_GRAFIKA_MODULY_20260902.md`. Linia grafiki: SHA `316bce9dd9aeff1bde71e368968b851467e93411`. Domyka to: naprawa, nowy zrzut i decyzja właściciela osobno przy każdej uwadze. Poprzedni stan bramki: `NOT_STARTED`. |
| G18 | Module accepted on exact SHA and checkpointed | `NOT_STARTED` | Brak podstawy do checkpointu — G17 tego modułu jest otwarte (3 kart zamkniętych jako „ok”, ale z merytoryczną uwagą właściciela, do której nie ma decyzji retestowej: `karta-tool`, `tools-swot-report`, `tools-swot-session-workspace`). Tagu nie założono. Poprzedni stan bramki: `NOT_STARTED`. |
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
