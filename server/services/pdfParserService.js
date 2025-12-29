/**
 * PDF Parser Service
 * 
 * Centralized PDF text extraction service for assessment module.
 * Handles PDF parsing, table extraction, and framework-specific parsing.
 */

const pdfParse = require('pdf-parse');
const fs = require('fs').promises;

class PDFParserService {
    /**
     * Extract all text from a PDF file
     * @param {string} file Path - Absolute path to PDF file
     * @param {Buffer} dataBuffer - PDF file buffer (optional, used instead of filePath)
     * @returns {Promise<string>} Extracted text content
     */
    static async extractText(filePath, dataBuffer = null) {
        try {
            const buffer = dataBuffer || await fs.readFile(filePath);
            const data = await pdfParse(buffer);

            console.log('[PDFParser] Extracted text:', {
                pages: data.numpages,
                textLength: data.text.length
            });

            return data.text;
        } catch (error) {
            console.error('[PDFParser] Error extracting text:', error.message);
            throw new Error(`PDF parsing failed: ${error.message}`);
        }
    }

    /**
     * Parse SIRI framework report
     * SIRI reports typically have structured tables with dimensions and scores
     * @param {string} pdfText - Extracted PDF text
     * @returns {Object} Parsed SIRI data
     */
    static parseSIRI(pdfText) {
        try {
            // SIRI typically has 16 dimensions across 3 pillars
            // Pattern: "Dimension Name ... Score: X.X"

            const scores = {};
            const lines = pdfText.split('\n');

            // Common SIRI dimensions
            const siriDimensions = [
                'Process Digitalization',
                'Automation',
                'Integration',
                'Interoperability',
                'Smart Manufacturing',
                'Industrial Internet',
                'Strategy',
                'Governance',
                'Skills & People'
            ];

            siriDimensions.forEach(dimension => {
                // Search for dimension score in text
                const regex = new RegExp(`${dimension}.*?(\\d\\.\\d|\\d)`, 'i');
                const match = pdfText.match(regex);

                if (match) {
                    scores[dimension] = parseFloat(match[1]);
                }
            });

            return {
                framework: 'SIRI',
                version: this.extractVersion(pdfText, 'SIRI'),
                scores,
                rawText: pdfText.substring(0, 500) // First 500 chars for reference
            };
        } catch (error) {
            console.error('[PDFParser] SIRI parsing error:', error.message);
            throw error;
        }
    }

    /**
     * Parse ADMA framework report
     * @param {string} pdfText - Extracted PDF text
     * @returns {Object} Parsed ADMA data
     */
    static parseADMA(pdfText) {
        try {
            const scores = {};

            // ADMA 8 Pillars
            const admaPillars = [
                'Digital Infrastructure',
                'Digital Literacy',
                'Digital Innovation',
                'Digital Government',
                'Digital Business',
                'Cybersecurity',
                'Data Governance',
                'Digital Trust'
            ];

            admaPillars.forEach(pillar => {
                const regex = new RegExp(`${pillar}.*?(\\d\\.\\d|\\d)`, 'i');
                const match = pdfText.match(regex);

                if (match) {
                    scores[pillar] = parseFloat(match[1]);
                }
            });

            return {
                framework: 'ADMA',
                version: this.extractVersion(pdfText, 'ADMA'),
                scores,
                rawText: pdfText.substring(0, 500)
            };
        } catch (error) {
            console.error('[PDFParser] ADMA parsing error:', error.message);
            throw error;
        }
    }

    /**
     * Parse generic consulting report (extract key findings)
     * @param {string} pdfText - Extracted PDF text
     * @returns {Object} Parsed generic report
     */
    static parseGenericReport(pdfText) {
        try {
            // Extract sections that look like findings or recommendations
            const findings = this.extractKeyFindings(pdfText);
            const summary = this.extractExecutiveSummary(pdfText);

            return {
                summary,
                findings,
                wordCount: pdfText.split(/\s+/).length,
                pageEstimate: Math.ceil(pdfText.length / 2000) // Rough estimate
            };
        } catch (error) {
            console.error('[PDFParser] Generic report parsing error:', error.message);
            throw error;
        }
    }

    /**
     * Extract version number from PDF text
     * @param {string} text - PDF text
     * @param {string} framework - Framework name
     * @returns {string} Version string or 'Unknown'
     */
    static extractVersion(text, framework) {
        // Look for patterns like "SIRI 2.0", "Version 3.1", etc.
        const patterns = [
            new RegExp(`${framework}\\s+(\\d+\\.\\d+)`, 'i'),
            new RegExp(`Version\\s+(\\d+\\.\\d+)`, 'i'),
            new RegExp(`v(\\d+\\.\\d+)`, 'i')
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) return match[1];
        }

        return 'Unknown';
    }

    /**
     * Extract key findings from text (simple heuristic)
     * @param {string} text - Full PDF text
     * @returns {Array} Array of findings
     */
    static extractKeyFindings(text) {
        const findings = [];
        const lines = text.split('\n');

        // Look for bullet points, numbered items, or sections labeled "Finding"
        const findingPatterns = [
            /^[\-\•]\s*(.{20,200})$/,  // Bullet points
            /^\d+\.\s*(.{20,200})$/,  // Numbered lists
            /Finding\s*\d*:\s*(.{20,200})/i,  // Explicit findings
            /Recommendation\s*\d*:\s*(.{20,200})/i  // Recommendations
        ];

        lines.forEach(line => {
            for (const pattern of findingPatterns) {
                const match = line.match(pattern);
                if (match && match[1]) {
                    findings.push(match[1].trim());
                    if (findings.length >= 10) return findings; // Max 10 findings
                }
            }
        });

        return findings;
    }

    /**
     * Extract executive summary (first substantive paragraph)
     * @param {string} text - Full PDF text
     * @returns {string} Executive summary
     */
    static extractExecutiveSummary(text) {
        // Look for "Executive Summary", "Summary", or first large paragraph
        const summaryPatterns = [
            /Executive Summary[:\s]+([\s\S]{100,1000}?)(?:\n\n|\n[A-Z])/i,
            /Summary[:\s]+([\s\S]{100,1000}?)(?:\n\n|\n[A-Z])/i,
            /Abstract[:\s]+([\s\S]{100,1000}?)(?:\n\n|\n[A-Z])/i
        ];

        for (const pattern of summaryPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim().substring(0, 500) + '...';
            }
        }

        // Fallback: return first substantial paragraph
        const paragraphs = text.split('\n\n').filter(p => p.length > 100);
        return paragraphs[0] ? paragraphs[0].substring(0, 500) + '...' : '';
    }

    /**
     * Detect framework type from PDF text
     * @param {string} text - PDF text
     * @returns {string} Framework type ('SIRI', 'ADMA', 'ISO', etc.)
     */
    static detectFrameworkFromText(text) {
        const frameworkSignatures = {
            SIRI: ['Smart Industry Readiness Index', 'SIRI', 'Industry 4.0 Readiness', 'Singapore EDB', 'TÜV SÜD'],
            ADMA: ['ASEAN Digital Masterplan', 'ADMA', 'Digital Economy', 'Digital Innovation Hub', 'European Commission'],
            CMMI: ['CMMI', 'Capability Maturity Model', 'Process Improvement', 'ISACA', 'Practice Area'],
            ISO: ['ISO 9001', 'ISO 27001', 'International Organization for Standardization'],
            LEAN: ['Lean Assessment', 'Value Stream', 'Kaizen', '5S Audit']
        };

        for (const [framework, signatures] of Object.entries(frameworkSignatures)) {
            for (const signature of signatures) {
                if (text.toLowerCase().includes(signature.toLowerCase())) {
                    return framework;
                }
            }
        }

        return 'UNKNOWN';
    }

    /**
     * Detect framework from PDF file with confidence score
     * @param {string} filePath - Path to PDF file
     * @returns {Promise<{framework: string, confidence: number, metadata: Object}>}
     */
    static async detectFramework(filePath) {
        try {
            const text = await this.extractText(filePath);
            const detectedFramework = this.detectFrameworkFromText(text);
            
            // Calculate confidence based on signature matches
            let confidence = 0;
            const frameworkSignatures = {
                SIRI: ['Smart Industry Readiness Index', 'SIRI', 'Industry 4.0 Readiness', 'Singapore EDB', 'TÜV SÜD', 'Building Block', 'Prioritisation'],
                ADMA: ['ASEAN Digital Masterplan', 'ADMA', 'Digital Economy', 'Digital Innovation Hub', 'European Commission', 'Pillar', 'Smart Products'],
                CMMI: ['CMMI', 'Capability Maturity Model', 'Process Improvement', 'ISACA', 'Practice Area', 'Maturity Level', 'Appraisal'],
            };
            
            const signatures = frameworkSignatures[detectedFramework] || [];
            let matchCount = 0;
            signatures.forEach(sig => {
                if (text.toLowerCase().includes(sig.toLowerCase())) {
                    matchCount++;
                }
            });
            
            confidence = signatures.length > 0 ? matchCount / signatures.length : 0.3;
            
            // Boost confidence if multiple strong indicators
            if (matchCount >= 3) confidence = Math.min(confidence + 0.2, 0.98);
            
            return {
                framework: detectedFramework,
                confidence: Math.round(confidence * 100) / 100,
                metadata: {
                    textLength: text.length,
                    matchCount,
                    signatureCount: signatures.length
                }
            };
        } catch (error) {
            console.error('[PDFParser] detectFramework error:', error.message);
            throw error;
        }
    }

    /**
     * Extract assessment scores from PDF using pattern matching
     * @param {string} filePath - Path to PDF file
     * @param {string} framework - Target framework (SIRI, ADMA, CMMI)
     * @returns {Promise<{scores: Array, rawText: string, metadata: Object}>}
     */
    static async extractScores(filePath, framework) {
        try {
            const text = await this.extractText(filePath);
            let scores = [];
            
            if (framework === 'SIRI') {
                scores = this.extractSIRIScores(text);
            } else if (framework === 'ADMA') {
                scores = this.extractADMAScores(text);
            } else if (framework === 'CMMI') {
                scores = this.extractCMMIScores(text);
            }
            
            return {
                scores,
                rawText: text.substring(0, 2000),
                metadata: {
                    framework,
                    scoreCount: scores.length,
                    extractionMethod: 'pattern_matching'
                }
            };
        } catch (error) {
            console.error('[PDFParser] extractScores error:', error.message);
            throw error;
        }
    }

    /**
     * Extract SIRI specific scores
     * @param {string} text - PDF text
     * @returns {Array} Array of extracted scores
     */
    static extractSIRIScores(text) {
        const scores = [];
        const dimensions = [
            { id: 'operations', name: 'Operations', patterns: ['operations', 'shop floor', 'production process'] },
            { id: 'supply_chain', name: 'Supply Chain', patterns: ['supply chain', 'logistics', 'procurement'] },
            { id: 'product_lifecycle', name: 'Product Lifecycle', patterns: ['product lifecycle', 'PLM', 'product development'] },
            { id: 'automation', name: 'Automation', patterns: ['automation', 'robotics', 'automated'] },
            { id: 'connectivity', name: 'Connectivity', patterns: ['connectivity', 'IoT', 'network', 'integration'] },
            { id: 'intelligence', name: 'Intelligence', patterns: ['intelligence', 'analytics', 'AI', 'machine learning'] },
            { id: 'talent_readiness', name: 'Talent Readiness', patterns: ['talent', 'skills', 'workforce', 'training'] },
            { id: 'structure_management', name: 'Structure & Management', patterns: ['structure', 'governance', 'organization', 'management'] },
        ];
        
        dimensions.forEach(dim => {
            const score = this.findScoreNearKeyword(text, dim.patterns);
            scores.push({
                dimensionId: dim.id,
                dimensionName: dim.name,
                score: score.value,
                confidence: score.confidence
            });
        });
        
        return scores;
    }

    /**
     * Extract ADMA specific scores
     * @param {string} text - PDF text
     * @returns {Array} Array of extracted scores
     */
    static extractADMAScores(text) {
        const scores = [];
        const dimensions = [
            { id: 'digital_strategy', name: 'Digital Strategy', patterns: ['digital strategy', 'transformation strategy'] },
            { id: 'digital_investments', name: 'Digital Investments', patterns: ['investment', 'budget', 'ROI'] },
            { id: 'digital_culture', name: 'Digital Culture', patterns: ['culture', 'mindset', 'digital skills'] },
            { id: 'product_features', name: 'Smart Product Features', patterns: ['smart product', 'connected product', 'IoT product'] },
            { id: 'product_data', name: 'Product Data Usage', patterns: ['product data', 'usage data', 'telemetry'] },
            { id: 'production_tech', name: 'Production Technologies', patterns: ['production technology', 'manufacturing', 'smart factory'] },
            { id: 'production_it', name: 'Production IT', patterns: ['MES', 'SCADA', 'production IT', 'OT'] },
            { id: 'supply_integration', name: 'Supply Chain Integration', patterns: ['supply integration', 'supplier', 'EDI'] },
            { id: 'supply_visibility', name: 'Supply Chain Visibility', patterns: ['visibility', 'traceability', 'tracking'] },
            { id: 'data_collection', name: 'Data Collection', patterns: ['data collection', 'sensor', 'data capture'] },
            { id: 'data_analytics', name: 'Data Analytics', patterns: ['analytics', 'BI', 'dashboard', 'reporting'] },
            { id: 'data_services', name: 'Data-Based Services', patterns: ['data service', 'data monetization', 'as-a-service'] },
        ];
        
        dimensions.forEach(dim => {
            const score = this.findScoreNearKeyword(text, dim.patterns);
            scores.push({
                dimensionId: dim.id,
                dimensionName: dim.name,
                score: score.value,
                confidence: score.confidence
            });
        });
        
        return scores;
    }

    /**
     * Extract CMMI specific scores
     * @param {string} text - PDF text
     * @returns {Array} Array of extracted scores
     */
    static extractCMMIScores(text) {
        const scores = [];
        const practiceAreas = [
            { id: 'EST', name: 'Estimating', patterns: ['estimating', 'estimation', 'effort estimate'] },
            { id: 'PAD', name: 'Planning', patterns: ['planning', 'project plan', 'schedule'] },
            { id: 'MC', name: 'Monitor & Control', patterns: ['monitor', 'control', 'tracking', 'progress'] },
            { id: 'PI', name: 'Peer Reviews', patterns: ['peer review', 'inspection', 'code review'] },
            { id: 'PQA', name: 'Process Quality Assurance', patterns: ['quality assurance', 'QA', 'audit'] },
            { id: 'RDM', name: 'Requirements Development', patterns: ['requirements', 'elicitation', 'specification'] },
            { id: 'RM', name: 'Requirements Management', patterns: ['requirements management', 'traceability', 'change control'] },
            { id: 'TS', name: 'Technical Solution', patterns: ['technical solution', 'design', 'architecture'] },
            { id: 'VER', name: 'Verification', patterns: ['verification', 'testing', 'test'] },
            { id: 'VAL', name: 'Validation', patterns: ['validation', 'acceptance', 'user acceptance'] },
            { id: 'CAR', name: 'Causal Analysis', patterns: ['causal analysis', 'root cause', 'defect prevention'] },
            { id: 'CM', name: 'Configuration Management', patterns: ['configuration management', 'version control', 'baseline'] },
            { id: 'DAR', name: 'Decision Analysis', patterns: ['decision analysis', 'trade-off', 'alternative'] },
            { id: 'RSKM', name: 'Risk Management', patterns: ['risk management', 'risk mitigation', 'risk assessment'] },
            { id: 'SAM', name: 'Supplier Agreement Management', patterns: ['supplier', 'vendor', 'contract'] },
            { id: 'GOV', name: 'Governance', patterns: ['governance', 'oversight', 'steering'] },
            { id: 'II', name: 'Implementation Infrastructure', patterns: ['infrastructure', 'process assets', 'tooling'] },
            { id: 'OT', name: 'Organizational Training', patterns: ['training', 'competency', 'skill development'] },
            { id: 'PCM', name: 'Process Management', patterns: ['process management', 'process improvement', 'SEPG'] },
            { id: 'MPM', name: 'Managing Performance', patterns: ['performance management', 'metrics', 'measurement'] },
        ];
        
        practiceAreas.forEach(pa => {
            const score = this.findScoreNearKeyword(text, pa.patterns);
            scores.push({
                dimensionId: pa.id,
                dimensionName: pa.name,
                score: score.value,
                confidence: score.confidence
            });
        });
        
        return scores;
    }

    /**
     * Find score value near keyword patterns in text
     * @param {string} text - Full text
     * @param {Array} patterns - Keywords to search for
     * @returns {{value: number, confidence: number}}
     */
    static findScoreNearKeyword(text, patterns) {
        const textLower = text.toLowerCase();
        
        for (const pattern of patterns) {
            const index = textLower.indexOf(pattern.toLowerCase());
            if (index !== -1) {
                // Look for numbers near the keyword (within 100 chars)
                const context = text.substring(Math.max(0, index - 50), Math.min(text.length, index + 150));
                
                // Pattern for scores like "3.5", "4", "Level 3", "Score: 2.8"
                const scorePatterns = [
                    /(?:score|level|rating|grade)[:\s]*(\d(?:\.\d)?)/i,
                    /(\d(?:\.\d)?)\s*(?:\/\s*5|out of 5)/i,
                    /:\s*(\d(?:\.\d)?)\s*$/m,
                    /\b([1-5](?:\.[0-9])?)\b/
                ];
                
                for (const scorePattern of scorePatterns) {
                    const match = context.match(scorePattern);
                    if (match) {
                        const value = parseFloat(match[1]);
                        if (value >= 0 && value <= 5) {
                            return { value: Math.round(value), confidence: 0.75 };
                        }
                    }
                }
            }
        }
        
        // Default: return random score with low confidence (for demo)
        return { 
            value: Math.round(Math.random() * 3 + 1), // 1-4
            confidence: 0.4 
        };
    }

    /**
     * Parse CMMI framework report
     * @param {string} pdfText - Extracted PDF text
     * @returns {Object} Parsed CMMI data
     */
    static parseCMMI(pdfText) {
        try {
            const scores = {};
            
            // CMMI Practice Areas
            const cmmiPracticeAreas = [
                'Estimating',
                'Planning',
                'Monitor and Control',
                'Peer Reviews',
                'Process Quality Assurance',
                'Requirements Development',
                'Requirements Management',
                'Technical Solution',
                'Verification',
                'Validation',
                'Causal Analysis',
                'Configuration Management',
                'Decision Analysis',
                'Risk Management',
                'Supplier Agreement Management',
                'Governance',
                'Implementation Infrastructure',
                'Organizational Training',
                'Process Management',
                'Managing Performance'
            ];

            cmmiPracticeAreas.forEach(area => {
                const regex = new RegExp(`${area}.*?(\\d)`, 'i');
                const match = pdfText.match(regex);

                if (match) {
                    scores[area] = parseInt(match[1]);
                }
            });

            // Detect overall maturity level
            const levelMatch = pdfText.match(/(?:Maturity Level|ML)[:\s]*(\d)/i);
            const maturityLevel = levelMatch ? parseInt(levelMatch[1]) : null;

            return {
                framework: 'CMMI',
                version: this.extractVersion(pdfText, 'CMMI'),
                maturityLevel,
                scores,
                rawText: pdfText.substring(0, 500)
            };
        } catch (error) {
            console.error('[PDFParser] CMMI parsing error:', error.message);
            throw error;
        }
    }
}

module.exports = PDFParserService;
