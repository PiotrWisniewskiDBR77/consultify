/**
 * RAIDLog
 *
 * Risks, Assumptions, Issues, Decisions & Dependencies log for initiative execution.
 * Professional PMO tool for tracking project health indicators.
 * Supports CRUD operations for all RAID item types.
 */

import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Edit2,
  Filter,
  HelpCircle,
  Link2,
  MoreHorizontal,
  Plus,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

type RAIDType = 'RISK' | 'ASSUMPTION' | 'ISSUE' | 'DEPENDENCY' | 'DECISION';
type RAIDStatus = 'OPEN' | 'MITIGATED' | 'REALIZED' | 'CLOSED';
type RAIDProbability = 'LOW' | 'MEDIUM' | 'HIGH';
type RAIDImpact = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface RAIDItem {
  id: string;
  type: RAIDType;
  title: string;
  description: string;
  status: RAIDStatus;
  probability?: RAIDProbability;
  impact?: RAIDImpact;
  mitigationPlan?: string;
  owner?: { id: string; firstName: string; lastName: string };
  dueDate?: string;
  initiativeId?: string;
  initiativeName?: string;
  createdAt: string;
  updatedAt: string;
  linkedItems?: string[];
}

interface RAIDLogProps {
  initiativeId?: string;
  projectId?: string;
  onItemClick?: (item: RAIDItem) => void;
}

const RAID_TYPES: Record<
  RAIDType,
  { label: string; icon: typeof AlertTriangle; color: string; bgColor: string }
> = {
  RISK: {
    label: 'Risk',
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  ASSUMPTION: {
    label: 'Assumption',
    icon: HelpCircle,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  ISSUE: {
    label: 'Issue',
    icon: AlertCircle,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
  },
  DEPENDENCY: {
    label: 'Dependency',
    icon: Link2,
    color: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
  },
  DECISION: {
    label: 'Decision',
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
};

export const RAIDLog: React.FC<RAIDLogProps> = ({ initiativeId, projectId, onItemClick }) => {
  const [items, setItems] = useState<RAIDItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RAIDType | 'ALL'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RAIDItem | null>(null);
  const [newItem, setNewItem] = useState<Partial<RAIDItem>>({
    type: 'RISK',
    status: 'OPEN',
  });

  useEffect(() => {
    fetchItems();
  }, [initiativeId, projectId]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      let url = '/raid';
      const params: string[] = [];
      if (initiativeId) params.push(`initiativeId=${initiativeId}`);
      if (projectId) params.push(`projectId=${projectId}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      const response = await Api.get(url);
      setItems(Array.isArray(response) ? response : response?.items || []);
    } catch (err) {
      console.error('[RAIDLog] Error fetching RAID items:', err);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.title || !newItem.type) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      await Api.post('/raid', {
        ...newItem,
        initiativeId,
        projectId,
      });
      toast.success('Item added');
      setShowAddModal(false);
      setNewItem({ type: 'RISK', status: 'OPEN' });
      fetchItems();
    } catch (err) {
      toast.error('Failed to add item');
    }
  };

  const handleStatusChange = async (item: RAIDItem, newStatus: RAIDStatus) => {
    try {
      await Api.patch(`/raid/${item.id}`, { status: newStatus });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)));
      toast.success('Status updated');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const filteredItems = items.filter((item) => activeTab === 'ALL' || item.type === activeTab);

  const handleDeleteItem = async (itemId: string) => {
    try {
      await Api.delete(`/raid/${itemId}`);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success('Item deleted');
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const handleEditItem = async () => {
    if (!editingItem) return;
    try {
      await Api.put(`/raid/${editingItem.id}`, {
        title: editingItem.title,
        description: editingItem.description,
        status: editingItem.status,
        severity: editingItem.impact || editingItem.probability,
        dueDate: editingItem.dueDate,
      });
      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? editingItem : i)));
      setEditingItem(null);
      toast.success('Item updated');
    } catch {
      toast.error('Failed to update item');
    }
  };

  const getCounts = () => ({
    ALL: items.filter((i) => i.status === 'OPEN').length,
    RISK: items.filter((i) => i.type === 'RISK' && i.status === 'OPEN').length,
    ISSUE: items.filter((i) => i.type === 'ISSUE' && i.status === 'OPEN').length,
    ASSUMPTION: items.filter((i) => i.type === 'ASSUMPTION' && i.status === 'OPEN').length,
    DEPENDENCY: items.filter((i) => i.type === 'DEPENDENCY' && i.status === 'OPEN').length,
    DECISION: items.filter((i) => i.type === 'DECISION' && i.status === 'OPEN').length,
  });

  const counts = getCounts();

  const getRiskScore = (item: RAIDItem): number => {
    const probScore = { LOW: 1, MEDIUM: 2, HIGH: 3 }[item.probability || 'LOW'];
    const impactScore = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[item.impact || 'LOW'];
    return probScore * impactScore;
  };

  const getRiskScoreColor = (score: number): string => {
    if (score >= 9) return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400';
    if (score >= 6) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
    if (score >= 3)
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  };

  const renderItem = (item: RAIDItem) => {
    const typeConfig = RAID_TYPES[item.type];
    const TypeIcon = typeConfig.icon;
    const riskScore = item.type === 'RISK' ? getRiskScore(item) : null;

    return (
      <div
        key={item.id}
        className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700 p-4 hover:border-slate-300 dark:hover:border-white/20 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Type Icon */}
          <div className={`p-2 rounded-lg ${typeConfig.bgColor}`}>
            <TypeIcon size={18} className={typeConfig.color} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${typeConfig.bgColor} ${typeConfig.color}`}
              >
                {typeConfig.label}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${
                  item.status === 'OPEN'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : item.status === 'MITIGATED'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : item.status === 'REALIZED'
                        ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                }`}
              >
                {item.status}
              </span>
              {riskScore !== null && (
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${getRiskScoreColor(riskScore)}`}
                >
                  Score: {riskScore}
                </span>
              )}
            </div>

            <h4 className="font-medium text-slate-900 dark:text-white mb-1">{item.title}</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
              {item.description}
            </p>

            {/* Risk/Issue details */}
            {(item.probability || item.impact) && (
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                {item.probability && (
                  <span>
                    Probability: <strong>{item.probability}</strong>
                  </span>
                )}
                {item.impact && (
                  <span>
                    Impact: <strong>{item.impact}</strong>
                  </span>
                )}
              </div>
            )}

            {/* Mitigation plan */}
            {item.mitigationPlan && (
              <div className="mt-2 p-2 bg-slate-50 dark:bg-navy-950 rounded text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Mitigation: </span>
                {item.mitigationPlan}
              </div>
            )}

            {/* Due date */}
            {item.dueDate && (
              <div className="flex items-center gap-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <Calendar size={12} />
                <span>Due: {new Date(item.dueDate).toLocaleDateString('pl-PL')}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditingItem(item)}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
            {item.status === 'OPEN' && (
              <>
                <button
                  onClick={() =>
                    handleStatusChange(item, item.type === 'RISK' ? 'MITIGATED' : 'CLOSED')
                  }
                  className="p-1.5 text-green-400 hover:bg-green-900/20 rounded"
                  title={item.type === 'RISK' ? 'Mark Mitigated' : 'Close'}
                >
                  <CheckCircle2 size={16} />
                </button>
                {item.type === 'RISK' && (
                  <button
                    onClick={() => handleStatusChange(item, 'REALIZED')}
                    className="p-1.5 text-rose-400 hover:bg-rose-900/20 rounded"
                    title="Mark Realized"
                  >
                    <XCircle size={16} />
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => {
                if (window.confirm('Delete this RAID item?')) {
                  handleDeleteItem(item.id);
                }
              }}
              className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-900/20 rounded"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-navy-800 rounded-lg overflow-x-auto">
          {(['ALL', 'RISK', 'ASSUMPTION', 'ISSUE', 'DECISION', 'DEPENDENCY'] as const).map(
            (tab) => {
              const config = tab === 'ALL' ? null : RAID_TYPES[tab];
              const Icon = config?.icon || AlertTriangle;
              const count = counts[tab];

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-white dark:bg-navy-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab === 'ALL' ? 'All' : <Icon size={14} className={config?.color} />}
                  {count > 0 && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        tab === 'ISSUE' && count > 0
                          ? 'bg-rose-900/30 text-rose-400'
                          : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Item
        </button>
      </div>

      {/* Items list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-slate-500 dark:text-slate-400">
            Loading...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500 dark:text-slate-400">
            <CheckCircle2 size={24} className="mb-2 text-green-500" />
            <span>No open items</span>
          </div>
        ) : (
          filteredItems.map(renderItem)
        )}
      </div>

      {/* Add Modal */}
      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-navy-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Edit {RAID_TYPES[editingItem.type]?.label || editingItem.type}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={(e) =>
                    setEditingItem((prev) => (prev ? { ...prev, title: e.target.value } : null))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={editingItem.description}
                  onChange={(e) =>
                    setEditingItem((prev) =>
                      prev ? { ...prev, description: e.target.value } : null
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editingItem.status}
                    onChange={(e) =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, status: e.target.value as RAIDStatus } : null
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
                  >
                    <option value="OPEN">Open</option>
                    <option value="MITIGATED">Mitigated</option>
                    <option value="REALIZED">Realized</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={
                      editingItem.dueDate
                        ? new Date(editingItem.dueDate).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      setEditingItem((prev) => (prev ? { ...prev, dueDate: e.target.value } : null))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              {editingItem.mitigationPlan !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mitigation Plan
                  </label>
                  <textarea
                    value={editingItem.mitigationPlan || ''}
                    onChange={(e) =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, mitigationPlan: e.target.value } : null
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
                    rows={2}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleEditItem}
                className="px-4 py-2 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-navy-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Add RAID Item</h3>

            <div className="space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Type
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(Object.keys(RAID_TYPES) as RAIDType[]).map((type) => {
                    const config = RAID_TYPES[type];
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => setNewItem((prev) => ({ ...prev, type }))}
                        className={`flex flex-col items-center p-3 rounded-lg border transition-colors ${
                          newItem.type === type
                            ? `${config.bgColor} border-current ${config.color}`
                            : 'border-slate-200 dark:border-navy-700 hover:border-slate-500'
                        }`}
                      >
                        <Icon
                          size={20}
                          className={
                            newItem.type === type
                              ? config.color
                              : 'text-slate-500 dark:text-slate-400'
                          }
                        />
                        <span className="text-xs mt-1 text-slate-700 dark:text-slate-300">
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={newItem.title || ''}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
                  placeholder="Brief title..."
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newItem.description || ''}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
                  rows={3}
                  placeholder="Detailed description..."
                />
              </div>

              {/* Probability & Impact (for Risks) */}
              {newItem.type === 'RISK' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Probability
                    </label>
                    <select
                      value={newItem.probability || 'MEDIUM'}
                      onChange={(e) =>
                        setNewItem((prev) => ({
                          ...prev,
                          probability: e.target.value as RAIDProbability,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Impact
                    </label>
                    <select
                      value={newItem.impact || 'MEDIUM'}
                      onChange={(e) =>
                        setNewItem((prev) => ({
                          ...prev,
                          impact: e.target.value as RAIDImpact,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Mitigation plan */}
              {(newItem.type === 'RISK' || newItem.type === 'ISSUE') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mitigation Plan
                  </label>
                  <textarea
                    value={newItem.mitigationPlan || ''}
                    onChange={(e) =>
                      setNewItem((prev) => ({ ...prev, mitigationPlan: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
                    rows={2}
                    placeholder="How will we mitigate this?"
                  />
                </div>
              )}

              {/* Due date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={
                    newItem.dueDate ? new Date(newItem.dueDate).toISOString().split('T')[0] : ''
                  }
                  onChange={(e) => setNewItem((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewItem({ type: 'RISK', status: 'OPEN' });
                }}
                className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="px-4 py-2 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RAIDLog;
