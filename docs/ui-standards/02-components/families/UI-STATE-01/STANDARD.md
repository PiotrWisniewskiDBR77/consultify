---
component_id: UI-STATE-01
name: System States
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
  - empty-loading/error components
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-STATE-01 — System States

## 1. Job to be done

Komunikować rzeczywisty stan danych i zawsze proponować właściwy następny krok.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `system`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

state illustration/icon, title, explanation, primary recovery, secondary help, technical ID optional. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

loading, empty-first, empty-filtered, partial, error, offline, no-access, archived. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Ten komponent nie posiada własnych danych domenowych — niesie wyłącznie deskryptor stanu nadrzędnego ekranu: `state` (jeden z ośmiu wariantów z §4), `scope` (który region jest w tym stanie — cały ekran, sekcja, pojedyncza kolumna), `reason` (kod przyczyny: brak danych / aktywny filtr / timeout / 403 / offline), `lastSuccessAt` (znacznik ostatniego udanego odczytu, wymagany dla `stale` — bez niego UI nie odróżni „świeżo puste” od „kiedyś było, teraz nie wiadomo”) oraz `retryToken` powiązany z konkretnym zapytaniem, nie z całym ekranem. `empty-first-use` i `empty-filtered` są rozróżniane obecnością aktywnych parametrów filtra/query w kontrakcie wywołania, nie zliczeniem zer wierszy — te same zero wierszy niosą inny komunikat.

## 6. Akcje i zdarzenia

retry, reset filter, create, reconnect, request access, return. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

all canonical system states. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Ten komponent nie inicjuje generowania — obsługuje wyłącznie stan otaczający wywołanie Teresy. Streaming renderuje się przez ten sam słownik stanów (`loading` = pierwszy token, `partial` = trwający strumień, `error` = przerwany strumień z zachowanym dotychczasowym tekstem), nie przez osobny spinner „AI myśli”. Odświeżenie danych zainicjowane przez Teresę w tle jest z natury `stale → loading → loaded` bez czyszczenia ekranu (patrz §14) — to jedyne miejsce kontraktu, gdzie źródłem zdarzenia bywa agent, nie użytkownik, więc retry po błędzie AI musi być tym samym action ID co retry manualny, nie cichym duplikatem.

## 9. Nawigacja

Nawigacja wewnątrz stanu nie istnieje — to nie osobna trasa, tylko renderowany stan bieżącego route’u; Back/Forward przeglądarki nie ma zastosowania między `loading` a `error` tego samego zapytania. Deep link trafiający w moment `error`/`no-access` renderuje właściwy stan natychmiast, bez pośredniego `loading`, tam gdzie przyczyna jest znana z góry (np. brak capability). Po `retry` fokus zostaje na przycisku retry aż do rozstrzygnięcia, a po sukcesie ląduje na pierwszym elemencie odzyskanej treści.

## 10. Responsive i zoom

Podstawa: `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Skeleton musi odpowiadać layoutowi docelowej treści (liczbie i wysokości placeholderów) w KAŻDYM odbiorowym viewporcie, nie tylko na jednej referencyjnej szerokości — rozjazd wysokości między skeletonem a danymi jest wizualnym skokiem przy 125% (obowiązkowa visual regression z §3a), którego ten kontrakt zakazuje.

## 11. Accessibility

Region stanu ma `role="status"` (informacyjny) lub `role="alert"` (błąd/no-access) z `aria-live` dobranym do wagi — `polite` dla loading/empty/stale, `assertive` wyłącznie dla error i no-access, nigdy odwrotnie. Ikona stanu jest dekoracyjna (`aria-hidden`), znaczenie niesie tekst tytułu i wyjaśnienia. Focus po wejściu w stan error/no-access przenosi się na primary recovery — nie zostaje uwięziony na wcześniej klikniętym elemencie, który już zniknął. Czytnik ekranu odczytuje kolejność: tytuł → wyjaśnienie → primary → secondary, nigdy technical ID jako pierwsze.

## 12. Visual tokens

Podstawa: §3a. Ikona stanu pochodzi z ustalonej pary per wariant (np. `wifi-off` dla offline, `lock` dla no-access) — dowolna ikona spoza tej pary jest naruszeniem, bo użytkownik uczy się rozpoznawać stan po kształcie, zanim przeczyta tekst.

## 13. Security i privacy

Podstawa: §3a. Treść komunikatu `no-access` nigdy nie ujawnia nazwy, ID ani liczby zasobów, do których brak dostępu — tekst jest ogólny („Brak dostępu do tej sekcji”), szczegóły trafiają wyłącznie do telemetrii wewnętrznej. Komunikat stanu `error` nigdy nie renderuje surowej odpowiedzi serwera (stack trace, treść wyjątku, nagłówki) — wyłącznie przetłumaczony, ogólny opis błędu, z technical ID opcjonalnie widocznym do zgłoszenia.

## 14. Performance

Timeout progu 10 s przełącza `loading` w `error+retry`, ale NIE czyści dotychczas wyrenderowanych danych, jeśli takie były (przypadek `stale`) — to jest krytyczny test §18 tej karty. Debounce dotyczy wyłącznie stanu `empty-filtered` powiązanego z polem wyszukiwania (250–350 ms), nigdy samego przejścia `loading → loaded`. Wirtualizacja nie jest własnością tego komponentu — jeśli lista pod spodem wirtualizuje, stan pusty/błędu renderuje się ponad wirtualizowaną listą, nie jako jej wiersz.

## 15. Telemetry

Podstawa: §3a. Zdarzenia: `state.timeout_shown`, `state.retry_clicked`, `state.stale_served`, plus `state_duration_ms` per wariant. `timeout_shown` to bezpośrednia miara jakości backendu, nie UI — jeśli `loading` regularnie przekracza próg 10 s dla danego ekranu (§14), to sygnał do zmiany zapytania, nie do podniesienia progu.

## 16. Miejsca użycia

empty-loading/error components; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowane w kodzie: `src/components/shared/ModuleHub/HubWorkAreaLoading.tsx` i `HubWorkAreaLoadError.tsx` istnieją i obsługują dwa z ośmiu wariantów (loading, error) na poziomie huba modułu; pozostałe sześć (`empty-first-use`, `empty-filtered`, `partial`, `stale`, `offline`, `no-access`) nie mają wspólnej implementacji — każdy moduł, który ich potrzebuje, dziś improwizuje lokalnie. To jest realny dług, nie hipoteza: zanim ta karta przejdzie z `PARTIAL`, potrzebny jest jeden komponent obsługujący wszystkie osiem wariantów z §4, nie tylko dwa.

## 18. Acceptance tests

Krytyczny test odrzucający: odświeżenie danych w tle (Teresa lub polling) NIE czyści widocznej treści przed przybyciem nowej — użytkownik nigdy nie widzi pustego ekranu między dwoma poprawnymi stanami. Dodatkowo: timeout >10 s pokazuje retry z zachowaniem ostatnich danych (§14); wszystkie osiem wariantów z §4 ma odrębny zrzut light+dark; `empty-first-use` i `empty-filtered` różnią się treścią komunikatu przy identycznej liczbie wierszy (zero).

## 19. Evidence

Kandydat: brak zatwierdzonej referencji. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.
