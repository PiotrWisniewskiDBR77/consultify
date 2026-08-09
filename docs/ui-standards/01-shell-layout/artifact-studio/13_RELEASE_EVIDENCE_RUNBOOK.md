# Artifact Studio — Release Evidence Runbook

Status: `EXECUTABLE / FAIL-CLOSED`

Ten pakiet obsługuje cztery dowody, których nie można zastąpić kodem ani
deklaracją implementatora: transfer użytkowników, ręczny screen reader, Teresa
na realnym providerze oraz dwa stabilne okna telemetryczne. Stan źródłowy jest w
`release-evidence.json`, a walidator w
`scripts/testing/artifact-studio-release-evidence-gate.mjs`.

## 1. Uruchomienie

Walidacja struktury i uczciwości bieżącego stanu:

```bash
node scripts/testing/artifact-studio-release-evidence-gate.mjs
```

Terminalny release gate — obecnie ma zakończyć się kodem `1`, dopóki dowody są
niekompletne:

```bash
node scripts/testing/artifact-studio-release-evidence-gate.mjs --require-complete
```

Kod `2` oznacza wadliwy lub sprzeczny manifest. Kod `1` oznacza poprawny
manifest, ale niezamknięty program. Kod `0` z `--require-complete` jest możliwy
wyłącznie po przejściu wszystkich prób i osobnym usunięciu legacy.

## 2. Test transferu DOC/PPT/XLSX

- Minimum trzech uczestników znających przynajmniej jeden produkt Office.
- Rotacja pierwszego formatu; każdy wykonuje te same zadania w DOC, PPT i XLSX.
- Zapisać każde zadanie, kolejność formatu, wynik bez pomocy, czas i błędne
  kliknięcia. Surowe wyniki pozostają załącznikiem, nie samym podsumowaniem.
- PASS: minimum 85% zadań bez pomocy w drugim i trzecim formacie, minimum 25%
  poprawy mediany czasu odnalezienia wspólnej funkcji oraz minimum 90%
  poprawnego rozróżnienia save, QA, review, approval i export.
- Obowiązkowo sprawdzić globalną Teresę, Undo oraz brak szukania lokalnego chatu.

## 3. Ręczny VoiceOver

Wykonać na DOC, PPT i XLSX na dokładnym kandydacie. Dla każdego formatu zapisać
testera, macOS, wersję VoiceOver, środowisko i referencję do nagrania/logu.

Minimalna ścieżka: Menu 2 → Menu 3 → lewy panel → canvas → bottom bar → Teresa,
Shift+F10, zamknięcie Esc i powrót focusu. Osobno wywołać i potwierdzić
niehałaśliwe ogłoszenie: save, error, QA oraz async job.

Automatyczny test landmarków jest już dowodem pomocniczym, ale nie zastępuje
tego smoke testu.

## 4. Teresa na realnym providerze

Istniejące testy live wymagają prawdziwego klucza providera i realDB, np.:

```bash
ANTHROPIC_API_KEY=... ENABLE_DELIVERABLES_LIGHT=true \
  npx vitest run tests/acceptance/teresa-live-toolcall.e2e.test.ts
```

Dla Artifact Studio wymagany jest dodatkowo jeden scenariusz dla każdego
formatu: jawne zaznaczenie → chip kontekstu → realna odpowiedź providera → diff
→ jawne Accept/Reject → audit → Undo. Manifest przechowuje request ID, model,
SHA, artifact/version ID i referencje do dowodów; nie przechowuje sekretów.

## 5. Dwa stabilne okna i telemetry

Każde okno zapisuje: SHA, środowisko, cohort/flag state, czas początku i końca,
open success, save error/conflict, export success, Teresa attach/apply, client
exceptions, liczbę wywołań legacy route oraz użycie rollbacku. Surowy dashboard
lub eksport metryk musi być trwałym załącznikiem.

Minimalne progi dla każdego okna: open success co najmniej 99%, export success
co najmniej 98%, save error najwyżej 1%, client exception najwyżej 0,5%, zero
wywołań legacy i zero użyć rollbacku. Przedziały czasu muszą być poprawnymi,
niepustymi interwałami ISO-8601, a oba okna muszą wskazywać ten sam SHA.

Okno nie jest stabilne, jeżeli użyto rollbacku, brak któregokolwiek wskaźnika
albo pojawił się ruch do legacy. Dwa okna muszą należeć do tej samej linii
kandydata; zmiana materialna resetuje obserwację.

## 6. Legacy removal

Legacy pozostaje izolowane do czasu czterech wcześniejszych PASS. Usunięcie jest
osobnym pakietem z exact changed-files manifest, route/import scan, testami,
runtime proof i rollback planem. Nie wolno połączyć go z poprawką funkcjonalną.

Po zebraniu dowodów reviewer zmienia statusy na `verified`, dodaje wszystkie
wymagane pola i uruchamia oba gate'y:

```bash
node scripts/testing/artifact-studio-release-evidence-gate.mjs --require-complete
node scripts/testing/artifact-studio-program-gate.mjs --require-complete
```

Oba muszą przejść na tym samym aktualnym SHA. Zielony pierwszy gate bez
aktualizacji kanonicznego `program-gates.json` nie kończy programu.
