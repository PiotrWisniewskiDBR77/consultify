/**
 * InterfacesIndex — Index page showing all interfaces for a base.
 * Card grid with quick-start templates, share, and CRUD operations.
 */
import {
  BarChart3,
  Check,
  ClipboardCopy,
  FileText,
  Layout,
  LayoutGrid,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import { EmptyState } from '@/components/ui/composed/EmptyState';
import { LoadingState } from '@/components/ui/primitives';
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
        {
          id: crypto.randomUUID(),
          type: 'summary',
          config: { tableId, label: 'Total', aggregation: 'count' },
          position: { x: 0, y: 0, w: 4, h: 2 },
        },
        {
          id: crypto.randomUUID(),
          type: 'summary',
          config: { tableId, label: 'Sum', aggregation: 'sum' },
          position: { x: 4, y: 0, w: 4, h: 2 },
        },
        {
          id: crypto.randomUUID(),
          type: 'chart',
          config: { tableId, chartType: 'bar', aggregation: 'count' },
          position: { x: 0, y: 2, w: 6, h: 4 },
        },
        {
          id: crypto.randomUUID(),
          type: 'chart',
          config: { tableId, chartType: 'pie', aggregation: 'count' },
          position: { x: 6, y: 2, w: 6, h: 4 },
        },
      ],
    },
    {
      key: 'record_detail',
      icon: <FileText className="h-6 w-6" />,
      label: t('interfacesIndex.tplRecordDetail', 'Record detail'),
      description: t('interfacesIndex.tplRecordDetailDesc', 'Single record view with all fields'),
      blocks: [
        {
          id: crypto.randomUUID(),
          type: 'record_detail',
          config: { tableId, visibleFieldIds: [] },
          position: { x: 0, y: 0, w: 12, h: 8 },
        },
      ],
    },
    {
      key: 'form_view',
      icon: <LayoutGrid className="h-6 w-6" />,
      label: t('interfacesIndex.tplFormView', 'Form view'),
      description: t('interfacesIndex.tplFormViewDesc', 'Data entry optimized'),
      blocks: [
        {
          id: crypto.randomUUID(),
          type: 'text',
          config: { content: 'Data Entry Form', fontSize: 20 },
          position: { x: 0, y: 0, w: 12, h: 1 },
        },
        {
          id: crypto.randomUUID(),
          type: 'table_grid',
          config: { tableId, maxRows: 10 },
          position: { x: 0, y: 1, w: 12, h: 6 },
        },
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

  useEffect(() => {
    loadInterfaces();
  }, [loadInterfaces]);

  const handleCreateFromTemplate = useCallback(
    async (template: InterfaceTemplate) => {
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
    },
    [onCreateView, tableId, t]
  );

  // Program B (E02) — klik człowieka = `ctx.params.run` (rejestr wykonuje
  // ORYGINALNY callback wprost); Teresa = ta sama funkcja rejestru woła REST
  // bezpośrednio (`runTableInterfaceDeleteCallback` w `ideaActionRegistry.ts`).
  const handleDelete = useCallback(
    (ifaceId: string) => {
      const ctx: ActionContext = {
        ideaId: baseId,
        tool: 'table',
        selection: EMPTY_SELECTION,
        surface: 'panel',
        source: 'ui',
        params: {
          interfaceId: ifaceId,
          run: async () => {
            try {
              await TablePlatformApi.deleteView(ifaceId);
              setInterfaces((prev) => prev.filter((i) => i.id !== ifaceId));
              setDeleteConfirm(null);
              toast.success(t('interfacesIndex.deleted', 'Interface deleted'));
            } catch {
              toast.error(t('interfacesIndex.deleteError', 'Failed to delete interface'));
            }
          },
        },
      };
      void runIdeaAction('table.interface.delete', ctx);
    },
    [t, baseId]
  );

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
        <div className="flex items-center justify-between border-b border-c-border-subtle px-4 py-2 border-c-border-subtle">
          <button
            onClick={() => {
              setEditingInterface(null);
              loadInterfaces();
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised text-c-text-muted hover:bg-c-surface-raised"
          >
            &larr; {t('interfacesIndex.backToList', 'Back to interfaces')}
          </button>
          <span className="text-sm font-medium text-c-text-muted">{editingInterface.name}</span>
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
    return <LoadingState variant="spinner" className="py-20" />;
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (interfaces.length === 0 && !showTemplates) {
    return (
      <EmptyState
        icon={<Layout />}
        title={t('interfacesIndex.emptyTitle', 'Build custom views of your data')}
        description={t(
          'interfacesIndex.emptyDescription',
          'Interfaces let you create dashboards, detail views, and custom layouts.'
        )}
        action={
          !locked
            ? {
                label: t('interfacesIndex.createInterface', 'Create Interface'),
                onClick: () => setShowTemplates(true),
              }
            : undefined
        }
      />
    );
  }

  // ── Template picker ────────────────────────────────────────────────────────

  if (showTemplates) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-c-text">
            {t('interfacesIndex.chooseTemplate', 'Choose a template')}
          </h2>
          <button
            onClick={() => setShowTemplates(false)}
            className="rounded-lg p-1.5 text-c-text-secondary transition-colors hover:bg-c-surface-raised"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((tpl) => (
            <button
              key={tpl.key}
              onClick={() => handleCreateFromTemplate(tpl)}
              className="group flex flex-col items-center rounded-2xl border border-c-border-subtle bg-c-surface p-6 text-center transition-all hover:border-c-border hover:shadow-md border-c-border-subtle bg-c-surface-raised hover:border-c-border"
            >
              <div className="mb-3 rounded-xl bg-c-surface text-c-text-secondary transition-colors group-hover:bg-c-surface-raised">
                {tpl.icon}
              </div>
              <h4 className="mb-1 text-sm font-semibold text-c-text">{tpl.label}</h4>
              <p className="text-xs text-c-text-muted">{tpl.description}</p>
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
        <h2 className="text-lg font-semibold text-c-text">
          {t('interfacesIndex.title', 'Interfaces')}
        </h2>
        {!locked && (
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 rounded-xl bg-c-text px-4 py-2 text-sm font-medium text-c-surface transition-colors hover:opacity-90"
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
            className="group relative rounded-2xl border border-c-border-subtle bg-c-surface p-5 transition-shadow hover:shadow-md border-c-border-subtle bg-c-surface-raised"
          >
            {/* Placeholder thumbnail */}
            <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-c-surface-raised">
              <Layout className="h-8 w-8 text-c-text-secondary" />
              {iface.config?.blocks && iface.config.blocks.length > 0 && (
                <span className="ml-2 text-xs text-c-text-secondary">
                  {iface.config.blocks.length} {t('interfacesIndex.blocks', 'blocks')}
                </span>
              )}
            </div>

            {/* Name */}
            <h3 className="mb-1 text-sm font-semibold text-c-text">{iface.name}</h3>

            {/* Last modified */}
            {iface.updatedAt && (
              <p className="mb-4 text-xs text-c-text-muted">
                {t('interfacesIndex.lastModified', 'Last modified')}{' '}
                {new Date(iface.updatedAt).toLocaleDateString()}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Share */}
              <button
                onClick={() => handleCopyShareLink(iface.id)}
                className="flex items-center gap-1 rounded-lg bg-c-surface-raised px-2.5 py-1.5 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised text-c-text-muted hover:bg-c-surface-raised"
              >
                {copiedId === iface.id ? (
                  <Check className="h-3 w-3 text-c-success" />
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
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-c-info transition-colors hover:bg-c-info text-c-info hover:bg-c-info"
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
                        className="rounded-lg px-2 py-1 text-xs font-medium text-c-danger transition-colors hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--c-danger)_18%,transparent)]"
                      >
                        {t('interfacesIndex.confirmDelete', 'Confirm')}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="rounded-lg px-2 py-1 text-xs text-c-text-muted transition-colors hover:bg-c-surface-raised"
                      >
                        {t('interfacesIndex.cancel', 'Cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(iface.id)}
                      className="rounded-lg p-1.5 text-c-text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] hover:text-c-danger dark:hover:bg-[color-mix(in_srgb,var(--c-danger)_18%,transparent)]"
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
