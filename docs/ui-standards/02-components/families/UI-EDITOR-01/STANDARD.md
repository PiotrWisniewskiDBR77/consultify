---
component_id: UI-EDITOR-01
name: Document Editor
family: workspace
spec_status: APPROVED_SPEC
runtime_status: PARTIAL
contract_version: 2.1
product_owner: Piotr Wisniewski
code_owner: Frontend Platform
canonical_docs:
  - docs/ui-standards/CANON.md
  - docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md
  - docs/ui-standards/02-components/PRIMITIVE_INTERACTION_CONTRACT.md
reference_implementations:
  - Notebook editor
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-EDITOR-01 — Document Editor

## 1. Job to be done

Tworzyć dłuższą treść z autosave, strukturą, kontekstem, AI i historią.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `workspace`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

document toolbar, outline/list, editor, contextual toolbar, right work/context panel, save state. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

rich text, note, report, read-only. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Model dokumentu jest wersjonowany: każdy zapis niesie `version` (albo timestamp źródłowy), na którym był oparty edytor w momencie startu edycji — to jest jedyny sposób wykrycia konfliktu w §6/§9, nie porównanie treści po fakcie. Blok/sekcja dokumentu ma własny stabilny `id` niezależny od pozycji w dokumencie, żeby komentarz, link i AI-transform wskazane na bloku przeżyły reorder.

## 6. Akcje i zdarzenia

format, insert, slash, comment, link, AI transform, convert, history. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

empty, loading, editing, saving, saved, conflict, offline, read-only, error. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

AI transform w edytorze działa na zaznaczonym bloku albo zakresie, nie na całym dokumencie naraz — wynik wraca jako `proposal` renderowany inline (diff nad/pod oryginałem), a `approve` podmienia treść bloku z zachowaniem jego `id` (§5), żeby historia i komentarze przypięte do bloku nie osierociały się. `reject` przywraca dokładnie stan sprzed propozycji, bez śladu w treści — ślad zostaje wyłącznie w telemetryce (§15).

## 9. Nawigacja

Konflikt wersji NIGDY nie jest nadpisywany po cichu: gdy zapis trafia na dokument zmieniony przez kogoś innego od czasu otwarcia (§5 `version`), edytor oferuje porównanie (compare) i zachowanie własnej kopii jako osobnego rekordu — użytkownik wybiera, nie system. Deep link do dokumentu w trakcie cudzej edycji nadal otwiera dokument (read-only banner o równoległej edycji), nie blokuje wejścia.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Prawy work/context panel (§3) jest pierwszym regionem zwijanym poniżej 1280 px — kolumna edytora ma pierwszeństwo do szerokości, panel wraca jako nakładka na żądanie.

## 11. Accessibility

Skróty klawiaturowe edytora (bold/italic/link, slash-menu) nie przechwytują nawigacji przeglądarki ani czytnika ekranu — żaden skrót nie nadpisuje Tab, strzałek poza aktywnym blokiem ani skrótów VoiceOver/NVDA. Slash-menu jest w pełni obsługiwane klawiaturą: otwarcie `/`, filtrowanie przez pisanie, wybór strzałkami + Enter, zamknięcie Esc z powrotem do pozycji kursora sprzed otwarcia.

## 12. Visual tokens

Obowiązuje wspólna podstawa §3a. Kolumna treści dokumentu ma maksymalną szerokość 760 px (reading column, `FOUNDATION_TOKEN_CONTRACT.md` §4) niezależnie od szerokości okna — długość linii nie rośnie do pełnej szerokości ekranu.

## 13. Security i privacy

Obowiązuje wspólna podstawa §3a. Wklejenie treści spoza edytora (np. ze schowka po skopiowaniu z innego dokumentu/aplikacji) jest wektorem danych wrażliwych i ukrytych znaczników, nie tylko problemem stylu (§14) — higiena wklejania usuwa też niewidoczne metadane/komentarze/linki wbudowane w wklejany HTML, zanim trafią do treści dokumentu. Historia wersji dokumentu podlega tej samej capability co dokument bieżący — cofnięcie dostępu do dokumentu cofa też dostęp do jego wcześniejszych wersji, nie tylko do wersji aktualnej.

## 14. Performance

Autosave ma jawne stany `Saving/Saved/Failed` widoczne przy tytule dokumentu, z retry i backoff przy `Failed` — nigdy cichego ponawiania bez zmiany stanu widocznego. Wklejanie treści spoza edytora (np. z Worda) przechodzi higienę wklejania: usuwane są obce style/klasy/inline-fonty, zachowywana jest wyłącznie semantyczna struktura (nagłówki, listy, pogrubienie) mapowana na bloki edytora.

## 15. Telemetry

Obowiązuje wspólna podstawa §3a. Zdarzenia specyficzne tej rodziny: `editor.autosave_success`/`autosave_fail`, `editor.conflict_shown`/`conflict_resolved` z wyborem (compare/keep copy/discard) — sygnał, czy dokument jest realnie edytowany równolegle przez wiele osób — oraz `editor.paste_sanitized`, ile razy higiena wklejania (§13) faktycznie coś usunęła.

## 16. Miejsca użycia

Notebook editor; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`: `src/components/ReportBuilder/ReportEditor/ReportEditor.tsx` (istnieje, 108 KB) ma stany `isSaving`/`lastSavedAt`/`hasUnsavedChanges` i historię wersji (`/report-builder/{id}/versions`), ale zgrepowane 2026-08-02 nie ma żadnej obsługi `conflict` ani higieny wklejania (`paste`/`clipboard`) — konflikt wersji (§9) i paste hygiene (§14) są dziś niepokryte w referencyjnym SSOT tej rodziny, nie tylko w dokumentacji.

## 18. Acceptance tests

Test odrzucający, nadrzędny wobec pozostałych wyników (`COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`): dwie sesje edytujące ten sam dokument równolegle → drugi zapis wykrywa konflikt i oferuje compare/keep copy — zero cichej utraty treści pierwszej sesji. Test uznaje się za nieprzeszły, jeśli którykolwiek zapis nadpisuje drugi bez ostrzeżenia.

## 19. Evidence

Kandydat: Notebook screenshots = audit evidence. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.
