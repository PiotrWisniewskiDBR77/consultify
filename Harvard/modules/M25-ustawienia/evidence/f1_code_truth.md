# M25 — Ustawienia (Settings) — FAZA 1: PRAWDA KODU

Agent: KOD. Repo: consultify @ feat/deliverables-light. Data: 2026-06-11.
Metoda: czytanie runtime (montaż → komponent → API klient → handler serwera → SQL). Dokumenty = hipotezy, werdykt = kod.

Pliki kluczowe:
- Montaż/router sekcji: `src/views/SettingsView.tsx` (switch renderContent: 316–448)
- Sidebar żywy: `src/components/settings/SettingsSidebar.tsx` (619 l.)
- Sidebar MARTWY: `src/components/layout/SettingsSidebar.tsx` (0 konsumentów)
- API klient: `src/services/api/settings.api.ts` (helpery `apiGet/apiPut/apiPost` z `./baseClient`)
- Serwer: `server/src/routes/settings.routes.ts` (5934 l., mount `routes/index.ts:115`), `server/src/routes/ai-settings.routes.ts`, `notificationSettings.routes.ts`, `user-settings-history/templates.routes.ts`

NOWE od 2026-06-08 (git log): tylko `c2bf2394e7 chore(release): green the deploy gate (eslint autofix + data-truth compliance)` — brak nowych sekcji funkcjonalnych w zakresie M25.

---

## TABELA 1a — REALNE (działają end-to-end: GET→render, zmiana→PUT/POST→read-back)

| # | Sekcja | Dowód runtime |
|---|--------|---------------|
| 1 | Profile / Avatar / Signatures / Working Hours | SettingsView:337–344 → komponenty z `onUpdateUser`; persist przez Api (np. ProfileSettings) |
| 2 | Dashboard / Work Preferences / Regional / Language | SettingsView:347–356; Language → `i18n.changeLanguage` (`LanguageSettings.tsx:87`); Regional GET/PUT `/settings/preferences/regional` (settings.routes:331,396) |
| 3 | AI: Behavior, Model&Params, Auto-Complete, Memory, Chat History, Data&Privacy, Prompt Library, Usage | SettingsView:359–376; AIBehavior load `Api.getAIInstructions/Personality` + save + read-back (`AIBehaviorSettings.tsx:103,132,146`). **Dawne 503 NIE występuje na surface usera** (patrz §Flagi-503) |
| 4 | AI: Voice & TTS | SettingsView:373 → `VoiceSettings.tsx`: load `Api.getAIVoice` (86), save+read-back (114–123). **Brak logiki „not configured" — false-negative NIE jest w tym komponencie** (patrz §Flagi) |
| 5 | Notifications: Channels, Email&Digest, Desktop&Sounds, Availability | SettingsView:379–386; np. DesktopSounds GET/PUT `/settings/notifications/sounds` + read-back (`DesktopSoundsSettings.tsx:87,121,129`); DND `/settings/notifications/dnd` (45,80) |
| 6 | Security: Overview + Authentication&Access (skonsolidowane v2) | SettingsView:389–403 → `security/SecurityOverviewPage`, `AuthenticationAccessPage`; legacy klucze (password/mfa/sessions/login-history/recovery) redirect do auth-access |
| 7 | Integrations: Connected Apps, Calendar Sync, API Keys, Webhooks | SettingsView:406–413; Calendar realny connect+read-back+„Coming soon" fallback (`CalendarSyncSettings.tsx:82,88,94`); integ. handlery scoped do org (settings.routes:1700+) |
| 8 | Data & Consent (GDPR) | Klient weryfikuje frazę+hasło i woła `Api.requestGdprDeletion(password)` (`DataControlsSettings.tsx`); serwer `bcrypt.compareSync` (settings.routes:3028) + 30-dniowy grace (3034). NAPRAWIONE — potwierdzone |
| 9 | Privacy & Visibility | SettingsView:419 → save+read-back (`PrivacySettings.tsx:177,178`) |
| 10 | Theme / Accessibility | SettingsView:422–425; Theme → store `toggleTheme` + `root.classList` app-wide (`ThemeSettings.tsx:176,148`); Accessibility save+read-back (`AccessibilitySettings.tsx:125,126`) |
| 11 | Advanced: Import/Export, Templates, Developer, Beta, History | SettingsView:430–439; Developer persist `Api.saveDeveloperSettings` (`DeveloperSettings.tsx:157`) — ALE feature flags = read-only viewer (patrz 1b/1f) |

**Wynik próbki toggli (6 grup):** AIBehavior, Accessibility, Privacy, DND, DesktopSounds, Theme — WSZYSTKIE robią realny PUT/POST i większość weryfikuje read-backiem (save→GET→porównanie). Brak „toggle tylko w stanie React". Wzorzec spójny i zdrowy.

---

## TABELA 1b — MOCK-STUB / route-only

| # | Pozycja | Werdykt | Dowód |
|---|---------|---------|-------|
| 12 | **Billing w Settings** | STUB / route-only | `routeConfig.ts:149` `BILLING:'/settings/billing'` + `routeConfig.ts:415` `[AppView.SETTINGS_BILLING]→ROUTES.SETTINGS.BILLING`, ale `SettingsView` switch (316–448) **NIE ma `case 'billing'`** ani importu → trafia w `default` → render „Section not found" (SettingsView:441–445). Komponent `BillingSettings.tsx` istnieje, ale jest osierocony (niezmontowany). |
| 11b | **Feature flags w Developer/Beta** | MOCK-STUB (read-only viewer) | Flagi renderowane jako `Badge` bez akcji (`DeveloperSettings.tsx:386–404`); brak per-flag toggle/write. Tylko `developerMode`/`showDebugInfo` persystują (157). Nie ma sterowania flagami z UI — to przeglądarka, nie menedżer. |

---

## TABELA 1c — ZEPSUTE

| Pozycja | Werdykt | Dowód |
|---------|---------|-------|
| (poz.4 Voice z inwentarza jako WIDOCZNE-ALE-ZEPSUTE) | **OBALONE** | Live komponent `VoiceSettings.tsx` nie ma żadnego warunku „not configured"; ma realny load/save/read-back. False-negative z findingu v10 dotyczy `VoiceSettingsPanel.tsx` (AI OS / Teresa) — który ma **0 importerów** w `src/` (orphan) i NIE jest częścią M25. Czerwona flaga jest błędnie przypisana do M25. |

**Brak twardo zepsutych ścieżek w zakresie M25.** Jedyna realna usterka funkcjonalna to no-op rebind skrótów (1d) i read-IDOR na `GET /notifications` (§IDOR).

---

## TABELA 1d — UKRYTE + MARTWE (rekomendacja)

| Pozycja | Typ | Dowód | Rekomendacja |
|---------|-----|-------|--------------|
| `overview`, `tenant-defaults`, `tenant-branding`, `tenant-security`, `module-preferences` | UKRYTE | SettingsView:272–284 redirect do PROFILE; usunięte z nawigacji | wytnij z routingu albo dokończ (read-only handoff, niska wartość) |
| `shortcuts` (Keyboard Shortcuts) | UKRYTE + niezadziałane | redirect SettingsView:279; nawet gdyby widoczne — rebind no-op `onChange={() => {}}` (`KeyboardShortcutsSettings.tsx:523`) i **brak globalnego dispatchera** keydown czytającego `customShortcuts`/`disabledShortcuts` | trzymaj ukryte dopóki nie powstanie globalny dispatcher; UI bez backendu wykonawczego |
| `src/components/layout/SettingsSidebar.tsx` | **MARTWY KOD** | grep całego `src/`: jedyni importujący `SettingsSidebar` to `settings/SettingsSidebar` i `Admin/AdminSettingsSidebar`; layout-owy = **0 konsumentów** | WYTNIJ |
| `src/components/settings/VoiceSettingsPanel.tsx` | MARTWY/orphan | 0 importerów w `src/` | WYTNIJ lub przenieś do M-AI jeśli to docelowy panel Teresy |
| `src/components/settings/BillingSettings.tsx` | osierocony | brak montażu w SettingsView | wepnij (case 'billing') albo wytnij i przekieruj route na moduł Billing |

---

## TABELA 1e — Wiring FE ↔ BE ↔ DB (główne grupy)

| Grupa/sekcja | Endpoint | Tabela DB | Status |
|--------------|----------|-----------|--------|
| Regional / generic prefs | GET/PUT `/settings/preferences/:key` (regional, accessibility, shortcuts, privacy, appearance, ai-voice, ai-memory, ai-privacy…) | `user_preferences (user_id,key,value)` upsert | REALNE (settings.routes:331,396,435,478…; SELECT `WHERE user_id=? AND key=?`) |
| Notifications (channels) | GET/POST `/settings/notifications` | `user_preferences` key=notifications | REALNE; **GET ma read-IDOR (§IDOR)** |
| Notifications email/sounds/dnd/digest | GET/PUT `/settings/notifications/{email,sounds,dnd,...}` | `user_preferences` | REALNE |
| AI behavior/personality/model | `Api.getAIInstructions/Personality` → `/settings/preferences/ai-*` | `user_preferences` | REALNE (read-back) |
| AI platform (superadmin) | `ai-settings.routes.ts` (guard `requirePlatformSuperAdmin`) | service-backed; 503 gdy brak `AISettingsService` import | poza zakresem usera M25 |
| Theme/Appearance | GET/PUT appearance prefs + store `toggleTheme` | `user_preferences` key=appearance | REALNE + efekt app-wide |
| Integrations/Calendar | `/settings/integrations/:provider`, calendars/connect | tabela connectorów scoped `organization_id` | REALNE (org-scoped) |
| GDPR export/deletion | POST `/settings/gdpr/{export,deletion-request}` + `/request-deletion` | `gdpr_requests (user_id,type,status,expires_at)` | REALNE (bcrypt verify, 30d grace) |
| Email signatures | `email_signatures (user_id,...)` | REALNE |
| Settings templates/history | `settings_templates`, history routes | REALNE |
| Developer settings | `Api.saveDeveloperSettings` + `getFeatureFlags` | dev settings persist; flags read-only | CZĘŚCIOWE (flagi viewer-only) |

`user_preferences` tworzona on-demand: `ensureUserPreferencesTable()` (np. settings.routes:875). Migracje nie weryfikowane w F1 (tabela auto-ensure w runtime).

---

## TABELA 1f — Flagi (Developer/Beta) + sprawa 503

- **Feature flags:** ładowane `Api.getFeatureFlags()` (`DeveloperSettings.tsx:104`), renderowane jako Badge read-only (386–404). **Nikt nie włącza ich z tego UI** — to przeglądarka stanu, nie kontroler. Realne flagi runtime żyją w `src/utils/*Flag.ts` (np. chatV9FeatureFlags, voiceLegendShortcutFlag) — sterowane kodem/innym mechanizmem, nie M25.
- **Developer mode / debug:** `developerMode`, `showDebugInfo` — lokalny stan persystowany `Api.saveDeveloperSettings` (157), gate'uje panel debug.
- **503 „not_configured":** `ai-settings.routes.ts:77–89 respondServiceNotConfigured` zwraca 503 TYLKO gdy dynamiczny import `AISettingsService` padnie (104–108) — endpointy te są pod `requirePlatformSuperAdmin` (91). Surface usera M25 (ai-behavior itd.) idzie przez `/settings/preferences/*` (zwykłe handlery, fallback do defaultów, brak 503). **Dawny problem 503 na user-AI: POTWIERDZONO że nie występuje.** Pozostałe 503 w settings.routes (259,318,1809) to zlokalizowane fallbacki błędów (recovery options, jedna integracja) z komunikatem — nie ciche połknięcie.

---

## TABELA 1g — Połączenia międzymodułowe (WE/WY)

| Połączenie | Kierunek | plik:linia | Status |
|-----------|----------|-----------|--------|
| theme → cała app | WY | `ThemeSettings.tsx:176` `toggleTheme(id)` (store) + `:148` `root.classList.add(density-)` | DZIAŁA |
| language → i18n (cała app) | WY | `LanguageSettings.tsx:87` `changeLanguage(langCode)` | DZIAŁA |
| AI settings (behavior/personality) → czat/Teresa | WY | persist w `user_preferences` (ai-instructions/personality) konsumowane przez warstwę AI | DZIAŁA (zapis realny; konsumpcję po stronie czatu weryfikuje M01/M-AI) |
| voice (STT/TTS) → przeglądarka/AI | WY | `VoiceSettings.tsx` SpeechSynthesis lokalnie (147–159) + prefs ai-voice | DZIAŁA (lokalny TTS; brak zależności od „voice-config" serwera) |
| GDPR delete → konto użytkownika | WY | `settings.routes.ts:2995` → `gdpr_requests` deletion, bcrypt verify, 30d grace | DZIAŁA |
| calendar sync → meeting/kalendarz | WY/WE | `CalendarSyncSettings.tsx:82` connect + org-scoped connector | DZIAŁA (z „Coming soon" gdy connector niegotowy) |
| profile/avatar → user object (cała app via onUpdateUser) | WY | SettingsView:338,340 prop `onUpdateUser` | DZIAŁA |
| keyboard shortcuts → globalny dispatcher | WY | **BRAK** dispatchera; rebind no-op (`KeyboardShortcutsSettings.tsx:523`) | NIEPODŁĄCZONE (dlatego ukryte) |
| billing → moduł Billing | WY | route istnieje, brak case → „Section not found" | ZERWANE |

---

## IDOR / cross-org (do krzyżowej weryfikacji z SEC)

**Wzorzec dominujący = BEZPIECZNY:** ~30 endpointów czyta/pisze `user_preferences WHERE user_id = ?` gdzie `userId = req.user?.id` (sesja), nie z URL/body. Integracje scoped do `req.user.organizationId`. GDPR `WHERE id=? AND user_id=?` (settings.routes:2964).

**ZNALEZIONE WYJĄTKI:**

1. **READ-IDOR — `GET /api/settings/notifications` (settings.routes.ts:868):**
   `const userId = (req.query.userId as string) || req.user?.id;` — bierze `userId` z query stringa BEZ sprawdzenia `=== req.user.id`. User A może odczytać preferencje powiadomień usera B przez `?userId=<B>`. To JEDYNY GET w pliku z tym wzorcem (wszystkie inne używają `req.user?.id`).
   - **P1 (read-only, dane preferencji powiadomień; nie sekrety).** Rekomendacja: usunąć fallback z query albo dodać guard jak w POST.

2. **POST `/notifications` (903) — BEZPIECZNY (kontrast):** ma guard `if (requesterId !== userId && actorRole !== 'owner' && 'admin') 403` (912). To pokazuje że autor znał wzorzec — GET został przeoczony.

Nie znaleziono cross-org IDOR (org-scoped connectory). Brak innych endpointów biorących `:id` zasobu z URL bez weryfikacji właściciela w zakresie M25.

---

## WERYFIKACJA 5 ZNANYCH FLAG

1. **Voice & TTS false-negative (poz.4):** OBALONE w M25. Live `VoiceSettings.tsx` nie ma warunku „not configured" (cały plik czysty; load 86, save 114). False-negative żyje w `VoiceSettingsPanel.tsx` (orphan, 0 importerów) / module AI OS — błędna atrybucja do M25. → poz.4 = DZIAŁA.
2. **/settings/billing „Section not found" (poz.12):** POTWIERDZONE. routeConfig.ts:149+415 mapują route/enum, ale SettingsView switch nie ma `case 'billing'` → default 441–445.
3. **Keyboard Shortcuts bez dispatchera (poz.10):** POTWIERDZONE. rebind `onChange={()=>{}}` (523), brak globalnego keydown czytającego customShortcuts; sekcja ukryta (SettingsView:279).
4. **AI settings 503 (poz.3):** POTWIERDZONE że NIE występuje na surface usera. 503 tylko w superadmin AI-platform przy braku importu service'u (ai-settings.routes:83 pod requirePlatformSuperAdmin).
5. **MARTWY `layout/SettingsSidebar.tsx`:** POTWIERDZONE — 0 konsumentów.

---

## KANDYDACI P0/P1

- **P1:** Read-IDOR `GET /settings/notifications` query `userId` bez guarda (settings.routes:868).
- **P1:** Billing route → „Section not found" (UX dziura; albo wepnij BillingSettings, albo redirect do modułu Billing).
- **P2:** Wytnij martwy kod: `layout/SettingsSidebar.tsx`, `VoiceSettingsPanel.tsx` (orphan), rozstrzygnij `BillingSettings.tsx`.
- **P2:** Feature flags w Developer = read-only viewer (oczekiwanie „menedżer flag" niespełnione — albo dokończ write, albo opisz jako viewer).
- **P3:** Keyboard Shortcuts — pełny UI bez globalnego dispatchera (trzymać ukryte do czasu implementacji).

Brak P0 (żadnej ścieżki krytycznie zepsutej / utraty danych / cross-org IDOR w M25).
