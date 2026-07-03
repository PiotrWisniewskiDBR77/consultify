/**
 * AuditExportPanel - Export audit logs and compliance reports
 */

import { Download, FileText } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

import { getHeaders } from '../../services/api';

export const AuditExportPanel: React.FC = () => {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  const toCsv = (rows: Record<string, unknown>[]) => {
    if (!rows.length) return '';
    const headers = Array.from(
      rows.reduce<Set<string>>((acc, row) => {
        Object.keys(row).forEach((k) => acc.add(k));
        return acc;
      }, new Set<string>())
    );
    const escapeCell = (value: unknown) => {
      if (value == null) return '';
      const str =
        typeof value === 'object' ? JSON.stringify(value) : String(value).replace(/\r?\n/g, ' ');
      if (str.includes('"') || str.includes(',') || str.includes(';')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const lines = [
      headers.join(','),
      ...rows.map((row) => headers.map((key) => escapeCell(row[key])).join(',')),
    ];
    return lines.join('\n');
  };

  const triggerDownload = (content: string, mimeType: string, extension: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const query = new URLSearchParams();
      if (dateRange.start) query.set('startDate', dateRange.start);
      if (dateRange.end) query.set('endDate', dateRange.end);
      const qs = query.toString();
      const res = await fetch(`/api/admin/export/audit${qs ? `?${qs}` : ''}`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        throw new Error('Audit export endpoint is unavailable');
      }
      const rows = await res.json();
      const normalizedRows = Array.isArray(rows) ? rows : [];

      if (exportFormat === 'json') {
        triggerDownload(JSON.stringify(normalizedRows, null, 2), 'application/json', 'json');
      } else if (exportFormat === 'csv') {
        triggerDownload(toCsv(normalizedRows), 'text/csv', 'csv');
      } else {
        // Browser-native PDF flow avoids fake backend placeholders.
        window.print();
      }

      toast.success(`Audit log exported as ${exportFormat.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-primary-400" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Export Audit Logs</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
            Start Date
          </label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">End Date</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
          Export Format
        </label>
        <div className="flex gap-3">
          {(['csv', 'json', 'pdf'] as const).map((format) => (
            <button
              key={format}
              onClick={() => setExportFormat(format)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                exportFormat === format
                  ? 'bg-c-text text-c-bg'
                  : 'bg-white dark:bg-navy-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-c-text text-c-bg hover:bg-c-text-secondary rounded-lg transition-colors disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        {isExporting ? 'Exporting...' : 'Export'}
      </button>
    </div>
  );
};

export default AuditExportPanel;
