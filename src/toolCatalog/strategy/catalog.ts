type MarkdownLoader = () => Promise<string>;

/**
 * Strategy tool documentation catalog (docs-driven).
 *
 * Source of truth: `wdrozenia/modules/tools/catalog/strategy/*.md`
 *
 * Note: This is intentionally loaded on-demand (code-splitting) to avoid pulling the entire
 * catalog into the initial bundle.
 */
const STRATEGY_MD_LOADERS = import.meta.glob(
  '../../../wdrozenia/modules/tools/catalog/strategy/*.md',
  { as: 'raw' }
) as Record<string, MarkdownLoader>;

const byFilenameBase: Record<string, MarkdownLoader> = Object.fromEntries(
  Object.entries(STRATEGY_MD_LOADERS).map(([path, loader]) => {
    const file = path.split('/').pop() || path;
    const base = file.replace(/\.md$/i, '');
    return [base, loader];
  })
);

export function hasStrategyToolDoc(slug: string): boolean {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  return Boolean(byFilenameBase[key]);
}

export function listStrategyToolSlugs(): string[] {
  return Object.keys(byFilenameBase).sort();
}

export async function loadStrategyToolDocMarkdown(slug: string): Promise<string | null> {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  const loader = byFilenameBase[key];
  if (!loader) return null;
  return await loader();
}
