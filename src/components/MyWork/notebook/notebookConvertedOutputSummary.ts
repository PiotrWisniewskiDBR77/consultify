export interface NotebookConvertedOutputEntry {
  type?: string | null;
  id?: string | null;
}

export interface NotebookConvertedOutputSummary {
  total: number;
  visibleTypes: string[];
  extraCount: number;
}

export function getNotebookConvertedOutputSummary(
  convertedTo: NotebookConvertedOutputEntry[] | null | undefined,
  visibleLimit = 2
): NotebookConvertedOutputSummary {
  const normalized = (convertedTo || [])
    .map((entry) => String(entry?.type || '').trim())
    .filter(Boolean);

  const limit = Math.max(1, visibleLimit);
  const counts = new Map<string, number>();
  const orderedTypes: string[] = [];

  normalized.forEach((type) => {
    if (!counts.has(type)) orderedTypes.push(type);
    counts.set(type, (counts.get(type) || 0) + 1);
  });

  const visibleTypes = orderedTypes.slice(0, limit).map((type) => {
    const count = counts.get(type) || 0;
    return count > 1 ? `${type} ×${count}` : type;
  });

  return {
    total: normalized.length,
    visibleTypes,
    extraCount: Math.max(0, orderedTypes.length - limit),
  };
}
