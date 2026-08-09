# Results Next — Execution Ledger (live)

> Nie edytować ręcznie sensu bez aktualizacji odpowiedniego wiersza. Ten plik jest
> jedynym źródłem prawdy o postępie programu w tej sesji wykonawczej. Aktualizowany
> po każdym bounded package / gate.

## 0. Baseline

| Pole | Wartość |
|---|---|
| Repo | consultify |
| Baseline ref | origin/demo |
| Baseline SHA | `9d17cac11484a82f729a51044e30453e39fbcb02` |
| Worktree | `/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify-results-vnext-g0-20260809` (sibling repo, PEŁNY checkout — NIE zagnieżdżony w consultify/) |
| Branch | `codex/results-vnext-g0-20260809` |
| Data startu | 2026-08-09 |
| Integration Owner | Sonnet 5 lead session (ta rozmowa); eskalacja architektoniczna -> Opus subagent na żądanie |
| Orkiestracja | Agent tool, subagenci Sonnet do implementacji; brak push/deploy bez autoryzacji |

### 0.1 Incydent setupu (naprawiony)

Pierwsza próba `git worktree add` użyła `-C consultify` + ścieżki relatywnej, co
zarejestrowało worktree zagnieżdżony wewnątrz `consultify/consultify-results-vnext-g0-20260809`
zamiast jako sibling. Ledger trafił do pustego katalogu bez repo. Naprawione:
stary nested worktree usunięty (`git worktree remove --force`), właściwy sibling
worktree utworzony z istniejącej gałęzi. Wszystkie ścieżki od tego momentu = absolutny
sibling path powyżej. Pierwsza fala agentów inwentaryzacyjnych została przekierowana
przez SendMessage na poprawną ścieżkę.

## 1. Gate status

| Gate | Status | Data | Uwagi |
|---|---|---|---|
| RN-G0 | IN_PROGRESS | 2026-08-09 | inwentaryzacja w toku (fala 1 przekierowana po błędzie ścieżki) |
| RN-G1 | NOT_STARTED | | |
| RN-G2 | NOT_STARTED | | |
| RN-G3 | NOT_STARTED | | |
| RN-G4 (KPI/ROI/OKR) | NOT_STARTED | | osobno per domena |
| RN-G5 | NOT_STARTED | | |
| RN-G6 | NOT_STARTED | | |
| RN-G7 | NOT_STARTED | | |

## 2. Open Decision & Evidence Register

Wypełniane w miarę odkrywania `EVIDENCE_NEEDED` z dok. 05 §5 oraz nowych podczas
inwentaryzacji. Każdy wiersz: ID, opis, blocking level (blokuje zależny kontrakt /
nie blokuje), właściciel, rekomendacja, status.

| ID | Opis | Blocking | Właściciel | Rekomendacja | Status |
|---|---|---|---|---|---|
| EN-01 | organization/team/manager hierarchy contract + kompletność realDB | tak (visibility/G1) | Platform | `teams` PŁASKIE (brak parent_team_id), `manager_id` istnieje ale NIGDY traversowany, zero `getManagementChain()`. Budować od zera w G1, nie rozszerzać | PARTIAL — fakty znane, implementacja OPEN |
| EN-02 | macierz ról i materiality thresholds per domena | tak (maker-checker/G1) | Security | RBAC(3-poziom)+PBAC(capability-key, shadow-only) istnieją. ABAC/visibility modes (OPEN_ORG/SCOPE/MANAGEMENT_CHAIN/PRIVATE/RESTRICTED_ACL) = ZERO wyników w grepie, budować od zera | PARTIAL — RBAC/PBAC fundament gotowy, ABAC OPEN |
| EN-03 | źródłowy kontrakt MyWork/Decisions/outbox rozszerzalny bezpiecznie | tak (G1/G3) | Platform | Decisions CAS wzorzec GOTOWY do kopiowania (decisionCollaborationService.ts:809-940, zweryfikować migrację 932 na demo!). Prawdziwy transactional outbox z event envelope NIE ISTNIEJE (notification_outbox=best-effort, non-atomic) — budować od zera | PARTIAL — Decisions wzorzec gotowy, outbox OPEN |
| EN-04 | stabilny route/history owner dla full tools | nie (G2) | Registry UX | TBD | OPEN |
| EN-05 | lista legacy write consumers (telemetry/logs) | tak (G1 legacy freeze) | Data | TBD | OPEN |
| EN-06 | polityka reflection waiver i min. liczby KR | nie (OKR G4) | OKR | TBD | OPEN |
| EN-07 | finance calculation artifacts/version identifiers (D06 seam) | nie (G6) | ROI/Finance | TBD | OPEN |
| EN-08 | znane zestawy known-answer ROI + polityki currency/discount/rounding | tak (ROI G4) | ROI | Known-answer fixture set TERAZ w pełni zdefiniowany w planie §16.1 (10 nazwanych scenariuszy, wymóg niezależnej weryfikacji). Rounding/currency/discount default nadal NIE zdecydowane liczbowo — plan mówi "decimal-safe + declared rounding policy" ale nie podaje wartości domyślnych, to robota WP0/WP1 (ROIPolicyVersion) | PARTIAL — fixture-set CLOSED, numeric policy defaults nadal OPEN |
| EN-09 | pilot population i pierwsze okresy/cykle | nie (G4) | Program | TBD | OPEN |
| EN-10 | nazwane terminalne acceptance environment (Railway demo / inne) | nie (poza zakresem wykonawcy, Codex/Founder) | Codex/Founder | N/A — decyzja poza mną | OPEN (nie blokuje implementacji) |
| EN-11 | `DOCUMENTATION_REGISTRY.md` przypisuje "Authority: Highest" trzem starym dok. V8 (`RESULTS_V8_SSOT.md`, `KPI_FULL_SYSTEM_CANON_V8.md`, `RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`, kwiecień 2026) dla dokładnie tej domeny, a `results-vnext/` nigdzie w rejestrze nie figuruje | nie (results-vnext §3 sam siebie stawia nad V8 jako "materiał do odzyskania" — rozstrzygnięte tekstem pakietu, nie wymaga mojej/Piotra decyzji) | Data/Docs hygiene | Traktuję results-vnext jako obowiązujący, V8 jako legacy-recovery source zgodnie z jego własną §3. Rejestr wymaga wpisu `superseded_by` — housekeeping, nie blocker | RESOLVED (informacyjnie zgłoszone Piotrowi) |
| EN-12 | `CLAUDE_DELEGATION_OPERATING_RULE_2026-08-07.md` opisuje SHARED worktree + jawne subagenty Sonnet; `CLAUDE.md` root wymaga izolowanego worktree per krok + "zero sub-agentów" — realna sprzeczność operacyjna, nie redakcyjna | nie (dla tej sesji rozstrzygnięte wprost instrukcją Piotra 2026-08-09: Opus orkiestruje / Sonnet koduje = autoryzacja subagentów) | Governance | Ta gałąź zostaje IZOLOWANA (bezpieczniejsze, nie koliduje z równoległą pracą) mimo że delegation rule sugeruje shared. Subagenty jawnie autoryzowane przez Piotra tę sesję. CLAUDE.md vs delegation-rule do formalnego pojednania przez Piotra/Codex kiedyś, nie teraz | RESOLVED (informacyjnie zgłoszone Piotrowi) |

## 3. Inventory findings (E0)

### 3.1 Incydent: results-vnext package był niescommitowany

`docs/product/results-vnext/*.md` (00–08) oraz `docs/program/CLAUDE_DELEGATION_OPERATING_RULE_2026-08-07.md`
i `docs/ui-standards/MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` istniały WYŁĄCZNIE jako pliki
`??` (untracked) w brudnym głównym worktree (`codex/sync-demo-20260729`) — nie ma ich
w `origin/demo` ani w żadnym commicie. Skopiowane (read-only z brudnego drzewa, bez
mutacji tam) i zacommitowane do tej izolowanej gałęzi: `8e1edbd066`, `d5c63f8688`.

Dodatkowo: `CANON.md`, `TRIADA_KANON.md`, `TABLE_AND_PREVIEW_CANON.md`,
`UI_UX_IMPLEMENTATION_STANDARD.md` są w brudnym drzewie ZMODYFIKOWANE względem
ostatniego commita na `origin/demo` (11-33 linii diff każdy — ktoś aktywnie edytuje
kanon UI równolegle). Ta izolowana gałąź celowo używa wersji z `origin/demo`
(ostatnio zatwierdzonej), NIE wersji z dirty tree — nie przejmuję cudzej pracy w toku.
→ **EN-11 (nowe)**: potwierdzić z Piotrem/Codex czy edycje kanonu w dirty tree są
zamierzoną aktualizacją, którą powinienem uwzględnić, zanim UI Results zacznie
polegać na dokładnych wartościach z CANON/TRIADA. Nie blokuje G0/G1 (dotyczy G2 UI).

### 3.2 KPI — model domenowy (z `02_KPI_IMPLEMENTATION_PLAN.md` + oryginał)

Agregaty: `KPI` (root), `KPIDefinitionVersion` (wersjonowany kontrakt pomiaru),
`KPIMeasurement` (append-only, correction przez `correction_of_measurement_id`),
`DeviationCase`, `CorrectiveAction`, `EffectivenessVerification` (osobna encja per
case, NIE per action — zmiana vs oryginał), `Scorecard`/`ScorecardItem`/
`ScorecardReviewSnapshot` (całkowicie nowe względem oryginału — Scorecard nie
istniał tam jako agregat, tylko jako UX view), `InitiativeKPIImpact` (referencyjna,
pełny schema tylko w oryginale §17.2, plan go nie powtarza).

**5 osobnych enumów stanu** (plan mówi "4 wymiary" koncepcyjnie, ale realnie to 5 pól):
`KPI.lifecycle_status` (draft→pending_approval→active↔suspended→archived),
`KPIDefinitionVersion.approval_status` (draft→submitted→approved|rejected),
`KPIMeasurement.performance_status` (neutral|safe|warning|critical),
`KPIMeasurement.data_quality_status` (verified|provisional|missing|disputed),
`DeviationCase.status` (open→analysis_required→plan_required→plan_submitted→
approved→executing→recovery_observed→verification→closed, +escalated jako overlay
nie osobny stan). Target geometries: `higher_better|lower_better|range|exact|
binary|custom` — pełna logika progowa tylko w oryginale §5, plan tylko referuje pola.

Sekwencja: Slice K0 (foundation/addytywny schema/legacy archive/Teresa context) →
K1 (create/activate contract) → K2 (measure/evaluate) → K3 (closed deviation loop)
→ K4 (Scorecard jako operating review) → K5 (Initiative/org integration). Gates
G0→G4 sprzężone ze Slice'ami; **K0-K3 nie mogą zależeć od ROI/OKR**.

Top P0 ryzyka z dok.: legacy write leakage przez nową UI (mitygacja: allowlist +
fizycznie read-only archive handler, nie tylko brak routes), generyczny `status`
zlewający wymiary, edycje definicji nadpisujące historię (wymaga DB-level
immutability + exclude constraint na `effective_from/to` overlap), deviation
zamykany bez weryfikacji skuteczności (wymaga twardej maszyny stanów, nie dowolnego
przeskoku do `closed`), restricted KPI przeciekający w sumach Scorecard (filter
PRZED agregacją), Teresa wymyślająca przyczynę/zmieniająca prawdę bez potwierdzenia.

Pełny raport (14 rozbieżności plan vs oryginał, pełne definicje geometrii,
role/permission model 9 ról, non-goals) — w transkrypcie agenta `a0052e74cbaa550b1`,
nie kopiowany tu w całości. Kluczowe do zapamiętania: Scorecard jest architektoniczną
dobudówką planu (brak w oryginale), meta-KPI/Grid Advisor/notification classes/
15-question quality advisor/12-step wizard z oryginału NIE mają odpowiednika w
planie — do decyzji czy odtwarzać czy świadomie pominąć jako out-of-scope V1.

### 3.3 OKR — model domenowy (z `04_OKR_IMPLEMENTATION_PLAN.md` + oryginał)

Hierarchia: `OKRProgram → OKRCycle → OKRSet` (materializowany, osobny agregat —
nieobecny explicite w oryginale, tam Objective miał `cycle_id/scope_type/scope_id`
bezpośrednio) → `Objective → KeyResult → OKRCheckIn`. Plus `ObjectiveAlignment`
(osobna encja z `status: proposed|accepted|rejected|removed`, NIE pole
`alignment_parent_objective_id` jak w oryginale), `OKRReview`,
`OKRApprovedSnapshot`, `OKRReflection`, `OKRMaterialChange`, `OKRAuditEvent`.

4 niezależne wymiary: progress (decimal|null|`not_calculable`, NIGDY fabrykowane
zero), confidence (high|medium|low|numeric|null, NIGDY ślepo uśredniane),
status (osobne enumy Objective vs KeyResult), attention (`OKRSet.attention_state`:
none|watch|action_required|escalated). Brak uniwersalnych progów 70/40 — polityka
Programu definiuje sugestie.

D09 (niezależność OKR od KPI) potwierdzone jako spójne z oryginałem — oryginał już
zabraniał bezpośredniego powiązania KR↔KPI, plan tylko formalizuje to jako brak FK
w schemacie + "neutral source binding" (typed reference, nie structural ownership).
Alignment: brak score inheritance/roll-up (bezpośrednie odrzucenie legacy cascade
behavior), autoryzacja + walidacja zgodności cyklu, cykle w grafie odrzucane,
restricted Objectives nie przeciekają przez węzły/liczniki/search/AI.

Scheduler: `cadence_occurrence_id` + `period_date`, idempotency przez
deterministic dedup key (cadence occurrence + obligation type + KR/Set), korekty =
nowa rewizja/event, nie nadpisanie. Visibility default `OPEN_ORGANIZATION` z
governed narrowing — per-record może TYLKO zawężać, nigdy poszerzać ponad politykę
Programu; nieautoryzowane rekordy są nieobecne (nie zredagowane).

Workpackages WP0 (contract/ADR/threat model) → WP1 (schema/engine/policies) → WP2
(API/authZ) → WP3 (MyWork/Decisions/scheduler) → WP4 (Teresa — **twarda zależność
pierwszego zaakceptowanego slice**) → WP5 (top-level list/preview) → WP6 (full tool)
→ WP7 (integration/rollout). DAG nie waterfall — WP1/WP3-projekt/WP4-evals/WP5-
kontrakt mogą iść równolegle po WP0.

Pełny raport (tabele enumów, pełne pola encji, ryzyka #1-13, workpackage detale) —
transkrypt agenta `a2daf0c4dd253d4d0`.

### 3.4 OKR — AS-IS kod (istnieje, nietrywialny, ale D09 częściowo naruszone)

4 tabele już na żywej bazie demo/prod (`914_okr_management.sql` + RES-009): `okr_cycles`
(Cycle = osobna encja, kwartalny, opcjonalnie dept/team-scoped), `okr_objectives`
(z `parent_id` cascade rollup), `okr_key_results` (z `kpi_id`+`kpi_definition_version_id`
FK), `okr_check_ins` (z deterministycznym `seq` tie-breaker). **Brak `okr_sets` i
`okr_programs`** — autorzy migracji świadomie spłaścili "jeden Set per dept×cykl" do
`okr_cycles.dept_id/team_id`, z komentarzem wprost że osobna tabela `okr_sets` to
udokumentowany follow-up. Zgodne z D08 (Set materializowany) = TO BUDUJEMY, nie
istnieje dziś.

API: `server/src/routes/resultsStrategic.routes.ts` (`/:projectId/okr/*`, 12
endpointów), serwis `okrService.ts` (846 linii, czyste funkcje scoringu +
CRUD). Wszystkie write-endpointy za `requireProjectCapability(..., {shadow:true})`
— **shadow-only, nic nie blokowane realnie** dopóki `CAPABILITY_ENFORCE=enforce`.

UI: brak dedykowanego huba `/results/okr` — OKR wtopiony w `ResultsHub.tsx` ("para 3"
KPI/ROI/OKR) i `StrategicLayerPanel.tsx` (BSC+BDN+OKR razem w jednym pliku), za
dwiema WSPÓLNYMI flagami (`strategicLayer`, `threePairs`), nie za dedykowaną flagą OKR.
`KpiOkrView.tsx` = martwy redirect do `/results`.

**Istniejące naruszenia D09 (OKR niezależny od KPI/ROI/Initiative) do odizolowania
przy budowie nowego `/results/okr`:**
1. Schema: `okr_key_results.kpi_id` FK→`initiative_kpis`, `kpi_definition_version_id`
   FK→`kpi_definition_versions` — twarde FK, mimo że nie napędza już scoringu.
2. Serwis: `getSuggestedValueForKeyResult` czyta `kpi_time_series` bezpośrednio;
   `okrService.ts` importuje `kpiDefinitionService.js` — cross-domain import.
3. UI: `OkrKeyResultModal.tsx` dropdown "Related KPI" z `V8ResultsApi.getKpiCatalog()`.
4. Brak nawet rozdzielenia EKRANÓW — OKR/KPI/ROI żyją w jednym pliku/module dziś.

**Dobra wiadomość**: scoring jest już manual-only (git: `bfadffdd4a` wprowadził
auto-score z KPI, `aa26ba4067` to cofnął, `0ce5488184` udokumentował w samej
migracji jako "superseded to informational-only") — czyli kierunek D09 na poziomie
LOGIKI WYNIKU już jest w repo, tylko schema/serwis/UI nadal mają cross-domain
sprzężenie do usunięcia. Realistycznie: istniejący kod to punkt odniesienia
(wzorce scoringu/cascade/check-in/shadow-capability), NIE baza do rozszerzenia pod
D08 (materialized Set) i pełne D09 (zero FK) — potrzebny nowy, izolowany model.

Pełny raport: transkrypt agenta `a17358decdf3aee4b`.

### 3.5 ROI — plan domenowy (WSTĘPNY, agent trafił na plik przed skopiowaniem do
tej gałęzi — dosłał tylko z oryginalnej specyfikacji, dociągam porównanie plan vs
oryginał osobno)

Z oryginału (`02_CONSULTIFY_ROI_BENEFITS_REALIZATION_SYSTEM.md`, 1742 linii):
14-stanowy lifecycle (`Not Started→Draft→Modeling→Ready for Review→Submitted for
Approval→Changes Requested→Approved→Rejected→Tracking/Execution→Benefits
Realization→PIR Due→PIR→Closed→Cancelled`), encje `ROICase/ROIBaseline/
ROIAssumption/ROICostLine/ROIBenefitLine/ROIScenario/ROICashFlowPeriod/
ROIForecastVersion/ROIApprovalSnapshot/ROIActual/ROIVariance/
ROIPostInvestmentReview/ROIEventLog`. Silnik: `ROI=(Benefits-Costs)/Costs`,
`NPV=ΣCF_t/(1+r)^t`, IRR opcjonalny/policy-gated, payback z fractional-period
interpolation. **Rounding policy i known-answer test corpus NIE są opisane nigdzie
w oryginale** — potwierdza EN-08 jako realnie otwarte, nie tylko proceduralnie.
"D06 Finance seam" nie ma żadnej sekcji w oryginale — do zaprojektowania od zera
(potwierdza EN-07). Immutable Approved: `ROIApprovalSnapshot` = pełny
zdenormalizowany JSON snapshot w momencie approval, re-approval tworzy
`Approved v2.0` obok `v1.0` (oba dostępne), nie nadpisanie.

Top ryzyka wskazane przez agenta: koegzystencja 3 stanów (Approved/Forecast/Actual)
bez kolapsu w każdym read-path; deterministyczny recompute przy ewoluującym silniku
(brak jasnej reguły co się dzieje ze starymi snapshotami przy zmianie engine
version); BAU/baseline incrementality (benefit liczony względem ruchomej linii
bazowej, nie stanu bieżącego); scenariusze muszą być przeliczane z otagowanych
assumption/cost/benefit rows, NIGDY wpisywane ręcznie jako gotowy wynik;
`double_counting_group` wymaga group-aware netting bez podanego algorytmu; KPI
jako opcjonalna ewidencja (nie parent) wymaga dyscypliny na poziomie schema+query.

**UZUPEŁNIONE po dosłaniu pliku** (agent `a4d7b6ec42463bcbb`, druga runda):

Nowe encje względem oryginału: `ROICalculationRun` (immutable run: input
snapshot/hash, engine version, policy version, scenario, status, metrics —
oryginał tylko wspominał "store snapshot/hash" jako luźną zasadę),
`ROIBenefitEvidenceLink` (typed, zastępuje luźne `evidence_reference_id` —
pinned KPI definition version, expected unit, purpose, freshness, dispute
status), `ROIWorkingRevision` (**genuinie nowy trzy-poziomowy model wersji,
którego oryginał w ogóle nie miał**: working revision [autosave/undo wewnątrz
Draftu] vs business version [submit/approve/forecast/reapproval/closure] vs
calculation run [immutable silnik] — częste edycje NIGDY nie tworzą business
version, tylko working revision), `ROIPolicyVersion` (wersjonowany, pinned przez
kalkulacje i approval — currency/discount rate/horizon/materiality thresholds/
maker-checker rules/PIR requirements). `ROICase` dostaje osobne
`original_approved_snapshot_id` vs `latest_approved_snapshot_id` (oryginał miał
jeden wskaźnik) + pełny model visibility/sensitivity (`visibility_mode:
restricted_acl|private|scope|management_chain|open_org`, `sensitivity`,
`approved_summary_visibility_policy_id`) + `row_version` (optimistic concurrency)
— ZERO tego w oryginale.

Storage: 21 tabel z prefiksem `rvn_` (§10, pełna lista w transkrypcie) — no
floating-point money (semantic decimal), JSON tylko dla immutable
snapshots/bounded extension, tenant isolation w query+cache+job+storage.

**Workpackages WP0→WP9** (dokładne nazwy z planu §15): WP0 Contract freeze →
WP1 Domain+deterministic engine (known-answer suite) → WP2 Persistence/jobs/
lifecycle → WP3 Registry/preview/Quick Create → WP4 Build Case workspace → WP5
Decision+approval → WP6 Forecast/Actual/Benefits Realization (**pokrywa 2
epiki: ROI-E004 I ROI-E005, nie 1:1**) → WP7 PIR+learning+portfolio → WP8
Finance seam → WP9 Legacy archive+hardening. Epic↔WP mapping z
`07_EPIC_AND_TRACEABILITY_LEDGER.md` już potwierdzony w tabeli §5 tego ledgeru.

**Silnik**: pipeline `typed inputs→validation/normalize→period cash-flow
expansion→scenario overrides→metrics→validation findings→immutable
CalculationRun`, MUSI być pure domain package (bez UI/DB/network). Safety
rules: divide-by-zero/undefined IRR → typed `N/A` nigdy fabrykowany wynik;
mixed currency → hard validation fail; "declared rounding policy" ale BEZ
default wartości (patrz EN-08 wyżej — częściowo zamknięte). Approval wymaga
świeżego, current run matching submitted snapshot (nowa reguła, oryginał tego
nie miał — zamyka lukę stale-compute-at-approval).

**Finance seam D06 — teraz w pełni zdefiniowany** (był całkowicie pusty w
oryginale): to jest nazwana decyzja Foundera ("D06, founder response 6C"), nie
domyślne zachowanie inżynierskie. Dokładna koperta (§9.6, dosłownie):
`finance_artifact_type, finance_artifact_id, finance_version_id, mapping
version, source/as-of, semantic unit/currency, link purpose`. Reguła
nienaruszalna: "Results never overwrites Finance values; Finance never
overwrites Approved/Forecast/Actual ROI truth; divergence produces a
reconciliation case, not silent last-write-wins sync." 10-punktowy gate (§20)
zanim D06 w ogóle może być ponownie rozważone do konsolidacji.

**Ważne odkrycie**: analiza to NIE jest zwykłe porównanie 2 dokumentów —
plan ma osobną tabelę (§1.3) rozstrzygającą sprzeczności z **"earlier Results
doctrine"** (wcześniejsza wewnętrzna doktryna Consultify, np. "standalone ROI
było dozwolone" → superseded), czyli realnie jest to rekoncyliacja
TRZECH źródeł (oryginał / stara wewnętrzna doktryna / nowy plan), nie dwóch.

UX: plan świadomie redukuje 12 równoległych zakładek oryginału (§18 źródła) do
4 faz (Build Case/Decision/Realize Value/Learn) — jawna decyzja redesignu, nie
tylko doprecyzowanie.

Zaktualizowana lista ryzyk = tabela §19 planu (13 ryzyk z mitygacjami) zastępuje
wcześniejszą listę 10 z pierwszej rundy — większość already addressed przez
nazwane mechanizmy planu. Jedno nowe ryzyko dostrzeżone przez agenta: jeśli
WP1 (silnik) wystartuje PRZED WP0 ustaleniem konkretnych default rounding
values w `ROIPolicyVersion`, testy jednostkowe silnika ryzykują pisanie
przeciw niezdefiniowanej polityce — do pilnowania przy planowaniu kolejności.

Pełny raport (pełne definicje encji, 21 tabel, API surface, event catalog 17
zdarzeń, kompletna tabela §19): transkrypt agenta `a4d7b6ec42463bcbb`.

### 3.6 UI canon — komponenty do re-użycia (zweryfikowane, istnieją w repo)

Menu1/2/3: `src/components/standard/StandardModuleBar.tsx`. Tabela: `StandardTable.tsx`
(fasada) → mechanika `src/components/shared/ModuleHub/FilterableTable.tsx` (SSOT,
24 adopcje). Orkiestracja selection/preview/klawiatura/historia/mobile:
`src/components/shared/TableWithPreviewLayout.tsx` (SSOT, 18 adopcji). Preview:
`StandardPreview.tsx`. Kanban: `StandardKanban.tsx`. Karta grid: `StandardGridCard.tsx`
/ widok kart: `src/components/shared/ModuleHub/GridView.tsx` (UWAGA: nazwa koliduje
z niepowiązanym `src/components/MyWork/table/GridView.tsx` — nie pomylić). Popover
kolumn: `TableSettingsPopover.tsx`. Pasek akcji preview: `PreviewPane/
PreviewActionBar.tsx` + style `PreviewPane/previewStyles.ts`. Kebab:
`RowActionsMenu.tsx`. Chipy: `ui/primitives/chips/*`. Selekcja wiersza:
`shared/selectionTokens.ts`. WYCOFANE, nie używać: `EnhancedDataTable.tsx`
(usunięty), `AdminTable.tsx`, `TablePresentationToggle.tsx` (martwy),
`ui/composed/DataTable.tsx` (0 importerów), `shared/StatusPill.tsx`,
`constants/statusColors.ts`.

Twarde wartości: crimson `#85182F` zakaz jako stan/CTA (marka wyłącznie). Focus
`--c-focus`/`--c-focus-solid` (dark `#5b8def`, light `#2563eb`). Preview
`clamp(340px, 28%, 480px)`, 6 bloków + jedno "Open", bez `border-l`. Hit target:
**44×44 TYLKO tablet/touch**; desktop (Results = desktop-first) min **24×24, pref
32×32** — kebab/Settings2 trigger = 32×32 z ikoną 16px. Kanoniczny odbiór 1440×900
@100%, obowiązkowy min. test 1280×720. Pełny raport z liniami cytowań: transkrypt
agenta `a3378245fbf26848d`.

### 3.7 ROI/Finance — AS-IS kod: MASYWNA FRAGMENTACJA, kluczowe dla decyzji legacy

**5 równoległych, częściowo nakładających się systemów ROI/Finance/Benefits**,
budowanych falami, część żywa część osierocona:

- **(A) Legacy Economics** — `analysis_financials`/`digitization_analyses`
  (`initiative_id` NULLABLE), backuje dzisiejszą trasę **`/roi`** (moduł
  Initiatives, `FullROIView.tsx`) — TO JEST INNA TRASA niż planowana `/results/roi`,
  URL-owo sąsiednia, do decyzji: koegzystencja czy przejęcie/redirect.
  **`FullROIWorkspace.tsx` — OSIEROCONY, zero importerów.**
- **(C) T046-T049 "Results ROI"** — `roi_assumptions` (**UNIQUE FK initiative_id,
  relacja 1:1** — najbliższy dzisiejszy odpowiednik "ROI Case"), `roi_realized_values`
  (append-only), backuje `/api/v8/results/roi/*`.
- **(E) V8 Results/ROI Continuity** — `v8_roi_realization_entries`/
  `v8_kpi_definitions` — **TEN SAM serwis (`resultsROIService.ts`) czyta z (C) w
  `getROIPortfolioSummary` a z (E) w `getROIDashboard`** — dwa różne magazyny
  danych karmiące różne funkcje jednego serwisu (linie 1360-1397 vs 1299-1354).
- **(B) `initiative_benefits`** (NOT NULL FK) vs **(D) `benefits_register`**
  (nullable FK, nowszy M14→M15 pipeline) — DWA różne stoły benefit, różne FK do KPI,
  żaden nie zastępuje drugiego. **`BenefitsHub.tsx` — OSIEROCONY, zero importerów.**
- **(F) Finance core (M16)** — kompletny, dojrzały, SAMODZIELNY model
  artefakt/wersja: `financial_statement_packs`→`financial_statement_versions`,
  `financial_models` (version/status/approved_snapshot), aktywnie rozwijany do
  sierpnia 2026, ~3500 linii `finance.routes.ts` + `FinanceHub.tsx` 3239 linii.
  Jedyny punkt splotu z Initiative: `financial_statement_packs.source_initiative_ids`
  JSONB (aggregate_scope initiative/portfolio) — potwierdza zasadność D06 (pinned
  seam, nie auto-sync) jako jedynego bezpiecznego wzorca integracji.

**Powiązanie Initiative↔ROI dziś = patchwork, NIE jeden silny kontrakt**: część
tabel wymaga initiative_id (roi_assumptions NOT NULL, initiative_benefits NOT NULL),
część pozwala na NULL (analysis_financials, financial_models, benefits_register) —
"ROI Case wymaga Initiative od utworzenia" (D05) nie istnieje dziś jako reguła
systemowa, tylko lokalnie w jednej z 5 linii.

**Wniosek do decyzji legacy/EN-05**: ~35+ migracji, 5 nienależnie ewoluujących linii
schematu, 2 potwierdzone osierocone komponenty UI. Nowy `/results/roi` będzie
potrzebował jawnej decyzji co robić z istniejącą trasą `/roi` (Initiatives module) —
koegzystencja czy przejęcie. Finance (F) NIE jest legacy do zamrożenia — to żywy,
równolegle rozwijany system, z którym Results ROI integruje się WYŁĄCZNIE przez
pinned seam (D06), zero prób rozszerzenia/przejęcia.

Pełny raport (dokładne plik:linia dla ~35 migracji, wszystkie route'y, wszystkie
komponenty UI): transkrypt agenta `a6fc7bee60ecfc818`.

### 3.8 KPI — AS-IS kod: fragmentacja PORÓWNYWALNA do ROI (4+ tabele definicji, 3 modele Scorecard)

**Cztery lokalizacje migracji** — `server/migrations/` (784 plików, README mówi "DEPRECATED" ale to WCIĄŻ jest realny katalog czytany przez `DatabaseInitializer.ts` na boot dla wzorca `/^(7\d{2}|\d{8})_/`), `migrations-v2/` (39, ma baseline dump ale NIE ma świeżych RES-0xx), `migrations-archive/` (637, historyczne), `never-ran/` (61, martwe). Dokumentacja katalogu jest myląca względem realnego zachowania runnera.

**Rdzeń aktywny**: `initiative_kpis` (FK od `tasks.kpi_id`, `kpi_scorecard_items`) + świeża fala RES-01..RES-11 (sierpień 2026: definition versions, time-series identity, recovery card, visibility policy, scorecards). **Ale obok niego co najmniej 4 INNE, częściowo nakładające się tabele definicji KPI** z różnymi typami kluczy i różnymi maszynami stanów: `kpis` (uuid id), `kpi_definitions` (osobny katalog z formula/dimensions), `v8_kpi_definitions` (własny state machine design→baseline→active→measurement→review→deviation→improvement→benefits_realization), `tp_kpi_definitions` (Table Platform "Governed Models" — CAŁKOWICIE INNY koncept KPI, współdzieli tylko nazwę). Plus ≥25 tabel satelickich (measurements, time-series, deviation×2 równoległe, wallboards, evidence, attribution, finance-reconciliation×2, next-actions, signals, milestones, audit-log, connectors, templates).

**Scorecard = TRZY niezależne implementacje już dziś**: `kpi_scorecards`/`kpi_scorecard_items` (RES-10, deklaruje się "kanoniczny", jedyny writer = `kpiScorecardService.ts`), `balancedScorecardService.ts`, `transformationScorecardService.ts` (osobne serwisy, osobne UI za flagą `transformationScorecard`). Żaden nie jest tym, co opisuje plan KPI-E004 (materializowany + immutable review snapshot) — RES-10 to najbliższy punkt startowy, ale bez snapshotów.

API rozproszone na **4 osobne routery**: `/api/results` (395 linii), `/api/v8/results` (4298 linii — największy pojedynczy plik), `/api/results-v4`, `/api/table-platform` (inny koncept KPI). Widoczność jako polityka (nie flaga): `kpiVisibilityService.ts` (RES-11) — `org_visible|initiative_restricted|private_to_owner`, jedyne miejsce tej logiki. Trasa `/results/kpi` **nie istnieje dziś** — `/results` jest zakładkowy nie ścieżkowy; jedyny literal `/kpi-okr` to martwy alias→redirect na `/results`.

Pełny raport (dokładne plik:linia dla wszystkich ~40 tabel/routes/serwisów/komponentów): transkrypt agenta `a7574f64cee39b870`.

### 3.9 MyWork/Decisions/Teresa/Events/Audit/RBAC — fundament platformy (RN-E002..E005)

**Decisions ma JUŻ prawdziwy CAS wzorzec — kopiować 1:1 dla KPI/ROI**: `expectedVersion` +
`SELECT...FOR UPDATE` + atomowa transakcja + `409 STALE_VERSION` na konflikt —
`decisionCollaborationService.ts:809-940`. **`resultsROIContinuity.ts:533` już
ZAPOWIADA dokładnie ten wzorzec** ("RES-02: CAS pointer — round-trip as
expectedVersion") — intencja architektoniczna już w typach, tylko niedopięta.
Caveat: migracja z kolumną `version`/`decided_by` to plik `932_...` (numeracja
9xx = NIE auto-uruchamiana na boot) — **zweryfikować na żywej bazie demo czy
faktycznie tam jest**, zanim zbuduje się na tym założeniu.

**Teresa (P08) ma już zarezerwowany, niepodłączony slot**: `HandoffTargetModule`
w typach zawiera `'results'|'kpi'|'roi'` (`teresaCopilotCanon.ts:26-43`), ale
**rejestr `P08_HANDOFF_TARGETS` i lista aktywnych modułów jeszcze go NIE
zawierają** — czysty, bezpieczny "dopisz nowy target" (wzorzec `handleRadarHandoff`
gotowy do skopiowania, z evidence_pointers/state machine/audit za darmo). Pełny
proposal lifecycle już istnieje: `proposal→pending_approval→approved→executing→
completed→undone→rejected`, `no_silent_writes`/`no_parallel_approvals` jako
twarde reguły (`teresaCopilotCanon.ts:254-286`). Audit: `teresa_proposals`/
`teresa_audit_log` — ale **self-provisioned inline (`ensureTeresaTables()`), NIE
przez system migracji** — do naprawienia przy budowie nowego.

**MyWork nie ma jednego kanonicznego bytu "obligation"** — dziś to agregacja z
`tasks`+`decisions`+`ai_inbox`(brak dedupe!)+`user_activity`. Bliższy odpowiednik:
`v8_canonical_object_states` (upsert-by-natural-key `(object_id,organization_id)`,
**nie CAS/version-based**, ale idempotentny) z rozszerzalnym enum
`CanonicalObjectType` — gotowy slot do dodania `'kpi'`/`'deviation_case'`.

**KRYTYCZNE — brak prawdziwego transactional outbox**: `notification_outbox`
istnieje, ale to best-effort, wołany PO commicie domenowej transakcji (jawny
komentarz w kodzie: "must not claim delivery succeeded"), zero event envelope
(brak aggregateType/actor/correlationId/causationId/policyVersion jako typu
domenowego — tylko HTTP request-tracing). **Trzeba zbudować od zera** — wzorzec
do naśladowania to atomowa transakcja Decisions, rozszerzona o INSERT do outbox
w TEJ SAMEJ transakcji (dokładne odwrotność dzisiejszego `notification_outbox`).

**KRYTYCZNE — zero infrastruktury ABAC/visibility**: RBAC (3 poziomy
superadmin>admin>user) i PBAC (capability-key, `effectiveAccessService.ts`,
shadow-only rollout) istnieją i działają produkcyjnie, ale **grep po
`OPEN_ORG`/`SCOPE`/`MANAGEMENT_CHAIN`/`PRIVATE`/`RESTRICTED_ACL` zwraca ZERO
wyników w całym `server/src`**. Dzisiejsza "widoczność" to wyłącznie ręczny
`WHERE organization_id=?` per-serwis. `manager_id` istnieje na profilu
(`user_profile_extended`), ale **nigdy nie jest traversowany** do budowy
management chain — zero usługi typu `getManagementChain(userId)`. `teams` jest
PŁASKIE (brak `parent_team_id`) — wielopoziomowa hierarchia nie istnieje.
**To jest fundament wymagany przez D10 (domenowa widoczność) i musi powstać w
G1 od podstaw** — nie ma czego rozszerzać.

Audit: `AuditEventsService`/`audit_events` = de facto SSOT, gotowy do wywołania
z nowego serwisu (jedna linia kodu), append-only jako konwencja aplikacyjna (BEZ
twardego DB constraint — brak triggera/REVOKE). Osobny równoległy
`tp_audit_events` dla Table Platform — nie mylić.

Pełny raport (wszystkie pliki/linie, agentProposalGovernanceService jako
cięższy alternatywny governance layer, pełna analiza organization/team): transkrypt
agenta `a16c12524cb5c7c80`.

## 4. File ownership / allowlists / integration DAG (RN-G0, napisane bezpośrednio przez
Integration Ownera na bazie wave-1 findings §3)

### 4.1 Workstream ownership

| Workstream | Właściciel | Zakres plików (NOWE, namespaced) | Zależy od |
|---|---|---|---|
| Platform | Integration Owner (ta sesja) | `server/src/services/resultsVnext/platform/*` (event envelope+outbox, ABAC/visibility resolver, management-chain traversal, typed MyWork/Decision refs), migracje `server/migrations/<8-digit-date>_rvn_platform_*.sql` | — (blokuje wszystko poniżej) |
| Registry UX | Integration Owner + Sonnet impl. | `src/components/ResultsVNext/shell/*` (Menu1/2/3, routing `/results/{kpi,roi,okr}`) — NOWY folder, NIE `src/components/Results/` (już przeciążony 44+ plikami legacy/v8) | Platform (auth/visibility) |
| KPI | Sonnet impl. | `server/src/services/resultsVnext/kpi/*`, `src/components/ResultsVNext/kpi/*`, `server/migrations/<date>_rvn_kpi_*.sql`, API `/api/vnext/results/kpi/*` | Platform, Registry shell |
| ROI | Sonnet impl. | `server/src/services/resultsVnext/roi/*`, `src/components/ResultsVNext/roi/*`, `server/migrations/<date>_rvn_roi_*.sql` (prefiks `rvn_` per plan §10), API `/api/vnext/results/roi/*` | Platform, Registry shell, Initiative (istniejące) |
| OKR | Sonnet impl. | `server/src/services/resultsVnext/okr/*`, `src/components/ResultsVNext/okr/*`, `server/migrations/<date>_rvn_okr_*.sql` (prefiks `okr_vnext_` per plan), API `/api/vnext/results/okr/*` | Platform, Registry shell |
| Teresa | Sonnet impl. | Rozszerzenie `teresaCopilotCanon.ts`/`teresaCopilotService.ts` — TYLKO dopisanie `results/kpi/roi/okr` do `P08_HANDOFF_TARGETS` + handlery, ZAKAZ zmiany istniejących targetów | Platform (proposal audit już istnieje), domeny (po pierwszym gold flow każdej) |
| QA/Evidence | Sonnet impl. | `tests/resultsVnext/*`, evidence manifest | wszystkie |

**Reguła krytyczna z §3.8**: migracje Results Next MUSZĄ używać prefiksu
`<8-cyfrowa-data>_` (np. `20260810_rvn_kpi_core.sql`), NIGDY numeracji `9xx_`
(potwierdzone niedziałająca na boot — `DatabaseInitializer.ts` łapie tylko
`/^(7\d{2}|\d{8})_/`). Migracja `932_decision_workflow_canonical.sql` (CAS wzorzec)
sama jest w tej martwej strefie — **do zweryfikowania na żywej bazie demo przed
oparciem się na jej kolumnach**.

### 4.2 Integration DAG (kolejność landowania, blokująca)

```
Platform (event envelope+outbox, ABAC/visibility resolver, mgmt-chain)
  → Registry shell (Menu1/2/3, routing)
    → [KPI | ROI | OKR równolegle — D14, niezależne workstreamy]
      → Teresa wiring (per domena, po pierwszym zaakceptowanym slice — D15/WP4 OKR)
        → Cross-domain (XDOM-E001..E007, G6) — TYLKO po samodzielnym G4 każdej domeny
```

Żaden domenowy workstream nie może definiować własnego auth/event-envelope/table
standard — łamie to regułę z 01_MASTER §10.2 i multiplikuje dokładnie ten sam
fragmentacyjny wzorzec znaleziony w §3.7/§3.8 (5 równoległych systemów ROI, 4
równoległe tabele KPI). Platform jest SSOT dla tych trzech mechanizmów.

### 4.3 Threat model (RN-G0 wymóg, przed implementacją zależnego kontraktu)

| # | Zagrożenie | Wektor | Mitygacja wymagana w G1 | Dowód wymagany |
|---|---|---|---|---|
| T1 | Cross-tenant leakage | Dziś widoczność = ręczny `WHERE organization_id=?` per-serwis (§3.9) — jeden zapomniany serwis = wyciek | Centralny visibility-resolver, egzekwowany na poziomie query-buildera nie per-serwis | IDOR + foreign-tenant negative test na KAŻDYM nowym endpoincie |
| T2 | Self-approval bypass | Maker-checker wymagany dla ROI approval/KPI definition/OKR Set — dziś capability-checki są **shadow-only** (`CAPABILITY_ENFORCE` domyślnie nie blokuje, §3.9) | Server-side twarda reguła porównująca `submitted_by`≠`approved_by`, NIE tylko UI disable | Test: autor próbuje zatwierdzić własną wersję → 403, drugi user → 200 |
| T3 | Visibility leakage przez agregację | Liczniki/search/export/AI muszą filtrować PRZED agregacją — dziś zero infrastruktury ABAC (§3.9 — potwierdzone: 0 wyników `OPEN_ORG`/`SCOPE`/itd. w repo) | Budować filter-before-aggregate jako wzorzec od pierwszego query, nie doklejać później | Restricted-outsider widzi count=0 nie N |
| T4 | Teresa overreach | Silent write / autonomiczny approval / wymyślone evidence | P08 proposal lifecycle JUŻ ISTNIEJE i jest dobry (`no_silent_writes`, audit) — tylko poprawnie wpiąć nowe domeny, nie omijać istniejącego kontraktu | Adversarial: prompt injection + cross-tenant test na każdym wired handlerze |
| T5 | Legacy write leakage | 5 równoległych systemów ROI + 4 równoległe KPI (§3.7/§3.8) — nowa UI przypadkiem trafia w stary endpoint | Fizyczna izolacja: legacy handler = tylko GET, brak POST/PUT/PATCH/DELETE route w ogóle (nie tylko brak wpisu w routerze) | Test: POST na dowolny legacy write endpoint z nowego kontekstu → odrzucony |
| T6 | Naruszenie immutability | Approved snapshot/definition version musi być niemutowalny — dziś "append-only" to WYŁĄCZNIE konwencja aplikacyjna (§3.9: audit_events bez triggera/REVOKE) | DB-level constraint/trigger blokujący UPDATE na zatwierdzonych wierszach, nie tylko aplikacyjny check | Bezpośredni UPDATE przez SQL (nie przez API) też musi failować |
| T7 | Idempotency/replay | Duplicate event/retry tworzący drugi obligation/deviation case/check-in | Deterministic dedupe key (cadence occurrence + obligation type + aggregate) — WZORZEC z Decisions CAS (§3.9) do powielenia, PRAWDZIWY transactional outbox (dziś nie istnieje) | Retry tego samego eventu 2x → jeden efekt, nie dwa |
| T8 | Money/decimal unsafety | ROI operuje na pieniądzach — plan wymaga decimal-safe, zero floating point (§3.5) | Typ kolumny NUMERIC/DECIMAL, nigdy FLOAT/REAL, w nowych tabelach `rvn_*` | Known-answer fixture z dokładnością co do grosza |
| T9 | Stale-compute-at-approval | Approval zatwierdza wynik silnika, który mógł się zdezaktualizować między compute a submit | Plan już to adresuje (§3.5: "approval requires successful current run matching submitted snapshot") — pilnować przy implementacji WP5 | Test: zmiana inputu po compute, przed approve → approval odrzucony/wymusza recompute |

## 5. Epic ledger seed

Referencja: `docs/product/results-vnext/07_EPIC_AND_TRACEABILITY_LEDGER.md` — wiersze
feature/AC dopisywane tu dopiero po ustaleniu realnych plików/komend, nie kopiowane
na sucho.
