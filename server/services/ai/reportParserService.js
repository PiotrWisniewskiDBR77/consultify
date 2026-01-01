/**
 * Report Parser Service
 * 
 * AI-powered extraction of assessment data from uploaded reports.
 * Supports PDF and Excel files, maps extracted data to DRD structure.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const AiService = require('../aiService');
const { DRD_AXES_CONFIG } = require('./bcgReportGenerator');

// Supported file types
const SUPPORTED_TYPES = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'text/plain': 'txt'
};

// DRD axis keywords for mapping
const AXIS_KEYWORDS = {
    processes: ['process', 'operational', 'workflow', 'efficiency', 'automation', 'ERP', 'MES'],
    digitalProducts: ['product', 'service', 'digital offering', 'platform', 'e-commerce', 'app'],
    businessModels: ['business model', 'revenue', 'monetization', 'subscription', 'SaaS'],
    dataManagement: ['data', 'analytics', 'BI', 'data warehouse', 'reporting', 'big data'],
    culture: ['culture', 'skills', 'training', 'change management', 'leadership', 'talent'],
    cybersecurity: ['security', 'cyber', 'risk', 'compliance', 'GDPR', 'privacy'],
    aiMaturity: ['AI', 'artificial intelligence', 'machine learning', 'ML', 'automation', 'cognitive']
};

class ReportParserService {
    /**
     * Parse uploaded report and extract assessment data
     * @param {Object} params - Parse parameters
     * @returns {Promise<Object>} Extracted assessment data
     */
    static async parseReport({
        filePath,
        mimeType,
        organizationId,
        userId,
        options = {}
    }) {
        try {
            // Validate file type
            if (!SUPPORTED_TYPES[mimeType]) {
                throw new Error(`Unsupported file type: ${mimeType}`);
            }

            const fileType = SUPPORTED_TYPES[mimeType];

            // Extract text content from file
            const textContent = await this._extractTextContent(filePath, fileType);

            if (!textContent || textContent.trim().length < 100) {
                throw new Error('Could not extract sufficient content from file');
            }

            // Use AI to extract structured data
            const extractedData = await this._extractWithAI(textContent, options);

            // Map to DRD structure
            const drdMapping = this._mapToDRDStructure(extractedData);

            // Generate assessment snapshot
            const snapshot = this._generateAssessmentSnapshot(drdMapping, extractedData);

            return {
                success: true,
                extractedData,
                drdMapping,
                snapshot,
                metadata: {
                    sourceFile: path.basename(filePath),
                    fileType,
                    extractedAt: new Date().toISOString(),
                    confidence: extractedData.confidence || 0.7,
                    aiModel: 'gemini-2.0-flash'
                }
            };
        } catch (error) {
            console.error('[ReportParserService] Parse error:', error);
            throw error;
        }
    }

    /**
     * Extract text content from file
     * @private
     */
    static async _extractTextContent(filePath, fileType) {
        try {
            if (fileType === 'txt') {
                return fs.readFileSync(filePath, 'utf-8');
            }

            if (fileType === 'pdf') {
                // For PDF, we would use pdf-parse library
                // For now, return placeholder - in production use pdf-parse
                try {
                    const pdfParse = require('pdf-parse');
                    const dataBuffer = fs.readFileSync(filePath);
                    const data = await pdfParse(dataBuffer);
                    return data.text;
                } catch (e) {
                    console.warn('[ReportParserService] PDF parsing not available, using fallback');
                    return fs.readFileSync(filePath, 'utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
                }
            }

            if (fileType === 'xlsx' || fileType === 'xls') {
                // For Excel, we would use xlsx library
                try {
                    const XLSX = require('xlsx');
                    const workbook = XLSX.readFile(filePath);
                    let text = '';
                    
                    workbook.SheetNames.forEach(sheetName => {
                        const sheet = workbook.Sheets[sheetName];
                        text += XLSX.utils.sheet_to_txt(sheet) + '\n\n';
                    });
                    
                    return text;
                } catch (e) {
                    console.warn('[ReportParserService] Excel parsing not available');
                    return '';
                }
            }

            return '';
        } catch (error) {
            console.error('[ReportParserService] Text extraction error:', error);
            return '';
        }
    }

    /**
     * Use AI to extract structured data from text
     * @private
     */
    static async _extractWithAI(textContent, options) {
        const prompt = `You are an expert at analyzing digital maturity assessment reports.

Analyze the following report content and extract any maturity scores, assessments, or ratings you find.

REPORT CONTENT:
${textContent.substring(0, 8000)}

Extract the following information in JSON format:
{
    "reportType": "string (e.g., 'SIRI', 'ADMA', 'Custom Digital Maturity', etc.)",
    "organizationName": "string or null",
    "assessmentDate": "string date or null",
    "overallScore": "number or null (normalized 0-100)",
    "dimensions": [
        {
            "name": "dimension name",
            "score": "number (normalized 0-100)",
            "level": "number (1-5 or 1-7)",
            "maxLevel": "number",
            "description": "brief description"
        }
    ],
    "keyFindings": ["array of key findings"],
    "recommendations": ["array of recommendations"],
    "confidence": "number 0-1 indicating extraction confidence"
}

If you cannot find specific information, use null. Normalize all scores to 0-100 scale.
Only respond with valid JSON.`;

        try {
            const response = await AiService.generateStructuredContent(prompt, 'report_parser');
            
            // Parse JSON response
            try {
                return JSON.parse(response);
            } catch (e) {
                // Try to extract JSON from response
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                return {
                    reportType: 'Unknown',
                    dimensions: [],
                    confidence: 0.3
                };
            }
        } catch (error) {
            console.error('[ReportParserService] AI extraction error:', error);
            // Fallback to keyword-based extraction
            return this._extractWithKeywords(textContent);
        }
    }

    /**
     * Fallback keyword-based extraction
     * @private
     */
    static _extractWithKeywords(textContent) {
        const dimensions = [];
        const textLower = textContent.toLowerCase();

        // Look for score patterns
        const scorePatterns = [
            /(\w+)\s*:?\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/gi,  // "Dimension: 3.5 / 5"
            /(\w+)\s*level\s*:?\s*(\d+)/gi,                  // "Process Level: 4"
            /maturity\s*:?\s*(\d+(?:\.\d+)?)/gi             // "Maturity: 3.2"
        ];

        scorePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(textContent)) !== null) {
                dimensions.push({
                    name: match[1],
                    score: parseFloat(match[2]),
                    maxLevel: match[3] ? parseInt(match[3]) : 5
                });
            }
        });

        return {
            reportType: 'Extracted',
            dimensions,
            confidence: 0.4
        };
    }

    /**
     * Map extracted data to DRD structure
     * @private
     */
    static _mapToDRDStructure(extractedData) {
        const drdMapping = {};

        Object.keys(DRD_AXES_CONFIG).forEach(axisKey => {
            drdMapping[axisKey] = {
                axis: axisKey,
                name: DRD_AXES_CONFIG[axisKey].name,
                maxLevel: DRD_AXES_CONFIG[axisKey].maxLevel,
                mappedDimensions: [],
                estimatedActual: null,
                estimatedTarget: null,
                confidence: 0
            };
        });

        // Map extracted dimensions to DRD axes
        if (extractedData.dimensions) {
            extractedData.dimensions.forEach(dim => {
                const matchedAxis = this._findMatchingAxis(dim.name);
                
                if (matchedAxis && drdMapping[matchedAxis]) {
                    drdMapping[matchedAxis].mappedDimensions.push(dim);
                    
                    // Normalize score to axis max level
                    const normalizedScore = this._normalizeScore(
                        dim.score,
                        dim.maxLevel || 5,
                        drdMapping[matchedAxis].maxLevel
                    );
                    
                    // Update estimated actual (average of mapped dimensions)
                    const mapped = drdMapping[matchedAxis].mappedDimensions;
                    const avgScore = mapped.reduce((sum, d) => {
                        return sum + this._normalizeScore(d.score, d.maxLevel || 5, drdMapping[matchedAxis].maxLevel);
                    }, 0) / mapped.length;
                    
                    drdMapping[matchedAxis].estimatedActual = Math.round(avgScore * 10) / 10;
                    drdMapping[matchedAxis].confidence = Math.min(0.9, 0.5 + (mapped.length * 0.1));
                }
            });
        }

        return drdMapping;
    }

    /**
     * Find matching DRD axis for a dimension name
     * @private
     */
    static _findMatchingAxis(dimensionName) {
        const nameLower = dimensionName.toLowerCase();
        
        for (const [axis, keywords] of Object.entries(AXIS_KEYWORDS)) {
            for (const keyword of keywords) {
                if (nameLower.includes(keyword.toLowerCase())) {
                    return axis;
                }
            }
        }
        
        return null;
    }

    /**
     * Normalize score to target scale
     * @private
     */
    static _normalizeScore(score, fromMax, toMax) {
        if (score > fromMax) {
            // Score might be percentage
            score = (score / 100) * fromMax;
        }
        return (score / fromMax) * toMax;
    }

    /**
     * Generate assessment snapshot from mapping
     * @private
     */
    static _generateAssessmentSnapshot(drdMapping, extractedData) {
        const axisScores = Object.entries(drdMapping).map(([axis, data]) => ({
            axis,
            asIs: data.estimatedActual || 0,
            toBe: data.estimatedTarget || data.estimatedActual || 0,
            gap: 0,
            confidence: data.confidence,
            source: 'IMPORTED'
        }));

        const overallActual = axisScores.reduce((sum, a) => sum + (a.asIs || 0), 0) / axisScores.length;

        return {
            id: uuidv4(),
            source: 'IMPORTED',
            reportType: extractedData.reportType,
            importedAt: new Date().toISOString(),
            axisScores,
            overallScore: Math.round(overallActual * 10) / 10,
            confidence: extractedData.confidence || 0.5,
            keyFindings: extractedData.keyFindings || [],
            recommendations: extractedData.recommendations || []
        };
    }

    /**
     * Create assessment report from imported data
     * @param {Object} params - Import parameters
     * @returns {Promise<Object>} Created report
     */
    static async createReportFromImport({
        parsedData,
        projectId,
        organizationId,
        userId,
        reportName
    }) {
        const db = require('../../database');
        const reportId = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO assessment_reports (
                    id, project_id, organization_id, title, report_status,
                    assessment_snapshot, generated_at, created_by, report_data
                )
                VALUES (?, ?, ?, ?, 'IMPORTED', ?, ?, ?, ?)
            `;

            const reportData = {
                source: 'IMPORTED',
                importMetadata: parsedData.metadata,
                extractedData: parsedData.extractedData,
                drdMapping: parsedData.drdMapping,
                snapshot: parsedData.snapshot
            };

            db.run(sql, [
                reportId,
                projectId,
                organizationId,
                reportName || `Imported Report - ${new Date().toLocaleDateString()}`,
                JSON.stringify(parsedData.snapshot),
                now,
                userId,
                JSON.stringify(reportData)
            ], function(err) {
                if (err) return reject(err);
                resolve({
                    id: reportId,
                    status: 'IMPORTED',
                    createdAt: now
                });
            });
        });
    }
}

module.exports = ReportParserService;


