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

