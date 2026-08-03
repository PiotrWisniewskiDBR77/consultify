---
component_id: UI-NMODE-01
name: N-mode Record
family: workspace
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
  - src/components/shared/NModeLayout/ (NModeShell, NModeHeader, NModeLeftNav, cardSets.ts, useCardLayout.ts)
known_consumers:
  - src/components/MyWork/TaskDetailView.tsx
  - src/components/MyWork/DecisionDetailView.tsx
  - src/components/MyWork/NotificationDetailView.tsx
  - src/components/Interview/InterviewWorkspace.tsx
  - src/components/Interview/InsightViewer.tsx
  - src/components/Initiatives/InitiativeDocumentView.tsx
  - src/components/DiscoveryTools/KnownToolDetailView.tsx
  - src/components/standard/StandardArtifactShell.tsx
last_runtime_audit: 2026-08-02
---

# UI-NMODE-01 — N-mode Record

## 1. Job to be done

Przeprowadzić pracę nad jednym rekordem przez spójne sekcje, akcje i właściwości.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `workspace`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

Menu 1 60, Menu 2 48, section nav, content, right properties/actions, relations/history. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

task, decision, initiative, assessment, record. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Kontrakt sekcji (`cardSets.ts`, SSOT „card-management" wzorca N §3.5): każdy typ artefaktu (`insight`/`initiative`/`decision`/`task`, plus `notification`/`tool` z własnym `spec` poza rejestrem) deklaruje `catalog` — WSZYSTKIE karty jakie mogą się pojawić (id + etykieta PL/EN + ikona) — oraz co najmniej jeden `set` z kolejnością i widocznością domyślną. `id` karty MUSI być identyczny z `id` sekcji, którą artefakt faktycznie renderuje — inaczej layout wskazuje na sekcję, której nie ma. Użytkownik może dodać/usunąć/przestawić kolejność kart przez „+ Nowa karta ▾" (`useCardLayout` zamienia `set` domyślny w żywy `{id, visible, order}[]`), a każdy artefakt persystuje ten układ WŁASNYM `onLayoutChange` — nie ma wspólnego backendu układu dla wszystkich typów N.

## 6. Akcje i zdarzenia

navigate sections, edit, save, lifecycle action, AI analyze, link. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

loading, ready, editing, saving, saved, overdue/risk, read-only, conflict, error. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

N-mode ma DWA realne, zweryfikowane punkty wejścia AI z osobnym zakresem: (1) `FieldAIButton.tsx` — akcja PER POLE wewnątrz jednej karty/sekcji (`useCardAIAnalysis.ts` obsługuje wynik), pending blokuje TYLKO to pole; (2) `AIConsultantPanel.tsx`/`NCardAIAnalysisPanel.tsx` — analiza CAŁEJ karty w prawym panelu, osobny pending, nie blokuje edycji pól w centrum. Te dwa zakresy nie mogą dzielić jednego stanu `pending` — użytkownik edytujący pole X musi móc równolegle poprosić o analizę AI całej karty, i odwrotnie. Slot AI (`sparkles`) w Menu 3 (§10.2 ARTIFACT_ANATOMY) jest TRZECIM, osobnym zakresem — działa na poziomie całego artefaktu, nie sekcji.

## 9. Nawigacja

Przejście z listy do N-mode zachowuje drogę powrotu przez `⑫`breadcrumb ← w Menu 1 (§11.2 ARTIFACT_ANATOMY) — Esc/Back wraca do listy z filtrem/sortem/zaznaczeniem nietkniętym, nie do stanu domyślnego. WEWNĄTRZ artefaktu zmiana sekcji (klik w `NModeLeftNav`/kartę) MUSI: (a) nie gubić niezapisanego szkicu w polu, które użytkownik właśnie edytował — pole zachowuje wartość po powrocie do tej sekcji w tej samej sesji; (b) ogłosić zmianę czytnikowi ekranu (`aria-live`) — TO JEST NIEZWERYFIKOWANE w kodzie: `NModeSectionWrapper.tsx`, `NModeLeftNav.tsx` i `NModeShell.tsx` nie mają ani jednego `aria-live` (zweryfikowane grepem), jedyny `aria-live` w całym `NModeLayout/` jest w `NModeCardState.tsx` i dotyczy stanu ładowania, nie zmiany sekcji — patrz §17.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla N-mode (§19.1 `ARTIFACT_ANATOMY_STANDARD.md`): 1024–1280 px chowa prawy panel `⑪` do drawera (rail zostaje), 768–1024 px chowa też rail — poniżej 768 px tryb jest READ + lekkie akcje, nie pełna edycja sekcji; canvas (archetyp A) nie udaje że działa w pełni na telefonie.

## 11. Accessibility

Pełny cykl Tab przechodzi PRZEZ WSZYSTKIE strefy powłoki w kolejności: Menu 1 (back/tytuł/status/primary) → Menu 3 (nawigacja sekcji) → centrum karty aktywnej → prawy panel accordion (Akcje→Właściwości→Powiązania→Komentarze→Historia/AI), bez pułapki fokusa między strefami — to jest wymóg DoD §18.1 wprost. Zweryfikowany w kodzie realny gap: `isDirty` (wskaźnik „Zapisano/niezapisane" w `NModeHeader.tsx`) informuje WIZUALNIE o niezapisanym stanie, ale nie ma odpowiednika `aria-live` przy zmianie sekcji (§9) — czytnik ekranu nie dowiaduje się, że wszedł do innej karty, dopóki nie natrafi na jej nagłówek przy przemiataniu treści.

## 12. Visual tokens

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla N-mode: status-lifecycle w Menu 1 jest ETYKIETĄ-PIGUŁKĄ z tekstem, nie nagą kropką (decyzja D-B, `NModeHeader.tsx`) — kropka 12 px bez podpisu udowodniono że zapada się do 0 px poniżej ~1200 px, więc N-mode NIE MA prawa użyć samej kropki tam, gdzie UI-STATUS-01 poza tym kontekstem może.

## 13. Security i privacy

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla N-mode: layout kart (kolejność/widoczność, §5) jest preferencją UŻYTKOWNIKA, nie danych — chowanie sekcji przez `useCardLayout` NIE jest kontrolą dostępu; sekcja bez capability musi zniknąć z `catalog` po stronie serwera/permission gate, nie tylko z widocznego `set`, inaczej „+ Nowa karta ▾” oferuje odsłonięcie sekcji, do której użytkownik nie ma prawa.

## 14. Performance

`cardSets.ts` jest jawnie „DATA ONLY (no React, no persistence)" (cytat z nagłówka pliku) — katalog i domyślne zestawy kart to statyczne dane, przeliczenie widocznego layoutu (`useCardLayout`) nie może więc zależeć od stanu edycji pola w aktywnej sekcji. Zmiana sekcji NIE remontuje całej powłoki — tylko centrum się przełącza (§10.2 ARTIFACT_ANATOMY: „archetyp zmienia TYLKO centrum + Menu 2 + rail"); Menu 1, prawy panel accordion i wskaźnik zapisu (`isDirty`/`saveState` w `NModeHeader.tsx`) przeżywają przełączenie sekcji bez re-mountu, więc pisanie w polu jednej sekcji nie resetuje stanu „Zapisano/Zapisywanie" widocznego w nagłówku.

## 15. Telemetry

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Zdarzenia specyficzne dla N-mode: `section_switch` (id sekcji źródłowej→docelowej), `card_layout_changed` (dodanie/usunięcie/reorder karty przez `useCardLayout`) — czas spędzony w sekcji NIE jest miernikiem produktywności użytkownika, tylko sygnałem priorytetyzacji, która sekcja wymaga lepszego UX.

## 16. Miejsca użycia

`src/components/shared/NModeLayout/` realnie osadzony w: `TaskDetailView.tsx`, `DecisionDetailView.tsx`, `NotificationDetailView.tsx` (MyWork), `InterviewWorkspace.tsx`/`InsightViewer.tsx` (Interview), `InitiativeDocumentView.tsx` (Initiatives), `KnownToolDetailView.tsx`/`ToolDocumentView.tsx` (DiscoveryTools), `KimiWorkspaceShell.tsx` (AIChat) oraz przez `StandardArtifactShell.tsx` jako powłoka generyczna. To ~10 realnych ekranów, nie deklaracja „wszystkie moduły".

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowane w kodzie: (1) `cardSets.ts` sam dokumentuje historyczny dług typów — `'notification'`/`'tool'` były rzutowane `as unknown as NModeArtifactType`, żeby „oszukać kompilator" (cytat komentarza), zanim dodano je do unii; oba mają WŁASNY `spec` poza `DEFAULT_CARD_SETS`, więc nie przechodzą tej samej ścieżki co pozostałe 4 typy. (2) Reorder sekcji ma DWA równoległe mechanizmy: strzałki góra/dół w „Sekcje ▾" (`NModeCardManager.tsx`, bez zależności DnD) i osobny `@dnd-kit` drag w lewym nav (`NModeLeftNav.tsx`) — oba muszą prowadzić do tego samego `order`, ale to dwie różne implementacje interakcji dla jednej operacji danych. (3) `aria-live` przy zmianie sekcji nie istnieje (§9/§11) — czytnik ekranu nie dowiaduje się o przełączeniu karty.

## 18. Acceptance tests

Krytyczny test odrzucający z appendixu („przejście sekcji zachowuje draft i announce"), rozwinięty: wpisz tekst w polu sekcji A (bez zapisu/blur) → klik w sekcję B w lewym nav → wróć do sekcji A → wpisana wartość MUSI nadal tam być (nie zresetowana do wartości z serwera). Dziś (§9/§17) druga połowa testu — ogłoszenie zmiany sekcji czytnikowi — NIE PRZECHODZI: brak `aria-live` w `NModeSectionWrapper.tsx`/`NModeLeftNav.tsx`/`NModeShell.tsx`. Drugi test: „+ Nowa karta ▾" dodaje kartę spoza domyślnego `set`, odśwież stronę — układ (widoczność+kolejność) MUSI przetrwać przez `onLayoutChange` artefaktu.

## 19. Evidence

Kandydat: Tasks i Decisions detail candidate. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa przeniesiona do COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.
2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

