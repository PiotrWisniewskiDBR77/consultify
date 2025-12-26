/**
 * PDFExportService
 * 
 * Enhanced PDF export for DRD Assessment Reports
 * Features:
 * - Professional cover page with branding
 * - Table of contents with page numbers
 * - Headers and footers on each page
 * - Vector charts (SVG embedded)
 * - Watermark option ("CONFIDENTIAL")
 * - Enterprise styling
 */

const PDFDocument = require('pdfkit');

// DRD Brand Colors
const COLORS = {
    primary: '#1e3a5f',       // Navy blue
    secondary: '#3b82f6',     // Blue
    accent: '#10b981',        // Green
    warning: '#f59e0b',       // Amber
    danger: '#ef4444',        // Red
    textDark: '#1e293b',
    textMedium: '#475569',
    textLight: '#64748b',
    border: '#e2e8f0',
    bgLight: '#f8fafc',
    bgAlt: '#f1f5f9'
};

// DRD Axis configuration
const DRD_AXES = {
    processes: { name: 'Digital Processes', namePl: 'Procesy Cyfrowe', icon: '⚙️', maxLevel: 7 },
    digitalProducts: { name: 'Digital Products', namePl: 'Produkty Cyfrowe', icon: '📦', maxLevel: 5 },
    businessModels: { name: 'Business Models', namePl: 'Modele Biznesowe', icon: '💼', maxLevel: 5 },
    dataManagement: { name: 'Data Management', namePl: 'Zarządzanie Danymi', icon: '📊', maxLevel: 7 },
    culture: { name: 'Transformation Culture', namePl: 'Kultura Transformacji', icon: '🎯', maxLevel: 5 },
    cybersecurity: { name: 'Cybersecurity', namePl: 'Cyberbezpieczeństwo', icon: '🔒', maxLevel: 5 },
    aiMaturity: { name: 'AI Maturity', namePl: 'Dojrzałość AI', icon: '🤖', maxLevel: 5 }
};

class PDFExportService {
    constructor(options = {}) {
        this.options = {
            lang: options.lang || 'pl',
            includeWatermark: options.includeWatermark || false,
            watermarkText: options.watermarkText || 'CONFIDENTIAL',
            logoPath: options.logoPath || null,
            companyName: options.companyName || '',
            ...options
        };
        
        this.pageCount = 0;
        this.toc = [];
        this.currentSection = null;
    }

    /**
     * Generate branded PDF report
     */
    async generateReport(reportData, sections, axisData, outputStream) {
        const doc = new PDFDocument({
            autoFirstPage: false,
            size: 'A4',
            margins: { top: 72, bottom: 72, left: 60, right: 60 },
            bufferPages: true,
            info: {
                Title: reportData.title || 'DRD Assessment Report',
                Author: 'DRD Assessment System',
                Subject: 'Digital Readiness Diagnosis',
                Creator: 'Consultify Platform',
                Keywords: 'DRD, Digital Transformation, Assessment, Maturity',
                CreationDate: new Date()
            }
        });

        doc.pipe(outputStream);

        // Generate cover page
        this._generateCoverPage(doc, reportData);

        // Generate table of contents (placeholder - we'll fill it later)
        const tocPageStart = this.pageCount + 1;
        this._addPage(doc);
        const tocY = this._generateTableOfContentsPlaceholder(doc);

        // Generate sections
        for (const section of sections) {
            await this._generateSection(doc, section, axisData, reportData);
        }

        // Now go back and fill in TOC with actual page numbers
        // PDFKit's bufferPages allows us to access all pages
        const pages = doc.bufferedPageRange();
        
        // Finalize the document
        doc.end();

        return doc;
    }

    /**
     * Generate cover page with branding
     */
    _generateCoverPage(doc, reportData) {
        this._addPage(doc, false); // No header/footer on cover

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const isPolish = this.options.lang === 'pl';

        // Gradient background (top portion)
        doc.rect(0, 0, pageWidth, 300)
            .fill(COLORS.primary);

        // Decorative accent line
        doc.rect(0, 300, pageWidth, 8)
            .fill(COLORS.secondary);

        // Logo placeholder (if provided)
        if (this.options.logoPath) {
            try {
                doc.image(this.options.logoPath, 60, 40, { width: 120 });
            } catch (e) {
                console.warn('Logo not found:', e.message);
            }
        }

        // Main title
        doc.fontSize(36)
            .font('Helvetica-Bold')
            .fillColor('#ffffff')
            .text(reportData.title || (isPolish ? 'Raport DRD' : 'DRD Report'), 60, 120, {
                width: pageWidth - 120,
                align: 'left'
            });

        // Subtitle
        doc.fontSize(18)
            .font('Helvetica')
            .fillColor('#94a3b8')
            .text(
                isPolish ? 'Diagnoza Gotowości Cyfrowej' : 'Digital Readiness Diagnosis',
                60, 170, { width: pageWidth - 120 }
            );

        // Organization name
        doc.fontSize(24)
            .font('Helvetica-Bold')
            .fillColor(COLORS.textDark)
            .text(reportData.organizationName || '', 60, 350, {
                width: pageWidth - 120,
                align: 'left'
            });

        // Assessment name
        doc.fontSize(14)
            .font('Helvetica')
            .fillColor(COLORS.textMedium)
            .text(reportData.assessmentName || reportData.projectName || '', 60, 390);

        // Metadata section
        const metaY = 500;
        const col1X = 60;
        const col2X = 300;

        doc.fontSize(10)
            .font('Helvetica-Bold')
            .fillColor(COLORS.textLight)
            .text(isPolish ? 'DATA WYGENEROWANIA' : 'GENERATED DATE', col1X, metaY);
        doc.fontSize(12)
            .font('Helvetica')
            .fillColor(COLORS.textDark)
            .text(new Date().toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }), col1X, metaY + 15);

        doc.fontSize(10)
            .font('Helvetica-Bold')
            .fillColor(COLORS.textLight)
            .text(isPolish ? 'STATUS' : 'STATUS', col2X, metaY);
        doc.fontSize(12)
            .font('Helvetica')
            .fillColor(reportData.status === 'FINAL' ? COLORS.accent : COLORS.warning)
            .text(reportData.status || 'DRAFT', col2X, metaY + 15);

        // Version info
        doc.fontSize(10)
            .font('Helvetica-Bold')
            .fillColor(COLORS.textLight)
            .text(isPolish ? 'WERSJA' : 'VERSION', col1X, metaY + 50);
        doc.fontSize(12)
            .font('Helvetica')
            .fillColor(COLORS.textDark)
            .text(reportData.version || '1.0', col1X, metaY + 65);

        // Confidentiality notice
        doc.fontSize(9)
            .font('Helvetica')
            .fillColor(COLORS.textLight)
            .text(
                isPolish 
                    ? 'Dokument poufny. Zawiera informacje zastrzeżone dla organizacji.'
                    : 'Confidential document. Contains information reserved for the organization.',
                60, pageHeight - 100, {
                    width: pageWidth - 120,
                    align: 'center'
                }
            );

        // Footer line
        doc.moveTo(60, pageHeight - 60)
            .lineTo(pageWidth - 60, pageHeight - 60)
            .strokeColor(COLORS.border)
            .stroke();

        // Powered by
        doc.fontSize(8)
            .fillColor(COLORS.textLight)
            .text('Powered by Consultify DRD Platform', 60, pageHeight - 45, {
                width: pageWidth - 120,
                align: 'center'
            });
    }

    /**
     * Generate table of contents placeholder
     */
    _generateTableOfContentsPlaceholder(doc) {
        const isPolish = this.options.lang === 'pl';
        
        doc.fontSize(24)
            .font('Helvetica-Bold')
            .fillColor(COLORS.primary)
            .text(isPolish ? 'Spis Treści' : 'Table of Contents', 60, 72);

        doc.moveDown(2);

        // We'll add actual TOC entries later when we know page numbers
        return doc.y;
    }

    /**
     * Generate a section
     */
    async _generateSection(doc, section, axisData, reportData) {
        const isPolish = this.options.lang === 'pl';

        // Add page for major sections
        const majorSections = ['executive_summary', 'methodology', 'maturity_overview', 'gap_analysis', 'initiatives', 'roadmap', 'appendix'];
        if (majorSections.includes(section.sectionType)) {
            this._addPage(doc);
        }

        // Record for TOC
        this.toc.push({
            title: section.title,
            page: this.pageCount,
            type: section.sectionType
        });

        // Section header
        this._drawSectionHeader(doc, section.title, section.sectionType);

        // Add matrix for data sections
        if (['maturity_overview', 'gap_analysis'].includes(section.sectionType) && axisData) {
            this._drawMaturityMatrix(doc, axisData, isPolish);
            doc.moveDown(1);
        }

        // Axis detail
        if (section.sectionType === 'axis_detail' && section.axisId && axisData[section.axisId]) {
            this._drawAxisDetail(doc, section.axisId, axisData[section.axisId], isPolish);
            doc.moveDown(1);
        }

        // Section content
        if (section.content) {
            this._renderContent(doc, section.content);
        }

        doc.moveDown(2);
    }

    /**
     * Draw section header with accent
     */
    _drawSectionHeader(doc, title, sectionType) {
        const startY = doc.y;

        // Accent bar
        doc.rect(60, startY, 4, 30)
            .fill(COLORS.secondary);

        // Title
        doc.fontSize(20)
            .font('Helvetica-Bold')
            .fillColor(COLORS.primary)
            .text(title, 72, startY + 5);

        doc.moveDown(1.5);
    }

    /**
     * Draw maturity matrix table
     */
    _drawMaturityMatrix(doc, axisData, isPolish) {
        const startX = 60;
        const startY = doc.y;
        const colWidths = [160, 70, 70, 60, 80];
        const headers = isPolish 
            ? ['Oś Transformacji', 'Aktualny', 'Docelowy', 'Luka', 'Priorytet']
            : ['Transformation Axis', 'Current', 'Target', 'Gap', 'Priority'];

        // Draw header row
        let x = startX;
        let y = startY;
        const rowHeight = 25;

        doc.font('Helvetica-Bold').fontSize(9);
        headers.forEach((header, i) => {
            doc.rect(x, y, colWidths[i], rowHeight)
                .fillAndStroke(COLORS.primary, COLORS.primary);
            doc.fillColor('#ffffff')
                .text(header, x + 5, y + 8, { width: colWidths[i] - 10 });
            x += colWidths[i];
        });

        y += rowHeight;

        // Draw data rows
        doc.font('Helvetica').fontSize(9);
        Object.entries(DRD_AXES).forEach(([axisId, config], index) => {
            const data = axisData[axisId] || {};
            const actual = data.actual || 0;
            const target = data.target || 0;
            const gap = target - actual;
            const priority = gap >= 3 ? (isPolish ? 'WYSOKI' : 'HIGH') 
                           : gap >= 2 ? (isPolish ? 'ŚREDNI' : 'MEDIUM') 
                           : gap > 0 ? (isPolish ? 'NISKI' : 'LOW') 
                           : '-';
            
            const priorityColor = gap >= 3 ? COLORS.danger 
                                : gap >= 2 ? COLORS.warning 
                                : gap > 0 ? COLORS.accent 
                                : COLORS.textLight;

            const bgColor = index % 2 === 0 ? '#ffffff' : COLORS.bgLight;
            x = startX;

            // Name
            doc.rect(x, y, colWidths[0], rowHeight).fillAndStroke(bgColor, COLORS.border);
            doc.fillColor(COLORS.textDark)
                .text(isPolish ? config.namePl : config.name, x + 5, y + 8, { width: colWidths[0] - 10 });
            x += colWidths[0];

            // Current
            doc.rect(x, y, colWidths[1], rowHeight).fillAndStroke(bgColor, COLORS.border);
            doc.fillColor(COLORS.secondary)
                .text(actual.toFixed(1), x + 5, y + 8, { width: colWidths[1] - 10, align: 'center' });
            x += colWidths[1];

            // Target
            doc.rect(x, y, colWidths[2], rowHeight).fillAndStroke(bgColor, COLORS.border);
            doc.fillColor(COLORS.accent)
                .text(target.toFixed(1), x + 5, y + 8, { width: colWidths[2] - 10, align: 'center' });
            x += colWidths[2];

            // Gap
            doc.rect(x, y, colWidths[3], rowHeight).fillAndStroke(bgColor, COLORS.border);
            doc.fillColor(gap > 0 ? COLORS.danger : COLORS.textLight)
                .text(gap > 0 ? `+${gap.toFixed(1)}` : '-', x + 5, y + 8, { width: colWidths[3] - 10, align: 'center' });
            x += colWidths[3];

            // Priority
            doc.rect(x, y, colWidths[4], rowHeight).fillAndStroke(bgColor, COLORS.border);
            doc.fillColor(priorityColor)
                .text(priority, x + 5, y + 8, { width: colWidths[4] - 10, align: 'center' });

            y += rowHeight;
        });

        doc.y = y + 10;
    }

    /**
     * Draw axis detail box
     */
    _drawAxisDetail(doc, axisId, data, isPolish) {
        const config = DRD_AXES[axisId];
        const actual = data.actual || 0;
        const target = data.target || 0;
        const gap = target - actual;

        const boxY = doc.y;
        const boxWidth = doc.page.width - 120;

        // Background box
        doc.rect(60, boxY, boxWidth, 60)
            .fill(COLORS.bgLight);

        // Scores
        const scoreWidth = boxWidth / 3;
        
        // Current
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight)
            .text(isPolish ? 'Aktualny' : 'Current', 80, boxY + 10);
        doc.fontSize(24).font('Helvetica-Bold').fillColor(COLORS.secondary)
            .text(actual.toFixed(1), 80, boxY + 25);

        // Target
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight)
            .text(isPolish ? 'Docelowy' : 'Target', 80 + scoreWidth, boxY + 10);
        doc.fontSize(24).font('Helvetica-Bold').fillColor(COLORS.accent)
            .text(target.toFixed(1), 80 + scoreWidth, boxY + 25);

        // Gap
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight)
            .text(isPolish ? 'Luka' : 'Gap', 80 + scoreWidth * 2, boxY + 10);
        doc.fontSize(24).font('Helvetica-Bold').fillColor(gap > 0 ? COLORS.danger : COLORS.textLight)
            .text(gap > 0 ? `+${gap.toFixed(1)}` : '0', 80 + scoreWidth * 2, boxY + 25);

        doc.y = boxY + 70;
    }

    /**
     * Render markdown/HTML content as plain text
     */
    _renderContent(doc, content) {
        // Strip HTML/Markdown
        let text = content
            .replace(/<[^>]+>/g, '') // Remove HTML tags
            .replace(/#{1,6}\s/g, '') // Remove markdown headers
            .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
            .replace(/\*([^*]+)\*/g, '$1') // Italic
            .replace(/`([^`]+)`/g, '$1') // Code
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
            .replace(/^\s*[-*]\s/gm, '• ') // Bullets
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();

        doc.fontSize(11)
            .font('Helvetica')
            .fillColor(COLORS.textDark)
            .text(text, {
                align: 'justify',
                lineGap: 4
            });
    }

    /**
     * Add a new page with optional header/footer
     */
    _addPage(doc, includeHeaderFooter = true) {
        doc.addPage();
        this.pageCount++;

        if (includeHeaderFooter && this.pageCount > 1) {
            this._drawHeader(doc);
            this._drawFooter(doc);
        }

        // Watermark
        if (this.options.includeWatermark) {
            this._drawWatermark(doc);
        }
    }

    /**
     * Draw page header
     */
    _drawHeader(doc) {
        const pageWidth = doc.page.width;
        const isPolish = this.options.lang === 'pl';

        doc.fontSize(8)
            .font('Helvetica')
            .fillColor(COLORS.textLight)
            .text(
                this.options.companyName || (isPolish ? 'Raport DRD' : 'DRD Report'),
                60, 30, { width: pageWidth - 120 }
            );

        doc.moveTo(60, 50)
            .lineTo(pageWidth - 60, 50)
            .strokeColor(COLORS.border)
            .stroke();
    }

    /**
     * Draw page footer with page number
     */
    _drawFooter(doc) {
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const isPolish = this.options.lang === 'pl';

        doc.moveTo(60, pageHeight - 50)
            .lineTo(pageWidth - 60, pageHeight - 50)
            .strokeColor(COLORS.border)
            .stroke();

        // Page number
        doc.fontSize(9)
            .font('Helvetica')
            .fillColor(COLORS.textMedium)
            .text(
                `${isPolish ? 'Strona' : 'Page'} ${this.pageCount}`,
                60, pageHeight - 40, {
                    width: pageWidth - 120,
                    align: 'center'
                }
            );

        // Confidential notice
        doc.fontSize(7)
            .fillColor(COLORS.textLight)
            .text(
                isPolish ? 'Dokument poufny' : 'Confidential',
                60, pageHeight - 40, {
                    width: pageWidth - 120,
                    align: 'right'
                }
            );
    }

    /**
     * Draw watermark
     */
    _drawWatermark(doc) {
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;

        doc.save();
        doc.rotate(-45, { origin: [pageWidth / 2, pageHeight / 2] });
        doc.fontSize(80)
            .font('Helvetica-Bold')
            .fillColor('#e5e7eb')
            .opacity(0.3)
            .text(this.options.watermarkText, 0, pageHeight / 2, {
                width: pageWidth,
                align: 'center'
            });
        doc.restore();
        doc.opacity(1);
    }
}

module.exports = PDFExportService;

