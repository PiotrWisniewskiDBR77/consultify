# CODEX DAY 316 — prezentacja błędów frontu

Status: W TOKU. Raport jest aktualizowany po każdej pozycji; brak wpisu `FIXED` bez dowodu mutacyjnego.

## Stan wejściowy i warunek startu

Warunek startu wznowionego dyżuru sprawdziłem na bieżącym markerze wydanym w tej instrukcji, nie na historycznym markerze dyżuru 300.

```text
bc18bc7acac2ec825ebb3db2f1309738ab034d58
      73
server/src/middleware/appErrorMapper.ts:85:export function mapAppErrorResponse(
```

Wynik procedury markera i sanity, dosłownie:

```text
MARKER OK
bc18bc7acac2ec825ebb3db2f1309738ab034d58
```

Tip `github-backup/grafika/m03-20260902` jest nowszy od markera. Pracę rozpocząłem dokładnie z markera; scalenie nowszego tipa pozostaje po stronie nadzorcy.

## Korekty wobec instrukcji

- Zakres `src/services src/api src/hooks src/components`: 642 trafienia — zgodnie z instrukcją.
- Całe `src`: 786 trafień, nie 790. Wiążący jest pomiar `git grep -nE 'data\\.error|err\\.message|error\\.message' -- src | wc -l` wykonany na `bc18bc7...`.

## R1 — mianownik i klasyfikacja

Mój mianownik to 642 trafienia w czterech jawnie wskazanych katalogach. Jest odtwarzalny dokładną komendą instrukcji, obejmuje warstwy HTTP i konsumentów UI objęte licencją, a jednocześnie nie miesza 144 dodatkowych trafień z pozostałych części `src`.

Pełna klasyfikacja per trafienie znajduje się w `REJESTR_FRONT_BLEDY_20260904.md`. Klasyfikację wykonano konserwatywnie: teren dyżurów 314/315 zawsze ma pierwszeństwo; logowanie i sterowanie nie są zmieniane; do `NA EKRAN` zaliczono bezpośrednie ujścia UI oraz błędy propagowane przez licencjonowane klienty HTTP do takich ujść.

Wynik klasyfikacji zostanie utrwalony liczbami z wygenerowanego rejestru w commicie R1; pojedyncze trafienie w `src/services/api/baseClient.ts` Git rozpoznał jako plik binarny z powodu bajtu NUL i oznaczyłem je jawnie jako wymagające osobnego audytu, zamiast wymyślać numer linii.

### Który `ErrorState` jest montowany

Realnie montowany jest `src/components/ui/primitives/ErrorState.tsx`. Dowód dla ścieżki raportów: `src/routes/AppRoutes.tsx:219-220` ładuje `ReportsHub`, `AppRoutes.tsx:2630` renderuje `<ManagementReportsHub />`, `ReportsHub.tsx:56` importuje prymityw, a `ReportsHub.tsx:739` renderuje `<ErrorState message={loadError} retry={loadData} />`. Drugi komponent (`shared/states/ErrorState.tsx`) nie ma produkcyjnego importera; jedyne trafienie ścieżki jest komentarzem w cudzym terenie `MyWork/IdeasTableContent.tsx:570`.

Zgodnie z tabelą licencji warunkowa licencja prezentacji przechodzi więc na `src/components/ui/primitives/ErrorState.tsx`; komponentu `shared/states/ErrorState.tsx` nie zmieniam i nie tworzę trzeciego.

## Środowisko dowodowe

- Dysk na starcie: 61 GiB wolne; po checkout: 58 GiB.
- Porty 5472 i 6332: brak nasłuchu przed startem.
- Kontener: `cx-day316-pg`, baza `cx316`, port hosta 6332, obraz `pgvector/pgvector:pg16`.
- Pierwszy przebieg migracji zakończony `Postgres migrations complete`; drugi: `Applying migrations: 0`; tabela `schema_migrations`: 891 wierszy.
- Bazowy pomiar nazw: 50 pełnych nazw w `/private/tmp/cx-day316-front-bledy-artefakty/przed-nazwy.txt`.

### Z30 — brak wysyłki

`env` zwrócił `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; `Gateway.ts` nie zawiera uruchomienia drenów.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R2–R7

W TOKU.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zmierzyłem jeszcze w realnej przeglądarce, czy `Accept-Language` dochodzi do serwera.
- Nie wyliczyłem jeszcze odsetka `new AppError(...)` z komunikatami angielskimi.
- Nie potwierdziłem jeszcze widoku trzech kodów aplikacyjnych po polsku z `correlationId`.
