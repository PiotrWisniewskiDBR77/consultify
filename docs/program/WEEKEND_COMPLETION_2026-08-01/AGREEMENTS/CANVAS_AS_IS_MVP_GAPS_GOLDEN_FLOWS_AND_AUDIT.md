---
document_id: CANVAS-AS-IS-MVP-GAPS-GOLDEN-FLOWS-AUDIT
surface: Canvas
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Canvas — remanent kodu, luki MVP i golden flows

## 1. Werdykt

Canvas jest jednym z najbardziej rozbudowanych, ale też najbardziej
rozproszonych obszarów repozytorium. Stan: **REAL / PARTIAL / REQUIRES
CONSOLIDATION**. Istnieje rzeczywisty runtime i wiele zabezpieczeń. Nie należy
go przepisywać od zera. Trzeba scalić ścieżki, usunąć konkurencyjne shelle i
potwierdzić pełne handoffy.

## 2. Dowody runtime

| Capability | Dowód | Stan |
| --- | --- | --- |
| wspólny Chat + Canvas | `WorkCanvasShell.tsx`, `UnifiedChatPanel` | real |
| rich/manual editor | `CanvasRichEditor.tsx` | real |
| selection AI | `CanvasAIFloatingMenu.tsx`, `useCanvasAIStream.ts` | real/partial |
| preview/diff/apply | `canvasDiffOps.ts`, operation preview | real |
| autosave/persistence | `work-canvas.routes.ts`, `work_canvas_drafts` | real |
| wersje/restore | `CanvasVersionHistory.tsx`, versions routes | real |
| lifecycle/reviewer/comments | workflow collaboration routes/UI | real/partial |
| typed blocks | `CanvasArtifactBlockRenderer.tsx`, schema v1 | partial |
| research | `ResearchSessionsDock` i research routes | partial |
| workflow/approvals/ledger | `CanvasWorkflowRun` i workflow routes | real/partial |
| share/revoke | share routes i UI | real; policy review required |
| eksport | MD/CSV/PDF/DOCX/XLSX/PPTX/JSON paths | zależny od typu |
| handoff | proposals, save-to-workspace, create-output, studio routes | real/partial |
| provenance | block provenance, materialized ledger | real/partial |

## 3. Luki konsolidacyjne

1. Kilka historycznych definicji Canvasu i wiele stage-gate docs utrudniają
   wskazanie aktualnej prawdy implementacyjnej.
2. Standalone route i panel przy Chacie muszą mieć ten sam editor, lifecycle,
   permissions i data contract.
3. Canvas, Ideas Canvas i Studio Canvas wymagają jednoznacznego nazewnictwa.
4. Nie każdy natywny block ma równą jakość edycji, eksportu i round-trip.
5. Research execution i evidence coverage pozostają częściowe.
6. Pełny role/ACL matrix dla share, review, export i materializacji wymaga
   końcowego sprawdzenia.
7. Public share nie może omijać polityki danych klienta ani źródeł.
8. Trzeba potwierdzić, że wszystkie formaty eksportu są prawdziwe dla każdego
   deklarowanego typu, a nie tylko widoczne w menu.

## 4. P0 MVP

- jeden aktywny shell i jeden canonical draft contract;
- bezstratne create/open/save/close/reopen;
- ochrona przed konfliktem oraz recovery po błędzie;
- selection edit z widocznym diffem i ochroną zmian ręcznych;
- version history i restore;
- source/provenance/staleness;
- capability honesty per artifact i export;
- permission enforcement w UI i API;
- co najmniej: Note, Decision, Initiative Candidate, Task i Output handoff z
  proposal/confirm/read-back;
- idempotencja i ledger materializacji;
- test public share/revoke/expiry albo wyłączenie tej funkcji w MVP.

## 5. P1

- pełne komentarze zakotwiczone i review request;
- quality summary przed approval;
- research evidence graph;
- jednolity picker istniejących Canvasów;
- templates z governance metadata;
- zaawansowany DOCX/XLSX/PPTX round-trip;
- tryb present i branded client view;
- porównanie wersji blok po bloku.

## 6. Golden flows

### GF-CAN-01 — rozmowa do dokumentu

Użytkownik rozmawia z Teresą, akceptuje plan dokumentu, otwiera Canvas, ręcznie
poprawia fragment, zleca rewrite zaznaczenia, widzi diff, akceptuje, zamyka i po
powrocie odzyskuje dokładny stan.

### GF-CAN-02 — materiał do inicjatywy

Canvas używa zatwierdzonego outputu Assessment/Tools, pokazuje źródła, Teresa
tworzy Initiative Candidate, użytkownik edytuje i potwierdza. Initiatives zwraca
target ID, a oba obiekty pokazują lineage.

### GF-CAN-03 — review i wersja

Autor wskazuje reviewera i wysyła konkretną wersję. Reviewer komentuje fragment,
żąda zmiany, autor poprawia, ponownie wysyła, reviewer zatwierdza. Dalsza edycja
tworzy nową wersję roboczą.

### GF-CAN-04 — źródło staje się nieaktualne

Zmiana źródła oznacza zależny claim/blok jako stale. Użytkownik widzi różnicę,
może przeliczyć lub pozostawić starą zatwierdzoną wersję. System nie podmienia
wyniku bez zgody.

### GF-CAN-05 — eksport i share

Dozwolony użytkownik eksportuje właściwy format oraz tworzy wygasający link.
Odbiorca widzi tylko opublikowaną wersję. Revoke natychmiast blokuje link, a
zdarzenia są audytowalne.

### GF-CAN-06 — konflikt i recovery

Dwie zmiany konkurują. System blokuje ślepe nadpisanie, pokazuje różnicę i
pozwala zachować obie wersje lub scalić. Żadna treść nie znika.

## 7. Definition of Done

Canvas może zostać odebrany dopiero, gdy każdy P0 ma test integracyjny oraz
dowód UI, a zadeklarowane formaty mają prawdziwy plik wynikowy. Sukces endpointu
bez odczytu zapisanego draftu/targetu nie wystarcza. `completed_with_errors` i
`partial` nie są sukcesem biznesowym.
