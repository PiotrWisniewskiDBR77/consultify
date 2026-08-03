---
component_id: UI-ACTION-01
name: Actions, Kebab and Bulk
family: action
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
  - Button; RowActionsMenu; ModuleMenu3
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-ACTION-01 — Actions, Kebab and Bulk

## 1. Job to be done

Uruchomić właściwą akcję z przewidywalnym skutkiem bez duplikowania komend.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `action`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

primary/secondary/tertiary, icon button, kebab, context menu, bulk bar, confirm. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

size, hierarchy, async, destructive, single/bulk. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Dwa równoległe systemy istnieją dziś naprawdę, nie teoretycznie: `RowActionsMenu` (`RowActionsMenu.tsx`, 398 linii) przyjmuje ad-hoc `RowAction[]`/`RowActionSection[]` z polem `id: string` przypisywanym LOKALNIE przez każdy ekran (Inbox/Tasks/Decisions/Notifications/Initiatives/Interview) — bez walidacji wobec centralnego rejestru. `ideaActionRegistry.ts` (Ideas) ma prawdziwy typowany rejestr `IDEA_ACTIONS` z polem `id`, `handler` WYMAGANYM i `surfaces: Surface[]` (`Surface = 'menu1'|'menu3'|'rail'|'panel'|'context'|'floating'`, `ideaActionRegistry.ts:60`) pilnowanym skryptem `scripts/check-actions.sh`. Kontrakt tej rodziny: `id` stabilny (nie zmienia się między wydaniami) jest WYMAGANY wszędzie; rejestr statyczny jak w Ideas jest wzorcem docelowym, nie faktem dla pozostałych konsumentów.

## 6. Akcje i zdarzenia

activate, open menu, select bulk, confirm, undo. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

default, hover, focus, pressed, disabled-reason, pending, success, error, mixed bulk. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

AI/automation to WŁASNA grupa w menu (`PRIMITIVE_INTERACTION_CONTRACT.md` §3: „open/preview; edit/organize; share/link; automation/AI; destructive na końcu") — akcja wygenerowana lub zasugerowana przez Teresę jest wizualnie nieodróżnialna w hierarchii od akcji manualnej o tym samym skutku (ten sam wariant przycisku, `TRIADA_KANON.md` §A8), różni się TYLKO źródłem w telemetrii, nie kolorem czy pozycją poza tą grupą.

## 9. Nawigacja

Otwarcie kebaba/context menu nie nawiguje — to menu overlay (`PRIMITIVE_INTERACTION_CONTRACT.md` §2, wiersz `Dropdown/Context menu`); dopiero AKCJA wybrana z menu (np. „Open preview") nawiguje i wtedy obowiązuje pełny kontrakt Back/focus. Zamknięcie samego menu (Esc, klik na zewnątrz) zawsze oddaje focus do triggera (kebab/przycisku), nigdy do przypadkowego elementu pod kursorem.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla akcji: bulk bar (Menu 3 tryb ②) ma priorytet nad filtrem w wąskich viewportach — poniżej progu, gdzie oba nie mieszczą się jednocześnie, bulk bar wygrywa, bo reprezentuje aktywny wybór użytkownika, nie stan domyślny.

## 11. Accessibility

Kebab implementuje `menu/menuitem` z `arrows/Home/End/Enter/Space/Esc/typeahead` (`PRIMITIVE_INTERACTION_CONTRACT.md` §2, wiersz `Dropdown/Context menu`) — to jest DOSŁOWNY kontrakt tej rodziny, nie odniesienie. 5 bloków kebaba (`TRIADA_KANON.md` §A6) są oddzielone separatorami, które w DOM muszą być `role="separator"` lub odpowiadający wizualny podział bez fałszywych `menuitem` — czytnik ekranu nie powinien ogłaszać separatora jako klikalnej pozycji.

## 12. Visual tokens

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Wartości specyficzne dla akcji: pigułka przycisku `h-9` (36 px) `rounded-full` z widoczną ramką (`TRIADA_KANON.md` §A8/§C9); pozycja menu 36 px wysokości (`FOUNDATION_TOKEN_CONTRACT.md` §3, wiersz „menu item”); Menu 3 chip `h-7` (28 px, §C5) jest MNIEJSZY niż Menu 2 pigułka — te dwa wymiary nie są zamienne.

## 13. Security i privacy

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla akcji: akcja bulk działa na zaznaczonym zbiorze `id` przefiltrowanym po capability KAŻDEGO rekordu z osobna — mixed bulk (część rekordów bez capability na daną akcję) pokazuje stan `mixed` (§7 tej karty), nie wykonuje akcji po cichu tylko na podzbiorze bez informowania, które rekordy pominięto.

## 14. Performance

Akcja bulk na dużym zaznaczeniu pokazuje pending per-rekord albo zbiorczy progress, nie jeden spinner bez informacji o postępie dla >20 rekordów. Otwarcie kebaba nie odpytuje serwera o dostępność pozycji menu przy KAŻDYM otwarciu — capability jest już częścią danych wiersza, nie osobnym round-tripem.

## 15. Telemetry

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Zdarzenie specyficzne dla akcji: każdy event niesie `action.id` I `surface` (kebab/context/toolbar/bulk), z którego akcja wystartowała — jedyny sposób policzenia, czy dana funkcja żyje TYLKO w jednej powierzchni wbrew kontraktowi parytetu (§9, `PRIMITIVE_INTERACTION_CONTRACT.md` §3).

## 16. Miejsca użycia

Button; RowActionsMenu; ModuleMenu3; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. `czyAtrapa()` (`RowActionsMenu.tsx:95-98`) filtruje z listy pozycje `disabled`, których `description`/`rightLabel` pasuje do wzorca `/coming soon|wkrótce|wkrotce/i` — to mechaniczna reguła na TEKŚCIE, nie na fladze produktu; pozycja wyłączona z innego powodu (np. brak capability) NIE jest przez nią filtrowana i zostaje widoczna z dopiskiem, zgodnie z kontraktem (`TRIADA_KANON.md` §C3). Realna luka: `RowActionsMenu` (ogólny) ma skalę znacznie większą, niż poprzednia wersja tej karty podawała („6 modułów"). Policzone 2026-08-02: `grep -rl "RowActionsMenu" src/ | grep -v RowActionsMenu.tsx` → **36 plików-konsumentów** (wzmianka), rozłożonych na **≥13 modułów biznesowych** (m.in. Discovery/DiscoveryTools, DocumentStudio, Economics, Execution, Initiatives, Interview, MyWork, Portfolio, Reports, Results, assessment, Vault, Partner — plus warstwa współdzielona `shared/`/`standard/`); import (`grep -rln "import.*RowActionsMenu" src/`) daje 32, JSX (`grep -rln "<RowActionsMenu" src/`) daje 20 — rozjazd między metodami wynika z plików, które importują typ/hook (`useFinanceRowActions.ts`) bez bezpośredniego renderu JSX. `RowActionsMenu` i `ideaActionRegistry` (Ideas, typowany rejestr z `Surface`) pozostają DWOMA nieujednoliconymi systemami — akcja przeniesiona z Ideas do np. Tasks traci gwarancje rejestru (`check-actions.sh` pilnuje tylko `IDEA_ACTIONS`); przy 36 konsumentach `RowActionsMenu` skala tego długu jest większa niż wcześniej udokumentowana.

## 18. Acceptance tests

Light/dark; PL/EN; 1280/1440/1920; 125%/200%; keyboard; VoiceOver/NVDA smoke; target size; contrast; reduced motion; long/empty/error/no-access; slow/timeout/retry/conflict; visual regression oraz krytyczny E2E. Krytyczny test odrzucający tej rodziny: ta sama akcja (ten sam `action.id`) wywołana z kebaba, z prawego kliknięcia (context menu) i z toolbara/bulk baru daje TEN SAM skutek i TEN SAM confirm/brak confirm — sprawdzane przez trzy niezależne wywołania na tym samym rekordzie, nie przez inspekcję jednego miejsca.

## 19. Evidence

Kandydat: Tasks i Decisions — actions candidate. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa przeniesiona do COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — korekta po panelu adwersaryjnym: §17 twierdziło „`RowActionsMenu` (ogólny, 6 modułów)" — grep pokazał 36 plików-konsumentów w ≥13 modułach (wzmianka, metoda i data podane w §17). Poprawione, liczba nie była zaniżona przypadkowo o jeden-dwa moduły, tylko o rząd wielkości.

2026-08-02 — kontrakt 2.1: treść sekcji 5, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18 zróżnicowana per rodzina (poprzednia wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).
2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

