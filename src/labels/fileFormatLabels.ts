const FILE_FORMAT_LABELS = {
  DOCX: { pl: 'DOCX', en: 'DOCX' },
  PDF: { pl: 'PDF', en: 'PDF' },
  XLSX: { pl: 'XLSX', en: 'XLSX' },
  PPTX: { pl: 'PPTX', en: 'PPTX' },
  UNKNOWN: { pl: '—', en: '—' },
} as const;

export function fileFormatLabel(value: string | null | undefined, isPolish: boolean): string {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  const labels = FILE_FORMAT_LABELS[normalized as keyof typeof FILE_FORMAT_LABELS];
  const locale = isPolish ? 'pl' : 'en';
  return labels?.[locale] ?? '—';
}

export const fileFormatLabelEntries = FILE_FORMAT_LABELS;
