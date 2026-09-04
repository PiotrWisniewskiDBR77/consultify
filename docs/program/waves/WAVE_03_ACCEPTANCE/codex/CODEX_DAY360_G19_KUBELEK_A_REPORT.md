# CODEX — DYŻUR 360 — G19 kubełek A

Data: `2026-09-04`. Marker: `2a7273e087cbd3e44344725b524f6ddd79d5badc`. Gałąź: `codex/day360-g19-kubelek-a-20260904`.

## Korekty liczb i tez z instrukcji

1. Dystans `316bce9dd9..marker` wyniósł `1275 / 1064 / 329` (wszystkie / bez merge / first-parent), nie `1216 / 1015 / 315`.
2. Instrukcja nazywała Meetings `GET /api/meetings/:id`; realny mount Gateway to `GET /api/meeting/:id` (`Gateway.ts:761`).
3. Polecenie Vitest dla wymaganego testu `.mjs` wykonało 0 przypadków, bo zastany glob `tests/unit` nie obejmuje `.mjs`. Nie uznano go za pomiar; użyto `node --test` (4/4).
4. `06_EXECUTION` nie ma mountu `initiativesExecutionRuntime` w `Gateway.ts`; zastany test montuje goły router i własny authorize, więc nie spełnia Z22.
5. `11_MATERIALS` nie jest pojedynczym domykalnym przelotem: workbook ma mutację, ale deck nadal nie ma pary obcy/właściciel.

## Wejście

Dosłowny wynik markera: `MARKER OK`. Sanity worktree: `2a7273e087cbd3e44344725b524f6ddd79d5badc`, status pusty. Tip gałęzi bazowej był nowszy; pracę rozpoczęto dokładnie z markera, bez rebase/scalania. Porty 6431 i 5571 były wolne, kontener nie istniał. Początkowo `/` miał 26 GiB wolne.

DEC-392 i pełne `evidence/g19/day353/r4-orzeczenie.md` przeczytane. Zastane liczby: 106 plików dryfu, 90 bez testów, 16 wierszy NOT_PROVEN, kubełek A siedem modułów.

## R1 — bezpiecznik ważności

Nowy `scripts/dev/g19-waznosc-dowodu.mjs`: parametr `--snapshot-date`, okno 7 dni, wymagane data+SHA dla stanów twierdzących pomiar, `PASS_STALE`, podłoga 16, tabela i kod wyjścia, funkcje eksportowane.

Stan wejściowy: 16 × `NIE_DOTYCZY`, zbadanych 16, exit 0. Mutacje: 7→3650, usunięcie blokady braku metadanych i usunięcie podłogi — każda RED, każda po `cp` GREEN 4/4, diff pusty. Szczegóły: `evidence/g19/day360/r1-waznosc.md`.

## R2 — 01_ORGANIZATION

Migracje: 894, potem 0. Para workload na tym samym userId: obcy 404/64 B, właściciel 200/243 B. Mutacja prechecku organization_id: RED `expected 200 to be 404`; po przywróceniu 1/1. Wiersz: 1/49, `MIANOWNIK_OTWARTY`. Dowód: `r2-01-organization.md`.

## R3 — 08_MEETINGS

Ten sam meetingId: obcy 404/29 B, właściciel 200/640 B. Mutacja filtra `meetingService.ts:285` i osobno `canAccessMeeting` w `meeting.routes.ts:150`: obie RED `expected 200 to be 404`; po przywróceniu 1/1. Oba punkty są strażnikami. Wiersz: 1/49. Dowód: `r3-08-meetings.md`.

## R4 — pięć modułów

| Moduł | Trasa / strażnik | Para | Mutacja / wynik | Testy | Werdykt |
| --- | --- | --- | --- | ---: | --- |
| 04 | `/api/v8/assessment/:id`; SQL `id + organization_id` | 404/62 B; 200/1176 B | obcy 200, RED | 1 | podniesiony 1/30 |
| 05 | `/api/decisions/:id/detail`; porównanie `decision.organization_id` | 404/30 B; 200/684 B | pierwsza mutacja chybiła; druga dała obcy 500 zamiast 404, RED | 1 | podniesiony 1/30 |
| 06 | brak mountu w Gateway | brak | brak dozwolonej produkcyjnej ścieżki | 0 | kubełek A przypisany błędnie; brak mountu + pary |
| 11 | workbook command + deck autosave | workbook zastany; deck bez obcego | workbook RED 409 zamiast 403/404 | 4 baseline, 2 mutation | kubełek A przypisany błędnie jako jeden przelot; brak pary decka |
| 13 | `/api/conversations/:id`; `findAccessibleConversation` | 404/54 B; 200/1133 B | obcy 200, RED | 1 | podniesiony 1/30 |

Szczegóły per moduł: `evidence/g19/day360/r4-*.md`. Briefy 06 i 11 pozostają czerwone.

## R5 — wiersze i pięć pól

Podniesione wiersze: **5**. Dowody w tych samych commitach: **5**. Każdy zawiera data, SHA, mianownik ze źródłem, pełną nazwę i ścieżkę artefaktu. Wiersze 06 i 11: bez zmiany. Bezpiecznik końcowy: 16 zbadanych, 5 WAZNY, 11 NIE_DOTYCZY, zero BRAK_DATY, exit 0. Żaden stan nie zawiera `PASS`.

Commity macierzy z dowodem: `7500202ac3`, `f214368883`, `df212f026b`, `6db65cc2d5`, `3aa5141aa6`; każdy `git show --stat` zawiera właściwy MODULE_ACCEPTANCE, test i dowód.

## Pytanie o mianownik

Czy obowiązuje historyczny mianownik per moduł (`28/30/49` wg inwentarza), czy wspólny bieżący zbiór 106? Historyczny jest domykalny per moduł, lecz nie obejmuje późniejszego dryfu; bieżący wymaga ponownego przypisania i odświeżania 106 plików przy markerze. Do decyzji nie nadpisano żadnej liczby.

## Pomiar nazw testów

Własny zbiór bazowy: 7 pełnych nazw; po: 12. Dodano pięć nazw day360, znikniętych zero. Pliki i SHA256: `przed-nazwy.txt` `5cc4daa0…`, `po-nazwy.txt` `b4f28264…`, diff `e8427f41…` w `/private/tmp/cx-day360-g19-kubelek-a-artefakty`. Granica: nie był to pełny korpus repo, tylko wszystkie pakiety uruchomione przez ten dyżur; nie przedstawiam go jako pełnego regresyjnego denominatora.

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Końcowe bramki i sprzątanie

Słowniki: pl 35199, en 33066 — identyczne. `focus=0`, `list=0`, `artefakt=0`, `reach=0`, `waznosc=0`. Diff `server/src/` i `src/` pusty; kubełek C nietknięty. Kontener `cx-day360-pg` usunięty przez `docker rm -fv`. Bezpośrednio przed i po usunięciu `/` miał 6.3 GiB wolne; ponowny końcowy odczyt przed commitem pokazał 6.2 GiB (nadal powyżej progu 5 GiB). Spadek z początkowych 26 GiB nastąpił podczas materializacji worktree i jest jawnie raportowany.

## Niewykonane

- 06: brak mountu runtime-v1 w realnym ApiGateway, więc brak kwalifikowanej pary i mutacji.
- 11: brak pary deck obcy/właściciel i mutacji jego strażnika; wykonano tylko workbook.
- Nie podniesiono tych dwóch wierszy i nie osłabiono briefów.
