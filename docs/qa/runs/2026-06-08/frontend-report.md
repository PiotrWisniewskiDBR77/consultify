# Raport testów frontendowych — DEMO + TRIAL

Data/start: 2026-06-08 ~21:18 (lokalny) · Środowisko: **staging** (`consultify-staging.up.railway.app`) · Locale: PL
Tester: Claude in Chrome (Browser 1, macOS) · Konto demo: `qa-demo-0608@example.com`

## Podsumowanie wykonawcze
- DEMO: wejście, rejestracja demo, chat write-protection, 6 modułów dostępnych — przejrzane.
- **Dominujący problem:** cała przestrzeń API `/api/v8/*` zwraca **404** na staging (interview, assessment, planning, execution-control). Front działa tylko dzięki fallbackom na starsze endpointy → rozjazd wersji FE/BE.
- Drugi motyw: **systemowy miks językowy PL/EN** w sesji PL (komunikaty blokad, persony, nagłówki).
- Pozytyw: demo write-protection (403) działa poprawnie i ma czysty UX.

## Tabela wykonanych kroków (DEMO)
| # | Krok | Status | Uwaga |
|---|------|--------|-------|
| A1 | `/demo` wejście | ⚠️ | `/demo` pokazuje modal „Konfiguracja pełnego dostępu" (rejestracja), nie demo. Właściwe wejście = „Zobacz demo" / rejestracja demo |
| A2 | Landing render | ⚠️ | Hero renderuje się z opóźnieniem/animacją — przy pierwszym wejściu strona wygląda na pustą |
| A3 | Rejestracja demo | ✅ | `POST /api/auth/register-demo` → 200, wejście do workspace Atelier Toys (7 projektów, 17 inicjatyw) |
| A4 | Chat z Teresą | ⚠️/❌ | Picker person/scenariuszy martwy (BUG-FE-002). Wysłanie wiadomości → 403 (read-only) |
| A5 | Write-protection | ✅ | `POST /api/conversations` → 403, modal „DEMO_READ_ONLY · Demo mode is read-only" + CTA trial. Działa |
| A6 | Moja Praca `/my-work` | ✅ | Radar/Notatnik/Inbox/Kalendarz/Zadania/Decyzje, pusty radar, API 200 |
| A7 | Wywiad `/discovery` | ⚠️ | Ładuje się, ale `/api/v8/interview/*` → 404 (fallback działa) |
| A8 | Narzędzia `/discovery-tools` | ⚠️ | 36 narzędzi OK, ale `/api/v8/assessment` → 404 (fallback działa) |
| A9 | Inicjatywy `/initiatives` | ⚠️ | Kanban z danymi demo OK, ale `/api/v8/planning/*` → 404 |
| A10 | Realizacja `/implementation` | ⚠️ | Lista OK, ale 10+ `/api/v8/execution-control/*` → 404 (sygnały/alerty niezasilone) |

## Znalezione błędy

### BUG-FE-001 — Cała przestrzeń `/api/v8/*` → 404 (rozjazd wersji FE/BE na staging)
- **Severity:** P1
- **Objaw:** na każdej stronie front woła endpointy `/api/v8/...`, które zwracają 404; potem fallback na starsze (`/api/interview/*`, `/api/assessment-workflow-v2`, `/api/initiatives`) → 200.
- **Potwierdzone 404 (próbka):**
  - `/api/v8/interview/sessions/managed`, `/api/v8/interview/insights`
  - `/api/v8/assessment?limit=100&offset=0`
  - `/api/v8/planning/pending-decisions`, `/api/v8/planning/initiatives/portfolio`
  - `/api/v8/execution-control/risk-signals`, `/delay-signals`, `/budget/overspend-signals`, `/manager/lanes/{action-queue,decisions,blockers,workload,risk,people-change}/problems` (10+)
- **Wniosek:** staging serwuje serwer starszy niż build frontendu (brak routera v8). Funkcje oparte na v8 (sygnały realizacji, decyzje planowania) są niezasilone mimo „zielonego" UI. Koreluje z driftem schematu DB (backend BUG-BE-001).

### BUG-FE-002 — Demo: picker person/scenariuszy nieinteraktywny + ekran się zacina
- **Severity:** P1 (demo)
- **Ścieżka:** DEMO, po wejściu do `/chat`, po rozpoczęciu pisania pojawia się overlay „Choose the perspective and scenario…" (persony CEO/CTO/Consultant/Investor + scenariusze).
- **Objaw:** karty person i scenariuszy podświetlają się na hover, ale **kliknięcie nie robi nic** — zero requestów, brak nawigacji. Karty nie są nawet w drzewie interaktywnym (brak handlerów). Dodatkowo ekran jest **nieprzewijalny** (scroll/scroll_to/Escape/klik bez efektu) — wyjście tylko przez ponowną nawigację do `/chat`.
- **Skutek:** pierwsza prowadzona ścieżka demo („wybierz perspektywę") jest ślepym zaułkiem.

### BUG-FE-003 — Systemowy miks językowy PL/EN w sesji PL
- **Severity:** P2
- **Przykłady:** modal demo „I agree to the Terms of Service and Privacy Policy…" (ang.) w formularzu PL; overlay „Choose the perspective and scenario…" (ang.) + persony „Strategic oversight & decision making" przy scenariuszach PL; „Demo mode is read-only" (ang.) w modalu „Wymagany dostęp" (PL); blokady sidebaru „Organization is locked for today's pilot session. Please use Chat and Interview during the meeting." i „Admin is locked…" (ang.); nagłówek „Your Radar" (ang.) w `/my-work`; przycisk „Start Free Trial" (ang.) stale w rogu.
- **Skutek:** niespójna lokalizacja — źle wygląda na demo sprzedażowym dla polskiego klienta.

### OBS-FE-004 — Demo zaprasza „Porozmawiaj z Teresą", ale czat jest read-only
- **Severity:** P2 / produktowa
- Headline workspace demo to rozmowa z Teresą + „Rozmawiaj głosem", lecz pierwsza wiadomość → 403. Demo nie pozwala faktycznie porozmawiać z AI; sprzeczny przekaz (zachęta vs blokada).

### OBS-FE-005 — Gating pilotażowy: większość modułów zablokowana w demo
- **Severity:** obserwacja (prawdopodobnie zamierzone — „pilot session")
- Dostępne tylko: Czat, Moja Praca, Wywiad, Narzędzia, Inicjatywy, Realizacja. 8 modułów beta-locked, Organization + Admin „locked for today's pilot session". Spójne z polityką beta-gating, ale komunikaty po angielsku (patrz BUG-FE-003).

## Ścieżka B — TRIAL

| # | Krok | Status | Uwaga |
|---|------|--------|-------|
| B1 | `/trial` wejście | ✅/⚠️ | Strona „SELEKTYWNY DOSTĘP — To nie jest kolejny program Free Trial". Trial **bramkowany kodem** (REF-1234) — nie self-serve |
| B2 | Walidacja kodu | ✅ | `GET /api/access-codes/validate/REF-1234` → 200, błąd inline „Niepoprawny lub wygasły kod dostępu" (PL, poprawnie) |
| B3 | Self-serve (opcjonalny kod) | ⚠️ | Modal `/demo` „Konfiguracja pełnego dostępu" ma kod **opcjonalny** — sprzeczność z `/trial` (kod wymagany) |
| B4 | Pełna rejestracja trial | ⛔ | Niewykonalna bez ważnego kodu dostępu (brak kodu QA) |
| B5 | Billing | ❌ | `/settings/billing` przekierowuje na `/settings/profile` — panel billing nieosiągalny (koreluje z brakiem tabel `billing_*`) |

### BUG-FE-006 — Niespójne bramkowanie trialu: `/trial` wymaga kodu, modal `/demo` ma kod opcjonalny
- **Severity:** P2
- `/trial`: „Wprowadź kod… aby rozpocząć proces walidacji" — kod wymagany. Modal „Konfiguracja pełnego dostępu" (`/demo`, niezalogowany): pole „Kod dostępu (opcjonalnie)". Dwie różne bramki do tego samego (trial/pełny dostęp) — ryzyko obejścia bramki kodowej przez modal demo.

### BUG-FE-007 — „Wyjdź z demo" nie wychodzi z demo (mylący toast)
- **Severity:** P1
- Przycisk „Wyjdź z demo" (top-right) → `POST /api/demo/toggle` 200 + toast „Tryb demo wyłączony. Wracasz do swojego workspace." **Ale**: badge „TRYB DEMO" zostaje, a `POST /api/conversations` nadal → 403 (read-only). W menu konta „Wyjdź z demo" jest przełącznikiem, który pozostaje WŁĄCZONY. Użytkownik nie może faktycznie wyjść z trybu read-only mimo komunikatu o sukcesie.

### BUG-FE-008 — Onboarding „Witaj w Consultify (Krok 1 z 3)" renderuje się na wierzchu Ustawień
- **Severity:** P2
- Modal onboardingu „Poznaj Teresę" pojawia się dopiero po wejściu w `/settings/*` i nakłada się na panel profilu (z-index/sekwencjonowanie). Powinien być przy pierwszym logowaniu, nie na ekranie ustawień.

### OBS-FE-009 — Samodzielna rejestracja demo → rola ADMIN współdzielonej org `atelier`
- **Severity:** P1 (do potwierdzenia po stronie izolacji danych)
- Konto `qa-demo-0608@example.com` po `register-demo` ma rolę **Admin** w org o slug `atelier` (ta sama, której dotyczą błędy BE). Pytanie izolacji: czy każdy gość demo trafia jako admin do jednej wspólnej organizacji „atelier" (ryzyko współdzielenia/widoczności danych między gośćmi)? Wymaga potwierdzenia w DB.

## Ścieżka C — auth/brzegi
- `/settings/billing` → redirect `/settings/profile` (patrz B5).
- Walidacja błędnego kodu na `/trial` — poprawna (B2).
- Pełny negatyw logowania/reset hasła: **nie wykonano** (sesja zajęta kontem demo; do dokończenia osobno).
