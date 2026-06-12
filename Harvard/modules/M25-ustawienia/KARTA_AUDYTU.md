# M25 — Ustawienia (Settings) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `809ba27152`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M25 · inwentarz `Harvard/podzial/inventory/INV_G_*.md` (sekcja USTAWIENIA, poz.1-12) · poprzednia karta `docs/audit/2026-06-02/MODULE_18_ustawienia.md` (56/100) · finding `[[finding_v10_voice_config_false_negative]]`
**Evidence:** `Harvard/modules/M25-ustawienia/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 53/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)
> **Re-audit 2026-06-11 po Sprintach 1–5:** F: 5→8 (W1 notifications read-IDOR naprawiony + Bramka D CalDAV/OAuth AES-256-GCM, commity `b9f2dee9d2` + `9ef570ca1b`, hard cap zdjęty).

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 21 | 10/12 REALNE z trwałym `user_preferences` (próbka 6 toggli persystuje+read-back); Shortcuts UKRYTE/no-op, Feature flags read-only viewer, Billing route-only „Section not found". |
| B. Wiring i dane | 15 | 12 | Rdzeń `user_preferences`/`gdpr_requests` realny, integracje org-scoped, GDPR z bcrypt+grace; minus: cicha degradacja `catch→[]` na login-history/connected-accounts + zerwany billing. |
| C. Testy automatyczne | 15 | 6 | 286 PASS/43 FAIL/18 SKIP, ale większość FAIL to drift harnessu; **S5 GDPR-delete bcrypt i S3 zmiana hasła bez testu**; nic w PR-gate na `Londyn`. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 6 | Własny spójny shell settings + i18n dobry, ale **2237 hardkodów palety Tailwind** zamiast tokenów + brak kanonu list (sesje/keys/webhooks = layouty kartowe, nie §27). |
| F. Bezpieczeństwo/dostęp | 10 | 8 | W1 notifications read-IDOR naprawiony + Bramka D CalDAV/OAuth AES-256-GCM szyfrowanie (commity `b9f2dee9d2`, `9ef570ca1b`); GDPR/api-keys czyste; pozostałe: pilot tylko FE (P2). |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **NIE — read-IDOR P1 naprawiony (W1), hard cap zdjęty.** Suma surowa 53 < 70 (Faza 4 niewykonana). |

**Werdykt jednym akapitem:** Najzdrowszy moduł puli core — przerywa serię cross-org write P0 (M01/M03/M10/M13/M14). Rdzeń to trwały magazyn `user_preferences (user_id, key, value)` przez `GET/PUT /settings/preferences/:key`; próbka 6 toggli z różnych grup persystuje i robi read-back. **Ścieżki krytyczne bezpieczeństwa zweryfikowane jako OK:** GDPR usunięcie konta naprawdę weryfikuje hasło bcrypt (`settings.routes.ts:3028`), jest self-scoped (`req.user.id` — nie da się usunąć cudzego), 30-dniowy grace realny, export user-scoped z 410 po wygaśnięciu; API Keys/Webhooks trzymane jako hash+prefix (GET nie zwraca sekretu), wszystkie mutacje `WHERE id=? AND user_id=?`; sesje/login-history user-scoped. **Znana czerwona flaga Voice & TTS false-negative OBALONA** — żywy `VoiceSettings.tsx` nie ma logiki „not configured"; defekt żyje w `VoiceSettingsPanel.tsx` (0 importerów, należy do AI OS, nie M25) — błędna atrybucja w inwentarzu. Zaufanie/wartość obniżają: **read-IDOR** `GET /settings/notifications` (`userId` z query bez guarda, podczas gdy bliźniaczy POST `:912` guard MA — asymetryczne przeoczenie), **sekrety integracji plaintext at rest** (CalDAV base64 `:2000`, OAuth tokeny bez encrypt), **pilot gating tylko FE** (serwer nie zna pilota → pilot przez API może api-keys/webhooks/notifications), oraz dług funkcjonalny: Shortcuts to UI bez globalnego dispatchera (rebind no-op `:523`), Feature flags w Developer to read-only viewer, `/settings/billing` daje „Section not found" mimo route/enum.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_G sekcja USTAWIENIA, poz.1-12 (~35 sekcji w 10 grupach). **Nowe od 2026-06-08:** brak istotnych zmian funkcjonalnych (głównie autofix lint/QA).
**Scenariusze krytyczne (7):**
1. **S1** — Profile edit → save → reload → trwałość.
2. **S2** — Notifications toggle → persist (read-back po reload).
3. **S3** — Security: zmiana hasła / MFA / revoke sesji.
4. **S4** — Integrations: Calendar Sync connect/disconnect.
5. **S5** — GDPR: eksport + usunięcie konta z weryfikacją hasła (klient fraza+hasło, serwer bcrypt+grace).
6. **S6** — AI settings (behavior/model/memory) save → trwałość.
7. **S7** — Theme/Language → persist + efekt app-wide.
**Obowiązujące kanony:** §27 — **N/D** (żadna sekcja nie używa kanonicznej tabeli listowej; to samo w sobie luka standardu) · CARD_CONTENT_FORMULA: NIE · wzorzec hubowy: własny dwukolumnowy shell settings (`SettingsView.tsx:317`, świadomy) · beta-gating: NIE (core otwarte; pilot ograniczony do profile/auth-access/language/theme).

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Zbiorczo: **REALNE 10 · MOCK-STUB 1 (feature flags viewer) · UKRYTE/no-op 1 (Shortcuts) · STUB route-only 1 (Billing) · MARTWE 2 (SettingsSidebar legacy, VoiceSettingsPanel orphan).**

### 1a. REALNE (zweryfikowane)
- Profile/Avatar/Signatures/Working Hours (`SettingsView.tsx:337-344`), Dashboard/Work Prefs/Regional/Language (`LanguageSettings:87`), AI 8 sekcji (`AIBehavior:103,132,146` — dawne 503 NIE występuje na surface usera), Notifications 4 (read-back sounds/dnd), Security v2 (legacy URL redirect), Integrations 4 z org-scoped Calendar Sync realnym, **GDPR Data&Consent** (bcrypt verify `:3028` + 30d grace `:3035`), Privacy, Theme/Accessibility (app-wide), Advanced Import/Export/Templates/History.

### 1b. MOCK / STUB / fabrykowane klientem
- **[P2] Feature flags (Developer)** — read-only viewer (Badge, brak write); `developerMode` persystuje (`saveDeveloperSettings:157`), ale flagi nie są edytowalne stąd.

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[P1] Keyboard Shortcuts UKRYTE + no-op** — UI rebindu istnieje, ale brak globalnego dispatchera; rebind nic nie robi (`:523`). (zgodne z inwentarzem)
- **[P1] `/settings/billing` „Section not found"** — `routeConfig:149,415` mapuje `AppView.SETTINGS_BILLING`→`/settings/billing`, ale brak `case` sekcji → pułapka nawigacyjna. Billing żyje w Admin/Organization.
- **[P2] ciche degradacje `catch→[]`** bez komunikatu — `/login-history` (`:5620`), `/connected-accounts` (`:5646`).

### 1d. UKRYTE / MARTWY KOD
- **[MARTWY] `layout/SettingsSidebar.tsx`** — 0 konsumentów (żywy to `settings/SettingsSidebar.tsx`) → wytnij.
- **[MARTWY] `VoiceSettingsPanel.tsx`** — 0 importerów, źródło false-negative „not configured"; należy do AI OS, nie M25 → wytnij/rozstrzygnij w M22.
- **[ROZSTRZYGNĄĆ] `BillingSettings.tsx`** — czy wpiąć pod `/settings/billing`, czy usunąć route/enum.

### 1e. Wiring FE↔BE↔DB
| Grupa | Endpoint | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Preferences (rdzeń) | `GET/PUT /settings/preferences/:key` | user_preferences (user_id,key,value) | tak | DZIAŁA (persist+read-back, próbka 6/6) |
| Notifications | `GET/POST /settings/notifications` | user_preferences | tak | DZIAŁA; **GET read-IDOR (P1)** |
| GDPR delete/export | `/settings/gdpr/deletion-request` (+ `/request-deletion`) | gdpr_requests | tak | DZIAŁA (bcrypt+30d grace, self-scoped) |
| Integrations/Calendar | `/settings/integrations/*` | integration_* | tak | DZIAŁA (org-scoped) |
| API Keys/Webhooks | `/settings/api-keys`, `/settings/webhooks` | api_keys, webhooks | tak | DZIAŁA (hash+prefix, `WHERE id=? AND user_id=?`) |
| Security/sesje | `/settings/login-history`, sessions | user_sessions | tak | DZIAŁA (user-scoped); catch→[] cicho |
| Billing | route `/settings/billing` | — | — | ZERWANE (brak sekcji → „Section not found") |

### 1f. Flagi
| Flaga | Default BE | Default FE | Kto włącza | Wpływ |
|---|---|---|---|---|
| Feature flags (Developer) | viewer-only | read-only | superadmin (gdzie indziej) | brak edycji z Settings; tylko podgląd |
| developerMode | persystuje | toggle | user | `saveDeveloperSettings:157` |
| pilot VTS (sekcje) | — | UI redirect | rola | ogranicza do profile/auth-access/language/theme **tylko FE** |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Plik:linia | Status |
|---|---|---|---|---|
| WYJŚCIE → | cała app | theme app-wide | Theme settings | DZIAŁA |
| WYJŚCIE → | i18n / cała app | language | `LanguageSettings:87` | DZIAŁA |
| WYJŚCIE → | M01 Czat / Teresa | AI prefs (behavior/model/memory) | AI settings | DZIAŁA |
| WYJŚCIE → | konto/auth | GDPR delete (scheduled+grace) | `gdprService.ts:175` | DZIAŁA |
| WYJŚCIE → | M21 Meeting/Kalendarz | Calendar Sync | integrations | DZIAŁA |
| WYJŚCIE → | (brak) | Shortcuts → dispatcher | `:523` | ZERWANE (brak dispatchera) |
| WYJŚCIE → | M24 Admin/Org | billing | `/settings/billing` | ZERWANE (route-only) |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `809ba27152`):** **286 PASS / 43 FAIL / 18 SKIP.**
| Grupa | PASS | FAIL | SKIP |
|---|---|---|---|
| FE component (smoke + settings) | 44 | 6 | 0 |
| FE unit „honesty" + views/settings | 94 | 36 | 0 |
| FE services + i18n + backend-js | 33 | 0 | 0 |
| Integracyjne PG | 38 | 0 | 18 |
| server/src routes (settings/integr/roles) | 41 | 1 | 0 |
| featureFlagService | 36 | 0 | 0 |

**Root-cause 43 FAIL (większość = drift harnessu, nie produkt):**
- **mock-drift react-i18next** (~34) — komponenty na `t(key,{defaultValue})`, mock zwraca obiekt → „Objects are not valid as a React child" (wzorzec M13/M14).
- **brak `<Router>`** (~14, część nakłada się) — ProfileSettings dostał `useNavigate()`, testy renderują bez routera.
- **stale import** (2) — `@/views/settings/AIPreferencesModule` nie istnieje (wzorzec M13/M14).
- **assertion-drift** (2) AIUsageDashboard; **RBAC roles** (1, peryferyjne M24).
- 1 plik niezebrany: `notification-settings.l3.test.ts` PG `role "iris" does not exist` (brak lokalnego PG).

**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | CI (PR-gate) | Luka |
|---|---|---|---|---|---|
| S1 Profile | mock serwisu | ✓ | ✗ | ✗ | „honesty" mockuje Api (render, nie zachowanie) |
| S2 Notifications | ✗ | częśc. | ✗ | ✗ | brak persist-test |
| S3 zmiana hasła | ✗ | **✗** | ✗ | ✗ | **ścieżka krytyczna bez testu** |
| S4 Calendar connect | ✗ | ✗ | ✗ | ✗ | brak |
| S5 GDPR-delete bcrypt | ✗ | **✗** | ✗ | ✗ | **test celuje w bezhasłową `request-deletion`, nie w bcrypt-trasę** |
| S6 AI settings | ✓ | ✓ | ✗ | ✗ | realnie zielone BE |
| S7 Theme/Language | ✓ | ✓ | ✗ | ✗ | zielone |

**Pułapka CI:** `test-suite.yml` gate'uje tylko PR → `main`/`develop`; default branch = **`Londyn`** → zmiany M25 mergowane do `Londyn` **nie uruchamiają żadnego suite**. `i18n-check` jest `continue-on-error` i tylko przy zmianie locales. (Wspólne systemowe z M13/M14.)

**Backlog testowy (12 poz.):**
1. [P0] test bcrypt-deletion (S5) celujący w `/settings/gdpr/deletion-request` (nie w bezhasłowy duplikat).
2. [P0] test zmiany hasła z Settings (S3).
3. [P0] guard/usunięcie bezhasłowego duplikatu `/request-deletion` + test.
4. [P1] globalny helper mocka i18n (`defaultValue`) — kasuje ~34 FAIL.
5. [P1] owinięcie ProfileSettings w `<Router>` w testach.
6. [P1] usunięcie testów-duchów `AIPreferencesModule`; real connect/disconnect Calendar (S4); odbudowa e2e settings.
7. [P2] AIUsageDashboard assertion, env-guard PG, sprzątanie plików-duchów, dopisać `Londyn` do triggera CI.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: preferences GET/PUT, notifications, GDPR deletion-request (bcrypt — NIE wykonywać realnego delete na prod!), integrations, api-keys, login-history. Migracje (user_preferences, gdpr_requests, api_keys, webhooks, user_sessions). **Uwaga DB:** dev `.env` może wskazywać Railway PROD — ostrożność, zwłaszcza przy GDPR/delete.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 7 scenariuszy z reloadem; szczególnie: toggle persist po reload (S2/S7), GDPR delete flow z hasłem (S5 — bez realnego usunięcia konta), `/settings/billing` „Section not found" (potwierdzić UX), Shortcuts rebind no-op, rola pilot vs pełny user (które sekcje widoczne).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S7 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27 TABLE_AND_PREVIEW_CANON: N/D — i to luka.** Żadna sekcja nie używa kanonicznej tabeli listowej (0 trafień `<table>`/UnifiedTable w Webhooks/API Keys/Connected Apps/Prompt Library/Login History/Sessions/History/Templates) — wszystko layouty kartowe. Sesje/keys/webhooks/historia logowań to dane, które gdzie indziej byłyby tabelą z Menu 1/2/3 + sort + empty; tu brak kanonu list. **[P2]**
**Wzorzec hubowy:** własny dwukolumnowy shell (sidebar grup + content, `SettingsView.tsx:317`) — spójny, świadomy (nie ModuleHub). OK.
**UI-standards:** **[P1] 2237 hardkodów palety Tailwind** (`bg/text/border-{rose,blue,amber...}-NNN`) zamiast tokenów w `src/components/settings/`. Korupcja „roseuction"/„rose" już posprzątana (0 trafień).
**i18n PL/EN:** dobre pokrycie (`t(` 128× w 93 plikach); drobna luka — `sectionMeta` w SettingsView z EN-fallbackiem przez `t('settings.sections.*', meta)`; zweryfikować czy klucze locale istnieją (inaczej zawsze EN). **[P2]**
**Stany:** cicha degradacja `catch→[]` bez komunikatu w `/login-history` (`:5620`), `/connected-accounts` (`:5646`).

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **Warstwa per-user solidna; jeden read-IDOR; pilot nie egzekwowany serwerowo; sekrety integracji plaintext.**
| Warstwa | Nawigacja | Route | API | Dziura? |
|---|---|---|---|---|
| Settings (per-user) | sidebar otwarty | zalogowany | per-route `verifyToken`, `WHERE user_id=?` | — |
| GET /notifications | — | — | `userId` z query bez guarda | **TAK (P1 read-IDOR)** |
| Pilot VTS sekcje | UI redirect | — | brak gatingu serwerowego | **TAK (P2)** |
| Integracje (sekrety) | — | — | plaintext at rest | **TAK (P2)** |

**Findingi:**
- **[P1] read-IDOR `GET /api/settings/notifications`** — `settings.routes.ts:868` `const userId = (req.query.userId as string) || req.user?.id` → `SELECT ... WHERE user_id=?` bez sprawdzenia `requesterId !== userId`; bliźniaczy POST (`:912`) guard MA (`requesterId !== userId && role∉{owner,admin}→403`). User A czyta prefs notyfikacji usera B przez `?userId=B`. **Zweryfikowane osobiście.** Niska wrażliwość danych, read-only → P1, ale spełnia kryterium hard-cap „cross-org leak" (userId globalny, możliwy cross-org). Fix: usunąć źródło `req.query.userId`, zawsze `req.user.id`.
- **[P2] sekrety integracji plaintext at rest** — CalDAV login:hasło jako base64 (`settings.routes.ts:2000`), OAuth `access_token`/`refresh_token` bez encrypt (`integrationOAuthEngine.ts:623-648`). Dump DB = wyciek żywych poświadczeń.
- **[P2] pilot gating tylko FE** — `PILOT_ALLOWED_SETTINGS_SECTIONS` (`pilotAccess.ts:14`) egzekwowane wyłącznie redirectem (`SettingsView.tsx:261-265`); serwer nie zna pilota → pilot przez API może api-keys/webhooks/notifications/integracje (wzorzec M13/M14).
- **[P2] bezhasłowy duplikat usuwania konta** — `POST /settings/request-deletion` (`:2634`) self-scoped (`req.user.id`), tylko *planuje* (30d grace, `createAccountDeletionRequest`→`gdprService.ts:175`, status 'scheduled') — NIE hard-delete, NIE cross-user. Ale omija konfirmację hasłem obecną w `/settings/gdpr/deletion-request`. Fix: dodać bramkę hasła lub usunąć duplikat (FE używa wersji z hasłem).

**Ścieżki krytyczne OK (naprawy potwierdzone — nie powielać):** GDPR delete hasło-bcrypt+self-scope+30d grace+export 410; API Keys/Webhooks hash+prefix bez leak sekretu, mutacje `WHERE id=? AND user_id=?`; sesje/login-history user-scoped. Org NIE spoofowalny z nagłówka (membership-checked). Hasło/MFA żyją w `auth.routes` → audyt w module Auth/Security (poza M25).

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0/P1)
1. **Fix read-IDOR `GET /notifications`** — usunąć `req.query.userId`, zawsze `req.user.id` (lub guard jak w POST) — Weryfikacja: `?userId=<inny>` → własne dane / 403, nie cudze.
2. **Bramka hasła lub usunięcie `/request-deletion`** — ujednolicić z password-gated `/gdpr/deletion-request` — Weryfikacja: jedyna ścieżka usunięcia wymaga hasła; test bcrypt.
3. **Testy ścieżek krytycznych S3+S5** — zmiana hasła + GDPR-delete bcrypt (nie bezhasłowy duplikat) — Weryfikacja: zielone, w PR-gate.

### Fala 2 — Domknięcie wartości (P1)
1. **Rozstrzygnij billing** — wpiąć `BillingSettings.tsx` pod `/settings/billing` albo usunąć route/enum (koniec „Section not found") — Weryfikacja: brak martwej trasy.
2. **Keyboard Shortcuts** — globalny dispatcher albo ukryć rebind UI — Weryfikacja: skrót działa lub sekcja znika.
3. **Komunikat przy degradacji** login-history/connected-accounts (zamiast cichej `[]`) — Weryfikacja: baner/log przy błędzie.
4. **Feature flags** — edytowalne lub jawnie oznaczone „read-only (zarządzane przez superadmin)" — Weryfikacja: brak wrażenia martwej kontrolki.
5. **Szyfrowanie sekretów integracji** (CalDAV/OAuth) at rest — Weryfikacja: brak plaintext w DB.

### Fala 3 — Jakość i kanony (P2)
1. **2237 hardkodów palety → tokeny** w `src/components/settings/` — Weryfikacja: lint koloru czysty.
2. **Kanon list** dla sesji/api-keys/webhooks/login-history (`FilterableTable` + sort + empty) — Weryfikacja: §27 spełnione gdzie zasadne.
3. **Pilot gating serwerowo** — sekcje poza `PILOT_ALLOWED_*` odrzucane przez API dla pilota — Weryfikacja: pilot API → 403.
4. **Wytnij martwy kod** — `layout/SettingsSidebar.tsx`, `VoiceSettingsPanel.tsx` (→M22) — Weryfikacja: 0 referencji.
5. **i18n** — fix mocka (defaultValue), `<Router>` w testach, klucze `settings.sections.*` w PL.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. S3/S5) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje + flagi + smoke 200 + czyste logi
- [ ] 4. Kanony: hardkody palety → tokeny, kanon list gdzie zasadne
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (billing, shortcuts, feature flags viewer)
- [ ] 6. Zero cichych degradacji bez komunikatu (login-history/connected-accounts)

---
**Pozostałe do domknięcia audytu M25:** Faza 3 (Railway) + Faza 4 (żywe 7 scenariuszy). Read-IDOR `/notifications` to jedyny blocker bezpieczeństwa (P1); po jego naprawie + Fazach 3/4 moduł realnie kandyduje do Beta (najzdrowszy w puli core).
