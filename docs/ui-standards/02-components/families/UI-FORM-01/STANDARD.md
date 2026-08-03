---
component_id: UI-FORM-01
name: Forms and Fields
family: primitive
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
  - shared form primitives
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-FORM-01 — Forms and Fields

## 1. Job to be done

Wprowadzić i poprawić dane z jasną walidacją, zależnościami i ochroną pracy.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `primitive`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

label, control, hint, required, validation, group, actions, summary. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

text, textarea, number, date, select, combobox, checkbox, radio, upload. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

`label`, `hint` i `error` są powiązane z control przez `id`/`aria-describedby` — nie przez sąsiedztwo wizualne. Stan `dirty` liczony jest per pole (od ostatniej wartości potwierdzonej przez serwer, nie od wartości przy montażu) i osobno zbiorczo dla całego formularza (`isDirty`), bo mają różnych konsumentów: pole steruje kolorem hintu, formularz steruje guardem wyjścia (§9). Wartość początkowa doładowana asynchronicznie (np. z API) nie ustawia `dirty=true` przy pierwszym renderze.

## 6. Akcje i zdarzenia

input, validate, reveal conditional, submit, reset, recover. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

empty, filled, focus, invalid, validating, disabled, read-only, saving, error. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

AI wypełnia pole jako propozycję w TYM SAMYM polu, nie w osobnej kolumnie obok, i oznacza ją wizualnie do momentu akceptacji. Po akceptacji pole jest `dirty` dokładnie tak, jakby wpisał je człowiek — przechodzi tę samą walidację i ten sam `Save`, bez skrótu omijającego kontrakt formularza. AI nie klika `Submit` samodzielnie; ostatni krok mutacji jest zawsze ręczny.

## 9. Nawigacja

Próba opuszczenia formularza (Back, zamknięcie karty, nawigacja) z `isDirty=true` otwiera guard niezapisanych zmian (`PRIMITIVE_INTERACTION_CONTRACT.md` §2, wiersz Alert dialog, initial focus na Cancel) — jedyny primitive w tej piątce, gdzie samo domknięcie okna wymaga potwierdzenia niezależnie od trybu drawer/modal/inline. Powrót po zapisie przywraca formularz w stanie `saved`, nie w stanie `dirty` sprzed zapisu.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Przy 1024 px compact pola formularza nie przechodzą samowolnie w dwie kolumny bez etykiety — layout jednokolumnowy jest bezpiecznym fallbackiem tej rodziny, bo skrócona etykieta w wąskiej kolumnie łamie accessible name (§11).

## 11. Accessibility

Błąd pola ma `aria-invalid="true"` i `aria-describedby` wskazujący węzeł błędu — kolor obrysu sam nie niesie informacji (`FOUNDATION_TOKEN_CONTRACT.md` §7: „informacja nigdy wyłącznie kolorem”). Zbiorcze podsumowanie błędów na końcu formularza jest regionem/`role="alert"` z linkami do pól; kliknięcie linku przenosi focus na pole. Wymagane pole ma `aria-required="true"`, nie tylko wizualną gwiazdkę.

## 12. Visual tokens

Obowiązuje wspólna podstawa §3a. Wysokość kontrolki formularza to domyślne 36 px (input/select/textarea jednoliniowy), 32 px tylko w gęstym inline-formularzu, 44 px na touch (`FOUNDATION_TOKEN_CONTRACT.md` §4) — formularz nie definiuje własnej czwartej wysokości.

## 13. Security i privacy

Obowiązuje wspólna podstawa §3a. Formularz jest głównym miejscem, gdzie użytkownik WPROWADZA dane wrażliwe: pole z hasłem/tokenem/numerem dokumentu ma `autocomplete` ustawiony świadomie (nigdy domyślne zapamiętywanie wartości, które nie powinny trafiać do managera haseł przeglądarki) i maskuje wartość wizualnie do jawnego odsłonięcia przez użytkownika. Pole z danymi wrażliwymi (np. identyfikator klienta) nie loguje wartości do telemetryki nawet przy błędzie walidacji — event niesie action ID i typ błędu, nie treść pola.

## 14. Performance

`Submit`/`Save` blokuje duplikację: przycisk przechodzi w stan `pending` natychmiast po kliknięciu, drugi klik w oknie oczekiwania na odpowiedź jest no-op, a Enter w polu tekstowym nie wywołuje drugiego submitu równolegle z kliknięciem przycisku. Walidacja asynchroniczna (np. sprawdzenie unikalności) ma debounce i anuluje poprzedni request przy kolejnym znaku — spóźniona odpowiedź nie nadpisuje nowszego stanu pola.

## 15. Telemetry

Obowiązuje wspólna podstawa §3a. Zdarzenia specyficzne tej rodziny: `form.validation_failure` mierzone per pole (nie tylko zbiorczo — pozwala odróżnić pole, które realnie blokuje ukończenie formularza, od reszty), `form.submit_retry` po błędzie 422 (§18) i `form.abandon_at_field` — które pole było ostatnie przed porzuceniem formularza.

## 16. Miejsca użycia

shared form primitives; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`: atomy w `src/components/ui/` (`input.tsx`, `label.tsx`, `checkbox.tsx`, `radio-group.tsx`, `select.tsx`, `textarea.tsx`) istnieją, ale kompozyt `label+hint+error` powiązany przez `id` (§5) nie ma jednego wspólnego wrappera w `src/components/ui/composed/` (dziś: `CommandPalette`, `DataTable`, `EmptyState`, `MetricCard`, `SearchInput` — brak `FormField`). Osobno, `src/components/ui/primitives/` trzyma równoległy zestaw (`Input.tsx`, `Select.tsx`, `Switch.tsx`) obok `src/components/ui/*.tsx` — dwie warstwy atomów tej samej rodziny są duplikatem ostrzeganym w §2, nie referencją do wyboru dowolnie.

## 18. Acceptance tests

Test odrzucający tej rodziny, ponad resztą pakietu (`COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`): błąd serwera 422 po `Submit` zachowuje wszystkie wprowadzone wartości pól (żadne pole nie czyści się przy błędzie) i ustawia focus na pierwszym niepoprawnym polu albo na zbiorczym podsumowaniu błędów — formularz, który czyści dane albo zostawia focus na przycisku Submit po 422, nie przechodzi odbioru.

## 19. Evidence

Kandydat: brak zatwierdzonej referencji. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.
