# M25 — Ustawienia (Settings) — FAZA 2: Testy automatyczne

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` · **SHA (HEAD, drzewo brudne):** `809ba27152`
**Runner FE:** vitest 4.1.8 (`npx vitest run`, `--reporter=dot --maxWorkers=1`) · **BE:** vitest (`server/`, `vitest run`)
**Pełny log:** `evidence/f2_tests.log`

> Uwaga metodologiczna: M25 = front użytkownika `src/views/SettingsView.tsx` + `src/components/settings/**`
> (profil, powiadomienia, bezpieczeństwo/auth, integracje/kalendarz, GDPR/data-controls, AI settings, theme/język).
> Świadomie WYŁĄCZONO z zakresu: panele org-admin (`AdminSettingsModule`, `OrganizationSettings`, `Company/Fiscal/DataHosting`),
> superadmin (`SystemSettings`, `FeatureFlagsPanel`, `SecurityPoliciesPanel`) oraz landing/CTA-authority — to M24/M27.

---

## 1. INWENTARZ testów Settings

### Pliki "duch" (NIE-zbierane przez runner — stale artefakty)
Pliki z datą Jan 21, rozszerzenie `.test`/`.spec` **bez** `.ts/.tsx/.js` (vitest/playwright zbierają tylko `*.{test,spec}.{js,ts,jsx,tsx}`):
`tests/e2e/settings.spec`, `tests/e2e/settingsFlow.test`, `tests/e2e/ai-settings-flow.spec`,
`tests/e2e/settings-profile-extended.spec`, `tests/unit/settingsComponents.test`,
`tests/unit/backend/aiSettingsService.test`, oraz duble `*.test` obok kanonicznych `*.test.tsx`
(SecuritySettings, PrivacySettings, OrganizationSettings, DataPrivacySettings).
→ Martwy kod testowy. Plus pusty katalog `tests/unit/views/settings 2/` i ~120 plików `mfa-*.test.db` (artefakty SQLite, nie testy) w `tests/unit/backend/services/`.

### Grupa A — FE smoke (kolokowane) `src/components/settings/__tests__/`
| Plik | Zakres | Liczba |
|---|---|---|
| ProfileSettings.smoke | zapis imienia przez Api.updateUser | 1 |
| APIAccessSettings.smoke | rotacja klucza API | 1 |
| DataControlsSettings.smoke | data controls render/akcje | 2 |
| PushNotificationsSettings.smoke | push toggle | 3 |
| RecoveryOptionsSettings.smoke | opcje odzyskiwania | 2 |

### Grupa B — FE component `tests/components/settings/` (kanoniczne .tsx — 20 plików, ~43 testy)
Profil/visibility/bio: ProfileVisibilitySettings(2), BioAboutSection(2), OrganizationContextOverview(2).
Powiadomienia: NotificationsModule.taxonomy(1), QuietHoursSettings(2), EmailDigestSettings.persistence(1).
Bezpieczeństwo/prywatność: SecuritySettings(3), PrivacySettings(2), DataPrivacySettings(2).
Integracje: IntegrationSettings.sync-readback(4), LegacyAliasConnectContinuity(2).
API/klucze: APIAccessSettings.persistence(2). AI: AIPromptLibrarySettings.persistence(1).
Preferencje: WorkPreferencesSettings(2), KeyboardShortcutsSettings(2), SettingsExportImport.persistence(2),
SettingsOwnershipPanels(3), SettingsTaxonomyPanel(1), BillingSettings(3), OrganizationSettings(2).

### Grupa C — FE unit "honesty family" `tests/unit/components/settings/` (54 pliki, ~120 testów)
Rodzina testów "honest UI" (read-back po zapisie, brak fałszywego success, brak udawania pustki przy błędzie) —
po jednym pliku na niemal każdy komponent settings. Najwięcej asercji: ProfileSettings.honesty(12),
AIMemorySettings.honesty(6), APIAccessSettings.honesty(4), CalendarSyncSettings.honesty(3),
SessionsActivitySettings.honesty(3), AIModelParametersSettings.honesty(3), AIPrivacySettings.honesty(3),
ChatHistorySettings.export(3), CloudDataSettings.honesty(3), IntegrationHealthDashboard.honesty(3),
VoiceSettingsPanel.honesty(3), WebhooksSettings.honesty(3), EmailSignaturesSettings.honesty(3),
RegionalSettings.honesty(3). Pozostałe 1–2 testy/plik.

### Grupa D — FE unit views/services/i18n + backend-js
| Plik | Zakres | Liczba |
|---|---|---|
| tests/unit/settings/sync-entry-resolver | rozwiązywanie wejść sync | 3 |
| tests/unit/views/settings/syncEntryResolver | dual (kopia) | 3 |
| tests/unit/views/settings/AIPreferencesModule.memory | AI memory (modul) | 1 |
| tests/unit/views/settings/AIPreferencesModule.history | AI history (modul) | 1 |
| tests/unit/i18n/settings-required-keys | klucze i18n obecne | 1 |
| tests/unit/services/settings-api-keys | serwis klucze API | 1 |
| tests/unit/services/settings-preferences-api | serwis preferencje | 1 |
| tests/unit/backend/settingsService.test.js | serwis settings (logika) | 12 |
| tests/unit/backend/routes/settings.routes.test.js | trasy settings (jednostkowo) | 13 |
| tests/unit/backend/routes/ai-settings.routes.superadmin-acl | ACL ai-settings | 1 |

### Grupa E — integracyjne (PG) `tests/integration/`
| Plik | Zakres | Liczba |
|---|---|---|
| settings/gdpr-settings-no-stubs | export-data + **request-deletion** + data-export (no-stub) | 3 |
| settings/sessions.routes | sesje (lista/rewoke) — S3 | 3 |
| settings/login-history.routes | historia logowań — S3 | 4 |
| settings/ai-memory.routes | AI memory CRUD — S6 | 5 |
| settings/settings-ai-memory-preferences | AI memory+preferencje — S6 | 6 |
| settings/settings-regional-preferences | regional/język — S7 | 4 |
| settingsAPI | settings API ogólne | 2 |
| ai-settings-api | AI settings API — S6 | 5 |
| routes/settings.test.js | trasy settings | 3 |
| routes/notification-settings.l3 | powiadomienia (L3) — S2 | 18 |
| routes/ai-memory.test.js | ai-memory | 2 |
| routes/aiSettings.superadmin.unavailable.no-placeholders | brak placeholderów | 1 |
| routes/settings-admin-superadmin.p31-33 | (admin/superadmin — poza M25) | 79 |

### Grupa F — server/src `__tests__`
| Plik | Zakres | Liczba |
|---|---|---|
| routes/settings.routes.test.ts | trasy settings (serwer) | 24 |
| routes/aiSettingsFallback | fallback AI settings — S6 | 4 |
| routes/integrations.routes | integracje — S4 | 3 |
| routes/adminIntegrations.routes | integracje admin | 3 |
| routes/security/roles.routes | RBAC role (peryferyjne, M24) | 7 |
| services/v8/featureFlagService | feature flags | 36 |
| services/integrationOwnershipService | własność integracji | 1 |

### S5/S3 — krytyczne ścieżki bezpieczeństwa (auth bcrypt): pliki dedykowane
MFA: `tests/components/auth/MFAChallenge.test.tsx`, `MFASetup.test.tsx`, `tests/integration/routes/mfa.test.js`,
`server` `mfaService.test.ts/.js`, `tests/e2e/auth/login-mfa.spec.ts`.
GDPR: `tests/unit/backend/gdprService.test.js`, `services/gdprComplianceService.test.ts`,
`tests/integration/routes/gdpr.fail-closed.contract.test.ts`, e2e `data-export.spec.ts`,
`deploy-gate-api-gdpr-compliance-security-policies.spec.ts`.
> Te pliki to głównie warstwa MFA/superadmin/compliance — **NIE** pokrywają user-facing flow z `DataControlsSettings` (patrz luka S5).

---

## 2. URUCHOMIENIE — wyniki (PASS/FAIL/SKIP)

| RUN | Zakres | PASS | FAIL | SKIP | Czas |
|---|---|---|---|---|---|
| 1 | FE component (Grupy A+B) | 44 | 6 | 0 | 12 s |
| 2 | FE unit honesty + views (Grupy C+D-views) | 94 | 36 | 0 | 34 s |
| 3 | FE services + i18n + backend-js (Grupa D reszta) | 33 | 0 | 0 | 4 s |
| 4 | Integracyjne PG (Grupa E, bez p31-33) | 38 | 0\* | 18 | 19 s |
| 5 | server/src routes (Grupa F bez featureFlag) | 41 | 1 | 0 | 2 s |
| 6 | featureFlagService | 36 | 0 | 0 | <1 s |
| **RAZEM** | | **286** | **43** | **18** | ~71 s |

\* RUN4: 0 awarii asercji, ale **1 plik nie został zebrany** — `tests/integration/routes/notification-settings.l3.test.ts` padł na poziomie połączenia z PG: `error 28000 / role "iris" does not exist` (test oczekuje lokalnego efemerycznego Postgresa z rolą `iris`, której nie ma w tym środowisku). 18 SKIP pochodzi z conditional-guards w tym samym obszarze (testy włączane tylko przy realnym lokalnym DB).

### Root-cause awarii (3 systemowe + 2 peryferyjne)

**RC-1 (DOMINUJĄCY, ~34 z 43 FAIL) — mock-drift react-i18next: `t(key, {defaultValue})`.**
Komponenty settings przeszły na i18next-owy zapis `t('klucz', { defaultValue: 'tekst' })`, ale mocki testowe wciąż mają
`t: (_key, fallback) => fallback` → mock zwraca **obiekt opcji** zamiast stringa →
`Error: Objects are not valid as a React child (found: object with keys {defaultValue})`.
Dotyka całej rodziny honesty: CalendarSyncSettings, IntegrationHealthDashboard, WorkingHoursSettings,
BillingSubscriptionModule, MappingDriftPanel, DashboardPreferencesSettings, APIAccessSettings, RegionalSettings,
SettingsHistory, SettingsOwnershipPanels, ConnectedAppsSettings i in.
Wariant: `SettingsTaxonomyPanel.test.tsx` — mock daje tylko `{ i18n }`, **bez `t`** → `TypeError: t is not a function`.
Fix systemowy: `t: (k, opt) => (typeof opt === 'string' ? opt : opt?.defaultValue ?? k)` w shared test-utils i18n.

**RC-2 (~14 FAIL: ProfileSettings.honesty 12 + ProfileSettings.smoke 2) — brak Router w render.**
`ProfileSettings.tsx:294` wprowadziło `const navigate = useNavigate();`. Testy renderują komponent **bez** `<MemoryRouter>` →
`Error: useNavigate() may be used only in the context of a <Router> component`. Czysty mock-drift po dodaniu nawigacji do produktu;
test-harness nieuaktualniony. (To NIE jest bug produktu, tylko nieaktualny test.)

**RC-3 (2 FAIL) — stale import po przeniesieniu modułu (wzorzec M13/M14).**
`tests/unit/views/settings/AIPreferencesModule.{memory,history}.test.tsx` importują
`@/views/settings/AIPreferencesModule` — **plik nie istnieje** w repo (zniknął/zmienił nazwę).
`Failed to resolve import "@/views/settings/AIPreferencesModule". Does the file exist?` → testy-duchy do usunięcia lub przepięcia.

**RC-4 (2 FAIL) — assertion-drift.** `AIUsageDashboard.honesty` szuka tekstu `0 / 0 tokens`, którego komponent już nie renderuje.

**RC-5 (1 FAIL, peryferyjne/M24) — walidacja RBAC.** `server` `roles.routes`: POST z `label`+`capabilities` alias i
duplikatem capability zwraca **400 zamiast 200** — trasa albo odrzuca duplikaty, albo porzuciła alias `label/capabilities`.
Obszar ról (M24), nie M25.

---

## 3. MAPA POKRYCIA scenariuszy krytycznych S1–S7

| # | Scenariusz | FE | BE | E2E | PR-gate? | Luka |
|---|---|---|---|---|---|---|
| **S1** | Profile edit→save→reload (trwałość) | ✅ honesty (read-back getMe), smoke (updateUser) — **ALE czerwone (RC-2 brak Router)** | △ settingsService/settings.routes (jednostkowo, częściowo) | ❌ (tylko duch `settings-profile-extended.spec`) | ❌ | Testy FE realne, ale **nie przechodzą** (Router); brak prawdziwego E2E save→reload |
| **S2** | Notifications toggle→persist | ✅ NotificationsModule.taxonomy, PushNotifications.smoke, NotificationSettings.honesty | ✅ notification-settings.l3 (18) — **ale plik nie zebrany w tym env (PG role iris)** | ❌ | ❌ | BE zielony tylko na realnym lokalnym PG; w CI default-branch w ogóle nie biegnie |
| **S3** | Security: hasło / MFA / sesje | △ SecuritySettings, AuthenticationAccessPage, SessionsActivity, PasswordSecurity (honesty, render) | ✅ sessions.routes(3), login-history(4); MFA: mfaService + mfa.routes (poza-M25) | △ login-mfa.spec (e2e) | ❌ | **Zmiana hasła user-facing z settings — brak dedykowanego testu trasy zmiany hasła**; MFA testowane głównie w superadmin/auth |
| **S4** | Integrations: Calendar connect/disconnect | △ CalendarSyncSettings.honesty — **czerwone (RC-1) + w pełni mockuje Api (pułapka: walidacja renderu, nie zachowanie)**; IntegrationSettings.sync-readback✅ | ✅ integrations.routes(3), integrationOwnershipService | ❌ | ❌ | Connect/disconnect kalendarza: brak testu zachowania (real connect→read-back→disconnect) |
| **S5** | GDPR: eksport + usunięcie konta z weryfikacją hasła (klient+serwer bcrypt) | △ DataControlsSettings.honesty/smoke (render); FE realnie woła `Api.requestGdprDeletion(password)` → `/api/settings/gdpr/deletion-request` | ✅ eksport+żądanie: gdpr-settings-no-stubs(3) — **ALE testuje LEGACY trasę `request-deletion` BEZ hasła** | △ deploy-gate-gdpr (ogólny) | ❌ | **KRYTYCZNA: trasa z realną weryfikacją bcrypt (`settings.routes.ts:2995`) NIE MA testu.** Test integracyjny pokrywa inną, bezhasłową trasę-duplikat |
| **S6** | AI settings (behavior/model/memory) save→trwałość | ✅ AIBehavior/AIModelParameters/AIMemory.honesty, AISettings.test | ✅ ai-memory.routes(5), settings-ai-memory-preferences(6), ai-settings-api(5), aiSettingsFallback(4) — **zielone** | ❌ (duch `ai-settings-flow.spec`) | ❌ | Najlepiej pokryty obszar BE; brak E2E |
| **S7** | Theme/Language → persist + efekt | ✅ ThemeSettings.honesty, LanguageSettings.honesty, RegionalSettings.honesty (RC-1 czerwone), settings-required-keys✅ | ✅ settings-regional-preferences(4) | ❌ | ❌ | RegionalSettings.honesty czerwone (RC-1); brak testu realnego efektu zmiany języka na UI |

Legenda: ✅ jest i zielone · △ jest częściowe/render-only/czerwone · ❌ brak.

### PR-gate — co realnie gate'uje (KLUCZOWE)
- Default/main branch repo = **`Londyn`**. `test-suite.yml` ma `pull_request: branches: [main, develop]` →
  **PR do `Londyn` NIE uruchamia żadnego suite testowego.** Zmiany M25 na `feat/*` mergowane do `Londyn` = **zero bramki automatycznej**.
- `i18n-check.yml`: PR dowolny branch, ale tylko gdy zmienia się `public/locales/en/**` lub `scripts/i18n/**`, do tego `continue-on-error: true` → **nie gate'uje**.
- `e2e-nightly`/`e2e-weekly`/`security-scan`/`module-contract-rerun`: tylko cron/`workflow_dispatch` — **nie na PR**.
- `railway-deploy`: tylko `push` do `develop`.
**Wniosek:** w obecnej konfiguracji żaden test settings nie jest PR-gate na aktywnej gałęzi integracyjnej. Kolumna „PR-gate?" = ❌ dla wszystkich S1–S7.

---

## 4. PUŁAPKI (testy mylące — zielone ≠ pokrycie zachowania)

1. **Rodzina honesty mockuje cały `Api` serwisu** (np. CalendarSyncSettings: `vi.mock('@/services/api')` z `connectCalendar`/`disconnectCalendar` jako `vi.fn()`).
   To testy **walidacji renderu/stanu UI**, nie zachowania end-to-end — żadne realne wywołanie HTTP/DB nie jest weryfikowane. Dają złudzenie pokrycia S4/S1.
2. **`gdpr-settings-no-stubs` celuje w bezhasłową trasę-duplikat `request-deletion`**, podczas gdy produkt (FE) używa
   `/api/settings/gdpr/deletion-request` z bcrypt. Test zielony, a krytyczna ścieżka bezpieczeństwa (S5) — niepokryta. Klasyczna pułapka „test sąsiada".
3. **Walidacja po stronie klienta udaje zabezpieczenie**: `DataControlsSettings.tsx:368` wymaga hasła zanim wyśle żądanie,
   ale istnieją **2 trasy-duplikaty serwera** (`settings.routes.ts:2635 request-deletion`, `gdpr.routes.ts:534 deletion-request`),
   które **kasują/planują usunięcie BEZ weryfikacji hasła** (czytają tylko `req.user.id` / `reason`). Jeśli ktokolwiek przepnie FE
   lub uderzy bezpośrednio w te trasy — usunięcie konta bez hasła. Żaden test tego nie pilnuje. (Finding bezpieczeństwa do Fazy 6.)
4. **18 SKIP w integracji** to ścieżki za guardem „realny lokalny PG" — w CI/default-branch faktycznie nie biegną (ścieżka za flagą OFF de facto).

---

## 5. BACKLOG testowy (typ · plik docelowy · scenariusz · priorytet)

**P0 — bezpieczeństwo krytyczne**
1. [P0] integration — `tests/integration/settings/gdpr-deletion-password.test.ts` — **S5**: `POST /api/settings/gdpr/deletion-request`
   z poprawnym hasłem → 200+scheduled; ze złym hasłem → 403 (`bcrypt.compareSync`); bez hasła → 400; duplikat → 400. (Obecnie 0 pokrycia trasy z bcrypt.)
2. [P0] integration — `tests/integration/settings/account-deletion-routes-guard.test.ts` — **S5**: udowodnij, że trasy-duplikaty bez hasła
   (`request-deletion`, `gdpr/deletion-request` z gdpr.routes) albo wymagają hasła, albo są usunięte/wyłączone (regresja na bypass).
3. [P0] integration — `tests/integration/settings/change-password.test.ts` — **S3**: zmiana hasła user-facing (stare hasło bcrypt-verify,
   polityka siły, unieważnienie sesji). Dziś brak dedykowanego testu trasy zmiany hasła z poziomu Settings.

**P1 — domknięcie scenariuszy + naprawa czerwieni**
4. [P1] fix test-util — `tests/utils/i18nMock.ts` (lub wspólny setup) — **RC-1**: `t: (k, opt) => typeof opt==='string'?opt:opt?.defaultValue??k`;
   przepiąć całą rodzinę honesty → zielone (~34 FAIL znika).
5. [P1] fix — `tests/unit/components/settings/ProfileSettings.honesty.test.tsx` + `src/.../ProfileSettings.smoke.test.tsx` — **RC-2**:
   owinąć render w `<MemoryRouter>` (lub mock `useNavigate`). Odblokowuje S1.
6. [P1] cleanup — `tests/unit/views/settings/AIPreferencesModule.{memory,history}.test.tsx` — **RC-3**: usunąć lub przepiąć na realny moduł AI-preferences (`@/views/settings/AIPreferencesModule` nie istnieje).
7. [P1] integration/e2e — `tests/integration/settings/calendar-sync-connect-disconnect.test.ts` — **S4**: realny connect→read-back połączony→disconnect→read-back rozłączony (nie mock Api).
8. [P1] e2e — `tests/e2e/settings.spec.ts` (odbudowa z pliku-ducha) — **S1/S7**: profile save→reload trwałość; zmiana języka→efekt na UI po reloadzie.

**P2 — higiena**
9. [P2] fix — `tests/unit/components/settings/AIUsageDashboard.honesty.test.tsx` — **RC-4**: zaktualizować asercję do realnego renderu zużycia.
10. [P2] env — `tests/integration/routes/notification-settings.l3.test.ts` — **S2**: dodać guard/skip-if-no-PG lub udokumentować rolę `iris` w setupie, żeby plik nie wybuchał `28000`.
11. [P2] cleanup — usunąć pliki-duchy (`*.test`/`*.spec` bez rozszerzenia ts/tsx, `tests/unit/settingsComponents.test`, dub `tests/unit/views/settings 2/`, artefakty `mfa-*.test.db`).
12. [P2] CI — `.github/workflows/test-suite.yml` — dodać `Londyn` do `pull_request.branches` (albo ustanowić gate dla aktywnej gałęzi integracyjnej), inaczej żaden test settings nie chroni PR-ów.

---

## Werdykt FAZY 2 (jednym akapitem)
Settings ma **bardzo szeroki inwentarz** (~330 zebranych testów w zakresie M25), ale dwie trzecie awarii to **jeden systemowy
mock-drift i18n** (`t(key,{defaultValue})`) plus brak `<Router>` w ProfileSettings — czyli **harness, nie produkt**. Backend AI-settings
i regional są realnie zielone. Trzy luki są jednak poważne: (1) **krytyczna ścieżka S5 — usunięcie konta z weryfikacją bcrypt — nie ma
żadnego testu** (istniejący test celuje w bezhasłową trasę-duplikat), (2) **zmiana hasła z Settings (S3) bez dedykowanego testu**,
(3) **żaden test settings nie jest PR-gate na gałęzi `Londyn`**. Do tego pułapka bezpieczeństwa: istnieją serwerowe trasy-duplikaty
kasujące konto bez hasła — niepilnowane testem.
