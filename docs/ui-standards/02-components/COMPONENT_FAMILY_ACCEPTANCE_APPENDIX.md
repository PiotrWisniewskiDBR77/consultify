---
doc_kind: COMPONENT_FAMILY_ACCEPTANCE_APPENDIX
spec_status: APPROVED_SPEC
runtime_status: PARTIAL
authority: docs/ui-standards/CANON.md
---

# Kryteria charakterystyczne 26 rodzin

Wspólne wymagania są w kartach `families/*/STANDARD.md`. Poniższe wymagania są dodatkowe i obowiązkowe; usuwają niejednoznaczne „tam, gdzie ma sens”.

| ID | Minimalny kontrakt charakterystyczny | Krytyczny test odrzucający |
|---|---|---|
| UI-SHELL-01 | jeden rail, topbar 48, stabilny active route, skip link | deep link i Back nie gubią modułu/focusu |
| UI-HUB-01 | Menu 2 + dokładnie jeden Menu 3 + tabs/documents | brak drugiego command row; tab state odtwarzany |
| UI-TABLE-01 | stabilne row ID, sort/filter/columns/selection/preview | keyboard row→preview→Esc; 10k wierszy bez utraty selection |
| UI-PREVIEW-01 | 320–420 px, identity, metadata, detail, AI, actions | zamknięcie oddaje focus i nie resetuje listy |
| UI-ACTION-01 | registry action IDs, capability, order, parity kebab/context | ta sama akcja ma ten sam skutek i confirm |
| UI-CARD-01 | identity, status, owner/date, next action | długie tytuły i brak metadata nie łamią rytmu |
| UI-KANBAN-01 | lane meaning, counts, DnD + keyboard move | optimistic move rollback przy 409/403 |
| UI-NMODE-01 | identity 60, command 44, section nav, properties/actions | przejście sekcji zachowuje draft i announce |
| UI-STATUS-01 | mapowanie enum→semantic token+label+icon/dot | status nieznany daje neutral fallback, nie surowy enum |
| UI-OVERLAY-01 | portal, trap/roving focus, outside/Esc policy | nested overlay zamyka tylko górną warstwę |
| UI-SHEET-01 | tytuł, close, scroll ownership, footer actions | 200% zoom bez odciętego footeru |
| UI-FORM-01 | label, hint/error IDs, dirty, validation, submit pending | błąd serwera zachowuje dane i focusuje summary/field |
| UI-CREATE-01 | kroki, progress, back, draft, review, idempotency | refresh/resume nie duplikuje obiektu |
| UI-EDITOR-01 | toolbar+keyboard, autosave, version conflict, paste hygiene | konflikt oferuje compare/keep copy; zero silent overwrite |
| UI-CALENDAR-01 | month/week/day/agenda, timezone, conflict | DST i overlapping events; drag ma formularzową alternatywę |
| UI-NOTIFY-01 | source, urgency, read state, snooze/action | live update nie kradnie focusu; badge count read-back |
| UI-HELP-01 | topic keyed by route/object, search, source/version | brak tematu daje użyteczny fallback, nie pusty panel |
| UI-PERM-01 | server capability, non-disclosure, request path | 403 po optimistic UI cofa zmianę bez wycieku nazwy |
| UI-AI-01 | scope, sources, stream, proposal/diff, approval, audit | anulowanie streamu; żadna trwała mutacja przed approval |
| UI-REL-01 | typed edge, source/target, provenance, permission | usunięcie relacji nie usuwa obiektu; hidden target niewidoczny |
| UI-STATE-01 | loading/empty/partial/stale/error/no-access/offline | timeout >10 s pokazuje retry i zachowuje dotychczasowe dane |
| UI-TOOL-01 | tool identity, palette/toolbar, save, export/convert | wyjście z dirty state ma ochronę; reload odtwarza dokument |
| UI-CANVAS-01 | zoom/fit/minimap, selection, context menus, alt list | keyboard create/move/delete; 500 nodes zachowuje interakcję |
| UI-IDEA-01 | stage, tool type, completeness, preview, convert provenance | konwersja idempotentna i zapisuje source/backlink |
| UI-DECK-01 | outline, slide/card canvas, theme, presenter/export | font/image overflow w PDF/PPTX baseline |
| UI-ART-01 | identity, mode, local toolbar, content, context, history/export | każdy z 5 typów przechodzi pełny shell bez lokalnego chrome |

## Progi techniczne

- wyszukiwanie: debounce 250–350 ms, request cancellation, Enter nie jest wymagany;
- tabela: wirtualizacja od progu potwierdzonego pomiarem, obowiązkowo przy 1k+ widocznych rekordów;
- canvas: test 500 nodes / 750 edges, pan/zoom bez długich zadań >50 ms w typowym laptopie referencyjnym;
- autosave: widoczne `Saving/Saved/Failed`, retry z backoff, konflikt wersji nigdy nadpisywany po cichu;
- wszystkie mutacje: idempotency key tam, gdzie retry może utworzyć duplikat, read-back po sukcesie;
- telemetryka: action/component ID i latency, bez treści klienta.

