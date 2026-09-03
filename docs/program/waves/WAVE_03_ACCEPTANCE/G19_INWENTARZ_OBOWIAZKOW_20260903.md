# G19 — inwentarz obowiązków regresji po zmianach współdzielonych (16 modułów)

Data pomiaru: `2026-09-03`. Autor: agent analityczny (nadzorca zlecił inwentarz, nie naprawy).
Gałąź robocza: `agent/g19-inwentarz-20260903` (worktree z `/private/tmp/m03`).
HEAD pomiaru: `17dfbc0c8ad28d27a2daeb1ac417aa26d00e7991` (2026-09-03 18:11, `docs: rejestr znalezisk 03.09`).

Ten plik odpowiada na jedno pytanie: **co dokładnie trzeba wykonać, żeby `G19` padło na `PASS`
w każdym z 16 modułów, i jaki jest najmniejszy uczciwy zestaw dowodów.** Nie zmienia ani jednego
wiersza w `modules/*/MODULE_ACCEPTANCE.md` — proponuje brzmienie wpisu, ale go nie stawia.

Wszystkie liczby poniżej są zmierzone poleceniami `git` na tym worktree, nie przepisane z rejestrów.
Gdzie mój pomiar przeczy zastanemu zapisowi, zapisuję rozbieżność jawnie.

---

## R1 — Co program rozumie przez „shared-change regression obligation”

### Wszystko, co jest o tym napisane (pełny cytat źródeł)

| Źródło | Treść |
| --- | --- |
| `docs/program/waves/WAVE_03_ACCEPTANCE/MODULE_TEMPLATE.md:48` | `` | `G19` | Later shared-change regression obligations resolved | `NOT_STARTED` | — | `` |
| `docs/program/waves/WAVE_03_ACCEPTANCE/README.md:45` | krok 20 cyklu: „run later-change regression” |
| `docs/program/waves/WAVE_03_ACCEPTANCE/FINAL_16_MODULE_REPLAY.md:36` | pozycja bramki wejściowej G20: „All shared-component regression obligations are closed.” |
| `docs/program/waves/WAVE_03_ACCEPTANCE/CROSS_MODULE_FINDINGS.md:14-15` | **jedyna reguła operacyjna, jaka istnieje**: „A shared fix marks every affected previously accepted module `REGRESSION_REQUIRED`. No module inherits another module's retest result.” |
| `docs/program/waves/WAVE_03_ACCEPTANCE/README.md:61` | „A changed product SHA invalidates affected acceptance evidence until retest.” |
| `docs/program/waves/WAVE_03_ACCEPTANCE/README.md:110-113` | cykl statusów: `… MODULE_ACCEPTED_ON_SHA → REGRESSION_REQUIRED → FINAL_ACCEPTED` |
| `docs/program/waves/WAVE_03_ACCEPTANCE/MODULE_TEMPLATE.md:42` | `G13` ma analizować „shared-surface” — czyli powierzchnię współdzieloną wskazuje się już przy analizie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/MODULE_TEMPLATE.md:44` | `G15` = „Integrator self-QA and impacted-module regression passed” — regresja *w trakcie* naprawy |
| `docs/program/waves/WAVE_03_ACCEPTANCE/MODULE_TEMPLATE.md:94` | rejestr wdrożeń ma kolumny `Shared surfaces`, `Impacted modules`, `Tests`, `Regression result` |
| `docs/program/waves/WAVE_03_ACCEPTANCE/README.md:89` | `CROSS_MODULE_FINDINGS.md` — „shared-component findings only” |
| `docs/program/waves/WAVE_03_ACCEPTANCE/SHA_RUNTIME_LEDGER.md` (sekcja `## Rules`) | „A code, dependency, migration, configuration or governed-fixture change must record a new row and impacted-module regression set.” |

### ZNALEZISKO G19-Z1 — definicja jest nieostra, i to w trzech miejscach naraz

1. **Nigdzie nie ma listy powierzchni współdzielonych.** Sprawdziłem `docs/program/CROSS_CUTTING_STANDARDS.md`
   (78 linii) i `docs/program/CROSS_MODULE_FLOWS.md` (89 linii) — to dokumenty produktowe (mapa właścicieli
   standardów i sześć przepływów FLOW-01…FLOW-06). **Żaden z nich nie definiuje G19 ani nie wymienia
   katalogów kodu uznanych za współdzielone.** Program nie ma pliku, który mówi „to są powierzchnie
   współdzielone”. Zakres ścieżek użyty w tym inwentarzu jest zakresem *zleconym przez nadzorcę*, nie
   zakresem udokumentowanym w programie.
2. **Nie ma progu dowodowego.** `G15` mówi „impacted-module regression passed”, `G19` mówi „obligations
   resolved”. Nie napisano, czym jest „resolved”: zielony test jednostkowy? macierz zrzutów? przelot
   właściciela? Przy takim zapisie każda z tych trzech rzeczy może zostać ogłoszona wystarczającą.
3. **Nie ma kotwicy czasowej.** „Later” względem czego — `G18` (moduł zamknięty na SHA), `G12`
   (rejestr potwierdzony), czy `G06` (ostatni pomiar techniczny)? W praktyce w tym repo te trzy
   kotwice różnią się między sobą i między modułami (patrz R2).
4. **Rejestr wdrożeń/regresji jest pusty we wszystkich 16 modułach** (zmierzone: 0 wierszy danych
   w sekcji „Implementation/regression ledger” w każdym `MODULE_ACCEPTANCE.md`). Kolumny
   `Shared surfaces` / `Impacted modules` / `Regression result` istnieją, ale nikt ich nie wypełnił —
   więc nie da się odtworzyć z rejestrów, które moduły są dotknięte którą zmianą współdzieloną.

### Propozycja definicji operacyjnej (jedno zdanie)

> **G19 modułu M jest zamknięte wtedy i tylko wtedy, gdy dla KAŻDEGO pliku w zadeklarowanym
> zbiorze powierzchni współdzielonych, który zmienił się między SHA odbioru modułu M (`G18`)
> a zamrożonym markerem finalnym, istnieje dowód wykonany NA TYM MARKERZE, że powierzchnia
> modułu M dalej zachowuje się zgodnie z tym, co właściciel odebrał — osobno dla warstwy
> wizualnej (zrzut/axe/PL·EN/jasny·ciemny) i osobno dla warstwy serwerowej (test kontraktu
> trasy albo przelot HTTP), a plik bez żadnego z tych dwóch dowodów jest wypisany z nazwy
> jako otwarty dług.**

Uzasadnienie doboru: to jedyna definicja, która (a) daje mianownik dający się policzyć maszynowo,
(b) nie pozwala zamknąć bramki „bo testy przeszły” dla zmian, których testy nie dotykają, oraz
(c) wymusza wypisanie długu z nazwy zamiast milczenia — czyli broni się przed kształtem
„brak pomiaru nie jest wynikiem”.

---

## R2 — Pomiar: ile powierzchni współdzielonej zmieniło się PO odbiorze każdego modułu

### Metoda

Kotwicą jest **SHA z wiersza `G18`** („Module accepted on exact SHA and checkpointed”) — to jedyny
wiersz, który nazywa moment odbioru modułu. Wiersze `G07–G12` w 15 modułach cytują **jeden wspólny**
SHA linii grafiki `316bce9dd9…` (przegląd kart właściciela z 02.09), więc nie różnicują modułów;
`G13` nie cytuje żadnego SHA (stoi na dokumencie analizy). W module `16_PARTNER` wiersze `G07–G12`
nie cytują SHA w ogóle. Dlatego kotwicą jest `G18`.

Polecenie wzorcowe (podstawiając `<SHA>` z kolumny 2 tabeli):

```
git diff --stat <SHA> HEAD -- src/components/standard src/components/shared src/components/ui \
  src/index.css tailwind.config.js public/locales server/src/middleware server/src/routes
```

Wszystkie 16 SHA odbioru zweryfikowałem `git cat-file -t` — każdy istnieje i każdy jest przodkiem
HEAD. Wszystkie pochodzą z 02.09 (14:15–19:34).

### Tabela

| Moduł | SHA odbioru (`G18`) | Data odbioru | Plików współdzielonych zmienionych | linii | UI / serwer (bez testów) | Najważniejsze pliki (max 5) | Commity (max 5, bez merge'y) |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| `01_ORGANIZATION` | `316bce9dd9` | 02.09 14:15 | **49** | +2813 / −462 | 23 / 15 | `public/locales/{pl,en}/translation.json`, `src/index.css`, `server/src/middleware/auth.middleware.ts`, `src/components/shared/NModeLayout/NModeLeftNav.tsx` | `939d0c934a`, `fb2f003e02`, `da2e73ed91`, `c8b94973cf`, `5bb9e02cce` |
| `02_INTERVIEW` | `08775ced65` | 02.09 17:44 | **30** | +1844 / −370 | 17 / 6 | `public/locales/{en,pl}/translation.json`, `src/components/shared/NModeLayout/NModeLeftNav.tsx`, `src/index.css`, `server/src/routes/v8/chat.routes.ts` | `939d0c934a`, `fb2f003e02`, `da2e73ed91`, `c8b94973cf`, `31b5214e0f` |
| `03_TOOLS` | `08775ced65` | 02.09 17:44 | **30** | +1844 / −370 | 17 / 6 | jw. | jw. |
| `04_ASSESSMENT` | `08775ced65` | 02.09 17:44 | **30** | +1844 / −370 | 17 / 6 | jw. | jw. |
| `05_INITIATIVES` | `08775ced65` | 02.09 17:44 | **30** | +1844 / −370 | 17 / 6 | jw. | jw. |
| `06_EXECUTION` | `85dfe6c3e2` | 02.09 18:33 | **28** | +1573 / −369 | 17 / 6 | `public/locales/{en,pl}/translation.json`, `NModeLeftNav.tsx`, `src/index.css`, `server/src/routes/help.routes.ts` | `939d0c934a`, `fb2f003e02`, `da2e73ed91`, `c8b94973cf`, `31b5214e0f` |
| `07_MY_WORK_AGENT` | `08775ced65` | 02.09 17:44 | **30** | +1844 / −370 | 17 / 6 | jw. (grupa `08775ced65`) | jw. |
| `08_MEETINGS` | `316bce9dd9` | 02.09 14:15 | **49** | +2813 / −462 | 23 / 15 | jw. (grupa `316bce9dd9`) | jw. |
| `09_RESULTS` | `4d402fcfc8` | 02.09 18:32 | **28** | +1573 / −369 | 17 / 6 | jw. (grupa późna) | jw. |
| `10_FINANCE` | `97c8293786` | 02.09 18:43 | **28** | +1573 / −369 | 17 / 6 | jw. | jw. |
| `11_MATERIALS` | `4d402fcfc8` | 02.09 18:32 | **28** | +1573 / −369 | 17 / 6 | jw. | jw. |
| `12_AUDITS` | `08775ced65` | 02.09 17:44 | **30** | +1844 / −370 | 17 / 6 | jw. | jw. |
| `13_CHAT` | `08775ced65` | 02.09 17:44 | **30** | +1844 / −370 | 17 / 6 | jw. | jw. |
| `14_ADMIN` | `08775ced65` | 02.09 17:44 | **30** | +1844 / −370 | 17 / 6 | jw. | jw. |
| `15_SETTINGS` | `08775ced65` | 02.09 17:44 | **30** | +1844 / −370 | 17 / 6 | jw. | jw. |
| `16_PARTNER` | `075735c395` | 02.09 19:34 | **28** | +1573 / −369 | 17 / 6 | jw. | jw. |

**Min/max: 28 – 49 plików współdzielonych na moduł.** Commitów bez merge'y dotykających tych ścieżek:
61 (grupa `316bce9dd9`), 46 (grupa `08775ced65`), 44 (cztery późne grupy).

### ZNALEZISKO G19-Z2 — obowiązek jest JEDEN, nie szesnaście

Wszystkie 16 SHA odbioru leżą na jednej linii integracyjnej w oknie **5 godzin i 19 minut**
tego samego dnia (02.09 14:15 → 19:34). W efekcie 16 zbiorów zmian współdzielonych redukuje się do
**trzech różnych zbiorów** (49 / 30 / 28 plików), a te trzy różnią się między sobą tylko dokładaniem
kolejnych commitów tego samego dnia. Zbiór najmniejszy (28 plików) jest **podzbiorem** największego (49).

Praktyczny wniosek: **nie ma sensu planować 16 osobnych regresji.** Uczciwy plan to
**jedna regresja na zamrożonym markerze**, z 16 wpisami różniącymi się wyłącznie mianownikiem
(które ekrany/trasy modułu) i cytowanym SHA odbioru.

### ZNALEZISKO G19-Z3 — na dziś dług jest już domknięty w kodzie, ale nie w dowodzie

Zmierzone: `git diff --name-only fee24bddb0 HEAD -- <ścieżki współdzielone>` → **0 plików**.
Marker pomiaru #3 (`fee24bddb0`, 03.09 17:35) zawiera zatem **wszystkie** zmiany współdzielone
z tabeli wyżej. Marker poprzedniego pomiaru G06 (`35afcb15fd`, 03.09 14:51) ich **nie** zawiera —
po nim zmieniło się jeszcze 5 plików współdzielonych:

```
66 / 126   public/locales/en/translation.json
66 / 126   public/locales/pl/translation.json
 5 /   1   server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
 7 /   1   src/components/shared/PreviewPane/PreviewRelations.tsx
44 /   0   src/index.css
```

To jest dokładnie powód, dla którego `G06` stoi na `PASS` tylko w 5 modułach (`01`, `03`, `04`, `05`,
`15` — zmierzone) i dlaczego pomiar #3 na `fee24bddb0` jest potrzebny.

---

## R3 — Jaka regresja zamyka obowiązek najtaniej i uczciwie

### (a) Pełna macierz G06 na zamrożonym markerze — co pokrywa, a czego nie

Macierz (`scripts/dev/g06-macierz-uruchom.mjs` → `scripts/dev/grafika-zrzuty.mjs`) obejmuje
**248 ekranów** z `scripts/dev/g06-macierz-ekrany.json`, każdy w 8 kadrach (PL/EN × jasny/ciemny ×
1440/1024), z `--rozwin-sekcje=1 --a11y=1` i domyślnym kliknięciem w wiersz.

Zmierzyłem osiągalność każdego zmienionego komponentu współdzielonego z ekranów harnessu
(odwrotny graf importów `src` + `dev-render`, przechodnio, z pominięciem `__tests__`), i przecięcie
tego zbioru z 248 ekranami macierzy:

| Zmieniony plik współdzielony | ekranów macierzy G06, z których jest osiągalny | modułów |
| --- | ---: | ---: |
| `src/components/shared/NModeLayout/AIConsultantPanel.tsx` | **0** | 0 |
| `src/components/ui/primitives/cells/ProgressCell.tsx` | 1 | 1 |
| `src/components/shared/WizardModal/WizardStepper.tsx` | 4 | 2 |
| `src/components/ui/ResizableTable/ColumnResizer.tsx` | 15 | 3 |
| `src/components/shared/TableWithPreviewLayout.tsx` | 27 | 7 |
| `src/components/shared/NModeSections/AttachmentsLinksCanvas.tsx` | 28 | 5 |
| `src/components/shared/NModeSections/CommentsCanvas.tsx` | 28 | 5 |
| `src/components/shared/ExecutiveModuleShell/TopBar.tsx` | 34 | 2 |
| `src/components/shared/ExecutiveModuleShell/RightRail.tsx` | 36 | 2 |
| `src/components/standard/EvidencePanelSection.tsx` | 38 | 6 |
| `src/components/shared/NModeLayout/NModeLeftNav.tsx` | 45 | 8 |
| `src/components/standard/ArtifactRightPanel.tsx` | 63 | 9 |
| `src/components/standard/StandardPreview.tsx` | 70 | 13 |
| `src/components/ui/ResizableTable/PreviewPaneShell.tsx` | 75 | 13 |
| `src/components/shared/ModuleHub/FilterableTable.tsx` | 76 | 13 |
| `PreviewAIHintStrip` / `PreviewActivityStrip` / `PreviewDetailsSection` / `PreviewMetaCard` / `PreviewWhatsNextCard` | 86 każdy | 13 |
| `src/components/shared/PreviewPane/PreviewActionBar.tsx` | 87 | 13 |
| `src/components/shared/states/EmptyState.tsx` | 89 | 14 |
| `src/components/shared/PreviewPane/PreviewRelations.tsx` | 91 | 13 |

**Wniosek (a):** macierz G06 na zamrożonym markerze pokrywa **22 z 23** zmienionych komponentów
współdzielonych UI. Pokrywa też `src/index.css` i `tailwind.config.js` (zmiana tokenów jest widoczna
na każdym kadrze) oraz częściowo `public/locales` (kontrola PL≠EN i obecności tekstu).

**Czego macierz G06 NIE pokrywa — cztery dziury, wypisane z nazwy:**

| # | Dziura | Dowód |
| --- | --- | --- |
| D-a1 | `AIConsultantPanel.tsx` — osiągalny tylko z ekranu `teresa-chipy-panel-artefaktu`, którego **nie ma** w `g06-macierz-ekrany.json` | pomiar osiągalności powyżej |
| D-a2 | **Cała warstwa serwerowa.** Macierz biega na harnessie dev-render z danymi atrapowymi; `404` na `/api/*` jest w niej liczone osobno jako **nie-defekt**. Zmienione `server/src/middleware` (3 pliki) i `server/src/routes` (12 plików bez testów) mają w macierzy G06 **zerowe** pokrycie | `scripts/dev/g06-macierz-uruchom.mjs`; treść wpisu G06 w `modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md:70` |
| D-a3 | `public/locales` — macierz sprawdza „PL≠EN” i „tekst istnieje”, **nie** sprawdza, czy klucz PL trzyma polskie słowo. To dokładnie kształt „klucz istnieje ≠ przetłumaczony”. Zmiana to +1300/−260 linii w dwóch plikach dla najstarszych modułów | `git diff --numstat 316bce9dd9 HEAD -- public/locales` |
| D-a4 | Osiągalność ≠ wyrenderowanie. Mój pomiar liczy ścieżkę importu, nie faktyczne wyrenderowanie w danym stanie danych. Komponent pod warunkiem (`{x && <Preview…/>}`) może być osiągalny i nigdy nie pojawić się na zrzucie | ograniczenie metody, zapisane świadomie |

### (b) Testy jednostkowe komponentów współdzielonych — co istnieje, a czego nie ma

Zmierzone dla pełnego zbioru 23 zmienionych komponentów UI
(`git diff --name-only 316bce9dd9 HEAD -- src/components/standard src/components/shared src/components/ui`,
z odjęciem samych plików testowych; następnie grep po realnym imporcie w plikach `*.test.*`/`*.spec.*`):

**8 z 23 komponentów ma choć jeden test, który je importuje. 15 z 23 nie ma żadnego.**

Komendy do uruchomienia (bez `tests/unit` w całości — tylko pliki dotknięte):

```bash
# blok 1 — podgląd i tabela (dotyczy WSZYSTKICH 16 modułów)
npx vitest run \
  src/components/shared/PreviewPane/__tests__/PreviewRelations.businessLabels.test.tsx \
  src/components/shared/ModuleHub/__tests__/FilterableTable.cellWordBreak.test.tsx \
  src/components/shared/ModuleHub/__tests__/FilterableTable.filterA11y.test.tsx \
  src/components/shared/__tests__/filterableTable.r04-2a.test.tsx \
  src/components/shared/__tests__/tablePreviewGeometry.r03-2.test.tsx \
  src/components/shared/__tests__/standardPreview.r03.test.tsx \
  src/components/standard/__tests__/keyboardAccessCanon.test.tsx \
  tests/components/standard/StandardPreview.test.tsx \
  tests/unit/standardPreviewActionOrder.test.ts \
  tests/unit/blokCoDalejPodgladu.test.tsx \
  tests/components/shared/TableWithPreviewLayout.mobile-overlay.test.tsx \
  tests/unit/initiatives-execution/tableWithPreviewAccessibility.test.tsx \
  tests/unit/initiatives-execution/tableWithPreviewMobileAccessibility.test.tsx \
  src/components/shared/ExecutiveModuleShell/__tests__/RightRail.test.tsx \
  src/components/Interview/__tests__/PreviewActionBar.ownerBehavior.test.tsx \
  src/components/Execution/__tests__/ExecutionHub.sourceRelation.render.test.tsx \
  src/components/Audit/method/workspace/v2/__tests__/CriterionWorkspaceV2.test.tsx \
  src/components/MyWork/notebook/__tests__/NotebookRightRail.ownerContract.test.ts

# blok 2 — warstwa serwerowa współdzielona (middleware zmienione po odbiorze 01 i 08)
npx vitest run \
  tests/unit/backend/middleware/auth.middleware.test.ts \
  tests/unit/backend/middleware/auth.middleware.e2e.test.ts \
  tests/unit/backend/middleware/auth.middleware.getDeps.test.ts \
  tests/unit/auth/auth.middleware.verifyToken.test.ts \
  tests/unit/auth/auth.middleware.private.test.ts \
  tests/unit/backend/middleware/requireAudit.middleware.test.ts

# blok 3 — nowe kontrakty tras z 03.09 (wymagają realnego PostgreSQL, RUN_DB_TESTS=1)
npx vitest run \
  server/src/routes/__tests__/day274-ocena-dociera-do-listy.pg.test.ts \
  server/src/routes/__tests__/day275-method-outputs-kontrakt.pg.test.ts \
  server/src/routes/__tests__/day276-deck-autosave-persist.pg.test.ts \
  server/src/routes/__tests__/day276-workbook-cell-persist.pg.test.ts \
  server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts \
  server/src/routes/__tests__/ai.agentHubRateLimitRouting.test.ts
```

Blok 1 i 2 są **wspólne dla wszystkich 16 modułów** (bo zbiór zmian jest wspólny — G19-Z2).
Blok 3 dotyczy `04_ASSESSMENT` (day274/275), `11_MATERIALS` (day276), `05_INITIATIVES` + `13_CHAT`
(day277, agent-hub) — tylko dla modułów z bazą `316bce9dd9` te pliki są *nowe* po odbiorze;
dla pozostałych część z nich istniała już w SHA odbioru.

**15 komponentów bez żadnego testu** (to jest lista długu, nie lista do napisania w tym dyżurze):

`ExecutiveModuleShell/TopBar`, `NModeLayout/AIConsultantPanel`, `NModeLayout/NModeLeftNav`,
`NModeSections/AttachmentsLinksCanvas`, `NModeSections/CommentsCanvas`, `PreviewPane/PreviewAIHintStrip`,
`PreviewPane/PreviewActivityStrip`, `PreviewPane/PreviewDetailsSection`, `PreviewPane/PreviewMetaCard`,
`PreviewPane/PreviewWhatsNextCard`, `WizardModal/WizardStepper`, `states/EmptyState`,
`standard/EvidencePanelSection`, `ui/ResizableTable/ColumnResizer`, `ui/primitives/cells/ProgressCell`.

Uwaga metodyczna: `tests/unit/components/MyWork/shared/EmptyState.test.tsx` **nie** jest testem
`src/components/shared/states/EmptyState.tsx` — importuje `@/components/MyWork/shared/EmptyState`.
Zliczenie go byłoby fałszem po nazwie pliku.

Po stronie serwera: `server/src/middleware/mfaEnrollmentToken.middleware.ts` (nowy, dodany w
`86f6632cff` — „przerwij zamknięte koło logowania”) **nie ma żadnego pliku testowego**. To jest
zmiana w ścieżce logowania wszystkich 16 modułów bez własnego testu.

### (c) e2e / przelot właściciela (G16)

`G16` stoi we wszystkich 16 modułach na `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`
(zmierzone). Definicja retestu zapisana w tych wpisach: „przelot po stagingu na REALNYCH danych,
moduł po module, z otwarciem realnego rekordu z listy (`DEC-2026-09-03-346`)”.

To jedyny mechanizm, który zamyka dziury **D-a2** (serwer), **D-a3** (język), **D-a4** (warunkowe
renderowanie) naraz — bo biegnie na realnym backendzie i realnych danych.

### Gdzie (a)+(b) NIE wystarcza — twarda odpowiedź

| Moduł | Czy (a) macierz G06 + (b) testy zamykają G19? | Czego brakuje |
| --- | --- | --- |
| `01_ORGANIZATION`, `08_MEETINGS` | **NIE** | ich bazą jest `316bce9dd9` — jako jedyne mają w zbiorze **3 zmienione pliki `server/src/middleware`** (`auth`, `mfaEnrollmentToken`, `requireAudit`) i 12 tras. Macierz G06 nie dotyka serwera; `mfaEnrollmentToken.middleware.ts` nie ma testu. Wymagany przelot HTTP albo nowy test kontraktu |
| `04_ASSESSMENT`, `05_INITIATIVES`, `11_MATERIALS`, `13_CHAT` | **NIE** | zmiany w trasach zapisu (`day274/275/276/277`, `ai.routes`, `v8/chat`, `v8/teresa`) — dowód wymaga realnego PostgreSQL (`RUN_DB_TESTS=1`), nie atrapy; atrapa `Database.ts:686` zwraca `changes:1` dla każdego UPDATE |
| `06_EXECUTION` | **NIE** | `initiativesExecutionRuntime.routes.ts` (zmiana `bb5465b296`) nie ma żadnego pliku testowego o pasującej nazwie; zmiana dotyczy treści wyświetlanej w dropdownie |
| `02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16` | **CZĘŚCIOWO** | (a)+(b) pokrywa warstwę wizualną; otwarte zostaje `public/locales` (D-a3) i `help.routes.ts` / `v8/index.ts` |
| wszystkie 16 | **NIE dla `AIConsultantPanel`** | jedyny ekran, z którego jest osiągalny, leży poza macierzą (D-a1) |

**Najtańszy uczciwy zestaw dowodów na moduł** (kolejność = rosnący koszt):

1. macierz G06 na zamrożonym markerze `fee24bddb0` (już planowana, pomiar #3) — pokrywa 22/23 komponenty UI;
2. blok 1 + blok 2 komend z (b) — **jedno uruchomienie dla wszystkich 16 modułów**, nie 16 uruchomień;
3. dołożenie ekranu `teresa-chipy-panel-artefaktu` do `g06-macierz-ekrany.json` (zamyka D-a1 jednym wierszem JSON);
4. przelot HTTP na realnym backendzie po zmienionych trasach (zamyka D-a2) — to jest jedyna pozycja o realnym koszcie;
5. przelot właściciela G16 po stagingu (zamyka D-a3 i D-a4) — czeka na słowo właściciela.

---

## R4 — Proponowane brzmienie wiersza `G19` i zmiana w skrypcie

### Wzorzec wpisu (styl wpisów `G06`/`G14` z 03.09)

Do wstawienia w `modules/<MODUŁ>/MODULE_ACCEPTANCE.md` w miejsce obecnego
`| G19 | Later-change regression obligations resolved | `NOT_STARTED` | — |`.

**Wariant 1 — stan po wykonaniu (a)+(b), przed przelotem właściciela:**

```
| G19 | Later-change regression obligations resolved | `TECHNICAL_REGRESSION_PASS / OWNER_RETEST_PENDING` | ZMIERZONE <DATA> na zamrożonym markerze `<MARKER>` (nadzorca). Kotwica: SHA odbioru tego modułu z wiersza `G18` = `<SHA_G18>` (<DATA_ODBIORU>). Mianownik: <N> plików współdzielonych zmienionych między `<SHA_G18>` a markerem (`git diff --name-only <SHA_G18> <MARKER> -- src/components/standard src/components/shared src/components/ui src/index.css tailwind.config.js public/locales server/src/middleware server/src/routes`), w tym <U> plików UI i <S> plików serwera; pełna lista i przypisanie do commitów: `docs/program/waves/WAVE_03_ACCEPTANCE/G19_INWENTARZ_OBOWIAZKOW_20260903.md` sekcja R2. Dowód wizualny: pełna macierz G06 na TYM SAMYM markerze — manifesty `evidence/grafika/g06-macierz-<MARKER>/<MODUŁ>/`, agregat `evidence/grafika/g06-macierz-<MARKER>/AGREGAT.md`; z <U> komponentów UI <P> jest osiągalnych z ekranów macierzy tego modułu (pomiar odwrotnego grafu importów, R3a). Dowód jednostkowy: `<ŚCIEŻKA_DO_LOGU_TESTÓW>` — bloki 1–3 z R3b, wynik <X>/<X>. Dowód serwerowy: `<ŚCIEŻKA>` albo `BRAK — <powód>`. OTWARTE (wypisane z nazwy, nie milczane): <lista plików bez dowodu>. Bramka NIE może paść na `PASS`, dopóki właściciel nie wykona przelotu G16 po stagingu na realnych danych — regresja techniczna nie zastępuje odbioru. Poprzedni stan bramki: `NOT_STARTED`. |
```

**Wariant 2 — `PASS` po przelocie właściciela:**

```
| G19 | Later-change regression obligations resolved | `PASS` | <treść wariantu 1>, uzupełnione o: przelot właściciela G16 wykonany <DATA> na stagingu `<gitSha z /api/health>` na realnych danych, z otwarciem realnego rekordu z listy (`DEC-2026-09-03-346`); decyzje właściciela dla tego modułu: `<ŚCIEŻKA_DO_EKSPORTU>` — ok <A>, poprawka <B>, nie <C>; wszystkie pozycje OTWARTE z pomiaru technicznego mają rozstrzygnięcie (numer `DEC-…` albo commit naprawy). Poprzedni stan bramki: `TECHNICAL_REGRESSION_PASS / OWNER_RETEST_PENDING`. |
```

**Wariant 3 — `BLOCKED`, gdy marker nie jest zamrożony:**

```
| G19 | Later-change regression obligations resolved | `BLOCKED` | Marker finalny nie jest zamrożony (`FINAL_16_MODULE_REPLAY.md` → `Final product SHA: UNSET`). Każdy pomiar wykonany przed zamrożeniem unieważnia się przy pierwszym scaleniu w powierzchnię współdzieloną (reguła `CROSS_MODULE_FINDINGS.md:14-15`). Warunek odblokowania: zamrożony marker + zerowy `git diff` w ścieżkach współdzielonych między markerem a HEAD. Poprzedni stan bramki: `NOT_STARTED`. |
```

Miejsca do podstawienia: `<MARKER>`, `<SHA_G18>`, `<DATA_ODBIORU>`, `<N>`, `<U>`, `<S>`, `<P>`,
`<X>`, ścieżki do logów i eksportu decyzji, lista otwartych plików.

### Jak `scripts/dev/g14-g16-rejestr.mjs` mógłby zapisywać `G19` (opis, NIE implementacja)

Skrypt (przeczytany w całości, 96 linii) ma już cały potrzebny szkielet: listę 16 modułów,
funkcję `zamien(id, status, notatka)` z regexem `^\|\s*${id}\s*\|…` i doklejaniem
„Poprzedni stan bramki: …”, sprawdzanie istnienia plików dowodowych (`istnieje()`),
tryb `--na-sucho=1` i wymagany `--marker=`. Proponowana zmiana to **cztery punkty**:

1. **Nowa tablica `SHA_ODBIORU`** — mapa `moduł → SHA z wiersza G18`. Skrypt nie powinien jej mieć
   na sztywno: powinien ją **odczytać** z pliku `MODULE_ACCEPTANCE.md` tym samym regexem co `zamien`,
   biorąc pierwszy SHA 10–40-znakowy z komórki dowodowej `G18`. Gdy nie znajdzie — `★ ${mod}: brak
   SHA odbioru w G18` i pominięcie modułu (fail-closed, nie „zapisz cokolwiek”).
2. **Funkcja `zmiennoscWspoldzielona(shaOdbioru, marker)`** — wywołanie
   `spawnSync('git', ['diff','--name-only', sha, marker, '--', …ŚCIEŻKI])` (skrypt już importuje
   `spawnSync` — patrz `g06-macierz-uruchom.mjs`, ten sam wzorzec). Zwraca `{pliki, ui, serwer}`.
   Lista ŚCIEŻEK musi być **stałą nazwaną** na górze pliku, nie literałem w wywołaniu, żeby dała się
   wyeksportować i przetestować.
3. **Bezpiecznik zamrożenia** — przed jakimkolwiek zapisem: `git diff --name-only <marker> HEAD -- <ŚCIEŻKI>`.
   Jeśli wynik **niepusty**, skrypt ustawia wariant 3 (`BLOCKED`) i kończy się kodem `1`.
   Bez tego bezpiecznika skrypt zapisze `TECHNICAL_REGRESSION_PASS` na markerze, który już się
   zdezaktualizował — czyli powtórzy kształt „dowód poza repo wyparowuje”.
4. **Wywołanie `zamien('G19', status, notatka)`** — status wyliczony, nie podany: `BLOCKED` gdy pkt 3
   czerwony; `TECHNICAL_REGRESSION_PASS / OWNER_RETEST_PENDING` gdy istnieje manifest macierzy G06
   dla tego modułu na tym markerze **oraz** log testów; w każdym innym przypadku `NOT_STARTED`
   z wypisanym powodem. `PASS` skrypt **nie powinien umieć postawić w ogóle** — to decyzja
   właściciela po G16, tak samo jak dziś `G14` nie może paść na `PASS` automatycznie.

Dodatkowo — ZMIERZONE, nie założone: klasyfikator `scripts/wave3/report-acceptance-gates.mjs`
(funkcja `classifyGate`) traktuje `TECHNICAL_REGRESSION_PASS / OWNER_RETEST_PENDING` jako
`owner_gated` (reguła `/OWNER_(PENDING|REVIEW|RETEST|GATE|DECISION|CONFIRMATION|ACCEPTANCE)/`),
a `BLOCKED` jako `open` — w obu przypadkach NIE jako zamknięte. Sprawdziłem też wariant
`… / OWNER_REPLAY_PENDING`: wpada do `open`, bo słowo `REPLAY` nie jest na liście kluczowych.
Dlatego proponowany status używa `OWNER_RETEST_PENDING`, spójnie z istniejącym `G16` — zmiana
w klasyfikatorze nie jest potrzebna.

---

## R5 — Blokery bramki wejściowej `G20`

Źródło pozycji: `docs/program/waves/WAVE_03_ACCEPTANCE/FINAL_16_MODULE_REPLAY.md:33-41`
(sekcja `## Entry gate`, siedem pozycji, wszystkie odhaczone jako `[ ]`).
Do tego jedna pozycja spoza listy, nazwana w tym samym pliku jako jawny bloker: `FINAL_16_MODULE_REPLAY.md:29`.

| # | Pozycja bramki wejściowej | Stan dzisiaj | Dowód (zmierzony) | Co trzeba zrobić | Szacunek |
| --- | --- | --- | --- | --- | --- |
| 1 | `All 16 modules reached MODULE_ACCEPTED_ON_SHA at least once` (`:35`) | **SPEŁNIONA w rejestrach, SPORNA co do podstawy** | Zmierzone: wiersz `G18` = `` `PASS` `` w **16/16** modułach; wszystkie 16 cytowanych SHA istnieją (`git cat-file -t`) i są przodkami HEAD. ALE `MASTER_STATUS_REGISTER.md` (sekcja „2026-09-02 — owner card review”) mówi „**Finally closed modules: 2 of 16**”, a kolumna „Current gate” tej samej tabeli pokazuje dla 16/16 stany nie-akceptowane (`OWNER_REVIEW_PENDING`, `EXPERT_NO_GO`, …). **Rozbieżność: dwa rejestry, dwie odpowiedzi.** Dodatkowo wpisy `G18` opisują akcept warstwy ekranowej („bramek technicznych G05/G06 ani napraw G13–G16 ten wpis NIE podnosi”) | Rozstrzygnąć jednym zdaniem właściciela, czy `G18` na akceptcie kart z 02.09 liczy się jako `MODULE_ACCEPTED_ON_SHA` dla G20. Zsynchronizować `MASTER_STATUS_REGISTER.md` z wierszami `G18` (albo obniżyć `G18`, albo poprawić rejestr — ale nie zostawiać obu) | **ŚREDNIE** |
| 2 | `All shared-component regression obligations are closed` (`:36`) | **NIESPEŁNIONA — 0/16** | `G19` = `NOT_STARTED` we wszystkich 16 modułach (zmierzone). Rejestr wdrożeń/regresji pusty w 16/16 (0 wierszy danych). Mianownik obowiązku zmierzony w R2: 28–49 plików na moduł | Wykonać plan z R3: macierz G06 na zamrożonym markerze + bloki 1–2 testów + zamknięcie czterech dziur D-a1…D-a4 + wpisy wg R4 | **DUŻE** |
| 3 | `One clean final product SHA is frozen` (`:37`) | **NIESPEŁNIONA** | `FINAL_16_MODULE_REPLAY.md:5` → `Final product SHA: UNSET`; `:3` → `Status: NOT_READY` | Zamrożenie markera (kandydat: `fee24bddb0` — dziś `git diff` w ścieżkach współdzielonych `fee24bddb0..HEAD` = **0 plików**) i zakaz scaleń w powierzchnię współdzieloną do końca replayu | **ŚREDNIE** (decyzja + dyscyplina, nie kod) |
| 4 | `Client and server SHA readback match the frozen candidate` (`:38`) | **NIESPEŁNIONA** | Ostatni potwierdzony odczyt runtime: `PRZEKAZANIE_20260902.md:53` — `origin/develop` = staging = `0eff12615b`, potwierdzone `gitSha` z `/api/health`. Zmierzone: `git rev-list --count 0eff12615b..HEAD` = **500 commitów**. Staging biegnie 500 commitów za linią, na której stoją dowody z 03.09 | Promocja na `develop` (czeka na słowo właściciela), po niej odczyt `gitSha` z `/api/health` i porównanie z zamrożonym markerem. Pułapka do obejścia: duży push pomija workflow z filtrem `paths` w ciszy — dowodem jest `gitSha`, nie zielony run | **ŚREDNIE** |
| 5 | `Isolated non-production database and persona fixtures are identified` (`:39`) | **NIESPEŁNIONA** | `OWNER_FIXTURE_INVENTORY.md:2-9` — ostrzeżenie `DATABASE_ABSENT_AT_REVALIDATION`, „the tables below … must not be read as current catalog state”. Sprawdziłem cytowaną ścieżkę spoza repo z `G01` modułu 01: `ls /private/tmp/consultify-wave3-runtime-manifest-org-final-replay-20260822.json` → **No such file or directory** (w `/private/tmp` jest 16 innych manifestów, ale nie ten). Ten sam fakt jest już przyznany w treści `G01` modułu 01 | Wskazać JEDNĄ izolowaną bazę do replayu (nie 16 historycznych), odbudować fikstury person na łańcuchu migracji z zamrożonego markera i zapisać manifest **w repo**, nie w `/private/tmp` | **DUŻE** |
| 6 | `Zero open P0/P1 across all registers` (`:40`) | **NIESPEŁNIONA — 22 × P0, 38 × P1** | Zliczone maszynowo z tabeli `MASTER_STATUS_REGISTER.md`: `ASM` 7/1, `INI` 3/6, `MYW` 11/18, `CHAT` 1/13 → **P0 = 22, P1 = 38**. Pozostałe 12 modułów: 0/0. `docs/program/REJESTR_ZNALEZISK_20260903.md` sekcja D ma dodatkowo **13 pozycji otwartych** bez przypisanej ostrości (D1–D13), z których co najmniej D5 (`/api/settings/watchers` nie istnieje — funkcja martwa w produkcji), D6 (`help_articles` — migracja w innym kształcie niż kod, błąd cicho łapany) i D7 (34 trasy `/api/v8/finance/*` bez bramki modułu) mają charakter P0/P1 i nie są policzone w liczbie 22/38 | Zamknąć albo jawnie zreklasyfikować 60 pozycji P0/P1 z czterech modułów; nadać ostrość 13 pozycjom z rejestru D i wciągnąć je do liczników modułowych (dziś są poza mianownikiem) | **DUŻE** |
| 7 | `Every P2/P3 has an explicit disposition` (`:41`) | **NIESPEŁNIONA — 16 × P2 bez dyspozycji** | Zliczone: P2 = 16 (`TLS` 1, `INI` 3, `MYW` 9, `CHAT` 3), P3 = 0. Pole „P2/P3 dispositions complete” z `MODULE_TEMPLATE.md` **nie istnieje w ogóle** w 15 z 16 plików modułów — sekcja `Owner verdict` została w nich skrócona do pięciu linii bez tego pola (jedyne trafienie na ciąg `P2/P3`: `06_EXECUTION/MODULE_ACCEPTANCE.md:315`, i to w innym kontekście). `MASTER_STATUS_REGISTER.md` też nie ma takiej kolumny (0 trafień). Nie ma więc miejsca, w którym dyspozycja miałaby stanąć | Jedna decyzja właściciela na pozycję: naprawa / `ACCEPTED_OUT` / `DEFERRED_TO_WAVE_4_PLUS` z podaniem fali, powodu, właściciela i warunku ponownego otwarcia (wymóg `README.md:62-63`) | **DROBNE** (16 decyzji, zero kodu) |
| 8 | `XMOD-SEC-001` — rotacja poświadczenia Railway (`:29`, jawny bloker P0) | **NIESPEŁNIONA — brak jakiegokolwiek zamknięcia** | `CROSS_MODULE_FINDINGS.md:8` — status `CODE_FIXED_AND_CURRENT_TREE_SCAN_PASS / EXTERNAL_ROTATION_UNVERIFIED`. Przeszukałem cały `docs/` po `XMOD-SEC-001`: **4 trafienia, żadne nie meldujące rotacji**. Jedyna wzmianka o rotacji w raporcie poświadczeń: `CREDENTIALS_CLEANUP_DAY39_REPORT_20260828.md:320` — „Nie wykonano … rotacji hasła”. `PRZEKAZANIE_20260902.md:40` notuje osobno „Redis stagingu bez rotacji” | Rotacja poświadczenia po stronie Railway przez właściciela środowiska (nieodwracalna, poza mandatem agenta), następnie: skan drzewa, próba połączenia bez sekretu i **dowód odrzucenia starej wartości** | **ŚREDNIE** (jedna operacja właściciela + jeden dowód) |

### Poza bramką wejściową, ale w tym samym pliku

- **Macierz replayu**: 16 wierszy, wszystkie `NOT_RUN` (zliczone: `grep -c NOT_RUN` = 16). To jest treść samego `G20`, nie bramka wejściowa.
- **Sekcja `## Closure`**: 5 pozycji, wszystkie `[ ]`, w tym „Piotr recorded `WAVE_3_OWNER_ACCEPTED` with date and exact SHA”.

### Podsumowanie R5

**8 pozycji blokujących, z tego DUŻE: 3** — pozycja 2 (obowiązki regresji współdzielonej — czyli
całe `G19`), pozycja 5 (izolowana baza i fikstury person — dowód spoza repo już wyparował) oraz
pozycja 6 (60 otwartych P0/P1 plus 13 nieskategoryzowanych pozycji z rejestru D).
ŚREDNIE: 4 (pozycje 1, 3, 4, 8). DROBNE: 1 (pozycja 7).

Kolejność, która odblokowuje najwięcej najmniejszym kosztem:
**3 → 2 → 4 → 5** (zamroź marker, zrób regresję na zamrożonym, dopiero potem promocja i baza).
Pozycje 6, 7 i 8 biegną równolegle i nie zależą od markera: 7 to 16 decyzji właściciela,
8 to jedna operacja właściciela środowiska, 6 to praca produktowa czterech modułów.

---

## Ograniczenia tego pomiaru (co się w nim może mylić)

1. **Zakres „powierzchni współdzielonej” jest zlecony, nie udokumentowany** (G19-Z1). Jeśli program
   uzna za współdzielone także `src/hooks`, `src/lib`, `src/i18n` albo `server/src/services`, liczby
   z R2 wzrosną — ten inwentarz ich nie mierzy.
2. **Osiągalność z grafu importów to nie renderowanie** (D-a4). Komponent może być osiągalny i nigdy
   nie pojawić się na zrzucie w danym stanie danych.
3. **Kotwicą jest `G18`, nie `G07–G13`.** Zlecenie wskazywało `G07–G13`; zmierzyłem, że te wiersze
   cytują jeden wspólny SHA linii grafiki (`316bce9dd9`) dla 15 modułów i żaden dla `16_PARTNER`,
   więc jako mianownik per moduł są bezużyteczne. Zapisuję tę rozbieżność jawnie: **liczby w R2
   liczone od `G18`; gdyby liczyć od `316bce9dd9` dla wszystkich, każdy moduł miałby 49 plików.**
4. **Nie uruchamiałem żadnego testu ani macierzy.** Ten dokument mierzy `git` i treść rejestrów;
   liczby wyników testów (`X/X`) w szablonie R4 są miejscami do wypełnienia, nie deklaracją.
