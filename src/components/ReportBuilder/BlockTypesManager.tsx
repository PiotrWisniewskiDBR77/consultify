import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

type BlockRenderKind = 'markdown' | 'callout' | 'table' | 'chart' | 'matrix' | 'json';
type SectionLength = 'short' | 'medium' | 'long';
type SectionLanguage = 'technical' | 'business' | 'general';

export interface BlockType {
  id: string;
  name: string;
  description?: string | null;
  sourceTypes?: string[] | null;
  renderKind: BlockRenderKind;
  promptTemplate?: string | null;
  inputSchema?: Record<string, unknown> | null;
  defaultLength?: SectionLength;
  defaultLanguage?: SectionLanguage;
  isSystem?: boolean;
  isActive?: boolean;
}

interface BlockTypesManagerProps {
  onBack?: () => void;
  embedded?: boolean;
}

export const BlockTypesManager: React.FC<BlockTypesManagerProps> = ({
  onBack,
  embedded = false,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [blocks, setBlocks] = useState<BlockType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<BlockType | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [renderKind, setRenderKind] = useState<BlockRenderKind>('markdown');
  const [sourceTypesText, setSourceTypesText] = useState('ASSESSMENT');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [defaultLength, setDefaultLength] = useState<SectionLength>('medium');
  const [defaultLanguage, setDefaultLanguage] = useState<SectionLanguage>('business');

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setRenderKind('markdown');
    setSourceTypesText('ASSESSMENT');
    setPromptTemplate('');
    setDefaultLength('medium');
    setDefaultLanguage('business');
  }, []);

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (b: BlockType) => {
    setEditing(b);
    setName(b.name);
    setDescription(b.description || '');
    setRenderKind((b.renderKind || 'markdown') as BlockRenderKind);
    setSourceTypesText((b.sourceTypes || ['ASSESSMENT']).join(','));
    setPromptTemplate(b.promptTemplate || '');
    setDefaultLength((b.defaultLength || 'medium') as SectionLength);
    setDefaultLanguage((b.defaultLanguage || 'business') as SectionLanguage);
    setIsModalOpen(true);
  };

  const parsedSourceTypes = useMemo(() => {
    const items = sourceTypesText
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    return Array.from(new Set(items));
  }, [sourceTypesText]);

  const fetchBlocks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await Api.get('/report-builder/block-types');
      setBlocks(res?.blocks || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load blocks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const save = async () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      sourceTypes: parsedSourceTypes,
      renderKind,
      promptTemplate: promptTemplate.trim() || undefined,
      defaultLength,
      defaultLanguage,
    };

    if (editing?.id) {
      await Api.put(`/report-builder/block-types/${editing.id}`, payload);
    } else {
      await Api.post('/report-builder/block-types', payload);
    }
    setIsModalOpen(false);
    await fetchBlocks();
  };

  const deactivate = async (b: BlockType) => {
    if (b.isSystem) return;
    if (!confirm(isPl ? 'Dezaktywować ten blok?' : 'Deactivate this block type?')) return;
    await Api.delete(`/report-builder/block-types/${b.id}`);
    await fetchBlocks();
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            {isPl ? 'Powrót' : 'Back'}
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {isPl ? 'Nowy blok' : 'New block'}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2
            className={`${embedded ? 'text-lg' : 'text-xl'} font-bold text-slate-900 dark:text-white`}
          >
            {isPl ? 'Biblioteka bloków' : 'Block library'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isPl
              ? 'Definiuj typy bloków (render + prompt), które można używać w raportach.'
              : 'Define block types (render + prompt) reusable across reports.'}
          </p>
        </div>
        {embedded && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {isPl ? 'Nowy blok' : 'New block'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700">{error}</div>
      ) : (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {isPl ? 'Nazwa' : 'Name'}
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {isPl ? 'Render' : 'Render'}
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {isPl ? 'Źródła' : 'Sources'}
                </th>
                <th className="px-6 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {blocks.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">{b.name}</div>
                    {b.description && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {b.description}
                      </div>
                    )}
                    {b.isSystem && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        {isPl ? 'Systemowy' : 'System'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {b.renderKind}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {(b.sourceTypes || []).join(', ') || '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => openEdit(b)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {isPl ? 'Edytuj' : 'Edit'}
                      </button>
                      <button
                        onClick={() => deactivate(b)}
                        disabled={Boolean(b.isSystem)}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-600 disabled:opacity-50"
                        title={isPl ? 'Dezaktywuj' : 'Deactivate'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {blocks.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    {isPl ? 'Brak bloków' : 'No blocks yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {editing ? (isPl ? 'Edytuj blok' : 'Edit block') : isPl ? 'Nowy blok' : 'New block'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isPl ? 'Nazwa' : 'Name'}
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isPl ? 'Render kind' : 'Render kind'}
                  </label>
                  <select
                    value={renderKind}
                    onChange={(e) => setRenderKind(e.target.value as BlockRenderKind)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                  >
                    <option value="markdown">markdown</option>
                    <option value="callout">callout</option>
                    <option value="table">table</option>
                    <option value="chart">chart</option>
                    <option value="matrix">matrix</option>
                    <option value="json">json</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isPl ? 'Opis' : 'Description'}
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isPl ? 'Źródła (CSV)' : 'Sources (CSV)'}
                  </label>
                  <input
                    value={sourceTypesText}
                    onChange={(e) => setSourceTypesText(e.target.value)}
                    placeholder="ASSESSMENT, TOOL"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {isPl ? 'Długość' : 'Length'}
                    </label>
                    <select
                      value={defaultLength}
                      onChange={(e) => setDefaultLength(e.target.value as SectionLength)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                    >
                      <option value="short">{isPl ? 'Krótka' : 'Short'}</option>
                      <option value="medium">{isPl ? 'Średnia' : 'Medium'}</option>
                      <option value="long">{isPl ? 'Długa' : 'Long'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {isPl ? 'Styl' : 'Style'}
                    </label>
                    <select
                      value={defaultLanguage}
                      onChange={(e) => setDefaultLanguage(e.target.value as SectionLanguage)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                    >
                      <option value="business">{isPl ? 'Biznesowy' : 'Business'}</option>
                      <option value="technical">{isPl ? 'Techniczny' : 'Technical'}</option>
                      <option value="general">{isPl ? 'Ogólny' : 'General'}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isPl ? 'Prompt template' : 'Prompt template'}
                </label>
                <textarea
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  rows={6}
                  placeholder={
                    isPl
                      ? 'Np. "Napisz sekcję o ... używając danych: {{facts}}"'
                      : 'E.g. "Write a section about ... using data: {{facts}}"'
                  }
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white font-mono text-xs"
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  {isPl
                    ? 'W MVP traktujemy template jako tekst; integracja z datasetami i schemą będzie rozszerzana.'
                    : 'In MVP, template is plain text; dataset/schema integration will be expanded.'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                {isPl ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={save}
                disabled={!name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isPl ? 'Zapisz' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
