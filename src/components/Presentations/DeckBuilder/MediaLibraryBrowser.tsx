/**
 * MediaLibraryBrowser — browse and insert organization media into slides.
 * Shown as a sub-panel in the Block Toolbar when inserting images.
 * Features: category tabs, tag search, grid view, drag to insert.
 */

import { ImageIcon, Search, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MediaItem {
  id: string;
  storage_url: string;
  thumbnail_url?: string;
  original_name: string;
  ai_tags: string[];
  ai_category?: string;
  ai_description?: string;
  usage_count: number;
}

export function normalizeMediaTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((tag) => typeof tag === 'string' || typeof tag === 'number')
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((tag) => typeof tag === 'string' || typeof tag === 'number')
        .map((tag) => String(tag).trim())
        .filter(Boolean);
    }
  } catch {
    // Legacy rows may contain a plain comma-separated value instead of JSON.
  }
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

interface MediaLibraryBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'photo', label: 'Photos' },
  { id: 'illustration', label: 'Illustrations' },
  { id: 'logo', label: 'Logos' },
  { id: 'icon', label: 'Icons' },
];

export const MediaLibraryBrowser: React.FC<MediaLibraryBrowserProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (search) params.set('tags', search);
      params.set('limit', '30');

      const response = await fetch(`/api/presentations/media?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setItems(
          (Array.isArray(data.items) ? data.items : []).map((item: MediaItem) => ({
            ...item,
            ai_tags: normalizeMediaTags(item.ai_tags),
          }))
        );
      }
    } catch {
      /* silent fail */
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    if (isOpen) fetchMedia();
  }, [isOpen, fetchMedia]);

  const handleUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files) return;
      for (const file of Array.from(input.files)) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          await fetch('/api/presentations/media/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: formData,
          });
        } catch {
          /* silent */
        }
      }
      fetchMedia();
    };
    input.click();
  }, [fetchMedia]);

  if (!isOpen) return null;

  const filtered = items.filter((item) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      item.original_name.toLowerCase().includes(searchLower) ||
      item.ai_tags.some((t) => t.toLowerCase().includes(searchLower)) ||
      item.ai_description?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-c-surface border-l border-c-border-subtle shadow-2xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
        <div className="flex items-center gap-2">
          <ImageIcon size={14} className="text-c-accent" />
          <h3 className="text-sm font-semibold text-c-text">
            {t('presentations.builder.mediaLibrary.title', 'Media Library')}
          </h3>
        </div>
        <button onClick={onClose} className="text-c-text-secondary hover:text-c-text-secondary">
          <X size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-c-text-secondary"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('presentations.builder.mediaLibrary.search', 'Search by tag or name...')}
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border border-c-border-subtle bg-c-surface-raised outline-none focus:ring-1 focus:ring-c-focus"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="px-3 flex gap-1 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-2 py-0.5 text-[10px] rounded-full whitespace-nowrap transition-colors ${
              category === cat.id
                ? 'bg-c-surface text-c-text'
                : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-5 h-5 border-2 border-c-accent border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-c-text-secondary">
            <ImageIcon size={20} className="mb-2 opacity-40" />
            <p className="text-xs">
              {t('presentations.builder.mediaLibrary.empty', 'No images found')}
            </p>
            <button
              onClick={handleUpload}
              className="mt-2 text-[10px] text-c-accent hover:text-c-accent font-medium"
            >
              {t('presentations.builder.mediaLibrary.uploadFirst', 'Upload your first image')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="relative group rounded-lg overflow-hidden border border-c-border-subtle hover:border-c-accent transition-colors aspect-square"
              >
                <img
                  src={item.thumbnail_url || item.storage_url}
                  alt={item.original_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                  <div className="w-full p-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[8px] text-c-text truncate">{item.original_name}</p>
                    {item.ai_tags.length > 0 && (
                      <p className="text-[7px] text-c-text truncate">
                        {item.ai_tags.slice(0, 3).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Upload button */}
      <div className="px-3 py-2 border-t border-c-border-subtle">
        <button
          onClick={handleUpload}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-c-border-subtle text-xs text-c-text-secondary hover:text-c-accent hover:border-c-accent transition-colors"
        >
          <Upload size={12} />
          {t('presentations.builder.mediaLibrary.upload', 'Upload images')}
        </button>
      </div>
    </div>
  );
};
