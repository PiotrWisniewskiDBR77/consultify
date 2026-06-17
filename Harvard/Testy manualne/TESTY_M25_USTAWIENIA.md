# TESTY — M25 Ustawienia (Settings)

> **Moduł:** M25 Ustawienia (`/settings/*`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki:** pełny moduł Settings — 10 grup, ~35 sekcji, dwukolumnowy shell z `SettingsSidebar` + dynamiczne renderowanie sekcji w `SettingsView.tsx`. Obejmuje: profil, preferencje pracy, AI & automatyzacja, powiadomienia, bezpieczeństwo, integracje (w tym Calendar Sync), dane i prywatność (GDPR), rozliczenia, wygląd i zaawansowane.
> **Cel:** kompletna weryfikacja E2E wszystkich sekcji — UI + payload Network + stan DB. Szczególna uwaga: znane luki (Voice false-negative obalony, billing naprawiony, Shortcuts ukryte = OCZEKIWANE), GDPR-delete z bramką hasła, Calendar Sync realny, bezhasłowy duplikat deletion-request.
> **Wejścia:** `Harvard/wdrozenie-100/M25-ustawienia.md` · `Harvard/modules/M25-ustawienia/KARTA_AUDYTU.md` · `Harvard/podzial/inventory/INV_G_admin_ustawienia_partner_superadmin.md` (sekcja USTAWIENIA, poz.1-12).
> **Legenda:** `[MANUAL]` = ręczna weryfikacja (OAuth / upload / audio); `[FLAG]` = zależne od flagi/capability/roli; `[DB]` = dowód obejmuje wiersz/kolumnę w bazie; `[L-xx]` = luka z rejestru (karta §H.03).
> **Data:** 2026-06-16

---

## §0. Kontekst architektoniczny

### 0.1 Mapa 10 grup i ~35 sekcji

| Grupa (sidebar ID) | Sekcje (`SettingsSection`) | Komponent |
|---|---|---|
| **PERSONAL** | `profile`, `avatar`, `signatures`, `working-hours` | ProfileSettings, AvatarPhotoSettings, EmailSignaturesSettings, WorkingHoursSettings |
| **WORKFLOW** | `dashboard`, `work-preferences`, `regional`, `language` | DashboardPreferencesSettings, WorkPreferencesSettings, RegionalSettings, LanguageSettings |
| **AI & AUTOMATION** | `ai-behavior`, `ai-model-params`, `ai-autocomplete`, `ai-memory`, `ai-chat-history`, `ai-privacy`, `ai-prompt-library`, `ai-voice`, `ai-usage` | AIBehaviorSettings, AIModelParametersSettings, AIAutoCompleteSettings, AIMemorySettings, ChatHistorySettings, AIPrivacySettings, AIPromptLibrarySettings, **VoiceSettings**, AIUsageDashboard |
| **NOTIFICATIONS** | `notifications-overview`, `notifications-email-digest`, `notifications-desktop-sounds`, `notifications-availability` | NotificationSettings, EmailDigestSettings, DesktopSoundsSettings, AvailabilitySettings |
| **SECURITY** | `security-dashboard`, `auth-access` (+ legacy: `password`, `mfa`, `sessions`, `login-history`, `recovery`) | SecurityOverviewPage, AuthenticationAccessPage |
| **INTEGRATIONS** | `connected-apps`, `calendar-sync`, `api-keys`, `webhooks` | ConnectedAppsSettings, CalendarSyncSettings, APIAccessSettings, WebhooksSettings |
| **DATA & PRIVACY** | `data-controls`, `privacy` | DataControlsSettings, PrivacySettings |
| **BILLING** | `billing` | BillingSettings (renderuje BillingCore) |
| **APPEARANCE** | `theme`, `accessibility` (+ `shortcuts` — UKRYTE, redirect do Profile) | ThemeSettings, AccessibilitySettings |
| **ADVANCED** | `import-export`, `templates`, `developer`, `beta-features`, `settings-history` | SettingsExportImport, SettingsTemplates, DeveloperSettings, DeveloperSettings (showBetaFeatures), SettingsHistory |

**Sekcje UKRYTE** (redirect do `/settings/profile` przez `hiddenSections`):
- `overview`, `tenant-defaults`, `tenant-branding`, `tenant-security`, `module-preferences` — sekcje ownership/handoff, brak w sidebarze.
- `shortcuts` — KeyboardShortcutsSettings istnieje, ale brak globalnego dispatchera → UKRYTE celowo [L-05]; dostęp przez URL `/settings/shortcuts` → redirect do profile.

### 0.2 Architektura kluczowych plików

| Plik | Rola |
|---|---|
| `src/views/SettingsView.tsx` | Shell: sidebar + routing sekcji (`renderContent` switch) |
| `src/components/settings/SettingsSidebar.tsx` | Nawigacja 10 grup (typ `SettingsSection`) |
| `server/src/routes/settings.routes.ts` (5931 l.) | 123 endpointy; rdzeń: `GET/PUT /settings/preferences/:key` |
| `server/src/services/gdprService.ts` | `createAccountDeletionRequest` (grace 30d) |
| `server/src/services/integrationOAuthEngine.ts` | OAuth dla Calendar/Connected Apps |
| `src/utils/pilotAccess.ts` | `PILOT_ALLOWED_SETTINGS_SECTIONS` (FE-only — L-03) |

### 0.3 Znane stany (prawda kodu 2026-06-13)

| Stan | Szczegół | Priorytet |
|---|---|---|
| `shortcuts` — UKRYTE | Sidebar go nie pokazuje; URL `/settings/shortcuts` → redirect do Profile [L-05] | P1 (oczekiwane zachowanie) |
| `billing` — DZIAŁA | Case 'billing' w renderContent → BillingSettings → BillingCore; sidebar pokazuje grupę BILLING | — (naprawione) |
| Voice & TTS false-negative — OBALONY | Żywy `VoiceSettings.tsx` czyta `Api.getAIVoice()`, brak logiki „not configured"; `VoiceSettingsPanel.tsx` (0 importerów) = martwy kod | P2 martwy kod |
| GDPR `/request-deletion` — NAPRAWIONE | Duplikat bezhasłowy (`:2634`) MA teraz `verifyUserPassword` (`:2644`) — weryfikuje hasło bcrypt | [L-02] zweryfikować |
| read-IDOR `GET /notifications` — NAPRAWIONE | Guard `req.user.id` dodany (`:868`) | [L-01] PASS |
| Pilot gating — tylko FE | `pilotAccess.ts:14`; serwer nie zna pilota → bypass przez API możliwy [L-03] | P2 |

### 0.4 Zasada weryfikacji E2E (obowiązkowa)

Każde zapisanie ustawienia MUSI być potwierdzone w Network odpowiednim endpointem (nie tylko zmiana wyglądu). Po akcji: **odśwież stronę** i sprawdź, że stan przetrwał (reload-test). Dla FAIL: podaj `plik:linia`, endpoint, status code, dowód.

### 0.5 Role (kontekst testowy)

| Rola | Dostęp do Settings |
|---|---|
| USER / OWNER | pełny dostęp (core otwarty) |
| pilot VTS | tylko `profile`, `auth-access`, `language`, `theme` (FE redirect) |
| SUPERADMIN | pełny dostęp + widzi dane z `/api` bez FE gatingu |

---

## Setup środowiska testowego

1. **Dev server:** `http://localhost:3000` (FE) + `http://localhost:3001` (BE). Użyj konta OWNER DBR77.
2. **DevTools → Network** — filtr `/api/settings` + `/api/integrations`; obserwuj wszystkie żądania PUT/POST/GET.
3. **DevTools → Console** — zero błędów JS to wymóg przejścia testu.
4. **Konta testowe:**
   - Konto OWNER z organizacją DBR77 (pełny dostęp).
   - Konto USER z rolą pilota VTS (do testu §11 gating pilot).
5. **Dane wstępne:**
   - Upewnij się, że konto ma ustawiony `ttsEnabled: false` lub `true` w DB (do testu Voice — sprawdź `user_preferences WHERE key LIKE 'settings:ai-voice%'`).
   - Przygotuj poprawne i błędne hasło do testów GDPR.
6. **Uwaga PROD:** dev `.env.local` może wskazywać Railway PROD (`centerbeam`). NIE wykonuj realnego usunięcia konta na PROD. Test GDPR zatrzymaj na kroku weryfikacji — nie klikaj ostatecznego potwierdzenia na PROD.

---

## §1. Shell i nawigacja (SettingsView + SettingsSidebar)

### 1.1 Otwarcie modułu

1. Wejdź na `/settings` (bez segmentu).
2. **Oczekiwane:** redirect do `/settings/profile` (useEffect `ROUTES.SETTINGS.ROOT → PROFILE`).
3. **Asercja:** URL zmienia się na `/settings/profile`, sidebar aktywuje grupę PERSONAL → pozycja „Profile".
4. **Brak 500/crash** w Network i Console.

### 1.2 Struktura sidebara

1. Sprawdź obecność wszystkich 10 grup w sidebarze:
   - PERSONAL, WORKFLOW, MODULES: AI & AUTOMATION, MODULES: NOTIFICATIONS, SECURITY, MODULES: INTEGRATIONS, DATA & PRIVACY, BILLING, APPEARANCE, ADVANCED & HISTORY.
2. Kliknij każdą grupę → zawija/rozwija (toggle).
3. Grupa z aktywną sekcją jest domyślnie rozwinięta.
4. **Asercja:** `shortcuts` NIE jest widoczny w sidebarze (celowo ukryty [L-05]).

### 1.3 Nawigacja między sekcjami

1. Kliknij kolejno: Profile → Language → Security Overview → Calendar Sync → Data & Consent → Theme.
2. **Oczekiwane:** URL aktualizuje się (`/settings/profile`, `/settings/language`, `/settings/security-dashboard`, `/settings/calendar-sync`, `/settings/data-controls`, `/settings/theme`).
3. Aktywna sekcja zaznaczona w sidebarze (accent kolor).
4. Breadcrumbs: „Settings > {Tytuł sekcji}" (dynamiczne z `sectionMeta`).
5. Brak pełnego przeładowania strony (SPA navigate).

### 1.4 Sekcje UKRYTE (redirect)

1. Wejdź bezpośrednio na `/settings/shortcuts`.
2. **Oczekiwane:** redirect do `/settings/profile` (hiddenSections include 'shortcuts').
3. Powtórz dla `/settings/overview`, `/settings/tenant-defaults`.
4. **Asercja:** żadna z tych sekcji nie renderuje contentu — zawsze redirect do Profile.

### 1.5 Domyślna sekcja po logowaniu

1. Zaloguj się od nowa i wejdź w Settings.
2. **Oczekiwane:** lądowanie na Profile (pierwsza widoczna sekcja).
3. Stan sidebara: tylko PERSONAL rozwinięte domyślnie.

### 1.6 Mobile responsywność (bonus)

1. Zmień viewport na 375px (iPhone SE).
2. **Oczekiwane:** hamburger button widoczny (`lg:hidden`); klik otwiera sidebar jako overlay.
3. Klik poza sidebarek → zamknięcie overlay.
4. **Brak**: sidebar nie nakłada się na content na desktop (>1024px).

---

## §2. Profil użytkownika (PERSONAL)

> **Endpointy:** `PUT /api/settings/preferences/profile`, `POST /api/users/avatar`, `PUT /api/users/me`
> **Komponenty:** ProfileSettings.tsx, AvatarPhotoSettings.tsx, EmailSignaturesSettings.tsx, WorkingHoursSettings.tsx

### 2.1 Zmiana imienia/nazwiska (S1)

1. Wejdź na `/settings/profile`.
2. Zmień imię (np. „Piotr" → „Piotr Test") i nazwisko.
3. Klik „Save" / przycisk zapisu.
4. **Sieć:** `PUT /api/settings/preferences/profile` lub `PUT /api/users/me` → status 200; body zawiera nowe wartości.
5. **Reload-test:** odśwież stronę → pola pokazują nowe wartości.
6. **[DB]** (opcjonalnie): `SELECT value FROM user_preferences WHERE user_id=? AND key='settings:profile'` → JSON zawiera nowe imię/nazwisko.
7. Przywróć oryginalne dane po teście.

**Asercje edge-case:**
- Puste imię → walidacja FE (button Save disabled lub błąd inline).
- Zbyt długie imię (>100 znaków) → walidacja lub obcięcie.

### 2.2 Avatar upload [MANUAL]

1. Wejdź na `/settings/avatar`.
2. Kliknij „Upload" / obszar drag-drop.
3. Wybierz plik PNG (np. 200×200, <2MB).
4. **Sieć:** `POST /api/users/avatar` lub odpowiednik → status 200; URL do nowego avatara w odpowiedzi.
5. **Wizualnie:** miniatura avatara aktualizuje się bez przeładowania.
6. **Reload-test:** odśwież → avatar pozostaje.
7. **Edge-case:** plik nieobsługiwany (np. `.exe`) → błąd walidacji przed uploadem (brak żądania sieciowego).
8. **Edge-case:** plik >5MB → błąd „File too large" lub odpowiednik.

### 2.3 Podpisy e-mail (Email Signatures)

1. Wejdź na `/settings/signatures`.
2. Dodaj nowy podpis: wpisz treść, nadaj nazwę, zapisz.
3. **Sieć:** POST/PUT do `/api/settings/signatures` lub `preferences/signatures` → 200.
4. **Reload-test:** podpis widoczny po odświeżeniu.
5. Usuń podpis → znika z listy; reload → nie wraca.
6. **Edge-case:** podpis z HTML/markdown → sprawdź czy renderuje poprawnie w preview.

### 2.4 Godziny pracy (Working Hours)

1. Wejdź na `/settings/working-hours`.
2. Zmień godziny (np. Pon–Pt 8:00–17:00).
3. **Sieć:** `PUT /api/settings/preferences/working-hours` → 200.
4. **Reload-test:** wartości zachowane.
5. Toggle dnia (np. odznacz Sobotę) → zapisz → reload → Sobota wyłączona.

---

## §3. Preferencje pracy (WORKFLOW)

> **Endpointy:** `GET/PUT /api/settings/preferences/:key` (rdzeń persist)

### 3.1 Dashboard preferences

1. Wejdź na `/settings/dashboard`.
2. Zmień domyślny widok (np. ukryj widget).
3. **Sieć:** `PUT /api/settings/preferences/dashboard` → 200.
4. **Reload-test:** ustawienie zachowane.

### 3.2 Work Preferences

1. Wejdź na `/settings/work-preferences`.
2. Zmień dowolną preferencję (np. domyślny projekt, format zadania).
3. **Sieć:** PUT preferences → 200.
4. **Reload-test:** zachowane.

### 3.3 Regional Settings (strefa czasowa)

1. Wejdź na `/settings/regional`.
2. Zmień strefę czasową (np. Europe/Warsaw → America/New_York).
3. **Sieć:** PUT preferences/regional → 200.
4. **Reload-test:** strefa zachowana.
5. Sprawdź, czy zmiana strefy wpływa na wyświetlanie dat gdzieś w aplikacji (M03 Kalendarz).

### 3.4 Language — zmiana PL/EN (S7) [KRYTYCZNE]

1. Wejdź na `/settings/language`.
2. Zmień język z PL na EN (lub odwrotnie).
3. **Sieć:** `PUT /api/settings/preferences/language` → 200.
4. **Reload-test:** po odświeżeniu strony — interfejs przełącza się na wybrany język. Sprawdź sidebar Settings, nagłówki sekcji, przyciski „Save".
5. **Weryfikacja app-wide:** przejdź do M01 Czat — czy język się przełączył?
6. **Asercja:** żaden klucz i18n nie wyświetla się jako surowy klucz `settings.sections.*.title` (musi być przetłumaczony lub fallback EN). [L-09 i18n]
7. Przywróć PL po teście.

**Edge-case:** zmiana języka bez reloadu → czy UI aktualizuje się bez przeładowania (i18next)?

---

## §4. AI & Automatyzacja

> **Endpointy:** `GET/PUT /api/settings/preferences/ai-*`; Voice: `GET/POST /api/settings/ai-voice`

### 4.1 Behavior & Instructions

1. Wejdź na `/settings/ai-behavior`.
2. Zmień ton odpowiedzi (np. „Professional" → „Casual"), zapisz.
3. **Sieć:** PUT preferences/ai-behavior → 200.
4. **Reload-test:** wybór zachowany.
5. Przejdź do M01 Czat → wyślij wiadomość → sprawdź czy Teresa stosuje nowy styl (weryfikacja cross-module).

### 4.2 Model & Parameters

1. Wejdź na `/settings/ai-model-params`.
2. Zmień temperature lub wybrany model (jeśli dostępny w UI).
3. **Sieć:** PUT preferences → 200.
4. **Reload-test:** zachowane.

### 4.3 Memory & Context

1. Wejdź na `/settings/ai-memory`.
2. Włącz/wyłącz pamięć kontekstu, zapisz.
3. **Sieć:** PUT preferences/ai-memory → 200.
4. **Reload-test:** zachowane.

### 4.4 Chat History Settings

1. Wejdź na `/settings/ai-chat-history`.
2. Zmień retencję (np. 30 dni → 7 dni) lub wyczyść historię.
3. **Sieć:** PUT/POST → 200.
4. **Reload-test:** wartość zachowana.

### 4.5 Prompt Library

1. Wejdź na `/settings/ai-prompt-library`.
2. Dodaj nowy prompt (nazwa + treść).
3. **Sieć:** POST do odpowiedniego endpointu → 200/201.
4. **Reload-test:** prompt widoczny.
5. Edytuj istniejący prompt → zapisz → reload → zmiany zachowane.
6. Usuń prompt → znika → reload → nie wraca.

### 4.6 Voice & TTS — WERYFIKACJA FALSE-NEGATIVE (KRYTYCZNE) [S6 fragment]

> **Kontekst:** Żywy komponent to `VoiceSettings.tsx` (importowany w SettingsView jako `case 'ai-voice': return <VoiceSettings />`). Czyta `Api.getAIVoice()` → `GET /api/settings/ai-voice`. NIE ma logiki „not configured". False-negative był w `VoiceSettingsPanel.tsx` (0 importerów — martwy kod M22). Panel w Settings POWINIEN wyświetlać aktualny stan `ttsEnabled`/`sttEnabled`.

**Test 4.6.1 — odczyt stanu Voice**

1. Wejdź na `/settings/ai-voice`.
2. Panel ładuje się (spinner → content) — brak DegradedState `title="Voice settings unavailable"`.
3. **Sieć:** `GET /api/settings/ai-voice` → status 200; body zawiera `preferences: { ttsEnabled, sttEnabled, voice, speed, autoPlay }`.
4. **Asercja stanu UI ↔ API:** jeśli `ttsEnabled=true` → toggle TTS pokazuje „on"; jeśli `false` → „off". Brak „not configured" jako tekstu na ekranie.

**Test 4.6.2 — zapis preferencji Voice (S6)**

1. Zmień TTS toggle (włącz/wyłącz).
2. Zmień wybrany głos (np. „alloy" → „nova").
3. Zmień szybkość (Speed).
4. Klik „Save".
5. **Sieć:** `POST /api/settings/ai-voice` → 200; następnie automatyczny GET read-back (komponent robi re-fetch po save) → body potwierdza nowe wartości.
6. **Reload-test:** wejdź ponownie na `/settings/ai-voice` → wartości zachowane.
7. **[DB]** (opcjonalnie): `SELECT value FROM user_preferences WHERE key LIKE '%ai-voice%'` → JSON z nowymi wartościami.

**Test 4.6.3 — Test głosu (Play/Stop) [MANUAL]**

1. Włącz TTS, wybierz głos, klik „Play" (przycisk testowy).
2. **Oczekiwane:** odtwarzanie audio przez `window.speechSynthesis.speak()` — słyszalny głos w przeglądarce.
3. Klik „Stop" → odtwarzanie zatrzymane.
4. **Edge-case:** przeglądarka bez Web Speech API → toast „Text-to-speech is not supported in this browser".

**Test 4.6.4 — Weryfikacja martwy kod (VoiceSettingsPanel.tsx)**

1. Sprawdź, że na ekranie `/settings/ai-voice` NIE pojawia się żaden komunikat „not configured" ani banner wskazujący na problem konfiguracji głosu Teresy.
2. **Sieć:** sprawdź czy był wywołany `GET /api/public/anna/voice-config` — ten endpoint dotyczy Teresy (M22/głos), NIE Settings. Jeśli się pojawia — to regresja.
3. **Wynik oczekiwany:** Settings Voice panel operuje wyłącznie na `GET/POST /api/settings/ai-voice` (preferencje użytkownika, TTS przeglądarkowe), NIE na voice-config Teresy.

### 4.7 AI Usage Dashboard

1. Wejdź na `/settings/ai-usage`.
2. Panel ładuje się z danymi zużycia tokenów (lub empty state gdy brak danych).
3. Brak DegradedState (chyba że API faktycznie niedostępne).
4. **Sieć:** GET odpowiedniego endpointu usage → 200.

---

## §5. Powiadomienia (NOTIFICATIONS)

> **Endpointy:** `GET /api/settings/notifications` (req.user.id — naprawiony L-01), `POST /api/settings/notifications`
> **Uwaga [L-01]:** Read-IDOR był na `GET /notifications` — naprawiony committem `b9f2dee9d2`. Guard: `userId = req.user?.id` (`:868`), `requesterId !== userId → 403` na POST (`:912`).

### 5.1 Channels & Categories (notifications-overview)

1. Wejdź na `/settings/notifications-overview`.
2. **Sieć:** `GET /api/settings/notifications` → 200; własne dane (nie cudze).
3. Włącz/wyłącz kanał (np. Email notifications).
4. **Sieć:** `POST /api/settings/notifications` → 200; body zawiera `userId` + `preferences`.
5. **Reload-test:** ustawienie zachowane.
6. **Asercja anti-IDOR:** payload POST musi mieć `userId = req.user.id` (sprawdź Request Body w Network — `userId` musi odpowiadać zalogowanemu userowi; nie może być arbitralny).

### 5.2 Email & Digest

1. Wejdź na `/settings/notifications-email-digest`.
2. Zmień typ podsumowania (daily/weekly/none).
3. **Sieć:** PUT/POST → 200.
4. **Reload-test:** zachowane.

### 5.3 Desktop & Sounds

1. Wejdź na `/settings/notifications-desktop-sounds`.
2. Włącz/wyłącz dźwięki desktopowe.
3. **Sieć:** PUT/POST → 200.
4. **Reload-test:** zachowane.

### 5.4 Availability (DND / Quiet Hours)

1. Wejdź na `/settings/notifications-availability`.
2. Włącz DND (Do Not Disturb), ustaw godziny ciche (np. 22:00–8:00).
3. **Sieć:** PUT/POST → 200.
4. **Reload-test:** godziny zachowane, DND toggle aktywny.

---

## §6. Bezpieczeństwo (SECURITY)

> **Komponenty:** SecurityOverviewPage, AuthenticationAccessPage
> **Endpointy:** `GET /settings/login-history` (user-scoped), `DELETE /settings/sessions/:id`, `POST /auth/change-password`
> **Uwaga:** Hasło/MFA żyją w `auth.routes` (poza M25); sesje/historia logowań w settings.routes.

### 6.1 Security Overview (security-dashboard)

1. Wejdź na `/settings/security-dashboard`.
2. Strona się renderuje (SecurityOverviewPage) — score bezpieczeństwa, status MFA, status sesji.
3. Brak 500/crash. Brak białego ekranu.
4. Linki do podsekcji prowadzą do `auth-access`.

### 6.2 Authentication & Access — zmiana hasła (S3)

1. Wejdź na `/settings/auth-access`.
2. Znajdź sekcję zmiany hasła.
3. **Test 1 — błędne obecne hasło:**
   - Wpisz złe stare hasło, nowe hasło, potwierdź.
   - Klik „Save".
   - **Oczekiwane:** błąd „Incorrect current password" lub odpowiednik; hasło NIE zmienione.
   - **Sieć:** POST do `/api/auth/change-password` → 401/403.
4. **Test 2 — słabe nowe hasło:**
   - Wpisz obecne hasło (poprawne), nowe hasło „12345".
   - **Oczekiwane:** walidacja siły hasła (FE lub BE) — błąd przed żądaniem lub 400 z serwera.
5. **Test 3 — poprawna zmiana (S3) [DB]:**
   - Wpisz poprawne obecne hasło, nowe hasło (silne, min. 8 znaków, wielka litera + cyfra).
   - Klik „Save".
   - **Sieć:** POST `/api/auth/change-password` → 200.
   - Wyloguj się i zaloguj z NOWYM hasłem → sukces.
   - **[DB]:** `SELECT password_hash FROM users WHERE id=?` → hash zmieniony.
   - Przywróć oryginalne hasło.

### 6.3 MFA — Two-Factor Authentication [MANUAL]

1. Wejdź na `/settings/auth-access` → sekcja MFA.
2. Kliknij „Enable MFA" / „Setup Authenticator".
3. **Oczekiwane:** QR kod lub ciąg setup key pojawia się.
4. **[MANUAL]:** Zeskanuj QR w aplikacji TOTP (Google Authenticator / Authy) → wpisz kod.
5. **Sieć:** POST do MFA setup endpoint → 200.
6. **Weryfikacja:** po relogowaniu poprosi o kod TOTP.
7. **Uwaga:** test poglądowy — nie włączaj MFA na koncie produkcyjnym bez planu wyłączenia.

### 6.4 Aktywne sesje (Sessions)

1. Wejdź na `/settings/auth-access` → sekcja Sessions / Active Sessions.
2. Lista sesji się ładuje (baner amber jeśli błąd API — naprawione `7495c12ffb`).
3. **Asercja degraded state:** jeśli API `/settings/sessions` niedostępne → baner amber z „Retry" (NIE cisza/pusta lista bez komunikatu).
4. Kliknij „Revoke" przy jednej sesji (innej niż bieżąca).
5. **Sieć:** `DELETE /api/settings/sessions/:id` → 200.
6. Sesja znika z listy.

### 6.5 Historia logowań (Login History)

1. Wejdź na `/settings/auth-access` → sekcja Login History.
2. Lista ładuje się (baner amber jeśli błąd — naprawione `7495c12ffb`).
3. **Asercja degraded state:** tak samo jak sesje — baner amber z Retry, NIE cisza.
4. Sprawdź, że dane są user-scoped (tylko własne logowania).

### 6.6 Recovery Options

1. Wejdź na `/settings/auth-access` → sekcja Recovery.
2. Sprawdź możliwość dodania recovery email / backup codes.
3. **Sieć:** GET/POST recovery endpoint → 200.
4. **Reload-test:** dane zachowane.

---

## §7. Integracje (INTEGRATIONS)

### 7.1 Connected Apps

1. Wejdź na `/settings/connected-apps`.
2. Lista połączonych aplikacji się ładuje.
3. Sprawdź dostępność przycisków „Connect" i „Disconnect" per integracja.
4. **Asercja:** brak 500 dla każdej pozycji listy.

### 7.2 Calendar Sync — NAPRAWIONY (S4) [MANUAL dla realnego OAuth]

> **Kontekst:** `CalendarSyncSettings.tsx`. Endpointy: `GET /api/settings/calendars`, `POST /api/settings/calendars/:id/connect`, `DELETE /api/settings/calendars/:id/disconnect`, `GET/PUT /api/settings/calendar-settings`. Działanie: `connectCalendar` → jeśli `data.authUrl` → redirect OAuth; jeśli 501 → "Coming soon" graceful.

**Test 7.2.1 — Załadowanie panelu Calendar Sync**

1. Wejdź na `/settings/calendar-sync`.
2. **Sieć:** `GET /api/settings/calendars` → 200; lista providerów (np. Google Calendar, Outlook, iCal).
3. Brak DegradedState (jeśli API działa).
4. Sprawdź toggle `syncTasks` i `syncMeetings` — mają załadowane wartości (`GET /api/settings/calendar-settings`).

**Test 7.2.2 — Connect Google Calendar [MANUAL]**

1. Klik „Connect" przy Google Calendar.
2. **Sieć:** `POST /api/settings/calendars/google/connect`.
3. Jeśli `response.authUrl` → redirect OAuth do Google (otwiera przeglądarkę Google).
4. **[MANUAL]:** Zaloguj się w Google i autoryzuj aplikację.
5. Po OAuth callback → powrót do `/settings/calendar-sync`.
6. **Sieć po powrocie:** kolejny GET calendars → Google Calendar `connected: true`.
7. Panel pokazuje: zielona ikona + `externalEmail`, `calendarName`, `lastSyncAt`.
8. **Reload-test:** status `connected` zachowany po odświeżeniu.

**Test 7.2.3 — Disconnect kalendarza**

1. Przy połączonym kalendarzu klik „Disconnect".
2. Confirm dialog → potwierdź.
3. **Sieć:** `DELETE /api/settings/calendars/:id/disconnect` → 200.
4. Następnie `GET /api/settings/calendars` → prowajder `connected: false`.
5. **Reload-test:** status disconnected zachowany.

**Test 7.2.4 — Provider „Coming soon" (501)**

1. Klik „Connect" przy providerze, który zwraca 501.
2. **Oczekiwane:** toast/baner „This calendar integration is coming soon." — NIE błąd „Failed to connect".
3. Brak DegradedState, brak 500 w Console.

**Test 7.2.5 — Ustawienia sync (syncTasks / syncMeetings)**

1. Zmień toggle `syncTasks` (włącz/wyłącz), klik „Save".
2. **Sieć:** `PUT /api/settings/calendar-settings` → 200; response potwierdza nowe wartości (`syncTasks`, `syncMeetings`).
3. **Reload-test:** toggles zachowane.

**Test 7.2.6 — Weryfikacja cross-module: Calendar Sync → M03 Kalendarz**

1. Po pomyślnym połączeniu Google Calendar (test 7.2.2) przejdź do M03 `/my-work/calendar`.
2. **Oczekiwane:** wydarzenia z Google widoczne w kalendarzu aplikacji (lub honest message „Import w trakcie" jeśli sync asynchroniczny).
3. **Uwaga:** jeśli backend Calendar Sync w pełni nie obsługuje importu → odnotuj stan (nie FAIL, ale FLAG).

### 7.3 API Keys

1. Wejdź na `/settings/api-keys`.
2. Utwórz nowy klucz API (nazwa: „test-key").
3. **Sieć:** `POST /api/settings/api-keys` → 200/201; response zawiera `id`, `prefix` (np. `ck_...`), ale NIE pełny sekret (tylko przy tworzeniu pokazany raz).
4. **Weryfikacja bezpieczeństwa:** przy kolejnym `GET /api/settings/api-keys` — klucze wyświetlają tylko `prefix` + maskę; pełny sekret NIE jest zwracany (hash+prefix w DB).
5. Usuń klucz → `DELETE /api/settings/api-keys/:id` → 200 → klucz znika.
6. **[DB]:** `SELECT prefix, hash FROM api_keys WHERE user_id=?` — tylko prefiks i hash, brak plaintextowego sekretu.

### 7.4 Webhooks

1. Wejdź na `/settings/webhooks`.
2. Dodaj webhook (URL: `https://example.com/hook`, events: wybierz kilka).
3. **Sieć:** `POST /api/settings/webhooks` → 200/201.
4. **Reload-test:** webhook widoczny na liście.
5. Edytuj URL webhoooka → zapisz → reload → zmiana zachowana.
6. Usuń webhook → `DELETE /api/settings/webhooks/:id` → 200 → znika.
7. **Walidacja:** niepoprawny URL (`not-a-url`) → błąd walidacji FE lub 400 z BE.

---

## §8. Dane i prywatność (DATA & PRIVACY)

> **Komponenty:** DataControlsSettings.tsx, PrivacySettings.tsx
> **Endpointy:** `POST /api/settings/gdpr/export-request`, `GET /api/settings/gdpr/export-download/:id`, `POST /api/settings/gdpr/deletion-request` (bcrypt), `POST /api/settings/request-deletion` (duplikat, TEŻ ma bcrypt od `b9f2dee9d2`), `GET/POST /api/settings/gdpr/consents`, `GET/POST /api/settings/gdpr/retention`

### 8.1 GDPR — Eksport danych

1. Wejdź na `/settings/data-controls`.
2. Kliknij „Export My Data".
3. **Sieć:** `POST /api/settings/gdpr/export-request` → 200/202; request ID w odpowiedzi.
4. Po chwili (async): `GET /api/settings/gdpr/export-download/:requestId` → status `completed` → możliwość pobrania JSON.
5. Pobierz plik → sprawdź że zawiera dane użytkownika (profil, preferencje), nie dane innego usera (user-scoped).
6. **Edge-case (po wygaśnięciu 30d):** `GET export-download/:id` gdzie request expired → 410 Gone.

### 8.2 GDPR — Zgody (Consents)

1. W sekcji Data & Consent zmień toggles zgód (np. wyłącz `usageAnalytics`, włącz `marketingCommunications`).
2. **Sieć:** `POST /api/settings/gdpr/consents` → 200.
3. **Reload-test:** zgody zachowane.

### 8.3 GDPR — Retencja danych

1. Zmień okres retencji (np. 365d → 90d).
2. **Sieć:** `POST /api/settings/gdpr/retention` → 200.
3. **Reload-test:** okres zachowany.

### 8.4 GDPR — Usunięcie konta z hasłem (S5) [KRYTYCZNE] [DB]

> **Kanon:** jedyna bezpieczna droga = `/settings/gdpr/deletion-request` z weryfikacją bcrypt + 30d grace.
> **UWAGA PROD:** NIE wykonuj realnego usunięcia konta na środowisku produkcyjnym (Railway centerbeam). Zatrzymaj test po weryfikacji UI bez klikania ostatecznego „Confirm Delete" na PROD. Na staging (caboose) możesz przeprowadzić pełny test.

**Test 8.4.1 — Dialog usunięcia**

1. Wejdź na `/settings/data-controls`.
2. Kliknij „Delete Account" / „Request Account Deletion".
3. **Oczekiwane:** modal/dialog z dwoma polami: (a) fraza potwierdzająca (np. „DELETE"), (b) pole hasła.
4. Oba pola puste → przycisk „Confirm Delete" disabled lub błąd przy kliknięciu.

**Test 8.4.2 — Błędna fraza**

1. Wpisz błędną frazę (np. „delete" zamiast „DELETE"), poprawne hasło.
2. Klik „Confirm".
3. **Oczekiwane:** toast `'Please type "DELETE" to confirm'` (lub odpowiednik); brak żądania sieciowego DELETE/POST.
4. **Asercja:** `POST /api/settings/gdpr/deletion-request` NIE wysłane.

**Test 8.4.3 — Poprawna fraza, błędne hasło**

1. Wpisz poprawną frazę, błędne hasło.
2. Klik „Confirm".
3. **Sieć:** `POST /api/settings/gdpr/deletion-request` body `{reason, password}` → 401/403 (bcrypt mismatch).
4. **Oczekiwane UI:** toast błędu „Incorrect password" lub odpowiednik; konto NIE usunięte.

**Test 8.4.4 — Poprawna fraza + poprawne hasło (zatrzymaj przed PROD)**

1. Wpisz poprawną frazę + poprawne hasło.
2. Klik „Confirm".
3. **Sieć:** `POST /api/settings/gdpr/deletion-request` → 200; body `{request: {id, status: 'scheduled', scheduledAt}}`.
4. **Oczekiwane UI:** toast sukcesu „Account deletion scheduled. You will receive a confirmation email."
5. Dialog zamknięty; pola wyczyszczone.
6. **[DB]:** `SELECT * FROM gdpr_requests WHERE user_id=? AND type='deletion'` → wiersz `status='scheduled'`, `scheduled_at` = teraz + 30d.
7. **Na staging:** możesz sprawdzić że konto NIE jest natychmiast usunięte (grace period = 30d).
8. **Na PROD: ZATRZYMAJ TEST TUTAJ.** Opcjonalnie: sprawdź `GET /api/settings/gdpr/deletion-status` → zwraca status 'scheduled'.

**Test 8.4.5 — Duplikat endpoint `/request-deletion` (L-02) [FLAG]**

> Kontekst: `POST /api/settings/request-deletion` (`:2634`) był bezhasłowy. Commit `b9f2dee9d2` dodał `verifyUserPassword` (`:2644`). Weryfikujemy czy FIX jest kompletny.

1. Wyślij request z curl lub Network intercept (Fetch override) do `POST /api/settings/request-deletion` BEZ pola `password`.
2. **Oczekiwane (naprawione):** 401/400 — brak bramki bez hasła.
3. Wyślij z błędnym hasłem → 401.
4. Wyślij z poprawnym hasłem → 202.
5. **Asercja:** żadna ścieżka do usunięcia konta nie omija weryfikacji hasła. [L-02 zweryfikowany]

### 8.5 Privacy & Visibility

1. Wejdź na `/settings/privacy`.
2. Zmień widoczność profilu (np. „Only Organization" → „Private").
3. **Sieć:** PUT preferences/privacy → 200.
4. **Reload-test:** wartość zachowana.
5. Toggle „Online status visibility" → zapisz → reload → zachowane.

---

## §9. Rozliczenia / Billing

> **Komponent:** BillingSettings.tsx → BillingCore
> **Route:** `/settings/billing`
> **Kontekst:** Wcześniej karta audytu raportowała „Section not found" [L-04]. Kod SettingsView.tsx `:427–428` MA case 'billing' → `<BillingSettings>`. Sidebar pokazuje grupę BILLING. **Status: ROZWIĄZANE przez podpięcie BillingSettings (wbrew starszemu DP-11).**

### 9.1 Nawigacja do /settings/billing

1. Wejdź na `/settings/billing`.
2. **Oczekiwane:** renderuje się `BillingSettings` — tytuł „Subscription & Billing", komponent `BillingCore`.
3. **Nie powinno być:** „Section not found" (jeśli jest → FAIL, L-04 nadal otwarty).
4. Brak 500/crash.

### 9.2 Zawartość BillingCore

1. Sprawdź widoczność sekcji (zgodnie z `isAdmin`, `canManageOrgBilling`):
   - `showCurrentPlan` → aktualny plan użytkownika widoczny.
   - `showUsageMeters` → metry użycia (tokeny AI itp.) widoczne.
   - `showInvoices` → lista faktur (lub empty state).
   - `showAvailablePlans` → widoczne dla adminów z `canManageOrgBilling`.
   - `showUserLicense` → licencja użytkownika.
2. Sekcja „Billing & Subscription Terms" → 3 linki: Subscription Agreement, SLA, Refund Policy.
3. Linki prowadzą do `/legal/subscription`, `/legal/sla`, `/legal/refunds` (mogą być 404 jeśli nieimplementowane — odnotuj ale nie FAIL).

### 9.3 Billing dla zwykłego usera vs admin

1. Zaloguj się jako zwykły USER (nie admin).
2. Wejdź na `/settings/billing`.
3. **Oczekiwane:** widzi własną licencję i plan; NIE widzi panelu zarządzania planami (to wymaga `canManageOrgBilling`).
4. Zaloguj się jako OWNER/ADMIN.
5. **Oczekiwane:** widzi dodatkowo sekcję zmiany planów/fakturowania.

---

## §10. Wygląd (APPEARANCE)

> **Komponenty:** ThemeSettings.tsx, AccessibilitySettings.tsx

### 10.1 Theme — ciemny/jasny/system (S7)

1. Wejdź na `/settings/theme`.
2. Przełącz motyw: Light → Dark → System.
3. **Oczekiwane:** UI natychmiast zmienia się (dark/light mode; `toggleTheme` prop).
4. **Sieć:** `PUT /api/settings/preferences/theme` → 200.
5. **Reload-test:** motyw zachowany po odświeżeniu — NIE wraca do domyślnego.
6. **App-wide:** motyw obowiązuje w całej aplikacji (sprawdź inny moduł np. M01 Czat).

### 10.2 Accessibility Settings

1. Wejdź na `/settings/accessibility`.
2. Sprawdź opcje: kontrast, ruch (reduced motion), rozmiar czcionki.
3. Zmień ustawienie, zapisz.
4. **Sieć:** PUT preferences/accessibility → 200.
5. **Reload-test:** zachowane.
6. **Reduced motion:** po włączeniu sprawdź czy animacje sidebar/modal są zredukowane.

### 10.3 Keyboard Shortcuts — UKRYTE [L-05]

1. Sprawdź, że w sidebarze w grupie APPEARANCE **nie ma** pozycji „Keyboard Shortcuts".
2. Spróbuj wejść bezpośrednio na `/settings/shortcuts`.
3. **Oczekiwane:** redirect do `/settings/profile` (hiddenSections zawiera 'shortcuts').
4. **Brak**: rendering `KeyboardShortcutsSettings.tsx` — komponent jest celowo niedostępny.
5. **Dokumentacja jako KNOWN ISSUE [L-05]:** brak globalnego dispatchera → ukryte. UI komponentu `KeyboardShortcutsSettings.tsx` + `saveCustomShortcut` istnieje w kodzie, ale sekcja przekierowuje. Rebind **no-op** — nawet gdyby dostępny, skróty nie byłyby dispatchowane app-wide.

---

## §11. Zaawansowane (ADVANCED & HISTORY)

### 11.1 Import/Export Settings

1. Wejdź na `/settings/import-export`.
2. Kliknij „Export" → plik `.json` pobierany przez przeglądarkę.
3. Sprawdź zawartość pliku (powinien zawierać preferences, nie dane innych userów).
4. Kliknij „Import" → prześlij uprzednio pobrany plik.
5. **Sieć:** POST import → 200.
6. **Reload-test:** ustawienia przywrócone.

### 11.2 Templates

1. Wejdź na `/settings/templates`.
2. Zapisz bieżące ustawienia jako szablon (nazwa: „test-template").
3. **Sieć:** POST → 200/201.
4. Zastosuj szablon → **Sieć:** POST apply → 200.
5. Usuń szablon → DELETE → 200.

### 11.3 Developer (Feature Flags) [L-06]

1. Wejdź na `/settings/developer`.
2. **Oczekiwane:** widok feature flags — lista flag z wartościami (Badge / chip read-only).
3. **Asercja:** brak edytowalnych kontrolek przy flagach (są read-only — `developerMode` toggle persystuje, ale flagi NIE są edytowalne z Settings).
4. Włącz `developerMode` toggle → **Sieć:** `PUT /api/settings/preferences/developer` → 200.
5. **Reload-test:** `developerMode` zachowane.
6. Sprawdź, że flagi nie zmieniają się po toggle/reload (read-only viewer).
7. **Dokumentacja [L-06]:** panel powinien jawnie oznaczać flagi jako „read-only (zarządzane przez superadmin)" — jeśli brak takiego opisu → luka UX.

### 11.4 Beta Features

1. Wejdź na `/settings/beta-features`.
2. **Oczekiwane:** ta sama `DeveloperSettings` z `showBetaFeatures=true` — lista funkcji beta.
3. Włącz funkcję beta → **Sieć:** PUT preferences → 200.
4. **Reload-test:** stan beta zachowany.

### 11.5 Settings History

1. Wejdź na `/settings/settings-history`.
2. Historia zmian ładuje się (lub empty state).
3. Kliknij „Restore" przy poprzedniej wersji (jeśli jest).
4. **Sieć:** POST restore → 200.
5. Sprawdź, że ustawienia faktycznie się przywróciły.

---

## §12. Ścieżki cross-module

### 12.1 M25 → M03 Moja Praca (Calendar Sync → Kalendarz)

1. W M25 `/settings/calendar-sync` połącz Google Calendar (§7.2.2).
2. Przejdź do M03 `/my-work/calendar`.
3. **Oczekiwane:** Kalendarz w M03 pokazuje integrację jako aktywną (lub komunikat o synchronizacji w toku).
4. **Asercja:** brak komunikatu „not connected" po pomyślnym OAuth w Settings.

### 12.2 M25 → M01 Czat (AI Behavior → Teresa)

1. W M25 `/settings/ai-behavior` zmień styl odpowiedzi (Casual / Formal / Technical).
2. Zapisz.
3. Przejdź do M01 `/chat`.
4. Wyślij neutralne pytanie do Teresy.
5. **Oczekiwane (weryfikacja behawioralna):** Teresa stosuje nowy styl w odpowiedzi.
6. **Uwaga:** weryfikacja subiektywna — nie ma hard asercji, ale zauważalna różnica stylu jest wymagana.

### 12.3 M25 → M01 Czat (Voice TTS → toolbar czatu)

1. W M25 `/settings/ai-voice` włącz TTS (`ttsEnabled: true`), zapisz.
2. Przejdź do M01 `/chat`.
3. Sprawdź, czy ikona TTS w toolbarze czatu pokazuje stan „włączony" (jeśli jest taka synchronizacja).
4. Wyślij wiadomość → Teresa odpowiada → głos TTS się odtwarza (lub przycisk Play/Stop pojawia się).
5. **Odwrotnie:** wyłącz TTS w Settings → czat nie odtwarza głosu.

### 12.4 M25 ↔ M24 Admin (granica Settings vs Admin)

1. Z menu Settings kliknij „Back to Dashboard" lub przejdź do `/admin`.
2. **Oczekiwane:** Settings nie podmienia się z Adminem (to osobne widoki).
3. Billing w Settings (`/settings/billing`) → BillingSettings (user-view).
4. Billing w Admin (`/admin/billing`) → admin panel billing.
5. **Asercja:** użytkownik z rolą USER (nie admin) nie ma dostępu do `/admin` (redirect).

### 12.5 Pilot VTS — gating sekcji [FLAG]

> Kontekst: pilot = `isPilotParticipantRole(role)` → tylko `['profile', 'auth-access', 'language', 'theme']` dostępne (FE redirect).

1. Zaloguj się jako użytkownik z rolą pilota VTS.
2. Wejdź na `/settings`.
3. **Oczekiwane:**
   - Sidebar pokazuje TYLKO sekcje pilot (profile, auth-access, language, theme) — pozostałe ukryte przez `allowedSectionSet`.
   - Próba wejścia na `/settings/calendar-sync` → redirect do `/settings/profile`.
4. Wejdź na `/settings/profile` → działa normalnie.
5. **[L-03] KNOWN GAP:** próba wywołania przez API (np. curl) `GET /api/settings/api-keys` z tokenem pilota → **powinno** zwrócić 403 (serwer nie zna pilota — brak gatingu serwerowego). Odnotuj wynik.

---

## §13. Przekrojowe

### 13.1 i18n PL/EN (S7 fragment)

1. Ustaw język PL → sprawdź `/settings/profile` — etykiety PL.
2. Ustaw język EN → sprawdź te same sekcje — etykiety EN.
3. **Asercja:** żaden klucz i18n nie wyświetla się jako surowy string np. `settings.sections.profile.title` (musi być albo przetłumaczony, albo English fallback z `sectionMeta`).
4. Sprawdź 3 sekcje: profile, notifications-overview, data-controls — w obu językach.
5. Sprawdź sidebar — grupy i pozycje przetłumaczone (lub EN fallback).

### 13.2 Dark mode (S7)

1. Włącz dark mode w `/settings/theme`.
2. Przejdź przez wszystkie 10 grup (jeden klik na każdą, szybki wzrokowy).
3. **Asercja:** żadna sekcja nie renderuje białego prostokąta w dark mode (hardkodowane `bg-white` zamiast tokenów → błąd wizualny).
4. Szczególnie sprawdź: DataControlsSettings, SecurityOverviewPage, CalendarSyncSettings — tam było najwięcej hardkodów [L-09].

### 13.3 Konsola DevTools — zero błędów

1. Otwórz DevTools → Console przed wejściem w Settings.
2. Przejdź przez WSZYSTKIE sekcje (kliknij każdą w sidebarze).
3. **Asercja:** zero `ERROR` w konsoli (JS errors). Warningi React mogą być — zanotuj, ale nie FAIL automatycznie.
4. **Szczególne sprawdzenie:** czy pojawia się stary błąd `AIPreferencesModule` (stale import — powinien być naprawiony).

### 13.4 Network — brak 500

1. W każdej z 10 grup kliknij każdą sekcję.
2. **Asercja:** żaden GET endpoint nie zwraca 500 (Internal Server Error).
3. Dopuszczalne: 200, 404 (dla niezaimplementowanych funkcji), 503 z `featureUnavailable` (celowe).
4. Niedopuszczalne: 500, crash, biały ekran.

### 13.5 Persist po reload — próbka 6 toggli (S2/S7)

Zasada z karty audytu: próbka 6 toggli persystuje. Sprawdź minimum:
1. Language → zmień → reload → zachowana. ✓
2. Theme → zmień → reload → zachowany. ✓
3. TTS enabled → zmień → reload → zachowany. ✓
4. Notifications email → zmień → reload → zachowany. ✓
5. DND availability → zmień → reload → zachowany. ✓
6. developerMode → zmień → reload → zachowany. ✓

### 13.6 A11y (Accessibility — minimalna weryfikacja)

1. Przejdź przez Settings z klawiaturą (Tab, Enter, Esc).
2. Sprawdź, czy focus ring jest widoczny na każdym interactive elemencie.
3. Kliknięcie „Save" przez Enter (gdy focused) → akcja się wykonuje.
4. Esc na modalu delete → modal się zamyka.

---

## §14. Mapa epików → pokrycie sekcji

| Epik (karta §F) | Story | Sekcja testu | Status testu |
|---|---|---|---|
| EPIK 1 Integralność bezpieczeństwa | S1.1 read-IDOR GET /notifications | §5.1 asercja user-scoped | PASS oczekiwane (naprawione) |
| EPIK 1 | S1.2 jedyna droga delete = hasło | §8.4 + §8.4.5 | WYMAGA weryfikacji |
| EPIK 1 | S1.3 sekrety AES szyfrowanie | §7.3 API Keys (hash) + §7.2 (OAuth) | Weryfikacja BE |
| EPIK 2 Domknięcie front↔back | S2.1 billing nie „Section not found" | §9.1 | Powinno być PASS |
| EPIK 2 | S2.2 Shortcuts hidden / dispatcher | §10.3 | KNOWN ISSUE — documented |
| EPIK 2 | S2.3 Feature flags read-only | §11.3 | KNOWN GAP — documented |
| EPIK 3 Gating + cleanup | S3.1 pilot gating API | §12.5 | [FLAG] |
| EPIK 4 Testy | S4.1 S3 zmiana hasła + S5 GDPR bcrypt | §6.2 + §8.4 | Krytyczne do wykonania |
| EPIK 5 Tokeny + §27 | S5.1 tokeny palety | §13.2 dark mode | [L-09] wizualny |

---

## §15. Testy regresji (istniejące)

Uruchom przed testami manualnymi i po:

```bash
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
npx jest src/components/settings --no-coverage 2>&1 | tail -20
```

Pliki testowe (istniejące):
- `src/components/settings/__tests__/APIAccessSettings.smoke.test.tsx`
- `src/components/settings/__tests__/DataControlsSettings.smoke.test.tsx`
- `src/components/settings/__tests__/ProfileSettings.smoke.test.tsx`
- `src/components/settings/__tests__/PushNotificationsSettings.smoke.test.tsx`
- `src/components/settings/__tests__/RecoveryOptionsSettings.smoke.test.tsx`

**Znane FAIL (nie produkt — drift harnessu):**
- ~34 FAIL z powodu `mock react-i18next` zwracającego obiekt zamiast stringa (`t(key,{defaultValue})` → „Objects are not valid as React child").
- ~14 FAIL z powodu braku `<Router>` wokół `ProfileSettings` (używa `useNavigate()`).
- 2 FAIL `AIPreferencesModule` — stale import (`@/views/settings/AIPreferencesModule` — sprawdź czy nadal istnieje).

**P0 brakujące testy (L-10):**
- Test S3: `POST /auth/change-password` z poprawnym hasłem → 200 + weryfikacja bcrypt.
- Test S5: `POST /settings/gdpr/deletion-request` z prawidłowym hasłem → 200 + `gdpr_requests` wiersz.
- Oba NIE istnieją w CI na `Londyn` (trigger tylko `main`/`develop`).

---

## §16. Format raportu i Definition of Done

### Format raportu (per test)

```
### §X.Y — Tytuł testu
- **Kroki:** [lista wykonanych]
- **Wynik:** PASS | FAIL | SKIP | FLAG
- **Dowód:**
  - Screenshot (UI)
  - Network: `<METHOD> <endpoint>` → `<status>` → payload fragment
  - [DB] (jeśli wymagane): zapytanie + wynik
  - Stan po reload: PASS | FAIL
- **Odchylenie (jeśli FAIL):** plik:linia, przyczyna, priorytet
```

### Definition of Done (M25)

- [ ] **D1** — Wszystkie 10 grup otwierają się bez 500/crash.
- [ ] **D2** — Persist 6 toggli (§13.5) potwierdzone przez reload-test.
- [ ] **D3** — S3 zmiana hasła (§6.2): stare hasło bcrypt → nowe hasło działa przy logowaniu.
- [ ] **D4** — S5 GDPR delete (§8.4): fraza+hasło wymagane; błędne hasło → 401 (brak usunięcia); prawidłowe → 'scheduled' w DB.
- [ ] **D5** — S4 Calendar Sync (§7.2): connect/disconnect OAuth lub graceful 501 „Coming soon".
- [ ] **D6** — Voice & TTS (§4.6): panel czyta `ttsEnabled` z DB poprawnie; brak komunikatu „not configured" jako fałszywy alarm.
- [ ] **D7** — Billing (§9.1): `/settings/billing` renderuje BillingSettings, NIE „Section not found".
- [ ] **D8** — Shortcuts (§10.3): `/settings/shortcuts` redirectuje do profile; brak w sidebarze — OCZEKIWANE.
- [ ] **D9** — L-02 duplikat `/request-deletion` wymaga hasła (§8.4.5): weryfikacja bcrypt obecna.
- [ ] **D10** — Language PL↔EN (§3.4, §13.1): reload → właściwy język; zero surowych kluczy i18n.
- [ ] **D11** — Dark mode (§13.2): zero białych artefaktów w dark mode.
- [ ] **D12** — Zero JS ERROR w konsoli podczas przechodzenia przez wszystkie sekcje (§13.3).
- [ ] **D13** — Pilot gating FE (§12.5): redirect dla zabronionych sekcji działa; API gap (L-03) odnotowany.

### Znane luki (dokumentuj jako FAIL z priorytetem, nie blokują D-check)

| Luka | Opis | Gdzie w testach | Priorytet |
|---|---|---|---|
| L-05 | Shortcuts brak dispatchera — sekcja UKRYTA (redirect) | §10.3 | P1 — celowe, dok. |
| L-03 | Pilot gating tylko FE (serwer nie zna pilota) | §12.5 | P2 — odnotować |
| L-06 | Feature flags brak etykiety „read-only (superadmin)" | §11.3 | P2 — UX |
| L-09 | Hardkody palety + i18n inline | §13.1, §13.2 | P1-P2 — wizualny |
| L-10 | Brak testów S3/S5 w CI | §15 regresja | P0-test |

---

*Koniec specyfikacji M25 — wersja 1.0 · 2026-06-16*
