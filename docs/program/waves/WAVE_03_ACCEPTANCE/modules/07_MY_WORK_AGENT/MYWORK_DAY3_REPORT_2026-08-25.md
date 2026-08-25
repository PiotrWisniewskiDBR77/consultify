# My Work Day 3 — raport dyżuru 2026-08-25

Status: **ZAKOŃCZONY TECHNICZNIE Z JAWNYMI STOP-ami; OCZEKUJE NA ZEWNĘTRZNY ODBIÓR NADZORCY**

- Baza: `codex/mod07-mywork-20260825` @ `04bfab90142082128aca2cd5f00fc118e4e900c4`; marker potwierdzony jako przodek.
- Gałąź: `codex/mywork-day3-20260825`; worktree: `/private/tmp/consultify-mywork-day3`.
- Push / merge / deploy / Railway / port 3987: **0 / 0 / 0 / 0 / 0**.
- Fetch częściowy: origin i backup pobrane; zastany `icloud-source` wskazuje nieistniejący katalog. Marker zweryfikowano niezależnie.

## Bezpieczniki

| Warunek | Wynik | Dowód |
| --- | --- | --- |
| Z16 uprawnienia | PASS | brak zmian `effectiveAccess` i modelu uprawnień |
| Z17 Admin/Superadmin i cudze gałęzie | PASS | brak plików Admin/Superadmin; brak merge fala2/photo |
| Z18 globalne testy | PASS | kontrola `tests/setup`, `tests/helpers`, `tests/__mocks__`, `vitest.*config` — pusty wynik |
| Dokładnie jedna migracja | PASS | tylko `server/migrations/20260827_calendar_events.sql` |
| Jeden raport | PASS | tylko ten plik |

## A — wspólny prawy inspektor

| Pozycja | Wynik | Commit | Uwagi |
| --- | --- | --- | --- |
| A.1 slot powłoki | DONE | `b2088ed575` | niezależny element rail |
| A.2 komponent | DONE | `90688182cc` | wspólny `IdeaElementInspector` |
| A.3 narzędzie + pusty stan | DONE | `90688182cc`, `fc027a2695` | native selection, empty state |
| A.4 słowniki stanów | DONE / OWNER REVIEW | `fc027a2695` | zachowano natywne enumy bez migracji danych |
| A.5 artefakty | DONE | `644e60dc5c` | realny odczyt konwersji, deep-link, readback |
| A.6 likwidacja starej drogi | **STOP** | `f864a060f0` | stary panel ma 6 zakładek bez pełnego parytetu; usunięcie byłoby regresją |

Inspector jest za `ff_ideaInspectorRightRail=OFF`. Tabela używa statusu rekordu, Process Flow statusu węzła, Mapa i Tablica własnych typów. Nie utworzono wspólnego zapisującego enumu.

## B — Notatnik

| Pozycja | Wynik | Commit | Uwagi |
| --- | --- | --- | --- |
| B.2 kwitancje | DONE / fail-closed per akcja | `4d7ace13bc`, `9af10efdc5` | akcje bez receipt nie deklarują capability |
| B.3 Rozwiń w dokument | **STOP / FAIL-CLOSED** | `fcbe3fa026` | odziedziczony kod używał `draftId` jako receipt; odblokowanie wymaga prawdziwego audytu |
| B.4 owner | ALREADY DONE | `f2ed2df873` | realny owner label |
| B.1 rynienka | DONE | `88e3bd43e8` | hover/focus, plus, uchwyt, wspólny SlashMenu |
| B.5 export/history | DONE | `9af10efdc5`, `fba02fef05` | w menu i rejestrze akcji |
| B.6 neutralne AI | DONE | `4d7ace13bc` | brak udawanej propozycji |

`receiptCapableActionIds=[]` pozostaje tam, gdzie backend nie daje audytowalnego receipt. Usunięcie strony ma `NOTEBOOK_PAGE_DELETED`; expand-document pozostaje wyłączone.

## C — foldery Sejfu

| Pozycja | Wynik | Commit |
| --- | --- | --- |
| C.1 agregacja folderów projektów | DONE | `449f1b5e95` |
| C.2 scope i filtr | DONE | `f8cf34d8b1` |
| C.3 CRUD + wejście do folderu | DONE | `e8d9a792bb` |

Usunięcie folderu wymaga ConfirmDialog i odpina dokumenty, nie usuwa ich. Blokada MYW-CV-REC-008 zachowana: opened-toolbar po zmianach **4/4 PASS**.

## E — Kalendarz

| Pozycja | Wynik | Commit | Uwagi |
| --- | --- | --- | --- |
| E.1 migracja | DONE | `5ab34323eb` | 19 kolumn, 3 indeksy; lokalny PostgreSQL apply 2x PASS |
| E.2 event CRUD | DONE | `ffbe804a15`, `7fdfe458ba` | tenant/owner z auth, redakcja busy, create/update/delete/reschedule |
| E.3 spotkania | DONE | `f0fb77f223`, `7fdfe458ba` | alias meeting i stabilne artifactLinks |
| E.4 V2 za flagą | DONE | `ae8bb727d4`, `be0d6e6b2c` | tydzień, 07–19, warstwy, deadline strip, empty-slot modal |
| E.5 powiel 4 tygodnie | DONE | `7d80d8df12` | jawna lista dat, 4 niezależne eventy, recurrence NULL |
| E.6 testy+i18n | **PARTIAL / STOP** | — | własne kontrakty zielone; 32/33 testów zastanych; brak pełnego dowodu i18n PL+EN |

Jedyny DDL to `calendar_events` z tenantem, ownerem, czasem, widocznością, uczestnikami, relacją i zarezerwowanymi polami recurrence; indeksy: `idx_calendar_events_owner_range`, `idx_calendar_events_org_range`, `idx_calendar_events_related`. Cudzy prywatny event jest „Zajęte”; owner/org pochodzą z tokenu; uczestnicy create/update muszą należeć do organizacji; `related_id` jest opcjonalny.

## D — resztki

| Pozycja | Wynik | Commit |
| --- | --- | --- |
| D.1/D.2 | ALREADY DONE | `655d…` |
| D.3 receipt per element w bulk delete | DONE | `ae94e86eb8` |
| D.4 usunięcie ręcznego Zapisz | DONE | `9c5f6ec335` |
| D.5 nudge Table/Process | DONE | `ef63b16715` |
| D.6 nawigacja | ALREADY DONE | `43fdef9391`, `5e97da627e` |
| D.7 enumeracja kontrolek | DONE | `5c6954eb9b` |

## STOP i ograniczenia

1. A.6: brak parytetu 6 zakładek starego panelu.
2. B.3: brak prawdziwej kwitancji expand-document; fałszywa została wyłączona.
3. E.6: brak pełnej zieleni i kompletnego dowodu i18n.
4. Prototypy `scratchpad/mywork-fala3/` i `scratchpad/mywork-kalendarz/` nie występują w tipie ani dostępnych referencjach: `PROTOTYPE_EVIDENCE_MISSING`. Nie twierdzę literalnej zgodności wizualnej.

## Testy i pomiar zasięgu §0.4a

- ExecutiveModuleShell: **17/17 PASS**.
- Notebook po zmianach: pakiet celowany **34/34 PASS**; block menu **3/3 PASS**.
- Sejf: folder contracts **4/4**, opened toolbar **4/4**, bulk receipts **6/6 PASS**.
- Pomysły: shell+inspector **33/33 PASS**; testy D.3–D.7 celowane zielone.
- E route security+migration: **8/8 PASS**; wraz z V8 **14/15**, jedna odziedziczona awaria task update.
- Osiem wymaganych plików kalendarza: **32/33 PASS** przed i po; awaria `InitiativeCalendar.drag-reschedule` odziedziczona.
- Trzy testy kontrolne po: Executive **17/17**, Vault **4/4**, Notebook **3/3**.
- `git diff --check`: PASS. Pełny `tsc`: OOM przy 4 GB — nie jest przedstawiany jako PASS.

Zakres testów jest **CZĘŚCIOWY**, nawet gdy własne pliki mają N/N PASS:

- 50 dotkniętych plików; współdzielone m.in. shell, `src/services/api.ts`, notebook route/API, Sejf i akcje Pomysłów.
- Konsumenci shell/DocumentStudio/Presentations/TemplateBuilder/Kimi: **432/454 PASS, 22 FAIL w 8 plikach**. Executive i DocumentStudio zielone; awarie obejmują zastane Presentation/Kimi i stare oczekiwania kontraktowe.
- `tests/components/MyWork`, `tests/components/Initiatives`, pełne V8 i P02: **1774 PASS, 41 FAIL, 2 SKIP / 1817**. Szeroki V8 uruchamia też RealPG bez bazy oraz cudze zastane kontrakty; brak pełnej zieleni.
- P02 osobno: **39/39 PASS**.

Nie ma podstaw do deklaracji repo-wide PASS. Własny dowód jest techniczny i częściowy; odbiór nadzorcy pozostaje wiążący.

## Literalny dowód Z18

```text
$ git diff --name-only 04bfab90142082128aca2cd5f00fc118e4e900c4...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"
(brak wyniku)
```

Nowe mocki są opt-in per plik. Nie zmieniono globalnego setupu, helperów, mocków ani konfiguracji Vitest.

## Licznik

- Migracje: **1/1**. Commity Day 3 przed domknięciem raportu: **25**.
- 28 pozycji: **24 DONE/ALREADY, 4 STOP/PARTIAL** (A.6, B.3, E.6 oraz ograniczenie prototypów). STOP nie jest przedstawiany jako spełniony DoD.

## Panel trzech sceptyków

Do uzupełnienia po ocenie końcowego SHA. Panel wewnętrzny nie zastępuje odbioru nadzorcy: kod + przepływy + podpis.
