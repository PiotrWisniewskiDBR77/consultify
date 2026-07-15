# HARVARD 5 — Fala 2 platform (M25 Ustawienia · M26 Portal · M27 SuperAdmin · A1)
**Fala:** 3 (rebalans 2026-06-17) | **Branch:** Londyn

Cześć. Jesteś **Harvard 5**. Bierzesz warstwę platformową z Fali 2. **Teczki NIEZREKONCYLIOWANE** — najpierw audyt na żywym kodzie (gap-reports zawyżają), potem naprawy. **M27 wymaga konta superadmin do pełnej weryfikacji — gdy zabraknie dostępu, oznacz 🟦 i dokumentuj.** Pełna pula tokenów — fan-out na sub-agenty.

## NAJPIERW PRZECZYTAJ
1. `Harvard/wdrozenie-100/_KONTYNUACJA.md` (§7, §9)
2. `Harvard/protokol/MODULE_AUDIT_PROTOCOL_V1.md`
3. Teczki: `M25-ustawienia.md`, `M26-portal-partnerski.md`, `M27-superadmin.md`, `A1-affiliate.md` (§03, descoped 07-15)

## ZAKRES — zweryfikuj KAŻDĄ lukę w kodzie przed pracą

### M25 — Ustawienia  (`server/src/routes/settings.routes.ts`, `src/components/settings/`, `gdprService.ts`)
- L-02 **P1**: bezhasłowy duplikat usuwania konta — `settings.routes.ts:2634`, `gdprService.ts:175`
- L-03 pilot gating tylko FE — `pilotAccess.ts:14`, `SettingsView.tsx:261-265`
- L-04 **P1**: billing „Section not found" — `routeConfig:149,415` (D-01=DP-11)
- L-05 **P1**: Keyboard Shortcuts UI bez dispatchera (no-op) — `:523` (D-02)
- L-06 Feature flags read-only (DP-10)
- L-08 martwy kod (`layout/SettingsSidebar.tsx`, `VoiceSettingsPanel.tsx`→M22)
- L-09 ~1650-2237 hardkodów palety + i18n inline 53 — palety = DP-8 (legalne); i18n → Harvard 2
- L-10 **P0-test**: S3 (hasło) + S5 (GDPR bcrypt na właściwej trasie); mock-drift ~34+14 FAIL
- L-01/L-07 = **NAPRAWIONE** (`b9f2dee9d2`, `9ef570c…`) → zweryfikuj, flip ZAMKNIĘTA

### M26 — Portal Partnerski  (`server/src/routes/partners.routes.ts`, `PartnerPortalView.tsx`)
- L-01 silent earnings fallback (commissionRate:15) — `partners.routes.ts:966-977`
- L-02/L-03/L-04 **testy**: E2E connect→dashboard (S1), payout lifecycle (S3), legacy fallback
- L-05 §27 (4 `<table>`) — `PartnerPortalView.tsx`
- L-06 resource download bez partner-org scope — `:2120-2126`
- L-07 duplikat API legacy vs v8 earnings (deprecation)
- L-08 **P1 env**: schema drift prod (5 migracji partner) — udokumentuj, NIE migruj prod sam
- L-09 `PARTNER_SELF_CONNECT_ENABLED` (D-02), L-10 5+ stubów Client Mgmt (D-01, rekom DP-5)

### M27 — SuperAdmin  (`server/src/routes/llm.routes.ts`, `virtual-workers.routes.ts`, `views/superadmin/`, `feedback.routes.ts`)
- L-03 **P1 sec**: llm purposes global writes (verifyAdmin→superadmin) — `POST /llm/purposes`, `/purposes/:purpose/assignments`, `PUT /llm/org/:id/policy`
- L-04 **P1 sec**: llm market global writes (verifyToken→stronger)
- L-05 martwy `AIPlatformModule.tsx` (152 l., 0 importów) + orphan `IAMModuleView`
- L-06 i18n ~114/124 plików (DP-10) → Harvard 2
- L-07 70 hex (DP-8 legalne)
- L-08 **P0-test**: brak E2E non-superadmin→403; asercje `[401,403,404]` maskują
- L-11 testy maskowane (mock-gate/mock-DB) + brak `<Router>`
- L-01/L-02 = STALE (`verifySuperAdmin`/`requireRole('super_admin')`) → potwierdź, flip
- L-09/L-10 = NAPRAWIONE (`36ceb52c60`) → live-verify po deploy, flip

### A1 — Affiliate (descoped 07-15)
- Teczka `A1-affiliate.md`: stub/descoped. Potwierdź status, udokumentuj decyzję (wejście do v1?).

## GRANICA (anty-kolizja)
- NIE ruszaj `server/src/middleware/` poza testami. i18n (M25 L-09, M27 L-06) → klucze do Harvard 2, sam nie edytuj `public/locales/*`.
- Sekrety/klucze (Railway) — NIGDY nie wpisujesz; zgłaszasz Piotrowi.
- Schema drift prod (M26 L-08) — tylko dokumentacja + instrukcja; migracja prod = osobna zgoda Piotra.

## FAN-OUT
Sub-agent per luka: faza 1 = „żywa czy STALE?" (cytat plik:linia), faza 2 (żywe) = napraw+test. Priorytet: **P0/P1 sec i P0-test** (M27 L-03/L-04/L-08, M25 L-02/L-10, M26 L-01). Ty scalasz, **commitujesz sekwencyjnie**, aktualizujesz teczki.

## GIT
`git fetch origin Londyn` przed commitem; **NIGDY `git add -A`**; testy w `/tests/` → `git add -f`; commit `fix(M27/L-03): superadmin gate llm purposes`.

## DONE
- [ ] P0/P1 sec (M27 llm/market gates, M25 account-delete) naprawione + test regresji
- [ ] P0-testy (M27 403, M25 GDPR, M26 E2E) realnie zielone w `tests/`
- [ ] Każda luka ma werdykt (ZAMKNIĘTA/NIEAKTUALNA/ODROCZONA/🟦); M27 braki dostępu oznaczone 🟦
- [ ] 0 nowych błędów `tsc`; raport + teczki (SHA)

Prod (centerbeam) tylko za osobną zgodą. Staging najpierw. UI → preview+screenshot.
