/**
 * InitiativeManagementView
 *
 * @deprecated This view is replaced by PortfolioView (AppView.PORTFOLIO_ROADMAP)
 * which provides a unified Portfolio & Roadmap experience with List, Kanban,
 * Timeline, and Matrix views.
 *
 * Kept for backward compatibility. Routes redirect to PortfolioView.
 *
 * Module 2: Initiative Management
 * Shows initiatives in REVIEW and APPROVED status
 * Handles approval workflow and transfer to roadmap
 */

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  FileCheck,
  Filter,
  Lightbulb,
  Loader2,
  MapPin,
  MessageSquare,
  MoreVertical,
  RefreshCw,
  Search,
  Send,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { EmptyState } from '@/components/ui/composed/EmptyState';
import { LoadingState } from '@/components/ui/primitives';
import { Api } from '@/services/api';

import { InitiativeCompletenessChecker } from '../components/PMO/InitiativeCompletenessChecker';
import { StatusTransitionDropdown } from '../components/PMO/StatusTransitionDropdown';
import { InitiativeStatus } from '../types';

interface Initiative {
  id: string;
  name: string;
  summary?: string;
  axis: string;
  status: InitiativeStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  charterCompleteness?: number;
  businessValue?: number;
  costCapex?: number;
  expectedRoi?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  targetQuarter?: string;
  projectId?: string;
  projectName?: string;
  locationId?: string;
  locationName?: string;
  ownerBusiness?: { id: string; firstName: string; lastName: string; avatarUrl?: string };
  ownerExecution?: { id: string; firstName: string; lastName: string; avatarUrl?: string };
  reviewSubmittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

type TabType = 'review' | 'approved';

const PRIORITY_CONFIG = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CRITICAL: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
};

export const InitiativeManagementView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('review');
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterLocation, setFilterLocation] = useState<string>('');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [activeRowMenu, setActiveRowMenu] = useState<string | null>(null);
  const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'changes' | 'reject'>('approve');

  // Fetch initiatives based on active tab
  const fetchInitiatives = useCallback(async () => {
    setIsLoading(true);
    try {
      const statuses = activeTab === 'review' ? 'REVIEW' : 'APPROVED';
      const response = await Api.get(`/initiatives/by-status/${statuses}`);
      const mapped = (response.initiatives || []) as Initiative[];
      setInitiatives(mapped);

      // Extract unique projects and locations
      const uniqueProjects = new Map<string, string>();
      const uniqueLocations = new Map<string, string>();
      mapped.forEach((i: Initiative) => {
        if (i.projectId && i.projectName) {
          uniqueProjects.set(i.projectId, i.projectName);
        }
        if (i.locationId && i.locationName) {
          uniqueLocations.set(i.locationId, i.locationName);
        }
      });
      setProjects(Array.from(uniqueProjects, ([id, name]) => ({ id, name })));
      setLocations(Array.from(uniqueLocations, ([id, name]) => ({ id, name })));
    } catch (err) {
      console.error('[InitiativeManagement] Error:', err);
      toast.error('Failed to load initiatives');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchInitiatives();
  }, [fetchInitiatives]);

  // Handle status change
  const handleStatusChange = useCallback(
    (initiativeId: string, newStatus: InitiativeStatus, moduleTransition?: any) => {
      // Remove from current list if status moves to different module
      if (newStatus === InitiativeStatus.IN_EXECUTION || newStatus === InitiativeStatus.REJECTED) {
        setInitiatives((prev) => prev.filter((i) => i.id !== initiativeId));
      } else if (activeTab === 'review' && newStatus === InitiativeStatus.APPROVED) {
        // Move to approved tab
        setInitiatives((prev) => prev.filter((i) => i.id !== initiativeId));
      } else if (activeTab === 'approved' && newStatus === InitiativeStatus.PENDING_APPROVAL) {
        // Move back to review tab
        setInitiatives((prev) => prev.filter((i) => i.id !== initiativeId));
      } else {
        setInitiatives((prev) =>
          prev.map((i) => (i.id === initiativeId ? { ...i, status: newStatus } : i))
        );
      }
    },
    [activeTab]
  );

  // Handle review action (approve/request changes/reject)
  const handleReviewSubmit = async () => {
    if (!selectedInitiative) return;

    try {
      const newStatus =
        reviewAction === 'approve'
          ? InitiativeStatus.APPROVED
          : reviewAction === 'changes'
            ? InitiativeStatus.PENDING_APPROVAL
            : InitiativeStatus.REJECTED;

      await Api.patch(`/initiatives/${selectedInitiative.id}/status`, {
        status: newStatus,
        reason: reviewComment || undefined,
      });

      toast.success(
        reviewAction === 'approve'
          ? 'Initiative approved'
          : reviewAction === 'changes'
            ? 'Sent back for changes'
            : 'Initiative rejected'
      );

      handleStatusChange(selectedInitiative.id, newStatus);
      setShowReviewModal(false);
      setSelectedInitiative(null);
      setReviewComment('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Action failed');
    }
  };

  // Transfer to Roadmap (set quarter)
  const handleTransferToRoadmap = async (initiative: Initiative) => {
    // TODO: Show quarter selection modal
    try {
      await Api.patch(`/initiatives/${initiative.id}/status`, {
        status: InitiativeStatus.IN_EXECUTION,
      });
      toast.success('Initiative transferred to execution');
      handleStatusChange(initiative.id, InitiativeStatus.IN_EXECUTION);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Transfer failed');
    }
  };

  // Filter initiatives
  const filteredInitiatives = initiatives.filter((initiative) => {
    if (filterProject && initiative.projectId !== filterProject) return false;
    if (filterLocation && initiative.locationId !== filterLocation) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        initiative.name.toLowerCase().includes(query) ||
        (initiative.summary || '').toLowerCase().includes(query) ||
        (initiative.projectName || '').toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Format currency
  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '-';
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M PLN`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k PLN`;
    return `${amount} PLN`;
  };

  // Stats
  const reviewCount = initiatives.filter((i) => i.status === InitiativeStatus.PENDING_APPROVAL).length;
  const approvedCount = initiatives.filter((i) => i.status === InitiativeStatus.APPROVED).length;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
              Initiative Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Review and approve initiatives before execution
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-800/40 dark:bg-navy-950 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('review')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'review'
                ? 'bg-white dark:bg-navy-800 text-navy-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Send size={16} />
            In Review
            {reviewCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                {reviewCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'approved'
                ? 'bg-white dark:bg-navy-800 text-navy-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 size={16} />
            Approved
            {approvedCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                {approvedCount}
              </span>
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {projects.length > 0 && (
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {locations.length > 0 && (
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
            >
              <option value="">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex-1" />

          <div className="relative w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
              size={16}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search initiatives..."
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
            />
          </div>

          <button
            onClick={fetchInitiatives}
            className="p-1.5 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <LoadingState variant="spinner" className="h-64" />
        ) : filteredInitiatives.length === 0 ? (
          <EmptyState
            icon={activeTab === 'review' ? <Send /> : <CheckCircle2 />}
            title={
              activeTab === 'review' ? 'No initiatives awaiting review' : 'No approved initiatives'
            }
            description={
              activeTab === 'review'
                ? 'Initiatives submitted for review will appear here'
                : 'Approved initiatives ready for roadmap will appear here'
            }
          />
        ) : (
          <div className="grid gap-4">
            {filteredInitiatives.map((initiative) => (
              <div
                key={initiative.id}
                className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl shrink-0">
                    <Lightbulb className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-navy-900 dark:text-white text-lg">
                          {initiative.name}
                        </h3>
                        {initiative.summary && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {initiative.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-600 dark:text-slate-500">
                          <span>{initiative.axis}</span>
                          {initiative.projectName && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Building2 size={10} />
                                {initiative.projectName}
                              </span>
                            </>
                          )}
                          {initiative.locationName && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <MapPin size={10} />
                                {initiative.locationName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status & Actions */}
                      <div className="flex items-center gap-2">
                        <StatusTransitionDropdown
                          initiativeId={initiative.id}
                          currentStatus={initiative.status}
                          charterCompleteness={initiative.charterCompleteness}
                          onStatusChange={(newStatus, moduleTransition) =>
                            handleStatusChange(initiative.id, newStatus, moduleTransition)
                          }
                          size="md"
                        />
                      </div>
                    </div>

                    {/* Metrics Row */}
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-200 dark:border-navy-700">
                      {/* Owner */}
                      <div className="flex items-center gap-2">
                        {initiative.ownerBusiness ? (
                          <>
                            <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-medium text-primary-700 dark:text-primary-300 overflow-hidden">
                              {initiative.ownerBusiness.avatarUrl ? (
                                <img
                                  src={initiative.ownerBusiness.avatarUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                `${initiative.ownerBusiness.firstName[0]}${initiative.ownerBusiness.lastName[0]}`
                              )}
                            </div>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {initiative.ownerBusiness.firstName}{' '}
                              {initiative.ownerBusiness.lastName}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-600 dark:text-slate-500 italic">
                            No owner
                          </span>
                        )}
                      </div>

                      {/* Priority */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_CONFIG[initiative.priority]}`}
                      >
                        {initiative.priority}
                      </span>

                      {/* Budget */}
                      <div className="text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Budget: </span>
                        <span className="font-medium text-navy-900 dark:text-white">
                          {formatCurrency(initiative.costCapex)}
                        </span>
                      </div>

                      {/* ROI */}
                      {initiative.expectedRoi && initiative.expectedRoi > 0 && (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <TrendingUp size={14} />
                          <span className="text-sm font-medium">{initiative.expectedRoi}x ROI</span>
                        </div>
                      )}

                      {/* Completeness */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Charter:</span>
                        <InitiativeCompletenessChecker
                          initiative={initiative}
                          compact
                          className="w-16"
                        />
                      </div>

                      <div className="flex-1" />

                      {/* Action Buttons */}
                      {activeTab === 'review' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedInitiative(initiative);
                              setReviewAction('approve');
                              setShowReviewModal(true);
                            }}
                            className="px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedInitiative(initiative);
                              setReviewAction('changes');
                              setShowReviewModal(true);
                            }}
                            className="px-3 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                          >
                            Request Changes
                          </button>
                        </div>
                      )}

                      {activeTab === 'approved' && (
                        <button
                          onClick={() => handleTransferToRoadmap(initiative)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
                        >
                          <MapPin size={14} />
                          Start Execution
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedInitiative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              {reviewAction === 'approve' ? (
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="text-green-600 dark:text-green-400" size={24} />
                </div>
              ) : reviewAction === 'changes' ? (
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <MessageSquare className="text-amber-600 dark:text-amber-400" size={24} />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
                  <AlertTriangle className="text-danger-600 dark:text-danger-400" size={24} />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                  {reviewAction === 'approve'
                    ? 'Approve Initiative'
                    : reviewAction === 'changes'
                      ? 'Request Changes'
                      : 'Reject Initiative'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedInitiative.name}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {reviewAction === 'approve' ? 'Comments (optional)' : 'Reason / Feedback'}
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={
                  reviewAction === 'approve'
                    ? 'Add any comments...'
                    : reviewAction === 'changes'
                      ? 'What changes are needed?'
                      : 'Why is this being rejected?'
                }
                rows={4}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-navy-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedInitiative(null);
                  setReviewComment('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewSubmit}
                disabled={reviewAction !== 'approve' && !reviewComment.trim()}
                className={`px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 ${
                  reviewAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-500'
                    : reviewAction === 'changes'
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-danger-600 hover:bg-danger-500'
                }`}
              >
                {reviewAction === 'approve'
                  ? 'Approve'
                  : reviewAction === 'changes'
                    ? 'Send Back'
                    : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InitiativeManagementView;
