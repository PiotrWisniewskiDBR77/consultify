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
        const {
            includeCharts = false,
            includeRawData = true
        } = options;

        try {
            // Create workbook
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Consultify';
            workbook.created = new Date();

            // Add Summary Sheet
            const summarySheet = workbook.addWorksheet('Summary', {
                properties: { tabColor: { argb: 'FF7C3AED' } }
            });

            addSummarySheet(summarySheet, report);

            // Add Detailed Assessment Sheet
            const detailSheet = workbook.addWorksheet('Axis Details', {
                properties: { tabColor: { argb: 'FF3B82F6' } }
            });

            addDetailSheet(detailSheet, report);

            // Add Raw Data Sheet if requested
            if (includeRawData) {
                const rawDataSheet = workbook.addWorksheet('Raw Data', {
                    properties: { tabColor: { argb: 'FF64748B' } }
                });
                addRawDataSheet(rawDataSheet, report);
            }

            // Ensure uploads directory exists
            const uploadsDir = path.join(__dirname, '../../uploads/reports');
            await fs.mkdir(uploadsDir, { recursive: true });

            // Generate filename and save
            const filename = `report_${report.id}_${Date.now()}.xlsx`;
            const filepath = path.join(uploadsDir, filename);

            await workbook.xlsx.writeFile(filepath);

            // Return relative path
            return `/uploads/reports/${filename}`;

        } catch (error) {
            console.error('Excel Export Error:', error);
            throw new Error('Failed to export to Excel: ' + error.message);
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
