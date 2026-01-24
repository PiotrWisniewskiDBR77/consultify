/**
 * AuditExportPanel - Export audit logs and compliance reports
 */

import { Calendar, Download, FileText } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

export const AuditExportPanel: React.FC = () => {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // TODO: Implement actual export
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(`Audit log exported as ${exportFormat.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-navy-800 rounded-xl border border-white/10 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-primary-400" />
        <h3 className="text-lg font-semibold text-white">Export Audit Logs</h3>
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
            className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">End Date</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white"
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
                  ? 'bg-primary-500 text-white'
                  : 'bg-navy-900 text-slate-400 dark:text-slate-500 hover:text-white'
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
        className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        {isExporting ? 'Exporting...' : 'Export'}
      </button>
    </div>
  );
};

export default AuditExportPanel;
