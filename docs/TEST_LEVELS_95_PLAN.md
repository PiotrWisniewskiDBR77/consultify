# Plan dojścia do 95% (L1–L5) i “GO deploy”

Stan na: **2026-02-22**

## Snapshot (prawda bez placebo)

- `npm run test:quality-check`: **REAL 947 / PLACEHOLDER 0 / OTHER 44** (AUTHENTICITY 100%)
- L1/L2/L3: coverage gates **OK** (per-file 95% lines / 80% branches / 95% statements / 95% functions)
- L4: smoke (Playwright, webServer) **OK** lokalnie (`npm run test:l4:local` PASS); tryb remote/CI wymaga `E2E_API_URL` + `E2E_BASE_URL` (`npm run test:l4`)
- L5: quality + integrity + security + performance **OK** (`npm run test:l5` PASS)

## Zasady (żeby system nie “oszukiwał”)

- Każdy nowy test ma dotykać realnego kodu (runtime/DB/komponent) albo testować sensowny błąd/edge-case.
- Zakaz placeholderów (np. `expect(true).toBe(true)`, puste testy, “fs.readFileSync source scanning” jako substytut runtime).
- Każdy poziom ma mieć własne **gates** i listę “krytycznych plików” (jawnie w repo).

## L1 (backend — security boundary)

- [x] Utrzymać per-file 95/80/95/95 na krytycznych middleware/services.
- [ ] Rozszerzyć listę plików krytycznych (np. nowe middleware/guardy) i dopisać testy do progów.
- [ ] Dodać “regresyjne” testy dla znanych incidentów (jeden incident = jeden test).

## L2 (frontend — auth/navigation)

- [x] Utrzymać per-file 95/80/95/95 na krytycznych widokach i Sidebar.
- [ ] Dodać gates dla kolejnych krytycznych ekranów (np. tworzenie/edycja kluczowych encji).
- [ ] Dodać testy na “role/permissions rendering” (UI ma nie pokazywać niedozwolonych akcji).

## L3 (integration/API)

- [x] Gate L3 sprawdza realnie wszystkie pliki z profilu L3 (bez “ucięcia” w skrypcie progów).
- [ ] Poszerzyć profil L3 o kolejne krytyczne route’y (po 2–3 pliki na iterację) i dowieźć 95/80/95/95.
- [ ] Dodać testy “fault-injection” (kontrolowane błędy DB/timeout) tylko tam, gdzie to ma sens dla bezpieczeństwa i SLO.

## L4 (E2E smoke — merge/deploy gate)

- [x] Smoke ma własny webServer (backend+frontend) i nie zależy od ręcznych seedów.
- [ ] Dodać 1–2 testy “public-domain blockers” (np. health/ready, logowanie, kluczowy ekran).
- [ ] Ustalić kontrakt: L4 ma być szybkie (< 2–3 min) i zero flake (retries max 1, stabilne seedy).

## L5 (security + performance)

- [x] `npm audit gate` + integrity + security tests + perf tests przechodzą (gate = allowlistowany „hybrydowo”, patrz `scripts/security/npm-audit-allowlist.json` + `docs/security/npm-audit-remediation.md`).
- [ ] Rozszerzyć security suite o “top 10” (XSS/CSRF/authz/SSRF/upload) w miarę zmian w kodzie.
- [ ] Ustawić budżety wydajności (progi) pod CI (np. limit czasu/operacji) i trzymać regresje.

## “GO deploy” checklist (blokery publicznej domeny)

- [x] Start backend używa poprawnego entrypointa (`dist/src/index.js`).
- [x] Docker backend uruchamia poprawny entrypoint (`dist/src/index.js`).
- [ ] Zweryfikować Railway/hosting (polecenie start, zmienne ENV, migracje) na świeżym środowisku.
