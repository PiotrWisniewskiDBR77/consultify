# My Work — prawe panele (Inspektor · Szyna Notatnika) + Sejf: dowody 2026-08-26

Runtime widziany na tych zrzutach (złota reguła #1 CLAUDE.md — zapisać dokładny SHA/port/flagę):

- **Worktree budowlany:** `/private/tmp/consultify-panels-build`
- **Branch:** `codex/mywork-panels-build-20260826`
- **SHA rodzica (bazowego):** `93bd5646b3` (`codex/m03-admin-20260824`)
- **Commit tej partii:** patrz `git log -1` na tym branchu — plik wchodzi w tym samym
  commicie co kod (chicken-egg: log opisuje commit, który go dodaje).
- **Serwer:** `dev-render` harness (CLAUDE.md #7 — Piotr nigdy nie jest pierwszym
  testerem), `npx vite --config dev-render/vite.config.ts --port 4550`, bez logowania,
  bez backendu/bazy — komponenty produkcyjne montowane z mockowanymi propsami/`Api.*`.
- **Flagi:** `ff_ideaInspectorRightRail` pozostaje **OFF domyślnie** w kodzie produkcyjnym
  (`src/utils/ideaInspectorRightRailFlag.ts` niezmieniony) — zrzuty inspektora renderują
  komponent bezpośrednio (bez przełącznika), więc nie wymagają włączenia flagi w aplikacji.
  Szyna Notatnika i Sejf nie są za osobną flagą wizualną (istniejące, zawsze-aktywne
  powierzchnie — zmieniony tylko wygląd/zachowanie w miejscu).
- **Motywy:** każdy ekran zrzucony light + dark (`?theme=light|dark`).
- **Język:** `?lang=pl` (polski, zgodnie z „komunikacja PO POLSKU").

## 1 · Inspektor elementu Idea (DEC-68, `ff_ideaInspectorRightRail`)

Plik: `src/components/MyWork/panel/IdeaElementInspector.tsx`.
Dev-render: `dev-render/screens/mywork-idea-inspector-lekki.tsx` (`?screen=mywork-idea-inspector-lekki`).

| Zrzut | Opis |
| --- | --- |
| `01-inspector-light.png` | Pełny inspektor, motyw jasny — nagłówek bez ramki, quick actions tekstowe (Drąż w głąb/AI podsumuj/AI porada), 7 sekcji accordion (Podstawowe 3 · Treść i głębia 5 · Klasyfikacja 3 · Dowody i źródła 2 · Powiązania 2 · Artefakty wyjściowe 1 · Wygląd węzła), pola typograficzne (etykieta 104px muted + wartość), priorytet z widoczną liczbą „— 70", stopka z rodowodem. |
| `02-inspector-dark.png` | Ten sam stan, motyw ciemny — tokeny `c-*`, zero crimson, kontrast czytelny. |

### Parytet vs prototyp (`mywork-inspektor-prototyp.html`)

| Element prototypu | Stan w komponencie | Zgodność |
| --- | --- | --- |
| Szerokość 360px | `style={{width:360,minWidth:360}}` | ✅ 1:1 |
| Zero obwódek wokół sekcji (tylko hairline `border-t`) | `InspectorSection` — `border-t border-c-border-subtle first:border-t-0`, brak `border`/box na sekcji | ✅ 1:1 |
| Nagłówek sekcji = L1 uppercase + chevron, h-11 | `CountHeading` (11px uppercase tracking-wider) + `ChevronDown` w klikalnym wierszu `h-11` | ✅ 1:1 |
| Pole = label 104px muted + wartość, bez tabeli w ramkach | `FieldRow` (`w-[104px]` label + wartość) | ✅ 1:1 |
| Kontrolka „cicha" — ramka dopiero hover/focus | `quietControlClass` (`border-transparent` → `hover:border-c-border-subtle` → `focus:border-c-border`) | ✅ 1:1 |
| Priorytet z widoczną liczbą | `FieldRow label="Priorytet — {{n}}"` (FIX-17, już wcześniej zrobione — zachowane) | ✅ zachowane |
| Właściciel edytowalny (Table/Mindmap) / typograficzny (Process/Whiteboard) | zachowane 1:1 z poprzedniej wersji (FIX-17) | ✅ zachowane |
| Quick actions bez ramek | `text-c-text-secondary`, `disabled:opacity-40`, zero `border` | ✅ 1:1 |
| Przycisk zamknięcia (X) w nagłówku | dodany, warunkowy na `onReturnToCanvas` | ✅ nowe, zgodne z prototypem |
| 7 sekcji (nie redukowane do 6) | zachowane — DEC-68 nie rozstrzygnął redukcji, STOP z dnia 3 (parytet RowDetailPanel) blokuje decyzję | ⚠️ świadomie zachowane, patrz §3 |

## 2 · Szyna prawa Notatnika w kanonie SPEC-A (DEC-69)

Plik: `src/components/MyWork/notebook/NotebookRightRail.tsx` (+ `NotebookContextPanel.tsx`
nowy prop `embedded`). Dev-render: `dev-render/screens/mywork-notebook-rail-speca.tsx`
(`?screen=mywork-notebook-rail-speca`).

| Zrzut | Opis |
| --- | --- |
| `03-notebook-rail-light.png` | Góra szyny, motyw jasny — nagłówek 44px (tytuł + X), sekcje Akcje (otwarta) i Właściwości (otwarta, początek). |
| `04-notebook-rail-dark.png` | Ten sam stan, motyw ciemny. |
| `07-notebook-rail-comments-history.png` | Wszystkie 5 sekcji rozwinięte, motyw jasny — Akcje · Właściwości (pełna) · Powiązania (Inicjatywy/Zadania/Decyzje) · Komentarze (pusty stan) · Historia i AI (podpowiedź + „Otwórz Teresę"). |
| `08-notebook-rail-comments-history-dark.png` | Te same rozwinięte sekcje, motyw ciemny. |

### Parytet vs prototyp (`mywork-notatnik-szyna-prototyp.html`)

| Element prototypu | Stan w komponencie | Zgodność |
| --- | --- | --- |
| 360px szerokość | `style={{width:360,minWidth:360}}` | ✅ 1:1 |
| 5 sekcji accordion: Akcje·Właściwości·Powiązania·Komentarze·Historia | `RAIL_SECTION_ORDER = ['actions','properties','relations','comments','history']`, renderowane w tej kolejności | ✅ 1:1 |
| Zniknięcie zakładek Work/Context (tablist) | usunięte `role="tablist"`/`role="tab"` — potwierdzone przez `NotebookRightRail.ownerContract.test.ts` | ✅ 1:1 |
| Work → Właściwości, Context → Powiązania | treść 1:1 przeniesiona (save status/owner/visibility/verification/review/tags/modified/source), `NotebookContextPanel` osadzony `embedded` w Powiązaniach | ✅ 1:1 |
| Akcje: Eksportuj/Udostępnij/Kopiuj link/Historia wersji | `ActionRow` × 4, **te same handlery co kebab** (`onExport`/`onShare`/`onToggleVersionHistory` przekazane z `NotebookContent.tsx` — `setNotebookExportOpen`/`handleShareEmail`/`setShowVersionHistory`, MYW-NBK-CORE-002 „same action registry as kebab") | ✅ 1:1, rejestr wspólny |
| Kopiuj link — brak realnej funkcjonalności w kodzie | disabled + `title` z powodem (wzór FIX-2) zamiast martwego onClick | ✅ uczciwie oznaczone |
| Komentarze — nowa sekcja | pusty stan „Brak komentarzy do tego dokumentu." (brak systemu komentarzy dla notatek — poza zakresem tej partii) | ⚠️ świadomy placeholder, patrz §3 |
| Historia i AI | link do „Historia wersji" (Akcje) + „Otwórz Teresę" (`onOpenAIChat`) | ✅ funkcjonalne, bez re-implementacji timeline |
| 2-kontrolkowy górny róg (rail toggle + kebab) w `NotebookContent.tsx` | niezmienione — MYW-NBK-006 był już zamknięty (FIX-6), nie dotyczy tej partii | ✅ nietknięte |
| Humanizacja statusów w Kontekst (`In_progress` → „W trakcie") | już zamknięte przed tą partią (`NotebookContextPanel.statusHumanize.test.tsx` PASS) | ✅ zweryfikowane, bez regresji |

## 3 · Sejf (Client Vault) — MYW-CV-REC-003

Plik: `src/views/vault/VaultDocumentsView.tsx` (+ `deleteVaultDocumentsWithReceipts.ts`
nowy `applyVaultBulkActionWithReceipts`). Dev-render: istniejący
`dev-render/screens/vault-sejf-wnetrze.tsx` (`?screen=vault-sejf-wnetrze`) — bez zmian w
harnessie, tylko nowe zachowanie realnego komponentu.

| Zrzut | Opis |
| --- | --- |
| `09-vault-bulk-select-light.png` | 2 dokumenty zaznaczone — listwa dynamiczna: „Zaznaczono: 2" / Wyczyść / **Dodaj do wiedzy AI** (nowe) / Usuń. |
| `10-vault-bulk-receipts-light.png` | Po kliknięciu „Dodaj do wiedzy AI" — panel kwitów per element („Dodawanie do wiedzy AI · 2 element(y)", każdy dokument z ✓ „Gotowe") + toast zbiorczy. |
| `11-vault-bulk-receipts-dark.png` | Listwa zbiorcza w motywie ciemnym (Usuń = czerwień semantyczna, nie dekoracyjna). Kwit usuwania nie złapany na tym zrzucie — `window.confirm()` natywny dialog jest auto-odrzucany przez headless Playwright bez rejestracji handlera; ta sama ścieżka kodu (`applyVaultBulkActionWithReceipts`) jest jednak identyczna dla Delete i Add-to-AI i pokryta testem `renders one honest per-document receipt after a partial-failure bulk delete`. |

### Parytet vs prototyp (`mywork-sejf-prototyp.html`) — MYW-CV-REC-003

| Element prototypu | Stan w komponencie | Zgodność |
| --- | --- | --- |
| Druga akcja zbiorcza obok Delete („Dodaj do wiedzy AI") | `addDocumentsToAiKnowledge()` → `Api.updateKnowledgeDocument(id, {ai_visibility:'allowed'})` per element | ✅ 1:1 |
| „Każda akcja zbiorcza zwraca kwit per element" | `applyVaultBulkActionWithReceipts` (Promise.all + try/catch per id), UI `bulkReceipts` panel | ✅ 1:1 |
| Kwitki bulk per element (`.receipts`/`.rrow`) | `data-testid="vault-bulk-receipts"` — ikona ✓/✗ + nazwa pliku + status/powód, dismissible (X) | ✅ 1:1 |
| Pozostałe atomy MYW-CV-REC-001/002/004/005/006/008 | już `ZROBIONE_W_KODZIE` przed tą partią (audyt `MYWORK_PANELS_VAULT_SPEC_2026-08-25.md` §3.1) | ✅ zweryfikowane, bez regresji (testy PASS) |
| „Mój sejf"/„My safe" spójność nazwy | już naprawione przed tą partią (`vaultDocuments.ts:91`, `VaultDocumentsView.safeNameLocalization.test.tsx` PASS) | ✅ zweryfikowane, bez regresji |
| `MYW-CV-REC-007` (opis/brief dokumentu, AI-context toggle) | świadomie POZA zakresem tej partii (wymaga ekstrakcji treści/modelu provenance — `FALA_3_PROTOTYPE_REQUIRED` w audycie źródłowym) | ⛔ nie w zakresie |

## 4 · Testy behawioralne (per plik, nie pełny `vitest`)

| Plik | Wynik |
| --- | --- |
| `src/components/MyWork/panel/__tests__/IdeaElementInspector.behavior.test.tsx` | 5/5 PASS |
| `src/components/MyWork/panel/__tests__/IdeaElementInspector.toolStates.test.tsx` | 4/4 PASS |
| `src/components/MyWork/panel/__tests__/IdeaElementInspector.ownerAndPriority.test.tsx` | 7/7 PASS |
| `src/components/MyWork/notebook/__tests__/NotebookRightRail.behavior.test.tsx` (przepisany na accordion) | 10/10 PASS |
| `src/components/MyWork/notebook/__tests__/NotebookRightRail.ownerContract.test.ts` (przepisany) | 5/5 PASS |
| `src/components/MyWork/notebook/__tests__/notebookCrossSurfaceActionAudit.test.ts` (zaktualizowany rejestr rail) | 4/4 PASS |
| `src/components/MyWork/notebook/__tests__/NotebookContextPanel.statusHumanize.test.tsx` | 1/1 PASS (bez regresji) |
| `tests/components/MyWork/NotebookContent.ux-acceptance.test.tsx` (2 asercje `getByText`→`getAllByText`, realna duplikacja tytułu rail+lista) | 10/10 PASS |
| `tests/components/MyWork/NotebookContent.manual-gate.test.tsx` | 4/4 PASS |
| `src/views/vault/__tests__/VaultDocumentsView.bulkReceipts.test.tsx` (NOWY) | 4/4 PASS |
| `src/views/vault/__tests__/VaultDocumentsView.pollingBehavior.test.tsx` | 2/2 PASS (bez regresji) |
| `src/views/vault/__tests__/VaultDocumentsView.safeNameLocalization.test.tsx` | 4/4 PASS (bez regresji) |
| `src/views/vault/__tests__/VaultDocumentsView.openedToolbar.ownerFeedback.test.ts` | 4/4 PASS (bez regresji) |
| `src/views/vault/__tests__/VaultFoldersTable.contract.test.ts` | 4/4 PASS (bez regresji) |
| `src/views/vault/__tests__/deleteVaultDocumentsWithReceipts.test.ts` | 2/2 PASS (bez regresji, teraz deleguje do `applyVaultBulkActionWithReceipts`) |

Razem: **70/70 testów PASS** w plikach dotkniętych tą partią. Uruchamiane per plik
(`npx vitest run <plik>`), zgodnie z zakazem pełnego `vitest` u robotników (CLAUDE.md
§HIGIENA WYKONANIA).

## 5 · Parytet 6 sekcji Inspektora (warunek P0)

**Nie dotyczy tej partii — `RowDetailPanel` nietknięty.** Zadanie explicite zabraniało
usuwania starego panelu dopóki parytet 6 zakładek nie ma projektu/decyzji właściciela
(STOP `f864a060f0`, dzień 3). Ta partia dotyka WYŁĄCZNIE stylu/struktury
`IdeaElementInspector.tsx` (flaga `ff_ideaInspectorRightRail`, default OFF) — nie
usuwa, nie zmienia i nie dotyka `RowDetailPanel`, więc P0 pozostaje w tym samym
stanie co przed partią: **STOP niewykonalny do zamknięcia w tym zakresie, świadomie
zostawiony nienaruszony** (zgodnie z instrukcją „opisz zamiast łamać").
Weryfikacja: `git diff --stat` tej partii nie zawiera `RowDetailPanel.tsx`; kontrakt
`ideaInspectorRailPanelGuard.contract.test.ts` (mutual-exclusivity rail↔legacy panels)
PASS bez zmian.

## 6 · SHA / port / flaga widziane na tych zrzutach

| Pole | Wartość |
| --- | --- |
| Data | 2026-08-26 |
| Worktree | `/private/tmp/consultify-panels-build` |
| Branch | `codex/mywork-panels-build-20260826` |
| SHA (rodzic) | `93bd5646b3` |
| Port dev-render | `4550` |
| Flaga `ff_ideaInspectorRightRail` w kodzie produkcyjnym | **OFF domyślnie** (niezmienione) |
| Widziane przez | zrzuty automatyczne (`dev-render/shot.mjs`, Playwright headless) + weryfikacja wzrokowa Claude Browser przed zapisem PNG (CLAUDE.md #7 — Piotr nie jest pierwszym testerem) |
