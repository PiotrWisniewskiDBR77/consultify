/**
 * useReportSections Hook
 * 
 * Manages report sections for the Report Builder:
 * - Fetch full report with sections
 * - Update section content
 * - Add/delete sections
 * - Reorder sections
 * - AI actions on sections
 * - Track unsaved changes
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// Types
export type SectionType = 
    | 'cover_page'
    | 'executive_summary'
    | 'methodology'
    | 'maturity_overview'
    | 'axis_detail'
    | 'area_detail'
    | 'gap_analysis'
    | 'initiatives'
    | 'recommendations'
    | 'next_steps'
    | 'roadmap'
    | 'appendix'
    | 'custom';

export type ReportStatus = 'DRAFT' | 'FINAL' | 'ARCHIVED';

export interface ReportSection {
    id: string;
    reportId: string;
    sectionType: SectionType;
    axisId?: string;
    areaId?: string;
    title: string;
    content: string;
    dataSnapshot: Record<string, any>;
    orderIndex: number;
    isAiGenerated: boolean;
    version?: number;
    lastEditedBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface FullReport {
    id: string;
    name: string;
    status: ReportStatus;
    assessmentId: string;
    assessmentName: string;
    projectName?: string;
    organizationName?: string;
    axisData: Record<string, {
        actual: number;
        target: number;
        justification?: string;
        areaScores?: Record<string, number>;
    }>;
    content?: {
        executiveSummary?: string;
        keyFindings?: string[];
        recommendations?: string[];
        notes?: string;
    };
    sections: ReportSection[];
    progress: number;
    isComplete: boolean;
    templateId?: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
}

export type AIAction = 'expand' | 'summarize' | 'translate' | 'improve' | 'regenerate';

interface UseReportSectionsReturn {
    // State
    report: FullReport | null;
    sections: ReportSection[];
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    hasUnsavedChanges: boolean;
    activeSection: string | null;
    
    // Actions
    fetchReport: () => Promise<void>;
    updateSection: (sectionId: string, content: string, title?: string) => Promise<boolean>;
    addSection: (sectionType: SectionType, options?: {
        axisId?: string;
        areaId?: string;
        title?: string;
        content?: string;
        orderIndex?: number;
    }) => Promise<ReportSection | null>;
    deleteSection: (sectionId: string) => Promise<boolean>;
    reorderSections: (sectionIds: string[]) => Promise<boolean>;
    aiAction: (sectionId: string, action: AIAction, options?: {
        targetLanguage?: string;
        customPrompt?: string;
    }) => Promise<boolean>;
    regenerateReport: (templateId?: string) => Promise<boolean>;
    finalizeReport: () => Promise<boolean>;
    exportPdf: () => Promise<void>;
    exportExcel: () => Promise<void>;
    setActiveSection: (sectionId: string | null) => void;
    clearError: () => void;
    markChangesSaved: () => void;
}

export const useReportSections = (reportId: string | null): UseReportSectionsReturn => {
    // State
    const [report, setReport] = useState<FullReport | null>(null);
    const [sections, setSections] = useState<ReportSection[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [activeSection, setActiveSection] = useState<string | null>(null);
    
    // Track pending updates for debouncing
    const pendingUpdates = useRef<Map<string, { content: string; title?: string }>>(new Map());
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch full report with sections
    const fetchReport = useCallback(async () => {
        if (!reportId) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports/${reportId}/full`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to fetch report');
            }
            
            const data: FullReport = await response.json();
            setReport(data);
            setSections(data.sections || []);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('[useReportSections] Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [reportId]);

    // Update section content
    const updateSection = useCallback(async (
        sectionId: string, 
        content: string, 
        title?: string
    ): Promise<boolean> => {
        if (!reportId) return false;
        
        // Optimistic update
        setSections(prev => prev.map(s => 
            s.id === sectionId 
                ? { ...s, content, title: title ?? s.title, isAiGenerated: false }
                : s
        ));
        setHasUnsavedChanges(true);
        
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports/${reportId}/sections/${sectionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({ content, title, saveHistory: true })
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to update section');
            }
            
            const result = await response.json();
            
            // Update version from server
            setSections(prev => prev.map(s => 
                s.id === sectionId 
                    ? { ...s, version: result.version, updatedAt: result.updatedAt }
                    : s
            ));
            
            setHasUnsavedChanges(false);
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('[useReportSections] Update error:', err);
            // Refetch to restore correct state
            await fetchReport();
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [reportId, fetchReport]);

    // Add new section
    const addSection = useCallback(async (
        sectionType: SectionType,
        options?: {
            axisId?: string;
            areaId?: string;
            title?: string;
            content?: string;
            orderIndex?: number;
        }
    ): Promise<ReportSection | null> => {
        if (!reportId) return null;
        
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports/${reportId}/sections`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    sectionType,
                    ...options
                })
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to add section');
            }
            
            const newSection: ReportSection = await response.json();
            
            setSections(prev => {
                const updated = [...prev, newSection];
                return updated.sort((a, b) => a.orderIndex - b.orderIndex);
            });
            
            return newSection;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('[useReportSections] Add section error:', err);
            return null;
        } finally {
            setIsSaving(false);
        }
    }, [reportId]);

    // Delete section
    const deleteSection = useCallback(async (sectionId: string): Promise<boolean> => {
        if (!reportId) return false;
        
        // Optimistic removal
        const prevSections = sections;
        setSections(prev => prev.filter(s => s.id !== sectionId));
        
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports/${reportId}/sections/${sectionId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to delete section');
            }
            
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('[useReportSections] Delete section error:', err);
            // Restore on error
            setSections(prevSections);
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [reportId, sections]);

    // Reorder sections
    const reorderSections = useCallback(async (sectionIds: string[]): Promise<boolean> => {
        if (!reportId) return false;
        
        // Optimistic reorder
        const prevSections = sections;
        setSections(prev => {
            const sectionMap = new Map(prev.map(s => [s.id, s]));
            return sectionIds.map((id, index) => {
                const section = sectionMap.get(id);
                return section ? { ...section, orderIndex: index } : null;
            }).filter(Boolean) as ReportSection[];
        });
        
        // Build sectionOrder array for backend
        const sectionOrder = sectionIds.map((id, index) => ({ id, orderIndex: index }));
        
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports/${reportId}/sections/reorder`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({ sectionOrder })
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to reorder sections');
            }
            
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('[useReportSections] Reorder error:', err);
            setSections(prevSections);
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [reportId, sections]);

    // AI action on section
    const aiAction = useCallback(async (
        sectionId: string,
        action: AIAction,
        options?: {
            targetLanguage?: string;
            customPrompt?: string;
        }
    ): Promise<boolean> => {
        if (!reportId) return false;
        
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports/${reportId}/sections/${sectionId}/ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    action,
                    ...options
                })
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'AI action failed');
            }
            
            const result = await response.json();
            
            // Update section with AI-generated content
            setSections(prev => prev.map(s => 
                s.id === sectionId 
                    ? { 
                        ...s, 
                        content: result.content, 
                        isAiGenerated: true,
                        version: result.version,
                        updatedAt: result.updatedAt
                    }
                    : s
            ));
            
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('[useReportSections] AI action error:', err);
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [reportId]);

    // Regenerate full report
    const regenerateReport = useCallback(async (templateId?: string): Promise<boolean> => {
        if (!reportId) return false;
        
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports/${reportId}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({ templateId, language: 'pl' })
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to regenerate report');
            }
            
            // Refetch to get new sections
            await fetchReport();
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('[useReportSections] Regenerate error:', err);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [reportId, fetchReport]);

    // Finalize report
    const finalizeReport = useCallback(async (): Promise<boolean> => {
        if (!reportId) return false;
        
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports/${reportId}/finalize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to finalize report');
            }
            
            setReport(prev => prev ? { ...prev, status: 'FINAL', isComplete: true } : null);
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('[useReportSections] Finalize error:', err);
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [reportId]);

    // Export to PDF
    const exportPdf = useCallback(async () => {
        if (!reportId) return;
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports/${reportId}/export/pdf`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to export PDF');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${report?.name || 'DRD_Report'}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('[useReportSections] Export PDF error:', err);
        }
    }, [reportId, report?.name]);

    // Export to Excel
    const exportExcel = useCallback(async () => {
        if (!reportId) return;
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports/${reportId}/export/excel`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to export Excel');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${report?.name || 'DRD_Report'}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('[useReportSections] Export Excel error:', err);
        }
    }, [reportId, report?.name]);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Mark changes as saved
    const markChangesSaved = useCallback(() => {
        setHasUnsavedChanges(false);
    }, []);

    // Fetch report on mount and when reportId changes
    useEffect(() => {
        if (reportId) {
            fetchReport();
        } else {
            setReport(null);
            setSections([]);
        }
    }, [reportId, fetchReport]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    return {
        // State
        report,
        sections,
        isLoading,
        isSaving,
        error,
        hasUnsavedChanges,
        activeSection,
        
        // Actions
        fetchReport,
        updateSection,
        addSection,
        deleteSection,
        reorderSections,
        aiAction,
        regenerateReport,
        finalizeReport,
        exportPdf,
        exportExcel,
        setActiveSection,
        clearError,
        markChangesSaved
    };
};

export default useReportSections;

