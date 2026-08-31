# CODEX DAY177 — PARTNER — RAPORT KOŃCOWY PO WZNOWIENIU

Data: 2026-08-30
Marker bazowy: `d3d36cd5f5`
HEAD wznowienia: `32e0b9c3c2c6f46de354da4e2e0f8741fce74d62`
Gałąź: `codex/day177-partner-20260830`
Werdykt pomiaru: `EVIDENCE_PACKAGE_READY_WITH_DEFECTS / OWNER_PENDING` — realna zalogowana persona przeszła 25/25 sekcji w Light i Dark; 50/50 finalnych zrzutów. Żadnej bramki nie podniesiono do PASS.

## 1. Wznowienie po zasadnym STOP-ie

Pierwszy przebieg zakończył się zasadnym STOP-em, ponieważ instrukcyjne `cx177` nie przechodziło allowlisty kanonicznego runtime. Wznowienie od nadzorcy zmieniło wyłącznie nazwę bazy na `consultify_w3_partner_owner_cx177`. Instrukcję ponownie odczytano w całości z vaulta: 714 linii, SHA-256 `96a0c8fc3714872b0594c019f04a475dc4cafb1556336f671f979998d9d31c5d`, stan `WYDANY`.

HEAD i sanity, dosłownie:

```text
32e0b9c3c2c6f46de354da4e2e0f8741fce74d62
codex/day177-partner-20260830
```

`git status --short` był pusty. Dysk miał 16 GiB wolnego. Porty 6077/5024/5025 oraz nazwa `cx-day177-pg` były wolne.

## 2. Realny PostgreSQL, fixture, runtime i auth

- Jednorazowy `cx-day177-pg`, `pgvector/pgvector:pg16`, loopback `127.0.0.1:6077`, DB `consultify_w3_partner_owner_cx177`.
- Pierwsze migracje: sukces, ledger `869 success`; drugie migracje: `Applying migrations: 0`, sukces.
- Seeder: exit 0; readback `bound_partner=1`, `certifications=2`, `participant_facts=1`, `commissions=0`, `payouts=0`.
- Manifest 0600: `/private/tmp/cx-day177-partner-artefakty/partner-owner-manifest-resume.json`; SHA-256 `1dc3f1ca8a96429a6c04ffa1d9d790d2557708bfd745a6827ef0851e720ece68`.
- Kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs` w `adopt-existing`: health 200, ready 200, frontend 200; SQL marker i client marker zweryfikowane; 869 migracji; build SHA zgodny.
- Auth manifest: `nodeEnv=development`, `enableTestAuthBypass=false`, `e2eMode=false`, `enableTestGateway=false`, `enableTestSupport=false`.
- Login fixture: serwer znalazł użytkownika, `Password valid: true`; kolejne żądania mają `Token extracted: YES` i przechodzą realny `AuthMiddleware`.
- Kanoniczny stop: oba proces-groupy zakończone, porty 5024/5025 wolne, baza zachowana do końcowego resetu.

Pierwsza próba logowania o 19:43:12 zwróciła 401 i pozostawiła konsolowe `Login error: Object`; druga o 19:43:48 była skuteczna. Ten historyczny błąd logowania nie jest przypisany do sekcji portalu, ale pozostaje jawnie w logu.

## 3. Z30 — zero wysyłki

Przed seedem i bezpośrednio przed runtime: `BRAK ZMIENNYCH POCZTY`, 0 wierszy `settings.key LIKE 'smtp%'`, 0 trafień drenaży w `server/src/Gateway.ts`. Po seedzie oraz po komplecie zrzutów nadal 0 kluczy `smtp%`. Manifest runtime potwierdził `DOTENV_DISABLED`, brak zabronionych kluczy w czterech należących do dyżuru procesach i brak poświadczeń serwera po stronie Vite.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

## 4. Metoda i pułapki Z33

Nie uruchomiono Vitest jako dowodu; dowodem był pełny produkt. Runtime miał realny PG, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, realny login i `NODE_ENV=development`, więc pułapki (a)–(d) nie zastąpiły auth lub bazy atrapą. Dla (e) mianownik policzono samodzielnie: 7 grup, 25 pozycji i runtime switch.

W przeglądarce finalny pakiet wymagał jednocześnie: `[active]` na właściwym przycisku, `document.documentElement.lang === 'pl'`, brak klasy `dark` dla Light i obecność `dark` dla Dark. Wcześniejsze niezweryfikowane serie zostały nadpisane; finalne JSON-y mają 25/25 aktywnych pozycji w każdym motywie.

## 5. Tabela 25 sekcji

Ścieżka każdego zrzutu: `/private/tmp/cx-day177-partner-artefakty/177-<id>--<light|dark>.png`. Pełne 50 hashy: `/private/tmp/cx-day177-partner-artefakty/177-screenshots-SHA256SUMS.txt` (50 wierszy).

| # | Sekcja | Werdykt | Dowód | Uwaga |
|---:|---|---|---|---|
| 1 | partner-home | renderuje się | `177-partner-home--light.png`, `--dark.png` | fixture widoczny, PL spójny |
| 2 | dashboard | błąd | `177-dashboard--light.png`, `--dark.png` | UI renderuje, ale w tle 005 HTTP 500 i zapytanie 006 |
| 3 | metrics | renderuje się | `177-metrics--light.png`, `--dark.png` | i18n: `0 months`, `Governed runtime snapshot` |
| 4 | referral-tools | renderuje się | `177-referral-tools--light.png`, `--dark.png` | angielski breadcrumb |
| 5 | referral-analytics | renderuje się | `177-referral-analytics--light.png`, `--dark.png` | angielski breadcrumb |
| 6 | referred-organizations | renderuje się | `177-referred-organizations--light.png`, `--dark.png` | widoczny `Wave 3 Referred Participant`; i18n |
| 7 | earnings | błąd | `177-earnings--light.png`, `--dark.png` | 005: HTTP 500; polski stan blokady, angielski breadcrumb |
| 8 | statements | błąd | `177-statements--light.png`, `--dark.png` | wspólna ścieżka earnings-summary HTTP 500 |
| 9 | payouts | błąd | `177-payouts--light.png`, `--dark.png` | wspólna ścieżka earnings-summary HTTP 500 |
| 10 | payout-settings | błąd | `177-payout-settings--light.png`, `--dark.png` | wspólna ścieżka earnings-summary HTTP 500 |
| 11 | client-access | renderuje się | `177-client-access--light.png`, `--dark.png` | angielski breadcrumb |
| 12 | organizations | błąd | `177-organizations--light.png`, `--dark.png` | tabela pokazuje fixture, ale log ma cichy `uuid = text`; angielski breadcrumb/status |
| 13 | projects | błąd | `177-projects--light.png`, `--dark.png` | 006 na `/api/v8/partner/projects`, UI pokazuje fałszywe `Brak aktywnych projektów` |
| 14 | users | pusty | `177-users--light.png`, `--dark.png` | UI pokazuje `0 users`; fixture ma partner users, brak danych w widoku |
| 15 | learning-path | renderuje się | `177-learning-path--light.png`, `--dark.png` | dane certyfikacji obecne; rozległy angielski content |
| 16 | exams | renderuje się | `177-exams--light.png`, `--dark.png` | dane obecne; angielskie nazwy/statusy |
| 17 | certificates | renderuje się | `177-certificates--light.png`, `--dark.png` | certyfikat obecny; angielska nazwa/breadcrumb |
| 18 | company-info | renderuje się | `177-company-info--light.png`, `--dark.png` | formularz i fixture obecne; angielski breadcrumb/nazwa |
| 19 | specializations | renderuje się | `177-specializations--light.png`, `--dark.png` | kontrolki widoczne; angielski breadcrumb |
| 20 | regions | renderuje się | `177-regions--light.png`, `--dark.png` | kontrolki widoczne; angielski breadcrumb |
| 21 | public-listing | renderuje się | `177-public-listing--light.png`, `--dark.png` | angielski breadcrumb i cała karta preview |
| 22 | documentation | renderuje się | `177-documentation--light.png`, `--dark.png` | angielski breadcrumb, nagłówki i nazwy zasobów |
| 23 | marketing | renderuje się | `177-marketing--light.png`, `--dark.png` | angielski breadcrumb/nazwy zasobów |
| 24 | case-studies | renderuje się | `177-case-studies--light.png`, `--dark.png` | angielski breadcrumb/nazwy zasobów |
| 25 | templates | renderuje się | `177-templates--light.png`, `--dark.png` | angielski breadcrumb/nazwy zasobów |

Suma: `17 renderuje się / 7 błąd / 1 pusty`. Komplet wizualny: `25/25 Light + 25/25 Dark = 50/50`.

## 6. Retest PRT-D62-005 / 006 / 007

### PRT-D62-005 — POTWIERDZONY

Realny `GET /api/v8/partner/earnings-summary` przechodzi przez `AuthMiddleware` z użytkownikiem fixture i zwraca HTTP 500, kod `PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER`, komunikat `Approved Partner accrual policy is not configured`. W logu pomiaru wystąpił wielokrotnie (`24` wpisy kodu błędu, bo sekcje i powtórzone walidowane serie odświeżały wspólną ścieżkę). UI pokazuje uczciwy polski stan blokady, ale zgodnie z definicją zlecenia HTTP 500 oznacza werdykt `błąd`.

### PRT-D62-006 — POTWIERDZONY

Realny `/api/v8/partner/projects` z podpisanym tokenem wykonuje zapytanie, które łączy `partner_attributions.organization_id` z `projects.organization_id` i kończy się `operator does not exist: uuid = text`. UI mimo błędu pokazuje `Brak aktywnych projektów`, czyli cichy błąd wygląda jak zero. Powtórzenia `uuid = text` w pełnym logu: 28 wpisów (warn+error oraz wcześniejsze/nawigacyjne zapytania).

### PRT-D62-007 — POTWIERDZONY, ALE NIE 25/25

W polskim UI (`lang=pl`) mieszana lokalizacja dotyczy dokładnie `23/25` sekcji. Bez uchwytnego angielskiego tekstu były `partner-home` i `dashboard`. `metrics` ma `0 months` i `Governed runtime snapshot`; pozostałe 22 sekcje mają co najmniej angielski breadcrumb, nazwę zasobu, status albo treść. Komunikat blokady economics jest dziś po polsku, więc stara teza o angielskim komunikacie została obalona, ale ogólny defekt i18n pozostaje szeroki.

## 7. Korekty wobec instrukcji

- Wznowienie autoryzowało nazwę `consultify_w3_partner_owner_cx177` zamiast literalnego `cx177` w §0.2c; tylko tę wartość zmieniono w komendach DB/runtime.
- BSD `cat` nie obsługuje `cat -A`; mianownik policzono z typu, navGroups i runtime switch.
- `git log -1 A B` pokazuje jeden najnowszy commit; oba SHA sprawdzono osobno.
- Pierwsze automatyczne serie obrazów nie potwierdzały aktywnej sekcji/motywu i nie zostały zaliczone. Finalne 50 plików nadpisano dopiero po walidacji active+lang+theme.

## 8. Pomiar §0.4a i twierdzenia niezweryfikowane

Zmiany repo ograniczają się do tego raportu oraz dopisku Day177 w `MODULE_ACCEPTANCE.md`. Kod produktu i testy: 0 zmian. Nowe/zmienione przypadki testowe: mianownik 0, uruchomione 0, pominięte 0; nie przedstawiam tego jako PASS. Dowodem jest realny runtime i pakiet 50 zrzutów.

TWIERDZENIA NIEZWERYFIKOWANE:

- Owner acceptance — PENDING; wykonawca nie podnosi bramek.
- Kompletność funkcjonalna economics G09/G16–G20 — poza zakresem i nadal OFF.
- `users`: nie rozstrzygnięto, czy 0 wynika z brakującego kontraktu fixture dla tego endpointu, czy z defektu mapowania; dlatego werdykt `pusty`, nie `renderuje się`.

## 9. Artefakty poza repo

Katalog: `/private/tmp/cx-day177-partner-artefakty`.

- `177-<id>--light.png`, `177-<id>--dark.png` — 50 finalnych zrzutów;
- `177-screenshots-SHA256SUMS.txt` — hash każdego zrzutu;
- `177-light-results.json`, `177-dark-results.json` — DOM, active/lang/theme, console;
- `177-server.log`, `177-client.log`, `177-targeted-server-evidence.log`;
- `177-runtime-state.json`, `resume-runtime-start.log`, `resume-runtime-stop.log`;
- `resume-migrate-1.log`, `resume-migrate-2.log`, `resume-seeder.log`;
- `partner-owner-manifest-resume.json`, `177-final-smtp-readback.txt`.
