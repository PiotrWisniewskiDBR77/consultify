# WP M23 — Organizacja (workspace organizacji) · dokończenie do 100%

**Pula:** internal · **Karta:** `Harvard/modules/M23-organizacja/KARTA_AUDYTU.md` (ocena 52/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** 3×P1
**Faza programu:** FAZA 1 (3×P1 security/fasada) → FAZA 3 (szlif) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Mocny rdzeń wrażliwych danych, dziurawe tory poboczne, fasadowy „kontekst organizacyjny". **REALNE i bezpieczne:** profil firmy (`/organization-profiles/:orgId` — strategia/cele, najwrażliwsze dane — z org-scope `userOrgId!==orgId→403` na `:189,378,622` + role-gate PUT), org-switch (`auth.routes.ts:707` membership-verified), Knowledge Graph, Members (zaproszenia realne), Domains, Branding, baner kontekstu Teresy (Socket.IO). **Naprawione w audycie (Sprinty 1–5):** W11 org-context-store backend Goals/Challenges/Strategy per-org + zasilanie Teresy (commit `d013ab7c4c`) — UWAGA: karta sekcja 1b/1e wciąż opisuje je jako localStorage-only, rozjazd do weryfikacji; W2 `/api/competency` auth + org-data export role-gate + KG orgId fallbacks (commity `fd8707c5b2`/`c7f36d9f3f`/`e3945bc7fc`). **Pozostają 3×P1** (z werdyktu karty, do żywej weryfikacji czy nadal otwarte po W2/W11).

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 1 + 3)
- **[P1 fasada] Goals/Challenges/Strategy localStorage-only** — `useContextBuilderStore.ts:414` (zustand persist `consultify-context-builder`), NIE per-org, NIE backend, NIE zasila Teresy; Goals dodatkowo MOCK-STUB (AI-sugestie hardcoded, `onRefine` no-op). **UWAGA:** re-audit W11 (`d013ab7c4c`) twierdzi że backend persystencji już dodany — najpierw zweryfikować realny stan store/serwisu, nie planować od zera. FAZA 1/3.
- **[P2] Billing/Limits CTA martwe** — „Upgrade"/„View Plans" tylko `trackFunnelEvent` (`OrganizationAdminPanel.tsx:292,474`). FAZA 3: realny checkout albo jawne „zarządzane przez…".
- i18n: `CompetencyCatalog.tsx:51` `isPl`; nieprzetłumaczone `<option>` ról MEMBER/Admin (`OrganizationAdminPanel.tsx:179`). FAZA 4.

### (b) BACKEND / API — **P1 security (FAZA 1)**
- **[P1] `/api/competency/*` bez auth** — mount `Gateway.ts:644` bez `gatewayVerifyToken`, router bez `verifyToken` → niezalogowany `POST/PUT/DELETE categories`, `seed-defaults` (`competency.routes.ts:22-160`). Write/DoS (org-scope kolapsuje do `''`, bez wycieku cross-org). Re-audit (`e3945bc7fc`) wskazuje naprawę — **zweryfikować żywo** (curl bez tokenu → 401). Fix jeśli otwarte: `gatewayVerifyToken` + role-gate.
- **[P1] `/api/organization-data/export*` bez role-gate** — `verifyToken` jest, role-gate NIE (`:210,:348`) → member `POST /export/all` eksfiltruje users/projects/tasks/documents/audit_log/activity_log własnej org (insider over-privilege). Re-audit wskazuje naprawę — **zweryfikować żywo**. Fix jeśli otwarte: `requireRole('admin','owner')`.
- **[P2] route `/organization/*` bez role-gate** — `AppRoutes.tsx:2180` `requireAuth` bez `requiredRole`; redirect `ADMIN_REDIRECTS` tylko przy kliku, nie przy URL → member deep-linkiem do sekcji admin (lokalny `OrganizationAdminPanel`). FAZA 3.
- **[P2] podwójna implementacja admin (drift)** — klik ADMINISTRATION → redirect M24 `/admin/*`, deep-link `/organization/members` → lokalny `OrganizationAdminPanel` (932 l., bez role-gate). FAZA 3: redirect także przy montażu z URL lub `requiredRole` na pod-ścieżkach.
- **[P2/P3]** KG orgId fallback z `x-organization-id`/`query` (`:20-32`); SVG branding stored-XSS; martwy `POST /organization-profiles/:orgId/analyze` (404); approved-domains bez konsumenta. FAZA 3.

### (c) INTEGRACJA / TESTY (FAZA 1 + 4)
- **[P1] `orgContext.middleware.test.ts` 45 SKIP** za `RUN_DB_TESTS=1` — najważniejszy test izolacji multi-tenant nie biegnie bez PG. FAZA 1: odpalać z PG w CI.
- **[P1] 3 FAIL stale** `organizationData.no-stubs.test.ts` (oczekuje `503 FEATURE_UNAVAILABLE` z czasów stuba, route → 200/400). Naprawić.
- **[P1] brak testu** competency-no-auth + export-role + S2 persystencji store. FAZA 1.
- CI: `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate ≈ 0. FAZA 4.

## 3. Kroki realizacji
1. **(FAZA 1)** Żywo zweryfikować 3×P1 po W2/W11 (curl competency bez tokenu, export jako member, store persystencja). Domknąć to, co nadal otwarte: auth+role competency, role-gate export, backend Goals/Challenges/Strategy per-org + zasilanie Teresy.
2. **(FAZA 1)** Naprawić 3 stale FAIL; włączyć `orgContext.middleware.test.ts` z PG; testy competency-auth/export-role/store.
3. **(FAZA 3)** Role-gate na `/organization/*` lub redirect przy URL (koniec driftu admin); Billing CTA realne lub jawny komunikat; Goals AI realne.
4. **(FAZA 3)** Sanityzacja SVG branding, wytnij martwy `analyze`, usuń KG orgId-fallback.
5. **(FAZA 4)** §27 (członkowie/competencies/domains); i18n `t()`; trigger CI `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** Goals/Challenges/Strategy persystowane backendowo per-org i widoczne dla Teresy; Billing CTA żywe lub jawnie opisane; zero martwych CTA.
2. **Bezpieczeństwo:** competency auth+role (401/403); export role-gate (member→403); route admin role-gate/redirect; testy regresji.
3. **i18n:** `t()` zamiast `isPl`, przetłumaczone opcje ról.
4. **Tokeny:** Visual Standard.
5. **§27:** członkowie/competencies/domains przez FilterableTable.
6. **E2E w PR-gate:** competency-auth + export-role + multi-tenant isolation zielone na `Londyn`.

## 5. Weryfikacja
- competency: curl bez tokenu → 401; member → 403 na write.
- export: member `POST /export/all` → 403.
- Goals/Strategy: dane przeżywają zmianę przeglądarki/org; Teresa je widzi.
- deep-link member `/organization/members` → redirect/403.
- Uwaga DB: dev `.env` może wskazywać Railway PROD — testy bezpieczeństwa OSTROŻNIE (read-only).

## 6. Zależności
- WYJŚCIE → kontekst Teresy (profil działa; Goals/Strategy po W11/naprawie); → M24 Admin (drift redirect — koordynować z WP M24).
- Niezależne od kręgosłupa (Faza 0).
- Ryzyko jednym zdaniem: karta opisuje 3×P1 jako żywe, ale re-audit Sprintów 1–5 (W2/W11, commity `e3945bc7fc`/`d013ab7c4c`) twierdzi że competency-auth, export-role i Goals-backend już naprawione — bez żywej weryfikacji grozi to ponownym budowaniem już istniejących fixów.
