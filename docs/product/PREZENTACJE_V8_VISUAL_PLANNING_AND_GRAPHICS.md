# Prezentacje v8 - Visual planning and graphics

> Status: Draft v8
> Cel: Zdefiniowac kanoniczny kontrakt visual planningu, routingu grafik i review zasad dla `v8`, tak aby obrazy wspieraly deck jak w liderach rynku, ale pozostaly traceable, brand-safe i reviewable.

---

## 1. Zasada nadrzedna

AI nie "wrzuca obrazkow".
AI planuje warstwe wizualna slajdu wedlug:
- intentu slajdu,
- layout family,
- source context,
- presentation mode,
- brand defaults,
- image source policy.

To oznacza:
- najpierw powstaje `visual plan`,
- potem user moze go reviewowac,
- dopiero potem asset jest materializowany albo przypinany.

---

## 2. Cele warstwy wizualnej

Warstwa wizualna ma:
- wzmacniac czytelnosc przekazu,
- budowac jakosc "good by default",
- wspierac brand consistency,
- nie psuc source-backed trust,
- nie zamieniac slajdu w dekoracje.

Warstwa wizualna nie ma:
- zastapic danych,
- przykrywac slabej narracji,
- wprowadzac przypadkowych stock-like obrazow bez sensu.

---

## 3. Canonical visual planning object

```ts
type VisualPlan = {
  visualPlanId: string;
  deckId: string;
  cardId: string;

  mode: 'hero_visual' | 'supporting_visual' | 'data_first' | 'diagram_first' | 'text_only';
  sourcePolicy: 'smart' | 'org_library' | 'ai_only' | 'none' | 'manual';
  stylePreset:
    | 'corporate_photography'
    | 'abstract_geometric'
    | 'flat_illustration'
    | 'data_focused'
    | 'industry_realistic'
    | 'minimal_no_images';

  slots: VisualSlotPlan[];
  rationale: string;
  warnings: string[];
};

type VisualSlotPlan = {
  slotId: string;
  slotRole:
    | 'cover_bg'
    | 'hero'
    | 'background_texture'
    | 'side_illustration'
    | 'diagram'
    | 'supporting_image'
    | 'icon_strip';
  required: boolean;
  preferredAssetSource: 'org_library' | 'ai' | 'stock' | 'none';
  candidateTags?: string[];
  candidateSourceRefs?: string[];
  promptHint?: string | null;
  noTextInImage?: boolean;
  expectedVisualWeight: 'low' | 'medium' | 'high';
};
```

---

## 4. Image source routing

### 4.1 Source policies

#### `smart`

System decides per slide:
- `org_library` first when brand/context value is high,
- `ai` when no good org asset exists and a strong supporting visual is useful,
- `none` when slide should remain text/data-first.

This is the default for most decks.

#### `org_library`

Use only organization media and approved assets.

Use when:
- brand safety is critical,
- confidentiality is higher,
- real company context matters more than generative imagery.

#### `ai_only`

Use AI-generated visuals only.

Use when:
- org has no media,
- abstract or illustrative visuals fit the mode,
- compliance allows it.

#### `none`

No images.

Use when:
- data-first or minimal mode,
- readability matters more than decoration,
- user explicitly requests low visual density.

#### `manual`

User or later workflow chooses visuals manually.

---

## 5. Routing rules by slide intent

### `cover`

Preferred mode:
- `hero_visual`

Preferred source:
- `org_library` if logo/brand/hero asset exists
- else `ai` or brand-generated abstract background

### `section_divider`

Preferred mode:
- `supporting_visual`

Preferred source:
- abstract / brand-safe visual

Rule:
- no heavy photography unless it meaningfully supports the section.

### `executive_summary`

Preferred mode:
- `supporting_visual` or `text_only`

Rule:
- visuals may support authority and polish,
- but clarity wins over decoration.

### `data`

Preferred mode:
- `data_first`

Rule:
- dominant visual should be chart/table/metric,
- decorative image should be absent or minimal.

### `comparison`

Preferred mode:
- `data_first` or `supporting_visual`

Rule:
- comparison structure must dominate over photography.

### `timeline`

Preferred mode:
- `diagram_first`

Rule:
- prefer diagrams/timeline blocks,
- avoid unrelated decorative imagery.

### `process`

Preferred mode:
- `diagram_first`

Rule:
- prefer process diagram or structured illustration.

### `quote`

Preferred mode:
- `hero_visual` or `supporting_visual`

Rule:
- strong but quiet visual acceptable,
- quote remains the primary message.

### `next_steps`

Preferred mode:
- `text_only` or `supporting_visual`

Rule:
- action structure must dominate.

---

## 6. Routing rules by presentation mode

### `SHOW`

Visual profile:
- more hero/supporting visuals,
- larger visual weight,
- more background and scene support,
- stronger cover and section slides.

### `DOCUMENT`

Visual profile:
- lower decorative image density,
- more charts/tables/diagrams,
- photography only when it adds context.

### `BRIEFING`

Visual profile:
- compact,
- KPI and status first,
- images optional and light.

### `WORKSHOP`

Visual profile:
- frameworks and diagrams first,
- minimal decorative imagery,
- clarity over polish.

---

## 7. Asset selection logic

### Step 1 - Decide if slide needs a visual

The engine first answers:
- should this slide be `text_only`,
- `data_first`,
- `diagram_first`,
- `supporting_visual`,
- or `hero_visual`.

### Step 2 - Choose slot roles

Examples:
- `cover`
  `cover_bg`, `hero`
- `section_divider`
  `background_texture`
- `content`
  `side_illustration` or `supporting_image`
- `process`
  `diagram`

### Step 3 - Choose preferred asset source

Decision order:
1. policy constraints
2. slide intent suitability
3. org library availability
4. brand/style fit
5. fallback to AI or none

### Step 4 - Build reviewable visual plan

The system should expose:
- what slot is being planned,
- why that slot exists,
- where the asset should come from,
- what style it should follow,
- whether text-only would be cleaner.

---

## 8. Review contract

Every non-trivial visual proposal should support:
- accept visual plan
- reject visual
- regenerate visual
- switch source policy
- set slide to text-only
- inspect why this visual was suggested

Visual review does not need to block entire generation,
but it must exist for meaningful visual mutations.

---

## 9. AI-generated graphics rules

When using AI-generated visuals:
- image must follow `stylePreset`,
- image must respect brand-safe palette where relevant,
- image should avoid text unless the slot explicitly supports designed text artifacts,
- image must be judged against readability of the slide,
- generated image should never pretend to be from organization media.

---

## 10. Organization media rules

When using org media:
- prefer assets with strong contextual relevance,
- prefer assets already associated with tags matching slide topic,
- preserve rights/governance metadata,
- expose that the visual came from org library.

This is especially important for:
- company/team/office visuals,
- product visuals,
- trusted board/client decks.

---

## 11. Text-only rule

A text-only slide is not a failure.
It is often the best outcome for:
- dense data,
- executive summary,
- recommendation,
- next steps,
- high-confidentiality contexts,
- minimal mode.

The engine must be allowed to choose `text_only` when it improves clarity.

---

## 12. Planning outputs required by generation

Before materializing graphics, generation should know:
- `visual mode` for each slide,
- `slot roles`,
- `preferred source`,
- `style preset`,
- `brand constraints`,
- `warnings`,
- whether text-only is the better route.

Without this, "visuals" remain ad hoc decoration instead of a controlled planning layer.

---

## 13. Acceptance checklist

- Every generated slide has a declared visual mode.
- Every planned visual has a reason, source policy and slot role.
- The system can explicitly choose `text_only`.
- `org_library` vs `ai_only` vs `smart` vs `none` is defined as product behavior, not hidden implementation detail.
- Visual proposals are reviewable and do not silently mutate accepted slide content.
- Graphics routing supports Gamma-like speed without sacrificing Consultify-grade trust and brand safety.
