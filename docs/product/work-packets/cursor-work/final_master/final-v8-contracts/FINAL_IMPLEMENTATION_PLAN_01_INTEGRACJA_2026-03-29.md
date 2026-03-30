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

### 2.3 Assumptions
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

#### P01-B — Lifecycle closure (connect→monitor→recover)
- **Goal**: onboarding + completion proof + post-connect operacyjność (run history, errors, retry).
- **Acceptance**: induced failure→requires_action→recovery działa; operator ma “next action” per obiekt.
- **Evidence**: integracyjne testy + staging demo (section 7.3).

#### P01-C — Verification + rollout
- **Goal**: telemetry + regresje + staging proof; bezpieczny rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).

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

