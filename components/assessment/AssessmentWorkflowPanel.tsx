/**
 * Assessment Workflow Panel
 * Enterprise-grade workflow management UI for assessments
 * Supports multi-stakeholder reviews, approval gates, and versioning
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckCircle, Clock, AlertTriangle, XCircle, Users,
    GitBranch, MessageSquare, FileCheck, Send, ThumbsUp,
    ThumbsDown, History, RotateCcw, ChevronRight, Shield,
    Eye, Edit3, Lock, Unlock, User
} from 'lucide-react';
import axios from 'axios';
import { useAppStore } from '../../store/useAppStore';

// Types
interface WorkflowStatus {
    id: string;
    status: 'DRAFT' | 'IN_REVIEW' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
    current_version: number;
    submitted_at?: string;
    approved_at?: string;
    rejected_at?: string;
    rejection_reason?: string;
    completed_reviews: number;
    total_reviews: number;
    canSubmitForReview: boolean;
    canApprove: boolean;
    reviewProgress: number;
}

interface Review {
    id: string;
    reviewer_id: string;
    reviewer_role: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
    rating?: number;
    comments?: string;
    recommendation?: 'APPROVE' | 'APPROVE_WITH_CHANGES' | 'REQUEST_CHANGES' | 'REJECT';
    completed_at?: string;
    due_date?: string;
    submitter_name?: string;
}

interface Version {
    id: string;
    version: number;
    created_at: string;
    created_by_name?: string;
    change_summary?: string;
}

interface Reviewer {
    userId: string;
    name: string;
    email: string;
    role: string;
}

interface Props {
    assessmentId: string;
    projectId: string;
    onStatusChange?: (status: string) => void;
}

// Status Configuration
const STATUS_CONFIG = {
    DRAFT: { 
        label: 'Draft', 
        color: 'bg-slate-500', 
        textColor: 'text-slate-600 dark:text-slate-400',
        icon: Edit3,
        description: 'Assessment is being edited'
    },
    IN_REVIEW: { 
        label: 'In Review', 
        color: 'bg-blue-500', 
        textColor: 'text-blue-600 dark:text-blue-400',
        icon: Users,
        description: 'Awaiting stakeholder reviews'
    },
    AWAITING_APPROVAL: { 
        label: 'Awaiting Approval', 
        color: 'bg-amber-500', 
        textColor: 'text-amber-600 dark:text-amber-400',
        icon: Clock,
        description: 'All reviews complete, pending final approval'
    },
    APPROVED: { 
        label: 'Approved', 
        color: 'bg-green-500', 
        textColor: 'text-green-600 dark:text-green-400',
        icon: CheckCircle,
        description: 'Assessment approved and locked'
    },
    REJECTED: { 
        label: 'Rejected', 
        color: 'bg-red-500', 
        textColor: 'text-red-600 dark:text-red-400',
        icon: XCircle,
        description: 'Requires revision'
    },
    ARCHIVED: { 
        label: 'Archived', 
        color: 'bg-gray-500', 
        textColor: 'text-gray-600 dark:text-gray-400',
        icon: History,
        description: 'Historical version'
    }
};

export const AssessmentWorkflowPanel: React.FC<Props> = ({
    assessmentId,
    projectId,
    onStatusChange
}) => {
    const { t } = useTranslation();
    const { currentUser } = useAppStore();
    
    const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'status' | 'reviews' | 'versions'>('status');
    
    // Modal states
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    
    // Form states
    const [selectedReviewers, setSelectedReviewers] = useState<Reviewer[]>([]);
    const [approvalNotes, setApprovalNotes] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

    useEffect(() => {
        if (assessmentId) {
            loadWorkflowData();
        }
    }, [assessmentId]);

    const loadWorkflowData = async () => {
        setLoading(true);
        try {
            const [statusRes, versionsRes] = await Promise.all([
                axios.get(`/api/assessment-workflow/${assessmentId}/status`),
                axios.get(`/api/assessment-workflow/${assessmentId}/versions`)
            ]);
            
            setWorkflow(statusRes.data);
            setVersions(versionsRes.data.versions || []);
            
            if (statusRes.data?.id) {
                // Load reviews if in review status
                if (['IN_REVIEW', 'AWAITING_APPROVAL'].includes(statusRes.data.status)) {
                    const reviewsRes = await axios.get(`/api/assessment-workflow/pending-reviews`);
                    setReviews(reviewsRes.data.reviews || []);
                }
            }
        } catch (error) {
            console.error('Error loading workflow data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitForReview = async () => {
        if (selectedReviewers.length === 0) return;
        
        try {
            await axios.post(`/api/assessment-workflow/${assessmentId}/submit-for-review`, {
                reviewers: selectedReviewers.map(r => ({ userId: r.userId, role: r.role }))
            });
            
            setShowSubmitModal(false);
            loadWorkflowData();
            onStatusChange?.('IN_REVIEW');
        } catch (error) {
            console.error('Error submitting for review:', error);
        }
    };

    const handleApprove = async () => {
        try {
            await axios.post(`/api/assessment-workflow/${assessmentId}/approve`, {
                approvalNotes
            });
            
            setShowApprovalModal(false);
            loadWorkflowData();
            onStatusChange?.('APPROVED');
        } catch (error) {
            console.error('Error approving assessment:', error);
        }
    };

    const handleReject = async () => {
        if (!rejectionReason) return;
        
        try {
            await axios.post(`/api/assessment-workflow/${assessmentId}/reject`, {
                rejectionReason
            });
            
            setShowRejectModal(false);
            loadWorkflowData();
            onStatusChange?.('REJECTED');
        } catch (error) {
            console.error('Error rejecting assessment:', error);
        }
    };

    const handleRestoreVersion = async () => {
        if (selectedVersion === null) return;
        
        try {
            await axios.post(`/api/assessment-workflow/${assessmentId}/restore/${selectedVersion}`);
            
            setShowRestoreModal(false);
            setSelectedVersion(null);
            loadWorkflowData();
        } catch (error) {
            console.error('Error restoring version:', error);
        }
    };

    if (loading) {
        return (
            <div className="p-4 bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-white/10">
                <div className="animate-pulse flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-200 dark:bg-navy-700 rounded-full" />
                    <div className="flex-1">
                        <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded w-32 mb-2" />
                        <div className="h-3 bg-slate-200 dark:bg-navy-700 rounded w-48" />
                    </div>
                </div>
            </div>
        );
    }

    if (!workflow) {
        return (
            <div className="p-4 bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-white/10">
                <div className="text-center py-4">
                    <Shield className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        No workflow initialized
                    </p>
                    <button
                        onClick={async () => {
                            await axios.post(`/api/assessment-workflow/${assessmentId}/initialize`, { projectId });
                            loadWorkflowData();
                        }}
                        className="mt-3 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                    >
                        Initialize Workflow
                    </button>
                </div>
            </div>
        );
    }

    const statusConfig = STATUS_CONFIG[workflow.status];
    const StatusIcon = statusConfig.icon;

    return (
        <div className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${statusConfig.color} flex items-center justify-center`}>
                            <StatusIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-navy-900 dark:text-white">
                                    {statusConfig.label}
                                </h3>
                                <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-navy-800 rounded text-slate-600 dark:text-slate-400">
                                    v{workflow.current_version}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {statusConfig.description}
                            </p>
                        </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        {workflow.canSubmitForReview && (
                            <button
                                onClick={() => setShowSubmitModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Send size={14} />
                                Submit for Review
                            </button>
                        )}
                        
                        {workflow.canApprove && (
                            <>
                                <button
                                    onClick={() => setShowApprovalModal(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <ThumbsUp size={14} />
                                    Approve
                                </button>
                                <button
                                    onClick={() => setShowRejectModal(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    <ThumbsDown size={14} />
                                    Reject
                                </button>
                            </>
                        )}
                    </div>
                </div>
                
                {/* Review Progress */}
                {['IN_REVIEW', 'AWAITING_APPROVAL'].includes(workflow.status) && (
                    <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                            <span>Review Progress</span>
                            <span>{workflow.completed_reviews}/{workflow.total_reviews} reviews completed</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-500"
                                style={{ width: `${workflow.reviewProgress}%` }}
                            />
                        </div>
                    </div>
                )}
                
                {/* Rejection Reason */}
                {workflow.status === 'REJECTED' && workflow.rejection_reason && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-700 dark:text-red-300">Rejection Reason</p>
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{workflow.rejection_reason}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10">
                {[
                    { id: 'status', label: 'Status', icon: Eye },
                    { id: 'reviews', label: 'Reviews', icon: Users },
                    { id: 'versions', label: 'History', icon: History }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>
            
            {/* Tab Content */}
            <div className="p-4">
                {activeTab === 'status' && (
                    <WorkflowTimeline workflow={workflow} />
                )}
                
                {activeTab === 'reviews' && (
                    <ReviewsList 
                        reviews={reviews} 
                        onRefresh={loadWorkflowData}
                    />
                )}
                
                {activeTab === 'versions' && (
                    <VersionHistory 
                        versions={versions}
                        currentVersion={workflow.current_version}
                        onRestore={(version) => {
                            setSelectedVersion(version);
                            setShowRestoreModal(true);
                        }}
                    />
                )}
            </div>

            {/* Submit for Review Modal */}
            {showSubmitModal && (
                <SubmitForReviewModal
                    onClose={() => setShowSubmitModal(false)}
                    onSubmit={handleSubmitForReview}
                    selectedReviewers={selectedReviewers}
                    onReviewersChange={setSelectedReviewers}
                />
            )}

            {/* Approval Modal */}
            {showApprovalModal && (
                <ApprovalModal
                    onClose={() => setShowApprovalModal(false)}
                    onApprove={handleApprove}
                    notes={approvalNotes}
                    onNotesChange={setApprovalNotes}
                />
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <RejectModal
                    onClose={() => setShowRejectModal(false)}
                    onReject={handleReject}
                    reason={rejectionReason}
                    onReasonChange={setRejectionReason}
                />
            )}

            {/* Restore Version Modal */}
            {showRestoreModal && selectedVersion !== null && (
                <RestoreVersionModal
                    version={selectedVersion}
                    onClose={() => {
                        setShowRestoreModal(false);
                        setSelectedVersion(null);
                    }}
                    onRestore={handleRestoreVersion}
                />
            )}
        </div>
    );
};

// Sub-components

const WorkflowTimeline: React.FC<{ workflow: WorkflowStatus }> = ({ workflow }) => {
    const stages = [
        { id: 'DRAFT', label: 'Draft' },
        { id: 'IN_REVIEW', label: 'Review' },
        { id: 'AWAITING_APPROVAL', label: 'Approval' },
        { id: 'APPROVED', label: 'Approved' }
    ];
    
    const currentIndex = stages.findIndex(s => s.id === workflow.status);
    
    return (
        <div className="flex items-center justify-between">
            {stages.map((stage, index) => {
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;
                const isRejected = workflow.status === 'REJECTED' && index === currentIndex;
                
                return (
                    <React.Fragment key={stage.id}>
                        <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isCompleted ? 'bg-green-500' :
                                isRejected ? 'bg-red-500' :
                                isCurrent ? 'bg-blue-500' :
                                'bg-slate-200 dark:bg-navy-700'
                            }`}>
                                {isCompleted ? (
                                    <CheckCircle className="w-5 h-5 text-white" />
                                ) : isRejected ? (
                                    <XCircle className="w-5 h-5 text-white" />
                                ) : (
                                    <span className={`text-sm font-medium ${
                                        isCurrent ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                                    }`}>{index + 1}</span>
                                )}
                            </div>
                            <span className={`mt-2 text-xs font-medium ${
                                isCurrent ? 'text-navy-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                            }`}>{stage.label}</span>
                        </div>
                        
                        {index < stages.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-2 ${
                                index < currentIndex ? 'bg-green-500' : 'bg-slate-200 dark:bg-navy-700'
                            }`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const ReviewsList: React.FC<{ 
    reviews: Review[]; 
    onRefresh: () => void;
}> = ({ reviews, onRefresh }) => {
    if (reviews.length === 0) {
        return (
            <div className="text-center py-8">
                <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    No reviews assigned yet
                </p>
            </div>
        );
    }
    
    return (
        <div className="space-y-3">
            {reviews.map(review => (
                <div 
                    key={review.id}
                    className="p-3 bg-slate-50 dark:bg-navy-800 rounded-lg"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm font-medium">
                                {review.reviewer_role?.charAt(0) || 'R'}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-navy-900 dark:text-white">
                                    {review.reviewer_role || 'Reviewer'}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Due: {review.due_date ? new Date(review.due_date).toLocaleDateString() : 'No date set'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {review.status === 'COMPLETED' && review.recommendation && (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    review.recommendation === 'APPROVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    review.recommendation === 'REJECT' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                }`}>
                                    {review.recommendation.replace(/_/g, ' ')}
                                </span>
                            )}
                            
                            <span className={`w-2 h-2 rounded-full ${
                                review.status === 'COMPLETED' ? 'bg-green-500' :
                                review.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                                'bg-slate-300 dark:bg-slate-600'
                            }`} />
                        </div>
                    </div>
                    
                    {review.comments && (
                        <div className="mt-2 pl-11">
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                                "{review.comments}"
                            </p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const VersionHistory: React.FC<{
    versions: Version[];
    currentVersion: number;
    onRestore: (version: number) => void;
}> = ({ versions, currentVersion, onRestore }) => {
    if (versions.length === 0) {
        return (
            <div className="text-center py-8">
                <History className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    No version history available
                </p>
            </div>
        );
    }
    
    return (
        <div className="space-y-2">
            {versions.map(version => (
                <div 
                    key={version.id}
                    className={`p-3 rounded-lg flex items-center justify-between ${
                        version.version === currentVersion
                            ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
                            : 'bg-slate-50 dark:bg-navy-800'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            version.version === currentVersion
                                ? 'bg-purple-500 text-white'
                                : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
                        }`}>
                            v{version.version}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-navy-900 dark:text-white">
                                Version {version.version}
                                {version.version === currentVersion && (
                                    <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(Current)</span>
                                )}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(version.created_at).toLocaleString()}
                                {version.created_by_name && ` by ${version.created_by_name}`}
                            </p>
                        </div>
                    </div>
                    
                    {version.version !== currentVersion && (
                        <button
                            onClick={() => onRestore(version.version)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                        >
                            <RotateCcw size={12} />
                            Restore
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};

// Modal Components

const SubmitForReviewModal: React.FC<{
    onClose: () => void;
    onSubmit: () => void;
    selectedReviewers: Reviewer[];
    onReviewersChange: (reviewers: Reviewer[]) => void;
}> = ({ onClose, onSubmit, selectedReviewers, onReviewersChange }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [availableUsers, setAvailableUsers] = useState<Reviewer[]>([]);

    useEffect(() => {
        // Load team members
        const loadUsers = async () => {
            try {
                const res = await axios.get('/api/teams/members');
                setAvailableUsers(res.data.members || []);
            } catch (error) {
                console.error('Error loading team members:', error);
            }
        };
        loadUsers();
    }, []);

    const filteredUsers = availableUsers.filter(u => 
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleReviewer = (user: Reviewer) => {
        const isSelected = selectedReviewers.some(r => r.userId === user.userId);
        if (isSelected) {
            onReviewersChange(selectedReviewers.filter(r => r.userId !== user.userId));
        } else {
            onReviewersChange([...selectedReviewers, user]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-md mx-4">
                <div className="p-4 border-b border-slate-200 dark:border-white/10">
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                        Submit for Review
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Select stakeholders to review this assessment
                    </p>
                </div>
                
                <div className="p-4">
                    <input
                        type="text"
                        placeholder="Search team members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white text-sm"
                    />
                    
                    <div className="mt-3 max-h-48 overflow-y-auto space-y-2">
                        {filteredUsers.map(user => {
                            const isSelected = selectedReviewers.some(r => r.userId === user.userId);
                            return (
                                <button
                                    key={user.userId}
                                    onClick={() => toggleReviewer(user)}
                                    className={`w-full p-2 rounded-lg flex items-center gap-3 text-left transition-colors ${
                                        isSelected 
                                            ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
                                            : 'bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700'
                                    }`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm">
                                        {user.name?.charAt(0) || 'U'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-navy-900 dark:text-white truncate">
                                            {user.name}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            {user.role || user.email}
                                        </p>
                                    </div>
                                    {isSelected && (
                                        <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    
                    {selectedReviewers.length > 0 && (
                        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            {selectedReviewers.length} reviewer(s) selected
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSubmit}
                        disabled={selectedReviewers.length === 0}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Submit for Review
                    </button>
                </div>
            </div>
        </div>
    );
};

const ApprovalModal: React.FC<{
    onClose: () => void;
    onApprove: () => void;
    notes: string;
    onNotesChange: (notes: string) => void;
}> = ({ onClose, onApprove, notes, onNotesChange }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                            Approve Assessment
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            This will lock the assessment
                        </p>
                    </div>
                </div>
            </div>
            
            <div className="p-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Approval Notes (optional)
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    placeholder="Add any notes about this approval..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white text-sm resize-none"
                />
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                    Cancel
                </button>
                <button
                    onClick={onApprove}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                    Approve Assessment
                </button>
            </div>
        </div>
    </div>
);

const RejectModal: React.FC<{
    onClose: () => void;
    onReject: () => void;
    reason: string;
    onReasonChange: (reason: string) => void;
}> = ({ onClose, onReject, reason, onReasonChange }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                            Reject Assessment
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Send back for revision
                        </p>
                    </div>
                </div>
            </div>
            
            <div className="p-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={reason}
                    onChange={(e) => onReasonChange(e.target.value)}
                    placeholder="Explain why this assessment needs revision..."
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white text-sm resize-none"
                />
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                    Cancel
                </button>
                <button
                    onClick={onReject}
                    disabled={!reason.trim()}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Reject Assessment
                </button>
            </div>
        </div>
    </div>
);

const RestoreVersionModal: React.FC<{
    version: number;
    onClose: () => void;
    onRestore: () => void;
}> = ({ version, onClose, onRestore }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                        <RotateCcw className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                            Restore Version {version}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            This will create a new version with the old data
                        </p>
                    </div>
                </div>
            </div>
            
            <div className="p-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                        Current data will be preserved. The restored version will become a new draft.
                    </p>
                </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                    Cancel
                </button>
                <button
                    onClick={onRestore}
                    className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                    Restore Version
                </button>
            </div>
        </div>
    </div>
);

export default AssessmentWorkflowPanel;

