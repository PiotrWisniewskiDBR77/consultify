# Raport backendu (Railway) — DEMO + TRIAL

Środowisko: **staging** (`consultify` service) · obserwacja przez `railway logs` + `curl`
Uwaga: custom-domeny testowane przez `consultify-staging.up.railway.app` (patrz BUG-BE-002).
Start okna testowego: 2026-06-08 ~19:18 UTC

## Health (baseline, przed testem)
| Endpoint | Wynik |
|---|---|
| `/api/health` | 200 — db connected, redis connected, dbResponseTime ~2ms |
| `/api/public/anna/voice-config` | 200 — enabled, voice "Kore", token ephemeral |
| `/ping` | (przez custom domain 000 — patrz BUG-BE-002) |

## Anomalie z logów (baseline — przed klikaniem)

### BUG-BE-001 — Staging DB: ~50 brakujących tabel (schema drift), w tym całe billing/token
- **Severity:** P1 (ryzyko P0 dla ścieżki TRIAL)
- **Log:** co 5 min `warn [DatabaseInitializer] Schema has non-critical gaps (health remains healthy): ...`
- **Brakujące m.in.:** `billing_usage_events`, `billing_credits`, `checkout_sessions`, `proration_records`, `subscription_state_history`, `payment_attempts`, `dunning_states`, `token_ledger`, `organization_seats`, `billing_disputes`, `billing_refunds`, `organization_ai_settings`, `user_ai_settings`, `ai_policies`, `spending_alerts`, `user_gdpr_consents`, `account_deletion_requests`, `admin_audit_logs`, `megatrends`, `maturity_scores`, `report_blocks`, `report_snapshots`, `ai_experiments`, `system_config` (+ ~30 więcej).
- **Dlaczego ważne:** konwersja trialu, limity tokenów i płatności zależą od `token_ledger`, `organization_seats`, `billing_*`, `checkout_sessions`, `proration_records`. Health raportuje "healthy", więc problem jest cichy.
- **Do potwierdzenia w teście:** czy TRIAL B9–B16 (status/limity/konwersja) faktycznie działają mimo braku tych tabel.

### BUG-BE-002 — Custom-domeny (`*.consultify.app`) — błąd TLS/SNI „unrecognized name"
- **Severity:** P1
- **Objaw:** `curl https://api.staging.consultify.app/...` i `https://staging.consultify.app` → `tlsv1 unrecognized name`, HTTP 000. DNS rozwiązuje się (AWS 13.248.169.48 / 76.223.54.146), ale cert/SNI nie obsługuje tych hostów. Natywne domeny Railway działają (200).
- **Ryzyko:** użytkownicy wchodzący przez markową domenę mogą dostać błąd połączenia (zależnie od klienta TLS). Wymaga weryfikacji w realnej przeglądarce.

### BUG-BE-003 — `GET /api/demo/organization` → 401 „No token provided"
- **Severity:** P2 (do potwierdzenia)
- **Log:** `Performance metric {path:/api/demo/organization, statusCode:401, isError:true}`
- **Rozbieżność:** wg analizy kodu endpoint miał być publiczny (demo dla anonima). Jeśli demo ma działać bez logowania, to blokuje ładowanie org demo. Do potwierdzenia, czy front woła go po zalogowaniu sesji demo.

### OBS-BE-004 — `environment: "production"` na serwisie staging
- **Severity:** P3 / obserwacja
- `/api/health` na staging zwraca `"environment":"production"`. Możliwe celowe (staging w trybie prod), ale maskuje rozróżnienie środowisk w logach/telemetrii.

### OBS-BE-005 — SPA catch-all serwuje index.html dla `/.git/config`
- **Severity:** P3 / obserwacja
- `GET /.git/config` → 200, serwuje `index.html` (nie prawdziwy plik). Nie jest to wyciek, ale catch-all łapie wszystkie ścieżki — warto mieć świadomość przy skanach bezpieczeństwa.

---
## Anomalie potwierdzone w trakcie klikania

### BUG-BE-006 — Twarde błędy Postgres przez drift schematu (eskalacja BUG-BE-001)
- **Severity:** P0 (na staging) / ryzyko P0 dla prod, jeśli ten sam build/baza
- **Log (org `atelier`), powtarzane wielokrotnie:**
  - `error [DB:Promise] column "user_status" does not exist` — `SELECT user_status FROM users WHERE id = $1` (wołane m.in. przez `/api/v8/admin/flags`). Brak kolumny w **kluczowej tabeli `users`**.
  - `error [DB:Promise] column "is_on_target" does not exist` — `SELECT COUNT(*) FROM initiative_kpis WHERE organization_id=$1 AND is_on_target=1`. Błąd na każdym liczeniu KPI inicjatyw.
  - `error [DB:Promise] relation "sso_configurations" does not exist` — brak całej tabeli; błąd przy każdym sprawdzeniu SSO.
- **Wniosek:** „non-critical gaps" z BUG-BE-001 w praktyce rzucają realne błędy SQL na żywych żądaniach. Front je maskuje (degradacja danych / zliczeń), ale baza staging jest materialnie niezgodna z kodem.

### BUG-BE-007 — Routery `/api/v8/<feature>/*` niezamontowane → 404 (rozjazd wersji)
- **Severity:** P1
- **Działają:** `/api/v8/admin/flags` (200), `/api/v10/teresa/voice-config` (200), `/api/v10/teresa/voice-event` (202).
- **Zwracają 404:** `/api/v8/interview/*`, `/api/v8/assessment`, `/api/v8/planning/*`, `/api/v8/execution-control/*` (10+ ścieżek).
- **Wniosek:** to nie cała przestrzeń v8 — brakuje konkretnych routerów feature'owych. Build serwera na staging jest starszy niż frontend (który już woła v8). Front ratuje się fallbackami na starsze endpointy.

### OBS-BE-008 — Wydajność: `High DB query count {path:/api/v8/admin/flags, dbQueryCount:24}`
- **Severity:** P2
- 24 zapytania DB na jedno wywołanie flag — zapach N+1; do przeglądu po naprawie schematu.

### Korelacje FE↔BE (po czasie/endpoint)
- FE: chat w demo → `POST /api/conversations` **403** + modal `DEMO_READ_ONLY`. BE: demoGuard blokuje zapis — **zachowanie poprawne** (write-protection działa).
- FE: rejestracja demo → `POST /api/auth/register-demo` **200** (konto `qa-demo-0608@example.com` → ADMIN org `atelier`).
- FE: `/trial` zły kod → `GET /api/access-codes/validate/REF-1234` **200** + UI „Niepoprawny lub wygasły kod" — **poprawne**.
- FE: 404 na stronach Wywiad/Narzędzia/Inicjatywy/Realizacja = BUG-BE-007.
- FE: puste KPI/sygnały realizacji = BUG-BE-006 (błędy `is_on_target`) + BUG-BE-007.
