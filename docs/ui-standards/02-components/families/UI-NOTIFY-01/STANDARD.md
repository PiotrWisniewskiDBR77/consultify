---
component_id: UI-NOTIFY-01
name: Toast Banner Notification
family: feedback
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
  - toast/banner system
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-NOTIFY-01 — Toast Banner Notification

## 1. Job to be done

Poinformować o wyniku i dać właściwy recovery bez kradzieży focusu.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `feedback`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

icon, title, message, optional action, close, progress/time. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

toast, inline banner, blocking callout, system notification. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Powiadomienie niesie: `source` (system/user/integration/AI-outcome), `urgency` (info/warning/critical — steruje wariantem toast vs blocking callout), `read_state` zapisywany po stronie serwera (nie tylko lokalnie), opcjonalny `target` (route/obiekt, do którego prowadzi „open details") i `dedupe_key`, żeby to samo zdarzenie nie wygenerowało dwóch toastów. `read_state` i licznik badge są odczytywane z serwera po każdej zmianie — lokalny inkrement/dekrement bez read-back jest niedozwolony.

## 6. Akcje i zdarzenia

dismiss, retry, undo, open details. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

info, success, warning, error, pending, persistent, queued. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Powiadomienie może informować o WYNIKU akcji AI (np. „Teresa wygenerowała propozycję" lub „Teresa zakończyła zbiorczą operację"), ale samo nigdy nie jest miejscem decyzji: nie hostuje approve/reject/diff. Toast z wynikiem AI ma etykietę źródła (`Teresa`) i link „Otwórz" prowadzący do właściwej powierzchni UI-AI-01, gdzie decyzja faktycznie zapada. Notyfikacja o zakończonym działaniu AI nie znika szybciej niż wynika z §14 tylko dlatego, że dotyczy AI — czas życia zależy od `urgency`, nie od źródła.

## 9. Nawigacja

Toast nie jest widokiem z własnym URL i nie zmienia scrolla strony pod spodem. Akcja „otwórz szczegóły" nawiguje do docelowego obiektu; sam toast nie ma deep linku. Esc zamyka tylko najświeżej sfokusowany toast, nie całą kolejkę. Pojawienie się i zniknięcie toastu nie przesuwa focusu widniejącego na formularzu — focus wraca do toastu tylko wtedy, gdy użytkownik świadomie po niego sięga (Tab).

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Toast zachowuje `max-w-[420px]` (zweryfikowane w kodzie: `src/components/ui/toast.tsx:79`) na każdej szerokości od 1024 compact w górę i nie zasłania paska akcji pod spodem.

## 11. Accessibility

`role="status"` dla info/success, `role="alert"` dla błędu blokującego (kontrakt: `PRIMITIVE_INTERACTION_CONTRACT.md`). Toast nigdy nie przejmuje focusu automatycznie — czyta go tylko live region. Akcja w toaście (np. „Cofnij") jest osiągalna Tabem, ale nie jest auto-fokusowana. Kolor urgency nigdy nie jest jedynym nośnikiem znaczenia — towarzyszy mu etykieta tekstowa.

## 12. Visual tokens

Obowiązuje wspólna podstawa §3a. Toast korzysta z `z-toast` (warstwa 100, `FOUNDATION_TOKEN_CONTRACT.md` §8) — nigdy z `modal` (60) ani `overlay` (50), żeby nie chować się pod nimi; czas życia i persystencja błędu są kontraktem Performance (§14), nie tokenem wizualnym.

## 13. Security i privacy

Obowiązuje wspólna podstawa §3a. Treść toastu pojawia się globalnie, poza kontekstem obiektu i niezależnie od capability odbiorcy — więc nie może zawierać poufnych detali (nazwy klienta, kwoty, treści pola), tylko ogólny wynik akcji i link do miejsca, gdzie szczegóły są dostępne po sprawdzeniu uprawnień.

## 14. Performance

Widoczne naraz toasty mają twardy limit (kolejkowanie); nadmiar zwija się do „+N więcej", żeby jedno zdarzenie zalewowe (np. import 50 rekordów) nie zasypało ekranu 50 toastami. Czas życia 4–8 s dla info/success, error jest trwały do ręcznego zamknięcia (`PRIMITIVE_INTERACTION_CONTRACT.md`). Pauza na hover/focus. Licznik badge to odczyt z serwera po evencie, nie lokalna arytmetyka.

## 15. Telemetry

Obowiązuje wspólna podstawa §3a. Zdarzenia: `notify.shown`/`read`/`dismissed`/`action_clicked` oraz `queued_dropped` — ile powiadomień nie zmieściło się w limicie kolejki. Osobno mierzony jest wskaźnik „czy powiadomienie kradnie fokus" — czy pojawienie się toastu realnie przesunęło focus z aktywnego pola (naruszenie §9), nie tylko deklaracja, że tak się nie dzieje.

## 16. Miejsca użycia

toast/banner system; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowano 2026-08-02: `src/components/Notifications/` zawiera wyłącznie `notificationContent.ts` (treści/konfiguracja), nie komponent kolejki toastów ani inbox. Faktyczny panel/inbox znaleziono pod `src/components/MyWork/Notifications/NotificationCenter.tsx` — rejestr wiązań tego pliku nie wymienia, do poprawienia w `COMPONENT_RUNTIME_BINDING_REGISTRY.md`. `src/components/ui/toast.tsx` nie ma w kodzie `role="status"`/`role="alert"` ani `aria-live` — rozjazd z wierszem Toast w `PRIMITIVE_INTERACTION_CONTRACT.md` (weryfikacja: brak dopasowań `role=`/`aria-live` w pliku).

## 18. Acceptance tests

Light/dark; PL/EN; 1280/1440/1920; 125%/200%; keyboard; VoiceOver/NVDA smoke; target size; contrast; reduced motion; long/empty/error/no-access; slow/timeout/retry/conflict; visual regression oraz krytyczny E2E. Dodatkowo: licznik badge po zamknięciu toastu odpowiada odczytowi z serwera, nie lokalnemu stanowi przed odświeżeniem.

## 19. Evidence

Kandydat: brak zatwierdzonej referencji. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

