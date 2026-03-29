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
- Pełna parity z platformami iPaaS.
- „Każdy provider z rynku”.

### 2.3 Assumptions
- `Synchronizacja` (position  — Wave2) rozszerza broad platformę; `Integracja` utrzymuje spójny, bounded control plane.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_INTEGRACJA_2026-03-29.md`
- Benchmark doctrine: `docs/product/SYNC_PLATFORM_BENCHMARK_V8.md`
- Readiness: `docs/product/EXTERNAL_SYNC_READINESS_AUDIT_V8.md`

Conflict rule: jeśli kontrakt i plan szczegółowy różnią się, wygrywa plan szczegółowy + SSOT/readiness; kontrakt jest ujednoliceniem formy i evidence.

## 4. Softs inspirations (benchmark apps)
- **Primary**: `Boomi`, `Workato`, `MuleSoft` (z `SYNC_PLATFORM_BENCHMARK_V8.md`).
- **Secondary / adjacent**: (nazwa „Zapier/Make” pojawia się jako non-goal w planie Integracji — nie jako target parity).

## 5. Product contract (user-facing)
### 5.1 Primary flows
- Provider selection → authorize/configure → completion proof → enable.
- Monitor health → inspect run history/errors → recover (reauth/retry) → return to healthy.

### 5.2 UI surfaces / entry points
- `Integracja` jako jawny „control plane”, nie ukryty zestaw ustawień.

### 5.3 States and transitions
- Minimum: draft/setup → connected → degraded → requires_action (reauth) → recovered.

### 5.4 Error model / degraded modes
- Każdy failure musi mieć: „co nie działa”, „co dalej”, „kto jest ownerem akcji” (tenant vs platform operator).

## 6. Data + API contract (engineering-facing)
- Źródłem szczegółów jest plan modułu (link w sekcji 3). Kontrakt wymaga:
  - rozdzielenia obiektów: provider catalog, connection/credential, workflow/sync, run/job
  - audytu i logów na poziomie run/job.

## 7. Evidence plan (DoD)
### 7.1 Acceptance criteria
- Deklarowany provider przechodzi end-to-end: connect → complete → monitor → recover.
- UI pokazuje stan spójnie (brak sprzecznych ekranów) i nie ukrywa degraded state.

### 7.2 Tests
- Integracyjne testy lifecycle (auth/reauth), run history, degraded state mapping.

### 7.3 Staging proof checklist
- Demo: connect + induced failure + recovery + powrót do healthy.

### 7.4 Telemetry and monitoring
- Eventy: connection_created, connection_failed, reauth_required, run_failed, run_recovered.

## 8. Delivery plan
- Packetizacja zgodnie z `WAVE1_FINAL_IMPLEMENTATION_PLAN_INTEGRACJA_2026-03-29.md`.

## 9. Risks / open questions / decisions
- Ryzyko: „settings page” zamiast control-plane; brak job/run modelu; zbyt dużo provider-specific wyjątków.

## 10. Evidence ledger (fill after delivery)
- PRs:
- Staging proof:
- Test runs:

