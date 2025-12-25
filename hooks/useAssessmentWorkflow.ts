/**
 * useAssessmentWorkflow Hook
 * Manages assessment workflow state, reviews, and approval process
 */

import { useState, useCallback, useEffect } from 'react';

// Types
export type WorkflowState = 'DRAFT' | 'IN_REVIEW' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
export type ReviewStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface WorkflowStatus {
    id: string;
    assessmentId: string;
    projectId: string;
    organizationId: string;
    status: WorkflowState;
    currentVersion: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    completedReviews: number;
    totalReviews: number;
    reviewProgress: number;
    canSubmitForReview: boolean;
    canApprove: boolean;
    slaDeadline?: string;
    isOverdue?: boolean;
}

export interface AssessmentReview {
    id: string;
    workflowId: string;
    assessmentId: string;
    reviewerId: string;
    reviewerName: string;
    reviewerEmail?: string;
    status: ReviewStatus;
    feedback?: string;
    rating?: number;
    assignedAt: string;
    startedAt?: string;
    completedAt?: string;
}

export interface WorkflowTransition {
    id: string;
    workflowId: string;
    fromStatus: WorkflowState;
    toStatus: WorkflowState;
    triggeredBy: string;
    triggeredByName?: string;
    reason?: string;
    timestamp: string;
}

export interface AssessmentVersion {
    id: string;
    assessmentId: string;
    version: number;
    data: any; // Full assessment snapshot
    createdAt: string;
    createdBy: string;
    createdByName?: string;
    changeLog?: string;
}

interface UseAssessmentWorkflowReturn {
    // State
    workflowStatus: WorkflowStatus | null;
    reviews: AssessmentReview[];
    versions: AssessmentVersion[];
    history: WorkflowTransition[];
    isLoading: boolean;
    error: string | null;
    
    // Computed
    canSubmitForReview: boolean;
    canApprove: boolean;
    canReject: boolean;
    isOverdue: boolean;
    reviewProgress: number;
    
    // Actions
    fetchWorkflowStatus: () => Promise<void>;
    fetchReviews: () => Promise<void>;
    fetchVersions: () => Promise<void>;
    fetchHistory: () => Promise<void>;
    initializeWorkflow: () => Promise<WorkflowStatus | null>;
    submitForReview: (reviewerIds: string[], message?: string) => Promise<boolean>;
    approve: (comments?: string) => Promise<boolean>;
    reject: (reason: string) => Promise<boolean>;
    submitReview: (reviewId: string, feedback: string, rating?: number) => Promise<boolean>;
    restoreVersion: (version: number) => Promise<boolean>;
    clearError: () => void;
}

export const useAssessmentWorkflow = (assessmentId: string | null): UseAssessmentWorkflowReturn => {
    // State
    const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
    const [reviews, setReviews] = useState<AssessmentReview[]>([]);
    const [versions, setVersions] = useState<AssessmentVersion[]>([]);
    const [history, setHistory] = useState<WorkflowTransition[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // API helper
    const apiCall = useCallback(async <T>(
        endpoint: string,
        method: 'GET' | 'POST' = 'GET',
        body?: any
    ): Promise<T | null> => {
        try {
            const response = await fetch(`/api/assessment-workflow${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: body ? JSON.stringify(body) : undefined
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API error: ${response.statusText}`);
            }

            return await response.json();
        } catch (err: any) {
            console.error(`[useAssessmentWorkflow] API error:`, err);
            setError(err.message);
            return null;
        }
    }, []);

    // Fetch workflow status
    const fetchWorkflowStatus = useCallback(async () => {
        if (!assessmentId) return;
        
        setIsLoading(true);
        setError(null);
        
        const status = await apiCall<WorkflowStatus>(`/${assessmentId}/status`);
        if (status) {
            setWorkflowStatus(status);
        }
        
        setIsLoading(false);
    }, [assessmentId, apiCall]);

    // Fetch reviews
    const fetchReviews = useCallback(async () => {
        if (!assessmentId) return;
        
        // Reviews are typically fetched with workflow status
        // But we can also get pending reviews separately
        const pendingReviews = await apiCall<{ reviews: AssessmentReview[] }>('/pending-reviews');
        if (pendingReviews?.reviews) {
            // Filter for current assessment
            const filteredReviews = pendingReviews.reviews.filter(
                r => r.assessmentId === assessmentId
            );
            setReviews(filteredReviews);
        }
    }, [assessmentId, apiCall]);

    // Fetch versions
    const fetchVersions = useCallback(async () => {
        if (!assessmentId) return;
        
        const versionsData = await apiCall<{ versions: AssessmentVersion[] }>(`/${assessmentId}/versions`);
        if (versionsData?.versions) {
            setVersions(versionsData.versions);
        }
    }, [assessmentId, apiCall]);

    // Fetch history
    const fetchHistory = useCallback(async () => {
        if (!assessmentId) return;
        
        const historyData = await apiCall<{ history: WorkflowTransition[] }>(`/${assessmentId}/history`);
        if (historyData?.history) {
            setHistory(historyData.history);
        }
    }, [assessmentId, apiCall]);

    // Initialize workflow for new assessment
    const initializeWorkflow = useCallback(async (): Promise<WorkflowStatus | null> => {
        if (!assessmentId) return null;
        
        setIsLoading(true);
        setError(null);
        
        const result = await apiCall<WorkflowStatus>(`/${assessmentId}/initialize`, 'POST');
        if (result) {
            setWorkflowStatus(result);
        }
        
        setIsLoading(false);
        return result;
    }, [assessmentId, apiCall]);

    // Submit for review
    const submitForReview = useCallback(async (
        reviewerIds: string[],
        message?: string
    ): Promise<boolean> => {
        if (!assessmentId) return false;
        
        setIsLoading(true);
        setError(null);
        
        const result = await apiCall<{ success: boolean; workflow: WorkflowStatus }>(
            `/${assessmentId}/submit-for-review`,
            'POST',
            { reviewerIds, message }
        );
        
        if (result?.success) {
            setWorkflowStatus(result.workflow);
            await fetchReviews();
        }
        
        setIsLoading(false);
        return result?.success || false;
    }, [assessmentId, apiCall, fetchReviews]);

    // Approve
    const approve = useCallback(async (comments?: string): Promise<boolean> => {
        if (!assessmentId) return false;
        
        setIsLoading(true);
        setError(null);
        
        const result = await apiCall<{ success: boolean; workflow: WorkflowStatus }>(
            `/${assessmentId}/approve`,
            'POST',
            { comments }
        );
        
        if (result?.success) {
            setWorkflowStatus(result.workflow);
        }
        
        setIsLoading(false);
        return result?.success || false;
    }, [assessmentId, apiCall]);

    // Reject
    const reject = useCallback(async (reason: string): Promise<boolean> => {
        if (!assessmentId) return false;
        
        setIsLoading(true);
        setError(null);
        
        const result = await apiCall<{ success: boolean; workflow: WorkflowStatus }>(
            `/${assessmentId}/reject`,
            'POST',
            { reason }
        );
        
        if (result?.success) {
            setWorkflowStatus(result.workflow);
        }
        
        setIsLoading(false);
        return result?.success || false;
    }, [assessmentId, apiCall]);

    // Submit individual review
    const submitReview = useCallback(async (
        reviewId: string,
        feedback: string,
        rating?: number
    ): Promise<boolean> => {
        setIsLoading(true);
        setError(null);
        
        const result = await apiCall<{ success: boolean }>(
            `/reviews/${reviewId}/submit`,
            'POST',
            { feedback, rating }
        );
        
        if (result?.success) {
            await fetchWorkflowStatus();
            await fetchReviews();
        }
        
        setIsLoading(false);
        return result?.success || false;
    }, [apiCall, fetchWorkflowStatus, fetchReviews]);

    // Restore version
    const restoreVersion = useCallback(async (version: number): Promise<boolean> => {
        if (!assessmentId) return false;
        
        setIsLoading(true);
        setError(null);
        
        const result = await apiCall<{ success: boolean }>(
            `/${assessmentId}/restore/${version}`,
            'POST'
        );
        
        if (result?.success) {
            await fetchVersions();
            await fetchWorkflowStatus();
        }
        
        setIsLoading(false);
        return result?.success || false;
    }, [assessmentId, apiCall, fetchVersions, fetchWorkflowStatus]);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Auto-fetch on mount and assessmentId change
    useEffect(() => {
        if (assessmentId) {
            fetchWorkflowStatus();
        }
    }, [assessmentId, fetchWorkflowStatus]);

    // Computed values
    const canSubmitForReview = workflowStatus?.canSubmitForReview || false;
    const canApprove = workflowStatus?.canApprove || false;
    const canReject = workflowStatus?.status === 'IN_REVIEW' || workflowStatus?.status === 'AWAITING_APPROVAL';
    const isOverdue = workflowStatus?.isOverdue || false;
    const reviewProgress = workflowStatus?.reviewProgress || 0;

    return {
        // State
        workflowStatus,
        reviews,
        versions,
        history,
        isLoading,
        error,
        
        // Computed
        canSubmitForReview,
        canApprove,
        canReject,
        isOverdue,
        reviewProgress,
        
        // Actions
        fetchWorkflowStatus,
        fetchReviews,
        fetchVersions,
        fetchHistory,
        initializeWorkflow,
        submitForReview,
        approve,
        reject,
        submitReview,
        restoreVersion,
        clearError
    };
};

export default useAssessmentWorkflow;

