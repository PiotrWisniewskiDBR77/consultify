---
component_id: UI-PREVIEW-01
name: Preview Pane
family: composed
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
  - StandardPreview; PreviewPane
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-PREVIEW-01 — Preview Pane

## 1. Job to be done

Ocenić rekord i wykonać szybkie działania bez utraty listy.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `composed`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

header, title/open/close, meta, summary, relations, AI, quick actions. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

record, message, document, process. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Kontrakt to 6 propsów `StandardPreviewProps` (`StandardPreview.tsx:133-157`): `meta` (blok 2), `details` (blok 3, z `showWordCount` — wyłączane gdy treść to lista/tabela właściwości, nie proza, `TRIADA_KANON.md` §C3), `ai` (blok 4, `PreviewAIHintStripProps`), `relations` (blok 5, pigułki albo `relationsEmptyLabel`), `actions` (blok 6, `resolutions`/`informational`/`time`). Właściwości klucz–wartość idą przez `ArtifactPropertyRow[]`/`ArtifactPropertiesTable`, NIGDY przez sklejenie w akapit `join('\n\n')` (regresja N-52 z przeglądu 128 zrzutów).

## 6. Akcje i zdarzenia

open, full detail, quick action, pin optional, close. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

skeleton, loaded, partial, long, action pending/error, no-access, missing. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Blok 4 (`PreviewAIHintStrip`) to JEDYNE miejsce w tej rodzinie, gdzie AI proponuje akcję na WIDOCZNYM rekordzie — chipy dopasowane do encji, nie generyczna lista. Generowanie treści AI w preview NIE zamyka panelu i NIE przełącza wiersza źródłowego; wynik ląduje jako proposal, aprobata dzieje się przez blok 6 (akcje), nie przez zamknięcie-i-ponowne-otwarcie.

## 9. Nawigacja

Zamknięcie (×, Esc lub `onClose` z `standardPreviewShortcuts`) oddaje focus do wiersza źródłowego w tabeli i NIE resetuje listy: filtr, sort, scroll pozostają. To jest DOKŁADNIEJSZY wariant ogólnego §9 — najczęstsza nawigacja tej rodziny to wiersz→preview→Esc, a nie zmiana trasy; „Open" (jedyny link w nagłówku, `TRIADA_KANON.md` §A7.1) jest jedynym miejscem, gdzie preview faktycznie nawiguje do pełnego widoku.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla preview: szerokość panelu skaluje się `clamp(340px, 28%, 480px)` (`TableWithPreviewLayout.tsx:437,455`) — poniżej 1280 px panel nie maleje dalej niż 340 px; jeśli nie mieści się obok tabeli, priorytet ma tabela.

## 11. Accessibility

Esc zamyka WYŁĄCZNIE preview, nie kaskadowo inne warstwy (reguła „najbardziej lokalny wygrywa", `TRIADA_KANON.md` pkt 42) — jeśli w preview jest otwarty dropdown (np. ⋮ w bloku DETAILS), pierwszy Esc zamyka dropdown, dopiero drugi zamyka preview. Panel jest `complementary non-modal` (`PRIMITIVE_INTERACTION_CONTRACT.md` §2, wiersz Drawer/Sheet) — Tab z zewnątrz panelu może do niego wejść, ale panel nie blokuje reszty strony jak modal.

## 12. Visual tokens

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla preview: szerokość `clamp(340px, 28%, 480px)` dotyczy WYŁĄCZNIE preview listowego (SPEC-L) — inna wartość (360 px / 320–420 px) należy do prawego panelu artefaktu SPEC-A i NIE jest tą samą powierzchnią (`FOUNDATION_TOKEN_CONTRACT.md` §4).

## 13. Security i privacy

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla preview: eksport (Copy/Export/Pobierz) w bloku DETAILS respektuje capability rekordu — przycisk eksportu na rekordzie bez capability jest ukryty w tym bloku, nie disabled.

## 14. Performance

Otwarcie preview NIE przeładowuje listy/tabeli w tle — to osobne żądanie danych rekordu, niezależne od stanu tabeli. Zamknięcie NIE wymusza re-fetchu listy, chyba że akcja z bloku 6 faktycznie zmutowała dane (wtedy read-back dotyczy tylko zmutowanego wiersza, nie całej strony).

## 15. Telemetry

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Zdarzenia specyficzne dla preview: `preview_open`/`preview_close` niosą czas otwarcia — do liczenia abandonment (otwarto i zamknięto bez żadnej akcji z bloku 6).

## 16. Miejsca użycia

StandardPreview; PreviewPane; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. `StandardPreview.tsx` (458 linii) jest jedyną fasadą 6 bloków; `src/components/shared/PreviewPane/` to zestaw podkomponentów (`PreviewMetaCard`, `PreviewDetailsSection`, `PreviewAIHintStrip`, `PreviewRelations`, `PreviewActionBar`, `PreviewActivityStrip`, `PreviewBatchPanel`, `PreviewCompletenessRing`) — część z nich (`PreviewActivityStrip`, `PreviewCompletenessRing`, `PreviewBatchPanel`) NIE odpowiada żadnemu z 6 bloków kanonu `TRIADA_KANON.md` §A7 i wymaga audytu, czy to legalne rozszerzenie per-encja czy nieautoryzowany dodatek.

## 18. Acceptance tests

Light/dark; PL/EN; 1280/1440/1920; 125%/200%; keyboard; VoiceOver/NVDA smoke; target size; contrast; reduced motion; long/empty/error/no-access; slow/timeout/retry/conflict; visual regression oraz krytyczny E2E. Krytyczny test odrzucający tej rodziny: Esc oddaje focus dokładnie do wiersza źródłowego (nie do `body`, nie do góry tabeli) i lista pod spodem ma NIEZMIENIONY filtr/sort/scroll — sprawdzane przez porównanie stanu tabeli przed otwarciem i po zamknięciu preview, nie tylko wizualnie.

## 19. Evidence

Kandydat: Tasks i Decisions preview candidate. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa przeniesiona do COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — kontrakt 2.1: treść sekcji 5, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18 zróżnicowana per rodzina (poprzednia wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).
2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

