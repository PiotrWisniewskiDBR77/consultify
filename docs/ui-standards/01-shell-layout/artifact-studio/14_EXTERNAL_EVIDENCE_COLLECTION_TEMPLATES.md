# Artifact Studio — szablony zbierania dowodów zewnętrznych

Status: `EXECUTABLE / RAW EVIDENCE REQUIRED`

Ten dokument jest formularzem roboczym do czterech bramek, których nie można
zamknąć testem jednostkowym. Nie wpisujemy `verified` na podstawie notatki lub
deklaracji. Każda wartość musi mieć trwały załącznik i wskazywać dokładny SHA.

## A. Transfer DOC → PPT → XLSX

Minimum trzy osoby. Każda wykonuje po trzy zadania w każdym formacie, a kolejność
formatów jest rotowana. Zapisujemy jeden rekord JSON na każde zadanie:

```json
{
  "taskId": "SHARE-01",
  "participantId": "P1",
  "format": "DOC",
  "formatOrder": 1,
  "unaided": true,
  "durationSeconds": 42,
  "wrongClicks": 1,
  "stateSeparationTask": true,
  "stateSeparationCorrect": true
}
```

Trzy obowiązkowe rodziny zadań:

1. `COMMON-01`: znajdź zmianę nazwy, zapis, udostępnienie i eksport.
2. `REVIEW-01`: znajdź komentarze, źródła, QA, review/approval i historię.
3. `TERESA-01`: przekaż jawne zaznaczenie Teresie i wróć do obiektu.

Moderator nie oblicza wyników ręcznie. Walidator wylicza medianę pierwszego
formatu względem drugiego/trzeciego i dokładność z rekordów oznaczonych
`stateSeparationTask`. Zadeklarowane procenty muszą być zgodne z surowymi danymi
z dokładnością 0,01 punktu procentowego.

## B. VoiceOver

Dla każdego formatu wypełnić osobny rekord:

```json
{
  "format": "DOC",
  "tester": "initials-or-id",
  "reader": "VoiceOver",
  "readerVersion": "macOS build / VoiceOver version",
  "osVersion": "macOS version",
  "keyboardPathPassed": true,
  "focusReturnPassed": true,
  "announcements": {
    "save": true,
    "error": true,
    "qa": true,
    "asyncJob": true
  },
  "evidence": "relative/path/to/log-or-recording"
}
```

Ścieżka obowiązkowa: Menu 2, Menu 3, lewy panel, canvas, bottom, Teresa,
Shift+F10, Esc i powrót focusu. Jeśli choć jedno ogłoszenie jest nieczytelne lub
hałaśliwe, wynik pozostaje `failed`, nie `verified`.

## C. Teresa — rzeczywisty provider

Po jednym rekordzie DOC/PPT/XLSX:

```json
{
  "format": "PPT",
  "provider": "provider-name",
  "model": "model-id",
  "requestId": "provider-request-id",
  "sha": "40-character-candidate-sha",
  "artifactId": "artifact-id",
  "versionId": "version-id",
  "selection": "slide 3 / block-id",
  "diffShown": true,
  "explicitDecision": true,
  "auditRecorded": true,
  "undoVerified": true,
  "evidence": "relative/path/to/network-audit-recording"
}
```

Sekretów providera nie zapisujemy. Dowód musi obejmować realny request ID,
odpowiedź, diff, decyzję, audyt i Undo.

## D. Stabilne okna telemetryczne

Po jednym rekordzie na okno:

```json
{
  "sha": "40-character-candidate-sha",
  "environment": "candidate-environment",
  "startedAt": "2026-08-10T08:00:00Z",
  "endedAt": "2026-08-10T16:00:00Z",
  "rollbackUsed": false,
  "openSuccessRate": 0.995,
  "saveErrorRate": 0.004,
  "exportSuccessRate": 0.99,
  "clientExceptionRate": 0.001,
  "legacyRouteRequests": 0,
  "telemetryReport": "relative/path/to/export.json"
}
```

Wartości są ułamkami 0–1. Oba okna muszą mieć ten sam SHA. Zmiana materialna,
rollback albo ruch do legacy zeruje okno.

## E. Procedura przyjęcia

1. Zachować surowe pliki w katalogu dowodowym poza kodem aplikacji.
2. Wprowadzić rekordy do `release-evidence.json` i dodać ścieżki w `rawEvidence`.
3. Uruchomić walidator bez `--require-complete`; kod 2 oznacza niespójne dane.
4. Dopiero po czterech PASS przygotować osobny commit usunięcia legacy.
5. Na SHA po usunięciu legacy uruchomić oba terminalne gate'y oraz pełną regresję.

Nie wolno uzupełniać brakujących pól wartościami przykładowymi z tego dokumentu.
