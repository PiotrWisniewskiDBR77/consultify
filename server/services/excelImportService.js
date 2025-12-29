/**
 * Excel Import Service
 * 
 * Handles parsing and importing digitization assessment data from Excel files
 * Supports the standard "Basic Digitization Project Evaluation Form" template
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;

// Axis mappings from Polish to internal IDs
const AXIS_MAPPINGS = {
    'digitalne procesy': 'digital_processes',
    'digital processes': 'digital_processes',
    'digitalne produkty': 'digital_products',
    'digital products': 'digital_products',
    'digitalne modele biznesowe': 'digital_business_models',
    'digitalne modele businessowe': 'digital_business_models',
    'digital business models': 'digital_business_models',
    'big data': 'big_data',
    'kultura transformacji': 'transformation_culture',
    'transformation culture': 'transformation_culture',
    'cyberbezpieczeństwo': 'cybersecurity',
    'cybersecurity': 'cybersecurity',
};

// Area code patterns to detect
const AREA_CODE_PATTERN = /^(\d+)\.(\d+)\.?$/;

const ExcelImportService = {
    /**
     * Parse digitization assessment Excel file
     * @param {string} filePath - Path to Excel file
     * @returns {Promise<Object>} - Parsed assessment data
     */
    parseDigitizationExcel: async (filePath) => {
        console.log(`[ExcelImport] Parsing file: ${filePath}`);
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        const result = {
            success: true,
            scores: [],
            metadata: {
                fileName: path.basename(filePath),
                worksheetCount: workbook.worksheets.length,
                parsedAt: new Date().toISOString(),
            },
            warnings: [],
            stats: {
                totalRows: 0,
                parsedScores: 0,
                skippedRows: 0,
            },
        };

        // Try to find the main data sheet
        let dataSheet = workbook.worksheets[0];
        
        // Look for specific sheet names
        const possibleSheetNames = ['Ocena', 'Assessment', 'Data', 'Dane', 'Sheet1', 'Arkusz1'];
        for (const name of possibleSheetNames) {
            const sheet = workbook.getWorksheet(name);
            if (sheet) {
                dataSheet = sheet;
                break;
            }
        }

        if (!dataSheet) {
            result.success = false;
            result.warnings.push('Could not find data worksheet');
            return result;
        }

        result.metadata.worksheetName = dataSheet.name;

        // Detect header row and column structure
        const structure = ExcelImportService.detectStructure(dataSheet);
        if (!structure.success) {
            result.success = false;
            result.warnings = result.warnings.concat(structure.warnings);
            return result;
        }

        result.metadata.columns = structure.columns;

        // Parse data rows
        let currentAxis = null;
        let currentArea = null;
        let currentAreaCode = null;
        
        dataSheet.eachRow((row, rowNumber) => {
            if (rowNumber <= structure.headerRow) return;
            result.stats.totalRows++;

            try {
                const rowData = ExcelImportService.parseRow(row, structure.columns);
                
                // Detect axis
                if (rowData.axis) {
                    const normalizedAxis = rowData.axis.toLowerCase().trim();
                    currentAxis = AXIS_MAPPINGS[normalizedAxis] || normalizedAxis.replace(/\s+/g, '_');
                }

                // Detect area code
                if (rowData.areaCode) {
                    const match = rowData.areaCode.match(AREA_CODE_PATTERN);
                    if (match) {
                        currentAreaCode = rowData.areaCode;
                        currentArea = rowData.areaName || currentArea;
                    }
                }

                // Skip if no score data
                if (rowData.currentLevel === null && rowData.targetLevel === null) {
                    result.stats.skippedRows++;
                    return;
                }

                // Validate and add score
                if (currentAxis && currentAreaCode) {
                    const score = {
                        axisId: currentAxis,
                        areaId: `area_${currentAreaCode.replace('.', '_')}`,
                        areaCode: currentAreaCode,
                        areaName: currentArea,
                        currentLevel: ExcelImportService.normalizeLevel(rowData.currentLevel),
                        targetLevel: ExcelImportService.normalizeLevel(rowData.targetLevel),
                        notes: rowData.notes || null,
                        justification: rowData.justification || null,
                    };

                    // Only add if we have at least one level
                    if (score.currentLevel > 0 || score.targetLevel > 0) {
                        result.scores.push(score);
                        result.stats.parsedScores++;
                    }
                }
            } catch (err) {
                result.warnings.push(`Row ${rowNumber}: ${err.message}`);
                result.stats.skippedRows++;
            }
        });

        // Validate results
        if (result.scores.length === 0) {
            result.success = false;
            result.warnings.push('No valid scores found in the file');
        }

        console.log(`[ExcelImport] Parsed ${result.stats.parsedScores} scores from ${result.stats.totalRows} rows`);
        
        return result;
    },

    /**
     * Detect spreadsheet structure (header row and column mappings)
     */
    detectStructure: (sheet) => {
        const result = {
            success: false,
            headerRow: 1,
            columns: {},
            warnings: [],
        };

        // Known header patterns
        const headerPatterns = {
            axis: ['oś digitalizacji', 'oś', 'axis', 'dimension'],
            areaCode: ['kod', 'code', 'nr', 'numer'],
            areaName: ['obszar oceny', 'obszar', 'area', 'name'],
            level: ['poziom', 'level'],
            currentLevel: ['ocena aktualna', 'ocena', 'current', 'aktualny'],
            targetLevel: ['cel', 'target', 'docelowy'],
            description: ['opis', 'description'],
            example: ['przykład', 'example'],
            question: ['pytanie', 'question'],
            notes: ['uwagi', 'notes', 'komentarz', 'comment'],
            justification: ['uzasadnienie', 'justification'],
        };

        // Scan first 5 rows for headers
        for (let rowNum = 1; rowNum <= 5; rowNum++) {
            const row = sheet.getRow(rowNum);
            const cells = [];
            
            row.eachCell((cell, colNum) => {
                const value = cell.value?.toString()?.toLowerCase()?.trim() || '';
                cells.push({ colNum, value });
            });

            // Check if this looks like a header row
            let matchCount = 0;
            const columnMap = {};

            for (const cell of cells) {
                for (const [key, patterns] of Object.entries(headerPatterns)) {
                    if (patterns.some(p => cell.value.includes(p))) {
                        if (!columnMap[key]) {
                            columnMap[key] = cell.colNum;
                            matchCount++;
                        }
                    }
                }
            }

            // If we found at least 3 matching headers, use this row
            if (matchCount >= 3) {
                result.headerRow = rowNum;
                result.columns = columnMap;
                result.success = true;
                break;
            }
        }

        if (!result.success) {
            // Use default column structure
            result.headerRow = 1;
            result.columns = {
                axis: 1,
                areaCode: 2,
                areaName: 3,
                level: 4,
                currentLevel: 5,
                description: 6,
                example: 7,
                question: 8,
                notes: 9,
            };
            result.success = true;
            result.warnings.push('Using default column structure - headers not detected');
        }

        return result;
    },

    /**
     * Parse a single row based on detected column structure
     */
    parseRow: (row, columns) => {
        const getValue = (colNum) => {
            if (!colNum) return null;
            const cell = row.getCell(colNum);
            if (cell.value === null || cell.value === undefined) return null;
            
            // Handle different cell types
            if (typeof cell.value === 'object') {
                if (cell.value.richText) {
                    return cell.value.richText.map(r => r.text).join('');
                }
                if (cell.value.result !== undefined) {
                    return cell.value.result;
                }
                return cell.value.toString();
            }
            return cell.value;
        };

        return {
            axis: getValue(columns.axis),
            areaCode: getValue(columns.areaCode)?.toString(),
            areaName: getValue(columns.areaName),
            level: getValue(columns.level),
            currentLevel: getValue(columns.currentLevel),
            targetLevel: getValue(columns.targetLevel),
            description: getValue(columns.description),
            example: getValue(columns.example),
            question: getValue(columns.question),
            notes: getValue(columns.notes),
            justification: getValue(columns.justification),
        };
    },

    /**
     * Normalize level value to 0-7 scale
     */
    normalizeLevel: (value) => {
        if (value === null || value === undefined || value === '') return 0;
        
        const num = parseInt(value, 10);
        if (isNaN(num)) return 0;
        
        // Clamp to 0-7 range
        return Math.max(0, Math.min(7, num));
    },

    /**
     * Validate import file
     */
    validateFile: async (filePath) => {
        const result = {
            valid: false,
            errors: [],
            warnings: [],
        };

        try {
            // Check file exists
            await fs.access(filePath);

            // Check file extension
            const ext = path.extname(filePath).toLowerCase();
            if (!['.xlsx', '.xls'].includes(ext)) {
                result.errors.push('Invalid file type. Only .xlsx and .xls files are supported.');
                return result;
            }

            // Try to open workbook
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);

            if (workbook.worksheets.length === 0) {
                result.errors.push('Excel file contains no worksheets.');
                return result;
            }

            // Check for minimum row count
            const sheet = workbook.worksheets[0];
            if (sheet.rowCount < 2) {
                result.errors.push('Excel file appears to be empty or contains only headers.');
                return result;
            }

            result.valid = true;
        } catch (err) {
            result.errors.push(`Failed to read Excel file: ${err.message}`);
        }

        return result;
    },

    /**
     * Import Excel file and create analysis
     * @param {string} filePath - Path to uploaded file
     * @param {Object} options - Import options
     * @param {Object} services - Service dependencies (EconomicsService)
     * @returns {Promise<Object>} - Import result
     */
    importExcel: async (filePath, options, services) => {
        const { EconomicsService } = services;
        const { organizationId, userId, analysisName } = options;

        const result = {
            success: false,
            analysisId: null,
            message: '',
            warnings: [],
            stats: {},
        };

        try {
            // Validate file
            const validation = await ExcelImportService.validateFile(filePath);
            if (!validation.valid) {
                result.message = validation.errors.join('; ');
                return result;
            }

            // Parse file
            const parsed = await ExcelImportService.parseDigitizationExcel(filePath);
            if (!parsed.success) {
                result.message = parsed.warnings.join('; ');
                result.warnings = parsed.warnings;
                return result;
            }

            // Create analysis
            const analysis = await EconomicsService.createAnalysis({
                name: analysisName || `Imported: ${parsed.metadata.fileName}`,
                description: `Imported from Excel file on ${new Date().toLocaleString()}`,
                status: 'in_progress',
                importedFrom: parsed.metadata.fileName,
                importDate: new Date().toISOString(),
            }, organizationId, userId);

            // Import scores
            for (const score of parsed.scores) {
                await EconomicsService.updateAxisScore(analysis.id, score, userId);
            }

            // Recalculate overall scores
            await EconomicsService.recalculateScores(analysis.id, organizationId);

            result.success = true;
            result.analysisId = analysis.id;
            result.message = `Successfully imported ${parsed.stats.parsedScores} scores`;
            result.warnings = parsed.warnings;
            result.stats = parsed.stats;

        } catch (err) {
            console.error('[ExcelImport] Import failed:', err);
            result.message = `Import failed: ${err.message}`;
        }

        return result;
    },
};

module.exports = ExcelImportService;

