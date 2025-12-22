const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const PdfGeneratorService = {
    /**
     * Generate PDF from report data
     * @param {Object} report - Report data object
     * @param {Object} options - PDF generation options
     * @returns {Promise<string>} - Path to generated PDF file
     */
    generateReportPDF: async (report, options = {}) => {
        const {
            includeCharts = true,
            includeSummary = true,
            branding = {},
            pageSize = 'A4'
        } = options;

        // Create HTML content
        const htmlContent = generateReportHTML(report, { includeCharts, includeSummary, branding });

        // Generate PDF using Puppeteer
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            // Ensure uploads directory exists
            const uploadsDir = path.join(__dirname, '../../uploads/reports');
            await fs.mkdir(uploadsDir, { recursive: true });

            // Generate filename
            const filename = `report_${report.id}_${Date.now()}.pdf`;
            const filepath = path.join(uploadsDir, filename);

            // Generate PDF
            await page.pdf({
                path: filepath,
                format: pageSize,
                printBackground: true,
                margin: {
                    top: '20mm',
                    right: '15mm',
                    bottom: '20mm',
                    left: '15mm'
                },
                displayHeaderFooter: true,
                headerTemplate: generateHeaderTemplate(branding),
                footerTemplate: generateFooterTemplate()
            });

            await browser.close();

            // Return relative path for storage in database
            return `/uploads/reports/${filename}`;

        } catch (error) {
            if (browser) await browser.close();
            console.error('PDF Generation Error:', error);
            throw new Error('Failed to generate PDF: ' + error.message);
        }
    }
};

/**
 * Generate HTML content for the report
 */
function generateReportHTML(report, options) {
    const { includeCharts, includeSummary, branding } = options;
    const assessment = report.assessment_snapshot || {};
    const axes = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];

    // Generate axes details HTML
    const axesHTML = axes.map(axis => {
        const data = assessment[axis];
        if (!data) return '';

        const gap = (data.target || 0) - (data.actual || 0);
        const axisLabel = axis.replace(/([A-Z])/g, ' $1').trim();

        return `
            <div class="axis-section">
                <h3>${axisLabel}</h3>
                <div class="axis-metrics">
                    <div class="metric">
                        <span class="label">Current Level:</span>
                        <span class="value current">${data.actual || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="label">Target Level:</span>
                        <span class="value target">${data.target || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="label">Gap:</span>
                        <span class="value gap">${gap.toFixed(1)}</span>
                    </div>
                </div>
                ${data.justification ? `<div class="justification"><strong>Justification:</strong> ${data.justification}</div>` : ''}
            </div>
        `;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1e293b;
        }
        .container { padding: 20px; }
        .header {
            border-bottom: 3px solid #7c3aed;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 24pt;
            font-weight: bold;
            color: #7c3aed;
            margin-bottom: 10px;
        }
        h1 {
            font-size: 20pt;
            color: #1e293b;
            margin-bottom: 10px;
        }
        .meta {
            font-size: 9pt;
            color: #64748b;
        }
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }
        .card-label {
            font-size: 9pt;
            color: #64748b;
            margin-bottom: 5px;
        }
        .card-value {
            font-size: 24pt;
            font-weight: bold;
        }
        .card-value.current { color: #3b82f6; }
        .card-value.target { color: #7c3aed; }
        .card-value.gap { color: #f59e0b; }
        h2 {
            font-size: 16pt;
            color: #1e293b;
            margin: 30px 0 15px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 5px;
        }
        .axis-section {
            margin-bottom: 25px;
            page-break-inside: avoid;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
        }
        .axis-section h3 {
            font-size: 12pt;
            color: #1e293b;
            margin-bottom: 10px;
            text-transform: capitalize;
        }
        .axis-metrics {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 10px;
        }
        .metric {
            display: flex;
            flex-direction: column;
        }
        .metric .label {
            font-size: 8pt;
            color: #64748b;
            margin-bottom: 3px;
        }
        .metric .value {
            font-size: 14pt;
            font-weight: bold;
        }
        .metric .value.current { color: #3b82f6; }
        .metric .value.target { color: #7c3aed; }
        .metric .value.gap { color: #f59e0b; }
        .justification {
            font-size: 9pt;
            color: #475569;
            background: #f8fafc;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
        }
        .page-break { page-break-after: always; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">${branding.companyName || 'Consultify'}</div>
            <h1>${report.title || 'Assessment Report'}</h1>
            <div class="meta">Generated: ${new Date(report.generated_at).toLocaleString()}</div>
        </div>

        ${includeSummary ? `
        <div class="summary-cards">
            <div class="card">
                <div class="card-label">Average Current Level</div>
                <div class="card-value current">${report.avg_actual?.toFixed(1) || '0.0'}</div>
            </div>
            <div class="card">
                <div class="card-label">Average Target Level</div>
                <div class="card-value target">${report.avg_target?.toFixed(1) || '0.0'}</div>
            </div>
            <div class="card">
                <div class="card-label">Gap Points</div>
                <div class="card-value gap">${report.gap_points || 0}</div>
            </div>
        </div>
        ` : ''}

        <h2>Assessment Breakdown</h2>
        ${axesHTML}
    </div>
</body>
</html>
    `;
}

/**
 * Generate PDF header template
 */
function generateHeaderTemplate(branding) {
    return `
        <div style="font-size: 8pt; color: #64748b; padding: 0 15mm; width: 100%; text-align: right;">
            <span>${branding.companyName || 'Consultify'}</span>
        </div>
    `;
}

/**
 * Generate PDF footer template
 */
function generateFooterTemplate() {
    return `
        <div style="font-size: 8pt; color: #64748b; padding: 0 15mm; width: 100%; display: flex; justify-content: space-between;">
            <span>Assessment Report</span>
            <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
    `;
}

module.exports = PdfGeneratorService;
