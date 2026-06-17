# DECYZJE — Runda 3
**Data:** 2026-06-17 | **Branch:** Londyn | **Status:** ✅ PODPISANE PRZEZ PIOTRA 2026-06-17

Zbiorczy rejestr 8 luk decyzyjnych (D-01/D-02) wymagających rozstrzygnięcia produktowego. Każdy agent dopisuje sekcję swojego modułu: **opcje + rekomendacja CTO (Claude) + miejsce na decyzję Piotra**. Piotr przegląda raz, rozstrzyga hurtem, agenci wykonują.

**Format wpisu agenta:**
```
### MXX L-YY — <tytuł>
- Plik: `<ścieżka:linie>`
- Stan obecny: <co jest>
- Opcje: A) … B) … C) …
- Rekomendacja CTO: <opcja + 1 zdanie dlaczego>
- DECYZJA PIOTRA: ☐ A ☐ B ☐ C — [tu wpisuje]
```

---

## REJESTR DECYZJI (8)

| # | Moduł/Luka | Tytuł | Typ | Agent | Status |
|---|-----------|-------|-----|-------|--------|
| 1 | M04 L-02 | Trzeci panel (RightRail/SplitLayout multi-instancja) | D-01/DP-2 | Harvard 4 | ☐ |
| 2 | M04 L-03 | Canonical Path Strip — ciężki/rozproszony | D-02 | Harvard 4 | ☐ |
| 3 | M13 L-07 | In-context open vs nawigacja do modułu | D-01 | Harvard 3 | ☐ |
| 4 | M14 L-05 | Feed-forward M14→M15 — realny odbiór vs preview | D-01 | Harvard 4 | ☐ |
| 5 | M15 L-05 | Sync-from-M20 — realny odbiorca vs preview | D-01 | Harvard 4 | ☐ |
| 6 | M17 L-01 | Bramka aprobaty eksportu (publish-approval policy) | D-02 | Harvard 5 | ☐ |
| 7 | M18 L-04 | Mode3 `useLlm:false` → placeholder vs LLM | D-02 | Harvard 5 | ☐ |
| 8 | M20 L-05 | Governed sync — realni czytelnicy M15/M16 vs preview | D-01 | Harvard 5 | ☐ |

---

## ROZSTRZYGNIĘCIA (podpisane 2026-06-17)

### 1. M04 L-02 — Trzeci panel → **DP-2 LEKKI RAIL** ✅
- Plik: powłoka (`RightRail`/`SplitLayout`/`MainLayout`)
- **DECYZJA PIOTRA: B-kompromis (DP-2)** — jeden trwały prawy rail z kontekstem, **przeżywający nawigację**, BEZ pełnego multi-instance docking. Pełne IDE-docking → v1.1. Spójne ze SPEC_ZADANIE_07.
- Wykonawca: **Harvard 4**. Zakres: trwałość raila przez nawigację (state w layout/context, nie per-route unmount).

### 2. M04 L-03 — Canonical Path → **ODCHUDŹ TERAZ** ✅
- Plik: `NotebookCanonicalPathStrip.tsx:25-179`
- **DECYZJA PIOTRA: A** — czysto FE refactor: odchudzić strip + scalić prawy panel do 1 raila z 2 zakładkami. Niski koszt/ryzyko, robimy w tej rundzie.
- Wykonawca: **Harvard 4**.

### 3. M13 L-07 — In-context open → **DP-2 (IDE-tabs)** ✅ *(rozstrzygnięte wcześniej)*
- Plik: `MyWorkHub.tsx:1249,3193`
- **DECYZJA: DP-2 globalny dok IDE-tabs.** Implementacja w `MyWorkHub.tsx` = **STREFA HARVARD 2** (nie H3). Reassign: H2 implementuje.

### 4-5. M14 L-05 + M15 L-05 — Feed-forward / sync-from-M20 → **DP-6 PREVIEW** ✅ *(rozstrzygnięte wcześniej)*
- Pliki: `ExecutionHub.tsx:945`; `table-platform.routes.ts:3413`
- **DECYZJA: DP-6 preview** — przyciski sync ukryte + komunikat „preview", ZERO fałszywego `success:true`. Realny odbiór = backlog v1.1. Jedna decyzja, trzy teczki (M14/M15/M20).
- Wykonawca: **Harvard 4** (M14/M15) — flip do statusu PODGLĄD-DP6.

### 6. M17 L-01 — Publish-approval → **SERVER GUARD 403** ✅
- Plik: `OutputsAggregateTabContent.tsx:1000-1004` + endpoint eksportu
- **DECYZJA PIOTRA: A** — serwerowa walidacja: **403 gdy validationState ≠ approved** przy bezpośrednim API. Zamyka obejście. Pełna polityka approval-workflow → v1.1.
- Wykonawca: **Harvard 5**. Test: bezpośredni API bez approved → 403.

### 7. M18 L-04 — Mode3 → **WŁĄCZ LLM** ✅
- Plik: `documentStudioService`
- **DECYZJA PIOTRA: A** — Mode3 generuje realną treść z szablonu przez LLM (jak Mode1). `useLlm:false` → `useLlm:true` w Mode3.
- Wykonawca: **Harvard 5**. Test: Mode3 zwraca treść, nie placeholder.

### 8. M20 L-05 — Governed sync → **DP-6 PREVIEW** ✅ *(rozstrzygnięte wcześniej)*
- Plik: `ModuleSyncService.ts:57-110,90`
- **DECYZJA: DP-6 preview** (wspólne z #4-5). Flip → PODGLĄD-DP6 (realny odbiór = backlog v1.1).
- Wykonawca: **Harvard 5**.
