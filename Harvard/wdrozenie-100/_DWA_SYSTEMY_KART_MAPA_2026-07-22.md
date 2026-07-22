# DWA SYSTEMY KOMPOZYCJI KART — mapa i rekomendacja (2026-07-22)

**Cel:** podstawa pod decyzję **P-1** z audytu (`_AUDYT_ARCHITEKTURY_ARTEFAKTOW_2026-07-22.md:100`):
*„Jeden system kart czy dwa?"*. Dokument **nie rozstrzyga** — mapuje oba systemy z dowodem
`plik:linia`, wskazuje różnice strukturalne i daje **rekomendację (nie decyzję)**. Rozstrzygnięcie
progów i tego, „który kanonem", to wejście do `_KONTRAKT_KARTY_SSOT`.

Nomenklatura 07-22: **ARTEFAKT** = ekran+powłoka (7 sztuk). **KARTA** = sekcja wewnątrz artefaktu.
Oba systemy poniżej zarządzają **kartami** (sekcjami) wewnątrz artefaktu.

Baza: worktree `fix/prv-mywork-preview` (origin/demo). Wszystkie ścieżki względem korzenia repo.

---

## 0. TL;DR (jedną kartką)

- Istnieją **DWA** równoległe systemy zarządzania kartami artefaktu:
  - **System A — `cardSets.ts`** (statyczny TS): obsługuje **Insight · Task · Decision** na żywo
    (+ martwy wpis `initiative`). Mocny **UI + hook + „karta nieusuwalna" (core)**, słaby model danych
    (statyczny, jednoorg, jedna kolumna).
  - **System B — Initiative `SECTION_REGISTRY` / `initiative_section_types`**: obsługuje **Initiative**.
    Mocny **model danych** (katalog w bazie, wielotenant `organization_id`, szablony, prompty AI,
    dwie kolumny), słaby UI (brak wspólnego menedżera kart, **brak** egzekwowanej „nieusuwalnej").
- **Nie są symetrycznymi rywalami**: A to *stos UI+dane*, B to *bogaty model danych*. Dlatego rekomendacja
  to **nie „wybierz jeden, skasuj drugi"**, lecz **jeden wspólny KONTRAKT karty** = nadzbiór schematu B,
  renderowany/zarządzany **hookiem+UI z A**. (Sekcja 4.)
- Twardy dowód rozjazdu: `INITIATIVE_SPEC` w `cardSets.ts:228-411` = **martwe dane** (0 konsumentów),
  a słownik kart Initiative **rozjeżdża się w 3 miejscach** (cardSets 25 / registry 29 / seed bazy 24).

---

## 1. Mapa OBU systemów — zestawienie obok siebie

| Wymiar | **System A — `cardSets.ts`** | **System B — Initiative** |
|---|---|---|
| **Gdzie żyje (SSOT)** | statyczny plik TS `src/components/shared/NModeLayout/cardSets.ts` | **baza**: tabela `initiative_section_types` (`server/migrations/529_initiative_section_types.sql:13`); front `src/components/Initiatives/sections/registry.ts` = fallback/lustro |
| **Katalog kart (co MOŻE być)** | `ArtifactCardSpec.catalog[]` — `cardSets.ts:60-65`, wpis `CardCatalogEntry` `cardSets.ts:34-49` | wiersze `initiative_section_types` (ładowane API jako `sectionTypes`) LUB fallback `Object.keys(DEFAULT_VISIBLE_SECTIONS)` — `InitiativeDocumentView.tsx:2135-2169` |
| **Zestaw domyślny (co widać)** | `sets[0]` = kanoniczny default (`cardSets.ts:63`, budowany `useCardLayout.ts:70-87`) | `DEFAULT_VISIBLE_SECTIONS` (`registry.ts:138-170`) **lub** `template.visible_sections` (szablon wygrywa — `InitiativeDocumentView.tsx:2115-2124`) |
| **Warianty zestawów** | nazwane `sets[]` (`minimal`/`full`/`deep`) — przełączane na żywo (`applyDefaultSet` `useCardLayout.ts:254-271`, UI `NModeCardManager.tsx:286-305`) | **szablony** `initiative_templates` (DB, per-org) z `visible_sections`+`section_order` (`529_...sql:184-187`) |
| **Karta core / nieusuwalna** | **TAK** — flaga `core` (`cardSets.ts:48`), egzekwowana: `removeCard` przerywa dla core (`useCardLayout.ts:190`), UI chowa „X" (`NModeCardManager.tsx:364`) | **BRAK** — brak kolumny `is_core`, brak egzekwowania (grep `isCore/non-removable` w `src/components/Initiatives/` = pusto) |
| **Słownik id kart** | per-typ: kebab dla Insight/Decision/Task (`executive-summary`, `context-problem`, `description-scope`), camelCase dla initiative | camelCase: `overview`, `problemDefinition`, `financialAnalysis`… (`registry.ts:50-83`) |
| **Kolejność** | niejawna (pozycja w tablicy) → żywy `{id,visible,order}` (`useCardLayout.ts:40-49`) | `DEFAULT_SECTION_ORDER` (`registry.ts:98-132`) + `template.section_order`, sort per kolumna (`InitiativeDocumentView.tsx:2176-2188`) |
| **Kolumny (layout)** | **jedna** płaska lista | **dwie** — `column_position` left/right (`529_...sql:26`, split `InitiativeDocumentView.tsx:2176-2188`) |
| **Wielotenant (org)** | **NIE** — statyczne, jednakowe dla wszystkich | **TAK** — `organization_id` (`529_...sql:15`), org może dodać własne typy sekcji |
| **Etykiety dwujęzyczne** | `label{en,pl}` w danych (`cardSets.ts:37`) | DB `name`/`name_pl`+`description`/`description_pl` (`529_...sql:19-22`); fallback front: `name=key` surowe (`InitiativeDocumentView.tsx:2141`) |
| **Prompty AI per karta** | **NIE** | **TAK** — `ai_prompt_template` (`529_...sql:38`) + `render_config`/`default_config` (`529_...sql:41-42`) |
| **Ikony** | string-id w danych (`icon`), rozwijane do lucide w UI (`NModeCardManager.tsx:72-108`) | `icon`/`icon_color`/`icon_bg` w DB (`529_...sql:30-32`) |
| **Rozdzielenie danych/React** | tak — dane bez React (`cardSets.ts:23-24`) | częściowe — komponenty w `SECTION_REGISTRY` (`registry.ts:50`) |
| **Hook zarządzania** | `useCardLayout` — add/remove/hide/show/reorder/applyDefaultSet/reset (`useCardLayout.ts:101-133`) | **brak dedykowanego hooka**; logika inline w `InitiativeDocumentView.tsx:2115-2189` |
| **UI zarządzania** | `NModeCardManager` — „+ Nowa karta" + „Sekcje" (show/hide, reorder, przełącznik zestawów, reset) (`NModeCardManager.tsx:144,242`) | **brak wspólnego menedżera**; widoczność sterowana szablonem, reorder = drag zapisany lokalnie |
| **Persystencja układu** | **localStorage** per-artefakt (Insight `insight:nmode:card-layout:v1:` `InsightViewer.tsx:1019,1044`; Decision `decision:nmode:card-layout:v1:` `DecisionDetailView.tsx:1304`; Task `TaskDetailView.tsx:3927`) — **klient-lokalne** | **serwer/DB** (szablony, org-współdzielone) + `localStorage` tylko na doraźny reorder (`nModeOrderStorageKey` `InitiativeDocumentView.tsx:2100-2109`) |
| **Typy artefaktów objęte** | 4 zadeklarowane (`insight/initiative/decision/task` `cardSets.ts:32`); **3 realnie używane** | 1 (Initiative) |
| **Realni konsumenci** | `InsightViewer.tsx:1052`, `TaskDetailView.tsx:3938`, `DecisionDetailView.tsx:1337` | `InitiativeDocumentView.tsx` (+ `InitiativeScrollView`, `InitiativeNotionView`) |

### 1a. Anatomia typów — System A
```
NModeArtifactType = 'insight'|'initiative'|'decision'|'task'   cardSets.ts:32
CardCatalogEntry  { id, label{en,pl}, icon, group?, core? }    cardSets.ts:34-49
CardSet           { id, label{en,pl}, cards[] }                cardSets.ts:51-58
ArtifactCardSpec  { catalog[], sets[] }                        cardSets.ts:60-65
DEFAULT_CARD_SETS Record<type, ArtifactCardSpec>              cardSets.ts:580-585
  INSIGHT_SPEC 71-223 · INITIATIVE_SPEC 228-411 · DECISION_SPEC 416-489 · TASK_SPEC 494-576
```
Karty core (nieusuwalne): Insight `artifact-actions`+`executive-summary` (`cardSets.ts:77,84`);
initiative `overview`+`control` (`cardSets.ts:235,306`); Decision `context-problem` (`cardSets.ts:422`);
Task `description-scope` (`cardSets.ts:500`).

### 1b. Anatomia typów — System B
```
initiative_section_types (DB)   kolumny: key, name, name_pl, description, description_pl,
  category(content|control|meta), column_position(left|right), default_order, icon/icon_color/icon_bg,
  component_key, ai_prompt_template, render_config, default_config, is_system, is_active,
  organization_id                                          529_...sql:13-55
SECTION_REGISTRY  Record<component_key, ReactComponent>   registry.ts:50-83  (29 kluczy)
DEFAULT_SECTION_ORDER  Record<key, number>                registry.ts:98-132 (numery per-kolumna)
DEFAULT_VISIBLE_SECTIONS Record<key, boolean>             registry.ts:138-170 (24 true + 5 false)
SectionTypeInfo (kształt front)                           InitiativeDocumentView.tsx:2138-2169
```
**Uwaga:** w DB **brak** kolumny „core/nieusuwalna" i „domyślnie-widoczna". „Domyślnie widoczne" jest
konceptem **wyłącznie frontowym** (`DEFAULT_VISIBLE_SECTIONS`) albo szablonowym (`template.visible_sections`).
`is_active` to inny wymiar (czy typ sekcji w ogóle dostępny w bibliotece), nie „widoczna na tej inicjatywie".

---

## 2. Różnice STRUKTURALNE — co jeden umie, a drugi nie

### Tylko System A (`cardSets`) — czego B nie ma
1. **„Karta nieusuwalna" (core) egzekwowana** — hook + UI (`useCardLayout.ts:190`, `NModeCardManager.tsx:364`).
   Initiative nie ma pojęcia karty, której użytkownik nie może wyrzucić.
2. **Nazwane warianty zestawów przełączane na żywo** (`minimal`/`full`/`deep`) jednym klikiem
   (`NModeCardManager.tsx:286-305`). B ma warianty tylko jako szablony DB (cięższe, per-org).
3. **Wspólny stos UI+hook** reużywalny między artefaktami (`useCardLayout` + `NModeCardManager`) —
   1 komponent zarządza kartami 3 różnych artefaktów.
4. **Jeden prymityw dla wielu typów** — 4 typy w jednym pliku/rejestrze (`DEFAULT_CARD_SETS` `cardSets.ts:580`).

### Tylko System B (Initiative) — czego A nie ma
1. **Katalog w bazie** (`initiative_section_types`) — edytowalny **bez deployu kodu**, źródło serwerowe.
2. **Wielotenant** — `organization_id` (`529_...sql:15`): organizacja może dodać własne typy sekcji.
   A jest statyczny, identyczny dla wszystkich.
3. **Dwie kolumny** (left/right, `column_position` `529_...sql:26`). A ma jedną płaską listę.
4. **System szablonów** (`initiative_templates` z `visible_sections`+`section_order`+`section_config`
   `529_...sql:184-187`) — bogatsze niż statyczne `sets`, per-org, DB.
5. **Prompty AI per karta** (`ai_prompt_template` `529_...sql:38`) + `render_config`/`default_config`.
6. **Opisy kart** (`description`/`description_pl` `529_...sql:21-22`) w katalogu — A ma tylko etykietę.
7. **Persystencja serwerowa/współdzielona** (szablony) — A trzyma układ tylko w localStorage klienta.

### Wspólne (oba mają)
Przełącznik widoczności, kolejność, etykiety dwujęzyczne, ikona-po-stringu, **częściowo wspólny słownik
camelCase dla initiative** (patrz rozjazd niżej).

---

## 3. Dowód rozjazdu (dlaczego „bez uzgodnienia rozjeżdża się z definicji")

### 3a. `INITIATIVE_SPEC` = martwe dane
- `cardSets.ts:228-411` definiuje pełny `INITIATIVE_SPEC` (katalog 25 kart + 3 zestawy).
- **Zero konsumentów**: `useCardLayout` wołany tylko z `'insight'`/`'task'`/`'decision'`
  (`InsightViewer.tsx:1053`, `TaskDetailView.tsx:3939`, `DecisionDetailView.tsx:1338`).
  `useCardLayout` w `InitiativeDocumentView.tsx` = **0 wystąpień** (grep potwierdzony).
- `InitiativeDocumentView` używa `SECTION_REGISTRY`/`DEFAULT_VISIBLE_SECTIONS` z `registry.ts`, nie `cardSets`.
- Zgodne z audytem: `_AUDYT_ARCHITEKTURY_ARTEFAKTOW_2026-07-22.md:148-149`.
- (Wystąpienia `artifactType="initiative"` w `InitiativeDocumentView.tsx:9755` itd. to inne komponenty —
  `AIConsultantPanel`/`EvidencePanel`/preview — **nie** `useCardLayout`.)

### 3b. Trójstronny rozjazd słownika kart Initiative
| Źródło | Liczba kart | Plik |
|---|---|---|
| `cardSets.ts` `INITIATIVE_SPEC` | **25** | `cardSets.ts:228-342` |
| `registry.ts` `SECTION_REGISTRY` | **29** | `registry.ts:50-83` |
| Seed bazy `529` | **24** | `529_...sql:106-178` |

- **W registry, brak w seedzie bazy (5):** `competencyRequirements`, `initiativeTeam`, `linkedItems`,
  `raciEscalation`, `skillsGap`.
- **W cardSets-initiative, brak w seedzie bazy (2):** `competencyRequirements`, `skillsGap` —
  **nie zaseedowane w ŻADNEJ migracji** pod `server/migrations/` (grep pusty). Renderują się tylko ścieżką
  fallback (`Object.keys(DEFAULT_VISIBLE_SECTIONS)` `InitiativeDocumentView.tsx:2138`); na realnej bazie z
  `sectionTypes.length>0` **nie pojawią się** jako zarządzalny typ sekcji.
- **W registry, brak w cardSets-initiative (4):** `initiativeTeam`, `linkedItems`, `raciEscalation`, `watchers`.

To jest dokładnie mechanizm z tezy audytu: dwa (a realnie trzy) źródła prawdy o kartach Initiative,
bez wspólnej bramki, rozjeżdżają się „z definicji".

### 3c. Dokumenty-widma cytowane przez kod
- `cardSets.ts:26` i `useCardLayout.ts:26` odsyłają do `_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md §3.5` —
  **plik nie istnieje** (`find` pusty). Potwierdza audyt `:150`.
- Rodzeństwo `docs/ui-standards/01-shell-layout/n-mode-card-standard.md` §7 ma **inne id kart** niż
  `cardSets.ts` (audyt `:88`, `:124`) — trzecie, rozjechane „źródło".

---

## 4. REKOMENDACJA (podstawa, NIE decyzja)

### Kluczowe rozpoznanie
Systemy **nie są symetryczne**. A = *stos UI+hook+(słaby, statyczny) model danych*. B = *bogaty model danych
bez wspólnego UI*. Naiwne „wybierz jeden, skasuj drugi" oznacza:
- **A kanonem → Initiative schodzi do `cardSets`:** tanie w UI, ale **downgrade produktu** — tracisz katalog
  w bazie, wielotenant/org-custom, szablony, prompty AI, dwie kolumny. Zmuszasz **najbogatszy** artefakt
  (Initiative, żywy, ze szablonami w DB) do **najuboższego** modelu. **Wysokie ryzyko regresji.** Skończy się
  i tak dorabianiem do `cardSets` kolumn/AI/szablonów — czyli odtworzeniem B.
- **B kanonem, wszystko do DB:** kanon z realnymi zdolnościami, ale **przesada** dla 3 prostych artefaktów
  (Insight/Task/Decision nie potrzebują tabel + migracji + endpointów); tracisz gotowy wspólny UI + core.

### Rekomendowana ścieżka — ONE CONTRACT (dane B + interfejs A)
**Nadzbiór schematu = System B (dane), warstwa render/zarządzanie = System A (hook + UI + core).**
Innymi słowy: jeden **KONTRAKT karty** (kształt), którego dane pochodzą per-artefakt (DB dla Initiative i
org-customizowalnych; statyczny TS dla 3 prostych), a **wszystkie** artefakty renderowane i zarządzane przez
`useCardLayout` + `NModeCardManager`.

To zamienia „który system kanonem" (spór, który gubi zdolności) na dwie łatwiejsze, addytywne decyzje:
1. **Kontrakt = nadzbiór pól B** (id/key, label dwujęzyczny, description, icon, group/category, column, order,
   flaga `core`, `default-visible`, org-scope, hook AI). Rozszerzenie `CardCatalogEntry` (`cardSets.ts:34-49`)
   o brakujące pola B — **addytywne, niełamiące**.
2. **Interfejs = A** — Initiative adoptuje `useCardLayout`+`NModeCardManager`+`core`; dane bierze z DB.

### Ścieżka zejścia do jednego (etapowa, niskie ryzyko)
1. Rozszerz `CardCatalogEntry` do nadzbioru (dodaj `description`, `columnPosition`, `category`, `aiPromptKey`,
   świadomość org) — addytywnie, nic nie łamie.
2. Adapter `initiative_section_types` (wiersze DB) → `CardCatalogEntry`-nadzbiór + `sets` (default =
   `DEFAULT_VISIBLE`, warianty = szablony). **Skasuj ręczny `INITIATIVE_SPEC`** (zastąp wyjściem adaptera / cienkim fallbackiem).
3. Wepnij `InitiativeDocumentView` w `useCardLayout({artifactType:'initiative', catalog: adapted})` —
   **za flagą OFF** (reguła CLAUDE.md §7: Piotr nie jest pierwszym testerem wizualnym). Szablony DB zostają źródłem zestawów.
4. Wprowadź `core` na Initiative (`overview`+`control` nieusuwalne — zgodnie z już zadeklarowanym `cardSets.ts:235,306`).
5. Gdy Initiative jedzie na wspólnym hooku — 3 proste artefakty już jadą → **jeden stos zarządzania**.
   Statyczne specy `cardSets` zostają tylko dla artefaktów bez potrzeby DB/org-custom.
6. Napraw widma: referencje `cardSets.ts:26`/`useCardLayout.ts:26`; pogódź id z `n-mode-card-standard.md §7`.

### Koszt / ryzyko (skrót)
| Wariant | Nakład | Ryzyko regresji | Werdykt |
|---|---|---|---|
| A kanonem (Initiative→statyczny cardSets) | niski | **wysoki** (utrata DB/org/AI/kolumn/szablonów) | odradzam |
| B kanonem czysty (wszystko→DB) | wysoki | średni | przesada dla prostych 3 |
| **Hybryda: kontrakt=nadzbiór B + UI=A** | średni | **niski** (addytywne, za flagą, dane Initiative nietknięte) | **rekomendacja** |

Hybryda to jedyny wariant, który **nie wyrzuca** realnej siły żadnego z systemów.

---

## 5. Co jest DECYZJĄ Piotra → wejście do `_KONTRAKT_KARTY_SSOT`

Nie rozstrzygam (to progi/decyzje produktowe). Do kontraktu:
1. **P-1 formalnie:** jeden system czy dwa (rekomendacja: jeden **kontrakt**, dane per-artefakt).
2. Czy 3 proste artefakty (Insight/Task/Decision) też dostają **katalog w bazie**, czy zostają statyczne.
3. **Które karty domyślnie widoczne / core per typ artefaktu** (progi) — dziś rozjechane w 3 źródłach.
4. Czy **customizacja org-level** obejmuje Insight/Task/Decision, czy tylko Initiative.
5. **Persystencja:** ujednolicić do serwera (DB) czy zostawić localStorage dla lekkiej warstwy.
6. Los `competencyRequirements`/`skillsGap` (w kodzie, brak w bazie) i `initiativeTeam`/`raciEscalation`/
   `linkedItems`/`watchers` (w registry, brak w cardSets) — które wchodzą do kanonicznego słownika.

---

## Aneks — pełny indeks dowodów (plik:linia)

**System A:**
`cardSets.ts` — typy 32-65; INSIGHT 71-223; INITIATIVE(martwy) 228-411; DECISION 416-489; TASK 494-576;
rejestr 580-590; core-flag 48; komentarz-widmo 26.
`useCardLayout.ts` — API 101-133; core-guard 190; buildDefault 70-87; applyDefaultSet 254-271; komentarz-widmo 26.
`NModeCardManager.tsx` — AddCardMenu 144; SectionsManagerMenu 242; przełącznik zestawów 286-305; ukrycie „X" dla core 364.
Konsumenci: `InsightViewer.tsx:1052,1019,1044`; `TaskDetailView.tsx:3938,3927`; `DecisionDetailView.tsx:1337,1304`.

**System B:**
`registry.ts` — SECTION_REGISTRY 50-83; getSectionComponent 88-92; DEFAULT_SECTION_ORDER 98-132; DEFAULT_VISIBLE_SECTIONS 138-170.
`529_initiative_section_types.sql` — tabela 13-55; brak is_core (cała); seed 24 typów 106-178; rozszerzenie szablonów 184-187.
`InitiativeDocumentView.tsx` — visibleSections 2115-2124; sectionOrder 2126-2130; resolvedTypes/fallback 2133-2169;
filtr widoczności 2171-2174; split kolumn 2176-2188; reorder→localStorage 2100-2109.

**Audyt źródłowy:** `_AUDYT_ARCHITEKTURY_ARTEFAKTOW_2026-07-22.md` — teza dwóch systemów 31/44/79-80/148-149;
P-1 100; widmo dok. 150; rozjazd §7 88/124.
