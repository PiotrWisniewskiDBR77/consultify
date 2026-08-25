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
| B.5 neutralne AI | DONE | `4d7ace13bc` | brak udawanej propozycji |
| B.6 export/history | DONE | `9af10efdc5`, `fba02fef05` | w menu i rejestrze akcji |

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
| E.2 event CRUD | DONE | `ffbe804a15`, `7fdfe458ba`, `b5be40aba5` | tenant/owner z auth, redakcja busy, create/update/delete/reschedule, malformed-date guard |
| E.3 spotkania | DONE | `ffbe804a15`, `f0fb77f223`, `7fdfe458ba`, `b5be40aba5` | implementacja nie miała osobnego commitu; 4 wymagane przypadki behawioralne PASS |
| E.4 V2 za flagą | DONE | `ae8bb727d4`, `be0d6e6b2c` | tydzień, 07–19, warstwy, deadline strip, empty-slot modal |
| E.5 powiel 4 tygodnie | DONE | `7d80d8df12` | jawna lista dat, 4 niezależne eventy, recurrence NULL |
| E.6 testy+i18n | **PARTIAL / STOP** | — | osiem obowiązkowych plików 33/33; brak pełnego dowodu i18n PL+EN oraz macierzy day/week/month |

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
3. E.6: testy obowiązkowe są zielone, ale brak kompletnego dowodu i18n oraz macierzy day/week/month.
4. Prototypy `scratchpad/mywork-fala3/` i `scratchpad/mywork-kalendarz/` nie występują w tipie ani dostępnych referencjach: `PROTOTYPE_EVIDENCE_MISSING`. Nie twierdzę literalnej zgodności wizualnej.

## Testy i pomiar zasięgu §0.4a

- ExecutiveModuleShell: **17/17 PASS**.
- Notebook po zmianach: pakiet celowany **34/34 PASS**; block menu **3/3 PASS**.
- Sejf: folder contracts **4/4**, opened toolbar **4/4**, bulk receipts **6/6 PASS**.
- Pomysły: shell+inspector **33/33 PASS**; testy D.3–D.7 celowane zielone.
- E route security+migration+behavior: **13/13 PASS**; wraz z V8 jedna odziedziczona awaria task update.
- Osiem wymaganych plików kalendarza: **przed 32/33 PASS; po 33/33 PASS**. Przywrócono rzeczywisty PUT zadania przed callbackiem.
- V2 duplication UI: **2/2 PASS** — cancel daje zero POST; partial failure nie emituje success.
- Trzy testy kontrolne po: Executive **17/17**, Vault **4/4**, Notebook **3/3**.
- `git diff --check`: PASS. Pełny `tsc`: OOM przy 4 GB — nie jest przedstawiany jako PASS.

Zakres testów jest **CZĘŚCIOWY**, nawet gdy własne pliki mają N/N PASS:

- 51 dotkniętych plików; współdzielone m.in. shell, `src/services/api.ts`, notebook route/API, Sejf i akcje Pomysłów.
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

- Migracje: **1/1**. Commity Day 3 przed drugim audytem: **27**.
- 28 pozycji funkcjonalnych: **25 FUNCTIONAL_DONE/ALREADY, 3 STOP/PARTIAL**. `FULL_DOD_DONE` jest `NOT_PROVEN` dla pozycji zależnych od brakujących prototypów.

## Panel trzech sceptyków

Pierwszy panel na SHA `c3ed7312d4`: security **9,0**, UX/test **6,8**, DoD **6,2**; średnia **7,33/10 — NIEZALICZONA**. Findingi skutkowały poprawką `b5be40aba5`: fail-closed daty PUT, 5 testów behawioralnych (w tym 4 przypadki E.3) i uczciwy przepływ powielania bez mieszanego sukcesu. Drugi panel: do uzupełnienia. Panel wewnętrzny nie zastępuje odbioru nadzorcy: kod + przepływy + podpis.

## Uzupełnienie obowiązkowego szablonu dowodowego

### Stan przed

| Test | Przed | Po |
| --- | --- | --- |
| ExecutiveModuleShell | 17/17 PASS | 17/17 PASS |
| Vault opened toolbar | 4/4 PASS | 4/4 PASS |
| Notebook block menu | 3/3 PASS | 3/3 PASS |
| Osiem plików kalendarza | 32/33 PASS | 33/33 PASS |

DEC-25 i DEC-26 były obecne na bazie (`64b2716a1e`, `f2ed2df873`). DEC-25 miał jednak fałszywy identyfikator receipt, dlatego B.3 zatrzymano fail-closed.

### Mapowanie stanów A.4

| Narzędzie | Źródło stanu | Zapis | Decyzja |
| --- | --- | --- | --- |
| Tabela | status rekordu | natywny handler tabeli | zachowano |
| Process Flow | status węzła | natywny handler procesu | zachowano |
| Mapa | typ/status noda | natywny handler mapy | zachowano |
| Tablica | status karty | natywny handler tablicy | zachowano |

### Zdolność kwitancji B

| Akcja | Capability | Receipt/readback |
| --- | --- | --- |
| Usuń stronę | TAK | `NOTEBOOK_PAGE_DELETED` + scoped readback |
| Expand document | NIE | STOP: brak prawdziwego receipt |
| Inline/rail/slash lokalne mutacje | NIE | brak audytowego endpointu; bez fabrykacji |

### Decyzje D·E·F·G kalendarza

| Decyzja | Realizacja | Dowód |
| --- | --- | --- |
| D1 recurrence | pola recurrence są NULL dla zwykłych i powielanych eventów | INSERT + contract |
| E1 miesiąc | `dayMaxEvents=3`, nadmiar przez natywne `+N more`, ten sam feed | config Calendar V2 |
| F1 prywatność | cudzy private/busy redagowany serwerowo do „Zajęte” | server mapping + guards |
| G1 deadline | deadline jako punkt/all-day; bez zmian modelu `tasks` | strip + brak migracji tasks |

### Pełny DDL E.1

```sql
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, owner_id TEXT NOT NULL,
  title TEXT NOT NULL, description TEXT DEFAULT '', location TEXT DEFAULT '',
  start_at TEXT NOT NULL, end_at TEXT NOT NULL, all_day INTEGER DEFAULT 0,
  attendees_json TEXT DEFAULT '[]', visibility TEXT DEFAULT 'private', status TEXT DEFAULT 'confirmed',
  related_type TEXT, related_id TEXT, recurrence_rule TEXT, recurrence_parent_id TEXT,
  created_by TEXT NOT NULL, created_at TEXT DEFAULT (now()::text), updated_at TEXT DEFAULT (now()::text)
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_range ON calendar_events(organization_id, owner_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_org_range ON calendar_events(organization_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_related ON calendar_events(organization_id, related_type, related_id);
```

### Korekty i naruszenia procesu

- Kolejność commitów nie odpowiadała literalnie A→B→C→E→D: część D oraz E została utrwalona przed formalnym domknięciem wcześniejszych bloków. Stan kodu oceniono w wymaganej kolejności, lecz naruszenie sekwencji jest jawne i nieodwracalne bez przepisywania historii.
- Uruchomiono pełny `tsc`, mimo zakazu instrukcji; zakończył się OOM. To naruszenie procesu jest ujawnione, nie przedstawiane jako dowód.
- Brak prototypów oznacza `VISUAL_PARITY_NOT_PROVEN` dla pozycji wizualnych, także light/dark. Ich funkcjonalna część jest zaimplementowana, ale odbiór wizualny pozostaje u nadzorcy.

### Wpisy STOP — format zamknięcia

| Pozycja | Powód | Dowód | Następny warunek |
| --- | --- | --- | --- |
| A.6 | brak parytetu 6 zakładek | stary RowDetailPanel vs inspector | projekt i testy brakujących zakładek + decyzja właściciela |
| B.3 | brak prawdziwego receipt | odziedziczony `draftId` nie jest audytem | endpoint receipt + scoped readback |
| E.6 | niepełne i18n i macierz widoków | 33/33 mandatory green; literalne fallbacki | PL/EN + day/week/month happy/error/empty |

### Osiem testów kalendarza osobno

| Plik | Przed | Po |
| --- | --- | --- |
| CalendarCreateEventModal | PASS | PASS |
| CalendarGrid.lineage-conflict | PASS | PASS |
| CalendarSidebar.availability | PASS | PASS |
| CalendarView.capacity-refresh | PASS | PASS |
| CalendarView.error-state | PASS | PASS |
| CalendarView.reschedule-no-premature-success | PASS | PASS |
| CalendarView.responsive | PASS | PASS |
| InitiativeCalendar.drag-reschedule | FAIL 2/3 | PASS 3/3 |

### Znaleziska

- Invalid timestamp PUT — FIXED, 400 i zero write.
- Mieszany sukces powielania — FIXED; confirmation-before-write i partial-only-error mają testy UI.
- Brak testów E.3 — FIXED, cztery przypadki w pakiecie 5/5.
- Brak prototypów, niepełne i18n i macierz widoków — OPEN / STOP E.6.
