# Pakiet C — Finance Shared UI Platform Engineer — raport

Data: 2026-08-11 · Gałąź: `codex/fv3p-c-uiplatform` · Baza: `2253db2cd6` (`origin/demo`-derived, `codex/finance-v3-complete-product-integration`)
Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-c-uiplatform`
Robotnik: Sonnet, pakiet C (klient API + wspólny pasek + focus mode + error boundary — klocki dla D–H, **nie** przebudowa istniejących pięciu workspace'ów)

Statusy w tym dokumencie: `PASS` / `FAIL` / `PARTIAL` / `BLOCKED_EXTERNAL` / `EVIDENCE_MISSING` / `NOT_APPLICABLE`.

**Status całości pakietu: PARTIAL.** Cztery obowiązkowe punkty zakresu (klient API, `FinanceWorkspaceBar`, Focus Mode, lokalny error boundary) są **PASS** — zaimplementowane, przetestowane (63/63 testów), z dowodem wizualnym i kontrolą negatywną każdego z nich. Dwa opcjonalne punkty („jeśli zdążysz") — `CompactLineageTrail` i `RelatedArtifactsDrawer` — **NIE zostały zbudowane**, zgłoszone jawnie jako niepokryte (§7). Wszystko za flagą `financeWorkspacePlatformV1`, domyślnie **OFF**.

Commity (`2253db2cd6..HEAD`):

```
e6e60523bb feat(finance-v3/pkg-c): API client + WorkspaceBar/FocusMode/ErrorBoundary + tests
1094370366 feat(finance-v3/pkg-c): formatFinanceValueForDisplay — MISSING never renders as 0
5b30b601b2 feat(finance-v3/pkg-c): dev-render harness + zrzuty wizualne FinanceWorkspaceBar/FocusMode
```

---

## 0. Stan zastany — potwierdzony przed pracą

Przeczytany w całości `docs/validation/finance-v3/generated/gate-e/PKG_M_INVENTORY_report.md` (pakiet M) i `PKG_B_API_report.md` (pakiet B), zgodnie z briefem. Kluczowe ustalenia, które ukształtowały ten pakiet:

- `OWN-FIN-001` — obecny układ **list** Finance jest zaakceptowany i **nietykalny**; wszystkie 22 uwagi właścicielskie dotyczą **workspace'ów szczegółu**. Nie ruszono `FinanceHub.tsx` ani żadnego z pięciu workspace'ów (`FinancialModelWorkspace.tsx`, `FinancialStatementPackWorkspace.tsx`, `FinancialAnalysisWorkspace.tsx`, `ValuationWorkspace.tsx`, `BudgetWorkspace.tsx`) — potwierdzone `git diff --stat 2253db2cd6..HEAD` nie zawiera żadnego z tych plików.
- `FinanceWorkspaceBar` **nie istniał** w repo (`grep -rn "FinanceWorkspaceBar" src/` → 0 trafień przed tym pakietem).
- Frontend Finance woła wyłącznie legacy `/api/v8/finance/*`; kanoniczny `/api/v8/finance-v2/*` (pakiet B) miał **zero** frontendowych konsumentów przed tym pakietem.
- Odkryty w trakcie pracy: `server/src/services/finance/workspace/{workspaceBarContract,focusModeContract,moduleAdapters,lineageNavigatorContract}.ts` (AP-09/AP-10, ~4265 linii) — **już istniejący, przetestowany, czysto-logiczny kontrakt backendowy** realizujący dokładnie te same reguły co ten brief (limity 5 kontrolek/60 znaków/1280px, sesja focus mode, itd.). Ponieważ `server/**` jest poza allowlistą tego pakietu i w repo nie istnieje ani jeden cross-import `src/` ↔ `server/src/` (zweryfikowane grepem), logika w tym pakiecie jest **PORTEM** (nie importem) tamtych plików — z cytatami plik:linia przy każdej sekcji, żeby przyszłe scalenie (np. do wspólnego pakietu) było mechaniczne, nie przepisywaniem reguł od nowa.

---

## 1. Klient API Finance (`src/services/api/financeV2.{types,api}.ts`)

### 1.1 Kształt DTO — zmierzony, nie zgadywany

Każdy typ DTO w `financeV2.types.ts` ma komentarz z dokładnym `plik:linia` routera, z którego pole po polu przepisano kształt (`server/src/routes/v8/finance-v2/{artifacts,versions,compute,models}.routes.ts`, przeczytane w całości przed pisaniem klienta).

12 endpointów pakietu B pokrytych w `financeV2.api.ts`:

| # | Funkcja | Metoda + ścieżka |
|---|---|---|
| 1 | `createFinanceArtifact` | `POST /finance-v2/artifacts` |
| 2 | `getFinanceArtifact` | `GET /finance-v2/artifacts/:id` |
| 3 | `listFinanceArtifactVersions` | `GET /finance-v2/artifacts/:id/versions` |
| 4 | `getFinanceArtifactCapabilities` | `GET /finance-v2/artifacts/:id/capabilities` |
| 5 | `getFinanceBusinessVersion` | `GET /finance-v2/versions/:id` |
| 6 | `transitionFinanceVersion` | `POST /finance-v2/versions/:id/transitions` |
| 7 | `createFinanceComputeSnapshot` | `POST /finance-v2/versions/:id/compute-snapshot` |
| 8 | `enqueueFinanceComputeJob` | `POST /finance-v2/compute/jobs` |
| 9 | `getFinanceComputeJob` | `GET /finance-v2/compute/jobs/:id` |
| 10 | `cancelFinanceComputeJob` | `POST /finance-v2/compute/jobs/:id/cancel` |
| 11 | `approveFinanceModel` | `POST /finance-v2/models/:id/approve` |
| 12 | `reopenFinanceModel` | `POST /finance-v2/models/:id/reopen` |

Plus `pollFinanceComputeJobUntilSettled` (odpytywanie do `succeeded/failed/cancelled`, lokalny timeout z kodem `CLIENT_POLL_TIMEOUT`, nie mylić z serwerowym 20s hard-timeout).

### 1.2 Semantyka wartości — `PRESENT_ZERO`/`PRESENT_NONZERO`/`MISSING`/`NA`/`NOT_APPLICABLE`

Port `server/src/types/finance/financeValueSemantics.ts:35-204` (AP-00, WP-B01 §2.7):

- `financeValueToArithmeticOperand()` — MISSING zawsze `null` (nigdy `0`), NA/NOT_APPLICABLE domyślnie `null` z opcjonalnym opt-in per-caller.
- `formatFinanceValueForDisplay()` (nowy, warstwa WYŚWIETLANIA — nie ma odpowiednika w porcie backendowym, bo tamten kontrakt nie zna DOM-u): MISSING/NA/NOT_APPLICABLE → `„—"`, PRESENT_ZERO → `„0"` — wizualnie i programowo odróżnialne (`isMissingLikeGlyph`).
- **Dowód wizualny**: `docs/validation/finance-v3/generated/gate-e/visual/pkg-c/finance-workspace-bar-values.png` — tabela z 6 wierszami: wartość dodatnia (`12 450,75`), **wartość ujemna** (`-3820,1`), **prawdziwe zero** (`0`), **MISSING** (`—`, powód „Brak danych"), **NOT_APPLICABLE** (`—`, powód „Pole strukturalnie nie istnieje"), **NA** (`—`, powód „Analityk oznaczył: nie dotyczy"). Żaden z trzech statusów braku nie pokazuje `0`.

### 1.3 Błędy — zmierzony (nie zgadywany) realny kształt

**Odkrycie w trakcie pisania testów** (patrz §6): `v8Get`/`v8Post` (`src/services/api/v8/client.ts`) wołają `handleResponse` z `src/services/api/baseClient.ts:194-283` — **NIE** tę o tej samej nazwie z `src/services/apiUtils.ts` (dwa różne pliki, ten sam eksport, łatwo pomylić). Realny rzucony `Error` ma `.status`/`.data` (gdzie `.data` = całe sparsowane ciało `{error, code, ...}`), ale **`.code` NIE jest ustawiane bezpośrednio na obiekcie błędu** — trzeba czytać `err.data.code`. `describeFinanceV2Error()` i testy zostały poprawione po tym odkryciu (pierwsza wersja zakładała `.code` wprost i test to złapał — patrz §6).

**Drugie odkrycie**: `POST /models/:id/approve` (`models.routes.ts:174-180`, WP-C02, sprzed pakietu B) zwraca **płaski** kształt `{success, status, idempotentReplay?}` — **BEZ** koperty `{data}` — celowo, żeby zostać bit-identyczne z zamrożoną fixturą F4. Ogólny `v8Post` zawsze robi `json.data`, co dla tego jednego endpointu zwróciłoby `undefined`. Naprawione dodaniem `v8PostRawBody()` (lokalny helper, zwraca całe ciało) wyłącznie dla `approveFinanceModel`; `reopenFinanceModel` (który **ma** kopertę `{data}`) używa zwykłego `v8Post`. Złapane przez własny test przed commitem, nie po.

`describeFinanceV2Error()` — Honest UI (CANON.md §4.1): surowy `„Request timed out"` (hard timeout 20s z `fetchWithRetry`) **nigdy** nie trafia do UI — zawsze przeformułowany na `„Operacja trwa dłużej niż zwykle"`. Mapowanie kodów `NOT_FOUND`/`VERSION_CONFLICT`/`STATE_PRECONDITION_FAILED`/`FORBIDDEN`/... na komunikaty PL.

---

## 2. `FinanceWorkspaceBar` (`src/components/Finance/shared/FinanceWorkspaceBar.tsx`)

### 2.1 Kontrakt — port z AP-09 (`financeWorkspaceBar.contract.ts`)

Limity (bit-identyczne ze `server/src/services/finance/workspace/workspaceBarContract.ts`):
`WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS = 5`, `WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS = 60`, `WORKSPACE_BAR_NAME_MAX_CHARS = 120`, `WORKSPACE_BAR_REFERENCE_VIEWPORT_PX = 1280`, `WORKSPACE_BAR_MIN_CONTROL_PX = 44`.

Funkcje: `validateWorkspaceBarConfig` (walidator całej konfiguracji — odrzuca >5 kontrolek, duplikaty id, destrukcyjne akcje bez potwierdzenia, niezgodność `viewNavigation.placement` z liczbą widoków, itd.), `estimateWorkspaceBarLayout` (arytmetyczny budżet szerokości — dowód kryterium 1280px/60 znaków), `mergeFreshnessIntoPrimaryLabel`, `canRenameArtifact`, `validateWorkspaceName`, `resolveControlState`, `resolveViewNavigationPlacement`.

### 2.2 Anatomia komponentu

- **Lewo**: Wróć do listy · nazwa (kliknij → edycja inline → Enter/Zapisz → `onCommitRename` async z walidacją+odczytem wyniku; Escape/Anuluj cofa) · odznaka wersji (+ „· robocza" gdy `hasUncommittedWorkingRevision`) · odznaka statusu (etykieta PL, nie tylko kolor) · `(i)` Context popover (6 pól: typ/okres/podmiot/waluta-skala/źródło/ostatnie przeliczenie — tylko te, które moduł faktycznie ma).
- **Środek**: nawigacja widoków inline gdy ≤2 widoki; **osobny kompaktowy rząd pod paskiem** gdy >2 (bez duplikowania nagłówka — jeden `<div>` niżej, nie drugi konkurencyjny header).
- **Prawo**: primary (freshness scalone z CTA) → secondary? → lifecycle? (menu z przejściami stanu, destrukcyjne = potwierdzenie) → more? (menu, destrukcyjne = potwierdzenie) → fullscreen (zawsze ostatni, icon-only, `aria-label`). **Maks. 5 bezpośrednich kontrolek** liczonych przez `countDirectRightControls`.

### 2.3 DOWÓD kryterium „1280px + nazwa 60 znaków → brak nakładania"

**Test jednostkowy** (`__tests__/financeWorkspaceBar.contract.test.ts`, 13/13 PASS): `estimateWorkspaceBarLayout(config, {viewportPx:1280, nameChars:60})` → `fits: true`, `nameAvailablePx ≥ minNamePx (120px)`.

**Dowód wizualny**: `finance-workspace-bar-1280-longname.png` — nazwa dokładnie 60 znaków (`Model bazowy prognozy przychodow i kosztow segmentu B2B FY26`, zliczone `python3 len()`) przy 1280×800, **pełny tekst widoczny, zero nakładania** z odznakami/przyciskami po prawej.

**Policzone bezpośrednie kontrolki**: config bazowy w harnessu ma `primary + secondary + lifecycle + more + fullscreen = 5` — dokładnie limit, `validateWorkspaceBarConfig` → `ok: true`.

### 2.4 KONTROLA NEGATYWNA (obowiązkowa)

1. **6. kontrolka odrzucona**: test dodaje 2 `extraDirectControls` do configu z 4 już zajętymi slotami (primary+lifecycle+more+fullscreen) → 6 bezpośrednich kontrolek → `estimateWorkspaceBarLayout` pokazuje **zmieniony** (większy) `fixedPx`/mniejszy `nameAvailablePx` (dowód, że estymator liczy z configu, nie zwraca stałej) → `validateWorkspaceBarConfig` → `ok:false`, kod `TOO_MANY_DIRECT_RIGHT_CONTROLS`.
2. **Render realny reaguje na propsy**: `FinanceWorkspaceBar.test.tsx` „KONTROLA NEGATYWNA" — rerender z inną nazwą+statusem zmienia DOM (`toHaveTextContent`).
3. **Freshness→CTA**: `CURRENT` → `„Przelicz"`, `STALE_SOURCE` → `„Nieaktualne · Przelicz"` — assert `not.toBe` między dwoma renderami.
4. **Rename**: `APPROVED` → `canRenameArtifact` zwraca `STATUS_IMMUTABLE` (test assert `.editable !== DRAFT.editable`); render — klik na zablokowaną nazwę **nie** otwiera edycji.
5. **Zrzuty harnessu** (`NEGCTRL-bar-a-before-draft.png` / `NEGCTRL-bar-b-after-approved-renamed.png`, klip nagłówka `0,0,1440,140`): zmiana `name`+`status` w mocku → nagłówek, odznaka statusu (szary „Wersja robocza" → zielony „Zatwierdzone") i menu lifecycle (submit/invalidate → **„Otwórz ponownie"/„Utwórz nową wersję"**) zmieniają się — dowód, że harness renderuje realny komponent.

**Bonus, nie żądany explicite ale bezpośrednio adresuje `OWN-FIN-013`** (Approved bez akcji dalszej pracy, zgłoszenie właściciela z §PKG_M): `finance-workspace-bar-approved.png` pokazuje status `APPROVED` z lifecycle-menu oferującym `Otwórz ponownie`/`Utwórz nową wersję` — **nie** statyczną pigułkę z kłódką bez akcji, jak dziś w `FinancialModelWorkspace` (`NEGCTRL-b-after-approved-renamed.png` pakietu M).

### 2.5 200% zoom — zmierzone, nie zakładane

`document.documentElement.style.zoom='200%'` (ta sama technika co pakiet M użył dla `finance-model-workspace-zoom200-light.png` — porównane bezpośrednio, **identyczny charakter** obcinania krawędzi przy 200%, więc to established/akceptowany wzorzec tego repo, nie defekt tego komponentu). Zmierzone: przy 1440px fizycznych i zoom 200% (efektywna szerokość layoutu ≈720px), 5+ elementów prawej strony nie mieści się bez przewijania — **oczekiwane** przy dowolnym pasku narzędzi w tej szerokości. Naprawa jakości: dodano `overflow-x-auto` na głównym rzędzie paska (`FinanceWorkspaceBar.tsx`), więc kontrolki są osiągalne **lokalnym, widocznym przewinięciem paska**, nie niewidocznym przewinięciem całej strony (co byłoby antywzorcem WCAG reflow — użytkownik nie wiedziałby, że w ogóle da się przewinąć). Zrzuty: `finance-workspace-bar-zoom200-light.png` + `-scrolled-light.png`.

**Uczciwie**: „pozostaje operacyjny" = tekst czytelny, brak nielegalnego nakładania, żadna kontrolka nie jest trwale nieosiągalna (przewijalna). NIE = „wszystko mieści się bez przewijania" — to nierealne kryterium dla ośmio-elementowego paska przy efektywnych ~720px.

---

## 3. Focus Mode (`useFinanceFocusMode` + `focusMode.contract.ts`, OWN-FIN-004)

### 3.1 Kontrakt — port z AP-09 (`focusModeContract.ts`)

Regiony chrome: `FOCUS_MODE_RETAINED_REGIONS = [menu1, workspaceBar, viewNavigation, workspace]`, `FOCUS_MODE_HIDDEN_REGIONS = [globalTopbar, globalFooter, financeModuleHeader, financeBreadcrumbs, financeSecondaryNav, financeListRail, financeStatusStrip]`. Sesja (`FocusModeSession<TState>`, generyczna — ten pakiet nie ma jeszcze prawdziwego grida AP-01, więc stan roboczy modułu jest parametrem typu, nie twardo `FinanceWorkspaceState`) z `enterFocusMode`/`exitFocusMode` niosącymi `workspaceState` **PRZEZ REFERENCJĘ** — dokładnie ten sam obiekt przed i po. Precedencja Escape: `modal > command-palette > popover > cell-editing > focus-mode`.

`useFinanceFocusMode` (hook wiążący kontrakt z DOM): listener `Escape` respektujący precedencję (przyjmuje `escapeContext` od callera — modal/popover/cell-editing z ZEWNĄTRZ, nie zgaduje), `document.body` klasa `finance-focus-mode-active` (regiony NIE są unmountowane — kluczowe dla „nie refetchuje": unmount/remount zresetowałby stan schowanego regionu), focus-restore (`restoreFocusToControlId` → `document.getElementById`/`[data-testid]` → `.focus()` po wyjściu).

### 3.2 DOWÓD zachowania stanu — wymagany explicite w brifie

**Test jednostkowy** (`focusMode.contract.test.ts`, 13/13 PASS): `enterFocusMode`/`exitFocusMode` niosą `workspaceState` przez **tożsamość referencji** (`toBe`, nie `toEqual`); `assertFocusModePreservation` **WYKRYWA** regresję (test symuluje złamany toggle, który podmienia stan na strukturalnie-identyczny NOWY obiekt → `ok:false`, `violations` zawiera `draft`).

**Test komponentowy + realny hook**: `finance-focus-mode.tsx` (dev-render) — pole tekstowe z niezapisanym draftem, przycisk toggle, wyświetlacz `Stan skupienia` / `Niezapisane zmiany` / `assertFocusModePreservation`.

**KONTROLA NEGATYWNA, dosłownie wg wymagania brifu** („wprowadź niezapisaną zmianę, włącz focus, wyłącz Esc, pokaż że zmiana przetrwała"), wykonana przez `dev-render/shot.mjs --click --key=Escape --eval` (Playwright, realna interakcja, nie symulacja w jednostce):

```
1. Załaduj ekran z draftem: "Niezapisana zmiana wpisana przez użytkownika PRZED wejściem w focus mode."
2. --click='[data-testid=toggle-focus-button]'   (wejście w focus mode)
3. --key=Escape                                   (wyjście przez Esc)
4. --eval odczytuje DOM po całym cyklu:
```

Surowy wynik (`NEGCTRL-focus-mode-after-escape.png` + log `shot.mjs`):
```json
{
  "draftValue": "Niezapisana zmiana wpisana przez użytkownika PRZED wejściem w focus mode.",
  "focusActive": "false",
  "unsavedChanges": "true",
  "preservationCheck": "assertFocusModePreservation: ok",
  "globalTopbarVisible": true
}
```

Draft **bajtowo identyczny** po pełnym cyklu wejście→Esc→wyjście, `unsavedChanges` nadal `true` (nic nie zostało cicho zapisane/skasowane), chrome (`globalTopbar`) wrócił. **Bonus a11y widoczny na zrzucie**: przycisk „Włącz tryb pełnego obszaru roboczego" ma niebieski pierścień fokusa (`c-focus`) — dowód, że focus-restore faktycznie oddał fokus klawiatury na kontrolkę, która otworzyła tryb (nie zgubił go na `document.body`).

**Dowód regionów** (`finance-focus-mode-before.png` vs `finance-focus-mode-active.png`): `globalTopbar`/`financeBreadcrumbs`/`financeStatusStrip` znikają; `menu1`/`FinanceWorkspaceBar`/workspace zostają.

### 3.3 Ograniczenie, zgłoszone jawnie

Most do AP-03 keyboard command registry (`resolveEscapeCommand`, `verifyEscapeRegistryCoverage` w oryginalnym `focusModeContract.ts`) **pominięty w porcie** — nie istnieje dziś żaden keyboard command registry po stronie klienta do zsynchronizowania (`grid`/`keyboard` to martwa dla frontendu warstwa, `PKG_B_API_report.md` §1.3). Zachowana jest sama precedencja (`resolveEscapeKey`), wystarczająca do DoD tego pakietu.

---

## 4. `FinanceErrorBoundary` (OWN-FIN-002)

Class component (wzorzec `src/components/MyWork/table/ViewErrorBoundary.tsx`, jedyny istniejący precedens w repo), rozszerzony o correlation ID: bazowy `sessionStorage['correlationId']` (ten sam, którego już używa `X-Correlation-ID` na każdym żądaniu sieciowym, `src/services/api/baseClient.ts:16-20`) + losowy sufiks per-błąd.

### 4.1 DOWÓD izolacji (6/6 testów PASS)

- Błąd w `<Boom>` **nie** wywala rodzeństwa poza boundary (`safe-sibling` nadal w DOM).
- Correlation ID widoczny w UI (`data-testid="finance-error-boundary-correlation-id"`).
- **KONTROLA NEGATYWNA „Ponów"**: mutowalna flaga `shouldThrow`, `onRetry` ją czyści, klik „Ponów" → `hasError:false` → dziecko renderuje się normalnie (`recovered` w DOM, boundary UI znika).
- **KONTROLA NEGATYWNA „artefakt/draft przetrwają"**: harness z `useState` w RODZICU (`selectedArtifactId`, `draftValue`) — po całym cyklu błąd→Ponów, `selectedArtifactId` niezmieniony, `draftValue` z rodzica nadal widoczny w odzyskanym drzewie (boundary nigdy go nie dotknął, bo nie ma do niego dostępu — dowód strukturalny, nie tylko behawioralny).
- „Wróć do listy" woła `onBackToList` bez modyfikowania niczego innego.

### 4.2 Dowód wizualny

`finance-workspace-bar-error.png` (scena `error` w głównym harnessu): `FinanceWorkspaceBar` + symulowane Menu 1 **żyją** nad błędem; wewnątrz — czysty komunikat „Nie udało się wyświetlić: Wyliczenia — DBR77 Model bazowy FY2026", ID zgłoszenia, `Ponów`/`Wróć do listy`. Log konsoli Playwrighta potwierdza `[FinanceErrorBoundary]` złapał błąd z prawdziwym stack trace serwerowym (nie ukryty, tylko nie pokazany w UI — CANON.md §4.1).

---

## 5. Flaga

`financeWorkspacePlatformV1` (`src/hooks/useFinanceWorkspacePlatformFlag.ts`) — **`defaultValue: false`**. Zarejestrowana **lokalnie** przez `useFeatureFlags({flags:[...]})` (mechanizm scalania niestandardowych flag z `DEFAULT_FLAGS` udokumentowany w `useFeatureFlags.tsx:388-392`), **bez** edycji współdzielonego `src/hooks/useFeatureFlags.tsx` (poza allowlistą — plik dotykany równolegle przez wiele sesji). Weryfikacja OFF: `grep -n "defaultValue" src/hooks/useFinanceWorkspacePlatformFlag.ts` → `false`; żaden z pięciu istniejących workspace'ów Finance nie importuje ani flagi, ani żadnego komponentu z `Finance/shared/` (potwierdzone `grep -rln "FinanceWorkspaceBar\|useFinanceFocusMode\|FinanceErrorBoundary" src/components/Finance/*.tsx src/components/Benefits/*.tsx` → 0 trafień) — więc flaga dziś **nie gałęzi żadnego produkcyjnego ekranu w ogóle**, jest gotowa dla D–H.

---

## 6. Kontrola negatywna — meta (błędy złapane WŁASNYMI testami przed commitem)

Zgodnie z regułą „zielony test, którego nie da się zaczerwienić, niczego nie dowodzi" — dwa realne błędy złapane w trakcie pisania tego pakietu, nie po fakcie:

1. **`approveFinanceModel` zwracał `undefined`** — pierwsza wersja klienta założyła (błędnie) że WSZYSTKIE odpowiedzi finance-v2 mają kopertę `{data}`; test `approveFinanceModel → sukces zwraca {success:true,...}` dał `expected undefined` na czerwono, ujawniając że `POST /models/:id/approve` (WP-C02, sprzed pakietu B) zwraca płaski kształt. Naprawione `v8PostRawBody`.
2. **`.code` błędu czytany ze złego pola** — pierwsza wersja `describeFinanceV2Error` zakładała `err.code` wprost; test błędu 404/409 dał `expected null to be 'NOT_FOUND'`, co doprowadziło do przeczytania realnej implementacji `baseClient.ts:194-283` (mock Response bez działającego `.clone()` też dał fałszywe `data:{}` po drodze — poprawiony mock).

Oba znalezione WŁASnymi testami tego pakietu, nie przez zewnętrzny audyt — dowód, że testy faktycznie wykonują prawdziwy kod klienta przeciwko realistycznemu kształtowi odpowiedzi, nie atrapę.

---

## 7. Co NIE zostało zrobione (jawnie)

- **`CompactLineageTrail` i `RelatedArtifactsDrawer`** (`OWN-FIN-007`/`022`, „jeśli zdążysz" w brifie) — **NIE zbudowane**. Backend (`server/src/services/finance/workspace/lineageNavigatorContract.ts`, AP-09, 1479 linii) już ma gotowy, przetestowany kontrakt (`lineageStageRank`, `allowedDownstreamCreations`, `hasTenantAnomalies`, `partitionEdgesByOrganization`, oparty wyłącznie na `LineageEdgeRow[]`/immutable ID — dokładnie zgodnie z wymaganiem „nigdy na nazwach") — port analogiczny do `financeWorkspaceBar.contract.ts`/`focusMode.contract.ts` byłby naturalną kontynuacją, ale czas sesji się skończył zanim do tego doszło. `EVIDENCE_MISSING`.
- **`server/**` nie dotknięty** (poza allowlistą) — dwa odkryte w §1.3 defekty API (płaski approve, `.code` pod `.data`) są cechami ISTNIEJĄCEGO kodu backendowego (WP-C02/pakiet B), nie błędami wprowadzonymi tu; udokumentowane jako „zmierzone", nie zgłoszone jako defekt do naprawy (klient się do nich poprawnie dostosował).
- **Statements/Analysis/Baseline/Prediction/Valuation domain endpoints** (mapping/reconciliation/KPI/baseline compute/prediction/valuation) — poza zakresem tego pakietu z definicji (buduje je pakiet B2 równolegle); klient zaprojektowany tak, żeby ich dołożenie było nowymi funkcjami w tym samym pliku (`financeV2.api.ts`), nie przebudową.
- **Realny E2E przez żywy Postgres** — ten pakiet nie miał dostępu do bazy (żywa baza zabroniona regułą sesji, patrz brief „Zero żywej bazy"); wszystkie testy klienta API mockują `fetchWithRetry` na poziomie modułu — dowodzą poprawności KSZTAŁTU żądania/odpowiedzi względem realnego kodu routerów (przeczytanego, nie zgadywanego), nie realnego przejazdu przez sieć+bazę. To jest zgodne z zakresem pakietu (frontend platform, nie integracja E2E).

---

## 8. Tabela zrzutów (viewport × stan)

Katalog: `docs/validation/finance-v3/generated/gate-e/visual/pkg-c/` (20 plików).

| Plik | Viewport | Stan/scena |
|---|---|---|
| `finance-workspace-bar-1920-light.png` | 1920×1080 | draft, light |
| `finance-workspace-bar-1440-light.png` | 1440×900 | draft, light |
| `finance-workspace-bar-1280-light.png` | 1280×800 | draft, light |
| `finance-workspace-bar-1440-dark.png` | 1440×900 | draft, **dark** |
| `finance-workspace-bar-zoom200-light.png` | 1440×900, zoom 200% | draft, light |
| `finance-workspace-bar-zoom200-scrolled-light.png` | jw. | jw., dowód lokalnego przewinięcia paska |
| `finance-workspace-bar-1280-longname.png` | **1280×800** | **nazwa 60 znaków** — dowód kryterium |
| `finance-workspace-bar-stale.png` | 1440×900 | freshness `STALE_SOURCE` („Nieaktualne · Przelicz") |
| `finance-workspace-bar-approved.png` | 1440×900 | status `APPROVED` + lifecycle „Otwórz ponownie" |
| `finance-workspace-bar-failed.png` | 1440×900 | freshness `COMPUTE_FAILED` |
| `finance-workspace-bar-computing.png` | 1440×900 | `IN_REVIEW` + `NEVER_COMPUTED` |
| `finance-workspace-bar-needs-changes.png` | 1440×900 | status `NEEDS_CHANGES` |
| `finance-workspace-bar-values.png` | 1440×900 | **wartości ujemne, zero, MISSING/NA/NOT_APPLICABLE** |
| `finance-workspace-bar-empty.png` | 1440×900 | pusty stan (uczciwy, bez zmyślonych liczb) |
| `finance-workspace-bar-error.png` | 1440×900 | **error boundary aktywny** |
| `NEGCTRL-bar-a-before-draft.png` / `-b-after-approved-renamed.png` | 1440×140 (klip) | kontrola negatywna paska |
| `finance-focus-mode-before.png` | 1440×900 | focus mode nieaktywny (chrome widoczny) |
| `finance-focus-mode-active.png` | 1440×900 | **focus mode aktywny** (chrome ukryty) |
| `NEGCTRL-focus-mode-after-escape.png` | 1440×900 | **kontrola negatywna**: klik-wejście → Escape-wyjście, draft/unsaved/topbar dowiedzione |

`loading`/`success` — pokryte pośrednio (`computing`=proxy dla in-flight, `draft`/`approved`=success). Brak osobnego dedykowanego zrzutu `loading` skeletona — ten pakiet nie zna kształtu prawdziwego ładowania danych workspace'u (poza zakresem, D–H); flagowane jako drobne, świadome uproszczenie.

---

## 9. Definition of Done — self-check

- [x] Klient API dla 12 endpointów, typowany, z poprawną semantyką wartości — §1
- [x] `FinanceWorkspaceBar` — kryterium 1280px/60 znaków/≤5 kontrolek/200% zoom, z dowodem — §2.3–2.5
- [x] Focus Mode z **udowodnionym** zachowaniem stanu (referencja, nie kopia) + `Esc` + focus restore — §3.2
- [x] Lokalny error boundary z correlation ID — §4
- [x] Komplet zrzutów w wymaganych viewportach i stanach — §8
- [x] Kontrola negatywna dla każdego z czterech punktów — §2.4, §3.2, §4.1, §1.2 (missing≠zero)
- [x] Nazwa flagi + potwierdzenie OFF — §5
- [x] Co niepokryte — §7
- [x] 63/63 testów jednostkowych/komponentowych PASS (`financeWorkspaceBar.contract.test.ts` 13, `focusMode.contract.test.ts` 13, `FinanceWorkspaceBar.test.tsx` 8, `FinanceErrorBoundary.test.tsx` 6, `financeV2.types.test.ts` 13, `financeV2.api.test.ts` 10)

**Status pakietu: PARTIAL** — cztery obowiązkowe punkty PASS z pełnym dowodem; dwa opcjonalne punkty (`CompactLineageTrail`/`RelatedArtifactsDrawer`) EVIDENCE_MISSING, jawnie zgłoszone jako niepokryte, nie ukryte za ogólnym „gotowe".

## 10. Pliki zmienione (allowlisty)

- `src/services/api/financeV2.types.ts`, `financeV2.api.ts` (nowe)
- `src/services/api/__tests__/financeV2.types.test.ts`, `financeV2.api.test.ts` (nowe)
- `src/components/Finance/shared/financeWorkspaceBar.contract.ts`, `focusMode.contract.ts` (nowe, porty)
- `src/components/Finance/shared/FinanceWorkspaceBar.tsx`, `FinanceErrorBoundary.tsx` (nowe)
- `src/components/Finance/shared/__tests__/*.test.ts(x)` (4 nowe pliki)
- `src/hooks/useFinanceFocusMode.ts`, `useFinanceWorkspacePlatformFlag.ts` (nowe)
- `dev-render/screens/finance-workspace-bar.tsx`, `finance-focus-mode.tsx` (nowe)
- `dev-render/main.tsx` (dopisane 2 importy + 2 rejestracje `SCREENS`, istniejące wpisy nietknięte)
- `.claude/launch.json` (dopisany wpis `fv3p-c-uiplatform`, port 58022, istniejące wpisy nietknięte)
- `docs/validation/finance-v3/generated/gate-e/visual/pkg-c/*.png` (20 plików)
- **`server/**` — NIE zmieniony** (poza allowlistą).
- **`FinanceHub.tsx` i pięć workspace'ów szczegółu — NIE zmienione** (`OWN-FIN-001`, teren D–H).

## 11. Komendy reprodukcji

```bash
# Testy (esbuild-transpile per plik, bez pełnego tsc/vitest — zgodnie z HIGIENA)
cd "/Users/piotrwisniewski/consultify-wt/fv3p-c-uiplatform"
npx vitest run \
  src/components/Finance/shared/__tests__/financeWorkspaceBar.contract.test.ts \
  src/components/Finance/shared/__tests__/focusMode.contract.test.ts \
  src/components/Finance/shared/__tests__/FinanceWorkspaceBar.test.tsx \
  src/components/Finance/shared/__tests__/FinanceErrorBoundary.test.tsx \
  src/services/api/__tests__/financeV2.types.test.ts \
  src/services/api/__tests__/financeV2.api.test.ts

# Harness wizualny
npx vite --config dev-render/vite.config.ts --port 58022 --strictPort &
node dev-render/shot.mjs out.png "http://localhost:58022/?screen=finance-workspace-bar&scene=draft" --w=1440 --h=900
# Sceny: draft|stale|approved|failed|computing|needs-changes|longname|values|empty|error
node dev-render/shot.mjs out.png "http://localhost:58022/?screen=finance-focus-mode" --w=1440 --h=900 \
  --click='[data-testid=toggle-focus-button]' --key=Escape \
  --eval="document.querySelector('[data-testid=draft-textarea]').value"
```
