const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

const ExcelExportService = {
    /**
     * Export report data to Excel format
     * @param {Object} report - Report data object
     * @param {Object} options - Export options
     * @returns {Promise<string>} - Path to generated Excel file
     */
    exportReportToExcel: async (report, options = {}) => {
        // Validate input
        if (!report) {
            throw new Error('Report data is required');
        }

        const {
            includeCharts = false,
            includeRawData = true
        } = options;

        try {
            // Ensure report has necessary fields with defaults
            const safeReport = {
                id: report.id || `report_${Date.now()}`,
                title: report.title || 'Assessment Report',
                generated_at: report.generated_at || new Date().toISOString(),
                avg_actual: report.avg_actual || 0,
                avg_target: report.avg_target || 0,
                gap_points: report.gap_points || 0,
                assessment_snapshot: report.assessment_snapshot || {}
            };

            // Parse assessment_snapshot if it's a string
            if (typeof safeReport.assessment_snapshot === 'string') {
                try {
                    safeReport.assessment_snapshot = JSON.parse(safeReport.assessment_snapshot);
                } catch (parseError) {
                    console.warn('[ExcelExport] Failed to parse assessment_snapshot:', parseError.message);
                    safeReport.assessment_snapshot = {};
                }
            }

            // Create workbook
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Consultify';
            workbook.created = new Date();

            // Add Summary Sheet
            const summarySheet = workbook.addWorksheet('Summary', {
                properties: { tabColor: { argb: 'FF7C3AED' } }
            });

            addSummarySheet(summarySheet, safeReport);

            // Add Detailed Assessment Sheet
            const detailSheet = workbook.addWorksheet('Axis Details', {
                properties: { tabColor: { argb: 'FF3B82F6' } }
            });

            addDetailSheet(detailSheet, safeReport);

            // Add Raw Data Sheet if requested
            if (includeRawData) {
                const rawDataSheet = workbook.addWorksheet('Raw Data', {
                    properties: { tabColor: { argb: 'FF64748B' } }
                });
                addRawDataSheet(rawDataSheet, safeReport);
            }

            // Ensure uploads directory exists
            const uploadsDir = path.join(__dirname, '../../uploads/reports');
            await fs.mkdir(uploadsDir, { recursive: true });

            // Generate filename and save
            const filename = `report_${safeReport.id}_${Date.now()}.xlsx`;
            const filepath = path.join(uploadsDir, filename);

            await workbook.xlsx.writeFile(filepath);

            console.log(`[ExcelExport] Excel file generated: ${filename}`);
            
            // Return relative path
            return `/uploads/reports/${filename}`;

        } catch (error) {
            console.error('[ExcelExport] Error:', error);
            throw new Error('Failed to export to Excel: ' + error.message);
        }
    },

    /**
     * Export digitization analysis to Excel format
     * @param {Object} analysis - Digitization analysis data
     * @param {Object} options - Export options
     * @returns {Promise<string>} - Path to generated Excel file
     */
    exportDigitizationAnalysis: async (analysis, options = {}) => {
        if (!analysis) {
            throw new Error('Analysis data is required');
        }

        const {
            includeRecommendations = true,
            includeRawData = true,
            language = 'pl'
        } = options;

        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Consultify - Economics Module';
            workbook.created = new Date();

            // ========================================
            // Summary Sheet
            // ========================================
            const summarySheet = workbook.addWorksheet('Podsumowanie', {
                properties: { tabColor: { argb: 'FF10B981' } }
            });

            // Title
            summarySheet.mergeCells('A1:E1');
            summarySheet.getCell('A1').value = analysis.name || 'Analiza Dojrzałości Cyfrowej';
            summarySheet.getCell('A1').font = { size: 20, bold: true, color: { argb: 'FF10B981' } };
            summarySheet.getCell('A1').alignment = { horizontal: 'center' };

            // Metadata
            summarySheet.mergeCells('A2:E2');
            summarySheet.getCell('A2').value = `Wygenerowano: ${new Date().toLocaleString('pl-PL')}`;
            summarySheet.getCell('A2').font = { size: 10, color: { argb: 'FF64748B' } };
            summarySheet.getCell('A2').alignment = { horizontal: 'center' };

            // Key Metrics
            summarySheet.getRow(4).values = ['Metryka', 'Wartość'];
            summarySheet.getRow(4).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            summarySheet.getRow(4).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF10B981' }
            };

            const metrics = [
                ['Ogólny wynik', `${(analysis.overallScore || 0).toFixed(2)} / 7`],
                ['Ukończenie', `${analysis.completionPercent || 0}%`],
                ['Status', analysis.status === 'completed' ? 'Zakończona' : analysis.status === 'in_progress' ? 'W trakcie' : 'Szkic'],
                ['Projekt', analysis.projectName || 'Brak'],
                ['Data utworzenia', new Date(analysis.createdAt).toLocaleDateString('pl-PL')],
            ];

            let row = 5;
            metrics.forEach(([label, value]) => {
                summarySheet.getCell(`A${row}`).value = label;
                summarySheet.getCell(`B${row}`).value = value;
                summarySheet.getCell(`A${row}`).font = { bold: true };
                summarySheet.getCell(`B${row}`).font = { size: 12, color: { argb: 'FF1e293b' } };
                row++;
            });

            // Axis Summary
            row += 2;
            summarySheet.getCell(`A${row}`).value = 'Wyniki per Oś';
            summarySheet.getCell(`A${row}`).font = { bold: true, size: 14 };
            row++;

            summarySheet.getRow(row).values = ['Oś', 'Aktualny', 'Docelowy', 'Luka', 'Ukończone obszary'];
            summarySheet.getRow(row).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            summarySheet.getRow(row).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF3B82F6' }
            };
            row++;

            const axisNames = {
                digital_processes: 'Digitalne procesy',
                digital_products: 'Digitalne produkty',
                digital_business_models: 'Digitalne modele biznesowe',
                big_data: 'Big Data',
                transformation_culture: 'Kultura transformacji',
                cybersecurity: 'Cyberbezpieczeństwo'
            };

            const axisScores = analysis.axisScores || {};
            for (const [axisId, axisData] of Object.entries(axisScores)) {
                summarySheet.getRow(row).values = [
                    axisNames[axisId] || axisId,
                    (axisData.currentScore || 0).toFixed(2),
                    (axisData.targetScore || 0).toFixed(2),
                    (axisData.gap || 0).toFixed(2),
                    `${axisData.completedAreas || 0} / ${axisData.totalAreas || 0}`
                ];

                // Color code gap
                const gapCell = summarySheet.getCell(`D${row}`);
                const gap = axisData.gap || 0;
                if (gap > 2) {
                    gapCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                    gapCell.font = { color: { argb: 'FFEF4444' } };
                } else if (gap > 0) {
                    gapCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                    gapCell.font = { color: { argb: 'FFF59E0B' } };
                } else {
                    gapCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                    gapCell.font = { color: { argb: 'FF10B981' } };
                }
                row++;
            }

            summarySheet.getColumn(1).width = 30;
            summarySheet.getColumn(2).width = 15;
            summarySheet.getColumn(3).width = 15;
            summarySheet.getColumn(4).width = 15;
            summarySheet.getColumn(5).width = 20;

            // ========================================
            // Detailed Scores Sheet
            // ========================================
            const detailSheet = workbook.addWorksheet('Szczegółowe oceny', {
                properties: { tabColor: { argb: 'FF3B82F6' } }
            });

            detailSheet.columns = [
                { header: 'Oś', key: 'axis', width: 25 },
                { header: 'Kod obszaru', key: 'areaCode', width: 12 },
                { header: 'Obszar', key: 'areaName', width: 30 },
                { header: 'Poziom aktualny', key: 'current', width: 15 },
                { header: 'Poziom docelowy', key: 'target', width: 15 },
                { header: 'Luka', key: 'gap', width: 10 },
                { header: 'Notatki', key: 'notes', width: 40 },
                { header: 'Uzasadnienie', key: 'justification', width: 40 }
            ];

            detailSheet.getRow(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            detailSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF3B82F6' }
            };

            const detailedScores = analysis.detailedScores || [];
            let currentAxisId = null;
            let rowIndex = 2;

            for (const score of detailedScores) {
                const isNewAxis = score.axis_id !== currentAxisId;
                currentAxisId = score.axis_id;

                detailSheet.addRow({
                    axis: isNewAxis ? (axisNames[score.axis_id] || score.axis_id) : '',
                    areaCode: score.area_code || score.area_id,
                    areaName: score.area_name || '',
                    current: score.current_level || 0,
                    target: score.target_level || 0,
                    gap: (score.target_level || 0) - (score.current_level || 0),
                    notes: score.notes || '',
                    justification: score.justification || ''
                });

                // Highlight rows with large gaps
                const gap = (score.target_level || 0) - (score.current_level || 0);
                if (gap > 2) {
                    detailSheet.getRow(rowIndex).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFEF3C7' }
                    };
                }
                rowIndex++;
            }

            // ========================================
            // Gap Analysis Sheet
            // ========================================
            const gapSheet = workbook.addWorksheet('Analiza luk', {
                properties: { tabColor: { argb: 'FFF59E0B' } }
            });

            gapSheet.mergeCells('A1:D1');
            gapSheet.getCell('A1').value = 'Analiza Luk - Priorytety Rozwoju';
            gapSheet.getCell('A1').font = { size: 16, bold: true };

            gapSheet.getRow(3).values = ['Obszar', 'Luka', 'Priorytet', 'Rekomendowane działanie'];
            gapSheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            gapSheet.getRow(3).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF59E0B' }
            };

            // Sort by gap (descending) and list areas needing most improvement
            const sortedScores = [...detailedScores]
                .map(s => ({
                    ...s,
                    gap: (s.target_level || 0) - (s.current_level || 0)
                }))
                .filter(s => s.gap > 0)
                .sort((a, b) => b.gap - a.gap);

            let gapRow = 4;
            for (const score of sortedScores.slice(0, 15)) { // Top 15 gaps
                const priority = score.gap >= 3 ? 'Krytyczny' : score.gap >= 2 ? 'Wysoki' : 'Średni';
                gapSheet.getRow(gapRow).values = [
                    `${score.area_code}: ${score.area_name || 'N/A'}`,
                    score.gap,
                    priority,
                    score.justification || 'Wymaga analizy i definicji działań'
                ];

                if (priority === 'Krytyczny') {
                    gapSheet.getCell(`C${gapRow}`).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFEE2E2' }
                    };
                    gapSheet.getCell(`C${gapRow}`).font = { color: { argb: 'FFDC2626' }, bold: true };
                } else if (priority === 'Wysoki') {
                    gapSheet.getCell(`C${gapRow}`).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFEF3C7' }
                    };
                    gapSheet.getCell(`C${gapRow}`).font = { color: { argb: 'FFD97706' } };
                }
                gapRow++;
            }

            gapSheet.getColumn(1).width = 40;
            gapSheet.getColumn(2).width = 10;
            gapSheet.getColumn(3).width = 15;
            gapSheet.getColumn(4).width = 50;

            // ========================================
            // Raw Data Sheet (optional)
            // ========================================
            if (includeRawData) {
                const rawSheet = workbook.addWorksheet('Dane surowe (JSON)', {
                    properties: { tabColor: { argb: 'FF64748B' } }
                });

                rawSheet.getCell('A1').value = 'Pełne dane analizy (JSON)';
                rawSheet.getCell('A1').font = { bold: true, size: 14 };

                const jsonString = JSON.stringify(analysis, null, 2);
                rawSheet.getCell('A3').value = jsonString;
                rawSheet.getCell('A3').alignment = { wrapText: true, vertical: 'top' };
                rawSheet.getColumn(1).width = 120;
            }

            // ========================================
            // Save File
            // ========================================
            const uploadsDir = path.join(__dirname, '../../uploads/reports');
            await fs.mkdir(uploadsDir, { recursive: true });

            const filename = `digitization_analysis_${analysis.id}_${Date.now()}.xlsx`;
            const filepath = path.join(uploadsDir, filename);

            await workbook.xlsx.writeFile(filepath);

            console.log(`[ExcelExport] Digitization analysis exported: ${filename}`);
            return `/uploads/reports/${filename}`;

        } catch (error) {
            console.error('[ExcelExport] Digitization export error:', error);
            throw new Error('Failed to export digitization analysis: ' + error.message);
        }
    },

    /**
     * Export initiatives to Excel format
     */
    exportInitiativesToExcel: async (initiatives, options = {}) => {
        if (!initiatives || !Array.isArray(initiatives)) {
            throw new Error('Initiatives array is required');
        }

        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Consultify';
            workbook.created = new Date();

            // Add Initiatives Sheet
            const sheet = workbook.addWorksheet('Initiatives', {
                properties: { tabColor: { argb: 'FF7C3AED' } }
            });

            // Headers
            sheet.columns = [
                { header: 'Name', key: 'name', width: 35 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Priority', key: 'priority', width: 12 },
                { header: 'Axis', key: 'axis', width: 20 },
                { header: 'ROI', key: 'roi', width: 10 },
                { header: 'Budget', key: 'budget', width: 15 },
                { header: 'Progress', key: 'progress', width: 12 },
                { header: 'Owner', key: 'owner', width: 25 }
            ];

            // Style headers
            sheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF7C3AED' }
            };

            // Add data
            initiatives.forEach(init => {
                sheet.addRow({
                    name: init.name || 'Unnamed',
                    status: init.status || 'DRAFT',
                    priority: init.priority || 'Medium',
                    axis: init.axis || '-',
                    roi: init.expectedRoi ? `${init.expectedRoi}x` : '-',
                    budget: init.costCapex ? `${init.costCapex.toLocaleString()} PLN` : '-',
                    progress: init.progress ? `${init.progress}%` : '0%',
                    owner: init.ownerBusiness?.firstName ? 
                        `${init.ownerBusiness.firstName} ${init.ownerBusiness.lastName || ''}` : '-'
                });
            });

            // Ensure uploads directory exists
            const uploadsDir = path.join(__dirname, '../../uploads/reports');
            await fs.mkdir(uploadsDir, { recursive: true });

            // Generate filename and save
            const filename = `initiatives_${Date.now()}.xlsx`;
            const filepath = path.join(uploadsDir, filename);

            await workbook.xlsx.writeFile(filepath);

            console.log(`[ExcelExport] Initiatives Excel generated: ${filename}`);
            return `/uploads/reports/${filename}`;

        } catch (error) {
            console.error('[ExcelExport] Initiatives export error:', error);
            throw new Error('Failed to export initiatives: ' + error.message);
        }
    }
};

/**
 * Add summary sheet with key metrics
 */
function addSummarySheet(sheet, report) {
    // Title
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = report.title || 'Assessment Report';
    sheet.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FF7C3AED' } };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    // Generated date
    sheet.mergeCells('A2:D2');
    sheet.getCell('A2').value = `Generated: ${new Date(report.generated_at).toLocaleString()}`;
    sheet.getCell('A2').font = { size: 10, color: { argb: 'FF64748B' } };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    // Headers for metrics
    sheet.getRow(4).values = ['Metric', 'Value', '', ''];
    sheet.getRow(4).font = { bold: true, size: 12 };
    sheet.getRow(4).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
    };

    // Metrics data
    const metrics = [
        ['Average Current Level', report.avg_actual?.toFixed(2) || '0.00'],
        ['Average Target Level', report.avg_target?.toFixed(2) || '0.00'],
        ['Gap Points', report.gap_points || 0],
        ['Total Axes Assessed', Object.keys(report.assessment_snapshot || {}).length]
    ];

    let row = 5;
    metrics.forEach(([label, value]) => {
        sheet.getCell(`A${row}`).value = label;
        sheet.getCell(`B${row}`).value = value;
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`B${row}`).font = { size: 14, bold: true, color: { argb: 'FF7C3AED' } };
        row++;
    });

    // Column widths
    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).width = 20;
}

/**
 * Add detailed assessment sheet
 */
function addDetailSheet(sheet, report) {
    const assessment = report.assessment_snapshot || {};
    const axes = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];

    // Headers
    sheet.columns = [
        { header: 'Axis', key: 'axis', width: 25 },
        { header: 'Current Level', key: 'actual', width: 15 },
        { header: 'Target Level', key: 'target', width: 15 },
        { header: 'Gap', key: 'gap', width: 12 },
        { header: 'Justification', key: 'justification', width: 50 }
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF7C3AED' }
    };
    sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Add data
    let row = 2;
    axes.forEach(axis => {
        const data = assessment[axis];
        if (!data) return;

        const axisLabel = axis.replace(/([A-Z])/g, ' $1').trim();
        const gap = (data.target || 0) - (data.actual || 0);

        sheet.addRow({
            axis: axisLabel,
            actual: data.actual || 0,
            target: data.target || 0,
            gap: gap.toFixed(1),
            justification: data.justification || 'N/A'
        });

        // Conditional formatting for gap
        const gapCell = sheet.getCell(`D${row}`);
        if (gap > 2) {
            gapCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFEF3C7' } // Light orange
            };
            gapCell.font = { bold: true, color: { argb: 'FFF59E0B' } };
        } else if (gap > 0) {
            gapCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFEF9C3' } // Light yellow
            };
        } else {
            gapCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFDCFCE7' } // Light green
            };
            gapCell.font = { bold: true, color: { argb: 'FF10B981' } };
        }

        row++;
    });

    // Add borders to all cells
    for (let i = 1; i < row; i++) {
        ['A', 'B', 'C', 'D', 'E'].forEach(col => {
            const cell = sheet.getCell(`${col}${i}`);
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });
    }

    // Wrap text in justification column
    sheet.getColumn('E').alignment = { wrapText: true, vertical: 'top' };
}

/**
 * Add raw data sheet
 */
function addRawDataSheet(sheet, report) {
    // Title
    sheet.mergeCells('A1:B1');
    sheet.getCell('A1').value = 'Raw Assessment Data (JSON)';
    sheet.getCell('A1').font = { bold: true, size: 14 };

    // Add formatted JSON
    const jsonString = JSON.stringify(report.assessment_snapshot, null, 2);
    sheet.getCell('A3').value = jsonString;
    sheet.getCell('A3').alignment = { wrapText: true, vertical: 'top' };

    // Column widths
    sheet.getColumn(1).width = 100;
}

module.exports = ExcelExportService;
