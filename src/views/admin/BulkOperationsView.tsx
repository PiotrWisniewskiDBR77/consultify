// @ts-nocheck
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
import React, { useCallback, useRef, useState } from 'react';

import { Api } from '../../services/api';

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

export const BulkOperationsView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('import');
    const [importStep, setImportStep] = useState<ImportStep>('upload');
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvData, setCsvData] = useState<any[]>([]);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                        h.toLowerCase().replace(/[_\s]/g, '') === field.toLowerCase(),
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
            setImportResult({
                total: csvData.length,
                success: 0,
                failed: csvData.length,
                errors: [{ row: 0, email: '', error: 'Import failed' }],
            });
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
            const result = await Api.get('/api/admin/users');
            setUsers(result.users || []);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    const toggleUserSelection = (userId: string) => {
        setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
    };

    const selectAllUsers = () => {
        if (selectedUsers.length === users.length) {
            setSelectedUsers([]);
        } else {
            setSelectedUsers(users.map((u) => u.id));
        }
    };

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
                                    ? 'text-violet-600'
                                    : ['upload', 'mapping', 'preview', 'complete'].indexOf(importStep) > idx
                                      ? 'text-emerald-600'
                                      : 'text-slate-400'
                            }`}
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                    importStep === s.step
                                        ? 'bg-violet-100 dark:bg-violet-500/20'
                                        : ['upload', 'mapping', 'preview', 'complete'].indexOf(importStep) > idx
                                          ? 'bg-emerald-100 dark:bg-emerald-500/20'
                                          : 'bg-slate-100 dark:bg-navy-700'
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
                        {idx < 3 && <ChevronRight size={16} className="text-slate-400" />}
                    </React.Fragment>
                ))}
            </div>

            {/* Upload Step */}
            {importStep === 'upload' && (
                <div className="bg-white dark:bg-navy-800 rounded-xl p-8 border border-slate-200 dark:border-white/10">
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                            <Upload className="text-violet-600" size={32} />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Upload CSV File</h3>
                        <p className="text-slate-500 mb-6">
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
                                className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2"
                            >
                                <Upload size={18} />
                                Select CSV File
                            </button>
                            <button
                                onClick={downloadTemplate}
                                className="px-6 py-3 border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
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
                <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Map CSV Columns</h3>
                    <p className="text-slate-500 mb-6">
                        Match your CSV columns to the user fields. Required fields are marked with *.
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        {ALL_FIELDS.map((field) => (
                            <div key={field} className="flex items-center gap-4">
                                <div className="w-40">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {field}
                                        {REQUIRED_FIELDS.includes(field) && (
                                            <span className="text-red-500 ml-1">*</span>
                                        )}
                                    </span>
                                </div>
                                <ArrowRight size={16} className="text-slate-400" />
                                <select
                                    value={columnMapping[field] || ''}
                                    onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg"
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
                            className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300"
                        >
                            Back
                        </button>
                        <button
                            onClick={() => setImportStep('preview')}
                            disabled={!columnMapping['email']}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium"
                        >
                            Continue to Preview
                        </button>
                    </div>
                </div>
            )}

            {/* Preview Step */}
            {importStep === 'preview' && (
                <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Preview Import</h3>
                    <p className="text-slate-500 mb-4">
                        Review the data before importing. {csvData.length} users will be imported.
                    </p>

                    <div className="max-h-64 overflow-auto border border-slate-200 dark:border-white/10 rounded-lg mb-6">
                        <table className="w-full">
                            <thead className="sticky top-0 bg-slate-50 dark:bg-navy-900">
                                <tr>
                                    {ALL_FIELDS.map((field) => (
                                        <th
                                            key={field}
                                            className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase"
                                        >
                                            {field}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {csvData.slice(0, 10).map((row, idx) => (
                                    <tr key={idx}>
                                        {ALL_FIELDS.map((field) => (
                                            <td
                                                key={field}
                                                className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300"
                                            >
                                                {row[columnMapping[field]] || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {csvData.length > 10 && (
                        <p className="text-sm text-slate-500 mb-4">Showing 10 of {csvData.length} rows</p>
                    )}

                    <div className="flex justify-between">
                        <button
                            onClick={() => setImportStep('mapping')}
                            className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleStartImport}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2"
                        >
                            <UserPlus size={18} />
                            Import {csvData.length} Users
                        </button>
                    </div>
                </div>
            )}

            {/* Importing Step */}
            {importStep === 'importing' && (
                <div className="bg-white dark:bg-navy-800 rounded-xl p-12 border border-slate-200 dark:border-white/10 text-center">
                    <Loader2 size={48} className="mx-auto mb-4 text-violet-600 animate-spin" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Importing Users...</h3>
                    <p className="text-slate-500">Please wait while we import your users. This may take a moment.</p>
                </div>
            )}

            {/* Complete Step */}
            {importStep === 'complete' && importResult && (
                <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                    <div className="text-center mb-6">
                        {importResult.failed === 0 ? (
                            <>
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                                    <CheckCircle2 className="text-emerald-600" size={32} />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                    Import Complete!
                                </h3>
                                <p className="text-slate-500">Successfully imported {importResult.success} users.</p>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                                    <AlertTriangle className="text-amber-600" size={32} />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                    Import Completed with Errors
                                </h3>
                                <p className="text-slate-500">
                                    {importResult.success} of {importResult.total} users imported successfully.
                                </p>
                            </>
                        )}
                    </div>

                    {importResult.errors.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-4 mb-6">
                            <h4 className="font-medium text-red-900 dark:text-red-300 mb-2">
                                {importResult.failed} Failed Imports:
                            </h4>
                            <ul className="text-sm text-red-800 dark:text-red-400 space-y-1">
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
                            className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium"
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
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Bulk Role Assignment</h3>
                    <p className="text-slate-500">Select users and assign roles in bulk</p>
                </div>
                <button onClick={fetchUsers} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg">
                    <RefreshCw size={18} className={`text-slate-400 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {selectedUsers.length > 0 && (
                <div className="bg-violet-50 dark:bg-violet-500/10 rounded-lg p-4 flex items-center justify-between">
                    <span className="text-violet-700 dark:text-violet-300 font-medium">
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
                            className="px-4 py-2 bg-white dark:bg-navy-800 border border-violet-200 dark:border-violet-500/30 rounded-lg"
                        >
                            <option value="">Assign Role...</option>
                            <option value="USER">User</option>
                            <option value="ADMIN">Admin</option>
                            <option value="OWNER">Owner</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10">
                            <th className="text-left px-6 py-4">
                                <input
                                    type="checkbox"
                                    checked={selectedUsers.length === users.length && users.length > 0}
                                    onChange={selectAllUsers}
                                    className="w-4 h-4 rounded border-slate-300 text-violet-600"
                                />
                            </th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">User</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Role</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                <td className="px-6 py-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedUsers.includes(user.id)}
                                        onChange={() => toggleUserSelection(user.id)}
                                        className="w-4 h-4 rounded border-slate-300 text-violet-600"
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                                            {user.firstName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900 dark:text-white">
                                                {user.firstName} {user.lastName}
                                            </div>
                                            <div className="text-sm text-slate-500">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                            user.role === 'ADMIN'
                                                ? 'bg-violet-500/10 text-violet-600'
                                                : user.role === 'OWNER'
                                                  ? 'bg-amber-500/10 text-amber-600'
                                                  : 'bg-slate-500/10 text-slate-600'
                                        }`}
                                    >
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                            user.status === 'active'
                                                ? 'bg-emerald-500/10 text-emerald-600'
                                                : 'bg-slate-500/10 text-slate-600'
                                        }`}
                                    >
                                        {user.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && !loadingUsers && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center">
                                    <Users size={40} className="mx-auto mb-3 text-slate-300" />
                                    <p className="text-slate-500">No users found</p>
                                    <button
                                        onClick={fetchUsers}
                                        className="mt-2 text-sm text-violet-600 hover:text-violet-700"
                                    >
                                        Load users
                                    </button>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderEmailTab = () => (
        <div className="space-y-6">
            <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Mass Email</h3>
                <p className="text-slate-500 mb-6">Send emails to multiple users at once</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Recipients
                        </label>
                        <select className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg">
                            <option value="all">All Users</option>
                            <option value="admins">Admins Only</option>
                            <option value="active">Active Users</option>
                            <option value="inactive">Inactive Users</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Template
                        </label>
                        <select className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg">
                            <option value="">Select a template...</option>
                            <option value="welcome">Welcome Email</option>
                            <option value="announcement">Announcement</option>
                            <option value="reminder">Reminder</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Subject
                        </label>
                        <input
                            type="text"
                            placeholder="Email subject"
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Message
                        </label>
                        <textarea
                            rows={6}
                            placeholder="Write your message..."
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Eye size={16} />
                            Preview
                        </button>
                        <button className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2">
                            <Send size={16} />
                            Send Email
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderExportTab = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <Users className="text-blue-500" size={24} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">Export Users</h4>
                            <p className="text-sm text-slate-500">Download all user data as CSV</p>
                        </div>
                    </div>
                    <button className="w-full px-4 py-2 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 rounded-lg text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2">
                        <Download size={16} />
                        Export Users CSV
                    </button>
                </div>

                <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <FileSpreadsheet className="text-emerald-500" size={24} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">Export Activity Log</h4>
                            <p className="text-sm text-slate-500">Download user activity report</p>
                        </div>
                    </div>
                    <button className="w-full px-4 py-2 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 rounded-lg text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2">
                        <Download size={16} />
                        Export Activity Log
                    </button>
                </div>

                <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                            <Shield className="text-violet-500" size={24} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">Export Audit Log</h4>
                            <p className="text-sm text-slate-500">Download security audit trail</p>
                        </div>
                    </div>
                    <button className="w-full px-4 py-2 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 rounded-lg text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2">
                        <Download size={16} />
                        Export Audit Log
                    </button>
                </div>

                <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <Settings className="text-amber-500" size={24} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">Export Settings</h4>
                            <p className="text-sm text-slate-500">Download organization settings</p>
                        </div>
                    </div>
                    <button className="w-full px-4 py-2 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 rounded-lg text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2">
                        <Download size={16} />
                        Export Settings JSON
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bulk Operations</h1>
                <p className="text-slate-500 mt-1">Manage users and data in bulk</p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-lg w-fit">
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
                                ? 'bg-white dark:bg-navy-800 text-violet-600 dark:text-violet-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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

