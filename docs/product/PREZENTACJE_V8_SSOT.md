# Prezentacje v8 - SSOT

> Status: Draft v8
> Cel: Kanoniczna definicja celu, zakresu, modelu domenowego i completeness criteria dla rozwoju modulu prezentacji w serii `v8`.
> Zakres: prezentacje jako artefakt platformy, nie osobny top-level produkt poza `consultify`.

---

## 1. Co oznacza `Prezentacje v8`

`Prezentacje v8` to seria zmian i dokumentow opartych o benchmarki z `Softs/Prezentacje`, ale wdrazanych jako rozwoj istniejacych:
- `ReportsAndPresentationsHub`,
- `PresentationWizard`,
- `DeckBuilder`,
- backendowych APIs prezentacji.

Znaczenie `v8`:
- wspolny prefix dla dokumentacji i pakietow pracy,
- nacisk na kompletny, governed, AI-native deck operating system,
- rozwoj w ramach istniejacej architektury `consultify`,
- zero vendor UI copying.

Kluczowa decyzja tej iteracji:
- `Gamma-like workflow` staje sie nadrzednym modelem pracy produktu,
- `consultify` zachowuje swoje przewagi pod spodem: artifacts, traceability, org brand/media, governance i policy controls.

---

## 2. Mission

Zbudowac w `consultify` prezentacje, ktora nie jest tylko eksportem do `.pptx`, lecz operacyjnym artefaktem komunikacji:
- powstaje szybko z kontekstu i intencji,
- ma czytelny outline i reviewable draft,
- zachowuje source traceability,
- pozwala wejsc w refinement bez chaosu,
- wspiera present/share/export,
- wykorzystuje AI w sposob kontrolowany i audytowalny.

Docelowy user feeling ma byc bliski Gamma:
- szybki start,
- AI buduje duza czesc decku,
- outline i builder daja kontrole,
- delivery jest czescia tego samego produktu.

---

## 3. Scope produktu

### 3.1 In scope

- library/hub dla prezentacji,
- wizard i generate flow,
- deck builder,
- templates i brand kit,
- AI generation i AI deck edits,
- source-backed slide/deck model,
- share/embed/export/analytics,
- quality gates i visual discipline,
- review/governance dla AI i deck delivery.

### 3.2 Out of scope for v8 baseline

- budowa ogolnego narzedzia designowego klasy Figma,
- pelny realtime collaboration baseline,
- kopiowanie smart slide engine 1:1 z Beautiful.ai,
- vendor-style credits/pricing logic,
- odcinanie prezentacji od istniejacych platform artifacts.

---

## 4. Product principles

### 4.1 Presentations remain artifact-driven

Deck w `consultify` ma byc osadzony w artefaktach i kontekscie organizacji.
Nie jest anonimowym plikiem tworzonym w prozni.

### 4.1A Gamma-primary workflow

Nadrzedna sciezka produktu ma byc:

`library -> create -> setup/prompt -> outline -> generate -> builder -> present/share/export -> analytics`

To jest glowny mental model dla usera.
Warstwy `consultify` maja wzmacniac ten workflow, a nie go komplikowac.

### 4.2 Outline first, deck second

Glownym review gate jest outline.
User powinien zobaczyc strukture zanim dostanie finalny deck.

### 4.3 Builder refines, wizard scaffolds

Wizard daje szybki draft i prowadzi przez intencje.
Builder sluzy do refinement, review, share i quality hardening.

To rozroznienie jest kanoniczne:
- wizard = szybkie zbudowanie reviewable decku,
- builder = dopracowanie decku bez utraty continuity.

### 4.4 Traceability is non-negotiable

Kazdy wartosciowy deck powinien miec:
- source context,
- source refs,
- deck metadata,
- mozliwosc zrozumienia, skad pochodza slajdy i bloki.

### 4.5 AI is co-pilot, not ghost editor

AI moze:
- planowac,
- streszczac,
- scaffoldowac,
- sugerowac,
- odswiezac,
- poprawiac styl.

AI nie moze:
- wprowadzac silent edits,
- ukrywac pochodzenia tresci,
- udostepniac decku lub zmieniac governance bez zgody usera.

### 4.5A AI builds most of the deck

W `v8` AI ma budowac duza czesc prezentacji:
- outline,
- slide intents,
- pierwsza wersje copy,
- notes,
- visual suggestions,
- refresh suggestions,
- bulk rewrite proposals.

User nie powinien recznie skladac decku od zera, jesli nie chce.

### 4.6 Delivery matters as much as authoring

Deck nie jest gotowy, dopoki nie ma sensownego modelu:
- present,
- share,
- embed,
- export,
- analytics.

---

## 5. Model domenowy

### 5.1 Encja `PresentationDeck`

Kanonicznie deck w `v8` jest artefaktem, ktory ma:
- `deckId`
- `title`
- `description`
- `status`
- `templateId`
- `themeId`
- `brandKitRef`
- `presentationMode`
- `communicationRegister`
- `language`
- `confidentiality`
- `cards`
- `sourceRefs`
- `contextPackSnapshot`
- `generationSettings`
- `shareSettings`
- `analytics`
- `exportHistory`
- `createdBy`
- `createdAt`
- `updatedAt`

### 5.2 Encja `DeckCard`

Kazdy slajd/karta ma:
- `cardId`
- `intent`
- `title`
- `layoutId`
- `blocks`
- `sourceRefs`
- `speakerNotes`
- `background`
- `animations`
- `isLocked`
- `orderIndex`

### 5.3 Encja `CardBlock`

Blok slajdu ma:
- `blockId`
- `type`
- `content`
- `sourceRef`
- `isRefreshable`
- `position`
- `styleOverrides`
- `aiEditable`

### 5.4 Template contract

Template w `v8` oznacza:
- outline archetype,
- expected intents,
- source expectations,
- mode/register defaults,
- theme or brand defaults,
- quality and layout discipline,
- optional auto-apply hints.

### 5.4A What we already have and will reuse

Ta iteracja `v8` nie projektuje deck product od zera.
Wykorzystujemy bezposrednio:
- `ReportsAndPresentationsHub` jako glowny library entry,
- `PresentationWizard` jako szkic create flow,
- `DeckBuilder` jako refinement surface,
- `presentationGeneratorService` jako generator outline/deck/context,
- `source_type`, `source_id`, `source_refs`, `context_pack_snapshot` jako fundament traceability,
- brand kit, templates, share/embed/export i analytics tam, gdzie juz istnieja.

### 5.5 Deck status lifecycle

Kanoniczny `status` decku:
- `draft`
- `generated`
- `editing`
- `ready`
- `shared`
- `archived`

Znaczenie:
- `draft` - deck istnieje, ale nie ma jeszcze gotowego draftu lub outline jest we wstepnej fazie,
- `generated` - system zbudowal pierwszy draft decku,
- `editing` - user aktywnie dopracowuje deck,
- `ready` - deck jest gotowy do delivery,
- `shared` - deck ma aktywna forme udostepnienia lub dystrybucji,
- `archived` - deck nie jest juz aktywnie utrzymywany.

### 5.7 Canonical deck document and compatibility strategy

Docelowa zasada `v8`:
- istnieje jeden kanoniczny dokument decku uzywany do wizard -> builder -> delivery continuity,
- export i runtime projections nie moga byc mylone z glownym modelem edycyjnym.

Strategia kompatybilnosci:
- czytamy stare decki przez warstwe zgodnosci,
- normalizujemy je do jednego deck runtime modelu przy otwarciu lub zapisie,
- nie robimy destrukcyjnej migracji wszystkich starych deckow na starcie,
- backward read compatibility pozostaje wymogiem rollout.

### 5.8 Runtime truth map

Obecna rzeczywistosc runtime ma dwa poziomy:

- `baseline spine`
  Glownie: `ReportsAndPresentationsHub`, `PresentationWizard`, `DeckBuilder`, `/api/presentations`, generator, share/embed/export.
- `enterprise / extension spine`
  Glownie: `/api/presentations-v4`, bindings, export QA, template governance, PPTX import, REST collab, media library.

Kanoniczna zasada `v8`:
- user-facing workflow ma miec jedna prawde produktu,
- extension capabilities nie moga rozbijac glownej sciezki ani udawac, ze sa glownym runtime, jesli nie sa jeszcze spine'em UI.

### 5.6 Artifact boundary matrix

| Artefakt | Glowny cel | Kiedy uzyc | Kiedy nie uzywac | Relacja do prezentacji |
|---|---|---|---|---|
| `Presentation deck` | Komunikacja linearna lub live z odbiorca | Gdy trzeba poprowadzic narracje slajd po slajdzie | Gdy potrzebny jest glownie tekstowy, referencyjny output | Artefakt finalny lub reviewable draft |
| `Report` | Bardziej dokumentowy output analityczny | Gdy wazniejsza jest pelna tresc niz live narration | Gdy potrzebny jest deck do spotkania lub prezentacji | Deck moze byc pochodna raportu |
| `Notebook note` | Capture i dojrzewanie wiedzy | Gdy material jest jeszcze roboczy | Gdy potrzebny jest delivery-ready output | Notatka moze byc source artifact dla decku |
| `Initiative / analysis artifact` | Operacyjna lub analityczna prawda o stanie pracy | Gdy artefakt ma byc zrodlem danych i faktow | Gdy potrzebna jest warstwa komunikacji dla odbiorcy | Deck powinien dziedziczyc zrodla i traceability |

---

## 6. Warstwy kompletnosci `v8`

### 6.1 Library completeness

Musi istniec:
- jeden kanoniczny hub,
- czytelne tabs i entry points,
- filtry i statusy deckow/templates,
- jasne przejscie do wizarda i buildera.

### 6.2 Generation completeness

Musi istniec:
- setup/prompt flow zblizony do Gamma-like creation,
- source-aware setup,
- template-aware outline,
- reviewable outline,
- generated draft deck,
- clear failure/fallback behavior.

### 6.3 Authoring completeness

Musi istniec:
- edycja slajdow i blokow,
- reorder,
- notes,
- theme/deck settings,
- builder as refinement surface,
- jawny kontrakt wizard -> builder continuity.

### 6.4 Brand and quality completeness

Musi istniec:
- brand kit support,
- theme system,
- quality gates,
- layout discipline,
- branded output baseline.

### 6.5 Traceability completeness

Musi istniec:
- source refs,
- source type/id,
- source-backed deck and blocks,
- context pack snapshot,
- refresh semantics tam, gdzie sa deklarowane,
- jedna definicja canonical deck vs projections/export shapes.

### 6.6 Delivery completeness

Musi istniec:
- present/share/embed/export,
- share status,
- analytics,
- export history,
- clear delivery lifecycle.

### 6.7 Governance completeness

Musi istniec:
- AI propose/review/accept,
- org-safe access,
- legal/policy constraints,
- no silent edits,
- audytowalnosc deck operations,
- jedna mapa baseline runtime vs extension runtime.

---

## 7. AI contract

### 7.1 Zasada glowna

Kazda istotna operacja AI w decku dziala w modelu:

`observe -> propose -> review -> accept/reject`

### 7.2 AI moze

- proponowac outline,
- budowac draft decku,
- poprawiac copy,
- generowac notes,
- sugerowac visuals,
- odswiezac refreshable data blocks,
- proponowac quality improvements.

Macierz operacji AI dla `v8`:
- `AI suggest`
  Rekomendacja bez zapisu.
- `AI draft`
  Draft slajdu, outline albo notes do review.
- `AI apply after acceptance`
  Jawna mutacja decku po decyzji usera.

### 7.3 AI nie moze

- wykonywac silent edits,
- tworzyc falszywych source refs,
- ukrywac, ze dany blok jest AI-generated,
- zmieniac share/confidentiality/legal constraints bez zgody usera.

### 7.4 Minimalny audit baseline

Kazda istotna operacja AI powinna miec:
- `operationType`
- `deckId`
- `actorId`
- `proposalPayload`
- `status`
- `createdAt`
- `resolvedAt`
- `resolvedBy`

---

## 8. UI and shell constraints

`Prezentacje v8` musza respektowac:
- istniejacy shell aplikacji,
- fakt, ze glownym library entry point jest `ReportsAndPresentationsHub`,
- frozen layouts i UI standards,
- rozroznienie library vs wizard vs builder bez broad rewrite.

Nie robimy:
- nowego top-level produktu poza architektura `consultify`,
- przemianowania wszystkiego pod vendorowe modele pochodzace z benchmarkow,
- obiecywania funkcji realtime/collab ponad faktyczny baseline.

---

## 9. As-is anchors

Najwazniejsze kotwice `as-is`:
- `PresentationWizard`
- `DeckBuilder`
- `presentations.routes.ts`
- `presentationGeneratorService.ts`
- `ReportsAndPresentationsHub`
- `PRESENTATION_GENERATOR_V3.md`

Najwazniejsze kotwice Gamma-primary:
- prompt/setup flow zblizony do Gamma,
- outline as review gate,
- builder as second half of the same product,
- AI-led deck construction,
- present/share/export/analytics jako czesc jednego lifecycle.

---

## 10. Supporting build-ready specs

Ten dokument jest SSOT produktu.
Build-ready execution details sa domkniete dodatkowymi specami:
- `PREZENTACJE_V8_RUNTIME_TRUTH_MAP.md`
- `PREZENTACJE_V8_CANONICAL_DECK_MODEL.md`
- `PREZENTACJE_V8_BUILDER_P0_CONTRACT.md`
- `PREZENTACJE_V8_AI_OPERATIONS_SPEC.md`
- `PREZENTACJE_V8_VENDOR_PROCESS_ANALYSIS.md`
- `PREZENTACJE_V8_SLIDE_COMPONENT_SYSTEM.md`
- `PREZENTACJE_V8_SLIDE_PLANNING_ENGINE.md`
- `PREZENTACJE_V8_VISUAL_PLANNING_AND_GRAPHICS.md`

---

## 11. Definition of done for `Prezentacje v8`

`Prezentacje v8` sa domkniete dopiero wtedy, gdy:
- user ma jedna czytelna sciezke `source/brief -> outline -> deck -> deliver`,
- role huba, wizarda i buildera sa jednoznaczne,
- source traceability jest realna i uzyteczna,
- AI jest szybkie, ale governowane,
- deck jest traktowany jako artefakt komunikacji, nie tylko eksportowany plik.

---

## 11. Non-goals

`Prezentacje v8` nie oznaczaja:
- kopiowania Gamma/Beautiful/Pitch 1:1,
- budowy general-purpose design canvas,
- pelnego collaborative design suite w baseline,
- zerwania kompatybilnosci z obecnymi deckami i APIs bez planu rollout.

---

## 12. Success metrics

`v8` powinno poprawic:
- czas od briefu lub artefaktu do reviewable outline,
- czas od outline do deck draft,
- jakosc decku po pierwszej generacji,
- odsetek deckow z poprawna traceability,
- adoption present/share/export flows,
- zaufanie do AI edits i generated content.

---

## 13. One-sentence summary

`Prezentacje v8` to governed, source-backed, AI-native deck operating system osadzony w artefaktach i workflow `consultify`.
