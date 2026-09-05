import { describe, expect, it } from 'vitest';
import { fileFormatLabel, fileFormatLabelEntries } from '../fileFormatLabels';

describe('fileFormatLabel', () => {
  it('maps every supported material format in Polish and English', () => {
    expect(fileFormatLabelEntries).toEqual({
      DOCX: { pl: 'DOCX', en: 'DOCX' },
      PDF: { pl: 'PDF', en: 'PDF' },
      XLSX: { pl: 'XLSX', en: 'XLSX' },
      PPTX: { pl: 'PPTX', en: 'PPTX' },
      UNKNOWN: { pl: '—', en: '—' },
    });
    expect(fileFormatLabel('DOCX', true)).toBe('DOCX');
    expect(fileFormatLabel('PDF', false)).toBe('PDF');
    expect(fileFormatLabel('Unknown', true)).toBe('—');
  });

  it('never exposes an unknown raw format', () => {
    expect(fileFormatLabel('FUTURE_FORMAT', true)).toBe('—');
    expect(fileFormatLabel('FUTURE_FORMAT', false)).toBe('—');
  });
});
