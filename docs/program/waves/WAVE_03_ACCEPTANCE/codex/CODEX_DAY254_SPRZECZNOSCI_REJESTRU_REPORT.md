# CODEX DAY 254 — SPRZECZNOŚCI REJESTRU

## Streszczenie

Status: **ZROBIONE**. Na markerze `df7f13056f` potwierdziłem trzy wskazane
sprzeczności, poprawiłem je bez zmiany zachowania produktu i w bounded sweepie
znalazłem oraz poprawiłem czwarty żywy kłamiący komentarz. Push wykonano
wyłącznie na `github-backup`, gałąź
`codex/day254-sprzecznosci-rejestru-20260901`.

Instrukcja dyżuru zabraniała użycia modelu językowego (`Z15`); model, sieć AI i
klucz cloud nie były używane.

## Wejście, marker i zasoby

Dokument miał stan `WYDANY`. Wynik markera i sanity, dosłownie:

```text
MARKER OK
df7f13056fa24995be07f64b0e8c877b3faeab45
```

Tip gałęzi bazowej uciekł do `7a733cb63d`; zgodnie z DEC-2026-08-26-95 praca
zaczęła się dokładnie z markera. Porty `6248`, `5228`, `5229` nie miały
listenerów; `docker ps` nie wykazał `cx-day254-pg`. Przed worktree było 12 GiB,
po utworzeniu 9,4 GiB wolnego. Kontener nie był potrzebny ani uruchamiany:
zakres jest wyłącznie dokumentacyjny, bez testu DB i bez zachowania runtime.

Pełny wynik wejścia: `/private/tmp/cx-day254-sprzecznosci-rejestru-artefakty/r1-wejscie.txt`
(`sha256 23c6821c61c6159f2eec499b4c41153198232c48e8b09f4705dcd4dd4ca19932`).

## R1 — pomiar przed zmianą

- T1: oba README kierowały nowe migracje do `server/migrations-v2/`.
- T2: `.railwayignore:96-97` wykluczało ten katalog i jego zawartość.
- T3: `server/scripts/migrate.postgres.ts:816` wskazywał domyślnie
  `args.dir || 'server/migrations'`.
- T4: własny pomiar: `server/migrations` = **1085** plików SQL,
  `server/migrations-v2` = **39**; najnowsze pliki aktywnego katalogu miały
  datę 2026-09-01.
- T5: pierwsze zdanie podawało 4+2, a szczegółowa sekcja imiennie 3+3.
- T6: nagłówek `runLifecycle.routes.ts` mówił `NOT MOUNTED YET`, lecz
  `caseWorkspace/index.ts:36,60` zawierał import i `router.use`.
- T7: kontrastowy `eventInbox.routes.ts` był poprawnie opisany: osobny import
  i mount istniały w `Gateway.ts:103,936`; pliku nie zmieniono.
- T8: wolne miejsce przekraczało wymagane 5 GB.

Historia audytu uprawnień została zapisana w
`audyt-uprawnienia-historia.txt` (`sha256 9a9148aa902a7d5f73f913db4c41153198232c48e8b09f4705dcd4dd4ca19932`).

## R2 — README migracji

Commit `72fc2c738d` poprawił oba README. Przed: nowe migracje kierowano do
`migrations-v2`. Po: wskazany jest aktywny `server/migrations`, domyślny
katalog runnera, wraz z ostrzeżeniem, że `migrations-v2` i archiwum są
wykluczone z uploadu. Katalogów ani migracji nie usunięto.

## R3 — liczba tras uprawnień

Commit `570b326f0c` zmienił wyłącznie pierwsze zdanie i jego sprostowanie:
`4+2` → `3+3`, zgodnie z imienną sekcją szczegółową. Nie oceniałem, czy same
dostępy zostały naprawione; `Z40` tego zabrania.

## R4 — komentarz run lifecycle

Commit `3e456833b7` usunął nieaktualne twierdzenie `NOT MOUNTED YET` z
nagłówka i wskazał realny mount przez `caseWorkspace/index.ts`. Kod trasy i
montaż pozostały bez zmian.

## R5 — bounded sweep

Przeszukanie pięciu wzorców (`NOT MOUNTED`, `DEPRECATED`,
`TODO.*(remove|delete)`, `temporary`, `tymczasow`) w `server/src/routes` i
`docs/program` dało 288 trafień. Lista jest w `r5-sweep.txt`
(`sha256 47bbf26258b81afe1f18caccf3dd3776bd8193334de7e5f3730ce41b9044ce75`).

Nowy potwierdzony przypadek: `server/src/routes/rolloutExtensions.routes.ts`
twierdził, że nie jest montowany w `Gateway.ts`, podczas gdy realny import i
`app.use('/api/rollout-ext', rolloutExtensionsRoutes)` istnieją w
`Gateway.ts:362,1115`. Commit `b3a9f1cba7` poprawił wyłącznie komentarz.

Sweep pokazał też dalsze podejrzenia (m.in. nagłówki dwóch adapterów Finance i
`v8/finance-value.routes.ts`), lecz bounded zakres zakończył się po jednym
nowym potwierdzonym i naprawionym przypadku; wymagają osobnego odbioru.

## Aktualizacja znaleziska kanonicznego

Na końcu `ZNALEZISKO_MARTWY_KATALOG_MIGRACJI.md` dopisano potwierdzenie
wykonania zadania 1 i pozostawienia zadania 2 do decyzji produktowej.

## Testy i pomiar nazw

Instrukcja nie wskazuje żadnego pliku testowego (literalnie: „brak nowych
plików testowych — praca wyłącznie dokumentacyjna”). Nie uruchamiałem więc
Vitest ani nie przedstawiam `No test files found` jako PASS. Pliki
`przed-nazwy.txt`, `po-nazwy.txt` i ich diff są puste; nie dodano ani nie
utracono żadnej nazwy testu (sha256 pustego pliku:
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`).
Walidacja każdej zmiany: `git diff --check` oraz hooki repo przy commitach.

Pułapki Z33 (a)-(d) nie leżą na ścieżce, bo nie uruchomiono pakietu testowego,
ApiGateway ani runtime. Pułapka (e) dotyczyła R3 i została wyłączona przez
imienne zliczenie sekcji szczegółowej oraz porównanie z montażami wymienionymi
w dokumencie; liczby nie zostały wybrane arbitralnie.

Dowód po zmianach: `r2-r5-po.txt`
(`sha256 fbcfd6e782062bf5c7cf7843a0207a47351a9dd3b4b69e093e6b750bf575e82d`).

## Zbiorcza lista kłamiących dokumentów i komentarzy

1. `server/migrations/README.md` — potwierdzony i poprawiony w tym dyżurze.
2. `server/migrations-archive/README.md` — potwierdzony i poprawiony.
3. `AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` — sprzeczność 4+2 / 3+3 poprawiona.
4. `runLifecycle.routes.ts` — nieaktualny stan montażu poprawiony.
5. `rolloutExtensions.routes.ts` — nowy przypadek z bounded sweep, poprawiony.
6. `finance-intelligence.routes.ts` — wcześniejszy przypadek, już opisany w
   źródle jako poprawiony 2026-08-31; użyty tylko kontrastowo.
7. `toolsInsightsWiringFlag.test.ts` — **PODEJRZENIE**, zgłoszone wcześniej w
   `ODBIOR_224_225.md`, nieweryfikowane w tym dyżurze.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano runtime ani wdrożenia; ten dyżur nie zmienia zachowania.
- Nie rozstrzygnięto losu katalogów `migrations-v2` i `migrations-archive`.
- Nie zweryfikowano pozostałych podejrzeń ze sweepu poza
  `rolloutExtensions.routes.ts`.
- Nie zweryfikowano podejrzenia `toolsInsightsWiringFlag.test.ts`.

## Korekty wobec instrukcji

- Brak korekt tez T1-T8: wszystkie potwierdziły się własnym pomiarem.
- Numery linii traktowano jako wskazówki: wiążący był wynik komend na markerze.
- Globalny marker kolejki `7a733cb63d` jest tipem zawierającym instrukcje;
  wiążąca instrukcja 254 nakazała bazę `df7f13056f`, więc zgodnie z jej regułą
  rozejścia dyżur wystartował z `df7f13056f`, a rozjazd jawnie zapisano.

## Bezpieczeństwo wysyłki

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Nie uruchomiłem
`server/src/index.ts` ani żadnego drenażu outboxu. Nie tworzono bazy ani operacji
zapisujących. Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie
zewnętrzne nie zostało wysłane.
