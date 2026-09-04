# Rejestr menu akcji Wywiadu — 2026-09-03

Zakres: sześć powierzchni obiektów Wywiadu na markerze `58ef0771d7`. `JEST` oznacza widoczną akcję z realnym handlerem; `BRAK` oznacza brak na danej powierzchni. Kebab lokalny sekcji Details nie jest kebabem wiersza. `Open`, eksport i pobranie nie są dublowane w pasku preview zgodnie z kanonem §7.3.

## Pomiar PRZED

| Typ | Akcja / stan | Kebab wiersza | Pasek preview | Istniejąca operacja | Klucz i18n |
| --- | --- | --- | --- | --- | --- |
| Przydział | start / assigned | JEST | JEST | `startInterviewAssignment` → istniejący flow sesji | `interview.hub.start`, `interview.assignmentPreview.start` |
| Przydział | continue / in_progress | JEST | JEST | `GET /api/interview/sessions/:id` | `interview.hub.continue`, `interview.assignmentPreview.continue` |
| Przydział | fix / sent_back | JEST | JEST | `GET /api/interview/sessions/:id` | `interview.hub.fixResubmit`, `interview.assignmentPreview.fixResubmit` |
| Przydział | approve / submitted | JEST | JEST | istniejący `handleOpenApproveModal` | `interview.hub.approve`, `interview.assignmentPreview.approve` |
| Przydział | send back / submitted | JEST | JEST | istniejący `handleOpenSendBackModal` | `interview.hub.sendBack3`, `interview.assignmentPreview.sendBack` |
| Przydział | reassign | JEST | BRAK | istniejący `handleReassignAssignment` | `interview.hub.reassign` |
| Przydział | reminder | JEST | BRAK | istniejący `handleOpenReminderModal` | `interview.hub.sendReminder` |
| Przydział | escalate | JEST | BRAK | istniejący `handleEscalateNow` | `interview.hub.escalateNow` |
| Przydział | edit due/answers | JEST | BRAK | istniejący modal / flow odpowiedzi | `interview.hub.edit` |
| Przydział | archive/restore | JEST warunkowo | BRAK | `POST /api/interview/assignments/:id/{archive,restore}` przez istniejący handler | `interview.hub.archive`, `interview.hub.restore` |
| Przydział | delay 1/3/7 | JEST | BRAK | istniejący `handleDelayAssignment` | `interview.hub.delay`, `interview.hub.plusDays*` |
| Skrzynka | start/continue/fix | JEST | JEST | istniejący flow przydziału | klucze `interview.hub.*` |
| Skrzynka | edit answers | JEST | BRAK | `startInterviewAssignment` | `interview.hub.edit` |
| Skrzynka | delay 1/3/7 | JEST | JEST | istniejący `handleDelayAssignment` | `interview.hub.delay`, `interview.hub.plusDays*` |
| Sesja | approve/send back/remind | JEST warunkowo | BRAK | istniejące handlery powiązanego assignmentu | `interview.hub.approve`, `sendBack2`, `remind` |
| Sesja | generate insight / approved | JEST | JEST | istniejący `handleGenerateInsight` | `interview.hub.generateAiInsights`, `interview.sessionPreview.generateInsights` |
| Sesja | archive/restore/trash/delete | JEST warunkowo | BRAK | `POST /api/interview/sessions/:id/:action`, `DELETE /api/interview/sessions/:id` | `interview.hub.archive`, `restore`, `moveToTrash`, `deleteForever` |
| Sesja | delay | JEST warunkowo | BRAK | istniejący handler powiązanego assignmentu | `interview.hub.delay`, `interview.hub.plusDays*` |
| Szablon | use/assign | JEST | BRAK | `POST /api/interview/templates/:id/use`; istniejący assign modal | `interview.hub.useTemplate`, `interview.hub.assign` |
| Szablon | clone | JEST | JEST | `POST /api/interview/templates/:id/clone` | `interview.hub.cloneTemplate`, `interview.templatePreview.duplicate` |
| Szablon | edit | JEST | JEST | istniejący pełny widok edycji | `interview.hub.editTemplate`, `interview.templatePreview.edit` |
| Szablon | toggle default | JEST | BRAK | `POST /api/interview/templates/:id/default` | `interview.hub.setAsDefault`, `unsetDefault` |
| Szablon | archive/restore | JEST warunkowo | BRAK | `POST /api/interview/templates/:id/{archive,restore}` | `interview.hub.archiveTemplate`, `restoreTemplate` |
| Szablon | delete | JEST warunkowo | JEST warunkowo | `DELETE /api/interview/templates/:id` | `interview.hub.deleteTemplate`, `interview.templatePreview.delete` |
| Wniosek | fork | JEST | BRAK | istniejący `handleForkInsight` | `interview.hub.fork` |
| Wniosek | export Tools/Assessment | JEST | Details: Tools; pasek BRAK | istniejące handlery eksportu | `interview.hub.tools`, `interview.hub.assessment` |
| Wniosek | archive/restore/delete | JEST warunkowo | BRAK | istniejące handlery lifecycle/delete | `interview.hub.archive`, `restore`, `delete` |
| Inicjatywa Wywiadu | send to review | JEST / draft | JEST / draft | istniejący status handler | `interview.hub.sendToReview`, `interview.initiativePreview.sendToReview` |
| Inicjatywa Wywiadu | approve and move | JEST / pending+reviewer | JEST | istniejący status handler + nawigacja do `InitiativeDocumentView` | `interview.hub.approveAndMoveForward`, `interview.initiativePreview.approveAndMoveForward` |
| Inicjatywa Wywiadu | back to draft | JEST / pending | JEST | istniejący status handler | `interview.hub.backToDraft`, `interview.initiativePreview.backToDraft` |

## POMINIĘTE z powodem

| Typ | Akcja | Powód |
| --- | --- | --- |
| Skrzynka | archive/delete | Brak wspieranego endpointu/handlera dla widoku pracownika; pozostaje jawnie niedostępna, bez atrapy. |
| Sesja | edit | Brak endpointu edycji sesji; kebab już komunikuje stan disabled. |
| Wniosek | convert to Initiative/Presentation | Na markerze brak handlera/backendu; istniejące pozycje kebaba są disabled z notą. |
| Inicjatywa Wywiadu | edit/archive/delete | Na markerze brak handlerów/backendu; nie dodajemy martwych przycisków. |
| Każdy preview | Open/export/download w pasku | Kanon preview §7.3 nakazuje pojedyncze Open w nagłówku i export/download wyłącznie w kebabie Details. |

## Korekty wobec instrukcji

- Pomiar `ls src/components/Interview/Interview*Preview.tsx src/components/Interview/InsightViewer.tsx` zwrócił 6 plików, nie 5: istnieje także `InterviewInsightPreview.tsx`.
- Pomiar `PreviewActionBar|actions` nie potwierdził tezy, że Przydział ma największą liczbę trafień: `InterviewAssignmentPreview.tsx=2`, a `InsightViewer.tsx=21`. To licznik tekstowy, nie dowód kompletności funkcjonalnej.
- `scripts/check-list-canon.sh` na czystym markerze: 368 zastanych naruszeń / baseline 368; dług nie rośnie.
- Macierz G06 zawiera dokładnie 5 wskazanych ekranów, zgodnie z tezą instrukcji.

## Stan PO

Do uzupełnienia po R2–R5 wraz z commitami, dowodem handlerów i zrzutami.
