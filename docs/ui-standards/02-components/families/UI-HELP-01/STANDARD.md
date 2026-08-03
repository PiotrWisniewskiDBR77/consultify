---
component_id: UI-HELP-01
name: Help and Intro
family: guidance
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
  - help/intro system
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-HELP-01 — Help and Intro

## 1. Job to be done

Wyjaśnić funkcję w kontekście bez blokowania pracy i bez zastępowania dobrego UI.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `guidance`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

context help trigger, intro, steps, examples, learn-more, dismiss. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

tooltip, inline, coachmark, intro panel, empty guidance. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Temat pomocy jest kluczowany trasą i typem obiektu (`route+objectType`, nie wolny tekst), ma `version` treści i `source` (kurowana dokumentacja vs treść wspomagana AI). Gdy temat dla danej trasy nie istnieje, panel pokazuje jawny fallback (wyszukiwarka/kontakt), nigdy pustą ramę. Stan „przeczytane/odrzucone" per temat jest zapisywany po stronie użytkownika, nie tylko w pamięci karty.

## 6. Akcje i zdarzenia

open, next, back, dismiss, reopen. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

unseen, active, completed, dismissed, unavailable. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Pomoc może zawierać fragment wygenerowany przez AI (np. „wyjaśnij to pole"), ale jest wizualnie odróżniony od treści kurowanej i podpisany jako wygenerowany. Ten fragment wyłącznie wyjaśnia — nie proponuje ani nie wykonuje żadnej mutacji danych, więc nie ma tu approve/reject/diff. Treść pomocy (kurowana i AI) nigdy nie opisuje funkcji niedostępnej dla roli użytkownika — sekcja pomocy respektuje tę samą granicę widoczności co reszta UI, nie tylko o niej informuje.

## 9. Nawigacja

Panel pomocy otwiera się bez zmiany trasy — nie tworzy wpisu w historii, który Back miałby zamykać. Deep link do konkretnego tematu jest możliwy przez identyfikator tematu w parametrze. Zamknięcie oddaje focus triggerowi (przycisk „?" lub link „Dowiedz się więcej"). W trybie intro (multi-step) `Next`/`Back` poruszają się po krokach sekwencji, nie po historii przeglądarki.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Coachmark przy 200% zoomu pozostaje przypięty do właściwego elementu i nie zasłania go całkowicie.

## 11. Accessibility

Tooltip/coachmark nie przechwytuje focusu jak modal — jest czytany przez `aria-describedby` powiązany z triggerem, focus zostaje na elemencie źródłowym. Intro panel z krokami ogłasza „krok X z Y" przy każdej zmianie. Dismiss jest osiągalny klawiaturą bez konieczności najechania myszą.

## 12. Visual tokens

Obowiązuje wspólna podstawa §3a. Ikona pomocy (`?`) ma stały rozmiar i pozycję względem etykiety pola — nie przesuwa layoutu przy pojawieniu się treści.

## 13. Security i privacy

Obowiązuje wspólna podstawa §3a. Treść pomocy nie wymienia nazw pól ani funkcji zarezerwowanych dla ról, do których użytkownik nie ma dostępu — opis funkcji niedostępnej dla roli byłby wyciekiem mapy uprawnień, nawet jeśli sama funkcja jest ukryta gdzie indziej w UI.

## 14. Performance

Treść tematu ładowana jest leniwie per `topic id`, nie jako jeden pakiet wszystkich tematów. Wyszukiwanie w panelu pomocy ma debounce zgodny z progiem wyszukiwania (250–350 ms). Otwarcie panelu nie blokuje interakcji z resztą ekranu (non-modal), więc nie występuje tu przypadek spinnera >10 s blokującego pracę.

## 15. Telemetry

Obowiązuje wspólna podstawa §3a. Zdarzenia specyficzne tej rodziny: `help.topic_open`, `help.topic_missing` — ile razy trasa nie miała zdefiniowanego tematu, bezpośrednia miara pokrycia tras tematami — i `help.search_no_result`, sygnał luki w treści albo w indeksie wyszukiwania.

## 16. Miejsca użycia

help/intro system; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowano 2026-08-02: `src/components/layout/HelpPanel.tsx` i `src/config/helpContent.ts` istnieją. `helpContent.ts` ma ograniczoną liczbę zdefiniowanych tematów — pokrycie tras nie zostało zmierzone; do audytu, ile tras faktycznie trafia w fallback zamiast w dedykowany temat.

## 18. Acceptance tests

Light/dark; PL/EN; 1280/1440/1920; 125%/200%; keyboard; VoiceOver/NVDA smoke; target size; contrast; reduced motion; long/empty/error/no-access; slow/timeout/retry/conflict; visual regression oraz krytyczny E2E. Dodatkowo: treść pomocy dla roli o ograniczonym dostępie nie wymienia funkcji, których ta rola nie widzi gdzie indziej w UI.

## 19. Evidence

Kandydat: brak zatwierdzonej referencji. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

