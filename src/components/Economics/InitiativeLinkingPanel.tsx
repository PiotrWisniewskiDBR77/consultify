/**
 * Initiative Linking Panel
 *
 * UI component for linking economic analyses to initiatives.
 * Provides search, selection, and bidirectional linking functionality.
 */

import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  ExternalLink,
  Link2,
  Rocket,
  Search,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { LoadingState, StatusChip, type StatusTone } from '../ui/primitives';

interface Initiative {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority?: string;
  projectName?: string;
  estimatedBudget?: number;
  startDate?: string;
  endDate?: string;
}

interface InitiativeLinkingPanelProps {
  analysisId: string;
  linkedInitiativeId?: string | null;
  onLink: (initiativeId: string) => Promise<void>;
  onUnlink?: () => Promise<void>;
}

const normalizeInitiativesPayload = (payload: unknown): Initiative[] => {
  if (Array.isArray(payload)) return payload as Initiative[];
  if (payload && typeof payload === 'object' && 'initiatives' in payload) {
    const candidate = (payload as { initiatives?: Initiative[] }).initiatives;
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
};

export const InitiativeLinkingPanel: React.FC<InitiativeLinkingPanelProps> = ({
  analysisId,
  linkedInitiativeId,
  onLink,
  onUnlink,
}) => {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [linkedInitiative, setLinkedInitiative] = useState<Initiative | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [showSelector, setShowSelector] = useState(false);

  // Load initiatives
  useEffect(() => {
    const loadInitiatives = async () => {
      setIsLoading(true);
      try {
        const response = (await (Api as any).getInitiatives?.()) || [];
        const normalized = normalizeInitiativesPayload((response as any).initiatives || response);
        setInitiatives(normalized);
      } catch (error) {
        console.error('Failed to load initiatives:', error);
        setInitiatives([]);
        toast.error('Failed to load initiatives');
      } finally {
        setIsLoading(false);
      }
    };

    if (showSelector) {
      loadInitiatives();
    }
  }, [showSelector]);

  // Load linked initiative details
  useEffect(() => {
    if (!linkedInitiativeId) {
      setLinkedInitiative(null);
      return;
    }

    const loadLinkedInitiative = async () => {
      try {
        let source = initiatives;
        if (source.length === 0) {
          const response = (await (Api as any).getInitiatives?.()) || [];
          source = normalizeInitiativesPayload((response as any).initiatives || response);
          setInitiatives(source);
        }
        const initiative = source.find((i) => i.id === linkedInitiativeId);
        if (initiative) {
          setLinkedInitiative(initiative);
        }
      } catch (error) {
        console.error('Failed to load linked initiative:', error);
        const found = initiatives.find((i) => i.id === linkedInitiativeId);
        if (found) setLinkedInitiative(found);
      }
    };
    loadLinkedInitiative();
  }, [linkedInitiativeId, initiatives]);

  const filteredInitiatives = initiatives.filter(
    (initiative) =>
      initiative.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      initiative.projectName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLink = async (initiative: Initiative) => {
    setIsLinking(true);
    try {
      await onLink(initiative.id);
      setLinkedInitiative(initiative);
      setShowSelector(false);
      toast.success(`Linked to initiative: ${initiative.name}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to link initiative');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!onUnlink) return;

    setIsLinking(true);
    try {
      await onUnlink();
      setLinkedInitiative(null);
      toast.success('Deleted link to initiative');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete link');
    } finally {
      setIsLinking(false);
    }
  };

  const getStatusTone = (status: string): StatusTone => {
    switch (status) {
      case 'active':
        return 'success';
      case 'planned':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'text-rose-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return 'text-slate-600 dark:text-slate-500';
    }
  };

  // Linked Initiative View
  if (linkedInitiative) {
    return (
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Link2 size={20} className="text-blue-500" />
            Linked inicjatywa
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSelector(true)}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              Change
            </button>
            {onUnlink && (
              <button
                onClick={handleUnlink}
                disabled={isLinking}
                className="px-3 py-1.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                Delete Link
              </button>
            )}
          </div>
        </div>

        <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-500/10 dark:to-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
              <Rocket size={24} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-navy-900 dark:text-white truncate">
                  {linkedInitiative.name}
                </h4>
                <StatusChip
                  tone={getStatusTone(linkedInitiative.status)}
                  label={
                    linkedInitiative.status === 'active'
                      ? 'Aktywna'
                      : linkedInitiative.status === 'planned'
                        ? 'Planowana'
                        : linkedInitiative.status === 'completed'
                          ? 'Completed'
                          : linkedInitiative.status
                  }
                />
              </div>

              {linkedInitiative.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                  {linkedInitiative.description}
                </p>
              )}

              <div className="flex items-center flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                {linkedInitiative.projectName && (
                  <div className="flex items-center gap-1">
                    <Building2 size={14} />
                    {linkedInitiative.projectName}
                  </div>
                )}
                {linkedInitiative.priority && (
                  <div
                    className={`flex items-center gap-1 ${getPriorityColor(linkedInitiative.priority)}`}
                  >
                    <Target size={14} />
                    Priorytet:{' '}
                    {linkedInitiative.priority === 'high'
                      ? 'Wysoki'
                      : linkedInitiative.priority === 'medium'
                        ? 'Medium'
                        : 'Niski'}
                  </div>
                )}
                {linkedInitiative.estimatedBudget && (
                  <div className="flex items-center gap-1">
                    <TrendingUp size={14} />
                    {new Intl.NumberFormat('pl-PL', {
                      style: 'currency',
                      currency: 'PLN',
                      maximumFractionDigits: 0,
                    }).format(linkedInitiative.estimatedBudget)}
                  </div>
                )}
              </div>
            </div>
            <a
              href={`/initiatives?open=${encodeURIComponent(linkedInitiative.id)}`}
              className="p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
              title="Open Initiative"
            >
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Selector Modal/Panel
  if (showSelector) {
    return (
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Link2 size={20} className="text-blue-500" />
            Select Initiative
          </h3>
          <button
            onClick={() => setShowSelector(false)}
            className="p-2 text-slate-600 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj inicjatyw..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            text-navy-900 dark:text-white placeholder-slate-400"
          />
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto space-y-2">
          {isLoading ? (
            <LoadingState variant="spinner" className="py-8" />
          ) : filteredInitiatives.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
              <p>No inicjatyw do wyboru</p>
            </div>
          ) : (
            filteredInitiatives.map((initiative) => (
              <button
                key={initiative.id}
                onClick={() => handleLink(initiative)}
                disabled={isLinking}
                className="w-full p-4 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl
                                    hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/10
                                    transition-all text-left group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                    <Rocket
                      size={18}
                      className="text-blue-500 group-hover:text-white transition-colors"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-navy-900 dark:text-white truncate">
                        {initiative.name}
                      </span>
                      <StatusChip
                        tone={getStatusTone(initiative.status)}
                        label={
                          initiative.status === 'active'
                            ? 'Aktywna'
                            : initiative.status === 'planned'
                              ? 'Planowana'
                              : initiative.status
                        }
                      />
                    </div>
                    {initiative.projectName && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {initiative.projectName}
                      </p>
                    )}
                  </div>
                  <Check
                    size={18}
                    className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // Empty State - No Link
  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
          <Link2 size={20} className="text-blue-500" />
          Initiative Linking
        </h3>
      </div>

      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto rounded-xl bg-slate-100 dark:bg-navy-800/40 dark:bg-navy-700 flex items-center justify-center mb-4">
          <Link2 size={32} className="text-slate-600 dark:text-slate-500" />
        </div>
        <h4 className="font-medium text-navy-900 dark:text-white mb-2">No linked initiative</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
          Link this analysis financial to initiative, to track benefits realization and integrate
          dane.
        </p>
        <button
          onClick={() => setShowSelector(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Select Initiative
        </button>
      </div>
    </div>
  );
};

export default InitiativeLinkingPanel;
