import React, { useCallback, useEffect, useState } from 'react';

interface MarketplaceExtension {
  id: string;
  name: string;
  description: string | null;
  version: string;
  author: string | null;
  icon_url: string | null;
  source_url: string;
  scopes: string[];
  category: string;
  install_count: number;
}

interface InstalledExtension extends MarketplaceExtension {
  install_config: Record<string, unknown>;
  installed_at: string;
}

interface ExtensionMarketplaceProps {
  baseId: string;
  onOpenExtension?: (ext: InstalledExtension) => void;
}

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'utility', label: 'Utility' },
  { key: 'visualization', label: 'Visualization' },
  { key: 'integration', label: 'Integration' },
  { key: 'automation', label: 'Automation' },
] as const;

const SCOPE_LABELS: Record<string, string> = {
  'records:read': 'Read records',
  'records:write': 'Write records',
  'metadata:read': 'Read schema',
  'metadata:write': 'Modify schema',
  network: 'Network access',
  ui: 'UI controls',
};

export const ExtensionMarketplace: React.FC<ExtensionMarketplaceProps> = ({
  baseId,
  onOpenExtension,
}) => {
  const [tab, setTab] = useState<'marketplace' | 'installed'>('installed');
  const [category, setCategory] = useState('all');
  const [marketplace, setMarketplace] = useState<MarketplaceExtension[]>([]);
  const [installed, setInstalled] = useState<InstalledExtension[]>([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<Set<string>>(new Set());

  const fetchMarketplace = useCallback(async () => {
    setLoading(true);
    try {
      const catParam = category !== 'all' ? `?category=${category}` : '';
      const resp = await fetch(`/api/table-platform/extensions/marketplace${catParam}`);
      if (resp.ok) setMarketplace(await resp.json());
    } finally {
      setLoading(false);
    }
  }, [category]);

  const fetchInstalled = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/table-platform/bases/${baseId}/extensions`);
      if (resp.ok) setInstalled(await resp.json());
    } finally {
      setLoading(false);
    }
  }, [baseId]);

  useEffect(() => {
    if (tab === 'marketplace') fetchMarketplace();
    else fetchInstalled();
  }, [tab, fetchMarketplace, fetchInstalled]);

  const handleInstall = async (extensionId: string) => {
    setInstalling((prev) => new Set(prev).add(extensionId));
    try {
      await fetch(`/api/table-platform/bases/${baseId}/extensions/${extensionId}/install`, {
        method: 'POST',
      });
      await fetchInstalled();
      await fetchMarketplace();
    } finally {
      setInstalling((prev) => {
        const next = new Set(prev);
        next.delete(extensionId);
        return next;
      });
    }
  };

  const handleUninstall = async (extensionId: string) => {
    await fetch(`/api/table-platform/bases/${baseId}/extensions/${extensionId}/uninstall`, {
      method: 'DELETE',
    });
    await fetchInstalled();
    await fetchMarketplace();
  };

  const installedIds = new Set(installed.map((e) => e.id));

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Tab bar */}
      <div className="flex items-center border-b px-4 gap-1">
        <button
          onClick={() => setTab('installed')}
          className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'installed'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Installed ({installed.length})
        </button>
        <button
          onClick={() => setTab('marketplace')}
          className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'marketplace'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Marketplace
        </button>
      </div>

      {/* Category filter (marketplace only) */}
      {tab === 'marketplace' && (
        <div className="flex items-center gap-1 px-4 py-2 border-b overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat.key
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-600 text-sm">
            Loading extensions...
          </div>
        ) : tab === 'marketplace' ? (
          marketplace.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-600">
              <p className="text-sm">No extensions available yet.</p>
              <p className="text-xs mt-1">Check back later or register your own.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketplace.map((ext) => (
                <ExtensionCard
                  key={ext.id}
                  extension={ext}
                  isInstalled={installedIds.has(ext.id)}
                  isInstalling={installing.has(ext.id)}
                  onInstall={() => handleInstall(ext.id)}
                  onUninstall={() => handleUninstall(ext.id)}
                />
              ))}
            </div>
          )
        ) : installed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-600">
            <p className="text-sm">No extensions installed.</p>
            <button
              onClick={() => setTab('marketplace')}
              className="mt-2 text-xs text-indigo-600 hover:text-indigo-700"
            >
              Browse marketplace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {installed.map((ext) => (
              <ExtensionCard
                key={ext.id}
                extension={ext}
                isInstalled
                isInstalling={false}
                onInstall={() => {}}
                onUninstall={() => handleUninstall(ext.id)}
                onOpen={onOpenExtension ? () => onOpenExtension(ext) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface ExtensionCardProps {
  extension: MarketplaceExtension;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onOpen?: () => void;
}

const ExtensionCard: React.FC<ExtensionCardProps> = ({
  extension,
  isInstalled,
  isInstalling,
  onInstall,
  onUninstall,
  onOpen,
}) => {
  const [showScopes, setShowScopes] = useState(false);

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        {extension.icon_url ? (
          <img
            src={extension.icon_url}
            alt=""
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-600 text-lg font-bold">
              {extension.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{extension.name}</h3>
          {extension.author && <p className="text-xs text-gray-500">by {extension.author}</p>}
        </div>
        <span className="text-xs text-gray-600 flex-shrink-0">v{extension.version}</span>
      </div>

      {extension.description && (
        <p className="text-xs text-gray-600 line-clamp-2">{extension.description}</p>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
          {extension.category}
        </span>
        <span>
          {extension.install_count} install{extension.install_count !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setShowScopes(!showScopes)}
          className="ml-auto text-gray-600 hover:text-gray-600"
        >
          {extension.scopes.length} scope{extension.scopes.length !== 1 ? 's' : ''}
        </button>
      </div>

      {showScopes && (
        <div className="flex flex-wrap gap-1">
          {extension.scopes.map((scope) => (
            <span
              key={scope}
              className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]"
            >
              {SCOPE_LABELS[scope] ?? scope}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1">
        {isInstalled ? (
          <>
            {onOpen && (
              <button
                onClick={onOpen}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
              >
                Open
              </button>
            )}
            <button
              onClick={onUninstall}
              className="px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 rounded hover:bg-rose-100 transition-colors"
            >
              Uninstall
            </button>
          </>
        ) : (
          <button
            onClick={onInstall}
            disabled={isInstalling}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isInstalling ? 'Installing...' : 'Install'}
          </button>
        )}
      </div>
    </div>
  );
};
