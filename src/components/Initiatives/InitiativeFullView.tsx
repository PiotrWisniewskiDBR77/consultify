/**
 * InitiativeFullView
 * Full-width view of initiative (Open Wider mode)
 * 
 * Location: src/components/Initiatives/InitiativeFullView.tsx
 */

import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  DollarSign,
  Edit2,
  Flag,
  ListTodo,
  Minimize2,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';
import { PortfolioInitiative, InitiativeStatus } from '@/types';
import { STATUS_METADATA } from '@/services/initiativeLifecycle';

interface InitiativeFullViewProps {
  initiative: PortfolioInitiative;
  onClose: () => void;
  onCollapse: () => void;
  onUpdate: (updated: PortfolioInitiative) => void;
}

type TabId = 'overview' | 'tasks' | 'decisions' | 'timeline' | 'resources';

export const InitiativeFullView: React.FC<InitiativeFullViewProps> = ({
  initiative,
  onClose,
  onCollapse,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editable fields
  const [title, setTitle] = useState(initiative.name || '');
  const [description, setDescription] = useState(initiative.description || '');
  const [priority, setPriority] = useState(initiative.priority || 'MEDIUM');

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Flag size={14} /> },
    { id: 'tasks', label: 'Tasks', icon: <ListTodo size={14} /> },
    { id: 'decisions', label: 'Decisions', icon: <ChevronDown size={14} /> },
    { id: 'timeline', label: 'Timeline', icon: <Calendar size={14} /> },
    { id: 'resources', label: 'Resources', icon: <Users size={14} /> },
  ];

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updated = await Api.patch(`/initiatives/${initiative.id}`, {
        name: title,
        description,
        priority,
      });
      onUpdate({ ...initiative, ...updated, name: title, description, priority });
      setIsEditing(false);
      toast.success('Initiative updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [initiative, title, description, priority, onUpdate]);

  const statusMeta = STATUS_METADATA[initiative.status as InitiativeStatus] || {
    label: initiative.status,
    color: 'slate',
    bgColor: 'bg-slate-500/20',
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-950 flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-navy-700 bg-navy-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-navy-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusMeta.bgColor} ${statusMeta.color}`}>
                  {statusMeta.label}
                </span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  priority === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                  priority === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                  priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {priority}
                </span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xl font-bold text-white bg-navy-800 border border-navy-600 rounded px-2 py-1 w-96"
                />
              ) : (
                <h1 className="text-xl font-bold text-white">{title}</h1>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCollapse}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-navy-700 rounded-lg transition-colors"
            >
              <Minimize2 size={16} />
              Collapse
            </button>
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg"
              >
                <Edit2 size={16} />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${activeTab === tab.id
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-slate-400 hover:text-white hover:bg-navy-700'}
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Main content */}
            <div className="col-span-2 space-y-6">
              {/* Description */}
              <div className="bg-navy-900 rounded-xl border border-navy-700 p-6">
                <h3 className="text-sm font-semibold text-slate-400 uppercase mb-4">Description</h3>
                {isEditing ? (
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-32 bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-white resize-none"
                    placeholder="Enter description..."
                  />
                ) : (
                  <p className="text-slate-300 leading-relaxed">
                    {description || 'No description provided.'}
                  </p>
                )}
              </div>

              {/* Summary */}
              {initiative.summary && (
                <div className="bg-navy-900 rounded-xl border border-navy-700 p-6">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase mb-4">Summary</h3>
                  <p className="text-slate-300 leading-relaxed">{initiative.summary}</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Key Metrics */}
              <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
                <h3 className="text-sm font-semibold text-slate-400 uppercase mb-4">Key Metrics</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400 flex items-center gap-2">
                      <DollarSign size={14} />
                      CAPEX
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {formatCurrency((initiative as any).costCapex || (initiative as any).cost_capex)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400 flex items-center gap-2">
                      <DollarSign size={14} />
                      OPEX
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {formatCurrency((initiative as any).costOpex || (initiative as any).cost_opex)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400 flex items-center gap-2">
                      <TrendingUp size={14} />
                      Expected ROI
                    </span>
                    <span className="text-sm font-semibold text-green-400">
                      {initiative.expectedRoi
                        ? `${initiative.expectedRoi.toFixed(1)}x`
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
                <h3 className="text-sm font-semibold text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <Calendar size={14} />
                  Timeline
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-slate-500">Start Date</span>
                    <div className="text-sm text-white">
                      {initiative.plannedStartDate
                        ? new Date(initiative.plannedStartDate).toLocaleDateString()
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">End Date</span>
                    <div className="text-sm text-white">
                      {initiative.plannedEndDate
                        ? new Date(initiative.plannedEndDate).toLocaleDateString()
                        : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ownership */}
              <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
                <h3 className="text-sm font-semibold text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <Users size={14} />
                  Ownership
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-slate-500">Business Owner</span>
                    <div className="text-sm text-white">
                      {initiative.ownerBusiness?.firstName
                        ? `${initiative.ownerBusiness.firstName} ${initiative.ownerBusiness.lastName}`
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Execution Owner</span>
                    <div className="text-sm text-white">
                      {initiative.ownerExecution?.firstName
                        ? `${initiative.ownerExecution.firstName} ${initiative.ownerExecution.lastName}`
                        : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="bg-navy-900 rounded-xl border border-navy-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Tasks</h3>
            <p className="text-slate-400">Task management coming soon...</p>
          </div>
        )}

        {activeTab === 'decisions' && (
          <div className="bg-navy-900 rounded-xl border border-navy-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Gate Decisions</h3>
            <p className="text-slate-400">Decision management coming soon...</p>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-navy-900 rounded-xl border border-navy-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Timeline & Milestones</h3>
            <p className="text-slate-400">Timeline view coming soon...</p>
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="bg-navy-900 rounded-xl border border-navy-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Resources & Capacity</h3>
            <p className="text-slate-400">Resource allocation coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InitiativeFullView;
