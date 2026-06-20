# BRIEF AGENTA — M04 Notatnik · DOKOŃCZENIE DO ODBIORU 8/8

> Wklej jako pierwszą wiadomość do świeżego czata. Agent łapie kontekst **tylko M04**. Cel: **MODUŁ ZAMKNIĘTY (8/8)** w tabeli odbioru.

## Rola i cel
Jesteś agentem-wykonawcą **modułu M04 Notatnik** (`/my-work/notebook` — edytor TipTap, lista notatników, prawy rail, handoff do inicjatyw, search). Domykasz wszystkie bramki z [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md): **Kod · DoD 7/7 · Epiki 6/6 · Testy · Zgodność UI/UX · Deploy · →F · →UI**. Każdą rzecz **weryfikujesz dowodem**, nie deklarujesz. Nie dotykasz innych modułów.

## ⚡ Równoległość — ODPALAJ SUB-AGENTÓW
Masz narzędzie Agent/Task — **możesz i POWINIENEŚ odpalać wielu sub-agentów równolegle**. Rozdaj obszary M04: **edytor (TipTap/SlashMenu) · prawy rail+notatniki · handoff→inicjatywa · search · i18n/zgodność**. Jeden sub-agent na obszar (testy + live-weryfikacja). Ty orchestrujesz: zbierasz raporty, godzisz konflikty, aktualizujesz tracker.

## Źródła prawdy (przeczytaj NAJPIERW)
- Repo: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify` · branch **Londyn**
- **Tabela odbioru (Twój cel, aktualizuj wiersz M04):** `Harvard/wdrozenie-100/_STAN_PRACY_ODBIORY.md` — blok „### M04".
- **Teczka:** `Harvard/wdrozenie-100/M04-notatnik.md` (luki L-XX, epiki, DoD, 16 ekranów).
- **Spec testów manualnych (54 scenariusze):** `Harvard/Testy manualne/TESTY_M04_NOTATNIK.md`.

## Stan wejściowy M04 (zweryfikowany 2026-06-19 — potwierdź w kodzie)
**Zamknięte/zweryfikowane:** L-01 handoff (mechanizm convert-path `NotebookContent.tsx:1703` `convertNotebookPage(...,'initiative')` → realna encja+toast; stary `buildRadarHandoff` był build-only), L-02/L-03 rail+ProgressChip (`a69b953b06`, `notebookRailOpen/Tab` w `uiSlice`+localStorage), L-04 Menu 3, L-05 search project-scope (`notebookSearchService.ts:193` EXISTS project_members), L-06 auto-klasyfikacja, L-10 cross-user leak handoff (NAPRAWIONA +userId). L-07 = false-positive.
**Otwarte / odroczone:** L-08 martwe `KnowledgePulse.tsx`/`notebook/InsertMenu.tsx` (0 realnych importerów — usunięte w gicie, wróciły untracked, do `rm`), L-09 testy edytora TipTap/SlashMenu (CZĘŚCIOWO — edytor zostaje), L-11 i18n ~200 inline (Faza 4). Decyzja otwarta: **D-03 handoff = realny INSERT vs usunąć toast** (wspólne z M21 — uzgodnij/zaproponuj).

**Co MUSISZ domknąć do 8/8:**
1. **Testy — pełny zestaw M04 zielony** + domknij L-09 (testy edytora TipTap/SlashMenu, zlikwiduj fałszywą zieleń/`it.todo`). CI puszcza tylko `tests/unit|integration|components`.
2. **→F — 54 scenariusze NA ŻYWO** (rozdaj sub-agentom): edytor (pisanie/slash/format/autosave-persist po reload), notatniki (CRUD/typologia personal/team), rail, handoff→inicjatywa (potwierdź realny INSERT, nie kłamiący toast), search.
3. **DoD #7 a11y/dark NA ŻYWO.**
4. **Higiena:** usuń untracked sieroty `KnowledgePulse.tsx` + `notebook/InsertMenu.tsx` (potwierdź 0 importerów grepem PRZED `rm`).
5. **→UI** — screeny 16 ekranów dla audytora.

## Weryfikacja LIVE (tak to robisz — sprawdzone)
1. `preview_start`: **`frontend-dev`** (:3000) + **`backend-dev`** (:3001, **staging DB — bezpieczne**).
2. **Zalogowana przeglądarka Piotra** (Claude in Chrome MCP): `list_connected_browsers` → `navigate http://localhost:3000/my-work/notebook`. NIE preview-przeglądarka.
3. Dowód = screenshot + payload Network + logi backendu.

## Twarde zasady
- Tylko M04. NIGDY `git add -A`/`.` — jawne ścieżki. prod=centerbeam: zero zmian bez zgody (Londyn→demo).
- Sekrety/env: nie ustawiasz — zgłaszasz Piotrowi.
- `rm` martwych plików: potwierdź 0 importerów grepem (rozwiązanie importu, nie podciąg — uwaga na false-positives typu `BlockInsertMenu`⊃`InsertMenu`). Każda zmiana UI: zweryfikuj live, dowód=screenshot.

## Co zwracasz
Zaktualizowany wiersz M04 w `_STAN_PRACY_ODBIORY.md` + raport: 8 bramek z dowodem, decyzja D-03 handoff, status końcowy **8/8 GOTOWY** albo lista co zostało.
