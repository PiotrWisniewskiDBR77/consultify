# Presentation Generator v3 — SSOT (Complete Flow Specification)

> **Status:** Canonical (v3)
> **Priorytet:** P0 — 50% user satisfaction depends on this module
> **Cel:** Kompletna specyfikacja generatora prezentacji: flow, model danych, template system, Brand Kit, media library, AI agent, edycja, eksport, uczenie się z organizacji.
> **Inspiracja:** Gamma.app UX + kontekst organizacji + platform artifacts
>
> **Powiązane SSOT:**
> - `docs/product/OPERATING_MODEL_V3.md` — Reports & Presentations jako gałąź flow
> - `docs/product/PRESENTATIONS_AND_REPORTS_V3.md` — ogólne zasady Reports + Presentations (library + generator)
> - `docs/product/LINK_GRAPH_V3.md` — embedded references, backlinks
> - `docs/product/SOURCE_TRACEABILITY_SPEC.md` — traceability outputów
> - `docs/ui-standards/UI_UX_CANON_V3.md` — kanoniczne UI/UX
> - `docs/REPORT_BUILDER_EXPORTS_STANDARD.md` — export quality baseline

---

## 0) MVP (na tydzień) vs Target v3 (SSOT)

Ten dokument opisuje **Target v3** (to‑be), ale dla go‑live musi istnieć jasne rozróżnienie: co jest **as‑is** w kodzie dziś, a co jest **docelowym standardem v3**.

### 0.1 MVP (as‑is) — co realnie działa w kodzie teraz

**Frontend:**
- Wizard: `src/components/Presentations/PresentationWizard.tsx`
  - kroki: Sources → Setup → Outline → Generate → Download PPTX
  - setup parametry: `audience`, `goal`, `language (pl/en)`, `theme (corporate/minimal/modern)`, `confidentiality`
- Template gallery: `src/components/Presentations/DeckTemplateGallery.tsx`

**Backend + DB:**
- Service: `server/src/services/presentationGeneratorService.ts`
- DB schema + seedy: `server/migrations/568_presentations_brand_kits_templates.sql`
  - `brand_kits`, `presentation_templates`, `presentation_decks`
  - seeded 5 system template’ów

**Pipeline (as‑is):**
sourceArtifacts → outline → `UnifiedReportJSON` → PPTX (`PptxPipelineService`)

### 0.2 Target v3 (to‑be) — co jest kanonicznym standardem

Wszystkie elementy poniżej są **Target v3**:
- `presentation_mode` (SHOW/DOCUMENT/BRIEFING/WORKSHOP) + reguły gęstości i layoutów
- `communication_register` (Executive/Professional/Technical/Narrative)
- `image_style_preset` + Organization Media Library routing
- Curated Color Sets + Theme Engine (Brand Kit first)
- Deck Builder (Gamma-like) + block-level editing
- Smart diagram library + layout template library (50–80 layoutów)
- No realtime collaboration (explicit) + Undo 3 kroki

### 0.3 Zasada bezpieczeństwa SSOT

Jeśli jakaś część Target v3 nie jest jeszcze zaimplementowana, UI nie może jej obiecywać bez oznaczenia “Coming soon” albo bez trzymania się MVP zakresu.

## 1) Wizja produktu

### 1.1 Dlaczego to jest kluczowe

Świat biznesu wciąż opiera się na prezentacjach. Consultinity zbiera ogromny kontekst organizacji: Initiatives, Financial Analysis, Tool Sessions, Notes, Insights, Workspaces. Jeśli potrafimy **automatycznie** zamienić ten kontekst w profesjonalną, piękną prezentację — dajemy użytkownikom supermoc.

### 1.2 Czym nasz generator RÓŻNI się od Gamma

| Aspekt | Gamma | Consultinity |
|---|---|---|
| Źródło treści | Paste text / upload file / URL | **Platform artifacts** (Initiatives, Notes, Reports, Financial Analysis, Tool Sessions, Insights, Workspaces) |
| Kontekst | Brak — user musi sam dostarczyć | **Pełny kontekst organizacji** — AI zna projekt, dane, historię |
| Obrazy | Stock / AI / Web / GIFs | **Organization Media Library** (priorytet) + AI + Stock |
| Branding | Ręczny theme | **Auto-applied Brand Kit** per organization |
| Wywoływanie | Z dashboardu Gamma | **Z kontekstu artefaktu** (Initiative, Note, Report...) + z Hub |
| Dane | Tabele statyczne | **Semi-live data** z refreshem z Financial Analysis, KPIs z Initiatives |
| Traceability | Brak | **Każdy slajd i blok ma source_artifact_id** |
| Agent | Ogólny asystent | **Kontekstowy agent** znający source artifacts i projekt |
| Uczenie się | Brak | **Organization Style Profile** — uczy się z decków, uploadów i Brand Kit |
| Online view | Statyczne karty | **Animowane karty** (charts animate, KPI count-up, subtle parallax) |

### 1.3 Zasada nadrzędna

**"Kliknij, zatwierdź, wow."** — Użytkownik widzi piękną prezentację w 60 sekund. Potem ma czas na dopracowanie. Nie odwrotnie.

---

## 2) Architektura danych

### 2.1 Core objects

#### DeckTheme (branding layer)

```
DeckTheme {
  theme_id: UUID
  name: string
  scope: "application" | "organization"
  organization_id: UUID?              // null for application themes
  colors: {
    primary: string                   // hex
    secondary: string
    accent: string
    background: string
    surface: string                   // card background
    text_primary: string
    text_secondary: string
    heading: string
  }
  fonts: {
    heading_family: string            // e.g. "Inter"
    body_family: string               // e.g. "Inter"
    heading_weight: number            // e.g. 700
    body_weight: number               // e.g. 400
    heading_size_scale: "S" | "M" | "L"
  }
  logo_url: string?
  card_backdrop_style: "none" | "gradient" | "pattern" | "image"
  card_backdrop_value: string?        // gradient CSS / pattern URL / image URL
  default_card_size: "16:9" | "4:3" | "fluid"
  style_tags: string[]                // ["dark", "professional", "colorful"]
  is_default: boolean
  created_by: UUID
  created_at: timestamp
  updated_at: timestamp
}
```

#### BrandKit (organization branding source)

```
BrandKit {
  brand_kit_id: UUID
  organization_id: UUID
  name: string
  primary_color: string
  secondary_color: string
  accent_color: string
  logo_urls: {
    light_bg: string?                 // logo for light backgrounds
    dark_bg: string?                  // logo for dark backgrounds
    icon: string?                     // square icon variant
  }
  fonts: {
    primary_family: string
    secondary_family: string
  }
  approved_style_rules: string[]      // e.g. ["dark backgrounds preferred", "minimal images"]
  created_at: timestamp
  updated_at: timestamp
}
```

#### OrganizationMediaLibrary

```
MediaAsset {
  asset_id: UUID
  organization_id: UUID
  file_url: string
  thumbnail_url: string
  filename: string
  tags: string[]                      // ["product", "team", "office", "logo", "chart", "icon"]
  category: "photo" | "illustration" | "icon" | "pattern" | "background"
  dimensions: { width: number, height: number }
  file_size: number
  mime_type: string
  uploaded_by: UUID
  uploaded_at: timestamp
}
```

#### DeckTemplate (structure layer)

```
DeckTemplate {
  template_id: UUID
  name: string
  description: string
  scope: "application" | "organization" | "personal"
  organization_id: UUID?
  theme_id: UUID?                     // default theme for this template
  presentation_mode: "show" | "document" | "briefing" | "workshop"
  communication_register: "executive" | "professional" | "technical" | "narrative"
  image_style_preset: "corporate_photography" | "abstract_geometric" | "flat_illustration" | "data_focused" | "industry_realistic" | "minimal_no_images"
  color_set_id: string?               // references curated set (if not using Brand Kit theme)
  outline_json: DeckCardOutline[]     // list of card intents with sample content
  deck_type: string                   // "executive_update" | "project_kickoff" | "initiative_review" | "financial_review" | "assessment_results" | "custom"
  audience: string?                   // e.g. "Board members"
  goal: string?                       // e.g. "Quarterly strategic review"
  must_have_intents: CardIntent[]     // intents that must appear
  recommended_slide_count: { min: number, max: number }
  sample_content: boolean             // whether template has example content
  auto_apply_rules: {
    source_types: string[]?           // e.g. ["initiative", "financial_analysis"]
    roles: string[]?                  // e.g. ["executive", "manager"]
    goals: string[]?                  // e.g. ["quarterly_review", "board_meeting"]
  }
  status: "active" | "archived" | "draft"
  created_by: UUID
  created_at: timestamp
  updated_at: timestamp
}
```

```
DeckCardOutline {
  order_index: number
  intent: CardIntent
  title: string                       // suggested title
  content_hint: string                // 2-3 sentence description of expected content
  layout_hint: string?                // suggested layout type
  suggested_blocks: string[]          // e.g. ["heading", "4-box-summary", "chart"]
}
```

#### Deck (generated presentation — living artifact)

```
Deck {
  deck_id: UUID
  organization_id: UUID
  title: string
  description: string?
  template_id: UUID?                  // null if generated without template
  theme_id: UUID
  presentation_mode: "show" | "document" | "briefing" | "workshop"
  communication_register: "executive" | "professional" | "technical" | "narrative"
  image_style_preset: "corporate_photography" | "abstract_geometric" | "flat_illustration" | "data_focused" | "industry_realistic" | "minimal_no_images"
  color_set_id: string?               // selected curated palette (ignored if Brand Kit theme used)
  status: "draft" | "generated" | "editing" | "ready" | "shared" | "archived"
  card_size: "16:9" | "4:3" | "fluid" | "custom"
  cards: DeckCard[]
  source_refs: SourceRef[]            // all artifacts this deck was built from
  context_pack_snapshot: JSON         // frozen ContextPack at generation time
  generation_settings: {
    text_mode: "generate" | "condense" | "preserve"
    content_depth: "minimal" | "concise" | "detailed" | "extensive"
    audience: string
    tone: string
    language: string
    image_source: "smart" | "org_library" | "ai_only" | "none" | "manual"
    additional_instructions: string?
  }
  animations_enabled: boolean
  collaboration_realtime: false       // v3 explicitly NO realtime collaborative editing
  undo_steps_supported: 3             // v3: 3 steps undo (per user session)
  share_settings: {
    is_shared: boolean
    share_url: string?
    permissions: "view" | "comment" | "edit"
  }
  export_history: ExportRecord[]
  speaker_notes_generated: boolean
  last_data_refresh: timestamp?
  created_by: UUID
  created_at: timestamp
  updated_at: timestamp
}
```

#### DeckCard (slide)

```
DeckCard {
  card_id: UUID
  deck_id: UUID
  order_index: number
  intent: CardIntent
  layout_id: string                   // references a LayoutTemplate
  title: string
  blocks: CardBlock[]
  source_refs: SourceRef[]            // which artifacts contributed to this card
  speaker_notes: string?
  has_refreshable_data: boolean
  last_data_refresh: timestamp?
  background: {
    type: "theme" | "color" | "gradient" | "image"
    value: string?
  }
  animations: {
    entrance: "fade" | "slide_up" | "none"
    block_stagger: boolean            // blocks appear one by one in present mode
  }
  is_locked: boolean                  // prevent AI from modifying
}
```

```
enum CardIntent {
  cover
  executive_summary
  summary
  section_divider
  content
  data
  comparison
  timeline
  process
  quote
  kpi_dashboard
  risk_overview
  recommendation
  next_steps
  thank_you
}
```

#### CardBlock (element within a card)

```
CardBlock {
  block_id: UUID
  card_id: UUID
  type: BlockType
  content: JSON                       // type-specific content
  source_ref: SourceRef?              // traceability to specific artifact/field
  is_refreshable: boolean             // can be updated from source
  position: {
    area: "full" | "left" | "right" | "top" | "bottom" | "overlay"
    order: number                     // within area
  }
  style_overrides: JSON?              // per-block color/font overrides
  ai_editable: boolean                // default true
}
```

```
enum BlockType {
  heading
  paragraph
  bullet_list
  numbered_list
  table
  chart
  image
  icon_row
  kpi_widget
  smart_layout                        // columns, boxes, cards
  smart_diagram                       // funnel, venn, matrix, etc.
  callout
  quote_block
  timeline_block
  metric_strip                        // row of 3-5 key numbers
  artifact_embed                      // embedded Initiative card, Task, etc.
  divider
}
```

### 2.2 ContextPack (AI input)

Niezależnie od źródła, system buduje ustandaryzowany pakiet danych dla AI:

```
ContextPack {
  sources: SourceRef[]
  organization: {
    name: string
    industry: string?
    size: string?
    brand_kit_id: UUID?
  }
  text_content: {
    source_id: UUID
    source_type: string
    headings: string[]
    body_segments: { heading: string, text: string }[]
    key_points: string[]              // AI-extracted bullet points
  }[]
  data_points: {
    source_id: UUID
    label: string
    value: number | string
    unit: string?
    trend: "up" | "down" | "stable"?
    period: string?
  }[]
  charts_available: {
    source_id: UUID
    chart_type: string
    title: string
    data: JSON                        // chart data payload
  }[]
  images_available: {
    asset_id: UUID
    url: string
    tags: string[]
    relevance_score: number           // AI-computed relevance to context
  }[]
  relationships: {
    from_id: UUID
    to_id: UUID
    relation_type: string
  }[]
  metadata: {
    language: string
    audience: string
    tone: string
    purpose: string
  }
}
```

### 2.3 SourceRef (traceability)

```
SourceRef {
  artifact_id: UUID
  artifact_type: "initiative" | "note" | "report" | "financial_analysis" | "tool_session" | "insight" | "workspace" | "task" | "assessment"
  artifact_name: string
  field_path: string?                 // e.g. "kpis.revenue_growth" — for block-level traceability
  snapshot_at: timestamp              // when data was captured
}
```

---

## 3) Entry Points (skąd użytkownik startuje)

### 3.1 Z modułu Presentations (Full Wizard)

```
Reports > Presentations > [Lista prezentacji]
                           [+ New Presentation] ← BUTTON
```

Przycisk otwiera **Full Wizard** (Krok 1–5).

### 3.2 Z artefaktu / narzędzia (Short Wizard)

Każdy artefakt platformy ma akcję "Create Presentation":

| Lokalizacja | Akcja | Pre-loaded context |
|---|---|---|
| Initiative detail view | Menu "..." → Create Presentation | Initiative data (status, KPIs, risks, timeline, financial impact) |
| Notebook / Note | "Create from note" → Presentation | Note full text, headings, tags, embedded refs |
| Financial Analysis session | "Create Presentation" | Model data, ratios, charts, commentary, scenarios |
| Tool Session | "Create Presentation" | Assessment scores, insights, recommendations |
| MindMap / Workspace | "Create Presentation" | Nodes hierarchy, labels, cross-links |
| Report | "Create Presentation from Report" | Report sections, findings, conclusions, tables |
| Insight (single) | "Create Presentation" | Insight title, body, source, priority |

System **automatycznie buduje ContextPack** z danego artefaktu → startuje **Short Wizard** (pomija Krok 1, bo źródło jest już znane).

### 3.3 Pattern

Zawsze ten sam Wizard, ta sama jakość. Różnica = ile user musi podać sam:
- **Full**: user sam wybiera źródła
- **Short**: źródło pre-selected, user może dodać więcej

---

### 3.4 Presentation Concept (MUST): cel + forma = **Presentation Mode**

Ten generator nie ma jednego “trybu”. Prezentacje różnią się celem, gęstością treści, layoutami i zasadami obrazów. Dlatego **zawsze** na etapie konceptu (Wizard) wybieramy **Presentation Mode**.

```
enum PresentationMode {
  show        // narracyjna prezentacja do pokazywania (storytelling)
  document    // deliverable konsultingowy, samodzielny materiał (audyt/raport w slajdach)
  briefing    // szybki executive update / status
  workshop    // materiał warsztatowy (frameworky do pracy)
}
```

**Kanoniczna matryca parametrów (v3):**

| Parametr | SHOW (narracja) | DOCUMENT (deliverable) | BRIEFING (update) | WORKSHOP (warsztat) |
|---|---:|---:|---:|---:|
| **Cel** | “wow + story” | “solidny materiał” | “co się zmieniło” | “pracujemy razem” |
| **Slajd jako** | tło dla mówcy | strona raportu | status karta | framework |
| **Słowa / slajd** | 15–25 | 50–120 | 30–50 | 10–30 |
| **Headline** | emocja + teza | teza + wniosek | delta + status | pytanie / instrukcja |
| **Obrazy** | częste, duże | rzadko, tylko wspierające | minimal (ikony/KPI) | schematy/framework |
| **Charty** | 1 duży, prosty | analityczne + komentarz | trend/KPI | opcjonalnie |
| **Animacje online** | YES (mocniej) | NO | YES (lekko) | NO |
| **Speaker notes** | gęste | minimalne | opcjonalne | instrukcje facylitatora |
| **Typowy rozmiar** | 8–15 | 15–40 | 5–10 | 10–20 |

**Konsekwencja:** wybór `presentation_mode` filtruje:
- dostępne layouty (Layout Template Library),
- zasady Smart Image Routing,
- zasady generowania treści (prompty),
- walidacje outline (min/max slajdów, gęstość),
- domyślne ustawienia animacji (online).

### 3.5 Język + styl komunikacji (MUST): **Language** + **Communication Register**

W v3 “język” to dwie niezależne decyzje:

- **Language**: PL/EN/... (w jakim języku piszemy).
- **Communication Register**: jakim rejestrem biznesowym piszemy (Executive vs Technical itd.).

```
enum CommunicationRegister {
  executive      // zarządowy, decyzyjny, bardzo zwięzły (“so what”)
  professional   // kanoniczny default (biznesowy, neutralny)
  technical      // bardziej analityczny, więcej precyzji i skrótów
  narrative      // storytelling (najlepszy dla SHOW)
}
```

**Kanon:** register wpływa na długość zdań, słownictwo, strukturę bullet points oraz to, czy treść idzie w slajd czy w speaker notes (SHOW).

### 3.6 Obrazy: **Image Style Presets** (MUST)

Biznes nie pisze promptów. Użytkownik wybiera z gotowych stylów, a system (Smart Image Routing) generuje/dobiera obrazy zgodnie z tym stylem.

```
enum ImageStylePreset {
  corporate_photography     // people/office/product, profesjonalne zdjęcia
  abstract_geometric        // gradienty, kształty, patterny (bezpieczne enterprise)
  flat_illustration         // wektorowe ilustracje (nowoczesne SaaS)
  data_focused              // brak dekoracyjnych obrazów, preferuj charty/diagramy
  industry_realistic        // branżowe, realistyczne (fabryka/logistyka/IT/retail)
  minimal_no_images         // typografia + kolor + diagramy, bez zdjęć
}
```

### 3.7 Kolorystyka: **Curated Color Sets** + Brand Kit (MUST)

Większość użytkowników nie dobierze palety. Dlatego w v3 kolorystyka jest zawsze dobierana “w zestawach”:

- **Brand Kit first**: jeśli organizacja ma Brand Kit → system generuje `DeckTheme` (auto) i pokazuje go jako domyślny.
- Jeśli nie ma Brand Kit → user wybiera z **Curated Color Sets** (thumbnail gallery).

**Curated Color Sets (baseline v3, 12 zestawów):**
- `Ocean` (navy + teal)
- `Slate` (cool gray + cobalt)
- `Forest` (deep green + gold)
- `Ember` (charcoal + orange)
- `Midnight` (black + violet)
- `Arctic` (white/ice + steel)
- `Sand` (warm beige + brown)
- `Indigo` (indigo + mint)
- `Graphite` (graphite + blue)
- `Olive` (olive + cream)
- `Burgundy` (burgundy + graphite)
- `Teal` (teal + slate)

**Kanon:** zestaw zawiera komplet: background/surface/text + chart palette (5–8 kolorów) + stany (success/warn/danger) dopasowane do kontrastu.

### 3.8 Visual Engine (non‑negotiable): AI nie “projektuje”, AI **wybiera**

Jakość “business-grade” pochodzi z kuracji, nie z losowości.

- **Layout Template Library (MUST)**: 50–80 ręcznie zaprojektowanych layoutów slajdów (per intent + per mode).
- **Layout Selection Engine (MUST)**: deterministyczny dobór layoutu na podstawie intentu, listy bloków, gęstości treści i reguły “visual variety” (unikanie 3 takich samych układów pod rząd).
- **Theme Engine (MUST)**: Brand Kit → `DeckTheme` + fallback do Curated Color Sets; spójny typography scale, spacing, chart colors, kontrast.

**Kanon:** LLM generuje **structured content** (bloki + dane), a nie CSS/układ. Układ jest wynikiem wyboru layoutu z biblioteki.

## 4) Wizard Flow — kompletna specyfikacja

### 4.0 Pre-processing (w tle)

Zanim user zobaczy Wizard, system w tle:
1. Buduje `ContextPack` z wybranych/pre-selected źródeł
2. Pre-matchuje images z Organization Media Library (tag-based relevance)
3. Ładuje Organization Brand Kit (jeśli istnieje)
4. Sprawdza auto-apply rules na templateach (szuka best-match template)

### 4.1 Krok 1: ŹRÓDŁO I CEL (tylko w Full Wizard)

**Cel:** Zdefiniować "o czym" i "z czego" prezentacja.

**Elementy ekranu:**
- **Pole "What is this presentation about?"** — textarea na opis celu (opcjonalny, ale pomaga AI)
- **Artifact picker** — multi-select z kategoryzacją:
  - Initiatives (lista z search)
  - Notes (lista z search)
  - Reports (lista z search)
  - Financial Analysis sessions (lista z search)
  - Tool Sessions (lista z search)
  - Workspaces (lista z search)
  - Insights (lista z search)
- **Selected sources** — chips z wybranych artefaktów (removable)
- **"Continue"** — aktywny gdy: min. 1 źródło wybrane LUB opis celu wpisany

**UX guidelines:**
- Kategorie artefaktów jako duże, klikalne karty z ikoną i liczbą dostępnych
- Po kliknięciu karty → rozwija się lista z checkbox'ami i searchem
- Chip selected source → klik otwiera mini-preview (nazwa, status, last update)

### 4.2 Krok 2: USTAWIENIA + TEMPLATE

**Cel:** Ustalić jak prezentacja ma wyglądać i czy użyć szablonu.

**Layout:** Dwie kolumny — Settings (left) + Live Preview (right).

**Sekcja (MUST): Presentation Mode**

- Wybór: `SHOW` / `DOCUMENT` / `BRIEFING` / `WORKSHOP` (z krótkim opisem pod spodem).
- Jeśli user startuje z template → `presentation_mode` dziedziczy się z template (user może zmienić, ale dostaje warning: “Changing mode may re-map layouts”).
- Jeśli user startuje bez template → default: `BRIEFING` (dla zwięzłości) lub last used w organizacji.

**Sekcja: Ścieżka tworzenia**
- **From template** (radio) → otwiera Template Gallery
- **AI generates** (radio, default) → AI sam proponuje strukturę

**Template Gallery (jeśli "From template"):**
- Modal/inline z siatką kart szablonów
- Dwa scope: System templates / Organization templates
- Filtry: by deck_type, audience, goal
- Każdy template: thumbnail okładki + nazwa + opis + "Use this template"
- Preview modal (scroll through sample cards + "Preview with other themes")
- Jeśli auto-apply rule match → banner "Recommended for your context: [Template Name]"

**Sekcja: Podstawowe ustawienia**
- **Title** — auto-generated suggestion, edytowalny
- **Audience** — text field ("Board members", "Project team", "Client")
- **Communication register** — dropdown (**Executive / Professional / Technical / Narrative**)
- **Tone** — dropdown (sub-tone): Executive / Professional / Technical / Casual (opcjonalny, można ukryć w Advanced)
- **Language** — dropdown (default: org language)
- **Content depth** — 4 opcje wizualne: Minimal / Concise / Detailed / Extensive

**Sekcja: Visuals (rozwijana)**
- **Theme** — thumbnail picker:
  - Default: Organization Brand Kit (auto-applied jeśli istnieje, z badge "Your Brand Kit")
  - "Change theme" → galeria z Custom (org) / Standard (system) / filtry Dark / Light / Professional / Colorful
  - Live preview po prawej stronie aktualizuje się przy zmianie
- **Color set (Curated palettes)** — jeśli brak Brand Kit lub user wybiera “override palette”:
  - thumbnail gallery 12+ nazwanych palet (`Ocean`, `Slate`, `Forest`…)
  - zawsze dobierane “w zestawach” (background/surface/text/chart colors)
- **Image style preset** — dropdown:
  - Corporate photography / Abstract geometric / Flat illustration / Data-focused / Industry realistic / Minimal (no images)
- **Image source** — dropdown:
  - **Smart** (default) — system sam decyduje per slajd
  - Organization Library only
  - AI images only
  - No images
  - Manual only
- **Card size** — 16:9 (default) / 4:3 / Fluid

**Sekcja: Advanced (domyślnie hidden, "Show advanced")**
- AI Image model — Auto-select / specific model
- Additional instructions for AI — textarea

**"Continue"** → przejście do Kroku 3.

### 4.3 Krok 3: OUTLINE + STRESZCZENIE

**Cel:** AI proponuje strukturę, user akceptuje lub modyfikuje.

**Skąd pochodzi outline:**
- Jeśli template wybrany → outline z template (z intents, titles, content_hints)
- Jeśli AI generates → AI buduje outline na podstawie ContextPack + metadata

**Elementy ekranu:**
- **Header:** "AI proposed N slides based on your sources. Drag to reorder. Click to edit."
- **Lista kart** (scrollable), każda karta zawiera:
  - Numer (z drag handle do reorder)
  - Intent badge (Cover / Executive Summary / Data / Content / Timeline / etc.) — klikalne dropdown do zmiany
  - Tytuł (edytowalny inline)
  - Streszczenie treści (2-3 zdania: co AI planuje na tym slajdzie) — edytowalny
  - Source references (chips: "From: Initiative 'DT'", "From: Financial Analysis 'Q2'")
  - Image hint (ikona: org photo / AI image / chart / none)
  - Context menu "...": Duplicate / Delete / Change intent / Move up / Move down
- **Między kartami:** "+ Add slide" (→ dropdown: Blank / AI suggests / From template card)
- **AI suggestions strip** (dół): "AI recommends adding: Risk Analysis slide, Budget Comparison slide" (klikalne)
- **Instructions for AI** — textarea (opcjonalne dodatkowe wytyczne)
- **"Generate Presentation"** button — rozpoczyna generację

**Outline validation (pre-generate):**
- Min. 2 karty (cover + content)
- Max. 30 kart (warning above 20: "Consider splitting into two presentations")
- Must have at least one cover intent
- Warning if no data intent but data_points available in ContextPack

### 4.4 Krok 4: GENERACJA (live preview — seamless transition to Builder)

**Cel:** AI generuje kartę po karcie, user widzi efekt w real-time.

**Layout:** Identyczny jak Deck Builder (Krok 5) — seamless transition.

**Mechanika generacji:**
1. System generuje karty sekwencyjnie (card 1, card 2, ...)
2. Per karta:
   a. AI buduje structured JSON (CardBlock[]) na podstawie ContextPack segment + outline content_hint
   b. Frontend renderuje w real-time (tekst typing effect, chart draws, image loads)
   c. Left panel thumbnail aktualizuje się (✓ = done, ⟳ = generating, empty = waiting)
3. User może kliknąć na gotową kartę i edytować NAWET GDY reszta się generuje
4. Top bar: progress "Generating (4/8)..."
5. Po zakończeniu: subtle notification "Generation complete ✓"

**Smart Image Routing (per karta, during generation):**

```
RULES (evaluated in order):

1. intent == "cover"
   → Search Organization Media Library for tags: ["logo", "brand", "cover"]
   → If found: use org logo + accent background from Brand Kit
   → If not found: generate gradient background from Brand Kit colors

2. intent == "data" | "kpi_dashboard"
   → Render charts from ContextPack.charts_available
   → NO decorative images (data speaks for itself)

3. intent == "thank_you" | "next_steps"
   → Search Organization Media Library for tags: ["team", "office", "people"]
   → If found: use org team photo
   → If not found: clean layout without image, logo in footer only

4. intent == "content" | "comparison" | "process" | "recommendation"
   → Check if Organization Media Library has relevant images (tag matching to card content keywords)
   → If relevance_score > 0.7: use org photo
   → If not: generate AI image matching card content + theme style
   → Style keywords from DeckTheme.style_tags

5. intent == "section_divider"
   → Accent background from theme
   → Optional: subtle AI-generated abstract pattern matching theme
   → NO photos on section dividers

6. intent == "timeline" | "process"
   → Smart diagram (timeline/process blocks) — NO photo
   → Styled with theme colors

FALLBACK: If image_source == "none" → skip all images, text-only layouts
```

### 4.5 Krok 5: Deck Builder (post-generacja)

Seamless transition z Kroku 4. User jest teraz w pełnym edytorze.

→ Opisany szczegółowo w Rozdziale 5.

---

## 5) Deck Builder — kompletna specyfikacja

### 5.1 Layout ekranu

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] > Presentations > [Deck Title]   Theme │ Share │ Agent │▶ Present │
├──────────┬─────────────────────────────────────┬───────────────────┤
│          │                                     │                   │
│ Left     │        Center Canvas                │   Right Toolbar   │
│ Panel    │                                     │   (vertical       │
│          │        [Active DeckCard              │    icon strip)    │
│ Slide    │         full WYSIWYG edit]           │                   │
│ Sorter   │                                     │   🔍 Search       │
│          │                                     │   Aa Basic blocks │
│ [thumb1] │                                     │   🖼 Images       │
│ [thumb2] │                                     │   ⊞ Smart layouts│
│ [thumb3] │                                     │   ◎ Diagrams     │
│ [▸thb4 ] │                                     │   📊 Charts/data │
│ [thumb5] │                                     │   🎬 Media       │
│ [thumb6] │                                     │   📎 Artifacts   │
│ [thumb7] │                                     │   ✏️ AI Edit     │
│ [thumb8] │                                     │                   │
│          │   [+ blank] [✨ AI] [⊞ template]    │                   │
│ [+New ▾] │                                     │                   │
├──────────┴─────────────────────────────────────┴───────────────────┤
│ Card 4 of 8 │ "Initiative Progress"     │ ✨ Quick edits │ Notes  │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 Left Panel: Slide Sorter

**Dwa widoki** (toggle w panelu):
- **Cards view**: thumbnails slajdów (wizualnie jak w Gamma)
- **List view**: ponumerowane tytuły slajdów (outline)

**Akcje:**
- Klik → nawigacja do karty w canvas
- Drag & drop → reorder
- Right-click → menu: Duplicate / Delete / Add before / Add after
- Badge na thumbnail jeśli dane nieaktualne: "⚠️" (data may be outdated)

**"+New" button** (dropdown):
- Add blank card
- Add card with AI (prompt: "What should this slide be about?")
- Add from template (picker z card layouts z active template)

### 5.3 Center Canvas: Card Editor

**Inline editing:**
- Klik na tekst → cursor, WYSIWYG editing (bold, italic, lists, headings)
- Klik na obraz → selection frame + floating menu:
  - Replace (from Org Library / AI Generate / Upload)
  - Regenerate (AI creates new image for this context)
  - Remove
  - Resize / Crop
- Klik na chart → selection frame + floating menu:
  - Edit data (opens chart data editor)
  - Change chart type (bar ↔ line ↔ pie etc.)
  - 🔄 Update from source (refresh data)
  - Resize
- Klik na smart layout/diagram → selection frame + floating menu:
  - Change layout type
  - Edit items
  - Regenerate with AI

**Card-level floating toolbar** (top of card, on hover):
- Layout picker (5 thumbnails: full / left-right / right-left / top-bottom / overlay)
- Background: color/gradient/image picker
- Full-bleed toggle
- Content alignment: top / center / bottom
- Card animations: on/off

**"Edit this card" popup** (bottom-left of card, on hover):
- Freeform prompt field: "How would you like to edit this card?"
- **Quick actions — Writing:**
  - Improve writing
  - Fix spelling & grammar
  - Translate
  - Make longer / Make shorter
  - Simplify language
  - Be more specific
- **Quick actions — Image:**
  - Make this more visual
  - Add an image
  - Add a chart
  - Swap to organization photo
  - Regenerate all images on this card
- **Quick actions — Data:**
  - 🔄 Update data from source
  - Change chart type
  - Add KPI widget
- **Quick actions — Layout:**
  - Try new layout (AI regenerates layout, keeps content)

**Between cards (gap actions):**
- 3 buttons: [+] Add blank / [✨] Add with AI / [⊞] Add from template

### 5.4 Right Toolbar: Block Inserter

Vertical icon strip. Klik na ikonę → otwiera panel z blokami do wstawienia.

#### 🔍 Search
- Full-text search w treści decka
- Wyniki: lista matchów z numerem karty + fragment tekstu
- Klik → nawigacja do karty

#### Aa Basic blocks
- **Text**: Title / Heading 1-4 / Blockquote / Label
- **Tables**: 2x2, 3x3, 4x4 (styled with theme)
- **Lists**: Bulleted / Numbered / Todo / Checklist
- **Callouts**: Note / Info / Warning / Caution / Success / Question

#### 🖼 Images
- **Organization Library** (priorytet — pierwsza tab)
  - Grid of org images z tagami
  - Search by tag
  - Upload new (jeśli admin)
- **AI Generate**
  - Prompt field + style selector
  - Model auto-select (lub manual)
  - Keywords: professional, minimalist, corporate, etc.
- **Stock photos**
  - Search by keyword
  - Curated professional images
- **Icons** (classic / modern / outline)
- **Upload** (drag & drop)

#### ⊞ Smart layouts
- **Columns**: 2, 3, 4
- **Boxes**: solid / outline / with icons / side-line / top-line
- **Cards**: labeled cards (like Gamma "joined boxes")
- **Bullets**: large / small / arrow / process steps
- **Sequence**: timeline (horizontal/vertical) / process flow

#### ◎ Smart diagrams
Subset zoptymalizowany pod consulting:
- Funnel / Venn / Matrix (2x2)
- SWOT quadrant / Pyramid
- Process flow / Target / Comparison
- Cycle / Hierarchy / Relationship
- Image diagrams: hero image, collage, grid

#### 📊 Charts & data

**Sekcja "From your sources"** (kluczowa — game changer vs Gamma):
- Lista dostępnych chartów z ContextPack.charts_available
- Per chart: nazwa, źródło, [Insert] [Change type]
- Charts renderowane z PRAWDZIWYCH DANYCH artifacts

**Sekcja "Create new chart":**
- Bar / Column / Line / Area / Pie / Donut / Waterfall / Combo
- KPI card (single metric with trend arrow)
- Metric strip (3-5 metrics in a row)
- Table (data-driven)

**Sekcja "Refresh":**
- 🔄 Refresh all data from sources

#### 🎬 Media
- Video embed (URL)
- Animated elements (for online view)
- Loom recording embed

#### 📎 Platform artifacts (Consultinity-unique)
Insert embedded representations of platform objects:
- Initiative card (mini-view with status, %, owner)
- Task list (from selected initiative)
- Financial snapshot (key metrics)
- Insight card
- Note excerpt
- Workspace thumbnail (clickable to open)

#### ✏️ AI Edit (bulk)
- "Edit all cards" mode
- Prompt for bulk operations
- Presets: Improve writing / Fix spelling / Translate / Make shorter

### 5.5 Top Bar

**Left side:** Breadcrumb: `Presentations > [Deck Title]` (title editable inline)

**Right side (canonical order):**
1. **Theme** — opens Theme panel (right side overlay)
2. **Share** — opens Share modal
3. **Agent** — opens/closes Agent panel (right side)
4. **Present** — dropdown:
   - In this tab
   - Full screen
   - Presenter view (dual screen: slide + notes + next slide + timer)
   - Share a follow link (live sync for audience)

### 5.6 Bottom Bar

- Card indicator: "Card 4 of 8"
- Card title (current)
- ✨ Quick edits (opens Edit this card popup)
- Notes (opens speaker notes panel for current card)

---

## 6) AI Agent Panel

### 6.1 Umiejscowienie i UX

Panel boczny po prawej. Otwierany/zamykany przyciskiem "Agent" w top bar.
Zajmuje ~30% szerokości ekranu. Canvas się zmniejsza responsywnie.

### 6.2 Agent context (co Agent "wie")

**Domyślnie (Level A):**
- Cały deck (wszystkie karty i bloki)
- ContextPack (source artifacts data z momentu generacji)
- Organization Brand Kit
- Organization Media Library (tags, katalog)
- Deck generation settings (tone, audience, depth)

**Opcjonalnie (Level B, przycisk "Expand context"):**
- Wszystkie artefakty w projekcie (nie tylko te użyte do generacji)
- Pełna historia zmian w decku

### 6.3 Agent capabilities

#### Scope commands (per-card, per-range, per-deck)
```
"Change slide 3"                    → edytuje jedną kartę
"Change slides 2-4"                 → edytuje zakres kart
"Change all slides"                 → bulk edit na całym decku
"Change the image on slide 2"       → edytuje konkretny CardBlock
"Change the chart on slide 5"       → edytuje konkretny CardBlock
"Delete slide 6"                    → usuwa kartę
"Add a slide about risks after 4"   → wstawia nową kartę
"Move slide 7 to position 3"        → reorder
```

#### Content commands
```
"Make this more concise"             → skraca tekst na aktualnej karcie
"Expand the executive summary"       → rozbudowuje treść
"Add speaker notes to all cards"     → generuje speaker notes per card
"Summarize the financial data"       → streszcza dane do key takeaways
"Translate to Polish"                → tłumaczy cały deck
"Make the tone more executive"       → podnosi formalność
"Add 3 key takeaways per slide"      → dodaje podsumowania
```

#### Visual commands
```
"Make this more visual"              → zamienia tekst na diagramy/ikony
"Replace all stock photos with org images" → zamiana na Organization Library
"Change theme to dark"               → zmienia DeckTheme
"Use bigger fonts"                   → zwiększa heading_size_scale
"Add icons to all bullet points"     → wstawia ikony
"Make backgrounds consistent"        → wyrównuje kolory tła
```

#### Data commands
```
"Update all data from sources"       → refresh all refreshable blocks
"Add a KPI dashboard slide"          → wstawia nowy slajd z kpi_dashboard intent
"Show revenue as bar chart"          → zmienia chart type
"Add the initiative timeline"        → wstawia timeline z Initiative data
"Highlight the risks"                → dodaje callout/badge do risk items
```

### 6.4 Agent UI elements

**Witaj:**
- "Hi! I know this deck was built from [source names]. How can I help?"
- Kontekstowe sugestie (3-5 przycisków):
  - "Add an executive summary"
  - "Make all slides more concise"
  - "Add speaker notes"
  - "Update data from sources"
  - "Improve visual consistency"

**Chat history:**
- Pełna historia rozmowy w sesji
- Agent pokazuje co zmienił (per karta)
- Jeśli Agent proponuje obrazy → pokazuje thumbnails do wyboru
- Jeśli Agent nie jest pewny → pyta: "Do you want me to..."

**Input field:**
- Placeholder: "Ask me to edit, create, or style anything"
- "+" button (attach: screenshot, file)
- "Quick edits" button → presets menu

### 6.5 Agent proactive suggestions

Agent może proaktywnie informować (subtle banner, nie popup):
- "Source 'Financial Analysis Q2' has been updated. Want me to refresh data?"
- "Slide 3 has very dense content. Want me to split it into 2 slides?"
- "I notice no speaker notes. Want me to generate them?"
- "The chart on slide 5 would look better as a bar chart. Want me to change it?"

---

## 7) Data Refresh Mechanism (Semi-live)

### 7.1 Per-block refresh

Każdy `CardBlock` z `is_refreshable: true` (typowo: charts, KPI widgets, metric strips):
- Hover na blok → ikona 🔄 "Update from source"
- Klik → system pobiera najnowsze dane z `source_ref` → re-renderuje blok
- Visual: subtle pulse animation po refresh
- Metadata update: `last_data_refresh` timestamp

### 7.2 Per-card refresh

"Edit this card" popup → "🔄 Update data from source"
- Odświeża WSZYSTKIE refreshable blocks w tej karcie
- Nie zmienia tekstu ani layoutu (chyba że user explicitly asks via Agent)

### 7.3 Per-deck refresh

Menu "..." → "Refresh all data" LUB Agent: "Update all data from sources"
- System przechodzi przez wszystkie karty
- Odświeża każdy refreshable block
- Raportuje summary: "Updated 5 charts, 3 KPI widgets. 2 blocks had no changes."

### 7.4 Outdated data indicator

Jeśli `source_ref.artifact` zmienił `updated_at` po `last_data_refresh`:
- Badge na thumbnail w left panel: ⚠️
- Subtle indicator na bloku w canvas
- Agent proactive: "Data may be outdated on slides 3, 5, 7"

---

## 8) Animations for Online Presentations

### 8.1 Cel

Prezentacje wyświetlane online (share link, present mode) mają sprawiać wrażenie **życia i ruchu**, analogicznie do interaktywnych mind map.

### 8.2 Card-level animations

- **Entrance**: fade-in + subtle slide-up per card (configurable)
- **Transition**: smooth scroll between cards (continuous scroll, nie "page flip")

### 8.3 Block-level animations (per block type)

| Block type | Animation | Trigger |
|---|---|---|
| **chart** | Bars/lines draw from zero to value | Card enters viewport |
| **kpi_widget** | Number counts up from 0 to value | Card enters viewport |
| **metric_strip** | Numbers count up sequentially (staggered) | Card enters viewport |
| **bullet_list** | Items appear one by one (stagger 200ms) | Card enters viewport |
| **smart_diagram** | Elements appear in logical order | Card enters viewport |
| **image** | Subtle Ken Burns (zoom-in 105% over 10s) OR parallax on scroll | Card in viewport |
| **timeline_block** | Points appear sequentially along axis | Card enters viewport |
| **table** | Rows appear top-to-bottom (stagger) | Card enters viewport |

### 8.4 Control

- **Global toggle**: Animations ON/OFF (in Page setup, default ON for new decks)
- **Per-card override**: Card settings → Animations toggle
- **Presenter mode**: optionally click-to-advance per block animation
- **PPTX export**: static only (animations not transferred — noted in export limitations)
- **PDF export**: static only

### 8.5 Performance

- Animations use CSS transitions / requestAnimationFrame (no heavy JS)
- IntersectionObserver for viewport-based triggers
- Lazy loading for images (progressive JPEG / blur-up)

---

## 8.6 Smart Diagrams Library (Consulting-grade) — SSOT

W v3 AI nie “rysuje” dowolnych diagramów. AI wybiera z kuratowanej biblioteki diagramów i wypełnia je danymi. To daje stałą jakość “McKinsey-grade”.

**Kanon:** każdy diagram to `BlockType.smart_diagram` z `diagram_kind` + `payload`.

```
SmartDiagramPayload {
  diagram_kind:
    | "funnel"
    | "timeline_horizontal"
    | "timeline_vertical"
    | "process_steps"
    | "process_flow"
    | "matrix_2x2"
    | "swot"
    | "pyramid"
    | "venn_2"
    | "venn_3"
    | "cycle"
    | "org_hierarchy"
    | "roadmap_now_next_later"
    | "decision_tree_light"
  payload: JSON
  theme_binding: "auto"               // binds to DeckTheme (colors, fonts, spacing)
  density: "minimal" | "standard" | "detailed"
}
```

**Minimalny zestaw consulting diagrams (MVP v3):**
- **Now / Next / Later roadmap** (domyślny dla rekomendacji)
- **2x2 matrix** (priorytetyzacja)
- **Timeline** (horizontal + milestones)
- **Process steps** (1–6 kroków, numbered)
- **SWOT** (4 kwadranty, bez przeładowania)
- **Funnel** (3–6 poziomów)
- **Pyramid** (3–5 poziomów, message hierarchy)
- **Risk heatmap (2x2)** (probability vs impact — wariant matrix)

**Zasada spójności:** diagramy mają stałe spacing, stałe style labeli i automatyczny kontrast tekstu na polach (theme-aware).

---

## 8.7 Editing policy (v3): brak realtime collaboration + Undo 3 kroki

### 8.7.1 Realtime collaboration

**W v3 nie budujemy real-time collaborative editing.** Deck jest edytowany przez jednego użytkownika naraz, a udostępnianie służy do view/comment (edit permissions mogą istnieć, ale bez jednoczesnej edycji).

### 8.7.2 Undo

**MUST:** w Deck Builder działa `Undo` (3 kroki wstecz) dla operacji użytkownika w bieżącej sesji:
- edit text
- insert/remove block
- move/reorder blocks
- change layout/background
- replace/regenerate image
- chart type change / manual data edit

**Kanon UX:** w top bar lub floating toolbar:
- `Undo` (enabled jeśli są kroki)
- `Redo` (opcjonalnie, jeśli implementujemy; v3 minimalnie wymaga Undo)
- skróty: `Cmd+Z` (Undo), `Shift+Cmd+Z` (Redo — jeśli obecne)

**Granica:** Undo dotyczy zmian użytkownika; “Refresh from source” jest akcją odwracalną tylko jeśli mamy snapshot poprzedniego payloadu bloku (zalecane).

## 9) Template System

### 9.1 Tworzenie szablonu — ścieżka 1: "Save as template" (z istniejącego decka)

```
Deck Builder > Menu "..." > "Save as template"
```

**Dialog "Save as Template":**
- Template name
- Description
- Type (dropdown): Executive Update / Project Kickoff / Initiative Review / Financial Review / Assessment Results / Custom
- Scope: Organization (visible to my org) / Personal (only me)
- Sample content: checkbox "Keep current content as examples" (tekst zachowany jako example, will be replaced during generation)
- Auto-apply rules (optional checkboxes):
  - Suggest for Initiative presentations
  - Suggest for Financial presentations
  - Suggest for specific roles
  - Suggest for specific goals

**Co system robi:**
1. Kopiuje deck structure: cards z intentami, layoutami, block types → `outline_json`
2. Zapisuje `theme_id`
3. Sample content = tekst z decka (oznaczony jako "example")
4. NIE kopiuje danych/chartów (zależą od źródeł)
5. Tworzy `DeckTemplate` z `status: "active"`

### 9.2 Tworzenie szablonu — ścieżka 2: Admin panel

```
Reports > Presentations > Templates tab > "+New template"
```

Otwiera **Template Builder** — uproszczony Deck Builder gdzie admin:
1. Definiuje outline (dodaje karty, ustawia intenty, tytuły)
2. Ustawia layout per karta
3. Dodaje sample content / placeholders
4. Ustawia default theme
5. Definiuje auto-apply rules
6. Save

### 9.3 Template Gallery (w Wizard Krok 2)

- **System templates** (application scope) — preinstalled, maintained by SuperAdmin
- **Organization templates** — created by Org Admin
- **Personal templates** — created by user, visible only to them
- Search + filtry: by deck_type, audience, goal, scope
- Preview: scroll through sample cards + "Preview with other themes" + "Use this template"
- Auto-suggestion: jeśli ContextPack matches auto_apply_rules → banner "Recommended: [Template]"

### 9.4 Cloning

- Organization can clone application template → modify → save as org template
- User can clone any template → save as personal template
- Clone = deep copy, new ID, no version link to original

### 9.5 No versioning

- Zmiana template = nowy template (clone + edit), stary może być archived
- Zgodne z ogólną zasadą V3: brak wersjonowania templateów

### 9.6 Starting templates (MVP minimum set)

| # | Name | Intents | Slides |
|---|---|---|---|
| 1 | **Executive Update** | cover, executive_summary, kpi_dashboard, content, content, risk_overview, next_steps, thank_you | 8 |
| 2 | **Project Kickoff** | cover, content (problem), content (solution), timeline, content (team), data (budget), next_steps, thank_you | 8 |
| 3 | **Initiative Review** | cover, executive_summary, content (progress), kpi_dashboard, risk_overview, data (financial impact), recommendation, next_steps | 8 |
| 4 | **Financial Analysis Presentation** | cover, executive_summary, data (P&L overview), data (key ratios), data (trends), comparison (scenarios), recommendation, thank_you | 8 |
| 5 | **Assessment Results** | cover, content (methodology), data (findings by category), content (top insights), recommendation, timeline (roadmap), next_steps, thank_you | 8 |

---

## 10) Short Wizard Flow (z artefaktu)

### 10.1 Wariant A: Template auto-match

```
1. User clicks "Create Presentation" on Initiative
2. System detects: Initiative type = "Strategy"
3. System finds matching template via auto_apply_rules: "Initiative Review"
4. System shows confirmation:
   "We suggest using 'Initiative Review' template.
    [Use this template] [Choose another] [Generate without template]"
5. If "Use this template":
   → Skip to Krok 3 (Outline) with:
     - Source pre-loaded: this Initiative
     - Template outline pre-loaded
     - Title auto-generated: "[Initiative name] — Review"
     - Theme from Brand Kit
   → User reviews outline, optionally adds more sources, hits Generate
6. Total clicks to generation: 3
```

### 10.2 Wariant B: No matching template

```
1. User clicks "Create Presentation" on Financial Analysis
2. System builds ContextPack from this artifact
3. Shows Krok 2 (Settings):
   - Source pre-filled (Financial Analysis session)
   - "Add more sources" link available
   - Default: "AI generates" selected
4. User adjusts settings, clicks Continue
5. Shows Krok 3 (Outline):
   - AI proposes outline based on ContextPack
   - User reviews, adjusts
6. Generate
7. Total clicks: 4
```

### 10.3 Wariant C: Adding more sources

W Kroku 2 lub 3: przycisk "Add more sources" → otwiera picker z artefaktami (jak Krok 1 Full Wizard, ale w modal).

---

## 11) Share / Export / Present

### 11.1 Present mode

**"Present" button (top bar) → dropdown:**
- **In this tab** (fullscreen in browser, with animations)
- **Full screen** (native browser fullscreen)
- **Presenter view** (dual screen: current slide + speaker notes + next slide preview + timer)
- **Share a follow link** (audience sees what presenter shows, live sync)

**Present mode UX:**
- Cards scroll vertically (like Gamma), with entrance animations
- Click or arrow keys to advance
- ESC to exit
- Progress bar at top (subtle)

### 11.2 Share online

**"Share" button → modal with tabs:**

**Collaborate tab:**
- Invite by email
- Set workspace member access (No access / View / Comment / Edit)

**Share tab:**
- Toggle: Public link ON/OFF
- Copy link button
- Permissions: "Anyone with link can view" / "Anyone with link can comment"

**Export tab:**
- See 11.3

**Embed tab:**
- Embed code (iframe) for external sites

**Analytics (button at bottom):**
- Page views (unique viewers, last 30 days chart)
- Card engagement (which cards viewed, how long per card)
- Per-viewer stats (name, last opened, cards viewed count)

### 11.3 Export

**Export types:**

| Format | Quality | Notes |
|---|---|---|
| **PDF** | Consulting-grade, fonts embedded | Static, all cards as pages |
| **PowerPoint (PPTX)** | Native formatting, editable charts | Slide masters from theme, speaker notes included |
| **PNGs** | High-res per card | For email, social media, reports |

**Export scope:** All cards / Selected range (dropdown)

**Font guidance (for PPTX):**
- "To ensure your presentation looks right, install these fonts: [Font 1] [Font 2]"
- Download links for fonts

**Export limitations notice:**
- "Animated elements will be static in PDF and PowerPoint"
- "Some visual effects may use fallback styles"
- "Charts are exported as editable PowerPoint charts"

**PPTX quality requirements:**
- Slide layout: 16:9 (or matching deck card_size)
- Slide masters generated from DeckTheme (colors, fonts, logo)
- Charts rendered as native PPTX charts (editable in PowerPoint)
- Images embedded at full resolution
- Speaker notes in native notes pane
- Slide numbers in footer

---

## 12) Learning System

### 12.1 Level C: Brand Kit + Templates (MVP)

- System auto-applies Brand Kit to every new deck
- Templates define preferred structures, intents, layouts
- No machine learning required

### 12.2 Level A: Learning from generated decks (v3.1)

System tracks per organization:
- Which card intents are added/removed after generation (intent preference)
- Which layouts are changed by users (layout preference)
- Which tone/depth settings are most used (generation preference)
- Average slide count per deck type
- Most used image sources (org library vs AI vs stock)

→ Feeds into `OrganizationStyleProfile`:

```
OrganizationStyleProfile {
  org_id: UUID
  preferred_intents: { intent: CardIntent, weight: number }[]
  preferred_layouts: { intent: CardIntent, layout_id: string, weight: number }[]
  preferred_text_depth: "concise" | "detailed"
  avg_slides_per_deck_type: { deck_type: string, avg: number }[]
  preferred_chart_types: { data_category: string, chart_type: string }[]
  preferred_image_source: "org_library" | "ai" | "stock" | "mixed"
  image_density: "minimal" | "moderate" | "heavy"
  learned_from_count: number
  last_updated: timestamp
}
```

→ Used by AI to **improve defaults** in Wizard and **improve generation quality**.

### 12.3 Level B: Learning from uploaded presentations (v4)

- Admin uploads 5-10 existing PPT/PDF of the organization
- System analyzes: color palette, text:image ratios, typical structures, layout patterns, font usage
- Feeds into OrganizationStyleProfile with higher confidence weights
- Can auto-generate custom DeckTheme from uploaded branding

---

## 13) Presentation Lifecycle

```
[DRAFT] → [GENERATED] → [EDITING] → [READY] → [SHARED/EXPORTED]
                                       ↓
                                   [ARCHIVED]
```

- **Draft**: Wizard started, not yet generated
- **Generated**: AI finished generating all cards
- **Editing**: User actively editing in Builder
- **Ready**: User marked as ready (manual action or first export/share)
- **Shared**: Share link active or export performed
- **Archived**: User moved to archive

All decks visible in: **Reports > Presentations** (list with filters by status, date, author, source artifacts, deck_type).

---

## 14) Presentations Hub (Library)

### 14.1 Lokalizacja

`Reports > Presentations` (tab w module Reports)

### 14.2 View modes

Zgodnie z `view-modes-standard.md`:
- **Table**: lista z kolumnami (Title, Status, Created by, Date, Sources, Slides count)
- **Grid (cards)**: karty z thumbnail okładki + tytuł + status badge

### 14.3 Filtry

- Status: All / Draft / Generated / Editing / Ready / Shared / Archived
- Created by: Me / Team / All
- Source type: Initiative / Financial Analysis / Tool Session / Note / Mixed
- Date range

### 14.4 Actions

- "+New Presentation" → Full Wizard
- Click on deck → opens Deck Builder
- Bulk actions: Archive, Delete, Export (selected)

### 14.5 Templates tab

- Sub-tab w Presentations Hub
- Lista templateów z filtrami (System / Organization / Personal)
- "+New template" (admin only)
- Actions per template: Use / Clone / Edit / Archive

---

## 15) Traceability & Backlinks

### 15.1 Source traceability

Każdy `Deck` ma `source_refs[]` — lista artefaktów, z których powstał.
Każdy `DeckCard` ma `source_refs[]` — per-slajd.
Każdy `CardBlock` ma `source_ref?` — per-blok.

Widoczne w UI:
- Deck metadata panel: "Sources: Initiative 'DT', Financial Analysis 'Q2'"
- Per-card footer (subtle): "Data from: Financial Analysis 'Q2 2026'"

### 15.2 Backlinks ("Used in")

Zgodnie z `LINK_GRAPH_V3.md`:
- Na artefakcie źródłowym (np. Initiative) w sekcji "Used in": "Presentation: Q2 Strategic Review"
- Platform-wide, automatyczne

### 15.3 ContextPack snapshot

`context_pack_snapshot` w `Deck` = zamrożony JSON ContextPack z momentu generacji.
Służy do:
- Porównania "co się zmieniło" przy refresh
- Agent context (wie co było w momencie generacji)
- Audit trail

---

## 16) Mapping na istniejący kod

### 16.1 Co już mamy (as-is)

| Element | Status | Lokalizacja |
|---|---|---|
| PresentationWizard (frontend) | Exists, basic | `src/components/Presentations/PresentationWizard.tsx` |
| DeckTemplateGallery (frontend) | Exists, basic | `src/components/Presentations/DeckTemplateGallery.tsx` |
| presentations.routes (backend) | Exists | `server/src/routes/presentations.routes.ts` |
| presentationGeneratorService | Exists | `server/src/services/presentationGeneratorService.ts` |
| DB: presentation_templates | Exists | `server/migrations/568_presentations_brand_kits_templates.sql` |
| DB: presentation_decks | Exists | `server/migrations/568_presentations_brand_kits_templates.sql` |
| DB: brand_kits | Exists | `server/migrations/568_presentations_brand_kits_templates.sql` |
| PPTX pipeline (pptxgenjs) | Exists | `server/src/services/` (PptxPipelineService) |
| Report Builder (adjacent) | Exists, mature | `src/components/ReportBuilder/`, `server/src/routes/report-builder.routes.ts` |

### 16.2 Co trzeba zbudować (gap)

| Element | Priority | Notes |
|---|---|---|
| ContextPack builder (per source type adapters) | P0 | Transforms each artifact type to unified JSON |
| Outline generator (AI) | P0 | LLM generates outline from ContextPack |
| Card generator (AI, per card) | P0 | LLM generates CardBlock[] per card |
| Deck Builder UI (Gamma-like editor) | P0 | Full WYSIWYG editor with left/center/right layout |
| Smart Image Routing | P0 | Rules engine per card intent |
| Agent Panel UI + backend | P0 | Chat interface with deck-aware AI |
| Block-level editing UI | P0 | Click-to-edit per block, floating menus |
| Organization Media Library (CRUD) | P1 | Upload, tag, browse images |
| Brand Kit → DeckTheme auto-generation | P1 | Auto-create theme from Brand Kit |
| Data refresh mechanism | P1 | Per-block, per-card, per-deck refresh |
| Animations for online view | P1 | CSS animations, IntersectionObserver |
| Template Builder (admin) | P1 | Simplified deck builder for template creation |
| OrganizationStyleProfile (learning) | P2 | Track preferences, improve defaults |
| Share link + analytics | P1 | Public URL, viewer stats |
| PPTX export upgrade | P0 | Native charts, slide masters from theme |

---

## 17) Zasady implementacji

### 17.1 AI generation quality rules

1. **Nigdy nie wymyślaj danych** — tylko dane z ContextPack. Jeśli brak → placeholder "Add data from [source type]"
2. **Nie powtarzaj tego samego tekstu** na wielu slajdach — AI musi śledzić co już powiedział
3. **Konsultingowy ton** — zwięzłe zdania, action-oriented, "so what" framing
4. **Headline driven** — każdy slajd ma silny, jednoznaczny headline (nie "Overview", lecz "Revenue grew 12% YoY")
5. **Data tells the story** — preferuj wizualizacje nad tekst tam gdzie dane są dostępne
6. **Progressive disclosure** — od high-level summary do szczegółów
7. **Max 7±2 items per list** — nie przeładowuj slajdów

### 17.2 Visual quality rules

1. **Brand Kit first** — zawsze stosuj organizacyjne kolory i fonty
2. **Consistent spacing** — równe marginesy, grid-aligned elementy
3. **High contrast** — tekst na tle musi być czytelny (WCAG AA minimum)
4. **Professional imagery** — żadnych clipartów, cartoon'ów, random stock
5. **Less is more** — lepiej puste przestrzenie niż przeładowane slajdy
6. **16:9 default** — optymalizacja pod projektor / screen sharing

### 17.3 Export quality rules

1. **PDF**: embedded fonts, high-res images, proper page breaks
2. **PPTX**: editable charts (nie obrazki!), slide masters, speaker notes
3. **PNGs**: 2x resolution for retina
4. **Font fallback**: jeśli custom font niedostępny → Calibri (safe consulting font)
