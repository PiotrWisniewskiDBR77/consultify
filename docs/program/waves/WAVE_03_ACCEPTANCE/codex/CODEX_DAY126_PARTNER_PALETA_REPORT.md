# CODEX DAY126 — Partner paleta — raport

Data: 2026-08-29  
Gałąź: `codex/day126-partner-paleta-20260829`  
Marker i HEAD pomiaru: `714faf5f8b0d9cda8204fec9495893c9fe97bed7`  
Werdykt: **TEZA ZLECENIA OBALONA / BRAK ZMIANY PRODUKTOWEJ**

## 0. Wejście i tożsamość

Instrukcja była `WYDANA`. Marker był przodkiem `github-backup/codex/m03-admin-20260824`; tip uciekł o jeden commit instrukcyjny `6144dae333`. Zgodnie z `DEC-2026-08-26-95` worktree utworzono dokładnie z markera.

```text
714faf5f8b0d9cda8204fec9495893c9fe97bed7
```

`git status --short | head -3` po utworzeniu worktree: brak wyjścia. Dysk: `71 GiB` wolne. Porty `6009`, `4918`, `4919`: wolne przed startem.

Różnica marker → tip:

```text
6144dae333 docs(day125-129): FALA PRZEKROJOWA — jedna wada, wszystkie moduly naraz
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_125_CRIMSON.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_126_PARTNER_PALETA.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_127_JEZYK_CZAT_PARTNER.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_128_ZERA_KODY.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_129_FIXTURE_FINANSE.md
```

## 1. Lokalna baza i runtime

- kontener: `cx-day126-pg`, obraz `pgvector/pgvector:pg16`, port `127.0.0.1:6009`;
- baza: `consultify_w3_partner_owner_day126`;
- migracje: pierwszy przebieg `863`, drugi `0`, oba zakończone `Postgres migrations complete`;
- fixture: `wave3-partner-owner-review-v1`; readback `bound_partner=1`, `certifications=2`, `participant_facts=1`, `commissions=0`, `payouts=0`;
- runtime: klient `4919`, serwer `4918`, health/ready/frontend `200/200/200`, SHA serwera i klienta zgodne z markerem, SQL `ok`;
- środowisko runtime: `DOTENV_DISABLED`, brak zabronionych kluczy w procesach, `ENABLE_TEST_AUTH_BYPASS=false`.

## 2. Z30 — zero wysyłki

Przed migracjami:

```text
BRAK ZMIENNYCH POCZTY
```

`grep` drenaży w `server/src/Gateway.ts`: `0` trafień. Po migracjach i ponownie po seedzie:

```text
 key | left
-----+------
(0 rows)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

## 3. B.1 — własny pomiar przed zmianą

Teza „Partner renderuje ciemną paletę mimo preferencji jasnej” **nie reprodukuje się** na wskazanym markerze.

Po zalogowaniu OWNER runtime startował zgodnie z zapisaną preferencją `dark`. Po jawnym kliknięciu `Light`:

```json
{
  "htmlClass": "focus-highlight",
  "mainBg": "rgb(248, 250, 252)",
  "mainColor": "rgb(15, 23, 42)"
}
```

Po jawnym kliknięciu `Dark`:

```json
{
  "htmlClass": "focus-highlight dark",
  "mainBg": "rgb(15, 23, 42)",
  "mainColor": "rgb(244, 247, 251)"
}
```

Ten sam wynik uzyskano dla stanu niepołączonego. Mianownik runtime: `2/2` stany × `2/2` motywy = `4/4` poprawnie rozróżnione obrazy.

## 4. Rozstrzygnięcie trzech hipotez

1. Własny kontener nadpisujący globalny: **NIE**. `src/components/Partner/PartnerLayout.tsx:114-144` używa par `bg-slate-*` / `dark:bg-navy-*`, nie wymusza klasy `dark`.
2. Klasa motywu nie dociera do Partnera: **NIE**. `src/providers/AppProviders.tsx:30-47` dodaje lub usuwa `dark` na `<html>`; pomiar DOM potwierdził zmianę klasy w obu kierunkach.
3. Twarde ciemne kolory zamiast tokenów/par: **NIE jako przyczyna defektu całości**. Korzeń i sidebar mają jawne pary jasne/ciemne (`PartnerLayout.tsx:115,142-144`; `PartnerSidebar.tsx:377-400,430-469`). Akcenty semantyczne istnieją, ale nie utrzymują ciemnego tła po wyborze Light.

Najbardziej prawdopodobna przyczyna pakietu Day112 to błędne etykietowanie lub brak jawnego przełączenia preferencji przed zrzutem; to wniosek, nie dowód historyczny.

## 5. B.2 i B.3 — brak pozornej naprawy

Nie zmieniono kodu produktu. Najmniejsza poprawna zmiana dla działającego zachowania to brak zmiany. Z tego powodu dowód mutacyjny „zepsuj → czerwony → przywróć → zielony” nie ma uczciwego przedmiotu: stworzenie nowego testu przechodzącego przed rzekomą naprawą byłoby tautologią zakazaną przez B.3, a celowe wprowadzanie regresji bez naprawy nie stanowi dowodu naprawy.

Stan produktu po pomiarze: `git diff` dla `src/views/partner/**` i `src/components/Partner/**` pusty. Kontrakty kart N: `0` zmian.

## 6. B.4 — regresja po pełnych nazwach

Dwukrotnie uruchomiono ten sam jawny pakiet Partnera z `RUN_DB_TESTS=0 MOCK_DB=true` i `--retry=0`. Pułapki Z33 (a)–(d) nie leżą na tej czysto komponentowej/jednostkowej ścieżce; (e) nie dotyczy komponentów kart. Pakiet nie jest dowodem egzekucji Gateway/DB, tylko porównaniem regresji UI/jednostek.

- baseline: `181` pełnych nazw, `180 PASS`, `1 FAIL`;
- replay: `181` pełnych nazw, `180 PASS`, `1 FAIL`;
- `diff -u` posortowanych par `(fullName,status)`: brak wyjścia, delta nazw/statusów `0/181`;
- zastany identyczny FAIL: `EarningsSection V8 payout request seam does not expose a payout request mutation even when historical balance is available`.

Nie nazywam pakietu zielonym.

## 7. B.5 — zrzuty 4/4

| Stan | Motyw | Artefakt | SHA-256 |
| --- | --- | --- | --- |
| connected | Light | `/private/tmp/cx-day126-partner-paleta-artefakty/day126-connected-light.png` | `4a03782fcfbca538813dbe4e9db631f24d5a060405c6cec12f585d98e3c93c90` |
| connected | Dark | `/private/tmp/cx-day126-partner-paleta-artefakty/day126-connected-dark.png` | `d257d17e5522ba847b3831a4d7b8c1acfaf071b810a9821792097a930b4edd4b` |
| unconnected | Light | `/private/tmp/cx-day126-partner-paleta-artefakty/day126-unconnected-light.png` | `c4c21dcc9993f7006acc2841cf4c95689d1ab5a61d8f9d24f5c8e8941490364e` |
| unconnected | Dark | `/private/tmp/cx-day126-partner-paleta-artefakty/day126-unconnected-dark.png` | `9f0a98eeac2f7617cfd01b7baa9ed3954a058bd4a8056d4ff312c146e032a2cd` |

## Korekty wobec instrukcji

- Teza §A o ciemnej palecie w Light została obalona przez własny runtime na dokładnym markerze.
- Oczekiwana historyczna diagnoza `5/5` nie jest prawdą dla aktualnego, jawnie przełączonego runtime; nie naprawiono działającego kodu.
- W3 nie zwrócił trafienia, ponieważ aktualny seeder nie pinuje już trzycyfrowego progu migracji; wymaga niepustego i w pełni udanego ledgera (`successful < 1`, `failed !== 0`). To bezpieczniejszy kontrakt niż historyczna równość.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie odtworzono dokładnych 53 historycznych zrzutów Day112 ani narzędzia, które nadało im nazwy `-full-light`; dlatego przyczyna ich błędnej palety pozostaje `NOT_PROVEN`.
- Nie sprawdzono wszystkich `5/5` historycznych powierzchni osobno; sprawdzono `2/2` reprezentatywne stany na tym samym ekranie Partnera w `2/2` motywach.
- Nie wykonano mutacji w obie strony, ponieważ nie było naprawy do udowodnienia.
- Nie wykonano owner acceptance; dowód jest techniczny i nie podnosi G18.

## Pliki zmienione względem markera

Do pierwszego commita: wyłącznie ten raport i `modules/16_PARTNER/MODULE_ACCEPTANCE.md`. Zero zmian produktu, testów i kart N.

