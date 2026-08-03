---
component_id: UI-PERM-01
name: Permission and Capability Gate
family: system
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
  - permission/capability layer
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-PERM-01 — Permission and Capability Gate

## 1. Job to be done

Pokazać wyłącznie legalne możliwości bez ujawniania poufnych danych.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `system`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

capability source, gate, locked/hidden state, reason, request access optional. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

hidden, disabled-with-reason, read-only, redacted, no-access. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Capability jest pobierana z serwera per obiekt i akcja (nie wyprowadzana z nazwy roli po stronie klienta) i re-walidowana bezpośrednio przed akcją nieodwracalną, nie tylko cache'owana przy wejściu na ekran. Odpowiedź 403 rozróżnia `brak dostępu` / `read-only` / `funkcja poza MVP` jako trzy oddzielne kody, nie jeden ogólny błąd. Żaden z tych kodów nie zwraca nazwy ani istnienia obiektu, do którego dostępu odmówiono.

## 6. Akcje i zdarzenia

evaluate, request, refresh, navigate safe fallback. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

loading capability, allowed, denied, expired, degraded, error. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Akcje Teresy podlegają dokładnie tej samej bramce capability co akcje manualne — nie istnieje osobna ścieżka „AI ominie sprawdzenie". Propozycja AI, która mutowałaby obiekt spoza uprawnień użytkownika, jest blokowana PRZED wygenerowaniem (nie dopiero przy próbie zastosowania), a komunikat blokady jest tym samym tekstem non-disclosure co przy akcji manualnej — użytkownik nie dowiaduje się z treści błędu AI niczego, czego nie dowiedziałby się z ręcznej próby.

## 9. Nawigacja

Deep link do obiektu bez capability nie renderuje 404 z treścią różną od komunikatu „brak dostępu" — obie sytuacje (obiekt nie istnieje / obiekt istnieje, ale brak uprawnień) dają identyczny widok i komunikat, żeby różnica w odpowiedzi nie ujawniała istnienia obiektu. Przekierowanie na bezpieczny fallback (lista/dom) następuje po sprawdzeniu server-side, przed commitem trasy po stronie klienta.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Komunikat non-disclosure mieści się w layout bez skracania do punktu, w którym traci znaczenie na 1024 compact.

## 11. Accessibility

Zablokowana/ukryta kontrolka ma jawny tekst przyczyny dostępny dla czytnika ekranu (nie tylko atrybut `disabled` bez etykiety), przy czym treść przyczyny jest sformułowana ogólnie i nie ujawnia poufnej tożsamości obiektu. Fokus nigdy nie ląduje na elemencie w wariancie `hidden`.

## 12. Visual tokens

Obowiązuje wspólna podstawa §3a. Wariant `redacted` maskuje wartość stałym wzorcem tokenu, nie placeholderem sugerującym realną długość/format danych.

## 13. Security i privacy

Obowiązuje wspólna podstawa §3a. To jest rdzeń tej rodziny: 403 i 404 nie mogą różnić się treścią — obiekt nieistniejący i obiekt istniejący-ale-zablokowany dają identyczny komunikat, żeby różnica w odpowiedzi nie zdradzała istnienia obiektu (rozwinięcie w §9). 403 nie ujawnia nazwy ani istnienia poufnego obiektu również wtedy, gdy poprzedzała go zmiana optymistyczna — ta zmiana jest wtedy cofana bez pokazania, co dokładnie było zablokowane.

## 14. Performance

Anulowanie stale requests, stabilne skeletony, debounce tylko dla search, cache z invalidacją i wirtualizacja adekwatna do danych. Focus i selection nie mogą ginąć podczas wirtualizacji. Spinner >10 s wymaga recovery. Wynik capability jest unieważniany natychmiast po każdym 403 z serwera — kolejna próba wymusza świeże sprawdzenie, nie ponowne użycie stanu sprzed odmowy.

## 15. Telemetry

Obowiązuje wspólna podstawa §3a. Zdarzenia specyficzne tej rodziny: `perm.denied_shown` i `perm.access_requested`, oba BEZ identyfikatora obiektu, do którego odmówiono dostępu — event niesie `denied_reason` (kategoria: brak dostępu/read-only/poza MVP), nigdy ID ani nazwę obiektu, żeby telemetria sama nie stała się kanałem wycieku, który blokuje §13.

## 16. Miejsca użycia

permission/capability layer; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowano 2026-08-02: `src/components/access/AccessBlockedModal.tsx` istnieje i jest osadzony globalnie w `src/layouts/MainLayout.tsx` jako jeden modal. Architektura = pojedyncza globalna bramka modalna; nie potwierdzono osobnej implementacji wariantów inline (`disabled-with-reason`, `redacted` przy polu/wierszu) — wymaga audytu, czy takie warianty istnieją gdziekolwiek poza modalem, zanim runtime przejdzie dalej niż `PARTIAL`.

## 18. Acceptance tests

Light/dark; PL/EN; 1280/1440/1920; 125%/200%; keyboard; VoiceOver/NVDA smoke; target size; contrast; reduced motion; long/empty/error/no-access; slow/timeout/retry/conflict; visual regression oraz krytyczny E2E. Dodatkowo: trzy warianty odmowy (`brak dostępu`/`read-only`/`poza MVP`) pokazują trzy różne komunikaty, nie jeden wspólny tekst.

## 19. Evidence

Kandydat: brak zatwierdzonej referencji. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

