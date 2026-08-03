---
component_id: UI-STATUS-01
name: Status Progress KPI
family: data-display
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
  - src/constants/statusColors.ts (rejestr wskazuje jako SSOT — 5 realnych konsumentów, import, 2026-08-02; EntityStatusChip.tsx i StatusPill.tsx NIE są wśród nich — mają własny system i deklarują się jego następcą)
  - src/components/ui/primitives/chips/EntityStatusChip.tsx + statusChipTone() (kod deklaruje siebie jako następcę statusColors.ts/StatusPill — 33 konsumentów import / 32 JSX / 38 wzmianka, 2026-08-02, WIĘCEJ niż wskazany SSOT)
known_consumers:
  - src/components/RoadmapKanban.tsx
  - src/components/Execution/ExecutionInitiativesKanbanView.tsx
  - src/components/Portfolio/PortfolioKanbanView.tsx
  - src/components/Results/ResultsInitiativesView.tsx
  - src/components/Interview/InterviewHub.tsx
last_runtime_audit: 2026-08-02
---

# UI-STATUS-01 — Status Progress KPI

## 1. Job to be done

Pokazać stan, postęp i wynik bez polegania wyłącznie na kolorze.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `data-display`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

label, value, semantic icon/dot, optional trend/progress, timeframe/source. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

status badge, progress, KPI, trend, RAG. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Mapowanie enum→token jest w kodzie DWA RAZY z inną taksonomią. `statusColors.ts` (`getStatusStyle`) normalizuje surowy string (`toUpperCase`, spacje/myślniki→`_`) i mapuje na `tier` (`alarm`/`subtle`/`neutral`) + `bg`/`text`/`dot`, z 5 kolorami bazowymi (emerald/red/amber/blue/slate); klucz nierozpoznany → `NEUTRAL` (fallback jawny, nie crash). `statusChipTone()` (`EntityStatusChip.tsx`) normalizuje inaczej i mapuje na `tone` (`info`/`warning`/`success`/`danger`/`neutral`) — WIĘKSZY słownik statusów (m.in. `generated`, `proposed`, `on_hold`, `paused`, których nie ma w `statusColors.ts`), `unknown`/pusty → jawnie `neutral`. Kontrakt normatywny: status musi nieść etykietę PL/EN (nie surowy klucz enum) + ikonę/kropkę tonu — nigdy sam kolor. Priorytet to ODDZIELNA mapa (`PRIORITY_STYLES`/`getPriorityStyle`) — CRITICAL/URGENT/HIGH/MEDIUM/LOW/NORMAL, zawsze `bg-transparent` (kropka + tonowany tekst, kanon TRIADA A9/C1 — zero wypełnionych pigułek priorytetu, nawet dla CRITICAL).

## 6. Akcje i zdarzenia

open source, change status when capability allows. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

neutral, info, success, warning, danger, unknown, stale, loading, error. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Chip statusu jest READ-ONLY renderem tonu — nie inicjuje AI i nie ma własnego przycisku `sparkles`. Jedyny dopuszczalny styk z AI: gdy status pochodzi z automatycznej klasyfikacji (np. AI oceniło ryzyko jako `at_risk`), chip pokazuje DODATKOWY, osobny znacznik „AI" (ikona, nie zamiana koloru tonu) OBOK chipa, nigdy zamiast niego — użytkownik musi umieć odróżnić „system tak ustawił" od „AI to zaproponowało" jednym spojrzeniem, bez polegania na kolorze (grayscale test §11). Zmiana statusu przez AI (jeśli capability na to pozwala) przechodzi ten sam przepływ propose→approve co każda inna mutacja — chip nigdy nie zmienia się cicho w tle.

## 9. Nawigacja

Chip nie jest własnym routem — jedyna nawigacja to opcjonalne „open source" (§6): klik na chip statusu prowadzi do encji/reguły, która ten status ustawiła (np. workflow kroku), nie do edycji statusu w miejscu. Filtrowanie tabeli PO statusie (klik w chip nagłówka kolumny/legendy) musi zsynchronizować się z filtrem Menu 3 tej samej tabeli — dwa niezależne stany filtra dla tego samego pojęcia statusu w jednym ekranie są zakazane.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla statusu: chip nigdy nie skraca etykiety do samej ikony/kropki przy zwężeniu — jeśli miejsca brakuje (np. wąska kolumna tabeli), kolumna dostaje `min-width`, chip nie traci tekstu; zasada „nigdy sam kolor” obowiązuje przy KAŻDEJ szerokości, nie tylko na desktopie referencyjnym.

## 11. Accessibility

Test grayscale (odsącz kolor z chipa) MUSI dalej dawać jednoznaczną informację o statusie — tekst etykiety, nie tylko kropka. Zweryfikowane w kodzie jako poprawny wzorzec: `statusChipTone()` niesie zarówno `tone` (kolor kropki) jak i osobno humanizowaną etykietę tekstową — kropka NIGDY nie jest jedynym nośnikiem. Zarówno status (`SUBTLE`/`ALARM` w `statusColors.ts`) jak i priorytet CRITICAL/URGENT kolorują TEKST etykiety zgodnie z tonem (`text-danger-700`, `text-emerald-600`…), nie tylko kropkę — kolorowy tekst jest tu ŚWIADOMYM wzmocnieniem czytelności, nie naruszeniem zasady „nie tylko kolor", bo etykieta słowna towarzyszy koloruTOWI zawsze. Wyjątek: tier `NEUTRAL` ma tekst zawsze `c-text-secondary` niezależnie od statusu źródłowego — Draft/Cancelled/Archived nie różnią się kolorem między sobą, tylko treścią etykiety.

## 12. Visual tokens

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla statusu: paleta zamknięta na 5 kolorów semantycznych (emerald/red/amber/blue/slate, komentarz nagłówka `statusColors.ts`) w 3 tierach (alarm/subtle/neutral) — nowy status NIE dostaje nowego koloru, tylko mapuje się do jednego z 5; priorytet dodatkowo ma WSZYSTKIE tła `bg-transparent` (zero wypełnionej pigułki, nawet dla CRITICAL — jedyna rodzina w tym zbiorze, gdzie „alarm" nie oznacza wypełnionego tła).

## 13. Security i privacy

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Dane wrażliwe specyficzne dla statusu: sam status potrafi zdradzić informację poufną (np. „W rewizji prawnej"/„Zablokowane — dochodzenie" ujawnia toczącą się sprawę osobie bez capability do jej widoku) — filtrowanie MUSI się dziać na poziomie tego, CZY encja w ogóle trafia do listy/karty użytkownika, nie na poziomie „pokaż chip czy nie" po stronie klienta; chip nie ma własnej logiki maskowania statusu.

## 14. Performance

Mapowanie enum→token to CZYSTA funkcja bez sieci/stanu (`getStatusStyle`/`statusChipTone` — obie synchroniczne, oparte o stały słownik) — chip renderowany setki razy w tabeli/kanbanie nie może wywoływać żadnego requestu ani liczyć niczego poza normalizacją stringa. Normalizacja klucza (`toUpperCase().replace(/[\s-]+/g, '_')`) jest tania, ale MUSI być memoizowana na poziomie listy jeśli tabela ma tysiące wierszy — nie na poziomie pojedynczego chipa, żeby nie duplikować tej samej normalizacji dla powtarzających się wartości statusu w kolumnie.

## 15. Telemetry

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Zdarzenie specyficzne dla statusu: `status_chip_opened` (§6/§9, „open source”) niesie WYŁĄCZNIE ton (`info`/`warning`/…), NIGDY surową wartość statusu jeśli status niesie treść poufną (§13) — telemetryka nie może stać się bocznym kanałem wycieku tego, co UI właśnie ukryło.

## 16. Miejsca użycia

DWIE realne implementacje z różną liczbą konsumentów, policzone 2026-08-02. `statusColors.ts` — 5 konsumentów (import: `grep -rln "from ['\"].*constants/statusColors['\"]" src/`): `RoadmapKanban.tsx`, `ResultsInitiativesView.tsx`, `InterviewHub.tsx`, `ExecutionInitiativesKanbanView.tsx`, `PortfolioKanbanView.tsx`. `EntityStatusChip.tsx`/`statusChipTone()` — 33 konsumentów (import, licząc importy wieloliniowe: `grep -rln "import.*EntityStatusChip" src/` daje tylko 29, bo pomija listy importów rozbite przez prettier na wiele linii; policzone poprawnie import daje 33) / 32 konsumentów (JSX: `grep -rln "<EntityStatusChip" src/`) / 38 konsumentów (wzmianka: `grep -rln "EntityStatusChip" src/`) — w każdej metodzie WIĘCEJ niż `statusColors.ts`. Ani `EntityStatusChip.tsx` ani `StatusPill.tsx` NIE importują `statusColors.ts` (zweryfikowane: `grep -n "^import" ...` na obu plikach) — mają własny system tonów i deklarują się jego następcą (§17). `ViewLayouts/StatusBadge.tsx` (osobny, trzeci komponent) ma TYLKO 2 konsumentów (`NotionListView.tsx`, `ClickUpListView.tsx`) mimo że to on figuruje w `COMPONENT_RUNTIME_BINDING_REGISTRY.md` jako część SSOT razem z `statusColors.ts`.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowane w kodzie, rozbieżność dokumentacja↔runtime: `COMPONENT_RUNTIME_BINDING_REGISTRY.md` wskazuje `src/constants/statusColors.ts` jako SSOT UI-STATUS-01, ale nagłówek `EntityStatusChip.tsx` mówi wprost „This replaces the legacy `shared/StatusPill` + `constants/statusColors` pairing" — kod SAM SIEBIE deklaruje następcą tego, co rejestr nazywa SSOT, i ma znacząco więcej realnych konsumentów niż `statusColors.ts` niezależnie od metody liczenia (§16: 33/32/38 vs 5). Poprzednia wersja tej karty podawała „23 konsumentów" dla `EntityStatusChip` i „7" dla `statusColors.ts` (w tym błędnie `EntityStatusChip.tsx`/`StatusPill.tsx` jako konsumenci `statusColors.ts`, mimo że żaden z nich go nie importuje) — obie liczby były zaniżone/błędne, poprawione w §16. Dodatkowo `grep` po `getStatusBadge`/lokalny `StatusBadge` w `src/views/superadmin/`, `src/components/Results/`, `src/components/MyWork/` i kilkunastu innych plikach pokazuje KILKANAŚCIE lokalnych, ręcznie pisanych funkcji mapujących status→klasa CSS, całkowicie poza obiema kanonicznymi ścieżkami — to jest realny duplikat na skalę, nie pojedynczy fork.

## 18. Acceptance tests

Krytyczny test odrzucający z appendixu („status nieznany daje neutral fallback, nie surowy enum"), rozwinięty: podaj `getStatusStyle('SOME_NEW_ENUM_2027')` i `statusChipTone('some_new_enum_2027')` — oba MUSZĄ zwrócić tier/tone `neutral` z czytelną etykietą (np. humanizowaną wersją stringa), NIGDY nie wyrenderować surowego `SOME_NEW_ENUM_2027` bez formatowania i NIGDY nie rzucić wyjątku. Drugi test: odsącz kolor (grayscale/prefers-contrast) z chipa CRITICAL priorytetu i z chipa statusu `blocked` — oba muszą pozostać jednoznacznie odróżnialne od `neutral` po samej etykiecie tekstowej.

## 19. Evidence

Kandydat: Tasks/Decisions status candidate. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa przeniesiona do COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — korekta po panelu adwersaryjnym: frontmatter/§16 twierdziły, że `statusColors.ts` ma 7 konsumentów w tym `EntityStatusChip.tsx` i `StatusPill.tsx` — żaden z tych dwóch plików go nie importuje (mają własny system tonów); realnie 5 konsumentów. Liczba dla `EntityStatusChip` („23 konsumentów") poprawiona na zmierzoną: 33 (import) / 32 (JSX) / 38 (wzmianka), metoda i data podane w §16. `known_consumers` we frontmatterze oczyszczony z dwóch błędnych wpisów.

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.
2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

