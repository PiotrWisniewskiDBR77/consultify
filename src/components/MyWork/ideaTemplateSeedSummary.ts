/**
 * ideaTemplateSeedSummary — opis kształtu seeda jednego szablonu idei.
 *
 * POWÓD ISTNIENIA (pomiar na żywo 05.09, `idea-templates-catalog`):
 * zatwierdzony katalog pokazuje na każdej karcie linię licznika
 * („9 sekcji", „6 kolumn · 5 wierszy", „6 gałęzi", „2 pasy · 7 kroków")
 * oraz plakietki z nazwami sekcji/kolumn/gałęzi. Aplikacja renderowała
 * wyłącznie nazwę i opis, więc z galerii nie dało się poznać, co szablon
 * naprawdę wstawi na kanwę.
 *
 * Liczby czytamy z REALNEGO seeda szablonu (nodes/edges/extensions), nie z
 * osobnego, ręcznie pisanego pola — pole opisowe rozjechałoby się z seedem
 * przy pierwszej edycji szablonu i katalog kłamałby o zawartości.
 */

export type IdeaTemplateTool = 'whiteboard' | 'mindmap' | 'process_flow' | 'table';

export interface IdeaTemplateSeedInput {
  tool: IdeaTemplateTool | string;
  nodes?: unknown[];
  extensions?: Record<string, unknown> | null;
}

export interface IdeaTemplateSeedSummary {
  /** Liczniki w kolejności wyświetlania, np. [{count: 6, unit: 'columns'}, …]. */
  counts: { count: number; unit: 'sections' | 'branches' | 'columns' | 'rows' | 'lanes' | 'steps' }[];
  /** Nazwy sekcji / kolumn / gałęzi / pasów — plakietki na karcie. */
  chips: string[];
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const labelOf = (node: unknown): string | null => {
  const data = asRecord(asRecord(node)?.data);
  const label = data?.label;
  return typeof label === 'string' && label.trim() ? label.trim() : null;
};

const typeOf = (node: unknown): string => {
  const type = asRecord(node)?.type;
  return typeof type === 'string' ? type : '';
};

/**
 * Zwraca liczniki i plakietki dla jednej definicji szablonu.
 *
 * Pusty seed (brak węzłów i rozszerzeń) daje puste `counts` i `chips` —
 * karta ma wtedy uczciwie NIC nie pokazywać, zamiast rysować „0 sekcji"
 * sugerujące, że szablon jest pusty z defektu.
 */
export function summarizeIdeaTemplateSeed(
  template: IdeaTemplateSeedInput
): IdeaTemplateSeedSummary {
  const nodes = Array.isArray(template.nodes) ? template.nodes : [];
  const extensions = asRecord(template.extensions);

  if (template.tool === 'table') {
    const table = asRecord(extensions?.table);
    const columns = Array.isArray(table?.columns) ? (table!.columns as unknown[]) : [];
    const counts: IdeaTemplateSeedSummary['counts'] = [];
    if (columns.length) counts.push({ count: columns.length, unit: 'columns' });
    if (nodes.length) counts.push({ count: nodes.length, unit: 'rows' });
    return {
      counts,
      chips: columns
        .map((column) => {
          const header = asRecord(column)?.header;
          return typeof header === 'string' && header.trim() ? header.trim() : null;
        })
        .filter((header): header is string => !!header),
    };
  }

  if (template.tool === 'process_flow') {
    const processFlow = asRecord(extensions?.processFlow);
    const lanes = Array.isArray(processFlow?.lanes) ? (processFlow!.lanes as unknown[]) : [];
    const steps = nodes.filter((node) => typeOf(node) === 'flowNode');
    const counts: IdeaTemplateSeedSummary['counts'] = [];
    if (lanes.length) counts.push({ count: lanes.length, unit: 'lanes' });
    if (steps.length) counts.push({ count: steps.length, unit: 'steps' });
    return {
      counts,
      chips: steps.map(labelOf).filter((label): label is string => !!label),
    };
  }

  if (template.tool === 'mindmap') {
    const branches = nodes.filter((node) => typeOf(node) === 'branch');
    return {
      counts: branches.length ? [{ count: branches.length, unit: 'branches' }] : [],
      chips: branches.map(labelOf).filter((label): label is string => !!label),
    };
  }

  // whiteboard — sekcje to ramki (`frameNode`); naklejki są podpowiedziami
  // w środku ramek i nie są osobną sekcją.
  const frames = nodes.filter((node) => typeOf(node) === 'frameNode');
  return {
    counts: frames.length ? [{ count: frames.length, unit: 'sections' }] : [],
    chips: frames.map(labelOf).filter((label): label is string => !!label),
  };
}
