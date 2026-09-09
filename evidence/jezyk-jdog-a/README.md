# Dowód językowy — paczka J-DOG-A (09.09.2026)

Stanowisko: `/Users/piotrwisniewski/Developer/wt/jdog-a`, gałąź `mvp/jdog-a-0909`,
baza kodu `c076e94405` → HEAD (patrz `git log`). Baza danych: kopia
`consultify_kopia_d25` (`CREATE DATABASE ... TEMPLATE consultify_staging_kopia`,
Postgres 18 na `127.0.0.1:54418`). API `:4206`, Vite `:3224`. Konto testowe
`audyt@dbr77.local` (OWNER, organizacja DBR77 `a3e05d4a-5397-419d-b486-8e44366c0063`,
`organization_members` ACTIVE — dopisany ręcznie, bo brakowało w kopii).

Skrypt: `scripts/dev/jezyk-jdog-a-zrzuty.mjs <katalog> <pl,en>`.

## Zrzuty PO (stan po naprawach tej paczki)

`po/` (konto EN) i `po-pl/` (konto PL) — 6 ekranów: lista zleceń, szczegół
zlecenia × 3 zakładki (Plan/Execution/Results), płótno planu (widok Ekspercki),
Enterprise Onboarding Wizard krok 1.

| Ekran | PL widoczne (konto EN) | EN widoczne (konto PL) |
|---|--:|--:|
| 01 Lista zleceń | 0 | 0 |
| 02 Szczegół — Plan | 0 | 0 |
| 03 Szczegół — Execution | 0 | 0 |
| 04 Szczegół — Results | 0 | 0 |
| 05 Płótno planu (Ekspercki) | 0 | 0 |
| 06 Onboarding Enterprise | 0 | 1* |

\* "LOCAL" (nazwa środowiska w plakietce — słowo neutralne, to samo w obu
językach; nie jest błędem).

Liczby pochodzą z `napisyUi()` w skrypcie — czyta WYŁĄCZNIE chrome interfejsu
(przyciski, zakładki, nagłówki, `aria-label`, `placeholder`), pomijając komórki
z DANYMI zlecenia (nazwa/cel/kroki planu — treść wpisana przez użytkownika,
świadomie zostaje w oryginalnym języku, tak jak w każdym innym module).

Pełne liczniki i lista znalezionych napisów: `po/liczniki.json`,
`po-pl/liczniki.json`.

## Zrzuty PRZED

NIE zostały zebrane jako osobne pliki PNG — odtworzenie stanu sprzed zmian
wymagałoby drugiego, równoległego stanowiska (osobny checkout na
`c076e94405`, osobne porty, osobna kopia bazy), co przy budżecie czasu tej
paczki uznałem za nieproporcjonalne do wartości dowodowej. Zamiast tego stan
PRZED jest udokumentowany:

1. **Dosłownymi cytatami z żywego zrzutu wykonanego W TRAKCIE pracy** (przed
   naprawą konkretnego pliku), zapisanymi w treści commitów tej paczki —
   np. commit `c728000065` cytuje realny tekst ekranu Zlecenia PRZED naprawą:
   status „W toku" zamiast „Active", typ „Transformacja" zamiast
   „Transformation", tytuł modułu „Zlecenia" zamiast „Orders"; commit
   `fa47990e12` cytuje zakładkę Execution PRZED naprawą: „Nic nie czeka",
   „Sprawy do zatwierdzenia", „CZEGO DOTYCZY", „KTO I KIEDY".
2. **Diffem samych commitów** (`git show <sha>`) — każda zmiana pokazuje
   dokładny polski literał usunięty i angielski klucz `t()` dodany w jego
   miejsce, co jest precyzyjniejszym dowodem niż zrzut ekranu (dokładny
   string, nie interpretacja zrzutu).
3. **Pomiarem `scripts/i18n/pomiar-jezyka.mjs`** PRZED i PO całej paczki —
   patrz treść meldunku sesji (tabela K4pl/K1def/K7 per moduł).

## Pułapki zmierzone przy budowie tego stanowiska (dla następnej paczki)

- `organization_members` to OSOBNA tabela od `users.organization_id` — konto
  bez wiersza w `organization_members` (status ACTIVE) dostaje "Your access
  to this organization has been revoked" mimo poprawnego `users.organization_id`.
- Serwer lokalny wymaga `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`
  Railway z `server.env` jawnie odpiętych (`unset`) — inaczej
  `assertNoPrivateRailwayDbHostOutsideRailway` rzuca i serwer pada z
  nieczytelnym `logger.error('\x1b[31m%s\x1b[0m', ...)` (winston nie
  wspiera printf `%s`, więc realny komunikat ginie — trzeba wywołać
  `assertNoLocalDatabaseOutsideTests`/`assertNoPrivateRailwayDbHostOutsideRailway`
  ręcznie przez `tsx -e` żeby zobaczyć prawdziwy błąd).
- Trasa `/zlecenia` wymaga `?ff_zlecenia=1` w PEŁNYM przeładowaniu strony
  (`isCaseWorkspaceEnabled()` czytany raz przy starcie modułu w `App.tsx`) —
  nawigacja SPA bez pełnego reloadu nie rejestruje trasy.
- Modal "Meet Teresa" wymaga `user_preferences (onboarding_completed=true)`
  ustawionego w bazie PRZED logowaniem, plus przycisk "Skip for now" jako
  zapasowe zamknięcie w skrypcie.
