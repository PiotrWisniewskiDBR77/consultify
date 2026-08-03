---
doc_kind: COMPONENT_RUNTIME_BINDING_REGISTRY
spec_status: APPROVED_SPEC
runtime_status: PARTIAL
authority: docs/ui-standards/CANON.md
---

# Rejestr bindingów komponent ↔ runtime

Ścieżka potwierdza miejsce audytu, nie automatyczną zgodność. `candidate` musi przejść evidence matrix. Lokalny fork ekranu nie staje się SSOT przez częste użycie.

| ID | Rodzina | Kod SSOT / kandydat do konsolidacji | Główni konsumenci |
|---|---|---|---|
| UI-SHELL-01 | App shell | `src/components/layout/`, `src/components/navigation/Sidebar/` | wszystkie moduły |
| UI-HUB-01 | Module hub | `src/components/shared/ModuleHub/`, `src/components/shared/ModuleMenu3.tsx` | huby modułów, My Work |
| UI-TABLE-01 | App table | `src/components/standard/StandardTable.tsx` | Tasks, Decisions, Ideas, Inbox, Vault, Agent |
| UI-PREVIEW-01 | Preview | `src/components/standard/StandardPreview.tsx`, `src/components/shared/PreviewPane/` | listy My Work |
| UI-ACTION-01 | Action/menu | `src/components/shared/RowActionsMenu.tsx`, `src/actions/ideaActionRegistry.ts` | kebab, context menu, bulk |
| UI-CARD-01 | Record card | `src/components/standard/StandardKanbanCard.tsx` | kanban, manager lanes |
| UI-KANBAN-01 | Kanban | `src/components/standard/StandardKanban.tsx` | Tasks, Decisions, Initiatives |
| UI-NMODE-01 | N-mode workspace | `src/components/shared/NModeLayout/` | Tasks, Decisions, Initiative/Insight workspaces |
| UI-STATUS-01 | Status/priority | `src/constants/statusColors.ts`, `src/components/shared/ViewLayouts/StatusBadge.tsx` | wszystkie lifecycle views |
| UI-OVERLAY-01 | Overlay | `src/components/ui/`, `src/hooks/useModal.tsx` | modal, popover, tooltip, confirm |
| UI-SHEET-01 | Drawer/sheet | `src/components/MyWork/IdeaNodeDetailDrawer.tsx`, `src/components/Initiatives/InitiativeDrawer.tsx` | form/detail side panels |
| UI-FORM-01 | Form | primitives w `src/components/ui/` | create/edit/settings |
| UI-CREATE-01 | Wizard/create | `src/components/Presentations/PresentationWizard.tsx`, `src/views/OrgSetupWizard.tsx` | generatory i onboarding |
| UI-EDITOR-01 | Rich editor | `src/components/ReportBuilder/ReportEditor/` | Notebook, Reports |
| UI-CALENDAR-01 | Calendar | `src/components/MyWork/Calendar/` | My Work Calendar |
| UI-NOTIFY-01 | Notification | `src/components/Notifications/`, `src/components/ui/toast.tsx` | inbox, toasts, preferences |
| UI-HELP-01 | Help | `src/components/layout/HelpPanel.tsx`, `src/config/helpContent.ts` | pomoc kontekstowa |
| UI-PERM-01 | Permission gate | `src/components/access/AccessBlockedModal.tsx` | tenant/capability gates |
| UI-AI-01 | AI interaction | `src/components/shared/NModeLayout/FieldAIButton.tsx` | field/block/workspace AI |
| UI-REL-01 | Relations | relation/context panels in `src/components/shared/NModeLayout/` | Notes, Tasks, Decisions, Ideas |
| UI-STATE-01 | Async states | `src/components/shared/ModuleHub/HubWorkAreaLoading.tsx`, `HubWorkAreaLoadError.tsx` | hub work areas |
| UI-TOOL-01 | Artifact tools | `src/components/MyWork/IdeaProcessFlowTool.tsx`, `src/components/MyWork/mindmap/`, `whiteboard/` | Ideas artifacts |
| UI-CANVAS-01 | Canvas | `src/components/MyWork/mindmap/`, `src/components/MyWork/whiteboard/`, `src/utils/canvas/` | Mind Map, Whiteboard |
| UI-IDEA-01 | Idea lifecycle | `src/components/standard/IdeaRightPanel.tsx`, `src/actions/ideaActionRegistry.ts` | Ideas |
| UI-DECK-01 | Deck | `src/components/Presentations/DeckBuilder/` | Presentations |
| UI-ART-01 | Artifact shell | `src/components/shared/NModeLayout/`, tool-specific shells | documents, canvases, records, matrices, decks |

## Reguła review

Review ma wskazać: kartę rodziny, ten binding, consumer, fixture ID i wynik testów. Jeśli import omija SSOT albo zachowanie różni się bez zatwierdzonego wariantu, wynik to `REJECTED_LOCAL_FORK`.

