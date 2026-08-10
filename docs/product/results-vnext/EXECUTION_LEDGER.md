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

## 39. OKR-E001 Program & Cycle — implementacja + odbiór (2026-08-10)

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

