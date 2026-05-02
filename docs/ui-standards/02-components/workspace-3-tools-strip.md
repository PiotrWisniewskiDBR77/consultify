# Workspace “3‑Tools Strip” (Tools / Context / AI Suggestions)

> **Status:** Canonical workspace strip standard, subordinate to `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`  
> **Cel:** Jeden, stały “pasek 3 przycisków” dla workspace’ów i edytorów, który spina:  
> (1) narzędzia w kontekście, (2) linki/powiązania w platformie, (3) sugestie AI “co warto przemyśleć”.

## 1) Definicja

**3‑Tools Strip** to kompaktowy przełącznik (3 ikony), który otwiera **prawy panel boczny** w jednym z 3 trybów:

1. **Tools** — narzędzia potrzebne do pracy w danym narzędziu (insert / convert / transform / quick actions).
2. **Context / Links** — powiązania i kontekst w platformie:
   - **embedded references** (chip → expand preview) do artefaktów (Initiative/Task/Decision/Report/Presentation/Assessment/Note/Workspace)
   - **platform‑wide backlinks (“Used in”)** dla bieżącego obiektu (kto używa tej rzeczy)
   - “suggested links” (AI/heurystyki) to tylko część, nie całość.
3. **AI Suggestions** — sugestie “topics to analyze” / “things to consider”, z akcją **Send to chat** + możliwością “wklej do treści”.

**Kanon v3:** “Context / Links” nie jest listą losowych rekomendacji — to jest **systemowy kontrakt linkowania i backlinków**.
SSOT: `docs/product/LINK_GRAPH_V3.md`.

## 2) UI i ikony (KANON v3)

- **Tools**: ikona `SlidersHorizontal` (lub inna “tools” — ale stała w całej aplikacji)
- **Context / Links**: ikona `Lightbulb`
- **AI Suggestions**: ikona typu “komentarz/sygnał” (`MessageSquareWarning` / `AlertCircle` / `CircleAlert`) — **nie** “gwiazdka AI”

Reguły:

- to jest **chrome UI** → ikony outline, monochromatyczne; kolor pojawia się jako subtelny sygnał aktywnego stanu (zachowując DBR77)
- **single‑select**: w danym momencie otwarty może być tylko **jeden** panel
- klik na aktywny przycisk = **zamyka** panel (value = `null`)

## 3) Interakcje (KANON v3)

- **Send to chat**: każda sugestia AI może być wysłana do czatu, aby pogłębić analizę w kontekście bieżącego artefaktu.
- **Insert into content**: wybrane elementy mogą być dodane jako blok/fragment treści (docelowo także drag&drop).
- **Kontekst**: sugestie i linki muszą być kontekstowe dla aktualnego obiektu (np. Notebook page / Idea workspace).

### 3.1 “Used in” (backlinks) — MUST

- “Used in” jest **platform‑wide** (nie tylko wewnątrz danego toola).
- Domyślne miejsce prezentacji to panel “Context / Links” (nie zaśmiecamy canvasa/edytora).

SSOT: `docs/product/LINK_GRAPH_V3.md`.

## 4) Implementacja (SSOT)

### UI switcher (strip)

- `src/components/shared/WorkspacePanelStrip.tsx`
- kontrakt: `value: 'tools' | 'context' | 'ai_suggestions' | null`

### Notebook (as‑is)

W Notebook strip steruje 3 panelami:

- **Tools** → `AIChatInlinePanel` (`src/components/MyWork/notebook/AIChatInlinePanel.tsx`)
- **Context / Links** → `NotebookContextPanel` (`src/components/MyWork/notebook/NotebookContextPanel.tsx`)
- **AI Suggestions** → `AITopicsPanel` (`src/components/MyWork/notebook/AITopicsPanel.tsx`)

Źródło stanów (ModuleHub / topbar My Work):

- `src/components/MyWork/MyWorkHub.tsx` (Notebook tools strip w topbarze)

## 5) Gdzie używamy (v3)

MUST (minimum):

- Notebook

SHOULD (kolejne iteracje):

- Idea Workspace (mapa + panel)
- Report Builder / Presentation Builder (prawy panel: tools + context + AI suggestions)
- Financial Analysis workspace

