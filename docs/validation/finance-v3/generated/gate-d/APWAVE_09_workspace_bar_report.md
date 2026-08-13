# APWAVE-09 — Workspace Bar + Focus Mode: domknięcie luk kontraktu

Data: 2026-08-10 · Gałąź: `codex/finance-v3-apwave-ap9-workspacebar` (baza `d3f708f1e7`) ·
Worktree: `~/consultify-wt/apwave-ap9-workspacebar` · Baza danych: NIEUŻYWANA (kontrakty to czysta logika)

## 1. Po co ten dokument

Kontrakt AP-09 (`workspaceBarContract.ts` + `focusModeContract.ts`) istniał i przechodził 31 testów,
ale nie pokrywał kilku wymagań właściciela. Ta fala domyka cztery luki KODEM i nazywa po imieniu
to, czego kodem domknąć się nie da (sekcja 7 — EVIDENCE_MISSING) oraz to, co wymaga decyzji
właściciela (sekcja 8).

**Czego ta fala NIE robi:** nie tworzy komponentu React, nie dotyka `moduleAdapters.ts` (AP-10),
`keyboard/**` (AP-03) ani `lineageNavigatorContract.*` (AP-11 — równoległy agent), nie zmienia
`WORKSPACE_BAR_INLINE_VIEW_LIMIT`, nie rusza migracji ani żywej bazy.

## 2. Pomiary przed / po

| Pomiar | Przed (`d3f708f1e7`) | Po (`2dc1ab180b`) |
|---|---|---|
| `workspaceBarContract.test.ts` | 31 passed | **52 passed** |
| cały katalog `workspace/__tests__/` | 101 passed (3 pliki) | **101 passed (3 pliki)** — sąsiednie pliki nietknięte i nadal zielone |
| `npx tsc --noEmit -p server/tsconfig.json` | exit 0 | **exit 0 — zero nowych błędów** |

Uruchamiane Z KATALOGU `server/` (z roota repo vitest zwraca „No test files found" + exit 1 —
fałszywy sukces, którego tu nie użyto).

> **Pułapka pomiarowa, którą trzeba znać:** `server/tsconfig.json` ma w `exclude` wpis
> `**/*.test.ts`, a vitest kompiluje esbuildem, który typów NIE sprawdza. Czyli `tsc -p
> server/tsconfig.json` **nie sprawdza plików testowych**. Dowód „compile-time" w teście mostu
> focusu (adnotacja `const snapshot: FocusSnapshot = …`) został więc zweryfikowany osobno —
> tymczasowym tsconfigiem, który testy WŁĄCZA: 0 błędów w
> `server/src/services/finance/workspace/`. Jeśli ten dowód ma pilnować regresji w CI, ktoś musi
> dodać typecheck obejmujący testy; dziś taka konfiguracja w repo nie istnieje.

## 3. Luka 1 — aktywny widok nie przeżywał przełączenia Focus Mode ✅ ZAMKNIĘTE

`FOCUS_MODE_PRESERVED_STATE_KEYS` pokrywało 5 z 6 rzeczy: selection, filters, scroll, focus, draft.
Brakowało **aktywnego widoku**. Nie jest to przeoczenie handoffu §11 (on wymienia pięć), tylko
OWN-FIN-004, który mówi tę samą rzecz innymi słowami: *„po aktywacji zostaje tylko Menu 1,
**stan zakładki** i pracy jest zachowany"*. Aktywny widok żyje w
`WorkspaceBarViewNavigation.activeViewId`, NIE w `FinanceWorkspaceState` — więc przenoszenie stanu
„przez referencję" go nie chroniło. Nawigacja zostaje na ekranie (jest w regionach retained), a i tak
mogła po cichu wrócić do widoku #1.

Zmiany (commit `2c25b54b3d`):

- `FOCUS_MODE_PRESERVED_STATE_KEYS` → 6 kluczy, z `'activeView'` i jego źródłem w mapie.
- `FocusModeSession.activeViewId`; `createFocusModeSession(state, { activeViewId })` — **drugi
  argument OPCJONALNY**, więc dotychczasowi wołający kompilują się bez zmian i dostają `null`.
- `enterFocusMode` / `exitFocusMode` przenoszą go dosłownie.
- `assertFocusModePreservation(before, after)` — dowód dla wszystkich 6 kluczy: `workspaceState`
  przez **tożsamość referencji** (kopia strukturalnie równa = coś ją przebudowało/pobrało
  ponownie; głęboka równość by tego nie złapała), `focusedCell` i `activeViewId` przez wartość.
- `focusModeActiveViewId(session, fallback)` — żeby przyszły komponent renderował widok z sesji
  zamiast wyprowadzać domyślny z adaptera (to jest dokładnie ten mechanizm, który resetuje zakładkę).

Testy: kontrola pozytywna (Valuation, widok #3, przetrwał enter+exit) i **dwie negatywne** — reset
widoku ORAZ przebudowany `WorkspaceState` są WYKRYWANE.

## 4. Luka 2 — dwóch właścicieli klawisza Escape ✅ ZAMKNIĘTE (most gotowy do podpięcia)

Było: `ESCAPE_PRECEDENCE`/`resolveEscapeKey` w AP-09 nie wiedziały nic o rejestrze AP-03, a rejestr
odpowiadał na `Escape` wyłącznie w kontekście `cell-editing` (`grid.cancelEdit`). Nic nie wiązało
trybu focus z rejestrem — `registry.resolve('Escape','grid-focused')` zwracało `null`.

Strona AP-09 (commit `d4e49d0939`) jest **czystymi danymi**: identyfikatory komend jako stringi,
zero importów z `keyboard/**`. AP-03 może rejestrować/przemianowywać swoje komendy bez jednej
zmiany w moim kodzie.

### 4.1 Co dokładnie AP-03 (albo przyszły hook klawiatury) ma wywołać

1. **`resolveEscapeCommand(ctx)` — NAJPIERW**, zanim ktokolwiek dotknie rejestru.
   `ctx: { modalOpen, commandPaletteOpen, popoverOpen, cellEditing, focusModeActive }`.
2. Jeśli `resolution.dispatchViaKeyboardRegistry === false` → **rejestr nie widzi tego Escape**;
   modal/paleta/popover zamyka się sam. (Krótsza forma: `shouldKeyboardRegistryHandleEscape(ctx)`.)
3. Jeśli `true` → `registry.resolve(escapeEvent, resolution.keyboardCommandContext, platform)`
   i asercja, że `command.id === resolution.keyboardCommandId`.
4. Gdy wypadnie `workspace.exitFocusMode` → **wywołać `exitFocusMode(session, { trigger:
   'escape-key' })` z AP-09**, nie reimplementować przejścia stanu. Kto trzyma `FocusModeSession`,
   może zrobić kroki 1–4 jednym wywołaniem: **`handleEscapeKey(session, ctx)`** (`focusModeActive`
   jest czytane z sesji, więc nie da się go rozjechać z rzeczywistością).
5. W teście AP-03: **`verifyEscapeRegistryCoverage(registrations)`** — sprawdza, że rejestr naprawdę
   ma każdą parę `(commandId, context)` obiecaną przez kontrakt. Bierze listę jako ARGUMENT, więc
   AP-09 nadal nie importuje `keyboard/**`.

### 4.2 Tabela własności (`ESCAPE_CONSUMER_BINDINGS`)

| Kolejność | Consumer | Właściciel | `keyboardCommandId` | Konteksty | Rejestr widzi Escape? |
|---|---|---|---|---|---|
| 1 | `modal` | `ui-overlay` | — | — | **NIE** |
| 2 | `command-palette` | `ui-overlay` | — | — | **NIE** |
| 3 | `popover` | `ui-overlay` | — | — | **NIE** |
| 4 | `cell-editing` | `AP-03-keyboard` | `grid.cancelEdit` | `cell-editing` | TAK |
| 5 | `focus-mode` | `AP-09-focus-mode` | `workspace.exitFocusMode` | `grid-focused` | TAK |

Identyfikatory w `FINANCE_FOCUS_MODE_COMMAND_IDS` **zgadzają się z tym, co AP-03 już wypuścił**
(`workspace.exitFocusMode` na `Escape`/`grid-focused`, `workspace.toggleFocusMode` na `Mod+Shift+F`
/`global`, `workspace.commandPalette` na `Mod+K`/`global`) — sprawdzone odczytem gałęzi
`codex/finance-v3-apwave-ap3-commands`, bez modyfikowania jej plików.

### 4.3 Otwarta zależność dla AP-03 (nie blokuje)

`workspace.exitFocusMode` jest u AP-03 zarejestrowany **tylko w kontekście `grid-focused`**. Jeśli
w trybie focus fokus klawiatury siedzi poza siatką (np. na przycisku paska), hook zawoła rejestr z
kontekstem `global` i Escape nie wyjdzie z trybu. Do rozważenia przez AP-03: dorejestrowanie tej
komendy również w `global`. Kontrakt AP-09 wymaga dziś dokładnie tego, co AP-03 dowiózł
(`['grid-focused']`), żeby po scaleniu `verifyEscapeRegistryCoverage` było zielone; podniesienie
wymagania to zmiana jednej tablicy w `ESCAPE_CONSUMER_BINDINGS`.

Uwaga o pomiarze: w TYM drzewie komendy workspace AP-03 jeszcze nie ma (jest na jego gałęzi), więc
test „coverage" mierzy **prawdziwy** `FINANCE_KEYBOARD_COMMANDS` i asertuje dokładnie tę jedną
brakującą pozycję zamiast przechodzić na pusto. Po scaleniu gałęzi AP-03 ta sama asercja przechodzi
drugą gałęzią (`ok: true`).

## 5. Luka 3 — dwa niepowiązane modele focusu ✅ ZAMKNIĘTE obustronnie

AP-03 zdążył zbudować SWOJĄ połowę mostu (na swojej gałęzi: `focusSnapshotFromFocusModeSession`,
`focusRestorePatchFromFocusModeEffects`, nowy powód `'focusModeExit'`), importując strukturalnie
typy AP-09. Moja strona (commit `28a9bc2fde`) dokłada:

- **`FOCUS_MODEL_BRIDGE_SURFACE`** — spis członków, które AP-03 czyta
  (`FocusModeSession.focusedCell`, `.restoreFocusToControlId`, efekt `move-focus`). Są nośne:
  przemianowanie któregokolwiek psuje pakiet klawiatury. Pola dodawane (jak `activeViewId`) są
  bezpieczne — AP-03 czyta przez `Pick<>`.
- **`focusModeFocusSnapshot(session, reason)`** — generyczne po `reason`, więc wynik jest
  przypisywalny do `FocusSnapshot` AP-03 BEZ importowania jego unii.
- **`focusRestoreReasonForExit(supported)`** — `'focusModeExit'` tam, gdzie AP-03 już go zna,
  inaczej najbliższy istniejący niekolapsujący powód. Most działa i przed, i po scaleniu.
- **`FOCUS_MODE_MUST_NOT_COLLAPSE_SELECTION`** + `focusRestoreTargetOnExit(session)`.
- **`assertFocusModelsAgree(session, snapshot)`** — po `cellRefsEqual` (klucz kanoniczny AP-00), nie
  po referencji; wykrywa i rozjazd komórki, i rozjazd „jedna strona ma null".

Test uruchamia REALNY kontrakt AP-03: `resolveFocusRestorePatch` + `applyFocusRestoreToSelection` na
prawdziwej selekcji wielokomórkowej i dowodzi, że **wyjście z trybu focus nie zwija zaznaczenia** —
inaczej jedna warstwa honorowałaby swój model, cicho łamiąc gwarancję drugiej.

## 6. Luka 4 — „jedna tożsamość dokumentu" poza Focus Mode ✅ REGUŁA JEST, DOWODU WIZUALNEGO BRAK

Ukrywanie nagłówków było regułą TRYBU FOCUS. Na normalnym ekranie — tym, na który skarżył się
OWN-FIN-011 (*„Usunąć duplikaty tytułu i osobny konkurencyjny nagłówek"*; OWN-FIN-005 scalił paski
statusu do paska) — nic nie zabraniało modułowi mieć własnego nagłówka.

Commity `21ca42674e` (reguła) i `2dc1ab180b` (testy):

- `WorkspaceChromeDeclaration` — co moduł renderuje poza paskiem i które elementy tożsamości niesie.
- `DOCUMENT_IDENTITY_REGION = 'workspaceBar'` — jedyny legalny nośnik;
  `FORBIDDEN_NORMAL_MODE_REGIONS = ['financeModuleHeader','financeStatusStrip']` — w ogóle nie wolno
  ich renderować.
- Kody walidatora: `DUPLICATE_DOCUMENT_IDENTITY`, `COMPETING_MODULE_HEADER`,
  `IDENTITY_REGION_NOT_RENDERED` (deklaracja sama sobie przeczy), `BAR_CARRIES_NO_IDENTITY`,
  `MISSING_CHROME_DECLARATION`.
- `validateWorkspaceBarConfig(config, { requireChromeDeclaration })` — **drugi argument opcjonalny**.

**Świadomie słaby domyślny stan, żeby nie ruszać AP-10:** pole `chrome` jest opcjonalne, a brak
deklaracji liczy się jako zgodny. Inaczej pięć adapterów (poza zakresem tej fali) przestałoby
przechodzić walidację. `requireChromeDeclaration` to przełącznik, który AP-10 włącza, gdy adaptery
zaczną deklarować. **Zaznaczam wprost: to waliduje DEKLARACJĘ, nie wyrenderowaną stronę** — patrz
EVIDENCE_MISSING poniżej.

## 7. EVIDENCE_MISSING — czego ta fala NIE udowodniła

| # | Czego brakuje | Dlaczego kontrakt tego nie zamyka | Co by to zamknęło |
|---|---|---|---|
| EM-1 | **Dowód wizualny braku powielonych nagłówków.** | Pięć komponentów `src/components/finance/Financial*Workspace.tsx` nie zna kontraktu AP-09 i nie deklaruje `chrome`. Zielony walidator mówi tylko, że *deklaracje* są legalne. | Zrzut ekranu każdego z 5 workspace'ów przy 1280 px (CLAUDE.md reguła 7: zrzut robi wykonawca, PRZED Piotrem) + adaptery/komponenty faktycznie deklarujące `chrome`. |
| EM-2 | **Rename bez persystencji.** `validateWorkspaceName` robi walidację; **zapisu, readbacku i historii nie ma** — `workspaceBarContract.ts` mówi wprost, że to zadanie „przyszłego route'u", który NIE ISTNIEJE. OWN-FIN-011 wymaga wszystkich czterech. | Route i tabela historii to backend poza falą kontraktową. | `PATCH /api/v8/finance-v2/artifacts/:id/name` z walidacją, zapisem, odczytem zwrotnym i wpisem do historii + test na realnym Postgresie. Dziś wymóg „edytowalna nazwa" jest spełniony **częściowo**. |
| EM-3 | **Brak dowodu runtime dla „przełączenie nie refetchuje".** Dowodzę tego tożsamością referencji w czystej logice; żaden prawdziwy komponent nie został zmierzony (nie istnieje). | Nie ma warstwy React; nie ma czego podsłuchać w sieci. | Licznik żądań (`read_network_requests` / spy na kliencie API) pokazujący 0 wywołań przy wejściu i wyjściu z trybu focus na realnym ekranie. |
| EM-4 | **Brak dowodu „pełna praca od 1024 px".** `classifyViewport` mówi, że ≥1024 to desktop; że da się tam realnie pracować — nikt nie sprawdził. Test layoutu 1280 px to **heurystyka szerokości**, nie renderowanie (tak zresztą opisuje sam siebie w kodzie). | Kontrakty nie renderują. | Zrzuty 1024/1280/1440/1920 + próba edycji z klawiatury na każdym. |
| EM-5 | **Most Escape nie jest jeszcze spięty end-to-end w JEDNYM drzewie.** Moja strona jest gotowa i przetestowana; komendy workspace AP-03 siedzą na jego gałęzi. | Rozdzielone gałęzie. | Scalenie AP-03 + AP-09 i zielone `verifyEscapeRegistryCoverage` gałęzią `ok: true` (test już to obsługuje). |
| EM-6 | **Zero dowodu, że którykolwiek moduł faktycznie WOŁA ten kontrakt.** `validateWorkspaceBarConfig` jest wołany dziś wyłącznie z testów. | Warstwa UI nie istnieje. | Realny caller w `src/` przechodzący walidację przy montowaniu workspace'u. |

## 8. Pytania do właściciela (NIE rozstrzygam ich sam)

### P-1. Limit widoków w pasku — sprzeczność dokumentów

`WORKSPACE_BAR_INLINE_VIEW_LIMIT = 2` (dosłowne czytanie addendum §7: *„view navigation: w pasku dla
dwóch widoków, osobna kompaktowa linia przy większej liczbie kroków"*) wypycha Statements (3 widoki)
i Valuation (7) do osobnego rzędu. Kłóci się to z handoffem §5, który nazywa P&L/BS/CF *„główne
widoki"*, a §11 stawia „główne views" w środku paska. Poprzedni autor eskalował i nie rozstrzygnął.
**Stałej nie zmieniałem.**

| Wariant | Co daje | Co kosztuje |
|---|---|---|
| **A. Zostaje 2** (stan dzisiejszy) | Pasek zawsze wąski; nazwa dostaje najwięcej miejsca — dziś tylko Statements i Valuation mieszczą pełne 60 znaków nazwy przy 1280 px, właśnie dlatego, że mają nawigację w osobnym rzędzie. | Statements ma trzy główne widoki poza paskiem — wizualnie zaprzecza §5. Każdy moduł z 3 widokami dostaje drugi rząd. |
| **B. Podniesienie do 3** | P&L/BS/CF wracają do środka paska, zgodnie z §5. | **Rusza AP-10, który jest poza zakresem tej fali**: `moduleAdapters.ts` wyprowadza placement z tej stałej, reguła `STEPPER_WITHOUT_SEPARATE_ROW` zacznie failować dla valuation, a asercja layoutu (`fullNameFits === ['statements','valuation']`) odwróci się — Statements straci miejsce na nazwę na rzecz trzech zakładek. Do zrobienia jako osobny krok razem z AP-10. |

### P-2. `mobile: read: false` — możliwe przekroczenie zakresu

Handoff §11 mówi: *„mobile: edycja/mutacje/compute/review wyłączone fail-closed; jasny
DesktopRequired"* — **o czytaniu nie mówi nic**, a tablet jest wprost opisany jako „read-only". Nasz
kontrakt (`FINANCE_VIEWPORT_CAPABILITIES.mobile`) blokuje dodatkowo **odczyt**. To jest twardsze niż
wymóg. **Nie zmieniałem tego bez decyzji.** Gdyby ustawić `read: true`: telefon pokazywałby wartości
i komentarze (czyli „zerknąć w liczbę na spotkaniu"), a `edit`/`compute`/`review`/`focusMode` i tak
zostają wyłączone fail-closed; koszt to konieczność zaprojektowania czytelnego widoku mobilnego
tabel finansowych, którego dziś nie ma — i to jest prawdopodobnie prawdziwy powód, dla którego
poprzedni autor wybrał „nie". Decyzja: zostawiamy `read: false` (świadomie twardziej niż wymóg) czy
otwieramy odczyt?

## 9. Ograniczenia respektowane w tej fali

- **AP-10 nietknięty**: każda zmiana typów jest ADDYTYWNA i OPCJONALNA (`chrome?`, drugi argument
  `validateWorkspaceBarConfig`, drugi argument `createFocusModeSession`), więc pięć adapterów
  kompiluje się i waliduje bez zmian. `moduleAdapters.test.ts` przechodzi nietknięty.
- **`keyboard/**` nietknięty** — most wyłącznie po stringach.
- **`lineageNavigatorContract.*` nietknięty** (równoległy agent AP-11).
- **`WORKSPACE_BAR_INLINE_VIEW_LIMIT` niezmieniony.**
- Zero pushy, zero migracji, zero połączeń z żywą bazą.

## 10. Commity

| SHA | Zakres |
|---|---|
| `2c25b54b3d` | Luka 1 — aktywny widok w stanie zachowywanym + `assertFocusModePreservation` + testy |
| `d4e49d0939` | Luka 2 — most Escape (`resolveEscapeCommand`, `handleEscapeKey`, `verifyEscapeRegistryCoverage`) + testy |
| `28a9bc2fde` | Luka 3 — kontrakt zgodności modeli focusu + testy przeciwko realnemu AP-03 |
| `21ca42674e` | Luka 4 — reguła „jedna tożsamość dokumentu" w walidatorze |
| `2dc1ab180b` | Luka 4 — testy (kontrola pozytywna i negatywna) |
</content>
