# TESTY — M24 Panel Administratora (org admin)

> **Moduł:** M24 Panel Administratora (`/admin/*`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`, inwentarz `Harvard/podzial/inventory/INV_G_admin_ustawienia_partner_superadmin.md`
> **Zakres tej paczki:** LiveShell `AdminSettingsModule` z 5 panelami kanonicznymi: Team & Access (people), Billing & Plans (billing), AI Controls (ai), Security & Identity (security), Audit Log (audit). Gating roli ADMIN/OWNER. Weryfikacja martwego kodu. E2E przez endpointy backendu.
> **Poza zakresem:** SuperAdmin (`/superadmin/*`) — to M27. Ustawienia użytkownika (`/settings/*`) — to M25. Billing w `/settings/billing` — stub route-only, brak panelu (pułapka nawigacyjna, odnotować). ChatV9Flags* — żyją globalnie w App.tsx, poza zakresem panelu admin.
> **Cel:** agent piszący i testujący moduł ma dogłębnie przetestować 5 paneli kanonicznych, gating roli ADMIN, bezpieczeństwo cross-org (IDOR/escalation), wszystkie pod-zakładki Security (6) i AI (9), Audit Log z eksportem — z dowodem E2E (UI + Network + DB).
> **Bazuje na:** `Harvard/wdrozenie-100/M24-admin.md` (teczka, epiki F1–F6), `Harvard/modules/M24-admin/KARTA_AUDYTU.md` (S1–S7, 58/100), re-audit 2026-06-13 (L-01/02 NAPRAWIONE, L-03–L-09 otwarte).
> **Legenda:** **[MANUAL]** = wymaga ręcznej weryfikacji (realne OAuth / incognito / urządzenie mobilne); **[FLAG]** = zależne od flagi/capability/roli; **[DB]** = dowód obejmuje wiersz/kolumnę w bazie; **[SEC]** = test bezpieczeństwa — krytyczne.
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

### Shell i routing

| Komponent | Plik | Uwaga |
|---|---|---|
| Wejście / guard | `src/components/ProtectedRoute.tsx` | `requiredRole="ADMIN"` + jawny redirect SUPERADMIN → `/superadmin` |
| Mobile guard | `src/components/shared/DesktopOnlyGuard` | Blokuje na mobile — moduł desktop-only |
| Shell | `src/views/admin/AdminView.tsx` | Cienki wrapper: `DesktopOnlyGuard` → `AdminSettingsModule` |
| Moduł | `src/views/admin/AdminSettingsModule.tsx` | 5 sekcji: `people` / `billing` / `ai` / `security` / `audit` |
| Sidebar (live) | `src/components/Admin/AdminSettingsSidebar.tsx` | Zintegrowany w `AdminSettingsModule` |
| **Sidebar (martwy)** | `src/components/layout/AdminSidebar.tsx` | **0 importów w live kodzie — nie renderowany** |

### 5 paneli kanonicznych (live)

| Sekcja URL | Komponent panelu | Główna logika |
|---|---|---|
| `/admin/people` | `AdminMembersRolesPanel.tsx` | `GET/POST /organizations/:orgId/members`, `PATCH …/role`, `DELETE …/:memberId`, `POST /access-codes/generate` |
| `/admin/billing` | `AdminBillingFinOpsPanel.tsx` | `GET /admin/billing/summary|plans|payment-methods|invoices|usage-details|alerts|tax-settings` + PUT/POST/DELETE per zasób |
| `/admin/ai` | `AdminAIControlCenterPanel.tsx` → `AIModule.tsx` (×9 pod-zakładek) + `OrgAISettingsView` | `GET /admin/ai/summary`, `GET/PUT /ai-settings/org/:orgId` |
| `/admin/security` | `AdminSecurityIdentityPanel.tsx` → 6 pod-zakładek | `GET/PUT /admin/security`, `/admin/collaboration`, `GET/POST/DELETE /admin/iam/policy|assignments`, `GET/POST/DELETE /admin/identity/scim/…` |
| `/admin/audit` | `AdminAuditLogPanel.tsx` | `GET /admin/audit-logs`, `GET /admin/audit-logs/stats`, `GET /admin/audit-logs/export` (CSV), `PUT /admin/compliance/data-retention` |

### Gating roli — jak działa (przeczytaj uważnie)

```
Sidebar (Sidebar.tsx:853-860):
  visible jeśli role ∈ {ADMIN, OWNER} lub isSuperAdminRole()

ProtectedRoute (ProtectedRoute.tsx:77-88):
  1. SUPERADMIN → redirect do /superadmin (P0 naprawione, 1f9ed50f05)
  2. !hasRequiredRole('ADMIN') → redirect do /dashboard
  3. hasRequiredRole: ADMIN=2, OWNER=2, USER=1, SUPERADMIN=3
     → OWNER dostaje admin (poziom 2 ≥ 2) ✓

Backend adminP32 (adminP32.routes.ts:280-348 fn getAdminActor):
  - orgId musi === req.user.organizationId (cross-org blocked → 403 ADMIN_BOUNDARY_VIOLATION)
  - membership DB lookup: rola z organization_members (nie z JWT globalnie)
  - requiredCapabilities per endpoint (people:read, billing:write, etc.)
```

### Aliasy URL → sekcja

`/admin`, `/admin/overview`, `/admin/members`, `/admin/team`, `/admin/users`, `/admin/access`, `/admin/workspace`, `/admin/organization`, `/admin/feedback` → **people**
`/admin/plans`, `/admin/finops` → **billing**
`/admin/ai-controls`, `/admin/governance` → **ai**
`/admin/identity`, `/admin/scim`, `/admin/iam`, `/admin/integrations` → **security**
`/admin/audit-log`, `/admin/compliance` → **audit**

### Zasada weryfikacji E2E (obowiązkowa)

Każda akcja zapisu MUSI być potwierdzona w Network (żądanie do właściwego endpointu) ORAZ przeżyć odświeżenie strony. Sam toast lub zmiana UI bez żądania = **FAIL**. Po akcji odśwież i sprawdź persystencję.

**Uwaga audit-log (L-04):** backend robi `SELECT * LIMIT 1000` bez `WHERE organization_id` — filtr organizacji jest in-memory. To znana luka P2. W testach: weryfikuj że audit log NIE pokazuje zdarzeń innych org, ale bądź świadomy ograniczenia 1000 rekordów.

### Setup środowiska testowego

1. Dev server FE `:3000` (lub `:3001`) + backend `:4000` uruchomione.
2. Konto **ADMIN/OWNER** testowe — np. owner DBR77 (piotr.wisniewski@dbr77.com).
3. Konto **non-ADMIN** (rola MEMBER lub GUEST) do testów gating.
4. **Konto innej organizacji** (różny `organizationId`) do testów cross-org.
5. DevTools → Network (filtr: `/api/admin` + `/api/organizations`) + Console (zero błędów jako wymóg).
6. Miej gotowe: testowy adres e-mail do zaproszeń, `orgId` swojej org i innej org.

---

## 1. Gating roli ADMIN [SEC] [FLAG] [DB]

### 1.1 Sidebar — widoczność dla non-ADMIN

- Zaloguj się jako MEMBER (nie ADMIN, nie OWNER).
- W sidebarze sekcja „Admin" / pozycje `ADMIN_*` **nie powinna być widoczna** (Sidebar.tsx:853-860: warunek `role === ADMIN || role === OWNER`).
- **Asercja:** brak pozycji Admin w sidebarze. Żadnego linku prowadzącego do `/admin/*`.
- Wróć do sprawdzenia: `currentUser.role` w React DevTools → wartość `MEMBER` lub `GUEST`.

### 1.2 Bezpośredni URL `/admin` dla MEMBER [MANUAL]

- Będąc zalogowanym jako MEMBER, wejdź bezpośrednio na `http://localhost:3000/admin`.
- **Oczekiwane zachowanie:** `ProtectedRoute` wywołuje `Navigate to={ROUTES.DASHBOARD}` (ProtectedRoute.tsx:87). Redirect do `/` lub `/dashboard`.
- **Asercja:** URL po chwili = `/` lub `/dashboard`, BRAK wyświetlenia panelu admin, brak błędu konsoli.
- Sprawdź: `console.warn` `[ProtectedRoute] User role "MEMBER" insufficient for route requiring "ADMIN"` — powinien się pojawić.
- Powtórz dla `/admin/billing`, `/admin/security`, `/admin/ai` — wszystkie mają redirectować.

### 1.3 SUPERADMIN → redirect do `/superadmin` [SEC]

- Zaloguj się jako SUPERADMIN (jeśli konto dostępne).
- Wejdź na `/admin`.
- **Oczekiwane:** `ProtectedRoute.tsx:77-78` wyłapuje `normalizeAppRole(role) === 'SUPERADMIN'` i kieruje `Navigate to={ROUTES.SUPERADMIN.ROOT}`.
- **Asercja:** URL = `/superadmin`, brak crashu, brak wyświetlenia panelu org-admin. To P0 zamknięte (`1f9ed50f05`) — potwierdź że naprawa działa.

### 1.4 OWNER dostaje pełny dostęp

- Zaloguj się jako OWNER (poziom 2 = ADMIN w hierarchii ProtectedRoute).
- Wejdź na `/admin` — panel ma się otworzyć normalnie.
- Sidebar widoczny z sekcją Admin.
- Wszystkie 5 paneli dostępne.

### 1.5 DesktopOnlyGuard [MANUAL]

- Na urządzeniu mobilnym (lub DevTools → responsive mode ≤ 768px) wejdź na `/admin`.
- **Asercja:** `DesktopOnlyGuard` renderuje komunikat blokujący dostęp z informacją o desktop-only. Brak panelu adminów.
- Sprawdź że komunikat jest czytelny i nie powoduje błędów konsoli.

### 1.6 Backend cross-org IDOR [SEC] [DB]

> Oba P0 naprawione (L-01 `1f9ed50f05`, L-02 `fd8707c5b2`) — testy regresji (L-03 otwarte).

- Zaloguj się jako admin org A. Zanotuj `orgId` org A.
- Ręcznie wywołaj (curl lub Network DevTools):
  ```
  GET /api/admin/people?orgId=<orgB_id>
  ```
  — gdzie `orgB_id` to `organizationId` innej organizacji.
- **Oczekiwane:** `403 ADMIN_BOUNDARY_VIOLATION` (`orgId !== req.user.organizationId`).
- Powtórz dla:
  ```
  GET /api/admin/billing/summary?orgId=<orgB_id>
  GET /api/admin/audit-logs?orgId=<orgB_id>
  GET /api/admin-data/user-tiers/<orgB_id>   (boczny router admin-data.routes.ts)
  PUT /api/ai-settings/org/<orgB_id>         (boczny router ai-settings.routes.ts)
  ```
- **Asercja dla każdego:** status `403`, body zawiera `code: "ADMIN_BOUNDARY_VIOLATION"` lub `403` z inną wiadomością. Żadne dane org B nie wyciekają.

### 1.7 Anty-eskalacja roli [SEC] [DB]

- Jako ADMIN (nie OWNER) próbuj przez Network/curl zmienić rolę własną lub kogoś na `SUPERADMIN`:
  ```
  PATCH /api/organizations/<orgId>/members/<userId>/role
  Body: {"role": "SUPERADMIN"}
  ```
- **Oczekiwane:** serwer odrzuca lub normalizuje do org-ADMIN (`normalizeOrganizationRole('SUPERADMIN')` → 'ADMIN').
- Sprawdź w konsoli backendu / odpowiedzi — żaden użytkownik nie powinien dostać roli `SUPERADMIN` przez ten endpoint.

---

## 2. Panel Team & Access (`/admin/people`)

**Komponent:** `src/components/Admin/AdminMembersRolesPanel.tsx`
**Endpointy:**
- `GET /api/organizations/:orgId/members` — lista członków
- `POST /api/organizations/:orgId/members` — dodanie/zaproszenie (payload: `{targetEmail, role}` lub `{targetUserId, role}`)
- `PATCH /api/organizations/:orgId/members/:memberId/role` — zmiana roli
- `DELETE /api/organizations/:orgId/members/:memberId` — usunięcie
- `POST /api/access-codes/generate` — generowanie kodu zaproszenia

### 2.1 Ładowanie listy członków

- Wejdź na `/admin/people` lub `/admin`.
- `GET /api/organizations/<orgId>/members` — żądanie widoczne w Network, status 200.
- Tabela wyświetla kolumny: użytkownik/email, rola, data dołączenia (jeśli dostępne).
- Stan ładowania (skeleton / spinner) widoczny przed załadowaniem danych.
- Pusty stan (org bez członków) → CTA „Invite member" (asercja: brak crasha).
- Odświeżenie strony → lista wraca (persystencja przez API, nie localStorage).

### 2.2 Zaproszenie po e-mailu

- Wypełnij pole `inviteEmail` testowym adresem, wybierz rolę `MEMBER`.
- Klik „Add" / „Invite".
- **Network:** `POST /api/organizations/<orgId>/members` body = `{targetEmail: "test@...", role: "MEMBER"}`, status 201.
- Toast sukces, nowy użytkownik pojawia się w tabeli.
- **Walidacja:**
  - Pusty e-mail → toast „Enter an email address before adding a member", brak żądania sieciowego.
  - Próba zaproszenia na rolę OWNER → toast „Owner changes must use the ownership transfer flow", brak żądania.
  - Próba zaproszenia przez non-ADMIN (canManageTeam=false) → toast „Only a team owner or admin can add members".

### 2.3 Zmiana roli [DB]

- W tabeli zmień rolę istniejącego MEMBER na ADMIN (dropdown / select).
- **Network:** `PATCH /api/organizations/<orgId>/members/<memberId>/role` body = `{role: "ADMIN"}`, status 200.
- Tabela aktualizuje się natychmiast (optimistic lub po odpowiedzi).
- Odśwież stronę → nowa rola widoczna. [DB] — sprawdź `organization_members.role` jeśli masz dostęp do DB.
- **Edge:** próba zmiany roli OWNER przez ADMIN (nie OWNER) → sprawdź zachowanie (logika `ROLE_GUIDANCE` mówi że ADMIN nie może zmieniać OWNER).

### 2.4 Usunięcie użytkownika

- Klik ikony usunięcia (Trash) przy użytkowniku.
- Oczekuj dialog potwierdzenia (jeśli istnieje) lub bezpośrednie usunięcie.
- **Network:** `DELETE /api/organizations/<orgId>/members/<memberId>`, status 200.
- Użytkownik znika z tabeli.
- **Ochrona OWNER:** próba usunięcia siebie (currentUser) — sprawdź czy komponent blokuje self-deletion. Próba usunięcia jedynego OWNER — backend powinien zwrócić błąd (ochrona last-owner serwerowa).
- Odśwież → użytkownik nie powraca. [DB]

### 2.5 Generator kodu zaproszenia

- Ustaw rolę (`generatedInviteRole`) i max uses (`generatedInviteMaxUses`, domyślnie 50).
- Klik „Generate invite code".
- **Network:** `POST /api/access-codes/generate` body = `{role, maxUses}`, status 201.
- Kod wyświetlony w UI z przyciskiem kopiowania (`Copy`).
- Klik kopiuj → kod w schowku, toast potwierdzający.
- **Limit max uses:** spróbuj wpisać wartość > 500 — sprawdź walidację FE.
- **Weryfikacja w Network:** payload faktycznie zawiera `role` i `maxUses`.

### 2.6 Transfer własności (`OwnershipManagementView`)

- W panelu Team sprawdź obecność sekcji / przycisku transfer własności.
- **Tylko OWNER może inicjować transfer.** Jako ADMIN (nie OWNER) — UI powinien blokować lub nie pokazywać opcji transferu.
- Jako OWNER: sprawdź że formularz transferu prowadzi do odpowiedniego endpointu (nie crash).

---

## 3. Panel Billing & Plans (`/admin/billing`)

**Komponent:** `src/components/Admin/AdminBillingFinOpsPanel.tsx`
**Flaga:** `VITE_STRIPE_ENABLED` — sprawdź wartość (powinno być OFF = false w dev).
**Endpointy:**
- `GET /admin/billing/summary` — aktualny plan, użycie
- `GET /admin/billing/plans` — lista dostępnych planów
- `PUT /admin/billing/plan` — przypisanie planu
- `GET/POST/PUT/DELETE /admin/billing/payment-methods` — metody płatności
- `GET /admin/billing/invoices` — historia faktur
- `GET /admin/billing/usage-details` — szczegóły użycia
- `GET/PUT /admin/billing/alerts` — alerty budżetowe
- `GET/PUT /admin/billing/tax-settings` — ustawienia podatkowe

### 3.1 Zakładka Summary

- Wejdź na `/admin/billing`.
- **Network:** `GET /admin/billing/summary` (+ `/plans`, `/payment-methods`, `/invoices`, `/alerts`, `/tax-settings`, `/usage-details`) — wszystkie wywołane przy załadowaniu, statusy 200.
- Wyświetlone: aktualny plan, status, limity tokenów/storage/seats, data wygaśnięcia.
- Pusty stan (brak danych) → graceful empty state, brak crasha.

### 3.2 Zakładka Plan & Limits

- Otwórz zakładkę `plan`.
- Lista dostępnych planów z `GET /admin/billing/plans` — sprawdź że dropdown/select wyświetla realne plany (nie mock).
- Wypełnij formularz przypisania planu: planId, tokenLimit, seats, expiresAt.
- Klik „Save" / „Assign".
- **Network:** `PUT /admin/billing/plan` body = `{planId, planName, status, tokenLimit, storageLimitMb, seats, aiCallsPerDay, tokenBalance, expiresAt}`, status 200.
- Toast sukces, summary aktualizuje się.
- **Audit trail:** po zmianie planu w zakładce Audit powinien pojawić się wpis `update_billing`.

### 3.3 Zakładka Payment Methods [FLAG]

- `VITE_STRIPE_ENABLED=false` (domyślnie OFF): sprawdź że **brak formularza karty płatniczej** / Stripe Elements, zamiast tego — label „zarządzane przez DBR77" lub informacja managed (DP-11). **Asercja DP-11:** NIE powinno być możliwe wpisanie numeru karty przez tę ścieżkę.
- Lista istniejących metod płatności z `GET /admin/billing/payment-methods`.
- Próba dodania metody płatności bez Stripe: `POST /admin/billing/payment-methods` z fake paymentMethodId → sprawdź odpowiedź serwera.
- Ustawienie default: `PUT /admin/billing/payment-methods/:id/default`, status 200.
- Usunięcie: `DELETE /admin/billing/payment-methods/:id`, status 200. Sprawdź błąd 409 przy próbie usunięcia default.

### 3.4 Zakładka Invoices

- Historia faktur z `GET /admin/billing/invoices`.
- Tabela: data, kwota, status (paid/unpaid/overdue), link/przycisk do pobrania.
- Pusty stan (brak faktur) → graceful empty state.
- **Weryfikacja że billing NIE jest w M16 Finanse** — wejdź na `/finance`, sprawdź że nie ma tam panelu billing, to domena M24.

### 3.5 Zakładka Budgets & Tax (`controls`)

- Alerty budżetowe: zmień próg alertu (threshold 80→60) dla `tokens`.
- **Network:** `PUT /admin/billing/alerts` body = `{alerts: [...]}`, status 200.
- Ustawienia podatkowe: zmień np. pole NIP/VAT number.
- **Network:** `PUT /admin/billing/tax-settings` body, status 200.
- Odśwież → zmiany trwałe.

---

## 4. Panel AI Controls (`/admin/ai`)

**Komponenty:** `src/components/Admin/AdminAIControlCenterPanel.tsx` → `AIModule.tsx` (9 pod-zakładek) + `OrgAISettingsView.tsx`
**Backend:** `adminP32.routes.ts` (`GET /admin/ai/summary`) + `ai-settings.routes.ts` (`GET/PUT /ai-settings/org/:orgId`)

### 4.1 Summary governance (karta główna)

- Załaduj `/admin/ai`.
- **Network:** `GET /admin/ai/summary`, status 200.
- Wyświetlone 3 karty: Governance level (`governanceSummary.policyLevel`), Model posture (`modelCount`), Context controls (`allowExternalContext`).
- Pusty/null summary → karty pokazują „Unknown" / „n/a" bez crasha (kod obsługuje null).

### 4.2 Zakładka Governance settings (`OrgAISettingsView`) [DB]

- Klik zakładkę „Governance settings".
- `GET /ai-settings/org/:orgId` — załadowanie ustawień, status 200.
- Zmień dowolne ustawienie governance (np. policy level, model posture, context policy).
- Klik „Save".
- **Network:** `PUT /ai-settings/org/:orgId` body z ustawieniami, status 200.
- **Cross-org guard:** backend ma `userOrgId===orgId` check (linie 220, 259, 623, 702, 751 pliku `ai-settings.routes.ts` — naprawione L-02 `fd8707c5b2`). Odnotuj że NIE można zapisać ustawień dla innej org.
- Odśwież → zmiany trwałe. [DB]

### 4.3 Zakładka AI operations (`AIModule` — 9 pod-zakładek)

Klik zakładkę „AI operations". Sprawdź że `AIModule` ładuje się bez crasha. Poniżej test per pod-zakładka:

**Nawigacja:** Tab bar z 9 pozycjami. Każdy klik → renderuje inną zawartość. Brak odświeżenia strony (SPA).

**4.3.1 LLM Config** (`AdminLLMView`)
- Konfiguracja modelu LLM dla org: dostawca, model, parametry.
- Sprawdź że formularz ładuje dane. Zmień i zapisz — potwierdź żądanie w Network.

**4.3.2 Access & Limits** (`AccessLimitsTab`)
- Limity AI per użytkownik/org: max tokeny/dzień, max wywołania, whitelisted users.
- Sprawdź że tabela/formularz ładuje się. Zmień limit i zapisz — żądanie w Network.

**4.3.3 Policy & Governance** (`PolicyGovernanceTab`)
- Polityki zarządzania AI: review state, approval workflows, data sensitivity levels.
- Sprawdź że formularz ładuje i zapisuje. Żądanie PUT w Network przy zapisie.

**4.3.4 Models & Providers** (`ModelsProvidersTab`)
- Lista modeli i dostawców dla org: `organizationId` przekazywany do komponentu.
- Sprawdź listę dostępnych modeli. Toggle enabled/disabled dla modelu — żądanie w Network.

**4.3.5 Features & Privacy** (`FeaturesPrivacyTab`)
- Ustawienia prywatności AI: czy dane trafiają do modeli zewnętrznych, retention policy.
- Toggle feature flags per funkcja. Zapisz → żądanie w Network.

**4.3.6 Audit & Compliance** (`AuditComplianceTab`)
- Podsumowanie audytu AI: logi wywołań, compliance score.
- Sprawdź że dane się ładują. Brak crasha przy pustych danych.

**4.3.7 AI Health** (`AIMissionControl`)
- Stan zdrowia serwisu AI: latency, error rates, status dostawców.
- Dane real-time lub statyczne. Sprawdź brak crasha przy braku danych.

**4.3.8 Help Analytics** (`HelpAnalyticsDashboard`)
- Statystyki użycia helpdesk AI: najczęstsze pytania, oceny odpowiedzi.
- Sprawdź że wykres/tabela ładuje się lub wyświetla pusty stan.

**4.3.9 Tokens** (`TokenBillingManagementView`)
- Zarządzanie tokenami AI: saldo, historia zużycia, doładowania.
- AI Credit balance wyświetlony (lub „0" / brak przy braku danych).
- Sprawdź brak crasha.

---

## 5. Panel Security & Identity (`/admin/security`)

**Komponent:** `src/components/Admin/AdminSecurityIdentityPanel.tsx` → 6 pod-zakładek
**Endpointy:**
- `GET/PUT /admin/security` (alias `/admin/security/policy`) — polityka bezpieczeństwa
- `GET/PUT /admin/collaboration` — polityka współpracy
- `GET /api/admin/access-codes` (na `/admin/api-access` tab = `ApiKeysManagementView`)
- `GET/PUT /admin/iam/policy`, `GET/POST/DELETE /admin/iam/assignments` — delegowany IAM
- `GET /admin/identity/scim`, `POST/DELETE /admin/identity/scim/tokens`, `POST/DELETE /admin/identity/scim/group-mappings` — SCIM
- `GET /admin/risk/summary` — podsumowanie ryzyka

### 5.1 Nawigacja między zakładkami

- Wejdź na `/admin/security`.
- Domyślna zakładka: `policy` (Security policy).
- Klik każdej zakładki: policy → collaboration → api-access → iam → scim → risk.
- **URL param:** `?tab=<tabId>` aktualizuje się przy każdej zmianie (searchParams, `setSearchParams`).
- Wejdź bezpośrednio na `/admin/security?tab=scim` — otwiera się zakładka SCIM.
- Odśwież przy `?tab=iam` → zakładka IAM nadal aktywna.

### 5.2 Zakładka Security policy (`AdminSecurityPolicyPanel`) [DB]

- `GET /admin/security` → załadowanie polityki, status 200.
- Pola do zweryfikowania w UI (na podstawie backendu, handleGetSecurityPolicy):
  - Password policy (min length, complexity, expiry days)
  - Session timeout
  - MFA enforcement (mfaRequired: bool)
  - Login attempt limits
- Zmień dowolne ustawienie (np. włącz `mfaRequired=true`).
- Klik Save.
- **Network:** `PUT /admin/security` body z polami polityki, status 200.
- Odśwież → zmiana trwała. [DB]
- **Audit trail:** po zmianie polityki sprawdź Audit Log — wpis `update_security_policy` powinien pojawić się.

### 5.3 Zakładka Collaboration policy (`AdminCollaborationControlsPanel`) [DB]

- `GET /admin/collaboration` → załadowanie, status 200.
- Pola: `guestAccessEnabled`, `externalLinkSharing`, `toolApprovalRequired`.
- Toggle każdego z 3 ustawień i zapisz.
- **Network:** `PUT /admin/collaboration` body = `{guestAccessEnabled, externalLinkSharing, toolApprovalRequired}`, status 200.
- Odśwież → zmiany trwałe.
- **Audit trail:** wpis `update_collaboration_controls`.

### 5.4 Zakładka API access (`ApiKeysManagementView`)

- Wyświetla klucze API organizacji (z backendu — nie mock).
- Lista kluczy: nazwa, skrót klucza, data utworzenia, status (active/revoked).
- **Tworzenie klucza:** klik „Create API key" → formularz (nazwa, zakres) → zapisz → klucz wyświetlony jednorazowo → skopiuj.
- **Network:** żądanie POST do endpointu API keys, status 201.
- **Revoke:** klik revoke/delete przy kluczu → `DELETE` żądanie, status 200.
- Klucz znika z listy lub zmienia status.
- **Asercja bezpieczeństwa:** klucz pokazuje się w pełni tylko raz (przy tworzeniu). Przy ponownym wyświetleniu — tylko skrót (ostatnie 4-8 znaków). Brak raw secret w odpowiedzi GET.

### 5.5 Zakładka Delegated IAM (`AdminIamPolicyPanel`) [DB]

- `GET /admin/iam/policy` → załadowanie polityki IAM, status 200.
- Pola IAM policy: `delegatedRoles[]`, `accessReviewsEnabled`, `accessReviewCadenceDays`, `contextAwareAccessEnabled`, `privilegedSessionReauthMinutes`, `breakGlassEnabled`, `breakGlassApprovers[]`, `alertOnPrivilegedChange`.
- Zmień `accessReviewCadenceDays` z 90 na 30.
- **Network:** `PUT /admin/iam/policy` body z polem cadence, status 200.
- Lista przypisań: `GET /admin/iam/assignments`.
- Dodaj przypisanie roli delegowanej: `POST /admin/iam/assignments` → status 201.
- Usuń przypisanie: `DELETE /admin/iam/assignments/:id` → status 200.
- **Audit trail:** wpis `update_admin_iam_policy` / `assign_delegated_admin_role` / `revoke_delegated_admin_role`.

### 5.6 Zakładka SCIM & Lifecycle (`AdminScimLifecyclePanel`) [MANUAL] [DB]

- `GET /admin/identity/scim` → załadowanie podsumowania SCIM, status 200.
- Wyświetlone: czy SCIM aktywne, istniejące tokeny, mapowania grup.
- **Tworzenie tokenu SCIM:**
  - Podaj nazwę i opis, zaznacz scope (`users:read`, `users:write`).
  - Klik Create.
  - **Network:** `POST /admin/identity/scim/tokens` body = `{name, description, scopes}`, status 201.
  - Token wyświetlony jednorazowo (secret raw). Skopiuj — przy ponownym podglądzie tylko ID.
- **Usunięcie tokenu:** `DELETE /admin/identity/scim/tokens/:id`, status 200. Toast potwierdzenie.
- **Mapowanie grup:**
  - Dodaj mapowanie: `externalGroupName`, `externalGroupId`, `internalRole`.
  - **Network:** `POST /admin/identity/scim/group-mappings`, status 201.
  - Usuń mapowanie: `DELETE /admin/identity/scim/group-mappings/:id`, status 200.
- **[MANUAL]:** realna integracja SCIM z zewnętrznym dostawcą (Okta/Azure) poza zakresem dev — odnotuj że endpoint istnieje, ale E2E z realnym SCIM wymaga środowiska staging.

### 5.7 Zakładka Risk summary (`AdminRiskSummaryPanel`)

- `GET /admin/risk/summary` → załadowanie, status 200.
- Wyświetla risk score, aktywne zagrożenia, rekomendacje.
- Pusty stan (brak danych) → graceful empty state, brak crasha.
- Dane tylko do odczytu — brak akcji zapisu w tej zakładce.

---

## 6. Panel Audit Log (`/admin/audit`)

**Komponent:** `src/components/Admin/AdminAuditLogPanel.tsx`
**Endpointy:**
- `GET /admin/audit-logs?search=&actionType=&status=&riskScoreMin=&limit=100` — lista logów (max 100/request, łącznie max 1000 in-memory filter — L-04)
- `GET /admin/audit-logs/stats` — statystyki
- `GET /admin/audit-logs/export` → plik CSV
- `PUT /admin/compliance/data-retention` — retencja
- `GET /admin/compliance/summary` — podsumowanie compliance
- `GET /admin/risk/summary` — podsumowanie ryzyka

### 6.1 Ładowanie logów i statystyk

- Wejdź na `/admin/audit`.
- **Network** (wszystkie wywołania równolegle przy starcie, `Promise.all`):
  - `GET /admin/audit-logs?limit=100` — status 200, `{logs: [...], total: N}`
  - `GET /admin/audit-logs/stats` — status 200, `{totalLogs, unresolvedCount, highRiskCount}`
  - `GET /admin/risk/summary` — status 200
  - `GET /admin/compliance/summary` — status 200
- Wyświetlone 3 karty statystyk: total logs, unresolved, high-risk count.
- Tabela logów: kolumny id, admin, action_type, risk_score, risk_level, status, created_at.
- Pusty stan (brak logów) → graceful empty.
- **Znana luka L-04:** serwer robi `getLogs({limit:1000})` bez WHERE org → filtr in-memory. Sprawdź że logi wyświetlane należą do Twojej org (field `admin_id` lub inne — sprawdź matchesAuditFilter w kodzie).

### 6.2 Wyszukiwanie i filtrowanie

- Wpisz frazy w pole `search` — tabela filtruje wyniki (debounced? sprawdź opóźnienie).
- Sprawdź wyzwolenie nowego `GET /admin/audit-logs?search=<query>` w Network.
- Zmiany filtru triggerkują nowe żądanie (useCallback([search]) w AdminAuditLogPanel.tsx:25).

### 6.3 Eksport CSV

- Klik przycisk „Export" (ikona `Download`).
- Spinner `exporting=true` widoczny przez czas pobierania.
- **Network:** `GET /admin/audit-logs/export`, status 200, Content-Type `text/csv`.
- Plik pobierany na dysk: `admin-audit-<YYYY-MM-DD>.csv`.
- Otwórz CSV: sprawdź że nagłówki = `id,admin_id,action_type,risk_score,risk_level,status,created_at`.
- Dane w CSV odpowiadają logom widocznym w tabeli.
- **Błąd eksportu:** jeśli API zwróci błąd → toast „Failed to export audit logs", stan `exporting` wraca do false.

### 6.4 Ustawienie retencji logu [DB]

- Pole `retentionDays` (domyślnie 730 dni, z `complianceSummary.dataRetention.auditLogRetentionDays`).
- Zmień wartość (np. 365).
- Klik „Save retention".
- **Network:** `PUT /admin/compliance/data-retention` body = `{...complianceSummary.dataRetention, auditLogRetentionDays: 365}`, status 200.
- Toast sukces.
- Odśwież → wartość 365 dni widoczna (z `GET /admin/compliance/summary`).

### 6.5 Weryfikacja audit trail per panel (przekrojowe)

Po wykonaniu wcześniejszych testów (Team/Billing/AI/Security) wejdź do Audit Log i sprawdź:
- Wpisy `add_admin_people_member` / `generate_tenant_access_code` (z §2)
- Wpisy `update_billing` / `add_billing_payment_method` (z §3)
- Wpisy `update_admin_iam_policy` / `create_scim_token` (z §5)
- Każdy wpis ma `admin_id` = ID aktualnego admina.
- **Asercja organizacji:** brak wpisów z innych organizacji (luka L-04 in-memory, ale podstawowa weryfikacja).

---

## 7. Martwy kod — weryfikacja izolacji [FLAG]

> **Cel:** potwierdzić że wymienione komponenty NIE są renderowane w ścieżce org-admin (`/admin/*`), nie powodują błędów konsoli ani nie importują się przez live komponenty panelu.

### 7.1 Kluczowy martwy kod do weryfikacji

| Komponent | Plik | Status |
|---|---|---|
| `AdminSidebar` (layout) | `src/components/layout/AdminSidebar.tsx` | **MARTWY** — 0 importów w live (tylko `AdminLayout.tsx` + `components/Admin/index.ts` = eksport bez konsumenta) |
| `AdminLayout` | `src/components/Admin/AdminLayout.tsx` | **POTENCJALNIE MARTWY** — sprawdź czy eksportowany z `index.ts` ale nie używany |
| `AuditExportPanel` | `src/components/Admin/AuditExportPanel.tsx` | **MARTWY** w org-admin (jest AuditLogViewer w AI settings, inny) |
| `AuditLogViewer` (Admin/) | `src/components/Admin/AuditLogViewer.tsx` | Reeksportowany z `src/components/AISettings/index.ts` — sprawdź czy używany |
| `AdminEnterpriseOverviewPanel` | `src/components/Admin/AdminEnterpriseOverviewPanel.tsx` | MARTWY w org-admin |
| `AdminInitiativeCreatorPanel` | `src/components/Admin/AdminInitiativeCreatorPanel.tsx` | MARTWY |
| `AdminInitiativeTemplatesPanel` | `src/components/Admin/AdminInitiativeTemplatesPanel.tsx` | MARTWY |
| `AdminOrganizationOperationsPanel` | `src/components/Admin/AdminOrganizationOperationsPanel.tsx` | MARTWY |
| `UnifiedSyncHub` | `src/components/Admin/UnifiedSyncHub.tsx` | MARTWY |
| `ComplianceDashboard` | `src/components/Admin/ComplianceDashboard.tsx` | MARTWY |
| `DataGovernancePanel` | `src/components/Admin/DataGovernancePanel.tsx` | MARTWY |
| `IntegrationsManagementPanel` | `src/components/Admin/IntegrationsManagementPanel.tsx` | MARTWY |
| `SecuritySettings` (Admin/) | `src/components/Admin/SecuritySettings.tsx` | MARTWY (nie mylić z `AdminSecurityIdentityPanel`) |
| `ABTestingDashboard` | `src/components/Admin/ABTestingDashboard.tsx` | **ŻYWY** — używany w SuperAdmin `AIPlatformModule` |
| `V8AdminDiagnosticsPanel` | `src/components/Admin/V8AdminDiagnosticsPanel.tsx` | **ŻYWY** — używany w SuperAdmin |
| `ChatV9Flags*` | `src/components/Admin/ChatV9Flags*.tsx` | **ŻYWY** — importowany w `App.tsx` globalnie |

### 7.2 Test: brak renderowania martwego kodu w `/admin/*`

- Otwórz DevTools → React DevTools (Components tree).
- Przejdź przez wszystkie 5 paneli (`/admin/people`, `/admin/billing`, `/admin/ai`, `/admin/security`, `/admin/audit`).
- **Asercja:** żaden z komponentów z listy „MARTWY" powyżej NIE pojawia się w React tree dla ścieżki `/admin/*`.
- **Console:** zero błędów `Cannot find module` ani `is not a function` związanych z Admin/*.

### 7.3 Grep-check martwego kodu [MANUAL]

Wykonaj w terminalu z repo:
```bash
grep -rn "AdminSidebar" src/ --include="*.tsx" --include="*.ts" | grep "import\|from"
```
**Oczekiwany wynik:** `AdminLayout.tsx` importuje z `../layout/AdminSidebar` + `index.ts` reeksportuje. Sprawdź że `AdminLayout` sam nie jest importowany przez żaden live komponent.

```bash
grep -rn "AuditExportPanel\|ComplianceDashboard\|DataGovernancePanel\|IntegrationsManagementPanel" src/ --include="*.tsx" | grep "import"
```
**Oczekiwany wynik:** brak importów w live komponentach (lub tylko w plikach superadmin/index).

### 7.4 Brak efektów bocznych martwego kodu

- Przy załadowaniu `/admin` sprawdź Network: brak nieoczekiwanych żądań do endpointów martwych komponentów (np. brak `/api/admin/legacy/*` czy podobnych).
- Console: zero warnów `Warning: React.createElement: type is invalid` (wskazywałoby na import martwego komponentu).

---

## 8. Ścieżki cross-modułowe

### 8.1 M24 → M27 SuperAdmin (granica)

- Jako ADMIN (nie SUPERADMIN) wejdź na `/admin` → panel org-admin.
- Wejdź bezpośrednio na `/superadmin` → `ProtectedRoute requiredRole="SUPERADMIN"` → redirect do `/dashboard`.
- **Asercja:** admin org NIE ma dostępu do `/superadmin/*`. Granica wyraźna.
- Odwrotnie: SUPERADMIN na `/admin` → redirect do `/superadmin` (§1.3).

### 8.2 M24 → M23 Organizacja (granica)

- Z panelu Team (`/admin/people`) sprawdź czy istnieje link/CTA do zarządzania organizacją (`/organization/*`).
- Upewnij się że aliasy URL `/admin/organization` i `/admin/workspace` redirectują do sekcji `people` w AdminSettingsModule (SECTION_ALIASES), NIE do `/organization/*` (M23).
- Wejdź na `/admin/organization` → URL resolves do people panel (`resolveAdminState` zwraca `people`).

### 8.3 M24 vs M25 Ustawienia — billing

- Wejdź na `/settings/billing` (M25).
- **Asercja (znana pułapka):** `AppView.SETTINGS_BILLING` mapuje na `/settings/billing` ale sekcja NIE istnieje → „Section not found" lub redirect. Billing NIE jest w Settings.
- Billing żyje wyłącznie w `/admin/billing` (M24) i M23 Organizacja. Odnotuj w raporcie.

---

## 9. Mapa epików → sekcje testowe

| Epik (M24-admin.md) | Story | Sekcja testowa |
|---|---|---|
| **EPIK 1** P0 cross-org naprawione + testy regresji IDOR | S1.1 (cross-org people), S1.2 (escalation), S1.3 (cross-org ai-settings) | §1.6, §1.7 |
| **EPIK 2** Audit szczelny org-scoped | S2.1 (logi >1000, brak utraty) | §6.1 |
| **EPIK 3** Higiena BE (role middleware, /debug-memberships, PCI) | S3.1 (route-level role) | §1.6, §5.4 |
| **EPIK 4** Czystość kodu (martwy FE, inline error) | S4.1 (AdminSidebar + Admin/ resztki) | §7.1–7.4 |
| **EPIK 5** Szlif (§27 tabele, i18n, E2E RBAC) | S5.1 (tabele), S5.2 (i18n), S5.3 (RBAC-by-role) | §10 przekrojowe |
| **EPIK 6** Billing honest (DP-11 label managed) | S6.1 (CTA upgrade → label managed) | §3.3 |

---

## 10. Testy przekrojowe

### 10.1 Persystencja danych

Po KAŻDEJ akcji zapisu (Team/Billing/AI/Security/Audit):
- Odśwież stronę (`F5`).
- Sprawdź że zmiana jest widoczna — weryfikacja że API record trwał, nie tylko React state.
- Błąd persystencji = FAIL testu.

### 10.2 i18n (PL/EN)

- Zmień język aplikacji na polski (jeśli opcja dostępna w Settings).
- Sprawdź że tytuły paneli (`Team & Access` / `Billing & Plans` / `AI Controls` / `Security & Identity` / `Audit Log`) są przetłumaczone lub fallback EN.
- Sprawdź że `adminBillingFinOpsPanel` używa `t()` (24× per karta) — sprawdź wizualnie czy brak hardcodowanego EN przy PL.
- **Znana luka L-06:** security/audit/scim/members mają hardkodowany EN — odnotuj w raporcie (P2, faza 4).

### 10.3 Dark mode

- Przełącz na dark mode (Settings → Theme).
- Przejdź przez wszystkie 5 paneli.
- Sprawdź: karty Admin (np. Summary/Governance) używają `dark:border-white/10 dark:bg-white/5 dark:text-white` — treść czytelna, brak białych ekranów.
- Tabele (`<table>` — 10 surowych, L-05 otwarte) — sprawdź czytelność w dark mode.

### 10.4 A11y (dostępność)

- Nawigacja klawiaturą (Tab) przez sidebar Admin i między panelami.
- Przyciski i linki mają dostępne etykiety (`aria-label` lub widoczny tekst).
- Modalne dialogi (np. potwierdzenie usunięcia) mają focus trap.
- Kolory tekstu spełniają minimalny kontrast WCAG AA (dotyczy głównie kart summary).

### 10.5 Błędy konsoli

- Po przejściu przez WSZYSTKIE 5 paneli + testy gating: Console ma zawierać **zero** czerwonych błędów.
- Wyjątek akceptowany: `console.warn [ProtectedRoute]` przy teście gating (§1.2) — to celowe ostrzeżenie.
- Brak `Warning: Each child in a list should have a unique "key"` w tabelach.

### 10.6 Responsywność Desktop

- Testuj w oknie ≥ 1280px (panel admin wymaga desktop — DesktopOnlyGuard).
- Sidebar AdminSettings powinien być widoczny i nie nakładać się na treść.
- Na ekranach 1024–1280px sprawdź czy layout nie łamie się (mobile menu `Menu/X` w AdminSettingsModule).

### 10.7 Mobile guard [MANUAL]

- DevTools → responsive ≤ 767px lub realne urządzenie.
- `/admin` → `DesktopOnlyGuard` blokuje dostęp z komunikatem.
- Brak renderowania żadnego z 5 paneli na mobile.

---

## 11. Testy regresji / istniejące testy jednostkowe

Uruchom poniższe testy przed reportowaniem wyników:

```bash
# Testy jednostkowe paneli Admin
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
npx vitest run src/components/Admin/__tests__/AdminBillingFinOpsPanel.test.tsx
npx vitest run src/components/Admin/__tests__/AdminMembersRolesPanel.test.tsx
npx vitest run src/views/admin/__tests__/AdminSettingsModule.test.tsx

# Testy backendowe adminP32
npx vitest run server/src/routes/__tests__/adminP32.routes.test.ts
npx vitest run server/src/routes/__tests__/adminIntegrations.routes.test.ts
```

**Oczekiwany wynik:** 100% PASS. Każdy FAIL to blokada przed merżem.

Sprawdź czy istnieją testy RBAC E2E (`cross-org IDOR`, `escalation`) w `server/src/routes/__tests__/adminP32.routes.test.ts` — jeśli brak, odnotuj jako **L-03 otwarte** (brak testów regresji P0).

---

## 12. Format raportu

Dla każdego testu podaj:

```
§<sekcja>.<podsekcja> — <krótki opis>
Status: PASS | FAIL | SKIP
Dowód: [screenshot_url | network_payload_snippet | DB_row | N/A]
Uwagi: <opcjonalnie — edge case, odchylenie od spec, znana luka>
```

**Przykład (PASS):**
```
§2.2 — Zaproszenie po e-mailu
Status: PASS
Dowód: POST /api/organizations/org-abc/members → 201 {member: {id: "...", role: "MEMBER"}}
Uwagi: Toast "Member added" pojawił się. Tabela odświeżona. Persystencja OK po F5.
```

**Przykład (FAIL):**
```
§6.4 — Retencja logu
Status: FAIL
Dowód: PUT /admin/compliance/data-retention → 500 Internal Server Error
Uwagi: Serwer zwrócił 500. Toast błędu widoczny. Po F5 wartość nie zmieniona. Bug do zgłoszenia.
```

---

## 13. Definition of Done (DoD)

Test M24 jest **zakończony (DONE)** gdy wszystkie poniższe warunki są spełnione:

| # | Kryterium | Sposób weryfikacji |
|---|-----------|-------------------|
| 1 | Wszystkie sekcje §1–§7 + §10 wykonane | Raport z statusem per test |
| 2 | ZERO P0/P1 FAIL (blokery) | Brak błędów krytycznych: gating, cross-org, crashi |
| 3 | Gating ADMIN działa (§1.1–1.5) | Ścieżka MEMBER/GUEST/SUPERADMIN = redirect, nie panel |
| 4 | P0 cross-org regresia potwierdzona (§1.6) | 403 ADMIN_BOUNDARY_VIOLATION na orgB endpoints |
| 5 | 5 paneli ładuje się bez crasha | Wszystkie 5 otwierają się, brak białych ekranów |
| 6 | Przynajmniej 1 akcja zapisu per panel E2E | Żądanie Network potwierdzone, persystencja po F5 |
| 7 | Eksport CSV działa (§6.3) | Plik pobrany, nagłówki OK |
| 8 | Martwy kod NIE renderuje się w /admin/* (§7) | React tree i Console czyste |
| 9 | Zero czerwonych błędów konsoli | DevTools Console w każdym panelu |
| 10 | DP-11 Billing: brak formularza karty gdy Stripe OFF (§3.3) | Brak Stripe Elements UI przy VITE_STRIPE_ENABLED=false |
| 11 | Testy jednostkowe PASS (§11) | `vitest run` — 100% green |

**Znane otwarte luki (NIE blokują DoD jeśli odnotowane w raporcie):**
- L-03: brak testów regresji IDOR/escalation w test suite — odnotuj
- L-04: audit-logs SELECT globalny (in-memory filter, cap 1000) — odnotuj
- L-05: tabele surowe `<table>` (10 trafień, §27 niezastosowany) — odnotuj
- L-06: i18n hardkod EN w security/audit/scim/members — odnotuj
- L-07: members bez route-level role middleware w organizations.routes.ts — odnotuj
- L-08: martwy kod FE (AdminSidebar + resztki) — odnotuj (D-02 modułowa)
- L-09: CI nie obejmuje branch Londyn dla E2E admin — odnotuj
