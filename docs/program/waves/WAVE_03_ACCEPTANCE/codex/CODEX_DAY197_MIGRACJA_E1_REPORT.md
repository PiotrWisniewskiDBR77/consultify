# CODEX DAY197 — MIGRACJA LEGACY TASKS → KANON, ETAP 1

Status: R1 wykonany częściowo i zacommitowany przed R2. R2/R3: w toku.

## Baza, marker i zasoby

```text
MARKER OK
60581ed6b5054e3218f7bc33d6e2a32794fb2af8
git status --short: pusty
```

Marker jest przodkiem nowszego tipa `github-backup/codex/m03-admin-20260824`;
zgodnie z DEC-2026-08-26-95 praca wystartowała dokładnie z markera. Porty
6128, 5066 i 5067: 3/3 wolne przed startem. Dysk: 20 GiB wolne.

## R1 — denominator A4.0

M1, fresh-DB po 870 migracjach i `case-workspace-seed-local.mjs`:
`active_execution_cases=0`, `legacy_initiatives_with_tasks=0`. Replay migracji:
`Applying migrations: 0`. Seed dołożył 1 projekt, 8 włączonych flag i 0 tasks;
fresh migracje zawierały już dane bazowe, dlatego globalne liczniki po seedzie
wyniosły 2 organizations, 2 users i 2 ACTIVE members, a nie oczekiwane 1/1/1.

M2, druga fresh-DB po 870 migracjach: **EVIDENCE_MISSING**. Polecony
`npm run db:seed:demo:contract` zatrzymał się przed utworzeniem zadań na
`initiatives_status_check`, próbując wstawić status `completed`. Odczyt po
błędzie: `active_execution_cases=0`, `legacy_initiatives_with_tasks=0`,
`tasks total=0`. Nie zastąpiłem tego syntetycznym INSERT-em ani zmianą seeda,
bo seed jest tylko do odczytu w licencji.

M3: **NIE ZMIERZONO**. Z28 zakazuje połączenia do demo/staging/produkcji.
Paczka read-only dla nadzorcy lub właściciela:
`/private/tmp/cx-day197-migracja-e1-artefakty/day197-denominator.sql`; ma zostać
uruchomiona na bazie demo/staging procedurą `consultify-promocja-demo`.

## KARTA DECYZYJNA D-7 / ETAP 1 — DLA WŁAŚCICIELA

1. **Liczby lokalne.** M1: 0 aktywnych spraw / 0 inicjatyw z zadaniami,
   odtwarzalne przez fresh migracje, seed Case Workspace i dwa SELECT-y A4.0.
   M2: brak wiarygodnej liczby — seed produktowego kształtu kończy się błędem
   constraintu przed utworzeniem zadań; po błędzie baza ma 0 / 0.
2. **Liczba realna.** Nie zmierzono danych demo/staging, ponieważ Z28 zabrania
   takiego połączenia. Gotowe zapytania są w
   `/private/tmp/cx-day197-migracja-e1-artefakty/day197-denominator.sql`.
3. **Koszt jednego domu.** Do uzupełnienia po R2: pięć poleceń budowy domu plus
   jedno polecenie utworzenia zadania; czas i realne wiersze/tabele są jeszcze
   `NOT_MEASURED`, nie zostały przepisane z instrukcji.
4. **Warianty skali.** (i) wszystkie inicjatywy z zadaniami: koszt co najmniej
   5 transakcji na inicjatywę + 1 na zadanie, pełny skutek migracyjny;
   (ii) tylko kwalifikowalny zakres MVP: ten sam koszt jednostkowy, mniejszy
   denominator i jawne pominięcia; (iii) odłożyć etap 2 do pomiaru M3: zero
   zapisu teraz, brak ryzyka skali. Rekomendacja: wariant (iii), a po M3 wariant
   (ii), jeśli właściciel zaakceptuje utratę historii i pola bez mapowania.
5. **Rekomendacja.** Nie uruchamiać etapu 2 przed realnym M3: obecne wiarygodne
   dane nie zawierają dodatniego denominatora, a M2 jest zablokowane błędem.
   Przed etapem 2 właściciel musi też zatwierdzić istniejące konto systemowe;
   pilot R2 użyje OWNER-a wyłącznie jako aktora pilotażowego, NIE systemowego.
6. **Brak decyzji.** Bez decyzji właściciela etap 2 nie rusza; brama 409 zostaje.

## Korekty wobec instrukcji

- T1: literalny grep z instrukcji dał 0, ponieważ nazwa typu i wywołanie są na
  różnych liniach; odczyt kodu nadal pokazuje genezę w `handoffAcceptance.ts`.
- T8/naming: walidator raportuje 92 zastane problemy w 1087 plikach, nie 20.
- M1: globalne 1/1/1 nie potwierdziło się z powodu danych po migracjach.
- M2: seed nie jest zgodny z aktualnym constraintem statusu inicjatywy.

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- Realny denominator M3 nie został zmierzony z powodu Z28.
- Liczba tabel zapisywanych w jednej transakcji nie została jeszcze zmierzona.
- Zmieniony `correlationId`, kolizja relacji z nowym `clientRequestId`, realny
  readback `dueAt` oraz forward repair czekają na R2.
- Aktor pilotażowy nie jest kontem systemowym; konto systemowe wymaga decyzji.
- Test day160 nie został w tym dyżurze ponownie sprawdzony ani zmieniony.
