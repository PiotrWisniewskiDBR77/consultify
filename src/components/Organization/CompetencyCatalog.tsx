import { BookOpen, Layers, Plus, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { API_URL, fetchWithRetry, getHeaders, handleResponse } from '../../services/api/baseClient';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import type { TableColumn } from '../shared/ModuleHub/FilterableTable';
import { FilterableTable } from '../shared/ModuleHub/FilterableTable';
import { EmptyState } from '../ui/composed/EmptyState';
import { LoadingState } from '../ui/primitives';

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
  const [competencyFilters, setCompetencyFilters] = useState<FilterChip[]>([]);

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

  // §27 — canonical FilterableTable columns (replaces the raw <table>). Preserves
  // the prior columns/rendering: Competency (name + description), Category chip,
  // and centered Initiatives / Users counts.
  const competencyColumns: TableColumn[] = [
    {
      id: 'name',
      label: t('competency.table.name', 'Competency'),
      width: '320px',
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-navy-900 dark:text-white truncate">{row.name}</div>
          {row.description && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {row.description}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'categoryName',
      label: t('competency.table.category', 'Category'),
      width: '180px',
      render: (row) =>
        row.categoryName ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-navy-700/60">
            {row.categoryName}
          </span>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        ),
    },
    {
      id: 'initiativeCount',
      label: t('competency.table.initiatives', 'Initiatives'),
      width: '120px',
      align: 'center',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">{row.initiativeCount}</span>
      ),
    },
    {
      id: 'userCount',
      label: t('competency.table.users', 'Users'),
      width: '120px',
      align: 'center',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">{row.userCount}</span>
      ),
    },
  ];

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  const isEmpty = categories.length === 0 && competencies.length === 0;

  return (
    <div className="space-y-6">
      {isEmpty && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
          <EmptyState
            icon={<BookOpen />}
            title={t('competency.empty.title', 'No competency catalog yet')}
            description={t(
              'competency.empty.description',
              'Start by creating a default taxonomy with categories and skill levels, then customize it for your organization.'
            )}
            action={{
              label: t('competency.empty.seedDefaults', 'Create Default Taxonomy'),
              onClick: handleSeedDefaults,
            }}
          />
        </div>
      )}

      {!isEmpty && (
        <>
          {/* Categories strip */}
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                <Layers size={16} className="text-slate-600" />
                {t('competency.categories.title', 'Categories')}
              </h3>
              <button
                onClick={() => setShowAddCategory(true)}
                className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
              >
                <Plus size={14} />
                {t('competency.categories.add', 'Add')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  !selectedCategory
                    ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-navy-700/60 hover:bg-slate-200 dark:hover:bg-navy-700'
                }`}
              >
                {t('competency.categories.all', 'All')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 group border ${
                    selectedCategory === cat.id
                      ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-navy-700/60 hover:bg-slate-200 dark:hover:bg-navy-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {isPl && cat.namePl ? cat.namePl : cat.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(cat.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-1 text-slate-600 hover:text-danger-500"
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
                  className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
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
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
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
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
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
              className="h-9 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-1.5 font-medium"
            >
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
                  className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
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

          {/* Competencies table (§27 — canonical FilterableTable) */}
          <FilterableTable
            columns={competencyColumns}
            data={filteredCompetencies.map((comp) => ({
              id: comp.id,
              name: comp.name,
              description: comp.description || '',
              categoryName: comp.categoryName || '',
              initiativeCount: comp.initiativeCount,
              userCount: comp.userCount,
            }))}
            hideRowActions
            activeFilters={competencyFilters}
            onFilterChange={setCompetencyFilters}
            emptyMessage={t('competency.table.empty', 'No competencies found')}
            persistKey="org-competency-catalog-table"
            canvasClassName=""
          />
        </>
      )}
    </div>
  );
};

export default CompetencyCatalog;
