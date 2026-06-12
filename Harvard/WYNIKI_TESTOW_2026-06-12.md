# Wyniki testów full-stack — staging, 2026-06-12

**Stack:** FE `127.0.0.1:3000` → BE `127.0.0.1:3001` → staging Postgres (0-drift). Zalogowany: piotr.wisniewski@dbr77.com, org `dbr77`, **OWNER**. FE = Chrome MCP, BE = API (cookie sesji) + curl (no-auth) + read-only DB.

## Front-end

| # | Scenariusz | Wynik | Dowód |
|---|-----------|-------|-------|
| A1 | Smoke (konsola + render) | ✅ PASS | zero błędów konsoli; zalogowany render `/chat`; brak pozycji „Ecosystem Impact" |
| A2 | Decyzja #1 — Affiliate usunięty | ✅ PASS | `/affiliate` → redirect `/chat`; brak dashboardu Ecosystem, brak „Section not found" |
| A3 | Decyzja #3 — Billing wpięty | ✅ PASS (z notą) | `/settings/billing` osiągalny, brak „Section not found"; OWNER → `/admin/billing` (Billing & FinOps). Dla nie-admina renderuje `BillingSettings` |
| A4 | Decyzja #6 — M20 sync „Coming soon" | 🟡 kod-zweryf. | shipped (`b074760074`); żywa głęboka nawigacja do panelu tabeli odłożona |
| A5 | Czat | ✅ render | UI Teresy renderuje; wysyłka nie odpalona (oszczędność AI) |
| A6 | Wywiad | ✅ PASS | renderuje Inbox/Sesje/Przydzielone/Szablony/Wnioski/Inicjatywy |
| A7 | Inicjatywy + deep-link M14→M15 | ✅ PASS (z notą) | **36 inicjatyw ze staging**; deep-link `/benefits?initiativeId=` to poprawna trasa, ale Rezultaty beta-closed → redirect (patrz nota) |
| A8 | Rezultaty render | 🔒 beta-closed | `betaAccess.ts:39 MODULE_BENEFITS:'closed'` + `<BetaGate>` → redirect `/chat` (oczekiwane; OWNER nie jest uczestnikiem beta) |

## Back-end

| # | Scenariusz | Wynik | Dowód |
|---|-----------|-------|-------|
| B1 | Health | ✅ PASS | `status:ok, database:connected, redis:connected` |
| B2 | V8 routery zamontowane (regresja 404) | ✅ PASS | `/api/v8/results/dashboard`, `/results/kpis/catalog`, `/finance/lane`, `/process-flow/contract` → **200 z realnymi danymi**. Brak globalnego 404 z 2026-06-08 |
| B3 | RBAC bez auth → 401 | ✅ PASS | curl bez cookie/tokenu: 4/4 endpointy → **401** |
| B4 | Integralność schematu | ✅ PASS | `db:verify:schema:staging` → ✅ 0 drift |
| B5 | Tabele W4 zapytywalne | ✅ PASS | 10/10 OK (Ideas snapshots/activity istnieją → koniec 503; framework_entitlements=120) |
| B6 | Mostek M14→M15 | ✅ PASS | `budget_health` w `KpiSignalTypeValues`; backend wstał (import mostka OK) |
| B7 | Czystość logów BE | ✅ PASS | zero ERROR/unhandled/500/relation-missing podczas testów FE |

## Werdykt
**16 testów: 12 PASS, 1 kod-zweryf. (A4), 2 PASS-z-notą (A3/A7), 1 beta-closed (A8 — oczekiwane).** Zero regresji. Schemat staging w pełni zbieżny, v8 routery żywe, RBAC egzekwowane, dane staging realne (36 inicjatyw).

## Znaleziska
1. **Backend-boot bug naprawiony w trakcie** (`organization-context-store.routes` importował nieistniejące `dbAll`/`dbRun` z `DbPromise` → ESM crash). Pre-existing (W11), blokował boot i uderzyłby w prod. Fix: `670…` (alias `all as dbAll, run as dbRun`).
2. **M14→M15 deep-link prowadzi do modułu beta-closed** — przycisk „Zobacz w Rezultatach" (M14) → `/benefits` → redirect `/chat`, bo `MODULE_BENEFITS:'closed'`. Deep-link strukturalnie poprawny; **decyzja produktowa:** otworzyć Rezultaty (beta) albo ukryć/oznaczyć przycisk dopóki zamknięte, by nie mylił (analogicznie do #6).
3. **A3 billing dla OWNER** → `/admin/billing` (nie user-level `BillingSettings`) — spójne z IA admina; user-level ścieżka żyje dla nie-adminów.

## Faza-4-deep — M01 S5 (share → read-only → revoke) — 2026-06-12 (sesja żywa)
**Werdykt: ✅ PASS po naprawie 2 realnych bugów (oba uderzały też w PROD — ten sam kod, Postgres).**
Przepływ E2E (Chrome, staging): `POST /conversations/:id/share` → **200** · `GET /share/:token` → **200** (wiadomości renderują) · `DELETE share` (revoke) → **200** · ponowny `GET /share/:token` → **410** „Share has been revoked" (×2, stabilnie).

Bugi znalezione i naprawione (`share.routes.ts`, commit `9cd8fd0d2f`):
1. **Publiczny widok 500** — `JSON.parse(m.metadata)` na kolumnie **JSONB** (node-pg zwraca obiekt, nie string). Fix: `parseMaybeJson()` (string→parse / obiekt→passthrough / else undef).
2. **SECURITY: rewokowane share dalej dostępne** — `is_active` jest INTEGER/bigint na PG, node-pg serializuje bigint jako **string** `"0"`, więc `!share.is_active` (`"0"` truthy) nigdy nie odpalał guarda 410. Fix: `flagOn()` (number/string/bool→bool) w widoku, unlock i liście.
**Znaczenie:** oba istnieją na prodzie — przy deployu `Londyn`→prod naprawiają realny wyciek dostępu (rewokowane linki) + crash publicznego widoku. M01 S5: 🟩→**✅**.
