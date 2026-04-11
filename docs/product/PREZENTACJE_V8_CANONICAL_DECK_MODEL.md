# Prezentacje v8 - Canonical deck model

> Status: Draft v8
> Cel: Zdefiniowac jeden build-ready model decku dla `wizard -> builder -> deliver`, wraz z compatibility bridge dla `deck_json`, `unified_json` i istniejacych zapisanych deckow.

---

## 1. Problem do rozwiazania

Dzisiaj runtime decku jest rozproszony:
- row `presentation_decks` przechowuje metadata,
- `unified_json` sluzy generatorowi i PPTX pipeline,
- `deck_json` sluzy builderowi i autosave,
- helpery czytaja `deck_json || unified_json`,
- cards moga byc widziane jako `cards` albo `slides`.

To jest wystarczajace do dzialania,
ale nie wystarcza do stabilnego produktu Gamma-like.

`v8` wymaga jednego canonical deck document:
- otwieranego przez builder,
- tworzonego przez wizard/generator,
- uzywanego przez AI operations,
- zachowujacego traceability i delivery continuity.

---

## 2. Zasada nadrzedna

Jedna prawda produktu:
- canonical deck document jest modelem edycyjnym i runtime model produktu.

Pozostale shape'y:
- DB row metadata,
- `unified_json`,
- export payloads,
- legacy `deck_json`

sa projections albo compatibility inputs, nie glowna prawda produktu.

---

## 3. Canonical model

```ts
type DeckStatus = 'draft' | 'generated' | 'editing' | 'ready' | 'shared' | 'archived' | 'failed';

type DeckDocument = {
  schemaVersion: 1;
  deckId: string;
  organizationId: string;

  meta: {
    title: string;
    description?: string | null;
    deckType: string;
    audience?: 'sponsor' | 'executive' | 'investor' | 'internal' | string | null;
    goal?: 'inform' | 'decide' | 'sell' | 'align' | string | null;
    language?: 'pl' | 'en' | string | null;
    confidentiality?: 'confidential' | 'internal' | 'public' | string | null;
    theme?: string | null;
    brandKitRef?: string | null;
    templateId?: string | null;
    presentationMode?: string | null;
    communicationRegister?: string | null;
    thumbnailUrl?: string | null;
  };

  lifecycle: {
    status: DeckStatus;
    createdAt?: string | null;
    updatedAt?: string | null;
    exportedAt?: string | null;
    archivedAt?: string | null;
  };

  generation: {
    outline: OutlineNode[];
    generationSettings: {
      sourceType?: string | null;
      sourceId?: string | null;
      selectedSources: SourceArtifactRef[];
      visuals?: {
        enabled?: boolean;
        priority?: 'quality' | 'cost';
        imageDensity?: 'low' | 'medium' | 'high';
      } | null;
      brandColor?: string | null;
    };
    contextPackSnapshotRef?: string | null;
    warnings: string[];
  };

  delivery: {
    shareToken?: string | null;
    shareExpiresAt?: string | null;
    exportFormat?: string | null;
    exportPath?: string | null;
    exportHistory?: ExportRecord[];
    analyticsSummary?: AnalyticsSummary | null;
  };

  cards: DeckCard[];

  traceability: {
    sourceRefs: SourceRef[];
    sourceArtifacts: SourceArtifactRef[];
  };

  ai: {
    lastResolvedOperationId?: string | null;
    reviewState?: 'clean' | 'has_pending_proposals' | 'has_unresolved_conflicts';
  };
};

type OutlineNode = {
  outlineId: string;
  cardId?: string | null;
  intent: string;
  title: string;
  keyMessage?: string | null;
  enabled: boolean;
  orderIndex: number;
};

type DeckCard = {
  cardId: string;
  orderIndex: number;
  intent: string;
  title: string;
  keyMessage?: string | null;
  layoutId?: string | null;
  blocks: CardBlock[];
  sourceRefs: SourceRef[];
  speakerNotes?: string | null;
  background?: Record<string, unknown> | null;
  animations?: Record<string, unknown> | null;
  isLocked?: boolean;
  hasRefreshableData?: boolean;
};

type CardBlock = {
  blockId: string;
  cardId: string;
  type: string;
  content: unknown;
  sourceRef?: SourceRef | null;
  isRefreshable?: boolean;
  position?: Record<string, unknown> | null;
  styleOverrides?: Record<string, unknown> | null;
  aiEditable?: boolean;
};
```

---

## 4. Required invariants

### 4.1 Deck invariants

- `schemaVersion` is mandatory.
- `deckId` must equal the persisted deck row id.
- `cards` are always ordered by `orderIndex`.
- `generation.outline` exists even when empty.
- `traceability.sourceRefs` is always an array.
- `generation.generationSettings.selectedSources` is always an array.

### 4.2 Card invariants

- every `cardId` is unique within the deck,
- every card has exactly one `orderIndex`,
- every card has `intent`,
- every card has `blocks` array, even if empty.

### 4.3 Block invariants

- every `blockId` is unique within the deck,
- every block belongs to one `cardId`,
- `isRefreshable = true` requires a `sourceRef`,
- AI cannot apply a mutation to a locked card unless explicitly allowed by future policy.

### 4.4 Traceability invariants

- `traceability.sourceRefs` is the deck-level union of all card/block refs plus explicit setup refs,
- no block may expose fake source grounding,
- `sourceType` and `sourceId` in generation settings describe the canonical deck origin, not every artifact used in generation.

---

## 5. Compatibility bridge

### 5.1 Inputs we must support

Current runtime can read:
- DB metadata row from `presentation_decks`
- `deck_json`
- `unified_json`
- row-level `source_artifacts`
- row-level `source_refs_json`
- row-level `outline_json`

### 5.2 Normalization precedence

When opening a deck:

1. Load DB row metadata.
2. Parse `deck_json` if valid.
3. Else parse `unified_json` if valid.
4. Else reconstruct a minimal canonical deck from row metadata and `presentation_cards` if available.

### 5.3 Mapping rules

#### DB row -> canonical deck

| DB row field | Canonical target |
|---|---|
| `id` | `deckId` |
| `organization_id` | `organizationId` |
| `title` | `meta.title` |
| `description` | `meta.description` |
| `deck_type` | `meta.deckType` |
| `audience` | `meta.audience` |
| `goal` | `meta.goal` |
| `language` | `meta.language` |
| `confidentiality` | `meta.confidentiality` |
| `theme` | `meta.theme` |
| `brand_kit_id` | `meta.brandKitRef` |
| `template_id` | `meta.templateId` |
| `presentation_mode` | `meta.presentationMode` |
| `status` | `lifecycle.status` |
| `created_at` | `lifecycle.createdAt` |
| `updated_at` | `lifecycle.updatedAt` |
| `exported_at` | `lifecycle.exportedAt` |
| `share_token` | `delivery.shareToken` |
| `share_expires_at` | `delivery.shareExpiresAt` |
| `export_format` | `delivery.exportFormat` |
| `export_path` | `delivery.exportPath` |
| `validation_warnings` | `generation.warnings` |
| `source_type` | `generation.generationSettings.sourceType` |
| `source_id` | `generation.generationSettings.sourceId` |
| `source_artifacts` | `traceability.sourceArtifacts` and `generation.generationSettings.selectedSources` |
| `source_refs_json` | `traceability.sourceRefs` |
| `outline_json` | `generation.outline` |

#### `deck_json` -> canonical deck

Accepted legacy shapes:
- `cards[]`
- `slides[]`
- `deck_id`
- `title`
- `theme`

Normalization:
- `cards[]` wins over `slides[]`
- `card_id` maps to `cardId`
- `order_index` maps to `orderIndex`
- `layout_id` maps to `layoutId`
- `source_refs` maps to card-level `sourceRefs`
- `is_locked` maps to `isLocked`
- `has_refreshable_data` maps to `hasRefreshableData`
- block `source_ref` maps to `sourceRef`
- block `is_refreshable` maps to `isRefreshable`
- block `ai_editable` maps to `aiEditable`

#### `unified_json` -> canonical deck

Accepted shape:
- `meta`
- `slides[]`

Normalization:
- `slides[]` become `cards[]`
- `slide.intent` maps to card `intent`
- `slide.key_message` maps to card `keyMessage`
- `slide.title` falls back from `key_message`
- visuals become block-level or card-level content only if builder can render them; otherwise preserve as extension metadata

### 5.4 Missing data behavior

If a field is missing:
- preserve DB row truth first,
- then legacy payload truth,
- then synthesize safe defaults.

Safe defaults:
- `schemaVersion = 1`
- `lifecycle.status = 'draft'`
- `cards = []`
- `generation.outline = []`
- `traceability.sourceRefs = []`
- `generation.warnings = []`

---

## 6. Persistence rules

### 6.1 Product rule

The canonical deck document is the document the builder edits.

### 6.2 Database rule

Short-term rollout-safe persistence:
- persist canonical deck document into `deck_json`,
- keep `unified_json` as generator/export projection,
- keep row metadata in `presentation_decks`,
- keep `outline_json`, `source_refs_json`, `source_artifacts` synchronized as indexed/externalized fields.

### 6.3 Save pipeline

On builder autosave:
1. validate canonical deck invariants,
2. write normalized canonical deck to `deck_json`,
3. sync row-level metadata fields that must remain queryable,
4. do not rewrite `unified_json` unless export/generation pipeline explicitly regenerates it.

### 6.4 Generate pipeline

On `generate/deck`:
1. create/update row metadata,
2. build `unified_json`,
3. normalize `unified_json` to canonical deck,
4. persist canonical deck into `deck_json`,
5. persist `unified_json` for export/runtime compatibility.

This is the critical rule that closes `wizard -> builder` continuity.

---

## 7. Lifecycle contract

Allowed lifecycle transitions:

- `draft -> generating`
- `generating -> ready`
- `generating -> failed`
- `ready -> editing`
- `editing -> ready`
- `ready -> shared`
- `shared -> editing`
- `shared -> archived`
- `ready -> archived`
- `failed -> draft`

Interpretation:
- `generated` is a valid product state in SSOT language,
- implementation may currently use `ready` immediately after generation,
- target bridge should preserve semantic meaning even if current runtime uses fewer raw DB states.

Recommended implementation normalization:
- DB `draft` with outline only -> product `draft`
- DB `generating` -> product `generated_in_progress`
- DB `ready` before manual edits -> product `generated`
- DB `ready` after edits -> product `ready`

If the team does not add an explicit generated marker, document this as derived state in UI.

---

## 8. What must change in current runtime

### 8.1 Must add

- canonical normalization helper,
- canonical deck validation helper,
- explicit write of canonical deck after generation,
- stable card/block identifiers through wizard -> builder.

### 8.2 Must stop doing

- treating `deck_json` and `unified_json` as interchangeable truths,
- allowing builder to depend on whether cards live under `cards` or `slides`,
- adding new deck mutations directly against ad hoc legacy shapes.

---

## 9. Build-ready decision

For `v8`, the team must implement against:
- one canonical deck document,
- one normalization bridge,
- one save contract,
- one lifecycle contract.

Without this, Gamma-like continuity remains a demo pattern instead of a stable product runtime.

---

## 10. Code-to-model reconciliation (2026-04-11)

### Naming conventions

The canonical model uses `DeckDocument` with `cardId` / `blockId`. The implementation uses:
- **Wizard/Builder type**: `Deck` (from `wizard/types.ts`) with `card_id` / `block_id` (snake_case)
- **Server storage**: `presentation_decks.deck_json` stores the `Deck` type directly
- **Generator output**: `unified_json` uses `slides[]` with `slide.intent` / `slide.content`

The `card_id` field is the implementation-equivalent of the canonical `cardId`. Both serve
the same purpose: stable per-slide identity that persists across edits and reorder.

### Bridge implementation

`deckFromUnifiedJson()` in `DeckBuilder.tsx` bridges from generator output to builder format.
As of 2026-04-11, this bridge now preserves existing IDs from the source:
```
const cardId = slide.slide_id || slide.id || slide.card_id || `card-${params.deckId}-${idx}`;
```
This ensures that if the generator assigns stable IDs, they propagate to the builder.

### Autosave contract

Autosave (`PUT /decks/:deckId/autosave`) now includes:
- **Optimistic concurrency**: `X-Deck-Version` header checked against `presentation_decks.version`
- **Version snapshots**: previous `deck_json` is captured in `presentation_deck_versions` before overwrite
- **409 on conflict**: stale version returns structured error with `serverVersion` and `clientVersion`

### Schema validation gap

The canonical model specifies `schemaVersion: 1` validation on autosave. This is not yet
implemented — autosave accepts raw JSON. This is documented as a known gap for future hardening.
