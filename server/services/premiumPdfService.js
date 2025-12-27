/**
 * Premium PDF Service
 * 
 * Puppeteer-based PDF generation for McKinsey/BCG-grade reports.
 * Uses Handlebars templates for pixel-perfect output.
 */

const puppeteer = require('puppeteer');
const Handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const db = require('../database');

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', function (date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

Handlebars.registerHelper('formatNumber', function (num, decimals = 1) {
    if (num === null || num === undefined) return 'N/A';
    return parseFloat(num).toFixed(decimals);
});

Handlebars.registerHelper('getGapColor', function (gap) {
    if (gap <= 0.5) return '#22c55e';
    if (gap <= 1.0) return '#84cc16';
    if (gap <= 1.5) return '#eab308';
    if (gap <= 2.0) return '#f97316';
    return '#ef4444';
});

Handlebars.registerHelper('getPriorityBadge', function (priority) {
    const badges = {
        critical: { bg: '#fef2f2', color: '#991b1b', label: 'Krytyczny' },
        high: { bg: '#fef3c7', color: '#92400e', label: 'Wysoki' },
        medium: { bg: '#ecfdf5', color: '#065f46', label: 'Średni' },
        low: { bg: '#f0fdf4', color: '#166534', label: 'Niski' }
    };
    return badges[priority] || badges.medium;
});

Handlebars.registerHelper('times', function (n, block) {
    let result = '';
    for (let i = 0; i < n; i++) {
        result += block.fn(i);
    }
    return result;
});

class PremiumPdfService {
    constructor() {
        this.templatesDir = path.join(__dirname, '../templates');
        this.uploadsDir = path.join(__dirname, '../../uploads/reports');
        this.browser = null;
    }

    /**
     * Initialize browser instance (reuse for better performance)
     */
    async getBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--font-render-hinting=none'
                ]
            });
        }
        return this.browser;
    }

    /**
     * Load and compile a Handlebars template
     */
    async loadTemplate(templateName) {
        const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        return Handlebars.compile(templateContent);
    }

    /**
     * Load partials for the template
     */
    async loadPartials() {
        const partialsDir = path.join(this.templatesDir, 'report-partials');

        try {
            const files = await fs.readdir(partialsDir);

            for (const file of files) {
                if (file.endsWith('.hbs')) {
                    const partialName = file.replace('.hbs', '');
                    const partialContent = await fs.readFile(
                        path.join(partialsDir, file),
                        'utf-8'
                    );
                    Handlebars.registerPartial(partialName, partialContent);
                }
            }
        } catch (error) {
            console.log('No partials directory found, skipping...');
        }
    }

    /**
     * Generate a premium PDF report
     */
    async generatePDF(reportId, options = {}) {
        const {
            format = 'A4',
            landscape = false,
            includeAppendix = true,
            brandColor = '#6366F1'
        } = options;

        // Fetch report data
        const reportData = await this.getReportData(reportId);

        if (!reportData) {
            throw new Error(`Report ${reportId} not found`);
        }

        // Load template and partials
        await this.loadPartials();
        const template = await this.loadTemplate('premium-report');

        // Prepare context
        const context = {
            ...reportData,
            brandColor,
            generatedAt: new Date().toISOString(),
            includeAppendix
        };

        // Render HTML
        const html = template(context);

        // Get CSS
        const cssPath = path.join(this.templatesDir, 'premium-print.css');
        let css = '';
        try {
            css = await fs.readFile(cssPath, 'utf-8');
        } catch {
            css = this.getDefaultPrintCSS();
        }

        // Full HTML document
        const fullHtml = `
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${reportData.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet">
        <style>${css}</style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;

        // Generate PDF with Puppeteer
        const browser = await this.getBrowser();
        const page = await browser.newPage();

        try {
            await page.setContent(fullHtml, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for any charts to render
            await page.evaluate(() => {
                return new Promise((resolve) => {
                    setTimeout(resolve, 1000);
                });
            });

            // Generate PDF
            const pdf = await page.pdf({
                format,
                landscape,
                printBackground: true,
                preferCSSPageSize: true,
                margin: {
                    top: '20mm',
                    bottom: '25mm',
                    left: '15mm',
                    right: '15mm'
                },
                displayHeaderFooter: true,
                headerTemplate: `
          <div style="width: 100%; font-size: 9px; padding: 5px 20px; color: #64748b; font-family: Inter, sans-serif;">
            <span style="float: left;">${reportData.organizationName || ''}</span>
            <span style="float: right;">CONFIDENTIAL</span>
          </div>
        `,
                footerTemplate: `
          <div style="width: 100%; font-size: 9px; padding: 5px 20px; color: #64748b; text-align: center; font-family: Inter, sans-serif;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        `
            });

            // Save to file
            const filename = `report-${reportId}-${Date.now()}.pdf`;
            const filepath = path.join(this.uploadsDir, filename);

            await fs.mkdir(this.uploadsDir, { recursive: true });
            await fs.writeFile(filepath, pdf);

            return {
                pdf,
                filename,
                filepath,
                size: pdf.length
            };

        } finally {
            await page.close();
        }
    }

    /**
     * Get report data from database
     */
    async getReportData(reportId) {
        try {
            // Get report
            const report = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT r.*, a.name as assessment_name, o.name as organization_name 
           FROM assessment_reports r
           LEFT JOIN assessments a ON r.assessment_id = a.id
           LEFT JOIN organizations o ON a.organization_id = o.id
           WHERE r.id = ?`,
                    [reportId],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });

            if (!report) return null;

            // Get sections
            const sections = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT * FROM report_sections 
           WHERE report_id = ? 
           ORDER BY order_index`,
                    [reportId],
                    (err, rows) => err ? reject(err) : resolve(rows || [])
                );
            });

            // Get assessment data for charts
            const assessment = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT * FROM assessments WHERE id = ?`,
                    [report.assessment_id],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });

            // Get axis ratings
            const axisRatings = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT * FROM assessment_axis_ratings 
           WHERE assessment_id = ?`,
                    [report.assessment_id],
                    (err, rows) => err ? reject(err) : resolve(rows || [])
                );
            });

            // Calculate metrics
            const axes = axisRatings.map(ar => ({
                id: ar.axis_id,
                name: this.getAxisName(ar.axis_id),
                actual: ar.actual_level || 0,
                target: ar.target_level || 0,
                gap: (ar.target_level || 0) - (ar.actual_level || 0)
            }));

            const avgActual = axes.length > 0
                ? axes.reduce((sum, a) => sum + a.actual, 0) / axes.length
                : 0;
            const avgTarget = axes.length > 0
                ? axes.reduce((sum, a) => sum + a.target, 0) / axes.length
                : 0;
            const totalGap = axes.reduce((sum, a) => sum + Math.max(0, a.gap), 0);

            return {
                id: report.id,
                name: report.name,
                status: report.status,
                assessmentId: report.assessment_id,
                assessmentName: report.assessment_name,
                organizationName: report.organization_name,
                createdAt: report.created_at,
                updatedAt: report.updated_at,
                sections: sections.map(s => ({
                    ...s,
                    content: s.content,
                    dataSnapshot: s.data_snapshot ? JSON.parse(s.data_snapshot) : {}
                })),
                metrics: {
                    overallMaturity: avgActual.toFixed(1),
                    targetMaturity: avgTarget.toFixed(1),
                    totalGapPoints: totalGap.toFixed(1),
                    estimatedROI: '180%' // Placeholder - would be calculated
                },
                axes,
                assessment: assessment ? JSON.parse(assessment.data || '{}') : {}
            };

        } catch (error) {
            console.error('Error fetching report data:', error);
            throw error;
        }
    }

    /**
     * Get axis display name
     */
    getAxisName(axisId) {
        const names = {
            processes: 'Procesy',
            digitalProducts: 'Produkty Cyfrowe',
            businessModels: 'Modele Biznesowe',
            dataManagement: 'Zarządzanie Danymi',
            culture: 'Kultura',
            cybersecurity: 'Cyberbezpieczeństwo',
            aiMaturity: 'Dojrzałość AI'
        };
        return names[axisId] || axisId;
    }

    /**
     * Default print CSS if file not found
     */
    getDefaultPrintCSS() {
        return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 11pt;
        line-height: 1.5;
        color: #1e293b;
      }
      
      h1 {
        font-family: 'Fraunces', serif;
        font-size: 28pt;
        font-weight: 700;
        margin-bottom: 16px;
      }
      
      h2 {
        font-size: 18pt;
        font-weight: 600;
        margin-top: 24px;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 2px solid #e2e8f0;
      }
      
      h3 {
        font-size: 14pt;
        font-weight: 600;
        margin-top: 16px;
        margin-bottom: 8px;
      }
      
      p {
        margin-bottom: 12px;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
        font-size: 10pt;
      }
      
      th {
        background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
        color: white;
        padding: 10px 12px;
        text-align: left;
        font-weight: 600;
      }
      
      td {
        padding: 10px 12px;
        border: 1px solid #e5e7eb;
      }
      
      tr:nth-child(even) td {
        background: #f8fafc;
      }
      
      .cover-page {
        page-break-after: always;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
        color: white;
        padding: 60px;
      }
      
      .cover-page h1 {
        font-size: 36pt;
        margin-bottom: 16px;
      }
      
      .section {
        page-break-before: always;
        padding: 20px 0;
      }
      
      .metric-card {
        display: inline-block;
        padding: 16px 24px;
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        border-radius: 12px;
        color: white;
        text-align: center;
        margin: 8px;
      }
      
      .metric-value {
        font-size: 28pt;
        font-weight: 700;
      }
      
      .metric-label {
        font-size: 10pt;
        opacity: 0.9;
      }
      
      @page {
        size: A4;
        margin: 20mm 15mm 25mm 15mm;
      }
      
      @page :first {
        margin: 0;
      }
    `;
    }

    /**
     * Cleanup browser on shutdown
     */
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

// Singleton instance
const premiumPdfService = new PremiumPdfService();

// Cleanup on process exit
process.on('exit', () => premiumPdfService.cleanup());
process.on('SIGINT', () => {
    premiumPdfService.cleanup();
    process.exit();
});

module.exports = premiumPdfService;
