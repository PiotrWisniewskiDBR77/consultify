# Triage błędów DEMO + TRIAL — 2026-06-08 (staging)

Środowisko: `consultify-staging.up.railway.app` · Locale: PL · Konto demo: `qa-demo-0608@example.com` (ADMIN org `atelier`)
Źródła: [frontend-report.md](frontend-report.md) (Claude w przeglądarce) + [backend-report.md](backend-report.md) (logi Railway).
Zakres faktycznie przejścia: pełne DEMO (wejście, rejestracja, chat, 6 modułów, wyjście). TRIAL: wejście + bramka kodowa (pełna rejestracja niewykonalna bez kodu). Auth: częściowo.

## Macierz korelacji (objaw FE ↔ przyczyna BE)
| ID | Tytuł | Sev | Objaw (FE) | Przyczyna/ślad (BE) | Status |
|----|-------|-----|------------|---------------------|--------|
| M1 | Drift schematu DB → twarde błędy SQL | **P0** | Puste KPI, sygnały realizacji „OK"/zera, panel billing niedostępny | `users.user_status`, `initiative_kpis.is_on_target`, `sso_configurations` — brak (BUG-BE-006); ~50 tabel brakuje (BUG-BE-001) | potwierdzony |
| M2 | Routery `/api/v8/<feature>/*` → 404 | **P1** | 404 na Wywiad/Narzędzia/Inicjatywy/Realizacja, dane z fallbacków | brak routerów v8 na staging; v10/teresa i v8/admin działają (BUG-BE-007 / BUG-FE-001) | potwierdzony |
| M3 | „Wyjdź z demo" nie wychodzi | **P1** | Toast „demo wyłączone", ale read-only zostaje, 403 dalej | `demo/toggle` 200, ale sesja nadal demo (BUG-FE-007) | potwierdzony |
| M4 | Picker person/scenariuszy martwy + ekran zacięty | **P1** | Klik person/scenariuszy bez efektu; brak scrolla | brak (czysto front — brak handlerów/CSS) (BUG-FE-002) | potwierdzony |
| M5 | Custom-domeny `*.consultify.app` TLS/SNI | **P1** | (do potw. w realnej przeglądarce) | `tlsv1 unrecognized name`, HTTP 000 na curl (BUG-BE-002) | do potwierdzenia |
| M6 | Demo gość = ADMIN wspólnej org `atelier` | **P1** | menu konta: Admin · Atelier Toys | wszystkie błędy BE dotyczą org `atelier` (OBS-FE-009) | do potwierdzenia (izolacja DB) |
| M7 | Systemowy miks językowy PL/EN | **P2** | blokady, persony, „Demo mode is read-only", „Your Radar", „Start Free Trial" | n/d (i18n front) (BUG-FE-003) | potwierdzony |
| M8 | Niespójna bramka trialu (kod wymagany vs opcjonalny) | **P2** | `/trial` wymaga kodu, modal `/demo` opcjonalnie | n/d (BUG-FE-006) | potwierdzony |
| M9 | Onboarding renderuje się na Ustawieniach | **P2** | „Witaj w Consultify (1/3)" nad profilem | n/d (BUG-FE-008) | potwierdzony |
| M10 | Demo zaprasza do rozmowy, czat read-only | **P2** | „Porozmawiaj z Teresą" → pierwszy msg 403 | demoGuard 403 (poprawne, ale UX sprzeczny) | potwierdzony |
| M11 | Perf: 24 zapytania DB / `/api/v8/admin/flags` | **P2** | — | High DB query count (BUG-BE-008) | potwierdzony |
| M12 | Render landing/hero z opóźnieniem | **P3** | Hero chwilowo pusty przy wejściu | n/d | potwierdzony |

## Co DZIAŁA dobrze (potwierdzone pozytywy)
- **Write-protection demo**: `POST /api/conversations` → 403 + czysty modal `DEMO_READ_ONLY` z CTA trial.
- **Walidacja kodu dostępu**: `/api/access-codes/validate/...` 200 + czytelny błąd inline PL.
- **Rejestracja demo**: `register-demo` 200, wejście do workspace z danymi (7 projektów, 17 inicjatyw).
- **Health/Redis/DB-connect**: `/api/health` 200 (db+redis connected), voice-config Anny/Teresy działa.
- **Moduły dostępne w demo** (Czat, Moja Praca, Wywiad, Narzędzia, Inicjatywy, Realizacja) renderują się bez crashy (dzięki fallbackom).

## P0 — blokery
- **M1**: drift schematu DB → realne błędy Postgres (`users.user_status`, `initiative_kpis.is_on_target`, `sso_configurations`) + ~50 brakujących tabel (billing/token/AI/admin). Dane KPI/billing/sygnały są ciche-uszkodzone. **Musi być naprawione przed jakąkolwiek oceną triala** (konwersja/limity zależą od `billing_*`, `token_ledger`, `organization_seats`).

## P1 — poważne
- **M2** routery v8 404 (rozjazd wersji FE/BE na staging). **M3** „Wyjdź z demo" nieskuteczne. **M4** martwy picker demo + zacięty ekran. **M5** TLS/SNI markowych domen. **M6** izolacja gości demo w org `atelier`.

## P2 — średnie
- M7 i18n PL/EN, M8 niespójna bramka trialu, M9 onboarding nad ustawieniami, M10 sprzeczny UX czatu demo, M11 N+1 na flags.

## P3 — drobne
- M12 opóźniony render hero. Półprzezroczyste nakładki modali (przejściowe).

## Luki w pokryciu (do dokończenia osobno)
- Pełna rejestracja **triala** i onboarding/konwersja → **wymaga ważnego kodu dostępu** (REF-…). Bez niego nieprzejdzione.
- Negatyw logowania + reset hasła (Ścieżka C) — sesja była zajęta kontem demo.
- Tryb głosowy (Teresa/Anna) — nie odsłuchany end-to-end.
- Locale EN przebieg — nie wykonany (tylko PL).
- Potwierdzenie izolacji danych gości demo w DB (M6).

## Rekomendacja gotowości
- **DEMO: NO-GO** do czasu naprawy M1 (drift DB) i M2 (v8 404) — choć ścieżka demo „działa" wizualnie, dane są ciche-uszkodzone, a kluczowe ekrany prowadzone (picker M4) są martwe. M3 (nie da się wyjść z demo) i M7 (miks językowy) psują wrażenie na demo sprzedażowym dla PL klienta.
- **TRIAL: NO-GO / nieoceniony** — bramka kodowa uniemożliwiła pełne przejście; dodatkowo backend triala (billing/token/seats) opiera się na tabelach, których **brakuje** na staging (M1) → konwersja prawie na pewno by się wywróciła. Wymagany ponowny test po: (a) migracji schematu, (b) wdrożeniu routerów v8, (c) wydaniu kodu dostępu QA.

## Najpilniejsze działania (kolejność)
1. Zsynchronizować schemat DB staging z migracjami (M1) — to odblokowuje wiarygodny re-test.
2. Wdrożyć na staging build serwera z routerami `/api/v8/*` zgodny z frontendem (M2).
3. Naprawić „Wyjdź z demo" (M3) i picker person/scenariuszy (M4).
4. Wydać kod dostępu QA + uspójnić bramkę trialu (M8) → dokończyć Ścieżkę B.
5. Sprawdzić cert/SNI markowych domen (M5) i izolację org `atelier` (M6).
6. Uporządkować i18n PL/EN (M7).
