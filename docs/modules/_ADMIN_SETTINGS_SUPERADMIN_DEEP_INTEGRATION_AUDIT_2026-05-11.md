---
audit_id: ADMIN_SETTINGS_SUPERADMIN_DEEP_INTEGRATION_AUDIT_2026-05-11
role: Cross-Boundary Integrator
scope_anchor: 17_18_ADMIN_SETTINGS_BOUNDARY/INTEGRATION_AUDIT
mode: docs-only
status: completed_owner_decision_locked
verdict: APPROVED_FOR_DOCS
last_updated: 2026-05-11
---

# Deep Integration Audit — Admin / Settings / SuperAdmin

## 0. Scope lock i metoda

Ten audit domyka granice odpowiedzialnosci i uprawnien miedzy:
- `17_panel-administratora`
- `18_ustawienia`
- `superadmin` (warstwa runtime + produktowa)

Audit jest `docs-only` (bez runtime edits).

### Evidence baseline (mandatory sources)

- `docs/modules/17_panel-administratora/**`
- `docs/modules/18_ustawienia/**`
- `docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
- `docs/product/SUPERADMIN_V8_SSOT.md`
- `docs/product/USER_AND_ADMIN_MEMORY_CONTROLS_V8.md`
- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/views/admin/AdminView.tsx`
- `src/views/SettingsView.tsx`
- `src/views/superadmin/SuperAdminView.tsx`

Dodatkowo potwierdzono guard runtime w `src/components/ProtectedRoute.tsx` (kluczowy dla P0 granicy rol).

---

## 1) Runtime ownership map

Mapa: `route -> owner module -> role boundary -> mutation boundary`.

| Route / runtime family | Owner module | Role boundary (runtime) | Mutation boundary (contract) | Evidence |
| --- | --- | --- | --- | --- |
| `/settings/*` -> `SettingsView` | `18_ustawienia` (`SET_SETTINGS_WORKSPACE`) | `ProtectedRoute(requireAuth=true)`; authenticated user access | User-owned preferences/memory controls; tenant policy controls tylko przez handoff/link do admin; brak drugiego admin root | `AppRoutes.tsx`, `SettingsView.tsx`, `18_ustawienia/02_SCOPE.md`, `18_ustawienia/functions/SET_POLICY_BOUNDARY_LINKS.md` |
| `/admin/*` -> `AdminView` -> `AdminSettingsModule` | `17_panel-administratora` (`ADM_ADMIN_WORKSPACE`) | `ProtectedRoute(requiredRole="ADMIN")` | Tenant-admin control plane (people/security/billing/ai/integrations/audit/operations); bez platform cross-tenant writes | `AppRoutes.tsx`, `AdminView.tsx`, `17_panel-administratora/README.md`, `17_panel-administratora/03_BEHAVIOR.md`, inventory admin table |
| `/superadmin/*` -> `SuperAdminView` | SuperAdmin horizontal platform layer | `ProtectedRoute(requiredRole="SUPERADMIN")` | Platform operator cross-tenant governance/ops; oddzielny root i oddzielna odpowiedzialnosc od tenant admin/settings | `AppRoutes.tsx`, `SuperAdminView.tsx`, `SUPERADMIN_V8_SSOT.md` |
| Legacy AppView aliases -> admin/settings/superadmin routes | Shared routing layer (not owner of business domain) | Routing-level mapping only | Aliasy sa dozwolone, ale nie zmieniaja ownership; mutacje dziedzicza granice routa docelowego | `routeConfig.ts`, `ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`, module codemaps |

### Integracyjny boundary note (P0)

W runtime guard istnieje hierarchia `SUPERADMIN > ADMIN`, wiec `SUPERADMIN` przechodzi przez `requiredRole="ADMIN"` i moze wejsc na `/admin/*`. To jest zgodne z implementacja guard, ale koliduje z twarda separacja plane-ownership opisana w `SUPERADMIN_V8_SSOT.md` i kontraktach 17/18.

---

## 2) Gap map (P0/P1/P2) per boundary

| Gap ID | Boundary | Priority | Finding | Impact | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `BND-P0-001` | `17_admin <-> superadmin` | `P0` | Guard hierarchy pozwala `SUPERADMIN` na `/admin/*` (`>= ADMIN`) | Ryzyko rozmycia separacji plane i uprawnien operacyjnych | `ProtectedRoute.tsx`, `AppRoutes.tsx`, `SUPERADMIN_V8_SSOT.md`, `_ADMIN_SETTINGS_SUPERADMIN_OWNER_DECISION_BND-P0-001_2026-05-11.md` | `OWNER_DECIDED (implementation pending)` |
| `BND-P1-002` | `18_settings <-> 17_admin` | `P1` | Czesc policy ownership jest opisana ogolnie; brakuje jednolitej listy "user-write vs admin-write vs link-only" per sekcja | Ryzyko niespojnej interpretacji ownership przy rozwoju sekcji settings | `SettingsView.tsx`, inventory settings table, `18_ustawienia/functions/SET_POLICY_BOUNDARY_LINKS.md` | `NOT_DONE` |
| `BND-P1-003` | `17_admin internal boundary` | `P1` | Alias mapping (`AppView.ADMIN_WORKSPACE` itd.) moze mylic ownership narracje bez twardej tabeli alias->canonical | Ryzyko driftu dokumentacji i acceptance | `routeConfig.ts`, `17_panel-administratora/03_BEHAVIOR.md`, `17_panel-administratora/DEEP_RAW_GAP_AUDIT_2026-05-11.md` | `PARTIAL` |
| `BND-P1-004` | `17_admin mutations` | `P1` | Brak module-local dowodu, ze high-impact admin writes zawsze maja audit evidence packet | Ryzyko "claim without evidence" | `17_panel-administratora/07_ACCEPTANCE_AND_TESTS.md`, inventory admin rows | `NOT_DONE` |
| `BND-P2-005` | `18_settings` | `P2` | Wiele mounted settings ma status `stub/partial` (np. `ai-privacy`, `theme`, `accessibility`, `import-export`) | Nie blokuje boundary ownership, ale oslabia acceptance completeness | `ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`, `SettingsView.tsx` | `KNOWN_GAP` |
| `BND-P2-006` | `memory controls (user/admin/operator)` | `P2` | V8 memory control doctrine jest dobra, ale brak jawnej mapy route-level ownership do konkretnych controls object | Ryzyko niejednolitej implementacji przyszlych mutacji memory | `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md`, `SettingsView.tsx`, inventory AI rows | `NOT_DONE` |

---

## 3) Normalizacja kontraktow

Normalizacja obejmuje sekcje:
- `functions/*`
- `06_PERMISSIONS_AND_SECURITY.md`
- `07_ACCEPTANCE_AND_TESTS.md`

Cel: jedna semantyka granic i dowodow dla 17/18 + zgodnosc z superadmin IA.

### 3.1 functions — normalized clauses

W obu modulach (`17`, `18`) kazdy function contract powinien miec identyczny blok granic:

1. **Role boundary (enforced in runtime)**  
   - Ktory guard i jaka rola uruchamia funkcje.
2. **Mutation boundary (owner-write matrix)**  
   - `allowed_writes`, `link_only_writes`, `forbidden_writes`.
3. **Cross-plane rule**  
   - Czy superadmin access do tenant plane jest `forbidden`, `allowed_readonly`, czy `allowed_with_override`.
4. **Evidence field**  
   - `evidence: [...]` albo `NOT_DONE` (bez "implicit pass").

Status normalizacji:
- `17/functions/*`: `ENHANCE` (boundary wording jest, ale brakuje owner-write matrix i explicit cross-plane policy value).
- `18/functions/*`: `ENHANCE` (podobnie: boundary jest narracyjny, ale nie tabelaryczny i bez explicit policy value).

### 3.2 `06_PERMISSIONS_AND_SECURITY` — normalized matrix

Dla obu modulow w `06_...` wymagany ten sam format:

| Capability class | USER | ADMIN | SUPERADMIN | OWNER | Notes |
| --- | --- | --- | --- | --- | --- |
| route access | ... | ... | ... | ... | runtime guard |
| read scope | ... | ... | ... | ... | tenancy scope |
| mutate scope | ... | ... | ... | ... | mutation boundary |
| approval required | ... | ... | ... | ... | high-impact |
| audit evidence required | ... | ... | ... | ... | proof pointer |

Krytyczny punkt byl decyzja ownera i zostal zamkniety:
- `SUPERADMIN -> /admin/*` = `ALLOWED_WITH_EXPLICIT_OVERRIDE_AUDIT`
- source of truth: `_ADMIN_SETTINGS_SUPERADMIN_OWNER_DECISION_BND-P0-001_2026-05-11.md`.

Status:
- `17/06...`: `ENHANCE` (decyzja policy locked; do wdrozenia matrix + override/audit semantics).
- `18/06...`: `ENHANCE` (potrzebna sekcja memory-control ownership matrix user/admin/operator).

### 3.3 `07_ACCEPTANCE_AND_TESTS` — normalized gates

W obu modulach `07_...` powinny byc 4 stale gate groups:

1. `Route + guard gate`
2. `Ownership + mutation gate`
3. `Audit evidence gate`
4. `Cross-boundary regression gate`

Minimalne scenariusze wymagane:
- Negatywny test boundary dla `BND-P0-001` (superadmin->admin policy expected result).
- Settings section matrix test: `editable vs admin-only vs stub/partial honest state`.
- Memory controls test map: user controls vs tenant admin controls vs operator visibility (bez privacy bypass).

Status:
- `17/07...`: `ENHANCE` (brak explicit negatywnego boundary testu dla P0 i brak twardego evidence packet pattern).
- `18/07...`: `ENHANCE` (brak explicit matrix dla memory-control ownership i stub/partial acceptance policy).

---

## 4) Decyzje KEEP / ENHANCE / NEW / DEFER

| Decision | Item | Evidence | Result |
| --- | --- | --- | --- |
| `KEEP` | Trzy odrebne roots runtime: `/settings/*`, `/admin/*`, `/superadmin/*` | `AppRoutes.tsx`, `routeConfig.ts`, inventory active mount points | `CONFIRMED` |
| `KEEP` | Admin jako tenant control plane, Settings jako preference workspace, SuperAdmin jako platform layer | `17/README.md`, `18/README.md`, `SUPERADMIN_V8_SSOT.md` ownership model | `CONFIRMED` |
| `ENHANCE` | Unified owner-write matrix w function contracts (`functions/*`) | `17/functions/*`, `18/functions/*` | `NOT_DONE` |
| `ENHANCE` | Unified permissions matrix w `06_PERMISSIONS_AND_SECURITY` | `17/06...`, `18/06...` | `NOT_DONE` |
| `ENHANCE` | Unified acceptance gates + explicit cross-boundary negative tests w `07_ACCEPTANCE_AND_TESTS` | `17/07...`, `18/07...` | `NOT_DONE` |
| `NEW` | Boundary decision record dla `BND-P0-001` (single owner decision source) | Guard/runtime evidence + SSOT ownership rules + `_ADMIN_SETTINGS_SUPERADMIN_OWNER_DECISION_BND-P0-001_2026-05-11.md` | `DONE` |
| `NEW` | Memory ownership mapping packet (route-level for `UserMemoryPreference`, `TenantMemoryControlPolicy`, `MemoryAccessExplanation`) | `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` + mounted routes | `NOT_DONE` |
| `DEFER` | Runtime policy change guard semantics | Owner decision locked; execution deferred as runtime follow-up | `DEFERRED_IMPLEMENTATION` |

---

## 5) Integracyjny werdykt

**Werdykt: `APPROVED_FOR_DOCS`**

### Decision lock

`BND-P0-001` ma decyzje wlascicielska:
`ALLOWED_WITH_EXPLICIT_OVERRIDE_AUDIT`
zapisana w `_ADMIN_SETTINGS_SUPERADMIN_OWNER_DECISION_BND-P0-001_2026-05-11.md`.

### Co jest nadal otwarte

- Runtime implementation decyzji (guard + explicit override flow + audit packet) jest `NOT_DONE`.
- Normalizacja `functions`, `06`, `07` w modulach 17 i 18 pozostaje `NOT_DONE`.
- Memory ownership mapping packet pozostaje `NOT_DONE`.

### Kiedy `NO_GO`

`NO_GO` tylko jesli owner wybierze polityke sprzeczna z security-tenancy guardrails (np. hidden cross-plane writes bez explicit approval/audit) albo jesli nastapi regresja do duplikacji ownership roots.

