# Prezentacje v8 - Workflow model

> Status: Draft v8
> Cel: Zdefiniowac docelowy model pracy uzytkownika z prezentacjami w `consultify`.
> Zakres: deck lifecycle, role wizarda i buildera, AI, traceability, present/share/export.

---

## 1. Definicja

`Prezentacje v8` nie sa tylko eksportem do PPTX.
To `Gamma-primary workflow` osadzony w `consultify`, czyli system tworzenia i dowozenia deckow, ktory:
- startuje z biblioteki albo kontekstu,
- szybko buduje outline i draft decku,
- pozwala wejsc w refinement bez utraty kontroli,
- zachowuje traceability do zrodel,
- wspiera present/share/export/analytics jako czesc tej samej sciezki produktu.

---

## 2. Glowny lifecycle decku

Kanoniczny lifecycle:

`library -> create -> setup/prompt -> outline -> generate deck -> builder refine -> present/share/export -> analytics/refresh/archive`

To jest glowna sciezka produktu.
`consultify` nie buduje alternatywnego modelu pracy obok niej, tylko doklada pod spodem artifacts, brand, governance i traceability.

### 2.0 What we already have and will reuse

Wykorzystujemy juz istniejace elementy:
- `ReportsAndPresentationsHub` jako library,
- `PresentationWizard` jako create/setup/outline/generate spine,
- `DeckBuilder` jako builder refine spine,
- generator, brand kit, template APIs, share/embed/export i source traceability.

### 2.1 Library / create

User startuje z:
- biblioteki prezentacji,
- szybkiego CTA do create flow,
- template gallery,
- artifact-first entry,
- blank brief entry.

Efekt:
- library jest punktem orientacji,
- create nie wyglada jak osobny produkt oderwany od huba.

### 2.2 Setup / prompt

User startuje z:
- template,
- audience,
- goal,
- language,
- tone/register,
- confidentiality,
- brand/theme defaults,
- selected sources,
- free-form prompt lub brief.

User ustala:
- audience,
- goal,
- language,
- mode/register,
- confidentiality,
- theme/brand defaults,
- selected sources.

- generator zna nie tylko temat, ale tez oczekiwany charakter decku,
- deck ma `source context`, a nie jest tylko pustym plikiem.

### 2.3 Outline review

System proponuje outline na podstawie:
- template,
- source artifacts,
- intent catalog,
- AI narrative,
- source-aware deck heuristics.

Efekt:
- user recenzuje strukture przed pelna generacja,
- outline jest glownym review gate, nie ukrytym krokiem AI.

### 2.4 Generate deck

System buduje:
- draft slajdow,
- source-backed content,
- optional visuals,
- speaker notes i deck metadata tam, gdzie maja sens,
- builder-ready deck state.

Efekt:
- user nie startuje od zera,
- AI buduje duza czesc pierwszej wersji decku.

### 2.5 Builder refine

User poprawia:
- kolejnosc i tresc slajdow,
- bloki,
- visual polish,
- summary,
- notes,
- refreshable data,
- share settings.

Efekt:
- deck przechodzi od draftu do ready state,
- builder jest druga polowa tego samego workflow, a nie rownoleglym swiatem.

### 2.6 Present / share / export

Deck jest:
- prezentowany,
- udostepniany,
- embedowany,
- eksportowany,
- mierzony przez analytics i delivery signals.

Efekt:
- deck staje sie finalnym artefaktem dla odbiorcy.

### 2.7 Analytics / refresh / archive

Deck moze:
- zostac odswiezony z nowych danych,
- zachowac traceability do zrodel,
- pozostac zywym artefaktem,
- zostac zarchiwizowany po zakonczeniu cyklu zycia.

Efekt:
- prezentacja nie musi byc jednorazowym plikiem bez kontekstu.

---

## 3. Docelowy model pracy uzytkownika

### 3.1 Tryb 1 - Gamma-like create from library

Scenariusz:
- user wchodzi do `ReportsAndPresentationsHub` i wybiera create flow.

System powinien:
- prowadzic do setup/prompt bez gubienia library context,
- pokazywac templates, recent decks i recommended starts,
- zachowac prostote glownej sciezki.

### 3.2 Tryb 2 - Template-first deck creation

Scenariusz:
- user wybiera template i dostosowuje setup.

System powinien:
- podpowiadac najlepszy template,
- pokazywac expected slide logic,
- ograniczac chaos w pierwszych decyzjach.

### 3.3 Tryb 3 - Artifact-first deck creation

Scenariusz:
- user startuje z initiative, note, report, finance analysis, idea table albo innego artefaktu.

System powinien:
- dziedziczyc source context,
- proponowac outline na podstawie artifact semantics,
- utrzymac link source -> deck.

### 3.4 Tryb 4 - Blank brief to deck

Scenariusz:
- user ma temat, ale nie ma jeszcze gotowego artefaktu zrodlowego.

System powinien:
- zbudowac outline i deck z prompt/brief,
- jasno sygnalizowac, co jest oparte na zrodle, a co jest AI-generated draftem.

### 3.5 Tryb 5 - Refine in builder

Scenariusz:
- user wchodzi do buildera, bo chce dopracowac deck.

System powinien:
- zachowac generated structure i traceability,
- wspierac review, edits, quality gates i share preparation,
- nie rozjechac decku wzgledem zrodel bez jawnego sygnalu.

### 3.6 Tryb 6 - Deliver and share

Scenariusz:
- deck trafia do odbiorcy jako live presentation, shared deck, embed albo export.

System powinien:
- wspierac present/share/export,
- pokazywac delivery status i analytics,
- zachowac governance i legal/policy boundaries.

---

## 4. Warstwy workflow modelu

### 4.1 Library and navigation layer

Elementy:
- `ReportsAndPresentationsHub`,
- tabs,
- lists/cards,
- filters,
- entry points do wizarda i buildera.

Definition of done:
- user rozumie, gdzie jest biblioteka, gdzie generator, a gdzie edycja decku,
- library jest jednym kanonicznym startem produktu.

### 4.2 Generation layer

Elementy:
- source selection,
- setup,
- outline generation,
- intent-driven slide planning,
- deck generation.

Definition of done:
- generator prowadzi do reviewable draftu, a nie do nieprzezroczystego blobu,
- AI ma rosnaca role w budowie decku, ale review pozostaje jawne.

### 4.3 Authoring layer

Elementy:
- `DeckBuilder`,
- slide reorder,
- block editing,
- theme and deck settings,
- notes, visuals, versions.

Definition of done:
- refinement jest szybki i nie wymaga recznej walki z narzedziem,
- builder przejmuje deck bez utraty continuity po wizardzie.

### 4.4 Brand and quality layer

Elementy:
- brand kit,
- themes,
- quality gates,
- layout discipline,
- visual QA.

Definition of done:
- output jest branded i "good by default".

### 4.5 Traceability and refresh layer

Elementy:
- source refs,
- source type/id,
- context pack snapshot,
- refreshable blocks,
- deck history.

Definition of done:
- user moze zrozumiec, skad deck sie wzial i co da sie odswiezyc,
- source-backed semantics nie lamia prostoty create flow.

### 4.6 Delivery layer

Elementy:
- present mode,
- shared links,
- embed,
- analytics,
- export history,
- download/export.

Definition of done:
- deck jest gotowy do uzycia poza builderem, nie tylko "edytowalny".

### 4.7 Governance layer

Elementy:
- legal hold checks,
- share permissions,
- org-safe access,
- auditability,
- AI review contract.

Definition of done:
- prezentacja jest wiarygodnym outputem, a nie chaotycznym draftem bez kontroli.

---

## 5. Rola AI w workflow

AI w `Prezentacje v8` nie jest osobnym dodatkiem.
Jest glownym builderem pierwszej wersji decku oraz warstwa wspierajaca refinement i source-aware delivery.

### 5.1 AI during setup and outline

AI moze:
- proponowac outline,
- dobierac intents,
- dobierac template,
- sugerowac mode/register,
- rozpoznawac najlepsze source artifacts.

AI nie moze:
- ukrywac, skad wynikaja slajdy,
- generowac decku w calosci bez review step.

### 5.2 AI during generation

AI moze:
- budowac narrative,
- kondensowac material,
- proponowac speaker notes,
- planowac visuals,
- wskazywac key messages.

AI nie moze:
- nadpisywac source-backed tresci po cichu,
- wymyslac zrodel bez mozliwosci weryfikacji.

### 5.3 AI during refinement

AI moze:
- skracac copy,
- dodawac summary,
- wzmacniac notes,
- poprawiac styl,
- odswiezac refreshable data blocks,
- sugerowac quality improvements.

AI nie moze:
- wykonywac silent edits,
- mieszac user edits i AI edits bez rozroznienia.

### 5.4 AI during delivery

AI moze:
- podpowiadac speaker framing,
- przygotowac audience-specific variants,
- wskazywac deck risks przed udostepnieniem.

AI nie moze:
- samodzielnie udostepniac decku,
- zmieniac confidentiality lub permissions.

### 5.5 AI operation classes

Kanoniczne klasy operacji:
- `AI suggest`
  Bez zapisu, tylko rekomendacja.
- `AI draft`
  Tworzy outline, slide, notes albo rewrite proposal do review.
- `AI apply after acceptance`
  Stosuje zmiane dopiero po akceptacji usera.

---

## 6. Kanoniczne scenariusze pracy

### 6.1 Initiative / steering deck

1. User startuje z initiative context.
2. System proponuje outline: status, KPI, risks, next steps.
3. Draft deck powstaje z source refs.
4. User dopracowuje deck w builderze.
5. Deck trafia do sharing/export jako update zarzadczy.

### 6.2 Board / executive deck

1. User wybiera executive template i najwazniejsze artifacts.
2. AI kondensuje material do decku o wysokiej gestosci zarzadczej.
3. Quality gates pilnuja clarity i visual discipline.
4. Deck ma speaker notes i analytics po udostepnieniu.

### 6.3 Sales / partner deck

1. User startuje z blank briefu albo template.
2. System buduje deck z brand defaults.
3. AI wspiera strukture przekazu, ale user review pozostaje konieczne.
4. Deck jest gotowy do share/embed/export.

### 6.4 Data-backed review deck

1. User startuje z reports/finance/tool session context.
2. Generator buduje data-backed slides.
3. Refreshable blocks pozwalaja wracac do decku.
4. Traceability i refresh sa czytelne dla usera.

---

## 7. Powiazania z reszta platformy

`Prezentacje v8` musza byc zintegrowane z:
- artifacts platformy,
- report builder outputs,
- notes i `Notebook`,
- initiative/execution/finance surfaces,
- `My Work` export flows,
- organization style profile i brand kit.

## 8. Wizard -> builder continuity contract

Minimalny kontrakt continuity:
- wizard tworzy deck state otwieralny bezposrednio w builderze,
- outline decisions, generation settings, selected sources i traceability przechodza dalej bez utraty,
- builder nie moze wymagac osobnej rekonstrukcji decku po generacji,
- share/export dzieja sie z tego samego deck context.

Deck nie jest odrebnym swiatem.
To finalny lub reviewable output osadzony w systemie pracy.

---

## 8. Workflow model a UI constraints

Workflow `v8` musi respektowac:
- istniejace routingi i modulowe wejscia,
- shell i frozen layouts aplikacji,
- fakt, ze `ReportsAndPresentationsHub` jest glownym wejscie bibliotecznym,
- rozroznienie miedzy library, wizard i builder bez rozbijania shella.

Nie robimy:
- broad rewrite navigation,
- osobnego, oderwanego produktu dla deckow,
- obiecywania pelnej realtime collaboration baseline bez gotowego kontraktu.

---

## 9. Definition of success

Workflow model jest domkniety, gdy:
- istnieje jedna glowna sciezka `source/brief -> outline -> deck -> deliver`,
- rola wizarda, buildera i library jest czytelna,
- AI ma jawny kontrakt review,
- traceability jest widoczna i uzyteczna,
- deck jest traktowany jako zywy artefakt, nie tylko eksport.
