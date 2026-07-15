# KONCEPT HP-25 — Governance-sync (Command Center/RBAC ↔ struktury klienta)

> Blok Harvey G. Sonda + koncept (Fable-poziom), NIE pełny build.
> Autor: robotnik floty, 2026-07-15. Weryfikacja: grep na żywym repo `wire-hp25-hp27` (baza `origin/demo` f5096cf514).

## 0. Teza planu (przypomnienie)

Harvey/Intapp wzorzec: RBAC klienta NIE jest osobnym modelem ról tworzonym ręcznie w Consultify —
synchronizuje się z tym, co klient JUŻ ma: katalog tożsamości (AD/Entra ID, Okta) + macierz RACI
projektu. Cel: zero podwójnego zarządzania rolami, mniejsze ryzyko rozjazdu uprawnień.

## 1. Co JUŻ ISTNIEJE (zweryfikowane grepem, nie z dokumentacji)

### 1.1 Połowa tematu: SCIM 2.0 = pełny sync z katalogiem tożsamości

- `server/src/routes/integrations/scim.routes.ts` (1082 linii, V4-ENT-02) — **pełny protokół SCIM 2.0**:
  `/Users` (CRUD+filter) I **`/Groups`** (CRUD) — RFC 7644. To już jest "sync z AD/Entra ID" (Entra/Okta/
  OneLogin to SCIM-compatible IdP, produkt nie musi integrować się z konkretnym API Microsoftu —
  SCIM to standard, którym Entra ID mówi).
- Tabela `scim_group_mappings`: `external_group_id/name` → `internal_role` (string, domyślnie `'member'`).
  Czyli: administrator MAPUJE grupę AD (np. "Finance-Approvers") na rolę Consultify.
- UI: `src/views/superadmin/SCIMProvisioningView.tsx` (1235 linii) — ekran superadmina z sekcją
  Group Mappings (StandardTable, komentarz `3a164d29f4 refactor(superadmin/m27-b)`), placeholder
  w UI dosłownie mówi `"e.g., Azure AD SCIM"`.
- Sync logs (`scim_sync_logs`) + conflict resolution (`scim_conflict_log`, resolution:
  merge/skip/overwrite) — governance-grade audytowalność już jest.
- **Świeży fix bezpieczeństwa**: commit `3edaf2a130 fix(security P1): scim_group_mappings org-scoped
  — leak+IDOR delete zamknięte` (widoczny w `git log`). Tabela BYŁA cross-org do niedawna — teraz
  poprawiona, ALE to sygnał: ten obszar jest wrażliwy i świeżo dotknięty przez P1.
- Równoległy, prostszy silnik: `server/src/services/tablePlatform/SCIMService.ts` (149 linii) —
  users-only, inny zestaw tabel (`tp_scim_tokens`), NIE ma Groups. Dwa równoległe silniki SCIM =
  ten sam wzorzec rozjazdu co "dwa generatory inicjatyw" (patrz MEMORY finding_two_initiative_generators).

**Wniosek: SCIM/Entra-sync NIE jest luką — jest zbudowany, przetestowany na org-scope, i ma UI.**
Plan Harvey nazywający to "brakującym" jest nieaktualny względem stanu repo.

### 1.2 Model ról projektowych (kandydat do sync z RACI)

- `server/src/services/projectRoleCanon.ts` — kanoniczne 12 ról projektowych (SPONSOR, PROJECT_LEADER,
  TASK_ASSIGNEE, OBSERVER, PMO, INITIATIVE_OWNER, WORKSTREAM_OWNER, REVIEWER, SME, CONSULTANT,
  BUSINESS_OWNER, STEERING_COMMITTEE) — jawnie oznaczone jako "intentionally independent" od:
  - `src/types/core.ts` (ProjectRole)
  - `server/src/services/projectMemberService.ts` (PROJECT_ROLES + DEFAULT_PERMISSIONS per rola)
  - `server/src/constants/initiativeStatuses.ts` (gate roles)
- `server/src/services/effectiveAccessService.ts` — resolver `AccessContext` (capabilities, scope,
  audit), rozróżnia `applicationRole`/`platformRole`/`projectRole`.
- **Trzy równoległe reprezentacje roli projektowej w kodzie** — to samo ryzyko rozjazdu co SCIM,
  tylko wewnątrz produktu (nie z klientem).

### 1.3 RACI — istnieje jako REJESTR, NIE jako źródło uprawnień

- `server/src/services/decisionDelegationService.ts` — `StakeholderRole =
  'responsible'|'accountable'|'consulted'|'informed'` — to jest **prawdziwe RACI**, ale przypięte
  do pojedynczej decyzji (delegacja/opinia), nie do całego projektu.
- `server/src/services/stakeholderRegistryService.ts` — rejestr interesariuszy + `Engagement`
  (kto jest zaangażowany w projekt/inicjatywę), `getProjectEffectiveStakeholders`.
- `server/src/services/pmo/initiativeRaciResultsSummaryService.ts` — RACI per inicjatywa,
  zasila raporty wyników.
- **Brak**: nic w kodzie nie CZYTA rejestru stakeholderów/RACI, żeby NADAĆ rolę projektową
  (`projectMemberService.PROJECT_ROLES`) albo capability (`effectiveAccessService`). RACI dziś
  jest informacyjny/raportowy, nie jest "źródłem prawdy" dla RBAC — dokładnie ta luka, którą
  plan Harvey nazywa.

### 1.4 Wzorzec do naśladowania: HP-24 SSO self-service (świeżo zbudowane)

- `src/components/Admin/AdminSsoSelfServiceCard.tsx` (471 linii) — org-admin sam konfiguruje
  SAML/OIDC swojej organizacji BEZ udziału superadmina, przez `/api/admin/sso-self`
  (org-scoped, `adminP32.routes.ts`), za flagą `ssoSelfServiceFlag` (default OFF).
- To jest DOKŁADNIE wzorzec, którego brakuje dla group-mappings: dziś mapowanie grup AD→rola
  jest TYLKO na poziomie superadmina (`requireSuperAdmin` w `scim.routes.ts`), klient nie może
  sam zarządzać swoimi mapowaniami.

## 2. Czego BRAKUJE (realna treść governance-sync)

| # | Luka | Gdzie | Ryzyko budowy |
|---|------|-------|---------------|
| G1 | `internal_role` w `scim_group_mappings` to płaski string (member/admin), nie mapuje się na 12 ról `projectRoleCanon` ani na `PROJECT_ROLES` z uprawnieniami per-projekt | `scim.routes.ts` tabela `scim_group_mappings` | Średnie — zmiana schematu + downstream w `effectiveAccessService` |
| G2 | Mapowanie grup jest org-wide, nie per-projekt — nie da się powiedzieć "grupa AD X → PROJECT_LEADER na Projekcie Y" | `scim_group_mappings` (brak `project_id`) | Średnie — nowa kolumna + UI wyboru projektu |
| G3 | Grupa AD → rola jest TYLKO superadmin (`requireSuperAdmin`), brak self-service dla org-admina (analogicznie do HP-24 SSO) | `scim.routes.ts` (`/admin/group-mappings`) | **Wysokie** — endpoint dotyka nadawania ról = powierzchnia ataku, TABELA MIAŁA P1 LEAK 2 dni temu |
| G4 | RACI (stakeholderRegistry/decisionDelegation) nie zasila żadnego nadania roli/capability — brak "importuj RACI projektu jako role" | `stakeholderRegistryService.ts`, `projectMemberService.ts` | Średnie — logika mapowania R/A/C/I → capability wymaga decyzji produktowej (czy "Consulted" = REVIEWER?) |
| G5 | Trzy niezależne reprezentacje roli projektowej w kodzie (core.ts/projectMemberService/projectRoleCanon) nie mają jednego mapowania kanonicznego — sync z zewnątrz musiałby trafiać w 3 miejsca | j.w. | Niskie do zbadania, średnie do naprawy |

## 3. Zadania buildowe (dla Sonneta, po akceptacji koncepcji)

1. **B1 — Ujednolić model roli projektowej** (prereq dla wszystkiego innego). Zmapować
   `projectRoleCanon.ts` ↔ `projectMemberService.PROJECT_ROLES` ↔ `core.ts ProjectRole` w JEDNĄ
   tabelę przekładu (już częściowo istnieje w `projectRoleCanon.ts:290-305` — `normalizedRole` if/else
   — rozbudować do pełnej dwukierunkowej mapy + testu round-trip). Pliki:
   `server/src/services/projectRoleCanon.ts`, `server/src/services/projectMemberService.ts`.
2. **B2 — Group-mapping per-projekt** — dodać `project_id` (nullable = org-wide fallback) do
   `scim_group_mappings`, rozszerzyć `internal_role` o wartości z kanonu 12 ról, UI: dropdown
   projektu + roli zamiast wolnego tekstu. Pliki: `scim.routes.ts`, `SCIMProvisioningView.tsx`.
3. **B3 — RACI→rola import (jednorazowy, nie live-sync)** — endpoint
   `POST /api/pmo/projects/:id/import-raci-as-roles` czytający
   `stakeholderRegistryService.getProjectEffectiveStakeholders` + `initiativeRaciResultsSummaryService`,
   proponujący (NIE auto-stosujący) nadania ról projektowych do przeglądu przez PM — decyzja
   mapowania R/A/C/I→rola wymaga akceptu Piotra (np. Accountable→WORKSTREAM_OWNER, Responsible→
   TASK_ASSIGNEE, Consulted→SME, Informed→OBSERVER — DO POTWIERDZENIA).
4. **B4 — Self-service group-mapping dla org-admina** (wzorem HP-24) — TYLKO po B2, i tylko gdy
   P1-fix (3edaf2a130) ma pokrycie testowe regresji cross-org. Nowy endpoint org-scoped
   (nie `requireSuperAdmin`) + karta w stylu `AdminSsoSelfServiceCard.tsx`, za flagą OFF.

## 4. Dlaczego NIE zrobiłem wiring teraz (decyzja świadoma)

Zadanie dopuszczało "cienki wiring ≤150 linii, jeśli niskowiszący owoc". Sprawdziłem — nie ma
bezpiecznego kandydata:
- Jedyny "endpoint istnieje, brakuje UI" (odwrotnie: tu UI+endpoint dla superadmina JUŻ są) —
  brakujący kawałek to **rozszerzenie uprawnień nadawania ról** (G3) na nowy poziom dostępu
  (org-admin self-service) na tabeli, która **48h temu miała aktywny P1 leak** (`3edaf2a130`).
  Dopisywanie tam kodu "na szybko" bez pełnej weryfikacji org-scope byłoby dokładnie powtórką
  wzorca z memory `finding_v8_flag_topology_implicit_fallback` — cichy rozjazd na wielu orgach.
- B1 (ujednolicenie modelu roli) jest prerekwizytem dla B2-B4 i sam w sobie nie jest "cienki" —
  dotyka 3 plików z realną logiką uprawnień w produkcji.
- Wniosek: koncept + mapa jest właściwym zakresem tej sesji. Build → osobny blok Sonnet z
  jawną akceptacją Piotra na B1→B2→B3→B4 (w tej kolejności, bo każdy kolejny zależy od poprzedniego).

## 5. Ryzyka do podniesienia Piotrowi

- **Cross-org**: `scim_group_mappings` miało leak; każda rozbudowa (B2-B4) wymaga testu IDOR
  analogicznego do `3b3c4f6e60 test(M24): cross-org IDOR coverage` PRZED merge.
- **Dwa silniki SCIM** (`SCIMService.ts` tablePlatform vs `integrations/scim.routes.ts`) — decyzja
  którego rozbudowywać (rekomendacja: `integrations/scim.routes.ts` — ma Groups, ten drugi nie).
  Ryzyko: ktoś rozbuduje niewłaściwy i funkcja "zniknie" dla drugiej ścieżki (wzorzec z
  `finding_two_initiative_generators_divergence`).
- **RACI→rola mapowanie jest decyzją produktową**, nie techniczną — bez akceptu Piotra na
  R/A/C/I → który CanonicalProjectRole, B3 nie powinien być budowany (ryzyko błędnego nadania
  uprawnień, np. "Informed" dostający prawa edycji).
