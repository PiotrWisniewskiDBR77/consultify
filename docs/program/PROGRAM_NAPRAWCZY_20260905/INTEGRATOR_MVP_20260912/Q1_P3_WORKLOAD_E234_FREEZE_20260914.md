# Q1 P3 Obciążenie — E2–E4 freeze R2 (2026-09-14)

**Werdykt autora: READY FOR INDEPENDENT EXACT-SHA REREVIEW.** Dwa blokery P1 i doprecyzowanie P2 z review `b29c6b679f334ec44f67859fa10a330345eefaf8` są zamknięte bez migracji oraz bez rozszerzenia zakresu.

## Zamknięcie HOLD

- **P1 — prawdziwe akcje:** usunięto oba `onOpenFull={() => undefined}`. Podgląd osoby i efemerycznej propozycji planistycznej nie ma osobnego, kanonicznego obiektu docelowego, więc nagłówek uczciwie nie pokazuje aktywnego `Open`. Nie dodano fikcyjnej nawigacji.
- **P1 — exact manifest:** finalny commit freeze dodaje samowyłączający się manifest `Q1_P3_WORKLOAD_E234_FREEZE_MANIFEST.json`. Manifest wiąże wszystkie pozostałe ścieżki delty względem bazy z rozmiarem i SHA-256 bloba oraz podaje content SHA i sumę evidence.
- **P2 — jednoznaczny status:** pigułka propozycji pokazuje `Initiative status: Approved` / `Status inicjatywy: Zatwierdzona`, więc nie wygląda jak zatwierdzenie samej propozycji.

## Zachowanie E2–E4

- **E2 — dostępność:** zalogowany użytkownik edytuje własne godziny tygodniowe i procent dostępności przez istniejący profil `users.weekly_capacity_hours` / `users.availability_percent`.
- **E3 — raport obciążenia:** adapter `WORKLOAD_CAPACITY` korzysta ze wspólnego silnika P1 `reportDefinition` / `reportRun`; przebieg dostaje zamrożony snapshot planu zasobów.
- **E4 — propozycje:** odczyt wyłącznie dla kanonicznych etapów planowania `DRAFT`, `PENDING_APPROVAL`, `APPROVED`; odpowiedź ma `planningOnly: true` i `applied: false`. RealPG dowodzi wykluczenia `IN_EXECUTION` i braku mutacji przydziału.
- Flagi `VITE_INITIATIVES_WORKLOAD`, `ENABLE_INITIATIVES_WORKLOAD`, `VITE_INITIATIVES_WORK_REPORT` i `ENABLE_INITIATIVES_WORK_REPORT` pozostają strict opt-in/default OFF.

## Bramka R2

- Wszystkie 4 pliki testowe delty uruchomione osobno z `--retry=0`: **13/13 PASS**.
- Test komponentu dowodzi braku aktywnego `Open` dla obu preview oraz etykiety `Initiative status: Approved`: **7/7 PASS**.
- RealPG18 na `127.0.0.1:5291` przez ApiGateway + signed JWT + PostgreSQL: **2/2 PASS**.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc -p server/tsconfig.json --noEmit --pretty false`: **exit 0**.
- Esbuild per każdy plik TS/TSX delty: **15/15 PASS**. Dla wspólnego rejestru dev-render wyłączono z bundla dwa odziedziczone, brakujące lazy-importy poza Q1; sam wpis i ekran Q1 zostały zbudowane.
- Detektor zduplikowanych kluczy JSON: EN **0**, PL **0**. `git diff --check`: **PASS**.

## Dowód UI R2

Po zmianie wizualnej odświeżono siedem zrzutów pełnego `InitiativesHub` w `evidence/q1-p3-workload/e234-*`:

- propozycje: EN light/dark + PL light/dark;
- dostępność: EN light/dark + PL light;
- każdy przebieg ma pustą tablicę błędów przeglądarki;
- zrzuty pokazują brak fałszywego `Open`, jednoznaczny status inicjatywy, StandardModuleBar, standardowe dropdowny, StandardTable, StandardPreview i row kebab.

Evidence całego katalogu pakietu ma 810 464 B, a odświeżona macierz E2–E4 630 717 B; oba wyniki są poniżej 2 MiB.

## Granice

Brak migracji, deployu, zmian Railway i pushy na chronione gałęzie. Autor zatrzymuje pakiet po commicie freeze. Exact content SHA i końcowy freeze SHA są publikowane w manifeście, backupie i meldunku `OD_CODEXA.md`.
