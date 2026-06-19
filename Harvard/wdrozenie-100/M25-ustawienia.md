# TECZKA M25 — Ustawienia (Settings) · pełna teczka reuse-first

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu §1–§7 + evidence) i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · enumeracja API · epiki→stories Gherkin→L-xx). **Brak uwag żywych dla M25** — dziedziczy z karty. Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja głębi (PODŁOGA): [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M25 Ustawienia (Profile · Notifications · Security · Integrations · GDPR · AI · Theme/Language) · **Pula:** core — najzdrowszy moduł puli core
- **Ocena audytu:** 54/100 · **Status:** FAZA 2/3 → FAZA 4 (sweep palety) · **Rozmiar:** S
- **Żywy bloker:** brak P0 (1×P1 read-IDOR — **R3: zweryfikowany NAPRAWIONY w kodzie 2026-06-13**) · **Brak uwag żywych** w `UWAGI_TESTY_2026-06-13.md`
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13 (pogłębiona)
- **Karta:** `Harvard/modules/M25-ustawienia/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/settings/` (VoiceSettings, LanguageSettings, AIBehavior, ProfileSettings, BillingSettings) · `src/views/SettingsView.tsx` · `src/views/settings/` (IntegrationsModule, SettingsSidebar) · `server/src/routes/settings.routes.ts` (**123 endpointy**) · `server/src/services/gdprService.ts` · `server/src/services/integrationOAuthEngine.ts` · `src/utils/pilotAccess.ts`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (7 scenariuszy) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 (§27 N/D = luka) | stany + delta billing/shortcuts/flags (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e (wiring) + §1f | **enumeracja API + reguła GDPR/IDOR** (niżej) |
| D AI/Teresa | 🟢 | karta §1a (AI prefs, voice false-negative OBALONY) | — |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (3 fale) | **epiki→stories Gherkin→L-xx** (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby zmierzone** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + R3 IDOR + DP-11 billing** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** dać użytkownikowi kontrolę nad kontem i preferencjami — profil, powiadomienia, bezpieczeństwo (hasło/MFA/sesje), integracje, GDPR (eksport/usunięcie), AI prefs, motyw/język app-wide.
- **Persony/role:** każdy zalogowany (self-scoped `req.user.id`); pilot ograniczony do profile/auth-access/language/theme (gating dziś tylko FE, L-03). Core otwarty.
- **Zakres v1:** trwały `user_preferences` przez `GET/PUT /settings/preferences/:key` · GDPR delete (bcrypt+30d grace) · API Keys/Webhooks (hash+prefix) · sesje/login-history · Calendar Sync org-scoped · Theme/Language app-wide. **POZA v1:** Keyboard Shortcuts (UI bez dispatchera, no-op — L-05); Feature flags edytowalne (read-only viewer — L-06, DP-10 internal); **billing (żyje w Admin/M24, jedno miejsce, label managed — DP-11; route `/settings/billing` martwy → usunąć/wpiąć, L-04)**.
- **Metryka:** toggle persist po reload; jedyna ścieżka usunięcia konta wymaga hasła; sekrety integracji szyfrowane at rest.

## B · UX DOCELOWE *(link + delty + stany)*
Stany + kanony: karta §5.
- **Stany ekranu:** pusty (brak api-keys → CTA), ładowanie, **błąd** (amber baner z Retry `7495c12ffb` — naprawione dla login-history/connected-accounts; reszta `catch→[]` cicha do domknięcia), pełny, brak-uprawnień (pilot redirect, dziś tylko FE L-03).
- **§27 = N/D i to luka** — sesje/api-keys/webhooks/login-history to layouty kartowe, gdzie indziej byłyby tabelą z Menu 1/2/3 + sort + empty → FilterableTable gdzie zasadne. Korupcja „roseuction"/„rose" posprzątana (0 trafień).
- **Delty (z karty, nie z testów żywych):**
  - **billing „Section not found":** `routeConfig:149,415` mapuje `AppView.SETTINGS_BILLING`→`/settings/billing`, brak `case` sekcji → pułapka nawigacyjna (billing żyje w Admin/Organization). Docelowo: usunąć route/enum (DP-11: billing = jedno miejsce Admin) ALBO wpiąć `BillingSettings.tsx` (L-04, D-01).
  - **Keyboard Shortcuts:** UI rebindu istnieje, brak globalnego dispatchera, rebind no-op (`:523`). Docelowo: dispatcher ALBO ukryć rebind (L-05, D-02).
  - **Feature flags (Developer):** read-only viewer (Badge, brak write); `developerMode` persystuje, flagi nie. Docelowo: jawnie „read-only (zarządzane przez superadmin)" (L-06, D-03; spójne z DP-10 — flagi zarządzane z M27).

## C · DANE + API + REGUŁY *(enumeracja + reguła GDPR/IDOR)*
- **Wiring FE↔BE↔DB:** karta §1e (`user_preferences`/`gdpr_requests` realne; integracje org-scoped; GDPR bcrypt+grace; login-history/connected-accounts amber baner `7495c12ffb`). **Flagi:** pilot (FE-only redirect, L-03); developerMode.
- **Model danych:** `user_preferences (user_id,key,value)`, `gdpr_requests`, `api_keys`, `webhooks`, `user_sessions`, `integration_*`. Pułapki bigint/jsonb → `pgFlags.ts`.
- **API kluczowe (`settings.routes.ts` = 123 endp., self-scoped `req.user.id`):**
  - `GET/PUT /settings/preferences/:key` — rdzeń, persist+read-back (próbka 6/6).
  - `GET /settings/notifications` (`:868`) / `POST` (`:912`) — **R3: oba mają guard** `requesterId = req.user?.id` (`:904`) + `if (requesterId !== userId && actorRole∉{owner,admin})→403` (`:912`); read-IDOR L-01 **NAPRAWIONE** `b9f2dee9d2`.
  - `POST /settings/gdpr/deletion-request` (`:3028`) — jedyna ścieżka = weryfikacja hasła bcrypt, self-scoped, 30d grace, export 410 po wygaśnięciu.
  - `POST /settings/request-deletion` (`:2634`) — **duplikat bezhasłowy** (status 'scheduled', `gdprService.ts:175`) omija bramkę hasła → dodać bramkę ALBO usunąć (L-02).
  - `/settings/api-keys`, `/settings/webhooks` — hash+prefix, mutacje `WHERE id=? AND user_id=?`.
- **Reguła GDPR (kanon):** jedyna droga usunięcia konta = password-gated bcrypt + grace; duplikat bezhasłowy = luka L-02.
- **Reguła IDOR (L-01, NAPRAWIONA):** `GET /notifications` ma teraz `req.user.id` guard (był `req.query.userId` bez `requesterId !== userId`).

## D · AI / TERESA *(link)*
- AI prefs (8 sekcji, `AIBehavior:103,132,146` — dawne 503 NIE występuje na surface usera) → M01 Czat/Teresa. **Voice & TTS false-negative OBALONY** — żywy `VoiceSettings.tsx` nie ma logiki „not configured"; defekt żyje w `VoiceSettingsPanel.tsx` (0 importerów, należy do M22 AI OS — błędna atrybucja w inwentarzu, `finding_v10_voice_config_false_negative`).

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **→** cała app (theme/language app-wide), M01 Czat/Teresa (AI prefs), M21 Meeting (Calendar Sync), konto/auth (GDPR delete `gdprService.ts:175`). **Zależność blokująca:** `VoiceSettingsPanel.tsx` cleanup → koordynować z M22 (gdzie żyje źródło false-negative); hasło/MFA żyją w `auth.routes` → poza M25 (audyt w module Auth/Security); billing → M24 (DP-11).

## F · EPIKI → STORIES → ZADANIA *(z karty §7, forma Gherkin)*
- **EPIK 1 — Integralność bezpieczeństwa (P1):** read-IDOR + AES + amber baner naprawione; pozostaje duplikat delete.
  - **Story 1.1:** jako user A chcę nie czytać prefs usera B. *Dane* user A; *gdy* `GET /notifications?userId=B`; *wtedy* własne dane/403 (nie cudze). → **Z→L-01 (NAPRAWIONE `b9f2dee9d2`, R3 zweryfikowane: guard `req.user.id` `:904/:912`)**
  - **Story 1.2:** jako user chcę by jedyna droga delete wymagała hasła. *Dane* `POST /request-deletion` (bezhasłowy); *gdy* wywołanie; *wtedy* bramka hasła lub endpoint usunięty. → **Z→L-02**
  - **Story 1.3:** sekrety CalDAV/OAuth szyfrowane AES-256-GCM. → **Z→L-07 (NAPRAWIONE `9ef570ca1b`, R3 potwierdzić pokrycie CalDAV+OAuth)**
- **EPIK 2 — Domknięcie front↔back (P1):** billing/shortcuts/flags.
  - **Story 2.1:** koniec „Section not found" — usunąć route/enum (DP-11) lub wpiąć BillingSettings. → **Z→L-04 (D-01=DP-11)**
  - **Story 2.2:** Keyboard Shortcuts — dispatcher ALBO ukryć rebind. → **Z→L-05 (D-02)**
  - **Story 2.3:** Feature flags jawnie „read-only (zarządzane przez superadmin)" (DP-10). → **Z→L-06 (D-03)**
- **EPIK 3 — Gating + cleanup (P2/P3):**
  - **Story 3.1:** pilot gating serwerowy → 403 (dziś tylko FE redirect). → **Z→L-03**
  - **Story 3.2:** wytnij `layout/SettingsSidebar.tsx` + `VoiceSettingsPanel.tsx`→M22. → **Z→L-08**
- **EPIK 4 — Testy (P0-test):**
  - **Story 4.1:** S3 (zmiana hasła) + S5 (GDPR-delete bcrypt na właściwej trasie, nie bezhasłowej) zielone; helper mocka i18n (`defaultValue`); `<Router>` w testach; real connect/disconnect Calendar (S4). → **Z→L-10**
- **EPIK 5 — Tokeny + §27 (P1/P2, FAZA 4 sweep):**
  - **Story 5.1:** paleta hardkodów → tokeny Visual Standard (DP-8: palety wykresów legalne, reszta tokeny). → **Z→L-09**
  - **Story 5.2:** FilterableTable dla sesji/keys/webhooks/login-history; `Londyn` do CI. → **Z→L-09**

## G · JAKOŚĆ / DoD *(skwantyfikowane, zmierzone 2026-06-13)*
| # | Kryterium | Miara M25 |
|---|-----------|-----------|
| 1 | Front↔back | koniec „Section not found" (billing usunięty/wpięty, DP-11); Shortcuts działa/ukryty; Feature flags jawnie read-only; 0 martwych kontrolek |
| 2 | Bezpieczeństwo | read-IDOR `/notifications` ✅ `b9f2dee9d2` (R3: guard `req.user.id` zweryfikowany `:904/:912`); jedyna ścieżka delete = hasło; sekrety AES ✅ `9ef570ca1b` (R3: potwierdzić pokrycie CalDAV+OAuth); pilot gating serwerowy (403) |
| 3 | i18n | **53** inline (`i18n.language==='pl'`/`isPolish` — 2 pliki) w `src/components/settings/`; klucze `settings.sections.*` w PL (nie EN-fallback); helper mocka `defaultValue` |
| 4 | Tokeny | **119** hex w `src/components/settings/` (+ **9** w `src/views/settings/`); dług palety = **~1650** hardkodów Tailwind `(bg/text/border)-{rose,blue,amber}-NNN` (zmierzone wąsko; karta podaje 2237 szeroko) → tokeny (DP-8) |
| 5 | §27 | **7** surowych `<table>` w `src/components/settings/`; sesje/api-keys/webhooks/login-history przez FilterableTable + sort + empty gdzie zasadne (dziś N/D = luka) |
| 6 | E2E w PR-gate | S3 (zmiana hasła) + S5 (GDPR bcrypt) zielone na `Londyn` (dziś 0 — `test-suite.yml` tylko main/develop) |

Scenariusze S1–S7 + pokrycie: karta §0/§2. Bezpieczeństwo: karta §6.
- **Wydajność/limity:** budżety AI prefs; rozmiary uploadów avatar/signature. **Telemetria:** % toggli persist; ścieżka delete użyta tylko password-gated.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | najzdrowszy core; read-IDOR+AES naprawione; dług funkcjonalny + paleta | L-01..L-10 |
| W-02 | **Uwagi żywe** (`UWAGI_TESTY_2026-06-13.md`) | 2026-06-13 | **BRAK uwag M25** (dziedziczy z karty) | — |
| W-03 | `finding_v10_voice_config_false_negative` | 2026-06-08 | voice false-negative = `VoiceSettingsPanel.tsx` (M22), nie M25 | cleanup (L-08) |
| W-04 | `_DECYZJE.md` DP-11 + decyzje produktowe (D9 GDPR) | 2026-06-02/13 | billing żyje w Admin (jedno miejsce, label managed) | L-04 |
| W-05 | Kod (R3) | 2026-06-13 | grep: `GET/POST /notifications` mają guard `req.user.id`(:904)+`requesterId!==userId→403`(:912); paleta ~1650 (rose/blue/amber) | L-01 (potwierdza naprawę) |
| W-06 | Feedback prod (`finding_railway_db_topology`, `feedback_prod_caution`) | — | dev `.env` → Railway PROD; ostrożność przy GDPR/delete | ryzyko (niżej) |

### 02 · Stan obecny (prawda kodu) — karta §1 (REALNE 10/12 · Shortcuts UKRYTE/no-op · Feature flags read-only · Billing route-only). Naprawione: `b9f2dee9d2` (read-IDOR notifications — R3 zweryfikowany guard), `9ef570ca1b` (Bramka D AES-256-GCM CalDAV/OAuth), `7495c12ffb` (login-history/connected-accounts amber baner).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | read-IDOR `GET /settings/notifications` | W-01,W-05 | `settings.routes.ts:868` (guard `:904/:912`) | P1 | 2 | **ZAMKNIĘTA 2026-06-17 `b9f2dee9d2` — ZWERYFIKOWANE w kodzie 2026-06-17** |
| L-02 | bezhasłowy duplikat usuwania konta | W-01 | `settings.routes.ts:2634` usunięty; FE→`/gdpr/deletion-request`+hasło | P1 | 2 | **ZAMKNIĘTA 2026-06-17 `407ec5b1b5`** |
| L-03 | pilot gating tylko FE (serwer nie zna pilota) | W-01 | `pilotAccess.ts:14`, `SettingsView.tsx:261-270` | P2 | 3 | **ODROCZONA** — właściwy fix = guard w `middleware/` (strefa zakazana); realny path (initiative writes) już strzeżony serwer-first w `initiativeGovernanceGuard.ts:81-116`; settings = self-scoped (niskie ryzyko) |
| L-04 | billing „Section not found" (route bez case) | W-01,W-04 | `views/settings/syncEntryResolver.ts:10-11` (redirect) | P1 | 2 | **ZAMKNIĘTA 2026-06-17 — NIEAKTUALNA: redirect egzekwuje DP-11 (`/settings/billing`→Admin/Org przed renderem); brak pułapki "Section not found"; `case 'billing'` osiągalny tylko po obejściu redirectu** |
| L-05 | Keyboard Shortcuts UI bez dispatchera (no-op) | W-01 | `SettingsView.tsx:277-289` (hidden+redirect), `SettingsSidebar.tsx:438-442` (nav usunięty) | P1 | 2 | **ZAMKNIĘTA 2026-06-17 — D-02=UKRYJ już wdrożone: sekcja w `hiddenSections` + redirect do Profile + brak wpisu w sidebarze (rebind nieosiągalny)** |
| L-06 | Feature flags read-only viewer (brak write) | W-01 | `DeveloperSettings.tsx:343-423` (ToggleRight/Left = ikony, brak Switch/onChange) | P2 | 2 | **ZAMKNIĘTA 2026-06-17 — DP-10: viewer już read-only + Alert „managed by administrators" (`settings.flags.description`); ewentualny copy-tweak „administrators→superadmin" w locales → Harvard 2** |
| L-07 | sekrety integracji plaintext at rest | W-01 | CalDAV `:2000` base64 = HTTP Basic (protokół), tokens AES-256-GCM via secretEncryption | P2 | 2 | **ZAMKNIĘTA 2026-06-17 `9ef570ca1b` — ZWERYFIKOWANE: CalDAV+OAuth przez encryptSecret/decryptSecret** |
| L-08 | martwy kod (`layout/SettingsSidebar.tsx`, `VoiceSettingsPanel.tsx`→M22) | W-01,W-03 | `layout/SettingsSidebar.tsx` 0 import. usunięty `f1b14603ee`; cluster `views/settings/*Module`+`VoiceSettingsPanel`+`DataPrivacySettings` martwy ale +3 testy | P2 | 3 | **CZĘŚCIOWO ZAMKNIĘTA 2026-06-17 `f1b14603ee` (layout/SettingsSidebar usunięty); reszta = ODROCZONA: kaskada 14 plików (z testami) odroczona do atomowego cleanup (ryzyko broken-intermediate przy git-race)** |
| L-09 | ~1650–2237 hardkodów palety + §27 N/D + i18n inline (53) | W-01 | `src/components/settings/` | P1/P2 | 4 | **ODROCZONA-Faza4 → Harvard 2 (i18n inline + palety DP-8)** |
| L-10 | testy S3 (hasło) + S5 (GDPR bcrypt na właściwej trasie) brak; mock-drift ~34+14 FAIL | W-01 | `tests/unit/components/settings` 125 pass/1 skip; S5=`account-deletion-routes-guard` 6/6; setup `react-router-dom` mock + tMock defaultValue | P0-test | 2 | **ZAMKNIĘTA 2026-06-17 `79bf75ce06` (mock-drift naprawiony: useNavigate + i18n defaultValue; S5 GDPR bcrypt zielone)** |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | billing: wpiąć pod `/settings/billing` czy usunąć route/enum? | wpiąć `BillingSettings.tsx` / **usunąć (billing w Admin)** | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-11: usunąć route/enum, billing jedno miejsce Admin** |
| D-02 | Keyboard Shortcuts: globalny dispatcher czy ukryć rebind? | dispatcher / ukryć UI | Piotr | TBD | otwarta (modułowa) |
| D-03 | Feature flags: edytowalne czy jawnie read-only? | edytowalne / **„read-only (superadmin)"** | Piotr | TBD | otwarta (modułowa) |

### 05 · Flagi/rollout — pilot (FE-only redirect, gating→serwer L-03); developerMode persystuje (flagi nie); core otwarty. `VoiceSettingsPanel.tsx` cleanup koordynować z M22. DP-11: billing route → usunąć.
### 06 · Ryzyka — **L-01 i L-07 oznaczone NAPRAWIONE → R3: L-01 ZWERYFIKOWANE w kodzie (guard `req.user.id`), L-07 potwierdzić pokrycie AES wszystkich sekretów CalDAV+OAuth** przed zamknięciem. GDPR/delete na prod = szczególna ostrożność, NIE wykonywać realnego usunięcia konta (`feedback_prod_caution`). Dev `.env` → Railway PROD. Brak uwag żywych → re-ocena D wymaga Fazy 4.
### 07 · Log — **2026-06-18 (Harvard Final): SYS-1 + SYS-5 ZAMKNIĘTE.** `50a6307391` — SYS-5 i18n-mix M25 zlikwidowany (settings sections klucze PL/EN kompletne). `4155d717c3`+`c284b75e0e`+`33dfeabced` — SYS-1 selekcja: Language radio, option-cards, Tabs, Dropdown → neutral/blue (nie crimson). SYS-6 dark-surface = ✅ (poprzednia fala). Grafika M25: 🟢. L-09 tokens sweep: ~1650 palety odroczone v1.1 (DP-8 wzorzec).
— 2026-06-13 (teczka pogłębiona): brak uwag żywych; R3 zweryfikował L-01 read-IDOR naprawiony w kodzie; DP-11 (billing) + DP-10 (flagi) wpisane; enumeracja API + epiki Gherkin dodane. Audyt 2026-06-11: ocena 54/100; `b9f2dee9d2`, `9ef570ca1b`, `7495c12ffb`. Re-ocena D/G po Fazie 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + jawne „brak uwag żywych M25" + voice finding + DP-11/DP-10 + feedback prod) · R2 zero sierot (wejście→luka→story→DoD) · R3 L-01 „NAPRAWIONE — ZWERYFIKOWANE w kodzie" + L-07 „potwierdzić pokrycie" (nie dziedziczone) · R4 DoD z liczbami (53 inline + ~1650 palety · 7 table · 119+9 hex · 123 endp.) · R5 decyzje przekrojowe ROZSTRZYGNIĘTE (D-01=DP-11; D-02/D-03 modułowe otwarte); pozostaje R6/żywa weryfikacja · A–E docelowy zlinkowany · F epiki→stories Gherkin↔luki · G DoD+S+sec+wydajność · R6 sesja żywa = Faza 4. **Teczka kompletna do egzekucji.**

**Ryzyko (1 zdanie):** Read-IDOR `/notifications` (L-01) jest jedynym byłym blokerem bezpieczeństwa i R3 potwierdził naprawę w kodzie (guard `req.user.id`), więc po dopięciu testów S3/S5 + sweepie palety (DP-8) moduł realnie kandyduje do Beta jako najzdrowszy w puli core.
