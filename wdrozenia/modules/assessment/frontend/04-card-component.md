# Assessment – Card Component (Grid View)

## Status: ✅ ZAIMPLEMENTOWANE

**Plik źródłowy:** `src/components/assessment/AssessmentMatrixCard.tsx`
**Ostatnia aktualizacja:** 2026-02-08

---

## Opis

Komponent karty assessmentu używany w widoku Grid w AssessmentHub. Zgodny z UI/UX Golden Standard.

---

## Struktura karty

```
┌──────────────────────────────────────┐
│ ┌─────┐  Assessment Q1 2026          │
│ │ DRD │  Organization: ACME Corp     │
│ └─────┘  Created: Jan 15, 2026       │
│                                       │
│  ████████████████░░░░  75% complete   │
│                                       │
│  Status: ● IN_REVIEW                  │
│  Owner: Jan Kowalski                  │
│                                       │
│  [Open]              [▼ Actions]      │
└──────────────────────────────────────┘
```

---

## Props

```typescript
interface AssessmentCardProps {
  assessment: {
    id: string;
    name: string;
    assessment_type: string; // DRD | SIRI | ADMA | CMMI | LEAN
    status: string;
    completion_percent: number;
    organization_name?: string;
    owner_name?: string;
    created_at: string;
    updated_at: string;
  };
  onClick: (id: string) => void;
  onAction?: (action: string, id: string) => void;
}
```

---

## Elementy wizualne

### Framework Badge

- DRD: niebieskie tło
- SIRI: fioletowe tło
- ADMA: zielone tło
- CMMI: pomarańczowe tło
- LEAN: cyan tło

### Status Indicator

- `DRAFT`: szary
- `IN_REVIEW`: żółty
- `AWAITING_APPROVAL`: pomarańczowy
- `APPROVED`: zielony

### Progress Bar

- Dynamiczna szerokość na podstawie `completion_percent`
- Kolor zmienia się z czerwonego (0-30%) przez żółty (30-70%) na zielony (70-100%)

---

## Interakcje

- **Klik na kartę:** Przekierowanie do edytora assessmentu
- **Dropdown Actions:** Duplicate, Delete, Export, Share
- **Hover:** Subtelny cień i podświetlenie

---

## Powiązane

- `02-hub-filters.md` — filtry listy
- `05-detail-view.md` — widok szczegółowy
- `wdrozenia/standards/01-UI-UX-STANDARD.md` — Golden Standard
