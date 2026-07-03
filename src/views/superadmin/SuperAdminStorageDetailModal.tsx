import { File, Folder, Search, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';

interface StorageModalProps {
  orgId: string;
  orgName: string;
  onClose: () => void;
  onUpdate: () => void;
}

interface StorageFile {
  name?: string;
  path: string;
  size?: unknown;
  created_at?: string | null;
}

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;

  return (
    Array.isArray(value.data) ||
    keys.some((key) => Array.isArray(value[key])) ||
    Boolean(
      data &&
      (Array.isArray(data.data) ||
        keys.some((key) => Array.isArray(data[key])) ||
        Boolean(nestedData && keys.some((key) => Array.isArray(nestedData[key]))))
    )
  );
};

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const normalizeFile = (file: StorageFile, index: number): StorageFile => ({
  ...file,
  name: file.name === undefined ? file.name : asText(file.name, `File ${index + 1}`),
  path: asText(file.path, file.name ? asText(file.name, `file-${index + 1}`) : `file-${index + 1}`),
});

export const SuperAdminStorageDetailModal: React.FC<StorageModalProps> = ({
  orgId,
  orgName,
  onClose,
  onUpdate,
}) => {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await Api.adminGetOrgFiles(orgId);
      if (!hasListShape(data, ['files', 'items'])) {
        throw new Error('Files response was not a list');
      }
      const normalized = getListPayload<StorageFile>(data, ['files', 'items']).map(normalizeFile);
      setFiles(normalized);
      return normalized;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load files');
      setFiles([]);
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleDelete = async (path: string) => {
    if (!confirm(`Are you sure you want to delete "${path}"? \nThis cannot be undone.`)) return;

    try {
      setActionError(null);
      await Api.adminDeleteFile(orgId, path);
      const refreshedFiles = await loadFiles();
      if (!refreshedFiles) {
        throw new Error('File deletion could not be confirmed by read-back');
      }
      if (refreshedFiles.some((file) => file.path === path)) {
        throw new Error('File deletion was not confirmed by the server');
      }
      toast.success('File deleted');
      onUpdate(); // Trigger parent refresh to update totals
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to delete file');
      setActionError(message);
      toast.error(message);
    }
  };

  const formatBytes = (value?: unknown) => {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || !bytes || bytes < 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (value?: string | null) => {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
  };

  const getFileName = (file: StorageFile) => file.name || file.path.split('/').pop() || file.path;

  const filteredFiles = files.filter((f) =>
    `${getFileName(f)} ${f.path}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-c-surface border border-white/10 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-c-text flex items-center gap-2">
              <Folder className="text-pink-500" />
              File Browser: {orgName}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-500 mt-1">
              {files.length} files found
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 dark:text-slate-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 border-b border-white/10 bg-c-bg">
          <div className="relative">
            <Search
              className="absolute left-3 top-2.5 text-slate-500 dark:text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={Boolean(loadError)}
              className="w-full pl-10 pr-4 py-2 bg-primary-600 border border-white/10 rounded-lg text-white focus:outline-none focus:border-pink-500"
            />
          </div>
        </div>

        {actionError && (
          <div
            role="alert"
            className="mx-4 mt-4 rounded-lg bg-danger-500/10 p-3 text-sm text-danger-300"
          >
            {actionError}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-0">
          {loading ? (
            <div className="p-10 text-center text-slate-500 dark:text-slate-400">
              Scanning directory...
            </div>
          ) : loadError ? (
            <div className="p-6">
              <DegradedState title="Organization files unavailable" description={loadError} />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="p-10 text-center text-slate-500 dark:text-slate-400">
              {searchTerm ? 'No matching files found' : 'No files stored for this organization'}
            </div>
          ) : (
            <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-navy-950 text-slate-500 dark:text-slate-400 text-xs uppercase sticky top-0">
                <tr>
                  <th className="p-4">File Name</th>
                  <th className="p-4">Path (Relative)</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredFiles.map((file) => (
                  <tr key={file.path} className="hover:bg-slate-50 dark:hover:bg-navy-800/20">
                    <td className="p-4 font-medium text-c-text flex items-center gap-2">
                      <File size={16} className="text-blue-400" />
                      {getFileName(file)}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-500 font-mono text-xs">
                      {file.path}
                    </td>
                    <td className="p-4 text-slate-600 whitespace-nowrap">
                      {formatBytes(file.size)}
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(file.created_at)}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(file.path)}
                        aria-label={`Delete file ${file.path}`}
                        className="p-1.5 hover:bg-danger-500/20 text-slate-600 dark:text-slate-500 hover:text-danger-400 rounded transition-colors"
                        title="Permanently Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
