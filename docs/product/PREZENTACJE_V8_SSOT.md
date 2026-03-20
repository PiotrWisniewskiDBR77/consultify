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

---

## 2. Mission

Zbudowac w `consultify` prezentacje, ktora nie jest tylko eksportem do `.pptx`, lecz operacyjnym artefaktem komunikacji:
- powstaje szybko z kontekstu i intencji,
- ma czytelny outline i reviewable draft,
- zachowuje source traceability,
- pozwala wejsc w refinement bez chaosu,
- wspiera present/share/export,
- wykorzystuje AI w sposob kontrolowany i audytowalny.

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

### 4.2 Outline first, deck second

Glownym review gate jest outline.
User powinien zobaczyc strukture zanim dostanie finalny deck.

### 4.3 Builder refines, wizard scaffolds

Wizard daje szybki draft i prowadzi przez intencje.
Builder sluzy do refinement, review, share i quality hardening.

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
- builder as refinement surface.

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
- refresh semantics tam, gdzie sa deklarowane.

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
- audytowalnosc deck operations.

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

---

## 10. Definition of done for `Prezentacje v8`

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
