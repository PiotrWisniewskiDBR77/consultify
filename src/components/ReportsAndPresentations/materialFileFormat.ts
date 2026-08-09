export const MATERIAL_FILE_FORMATS = ['DOCX', 'PDF', 'XLSX', 'PPTX', 'Unknown'] as const;

export type MaterialFileFormat = (typeof MATERIAL_FILE_FORMATS)[number];

type MaterialFormatSource = {
  exportFormat?: unknown;
  export_format?: unknown;
  fileFormat?: unknown;
  file_format?: unknown;
  mimeType?: unknown;
  mime_type?: unknown;
  filename?: unknown;
  fileName?: unknown;
  path?: unknown;
  title?: unknown;
  originSummary?: unknown;
};

const FORMAT_ALIASES: Readonly<Record<string, Exclude<MaterialFileFormat, 'Unknown'>>> = {
  docx: 'DOCX',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  pdf: 'PDF',
  'application/pdf': 'PDF',
  xlsx: 'XLSX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  pptx: 'PPTX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
};

function explicitFormat(value: unknown): MaterialFileFormat | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/^\./, '');
  return FORMAT_ALIASES[normalized] || null;
}

function formatFromFilename(value: unknown): MaterialFileFormat | null {
  if (typeof value !== 'string') return null;
  const match = value
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)(?:[?#].*)?$/);
  return match ? explicitFormat(match[1]) : null;
}

/**
 * Resolves the persisted material format without guessing from a generic
 * document/presentation/sheet kind. Explicit format and MIME win; filenames
 * are the final trustworthy fallback. Unknown is intentionally visible.
 */
export function resolveMaterialFileFormat(raw: MaterialFormatSource): MaterialFileFormat {
  const summary =
    raw.originSummary && typeof raw.originSummary === 'object'
      ? (raw.originSummary as Record<string, unknown>)
      : {};

  const explicitCandidates = [
    raw.fileFormat,
    raw.file_format,
    raw.exportFormat,
    raw.export_format,
    raw.mimeType,
    raw.mime_type,
    summary.fileFormat,
    summary.exportFormat,
    summary.mimeType,
  ];
  for (const candidate of explicitCandidates) {
    const resolved = explicitFormat(candidate);
    if (resolved) return resolved;
  }

  const filenameCandidates = [
    raw.filename,
    raw.fileName,
    raw.path,
    raw.title,
    summary.filename,
    summary.fileName,
    summary.path,
    summary.storagePath,
  ];
  for (const candidate of filenameCandidates) {
    const resolved = formatFromFilename(candidate);
    if (resolved) return resolved;
  }

  return 'Unknown';
}

export function compareMaterialFileFormats(a: MaterialFileFormat, b: MaterialFileFormat): number {
  return MATERIAL_FILE_FORMATS.indexOf(a) - MATERIAL_FILE_FORMATS.indexOf(b);
}
