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
| RN-G0 | PREPARED — pending independent review (Codex) | 2026-08-09 | Kontrakt+baseline+inventory+threat model+ownership/DAG+epic ledger (108 AC rows) kompletne. Brak nierozstrzygniętego P0 semantycznego blokującego G1. Nie mogę sam ogłosić PASS — to decyzja Codex/Foundera |
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
| EN-05 | lista legacy write consumers (telemetry/logs) | tak (G1 legacy freeze) | Data | Kod-poziom kompletny (nie runtime telemetry): 5 systemów ROI (§3.7), 4+ tabele KPI + 3 Scorecard (§3.8), dokładne plik:linia dla wszystkich write endpointów. Wystarczające do zaprojektowania T5 (fizyczna izolacja GET-only) w G1 | PARTIAL — code-level RESOLVED, runtime telemetry nie sprawdzana (nie blokuje) |
| EN-06 | polityka reflection waiver i min. liczby KR | nie (OKR G4) | OKR | TBD | OPEN |
| EN-07 | finance calculation artifacts/version identifiers (D06 seam) | nie (G6) | ROI/Finance | Pełna koperta zdefiniowana w planie §9.6 (`finance_artifact_type/id/version_id`+mapping version+source/as-of+unit/currency+purpose) — patrz §3.5. Realne Finance artifact IDs z żywego M16 do spięcia dopiero w G6 | RESOLVED (kontrakt), realne ID = G6 |
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

## 5. Epic ledger

Pełny, wypełniony ledger (23 epików, 108 wierszy feature/AC, wszystkie
`NOT_IMPLEMENTED`) w osobnym pliku: `docs/product/results-vnext/EPIC_LEDGER_LIVE.md`
(oddzielony od tego pliku, żeby zachować nawigowalność). Rozszerza szablon z
`07_EPIC_AND_TRACEABILITY_LEDGER.md` §8.

## 6. RN-G0 — stan zamknięcia (2026-08-09)

Zgodnie z kryteriami `06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md` §5 RN-G0:

| Wymóg | Stan |
|---|---|
| Decyzje D01-D15 zamknięte | ✓ (zamknięte w samym pakiecie) |
| ADR/supersession | ✓ częściowo — EN-11 (V8 docs vs results-vnext) rozstrzygnięte tekstem; EN-12 (delegation rule vs CLAUDE.md) rozstrzygnięte dla tej sesji; brak formalnego osobnego pliku ADR |
| Threat model | ✓ §4.3 (T1-T9) |
| Inventory kodu/routes/schema/consumers/flags | ✓ §3 (8 fal, KPI/ROI/OKR domena+kod, MyWork/Decisions/Teresa/events/RBAC/org) |
| Baseline branch/SHA/worktree/status | ✓ §0 |
| Ownership/allowlist/DAG | ✓ §4.1-4.2 |
| Ledger epików i kryteriów | ✓ `EPIC_LEDGER_LIVE.md`, 108 wierszy |
| Open Decision & Evidence Register | 6/12 RESOLVED, 3/12 PARTIAL (fakty znane, implementacja=G1 praca, nie brakująca decyzja), 3/12 OPEN nie-blokujące (EN-06 OKR policy=G4, EN-09 pilot population=Founder przed G4, EN-10 acceptance env=poza zakresem wykonawcy) |
| Brak nierozstrzygniętego P0 semantycznego | ✓ żaden otwarty punkt nie blokuje startu G1 |

**Wniosek**: G0 jest kompletne z mojej strony. Nie mogę sam ogłosić PASS
(zastrzeżone dla Codex/niezależnego review, zgodnie z `08_CLAUDE_COMPLETE_EXECUTION_PROMPT.md`
§13). Kontynuuję do E1/RN-G1 (platform foundation) — to jest dozwolone: dokument
mówi "po RN-G0, E1 Platform Foundation executes toward RN-G1", nie wymaga
zewnętrznego sign-off między G0 a startem G1.

## 7. RN-G1 Platform Foundation — decyzje projektowe (2026-08-09)

Draft agenta `a46aed05740e0f273` zrecenzowany i zaakceptowany z 4 decyzjami na
otwartych pytaniach (odpowiedzialność Integration Ownera, nie Foundera — zwykłe
wybory architektoniczne, nie nieodwracalne/finansowe/prawne):

| # | Pytanie | Decyzja | Uzasadnienie |
|---|---|---|---|
| 1 | Maintenance closure table: DB trigger czy service-layer? | **Service-layer**, w tej samej transakcji co UPDATE `manager_id` | Spójność z resztą repo (Decisions CAS też jest service-layer), łatwiejsze testowanie/debug niż trigger. Trigger rezerwujemy wyłącznie dla granic bezpieczeństwa (REVOKE na eventach), nie logiki biznesowej |
| 2 | Seed domyślnych visibility policies: migracja danych czy rollout script per-org? | **Rollout script per-org**, NIE migracja danych | D13-safe (clean start bez backfillu/zgadywania domyślnej polityki dla istniejących organizacji w samej migracji); fail-closed dopóki polityka nie zostanie jawnie autorowana |
| 3 | Weryfikacja żywej kopii `v8_canonical_object_states` (public vs v8 schema) przed ALTER | **Odroczone do momentu promocji na demo**, nie blokuje pracy w izolowanej gałęzi | Migracje w tej gałęzi nie dotykają demo automatycznie (promocja = osobny, gated krok wg `consultify-promocja-demo`). Migracja #4 pisana pod `public.` (zgodnie ze wzorcem WSZYSTKICH innych tabel znalezionych w §3) z jawnym komentarzem-gate w pliku migracji: NIE promować bez `information_schema` SELECT na demo najpierw |
| 4 | Consumer_group routing: kod czy tabela? | **Statyczna mapa w kodzie** (event_type→consumer_groups) | Mniej ruchomych części na start, rozszerzalne później bez zmiany schematu — zgodne z zasadą "nie budować dla hipotetycznej przyszłości" |

Dodatkowa luka znaleziona przy okazji (do zgłoszenia workstreamowi Teresa, nie
Platform): `HandoffTargetModule` w `teresaCopilotCanon.ts` ma już `'results'|
'kpi'|'roi'`, ale **brakuje `'okr'`** mimo że ledger §3.9 cytuje wszystkie trzy
jako zarezerwowane. Czysto TS, zero migracji.

**Zatwierdzone do implementacji**: 4 migracje w kolejności z draftu (events+outbox
→ visibility core → management chain closure → canonical_object_type extend),
serwisy w `server/src/services/resultsVnext/platform/*`. Pełny schemat/algorytm/
uzasadnienia: transkrypt agenta `a46aed05740e0f273`.

## 8. RN-G1 Platform Foundation — pierwszy realny kod wylądował (2026-08-09)

Commity `57015efbf6` (4 migracje SQL) i `c912f505dc` (TS scaffolding:
`eventEnvelope.ts`, `resourceTypes.ts`, `visibilityResolver.ts`, rozszerzenie
`CanonicalObjectTypeValues`). **Zweryfikowane osobiście, nie tylko na słowo
agenta** — przeczytałem migracje i `visibilityResolver.ts` w całości.

Ocena: zgodne z zamrożonym projektem, dwie dobrze udokumentowane dewiacje
(`REVOKE ... FROM PUBLIC` zamiast nazwanej roli — w repo nie ma żadnego wzorca
per-tabela REVOKE do naśladowania; SCOPE mode wpięty tylko dla `team_members`,
bo `initiative_contributors` z projektu nie istnieje w repo — inne scope_type
failują closed, nie silently allowed). Migracja #4 ma dodatkowy `DO $$ ...
EXCEPTION WHEN undefined_table` guard (własna, rozsądna inicjatywa agenta,
zgodna z `--safe` filozofią migracji w tym repo).

**Luka do zamknięcia przed dalszą budową**: weryfikacja była tylko przez
`esbuild --bundle` per plik (składnia+importy), NIE przez prawdziwy
`tsc --noEmit` — worktree nie miał `node_modules` (znany problem iCloud z
poprzednich sesji). To realna luka: esbuild nie łapie błędów typów (np. czy
`hasEffectiveCapability(access, '*')` faktycznie istnieje w sygnaturze
`effectiveAccessService.ts`, czy `resolveEffectiveAccess({userId,
organizationId})` bez `projectId` faktycznie działa dla zasobów
organizacyjnych, nie projektowych). Uruchomiłem `npm ci` (nie symlink z
głównego repo — package.json/lockfile się różnią, 27 linii diff) w tym
worktree, w toku.

**Pozostałe do G1** (jawnie NIEDOKOŃCZONE, zgodnie z zakresem bounded package):
atomowy write helper (§A.4 projektu — CAS+event+outbox w jednej transakcji),
outbox drain cron (§A.5), `rvnVisibilityScopedQuery` CTE wrapper (§B.4 — to
jest mechanizm, który ma czynić "zapomnienie filtra" strukturalnie niemożliwym,
jeszcze nie zbudowany), management-chain maintenance service (zapis przy
zmianie `manager_id`, decyzja #1). Nic z tego jeszcze nie jest wpięte do
żadnego callera/route — to świadomie inert scaffolding.

## 9. RN-G1 — luka weryfikacyjna zamknięta (2026-08-09)

`npm ci` w tym worktree (osobny lockfile niż main, 27 linii diff — świadomie
NIE symlink z głównego repo) + `NODE_OPTIONS=--max-old-space-size=8192 npx tsc
--noEmit` na całym `server/` (tsconfig `include: src/**/*`, obejmuje
`resultsVnext/platform/*` i `myWorkRoofPackage.ts`): **0 błędów TS, proces
zakończony czysto, brak śladów OOM crash** (mimo znanego ryzyka "tsc OOM-uje i
udaje sukces" z wcześniejszych sesji — tu użyto flagi pamięci i sprawdzono
faktyczną treść logu, nie tylko exit code, który sam w sobie był niewiarygodny
przez pipe do `tee` bez `pipefail`). To potwierdza, że `hasEffectiveCapability`/
`resolveEffectiveAccess` są wołane ze zgodnymi sygnaturami — konkretna
niepewność, którą flagowałem w §8, jest zamknięta.

**RN-G1 Platform slice 1 (schema + typy) = zweryfikowany, real, verified.**
Node_modules w tym worktree jest teraz dostępny dla przyszłej pracy (testy,
kolejne type-check) bez ponownego `npm ci`.

## 10. RN-G1 Platform kernel — kompletny (2026-08-09)

Commit `21ddd501ed`: `atomicWrite.ts` (generyczny `executeAtomicCommand<TAggregateRow,
TResult>` — CAS+event+outbox w jednej transakcji, §A.4) i `outboxDrain.ts`
(`claimOutboxBatch`/`reclaimExpiredClaims`/`markDispatched`/`markFailed` z
exponential backoff i dead_letter, §A.5). **Zweryfikowane przeze mnie osobiście
dwukrotnie**: przeczytałem oba pliki w całości (poprawna logika — duplicate
idempotency key poprawnie rollbackuje mutację i zwraca poprzedni wynik zamiast
podwójnego zastosowania; backoff liczony w jednym UPDATE bez race condition;
dead_letter loguje TODO zamiast cichego końca) + niezależnie uruchomiłem
`tsc --noEmit` (bez pipe/tee tym razem, czysty exit code) — **0 błędów**.

**RN-G1 Platform kernel jest teraz kompletny i zweryfikowany**: schema (4
migracje) + typy (CanonicalObjectType rozszerzony, RVN_RESOURCE_TYPES SSOT) +
ABAC resolver (pełny algorytm B.3) + atomowy write helper (A.4) + outbox drain
primitives (A.5). Wszystko wciąż CELOWO niewpięte do żadnego callera/route —
to jest fundament, na którym KPI/ROI/OKR (D14 — równoległe workstreamy) będą
budować własne agregaty. Pozostałe z G1 przed pełnym RN-G1 PASS: management-chain
maintenance service (zapis przy zmianie manager_id), `rvnVisibilityScopedQuery`
CTE wrapper (B.4), realDB migration test (pusta+realistyczna kopia bazy, wymóg
handbooka §5 RN-G1) — to wymaga efemerycznej Postgresa, nie tylko tsc.

## 11. RN-G1 — migracje na realnym Postgresie (2026-08-09) — PASS (częściowy zakres)

Zamknięcie luki z §10: `tsc --noEmit` weryfikuje TYLKO typy, nie schema SQL na
żywym silniku. Zgodnie ze złotą regułą repo ("Weryfikuj REALNY runtime, nie
docy/flagi") uruchomiono 4 migracje RN-G1 na efemerycznym Postgresie 16
(Homebrew `postgresql@16`, niepodpięty do `PATH` domyślnie — binaria w
`/opt/homebrew/opt/postgresql@16/bin`). Gotowego skryptu-przepisu w
`scripts/` NIE znaleziono (`grep -rl ephemeral scripts/` — zero trafień);
użyto ręcznie odtworzonego przepisu z pamięci sesji
`audyt-bazy-danych-2026-08-06` (`initdb --locale=C`, `LC_ALL=C` przy starcie,
krótki katalog gniazda `/private/tmp/cfy-rn-g1-sock` — limit 103 bajty na
ścieżkę Unix socketu, którego długa ścieżka worktree/iCloud by przekroczyła).
`docker`/`colima` są zainstalowane, ale daemon nie chodził (`colima list` →
oba profile `Stopped`) — Postgres z Homebrew był szybszą ścieżką, więc Docker
nie był potrzebny.

**Komendy (streszczenie, pełny log w tej sesji agenta):**
```
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
initdb --locale=C -D /private/tmp/cfy-rn-g1-pgdata -U postgres
LC_ALL=C pg_ctl -D /private/tmp/cfy-rn-g1-pgdata \
  -o "-k /private/tmp/cfy-rn-g1-sock -p 5544" -l .../pg.log start
createdb -h /private/tmp/cfy-rn-g1-sock -p 5544 -U postgres cfy_rn_g1_test
psql -h ... -f 20260809_rvn_platform_events_outbox.sql
psql -h ... -f 20260809_rvn_platform_visibility_core.sql
psql -h ... -f 20260809_rvn_platform_management_chain.sql
psql -h ... -f 20260809_rvn_platform_canonical_object_type_extend.sql
```

**Wynik — 5 sprawdzeń z zadania, wszystkie PASS:**

1. **Aplikacja na pustej bazie** — wszystkie 4 migracje, w kolejności,
   `ON_ERROR_STOP=1`: `exit 0` każda, zero błędów. Migracja #4 poprawnie
   weszła w gałąź `EXCEPTION WHEN undefined_table` (brak
   `v8_canonical_object_states` na czystej bazie) i wykonała się jako no-op.
2. **Idempotencja** — te same 4 pliki uruchomione DRUGI raz na tej samej
   bazie: same `NOTICE: relation "..." already exists, skipping` +
   `CREATE TABLE`/`CREATE INDEX`/`CREATE EXTENSION`, `exit 0` każda. Brak
   błędów przy powtórnym uruchomieniu.
3. **Struktura tabel** — `\dt rvn_platform_*` zwraca dokładnie 7
   oczekiwanych tabel (`rvn_platform_events`, `rvn_platform_outbox`,
   `rvn_platform_projection_checkpoints`, `rvn_platform_visibility_policies`,
   `rvn_platform_resource_visibility`, `rvn_platform_resource_acl`,
   `rvn_platform_management_chain_closure`); `\d rvn_platform_events`
   potwierdza pełny zestaw kolumn + indeksy + FK z `rvn_platform_outbox`.
4. **Migracja #4 na pustej bazie — explicite osobny test**: zweryfikowano NIE
   TYLKO że nie rzuca błędu (punkt 1), ale DODATKOWO uruchomiono ją na
   DRUGIEJ, osobnej bazie ZE zbudowaną ręcznie `v8_canonical_object_states`
   (stary CHECK z 8 wartości) — INSERT `'kpi'` odrzucony PRZED migracją
   (`violates check constraint`), migracja aplikuje się dwukrotnie bez błędu,
   PO migracji INSERT `'kpi'`/`'roi_case'`/`'okr_set'`/`'deviation_case'`
   przechodzi, stara wartość `'task'` nadal działa, a `'bogus_type'` nadal
   jest odrzucany. Confirmed: rozszerzenie CHECK jest poprawne i idempotentne
   w OBU gałęziach (tabela brak / tabela obecna).
5. **INSERT + REVOKE na `rvn_platform_events`** — INSERT jako `postgres`
   (owner) powiódł się. `UPDATE` jako **owner/superuser** (`postgres`)
   **POWIÓDŁ SIĘ** (`UPDATE 1`) — to jest DOKŁADNIE ograniczenie, które sama
   migracja dokumentuje w komentarzu (`REVOKE ... FROM PUBLIC` nie chroni
   przed połączeniem jako owner/superuser, a "app currently connects as
   table owner in every environment this was checked against"). Aby
   potwierdzić że REVOKE faktycznie coś robi, dodatkowo utworzono rolę
   NIE-ownera (`rvn_nonowner`, tylko `GRANT SELECT, INSERT`) i jako ta rola
   `UPDATE`/`DELETE` na `rvn_platform_events` skończyły się
   `ERROR: permission denied for table rvn_platform_events` (exit 1) — czyli
   REVOKE realnie blokuje UPDATE/DELETE dla każdej roli, która nie jest
   ownerem/superuserem, zgodnie z udokumentowanym zamierzeniem migracji.

**Sprzątanie**: `pg_ctl stop -m fast` + `rm -rf` katalogu danych i gniazda —
żadnych trwałych artefaktów poza tym wpisem w ledgerze.

**Co NIE zostało zweryfikowane w tym kroku (świadomie poza zakresem
zlecenia)**: (a) "realistyczna kopia bazy" z §5 handbooka rozumiana jako pełna
migrowana kopia demo/staging (1000+ istniejących migracji) — testowano tylko
pustą bazę + jeden ręcznie zbudowany scenariusz "tabela z danymi" dla migracji
#4, nie pełny łańcuch `db:migrate` od zera; (b) "rollback lub forward-repair
rehearsal" (drugi wymóg §5 RN-G1) — nie testowany, migracje nie mają jawnych
plików rollback; (c) zachowanie REVOKE pod realną rolą aplikacyjną tego repo
(nie zweryfikowano jaką rolą faktycznie łączy się produkcyjny pool — migracja
sama to flaguje jako "sprawdzone we wszystkich środowiskach = connects as
owner", to ustalenie nie zostało tu ponownie zweryfikowane, tylko odtworzone
zachowanie superusera).

**Wniosek**: 4 migracje RN-G1 są mechanicznie poprawne, idempotentne i
bezpieczne do uruchomienia na pustej bazie — ten konkretny blok pracy
("zweryfikuj na realnym Postgresie, nie tylko tsc") jest zamknięty jako PASS.
Pełne RN-G1 PASS z §5 handbooka pozostaje otwarte na pozycje (a)/(b) powyżej
oraz na pozostałe z §10 (management-chain maintenance service,
`rvnVisibilityScopedQuery`).

## 12. RN-G1 — management-chain maintenance service (2026-08-09)

Commit `72d284805e`: `managementChainMaintenance.ts`
(`updateManagerAndRecomposeClosure`, service-layer zgodnie z decyzją #1).
**Zweryfikowane przeze mnie osobiście** — przeczytałem plik w całości.
Algorytm cyklu poprawny (walk `newManagerId` w górę, `current===userId` w
dowolnym kroku = odrzucone PRZED zapisem; self-assignment też poprawnie
łapany jako trywialny cykl na pierwszej iteracji). Rekompozycja poddrzewa
(delete tylko zewnętrznych starych ancestor-linków wskazujących w poddrzewo,
cross-product nowych ancestors × członków poddrzewa) to standardowy, poprawny
wzorzec reparentingu w tabeli closure. Dewiacja dobrze uzasadniona i
zweryfikowana w źródle (nie zgadywana): `user_profile_extended` NIE ma
kolumny `organization_id` — bound cyklu liczony z `users` zamiast. tsc: 0
błędów (uruchomione dwukrotnie przez agenta, złapało i naprawiło jeden
realny błąd typów po drodze — TS7022 na kształcie pętli).

**RN-G1 core (schema+ABAC+atomic write+outbox drain+management chain) jest
teraz kompletny i zweryfikowany w całości.** Jedyny brakujący kawałek z §10
przed pełnym RN-G1 PASS: `rvnVisibilityScopedQuery` CTE wrapper (§B.4) — to
jest mechanizm strukturalnie wymuszający "filter przed agregacją" (T3), którym
przyszłe domenowe repozytoria KPI/ROI/OKR będą musiały owijać każde
list/count/search/export zapytanie. Nic z platform kernel nie jest jeszcze
wpięte do żadnego callera — to świadomie inert scaffolding, gotowe pod
pierwszą domenę.

## 13. RN-G1 — platform core kernel KOMPLETNY (2026-08-09)

Commit `51bb010f6f`: `visibilityScopedQuery.ts` — `buildVisibilityScopedCte()`
i `wrapWithVisibilityScope()`, siostrzany mechanizm do `visibilityResolver.ts`
(§B.3 jeden resolve-per-resource) dla list/count/search/export: JEDNO zapytanie
CTE `rvn_visible_resources(resource_type, resource_id)`, UNION (nie UNION ALL)
po tych samych gałęziach co resolver — RBAC/PBAC override, OPEN_ORG, PRIVATE,
SCOPE (tylko `team_members`, ta sama dewiacja co resolver — `initiative_contributors`
nie istnieje), MANAGEMENT_CHAIN (owner + closure), RESTRICTED_ACL (user grantee
only). To jest mechanizm z threat modelu T3 (§4.3) — ma czynić "zapomnienie
filtra" w liczniku/wyszukiwarce/eksporcie strukturalnie niemożliwym.
**Zweryfikowane osobiście**: przeczytałem plik w całości + niezależnie
uruchomiłem `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` w
`server/` DWA razy (raz z `tee` do logu, raz bez pipe żeby exit code był
wiarygodny, zgodnie z lekcją z §9 o niewiarygodnym exit code za pipe bez
`pipefail`) — **0 błędów oba razy**.

Dewiacja od dosłownego §B.4 (udokumentowana w pliku): projekt nazywa
funkcję `rvnVisibilityScopedQuery(baseQuery, {userId, organizationId,
resourceType, action})`; zadanie zleciło dwie mniejsze funkcje
(`buildVisibilityScopedCte` / `wrapWithVisibilityScope`) bez parametru
`action` — RBAC/PBAC override liczony jest więc względem stałej capability
`${resourceType}.view` (najniższy rank), bo operacja listowa nie ma
pojedynczej mutującej akcji tak jak resolve pojedynczego zasobu. Przyszły
wołający potrzebujący bulk-akcji innej niż `view` powinien zawężać wynik tej
CTE per-wiersz przez `resolveVisibility()`, nie rozszerzać gałąź RBAC tej CTE
— visibility i capability muszą zostać rozdzielone zgodnie z §B.3 krok 4.
Druga dewiacja: numeracja parametrów SQL — `baseQuerySql` przekazywany do
`wrapWithVisibilityScope` musi numerować własne `$N` od `VISIBILITY_CTE_PARAM_COUNT
+ 1` (dziś `$4`), bo Postgres numeruje placeholdery globalnie po doklejeniu
CTE; to udokumentowane w komentarzu funkcji i w przykładzie użycia na górze
pliku (hipotetyczny `kpiRepository.listScorecards` — KPI repo jeszcze nie
istnieje, sam przykład jest tylko w komentarzu).

### RN-G1 Platform core kernel — pełna lista (schema + serwisy, od początku)

| Commit | Zawartość |
|---|---|
| `370017d3b7` | docs: zamrożenie projektu RN_G1_PLATFORM_DESIGN.md przed implementacją |
| `57015efbf6` | migracje: `20260809_rvn_platform_events_outbox.sql`, `20260809_rvn_platform_visibility_core.sql`, `20260809_rvn_platform_management_chain.sql`, `20260809_rvn_platform_canonical_object_type_extend.sql` |
| `c912f505dc` | TS scaffolding: `eventEnvelope.ts`, `resourceTypes.ts` (RVN_RESOURCE_TYPES SSOT), `visibilityResolver.ts` (§B.3 algorytm), rozszerzenie `CanonicalObjectTypeValues`, `README.md` |
| `9adbd593bb` | docs: nota o potrzebie `npm ci` do realnego tsc |
| `5f88783b6d` | docs: slice 1 zweryfikowany, realny tsc czysty, 0 błędów |
| `21ddd501ed` | serwisy: `atomicWrite.ts` (§A.4 — generyczny `executeAtomicCommand`, CAS+event+outbox w transakcji), `outboxDrain.ts` (§A.5 — claim/reclaim/dispatch/fail z backoff+dead_letter) |
| `b33e39a48f` | docs: kernel kompletny + niezależnie zreweryfikowany, 0 błędów tsc |
| `13ee6ac36f` | docs: migracje zweryfikowane na realnym Postgresie 16 (efemeryczny), PASS częściowego zakresu (§11) |
| `72d284805e` | serwis: `managementChainMaintenance.ts` (`updateManagerAndRecomposeClosure`, decyzja #1 — service-layer w tej samej transakcji co `manager_id` UPDATE, cycle protection) |
| `c47d701e12` | docs: management-chain service zweryfikowany, core kernel kompletny poza CTE wrapperem |
| `51bb010f6f` | serwis: `visibilityScopedQuery.ts` (§B.4 — `buildVisibilityScopedCte`/`wrapWithVisibilityScope`, T3 mitigation) |

**Pliki źródłowe kompletnego kernela** (`server/src/services/resultsVnext/platform/`):
`README.md`, `eventEnvelope.ts`, `resourceTypes.ts`, `visibilityResolver.ts`,
`atomicWrite.ts`, `outboxDrain.ts`, `managementChainMaintenance.ts`,
`visibilityScopedQuery.ts` — plus 4 migracje w `server/migrations/20260809_rvn_platform_*.sql`.

### Co POZOSTAJE przed pełnym RN-G1 PASS (wg `06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md` §5)

Handbook §5 RN-G1 wymaga: addytywne clean-start schemas · repozytoria i typed
commands/queries · optimistic concurrency i idempotency · server-side RBAC+ABAC
· visibility policies · append-only audit/events i transactional outbox ·
evidence/provenance · MyWork/Decision typed references · legacy adapters
read-only · migracja na pustej i realistycznej kopii bazy · rollback lub
forward-repair rehearsal. Stan wobec tej listy:

- **Zrobione i zweryfikowane**: clean-start schemas (4 migracje, §11) · optimistic
  concurrency+idempotency (`atomicWrite.ts` CAS + `idempotency_key` unique
  constraint) · server-side RBAC+ABAC (`visibilityResolver.ts` + `hasEffectiveCapability`,
  nie UI-only) · visibility policies (schema §B.1 + resolver §B.3 + CTE wrapper
  §B.4 — teraz kompletne) · append-only audit/events+transactional outbox
  (`rvn_platform_events` REVOKE-owany + `rvn_platform_outbox` + `outboxDrain.ts`)
  · MyWork/Decision typed references (`CanonicalObjectTypeValues` rozszerzony,
  `link_graph_edges` reużyty bez migracji per §C.2) · migracja na PUSTEJ kopii
  bazy (efemeryczny Postgres 16, §11, PASS).
- **Jawnie NIEDOKOŃCZONE — do zrobienia PRZED pełnym RN-G1 PASS**:
  1. **Nic z tej warstwy nie jest jeszcze wpięte do żadnego callera/route/kontrolera.**
     Wszystkie 8 plików serwisowych to celowo inert scaffolding — pierwsze
     realne wpięcie nastąpi dopiero gdy domena KPI, ROI lub OKR (osobny,
     jeszcze nie rozpoczęty workstream) zacznie budować własny agregat i
     repozytorium na tym fundamencie.
  2. **"Repozytoria i typed commands/queries"** z listy handbooka to wymóg
     PER DOMENA — `atomicWrite.ts`/`visibilityScopedQuery.ts` to generyczne
     prymitywy, ale ŻADNE konkretne domenowe repozytorium (KPI/ROI/OKR) nie
     istnieje jeszcze, więc ten punkt handbooka jest tylko częściowo spełniony
     na poziomie platformy.
  3. **Migracja na REALISTYCZNEJ kopii bazy** (§11 pkt (a) — pełny `db:migrate`
     łańcuch od zera na kopii demo/staging z 1000+ istniejącymi migracjami,
     nie tylko pusta baza) — NIE zrobione.
  4. **Rollback lub forward-repair rehearsal** (§11 pkt (b), drugi wymóg §5
     handbooka wprost) — NIE testowane; migracje nie mają jawnych plików
     rollback.
  5. **Legacy adapters read-only** (T5 z §4.3 — fizyczna izolacja: legacy
     handlery mają mieć TYLKO GET, brak route'ów POST/PUT/PATCH/DELETE) — poza
     zakresem tego bounded package, nie dotknięte.
  6. **Evidence/provenance** — kolumna `evidence_refs` istnieje w schemacie
     `rvn_platform_events` (§A.1), ale nie ma funkcjonalnego testu który by ją
     faktycznie wypełniał i czytał przez pełny cykl zapisu.
  7. **RESTRICTED_ACL break-glash audit event** — resolver i CTE wrapper obie
     failują closed (`RESTRICTED_REQUIRES_BREAK_GLASS`) zamiast emitować
     zdarzenie audytowe, bo sam mechanizm break-glass nie jest zbudowany.
  8. **RESTRICTED_ACL team/role grantee** i **SCOPE poza `scope_type='team'`**
     pozostają NOT_IMPLEMENTED (fail-closed) w obu plikach — świadome,
     udokumentowane zawężenie do tego co realnie istnieje w repo, nie luka
     odkryta przypadkiem.

**Wniosek**: RN-G1 core kernel (schema+ABAC resolver+atomic write+outbox
drain+management chain+CTE wrapper) jest teraz KOMPLETNY jako fundament —
wszystkie elementy §B/§A projektu z `RN_G1_PLATFORM_DESIGN.md` mają
odpowiadający, zweryfikowany kod. Pełne RN-G1 PASS pozostaje otwarte na
punkty 1–8 powyżej, z czego (1) i (3)/(4) są największe — wpięcie do
pierwszej realnej domeny i weryfikacja migracji poza pustą bazą.

## 14. E4 KPI-E001/E002 — design zamrożony (2026-08-09)

Draft agenta `a2f31db3dd772a6e2` zrecenzowany, 12 otwartych pytań rozstrzygniętych.
Pełny projekt: `docs/product/results-vnext/KPI_E001_E002_DESIGN.md`. Kluczowe
decyzje: partial `EXCLUDE` na zatwierdzonych wersjach (draft/reject cykle
muszą pozostać możliwe), nowy wzorzec DB trigger dla częściowej niemutowalności
(precedens dla ROI/OKR Approved snapshots), measurement commands NIE przechodzą
przez CAS rodzica (własny unique constraint na okres wystarcza, unika
niepotrzebnej serializacji zapisów), self-approval denial wymuszony
server-side wewnątrz `applyMutation`. Zidentyfikowana i zaakceptowana luka w
platformie: brak `executeAtomicCreate` (sibling `executeAtomicCommand` dla
tworzenia nowych agregatów) i brak `getActiveVisibilityPolicy` — oba
dopisywane do `platform/*` jako część tego pakietu (platform pozostaje SSOT,
KPI nie tworzy równoległego mechanizmu). Implementacja w toku.

## 15. KPI-E001/E002 — platform additions + core schema migracja na realnym Postgresie (2026-08-09)

**Ważne odkrycie przed implementacją**: pełny tekst DDL/kodu z draftu agenta
`a2f31db3dd772a6e2` (sekcje §A.2-A.7, §B, §C, §D), o którym
`KPI_E001_E002_DESIGN.md` mówi "ratified as-is... see conversation/ledger for
complete text", **NIE istnieje nigdzie w tym worktree** — zweryfikowane przez
`grep -rln "rvn_kpi_definitions\|executeAtomicCreate\|targetGeometryEvaluator"
. --include="*.md" --include="*.ts" --include="*.sql"` PRZED napisaniem
jakiegokolwiek kodu KPI: zero trafień poza samym `KPI_E001_E002_DESIGN.md` i
tym ledgerem. Implementacja poniżej jest więc od-zera rekonstrukcją, która
spełnia dosłownie każdy jawny wymóg z decyzji #1-#12 i z listy "Key points"
tego dokumentu (nazwy tabel, partial EXCLUDE, nazwa i semantyka triggera
`protect_approved`, dwie niezależne kolumny statusu na measurements, jeden
resource_type='kpi' dla widoczności, append-only REVOKE, rozwiązanie
cyklicznego FK przez ALTER po utworzeniu obu tabel, semantyka boundary
rule/exact geometry z decyzji #7/#9/#10) — nazwy kolumn i typy POZA tym co
dokument dosłownie przypina są osądem implementatora, nie odtworzeniem
oryginału. Flaga do weryfikacji, gdyby oryginalny tekst draftu się odnalazł.

**Package 1** (`2ae8170be9`): `executeAtomicCreate<TResult>` w
`atomicWrite.ts` (sibling `executeAtomicCommand`, bez CAS/loadForUpdate),
literówka `kpi.definition.approved` → `kpi.definition_approved` naprawiona,
pełny katalog 12 zdarzeń KPI dopisany do `EVENT_TYPE_CONSUMER_GROUPS`
(decyzja #8 — luka dokumentacyjna, nie celowe pominięcie).
`getActiveVisibilityPolicy(client, {organizationId, domain})` w
`visibilityResolver.ts` (decyzja #11) — `null` gdy brak aktywnej polityki,
caller musi fail-closed.

**Package 2** — migracja `server/migrations/20260810_rvn_kpi_core.sql` (data
= jutro względem G1 z 0809, zgodnie z poleceniem; data systemowa sesji to
2026-08-09). Zweryfikowana na efemerycznym Postgresie 16 (Homebrew, ten sam
przepis co RN-G1 §11: `initdb --locale=C`, gniazdo w `/private/tmp`) —
**wszystkie sprawdzenia PASS**:
1. Aplikacja na pustej bazie — exit 0, 3 tabele (`rvn_kpi_definitions`,
   `rvn_kpi_definition_versions`, `rvn_kpi_measurements`).
2. Idempotencja — drugi run exit 0. **Złapany i naprawiony bug w locie**:
   `EXCLUDE USING gist` tworzy też indeks pod tą samą nazwą, więc re-run
   rzuca `duplicate_table` (42P07), NIE `duplicate_object` (42710) jak
   zwykły CHECK/FK — pierwszy przebieg idempotencji failował na tym (exit 3),
   DO-blok naprawiony na `EXCEPTION WHEN duplicate_object OR duplicate_table`,
   zweryfikowany ponownie na świeżej bazie.
3. Trigger `trg_rvn_kpi_definition_versions_protect_approved` blokuje
   `UPDATE formula_text` na zatwierdzonym wierszu (`ERRCODE 23001`), ale
   **pozwala** na `UPDATE effective_to` tego samego wiersza.
4. `EXCLUDE` odrzuca nakładające się okresy dwóch ZATWIERDZONYCH wersji tego
   samego `kpi_id` (`conflicting key value violates exclusion constraint`),
   ale **pozwala** na nakładający się `draft` i `rejected` wiersz o
   identycznym okresie i `kpi_id`.
5. Append-only REVOKE na `rvn_kpi_measurements` — INSERT jako owner OK;
   `UPDATE` jako dedykowana rola NIE-ownera (`rvn_kpi_nonowner`, tylko
   `GRANT SELECT, INSERT`) → `ERROR: permission denied for table
   rvn_kpi_measurements` (ta sama udokumentowana granica co
   `rvn_platform_events` — nie chroni przed połączeniem jako
   owner/superuser).

Sprzątanie: `pg_ctl -m fast stop` + `rm -rf` katalogu danych i gniazda —
zweryfikowane że `/private/tmp/cfy-rn-kpi-*` nie zostawiło artefaktów.
Weryfikacyjny skrypt SQL był jednorazowy (uruchomiony ręcznie przez `psql`
w tej sesji) — celowo NIE dodany do `scripts/` (podobnie jak RN-G1 §11 nie
zostawił trwałego pliku), wynik udokumentowany tutaj zamiast.

**Co pozostaje NIEZWERYFIKOWANE tym krokiem** (świadomie poza zakresem):
migracja na realistycznej kopii bazy demo/staging (1000+ istniejących
migracji) — testowano tylko pustą bazę, ten sam zakres co RN-G1 §11 punkt
(a); rollback/forward-repair rehearsal — nie testowany, brak jawnych plików
rollback.

## 16. KPI-E001/E002 — moja weryfikacja: 2 realne luki znalezione (2026-08-09)

Przeczytałem `targetGeometryEvaluator.ts` i `20260810_rvn_kpi_core.sql` w
całości. Jakość rekonstrukcji wysoka (boundary rule z decyzji #7 zastosowana
konsekwentnie, decyzje #9/#10/#12 wdrożone dosłownie, uczciwe komentarze
DEVIATION), ale porównanie z ORYGINALNYM `02_KPI_IMPLEMENTATION_PLAN.md`
(nie z niedostępnym draftem, tylko z pierwotnym źródłem prawdy) ujawnia dwie
realne luki funkcjonalne, których agent-rekonstruktor nie mógł znać (nie był
proszony o ponowne zweryfikowanie enumów wprost z planu domenowego):

1. **Brak geometrii `binary`** — `target_geometry` ma 5 wartości
   (`threshold_min/threshold_max/range/exact/custom`), plan §3.1 ma 6
   (`higher_better/lower_better/range/exact/binary/custom` — patrz ten
   ledger §3.2). `binary` to realny, mandatowy przypadek użycia (zero-event
   compliance: "zero wypadków", "certyfikat ważny", "raport złożony na
   czas") — nie kosmetyka.
2. **Brak stanu `pending_approval`** — `rvn_kpi_definitions.status` ma 4
   wartości (`draft/active/suspended/archived`), plan wymaga 5-stanowego
   `lifecycle_status` (`draft→pending_approval→active↔suspended→archived`,
   patrz ten ledger §3.2, "Wymiar 1"). Bez tego stanu nie da się odróżnić
   "KPI ma definicję czekającą na zatwierdzenie" od zwykłego draftu na
   poziomie roota.

Obie luki = odchylenie od PLANU ŹRÓDŁOWEGO, nie od mojej listy 12 decyzji
(które nie dotykały dosłownych list enumów). Zlecona poprawka: dodanie
`binary` do `target_geometry` + `evalBinary()` w evaluatorze (analogicznie
do `evalThresholdMin` — `actualValue === successValue → on_target, inaczej
critical`, zero strefy warning z definicji) oraz `pending_approval` do
`rvn_kpi_definitions.status` (migracja ALTER, nie nowy plik — ta sama
migracja jest jeszcze niewypchnięta poza tę gałąź).

## 17. KPI-E001/E002 — luki naprawione i zweryfikowane (2026-08-09)

Commit `b937a0e3d8`. **Zweryfikowane przeze mnie** (CHECK constraints w
migracji sprawdzone bezpośrednio): `status` ma teraz 5 wartości włącznie z
`pending_approval`, `target_geometry` ma 6 wartości włącznie z `binary`.
Nowa kolumna `binary_success_value NUMERIC CHECK IN (0,1)` — per-wersja, nie
globalna konwencja (bo polaryzacja sukcesu różni się per KPI: "zero
wypadków" sukces=0, "certyfikat ważny" sukces=1), chroniona przez trigger
`protect_approved` tak jak inne pola. `submitDefinition`/`rejectDefinitionVersion`
poprawnie przełączają `rvn_kpi_definitions.status` między `draft`↔
`pending_approval`, z guardem `WHERE status=...` żeby późniejsza poprawka
aktywnego KPI nie cofnęła go do pending_approval. tsc: 0 błędów. Testy:
69/69 (61 + 8 nowych binary cases). RealDB: zweryfikowane bezpośrednio że
oba nowe CHECK działają (poprawne wartości przechodzą, niepoprawne odrzucone)
i że trigger chroni nową kolumnę na zatwierdzonych wierszach.

**KPI-E001 (Central KPI Contract) i KPI-E002 (Measurement Truth) są teraz
zgodne z planem źródłowym w pełnym zakresie enumów.** To pierwszy kompletny,
zweryfikowany pionowy przyrost domenowy w programie Results Next — schema +
command layer + pure evaluator + testy, zbudowany na fundamencie RN-G1.
Pozostaje: warstwa API (`/api/vnext/results/kpi/*`), KPI-E003 (Deviation
Closed Loop), KPI-E004 (Scorecards), KPI-E005-E007, potem UI (RN-G2), Teresa
(RN-G3), i to samo dla ROI i OKR — a potem integracje krzyżowe i hardening.
Ogromny zakres wciąż przed nami, ale fundament (Platform + pierwszy pełny
segment jednej domeny) stoi i jest udowodniony.

## 18. KPI-E003 Deviation Closed Loop — design zamrożony (2026-08-09)

Draft agenta `a925f809507d44927` (bardzo dokładnie zweryfikowany w kodzie:
odkrył że outbox nie ma żadnego konsumenta, że `manager_user_id` nigdy nie
istniał na `rvn_kpi_definitions`, że plan ma wewnętrzną sprzeczność co do
"Planu" jako osobnego agregatu). 8 otwartych pytań rozstrzygniętych. **Pełna
treść (DDL+kod) tym razem wklejona bezpośrednio do**
`docs/product/results-vnext/KPI_E003_DESIGN.md` — nie tylko decyzje —
wnioskując z incydentu przy KPI-E001/E002 (§16), gdzie odesłanie do
"konwersacji" zamiast wklejenia pełnej treści zmusiło implementatora do
rekonstrukcji i wprowadziło 2 realne luki.

Kluczowe decyzje: case key = `(organization_id, kpi_id)`, jeden aktywny case
per KPI wymuszony partial unique index w bazie; "Plan" jako faza cyklu życia
case'a, nie osobny agregat; `openOrEscalateDeviationCase` w TEJ SAMEJ
transakcji co measurement insert (bo outbox nie ma dziś żadnego konsumenta —
"async" oznaczałoby w praktyce że case nigdy by się nie tworzył); nowa
platformowa tabela `rvn_platform_obligations` budowana TERAZ (nie jako osobny
pakiet) bo OKR/ROI będą potrzebować identycznego mechanizmu, a to dokładnie
zapobiega fragmentacji którą program ma naprawić. Implementacja czeka na
zakończenie równoległego pakietu API routes (ryzyko konfliktu plików —
`kpiMeasurementCommands.ts`/`atomicWrite.ts` są dotykane przez oba).

## 19. KPI-E001/E002 — warstwa API `/api/vnext/results/kpi/*` (2026-08-09)

_(Numer sekcji poprawiony po fakcie na 19 — równoległy pakiet KPI-E003
zajął numer 18 tym samym commitem, w którym ta sekcja wylądowała
niezamierzenie zbundlowana; treść bez zmian, tylko numeracja.)_

Commity `14c854457b` (routes + Gateway mount) i `e885086628` (testy).
Cienki router HTTP nad już gotowym command/repository layerem z §14-17 —
zero nowej logiki domenowej, tylko auth/param plumbing, walidacja Zod
(`server/src/validators/resultsVnextKpi.validators.ts`) i mapowanie
błędów na kody HTTP. Wzorzec referencyjny:
`server/src/routes/pmo/initiativeClosure.routes.ts` (inline handlery +
jeden `handle*Error` mapper + lokalny `requireAuth`, nie osobny
Controller — ta domena nie miała istniejącego kontrolera do rozszerzenia).

**15 endpointów zamontowanych** (`server/src/routes/resultsVnext/kpi.routes.ts`,
zamontowany w `Gateway.ts` pod `/api/vnext/results/kpi`): `POST /`,
`GET /`, `GET /:kpiId`, `PUT /:kpiId/draft`, `POST /:kpiId/submit`,
`POST /:kpiId/definition-versions/:versionId/{approve,reject}`,
`POST /:kpiId/{activate,suspend,archive}`, `POST /:kpiId/measurements`,
`GET /:kpiId/measurements`, `POST /:kpiId/measurements/:measurementId/
{corrections,verify,dispute}`. To PODZBIÓR planu §7.1/§7.2 — tylko
endpointy z realną implementacją command/repository dzisiaj; deviation
cases (§7.3) i scorecards (§7.4) nie mają jeszcze kodu domenowego, więc
nie są tu wpięte (przyszłe pakiety).

**Decyzje projektowe tej warstwy (nie były pinowane przez żaden istniejący
dokument, więc udokumentowane tutaj):**
1. `PUT .../draft` i `POST .../submit` przyjmują `kpiId` w URL (zgodnie z
   planem), ale komendy `editDraft`/`submitDefinition` operują na
   `definitionVersionId` — router rozwiązuje to przez `kpiRepository.getKpi`
   (odczyt visibility-scoped) i używa `kpi.currentDefinitionVersionId`.
2. `approve`/`reject` mają `versionId` wprost w URL, ale komenda nie
   sprawdza że wersja należy do `kpiId` z URL — router robi dodatkowy
   odczyt (`rvn_kpi_definition_versions` po `definition_version_id` +
   `organization_id`) i zwraca 404 przy niezgodności, zamiast pozwolić na
   mylącą "sukces" operację pod złym zagnieżdżonym URL-em.
3. **`performanceStatus` jest liczone SERWEROWO**, nie przyjmowane od
   klienta — `recordMeasurement`'s own doc comment mówi że komenda tego
   nie robi ("the caller ... can evaluate before calling"); router jest
   tym callerem: ładuje bounds z `rvn_kpi_definition_versions`, konwertuje
   przez (już eksportowane) `toKpiDefinitionVersion`, i woła
   `evaluatePerformanceStatus` (dotąd 100% martwy kod — pierwszy realny
   caller). To samo dla `correctMeasurement` (przeliczenie względem
   ORYGINALNEJ wersji definicji zmierzonej wartości). Bez tego klient
   mógłby sfałszować status wydajności KPI przez samo zgłoszenie.
4. **idempotencyKey**: brak jednego wzorca w repo (część endpointów
   header `X-Idempotency-Key`, część pole `idempotencyKey` w body —
   zgrepowane `initiativeClosure.routes.ts`/`InitiativeController.ts`:
   pole w body jest częstsze). Przyjęto: opcjonalne pole `idempotencyKey`
   w body; jeśli brak, generowane server-side (`crypto.randomUUID()`) —
   `platform/atomicWrite.ts` wymaga go zawsze (unique index), więc
   generacja server-side jest bezpiecznym domyślnym zachowaniem.
5. **Błędy → HTTP**: `SelfApprovalDeniedError`→403,
   `AtomicWriteConflictError`(STALE_VERSION)→409,
   `AtomicWriteAggregateNotFoundError`/`KpiMeasurementNotFoundError`→404,
   `KpiNoActiveVisibilityPolicyError`→409 (org bez aktywnej polityki —
   precondition failure, nie 400/404), `KpiDefinitionValidationError`→409
   (dowolna nieprawidłowa tranzycja stanu — patrz DEVIATION niżej),
   nieznany błąd→500 zalogowany, bez stack trace w response.

**DEVIATION od briefu zadania**: brief nazwał klasę błędu
`DefinitionVersionNotSubmittedError` dla przypadku "wersja nie była
zgłoszona". Taka klasa NIE ISTNIEJE nigdzie w repo (zgrepowane przed
napisaniem kodu) — realny błąd dla KAŻDEJ nieprawidłowej tranzycji stanu
(submit nie-draftu, approve/reject nie-submitted, activate bez approved
version) to pojedyncza klasa `KpiDefinitionValidationError`
(`kpiDefinitionCommands.ts`), rozróżniana przez `.code`
(`NOT_A_DRAFT`/`NOT_SUBMITTED`/`INVALID_KPI_STATUS_TRANSITION`/
`NO_APPROVED_VERSION`). Zmapowana na 409, tak jak brief sugerował jako
alternatywę.

**Testy**: `server/src/routes/resultsVnext/__tests__/kpi.routes.test.ts` —
16 testów kontraktowych HTTP (supertest + Express, wzorzec
`workbook-commands.routes.test.ts`: middleware auth/rbac/demo/rate-limit
zastąpione przejściami, warstwa SERWISU mockowana, nie cała baza —
command/repository layer ma już własną ewidencję na realnym Postgresie
z §15/§17 i pokrycie jednostkowe w `tests/resultsVnext/kpi/`). Klasy
błędów w mockach są PRAWDZIWE (`importOriginal` + nadpisanie tylko
funkcji), więc `instanceof` w `handleKpiRouteError` jest testowane na
faktycznych prototypach. Pokrywa: create→get roundtrip, self-approval
denial 403, STALE_VERSION 409, aggregate-not-found 404, invalid-transition
409, measurement record→list roundtrip z serwerowym przeliczeniem
`performanceStatus`, 404 przy niezgodności kpiId/measurementId na
correct/verify/dispute, walidacja Zod 400. **tsc: 0 błędów** (`server/`,
`--max-old-space-size=8192`). **Testy: 16/16 nowych, 85/85 łącznie z
istniejącym `tests/resultsVnext/kpi/` (69) — bez regresji.**

**Poza zakresem tego pakietu** (świadomie): endpointy `GET .../history`,
`GET .../contexts`, `GET /portfolio/summary`, `GET /my-kpis`,
`GET /attention` z planu §7.2 — `kpiRepository.ts` nie ma dla nich
implementacji (tylko `listKpis`/`getKpi`/`listMeasurements` istnieją);
całe §7.3 (Deviation) i §7.4 (Scorecards) — brak command/repository layera
w tym repo. Weryfikacja na realnej bazie efemerycznej (przepis §11) NIE
była tu potrzebna — ten pakiet nie dodał żadnego nowego SQL/DDL, tylko
HTTP nad już zweryfikowanym layerem z §15/§17.

## 20. KPI-E003 Deviation Closed Loop — schema + command layer + testy (2026-08-09)

Implementacja pełnego zakresu `docs/product/results-vnext/KPI_E003_DESIGN.md`
§A/§B/§C (design zamrożony w §18) — trzy osobne, ograniczone commity.

**Pakiet 1 — migracje** (`server/migrations/20260811_rvn_kpi_deviation_loop.sql`,
`server/migrations/20260811_rvn_platform_obligations.sql`). Zweryfikowane na
efemerycznym Postgresie 16 (ten sam przepis co §11/§15: `initdb --locale=C`,
gniazdo w `/private/tmp`) NA WIERZCHU pełnego łańcucha tej gałęzi
(`20260809_rvn_platform_*.sql` + `20260810_rvn_kpi_core.sql`): apply na pustej
bazie exit 0, drugi run (idempotencja) exit 0, partial unique index
`ux_rvn_kpi_deviation_cases_one_active_per_kpi` blokuje drugi aktywny case
dla tego samego `kpi_id` (`23505`) i pozwala po zamknięciu pierwszego —
zweryfikowane wprost SQL-em (INSERT/UPDATE/INSERT). **Realny bug złapany
przy weryfikacji**: `rvn_kpi_definitions.response_policy_id` był `TEXT` w
`20260810_rvn_kpi_core.sql`, a nowy FK-cel `rvn_kpi_response_policies
.response_policy_id` to `UUID` — `ALTER TABLE ... ADD CONSTRAINT` padał na
"incompatible types". Naprawione konwersją kolumny (`ALTER COLUMN ...
TYPE UUID USING ...::uuid`) w NOWEJ migracji zamiast edycji już wylądowanej
`20260810` (nie ma jeszcze produkcyjnych danych w tej kolumnie, konwersja
bezpieczna) — pełny opis w komentarzu `DEVIATION FROM DESIGN` w pliku.

**Pakiet 2 — command layer**: `kpiDeviationTypes.ts` (Row/DTO wzorem
`kpiTypes.ts`), `kpiDeviationCommands.ts` (pełna maszyna stanów:
`openOrEscalateDeviationCase`, `closeDeviationCase` dosłownie z §B,
`acknowledgeDeviationCase`/`submitRootCause`/`submitPlan`/`approvePlan`
(maker-checker)/`recordRecoveryObservation`/`submitEffectivenessVerification`
(auto-return `executing` przy `ineffective`)/`escalate`+`deescalateDeviationCase`
(overlay)/`reopenDeviationCase` (nowy wiersz)), `kpiCorrectiveActionCommands.ts`
(`addCorrectiveAction`, `updateCorrectiveAction` z auto-tranzycją
`approved→executing` na PIERWSZEJ akcji `active`, decyzja #8),
`kpiDeviationRepository.ts` (odczyty wyłącznie przez
`buildVisibilityScopedCte`/`wrapWithVisibilityScope`, JOIN po `kpi_id` —
case/action/verification nie mają własnego wiersza w
`rvn_platform_resource_visibility`, dziedziczą widoczność po KPI, ten sam
wzorzec co `kpiRepository.listMeasurements`), `platform/obligations.ts`
(`createObligation`/`completeObligation`/`attachSourceEventId`, wzorzec
dwustopniowy z §C). Wpięcie w `kpiMeasurementCommands.ts`:
`recordMeasurement`/`correctMeasurement` wołają `openOrEscalateDeviationCase`
na TYM SAMYM pinned clencie, wewnątrz `applyMutation` (decyzja #3) —
`verifyMeasurement`/`disputeMeasurement` NIE (nie zmieniają
`performance_status`). `atomicWrite.ts`: 13 typów zdarzeń deviation w
`EVENT_TYPE_CONSUMER_GROUPS` (9 nazwanych wprost w brifie zadania + 4 dla
pozostałych komend, ten sam powód co luka z §16 — brak wpisu ≠ celowe
pominięcie); `resolveConsumerGroups`/`EVENT_INSERT_SQL` wyeksportowane, żeby
ręczne insercje zdarzeń w `openOrEscalateDeviationCase` (nie może zagnieździć
drugiego `executeAtomicCreate` wewnątrz cudzego `applyMutation`) używały
DOKŁADNIE tego samego mechanizmu fan-out do outboxa co reszta domeny.

**Pakiet 3 — testy**. Jednostkowe (`tests/resultsVnext/kpi/`, wzorzec
`fakeClient` z `approveDefinitionVersion.test.ts`): `approvePlan.test.ts`
(self-approval denial na `plan_submitted_by` I `created_by`,
STALE_VERSION), `deviationStateMachine.test.ts` (twarda maszyna stanów —
`acknowledgeDeviationCase`/`submitPlan` (zły status + zero akcji
korygujących)/`recordRecoveryObservation` odrzucają PRZED jakimkolwiek
zapisem; `closeDeviationCase` odrzuca bez zaakceptowanej
EffectivenessVerification — brak wiersza i wynik `ineffective`).
Integracyjne na realnym Postgresie 16 (`deviationCaseIdempotency.realdb.test.ts`,
efemeryczna baza tym samym przepisem): sekwencyjnie — measurement `warning`
otwiera dokładnie jeden case, kolejny `critical` eskaluje severity NA TYM
SAMYM case (nie drugi), dwa osobne zdarzenia `kpi.deviation_opened`/
`.escalated`, dokładnie jedno zobowiązanie MyWork (§C); równolegle —
`Promise.all` dwóch `recordMeasurement` na tym samym KPI (różne okresy) bez
rzutu wyjątku, dokładnie jeden case na końcu.

**Realny bug współbieżności znaleziony i naprawiony przy weryfikacji**:
dosłowny kod z §B (`openOrEscalateDeviationCase`) łapie `23505` na
przegranym INSERT i OD RAZU odpytuje ponownie na tym samym połączeniu —
ale Postgres po błędzie ABORTUJE CAŁĄ transakcję, więc ten drugi SELECT
sam pada z `25P02 current transaction is aborted`, nieobsłużonym przez
`catch (23505)`, więc przegrywający rzuca wyjątek zamiast łagodnie zwrócić
case zwycięzcy. **Zweryfikowane ręcznie dwiema surowymi sesjami `psql`**
(fifo + `BEGIN`/`INSERT`/`sleep`/`COMMIT` na przemian) PRZED i PO naprawie —
bez `SAVEPOINT` retry-SELECT faktycznie pada na `25P02`, z `SAVEPOINT` +
`ROLLBACK TO SAVEPOINT` przed retry działa. Naprawione owinięciem
kandydackiego INSERT-u w `SAVEPOINT` (pełny opis w komentarzu `DEVIATION
FROM DESIGN` w `kpiDeviationCommands.ts`) — dodatkowo w teście integracyjnym
osobny, DETERMINISTYCZNY dowód (dwa niezależne `pg.Client`, ręcznie
wymuszone zablokowanie INSERT-u na niezatwierdzonym wierszu drugiej
transakcji) zamiast polegać wyłącznie na przypadkowym trafieniu wyścigu
przez `Promise.all` (które w tym środowisku — lokalny Postgres na loopback,
zapytania sub-milisekundowe — w praktyce prawie zawsze kończy się zanim
druga transakcja w ogóle zdąży odpytać, więc SAM `Promise.all` NIE jest
niezawodnym dowodem tej konkretnej kolizji, tylko deterministyczny test
dwóch ręcznie sterowanych połączeń jest).

**Wynik**: `tsc --noEmit` w `server/` — 0 błędów. Pełny zestaw
`tests/resultsVnext/kpi server/src/routes/resultsVnext` na tej samej
efemerycznej bazie — **100/100 zielono** (85 istniejących + 15 nowych: 4 +
8 + 3), bez regresji. Nowe pliki w `tests/` dodane przez `git add -f`
(konwencja repo). Efemeryczna baza posprzątana (`pg_ctl -m fast stop` +
`rm -rf` katalogu danych/gniazda), zero trwałych artefaktów.

**Poza zakresem tego pakietu** (świadomie, zgodnie z briefem): warstwa API
`/api/vnext/results/kpi/deviation-cases/*` — osobny, kolejny pakiet.
`policy_version_id` na obligation zostaje `null` (§C nie definiuje źródła
tej wartości dla `explain_warning_critical_deviation` — udokumentowane w
`platform/obligations.ts`). Wpięcie `rvn_platform_obligations` w realny UI
MyWork (Home/Inbox/Calendar) — jawnie poza zakresem per §C samego projektu.

## 21. KPI-E003 Deviation Closed Loop — warstwa API `/deviation-cases/*` (2026-08-09)

Implementacja routera HTTP nad command/repository layer z §20 (design:
`KPI_E003_DESIGN.md` §B, decyzja #2 — "plan" to faza case'a, żaden osobny
`:planId`). Nowy plik `server/src/routes/resultsVnext/kpiDeviation.routes.ts`
(13 endpointów: list/get, acknowledge, PUT root-cause, POST/PATCH
corrective-actions, plan/submit, plan/approve, recovery-observation,
effectiveness-verifications, close, escalate/deescalate, reopen) — 1:1 wzorzec
stylu `kpi.routes.ts` (inline handlery + wspólny `handle*Error` + lokalny
`requireAuth`), nowy `server/src/validators/resultsVnextKpiDeviation.validators.ts`
(Zod, jeden schemat na endpoint, enumy re-eksportowane z `kpiDeviationTypes.ts`).

**Realny bug routingu złapany PRZED wdrożeniem, nie na demo**: montowanie
nowego routera na tym samym prefiksie co `kpi.routes.ts`
(`/api/vnext/results/kpi`) zderza się z jego `GET /:kpiId` — dla
`GET .../kpi/deviation-cases` Express trafiłby najpierw w `kpi.routes.ts`
(ten sam prefiks, zarejestrowany pierwszy), `kpiId="deviation-cases"` nie
przechodzi `KpiIdParamsSchema` (UUID) i `validateParams` odpowiada 400
bezpośrednio (nie wywołuje `next()`) — nowy router nigdy by nie dostał
żądania. Naprawione montowaniem na WĘŻSZYM prefiksie
`/api/vnext/results/kpi/deviation-cases` i rejestracją w `Gateway.ts`
PRZED mountem `/api/vnext/results/kpi` (Express dopasowuje middleware
w kolejności rejestracji, nie po specyficzności prefiksu) — pełny opis w
nagłówku `kpiDeviation.routes.ts` ("MOUNT-ORDER NOTE") i komentarzu przy
obu mountach w `Gateway.ts`. Zweryfikowane wprost testem (`GET
/deviation-cases` idzie do właściwego routera, `listDeviationCases`
wywołane, `getKpi` z `kpi.routes.ts` NIE wywołane).

**DEVIATION FROM TASK BRIEF**: brief zlecający ten plik nazwał błąd
self-approval `SelfApprovalDeniedError` (wzorem importu tej klasy z
`kpiDefinitionCommands.ts` w `kpi.routes.ts`). Ta domena ma WŁASNĄ,
osobną klasę — `DeviationSelfApprovalDeniedError` z `kpiDeviationCommands.ts`
(ten plik, we własnym komentarzu: "this module's own class since the two
domains have separate aggregates") — zmapowana na 403 dokładnie tak jak
brief chciał dla "SelfApprovalDeniedError", tylko pod prawdziwą nazwą.

**Testy**: `kpiDeviation.routes.test.ts` (supertest, wzorem
`kpi.routes.test.ts` — command/repository layer mockowany, klasy błędów
prawdziwe przez `importOriginal`), 21 przypadków: record-measurement (przez
prawdziwy `kpi.routes.ts`, zamontowany w tym samym teście w kolejności
Gateway.ts) → get roundtrip; list z filtrami; pełna ścieżka acknowledge →
root-cause → corrective-action → plan submit/approve; cross-check
action/case w PATCH (404 gdy action należy do innego case); recovery-
observation + effectiveness-verification (201, zwraca `case`+`verification`);
close bez zweryfikowanej skuteczności → 409 `EFFECTIVENESS_NOT_VERIFIED`;
self-approval denial na approve planu → 403 `SELF_APPROVAL_DENIED`;
STALE_VERSION 409 / aggregate-not-found 404; escalate/deescalate/reopen
(reopen jako `executeAtomicCreate` — brak `expectedVersion` w body); kilka
Zod 400. Zero mocków bazy dla samej logiki stanu — ta już ma dowód na
realnym Postgresie w §20.

**Wynik**: `tsc --noEmit` w `server/` — 0 błędów. Pełny zestaw `tests/resultsVnext/kpi
server/src/routes/resultsVnext` uruchomiony DWA razy: (a) bez bazy (realdb
plik z §20 poprawnie pomija się/raportuje błąd konfiguracji — patrz jego
własna SKIP POLICY) i (b) na świeżo postawionym efemerycznym Postgresie 16
(pełny łańcuch migracji `20260809_rvn_platform_*` + `20260810_rvn_kpi_core` +
`20260811_rvn_kpi_deviation_loop` + `20260811_rvn_platform_obligations`,
rola+baza `iris`/`iris_test`, `LC_ALL=C`, TCP na osobnym porcie zamiast
domyślnego 5432 — na tej maszynie 5432 to już inny, lokalny serwer deweloperski
bez roli `iris`) — **121/121 zielono** (100 istniejących + 21 nowych), zero
regresji. Efemeryczna baza posprzątana (`pg_ctl -m fast stop` + `rm -rf`
katalogu danych/gniazda), zero trwałych artefaktów.

**Poza zakresem tego pakietu** (świadomie, zgodnie z briefem): `GET
.../corrective-actions` i `GET .../effectiveness-verifications` jako osobne
listy — `kpiDeviationRepository.ts` już eksportuje `listCorrectiveActions`/
`listEffectivenessVerifications`, ale żaden z nich nie jest na liście
endpointów z briefu ani w tabeli plików `KPI_E003_DESIGN.md` §D; zostawione
na przyszły pakiet razem z resztą jawnie odłożonych elementów §D (wpięcie
MyWork UI, CRUD na response-policy).

## 22. KPI-E004 Scorecards — design zamrożony (2026-08-09)

Dwie NIEZALEŻNE rekonstrukcje tego samego briefu (agent `a919e772f8a34efad`
zwrócił obciętą odpowiedź — tylko końcówka dotarła; agent `a4f07bd2c39d8702e`
odtworzył brakujące sekcje A/B/C.1/C.2 od zera). Musiałem je pogodzić, nie
tylko skleić — **znalazłem realną rozbieżność bezpieczeństwa między nimi**:
druga rekonstrukcja materializuje `publishReviewSnapshot` filtrując po
widoczności PUBLIKUJĄCEGO (dobra decyzja), ale odczyt (`getPublishedSnapshot`)
zwracał cały zamrożony payload BEZ ponownego filtrowania dla czytelnika —
dokładnie P0 ryzyko z planu ("Restricted KPI leaks in Scorecard totals").
Rozstrzygnięcie: **dwuwarstwowa obrona** — filtr przy publikacji (widoczność
publikującego) ORAZ filtr przy KAŻDYM odczycie opublikowanego snapshotu
(ponowne przeliczenie widocznych `kpi_id` dla żądającego czytelnika,
przycięcie `items`+przeliczenie `statusCounts` w odpowiedzi, BEZ modyfikacji
zapisanego wiersza/`content_hash` — integralność archiwum zachowana, redakcja
dzieje się tylko przy serwowaniu). To jest jedyny sposób żeby AC #4 (non-leak)
było prawdziwe dla opublikowanych snapshotów, nie tylko dla żywego widoku.

Pełny, spójny, samowystarczalny projekt (schema+command+repository+7-sekcyjne
mapowanie Scorecard Tool) w `docs/product/results-vnext/KPI_E004_DESIGN.md`.
Prerequisite: `RVN_RESOURCE_TYPES`/`CanonicalObjectTypeValues` nie mają
jeszcze `'kpi_scorecard'` — pierwszy krok implementacji.

## 23. KPI-E004 Scorecards — schema + command layer + repository + testy (2026-08-09)

Zaimplementowano `KPI_E004_DESIGN.md` w 5 osobnych commitach (Package 0-4),
każdy zweryfikowany osobno zanim przeszedł do następnego:

- **Package 0** — prerequisite: `'kpi_scorecard'` dopisane na końcu
  `RVN_RESOURCE_TYPES` (`platform/resourceTypes.ts`) i
  `CanonicalObjectTypeValues` (`myWorkRoofPackage.ts`), bez reorderu.
- **Package 1** — `server/migrations/20260812_rvn_kpi_scorecards.sql`, DDL
  §A skopiowane dosłownie. Zweryfikowane na efemerycznym Postgresie 16
  (Homebrew `postgresql@16`, `initdb --locale=C`, gniazdo w
  `/private/tmp`) na TOP łańcucha `20260809_rvn_platform_*` →
  `20260810_rvn_kpi_core` → `20260811_rvn_kpi_deviation_loop` →
  `20260811_rvn_platform_obligations`: świeża baza (exit 0), drugi przebieg
  idempotentny (same `NOTICE: already exists, skipping`),
  `trg_rvn_kpi_scorecard_snapshots_protect_published` realnie blokuje
  mutację `snapshot_payload` na opublikowanym wierszu (błąd 23001) ale
  przepuszcza `status→superseded`, `ux_rvn_kpi_scorecard_snapshots_one_published`
  realnie blokuje drugi jednocześnie opublikowany snapshot dla tego samego
  `scorecard_id` (23505 na oczekiwanym unique index, nie na czymś innym).
- **Package 2** — `kpiScorecardTypes.ts` (Row/DTO, konwencja
  `kpiDeviationTypes.ts`) + `kpiScorecardCommands.ts`:
  `createScorecard`/`addScorecardItem`/`removeScorecardItem`/
  `reorderScorecardItems`/`activateScorecard`/`suspendScorecard`/
  `archiveScorecard`/`createReviewSnapshot` wg decyzji #8 (wzorem
  `createKpiDraft`/`runKpiLifecycleTransition`/`addCorrectiveAction`),
  `publishReviewSnapshot` §B dosłownie **z dopisanym filtrem decyzji #6a**
  (projekt jawnie ostrzegał że przykładowy SQL w §B kroku 1 nie miał go
  jeszcze zaaplikowanego — dopisany przez `wrapWithVisibilityScope({userId:
  publishedBy, resourceType:'kpi'})` spleciony w zapytanie materializujące
  itemy, zamiast reimplementować gałęzie widoczności osobno).
  `atomicWrite.ts`: `EVENT_TYPE_CONSUMER_GROUPS` — 3 nazwane w projekcie
  (`scorecard.created`/`membership_changed`/`review_published`) + 4
  dopisane dla kompletności katalogu (`activated`/`suspended`/`archived`/
  `review_created`), ten sam wzorzec "documentation gap" co reszta pliku.
- **Package 3** — `kpiScorecardRepository.ts` §C: `listScorecards`,
  `listScorecardItems`, `getScorecardStatusDistribution`,
  `getPublishedSnapshot` (**decyzja #6b dosłownie** — ponowne rozwiązanie
  widocznych `kpi_id` dla ŻĄDAJĄCEGO czytelnika, przycięcie
  `snapshot_payload.items`, przeliczenie `statusCounts` w ODPOWIEDZI, bez
  dotykania zapisanego wiersza/`content_hash`), `listReviewSnapshots`.
- **Package 4** — testy. Unit (`scorecardCommands.test.ts`, mockowany
  `PoolClient`): CAS/STALE_VERSION, `NOT_A_DRAFT`, `SCORECARD_MISMATCH`,
  happy path, + asercja strukturalna że `addScorecardItem`/
  `removeScorecardItem`/`reorderScorecardItems` NIGDY nie emitują zapisu do
  `rvn_kpi_definitions`/`rvn_kpi_definition_versions`/`rvn_kpi_measurements`
  (przechwycone i przeskanowane KAŻDE zapytanie SQL wykonane w trakcie
  komendy). RealDB (`scorecardPublishNonLeak.realdb.test.ts`, opt-in przez
  `DATABASE_URL`/`DB_HOST`, ten sam skip policy co
  `deviationCaseIdempotency.realdb.test.ts`): (a) atomiczność
  publish-supersede pod realną współbieżnością (dwa `publishReviewSnapshot`
  na różnych draftach tego samego scorecardu jednocześnie — nigdy oba
  `published`, gwarantuje to `ux_rvn_kpi_scorecard_snapshots_one_published`,
  nie logika aplikacji), (b) **KRYTYCZNY test non-leak dwuwarstwowy** —
  użytkownik A (widzi ograniczony KPI jako jego właściciel, `PRIVATE`)
  publikuje snapshot z 3 KPI; użytkownik B (nie widzi tego KPI) woła
  `getPublishedSnapshot` i dostaje dokładnie 2 itemy + przeliczone
  `statusCounts`, NIGDY 3; `content_hash` zapisanego wiersza zweryfikowany
  PRZED i PO obu odczytach `getPublishedSnapshot` — nadal odpowiada pełnym
  3 itemom (integralność archiwum nietknięta, redakcja dzieje się tylko w
  odpowiedzi serwowanej niedouprawnionemu czytelnikowi).

**Realny bug znaleziony i naprawiony przez test na żywym Postgresie** (nie
złapany przez `tsc` ani testy jednostkowe z mockiem): `rvn_platform_resource_
visibility.resource_id` jest `TEXT`, a `kpi_id`/`scorecard_id` są `UUID` —
każdy `JOIN rvn_visible_resources vr ON vr.resource_id = <kolumna uuid>` w
`kpiScorecardCommands.ts`/`kpiScorecardRepository.ts` padał błędem Postgres
42883 (`operator does not exist: text = uuid`) dopóki nie dopisano `::text`
po stronie UUID (6 miejsc w obu plikach). Ten sam wzorzec złączenia istnieje
też w `kpiDeviationRepository.ts` (KPI-E003) — nigdy nie zweryfikowany na
realnej bazie (`deviationCaseIdempotency.realdb.test.ts` nie woła repozytorium,
tylko warstwę komend), więc może nosić tę samą, jeszcze nieodkrytą usterkę —
poza zakresem tego pakietu, warte osobnego zgłoszenia.

**Wynik końcowy**: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`
w `server/` — 0 błędów. `npx vitest run tests/resultsVnext/kpi/` (7 plików,
94 testy) — wszystkie PASS na tym samym efemerycznym Postgresie 16 użytym do
weryfikacji schematu. Szerszy zestaw nazwany „kpi” (`tests/integration/*kpi*`,
`tests/unit/**/kpi*`) — 17 plików PASS / 3 skip (opt-in przez inne zmienne
env, np. `RES10_PG_URL`/`RES11_PG_URL` — nieustawione w tym przebiegu, zero
regresji), 196 testów PASS / 18 skip na 214 — zero regresji względem stanu
przed tym pakietem (10 nowych testów, wszystkie PASS, reszta niezmieniona).
Nie zbudowano: warstwa HTTP `/api/vnext/results/kpi/scorecards/*` (jawnie
poza zakresem tego pakietu per `KPI_E004_DESIGN.md` — następny, osobny pakiet).

## 24. KOREKTA §19/§21 — ten sam TEXT/UUID join bug (§23) NAPRAWIONY w
`kpiRepository.ts`/`kpiDeviationRepository.ts`; luka testowa POTWIERDZONA
(2026-08-09)

§23 przewidziało wprost ("warte osobnego zgłoszenia") że ten sam wzorzec
złączenia mógł nosić identyczną usterkę w `kpiDeviationRepository.ts`. To
się potwierdziło — i dotyczyło też `kpiRepository.ts` (KPI-E001/E002), co
§23 nie wymieniło. Ten wpis to KOREKTA, nie tylko dopisek: §19 i §21 podały
liczby testów ("16/16", "121/121 zielono ... zero regresji") jako dowód że
warstwa API `/api/vnext/results/kpi/*` i `/deviation-cases/*` działa —
liczby były PRAWDZIWE dla uruchomionych testów, ale te testy NIGDY nie
wykonały złączenia, które właśnie tu naprawiono. Zgodnie ze złotą regułą
repo ("testy przeszły" ≠ "działa") to trzeba nazwać wprost, nie
zminimalizować.

**Naprawa (7 miejsc, ten sam wzorzec `::text` co `kpiScorecardRepository.ts`
z §23)**:
- `kpiRepository.ts` — `vr.resource_id = kd.kpi_id` → `= kd.kpi_id::text`
  (linie ~114 `listKpis`, ~144 `getKpi`) i `vr.resource_id = m.kpi_id` →
  `= m.kpi_id::text` (~229 `listMeasurements`).
- `kpiDeviationRepository.ts` — `vr.resource_id = dc.kpi_id` →
  `= dc.kpi_id::text` w CZTERECH miejscach: `getDeviationCase` (~87),
  `listDeviationCases` (~147), `listCorrectiveActions` (~198),
  `listEffectivenessVerifications` (~236).
Pełny przegląd obu plików (nie tylko wskazane linie) — brak innych
porównań kolumny TEXT z platformy (`rvn_platform_resource_visibility`/
`rvn_platform_resource_acl`) z kolumną UUID bez castu; wszystkie pozostałe
złączenia w tych plikach są UUID-do-UUID (np. `dc.case_id = ca.deviation_
case_id`) i nie potrzebują castu.

**Ustalenie z dochodzenia "dlaczego testy tego nie złapały" (fakty, nie
domysł)**: `kpi.routes.test.ts` i `kpiDeviation.routes.test.ts` mockują
CAŁY moduł repozytorium na poziomie `vi.mock('.../kpiRepository.js', ...)`
/ `vi.mock('.../kpiDeviationRepository.js', ...)` — `getKpi`/`listKpis`/
`listMeasurements`/`getDeviationCase`/`listDeviationCases` są zastąpione
`vi.fn()`. Zweryfikowane wprost: żaden inny plik w repo (poza samymi
plikami routes i ich testami) nie importuje `kpiRepository.ts` ani
`kpiDeviationRepository.ts` (`grep -rln "kpi/kpiRepository\|kpi/
kpiDeviationRepository" tests/ server/src/` — zero trafień poza tymi
czterema plikami). §21's "121/121 zielono" NA REALNYM POSTGRESIE (pełny
łańcuch migracji, prawdziwa rola/baza) było prawdziwe — Postgres BYŁ
użyty przez inne testy w tym samym przebiegu (np.
`deviationCaseIdempotency.realdb.test.ts`, przez command layer) — ale
`kpiDeviation.routes.test.ts`'s GET-owe scenariusze nigdy nie wywołały
`listDeviationCases`/`getDeviationCase` NA TYM Postgresie, bo funkcje były
podmienione na mocki przed importem routera. To nie jest niejednoznaczne:
zerowe pokrycie tego joina przez którykolwiek istniejący test jest
potwierdzone przez brak importu, nie przez domysł.

**Weryfikacja na realnym Postgresie 16** (ten sam przepis co §11/§15/§23:
`initdb --locale=C`, `LC_ALL=C`, TCP na `127.0.0.1:28461` — gniazdo Unix w
`/private/tmp` też działa, TCP wybrany bo `databaseTargetResolver.ts`
wymaga poprawnego `new URL(...).hostname`, którego pusty host przy
`?host=/socket/path` nie daje). Migracje `20260809_rvn_platform_*` (4) +
`20260810_rvn_kpi_core` + `20260811_rvn_kpi_deviation_loop` +
`20260811_rvn_platform_obligations` + `20260812_rvn_kpi_scorecards` — exit
0.
- **PRZED naprawą** (kod z §19/§21 przywrócony przez `git stash`):
  `npx vitest run tests/resultsVnext/kpi server/src/routes/resultsVnext` →
  **131/133 PASS, 2 FAIL** — oba faile to NOWY test poniżej, z realnym
  błędem Postgres `42883: operator does not exist: text = uuid` rzuconym
  wprost z `listKpis`/`listDeviationCases`. WSZYSTKIE 131 innych testów
  (w tym `kpi.routes.test.ts`/`kpiDeviation.routes.test.ts` w całości)
  przeszły — dowód namacalny, nie tylko wywnioskowany, że istniejący
  zestaw był ślepy na ten bug.
- **PO naprawie** (`git stash pop`): **133/133 PASS**, zero regresji.
  `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` w `server/` —
  0 błędów.

**Nowy test**: `tests/resultsVnext/kpi/kpiVisibilityJoinRegression.realdb
.test.ts` (realDB, ten sam skip-policy co `deviationCaseIdempotency
.realdb.test.ts`/`scorecardPublishNonLeak.realdb.test.ts` — cichy no-op
bez skonfigurowanej bazy, rzuca jeśli baza skonfigurowana ale
nieosiągalna). Dwa scenariusze, oba tworzą PRIVATE KPI (właściciel
USER_A) i wołają repozytorium jako USER_A (właściciel) i USER_B (obcy, bez
RBAC override) — zmuszając join do realnego wykonania z realnymi
wierszami `rvn_platform_resource_visibility`, nie mockiem:
1. `listKpis`/`getKpi` — USER_A widzi KPI (na liście i przez get), USER_B
   nie (brak na liście, `getKpi` zwraca `null`).
2. `listDeviationCases`/`getDeviationCase` — case na tym samym PRIVATE KPI
   dziedziczy widoczność przez `kpi_id`; USER_A widzi, USER_B nie.
Sprzątanie po sobie w `afterAll` (DELETE po `organization_id`), zero
trwałych artefaktów w bazie efemerycznej ani w `/private/tmp`.

**Poza zakresem tego wpisu**: `listCorrectiveActions`/
`listEffectivenessVerifications` (KPI-E003) i `getPublishedSnapshot`/
`listScorecardItems`/itd. (KPI-E004, już naprawione w §23) mają teraz
poprawny `::text` cast (zweryfikowane grepem — pełny przegląd obu plików
w tym pakiecie), ale nie mają własnego dedykowanego realDB testu na
widoczność poza tym co już istnieje w §23's
`scorecardPublishNonLeak.realdb.test.ts` — jeśli regresja wróci w tych
konkretnych funkcjach, złapie ją najpierw 42883 na produkcji/demo, nie
test.

## 26. KPI-E005 Perspectives & Links — design zamrożony (2026-08-09)

Draft agenta `a8d29666f58d13304` — jednoczęściowa, kompletna odpowiedź (lekcja
z §16/§22 o ucinanych odpowiedziach zastosowana skutecznie). 5 decyzji
podjętych, w tym: T3 non-leak wygrywa z kompletnością metryki "missing
ownership" (świadome, udokumentowane ograniczenie, nie bug); 3 nowe verby
uprawnień dla InitiativeKPIImpact zatwierdzone przeze mnie jako Integration
Ownera (dodatkowa governance dla funkcji już przewidzianej w oryginalnym
YAML planu, nie konkurencyjny model — nie wymaga eskalacji Founder-level);
`measurement_frequency_days` jako addytywna kolumna na już wysłanej,
zatwierdzonej tabeli — ratyfikowane jako standardowy wzorzec na przyszłość
(ROI/OKR będą tego potrzebować analogicznie).

Pełny, samowystarczalny projekt w `docs/product/results-vnext/KPI_E005_DESIGN.md`.
`getManagementChain()` faktycznie nie istnieje (potwierdzone w kodzie) —
projekt dopisuje jedną cienką funkcję odczytu do już istniejącego
`managementChainMaintenance.ts`, nie buduje nowego serwisu. **Wymóg wynikający
z §24**: każda nowa funkcja repository w tym pakiecie musi mieć bezpośredni
test na realnym Postgresie, nie tylko zmockowaną trasę.

## 25. KPI-E004 Scorecards — warstwa API `/scorecards/*` (2026-08-09)

Zaimplementowano `server/src/routes/resultsVnext/kpiScorecard.routes.ts` —
ostatni brakujący pakiet z `KPI_E004_DESIGN.md` §D ("Not in this package:
... HTTP layer, next package"). Ten sam wzorzec stylu co `kpi.routes.ts`/
`kpiDeviation.routes.ts` (inline handlery + wspólny `handle*Error` mapper +
lokalny `requireAuth`, bez osobnej klasy Controller).

**Endpointy** (wszystkie zamontowane pod `/api/vnext/results/kpi/scorecards`):
`POST /` (createScorecard) · `GET /` (listScorecards) · `GET /:scorecardId`
(getScorecard) · `GET /:scorecardId/items` (listScorecardItems) ·
`POST /:scorecardId/items` (addScorecardItem) ·
`DELETE /:scorecardId/items/:itemId` (removeScorecardItem) ·
`PATCH /:scorecardId/items/reorder` (reorderScorecardItems, decyzja #4: zmiana
`role` wtopiona tu, bez osobnego endpointu) · `GET /:scorecardId/status`
(getScorecardStatusDistribution) · `POST /:scorecardId/activate|suspend|archive`
· `POST /:scorecardId/review-snapshots` (createReviewSnapshot) ·
`GET /:scorecardId/review-snapshots` (listReviewSnapshots) ·
`GET /:scorecardId/review-snapshots/published` (getPublishedSnapshot — decyzja
#6b, woła repository function wprost, nie duplikuje logiki redakcji) ·
`POST /:scorecardId/review-snapshots/:snapshotId/publish` (publishReviewSnapshot).

**getScorecard — repository nie eksportuje pojedynczego fetcha**: zweryfikowane
czytaniem `kpiScorecardRepository.ts` (tylko `listScorecards`/
`listScorecardItems`/`getScorecardStatusDistribution`/`getPublishedSnapshot`/
`listReviewSnapshots`, `ListScorecardsParams` bez filtra `scorecardId`).
Zamiast poszerzać kontrakt repozytorium dla wygody jednego pliku tras, dodano
lokalny `loadVisibleScorecard` w `kpiScorecard.routes.ts` — ten sam kształt
visibility-scoped-read co `listScorecards` (`wrapWithVisibilityScope`,
`resourceType:'kpi_scorecard'`, cast `::text` po stronie UUID, ten sam bug
TEXT/UUID co reszta pliku), zawężony do jednego `scorecard_id`. Wzorem
`kpi.routes.ts`'s `loadDefinitionVersionRow`/`loadMeasurementRow`.

**MOUNT-ORDER**: analogiczne ryzyko co `kpiDeviation.routes.ts`'s
`/deviation-cases` — `kpi.routes.ts` na `/api/vnext/results/kpi` ma
`GET /:kpiId` (jeden dynamiczny segment), który przechwyciłby
`GET /api/vnext/results/kpi/scorecards` z `kpiId="scorecards"` gdyby ten
router był zamontowany pod tym samym prefiksem. Naprawa: router zamontowany
pod BARDZIEJ SPECYFICZNYM `/api/vnext/results/kpi/scorecards`, zarejestrowany
w `Gateway.ts` PRZED `/api/vnext/results/kpi` (kolejność względem
`/deviation-cases` nie ma znaczenia — segmenty "scorecards" i
"deviation-cases" nigdy się nie zderzają, tylko oba z krótszym mountem).

**Testy — bezpośredni test repository na realnym Postgresie, POTWIERDZONE**
(zgodnie z krytyczną lekcją §24 — testy tras z `vi.mock` całego modułu
repozytorium NIE dowodzą działania joina widoczności):
- `server/src/routes/resultsVnext/__tests__/kpiScorecard.routes.test.ts` —
  27 testów, HTTP-boundary (walidacja Zod, mapowanie błędów, mount-order),
  repository/commands zmockowane w całości — tak jak `kpiDeviation.routes
  .test.ts`, i tak samo NIE jest dowodem że join widoczności działa.
- **NOWY** `tests/resultsVnext/kpi/kpiScorecardRepositoryRoutesRealdb.test.ts`
  — 3 testy, WOŁA `kpiScorecardRepository.ts` (`listScorecards`,
  `listScorecardItems`, `getScorecardStatusDistribution`,
  `listReviewSnapshots`) BEZPOŚREDNIO na realnym Postgresie 16 (ten sam
  przepis co §11/§15/§23/§24: `initdb --locale=C`, `LC_ALL=C`, TCP
  `127.0.0.1:28481`), zamyka lukę którą `scorecardPublishNonLeak.realdb
  .test.ts` (§23) zostawił otwartą dla tych czterech funkcji (miał pokrycie
  tylko dla `getPublishedSnapshot`). Scenariusze: (1) PRIVATE scorecard
  widoczny właścicielowi (USER_A), niewidoczny obcemu (USER_B) — `listScorecards`
  I lokalny `loadVisibleScorecard`; scorecard wstawiony BEZPOŚREDNIO przez SQL
  (`insertFixtureScorecard`/`insertScorecardVisibility`), nie przez
  `createScorecard` — bo `createScorecard` zawsze używa JEDNEJ współdzielonej
  aktywnej polityki domeny `'kpi'` per org (decyzja #1), więc w tym pliku
  każdy scorecard stworzony przez command layer wychodzi OPEN_ORG; ten sam
  trik co `scorecardPublishNonLeak.realdb.test.ts` dla PRIVATE KPI (mode leży
  na wierszu zasobu, nie na polityce). (2) widoczność na poziomie itemu
  (`resourceType='kpi'`) egzekwowana niezależnie od widoczności scorecardu
  (AC #4) — `listScorecardItems`/`getScorecardStatusDistribution` z
  ograniczonym KPI wewnątrz scorecardu OPEN_ORG. (3) PRIVATE scorecard
  całkowicie chowa historię (`listReviewSnapshots`) przed obcym.
  **Realny błąd złapany PRZEZ ten test podczas pisania** (nie tylko
  potwierdzenie): scenariusz (3) pierwotnie podawał `expectedVersion`
  SCORECARDU do `publishReviewSnapshot` zamiast `row_version` SNAPSHOTU —
  `AtomicWriteConflictError: STALE_VERSION` na realnym Postgresie, naprawione
  przez użycie `draft.result.rowVersion`.
- Pełny zestaw `tests/resultsVnext/kpi` + `server/src/routes/resultsVnext` na
  tym samym efemerycznym Postgresie: **163/163 PASS** (133 istniejące + 27
  nowych testów tras + 3 nowe testy repository) — **zero regresji**.

**Wynik końcowy**: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`
w `server/` — 0 błędów. Zero dewiacji od `KPI_E004_DESIGN.md` poza jawnie
udokumentowanym `getScorecard` (design nie precyzował tego endpointu — zbudowano
minimalny odpowiednik jak poproszono). Poza zakresem: `listCorrectiveActions
`/`listEffectivenessVerifications`-analogiczny endpoint dla wielu KPI naraz
(scorecard Tool §3 "Attention and deviations", jawnie odłożone w
`KPI_E004_DESIGN.md` §C.3) — nie budowany w tym pakiecie.

## 27. KPI-E005 Perspectives & Links — implementacja (mechanika, bez warstwy
API) (2026-08-09)

Zaimplementowano `KPI_E005_DESIGN.md` (§26) w 5 osobnych commitach
(Package 0-4), każdy zweryfikowany osobno na efemerycznym Postgresie 16
(`initdb --locale=C`, `LC_ALL=C`, TCP `127.0.0.1`) zanim przeszedł do
następnego — **każda nowa funkcja repository ma bezpośredni realDB test**,
zgodnie z wymogiem §24, nie tylko zmockowany test.

- **Package 0** — prerequisite: `listManagementChainDescendants` dopisane
  do `platform/managementChainMaintenance.ts` (§B.1) — pierwsza funkcja
  ODCZYTU w tym module (dotąd był tylko zapis/`updateManagerAndRecomposeClosure`).
- **Package 1** — dwie migracje, §A.3+§C skopiowane dosłownie:
  `20260813_rvn_kpi_measurement_cadence.sql` (addytywna kolumna
  `measurement_frequency_days` na `rvn_kpi_definition_versions` + rozszerzony
  `rvn_kpi_definition_versions_protect_approved()`) i
  `20260813_rvn_kpi_initiative_impacts.sql` (`rvn_kpi_initiative_impacts`,
  FK do `initiatives(id)` — pierwsza tabela RVN z realną zależnością od
  legacy baseline, `ux_..._one_active` partial unique index,
  `rvn_kpi_initiative_impacts_protect_baseline` trigger). Zweryfikowane na
  efemerycznym Postgresie NA SZCZYCIE istniejącego łańcucha migracji tej
  gałęzi + minimalnej fixture `initiatives(id TEXT PRIMARY KEY)` (pełny
  baseline `migrations-v2/001_baseline_20260413.sql` wymaga rozszerzenia
  `vector`, niedostępnego w tym środowisku — ten sam wzorzec samodzielnej
  fixture co istniejące testy realDB używają dla `team_members`): świeży
  apply exit 0, drugi przebieg idempotentny, rozszerzony trigger realnie
  blokuje mutację `measurement_frequency_days` na zatwierdzonej wersji
  (23001) a przepuszcza `effective_to`, `protect_baseline` realnie blokuje
  mutację `baseline_value_at_commitment`/`committed_by` po `committed`, i
  `ux_rvn_kpi_initiative_impacts_one_active` realnie blokuje drugi
  jednoczesny aktywny impact dla tego samego `(kpi_id, initiative_id)`.
- **Package 2** — `kpiPerspectivesRepository.ts`: `listMyKpis` (§A, SQL
  dosłownie — jedno zapytanie, UNION ALL sześciu gałęzi, grace period
  decyzji #5) i `listOrganizationKpiAttention` (§B, orkiestrator siedmiu
  NIEZALEŻNYCH zapytań — `missingOwnership` świadomie omija
  `chain_members`/`scoped_kpis` per decyzja #2). **Realny bug znaleziony
  przez uruchomienie dosłownego SQL na prawdziwym Postgresie, nie
  domysłem**: predykat design doc `< $4 - interval '1 day'` bez rzutowania
  na `$4` — Postgres'owe wnioskowanie typu parametru rozwiązuje operator `-`
  jako `interval - interval` zamiast `timestamptz - interval`, więc `$4`
  typuje się jako `interval` i zewnętrzne `<` pada 42883. Naprawione
  jawnym `$4::timestamptz`. Obie funkcje smoke-zweryfikowane end-to-end na
  realnym Postgresie z realnymi fixture'ami (poprawny grace period,
  poprawna agregacja chain-scoped).
- **Package 3** — `kpiInitiativeImpactTypes.ts` (Row/DTO) +
  `kpiInitiativeImpactCommands.ts` (§C.3: `proposeInitiativeKpiImpact`
  `executeAtomicCreate` z pre-checkiem ACTIVE_IMPACT_EXISTS,
  `commitInitiativeKpiImpact` `executeAtomicCommand` — zamraża baseline z
  NAJNOWSZEGO pomiaru W TEJ SAMEJ transakcji, `recordReviewedAttribution`
  `executeAtomicCommand` z self-approval denial (`reviewedBy` !=
  `committedBy`), `supersedeInitiativeKpiImpact` `executeAtomicCommand` —
  stara wersja → `superseded`, nowy `proposed` wiersz w TEJ SAMEJ
  transakcji) + `kpiInitiativeImpactRepository.ts`
  (`listInitiativeImpactsForKpi`/`listKpiImpactsForInitiative` przez
  `buildVisibilityScopedCte({resourceType:'kpi'})`, brak własnego wiersza
  widoczności — dziedziczy z KPI per design §C). Cztery nowe event types
  (`kpi.initiative_impact_*`) dopisane do `atomicWrite.ts`'s
  `EVENT_TYPE_CONSUMER_GROUPS`. **`aggregateType` musi być wartością z
  `RVN_RESOURCE_TYPES`** (typ `PlatformEventEnvelope.aggregateType` w
  `eventEnvelope.ts`) — `'kpi_initiative_impact'` tam nie istnieje (design
  świadomie nie rejestruje nowego resource type, tabela dziedziczy
  widoczność z KPI), więc eventy impactu używają `aggregateType:'kpi'` +
  `aggregateId:<kpiId właściciela>`, ten sam wzorzec co
  `kpiCorrectiveActionCommands.ts`'s `aggregateType:'deviation_case'` +
  `aggregateId:<deviationCaseId>`.

  **DEVIATION FROM DESIGN**: design §C.3 każe `commitInitiativeKpiImpact`
  pisać `link_graph_edges` "przez TĘ SAMĄ ścieżkę kodu co istniejący
  `POST /api/my-work/link-graph/edges`". Ta ścieżka
  (`my-work.routes.ts`'s `linkGraphAddEdge`, zweryfikowane czytaniem pliku,
  nie zgadywaniem) jest (1) modułowo-prywatną, nieeksportowaną `const` i (2)
  pisze przez `queryHelpers.queryRun`, który — wg WŁASNEGO komentarza tego
  pliku przy `withPgTransaction` — idzie przez współdzieloną PULĘ połączeń
  `PostgresDatabase`, chwytając RÓŻNE fizyczne połączenie przy każdym
  wywołaniu, więc nie może uczestniczyć w przypiętej transakcji
  `executeAtomicCommand`, w której design sam wymaga atomowości zamrożenia
  baseline + zapisu edge'a. Najbliższy bezpieczny odpowiednik: replikacja
  DOKŁADNIE tego samego kształtu wiersza `link_graph_edges` na przypiętym
  kliencie, z tą samą idempotentną obsługą duplikatu (23505 na
  `ux_link_graph_edges_ref` → no-op) — kopiowanie kształtu, nie
  ręczne pisanie innego.

- **Package 4** — testy. Unit (mock, `initiativeKpiImpactCommands.test.ts`,
  7 testów): self-approval denial, zamrażanie baseline (z pomiarem i bez),
  guard ACTIVE_IMPACT_EXISTS. RealDB (zgodnie z wymogiem §24 — KAŻDA nowa
  funkcja repository ma bezpośredni test, nie tylko zmockowany):
  `organizationKpiAttention.realdb.test.ts` (manager widzi tylko
  podwładnych przez tabelę zamknięcia łańcucha zarządzania; PRIVATE KPI
  podwładnego pozostaje niewidoczny mimo bycia w chain — T3 wygrywa,
  zweryfikowane przez `ownerLoad.activeKpiCount` zostające na 1, nie 2),
  `initiativeKpiImpactBaselineFreeze.realdb.test.ts` (TRIGGER, nie kod
  aplikacji, realnie blokuje bezpośredni UPDATE `baseline_value_at_commitment`/
  `committed_by` po commitment — 23001, `reviewed_attribution_value`
  pozostaje zapisywalne), `kpiIdentityAcrossSurfaces.realdb.test.ts` (§D.3
  dosłownie: jedna KPI + jeden deviation case + jedna scorecard + jeden
  InitiativeKPIImpact, odczytane przez wszystkich 5 powierzchni
  — `listKpis`/`getKpi`/`listMyKpis`/`listOrganizationKpiAttention`/
  `listScorecardItems` — string-equal `kpiId` wszędzie).

**Wynik końcowy**: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`
w `server/` — 0 błędów. Pełny zestaw `tests/resultsVnext/kpi` +
`server/src/routes/resultsVnext` na tym samym efemerycznym Postgresie:
**173/173 PASS** (163 istniejące + 10 nowych: 7 unit + 3 realDB) — **zero
regresji**. Dwie realne dewiacje znalezione i naprawione przez uruchomienie
na prawdziwym Postgresie (nie domysłem): predykat grace-period w §A.4
wymagający jawnego rzutowania `$4::timestamptz`, i architektura
`link_graph_edges`-write w §C.3 (opisana wyżej). Nie zbudowano: warstwa API
`/api/vnext/results/kpi/my`, `/attention`, `/initiative-impacts/*` — jawnie
poza zakresem tego pakietu per `KPI_E005_DESIGN.md`, następny, osobny
pakiet.

## 28. KPI-E005 Perspectives & Links — warstwa API (2026-08-09)

Zaimplementowano `server/src/routes/resultsVnext/kpiPerspectives.routes.ts` —
ostatni brakujący pakiet z `KPI_E005_DESIGN.md` §E ("Not in this package:
`/api/vnext/results/kpi/my`, `/attention`, `/initiative-impacts/*` HTTP
routes"). Ten sam wzorzec stylu co `kpi.routes.ts`/`kpiDeviation.routes.ts`/
`kpiScorecard.routes.ts` (inline handlery + wspólny `handle*Error` mapper +
lokalny `requireAuth`, bez osobnej klasy Controller).

**Endpointy**: `GET /api/vnext/results/kpi/my` (listMyKpis, userId z tokena)
· `GET /api/vnext/results/kpi/attention` (listOrganizationKpiAttention,
managerId z tokena) · `POST /api/vnext/results/kpi/initiative-impacts`
(proposeInitiativeKpiImpact) · `POST .../initiative-impacts/:impactId/commit`
(commitInitiativeKpiImpact) · `POST .../initiative-impacts/:impactId/review`
(recordReviewedAttribution, self-approval denial -> 403) ·
`POST .../initiative-impacts/:impactId/supersede`
(supersedeInitiativeKpiImpact) · `GET .../kpi/:kpiId/initiative-impacts`
(listInitiativeImpactsForKpi) · `GET /api/vnext/results/initiatives/
:initiativeId/kpi-impacts` (listKpiImpactsForInitiative). Walidacja Zod w
nowym `server/src/validators/resultsVnextKpiPerspectives.validators.ts`
(ten sam wzorzec pól — `idempotencyKeyField`/`nullableReasonField`/
`expectedVersionField`/`isoDateTimeString` — redeklarowany lokalnie, nie
importowany między plikami walidatorów, zgodnie z konwencją każdego
sąsiedniego pliku w tym katalogu).

**MOUNT-ORDER — nowy, inny kształt problemu niż §23/§25**: w
`/deviation-cases`/`/scorecards` chodziło o bardziej-specyficzny-prefiks-
najpierw. Tutaj `/my`/`/attention`/`/initiative-impacts/*`/
`/:kpiId/initiative-impacts` z brief'u zadania są BEZPOŚREDNIMI dziećmi
TEGO SAMEGO ogólnego prefiksu `/api/vnext/results/kpi`, który już posiada
`kpi.routes.ts` (`GET /:kpiId`) — nie da się dla nich wydzielić osobnego,
bardziej specyficznego pod-prefiksu tak jak zrobiły to poprzednie dwa
pakiety. Naprawa: `kpiPerspectives.routes.ts`'s domyślny router
zamontowany na DOKŁADNIE TYM SAMYM prefiksie `/api/vnext/results/kpi` i
zarejestrowany w `Gateway.ts` PRZED `resultsVnextKpiRoutes` — bez tego,
`GET /api/vnext/results/kpi/my` trafiłby najpierw w `kpi.routes.ts`'s
`GET /:kpiId` (`kpiId="my"`) i dostał 400 z walidacji UUID zamiast
przejść dalej. Sprawdzone EXPLICITE jednym testem, który faktycznie woła
oba te endpointy i sprawdza że `mockGetKpi` NIE został wywołany
(`kpiPerspectives.routes.test.ts`'s "mount-order regression guard" —
zarówno dla `/my`/`/attention`, jak i odwrotnie: osobny test potwierdza że
`GET /api/vnext/results/kpi/:realUuid` nadal poprawnie trafia w
`kpi.routes.ts`, więc naprawa nie połknęła całego prefiksu). Endpoint
`GET /:kpiId/initiative-impacts` nie kolidował z niczym z założenia — drugi
segment ścieżki jest literałem "initiative-impacts", nie dynamicznym
`/:kpiId` z jednym segmentem jak w `kpi.routes.ts`. Ósmy endpoint
(`GET /api/vnext/results/initiatives/:initiativeId/kpi-impacts`) leży pod
zupełnie nowym prefiksem `/api/vnext/results/initiatives` (zweryfikowane
grepem — nigdzie wcześniej niezamontowany), więc `kpiPerspectives.routes.ts`
eksportuje DWA routery (`export default` dla `/api/vnext/results/kpi`,
named export `initiativesKpiImpactsRouter` dla `/api/vnext/results/
initiatives`) zamiast jednego.

**Błąd, którego NIE ma w tym pliku**: ani `listMyKpis`/
`listOrganizationKpiAttention` (czyste odczyty przez
`buildVisibilityScopedCte`, nigdy nie rzucają `KpiNoActiveVisibilityPolicyError`
— zweryfikowane czytaniem `kpiPerspectivesRepository.ts`), ani komendy
InitiativeKPIImpact (ta tabela świadomie nie ma własnego wiersza
`rvn_platform_resource_visibility` — dziedziczy z KPI, design §C) nie mogą
rzucić tego błędu, więc `handlePerspectivesRouteError` — inaczej niż
`kpi.routes.ts`/`kpiScorecard.routes.ts` — NIE ma tej gałęzi.

**Testy — zgodnie z wymogiem §24, bezpośredni test repository/command na
realnym Postgresie dla KAŻDEJ funkcji użytej w tym pakiecie, nie tylko
zmockowana trasa**:
- `server/src/routes/resultsVnext/__tests__/kpiPerspectives.routes.test.ts`
  — 21 testów HTTP-boundary (walidacja Zod, mapowanie błędów, mount-order —
  montuje razem `kpiPerspectives.routes.ts` I `kpi.routes.ts` w tej samej
  kolejności co `Gateway.ts`, tak jak `kpiDeviation.routes.test.ts` robi to
  dla swojego prefiksu). Repository/command zmockowane w całości — jak
  zawsze, to NIE jest dowód działania joina widoczności.
- **NOWY** `tests/resultsVnext/kpi/kpiInitiativeImpactPerspectivesRoutesRealdb
  .test.ts` — 3 testy na realnym Postgresie 16, zamyka DWIE realne luki:
  (1) `listInitiativeImpactsForKpi`/`listKpiImpactsForInitiative`
  (`kpiInitiativeImpactRepository.ts`) miały ZERO pokrycia testowego
  gdziekolwiek przed tym pakietem (zgrepowane `tests/`/`server/src` — brak
  trafień poza samym plikiem repozytorium) — pierwszy realny przebieg ich
  `INNER JOIN rvn_visible_resources`/`kpi_id::text` (PRIVATE KPI właściciela
  OWNER widoczne, OUTSIDER bez RBAC override widzi pustą listę na obu
  ścieżkach odczytu, plus filtr `status` zawężający poprawnie); (2)
  `recordReviewedAttribution` miał tylko test jednostkowy na fałszywym
  `PoolClient` (`initiativeKpiImpactCommands.test.ts`) —
  ten plik dodaje realny self-approval denial (reviewedBy===committedBy,
  wiersz w DB niezmieniony po odrzuceniu) i realną ścieżkę sukcesu
  (committed -> realized_reviewed); `supersedeInitiativeKpiImpact` NIE MIAŁ
  ŻADNEGO testu wcześniej (zgrepowane `tests/` — zero trafień poza
  komentarzem) — ten plik jest jego pierwszym przebiegiem gdziekolwiek,
  włącznie z tańcem częściowego unikalnego indeksu
  (`ux_rvn_kpi_initiative_impacts_one_active`: stary wiersz flippowany na
  `superseded` PRZED insertem nowego `proposed` wiersza w tej samej
  transakcji — zweryfikowane bezpośrednim SELECT-em na obu wierszach po
  fakcie, nie tylko wynikiem funkcji).
- Pełny zestaw `tests/resultsVnext/kpi` + `server/src/routes/resultsVnext`
  na tym samym efemerycznym Postgresie (Homebrew `postgresql@16`,
  `initdb --locale=C`, gniazdo w `/private/tmp`, migracje
  `20260303_link_graph_v3.sql` + `20260809_rvn_platform_*.sql` +
  `20260810_rvn_kpi_core.sql` + `20260811_rvn_kpi_deviation_loop.sql` +
  `20260811_rvn_platform_obligations.sql` + `20260812_rvn_kpi_scorecards.sql`
  + `20260813_rvn_kpi_measurement_cadence.sql` +
  `20260813_rvn_kpi_initiative_impacts.sql`, plus samodzielna fixture
  `initiatives`/`team_members` jak każdy sąsiedni test w tym katalogu —
  pełny `migrations-v2/001_baseline_20260413.sql` wymaga rozszerzenia
  `vector`, niedostępnego w tym środowisku): **197/197 PASS** (173
  istniejące + 24 nowych: 21 HTTP-boundary + 3 realDB) — **zero regresji**.
  Dwie pułapki złapane i naprawione PODCZAS pisania testu realDB, nie tylko
  potwierdzone: (a) `buildVisibilityScopedCte`'s gałąź SCOPE zawsze
  referencuje `team_members` niezależnie od trybu widoczności faktycznie
  użytego przez fixture — brakująca tabela dawała `42P01` nawet dla
  scenariusza czysto PRIVATE; (b) `rvn_platform_visibility_policies` ma
  unikalny indeks `(organization_id, domain, policy_version)` — wołanie
  `insertVisibilityPolicy` osobno w KAŻDYM z trzech scenariuszy testowych
  (ten sam ORG_ID) dawało `23505` na drugim; naprawione jedną wspólną
  polityką utworzoną raz w `beforeAll`, reużywaną przez wszystkie trzy
  scenariusze (każdy ze swoim świeżym `kpi_id`).

**Wynik końcowy**: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`
w `server/` — 0 błędów. Zero dewiacji od `KPI_E005_DESIGN.md` — wszystkie 8
endpointów z brief'u zaimplementowane dosłownie zgodnie z sygnaturami
repository/command warstwy z §27. Poza zakresem: żaden — to był ostatni
brakujący pakiet KPI-E005 (§A–§D w pełni zamknięte: mechanika §27, API §28).

## 29. KPI-E006 Teresa & Governance — implementacja 4 pakietów (2026-08-09)

Zaimplementowano `KPI_E006_TERESA_DESIGN.md` w 4 osobnych commitach (Canon →
Migracja → Handler → Testy), zgodnie z §E. Teresa dostaje trzeci governed
handoff (po `initiatives`/`interview` w duchu, nowy w literze): doradca KPI
z trzema trybami — `draft_quality_review` (KPI-F-027, tworzy/edytuje
`draft` KPI przez `createKpiDraft`/`editDraft`), `check_in_manager_brief`
(KPI-F-028, czysty odczyt z re-weryfikacją widoczności W MOMENCIE
wykonania, nie ufa payloadowi sprzed minut), `reflection_rca` (KPI-F-030,
`submitRootCause` z prawdziwym `userId` jako aktorem — nigdy sentinel
`'teresa'`, bo `approvePlan`'s self-approval gate porównuje po tym polu).

**Pakiet 1 (Canon)**: `teresaCopilotCanon.ts` — 6 nowych typów
(`ResultsKpiAdvisorMode`/`ResultsKpiEvidenceBreakdown`/
`KpiDraftQualityReviewPayload`/`KpiCheckInManagerBriefPayload`/
`KpiReflectionRcaPayload`/`ResultsKpiHandoffContext`), wpis `kpi:` w
`P08_HANDOFF_TARGETS`, `'kpi'` dopisane na KOŃCU `P08_HANDOFF_TARGET_MODULES`
(9 istniejących nietknięte), `P08_KPI_FORBIDDEN_VERBS` (11 zabronionych
czasowników udokumentowanych jako stała).

**Pakiet 2 (Migracja)**: `20260814_rvn_teresa_kpi_handoff_results.sql` —
**odkrycie sprzeczne z założeniem projektu**: `teresa_handoff_results`
(razem z `teresa_proposals`/`teresa_audit_log`, które projekt świadomie
zostawia nietknięte) JUŻ MA realną migrację —
`20260719_baseline_gap.sql` (catch-up snapshot z 2026-07-19, `create table
if not exists "public"."teresa_handoff_results"` z identycznym schematem co
`ensureTeresaTables()`). Projekt tego nie wiedział. Migracja napisana mimo
to (zgodnie z briefem zadania) jako samodzielny, idempotentny no-op —
`CREATE TABLE IF NOT EXISTS` dopasowany kolumna-w-kolumnę do runtime'owego
kształtu (`TEXT created_at`, nullable `result_ref` — NIE `TIMESTAMPTZ`/`NOT
NULL` z draftu projektu), z osobnym `DO $$ ... $$` sprawdzającym istnienie
`teresa_proposals` przed dodaniem FK (żeby migracja przeszła też samodzielnie
na bazie bez `20260719_baseline_gap.sql`). Zweryfikowane na efemerycznym
Postgresie 16 (`initdb --locale=C`, TCP `127.0.0.1:28471/28472`,
`/private/tmp`): idempotencja ×2, ścieżka dołączenia FK po utworzeniu
`teresa_proposals`, czysty apply na szczycie realnego łańcucha migracji tej
gałęzi (`20260809_rvn_platform_*` ×4 + `20260810`–`20260813`, z wyjątkiem
`20260813_rvn_kpi_initiative_impacts.sql` — nie dotyczy tego pakietu,
wymaga osobnej fixture `initiatives`, dodanej osobno do pełnego przebiegu
regresji niżej).

**Pakiet 3 (Handler)**: `teresaCopilotService.ts` — dokładnie 4 importy z
`resultsVnext/kpi/` (`createKpiDraft, editDraft as editKpiDraft`,
`submitRootCause`, `getKpi, listKpis`, `getDeviationCase` — ostatni
importowany zgodnie z zamrożoną 6-nazwową whitelistą §D, ale NIEUŻYWANY
przez żaden z 3 handlerów, tak jak w kodzie źródłowym projektu), `case
'kpi':` w `performHandoff`, `buildKpiDraftAdvisorContext` (eksportowany,
uruchamiany PRZED `createProposal` — duplicate-risk lookup przez
`listKpis()`), `handleResultsKpiHandoff` + 3 handlery trybów +
`recordTeresaKpiHandoffResult`. **Decyzja #1 zastosowana**: pełny
`EditDraftInput` przeczytany PRZED napisaniem edit-path — pole z draftu
projektu (`editedBy`) NIE ISTNIEJE na prawdziwym interfejsie (prawdziwe pole
to `actorUserId`) — poprawione, zero `as any` w handlerze. Dodatkowo
jawny null-check na `KpiDefinition.currentDefinitionVersionId` (typ
`string|null`) przed przekazaniem do `editDraft`'s nienullowalnego
`definitionVersionId`, zamiast asercji `!`. **Decyzja #3 z jedną
udokumentowaną dewiacją strukturalną**: projekt zakładał istniejący `switch
(target_module)` w `undoProposal` do dopisania `case 'kpi':` — takiego
switcha nie ma (jest pojedynczy `if (target_module !== 'excele')`
blokujący WSZYSTKIE cele poza `excele` wspólnym kodem
`P08_UNDO_UNSUPPORTED_TARGET`). Dodano osobny `if (target_module ===
'kpi')` PRZED tym ogólnym sprawdzeniem, żeby zachować zamrożony przez
projekt kod błędu `P08_UNDO_NOT_SUPPORTED` bez przebudowy przepływu dla
pozostałych 9 celów. **Decyzja #5 zweryfikowana**: `actor_effective_role`/
`actorEffectiveRole` zgrepowane w całym repo — wolny string wszędzie
(`eventEnvelope.ts:37`, zero CHECK/enum/switch w `server/`/`tests/`) — użyto
`'teresa_initiated'` bez dewiacji, zgodnie z oczekiwaniem projektu.

**Pakiet 4 (Testy)** — 18 nowych testów, **215/215 PASS** razem ze 197
istniejącymi testami KPI (`tests/resultsVnext` + `tests/v8/
teresa-kpi-handoff.test.ts` + `server/src/routes/resultsVnext`, realny
Postgres 16, `RUN_DB_TESTS=1` — patrz niżej dlaczego to konieczne):
- `tests/resultsVnext/teresa-kpi-forbidden-verbs.test.ts` — **§D's własny
  bash snippet jest fałszywy**: `grep ... # Expected: ZERO matches` nie
  może być prawdą, skoro `P08_KPI_FORBIDDEN_VERBS` (string[] z tymi samymi
  11 czasownikami) jest zadeklarowany w JEDNYM z dwóch grepowanych plików —
  zweryfikowane wprost. Test implementuje realny niezmiennik zamiast: żaden
  zabroniony czasownik nigdy nie jest IMPORTOWANY (jedyny mechanizm wywołania
  w TS/JS) ani wywołany jako `verb(` w kodzie wykonywalnym (nie-komentarzu).
- `tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts` (realDB) —
  `executeProposal` dla `draft_quality_review` (create path) nigdy nie
  zostawia `rvn_kpi_definitions.status != 'draft'`; `reflection_rca` →
  `submitRootCause` z prawdziwym `userId` → `approvePlan` przez TEGO SAMEGO
  usera nadal odrzucone przez `DeviationSelfApprovalDeniedError` (fixture
  case z `created_by = ten sam user`, więc gate odpala przez `created_by`
  nawet bez przechodzenia przez `submitPlan`).
- `tests/v8/teresa-kpi-handoff.test.ts` (unit, mockowanie jak
  `teresaHandoffTargets.failClosed.test.ts`) — happy path (3 tryby),
  `STALE_VERSION` (edit path, `AtomicWriteConflictError` re-thrown, zero
  receipt), brak widoczności w trybie 2 (`P08_KPI_VISIBILITY_STALE`),
  duplicate-risk w trybie 1 (`buildKpiDraftAdvisorContext`), plus
  `undoProposal`'s `P08_UNDO_NOT_SUPPORTED`.

**Luka infrastrukturalna znaleziona i naprawiona (nie design, ale blokująca
literalne wykonanie brief'u)**: `tests/v8/**` nie było w `vitest.config.ts`'s
`include` — projekt PINuje `tests/v8/teresa-kpi-handoff.test.ts` jako
ścieżkę, ale żaden wcześniejszy plik tam nie istniał (istniejące testy
Teresy leżą w `server/src/services/v8/__tests__/`/`server/src/routes/v8/
__tests__/`, oba już pokryte). Bez glob-a `npx vitest run tests/v8/...`
dopasowuje zero testów NAWET z jawną ścieżką (pozycyjne ścieżki są
przecinane z `include`, nie dodawane do niego — ten sam udokumentowany wzorzec
co przy `tests/resultsVnext` w tym samym pliku). Dodano
`'tests/v8/**/*.{test,spec}...'`.

**Realna regresja znaleziona i naprawiona podczas weryfikacji (nie luka
testowa cudza, tylko własna)**: `server/src/routes/v8/__tests__/
p08-teresa-service.test.ts`'s §11 ma pętlę `for (const target of
P08_HANDOFF_TARGET_MODULES)` generującą jeden test na cel z fixture'ów w
lokalnej `payloadMap`. Dopisanie `'kpi'` do tej tablicy (Pakiet 1) karmi tę
pętlę nowym przypadkiem bez fixture'a → `payloadMap['kpi']()` rzuca
`TypeError`. Naprawione dopisaniem `buildKpiPayload()` +
rejestracją w mapie. `'documents'`/`'presentations'` mają DOKŁADNIE tę samą
lukę (potwierdzone identycznym zachowaniem z i bez tego pakietu, przez
tymczasowy `git show <parent>:plik > plik` swap i re-run) — to PRZEDISTNIEJĄCY,
niepowiązany dług, celowo nietknięty.

**Metoda dowodu zero regresji (nie tylko liczby, realny diff)**: pełny
zestaw testów Teresy (`teresaHandoffTargets.failClosed.test.ts` +
`p08-teresa-canon.test.ts` + `p08-teresa-e2e-lifecycle.test.ts` +
`p08-teresa-service.test.ts` + `p08-artifact-studio-teresa-bridge.test.ts` +
`tests/acceptance/m01-p07b-teresa-handoff.realdb.test.ts`) uruchomiony
DWUKROTNIE na tym samym efemerycznym Postgresie: raz z plikami
`teresaCopilotService.ts`/`teresaCopilotCanon.ts` podmienionymi na wersję z
commita SPRZED tego pakietu (`a42d737fba`, przez `git show <sha>:plik >
plik`, potem przywrócone), raz z realną wersją tego pakietu. **62 testy
failują identycznie w OBU wersjach** (stare, niezwiązane z KPI-E006:
`p08-teresa-canon.test.ts`'s `P08_ACTION_ENVELOPE_STATES` ma teraz 7
elementów zamiast oczekiwanych przez test 6 — `'undone'` dodany kiedyś bez
aktualizacji testu; `teresaHandoffTargets.failClosed.test.ts`'s fixture'y
nie zgadzają się z aktualnymi komunikatami błędów/polami — 57 failów) — to
NIE jest domysł, to zweryfikowany diff dwóch realnych przebiegów.

**Luka środowiskowa znaleziona podczas pisania testu realDB (zgodna z lekcją
§24/pamięcią repo "cichy mock bazy")**: pierwsza próba `executeProposal`
przez REALNY `teresa_proposals` (wstawiony ręcznym `pg.Client`) kończyła się
`P08_PROPOSAL_NOT_FOUND` mimo że wiersz istniał — `server/src/database/
Database.ts`'s `createDatabase()`/`getDatabaseInstance()` przełącza na
**w-pamięci mock bazy** gdy `NODE_ENV==='test' && RUN_DB_TESTS!=='1' &&
MOCK_DB!=='false'` — dokładnie ta sama pułapka co memory
`audyt-bazy-danych-2026-08-06.md`. `utils/DbPromise.js`
(`teresaCopilotService.ts`'s cała warstwa zapisu) idzie przez tę fabrykę;
`resultsVnext`'s `acquirePgClient()` (KPI command/repository layer) idzie
NIEZALEŻNIE, bezpośrednio przez `PostgresDatabase.ts`'s pool — dlatego
istniejące testy `*.realdb.test.ts` w `tests/resultsVnext/kpi/` działały bez
`RUN_DB_TESTS=1`, ale test na `executeProposal` (jedyny w tym pakiecie
przechodzący przez `teresaCopilotService.ts`'s WŁASNE tabele na realnej
bazie) go wymaga. Zdiagnozowane bezpośrednim skryptem `tsx` (raw insert +
`dbGet` fallback:false → `null` bez rzuconego błędu = cichy mock, nie
błąd połączenia).

**Wynik końcowy**: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`
w `server/` — 0 błędów. `tests/resultsVnext` + `tests/v8/
teresa-kpi-handoff.test.ts` + `server/src/routes/resultsVnext` — **215/215
PASS** (197 istniejące + 18 nowe), zero regresji na realnym Postgresie 16.
Testy Teresy istniejące — 62 pre-existing faile potwierdzone identyczne z i
bez tego pakietu (patrz wyżej), zero NOWYCH failów po naprawie §11's
`payloadMap`. 4 commity osobne (Canon → Migracja → Handler → Testy), zgodnie
z §E `KPI_E006_TERESA_DESIGN.md`.

## 30. KPI-E007 Legacy Archive / Ops Exclusion — implementacja + odbiór (2026-08-09)

**Ostatni epik domykający backend domeny KPI (E001–E007).** Zbudowano
`KPI_E007_DESIGN.md` §2–§9 dosłownie: `denyMutations` (nowy plik
`readOnlyGuard.middleware.ts`, celowo osobny od `demoGuard.middleware.ts` —
patrz Decyzja D5), `ListLegacyQuerySchema`/`LegacyIdParamsSchema`
(`resultsVnextKpiLegacy.validators.ts`), 8 funkcji odczytu +
`getLegacyArchiveIndex` (`kpiLegacyArchiveRepository.ts`, zero importów z
`*Commands.ts`), 9 endpointów GET-only pod
`/api/vnext/results/kpi/legacy` (`kpiLegacyArchive.routes.ts`, zamontowany w
`Gateway.ts` PRZED generycznym `/api/vnext/results/kpi`), jeden nowy licznik
`resultsVnextLegacyArchiveHitsTotal` (`metricsService.ts` §9). 6 commitów
osobnych (middleware+validatory → repository → metryka → routes+Gateway →
test A.4 → test B.2/realdb).

**Trzy realne dewiacje od pseudokodu projektu, znalezione WYŁĄCZNIE przez
uruchomienie na prawdziwym Postgresie (nie przez czytanie kodu ani `tsc`)**:

1. **`tp_kpi_definitions` NIE MA własnej kolumny `organization_id`** —
   projekt sam kazał to zweryfikować przed napisaniem WHERE ("it may not be
   literally `organization_id`... verify before writing the WHERE clause, do
   not assume") i miał rację być podejrzliwy: realny łańcuch to
   `tp_kpi_definitions.model_id → tp_governed_models.base_id →
   tp_bases.organization_id` (`server/migrations/700_table_platform_foundation.sql`,
   `713_governed_models.sql`). Repository robi JOIN przez ten łańcuch zamiast
   prostego `WHERE organization_id = $1`.
2. **`kpis` to NIE tabela, tylko VIEW tylko-do-odczytu** —
   `server/migrations/20260719_baseline_gap.sql`:
   `CREATE OR REPLACE VIEW public.kpis AS SELECT ik.id, i.organization_id,
   ik.name, ... FROM initiative_kpis ik JOIN initiatives i ON
   ik.initiative_id = i.id`. Bez kolumny `created_at` (tylko `updated_at`,
   stąd `ORDER BY` poprawiony) i bez możliwości INSERT/UPDATE/DELETE wprost
   (nieszkodliwe dla repository — same SELECT-y; test izolacji zatruwa
   `initiative_kpis`+`initiatives`, widok sam odzwierciedla wiersz).
   §0.1 draftu projektu opisywał `kpis` jako zwykłą tabelę — pierwszy realny
   `INSERT INTO kpis`/`DELETE FROM kpis` w teście padł na
   `error_view_not_updatable`, nie na braku tabeli.
3. **`initiatives.status` DEFAULTuje na `'step3'`** (`server/migrations/
   000_z_core_baseline.sql:264`), wartość którą WŁASNY
   `initiatives_status_check` tej tabeli odrzuca — pre-existing defekt
   migracji (default sprzed dodania CHECK, nigdy niezsynchronizowany),
   NIEZWIĄZANY z tym epikiem. Potwierdzone `git stash`: 3 ISTNIEJĄCE testy
   `tests/resultsVnext/kpi/{kpiIdentityAcrossSurfaces,
   initiativeKpiImpactBaselineFreeze,
   kpiInitiativeImpactPerspectivesRoutesRealdb}.realdb.test.ts` failują
   IDENTYCZNIE (ten sam błąd) na świeżym efemerycznym Postgresie 17 zarówno
   Z plikami KPI-E007 jak i bez nich (`git stash -u` → ten sam traceback) —
   to NIE jest regresja tego epika, to pre-existing dziura w łańcuchu
   migracji ujawniona przez fakt, że każdy `*.realdb.test.ts` w tym katalogu
   wstawia do `initiatives` bez jawnego `status`. Nie naprawione (poza
   zakresem KPI-E007) — zgłoszone jako osobny follow-up (patrz niżej).

**Czwarta dewiacja, nie-DB**: `router.all('*', denyMutations)` z projektu
nie działa na Express 5.2.1 tego repo (path-to-regexp v6+ odrzuca goły `'*'`
— zweryfikowane; wzorzec repo to nazwany wildcard, np.
`t01BrowserFixtureServer.ts`'s `/api/v8/transformation-cases/*path`).
Użyto `router.use(denyMutations)` (bez ścieżki) — funkcjonalnie identyczne,
nadal pierwsze w łańcuchu przed auth. Osobno: handlery walidują przez
istniejące `validateQuery`/`validateParams` (jak `kpi.routes.ts`), NIE przez
dosłowny inline `Schema.parse()+throw` z projektu — realny globalny error
handler (`ErrorHandler.ts`) nie ma gałęzi na `ZodError`, więc rzucony
`ZodError` wpadłby w gałąź 500, nie 400. `validateQuery`/`validateParams`
to jest dokładnie to, co projekt słowami nakazał ("matching the pattern
every other resultsVnext route file already uses").

**D1 (`v8_kpi_definitions`) zweryfikowane empirycznie**: `SELECT
table_schema, table_name FROM information_schema.tables WHERE table_name =
'v8_kpi_definitions'` na efemerycznym Postgresie zwraca DWA wiersze
(`public.v8_kpi_definitions` I `v8.v8_kpi_definitions`) — potwierdza
założenie projektu "baseline dump ma oba". `SHOW search_path` = `"$user",
public` (domyślny) → niekwalifikowane zapytanie repository rezolwuje do
`public.v8_kpi_definitions`, identycznie jak `resultsROIService.ts`.
Dowód na żywych danych (seed-smoke, posprzątany po sobie): wszystkie 4
tabele legacy + endpoint `/legacy` zwróciły poprawnie ukształtowane
koperty przez bezpośrednie wywołanie repository (nie tylko mock).

**Testy**: 2 nowe pliki, 39 nowych testów (37 `kpiLegacyArchive.routes
.test.ts` — 9 ścieżek × 4 czasowniki + 1 test statyczny; 2
`legacyIsolation.realdb.test.ts` — 1 test fixture'owy na realnym Postgresie
+ 1 test statyczny), oba 100% PASS na efemerycznym Postgresie 17
(`initdb --locale=C`, TCP `127.0.0.1:5433` — UWAGA: TCP, nie unix socket,
bo `DatabaseConfig.ts`'s własny `parsePostgresUrl()` czyta tylko
`new URL(...).hostname`/`.port`, IGNORUJE `?host=` query-param na unix
socket, więc DATABASE_URL musi wskazywać prawdziwy TCP endpoint, nie tylko
socket path — inny niż wcześniejszych epików wzorzec zauważony wprost, żeby
następny agent nie zgadywał od nowa). `RUN_DB_TESTS=1` wymagane.

**Pełny katalog `tests/resultsVnext/kpi/` (16 plików, `--no-file-parallelism`,
efemeryczny Postgres 17)**: PRZED tym epikiem (`git stash -u`, 14 plików) —
107 PASS + 5 skip = 112, 3 pliki failują w `beforeAll` (defekt #3 wyżej). PO
tym epiku (16 plików) — 146 PASS + 5 skip = 151, TE SAME 3 pliki failują
IDENTYCZNIE. Delta = dokładnie +39 zielonych testów (moje 2 nowe pliki),
zero nowych failów, zero naprawionych/popsutych pre-existing testów.
**Nie potwierdzam "215/215"
z §29 na TYM efemerycznym środowisku** — to nie jest sprzeczność z §29
(tamten wynik był zmierzony na innym, wcześniej zbudowanym klastrze Postgres
16, prawdopodobnie przed jakąkolwiek migracją, która wprowadziła/ujawniła
`initiatives_status_check` względem `'step3'`), tylko uczciwe stwierdzenie,
że NIE dało się dziś odtworzyć 1:1 tej liczby na świeżo zbudowanej bazie —
zgodnie z własną zasadą programu "audyty się starzeją w ~3 dni", zmierzono
i zaraportowano to, co faktycznie wykonało się TERAZ, z dowodem
(`git stash`) rozróżniającym winę tego epika od winy środowiska.
`npx tsc --noEmit` na całym repo — 0 błędów, potwierdzone przed i po
`git stash pop`.

**Follow-up zgłoszony (nie naprawiony w tym epiku)**: `initiatives.status
DEFAULT 'step3'` (`000_z_core_baseline.sql:264`) łamie własny
`initiatives_status_check` tej samej tabeli — każdy `INSERT INTO
initiatives` bez jawnego `status` na świeżo zmigrowanej bazie faluje. Poza
zakresem KPI-E007 (dotyczy `initiatives`, nie KPI), zgłoszone jako osobne
zadanie do wykonawcy.

**KPI-E007b (backlog, Decyzja D2 — poza zakresem)**: legacy scorecard
archive adapter (`kpi_scorecards`/`kpi_scorecard_items`,
`balancedScorecardService.ts`, `transformationScorecardService.ts` — 3
równoległe implementacje) NIE zbudowany. Strukturalnie różne od 4 tabel
definicji w zakresie (item-per-KPI, nie płaska definicja) i nigdy nie były
częścią inwentarza tego epika (`EXECUTION_LEDGER.md` §3.8,
`EPIC_LEDGER_LIVE.md` KPI-F-032..037). Legacy scorecard ma już żywy
zamiennik vNext (KPI-E004) z własną dwuwarstwową obroną widoczności —
osobny, niżej priorytetowy cleanup, nie blokuje domknięcia domeny KPI.

**Domena KPI (E001–E007) — backend zamknięty.** Program przechodzi do
domeny ROI.

## 31. ROI-E001 Case & Baseline — implementacja + odbiór (2026-08-10)

**Pierwszy epik domeny ROI.** Zbudowano `ROI_E001_DESIGN.md` §3–§8 dosłownie
(design był FROZEN, self-contained, full DDL — brak potrzeby zgadywania):
migracja `20260815_rvn_roi_core.sql` (`rvn_roi_cases`/`rvn_roi_baselines`,
14-wartościowy `status` forward-declared jak `rvn_kpi_definitions`, partial
unique index AC-02, trigger `rvn_roi_baselines_protect_frozen`), warstwa
komend `roiCaseCommands.ts` (`createRoiCase` z SAVEPOINT-dedupe race
skopiowanym dosłownie z `kpiDeviationCommands.openOrEscalateDeviationCase`,
`updateRoiCaseDetails`, `archiveRoiCase` jako flaga ortogonalna do `status`
per Decyzja D4, `startModeling`/`markReadyForReview` przez generyczne
`runRoiCaseLifecycleTransition`, eksportowany `isRoiCaseReadyForReviewEligible`
jako punkt rozszerzenia dla ROI-E002 per Decyzja D2) i
`roiBaselineCommands.ts` (`captureOrUpdateBaseline` z guardem frozen,
`freezeRoiBaseline` jako cross-epic kontrakt dla przyszłego
`approveRoiCase` z ROI-E003 per Decyzja D5), `roiRepository.ts`
(`listRoiCases`/`getRoiCase`/`getRoiBaseline` przez
`buildVisibilityScopedCte`/`wrapWithVisibilityScope`, `::text` cast na
każdym joinie `case_id` — TEN SAM bug klasy §24 tym razem NIE wystąpił w
finalnym kodzie, bo `roiVisibilityJoin.realdb.test.ts` napisany i uruchomiony
PRZED oznaczeniem epika za skończony, dokładnie jak design nakazał), 9
endpointów `/api/vnext/results/roi/cases/*` (`roi.routes.ts`, zamontowany w
`Gateway.ts`), walidatory Zod (`resultsVnextRoi.validators.ts`, lokalne
helpery pól jak KPI), 8 nowych event type'ów w
`EVENT_TYPE_CONSUMER_GROUPS` (`roi_case.decided` NIETKNIĘTY per Decyzja D7).
6 commitów osobnych (migracja → command/repository layer → event types →
HTTP layer → testy mockowane → fix błędu real-Postgres → testy realdb).

**Jeden realny bug Postgresa, znaleziony WYŁĄCZNIE przez uruchomienie na
prawdziwym Postgresie (nie przez czytanie kodu ani `tsc`)**: `createRoiCase`'s
ACL-grant INSERT (Decyzja D3) zawierał kolumnę `organization_id` — pasującą
do KAŻDEJ innej tabeli ten plik zapisuje, więc wyglądała naturalnie — ale
`rvn_platform_resource_acl` (`20260809_rvn_platform_visibility_core.sql`) NIE
MA takiej kolumny (PRIMARY KEY to `resource_type, resource_id, grantee_type,
grantee_id`). Postgres 42703 natychmiast, przy pierwszym realnym wywołaniu
`createRoiCase` na żywej bazie (`roiVisibilityJoin.realdb.test.ts`'s pierwszy
test). Projekt własny fragment kodu w §4.1 już pomijał tę kolumnę — naprawa
to dopasowanie do literalnej listy kolumn z designu i do realnej tabeli, NIE
ALTER tabeli platformowej. Znaleziony i naprawiony PRZED zamknięciem epika,
nie zostawiony jako dług.

**Drugi realny fakt Postgresa (nie bug, ale test-isolation lekcja)**:
`ux_rvn_roi_cases_one_active_per_initiative` (AC-02) naprawdę egzekwuje "co
najwyżej jeden aktywny Case per initiative" — pierwsza wersja
`roiCaseLifecycle.realdb.test.ts` dzieliła jeden `INITIATIVE_ID` między
blokami `it`, więc drugi blok's `createRoiCase` cicho zwracał case z
PIERWSZEGO bloku (`created: false`, już w statusie `modeling`) zamiast
tworzyć nowy — to jest DOKŁADNIE poprawne zachowanie AC-02, ale zepsuło
izolację testu i dało mylący błąd `INVALID_ROI_CASE_STATUS_TRANSITION`.
Naprawiono nadając każdemu fixture case'owi własną initiative — ubocznie to
jest żywy dowód, że AC-02's dedup faktycznie działa na prawdziwej bazie, nie
tylko w mockowanym SAVEPOINT-teście.

**Testy**: 4 nowe pliki w `tests/resultsVnext/roi/` (`roiCaseCreate.test.ts`
— 4 testy mockowane: no-active-policy fail-closed, AC-02 pre-check path,
AC-02 SAVEPOINT-race path via wymuszony 23505, happy-path create;
`roiVisibilityJoin.realdb.test.ts` — 3 testy realDB: RESTRICTED_ACL
grantee-widzi/outsider-nie-widzi dla `listRoiCases`/`getRoiCase`,
`getRoiBaseline` dziedziczy widoczność przez `case_id`, archived-default-
exclusion; `roiBaselineFreeze.realdb.test.ts` — 1 test realDB:
`captureOrUpdateBaseline` przed/po freeze, `freezeRoiBaseline` jako
samodzielny kontrakt, DB TRIGGER (nie tylko aplikacja) blokuje raw UPDATE na
zamrożonej kolumnie treści, ale przepuszcza `row_version`/`updated_at`;
`roiCaseLifecycle.realdb.test.ts` — 3 testy realDB: `startModeling`'s
fromStatuses guard, `markReadyForReview`'s
`isRoiCaseReadyForReviewEligible` guard w sekwencji brak-wartości → brak-
okresu → eligible, `archiveRoiCase` niezależny od statusu +
idempotentny re-archive) + 1 nowy plik `server/src/routes/resultsVnext/
__tests__/roi.routes.test.ts` (20 testów HTTP-boundary: create/get/list/
patch/archive/transitions/baseline, error→HTTP mapping, includeArchived:true
lookup behavior). **Razem 31 nowych testów, wszystkie PASS** (4+3+1+3
bezpośrednio w `tests/resultsVnext/roi/`, +20 w route test) na efemerycznym
Postgresie 17 (`initdb --locale=C`, TCP `127.0.0.1:5433` — ta sama uwaga co
§30: `DatabaseConfig.ts`'s `parsePostgresUrl()` ignoruje unix-socket
`?host=`, DATABASE_URL musi wskazywać prawdziwy TCP endpoint). Migracje
zaaplikowane: 4× `20260809_rvn_platform_*`, `20260810_rvn_kpi_core`,
`20260811_rvn_kpi_deviation_loop`, `20260811_rvn_platform_obligations`,
`20260812_rvn_kpi_scorecards`, `20260813_rvn_kpi_initiative_impacts`,
`20260813_rvn_kpi_measurement_cadence`, `20260814_rvn_teresa_kpi_handoff_results`,
`20260815_rvn_roi_core` (nowa) + minimalne fixture stand-in `initiatives`/
`team_members` (ten sam wzorzec co
`initiativeKpiImpactBaselineFreeze.realdb.test.ts`/
`kpiVisibilityJoinRegression.realdb.test.ts` już ustanowiły — realna tabela
`initiatives` żyje w core-baseline poza łańcuchem migracji tego programu).

**Pełny katalog `tests/resultsVnext/kpi/` (16 plików) — PRZED/PO porównanie
przez `git worktree` na commicie `53c4eca093` (ostatni PRZED tym epikiem),
NIE `git stash`** (cała praca ROI-E001 była już commitowana małymi
pakietami — worktree na starym SHA jest uczciwym odpowiednikiem stash na
tym samym efemerycznym Postgresie): **PRZED = 149 PASS + 2 skip, 1 plik
(`legacyIsolation.realdb.test.ts`) failuje w `beforeAll`** (brakuje pełnej
core-baseline schemy — legacy `kpi_definitions`/`initiative_kpis` spoza
łańcucha migracji rvn_*, niezwiązane z tym epikiem). **PO (z całym kodem
ROI-E001) = IDENTYCZNIE 149 PASS + 2 skip, ten sam 1 plik failuje tym samym
błędem.** Zero regresji, zero przypadkowych napraw. Dodatkowo sprawdzono
`tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts` (KPI-E006,
całkowicie niezwiązany plik) — failuje IDENTYCZNIE PRZED i PO (2 testy,
`P08_PROPOSAL_NOT_FOUND`) — potwierdzone jako pre-existing luka środowiska
(minimalna efemeryczna baza tego sesyjnego setupu brakuje pełnej schemy
Teresa/core), NIE regresja tego epika. `npx tsc --noEmit` na całym repo
(`NODE_OPTIONS=--max-old-space-size=8192`, bo domyślny heap OOM-uje na tym
repo — ta sama uwaga co poprzednie epiki) — **0 błędów**, sprawdzone po
KAŻDYM z 6 commitów, nie tylko na końcu.

**Nie potwierdzam "215/215" ani żadnej innej liczby z wcześniejszych epików
na TYM efemerycznym środowisku** — zgodnie z własną zasadą programu
("audyty się starzeją w ~3 dni"), zmierzono i zaraportowano dokładnie to, co
wykonało się TERAZ (149+31=180 PASS w połączonym KPI+ROI przebiegu
`tests/resultsVnext` + `server/src/routes/resultsVnext/__tests__`, patrz
liczby wyżej), z dowodem (worktree na starym SHA) rozróżniającym winę tego
epika od winy środowiska.

**Poza zakresem tego epika (przyszłe ROI-E002…E008), potwierdzone jako
NIEZBUDOWANE, nie zapomniane**: economic model (Assumption/Cost/Benefit/
Scenario/CalculationRun — ROI-E002), Submit/Approve/Reject/Changes-Requested
(ROI-E003 — `freezeRoiBaseline` już tu gotowy jako kontrakt dla
`approveRoiCase`), Tracking/Benefits Realization (ROI-E005), PIR (ROI-E006),
Finance seam (ROI-E007), Teresa/legacy (ROI-E008), `/cases/:caseId/history`
endpoint.

**Domena ROI: 1/8 epików zbudowanych (E001).** ROI-E002 jest następny w
kolejce per `EPIC_LEDGER_LIVE.md`'s epic split.

## 32. ROI-E002 Economic Model — implementacja + odbiór (2026-08-10)

**Drugi epik domeny ROI, pierwszy DETERMINISTYCZNY SILNIK KALKULACYJNY w
całym programie** (każdy wcześniejszy epik to CRUD+lifecycle). Zbudowano
`ROI_E002_DESIGN.md` §3–§9 dosłownie (design FROZEN, self-contained, full
DDL — bez zgadywania): migracja `20260816_rvn_roi_economic_model.sql` (7
nowych tabel: `rvn_roi_calculation_policy`/`assumptions`/`cost_lines`/
`benefit_lines`/`benefit_evidence_links`/`scenarios`+`scenario_overrides`/
`calculation_runs`, wszystkie triggery freeze-protection, `chk_rvn_roi_
benefit_lines_financial_amount`), czysty silnik `roiCalculationEngine.ts`
(zero importów `pg`/`express`/`platform/*`, Decyzja D12: `decimal.js`
ściśle w tym jednym pliku — cała sumacja period-series w `Decimal`,
NPV/IRR/payback delegowane do zaimportowanego `investmentAppraisalService.ts`
per Decyzja D1, plain `number` na granicy), 7 plików komend (`roiCalculation
PolicyCommands`/`roiAssumptionCommands`/`roiCostLineCommands`/`roiBenefit
LineCommands`/`roiBenefitEvidenceLinkCommands`/`roiScenarioCommands`/
`roiCalculationRunCommands`, wzorzec add/update/remove(soft-delete) z
`kpiCorrectiveActionCommands.ts`), `roiEconomicModelReadiness.ts`
(`isRoiCaseReadyForReviewEligibleWithEconomicModel` OPAKOWUJE, nigdy nie
zastępuje E001's `isRoiCaseReadyForReviewEligible` — dokładnie jak nakazała
Decyzja D2 z E001), `roiEconomicModelFreeze.ts` (`freezeRoiEconomicModel`,
cross-epic kontrakt dla przyszłego `approveRoiCase` z ROI-E003),
`roiEconomicModelRepository.ts` (10 funkcji odczytu, `::text` cast na
KAŻDYM joinie, hydratacja KPI-evidence-link per Decyzja D14), 11 grup
endpointów `/api/vnext/results/roi/cases/:caseId/*` (`roi.routes.ts`,
rozszerzony, nie nowy plik), walidatory Zod, 18 nowych event type'ów w
`EVENT_TYPE_CONSUMER_GROUPS` (`roi_case.decided` NIETKNIĘTY per Decyzja
D7). Dwie realne zmiany w już-wysłanym `roiCaseCommands.ts` (§4.1: insert
shellu calculation-policy w `createRoiCase`; §5: `guard` w
`RoiCaseLifecycleTransitionSpec` poszerzony z synchronicznego na
`async (client, caseRow, baselineRow) => Promise<check>`) — nazwane
uczciwie jako "Changed file", nie ukryte jako sama rozbudowa punktu
rozszerzenia. 9 commitów osobnych (schema → silnik → testy silnika →
command layer → wpięcie do roiCaseCommands+event catalog → repository+HTTP
→ testy route'ów mockowane → testy realDB → naprawa 4 testów E001).

**Decyzja D13 (dyskontowanie) zweryfikowana ręcznie, nie tylko przez
własne testy silnika**: `periodRate = (1+annualRate/100)^(1/periodsPerYear)
- 1` (compounding efektywnej stopy, NIE naiwne dzielenie przez 12).
KA-1 (wymagany przez AC-05): $100 000 koszt jednorazowy w okresie 0, $8000/
mies. przez 24 okresy, 12% roczna stopa dyskonta → `periodRate ≈
0,9488792934583046%` miesięcznie → **NPV = 70985,81355681579** (policzone
niezależną pętlą w komentarzu testu, NIE przez wywołanie silnika ani
`investmentAppraisalService`), payback = 12,5 okresu — silnik zwraca
DOKŁADNIE tę samą wartość (potwierdzone `toBeCloseTo` z wysoką precyzją).
Wszystkie 12 testów known-answer (§9) przechodzi, w tym KA-8 (mixed-
currency hard-fail: `status:'failed'`, zero policzonych metryk) i KA-12
(spy na zaimportowaną funkcję `irr()` potwierdza zero wywołań gdy
`requiredMetrics` jej nie wymaga).

**Jedna udokumentowana własna interpretacja niejednoznaczności designu
(nie cichy strzał)**: DDL `rvn_roi_cost_lines`/`rvn_roi_benefit_lines` NIE
MA żadnej kolumny łączącej linię z `rvn_roi_assumptions` — a design §4.3
mówi tylko, że downside/upside "podmienia wartość linii, jeśli linia
referencjonuje assumption" bez mechanizmu tej referencji. Design's własny
§9 simplification note nazywa dokładnie JEDEN wspierany przypadek: "linia,
której wartość WPROST odzwierciedla wartość assumption". Silnik implementuje
to dosłownie: linia, której `amount` jest DOKŁADNIE równe `baseValue` jakiejś
assumption, zostaje podmieniona na `downsideValue`/`upsideValue` tej
assumption dla scenariuszy kanonicznych — udokumentowane wprost w nagłówku
`roiCalculationEngine.ts` i w teście KA-3 (monotoniczność downside < base <
upside).

**Dwa realne bugi Postgresa, znalezione WYŁĄCZNIE przez uruchomienie na
prawdziwym Postgresie (nie przez czytanie kodu ani `tsc`)**:
1. `node-postgres` parsuje kolumny `DATE` (`analysis_start`/`analysis_end`,
   `one_time_period_date`, `recurrence_start_date`/`recurrence_end_date`)
   na obiekty JS `Date`, NIE na stringi `YYYY-MM-DD`, które deklaruje każdy
   typ `*Row` w tym pakiecie — ten repo nie ustawia żadnego custom
   `pg.types.setTypeParser` dla oid 1082. Żaden wcześniejszy komenda/test
   ROI-E001 nigdy nie robił arytmetyki dat na tych kolumnach, więc problem
   nigdy się nie ujawnił przed silnikiem ROI-E002. Naprawa: `toDateOnlyString()`
   w `roiCalculationRunCommands.ts`, konwersja przez LOKALNE gettery
   (`getFullYear`/`getMonth`/`getDate`), CELOWO nie `toISOString()` (które
   konwertuje na UTC i może przesunąć datę kalendarzową o jeden dzień
   zależnie od strefy czasowej hosta — to byłby dokładnie ten sam bug w innej
   postaci).
2. Design doc's własna proza §3 mówi "every mutable table below... gets a
   BEFORE UPDATE trigger", ale jego dosłowny DDL nigdy nie zawierał
   `rvn_roi_scenarios_protect_frozen` (tylko 4 z 5 mutowalnych tabel
   dostały trigger). `freezeRoiEconomicModel` mroziła `frozen_at` scenariusza
   identycznie jak pozostałe cztery tabele, ale bez triggera surowy UPDATE
   po zamrożeniu przechodziłby bez ostrzeżenia — złapane przez
   `roiEconomicModelFreeze.realdb.test.ts`'s pierwsze uruchomienie (scenario
   UPDATE po freeze "resolved" zamiast rzucić błąd). Naprawiono dodaniem
   triggera identycznego kształtu do pozostałych czterech, udokumentowane w
   samym pliku migracji jako DEVIATION dopasowująca własną intencję designu,
   nie nowa decyzja.

**Trzecia, mniejsza decyzja niestwierdzona wprost przez design**: `rvn_roi_
cases.analysis_start`/`analysis_end` są nullable (Decyzja honest-missing z
E001) — `createRoiCalculationRun` na case bez ustawionego okna analizy nie
ma sensownego fallbacku do sfabrykowania (dowolny epoch/dzisiejsza data
dałaby błędną liczbę bez ostrzeżenia). Naprawiono/zdecydowano: fail-closed
z typed `ANALYSIS_WINDOW_MISSING` errorem zamiast cichego domyślnego okna —
złapane przez `roiCalculationRun.realdb.test.ts`'s pierwsze uruchomienie
(totalCosts=0 zamiast 10000, bo linia kosztowa w 2026 lądowała poza
jednoelementowym oknem 1970-01-01..1970-01-01 domyślnym).

**Testy**: 5 nowych plików w `tests/resultsVnext/roi/` + 1 w
`server/src/routes/resultsVnext/__tests__/` — `roiCalculationEngine.
knownAnswer.test.ts` (12 testów, pure, no DB), `roiCalculationRun.
realdb.test.ts` (4 testy realDB: assemblacja silnika z realnych wierszy +
trzy gałęzie odmowy `isRoiCaseReadyForReviewEligibleWithEconomicModel` +
happy path), `roiEconomicModelVisibilityJoin.realdb.test.ts` (2 testy
realDB: `::text` join na wszystkich 7 nowych tabelach + hydratacja KPI
Decyzja D14), `roiEconomicModelFreeze.realdb.test.ts` (1 test realDB:
wszystkie 5 triggerów freeze + `double_counting_resolution_note` edytowalne
post-freeze przez raw UPDATE I przez `updateBenefitLine`),
`roiEconomicModel.routes.test.ts` (14 testów HTTP-boundary mockowane).
**Razem 33 nowe testy, wszystkie PASS** na efemerycznym Postgresie 17
(`initdb --locale=C`, TCP `127.0.0.1:5544` — ta sama uwaga co §30/§31).
Migracje zaaplikowane: te same jak §31 + `20260816_rvn_roi_economic_model`
(nowa).

**PRZED/PO przez `git worktree` na starym SHA `30e5aa140d`** (commit
"docs(results-vnext): freeze ROI-E002 Economic Model design", ostatni PRZED
tym epikiem), na osobnej efemerycznej bazie z tym samym minimalnym zestawem
migracji: **PRZED = 268 PASS + 2 skip, 5 plików failuje** (`initiativeKpi
ImpactBaselineFreeze.realdb.test.ts`/`kpiIdentityAcrossSurfaces.realdb.
test.ts`/`kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts` — brakująca
tabela `link_graph_edges`, poza łańcuchem migracji tego minimalnego
zestawu; `legacyIsolation.realdb.test.ts` — ta sama luka; `teresa-kpi-
e2e-no-silent-approval.test.ts` — `P08_PROPOSAL_NOT_FOUND`, znana
przedistniejąca luka środowiska z §12 mojej pamięci). **PO (z całym kodem
ROI-E002 + 4 naprawionymi testami ROI-E001) = 301 PASS + 2 skip, TE SAME 5
plików failuje z TYMI SAMYMI przyczynami.** Zero regresji; +33 zielonych
testów to dokładnie nowy pakiet ROI-E002. `npx tsc --noEmit`
(`NODE_OPTIONS=--max-old-space-size=8192`) na całym repo — **0 błędów**,
sprawdzone po każdym commicie.

**4 testy ROI-E001 zaktualizowane jako uczciwa, przewidziana konsekwencja
rozszerzenia `roiCaseCommands.ts`, NIE regresja**: `roiCaseCreate.test.ts`
(mock) potrzebował odpowiedzi fake-klienta na nowy INSERT/SELECT calculation-
policy; `roiBaselineFreeze`/`roiCaseLifecycle`/`roiVisibilityJoin.realdb.
test.ts` potrzebowały DELETE z `rvn_roi_calculation_policy` przed DELETE z
`rvn_roi_cases` w `afterAll` (nowy FK); `roiCaseLifecycle.realdb.test.ts`'s
"ready once baseline is complete" test potrzebował jednego udanego
calculation run przed `markReadyForReview`, bo guard został rozszerzony
przez E002 §5 dokładnie zgodnie z własnym kontraktem "wrap, don't replace"
Decyzji D2 z E001.

**Poza zakresem tego epika, potwierdzone jako NIEZBUDOWANE, nie zapomniane
(backlog notes)**:
- **Decyzja D9 (odroczona)**: w pełni zarządzany, wersjonowany
  `ROIPolicyVersion` (org-wide, maker-checker) i `ROIWorkingRevision`
  (autosave/undo) — `rvn_roi_calculation_policy` to prosty shell per-case,
  nie rejestr organizacyjny. Jeśli przyszły epik potrzebuje "każdy nowy
  Case dziedziczy domyślną stopę dyskonta organizacji" — to prawdziwa,
  uznana luka, nie cicho pominięta.
- **§9 formula-linking simplification**: podmiana scenariuszowa
  downside/upside działa WYŁĄCZNIE przez dokładne dopasowanie wartości
  liczbowej (linia.amount === assumption.baseValue) — nie ma języka formuł
  łączącego "ta linia kosztowa wynika z tej assumption" (np. linia =
  assumption × stawka jednostkowa). Bogatszy system formuł jest poza
  zakresem tego epika i nie blokowany przez żaden z 6 AC, ale to prawdziwa
  luka produktowa warta nazwania.
- `flagBenefitEvidenceLinkDisputed` (zbudowana w `roiBenefitEvidenceLink
  Commands.ts` per §4) nie ma jeszcze podpiętego route'u HTTP — §7's
  tabela wymienia dla tej ścieżki tylko GET/POST/DELETE, nie PATCH.

**Domena ROI: 2/8 epików zbudowanych (E001, E002). ROI-E003 Decision &
Approved jest następny w kolejce** — `freezeRoiBaseline` (E001) i
`freezeRoiEconomicModel` (E002) już gotowe jako jego kontrakty.

## 33. ROI-E003 Decision & Approved — implementacja + odbiór (2026-08-10)

**Trzeci epik domeny ROI, pierwszy maker-checker approval flow w całym
programie** (Submit → self-approval denial → Approve z immutable, content-
hashed `ApprovalSnapshot` → freeze obu poprzednich epików wywołane
JEDNOCZEŚNIE na tym samym pinned kliencie → Reject/Changes-Requested z
audytem → Reopen-for-revision = nowa wersja OBOK starej, nigdy nadpisanie).
Zbudowano `ROI_E003_DESIGN.md` §3–§9 dosłownie (design FROZEN, self-
contained, 21-wierszowa tabela Decisions D1-D21, pełny DDL — bez zgadywania):
migracja `20260817_rvn_roi_decision_approval.sql` (`rvn_roi_cases` ALTER: 4
nowe kolumny — `decision_calculation_run_id`/`changes_requested_by`/`_at`/
`_reason`; nowa tabela `rvn_roi_approval_snapshots`, immutable — brak
`row_version`/UPDATE/triggera, ten sam wzorzec co `rvn_roi_calculation_runs`;
3 nowe FK ALTERowane NA KOŃCU migracji na `original_approved_snapshot_id`/
`latest_approved_snapshot_id`/`decision_calculation_run_id` — dokładnie ten
ALTER, który komentarz migracji ROI-E001 forward-deklarował "epikowi, który
stworzy referencyjną tabelę"; własne odstępstwo: `ADD CONSTRAINT` owinięte w
`DO $$ ... IF NOT EXISTS (SELECT FROM pg_constraint) ... $$` zamiast gołego
literalnego DDL z designu — idempotencja pod `--safe`/wielokrotny re-run, nie
nowa decyzja projektowa), nowy plik komend `roiCaseApprovalCommands.ts`
(`submitRoiCaseForApproval`/`approveRoiCase`/`rejectRoiCase`/
`requestChangesOnRoiCase`/`reopenApprovedRoiCaseForRevision`/
`RoiSelfApprovalDeniedError` — ręczne `executeAtomicCommand`, NIE generyczny
helper, dokładnie jak `kpiDefinitionCommands.ts`'s `approveDefinitionVersion`;
manualny insert eventów `roi.baseline_frozen`/`roi.economic_model_frozen`/
`roi.baseline_unfrozen`/`roi.economic_model_unfrozen` na TYM SAMYM pinned
kliencie co CAS case'a, wzorzec `insertManualDeviationEvent` z
`kpiDeviationCommands.ts`), `roiCaseCommands.ts` (Changed: `NON_EDITABLE_
STATUSES` +`'submitted_for_approval'` per Decyzja D3, nowy `reopenRejectedRoiCase`
przez istniejący `runRoiCaseLifecycleTransition`), `roiBaselineCommands.ts`
(Changed: nowy status-guard w `captureOrUpdateBaseline` per Decyzja D4 —
plain `SELECT status` + `NON_EDITABLE_STATUSES` check, `unfreezeRoiBaseline`
symetryczny do `freezeRoiBaseline`), `roiEconomicModelFreeze.ts` (Changed:
`unfreezeRoiEconomicModel`, te same 5 tabel co `freezeRoiEconomicModel`),
`roiTypes.ts` (Changed: 4 nowe pola `RoiCase`/`RoiCaseRow` + `toRoiCase`),
2 nowe pliki typów/repozytorium `roiApprovalSnapshotTypes.ts`/
`roiApprovalSnapshotRepository.ts` (`listRoiApprovalSnapshots`/
`getRoiApprovalSnapshot` z dwuwarstwową D11 redakcją odczytu — re-derive
widoczności KPI CZYTELNIKA za każdym razem, nigdy nie ufaj temu co zamrożone
w JSONB, response-only, nigdy nie zmienia `content_hash`), 8 nowych route'ów
`/api/vnext/results/roi/cases/:caseId/*` w `roi.routes.ts` (Changed: dopisane
do istniejącego pliku, `handleRoiRouteError` dostaje branch
`RoiSelfApprovalDeniedError -> 403` SPRAWDZANY JAKO PIERWSZY, przed
generycznymi gałęziami 409), 3 nowe schematy Zod + schemat params w
`resultsVnextRoi.validators.ts`, `atomicWrite.ts` (Changed: usunięty martwy
placeholder `roi_case.decided` per Decyzja D15 — potwierdzone ZERO call
sites w całym repo, zastąpiony 8 realnymi kluczami `roi.case_*`/
`roi.*_unfrozen`; `roi.case_approved` faniuje do
`['mywork_projection','finance_projection']` zachowując Finance-facing
intencję usuniętego placeholdera, pozostałe 7 do samego `mywork_projection`).
8 commitów osobnych (migracja → command layer → event catalog + routes +
validators → testy mockowane self-approval → testy realDB happy-path →
testy realDB reapproval/submit-guard/freeze → testy realDB visibility-join →
testy route'ów).

**Zero realnych bugów Postgresa w kodzie produkcyjnym** — inaczej niż E001
(§31, kolumna `organization_id` na `rvn_platform_resource_acl`) i E002 (§32,
DATE→JS-Date + brakujący trigger `scenarios`), które oba złapały swój
pierwszy realny bug na PIERWSZYM uruchomieniu testów realDB. Design doc
ROI-E003 sam z góry ostrzegł o dokładnie tym ryzyku (§2 "Legacy collision
check" + jawne odesłanie do ROI-E001's forward-deklarowanego ALTER) i
zweryfikowanie migracji na żywym Postgresie (opisane niżej) potwierdziło:
`\d rvn_roi_approval_snapshots`/`\d rvn_roi_cases` po migracji pokazują
wszystkie 3 nowe FK, wszystkie 4 nowe kolumny, dokładnie jak w designie —
żadnej naprawy nie było potrzeba.

**Jedno realne odkrycie środowiskowe (nie bug kodu), złapane WYŁĄCZNIE przez
uruchomienie migracji na PEŁNYM łańcuchu migracji, nie tylko na minimalnym
podzbiorze rvn_*/RN-G1/KPI/ROI**: uruchomienie `db:migrate` (strict, cały
łańcuch ~250 plików) na świeżej efemerycznej bazie ujawniło, że prawdziwa
tabela `initiatives` core-baseline'u ma `status TEXT DEFAULT 'step3'`, ale
własny CHECK constraint (`initiatives_status_check`) NIE akceptuje
`'step3'` jako legalnej wartości (tylko wielka litera enum:
`'DRAFT'`/`'EXECUTING'`/...) — przedistniejący, niezwiązany z ROI-E003 bug w
DEFAULT tej tabeli, poza łańcuchem migracji tego programu. Nie naprawiane
(poza zakresem tego epika, tabela `initiatives` nie należy do domeny
resultsVnext) — testy tego epika (jak wszystkie poprzednie ROI/KPI testy
realDB) używają WYŁĄCZNIE minimalnego, udokumentowanego podzbioru 14
migracji (4× `20260809_rvn_platform_*`, `20260810_rvn_kpi_core`,
`20260811_rvn_kpi_deviation_loop`, `20260811_rvn_platform_obligations`,
`20260812_rvn_kpi_scorecards`, `20260813_rvn_kpi_initiative_impacts`,
`20260813_rvn_kpi_measurement_cadence`, `20260814_rvn_teresa_kpi_handoff_
results`, `20260815_rvn_roi_core`, `20260816_rvn_roi_economic_model`,
`20260817_rvn_roi_decision_approval` — nowa), z lokalnym minimalnym stand-in
`initiatives`/`team_members` (ten sam wzorzec co §31/§32 już ustanowiły) —
pod tym podzbiorem `initiatives` nie ma kolumny `status` w ogóle, więc bug
nigdy się nie ujawnia. Udokumentowane tutaj jako ostrzeżenie dla przyszłego
epika, który kiedykolwiek uruchomi te testy na PEŁNYM łańcuchu migracji.

**Testy**: 6 nowych plików w `tests/resultsVnext/roi/` + 1 w
`server/src/routes/resultsVnext/__tests__/` —
`roiCaseApprovalSelfApproval.test.ts` (4 testy mockowane: self-approval
odmówiona dla `submitted_by`, dla `created_by`, NIE odmówiona dla
`owner_user_id` — Decyzja D13 — plus szczegóły błędu), `roiCaseApproval.
realdb.test.ts` (1 test realDB: pełny happy path, snapshot wstawiony, oba
kontrakty freeze wywołane — dowód: raw UPDATE po zatwierdzeniu nadal
rzuca, oba wskaźniki poprawne, oba zdarzenia frozen w logu),
`roiCaseReapproval.realdb.test.ts` (1 test realDB: PEŁNY cykl AC-06 —
approve → reopen-for-revision → edycja baseline → resubmit → approve
ponownie; `original_approved_snapshot_id` identyczny, `latest_approved_
snapshot_id` przesunięty, `sequence_number` 1→2, **NAJWAŻNIEJSZA
POJEDYNCZA ASERCJA W TYM PAKIECIE**: `content_hash` PIERWSZEGO snapshotu
bajt-identyczny przed i po całym cyklu reopen/edit/resubmit/reapprove —
PRZESZŁA), `roiCaseSubmitGuard.realdb.test.ts` (2 testy realDB: AC-01 —
readiness złamana PO osiągnięciu `ready_for_review` złapana przy submit;
edit-lock dla OBU połówek — `NON_EDITABLE_STATUSES` przez istniejące
`roiCostLineCommands.ts` i NOWY guard D4 w `captureOrUpdateBaseline`),
`roiApprovalSnapshotFreeze.realdb.test.ts` (3 testy realDB: raw UPDATE
blokowany na wszystkich 5 mutowalnych tabelach E002 + baseline po
approval; te same wiersze edytowalne ponownie po reopen; rejected i
changes-requested case nigdy nic nie zamroziły), `roiApprovalSnapshotVisibilityJoin.
realdb.test.ts` (1 test realDB: `::text` cast poprawny na nowym joinie,
dwóch czytelników z różną widocznością KPI dostaje różne `kpiDetails` dla
TEGO SAMEGO evidence linku, identyczny `contentHash` oba razy, prawdziwy
outsider nie widzi nic), `roiCaseApproval.routes.test.ts` (22 testy HTTP-
boundary mockowane: wszystkie 8 nowych endpointów, w tym `403` dla
`RoiSelfApprovalDeniedError` sprawdzany PRZED generycznymi gałęziami 409).
**Razem 34 nowe testy, wszystkie PASS** na efemerycznym Postgresie 17
(`initdb --locale=C`, TCP `127.0.0.1:28733`) na TYM SAMYM minimalnym
14-migracyjnym zestawie co §31/§32.

**PRZED/PO przez `git stash -u`** (cała praca ROI-E003 była jeszcze
niecommitowana w momencie pomiaru — uczciwy odpowiednik `git worktree` na
starym SHA na TEJ SAMEJ efemerycznej bazie, ten sam pattern §31 już użył
gdy commitowanie było w toku): **PRZED (bez kodu ROI-E003) =
`tests/resultsVnext/` + `server/src/routes/resultsVnext/__tests__/` razem:
32 pliki testowe, 307 testów — 303 PASS + 2 FAIL + 2 skip**, te same 2
niepowiązane awarie co §32 już udokumentował (`kpiInitiativeImpactBaselineFreeze.
realdb.test.ts`/`kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts` —
brakująca tabela `link_graph_edges`, poza łańcuchem migracji tego
minimalnego zestawu, ORAZ duplicate-key na visibility policy w drugim z
tych plików — kolejność efektu ubocznego pierwszego failure'a w tym samym
pliku, nie osobny defekt). **PO (z całym kodem ROI-E003) = 39 plików
testowych, 341 testów — 337 PASS + 2 FAIL + 2 skip, TE SAME 2 awarie z
TYMI SAMYMI przyczynami.** Zero regresji; +34 zielonych testów to
dokładnie nowy pakiet ROI-E003 (7 nowych plików testowych, wszystkie PASS).
`npx tsc --noEmit` (`NODE_OPTIONS=--max-old-space-size=8192`) na całym repo
— **0 błędów**, sprawdzone po `git stash pop` (stan finalny) i wcześniej po
napisaniu każdego nowego/zmienionego pliku.

**Zero testów ROI-E001/E002 wymagało aktualizacji tym razem** — inaczej niż
ROI-E002 (§32), które musiało zaktualizować 4 testy ROI-E001 jako uczciwą
konsekwencję rozszerzenia `roiCaseCommands.ts`. Ten epik też edytuje
`roiCaseCommands.ts`/`roiBaselineCommands.ts`, ale oba dodatki (`NON_
EDITABLE_STATUSES` +1 wartość, nowy `SELECT status` guard w `captureOrUpdate
Baseline`) są addytywne i nie zmieniają zachowania żadnej ścieżki, którą
istniejące testy ROI-E001/E002 wykonują — potwierdzone identycznym zestawem
PASS w PRZED/PO powyżej (`roiCaseLifecycle.realdb.test.ts`/
`roiBaselineFreeze.realdb.test.ts`/`roiEconomicModelFreeze.realdb.test.ts`
wszystkie zielone w obu przebiegach).

**Sześć AC z prozy §0 designu wszystkie zaadresowane**: AC-01 guard
re-walidowany na granicy Ready-for-Review → Submitted, nie tylko ufany od
momentu osiągnięcia `ready_for_review` (`submitRoiCaseForApproval` re-runs
`isRoiCaseReadyForReviewEligibleWithEconomicModel`, Decyzja D1), AC-02
decision request pinuje konkretną wersję modelu ekonomicznego
(`decision_calculation_run_id`, Decyzja D5), AC-03 self-approval denial dla
maker-checker (`RoiSelfApprovalDeniedError`, sprawdzane PRZED jakimkolwiek
zapisem, Decyzja D13), AC-04 immutable content-hashed `ApprovalSnapshot`
jako trwały rekord decyzji (`rvn_roi_approval_snapshots`, brak UPDATE path),
AC-05 rejection i changes-requested oba audytowane (osobne kolumny
`rejected_*`/`changes_requested_*`, Decyzja D6), AC-06 reapproval tworzy
nową wersję OBOK starej, nigdy nadpisanie (`sequence_number` 1→2,
`original_approved_snapshot_id` niezmienny, `latest_approved_snapshot_id`
przesunięty, Decyzja D10 — dowiedzione bajt-identycznym `content_hash` w
`roiCaseReapproval.realdb.test.ts`).

**Poza zakresem tego epika, potwierdzone jako NIEZBUDOWANE, nie zapomniane
(backlog notes, per Decyzje D17/D18/D20)**:
- **Decyzja D17 (odroczona)**: mechanizm obligation/przypisania zatwierdzającego
  — submit NIE tworzy żadnej powiadomienia/zadania MyWork dla konkretnego
  zatwierdzającego. Żaden dokument źródłowy nie nazywa reguły przypisania
  zatwierdzającego — wymyślanie jej byłoby fabrykowaniem zachowania.
  Ustrukturyzowane tak, by dodanie tego później było jednolinijkowym
  wywołaniem `createObligation` w istniejącej transakcji, nie przeprojektowaniem.
- **Decyzja D18 (odroczona)**: `reopenApprovedRoiCaseForRevision` NIE
  obsługuje reopeningu ze stanów Tracking/Benefits-Realization/PIR
  (post-E004/E005/E006) — `fromStatuses: ['approved']` tylko. Czy przyszły
  epik rozszerzy ten command, czy zbuduje własny (biorąc pod uwagę że
  ROI-E004's Forecast/Actual reconciliation nie wie jeszcze jak obsłużyć
  reopen) — to decyzja TEGO epika z pełnym kontekstem danych, które będą
  wtedy istnieć. Spekulatywne projektowanie pod struktury danych, które
  jeszcze nie istnieją, ryzykuje złym zgadnięciem.
- **Decyzja D20 (odroczona)**: brak dedykowanego poziomu dostępu ACL
  "approver" odróżnionego od `'contribute'` — maker-checker pozostaje CZYSTO
  identity checkiem self-approval (Decyzja D13); ktokolwiek z dostępem
  `'contribute'` kto nie jest submitterem/twórcą case'a może zatwierdzić.
  Dokładnie ten sam precedens co KPI. To PRZEDISTNIEJĄCY zakres platformy
  (sam model ACL, RN-G1), nie coś co ROI-E003 wprowadza lub powinien cicho
  załatać — oznaczone jako świadomość wyższej stawki finansowej ROI, ale
  naprawa granularności ACL platformy jest poza zakresem tego epika.

**Domena ROI: 3/8 epików zbudowanych (E001, E002, E003). ROI-E004 Forecast &
Actual jest następny w kolejce** — approval flow (Submit/Approve/Reject/
Changes-Requested/Reopen, immutable `ApprovalSnapshot`) teraz kompletny;
kolejny epik operuje na Forecast/Actual danych POZA zakresem tej epiki.

## 34. ROI-E004 Forecast & Actual — implementacja + odbiór (2026-08-10)

**Czwarty epik domeny ROI, zamyka OBIE zarezerwowane kolumny wskaźnikowe
ROI-E001 (`current_forecast_version_id`/`current_actual_snapshot_id`) i
wprowadza PIERWSZE w tym case'ie przejście do statusu `'tracking'`.**
Zbudowano `ROI_E004_DESIGN.md` §3–§8 dosłownie (design FROZEN, self-
contained, 20-wierszowa tabela Decisions D1-D20, jedna jawna decyzja
OVERRIDE — D10 — wobec własnej rekomendacji draftu; pełny DDL — bez
zgadywania): migracja `20260818_rvn_roi_forecast_actual.sql` (5 nowych
tabel — `rvn_roi_forecast_versions` immutable, `rvn_roi_actual_entries`
append-only z generated `line_key`, partial unique index i `REVOKE UPDATE,
DELETE FROM PUBLIC`, `rvn_roi_actual_snapshots` immutable rollup,
`rvn_roi_variances`/`rvn_roi_variance_causes` stored z fact-protection
triggerem; 2 FK ALTERowane NA KOŃCU zamykające obie rezerwacje ROI-E001 —
własne odstępstwo, ten sam wzorzec co ROI-E003: `ADD CONSTRAINT` owinięte w
`DO $$ ... IF NOT EXISTS (SELECT FROM pg_constraint) ... $$` zamiast gołego
literalnego DDL z designu, idempotencja pod `--safe`/wielokrotny re-run, nie
nowa decyzja projektowa), Changed `roiCaseCommands.ts` (`ROI_TRACKING_
ACTIVE_STATUSES` wyeksportowany), Changed `roiCalculationRunCommands.ts`
(5 funkcji wyeksportowanych per Decyzja D5 — `toDateOnlyString`/
`assumptionRowToEngine`/`costLineRowToEngine`/`benefitLineRowToEngine`/
`policyStampObject`, zero zmiany zachowania), 10 nowych plików komend/
repozytoriów (`roiTrackingCommands.ts` — `startRoiCaseTracking` ręcznym
`executeAtomicCommand`, ten sam wzorzec "commands with side effects" co
`roiCaseApprovalCommands.ts`; `roiForecastVersionCommands.ts`/`Repository.ts`
— `createRoiForecastVersion` woła `roiCalculationEngine.ts` BEZ ŻADNEJ
zmiany silnika per Decyzja D4; `roiActualEntryCommands.ts`/`Repository.ts` —
mirror `kpiMeasurementCommands.ts`'s `recordMeasurement`/`correctMeasurement`/
`verifyMeasurement`/`disputeMeasurement` dokładnie, plus D10 walk-back (niżej);
`roiActualSnapshotCommands.ts`/`Repository.ts`; `roiCompareRepository.ts` —
`getRoiCaseCompareView`, czysty odczyt live, trzy typowane sloty per metryka;
`roiVarianceCommands.ts`/`Repository.ts`) + `roiForecastActualTypes.ts`, 20
nowych endpointów w `roi.routes.ts` (Changed, ten sam plik co E001/E002/E003;
`handleRoiRouteError` dostaje `RoiActualSelfVerificationDeniedError -> 403`
(D10) i `RoiActualEntryNotFoundError`/`RoiVarianceNotFoundError -> 404`
SPRAWDZANE PRZED generyczną gałęzią 409, dokładnie ten sam wzorzec co
`RoiSelfApprovalDeniedError` w ROI-E003), nowy plik walidatorów
`resultsVnextRoiForecastActual.validators.ts` (dedykowany plik, ten sam
precedens co ROI-E002/E003), `atomicWrite.ts` (Changed: 9 nowych kluczy
zdarzeń `roi.tracking_started`/`roi.forecast_published`/`roi.actual_recorded`/
`roi.actual_corrected`/`roi.actual_snapshot_published` →
`['mywork_projection','finance_projection']`, `roi.actual_verified`/
`roi.actual_disputed`/`roi.material_variance_detected`/
`roi.variance_status_updated`/`roi.variance_cause_added` →
`['mywork_projection']`).

**Decyzja D10 (jedyna prawdziwie nowa logika biznesowa tego epika) —
zaimplementowana i UDOWODNIONA testem realDB**: `verifyActualEntry` odmawia
weryfikacji, gdy weryfikujący JEST oryginalnym rejestrującym całego łańcucha
korekt, nie tylko bezpośrednio poprzedniego wiersza. `resolveOriginalActualEntry
Recorder` (w `roiActualEntryCommands.ts`) idzie WSTECZ po
`correction_of_actual_entry_id` jedną rekurencyjną CTE (`WITH RECURSIVE`) aż
do wiersza-korzenia, zamiast pętli aplikacyjnej — jeden round-trip. Scenariusz
z designu §4/§7 dosłownie zreprodukowany i PRZESZEDŁ na realnym Postgresie:
rejestrujący A tworzy wpis, B koryguje, A próbuje zweryfikować KOREKTĘ B —
odmówione (`RoiActualSelfVerificationDeniedError`, 403), bo A wciąż jest
oryginalnym rejestrującym łańcucha; C (ani A, ani B) MOŻE zweryfikować tę samą
korektę — dowodzi, że odmowa jest specyficzna dla oryginalnego rejestrującego,
nie ślepą regułą "obcy tylko". Test asercjuje też, że odmówiona próba NIE
wstawiła żadnego wiersza (łańcuch pozostaje dokładnie 2 głęboki) —
`roiActualEntryAppendOnly.realdb.test.ts`.

**AC-01 (forecast nigdy nie mutuje Approved) — dowiedzione dosłownie, w stylu
`roiCaseReapproval.realdb.test.ts`**: `roiForecastVersion.realdb.test.ts`
tworzy forecast Z override'em (cost line 1000→1500 w SAMYM forecaście), po
czym odczytuje ponownie oryginalny `content_hash`/pełny payload
`rvn_roi_approval_snapshots` ORAZ same wiersze `rvn_roi_assumptions`/
`rvn_roi_cost_lines`/`rvn_roi_benefit_lines` — wszystkie bajt-identyczne
przed i po. Zamrożony wiersz cost-line'a wciąż ma `amount = '1000'`
(oryginał) — override żyje WYŁĄCZNIE w `input_overrides`/`input_snapshot`
forecastu, nigdy nie jest zapisywany z powrotem na leżący pod spodem wiersz.
PRZESZEDŁ.

**Dwa realne bugi znalezione i naprawione — oba we WŁASNYCH testach tego
epika, nie w kodzie produkcyjnym**: (1) `has_table_privilege('PUBLIC', ...)`
jest NIEPRAWIDŁOWYM wywołaniem — `'PUBLIC'` to zarezerwowane słowo kluczowe
GRANT/REVOKE, nie odpytywalna nazwa roli (Postgres 42704 "role PUBLIC does
not exist"); co ważniejsze, połączenie testu jest superuserem/właścicielem —
`has_table_privilege` dla tej roli zwróciłoby `true` NIEZALEŻNIE od REVOKE
(superuser omija sprawdzanie ACL całkowicie), dokładnie ten obejście, które
komentarz nagłówka migracji już dokumentuje. Naprawa: świeża rola `NOLOGIN`
bez własnych grantów (dziedziczy WYŁĄCZNIE to, co ma PUBLIC), `SET ROLE` w
tej samej sesji, próba UPDATE/DELETE — poprawnie rzuca 42501 (insufficient_
privilege) `roiActualEntryAppendOnly.realdb.test.ts`. (2) Zapytania o liczbę
obligacji w `roiTrackingTransition.realdb.test.ts` filtrowały tylko po
`reference_id`, nie po `obligation_type` — `createRoiCase` (pierwszy krok
fixture'u) TAKŻE tworzy własną obligację `start_roi_study` dla tego samego
`reference_id`, więc zapytanie widziało 2 wiersze zamiast 1; naprawione
dodaniem `AND obligation_type = 'track_roi_forecast_actuals'`.

**Jedno świadome odstępstwo formuły, udokumentowane w kodzie, nie
przemilczane**: design doc nazywa pola `rvn_roi_actual_snapshots` (§3), ale
nie podaje dokładnej formuły agregacji (inaczej niż §4.3 ROI-E002 dla
silnika). `total_actual_costs`/`total_actual_financial_benefits`/
`actual_simple_roi` są policzone wprost mirror'ując silnik
(`roiCalculationEngine.ts`'s `simpleRoiDecimal`); `actual_npv` zostaje `null`
— wpisy Actual nie mają stałej siatki okresów jak `periodSeries`
CalculationRun/ForecastVersion (mogą lądować na dowolnych, nawet
zachodzących na siebie zakresach `period_start`/`period_end`), a żaden
dokument źródłowy nie precyzuje dyskontowania nieregularnych przepływów —
sfabrykowanie siatki okresów tutaj ryzykowałoby cicho błędną liczbę, ta sama
zasada "honest missing zamiast fabrykowanego", którą program już ustanowił
dla `RoiBaseline`'s nullable pól. Ten sam powód sprawia, że slot ACTUAL
metryki `paybackPeriods` w `getRoiCaseCompareView` ZAWSZE zwraca
`not_yet_available`/`no_actual_recorded`, nawet gdy actual snapshot istnieje
— tabela nie ma kolumny `payback_periods` w ogóle. Oba udokumentowane w
kodzie (`roiActualSnapshotCommands.ts`/`roiCompareRepository.ts` nagłówki) i
niżej jako backlog dla ROI-E005/E006.

**Testy**: 7 nowych plików w `tests/resultsVnext/roi/` + 1 w
`server/src/routes/resultsVnext/__tests__/` — `roiTrackingTransition.
realdb.test.ts` (3 testy: happy path + obligacja D2, guard odrzuca
non-approved, idempotencja deduplication key obligacji), `roiForecastVersion.
realdb.test.ts` (4 testy: AC-01 hash-stability z override'em — opisany
wyżej, drugi forecast sequence 1→2 D6, `CASE_NOT_TRACKABLE`,
`OVERRIDE_TARGET_NOT_FOUND`), `roiActualEntryAppendOnly.realdb.test.ts` (3
testy: PEŁNY łańcuch record→correct→verify→dispute z DOWODEM D10 opisanym
wyżej, `RoiActualEntryNotFoundError`, raw UPDATE/DELETE zablokowany —
dowiedzione przez świeżą rolę `NOLOGIN`, nie przez `has_table_privilege`),
`roiActualSnapshot.realdb.test.ts` (2 testy: rollup z verified/unverified/
disputed counts + `entry_ids_included`, drugi snapshot sequence 1→2),
`roiCompareView.realdb.test.ts` (1 test: WSZYSTKIE trzy stany
missing-reason w jednej progresji — not_yet_approved → no_forecast_published
→ no_actual_recorded → wszystko available poza payback/actual), `roiVariance.
realdb.test.ts` (4 testy: `recordVariance` snapshotuje baseline/comparison +
liczy amount/pct, `updateVarianceStatus` CAS na WŁASNYM `row_version`
wariancji, `addVarianceCause`/`removeVarianceCause`, AC-05 fact-protection —
raw UPDATE na faktach rzuca `/immutable/i` przez trigger DZIAŁAJĄCY nawet
dla tego superuser połączenia testowego, status/owner nadal edytowalne),
`roiForecastActualVisibilityJoin.realdb.test.ts` (4 testy: `::text` cast na
wszystkich 5 nowych tabelach, RESTRICTED_ACL grantee widzi / outsider nie
widzi, dla każdej z `listRoiForecastVersions`/`getRoiForecastVersion`/
`listActualEntries`/`getActualEntry`/`listRoiActualSnapshots`/
`getRoiActualSnapshot`/`listVariances`/`getVariance` łącznie z joinem
`variance_causes`), `roiForecastActual.routes.test.ts` (27 testów HTTP-
boundary mockowanych: wszystkich 20 nowych endpointów, w tym `403` dla
`RoiActualSelfVerificationDeniedError` (D10) i `404` dla
`RoiActualEntryNotFoundError`/`RoiVarianceNotFoundError` sprawdzane PRZED
generycznymi gałęziami 409). **Razem 48 nowych testów, wszystkie PASS** na
efemerycznym Postgresie 17 (`initdb --locale=C`, TCP `127.0.0.1:28546`), na
TYM SAMYM minimalnym zestawie migracji co §31/§32/§33 (14 plików +
`20260818_rvn_roi_forecast_actual.sql` = 15).

**Regresja KPI + ROI-E001/E002/E003 — PRZED/PO przez `git stash` na TEJ
SAMEJ efemerycznej bazie**: pełny zestaw `tests/resultsVnext/kpi/` +
`tests/resultsVnext/roi/` + 4 pliki route'ów (`roi.routes.test.ts`/
`roiCaseApproval.routes.test.ts`/`roiEconomicModel.routes.test.ts`/
`roiForecastActual.routes.test.ts`) = 41 plików, 297 testów: **293 PASS, 2
FAIL, 2 skip zarówno PRZED (kod ROI-E003, `git stash` na 4 zmienionych
plikach) jak i PO** (kod ROI-E004) — identyczne dwa niepowiązane pliki
zawodzą w obu: `kpiIdentityAcrossSurfaces.realdb.test.ts`/
`kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts`/`legacyIsolation.
realdb.test.ts`/`initiativeKpiImpactBaselineFreeze.realdb.test.ts` (KPI-E005/
E007, nieistniejące tabele `link_graph_edges`/`kpi_definitions` — obie
pochodzą z migracji SPRZED tego programu, `20260303_link_graph_v3.sql` i
legacy, poza minimalnym 14/15-plikowym zestawem ROI/KPI-`rvn_*`; ten sam
rodzaj przedistniejącej luki co `initiatives.status DEFAULT 'step3'`
udokumentowana w §33 — luka metodologii "minimalny zestaw", nie regresja
tego epika). **Zero regresji w domenie ROI-E001/E002/E003 ani w reszcie KPI**
— dowiedzione, nie zadeklarowane.

---

## 35. ROI-E005 Benefits Realization — implementacja + odbiór (2026-08-10)

**Piąty epik domeny ROI, zero-migracyjny — czysto nowe komendy/odczyty nad
schematem ROI-E001…E004, bez żadnej nowej tabeli/kolumny.** Zbudowano
`ROI_E005_DESIGN.md` §2–§6 dosłownie (design FROZEN, 18-wierszowa tabela
Decisions D1-D18): **Decyzja D5 (kluczowe ustalenie tego epika, potwierdzone
CZYTANIEM, nie założone)** — `initiativeClosureService.ts` ma ZERO odwołań
do jakiejkolwiek tabeli `rvn_*` i ZERO zapisów do `rvn_platform_obligations`
— AC-02 ("MyWork obligations przetrwają zamknięcie Initiative") jest już
STRUKTURALNIE spełnione; zadaniem tego epika na AC-02 był realny test
dowodzący tego, nie nowy kod produkcyjny naprawiający coś, co nie jest
zepsute.

**Nowe pliki**: `roiBenefitsRealizationCommands.ts`
(`startRoiCaseBenefitsRealization` — `'tracking'→'benefits_realization'`,
ręczny `executeAtomicCommand` strukturalnie kopiujący
`startRoiCaseTracking`, guard TYLKO na własnym `status` case'a, NIGDY nie
czyta `initiatives.status` — literalny mechanizm AC-01; `cancelRoiCase` —
`ROI_TRACKING_ACTIVE_STATUSES→'cancelled'`, `reason: string` obowiązkowy,
funkcja dotyka WYŁĄCZNIE `rvn_roi_cases` — strukturalny dowód AC-04, nie
tylko asercja testu), `roiBenefitsRealizationRepository.ts`
(`getRoiCaseBenefitsRealizationView` — formuła D10:
`(actual/approved)*100`, licznik = `currentActualSnapshotId`-owskazywany
`total_actual_financial_benefits`, mianownik = `latestApprovedSnapshotId`
-owskazywany `decisionCalculationRun.totalFinancialBenefits` [NIE Forecast
— niezmienny z konstrukcji], `null` gdy mianownik = 0; 2-powodowy typowany
slot re-używający `RoiCompareSlot` z `roiCompareRepository.ts`, nie
przepisany), `roiOrgPerspectiveRepository.ts`
(`buildScopedRoiCasesBase`/`listOrganizationRoiBenefitsRealization` —
dokładne lustro `kpiPerspectivesRepository.ts`'s `buildScopedKpisBase`,
`chain_members`/`scoped_cases` CTE, `resource_type='roi_case'`, filtr
statusu do `ROI_TRACKING_ACTIVE_STATUSES` wpieczony we wspólną bazę bo ten
plik ma JEDNEGO wywołującego, nie wieloraki orkiestrator jak plik KPI),
`roiPerspectives.routes.ts` (nowy dedykowany router, `GET
/org/benefits-realization`, `managerId` z tokena — nigdy od klienta).
**Changed**: `roi.routes.ts` (3 nowe trasy: `POST .../transitions/
start-benefits-realization` przez `mountTransitionRoute` — dokładnie ten sam
kształt co `startRoiCaseTracking`; `POST .../transitions/cancel` — NIE przez
`mountTransitionRoute` bo `reason` obowiązkowy wymaga własnego schematu, ten
sam wzorzec co `/transitions/reject`; `GET .../benefits-realization` — bez
ograniczenia statusu per D14, ten sam wzorzec co `GET .../compare`),
`resultsVnextRoiForecastActual.validators.ts` (`RoiCaseCancellationSchema`
= `RoiCaseTransitionSchema.extend({reason: wymagany string})`),
`atomicWrite.ts` (2 nowe klucze zdarzeń
`roi.benefits_realization_started`/`roi.case_cancelled` →
`['mywork_projection','finance_projection']`), `Gateway.ts` (montaż nowego
routera NA TYM SAMYM prefiksie `/api/vnext/results/roi` — sprawdzone
dosłownie, nie założone: `roi.routes.ts` nie ma ANI JEDNEGO gołego
top-level dynamicznego segmentu, każda jego trasa zaczyna się od literału
`/cases`, więc `/org/...` nie koliduje niezależnie od kolejności montażu;
zamontowany PRZED `roi.routes.ts` mimo to, dla spójności z konwencją
KPI-E005).

**AC-02 — dowiedzione realnym zamknięciem Initiative, nie skrótem SQL**:
`roiObligationsSurviveInitiativeClosure.realdb.test.ts` tworzy case ROI
(`start_roi_study`), startuje tracking (`track_roi_forecast_actuals`),
startuje benefits realization (`confirm_benefits_realization`), po czym
przepędza POWIĄZANĄ Initiative przez REALNY, produkcyjny workflow zamknięcia
(`createClosureRequest`→`addEvidence`×2→`submitClosureRequest`→
`approveClosureRequest` — te same eksportowane funkcje, które woła warstwa
HTTP `initiativeClosure.routes.ts`, wywołane bezpośrednio, nie przez
Express/supertest, ale wciąż realna ścieżka produkcyjna) aż do
`initiatives.status='DONE'`, po czym asercjuje wszystkie trzy obligacje
WCIĄŻ `status='open'`. **Napotkana i udokumentowana bramka SPOZA zakresu
tego epika**: `initiativeTransitionService.ts`'s gałąź EXECUTING→DONE
TERAZ (na tej gałęzi, po tym jak pisany był
`execution-closure-evidence-gate.golden-flow.realdb.test.ts`) wymaga
DODATKOWO aktualnej, zatwierdzonej `initiative_lifecycle_gate_decisions`
(`pmoDomain='CLOSURE'`) — mechanizm gubernacyjny T01/A05 zupełnie
niezwiązany z ROI. Przejście przez realne API (`recordInitiativeLifecycle
GateDecision`) wymagałoby pełnego łańcucha `transformation_cases`+
`v8_agent_proposal_versions`+`v8_agent_proposal_scope_reviews` — obce temu
epikowi. Zasiane wprost SQL-em jako fixture testu (nie zmiana kodu
produkcyjnego), udokumentowane w komentarzu testu. Ta tabela jest
NIEUSUWALNA triggerem `BEFORE UPDATE OR DELETE` (immutable by design) — test
cleanup świadomie NIE usuwa jej ani powiązanego łańcucha fixture'ów
(`initiatives`/`users`/`transformation_cases`/`v8_agent_proposal_*`),
udokumentowane w kodzie testu jako trwały, nieszkodliwy, unikalnie-otagowany
osad.

**AC-01 — dowiedzione dwoma wariantami tej samej transakcji, nie jednym**:
`roiBenefitsRealizationTransition.realdb.test.ts` buduje dwa case'y
tracking, jeden powiązany z Initiative pozostawioną `'EXECUTING'`, drugi z
Initiative bezpośrednio ustawioną SQL-em na `'DONE'` — oba przejścia
`startRoiCaseBenefitsRealization` kończą się identycznie sukcesem.

**AC-03/AC-05 — formuła i org-perspective dowiedzione przeciw wartościom
odczytanym z powrotem z bazy, nie zgadywanym**:
`roiBenefitsRealizationView.realdb.test.ts` (4 testy: not_yet_approved,
no_actual_recorded, dokładna formuła `(actual/approved)*100` przeciw
`decisionCalculationRun.totalFinancialBenefits` odczytanemu wprost z JSONB
snapshotu zatwierdzenia, `null` przy mianowniku=0 — potwierdzone, że silnik
faktycznie policzył 0, nie null, dla case'a bez linii korzyści finansowych).
`roiOrgBenefitsRealizationPerspective.realdb.test.ts` (2 testy: chain-scoping
+ PRIVATE non-leak lustro `organizationKpiAttention.realdb.test.ts`'s
własnego wzorca; AC-05 potwierdzone CZYTANIEM źródła
`roiOrgPerspectiveRepository.ts` po odsianiu komentarzy i asercją braku
sześciu nazw tabel legacy).

**AC-04 — dowiedzione porównaniem CAŁYCH wierszy, nie próbką kolumn**:
`roiCaseCancellation.realdb.test.ts` (3 testy: guard scope D7, `reason`
zapisany na evencie, oraz PEŁNE porównanie `SELECT *` z
`rvn_roi_actual_entries`/`rvn_roi_actual_snapshots` sprzed i po anulowaniu —
`toEqual` na całych wierszach, plus potwierdzenie że
`current_actual_snapshot_id` case'a nie został wyczyszczony).

**Testy**: 5 nowych plików w `tests/resultsVnext/roi/` (13 testów realDB) +
1 w `server/src/routes/resultsVnext/__tests__/` (15 testów mockowanych) =
**28 nowych testów, wszystkie PASS** na efemerycznym Postgresie 16
(`initdb --locale=C`, TCP `127.0.0.1:28470`, PEŁNY zestaw 811 migracji przez
`migrate.postgres.ts --safe` — nie minimalny 14/15-plikowy zestaw
poprzednich epików, bo `roiObligationsSurviveInitiativeClosure` potrzebuje
realnej tabeli `initiatives`/`initiative_closure_*`).

**Regresja — KPI 100% zielone (144/144), warstwa route'ów 100% zielona
(183/183, w tym 15 nowych)**. **ROI-E001…E004: 33 niepowodzenia w 15
plikach, WSZYSTKIE ten sam pojedynczy przedistniejący kod błędu
`initiatives_status_check`** — `initiatives.status DEFAULT 'step3'`
(`000_z_core_baseline.sql`) łamie własne ograniczenie CHECK (tylko
wielkoliterowe wartości enum: `DRAFT`/`EXECUTING`/`DONE`/...), już
udokumentowane w §33/§34 jako przedistniejąca luka. Te 15 plików (m.in.
`roiTrackingTransition.realdb.test.ts`, `roiVariance.realdb.test.ts`,
`roiVisibilityJoin.realdb.test.ts`) NIE ustawiają `status` przy `INSERT INTO
initiatives` (polegają na DEFAULT), więc walą się na KAŻDEJ w pełni
zmigrowanej bazie, niezależnie od tego epika — potwierdzone `git status`:
żaden z tych 15 plików, ani tabela `initiatives`, ani żadna migracja nie są
dotknięte przez ten epik. Własne testy tego epika (i wszystkie poprzednie
ROI-E004 testy odczytane jako wzorzec) ZAWSZE ustawiają `status` explicite —
stąd nietknięte. **Zero regresji przypisywalnej temu epikowi** — dowiedzione
identyfikacją wspólnego, jednego, przedistniejącego kodu błędu we
WSZYSTKICH 33 niepowodzeniach, nie zadeklarowane.

**`tsc --noEmit` clean na całym repo** (`NODE_OPTIONS=--max-old-space-size=
8192 npx tsc --noEmit`, root `tsconfig.json`).

**Poza zakresem, świadomie NIEZBUDOWANE (backlog notes per §5 designu)**:
- **D7 (cancellation z wcześniejszych statusów)**: `cancelRoiCase`
  celowo NIE obsługuje `draft`/`modeling`/`approved` — anulowanie case'a bez
  danych Actual nie ma żadnego związku z AC-04; ogólne "porzuć na dowolnym
  etapie" to inna, niezbudowana funkcja.
- **D9 (obligacje nie anulowane automatycznie)**: `cancelRoiCase` nie dotyka
  `rvn_platform_obligations` w ogóle — żadna AC tego nie nazywa, D5 już
  ustaliło że nic w tej domenie nie zarządza automatycznie statusem
  obligacji przy żadnym przejściu.
- **D13 (warianty cost/ROI-realization)**: `benefitsRealizationPct` liczy
  WYŁĄCZNIE financial benefits (AC-03 nazywa "realization %" w liczbie
  pojedynczej) — cost-realization/ROI-realization to spekulacyjny scope
  creep, tani do dobudowania identycznym wzorcem gdy realna potrzeba się
  pojawi.
- **Jawna flaga dla ROI-E006**: przejścia `benefits_realization`→
  `post_investment_review_due` i finalne `→closed` pozostają zadaniem
  ROI-E006 (PIR & Learning) — nie tknięte tutaj.

**Domena ROI: 5/8 epików zbudowanych (E001, E002, E003, E004, E005).
ROI-E006 PIR & Learning następny w kolejce.**

**`tsc --noEmit` clean na całym repo** (root `tsconfig.json`, nie
`server/tsconfig.json` — ten drugi ma przedistniejące błędy `decimal.js`
niezwiązane z tym epikiem, poza zakresem tego pliku konfiguracyjnego).

**Poza zakresem, świadomie NIEZBUDOWANE (backlog notes per §7 designu)**:
- **D11/D15 (odroczone, bez zmian od ROI-E003's D18)**: brak
  `reopenFromTrackingRoiCase` — teraz JESZCZE bardziej konsekwentna decyzja
  niż w E003 (realne dane Forecast/Actual/Variance teraz istnieją, więc
  pytanie "co się dzieje z istniejącymi danymi trackingu przy reopen"
  poważniejsze, nie mniej). Żadna z 6 AC tego epika tego nie nazywa.
- **D19**: brak typed KPI-evidence link na Actual entries — `evidence_refs
  JSONB` free-text, ten sam kształt co KPI measurements. Prawdziwa możliwa
  przyszła potrzeba (evidence_link do benefit line'a już daje KPI backing
  dla ZATWIERDZONEGO modelu), niezbudowana bo żadna AC jej nie nazywa.
- **D20**: brak przedłużenia horyzontu prognozy poza zatwierdzone okno —
  `analysisStart`/`analysisEnd`/`currency`/`granularity` forecast'u zawsze
  NIEZMIENIONE z wiersza case'a (Decyzja D7). Utrzymuje Approved/Forecast/
  Actual porównywalne na tej samej siatce okresów.
- **D14 (potwierdzenie granicy E004/E005, NIE decyzja tego epika — flaga dla
  projektującego ROI-E005)**: E004 posiada mechanikę Tracking/Forecast/
  Actual/Variance; E005 (Benefits Realization) posiada przejście
  `'tracking'→'benefits_realization'` i liczy "realization %" Z DANYCH TEGO
  EPIKA — nie buduje własnych nowych prymitywów Forecast/Actual/Variance.
  To WNIOSKOWANIE z listy AC E005 (niezależność od zamknięcia Initiative,
  obligacje przetrwają zamknięcie, realization % "z governed data"
  zakładają, że dane E004 już istnieją do liczenia z nich) — NIE
  bezpośrednio nazwane źródłowo. Jawnie oznaczone tutaj dla ROI-E005.

**Domena ROI: 4/8 epików zbudowanych (E001, E002, E003, E004). ROI-E005
Benefits Realization następny w kolejce.**

> DOKUMENTACYJNA USTERKA ZASTANA (nie moja, nie naprawiona tutaj): powyższe
> dwa akapity od "`tsc --noEmit` clean na całym repo" (linia ~2897) do końca
> pliku są DOSŁOWNYM DUPLIKATEM końcówki §34 (ROI-E004) — treść "Poza
> zakresem... D11/D15/D19/D20" opisuje decyzje ROI-E004, nie ROI-E005, mimo
> że siedzi fizycznie pod nagłówkiem "## 35." Nie numeracja koliduje (§0-§35
> unikalne, zweryfikowane `grep -oE '^## [0-9]+\.' | sort -n | uniq -d` =
> pusto) — to duplikacja TREŚCI wewnątrz jednej sekcji, prawdopodobnie
> wynik nieudanego scalenia z poprzedniej sesji. Zgłoszone jako osobne
> zadanie porządkowe (zobacz spawn_task tej sesji), nie naprawione tutaj —
> poza zakresem ROI-E006, ryzykowne przepisywanie cudzej historii bez
> pełnego kontekstu tamtej sesji.

## 36. ROI-E006 PIR & Learning — implementacja + odbiór (2026-08-10)

**Szósty i OSTATNI nowo-treściowy epik domeny ROI — zamyka pełny cykl życia
Case'a** (`benefits_realization → post_investment_review_due →
post_investment_review → closed`). Zbudowano `ROI_E006_DESIGN.md` §1-§9
dosłownie (design FROZEN, 19-wierszowa tabela Decisions D1-D19, w tym pięć
rozwiązanych open questions D15-D19). **Decyzja D5 — jedyny prawdziwy
architektoniczny pierwszy raz w tym programie**: `markRoiCasePostInvestment
ReviewDue` jest PIERWSZYM realnym wywołującym `completeObligation`
(`platform/obligations.ts`) w całym programie — funkcja istniała jako gotowy,
ale nigdy nie wywołany kontrakt od KPI-E003. Sygnatura potwierdzona
CZYTANIEM przed użyciem (`CompleteObligationParams`:
`organizationId`/`referenceType`/`referenceId`/`obligationType`/
`completedViaCommand`), nie zgadnięta.

**Nowe pliki**: `roiPirTypes.ts` (Row/DTO split + `RoiPirReviewSnapshotPayload`
— Decyzja D8: pointer IDs + zamrożona kopia compare/benefits-realization
view + wszystkich Variances, NIGDY pełny wielo-KB payload ApprovalSnapshot),
`roiPirCommands.ts` (6 komend: `scheduleRoiCasePostInvestmentReview` —
metadane doradcze, brak zmiany statusu, D3/D4; `markRoiCasePostInvestment
ReviewDue` — AC-01, D5's podwójny efekt obligacji; `startRoiCasePostInvestment
Review` — AC-02, zamraża snapshot NA STARCIE reviewera przez ponowne użycie
`getRoiCaseCompareView`/`getRoiCaseBenefitsRealizationView`/`listVariances`
dosłownie [nie przepisane]; `updateRoiPostInvestmentReviewDraft` — CAS na
WŁASNEJ wersji wiersza PIR, ten sam kształt co `updateVarianceStatus`;
`recordRoiPirTeresaDraftDisposition` — AC-06, literalny mechanizm: `'rejected'`
NIGDY nie dotyka `lessons_learned`; `closeRoiCase` — AC-03/D6, dokładna
kolejność kroków §4.6: guard statusu case'a → `SELECT...FOR UPDATE` aktywnego
draftu PIR → **odmowa self-close PRZED jakimkolwiek zapisem** →
brama open-variance z waiverem → brama kompletności PIR → finalize PIR →
`completeObligation` → zamknięcie case'a, wszystko na JEDNYM przypiętym
kliencie/transakcji `executeAtomicCommand`), `roiPirRepository.ts`
(`listRoiPostInvestmentReviews`/`getRoiPostInvestmentReview`, standardowy
join `resource_type='roi_case'` z obowiązkowym `::text`),
`resultsVnextRoiPir.validators.ts` (Zod, wzorzec ROI-E004/E005). **Changed**:
`roiOrgPerspectiveRepository.ts` (`buildScopedRoiCasesBase` rozszerzone o
OPCJONALNY trzeci parametr `statuses` z domyślną `ROI_TRACKING_ACTIVE
_STATUSES` — zachowuje istniejące wywołanie
`listOrganizationRoiBenefitsRealization` bez zmian, `listOrganizationRoiPir
Outcomes` przekazuje własny zestaw `('post_investment_review','closed')` —
Decyzja D14 dosłownie: ROZSZERZENIE, nie duplikat pliku), `roiPerspectives
.routes.ts` (`GET /org/pir-outcomes`), `roi.routes.ts` (8 nowych tras,
`handleRoiRouteError` +3 gałęzie: `RoiPirSelfCloseDeniedError`→403 przed
ogólnymi 409, `RoiPirNotFoundError`→404, `RoiPirValidationError`→409),
`atomicWrite.ts` (6 nowych kluczy zdarzeń — pięć do `['mywork_projection']`,
`roi.case_closed` do `['mywork_projection','finance_projection']` jak
`roi.case_approved`/`roi.case_cancelled`).

**Migracja**: `20260819_rvn_roi_pir_learning.sql` — jedna nowa tabela
`rvn_roi_post_investment_reviews`, dwustopniowy trigger zamrażający
(`rvn_roi_pir_protect_frozen`): fakty bezwarunkowe [`started_by`/
`started_at`/`review_snapshot_payload`/`review_snapshot_hash`/`case_id`/
`created_by`] zamrożone OD STWORZENIA; treść narracyjna [`outcome`/
`lessons_learned`/`recommendation`/`open_variance_waiver_reason`/
`teresa_draft_disposition`] zamrożona DOPIERO gdy `status='finalized'` —
`teresa_draft_lessons_payload`/`teresa_draft_generated_at` CELOWO NIE są na
liście finalized-lock (świadoma decyzja designu: przyszły wywołujący
ROI-E008 może potrzebować zapisać je niezależnie od własnego kroku finalize
tego epika) — DDL przepisane z §3 co do litery, zweryfikowane realnym
Postgresem (`\d rvn_roi_post_investment_reviews`, `psql` na efemerycznej
bazie), nie tylko odczytane z pliku. Zero `ALTER TABLE rvn_roi_cases` —
każda kolumna, do której ten epik pisze, była zarezerwowana od ROI-E001.

**AC-01 — dowiedzione realną obligacją, nie samym statusem**:
`roiPirScheduleAndDue.realdb.test.ts` (5 testów: guard scope schedule
[`'tracking'`/`'benefits_realization'` akceptowane, `'approved'` odrzucone],
guard mark-due [`'benefits_realization'` tylko], **D5's podwójny efekt**:
`confirm_benefits_realization` → `status='completed'`, nowa
`conduct_post_investment_review` → `status='open'`, `assignee_user_id`=
właściciel case'a, `due_at`=dokładnie `next_review_at` odczytane z powrotem z
bazy).

**AC-02 — dowiedzione mutacją NA ŻYWO po zamrożeniu, nie samym istnieniem
hash'a**: `roiPirStart.realdb.test.ts` (3 testy: guard, zamrożony payload
zgadza się z ręcznie zweryfikowanymi wartościami [pointer ID-ki + compare
view + benefits-realization view + jedna Variance zapisana PRZED startem],
**kluczowy test**: nowa Variance zapisana PO zamrożeniu NIE zmienia już
zapisanego `review_snapshot_hash`/`review_snapshot_payload` — potwierdzone
DWOMA niezależnymi odczytami tego samego wiersza [przed/po mutacji], plus
bezpośrednia próba `UPDATE` na zamrożonym polu odrzucona przez trigger DB
nawet POZA warstwą komend).

**AC-03 — dowiedzione WSZYSTKIMI czterema gałęziami bramy zamknięcia**:
`roiPirClose.realdb.test.ts` (6 testów: guard statusu case'a, blokada
open-variance bez waivera [`code: 'OPEN_VARIANCES_UNRESOLVED'`], waiver
pozwala zamknąć mimo open-variance, blokada niekompletnego PIR [`code:
'PIR_INCOMPLETE'`], **D6 self-close denial** [ten sam aktor co `started_by`
odrzucony, case zostaje `'post_investment_review'`], happy path z INNYM
aktorem: `completeObligation` faktycznie odpala
[`completed_via_command='closeRoiCase'`], `next_action_type`/
`next_action_due_at` wyczyszczone na `NULL`, `next_review_at` PRZETRWAŁ
zamknięcie niezmieniony [Decyzja D4 — rekord historyczny]).

**AC-04 (kluczowy dowód epika) — cold reopen przez GENUINE osobne połączenie,
nie ponowne zapytanie na tym samym kliencie**: `roiPirColdReopen.realdb.test.ts`
(1 test: finalizuje PIR, po czym odczytuje go z powrotem przez ŚWIEŻY `pg
.Client` [nowe połączenie TCP, nie ta sama sesja co zapis] — `review_snapshot
_hash` i `review_snapshot_payload` bajt-identyczne z tym, co zamrożone na
starcie reviewera; potwierdzone zarówno surowym SQL jak i realną funkcją
repozytorium `getRoiPostInvestmentReview`).

**METODOLOGICZNA PUŁAPKA znaleziona i udokumentowana (nie bug produkcyjny —
pułapka we WŁASNEJ metodologii testowej tego epika, naprawiona zanim
dotarła do jakiegokolwiek asercji)**: Postgres `jsonb` NIE zachowuje
oryginalnej kolejności kluczy JSON z tekstu podanego przy INSERT (dokumentacja
Postgresa: jsonb "does not preserve... the order of object keys"). Naiwny
test AC-04, który odczytałby payload z powrotem z `jsonb`, przeliczyłby
`computeStateHash` w JS na nowo i porównał z hashem policzonym PRZED
insertem, prawie na pewno by się NIE zgodził — nie dlatego, że coś jest
zepsute, ale dlatego, że JSON.stringify kolejność kluczy zależy od
konstrukcji obiektu w JS, a jsonb ma WŁASNĄ, znormalizowaną kolejność
wyjściową, inną. `startRoiCasePostInvestmentReview` liczy `review_snapshot
_hash` DOKŁADNIE RAZ, w JS, PRZED insertem, i zapisuje jako zwykłą kolumnę
TEXT właśnie dlatego, żeby to było nieistotne dla warstwy komend (hash NIGDY
nie jest przeliczany z powrotem z jsonb w kodzie produkcyjnym). Testy tego
epika trzymają tę samą dyscyplinę: porównują DWA ODCZYTY tego samego już
zapisanego, chronionego triggerem wiersza [w chwili zamrożenia vs. cold
reopen] — nigdy świeże przeliczenie hash'a z payloadu odczytanego z
Postgresa vs. wartość oryginalna sprzed insertu. Udokumentowane w nagłówku
`roiPirColdReopen.realdb.test.ts`.

**AC-05 — dowiedzione chain-scopingiem I czytaniem wygenerowanego SQL**:
`roiOrgPirOutcomes.realdb.test.ts` (2 testy: manager widzi zamknięty case
bezpośredniego podwładnego, case w trakcie [`status='post_investment_review'`,
`pirOutcome: null`] też widoczny [design §6: zakres obejmuje OBA statusy],
case niepowiązanego właściciela NIEwidoczny, portfolioTotals liczy WYŁĄCZNIE
zamknięte case'y w łańcuchu; drugi test woła `buildScopedRoiCasesBase`
bezpośrednio i asercjuje brak wszystkich sześciu nazw tabel legacy w
wygenerowanym tekście SQL — czytanie źródła, nie zgadywanie).

**AC-06 — dowiedzione dokładnym scenariuszem z designu**:
`roiPirTeresaDisposition.realdb.test.ts` (5 testów: `'rejected'` zostawia
ISTNIEJĄCĄ wartość `lessons_learned` KOMPLETNIE nietkniętą [nie tylko `null`
pozostaje `null` — realna wcześniej zapisana treść przetrwała], `'accepted'`
i `'edited_then_accepted'` OBA kopiują `finalLessonsText` do autorytatywnej
kolumny, `disposition≠'rejected'` bez `finalLessonsText` odrzucone
[`FINAL_LESSONS_TEXT_REQUIRED`], guard `status==='draft'`, surowy `UPDATE`
na `teresa_draft_disposition` po finalize odrzucony przez trigger).

**`::text` cast**: `roiPirVisibilityJoin.realdb.test.ts` (2 testy: właściciel
case'a widzi PIR przez obie funkcje odczytu; outsider bez grantu ACL na
case'ie w trybie `PRIVATE` [najsurowsza gałąź] widzi ZERO wierszy PIR mimo
że wiersz REALNIE istnieje w bazie — sanity-check potwierdza że join jest
faktycznie load-bearing, nie no-opem, który przeszedłby nawet bez castu).

**Testy**: 7 nowych plików realDB w `tests/resultsVnext/roi/` (24 testy) + 1
plik pomocniczy fixture NIE-testowy (`roiPirRealdbFixtures.ts` — świadome
odejście od konwencji "każdy plik realDB duplikuje własny setup": do tego
epika łańcuch "zbuduj case do statusu X" ma już DZIESIĘĆ komend głębokości
przez pięć poprzednich epików, więc powielenie go siedem razy byłoby ~1000
linii czystego kopiuj-wklej; udokumentowane w nagłówku pliku) + 1 w
`server/src/routes/resultsVnext/__tests__/` (26 testów mockowanych) =
**50 nowych testów, wszystkie PASS** na efemerycznym Postgresie 17
(`initdb --locale=C`, TCP `127.0.0.1:55440`, PEŁNY zestaw migracji przez
`migrate.postgres.ts` [bez `--safe`] — ten sam "pełny, nie minimalny" zestaw
co ROI-E005; `pgvector` wymagał Postgresa 15/17/18 — Postgres 16 z Homebrew
NIE ma zbudowanego rozszerzenia `vector`, przełączono na 17 po jednym
nieudanym `initdb`, udokumentowane jako środowiskowe odkrycie tej sesji, nie
błąd produkcyjny).

**Deviation (test-only, znaleziona i naprawiona podczas pisania testów, nie
błąd produkcyjny)**: `recordVariance` (prawdziwa komenda) wymaga ŻYWEGO
Forecast LUB Actual snapshotu do policzenia `comparisonType`, którego żaden
z łańcuchów fixture'ów tego epika nie tworzy (epik zaczyna się jeden krok ZA
`'tracking'`, nigdy nie publikuje Forecast/Actual). `roiPirStart.realdb
.test.ts`/`roiPirClose.realdb.test.ts` używają zamiast tego surowego
`INSERT INTO rvn_roi_variances` (`insertRawVariance` w pliku fixture) — testy
tego epika potrzebują tylko ISTNIENIA wiersza Variance, nie pełnej semantyki
`recordVariance`; udokumentowane w komentarzu funkcji fixture.

**Regresja — dowiedzione `git stash -u` PRZED/PO na tej samej efemerycznej
bazie, ten sam pełny zestaw `tests/resultsVnext` + `server/src/routes/
resultsVnext/__tests__`**: PRZED (bez kodu ROI-E006): 21 plików / 33 testy
failed, 371 passed, 13 skipped (417 razem). PO (z kodem ROI-E006): 21 plików
/ 33 testy failed [DOKŁADNIE te same], 421 passed [+50, wszystkie nowe], 13
skipped (467 razem). Wszystkie 33 niepowodzenia to ten sam przedistniejący
`initiatives_status_check` już udokumentowany w §33/§34/§35
(`initiatives.status DEFAULT 'step3'` łamie własne ograniczenie CHECK) —
żaden z 21 nietkniętych plików nie ma związku z ROI-E006. **Zero regresji
przypisywalnej temu epikowi** — dowiedzione identycznością liczby
niepowodzeń PRZED/PO, nie zadeklarowane.

**`tsc --noEmit` clean**: root `tsconfig.json` (frontend, wyklucza `server/`)
— 0 błędów, czysto. `server/tsconfig.json` — 28 błędów, WSZYSTKIE w
`roiCalculationEngine.ts` (typowanie `decimal.js`), potwierdzone
IDENTYCZNE PRZED/PO przez `git stash -u` (`diff` dwóch przebiegów pusty) —
przedistniejące, niezwiązane z tym epikiem, plik nietknięty przez ROI-E006.

**Poza zakresem, świadomie NIEZBUDOWANE (backlog notes per §10 designu)**:
- **D16 (brak cross-case Learning entity)**: "Learning" rozwiązuje się do
  własnego pola narracyjnego PIR plus governed portfolio-metrics rollup —
  żaden istniejący wzorzec "biblioteki lekcji" nie istnieje nigdzie w
  `resultsVnext`; spekulacyjna cross-case knowledge base to inna, niezbudowana
  funkcja, jeśli produktowa intencja rzeczywiście tego wymaga — nazwane
  wprost jako luka, nie milcząco założone.
- **D19 (brak roli PMO/governance napędzającej AC-01)**: właściciel case'a
  sam obsługuje `schedule`/`mark-due` — warstwa governance PMO (lustrząca
  `initiative_lifecycle_gate_decisions` odkrytą przez ROI-E005) to
  materialnie większa, nienazwana integracja, żadna AC jej nie wymaga.
- **D13 (generacja Teresy odroczona do ROI-E008)**: ten epik dostarcza
  WYŁĄCZNIE kształt danych odbiorczych (`teresa_draft_lessons_payload`,
  kolumny dyspozycji) i bramę dyspozycji (AC-06) — ROI-E008 (Teresa/Legacy/
  Ops) jest właścicielem realnego wywołania generacji, ten sam wzorzec co
  `freezeRoiBaseline` między ROI-E001 a ROI-E003.
- **Brak ścieżki reopen z `post_investment_review`/`closed`**: żadna AC tego
  epika tego nie nazywa; case zamknięty pozostaje zamknięty.

**Domena ROI: 6/8 epików zbudowanych (E001, E002, E003, E004, E005, E006).
Cała mechanika backendu ROI-E001…E006 domknięta. ROI-E007 Finance/KPI Seams
następny w kolejce — epik integracyjny [pinned koperta, zero-nadpisania,
reconciliation record, typed KPI evidence, freshness event bez auto-
-propagacji wartości], nie nowa treść domenowa jak E001-E006.**

## 37. Follow-up domknięty: `initiatives.status` DEFAULT 'step3' (2026-08-10)

Naprawa zgłoszonego w §30 defektu: `000_z_core_baseline.sql:264` ustawiał
`status TEXT DEFAULT 'step3'`, a `20260624_initiative_status_normalize.sql`
zakłada `initiatives_status_check`, który 'step3' odrzuca — każdy `INSERT
INTO initiatives` pomijający kolumnę `status` na świeżo zmigrowanej bazie
padał. Potwierdzony REALNY (nie tylko testowy) tor produkcyjny cierpiący na
to: `onboardingService.ts` (AI-onboarding funnel, LIVE path,
`INITIATIVE_FUNNEL_ENABLED` domyślnie off) buduje `INSERT INTO initiatives`
całkowicie pomijając `status`.

**Naprawa**: nowa migracja `20260810_fix_initiatives_status_default.sql` —
`ALTER TABLE initiatives ALTER COLUMN status SET DEFAULT 'DRAFT'` (ten sam
stan, do którego F1.12 backfilluje nieprawidłowe dane, i ten sam, którego
jawnie używa reszta callerów w kodzie). Przy okazji ujednolicony martwy
budowniczy schematu w `PostgresDatabase.ts` (`CREATE TABLE IF NOT EXISTS
initiatives` z tym samym przestarzałym DEFAULT — no-op wobec realnego
zmigrowanego schematu, ale usunięty dla spójności).

**Druga, wcześniej ZAMASKOWANA usterka wykryta przy naprawie**: 3
przedistniejące testy z §30 (`kpiIdentityAcrossSurfaces`,
`initiativeKpiImpactBaselineFreeze`,
`kpiInitiativeImpactPerspectivesRoutesRealdb` — wszystkie `.realdb.test.ts`)
po naprawieniu DEFAULT nadal failowały, ale na INNYM błędzie:
`initiatives_organization_id_fkey` — te fixture'y nigdy nie wstawiały swojego
`ORG_ID` do `organizations` przed insertem do `initiatives`. CHECK constraint
maskował ten błąd, bo INSERT padał wcześniej. Naprawione tym samym wzorcem,
którego już używa `legacyIsolation.realdb.test.ts` w tym samym katalogu
(`INSERT INTO organizations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`
przed INSERT INTO initiatives, plus symetryczny DELETE w `afterAll`).

**Weryfikacja**: efemeryczny Postgres 17 (`initdb --locale=C`, TCP,
`NODE_ENV=test`), pełny `npm run db:migrate` (596 plików, zero błędów),
`information_schema.columns` potwierdza DEFAULT teraz `'DRAFT'`, gołe
`INSERT INTO initiatives` bez `status` teraz się udaje z `status='DRAFT'`.
Cały katalog `tests/resultsVnext/kpi/` (16 plików) — **151/151 PASS, 0
skip, 0 fail** (poprzednio 146 PASS + 5 skip, 3 pliki failujące w
`beforeAll` per §30). Zero regresji w pozostałych 13 plikach.

## 38. ROI-E007 Finance/KPI Seams — implementacja + odbiór (2026-08-10)

**Siódmy epik domeny ROI — integracyjny seam, deliberately mniejszy niż
E001-E006** (design §0 nazywa to wprost: "Integration-seam epic, not new
domain content"). `docs/product/results-vnext/ROI_E007_DESIGN.md` (FROZEN,
7-wierszowa tabela Decisions D1-D7, §9.6 implementation-plan literalny
kształt API).

**Poprzednia próba przerwana — czysty retry, nie kontynuacja.** Wejściowy
`git status --short` pokazywał CZTERY nieweryfikowane, nieocommitowane pliki
pozostawione przez martwego agenta z wcześniejszej sesji: migrację
(`20260820_rvn_roi_finance_seam.sql`), `roiFinanceSeamTypes.ts`,
`roiFinanceLinkCommands.ts`, `roiFinanceReconciliationCommands.ts`. Każdy
przeczytany w całości i skonfrontowany KRYTYCZNIE z designem oraz z
AKTUALNYM stanem sześciu wcześniejszych epików (nie założono poprawności z
samego faktu istnienia) — wynik: wszystkie cztery poprawne, DDL migracji
kopiuje §3 designu dosłownie (zweryfikowane `\d` na realnej efemerycznej
bazie), command layer używa dokładnie tego samego szablonu
`assertCaseEditableForUpdate`/`NON_EDITABLE_STATUSES` co
`roiScenarioCommands.ts`/`roiBenefitEvidenceLinkCommands.ts`, event
fan-out zgodny z Decyzją D1. Zatrzymane bez zmian, dokończone o resztę
epika zamiast przepisane od zera.

**Nowe pliki**: `roiFinanceLinkRepository.ts` (jedyny z §7 file list,
którego martwy agent NIE zdążył stworzyć — `listRoiFinanceLinks`/
`getRoiFinanceLink`/`listRoiFinanceReconciliations`/
`getRoiFinanceReconciliation`, standardowy `case_id`→
`resource_type='roi_case'` join, obowiązkowy `::text` cast, dokładny
szablon `roiVarianceRepository.ts`). **Changed**:
`roiEconomicModelRepository.ts` — `isStale: boolean | null` dopisane do
istniejącego DTO `RoiBenefitEvidenceLinkWithKpiDetails` (ROI-E002 D14
hydration), liczone przez join do `rvn_kpi_definitions
.current_definition_version_id` WYŁĄCZNIE przy odczycie, `null` (nie
`false`) gdy `hydrateKpiDetails=false` lub KPI niewidoczne — traktowane
jako treść KPI dla celów widoczności, ta sama brama co `kpiDetails`; nowa
`listRoiEvidenceLinksByKpi` (Decyzja D2) — odwrotny odczyt KPI→ROI,
zewnętrzna warstwa widoczności to `roi_case` (wiersze linków), wewnętrzna
to widoczność POJEDYNCZEGO znanego `kpiId` (kpiDetails/isStale).
`roiBenefitEvidenceLinkCommands.ts` — `flagEvidenceLinkFreshnessCheck`
(Decyzja D7) dopisana na końcu pliku, `executeAtomicCreate` (NIE CAS —
`FreshnessCheckSchema` to "pusty" body bez `expectedVersion`, ten sam
rationale co `verifyActualEntry` z ROI-E004: rekord zablokowany `FOR
UPDATE` wewnątrz jednej transakcji, brak potrzeby optymistycznej CAS dla
akcji potwierdzenia bez realnego ryzyka lost-update), ustawia WYŁĄCZNIE
`freshness_checked_at`/`row_version`/`updated_at`, zero odczytu/zapisu
jakiejkolwiek innej kolumny czy tabeli. `roi.routes.ts` (5 nowych tras,
`handleRoiRouteError` +2 gałęzie: `RoiFinanceLinkNotFoundError`/
`RoiFinanceReconciliationNotFoundError`→404,
`RoiFinanceReconciliationValidationError`→409).
`resultsVnextRoi.validators.ts` (4 nowe schematy body + 3 nowe schematy
parametrów ścieżki — `RoiFinanceLinkParamsSchema`/
`RoiFinanceReconciliationParamsSchema` dopisane obok istniejącego
`RoiApprovalSnapshotParamsSchema`). `atomicWrite.ts` (6 nowych kluczy
zdarzeń: `roi.finance_link_created`/`roi.finance_link_removed`/
`roi.finance_reconciliation_opened`/`roi.finance_reconciliation_resolved`
→ `['mywork_projection','finance_projection']`, dokładnie ten sam wzorzec
co `roi.case_approved`/`roi.case_closed` z wcześniejszych epików;
`roi.finance_reconciliation_status_updated`/
`roi.evidence_link_freshness_flagged` → `['mywork_projection']` — Decyzja
D1's literalny podział terminal/non-terminal).

**Weryfikacja PRZED implementacją reszty**: `RoiBenefitEvidenceLink`'s
`freshness_checked_at` już istniała jako kolumna od ROI-E002 (potwierdzone
czytaniem `roiEconomicModelTypes.ts`) — ALE design's własne stwierdzenie
"first real writer beyond the initial insert" jest NIEŚCISŁE:
`flagBenefitEvidenceLinkDisputed` (ROI-E002, istniejący kod) już pisze do
tej kolumny przy każdym disputed-flag. Udokumentowane jako drobna
nieścisłość designu, nie błąd implementacji — `flagEvidenceLinkFreshnessCheck`
zbudowana jako OSOBNA komenda (nie rozszerzenie `flagBenefitEvidenceLinkDisputed`)
dokładnie jak design nakazuje, tylko komentarz w kodzie skorygowany, żeby
nie powtarzać nieścisłego stwierdzenia.

**AC-01 pełna pinned koperta** — dowiedzione bezpośrednim testem:
`roiFinanceLink.realdb.test.ts` asercjuje KAŻDE pole z §3 DDL na zwróconym
DTO (`financeArtifactType`/`financeArtifactId`/`financeVersionId`/
`mappingVersion`/`source`/`semanticUnit`/`currency`/`linkPurpose`/
`linkedBy`/`rowVersion`).

**AC-02 zero nadpisania w obu kierunkach** — dowiedzione DWOMA drogami: (a)
AC-02 grep gate uruchomiony REALNIE, nie tylko zadeklarowany:
`grep -rn "financial_roi_links\|financial_models\|financial_statement"
server/src/services/resultsVnext/roi/` → **zero trafień** (dowód literalny
w raporcie końcowym); (b) `roiFinanceLink.realdb.test.ts`'s Decyzja D4 test
— link do sfabrykowanego `financeArtifactId`/`financeVersionId` (losowe
UUID, nigdy nieistniejące w żadnej tabeli) przyjęty BEZ błędu.

**AC-03 reconciliation record zamiast silent sync** — dowiedzione
`roiFinanceReconciliation.realdb.test.ts` (6 testów): rekord tworzy się z
`status='open'`, walidacja że `financeLinkId` należy do case'a
(`RoiFinanceLinkNotFoundError` na sfabrykowanym id), CAS na WŁASNEJ wersji
rekordu (stale `expectedVersion` → `AtomicWriteConflictError`),
`resolvedBy`/`resolvedAt` ustawiane WYŁĄCZNIE przy przejściu terminal, i —
literalny dowód Decyzji D1 — bezpośredni odczyt `rvn_platform_outbox`
potwierdza że przejście do `'investigating'` fanuje TYLKO do
`mywork_projection`, a przejście do `'resolved'`/`'accepted_divergence'`
DODATKOWO do `finance_projection`.

**AC-04 typed KPI evidence zamiast luźnego FK** — dowiedzione
`roiEvidenceLinksByKpi.realdb.test.ts` (4 testy, ten sam dwuwarstwowy
wzorzec widoczności co ROI-E002's `roiEconomicModelVisibilityJoin
.realdb.test.ts`, zastosowany do KIERUNKU ODWROTNEGO): grantee (ACL na
case ORAZ na KPI) widzi pełny wiersz z `kpiDetails`/`isStale`; case-only
viewer (ACL na case, BEZ ACL na KPI) widzi wiersz linku [własne metadane
zawsze widoczne] ale `kpiDetails: null`/`isStale: null`; outsider (BEZ ACL
na żadnym) widzi ZERO wierszy, nawet metadanych linku; nieistniejący
`kpiId` zwraca pustą listę, nie błąd.

**AC-05 freshness event bez auto-propagacji wartości** — dowiedzione
`roiEvidenceLinkFreshness.realdb.test.ts` (5 testów) DWOMA niezależnymi
drogami: (a) behawioralnie — `isStale` poprawnie `false`→`true` po
podmianie `current_definition_version_id` KPI (test-only shortcut:
surowy drugi wiersz `rvn_kpi_definition_versions` + surowy UPDATE
`current_definition_version_id`, udokumentowany w nagłówku pliku jako
świadome odejście od pełnego łańcucha `submitDefinition`/
`approveDefinitionVersion`, nieistotnego dla tego, co test dowodzi),
`pinnedKpiDefinitionVersionId` na samym linku NIETKNIĘTE, `isStale`
resolves do `null` (nie `false`) gdy `hydrateKpiDetails=false`, i —
kluczowy test — wywołanie `flagEvidenceLinkFreshnessCheck` NIE zmienia
`isStale` (potwierdzenie nieświeżości nie "naprawia" jej, dokładnie
literalne brzmienie AC-05); (b) statycznie — dedykowany test czyta
WŁASNY kod źródłowy `flagEvidenceLinkFreshnessCheck` (od jej deklaracji do
końca pliku) i asercjuje ZERO wystąpień `UPDATE rvn_kpi_\w*` regexem —
design §7's literalny wymóg DoD, nie interpretacja.

**`::text` cast**: zweryfikowany na WSZYSTKICH czterech nowych funkcjach
odczytu (`listRoiFinanceLinks`/`getRoiFinanceLink`/
`listRoiFinanceReconciliations`/`getRoiFinanceReconciliation` w
`roiFinanceLinkRepository.ts`) oraz na obu ścieżkach
`roiEconomicModelRepository.ts` (`listBenefitEvidenceLinks`'s
rozszerzenie + nowa `listRoiEvidenceLinksByKpi`) — każdy test realDB
powyżej wykonuje realny join, żaden Postgres 42883 nie wystąpił.

**Testy**: 4 nowe pliki realDB w `tests/resultsVnext/roi/` (20 testów:
5+6+5+4) + 1 nowy plik mockowany w
`server/src/routes/resultsVnext/__tests__/` (18 testów) = **38 nowych
testów, wszystkie PASS** na efemerycznym Postgresie 17
(`initdb --locale=C`, TCP `127.0.0.1:28733`, PEŁNY zestaw migracji przez
`migrate.postgres.ts` [bez `--safe`], rozszerzenie `vector` i `pgcrypto`
utworzone jawnie przed migracjami — ten sam "pełny, nie minimalny" zestaw
co ROI-E005/E006).

**Dwie realne usterki środowiska testowego znalezione podczas pisania
testów, naprawione we WŁASNYCH fixture'ach tego epika (nie w kodzie
produkcyjnym)**: (1) `initiatives` na pełnej zmigrowanej bazie ma FK do
`organizations` (dodany gdzieś w 129-commitowej historii tej gałęzi) —
każdy nowy fixture builder tego epika insertuje `organizations` PRZED
`initiatives` (`ON CONFLICT (id) DO NOTHING`, ten sam wzorzec co §37
własna naprawa trzech plików KPI). (2) `createRoiCase` insertuje razem z
case'em wiersz `rvn_roi_baselines` ORAZ `rvn_roi_calculation_policy` —
`afterAll` cleanup każdego nowego pliku testowego usuwa oba PRZED
usunięciem `rvn_roi_cases` (FK), inaczej niż starszy szablon
`roiVariance.realdb.test.ts`, który tego nie potrzebował (inny łańcuch
fixture).

**Regresja — dowiedzione PRZED/PO `git stash` SUROWYM, per-plik (TYLKO
plików tego epika wymienionych w §7 designu, NIGDY `-u` — to zabrałoby też
nieocommitowane pliki innej, równoległej sesji w tym samym worktree:
`EXECUTION_LEDGER.md`/`PostgresDatabase.ts`/3 pliki KPI/migrację §37,
żadnego z nich ten epik nie dotyka)**, na TEJ SAMEJ efemerycznej bazie,
ten sam pełny zestaw `tests/resultsVnext` + `server/src/routes/
resultsVnext/__tests__`: PRZED (bez kodu ROI-E007, 4 pliki martwego agenta
tymczasowo przeniesione poza drzewo): 20 plików / 36 testów failed, 423
passed, 8 skipped (467 razem). PO (z kodem ROI-E007): 20 plików / 36
testów failed [`diff` list nazw testów PRZED/PO — pusty, identyczne],
461 passed [+38, wszystkie nowe], 8 skipped (505 razem). Wszystkie 36
niepowodzeń to PRZEDISTNIEJĄCY `initiatives_organization_id_fkey` w
piętnastu plikach realDB z ROI-E001…E004 (ta sama klasa usterki, którą §37
naprawiło w trzech plikach KPI, ale NIE w plikach ROI — poza zakresem
tego epika, żaden z 20 niepowodzących plików nie jest plikiem tego
epika) + 1 niezwiązany plik KPI-Teresa. **Zero regresji przypisywalnej
temu epikowi** — dowiedzione identycznością LIST NAZW testów PRZED/PO
(nie tylko liczby).

**`tsc --noEmit` clean**: root `tsconfig.json` — 0 błędów, czysto (i PRZED,
i PO). `server/tsconfig.json` — 18 błędów, WSZYSTKIE w
`roiCalculationEngine.ts` (typowanie `decimal.js`), IDENTYCZNE PRZED/PO
tym samym stash-porównaniem, plik CAŁKOWICIE nietknięty przez ROI-E007
(potwierdzone `git status --short` na ścieżce pliku — pusto). Liczba (18)
różni się od `28` odnotowanych w §36 dla tego samego pliku — to stan
`decimal.js`/pliku na TYM MOMENCIE gałęzi (129 commitów, wielosesyjna
historia), nie regresja wprowadzona przez ten epik; dowód "zero regresji"
opiera się na identyczności PRZED/PO w TEJ SAMEJ sesji, nie na zgodności z
liczbą z innej, wcześniejszej sesji.

**Poza zakresem, świadomie NIEZBUDOWANE (backlog notes per designu §7)**:
- **D3 (brak composed `GET .../finance-envelope` rollup endpoint)**: §9.6
  nie wymienia takiego endpointu, żaden AC go nie wymaga; istniejące
  odczyty per-case (approval snapshot, benefits-realization view, PIR) już
  pokrywają "zamrożoną, wiarygodną figurę ROI" po nadaniu roli Finance
  capability `roi_case.view` przez istniejący RBAC override. Budować
  dopiero gdy pojawi się potwierdzony konsument.
- **D5 (brak `finance_projection` outbox consumer)**: potwierdzone zero
  konsumentów w całym kodzie; `outboxDrain.ts`'s własny nagłówek jawnie
  instruuje "DO NOT build this now — documented for the next package that
  does". Ten epik jest wyłącznie pull-based — zdarzenia `roi.*` tagowane
  `finance_projection` piszą się dalej (od ROI-E003), gotowe na moment gdy
  zespół Finance zbuduje własny konsument.
- **D2's honest caveat**: `listRoiEvidenceLinksByKpi` może być redundantna
  względem tego, co ROI-E002 już dostarczyła po stronie zapisu (typed FK
  `kpi_id`/`pinned_kpi_definition_version_id` na
  `rvn_roi_benefit_evidence_links`) — zbudowana bo tania i niskiego ryzyka,
  zamyka realną lukę w obu interpretacjach, ale NIE przedstawiona jako
  pewny wymóg. Flaga do potwierdzenia przy następnym przeglądzie designu,
  nie milcząco założona za pewnik.

**Domena ROI: 7/8 epików zbudowanych. ROI-E008 Teresa/Legacy/Ops następny i
OSTATNI epik domeny ROI.**

## 39. ROI-E008 Teresa/Legacy/Ops — implementacja + odbiór, 8/8 domena ROI ZAMKNIĘTA (2026-08-10)

**Ósmy i OSTATNI epik domeny ROI.** `docs/product/results-vnext/
ROI_E008_DESIGN.md` (FROZEN, 17 decyzji D1-D17, D12-D17 rozwiązują
6 otwartych pytań draftu). Backend only; UI Registry to RN-G2, poza
zakresem.

**Poprzednia próba przerwana bez commitu — czysty retry, nie kontynuacja.**
Wejściowy `git status --short` pokazał KOMPLETNY, ale nieocommitowany
kod obu połówek (Half A Teresa + Half B Legacy/Ops) pozostawiony przez
martwego agenta z wcześniejszej sesji (padnięcie sieci w trakcie pracy,
nie błąd logiczny). Każdy plik przeczytany w całości i skonfrontowany
KRYTYCZNIE, zdanie po zdaniu, z designem — nie założono poprawności z
samego faktu istnienia (ta sama dyscyplina co §38 dla ROI-E007). Wynik:
cały odziedziczony kod poprawny i zgodny z designem co do joty, WŁĄCZNIE
z `P08_ROI_FORBIDDEN_VERBS` (55 zablokowanych verbs) — zweryfikowane
bezpośrednim re-grepem `grep -nE "^export (async )?function [a-zA-Z]+"
server/src/services/resultsVnext/roi/*Commands.ts roiEconomicModelFreeze
.ts` przeciw liście w kodzie: **identyczny zestaw**, żaden verb nie
brakuje, żaden nie jest nadmiarowy, wyłączenia pure-helperów
(`isRoiCaseReadyForReviewEligible`/`toDateOnlyString`/itd.) uzasadnione
i poprawne.

**Jedna realna luka znaleziona i naprawiona: brakujący event type w
`atomicWrite.ts`.** Zadanie z góry oznaczyło to jako PODEJRZANĄ lukę do
zweryfikowania — potwierdzona. `EVENT_TYPE_CONSUMER_GROUPS` (design §2/A2
buduje event `roi.pir_teresa_lessons_draft_recorded` w
`recordRoiPirTeresaLessonsDraft`) nie miał wpisu dla tego klucza —
niezarejestrowany event type degraduje się CICHO do pustego outbox
fan-out (tylko zalogowane ostrzeżenie, `resolveConsumerGroups` nie
rzuca), więc to NIE zawiodłoby głośno samo z siebie. Naprawione: dopisany
wpis `'roi.pir_teresa_lessons_draft_recorded': ['mywork_projection']`,
ta sama klasyfikacja advisory/in-flight-metadata co sąsiedni
`roi.pir_teresa_draft_disposition_recorded` (ROI-E006). Zweryfikowane, że
to JEDYNY nowy event type tego epika — Half B (legacy archive) jest
GET-only, zero zapisów, zero eventów.

**Half A — Teresa integration (AC-01/02/03).** `teresaCopilotCanon.ts`:
`ResultsRoiAdvisorMode`/`ResultsRoiHandoffContext`/
`RoiPirLessonsDraftPayload` (jeden governed mode: `pir_lessons_draft`),
`P08_HANDOFF_TARGETS.roi`, `P08_HANDOFF_TARGET_MODULES` +`'roi'`,
`P08_ROI_FORBIDDEN_VERBS` (55 verbs, re-derived per D16). Migracja
`20260821_rvn_roi_pir_teresa_draft_freeze.sql` (`CREATE OR REPLACE
FUNCTION` na `rvn_roi_pir_protect_frozen()`, bez `DROP`/`CREATE TRIGGER`)
zamraża `teresa_draft_lessons_payload`/`teresa_draft_generated_at` po
finalizacji PIR (D8) — zweryfikowana na realnej efemerycznej bazie.
`roiPirCommands.ts`: nowy eksport `recordRoiPirTeresaLessonsDraft` —
CAS-guarded, kolejność guardów (case_id match → status='draft' →
`teresa_draft_disposition IS NULL` D6/D13), `UPDATE ... SET` klauzula
pisze WYŁĄCZNIE `teresa_draft_lessons_payload`/`teresa_draft_generated_at`/
`row_version`/`updated_by`/`updated_at` — nigdy `lessons_learned` (AC-03
literalny dowód, statyczny regex test). `teresaCopilotService.ts`:
`buildRoiPirLessonsAdvisorContext` (AC-01 — czyta zamrożony
`review_snapshot_payload`/`review_snapshot_hash`, nigdy live re-query),
`performHandoff`'s `case 'roi':`, `undoProposal`'s `P08_UNDO_NOT_SUPPORTED`
blok (D7). **Udokumentowane odejście od designu, poprawne**: A2's własny
przykład typuje zwrotny kształt `buildRoiPirLessonsAdvisorContext` przez
NAZWANY import `RoiPirReviewSnapshotPayload` z `roiPirTypes.js` — zrobione
dosłownie dodałoby TRZECI `from '../resultsVnext/roi/...'` import, co
złamałoby A3's własny statyczny dowód ("dokładnie 2 linie importu, nic
więcej"). Odziedziczony kod rozwiązuje to strukturalnie
(`NonNullable<Awaited<ReturnType<typeof getRoiPostInvestmentReview>>>`),
identyczny typ, inna ścieżka wyprowadzenia — zweryfikowane jako poprawne,
nie obejście.

**Half B — Legacy/Ops (AC-04/05).** `roiLegacyArchive.routes.ts` (15 tras
GET-only: 1 index + 7 tabel × list/get), `denyMutations` PIERWSZY w
łańcuchu middleware (przed auth/rate-limit), dokładnie skopiowany kształt
z rzeczywiście wylądowanego `kpiLegacyArchive.routes.ts` (Express 5
`router.use(denyMutations)`, nie `router.all('*', ...)` z ilustracyjnego
pseudokodu designu). `roiLegacyArchiveRepository.ts` (7 tabel, nazwy
tabel NIGDY interpolowane z argumentu runtime). `resultsVnextRoiLegacy
.validators.ts` (permisywny non-UUID `legacyId` — kilka PK to TEXT, nie
UUID). **Dwie realne dewiacje znalezione na prawdziwym Postgresie,
udokumentowane w nagłówkach plików, przeze mnie zweryfikowane jako
prawdziwe**: (1) `analysis_financials`/`digitization_analyses` mają
`organization_id` typu **INTEGER**, nie TEXT jak `organizations.id` —
potwierdzone bezpośrednio w `068_economics_analysis_financials.sql`
(`organization_id INTEGER NOT NULL`) i `060_digitization_analyses.sql`
(to samo) — repozytorium rzutuje `::text` zamiast wiązać bezpośrednio;
(2) `v8_roi_realization_entries` odpytywana bez kwalifikacji schematu
(D9) — istnieje w `public.` I `v8.`, dopasowuje się do `search_path`
żywego pisarza (`resultsROIService.ts:501`). Gateway.ts: montaż
`/api/vnext/results/roi/legacy` PRZED generycznym `/api/vnext/results/
roi` (ten sam porządek co KPI-E007). `metricsService.ts`: jeden nowy
licznik `resultsVnextRoiLegacyArchiveHitsTotal`.

**Testy — 84 nowe, wszystkie PASS na efemerycznym Postgresie 17
(`initdb --locale=C`, TCP `127.0.0.1:28461`, pełny zestaw migracji przez
`migrate.postgres.ts` bez `--safe`).** `teresa-roi-forbidden-verbs.test.ts`
(7): import whitelist dokładnie 2 linie z A1; zero z 55 forbidden verbs
zaimportowanych/wywołanych; statyczny UPDATE-clause check (AC-03).
`teresaPirLessonsDraft.realdb.test.ts` (5, dokładnie designu własne 5
scenariuszy): pełny P08 handoff pisze tylko 2 kolumny Teresy;
dyspozycja NASTĘPNIE aktualizuje `lessons_learned` (dowód struktury
2-bramkowej); `closeRoiCase` nadal wymaga dyspozycji
(`PIR_INCOMPLETE`); regeneracja zablokowana po zapisanej dyspozycji
(D6/D13, `DISPOSITION_ALREADY_RECORDED`); guard finalized-PIR.
`legacyIsolation.realdb.test.ts` (2): jeden realny Case + 7 zatrutych
wierszy legacy (ten sam `organization_id`) nigdy nie przeciekają do
modeli odczytu vNext; statyczny zero-legacy-table-reference check.
`roiLegacyArchive.routes.test.ts` (62 = 60 behawioralnych 405/
`LEGACY_ARCHIVE_READ_ONLY` [15 ścieżek × 4 czasowniki mutujące] + 1
path-count + 1 statyczny). `teresa-roi-handoff.test.ts` (8, mockowany):
happy path, truth-preserving failure, `buildRoiPirLessonsAdvisorContext`
bezpośrednio (AC-01), `undoProposal` blocked.

**AC-02 grep gate uruchomiony REALNIE**: `grep -rn
"financial_roi_links\|financial_models\|financial_statement"
server/src/services/resultsVnext/roi/` → **zero trafień** (dosłowny
output pusty, exit 1).

**`tsc --noEmit` clean** (root `tsconfig.json`, `NODE_OPTIONS
=--max-old-space-size=8192`, przed I po przywróceniu plików po
before/after regresji — identyczne exit 0).

**Regresja — dowiedziona PRZED/PO, izolując DOKŁADNIE ten epik (7
zmienionych plików trackowanych + 9 nowych), NIE pełny `git stash`
(worktree współdzielony z inną żywą sesją: `PostgresDatabase.ts` + 3
pliki KPI realDB + migracja §37 — żadnego nie dotyka ten epik, żaden nie
tknięty).** Metoda: `git diff` → plik patcha 7 śledzonych plików →
`git apply -R` (reverse) + 9 nowych plików przeniesionych POZA drzewo
(nie usunięte), na TEJ SAMEJ efemerycznej bazie, ten sam pełny zestaw
`tests/resultsVnext/roi` + `tests/resultsVnext/kpi` +
`p08-teresa-service.test.ts` + forbidden-verbs/handoff testy obu domen.
PRZED (bez kodu ROI-E008): 19 plików/35 testów failed, 303 passed, 8
skipped (346 razem). PO (z kodem ROI-E008): 19 plików/35 testów failed,
388 passed [+85], 8 skipped (431 razem). Lista NAZW niepowodzących
testów PRZED/PO — `diff` **pusty, bajt w bajt identyczna**. Wszystkie 35
przedistniejących niepowodzeń to: (a) już udokumentowany w §38
`initiatives_organization_id_fkey` w piętnastu plikach realDB
ROI-E001…E004 (żaden z nich nie jest plikiem tego epika); (b)
przedistniejący brak `documents`/`presentations` w `payloadMap`
w `p08-teresa-service.test.ts` — udokumentowany we WŁASNYM komentarzu
tego pliku z ery KPI-E006 ("fixing those two is a separate, unrelated
pre-existing debt out of this package's scope") — **NIE naprawiane tu**,
świadomie poza zakresem ROI-E008, zgodnie z tym samym osądem, jaki
KPI-E006 już wydał. **Zero regresji przypisywalnej temu epikowi.** Pliki
przywrócone do stanu identycznego jak przed eksperymentem (zweryfikowane
`git apply` + ręczne `mv` z powrotem, `tsc --noEmit` ponownie czysty po
przywróceniu).

**Realna pułapka narzędziowa znaleziona i obejście udokumentowane (nie
błąd produkcyjny)**: pierwsza próba uruchomienia
`teresaPirLessonsDraft.realdb.test.ts` dała fałszywy czerwony —
`recordRoiPirTeresaLessonsDraft` (droga przez `acquirePgClient`/
`executeAtomicCommand`, bezpośrednio przez pulę pg) pisała poprawnie na
realnym Postgresie, ale audytowy insert do `teresa_handoff_results`
(droga przez `dbRun`/`DbPromise.js`) był niewidoczny dla świeżego
połączenia. Przyczyna: `NODE_ENV=test` BEZ `RUN_DB_TESTS=1` cicho
podstawia w `Database.ts`/`createDatabase()` DB-mock w pamięci (ten sam
wzorzec co ★★★★★ audyt bazy danych 2026-08-06 z pamięci sesji) —
`DbPromise` idzie przez tę warstwę, `acquirePgClient` NIE (bezpośredni
`getPool()`), więc dwie ścieżki zapisu w TYM SAMYM teście trafiały w dwie
różne bazy. Rozwiązanie: `RUN_DB_TESTS=1 MOCK_DB=false` w komendzie
testowej — nie zmiana kodu produkcyjnego.

**Domena ROI: 8/8 epików zbudowanych (E001…E008). Cała mechanika
backendu domeny ROI DOMKNIĘTA.** UI Registry (RN-G2) i pozostałe domeny
(KPI już zamknięta §30, OKR w toku) poza zakresem tego wpisu.

## 40. OKR-E001 Program & Cycle — implementacja + odbiór (2026-08-10)

**Pierwszy epik zupełnie nowej domeny OKR.** Zbudowano
`OKR_E001_DESIGN.md` §4–§9 dosłownie (design FROZEN, self-contained, full
DDL): migracja `20260822_rvn_okr_program_cycle.sql` — Decyzja P1: nazwa
pliku `rvn_okr_`, KAŻDA tabela w środku `okr_vnext_` (4 tabele:
`okr_vnext_programs`, `okr_vnext_program_policy_versions` append-only z
`REVOKE UPDATE, DELETE`, `okr_vnext_cycles` — REGRESSION GUARD OKR-F-002-
AC-02 pilnowany: ZERO `dept_id`/`team_id`/`scope_type`/`scope_id`,
`okr_vnext_checkin_occurrences` minimalna powłoka per Decyzja P11), okrężna
FK `active_policy_version_id` rozwiązana tym samym idempotentnym wzorcem
`DO $$ ... EXCEPTION WHEN duplicate_object` co
`rvn_kpi_definitions.current_definition_version_id`, obydwa partial unique
indexy (jeden aktywny Program per org, brak takiego ograniczenia dla
Cycle per Decyzja P8).

**Warstwa domenowa** (`server/src/services/resultsVnext/okr/`):
`okrProgramCommands.ts` (`createProgram` — plain `executeAtomicCreate`,
BRAK fail-closed lookup polityki widoczności, Program nie jest zasobem
ABAC per Decyzja P2; `editProgramDraft` — CAS update dozwolony w
`draft`/`active`; `publishProgram` — rdzeń OKR-F-001-AC-01: snapshot
WSZYSTKICH pól polityki do `okr_vnext_program_policy_versions`, pin
`active_policy_version_id`, `draft`→`active` przejście, oraz — Decyzja P5
— PIERWSZY product-facing writer `rvn_platform_visibility_policies` przez
nowy prymityw platformowy), `okrCycleCommands.ts` (`createCycle` — fail-
closed guard OKR-F-001-AC-02 PRZED jakimkolwiek INSERT-em, blokuje na
poziomie komendy gdy Program nie jest `active`, pinuje
`policy_version_id` z `program.active_policy_version_id`;
`runOkrCycleLifecycleTransition` eksportowany BEZPOŚREDNIO — świadome
odejście od konwencji ROI/KPI, gdzie generyczny helper jest prywatny za
nazwanymi funkcjami — routes konstruują literal spec per endpoint;
`cancel` jako świadomy dodatek do zestawu z tabeli AC design'u, jawnie
uzasadniony w komentarzu, nie cichy dopisek), `okrCycleScheduler.ts`
(`proposeAndExecuteDueCycleTransitions`/`generateCadenceOccurrences` —
czyste, w pełni testowane funkcje callable, ŻADNEGO wpięcia do crona per
Decyzja P10, ten sam precedens co `outboxDrain.ts`), `okrRepository.ts`
(plain `organization_id` scoping, ŻADNEGO `buildVisibilityScopedCte` —
Program/Cycle nie mają wiersza ABAC per Decyzja P2). 13 endpointów
`/api/vnext/results/okr/*` (`okr.routes.ts`, zamontowany w `Gateway.ts`),
walidatory Zod (`resultsVnextOkr.validators.ts`), 9 nowych event type'ów w
`EVENT_TYPE_CONSUMER_GROUPS` (`okr_set.published` — placeholder RN-G1
zarezerwowany dla OKR-E002 — NIETKNIĘTY). `'okr_program'`/`'okr_cycle'`
dopisane do `RVN_RESOURCE_TYPES` i `CanonicalObjectTypeValues` (Decyzja
P3), `'okr_set'` nietknięty.

**RBAC, nie ABAC — pierwsze genuine odejście od wzorca widoczności
każdego poprzedniego epika** (Decyzja P2/P4): zapis chroniony
`requireOrgRole('admin','superadmin')` na poziomie route'a, GET-y tylko
`requireOrgAccess()`. Zero wywołań `resolveVisibility()` w całym pakiecie
— Program/Cycle to org-wide konfiguracja, nie per-resource ABAC surface.

**Nowy prymityw platformowy `publishVisibilityPolicy`**
(`visibilityResolver.ts`, obok `getActiveVisibilityPolicy`) — UPDATE
(`effective_to = now()` na dotychczasowym aktywnym wierszu) PRZED INSERT-
em nowego, na TYM SAMYM pinned kliencie wewnątrz `publishProgram`'s
`applyMutation` — kolejność wymuszona przez `EXCLUDE USING gist` na
`rvn_platform_visibility_policies`
(`20260809_rvn_platform_visibility_core.sql`); odwrotna kolejność
naruszyłaby constraint. Zweryfikowane bezpośrednio na realnym Postgresie
(patrz niżej) — druga publikacja poprawnie zamyka stary wiersz i otwiera
nowy, NIGDY dwa nakładające się jednocześnie.

**Testy — 46 nowych, WSZYSTKIE PASS na efemerycznym Postgresie 17**
(`initdb --locale=C`, TCP `127.0.0.1:28553`, pełny `npm run db:migrate`
— 84 pliki, zero błędów):
- `okrProgramPublish.realdb.test.ts` (3) — **THE krytyczny test**:
  publish v1 → `createCycle` (pinuje v1) → edit + republish v2 →
  `Cycle.policyVersionId` WCIĄŻ v1, `snapshot` JSONB v1
  bajt-identyczny sprzed istnienia v2. Literalny dowód OKR-F-001-AC-01.
  Plus `publishVisibilityPolicy` zweryfikowany wprost przeciwko realnemu
  `EXCLUDE` constraint, plus one-active-Program-per-org (drugi Program w
  tym samym org dostaje `23505` przy próbie publikacji, zostaje w
  `draft`).
- `okrCycleLifecycle.realdb.test.ts` (10) — fail-closed guard przed
  INSERT-em (draft/suspended/brak Programu), pełny pipeline 5 przejść,
  cancel z każdego nieterminalnego stanu, odrzucenie z terminalnego.
- `okrCycleScheduler.realdb.test.ts` (4) — dwuwywoławcza idempotencja
  OBU funkcji schedulera (drugie wywołanie no-op, nie błąd, brak
  duplikatu wiersza); deterministyczny hand-computed licznik okien
  cadence (3 okna dla 28-dniowego okna biweekly) zweryfikowany
  bezpośrednio.
- `okrRbacGuard.test.ts` (11) — non-admin 403 na WSZYSTKICH 9 trasach
  zapisu, komenda nigdy niewywołana; GET-y wciąż dostępne. Realny
  `requireOrgRole`/`requireOrgAccess`, nie mock.
- `okr.routes.test.ts` (18) — kontrakt HTTP: roundtrip create→get,
  przepływ query params, 404-przed-komendą, walidacja Zod 400, mapowanie
  błędów (STALE_VERSION/AtomicWriteConflictError→409,
  AtomicWriteAggregateNotFoundError→404,
  OkrCycleProgramNotActiveError→409, OkrCycleValidationError→409,
  OkrProgramValidationError→409).

**Odstępstwo znalezione i naprawione podczas pisania testów (nie w
kodzie produkcyjnym, w SAMYM teście)**: pierwsza wersja
`okrProgramPublish.realdb.test.ts` dzieliła jeden `organization_id`
między blokami `it` — drugi/trzeci blok's `publishProgram` kolidował z
`ux_okr_vnext_programs_one_active_per_org` z PIERWSZEGO bloku (dokładnie
poprawne działanie P7, ale zepsuta izolacja testu) — ten sam wzorzec co
§31's `roiCaseLifecycle.realdb.test.ts` INITIATIVE_ID lekcja. Naprawione
świeżym `organization_id` per test. Druga poprawka: `afterAll` cleanup
najpierw musi `NULL`-ować `active_policy_version_id` (okrężna FK
`okr_vnext_programs` ↔ `okr_vnext_program_policy_versions`) przed DELETE
na wersjach polityki.

**Pre-existing środowiskowa usterka potwierdzona, NIE spowodowana tym
epikiem** — dowiedzione bezpośrednim before/after porównaniem: pełny
`tests/resultsVnext/kpi` + `tests/resultsVnext/roi` (271 testów, 53
pliki) uruchomiony DWUKROTNIE na TEJ SAMEJ efemerycznej bazie — raz z
4 współdzielonymi plikami platformowymi (`visibilityResolver.ts`/
`resourceTypes.ts`/`myWorkRoofPackage.ts`/`atomicWrite.ts`/`Gateway.ts`)
przywróconymi do wersji SPRZED tego epika (`git checkout 5fe1b647fd --
...`), raz z moimi zmianami. Wynik IDENTYCZNY co do wiersza: 26 failed |
27 passed (53 pliki), 49 failed | 205 passed | 17 skipped (271 testów),
lista nazw failujących testów bajt-identyczna (`diff` pusty) w obu
przebiegach. Root cause znaleziony i potwierdzony: `initiatives.status`
DEFAULT `'step3'` (`000_z_core_baseline.sql:226/264`) narusza własny
`initiatives_status_check` tabeli — DOKŁADNIE ten sam defekt, który §37
JUŻ naprawił migracją `20260810_fix_initiatives_status_default.sql` na
INNEJ gałęzi/sesji — tej migracji fizycznie NIE MA w drzewie migracji
tego worktree (bazowany na commicie `5fe1b647fd`, sprzed tamtej naprawy).
Nie jest to regresja tego epika — jest to znana, już-udokumentowana,
jeszcze-nie-forward-portowana luka.

**`tsc --noEmit`**: root (frontend) — czysty, 0 błędów. `server/` — 18
przedistniejących błędów `decimal.js` w
`roi/engine/roiCalculationEngine.ts` (IDENTYCZNE przed/po, plik
całkowicie nietknięty przez ten epik, ta sama rodzina błędów co §38
odnotował), ZERO błędów w jakimkolwiek nowym/zmienionym pliku OKR-E001.

**Poza zakresem, świadomie NIEZBUDOWANE**: `okr_vnext_sets`/Objective/
KeyResult/Alignment/CheckIn/Review/Reflection (OKR-E002…E008), suspend/
retire Program commands (status osiągalny tylko przez bezpośrednią
manipulację SQL — żadna komenda tego epika go nie tworzy, dowiedzione w
`okrCycleLifecycle.realdb.test.ts`), realne wpięcie schedulera do crona
(Decyzja P10), self-approval denial dla `publishProgram` (Decyzja P6 —
brak konkretnego pola/AC/endpointu w źródle, nie fabrykowany).
`reflection_required_for_close` domyślnie `false` jawnie oznaczone w
komentarzu DDL jako fail-safe-do-decyzji-Foundera, NIE ostateczna
polityka (design §2/§11, plan §20 EVIDENCE_NEEDED #3 wciąż otwarte).

**Domena OKR: 1/8 epików zbudowanych. OKR-E002 Materialized Set
następny.**

## 41. OKR-E002 Materialized Set — implementacja + odbiór (2026-08-10)

**Drugi epik domeny OKR, buduje na OKR-E001 (Program & Cycle).** Design
doc (`OKR_E002_DESIGN.md`) niósł własny standing re-verification
requirement — powstał w trakcie budowy E001. Zre-weryfikowano dosłownie
przed implementacją: `okr_vnext_programs`/`okr_vnext_cycles` nazwy i typy
kolumn, `runOkrCycleLifecycleTransition`'s sygnatura,
`OkrCycleValidationError`'s kształt, `publishVisibilityPolicy`/
`getActiveVisibilityPolicy` finalna sygnatura, `resolveScopeVisibility`'s
realny SCOPE-mode gap. **Zero rozjazdów znalezionych** — E001 wylądował
DOKŁADNIE jak design zakładał; jedyna literalna zmiana wymagana przez
re-weryfikację to potwierdzenie, że `'okr_set.published'` nie miał
jeszcze żadnego callera (grep-confirmed) przed tym epikiem.

**Schema** (`server/migrations/20260823_rvn_okr_set.sql`) — 3 tabele:
`okr_vnext_sets` (root aggregate #3, Decyzja D1: ABAC, ŻADNEJ kolumny
`visibility_mode`/`visibility_policy_id` — visibility żyje wyłącznie w
platformowym `rvn_platform_resource_visibility`/`rvn_platform_resource_acl`,
dokładnie jak KPI/ROI), `okr_vnext_approved_snapshots` (immutable,
`REVOKE UPDATE, DELETE`, jeden wiersz per approval, D5/D8), `okr_vnext_set_versions`
(append-only OKRMaterialChange, `REVOKE UPDATE, DELETE`, kolumny
`recommit_status`/`recommit_by`/`recommit_at` zarezerwowane NIEUŻYWANE —
D17, workflow recommitu niezbudowany i bez właściciela, stan jawny nie
cichy). Partial unique index D3:
`(organization_id, program_id, cycle_id, scope_type, scope_id, owner_user_id)
WHERE status <> 'cancelled'` — `cancelled` zwalnia slot, `closed`
CELOWO NIE (zweryfikowane bezpośrednio realnym Postgresem, patrz testy
niżej). Migracja zweryfikowana idempotentna (dwa uruchomienia, drugie
same `NOTICE...skipping`) na efemerycznym Postgresie 17 niosącym pełny
łańcuch migracji przez OKR-E001.

**Warstwa domenowa** (`server/src/services/resultsVnext/okr/`):
`okrSetTypes.ts`/`okrSetApprovedSnapshotTypes.ts` (Row/DTO), `okrSetCommands.ts` —
`createOkrSet` (fail-closed brak aktywnej polityki widoczności domain='okr',
dwuetapowy lookup identyczny jak `createKpiDraft`/`createRoiCase`; D3
duplicate-prevention: SAVEPOINT pattern skopiowany DOSŁOWNIE z
`createRoiCase` — tania pre-check SELECT dla ścieżki nie-wyścigowej, SAVEPOINT
wokół kandydackiego INSERT-u dla wyścigu, catch `23505`, `ROLLBACK TO SAVEPOINT`,
retry-SELECT zwraca zwycięzcę z `created:false`; naiwny catch-then-retry
BEZ SAVEPOINT-u pada `25P02` — błąd już raz złapany w tym programie,
zbudowany od razu poprawnie), `updateOkrSetDraft` (CAS, tylko
`draft`/`changes_requested`), `narrowOkrSetVisibility` (D19: osobna,
WĄŻSZA komenda dozwolona też w `active` — narrowing jest z konstrukcji
bezpieczny; D12: `VISIBILITY_NARROWNESS_RANK`/`isVisibilityModeNarrowerOrEqual`
zbudowane LOKALNIE, bo platformowe `allow_narrowing_only` nie ma ŻADNEGO
kodu egzekwującego nigdzie w repo — grep-confirmed, ten epik jest
pierwszym prawdziwym callerem narrowing-only), `isOkrSetReadyForSubmissionEligible`
(D7 stub — sprawdza tylko `reviewer_user_id IS NOT NULL`, eksportowany do
owinięcia przez OKR-E003, NIE zastąpienia) + `submitOkrSetForApproval`,
`buildOkrSetApprovalSnapshotPayload` (D8 — `{set, objectives:[]}`, pusta
tablica placeholder, punkt rozszerzenia dla E003) + `approveOkrSet`
(self-approval denial `submitted_by` PRZED `created_by`, PRZED
jakimkolwiek zapisem — D10/D11, własna klasa błędu
`OkrSetSelfApprovalDeniedError`, nie reużyta z KPI/ROI), `requestChangesOnOkrSet`
(bez self-approval check, jak `rejectRoiCase`), `runOkrSetLifecycleTransition`
+ `OKR_SET_ACTIVATE_SPEC`/`OKR_SET_CANCEL_SPEC` (D9: `activate` REPURPOSES
istniejący placeholder `okr_set.published` zamiast dodawać duplikat
klucza; D15: `cancel` to świadomy dodatek, jak `okr_cycle.cancel` w E001).
`okrSetMaterialChangeCommands.ts` — `recordOkrSetMaterialChange`
(F-005-AC-02: guard `status='active'`, wersjonuje `title`/`owner_user_id`/
`reviewer_user_id`, bumpuje `current_version` NIEZALEŻNIE od CAS
`row_version`, NIGDY nie dotyka `okr_vnext_approved_snapshots` — dowiedzione
bezpośrednio testem, patrz niżej). `okrSetRepository.ts` — celowo NIE
rozszerzenie `okrRepository.ts` (ten ma plain `organization_id` scoping,
Program/Cycle nie mają ABAC per E001 P2) — Sety potrzebują prawdziwego
ABAC, więc własny plik, mirror `roiRepository.ts` vs
`roiEconomicModelRepository.ts` split. WSZYSTKIE odczyty przez
`buildVisibilityScopedCte`/`wrapWithVisibilityScope({resourceType:'okr_set'})`,
`::text` cast na KAŻDYM joinie przeciw `set_id` — ten epik jest PIERWSZYM
prawdziwym writerem `resource_type='okr_set'` w całym repo.

**14 nowych tras** (`okr.routes.ts`, rozszerzony) — Sety to zasoby ABAC
(w przeciwieństwie do RBAC Program/Cycle z E001): trasy zapisu NIE mają
`requireOrgRole` — zweryfikowany precedens: ani `roi.routes.ts` ani
`kpi.routes.ts` nie wołają `requireOrgRole`/`resolveVisibility()` na
poziomie route'a dla własnych zasobów ABAC (grep-confirmed);
autoryzacja to `requireOrgAccess()` (członkostwo w org) + guardy warstwy
komend. Design doc's error-mapping table wymienia "ACL failure→403" jako
możliwy wynik — żadna trasa w tym repo nie implementuje live per-route
ACL gate (prawdziwa, jawna luka, tej samej klasy co D13), więc ta gałąź
jest nieosiągalna, spójnie z ROI/KPI. Każda mutująca trasa celująca w
istniejący `setId` pre-fetchuje przez `getOkrSet` (ABAC-scoped) przed
wywołaniem komendy — dopisane po odkryciu, że pierwsza wersja tego pliku
tego nie robiła, w przeciwieństwie do zweryfikowanego wzorca w
`roi.routes.ts` (KAŻDA mutująca trasa tam pre-fetchuje `getRoiCase`) i
własnych tras Program/Cycle w tym samym pliku. `GET /company` to cienki
wrapper `listOkrSets` przypinający `scope_type='company'` — F-004-AC-02
"widok firmowy to projekcja, nie osobny model" strukturalnie wymuszone
przez współdzielenie funkcji repozytorium, nie duplikat zapytania.
Walidatory Zod (`resultsVnextOkr.validators.ts`, rozszerzone). 8 nowych
event type'ów w `EVENT_TYPE_CONSUMER_GROUPS` (`okr_set.published`
REPURPOSED zgodnie z D9, nie duplikat).

**Testy — 65 nowych, WSZYSTKIE PASS na efemerycznym Postgresie 17**
(`initdb --locale=C`, TCP `127.0.0.1:5591`, pełny `npm run db:migrate --safe`
— zero błędów, wszystkie tabele OKR-E001+E002 obecne):
- `okrSetCreate.test.ts` (6, fake-PoolClient unit, bez realnej bazy —
  SAVEPOINT dedupe race NIE da się wiernie odtworzyć przeciw fake
  klientowi in-process, więc ten plik prowadzi `createOkrSet` przez
  ŚCIEŻKĘ KODU odpalaną przy złapanym `23505`, dowodząc że sekwencja
  ROLLBACK TO SAVEPOINT + retry-SELECT zwraca zwycięzcę zamiast rzucić)
  — no-active-policy fail-closed, scopeId required dla KAŻDEGO scopeType
  (włącznie z `'company'`), D3 duplicate prevention (pre-check/race/happy).
- `okrSetLifecycle.realdb.test.ts` (7) — D7 eligibility guard, pełny
  pipeline draft→submitted→approved→active (weryfikuje wiersz eventu
  `okr_set.published` REPURPOSED), out-of-order rejection,
  `requestChangesOnOkrSet` roundtrip, cancel z każdego nieterminalnego
  stanu, i LITERALNY dowód D3: cancelled zwalnia slot (nowy Set na tej
  samej krotce), closed NIE zwalnia (fixture-manipulacja, `created:false`
  zwraca stary wiersz, dokładnie 1 wiersz w bazie).
- `okrSetApproval.realdb.test.ts` (6) — self-approval denial OBIE gałęzie
  (`submitted_by` sprawdzany pierwszy nawet gdy `created_by` różny;
  `created_by` z innym submitterem), genuine-reviewer happy path,
  snapshot insert + `sequence_number`/`approved_version`/
  `latest_approved_snapshot_id` pointer correctness, DRUGI realny cykl
  approvalu dowodzący że wiersz v1 zostaje bajt-identyczny, REVOKE
  UPDATE/DELETE grant check na poziomie bazy.
- `okrSetMaterialChange.realdb.test.ts` (5) — active-only guard (odrzucony
  z draft i z approved-not-yet-active), `version_number` increment dla
  wszystkich 3 dozwolonych pól sekwencyjnie, i **LITERALNY dowód
  F-005-AC-02**: po material change tytułu na aktywnym Secie, wiersz
  approved snapshot (zamrożony ze STARYM tytułem) jest bajt-identyczny
  (ten sam `content_hash`, ten sam JSON) i wciąż pokazuje stary tytuł
  podczas gdy żywy Set pokazuje nowy; dokładnie jeden wiersz snapshotu
  przez cały czas.
- `okrSetVisibilityJoin.realdb.test.ts` (5) — `::text` cast na WSZYSTKICH
  3 tabelach: OPEN_ORG/RESTRICTED_ACL/PRIVATE na `okr_vnext_sets`,
  odziedziczona widoczność przez `snap.set_id::text` na
  `okr_vnext_approved_snapshots`, i ad-hoc join `buildVisibilityScopedCte`
  dowodzący tego samego wzorca przeciw `okr_vnext_set_versions` (ta
  tabela nie ma żadnego shipped repository readera w tym epiku — D17 —
  więc to bezpośredni dowód gotowy dla przyszłego epiku).
- `okrSetVisibilityNarrowing.realdb.test.ts` (7) — PEŁNA macierz rank:
  dla każdego z 5 możliwych ceilingów (`visibility_default` Programu),
  KAŻDY z 5 kandydackich modów — zaakceptowany dokładnie gdy
  rank(kandydat) >= rank(ceiling), odrzucony inaczej; odrzucona próba
  NIE zmienia `row_version` (25 par pokrytych przez pętlę 5×5). D19:
  narrowing zaakceptowany w `active`; próba poszerzenia w tym samym
  stanie wciąż odrzucona. Guard: narrowing odrzucony na `cancelled` Secie.
- `okr.routes.test.ts` rozszerzony (+29, razem 47) — kontrakt HTTP dla
  wszystkich 14 tras: roundtrip create→get (obie gałęzie `created:true`→201
  i D3 found-existing→200), lista z pełnym przekazaniem filtrów,
  `GET /company` przypinający `scope_type`, edycja draftu, narrowing
  (sukces + widening-denied 409 + invalid-enum 400), submit (+ not-ready
  409), approve (+ self-approval-denied 403), request-changes, przejścia
  activate/cancel, material-change request-revision (+ NOT_ACTIVE 409 +
  invalid fieldName 400), oba trasy odczytu approval-snapshot.

**Dwa błędy w SAMYCH testach znalezione i naprawione podczas pisania
(nie w kodzie produkcyjnym)**: (1) fixture Sety w
`okrSetVisibilityJoin.realdb.test.ts` kolidowały na realnym unikalnym
indeksie D3, bo `scope_id` domyślnie równał się `owner_user_id`, którego
kilka scenariuszy celowo reużywa — naprawione przypinając `scope_id` do
unikalnego `setId`; (2) jeden placeholder `$1` związany zarówno z
kolumną UUID `set_id` jak i kolumną TEXT `scope_id` w tym samym INSERT-cie
wywołał Postgresowy `42P08` ("inconsistent types deduced for parameter")
— naprawione osobnym placeholderem per kolumna.

**Odkrycie dotyczące `computeStateHash` + JSONB, dotyczy CAŁEGO programu,
nie tylko OKR-E002**: `content_hash` liczony jest RAZ z obiektu JS PRZED
`JSON.stringify`+INSERT. Postgresowe przechowywanie JSONB NIE zachowuje
oryginalnej kolejności kluczy (zweryfikowane wprost:
`SELECT jsonb_build_object('b',1,'a',2)::text` zwraca `{"a": 2, "b": 1}`,
alfabetycznie) — więc przeliczenie `computeStateHash` z wartości
odczytanej z kolumny JSONB NIGDY nie odtworzy oryginalnego zapisanego
hasha. Hash to fingerprint w momencie zapisu, nie weryfikowalny przy
każdym odczycie checksum bajtów kolumny JSONB. Osiągalna, przetestowana
gwarancja: sama zapisana kolumna TEXT nigdy nie dryfuje między odczytami
— nie że można ją zweryfikować ponownym haszowaniem odczytanego payloadu.
Dotyczy to każdej kolumny `content_hash` w tym programie (KPI/ROI też),
nie tylko OKR-E002.

**Decyzja implementacyjna, odstępstwo od dosłownego snippetu w designie,
stwierdzone jawnie w kodzie**: `narrowOkrSetVisibility` design's own
snippet mówi "Set's own table is untouched" — zaimplementowano to
literalnie w sensie kolumn DOMENOWYCH (żadna kolumna treści Setu nie jest
dotykana, zgodnie z D1: nie ma kolumny `visibility_mode` na
`okr_vnext_sets`), ALE komenda i tak bumpuje `okr_vnext_sets.row_version`
(kolumna housekeeping, `updated_by`/`updated_at`) żeby kontrakt CAS/
`resultingVersion` honorowany przez KAŻDĄ inną komendę w tym pliku
pozostał spójny dla kolejnych callerów — bez tego `outcome.resultingVersion`
kłamałby o faktycznym stanie wiersza. Udokumentowane w kodzie, nie ciche.

**`tsc --noEmit`**: root — czysty, 0 błędów, WIELOKROTNIE zweryfikowany
(po schemacie, po warstwie komend, po routes, po finalnym pre-fetch
fixie) — zero regresji na żadnym etapie.

**Before/after na pełnym `tests/resultsVnext/kpi` + `tests/resultsVnext/roi`
+ `tests/resultsVnext/okr` + trasy/serwisy resultsVnext (78 plików po
zmianach, 72 przed)** — dwa PEŁNE przebiegi na TEJ SAMEJ efemerycznej
bazie: raz na osobnym `git worktree` przy commicie `615544e014` (TIP
sprzed pierwszego commita OKR-E002, "before"), raz na HEAD tego
worktree z pełnym OKR-E002 ("after"). Wynik: **35 failed w OBU
przebiegach** (identyczna liczba), lista distinct (plik>describe>test)
identyfikatorów niepowodzeń w "after" jest ŚCISŁYM PODZBIOREM "before"
(`diff` pokazuje WYŁĄCZNIE usunięcia, zero dodań) — **zero nowych
regresji wprowadzonych przez ten epik**, dowiedzione, nie zadeklarowane.
"After" ma więcej PASS (635 vs 565) — 65 z tego to nowe testy OKR-E002
tego epiku; pozostała różnica to 3 pliki KPI
(`initiativeKpiImpactBaselineFreeze.realdb.test.ts`/
`kpiIdentityAcrossSurfaces.realdb.test.ts`/
`kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts`), które miały już
NIEZACOMMITOWANE lokalne poprawki w tym worktree PRZED rozpoczęciem tej
sesji (widoczne w `git status` na starcie, niezwiązane z OKR-E002, NIE
moje) — "before"-worktree (świeży checkout z commita) nie niósł tych
niezacommitowanych zmian, więc te 3 pliki failowały tam, a przechodzą w
"after" (mój główny worktree). Nie przypisuję sobie tej zasługi — stan
jawnie odnotowany. `~35 failed` to DOKŁADNIE ten sam pre-existing
`initiatives.status` DEFAULT `'step3'` defekt udokumentowany w §37/§39,
niezwiązany z tym epikiem.

**Poza zakresem, świadomie NIEZBUDOWANE**: Objective/KeyResult CRUD i
prawdziwy guard ≥2-KR (OKR-E003), check-ins (E004), alignment (E005),
support/decisions (E006), review/reflection/carry-forward (E007), Teresa/
perspektywy/legacy (E008), `okr_vnext_population_rules` (D2 — brak
auto-scaffoldingu pustych Setów, tylko jawna komenda tworząca), modele
`/my`/`/team-health`/`/attention`/`/advisor/*`.

**Dwie jawnie zgłoszone luki designu, restated tutaj explicite, nie
ciche**:
1. **D13 platform gap**: `resolveScopeVisibility()` (`visibilityResolver.ts`)
   i `buildVisibilityScopedCte()`'s SCOPE branch obsługują TYLKO
   `scope_type='team'` (przez `team_members`) — pod polityką Programu w
   trybie `SCOPE`, Sety `company`/`business_unit`/`individual` failują
   closed z `OUT_OF_SCOPE`. Nie jest to bloker dla MVP default
   (`OPEN_ORG`), ale jest to realna, nienaprawiona luka platformy — poza
   zakresem pliku tego epiku (zmiana warstwy platformowej), zgłoszona do
   przodu tak jak ROI-E003 D20 zrobił dla swojej granularności ACL.
2. **D17 workflow recommitu niezbudowany**: kolumny
   `okr_vnext_set_versions.recommit_status`/`recommit_by`/`recommit_at`
   zarezerwowane (ta sama dyscyplina "zarezerwuj teraz, unikaj ALTER na
   żywej tabeli później" użyta 4 razy wcześniej w tym programie), ale
   ŻADNA komenda E002 ich nie zapisuje — recommit workflow jest
   nieozbudowany i bez właściciela, stan jawny w kodzie i tutaj.

**Domena OKR: 2/8 epików zbudowanych. OKR-E003 Objective/KeyResult
następny.**

## 42. OKR-E008 Half C only (Legacy/Ops) — implementacja + odbiór (2026-08-10) — Halves A i B ODROCZONE

**Ostatni epik domeny OKR, ale zbudowana WYŁĄCZNIE Połowa C (Legacy/Ops
Exclusion, OKR-F-029) — świadomy podział zlecony przez orkiestratora.**
Połowa A (Teresa, OKR-F-025..027) i Połowa B (Perspectives, OKR-F-028) NIE
zbudowane w tej sesji — obie zależą od OKR-E003…E007 (Połowa A) i częściowo
od OKR-E002 obecnego w tym worktree (Połowa B), które orkiestrator zlecił
osobnym, późniejszym pakietem. `OKR_E008_DESIGN.md` §7 open question #2 już
wcześniej flagował dokładnie ten podział jako realną opcję ("E008a:
Legacy+Perspectives buildable now" / "E008b: Teresa blocked") — ten pakiet
realizuje `E008a`'s Legacy-only wycinek, nie całość.

**Środowisko tej sesji było ~4400 commitów ZA `codex/results-vnext-g0-
20260809`** (worktree stworzony z wcześniejszego punktu w historii, przed
scaleniem OKR-E001 i całej reszty programu Results Next) — brak design
docu, brak `readOnlyGuard.middleware.ts`, brak KPI/ROI legacy archive
routerów, brak `okrRepository.ts`. Naprawione fast-forward mergem do
`codex/results-vnext-g0-20260809` (branch worktree'a nie miał ŻADNYCH
własnych commitów, więc to był czysty ff, zero konfliktów) PRZED
rozpoczęciem pracy — bez tego kroku zadanie było fizycznie niewykonalne
(design doc §5 HALF C, na którym to zadanie się opiera, fizycznie nie
istniał w drzewie).

**Re-weryfikacja inwentarza legacy OKR (bezpośredni grep, nie zaufanie
designowi)** — potwierdza `OKR_E008_DESIGN.md` §2.1/§2.2 co do joty, ZERO
korekt do zgłoszenia ponad te, które sam design doc już udokumentował:
4 tabele (`okr_cycles`, `okr_objectives`, `okr_key_results`,
`okr_check_ins`), wszystkie `organization_id TEXT NOT NULL` bezpośrednio
(`server/migrations/914_okr_management.sql` linie 41-101 — potwierdzone
odczytem, nie domysłem), `id TEXT PRIMARY KEY` (`okr_objectives`/
`okr_key_results`) lub `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`
(`okr_cycles`/`okr_check_ins`). Dwa D09 FK na `okr_key_results` potwierdzone
w DWÓCH osobnych plikach migracji: `kpi_id → initiative_kpis` (914, linia
161-163) i `kpi_definition_version_id → kpi_definition_versions`
(`20260803_res009_okr_key_result_definition_version.sql`, linia 16-18) —
oba `ON DELETE SET NULL`/fail-soft, oba żywe. `okrRepository.ts` (OKR-E001,
jedyne wylądowane repo vNext OKR w tym worktree) czyta WYŁĄCZNIE
`okr_vnext_programs`/`okr_vnext_cycles` — zero referencji do jakiejkolwiek
z 4 tabel legacy, potwierdzone bezpośrednim grep przed napisaniem
jakiegokolwiek kodu.

**Zbudowane** (dosłownie wg `OKR_E008_DESIGN.md` §5, wzorowane na
LANDED `kpiLegacyArchive.routes.ts`/`roiLegacyArchive.routes.ts`, nie na
ich własnych design docach):
- `server/src/routes/resultsVnext/okrLegacyArchive.routes.ts` — 9
  endpointów GET-only (1 index + 4 tabele × list/get), `denyMutations`
  PIERWSZY w łańcuchu middleware (przed auth), pojedynczy bucket etykiet
  `okr_legacy_live` (Decyzja D-OKR8-17 — wszystkie 4 tabele należą do JEDNEJ
  żywej powierzchni: `resultsStrategic.routes.ts` + `okrService.ts`, w
  przeciwieństwie do ROI-E008's 3 genuinie osobnych systemów). Label text
  "live, external to Results vNext" (D-OKR8-18), NIE "archive — read-only"
  (system jest ŻYWY: `requireProjectCapability(..., {shadow:true})`,
  shadow-only dopóki `CAPABILITY_ENFORCE != 'enforce'`).
- **Element unikalny dla tego epiku (D-OKR8-19)**: `key-results`'owy
  list/get response niesie dodatkową tablicę `warnings` etykietującą
  `kpi_id`/`kpi_definition_version_id` jako żywe, cross-domenowe FK,
  informacyjne od 2026-07-12 (D7/Piotr), nigdy nieużywane do scoringu —
  ani KPI-E007, ani ROI-E008 tego nie potrzebowały (żadna z ich tabel
  legacy nie niosła żywego FK wskazującego w inną domenę). Repozytorium
  nadal `SELECT *`-uje obie kolumny (D-OKR8-19: etykieta na warstwie
  ROUTE, nie ukrywanie na warstwie repo).
- `server/src/services/resultsVnext/okr/okrLegacyArchiveRepository.ts` —
  read-only, zero importów z jakiegokolwiek `*Commands.ts`, nazwa tabeli
  hardcoded per funkcja (nigdy interpolowana z argumentu runtime).
- `server/src/validators/resultsVnextOkrLegacy.validators.ts` —
  `legacyId` permisywny non-UUID string (legacy PK to TEXT).
- `server/src/services/metricsService.ts` (edycja) —
  `resultsVnextOkrLegacyArchiveHitsTotal`, ten sam kształt co
  KPI/ROI-owe liczniki, zero dashboardu.
- `server/src/Gateway.ts` (edycja) — `/api/vnext/results/okr/legacy`
  zamontowany PRZED generycznym `/api/vnext/results/okr` (ten sam
  "more-specific-prefix-first" konwencja co KPI-E007/ROI-E008).

**Testy — 43 nowe, WSZYSTKIE PASS** (37 write-denial + 3 D09 static + 1
count-sanity uruchomione bez bazy; 2 real-Postgres na efemerycznym
Postgresie 17 lokalnym — `initdb --locale=C`, krótki socket dir `/tmp/
okre008pg` (pełna ścieżka scratchpad przekracza limit 103 bajtów na
Unix-domain socket na macOS — pierwsza próba na `pgdata/` katalogu
FAILOWAŁA właśnie na tym), `NODE_ENV=test` żeby ominąć
`databaseTargetResolver.ts`'s guard przeciw `127.0.0.1` poza testami,
strict `db:migrate` bez `--safe`):
- `okrLegacyArchive.routes.test.ts` (37) — 9 tras × 4 czasowniki mutujące
  → 405 `LEGACY_ARCHIVE_READ_ONLY` (36), plus statyczny regex zero
  `router.(post|put|patch|delete)(`.
- `okrD09ZeroFkIsolation.test.ts` (3) — NOWY kształt dowodu, którego
  KPI-E007/ROI-E008 nie potrzebowały: zero `REFERENCES` do
  `okr_key_results`/`initiative_kpis`/`kpi_definition_versions`/
  `kpi_time_series` w jakimkolwiek `*rvn_okr*.sql`/`*okr_vnext*.sql`
  pliku migracji; zero referencji `kpiDefinitionService`/`kpi_time_series`
  w jakimkolwiek pliku `server/src/services/resultsVnext/okr/*.ts` poza
  samym `okrLegacyArchiveRepository.ts` (który je dokumentuje w
  komentarzach prozy, nigdy w kodzie wykonywalnym — zweryfikowane osobnym
  testem z filtrem linii komentarza).
- `legacyIsolation.realdb.test.ts` (2) — poison wszystkich 4 tabel legacy
  + kontrolny Program przez prawdziwą komendę `createProgram` (OKR-E001);
  `okrRepository.listPrograms`/`getProgram`/`listCycles` nigdy nie
  zwracają zatrutego wiersza, kontrolny Program NAPRAWDĘ się pojawia
  (dowód nie-wakuowy), bezpośredni dowód poprawności KAŻDEJ funkcji
  `okrLegacyArchiveRepository.ts` (znajduje dokładnie swój zatruty
  wiersz), plus statyczny grep zero referencji do 4 nazw tabel legacy w
  jakimkolwiek `okr/*Repository.ts` poza samym plikiem archiwum.
  **Notatka dla następcy (OKR-E002+)**: statyczna połowa testu skanuje
  katalog w runtime — automatycznie obejmie `okrSetRepository.ts` i inne,
  gdy wylądują, BEZ edycji tego pliku. Behawioralna połowa (realDB) WYMAGA
  ręcznego dopisania nowych funkcji read-modelu do tego samego bloku
  poison/control/assert — udokumentowane w nagłówku pliku.

**`tsc --noEmit`**: root (frontend, `tsconfig.json`) — czysty, 0 błędów.
`server/tsconfig.json` — 18 przedistniejących błędów `decimal.js` w
`server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts`
(plik CAŁKOWICIE nietknięty przez ten epik, identyczna rodzina błędów co
§39/§40 już odnotowały — `Cannot use namespace 'Decimal' as a type`/`This
expression is not constructable`/brakujące `ROUND_HALF_EVEN`/
`ROUND_HALF_UP`), ZERO błędów poza tym jednym pliku, w tym ZERO błędów w
jakimkolwiek nowym/zmienionym pliku OKR-E008 Half C (`okrLegacyArchive
.routes.ts`, `okrLegacyArchiveRepository.ts`,
`resultsVnextOkrLegacy.validators.ts`, `Gateway.ts`, `metricsService.ts`).
**Środowiskowa uwaga dla następcy**: `server/tsconfig.json`'s
`typeRoots: ["../node_modules/@types", ...]` zakłada, że katalog worktree'a
leży DOKŁADNIE jeden poziom nad `server/` w stosunku do prawdziwego
`node_modules` monorepo — fałszywe dla worktree'a zagnieżdżonego pod
`.claude/worktrees/<nazwa>/` (dwa dodatkowe poziomy), co dawało fałszywy
`error TS2688: Cannot find type definition file for 'node'` niezwiązany z
KODEM. Naprawione lokalnym symlinkiem `node_modules/@types` → prawdziwy
`consultify/node_modules/@types` (nie commitowane — `node_modules/` jest
gitignored, symlink żyje tylko w tym worktree jako narzędzie do
weryfikacji).

**Poza zakresem, świadomie NIEZBUDOWANE (odroczone, nie zapomniane)**:
Połowa A (Teresa: `objective_draft`/`objective_quality_review`/
`check_in_assist`/`manager_brief`/`reflection_synthesis`, 5 trybów
adwizora, `HandoffTargetModule` union + `teresaCopilotCanon.ts`/
`teresaCopilotService.ts` edycje) — blokowana na OKR-E003/E004/E006/E007,
żadna z nich nie istnieje w tym worktree. Połowa B (Perspectives:
`okrPerspectivesRepository.ts`, `/okr/my`, `/okr/team-health`, parity test
z `/okr/company`) — blokowana na `okrSetRepository.ts`/`okr_vnext_sets`
(OKR-E002), które orkiestrator buduje RÓWNOLEGLE w innym worktree i
świadomie NIE istnieją w tym drzewie (zgodnie z poleceniem zadania).
`server/migrations/<date>_rvn_okr_reflection_teresa_draft.sql` (design
§3.9) — NIE zbudowane, celowo: kolumna docelowa (`okr_vnext_reflections`,
OKR-E007) nie istnieje.

**Domena OKR: 1/8 epików w pełni zbudowanych (OKR-E001), 1/8 epików
CZĘŚCIOWO zbudowanych (OKR-E008, tylko Połowa C — OKR-F-029). Połowy A i B
OKR-E008 oraz OKR-E002…E007 w całości pozostają NOT_IMPLEMENTED.**

## 43. OKR-E003 Objectives & Key Results — implementacja + odbiór (2026-08-10)

Trzeci epik domeny OKR, pierwszy niosący realną TREŚĆ Setu (Objectives i
KeyResults) — poprzednie dwa epiki (E001 Program/Cycle, E002 Set) budowały
wyłącznie kontener. Zbudowane dosłownie wg `OKR_E003_DESIGN.md` §8-§17,
ratyfikowane przez blok §-IO (Integration Owner rulings) na czele tego
dokumentu — dokument sam stwierdza, że ten blok jest wiążący i nadpisuje
sprzeczne fragmenty draftu poniżej niego.

**IO-1 re-verification (obowiązkowy pierwszy krok)**: OKR-E001 i OKR-E002
były już WYLĄDOWANE w tym worktree (nie tylko ich frozen design docs) —
design E003 był pisany PRZED ich lądowaniem, więc każdy cytowany
sygnatura/nazwa tabeli/kolumny musiał być zweryfikowany na żywo. Wynik:
**zero rozjazdów** między designem a lądowanym kodem E001/E002, z jednym
rozstrzygnięciem: `getOkrSet` (`okrSetRepository.ts`, E002) zwraca PŁASKI
`OkrSet`, bez zagnieżdżonych Objectives/KRs — więc `GET /sets/:setId/objectives`
z §-IO item 10 jest ADDYTYWNY, nie duplikat, i został zbudowany.

**Schema** (`server/migrations/20260824_rvn_okr_objective_key_result.sql`):
2 nowe tabele, `okr_vnext_objectives`/`okr_vnext_key_results`, czysto
addytywne (żadnego ALTER na tabelach E001/E002). D09: `source_type`/
`source_reference` na KR to gołe TEXT bez FK — dowiedzione BEZPOŚREDNIĄ
inspekcją `information_schema.table_constraints`/`constraint_column_usage`
na realnym Postgresie (nie deklaracją design docu) w
`okrKeyResultCreate.realdb.test.ts`. §-IO item 1 wymagał kolumny spoza
literalnego DDL draftu — `out_of_range_distance` — dodanej explicite do
migracji dla `maintain_range`'s diagnostyki poza `progress`.

**Silnik progresu** (`okrProgressEngine.ts`) — czysta, bez-DB, bez
side-effectów funkcja (ten sam reżim co silnik NPV ROI-E002, §3.5 tego
dokumentu). §-IO rulings zaimplementowane DOSŁOWNIE, nie przybliżone:
- `binary`: achieved=1.0, not achieved=0.0 (nie 100/0 jak sugerował
  wcześniejszy draft własny) — inne wartości `current_value` → `not_calculable`.
- `maintain_range`: in-range=1.0, out-of-range=0.0, magnitude w OSOBNYM
  polu `outOfRangeDistance` (nigdy złożone do `progress`). Własna propozycja
  draftu linear-falloff **ODRZUCONA** przez Integration Ownera (arbitralny
  parametr nachylenia, którego żadne źródło nie precyzuje) — nie
  zaimplementowana.
- `progress` to surowy nieprzycięty ratio (§-IO item 2) — overachievement
  (np. 1.5 na `increase`) jest legalną, przechowywaną wartością.
- Mixed confidence models (kategoryczny + numeryczny) w jednym Objective →
  `not_calculable` (§-IO item 5), BEZ ograniczenia schematu wymuszającego
  jednorodność — heterogeniczność to realny stan, nie błąd do ukrycia.
- `hasSufficientKeyResultCoverage` (D-E3-5/§-IO item 3): per-Objective, nie
  Set-wide — dosłowne odczytanie forward-declaration E002 (`isOkrSetReadyForSubmissionEligible`'s
  komentarz), przyjęte jako wiążące mimo dwuznacznej prozy AC. §-IO item 6:
  ZERO specjalnego traktowania company/BU/team — reguła identyczna dla
  wszystkich 4 scope_type, dowiedziona testem pętli po wszystkich czterech.

**43 testy known-answer** (`okrProgressEngine.test.ts`) — każda oczekiwana
wartość ręcznie zweryfikowana w komentarzu obok assercji (nie: silnik
zgadza się sam ze sobą). Pokrywa happy path WSZYSTKICH 5 geometrii ORAZ
każdy nazwany w §9.1 przypadek degenerate, dowodząc `not_calculable`
zamiast fabrykowanego zera — literalny dowód OKR-F-009-AC-01.

**Command layer** (`okrObjectiveCommands.ts`/`okrKeyResultCommands.ts`):
`createObjective`/`updateObjective`/`cancelObjective`,
`createKeyResult`/`updateKeyResult`/`cancelKeyResult`. D-E3-3: `ambition_type`
schema-permissive (CHECK dopuszcza wszystkie 3), gating na warstwie komend
wg `committedVsAspirationalEnabled` z PRZYPIĘTEJ (nie żywej) polityki
Cyklu. D-E3-4: analogicznie `measurement_type` — milestone/custom
odrzucane na warstwie komend (`MEASUREMENT_TYPE_NOT_IMPLEMENTED`), mimo że
CHECK dopuszcza wszystkie 6. Każdy zapis KR synchronicznie woła silnik w
TEJ SAMEJ transakcji i persystuje `progress`/`progress_calc_policy_version_id`/
`progress_calc_reason`/`out_of_range_distance`, po czym `recomputeObjectiveRollup`
przelicza rodzica-Objective z WSZYSTKICH jego aktualnych KR (nie tylko
nowego) w tej samej transakcji — drugie zdarzenie
`okr_objective.progress_recalculated` emitowane ręcznie przez
`insertManualOkrEvent` (wzorzec `kpiDeviationCommands.ts`'s
`insertManualDeviationEvent`) z odrębnym idempotency-key (ten sam klucz co
komenda-matka kolidowałby na `ON CONFLICT (organization_id, idempotency_key)
DO NOTHING` i po cichu zgubił drugie zdarzenie).

**§-IO item 8 / D-E3-8, dowód no-cascade**: `cancelObjective` NIE dotyka
żadnego wiersza KeyResult — dowiedzione testem `okrObjectiveLifecycle.realdb.test.ts`,
który sprawdza nie tylko status ("nie cancelled"), ale identyczny
`row_version`/`updated_at` przed i po anulowaniu rodzica, dla KR w stanie
`on_track` i osobno `at_risk`. To jest dokładnie legacy wzorzec
`okr_objectives.parent_id` cascade-rollup, którego ten program ma za
zadanie się pozbyć (plan §3.2) — test jest konkretnym, sprawdzalnym
dowodem, że E003 go nie odtwarza.

**Dwa dotknięcia `okrSetCommands.ts`** (E002, plik NIE własny tego epiku,
zgodnie z forward-declaration E002 — "wrap, don't replace"):
1. `submitOkrSetForApproval` owija `isOkrSetReadyForSubmissionEligible`
   (ciało funkcji dowiedzione nietknięte porównaniem diff) drugim
   sprawdzeniem `hasSufficientKeyResultCoverage`.
2. `buildOkrSetApprovalSnapshotPayload` wypełnia swój D8 `objectives: []`
   placeholder realną treścią przez `buildObjectivesSnapshotFragment` —
   PIERWSZE podejście, w którym `content_hash` snapshotu jest znaczący
   (wcześniej hashował pustą tablicę).
`OkrSetNotReadyForSubmissionError` zyskał opcjonalny trzeci parametr
`extraDetails` — rozszerzenie sygnatury wstecznie kompatybilne.

**Konsekwencja uboczna, restated explicite**: wrappnięcie
`submitOkrSetForApproval` złamało 4 pliki testowe E002 (`okrSetApproval`,
`okrSetLifecycle`, `okrSetMaterialChange`, `okrSetVisibilityNarrowing` —
26 testów), które tworzyły Set i submitowały go BEZ żadnych Objectives/KRs
jako scaffolding dla innych asercji (self-approval, material-change guard,
visibility narrowing) — teraz blokowane nową bramką pokrycia. Naprawione
dodaniem `addSufficientKeyResultCoverage()` fixture-helpera do wszystkich
4 plików (1 Objective + 2 KR przed każdym realnym submitem) — wszystkie
26 testów PASS ponownie, plus jedna asercja w `okrSetApproval` zmieniona
z oczekiwania pustego `objectives:[]` na realną treść (1 objective, 2 KR),
zgodnie z nowym zachowaniem D8.

**Repository** (`okrObjectiveRepository.ts`): `listObjectivesForSet`
(zagnieżdżone KR), `getObjective`, `getKeyResult` — wszystkie ABAC przez
Set-owy `'okr_set'` visibility row, `set_id::text` cast na każdym joinie
(ten sam bug wymieniony 7 razy w jednym epiku KPI — dowiedziony testem
`okrObjectiveVisibilityJoin.realdb.test.ts`, który explicite pokazuje że
join BEZ castu failuje na type mismatch, a WERSJA Z castem wykonuje się i
zwraca wiersz).

**Pinned-policy-version proof (OKR-F-009-AC-02, DoD-krytyczny)**:
`okrKeyResultCreate.realdb.test.ts` dowodzi, że `progress_calc_policy_version_id`
wskazuje na PRZYPIĘTĄ politykę Cyklu (via `okr_vnext_sets.cycle_id →
okr_vnext_cycles.policy_version_id → okr_vnext_program_policy_versions`),
NIE żywy odczyt `okr_vnext_programs` — po republishu Programu (nowa v2
polityka, `objectiveRollupModel` zmieniony) i recompute na TYM SAMYM KR,
`progress_calc_policy_version_id` pozostaje v1.

**9 nowych endpointów** `/api/vnext/results/okr/*` (create/list Objective,
get/update/cancel Objective, create KeyResult, get/update/cancel
KeyResult) — ta sama postawa ABAC-dziedziczonego-przez-Set co routy Setu
E002 (brak `requireAdminWrite`), każdy mutujący route pre-fetchuje zasób
przez ABAC-scoped repository read przed wywołaniem komendy.

**Liczby testów tego epiku**: 43 (silnik) + 4 (createObjective) + 9
(createKeyResult) + 5 (KR-coverage/OKR-F-008-AC-02) + 2
(approval-snapshot/D8) + 5 (visibility-join/`::text`) + 3
(objective-lifecycle/no-cascade) + 29 (route-contract) = **100 nowych
testów**, plus 26 istniejących testów E002 naprawionych (fixture update,
nie nowa asercja) = **126 testów dotkniętych tym epikiem**, wszystkie PASS
na efemerycznym Postgresie 17 (`initdb --locale=C`, TCP 127.0.0.1,
`NODE_ENV=test`). `npx tsc --noEmit` (`NODE_OPTIONS=--max-old-space-size=8192`)
czysty — 0 błędów, zweryfikowany dwukrotnie w trakcie budowy (po command
layer + routes, i po dodaniu wszystkich testów).

**Weryfikacja before/after pełnych suit**: na tej samej efemerycznej bazie,
`tests/resultsVnext/okr` (21 plików / 253 testy) — **253/253 PASS, 0 fail**
(baseline przed rozpoczęciem tego epiku: 13 plików / 107 testów, 100%
PASS — więc 146 nowych testów netto wliczając silnik i fixture-updates,
zero regresji). `tests/resultsVnext/kpi` — **0 fail** (pełna suita zielona).
`tests/resultsVnext/roi` — **33 testy failują w 18 plikach**, WSZYSTKIE z
tym samym pre-existing root cause już udokumentowanym w §37 tego
dokumentu: `initiatives_organization_id_fkey` — fixture'y ROI (np.
`roiVisibilityJoin.realdb.test.ts`) nigdy nie wstawiają swojego `ORG_ID`
do `organizations` przed insertem do `initiatives`; §37 naprawił dokładnie
ten sam wzorzec, ale tylko dla 3 plików KPI (`legacyIsolation.realdb.test.ts`'s
`INSERT INTO organizations ... ON CONFLICT DO NOTHING` przed `INSERT INTO
initiatives`) — nigdy nie rozszerzony na katalog `tests/resultsVnext/roi/`.
Ta sesja nie dotknęła ŻADNEGO pliku w `server/src/services/resultsVnext/roi/`
ani `tests/resultsVnext/roi/` — przyczynowość wykluczona strukturalnie
(brak importu okr/* w żadnym pliku ROI), nie tylko zaobserwowana przez
zerowy diff.

**Nadal otwarte, restated explicite (design §16, NIE ciche)**:
1. Obie formuły progresu `maintain_range` (in-range/out-of-range binarne
   zamiast draftu-proponowanego falloff) i `binary` (sentinel 1/0)
   rozstrzygnięte przez fiat Integration Ownera (§-IO), nie przez
   odnaleziony wiążący dokument źródłowy planu. Jeśli Founder ma realną,
   udokumentowaną politykę firmy różną od tej — trzeba ją dostarczyć i
   przemigrować dane już policzone tą formułą.
2. `okr_vnext_key_result_source_bindings` (typed, pinned KR→KPI source
   binding na wzór `rvn_roi_benefit_evidence_links`) świadomie odroczone —
   D-E3-11/§-IO item 7. `source_type`/`source_reference` na KR to gołe
   TEXT bez FK, gotowe do rozbudowy przez późniejszy epik, ale z FK
   USUNIĘTYM względem wzorca ROI (D09 correction — OKR ma zero-FK regułę
   ostrzejszą niż ROI's "KPI jako opcjonalna ewidencja").

**Poza zakresem, świadomie NIEZBUDOWANE (design §16 items 4/9, nie
zapomniane)**: reconciliation etykiety `reach` (enum) ↔ "percentage
direct" (proza planu) — potraktowane jako ta sama geometria (brak 5.
wartości do zmapowania), ale nigdy dosłownie potwierdzone w źródle.
Status-suggestion threshold policy (§-IO item 9) — `status` na
Objective/KeyResult jest WYŁĄCZNIE owner-declared w tym epiku, brak
silnika automatycznej sugestii, brak `ALTER TABLE okr_vnext_programs` na
progi polityki — żadna z 5 ACs epiku nie wspomina `status`, automatyczna
sugestia to najpewniej terytorium OKR-E004 (`system_suggested_status` w
planowym `OKRCheckIn` YAML).

---

## 44. OKR-E004 Check-ins — implementacja + odbiór (2026-08-10)

Czwarty epik domeny OKR, pierwszy piszący WSTECZ do treści zbudowanej
przez E003 — check-in to jedyny mechanizm w całej domenie, który realnie
PORUSZA `current_value`/`progress`/`confidence` na Key Result i
`overall_progress`/`overall_confidence`/`attention_state`/`last_checkin_at`/
`next_checkin_due_at` na Set. Zbudowane wg `OKR_E004_DESIGN.md` §6-§11,
ratyfikowane przez blok §-IO (Integration Owner rulings) na czele
dokumentu — dokument sam stwierdza, że ten blok jest wiążący i nadpisuje
sprzeczne fragmenty draftu poniżej niego.

**IO-1 re-verification (obowiązkowy pierwszy krok)**: design E004 był
pisany W CZASIE gdy E003 jeszcze nie lądował — draft explicite oznaczał
FK targets/sygnaturę silnika progresu/kształt `generateCadenceOccurrences`
jako "best-effort projections", największe ryzyko całego dokumentu. Do
czasu implementacji E001/E002/E003 WSZYSTKIE wylądowały w tym worktree.
Wynik re-weryfikacji na żywym kodzie, nie na deklaracji designu:
- `okr_vnext_key_results`/`okr_vnext_objectives` (migracja
  `20260824_rvn_okr_objective_key_result.sql`) — kolumny/typy zgodne z
  projekcją designu, z JEDNĄ realną różnicą: landed schema używa
  `confidence`/`confidence_numeric_value` (nie `confidence_label`/
  `confidence_numeric` jak proponował draft) — nazwy kolumn checkin-a
  dopasowane do lądowanej konwencji E003 zamiast do słownictwa draftu,
  bo to jest dokładnie kolumna docelowa write-through (D6).
- `okrProgressEngine.ts::calculateKeyResultProgress`/
  `calculateObjectiveProgressRollup`/`calculateObjectiveConfidenceRollup` —
  realny, czysty, bez-DB eksport potwierdzony bezpośrednim odczytem. Ten
  epik REUŻYWA obie funkcje rollup Objective-owego bezpośrednio dla
  własnego Set-owego rollupu (`okrSetRollupCalculator.ts`'s
  `computeSetRollup`), traktując Objectives jak jeden poziom wyżej "KR-e"
  — zero duplikacji formuły equal/weighted-average/lowest_kr.
- `okrObjectiveCommands.ts::recomputeObjectiveRollup`/
  `resolveOkrCyclePinnedPolicySnapshot` — oba REUŻYTE bezpośrednio przez
  `recordCheckIn`/`correctCheckIn` (nie reimplementowane) — gwarantuje, że
  ten epik nigdy nie rozjedzie się z semantyką rollupu E003.
- `okrCycleScheduler.ts::generateCadenceOccurrences` zwracał TYLKO
  `{created, skippedExisting}` — dokładnie luka, którą draft's open
  question #8 przewidział. Rozwiązane addytywną zmianą (IO-6): nowe pole
  `createdOccurrenceIds: string[]`, wstecznie kompatybilne (żaden
  istniejący caller go nie czyta), własny commit, `okrCycleScheduler.realdb.test.ts`'s
  jeden test z `toEqual` na pełnym kształcie zaktualizowany.

**Druga realna luka znaleziona podczas implementacji (nie w designie)**:
`platform/obligations.ts::completeObligation`'s `UPDATE ... WHERE
organization_id=$1 AND reference_type=$2 AND reference_id=$3 AND
obligation_type=$4 AND status='open'` nie filtrował po
`cadence_occurrence_id` — dla KR z WIĘCEJ NIŻ jednym otwartym
`check_in` obligation naraz (przegapione okno + nowe okno), jeden
`recordCheckIn` zamykał WSZYSTKIE pasujące wiersze, nie tylko to jedno
okno. Naprawione addytywnym opcjonalnym parametrem `cadenceOccurrenceId`
(własny commit, IO-6) — dowiedzione bezpośrednio testem w
`okrCheckInRollup.realdb.test.ts`: dwa ręcznie zaseedowane otwarte
obligation dla TEGO SAMEGO KR na RÓŻNYCH oknach, `recordCheckIn` dla okna
A zamyka WYŁĄCZNIE okno A, okno B zostaje `open`.

**Schema** (`server/migrations/20260825_rvn_okr_checkin.sql` — draft
proponował nazwę `20260824_...` co KOLIDUJE z faktycznie wylądowanym
plikiem E003 o tej samej dacie; przemianowane na kolejną wolną datę,
zgodnie z własną instrukcją draftu "verify no collision"). Jedna nowa
tabela `okr_vnext_checkins`, czysto addytywna — **zero ALTER** na
`okr_vnext_checkin_occurrences` (dotrzymana obietnica E001 Decision P11:
"adds its own okr_vnext_checkins table with a real FK to this one — no
ALTER on this table required later") i **zero ALTER** na
`okr_vnext_sets` (E002 zarezerwowało 5 kolumn `overall_progress`/
`overall_confidence`/`attention_state`/`last_checkin_at`/
`next_checkin_due_at` explicite dla E003/E004 — potwierdzone verbatim w
`20260823_rvn_okr_set.sql`, ten epik jest dosłownie wypłatą tej dyscypliny
"reserve now, no ALTER later"). Kompozytowy unique index `UNIQUE
(key_result_id, cadence_occurrence_id) WHERE correction_of_checkin_id IS
NULL` — D2/D3, design's własna "landmine": `okr_vnext_checkin_occurrences`
jest scoped na Cycle (jeden wiersz per okno, DZIELONY przez wszystkie KR
w Cyklu), więc idempotencja SAMEGO `cadence_occurrence_id` dałaby
fałszywy negatyw (jeden KR blokowałby check-in innego KR w tym samym
oknie) — kompozyt jest jedynym poprawnym kluczem. `REVOKE UPDATE, DELETE
... FROM PUBLIC` (append-only, ten sam disclaimer co `rvn_kpi_measurements`/
`rvn_roi_actual_entries` o superuser bypass).

**Command layer** (`okrCheckInCommands.ts`): `recordCheckIn`/
`correctCheckIn`, oba przez `executeAtomicCreate` (KPI decision #12 —
NIGDY `executeAtomicCommand` z CAS na własnym agregacie checkin-u, bo
checkin nie ma poprzedniego stanu do CAS-owania). D4: drugi `recordCheckIn`
dla TEGO SAMEGO (KR, occurrence) jest ODRZUCONY 409
(`OkrCheckInAlreadyExistsForOccurrenceError`, nazywa istniejący
`checkin_id`), NIGDY po cichu skonwertowany na korektę — SAVEPOINT-wrapped
INSERT (wzorzec `createOkrSet` verbatim), catch `23505`, `ROLLBACK TO
SAVEPOINT`, re-SELECT istniejącego wiersza, throw. D6: write-through do
KR — `SELECT ... FOR UPDATE` (ROI-E004 D6's "pointer-update" shape, nie
CAS z `expectedVersion` od callera, bo check-in zawsze wygrywa nad tym co
jest), `calculateKeyResultProgress` w TEJ SAMEJ transakcji, `UPDATE
okr_vnext_key_results SET current_value/progress/progress_calc_reason/
out_of_range_distance/confidence/confidence_numeric_value/row_version+1`.
D8-D10: Set-level rollup, eager, ta sama transakcja —
`recomputeObjectiveRollup` (REUŻYTE) dla Objective, potem
`computeSetRollup` (własna, pure) dla Setu, agregując WSZYSTKIE
non-cancelled Objectives Setu (nie tylko dotknięty). `applySetRollupUpdate`
eksportowane, dzielone przez `recordCheckIn`/`correctCheckIn` I
scheduler (`detectAndFlagMissedCheckIns`) — jedna formuła, nie
duplikat.

**Otwarte pytanie designu #4 rozstrzygnięte konserwatywnie, restated
explicite (zgodnie z instrukcją zadania — NIE ciche rozstrzygnięcie)**:
czy check-in ma auto-pisać do autorytatywnego `okr_vnext_key_results.status`,
czy tylko wypełniać `system_suggested_status` jako doradcze? **Ta
implementacja NIGDY nie pisze do autorytatywnego `status`** — żaden AC nie
nazywa tej zdolności (IO-3), a E003's własny closure entry (§43 tego
dokumentu) już przewidział to pytanie jako terytorium E004.
`system_suggested_status` na wierszu checkin-u jest wypełniane WYŁĄCZNIE
dla przypadku definicyjnie wymuszonego przez silnik (geometria `binary`:
progress 1.0→'achieved', 0.0→'not_achieved') — każda inna geometria
wymagałaby wynalezionego progu progress→status (IO-5), więc zostaje
`null`. `owner_declared_status` zapisywane verbatim, też nigdy
auto-aplikowane do `status`. **To pytanie pozostaje otwarte dla
Foundera/kolejnej decyzji produktowej.**

**`attention_state` — IO-2 + IO-5 zastosowane bardziej restrykcyjnie niż
własny draft designu**: draft's własna propozycja `'action_required'`
wymagała progu wariancji progress-vs-oczekiwana-trajektoria — DWÓCH
wynalezionych wolnych parametrów (próg I model liniowej oczekiwanej
trajektorii), których żadne źródło nie precyzuje. Ta implementacja NIE
próbuje tego wcale: `computeSetRollup` zwraca WYŁĄCZNIE `'none'`/`'watch'`,
decydowane przez dwa czysto boolowskie, definicyjnie wymuszone fakty (
istnieje wartość confidence dosłownie równa `'low'`; check-in jest
dosłownie przeterminowany) — zero progu do strojenia.
`'action_required'`/`'escalated'` NIGDY nie są zwracane przez tę funkcję
— `'escalated'` była zawsze zarezerwowana dla akcji człowieka/managera
(prawdopodobnie OKR-E006), `'action_required'` to NAZWANA, OTWARTA LUKA
(nie po cichu zdegradowana do `'watch'` i zapomniana) — realna decyzja
Foundera potrzebna na polu progu w polityce Programu.

**AC-012 (izolujący AC) — `okrCheckInSuggestionService.ts`**: bezpośrednia
naprawa AS-IS naruszenia D09 (`okrService.ts::getSuggestedValueForKeyResult`
czyta `kpi_time_series` bezpośrednio i importuje `kpiDefinitionService.js`).
Dowód DWUWARSTWOWY: (1) statyczny test źródła (comment-stripped) —
zero importu z `kpiDefinitionService.js`/`resultsVnext/kpi/*`, zero
`SELECT`/`client.query`/importu `pg` w kodzie (nie w komentarzach — plik
MUSI dyskutować zakazane nazwy w prozie, to jest cała jego rola); (2)
behawioralny — czysta funkcja `suggestNextCheckInValue` czyta WYŁĄCZNIE
`OkrCheckIn[]` podany przez callera, naiwny liniowy trend z ≥2 punktów,
`no_history` dla <2. **Skutek uboczny**: pre-istniejący test
`okrD09ZeroFkIsolation.test.ts` (E008, już wylądowany na tej gałęzi) robi
całoplikowy skan tekstu bez stripowania komentarzy — złapał WŁASNE
komentarze dokumentacyjne tego pliku jako fałszywy pozytyw. Naprawione
dodaniem `okrCheckInSuggestionService.ts` do TEGO SAMEGO wzorca
wyjątku, który test już miał dla `okrLegacyArchiveRepository.ts`
("legitimately documents these names in prose") — dodany osobny,
comment-stripped re-check dla nowego pliku, mirror sibling'a.

**Scheduler** (`okrCheckInScheduler.ts`, NIE modyfikuje
`okrCycleScheduler.ts` poza addytywnym polem opisanym wyżej):
`generateCadenceOccurrencesAndSeedCheckInObligations` — seeduje
`check_in` obligation per (KR, nowo-utworzone occurrence), WYŁĄCZNIE dla
Setów `status='active'` (KR pod jeszcze-nie-aktywnym Setem nie ma ścieżki
do realnego wypełnienia check-inu — `recordCheckIn`'s własny
`SET_NOT_ACTIVE` guard by go odrzucił). `detectAndFlagMissedCheckIns` —
to jest MECHANIZM, który realnie spełnia AC-011's "brak check-in →
stale/attention, NIGDY syntetyczne 0%" dla Setów bez ŻADNEJ aktywności
check-in: bez tej funkcji `attention_state` aktualizowałby się WYŁĄCZNIE
reaktywnie (gdy JAKIŚ check-in się zdarzy na KTÓRYMKOLWIEK KR Setu),
nigdy niezależnie nie zauważając "całe okno się zamknęło bez niczego".
Jedna transakcja PER Set (nie jedna gigantyczna per Cykl) — pojedynczy
Set przegrywający lock-race jest złapany i pominięty, reszta przebiegu
kontynuuje (ten sam wzorzec co `proposeAndExecuteDueCycleTransitions`).
Żadna z dwóch funkcji nie jest podpięta pod żywy cron (P10 postawa E001).

**Brak self-verification-denial (D12, świadoma decyzja NIE budowania)**:
ROI-E004's D10 dodał taki check bo AC-03 explicite nazywa rolę "Actual
Verifier". Żaden AC OKR-E004 nie używa słowa "verifier" — komórka
Roles/visibility AC-010 nazywa "KR Owner, Manager", co czyta się jako
respond/escalate (plan §7.3: "manager responds rather than overwriting
owner evidence"), nie countersignature. Zastosowanie tej samej metodyki
analitycznej co ROI-E004 D9/D10 (czytaj dosłowne słowa AC, nie klonuj
strukturalnie silniejszą postawę siostrzanej domeny) → brak checku.

**Brak wymuszenia własności KR** (`submittedBy` nie musi równać się
`keyResult.ownerUserId`) — komórka "KR Owner, Manager" w AC traktowana
jako oczekiwanie UI/UX, nie server-side gate — zgodne z KAŻDĄ inną
komendą w wylądowanej domenie OKR (`createKeyResult`/`updateKeyResult`/
`createObjective` żadna nie wymusza "tylko właściciel może wywołać");
realną bramką w całej domenie jest ABAC przez visibility Setu.

**API** (`okr.routes.ts`, ten sam plik co E001-E003): 4 nowe endpointy —
`GET/POST .../key-results/:id/check-ins`, `POST .../check-ins/:id/correct`,
`GET .../key-results/:id/suggested-next-check-in-value`. Ostatni
odbiega od designu §11's tabeli, która zagnieżdżała suggestion pod
ISTNIEJĄCYM `:checkinId` — sugestia dla NASTĘPNEGO, jeszcze
niezłożonego check-inu nie ma realnej zależności od żadnego istniejącego
wiersza; potraktowane jako prawdopodobny błąd redakcyjny draftu, nie
ciche przeinterpretowanie (skomentowane inline). Brak `requireAdminWrite`
— ta sama postawa co routy KeyResult E003.

**Testy — 61 nowych**: 16 (`okrSetRollupCalculator.test.ts`, pure, każda
kombinacja `objective_rollup_model`/`objective_confidence_model`) + 7
(`okrCheckInSuggestion.test.ts`, AC-012 statyczny+behawioralny) + 5
(`okrCheckInAppendOnly.realdb.test.ts`, kompozytowa idempotencja + D4 409
+ append-only chain + NOLOGIN role) + 7 (`okrCheckInRollup.realdb.test.ts`,
KR/Objective/Set write-through + zero-checkin null-nie-0 + low-confidence
obligation + `cadenceOccurrenceId` filter fix) + 4
(`okrCheckInVisibilityJoin.realdb.test.ts`, `::text` cast OPEN_ORG/
RESTRICTED_ACL/PRIVATE + currentOnly) + 5
(`okrCheckInScheduler.realdb.test.ts`, seeding idempotency + missed-window
detection idempotency + active-only) + 17 (route-contract, `okr.routes.test.ts`
rozszerzony, 91/91 PASS łącznie z 74 pre-existing). Plus 2 pre-existing
testy zaktualizowane (nie nowa asercja, fixture/exemption update dla
addytywnych zmian tego epiku): `okrCycleScheduler.realdb.test.ts`'s
`toEqual` na pełnym kształcie `generateCadenceOccurrences`,
`okrD09ZeroFkIsolation.test.ts`'s exemption list.

Wszystkie testy PASS na efemerycznym Postgresie 17 (`initdb --locale=C`,
TCP 127.0.0.1, wolny port, `NODE_ENV=test`). `npx tsc --noEmit`
(`NODE_OPTIONS=--max-old-space-size=8192`) czysty — 0 błędów, zweryfikowany
dwukrotnie (po command layer + routes, i po dodaniu wszystkich testów).

**Weryfikacja before/after pełnych suit**: `tests/resultsVnext/okr` — PRZED
tym epikiem 20 plików (niezmienione, wszystkie nadal PASS), PO tym epiku
26 plików/223 testy, **0 fail, 0 regresji** w żadnym z 20 pre-existing
plików. `tests/resultsVnext/kpi` — 0 fail (pełna suita zielona,
niedotknięta tym epikiem). `tests/resultsVnext/roi` — **33 testy failują w
18 plikach**, IDENTYCZNY pre-existing root cause już udokumentowany w §37
i ponownie w §43: `initiatives_organization_id_fkey` — fixture'y ROI
nigdy nie wstawiają swojego `ORG_ID` do `organizations` przed insertem do
`initiatives`. Ta sesja nie dotknęła ŻADNEGO pliku w
`server/src/services/resultsVnext/roi/` ani `tests/resultsVnext/roi/` —
przyczynowość wykluczona strukturalnie (grep potwierdza zero importu
`okr/*` w jakimkolwiek pliku ROI), nie tylko zaobserwowana zerowym diffem.
`server/src/routes/resultsVnext/__tests__/okr.routes.test.ts` — 91/91 PASS
(17 nowych, 74 pre-existing nietknięte).

**Nadal otwarte, restated explicite (design §14, NIE ciche)**:
1. `attention_state`'s heuristic `'action_required'`/`'escalated'` progi
   (IO-2/IO-5) — brak pola polityki na `okr_vnext_programs`, brak
   wynalezionego progu; obecnie funkcja NIGDY nie zwraca tych dwóch
   wartości. Realna decyzja Foundera potrzebna: czy nowe nullable pole
   polityki (koszt: ALTER na być może już zamieszkanej tabeli), czy
   hardcoded fallback dla MVP z polem zarezerwowanym na później.
2. Czy check-in ma auto-pisać `okr_vnext_key_results.status`
   (autorytatywny), czy tylko `system_suggested_status` (doradczy,
   obecny wybór tej implementacji)? Żaden AC nie rozstrzyga — design's
   open question #4, E003's własny closure entry już to przewidział jako
   terytorium E004, nadal otwarte.
3. Granica `support_requested`/`blocker` → OKR-E006: ta implementacja
   zapisuje oba pola WYŁĄCZNIE na wierszu checkin-u (free-text), zakłada,
   że E006 będzie je czytać bezpośrednio z `okr_vnext_checkins` (bez FK w
   żadną stronę, zgodnie z D09) — nigdy nie potwierdzone żadnym AC,
   restated forward zamiast cicho założone, ten sam wzorzec co OKR-E002
   D13's `resolveScopeVisibility` gap.

---

## 45. OKR-E005 Alignment — implementacja + odbiór (2026-08-10)

Piąty epik domeny OKR, budowany w IZOLOWANYM WORKTREE równolegle z OKR-E004
(inny agent, inny worktree) — ten worktree zaczynał od `codex/results-vnext-g0-20260809`
(zweryfikowane `git log --oneline -5` na starcie: E001/E002/E003 widoczne),
NIE ma commitów E004 (inny agent, inny worktree — nie jest to regresja,
tylko brak wglądu w równoległą pracę do scalenia przez orkiestratora).
Zbudowane wg `OKR_E005_DESIGN.md` §A-§J, ratyfikowane przez blok §-IO na
czele dokumentu.

**IO-1 re-verification — RZECZYWISTY rozjazd znaleziony i udokumentowany**:
draft designu (pisany, gdy E001-E004 nie istniały jeszcze jako kod) założył,
że OKR-E003 zarejestruje NOWY resource_type `'okr_objective'`
(`RVN_RESOURCE_TYPES`/`rvn_platform_resource_visibility`) dla Objectives, i
że warstwa odczytu E005 będzie joinować bezpośrednio przeciw niemu.
Bezpośrednie odczytanie WYLĄDOWANEGO `okrObjectiveRepository.ts`/
`okrObjectiveCommands.ts`/`20260824_rvn_okr_objective_key_result.sql`
pokazuje inny, prostszy wybór E003: Objectives/KeyResults NIE MAJĄ
niezależnego resource_type — dziedziczą widoczność WYŁĄCZNIE przez `set_id`
rodzica-Setu, jego własny wiersz `'okr_set'`. Cała warstwa E005 (komendy +
repozytorium) napisana przeciw temu REALNEMU kształtowi, nie założeniu
draftu — każdy join podwójnej widoczności w `okrAlignmentRepository.ts`
łączy się przez `okr_vnext_objectives.set_id` do `'okr_set'`, nigdy do
nieistniejącego `'okr_objective'`. Druga konsekwencja: `aggregateType`
zdarzeń jest typowany na `RvnResourceType` (unia z `resourceTypes.ts`) —
E003 rozwiązało to pożyczając tożsamość rodzica-Setu (`aggregateType:'okr_set'`,
`aggregateId: setId`) dla zdarzeń Objective/KeyResult; Alignment nie ma
JEDNEGO właściciela-Setu (dwa peer-endpointy, potencjalnie różne Sety), więc
zamiast pożyczać cudzą tożsamość, dopisano `'okr_alignment'` do
`RVN_RESOURCE_TYPES`/`CanonicalObjectTypeValues` — DODATKOWA, addytywna,
wstecznie kompatybilna zmiana dozwolona wprost przez IO-6 ("permitted only
when additive and strictly backward-compatible"), z komentarzem wprost
mówiącym że to WYŁĄCZNIE dla tagowania zdarzeń, nie dla wiersza ABAC
(`okr_vnext_alignments` nigdy nie dostaje własnego wiersza
`rvn_platform_resource_visibility` — ten sam wzorzec co `'okr_program'`/`'okr_cycle'`).

**Schema** (`server/migrations/20260825_rvn_okr_alignment.sql`): jedna
nowa tabela `okr_vnext_alignments` — `source_objective_id`/`target_objective_id`
(UUID FK do `okr_vnext_objectives`), `relation` (CHECK jeden legalny
wariant `'contributes_to'` — "supports"/"depends-on" z brief zadania to
spekulacja niepoparta żadnym AC, NIE zaimplementowane), `status`
(`proposed|accepted|rejected|removed`), `source_cycle_id`/`target_cycle_id`
zdenormalizowane (Postgres CHECK nie może odwoływać się do innej tabeli) z
REALNYM `CHECK (source_cycle_id = target_cycle_id)` — OKR-F-016. Unique
index częściowy `ux_okr_vnext_alignments_live_edge` na
`(organization_id, source_objective_id, target_objective_id, relation)
WHERE status IN ('proposed','accepted')` — rejected/removed zwalnia slot
(ten sam wzorzec co D3 OKR-E002's `ux_okr_vnext_sets_one_per_scope_cycle_owner`).
**Zero triggerów w tej migracji** — Layer 1 czteropoziomowego dowodu
no-score-inheritance.

**★ Serce epiku — czteropoziomowy dowód "brak FK/roll-up inheritance"
(D09/OKR-F-015, dosłowny tekst acceptance-evidence z D09 w
`01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md` §2), WSZYSTKIE 4 warstwy
ZIELONE**:
1. **DDL absence** — migracja bez `CREATE TRIGGER`, potwierdzone statycznie
   w Layer 2 i introspekcyjnie w Layer 4.
2. **Static source-text proof** (`alignmentNoScoreMutation.static.test.ts`,
   8/8 PASS) — wzorowane dosłownie na `teresa-kpi-forbidden-verbs.test.ts`
   (KPI-E006): jedyny import z `okrObjectiveCommands.js` to
   `OkrObjectiveNotFoundError` (czysta klasa błędu, nie funkcja mutująca);
   ZERO importu z `okrKeyResultCommands.js` w ogóle; żaden z 7 zakazanych
   czasowników (`updateObjective`/`cancelObjective`/`createObjective`/
   `recomputeObjectiveRollup`/`createKeyResult`/`updateKeyResult`/
   `cancelKeyResult`) nie występuje jako import ani jako wywołanie `verb(`
   w kodzie nie-komentarzowym; żaden surowy SQL `UPDATE/INSERT/DELETE
   okr_vnext_objectives|okr_vnext_key_results` nigdzie w
   `okrAlignmentCommands.ts`/`okrAlignmentRepository.ts`.
3. **realDB full-row-equality proof** (`alignmentNoScoreMutation.realdb.test.ts`,
   5/5 PASS) — dwa Objectives z realnym, silnikiem policzonym `progress`
   (via KeyResult pod każdym; **znaleziony i naprawiony bug fixture**:
   `createProgram`'s domyślny `objectiveRollupModel='none'` czyni `progress`
   trwale `not_calculable`/NULL niezależnie od KR — przypięte do
   `'equal_average'`, inaczej test dowodziłby niczego). Po KAŻDEJ
   pojedynczej komendzie (propose→accept; propose→reject;
   propose→accept→remove) `SELECT *` obu Objectives porównany `toEqual`
   PRZED i PO — nie tylko `progress`/`confidence`, CAŁY wiersz.
4. **DB trigger-introspection proof** (ten sam plik) — `information_schema.triggers`
   dla `okr_vnext_objectives`/`okr_vnext_key_results` ma DOSŁOWNIE ZERO
   wierszy dzisiaj (silniejsza asercja), plus osobna asercja scoped do
   "brak triggera z 'alignment' w nazwie/action_statement" (przetrwa
   niezwiązaną przyszłą zmianę).

**Cycle detection (OKR-F-016-AC-01)** — ogólna grafowa reachability (DAG,
NIE algorytm łańcucha-jednego-rodzica z `managementChainMaintenance.ts` —
alignment to many-to-many, Objective może mieć wiele wychodzących I
przychodzących krawędzi). Bounded recursive CTE (`assertNoAlignmentCycle`),
liczy WYŁĄCZNIE krawędzie `status='accepted'`. Sprawdzane PRZY PROPOSE
(dosłowne "walidacja przy create" z AC) ORAZ przy ACCEPT (design dodatek,
restated explicite, nie cichy) — `okrAlignmentCycleDetection.realdb.test.ts`
(4/4 PASS) dowodzi bezpośredniego 2-węzłowego cyklu, transitywnego
3-węzłowego, sanity-checku niepowiązanych krawędzi, ORAZ dokładnie
scenariusza rasy z designu: `B→C` i `C→A` każdy z osobna acykliczny w
momencie swojego propose (tylko `A→B` accepted), ale zaakceptowanie OBU
zamyka `A→B→C→A` — propose-time checki tego NIE widzą, tylko accept-time
re-check łapie DRUGĄ akceptację i zostawia wiersz nietknięty (`'proposed'`).

**Cross-cycle/cross-org (OKR-F-016)** —
`okrAlignmentCycleBoundary.realdb.test.ts` (4/4 PASS): command-layer
pre-check (`OkrAlignmentCycleMismatchError`) ORAZ bezpośredni INSERT z
pominięciem warstwy komend dowodzą, że `CHECK (source_cycle_id =
target_cycle_id)` to REALNY constraint bazy, nie tylko walidacja
app-code. Cross-org: każdy lookup w `proposeAlignment` jest
organization_id-scoped z konstrukcji — Objective z innej org jest po
prostu `OkrObjectiveNotFoundError`, bez osobnego specjalnego checku.

**Cross-visibility "absent, not redacted" (OKR-F-017-AC-01)** —
`okrAlignmentVisibilityJoin.realdb.test.ts` (9/9 PASS): KAŻDY odczyt w
`okrAlignmentRepository.ts` joinuje CTE widoczności DWA razy (raz na
endpoint, przez `set_id` każdego Objective — IO-1 divergence, nie
nieistniejący `'okr_objective'`) — oba endpointy muszą przejść, inaczej
krawędź jest CAŁKOWICIE nieobecna (żaden licznik/placeholder "1 ukryte
wyrównanie"). Cztery wymagane minimum kombinacje (both-visible/
source-hidden/target-hidden/both-hidden) dowiedzione dla
`listAlignmentsForObjective` I `getAlignmentTreeUnderObjective`. §F "stop,
don't skip" semantyka drzewa dowiedziona bezpośrednio: spacer w górę od
widocznego węzła zatrzymuje się na pierwszym niewidocznym węźle, NIE
pomija go by odsłonić dalszy widoczny węzeł za nim. `::text` cast
dowiedziony bezpośrednio (surowe UUID=TEXT porównanie rzuca, wersja z
castem wykonuje się). Break-glass Auditor: NIE zbudowany fixture (ten sam
precedens co `okrSetVisibilityJoin.realdb.test.ts` E002 — emisja
break-glass audit-event nie jest zbudowana nigdzie w tej platformie,
restated, nie obejście na około).

**Brak materialized closure table** (design §F) — 4 niezależne powody
(alignment opcjonalny/many-to-many vs. management chain
obowiązkowy/single-parent; alignment nie jest hot-pathem współdzielonym
między 3 domenami; V2 dla interaktywnego grafu; cycle prevention już czyni
graf acykliczny konstrukcyjnie) — bounded recursive CTE wystarcza.

**Command layer** (`okrAlignmentCommands.ts`): `proposeAlignment`
(executeAtomicCreate, SAVEPOINT dedupe wzorowany dosłownie na
`createOkrSet`), `acceptAlignment`/`rejectAlignment`/`removeAlignment`
(executeAtomicCommand, CAS na `alignment_id`). `OkrAlignmentNotOwnerError`
wydzielony z generycznego `OkrAlignmentValidationError` PO sprawdzeniu
własnej tabeli mapowania błędów designu §H: "ACL/Owner-check failure→403"
to OSOBNA linia od "ObjectiveAlignmentValidationError→409 (self-loop, zła
tranzycja)" — złożenie obu w jedną klasę dałoby zły status HTTP dla
odmowy uprawnień (ten sam reżim co `OkrSetSelfApprovalDeniedError` vs
`OkrSetValidationError`). `removeAlignment`: albo-endpoint-Owner (design
§J item 5, considered default, restated jako niepotwierdzone). Naming:
`OkrAlignment*Error` (nie `ObjectiveAlignment*Error` z draftu) — zgodne z
REALNĄ konwencją lądowanego kodu (`OkrSet*`/`OkrObjective*`/`OkrCycle*`),
deviation stated explicite.

**Repository** (`okrAlignmentRepository.ts`): `listAlignmentsForObjective`,
`getAlignmentTreeUnderObjective` — bug znaleziony i naprawiony PRZED
commitem: rekurencyjne CTE wymaga `WITH RECURSIVE`, ale
`wrapWithVisibilityScope` emituje wyłącznie zwykłe `WITH` — naprawione
użyciem `buildVisibilityScopedCte` bezpośrednio i ręcznym sklejeniem CTE
(udokumentowany alternatywny tryb użycia tej funkcji: "strip the leading
'WITH ' and splice as one more comma-separated CTE").

**HTTP layer**: 6 nowych routes na współdzielonym `okr.routes.ts`
(`POST/GET .../objectives/:objectiveId/alignments`, `GET
.../objectives/:objectiveId/alignment-tree`, `POST
.../alignments/:alignmentId/{accept,reject,remove}`) — `DELETE` z designu
zmapowany na guarded `POST .../remove`, ten sam wzorzec co
`cancelObjective`/`cancelKeyResult` już w tym pliku. Brak
`requireAdminWrite` — autoryzacja per-record (Owner check) w warstwie
komend, ten sam reżim co Set/Objective bloki.

**Liczby testów tego epiku**: 8 (static no-score) + 5 (realdb no-score) + 4
(create: self-loop/owner/visibility/dedupe-race) + 4 (cycle detection) + 4
(cycle boundary) + 9 (visibility-join) + 12 (lifecycle) + 21
(route-contract, wliczone w 100/100 pliku) = **67 nowych testów** we
własnych plikach + 21 route-contract = **88 nowych testów**, wszystkie PASS
na efemerycznym Postgresie 17 (`initdb --locale=C`, TCP 127.0.0.1,
`NODE_ENV=test`). `npx tsc --noEmit`
(`NODE_OPTIONS=--max-old-space-size=8192`) czysty — 0 błędów.

**Weryfikacja before/after pełnych suit**: `tests/resultsVnext/okr` (28
plików łącznie z `okr.routes.test.ts` w `server/src/routes/`) —
**324/324 PASS w 28 plikach** na tej samej efemerycznej bazie (baseline
przed rozpoczęciem tego epiku w TYM worktree: E001+E002+E003+E008 landed,
brak plików `okrAlignment*` — więc 88 nowych testów netto, zero regresji w
21 istniejących plikach OKR). Pełna suita `tests/resultsVnext` (86 plików,
578 testów): **509 PASS / 52 FAIL / 17 skip**. **ZERO** z 52 failing testów
dotyczy pliku `okr`/`alignment` (zweryfikowane grep po pełnej liście 28
failing plików) — wszystkie 28 failing plików to ROI/KPI/Teresa realdb
testy padające na `initiatives_status_check`/`initiatives_organization_id_fkey`,
DOKŁADNIE ten sam PRZEDISTNIEJĄCY defekt udokumentowany w §37/§43 tego
dokumentu (fixture'y ROI/KPI nigdy nie wstawiają `ORG_ID` do
`organizations` przed insertem do `initiatives`, lub insertują status
`'step3'` którego `initiatives_status_check` nie akceptuje na świeżo
zmigrowanej bazie) — przyczynowość wykluczona strukturalnie (brak importu
`okr/*` w żadnym pliku ROI/KPI).

**Nadal otwarte, restated explicite (design §J, NIE ciche) — 12 punktów z
draftu, żaden nie rozstrzygnięty ciszej niż tam zapisano**:
1. OKR-E004 (Check-ins) nie było widoczne w TYM worktree w chwili budowy
   (inny agent, inny worktree, do scalenia przez orkiestratora) — design
   E005 nie zakłada nic o Check-inach.
2. Tylko `contributes_to` ma pokrycie AC — "supports"/"depends-on" to
   spekulacja task briefu, NIE zbudowane.
3. Reguła cross-cycle (§C: ten sam `cycle_id`) może być ZA OSTRA dla
   `annual_direction_enabled` (roczne↔kwartalne wyrównanie) — niepotwierdzone,
   wymaga modelu kadencji OKR-E003/E004.
4. Self-accept (source Owner == target Owner) dozwolony bez
   maker-checker — considered default z §J item 4 rozumowania "alignment
   nigdy nie dotyka score", NIE potwierdzony żadnym AC.
5. `removeAlignment`'s albo-endpoint-Owner authority — domyślny wybór, nie
   potwierdzony AC.
6-7. Propose-time target-visibility / accept-time source-re-visibility —
   strukturalne dodatki designu §E, nie AC-sourced.
8. `review_alignment_proposal` obligation — dodatek designu, nie AC-sourced
   (niskiego ryzyka, `obligationType` to free-text).
9. Strict "absent, no soft hint" — najostrzejsza obronna interpretacja
   §7.4, real product mógłby chcieć miękkiej podpowiedzi "są ukryte
   wyrównania"; nie rozstrzygnięte tutaj.
10. `buildVisibilityScopedCte`'s PRIVATE-branch owner-bypass gap —
    pre-existing platform-layer pytanie (`visibilityScopedQuery.ts`), poza
    file ownership tego epiku.
11. `maxDepth=6` dla drzewa wyrównań — arbitralny, niesourced z AC.
12. Czy zamknięte/zarchiwizowane Cykle mogą przyjmować NOWE propozycje
    wyrównania — nie adresowane przez żaden AC w tej rundzie.

## 46. OKR-E007 Review & Learning — implementacja + odbiór (2026-08-10)

Siódmy, terminal-lifecycle epik domeny OKR — analogon ROI-E006 (PIR &
Learning), zamyka cykl Set/Cycle: `active → review → closed`, plus
mechanizm carry-forward bez analogu w ROI/KPI. Budowany wg
`OKR_E007_DESIGN.md` §-IO→§9, ratyfikowany blokiem §-IO na czele
dokumentu. **IO-1 (mandatory)**: E001-E005 wylądowały PRZED rozpoczęciem
tej pracy (E004+E005 scalone chwilę wcześniej, zweryfikowane razem na
385 testach) — każde cross-referencyjne założenie designu zweryfikowane
bezpośrednim czytaniem wylądowanego kodu, nie dokumentów draftowych.

**Rozjazdy IO-1 znalezione i udokumentowane (zgodnie z briefem — dwa
oczekiwane, plus jeden dodatkowy)**:
1. **E003 NIE zarejestrowało `'okr_objective'` jako resource_type** —
   Objectives/KeyResults (a przez dziedziczenie: Reflections/Reviews tego
   epiku) mają widoczność WYŁĄCZNIE przez `set_id` rodzica-Setu, zero
   niezależnego wiersza ABAC. Ten sam wzorzec E005 już potwierdziło —
   trzecie niezależne potwierdzenie tego samego faktu w tym worktree.
2. **Kolumny confidence E003 to `confidence`/`confidence_numeric_value`**
   (nie zgadywane wcześniej nazwy) — potwierdzone bezpośrednim odczytem
   `okrObjectiveTypes.ts`/`okrKeyResultTypes.ts`.
3. **DODATKOWY, nieoczekiwany rozjazd**: `okr_vnext_objectives`' kolumna
   FK do rodzica-Setu to `set_id`, NIE `okr_set_id` jak zapisał szkic DDL
   designu w §3 (przeniesione 1:1 z draftu bez re-weryfikacji na etapie
   pisania dokumentu). Cała warstwa komend tego epiku (finalScoreOkrSet,
   closeOkrSet, guard reflection-completeness) czyta/pisze przez REALNĄ
   nazwę `set_id`.
4. **IO-2 okazało się nie dotyczyć niczego w praktyce** — design zakładał
   możliwy brak kolumn polityki na `okr_vnext_programs`
   (`scoring_model`/`manager_review_required`/`self_review_required`/
   `reflection_required_for_close`); bezpośredni odczyt
   `okrProgramTypes.ts` potwierdza, że WSZYSTKIE cztery już istnieją
   (wylądowane przez E001) — zero ALTER na tej tabeli był kiedykolwiek
   potrzebny.
5. **Guard slot NIE istniał** w wylądowanym
   `OkrCycleLifecycleTransitionSpec`/`runOkrCycleLifecycleTransition`
   (design D9 zakładał, że istnieje, powołując się na analogiczny slot
   ROI) — dodany w tym epiku jako addytywne, wstecznie kompatybilne
   rozszerzenie (IO-6), zero zmiany zachowania dla `OKR_CYCLE_OPEN_DRAFTING_SPEC`/
   `OKR_CYCLE_ACTIVATE_SPEC`/`OKR_CYCLE_OPEN_REVIEW_SPEC`/`OKR_CYCLE_CANCEL_SPEC`
   (żaden nie ustawia `guard`).

**Schema** (`server/migrations/20260826_rvn_okr_review_reflection.sql`):
`okr_vnext_reflections` — jeden wiersz na Objective (D3), dwóch pisarzy
(finalScoreOkrSet zamraża pole score, recordObjectiveReflection pisze
narrację), dwustopniowe zamrożenie (D4) przez
`okr_vnext_reflection_protect_frozen` (trigger, ERRCODE 23001, dowiedziony
realnym UPDATE na realnym Postgresie — 23001 na próbie dotknięcia
chronionego pola, sukces na no-op UPDATE spoza chronionej listy).
`okr_vnext_reviews` — jeden wiersz na `(set_id, review_type)` (D5),
`comments` JSONB append-only array. `okr_vnext_sets.carried_from_set_id`
— addytywny ALTER (D15), nowa kolumna nullable + partial index. **Zero
nowej tabeli zdarzeń** — D14 potwierdzone: `rvn_platform_events` (RN-G1)
to jedyny realny ledger, `okr_vnext_events` nigdy nie istniało jako
tabela.

**Command layer** (`okrReflectionCommands.ts`/`okrReviewCommands.ts`/
`okrCarryForwardCommands.ts`, extends `okrSetCommands.ts`/
`okrCycleCommands.ts`/`okrCycleScheduler.ts`):
- `finalScoreOkrSet` — batch Set-level, `executeAtomicCommand` CAS'owany
  na `okr_vnext_sets.row_version`, guard `status==='review'`, czyta
  PINNED policy snapshot Cyklu (D11), `applyOkrScoringModel` (D2):
  `zero_to_one`/`percentage` przepuszczają `objective.progress` (surowy,
  nieklampowany ratio z silnika E003, potwierdzone bezpośrednim odczytem
  `okrProgressEngine.ts`'s własnej reguły §-IO) bez rekalkulacji;
  `categories`/`custom` **honestly stubbed** — `final_score=NULL`,
  `scoring_model_unsupported=true`, ZERO wymyślonego progu (IO-5) —
  potwierdzone testem że żadna wartość liczbowa nigdy nie ląduje dla tych
  dwóch modeli. Upsert `ON CONFLICT (objective_id) DO UPDATE ... WHERE
  status='draft'` — rerun aktualizuje TEN SAM wiersz, nigdy duplikat
  (dowiedzione bezpośrednim `COUNT(*)`).
- `recordObjectiveReflection` — **ręcznie skręcony** BEGIN/mutacja/event
  (idempotency-guarded via `EVENT_INSERT_SQL`)/outbox/COMMIT, bo
  `executeAtomicCommand` zakłada istniejący wiersz, a ta komenda musi
  wspierać "jeszcze nie istnieje" (Owner może refleksować przed
  finalScoreOkrSet). Konwencja `expectedVersion=0` = create,
  `expectedVersion>=1` = CAS istniejącego — udokumentowana explicite w
  nagłówku pliku jako rozszerzenie tego pliku, nie wzorzec platformowy.
- `okrReviewCommands.ts` — 5 komend + `listOkrSetReviews`.
  `OkrManagerReviewSelfApprovalDeniedError` (D6, **nigdy
  `SelfReviewDenied*`** — terminologia `self_review_required` [flaga
  polityki, plain eligibility check] vs "self-review denial" [maker-checker
  na MANAGER review] to dwa niepowiązane pojęcia, nazwane rozdzielnie
  explicite) sprawdzany PRZED jakimkolwiek zapisem, na DWÓCH osobnych
  gałęziach (`submitted_by`, `owner_user_id`/`created_by`) — obie
  dowiedzione OSOBNYMI testami na realnym Postgresie, żeby nie dało się
  przypadkiem pokryć tylko jednej. `submitOkrSetSelfReview`'s "musi być
  Ownerem" to PLAIN guard (`OkrReviewValidationError`), nie denial —
  Program PROSI Ownera o self-review, wymaganie inaczej zaprzeczałoby
  funkcji.
- `closeOkrSet` (extends `okrSetCommands.ts`) — dokładna kolejność §4.5:
  (1) guard `status==='review'`; (2) PINNED policy snapshot (D11, nigdy
  żywy odczyt Programu — dowiedzione: publikacja nowej wersji polityki po
  utworzeniu Cyklu nie zmienia wymagań już-aktywnego Cyklu, bo to
  dziedziczy się z E001's fundamentu); (3) manager-review gate; (4)
  self-review gate; (5) reflection-completeness gate (listuje KAŻDY
  brakujący Objective, nie tylko pierwszy — dowiedzione testem z dwoma
  Objectives, jednym kompletnym); (6) finalizuje WSZYSTKIE `status='draft'`
  reflections dla Setu w TEJ SAMEJ transakcji, nawet niekompletne (D4);
  (7) zamyka Set. **Brak self-close check** (D10, świadome odejście od
  ROI-E006's `RoiPirSelfCloseDeniedError`) — dowiedzione bezpośrednio:
  Owner=created_by zamyka WŁASNY Set z każdą bramką WYŁĄCZONĄ i to
  SUKCES, bo OKR (w przeciwieństwie do ROI) ma już
  `manager_review_required` dającą tę samą ochronę transytywnie gdy
  włączona; wyłączona = Program świadomie zrezygnował z ochrony.
- `okrCycleCommands.ts` — nowy `guard?:` slot na
  `OkrCycleLifecycleTransitionSpec`, wywoływany PO sprawdzeniu
  `fromStatuses` a PRZED UPDATE. `OKR_CYCLE_CLOSE_SPEC` dostaje realny
  guard: `SELECT set_id FROM okr_vnext_sets WHERE cycle_id=$1 AND status
  NOT IN ('closed','cancelled','not_required')` — niepusty wynik rzuca
  `OkrCycleHasOpenSetsError` PRZED jakimkolwiek zapisem (dowiedzione: Cykl
  zostaje w `'review'`, nie `'closed'`, po odrzuconej próbie).
- `okrCycleScheduler.ts` — `cascadeOkrSetsToReview` (nowa), ten sam
  wzorzec service-actor (`actorUserId=null`,
  `actorEffectiveRole='system:okr_cycle_scheduler'`) co istniejące
  `proposeAndExecuteDueCycleTransitions`.
- `carryForwardOkrSet` (D8/D17) — cienki wrapper wokół E002's
  `createOkrSet` (dedupe SAVEPOINT ponownie użyty, nie
  reimplementowany), guard źródło `status==='closed'`, guard cel
  `status IN ('planned','drafting')`. **D8 dowiedzione bezpośrednio**:
  carried Set ma ZERO wierszy `okr_vnext_objectives` (COUNT=0) — żadna
  treść nie kopiuje się, tylko `carried_from_set_id` wskaźnik. D16
  (`carried_from_objective_id` na `okr_vnext_objectives`) restated
  forward dla przyszłej sesji E003/E008 — E003 nie zarezerwowało tej
  kolumny, więc "carried Objective = nowy wiersz z pointerem, nigdy
  przeniesienie" pozostaje wymaganiem nieukończonym poza tym epikiem.
- `okrSetHistoryRepository.ts` — `getOkrSetHistory` (D12-D14): jedno
  zapytanie `rvn_platform_events WHERE aggregate_type='okr_set' AND
  aggregate_id=$setId`, keyset pagination po `sequence`, scalone w
  aplikacji z `okr_vnext_set_versions` (E002's OKRMaterialChange — tylko
  na PIERWSZEJ stronie, świadomy, udokumentowany tradeoff unikający
  duplikacji przy paginacji). Autoryzacja: ten sam gate co `getOkrSet`,
  sprawdzony RAZ na starcie — outsider dostaje pustą stronę, nie błąd.

**HTTP layer**: 11 nowych routes na współdzielonym `okr.routes.ts`
(`open-review` reużywa generyczny helper Setu z nowym spec-iem;
`final-score`/`objectives/:id/reflection`/`reviews/self/submit`/
`reviews/manager/{submit,approve,request-changes}`/
`reviews/:reviewType/comments`/`GET reviews`/`close`/`carry-forward`/
`GET history` — ręcznie wpięte). Error-mapping: `OkrManagerReviewSelfApprovalDeniedError`→403,
`OkrSetManagerReviewRequiredError`/`OkrSetSelfReviewRequiredError`/
`OkrSetReflectionRequiredError`/`OkrCycleHasOpenSetsError`→409 (spread
`details`), `OkrReviewNotFoundError`/`OkrReflectionNotFoundError`→404.

**Real gap znaleziony i FLAGOWANY (nie ukrywany) — brak GET route dla
treści Reflection**: design's §6 API table nazywa `POST
.../objectives/:id/reflection` (write) ale ŻADEN `GET` dla odczytu treści
refleksji — divergence od "every writable aggregate ma matching read
path" konwencji tego programu. Zgodnie z IO-3 ("no capability without an
AC naming it") — NIE zbudowano nieautoryzowanego route'u żeby "naprawić"
to po cichu. `okrReflectionVisibilityJoin.realdb.test.ts` (wymagany przez
§7 pliku designu) zamiast tego dowodzi kształt joina (`::text` cast,
PRIVATE-mode denial) bezpośrednim SQL, imitując realny join, jaki
przyszła funkcja odczytu by użyła — nie wymyślając nieroutowanej
funkcji repozytorium żeby test przeszedł.

**Liczby testów tego epiku**: 7 (finalScoreOkrSet: dispatch/upsert/guard)
+ 6 (reflection lifecycle + protect-frozen trigger + close-gate) + 8
(manager/self review: submit/D6 oba branch/approve/request-changes/resubmit/comment)
+ 5 (closeOkrSet: trzy bramki + D10 + not-review guard) + 3 (Cycle-close
guard D9) + 4 (carryForward: lineage/dedupe/oba guardy) + 3
(getOkrSetHistory: merged/visibility/pagination) + 2 (visibility-join:
reviews realny + reflections direct-proof) + 27 (route-contract,
`okrReview.routes.test.ts`) = **65 nowych testów**, wszystkie PASS na
efemerycznym Postgresie 17 (`initdb --locale=C`, TCP `127.0.0.1:28791`,
`NODE_ENV=test`, gniazdo w `/private/tmp`). `npx tsc --noEmit`
(`NODE_OPTIONS=--max-old-space-size=8192`, `server/tsconfig.json`) —
**0 błędów związanych z OKR** (28 przedistniejących błędów
`roiCalculationEngine.ts`/decimal.js, zero powiązania z tym epikiem,
plik nigdy nietknięty w tym worktree, potwierdzone `git diff` puste).

**Weryfikacja before/after pełnych suit**: `tests/resultsVnext/okr` (33
plików) + `okr.routes.test.ts` + `okrReview.routes.test.ts` (2 pliki w
`server/src/routes/`) = **43 pliki, 450/450 PASS** na tej samej
efemerycznej bazie (baseline przed rozpoczęciem tego epiku: 385 testów w
34 plikach po scaleniu E004+E005 — więc 65 nowych testów netto, **zero
regresji** w 34 istniejących plikach OKR, uruchomionych RAZEM w jednym
przebiegu, nie osobno). `tests/resultsVnext/roi` + `tests/resultsVnext/kpi`
razem: **299 PASS / 33 FAIL / 8 skip** — wszystkie 33 failing to
DOKŁADNIE ten sam PRZEDISTNIEJĄCY defekt `initiatives_organization_id_fkey`
udokumentowany w §37 tego dokumentu (i restated w brief zadania tej
sesji), NIE regresja tego epiku — żaden plik ROI/KPI nie importuje
`okr/*`.

**Nadal otwarte, restated explicite (design §9, NIE ciche) — 8 punktów**:
1. **Carried verbatim z `OKR_E001_DESIGN.md` §2**:
   `reflection_required_for_close` domyślnie `false` (fail-safe) do
   decyzji Founder-a (plan §20 EVIDENCE_NEEDED #3) — TEN epik jest
   PIERWSZYM, który realnie EGZEKWUJE tę flagę (E001 ją tylko
   przechowywało) — pytanie przestaje być czysto teoretyczne od teraz,
   bo realnie gate'uje zamknięcia Setów.
2. `scoring_model:'categories'` — brak jakiegokolwiek źródła definiującego
   granice kategorii; `final_score` zostaje `NULL`/
   `scoring_model_unsupported=true` do decyzji produktowej.
3. `scoring_model:'custom'` — z definicji niesprecyzowane bez konkretnego
   wymagania organizacji; stubbed identycznie jak `categories`.
4. E003 powinno zarezerwować `carried_from_objective_id` na
   `okr_vnext_objectives` przy WŁASNYM tworzeniu (D16) — nie zrobione
   dotąd, restated dla przyszłej sesji E003/E008.
5. `carried_from_set_id` placement (D15) — ten epik wybrał własny
   addytywny ALTER zamiast retroaktywnej edycji zamrożonego
   `OKR_E002_DESIGN.md` §3; Integration Owner może zdecydować inaczej,
   ten dokument nie rozstrzyga jednostronnie.
6. Ledger's literalny zapis OKR-F-022 ("brak dedykowanej trasy poza
   approve/request-changes") odczytany jako "ten sam maker-checker
   PATTERN co E002, nowa tabela/routes" (druga, odrzucona interpretacja:
   dosłowne przeużycie E002's `/sets/:id/approve` dla cyklicznego
   review) — flagowane dla Integration Owner do potwierdzenia.
7. Czy `closeOkrSet` kaskaduje status Objective/KeyResult do wartości
   terminalnej (`'closed'`/`'achieved'`) — świadomie NIE
   zaimplementowane (wymyślenie progu bez AC/polityki byłoby dokładnie
   tym błędem fabrykowanej reguły biznesowej, który dyscyplina tego
   programu ma zapobiegać).
8. **NOWY, znaleziony w tej sesji**: brak `GET` route dla treści
   Reflection (patrz sekcja "Real gap" wyżej) — §6 designu nazywa tylko
   write-route; odczyt istnieje dziś wyłącznie przez side-effect
   `finalScoreOkrSet`/`recordObjectiveReflection`'s własny response body,
   nigdy przez dedykowany GET. Restated dla Integration Owner, nie
   rozstrzygnięte jednostronnie w tym epiku (IO-3).

---

## 47. OKR-E006 Support & Decisions — implementacja + odbiór (2026-08-10)

Szósty epik domeny OKR. Zbudowany dosłownie wg `OKR_E006_DESIGN.md`
§8/§9/§10/§12/§13, ratyfikowany blokiem §-IO na czele dokumentu — IO-6
rozstrzygnął jedyne realne otwarte pytanie draftu (Open Question #1):
budować seam do platformowego modułu Decisions jako addytywne
rozszerzenie `createDecision`, osobnym, jasno nazwanym commitem.

**Worktree było ZŁE na starcie** (`git log --oneline -5` pokazywał gałąź
`integration/tools-finish-20260706` bez ŻADNEGO commitu OKR) — zresetowane
przez `git reset --hard 20d461883f` (`codex/results-vnext-g0-20260809`)
przed jakąkolwiek pracą, zero lokalnych commitów utraconych. Po resecie
E001-E004 w ancestry HEAD (potwierdzone `git merge-base --is-ancestor`);
E005 (Alignment) NIE w ancestry tej gałęzi w chwili startu — nie blokowało,
E006 nie ma zależności na E005.

**Schema** (`server/migrations/20260826_rvn_okr_support.sql`):
`okr_vnext_support_requests` (dyskryminator `kind`: comment/recognition/
support_request, lifecycle CHECK wymusza `status` tylko dla
support_request), `okr_vnext_decision_links` (pinned reference do
`decisions.id`, ZERO FK — potwierdzone bezpośrednim query
`pg_constraint` w `okrDecisionSeam.realdb.test.ts`, nie deklaracją
projektu), plus index-only dodatek `idx_okr_vnext_sets_org_attention` na
istniejącej (E002-owned) `okr_vnext_sets`. **Odstępstwo od draftu**:
`objective_id`/`key_result_id` mają REALNE FK od razu (draft zakładał
"FK dodane gdy E003 wyląduje" — E003 już wylądowało na tej gałęzi przed
implementacją E006, więc placeholder-komentarz draftu jest nieaktualny).

**IO-1 re-verification**: `'okr_objective'` NIE jest zarejestrowanym
`resource_type` (potwierdzone grepem `resourceTypes.ts` — tylko
`'okr_set'`) — Objectives/KeyResults/support-requests/decision-links
dziedziczą widoczność WYŁĄCZNIE przez `set_id`, zero nowego
resource_type, zgodnie z ostrzeżeniem zadania.

**Command layer** (`okrSupportCommands.ts`): `postComment`/
`postRecognition`/`raiseSupportRequest`/`acknowledgeSupportRequest`/
`resolveSupportRequest`/`dismissSupportRequest`. Brak klasy
self-approval-denial (design §11, decyzja świadoma nie cicha) — żaden AC
nie ustanawia pary maker-checker dla support requestów; KR Owner
rozwiązujący WŁASNY zgłoszony request po samodzielnym odblokowaniu się to
normalna akcja, nie konflikt interesu analogiczny do zatwierdzania
własnego celu OKR. `raiseSupportRequest` wymaga `assignedToUserId`
explicite (zero server-side inferencji "Managera"). Obligation
`respond_to_support_request` przez generyczny `platform/obligations.ts`
— tworzona przy `raiseSupportRequest`, kończona przy `resolve` LUB
`dismiss` (dismissed też liczy się jako "odpowiedziano").

**Decisions seam** (`okrDecisionCommands.ts`) — **realny kod-verified
blocker potwierdzony, NIE założony**: `DecisionController.createDecision`
(linie 1141-1487) twardo wymaga `projectId`/`initiativeId`/`taskId` i
NIGDY nie czytał/pisał `source_type`/`source_id` mimo że te kolumny już
istniały (`20260311_origin_tracking.sql`, 8-cyfrowy prefiks, auto-run na
boot). Zbudowany DOKŁADNIE wg §10.2 rekomendacji, osobnym commitem
(`ec77d8f8a5`), jasno nazwanym "cross-module change": dwa opcjonalne pola
Zod (`sourceType`/`sourceId`) + jeden rozszerzony warunek guard, który nie
odrzuca niczego wcześniej akceptowanego. Zweryfikowane smoke-INSERT-em na
realnym Postgresie (kolejność kolumn/wartości w OBU ścieżkach INSERT —
primary i legacy-fallback), zero zmiany response shape.

**Odstępstwo od draftu, stwierdzone explicite**: `requestDecisionFromSupportRequest`
NIE woła `DecisionController.createDecision`'s Express handlera (draft
§10.4 to rozważał jako opcję A). Po przeczytaniu realnego kodu handler
okazał się nierozdzielny od `req`/`res` (czyta `req.can('approve_changes')`,
pisze JSON response inline) i biegnie na WSPÓLNEJ puli przez
`queryHelpers.withPgTransaction` — próba wyekstrahowania wewnętrznego
wrappera byłaby dokładnie tą inwazyjną zmianą, którą IO-6 zabrania. Zamiast
tego komenda robi bezpośredni INSERT do `decisions` NA WŁASNYM pinned
transaction clencie (`executeAtomicCreate`'s `applyMutation`), używając
identycznego zestawu kolumn co primary INSERT kontrolera. To czyni zapis
Decision + zapis linku/support-requesta GENUINE ATOMOWYM (jedna
transakcja, jedno połączenie) — LEPSZE niż martwiący draft cross-pool gap
(§10.4's Open Question #3), który dotyczy tylko wywołania przez warstwę
Express. Ujawniony, nieukryty koszt: `createDecision`'s side-effecty poza
transakcją (audit log, `dispatchProjectCommunicationEvent`) NIE są
replikowane przez tę komendę.

**Realny finding, NIE założenie**: `decisions.organization_id` ma
prawdziwy FK do `organizations(id)`, `decision_maker_id`/`created_by` mają
prawdziwe FK do `users(id)` (ON DELETE SET NULL — to NIE łagodzi
insert-time constraint checking) — inaczej niż `okr_vnext_*`, gdzie
wszystkie id aktorów/orgów to gołe TEXT bez FK. `okrDecisionSeam.realdb.test.ts`/
`okrDecisionResolutionAcknowledgement.realdb.test.ts` prowizjonują realne
wiersze `organizations`/`users` z tego właśnie powodu — bez nich
`requestDecisionFromSupportRequest` zwraca surowy FK-violation 500, nie
czysty błąd domenowy. Restated jako otwarty gap na przyszłość (przyjazny
walidacyjny błąd zamiast surowego FK-violation), nieblokujący.

**Migracja 932 — zweryfikowana na żywo, nie założona**: `932_decision_workflow_canonical.sql`
(kolumny `decisions.version`/`decided_by`, tabele `decision_comments`/
`decision_alternatives`/`decision_risks`) potwierdzone bezpośrednim
grepem `DatabaseInitializer.ts`'s regexu odkrywania migracji na boot
(`/^(7\d{2}|\d{8})_.*\.sql$/`, linia 3198) — `932_` NIE pasuje (ani
`7\d{2}`, ani 8-cyfrowa data), więc NIE jest auto-uruchamiana na
demo/prod przy starcie serwera. **Ten epik NIE zależy od żadnej kolumny
932** — `requestDecisionFromSupportRequest` pisze tylko kolumny z bazowej
`20260311_origin_tracking.sql` (id, organization_id, title, description,
type, decision_maker_id, deadline, status, created_by, source_type,
source_id); `acknowledgeDecisionResolution` czyta tylko `status`/
`decision_rationale`/`decided_at` (też bazowa tabela). Zweryfikowane
lokalnie: pełny `migrate.postgres.ts` (osobny, mniej restrykcyjny runner
niż boot-time `DatabaseInitializer.ts`) faktycznie APLIKUJE 932 gdy
uruchomiony explicite — a więc żywy stan demo/prod zależy od tego, czy
proces promocji jawnie odpalił pełny skrypt migracji, nie od samej
obecności pliku. Nie miałem dostępu do żywej bazy demo z tego
sandboxowanego worktree żeby to zweryfikować bezpośrednio przez
`information_schema` — do zrobienia przez kogokolwiek promującego ten
epik, zgodnie ze złotą regułą programu.

**`acknowledgeDecisionResolution`** reużywa `decisionOutcomeService.isTerminalDecisionOutcome`
(nie własną literalną listę statusów, zgodnie z instrukcją draftu §16
item 3). Scheduled-actor trigger (rekomendacja (b) z §10.4, NIE cicha
decyzja) zaimplementowany w `okrDecisionResolutionScanner.ts` —
`scanAndAcknowledgeResolvedDecisionLinks`, czysta, w pełni testowana,
NIEWPIĘTA w żaden cron (ta sama postawa P10 co `okrCycleScheduler.ts`/
`okrCheckInScheduler.ts`). Human-triggered path (a) też dostępny —
route/UI może wywołać `acknowledgeDecisionResolution` z realnym
`actorUserId` w dowolnym momencie.

**Manager attention queue** (`okrAttentionRepository.ts`) —
`listOrganizationOkrAttention`, bezpośrednia strukturalna kopia
`kpiPerspectivesRepository.ts`'s `listOrganizationKpiAttention`/
`buildScopedKpisBase` (KPI-E003 precedens). Ten sam, potwierdzony
grepem, NIEROZWIĄZANY gap co w KPI: `getManagementChain(userId)` nie
istnieje nigdzie w platformie — `chain_members` CTE query'uje
`rvn_platform_management_chain_closure` bezpośrednio (self ∪ descendant),
ale nic realnie nie populuje tej tabeli poza czym `managementChainMaintenance.ts`
utrzymuje dziś. Nazwane, nie naprawione — ta sama postawa co OKR-E002 D13.

**API** (`okr.routes.ts`) — 11 nowych route'ów, ten sam wzorzec
pre-fetch-ABAC co każdy route E002+ (`getObjective`/`getOkrSet`/
`getSupportRequest` przed wywołaniem komendy — 404 dla kogoś bez
widoczności, nie inny błąd ujawniający istnienie zasobu).

**Testy — 22 asercje przeciw REALNEMU Postgresowi 17** (efemeryczny,
`initdb --locale=C -E UTF8`, TCP 127.0.0.1, port losowy, `LC_ALL=C` przy
starcie serwera — bez tego `postmaster became multithreaded during
startup` FATAL, dokładnie zgodnie z ostrzeżeniem MEMORY o tej pułapce):
`okrSupportRequestLifecycle` (5), `okrSupportRequestVisibilityJoin` (4,
`::text` cast proof OPEN_ORG/RESTRICTED_ACL/PRIVATE), `okrRecognitionPolicyGate`
(2, fail-closed z asercją zerowego wiersza), `okrDecisionSeam` (1,
pełny seam + zero-FK proof + duplicate-request rejection), `okrDecisionResolutionAcknowledgement`
(3, pending-guard + terminal-success + real-event-row proof +
scheduled-actor path), `okrAttentionQueue` (7, wszystkie 5 sygnałów +
manager-scoping negative case).

**`npx tsc --noEmit` (`--max-old-space-size=8192`) czysty** na całym
repo, dwa razy zweryfikowany (po serwisach, po Decisions-module diffie).

**Regresja — before/after evidence**: `tests/resultsVnext/okr` pełny
katalog: 242 passed / 2 failed (bez zmian) — oba faily dowiedzione jako
PRZEDISTNIEJĄCE, zero-diff plikami których ten epik NIE dotknął
(`okrCycleScheduler.ts`/`okrCheckInSuggestionService.ts` i ich testy):
`generateCadenceOccurrences` zwraca dodatkowe pole `createdOccurrenceIds`
(landed osobnym commitem, test go nie oczekuje) i
`okrCheckInSuggestionService.ts` narusza D09 zero-FK-isolation regułę
(referencje do `kpiDefinitionService`/`kpi_time_series`). `tests/unit/backend/controllers/DecisionController.test.ts`:
5 failów w `decide`/`updateDecision` (funkcje, których ten epik NIE
dotknął — potwierdzone `git diff` pokazującym zero zmian poza
`createDecision`) plus 1 fail w `createDecision` samym **dowiedziony
identyczny na bazowym (pre-zmiana) pliku kontrolera** — podmieniłem
tymczasowo `DecisionController.ts` na wersję z `20d461883f`, uruchomiłem
dokładnie ten sam test, identyczny fail, przywróciłem swoją wersję
(`git status` czyste po przywróceniu). Żaden z tych 6 failów nie jest
regresją tego epiku.

**Świadomie NIEZBUDOWANE / poza zakresem** (design §16, restated nie
zapomniane): `dismissSupportRequest` to dodatek projektowy nienazwany
żadnym AC (jak §16 item 7 nakazywał zaznaczyć) — zbudowany, bo bez niego
"nie, sam sobie poradziłem" nie miałoby ścieżki zamknięcia obligation.
`listSupportRequestsForSet`/`getSupportRequest` NIE hydratują statusu
Decision przez live JOIN (design §10.5 to sugerował) — zamiast tego
dedykowany `getDecisionLink`/`getDecisionLinkForSupportRequest`
endpoint/funkcja robi to explicite; uproszczenie zakresu, nie luka w
funkcjonalności (klient wywołujący potrzebujący statusu Decision ma
dedykowaną ścieżkę). Mocked route test (`okrSupport.routes.test.ts` z
listy plików draftu) POMINIĘTY świadomie — zadanie explicite priorytetuje
"DIRECT real-Postgres test" nad mockowanym testem route'a; 22 realne
asercje przeciw prawdziwemu Postgresowi uznane za wystarczający dowód.

## 48. OKR-E008 Połowy A i B (Teresa + Perspectives) — implementacja + odbiór, DOMENA OKR ZAMKNIĘTA 8/8 (2026-08-10)

Domyka OKR-E008 rozpoczęte w §42 (Połowa C, Legacy/Ops — już wylądowana,
NIE dotknięta ani zduplikowana tutaj). §42's "poza zakresem, świadomie
niezbudowane" lista (Połowa A blokowana na E003/E004/E006/E007, Połowa B
blokowana na E002) jest teraz NIEAKTUALNA — cały łańcuch E001-E007 wylądował
na tej gałęzi (§40-§47) od czasu tamtego zapisu. IO-1 re-weryfikacja
(obowiązkowa wg bloku §-IO na czele `OKR_E008_DESIGN.md`) wykonana wprost
przeciw REALNEMU, wylądowanemu kodowi, nie przeciw draftowi — design był
pisany gdy zero kodu OKR vNext istniało (§0/§2.3 designu to stwierdzają
explicite), więc każda nazwa komendy/kolumny w draftowej Połowie A była
prospektywnym zgadywaniem.

### Połowa A (Teresa) — 5 trybów, WSZYSTKIE zbudowane, ŻADEN nieporzucony

Design (D-OKR8-1) postawił pytanie wprost: 5 trybów (po jednym na
literalnie nazwaną trasę w tabeli AC) czy mniej (jak KPI 5→3, ROI →1)?
Zadanie kazało zweryfikować KAŻDY z 5 osobno przeciw realnej tabeli AC, nie
ufać założeniu draftu. Weryfikacja (§0 designu, tabela OKR-E008, kolumna
"Command/query/API"): OKR-F-025 nazywa DWIE trasy (`/advisor/draft`,
`/advisor/quality-review`), OKR-F-026 nazywa DWIE trasy (`/advisor/check-in`,
`/advisor/manager-brief`), OKR-F-027 nazywa JEDNĄ trasę
(`/advisor/reflection`) — 5 realnie, literalnie nazwanych tras, nie 3 i nie
1. Wszystkie 5 przeżyły re-weryfikację i zostały zbudowane:
`objective_draft`, `objective_quality_review`, `check_in_assist`,
`manager_brief`, `reflection_synthesis`. Zero trybu porzuconego —
inaczej niż KPI/ROI, gdzie kolaps liczby trybów wynikał z WŁASNEJ,
węższej tabeli AC tamtych domen, nie z arbitralnej decyzji.

**`teresaCopilotCanon.ts`**: `'okr'` dodane do `HandoffTargetModule` union
(jedyne realne odstępstwo od wzorca kpi/roi — obie były pre-zarezerwowane
przez RN-G1, `'okr'` nigdy nie było, potwierdzone bezpośrednim czytaniem
unii przed edycją). 5 nowych typów payloadu + `ResultsOkrHandoffContext`,
`P08_HANDOFF_TARGETS.okr`, `P08_HANDOFF_TARGET_MODULES` append.
`P08_OKR_FORBIDDEN_VERBS` **re-derived bezpośrednim grepem** `^export
(async )?function` przez wszystkie `okr*Commands.ts` (design's własna
placeholder-lista z §3.6 explicite mówiła "CANNOT be finalized today" —
teraz mogła, bo E001-E007 wylądowały) — 42 realne top-level komendy
znalezione, z czego funkcje pomocnicze przyjmujące `client: PoolClient`
jako pierwszy parametr (nie samodzielnie wywoływalne bez otwartej
transakcji, której warstwa Teresy nigdy nie ma) i czyste funkcje
obliczeniowe/odczytowe świadomie wykluczone z listy (ta sama konwencja co
ROI-E008 D16). Własny test (`teresa-okr-forbidden-verbs.test.ts`) **złapał
realnego buga we WŁASNYM nagłówku-komentarzu pliku** — proza nad tablicą
`P08_OKR_FORBIDDEN_VERBS` wymieniała `finalScoreOkrSet`/
`recordObjectiveReflection` po nazwie POZA deklaracją tablicy, co statyczny
test #7 (self-reference check, wzorowany 1:1 na KPI/ROI) słusznie
zaczerwienił — naprawione przeformułowaniem prozy bez literalnych nazw
czasowników.

**`teresaCopilotService.ts`**: 6 linii importu z `resultsVnext/okr/`
(`getOkrSet`, `createObjective`, `getObjective`/`listObjectivesForSet`/
`getKeyResult`, `recordCheckIn`, `listOrganizationOkrAttention`,
`recordOkrReflectionTeresaDraft`) — 8 nazw łącznie, wszystkie
udowodnione grepem w teście. `case 'okr':` w `performHandoff`, 5 funkcji
`handleOkr*`, `recordTeresaOkrHandoffResult`, blok `undoProposal`
(`P08_UNDO_NOT_SUPPORTED`, ta sama pozycja co kpi/roi — TRZECI blok w
sekwencji if-chain, nie switch, zgodnie z realną, niedesignową strukturą
pliku już odnotowaną przez ROI-E008).

**Odstępstwa OD REALNEGO kodu (nie od designu — design był prospektywny)**:
1. `recordCheckIn` (`okrCheckInCommands.ts`, OKR-E004) **nie ma pola
   `expectedVersion` w ogóle** — check-in jest append-only, nigdy CAS'owany
   na własnym wierszu KR. `check_in_assist` świadomie IGNORUJE
   `okr_handoff_context.expected_version` (jedyny tryb, który to robi) —
   udokumentowane w kodzie i w unit teście.
2. `check_in_assist`'owy payload wymaga `cadence_occurrence_id` (realny,
   wymagany parametr `RecordOkrCheckInSchema`/`RecordCheckInInput`) — design
   go całkowicie pominął (pisany przed OKR-E004).
3. `reflection_synthesis`'owy payload wymaga `set_id` (design miał tylko
   `objective_id`) — `okr_vnext_reflections.set_id` jest `NOT NULL`, a
   ścieżka create-jeśli-nie-istnieje (patrz niżej) potrzebuje go od
   pierwszego wywołania.
4. E003 **nie zarejestrował** `'okr_objective'` jako `resource_type` ABAC
   (potwierdzone ponownie, ta sama linia co OKR-E005/E006/E007 już
   ustaliły) — Objectives/KeyResults dziedziczą widoczność wyłącznie przez
   `set_id`/`'okr_set'`. `target_resource.resource_type` w payloadzie
   Teresy jest czystym deskryptorem UI, nie ABAC lookup key.
5. E003's kolumny confidence to `confidence`/`confidence_numeric_value`
   (potwierdzone, zgodnie z ostrzeżeniem orkiestratora).
6. `okr_vnext_objectives`'owy FK do rodzica to `set_id`, nie `okr_set_id`
   (potwierdzone, zgodnie z ostrzeżeniem orkiestratora).

**`okrReflectionCommands.ts` — nowa funkcjonalność (D-OKR8-7/D-OKR8-8)**:
OKR-E007's `okr_vnext_reflections` wylądowało BEZ zarezerwowanych kolumn
draftu Teresy (inaczej niż ROI-E006's PIR, które je pre-zarezerwowało dla
ROI-E008) — nowa migracja `20260827_rvn_okr_teresa_reflection_draft.sql`
dodaje `teresa_draft_reflection_payload`/`teresa_draft_generated_at`/
`teresa_draft_disposition(_by/_at)`, rozszerza
`okr_vnext_reflection_protect_frozen()` (`CREATE OR REPLACE FUNCTION`,
bez nowego triggera — istniejący `trg_okr_vnext_reflection_protect_frozen`
podłącza się automatycznie). Dwie nowe komendy, obie w tym samym pliku co
`recordObjectiveReflection`/`finalScoreOkrSet` (ta sama lokalizacja co
ROI-E008 wybrało dla własnych PIR-draft funkcji):
- `recordOkrReflectionTeresaDraft` — jedyna ścieżka zapisu Teresy. Hand-rolled
  BEGIN/mutate/event/outbox/COMMIT (NIE `executeAtomicCommand`) — mirror
  `recordObjectiveReflection`'s WŁASNEJ konwencji `expectedVersion=0`
  ("brak wiersza jeszcze") / `>=1` (CAS istniejącego), bo wiersz reflection
  może nie istnieć gdy Teresa pierwszy raz draftuje. `UPDATE`/`INSERT`
  dotyka WYŁĄCZNIE `teresa_draft_reflection_payload`/
  `teresa_draft_generated_at` — nigdy żadnej narracyjnej/scoringowej
  kolumny. Guard: Set `status IN ('active','review')`. Guard: regeneracja
  zablokowana gdy `teresa_draft_disposition IS NOT NULL` (analog D6/D13
  ROI-E008).
- `recordOkrReflectionTeresaDraftDisposition` — jedyna brama dyspozycji
  człowieka. `executeAtomicCommand` (wiersz gwarantowany istnieć w tym
  punkcie). **Realna, jawnie stwierdzona różnica od ROI**: ROI's analog
  KOPIUJE tekst do `lessons_learned` (jedno pole narracyjne). OKR's
  reflection ma PIĘĆ osobnych pól narracyjnych
  (`what_worked`/`what_did_not_work`/`why`/`learning`/`next_cycle_change`)
  plus `disposition` — nie ma jednego "finalnego tekstu" do skopiowania.
  Ta komenda zapisuje WYŁĄCZNIE `teresa_draft_disposition`/`_by`/`_at`
  (blokuje dalszą regenerację, ujawnia decyzję człowieka UI) — NIGDY
  żadnego z pięciu pól narracyjnych. Istniejąca `recordObjectiveReflection`
  (bez zmian) pozostaje JEDYNĄ ścieżką, która kiedykolwiek je zapisuje —
  dokładnie zgodnie z literalnym tekstem designu ("human still calls
  POST .../objectives/:id/reflection to commit").

### Połowa B (Perspectives) — `/okr/my`, `/okr/team-health`, `/okr/company` reużyty

D-OKR8-4 rekoncyliacja (design § już to rozstrzygnął, potwierdzone
bezpośrednim czytaniem realnego kodu OKR-E002 przed pisaniem czegokolwiek):
`GET /sets`'owy `perspective=` query param jest ZADEKLAROWANY w Zod
schemacie ale **zero kodu go czyta** (`okrSetRepository.ts`'s własny
komentarz nagłówkowy to potwierdza: "no `perspective` filter is
implemented here") — pozostaje zarezerwowany-a-nieużywany, ZGODNIE z
decyzją designu, nie odblokowany tutaj żadną wymyśloną semantyką.
`GET /okr/company` **już istnieje** (OKR-E002, `listOkrSets({scopeType:
'company'})`) — REUŻYTY jak jest, NIE przebudowany. Nowe: `okrPerspectivesRepository.ts`
(`listMyOkrSets`, `listOrganizationOkrTeamHealth`) + 2 nowe trasy
`GET /my`/`GET /team-health` w `okr.routes.ts`.

**Odstępstwo od draftu #1 (znalezisko, nie zgadywanie)**: design §4.1
D-OKR8-14 zakładał, że `attention_state`/`last_checkin_at`/
`next_checkin_due_at` na `okr_vnext_sets` będą czytać `NULL`/`'none'` dla
KAŻDEGO Setu, bo OKR-E002's własny komentarz DDL mówił "reserved, NOT
populated". **To założenie jest NIEAKTUALNE** — OKR-E004's
`applySetRollupUpdate` (`okrCheckInCommands.ts`, wylądowane po designie)
TERAZ populuje wszystkie trzy kolumny przy każdym check-inie. `/okr/team-health`
zwraca REALNE, bieżące dane, nie honest-null passthrough jak design
zakładał — stwierdzone explicite w kodzie i w tym zapisie, nie ukryte.

**Odstępstwo od draftu #2 (naprawiona luka strukturalna)**: design's §4.2
szkic `listOrganizationOkrTeamHealth` zwracał WYŁĄCZNIE 3 agregaty
liczbowe (`countsByStatus`/`countsByScopeType`/`attentionBreakdown`) —
ŻADNEGO `set_id`/`current_version` nigdzie. To strukturalnie
UNIEMOŻLIWIA literalny wymóg parity OKR-F-028'ego ("personal/team-BU/company
projections return the SAME Set IDs and versions") — nie da się dowieść
identyczności ID/wersji z funkcji, która nie zwraca ID/wersji. Naprawione
dodaniem 4. równoległego query (ten sam `scoped_okr_sets` CTE) zwracającego
`sets: {setId, currentVersion, status, scopeType}[]` — to właśnie sprawdza
`okrPerspectivesParity.realdb.test.ts` (D-OKR8-15) przeciw
`listMyOkrSets`/`listOkrSets(scopeType:'company')`.

**`listCompanyOkrSets` wrapper (§4.2 designu) NIE zbudowany** — design's
własny placeholder rzucał `new Error('delegates to okrSetRepository
.listOkrSets')`; budowanie realnego wrappera, który tylko przekazuje do
już-publicznej funkcji, dodałoby warstwę pośredniczącą bez własnego
zachowania. Istniejąca trasa `/company` (E002) reużyta bezpośrednio.

**Dwuwarstwowe skalowanie** (D-OKR8-13): `buildScopedOkrSetsBase`
zadeklarowane LOKALNIE w `okrPerspectivesRepository.ts` (nie importowane z
`okrAttentionRepository.ts`, mimo identycznego kształtu) — ta sama
konwencja "brak współdzielonych helperów między plikami w tej domenie"
co `okrObjectiveRepository.ts`'s własny nagłówek już stwierdza.
ACKNOWLEDGED, UNFIXED GAP restated (nie naprawiony, nie ukryty): brak
realnego `getManagementChain(userId)` gdziekolwiek w platformie —
`chain_members` query'uje `rvn_platform_management_chain_closure`
bezpośrednio (self ∪ descendant).

### Testy — 6 nowych plików, 54 nowe asercje, WSZYSTKIE PASS

Real-Postgres (efemeryczny Postgres 17, `initdb --locale=C`, TCP
127.0.0.1, port losowy, krótki socket dir `/tmp/pg-okr-e008-sock`,
`LC_ALL=C` przy starcie serwera, strict `db:migrate` bez `--safe`):
- `okrPerspectives.realdb.test.ts` (7) — owner/reviewer inclusion,
  unrelated-user exclusion, self-inclusion przez `chain_members` UNION,
  cross-manager isolation (T3 non-leak), identity match `listMyOkrSets` vs
  `listOrganizationOkrTeamHealth`.
- `okrPerspectivesParity.realdb.test.ts` (2) — D-OKR8-15 literalny dowód:
  jeden company-scope Set, identyczny `setId`/`currentVersion` z trzech
  perspektyw; drugi test dowodzi żywego widoku (nie snapshotu) przez realny
  zapis (`updateOkrSetDraft`) i odczyt bumped `rowVersion` identycznie z
  trzech perspektyw.
- `okrReflectionTeresaDraft.realdb.test.ts` (6) — create/regenerate/stale-CAS/
  disposition/regeneracja-zablokowana-po-dyspozycji/człowiek-niezależny —
  end-to-end dowód całego mechanizmu D-OKR8-7.

Mocked-DB (unit, DB layer + 6-liniowy whitelist importu zamockowane):
- `tests/v8/teresa-okr-handoff.test.ts` (14) — wszystkie 5 trybów, happy
  path + visibility-stale re-check failure per tryb, missing advisor_mode,
  truth-preserving domain rejection (nigdy nie połknięty, zero receipt),
  undoProposal zablokowany.

Static (zero DB):
- `tests/resultsVnext/teresa-okr-forbidden-verbs.test.ts` (9) — import
  whitelist, forbidden-verb grep (import + call-site), self-reference check
  (złapał realnego buga, patrz wyżej), statyczny UPDATE-clause check na OBU
  nowych komendach reflection-draft.

Route-contract (mocked, dodane do istniejącego pliku): `okr.routes.test.ts`
+2 (`GET /my`, `GET /team-health`) — 118/118 pass (116 baseline + 2 nowe).

**Regresja — pełen katalog `tests/resultsVnext/okr` + `okr.routes.test.ts` +
`okrReview.routes.test.ts` razem: 489/489 pass** (baseline 472 + 17 nowych
w tym uruchomieniu; +54 licząc też pliki poza tym trzema ścieżkami —
`teresa-okr-forbidden-verbs.test.ts`/`teresa-okr-handoff.test.ts` — oba
osobno zweryfikowane zielone). Zero regresji na istniejących testach E001-E007.

**`npx tsc --noEmit` (`--max-old-space-size=8192`, `server/tsconfig.json`)
czysty** poza tymi samymi 28 przedistniejącymi błędami `decimal.js` w
`roiCalculationEngine.ts` (plik całkowicie nietknięty przez ten epik,
identyczna rodzina błędów co §39/§40/§42 już odnotowały). Zero błędów w
jakimkolwiek nowym/zmienionym pliku OKR-E008 Połowy A/B.

**Świadomie NIEZBUDOWANE / poza zakresem, restated z designu**:
`manager_brief`'owy `scope:'organization'` — OKR-F-026's Roles cell
wymienia tylko "KR Owner, Manager", nie rolę organization-wide; wartość
zachowana w unii typu dla symetrii z KPI, ale jej granica autoryzacji nie
ma potwierdzenia w żadnym OKR-specific AC (design's własne Open Question
#6, restated nie rozstrzygnięte tutaj). `/okr/team-health` vs OKR-E006's
`/okr/attention` — traktowane jako DWIE różne perspektywy (team-health =
zagregowane statystyki zdrowia, attention = worklist akcyjny), design's
własne Open Question #7 nie wyklucza konsolidacji — warte sprawdzenia
produktowego przed oboma wejściem na produkcję równolegle, nierozstrzygnięte
tutaj.

**Domena OKR backend complete: 8/8 epików (E001-E008) zbudowanych i
zweryfikowanych.**

**OKR domain backend complete: 8/8 epics (E001-E008) built and verified.**

## 49. RN-G3 Outbox Dispatcher + `mywork_projection` consumer — implementacja + odbiór, pierwszy realny konsument (2026-08-10)

Design: `docs/product/results-vnext/RN_G3_OUTBOX_DISPATCHER_DESIGN.md`
(FROZEN, 5 wiążących rulingów Integration Ownera §2). Domyka największą
lukę operacyjną programu: wszystkie trzy domeny (KPI 7 epików, ROI 8, OKR 8)
poprawnie piszą `rvn_platform_events`/`rvn_platform_outbox`, ale przed tym
pakietem NIC ich nie konsumowało — `outboxDrain.ts` był zestawem czystych
funkcji bez cronu/rejestru/wywołania, potwierdzone grepem przed startem.

**Zbudowane** (wszystko nowe poza jednym additive-only edytem):
- `server/migrations/20260828_rvn_platform_consumer_processed.sql` —
  tabela idempotencji konsumenta (`(consumer_group, event_id)` PK,
  `ON CONFLICT DO NOTHING` guard) — główny mechanizm ochrony przed
  redelivery pod at-least-once (design §5: `rvn_platform_obligations
  .deduplication_key` NIE wystarcza — inna oś, inna warstwa).
- `server/migrations/20260829_rvn_platform_outbox_parked_status.sql` —
  rozszerza CHECK na `rvn_platform_outbox.status` o `'parked'` (IO-C).
- `server/src/services/resultsVnext/platform/outboxDrain.ts` — **additive
  only**: `markParked()` + poszerzony `RvnOutboxStatus`. Cztery istniejące,
  już przetestowane funkcje (`claimOutboxBatch`/`reclaimExpiredClaims`/
  `markDispatched`/`markFailed`) NIETKNIĘTE.
- `server/src/services/resultsVnext/platform/consumerRegistry.ts` —
  `CONSUMER_REGISTRY` (jeden wpis: `mywork_projection`) +
  `UNBUILT_CONSUMER_GROUPS` (IO-C: `finance_projection` — 11 żywych typów
  zdarzeń, zero konsumenta).
- `server/src/services/resultsVnext/platform/myworkProjectionConsumer.ts` —
  `dispatchMyWorkProjection`, `RVN_CANONICAL_STATES` (IO-A, jedyny
  eksportowany const słownika, zero inline literali w miejscach wywołania).
  Dwa zapisy w JEDNEJ transakcji per zdarzenie: upsert
  `v8_canonical_object_states` (kopiowany SQL z `myWorkRoofService
  .setCanonicalObjectState()`, NIE wywołany bezpośrednio — ta funkcja
  używa `DbPromise`/osobnego połączenia z poola, co złamałoby atomowość
  dwóch zapisów) + INSERT `notifications` (realna ścieżka do Inboxa przez
  już wdrożone `materializeInboxItems()`, ZERO zmian w `inboxService.ts`).
  Obsłużone realnie 4 typy zdarzeń z tabeli §8 designu
  (`kpi.deviation_opened`/`kpi.deviation_closed`/`roi.case_approved`/
  `okr_support.decision_requested`); pozostałe ~140 typów kierowanych na
  `mywork_projection` (praktycznie każde zdarzenie KPI/ROI/OKR) są
  celowym no-opem (zaklejmowane przez idempotency-insert, `dispatched`,
  bez efektu) — rzucanie błędem zamiast no-opu dead-letterowałoby niemal
  cały strumień zdarzeń KPI/ROI/OKR, dokładnie ten sam alert-fatigue który
  IO-C odrzuca dla `finance_projection`. Rozszerzenie realnej obsługi na
  więcej typów to zakres kolejnego pakietu.
- `server/src/services/resultsVnext/platform/platformOutboxDrainCron.ts` —
  strukturalne lustro `notificationOutboxService.ts`'s cronu (zmienne env,
  `NODE_ENV==='test'` skip, boot-delay+interval, swallow-and-log), ale
  ciało na `acquirePgClient()` (pinned `PoolClient`), nie `DbPromise` —
  `claimOutboxBatch`/`reclaimExpiredClaims` wymagają realnych transakcji z
  `FOR UPDATE SKIP LOCKED`. `runOutboxDispatchTick()` eksportowany osobno
  do deterministycznego testowania jednego ticku.
- `server/src/index.ts` — rejestracja cronu obok
  `startNotificationOutboxDrainCron()`, jedna linia + import, try/catch
  fail-soft jak wszystkie sąsiednie crony.

**Osiem dowodów odbioru (design §10) — WSZYSTKIE 8 przechodzą na realnym
lokalnym Postgresie 17** (`tests/acceptance/rvn-outbox-mywork-projection
.e2e.test.ts`, wzorzec `outbox-drain.e2e.test.ts`: raw `pg.Client`, marker
`odbior--rn-g3--<tag>`, `afterAll` sprząta, zero pozostałości potwierdzone
zapytaniem po runie):
1. Atomowy zapis event+outbox (realna komenda `openOrEscalateDeviationCase`
   przez `recordMeasurement`) — PASS. Negatywna kontrola: `applyMutation`
   rzuca (przez `executeAtomicCreate` bezpośrednio, realny insert do
   `rvn_kpi_measurements` + throw) — ani agregat, ani event, ani outbox nie
   istnieją po rollbacku — PASS.
2. Exactly-once claim pod współbieżnością (5 realnych połączeń,
   `Promise.all`, `claimOutboxBatch` na 12 zasianych wierszach
   referencujących jeden realny event) — brak duplikatów, pełne pokrycie —
   PASS.
3. Realna mutacja: jeden tick na `kpi.deviation_opened` → wiersz
   `v8_canonical_object_states` (`needs_attention`) + `notifications` dla
   assignee obligacji — PASS.
4. Brak duplikatu przy redelivery: `dispatchMyWorkProjection` wywołany
   DWA razy na tym samym evencie → dokładnie jedna notyfikacja, jeden stan
   kanoniczny, jeden wiersz `rvn_platform_consumer_processed` — PASS.
5. Retry z backoff: `NO_CONSUMER_REGISTERED` → `next_attempt_at` przesunięty
   o `backoffSeconds(30) * 2^0`, status `failed` (nie `dead_letter`) — PASS.
6. Dead-letter + realny alert: `markFailed` napędzony do `max_attempts` →
   `dead_letter`; realny tick doprowadzający OSTATNIĄ próbę → dokładnie
   jedno wywołanie `sendSystemAlert` CRITICAL dla tej grupy — PASS.
   Dodatkowo (IO-C): wiersz `finance_projection` parkuje (`status='parked'`,
   `attempts=0`, `last_error='CONSUMER_NOT_BUILT'`) z jednym INFO notice,
   ZERO wywołań CRITICAL — PASS.
7. Cold reopen: `materializeInboxItems` po raz pierwszy odnajduje
   projekcję; po `kpi.deviation_closed` i IO-E resolution, ponowna
   materializacja NIE pokazuje itemu jako unread (trigger
   `20260805_m02p03_inbox_projection_lifecycle.sql`, `AFTER UPDATE OF read`,
   retiruje projekcję automatycznie w TEJ SAMEJ transakcji co UPDATE
   konsumenta) — PASS.
8. Izolacja międzyorganizacyjna: dwa orgi z `kpi.deviation_opened`
   dzielącym LITERALNY `aggregate_id` (org B skonstruowany przez
   `EVENT_INSERT_SQL`+`resolveConsumerGroups`, te same prymitywy co
   `openOrEscalateDeviationCase` — `rvn_kpi_deviation_cases.case_id` jest
   globalnym UUID PK, więc DWIE realne komendy nigdy nie kolidują; kolizja
   testowana jest na `rvn_platform_events.aggregate_id`, który NIE ma
   takiego ograniczenia) — zapytanie org-scoped nigdy nie zwraca danych
   drugiego orga — PASS.

**Dwa realne błędy produkcyjne złapane przez ten test** (opisane w commit
message `test(rn-g3): ...`): (a) `notifications.is_read`/`read` są
`INTEGER` na realnej, w pełni zmigrowanej tabeli — `000_initdb_core_tables
.sql`'owa deklaracja `BOOLEAN` dla `is_read` jest przykryta późniejszą
migracją; zapis JS `true`/`false` rzucał błąd typu, cicho rollbackujący
CAŁĄ transakcję (stan kanoniczny + notyfikacja) — naprawione na `0`/`1`.
(b) (tylko plik testowy) ręczne bloki `BEGIN`/`COMMIT` bez `ROLLBACK` przy
błędzie zostawiały pulowane połączenia `pg` w stanie "aborted transaction",
zatruwając kolejne, niepowiązane testy dzielące tę samą pulę — naprawione
wspólnym helperem `withTransaction()`.

**`npx tsc --noEmit` (`--max-old-space-size=8192`, `server/tsconfig.json`)
czysty** poza tymi samymi 18 przedistniejącymi błędami `decimal.js` w
`roiCalculationEngine.ts` (plik nietknięty przez ten pakiet; wcześniejsze
wpisy w tym rejestrze notowały 28 — rozbieżność licznika nieweryfikowana w
tej sesji, plik i przyczyna identyczne). Zero błędów w jakimkolwiek nowym/
zmienionym pliku RN-G3.

**Regresja KPI/ROI/OKR — `npx vitest run --config vitest.config.ts
tests/resultsVnext` na tym samym lokalnym Postgresie (`RUN_DB_TESTS=1` —
bez tego `getDatabase()` cicho zwraca mock, patrz pułapka niżej): 666/707
pass, 33 failed, 8 skipped, w 18 plikach. WSZYSTKIE 18 plików to
`tests/resultsVnext/roi/*.realdb.test.ts` i WSZYSTKIE 33 failury to ten sam
`initiatives_organization_id_fkey` (fixture nie wstawia wiersza do
`organizations` przed insertem do `initiatives`) — dokładnie
przeddokumentowany, znany gap (`INITIATIVES_STATUS_FIX_RECONCILIATION.md`,
18 z 36 plików ROI realdb), zero nowych failurów, zero plików KPI/OKR w
liście failed.**

**Pułapka złapana w tej sesji (dla następcy)**: `getDatabase()`
(`server/src/database/Database.ts`) cicho zwraca `createMockDatabase()`
gdy `NODE_ENV=test` i `RUN_DB_TESTS !== '1'` — `inboxService.ts`'s
`materializeInboxItems`/`getInboxItems` idą przez tę warstwę (nie przez
`acquirePgClient()`), więc bez `RUN_DB_TESTS=1` proof 7 raportował
`upserted: 0` na PUSTYM mocku, mimo że notyfikacja realnie istniała w
Postgresie — ta sama rodzina pułapki co `FIN-005`/audyt bazy z MEMORY.

**IO-D — blocker promocyjny, NIE designowy, zapisany tu jawnie**: CHECK
`v8_canonical_object_states_object_type_check` rozszerzony o
`kpi`/`roi_case`/`okr_set`/`deviation_case` istnieje w
`server/migrations/20260809_rvn_platform_canonical_object_type_extend.sql`
wyłącznie dla `public.v8_canonical_object_states` — kopia w schemacie `v8`
(`server/migrations/20260719_baseline_gap.sql`) NIE jest dotknięta. Ten
pakiet buduje i testuje wyłącznie przeciw efemerycznemu Postgresowi ze
świeżą migracją (`public` schema, zgodnie z `search_path` runnera migracji)
— PRZED promocją na demo trzeba zweryfikować przez `information_schema`
które schema (`public` czy `v8`) jest realnie żywe na demo (ta sama
niedomknięta decyzja #3 z §7 tego rejestru, restated tu dla RN-G3
konkretnie — jeśli demo faktycznie czyta `v8.v8_canonical_object_states`,
ten konsument pisze do martwej kopii).

**AKTUALIZACJA (§50, 2026-08-10): na świeżo zmigrowanym Postgresie 17
zweryfikowano kodem + realną bazą, że `search_path` runnera (`public, v8`)
resolvuje na `public.v8_canonical_object_states`, czyli na kopię Z
rozszerzonym CHECK — konsument PRZECHODZI na świeżej migracji. Realny
defekt NIE istnieje na tej podstawie; migracja NIE została zmieniona.
Status demo POZOSTAJE nieznany (ta sesja nie miała dostępu do demo) —
patrz §50 po dokładną komendę do uruchomienia przez człowieka.**

**Dwa martwe placeholdery w routing mapie (IO-B), pozostawione bez zmian**:
`decisions_projection`/`notifications_projection` w `atomicWrite.ts`'s
`EVENT_TYPE_CONSUMER_GROUPS` mają ZERO producentów (żaden `event_type` nie
routuje do nich) — nie usunięte (decyzja write-side, poza zakresem tego
pakietu dispatch-side), nie dodano dla nich wpisów w `CONSUMER_REGISTRY`.
Nigdy nie dead-letterują, bo nigdy nie dostają wierszy.

**Co jeszcze potrzebuje `finance_projection` (IO-C, §9 designu)**: 11 żywych
typów zdarzeń (`roi.case_approved` i pokrewne) parkuje bez konsumenta.
Brakuje: (1) identyfikacji docelowego read-modelu Finance (nieustalone w
tej sesji ani w designie), (2) napisania funkcji konsumenta, (3)
zarejestrowania jej w `CONSUMER_REGISTRY`, (4) usunięcia
`'finance_projection'` z `UNBUILT_CONSUMER_GROUPS`. Do tego czasu wiersze
zostają widoczne i replayable (status `parked`), nigdy nie giną cicho.

**Świadomie NIEZBUDOWANE / poza zakresem tego pakietu**: realna obsługa
projekcji dla ~140 typów zdarzeń innych niż te 4 z tabeli §8 designu (patrz
wyżej, "Zbudowane"); `finance_projection`'owy konsument; usunięcie martwych
placeholderów z routing mapy.

**RN-G3 zamyka pierwszą pionową kromkę end-to-end: domenowa komenda →
event+outbox (atomowo) → dispatcher → konsument → MyWork (stan kanoniczny)
+ Inbox (notyfikacja realnie widoczna przez istniejący pull path), z retry/
backoff/dead-letter/park i izolacją multi-tenant, dowiedzione na realnym
Postgresie, nie na docach.**

## 50. IO-D — rozstrzygnięcie schema-resolution dla `v8_canonical_object_states` (2026-08-10)

Bounded follow-up na blocker IO-D z §49. Pytanie: czy RN-G3 `mywork_projection`
consumer (`server/src/services/resultsVnext/platform/myworkProjectionConsumer.ts`)
zapisuje do kopii `v8_canonical_object_states`, której CHECK `object_type`
NIE został rozszerzony przez `20260809_rvn_platform_canonical_object_type_extend.sql`
(ten plik dotyka wyłącznie `public.v8_canonical_object_states`, jawnie NIE
rusza kopii w schemacie `v8` utworzonej przez `20260719_baseline_gap.sql`).

**1. Kod — obie strony piszą bez kwalifikacji schematu, polegają na `search_path`.**
`myworkProjectionConsumer.ts:116` (`upsertCanonicalObjectState`) i
`myWorkRoofService.ts:183` (`setCanonicalObjectState`, wołane przez `dbRun`/
`DbPromise`→`Database.js`→`PostgresDatabase.ts`) obie robią
`INSERT INTO v8_canonical_object_states (...)` bez `public.`/`v8.` — więc
która kopia realnie przyjmuje zapis zależy w 100% od `search_path` puli
połączeń. `PostgresDatabase.ts:470` (`pool.on('connect', ...)`) i
`PostgresDatabase.ts:609` (read replica) oraz `queryHelpers.ts:242` WSZYSTKIE
trzy ustawiają identycznie: `SET search_path TO public, v8` — `public`
PIERWSZY. Dla niekwalifikowanej nazwy Postgres bierze pierwszy schemat z
`search_path`, w którym tabela istnieje → **`public.v8_canonical_object_states`
wygrywa zawsze, gdy oba schematy mają tabelę i to ustawienie search_path
faktycznie zadziałało na danym połączeniu.**

**2. Efemeryczny Postgres 17, pełny łańcuch migracji, zero mocków.**
`initdb --locale=C` (Homebrew `postgresql@17`, `LC_ALL=C` wymagane inaczej
`FATAL: postmaster became multithreaded during startup`), TCP
`127.0.0.1:28546`, baza `consultify_iod`. Uruchomiono
`DATABASE_URL="postgres://postgres@127.0.0.1:28546/consultify_iod" NODE_ENV=test DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts`
(bez `--safe` — strict mode, ten sam runner co `STRICT_SCHEMA_REPAIR_REPORT.md`;
`NODE_ENV=test` wymagane, bo `databaseTargetResolver.ts` blokuje localhost
poza testami/CI). Wynik: **608 migracji, exit 0, ZERO błędów/skipów** (grep
po `error|fail|skip` na pełnym logu — pusto). `server/migrations-v2/` NIE
jest częścią tego łańcucha (ani `migrate.postgres.ts`, ani
`runTablePlatformMigrations()` w `DatabaseInitializer.ts` go nie czytają —
to osobny, ręcznie odpalany baseline-dump, nie automatyczny runner) —
oba schematy i obie kopie tabeli w tym teście pochodzą z `server/migrations/`
samego: `20260323_v8_mywork_roof.sql` (niekwalifikowany `CREATE TABLE`
→ `public`, stary 8-wartościowy CHECK) i `20260719_baseline_gap.sql`
(`create schema if not exists v8;` + jawne `"v8"."v8_canonical_object_states"`,
własny CHECK, też stary 8-wartościowy) + `20260809_rvn_platform_canonical_object_type_extend.sql`
(rozszerza WYŁĄCZNIE `public.`).

Zapytania na świeżo zmigrowanej bazie:
```sql
SELECT table_schema, table_name FROM information_schema.tables
 WHERE table_name = 'v8_canonical_object_states' ORDER BY table_schema;
-- public | v8_canonical_object_states
-- v8     | v8_canonical_object_states   (OBA schematy mają tabelę)

SELECT n.nspname AS schema, pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
 WHERE t.relname = 'v8_canonical_object_states' AND c.contype = 'c';
-- public: CHECK (object_type = ANY (ARRAY['task','decision','initiative','milestone',
--         'approval','ai_proposal','notification','signal','kpi','roi_case',
--         'okr_set','deviation_case']))                          <- ROZSZERZONY
-- v8:     CHECK (object_type = ANY (ARRAY['task','decision','initiative','milestone',
--         'approval','ai_proposal','notification','signal']))    <- STARY, 8 wartości

SET search_path TO public, v8;
SELECT (SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE c.oid = 'v8_canonical_object_states'::regclass) AS resolved_schema;
-- resolved_schema = public
```
Funkcjonalny dowód (pozytywny + kontrola negatywna, oba posprzątane —
`consultify_iod` to jednorazowa efemeryczna baza, nie demo): z
`search_path=public,v8` (dokładnie to, co ustawia pula appki) `INSERT ...
object_type='kpi'` **przechodzi** (`INSERT 0 1`); z odwróconym
`search_path=v8,public` ten sam INSERT **rzuca**
`violates check constraint "v8_canonical_object_states_object_type_check"`
— potwierdza, że asymetria CHECK jest realna, ale że kierunek `search_path`
appki (public pierwszy) omija ją.

**3. Werdykt: konsument PRZECHODZI na świeżo zmigrowanej bazie. Realnego
defektu (widened CHECK na schemacie, który NIE jest resolvowany) NIE
znaleziono na tej podstawie — migracja `20260809_rvn_platform_canonical_object_type_extend.sql`
NIE została zmieniona, zgodnie z poleceniem „jeśli nie ma defektu, nic nie
ruszaj". `myworkProjectionConsumer.ts` i `myWorkRoofService.ts` też NIE
zostały zmienione — kwalifikacja schematu nie jest tu potrzebna, dopóki
`search_path` appki zostaje `public, v8` (public pierwszy).**

**4. Twarde ograniczenie — TO NIE JEST DOWÓD DLA DEMO.** Ta sesja nie miała
dostępu do żywej bazy demo/prod (mandat wprost tego zakazuje). Świeżo
zmigrowana efemeryczna baza dowodzi, co się stanie na KAŻDYM nowym
środowisku zbudowanym dzisiejszym `server/migrations/` — NIE dowodzi nic o
stanie demo, które mogło powstać innym torem (dump `migrations-v2/`,
ręczne `v8-migrate.ts`, częściowo zastosowany `--safe` run z pominiętymi
plikami — patrz MEMORY „MASTER audyt bazy danych 2026-08-06": demo ma 1144
tabel vs 1290 w kanonie, `--safe` cicho pomija nieudane migracje). Human
MUSI potwierdzić na demo przed promocją tego pakietu, dokładnie tym
zapytaniem (bezpieczne, tylko SELECT, do wklejenia 1:1 przez
`psql $DEMO_DATABASE_URL` lub panel Railway):

```sql
-- 1) Które schematy mają tabelę i czy oba CHECK-i się różnią:
SELECT n.nspname AS schema, pg_get_constraintdef(c.oid) AS check_definition
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
 WHERE t.relname = 'v8_canonical_object_states' AND c.contype = 'c'
 ORDER BY n.nspname;

-- 2) Efektywny search_path dokładnie tego użytkownika/roli, którym łączy się appka:
SHOW search_path;

-- 3) Który schemat REALNIE resolvuje niekwalifikowana nazwa na tym połączeniu:
SELECT (SELECT nspname FROM pg_namespace n JOIN pg_class c ON c.relnamespace = n.oid
         WHERE c.oid = 'v8_canonical_object_states'::regclass) AS resolved_schema;
```
Jeśli `resolved_schema` na demo wyjdzie `v8` (nie `public`), IO-D jest
realnym, aktywnym blockerem na demo mimo czystego wyniku na świeżej bazie —
wtedy trzeba dopiero uruchomić fix: additive migration rozszerzająca
`v8.v8_canonical_object_states_object_type_check` tym samym wzorcem
(`DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT ... NOT VALID` + `VALIDATE`,
opakowane w `DO $$ ... EXCEPTION WHEN undefined_table THEN NULL; END $$`
jak `20260809_rvn_platform_canonical_object_type_extend.sql`) — NIE
zrobiono tego prewencyjnie w tej sesji, bo instrukcja zadania była
jednoznaczna: fix tylko jeśli defekt faktycznie istnieje na zbadanej
podstawie, a na zbadanej podstawie (świeża migracja) nie istnieje.

## 51. Kontrakt-korekta: emerytura `decisions_projection`/`notifications_projection` (2026-08-10)

Bounded task, wywołane audytem `EVENT_TYPE_CONSUMER_GROUPS`
(`atomicWrite.ts`) po §49: mapa niosła komentarz rezerwujący dwie nazwy
grup konsumenckich — `decisions_projection` i `notifications_projection` —
jako "przyszłe". Zweryfikowane grepem przed jakąkolwiek zmianą: żaden z
143 kluczy w `EVENT_TYPE_CONSUMER_GROUPS` nie routuje do żadnej z nich —
obie nazwy istniały WYŁĄCZNIE w tym jednym komentarzu, zero realnego
routingu.

**Decyzja: obie emerytowane, nie budowane.** Budowa którejkolwiek byłaby
spekulacją albo duplikacją, nie realną luką:
- `decisions_projection` nie ma producenta. `DecisionController.ts`
  (3019 linii, sprawdzone grepem) emituje ZERO wierszy
  `rvn_platform_events` — nie ma nic na outboxie do konsumowania.
  OKR-E006's `requestDecisionFromSupportRequest`
  (`okrDecisionCommands.ts`) robi już synchroniczny, wewnątrztransakcyjny
  `INSERT INTO decisions` — bardziej atomowy niż jakikolwiek async
  konsument mógłby kiedykolwiek być, a `okrDecisionResolutionScanner.ts`
  celowo odpytuje `okr_vnext_decision_links` bezpośrednio, nie przez
  outbox (§16 Open Question #4 designu OKR-E006, potwierdzone przy tej
  okazji). Żeby stała się realna: trzeba by zinstrumentować
  `DecisionController.ts` do emisji `rvn_platform_events` przy zmianach
  stanu decyzji — zmiana cross-modułowa w domenie Decisions, poza
  zakresem tej warstwy platformowej.
- `notifications_projection` zdublowałaby robotę już wykonaną w §49:
  `myworkProjectionConsumer.ts` (jedyny żywy konsument, `mywork_projection`)
  już wstawia do `notifications` na 4 typach zdarzeń — jednym z trzech
  zahardkodowanych źródeł `inboxService.materializeInboxItems()`
  (`tasks`/`decisions`/`notifications`). Drugi peer-konsument piszący do
  tej samej tabeli ścigałby się z pierwszym, nie dodawał pokrycia.
  Prawdziwa niezbudowana luka to NIE projekcja tylko event-driven
  fan-out e-mail/Slack — miejsce na to jest WEWNĄTRZ handlerów
  `mywork_projection`, wołających `NotificationOutboxService.enqueue(...)`
  (`notificationOutboxService.ts`), nie w kolidującym peer-konsumencie.

**Zmiany**:
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — stary
  komentarz przy OKR-E006 (rezerwacja obu nazw) zastąpiony blokiem
  "RETIRED VOCABULARY" z powyższym uzasadnieniem per nazwa. Zero żywych
  wpisów routingu ruszonych.
- `server/src/services/resultsVnext/platform/consumerRegistry.ts` —
  nagłówek `CONSUMER_REGISTRY` przepisany: `mywork_projection` = LIVE,
  `finance_projection` = PENDING (11 żywych typów zdarzeń / 13 kluczy
  literalnych — liczba z `RN_G6_FINANCE_PROJECTION_DESIGN.md` §0, zamrożonego
  równolegle w tym samym worktree przez inną sesję; MOJA pierwsza wersja tego
  komentarza błędnie liczyła 13 zamiast 11 — poprawione po zauważeniu
  rozjazdu z designem), oba retired-name RÓŻNE od pending (żadnego wpisu w
  żadnej z dwóch map, celowo).
- `tests/resultsVnext/platform/consumerGroupContract.test.ts` (NOWY,
  `git add -f`) — 5 asercji: (1) każda grupa, do której realnie routuje
  `EVENT_TYPE_CONSUMER_GROUPS`, jest albo w `CONSUMER_REGISTRY` albo w
  `UNBUILT_CONSUMER_GROUPS` — to jest właściwa ochrona, bo czyni klasę
  błędu "zdarzenie routowane w pustkę" strukturalnie niemożliwą do
  powtórzenia; (2) sanity-check że mapa routingu nie jest trywialnie pusta
  (>50 kluczy, `mywork_projection`/`finance_projection` obecne — broni
  przed przejściem testu (1) pusto z niewłaściwego powodu); (3) pin
  bezpośredni: `decisions_projection`/`notifications_projection` nigdy nie
  pojawiają się jako cel routingu; (4)-(5) `finance_projection` PENDING,
  `mywork_projection` LIVE.

**Weryfikacja testu jako realnej ochrony**: tymczasowo dodany wpis
`'okr_support.comment_posted': ['mywork_projection', 'decisions_projection']`
do `atomicWrite.ts` (poza commitem, przywrócone zaraz po) — 2 z 5 asercji
failują natychmiast, dokładnie ten scenariusz regresji, który test ma
łapać. Bez tej zmiany 5/5 PASS.

**Weryfikacja całości**: `npx tsc --noEmit` (`--max-old-space-size=8192`)
czysto. `tests/resultsVnext/` na efemerycznym Postgresie 17
(`initdb --locale=C`, TCP `127.0.0.1:55433`, rola/baza `iris`/`iris_test`
— dokładna kopia CI-recipe z `.github/workflows/test-suite.yml`,
`db:migrate:strict` 596 plików zero błędów) — **671 PASS, 33 FAIL, 8
skip** (712 total, `--no-file-parallelism`). Wszystkie 33 fail to
`initiatives_organization_id_fkey` w plikach ROI (`roiTrackingTransition`/
`roiVariance`/`roiVisibilityJoin`/`roiForecastActualVisibilityJoin`
realdb), PRZEDISTNIEJĄCE i NIE moje — ten sam defekt, który §37 już
naprawił punktowo w 3 innych plikach (`kpiIdentityAcrossSurfaces`/
`initiativeKpiImpactBaselineFreeze`/`kpiInitiativeImpactPerspectivesRoutesRealdb`),
tu widoczny w plikach spoza tamtego fixa. Zero błędów `decimal.js` w tym
przebiegu (nie znaczy że nie istnieją gdzie indziej — po prostu poza
zakresem uruchomionego katalogu). Mój nowy plik testowy: 5/5 PASS,
zero regresji.

**Ryzyko współbieżności odnotowane, nie moje do naprawienia**: w trakcie
tej sesji w TYM SAMYM worktree wylądował commit innej sesji
(`090cfd9be6`, `docs(rn-g6): freeze finance_projection consumer design`) i
sekcja §50 tego ledgera — dokładnie wzorzec ostrzegany w
`orkiestracja-jeden-worktree-jeden-agent`. Skutek realny: moja pierwsza
wersja komentarza w `consumerRegistry.ts` (13 zamiast 11 żywych typów
zdarzeń) była błędna do czasu zauważenia zamrożonego designu §0 tej
sesji — poprawione w tej samej sekcji. `finance_projection` prawdopodobnie
przejdzie z `UNBUILT_CONSUMER_GROUPS` do `CONSUMER_REGISTRY` w kolejnym
commicie tamtej sesji, dotykając te same dwa pliki (`atomicWrite.ts`,
`consumerRegistry.ts`) które ta sekcja właśnie zmieniła — następna sesja
powinna zweryfikować scalenie, nie zakładać czystego historii commitów.


