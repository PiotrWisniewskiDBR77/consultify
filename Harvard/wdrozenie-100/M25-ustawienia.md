# TECZKA M25 — Ustawienia (Settings) · pełna teczka reuse-first

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu §1–§7 + evidence) i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami). **Brak uwag żywych dla M25** — dziedziczy z karty. Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M25 Ustawienia (Profile · Notifications · Security · Integrations · GDPR · AI · Theme/Language) · **Pula:** core — najzdrowszy moduł puli core
- **Ocena audytu:** 54/100 · **Status:** FAZA 2/3 → FAZA 4 (sweepy: 2237 hardkodów palety) · **Rozmiar:** S
- **Żywy bloker:** brak P0 (1×P1 read-IDOR) · **Brak uwag żywych** w `UWAGI_TESTY_2026-06-13.md`
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M25-ustawienia/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/settings/` (VoiceSettings, LanguageSettings, AIBehavior, ProfileSettings, BillingSettings) · `src/views/SettingsView.tsx` · `src/views/settings/` (IntegrationsModule, SettingsSidebar) · `server/src/routes/settings.routes.ts` · `server/src/services/gdprService.ts` · `server/src/services/integrationOAuthEngine.ts` · `src/utils/pilotAccess.ts`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (7 scenariuszy) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 (§27 N/D = luka) | delta billing/shortcuts/flags |
| C Dane+API+reguły | 🟢 | karta §1e (wiring) + §1f | link + reguła GDPR/IDOR (niżej) |
| D AI/Teresa | 🟢 | karta §1a (AI prefs, voice false-negative OBALONY) | — |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (3 fale) | epiki (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** dać użytkownikowi kontrolę nad kontem i preferencjami — profil, powiadomienia, bezpieczeństwo (hasło/MFA/sesje), integracje, GDPR (eksport/usunięcie), AI prefs, motyw/język app-wide.
- **Persony/role:** każdy zalogowany (self-scoped `req.user.id`); pilot ograniczony do profile/auth-access/language/theme (gating dziś tylko FE, L-03). Core otwarty.
- **Zakres v1:** trwały `user_preferences` przez `GET/PUT /settings/preferences/:key` · GDPR delete (bcrypt+30d grace) · API Keys/Webhooks (hash+prefix) · sesje/login-history · Calendar Sync org-scoped · Theme/Language app-wide. **POZA v1:** Keyboard Shortcuts (UI bez dispatchera, no-op — L-05); Feature flags edytowalne (read-only viewer — L-06); billing (żyje w Admin/Organization — L-04).
- **Metryka:** toggle persist po reload; jedyna ścieżka usunięcia konta wymaga hasła; sekrety integracji szyfrowane at rest.

## B · UX DOCELOWE *(link + delty)*
Stany + kanony: karta §5. **§27 = N/D i to luka** — sesje/api-keys/webhooks/login-history to layouty kartowe, gdzie indziej byłyby tabelą z Menu 1/2/3 + sort + empty → FilterableTable gdzie zasadne. Korupcja „roseuction"/„rose" już posprzątana (0 trafień).
**Delty (z karty, nie z testów żywych):**
- **billing „Section not found":** `routeConfig:149,415` mapuje `AppView.SETTINGS_BILLING`→`/settings/billing`, brak `case` sekcji → pułapka nawigacyjna (billing żyje w Admin/Organization). Docelowo: wpiąć `BillingSettings.tsx` ALBO usunąć route/enum (L-04).
- **Keyboard Shortcuts:** UI rebindu istnieje, brak globalnego dispatchera, rebind no-op (`:523`). Docelowo: dispatcher ALBO ukryć rebind (L-05).
- **Feature flags (Developer):** read-only viewer (Badge, brak write); `developerMode` persystuje, flagi nie. Docelowo: edytowalne ALBO jawnie „read-only (zarządzane przez superadmin)" (L-06).

## C · DANE + API + REGUŁY *(link + reguła GDPR/IDOR)*
- **Wiring FE↔BE↔DB:** karta §1e (`user_preferences`/`gdpr_requests` realne; integracje org-scoped; GDPR bcrypt+grace; login-history/connected-accounts amber baner `7495c12ffb`). **Flagi:** pilot (FE-only redirect, L-03); developerMode.
- **Reguła GDPR (kanon):** jedyna ścieżka usunięcia konta = `/settings/gdpr/deletion-request` z weryfikacją hasła bcrypt (`settings.routes.ts:3028`), self-scoped, 30d grace, export z 410 po wygaśnięciu. **Duplikat bezhasłowy** `POST /settings/request-deletion` (`:2634`) tylko planuje (status 'scheduled', `gdprService.ts:175`) — omija bramkę hasła → dodać bramkę ALBO usunąć (L-02).
- **Reguła IDOR (L-01):** `GET /settings/notifications` (`:868`) `userId = req.query.userId || req.user.id` → `WHERE user_id=?` bez `requesterId !== userId`; bliźniaczy POST (`:912`) guard MA. Docelowo: zawsze `req.user.id`.

## D · AI / TERESA *(link)*
- AI prefs (8 sekcji, `AIBehavior:103,132,146` — dawne 503 NIE występuje na surface usera) → M01 Czat/Teresa. **Voice & TTS false-negative OBALONY** — żywy `VoiceSettings.tsx` nie ma logiki „not configured"; defekt żyje w `VoiceSettingsPanel.tsx` (0 importerów, należy do M22 AI OS — błędna atrybucja w inwentarzu, `finding_v10_voice_config_false_negative`).

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **→** cała app (theme/language app-wide), M01 Czat/Teresa (AI prefs), M21 Meeting (Calendar Sync), konto/auth (GDPR delete `gdprService.ts:175`). **Zależność:** `VoiceSettingsPanel.tsx` cleanup → koordynować z M22 (gdzie żyje źródło false-negative); hasło/MFA żyją w `auth.routes` → poza M25 (audyt w module Auth/Security).

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Integralność bezpieczeństwa (P1):** ~~read-IDOR notifications~~ `b9f2dee9d2`; ~~Bramka D CalDAV/OAuth AES-256-GCM~~ `9ef570ca1b`; ~~login-history amber baner~~ `7495c12ffb`. Pozostaje: zweryfikować pokrycie fixu IDOR + AES (R3, L-01); bramka hasła duplikatu delete (L-02). [Fala 1/2]
- **EPIK 2 — Domknięcie front↔back (P1):** billing wpiąć/usunąć (L-04); Shortcuts dispatcher/ukryć (L-05); Feature flags edytowalne/jawnie read-only (L-06). [Fala 2]
- **EPIK 3 — Gating + cleanup (P2/P3):** pilot gating serwerowy → 403 (L-03); wytnij `layout/SettingsSidebar.tsx` + `VoiceSettingsPanel.tsx`→M22. [Fala 3]
- **EPIK 4 — Testy (P0-test):** S3 (zmiana hasła); S5 (GDPR-delete bcrypt na właściwej trasie, nie bezhasłowej); helper mocka i18n; `<Router>` w testach; real connect/disconnect Calendar (S4). [Fala 2]
- **EPIK 5 — Tokeny + §27 (P1/P2):** 2237 hardkodów palety → tokeny Visual Standard; FilterableTable dla sesji/keys/webhooks/login-history; `Londyn` do CI. [Fala 4]

## G · JAKOŚĆ / DoD *(skwantyfikowane)*
| # | Kryterium | Miara M25 |
|---|-----------|-----------|
| 1 | Front↔back | koniec „Section not found" (billing wpięty/usunięty); Shortcuts działa/ukryty; Feature flags edytowalne/jawnie read-only; 0 martwych kontrolek |
| 2 | Bezpieczeństwo | read-IDOR `/notifications` ✅ `b9f2dee9d2` (R3: zweryfikować że źródło `req.query.userId` usunięte); jedyna ścieżka delete = hasło; sekrety AES ✅ `9ef570ca1b` (R3: potwierdzić pokrycie CalDAV+OAuth); pilot gating serwerowy (403) |
| 3 | i18n | **53** inline (`i18n.language==='pl'`/`isPolish`) w `src/components/settings/`; klucze `settings.sections.*` w PL (nie EN-fallback); helper mocka `defaultValue` |
| 4 | Tokeny | **119** hex w `src/components/settings/` (+ **9** w `src/views/settings/`); dług palety = **2237 hardkodów Tailwind** `bg/text/border-{rose,blue,amber}-NNN` → tokeny Visual Standard (lint koloru czysty) |
| 5 | §27 | **7** surowych `<table>` w `src/components/settings/`; sesje/api-keys/webhooks/login-history przez FilterableTable + sort + empty gdzie zasadne (dziś N/D = luka) |
| 6 | E2E w PR-gate | S3 (zmiana hasła) + S5 (GDPR bcrypt) zielone na `Londyn` (dziś 0 — `test-suite.yml` tylko main/develop) |

Scenariusze S1–S7 + pokrycie: karta §0/§2. Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | najzdrowszy core; read-IDOR+AES naprawione; dług funkcjonalny + paleta | L-01..L-09 |
| W-02 | **Uwagi żywe** | 2026-06-13 | **BRAK uwag M25** w `UWAGI_TESTY_2026-06-13.md` (dziedziczy z karty) | — |
| W-03 | `finding_v10_voice_config_false_negative` | 2026-06-08 | voice false-negative = `VoiceSettingsPanel.tsx` (M22), nie M25 | cleanup (L-08) |
| W-04 | Decyzje produktowe (D9 GDPR, pricing/billing w Admin) | 2026-06-02 | billing żyje w Admin/Organization | L-04 |
| W-05 | Feedback prod (`finding_railway_db_topology`, `feedback_prod_caution`) | — | dev `.env` → Railway PROD; ostrożność przy GDPR/delete | ryzyko (niżej) |

### 02 · Stan obecny (prawda kodu) — karta §1 (REALNE 10/12 · Shortcuts UKRYTE/no-op · Feature flags read-only · Billing route-only). Naprawione: `b9f2dee9d2` (read-IDOR notifications), `9ef570ca1b` (Bramka D AES-256-GCM CalDAV/OAuth), `7495c12ffb` (login-history/connected-accounts amber baner).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | read-IDOR `GET /settings/notifications` | W-01 | `settings.routes.ts:868` (POST `:912` ma guard) | P1 | 2 | **NAPRAWIONE `b9f2dee9d2` (R3: zweryfikować że źródło `req.query.userId` usunięte)** |
| L-02 | bezhasłowy duplikat usuwania konta | W-01 | `settings.routes.ts:2634`, `gdprService.ts:175` | P1 | 2 | otwarta |
| L-03 | pilot gating tylko FE (serwer nie zna pilota) | W-01 | `pilotAccess.ts:14`, `SettingsView.tsx:261-265` | P2 | 3 | otwarta |
| L-04 | billing „Section not found" (route bez case) | W-01,W-04 | `routeConfig:149,415` | P1 | 2 | otwarta (D-01) |
| L-05 | Keyboard Shortcuts UI bez dispatchera (no-op) | W-01 | `:523` | P1 | 2 | otwarta (D-02) |
| L-06 | Feature flags read-only viewer (brak write) | W-01 | `:157` | P2 | 2 | otwarta (D-03) |
| L-07 | sekrety integracji plaintext at rest | W-01 | CalDAV `:2000` base64, OAuth `integrationOAuthEngine.ts:623-648` | P2 | 2 | **NAPRAWIONE `9ef570ca1b` (R3: potwierdzić pokrycie CalDAV+OAuth)** |
| L-08 | martwy kod (`layout/SettingsSidebar.tsx`, `VoiceSettingsPanel.tsx`→M22) | W-01,W-03 | 0 konsumentów / 0 importerów | P2 | 3 | otwarta |
| L-09 | 2237 hardkodów palety + §27 N/D + i18n inline (53) | W-01 | `src/components/settings/` | P1/P2 | 4 | otwarta |
| L-10 | testy S3 (hasło) + S5 (GDPR bcrypt na właściwej trasie) brak; mock-drift ~34+14 FAIL | W-01 | f2_tests_report | P0-test | 2 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | billing: wpiąć pod `/settings/billing` czy usunąć route/enum? | wpiąć `BillingSettings.tsx` / usunąć (billing w Admin) | Piotr | TBD | otwarta |
| D-02 | Keyboard Shortcuts: globalny dispatcher czy ukryć rebind? | dispatcher / ukryć UI | Piotr | TBD | otwarta |
| D-03 | Feature flags: edytowalne czy jawnie read-only? | edytowalne / „read-only (superadmin)" | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — pilot (FE-only redirect, gating→serwer L-03); developerMode persystuje (flagi nie); core otwarty. `VoiceSettingsPanel.tsx` cleanup koordynować z M22.
### 06 · Ryzyka — **L-01 i L-07 oznaczone NAPRAWIONE w karcie → R3: zweryfikować w kodzie** (czy `req.query.userId` usunięte; czy AES pokrywa wszystkie sekrety CalDAV+OAuth) przed zamknięciem. GDPR/delete na prod = szczególna ostrożność, NIE wykonywać realnego usunięcia konta (`feedback_prod_caution`). Dev `.env` → Railway PROD. Brak uwag żywych → re-ocena D wymaga Fazy 4.
### 07 · Log — 2026-06-13: brak uwag żywych; teczka dziedziczy z karty. Audyt 2026-06-11: ocena 54/100; `b9f2dee9d2`, `9ef570ca1b`, `7495c12ffb`. Re-ocena D/G po Fazie 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + jawne „brak uwag żywych M25" + voice finding + decyzje produktowe + feedback prod) · R2 zero sierot (wejście→luka→DoD) · R3 L-01/L-07 „NAPRAWIONE — zweryfikować pokrycie" (nie dziedziczone) · R4 DoD z liczbami (53 inline + 2237 palety · 7 table · 119+9 hex) · R5 decyzje z właścicielem (terminy TBD) · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4 (zaplanowana). **Teczka kompletna do egzekucji.**
