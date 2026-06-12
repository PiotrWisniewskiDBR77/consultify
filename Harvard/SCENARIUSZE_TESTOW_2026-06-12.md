# Scenariusze testowe — full-stack na staging (2026-06-12)

**Stack:** frontend `http://127.0.0.1:3000` → backend `http://127.0.0.1:3001` → **staging Postgres** (schemat zweryfikowany ✅, `DB_MANAGED_SCHEMA=off`).
**Podział ról:** Piotr loguje się w Chrome (wpisanie hasła). Claude wykonuje testy FE (Chrome MCP: DOM/konsola/JS) + BE (API z tokenem sesji + zapytania DB read-only).
**Zasada:** każdy scenariusz = kroki + oczekiwane + dowód. Bez akcji nieodwracalnych/wysyłkowych bez potwierdzenia.

---

## A. FRONT-END (Chrome MCP, po zalogowaniu)

### A1. Logowanie + shell (smoke krytyczny)
- Kroki: po logowaniu sprawdź, że ładuje się główny widok (czat/dashboard), sidebar renderuje moduły, zero błędów w konsoli.
- Oczekiwane: brak `error`/`uncaught` w konsoli; sidebar ma pozycje (Czat, Moja Praca, Wywiad, Inicjatywy, Rezultaty…); brak „Ecosystem Impact".
- Dowód: console errors (puste), lista pozycji sidebara.

### A2. Decyzja #1 — Affiliate usunięty
- Kroki: nawiguj `/affiliate`.
- Oczekiwane: redirect do `/chat` (NIE render dashboardu „Ecosystem Impact", NIE „Section not found").
- Dowód: `location.pathname` po nawigacji.

### A3. Decyzja #3 — Billing wpięty
- Kroki: nawiguj `/settings/billing`.
- Oczekiwane: renderuje się sekcja „Subscription & Billing" (BillingCore: plan/faktury/licencja), NIE „Section not found"; w sidebarze Ustawień jest grupa „Billing".
- Dowód: nagłówek sekcji + obecność treści billingowej.

### A4. Decyzja #6 — M20 governed sync zneutralizowany
- Kroki: otwórz tabelę w Moja Praca → panel „Połącz z Consultify" (ConsultifyLinkPanel) → rozwiń moduł docelowy.
- Oczekiwane: przycisk syncu jest disabled „Wkrótce / Coming soon" + podpis; mapowanie pól dostępne; ZERO toastu „Synchronizacja zakończona".
- Dowód: stan przycisku (disabled, label).

### A5. Core flow — Czat
- Kroki: otwórz Czat, wyślij prostą wiadomość.
- Oczekiwane: odpowiedź asystenta przychodzi (stream), brak 500/404 w network; konwersacja zapisana.
- Dowód: network 200 dla endpointu chat, treść odpowiedzi.

### A6. Core flow — Wywiad (Ideas/snapshots — W4 fix)
- Kroki: otwórz Wywiad (lista), wejdź w sesję/insighty; w Moja Praca otwórz narzędzie Ideas (Mind Map/Process Flow) i zapisz.
- Oczekiwane: brak białego ekranu; zapis mapy NIE zwraca 503 (tabele `my_idea_map_snapshots`/`my_idea_activity` istnieją na staging).
- Dowód: network status zapisu (200), render listy.

### A7. Core flow — Inicjatywy + M14→M15 deep-link
- Kroki: otwórz Inicjatywy (lista renderuje); w Wdrożeniu otwórz panel budżetu inicjatywy → kliknij „Zobacz w Rezultatach".
- Oczekiwane: lista inicjatyw OK; deep-link prowadzi do `/benefits?initiativeId=…`.
- Dowód: `location` po kliknięciu.

### A8. Rezultaty / Finanse render
- Kroki: otwórz Rezultaty i Finanse.
- Oczekiwane: render bez crasha; degraded-banner zamiast pustki gdy brak danych.
- Dowód: snapshot treści.

---

## B. BACK-END (API z tokenem + DB read-only)

### B1. Health (✅ wykonane)
- `GET /api/health` → `status:ok, database:connected, redis:connected`. **PASS** (potwierdzone).

### B2. V8 feature routery (regresja z 2026-06-08 = 404)
- Kroki: `GET` kilka `/api/v8/...` (np. results, finance lane, process-flow contract) z nagłówkiem auth.
- Oczekiwane: 200/401/403 (router ZAMONTOWANY), NIE 404 „Cannot GET".
- Dowód: kody statusów per endpoint.

### B3. Autoryzacja / RBAC (W1/W2/W3)
- Kroki: wywołaj endpoint mutujący bez tokenu i z tokenem; sprawdź cross-org (jeśli bezpiecznie) — oczekiwane 401/403 bez tokenu.
- Oczekiwane: brak tokenu → 401; rola niewystarczająca → 403; `x-kpi-role` ignorowany (W3).
- Dowód: statusy.

### B4. Integralność schematu staging (Faza 3)
- Kroki: `npm run db:verify:schema:staging`.
- Oczekiwane: `✅ Schema matches migrations`. **PASS** (potwierdzone, drift 0).
- Dowód: wynik narzędzia.

### B5. Kluczowe tabele W4 obecne + zapytywalne
- Kroki: read-only `SELECT` na `my_idea_map_snapshots`, `v8_kpi_signals`, `v8_process_flow_nodes`, partner cert, change_comms.
- Oczekiwane: zapytania nie rzucają „relation does not exist".
- Dowód: count/ok per tabela.

### B6. M14→M15 mostek (kontrakt sygnału)
- Kroki: sprawdź `KpiSignalTypeValues` zawiera `budget_health`; (opcjonalnie) prześledź, że `createBudgetEntry(ACTUAL)` woła `fireBudgetHealthExport`.
- Oczekiwane: typ sygnału obecny; brak błędu importu mostka.
- Dowód: kod + brak crasha BE (już potwierdzone bootem).

### B7. Logi backendu — czystość
- Kroki: przejrzyj `/tmp/be.log` pod kątem `ERROR`/`unhandled` podczas testów FE.
- Oczekiwane: brak nieobsłużonych wyjątków/500 podczas happy-path.
- Dowód: grep logu.

---

## C. Kolejność wykonania
1. Piotr: zaloguj się w Chrome (otwarte na `127.0.0.1:3000`).
2. Claude: A1 smoke → A2–A4 (decyzje) → A5–A8 (core) → B2–B7 (API/DB).
3. Wynik: tabela PASS/FAIL + dowody → wpis do `WDROZENIE_LOG` odpowiednich modułów (to jest realny start Fazy 4).

> Uwaga: to staging — testy klikalne dozwolone. Akcje wysyłkowe (e-mail/share/publish) tylko do potwierdzenia, nie odpalać masowo.
