/**
 * PDF Export Service for Digitization Analyses
 * 
 * Generates professional PDF reports for digital maturity assessments.
 * Supports multiple templates: Executive Summary, Full Report, Gap Analysis.
 * 
 * Uses Puppeteer for high-quality PDF generation with charts and styling.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const fs = require('fs').promises;
const path = require('path');
const { DIGITIZATION_AXES, getLevelColor } = require('../data/digitizationEvaluationData');

// Try to require puppeteer, fallback to PDFKit if not available
let puppeteer;
let PDFDocument;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    console.log('[PDFExport] Puppeteer not available, will use PDFKit fallback');
}
try {
    PDFDocument = require('pdfkit');
} catch (e) {
    console.log('[PDFExport] PDFKit not available');
}

const PDFExportService = {
    /**
     * Export digitization analysis to PDF
     * @param {Object} analysis - Analysis data with scores
     * @param {Object} options - Export options
     * @returns {Promise<string>} - Path to generated PDF file
     */
    exportAnalysisToPDF: async (analysis, options = {}) => {
        const {
            template = 'executive', // 'executive' | 'full' | 'gap_analysis'
            language = 'pl',
            includeLogo = true,
            includeRecommendations = true,
            branding = {}
        } = options;

        // Ensure uploads directory exists
        const uploadsDir = path.join(__dirname, '../../uploads/economics');
        await fs.mkdir(uploadsDir, { recursive: true });

        // Generate filename
        const sanitizedName = (analysis.name || 'analysis').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const filename = `digitization_${sanitizedName}_${Date.now()}.pdf`;
        const filepath = path.join(uploadsDir, filename);

        // Try Puppeteer first, fall back to PDFKit
        if (puppeteer) {
            try {
                return await generatePDFWithPuppeteer(analysis, options, filepath, filename);
            } catch (puppeteerError) {
                console.warn('[PDFExport] Puppeteer failed, trying PDFKit fallback:', puppeteerError.message);
                if (PDFDocument) {
                    return await generatePDFWithPDFKit(analysis, options, filepath, filename);
                }
                throw puppeteerError;
            }
        } else if (PDFDocument) {
            return await generatePDFWithPDFKit(analysis, options, filepath, filename);
        } else {
            throw new Error('No PDF generation library available. Please install puppeteer or pdfkit.');
        }
    }
};

/**
 * Generate PDF using Puppeteer (HTML-based, best quality)
 */
async function generatePDFWithPuppeteer(analysis, options, filepath, filename) {
    const { template, language, includeLogo, includeRecommendations, branding } = options;
    const htmlContent = generateAnalysisHTML(analysis, {
        template,
        language,
        includeLogo,
        includeRecommendations,
        branding
    });

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
            margin: {
                top: '25mm',
                right: '15mm',
                bottom: '25mm',
                left: '15mm'
            },
            displayHeaderFooter: true,
            headerTemplate: generateHeaderTemplate(analysis, branding),
            footerTemplate: generateFooterTemplate()
        });

        await browser.close();
        console.log(`[PDFExport] PDF generated with Puppeteer: ${filename}`);
        return `/uploads/economics/${filename}`;

    } catch (error) {
        if (browser) await browser.close();
        throw error;
    }
}

/**
 * Generate PDF using PDFKit (native, fallback)
 */
async function generatePDFWithPDFKit(analysis, options, filepath, filename) {
    const { template, language, branding } = options;
    const isPl = language === 'pl';

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                info: {
                    Title: isPl ? `Analiza dojrzałości cyfrowej: ${analysis.name}` : `Digital Maturity Analysis: ${analysis.name}`,
                    Author: branding.companyName || 'Consultify',
                    Subject: isPl ? 'Raport oceny dojrzałości cyfrowej' : 'Digital Maturity Assessment Report'
                }
            });

            const writeStream = require('fs').createWriteStream(filepath);
            doc.pipe(writeStream);

            // Colors
            const PRIMARY = '#10b981';
            const SECONDARY = '#3b82f6';
            const TEXT_DARK = '#1e293b';
            const TEXT_LIGHT = '#64748b';

            // ==========================================
            // PAGE 1: Executive Summary
            // ==========================================

            // Title
            doc.fillColor(PRIMARY)
                .fontSize(28)
                .font('Helvetica-Bold')
                .text(isPl ? 'ANALIZA DOJRZAŁOŚCI CYFROWEJ' : 'DIGITAL MATURITY ANALYSIS', 50, 50);

            doc.fillColor(TEXT_DARK)
                .fontSize(18)
                .text(analysis.name, 50, 90);

            doc.fillColor(TEXT_LIGHT)
                .fontSize(10)
                .text(`${isPl ? 'Data raportu' : 'Report Date'}: ${new Date().toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US')}`, 50, 115);

            // Horizontal line
            doc.strokeColor(PRIMARY)
                .lineWidth(3)
                .moveTo(50, 140)
                .lineTo(545, 140)
                .stroke();

            // Overall Score Box
            const scoreBoxY = 170;
            doc.rect(50, scoreBoxY, 200, 100)
                .fillAndStroke('#f0fdf4', PRIMARY);

            doc.fillColor(TEXT_LIGHT)
                .fontSize(11)
                .text(isPl ? 'OGÓLNY WYNIK DOJRZAŁOŚCI' : 'OVERALL MATURITY SCORE', 60, scoreBoxY + 15);

            doc.fillColor(PRIMARY)
                .fontSize(48)
                .font('Helvetica-Bold')
                .text(`${(analysis.overallScore || 0).toFixed(1)}`, 60, scoreBoxY + 35);

            doc.fillColor(TEXT_DARK)
                .fontSize(18)
                .font('Helvetica')
                .text('/7', 130, scoreBoxY + 55);

            // Completion percentage
            doc.rect(270, scoreBoxY, 275, 100)
                .fillAndStroke('#f8fafc', '#e2e8f0');

            doc.fillColor(TEXT_LIGHT)
                .fontSize(11)
                .text(isPl ? 'UKOŃCZENIE OCENY' : 'ASSESSMENT COMPLETION', 280, scoreBoxY + 15);

            doc.fillColor(SECONDARY)
                .fontSize(36)
                .font('Helvetica-Bold')
                .text(`${analysis.completionPercent || 0}%`, 280, scoreBoxY + 40);

            doc.fillColor(TEXT_LIGHT)
                .fontSize(10)
                .font('Helvetica')
                .text(isPl ? `${Object.keys(analysis.axisScores || {}).length} z 6 osi ocenionych` : `${Object.keys(analysis.axisScores || {}).length} of 6 axes assessed`, 280, scoreBoxY + 75);

            // Description
            if (analysis.description) {
                doc.fillColor(TEXT_DARK)
                    .fontSize(11)
                    .text(analysis.description, 50, 300, { width: 495 });
            }

            // ==========================================
            // Axis Summary Table
            // ==========================================
            let yPos = analysis.description ? 350 : 300;

            doc.fillColor(TEXT_DARK)
                .fontSize(14)
                .font('Helvetica-Bold')
                .text(isPl ? 'WYNIKI PER OŚ' : 'AXIS RESULTS', 50, yPos);

            yPos += 25;

            // Table header
            doc.rect(50, yPos, 495, 25)
                .fillAndStroke('#f1f5f9', '#e2e8f0');

            doc.fillColor(TEXT_DARK)
                .fontSize(9)
                .font('Helvetica-Bold');

            doc.text(isPl ? 'OŚ' : 'AXIS', 60, yPos + 8);
            doc.text(isPl ? 'AKTUALNY' : 'CURRENT', 320, yPos + 8);
            doc.text(isPl ? 'DOCELOWY' : 'TARGET', 390, yPos + 8);
            doc.text(isPl ? 'LUKA' : 'GAP', 460, yPos + 8);

            yPos += 25;

            // Table rows
            DIGITIZATION_AXES.forEach((axis, index) => {
                const score = analysis.axisScores?.[axis.id];
                const current = score?.currentScore || 0;
                const target = score?.targetScore || 0;
                const gap = target - current;

                // Alternating row colors
                if (index % 2 === 0) {
                    doc.rect(50, yPos, 495, 22)
                        .fill('#ffffff');
                } else {
                    doc.rect(50, yPos, 495, 22)
                        .fill('#f8fafc');
                }

                doc.fillColor(TEXT_DARK)
                    .fontSize(9)
                    .font('Helvetica')
                    .text(isPl ? axis.namePl : axis.nameEn, 60, yPos + 6, { width: 250 });

                doc.text(current.toFixed(1), 330, yPos + 6);
                doc.text(target.toFixed(1), 400, yPos + 6);

                // Color-code gap
                doc.fillColor(gap > 1.5 ? '#ef4444' : gap > 0 ? '#f59e0b' : '#10b981')
                    .text(gap > 0 ? `-${gap.toFixed(1)}` : gap.toFixed(1), 465, yPos + 6);

                yPos += 22;
            });

            // Border around table
            doc.strokeColor('#e2e8f0')
                .lineWidth(1)
                .rect(50, yPos - 132, 495, 132 + 25)
                .stroke();

            // ==========================================
            // PAGE 2: Gap Analysis (if template is full or gap_analysis)
            // ==========================================
            if (options.template !== 'executive') {
                doc.addPage();

                doc.fillColor(TEXT_DARK)
                    .fontSize(18)
                    .font('Helvetica-Bold')
                    .text(isPl ? 'ANALIZA LUK' : 'GAP ANALYSIS', 50, 50);

                // Horizontal line
                doc.strokeColor(PRIMARY)
                    .lineWidth(2)
                    .moveTo(50, 75)
                    .lineTo(545, 75)
                    .stroke();

                yPos = 100;

                // Sort axes by gap (largest first)
                const sortedAxes = [...DIGITIZATION_AXES].sort((a, b) => {
                    const gapA = (analysis.axisScores?.[a.id]?.targetScore || 0) - (analysis.axisScores?.[a.id]?.currentScore || 0);
                    const gapB = (analysis.axisScores?.[b.id]?.targetScore || 0) - (analysis.axisScores?.[b.id]?.currentScore || 0);
                    return gapB - gapA;
                });

                sortedAxes.forEach((axis, index) => {
                    const score = analysis.axisScores?.[axis.id];
                    const current = score?.currentScore || 0;
                    const target = score?.targetScore || 0;
                    const gap = target - current;

                    if (yPos > 700) {
                        doc.addPage();
                        yPos = 50;
                    }

                    // Axis header
                    doc.fillColor(TEXT_DARK)
                        .fontSize(12)
                        .font('Helvetica-Bold')
                        .text(`${index + 1}. ${isPl ? axis.namePl : axis.nameEn}`, 50, yPos);

                    yPos += 20;

                    // Progress bar background
                    doc.rect(50, yPos, 400, 20)
                        .fill('#f1f5f9');

                    // Current progress
                    doc.rect(50, yPos, (current / 7) * 400, 20)
                        .fill(SECONDARY);

                    // Target marker
                    const targetX = 50 + (target / 7) * 400;
                    doc.strokeColor(PRIMARY)
                        .lineWidth(3)
                        .moveTo(targetX, yPos - 5)
                        .lineTo(targetX, yPos + 25)
                        .stroke();

                    // Scores text
                    doc.fillColor(TEXT_DARK)
                        .fontSize(10)
                        .font('Helvetica')
                        .text(`${isPl ? 'Aktualny' : 'Current'}: ${current.toFixed(1)}`, 470, yPos);
                    doc.text(`${isPl ? 'Docelowy' : 'Target'}: ${target.toFixed(1)}`, 470, yPos + 12);

                    yPos += 45;
                });
            }

            // ==========================================
            // Final page: Recommendations
            // ==========================================
            if (options.includeRecommendations) {
                doc.addPage();

                doc.fillColor(TEXT_DARK)
                    .fontSize(18)
                    .font('Helvetica-Bold')
                    .text(isPl ? 'REKOMENDACJE' : 'RECOMMENDATIONS', 50, 50);

                doc.strokeColor(PRIMARY)
                    .lineWidth(2)
                    .moveTo(50, 75)
                    .lineTo(545, 75)
                    .stroke();

                yPos = 100;

                // Find top gaps
                const topGaps = [...DIGITIZATION_AXES]
                    .map(axis => ({
                        ...axis,
                        gap: (analysis.axisScores?.[axis.id]?.targetScore || 0) - (analysis.axisScores?.[axis.id]?.currentScore || 0)
                    }))
                    .filter(a => a.gap > 0)
                    .sort((a, b) => b.gap - a.gap)
                    .slice(0, 3);

                topGaps.forEach((axis, index) => {
                    doc.fillColor(TEXT_DARK)
                        .fontSize(12)
                        .font('Helvetica-Bold')
                        .text(`${isPl ? 'Priorytet' : 'Priority'} ${index + 1}: ${isPl ? axis.namePl : axis.nameEn}`, 50, yPos);

                    yPos += 20;

                    doc.fillColor(TEXT_LIGHT)
                        .fontSize(10)
                        .font('Helvetica')
                        .text(`${isPl ? 'Luka do zamknięcia' : 'Gap to close'}: ${axis.gap.toFixed(1)} ${isPl ? 'poziomów' : 'levels'}`, 50, yPos);

                    yPos += 20;

                    // General recommendation text
                    const recommendation = isPl
                        ? `Zalecamy przeprowadzenie dedykowanej analizy obszaru "${axis.namePl}" i opracowanie planu transformacji, który pozwoli na osiągnięcie poziomu docelowego.`
                        : `We recommend conducting a dedicated analysis of the "${axis.nameEn}" area and developing a transformation plan to achieve the target level.`;

                    doc.fillColor(TEXT_DARK)
                        .text(recommendation, 50, yPos, { width: 495 });

                    yPos += 50;
                });
            }

            // Finalize document
            doc.end();

            writeStream.on('finish', () => {
                console.log(`[PDFExport] PDF generated with PDFKit: ${filename}`);
                resolve(`/uploads/economics/${filename}`);
            });

            writeStream.on('error', reject);

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate HTML content for PDF generation (Puppeteer)
 */
function generateAnalysisHTML(analysis, options) {
    const { template, language, includeLogo, includeRecommendations, branding } = options;
    const isPl = language === 'pl';

    // Calculate axis stats
    const axisStats = DIGITIZATION_AXES.map(axis => {
        const score = analysis.axisScores?.[axis.id];
        return {
            id: axis.id,
            name: isPl ? axis.namePl : axis.nameEn,
            current: score?.currentScore || 0,
            target: score?.targetScore || 0,
            gap: (score?.targetScore || 0) - (score?.currentScore || 0),
            color: axis.color
        };
    });

    const topGaps = [...axisStats]
        .filter(a => a.gap > 0)
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 3);

    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            color: #1e293b;
            line-height: 1.5;
            background: white;
        }
        .page { 
            padding: 40px 50px;
            page-break-after: always;
        }
        .page:last-child { page-break-after: avoid; }
        h1 { font-size: 28px; color: #10b981; margin-bottom: 8px; }
        h2 { font-size: 20px; color: #1e293b; margin: 30px 0 15px; border-bottom: 2px solid #10b981; padding-bottom: 8px; }
        h3 { font-size: 14px; color: #64748b; margin-bottom: 20px; }
        .subtitle { font-size: 16px; color: #64748b; margin-bottom: 10px; }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
        }
        .metric-card {
            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
            border: 1px solid #d1fae5;
            border-radius: 12px;
            padding: 20px;
        }
        .metric-card.secondary {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
        }
        .metric-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
        .metric-value { font-size: 42px; font-weight: bold; color: #10b981; }
        .metric-value.secondary { color: #3b82f6; }
        .metric-suffix { font-size: 18px; color: #94a3b8; }

        .axis-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .axis-table th { 
            background: #f8fafc; 
            padding: 12px; 
            text-align: left; 
            font-size: 11px; 
            text-transform: uppercase;
            color: #64748b;
            border-bottom: 2px solid #e2e8f0;
        }
        .axis-table td { 
            padding: 12px; 
            border-bottom: 1px solid #f1f5f9;
            font-size: 13px;
        }
        .axis-table tr:hover { background: #f8fafc; }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: #f1f5f9;
            border-radius: 4px;
            overflow: hidden;
            position: relative;
        }
        .progress-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s;
        }
        .progress-target {
            position: absolute;
            top: -4px;
            width: 2px;
            height: 16px;
            background: #10b981;
        }

        .gap-positive { color: #ef4444; }
        .gap-moderate { color: #f59e0b; }
        .gap-zero { color: #10b981; }

        .recommendation-card {
            background: #fff7ed;
            border: 1px solid #fed7aa;
            border-radius: 8px;
            padding: 16px;
            margin: 12px 0;
        }
        .recommendation-priority {
            display: inline-block;
            background: #f97316;
            color: white;
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 4px;
            margin-bottom: 8px;
        }

        .footer {
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
    </style>
</head>
<body>
    <!-- Page 1: Executive Summary -->
    <div class="page">
        <h1>${isPl ? 'ANALIZA DOJRZAŁOŚCI CYFROWEJ' : 'DIGITAL MATURITY ANALYSIS'}</h1>
        <h3>${analysis.name}</h3>
        <p class="subtitle">${isPl ? 'Data raportu' : 'Report Date'}: ${new Date().toLocaleDateString(isPl ? 'pl-PL' : 'en-US')}</p>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">${isPl ? 'Ogólny wynik dojrzałości' : 'Overall Maturity Score'}</div>
                <div class="metric-value">${(analysis.overallScore || 0).toFixed(1)}<span class="metric-suffix">/7</span></div>
            </div>
            <div class="metric-card secondary">
                <div class="metric-label">${isPl ? 'Ukończenie oceny' : 'Assessment Completion'}</div>
                <div class="metric-value secondary">${analysis.completionPercent || 0}<span class="metric-suffix">%</span></div>
            </div>
        </div>

        ${analysis.description ? `<p style="margin: 20px 0; color: #64748b;">${analysis.description}</p>` : ''}

        <h2>${isPl ? 'Wyniki per oś' : 'Axis Results'}</h2>
        <table class="axis-table">
            <thead>
                <tr>
                    <th style="width: 50%">${isPl ? 'Oś' : 'Axis'}</th>
                    <th>${isPl ? 'Aktualny' : 'Current'}</th>
                    <th>${isPl ? 'Docelowy' : 'Target'}</th>
                    <th>${isPl ? 'Luka' : 'Gap'}</th>
                </tr>
            </thead>
            <tbody>
                ${axisStats.map(axis => `
                    <tr>
                        <td><strong>${axis.name}</strong></td>
                        <td>${axis.current.toFixed(1)}</td>
                        <td>${axis.target.toFixed(1)}</td>
                        <td class="${axis.gap > 1.5 ? 'gap-positive' : axis.gap > 0 ? 'gap-moderate' : 'gap-zero'}">
                            ${axis.gap > 0 ? '-' : ''}${axis.gap.toFixed(1)}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    ${template !== 'executive' ? `
    <!-- Page 2: Gap Analysis -->
    <div class="page">
        <h2>${isPl ? 'Analiza luk' : 'Gap Analysis'}</h2>
        ${axisStats.sort((a, b) => b.gap - a.gap).map(axis => `
            <div style="margin: 20px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong>${axis.name}</strong>
                    <span>${isPl ? 'Aktualny' : 'Current'}: ${axis.current.toFixed(1)} → ${isPl ? 'Docelowy' : 'Target'}: ${axis.target.toFixed(1)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(axis.current / 7) * 100}%; background: ${axis.color};"></div>
                    <div class="progress-target" style="left: ${(axis.target / 7) * 100}%;"></div>
                </div>
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${includeRecommendations && topGaps.length > 0 ? `
    <!-- Page 3: Recommendations -->
    <div class="page">
        <h2>${isPl ? 'Rekomendacje' : 'Recommendations'}</h2>
        <p style="margin-bottom: 20px; color: #64748b;">
            ${isPl
                ? 'Na podstawie analizy luk, rekomendujemy następujące priorytety transformacji cyfrowej:'
                : 'Based on the gap analysis, we recommend the following digital transformation priorities:'}
        </p>
        ${topGaps.map((axis, index) => `
            <div class="recommendation-card">
                <span class="recommendation-priority">${isPl ? 'Priorytet' : 'Priority'} ${index + 1}</span>
                <h4 style="margin-bottom: 8px;">${axis.name}</h4>
                <p style="font-size: 12px; color: #64748b;">
                    ${isPl ? 'Luka do zamknięcia' : 'Gap to close'}: ${axis.gap.toFixed(1)} ${isPl ? 'poziomów' : 'levels'}
                </p>
                <p style="font-size: 13px; margin-top: 8px;">
                    ${isPl
                        ? `Zalecamy przeprowadzenie dedykowanej analizy tego obszaru i opracowanie planu transformacji, który pozwoli na osiągnięcie poziomu docelowego.`
                        : `We recommend conducting a dedicated analysis of this area and developing a transformation plan to achieve the target level.`}
                </p>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="footer">
        ${isPl ? 'Wygenerowano przez Consultify' : 'Generated by Consultify'} • ${new Date().toISOString()}
    </div>
</body>
</html>
    `;
}

/**
 * Generate header template for PDF
 */
function generateHeaderTemplate(analysis, branding) {
    return `
        <div style="font-size: 9px; color: #94a3b8; padding: 0 40px; width: 100%; display: flex; justify-content: space-between;">
            <span>${branding.companyName || 'Consultify'}</span>
            <span>${analysis.name || 'Digital Maturity Analysis'}</span>
        </div>
    `;
}

/**
 * Generate footer template for PDF
 */
function generateFooterTemplate() {
    return `
        <div style="font-size: 9px; color: #94a3b8; padding: 0 40px; width: 100%; display: flex; justify-content: space-between;">
            <span></span>
            <span>Strona <span class="pageNumber"></span> z <span class="totalPages"></span></span>
        </div>
    `;
}

/**
 * Generate Status Report PDF
 * @param {Object} report - Status report data
 * @returns {Promise<Buffer>} - PDF buffer
 */
PDFExportService.generateStatusReportPdf = async (report) => {
    const html = generateStatusReportHTML(report);

    if (puppeteer) {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' },
                printBackground: true
            });

            return pdfBuffer;
        } finally {
            await browser.close();
        }
    } else if (PDFDocument) {
        // Fallback to PDFKit
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Header
            doc.fontSize(24).fillColor('#1e3a5f').text(report.initiativeName || 'Status Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(14).fillColor('#64748b').text(report.periodLabel || 'Current Period', { align: 'center' });
            doc.moveDown(2);

            // Overall Status
            const statusColors = { GREEN: '#22c55e', AMBER: '#f59e0b', RED: '#ef4444' };
            doc.fontSize(12).fillColor('#1e3a5f').text('Overall Status: ', { continued: true });
            doc.fillColor(statusColors[report.overallStatus] || '#64748b').text(report.overallStatus || 'N/A');
            doc.moveDown();

            // Executive Summary
            if (report.executiveSummary) {
                doc.fontSize(14).fillColor('#1e3a5f').text('Executive Summary');
                doc.moveDown(0.5);
                doc.fontSize(10).fillColor('#334155').text(report.executiveSummary);
                doc.moveDown();
            }

            // Accomplishments
            if (report.accomplishments && report.accomplishments.length > 0) {
                doc.fontSize(14).fillColor('#1e3a5f').text('Key Accomplishments');
                doc.moveDown(0.5);
                report.accomplishments.forEach(item => {
                    doc.fontSize(10).fillColor('#334155').text(`• ${item}`);
                });
                doc.moveDown();
            }

            // Next Steps
            if (report.nextSteps && report.nextSteps.length > 0) {
                doc.fontSize(14).fillColor('#1e3a5f').text('Next Steps');
                doc.moveDown(0.5);
                report.nextSteps.forEach(item => {
                    doc.fontSize(10).fillColor('#334155').text(`• ${item}`);
                });
                doc.moveDown();
            }

            // Footer
            doc.fontSize(8).fillColor('#94a3b8').text(
                `Generated by Consultify • ${new Date().toISOString()}`,
                40, doc.page.height - 40, { align: 'center' }
            );

            doc.end();
        });
    } else {
        throw new Error('No PDF generation library available');
    }
};

/**
 * Generate Status Report HTML for PDF
 */
function generateStatusReportHTML(report) {
    const statusColors = { GREEN: '#22c55e', AMBER: '#f59e0b', RED: '#ef4444' };
    const statusLabels = { GREEN: 'On Track', AMBER: 'At Risk', RED: 'Off Track' };
    const status = report.overallStatus || 'GREEN';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            color: #1e293b; 
            padding: 40px;
            line-height: 1.5;
        }
        .header { text-align: center; margin-bottom: 30px; }
        .title { font-size: 28px; font-weight: 700; color: #1e3a5f; }
        .period { font-size: 14px; color: #64748b; margin-top: 8px; }
        .status-banner {
            background: ${statusColors[status]}15;
            border-left: 4px solid ${statusColors[status]};
            padding: 16px 20px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        .status-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
        .status-value { font-size: 20px; font-weight: 700; color: ${statusColors[status]}; margin-top: 4px; }
        .section { margin: 24px 0; }
        .section-title { font-size: 16px; font-weight: 600; color: #1e3a5f; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        .summary-text { font-size: 12px; color: #334155; line-height: 1.6; }
        .list { list-style: none; }
        .list li { padding: 8px 0; padding-left: 20px; position: relative; font-size: 12px; }
        .list li::before { content: "•"; position: absolute; left: 0; color: #7c3aed; font-weight: bold; }
        .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
        .metric-card { background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: 700; color: #1e3a5f; }
        .metric-label { font-size: 10px; color: #64748b; text-transform: uppercase; margin-top: 4px; }
        .escalations { background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px 20px; border-radius: 0 8px 8px 0; }
        .escalations-title { color: #b91c1c; font-weight: 600; margin-bottom: 8px; }
        .escalations li::before { color: #ef4444; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${report.initiativeName || 'Status Report'}</div>
        <div class="period">${report.periodLabel || 'Current Period'}</div>
    </div>
    
    <div class="status-banner">
        <div class="status-label">Overall Status</div>
        <div class="status-value">${statusLabels[status]} (${status})</div>
    </div>
    
    ${report.metrics ? `
    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-value">${report.metrics.progressPercent || 0}%</div>
            <div class="metric-label">Progress</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${report.metrics.tasksCompleted || 0}/${report.metrics.tasksTotal || 0}</div>
            <div class="metric-label">Tasks</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${report.metrics.openRisks || 0}</div>
            <div class="metric-label">Open Risks</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${report.metrics.pendingDecisions || 0}</div>
            <div class="metric-label">Pending Decisions</div>
        </div>
    </div>
    ` : ''}
    
    ${report.executiveSummary ? `
    <div class="section">
        <div class="section-title">Executive Summary</div>
        <p class="summary-text">${report.executiveSummary}</p>
    </div>
    ` : ''}
    
    ${report.accomplishments && report.accomplishments.length > 0 ? `
    <div class="section">
        <div class="section-title">Key Accomplishments</div>
        <ul class="list">
            ${report.accomplishments.map(item => `<li>${item}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
    
    ${report.nextSteps && report.nextSteps.length > 0 ? `
    <div class="section">
        <div class="section-title">Next Steps</div>
        <ul class="list">
            ${report.nextSteps.map(item => `<li>${item}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
    
    ${report.recommendations ? `
    <div class="section">
        <div class="section-title">Recommendations</div>
        <p class="summary-text">${report.recommendations}</p>
    </div>
    ` : ''}
    
    ${report.escalations && report.escalations.length > 0 ? `
    <div class="escalations">
        <div class="escalations-title">⚠ Escalations Requiring Decision</div>
        <ul class="list">
            ${report.escalations.map(item => `<li>${typeof item === 'string' ? item : item.message}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
    
    <div class="footer">
        Generated by Consultify • ${new Date().toLocaleDateString('pl-PL')} ${new Date().toLocaleTimeString('pl-PL')}
    </div>
</body>
</html>
    `;
}

export default PDFExportService;
