---
component_id: UI-CARD-01
name: Content Card
family: content
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
  - src/components/standard/StandardKanbanCard.tsx (karta kanban/board, kanon #75b)
  - src/components/standard/StandardGridCard.tsx (karta kafelkowa/grid, kanon #76a — renderer siostrzany, INNY plik)
known_consumers:
  - src/components/Execution/ExecutionInitiativesKanbanView.tsx
  - src/components/Portfolio/PortfolioGridView.tsx
  - src/components/shared/ModuleHub/GridView.tsx
last_runtime_audit: 2026-08-02
---

# UI-CARD-01 — Content Card

## 1. Job to be done

Skanować zwarty obiekt i uruchomić najważniejszą akcję bez imitowania tabeli.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `content`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

identity, title, summary, metadata, status, optional image, actions. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

static, interactive, selectable, KPI, recommendation. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Kontrakt realny (`StandardKanbanCard.tsx`): `id` (klucz reactowy i cel DnD), `title` (obcinany do 2 linii `line-clamp-2` — treść się NIE skraca po stronie danych, tylko wizualnie), opcjonalny `description` (2 linie). Właściciel to PARA `ownerAvatarUrl`/`ownerInitials` + `ownerName` (tooltip); gdy oba braki, karta renderuje neutralną ikonę `User` w szarym kółku — nigdy pusty róg. Termin to `dueLabel` + osobna flaga `dueOverdue: boolean` ustawiana przez moduł — kolor stopki nie wynika z parsowania tekstu terminu wewnątrz karty. Status/priorytet/typ wchodzą jako `chips[]` (cichy chip, kolor tylko w kropce) albo jako `urgency` (pasek akcentu) — karta NIE ma osobnego pola `status`. „Następna akcja" to opcjonalny slot `footer: ReactNode` pod hairline; moduł renderuje własną treść, karta narzuca tylko miejsce i odstęp.

## 6. Akcje i zdarzenia

open, preview, select, favorite, overflow. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

default, hover, focus, selected, disabled, loading, error, long-content. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Karta record NIE ma własnego surface'u AI — `StandardKanbanCard.tsx` nie zawiera przycisku `sparkles` ani chipa AI (zweryfikowane w pliku). To świadoma granica: generacja/analiza AI żyje jedno piętro wyżej (workspace N-mode, preview), karta pozostaje czystym renderem przygotowanych danych. Jeśli moduł chce zasygnalizować wynik AI na karcie (np. „priorytet zaproponowany przez AI"), robi to przez istniejący `chips`/`footer`, nigdy przez dodanie nowego elementu interaktywnego do karty — inaczej setki kart w gridzie/kanbanie multiplikują koszt renderu i ryzyko niespójnych wariantów.

## 9. Nawigacja

Karta nie jest własnym routem i nie ma deep linku — nawiguje przez pojedynczy `onClick` przekazany przez moduł (parent decyduje, czy to preview czy pełne otwarcie). Klik i Enter/Space dają IDENTYCZNY skutek (`handleKeyDown` obsługuje oba klawisze na tym samym handlerze) — moduł nie może więc udawać zachowania linku (środkowy klik / Ctrl+klik w nowej karcie nie jest wspierany i nie wolno tego sugerować w UI). Zamknięcie preview otwartego z karty MUSI oddać focus na TĘ SAMĄ kartę po `id`, nie na pierwszą kartę w kolumnie — `id` karty przeżywa DnD, więc jest to policzalne bez dodatkowego stanu nawigacyjnego.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla karty: `line-clamp-2` na tytule i opisie jest kontraktem WIZUALNYM, nie ucina treści danych — przy 200% zoomu i wąskiej kolumnie kanbanu (`w-[280px]` w `StandardKanban.tsx`) tytuł nadal musi kończyć się wielokropkiem, nie zawijać poza 2 linie i nie rozpychać karty w pionie ponad sąsiadki w tej samej kolumnie.

## 11. Accessibility

Zweryfikowane w `StandardKanbanCard.tsx`: `role="button"` i `tabIndex={0}` pojawiają się WYŁĄCZNIE gdy przekazano `onClick` (karta bez akcji nie jest fokusowalna — to poprawne, nie luka). Uchwyt DnD (`GripVertical`) jest `aria-hidden` i NIE jest osobnym przystankiem Tab w ścieżce natywnego HTML5 DnD (`StandardKanban`) — w boardach dnd-kit (`dragHandleProps`) staje się fokusowalny przez listenery biblioteki, więc te dwie ścieżki DnD mają RÓŻNĄ dostępność klawiatury i trzeba to sprawdzić osobno przy odbiorze. Karta z `draggable` dokleja `sr-only` „Drag to move to another column" — to jedyny tekst ogłaszany czytnikowi poza treścią widoczną; ruch przez klawiaturę (Space/strzałki/Esc z `PRIMITIVE_INTERACTION_CONTRACT.md`) NIE jest zaimplementowany w natywnej ścieżce HTML5 (patrz §17) — sr-only sam nie zastępuje faktycznej alternatywy.

## 12. Visual tokens

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla karty: pasek akcentu (`URGENCY_ACCENT` w `StandardKanbanCard.tsx`) ma DOKŁADNIE 3 stany tokenowe — `border-l-transparent` / `border-l-amber-500` / `border-l-danger-500` — żaden inny kolor paska nie jest częścią kontraktu; tint tła (`bg-danger-500/[0.04]`) włącza się TYLKO dla `urgency="critical"`.

## 13. Security i privacy

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Dane wrażliwe specyficzne dla karty: `description` i `ownerName` (przypisanie osoby) renderują się wprost w DOM, nie za lazy-fetch — moduł, który buduje listę kart z danymi poufnego rekordu, filtruje te pola PRZED przekazaniem do `StandardKanbanCard`; karta sama nie ma logiki maskowania.

## 14. Performance

Karta nie wykonuje własnych obliczeń ani fetchy — `StandardKanbanCard.tsx` ma jeden hook (`useTranslation`) i renderuje wyłącznie gotowy obiekt danych przygotowany przez moduł. Filtrowanie, sortowanie, agregacja health/priority i formatowanie terminu MUSZĄ być policzone raz na poziomie listy/planszy przed przekazaniem `card` w dół — karta renderowana masowo (grid/kanban, dziesiątki–setki instancji na ekranie) nie może zawierać `useMemo`/`useEffect` z logiką domenową, bo koszt mnoży się razy liczba kart. Wirtualizacja przy dużych zbiorach jest obowiązkiem kontenera (grid/kanban), nie karty.

## 15. Telemetry

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Zdarzenia specyficzne dla karty: `card_open`, `card_dnd_move` (niesie `columnId`→`columnId`, skąd→dokąd) — liczba kart wyrenderowanych na ekranie NIE jest mierzona, to byłaby vanity metric bez powiązania z decyzją użytkownika.

## 16. Miejsca użycia

`StandardKanbanCard.tsx` w kolumnach kanban (`ExecutionInitiativesKanbanView.tsx` — własny board dnd-kit renderujący tę kartę) oraz jej siostrzany renderer kafelkowy `StandardGridCard.tsx` (`PortfolioGridView.tsx`, `shared/ModuleHub/GridView.tsx`). To DWA różne pliki dla dwóch różnych kontekstów (kanban vs grid) — moduł wybiera właściwy, nie kopiuje żadnego z nich.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowane w kodzie: (1) `StandardKanban.tsx` (fasada tablicy) sam nie ma żadnego direct-konsumenta JSX w aplikacji — realny board (`ExecutionInitiativesKanbanView.tsx`) używa `StandardKanbanCard` bezpośrednio wewnątrz WŁASNEGO dnd-kit boardu, z pominięciem fasady kolumn; (2) `StandardGridCard.tsx` istniał jako reakcja na „dziś każdy widok kafelkowy renderuje WŁASNĄ, rozbieżną kartę" (cytat z nagłówka pliku) — w tym udokumentowany w kodzie crimson-leak w `GridView.tsx` (tło/tekst z palety `primary` jako dekoracja typu/statusu), część już naprawiona, ale historia dowodzi że bez tej karty moduły wracają do bespoke renderów przy każdej nowej liście kafelkowej.

## 18. Acceptance tests

Krytyczny test odrzucający (z appendixu, rozwinięty): karta z tytułem 200+ znaków I bez `description`/`chips`/`ownerAvatarUrl`/`ownerInitials`/`dueLabel` (wszystkie opcjonalne pola puste) NIE może: (a) urosnąć w pionie ponad sąsiednią kartę z pełnymi danymi w tej samej kolumnie/gridzie, (b) zostawić pustej ramki tam gdzie był footer/stopka, (c) złamać `line-clamp-2` tytułu. Dodatkowo: Tab → karta → Enter otwiera to samo co klik; Tab → karta → Esc (gdy otworzyło preview) oddaje focus na tę samą kartę po `id`, nie na pierwszą w kolumnie.

## 19. Evidence

Kandydat: Tasks/Decisions visual direction candidate. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa przeniesiona do COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.
2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

