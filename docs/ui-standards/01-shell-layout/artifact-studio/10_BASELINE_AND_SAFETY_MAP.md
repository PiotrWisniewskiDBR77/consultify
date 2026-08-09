# Artifact Studio — BASE-01 baseline i safety map

> Status: `CODE_BASELINE_VERIFIED / RUNTIME_EVIDENCE_MISSING`
> Data audytu: 2026-08-08
> Branch: `codex/sync-demo-20260729`
> HEAD: `4610ddb7de335071921435d265bb499ac2ac51e2`
> Zakres zmian produkcyjnych: brak

## 1. Cel i granice

Ten dokument zamraża punkt startowy przed `CMD-01` i `SHELL-01`. Obejmuje
otwarte dokumenty, prezentacje i skoroszyty. Nie obejmuje tworzenia ani
administracji szablonami.

Baseline rozdziela trzy rodzaje dowodu:

- `CODE_VERIFIED` — potwierdzone w aktualnym kodzie i testach lokalnych;
- `RUNTIME_VERIFIED` — potwierdzone na uruchomionej aplikacji i realnych danych;
- `EVIDENCE_MISSING` — wymagane, lecz jeszcze niewykonane lub nieaktualne.

Nie wolno uznać `CODE_VERIFIED` za akceptację runtime.

## 2. Bezpieczeństwo repozytorium

- Worktree zawiera liczne równoległe zmiany użytkownika poza zakresem programu.
- Pliki obecnych implementacji DOC/PPT/XLSX i backendowych routes nie zostały
  zmienione podczas BASE-01.
- Pakiet `artifact-studio/` jest nowym, nieśledzonym jeszcze katalogiem
  dokumentacji.
- Zabronione są reset, clean, stash, usuwanie legacy, commit, push i deploy bez
  odrębnej autoryzacji właściciela.
- Każdy pakiet implementacyjny ma zaczynać się od ponownego `git status` dla
  dokładnych plików, których dotknie.

## 3. Aktualna architektura UI

| Format | Wejście | Aktualny shell | Stan |
|---|---|---|---|
| DOC | `DocumentStudioView` → `DocumentStudioDocumentPanel` | `ExecutiveModuleShell` | `CODE_VERIFIED` |
| PPT | `DeckBuilder` → `DeckBuilderMelsView` | `ExecutiveModuleShell` przy domyślnej fladze ON | `CODE_VERIFIED` |
| XLSX | `ExceleView` | `KimiWorkspaceShell`; wspólny jest jedynie wariant prawego raila | `CODE_VERIFIED` |

Konsekwencja: nie budujemy trzeciej powłoki. Rozwijamy
`ExecutiveModuleShell` do kontraktu Artifact Studio i migrujemy XLSX przez
adapter. Modele domenowe TipTap, deck/cards i workbook/grid pozostają osobne.

### 3.1 Potwierdzone punkty montowania

- DOC: `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` montuje
  `ExecutiveModuleShell`.
- PPT: `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` wybiera
  `DeckBuilderMelsView`, który montuje `ExecutiveModuleShell`.
- XLSX: `src/components/AIChat/KimiWorkspace/ExceleView.tsx` montuje
  `KimiWorkspaceShell`.

## 4. Flagi i rollback istniejącego runtime

| Flaga | Domyślnie | Znaczenie | Ryzyko |
|---|---:|---|---|
| `ff.mels_deck_builder` | ON | PPT używa adaptera `ExecutiveModuleShell`; OFF wraca do legacy | dwa możliwe doświadczenia PPT |
| `ff.excele.right_rail` | ON | XLSX podmienia accordion na wspólną szynę ikon | nie migruje całego shellu XLSX |
| `ff.excele.edit` | ON | włącza `EditableSpreadsheetGrid` i zapis pojedynczej komórki | nie dowodzi edycji zakresów ani transakcji |

Istniejące kill-switche pozostają aktywne do czasu pełnego dowodu parytetu.
Nowy rollout nie może tworzyć kombinatorycznej mozaiki flag widocznej dla
użytkownika.

## 5. Backend i powierzchnie API

Potwierdzone mounty:

- `/api/document-studio` — `document-studio.routes.ts`;
- `/api/presentations` — `presentations.routes.ts` za beta gate;
- `/api/workbook` — `workbook.routes.ts`.

Liczba deklaracji routes w aktualnych plikach jest wskaźnikiem złożoności, nie
dowodem kompletności funkcji:

| Domena | Deklaracje routes | Ocena baseline |
|---|---:|---|
| Document Studio | 100 | bogaty backend; UI i tak ma duplikaty i techniczne powierzchnie |
| Presentations | 83 | szeroki backend; lifecycle/approval nadal wymaga wspólnego kontraktu |
| Workbook | 10 | generowanie i pojedyncza edycja istnieją; profesjonalne P0 wymaga fundamentu batch/version |

### 5.1 Potwierdzony rdzeń XLSX

Aktualne routes obejmują co najmniej: generate, blank, templates/build, get,
schema, list, download, clone i `PATCH /:id/cell`. Brakuje kanonicznego
transakcyjnego endpointu komend z `baseVersion`, idempotency i atomic rollback.
Dlatego range paste, struktura arkusza, sort, formatowanie i AI multi-edit
pozostają `MISSING` i nie mogą być eksponowane jako działające.

## 6. Minimalny test bazowy wykonany

Polecenie:

```text
npx vitest run \
  tests/components/DocumentStudio/DocumentStudioView.resumeError.test.tsx \
  tests/components/Presentations/DeckBuilder.test.tsx \
  tests/components/AIChat/KimiWorkspace/ExceleView.blankCreation.test.tsx \
  server/src/routes/__tests__/workbook-cell.routes.test.ts \
  server/src/routes/__tests__/presentationStudio.routes.test.ts \
  --maxWorkers=1 --maxConcurrency=1 --reporter=dot
```

Wynik aktualnego HEAD:

- 5 plików testowych: PASS;
- 100 testów: PASS;
- czas: 11.37 s;
- testy wystartowały i zakończyły się kodem 0.

Ten wynik potwierdza wyłącznie wybrane istniejące kontrakty: resume-error DOC,
podstawowy DeckBuilder, tworzenie pustego XLSX, zapis komórki workbook i routes
Presentation Studio. Nie potwierdza wspólnego shellu docelowego, realDB,
renderingu plików ani przeglądarkowego parytetu.

## 7. Ryzyka wymagające ochrony podczas migracji

### 7.1 DOC

- `DocumentStudioView` ma kilka faz przed właściwym dokumentem; migracja nie
  może zgubić intake, generation, resume error ani konfliktów zapisu.
- Źródła, QA, approval, historia, share i AI mają równoległe wejścia, które
  należy scalać bez usunięcia realnych endpointów.

### 7.2 PPT

- Legacy i MELS współistnieją pod flagą; fallback pozostaje do bramki cutover.
- Present, Presenter, autosave/conflict, współpraca i wersje muszą zachować
  zachowanie podczas wymiany chrome.
- Aktualny backend jest rozbudowany, ale nie wolno utożsamiać liczby routes z
  parytetem lifecycle, approval i komentarzy.

### 7.3 XLSX

- `artifactId` może prowadzić do różnych originów workbook/table; przed zmianą
  routingu potrzebny jest jawny identity resolver.
- `PATCH /:id/cell` nie wystarcza do range paste, undo, AI diff ani operacji
  strukturalnych.
- Pipeline 8 kroków trzeba zachować jako proces headless z uczciwym
  progress/error/retry; usuwamy tylko stały, mylący chrome.
- Formula engine nie może zwracać cichego zera dla niewspieranych funkcji.

## 8. Dowody nadal wymagane

Status `EVIDENCE_MISSING`:

- screenshoty aktualnego runtime 1920, 1440 i 1280 dla DOC/PPT/XLSX;
- realDB: open/reopen, save, conflict, export i recovery dla trzech formatów;
- XLSX: oba originy, świeży eksport po edycji i kontrola zawartości pliku;
- PPT: Present od bieżącego/od początku, Presenter i powrót przez Esc;
- DOC: QA gate, draft/final export, komentarze i restore;
- aktualne request/response oraz audit evidence dla share, approval i export;
- snapshot/DOM dowodzący, że Menu 1 pozostaje niezmienione.

Historyczne raporty mogą wskazywać obszary ryzyka, ale nie są dowodem obecnego
HEAD ani bieżącego środowiska.

## 9. Decyzja bramki BASE-01

`BASE-01` ma status:

```text
CODE_BASELINE_VERIFIED
RUNTIME_EVIDENCE_MISSING
PRODUCTION_GO = NO
```

Można rozpocząć `CMD-01` jako pakiet addytywny, bez przełączania runtime i bez
usuwania legacy. `SHELL-01` może rozpocząć się po zaakceptowaniu registry, ale
żaden format nie może zostać przełączony domyślnie przed uzupełnieniem dowodów
runtime z sekcji 8.

## 10. Następna akcja

`CMD-01`: utworzyć wspólny, typowany rejestr komend bez zmiany widocznego UI.
Pierwszy gate obejmuje:

1. unikalność `commandId`;
2. selection, permission i lifecycle predicates;
3. canonical placement i aliases;
4. recovery/undo i audit class;
5. automatyczne odrzucenie template commands oraz stałej Teresy w Menu 3;
6. test, że alias context/menu/keyboard wywołuje jeden handler.
