# Final Implementation Contract — Integracja (Position 1/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Integracja z zewnętrznymi programami.
- **Primary users**: operatorzy (admin/org owner), użytkownicy końcowi korzystający z połączonych źródeł.
- **Success metric**: deklarowane providery mają kompletny lifecycle: connect → complete → monitor → recover, bez „martwych” stanów i bez sprzecznych prawd między UI.

## 2. Scope
### 2.1 In-scope
- User-facing control plane dla połączeń i synchronizacji (deklarowane providery).
- Widoczne stany: connected / degraded / requires reauth / blocked / recoverable.
- Operacyjna ścieżka: onboarding + post-connect utrzymanie (reauth, recovery, drift).

### 2.2 Out-of-scope / non-goals
- Pełna parity z platformami iPaaS (bo to osobny program produktowo-inżynieryjny).
- „Każdy provider z rynku”.
- Udawanie, że “Integracja” = “Synchronizacja platform” (pozycja  — osobny moduł programu).
- Zastąpienie kontraktu integracji “page’em ustawień” bez operator-grade lifecycle (to jest anty-cel).
- Zmiana architektury platformy sync jako warunek wstępny (kontrakt wymaga stabilnej gramatyki lifecycle i obserwowalności; re-arch jest osobnym zakresem).

### 2.3 P01-A canon (control-plane canon + object model)

Ta sekcja jest **zamrożonym kanonem** dla `Integracja` jako control plane. Każda implementacja (`P01-B+`) musi:
- rozszerzać poniższy model (bez równoległych prawd),
- używać tej samej gramatyki stanów (bez provider-specific ad-hoc stanów),
- prowadzić operatora po tych samych powierzchniach “health → runs → recovery”.

#### 2.3.1 Declared P0 providers (explicit list)

P01-A deklaruje P0 tylko dla rodzin providerów, które mają pełny sens “connect → complete → monitor → recover” w Wave1/near-term lane i są spójne z benchmark + readiness.

- **Google Workspace**: Google Calendar, Google Drive
- **Microsoft 365 (Microsoft Graph)**: Outlook Calendar, OneDrive/SharePoint, Microsoft Teams
- **Slack**
- **Jira Cloud (Atlassian)**
- **Generic Webhooks + API keys** (first‑party integration endpoints, inbound/outbound deliveries)

Jawny non-goal w P01-A: **nie deklarujemy** jako P0 “non‑Jira Tier‑A peer” (np. Asana vs Monday) dopóki wybór nie zostanie rozstrzygnięty w osobnym bounded pakiecie (nie ma “one of” w kanonie).

#### 2.3.2 Object model (frozen)

Model obiektów jest identyczny na wszystkich powierzchniach (UI, API, audit, obserwowalność). Nie wolno “sklejać” obiektów w jeden ekran bez zachowania rozdziału prawdy.

1) **`provider_catalog_item`** (platform / catalog)
- Co to jest: wpis w katalogu providerów (vendor + capability + polityki + dozwolone auth modele).
- Po co: definiuje, co jest możliwe, dozwolone i jak to wygląda (także dla operatora i supportu).

2) **`connection`** (tenant binding + credential)
- Co to jest: instancja połączenia tenantu do konkretnego `provider_catalog_item` + referencja do credential/secrets.
- Po co: to “źródło prawdy” o tym, czy tenant jest połączony i czy połączenie jest zdrowe/bezpieczne.

3) **`workflow` / `sync`** (design-time definition)
- Co to jest: definicja “co robimy” na danym `connection` (zakres, mapping, tryb: schedule/webhook/manual, enable/disable).
- Po co: rozdziela “mamy połączenie” od “mamy włączoną synchronizację / publikację”.

4) **`run` / `job`** (runtime execution record)
- Co to jest: niezmienny rekord wykonania `workflow` (trigger, start/end, outcome, error class, retry/replay, trace pointers).
- Po co: daje operatorowi historię, listę błędów i możliwość korelacji z tracingiem bez zgadywania.

Relacje (kanoniczne):
`provider_catalog_item` \(1\) → `connection` \(N\) → `workflow` \(N\) → `run` \(N\).

#### 2.3.3 Lifecycle grammar (frozen per object)

Każdy stan MUSI mieć: **meaning**, **consequence**, **next action**, **owner** (tenant vs platform).

##### A) `provider_catalog_item` (platform-owned)

| State | Meaning | Consequence | Next action | Owner |
| --- | --- | --- | --- | --- |
| `draft/setup` | provider jeszcze nie jest “published” lub jest w przygotowaniu | tenant nie może tworzyć połączeń; brak obietnic runtime | platform publikuje albo usuwa z kanonu | platform |
| `connected` | provider jest aktywny i dopuszczony do użycia | można tworzyć `connection`; statusy są raportowane spójnie | monitorowanie + polityki | platform |
| `degraded` | provider-wide problem (incydent, częściowa niedostępność, podwyższona latencja) | nowe i bieżące `run` mogą failować; UI musi pokazać degraded jako vendor-wide | opisać incydent + expected recovery window | platform |
| `requires_action` | platform musi wykonać pracę (np. zmiana scopes, certs, app registration) żeby provider działał dalej | wszystkie affected `connection` muszą dostać czytelny reason; runs mogą być wstrzymane | wykonać action + opublikować runbook | platform |
| `recovered` | provider wrócił do normy po incydencie | UI może pokazać “Recovered” jako świeży event; stan docelowy wraca do `connected` | zamknąć incydent, zostawić audit | platform |
| `blocked` | provider jest globalnie zablokowany (policy, deprecation, security incident) | brak możliwości użycia; wszystkie connections przechodzą do `blocked` z reason | operator decyzja: unblock / migrate / deprecate | platform |

##### B) `connection` (tenant-owned, platform-enforced)

| State | Meaning | Consequence | Next action | Owner |
| --- | --- | --- | --- | --- |
| `draft/setup` | tenant rozpoczął setup, ale nie ma completion proof | brak gwarancji działania; `workflow` nie może wejść w `connected` | dokończyć setup + przejść verify/test | tenant |
| `connected` | połączenie jest zweryfikowane (token/scopes/tenant reachability) | `workflow` może być włączony; runs mają prawo startować | monitorować + utrzymać zdrowie | tenant |
| `degraded` | połączenie działa częściowo lub niestabilnie (np. transient refresh failures, partial reachability) | runs mogą być ograniczone albo opóźnione; musi istnieć reason | retry/auto-recovery; jeśli nie wraca → eskalacja | platform (auto) + tenant (info) |
| `requires_action` | wymagana akcja człowieka (reauth, consent, scope fix) | runs zależne od połączenia są wstrzymane lub failują pre-check | rozpocząć reauth; po reauth obowiązkowy verify/test | tenant |
| `recovered` | połączenie przeszło recovery (reauth lub fix) i przeszło verify/test | UI pokazuje “Recovered” jako świeży event; stan docelowy wraca do `connected` | opcjonalnie replay zaległych runs | tenant + platform |
| `blocked` | połączenie nie może działać (policy disallow, provider blocked, org disabled) | brak możliwości uruchomienia runs; workflow nie może się włączyć | operator/admin decyzja: unblock / disconnect | platform + tenant admin |

##### C) `workflow` / `sync` (tenant-owned definition)

| State | Meaning | Consequence | Next action | Owner |
| --- | --- | --- | --- | --- |
| `draft/setup` | workflow istnieje, ale nie spełnia wymogów (mapping, scope, verification) | nie wolno “udawać enabled”; brak runs | uzupełnić mapping/scope → verify/test | tenant |
| `connected` | workflow jest enabled i przechodzi pre-check na `connection` | runs mogą startować; monitoring aktywny | normalne operowanie | tenant |
| `degraded` | workflow ma problem, ale jest **recoverable** (np. rate limit/backoff, transient provider errors) | runs mogą się opóźniać; UI musi pokazać degraded + reason | poczekać/auto-retry; jeśli trwa za długo → requires_action | platform (auto) + tenant (visibility) |
| `requires_action` | workflow wymaga ręcznej interwencji (mapping drift, permission change, repeated permanent failures) | runs są wstrzymane lub kierowane do “jobs in error” | naprawić mapping/config → verify/test → enable/replay | tenant |
| `recovered` | workflow wrócił do działania po manual recovery | UI pokazuje “Recovered”; stan docelowy wraca do `connected` | opcjonalny replay zaległych | tenant |
| `blocked` | workflow jest świadomie zablokowany (pause, safety gate, policy) | brak runs | odblokować lub usunąć; zachować audit | tenant + platform (policy) |

##### D) `run` / `job` (runtime record, platform-owned execution)

`run` ma również runtime statusy (queued/running/succeeded/failed), ale control-plane mapuje je na poniższą gramatykę, żeby operator widział “co dalej”.

| State | Meaning | Consequence | Next action | Owner |
| --- | --- | --- | --- | --- |
| `draft/setup` | run jest utworzony i czeka na pre-check lub zasoby | brak wyniku; nie wolno pokazywać jako “success” | poczekać; jeśli utknął → diagnoza | platform |
| `connected` | run wykonuje się lub jest w normalnym przebiegu | w toku; raportuje progress | obserwować; ewentualnie cancel (bounded) | platform |
| `degraded` | run jest retryowany / backoff / częściowo wykonany; **recoverable** | opóźnienie; może przejść do success bez akcji usera | poczekać; jeśli retry exhausted → requires_action | platform |
| `requires_action` | run jest w dead-letter/quarantine albo permanent failure wymagającym decyzji | brak automatycznego powrotu | operator/tenant wybiera replay, fix, lub close | tenant (dla mapping/permissions) + platform (dla infra) |
| `recovered` | run został zreplayowany i zakończył się sukcesem po failure | zapis audit “recovered” + korelacja do wcześniejszego run | brak; wraca do normalnego monitoringu | platform |
| `blocked` | run jest zablokowany przez parent state (connection/workflow `requires_action`/`blocked`) | run nie może wystartować | napraw parent (reauth/mapping) → replay | tenant + platform |

#### 2.3.4 Frozen operator surfaces (minimum)

Minimalny operator-grade zestaw powierzchni (bez rozszerzania UI o równoległe “run truth”):

1) **Provider health list**
- Widok: tabela/lista providerów z agregacją po tenant `connection` + `workflow`.
- Filtry (must): `requires_action`, `degraded`, `blocked`.
- Kolumny (minimum): provider family, impacted connections, impacted workflows, last run, current state, reason, **next action**, owner.

2) **Jobs-in-error**
- Widok: kolejka `run` w `requires_action` (failed permanent / dead-letter).
- Must show: error class/category, first seen, last attempt, retry count, affected workflow + connection, owner.

3) **Run history + drill-down**
- Widok: historia runów per workflow oraz globalnie (bounded time window).
- Drill-down (bounded): timestamps, trigger, outcome, error summary, retry/replay actions (jeśli dozwolone), oraz **tracing pointers** (np. correlation id / trace id / log stream pointer) — bez prób budowy pełnego APM w UI.

#### 2.3.5 Onboarding “completion proof” doctrine (no guessing)

Onboarding jest zawsze trójfazowy i jawny:
`setup` → `verify/test` → `enable`.

Zasady:
- `connected` wolno pokazać dopiero po `verify/test` (token/scopes + reachability + minimal operation proof).
- “verify/test” tworzy artefakt dowodu: co najmniej jeden `run` typu `test` z wynikiem + zapisanym pointerem do diagnostyki.
- `enable` oznacza, że workflow jest włączony i ma jasne zasady triggerów (schedule/webhook/manual) — brak “włączone ale nie wiadomo czy działa”.

#### 2.3.6 Recovery doctrine (bounded)

1) **Reauth**
- Trigger: `connection.requires_action` z reason kategoryzowanym (revoked/expired/scope_reduced/tenant_unreachable).
- Zasada: reauth nie niszczy mappingów/workflow; po reauth zawsze `verify/test` przed powrotem do `connected`.

2) **Retry vs replay**
- `retry`: automatyczne, tylko dla recoverable klas błędów (rate limit, transient outage, timeouts) z backoff.
- `replay`: świadome, manualne powtórzenie runu po naprawie (reauth/mapping); musi być idempotent-safe i zapisane w audit.

3) **Drift detection**
- Drift (schema/mapping) jest osobnym reason i prowadzi do `workflow.requires_action` (nie “cichy fail”).
- Po naprawie driftu obowiązuje `verify/test` przed enable/replay.

#### 2.3.7 Anti-duplicate gate (must)

- Nie wolno zakończyć na “settings page only” — control plane musi mieć health + runs + recovery.
- Nie wolno dodawać provider-specific stanów poza kanoniczną gramatyką (stany = kanon; reason = szczegół).
- Nie wolno budować równoległej prawdy o runach (np. osobna tabela/strona z innym statusem niż `run`).
- Każda akcja recovery musi prowadzić do jednego SSOT (connection/workflow/run) i być audytowalna.

#### 2.3.8 Error posture (minimum scenarios)

Co najmniej poniższe scenariusze muszą mapować się na obiekt + stan + owner + next action (bez “unknown error” jako jedynej kategorii):

1) **Reauth required (consent revoked / invalid_grant)** → `connection.requires_action` → next: reauth → owner: tenant
2) **Rate limit (429 / vendor throttling)** → `run.degraded (recoverable)` → next: wait/backoff → owner: platform
3) **Permission revoked / scopes reduced (403)** → `connection.requires_action` → next: reauth/consent with scopes → owner: tenant (+ platform policy visibility)
4) **Mapping drift / schema change** → `workflow.requires_action` → next: review mapping + verify/test → owner: tenant
5) **Run failed (transient timeout / network)** → `run.degraded (recoverable)` → next: auto-retry → owner: platform
6) **Run failed (permanent validation / bad config)** → `run.requires_action` → next: fix config/mapping, replay → owner: tenant
7) **Provider outage** → `provider_catalog_item.degraded` → next: platform incident + comms → owner: platform
8) **Webhook delivery failure (410/401/invalid endpoint)** → `workflow.degraded` → next: retry/backoff; jeśli trwa → `workflow.requires_action` → owner: tenant + platform
9) **Org policy blocks provider** → `connection.blocked` → next: unblock/policy change or disconnect → owner: platform + tenant admin

#### 2.3.9 Acceptance checklist (P01-A scope approval) — testable

- [ ] P0 providers są wymienione jawnie (bez “one of”) i ograniczone do declared list.
- [ ] Object model zawiera dokładnie: `provider_catalog_item`, `connection`, `workflow(sync)`, `run(job)`.
- [ ] Każdy obiekt ma zamrożoną gramatykę: `draft/setup → connected → degraded → requires_action → recovered` (+ `blocked`/`recoverable` gdzie potrzebne).
- [ ] Każdy stan ma: meaning, consequence, next action, owner (tenant vs platform).
- [ ] Operator surfaces minimum są zamrożone: provider health list + jobs-in-error + run history + drill-down.
- [ ] Filtry provider health list zawierają: requires_action / degraded / blocked.
- [ ] Drill-down runa zawiera bounded tracing pointers (correlation/trace/log pointers) bez budowy “full APM UI”.
- [ ] Onboarding completion proof jest jawne: `setup → verify/test → enable`, bez zgadywania.
- [ ] Recovery doctrine obejmuje: reauth, retry/replay, drift detection (bounded).
- [ ] Anti-duplicate gate jest jawnie zapisany (no settings-only; no provider-specific states; no parallel run truth).
- [ ] Error posture zawiera min. 8 scenariuszy z mapowaniem na obiekt+stan+owner+next action.
- [ ] Wiersz evidence ledger `P01-A` jest wypełniony commit ref po closeout pakietu.

### 2.4 Assumptions
- `Synchronizacja` (position  — Wave2) rozszerza broad platformę; `Integracja` utrzymuje spójny, bounded control plane.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_INTEGRACJA_2026-03-29.md`
- Benchmark doctrine: `docs/product/SYNC_PLATFORM_BENCHMARK_V8.md`
- Readiness: `docs/product/EXTERNAL_SYNC_READINESS_AUDIT_V8.md`

Conflict rule: jeśli kontrakt i plan szczegółowy różnią się, wygrywa plan szczegółowy + SSOT/readiness; kontrakt jest ujednoliceniem formy i evidence.

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- **SSOT benchmark**: `docs/product/SYNC_PLATFORM_BENCHMARK_V8.md` (Boomi + Workato + MuleSoft jako “maturity reference”).

### 4.2 Local Softs evidence (concrete artifacts)
- **Workato (jobs / tracing / security posture)**:
  - `Softs/0 synchronizacja/Workato/docs.workato.com/en/recipes/job-debug-tracing.html` (job debug tracing; sekcje m.in. “Viewing job debug tracing”, “Jobs in error”).
  - `Softs/0 synchronizacja/Workato/docs.workato.com/en/security/data-protection/secrets-management/secrets-management.html` (“Secrets management for connection credentials”; external secrets manager, rotation; troubleshooting “Permission denied”).
- **Boomi (control tower / monitoring / API lifecycle)**:
  - `Softs/0 synchronizacja/Boomi/help.boomi.com/docs/Atomsphere/Platform/Act-manageandmonitor.html` (centralized control tower: connect providers → view/manage → monitor → anomalies).
  - `Softs/0 synchronizacja/Boomi/help.boomi.com/docs/Atomsphere/API Management/Topics/APIM_overview.html` (API lifecycle management, security, traffic control, policy enforcement, flexible deployment).
- **MuleSoft mirror (runtime vs management plane, on-prem/hybrid deployment concepts)**:
  - `Softs/0 synchronizacja/Mustsoft/docs.mulesoft.com/mule-runtime/latest/mule-deployment-model.html` (m.in. “Communication Between Mule Instances and the Management Plane”; on-prem vs CloudHub/Runtime Fabric).

### 4.3 Parity checklist vs Softs (approval-grade)
**Kontrakt wymaga parity w sensie “operator-grade control plane”, nie parity w sensie “pełne iPaaS”.**

- **Object model parity (Workato)**:
  - Jasny rozdział obiektów: **provider/catalog** → **connection/credential** → **workflow/sync recipe** → **job/run** (osobne widoki, osobne lifecycle, osobne logi).
  - Każdy “run/job” ma tożsamość, status, timestamps, wynik, powód błędu, retry/replay entry point.
- **Control plane vs runtime split (MuleSoft / benchmark)**:
  - Jawne rozdzielenie: konfiguracja + governance (control plane) vs wykonanie (runtime) + obserwowalność.
  - Runtime działa niezależnie, ale raportuje do control-plane; degradacja i błędy wracają jako stany produktu, nie “ciche” logi.
- **Onboarding completeness (benchmark)**:
  - Setup jest “highly structured”: wizard, capability selection, mapping review, “test-before-enable”.
  - “Completion proof” po connect (user/operator nie zgaduje czy to działa).
- **Mapping as a product surface (Workato / benchmark)**:
  - Mapa pól/transformacji/walidacji: podgląd, walidacja, wykrywanie driftu schematu, bezpieczne zmiany.
- **Run observability as product (Workato / benchmark)**:
  - Run history, debug/tracing, Jobs-in-error list, szybka diagnostyka, czytelny error model.
  - “Retry / recovery” jako akcje użytkownika/operatora (nie tylko backend).
- **Secrets + credential governance (Workato)**:
  - Brak hardcodowanych secretów; wsparcie dla external secrets manager / rotation; audyt użycia.
  - Granularne uprawnienia do zarządzania połączeniami/sekretami.
- **Monitoring + anomaly posture (Boomi)**:
  - Monitoring dashboard: invocations, avg time, errors; baseline/anomaly framing i ścieżka do “what next”.
- **API / policy thinking (Boomi + MuleSoft)**:
  - Jeżeli provider integruje się przez API: polityki, rate limiting, traffic control, RBAC, audyt, zgodność.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy o stanie “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_INTEGRACJA_2026-03-29.md` + readiness audit.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Object separation: connection / workflow / run | Workato model requires explicit objects | “jobs and health productization remain thin” | Wprowadzić spójny model obiektów + UI dla run/job (history, status, retry) | P0 |
| Operator visibility (health, runs, next action) | Leaders expose health + recovery workflows | “monitoring and operator visibility are still light” | Zbudować operator overview (health model + “co dalej”) + drill-down | P0 |
| Onboarding depth + completion proof | Structured wizard + test-before-enable | “provider onboarding is still not deep enough” | Dodać completion grammar (setup → verify → enable) dla deklarowanych providerów | P0 |
| Recovery lifecycle (reauth / drift / stale) | Post-connect continuity is core | “post-connect lifecycle parity is still weaker” | Zamknąć reauth/recover/drift jako jawne stany + akcje + audit | P0 |
| Mapping surface | Mapping is first-class product | (nieudowodnione w planie) | Jeśli mapowanie jest wymagane przez providera: UI + walidacja + preview + drift | P1 (P0 gdy dotyka aktywnych providerów) |
| Secrets governance | Secrets mgmt + rotation + audit | (nieudowodnione w planie) | Zdefiniować standard secrets/credential: storage, rotation, audit, RBAC | P1 |
| Private connectivity / hybrid runtime | On-prem/hybrid is maturity pattern | (brak jawnego dowodu) | Kontrakt wymaga “leave room” (nie implementować, ale nie blokować) | P2 |

## 5. Product contract (user-facing)
### 5.1 Primary flows
- Provider selection → authorize/configure → completion proof → enable.
- Monitor health → inspect run history/errors → recover (reauth/retry) → return to healthy.

### 5.2 UI surfaces / entry points
- `Integracja` jako jawny „control plane”, nie ukryty zestaw ustawień.
- Powierzchnie operatora (minimum):
  - lista providerów i ich stanów (z filtrami “requires action / degraded / blocked”),
  - “run history / jobs” (dla declared providers),
  - “errors” z przyczyną + rekomendowaną akcją + ownerem akcji (tenant vs platform).

### 5.3 States and transitions
- Minimum: draft/setup → connected → degraded → requires_action (reauth) → recovered.
- Stan nie może być “ładnym labelkiem” — musi mieć: opis, konsekwencję, next action, oraz ścieżkę powrotu do healthy.

### 5.4 Error model / degraded modes
- Każdy failure musi mieć: „co nie działa”, „co dalej”, „kto jest ownerem akcji” (tenant vs platform operator).
- Error model musi mapować się na obiekty: connection vs workflow vs run/job (żeby operator wiedział, gdzie interweniować).

## 6. Data + API contract (engineering-facing)
Źródłem szczegółów jest plan modułu (link w sekcji 3). Kontrakt wymaga (minimum):

- **Entities (must exist as first-class)**:
  - **ProviderCatalogItem**: vendor, capability flags, governance/policy hooks, supported auth methods.
  - **Connection**: provider ref, credential ref, status, last_ok_at, last_error_at, requires_action_reason, scopes.
  - **Workflow/Sync** (jeśli dotyczy): mapping/transform rules, enabled flag, schedule/webhook mode, drift status.
  - **Run/Job**: immutable run id, start/end, outcome, error_code, error_message, retry_count, trace/debug artifact pointers.
- **Audit + logging (must be productized)**:
  - audyt zmian (kto/ kiedy zmienił connection/workflow),
  - run/job logs, lista “jobs in error”, oraz możliwość korelacji błędu z obiektem.
- **Secrets posture (must be explicit)**:
  - polityka przechowywania tokenów/sekretów, rotacja, minimalne uprawnienia; docelowo kompatybilność z external secrets manager (jeśli wymagane przez enterprise posture).

## 7. Evidence plan (DoD)
### 7.1 Acceptance criteria
- Deklarowany provider przechodzi end-to-end: connect → complete → monitor → recover.
- UI pokazuje stan spójnie (brak sprzecznych ekranów) i nie ukrywa degraded state.
- Operator potrafi wskazać “co jest problemem” w kategoriach obiektu (connection/workflow/run) oraz wykonać “next action”.

### 7.2 Tests
- Integracyjne testy lifecycle (auth/reauth), run history, degraded state mapping.
- Testy kontraktowe statusów: mapping błędów → stany produktu (np. token revoked → requires_action; rate limit → degraded/retryable).

### 7.3 Staging proof checklist
- Demo: connect + induced failure + recovery + powrót do healthy.
- Demo: “jobs in error” → drill-down → debug/tracing artifact → retry/replay (jeśli dotyczy).

### 7.4 Telemetry and monitoring
- Eventy: connection_created, connection_failed, reauth_required, run_failed, run_recovered.
- Dodatkowe minimum: run_started, run_succeeded, run_retry_scheduled, drift_detected, mapping_changed, secret_rotated (jeśli dotyczy).

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Detailed plan/SSOT: `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_INTEGRACJA_2026-03-29.md`
- Benchmark doctrine: `docs/product/SYNC_PLATFORM_BENCHMARK_V8.md`
- Evidence plan: see section 7.

### 8.1 Bounded delivery packets
#### P01-A — Control-plane canon + object model (scope approval)
- **Goal**: spójny model obiektów (provider/connection/workflow/run) + lifecycle language.
- **Inputs required**: decyzja o declared providers (P0) + minimalny run/job surface.
- **Acceptance**: scope zatwierdzony; non-goals jawne; degraded/recovery grammar spisana.
- **Evidence**: scope approval + linkowane benchmarki.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze declared providers (P0) + map provider→objects (connection/workflow/run).
  - Define status grammar per object (connected/degraded/requires_action/blocked/recoverable).
  - Define operator “next action” surfaces (health + jobs-in-error + drill-down).
- **DoD**:
  - Approved(scope): object model + lifecycle language are explicit and bounded.
  - Missing-input resolved for declared providers (no guessing on semantics).

#### P01-B — Lifecycle closure (connect→monitor→recover)
- **Goal**: onboarding + completion proof + post-connect operacyjność (run history, errors, retry).
- **Acceptance**: induced failure→requires_action→recovery działa; operator ma “next action” per obiekt.
- **Evidence**: integracyjne testy + staging demo (section 7.3).
- **Tasks**:
  - Implement connect→completion proof and post-connect recovery flows (reauth/retry).
  - Implement run history + jobs-in-error list + drill-down to tracing artifacts (bounded).
  - Add integration tests for lifecycle + error→state mapping (7.2).
- **Staging proof script (click-by-click)**:
  1. Open `Integracja` control plane and pick one declared provider (P0).
  2. Connect (authorize) and confirm “completion proof” state is visible.
  3. Open run history / jobs list; verify at least one successful run is visible.
  4. Induce a recoverable failure (e.g., expired/revoked token) and observe `requires_action`.
  5. Execute recovery (reauth/retry) and verify return to `healthy` + audit updated.
  6. Open a failed job drill-down and confirm debug/tracing pointers are accessible (bounded).
- **DoD**:
  - E2E flow works for declared providers; failure and recovery are product states (not logs).
  - Tests + staging proof are ready to attach to evidence ledger.

#### P01-C — Verification + rollout
- **Goal**: telemetry + regresje + staging proof; bezpieczny rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Run tests, execute staging demos (7.3), and fill evidence ledger rows P01-A/B/C.
  - Validate rollout/rollback (flags; safe read-only fallback).
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits recorded.

### 8.2 Rollout strategy
- Najpierw 1–2 providery P0 + run history + recovery; dopiero potem rozszerzenia (mapping/secrets governance).

### 8.3 Rollback plan
- Wyłącz write/sync operations; zachowaj read-only statusy + audit; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: „settings page” zamiast control-plane; brak job/run modelu; zbyt dużo provider-specific wyjątków.
- Ryzyko: “connect works once” bez trwałej operacyjności (brak run history, brak recovery grammar).
- Ryzyko: brak jednej gramatyki lifecycle (każdy provider “inaczej”) → chaos w UI i wsparciu.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P01-A |  |  |  |  |  |
| P01-B |  |  |  |  |  |
| P01-C |  |  |  |  |  |

