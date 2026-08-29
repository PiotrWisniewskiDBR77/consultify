# CODEX DAY 85 — ORGANIZATION OWNER REPORT

Data: 2026-08-29  
Gałąź: `codex/day85-organization-owner-20260829`  
Baza: marker `062a26fe4a0380de7e87d691df8d4dbf05012a46`

## §0.1 — wejście i rozbieżność tipa

Wolne miejsce przed rozpoczęciem: `87 GiB z 1.8 TiB` — więcej niż wymagane `5 GB`.

Wynik markera, dosłownie:

```text
MARKER OK
```

Wynik sanity, dosłownie:

```text
062a26fe4a0380de7e87d691df8d4dbf05012a46
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip `github-backup/codex/m03-admin-20260824` uciekł do przodu. Zgodnie z §0.1 praca zaczęła się dokładnie z markera. Lista commitów i plików rozbieżności została zmierzona komendami wymaganymi w §0.1; dotyczy m.in. późniejszych dyżurów 69/83/84/86, zmian prezentacji, lokalizacji i dokumentacji. Scalenie pozostaje zadaniem nadzorcy.

## §A — kontrakt seedera ustalony przed uruchomieniem kontenera

1. **Tworzenie bazy i komenda.** `server/scripts/seed-wave3-organization-owner-review.ts:812-816` mapuje argument `seed` na `seed(ctx)`. Funkcja `seed()` jest w `server/scripts/seed-wave3-organization-owner-review.ts:601-652`, a bazę tworzy sama przez `CREATE DATABASE` w `:608-617`, konkretnie `:613`. Komenda wejściowa jest pokazana w `:5-8`: `npx tsx server/scripts/seed-wave3-organization-owner-review.ts seed`.
2. **Migracje.** Seeder wykonuje je sam w funkcji `seed()`: `server/scripts/seed-wave3-organization-owner-review.ts:635-640` uruchamia `npm run db:migrate:strict`, przekazując `NODE_ENV=test`, `DB_TYPE=postgres` i `DATABASE_URL=TARGET_URL`. Nie wolno wcześniej tworzyć docelowej bazy ani migrować jej ręcznie, bo `:611-612` odrzuca bazę już istniejącą.
3. **Wzorzec nazwy bazy.** `server/scripts/seed-wave3-organization-owner-review.ts:26-27` dopuszcza wyłącznie host lokalny i prefiks `consultify_w3_organization_owner_`; `:131-136` wymusza pełny regex `^consultify_w3_organization_owner_[a-z0-9_]+$`. Przydzielona nazwa `consultify_w3_organization_owner_day85` spełnia kontrakt. Runtime adoptuje ten kontrakt jako `W3-ORGANIZATION-OWNER-v1` w `scripts/dev/start-wave3-owner-runtime.mjs:15-20`.
4. **Zmienne i manifest.** `ORGANIZATION_OWNER_FIXTURE_DATABASE_URL` jest obowiązkowy (`server/scripts/seed-wave3-organization-owner-review.ts:23,121`), host musi być lokalny (`:26,130`), `ORGANIZATION_OWNER_FIXTURE_CONFIRM=YES` jest obowiązkowe dla seed/reset (`:24,152-154`), a `ORGANIZATION_OWNER_FIXTURE_MANIFEST` musi być absolutną ścieżką lokalną (`:25,140-143`). Dla `seed` manifest musi **nie istnieć** (`:144-145`).

### W1–W3

- W1: `server/scripts/seed-wave3-organization-owner-review.ts:589-590` ma `successful_migrations < 831`; nie ma błędnej równości `!== 831`.
- W2: mapa bramek potwierdziła cztery komendy (`seed`, `readback`, `reset`, `verify-two-cycle`), wymagany URL, lokalny host, wzorzec bazy, manifest i `CONFIRM=YES`.
- W3 przed dyżurem: G07 `READY_AFTER_REBUILD_FREEZE`; G08, G09 i G10 `NOT_STARTED` (`MODULE_ACCEPTANCE.md:71-74`).

### Porty przed startem

`lsof -nP -iTCP:5957 -sTCP:LISTEN`, `lsof -nP -iTCP:4790 -sTCP:LISTEN` i filtr `docker ps` nie zwróciły trafień: oba przydzielone porty i nazwa `cx-day85-pg` były wolne.

## Z30 — dowody przed pierwszym zapisem

- `env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|SMTP_ENABLED)"` → `BRAK ZMIENNYCH POCZTY`.
- `grep` drenów w `server/src/Gateway.ts` → `0` trafień.
- Dowód braku konfiguracji SMTP w bazie zostanie wykonany po migracjach, przed uruchomieniem runtime i przed jakąkolwiek operacją produktową mogącą kolejkować wysyłkę.

## Korekty wobec instrukcji

- Tip gałęzi bazowej jest nowszy od markera; to oczekiwane rozejście opisane w §0.1, nie STOP. Start z markera zachowany.
- Pierwsza próba startu runtime użyła ścieżek `/private/tmp/cx-day85-runtime-*`; strażnik `scripts/dev/start-wave3-owner-runtime.mjs:249-259` poprawnie odmówił, bo wymaga bezpośrednich dzieci `/private/tmp` o prefiksach `consultify-wave3-runtime-manifest-*` i `consultify-wave3-runtime-*`. Nie powstał proces ani plik. Druga próba użyła wymaganych prefiksów i przeszła `200/200/200`.
- §0.2b wymaga dosłownego zdania „Nie uruchomiłem `server/src/index.ts`”, ale kanoniczny runtime wymagany w §B.2 uruchamia ten entrypoint z izolacją dotenv i wyłączonym schedulerem. Nie wpisuję zdania nieprawdziwego. Nie uruchomiłem ręcznie żadnego drenażu; `Gateway.ts` ma `0` trafień drenów; baza miała `0 z 0` wpisów SMTP; żaden e-mail ani zaproszenie nie zostało wysłane.
- Najważniejszy wynik: fixture na pełnej bazie daje pełny stan tylko dla `2 z 5` wybranych powierzchni. `Goals & Metrics`, `Challenges & Evidence` i `Risks & Opportunities` pozostają puste także przed usunięciem projekcji. Plików PNG jest `20 z 20`, ale uczciwa macierz stanów to `14 z 20`; sześciu plików nazwanych `*-full.png` nie relabeluję jako pełne.

## B.1 — fixture i readback

`PASS`. Seeder utworzył bazę, sam uruchomił migracje i wykonał dwa readbacki. Osobny readback:

```text
READBACK_EXIT=0
successful_migrations = 863
```

Po wykonaniu prawdziwego pustego stanu pełny dump został odtworzony, a osobny readback końcowy dał:

```text
RESTORE_EXIT=0
READBACK_AFTER_RESTORE_EXIT=0
```

Manifest fixture: `/private/tmp/cx-day85-organization-artefakty/organization-owner-manifest.json`, SHA-256 `fd9311e6eec9fde0d169f9acb7825f6693cd2c1ea03f17ffbb1768eab4a733f9`. Readback końcowy: `/private/tmp/cx-day85-organization-artefakty/organization-readback-after-restore.log`, SHA-256 `a1b489b42cd8d1b8d66fa51e1fb74692bb7f97adc51a94961e7bf0fb7aa46ef4`.

## B.2 — macierz 5 × 2 × 2

Pięć powierzchni ustalonych z realnego menu przed zrzutami: **Identity & Operating Model**, **Goals & Metrics**, **Challenges & Evidence**, **Risks & Opportunities**, **Sources & Claims**.

Runtime: exact SHA `062a26fe4a0380de7e87d691df8d4dbf05012a46`, serwer `4790`, klient `4791`, health/readiness/frontend `200/200/200`, PostgreSQL `5957`, `863` migracje, `ENABLE_TEST_AUTH_BYPASS=false`, realne logowanie OWNER. Manifest runtime: `/private/tmp/consultify-wave3-runtime-manifest-day85.json`, SHA-256 `b7faac9c507d443c5cad67fbdf0494d02004cf56a41ed5526709296c985bf5e9`.

Stan pusty był prawdziwy: po dumpie pełnej własnej bazy usunięto `1 z 1` profil, `2 z 2` items, `27 z 27` claims, `27 z 27` reviews i `1 z 1` snapshot. Konta, organizacja i realne logowanie zostały zachowane. Po zrzutach dump SHA-256 `8b34b7d59968e3f3744c816f913eac0a7d5002f0b33261e347bb41331699b501` został odtworzony i potwierdzony readbackiem.

Pliki PNG na dysku: **20 z 20**, każdy `1211×720`. Stany rzeczywiście spełnione: **14 z 20**. Pełne warianty trzech powierzchni są nieosiągalne z dostarczonego fixture, więc pozostają `NIEZWERYFIKOWANE`, mimo że obrazy diagnostyczne istnieją.

| # | Plik | Werdykt po obejrzeniu |
|---:|---|---|
| 1 | `day85-profile-dark-full.png` | Pełny, dark. Profil `16/16`, `27` faktów, konflikt `profile.industry`; nagłówki PL i EN, wartości głównie EN; opis jest ucięty wielokropkiem. |
| 2 | `day85-profile-light-full.png` | Pełny, light. Ten sam stan; jasny kontrast czytelny; prawy panel i badge lokalny przycięte przez krawędź. |
| 3 | `day85-profile-dark-empty.png` | Pusty, dark, ale nie całkowicie pusty: `2/13`, `Technology`, `0` faktów. Domyślna wartość wygląda jak dana użytkownika. |
| 4 | `day85-profile-light-empty.png` | Pusty, light; ten sam problem `Technology` i `2/13`; brak nachodzenia, prawy przycisk przycięty. |
| 5 | `day85-goals-dark-full.png` | **NIE PEŁNY**: `0/4`, brak celu i KPI. Fixture nie zasila ekranu. |
| 6 | `day85-goals-light-full.png` | **NIE PEŁNY**: jak #5; czytelny pusty stan. |
| 7 | `day85-goals-dark-empty.png` | Pusty, dark; wizualnie taki sam jak #5. |
| 8 | `day85-goals-light-empty.png` | Pusty, light; wizualnie taki sam jak #6. |
| 9 | `day85-challenges-dark-full.png` | **NIE PEŁNY**: `0/2`, oba bloki „Brak pozycji”. Fixture nie zasila ekranu. |
| 10 | `day85-challenges-light-full.png` | **NIE PEŁNY**: jak #9; karta uploadu miesza PL z technicznym `DLA: DOWODY`. |
| 11 | `day85-challenges-dark-empty.png` | Pusty, dark; taki sam jak #9. |
| 12 | `day85-challenges-light-empty.png` | Pusty, light; taki sam jak #10. |
| 13 | `day85-risks-dark-full.png` | **NIE PEŁNY**: `0/2`, ryzyka i szanse puste. Fixture nie zasila ekranu. |
| 14 | `day85-risks-light-full.png` | **NIE PEŁNY**: jak #13. |
| 15 | `day85-risks-dark-empty.png` | Pusty, dark; taki sam jak #13. |
| 16 | `day85-risks-light-empty.png` | Pusty, light; taki sam jak #14. |
| 17 | `day85-sources-dark-full.png` | Pełny, dark: `Sources (2)`, `Conflicts (1)`; treść prawie cała EN; pokazuje surowy UUID i klucz `profile.industry`. |
| 18 | `day85-sources-light-full.png` | Pełny, light; ten sam surowy UUID/klucz; opis konfliktu ucięty przy prawej krawędzi. |
| 19 | `day85-sources-dark-empty.png` | Pusty, dark: `Sources (0)`, `Conflicts (0)` i uczciwa blokada publikacji; treść EN. |
| 20 | `day85-sources-light-empty.png` | Pusty, light; czytelny, ale nadal EN; prawy badge lokalny przycięty. |

## B.3 — inspekcja zrzutów

Obejrzano **20 z 20** plików.

1. **P0 — fixture nie pokrywa trzech powierzchni.** Seeder w `server/scripts/seed-wave3-organization-owner-review.ts:341-386` zasila `organization_profiles`, a `:412-452` zasila governed context; nie zasila buforów `goals`, `challenges` ani `synthesis`. Te ekrany czytają odpowiednio `src/components/Organization/redesign/OrganizationGoalsMetricsScreen.tsx:85-115`, `OrganizationChallengesEvidenceScreen.tsx:66-116` i `OrganizationRisksOpportunitiesScreen.tsx:70-112`. Wynik: pełny stan osiągnięty dla `2 z 5` powierzchni.
2. **P0 — mieszany język na 20 z 20.** Nawigacja jest po EN przez jawne mapy `src/components/Organization/redesign/organizationRedesignNav.ts:103-123`, a treść ekranów profilu/celów/wyzwań/ryzyk jest PL. Governance fallbacki są EN w `src/components/Organization/GovernedContextWorkspace.tsx:381-435,478-483`; boundary plików wybiera EN w `OrganizationDecisionQualityPanel.tsx:308-326`.
3. **P0 — surowe identyfikatory.** Sources pełny pokazuje UUID źródła i `profile.industry`; bezpośredni render `source.itemId` jest w `src/components/Organization/GovernedContextWorkspace.tsx:486-491`.
4. **P1 — fałszywie niepusty empty profile.** Po usunięciu wszystkich profilowych i governed rows ekran pokazuje `Technology` oraz `2/13`, zamiast uczciwego zera. Domyślny store nie jest pusty (`src/store/useContextBuilderStore.ts:132-161`), a ekran traktuje store jak dane robocze.
5. **P1 — clipping.** W obu motywach opis profilu i daty akceptacji są ucięte; na Sources opis konfliktu wychodzi poza prawą krawędź; badge `LOCAL @062a…` nachodzi na treść na wszystkich `20 z 20`.
6. **P1 — crimson poza semantyką krytyczną.** Pstryczek `Model` jest crimson na wszystkich `20 z 20`, mimo że nie komunikuje krytycznego stanu; logo/licznik `77` także jest crimson.
7. **Formaty.** Kwoty w wymaganym formacie `1 250,00 €` nie występują na żadnym z `20 z 20`; `NOT_PROVEN`. Pełny profil pokazuje surową liczbę przychodu dopiero poniżej viewportu, więc nie oceniam jej z tych zrzutów. Daty są częściowo PL (`29.08.2026`, `2 godz. temu`), ale bywają ucięte.

Nie zmieniono kodu ani seedera. Wszystkie defekty są tylko zgłoszone.

## Wynik bramek G07–G10

- G07: `READY_FOR_GUIDED_REPLAY_WITH_FINDINGS` — karta i techniczny pakiet istnieją, ale właściciel nie wykonał odbioru.
- G08: `PACKET_READY_WITH_FINDINGS / OWNER_NOT_REVIEWED`.
- G09: `PARTIAL_TECHNICAL / OWNER_NOT_REVIEWED` — realne logowanie i pięć tras potwierdzone, ale trzy szczęśliwe ścieżki nie mają pełnych danych.
- G10: `PARTIAL_EVIDENCE_14_OF_20 / OWNER_NOT_REVIEWED` — 20 plików obejrzanych, lecz tylko `14 z 20` stanów jest prawdziwych.

## SHA-256 — 20 z 20 PNG

```text
71c7805e4500ca05b1bf191203a937fd37a4db2ed61739df7e864733e4799b96  day85-challenges-dark-empty.png
6a34c107a70eeeaebdbbf940e1ea86f209fe9847f83681c22cf8ecabba05fe5b  day85-challenges-dark-full.png
179dcc0a363b27e69e8f9a293034ec37eb4eb1160bdca7469211df25ba451666  day85-challenges-light-empty.png
89ae9e1018404c1a17fdfa93dffaf7a4bf13eac2f19a2cef863c2e87b56e3044  day85-challenges-light-full.png
46f537b8574f950bf10f6a9459d8a8ddfa2221c81c7ead3ee45f0394e415c0f6  day85-goals-dark-empty.png
d496427ca31e4421b07403744b5b31c3c79629d489f56511e60b4f6cf0bc5e48  day85-goals-dark-full.png
958642e2dde20b327444ef569faa9a0cff706c8273a2de6ecf47d06f657f02eb  day85-goals-light-empty.png
fbad382882a3c4a7259ae69291e8f1423ca83b3abdb4091d396a373ab1053b18  day85-goals-light-full.png
dfa5b7d74febba9853e90d07b475a87eeb34af20252588d767ac1fc3a4a329fb  day85-profile-dark-empty.png
d6ef82eb98463486b3cca05f888715acc45ca31c2bbd988e2c7bfd531cbee907  day85-profile-dark-full.png
21f5a2928275dd486c2b32b9dbc804607ec82be473cf23d276d5c0bd88fcf016  day85-profile-light-empty.png
fa31d4943914de7d2d178087c3f9200843e6deddfb88899ddda0f8cedbdb180d  day85-profile-light-full.png
21c6d58c33ed7293a2a7e382d211347aa13a3d3fdd459f0864ce28eed81b2894  day85-risks-dark-empty.png
3ad472e12959baaa71c661c0356ac94ee6f34cb9855522b4ab8a500d93c75267  day85-risks-dark-full.png
4a73b2e3128270a54e42deb9e24b8af00e68c82a18b01ca9d2fc6440a467ada0  day85-risks-light-empty.png
45ec102443e6f078bbf9cc3637fd3cfd6ddc2eecbe8772b70bbcf2ff8515d98d  day85-risks-light-full.png
2451663211b6938f4209199e887758e56e2d4e750494cb85a335a67c9e2e1c66  day85-sources-dark-empty.png
375414ecc28444de7b3528d456c22c880924fe5c6f10981fff72ea1806da9aed  day85-sources-dark-full.png
23d954819c5ee3d143c36ca4f06c7d1c155b79c25db24a1d27f275686eb30004  day85-sources-light-empty.png
e20a895a423fb47ff1dda640f0d1ed83632bf1f4d8a5c3e12af1b4b535e42f2f  day85-sources-light-full.png
```

## Z30 — deklaracja końcowa

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru zawierała `0 z 0` wierszy konfiguracji SMTP. Kanoniczny runtime uruchomił entrypoint serwera z izolacją dotenv i wyłączonym schedulerem; nie uruchomiłem ręcznie żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Kryteria K1–K6

| Kryterium | Wynik |
|---|---|
| K1 | `PASS` — cztery odpowiedzi kontraktu z `plik:linia` zapisano przed kontenerem. |
| K2 | `PASS` — seed i dwa osobne readbacki zielone; końcowy readback po restore `exit 0`. |
| K3 | `PASS DLA LICZBY PLIKÓW` — raport `20 z 20`, dysk `20 z 20`, wszystkie SHA-256 podane; uczciwa macierz stanów tylko `14 z 20`. |
| K4 | `PARTIAL` — obejrzano `20 z 20`, ale pełny stan trzech powierzchni jest `NIEZWERYFIKOWANE`, bo fixture go nie dostarcza. |
| K5 | `PASS` — diff obejmuje wyłącznie ten raport i `modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md`; zero kodu i seederów. |
| K6 | `PASS` — register zapisuje `PARTIAL_EVIDENCE_14_OF_20`, nie fałszywe `PASS`/`FIXED`. |
