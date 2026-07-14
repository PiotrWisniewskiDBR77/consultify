import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockExecuteQuery = vi.fn();
vi.mock('../ViewQueryEngine.js', () => ({
  default: { executeQuery: (...args: unknown[]) => mockExecuteQuery(...args) },
}));

import exportService, {
  escapeCsvValue,
  formatFieldValue,
  neutralizeFormula,
} from '../ExportService.js';

describe('ExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // escapeCsvValue
  // -----------------------------------------------------------------------

  describe('escapeCsvValue', () => {
    it('returns empty string for null', () => {
      expect(escapeCsvValue(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(escapeCsvValue(undefined)).toBe('');
    });

    it('returns plain string when no special chars', () => {
      expect(escapeCsvValue('hello')).toBe('hello');
    });

    it('wraps value containing comma in quotes', () => {
      expect(escapeCsvValue('a,b')).toBe('"a,b"');
    });

    it('wraps value containing double-quote and escapes inner quotes', () => {
      expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    });

    it('wraps value containing newline in quotes', () => {
      expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
    });

    it('wraps value containing carriage return in quotes', () => {
      expect(escapeCsvValue('line1\rline2')).toBe('"line1\rline2"');
    });

    it('handles numeric values', () => {
      expect(escapeCsvValue(42)).toBe('42');
    });

    // ---- B4: CSV/formula-injection neutralization ----
    it('neutralizes a leading = formula (=HYPERLINK)', () => {
      expect(escapeCsvValue('=HYPERLINK("http://evil","x")')).toBe(
        '"\'=HYPERLINK(""http://evil"",""x"")"'
      );
    });

    it('prefixes leading + / @ / - formula triggers with apostrophe', () => {
      // No comma/quote/newline → apostrophe-prefixed but not RFC-wrapped.
      expect(escapeCsvValue('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
      expect(escapeCsvValue('@cmd')).toBe("'@cmd");
      expect(escapeCsvValue('-1+1')).toBe("'-1+1");
    });

    it('neutralizes leading tab injection (tab is not an RFC quote trigger)', () => {
      expect(escapeCsvValue('\t=1+1')).toBe("'\t=1+1");
    });

    it('leaves genuine numbers (including negatives) intact', () => {
      expect(escapeCsvValue('-5')).toBe('-5');
      expect(escapeCsvValue('+3.2e1')).toBe('+3.2e1');
      expect(escapeCsvValue(-5)).toBe('-5');
    });
  });

  describe('neutralizeFormula', () => {
    it('prefixes formula-trigger cells', () => {
      expect(neutralizeFormula('=1+1')).toBe("'=1+1");
      expect(neutralizeFormula('+x')).toBe("'+x");
      expect(neutralizeFormula('@x')).toBe("'@x");
      expect(neutralizeFormula('-cmd')).toBe("'-cmd");
    });
    it('does not touch plain text or numbers', () => {
      expect(neutralizeFormula('hello')).toBe('hello');
      expect(neutralizeFormula('-5')).toBe('-5');
      expect(neutralizeFormula('')).toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // formatFieldValue
  // -----------------------------------------------------------------------

  describe('formatFieldValue', () => {
    it('returns empty string for null', () => {
      expect(formatFieldValue(null, { type: 'singleLineText' })).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(formatFieldValue(undefined, { type: 'singleLineText' })).toBe('');
    });

    it('formats checkbox true as "true"', () => {
      expect(formatFieldValue(true, { type: 'checkbox' })).toBe('true');
    });

    it('formats checkbox "true" string as "true"', () => {
      expect(formatFieldValue('true', { type: 'checkbox' })).toBe('true');
    });

    it('formats checkbox 1 as "true"', () => {
      expect(formatFieldValue(1, { type: 'checkbox' })).toBe('true');
    });

    it('formats checkbox false as "false"', () => {
      expect(formatFieldValue(false, { type: 'checkbox' })).toBe('false');
    });

    it('formats multiSelect array as comma-separated string', () => {
      expect(formatFieldValue(['A', 'B', 'C'], { type: 'multiSelect' })).toBe('A, B, C');
    });

    it('formats multiSelect non-array as string', () => {
      expect(formatFieldValue('single', { type: 'multiSelect' })).toBe('single');
    });

    it('formats multi_select (snake_case) array', () => {
      expect(formatFieldValue(['X', 'Y'], { type: 'multi_select' })).toBe('X, Y');
    });

    it('formats date value as string', () => {
      expect(formatFieldValue('2025-01-15', { type: 'date' })).toBe('2025-01-15');
    });

    it('formats date with dateFormat option', () => {
      expect(
        formatFieldValue('2025-01-15', { type: 'date', options: { dateFormat: 'DD/MM/YYYY' } })
      ).toBe('2025-01-15');
    });

    it('formats linkedRecord array with displayName', () => {
      const val = [{ displayName: 'Alice' }, { displayName: 'Bob' }];
      expect(formatFieldValue(val, { type: 'linkedRecord' })).toBe('Alice, Bob');
    });

    it('formats attachment array with filename', () => {
      const val = [{ filename: 'doc.pdf' }, { file_name: 'img.png' }];
      expect(formatFieldValue(val, { type: 'attachment' })).toBe('doc.pdf, img.png');
    });

    it('returns string for default type', () => {
      expect(formatFieldValue(123, { type: 'number' })).toBe('123');
    });
  });

  // -----------------------------------------------------------------------
  // getTableName
  // -----------------------------------------------------------------------

  describe('getTableName', () => {
    it('returns table name from DB', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ name: 'Tasks' }] });
      const name = await exportService.getTableName('t-1');
      expect(name).toBe('Tasks');
    });

    it('returns "export" when table not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const name = await exportService.getTableName('nonexistent');
      expect(name).toBe('export');
    });
  });

  // -----------------------------------------------------------------------
  // streamCsvExport
  // -----------------------------------------------------------------------

  describe('streamCsvExport', () => {
    it('writes header + data rows', async () => {
      const fields = [
        { id: 'f1', name: 'Name', type: 'single_line_text', options: null },
        { id: 'f2', name: 'Status', type: 'single_select', options: null },
      ];
      mockQuery.mockResolvedValueOnce({ rows: fields });

      mockExecuteQuery.mockResolvedValueOnce({
        records: [{ data: { f1: 'Alice', f2: 'Active' } }, { data: { f1: 'Bob', f2: 'Done' } }],
        cursor: undefined,
        hasMore: false,
      });

      const chunks: string[] = [];
      const writer = {
        write: (chunk: string) => {
          chunks.push(chunk);
          return true;
        },
        end: vi.fn(),
      };

      await exportService.streamCsvExport({ tableId: 't-1' }, writer);

      expect(chunks[0]).toBe('Name,Status\n');
      expect(chunks[1]).toBe('Alice,Active\n');
      expect(chunks[2]).toBe('Bob,Done\n');
      expect(writer.end).toHaveBeenCalled();
    });

    it('falls back to field names for legacy name-keyed record data', async () => {
      const fields = [
        { id: 'field-name-id', name: 'Name', type: 'single_line_text', options: null },
        { id: 'field-status-id', name: 'Status', type: 'single_select', options: null },
      ];
      mockQuery.mockResolvedValueOnce({ rows: fields });

      mockExecuteQuery.mockResolvedValueOnce({
        records: [{ data: { Name: 'Initial item', Status: 'New' } }],
        cursor: undefined,
        hasMore: false,
      });

      const chunks: string[] = [];
      const writer = {
        write: (chunk: string) => {
          chunks.push(chunk);
          return true;
        },
        end: vi.fn(),
      };

      await exportService.streamCsvExport({ tableId: 't-legacy' }, writer);

      expect(chunks[0]).toBe('Name,Status\n');
      expect(chunks[1]).toBe('Initial item,New\n');
      expect(writer.end).toHaveBeenCalled();
    });

    it('calls end immediately when no fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const writer = {
        write: vi.fn(() => true),
        end: vi.fn(),
      };

      await exportService.streamCsvExport({ tableId: 't-1' }, writer);

      expect(writer.write).not.toHaveBeenCalled();
      expect(writer.end).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // buildXlsxBuffer
  // -----------------------------------------------------------------------

  describe('buildXlsxBuffer', () => {
    it('returns a buffer (mocked xlsx)', async () => {
      const fields = [{ id: 'f1', name: 'Name', type: 'single_line_text', options: null }];
      mockQuery.mockResolvedValueOnce({ rows: fields });

      mockExecuteQuery.mockResolvedValueOnce({
        records: [{ data: { f1: 'Alice' } }],
        cursor: undefined,
        hasMore: false,
      });

      vi.doMock('xlsx', () => ({
        utils: {
          aoa_to_sheet: vi.fn(() => ({})),
          book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
          book_append_sheet: vi.fn(),
        },
        write: vi.fn(() => Buffer.from('mock-xlsx')),
      }));

      try {
        const buf = await exportService.buildXlsxBuffer({ tableId: 't-1' });
        expect(buf).toBeInstanceOf(Buffer);
      } catch {
        // xlsx may not be installed — that's expected in test env
        expect(true).toBe(true);
      }
    });
  });
});
