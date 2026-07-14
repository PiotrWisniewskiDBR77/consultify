/**
 * TemplateBuilder — model danych (#83c/#83d).
 *
 * Buildery template edytują STRUKTURĘ reużywalnego szablonu (kolejność +
 * typ + głębokość elementów), NIGDY treści ani brandingu — twarda granica
 * Piotra (_KONCEPT_TEMPLATE_OUTPUTS §4.3). Branding = motyw org (D19),
 * osobno od template'u.
 *
 * Serializacja jest 1:1 z żywym kontraktem fasady
 * `POST /api/deliverables/templates` (`deliverableTemplateService.ts`):
 *   - doc   → meta.sections_json   (report_builder_templates)
 *   - deck  → meta.outline_json    (presentation_templates)
 *   - table → meta.schema_snapshot (tp_base_templates)
 *
 * Ten plik NIE dotyka silników generacji (Z127/F5) — wyłącznie struktura.
 */

export type TemplateType = 'doc' | 'deck' | 'table';
export type TemplateScope = 'org' | 'private';

/** Głębokość / długość generacji AI dla elementu (structural hint). */
export type TemplateDepth = 'short' | 'medium' | 'long';

/** doc — jedna sekcja dokumentu (Word/Report). */
export type DocBlockKind = 'heading' | 'paragraph' | 'bullets' | 'table' | 'kpi' | 'chart';

export interface DocSection {
  id: string;
  title: string;
  block: DocBlockKind;
  depth: TemplateDepth;
  /** structural placeholder / instrukcja dla generatora — NIE treść finalna. */
  hint: string;
  /** czy generator AI wypełnia tę sekcję (vs pusta w output). */
  aiFilled: boolean;
}

/** deck — jeden slajd prezentacji. */
export type SlideArchetype =
  | 'cover'
  | 'agenda'
  | 'section'
  | 'content'
  | 'two-column'
  | 'kpi'
  | 'chart'
  | 'quote'
  | 'closing';

export interface DeckSlide {
  id: string;
  title: string;
  archetype: SlideArchetype;
  hint: string;
  aiFilled: boolean;
}

/** table — jedna kolumna arkusza (Excel/Sheet). */
export type SheetColumnType = 'text' | 'number' | 'currency' | 'percent' | 'date' | 'formula';

export interface SheetColumn {
  id: string;
  name: string;
  type: SheetColumnType;
  /** dla type==='formula' — wyrażenie schematu (np. "=B*C"). */
  formula: string;
}

export type TemplateElement = DocSection | DeckSlide | SheetColumn;

export interface TemplateDraft {
  type: TemplateType;
  name: string;
  description: string;
  scope: TemplateScope;
  /** opcjonalny ref motywu org (Brand Kit) — branding OSOBNO od template'u (D19). */
  themeRef: string | null;
  doc: DocSection[];
  deck: DeckSlide[];
  table: SheetColumn[];
}

let _seq = 0;
export function nextId(prefix: string): string {
  _seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${_seq}`;
}

// ── Etykiety słowników (PL) ────────────────────────────────────────────────

export const DOC_BLOCK_LABELS: Record<DocBlockKind, string> = {
  heading: 'Nagłówek',
  paragraph: 'Akapit',
  bullets: 'Lista punktowana',
  table: 'Tabela',
  kpi: 'Pasek KPI',
  chart: 'Wykres',
};

export const SLIDE_ARCHETYPE_LABELS: Record<SlideArchetype, string> = {
  cover: 'Okładka',
  agenda: 'Agenda',
  section: 'Przekładka sekcji',
  content: 'Treść',
  'two-column': 'Dwie kolumny',
  kpi: 'Pasek KPI',
  chart: 'Wykres',
  quote: 'Cytat',
  closing: 'Zamknięcie',
};

export const SHEET_COLUMN_TYPE_LABELS: Record<SheetColumnType, string> = {
  text: 'Tekst',
  number: 'Liczba',
  currency: 'Waluta',
  percent: 'Procent',
  date: 'Data',
  formula: 'Formuła',
};

export const DEPTH_LABELS: Record<TemplateDepth, string> = {
  short: 'Krótko',
  medium: 'Średnio',
  long: 'Szczegółowo',
};

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  doc: 'Dokument (Word)',
  deck: 'Prezentacja (Deck)',
  table: 'Arkusz (Excel)',
};

export const SCOPE_LABELS: Record<TemplateScope, string> = {
  org: 'Organizacja',
  private: 'Prywatny',
};

// ── Fabryki elementów ──────────────────────────────────────────────────────

export function newDocSection(): DocSection {
  return {
    id: nextId('sec'),
    title: 'Nowa sekcja',
    block: 'paragraph',
    depth: 'medium',
    hint: '',
    aiFilled: true,
  };
}

export function newDeckSlide(): DeckSlide {
  return {
    id: nextId('slide'),
    title: 'Nowy slajd',
    archetype: 'content',
    hint: '',
    aiFilled: true,
  };
}

export function newSheetColumn(): SheetColumn {
  return { id: nextId('col'), name: 'Nowa kolumna', type: 'text', formula: '' };
}

export function emptyDraft(type: TemplateType, name: string, scope: TemplateScope): TemplateDraft {
  return {
    type,
    name,
    description: '',
    scope,
    themeRef: null,
    doc: type === 'doc' ? [newDocSection()] : [],
    deck: type === 'deck' ? [newDeckSlide()] : [],
    table: type === 'table' ? [newSheetColumn()] : [],
  };
}

// ── Serializacja do kontraktu POST /api/deliverables/templates ─────────────

export interface TemplatePostBody {
  type: TemplateType;
  name: string;
  description: string;
  meta: Record<string, unknown>;
}

export function draftToPostBody(draft: TemplateDraft): TemplatePostBody {
  const base = {
    type: draft.type,
    name: draft.name.trim(),
    description: draft.description.trim(),
  };
  if (draft.type === 'doc') {
    return {
      ...base,
      meta: {
        sections_json: draft.doc.map((s) => ({
          title: s.title,
          block: s.block,
          depth: s.depth,
          hint: s.hint,
          ai_filled: s.aiFilled,
        })),
        theme_ref: draft.themeRef,
        scope: draft.scope,
      },
    };
  }
  if (draft.type === 'deck') {
    return {
      ...base,
      meta: {
        outline_json: draft.deck.map((s) => ({
          title: s.title,
          archetype: s.archetype,
          hint: s.hint,
          ai_filled: s.aiFilled,
        })),
        theme_ref: draft.themeRef,
        scope: draft.scope,
      },
    };
  }
  return {
    ...base,
    meta: {
      schema_snapshot: {
        columns: draft.table.map((c) => ({
          name: c.name,
          type: c.type,
          formula: c.type === 'formula' ? c.formula : undefined,
        })),
      },
      theme_ref: draft.themeRef,
      scope: draft.scope,
    },
  };
}

/** Liczba elementów struktury aktualnego typu. */
export function elementCount(draft: TemplateDraft): number {
  if (draft.type === 'doc') return draft.doc.length;
  if (draft.type === 'deck') return draft.deck.length;
  return draft.table.length;
}
