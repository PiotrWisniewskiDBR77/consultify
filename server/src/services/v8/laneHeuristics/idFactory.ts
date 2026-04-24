function normalizePart(value: string | number | boolean | null | undefined): string {
  return (
    String(value ?? 'na')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'na'
  );
}

export function stableHeuristicId(
  prefix: string,
  ...parts: Array<string | number | boolean | null | undefined>
) {
  return [prefix, ...parts.map(normalizePart)].join(':');
}
