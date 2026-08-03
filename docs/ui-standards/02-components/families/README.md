# Rodziny komponentów kanonicznych

Każdy katalog `UI-*-NN` zawiera jedyny aktywny kontrakt danej rodziny w `STANDARD.md`. Rejestr zbiorczy służy wyszukiwaniu, ale nie zastępuje kart.

Statusy: `DRAFT`, `NEEDS_DECISION`, `APPROVED_SPEC`, `IMPLEMENTED`, `REFERENCE_READY`, `CANONICAL`, `DEPRECATED`, `LEGACY`, `ARCHIVED`.

Obrazy są tylko `AUDIT_EVIDENCE`, dopóki karta nie wskaże ich jawnie jako `reference_evidence`. Zadania i Decyzje mogą być użyte jako referencje pozycjonowania dla pierwszych pięciu rodzin; inne obrazy nie są wzorcami.

> **Stan po remediation 2026-08-02 (kontrakt 2.1).** Wszystkie 26 kart ma `spec_status: APPROVED_SPEC` i `runtime_status: PARTIAL` — kolumna „Status startowy" niżej opisuje stan HISTORYCZNY z chwili założenia katalogu, nie stan bieżący. Czwarty audyt wykazał, że **12 z 20 obowiązkowych sekcji było identycznych bajt-w-bajt we wszystkich 26 kartach** (m.in. sekcja „AI/Teresa" tabeli danych była tym samym tekstem co sekcja „AI/Teresa" canvasu). Po naprawie **17 z 20 sekcji jest unikalnych per rodzina, 0 identycznych**; wspólną bazę zachowują wyłącznie §2 (granica stosowania), §19 (wskaźnik evidence) i §20 (wpis changelog).
>
> **Zakaz liczenia nagłówków jako dowodu.** „Karta ma 20 sekcji" nie znaczy nic. Odbiór karty sprawdza, czy sekcje 5, 8, 9, 11, 14, 17 i 18 zawierają treść, której **nie dałoby się bez zmiany wstawić do innej rodziny**. `runtime_status` podnosi wyłącznie macierz evidence, nigdy sama karta.

## Indeks rodzin

| Rodzina | Karta | Status startowy |
|---|---|---|
| UI-SHELL-01 | [STANDARD.md](UI-SHELL-01/STANDARD.md) | APPROVED_SPEC |
| UI-HUB-01 | [STANDARD.md](UI-HUB-01/STANDARD.md) | APPROVED_SPEC |
| UI-TABLE-01 | [STANDARD.md](UI-TABLE-01/STANDARD.md) | APPROVED_SPEC |
| UI-PREVIEW-01 | [STANDARD.md](UI-PREVIEW-01/STANDARD.md) | APPROVED_SPEC |
| UI-ACTION-01 | [STANDARD.md](UI-ACTION-01/STANDARD.md) | APPROVED_SPEC |
| UI-KANBAN-01 | [STANDARD.md](UI-KANBAN-01/STANDARD.md) | DRAFT |
| UI-CALENDAR-01 | [STANDARD.md](UI-CALENDAR-01/STANDARD.md) | DRAFT |
| UI-ART-01 | [STANDARD.md](UI-ART-01/STANDARD.md) | DRAFT |
| UI-NMODE-01 | [STANDARD.md](UI-NMODE-01/STANDARD.md) | DRAFT |
| UI-CANVAS-01 | [STANDARD.md](UI-CANVAS-01/STANDARD.md) | DRAFT |
| UI-IDEA-01 | [STANDARD.md](UI-IDEA-01/STANDARD.md) | DRAFT |
| UI-TOOL-01 | [STANDARD.md](UI-TOOL-01/STANDARD.md) | DRAFT |
| UI-EDITOR-01 | [STANDARD.md](UI-EDITOR-01/STANDARD.md) | DRAFT |
| UI-DECK-01 | [STANDARD.md](UI-DECK-01/STANDARD.md) | DRAFT |
| UI-SHEET-01 | [STANDARD.md](UI-SHEET-01/STANDARD.md) | DRAFT |
| UI-CARD-01 | [STANDARD.md](UI-CARD-01/STANDARD.md) | DRAFT |
| UI-STATE-01 | [STANDARD.md](UI-STATE-01/STANDARD.md) | DRAFT |
| UI-OVERLAY-01 | [STANDARD.md](UI-OVERLAY-01/STANDARD.md) | DRAFT |
| UI-FORM-01 | [STANDARD.md](UI-FORM-01/STANDARD.md) | DRAFT |
| UI-STATUS-01 | [STANDARD.md](UI-STATUS-01/STANDARD.md) | DRAFT |
| UI-REL-01 | [STANDARD.md](UI-REL-01/STANDARD.md) | DRAFT |
| UI-AI-01 | [STANDARD.md](UI-AI-01/STANDARD.md) | DRAFT |
| UI-HELP-01 | [STANDARD.md](UI-HELP-01/STANDARD.md) | DRAFT |
| UI-NOTIFY-01 | [STANDARD.md](UI-NOTIFY-01/STANDARD.md) | DRAFT |
| UI-CREATE-01 | [STANDARD.md](UI-CREATE-01/STANDARD.md) | DRAFT |
| UI-PERM-01 | [STANDARD.md](UI-PERM-01/STANDARD.md) | DRAFT |
