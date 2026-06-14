# Consultify UI/UX — CANON

> **JEDYNY AUTORYTET I JEDYNY FRONT** dla wszystkich decyzji UI/UX.
> Wersja: **v3.0** — konsolidacja 2026-06-14.
> Kto stosuje: każdy dev, każdy agent AI, każde code review.

To jest jedyny dokument, który **ogłasza** standard. Wszystko inne w `docs/ui-standards/` jest albo **warstwą szczegółu** podległą temu kanonowi, albo **archiwum historii** (`_archive/`). Jeśli czegoś tu nie ma — patrz właściwa warstwa (§7). Jeśli nie ma nigdzie — **zapytaj, nie wymyślaj** (§3).

---

## 0. Status i autorytet

Ten kanon zastępuje jako **autorytet** cztery wcześniejsze dokumenty, które rozmazywały prawo po wielu plikach:

| Dokument | Co wnosił | Status |
|---|---|---|
| `README.md` | indeks + „nie wymyślaj standardów" | → rola indeksu przejęta przez §7; pozostaje jako nawigacja pomocnicza |
| `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` | treść produktowo-wizualna | → treść dystrybuowana do warstw `00–03`; **ważna do końca migracji**, oznaczona banerem |
| `CONSULTIFY_UI_UX_OPERATING_STANDARD.md` | governance / kontrakt pracy | → wcielone do §3–§5 i §8 |
| `UI_UX_CANON_V3.md` | legacy v3 (21 reguł MUST) | → kontekst historyczny; brak unikalnej treści ponad warstwy |

**Zasada przejściowa:** dopóki migracja treści do warstw nie jest zakończona (Faza 2), powyższe pliki **pozostają ważne jako szczegół** — ale nawigację i rozstrzyganie konfliktów prowadzimy **wyłącznie przez ten kanon**.

---

## 1. Żelazna zasada

> **Ekrany funkcjonalne nie wymyślają wyglądu. Składają zatwierdzone komponenty Consultify.**
> *Feature screens do not own visual design. Feature screens compose approved components.*

Z tej zasady wynika wszystko poniżej. Nowy „lokalny" wygląd w ekranie funkcjonalnym = `unapproved UI` = kandydat do refactoru, nie standard.

---

## 2. Hierarchia prawdy (rozstrzyganie konfliktów)

Gdy dokumenty/kod są sprzeczne, obowiązuje kolejność:

1. **`CANON.md`** (ten plik) — najwyższy autorytet.
2. **Warstwy szczegółu** — `00-foundation` → `01-shell-layout` → `02-components` → `03-modules`. Doprecyzowują kanon, nie nadpisują go.
3. **Kod SSOT** — pliki implementacji wymienione w §6. Egzekwują reguły w runtime.
4. **Implementacje referencyjne** — ekrany jawnie wskazane jako wzorzec w docs.
5. **`_archive/`** — kontekst historyczny (plany, audyty, evidence, superseded). **NIGDY autorytet.**

> **Reguła rozstrzygania:** jeśli kod robi Y, a standard mówi X — to kod jest kandydatem do refactoru. **Nie tworzymy trzeciego wariantu.**

---

## 3. Governance — protokół zmiany standardu

Standard ewoluuje **świadomie**, nigdy przez improwizację.

### 3.1 Procedura nowego komponentu/wzorca
Gdy zatwierdzone komponenty nie pasują:
1. **Nie** buduj lokalnego UI w ekranie jako finalnego rozwiązania.
2. Opisz problem: czego brakuje, w jakich ekranach, jaki workflow tego wymaga.
3. Zaproponuj zakres: rozszerzenie komponentu / nowy primitive / nowy composed / nowy shell / jednorazowy wyjątek migracyjny.
4. **Dopisz regułę do właściwej warstwy** (`00–03`). Nie zakładaj konkurencyjnego pliku-autorytetu.
5. Dopiero po decyzji użyj komponentu w ekranie.

### 3.2 Protokół zmiany (MUST)
- Zmiana standardu = edycja właściwej warstwy **+ wpis w changelogu** (§9). Bez tworzenia „vN".
- **Luka** w standardzie = oznaczona jawnie w dokumencie (`świadoma luka`), nie wypełniana nowym samowolnym plikiem.
- **Integralność referencji:** przed usunięciem/przeniesieniem JAKIEGOKOLWIEK pliku — `grep -rl` grafu referencji (FROZEN_LAYOUTS, READMEs, kanony). Zero martwych linków.

### 3.3 Proces review / approval
Każda migracja ekranu/komponentu: (1) opisz obecny stan, (2) porównaj z kanonem, (3) decyzja: approved / approved-with-correction / rejected / needs-new-standard, (4) zaktualizuj docs jeśli decyzja tworzy nową regułę, (5) wdroż tylko zatwierdzony zakres, (6) zamroź wzorzec jako referencję.

---

## 4. Zachowania UX nienaruszalne (MUST NOT)

### 4.1 Honest UI — zakazane
fake success · silent fail · nieskończony spinner bez recovery · raw backend error jako jedyny komunikat · `[object Object]` · `NaN` / `Infinity` / `Invalid Date` · stack trace w UI · „Something went wrong" gdy można podać lepszy stan.

### 4.2 Save state ≠ lifecycle state
`Saved / Saving / Save failed` = trwałość danych. `Draft / In Review / Approved / Generated / Failed` = lifecycle. Nie mieszaj.

### 4.3 Akcje destrukcyjne
wariant danger + confirm modal + jasna nazwa skutku + brak side-effectu bez potwierdzenia + toast/error po wyniku.

### 4.4 Governance / AI actions
bez silent execution · bez ukrytego uczenia · bez automatycznej trwałej zmiany danych bez decyzji użytkownika · zawsze audyt po mutacji.

### 4.5 Control bars / toolbary
Dokładnie **jeden Command Row** (Menu 3) pod topbarem. Toolbary nie dublują Module Topbar, nie tworzą 2./3. rzędu, nie hostują AI actions (te = prawa strona Menu 3). Kontrolki widoku (zoom timeline itp.) żyją w View-local Toolbar, wewnątrz powierzchni widoku.

---

## 5. Definition of Done dla pracy UI

Zmiana UI jest „done" tylko gdy: używa zatwierdzonego shell/wzorca · przyciski zgodne z taksonomią · Menu 2/3 respektowane · brak dodatkowego rzędu toolbara · AI actions we właściwym miejscu · anatomia table/card/timeline/preview zgodna ze standardem · dark i light czytelne · stany empty/loading/error uczciwe · uprawnienia/locked respektowane · etykiety domenowe i zrozumiałe · **brak nowego lokalnego języka wizualnego**.

---

## 6. Doc ↔ Kod binding (egzekwowalne SSOT)

Każda egzekwowalna reguła wskazuje swój **jedyny** plik implementacji:

| Reguła / obszar | Kod SSOT | Warstwa-doc |
|---|---|---|
| Typografia L1–L5, N, Q | `src/styles/typography.ts` | `03-modules/BLOCK_TYPES_CANON.md` |
| Semantyka kolorów (tokeny) | `src/index.css` (`--c-*`) | `00-foundation/color-system.md` |
| Mapowanie statusów (runtime) | `src/constants/statusColors.ts` (`getStatusStyle`, `getPriorityStyle`) | `00-foundation/light-mode-readability.md` |
| Preview action buttons | `src/components/shared/PreviewPane/previewStyles.ts` (`PreviewActionBar`) | `03-modules/TABLE_AND_PREVIEW_CANON.md` §7.3b |
| Menu 3 chipy / AI buttons | `src/components/shared/ModuleHub/menu3ActionButtonStyles.ts` + `src/components/shared/ModuleMenu3.tsx` | `03-modules/module-hub-standard.md` |
| Row actions (kebab) | `src/components/shared/RowActionsMenu.tsx` (`RowActionSection`) | `03-modules/TABLE_AND_PREVIEW_CANON.md` §9 |
| Field-level AI | `src/components/shared/NModeLayout/FieldAIButton.tsx` | `03-modules/BLOCK_TYPES_CANON.md` §B4 |
| Toolbar artefaktu (shell) | `NMODE_TOOLBAR_SHELL_CLASS` + `NModeToolbar.tsx` | `01-shell-layout/n-mode-card-standard.md` |
| N-mode layout (cały kit) | `src/components/shared/NModeLayout/` | `01-shell-layout/presentation-modes.md` |

**Reguła:** nowa egzekwowalna reguła w kanonie = musi wskazać (lub utworzyć) swój kod SSOT. Reguła bez bindingu jest tylko intencją.

---

## 7. Nawigacja (master index)

```
docs/ui-standards/
├── CANON.md                  ← TEN PLIK — jedyny autorytet i front
├── 00-foundation/            ← tokeny, kolor, typografia, język wizualny, motion
├── 01-shell-layout/          ← app shell, topbar, tryby D/N/C, artifact shell
├── 02-components/            ← katalog WSZYSTKICH komponentów współdzielonych
├── 03-modules/               ← kanony: tabele+preview, bloki, insight, inicjatywa, timeline
├── FROZEN_LAYOUTS.md         ← aneks: układy ZAMROŻONE (nie zmieniaj bez decyzji PO/CTO)
└── _archive/                 ← historia: plany migracji, audyty, evidence (NIE prawo)
```

### Warstwy szczegółu
- **`00-foundation/`** — `color-system.md` · `visual-language.md` · `light-mode-readability.md` · `canvas-mode.md` · `artifact-identity-map.md`
- **`01-shell-layout/`** — `presentation-modes.md` (tryby D/N/C) · `n-mode-card-standard.md` · `artifact-shell.md` · `app-topbar-standard-v3.md`
- **`02-components/`** — `shared-sections.md` · `decision-panel.md` · `task-panel.md` · `notification-panel.md` · `building-blocks.md` · `help-*` · `workspace-3-tools-strip.md` …
- **`03-modules/`** — `TABLE_AND_PREVIEW_CANON.md` · `BLOCK_TYPES_CANON.md` · `INSIGHT_CANON.md` · `INITIATIVE_CANON.md` · `TIMELINE_CALENDAR_CANON.md` · `module-hub-standard.md` · `interactive-board-standard.md` · `tools-library-detail-standard.md`

### Aneks
- **`FROZEN_LAYOUTS.md`** — pinowane układy (sidebar order, My Work taby, module topbar, view-modes order, 1 Command Row, App Table+Preview, Workspace 3-tools strip). Zmiana = świadoma decyzja PO/CTO.

> **Uwaga przejściowa (do końca Fazy 2):** szczegółowa treść produktowo-wizualna z `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` jest stopniowo dystrybuowana do warstw `00–03`. Dopóki to trwa, Golden Standard pozostaje ważny jako szczegół — z banerem wskazującym ten kanon jako autorytet.

---

## 8. Reguła dla agentów AI

Każdy agent (Claude, Cursor) **musi przeczytać ten kanon przed pracą nad UI**. Jeśli prośba jest sprzeczna z kanonem, agent musi: (a) wyjaśnić konflikt i zaproponować zgodną implementację, **albo** (b) poprosić o jawną zgodę na zmianę standardu. **Nigdy** po cichu nie tworzy konkurencyjnego wzorca UI/UX.

---

## 9. Changelog

| Data | Wersja | Zmiana |
|---|---|---|
| 2026-06-14 | v3.0 | **Faza 1** — Konsolidacja autorytetu: `CANON.md` jako jedyny front; scalone README (indeks) + Golden (treść→warstwy) + Operating (governance §3–5,8) + Canon V3 (legacy). Dodany doc↔kod binding (§6). Hierarchia prawdy rozstrzygnięta (§2). |
| 2026-06-14 | v3.0 | **Faza 2** — Rozdział prawo/historia: 9 plików procesu + `evidence/`/`automation/`/`migration-backlog/` → `_archive/` (git mv). `.cursorrules` punkt wejścia → CANON. Repoint referencji, zero-dangling zweryfikowane w całym `docs/`. |

### Stan konsolidacji (otwarte — wymagają świadomej decyzji, NIE robić mechanicznie)

- **Decyzja contentowa:** `00-foundation/light-mode-readability.md` (178 lin., bez wersji) vs `light-mode-readability 2.md` (490 lin., v3.2 2026-04-20, pełniejszy). `2.md` jest nowszy/obszerniejszy — która wersja jest kanoniczna? Po decyzji: promować do nazwy kanonicznej, usunąć drugi. **Oba nietknięte do czasu decyzji.**
- **Re-warstwowanie (F3):** `artifact-shell-future-standard.md` i `shared-nmode-sections-standard.md` leżą w root — kandydaci do `01-shell-layout/` / `02-components/` (wymaga repoint referencji).
- **Migracja treści (F3):** przywrócone `app-table-standard` / `view-modes-standard` / `module-hub-standard` / `golden-standard-table-cards-preview-v3` / `table-preview-pane-standard` — sprawdzić per-plik co już jest w `TABLE_AND_PREVIEW_CANON`, domigrować unikalne fragmenty PRZED ewentualną archiwizacją.
- **Dystrybucja Golden/Operating → warstwy (F3):** treść produktowo-wizualna z banner'd Golden Standard do rozłożenia na `00–03`; po zakończeniu Golden/Operating/CanonV3 → `_archive/`.
- **F4 (opcjonalne):** bramka CI — grep banned patterns (np. `text-blue-900` w statusach) + orphan-doc check.
