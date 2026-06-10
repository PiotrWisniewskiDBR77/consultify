# Plan testów: DEMO + TRIAL — Claude w przeglądarce × analiza backendu Railway

> **Cel:** Claude (browser agent) przechodzi jako użytkownik **pełne demo** i **pełny trial**, klikając przez całą aplikację. Równolegle Claude Code obserwuje backend na Railway (logi, DB, endpointy zdrowia, guardy). Na końcu łączymy **raport z przeglądarki** + **raport backendowy** w jeden triage błędów, korelując zdarzenia po czasie i `correlationId`.

---

## 0. Role i zasada działania

| Rola | Kto | Narzędzia | Co robi |
|------|-----|-----------|---------|
| **Tester-frontend** | Claude in Chrome (browser agent) | `navigate`, `computer`, `find`, `read_page`, `read_console_messages`, `read_network_requests`, `gif_creator` | Wyklikuje pełne ścieżki DEMO i TRIAL jak prawdziwy użytkownik, zbiera dowody (screenshoty, console, network) |
| **Obserwator-backend** | Claude Code (ja) | `railway logs`, `railway status`, `curl` na endpointy zdrowia, odczyt DB | Śledzi logi serwera w czasie rzeczywistym, wychwytuje 5xx/4xx, wyjątki, naruszenia guardów, zapisy do DB, cron, pipeline AI |
| **Korelacja** | wspólnie | znaczniki czasu + `X-Correlation-Id` | Każdy krok z przeglądarki ma znacznik czasu → mapujemy na wpis w logach backendu |

**Klucz do korelacji:** backend ma `correlationMiddleware` (nagłówek `X-Correlation-Id`) oraz `apiLogging.middleware`. Tester w przeglądarce notuje **czas (HH:MM:SS) + correlationId z nagłówka odpowiedzi** dla każdej istotnej akcji; obserwator backendu odnajduje ten sam ID w `railway logs`.

---

## 1. Środowisko i przygotowanie (setup — robi Claude Code przed startem)

**Rekomendacja środowiska:** pełny przebieg (z tworzeniem kont/orgów trialowych = zapisy do DB) wykonujemy na **STAGING**, żeby nie zaśmiecać produkcji. Na **PROD** robimy tylko **read-only smoke** (demo + logowanie istniejącym kontem). Zmień, jeśli wolisz inaczej.

- **Staging FE:** `https://staging.consultify.app`
- **Staging API:** `https://api.staging.consultify.app/api`
- **Prod FE/API:** `https://consultify.app` / `https://api.consultify.app/api` (smoke only)

Kroki przygotowania:

```bash
# 1. Upewnij się, że Railway wskazuje właściwy serwis (status pokazał Service: None)
railway status
railway service        # wybierz serwis API (Dockerfile.api)

# 2. Otwórz strumień logów w tle na CAŁY czas testu
railway logs -f        # (run_in_background) — to jest główne źródło obserwacji

# 3. Health-check baseline PRZED testem (oczekiwane 200)
curl -s https://api.staging.consultify.app/ping
curl -s https://api.staging.consultify.app/api/health
curl -s https://api.staging.consultify.app/api/health/system
curl -s https://api.staging.consultify.app/api/public/anna/voice-config   # głos Anny (publiczny)
curl -s https://api.staging.consultify.app/api/ai/health-check
```

- Ustal **okno testowe** (np. 60–90 min) i zanotuj czas startu — wszystkie logi filtrujemy do tego okna.
- Przetestuj **dwa locale**: `PL` i `EN` (nagłówek `X-App-Language` / przełącznik języka). Demo „Atelier Toys" jest locale-aware.
- Przygotuj **świeży, jednorazowy e-mail** dla rejestracji trialu (np. alias `+test`), bo trial tworzy realną organizację.
- Zanotuj baseline błędów w logach (żeby odróżnić „stary szum" od błędów wywołanych testem).

---

## 2. CO MA PRZETESTOWAĆ CLAUDE W PRZEGLĄDARCE

> Zasada ogólna dla testera: **po każdym kroku** rób `read_console_messages` (szukaj `error`/`warning`), `read_network_requests` (szukaj statusów ≥400 i odpowiedzi z `error`), oraz screenshot stanu. Notuj czas i correlationId. Nie zgaduj — jeśli przycisk nie działa, opisz co kliknięto, co się stało, co było oczekiwane.

### ŚCIEŻKA A — PEŁNE DEMO (wejście: `/demo`)

| # | Krok | Akcja w przeglądarce | Asercja / czego szukać |
|---|------|----------------------|------------------------|
| A1 | Wejście | Otwórz `/demo` | Ładuje się org „Atelier Toys"; pojawia się Welcome Tour (pierwsza wizyta); brak białego ekranu / błędu JS |
| A2 | Tour | Przejdź cały Welcome Tour (Dalej→…→Zakończ) | Każdy krok renderuje się; zamknięcie działa; tour nie wraca po zamknięciu |
| A3 | Baner demo | Sprawdź `SmartDemoBanner` | Widoczny, treść poprawna w danym locale, CTA klikalne |
| A4 | Chat AI | `/chat` — zadaj pytanie do AI | Odpowiedź streamuje się; brak 5xx; sprawdź czy w demo działa AI czy pojawia się limit |
| A5 | Assessment | `/assessment/drd` (+ `siri`, `adma`, `overview`, `summary`) | Dane Atelier widoczne; tryb **read-only** — próba edycji powinna być zablokowana (demo write protection) |
| A6 | Interview | `/interview` | Lista/insighty się ładują; read-only |
| A7 | Context | `/context/profile` (+ goals, challenges, megatrends, strategy) | Wypełnione danymi demo; nawigacja między zakładkami |
| A8 | Discovery | `/discovery-tools/strategic` (+ operational, digital, process-automation) | Scenariusze się ładują |
| A9 | Reports | `/reports/builder` — wygeneruj przykładowy raport | Raport się generuje → **value-moment CTA** (`report_generated`) powinno się pojawić |
| A10 | Pozostałe moduły | Przeklikaj: `/initiatives`, `/portfolio`, `/finance`, `/meeting`, `/kpi-okr`, `/document-studio`, `/tabele`, `/presentations`, `/ai` | Każdy moduł: ładuje się / czytelny komunikat „niedostępne w demo"; **żaden** nie rzuca crashem ani pustym ekranem |
| A11 | **Write-protection** | Spróbuj edytować/zapisać cokolwiek (np. wyślij formularz, zmień pole) | Backend `demoGuard` ma zablokować zapis; UI powinno pokazać czytelny komunikat, **nie** cichy błąd 500 |
| A12 | Limit czasu/funkcji | Eksploruj >3 funkcje lub poczekaj na próg czasowy | Pojawia się `DemoUpgradePrompt` (5 min / 3 funkcje); `SessionWarningModal` przy 1h i 5 min |
| A13 | Konwersja | Kliknij „Start Trial" / „Rozpocznij trial" | Otwiera się `DemoSignupModal`; przejście do `/auth?step=login&from=demo` lub `/trial/start` |
| A14 | Exit intent | Spróbuj opuścić demo | `ExitIntentModal` się pojawia i działa |
| A15 | Telemetria (UI) | — | W network sprawdź `POST /api/demo/record-event` dla zdarzeń: start, feature explored, CTA clicked |

### ŚCIEŻKA B — PEŁNY TRIAL (wejście: `/trial` lub konwersja z demo)

| # | Krok | Akcja w przeglądarce | Asercja / czego szukać |
|---|------|----------------------|------------------------|
| B1 | Wejście | Otwórz `/trial` (lub kliknij „Start Trial" z demo) | Przekierowanie do `/auth` w trybie REGISTER |
| B2 | Rejestracja | Podaj świeży e-mail + hasło | `POST /api/auth/register` → 200; e-mail weryfikacyjny (jeśli wymagany) |
| B3 | Weryfikacja | Wpisz kod / kliknij link (jeśli jest) | Konto aktywne |
| B4 | Akceptacja regulaminu | Onboarding krok 1 | `POST /api/onboarding/accept-terms` → 200 |
| B5 | Wybór planu | Onboarding krok 2 (jeśli jest) | `POST /api/onboarding/select-tier` |
| B6 | Płatność (opcjonalna) | Pomiń lub dodaj | `POST /api/onboarding/setup-payment` / `skip` |
| B7 | Utworzenie org | `/trial/create-org` jeśli wymagane | Org trialowa powstaje; tester staje się ownerem |
| B8 | Zakończenie onboardingu | — | `POST /api/onboarding/complete` → redirect do `/chat` |
| B9 | Status trialu | Sprawdź network | `GET /api/trial/status` zwraca: `isTrial=true`, `trialDaysLeft`, `trialExpiresAt`, limity, `usagePercent` |
| B10 | Chat AI (realny) | `/chat` — kilka pytań do AI | Odpowiedzi działają; zlicz wykorzystanie wobec `maxAICallsPerDay` |
| B11 | Tworzenie projektu | Utwórz projekt/inicjatywę | Zapis działa (to NIE demo); sprawdź limit `maxProjects` / `maxInitiatives` |
| B12 | Zaproszenie usera | Zaproś członka zespołu | Limit `maxUsers`; e-mail zaproszenia wychodzi |
| B13 | Przegląd modułów | Przeklikaj WSZYSTKIE moduły z sekcji 2.A10 **w trybie pełnym** | Funkcje zapisują dane; brak fałszywych blokad; brak crashy |
| B14 | Limity / gating | Spróbuj przekroczyć limit (np. dużo wywołań AI) | `trialEntryGuard` blokuje czytelnie (`AccessBlockedModal`), nie błędem 500 |
| B15 | Ostrzeżenia o wygaśnięciu | (jeśli da się przyspieszyć przez backend/datę) | Banery 1h / modal 5 min / stan „wygasł" — pokazują poprawne CTA |
| B16 | Konwersja na płatny | Kliknij „Upgrade" / „Get Full Access" | `POST /api/trial/:trialId/convert` → org konwertuje się; limity znikają/rosną |
| B17 | Wylogowanie + ponowne logowanie | `/auth` login | Sesja wraca poprawnie; dane trialu zachowane |

### ŚCIEŻKA C — AUTH / brzegi (szybki smoke)

- Logowanie błędnym hasłem → czytelny błąd, **nie** 500.
- Reset hasła: `/forgot-password` → e-mail → `/reset-password?token=` → nowe hasło → login.
- (Jeśli skonfigurowane) OAuth Google → callback `/auth` → konto.
- Próba wejścia na chronioną trasę bez sesji → redirect do logowania (nie biały ekran).

---

## 3. CO ROBI CLAUDE CODE NA BACKENDZIE (równolegle, w tym samym oknie czasowym)

Przez cały czas trzymam otwarty `railway logs -f` i obserwuję:

1. **Błędy HTTP:** każde `5xx` (krytyczne) i nieoczekiwane `4xx` — zmapuję na krok testera po czasie/correlationId.
2. **Wyjątki / stack trace:** `UnhandledRejection`, `TypeError`, błędy SQLite (`SQLITE_*`), timeouty.
3. **Guardy:** czy `demoGuard.middleware` faktycznie blokuje zapisy w demo (krok A11) i czy `trialEntryGuard` blokuje po przekroczeniu limitów (B14) — bez przeciekania danych i bez 500.
4. **DB:** czy rejestracja trialu (B2–B8) zapisuje spójne rekordy (user, org, plan, limity); czy konwersja (B16) poprawnie aktualizuje typ org i limity. Sprawdzam tabele/migrację po teście.
5. **AI pipeline:** `AIPipeline` — czy streaming kończy się czysto, czy są retry/timeout, zużycie tokenów wobec `maxTotalTokens`.
6. **Cron / sesje:** `Scheduler` — czyszczenie wygasłych sesji demo, ostrzeżenia o wygaśnięciu trialu.
7. **Telemetria:** czy `POST /api/demo/record-event` i zdarzenia trialu (`TRIAL_ACTIVATED`, `TRIAL_CONVERTED`, …) faktycznie trafiają do logów/DB.
8. **Wydajność:** `performanceMetrics.middleware` — endpointy wolniejsze niż ~1–2 s notuję jako podejrzane.
9. **Health w trakcie:** okresowy `curl /ping` i `/api/health/system`, żeby wychwycić restart/OOM (Railway `restartPolicy: ON_FAILURE`).

Każde znalezisko zapisuję z: `czas | correlationId | endpoint | status | fragment logu | prawdopodobny krok testera`.

---

## 4. JAK STWORZYĆ RAPORT

Powstają **trzy** dokumenty w `docs/qa/runs/<DATA>/`:

### 4.1. Raport testera (Claude w przeglądarce) — `frontend-report.md`

Szablon, który Claude-in-Chrome ma wypełnić:

```markdown
# Raport testów frontendowych — DEMO + TRIAL
Data/godzina startu: <YYYY-MM-DD HH:MM>  | Środowisko: staging | Locale: PL/EN
Przeglądarka: <wersja> | Tester: Claude in Chrome

## Podsumowanie wykonawcze
- Demo: ukończone w X/15 krokach | Trial: ukończone w Y/17 krokach
- Znalezione błędy: <n> (P0: _, P1: _, P2: _, P3: _)
- Ogólna ocena gotowości: <zdanie>

## Tabela wykonanych kroków
| # | Krok | Status (✅/⚠️/❌) | Czas | correlationId | Uwaga |
|---|------|------------------|------|---------------|-------|

## Znalezione błędy (jeden blok na błąd)
### BUG-FE-001 — <tytuł>
- **Severity:** P0/P1/P2/P3
- **Ścieżka:** DEMO/TRIAL, krok #
- **URL:** <pełny url>
- **Kroki reprodukcji:** 1… 2… 3…
- **Oczekiwane:** …
- **Rzeczywiste:** …
- **Dowody:** screenshot(y), console error (treść), network (endpoint+status+ciało), correlationId, czas
- **Powtarzalność:** zawsze / czasem / raz

## Załączniki
- Screenshoty / GIF kluczowych ścieżek
- Zrzut błędów console
- Lista wywołań network ze statusem ≥400
```

**Zasady dla testera przy raporcie:**
- Jeden błąd = jeden blok BUG-FE-xxx. Bez zbiorczych „kilka rzeczy nie działa".
- Zawsze dołącz **dowód** (screenshot + treść błędu z console/network). Bez dowodu = nie zgłaszaj jako bug, tylko jako „obserwacja".
- Zawsze podaj **correlationId i czas** — to spina raport z backendem.
- Rozróżniaj: ❌ błąd | ⚠️ działa, ale źle/niejasno | ✅ ok.

### 4.2. Raport backendowy (Claude Code) — `backend-report.md`

```markdown
# Raport backendu (Railway) — okno testu <HH:MM–HH:MM>
Środowisko: staging | Serwis: <api> | Baseline błędów przed testem: <n>

## Health
- /ping, /api/health, /api/health/system, /api/public/anna/voice-config, /api/ai/health-check — przed/po
- Restarty / OOM w oknie: tak/nie

## Anomalie z logów (jeden blok na anomalię)
### BUG-BE-001 — <tytuł>
- **Severity:** P0/P1/P2/P3
- **Czas / correlationId:** …
- **Endpoint + metoda + status:** …
- **Fragment logu / stack trace:** ```…```
- **Powiązany krok testera:** BUG-FE-xxx / krok #
- **Diagnoza (kod):** plik:linia, prawdopodobna przyczyna

## Weryfikacja guardów i danych
- demoGuard blokuje zapisy: tak/nie (dowód)
- trialEntryGuard blokuje po limicie: tak/nie (dowód)
- Rejestracja trialu — spójność rekordów w DB: tak/nie
- Konwersja trialu — aktualizacja typu org + limitów: tak/nie

## Wydajność
- Endpointy > ~1–2 s: lista
```

### 4.3. Raport scalony / triage — `MERGED-findings.md` (robi Claude Code)

To jest **deliverable końcowy**. Łączę oba raporty po `correlationId`/czasie:

```markdown
# Triage błędów DEMO + TRIAL — <DATA>

## Macierz korelacji
| ID | Tytuł | Severity | Objaw (FE) | Przyczyna (BE) | Status |
|----|-------|----------|------------|----------------|--------|
| 001 | … | P0 | BUG-FE-003: 500 na zapisie | BUG-BE-001: null deref w trialService:88 | potwierdzony |

## P0 — blokery (naprawić przed GA)
## P1 — poważne
## P2 — średnie
## P3 — drobne / kosmetyka

## Błędy widoczne tylko na froncie (bez śladu w backendzie) — prawdopodobnie UI/state
## Anomalie tylko w backendzie (bez objawu w UI) — ukryte ryzyka

## Rekomendacja gotowości: GO / NO-GO dla demo / dla trialu (+ uzasadnienie)
```

**Kryteria severity:**
- **P0** — blokuje ścieżkę (nie da się przejść demo/triala), utrata danych, 500 na głównej ścieżce, przeciek danych mimo guarda.
- **P1** — funkcja kluczowa działa źle, mylące blokady, błędna telemetria konwersji.
- **P2** — funkcja poboczna, niespójność locale, brzydki ale niegroźny błąd.
- **P3** — kosmetyka, copy, drobne UI.

---

## 5. Kolejność wykonania (runbook)

1. **(Code)** Setup z sekcji 1: `railway service` → `railway logs -f` w tle → health baseline.
2. **(Code)** Ogłaszam start okna testowego (znacznik czasu).
3. **(Chrome)** Pełna ŚCIEŻKA A (DEMO), locale PL → potem szybki przebieg EN.
4. **(Code)** Na bieżąco zbieram anomalie backendu dla kroków A.
5. **(Chrome)** Pełna ŚCIEŻKA B (TRIAL) na świeżym koncie.
6. **(Code)** Weryfikacja DB po rejestracji i konwersji.
7. **(Chrome)** ŚCIEŻKA C (auth/brzegi).
8. **(Chrome)** Zapis `frontend-report.md`. **(Code)** Zapis `backend-report.md`.
9. **(Code)** Scalenie → `MERGED-findings.md` + rekomendacja GO/NO-GO.
10. (Opcjonalnie) Read-only smoke tych samych ścieżek na PROD.

---

## 6. Checklisty endpointów do obserwacji (skrót)

**Publiczne / zdrowie:** `/ping`, `/api/health`, `/api/health/system`, `/api/public/anna/voice-config`, `/api/ai/health-check`
**Demo:** `POST /api/demo/toggle`, `GET /api/demo/status`, `GET /api/demo/organization`, `POST /api/demo/record-event`, `GET /api/demo/tours`
**Trial:** `GET /api/trial/status`, `POST /api/trial/:id/convert`
**Onboarding:** `accept-terms`, `select-tier`, `setup-payment`, `complete`, `skip`
**Auth:** `POST /api/auth/{login,register,forgot-password,reset-password,oauth-callback}`
**Guardy do potwierdzenia:** `demoGuard.middleware`, `trialEntryGuard.middleware`
