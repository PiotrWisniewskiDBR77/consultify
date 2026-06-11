# M25 — Ustawienia: KANON (F5) + BEZPIECZEŃSTWO (F6)

Branch: `feat/deliverables-light` | Data: 2026-06-11 | Agent: KANON+SEC

Zakres: FE `src/views/SettingsView.tsx` (514 l.) + `src/components/settings/*` (~93 komponentów) + sidebar `src/components/settings/SettingsSidebar.tsx`; BE `server/src/routes/settings.routes.ts` (5934 l., ~115 tras), montowane w `Gateway.ts:523` (`/api/settings`). Powiązane: `ai-settings.routes.ts`, `notificationSettings.routes.ts`, `user-settings-templates/history.routes.ts`, `services/integrationOAuthEngine.ts`, `gdprService.ts`.

---

## FAZA 5 — KANONY

### 1. §27 TABLE_AND_PREVIEW_CANON — NIE DOTYCZY
Przeskanowano kandydatów na tabele listowe: Webhooks, API Keys (APIAccessSettings), Connected Apps, Prompt Library, Login History, Sessions/Activity, Settings History, Settings Templates, Export/Import.
**Żadna sekcja nie używa kanonicznej tabeli listowej** (`<table>`, UnifiedTable, DataTable, role="table") — wszystkie to layouty kartowe/listowe (stacked cards/rows). §27 (A–S) nie ma zastosowania — brak powierzchni tabelarycznej do oceny.
- Dowód: `grep -E "<table|<thead|role=\"table\"|UnifiedTable"` = 0 trafień w `WebhooksSettings.tsx`, `APIAccessSettings.tsx`, `ConnectedAppsSettings.tsx`, `AIPromptLibrarySettings.tsx`, `LoginHistorySettings.tsx`, `SessionsActivitySettings.tsx`, `advanced/SettingsHistory.tsx`, `advanced/SettingsTemplates.tsx`, `advanced/SettingsExportImport.tsx`.
- **Odstępstwo (luka standardu)**: historia logowań / sesje / API keys / webhooks to dane, które w innych modułach byłyby tabelą z Menu 1/2/3, sort, empty/loading. Tu są kartami bez kanonu list. Świadoma decyzja „settings = karty", ale brakuje spójnego wzorca empty/sort/akcji.

### 2. Wzorzec hubowy — WŁASNY SHELL, spójny
`SettingsView` = dwukolumnowy shell: `SettingsSidebar` (grupy + sekcje + search) + content area renderujący komponent per `activeSection` (switch, `SettingsView.tsx:317-448`). To świadomy własny wzorzec „settings two-column", nie ModuleHub/MELS. Spójny wewnętrznie (sectionMeta + routing `/settings/:section`). **Werdykt: OK** — własny wzorzec uzasadniony, choć poza standardem ModuleHub.

### 3. UI-standards — POWAŻNA KORUPCJA KOLORÓW
- **2237 wystąpień hardkodowanej palety Tailwind** (`bg/text/border-{rose,blue,red,green,amber,emerald,indigo,purple,sky}-[0-9]{3}`) w `src/components/settings/`. Zamiast tokenów designu — surowe `bg-blue-500`, `text-emerald-500`, `bg-amber-100` itd.
  - Dowód: `AccountRecoverySettings.tsx:67,86,87,125,126,162,163,181...` i ~90 innych plików.
- Korupcja „roseuction"/„rose" zamiast tokenów: **brak w bieżącym źródle** (`grep roseuction` = 0) — najwyraźniej już posprzątane.
- Kontrolki toggle/select/input — nie audytowane per-komponent (poza zakresem czasu), ale skala hardkodów kolorów wskazuje na lokalne kopiowanie stylów.

### 4. i18n PL/EN — PRZEWAŻNIE OK, drobne luki
- `useTranslation`/`t(` używane szeroko: 128 trafień `t(` w 93 plikach settings — pokrycie dobre.
- **Luka**: `sectionMeta` w `SettingsView.tsx:89-235` ma angielskie title/subtitle jako stałe, ALE renderowane przez `t('settings.sections.${activeSection}.title', meta.title)` (`SettingsView.tsx:310-311`) — fallback EN, tłumaczalne jeśli klucze istnieją. Wymaga weryfikacji czy klucze `settings.sections.*` są w locale PL/EN (nie sprawdzone — ryzyko, że render zawsze pada na EN fallback).
- „Cost roseuction" korupcja: nie znaleziono.

### 5. Stany standardowe — CICHA DEGRADACJA (kilka miejsc)
- `GET /login-history` (`settings.routes.ts:5620`): `catch { return res.json({ history: [] }) }` — błąd DB/brak tabel zwraca pustą listę BEZ komunikatu (cicha degradacja, znany wzorzec).
- `GET /connected-accounts` (`:5646`): `catch { return res.json({ accounts: [] }) }` — j.w.
- `GET /notifications` (`:888`) i email-prefs zwracają defaults gdy brak danych — akceptowalne, ale błąd parsowania → 500.
- Empty/loading/error per sekcja FE nie audytowane wyczerpująco; wzorzec „pusta lista zamiast błędu" obecny serwerowo.

---

## FAZA 6 — BEZPIECZEŃSTWO (najważniejsze)

### Werdykt ogólny: solidne na warstwie IDOR per-user; jeden realny IDOR; pilot NIE egzekwowany serwerowo; sekrety integracji w plaintext.

Każda trasa ma per-route `verifyToken` (brak `router.use` globalnego, ale każdy handler woła `verifyToken` — sprawdzono `grep`). Większość czyta/pisze `WHERE user_id = ?` z `req.user.id`. Mutacje api-keys/webhooks/connected-accounts są poprawnie scope'owane `WHERE id = ? AND user_id = ?`.

---

### FINDING #1 — IDOR cross-user (odczyt cudzych powiadomień) — **P1**
`GET /api/settings/notifications` bierze `userId` z query stringa BEZ autoryzacji:
- **`server/src/routes/settings.routes.ts:868`**: `const userId = (req.query.userId as string) || req.user?.id;`
- Następnie `:877-881`: `SELECT value FROM user_preferences WHERE user_id = ? AND key = ?` z tym `userId`.
- Brak sprawdzenia `requesterId !== userId` (które JEST w odpowiadającym POST na `:912`).
- **Skutek**: zalogowany user A wywołuje `GET /api/settings/notifications?userId=<B>` i czyta preferencje powiadomień usera B (cross-user, a przy braku org-scope również cross-org).
- **Fix**: usunąć `req.query.userId` — używać wyłącznie `req.user.id` (jak GET `/notifications/email` na `:940`).

### FINDING #2 — Sekrety integracji w plaintext (at rest) — **P2**
Poświadczenia integracji zapisywane bez szyfrowania:
- **`settings.routes.ts:2000`** (CalDAV basic-connect): `accessToken: Buffer.from(\`${username}:${password}\`).toString('base64')` — base64 to **kodowanie odwracalne, nie szyfrowanie**. Login+hasło iCloud/CalDAV odzyskiwalne z DB.
- `extraData` przechowuje `username` cleartext (`:2001`).
- **`server/src/services/integrationOAuthEngine.ts:623-648`** (`storeTokens`): `access_token`, `refresh_token` wstawiane do `integration_oauth_tokens` **bez encrypt** — wszystkie tokeny OAuth (Google/MS/itd.) w plaintext at rest.
- **Skutek**: dostęp do bazy (dump/replica/backup) = wyciek żywych poświadczeń kont zewnętrznych użytkowników. Brak `encrypt/decrypt` w ścieżce (sprawdzono — 0 trafień encrypt w pliku).

### FINDING #3 — Pilot gating tylko po stronie klienta (brak egzekwowania serwerowego) — **P2**
Pilot VTS ograniczony do `profile/auth-access/language/theme` (`src/utils/pilotAccess.ts:14-19`), egzekwowany WYŁĄCZNIE w FE redirectem:
- **`src/views/SettingsView.tsx:261-265`**: `if (isPilotAllowedSettingsSection(activeSection)) return; navigate(getPilotDefaultSettingsRoute())`.
- Serwer `settings.routes.ts` NIE zna ograniczenia pilota — każdy `/api/settings/*` sprawdza tylko `verifyToken`.
- **Skutek**: user-pilot (rola VTS) może bezpośrednio przez API wywołać sekcje ukryte w UI: `GET/POST /api/settings/api-keys`, `/webhooks`, `/notifications`, `/integrations/:id/basic-connect`, developer settings itd. „Pilot ograniczony do 4 sekcji" jest fasadą UI, nie kontrolą bezpieczeństwa.
- Uwaga: sekcje *ownership* (overview/tenant-*) są lepiej chronione (legacy root `/` superadmin-only, registry write role-routed) — ale per-feature endpointy są otwarte dla każdego zalogowanego, w tym pilota.

---

### Ścieżki krytyczne — WERYFIKACJA (większość OK)

**a) GDPR usunięcie konta — POPRAWNE (naprawa potwierdzona)**
`POST /api/settings/gdpr/deletion-request` (`settings.routes.ts:2994-3055`):
- Hasło wymagane (`:3015`), zweryfikowane bcrypt: `bcrypt.compareSync(password, user.password)` → 403 przy złym (`:3028-3030`). ✔
- Scope wyłącznie `req.user.id` (`:2998`) — nie da się usunąć cudzego konta (brak userId z body/URL). ✔
- 30-dniowy grace realny: `scheduledAt = now + 30d`, status `'scheduled'` (`:3035-3040`). ✔
- Export-download user-scoped + wygasanie: `WHERE id = ? AND user_id = ? AND type='export'` (`:2964`), 410 po `expires_at` (`:2976-2978`). ✔ Brak enumeracji (requestId + user_id).

**b) Zmiana hasła / MFA — POZA modułem Settings**
Endpointy change-password/MFA NIE są w `settings.routes.ts` (UI security odwołuje się do auth.routes — poza zakresem M25). Nie zweryfikowano current-password/rate-limit/session-reset tutaj. **Do audytu w module Auth.**

**c) Sesje / historia logowań — user-scoped, OK (z cichą degradacją)**
`GET /login-history` (`:5568`): `WHERE user_id = ?` z `req.user.id` (`:5581,5604`) — tylko swoje. ✔ Brak osobnego endpointu „revoke session" w settings.routes (revoke prawdopodobnie w auth) — nie potwierdzono działania revoke tutaj.

**d) API Keys / Webhooks — sekrety NIE wyciekają, revoke działa — OK**
- API keys: przechowywane jako `key_hash` (sha256) + `key_prefix` (`:4948,4900-4903`); GET listy zwraca tylko `key_prefix`, NIE `key_hash` (`:4918-4923`). Pełny klucz tylko raz przy create/rotate (`:4973,5063`). ✔
- Mutacje scope'owane `WHERE id = ? AND user_id = ?` (PUT `:5000`, DELETE `:5023`, rotate `:5053`). ✔
- Webhooks: GET listy NIE zwraca kolumny `secret` (`:5130-5134`). Mutacje scope'owane `WHERE id = ? AND user_id = ?` (`:5201,5230,5251`). ✔
- Connected-accounts disconnect scope'owany `userId` (`:5667`) + audit security event. ✔

**Sekrety w logach**: logi używają `logger.info(...user ${userId}...)` — brak logowania haseł/tokenów w przejrzanych ścieżkach. (Nie wyczerpująco przeszukane.)

---

## PODSUMOWANIE FINDINGÓW SEC

| # | Severity | Tytuł | Dowód |
|---|----------|-------|-------|
| 1 | **P1** | IDOR: odczyt cudzych notification prefs przez `?userId=` | `settings.routes.ts:868` (brak auth, vs POST `:912`) |
| 2 | **P2** | Poświadczenia integracji (CalDAV pass, OAuth tokeny) plaintext at rest | `settings.routes.ts:2000`; `integrationOAuthEngine.ts:623-648` |
| 3 | **P2** | Pilot gating tylko FE — endpointy settings otwarte serwerowo dla pilota | `SettingsView.tsx:261-265` vs brak gatingu w `settings.routes.ts` |

Naprawione/OK (nie powielać): GDPR-delete password (bcrypt ✔), export-download scope+expiry ✔, api-keys/webhooks secret-leak ✔ + revoke ✔, legacy root superadmin-gate ✔, registry write role-routed ✔.

## PODSUMOWANIE KANON

- §27: nie dotyczy (brak tabel listowych — wszystko karty). Luka: brak kanonu list dla sesji/keys/webhooks.
- Hub: własny two-column shell, spójny — OK.
- UI-standards: **2237 hardkodów palety kolorów** = poważna korupcja vs tokeny.
- i18n: pokrycie dobre (`t(` 128×/93 plików); ryzyko fallbacku EN dla `settings.sections.*` (zweryfikować klucze locale).
- Stany: cicha degradacja `catch→[]` w login-history i connected-accounts.
