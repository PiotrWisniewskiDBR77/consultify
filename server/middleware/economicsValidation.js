/**
 * Economics Validation Middleware
 * 
 * Input validation for Economics API endpoints using express-validator.
 * Ensures data integrity and security for digitization analysis operations.
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors - returns 400 with detailed error messages
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

/**
 * Sanitize string - trim and escape
 */
const sanitizeString = (value) => {
    if (typeof value !== 'string') return value;
    return value.trim();
};

// ============================================
// Analysis Validators
// ============================================

/**
 * Validate create analysis request
 */
const validateCreateAnalysis = [
    body('name')
        .exists().withMessage('Name is required')
        .isString().withMessage('Name must be a string')
        .trim()
        .isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 characters')
        .customSanitizer(sanitizeString),
    body('description')
        .optional()
        .isString().withMessage('Description must be a string')
        .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters')
        .customSanitizer(sanitizeString),
    body('projectId')
        .optional()
        .isString().withMessage('Project ID must be a string'),
    body('tags')
        .optional()
        .isArray().withMessage('Tags must be an array')
        .custom((tags) => {
            if (tags && tags.length > 20) {
                throw new Error('Maximum 20 tags allowed');
            }
            return true;
        }),
    body('tags.*')
        .optional()
        .isString().withMessage('Each tag must be a string')
        .isLength({ max: 50 }).withMessage('Each tag cannot exceed 50 characters'),
    handleValidationErrors
];

/**
 * Validate update analysis request
 */
const validateUpdateAnalysis = [
    param('id')
        .exists().withMessage('Analysis ID is required')
        .isString().withMessage('Analysis ID must be a string'),
    body('name')
        .optional()
        .isString().withMessage('Name must be a string')
        .trim()
        .isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 characters')
        .customSanitizer(sanitizeString),
    body('description')
        .optional()
        .isString().withMessage('Description must be a string')
        .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
    body('status')
        .optional()
        .isIn(['draft', 'in_progress', 'completed']).withMessage('Status must be draft, in_progress, or completed'),
    body('projectId')
        .optional({ nullable: true })
        .isString().withMessage('Project ID must be a string'),
    handleValidationErrors
];

/**
 * Validate analysis ID parameter
 */
const validateAnalysisId = [
    param('id')
        .exists().withMessage('Analysis ID is required')
        .isString().withMessage('Analysis ID must be a string'),
    handleValidationErrors
];

// ============================================
// Score Validators
// ============================================

/**
 * Validate bulk scores update
 */
const validateBulkScores = [
    param('id')
        .exists().withMessage('Analysis ID is required')
        .isString().withMessage('Analysis ID must be a string'),
    body('scores')
        .exists().withMessage('Scores array is required')
        .isArray({ min: 1 }).withMessage('Scores must be a non-empty array'),
    body('scores.*.axisId')
        .exists().withMessage('Each score must have axisId')
        .isString().withMessage('axisId must be a string'),
    body('scores.*.areaId')
        .exists().withMessage('Each score must have areaId')
        .isString().withMessage('areaId must be a string'),
    body('scores.*.currentLevel')
        .optional()
        .isInt({ min: 0, max: 7 }).withMessage('currentLevel must be an integer between 0 and 7'),
    body('scores.*.targetLevel')
        .optional()
        .isInt({ min: 0, max: 7 }).withMessage('targetLevel must be an integer between 0 and 7'),
    body('scores.*.notes')
        .optional()
        .isString().withMessage('Notes must be a string')
        .isLength({ max: 5000 }).withMessage('Notes cannot exceed 5000 characters'),
    body('scores.*.justification')
        .optional()
        .isString().withMessage('Justification must be a string')
        .isLength({ max: 5000 }).withMessage('Justification cannot exceed 5000 characters'),
    handleValidationErrors
];

/**
 * Validate single score update
 */
const validateSingleScore = [
    param('id')
        .exists().withMessage('Analysis ID is required')
        .isString().withMessage('Analysis ID must be a string'),
    body('axisId')
        .exists().withMessage('axisId is required')
        .isString().withMessage('axisId must be a string'),
    body('areaId')
        .exists().withMessage('areaId is required')
        .isString().withMessage('areaId must be a string'),
    body('areaCode')
        .optional()
        .isString().withMessage('areaCode must be a string'),
    body('currentLevel')
        .optional()
        .isInt({ min: 0, max: 7 }).withMessage('currentLevel must be an integer between 0 and 7'),
    body('targetLevel')
        .optional()
        .isInt({ min: 0, max: 7 }).withMessage('targetLevel must be an integer between 0 and 7'),
    body('notes')
        .optional()
        .isString().withMessage('Notes must be a string')
        .isLength({ max: 5000 }).withMessage('Notes cannot exceed 5000 characters'),
    body('evidence')
        .optional()
        .isArray().withMessage('Evidence must be an array'),
    body('justification')
        .optional()
        .isString().withMessage('Justification must be a string')
        .isLength({ max: 5000 }).withMessage('Justification cannot exceed 5000 characters'),
    handleValidationErrors
];

// ============================================
// Comparison Validators
// ============================================

/**
 * Validate create comparison request
 */
const validateCreateComparison = [
    body('name')
        .optional()
        .isString().withMessage('Name must be a string')
        .isLength({ max: 255 }).withMessage('Name cannot exceed 255 characters'),
    body('description')
        .optional()
        .isString().withMessage('Description must be a string')
        .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
    body('analysisIds')
        .exists().withMessage('Analysis IDs are required')
        .isArray({ min: 2, max: 10 }).withMessage('Must provide between 2 and 10 analysis IDs'),
    body('analysisIds.*')
        .isString().withMessage('Each analysis ID must be a string'),
    body('comparisonType')
        .optional()
        .isIn(['side_by_side', 'timeline', 'benchmark']).withMessage('Invalid comparison type'),
    handleValidationErrors
];

/**
 * Validate quick compare request
 */
const validateQuickCompare = [
    body('analysisIds')
        .exists().withMessage('Analysis IDs are required')
        .isArray({ min: 2, max: 4 }).withMessage('Must provide between 2 and 4 analysis IDs for quick compare'),
    body('analysisIds.*')
        .isString().withMessage('Each analysis ID must be a string'),
    handleValidationErrors
];

// ============================================
// Export/Import Validators
// ============================================

/**
 * Validate export request
 */
const validateExportRequest = [
    param('id')
        .exists().withMessage('Analysis ID is required')
        .isString().withMessage('Analysis ID must be a string'),
    query('language')
        .optional()
        .isIn(['pl', 'en']).withMessage('Language must be pl or en'),
    query('format')
        .optional()
        .isIn(['excel', 'pdf']).withMessage('Format must be excel or pdf'),
    query('template')
        .optional()
        .isIn(['executive', 'full', 'gap_analysis']).withMessage('Invalid template'),
    handleValidationErrors
];

/**
 * Validate list analyses query
 */
const validateListQuery = [
    query('status')
        .optional()
        .isIn(['all', 'draft', 'in_progress', 'completed']).withMessage('Invalid status filter'),
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('pageSize')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Page size must be between 1 and 100'),
    query('sortBy')
        .optional()
        .isIn(['name', 'created_at', 'updated_at', 'overall_score', 'status']).withMessage('Invalid sort field'),
    query('sortOrder')
        .optional()
        .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    handleValidationErrors
];

// ============================================
// Version Validators
// ============================================

/**
 * Validate create version request
 */
const validateCreateVersion = [
    param('id')
        .exists().withMessage('Analysis ID is required')
        .isString().withMessage('Analysis ID must be a string'),
    body('versionName')
        .optional()
        .isString().withMessage('Version name must be a string')
        .isLength({ max: 255 }).withMessage('Version name cannot exceed 255 characters'),
    body('versionType')
        .optional()
        .isIn(['snapshot', 'baseline', 'milestone']).withMessage('Version type must be snapshot, baseline, or milestone'),
    body('notes')
        .optional()
        .isString().withMessage('Notes must be a string')
        .isLength({ max: 2000 }).withMessage('Notes cannot exceed 2000 characters'),
    handleValidationErrors
];

/**
 * Validate version ID parameter
 */
const validateVersionId = [
    param('id')
        .exists().withMessage('Analysis ID is required')
        .isString().withMessage('Analysis ID must be a string'),
    param('versionId')
        .exists().withMessage('Version ID is required')
        .isString().withMessage('Version ID must be a string'),
    handleValidationErrors
];

// ============================================
// Evidence Validators
// ============================================

/**
 * Validate add evidence request
 */
const validateAddEvidence = [
    param('scoreId')
        .exists().withMessage('Score ID is required')
        .isString().withMessage('Score ID must be a string'),
    body('evidenceType')
        .exists().withMessage('Evidence type is required')
        .isIn(['document', 'link', 'screenshot', 'note']).withMessage('Invalid evidence type'),
    body('title')
        .exists().withMessage('Title is required')
        .isString().withMessage('Title must be a string')
        .isLength({ min: 1, max: 255 }).withMessage('Title must be between 1 and 255 characters'),
    body('content')
        .optional()
        .isString().withMessage('Content must be a string')
        .isLength({ max: 10000 }).withMessage('Content cannot exceed 10000 characters'),
    handleValidationErrors
];

module.exports = {
    // Analysis
    validateCreateAnalysis,
    validateUpdateAnalysis,
    validateAnalysisId,
    validateListQuery,
    
    // Scores
    validateBulkScores,
    validateSingleScore,
    
    // Comparisons
    validateCreateComparison,
    validateQuickCompare,
    
    // Export/Import
    validateExportRequest,
    
    // Versioning
    validateCreateVersion,
    validateVersionId,
    
    // Evidence
    validateAddEvidence,
    
    // Utility
    handleValidationErrors
};

