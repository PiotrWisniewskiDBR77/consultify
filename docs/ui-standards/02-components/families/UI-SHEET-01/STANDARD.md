---
component_id: UI-SHEET-01
name: Drawer and Side Panel
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
  - IdeaNodeDetailDrawer
  - InitiativeDrawer
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-SHEET-01 — Drawer and Side Panel

## 1. Job to be done

Pokazać, podejrzeć lub wyedytować jeden obiekt obok listy, tabeli albo canvasu — bez opuszczania i bez przeładowania widoku macierzystego.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `primitive` i chodzi o boczny panel otwierany z listy, tabeli lub canvasu. Nie używaj jako zamiennika pełnoekranowego modala (`UI-OVERLAY-01`) ani jako podstawy pełnego widoku artefaktu z własną tożsamością i URL-em — do tego prawy panel SPEC-A (`UI-ART-01`). Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

header (kicker, tytuł, [pin/link], close), scroll region będący własnością treści panelu, opcjonalne sekcje treści (meta, detale, relacje, AI), footer z akcjami. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

preview (non-modal, complementary, nie blokuje listy pod spodem) i edit/create (modal, trap fokusu — zastrzeżenie realnego stanu w §17/§11). Szerokość NIE jest dziś jednolita 360/320–420 px — to wartość prawego panelu artefaktu SPEC-A (`ARTIFACT_ANATOMY_STANDARD.md` §9.1a), innej powierzchni niż drawer tej karty. Zmierzone w realnych implementacjach referencyjnych (2026-08-02): `IdeaNodeDetailDrawer.tsx:595` — `w-[420px] max-w-[90vw]` (stała szerokość 420 px); `InitiativeDrawer.tsx:905` — `w-1/2 max-w-3xl min-w-[480px]` (50% szerokości viewportu, zakres ~480–768 px, komentarz w kodzie linia 903: „Drawer Panel — 50% width"). Te dwie referencyjne implementacje NIE zgadzają się ze sobą (420 px stałe vs 50%/480–768 px) — to jest dług, nie do uśrednienia: dopóki obie żyją w kodzie, karta nie może twierdzić jednej normatywnej szerokości bez decyzji, która implementacja jest kanoniczna. Wariant zmienia semantykę blokowania, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Właścicielem scrolla jest wyłącznie treść panelu (`overflow-y-auto` wewnątrz drawera) — strona pod spodem nigdy nie przewija się razem z otwartym panelem, a jej scrollbar nie znika. Payload niesie stabilne `id` otwartego obiektu, `mode` (`preview`/`edit`) i `origin` (trigger, do przywrócenia focusu przy zamknięciu). Wariant edycyjny dodatkowo niesie `dirty` i `lastSavedAt`; wariant podglądu jest read-only i nie ma stanu `dirty`. Zamknięcie podglądu nigdy nie czeka na zapis — zamknięcie wariantu edycyjnego z `dirty=true` czeka (§9).

## 6. Akcje i zdarzenia

otwórz, zamknij, przełącz edycję, zapisz, anuluj, przypnij/odepnij, otwórz w pełnym widoku. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

closed, opening, preview, editing, dirty, saving, saved, error, closing-guarded. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Panel podglądu pokazuje wynik AI (streszczenie, sugestię) wyłącznie jako read-only chip prowadzący do pełnego widoku — sam nie inicjuje generowania, bo przy 320–420 px nie ma miejsca na diff/approve. Panel edycyjny może osadzić akcję AI przy pojedynczym polu; wynik trafia do TEGO SAMEGO pola co ręczna edycja, nigdy do osobnej kolumny obok. Zamknięcie panelu w trakcie trwającego generowania AI jest wstrzymywane i ostrzega użytkownika — nie przerywa generowania cicho.

## 9. Nawigacja

Panel podglądu (`complementary`, non-modal) NIE blokuje interakcji ze stroną pod spodem — kliknięcie kolejnego wiersza podmienia treść panelu bez jego zamykania. Panel edycyjny (`dialog`, modalny) trzyma trap fokusu do zamknięcia. Esc na panelu podglądu zamyka natychmiast; Esc na panelu edycyjnym z `dirty=true` otwiera guard niezapisanych zmian zamiast zamykać. Deep link do obiektu otwiera panel we właściwym trybie bez przeładowania listy pod spodem.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Stopka akcji drawera (Zapisz/Anuluj albo Otwórz/×) pozostaje w pełni widoczna i klikalna przy 200% zoom nawet gdy treść panelu jest dłuższa niż viewport — to jest krytyczny test odrzucający tej rodziny (§18), nie zwykła preferencja.

## 11. Accessibility

Panel podglądu ma rolę `complementary`/`region` z accessible name równym tytułowi obiektu i bez trap fokusu — Tab może opuścić panel w stronę strony pod spodem. Panel edycyjny POWINIEN mieć `role="dialog"`, `aria-modal="true"`, trap Tab/Shift+Tab i initial focus na tytule lub pierwszym bezpiecznym polu (`PRIMITIVE_INTERACTION_CONTRACT.md` §2, wiersz Drawer/Sheet) — to jest normatywny kontrakt tej rodziny, NIE dzisiejszy stan runtime. **Known gap, zweryfikowany 2026-08-02** (audyt siostrzanej karty `UI-OVERLAY-01` §17 na tym samym pliku `src/components/ui/sheet.tsx`): `role="dialog"`/`aria-modal="true"` SĄ obecne (l. ~119–120), ale trap Tab/Shift+Tab NIE JEST zaimplementowany — `grep` po `Escape`/`onKeyDown` w `sheet.tsx` daje zero wystąpień, żaden focus manager nie przechwytuje Tab na granicy panelu. Deweloper czytający tylko tę kartę nie może zakładać, że trap działa — działa tylko deklaracja ARIA, nie zachowanie klawiatury. Esc na wariancie edycyjnym POWINIEN zamykać tylko przy braku niezapisanych zmian — dziś Esc w ogóle nic nie zamyka w `sheet.tsx` (ten sam brak). Zamknięcie POWINNO oddawać focus do triggera — restore focusu też nie jest zaimplementowany (`UI-OVERLAY-01` §11/§17).

## 12. Visual tokens

Obowiązuje wspólna podstawa §3a. Szerokość panelu to jedyny wymiar tej rodziny regulowany osobno od modala — ale runtime dziś NIE ma jednej wartości (zweryfikowane w kodzie, 2026-08-02): `IdeaNodeDetailDrawer.tsx:595` — 420 px stałe; `InitiativeDrawer.tsx:905` — 50% viewportu (min 480/max 768 px, komentarz w kodzie l. 903). Rozjazd jest długiem, nie do uśrednienia bez decyzji, która implementacja jest kanoniczna (§17). 360 px domyślnie / 320–420 px zakres należy do INNEJ powierzchni — prawego panelu artefaktu SPEC-A (`UI-ART-01`/`ARTIFACT_ANATOMY_STANDARD.md` §9.1a) — nie do tego drawera, nie mylić przy implementacji.

## 13. Security i privacy

Obowiązuje wspólna podstawa §3a. Panel otwarty deep-linkiem do obiektu spoza tenant scope zwraca 403 przed renderem treści — nigdy nie miga tytułem ani metadanymi obiektu, do którego dostęp już wygasł.

## 14. Performance

Podmiana treści panelu przy kolejnym kliknięciu wiersza (bez zamykania/otwierania) anuluje w locie poprzedni request i nie pokazuje starej treści dłużej niż do przyjścia nowej odpowiedzi — brak migotania starym `id` pod nowym tytułem. Panel edycyjny z długą treścią pola wirtualizuje tylko wewnętrzną listę, nie cały panel; wysokość panelu i pozycja scrolla strony pod spodem pozostają stabilne przy każdym otwarciu i zamknięciu.

## 15. Telemetry

Obowiązuje wspólna podstawa §3a. Osobno mierzony jest czas między otwarciem panelu podglądu a kliknięciem „Open" (przejściem do pełnego widoku) — sygnał, że panel podglądu jest za wąski na daną treść.

## 16. Miejsca użycia

IdeaNodeDetailDrawer, InitiativeDrawer; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`: `src/components/MyWork/IdeaNodeDetailDrawer.tsx` i `src/components/Initiatives/InitiativeDrawer.tsx` (`COMPONENT_RUNTIME_BINDING_REGISTRY.md`) nie są jeszcze zweryfikowane pod kątem podziału preview/edit z tej karty — oba pliki dziś obsługują zarówno podgląd, jak i edycję w jednym drawerze, co jest dokładnie duplikatem ostrzeganym w §2 („lokalna kopia zamiast wariantu”). Migracja = rozdzielić `mode` na dwa zachowania (non-modal preview vs modal edit z trap), nie przepisać UI od zera. Dodatkowo: szerokość drawera NIE jest dziś jednolita — `IdeaNodeDetailDrawer` 420 px stałe, `InitiativeDrawer` 50% viewportu (min 480/max 768 px) — patrz §4/§12, zweryfikowane 2026-08-02.

**Known gap — brak focus trap (P1, zweryfikowano 2026-08-02, źródło: audyt `UI-OVERLAY-01` §17 na `src/components/ui/sheet.tsx`).** §11 tej karty opisuje wariant edycyjny jako `role="dialog"`+`aria-modal="true"`+trap Tab/Shift+Tab jako WYMÓG normatywny — to nie jest dzisiejszy stan runtime. `sheet.tsx` MA `role="dialog"`/`aria-modal="true"` (l. ~119–120), ale nie ma żadnej obsługi `Escape`/`onKeyDown` (zero wystąpień w pliku) ani focus trap na Tab/Shift+Tab, ani focus restore do triggera po zamknięciu. Deweloper czytający wyłącznie tę kartę, bez zajrzenia do `UI-OVERLAY-01`, uwierzyłby, że trap działa — nie działa. Naprawa współdzielona z `UI-OVERLAY-01` (ten sam plik, ta sama luka), nie do naprawienia lokalnie w tej rodzinie.

## 18. Acceptance tests

Krytyczny test odrzucający tej rodziny (`COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`), decydujący ponad resztą pakietu: przy 200% zoom i długiej treści stopka z akcjami (Zapisz/Anuluj lub Otwórz/×) pozostaje w pełni widoczna i klikalna — odcięta stopka blokuje odbiór niezależnie od pozostałych wyników.

## 19. Evidence

Kandydat: Ideas table screenshots = audit evidence. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — korekta po panelu adwersaryjnym: §4/§12 twierdziły „360 px domyślnie / 320–420 px zakres" dla szerokości drawera — to wartość prawego panelu artefaktu SPEC-A, innej powierzchni; realne referencje karty mierzą 420 px stałe (`IdeaNodeDetailDrawer.tsx:595`) i 50% viewportu/480–768 px (`InitiativeDrawer.tsx:903-905`), rozjazd między nimi opisany jako dług, nie uśredniony. §11 twierdziło, że panel edycyjny ma focus trap — dopisany known-gap w §17 (i skorygowane §11): `role`/`aria-modal` są, trap Tab/Shift+Tab nie istnieje (ten sam brak co w `UI-OVERLAY-01` §17 dla tego samego pliku `sheet.tsx`).

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami). Skorygowana tożsamość karty: §1/3/4/6/7/16 opisywały omyłkowo narzędzie arkusza kalkulacyjnego zamiast Drawer/Sheet (`family` zmienione z `artifact` na `primitive`, zgodnie z `COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`, `COMPONENT_RUNTIME_BINDING_REGISTRY.md` i `PRIMITIVE_INTERACTION_CONTRACT.md` §2).

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.
