/**
 * CSV import/export utilities for the Idea Table.
 */
import type { ColumnDef, TableNode } from './tableTypes';

export function exportToCSV(columns: ColumnDef[], nodes: TableNode[]): string {
  const visibleCols = columns.filter((c) => c.visible);
  const headers = visibleCols.map((c) => escapeCSV(c.header));
  const rows = nodes.map((node) =>
    visibleCols.map((col) => {
      const val = col.key === 'type' ? node.type || '' : (node.data?.[col.key] ?? '');
      if (Array.isArray(val)) return escapeCSV(val.join('; '));
      return escapeCSV(String(val));
    })
  );
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

export function csvToNodes(
  headers: string[],
  rows: string[][],
  existingColumns: ColumnDef[]
): { nodes: TableNode[]; newColumns: ColumnDef[] } {
  const colMap = new Map(existingColumns.map((c) => [c.header.toLowerCase(), c]));
  const newColumns: ColumnDef[] = [];

  for (const header of headers) {
    if (!colMap.has(header.toLowerCase()) && header.toLowerCase() !== 'type') {
      const key = header
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      newColumns.push({
        key: key || `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        header,
        type: 'text',
        visible: true,
        width: 160,
      });
    }
  }

  const allCols = [...existingColumns, ...newColumns];
  const headerToKey = new Map<string, string>();
  for (const col of allCols) {
    headerToKey.set(col.header.toLowerCase(), col.key);
  }

  const nodes: TableNode[] = rows.map((row, idx) => {
    const data: Record<string, any> = {};
    headers.forEach((h, i) => {
      const key = headerToKey.get(h.toLowerCase());
      if (key && row[i] !== undefined) {
        data[key] = row[i];
      }
    });
    if (!data.label) {
      data.label = row[0] || `Row ${idx + 1}`;
    }
    return {
      id: `csv-${Date.now()}-${idx}`,
      type: data.type || 'idea',
      data,
      position: { x: 0, y: 0 },
    };
  });

  return { nodes, newColumns };
}

export function copyTableToClipboard(columns: ColumnDef[], nodes: TableNode[]) {
  const visibleCols = columns.filter((c) => c.visible);
  const headers = visibleCols.map((c) => c.header);
  const rows = nodes.map((node) =>
    visibleCols.map((col) => {
      const val = col.key === 'type' ? node.type || '' : (node.data?.[col.key] ?? '');
      return Array.isArray(val) ? val.join('; ') : String(val);
    })
  );
  const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
  navigator.clipboard.writeText(tsv).catch(() => undefined);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
