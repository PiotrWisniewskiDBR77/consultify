---
component_id: UI-TABLE-01
name: App Table
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
reference_implementations:
  - StandardTable
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-TABLE-01 — App Table

## 1. Job to be done

Skanować, porównywać, sortować, filtrować i wybierać rekordy; nie imitować arkusza.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `data-view`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

header 48, rows 48/40, identity, domain columns, selection, actions, pagination/virtual scroll. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

default, compact, selectable, grouped, virtualized. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Wymagany kontrakt: stabilny `id` per wiersz (klucz `TableRow`, SSOT `FilterableTable.tsx`) używany zarówno do `key` renderowania jak i do zaznaczenia — zmiana kolejności/filtrowania NIE może przemapować zaznaczenia na inny wiersz. Kolumny mają kontrakt: `resize` (zero-sum, grip), `reorder`, `visibility` (checkbox w pstryczku, Task/Actions LOCKED) i persystencję pod jednym kluczem `persistKey` (`StandardTable.tsx:164`, `standardTable.rowDesc.${persistKey}` dla „Show row description") — bez `persistKey` ustawienia kolumn giną przy odświeżeniu.

## 6. Akcje i zdarzenia

sort, filter, resize, visibility/order, select, bulk, preview. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

skeleton, loaded, hover, focus, selected, empty, partial, error, long, no-access. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Tabela sama NIE inicjuje generowania AI per wiersz — to zadanie preview (UI-PREVIEW-01, blok 4) lub akcji bulk z Menu 3. Jedyny kontakt tabeli z AI to WIDOCZNOŚĆ wyniku: status wiersza może odzwierciedlać `generating`/`AI-generated` jako stan (mapowanie `statusColors.ts`), z `aria-live` gdy status zmienia się bez akcji użytkownika (np. long-running generation w tle).

## 9. Nawigacja

Sort, filtr, kolejność/widoczność kolumn i zaznaczenie przeżywają otwarcie i zamknięcie preview (klik wiersza → Esc) BEZ przeładowania tabeli — to jest bardziej rygorystyczny wariant ogólnego §9, bo najczęstsza nawigacja w tej rodzinie to właśnie wiersz→preview→powrót, nie zmiana trasy.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla tabeli: przy 200% zoom kolumny drugorzędne (nie `id`/`identity`/`actions`) mogą się ukryć za pstryczkiem widoczności zamiast wymuszać scroll poziomy całej tabeli — pod warunkiem że kolumna identity i kebab pozostają zawsze widoczne.

## 11. Accessibility

`FilterableTable.tsx` renderuje natywny `<table>` (`FilterableTable.tsx:580-581`) — poprawna baza semantyczna, ale kod NIE implementuje nawigacji klawiaturą po wierszach (brak `onKeyDown`/`tabIndex`/strzałek w `StandardTable.tsx` i `FilterableTable.tsx` — zweryfikowane greppem, zero wystąpień). Kontrakt: wiersz klikalny MUSI być osiągalny klawiaturą (Tab lub strzałki + Enter/Space otwiera preview) — to jest dziś wymóg niespełniony przez referencyjną implementację, nie tylko przez powłoki modułów, i jest głównym elementem krytycznego testu §18.

## 12. Visual tokens

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Wartości specyficzne dla tabeli: nagłówek 48 px, wiersz 48 px domyślnie / 40 px WYŁĄCZNIE density compact (`FOUNDATION_TOKEN_CONTRACT.md` §3), hairline `border-b border-slate-200/60 dark:border-white/[0.03]` między wierszami — nigdy zebra, nigdy gruby pas (`TRIADA_KANON.md` §C6).

## 13. Security i privacy

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla tabeli: filtr/sort działa na danych już zwróconych przez serwer z respektowaniem tenant scope — filtrowanie po stronie klienta nie może ujawnić wierszy spoza uprawnień poprzez np. eksport „visible columns" zawierający pole, do którego użytkownik nie ma capability.

## 14. Performance

Próg wirtualizacji z `COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md` (obowiązkowo przy 1k+ widocznych rekordów) NIE jest dziś zaimplementowany — ani `StandardTable.tsx`, ani `FilterableTable.tsx` nie importują `react-window`/`react-virtual`/odpowiednika (zweryfikowane greppem, zero wystąpień). To jest wprost otwarty dług wobec własnego kontraktu wydajności tej rodziny, nie teoretyczne ryzyko. Do czasu wdrożenia: zaznaczenie i scroll muszą przeżyć re-render przy każdej zmianie filtra/sortu nawet bez wirtualizacji.

## 15. Telemetry

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Zdarzenia specyficzne dla tabeli: `sort`, `filter`, `column_resize`/`column_reorder`/`column_visibility_toggle` — te trzy ostatnie niosą `persistKey` i nazwę kolumny, nigdy treść komórki.

## 16. Miejsca użycia

StandardTable; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowane 2026-08-02: (1) brak wirtualizacji mimo progu 1k+ z appendixu (patrz §14); (2) brak nawigacji klawiaturą po wierszach w referencyjnej implementacji (patrz §11) — to nie jest lokalny fork, to luka w SSOT samym; (3) `StandardTable.tsx` deleguje mechanikę do `FilterableTable.tsx`, więc każdy ekran, który renderuje własny `<table>` zamiast przez tę fasadę, jest naruszeniem blokowanym przez `scripts/check-list-canon.sh` — ale hook łapie tylko nowe naruszenia w diffie, nie istniejące.

## 18. Acceptance tests

Light/dark; PL/EN; 1280/1440/1920; 125%/200%; keyboard; VoiceOver/NVDA smoke; target size; contrast; reduced motion; long/empty/error/no-access; slow/timeout/retry/conflict; visual regression oraz krytyczny E2E. Krytyczny test odrzucający tej rodziny: 10 000 wierszy bez utraty zaznaczenia przy scrollu/sorcie/filtrze; wiersz→preview (Enter/klik)→Esc klawiaturą wraca focus dokładnie do źródłowego wiersza — dziś ten test PADA na kroku nawigacji klawiaturą (patrz §11), więc jest jedynym testem z tej karty ze znanym, zweryfikowanym statusem FAIL do czasu naprawy.

## 19. Evidence

Kandydat: Tasks i Decisions table candidate. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa przeniesiona do COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — kontrakt 2.1: treść sekcji 5, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18 zróżnicowana per rodzina (poprzednia wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).
2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

