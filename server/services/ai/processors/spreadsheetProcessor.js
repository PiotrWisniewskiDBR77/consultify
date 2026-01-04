/**
 * Spreadsheet Processor
 * 
 * Extracts text content from Excel files (.xlsx, .xls) and CSV files.
 * Converts tabular data into AI-readable text format.
 * 
 * Part of the Multimodal Content Ingestion System
 * 
 * @version 1.0.0
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

/**
 * Process a spreadsheet file and extract text content
 * 
 * @param {string} filePath - Path to the spreadsheet file
 * @param {Object} options - Processing options
 * @param {boolean} options.includeHeaders - Include header row as column names
 * @param {boolean} options.includeSheetNames - Include sheet names in output
 * @param {string} options.delimiter - Column delimiter for text output
 * @param {number} options.maxRows - Maximum rows to process per sheet
 * @returns {Promise<Object>} Extracted content with metadata
 */
async function process(filePath, options = {}) {
    const {
        includeHeaders = true,
        includeSheetNames = true,
        delimiter = ' | ',
        maxRows = 10000
    } = options;

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!['.xlsx', '.xls', '.csv', '.tsv'].includes(ext)) {
        throw new Error(`Unsupported file type: ${ext}. Expected .xlsx, .xls, .csv, or .tsv`);
    }

    try {
        const startTime = Date.now();

        // Read workbook
        const workbook = XLSX.readFile(filePath, {
            type: 'file',
            cellDates: true,
            cellNF: true,
            cellText: true
        });

        const sheets = [];
        let totalRows = 0;
        let totalCells = 0;

        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON array
            const jsonData = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: '',
                blankrows: false,
                raw: false
            });

            // Limit rows if needed
            const limitedData = jsonData.slice(0, maxRows);

            // Extract headers (first row)
            const headers = limitedData[0] || [];
            const dataRows = includeHeaders ? limitedData : limitedData.slice(1);

            // Convert to text format
            let sheetText = '';

            if (includeSheetNames && workbook.SheetNames.length > 1) {
                sheetText += `## Sheet: ${sheetName}\n\n`;
            }

            // Add header row as markdown table header
            if (includeHeaders && headers.length > 0) {
                const headerText = headers.map(h => String(h || '').trim()).join(delimiter);
                sheetText += `**Columns:** ${headerText}\n\n`;
            }

            // Add data rows
            for (let i = includeHeaders ? 1 : 0; i < limitedData.length; i++) {
                const row = limitedData[i];
                if (row && row.some(cell => cell !== '')) {
                    const rowText = row.map(cell => formatCell(cell)).join(delimiter);
                    sheetText += rowText + '\n';
                    totalCells += row.length;
                }
            }

            sheets.push({
                name: sheetName,
                text: sheetText.trim(),
                rowCount: limitedData.length,
                columnCount: headers.length,
                headers: headers.map(h => String(h || '').trim())
            });

            totalRows += limitedData.length;
        }

        // Combine all sheets into one text
        const combinedText = sheets.map(s => s.text).join('\n\n---\n\n');

        // Get file metadata
        const stats = fs.statSync(filePath);
        const filename = path.basename(filePath);

        const processingTime = Date.now() - startTime;

        return {
            text: combinedText,
            sheets,
            metadata: {
                type: 'spreadsheet',
                format: ext.slice(1),
                filename,
                extension: ext,
                fileSize: stats.size,
                sheetCount: sheets.length,
                totalRows,
                totalCells,
                characterCount: combinedText.length,
                processingTimeMs: processingTime
            }
        };

    } catch (error) {
        console.error('[SpreadsheetProcessor] Error processing file:', error.message);
        throw new Error(`Failed to process spreadsheet: ${error.message}`);
    }
}

/**
 * Format a cell value for text output
 */
function formatCell(value) {
    if (value === null || value === undefined) {
        return '';
    }

    // Handle dates
    if (value instanceof Date) {
        return value.toISOString().split('T')[0];
    }

    // Handle numbers
    if (typeof value === 'number') {
        // Format large numbers with commas
        if (Math.abs(value) >= 1000 && Number.isInteger(value)) {
            return value.toLocaleString();
        }
        // Format decimals
        if (!Number.isInteger(value)) {
            return value.toFixed(2);
        }
        return value.toString();
    }

    // Handle strings
    const strValue = String(value).trim();

    // Remove excessive whitespace
    return strValue.replace(/\s+/g, ' ');
}

/**
 * Process CSV specifically with custom delimiter detection
 */
async function processCSV(filePath, options = {}) {
    const { delimiter = null } = options;

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');

    // Auto-detect delimiter if not provided
    const detectedDelimiter = delimiter || detectDelimiter(content);

    // Use xlsx to parse with detected delimiter
    const workbook = XLSX.read(content, {
        type: 'string',
        FS: detectedDelimiter,
        raw: false
    });

    // Process as regular spreadsheet
    return process(filePath, { ...options, delimiter: ' | ' });
}

/**
 * Auto-detect CSV delimiter
 */
function detectDelimiter(content) {
    const firstLine = content.split('\n')[0] || '';

    const delimiters = [',', ';', '\t', '|'];
    let maxCount = 0;
    let bestDelimiter = ',';

    for (const d of delimiters) {
        const count = (firstLine.match(new RegExp(escapeRegex(d), 'g')) || []).length;
        if (count > maxCount) {
            maxCount = count;
            bestDelimiter = d;
        }
    }

    return bestDelimiter;
}

/**
 * Escape regex special characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract summary statistics from spreadsheet
 */
function extractStatistics(filePath) {
    const workbook = XLSX.readFile(filePath);
    const stats = {
        sheets: [],
        totalNumericCells: 0,
        totalTextCells: 0,
        totalEmptyCells: 0
    };

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

        let numericCount = 0;
        let textCount = 0;
        let emptyCount = 0;

        for (let r = range.s.r; r <= range.e.r; r++) {
            for (let c = range.s.c; c <= range.e.c; c++) {
                const cellAddress = XLSX.utils.encode_cell({ r, c });
                const cell = sheet[cellAddress];

                if (!cell || cell.v === undefined || cell.v === '') {
                    emptyCount++;
                } else if (typeof cell.v === 'number') {
                    numericCount++;
                } else {
                    textCount++;
                }
            }
        }

        stats.sheets.push({
            name: sheetName,
            rows: range.e.r - range.s.r + 1,
            columns: range.e.c - range.s.c + 1,
            numericCells: numericCount,
            textCells: textCount,
            emptyCells: emptyCount
        });

        stats.totalNumericCells += numericCount;
        stats.totalTextCells += textCount;
        stats.totalEmptyCells += emptyCount;
    }

    return stats;
}

/**
 * Check if file is a supported spreadsheet
 */
function isSupported(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.xlsx', '.xls', '.csv', '.tsv'].includes(ext);
}

/**
 * Get supported file extensions
 */
function getSupportedExtensions() {
    return ['.xlsx', '.xls', '.csv', '.tsv'];
}

/**
 * Get supported MIME types
 */
function getSupportedMimeTypes() {
    return [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/tab-separated-values'
    ];
}

export {
process,
    processCSV,
    extractStatistics,
    isSupported,
    getSupportedExtensions,
    getSupportedMimeTypes,
    formatCell,
    detectDelimiter
};

export default {
    process,
    processCSV,
    extractStatistics,
    isSupported,
    getSupportedExtensions,
    getSupportedMimeTypes,
    formatCell,
    detectDelimiter
};









