import path from 'path';
import { promises as fs } from 'fs';

// Try to require puppeteer, fallback to PDFKit if not available
let puppeteer;
let PDFDocument;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    console.log('[PDFGenerator] Puppeteer not available, will use PDFKit fallback');
}
try {
    PDFDocument = require('pdfkit');
} catch (e) {
    console.log('[PDFGenerator] PDFKit not available');
}

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

        // Ensure uploads directory exists
        const uploadsDir = path.join(__dirname, '../../uploads/reports');
        await fs.mkdir(uploadsDir, { recursive: true });

        // Generate filename
        const filename = `report_${report.id || 'unknown'}_${Date.now()}.pdf`;
        const filepath = path.join(uploadsDir, filename);

        // Try Puppeteer first, fall back to PDFKit
        if (puppeteer) {
            try {
                return await generatePDFWithPuppeteer(report, options, filepath, filename);
            } catch (puppeteerError) {
                console.warn('[PDFGenerator] Puppeteer failed, trying PDFKit fallback:', puppeteerError.message);
                if (PDFDocument) {
                    return await generatePDFWithPDFKit(report, options, filepath, filename);
                }
                throw puppeteerError;
            }
        } else if (PDFDocument) {
            return await generatePDFWithPDFKit(report, options, filepath, filename);
        } else {
            throw new Error('No PDF generation library available. Please install puppeteer or pdfkit.');
        }
    }
};

/**
 * Generate PDF using Puppeteer (HTML-based, best quality)
 */
async function generatePDFWithPuppeteer(report, options, filepath, filename) {
    const { includeCharts, includeSummary, branding, pageSize = 'A4' } = options;
    const htmlContent = generateReportHTML(report, { includeCharts, includeSummary, branding });

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });

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
        console.log(`[PDFGenerator] PDF generated with Puppeteer: ${filename}`);
        return `/uploads/reports/${filename}`;

    } catch (error) {
        if (browser) await browser.close();
        throw error;
    }
}

/**
 * Generate PDF using PDFKit (native, fallback)
 */
async function generatePDFWithPDFKit(report, options, filepath, filename) {
    const { includeSummary, branding } = options;

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                info: {
                    Title: report.title || 'Assessment Report',
                    Author: branding.companyName || 'Consultify',
                    Subject: 'DRD Assessment Report'
                }
            });

            const writeStream = require('fs').createWriteStream(filepath);
            doc.pipe(writeStream);

            // Colors
            const PRIMARY = '#7c3aed';
            const TEXT_DARK = '#1e293b';
            const TEXT_LIGHT = '#64748b';

            // Header
            doc.fillColor(PRIMARY)
               .fontSize(24)
               .font('Helvetica-Bold')
               .text(branding.companyName || 'Consultify', 50, 50);

            doc.fillColor(TEXT_DARK)
               .fontSize(18)
               .text(report.title || 'Assessment Report', 50, 85);

            doc.fillColor(TEXT_LIGHT)
               .fontSize(10)
               .text(`Generated: ${new Date(report.generated_at || Date.now()).toLocaleString()}`, 50, 115);

            // Horizontal line
            doc.strokeColor(PRIMARY)
               .lineWidth(2)
               .moveTo(50, 140)
               .lineTo(545, 140)
               .stroke();

            let yPos = 170;

            // Summary Cards
            if (includeSummary) {
                doc.fontSize(14)
                   .fillColor(TEXT_DARK)
                   .font('Helvetica-Bold')
                   .text('Executive Summary', 50, yPos);
                
                yPos += 30;

                const summaryItems = [
                    { label: 'Average Current Level', value: report.avg_actual?.toFixed(1) || '0.0', color: '#3b82f6' },
                    { label: 'Average Target Level', value: report.avg_target?.toFixed(1) || '0.0', color: PRIMARY },
                    { label: 'Gap Points', value: report.gap_points || '0', color: '#f59e0b' }
                ];

                const cardWidth = 150;
                summaryItems.forEach((item, i) => {
                    const xPos = 50 + (i * (cardWidth + 20));
                    
                    // Card background
                    doc.fillColor('#f8fafc')
                       .roundedRect(xPos, yPos, cardWidth, 60, 5)
                       .fill();
                    
                    // Label
                    doc.fillColor(TEXT_LIGHT)
                       .fontSize(9)
                       .font('Helvetica')
                       .text(item.label, xPos + 10, yPos + 10, { width: cardWidth - 20, align: 'center' });
                    
                    // Value
                    doc.fillColor(item.color)
                       .fontSize(24)
                       .font('Helvetica-Bold')
                       .text(item.value, xPos + 10, yPos + 30, { width: cardWidth - 20, align: 'center' });
                });

                yPos += 90;
            }

            // Assessment Breakdown
            doc.fontSize(14)
               .fillColor(TEXT_DARK)
               .font('Helvetica-Bold')
               .text('Assessment Breakdown', 50, yPos);
            
            yPos += 25;

            const assessment = report.assessment_snapshot || {};
            const axes = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];
            const axisLabels = {
                processes: 'Digital Processes',
                digitalProducts: 'Digital Products',
                businessModels: 'Business Models',
                dataManagement: 'Data Management',
                culture: 'Transformation Culture',
                cybersecurity: 'Cybersecurity',
                aiMaturity: 'AI Maturity'
            };

            axes.forEach(axis => {
                const data = assessment[axis] || {};
                const gap = (data.target || 0) - (data.actual || 0);

                // Check for page break
                if (yPos > 700) {
                    doc.addPage();
                    yPos = 50;
                }

                // Axis card
                doc.fillColor('#ffffff')
                   .strokeColor('#e2e8f0')
                   .lineWidth(1)
                   .roundedRect(50, yPos, 495, 60, 5)
                   .fillAndStroke();

                doc.fillColor(TEXT_DARK)
                   .fontSize(11)
                   .font('Helvetica-Bold')
                   .text(axisLabels[axis] || axis, 60, yPos + 10);

                // Metrics
                doc.fontSize(9)
                   .font('Helvetica')
                   .fillColor(TEXT_LIGHT)
                   .text('Current:', 60, yPos + 30)
                   .fillColor('#3b82f6')
                   .text((data.actual || 0).toString(), 100, yPos + 30)
                   .fillColor(TEXT_LIGHT)
                   .text('Target:', 150, yPos + 30)
                   .fillColor(PRIMARY)
                   .text((data.target || 0).toString(), 190, yPos + 30)
                   .fillColor(TEXT_LIGHT)
                   .text('Gap:', 240, yPos + 30)
                   .fillColor('#f59e0b')
                   .text(gap.toFixed(1), 265, yPos + 30);

                yPos += 70;
            });

            // Footer
            const pageCount = doc.bufferedPageRange().count;
            for (let i = 0; i < pageCount; i++) {
                doc.switchToPage(i);
                doc.fillColor(TEXT_LIGHT)
                   .fontSize(8)
                   .text(
                       `Page ${i + 1} of ${pageCount}`,
                       50,
                       doc.page.height - 50,
                       { align: 'center', width: doc.page.width - 100 }
                   );
            }

            doc.end();

            writeStream.on('finish', () => {
                console.log(`[PDFGenerator] PDF generated with PDFKit: ${filename}`);
                resolve(`/uploads/reports/${filename}`);
            });

            writeStream.on('error', reject);

        } catch (error) {
            reject(error);
        }
    });
}

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

// ==========================================
// MANAGEMENT REPORTS PDF GENERATION
// ==========================================

/**
 * Generate PDF for Management Reports (Team Meeting or Steering Committee)
 */
PdfGeneratorService.generateManagementReportPDF = async (report, options = {}) => {
    const { branding = {} } = options;

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../../uploads/reports');
    await fs.mkdir(uploadsDir, { recursive: true });

    const filename = `management_report_${report.id}_${Date.now()}.pdf`;
    const filepath = path.join(uploadsDir, filename);

    if (puppeteer) {
        try {
            return await generateManagementReportPDFWithPuppeteer(report, branding, filepath, filename);
        } catch (puppeteerError) {
            console.warn('[PDFGenerator] Puppeteer failed for management report:', puppeteerError.message);
            if (PDFDocument) {
                return await generateManagementReportPDFWithPDFKit(report, branding, filepath, filename);
            }
            throw puppeteerError;
        }
    } else if (PDFDocument) {
        return await generateManagementReportPDFWithPDFKit(report, branding, filepath, filename);
    } else {
        throw new Error('No PDF generation library available');
    }
};

/**
 * Generate Management Report PDF using Puppeteer
 */
async function generateManagementReportPDFWithPuppeteer(report, branding, filepath, filename) {
    const htmlContent = generateManagementReportHTML(report, branding);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });

        await page.pdf({
            path: filepath,
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
            displayHeaderFooter: true,
            headerTemplate: `
                <div style="font-size: 8pt; color: #64748b; padding: 0 15mm; width: 100%; text-align: right;">
                    <span>${branding.companyName || 'Consultify'} | ${report.title}</span>
                </div>
            `,
            footerTemplate: `
                <div style="font-size: 8pt; color: #64748b; padding: 0 15mm; width: 100%; display: flex; justify-content: space-between;">
                    <span>${report.reportType === 'TEAM_MEETING' ? 'Team Meeting Report' : 'Steering Committee Report'}</span>
                    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                </div>
            `
        });

        await browser.close();
        console.log(`[PDFGenerator] Management Report PDF generated: ${filename}`);
        return `/uploads/reports/${filename}`;

    } catch (error) {
        if (browser) await browser.close();
        throw error;
    }
}

/**
 * Generate Management Report PDF using PDFKit (fallback)
 */
async function generateManagementReportPDFWithPDFKit(report, branding, filepath, filename) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                info: {
                    Title: report.title,
                    Author: branding.companyName || 'Consultify',
                    Subject: report.reportType === 'TEAM_MEETING' ? 'Team Meeting Report' : 'Steering Committee Report'
                }
            });

            const writeStream = require('fs').createWriteStream(filepath);
            doc.pipe(writeStream);

            const PRIMARY = branding.primaryColor || '#7c3aed';
            const TEXT_DARK = '#1e293b';
            const TEXT_LIGHT = '#64748b';
            const GREEN = '#10b981';
            const AMBER = '#f59e0b';
            const RED = '#ef4444';

            // Header
            doc.fillColor(PRIMARY)
               .fontSize(24)
               .font('Helvetica-Bold')
               .text(branding.companyName || 'Consultify', 50, 50);

            doc.fillColor(TEXT_DARK)
               .fontSize(18)
               .text(report.title, 50, 85);

            doc.fillColor(TEXT_LIGHT)
               .fontSize(10)
               .text(`Period: ${report.periodStart} - ${report.periodEnd}`, 50, 115)
               .text(`Generated: ${new Date(report.createdAt).toLocaleString()}`, 50, 130);

            // Line separator
            doc.strokeColor(PRIMARY).lineWidth(2).moveTo(50, 150).lineTo(545, 150).stroke();

            let yPos = 170;

            if (report.reportType === 'TEAM_MEETING') {
                // Team Meeting Report Content
                const content = report.content;

                // Status Summary
                doc.fontSize(14).fillColor(TEXT_DARK).font('Helvetica-Bold').text('Status Overview', 50, yPos);
                yPos += 25;

                const summary = content.statusSummary || {};
                doc.fontSize(10).font('Helvetica').fillColor(TEXT_LIGHT);
                doc.text(`Progress: ${summary.progressPercent || 0}%`, 50, yPos);
                doc.text(`Tasks: ${summary.tasksCompleted || 0}/${summary.tasksTotal || 0} completed`, 200, yPos);
                doc.text(`Blocked: ${summary.tasksBlocked || 0}`, 400, yPos);
                yPos += 40;

                // Completed Work
                if (content.completedWork && content.completedWork.length > 0) {
                    doc.fontSize(14).fillColor(TEXT_DARK).font('Helvetica-Bold').text('Completed This Period', 50, yPos);
                    yPos += 25;
                    doc.fontSize(10).font('Helvetica').fillColor(TEXT_LIGHT);
                    content.completedWork.slice(0, 10).forEach(item => {
                        if (yPos > 700) { doc.addPage(); yPos = 50; }
                        doc.text(`• ${item.title}`, 60, yPos);
                        yPos += 15;
                    });
                    yPos += 15;
                }

                // Blockers
                if (content.blockers && content.blockers.length > 0) {
                    doc.fontSize(14).fillColor(RED).font('Helvetica-Bold').text('Blockers', 50, yPos);
                    yPos += 25;
                    doc.fontSize(10).font('Helvetica').fillColor(TEXT_DARK);
                    content.blockers.forEach(item => {
                        if (yPos > 700) { doc.addPage(); yPos = 50; }
                        doc.text(`• ${item.title} (${item.daysBlocked} days) - Owner: ${item.ownerName}`, 60, yPos);
                        yPos += 15;
                    });
                    yPos += 15;
                }

                // Pending Decisions
                if (content.pendingDecisions && content.pendingDecisions.length > 0) {
                    doc.fontSize(14).fillColor(AMBER).font('Helvetica-Bold').text('Pending Decisions', 50, yPos);
                    yPos += 25;
                    doc.fontSize(10).font('Helvetica').fillColor(TEXT_DARK);
                    content.pendingDecisions.forEach(item => {
                        if (yPos > 700) { doc.addPage(); yPos = 50; }
                        doc.text(`• ${item.title} - Owner: ${item.ownerName} (${item.daysWaiting} days)`, 60, yPos);
                        yPos += 15;
                    });
                }

            } else {
                // Steering Committee Report Content
                const content = report.content;

                // Executive Summary
                if (content.executiveSummary) {
                    doc.fontSize(14).fillColor(TEXT_DARK).font('Helvetica-Bold').text('Executive Summary', 50, yPos);
                    yPos += 25;
                    doc.fontSize(10).font('Helvetica').fillColor(TEXT_LIGHT);
                    doc.text(content.executiveSummary, 50, yPos, { width: 495 });
                    yPos += doc.heightOfString(content.executiveSummary, { width: 495 }) + 20;
                }

                // RAG Status
                if (content.overallStatus) {
                    doc.fontSize(14).fillColor(TEXT_DARK).font('Helvetica-Bold').text('Overall Status', 50, yPos);
                    yPos += 25;
                    
                    const statuses = ['schedule', 'budget', 'scope', 'risk'];
                    const statusColors = { GREEN, AMBER, RED, GREY: '#9ca3af' };
                    
                    statuses.forEach((key, i) => {
                        const status = content.overallStatus[key];
                        if (status) {
                            const color = statusColors[status.status] || TEXT_LIGHT;
                            doc.fillColor(color).fontSize(10).font('Helvetica-Bold');
                            doc.text(`${key.toUpperCase()}: ${status.status}`, 50 + i * 125, yPos);
                        }
                    });
                    yPos += 35;
                }

                // Risks & Issues
                if (content.risksAndIssues && content.risksAndIssues.length > 0) {
                    doc.fontSize(14).fillColor(TEXT_DARK).font('Helvetica-Bold').text('Risks & Issues', 50, yPos);
                    yPos += 25;
                    doc.fontSize(10).font('Helvetica').fillColor(TEXT_DARK);
                    content.risksAndIssues.slice(0, 5).forEach(item => {
                        if (yPos > 700) { doc.addPage(); yPos = 50; }
                        const sevColor = item.severity === 'CRITICAL' ? RED : item.severity === 'HIGH' ? AMBER : TEXT_LIGHT;
                        doc.fillColor(sevColor).text(`• [${item.severity}] ${item.title}`, 60, yPos);
                        yPos += 15;
                    });
                    yPos += 15;
                }

                // Decisions Required
                if (content.decisionsRequired && content.decisionsRequired.length > 0) {
                    doc.fontSize(14).fillColor(PRIMARY).font('Helvetica-Bold').text('Decisions Required from Board', 50, yPos);
                    yPos += 25;
                    doc.fontSize(10).font('Helvetica').fillColor(TEXT_DARK);
                    content.decisionsRequired.forEach(item => {
                        if (yPos > 700) { doc.addPage(); yPos = 50; }
                        doc.text(`• ${item.title} - Deadline: ${item.deadline}`, 60, yPos);
                        yPos += 15;
                    });
                }

                // Warnings (AI Transparency)
                if (content.warnings && content.warnings.length > 0) {
                    yPos += 20;
                    doc.fontSize(12).fillColor(RED).font('Helvetica-Bold').text('⚠️ Attention Required', 50, yPos);
                    yPos += 20;
                    doc.fontSize(10).font('Helvetica').fillColor(TEXT_DARK);
                    content.warnings.forEach(warning => {
                        if (yPos > 700) { doc.addPage(); yPos = 50; }
                        doc.text(`• ${warning}`, 60, yPos);
                        yPos += 15;
                    });
                }
            }

            // Audit Trail Footer
            doc.fontSize(8).fillColor(TEXT_LIGHT);
            const auditText = `PMO Standards: ISO 21500 | PMBOK 7 | PRINCE2 | Report ID: ${report.id}`;
            doc.text(auditText, 50, doc.page.height - 60, { align: 'center', width: 495 });

            doc.end();

            writeStream.on('finish', () => {
                console.log(`[PDFGenerator] Management Report PDF generated with PDFKit: ${filename}`);
                resolve(`/uploads/reports/${filename}`);
            });

            writeStream.on('error', reject);

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate HTML content for Management Reports
 */
function generateManagementReportHTML(report, branding) {
    const isTeamMeeting = report.reportType === 'TEAM_MEETING';
    const content = report.content || {};

    const ragColorMap = {
        GREEN: '#10b981',
        AMBER: '#f59e0b',
        RED: '#ef4444',
        GREY: '#9ca3af'
    };

    let sectionsHTML = '';

    if (isTeamMeeting) {
        // Team Meeting Report
        const summary = content.statusSummary || {};
        const completedWork = content.completedWork || [];
        const workInProgress = content.workInProgress || [];
        const blockers = content.blockers || [];
        const decisions = content.pendingDecisions || [];
        const nextPlan = content.nextPeriodPlan || [];

        sectionsHTML = `
            <div class="section">
                <h2>📊 Status Overview</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-label">Progress</div>
                        <div class="metric-value">${summary.progressPercent || 0}%</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Tasks Completed</div>
                        <div class="metric-value">${summary.tasksCompleted || 0}/${summary.tasksTotal || 0}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Blocked</div>
                        <div class="metric-value red">${summary.tasksBlocked || 0}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Decisions Pending</div>
                        <div class="metric-value amber">${summary.decisionsPending || 0}</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>✅ Completed This Period</h2>
                ${completedWork.length > 0 ? `
                    <ul class="task-list">
                        ${completedWork.slice(0, 15).map(item => `
                            <li>
                                <span class="task-title">${item.title}</span>
                                <span class="task-meta">${item.completedByName || 'Unknown'}</span>
                            </li>
                        `).join('')}
                    </ul>
                ` : '<p class="empty">No tasks completed in this period.</p>'}
            </div>

            <div class="section">
                <h2>⏳ Work In Progress</h2>
                ${workInProgress.length > 0 ? `
                    <ul class="task-list">
                        ${workInProgress.slice(0, 10).map(item => `
                            <li>
                                <span class="task-title">${item.title}</span>
                                <span class="task-meta">${item.assigneeName || 'Unassigned'} - ${item.progressPercent || 0}%</span>
                            </li>
                        `).join('')}
                    </ul>
                ` : '<p class="empty">No tasks in progress.</p>'}
            </div>

            ${blockers.length > 0 ? `
                <div class="section alert-section">
                    <h2>🚧 Blockers</h2>
                    <ul class="blocker-list">
                        ${blockers.map(item => `
                            <li class="blocker-item">
                                <div class="blocker-title">${item.title}</div>
                                <div class="blocker-meta">
                                    <span class="severity ${item.severity?.toLowerCase()}">${item.severity}</span>
                                    <span>Owner: ${item.ownerName}</span>
                                    <span>${item.daysBlocked} days blocked</span>
                                </div>
                                <div class="blocker-reason">${item.blockedReason || ''}</div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}

            ${decisions.length > 0 ? `
                <div class="section">
                    <h2>❓ Pending Decisions</h2>
                    <ul class="decision-list">
                        ${decisions.map(item => `
                            <li>
                                <span class="decision-title">${item.title}</span>
                                <span class="decision-meta">${item.ownerName} - ${item.daysWaiting} days waiting</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}

            <div class="section">
                <h2>📅 Plan for Next Period</h2>
                ${nextPlan.length > 0 ? `
                    <ul class="task-list">
                        ${nextPlan.slice(0, 10).map(item => `
                            <li>
                                <span class="task-title">${item.title}</span>
                                <span class="task-meta">${item.plannedDate || 'No date'} - ${item.assigneeName || 'Unassigned'}</span>
                            </li>
                        `).join('')}
                    </ul>
                ` : '<p class="empty">No tasks planned for next period.</p>'}
            </div>
        `;
    } else {
        // Steering Committee Report
        const executiveSummary = content.executiveSummary || '';
        const overallStatus = content.overallStatus || {};
        const kpis = content.kpis || [];
        const risks = content.risksAndIssues || [];
        const decisions = content.decisionsRequired || [];
        const warnings = content.warnings || [];
        const forecast = content.forecast || {};

        sectionsHTML = `
            <div class="section executive-summary">
                <h2>📋 Executive Summary</h2>
                <p>${executiveSummary || 'No summary available.'}</p>
            </div>

            <div class="section">
                <h2>🚦 Overall Status</h2>
                <div class="rag-grid">
                    ${['schedule', 'budget', 'scope', 'risk'].map(key => {
                        const status = overallStatus[key] || {};
                        return `
                            <div class="rag-card">
                                <div class="rag-label">${key.toUpperCase()}</div>
                                <div class="rag-status" style="background-color: ${ragColorMap[status.status] || '#9ca3af'}">
                                    ${status.status || 'N/A'}
                                </div>
                                <div class="rag-summary">${status.summary || ''}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            ${kpis.length > 0 ? `
                <div class="section">
                    <h2>📈 Key Performance Indicators</h2>
                    <div class="kpi-grid">
                        ${kpis.map(kpi => `
                            <div class="kpi-card">
                                <div class="kpi-name">${kpi.name}</div>
                                <div class="kpi-value">${kpi.currentValue}${kpi.unit}</div>
                                <div class="kpi-target">Target: ${kpi.targetValue}${kpi.unit}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${risks.length > 0 ? `
                <div class="section">
                    <h2>⚠️ Risks & Issues</h2>
                    <table class="risk-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Title</th>
                                <th>Severity</th>
                                <th>Owner</th>
                                <th>Days Open</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${risks.slice(0, 10).map(risk => `
                                <tr>
                                    <td>${risk.type}</td>
                                    <td>${risk.title}</td>
                                    <td class="severity-${risk.severity?.toLowerCase()}">${risk.severity}</td>
                                    <td>${risk.ownerName}</td>
                                    <td>${risk.daysOpen}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}

            ${decisions.length > 0 ? `
                <div class="section decisions-section">
                    <h2>❓ Decisions Required from Board</h2>
                    ${decisions.map(d => `
                        <div class="decision-card">
                            <div class="decision-header">
                                <span class="decision-type">${d.decisionType}</span>
                                <span class="decision-deadline ${d.daysUntilDeadline < 0 ? 'overdue' : ''}">
                                    ${d.daysUntilDeadline < 0 ? 'OVERDUE' : `Due: ${d.deadline}`}
                                </span>
                            </div>
                            <h3>${d.title}</h3>
                            <p>${d.description || ''}</p>
                            <div class="decision-requestor">Requested by: ${d.requestedByName}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${warnings.length > 0 ? `
                <div class="section warning-section">
                    <h2>🔴 Attention Required</h2>
                    <ul class="warning-list">
                        ${warnings.map(w => `<li>${w}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            <div class="section">
                <h2>🔮 Forecast & Next Milestones</h2>
                <p>${forecast.forecastNarrative || 'No forecast available.'}</p>
                ${forecast.nextMilestones && forecast.nextMilestones.length > 0 ? `
                    <ul>
                        ${forecast.nextMilestones.map(m => `<li>${m.name} - ${m.plannedDate}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }

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
            background: #fff;
        }
        .container { padding: 20px; max-width: 800px; margin: 0 auto; }
        .header {
            border-bottom: 3px solid ${branding.primaryColor || '#7c3aed'};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo { font-size: 24pt; font-weight: bold; color: ${branding.primaryColor || '#7c3aed'}; margin-bottom: 10px; }
        h1 { font-size: 20pt; color: #1e293b; margin-bottom: 10px; }
        .meta { font-size: 9pt; color: #64748b; }
        .section { margin-bottom: 30px; page-break-inside: avoid; }
        h2 { font-size: 14pt; color: #1e293b; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
        .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; }
        .metric-label { font-size: 9pt; color: #64748b; margin-bottom: 5px; }
        .metric-value { font-size: 24pt; font-weight: bold; color: ${branding.primaryColor || '#7c3aed'}; }
        .metric-value.red { color: #ef4444; }
        .metric-value.amber { color: #f59e0b; }
        .task-list { list-style: none; }
        .task-list li { padding: 8px 0; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; }
        .task-title { font-weight: 500; }
        .task-meta { font-size: 9pt; color: #64748b; }
        .blocker-list { list-style: none; }
        .blocker-item { background: #fef2f2; border-left: 4px solid #ef4444; padding: 10px; margin-bottom: 10px; border-radius: 4px; }
        .blocker-title { font-weight: bold; }
        .blocker-meta { font-size: 9pt; color: #64748b; margin-top: 5px; }
        .blocker-reason { font-size: 10pt; color: #374151; margin-top: 5px; }
        .severity { padding: 2px 8px; border-radius: 4px; font-size: 9pt; font-weight: bold; }
        .severity.high, .severity.critical { background: #fecaca; color: #991b1b; }
        .severity.medium { background: #fef3c7; color: #92400e; }
        .severity.low { background: #d1fae5; color: #065f46; }
        .decision-list { list-style: none; }
        .decision-list li { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .decision-title { font-weight: 500; }
        .decision-meta { font-size: 9pt; color: #64748b; }
        .empty { color: #9ca3af; font-style: italic; }
        .alert-section { background: #fef2f2; padding: 15px; border-radius: 8px; }
        .rag-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
        .rag-card { text-align: center; padding: 15px; background: #f8fafc; border-radius: 8px; }
        .rag-label { font-size: 10pt; font-weight: bold; color: #64748b; margin-bottom: 8px; }
        .rag-status { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; font-size: 12pt; }
        .rag-summary { font-size: 9pt; color: #64748b; margin-top: 8px; }
        .risk-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
        .risk-table th, .risk-table td { padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        .risk-table th { background: #f8fafc; font-weight: bold; }
        .severity-critical, .severity-high { color: #dc2626; font-weight: bold; }
        .severity-medium { color: #d97706; }
        .severity-low { color: #059669; }
        .decision-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
        .decision-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .decision-type { background: ${branding.primaryColor || '#7c3aed'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 9pt; }
        .decision-deadline { font-size: 9pt; color: #64748b; }
        .decision-deadline.overdue { color: #dc2626; font-weight: bold; }
        .decision-card h3 { font-size: 12pt; margin-bottom: 5px; }
        .decision-requestor { font-size: 9pt; color: #64748b; margin-top: 10px; }
        .warning-section { background: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; }
        .warning-list li { margin-left: 20px; margin-bottom: 5px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
        .kpi-name { font-size: 10pt; color: #64748b; }
        .kpi-value { font-size: 20pt; font-weight: bold; color: ${branding.primaryColor || '#7c3aed'}; }
        .kpi-target { font-size: 9pt; color: #64748b; }
        .audit-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #9ca3af; text-align: center; }
        .page-break { page-break-after: always; }
        /* DRAFT Watermark */
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120pt;
            font-weight: bold;
            color: rgba(239, 68, 68, 0.08);
            z-index: -1;
            pointer-events: none;
            white-space: nowrap;
            text-transform: uppercase;
            letter-spacing: 20px;
        }
        .watermark-banner {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #fef2f2;
            color: #991b1b;
            text-align: center;
            padding: 8px;
            font-size: 10pt;
            font-weight: bold;
            border-bottom: 2px solid #ef4444;
            z-index: 1000;
        }
        .watermark-banner span {
            margin: 0 20px;
        }
    </style>
</head>
<body>
    ${report.status !== 'FINAL' ? `
        <div class="watermark">DRAFT</div>
        <div class="watermark-banner">
            <span>⚠️ DRAFT - NOT FOR DISTRIBUTION ⚠️</span>
            <span>This report has not been finalized</span>
        </div>
    ` : ''}
    <div class="container" style="${report.status !== 'FINAL' ? 'margin-top: 40px;' : ''}">
        <div class="header">
            <div class="logo">${branding.companyName || 'Consultify'}</div>
            <h1>${report.title}</h1>
            <div class="meta">
                ${report.status !== 'FINAL' ? '<span style="color: #dc2626; font-weight: bold;">⚠️ DRAFT</span> | ' : ''}
                Period: ${report.periodStart} - ${report.periodEnd} | 
                Generated: ${new Date(report.createdAt).toLocaleString()}
            </div>
        </div>

        ${sectionsHTML}

        <div class="audit-footer">
            PMO Standards Compliance: ISO 21500:2021 | PMBOK 7th Edition | PRINCE2<br>
            Report ID: ${report.id} | ${isTeamMeeting ? 'Checkpoint Report' : 'Highlight Report'}
            ${report.status !== 'FINAL' ? '<br><span style="color: #dc2626;">DRAFT - NOT FINALIZED</span>' : ''}
        </div>
    </div>
</body>
</html>
    `;
}

// ============================================
// MULTI-FRAMEWORK PDF GENERATION
// ============================================

/**
 * Generate PDF for SIRI assessment report
 */
PdfGeneratorService.generateSIRIPDF = async (reportData, options = {}) => {
    const content = reportData.content || {};
    const branding = options.branding || {};
    
    const report = {
        id: reportData.id,
        title: `SIRI Assessment Report - ${content.buildingBlocks?.PROCESS?.name || 'Assessment'}`,
        type: 'SIRI',
        status: reportData.status,
        createdAt: reportData.created_at,
        sections: [
            {
                title: 'Executive Summary',
                content: content.executiveSummary || '',
            },
            {
                title: 'Overall Results',
                content: `Overall Score: ${content.overallScore?.toFixed(1)}/5`,
                chart: 'radar',
            },
            {
                title: 'Building Block Analysis',
                content: Object.entries(content.buildingBlocks || {}).map(([id, bb]) => 
                    `${bb.name}: ${bb.score?.toFixed(1)}/5`
                ).join('\n'),
            },
            {
                title: 'Key Findings',
                content: (content.keyFindings || []).map(f => `• ${f.title}: ${f.description}`).join('\n'),
            },
            {
                title: 'Recommendations',
                content: (content.recommendations || []).map(r => `• ${r.title}`).join('\n'),
            },
        ],
        legalNotice: content.legalNotice,
    };

    return PdfGeneratorService.generateReportPDF(report, { 
        ...options,
        template: 'siri-assessment' 
    });
};

/**
 * Generate PDF for ADMA assessment report
 */
PdfGeneratorService.generateADMAPDF = async (reportData, options = {}) => {
    const content = reportData.content || {};
    const branding = options.branding || {};
    
    const report = {
        id: reportData.id,
        title: `ADMA 2.0 Assessment Report`,
        type: 'ADMA',
        status: reportData.status,
        createdAt: reportData.created_at,
        sections: [
            {
                title: 'Executive Summary',
                content: content.executiveSummary || '',
            },
            {
                title: 'Digital Maturity Level',
                content: `Overall Score: ${content.overallScore?.toFixed(1)}/5 (${content.maturityLevel?.label || 'N/A'})`,
            },
            {
                title: '5 Pillars Overview',
                content: Object.entries(content.pillars || {}).map(([id, pillar]) => 
                    `${pillar.name}: ${pillar.score?.toFixed(1)}/5`
                ).join('\n'),
            },
            {
                title: 'Key Findings',
                content: (content.keyFindings || []).map(f => `• ${f.title}: ${f.description}`).join('\n'),
            },
            {
                title: 'Action Plan',
                content: (content.recommendations || []).map(r => `• ${r.title}`).join('\n'),
            },
        ],
        legalNotice: content.legalNotice,
    };

    return PdfGeneratorService.generateReportPDF(report, { 
        ...options,
        template: 'adma-assessment' 
    });
};

/**
 * Generate PDF for CMMI assessment report
 */
PdfGeneratorService.generateCMMIPDF = async (reportData, options = {}) => {
    const content = reportData.content || {};
    const branding = options.branding || {};
    
    const report = {
        id: reportData.id,
        title: `CMMI Assessment Report`,
        type: 'CMMI',
        status: reportData.status,
        createdAt: reportData.created_at,
        sections: [
            {
                title: 'Executive Summary',
                content: content.executiveSummary || '',
            },
            {
                title: 'Maturity Level',
                content: `Overall Maturity: Level ${content.overallLevel} - ${content.maturityLevel?.label || 'N/A'}`,
            },
            {
                title: 'Category Overview',
                content: Object.entries(content.categories || {}).map(([id, cat]) => 
                    `${cat.name}: Level ${cat.level}`
                ).join('\n'),
            },
            {
                title: 'Practice Areas',
                content: Object.entries(content.categories || {}).flatMap(([catId, cat]) => 
                    (cat.practiceAreas || []).map(pa => `${pa.name}: Level ${pa.level}`)
                ).join('\n'),
            },
            {
                title: 'Gaps to Next Level',
                content: Object.entries(content.gaps || {}).map(([paId, gap]) => 
                    `• ${paId}: Level ${gap.current} → ${gap.target} (Gap: ${gap.gap})`
                ).join('\n'),
            },
            {
                title: 'Improvement Plan',
                content: (content.recommendations || []).map(r => `• ${r.title}`).join('\n'),
            },
        ],
        legalNotice: content.legalNotice,
    };

    return PdfGeneratorService.generateReportPDF(report, { 
        ...options,
        template: 'cmmi-assessment' 
    });
};

/**
 * Generate PDF for Lean 4.0 (DBR77) assessment report
 * Features: One page per workstation
 */
PdfGeneratorService.generateLeanPDF = async (reportData, options = {}) => {
    const content = reportData.content || {};
    const branding = options.branding || {};
    
    const sections = [
        {
            title: 'Podsumowanie Zarządcze',
            content: content.executiveSummary || '',
        },
        {
            title: 'Wyniki Ogólne',
            content: `
                Ogólny wynik: ${content.overallScore?.toFixed(1)}/5
                Dojrzałość Lean: ${content.leanMaturity?.label || 'N/A'}
                Potencjał automatyzacji: ${content.automationPotential?.highPercent || 0}% wysoki
            `,
        },
        {
            title: 'Przegląd Faz',
            content: Object.entries(content.phases || {}).map(([id, phase]) => 
                `${phase.name}: ${phase.score?.toFixed(1)}/5`
            ).join('\n'),
        },
        {
            title: 'Analiza Procesów',
            content: (content.processAnalysis || []).map(p => 
                `• ${p.name}: ${p.stepCount} kroków, efektywność ${p.efficiency || 'N/A'}%`
            ).join('\n'),
        },
        {
            title: 'Podsumowanie Marnotrawstw',
            content: Object.entries(content.wasteSummary || {}).map(([type, waste]) => 
                `• ${waste.name}: średnia ${waste.average?.toFixed(1) || 0}/5`
            ).join('\n'),
        },
    ];

    // Add one page per workstation
    (content.workstationPages || []).forEach((ws, index) => {
        sections.push({
            title: `Stanowisko ${index + 1}: ${ws.name}`,
            pageBreakBefore: true,
            content: `
                Potencjał automatyzacji: ${ws.automationPotential}/5
                Typ automatyzacji: ${ws.automationType}
                Gotowość AI: ${ws.aiReadiness}/5
                
                Zadania: ${(ws.tasks || []).length}
                
                Rekomendacje:
                ${(ws.recommendations || []).map(r => `• ${r.title}`).join('\n')}
            `,
        });
    });

    sections.push({
        title: 'Plan Działań',
        content: (content.recommendations || []).map(r => `• ${r.title}`).join('\n'),
    });

    const report = {
        id: reportData.id,
        title: `Lean 4.0 (DBR77) Assessment Report`,
        type: 'LEAN',
        status: reportData.status,
        createdAt: reportData.created_at,
        sections,
    };

    return PdfGeneratorService.generateReportPDF(report, { 
        ...options,
        template: 'lean-assessment' 
    });
};

/**
 * Generate PDF for any multi-framework assessment
 * Dispatches to framework-specific generators
 */
PdfGeneratorService.generateMultiFrameworkPDF = async (reportData, options = {}) => {
    const framework = reportData.framework;
    
    switch (framework) {
        case 'SIRI':
            return PdfGeneratorService.generateSIRIPDF(reportData, options);
        case 'ADMA':
            return PdfGeneratorService.generateADMAPDF(reportData, options);
        case 'CMMI':
            return PdfGeneratorService.generateCMMIPDF(reportData, options);
        case 'LEAN':
            return PdfGeneratorService.generateLeanPDF(reportData, options);
        default:
            throw new Error(`Unsupported framework for PDF generation: ${framework}`);
    }
};

export default PdfGeneratorService;
