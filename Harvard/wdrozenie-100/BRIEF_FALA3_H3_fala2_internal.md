# HARVARD 3 — Fala 2 internal (M22 AI OS · M23 Organizacja · M24 Admin)
**Fala:** 3 (rebalans 2026-06-17) | **Branch:** Londyn

Cześć. Jesteś **Harvard 3**. Bierzesz trzy moduły wewnętrzne z Fali 2. **Uwaga: te teczki są NIEZREKONCYLIOWANE** — statusy luk to surowy stan z audytu kart, a wiele z nich jest już naprawione w kodzie (gap-reports zawyżają ~1 na 7). **Twoje pierwsze zadanie = audyt na żywym kodzie, dopiero potem naprawy.** Pełna pula tokenów — fan-out na sub-agenty (1 per luka).

## NAJPIERW PRZECZYTAJ
1. `Harvard/wdrozenie-100/_KONTYNUACJA.md` (§7 zasady, §9 metoda audytu)
2. `Harvard/protokol/MODULE_AUDIT_PROTOCOL_V1.md` — 8-fazowy protokół /100
3. Teczki: `M22-ai-os.md`, `M23-organizacja.md`, `M24-admin.md` (§03 rejestr luk)

## ZAKRES — rejestr luk (zweryfikuj KAŻDĄ w kodzie przed pracą)

### M22 — AI OS  (`src/components/AIChat/Wave5-9*.tsx`, `Wave5ArtifactRuntimePanel.tsx`, `server/.../artifacts.routes.ts`, `Gateway.ts`)
- L-01 Artifacts panel widoczny przy 404 (V8 off) — `Wave5ArtifactRuntimePanel.tsx` + `artifacts.routes.ts:38-40`
- L-04 **P0-test**: brak testu middleware security — `internalTools.middleware.ts:72-76`
- L-05 OAuth Wave 7 symulowany (D-02) — `wave7-connectors.routes.ts:80-113`
- L-06 i18n 5/9 plików (DP-10) → oddaj kluczowe stringi **Harvard 2**, nie edytuj locales
- L-07 §27 (1 `<table>`+divs) — `AIOSWave0GateReport.tsx`
- L-08 **P1-test**: brak route-integration Wave 6–9 + unit Wave 6
- L-02/L-03/L-09 = **STALE** (zweryfikowane) → potwierdź i flip na `NIEAKTUALNA`

### M23 — Organizacja  (`src/components/Organization/`, `server/src/routes/organization-*.routes.ts`, `competency.routes.ts`)
- L-01 Goals/Challenges/Strategy fasada localStorage → per-org backend — `organization-context-store.routes.ts:15,64`
- L-04 route `/organization/*` bez role-gate (deep-link member→admin) — `AppRoutes.tsx:2180`
- L-05 Billing/Limits CTA martwe (DP-11) — `OrganizationAdminPanel.tsx:292,474`
- L-06 i18n → Harvard 2
- L-07 **test**: competency-auth/export-role/store-persist (3 FAIL stale, 45 SKIP)
- L-08 §27 (2 `<table>`)
- L-09 SVG branding stored-XSS + martwy `analyze` 404 + KG orgId fallback
- L-02/L-03 = **STALE** (już `verifyToken+requireRole`) → potwierdź, flip

### M24 — Admin  (`server/src/routes/admin-data.routes.ts`, `ai-settings.routes.ts`, `organizations.routes.ts`, `adminAuditService.ts`)
- L-03 **P0-test**: cross-org IDOR + escalation (zabezpiecza naprawione P0) — brak `tests/…cross-org`
- L-04 audit-logs globalny SELECT cap 1000 — `adminAuditService.ts:71`
- L-05 §27 (10 `<table>`)
- L-06 i18n hardkod EN → Harvard 2 (wzór: BillingFinOps 24× `t()`)
- L-07 members bez route-level role mw; PCI surowy `cardNumber`; martwy `/debug-memberships`
- L-08 martwy kod FE (`layout/AdminSidebar.tsx`, 0 importerów) (D-02)
- L-09 CI nie obejmuje `Londyn`; E2E admin smoke-fake — `test-suite.yml`
- L-01/L-02 = **STALE** (router-level `requireRole`+org-scope) → potwierdź, flip

## GRANICA (anty-kolizja)
- M22 UI = `AIChat/Wave5-9*.tsx` + `artifacts.routes.ts` → **TWOJE**. Harvard 1 ma resztę `AIChat/` (chat-controller) — nie wchodź w `UnifiedChatPanel`/`WorkCanvasDocumentPanel`.
- NIE ruszaj `server/src/middleware/` (wspólny auth) poza pisaniem testów.
- i18n (L-06 ×3) → przekaż klucze Harvard 2, sam nie edytuj `public/locales/*`.

## FAN-OUT
Sub-agent per luka (Agent tool): faza 1 = „zweryfikuj czy luka żywa w kodzie (cytat plik:linia)"; faza 2 (tylko żywe) = napraw + test. Sub-agent zwraca werdykt+diff. Ty scalasz, **commitujesz sekwencyjnie**, aktualizujesz teczki (żywe→ZAMKNIĘTA, martwe→NIEAKTUALNA/STALE z dowodem).

## GIT
`git fetch origin Londyn` przed commitem; **NIGDY `git add -A`**; testy w `/tests/` → `git add -f`; commit `fix(M24/L-03): cross-org IDOR test` / `docs(M22/L-02): STALE — flip NIEAKTUALNA`.

## DONE
- [ ] Każda luka M22/M23/M24 ma werdykt: ZAMKNIĘTA / NIEAKTUALNA / ODROCZONA (z dowodem plik:linia)
- [ ] P0-test (M24 L-03, M22 L-04) realnie zielone w `tests/`
- [ ] Security fixy (M23 L-01 backend, L-04 role-gate) z testem regresji
- [ ] 0 nowych błędów `tsc`; raport + zaktualizowane teczki (SHA)

Prod (centerbeam) tylko za osobną zgodą. Staging najpierw. UI → preview+screenshot.
