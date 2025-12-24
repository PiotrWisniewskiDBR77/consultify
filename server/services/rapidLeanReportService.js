/**
 * RapidLean Report Generation Service
 * Automatically generates comprehensive reports after assessment completion
 * Following DBR77 format and DRD principles
 */

const RapidLeanService = require('./rapidLeanService');
const RapidLeanObservationMapper = require('./rapidLeanObservationMapper');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const path = require('path');
const fs = require('fs');

class RapidLeanReportService {
    /**
     * Generate comprehensive report after assessment completion
     * @param {string} assessmentId - Assessment ID
     * @param {string} organizationId - Organization ID
     * @param {Object} options - Report options
     * @returns {Promise<Object>} Report data with file URL
     */
    static async generateReport(assessmentId, organizationId, options = {}) {
        const {
            format = 'pdf', // pdf, excel, powerpoint
            template = 'detailed', // executive, detailed, comparison
            includeCharts = true,
            includeRecommendations = true,
            compareWithPrevious = true
        } = options;

        try {
            // Fetch assessment data
            const assessment = await RapidLeanService.getAssessment(assessmentId, organizationId);

            // Get observations if available
            const observations = await RapidLeanService.getObservations(assessmentId);

            // Get DRD mapping
            const drdMapping = await RapidLeanService.mapToDRD(assessment, observations);

            // Get previous assessments for comparison
            const previousAssessments = compareWithPrevious
                ? await this.getPreviousAssessments(organizationId, assessment.project_id, assessmentId)
                : [];

            // Get project context for AI recommendations
            const projectContext = await RapidLeanService.getProjectContext(organizationId);

            // Generate report data structure
            const reportData = {
                id: uuidv4(),
                assessmentId,
                organizationId,
                generatedAt: new Date().toISOString(),
                template,
                format,

                // Executive Summary
                summary: {
                    overallScore: assessment.overall_score,
                    benchmark: assessment.industry_benchmark,
                    gap: assessment.industry_benchmark - assessment.overall_score,
                    topGaps: assessment.top_gaps,
                    keyFindings: RapidLeanObservationMapper.extractKeyFindings(observations[0] || {}),
                    drdMaturity: drdMapping
                },

                // Dimension Breakdown
                dimensions: [
                    {
                        name: 'Value Stream Efficiency',
                        score: assessment.value_stream_score,
                        benchmark: assessment.industry_benchmark,
                        status: this.getStatus(assessment.value_stream_score, assessment.industry_benchmark)
                    },
                    {
                        name: 'Waste Elimination',
                        score: assessment.waste_elimination_score,
                        benchmark: assessment.industry_benchmark,
                        status: this.getStatus(assessment.waste_elimination_score, assessment.industry_benchmark)
                    },
                    {
                        name: 'Flow & Pull Systems',
                        score: assessment.flow_pull_score,
                        benchmark: assessment.industry_benchmark,
                        status: this.getStatus(assessment.flow_pull_score, assessment.industry_benchmark)
                    },
                    {
                        name: 'Quality at Source',
                        score: assessment.quality_source_score,
                        benchmark: assessment.industry_benchmark,
                        status: this.getStatus(assessment.quality_source_score, assessment.industry_benchmark)
                    },
                    {
                        name: 'Continuous Improvement',
                        score: assessment.continuous_improvement_score,
                        benchmark: assessment.industry_benchmark,
                        status: this.getStatus(assessment.continuous_improvement_score, assessment.industry_benchmark)
                    },
                    {
                        name: 'Visual Management',
                        score: assessment.visual_management_score,
                        benchmark: assessment.industry_benchmark,
                        status: this.getStatus(assessment.visual_management_score, assessment.industry_benchmark)
                    }
                ],

                // Observation Details
                observations: observations.map(obs => ({
                    template: obs.templateId,
                    location: obs.location,
                    timestamp: obs.timestamp,
                    keyFindings: RapidLeanObservationMapper.extractKeyFindings(obs),
                    photos: obs.photos
                })),

                // DRD Mapping & Gaps
                drdMapping: {
                    scores: drdMapping,
                    gaps: RapidLeanService.calculateDRDGaps(drdMapping, projectContext.targetLevels),
                    pathways: RapidLeanService.generatePathways(drdMapping, projectContext.targetLevels)
                },

                // Trends (if previous assessments exist)
                trends: previousAssessments.length > 0
                    ? this.calculateTrends(assessment, previousAssessments)
                    : null,

                // Recommendations
                recommendations: includeRecommendations
                    ? await RapidLeanService.generateDRDRecommendations(assessment, drdMapping, projectContext)
                    : [],

                // Charts data (for PDF/Excel generation)
                charts: includeCharts ? this.prepareChartsData(assessment, previousAssessments) : null
            };

            // Generate file based on format
            let fileUrl;
            switch (format) {
                case 'pdf':
                    fileUrl = await this.generatePDF(reportData, organizationId);
                    break;
                case 'excel':
                    fileUrl = await this.generateExcel(reportData, organizationId);
                    break;
                case 'powerpoint':
                    fileUrl = await this.generatePowerPoint(reportData, organizationId);
                    break;
                default:
                    throw new Error(`Unsupported format: ${format}`);
            }

            // Save report metadata to database
            await this.saveReportMetadata(reportData, fileUrl, organizationId);

            return {
                reportId: reportData.id,
                fileUrl,
                reportData
            };
        } catch (error) {
            console.error('[RapidLeanReportService] Error generating report:', error);
            throw error;
        }
    }

    /**
     * Get status based on score vs benchmark
     * @param {number} score - Dimension score
     * @param {number} benchmark - Industry benchmark
     * @returns {string} Status
     */
    static getStatus(score, benchmark) {
        if (score >= benchmark) return 'excellent';
        if (score >= benchmark - 0.5) return 'good';
        if (score >= benchmark - 1.0) return 'needs_improvement';
        return 'critical';
    }

    /**
     * Calculate trends from previous assessments
     * @param {Object} current - Current assessment
     * @param {Array} previous - Previous assessments
     * @returns {Object} Trend data
     */
    static calculateTrends(current, previous) {
        if (!previous || previous.length === 0) return null;

        const latest = previous[0];
        return {
            overallTrend: current.overall_score - latest.overall_score,
            dimensionTrends: {
                value_stream: current.value_stream_score - (latest.value_stream_score || 0),
                waste_elimination: current.waste_elimination_score - (latest.waste_elimination_score || 0),
                flow_pull: current.flow_pull_score - (latest.flow_pull_score || 0),
                quality_source: current.quality_source_score - (latest.quality_source_score || 0),
                continuous_improvement: current.continuous_improvement_score - (latest.continuous_improvement_score || 0),
                visual_management: current.visual_management_score - (latest.visual_management_score || 0)
            },
            improvementRate: this.calculateImprovementRate(current, previous)
        };
    }

    /**
     * Calculate improvement rate
     * @param {Object} current - Current assessment
     * @param {Array} previous - Previous assessments
     * @returns {number} Improvement rate percentage
     */
    static calculateImprovementRate(current, previous) {
        if (!previous || previous.length === 0) return 0;

        const oldest = previous[previous.length - 1];
        const timeDiff = (new Date(current.created_at) - new Date(oldest.created_at)) / (1000 * 60 * 60 * 24); // days

        if (timeDiff === 0) return 0;

        const scoreDiff = current.overall_score - oldest.overall_score;
        return Math.round((scoreDiff / timeDiff) * 30 * 100) / 100; // Per month
    }

    /**
     * Prepare charts data for report
     * @param {Object} assessment - Current assessment
     * @param {Array} previous - Previous assessments
     * @returns {Object} Charts data
     */
    static prepareChartsData(assessment, previous) {
        return {
            radarChart: {
                dimensions: ['Value Stream', 'Waste Elimination', 'Flow & Pull', 'Quality', 'CI Culture', 'Visual Mgmt'],
                currentScores: [
                    assessment.value_stream_score,
                    assessment.waste_elimination_score,
                    assessment.flow_pull_score,
                    assessment.quality_source_score,
                    assessment.continuous_improvement_score,
                    assessment.visual_management_score
                ],
                benchmark: Array(6).fill(assessment.industry_benchmark)
            },
            trendChart: previous.length > 0 ? {
                dates: previous.map(p => p.created_at || p.assessment_date).concat([assessment.created_at]),
                scores: previous.map(p => p.overall_score).concat([assessment.overall_score])
            } : null
        };
    }

    /**
     * Generate PDF report using pdfkit
     * @param {Object} reportData - Report data structure
     * @param {string} organizationId - Organization ID
     * @returns {Promise<string>} File URL
     */
    static async generatePDF(reportData, organizationId) {
        const PDFDocument = require('pdfkit');

        const fileName = `rapidlean_report_${reportData.assessmentId}_${Date.now()}.pdf`;
        const filePath = path.join('uploads', 'organizations', organizationId, 'rapidlean', 'reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margins: { top: 50, bottom: 50, left: 50, right: 50 },
                    info: {
                        Title: 'RapidLean Assessment Report',
                        Author: 'Consultify - DBR77',
                        Subject: 'Lean Maturity Assessment'
                    }
                });

                const writeStream = fs.createWriteStream(filePath);
                doc.pipe(writeStream);

                // === PAGE 1: TITLE PAGE ===
                doc.fontSize(28)
                    .fillColor('#1a365d')
                    .text('RapidLean', { align: 'center' });
                doc.fontSize(18)
                    .fillColor('#4a5568')
                    .text('Lean Maturity Assessment Report', { align: 'center' });
                doc.moveDown(2);

                doc.fontSize(12)
                    .fillColor('#718096')
                    .text(`Generated: ${new Date(reportData.generatedAt).toLocaleDateString('pl-PL')}`, { align: 'center' });
                doc.text(`Report ID: ${reportData.id.substring(0, 8)}`, { align: 'center' });

                doc.moveDown(4);

                // Overall Score Display
                const score = reportData.summary?.overallScore || 0;
                const benchmark = reportData.summary?.benchmark || 3.3;

                doc.fontSize(48)
                    .fillColor(score >= benchmark ? '#38a169' : '#e53e3e')
                    .text(score.toFixed(1), { align: 'center' });
                doc.fontSize(14)
                    .fillColor('#718096')
                    .text('Overall Lean Maturity Score (1-5)', { align: 'center' });

                doc.moveDown(2);
                doc.fontSize(12)
                    .fillColor('#4a5568')
                    .text(`Industry Benchmark: ${benchmark.toFixed(1)}`, { align: 'center' });

                // === PAGE 2: EXECUTIVE SUMMARY ===
                doc.addPage();
                this.addSectionHeader(doc, '1. Executive Summary');

                // Score Summary Table
                doc.fontSize(11).fillColor('#2d3748');
                doc.text(`Overall Score: ${score.toFixed(1)} / 5.0`);
                doc.text(`Industry Benchmark: ${benchmark.toFixed(1)}`);
                doc.text(`Gap: ${(benchmark - score).toFixed(1)}`);
                doc.text(`Status: ${score >= benchmark ? 'Above Benchmark ✓' : 'Below Benchmark - Improvement Needed'}`);

                doc.moveDown();

                // Top Gaps
                if (reportData.summary?.topGaps?.length > 0) {
                    doc.fontSize(12).fillColor('#1a365d').text('Top Gaps to Address:');
                    doc.fontSize(10).fillColor('#e53e3e');
                    reportData.summary.topGaps.forEach((gap, i) => {
                        doc.text(`  ${i + 1}. ${this.formatDimensionName(gap)}`);
                    });
                }

                doc.moveDown();

                // Key Findings
                if (reportData.summary?.keyFindings?.length > 0) {
                    doc.fontSize(12).fillColor('#1a365d').text('Key Findings:');
                    doc.fontSize(10).fillColor('#4a5568');
                    reportData.summary.keyFindings.forEach((finding, i) => {
                        doc.text(`  • ${finding}`);
                    });
                }

                // === PAGE 3: DIMENSION BREAKDOWN ===
                doc.addPage();
                this.addSectionHeader(doc, '2. Lean Dimensions Breakdown');

                if (reportData.dimensions?.length > 0) {
                    reportData.dimensions.forEach((dim, index) => {
                        if (index > 0 && index % 3 === 0) {
                            doc.moveDown();
                        }

                        const statusColor = {
                            'excellent': '#38a169',
                            'good': '#3182ce',
                            'needs_improvement': '#d69e2e',
                            'critical': '#e53e3e'
                        }[dim.status] || '#4a5568';

                        doc.fontSize(11).fillColor('#1a365d').text(dim.name, { continued: true });
                        doc.fillColor(statusColor).text(`  ${dim.score?.toFixed(1) || 'N/A'} / 5.0`);

                        // Simple bar visualization
                        const barWidth = 200;
                        const barHeight = 8;
                        const x = doc.x;
                        const y = doc.y;

                        // Background bar
                        doc.rect(x, y, barWidth, barHeight).fill('#e2e8f0');
                        // Score bar
                        const scoreWidth = (dim.score / 5) * barWidth;
                        doc.rect(x, y, scoreWidth, barHeight).fill(statusColor);
                        // Benchmark line
                        const benchmarkX = (dim.benchmark / 5) * barWidth;
                        doc.moveTo(x + benchmarkX, y - 2).lineTo(x + benchmarkX, y + barHeight + 2).stroke('#1a365d');

                        doc.y = y + barHeight + 10;
                        doc.moveDown(0.5);
                    });
                }

                // === PAGE 4: DRD MAPPING ===
                doc.addPage();
                this.addSectionHeader(doc, '3. DRD Integration Mapping');

                doc.fontSize(10).fillColor('#4a5568');
                doc.text('RapidLean scores are mapped to the DRD (Digital Readiness Diagnostic) framework:', { align: 'left' });
                doc.text('• Lean dimensions → DRD Axis 1 (Digital Processes) and Axis 5 (Organizational Culture)', { align: 'left' });
                doc.text('• Scale conversion: Lean 1-5 → DRD 1-7', { align: 'left' });

                doc.moveDown();

                if (reportData.drdMapping?.scores) {
                    doc.fontSize(12).fillColor('#1a365d').text('DRD Maturity Scores:');
                    doc.moveDown(0.5);

                    Object.entries(reportData.drdMapping.scores).forEach(([axis, score]) => {
                        const numScore = typeof score === 'number' ? score : 0;
                        doc.fontSize(11).fillColor('#2d3748');
                        doc.text(`DRD ${axis === 'processes' ? 'Axis 1 (Processes)' : 'Axis 5 (Culture)'}: ${numScore.toFixed(1)} / 7.0`);
                    });
                }

                // === PAGE 5: RECOMMENDATIONS ===
                doc.addPage();
                this.addSectionHeader(doc, '4. Recommendations & Action Plan');

                if (reportData.recommendations?.length > 0) {
                    reportData.recommendations.forEach((rec, index) => {
                        const priorityColor = {
                            'HIGH': '#e53e3e',
                            'MEDIUM': '#d69e2e',
                            'LOW': '#38a169'
                        }[rec.priority] || '#4a5568';

                        doc.fontSize(11).fillColor('#1a365d').text(`${index + 1}. ${this.formatDimensionName(rec.dimension || rec.axis)}`);
                        doc.fontSize(9).fillColor(priorityColor).text(`   Priority: ${rec.priority}`);
                        doc.fontSize(10).fillColor('#4a5568').text(`   ${rec.recommendation}`);
                        if (rec.expectedImpact) {
                            doc.fontSize(9).fillColor('#38a169').text(`   Expected Impact: ${rec.expectedImpact}`);
                        }
                        doc.moveDown(0.5);
                    });
                } else {
                    doc.fontSize(10).fillColor('#4a5568').text('No specific recommendations at this time. Your organization is performing well.');
                }

                // === FOOTER ON ALL PAGES ===
                const range = doc.bufferedPageRange();
                for (let i = range.start; i < range.start + range.count; i++) {
                    doc.switchToPage(i);
                    doc.fontSize(8)
                        .fillColor('#a0aec0')
                        .text(
                            `RapidLean Assessment Report | Page ${i + 1} of ${range.count} | DBR77 Format | © ${new Date().getFullYear()} Consultify`,
                            50, doc.page.height - 40,
                            { align: 'center', width: doc.page.width - 100 }
                        );
                }

                doc.end();

                writeStream.on('finish', () => {
                    console.log(`[RapidLeanReportService] PDF generated: ${filePath}`);
                    resolve(`/uploads/organizations/${organizationId}/rapidlean/reports/${fileName}`);
                });

                writeStream.on('error', (err) => {
                    console.error('[RapidLeanReportService] PDF write error:', err);
                    reject(err);
                });

            } catch (error) {
                console.error('[RapidLeanReportService] PDF generation error:', error);
                reject(error);
            }
        });
    }

    /**
     * Add section header to PDF
     */
    static addSectionHeader(doc, title) {
        doc.fontSize(16)
            .fillColor('#1a365d')
            .text(title);
        doc.moveTo(doc.x, doc.y)
            .lineTo(doc.x + 200, doc.y)
            .stroke('#3182ce');
        doc.moveDown();
    }

    /**
     * Format dimension name for display
     */
    static formatDimensionName(name) {
        if (!name) return 'Unknown';
        return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    /**
     * Generate Excel report using exceljs
     * @param {Object} reportData - Report data structure
     * @param {string} organizationId - Organization ID
     * @returns {Promise<string>} File URL
     */
    static async generateExcel(reportData, organizationId) {
        const ExcelJS = require('exceljs');

        const fileName = `rapidlean_report_${reportData.assessmentId}_${Date.now()}.xlsx`;
        const filePath = path.join('uploads', 'organizations', organizationId, 'rapidlean', 'reports', fileName);

        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Consultify - DBR77';
            workbook.created = new Date();

            // === SHEET 1: SUMMARY ===
            const summarySheet = workbook.addWorksheet('Summary', {
                properties: { tabColor: { argb: '1a365d' } }
            });

            summarySheet.columns = [
                { header: 'Metric', key: 'metric', width: 30 },
                { header: 'Value', key: 'value', width: 20 },
                { header: 'Benchmark', key: 'benchmark', width: 15 },
                { header: 'Status', key: 'status', width: 20 }
            ];

            // Style header
            summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
            summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1a365d' } };

            const score = reportData.summary?.overallScore || 0;
            const benchmark = reportData.summary?.benchmark || 3.3;

            summarySheet.addRow({
                metric: 'Overall Lean Maturity Score',
                value: score.toFixed(2),
                benchmark: benchmark.toFixed(2),
                status: score >= benchmark ? 'Above Benchmark ✓' : 'Below Benchmark'
            });

            summarySheet.addRow({
                metric: 'Gap to Benchmark',
                value: (benchmark - score).toFixed(2),
                benchmark: '-',
                status: score >= benchmark ? 'On Track' : 'Improvement Needed'
            });

            summarySheet.addRow({
                metric: 'Report Generated',
                value: new Date(reportData.generatedAt).toLocaleDateString('pl-PL'),
                benchmark: '-',
                status: '-'
            });

            // === SHEET 2: DIMENSIONS ===
            const dimSheet = workbook.addWorksheet('Dimensions', {
                properties: { tabColor: { argb: '3182ce' } }
            });

            dimSheet.columns = [
                { header: 'Dimension', key: 'dimension', width: 30 },
                { header: 'Score', key: 'score', width: 12 },
                { header: 'Benchmark', key: 'benchmark', width: 12 },
                { header: 'Gap', key: 'gap', width: 12 },
                { header: 'Status', key: 'status', width: 20 }
            ];

            dimSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
            dimSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '3182ce' } };

            if (reportData.dimensions?.length > 0) {
                reportData.dimensions.forEach(dim => {
                    const dimScore = dim.score || 0;
                    const dimBenchmark = dim.benchmark || benchmark;
                    dimSheet.addRow({
                        dimension: dim.name,
                        score: dimScore.toFixed(2),
                        benchmark: dimBenchmark.toFixed(2),
                        gap: (dimBenchmark - dimScore).toFixed(2),
                        status: dim.status?.replace(/_/g, ' ').toUpperCase() || 'N/A'
                    });
                });
            }

            // === SHEET 3: DRD MAPPING ===
            const drdSheet = workbook.addWorksheet('DRD Mapping', {
                properties: { tabColor: { argb: '38a169' } }
            });

            drdSheet.columns = [
                { header: 'DRD Axis', key: 'axis', width: 30 },
                { header: 'Score (1-7)', key: 'score', width: 15 },
                { header: 'Target', key: 'target', width: 12 },
                { header: 'Gap', key: 'gap', width: 12 },
                { header: 'Priority', key: 'priority', width: 15 }
            ];

            drdSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
            drdSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '38a169' } };

            if (reportData.drdMapping?.scores) {
                Object.entries(reportData.drdMapping.scores).forEach(([axis, axisScore]) => {
                    const numScore = typeof axisScore === 'number' ? axisScore : 0;
                    const gaps = reportData.drdMapping?.gaps?.[axis] || {};
                    drdSheet.addRow({
                        axis: axis === 'processes' ? 'Axis 1 - Digital Processes' : 'Axis 5 - Organizational Culture',
                        score: numScore.toFixed(2),
                        target: (gaps.target || 7).toFixed(1),
                        gap: (gaps.gap || (7 - numScore)).toFixed(2),
                        priority: gaps.priority || 'MEDIUM'
                    });
                });
            }

            // === SHEET 4: RECOMMENDATIONS ===
            const recSheet = workbook.addWorksheet('Recommendations', {
                properties: { tabColor: { argb: 'e53e3e' } }
            });

            recSheet.columns = [
                { header: '#', key: 'num', width: 5 },
                { header: 'Area', key: 'area', width: 25 },
                { header: 'Priority', key: 'priority', width: 12 },
                { header: 'Recommendation', key: 'recommendation', width: 50 },
                { header: 'Expected Impact', key: 'impact', width: 30 }
            ];

            recSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
            recSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'e53e3e' } };

            if (reportData.recommendations?.length > 0) {
                reportData.recommendations.forEach((rec, i) => {
                    recSheet.addRow({
                        num: i + 1,
                        area: this.formatDimensionName(rec.dimension || rec.axis),
                        priority: rec.priority || 'MEDIUM',
                        recommendation: rec.recommendation || '',
                        impact: rec.expectedImpact || ''
                    });
                });
            }

            // Auto-fit columns
            [summarySheet, dimSheet, drdSheet, recSheet].forEach(sheet => {
                sheet.columns.forEach(column => {
                    column.alignment = { vertical: 'middle', wrapText: true };
                });
            });

            await workbook.xlsx.writeFile(filePath);
            console.log(`[RapidLeanReportService] Excel generated: ${filePath}`);

            return `/uploads/organizations/${organizationId}/rapidlean/reports/${fileName}`;
        } catch (error) {
            console.error('[RapidLeanReportService] Excel generation error:', error);
            throw error;
        }
    }

    /**
     * Generate PowerPoint report
     * @param {Object} reportData - Report data structure
     * @param {string} organizationId - Organization ID
     * @returns {Promise<string>} File URL
     */
    static async generatePowerPoint(reportData, organizationId) {
        // TODO: Implement PowerPoint generation
        const fileName = `rapidlean_report_${reportData.assessmentId}_${Date.now()}.pptx`;
        return `/uploads/organizations/${organizationId}/rapidlean/reports/${fileName}`;
    }

    /**
     * Get previous assessments for comparison
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @param {string} excludeId - Assessment ID to exclude
     * @returns {Promise<Array>} Previous assessments
     */
    static async getPreviousAssessments(organizationId, projectId, excludeId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM rapid_lean_assessments
                WHERE organization_id = ? AND project_id = ? AND id != ?
                ORDER BY created_at DESC
                LIMIT 5
            `;
            db.all(sql, [organizationId, projectId, excludeId], (err, rows) => {
                if (err) return reject(err);

                const parsed = (rows || []).map(row => ({
                    ...row,
                    ai_recommendations: JSON.parse(row.ai_recommendations || '[]'),
                    top_gaps: JSON.parse(row.top_gaps || '[]')
                }));

                resolve(parsed);
            });
        });
    }

    /**
     * Save report metadata to database
     * @param {Object} reportData - Report data
     * @param {string} fileUrl - File URL
     * @param {string} organizationId - Organization ID
     * @returns {Promise<void>}
     */
    static async saveReportMetadata(reportData, fileUrl, organizationId) {
        return new Promise(async (resolve, reject) => {
            try {
                // Get assessment to retrieve project_id
                const assessment = await RapidLeanService.getAssessment(reportData.assessmentId, organizationId);

                const sql = `
                    INSERT INTO rapid_lean_reports (
                        id, assessment_id, organization_id, project_id, report_type, format,
                        file_url, report_data, generated_by, generated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `;

                db.run(sql, [
                    reportData.id,
                    reportData.assessmentId,
                    organizationId,
                    assessment.project_id || null,
                    reportData.template,
                    reportData.format,
                    fileUrl,
                    JSON.stringify(reportData),
                    'system' // TODO: Get actual user ID from context
                ], (err) => {
                    if (err) return reject(err);

                    // Update assessment to mark report as generated
                    db.run(
                        'UPDATE rapid_lean_assessments SET report_generated = 1 WHERE id = ?',
                        [reportData.assessmentId],
                        (updateErr) => {
                            if (updateErr) console.error('[RapidLeanReportService] Error updating assessment:', updateErr);
                            resolve();
                        }
                    );
                });
            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = RapidLeanReportService;

