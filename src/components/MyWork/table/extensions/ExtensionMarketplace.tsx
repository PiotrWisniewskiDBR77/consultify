import React, { useCallback, useEffect, useState } from 'react';
// `TFunction` is exported by `i18next`, not by `react-i18next` — importing it from the
// latter compiles under esbuild (which strips types without checking them) and fails
// under `tsc` with TS2305.
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

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

const getCategories = (t: TFunction) =>
  [
    { key: 'all', label: t('myWorkTable.extensionMarketplace.categoryAll', 'All') },
    { key: 'utility', label: t('myWorkTable.extensionMarketplace.categoryUtility', 'Utility') },
    {
      key: 'visualization',
      label: t('myWorkTable.extensionMarketplace.categoryVisualization', 'Visualization'),
    },
    {
      key: 'integration',
      label: t('myWorkTable.extensionMarketplace.categoryIntegration', 'Integration'),
    },
    {
      key: 'automation',
      label: t('myWorkTable.extensionMarketplace.categoryAutomation', 'Automation'),
    },
  ] as const;

const getScopeLabels = (t: TFunction): Record<string, string> => ({
  'records:read': t('myWorkTable.extensionMarketplace.scopeRecordsRead', 'Read records'),
  'records:write': t('myWorkTable.extensionMarketplace.scopeRecordsWrite', 'Write records'),
  'metadata:read': t('myWorkTable.extensionMarketplace.scopeMetadataRead', 'Read schema'),
  'metadata:write': t('myWorkTable.extensionMarketplace.scopeMetadataWrite', 'Modify schema'),
  network: t('myWorkTable.extensionMarketplace.scopeNetwork', 'Network access'),
  ui: t('myWorkTable.extensionMarketplace.scopeUi', 'UI controls'),
});

export const ExtensionMarketplace: React.FC<ExtensionMarketplaceProps> = ({
  baseId,
  onOpenExtension,
}) => {
  const { t } = useTranslation();
  const CATEGORIES = getCategories(t);
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
    <div className="flex flex-col h-full bg-c-surface">
      {/* Tab bar */}
      <div className="flex items-center border-b px-4 gap-1">
        <button
          onClick={() => setTab('installed')}
          className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'installed'
              ? 'border-c-tag-2 text-c-tag-2'
              : 'border-transparent text-c-text-muted hover:text-c-text-secondary'
          }`}
        >
          {t('myWorkTable.extensionMarketplace.installedCount', 'Installed ({{count}})', { count: installed.length })}
        </button>
        <button
          onClick={() => setTab('marketplace')}
          className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'marketplace'
              ? 'border-c-tag-2 text-c-tag-2'
              : 'border-transparent text-c-text-muted hover:text-c-text-secondary'
          }`}
        >
          {t('myWorkTable.extensionMarketplace.marketplace', 'Marketplace')}
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
                  ? 'bg-c-tag-2 text-c-tag-2'
                  : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
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
          <div className="flex items-center justify-center py-12 text-c-text-secondary text-sm">
            {t('myWorkTable.extensionMarketplace.loadingExtensions', 'Loading extensions...')}
          </div>
        ) : tab === 'marketplace' ? (
          marketplace.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-c-text-secondary">
              <p className="text-sm">{t('myWorkTable.extensionMarketplace.noneAvailable', 'No extensions available yet.')}</p>
              <p className="text-xs mt-1">{t('myWorkTable.extensionMarketplace.checkBackLater', 'Check back later or register your own.')}</p>
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
          <div className="flex flex-col items-center justify-center py-12 text-c-text-secondary">
            <p className="text-sm">{t('myWorkTable.extensionMarketplace.noneInstalled', 'No extensions installed.')}</p>
            <button
              onClick={() => setTab('marketplace')}
              className="mt-2 text-xs text-c-tag-2 hover:text-c-tag-2"
            >
              {t('myWorkTable.extensionMarketplace.browseMarketplace', 'Browse marketplace')}
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
  const { t } = useTranslation();
  const SCOPE_LABELS = getScopeLabels(t);
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
          <div className="w-10 h-10 rounded-lg bg-c-tag-2 flex items-center justify-center flex-shrink-0">
            <span className="text-c-tag-2 text-lg font-bold">
              {extension.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-c-text truncate">{extension.name}</h3>
          {extension.author && (
            <p className="text-xs text-c-text-muted">
              {t('myWorkTable.extensionMarketplace.byAuthor', 'by {{author}}', {
                author: extension.author,
              })}
            </p>
          )}
        </div>
        <span className="text-xs text-c-text-secondary flex-shrink-0">v{extension.version}</span>
      </div>

      {extension.description && (
        <p className="text-xs text-c-text-secondary line-clamp-2">{extension.description}</p>
      )}

      <div className="flex items-center gap-2 text-xs text-c-text-secondary">
        <span className="px-1.5 py-0.5 bg-c-surface-raised rounded text-c-text-muted">
          {extension.category}
        </span>
        <span>
          {t('myWorkTable.extensionMarketplace.installCount', { count: extension.install_count })}
        </span>
        <button
          onClick={() => setShowScopes(!showScopes)}
          className="ml-auto text-c-text-secondary hover:text-c-text-secondary"
        >
          {t('myWorkTable.extensionHost.scopeCount', { count: extension.scopes.length })}
        </button>
      </div>

      {showScopes && (
        <div className="flex flex-wrap gap-1">
          {extension.scopes.map((scope) => (
            <span
              key={scope}
              className="px-1.5 py-0.5 bg-c-warning text-c-warning rounded text-[10px]"
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
                className="flex-1 px-3 py-1.5 text-xs font-medium text-c-text bg-c-tag-2 rounded hover:bg-c-tag-2 transition-colors"
              >
                {t('myWorkTable.extensionMarketplace.open', 'Open')}
              </button>
            )}
            <button
              onClick={onUninstall}
              className="px-3 py-1.5 text-xs font-medium text-c-danger bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] rounded hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] transition-colors"
            >
              {t('myWorkTable.extensionMarketplace.uninstall', 'Uninstall')}
            </button>
          </>
        ) : (
          <button
            onClick={onInstall}
            disabled={isInstalling}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-c-text bg-c-tag-2 rounded hover:bg-c-tag-2 disabled:opacity-50 transition-colors"
          >
            {isInstalling
              ? t('myWorkTable.extensionMarketplace.installing', 'Installing...')
              : t('myWorkTable.extensionMarketplace.install', 'Install')}
          </button>
        )}
      </div>
    </div>
  );
};
