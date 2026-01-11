import {
  ChevronDown,
  ChevronRight,
  Edit,
  FolderOpen,
  MoreVertical,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { ContentCategory } from '../../types';

interface ContentCategoriesManagerProps {
  contentType?: 'PLAYBOOK' | 'EMAIL' | 'ALL';
  onCategorySelect?: (category: ContentCategory) => void;
}

const PRESET_COLORS = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
];

const PRESET_ICONS = [
  'folder',
  'file-text',
  'mail',
  'play',
  'settings',
  'shield',
  'alert-triangle',
  'users',
  'trending-up',
  'zap',
];

export const ContentCategoriesManager: React.FC<ContentCategoriesManagerProps> = ({
  contentType = 'ALL',
  onCategorySelect,
}) => {
  const token = localStorage.getItem('token');

  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366F1',
    icon: 'folder',
    parentId: null as string | null,
  });

  const loadCategories = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (contentType !== 'ALL') {
        params.append('contentType', contentType);
      }
      params.append('tree', 'true');

      const res = await fetch(`/api/content/categories?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  }, [token, contentType]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/content/categories', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          color: formData.color,
          icon: formData.icon,
          parentId: formData.parentId,
          contentType,
        }),
      });

      if (res.ok) {
        setShowNewForm(false);
        setFormData({
          name: '',
          description: '',
          color: '#6366F1',
          icon: 'folder',
          parentId: null,
        });
        loadCategories();
      }
    } catch (err) {
      console.error('Failed to create category:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/content/categories/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          color: formData.color,
          icon: formData.icon,
        }),
      });

      if (res.ok) {
        setEditingId(null);
        loadCategories();
      }
    } catch (err) {
      console.error('Failed to update category:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      await fetch(`/api/content/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
    setMenuOpen(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const startEdit = (category: ContentCategory) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
      icon: category.icon,
      parentId: category.parentId || null,
    });
    setMenuOpen(null);
  };

  const startNewChild = (parentId: string) => {
    setShowNewForm(true);
    setFormData((prev) => ({ ...prev, parentId }));
    setExpandedIds((prev) => new Set(prev).add(parentId));
    setMenuOpen(null);
  };

  const renderCategory = (category: ContentCategory, depth = 0): React.ReactNode => {
    const isExpanded = expandedIds.has(category.id);
    const isEditing = editingId === category.id;
    const hasChildren = category.children && category.children.length > 0;

    return (
      <div key={category.id} style={{ marginLeft: depth * 20 }}>
        <div
          className={`flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700/30 transition-colors ${
            isEditing ? 'bg-slate-700/50' : ''
          }`}
        >
          {/* Expand toggle */}
          <button
            onClick={() => toggleExpand(category.id)}
            className={`p-1 text-slate-400 dark:text-slate-500 hover:text-white ${!hasChildren ? 'opacity-0' : ''}`}
            disabled={!hasChildren}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {/* Category content */}
          {isEditing ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                autoFocus
              />
              <div className="flex gap-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setFormData((prev) => ({ ...prev, color }))}
                    className={`w-5 h-5 rounded-full border-2 ${
                      formData.color === color ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button
                onClick={() => handleUpdate(category.id)}
                disabled={saving}
                className="p-1 text-emerald-400 hover:text-emerald-300"
              >
                <Save size={16} />
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => onCategorySelect?.(category)}
                className="flex-1 flex items-center gap-3 text-left"
              >
                <div
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ backgroundColor: `${category.color}20` }}
                >
                  <FolderOpen size={14} style={{ color: category.color }} />
                </div>
                <span className="text-white text-sm font-medium">{category.name}</span>
                {category.description && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                    {category.description}
                  </span>
                )}
              </button>

              <div className="relative">
                <button
                  onClick={() => setMenuOpen(menuOpen === category.id ? null : category.id)}
                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-white rounded"
                >
                  <MoreVertical size={16} />
                </button>

                {menuOpen === category.id && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 py-1">
                    <button
                      onClick={() => startEdit(category)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50"
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => startNewChild(category.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50"
                    >
                      <Plus size={14} />
                      Add Subcategory
                    </button>
                    <div className="border-t border-slate-700 my-1" />
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-2 border-l border-slate-700/50 pl-2">
            {category.children!.map((child) => renderCategory(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 text-slate-400 dark:text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-violet-400" />
          <h3 className="font-semibold text-white">Categories</h3>
          <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">
            {categories.length}
          </span>
        </div>
        <button
          onClick={() => {
            setShowNewForm(!showNewForm);
            setFormData({
              name: '',
              description: '',
              color: '#6366F1',
              icon: 'folder',
              parentId: null,
            });
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 text-violet-400 border border-violet-500/30 rounded-lg text-sm hover:bg-violet-500/20"
        >
          <Plus size={14} />
          New Category
        </button>
      </div>

      {/* New Category Form */}
      {showNewForm && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Category name..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormData((prev) => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-lg border-2 transition-transform ${
                    formData.color === color
                      ? 'border-white scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 text-slate-400 dark:text-slate-500 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !formData.name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg font-medium hover:from-violet-600 hover:to-purple-700 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Categories Tree */}
      {categories.length === 0 ? (
        <div className="text-center py-8">
          <FolderOpen className="w-10 h-10 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
          <p className="text-slate-400 dark:text-slate-500">No categories yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create your first category to organize content
          </p>
        </div>
      ) : (
        <div className="space-y-1">{categories.map((cat) => renderCategory(cat))}</div>
      )}

      {/* Click away handler */}
      {menuOpen && <div className="fixed inset-0 z-0" onClick={() => setMenuOpen(null)} />}
    </div>
  );
};

export default ContentCategoriesManager;
