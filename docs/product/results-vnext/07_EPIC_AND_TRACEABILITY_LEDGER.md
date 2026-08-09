# Results Next — Epic & Traceability Ledger

> Status: NORMATIVE EXECUTION LEDGER SEED  
> Właściciel: Results Next Integration Owner  
> Reviewer: Codex  
> Reguła: wykonawca rozszerza wiersze do feature/AC/test/evidence; nie usuwa obowiązkowego zakresu

## 1. Globalne identyfikatory

- `RN-D01…RN-D15` — decyzje Foundera;
- `RN-E###` — epiki wspólne;
- `KPI-E###`, `ROI-E###`, `OKR-E###` — epiki domenowe;
- `RN-F-###`, `KPI-F-###`, `ROI-F-###`, `OKR-F-###` — funkcje;
- `*-AC-###` — acceptance criteria;
- `RN-E2E-*` — testy E2E;
- `RN-EV-*` — evidence artifacts;
- `RN-G0…RN-G7` — gates.

Lokalne oznaczenia z planów (`KPI-Axx`, `WPx`, domain `Gx`) pozostają aliasami. Nie zastępują globalnego ID.

## 2. Epiki wspólne

| Epic | Nazwa | Zakres obowiązkowy | Główne decyzje | Gate |
|---|---|---|---|---|
| RN-E001 | Contract & Supersession | ADR, D01–D15, granice SSOT, lifecycles, routes, ownership, threat model | wszystkie | G0 |
| RN-E002 | Clean-start Persistence | nowe schemas/repositories/constraints, no backfill, no runtime DDL | D03, D05, D08, D13 | G1 |
| RN-E003 | Authorization & Visibility | RBAC+ABAC, policies, tenant, maker-checker, non-leak | D10, D11 | G1/G7 |
| RN-E004 | Audit, Events & Outbox | envelope, append-only log, atomic outbox, replay, causation | D01, D12 | G1/G6 |
| RN-E005 | Evidence & Provenance | source refs, versions, hashes, evidence manifest | D07, D15 | G1/G7 |
| RN-E006 | Results Registry Shell | Menu 1/2/3, Scorecards/ROI Cases/OKR Sets, table/grid/preview/tool | D01, D02 | G2 |
| RN-E007 | Personal & Organization | My/team/BU/company projections, management chain, same IDs | D10 | G2/G7 |
| RN-E008 | MyWork & Decisions | obligations, dedupe, same-object write-through, exact-version approval | D11, D12 | G3 |
| RN-E009 | Teresa Results Runtime | typed proposals, retrieval, accept/reject, audit, personal/org | D15 | G3/G7 |
| RN-E010 | Legacy Archive | GET-only, labelled, excluded, checksums, mutation denial | D13 | G1/G7 |
| RN-E011 | Operations & Recovery | metrics, alerts, runbook, backup/restore, rollback/flag-off | wszystkie | G7 |
| RN-E012 | Integrated Acceptance | realDB, exact SHA, cold reopen, cross-domain, UI/CX/a11y | wszystkie | G7 |

## 3. KPI epiki i feature coverage

| Epic | Funkcje obowiązkowe | Alias planu | Terminalny scenariusz |
|---|---|---|---|
| KPI-E001 Central KPI Contract | identity, definition versions, type, owner, source, cadence, target geometry, submit/approve/activate | K0–K1, KPI-A05–A09 | create→second-user approve→activate |
| KPI-E002 Measurement Truth | measurements, period/version, provenance, manual/imported, data quality, correction | K2, KPI-A10–A12 | measure→evaluate→correct→cold readback |
| KPI-E003 Deviation Closed Loop | trigger, acknowledge, RCA, plan, actions, MyWork/Decision, remeasure, verify, close/reopen | K3, KPI-A13–A16 | critical→effective recovery→closure |
| KPI-E004 Scorecards | live membership, multiple cards, review cadence, immutable snapshot | K4, KPI-A17–A18 | same KPI→two cards→snapshot reopen |
| KPI-E005 Perspectives & Links | My/manager/org, process coverage, Initiative impact, no leakage | K4–K5, KPI-A19–A21/A26 | same ID across projections, restricted outsider |
| KPI-E006 Teresa & Governance | quality advisor, measurement/deviation assistance, self-approval denial, audit | KPI-A04/A22/A25 | proposal→accept/reject→authorized command |
| KPI-E007 KPI Registry, Legacy & Ops | truthful entry/state surface, archive-only, events/outbox, monitoring, recovery | KPI-A01/A02/A03/A23 | headers/states + mutation denied + replay idempotent |

## 4. ROI epiki i feature coverage

| Epic | Funkcje obowiązkowe | Alias planu | Terminalny scenariusz |
|---|---|---|---|
| ROI-E001 Case & Baseline | Initiative-bound unique Case, lifecycle, baseline/BAU, owners, visibility | WP0–WP3 | create from Initiative→duplicate prevention |
| ROI-E002 Economic Model | assumptions, costs, benefits, scenarios, cash flow, policy, deterministic engine | WP1/WP4 | known-answer downside/base/upside |
| ROI-E003 Decision & Approved | completeness, submit, review, Decision, maker-checker, immutable Original Approved | WP5 | author submit→reviewer approve→snapshot reopen |
| ROI-E004 Forecast & Actual | forecast versions, actuals, evidence, verification/correction, Approved/Forecast/Actual compare | WP6 | forecast/actual never overwrite Approved |
| ROI-E005 Benefits Realization | benefit obligations, post-Initiative continuation, variance/cause/action | WP6 | Initiative Completed while ROI active |
| ROI-E006 PIR & Learning | PIR due/review/lessons/close, organizational learning | WP7 | variance→PIR→close→cold reopen |
| ROI-E007 Finance/KPI Seams | pinned Finance artifact/version, typed KPI evidence, reconciliation | WP8 | disputed source creates reconciliation, not overwrite |
| ROI-E008 Teresa, Legacy & Ops | proposals, archive GET-only, events, recovery, visual portfolio | WP0/WP3/WP9 | grounded proposal + legacy mutation denial |

## 5. OKR epiki i feature coverage

| Epic | Funkcje obowiązkowe | Alias planu | Terminalny scenariusz |
|---|---|---|---|
| OKR-E001 Program & Cycle | policies, population, cadence, cycle lifecycle, scheduler occurrences | WP0–WP3 | publish Program→open/activate Cycle |
| OKR-E002 Materialized Set | Cycle+scope+owner, visibility, uniqueness, submit/review/approve/activate | WP1/WP2/WP6 | individual/team/BU Set→second-user approve |
| OKR-E003 Objectives & KRs | committed/aspirational, min KRs policy, geometries, versions, snapshot | WP6 | Objective+2KRs→approved baseline |
| OKR-E004 Check-ins | recurrence, actual, evidence, blocker, confidence, status/attention separation | WP3/WP6 | MyWork check-in→progress/confidence diverge |
| OKR-E005 Alignment | contributes-to relation, auth, cycle rules, no score inheritance | WP6 | authorized link→no roll-up mutation |
| OKR-E006 Support & Decisions | conversations, support request, manager queue, Decision roundtrip | WP3/WP6 | blocker→support/Decision→resolution timeline |
| OKR-E007 Review & Learning | score, reflection, manager review, close, carry-forward | WP6 | final review→reflection→next-cycle draft |
| OKR-E008 Teresa, Perspectives, Legacy | drafting/quality/check-in/brief/reflection; My/team/BU/company; archive | WP4/WP5/WP7 | same IDs across views + no restricted leak |

## 6. Cross-domain epiki

| Epic | Zakres | Zakazane uproszczenie | Gate |
|---|---|---|---|
| XDOM-E001 KPI→ROI Evidence | pinned KPI definition/version/unit/purpose/freshness | luźne `kpi_id`, kopiowanie Actual | G6 |
| XDOM-E002 Initiative References | reverse navigation i summaries | wspólny lifecycle/status | G6 |
| XDOM-E003 Results→Finance | pinned artifact/version/mapping/reconciliation | auto-sync, second hidden SSOT | G6 |
| XDOM-E004 OKR Context | neutral source binding i optional references | structural FK/score inheritance | G6 |
| XDOM-E005 Work Orchestration | domain events→MyWork/Decision/notifications | skopiowany workflow state | G3/G6 |
| XDOM-E006 Teresa Organization | cross-domain briefs pod visibility caller | superuser, hidden data, silent action | G3/G7 |
| XDOM-E007 Projection Integrity | rebuild/count/checksum/failure isolation | cache jako źródło prawdy | G6/G7 |

## 7. UI/CX epiki

| Epic | Zakres | Acceptance source |
|---|---|---|
| UX-E001 Registry Triad | Menu 1/2/3, parent tables, view modes, CTA, filters/bulk/tabs | TRIADA + Table Surface Contract |
| UX-E002 Tables | sticky headers, columns, resize/persist, settings, selection, kebab, states | Table/Preview Canon |
| UX-E003 Preview | 6 blocks, one Open, relations, AI, actions, keyboard/focus/mobile | TRIADA + StandardPreview |
| UX-E004 Full Tools | sticky object header, phases, one CTA, save/lifecycle/conflict/history | UI UX Implementation Standard |
| UX-E005 Honest States | loading/empty/error/retry/denied/locked/conflict/degraded | shared states + Handbook |
| UX-E006 Visual System | tokens, typography, density, light/dark, semantic colors | UI CANON/foundation |
| UX-E007 Accessibility | keyboard, focus, ARIA, AA, reduced motion, touch semantics; includes KPI-A24 and domain equivalents | UI CANON + Handbook |
| UX-E008 Locale/Responsive | PL/EN, 1280/1440/1600/1920, zoom, tablet review | Handbook |
| UX-E009 Visual Evidence | screenshots, DOM/computed styles, console/network, exact SHA | Acceptance Handbook |

## 8. Obowiązkowy wiersz feature traceability

Wykonawca tworzy jeden wiersz dla każdego feature i AC:

| Pole | Wartość |
|---|---|
| Decision ID | |
| Epic ID | |
| Feature ID | |
| Acceptance ID | |
| Requirement | |
| Aggregate/owner | |
| Command/query/API | |
| Schema/migration/constraint | |
| Events/consumers | |
| UI route/surface | |
| Roles/visibility | |
| Implementation files/commit | |
| Unit/contract/integration tests | |
| E2E/security/a11y/visual tests | |
| Evidence IDs/paths/hashes | |
| Baseline/candidate/deployed SHA | |
| Environment/data IDs | |
| Status/blocker/waiver | |
| Reviewer/timestamp | |

## 9. Coverage rules

- Każda obowiązkowa funkcja i każde acceptance criterion ma bezpośrednie terminalne pokrycie testem albo jawne mapowanie do nazwanego testu cross-domain. Scenariusz na poziomie epiku nie implikuje pokrycia niewykonanych funkcji.
- Każdy command ma happy path, unauthorized, invalid, retry/idempotency i concurrency test, jeśli mutuje wersjonowany agregat.
- Każda projekcja ma parity test IDs/versions i non-leak test.
- Każdy lifecycle transition ma allowed/denied transition matrix.
- Każdy AI action ma retrieval, proposal, accept/reject, reauthorization i audit test.
- Każda tabela ma capability descriptor oraz pełny state/visual checklist.
- Każdy dowód wskazuje dokładny candidate SHA.
- Brak wiersza ledgeru oznacza brak pokrycia, nie implicit completion.

## 10. Program terminalny

Wykonawca może przygotować finalnego kandydata dopiero, gdy:

- wszystkie epiki mają status `IMPLEMENTED_EVIDENCED_CANDIDATE` albo — po niezależnym review — wyższy;
- wszystkie mandatory AC są powiązane z wykonaniem, testem i dowodem;
- RN-E2E-KPI-001, RN-E2E-ROI-001, RN-E2E-OKR-001, RN-E2E-XDOM-001, RN-E2E-XDOM-FIN-001, RN-E2E-XDOM-OKR-001, RN-E2E-XDOM-NOTIFY-001 i RN-E2E-XDOM-REPORT-001 przechodzą na jednym SHA;
- UX-E001–UX-E009 mają kompletny evidence manifest;
- wszystkie candidate-verifiable wymagania RN-G0–RN-G7 przechodzą na integrated SHA; autoryzowany deploy, `ACCEPTED_ACCEPTANCE_ENV` i terminalny Founder verdict pozostają etapem niezależnego odbioru Codex;
- nie istnieje obowiązkowy wiersz `PARTIAL`, `BLOCKED` albo `EVIDENCE_MISSING`.

Końcową akceptację nadal wykonuje niezależnie Codex; ten ledger nie pozwala wykonawcy zaakceptować własnej pracy.
