/**
 * StudioLinkModal - Link diagram to Task/Project/Initiative
 */

import { Check, CheckSquare, FolderKanban, Link2, Loader2, Rocket, Search, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

interface StudioLinkModalProps {
  documentId: string;
  currentLinks: {
    taskId?: string;
    projectId?: string;
    initiativeId?: string;
  };
  onLink: (links: {
    linkedTaskId?: string;
    linkedProjectId?: string;
    linkedInitiativeId?: string;
  }) => void;
  onClose: () => void;
}

interface LinkableItem {
  id: string;
  name: string;
  type: 'task' | 'project' | 'initiative';
}

export const StudioLinkModal: React.FC<StudioLinkModalProps> = ({
  documentId,
  currentLinks,
  onLink,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'task' | 'project' | 'initiative'>('task');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<LinkableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(currentLinks.taskId);
  const [selectedProjectId, setSelectedProjectId] = useState(currentLinks.projectId);
  const [selectedInitiativeId, setSelectedInitiativeId] = useState(currentLinks.initiativeId);

  // Load items based on active tab
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        let response;
        if (activeTab === 'task') {
          response = await Api.get('/api/tasks');
          setItems(
            (response.data || response || []).map((t: any) => ({
              id: t.id,
              name: t.title,
              type: 'task' as const,
            }))
          );
        } else if (activeTab === 'project') {
          response = await Api.get('/api/projects');
          setItems(
            (response.data || response || []).map((p: any) => ({
              id: p.id,
              name: p.name,
              type: 'project' as const,
            }))
          );
        } else {
          response = await Api.get('/api/initiatives');
          setItems(
            (response.data || response || []).map((i: any) => ({
              id: i.id,
              name: i.name,
              type: 'initiative' as const,
            }))
          );
        }
      } catch (error) {
        console.error('Failed to load items:', error);
        toast.error('Failed to load items');
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [activeTab]);

  // Filter items
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle item selection
  const handleSelect = (item: LinkableItem) => {
    if (item.type === 'task') {
      setSelectedTaskId(selectedTaskId === item.id ? undefined : item.id);
    } else if (item.type === 'project') {
      setSelectedProjectId(selectedProjectId === item.id ? undefined : item.id);
    } else {
      setSelectedInitiativeId(selectedInitiativeId === item.id ? undefined : item.id);
    }
  };

  // Handle save
  const handleSave = () => {
    onLink({
      linkedTaskId: selectedTaskId,
      linkedProjectId: selectedProjectId,
      linkedInitiativeId: selectedInitiativeId,
    });
  };

  // Get selected ID for current tab
  const getSelectedId = () => {
    if (activeTab === 'task') return selectedTaskId;
    if (activeTab === 'project') return selectedProjectId;
    return selectedInitiativeId;
  };

  const tabs = [
    { id: 'task' as const, label: 'Tasks', icon: <CheckSquare size={16} /> },
    { id: 'project' as const, label: 'Projects', icon: <FolderKanban size={16} /> },
    { id: 'initiative' as const, label: 'Initiatives', icon: <Rocket size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-c-surface border border-c-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-c-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-c-accent-soft flex items-center justify-center">
              <Link2 size={20} className="text-c-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-c-text">Link Diagram</h2>
              <p className="text-xs text-c-text-muted">
                Connect to tasks, projects, or initiatives
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-c-border-subtle">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                                flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors
                                ${
                                  activeTab === tab.id
                                    ? 'text-c-text border-b-2 border-c-accent bg-c-surface-raised'
                                    : 'text-c-text-muted hover:text-c-text hover:bg-c-surface-raised'
                                }
                            `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-4 border-b border-c-border-subtle">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}s...`}
              className="w-full pl-9 pr-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm text-c-text placeholder-c-text-muted focus:outline-none focus:ring-1 focus:ring-c-focus"
            />
          </div>
        </div>

        {/* Items List */}
        <div className="max-h-64 overflow-y-auto p-4 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="text-c-text-muted animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-sm text-c-text-muted">
              No {activeTab}s found
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`
                                    w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left
                                    ${
                                      getSelectedId() === item.id
                                        ? 'bg-c-accent-soft border border-c-accent'
                                        : 'hover:bg-c-surface-raised border border-transparent'
                                    }
                                `}
              >
                <div
                  className={`
                                    w-5 h-5 rounded border-2 flex items-center justify-center shrink-0
                                    ${getSelectedId() === item.id ? 'border-c-accent bg-c-accent' : 'border-c-border-strong'}
                                `}
                >
                  {getSelectedId() === item.id && <Check size={12} className="text-white" />}
                </div>
                <span className="text-sm text-c-text truncate flex-1">{item.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Current Links Summary */}
        <div className="px-4 py-3 bg-c-surface-raised border-t border-c-border-subtle">
          <div className="text-xs text-c-text-muted">
            Currently linked to:{' '}
            {selectedTaskId || selectedProjectId || selectedInitiativeId ? (
              <span className="text-c-text-secondary">
                {[
                  selectedTaskId && '1 task',
                  selectedProjectId && '1 project',
                  selectedInitiativeId && '1 initiative',
                ]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            ) : (
              <span className="text-c-text-muted">Nothing</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-c-border-subtle">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-c-text-secondary hover:text-c-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-c-accent hover:bg-c-accent text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Link2 size={14} />
            Save Links
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudioLinkModal;
