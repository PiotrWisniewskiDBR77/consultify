# Pakiety wykonawcze dla agentów

## 1. Reguła pracy

Codex pozostaje ownerem architektury, zakresu, zależności, review i acceptance.
Duże pakiety implementacyjne wykonują agenci w ograniczonym zakresie. Żaden
pakiet nie może zmieniać IA ani dopisywać przycisku poza rejestrem komend.

Każdy agent przed pracą czyta:

1. `docs/ui-standards/CANON.md`;
2. cały niniejszy pakiet Artifact Studio;
3. właściwe formatowe SSOT i aktualne komponenty;
4. instrukcję pakietu oraz wskazane testy.

## 2. Standard zlecenia

Każde zlecenie musi zawierać:

- konkretny cel i definicję sukcesu;
- dozwolone pliki oraz pliki zajęte przez innych;
- obowiązujące command IDs i kontrakty;
- listę wymaganych testów i dowodów runtime;
- zakaz atrap, fake success, zmiany Menu 1 i rozszerzania scope;
- wymóg zachowania cudzych zmian;
- rollback/feature flag;
- wynik `READY_FOR_CODEX_REVIEW` albo `BLOCKED`.

## 3. Szablon odpowiedzi agenta

```text
STATUS: READY_FOR_CODEX_REVIEW | BLOCKED
SCOPE COMPLETED:
CHANGED FILES:
COMMAND IDS:
CONTRACTS USED:
TESTS RUN:
EXACT RESULTS:
RUNTIME EVIDENCE:
PERMISSION/AUDIT/RECOVERY EVIDENCE:
KNOWN GAPS:
RISKS:
ROLLBACK:
NEXT DEPENDENCY:
```

## 4. Zalecany podział

| Pakiet | Właściciel wykonawczy | Zakaz |
|---|---|---|
| Shared schemas/state machines | backend/platform agent | zmian wizualnych |
| Command registry | frontend architecture agent | implementacji domenowej |
| Shared shell | frontend shell agent | zmiany Menu 1 i Teresy |
| Teresa bridge | chat/integration agent | nowego panelu/rozmowy |
| Governance | backend governance agent | lokalnych polityk formatu |
| PPT adapter | presentation agent | usuwania fallbacku |
| DOC adapter | document agent | template admin |
| XLSX foundations | workbook/backend agent | symulowania Office UI bez API |
| XLSX adapter | spreadsheet frontend agent | własnego shellu/AI |
| Runtime evidence | niezależny QA agent | ogłaszania GO |
| Legacy removal | integration agent | startu przed parity gate |

## 5. Checkpointy

Każdy pakiet ma trzy checkpointy:

1. `PLAN_READY`: pliki, kontrakty, testy i ryzyka są jawne.
2. `CODE_READY_FOR_REVIEW`: diff i testy są kompletne; brak automatycznej
   akceptacji.
3. `RUNTIME_EVIDENCE_READY`: current-SHA, realDB/device/browser i artefakty
   eksportowe są zapisane.

Codex może wydać `PASS` dopiero po niezależnym review wszystkich trzech.

## 6. Kryteria natychmiastowego odrzucenia

- zmiana Menu 1;
- Menu 2 w dwóch liniach;
- drugi lewy lub prawy rail;
- lokalny AI Editor lub drugi chat;
- stała Teresa w Menu 3;
- usunięcie bottom Teresy albo PPT Notes;
- template'y w otwartym studio;
- nowa funkcja bez commandId;
- przycisk bez handlera/persistence/recovery/testu;
- approval bez version binding;
- AI apply bez diff i undo;
- eksport niezweryfikowany przez otwarcie;
- legacy usunięte przed bramką.

## 7. Evidence wymagane w review

- current branch, HEAD i dirty status;
- changed-files manifest;
- testy z dokładnym wynikiem;
- API request/response dla nowych kontraktów;
- permission, audit i recovery evidence;
- screenshoty 1920/1440/1280;
- keyboard/focus path;
- realny eksport i jego otwarcie;
- lista `EVIDENCE_MISSING` bez ukrywania braków;
- instrukcja rollbacku.
