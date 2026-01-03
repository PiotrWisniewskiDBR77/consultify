/**
 * Assessment Report Service
 * Enterprise-grade PDF and Excel export for assessment reports
 * Generates professional consulting-quality outputs
 */

const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// DRD Axis Configuration
const DRD_AXES = {
    processes: { name: 'Digital Processes', color: '#3B82F6' },
    digitalProducts: { name: 'Digital Products & Services', color: '#6366F1' },
    businessModels: { name: 'Digital Business Models', color: '#8B5CF6' },
    dataManagement: { name: 'Data & Analytics', color: '#06B6D4' },
    culture: { name: 'Organizational Culture', color: '#F59E0B' },
    cybersecurity: { name: 'Cybersecurity & Risk', color: '#EF4444' },
    aiMaturity: { name: 'AI & Machine Learning', color: '#10B981' }
};

// Report Branding
const BRAND = {
    primaryColor: '#6366F1',
    secondaryColor: '#4F46E5',
    textColor: '#1F2937',
    lightGray: '#F3F4F6',
    darkGray: '#374151',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    dangerColor: '#EF4444'
};

class AssessmentReportService {
    constructor() {
        this.uploadsDir = path.join(__dirname, '../../uploads/reports');
        this._ensureUploadsDir();
    }

    _ensureUploadsDir() {
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
    }

    /**
     * Generate comprehensive PDF report
     */
    async generatePDFReport(assessmentId, options = {}) {
        const assessment = await this._getAssessmentData(assessmentId);
        if (!assessment) {
            throw new Error('Assessment not found');
        }

        const reportId = uuidv4();
        const fileName = `assessment_report_${reportId}.pdf`;
        const filePath = path.join(this.uploadsDir, fileName);

        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 60, bottom: 60, left: 50, right: 50 },
            info: {
                Title: `DRD Assessment Report - ${assessment.organizationName || 'Organization'}`,
                Author: 'Consultify',
                Subject: 'Digital Readiness Diagnosis Assessment',
                Creator: 'Consultify Enterprise Platform'
            }
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Generate report sections
        await this._addCoverPage(doc, assessment, options);
        await this._addExecutiveSummary(doc, assessment);
        await this._addMaturityOverview(doc, assessment);
        await this._addAxisDetails(doc, assessment);
        await this._addGapAnalysis(doc, assessment);
        await this._addRecommendations(doc, assessment);
        await this._addAppendix(doc, assessment);

        doc.end();

        return new Promise((resolve, reject) => {
            stream.on('finish', () => {
                resolve({
                    reportId,
                    fileName,
                    filePath,
                    fileUrl: `/uploads/reports/${fileName}`,
                    generatedAt: new Date().toISOString()
                });
            });
            stream.on('error', reject);
        });
    }

    /**
     * Generate Excel export with detailed data
     */
    async generateExcelReport(assessmentId, options = {}) {
        const assessment = await this._getAssessmentData(assessmentId);
        if (!assessment) {
            throw new Error('Assessment not found');
        }

        const reportId = uuidv4();
        const fileName = `assessment_data_${reportId}.xlsx`;
        const filePath = path.join(this.uploadsDir, fileName);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Consultify';
        workbook.created = new Date();

        // Summary Sheet
        await this._addSummarySheet(workbook, assessment);
        
        // Axis Details Sheet
        await this._addAxisSheet(workbook, assessment);
        
        // Gap Analysis Sheet
        await this._addGapSheet(workbook, assessment);
        
        // Recommendations Sheet
        await this._addRecommendationsSheet(workbook, assessment);

        // Raw Data Sheet (for further analysis)
        await this._addRawDataSheet(workbook, assessment);

        await workbook.xlsx.writeFile(filePath);

        return {
            reportId,
            fileName,
            filePath,
            fileUrl: `/uploads/reports/${fileName}`,
            generatedAt: new Date().toISOString()
        };
    }

    // ============================================
    // PDF Generation Methods
    // ============================================

    async _addCoverPage(doc, assessment, options) {
        // Background gradient effect (simulated with rectangles)
        doc.rect(0, 0, doc.page.width, 250)
           .fill(BRAND.primaryColor);

        // Logo placeholder
        doc.fontSize(28)
           .fillColor('white')
           .font('Helvetica-Bold')
           .text('CONSULTIFY', 50, 80, { align: 'left' });

        doc.fontSize(12)
           .font('Helvetica')
           .text('Enterprise Decision Platform', 50, 115, { align: 'left' });

        // Title
        doc.fontSize(32)
           .font('Helvetica-Bold')
           .text('Digital Readiness', 50, 300, { align: 'center' });
        doc.text('Assessment Report', { align: 'center' });

        // Organization
        doc.fontSize(18)
           .font('Helvetica')
           .fillColor(BRAND.darkGray)
           .text(assessment.organizationName || 'Organization', 50, 400, { align: 'center' });

        // Metadata
        const metadata = [
            `Report Date: ${new Date().toLocaleDateString()}`,
            `Assessment Version: ${assessment.version || '1.0'}`,
            `Project: ${assessment.projectName || 'Digital Transformation'}`,
            assessment.isApproved ? '✓ Approved' : 'Draft'
        ];

        doc.fontSize(11)
           .fillColor(BRAND.textColor);
        
        let y = 480;
        metadata.forEach(text => {
            doc.text(text, 50, y, { align: 'center' });
            y += 20;
        });

        // Footer
        doc.fontSize(9)
           .fillColor(BRAND.darkGray)
           .text('Confidential', 50, doc.page.height - 50, { align: 'center' });

        doc.addPage();
    }

    async _addExecutiveSummary(doc, assessment) {
        this._addSectionHeader(doc, 'Executive Summary');

        const axisScores = assessment.axisScores || {};
        const axes = Object.keys(DRD_AXES);
        
        // Calculate averages
        let totalActual = 0, totalTarget = 0, count = 0;
        axes.forEach(axis => {
            if (axisScores[axis]?.actual) {
                totalActual += axisScores[axis].actual;
                totalTarget += axisScores[axis].target || 7;
                count++;
            }
        });

        const avgActual = count > 0 ? (totalActual / count).toFixed(1) : 0;
        const avgTarget = count > 0 ? (totalTarget / count).toFixed(1) : 0;
        const overallGap = (avgTarget - avgActual).toFixed(1);

        // Key metrics boxes
        doc.fontSize(11)
           .fillColor(BRAND.textColor);

        const metricsY = doc.y + 20;
        
        // Metric 1: Overall Maturity
        this._addMetricBox(doc, 50, metricsY, 150, 80, 
            'Overall Maturity', `${avgActual} / 7.0`, BRAND.primaryColor);
        
        // Metric 2: Target Level
        this._addMetricBox(doc, 210, metricsY, 150, 80,
            'Target Level', `${avgTarget} / 7.0`, BRAND.secondaryColor);
        
        // Metric 3: Gap
        this._addMetricBox(doc, 370, metricsY, 150, 80,
            'Overall Gap', `${overallGap} levels`, 
            parseFloat(overallGap) > 2 ? BRAND.dangerColor : BRAND.successColor);

        doc.y = metricsY + 110;

        // Summary text
        doc.fontSize(11)
           .fillColor(BRAND.textColor);

        const summaryText = `This assessment evaluates the organization's digital maturity across seven key dimensions 
of the Digital Readiness Diagnosis (DRD) framework. The overall maturity score of ${avgActual} indicates 
${avgActual < 3 ? 'early stages of digital transformation' : avgActual < 5 ? 'progressing digital capabilities' : 'advanced digital maturity'}.

The identified gap of ${overallGap} levels between current and target state ${parseFloat(overallGap) > 2 ? 'represents a significant transformation journey' : 'suggests focused improvement initiatives'} will be required to achieve strategic objectives.`;

        doc.text(summaryText, 50, doc.y, {
            width: 495,
            align: 'justify',
            lineGap: 4
        });

        // Key Findings
        doc.y += 30;
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Key Findings', 50, doc.y);

        doc.y += 15;
        doc.fontSize(11)
           .font('Helvetica');

        // Find strongest and weakest
        let strongest = { axis: '', score: 0 };
        let weakest = { axis: '', score: 8 };

        axes.forEach(axis => {
            const score = axisScores[axis]?.actual || 0;
            if (score > strongest.score) {
                strongest = { axis, score };
            }
            if (score > 0 && score < weakest.score) {
                weakest = { axis, score };
            }
        });

        const findings = [
            `✓ Strongest area: ${DRD_AXES[strongest.axis]?.name || 'N/A'} (Level ${strongest.score})`,
            `⚠ Priority improvement: ${DRD_AXES[weakest.axis]?.name || 'N/A'} (Level ${weakest.score})`,
            `📊 ${count} of 7 axes assessed`,
            assessment.isApproved ? '✓ Assessment approved by stakeholders' : '○ Pending stakeholder approval'
        ];

        findings.forEach(finding => {
            doc.text(finding, 60, doc.y, { width: 485 });
            doc.y += 18;
        });

        doc.addPage();
    }

    async _addMaturityOverview(doc, assessment) {
        this._addSectionHeader(doc, 'Maturity Overview');

        const axisScores = assessment.axisScores || {};
        const axes = Object.keys(DRD_AXES);
        
        // Create simple bar chart visualization
        let y = doc.y + 30;
        const barWidth = 300;
        const barHeight = 25;
        const leftMargin = 180;

        axes.forEach(axis => {
            const config = DRD_AXES[axis];
            const score = axisScores[axis]?.actual || 0;
            const target = axisScores[axis]?.target || 0;

            // Axis label
            doc.fontSize(10)
               .fillColor(BRAND.textColor)
               .font('Helvetica')
               .text(config.name, 50, y + 5, { width: 125 });

            // Background bar
            doc.rect(leftMargin, y, barWidth, barHeight)
               .fill(BRAND.lightGray);

            // Actual score bar
            const actualWidth = (score / 7) * barWidth;
            doc.rect(leftMargin, y, actualWidth, barHeight)
               .fill(config.color);

            // Target indicator
            if (target > 0) {
                const targetX = leftMargin + (target / 7) * barWidth;
                doc.moveTo(targetX, y - 3)
                   .lineTo(targetX, y + barHeight + 3)
                   .strokeColor(BRAND.dangerColor)
                   .lineWidth(2)
                   .stroke();
            }

            // Score text
            doc.fontSize(10)
               .fillColor(BRAND.textColor)
               .text(`${score} / ${target || '-'}`, leftMargin + barWidth + 10, y + 6);

            y += barHeight + 15;
        });

        // Legend
        doc.y = y + 20;
        doc.fontSize(9)
           .fillColor(BRAND.darkGray)
           .text('■ Current Level', 180, doc.y);
        doc.text('| Target Level', 280, doc.y);

        doc.addPage();
    }

    async _addAxisDetails(doc, assessment) {
        this._addSectionHeader(doc, 'Axis Details');

        const axisScores = assessment.axisScores || {};
        const axes = Object.keys(DRD_AXES);

        axes.forEach((axis, index) => {
            if (doc.y > 650) {
                doc.addPage();
            }

            const config = DRD_AXES[axis];
            const data = axisScores[axis] || {};

            // Axis header
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .fillColor(config.color)
               .text(`${index + 1}. ${config.name}`, 50, doc.y);

            doc.y += 5;

            // Scores
            doc.fontSize(10)
               .font('Helvetica')
               .fillColor(BRAND.textColor);

            const scoreRow = `Current Level: ${data.actual || '-'}  |  Target Level: ${data.target || '-'}  |  Gap: ${(data.target || 0) - (data.actual || 0)} levels`;
            doc.text(scoreRow, 60, doc.y);

            doc.y += 5;

            // Justification
            if (data.justification) {
                doc.fontSize(9)
                   .fillColor(BRAND.darkGray)
                   .text(`Justification: ${data.justification}`, 60, doc.y, { 
                       width: 475,
                       lineGap: 2
                   });
            }

            doc.y += 20;
        });

        doc.addPage();
    }

    async _addGapAnalysis(doc, assessment) {
        this._addSectionHeader(doc, 'Gap Analysis');

        const axisScores = assessment.axisScores || {};
        const gaps = [];

        Object.keys(DRD_AXES).forEach(axis => {
            const data = axisScores[axis] || {};
            const gap = (data.target || 0) - (data.actual || 0);
            if (gap > 0) {
                gaps.push({
                    axis,
                    name: DRD_AXES[axis].name,
                    current: data.actual || 0,
                    target: data.target || 0,
                    gap,
                    priority: gap >= 3 ? 'HIGH' : gap >= 2 ? 'MEDIUM' : 'LOW'
                });
            }
        });

        // Sort by gap size
        gaps.sort((a, b) => b.gap - a.gap);

        // Table header
        const colWidths = [180, 60, 60, 60, 70, 65];
        const tableX = 50;
        let tableY = doc.y + 20;

        const headers = ['Dimension', 'Current', 'Target', 'Gap', 'Priority', 'Effort'];
        
        doc.rect(tableX, tableY, 495, 25)
           .fill(BRAND.primaryColor);

        doc.fontSize(9)
           .fillColor('white')
           .font('Helvetica-Bold');

        let x = tableX + 5;
        headers.forEach((header, i) => {
            doc.text(header, x, tableY + 8);
            x += colWidths[i];
        });

        tableY += 25;

        // Table rows
        doc.font('Helvetica')
           .fillColor(BRAND.textColor);

        gaps.forEach((gap, rowIndex) => {
            const bgColor = rowIndex % 2 === 0 ? '#FFFFFF' : BRAND.lightGray;
            doc.rect(tableX, tableY, 495, 22).fill(bgColor);

            let x = tableX + 5;
            const cells = [
                gap.name,
                gap.current.toString(),
                gap.target.toString(),
                gap.gap.toString(),
                gap.priority,
                `${Math.ceil(gap.gap * 3)} months`
            ];

            cells.forEach((cell, i) => {
                if (i === 4) {
                    // Priority badge
                    const badgeColor = gap.priority === 'HIGH' ? BRAND.dangerColor :
                                      gap.priority === 'MEDIUM' ? BRAND.warningColor :
                                      BRAND.successColor;
                    doc.rect(x, tableY + 4, 45, 14).fill(badgeColor);
                    doc.fillColor('white')
                       .fontSize(8)
                       .text(cell, x + 2, tableY + 7);
                    doc.fillColor(BRAND.textColor).fontSize(9);
                } else {
                    doc.text(cell, x, tableY + 6, { width: colWidths[i] - 10 });
                }
                x += colWidths[i];
            });

            tableY += 22;
        });

        doc.y = tableY + 20;

        if (gaps.length === 0) {
            doc.fontSize(11)
               .text('No gaps identified. All axes meet or exceed target levels.', 50, doc.y);
        }

        doc.addPage();
    }

    async _addRecommendations(doc, assessment) {
        this._addSectionHeader(doc, 'Recommendations');

        doc.fontSize(11)
           .fillColor(BRAND.textColor)
           .font('Helvetica');

        const axisScores = assessment.axisScores || {};
        
        // Generate recommendations based on gaps
        const recommendations = [];
        
        Object.keys(DRD_AXES).forEach(axis => {
            const data = axisScores[axis] || {};
            const gap = (data.target || 0) - (data.actual || 0);
            
            if (gap >= 2) {
                recommendations.push({
                    priority: gap >= 3 ? 'Critical' : 'High',
                    title: `Strengthen ${DRD_AXES[axis].name}`,
                    description: `Current gap of ${gap} levels requires focused investment. Consider phased approach with interim milestones.`,
                    timeframe: `${Math.ceil(gap * 3)}-${Math.ceil(gap * 4)} months`
                });
            } else if (gap === 1) {
                recommendations.push({
                    priority: 'Medium',
                    title: `Enhance ${DRD_AXES[axis].name}`,
                    description: `Incremental improvement opportunity. Quick win potential.`,
                    timeframe: '2-4 months'
                });
            }
        });

        let y = doc.y + 10;

        recommendations.forEach((rec, index) => {
            if (y > 680) {
                doc.addPage();
                y = 80;
            }

            // Priority badge
            const badgeColor = rec.priority === 'Critical' ? BRAND.dangerColor :
                              rec.priority === 'High' ? BRAND.warningColor :
                              BRAND.primaryColor;
            
            doc.rect(50, y, 60, 16).fill(badgeColor);
            doc.fontSize(8)
               .fillColor('white')
               .font('Helvetica-Bold')
               .text(rec.priority.toUpperCase(), 55, y + 4);

            // Title
            doc.fontSize(11)
               .fillColor(BRAND.textColor)
               .font('Helvetica-Bold')
               .text(rec.title, 120, y);

            y += 18;

            // Description
            doc.fontSize(10)
               .font('Helvetica')
               .fillColor(BRAND.darkGray)
               .text(rec.description, 60, y, { width: 450 });

            y += 20;

            // Timeframe
            doc.fontSize(9)
               .text(`Estimated timeframe: ${rec.timeframe}`, 60, y);

            y += 25;
        });

        if (recommendations.length === 0) {
            doc.text('Assessment indicates strong maturity across all dimensions. Focus on continuous optimization and maintaining competitive advantage.', 50, doc.y, { width: 495 });
        }
    }

    async _addAppendix(doc, assessment) {
        doc.addPage();
        this._addSectionHeader(doc, 'Appendix');

        doc.fontSize(10)
           .fillColor(BRAND.textColor)
           .font('Helvetica');

        // Methodology
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('DRD Methodology', 50, doc.y);

        doc.y += 10;
        doc.fontSize(9)
           .font('Helvetica')
           .text(`The Digital Readiness Diagnosis (DRD) framework evaluates organizational maturity across 7 key dimensions, 
using a 7-level scale from Basic (1) to World-Class (7). Each level represents distinct capabilities and practices.`, 50, doc.y, { width: 495 });

        doc.y += 40;

        // Level descriptions
        const levels = [
            { level: 1, name: 'Basic', desc: 'Ad-hoc, manual processes' },
            { level: 2, name: 'Developing', desc: 'Initial digitization efforts' },
            { level: 3, name: 'Defined', desc: 'Standardized digital practices' },
            { level: 4, name: 'Managed', desc: 'Measured and controlled' },
            { level: 5, name: 'Optimizing', desc: 'Continuous improvement' },
            { level: 6, name: 'Advanced', desc: 'AI-augmented capabilities' },
            { level: 7, name: 'World-Class', desc: 'Industry-leading innovation' }
        ];

        levels.forEach(l => {
            doc.text(`Level ${l.level}: ${l.name} - ${l.desc}`, 60, doc.y);
            doc.y += 14;
        });

        // Footer
        doc.y = doc.page.height - 80;
        doc.fontSize(8)
           .fillColor(BRAND.darkGray)
           .text('Generated by Consultify Enterprise Platform', 50, doc.y, { align: 'center' });
        doc.text(`Report ID: ${assessment.id || 'N/A'}`, 50, doc.y + 12, { align: 'center' });
    }

    _addSectionHeader(doc, title) {
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor(BRAND.primaryColor)
           .text(title, 50, doc.y);

        doc.moveTo(50, doc.y + 5)
           .lineTo(545, doc.y + 5)
           .strokeColor(BRAND.primaryColor)
           .lineWidth(2)
           .stroke();

        doc.y += 15;
    }

    _addMetricBox(doc, x, y, width, height, label, value, color) {
        doc.rect(x, y, width, height)
           .fill(color);

        doc.fontSize(10)
           .fillColor('rgba(255,255,255,0.8)')
           .font('Helvetica')
           .text(label, x + 10, y + 12);

        doc.fontSize(22)
           .fillColor('white')
           .font('Helvetica-Bold')
           .text(value, x + 10, y + 35);
    }

    // ============================================
    // Excel Generation Methods
    // ============================================

    async _addSummarySheet(workbook, assessment) {
        const sheet = workbook.addWorksheet('Summary', {
            properties: { tabColor: { argb: '6366F1' } }
        });

        // Title
        sheet.mergeCells('A1:F1');
        sheet.getCell('A1').value = 'DRD Assessment Summary';
        sheet.getCell('A1').font = { size: 18, bold: true, color: { argb: '6366F1' } };

        sheet.getCell('A3').value = 'Organization:';
        sheet.getCell('B3').value = assessment.organizationName || 'N/A';
        sheet.getCell('A4').value = 'Report Date:';
        sheet.getCell('B4').value = new Date().toLocaleDateString();
        sheet.getCell('A5').value = 'Status:';
        sheet.getCell('B5').value = assessment.isApproved ? 'Approved' : 'Draft';

        // Overall metrics
        const axisScores = assessment.axisScores || {};
        let totalActual = 0, totalTarget = 0, count = 0;

        Object.keys(DRD_AXES).forEach(axis => {
            if (axisScores[axis]?.actual) {
                totalActual += axisScores[axis].actual;
                totalTarget += axisScores[axis].target || 7;
                count++;
            }
        });

        sheet.getCell('A7').value = 'Overall Maturity:';
        sheet.getCell('B7').value = count > 0 ? (totalActual / count).toFixed(1) : 0;
        sheet.getCell('A8').value = 'Target Maturity:';
        sheet.getCell('B8').value = count > 0 ? (totalTarget / count).toFixed(1) : 0;
        sheet.getCell('A9').value = 'Overall Gap:';
        sheet.getCell('B9').value = count > 0 ? ((totalTarget - totalActual) / count).toFixed(1) : 0;

        sheet.columns = [
            { width: 20 },
            { width: 30 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 40 }
        ];
    }

    async _addAxisSheet(workbook, assessment) {
        const sheet = workbook.addWorksheet('Axis Details');

        // Headers
        const headers = ['Axis', 'Current Level', 'Target Level', 'Gap', 'Priority', 'Justification'];
        sheet.addRow(headers);
        
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '6366F1' }
        };

        const axisScores = assessment.axisScores || {};

        Object.keys(DRD_AXES).forEach(axis => {
            const config = DRD_AXES[axis];
            const data = axisScores[axis] || {};
            const gap = (data.target || 0) - (data.actual || 0);

            sheet.addRow([
                config.name,
                data.actual || 0,
                data.target || 0,
                gap,
                gap >= 3 ? 'HIGH' : gap >= 2 ? 'MEDIUM' : gap > 0 ? 'LOW' : 'N/A',
                data.justification || ''
            ]);
        });

        sheet.columns = [
            { width: 30 },
            { width: 15 },
            { width: 15 },
            { width: 10 },
            { width: 12 },
            { width: 50 }
        ];
    }

    async _addGapSheet(workbook, assessment) {
        const sheet = workbook.addWorksheet('Gap Analysis');

        const headers = ['Axis', 'Current', 'Target', 'Gap', 'Gap %', 'Estimated Effort (months)', 'Priority'];
        sheet.addRow(headers);
        
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F59E0B' }
        };

        const axisScores = assessment.axisScores || {};

        Object.keys(DRD_AXES).forEach(axis => {
            const config = DRD_AXES[axis];
            const data = axisScores[axis] || {};
            const gap = (data.target || 0) - (data.actual || 0);
            const gapPercent = data.target ? ((gap / data.target) * 100).toFixed(0) + '%' : 'N/A';

            sheet.addRow([
                config.name,
                data.actual || 0,
                data.target || 0,
                gap,
                gapPercent,
                Math.ceil(gap * 3),
                gap >= 3 ? 'HIGH' : gap >= 2 ? 'MEDIUM' : gap > 0 ? 'LOW' : 'N/A'
            ]);
        });

        sheet.columns.forEach((col, i) => {
            col.width = [30, 12, 12, 10, 12, 25, 12][i] || 15;
        });
    }

    async _addRecommendationsSheet(workbook, assessment) {
        const sheet = workbook.addWorksheet('Recommendations');

        const headers = ['Priority', 'Area', 'Recommendation', 'Timeframe', 'Effort Level'];
        sheet.addRow(headers);

        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '10B981' }
        };

        const axisScores = assessment.axisScores || {};

        Object.keys(DRD_AXES).forEach(axis => {
            const config = DRD_AXES[axis];
            const data = axisScores[axis] || {};
            const gap = (data.target || 0) - (data.actual || 0);

            if (gap > 0) {
                sheet.addRow([
                    gap >= 3 ? 'Critical' : gap >= 2 ? 'High' : 'Medium',
                    config.name,
                    gap >= 2 ? 'Strategic investment required' : 'Incremental improvement',
                    `${Math.ceil(gap * 3)}-${Math.ceil(gap * 4)} months`,
                    gap >= 3 ? 'Major' : gap >= 2 ? 'Significant' : 'Moderate'
                ]);
            }
        });

        sheet.columns = [
            { width: 12 },
            { width: 30 },
            { width: 40 },
            { width: 18 },
            { width: 15 }
        ];
    }

    async _addRawDataSheet(workbook, assessment) {
        const sheet = workbook.addWorksheet('Raw Data');

        sheet.addRow(['Assessment ID', assessment.id || 'N/A']);
        sheet.addRow(['Organization', assessment.organizationName || 'N/A']);
        sheet.addRow(['Project', assessment.projectName || 'N/A']);
        sheet.addRow(['Version', assessment.version || '1']);
        sheet.addRow(['Is Approved', assessment.isApproved ? 'Yes' : 'No']);
        sheet.addRow(['Created At', assessment.createdAt || 'N/A']);
        sheet.addRow(['Updated At', assessment.updatedAt || 'N/A']);
        sheet.addRow([]);
        sheet.addRow(['Raw Axis Scores (JSON)']);
        sheet.addRow([JSON.stringify(assessment.axisScores, null, 2)]);

        sheet.columns = [
            { width: 25 },
            { width: 50 }
        ];
    }

    // ============================================
    // Data Fetching
    // ============================================

    async _getAssessmentData(assessmentId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    ma.*,
                    o.name as organizationName,
                    p.name as projectName
                FROM maturity_assessments ma
                LEFT JOIN organizations o ON ma.organization_id = o.id
                LEFT JOIN projects p ON ma.project_id = p.id
                WHERE ma.id = ?
            `;

            db.get(sql, [assessmentId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                resolve({
                    ...row,
                    axisScores: row.axis_scores ? JSON.parse(row.axis_scores) : {},
                    isApproved: row.is_approved === 1
                });
            });
        });
    }
}

module.exports = new AssessmentReportService();

