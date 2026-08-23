/**
 * SettingsSearch - Global search across all settings
 */

import { ArrowRight, Clock, Loader2, Search, Star, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { User } from '../../../types';

interface SettingsSearchProps {
  currentUser: User;
  onNavigate?: (path: string) => void;
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  path: string;
  keywords: string[];
  icon: string;
}

const allSettings: SearchResult[] = [
  // Profile
  {
    id: 'profile-name',
    title: 'Display Name',
    description: 'Change your display name',
    category: 'Profile',
    path: '/settings/profile',
    keywords: ['name', 'display', 'username'],
    icon: '👤',
  },
  {
    id: 'profile-avatar',
    title: 'Profile Picture',
    description: 'Upload or change your avatar',
    category: 'Profile',
    path: '/settings/profile',
    keywords: ['avatar', 'picture', 'photo', 'image'],
    icon: '📷',
  },
  {
    id: 'profile-bio',
    title: 'Bio & About',
    description: 'Edit your profile biography',
    category: 'Profile',
    path: '/settings/profile',
    keywords: ['bio', 'about', 'description'],
    icon: '📝',
  },

  // Security
  {
    id: 'security-password',
    title: 'Change Password',
    description: 'Update your account password',
    category: 'Security',
    path: '/settings/security',
    keywords: ['password', 'credentials', 'login'],
    icon: '🔑',
  },
  {
    id: 'security-2fa',
    title: 'Two-Factor Authentication',
    description: 'Enable or manage 2FA',
    category: 'Security',
    path: '/settings/security',
    keywords: ['2fa', 'mfa', 'authenticator', 'two-factor'],
    icon: '🔐',
  },
  {
    id: 'security-sessions',
    title: 'Active Sessions',
    description: 'View and manage logged in devices',
    category: 'Security',
    path: '/settings/security',
    keywords: ['sessions', 'devices', 'logout'],
    icon: '💻',
  },

  // Privacy
  {
    id: 'privacy-visibility',
    title: 'Profile Visibility',
    description: 'Control who can see your profile',
    category: 'Privacy',
    path: '/settings/privacy',
    keywords: ['visibility', 'public', 'private'],
    icon: '👁️',
  },
  {
    id: 'privacy-data',
    title: 'Data Controls',
    description: 'Manage your data and privacy',
    category: 'Privacy',
    path: '/settings/privacy',
    keywords: ['data', 'gdpr', 'export', 'delete'],
    icon: '📊',
  },

  // AI
  {
    id: 'ai-model',
    title: 'AI Model Selection',
    description: 'Choose your preferred AI model',
    category: 'AI Preferences',
    path: '/settings/ai',
    keywords: ['ai', 'model', 'gpt', 'claude'],
    icon: '🤖',
  },
  {
    id: 'ai-behavior',
    title: 'AI Behavior',
    description: 'Customize AI response style',
    category: 'AI Preferences',
    path: '/settings/ai',
    keywords: ['ai', 'behavior', 'personality', 'tone'],
    icon: '💬',
  },
  {
    id: 'ai-context',
    title: 'AI Memory & Context',
    description: 'Manage what AI remembers',
    category: 'AI Preferences',
    path: '/settings/ai',
    keywords: ['ai', 'memory', 'context', 'history'],
    icon: '🧠',
  },

  // Notifications
  {
    id: 'notif-email',
    title: 'Email Notifications',
    description: 'Configure email notification preferences',
    category: 'Notifications',
    path: '/settings/notifications',
    keywords: ['email', 'notifications', 'digest'],
    icon: '📧',
  },
  {
    id: 'notif-push',
    title: 'Push Notifications',
    description: 'Manage push notifications',
    category: 'Notifications',
    path: '/settings/notifications',
    keywords: ['push', 'notifications', 'alerts'],
    icon: '🔔',
  },
  {
    id: 'notif-rules',
    title: 'Notification Rules',
    description: 'Create custom notification rules',
    category: 'Notifications',
    path: '/settings/notifications',
    keywords: ['rules', 'custom', 'automation'],
    icon: '⚡',
  },

  // Integrations
  {
    id: 'int-slack',
    title: 'Slack Integration',
    description: 'Connect with Slack',
    category: 'Integrations',
    path: '/settings/integrations',
    keywords: ['slack', 'integration', 'connect'],
    icon: '💬',
  },
  {
    id: 'int-jira',
    title: 'Jira Integration',
    description: 'Connect with Jira',
    category: 'Integrations',
    path: '/settings/integrations',
    keywords: ['jira', 'integration', 'connect'],
    icon: '📋',
  },
  {
    id: 'int-calendar',
    title: 'Calendar Sync',
    description: 'Sync with your calendar',
    category: 'Integrations',
    path: '/settings/integrations',
    keywords: ['calendar', 'sync', 'google', 'outlook'],
    icon: '📅',
  },

  // Appearance
  {
    id: 'app-theme',
    title: 'Theme',
    description: 'Switch between light and dark mode',
    category: 'Appearance',
    path: '/settings/appearance',
    keywords: ['theme', 'dark', 'light', 'mode'],
    icon: '🎨',
  },
  {
    id: 'app-font',
    title: 'Font Settings',
    description: 'Customize font size and family',
    category: 'Appearance',
    path: '/settings/appearance',
    keywords: ['font', 'size', 'text'],
    icon: '🔤',
  },
  {
    id: 'app-density',
    title: 'Display Density',
    description: 'Adjust UI density',
    category: 'Appearance',
    path: '/settings/appearance',
    keywords: ['density', 'compact', 'comfortable'],
    icon: '📐',
  },

  // Advanced
  {
    id: 'adv-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Customize keyboard shortcuts',
    category: 'Advanced',
    path: '/settings/advanced/shortcuts',
    keywords: ['keyboard', 'shortcuts', 'hotkeys'],
    icon: '⌨️',
  },
  {
    id: 'adv-export',
    title: 'Export/Import Settings',
    description: 'Backup and restore settings',
    category: 'Advanced',
    path: '/settings/advanced/export',
    keywords: ['export', 'import', 'backup'],
    icon: '💾',
  },
  {
    id: 'adv-history',
    title: 'Settings History',
    description: 'View settings change log',
    category: 'Advanced',
    path: '/settings/advanced/history',
    keywords: ['history', 'log', 'audit'],
    icon: '📜',
  },
];

export const SettingsSearch: React.FC<SettingsSearchProps> = ({ currentUser, onNavigate }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'password',
    'notifications',
    'theme',
  ]);
  const [favorites, setFavorites] = useState<string[]>(['security-2fa', 'app-theme']);

  const results = useMemo(() => {
    if (!query.trim()) return [];

    const searchTerm = query.toLowerCase();
    return allSettings
      .filter(
        (setting) =>
          setting.title.toLowerCase().includes(searchTerm) ||
          setting.description.toLowerCase().includes(searchTerm) ||
          setting.category.toLowerCase().includes(searchTerm) ||
          setting.keywords.some((k) => k.toLowerCase().includes(searchTerm))
      )
      .slice(0, 10);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    // Add to recent searches
    if (!recentSearches.includes(query) && query.trim()) {
      setRecentSearches([query, ...recentSearches.slice(0, 4)]);
    }

    // Navigate
    onNavigate?.(result.path);
    setIsOpen(false);
    setQuery('');
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const favoriteSettings = allSettings.filter((s) => favorites.includes(s.id));

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in relative">
      <div>
        <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
          <Search size={28} className="text-blue-500" />
          Settings Search
        </h2>
        <p className="text-c-text-muted text-sm mt-1">Quickly find any setting</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-c-text-secondary"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search settings... (Cmd+K)"
          className="w-full pl-12 pr-4 py-4 text-lg bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-c-text-secondary hover:text-c-text-secondary"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && query && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="p-6 text-center text-c-text-muted">
              <Search size={32} className="mx-auto mb-2 opacity-50" />
              <p>No settings found for "{query}"</p>
            </div>
          ) : (
            <div className="divide-y divide-c-border-subtle dark:divide-white/10">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className="w-full p-4 flex items-center justify-between hover:bg-c-surface-raised dark:hover:bg-navy-950 text-left"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{result.icon}</span>
                    <div>
                      <p className="font-medium text-c-text">{result.title}</p>
                      <p className="text-sm text-c-text-muted">{result.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-c-surface-raised rounded text-xs text-c-text-secondary">
                      {result.category}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(result.id);
                      }}
                      className={`p-1 rounded ${favorites.includes(result.id) ? 'text-amber-500' : 'text-c-text-secondary hover:text-amber-400'}`}
                    >
                      <Star
                        size={16}
                        fill={favorites.includes(result.id) ? 'currentColor' : 'none'}
                      />
                    </button>
                    <ArrowRight size={16} className="text-c-text-secondary" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Access */}
      {!query && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Favorites */}
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4">
            <h3 className="font-semibold text-c-text mb-3 flex items-center gap-2">
              <Star size={16} className="text-amber-500" />
              Favorites
            </h3>
            {favoriteSettings.length === 0 ? (
              <p className="text-sm text-c-text-muted">Star settings to add them here</p>
            ) : (
              <div className="space-y-2">
                {favoriteSettings.map((setting) => (
                  <button
                    key={setting.id}
                    onClick={() => handleSelect(setting)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-950 text-left"
                  >
                    <span>{setting.icon}</span>
                    <span className="text-c-text-secondary">{setting.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Searches */}
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4">
            <h3 className="font-semibold text-c-text mb-3 flex items-center gap-2">
              <Clock size={16} className="text-c-text-secondary" />
              Recent Searches
            </h3>
            {recentSearches.length === 0 ? (
              <p className="text-sm text-c-text-muted">Your recent searches will appear here</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(search)}
                    className="px-3 py-1.5 bg-c-surface-raised rounded-full text-sm text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700"
                  >
                    {search}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Browse Categories */}
      {!query && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4">
          <h3 className="font-semibold text-c-text mb-3">Browse by Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              'Profile',
              'Security',
              'Privacy',
              'AI Preferences',
              'Notifications',
              'Integrations',
              'Appearance',
              'Advanced',
            ].map((cat) => (
              <button
                key={cat}
                onClick={() => setQuery(cat)}
                className="p-3 bg-c-surface-raised rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-800 text-left"
              >
                <p className="font-medium text-c-text-secondary">{cat}</p>
                <p className="text-xs text-c-text-muted mt-1">
                  {allSettings.filter((s) => s.category === cat).length} settings
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Keyboard Hint */}
      <div className="text-center text-sm text-c-text-secondary">
        Press <kbd className="px-2 py-0.5 bg-c-surface-raised rounded text-xs">⌘K</kbd> anywhere to
        search settings
      </div>
    </div>
  );
};

export default SettingsSearch;
