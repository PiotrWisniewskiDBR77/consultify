import { BookOpen, Layers, Loader2, Plus, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { API_URL, fetchWithRetry, getHeaders, handleResponse } from '../../services/api/baseClient';
import { trackFunnelEvent } from '../../services/funnelAnalytics';

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetchWithRetry(`${API_URL}${url}`, {
    ...opts,
    headers: { ...getHeaders(), ...(opts?.headers || {}) },
  });
  return handleResponse<T>(res, `Request failed (${res.status})`);
}

interface Category {
  id: string;
  name: string;
  namePl: string | null;
  description: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  isSystem: boolean;
}

interface Competency {
  id: string;
  name: string;
  description: string | null;
  domain: string;
  categoryId: string | null;
  categoryName: string | null;
  initiativeCount: number;
  userCount: number;
}

interface Level {
  id: string;
  levelValue: number;
  label: string;
  labelPl: string | null;
  description: string | null;
}

export const CompetencyCatalog: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';

  const [categories, setCategories] = useState<Category[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddCompetency, setShowAddCompetency] = useState(false);

  const [newCatName, setNewCatName] = useState('');
  const [newCatNamePl, setNewCatNamePl] = useState('');
  const [newCompName, setNewCompName] = useState('');
  const [newCompDesc, setNewCompDesc] = useState('');
  const [newCompCategoryId, setNewCompCategoryId] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, compRes, lvlRes] = await Promise.all([
        apiFetch<{ categories: Category[] }>('/competency/categories'),
        apiFetch<{ competencies: Competency[] }>(
          `/competency/competencies${selectedCategory ? `?categoryId=${selectedCategory}` : ''}`
        ),
        apiFetch<{ levels: Level[] }>('/competency/levels'),
      ]);
      setCategories(catRes.categories);
      setCompetencies(compRes.competencies);
      setLevels(lvlRes.levels);
    } catch (error: any) {
      toast.error(
        error?.message || t('competency.error.loadFailed', 'Failed to load competency data')
      );
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSeedDefaults = useCallback(async () => {
    try {
      await Promise.all([
        apiFetch('/competency/categories/seed-defaults', { method: 'POST' }),
        apiFetch('/competency/levels/seed-defaults', { method: 'POST' }),
      ]);
      toast.success(t('competency.defaults.seeded', 'Default taxonomy created'));
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to seed defaults');
    }
  }, [loadData, t]);

  const handleAddCategory = useCallback(async () => {
    if (!newCatName.trim()) return;
    try {
      await apiFetch('/competency/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName, namePl: newCatNamePl || undefined }),
      });
      trackFunnelEvent('competency_created', { type: 'category', name: newCatName });
      setNewCatName('');
      setNewCatNamePl('');
      setShowAddCategory(false);
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create category');
    }
  }, [newCatName, newCatNamePl, loadData]);

  const handleDeleteCategory = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/competency/categories/${id}`, { method: 'DELETE' });
        trackFunnelEvent('competency_deleted', { type: 'category', id });
        if (selectedCategory === id) setSelectedCategory(null);
        loadData();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete category');
      }
    },
    [loadData, selectedCategory]
  );

  const handleAddCompetency = useCallback(async () => {
    if (!newCompName.trim()) return;
    try {
      await apiFetch('/capabilities', {
        method: 'POST',
        body: JSON.stringify({
          name: newCompName,
          description: newCompDesc || undefined,
          domain: 'general',
        }),
      });
      if (newCompCategoryId) {
        const comps = await apiFetch<{ competencies: Competency[] }>('/competency/competencies');
        const newComp = comps.competencies.find((c) => c.name === newCompName);
        if (newComp) {
          await apiFetch(`/competency/competencies/${newComp.id}/category`, {
            method: 'PUT',
            body: JSON.stringify({ categoryId: newCompCategoryId }),
          });
        }
      }
      trackFunnelEvent('competency_created', { type: 'competency', name: newCompName });
      setNewCompName('');
      setNewCompDesc('');
      setNewCompCategoryId('');
      setShowAddCompetency(false);
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create competency');
    }
  }, [newCompName, newCompDesc, newCompCategoryId, loadData]);

  const filteredCompetencies = competencies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-purple-500" size={24} />
      </div>
    );
  }

  const isEmpty = categories.length === 0 && competencies.length === 0;

  return (
    <div className="space-y-6">
      {isEmpty && (
        <div className="text-center py-12 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
          <BookOpen size={40} className="mx-auto text-purple-400 mb-3" />
          <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-1">
            {t('competency.empty.title', 'No competency catalog yet')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-md mx-auto">
            {t(
              'competency.empty.description',
              'Start by creating a default taxonomy with categories and skill levels, then customize it for your organization.'
            )}
          </p>
          <button
            onClick={handleSeedDefaults}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            {t('competency.empty.seedDefaults', 'Create Default Taxonomy')}
          </button>
        </div>
      )}

      {!isEmpty && (
        <>
          {/* Categories strip */}
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                <Layers size={16} className="text-purple-500" />
                {t('competency.categories.title', 'Categories')}
              </h3>
              <button
                onClick={() => setShowAddCategory(true)}
                className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 dark:text-purple-400 font-medium"
              >
                <Plus size={14} />
                {t('competency.categories.add', 'Add')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  !selectedCategory
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                }`}
              >
                {t('competency.categories.all', 'All')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 group ${
                    selectedCategory === cat.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {isPl && cat.namePl ? cat.namePl : cat.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(cat.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-1 text-slate-400 hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                </button>
              ))}
            </div>

            {showAddCategory && (
              <div className="mt-3 flex gap-2 items-end">
                <div className="flex-1">
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder={t('competency.categories.namePlaceholder', 'Category name (EN)')}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white"
                  />
                </div>
                <div className="flex-1">
                  <input
                    value={newCatNamePl}
                    onChange={(e) => setNewCatNamePl(e.target.value)}
                    placeholder={t('competency.categories.namePlaceholderPl', 'Nazwa (PL)')}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white"
                  />
                </div>
                <button
                  onClick={handleAddCategory}
                  className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700"
                >
                  {t('common.save', 'Save')}
                </button>
                <button
                  onClick={() => setShowAddCategory(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 text-xs rounded-lg"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            )}
          </div>

          {/* Levels summary */}
          {levels.length > 0 && (
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-2">
                {t('competency.levels.title', 'Proficiency Levels')}
              </h3>
              <div className="flex gap-1">
                {levels.map((lvl) => (
                  <div
                    key={lvl.id}
                    className="flex-1 text-center px-2 py-2 bg-slate-50 dark:bg-navy-800 rounded-lg"
                  >
                    <div className="text-xs font-bold text-purple-600 dark:text-purple-400">
                      {lvl.levelValue}
                    </div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                      {isPl && lvl.labelPl ? lvl.labelPl : lvl.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search + Add */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('competency.search', 'Search competencies...')}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white"
              />
            </div>
            <button
              onClick={() => setShowAddCompetency(true)}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1.5 font-medium"
            >
              <Plus size={16} />
              {t('competency.add', 'Add Competency')}
            </button>
          </div>

          {/* Add competency form */}
          {showAddCompetency && (
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  placeholder={t('competency.form.name', 'Competency name')}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white"
                />
                <select
                  value={newCompCategoryId}
                  onChange={(e) => setNewCompCategoryId(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white"
                >
                  <option value="">{t('competency.form.noCategory', '— No category —')}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {isPl && cat.namePl ? cat.namePl : cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={newCompDesc}
                onChange={(e) => setNewCompDesc(e.target.value)}
                placeholder={t('competency.form.description', 'Description (optional)')}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddCompetency}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                >
                  {t('common.save', 'Save')}
                </button>
                <button
                  onClick={() => setShowAddCompetency(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 text-sm rounded-lg"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Competencies table */}
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('competency.table.name', 'Competency')}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('competency.table.category', 'Category')}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('competency.table.initiatives', 'Initiatives')}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('competency.table.users', 'Users')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCompetencies.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm"
                    >
                      {t('competency.table.empty', 'No competencies found')}
                    </td>
                  </tr>
                ) : (
                  filteredCompetencies.map((comp) => (
                    <tr
                      key={comp.id}
                      className="border-b border-slate-100 dark:border-navy-800 last:border-0 hover:bg-slate-50 dark:hover:bg-navy-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-navy-900 dark:text-white">{comp.name}</div>
                        {comp.description && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs">
                            {comp.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {comp.categoryName ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            {comp.categoryName}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="text-center px-4 py-3">
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {comp.initiativeCount}
                        </span>
                      </td>
                      <td className="text-center px-4 py-3">
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {comp.userCount}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CompetencyCatalog;
