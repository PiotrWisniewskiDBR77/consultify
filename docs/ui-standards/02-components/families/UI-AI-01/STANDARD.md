---
component_id: UI-AI-01
name: Teresa AI Proposal
family: ai
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
  - Teresa actions; AI proposal surfaces
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-AI-01 — Teresa AI Proposal

## 1. Job to be done

Uzyskać pomoc AI w sposób jawny, kontrolowalny i odwracalny.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `ai`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

intent trigger, scope/sources, stream, proposal, diff, approval, execution, read-back, undo. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

inline, panel, batch, generate, transform. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Zakres działania AI jest nazwany i policzalny w UI PRZED uruchomieniem (np. „zadziała na 12 zaznaczonych węzłach"), na jednym z poziomów granulacji: pole · sekcja · rekord · zaznaczenie · zbiór · (na canvasie) węzeł/gałąź/cały canvas. Zakres nigdy nie jest domyślany po cichu do „wszystko". Payload streamingu i payload propozycji to dwa oddzielne obiekty — propozycja nie nadpisuje danych zatwierdzonych, dopóki nie przejdzie przez approve. Źródła, które AI przeczytało, i poziom pewności są częścią kontraktu danych, nie tylko UI-copy, gdy wpływają na decyzję.

## 6. Akcje i zdarzenia

generate, stop, edit proposal, approve, reject, retry, undo. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

idle, gathering, streaming, proposal, edited, approved, executing, success, partial, error, cancelled. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

**Zakres najpierw, policzalnie.** Przed uruchomieniem generowania UI nazywa zakres na jednym z poziomów: pole · sekcja · rekord · zaznaczenie · zbiór · (na canvasie) węzeł/gałąź/cały canvas — np. „Teresa przeanalizuje 12 zaznaczonych węzłów". Brak jawnie nazwanego zakresu blokuje start; zakres nigdy nie jest domyślany po cichu do „wszystko" czy „bieżący widok".

**Źródła i niepewność widoczne, gdy mają znaczenie.** Gdy wynik wpływa na decyzję (rekomendacja, liczba, wniosek), UI pokazuje co AI przeczytało (lista źródeł), co założyło (luki uzupełnione domysłem) i poziom pewności. Bez tego propozycja nie jest gotowa do approve.

**Streaming nie przesuwa layoutu.** Kontener strumienia ma stabilną wysokość/pozycję — treść dopisuje się do niego, nie pulsuje cały kontener i nie przesuwa elementów poniżej. Wzorzec: `src/components/AIChat/UnifiedChatPanel.tsx` — `role="log"` + `aria-live="polite"` + `aria-relevant="additions text"` na kontenerze strumienia (zweryfikowano w kodzie).

**Proposal ≠ fakt.** Propozycja jest wizualnie odróżniona od danych już zatwierdzonych (inny token tła/obramowania, etykieta „propozycja", nigdy ten sam styl co zapisany rekord) — użytkownik nie może pomylić sugestii AI z aktualnym stanem danych.

**Diff/review przed zastosowaniem wielu zmian.** Gdy propozycja dotyka więcej niż jednego pola/rekordu, UI pokazuje diff/review — co się zmieni, gdzie — zanim jedno kliknięcie zatwierdzi wszystko naraz.

**Approve / edit / reject jako trzy równoprawne ścieżki.** Odrzucenie nie zmniejsza jakości przyszłych sugestii, nie sugeruje kary użytkownikowi ani uczenia modelu na prywatnej treści — komunikat po reject jest neutralny, nie przeprasza i nie „obiecuje poprawę". Etykiety przycisków wg `CONTENT_LOCALE_AND_MICROCOPY_STANDARD.md` §6: `Wygeneruj propozycję` / `Porównaj zmiany` / `Zastosuj`; zakazane `Napraw automatycznie`, gdy wymagana jest decyzja użytkownika.

**Undo = jedna operacja.** Zastosowana propozycja AI, nawet gdy dotyka wielu pól/rekordów, cofa się jednym undo jako pojedyncza jednostka — nie wymaga N osobnych cofnięć po jednym na pole.

**Audyt po każdej mutacji.** Każda zmiana danych wykonana po approve zapisuje kto/co/kiedy i czy pochodziła z sugestii AI (i z jakiego uruchomienia) — ten wpis jest odróżnialny od zmiany manualnej w historii obiektu.

**Zero cichej mutacji.** Żadna trwała zmiana danych nie następuje przed jawnym `Zastosuj`. Manualna ścieżka (bez AI) pozostaje zawsze dostępna równolegle.

**Anulowanie streamu = stan sprzed operacji.** Przerwanie generowania w dowolnym momencie (Stop, nawigacja, zamknięcie panelu) zostawia dane dokładnie w stanie sprzed uruchomienia — częściowy tekst strumienia nigdy nie zapisuje się jako częściowa mutacja.

## 9. Nawigacja

Opuszczenie ekranu w trakcie streamingu lub z niezatwierdzoną propozycją ostrzega jak przy niezapisanych zmianach — nawigacja nie anuluje cicho generowania w tle bez informacji. Deep link do konkretnej propozycji (jeśli ma trwały `id`) odtwarza jej stan (streaming zakończony/propozycja/edited), nie zaczyna od nowa. Focus po zamknięciu panelu AI wraca do triggera, który go otworzył (np. `FieldAIButton`).

## 10. Responsive i zoom

Podstawa: `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Panel propozycji z diff wielu pól ma na 1024 compact przełącznik lista/szczegół zamiast ściskania kolumn diff do nieczytelności.

## 11. Accessibility

Kontener streamingu: `role="log"`, `aria-live="polite"`, `aria-relevant="additions text"` (wzorzec zweryfikowany w `UnifiedChatPanel.tsx`) — czytnik ogłasza przyrosty tekstu bez przenoszenia focusu widza. Przyciski `Zastosuj`/`Odrzuć` mają cel dotykowy min. 36 desktop/44 touch i nie są aktywne, dopóki generowanie trwa (stan `pending` blokuje przypadkowy submit). Diff komunikuje różnicę nie tylko kolorem (dodatkowo ikona/etykieta +/−).

## 12. Visual tokens

Podstawa: §3a. Etykieta „propozycja" i tło propozycji korzystają z `--c-info`/neutral, nigdy z `primary-*` (crimson) — crimson w AI jest zarezerwowany wyłącznie dla wejścia Talk-to-Teresa, nie dla treści wygenerowanej.

## 13. Security i privacy

Podstawa: §3a. To jest rdzeń bezpieczeństwa tej rodziny, więc kontrakt wykracza poza podstawę: treść klienta wysyłana do modelu (prompt + kontekst/źródła, §5) jest jawnie nazwana w kontrakcie żądania, nie dobierana niejawnie przez UI. Prompt i odpowiedź modelu nie trafiają do standardowej telemetrii produktowej (§15) — jeśli są logowane do celów operacyjnych, to w osobnym kanale objętym polityką retencji, nie w evencie UI. Propozycja AI nigdy nie ujawnia treści z obiektów, do których użytkownik nie ma dostępu, nawet jeśli model miał do nich dostęp w trakcie generowania — diff (§8) nie pokazuje takich pól/rekordów. Treść klienta użyta w promptach i kontekście nie jest wykorzystywana do trenowania ani fine-tuningu modelu, ani globalnie, ani per-tenant.

## 14. Performance

Generowanie ma limit czasu z widocznym recovery („generowanie trwa dłużej niż zwykle — Anuluj / Czekaj"); anulowanie strumienia (AbortController lub odpowiednik) jest natychmiastowe i nie zostawia procesu wiszącego po stronie UI. Czas do pierwszego tokenu i czas do końca strumienia są mierzone. Kontener strumienia ma stabilny min-height, żeby przyrost tekstu nie generował layout shift.

## 15. Telemetry

Podstawa: §3a. Zdarzenia: `ai.generate_start`, `ai.stream_cancel`, `ai.proposal_shown`, `ai.approved`, `ai.rejected`, `ai.edited`, `ai.undo` — bez treści promptu i bez treści odpowiedzi. Kluczowa metryka: stosunek approve do reject per typ propozycji, jako sygnał jakości promptów/modelu — nigdy jako ranking `AI acceptance rate` per pracownik.

## 16. Miejsca użycia

Teresa actions; AI proposal surfaces; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowano 2026-08-02: `src/components/shared/NModeLayout/FieldAIButton.tsx` istnieje, ale jest wejściem na poziomie pojedynczego pola — wymóg „zakres nazwany i policzalny przed uruchomieniem" (§8) dla poziomów sekcja/rekord/zaznaczenie/zbiór/canvas nie ma potwierdzonej wspólnej implementacji poza tym jednym triggerem. `src/components/AIChat/UnifiedChatPanel.tsx` (258 KB) koncentruje dużą część logiki AI w jednym pliku — ryzyko rozjazdu wzorców streamingu/undo między nim a `FieldAIButton.tsx` wymaga audytu przed podniesieniem `runtime_status`.

## 18. Acceptance tests

Light/dark; PL/EN; 1280/1440/1920; 125%/200%; keyboard; VoiceOver/NVDA smoke; target size; contrast; reduced motion; long/empty/error/no-access; slow/timeout/retry/conflict; visual regression oraz krytyczny E2E. Dodatkowo: undo po zastosowaniu wielopolowej propozycji cofa całość jednym działaniem, nie pole po polu; zakres działania jest widoczny i policzalny w UI przed każdym uruchomieniem.

## 19. Evidence

Kandydat: brak zatwierdzonej referencji. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami); sekcja 8 przepisana na konkretny kontrakt granulacji zakresu, streamingu, proposal-vs-fakt, diff/undo-jako-jednostka i zero-cichej-mutacji.

