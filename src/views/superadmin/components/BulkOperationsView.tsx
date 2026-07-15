/**
 * BulkOperationsView - Admin Bulk Operations
 *
 * Enterprise bulk operations:
 * - CSV user import
 * - Bulk role assignment
 * - Mass email campaigns
 * - Bulk data export
 */

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Settings,
  Shield,
  Upload,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { InfoButton } from '../../../components/shared/InfoButton';
import { StandardTable, type TableColumn, type TableRow } from '../../../components/standard';
import { EntityStatusChip } from '../../../components/ui/primitives/chips/EntityStatusChip';
import { Api } from '../../../services/api';

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; email: string; error: string }[];
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

type TabType = 'import' | 'roles' | 'email' | 'export';
type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

const CSV_TEMPLATE = `email,firstName,lastName,role
john.doe@example.com,John,Doe,USER
jane.smith@example.com,Jane,Smith,ADMIN`;

// canon TRIADA §27 — StandardTable columns for the Bulk Roles user list.
// Selection checkbox is auto-prepended by StandardTable (MUST #7); it is
// intentionally NOT declared here.
const buildUserColumns = (): TableColumn[] => [
  {
    id: 'user',
    label: 'User',
    sortable: true,
    sortAccessor: (row: TableRow) => {
      const user = row as unknown as User;
      return `${user.firstName} ${user.lastName}`.trim() || user.email;
    },
    render: (row: TableRow) => {
      const user = row as unknown as User;
      return (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-medium text-sm">
            {user.firstName?.charAt(0) || user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-c-text">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-sm text-c-text-muted">{user.email}</div>
          </div>
        </div>
      );
    },
  },
  {
    id: 'role',
    label: 'Role',
    filterable: true,
    filterOptions: [
      { value: 'USER', label: 'User' },
      { value: 'ADMIN', label: 'Admin' },
      { value: 'OWNER', label: 'Owner' },
    ],
    render: (row: TableRow) => {
      const role = (row as unknown as User).role;
      return (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            role === 'ADMIN'
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : role === 'OWNER'
                ? 'bg-c-accent-soft text-c-accent'
                : 'bg-slate-500/10 text-c-text-secondary'
          }`}
        >
          {role}
        </span>
      );
    },
  },
  {
    id: 'status',
    label: 'Status',
    render: (row: TableRow) => <EntityStatusChip status={(row as unknown as User).status} />,
  },
];

export const BulkOperationsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('import');
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importRequestError, setImportRequestError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mass email
  const [emailForm, setEmailForm] = useState({
    recipientType: 'all' as 'all' | 'admins',
    template: '',
    subject: '',
    message: '',
  });
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Export
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const userColumns = useMemo(() => buildUserColumns(), []);

  const REQUIRED_FIELDS = ['email'];
  const OPTIONAL_FIELDS = ['firstName', 'lastName', 'role'];
  const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());
      const headers = lines[0].split(',').map((h) => h.trim());
      const data = lines.slice(1).map((line) => {
        const values = line.split(',');
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx]?.trim() || '';
        });
        return row;
      });

      setCsvHeaders(headers);
      setCsvData(data);

      // Auto-map matching columns
      const autoMapping: Record<string, string> = {};
      ALL_FIELDS.forEach((field) => {
        const matchingHeader = headers.find(
          (h) =>
            h.toLowerCase() === field.toLowerCase() ||
            h.toLowerCase().replace(/[_\s]/g, '') === field.toLowerCase()
        );
        if (matchingHeader) {
          autoMapping[field] = matchingHeader;
        }
      });
      setColumnMapping(autoMapping);

      setImportStep('mapping');
    };
    reader.readAsText(file);
  };

  const handleStartImport = async () => {
    setImporting(true);
    setImportStep('importing');
    setImportRequestError(null);

    try {
      const mappedData = csvData.map((row) => {
        const mappedRow: Record<string, string> = {};
        Object.entries(columnMapping).forEach(([field, csvColumn]) => {
          mappedRow[field] = row[csvColumn] || '';
        });
        return mappedRow;
      });

      const result = await Api.post('/api/admin/users/bulk-import', { users: mappedData });
      setImportResult(result);
      setImportStep('complete');
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult(null);
      setImportRequestError(error instanceof Error ? error.message : 'Import request failed');
      setImportStep('complete');
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setCsvFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setImportResult(null);
    setImportRequestError(null);
    setImportStep('upload');
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      setUsersLoadError(null);
      const result = await Api.get('/api/admin/users');
      setUsers(result.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
      setUsersLoadError(error instanceof Error ? error.message : 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const handleBulkRoleAssignment = async (newRole: string) => {
    try {
      await Api.post('/api/admin/users/bulk-role', {
        userIds: selectedUsers,
        role: newRole,
      });
      setSelectedUsers([]);
      fetchUsers();
    } catch (error) {
      console.error('Failed to update roles:', error);
      toast.error('Failed to update user roles');
    }
  };

  const parseContentDispositionFilename = (headerValue: string | null): string | null => {
    if (!headerValue) return null;
    const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(
      headerValue
    );
    const raw = decodeURIComponent(match?.[1] || match?.[2] || match?.[3] || '');
    return raw ? raw.trim() : null;
  };

  const downloadWithAuth = async (url: string, fallbackName: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.error || 'Export failed');
    }

    const blob = await res.blob();
    const filename =
      parseContentDispositionFilename(res.headers.get('content-disposition')) || fallbackName;
    const objectUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleSendMassEmail = async () => {
    if (!emailForm.subject.trim() || !emailForm.message.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    setSendingEmail(true);
    try {
      const result = await Api.post('/api/admin/users/bulk-email', {
        recipientType: emailForm.recipientType,
        subject: emailForm.subject.trim(),
        message: emailForm.message.trim(),
      });
      toast.success(
        typeof result?.queued === 'number'
          ? `Emails queued: ${result.queued}`
          : result?.message || 'Emails queued'
      );
      setEmailPreviewOpen(false);
      setEmailForm({ recipientType: 'all', template: '', subject: '', message: '' });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleExport = async (key: 'users' | 'activity' | 'audit' | 'settings') => {
    setExportingKey(key);
    try {
      const ts = Date.now();
      const fallbackName =
        key === 'users'
          ? `users_export_${ts}.csv`
          : key === 'settings'
            ? `settings_export_${ts}.json`
            : `${key}_log_${ts}.json`;
      await downloadWithAuth(`/api/admin/export/${key}`, fallbackName);
      toast.success('Export downloaded');
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setExportingKey(null);
    }
  };

  const renderImportTab = () => (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[
          { step: 'upload', label: 'Upload' },
          { step: 'mapping', label: 'Map Columns' },
          { step: 'preview', label: 'Preview' },
          { step: 'complete', label: 'Complete' },
        ].map((s, idx) => (
          <React.Fragment key={s.step}>
            <div
              className={`flex items-center gap-2 ${
                importStep === s.step
                  ? 'text-primary-600'
                  : ['upload', 'mapping', 'preview', 'complete'].indexOf(importStep) > idx
                    ? 'text-emerald-600'
                    : 'text-c-text-secondary'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  importStep === s.step
                    ? 'bg-primary-100 dark:bg-primary-500/20'
                    : ['upload', 'mapping', 'preview', 'complete'].indexOf(importStep) > idx
                      ? 'bg-emerald-100 dark:bg-emerald-500/20'
                      : 'bg-c-surface-raised'
                }`}
              >
                {['upload', 'mapping', 'preview', 'complete'].indexOf(importStep) > idx ? (
                  <CheckCircle2 size={16} />
                ) : (
                  idx + 1
                )}
              </div>
              <span className="text-sm font-medium">{s.label}</span>
            </div>
            {idx < 3 && <ChevronRight size={16} className="text-c-text-secondary" />}
          </React.Fragment>
        ))}
      </div>

      {/* Upload Step */}
      {importStep === 'upload' && (
        <div className="bg-c-surface rounded-xl p-8 border border-c-border-subtle">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center">
              <Upload className="text-primary-600" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-c-text mb-2">Upload CSV File</h3>
            <p className="text-c-text-muted mb-6">
              Import users from a CSV file. Download our template for the correct format.
            </p>

            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium flex items-center gap-2"
              >
                <Upload size={18} />
                Select CSV File
              </button>
              <button
                onClick={downloadTemplate}
                className="px-6 py-3 border border-c-border-subtle rounded-lg text-c-text-secondary hover:bg-c-bg dark:hover:bg-c-surface/5 flex items-center gap-2"
              >
                <Download size={18} />
                Download Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mapping Step */}
      {importStep === 'mapping' && (
        <div className="bg-c-surface rounded-xl p-6 border border-c-border-subtle">
          <h3 className="text-lg font-semibold text-c-text mb-4">Map CSV Columns</h3>
          <p className="text-c-text-muted mb-6">
            Match your CSV columns to the user fields. Required fields are marked with *.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {ALL_FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-4">
                <div className="w-40">
                  <span className="text-sm font-medium text-c-text-secondary">
                    {field}
                    {REQUIRED_FIELDS.includes(field) && (
                      <span className="text-danger-500 ml-1">*</span>
                    )}
                  </span>
                </div>
                <ArrowRight size={16} className="text-c-text-secondary" />
                <select
                  value={columnMapping[field] || ''}
                  onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                  className="flex-1 px-4 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg"
                >
                  <option value="">-- Select Column --</option>
                  {csvHeaders.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              onClick={resetImport}
              className="px-4 py-2 border border-c-border-subtle rounded-lg text-c-text-secondary"
            >
              Back
            </button>
            <button
              onClick={() => setImportStep('preview')}
              disabled={!columnMapping['email']}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg font-medium"
            >
              Continue to Preview
            </button>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {importStep === 'preview' && (
        <div className="bg-c-surface rounded-xl p-6 border border-c-border-subtle">
          <h3 className="text-lg font-semibold text-c-text mb-4">Preview Import</h3>
          <p className="text-c-text-muted mb-4">
            Review the data before importing. {csvData.length} users will be imported.
          </p>

          <div className="max-h-64 overflow-auto border border-c-border-subtle rounded-lg mb-6">
            <table
              /* §27-exempt: podgląd surowych wierszy CSV w kreatorze importu (krok wizard, 10 pierwszych wierszy, kolumny dynamiczne wg mappingu, brak id/akcji) — nie kolekcja encji (kanon §2 def.1), formularz/podgląd danych */ className="w-full"
            >
              <thead className="sticky top-0 bg-c-surface-raised">
                <tr>
                  {ALL_FIELDS.map((field) => (
                    <th
                      key={field}
                      className="text-left px-4 py-2 text-xs font-semibold text-c-text-muted uppercase"
                    >
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {csvData.slice(0, 10).map((row, idx) => (
                  <tr key={idx}>
                    {ALL_FIELDS.map((field) => (
                      <td key={field} className="px-4 py-2 text-sm text-c-text-secondary">
                        {row[columnMapping[field]] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {csvData.length > 10 && (
            <p className="text-sm text-c-text-muted mb-4">Showing 10 of {csvData.length} rows</p>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setImportStep('mapping')}
              className="px-4 py-2 border border-c-border-subtle rounded-lg text-c-text-secondary"
            >
              Back
            </button>
            <button
              onClick={handleStartImport}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium flex items-center gap-2"
            >
              <UserPlus size={18} />
              Import {csvData.length} Users
            </button>
          </div>
        </div>
      )}

      {/* Importing Step */}
      {importStep === 'importing' && (
        <div className="bg-c-surface rounded-xl p-12 border border-c-border-subtle text-center">
          <Loader2 size={48} className="mx-auto mb-4 text-primary-600 animate-spin" />
          <h3 className="text-lg font-semibold text-c-text mb-2">Importing Users...</h3>
          <p className="text-c-text-muted">
            Please wait while we import your users. This may take a moment.
          </p>
        </div>
      )}

      {/* Complete Step */}
      {importStep === 'complete' && importRequestError && (
        <DegradedState title="User import unavailable" description={importRequestError} />
      )}

      {importStep === 'complete' && importResult && (
        <div className="bg-c-surface rounded-xl p-6 border border-c-border-subtle">
          <div className="text-center mb-6">
            {importResult.failed === 0 ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="text-emerald-600" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-c-text mb-2">Import Complete!</h3>
                <p className="text-c-text-muted">
                  Successfully imported {importResult.success} users.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="text-amber-600" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-c-text mb-2">
                  Import Completed with Errors
                </h3>
                <p className="text-c-text-muted">
                  {importResult.success} of {importResult.total} users imported successfully.
                </p>
              </>
            )}
          </div>

          {importResult.errors.length > 0 && (
            <div className="bg-danger-50 dark:bg-danger-500/10 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-danger-900 dark:text-danger-300 mb-2">
                {importResult.failed} Failed Imports:
              </h4>
              <ul className="text-sm text-danger-800 dark:text-danger-400 space-y-1">
                {importResult.errors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>
                    Row {err.row}: {err.email || 'Unknown'} - {err.error}
                  </li>
                ))}
                {importResult.errors.length > 5 && (
                  <li>...and {importResult.errors.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={resetImport}
              className="px-6 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium"
            >
              Import More Users
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderRolesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-c-text">Bulk Role Assignment</h3>
          <p className="text-c-text-muted">Select users and assign roles in bulk</p>
        </div>
        <button
          onClick={fetchUsers}
          className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface/10 rounded-lg"
        >
          <RefreshCw
            size={18}
            className={`text-c-text-secondary ${loadingUsers ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {selectedUsers.length > 0 && (
        <div className="bg-primary-50 dark:bg-primary-500/10 rounded-lg p-4 flex items-center justify-between">
          <span className="text-primary-700 dark:text-primary-300 font-medium">
            {selectedUsers.length} users selected
          </span>
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkRoleAssignment(e.target.value);
                  e.target.value = '';
                }
              }}
              className="px-4 py-2 bg-c-surface border border-primary-200 dark:border-primary-500/30 rounded-lg"
            >
              <option value="">Assign Role...</option>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
              <option value="OWNER">Owner</option>
            </select>
          </div>
        </div>
      )}

      <div className="bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden">
        <StandardTable
          columns={userColumns}
          data={users as unknown as TableRow[]}
          loading={loadingUsers}
          error={usersLoadError}
          onRetry={fetchUsers}
          empty={{
            icon: Users,
            title: 'No users found',
            actionLabel: 'Load users',
            onAction: fetchUsers,
          }}
          selection={{
            selectedIds: new Set(selectedUsers),
            onChange: (ids) => setSelectedUsers(Array.from(ids)),
          }}
        />
      </div>
    </div>
  );

  const renderEmailTab = () => (
    <div className="space-y-6">
      <div className="bg-c-surface rounded-xl p-6 border border-c-border-subtle">
        <h3 className="text-lg font-semibold text-c-text mb-4">Mass Email</h3>
        <p className="text-c-text-muted mb-6">Send emails to multiple users at once</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              Recipients
            </label>
            <select
              value={emailForm.recipientType}
              onChange={(e) =>
                setEmailForm((prev) => ({
                  ...prev,
                  recipientType: e.target.value as 'all' | 'admins',
                }))
              }
              className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg"
            >
              <option value="all">All Active Users</option>
              <option value="admins">Admins Only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">Template</label>
            <select
              value={emailForm.template}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, template: e.target.value }))}
              className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg"
            >
              <option value="">Select a template...</option>
              <option value="welcome">Welcome Email</option>
              <option value="announcement">Announcement</option>
              <option value="reminder">Reminder</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">Subject</label>
            <input
              type="text"
              placeholder="Email subject"
              value={emailForm.subject}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">Message</label>
            <textarea
              rows={6}
              placeholder="Write your message..."
              value={emailForm.message}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, message: e.target.value }))}
              className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEmailPreviewOpen(true)}
              className="px-4 py-2 border border-c-border-subtle rounded-lg text-c-text-secondary flex items-center gap-2"
            >
              <Eye size={16} />
              Preview
            </button>
            <button
              type="button"
              disabled={sendingEmail}
              onClick={handleSendMassEmail}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
            >
              {sendingEmail ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sendingEmail ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>

      {emailPreviewOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-c-surface rounded-xl p-6 w-full max-w-2xl border border-c-border-subtle">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-c-text">Email preview</h3>
              <button
                type="button"
                onClick={() => setEmailPreviewOpen(false)}
                className="px-3 py-1.5 text-sm rounded-lg border border-c-border-subtle text-c-text-secondary"
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-c-text-secondary">
                <span className="font-medium text-c-text">Recipients:</span>{' '}
                {emailForm.recipientType === 'admins' ? 'Admins only' : 'All active users'}
              </div>
              <div className="border border-c-border-subtle rounded-lg p-4 bg-c-surface-raised">
                <div className="text-sm text-c-text-muted">Subject</div>
                <div className="font-semibold text-c-text">
                  {emailForm.subject || '(no subject)'}
                </div>
                <div className="mt-3 text-sm text-c-text-muted">Message</div>
                <div className="whitespace-pre-wrap text-c-text">
                  {emailForm.message || '(no message)'}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEmailPreviewOpen(false)}
                  className="px-4 py-2 border border-c-border-subtle rounded-lg text-c-text-secondary"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={sendingEmail}
                  onClick={handleSendMassEmail}
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  {sendingEmail ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderExportTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-c-surface rounded-xl p-6 border border-c-border-subtle">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="text-blue-500" size={24} />
            </div>
            <div>
              <h4 className="font-semibold text-c-text">Export Users</h4>
              <p className="text-sm text-c-text-muted">Download all user data as CSV</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleExport('users')}
            disabled={exportingKey === 'users'}
            className="w-full px-4 py-2 bg-c-surface-raised hover:bg-slate-200 dark:hover:bg-navy-600 disabled:opacity-50 rounded-lg text-c-text-secondary flex items-center justify-center gap-2"
          >
            <Download size={16} />
            {exportingKey === 'users' ? 'Exporting…' : 'Export Users CSV'}
          </button>
        </div>

        <div className="bg-c-surface rounded-xl p-6 border border-c-border-subtle">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <FileSpreadsheet className="text-emerald-500" size={24} />
            </div>
            <div>
              <h4 className="font-semibold text-c-text">Export Activity Log</h4>
              <p className="text-sm text-c-text-muted">Download user activity report</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleExport('activity')}
            disabled={exportingKey === 'activity'}
            className="w-full px-4 py-2 bg-c-surface-raised hover:bg-slate-200 dark:hover:bg-navy-600 disabled:opacity-50 rounded-lg text-c-text-secondary flex items-center justify-center gap-2"
          >
            <Download size={16} />
            {exportingKey === 'activity' ? 'Exporting…' : 'Export Activity Log'}
          </button>
        </div>

        <div className="bg-c-surface rounded-xl p-6 border border-c-border-subtle">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center">
              <Shield className="text-primary-500" size={24} />
            </div>
            <div>
              <h4 className="font-semibold text-c-text">Export Audit Log</h4>
              <p className="text-sm text-c-text-muted">Download security audit trail</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleExport('audit')}
            disabled={exportingKey === 'audit'}
            className="w-full px-4 py-2 bg-c-surface-raised hover:bg-slate-200 dark:hover:bg-navy-600 disabled:opacity-50 rounded-lg text-c-text-secondary flex items-center justify-center gap-2"
          >
            <Download size={16} />
            {exportingKey === 'audit' ? 'Exporting…' : 'Export Audit Log'}
          </button>
        </div>

        <div className="bg-c-surface rounded-xl p-6 border border-c-border-subtle">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Settings className="text-amber-500" size={24} />
            </div>
            <div>
              <h4 className="font-semibold text-c-text">Export Settings</h4>
              <p className="text-sm text-c-text-muted">Download organization settings</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleExport('settings')}
            disabled={exportingKey === 'settings'}
            className="w-full px-4 py-2 bg-c-surface-raised hover:bg-slate-200 dark:hover:bg-navy-600 disabled:opacity-50 rounded-lg text-c-text-secondary flex items-center justify-center gap-2"
          >
            <Download size={16} />
            {exportingKey === 'settings' ? 'Exporting…' : 'Export Settings JSON'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-c-text">Bulk Operations</h1>
          <p className="text-c-text-muted mt-1">Manage users and data in bulk</p>
        </div>
        <InfoButton cardId="superadmin-bulk-ops" position="header-inline" size="md" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-c-surface-raised p-1 rounded-lg w-fit">
        {[
          { id: 'import', label: 'Import Users', icon: <Upload size={16} /> },
          { id: 'roles', label: 'Bulk Roles', icon: <Shield size={16} /> },
          { id: 'email', label: 'Mass Email', icon: <Mail size={16} /> },
          { id: 'export', label: 'Export Data', icon: <Download size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-c-surface text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-c-text-secondary hover:text-c-text dark:hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'import' && renderImportTab()}
      {activeTab === 'roles' && renderRolesTab()}
      {activeTab === 'email' && renderEmailTab()}
      {activeTab === 'export' && renderExportTab()}
    </div>
  );
};

export default BulkOperationsView;
