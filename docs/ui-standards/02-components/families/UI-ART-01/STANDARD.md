---
component_id: UI-ART-01
name: Artifact Shell
family: artifact
spec_status: APPROVED_SPEC
runtime_status: PARTIAL
contract_version: 2.1
product_owner: Piotr Wisniewski
code_owner: Frontend Platform
canonical_docs:
  - docs/ui-standards/CANON.md
  - docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md
  - docs/ui-standards/02-components/PRIMITIVE_INTERACTION_CONTRACT.md
  - Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md
reference_implementations:
  - NModeLayout; artifact shells
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-ART-01 — Artifact Shell

## 1. Job to be done

Pracować nad złożonym artefaktem z zachowaniem tożsamości, narzędzi i kontekstu.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `artifact`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

Menu 1 60, Menu 2 48, optional Menu 3 44, work area, rail, right panel, status. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

record, document, table, canvas, presentation; S/L. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Powłoka niesie kontrakt wspólny dla wszystkich 5 archetypów — `id`, tenant scope, `lifecycle`, `mode` (który z 5 archetypów: record/document/table/canvas/presentation) i `sizeClass` (S/L, decyduje o obecności Menu 3). Archetyp nie wprowadza własnego kształtu tego kontraktu — dokłada wyłącznie payload centrum (pola formularza dla Rekordu, blok tekstu dla Dokumentu, graf dla Canvasu, slajdy dla Decku), nigdy nowego pola na poziomie powłoki. To różni tę kartę od UI-TOOL-01/UI-CANVAS-01, które same SĄ centrum — tu centrum jest gościem wewnątrz stałej ramy.

## 6. Akcje i zdarzenia

navigate mode, edit, save, share, convert, history, close. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

loading, ready, selected, editing, saving, stale, read-only, no-access, error. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Slot AI (`sparkles`) jest w stałym miejscu niezależnie od archetypu — Menu 3 prawa strona i sekcja „Historia/AI” w prawym panelu (`ARTIFACT_ANATOMY_STANDARD.md` §10.2) — to jest właściwość powłoki, nie centrum. Co AI generuje wewnątrz centrum (tekst dokumentu, węzły canvasu, slajdy) definiuje archetyp; to, że AI ma jedno przewidywalne miejsce wejścia i jedną sekcję historii, definiuje ta karta i nie może się różnić między archetypami — użytkownik uczy się „AI mieszka tu” raz, dla wszystkich pięciu.

## 9. Nawigacja

Otwieranie wg klasy: L = pełny widok (breadcrumb + Menu 1/2/3), S = drawer nad listą, nigdy osobna trasa dla tego samego obiektu w dwóch klasach jednocześnie (`ARTIFACT_ANATOMY_STANDARD.md` §12.2, drabina otwierania). Guard niezapisanych zmian jest własnością powłoki (Menu 1 „Zapisano •” vs „Niezapisane zmiany”), nie centrum — dokument, rekord i canvas zgłaszają dirty do TEJ SAMEJ powłoki, powłoka decyduje o modalu wyjścia jednym mechanizmem.

## 10. Responsive i zoom

Podstawa: `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Panel właściwości (360 px, zakres 320–420 px) jest jedynym elementem powłoki, który przy 1024 compact zamienia się w drawer wysuwany znad centrum — Menu 1/2/3 nie chowają się nigdy, bo to one niosą tożsamość obiektu.

## 11. Accessibility

Pełny cykl Tab przechodzi przez całą powłokę w jednej przewidywalnej kolejności: Menu 1 → Menu 2/3 → centrum → prawy panel → akcje panelu (`ARTIFACT_ANATOMY_STANDARD.md` §18.1) — to test specyficzny dla powłoki, bo centrum może mieć własną wewnętrzną pułapkę fokusa (np. canvas, patrz UI-CANVAS-01 §11) i powłoka musi umieć z niej wyjść jednym Esc bez utraty pozycji w reszcie interfejsu. Streaming Teresy w panelu AI renderuje się w `role="log"` + `aria-live="polite"` + `aria-relevant="additions text"` niezależnie od archetypu (wzór `UnifiedChatPanel.tsx`).

## 12. Visual tokens

Podstawa: §3a. Wysokości powłoki wspólnej (`FOUNDATION_TOKEN_CONTRACT.md` §4): Menu 1 (tożsamość artefaktu) 60 px, Menu 2 (archetyp) 48 px, Menu 3 (kontekst widoku) 44 px docelowo — **dług doc↔kod otwarty**: realna wysokość Menu 3 w kodzie (`MENU_3_ROW_CLASS`, `src/components/shared/ModuleMenu3.tsx`) daje ≈48 px, nie 44 px; nierozstrzygnięte, rejestrowane w `_DOC_CODE_DELTA_REGISTER.md`. Ikona typu obiektu w Menu 1 (`ARTIFACT_ANATOMY_STANDARD.md` §11.2) jest jedynym miejscem powłoki, gdzie archetyp wnosi własny wizualny sygnał — poza tym miejscem paleta i typografia powłoki są identyczne między Canvas/Dokument/Rekord/Matryca/Deck.

## 13. Security i privacy

Podstawa: §3a. Capability jest egzekwowane na poziomie CAŁEGO artefaktu przez powłokę (dostęp do obiektu), a osobno na poziomie pól/sekcji centrum przez archetyp (np. pole finansowe w Rekordzie) — powłoka nie zakłada, że dostęp do obiektu oznacza dostęp do każdego pola wewnątrz.

## 14. Performance

Powłoka sama w sobie jest lekka (statyczne strefy, brak wirtualizacji) — cały koszt wydajności leży w centrum i jest odpowiedzialnością archetypu (np. próg 500/750 węzłów dla Canvasu, przepełnienie eksportu dla Decku). Jedyny wymóg na poziomie powłoki: przełączenie Menu 3 (view-local) nie przeładowuje Menu 1/2/prawego panelu — remontuje się tylko centrum, żeby nawigacja sekcji nie kosztowała tyle co pełne otwarcie artefaktu.

## 15. Telemetry

Podstawa: §3a. Zdarzenia: `artifact.open`, `artifact.mode_change`, `artifact.section_change`, `artifact.export` — każde niesie archetyp (A–E: Canvas/Dokument/Rekord/Matryca/Deck) jako wymiar. To jedyny sposób zmierzenia w danych, czy powłoka jest realnie wspólna w praktyce, a nie tylko w kontrakcie — w tym, jaki procent otwarć kończy się w danym archetypie względem udziału tego archetypu w mapie 40 artefaktów (`ARTIFACT_ANATOMY_STANDARD.md` §4).

## 16. Miejsca użycia

NModeLayout; artifact shells; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowane grepem 2026-08-02: `src/components/standard/StandardArtifactShell.tsx` ma **0 konsumentów** w `src/` — `grep -rn “import.*StandardArtifactShell” src/` i `grep -rn “<StandardArtifactShell” src/` nie dają ani jednego realnego importu/renderu poza samym plikiem komponentu i jego pliku typów. Trzy pliki (`TaskDetailView.tsx`, `DecisionDetailView.tsx`, `AIChat/AgentHubShell.tsx`) tylko WSPOMINAJĄ nazwę w komentarzach (mention, 2026-08-02) — `AgentHubShell.tsx:75` pisze wprost „To NIE jest pełna migracja do `StandardArtifactShell`”. `StandardArtifactShell` jest dziś kandydatem bez wdrożenia, nie powłoką w użyciu — poprzednia wersja karty (twierdząca „3 konsumentów”) była fałszywa.

Realna adopcja leży w `NModeLayout` (`src/components/shared/NModeLayout/`), nie w `StandardArtifactShell`. Import (2026-08-02): 9 plików `.tsx` importuje elementy `NModeLayout` — `DiscoveryTools/KnownToolDetailView.tsx`, `DiscoveryTools/ToolDocumentView.tsx`, `Initiatives/InitiativeDocumentView.tsx`, `Interview/InsightViewer.tsx`, `Interview/InterviewWorkspace.tsx`, `MyWork/DecisionDetailView.tsx`, `MyWork/NotificationDetailView.tsx`, `MyWork/TaskDetailView.tsx`, `standard/StandardArtifactShell.tsx` (plus 7 plików `*CardContract.ts`/`toolCards.contract.ts`, które importują tylko typy/`cardSets`, nie komponenty). Z tych 9 tylko 5 renderuje realnie top-level kompozytor `<NModeShell>` (JSX, 2026-08-02): `KnownToolDetailView.tsx`, `ToolDocumentView.tsx`, `InterviewWorkspace.tsx`, `InsightViewer.tsx`, `StandardArtifactShell.tsx`. Pozostałe cztery (`TaskDetailView.tsx`, `DecisionDetailView.tsx`, `NotificationDetailView.tsx`, `InitiativeDocumentView.tsx`) składają powłokę RĘCZNIE z pojedynczych elementów (`NModeHeader`, `NModeLeftNav`, `NModeCanvas`, `NModeMenu2`…) bez użycia `NModeShell` jako kompozytora — to jest realny duplikat kompozycji wewnątrz samej rodziny Rekordu, nie potwierdzenie jednej wspólnej powłoki. Dla archetypu A/Canvas (Mind Map, Whiteboard żyją w `src/components/MyWork/mindmap/` i `whiteboard/`, osobnym drzewie) i archetypu E/Deck (`src/components/Presentations/DeckBuilder/`, także osobne drzewo) `NModeLayout` nie ma żadnego konsumenta. Reguła „archetyp zmienia TYLKO centrum” nie jest dziś dowiedziona w kodzie nawet w pełni dla Rekordu (rozjazd `NModeShell` vs ręczna kompozycja) i nie jest dowiedziona wcale dla Canvasu i Decku — to jest realny stan adopcji, nie hipoteza.

## 18. Acceptance tests

Krytyczny test odrzucający: każdy z 5 archetypów (Canvas/Dokument/Rekord/Matryca/Deck) przechodzi pełną powłokę (Menu 1/2/3, prawy panel, kebab, stany) bez lokalnego chrome — dziś to udowodnione w kodzie tylko dla archetypu Rekord (§17), więc dla Canvasu i Decku ten test jest odrzucający do czasu migracji, nie formalnością do odhaczenia. Dodatkowo: pełny cykl Tab przez powłokę bez pułapki fokusa (§11); guard niezapisanych zmian działa jednym mechanizmem niezależnie od archetypu; slot AI w tym samym miejscu we wszystkich pięciu.

## 19. Evidence

Kandydat: Tasks/Decisions workspace candidate. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — korekta po panelu adwersaryjnym: §17 twierdziło „`StandardArtifactShell.tsx` ma dziś 3 konsumentów" (`TaskDetailView.tsx`, `DecisionDetailView.tsx`, `AgentHubShell.tsx`) — grep pokazał 0 realnych importów/renderów, te trzy pliki tylko wspominają nazwę w komentarzu. Poprawione na 0 i rozpisana realna adopcja `NModeLayout`/`NModeShell` (9 importerów, 5 realnych `<NModeShell>`, 4 ręczne kompozycje).

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami). §17 zaktualizowane wg realnej adopcji zweryfikowanej grepem: powłoka potwierdzona dla archetypu Rekord, niepotwierdzona dla Canvasu i Decku.

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.
