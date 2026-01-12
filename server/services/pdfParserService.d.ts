export default PDFParserService;
declare class PDFParserService {
    /**
     * Extract all text from a PDF file
     * @param {string} file Path - Absolute path to PDF file
     * @param {Buffer} dataBuffer - PDF file buffer (optional, used instead of filePath)
     * @returns {Promise<string>} Extracted text content
     */
    static extractText(filePath: any, dataBuffer?: Buffer): Promise<string>;
    /**
     * Parse SIRI framework report
     * SIRI reports typically have structured tables with dimensions and scores
     * @param {string} pdfText - Extracted PDF text
     * @returns {Object} Parsed SIRI data
     */
    static parseSIRI(pdfText: string): Object;
    /**
     * Parse ADMA framework report
     * @param {string} pdfText - Extracted PDF text
     * @returns {Object} Parsed ADMA data
     */
    static parseADMA(pdfText: string): Object;
    /**
     * Parse generic consulting report (extract key findings)
     * @param {string} pdfText - Extracted PDF text
     * @returns {Object} Parsed generic report
     */
    static parseGenericReport(pdfText: string): Object;
    /**
     * Extract version number from PDF text
     * @param {string} text - PDF text
     * @param {string} framework - Framework name
     * @returns {string} Version string or 'Unknown'
     */
    static extractVersion(text: string, framework: string): string;
    /**
     * Extract key findings from text (simple heuristic)
     * @param {string} text - Full PDF text
     * @returns {Array} Array of findings
     */
    static extractKeyFindings(text: string): any[];
    /**
     * Extract executive summary (first substantive paragraph)
     * @param {string} text - Full PDF text
     * @returns {string} Executive summary
     */
    static extractExecutiveSummary(text: string): string;
    /**
     * Detect framework type from PDF text
     * @param {string} text - PDF text
     * @returns {string} Framework type ('SIRI', 'ADMA', 'ISO', etc.)
     */
    static detectFrameworkFromText(text: string): string;
    /**
     * Detect framework from PDF file with confidence score
     * @param {string} filePath - Path to PDF file
     * @returns {Promise<{framework: string, confidence: number, metadata: Object}>}
     */
    static detectFramework(filePath: string): Promise<{
        framework: string;
        confidence: number;
        metadata: Object;
    }>;
    /**
     * Extract assessment scores from PDF using pattern matching
     * @param {string} filePath - Path to PDF file
     * @param {string} framework - Target framework (SIRI, ADMA, CMMI)
     * @returns {Promise<{scores: Array, rawText: string, metadata: Object}>}
     */
    static extractScores(filePath: string, framework: string): Promise<{
        scores: any[];
        rawText: string;
        metadata: Object;
    }>;
    /**
     * Extract SIRI specific scores
     * @param {string} text - PDF text
     * @returns {Array} Array of extracted scores
     */
    static extractSIRIScores(text: string): any[];
    /**
     * Extract ADMA specific scores
     * @param {string} text - PDF text
     * @returns {Array} Array of extracted scores
     */
    static extractADMAScores(text: string): any[];
    /**
     * Extract CMMI specific scores
     * @param {string} text - PDF text
     * @returns {Array} Array of extracted scores
     */
    static extractCMMIScores(text: string): any[];
    /**
     * Find score value near keyword patterns in text
     * @param {string} text - Full text
     * @param {Array} patterns - Keywords to search for
     * @returns {{value: number, confidence: number}}
     */
    static findScoreNearKeyword(text: string, patterns: any[]): {
        value: number;
        confidence: number;
    };
    /**
     * Parse CMMI framework report
     * @param {string} pdfText - Extracted PDF text
     * @returns {Object} Parsed CMMI data
     */
    static parseCMMI(pdfText: string): Object;
}
//# sourceMappingURL=pdfParserService.d.ts.map