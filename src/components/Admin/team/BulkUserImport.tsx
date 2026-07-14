/**
 * BulkUserImport - Bulk user import component with CSV/Excel support
 *
 * Features:
 * - File upload (CSV/Excel)
 * - Preview table showing parsed data
 * - Validation errors highlighted
 * - Column mapping (if needed)
 * - Progress indicator during import
 * - Success/error summary
 *
 * Design: Multi-step modal (Upload → Preview → Confirm → Results)
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Upload,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Modal } from '../../ui/primitives/Modal';
import { Progress } from '../../ui/primitives/Progress';

// User import row structure
export interface ImportUserRow {
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  team?: string;
  department?: string;
  jobTitle?: string;
  manager?: string;
}

// Validation error
interface ValidationError {
  row: number;
  field: string;
  message: string;
}

// Import result
interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ row: number; email: string; error: string }>;
}

// Import step
type ImportStep = 'upload' | 'preview' | 'importing' | 'results';

interface BulkUserImportProps {
  open: boolean;
  onClose: () => void;
  onImport: (users: ImportUserRow[]) => Promise<ImportResult>;
  existingEmails?: string[];
  className?: string;
}

// CSV template
const CSV_TEMPLATE = `email,firstName,lastName,role,team,department,jobTitle,manager
john.doe@example.com,John,Doe,MEMBER,Engineering,Product,Software Engineer,jane.smith@example.com
jane.smith@example.com,Jane,Smith,ADMIN,Engineering,Product,Engineering Lead,`;

// Parse CSV content
function parseCSV(content: string): ImportUserRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows: ImportUserRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    if (values.length < 3) continue;

    const row: ImportUserRow = {
      email: values[headers.indexOf('email')] || '',
      firstName: values[headers.indexOf('firstname')] || '',
      lastName: values[headers.indexOf('lastname')] || '',
      role: values[headers.indexOf('role')] || 'MEMBER',
      team: values[headers.indexOf('team')] || '',
      department: values[headers.indexOf('department')] || '',
      jobTitle: values[headers.indexOf('jobtitle')] || '',
      manager: values[headers.indexOf('manager')] || '',
    };

    if (row.email) {
      rows.push(row);
    }
  }

  return rows;
}

// Validate email
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate rows
function validateRows(rows: ImportUserRow[], existingEmails: string[] = []): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenEmails = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because of header and 0-index

    // Email validation
    if (!row.email) {
      errors.push({ row: rowNum, field: 'email', message: 'Email is required' });
    } else if (!isValidEmail(row.email)) {
      errors.push({ row: rowNum, field: 'email', message: 'Invalid email format' });
    } else if (seenEmails.has(row.email.toLowerCase())) {
      errors.push({ row: rowNum, field: 'email', message: 'Duplicate email in file' });
    } else if (existingEmails.includes(row.email.toLowerCase())) {
      errors.push({ row: rowNum, field: 'email', message: 'User already exists' });
    }
    seenEmails.add(row.email.toLowerCase());

    // Name validation
    if (!row.firstName) {
      errors.push({ row: rowNum, field: 'firstName', message: 'First name is required' });
    }
    if (!row.lastName) {
      errors.push({ row: rowNum, field: 'lastName', message: 'Last name is required' });
    }
  });

  return errors;
}

export const BulkUserImport: React.FC<BulkUserImportProps> = ({
  open,
  onClose,
  onImport,
  existingEmails = [],
  className,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ImportUserRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setValidationErrors([]);
    setImportProgress(0);
    setImportResult(null);
    onClose();
  }, [onClose]);

  // Handle file selection
  const handleFileSelect = useCallback(
    (file: File) => {
      if (!file) return;

      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];

      if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
        alert(t('admin.team.import.invalidFileType', 'Please upload a CSV or Excel file'));
        return;
      }

      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const rows = parseCSV(content);
        setParsedRows(rows);

        const errors = validateRows(rows, existingEmails);
        setValidationErrors(errors);

        setStep('preview');
      };
      reader.readAsText(file);
    },
    [existingEmails, t]
  );

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  // Download template
  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'user-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Start import
  const handleStartImport = useCallback(async () => {
    if (validationErrors.some((e) => e.field === 'email' && e.message.includes('required'))) {
      return; // Don't import if there are critical errors
    }

    setStep('importing');
    setImportProgress(0);

    // Filter out rows with critical errors
    const errorRows = new Set(
      validationErrors
        .filter((e) => e.message.includes('required') || e.message.includes('Invalid'))
        .map((e) => e.row)
    );
    const validRows = parsedRows.filter((_, index) => !errorRows.has(index + 2));

    // Simulate progress
    const progressInterval = setInterval(() => {
      setImportProgress((prev) => Math.min(prev + 5, 90));
    }, 100);

    try {
      const result = await onImport(validRows);
      setImportResult(result);
    } catch (error) {
      setImportResult({
        success: 0,
        failed: validRows.length,
        skipped: parsedRows.length - validRows.length,
        errors: [{ row: 0, email: '', error: String(error) }],
      });
    } finally {
      clearInterval(progressInterval);
      setImportProgress(100);
      setStep('results');
    }
  }, [parsedRows, validationErrors, onImport]);

  // Get errors for a specific row
  const getRowErrors = useCallback(
    (rowIndex: number) => {
      return validationErrors.filter((e) => e.row === rowIndex + 2);
    },
    [validationErrors]
  );

  // Check if row has errors
  const hasRowErrors = useCallback(
    (rowIndex: number) => {
      return validationErrors.some((e) => e.row === rowIndex + 2);
    },
    [validationErrors]
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('admin.team.import.title', 'Import Users')}
      size="lg"
    >
      <div className={cn('min-h-[400px]', className)}>
        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t(
                  'admin.team.import.uploadDescription',
                  'Upload a CSV or Excel file with user data. Download our template for the correct format.'
                )}
              </p>

              {/* Template download */}
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                <Download size={16} />
                {t('admin.team.import.downloadTemplate', 'Download CSV template')}
              </button>

              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl cursor-pointer transition-all',
                  isDragOver
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-slate-300 dark:border-navy-600 hover:border-primary-400 hover:bg-slate-50 dark:hover:bg-navy-800'
                )}
              >
                <Upload
                  size={48}
                  className={cn(
                    'mb-4',
                    isDragOver ? 'text-primary-500' : 'text-slate-400 dark:text-slate-500'
                  )}
                />
                <p className="text-lg font-medium text-navy-900 dark:text-white mb-1">
                  {t('admin.team.import.dropZoneTitle', 'Drop your file here')}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('admin.team.import.dropZoneSubtitle', 'or click to browse')}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  CSV, XLS, XLSX (max 10MB)
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />

              {/* Expected format */}
              <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
                <h4 className="text-sm font-medium text-navy-900 dark:text-white mb-2">
                  {t('admin.team.import.expectedFormat', 'Expected Format')}
                </h4>
                <div className="overflow-x-auto">
                  <table
                    /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="text-xs"
                  >
                    <thead>
                      <tr className="text-slate-500 dark:text-slate-400">
                        <th className="pr-4 text-left">email*</th>
                        <th className="pr-4 text-left">firstName*</th>
                        <th className="pr-4 text-left">lastName*</th>
                        <th className="pr-4 text-left">role</th>
                        <th className="pr-4 text-left">team</th>
                      </tr>
                    </thead>
                    <tbody className="text-navy-900 dark:text-white">
                      <tr>
                        <td className="pr-4">john@example.com</td>
                        <td className="pr-4">John</td>
                        <td className="pr-4">Doe</td>
                        <td className="pr-4">MEMBER</td>
                        <td className="pr-4">Engineering</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">* Required fields</p>
              </div>
            </motion.div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* File info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={20} className="text-primary-500" />
                  <span className="font-medium text-navy-900 dark:text-white">{fileName}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    ({parsedRows.length} {t('admin.team.import.users', 'users')})
                  </span>
                </div>
                <button
                  onClick={() => setStep('upload')}
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  {t('admin.team.import.changeFile', 'Change file')}
                </button>
              </div>

              {/* Validation summary */}
              {validationErrors.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <AlertTriangle size={16} />
                    <span className="text-sm font-medium">
                      {validationErrors.length}{' '}
                      {t('admin.team.import.validationErrors', 'validation errors found')}
                    </span>
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div className="max-h-[300px] overflow-auto border border-slate-200 dark:border-navy-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-navy-900 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                        #
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                        Email
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                        Role
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                        Team
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
                    {parsedRows.map((row, index) => {
                      const errors = getRowErrors(index);
                      const hasErrors = errors.length > 0;

                      return (
                        <tr
                          key={index}
                          className={cn(
                            'bg-white dark:bg-navy-800',
                            hasErrors && 'bg-danger-50 dark:bg-danger-900/10'
                          )}
                        >
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                            {index + 1}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2',
                              errors.some((e) => e.field === 'email')
                                ? 'text-danger-600'
                                : 'text-navy-900 dark:text-white'
                            )}
                          >
                            {row.email || '-'}
                          </td>
                          <td className="px-3 py-2 text-navy-900 dark:text-white">
                            {row.firstName} {row.lastName}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                            {row.role || 'MEMBER'}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                            {row.team || '-'}
                          </td>
                          <td className="px-3 py-2">
                            {hasErrors ? (
                              <span className="flex items-center gap-1 text-danger-600">
                                <XCircle size={14} />
                                <span className="text-xs">{errors[0].message}</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle size={14} />
                                <span className="text-xs">Valid</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-navy-700">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  <ChevronLeft size={16} />
                  {t('common.back', 'Back')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleStartImport}
                  disabled={parsedRows.length === 0}
                >
                  {t('admin.team.import.startImport', 'Import')} {parsedRows.length}{' '}
                  {t('admin.team.import.users', 'users')}
                  <ChevronRight size={16} />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <motion.div
              key="importing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <RefreshCw size={48} className="text-primary-500 animate-spin mb-6" />
              <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-2">
                {t('admin.team.import.importing', 'Importing users...')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                {t('admin.team.import.pleaseWait', 'Please wait while we process your data')}
              </p>
              <div className="w-full max-w-xs">
                <Progress value={importProgress} size="md" color="primary" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{importProgress}%</p>
            </motion.div>
          )}

          {/* Step 4: Results */}
          {step === 'results' && importResult && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Success/Error icon */}
              <div className="text-center py-6">
                {importResult.success > 0 ? (
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
                    <Check size={32} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger-100 dark:bg-danger-900/30 mb-4">
                    <X size={32} className="text-danger-600 dark:text-danger-400" />
                  </div>
                )}
                <h3 className="text-xl font-semibold text-navy-900 dark:text-white">
                  {importResult.success > 0
                    ? t('admin.team.import.importComplete', 'Import Complete')
                    : t('admin.team.import.importFailed', 'Import Failed')}
                </h3>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {importResult.success}
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {t('admin.team.import.imported', 'Imported')}
                  </p>
                </div>
                <div className="p-4 bg-danger-50 dark:bg-danger-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-danger-600 dark:text-danger-400">
                    {importResult.failed}
                  </p>
                  <p className="text-sm text-danger-700 dark:text-danger-300">
                    {t('admin.team.import.failed', 'Failed')}
                  </p>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {importResult.skipped}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {t('admin.team.import.skipped', 'Skipped')}
                  </p>
                </div>
              </div>

              {/* Error details */}
              {importResult.errors.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg max-h-[200px] overflow-auto">
                  <h4 className="text-sm font-medium text-navy-900 dark:text-white mb-2">
                    {t('admin.team.import.errorDetails', 'Error Details')}
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {importResult.errors.map((error, index) => (
                      <li key={index} className="text-danger-600 dark:text-danger-400">
                        {error.email
                          ? `Row ${error.row} (${error.email}): ${error.error}`
                          : error.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-navy-700">
                <Button variant="primary" onClick={handleClose}>
                  {t('common.done', 'Done')}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
};

export default BulkUserImport;
