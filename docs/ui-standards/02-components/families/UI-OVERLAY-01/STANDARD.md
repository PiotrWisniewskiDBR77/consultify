---
component_id: UI-OVERLAY-01
name: Modal Drawer Popover
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
  - src/components/ui/dialog.tsx (custom local implementation — NIE Radix, zweryfikowane w kodzie: brak focus trap, brak realnego portalu)
  - src/components/ui/popover.tsx, tooltip.tsx, sheet.tsx (ta sama rodzina custom, nie Radix)
  - src/hooks/useModal.tsx (useModal/useModalStack — stan open/data, zero DOM/focus logic)
known_consumers:
  - src/components/ui/ consumers app-wide (dialog/popover/tooltip/sheet)
last_runtime_audit: 2026-08-02
---

# UI-OVERLAY-01 — Modal Drawer Popover

## 1. Job to be done

Pokazać kontekstową lub modalną warstwę z poprawnym focusem, kolizją i zamknięciem.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `primitive`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

trigger, portal, backdrop optional, surface, title, content, footer, close. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

tooltip, menu, popover, modal, alert dialog, drawer, preview. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Kontrakt to STAN, nie encja: `open: boolean` + opcjonalne `data: T` (`useModal<T>()`), kontrolowany LUB niekontrolowany przez `open`/`onOpenChange` na każdym z `Dialog`/`Popover`/`Tooltip`/`Sheet` (zweryfikowane — identyczny wzorzec Context+`controlledOpen ?? internalOpen` powtórzony 4×, osobno w każdym pliku, nie współdzielony hook). `useModalStack()` dodaje `id`+`data` per wpis na stosie dla wielu jednoczesnych overlayów — ale STOS istnieje wyłącznie jako lista, bez logiki „który jest na wierzchu blokuje Esc dla pozostałych" (§9). Overlay NIE ma własnego tenant scope/capability — dziedziczy je z treści, którą hostuje; sam kontener nigdy nie decyduje czy się otworzyć.

## 6. Akcje i zdarzenia

open, close, outside dismiss, confirm, cancel. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

closed, opening, open, nested, pending, error, closing. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Overlay jest kontenerem NEUTRALNYM wobec treści AI — wzorzec propose→approve z appendixu żyje WEWNĄTRZ `DialogContent`/`SheetContent`, overlay sam go nie implementuje. Kontrakt specyficzny dla tej rodziny: dopóki trwa streaming AI wewnątrz modala, klik na `DialogOverlay`/`SheetOverlay` (outside dismiss) i Esc MUSZĄ anulować STREAM zanim zamkną warstwę — nie mogą zamknąć modal i zostawić strumienia działającego w tle bez UI. Żadna mutacja zaproponowana przez AI nie commituje się przez sam fakt zamknięcia overlayu (zamknięcie ≠ akceptacja) — jeśli modal ma `Approve`, zamknięcie przez Esc/outside-click jest równoważne `Cancel`, nigdy `Approve`.

## 9. Nawigacja

Esc zamyka WYŁĄCZNIE górną warstwę — jedno wciśnięcie = jedno zamknięcie (nested modal nad popoverem: pierwszy Esc zamyka modal, NIE popover pod spodem naraz). To wymaganie normatywne, a runtime dziś go NIE SPEŁNIA: zweryfikowane grepem po `Escape`/`onKeyDown` w `dialog.tsx`, `sheet.tsx`, `popover.tsx`, `tooltip.tsx` — ZERO wystąpień w którymkolwiek z czterech plików. Esc dziś nie zamyka niczego w tych implementacjach; jedyne zamknięcie to klik w `X`/outside-click. `useModalStack()` (§5) ma listę otwartych overlayów, ale bez logiki „Esc trafia do ostatniego na stosie" ta lista nie rozwiązuje problemu — potrzebny jest globalny listener Esc uwzględniający kolejność otwarcia, którego dziś nie ma.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Poza podstawą §3a brak wymagań specyficznych dla tej rodziny — zachowanie stopki drawera przy 200% zoomu jest kontraktem `UI-SHEET-01` §10, nie tej karty.

## 11. Accessibility

Kontrakt per wariant (`PRIMITIVE_INTERACTION_CONTRACT.md` §2, rozwinięty): modal ma Tab trap + `aria-modal="true"` + initial focus na tytule/bezpiecznej akcji + restore do triggera; popover/tooltip NIE mają trapu (Tab przechodzi naturalnie dalej). Zweryfikowany w kodzie rozjazd: `SheetContent` MA `role="dialog" aria-modal="true"`; `DialogContent` (modal „właściwy") NIE MA żadnego z tych dwóch atrybutów — czytnik ekranu nie wie, że wszedł w modal. Żaden z czterech plików (`dialog`/`sheet`/`popover`/`tooltip`) nie ustawia initial focus programowo ani nie przywraca focusu do triggera po zamknięciu — restore focusu, wymagany przez §9 wspólnych reguł primitives, nie istnieje w żadnym z nich. `TooltipTrigger` otwiera się WYŁĄCZNIE na `onMouseEnter`/`onMouseLeave` — brak `onFocus`/`onBlur` oznacza, że tooltip nie pojawia się przy nawigacji klawiaturą, co łamie wymóg „focus/hover otwiera" z tabeli primitives.

## 12. Visual tokens

Obowiązuje wspólna podstawa §3a. Warstwy overlayów mają WŁASNĄ hierarchię z-index (`FOUNDATION_TOKEN_CONTRACT.md` §8): dropdown/popover/tooltip 40 · overlay/drawer/sheet 50 · modal/backdrop 60 · toast 100 · context menu 120 — `dialog.tsx`/`sheet.tsx` używają klas `z-overlay`/`z-modal`, `popover.tsx`/`tooltip.tsx` używają `z-dropdown`; te tokeny NIE są wymienne między wariantami, bo od ich kolejności zależy które okno wygrywa przy nested overlay (§9). Modal ma trzy szerokości 480/640/800 px max-width; tooltip/popover 320 px max-width (menu min 200 px); viewport clearance 12 px (`FOUNDATION_TOKEN_CONTRACT.md` §4) — kolizja z viewportem nie jest dziś liczona w kodzie (§14).

## 13. Security i privacy

Obowiązuje wspólna podstawa §3a. Overlay typu `alert dialog`/destrukcyjny modal MUSI mieć initial focus na `Cancel` (nie na akcji niszczącej) — to jest kontrola bezpieczeństwa UX, nie tylko a11y: przypadkowy Enter po otwarciu modala usuwania nie może wykonać usunięcia.

## 14. Performance

Zweryfikowane w kodzie: `DialogPortal`/`SheetPortal` to `<>{children}</>` — fragment, NIE `ReactDOM.createPortal` do `document.body`. Overlay renderuje się WEWNĄTRZ drzewa DOM rodzica, więc `overflow:hidden`/`transform`/`z-index` lokalny dowolnego przodka może przyciąć albo zepsuć stacking context modala — to jest realne ryzyko wydajnościowo-wizualne (przemalowania, przycięty modal), nie tylko teoretyczne. Wykrywanie kolizji z viewportem (12 px clearance, wymóg `PRIMITIVE_INTERACTION_CONTRACT.md` §1) nie jest zaimplementowane w żadnym z czterech plików — `PopoverContent`/`TooltipContent` mają statyczne `top-full`/`bottom-full` bez przeliczania czy mieszczą się w oknie.

## 15. Telemetry

Obowiązuje wspólna podstawa §3a. Zdarzenia specyficzne tej rodziny: `overlay.open`/`close`/`dismiss_outside`/`dismiss_esc`, rozbite dodatkowo na `overlay_dismiss_method` (`esc`/`outside_click`/`close_button`/`confirm`/`cancel`) — bez tego rozbicia nie da się ocenić, czy Esc realnie zamyka warstwę w produkcji (§9 pokazuje, że dziś nie działa wcale).

## 16. Miejsca użycia

`src/components/ui/dialog.tsx`, `sheet.tsx`, `popover.tsx`, `tooltip.tsx` — cztery ODDZIELNE custom-implementacje (nie warianty jednej biblioteki), każda z własnym Context i własną kopią wzorca `controlledOpen ?? internalOpen`. `useModal.tsx`/`useModalStack.tsx` dostarczają stan wielu ekranom niezależnie od tego, którego z czterech plików użyją do renderu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowane w kodzie, cztery zbieżne luki w JEDNYM miejscu: (1) ZERO obsługi `Escape`/`onKeyDown` w `dialog.tsx`/`sheet.tsx`/`popover.tsx`/`tooltip.tsx` — Esc dziś nie zamyka niczego (§9); (2) `DialogPortal`/`SheetPortal` to fragmenty, nie `ReactDOM.createPortal` — brak realnego portalu do `body` (§14); (3) `DialogContent` nie ma `role="dialog"`/`aria-modal` (podczas gdy `SheetContent` ma oba) — dwie implementacje tej samej rodziny z różnym poziomem a11y (§11); (4) żaden z czterech nie zarządza focus trap ani focus restore do triggera. Reference implementation frontmatter historycznie nazywał to „Radix-compatible" — to była nieprawda: żadna z czterech implementacji nie importuje `@radix-ui/*` ani nie replikuje jego focus management, poprawione w tej rewizji karty.

## 18. Acceptance tests

Krytyczny test odrzucający z appendixu („nested overlay zamyka tylko górną warstwę"), rozwinięty: otwórz modal (Dialog) → z jego wnętrza otwórz popover (np. dropdown pola) → wciśnij Esc RAZ → oczekiwany skutek: zamyka się TYLKO popover, modal zostaje. Dziś ten test NIE PRZECHODZI, bo żaden z dwóch komponentów nie nasłuchuje Esc w ogóle (§9/§17) — Esc nie robi nic. Drugi test: otwórz modal z triggera A, zamknij przez `X` — focus MUSI wrócić na trigger A; dziś nieweryfikowalny, bo restore nie jest zaimplementowany.

## 19. Evidence

Kandydat: Tasks/Decisions preview candidate. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.
2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).
2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

