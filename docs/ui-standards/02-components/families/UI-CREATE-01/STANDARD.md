---
component_id: UI-CREATE-01
name: Create and Generator Wizard
family: workflow
spec_status: APPROVED_SPEC
runtime_status: PARTIAL
contract_version: 2.1
product_owner: Piotr Wisniewski
code_owner: Frontend Platform
canonical_docs:
  - docs/ui-standards/CANON.md
  - docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md
  - docs/ui-standards/02-components/PRIMITIVE_INTERACTION_CONTRACT.md
  - Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md#13.7
reference_implementations:
  - create flows and generators
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-CREATE-01 — Create and Generator Wizard

> Kontrakt zachowania tej karty jest zsynchronizowany z `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §13.7
> „Kontrakt generatora / wizarda (SPEC-W)” — dwie karty tego samego zjawiska, jeden model. Gdzie ten
> dokument mówi „MUST”, odsyła do konkretnego punktu SPEC-W; nie definiuje trzeciego, konkurencyjnego
> zestawu zasad.

## 1. Job to be done

Utworzyć poprawny obiekt etapami z możliwością przerwania, wznowienia i naprawy błędu.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `workflow`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

title/progress, step body, validation summary, back/cancel, next/submit, save draft. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

modal, drawer, full-page; linear/conditional. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Payload wizarda niesie **klucz idempotency** unikalny per sesja wizarda × krok wykonania (SPEC-W §13.7 pkt 8) — ponowienie submitu po timeout/błędzie sieci używa TEGO SAMEGO klucza, nigdy nowego. Szkic (`draft`) jest osobnym rekordem z `lifecycle=draft` (SPEC-W pkt 3), widocznym w liście modułu macierzystego — nie ukrytym stanem w pamięci przeglądarki, bo inaczej resume po utracie sesji (pkt 5) jest niemożliwy. Krok wykonania mutacji (generowanie w toku) NIE jest krokiem, do którego resume wraca przez proste odświeżenie strony — ten krok ma własny stan „przerwane, wznów/odrzuć” (pkt 5, pkt 10).

## 6. Akcje i zdarzenia

next, back, save draft, resume, cancel, review, submit, retry. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

initial, valid, invalid, saving, resumed, submitting, partial, error, success. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Generowanie przez AI (treść raportu, slajdy, obiekty pochodne) jest z założenia partial-failure-świadome: `intent → generation → proposal` kończy się ekranem „wygenerowano X z Y” z listą sukcesów (✓) i porażek (✗ + powód) osobno, gdzie „Ponów” działa TYLKO na nieudanych elementach (SPEC-W pkt 9). Zakazany jest cichy toast „Gotowe”, gdy część elementów się nie powiodła — to złamanie „zero silent mutation” w wersji specyficznej dla wizarda, bo tu chodzi o częściowy, nie tylko odrzucony, wynik.

## 9. Nawigacja

„Wstecz” jest dostępne na każdym kroku poza pierwszym i poza krokiem wykonania mutacji, i NIE czyści pól wypełnionych na wcześniejszych krokach — stan trzymany jest dla całego cyklu wizarda, nie per-krok (SPEC-W pkt 2). Deep link/refresh na istniejącym szkicu odtwarza wizard na tym samym kroku (pkt 5); deep link na kroku generowania pokazuje wynik albo ekran „generowanie przerwane, wznów/odrzuć”, nigdy pusty formularz od nowa.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Postęp „krok N z M" pozostaje czytelny tekstowo (nie tylko jako kółka stepper) nawet przy 1024 px compact i 200% zoom — SPEC-W pkt 1 wymaga tekstu obok steppera, nie samych kółek.

## 11. Accessibility

Aktywny krok ma `aria-current="step"`; zmiana kroku jest ogłaszana przez `aria-live="polite"` z tekstem „Krok N z M: {nazwa kroku}” (SPEC-W pkt 1). Próba „Dalej” z błędem przenosi focus na pierwsze niepoprawne pole — walidacja nie tylko podświetla je kolorem (SPEC-W pkt 6, zgodne z `FOUNDATION_TOKEN_CONTRACT.md` §7 „informacja nigdy wyłącznie kolorem”).

## 12. Visual tokens

Obowiązuje wspólna podstawa §3a. Krok steppera = kółko 24 px, aktywny `c.info` (NIGDY `c.accent`/crimson — SYS-1), zrobiony `c.success`, przyszły `c.border`, łącznik `c.border` (`ARTIFACT_ANATOMY_STANDARD.md` §9.2b ㉞) — wizard nie definiuje własnej palety kroków.

## 13. Security i privacy

Obowiązuje wspólna podstawa §3a. Dane z kroku 1 żyją w szkicu (`lifecycle=draft`, SPEC-W pkt 3, widocznym w liście modułu macierzystego — nie w pamięci przeglądarki) od utworzenia (auto przy zmianie kroku albo jawnym „Zapisz szkic") minimum do końca sesji; dłuższy TTL to decyzja per narzędzie, udokumentowana przy implementacji. Review przed mutacją (SPEC-W pkt 7) pokazuje zakres skutków wyłącznie na danych w capability użytkownika — nie ujawnia obiektów spoza tenant scope, nawet policzonych po stronie serwera.

## 14. Performance

Stan generowania pokazuje widoczny postęp (pasek/spinner `c.info`) i przycisk Stop/Anuluj bezpieczny w trakcie — nie zawiesza UI i nie gubi już wykonanej pracy (SPEC-W pkt 10). Zamknięcie karty w trakcie generowania nie gubi wyniku: po powrocie wizard pokazuje wynik albo stan „przerwane, wznów/odrzuć”, nigdy brak jakiegokolwiek śladu, że generowanie się odbyło.

## 15. Telemetry

Obowiązuje wspólna podstawa §3a. Zdarzenia: `wizard.step_enter`/`step_back`/`draft_save`/`resume`/`cancel`, z abandonment liczonym PER KROK (nie zbiorczo) — najcenniejsza metryka tej rodziny. Osobno mierzone: liczba ponowień z tym samym kluczem idempotency (niestabilna sieć/backend) i częstość „partial failure” per typ generatora.

## 16. Miejsca użycia

create flows and generators; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`, a kontrakt SPEC-W jest w praktyce NIEOBECNY w kodzie referencyjnym: `src/components/Presentations/PresentationWizard.tsx` i `src/views/OrgSetupWizard.tsx` (oba wskazane jako SSOT w `COMPONENT_RUNTIME_BINDING_REGISTRY.md`, oba istnieją) nie zawierają idempotency key, ekranu partial-failure ani mechanizmu resume — zgrepowane 2026-08-02: zero wystąpień `idempot`/`draft`/`resume`/`partial fail` w obu plikach. To był blokerem P1 audytu: `CANON.md` §8 i `UI_UX_IMPLEMENTATION_STANDARD.md` §8 obiecywały ten kontrakt, ale żaden dokument opisujący realne generatory go nie definiował operacyjnie — SPEC-W (§13.7) i ta karta domykają lukę na poziomie specyfikacji; runtime dwóch wizardów referencyjnych wymaga osobnej migracji, nie jest to dług redakcyjny tej karty.

## 18. Acceptance tests

Rozstrzygający test tej rodziny (`COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`, zgodny z SPEC-W pkt 8): odświeżenie strony w trakcie kreacji, a następnie ponowienie submitu po błędzie sieci, NIE tworzą drugiego obiektu — jeden klucz idempotency, jeden finalny rekord. Dodatkowo: refresh/resume odtwarza wizard na tym samym kroku z zachowanymi polami (nie na kroku 1), a wynik „partial failure” ma dedykowany ekran z retry tylko nieudanych elementów.

## 19. Evidence

Kandydat: Run Agent wizard = audit evidence. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami). Zsynchronizowano §5/8/9/10/11/14/17/18 z nowo dopisanym `ARTIFACT_ANATOMY_STANDARD.md` §13.7 (SPEC-W) — kontrakt idempotency/partial-failure/resume istnieje teraz operacyjnie w obu dokumentach, nie tylko w `CANON.md` §8.

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.
