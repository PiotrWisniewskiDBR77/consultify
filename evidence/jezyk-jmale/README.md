# J-małe — dowód wizualny sześciu modułów (EN i PL)

Stanowisko: API `127.0.0.1:4200` / Vite `127.0.0.1:3218` / baza
`consultify_kopia_final` (`NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false
DB_TYPE=postgres DB_MANAGED_SCHEMA=off`, Vite `--mode test`,
`VITE_MODULE_MEETINGS=true`), konto `audyt@dbr77.local`, 1440×900, motyw jasny.
Skrypty: `scripts/dev/jezyk-jmale/zrzuty-jmale.mjs` (pomiar),
`scripts/dev/jezyk-jmale/skoryguj-przed.mjs` (przeliczenie fazy PRZED).

## Wynik — obce słowa w INTERFEJSIE (bez danych z bazy)

| Moduł | ekrany | EN przed (surowo) | EN przed (**skorygowane**) | EN po | PL przed | PL po |
| --- | --- | --: | --: | --: | --: | --: |
| 13 Organizacja | 4 | 152 | **152** | **0** | 0 | 0 |
| 08 Wyniki | 3 | 10 | **0** | **0** | 0 | 0 |
| 12 Spotkania | 1 | 9 | **0** | **0** | 0 | 0 |
| 03 Wywiad | 1 | 0 | **0** | **0** | 0 | 0 |
| 11 Audyty | 1 | 0 | **0** | **0** | 0 | 0 |
| 06 Inicjatywy · 07 Realizacja | 2 | 56 | **0** | **0** | 9 | 1¹ |

¹ „Manual Energy Draft Owner" — nazwisko/rola właściciela z danych pokazowych,
nie interfejs; przyrząd nie zna tej kolumny.

## Dlaczego kolumna „skorygowane" i czemu liczby PRZED spadły

Liczby PRZED zmierzył przyrząd w wersji sprzed czterech własnych poprawek
(patrz niżej). Porównanie „9 → 0" liczone DWOMA różnymi przyrządami nie jest
dowodem, tylko złudzeniem — to lekcja z paczki J7b. `skoryguj-przed.mjs` bierze
linie zapisane w plikach `przed/*.png.json` i przepuszcza je przez **ten sam**
klasyfikator, którym policzono PO. Kolumna „skorygowane" jest jedyną, którą
wolno zestawiać z kolumną „po"; surowa zostaje obok, żeby było widać różnicę.

**Wniosek, który z tego wychodzi — i który trzeba czytać dosłownie:** jedynym
modułem z polskim WIDOCZNYM na zrzucie EN była Organizacja (152 słowa, ekran
„Identity & Operating Model" — dokładnie ten, na który patrzył właściciel).
W pozostałych pięciu defekt siedział w KODZIE, nie na tych konkretnych
ekranach: polskie `defaultValue` w `t()` pokazuje się użytkownikowi EN przy
pierwszym malowaniu (`react.useSuspense: false`) i **na stałe**, gdy klucza
brakuje w `en/translation.json` — a brakowało go np. dla 42 kluczy
`organization.readiness.*` i 13 kluczy `valuation.*`. Zrzut z jednego przebiegu
tego nie łapie; skaner kodu łapie.

## Co liczy przyrząd

Cały `document.body.innerText`. Wiersz, którego treść pokrywa się z wartością
z bazy (tytuł inicjatywy, karty wyników, spotkania, nazwisko — również
z `ie_aggregate_state.payload_json`), trafia do wiadra **DANE** i NIE liczy się
jako interfejs. Język danych to osobna kategoria (K6) i osobna paczka —
dlatego polskie tytuły inicjatyw DBR77 widać na zrzutach EN i to jest poprawne.
Zapytania budujące wiadro DANE żyją w JEDNYM pliku
(`scripts/dev/jezyk-jmale/dane-zapytania.mjs`), z którego czytają oba skrypty.

## Cztery poprawki przyrządu (każda zmierzona, nie domniemana)

1. **„problem" i „model"** — słowa identyczne w obu językach. Angielski
   placeholder „No problem description" liczył się jako polski (mierzone na
   `01-inicjatywy-en`: 338 → 307 trafień po samej tej poprawce).
2. **„mar"** — jednocześnie polski skrót marca i angielski skrót March.
   Na liście spotkań w EN dawał 9 fałszywych trafień („Mar 18, 2026").
3. **Wiadro DANE** rozszerzone o tabele Wyników (`rvn_kpi_scorecards`,
   `okr_vnext_*`, `rvn_roi_cases`), Spotkań, Audytów i o payload agregatu
   inicjatyw (`title`/`problem`/`proposedOutcome`).
4. **Skaner kodu** (`scripts/i18n/pomiar-jezyka.mjs`) — cztery fałszywe klasy
   trafień: treść komentarzy blokowych `{/* … */}`, treść komentarzy w skanie
   dat, rzutowania TS `as unknown as`, fragmenty ternary JSX `) : loading ? (`.
   Wszystkie udokumentowane w kodzie z numerem pliku i linii, na której je
   zmierzono.

## Ekrany

- **organizacja/** — Tożsamość i model działania · Cele i mierniki ·
  Wyzwania i dowody · Ryzyka i szanse
- **wyniki/** — KPI · ROI · OKR
- **spotkania/** — lista spotkań
- **wywiad/** — Wywiad
- **audyty/** — Programy audytu
- **resztki/** — Inicjatywy · Realizacja
