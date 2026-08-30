# CODEX DAY 183 — KALENDARZ ON — RAPORT STOP

Data: 2026-08-30  
Gałąź: `codex/day183-kalendarz-on-20260830`  
Baza: marker `18661cc6a0`  
Werdykt dyżuru: **STOP CAŁEGO DYŻURU — mniej niż 5 GiB wolnego miejsca po pełnych migracjach**.

## Korekty wobec instrukcji

1. Decyzją nadzorcy po zasadnym STOP-ie portu `5037` zasoby runtime zmieniono z `5036/5037` na `5046/5047`. Portu `5037` zajętego przez Android Debug Bridge nie zatrzymano.
2. Instrukcja odwołuje się do `§0.4a` i `BLOKU 0`, ale wydany plik nie zawiera nagłówka ani treści `§0.4a`. Zgodnie z regułą bezpieczniejszej interpretacji wykonano jawnie dostępne T1–T6; brakującej sekcji nie rekonstruowano z domysłu.

## Wejście i marker — wyniki dosłowne

```text
MARKER OK
```

```text
18661cc6a007769dd419060ff3089860f1163afc
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip `github-backup/codex/m03-admin-20260824` był przed markerem o nowsze commity; zgodnie z DEC-2026-08-26-95 worktree powstał dokładnie z markera. Zakres rozejścia został zmierzony komendami wymaganymi w §0.1; scalenie pozostaje po stronie nadzorcy.

## HISTORIA FLAGI — R1

- Dodanie default OFF: `ae8bb727d494deed07af7d03e4e644d36700e56b`, `2026-08-25 10:55:41 +0200`.
- Flip default ON: `b5cd84d6635f941efe045733b4bdd958aced8b44`, `2026-08-25 15:57:46 +0200`.
- Revert: `97a55adff1b228cb3e600aaf42634910c287daaa`, `2026-08-25 17:33:07 +0200`.
- Merge rewertu `3e2a3f1c62ae018db1b5d4f71c6d18f8aff0550e` ma komunikat: `revert: My Work flag defaults back to OFF (runbook cofania — P0 parity regressions found by skeptic)` i obejmuje sześć plików związanych z dwiema flagami.
- Diff `97a55adff1` dla kalendarza cofa wyłącznie komentarz `CalendarV2`, komentarz decyzji i wartość domyślną `true -> false`; nie zmienia logiki `CalendarView` ani `CalendarV2`.
- `ea3174c7fc8d02d1273dd00669796a8ebf5fd39a` dokumentuje konkretny `TypeError` po włączeniu `ff_ideaInspectorRightRail`: brak mocka `Api.getMyIdeaConversions` w `IdeaMapWorkspace.preferredTool-regression.test.tsx`.
- Przegląd historii i ścieżek kalendarza nie znalazł analogicznego P0 przypisanego `CalendarV2`/`CalendarView`.
- DEC-68: inspektor `OWNER_CHANGE`; DEC-69: szyna Notatnika `OWNER_CHANGE`; DEC-70: `Sejf CHANGE, Kalendarz ACCEPT`; DEC-71 utrzymuje ACCEPT m.in. dla `Kalendarza V2`.
- `CalendarView.tsx` ma osobne toasty dla `409`, `403`, `404` i fallbacku; `MyWorkHub.tsx` zawsze renderuje `CalendarV2` albo `CalendarView`.

**Werdykt R1:** udokumentowana przyczyna techniczna rewertu dotyczy `ff_ideaInspectorRightRail`, nie kalendarza. R1 dawał zielone światło do R2, lecz R2 został zabroniony przez późniejszy bezwzględny STOP dyskowy.

## Migracje i Z30

- Wyłączny lokalny kontener: `cx-day183-pg`, `127.0.0.1:6092`, baza `consultify_w3_my_work_owner_cx183`, obraz `pgvector/pgvector:pg16`.
- Pierwszy przebieg migracji: `Applying migrations: 870`, następnie `Postgres migrations complete`.
- Drugi przebieg: `Applying migrations: 0`, następnie `Postgres migrations complete`.
- Tabela `settings`: zapytanie `WHERE key LIKE 'smtp%'` zwróciło `(0 rows)`.
- `server/src/Gateway.ts` nie zawiera trafień dla drenów wymienionych w §0.2b.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Artefakty poza repo:

- `/private/tmp/cx-day183-kalendarz-on-artefakty/migrate-first.log` — SHA-256 `2df66f01900579df451846cdf6c663982f8a0f4791a8c87dc3f48f8491ef34f3`
- `/private/tmp/cx-day183-kalendarz-on-artefakty/migrate-second.log` — SHA-256 `e851ceba0c2ab6c31d6b7b010cff3a5a668e8218359febc361d4488583de408e`

## STOP — cały dyżur po migracjach

Rodzaj: **MERYTORYCZNY / bezwzględny warunek środowiskowy z §0.5**  
Powód: po pełnych migracjach `df -h /` wykazał `3.9Gi` wolnego miejsca, poniżej wymaganego minimum 5 GiB.  
Licencja, którą sprawdziłem: §0.1 krok (0) i §0.5 pkt 4: mniej niż 5 GB wolnego dysku zatrzymuje cały dyżur.  
Dowód: `df -h /` po migracjach: `/dev/disk3s1s1 1.8Ti 12Gi 3.9Gi 76%`.  
Co dostarczyłem ZAMIAST zmiany: kompletny R1, dwa przebiegi migracji z idempotencją, dowód Z30 i ten raport; żadnego flipu ani testu nie uruchomiono.  
Co zrobiłbym, gdyby zwolniono bezpiecznie miejsce: ponownie sprawdziłbym próg 5 GiB i porty, odtworzył lokalną bazę, wykonał R2 dokładnie wzorem `b5cd84d663`, pełny retest i zrzuty na `5046/5047`.  
Rekomendacja dla nadzorcy: zwolnić miejsce poza chronionymi checkoutami/worktree i wznowić dyżur dopiero po potwierdzeniu co najmniej 5 GiB.  
Stan: raport zacommitowano na gałęzi dyżuru; zmiany produktowej brak.  
Czy kontynuowałem pozostałe pozycje: **NIE**, ponieważ §0.5 nakazuje zatrzymać cały dyżur.

## Zasięg zmian

Jedyny plik repozytorium dotknięty przez dyżur to ten raport. Nie zmieniono flagi, testów, `CalendarV2`, `CalendarView`, Radaru ani `ff_ideaInspectorRightRail`.

## TWIERDZENIA NIEZWERYFIKOWANE

- R1 statycznie i historycznie wskazuje, że P0 dotyczył wyłącznie `ff_ideaInspectorRightRail`; nie wykonano funkcjonalnego retestu kalendarza po flipie, ponieważ nastąpił STOP dyskowy.
- Nie zweryfikowano na żywym runtime, czy `includeOwnEvents` realnie zmienia wyświetlaną treść.
- Nie zweryfikowano na żywym Postgresie toastów reschedule dla `409/403/404/500`; potwierdzono jedynie obecność rozgałęzień w kodzie.
- Nie wykonano tworzenia wydarzenia, reschedule ani readbacku przez realny `ApiGateway`/JWT.
- Nie wykonano zrzutów jasnych/ciemnych ani stanów pusty/pełny.
- Nie wykonano pakietów Vitest ani porównania `fullName`, więc nie istnieje wynik PASS/FAIL do raportowania.
