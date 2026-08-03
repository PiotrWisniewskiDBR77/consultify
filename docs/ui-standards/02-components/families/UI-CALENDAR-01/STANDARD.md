---
component_id: UI-CALENDAR-01
name: Calendar and Timeline
family: data-view
spec_status: APPROVED_SPEC
runtime_status: PARTIAL
contract_version: 2.1
product_owner: Piotr Wisniewski
code_owner: Frontend Platform
canonical_docs:
  - docs/ui-standards/CANON.md
  - docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md
  - docs/ui-standards/02-components/PRIMITIVE_INTERACTION_CONTRACT.md
  - docs/ui-standards/00-foundation/CONTENT_LOCALE_AND_MICROCOPY_STANDARD.md
reference_implementations:
  - calendar/timeline views
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-CALENDAR-01 — Calendar and Timeline

## 1. Job to be done

Planować i oceniać zdarzenia w czasie bez utraty zakresu dat i konfliktów.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `data-view`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

range header, view switch, time grid/list, event, now marker, preview, editor. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

month, week, day, agenda, timeline. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Strefa czasowa jest jawnym polem zdarzenia (`timezone`), nie założeniem wynikającym z ustawień przeglądarki użytkownika — zdarzenie utworzone w jednej strefie i przeglądane w innej pokazuje obie wartości (lokalny czas widza + strefa oryginału), zgodnie z `CONTENT_LOCALE_AND_MICROCOPY_STANDARD.md` §3 „strefa czasowa widoczna przy harmonogramach i kolizjach”. Zakres widoku (`viewStart`/`viewEnd`) jest częścią stanu URL, nie tylko stanu komponentu — odświeżenie strony nie cofa widoku do bieżącego miesiąca.

## 6. Akcje i zdarzenia

navigate range, create, open preview, edit, move, resize, resolve conflict. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

loading, empty, populated, selected, conflict, saving, error, timezone-change. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

AI w kalendarzu proponuje termin (np. rozwiązanie kolizji, sugestię wolnego okna) jako `proposal` z konkretnym zakresem dat i strefą czasową, nigdy jako gotowe zdarzenie zapisane od razu — akceptacja tworzy zdarzenie przez tę samą ścieżkę `create`, co ręczne dodanie, więc podlega tej samej walidacji konfliktu (§9). Sugestia, która nie uwzględnia strefy czasowej właściciela kalendarza, jest błędem propozycji, nie do zaakceptowania bez korekty.

## 9. Nawigacja

Kolizje terminów (dwa zdarzenia nachodzące na siebie w czasie tego samego uczestnika) są wykrywane i pokazane wizualnie w widoku (nie tylko przy tworzeniu) — nachodzące zdarzenia renderują się obok siebie, nie jedno na drugim bez wskazania nakładania. Każda operacja drag (przesunięcie, resize) ma formularzową alternatywę (edytor zdarzenia z polami daty/godziny) — drag nigdy nie jest jedynym sposobem zmiany terminu, bo nie jest dostępny na touch bez precyzyjnego wskazania ani dla klawiatury.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Widoki month/week/day/agenda są dostępne z tego samego przełącznika (§3 view switch) na każdej szerokości — 1024 compact zawęża domyślny widok do week/agenda, ale month i day pozostają wybieralne, nie znikają z listy opcji.

## 11. Accessibility

Drag zdarzenia ma klawiaturową alternatywę zgodną z `PRIMITIVE_INTERACTION_CONTRACT.md` §2 (wiersz Drag/drop): Space podnosi zaznaczone zdarzenie, strzałki przesuwają o jednostkę siatki (godzina/dzień zależnie od widoku), Space upuszcza, Esc anuluje — wynik przesunięcia jest ogłaszany przez live region. „Now marker” (§3) nie jest jedynym wskazaniem bieżącego czasu dla czytnika ekranu — dostępny jest tekstowy odpowiednik przy nawigacji do „dziś”.

## 12. Visual tokens

Obowiązuje wspólna podstawa §3a. Slot siatki czasu (week/day) ma wysokość 48 px (zweryfikowane: `src/components/MyWork/Calendar/calendar-theme.css:63-65`, `.fc-timegrid-slot`), zbieżną z tokenem „table row default" (`FOUNDATION_TOKEN_CONTRACT.md` §4). Znacznik „dziś/teraz" jest jedynym miejscem tej rodziny, gdzie dopuszczalny jest `c.accent` na linii (nie na danych zdarzenia) — zdarzenia używają wyłącznie `c.info`/`c.success`/`c.warning`/`c.danger` per status, nigdy crimson jako koloru kategorii.

## 13. Security i privacy

Obowiązuje wspólna podstawa §3a. Uczestnik (nie właściciel) widzi status kolizji, ale nie szczegóły cudzych zdarzeń poza tytułem i czasem — zajętość bez treści. Tytuł jest jednak widoczny każdemu z dostępem do kalendarza zespołu, więc nazwa klienta wpisana wprost w tytule wycieka szerzej niż reszta danych; UI tego nie maskuje — dyscyplina nazewnictwa jest odpowiedzialnością procesu, nie komponentu.

## 14. Performance

Zakres dat a liczba zdarzeń: widok month/agenda z dużą liczbą zdarzeń w jednym dniu pokazuje limit widocznych pozycji + „+N więcej” zamiast renderować wszystkie inline — rozwinięcie „+N więcej” nie przenosi widoku do innego zakresu dat. Nawigacja między zakresami (poprzedni/następny miesiąc/tydzień) anuluje w locie poprzedni request przy szybkim przeklikiwaniu — nie renderuje danych z zakresu, który użytkownik już opuścił.

## 15. Telemetry

Obowiązuje wspólna podstawa §3a. Zdarzenia: `calendar.view_change` (month/week/day/agenda), `calendar.conflict_shown` z wyborem rozwiązania — sygnał, czy kolizje są realnym problemem operacyjnym — oraz `calendar.drag_vs_form`: czy zmiana terminu poszła przez drag czy formularzową alternatywę (§9), miara, czy alternatywa jest realnie używana.

## 16. Miejsca użycia

calendar/timeline views; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`: `src/components/MyWork/Calendar/` (istnieje: `CalendarView.tsx`, `CalendarGrid.tsx`, `CalendarSidebar.tsx`, `CalendarCreateEventModal.tsx`, oparte o `@fullcalendar/*` z `eventResize`/drag) ma mechanizm konfliktu, ale zgrepowane 2026-08-02 to `hasConflicts`/`fc-conflict` dotyczy WYŁĄCZNIE konfliktu synchronizacji z kalendarzem zewnętrznym (Google/Outlook, `CalendarView.tsx` `CalendarConflictResponse`) — nie nakładania się dwóch własnych zdarzeń w czasie (§9) ani zmiany czasu letniego (DST). Oba są dziś niepokryte w referencyjnym SSOT, nie tylko w dokumentacji; `CalendarCreateEventModal.tsx` istnieje i może pełnić rolę formularzowej alternatywy dla drag (§9), ale wymaga potwierdzenia, że jest osiągalna bez uprzedniego drag.

## 18. Acceptance tests

Test blokujący odbiór, ponad bazowym pakietem (`COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`): przejście przez zmianę czasu letniego (DST) i zdarzenia nachodzące na siebie renderują się poprawnie — zdarzenie na granicy DST nie przesuwa się o godzinę, a nachodzące zdarzenia są odróżnialne wizualnie, nie scalone w jeden blok.

## 19. Evidence

Kandydat: brak zatwierdzonej referencji. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.
