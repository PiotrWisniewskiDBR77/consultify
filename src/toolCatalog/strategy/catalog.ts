const STRATEGY_TOOL_DOCS: Record<string, string> = {};

export function listStrategyToolSlugs(): string[] {
  return Object.keys(STRATEGY_TOOL_DOCS);
}

export function hasStrategyToolDoc(slug: string): boolean {
  return Boolean(STRATEGY_TOOL_DOCS[String(slug || '').trim().toLowerCase()]);
}

export async function loadStrategyToolDocMarkdown(slug: string): Promise<string> {
  return STRATEGY_TOOL_DOCS[String(slug || '').trim().toLowerCase()] || '';
}
