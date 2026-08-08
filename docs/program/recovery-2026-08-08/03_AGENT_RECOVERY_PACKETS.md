# Consultify — pakiety recovery dla agentów

Każdy agent przed rozpoczęciem musi przeczytać:

1. `00_START_HERE.md`
2. `01_CLEANUP_AND_RESUME_PLAN.md`
3. `02_EXECUTION_REGISTER.md`
4. `FILE_OWNERSHIP_MATRIX.tsv`

## Pakiet A — Agent V8

**Worktree:** `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/agent-v8`  
**Branch:** `codex/recovery-agent-v8-20260808`  
**Baseline:** `3b0c337ee472d07122033d5339cdf3bdb2f254ee`  
**Źródła:** `origin/codex/agent-v8-rc-20260808`, snapshot `consultify-agent-t01-i01`  
**Dozwolony owner w macierzy:** `AGENT_V8`

Zadanie:

1. Porównaj wersję committed V8 z lokalnym snapshotem Agent T01.
2. Dla każdego pliku `AGENT_V8` wybierz nowszą semantycznie wersję i zapisz uzasadnienie, jeżeli źródła się różnią.
3. Nie przenoś plików `SHARED_FILE_INTEGRATOR`, evidence ani governance.
4. Uruchom testy właściwe dla odtworzonego zakresu, ale nie rozszerzaj funkcjonalności.
5. Nie wdrażaj i nie zmieniaj bazy.

Koniec: `READY_FOR_CODEX_REVIEW` z pełnym diffem i wynikami testów.

## Pakiet B — Documents

**Worktree:** `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/documents`  
**Branch:** `codex/recovery-documents-20260808`  
**Baseline:** `3b0c337ee472d07122033d5339cdf3bdb2f254ee`  
**Źródła:** `origin/codex/agent-documents-final-20260808`, `origin/codex/documents-suite-v2-resume-20260807`, snapshot brudnego Documents worktree  
**Dozwolony owner w macierzy:** `DOCUMENTS`

Zadanie:

1. Odtwórz tylko 255 plików przypisanych do Documents.
2. Nie przenoś 304 plików oznaczonych `DOCUMENTS_INHERITS_V8_DO_NOT_DUPLICATE`.
3. Porównaj final branch z lokalnym snapshotem i wskaż konflikty wersji.
4. Nie dotykaj 30 plików integratora.
5. TypeScript ma działać fail-hard; build kontynuowany po błędach nie jest PASS.
6. Nie wdrażaj i nie zmieniaj bazy.

Koniec: `READY_FOR_CODEX_REVIEW` z listą wykluczonych plików V8 i dokładnymi wynikami testów.

## Pakiet C — Report B / UI

**Worktree:** `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/report-b-ui`  
**Branch:** `codex/recovery-report-b-ui-20260808`  
**Baseline:** `3b0c337ee472d07122033d5339cdf3bdb2f254ee`  
**Źródła:** `codex/ui45-candidate-2026-08-08`, snapshot głównego checkoutu, CB-01, CB-03 i CB-05  
**Dozwolony owner w macierzy:** `REPORT_B_UI`

Zadanie:

1. Odtwórz wyłącznie 400 plików przypisanych do Report B / UI.
2. Nie merge'uj gałęzi UI45, ponieważ jej genealogia jest 577 commitów za `origin/demo`.
3. Przenoś zmiany selektywnie na aktualny baseline.
4. Evidence i screenshots zachowaj poza commitem implementacyjnym.
5. Nie dotykaj 30 plików integratora.
6. Nie wdrażaj i nie zmieniaj bazy.

Koniec: `READY_FOR_CODEX_REVIEW` z mapą CB-01/CB-03/CB-05/UI45 → odtworzone pliki.

## Pakiet D — shared-file integrator

Ten pakiet pozostaje `PAUSED`. Można go uruchomić dopiero po niezależnym odbiorze pakietów A–C.

Integrator jest jedynym agentem uprawnionym do 30 plików oznaczonych `SHARED_FILE_INTEGRATOR`. Nie wybiera automatycznie „najnowszej” wersji. Dla każdego pliku przygotowuje porównanie intencji V8, Documents oraz UI i integruje zaakceptowane zachowania wraz z testami regresji.

## Zakaz wspólny

Żaden z pakietów A–C nie posiada uprawnienia do:

- merge;
- push;
- deploy;
- migracji lub modyfikacji danych;
- usuwania starych worktree;
- czyszczenia głównego checkoutu;
- zmiany kanonicznych statusów programu.
