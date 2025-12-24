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
    static detectFramework(text) {
        const frameworkSignatures = {
            SIRI: ['Smart Industry Readiness Index', 'SIRI', 'Industry 4.0 Readiness'],
            ADMA: ['ASEAN Digital Masterplan', 'ADMA', 'Digital Economy'],
            CMMI: ['CMMI', 'Capability Maturity Model', 'Process Improvement'],
            ISO: ['ISO 9001', 'ISO 27001', 'International Organization for Standardization'],
            LEAN: ['Lean Assessment', 'Value Stream', 'Kaizen', '5S Audit']
        };

        for (const [framework, signatures] of Object.entries(frameworkSignatures)) {
            for (const signature of signatures) {
                if (text.includes(signature)) {
                    return framework;
                }
            }
        }

        return 'UNKNOWN';
    }
}

module.exports = PDFParserService;
