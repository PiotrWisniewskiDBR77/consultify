# Initiatives – Migracja legacy widoków (KANON: Drawer + DocumentView)

## Cel

Zostawić tylko 2 powierzchnie UI inicjatywy:

- **Quick Review Drawer (50%)**: `src/components/Initiatives/InitiativeDrawer.tsx`
- **Full Card (DynamicTabs document)**: `src/components/Initiatives/InitiativeDocumentView.tsx`

Wszystkie inne widoki inicjatywy traktujemy jako **legacy** i planujemy wygaszenie.

---

## Aktualne komponenty i ich status

### Kanoniczne (zostają)

- `src/components/Initiatives/InitiativeDrawer.tsx` – quick review + Open wider
- `src/components/Initiatives/InitiativeDocumentView.tsx` – pełna karta (hub)

### Legacy (do wygaszenia)

- `src/components/Initiatives/InitiativeFullView.tsx` – legacy tabbed view
- `src/components/Initiatives/InitiativeDetailCard.tsx` – legacy card
- `src/components/InitiativeDetailModal.tsx` – legacy modal (monolit ~2.8k linii)

---

## Miejsca użycia legacy (na dziś)

### 1) `InitiativeDetailModal` – użycia w UI

1. `src/components/workspaces/FullStep2Workspace.tsx`
   - otwiera modal w kroku workspace (Flow step2)
   - **docelowo**: zamiast modal → `openDocument` w ModuleHub (DynamicTabs) i render `InitiativeDocumentView`

2. `src/components/RoadmapKanban.tsx`
   - kanban/roadmap otwiera `InitiativeDetailModal` po kliknięciu
   - **docelowo**: klik → drawer (quick review), CTA “Open full card” → DynamicTabs

### 2) `InitiativeFullView` / `InitiativeDetailCard`

Te komponenty są oznaczone jako deprecated w `src/components/Initiatives/index.ts`,
ale mogą nadal być importowane w starszych ścieżkach – trzeba przeszukać repo (grep) przed wycięciem.

---

## Plan migracji (bezpieczny)

### Krok A: Stabilizacja API kontraktu “open initiative”

Ustalić 1 sposób otwierania inicjatywy w całym systemie:

- **Drawer**: `InitiativeDrawer(initiative)` dla quick review
- **Full card**: `openDocument({ type: 'initiative', id })` → render `InitiativeDocumentView`

### Krok B: Roadmap / Workspace – migracja click behavior

1. `RoadmapKanban.tsx`:

- klik w initiative → otwórz drawer (albo bezpośrednio full card)
- usuń modal

2. `FullStep2Workspace.tsx`:

- zastąpić `InitiativeDetailModal` wywołaniem otwarcia dokumentu (DynamicTabs)
- jeżeli to “wizard-like flow”, to:
  - quick review w drawer,
  - pełna edycja w dokumencie

### Krok C: Wyłączenie eksportów legacy

W `src/components/Initiatives/index.ts`:

- utrzymać eksporty legacy tylko przejściowo (deprecation)
- docelowo usunąć eksporty i przerobić importy w repo na `InitiativeDocumentView`

### Krok D: Usunięcie kodu legacy

Warunek:

- brak importów w repo (grep = 0)
- E2E testy przechodzą (drawer → open full card, gate readiness, status change)

---

## Kryterium “done”

- Nie ma żadnego użycia `InitiativeDetailModal`, `InitiativeFullView`, `InitiativeDetailCard`.
- Każde miejsce w aplikacji:
  - daje quick review (drawer) lub
  - otwiera full card w DynamicTabs (`InitiativeDocumentView`).
