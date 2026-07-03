import { Edit, Hash, MoreVertical, Plus, RefreshCw, Save, Tag, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { ContentTag } from '../../types';

interface ContentTagsManagerProps {
  contentType?: 'PLAYBOOK' | 'EMAIL' | 'ALL';
  onTagSelect?: (tag: ContentTag) => void;
  selectedTags?: string[];
  onTagsChange?: (tagIds: string[]) => void;
  selectable?: boolean;
}

const PRESET_COLORS = [
  '#F43F5E',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#6366F1',
  '#6366F1',
  '#EC4899',
  '#3B82F6',
  '#3B82F6',
  '#84CC16',
  '#F59E0B',
  '#A855F7',
];

export const ContentTagsManager: React.FC<ContentTagsManagerProps> = ({
  contentType = 'ALL',
  onTagSelect,
  selectedTags = [],
  onTagsChange,
  selectable = false,
}) => {
  const token = localStorage.getItem('token');

  const [tags, setTags] = useState<ContentTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    color: '#10B981',
  });

  const loadTags = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (contentType !== 'ALL') {
        params.append('contentType', contentType);
      }
      if (search) {
        params.append('search', search);
      }

      const res = await fetch(`/api/content/tags?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
      }
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  }, [token, contentType, search]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/content/tags', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          color: formData.color,
          contentType,
        }),
      });

      if (res.ok) {
        setShowNewForm(false);
        setFormData({ name: '', color: '#10B981' });
        loadTags();
      }
    } catch (err) {
      console.error('Failed to create tag:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/content/tags/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          color: formData.color,
        }),
      });

      if (res.ok) {
        setEditingId(null);
        loadTags();
      }
    } catch (err) {
      console.error('Failed to update tag:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;

    try {
      await fetch(`/api/content/tags/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadTags();
    } catch (err) {
      console.error('Failed to delete tag:', err);
    }
    setMenuOpen(null);
  };

  const startEdit = (tag: ContentTag) => {
    setEditingId(tag.id);
    setFormData({
      name: tag.name,
      color: tag.color,
    });
    setMenuOpen(null);
  };

  const toggleTagSelection = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange?.(selectedTags.filter((id) => id !== tagId));
    } else {
      onTagsChange?.([...selectedTags, tagId]);
    }
  };

  const handleTagClick = (tag: ContentTag) => {
    if (selectable) {
      toggleTagSelection(tag.id);
    } else {
      onTagSelect?.(tag);
    }
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
          <Tag className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-c-text">Tags</h3>
          <span className="px-2 py-0.5 bg-c-surface-raised text-slate-300 text-xs rounded-full">
            {tags.length}
          </span>
        </div>
        <button
          onClick={() => {
            setShowNewForm(!showNewForm);
            setFormData({ name: '', color: '#10B981' });
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm hover:bg-emerald-500/20"
        >
          <Plus size={14} />
          New Tag
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tags..."
          className="w-full pl-9 pr-4 py-2 bg-c-surface-raised/50 border border-c-border/50 rounded-lg text-c-text text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
      </div>

      {/* New Tag Form */}
      {showNewForm && (
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Tag name..."
              className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border rounded-lg text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormData((prev) => ({ ...prev, color }))}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
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
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-blue-600 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-blue-700 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Tags List */}
      {tags.length === 0 ? (
        <div className="text-center py-8">
          <Tag className="w-10 h-10 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
          <p className="text-slate-400 dark:text-slate-500">No tags yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create tags to organize your content
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const isEditing = editingId === tag.id;
            const isSelected = selectedTags.includes(tag.id);

            if (isEditing) {
              return (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 p-2 bg-c-surface-raised/50 border border-c-border/50 rounded-lg"
                >
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="px-2 py-1 bg-c-text text-c-bg border border-slate-600 rounded text-sm w-24 focus:outline-none"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    {PRESET_COLORS.slice(0, 6).map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormData((prev) => ({ ...prev, color }))}
                        className={`w-4 h-4 rounded-full border ${
                          formData.color === color ? 'border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => handleUpdate(tag.id)}
                    disabled={saving}
                    className="p-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Save size={14} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1 text-slate-400 dark:text-slate-500 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={tag.id}
                className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''
                }`}
                style={{
                  backgroundColor: `${tag.color}15`,
                  color: tag.color,
                  borderColor: `${tag.color}40`,
                  borderWidth: '1px',
                }}
                onClick={() => handleTagClick(tag)}
              >
                <Tag size={12} />
                {tag.name}
                {tag.usageCount > 0 && (
                  <span
                    className="text-xs px-1.5 rounded-full"
                    style={{ backgroundColor: `${tag.color}30` }}
                  >
                    {tag.usageCount}
                  </span>
                )}

                {/* Menu trigger on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(menuOpen === tag.id ? null : tag.id);
                  }}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical size={12} />
                </button>

                {/* Menu */}
                {menuOpen === tag.id && (
                  <div className="absolute left-0 top-full mt-1 w-32 bg-c-surface-raised border border-c-border rounded-lg shadow-xl z-10 py-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(tag);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-c-surface-raised/50"
                    >
                      <Edit size={12} />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(tag.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger-400 hover:bg-danger-500/10"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Click away handler */}
      {menuOpen && <div className="fixed inset-0 z-0" onClick={() => setMenuOpen(null)} />}
    </div>
  );
};

export default ContentTagsManager;
