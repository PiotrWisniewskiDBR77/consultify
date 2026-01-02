/**
 * APIAccessSettings - API access and key management
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Plus, Copy, Trash2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface APIKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed?: string;
}

interface APIAccessSettingsProps {
  className?: string;
}

export const APIAccessSettings: React.FC<APIAccessSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/user/api-keys', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setKeys(data);
      }
    } catch (_error) {
      // Mock data
      setKeys([
        { id: '1', name: 'Production Key', prefix: 'ck_prod_', createdAt: '2024-01-15', lastUsed: '2 hours ago' },
        { id: '2', name: 'Development', prefix: 'ck_dev_', createdAt: '2024-02-20' },
      ]);
    }
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    
    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: newKeyName })
      });
      
      if (response.ok) {
        const data = await response.json();
        setNewKey(data.key);
        setKeys(prev => [...prev, data.keyInfo]);
        toast.success(t('settings.api.keyCreated', 'API key created'));
      }
    } catch (_error) {
      // Mock creation
      setNewKey('ck_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      setKeys(prev => [...prev, {
        id: String(Date.now()),
        name: newKeyName,
        prefix: 'ck_live_',
        createdAt: new Date().toISOString().split('T')[0]
      }]);
    }
    
    setNewKeyName('');
    setShowNew(false);
  };

  const deleteKey = async (keyId: string) => {
    if (!confirm(t('settings.api.deleteConfirm', 'Are you sure you want to delete this API key?'))) return;
    
    try {
      await fetch(`/api/user/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setKeys(prev => prev.filter(k => k.id !== keyId));
      toast.success(t('settings.api.keyDeleted', 'API key deleted'));
    } catch (_error) {
      toast.error(t('settings.api.deleteError', 'Failed to delete key'));
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success(t('common.copied', 'Copied to clipboard'));
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Key size={20} />
            {t('settings.api.title', 'API Access')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('settings.api.desc', 'Manage API keys for programmatic access.')}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-3 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
        >
          <Plus size={16} />
          {t('settings.api.createKey', 'Create Key')}
        </button>
      </div>

      {/* New Key Warning */}
      {newKey && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
            {t('settings.api.newKeyWarning', 'Save this key now. You won\'t be able to see it again.')}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white dark:bg-navy-800 rounded text-sm font-mono">
              {newKey}
            </code>
            <button
              onClick={() => copyKey(newKey)}
              className="p-2 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded"
            >
              <Copy size={16} />
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-2 text-sm text-amber-700 dark:text-amber-300 underline"
          >
            {t('settings.api.dismiss', 'I\'ve saved my key')}
          </button>
        </div>
      )}

      {/* Create Key Form */}
      {showNew && (
        <div className="p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('settings.api.keyName', 'Key Name')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t('settings.api.keyNamePlaceholder', 'e.g., Production API')}
              className="flex-1 px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800"
            />
            <button
              onClick={createKey}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark"
            >
              {t('common.create', 'Create')}
            </button>
            <button
              onClick={() => { setShowNew(false); setNewKeyName(''); }}
              className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="space-y-3">
        {keys.map((key) => (
          <div
            key={key.id}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg"
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-white">{key.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {key.prefix}••••••••••••
                {key.lastUsed && ` · ${t('settings.api.lastUsed', 'Last used')}: ${key.lastUsed}`}
              </p>
            </div>
            <button
              onClick={() => deleteKey(key.id)}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default APIAccessSettings;


