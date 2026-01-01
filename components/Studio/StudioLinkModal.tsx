/**
 * StudioLinkModal - Link diagram to Task/Project/Initiative
 */

import React, { useState, useEffect } from 'react';
import { 
    X, 
    Link2, 
    CheckSquare,
    FolderKanban,
    Rocket,
    Search,
    Loader2,
    Check
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';

interface StudioLinkModalProps {
    documentId: string;
    currentLinks: {
        taskId?: string;
        projectId?: string;
        initiativeId?: string;
    };
    onLink: (links: { linkedTaskId?: string; linkedProjectId?: string; linkedInitiativeId?: string }) => void;
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
    onClose
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
                    setItems((response.data || response || []).map((t: any) => ({
                        id: t.id,
                        name: t.title,
                        type: 'task' as const
                    })));
                } else if (activeTab === 'project') {
                    response = await Api.get('/api/projects');
                    setItems((response.data || response || []).map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        type: 'project' as const
                    })));
                } else {
                    response = await Api.get('/api/initiatives');
                    setItems((response.data || response || []).map((i: any) => ({
                        id: i.id,
                        name: i.name,
                        type: 'initiative' as const
                    })));
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
    const filteredItems = items.filter(item =>
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
            linkedInitiativeId: selectedInitiativeId
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
        { id: 'initiative' as const, label: 'Initiatives', icon: <Rocket size={16} /> }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Link2 size={20} className="text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Link Diagram</h2>
                            <p className="text-xs text-slate-500">Connect to tasks, projects, or initiatives</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors
                                ${activeTab === tab.id
                                    ? 'text-white border-b-2 border-blue-500 bg-white/5'
                                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="p-4 border-b border-white/5">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`Search ${activeTab}s...`}
                            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Items List */}
                <div className="max-h-64 overflow-y-auto p-4 space-y-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={20} className="text-slate-500 animate-spin" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-8 text-sm text-slate-500">
                            No {activeTab}s found
                        </div>
                    ) : (
                        filteredItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                className={`
                                    w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left
                                    ${getSelectedId() === item.id
                                        ? 'bg-blue-500/20 border border-blue-500/30'
                                        : 'hover:bg-white/5 border border-transparent'
                                    }
                                `}
                            >
                                <div className={`
                                    w-5 h-5 rounded border-2 flex items-center justify-center shrink-0
                                    ${getSelectedId() === item.id
                                        ? 'border-blue-500 bg-blue-500'
                                        : 'border-slate-600'
                                    }
                                `}>
                                    {getSelectedId() === item.id && <Check size={12} className="text-white" />}
                                </div>
                                <span className="text-sm text-white truncate flex-1">
                                    {item.name}
                                </span>
                            </button>
                        ))
                    )}
                </div>

                {/* Current Links Summary */}
                <div className="px-4 py-3 bg-white/5 border-t border-white/10">
                    <div className="text-xs text-slate-500">
                        Currently linked to:{' '}
                        {selectedTaskId || selectedProjectId || selectedInitiativeId ? (
                            <span className="text-slate-400">
                                {[
                                    selectedTaskId && '1 task',
                                    selectedProjectId && '1 project',
                                    selectedInitiativeId && '1 initiative'
                                ].filter(Boolean).join(', ')}
                            </span>
                        ) : (
                            <span className="text-slate-500">Nothing</span>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
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

