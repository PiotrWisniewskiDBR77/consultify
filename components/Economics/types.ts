/**
 * Economics Module Types
 *
 * Type definitions for digitization maturity assessments
 * Based on 6-axis evaluation framework with 7 levels per area
 */

// ============================================
// Core Types
// ============================================

export type AnalysisStatus = 'draft' | 'in_progress' | 'completed';

export interface DigitizationAnalysis {
    id: string;
    name: string;
    description?: string;
    status: AnalysisStatus;

    // Relationships
    projectId?: string;
    projectName?: string;
    organizationId: number;

    // Ownership
    createdBy: string;
    createdByName?: string;

    // Calculated Scores
    overallScore?: number;
    completionPercent: number;
    axisScores: Record<string, AxisScore>;

    // Import metadata
    importedFrom?: string;
    importDate?: string;

    // Timestamps
    createdAt: string;
    updatedAt: string;

    // Tags for filtering
    tags?: string[];
}

export interface AxisScore {
    axisId: string;
    currentScore: number;
    targetScore: number;
    completedAreas: number;
    totalAreas: number;
    gap: number;
    areaScores: Record<string, AreaScore>;
}

export interface AreaScore {
    areaId: string;
    areaCode: string;
    currentLevel: number;
    targetLevel: number;
    gap: number;
    notes?: string;
    evidence?: string[];
    justification?: string;
    assessedBy?: string;
    assessedAt?: string;
}

// ============================================
// Evaluation Framework Types
// ============================================

export interface LevelDescription {
    level: number;
    name: string;
    namePl: string;
    description: string;
    descriptionPl: string;
    example: string;
    examplePl: string;
    question: string;
    questionPl: string;
    initiative: string;
    initiativePl: string;
}

export interface EvaluationArea {
    id: string;
    code: string;
    name: string;
    namePl: string;
    description?: string;
    levels: LevelDescription[];
}

export interface DigitizationAxis {
    id: string;
    number: number;
    name: string;
    namePl: string;
    description: string;
    descriptionPl?: string;
    icon: string;
    color: string;
    areas: EvaluationArea[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateAnalysisRequest {
    name: string;
    description?: string;
    projectId?: string;
    tags?: string[];
}

export interface UpdateAnalysisRequest {
    name?: string;
    description?: string;
    status?: AnalysisStatus;
    projectId?: string;
    tags?: string[];
}

export interface UpdateScoreRequest {
    axisId: string;
    areaId: string;
    currentLevel: number;
    targetLevel: number;
    notes?: string;
    evidence?: string[];
    justification?: string;
}

export interface AnalysisListResponse {
    analyses: DigitizationAnalysis[];
    total: number;
    page: number;
    pageSize: number;
}

export interface AnalysisFilters {
    status?: AnalysisStatus | 'all';
    projectId?: string;
    search?: string;
    sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'overallScore';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
}

// ============================================
// Import/Export Types
// ============================================

export interface ImportResult {
    success: boolean;
    analysisId?: string;
    message: string;
    warnings?: string[];
    parsedScores?: number;
}

export interface ExportOptions {
    format: 'excel' | 'pdf' | 'json';
    includeRawData?: boolean;
    includeRecommendations?: boolean;
    language?: 'pl' | 'en';
}

// ============================================
// Comparison Types
// ============================================

export interface AnalysisComparison {
    id: string;
    name: string;
    description?: string;
    analysisIds: string[];
    analyses?: DigitizationAnalysis[];
    comparisonType: 'side_by_side' | 'timeline' | 'benchmark';
    createdAt: string;
}

// ============================================
// Statistics Types
// ============================================

export interface AnalysisCatalogStats {
    total: number;
    draft: number;
    inProgress: number;
    completed: number;
    avgScore: number;
    avgCompletion: number;
}

export interface AxisStatistics {
    axisId: string;
    axisName: string;
    avgCurrentScore: number;
    avgTargetScore: number;
    avgGap: number;
    completedAssessments: number;
}

// ============================================
// Constants
// ============================================

export const MATURITY_LEVELS = [
    { level: 1, name: 'Basic Data Registration', namePl: 'Rejestracja danych podstawowych', color: '#ef4444' },
    { level: 2, name: 'Workstation Control', namePl: 'Kontrola stanowiska', color: '#f97316' },
    { level: 3, name: 'Process Control', namePl: 'Kontrola procesu', color: '#f59e0b' },
    { level: 4, name: 'Automation', namePl: 'Automatyzacja', color: '#eab308' },
    { level: 5, name: 'MES Integration', namePl: 'MES', color: '#84cc16' },
    { level: 6, name: 'ERP Integration', namePl: 'ERP', color: '#22c55e' },
    { level: 7, name: 'Algorithmic Support', namePl: 'Algorytmiczne wsparcie', color: '#10b981' },
] as const;

export const AXIS_COLORS: Record<string, string> = {
    digital_processes: '#3b82f6',
    digital_products: '#8b5cf6',
    digital_business_models: '#ec4899',
    big_data: '#f59e0b',
    transformation_culture: '#10b981',
    cybersecurity: '#ef4444',
};

export const AXIS_ICONS: Record<string, string> = {
    digital_processes: 'Workflow',
    digital_products: 'Package',
    digital_business_models: 'Building',
    big_data: 'Database',
    transformation_culture: 'Users',
    cybersecurity: 'Shield',
};


