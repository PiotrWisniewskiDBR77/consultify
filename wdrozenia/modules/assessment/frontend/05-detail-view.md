# Assessment – Detail View (Workspace)

## Status: ✅ ZAIMPLEMENTOWANE

**Plik źródłowy:** `src/views/AssessmentSessionEditorView.tsx`
**Ostatnia aktualizacja:** 2026-02-08

---

## Opis

Główny widok edytora assessmentu (workspace) z następującymi elementami:
- Top header z nawigacją, statusem i akcjami
- Edytor specyficzny dla frameworku (DRD/SIRI/ADMA/CMMI/Lean)
- Panel zarządzania (Manage) z workflow, teamem, inicjatywami, raportami
- Panel AI Chat (opcjonalny)
- Drawer inicjatyw

---

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back  │ Assessment Q1 2026  │ DRD · DRAFT · 75%  │ Save  │
├─────────────────────────────────────────────────────────────┤
│ [Manage] [Chat]                                [Lock] [Info]│
├─────────┬───────────────────────────────────────────────────┤
│ Manage  │                                                   │
│ Panel   │              Framework Editor                     │
│ (or)    │              (DRD/SIRI/ADMA/CMMI/Lean)           │
│ Chat    │                                                   │
│ Panel   │                                                   │
│         │                                                   │
└─────────┴───────────────────────────────────────────────────┘
```

---

## Zaimplementowane frameworki

| Framework | Edytor | Completion% |
|-----------|--------|-------------|
| **DRD** | `DRDAssessmentEditor` (2056 linii) | ✅ Per-area heuristic |
| **SIRI** | `SIRIAssessmentEditor` (838 linii) | ✅ Dimension + prioritisation |
| **ADMA** | `ADMAAssessmentEditor` (813 linii) | ✅ Dimension-based |
| **CMMI** | `CMPracticeForm` (607 linii) | ✅ Practice area scoring |
| **Lean** | `LeanForm` (897 linii) | ✅ Process + workstation |

---

## Funkcjonalności

### Auto-save
- Debounce: 600ms
- Silent save (status w headerze)
- Każda zmiana odpowiedzi triggeruje auto-save

### Manual Save
- Przycisk "Save" w headerze
- Keyboard shortcut: Ctrl+S / Cmd+S
- Toast notification po zapisie

### Progress Tracking
- Overall completion % (w headerze)
- Per-axis progress (DRD: axis tabs)
- Per-dimension progress (SIRI/ADMA)

### Workspace Panels
- **Manage:** 5 tabów (Workflow, Team, Initiatives, Reports, Logs)
- **Chat:** AI Chat z kontekstem assessmentu
- Toggle lewego panelu: Manage / Chat / None

### Permissions
- `useAssessmentPermissions` hook
- Role: admin, manager, editor, viewer
- Lock/Unlock toggle
- Request Access modal

---

## Routing

- Route: `/assessment/:framework/:assessmentId`
- Frameworks: `drd`, `siri`, `adma`, `cmmi`, `lean`
- Breadcrumbs: Assessment / {FRAMEWORK}

---

## Powiązane

- `07-drd-editor.md` — szczegóły edytora DRD
- `08-level-attachments.md` — załączniki per poziom
- `../features/03-knowledge-base.md` — baza wiedzy