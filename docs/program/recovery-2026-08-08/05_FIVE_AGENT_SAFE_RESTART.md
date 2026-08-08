# Consultify — bezpieczny restart pięciu agentów

## Decyzja CTO

Stare rozmowy i stare worktree są źródłami odzyskiwania, a nie miejscem dalszej pracy. Każdy nowy agent otrzymuje osobny worktree, osobny branch i osobną bramkę zakresu. Agent nie wykonuje merge, deployu ani zmian danych. Kod przechodzi do integracji dopiero po niezależnym przeglądzie Codex.

Snapshot zatrzymania:

`/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-snapshots/2026-08-08_181821_five-agent-stop`

Wspólne zasady dla wszystkich pięciu agentów:

1. Pracuj wyłącznie w podanym worktree i branchu.
2. Przed pierwszą edycją przeczytaj komplet dokumentów `00`–`05` w tym katalogu.
3. Stare worktree, snapshoty i gałęzie są tylko do odczytu.
4. Nie używaj `reset`, `clean`, `stash`, `rebase`, merge ani masowego kopiowania katalogów.
5. Nie zmieniaj Railway, demo, staging, produkcji ani bazy danych.
6. Nie akceptuj testu, który nie wystartował lub działał na innym SHA.
7. Co najwyżej jeden logiczny temat na commit.
8. Przed każdym commitem uruchom `validate`; zakończ przez `checkpoint` i `handoff`.
9. Plik odrzucony przez gate zgłoś jako `BLOCKED_SCOPE`; nie omijaj zabezpieczenia.
10. Koniec pracy wymaga czystego worktree i identycznego SHA lokalnie oraz na GitHubie.

## Prompt 1 — Agent V8

```text
Jesteś nowym agentem odpowiedzialnym wyłącznie za dokończenie Consultify Agent V8.

WORKTREE: /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/agent-v8
BRANCH: codex/recovery-agent-v8-20260808
TRACK: v8

Najpierw potwierdź pwd, branch, HEAD i czystość worktree. Przeczytaj komplet docs/program/recovery-2026-08-08/00_START_HERE.md do 05_FIVE_AGENT_SAFE_RESTART.md, FILE_OWNERSHIP_MATRIX.tsv oraz 03_AGENT_RECOVERY_PACKETS.md.

Źródła analizuj tylko odczytowo: origin/codex/agent-documents-final-20260808 do 49035b99, lokalny bc164861 tylko jeśli dotyczy V8, stary worktree consultify-agent-t01-i01 i snapshot zatrzymania. Odtwórz wyłącznie pliki należące do AGENT_V8. Nie przenoś Documents, Finance, UX, evidence, governance ani SHARED_FILE_INTEGRATOR. Nie merge'uj starej gałęzi; wybieraj pojedyncze zmiany semantycznie i zachowuj ich pochodzenie.

Zweryfikuj realne zachowanie: aktywację tenantów, wiązanie projektu, governed execution i materializację zatwierdzonych etapów. Uruchom testy celowane oraz wymagane kontrole TypeScript. Zapisz dokładne polecenia i wyniki.

Przed checkpointem: tools/agent-delivery/agent-delivery.sh validate v8
Commit: tools/agent-delivery/agent-delivery.sh checkpoint v8 "fix(v8): reconstruct governed agent completion"
Koniec: tools/agent-delivery/agent-delivery.sh handoff v8

Nie wykonuj merge, PR, deployu ani zmian bazy. Zakończ raportem READY_FOR_CODEX_REVIEW zawierającym SHA, listę plików, testy, odzyskane źródła, pominięte konflikty i ryzyka.
```

## Prompt 2 — Dokumenty

```text
Jesteś nowym agentem odpowiedzialnym wyłącznie za dokończenie pakietu Documents i Presentations.

WORKTREE: /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/documents
BRANCH: codex/recovery-documents-20260808
TRACK: documents

Najpierw potwierdź pwd, branch, HEAD i czystość worktree. Przeczytaj komplet dokumentów recovery 00–05, FILE_OWNERSHIP_MATRIX.tsv i pakiet Documents w 03_AGENT_RECOVERY_PACKETS.md.

Źródła tylko do odczytu: origin/codex/documents-suite-v2-resume-20260807@f2718857, origin/codex/agent-documents-final-20260808@49035b99, lokalny commit bc164861 oraz brudny stary worktree Documents zapisany w snapshocie. Odtwórz wyłącznie owner DOCUMENTS. Nie kopiuj 304 plików V8, Finance, UX, evidence ani 30 plików integratora. Nie merge'uj całych gałęzi.

Dokończ i zweryfikuj zapis/odczyt dokumentów oraz prezentacji, szczególnie media tags i wybór tła z biblioteki. Testy round-trip oraz TypeScript muszą faktycznie wystartować; build kontynuowany po błędzie nie jest PASS.

Przed checkpointem: tools/agent-delivery/agent-delivery.sh validate documents
Commit: tools/agent-delivery/agent-delivery.sh checkpoint documents "fix(documents): reconstruct document and presentation completion"
Koniec: tools/agent-delivery/agent-delivery.sh handoff documents

Nie wykonuj merge, PR, deployu ani zmian bazy. Zakończ READY_FOR_CODEX_REVIEW z SHA, listą odzyskanych commitów, plikami wykluczonymi jako V8/shared, pełnymi testami i ryzykami.
```

## Prompt 3 — Finanse

```text
Jesteś nowym agentem odpowiedzialnym wyłącznie za dokończenie Consultify Finance.

WORKTREE: /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/finance
BRANCH: codex/recovery-finance-20260808
TRACK: finance
DOZWOLONY ZAKRES: docs/program/recovery-2026-08-08/track-scopes/finance.txt

Najpierw potwierdź pwd, branch, HEAD i czystość worktree. Przeczytaj dokumenty recovery 00–05 oraz całą listę dozwolonego zakresu. Każdy plik spoza tej listy wymaga zatrzymania i statusu BLOCKED_SCOPE.

Źródła tylko do odczytu: commity 07f444f8, 723b3080, 1676900f i lokalny eb60c730 oraz snapshot starego worktree consultify-finance-recovery-20260807. Nie kopiuj wygenerowanych workbooków, dumpów bazy, screenshotów ani całych katalogów evidence. Nie merge'uj źródłowych gałęzi.

Odtwórz właściwe poprawki tabel Finance, normalizacji sensitivity i jednostek pieniężnych. Sprawdź kontrakty backendu, obliczenia, formatowanie UI i brak silent-zero. Testy muszą być powiązane z bieżącym SHA.

Przed checkpointem: tools/agent-delivery/agent-delivery.sh validate finance
Commit: tools/agent-delivery/agent-delivery.sh checkpoint finance "fix(finance): reconstruct finance completion"
Koniec: tools/agent-delivery/agent-delivery.sh handoff finance

Nie wykonuj merge, PR, deployu ani zmian bazy. Zakończ READY_FOR_CODEX_REVIEW z SHA, testami, pochodzeniem każdej odzyskanej zmiany i listą dowodów pozostawionych w kwarantannie.
```

## Prompt 4 — UX tabeli

```text
Jesteś nowym agentem odpowiedzialnym wyłącznie za UX tabeli i powierzchnie Report B przypisane do tego toru.

WORKTREE: /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/ux-table
BRANCH: codex/recovery-ux-table-20260808
TRACK: ux-table
DOZWOLONY ZAKRES: docs/program/recovery-2026-08-08/track-scopes/ux-table.txt

Najpierw potwierdź pwd, branch, HEAD i czystość worktree. Przeczytaj dokumenty recovery 00–05 oraz całą listę dozwolonych plików. Nie wolno edytować niczego spoza tej listy.

Źródła tylko do odczytu: stare worktree CB-01 accessibility, CB-03 availability i CB-05 spatial command oraz odpowiadające im snapshoty. Nie merge'uj tych gałęzi. Odtwarzaj selektywnie tylko potwierdzone zachowania tabel: dostępność, stany danych, układ przestrzenny, interakcje i regresje. Nie przenoś screenshotów ani evidence do commita implementacyjnego.

Wymagaj czytelnych stanów loading/empty/error/data, semantycznych celów dotykowych, poprawnej klawiatury i braku ukrywania danych. Zweryfikuj testami komponentowymi i celowanym renderem, ale nie uznawaj renderu za runtime acceptance.

Przed checkpointem: tools/agent-delivery/agent-delivery.sh validate ux-table
Commit: tools/agent-delivery/agent-delivery.sh checkpoint ux-table "fix(ux-table): reconstruct governed table experience"
Koniec: tools/agent-delivery/agent-delivery.sh handoff ux-table

Nie wykonuj merge, PR ani deployu. Zakończ READY_FOR_CODEX_REVIEW z SHA, mapą źródło→plik, testami i otwartymi konfliktami.
```

## Prompt 5 — UX narzędzi

```text
Jesteś nowym agentem odpowiedzialnym wyłącznie za UX narzędzi i pięć powierzchni Assessment.

WORKTREE: /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/ux-tools
BRANCH: codex/recovery-ux-tools-20260808
TRACK: ux-tools
DOZWOLONY ZAKRES: docs/program/recovery-2026-08-08/track-scopes/ux-tools.txt

Najpierw potwierdź pwd, branch, HEAD i czystość worktree. Przeczytaj dokumenty recovery 00–05 i pełną listę sześciu dozwolonych plików. Jakakolwiek potrzeba zmiany poza listą oznacza BLOCKED_SCOPE.

Źródła tylko do odczytu: origin/codex/ui45-dev-render-followup-2026-08-08@da6e409e, commity 16d972a242 i 859abe0980 oraz snapshot starego ui45-followup. Nie merge'uj całej gałęzi. Odtwórz ekran QA pięciu powierzchni i poprawne liczenie wyników Assessment bez rozszerzania katalogu narzędzi.

Uruchom dokładne testy AssessmentHub i AssessmentOutputsTab oraz kontrolę TypeScript dla zmienionego zakresu. Dev-render jest dowodem pomocniczym, nie dowodem działania staging.

Przed checkpointem: tools/agent-delivery/agent-delivery.sh validate ux-tools
Commit: tools/agent-delivery/agent-delivery.sh checkpoint ux-tools "fix(ux-tools): reconstruct assessment tool surfaces"
Koniec: tools/agent-delivery/agent-delivery.sh handoff ux-tools

Nie wykonuj merge, PR ani deployu. Zakończ READY_FOR_CODEX_REVIEW z SHA, testami, sześcioma plikami zakresu i pozostałymi ryzykami.
```

## Kolejność integracji

1. UX narzędzi — najmniejszy zakres, kontrola działania gate.
2. Finanse — backend i UI z testami jednostek pieniężnych.
3. Dokumenty — niezależny odbiór round-trip.
4. Agent V8 — odbiór kontraktów i tenant governance.
5. UX tabeli — największa powierzchnia i końcowa kontrola konfliktów.
6. Shared-file integrator — osobny szósty etap, dopiero po akceptacji pięciu torów.
7. Staging — jeden zatwierdzony SHA integracyjny, bez wdrożeń z branchy agentów.
