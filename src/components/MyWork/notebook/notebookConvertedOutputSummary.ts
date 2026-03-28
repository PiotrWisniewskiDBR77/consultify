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

  const uniqueTypes = Array.from(new Set(normalized));
  const limit = Math.max(1, visibleLimit);

  return {
    total: uniqueTypes.length,
    visibleTypes: uniqueTypes.slice(0, limit),
    extraCount: Math.max(0, uniqueTypes.length - limit),
  };
}
