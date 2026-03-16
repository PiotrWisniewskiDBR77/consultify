/**
 * InterfacesIndex — Index page showing all interfaces for a base.
 * Card grid with quick-start templates, share, and CRUD operations.
 */
import {
  BarChart3,
  ClipboardCopy,
  Check,
  FileText,
  Layout,
  LayoutGrid,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

import { InterfaceDesigner } from '../InterfaceDesigner';

// ── Types ────────────────────────────────────────────────────────────────────

interface InterfaceRecord {
  id: string;
  tableId: string;
  name: string;
  viewType: string;
  config: {
    blocks?: any[];
    theme?: Record<string, unknown>;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface InterfaceTemplate {
  key: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  blocks: any[];
}

export interface InterfacesIndexProps {
  baseId: string;
  tableId: string;
  tables: Array<{ id: string; name: string; fields: Array<{ id: string; name: string }> }>;
  platformViews?: any[];
  onCreateView?: (name: string, viewType: string, config: Record<string, unknown>) => Promise<any>;
  locked?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export function InterfacesIndex({
  baseId,
  tableId,
  tables,
  platformViews = [],
  onCreateView,
  locked,
}: InterfacesIndexProps) {
  const { t } = useTranslation();

  const [interfaces, setInterfaces] = useState<InterfaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInterface, setEditingInterface] = useState<InterfaceRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const templates: InterfaceTemplate[] = [
    {
      key: 'dashboard',
      icon: <BarChart3 className="h-6 w-6" />,
      label: t('interfacesIndex.tplDashboard', 'Dashboard'),
      description: t('interfacesIndex.tplDashboardDesc', 'Pre-configured with chart blocks'),
      blocks: [
        { id: crypto.randomUUID(), type: 'summary', config: { tableId, label: 'Total', aggregation: 'count' }, position: { x: 0, y: 0, w: 4, h: 2 } },
        { id: crypto.randomUUID(), type: 'summary', config: { tableId, label: 'Sum', aggregation: 'sum' }, position: { x: 4, y: 0, w: 4, h: 2 } },
        { id: crypto.randomUUID(), type: 'chart', config: { tableId, chartType: 'bar', aggregation: 'count' }, position: { x: 0, y: 2, w: 6, h: 4 } },
        { id: crypto.randomUUID(), type: 'chart', config: { tableId, chartType: 'pie', aggregation: 'count' }, position: { x: 6, y: 2, w: 6, h: 4 } },
      ],
    },
    {
      key: 'record_detail',
      icon: <FileText className="h-6 w-6" />,
      label: t('interfacesIndex.tplRecordDetail', 'Record detail'),
      description: t('interfacesIndex.tplRecordDetailDesc', 'Single record view with all fields'),
      blocks: [
        { id: crypto.randomUUID(), type: 'record_detail', config: { tableId, visibleFieldIds: [] }, position: { x: 0, y: 0, w: 12, h: 8 } },
      ],
    },
    {
      key: 'form_view',
      icon: <LayoutGrid className="h-6 w-6" />,
      label: t('interfacesIndex.tplFormView', 'Form view'),
      description: t('interfacesIndex.tplFormViewDesc', 'Data entry optimized'),
      blocks: [
        { id: crypto.randomUUID(), type: 'text', config: { content: 'Data Entry Form', fontSize: 20 }, position: { x: 0, y: 0, w: 12, h: 1 } },
        { id: crypto.randomUUID(), type: 'table_grid', config: { tableId, maxRows: 10 }, position: { x: 0, y: 1, w: 12, h: 6 } },
      ],
    },
    {
      key: 'blank',
      icon: <Layout className="h-6 w-6" />,
      label: t('interfacesIndex.tplBlank', 'Blank'),
      description: t('interfacesIndex.tplBlankDesc', 'Empty canvas'),
      blocks: [],
    },
  ];

  const loadInterfaces = useCallback(() => {
    setLoading(true);
    try {
      const ifaceViews = (platformViews ?? []).filter(
        (v: any) => v.viewType === 'interface' || v.name?.toLowerCase().includes('interface')
      );
      setInterfaces(
        ifaceViews.map((v: any) => ({
          id: v.id,
          tableId: v.tableId ?? tableId,
          name: v.name ?? 'Interface',
          viewType: v.viewType ?? 'interface',
          config: v.config ?? { blocks: [] },
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [platformViews, tableId]);

  useEffect(() => { loadInterfaces(); }, [loadInterfaces]);

  const handleCreateFromTemplate = useCallback(async (template: InterfaceTemplate) => {
    try {
      const name = `${template.label} — ${new Date().toLocaleDateString()}`;
      if (onCreateView) {
        const created = await onCreateView(name, 'interface', { blocks: template.blocks });
        if (created) {
          setEditingInterface({
            id: created.id,
            tableId,
            name,
            viewType: 'interface',
            config: { blocks: template.blocks },
          });
        }
      }
      setShowTemplates(false);
    } catch {
      toast.error(t('interfacesIndex.createError', 'Failed to create interface'));
    }
  }, [onCreateView, tableId, t]);

  const handleDelete = useCallback(async (ifaceId: string) => {
    try {
      await TablePlatformApi.deleteView(ifaceId);
      setInterfaces((prev) => prev.filter((i) => i.id !== ifaceId));
      setDeleteConfirm(null);
      toast.success(t('interfacesIndex.deleted', 'Interface deleted'));
    } catch {
      toast.error(t('interfacesIndex.deleteError', 'Failed to delete interface'));
    }
  }, [t]);

  const handleCopyShareLink = useCallback((ifaceId: string) => {
    const url = `${window.location.origin}/interfaces/${ifaceId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(ifaceId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // ── Editing mode (full-screen designer) ────────────────────────────────────

  if (editingInterface) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-navy-700">
          <button
            onClick={() => { setEditingInterface(null); loadInterfaces(); }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-navy-800"
          >
            &larr; {t('interfacesIndex.backToList', 'Back to interfaces')}
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {editingInterface.name}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <InterfaceDesigner
            interfaceId={editingInterface.id}
            baseId={baseId}
            layout={{
              blocks: editingInterface.config?.blocks ?? [],
              theme: editingInterface.config?.theme,
            }}
            tables={tables}
            onSave={async (layout) => {
              try {
                await TablePlatformApi.updateView(editingInterface.id, {
                  config: { blocks: layout.blocks, theme: layout.theme },
                });
                setEditingInterface((prev) =>
                  prev ? { ...prev, config: { blocks: layout.blocks, theme: layout.theme } } : null
                );
                toast.success(t('interfacesIndex.saved', 'Interface saved'));
              } catch {
                toast.error(t('interfacesIndex.saveError', 'Failed to save interface'));
              }
            }}
          />
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (interfaces.length === 0 && !showTemplates) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 rounded-2xl bg-violet-50 p-4 dark:bg-violet-900/20">
          <Layout className="h-10 w-10 text-violet-500" />
        </div>
        <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
          {t('interfacesIndex.emptyTitle', 'Build custom views of your data')}
        </h3>
        <p className="mb-6 max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
          {t('interfacesIndex.emptyDescription', 'Interfaces let you create dashboards, detail views, and custom layouts.')}
        </p>
        {!locked && (
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            {t('interfacesIndex.createInterface', 'Create Interface')}
          </button>
        )}
      </div>
    );
  }

  // ── Template picker ────────────────────────────────────────────────────────

  if (showTemplates) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('interfacesIndex.chooseTemplate', 'Choose a template')}
          </h2>
          <button
            onClick={() => setShowTemplates(false)}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-navy-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((tpl) => (
            <button
              key={tpl.key}
              onClick={() => handleCreateFromTemplate(tpl)}
              className="group flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-6 text-center transition-all hover:border-violet-300 hover:shadow-md dark:border-navy-700 dark:bg-navy-800 dark:hover:border-violet-600"
            >
              <div className="mb-3 rounded-xl bg-violet-50 p-3 text-violet-600 transition-colors group-hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-400">
                {tpl.icon}
              </div>
              <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                {tpl.label}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tpl.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Card grid ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('interfacesIndex.title', 'Interfaces')}
        </h2>
        {!locked && (
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            {t('interfacesIndex.createInterface', 'Create Interface')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {interfaces.map((iface) => (
          <div
            key={iface.id}
            className="group relative rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-navy-700 dark:bg-navy-800"
          >
            {/* Placeholder thumbnail */}
            <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/10 dark:to-purple-900/10">
              <Layout className="h-8 w-8 text-violet-400" />
              {iface.config?.blocks && iface.config.blocks.length > 0 && (
                <span className="ml-2 text-xs text-violet-500">
                  {iface.config.blocks.length} {t('interfacesIndex.blocks', 'blocks')}
                </span>
              )}
            </div>

            {/* Name */}
            <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
              {iface.name}
            </h3>

            {/* Last modified */}
            {iface.updatedAt && (
              <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">
                {t('interfacesIndex.lastModified', 'Last modified')}{' '}
                {new Date(iface.updatedAt).toLocaleDateString()}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Share */}
              <button
                onClick={() => handleCopyShareLink(iface.id)}
                className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-navy-700 dark:text-gray-300 dark:hover:bg-navy-600"
              >
                {copiedId === iface.id ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <ClipboardCopy className="h-3 w-3" />
                )}
                {copiedId === iface.id
                  ? t('interfacesIndex.copied', 'Copied!')
                  : t('interfacesIndex.share', 'Share')}
              </button>

              <div className="flex-1" />

              {/* Edit */}
              <button
                onClick={() => setEditingInterface(iface)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                {t('interfacesIndex.edit', 'Edit')}
              </button>

              {/* Delete */}
              {!locked && (
                <>
                  {deleteConfirm === iface.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(iface.id)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {t('interfacesIndex.confirmDelete', 'Confirm')}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-navy-700"
                      >
                        {t('interfacesIndex.cancel', 'Cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(iface.id)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                      title={t('interfacesIndex.delete', 'Delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default InterfacesIndex;
