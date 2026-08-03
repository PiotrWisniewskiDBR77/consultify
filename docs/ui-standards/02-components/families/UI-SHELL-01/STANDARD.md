---
component_id: UI-SHELL-01
name: Application Shell
family: shell
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
  - MainLayout; Sidebar
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-SHELL-01 — Application Shell

## 1. Job to be done

Utrzymać orientację, globalną nawigację i stan systemu bez mieszania akcji domenowych.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `shell`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

sidebar 64/256, App Topbar 48, global selectors/status/actions, route content. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

expanded, collapsed, degraded, permission-filtered. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Wymagany kontrakt danych: jeden `activeRouteId` pochodzący z routera — nigdy z lokalnego stanu komponentu potomnego. Zweryfikowane w kodzie 2026-08-02 (`grep -n "capability" src/components/navigation/Sidebar/menuConfig.ts src/components/navigation/Sidebar/types.ts` → zero trafień): pole `capability` per pozycja menu NIE ISTNIEJE. Realny kontrakt `MenuItem` (`types.ts`) niesie `isLocked?: boolean` + `lockedMessage?: string` (+ `lockedCode`/`lockedCtaHref`), ustawiane przez `decoratePilotItem()` w `Sidebar.tsx`. Sidebar NIE filtruje zablokowane pozycje z listy — zostają w DOM i są disable'owane z tooltipem: `NavItem.tsx` ustawia `aria-disabled={isLocked ? 'true' : undefined}` i `title={getTooltip()}` (czyta `item.lockedMessage`). Stan `collapsed` jest persystowany per użytkownik i przeżywa nawigację. Skip link (`href="#app-main-content"`) wskazuje na stabilny `id` regionu treści; brak tego `id` w drzewie jest błędem krytycznym, nie brakiem stylu.

## 6. Akcje i zdarzenia

navigate, collapse, select data/model, open account/global inbox. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

initial, loaded, collapsed, offline, degraded, route-error, no-access. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Shell hostuje WYŁĄCZNIE globalny punkt wejścia do Teresy (ikona/przycisk w topbar, widoczny na każdej trasie, z odznaką nieprzeczytanej odpowiedzi) — to jedyne miejsce w całej aplikacji, gdzie kolor marki (crimson) jest dozwolony jako znak, nie jako stan UI. Sam kontrakt AI (zakres, źródła, streaming, proposal/diff, approval) należy do rodziny UI-AI-01 i panelu, który się otwiera, nie do shellu. Otwarcie panelu Teresy nie może zablokować nawigacji ani zresetować `activeRouteId`.

## 9. Nawigacja

Deep link musi rozwiązać moduł + submoduł + identyfikator obiektu w JEDNEJ nawigacji, bez pośredniego stanu „moduł domyślny → potem obiekt" widocznego użytkownikowi. Back z shellu wraca do POPRZEDNIEGO MODUŁU (nie do wewnętrznej zakładki huba — to kontrakt UI-HUB-01 §9). Stan `collapsed` sidebar przeżywa każdą nawigację. Po zmianie modułu focus przechodzi do nagłówka nowego modułu (cel skip linku), nie zostaje na klikniętym elemencie sidebar i nie resetuje się do `body`.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla shellu: poniżej 1280 px sidebar zwija się do szyny ikon 64 px — nigdy nie znika całkowicie; nawigacja pozostaje osiągalna jako ikony bez etykiet, nie chowa się za dodatkowym menu.

## 11. Accessibility

Skip link jest zadeklarowany jako pierwszy fokusowalny element strony w intencji (`MainLayout.tsx:288-293`), ale DOM umieszcza `<Sidebar />` (linia 274) PRZED otwarciem `<main>` (linia 279) — w realnej kolejności Tab pierwsze zatrzymanie trafia w linki sidebar, nie w skip link. Kontrakt tej rodziny: skip link MUSI być pierwszym fokusowalnym węzłem w DOM, przed jakimkolwiek elementem nawigacji. Landmarki obowiązkowe raz na stronę: `nav` (sidebar), `main` (treść trasy, `id="app-main-content"`); topbar nie ma własnego landmarku. Kolejność fokusa przy zmianie modułu: trigger w sidebar → nagłówek nowego modułu.

## 12. Visual tokens

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Wartości specyficzne dla shellu, zmierzone w kodzie 2026-08-02 (`Sidebar.tsx:422` — `const sidebarWidthClass = showFull ? 'w-64' : 'w-16'`, Tailwind `w-16` = 64px / `w-64` = 256px): sidebar collapsed 64 px / expanded 256 px, App Topbar 48 px (§4) — jedyna karta definiująca te dwa wymiary; żadna inna rodzina ich nie nadpisuje. **Rozjazd doc↔kod:** `FOUNDATION_TOKEN_CONTRACT.md` §4 podaje 56/240 px dla tego samego sidebar — dług dokumentacyjny do sprostowania w tamtym pliku, nie w tej karcie.

## 13. Security i privacy

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Dane wrażliwe specyficzne dla shellu: lista modułów w Sidebar jest mapą uprawnień organizacji. Pozycja zablokowana przez `isLocked`/`lockedMessage` (§5) NIE znika — zostaje widoczna, disable'owana i opisana tooltipem (`NavItem.tsx`, `aria-disabled` + `title`). To jest wygoda UX, NIE kontrola dostępu — route guard musi odrzucić bezpośredni URL do modułu bez uprawnień niezależnie od tego, czy pozycja menu była zablokowana czy nie.

## 14. Performance

Anulowanie stale requests, stabilne skeletony, debounce tylko dla search, cache z invalidacją i wirtualizacja adekwatna do danych. Focus i selection nie mogą ginąć podczas wirtualizacji. Spinner >10 s wymaga recovery. Specyficzne dla shellu: przełączenie modułu NIE przeładowuje `MainLayout`/`Sidebar` — tylko treść trasy się re-renderuje; sesja/tenant/capability nie są pobierane ponownie przy każdej nawigacji.

## 15. Telemetry

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Zdarzenia specyficzne dla shellu: `route_change` (niesie `fromModule`/`toModule`/`durationMs`), `sidebar_collapse_toggle` — osobny event, nie część `route_change`.

## 16. Miejsca użycia

MainLayout; Sidebar; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowany, konkretny dług (2026-08-02): skip link (`MainLayout.tsx:288-293`) jest DOM-owo ZA `<Sidebar />` (`MainLayout.tsx:274` vs `279`) — nie działa jako pierwszy stop klawiatury, mimo że kod deklaruje intencję (`sr-only focus:not-sr-only`). Naprawa wymaga przeniesienia elementu przed `<Sidebar />` w drzewie, nie zmiany stylu. Poza tym: ręczne dropdowny, magic values i odmienne keyboard behavior w innych powłokach (np. `SuperAdminSidebar.tsx`) są długiem, nie referencją.

## 18. Acceptance tests

Light/dark; PL/EN; 1280/1440/1920; 125%/200%; keyboard; VoiceOver/NVDA smoke; target size; contrast; reduced motion; long/empty/error/no-access; slow/timeout/retry/conflict; visual regression oraz krytyczny E2E. Krytyczny test odrzucający tej rodziny: deep link do obiektu wewnątrz modułu i późniejszy Back nie mogą zgubić modułu ani focusu — sekwencja: otwórz deep link → Tab (skip link musi być PIERWSZY fokusowalny element, patrz §17) → Back → moduł i stan sidebar (collapsed/expanded) są niezmienione.

## 19. Evidence

Kandydat: Tasks/Decisions shell candidate. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa przeniesiona do COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — korekta po panelu adwersaryjnym: §5/§13 twierdziły, że pozycje nawigacji mają pole `capability` i że Sidebar FILTRUJE pozycje bez uprawnień z listy — grep na `menuConfig.ts`/`types.ts` daje zero trafień dla `capability`; realne pole to `isLocked`/`lockedMessage`, a zachowanie jest odwrotne: zablokowana pozycja zostaje w DOM, disable'owana z tooltipem (`NavItem.tsx`). Poprawione oba miejsca. §3/§10/§12 twierdziły „sidebar 56/240 px" — realny `Sidebar.tsx:422` (`w-16`/`w-64`) daje 64/256 px; poprawione, rozjazd z `FOUNDATION_TOKEN_CONTRACT.md` §4 (56/240) odnotowany jako dług dokumentacyjny w §12.

2026-08-02 — kontrakt 2.1: treść sekcji 5, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18 zróżnicowana per rodzina (poprzednia wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).
2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

