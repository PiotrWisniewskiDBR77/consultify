# Dyżur 62 — Partner — pakiet odbioru właściciela G07–G10

## Karta dla Piotra

Portal Partner ma być codziennym miejscem pracy firmy partnerskiej. Z jednego panelu partner powinien zobaczyć swój status, wyniki programu, narzędzia poleceń, polecone organizacje, projekty i użytkowników klientów, postęp nauki i certyfikaty, materiały oraz publiczny profil firmy. Główna ścieżka prowadzi od ustalenia statusu partnera, przez orientację i dashboard, do poleceń, obsługi klientów, akademii, profilu oraz zasobów.

Na obecnym markerze nawigacja przewiduje 25 osobnych ekranów. Funkcje operacyjne obejmują start i orientację, dashboard i metryki, linki i kody poleceń, analitykę kliknięć, polecone organizacje, organizacje/projekty/użytkowników, ścieżkę nauki/egzaminy/certyfikaty, profil firmy/specjalizacje/regiony/listing oraz dokumentację, marketing, case studies i szablony. Część ekranów jest prezentacyjna albo zależna od danych; samo istnienie pozycji w menu nie dowodzi, że ma kompletną treść lub działającą akcję.

Ekonomia pozostaje świadomie poza aktywnym MVP: zarobki, zestawienia, historia wypłat i ustawienia wypłat muszą pokazywać uczciwy stan wyłączony lub odmowę. Nie wolno interpretować kwot zerowych jako potwierdzonego działania rozliczeń. Dyżur nie uruchamiał wypłaty, outreachu, publicznej rejestracji ani zewnętrznego providera.

W tym odbiorze nie udało się wejść do portalu jako lokalny partner. Repozytoryjny fixture jest zachowany, lecz jego fail-closed interfejs akceptuje wyłącznie inną rodzinę nazw baz niż nazwa wymagana przez instrukcję dyżuru. Nie powstały fikcyjne dane ani obejście logowania. Osiągalny runtime przekierował `/partner` na ekran logowania. Dlatego poniższa karta opisuje zamierzoną powierzchnię i pełny mianownik, ale nie jest decyzją właściciela ani potwierdzeniem działania 25 ekranów.

## Tożsamość odbioru

| Pole | Wartość |
| --- | --- |
| Marker i HEAD | `5e30cb9bf66c8e75481ba723debdd04f3c1a6893` |
| Gałąź | `codex/partner-day62-owner-review-20260828` |
| Worktree | `/private/tmp/consultify-partner-day62-review` |
| Artefakty | `/private/tmp/cx-day62-partner-review` |
| PostgreSQL | `127.0.0.1:5934`, `consultify_day62_partner_review`, użytkownik `postgres` |
| Frontend | `127.0.0.1:3992`, Vite z markera |
| Gateway | `NOT_STARTED` dla ścieżki G09: brak dozwolonej lokalnej tożsamości/fixture |
| Mutacja | `N/A — dyżur nie naprawia produktu` |

## Środowisko i dowody negatywne

- Dysk: około 75 GiB wolne; próg 5 GiB spełniony.
- Kontener: `cx-day62-pg`, obraz `pgvector/pgvector:pg16`, publikacja tylko `127.0.0.1:5934`.
- Migrator 1: kod `0`, `Applying migrations: 858`, zakończenie `Postgres migrations complete`.
- Migrator 2: kod `0`, `Applying migrations: 0`, zakończenie `Postgres migrations complete`.
- Fingerprint DB: `consultify_day62_partner_review|postgres`, 858 udanych wpisów migracji.
- `SMTP_*`, `RESEND_API_KEY`, `SENDGRID_API_KEY`: nieobecne w środowisku procesu kontrolnego.
- `settings`: brak kluczy podobnych do SMTP/mail/email/resend/sendgrid.
- Dziewięć tabel outbox: każda miała `0` wierszy; nie uruchomiono serwera aplikacji ani drainera. Jedynym procesem aplikacyjnym był Vite 3992; PostgreSQL obsługiwał kontener przez lokalny forward.
- Świeża baza nie była całkowicie zerowa po migracjach (`users=1`, `organizations=1`), lecz nie zawierała Partnera (`partner_organizations=0`, `partner_users=0`). Nie przypisano tych technicznych wierszy do persony Partnera.

## Fixture — wynik fail-closed

Udokumentowany `seed-wave3-partner-owner-review.ts` został uruchomiony wyłącznie na bazie dyżuru. Pierwsze wywołanie bez potwierdzenia zwróciło kod `1` i `SEED_WAVE3_PARTNER_OWNER_REVIEW=YES is required`. Powtórzenie z wymaganym potwierdzeniem zwróciło kod `1` i `Database name must match consultify_w3_partner_owner_*` (`server/scripts/seed-wave3-partner-owner-review.ts:16-24`). Instrukcja dyżuru wymaga nazwy `consultify_day62_partner_review`; nazwy nie zmieniono, seedera nie naprawiono i nie utworzono alternatywnego fixture. Wynik: `EVIDENCE_MISSING` dla stanów pełnych i persony Partnera.

## Pełny mianownik routingu i sidebara

Wszystkie sekcje są montowane pod `/partner?tab=<sekcja>`. Źródła mianownika: rzeczywisty sidebar oraz zbiór/switch runtime markera. `Źródło` oznacza potwierdzenie w kodzie; `runtime` oznacza faktyczne otwarcie po autoryzacji.

| # | Grupa / sekcja | Route | Uczciwy stan | Pokrycie |
| ---: | --- | --- | --- | --- |
| 1 | Start / partner-home | `/partner?tab=partner-home` | operacyjna orientacja zależna od statusu | źródło TAK; runtime NIE |
| 2 | Start / dashboard | `/partner?tab=dashboard` | dane i podsumowanie | źródło TAK; runtime NIE |
| 3 | Start / metrics | `/partner?tab=metrics` | dane | źródło TAK; runtime NIE |
| 4 | Polecenia / referral-tools | `/partner?tab=referral-tools` | operacyjne | źródło TAK; runtime NIE |
| 5 | Polecenia / referral-analytics | `/partner?tab=referral-analytics` | dane | źródło TAK; runtime NIE |
| 6 | Polecenia / referred-organizations | `/partner?tab=referred-organizations` | dane | źródło TAK; runtime NIE |
| 7 | Ekonomia / earnings | `/partner?tab=earnings` | wyłączone/odmowa wymaga dowodu | źródło TAK; runtime NIE |
| 8 | Ekonomia / statements | `/partner?tab=statements` | wyłączone/odmowa wymaga dowodu | źródło TAK; runtime NIE |
| 9 | Ekonomia / payouts | `/partner?tab=payouts` | wyłączone/odmowa wymaga dowodu | źródło TAK; runtime NIE |
| 10 | Ekonomia / payout-settings | `/partner?tab=payout-settings` | wyłączone/odmowa wymaga dowodu | źródło TAK; runtime NIE |
| 11 | Klienci / client-access | `/partner?tab=client-access` | operacyjne | źródło TAK; runtime NIE |
| 12 | Klienci / organizations | `/partner?tab=organizations` | dane | źródło TAK; runtime NIE |
| 13 | Klienci / projects | `/partner?tab=projects` | dane | źródło TAK; runtime NIE |
| 14 | Klienci / users | `/partner?tab=users` | dane | źródło TAK; runtime NIE |
| 15 | Akademia / learning-path | `/partner?tab=learning-path` | dane/operacyjne | źródło TAK; runtime NIE |
| 16 | Akademia / exams | `/partner?tab=exams` | dane/operacyjne | źródło TAK; runtime NIE |
| 17 | Akademia / certificates | `/partner?tab=certificates` | dane | źródło TAK; runtime NIE |
| 18 | Profil / company-info | `/partner?tab=company-info` | operacyjne | źródło TAK; runtime NIE |
| 19 | Profil / specializations | `/partner?tab=specializations` | operacyjne | źródło TAK; runtime NIE |
| 20 | Profil / regions | `/partner?tab=regions` | operacyjne | źródło TAK; runtime NIE |
| 21 | Profil / public-listing | `/partner?tab=public-listing` | operacyjne, publiczna publikacja poza dyżurem | źródło TAK; runtime NIE |
| 22 | Zasoby / documentation | `/partner?tab=documentation` | informacyjne | źródło TAK; runtime NIE |
| 23 | Zasoby / marketing | `/partner?tab=marketing` | informacyjne | źródło TAK; runtime NIE |
| 24 | Zasoby / case-studies | `/partner?tab=case-studies` | informacyjne | źródło TAK; runtime NIE |
| 25 | Zasoby / templates | `/partner?tab=templates` | informacyjne/preview zależny od danych | źródło TAK; runtime NIE |
Uwaga: sidebar i runtime switch mają ten sam mianownik 25 sekcji. Pięć dodatkowych ścieżek legacy (`/partner/dashboard`, `/partner/clients`, `/partner/commission`, `/partner/directory`, `/partner/resources`) normalizuje się odpowiednio do pięciu już policzonych sekcji (`dashboard`, `client-access`, `earnings`, `public-listing`, `documentation`) i nie zwiększa mianownika ekranów. Pokrycie wizualne: `0/25`; osiągalność auth-barrier: `1/1`.

## Manifest zrzutów

| Plik | Ekran | Route | Motyw/stan/rola | Timestamp | Marker | SHA-256 | Inspekcja |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `partner-reachability-auth-dark.png` | bariera logowania | `/login?redirect=%2Fpartner` po wejściu na `/partner` | ciemny ekran logowania; anonimowy | 2026-08-28T09:14:21+0200 | `5e30cb9bf6` | `337ce0c77b46db90e8fc4e6111c8b3668fbed0ebd2de721fbed61e2987cbced2` | obejrzany; portal niewidoczny; treść angielska |

Nie utworzono macierzy light/dark × empty/full, kebabów, preview ani kart, ponieważ wymagałoby to obejścia autoryzacji lub niedozwolonego fixture. Brakujące obrazy mają stan `NOT_PROVEN`, nie są liczone jako zrzuty.

## G09 — realna ścieżka CX

| Krok | Działanie | Route/żądanie | Metoda/HTTP | Lokalna tożsamość i organizacja | Widok / wynik |
| ---: | --- | --- | --- | --- | --- |
| 1 | wejście do portalu | `/partner` | GET frontendu, dokument 200; nawigacja klienta | anonimowa; organizacja brak | przekierowanie do `/login?redirect=%2Fpartner` |
| 2 | logowanie Partnera | brak dozwolonych danych | `NOT_STARTED` | `EVIDENCE_MISSING` | bez obejścia auth |
| 3–12 | onboarding, dashboard, polecenia, organizacje, projekt, użytkownik, akademia, profil/listing, zasoby/template, ekonomia denied | wymagają sesji Partnera i fixture | `NOT_STARTED` | `EVIDENCE_MISSING` | nie wykonano; zero outreachu/payoutu/rejestracji |

Minimalny realny Gateway nie został uruchomiony dla G09, bo bez dozwolonej persony jego odpowiedzi nie mogłyby stanowić wymaganej ścieżki „jako lokalny partner”. API-only lub testowe nagłówki nie zastąpiłyby dowodu UI i łamałyby zakaz obejścia auth.

## Znaleziska

| ID | Objaw | Reprodukcja | Plik i linia | Dowód | Wpływ |
| --- | --- | --- | --- | --- | --- |
| `PRT-D62-001` | Fixture wymagany do pełnego stanu nie wiąże się z nazwą bazy narzuconą dyżurowi. | Uruchom udokumentowany seeder z `SEED_WAVE3_PARTNER_OWNER_REVIEW=YES` i `DATABASE_URL` bazy dyżuru. | `server/scripts/seed-wave3-partner-owner-review.ts:16-24` | kod 1; `fixture-attempt-confirmed.log`, SHA `dd4d0b…` | blokuje personę Partnera, full-state, G08–G10 i 25-ekranowy materiał; `EVIDENCE_MISSING` |
| `PRT-D62-002` | Wejście `/partner` bez sesji pokazuje angielski ekran logowania podczas polskiego odbioru. | Otwórz `/partner` anonimowo w lokalnym Vite 3992. | `src/routes/AppRoutes.tsx:3422-3429` (granica auth; treść logowania poza zakresem modułu) | screenshot SHA `337ce0…` | pierwsze wrażenie PL jest niespójne; wymaga decyzji, czy login należy do mianownika Partnera |
| `PRT-D62-003` | Wymagany wzorzec `04_KARTA_DOWODOWA.md` nie istnieje w drzewie markera. | `find ... -name 04_KARTA_DOWODOWA.md` zwraca zero ścieżek. | `EVIDENCE_MISSING` | wynik przeszukania | karta poniżej odwzorowuje pola z instrukcji, ale zgodność z nieobecnym wzorcem jest `NOT_PROVEN` |

## Wynik G07–G10

| Gate | Wynik Day62 | Granica |
| --- | --- | --- |
| G07 | `PARTIAL — REVIEW_CARD_PREPARED / OWNER_DECISION_PENDING` | karta i mianownik gotowe; właściciel nie wykonał replay |
| G08 | `PARTIAL — AUTH_BARRIER_CAPTURED / 0_OF_25_RUNTIME_SCREENS` | brak fixture i sesji |
| G09 | `PARTIAL — ENTRY_REPLAYED / PARTNER_JOURNEY_NOT_PROVEN` | realna ścieżka jako Partner niewykonana |
| G10 | `PARTIAL — ALTERNATE_STATES_NOT_PROVEN` | light/dark, empty/full, connection states, kebab/preview/card niewykonane |

G11–G20 pozostają bez zmian (`NOT_STARTED`). G04/G05 pozostają owner pending, G06 pozostaje `PARTIAL_BROWSER_PASS`; nie powstał zbiorczy PASS G00–G06.

## Karta dowodowa

| Teza | Wejście | Mechanizm | Skutek | Negatywna granica | Artefakt | Wynik |
| --- | --- | --- | --- | --- | --- | --- |
| marker i instrukcja są związane | commit instrukcji `9ff0…`, marker `5e30…` | SHA-256 dokumentu i liczenie wystąpień | praca na właściwej bazie | nośnik instrukcji nie jest bazą worktree | `/private/tmp/CODEX_DAY62_PARTNER_BOUND_INSTRUKCJA.md` | PASS |
| DB jest lokalna i aktualna | PG 5934, jawny URL | dwukrotny migrator + SQL identity | 858, potem 0 | nie dowodzi danych Partnera | `migrate-1.log`, `migrate-2.log` | PASS |
| brak wysyłki | env, settings, outbox, procesy | odczyt konfiguracji i liczników | zero konfiguracji i zero kolejki | nie jest dowodem zachowania niewłączonego pełnego serwera | log komend w raporcie | PASS w granicy dyżuru |
| istnieje pełny mianownik | sidebar + runtime switch | porównanie identyfikatorów | 25 pozycji + 4 wejścia legacy = 29 | nie dowodzi osiągalności | tabela mianownika | PASS źródłowy |
| portal jest osiągalny anonimowo | `/partner` | prawdziwy Vite 3992 i przeglądarka | redirect do login | nie dowodzi portalu Partnera | `partner-reachability-auth-dark.png` | PARTIAL |
| pełny stan istnieje na DB dyżuru | repozytoryjny seeder | fail-closed run | odmowa nazwy bazy | zakaz alternatywnego seeda | `fixture-attempt-confirmed.log` | EVIDENCE_MISSING |
| realna ścieżka Partnera działa | sesja Partnera + Gateway + DB | wymagany browser/HTTP replay | niewykonane | API-only i auth bypass niedozwolone | tabela G09 | NOT_PROVEN |

## Twierdzenia niezweryfikowane

- działanie każdego z 25 ekranów, ich jasnego/ciemnego oraz pustego/pełnego stanu;
- kebab, preview i karta tam, gdzie występują;
- połączony, niepołączony, onboarding i błąd połączenia;
- realne HTTP/identity/org dla kroków G09 po wejściu;
- uczciwa odmowa ekonomii w widoku użytkownika;
- brak ucięć, kolizji, pustych paneli i angielskich treści wewnątrz portalu;
- zgodność karty dowodowej z nieobecnym `04_KARTA_DOWODOWA.md`.
