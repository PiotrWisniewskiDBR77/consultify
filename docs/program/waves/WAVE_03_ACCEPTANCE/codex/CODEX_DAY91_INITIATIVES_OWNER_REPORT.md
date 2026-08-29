# CODEX DAY 91 — Inicjatywy — raport pakietu odbioru właściciela

Data pomiaru: 2026-08-29  
Gałąź: `codex/day91-initiatives-owner-20260829`  
Marker: `d80dd85cc7784095eed6f711b42366e5d9b7f74e`

## Stan wejściowy i baza pracy

`df -h /`: `/dev/disk3s1s1`, dostępne `76Gi` — próg 5 GB spełniony.

Wynik §0.1(2), dosłownie:

```text
05ed8ff336 docs(day91): instrukcja odbioru wizualnego Inicjatyw (zlozona skryptem ze szkieletu)
d80dd85cc7 docs(ledger): DEC-319..322 — gitignore polknal instrukcje 89, STOP 88 z bledu pomiaru, mylacy komunikat AI, odbior 89
[dalsze 23 pozycje logu zachowane w wyjściu sesji]
MARKER OK
```

Wynik §0.1(7), dosłownie:

```text
d80dd85cc7784095eed6f711b42366e5d9b7f74e
```

`git status --short | head -3` nie zwrócił żadnego wiersza.

Tip bazowy uciekł o jeden commit:

```text
05ed8ff336 docs(day91): instrukcja odbioru wizualnego Inicjatyw (zlozona skryptem ze szkieletu)
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_91_INICJATYWY_ODBIOR.md
```

## §A — kontrakt seedera ustalony przed uruchomieniem kontenera

1. Bazę tworzy funkcja `seed(ctx)` wyłącznie dla komendy `seed`: dyspozytor `server/scripts/seed-wave3-initiatives-owner-review.ts:856-859`, funkcja `:806`, kontrola nieistnienia `:811-812`, `CREATE DATABASE` `:813`.
2. Migracje wykonuje sam seeder w komendzie `seed`, przez `npm run db:migrate:strict`: `server/scripts/seed-wave3-initiatives-owner-review.ts:817-822`. Ogólna sekwencja §0.2c(A), która uruchamia kontener z już utworzoną bazą, nie pasuje do tego kontraktu; zastosowany zostanie kontrakt seedera.
3. URL musi wskazywać host lokalny (`127.0.0.1`, `localhost` albo `::1`): `server/scripts/seed-wave3-initiatives-owner-review.ts:16,126`. Nazwa musi mieć prefiks `consultify_w3_initiatives_owner_` i spełniać `^consultify_w3_initiatives_owner_[a-z0-9_]+$`: `:17,127-132`. Przydzielona nazwa `consultify_w3_initiatives_owner_day91` spełnia wzorzec runtime'u: `scripts/dev/start-wave3-owner-runtime.mjs:77-79`.
4. Zawsze wymagane jest `INITIATIVES_OWNER_FIXTURE_DATABASE_URL`: `server/scripts/seed-wave3-initiatives-owner-review.ts:13,118`. Dla `seed` wymagane są ponadto `INITIATIVES_OWNER_FIXTURE_CONFIRM=YES` (`:14,145-146`) oraz `INITIATIVES_OWNER_FIXTURE_MANIFEST` jako absolutna ścieżka lokalna, która jeszcze nie istnieje (`:15,136-140`).

W2: próg migracji ma poprawne porównanie `< 858`, nie `!==`: `server/scripts/seed-wave3-initiatives-owner-review.ts:753`.

## Korekty wobec instrukcji

1. Pierwszy odczyt instrukcji wykonano przez `git show` z `workdir=/Users/piotrwisniewski/Developer/Consultify`. Nie było zapisu, ale był to odczyt Git w katalogu właściciela, zakazany przez Z5. Po rozpoznaniu zakazu dalszy odczyt i wszystkie działania wykonano z bare-vaulta albo własnego worktree. Nie przedstawiam tego jako zgodnego z procedurą.
2. §0.1 nakazuje utworzyć `config.worktree` przez `printf`; nadrzędny mechanizm środowiska Codex wymaga zapisu plików przez bezpieczną łatkę. Utworzono dokładnie treść `[core]` / `bare = false`, a `cat` potwierdził dwie linie.
3. Instrukcja odwołuje się do `§0.3`, `§0.4a`, „BLOKU 0”, „tabeli licencji” i sekcji „TEZY ZLECENIA…”, ale tych części nie zawiera. Dowód: wyszukanie pełnego dokumentu zwróciło wyłącznie odwołania w liniach 130, 174, 191, 351, 499 i 585, bez definicji. Bezpieczna interpretacja: zapis wyłącznie w dwóch plikach licencjonowanych imiennie w §D, brak zmian produktu, samodzielny pomiar zajętości portów przed startem i jawne opisanie brakującego pomiaru zasięgu zamiast wymyślania procedury.

## Z30 — dowody i deklaracje

Przed seedem: `env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|EMAIL_LIVE_SEND)"` zwrócił `BRAK ZMIENNYCH POCZTY`.

Przed runtime'em i po seedzie:

```text
SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';
(0 rows)
```

Po starcie: środowisko procesu serwera PID `90155` nie zawierało `SMTP_*`, `RESEND`, `SENDGRID`, `MAIL*` ani `EMAIL_LIVE_SEND`; log własnego runtime'u nie zawierał trafień transportu poczty; ponowny odczyt bazy nadal zwrócił `0` wierszy. Manifest runtime'u potwierdził `dotenvIsolation.serverDisabled=true`, `viteDisabled=true` i `prohibitedKeysAbsentInOwnedGroupProcesses=true`.

„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.”

## B.1 — fixture, migracje i readback

Seeder wykonał własny pierwszy pełny przebieg migracji i zakończył `exit 0`. Readback: `863 z 863` obecnych migracji; `personas 6`, `candidates 2`, `accepted_candidates 1`, `initiatives 1`, `system_portfolios 1`, `project_actor_memberships 1`, `profile_receipts 1`, `execution_links 1`, `execution_relations 1`, `complete_runtime_read_models 1`, `execution_tasks 2`, `execution_decisions 1`, `operational_allocations 2`, `management_signals 1`, `interventions 1`, `report_definitions 1`, `report_runs 1`, negatywne receipts/linki `0`.

Drugi przebieg migracji, dosłownie:

```text
Applying migrations: 0
✅ Postgres migrations complete
```

Niezależna komenda `readback` po drugim przebiegu ponownie zwróciła `successful_migrations: 863` i identyczne liczniki. Manifest: `/private/tmp/cx-day91-initiatives-artefakty/day91-fixture-manifest.json`, tryb `0600`, SHA-256 `75aaaed4391dc28abbce1103c36207a8033597e5088d107654138901308f3e24`.

## B.2 — powierzchnie i macierz zrzutów

Przed zrzutami z realnego menu wybrano `5 z 5` powierzchni: **Table, Kanban, Timeline, Grid, Plan**. Motywy: jasny i ciemny. Stan pusty dla czterech widoków rejestru uzyskano filtrem `Critical`; stan pełny przez `All priorities`. W Planie pusty stan to preset `Published 0`, pełny to `Unscheduled 1`.

Na dysku istnieje `20 z 20` PNG prób. Do macierzy semantycznej zaliczam jednak tylko `16 z 20`: pliki `kanban-full` i `timeline-full` w obu motywach nie pokazują stanu pełnego. Kanban ma cztery kolumny z licznikami `0`; Timeline pokazuje „No initiatives in execution”, mimo że Table i Grid pokazują inicjatywę `W realizacji`. Zgodnie z zakazem relabelowania te cztery pliki są dowodem defektu, nie pełnego stanu.

Manifest sum: `/private/tmp/cx-day91-initiatives-artefakty/day91-screenshots.sha256`. Po końcowym ponownym wykonaniu zrzutów sumy przeliczono ponownie.

```text
27ae982e99eb05591c5722ad0716ca6bc90079fb30a203a15ddf4ff2d9bae0d6  day91-dark-grid-empty.png
dc60cec72bf9b626115e9e2a9e39f6b9ca8e68435b9fd07e49f9151f712e0131  day91-dark-grid-full.png
fda1f5e3c9f435863d2c0c25dfd6e28206e0fe9d434eb3de89f20f9ae129f48e  day91-dark-kanban-empty.png
3b036947ebbeebc024554e2b821910b07fc5e7ab1b979d928e12239d7f5bdba6  day91-dark-kanban-full.png
4a20d45914346ec8c4e49a2927efe3eace9e89b0ef4c60186b42b4fcb8d93126  day91-dark-plan-empty.png
2e1a122757459b342fd9124f42836ad47097b2a857dcfb55358e5745887edc0c  day91-dark-plan-full.png
18c113f6f0acb9a911a84e78592b1b76847a9a2de702213cfe30849ffc4de29d  day91-dark-table-empty.png
b2eb919da2f546b8d14e4059257e1474872927a10c7e87f1a5f97c4c4d693908  day91-dark-table-full.png
af099115ad9130de7c77ce881fa6d3a399436c4ea6695b12bb15e44d4c484b01  day91-dark-timeline-empty.png
e573a003bc086423fee3ec53f5350993efc158800af8f34798cffacdb9b3e76c  day91-dark-timeline-full.png
2932731db5d2089cdb2389fc03c805c4147d029bab9cc5fa139d8a4b194e51e3  day91-light-grid-empty.png
8588898b1eedcde83196ef33ad946af11e34b6b4de397cb827642b60341e8539  day91-light-grid-full.png
61c2fe77ea5e62cd6a0af56cf25661f02416474be63a005b7e26e8c5f388347a  day91-light-kanban-empty.png
24d81b780a021043b3a6dfd4f4cf38623c0daead25d9525ba51a4bc244da8e99  day91-light-kanban-full.png
cff019266307508d31bba934c0a7cd805cd087d35f951bcd08a1c24c5c78bf95  day91-light-plan-empty.png
41736a30c7b8cd64019aae30c258bef4dc96525c960079890d7e61d9a1120bd5  day91-light-plan-full.png
8acb92d9d952f89168b1bdfb15b66cef91b98257690891234f21a5cc0911b288  day91-light-table-empty.png
b3357ee4ceb01fa7d5dc3ae46850d1efa78d5897194b732d9f41f0443e7022cf  day91-light-table-full.png
db3de4cb5c2c3db30c9202efb6dd1e0a17d560304c52e37732135364841501c0  day91-light-timeline-empty.png
eea556c8024b10f5de50c19f0f274242892df0007a3da60e602f50294559a66b  day91-light-timeline-full.png
```

### Pułapki Z33 dla wykonanych dowodów

- Seeder/readback/migracje: (c) wyłączona przez jawne `MOCK_DB=false DB_TYPE=postgres DATABASE_URL=...127.0.0.1:5971...` w tej samej linii; log podał `DB_TYPE: postgres` i tożsamość `127.0.0.1:5971/consultify_w3_initiatives_owner_day91`. (a), (b), (d), (e) nie są podstawą tego bezpośredniego SQL readbacku.
- Runtime/zrzuty: (a)/(e) wyłączone przez manifest `runtimeFeatures.v8GlobalEnabled=true`; (d) przez `auth.enableTestAuthBypass=false` i realne logowanie formularzem; (c) przez skonfigurowaną/aktualną tożsamość RealPG w manifeście; (b) nie leży na badanej ścieżce modułu Inicjatywy. Nie uruchamiano żadnego pakietu Vitest jako dowodu.

## B.3 — oględziny każdego zrzutu

Skróty: `PL/EN` oznacza nagłówki mieszane polsko-angielskie; wartości również mieszane. `—` oznacza brak kwoty/daty w kadrze, nie twierdzenie o poprawnym formacie.

| # | Plik | Nagłówki / wartości | Liczby, kwoty, daty | Ucięcia / ID | Pusty / pełny | Crimson |
|---:|---|---|---|---|---|---|
| 1 | `light-table-full` | PL/EN / PL+EN (`Delivery`, `Just now`, `UNKNOWN`) | `—` | nazwy i owner bez UUID; prawa część tabeli ucięta viewportem | pełny, zaliczony | `Model` crimson bez semantyki krytycznej |
| 2 | `light-table-empty` | PL/EN / EN | liczniki `0` | brak ID | pusty, ale komunikat „No initiatives yet” fałszywie sugeruje pustą bazę zamiast filtr | `Model` crimson |
| 3 | `light-kanban-full` | PL/EN / EN | liczniki kolumn `0` | brak ID | **niezaliczony**: rekord istnieje, plansza pusta | `Model` crimson |
| 4 | `light-kanban-empty` | PL/EN / EN | liczniki `0` | brak ID | pusty, komunikat filtra mylący | `Model` crimson |
| 5 | `light-timeline-full` | PL/EN / EN, miesiące EN | tygodnie i daty w formacie EN (`Aug 2026`) | brak ID | **niezaliczony**: komunikat o braku inicjatyw w execution przy istniejącym `IN_EXECUTION` bez dat | `Model` crimson + czerwony znacznik ścieżki krytycznej semantyczny |
| 6 | `light-timeline-empty` | PL/EN / EN | brak danych | brak ID | pusty, komunikat „No initiatives yet” mylący dla filtra | `Model` crimson |
| 7 | `light-grid-full` | PL/EN / PL+EN (`Executing`, `On track`, `Complete Execution`) | `—` | brak UUID; owner kończy się zbędnym `·`; karta bez ucięcia | pełny, zaliczony | `Model` crimson |
| 8 | `light-grid-empty` | PL/EN / EN | liczniki `0` | brak ID | pusty, komunikat filtra mylący | `Model` crimson |
| 9 | `light-plan-full` | EN / PL+surowe EN (`CURRENT`, `UNKNOWN`) | daty `—` | nazwa inicjatywy ucięta wielokropkiem; brak UUID | pełny, zaliczony | `Model` crimson |
| 10 | `light-plan-empty` | EN / EN | `Published 0` | brak ID | uczciwy „No initiatives in this range” | `Model` crimson |
| 11 | `dark-table-full` | PL/EN / PL+EN | `—` | nagłówek „NASTĘPNE DZIAŁ/” ucięty; brak UUID | pełny, zaliczony | `Model` crimson |
| 12 | `dark-table-empty` | PL/EN / EN | liczniki `0` | chip filtra nachodzi na pasek statusów | pusty, komunikat filtra mylący | `Model` crimson |
| 13 | `dark-kanban-full` | PL/EN / EN | liczniki kolumn `0` | brak ID | **niezaliczony**: rekord istnieje, plansza pusta | `Model` crimson |
| 14 | `dark-kanban-empty` | PL/EN / EN | liczniki `0` | chip filtra nachodzi na pasek statusów | pusty, komunikat filtra mylący | `Model` crimson |
| 15 | `dark-timeline-full` | PL/EN / EN | `Aug/Sep/Oct 2026` | brak ID | **niezaliczony**: brak paska istniejącej inicjatywy | `Model` crimson + semantyczna legenda czerwieni |
| 16 | `dark-timeline-empty` | PL/EN / EN | brak danych | chip filtra nachodzi na pasek statusów | pusty, komunikat filtra mylący | `Model` crimson |
| 17 | `dark-grid-full` | PL/EN / PL+EN | `—` | brak UUID; owner kończy się `·` | pełny, zaliczony | `Model` crimson |
| 18 | `dark-grid-empty` | PL/EN / EN | liczniki `0` | chip filtra nachodzi na pasek statusów | pusty, komunikat filtra mylący | `Model` crimson |
| 19 | `dark-plan-full` | EN / PL+surowe EN | daty `—` | nazwa ucięta; brak UUID | pełny, zaliczony | `Model` crimson |
| 20 | `dark-plan-empty` | EN / EN | `Published 0` | brak ID | uczciwy komunikat zakresu | `Model` crimson |

Znaleziska i wskazania kodu (bez napraw, Z40):

- Kanban grupuje wyłącznie, gdy status rekordu jest dokładnym ID kolumny (`src/components/Portfolio/PortfolioKanbanView.tsx:316-325`); rekord `IN_EXECUTION` nie pasuje do widocznych kolumn `DRAFT/PENDING_REVIEW/IN_REVIEW/PROMOTED`, więc znika.
- Timeline odrzuca każdy rekord bez `startDate`, `plannedEndDate` i `endDate` (`src/components/Execution/ExecutionTimelineView.tsx:957-960`), po czym pokazuje komunikat „No initiatives in execution” (`:1489-1497`) — przyczyna nie jest brakiem inicjatywy, tylko brakiem dat.
- Plan jawnie emituje surowe wartości `CURRENT`, `UNKNOWN`, `NONE`, `ADD_TO_PLAN_OR_EXCLUDE` (`src/components/Initiatives/PlanScenarioSurface.tsx:413-431`).
- Globalny pusty stan uruchamia się po `initiatives.length === 0` i używa ogólnego `initiatives.empty.*` (`src/components/Initiatives/InitiativesHub.tsx:1708-1725`), stąd komunikat tworzenia pierwszej inicjatywy także po filtrze.
- `Model` ma crimson mimo braku krytycznego komunikatu we wszystkich `20 z 20` kadrach; to zgłoszenie wizualne, nie dowód poprawności semantyki backendu.

Konsola przeglądarki po macierzy: `0` błędów i `0` ostrzeżeń w odczycie `tab.dev.logs`.

## B.4 — aktualizacja bramek

Zaktualizowano wyłącznie G06 i G11 do stanu faktycznego tego dyżuru. Nie wpisano `VERIFIED`, `FIXED` ani akceptacji właściciela.

## TWIERDZENIA NIEZWERYFIKOWANE

- Pomiar zasięgu testów z nieobecnego §0.4a: `NIEZWERYFIKOWANE`; brakuje komendy i mianownika, a Z24 zakazuje ich zgadywania.
- Cztery stany pełne Kanban/Timeline: `NIEZWERYFIKOWANE JAKO PEŁNE`; pliki istnieją, ale dowodzą pustego renderu przy istniejącym rekordzie.
- Kwoty i polskie formaty dat: `NIEZWERYFIKOWANE`; fixture nie wyświetla kwot ani dat w Table/Grid/Plan, a Timeline nie renderuje rekordu bez dat.

## K7 — rozłączność

Końcowy wynik przed domykającym commitem:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY91_INITIATIVES_OWNER_REPORT.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/MODULE_ACCEPTANCE.md
```

Zero zmian w `src/**`, `server/src/**`, seederach, migracjach, lokalizacjach i globalnej infrastrukturze testowej. `git status --short` był pusty po dwóch pierwszych commitach. Runtime zatrzymany z `processGroupsVerifiedTerminated: true`, porty `5971` i `4842` wolne; baza zachowana do chwili kontrolowanego sprzątania, następnie własny kontener usunięto przez `docker rm -fv cx-day91-pg`.

Commity i kopia na `github-backup`:

- `420ad92463` — raport dowodowy; push bezpośrednio po pierwszym commicie,
- `ba6183bcac` — aktualizacja G06/G11; push po pozycji.
