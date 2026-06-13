# WP M25 — Ustawienia (Settings) · dokończenie do 100%

**Pula:** core · **Karta:** `Harvard/modules/M25-ustawienia/KARTA_AUDYTU.md` (ocena 54/100) · **Rozmiar:** S (najzdrowszy core) · **Żywy bloker:** brak P0 (1×P1 read-IDOR)
**Faza programu:** FAZA 2/3 (core, najzdrowszy) → FAZA 4 (sweepy: 2237 hardkodów palety) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Najzdrowszy moduł puli core — przerywa serię cross-org write P0 (M01/M03/M10/M13/M14). Rdzeń to trwały magazyn `user_preferences (user_id, key, value)` przez `GET/PUT /settings/preferences/:key` — próbka 6 toggli persystuje + read-back. **Ścieżki krytyczne bezpieczeństwa OK:** GDPR usunięcie konta weryfikuje hasło bcrypt (`settings.routes.ts:3028`), self-scoped (`req.user.id`), 30-dniowy grace, export user-scoped z 410 po wygaśnięciu; API Keys/Webhooks hash+prefix (GET bez sekretu), mutacje `WHERE id=? AND user_id=?`; sesje/login-history user-scoped. **Voice & TTS false-negative OBALONY** — żywy `VoiceSettings.tsx` nie ma logiki „not configured"; defekt żyje w `VoiceSettingsPanel.tsx` (0 importerów, należy do M22, błędna atrybucja w inwentarzu). **Naprawione w audycie:** read-IDOR `GET /notifications` (`b9f2dee9d2`); Bramka D CalDAV/OAuth AES-256-GCM (`9ef570ca1b`, hard cap zdjęty); login-history/connected-accounts amber baner + Retry zamiast cichej pustki (`7495c12ffb`). Brak otwartych P0.

## 2. Luki do DoD

### (a) BACKEND / API (FAZA 2)
- **[P1] read-IDOR `GET /settings/notifications`** — `settings.routes.ts:868` `const userId = (req.query.userId as string) || req.user?.id` → `SELECT ... WHERE user_id=?` bez sprawdzenia `requesterId !== userId`; bliźniaczy POST (`:912`) guard MA. User A czyta prefs usera B przez `?userId=B` (userId globalny → możliwy cross-org, spełnia kryterium hard-cap). **UWAGA:** karta §6 + Fala F notuje read-IDOR NAPRAWIONE (`b9f2dee9d2`) — zweryfikować czy fix faktycznie usuwa źródło `req.query.userId`; jeśli nie — domknąć (zawsze `req.user.id`).
- **[P1] bezhasłowy duplikat usuwania konta** — `POST /settings/request-deletion` (`:2634`) self-scoped, tylko planuje (30d grace, `gdprService.ts:175`, status 'scheduled'), ale omija konfirmację hasłem obecną w `/settings/gdpr/deletion-request`. Fix: dodać bramkę hasła ALBO usunąć duplikat (FE używa wersji z hasłem).
- **[P2] pilot gating tylko FE** — `PILOT_ALLOWED_SETTINGS_SECTIONS` (`pilotAccess.ts:14`) egzekwowane wyłącznie redirectem (`SettingsView.tsx:261-265`); serwer nie zna pilota → pilot przez API może api-keys/webhooks/notifications/integracje. Fix: gating serwerowy → pilot API → 403.
- **[P2] sekrety integracji plaintext at rest** — CalDAV login:hasło base64 (`:2000`), OAuth `access_token`/`refresh_token` bez encrypt (`integrationOAuthEngine.ts:623-648`). **UWAGA:** Bramka D AES-256-GCM NAPRAWIONA (`9ef570ca1b`) — zweryfikować pokrycie wszystkich sekretów (CalDAV + OAuth); domknąć jeśli pozostały plaintext.

### (b) FRONTEND / UX (FAZA 2)
- **[P1] `/settings/billing` „Section not found"** — `routeConfig:149,415` mapuje `AppView.SETTINGS_BILLING`→`/settings/billing`, brak `case` sekcji → pułapka nawigacyjna. Billing żyje w Admin/Organization. Fix: wpiąć `BillingSettings.tsx` pod route ALBO usunąć route/enum.
- **[P1] Keyboard Shortcuts UKRYTE + no-op** — UI rebindu istnieje, brak globalnego dispatchera; rebind nic nie robi (`:523`). Fix: globalny dispatcher ALBO ukryć rebind UI.
- **[P2] Feature flags (Developer)** read-only viewer (Badge, brak write); `developerMode` persystuje (`:157`), flagi nie. Fix: edytowalne ALBO jawnie „read-only (zarządzane przez superadmin)".
- **[P2] martwy kod** — `layout/SettingsSidebar.tsx` (0 konsumentów; żywy to `settings/SettingsSidebar.tsx`); `VoiceSettingsPanel.tsx` (0 importerów → M22). Wytnij.

### (c) INTEGRACJA / TESTY E2E (FAZA 2 + 4)
- **[P0 testowy] S3 zmiana hasła** bez testu (ścieżka krytyczna).
- **[P0 testowy] S5 GDPR-delete bcrypt** — test celuje w bezhasłową `request-deletion`, nie w bcrypt-trasę `/settings/gdpr/deletion-request`. Dodać test celujący w password-gated trasę.
- **[P1] mock-drift** — globalny helper mocka i18n (`defaultValue`) kasuje ~34 FAIL; owinięcie ProfileSettings w `<Router>` (~14 FAIL); usunięcie testów-duchów `AIPreferencesModule`; real connect/disconnect Calendar (S4).
- **[P1] CI** — `test-suite.yml` tylko PR→`main`/`develop`; default `Londyn` → zmiany M25 nie uruchamiają suite. Dodać `Londyn`.

### (d) §27 + tokeny (FAZA 4)
- **[P1] 2237 hardkodów palety Tailwind** (`bg/text/border-{rose,blue,amber...}-NNN`) zamiast tokenów w `src/components/settings/`. Korupcja „roseuction"/„rose" już posprzątana (0 trafień). → tokeny Visual Standard.
- **[P2] §27 N/D — i to luka.** Sesje/api-keys/webhooks/login-history = layouty kartowe, gdzie indziej byłyby tabelą z Menu 1/2/3 + sort + empty. → `FilterableTable` gdzie zasadne.

## 3. Kroki realizacji
1. **(FAZA 2)** Zweryfikować/domknąć read-IDOR `GET /notifications` (zawsze `req.user.id`); bramka hasła lub usunięcie `/request-deletion`; zweryfikować pokrycie AES sekretów integracji.
2. **(FAZA 2)** Rozstrzygnąć billing — wpiąć `BillingSettings.tsx` pod `/settings/billing` ALBO usunąć route/enum.
3. **(FAZA 2)** Keyboard Shortcuts — globalny dispatcher ALBO ukryć rebind UI; Feature flags edytowalne ALBO jawnie „read-only".
4. **(FAZA 2)** Testy S3 (zmiana hasła) + S5 (GDPR-delete bcrypt na właściwej trasie); helper mocka i18n; `<Router>` w testach.
5. **(FAZA 3)** Pilot gating serwerowo (pilot API → 403); wytnij martwy kod (`layout/SettingsSidebar.tsx`, `VoiceSettingsPanel.tsx`→M22).
6. **(FAZA 4)** 2237 hardkodów palety → tokeny; kanon list (FilterableTable) dla sesji/keys/webhooks/login-history; dodać `Londyn` do CI.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** koniec „Section not found" (billing wpięty lub usunięty); Shortcuts działa lub ukryty; Feature flags edytowalne lub jawnie read-only; zero martwych kontrolek.
2. **Bezpieczeństwo:** read-IDOR `/notifications` zamknięty (naprawione `b9f2dee9d2`); jedyna ścieżka usunięcia konta wymaga hasła; sekrety integracji szyfrowane (AES, naprawione `9ef570ca1b`); pilot gating serwerowy (403).
3. **i18n:** `t()` pełne; klucze `settings.sections.*` w PL (nie zawsze EN-fallback); helper mocka `defaultValue`.
4. **Tokeny:** 2237 hardkodów palety → tokeny Visual Standard (lint koloru czysty).
5. **§27:** sesje/api-keys/webhooks/login-history przez FilterableTable + sort + empty gdzie zasadne.
6. **E2E w PR-gate:** S3 (zmiana hasła) + S5 (GDPR bcrypt) zielone na `Londyn`.

## 5. Weryfikacja
- read-IDOR: `GET /settings/notifications?userId=<inny>` → własne dane / 403, nie cudze (test; naprawione).
- GDPR: jedyna ścieżka usunięcia wymaga hasła bcrypt; test (NIE wykonywać realnego delete na prod).
- Billing: brak martwej trasy „Section not found".
- S2/S7: toggle persist po reload; theme/language app-wide (żywe przejście, FAZA 4).
- Sekrety: brak plaintext CalDAV/OAuth w DB (AES at rest).
- **Uwaga DB:** dev `.env` może wskazywać Railway PROD — szczególna ostrożność przy GDPR/delete; nie wykonywać realnego usunięcia konta.

## 6. Zależności
- Wyjścia → cała app (theme/language), M01 Czat/Teresa (AI prefs), M21 Meeting (Calendar Sync), konto/auth (GDPR delete).
- `VoiceSettingsPanel.tsx` cleanup — koordynować z M22 (AI OS), gdzie żyje źródło false-negative.
- Pilot gating serwerowy + hardkody palety → tokeny — wspólny wzorzec z M13/M14 (sweep FAZA 4).
- CI `Londyn` — systemowe wspólne z M01/M03/M10/M13/M14.
- Hasło/MFA żyją w `auth.routes` → poza M25 (audyt w module Auth/Security).
