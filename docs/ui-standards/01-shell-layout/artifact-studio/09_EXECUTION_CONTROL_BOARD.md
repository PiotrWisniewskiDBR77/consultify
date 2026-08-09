# Artifact Studio — execution control board

> Status: `BASELINE_CODE_VERIFIED / RUNTIME_EVIDENCE_MISSING`
> Zakres: otwarte DOC, PPT i XLSX
> Owner architektury i acceptance: Codex
> Zasada: `READY_FOR_CODEX_REVIEW` nie oznacza akceptacji

## 1. Stan programu

| Obszar | Specyfikacja | Runtime | Następna bramka |
|---|---|---|---|
| Wspólny shell | zatwierdzona | adapter i testy komponentowe gotowe | runtime, a11y i evidence 1440/1280 |
| Document Studio | zatwierdzona | adapter pod flagą, testy PASS | E2E, runtime i artefakty eksportu |
| Presentation Studio | zatwierdzona | adapter pod flagą, testy PASS | Present/Presenter E2E i runtime |
| Spreadsheet Studio | zatwierdzona | adapter, controller, batch mutations i revisions pod flagą | undo/redo, anchors i realDB evidence |
| Globalna Teresa | zatwierdzona | jeden mount wymuszony w adapterach | continuity/proposal/audit E2E |
| Governance | zatwierdzona | evaluator i export gates przetestowane | realDB, audit i pełny approval/share parity |

`APPROVED_SPEC` oznacza zamkniętą decyzję produktową. Nie oznacza, że funkcja
istnieje w runtime. Każda funkcja bez pełnego kontraktu pozostaje `MISSING` i
jest ukryta do czasu przejścia właściwej bramki.

## 2. Krytyczna ścieżka

1. **BASE-01 — Baseline:** kod, ścieżki, flagi, SHA i minimalne testy
   zweryfikowane; screenshoty i realne przepływy open/save/export/recovery
   pozostają `EVIDENCE_MISSING` zgodnie z
   [`10_BASELINE_AND_SAFETY_MAP.md`](10_BASELINE_AND_SAFETY_MAP.md).
2. **CMD-01 — Command registry — VERIFIED:** jeden `commandId`, handler,
   predicates, recovery i audit dla każdej widocznej akcji.
3. **SHELL-01 — Artifact Shell V2 — PARTIAL:** Menu 1 bez zmian, Menu 2 w jednej linii,
   jedno dynamiczne Menu 3, jeden lewy panel, bottom bar i globalna Teresa.
4. **TER-01 — Teresa context — PARTIAL:** ciągła rozmowa, screen context, jawne attachment
   chips, proposal/diff/accept/reject/undo.
5. **GOV-01 — Governance parity — PARTIAL:** lifecycle, classification, approval,
   comments, versions, QA, share i export policy.
6. **PPT-01 — Pilot Presentation Studio — PARTIAL:** przestrzeń, Menu 3, slide/block
   selection, Present/Presenter, źródła, QA i historia.
7. **DOC-01 — Document Studio — PARTIAL:** TipTap, outline, contextual formatting,
   komentarze, sources, review i eksport.
8. **XLSX-01 — Workbook foundations — PARTIAL:** identity resolver, headless
   controller, batch mutations, optimistic version oraz revisions/restore są
   wdrożone; zmiana head i wpis rewizji są objęte jedną transakcją. Pozostają
   undo/redo, anchors i fresh-export evidence na realDB.
9. **XLSX-02 — Spreadsheet Studio — PARTIAL:** shell, grid, formula bar, arkusze i P0
   komend realizowane pionowymi pakietami.
10. **XFER-01 — Transfer/a11y/runtime:** test wspólności na trzech formatach.
11. **LEGACY-01 — Removal:** dopiero po dwóch stabilnych oknach wydaniowych i
    przećwiczonym rollbacku.

## 3. Zależności

```text
BASE-01 -> CMD-01 -> SHELL-01 -> PPT-01 -> DOC-01 -> XFER-01 -> LEGACY-01
                      |            |         |
                      +-> TER-01 ---+---------+
                      +-> GOV-01 ---+---------+

BASE-01 -> XLSX-01 -> XLSX-02 -> XFER-01
```

PPT jest pilotem przestrzennym, nie osobnym kanonem. DOC wykorzystuje wnioski
z pilota. XLSX nie może rozpocząć pełnego P0 UI przed fundamentem transakcyjnym.

## 4. Pakiety startowe

### Pakiet A — baseline i safety map

- owner: Codex + agent techniczny;
- zmiany produkcyjne: brak;
- wynik: component/route/flag/API map, current SHA, realDB fixtures, screenshoty
  1920/1440/1280 oraz lista regresji;
- gate: wszystkie obecne krytyczne ścieżki są odtwarzalne albo oznaczone
  `EVIDENCE_MISSING`.

### Pakiet B — command registry

- owner: shared frontend;
- wynik: typy, registry, aliases, permission/lifecycle/selection predicates;
- gate: brak duplikatów handlerów; context menu i Menu 3 wywołują tę samą
  komendę; templates oraz stała Teresa w Menu 3 są odrzucone testem.

### Pakiet C — shell foundation

- owner: frontend architecture;
- wynik: ewolucja `ExecutiveModuleShell`, nie nowy równoległy shell;
- gate: Menu 1 snapshot bez zmian, Menu 2 nie zawija się, canvas zachowuje
  minima, jeden lewy panel, po prawej tylko Teresa.

### Pakiet D — common governance

- owner: backend + frontend contract;
- wynik: additive API dla lifecycle/classification/approval/export/restore;
- gate: fail-closed permissions, typed errors, audit, immutable version export
  i public link tylko dla `Public`.

### Pakiet E — global Teresa artifact context

- owner: aplikacyjna Teresa + adaptery formatów;
- wynik: jeden mount rozmowy i wspólny context envelope;
- gate: rozmowa/draft trwają między ekranami, attachment jest jawny i usuwalny,
  a mutacja zawsze przechodzi przez proposal i undo.

## 5. Twarde blockery P0

- drugi shell zamiast ewolucji istniejącego;
- jakakolwiek zmiana Menu 1;
- Menu 2 w więcej niż jednej linii;
- stała Teresa lub lokalny AI Editor w Menu 3;
- drugi prawy panel obok Teresy;
- przycisk bez realnego handlera i recovery;
- eksport finalny bez backendowego gate;
- public link dla niepublicznej klasyfikacji;
- self-approval;
- restore nadpisujący historię;
- XLSX range/AI mutation poza wdrożonym batch contractem z `baseVersion`;
- usunięcie legacy przed dowodem parytetu i rollbackiem.

## 6. Raportowanie pakietu

Każdy pakiet kończy się jednym statusem:

- `READY_FOR_CODEX_REVIEW` — komplet dowodów przekazany do niezależnej oceny;
- `BLOCKED` — konkretny blocker wraz z wykonanymi próbami i potrzebną decyzją;
- `IN_PROGRESS` — tylko w trakcie aktywnej pracy, nigdy jako wynik końcowy.

Wymagany evidence bundle:

- zmienione pliki i command IDs;
- testy z rzeczywistym wynikiem;
- current SHA i stan flag;
- API/DB/audit/recovery evidence odpowiednie do ryzyka;
- runtime screenshoty 1440 i 1280;
- znane ryzyka oraz procedura rollbacku.

## 7. Aktualna decyzja wykonawcza

Shared registry, shell oraz trzy adaptery istnieją pod flagami. `XLSX-01` ma już
identity resolver, headless controller, atomowy batch dla komend workbook,
optimistic versioning oraz append-only revisions z restore-to-new-head. Lewy
panel Historia korzysta z realnego API wersji; restore synchronizuje head
kontrolera i zachowuje lub odłącza kotwice komentarzy bez usuwania historii.
XLSX ma także trwałą klasyfikację/lifecycle/approval, wersjonowany endpoint
governance, typowane blokady i append-only audit events; Menu 2 steruje tym
kontraktem bez zmiany Menu 1. Krytyczna ścieżka przechodzi teraz przez
share/approval oraz pionowe pakiety brakujących komend P0.
Równolegle należy zebrać runtime/realDB/export/a11y evidence dla DOC i PPT.

Aktualna decyzja wydaniowa pozostaje `NO_GO`. Szczegółowe wykonane dowody i
braki znajdują się w
[`11_IMPLEMENTATION_EVIDENCE_AND_REMAINING_GAPS.md`](11_IMPLEMENTATION_EVIDENCE_AND_REMAINING_GAPS.md).
