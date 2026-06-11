# M24 — Panel Administratora (org admin) · FAZA 2: Testy

Data: 2026-06-11 · Branch: `feat/deliverables-light` · Agent: TESTY
Log surowy: `Harvard/modules/M24-admin/evidence/f2_tests.log`

Moduł: `AdminSettingsModule` (5 paneli: People/Billing/AI/Security/Audit) + sidebar.
Routy BE: organization-members, security/roles, v8/admin, billing, audit, scim.

---

## 1. INWENTARZ TESTÓW

### FE (vitest) — istotne dla M24

| Plik | Czego dotyczy | # testów |
|---|---|---|
| `src/views/admin/__tests__/AdminSettingsModule.test.tsx` | Routing sekcji shell-a (people/billing/ai/security/audit + aliasy iam→security, compliance→audit, fallback). **Wszystkie panele zamockowane** (data-testid). | 8 |
| `src/components/Admin/__tests__/AdminMembersRolesPanel.test.tsx` | S1: ładowanie członków org, macierz ról (owner/admin/member/guest), zmiana roli przez `Api.updateOrganizationMemberRole`. Api zamockowane. | 3 |
| `src/components/Admin/__tests__/AdminBillingFinOpsPanel.test.tsx` | S2: load summary + plany; assign plan (token/storage/seat/expiry); brak hardcode `pm_demo_4242`. Api zamockowane. | 3 |

Brak FE testów dla: AdminAIControlCenterPanel, AdminSecurityIdentityPanel/SCIM, AdminAuditLogPanel, AdminSecurityPolicyPanel, AdminIamPolicyPanel, AdminScimLifecyclePanel, OwnershipManagementView (transfer własności), kod zaproszenia.

### BE (vitest)

| Plik | Czego dotyczy | # testów |
|---|---|---|
| `server/src/controllers/__tests__/OrganizationController.membership.test.ts` | **S1 RBAC rdzeń**: odmowa non-admin (403 ADMIN_ACCESS_REQUIRED); blok promocji do OWNER przez ADMIN (403 OWNER_ACTION_REQUIRED); ochrona ostatniego ownera (409 LAST_OWNER_PROTECTED); odmowa self-lockout (409 SELF_LOCKOUT_REJECTED); audyt zdarzeń przy zmianie roli i usunięciu. Serwisy zamockowane. | 6 |
| `server/src/routes/security/__tests__/roles.routes.test.ts` | S4-ish: walidacja CRUD ról niestandardowych; **gate capability** `admin.project_roles.manage` (403 PROJECT_ROLES_MANAGE_REQUIRED); walidacja name/roleKey/permissions. | 7 (1 FAIL) |
| `server/src/routes/v8/__tests__/admin.routes.test.ts` | v8 admin diag (flags org-scoped, flags/all superadmin, health/metrics/shadow). **Gate superadmin** (non-superadmin → 403). To NIE jest org-admin S1–S7, lecz pokrewny obszar admin. | 7 |
| `server/src/services/__tests__/effectiveAccessService.test.ts` | Katalog capability / mapowanie legacy / baseline MEMBER vs GUEST. | 6 (3 FAIL) |
| `server/src/services/__tests__/roleNormalization.test.ts` | Normalizacja ról (SUPERADMIN platform-only, aliasy aplikacyjne, role projektowe). | 4 |

Brak BE testów (route nie importowany w żadnym `*.test.ts`) dla:
`billing/billing.routes.ts`, `billing/billingAdmin.routes.ts` (7 endpointów S2), `auditLog.routes.ts` / `audit.routes.ts` (S5 + CSV export), `integrations/scim.routes.ts` (S4 SCIM), `adminData.routes.ts`, transfer własności, kod zaproszenia.

### E2E (Playwright) — SMOKE WYŁĄCZNIE / FAŁSZYWA ZIELEŃ

| Plik | Co „testuje" |
|---|---|
| `tests/e2e/admin/admin-console.spec.ts` | 6× `page.goto('/admin/...')` + `expect(url).toBeTruthy()` — nic nie weryfikuje. |
| `tests/e2e/billing/billing-management.spec.ts` | 7× goto + url truthy. |
| `tests/e2e/security/security-settings.spec.ts` | 7× goto + url truthy (security/audit/export). |

Te 3 pliki to **fałszywa zieleń** — bez logowania/roli, bez asercji zachowania, bez serwera mogą przejść. Zero wartości RBAC/funkcjonalnej.

---

## 2. URUCHOMIENIE — WYNIKI

```
FE vitest (3 pliki):  14 PASS / 0 FAIL / 0 SKIP  — 1,33 s
BE vitest (5 plików): 26 PASS / 4 FAIL / 0 SKIP  — 2,22 s
──────────────────────────────────────────────────────────
RAZEM:                40 PASS / 4 FAIL / 0 SKIP
```

E2E: nieuruchamiane (smoke-only, wymagają stacku; nie są PR-gate dla M24 — patrz §3).

### Root-cause 4 FAIL — STALE TEST / API-DRIFT (NIE regresja produktu)

**A. `effectiveAccessService.test.ts` — 3 FAIL.** Test importuje symbole, których serwis już **nie eksportuje** (`undefined`/„not a function"):
- `WORKFLOW_CAPABILITIES` → `TypeError: Cannot read properties of undefined`
- `mapLegacyPermissionObjectToCapabilities` → `is not a function`
- `LEGACY_PERMISSION_CAPABILITY_MAP`, `FACTORY_ROLE_TEMPLATES` — usunięte z eksportów.
- Szablon `PROJECT_LEADER` przemianował capabilities (`initiative.create/update/promote` → `initiative.submit/review/.../complete`).
Eksporty serwisu obecnie: `CANVAS_MEMBER_CAPABILITIES`, `hasEffectiveCapability`, `mapLegacyPermissionToCapability`, `resolveEffectiveAccess`, typy. → Test nieaktualizowany po refaktorze katalogu uprawnień. **Backlog: zaktualizować lub usunąć martwe asercje.**

**B. `roles.routes.test.ts` — 1 FAIL** („accepts POST with label + capabilities alias"). Handler POST `/api/security/roles` czyta `req.body?.name` i zwraca **400 „Role name is required"**, gdy brak. Test wysyła `{ label, capabilities }` zakładając alias `label`→`name`, którego route **nie obsługuje** (obsługuje tylko `name` + alias `capabilities`→`permissions`). Spec-drift testu (alias `label` nigdy nie wdrożony / wycofany). **Backlog: albo dodać alias `label` w route, albo poprawić test na `name`.**

Pozostałe pułapki sprawdzone i NIEobecne: brak mock-drift i18next w tych plikach; brak braku Routera (AdminSettingsModule używa `MemoryRouter`); brak schema-drift PG (testy hermetyczne, DB zamockowane — nie odpalały migracji); brak roli „iris"; FE „zieleń" jest realna (mock Api + asercje wywołań), nie fetch-bez-serwera.

---

## 3. MAPA POKRYCIA S1–S7

PR-gate: `test-suite.yml` odpala się tylko na `push`/`PR` do **main / develop**. Default branch = **Londyn**, prace na `feat/deliverables-light` → **żaden z tych testów nie jest PR-gate** w bieżącym workflow (uruchamiane lokalnie/ad-hoc). E2E admin/billing/security nie figurują w `test:e2e:tier0` ani smoke gate.

| Zakres | FE | BE | E2E | PR-gate |
|---|---|---|---|---|
| **S1 Team & Access** (CRUD członków, role, ochrona OWNER+self) | ✅ panel + zmiana roli (mock) | ✅ **mocny RBAC** (non-admin, owner-promo, last-owner, self-lockout, audyt) | ⚠️ smoke-fake | ❌ |
| **S2 Billing** (7 endpointów) | 🟡 1 panel: load+assign plan (mock); brak invoices/PM/tax/alerts asercji | ❌ brak (billing.routes / billingAdmin.routes nieobjęte) | ⚠️ smoke-fake | ❌ |
| **S3 AI Controls** (governance + 9 pod-zakładek) | ❌ panel zamockowany w shell-teście, brak własnego testu | ⚠️ pośrednio v8/admin flags (superadmin), nie org-admin governance | ❌ | ❌ |
| **S4 Security & Identity** (6 zakładek, SCIM) | ❌ panele bez testów | 🟡 roles.routes (capability gate) + roleNormalization; **SCIM = 0** | ⚠️ smoke-fake | ❌ |
| **S5 Audit Log** (zdarzenia + CSV export) | ❌ AdminAuditLogPanel bez testu | 🟡 emisja audytu zweryfikowana w membership; **odczyt listy + CSV export = 0** | ⚠️ smoke-fake (export goto only) | ❌ |
| **S6 Transfer własności** | ❌ OwnershipManagementView zamockowany/bez testu | 🟡 częściowo: last-owner protected + owner-promo block; **sam transfer = 0** | ❌ | ❌ |
| **S7 Kod zaproszenia** | ❌ | ❌ (addMember pokryty od strony RBAC, ale kod/link zaproszenia = 0) | ❌ | ❌ |

Legenda: ✅ realne · 🟡 częściowe · ⚠️ fałszywa zieleń · ❌ brak.

---

## 4. PUŁAPKI / OCENA WIARYGODNOŚCI

- **Mock serwisu wszędzie.** Wszystkie zielone testy (FE + BE) mockują warstwę API/serwis/DB. To kontrakty/walidacje, **nie** integracja z realną DB. Żaden test nie dotyka realnego Postgresa (brak schema-drift, ale i brak gwarancji org-scope na poziomie SQL).
- **RBAC / privilege-escalation — TESTOWANE, ale wąsko.** `OrganizationController.membership.test.ts` realnie weryfikuje: non-admin nie dodaje członków, ADMIN nie promuje do OWNER (anty-eskalacja), ochrona ostatniego ownera, anty-self-lockout, audyt sensytywnych akcji. `admin.routes.test.ts` weryfikuje gate SUPERADMIN. `roles.routes` weryfikuje gate capability.
- **Org-scope (org A vs org B) — NIE testowany.** Brak jakiegokolwiek testu „admin org A nie zarządza zasobami org B" (cross-org IDOR — znany systemowy temat z MEMORY). Wszystkie testy używają jednej org (`org-1`/`org-admin-v8`). To największa luka bezpieczeństwa w pokryciu.
- **Eskalacja ADMIN→SUPERADMIN:** częściowo — `admin.routes` blokuje non-superadmin od diagnostyki; `roleNormalization` trzyma SUPERADMIN jako platform-only. Ale **brak testu**, że org-admin nie potrafi nadać sobie/komuś SUPERADMIN przez membership/roles.
- **Fałszywa zieleń:** 3 pliki E2E (20 „testów") = goto + url-truthy. Liczą się jako „przechodzące", nie dowodzą niczego.
- **Flaga Stripe OFF:** billing panel testuje tryb manual-billing (assign plan/limity) — zgodne z self-serve OFF; brak testu ścieżki Stripe ON/OFF rozgałęzienia (`billingSelfServeFlag` ma osobny util-test poza M24).

---

## 5. BACKLOG TESTÓW (priorytety)

| # | Typ | Plik (proponowany) | Scenariusz | Prio |
|---|---|---|---|---|
| B1 | **RBAC / cross-org IDOR** | `server/src/controllers/__tests__/OrganizationController.orgScope.test.ts` | Admin org A wykonuje getMembers/updateRole/removeMember na `orgId` org B → 403/404, nigdy 200. Dla każdego endpointu members + billing + audit. | **P0** |
| B2 | **Privilege-escalation** | rozszerzyć `OrganizationController.membership.test.ts` + `roles.routes.test.ts` | (a) ADMIN/OWNER nie nadaje roli `SUPERADMIN` przez updateMemberRole; (b) custom-role nie zawiera capability `*`/superadmin; (c) nie da się przyznać capability wykraczających poza własne. | **P0** |
| B3 | naprawa stale | `effectiveAccessService.test.ts` | Zaktualizować importy/asercje do aktualnych eksportów (lub usunąć 3 martwe testy). Obecnie czerwone = szum. | P1 |
| B4 | naprawa stale | `roles.routes.test.ts` | Zdecydować: dodać alias `label`→`name` w route albo poprawić test na `name`. | P1 |
| B5 | BE coverage | `server/src/routes/billing/__tests__/billingAdmin.routes.test.ts` | 7 endpointów S2 (summary/PM/invoices/alerts/tax/usage/assign-plan): auth + org-scope + walidacja payloadu + flaga Stripe OFF. | P1 |
| B6 | BE coverage | `server/src/routes/__tests__/auditLog.routes.test.ts` | S5: lista zdarzeń (filtry, paginacja, org-scope) + **CSV export** (nagłówki, escaping, tylko własna org). | P1 |
| B7 | BE coverage | `server/src/routes/integrations/__tests__/scim.routes.test.ts` | S4 SCIM: provisioning/deprovisioning, token auth, org-scope. | P2 |
| B8 | FE coverage | `AdminSecurityIdentityPanel.test.tsx`, `AdminAuditLogPanel.test.tsx`, `AdminAIControlCenterPanel.test.tsx` | render 6 zakładek security, render audit + akcja export, render governance + 9 pod-zakładek. | P2 |
| B9 | FE/BE coverage | `OwnershipManagementView` / transfer-ownership route | S6: pełny transfer własności (potwierdzenie, stary owner→admin, nowy→owner, audyt). | P2 |
| B10 | coverage | invite-code | S7: generowanie/rotacja/wygaszanie kodu zaproszenia + dołączanie przez kod. | P2 |
| B11 | jakość | usunąć/zastąpić 3 E2E smoke-fake | Zamienić goto+url-truthy na realne logowanie roli + asercja widoczności/odmowy paneli (RBAC-by-role). | P2 |

---

## PODSUMOWANIE

- **40 PASS / 4 FAIL / 0 SKIP.** 4 FAIL = wyłącznie **stale test / API-drift** (effectiveAccessService usunął eksporty; roles.routes nie ma aliasu `label`) — **nie** regresja produktu.
- **RBAC: tak, testowane** (anty-eskalacja ADMIN→OWNER, ostatni owner, self-lockout, gate superadmin/capability, audyt) — to najmocniejsza część.
- **Org-scope (cross-org): NIE testowany nigdzie** — krytyczna luka (zgodna z systemowym cross-org IDOR z pamięci). P0.
- Billing S2 ledwie 1 panel; Audit-export, SCIM, transfer własności, kod zaproszenia, AI governance = **0 pokrycia**. E2E admin/billing/security = fałszywa zieleń. Żaden test M24 nie jest PR-gate (gate tylko main/develop; branch = Londyn).
