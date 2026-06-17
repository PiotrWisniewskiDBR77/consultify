# Backlog — findingi aplikacji (wykryte przy audycie testów)

> **Co to:** realne defekty **kodu aplikacji** (nie testów), wykryte ubocznie podczas niezależnego audytu specyfikacji testowych 2026-06-16. To są naprawy w `src/`/`server/src/`, NIE w plikach testów. Każdy ma poziom pewności i miejsce do weryfikacji.
> **Powiązane:** [`_AUDYT_ZGODNOSCI.md`](_AUDYT_ZGODNOSCI.md)
> **Data:** 2026-06-16

---

## P1 — Bezpieczeństwo

### F1 [M13] Bramki stanów inicjatyw bez egzekwowania ról na serwerze
- **Co:** dedykowane endpointy przejść (`POST /:id/submit-review|approve|reject|start-execution|block|unblock|complete` w `server/src/routes/pmo/initiatives.routes.ts`) mają tylko `verifyToken` + `requireOrgAccess()`. Kontrolery (`InitiativeController.ts`) **nie wołają `canExecuteGate`**. RBAC (403 wg roli) istnieje WYŁĄCZNIE na `PATCH /:id/status` (`updateInitiativeStatus` ~:1182).
- **Ryzyko:** użytkownik bez uprawnień bramki (np. TEAM_MEMBER/CONSULTANT) może wywołać przejście stanu bezpośrednim requestem — gating jest tylko po stronie klienta.
- **Pewność:** wysoka (potwierdzone w kodzie przez 2 niezależnych agentów). Do empirycznego potwierdzenia: czy dedykowane endpointy zwracają 200 dla nieuprawnionej roli.
- **Fix:** dodać guard roli/bramki (np. `canExecuteGate(role, gateType)`) na trasach przejść lub w kontrolerach.

### F2 [M16] `getModel(modelId, orgId?)` — opcjonalny org-scope
- **Co:** `server/src/services/financialModelingService.ts` (~:1109) — `getModel` z opcjonalnym `orgId`; przy pominięciu robi `WHERE id = ?` BEZ org-scope. Bezpieczeństwo zależy wyłącznie od tego, że każda trasa przekazuje `req.user.organizationId` (obecnie przekazuje, routes ~:174-358).
- **Ryzyko:** każde przyszłe wywołanie bez `orgId` = cross-org IDOR.
- **Pewność:** średnia-wysoka. **Uwaga:** test M16 błędnie przypisał fix IDOR commitowi `e3945bc7fc` (to było `gatewayVerifyToken`, nie org-scope) — realny org-scope jest z innego commitu.
- **Fix:** uczynić `orgId` wymaganym (lub fail-closed gdy brak); dodać test regresji na pominięcie.

---

## P2 — Produkt / spójność danych

### F3 [M23] Goals/Challenges/Strategy nie zasilają Teresy
- **Co:** W11 sync zapisuje cele/wyzwania/strategię do tabeli `organization_context_store` (przez `useOrgContextSync` → `PUT /api/organization-context-store`). Ale `OrganizationContextService` (kontekst dla Teresy) buduje `strategic.goals` z INNEGO źródła (claim rows / `strategic_priorities`). Tabela `organization_context_store` jest czytana TYLKO przez własny GET (hydratacja zustand FE).
- **Skutek:** cele wpisane w `/organization/*` NIE trafiają do AI — Teresa ich nie zna.
- **Pewność:** wysoka (zweryfikowane w kodzie). Koryguje wcześniejszą notatkę „localStorage-only" — sync DO backendu istnieje, brakuje KONSUMPCJI przez AI.
- **Fix:** podłączyć `organization_context_store` do `OrganizationContextService` (lub ujednolicić źródło celów).

### F4 [M22] Martwe przyciski w Research Sessions
- **Co:** przyciski `pause`/`archive` w `ResearchSessionsDock` nie mają backendu (brak `/transition`, brak dedykowanych tras) ani metody klienta (`Api.pauseResearch`/`archiveResearch`). Realny lifecycle to `/approve|start|cancel|resume|retry`.
- **Skutek:** klik = nic.
- **Pewność:** wysoka. **Fix:** ukryć przyciski albo dorobić backend pause/archive.

---

## P3 — Produkt / dług

### F5 [M19] Collaborate STUB nieukryty (DP-5 niewdrożona)
- **Co:** decyzja DP-5 (ukryć zakładkę „Invite by email"/Collaborate za flagą w v1) nie zaimplementowana — zakładka „Collaborate" w `ShareModal.tsx` (~:96) wciąż jest pierwsza i w pełni widoczna, mimo że input/przyciski nie mają handlerów (`value/onChange`/`onClick` brak).
- **Fix:** ukryć zakładkę za flagą zgodnie z DP-5 (albo dorobić handlery).

### F6 [M13] Sprzeczność źródła `canExecuteGate`
- **Co:** `src/types/initiative.ts` ma `canExecuteGate(CONSULTANT, SUBMIT_FOR_REVIEW)` = false, a `GATE_PERMISSIONS[SUBMIT_FOR_REVIEW]` zawiera CONSULTANT; `server/src/constants/initiativeStatuses.ts` daje inny wynik. Dwie warstwy uprawnień rozjeżdżają się.
- **Fix:** ujednolicić jedno źródło prawdy dla uprawnień bramek.

### F7 [M13] Przejścia bez dedykowanego endpointu
- **Co:** `DONE→TRACKING`, `APPROVED→SCHEDULED`, oraz statusy `pending_review`/`promoted`/`scheduled` nie mają dedykowanych endpointów — tylko generyczny `PATCH /:id/status`. Część dokumentowanej maszyny stanów nie ma realnej obsługi.
- **Fix:** decyzja — dorobić endpointy albo zawęzić udokumentowaną maszynę stanów do realnie obsługiwanej.

---

## Dług dokumentacyjny (nie kod aplikacji, ale do sprzątnięcia)

- **`MyWorkHub.tsx:606`** — stale komentarz „BETA_ADMINS_EXEMPT false" (realnie `true`).
- **KARTA_AUDYTU M26** — 11 numerów linii endpointów 503 błędnych (~9 off); źródło, z którego test odziedziczył błąd.
- **`wdrozenie-100/M25-ustawienia.md`** — L-02/L-04 oznaczone „otwarte", realnie naprawione (billing wpięty, GDPR z hasłem).
- **`ai-editor.routes.ts:36`** — stale komentarz „disabled by default until C-S2" (flaga runtime ON).
