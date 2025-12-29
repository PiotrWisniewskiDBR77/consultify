/**
 * PowerPoint Generator Service
 * 
 * Generates PowerPoint presentations for Management Reports:
 * - Team Meeting Reports
 * - Steering Committee Reports
 * 
 * PMO Standards Compliance:
 * - ISO 21500:2021 - Project Performance Measurement
 * - PMBOK 7 - Measurement Performance Domain
 * - PRINCE2 - Highlight Report / Progress Theme
 */

const fs = require('fs').promises;
const path = require('path');

// Try to load pptxgenjs
let PptxGenJS;
try {
    PptxGenJS = require('pptxgenjs');
} catch (e) {
    console.warn('[PptxGenerator] pptxgenjs not installed. PowerPoint export will not be available.');
}

// Color palette matching brand
const COLORS = {
    PRIMARY: '7c3aed',       // Purple
    PRIMARY_DARK: '5b21b6',  // Dark purple
    SUCCESS: '10b981',       // Green
    WARNING: 'f59e0b',       // Amber
    DANGER: 'ef4444',        // Red
    GREY: '94a3b8',          // Slate gray
    TEXT_DARK: '1e293b',     // Navy
    TEXT_LIGHT: '64748b',    // Slate
    BACKGROUND: 'f8fafc',    // Light gray
    WHITE: 'ffffff'
};

const RAG_COLORS = {
    GREEN: COLORS.SUCCESS,
    AMBER: COLORS.WARNING,
    RED: COLORS.DANGER,
    GREY: COLORS.GREY
};

const PptxGeneratorService = {
    /**
     * Check if PPTX generation is available
     */
    isAvailable: () => !!PptxGenJS,

    /**
     * Generate PowerPoint for Management Reports
     * @param {Object} report - The management report object
     * @param {Object} options - Generation options
     * @returns {Promise<string>} - Path to generated PPTX file
     */
    generateManagementReportPPTX: async (report, options = {}) => {
        if (!PptxGenJS) {
            throw new Error('pptxgenjs is not installed. Run: npm install pptxgenjs');
        }

        const { branding = {} } = options;
        const primaryColor = branding.primaryColor?.replace('#', '') || COLORS.PRIMARY;

        // Create new presentation
        const pptx = new PptxGenJS();

        // Set presentation properties
        pptx.author = branding.companyName || 'Consultify';
        pptx.title = report.title;
        pptx.subject = report.reportType === 'TEAM_MEETING' ? 'Team Meeting Report' : 'Steering Committee Report';
        pptx.company = branding.companyName || 'Consultify';

        // Check if this is a draft report
        const isDraft = report.status !== 'FINAL';

        // Build master slide objects
        const masterObjects = [
            // Header line
            { rect: { x: 0, y: 0, w: '100%', h: 0.1, fill: { color: primaryColor } } },
            // Footer
            { text: { 
                text: `${branding.companyName || 'Consultify'} | PMO Standards: ISO 21500 | PMBOK 7 | PRINCE2`,
                options: { x: 0.5, y: 5.3, w: 9, h: 0.3, fontSize: 8, color: COLORS.TEXT_LIGHT }
            }},
            // Page number
            { text: {
                text: 'Slide ',
                options: { x: 9, y: 5.3, w: 0.5, h: 0.3, fontSize: 8, color: COLORS.TEXT_LIGHT }
            }}
        ];

        // Add DRAFT watermark if not finalized
        if (isDraft) {
            masterObjects.push(
                // Diagonal watermark
                { text: {
                    text: 'DRAFT',
                    options: {
                        x: 1.5,
                        y: 2,
                        w: 7,
                        h: 1.5,
                        fontSize: 72,
                        bold: true,
                        color: 'ef444420', // Red with 12% opacity
                        rotate: -35,
                        align: 'center',
                        valign: 'middle'
                    }
                }},
                // Top banner warning
                { rect: { x: 0, y: 0.1, w: '100%', h: 0.35, fill: { color: 'fef2f2' } } },
                { text: {
                    text: '⚠️ DRAFT - NOT FOR DISTRIBUTION - This report has not been finalized ⚠️',
                    options: { x: 0, y: 0.15, w: '100%', h: 0.25, fontSize: 10, bold: true, color: '991b1b', align: 'center' }
                }}
            );
        }

        // Define master slide
        pptx.defineSlideMaster({
            title: 'MASTER_SLIDE',
            background: { color: COLORS.WHITE },
            objects: masterObjects
        });

        // Generate slides based on report type
        if (report.reportType === 'TEAM_MEETING') {
            await generateTeamMeetingSlides(pptx, report, primaryColor);
        } else {
            await generateSteeringCommitteeSlides(pptx, report, primaryColor);
        }

        // Save file
        const uploadsDir = path.join(__dirname, '../../uploads/reports');
        await fs.mkdir(uploadsDir, { recursive: true });

        const filename = `management_report_${report.id}_${Date.now()}.pptx`;
        const filepath = path.join(uploadsDir, filename);

        await pptx.writeFile({ fileName: filepath });
        console.log(`[PptxGenerator] PowerPoint generated: ${filename}`);

        return `/uploads/reports/${filename}`;
    }
};

/**
 * Generate slides for Team Meeting Report
 */
async function generateTeamMeetingSlides(pptx, report, primaryColor) {
    const content = report.content || {};
    const summary = content.statusSummary || {};

    // Slide 1: Title
    const slide1 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    slide1.addText(report.title, {
        x: 0.5, y: 1.5, w: 9, h: 1,
        fontSize: 32, bold: true, color: COLORS.TEXT_DARK
    });
    slide1.addText(`Period: ${report.periodStart} - ${report.periodEnd}`, {
        x: 0.5, y: 2.5, w: 9, h: 0.5,
        fontSize: 16, color: COLORS.TEXT_LIGHT
    });
    slide1.addText(`Generated: ${new Date(report.createdAt).toLocaleDateString()}`, {
        x: 0.5, y: 3, w: 9, h: 0.5,
        fontSize: 14, color: COLORS.TEXT_LIGHT
    });

    // Slide 2: Status Overview
    const slide2 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    slide2.addText('📊 Status Overview', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, bold: true, color: COLORS.TEXT_DARK
    });

    // Metrics cards
    const metrics = [
        { label: 'Progress', value: `${summary.progressPercent || 0}%`, color: primaryColor },
        { label: 'Tasks Done', value: `${summary.tasksCompleted || 0}/${summary.tasksTotal || 0}`, color: COLORS.SUCCESS },
        { label: 'Blocked', value: String(summary.tasksBlocked || 0), color: summary.tasksBlocked > 0 ? COLORS.DANGER : COLORS.SUCCESS },
        { label: 'Pending Decisions', value: String(summary.decisionsPending || 0), color: summary.decisionsPending > 0 ? COLORS.WARNING : COLORS.SUCCESS }
    ];

    metrics.forEach((metric, i) => {
        const x = 0.5 + i * 2.4;
        slide2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x, y: 1.2, w: 2.2, h: 1.5,
            fill: { color: COLORS.BACKGROUND },
            line: { color: 'e2e8f0', width: 1 }
        });
        slide2.addText(metric.label, {
            x, y: 1.3, w: 2.2, h: 0.4,
            fontSize: 10, color: COLORS.TEXT_LIGHT, align: 'center'
        });
        slide2.addText(metric.value, {
            x, y: 1.7, w: 2.2, h: 0.8,
            fontSize: 28, bold: true, color: metric.color, align: 'center'
        });
    });

    // Health indicator
    const healthColor = RAG_COLORS[summary.healthStatus] || COLORS.SUCCESS;
    slide2.addShape(pptx.shapes.OVAL, {
        x: 4, y: 3, w: 2, h: 0.8,
        fill: { color: healthColor }
    });
    slide2.addText(summary.healthStatus || 'GREEN', {
        x: 4, y: 3.1, w: 2, h: 0.6,
        fontSize: 14, bold: true, color: COLORS.WHITE, align: 'center'
    });

    // Slide 3: Completed Work
    const slide3 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    slide3.addText('✅ Completed This Period', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, bold: true, color: COLORS.TEXT_DARK
    });

    const completedWork = (content.completedWork || []).slice(0, 12);
    if (completedWork.length > 0) {
        const tableData = [
            [{ text: 'Task', options: { bold: true, fill: { color: COLORS.BACKGROUND } } },
             { text: 'Completed By', options: { bold: true, fill: { color: COLORS.BACKGROUND } } }]
        ];
        completedWork.forEach(item => {
            tableData.push([
                { text: item.title || '', options: { fontSize: 10 } },
                { text: item.completedByName || 'Unknown', options: { fontSize: 10, color: COLORS.TEXT_LIGHT } }
            ]);
        });
        slide3.addTable(tableData, {
            x: 0.5, y: 1, w: 9, h: 4,
            colW: [6, 3],
            fontSize: 11,
            color: COLORS.TEXT_DARK,
            border: { type: 'solid', color: 'e2e8f0', pt: 0.5 }
        });
    } else {
        slide3.addText('No tasks completed in this period.', {
            x: 0.5, y: 2, w: 9, h: 1,
            fontSize: 14, color: COLORS.TEXT_LIGHT, italic: true
        });
    }

    // Slide 4: Blockers & Issues
    const blockers = content.blockers || [];
    if (blockers.length > 0) {
        const slide4 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
        slide4.addText('🚧 Blockers & Issues', {
            x: 0.5, y: 0.3, w: 9, h: 0.6,
            fontSize: 24, bold: true, color: COLORS.DANGER
        });

        blockers.slice(0, 6).forEach((blocker, i) => {
            const y = 1 + i * 0.7;
            slide4.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
                x: 0.5, y, w: 9, h: 0.6,
                fill: { color: 'fef2f2' },
                line: { color: COLORS.DANGER, width: 1, dashType: 'solid' }
            });
            slide4.addText(`${blocker.title}`, {
                x: 0.7, y: y + 0.05, w: 5, h: 0.3,
                fontSize: 11, bold: true, color: COLORS.TEXT_DARK
            });
            slide4.addText(`Owner: ${blocker.ownerName || 'Unknown'} | ${blocker.daysBlocked || 0} days blocked`, {
                x: 0.7, y: y + 0.3, w: 5, h: 0.25,
                fontSize: 9, color: COLORS.TEXT_LIGHT
            });
            slide4.addText(blocker.severity || 'MEDIUM', {
                x: 8, y: y + 0.15, w: 1.3, h: 0.3,
                fontSize: 9, bold: true, color: COLORS.DANGER, align: 'center'
            });
        });
    }

    // Slide 5: Pending Decisions
    const decisions = content.pendingDecisions || [];
    if (decisions.length > 0) {
        const slide5 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
        slide5.addText('❓ Pending Decisions', {
            x: 0.5, y: 0.3, w: 9, h: 0.6,
            fontSize: 24, bold: true, color: COLORS.WARNING
        });

        const decisionTable = [
            [{ text: 'Decision', options: { bold: true, fill: { color: COLORS.BACKGROUND } } },
             { text: 'Owner', options: { bold: true, fill: { color: COLORS.BACKGROUND } } },
             { text: 'Waiting', options: { bold: true, fill: { color: COLORS.BACKGROUND } } }]
        ];
        decisions.slice(0, 8).forEach(d => {
            decisionTable.push([
                { text: d.title || '', options: { fontSize: 10 } },
                { text: d.ownerName || 'Unknown', options: { fontSize: 10 } },
                { text: `${d.daysWaiting || 0} days`, options: { fontSize: 10, color: d.daysWaiting > 7 ? COLORS.DANGER : COLORS.TEXT_LIGHT } }
            ]);
        });
        slide5.addTable(decisionTable, {
            x: 0.5, y: 1, w: 9, h: 3.5,
            colW: [5.5, 2, 1.5],
            fontSize: 11,
            color: COLORS.TEXT_DARK,
            border: { type: 'solid', color: 'e2e8f0', pt: 0.5 }
        });
    }

    // Slide 6: Next Period Plan
    const slide6 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    slide6.addText('📅 Plan for Next Period', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, bold: true, color: COLORS.TEXT_DARK
    });

    const nextPlan = (content.nextPeriodPlan || []).slice(0, 10);
    if (nextPlan.length > 0) {
        const planTable = [
            [{ text: 'Task', options: { bold: true, fill: { color: COLORS.BACKGROUND } } },
             { text: 'Due Date', options: { bold: true, fill: { color: COLORS.BACKGROUND } } },
             { text: 'Assignee', options: { bold: true, fill: { color: COLORS.BACKGROUND } } }]
        ];
        nextPlan.forEach(item => {
            planTable.push([
                { text: item.title || '', options: { fontSize: 10 } },
                { text: item.plannedDate || 'TBD', options: { fontSize: 10 } },
                { text: item.assigneeName || 'Unassigned', options: { fontSize: 10, color: COLORS.TEXT_LIGHT } }
            ]);
        });
        slide6.addTable(planTable, {
            x: 0.5, y: 1, w: 9, h: 4,
            colW: [5, 2, 2],
            fontSize: 11,
            color: COLORS.TEXT_DARK,
            border: { type: 'solid', color: 'e2e8f0', pt: 0.5 }
        });
    } else {
        slide6.addText('No specific tasks planned for next period.', {
            x: 0.5, y: 2, w: 9, h: 1,
            fontSize: 14, color: COLORS.TEXT_LIGHT, italic: true
        });
    }
}

/**
 * Generate slides for Steering Committee Report
 */
async function generateSteeringCommitteeSlides(pptx, report, primaryColor) {
    const content = report.content || {};

    // Slide 1: Title + Executive Summary
    const slide1 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    slide1.addText(report.title, {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 28, bold: true, color: COLORS.TEXT_DARK
    });
    slide1.addText(`Period: ${report.periodStart} - ${report.periodEnd}`, {
        x: 0.5, y: 1.3, w: 9, h: 0.4,
        fontSize: 12, color: COLORS.TEXT_LIGHT
    });
    
    // Executive Summary box
    slide1.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.5, y: 1.9, w: 9, h: 2.5,
        fill: { color: COLORS.BACKGROUND },
        line: { color: primaryColor, width: 2 }
    });
    slide1.addText('Executive Summary', {
        x: 0.7, y: 2, w: 8.6, h: 0.4,
        fontSize: 14, bold: true, color: primaryColor
    });
    slide1.addText(content.executiveSummary || 'No summary available.', {
        x: 0.7, y: 2.4, w: 8.6, h: 1.8,
        fontSize: 11, color: COLORS.TEXT_DARK, valign: 'top'
    });

    // Slide 2: Overall RAG Status
    const slide2 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    slide2.addText('🚦 Overall Status', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, bold: true, color: COLORS.TEXT_DARK
    });

    const overallStatus = content.overallStatus || {};
    const statusCategories = ['schedule', 'budget', 'scope', 'risk'];

    statusCategories.forEach((cat, i) => {
        const status = overallStatus[cat] || {};
        const ragColor = RAG_COLORS[status.status] || COLORS.GREY;
        const x = 0.5 + i * 2.4;

        // Status card
        slide2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x, y: 1, w: 2.2, h: 2.2,
            fill: { color: COLORS.BACKGROUND },
            line: { color: ragColor, width: 3 }
        });

        // Category label
        slide2.addText(cat.toUpperCase(), {
            x, y: 1.1, w: 2.2, h: 0.4,
            fontSize: 12, bold: true, color: COLORS.TEXT_DARK, align: 'center'
        });

        // RAG indicator
        slide2.addShape(pptx.shapes.OVAL, {
            x: x + 0.6, y: 1.6, w: 1, h: 0.6,
            fill: { color: ragColor }
        });
        slide2.addText(status.status || 'N/A', {
            x: x + 0.6, y: 1.7, w: 1, h: 0.4,
            fontSize: 10, bold: true, color: COLORS.WHITE, align: 'center'
        });

        // Summary
        slide2.addText(status.summary || '', {
            x, y: 2.4, w: 2.2, h: 0.7,
            fontSize: 8, color: COLORS.TEXT_LIGHT, align: 'center', valign: 'top'
        });
    });

    // Overall health indicator
    const overallHealth = overallStatus.overallHealth || 'GREEN';
    slide2.addText('Overall Health:', {
        x: 3.5, y: 3.8, w: 1.5, h: 0.4,
        fontSize: 12, color: COLORS.TEXT_DARK
    });
    slide2.addShape(pptx.shapes.OVAL, {
        x: 5, y: 3.7, w: 1.5, h: 0.5,
        fill: { color: RAG_COLORS[overallHealth] || COLORS.SUCCESS }
    });
    slide2.addText(overallHealth, {
        x: 5, y: 3.8, w: 1.5, h: 0.3,
        fontSize: 11, bold: true, color: COLORS.WHITE, align: 'center'
    });

    // Slide 3: KPIs
    const kpis = content.kpis || [];
    if (kpis.length > 0) {
        const slide3 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
        slide3.addText('📈 Key Performance Indicators', {
            x: 0.5, y: 0.3, w: 9, h: 0.6,
            fontSize: 24, bold: true, color: COLORS.TEXT_DARK
        });

        kpis.slice(0, 6).forEach((kpi, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const x = 0.5 + col * 3.1;
            const y = 1 + row * 1.8;

            slide3.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
                x, y, w: 2.9, h: 1.6,
                fill: { color: COLORS.BACKGROUND },
                line: { color: RAG_COLORS[kpi.status] || COLORS.GREY, width: 2 }
            });
            slide3.addText(kpi.name || '', {
                x, y: y + 0.1, w: 2.9, h: 0.4,
                fontSize: 10, color: COLORS.TEXT_LIGHT, align: 'center'
            });
            slide3.addText(`${kpi.currentValue}${kpi.unit || ''}`, {
                x, y: y + 0.5, w: 2.9, h: 0.6,
                fontSize: 24, bold: true, color: primaryColor, align: 'center'
            });
            slide3.addText(`Target: ${kpi.targetValue}${kpi.unit || ''}`, {
                x, y: y + 1.1, w: 2.9, h: 0.3,
                fontSize: 9, color: COLORS.TEXT_LIGHT, align: 'center'
            });
        });
    }

    // Slide 4: Risks & Issues
    const risks = content.risksAndIssues || [];
    if (risks.length > 0) {
        const slide4 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
        slide4.addText('⚠️ Risks & Issues', {
            x: 0.5, y: 0.3, w: 9, h: 0.6,
            fontSize: 24, bold: true, color: COLORS.TEXT_DARK
        });

        const riskTable = [
            [{ text: 'Type', options: { bold: true, fill: { color: COLORS.BACKGROUND } } },
             { text: 'Title', options: { bold: true, fill: { color: COLORS.BACKGROUND } } },
             { text: 'Severity', options: { bold: true, fill: { color: COLORS.BACKGROUND } } },
             { text: 'Owner', options: { bold: true, fill: { color: COLORS.BACKGROUND } } },
             { text: 'Days', options: { bold: true, fill: { color: COLORS.BACKGROUND } } }]
        ];

        risks.slice(0, 8).forEach(risk => {
            const sevColor = risk.severity === 'CRITICAL' ? COLORS.DANGER : 
                           risk.severity === 'HIGH' ? COLORS.WARNING : COLORS.TEXT_LIGHT;
            riskTable.push([
                { text: risk.type || 'RISK', options: { fontSize: 9 } },
                { text: risk.title || '', options: { fontSize: 9 } },
                { text: risk.severity || 'MEDIUM', options: { fontSize: 9, bold: true, color: sevColor } },
                { text: risk.ownerName || 'Unknown', options: { fontSize: 9 } },
                { text: String(risk.daysOpen || 0), options: { fontSize: 9 } }
            ]);
        });

        slide4.addTable(riskTable, {
            x: 0.5, y: 1, w: 9, h: 3.5,
            colW: [0.8, 4, 1.2, 1.8, 0.7],
            fontSize: 10,
            color: COLORS.TEXT_DARK,
            border: { type: 'solid', color: 'e2e8f0', pt: 0.5 }
        });
    }

    // Slide 5: Decisions Required
    const decisions = content.decisionsRequired || [];
    if (decisions.length > 0) {
        const slide5 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
        slide5.addText('❓ Decisions Required from Board', {
            x: 0.5, y: 0.3, w: 9, h: 0.6,
            fontSize: 24, bold: true, color: primaryColor
        });

        decisions.slice(0, 4).forEach((decision, i) => {
            const y = 1 + i * 1.1;
            const isOverdue = decision.daysUntilDeadline < 0;

            slide5.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
                x: 0.5, y, w: 9, h: 1,
                fill: { color: isOverdue ? 'fef2f2' : COLORS.BACKGROUND },
                line: { color: isOverdue ? COLORS.DANGER : primaryColor, width: 1 }
            });

            // Decision type badge
            slide5.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
                x: 0.7, y: y + 0.1, w: 1.2, h: 0.3,
                fill: { color: primaryColor }
            });
            slide5.addText(decision.decisionType || 'STRATEGIC', {
                x: 0.7, y: y + 0.13, w: 1.2, h: 0.24,
                fontSize: 8, bold: true, color: COLORS.WHITE, align: 'center'
            });

            // Title
            slide5.addText(decision.title || '', {
                x: 2, y: y + 0.1, w: 5, h: 0.35,
                fontSize: 11, bold: true, color: COLORS.TEXT_DARK
            });

            // Deadline
            slide5.addText(isOverdue ? 'OVERDUE' : `Due: ${decision.deadline || 'TBD'}`, {
                x: 7.2, y: y + 0.1, w: 2, h: 0.3,
                fontSize: 9, bold: isOverdue, color: isOverdue ? COLORS.DANGER : COLORS.TEXT_LIGHT, align: 'right'
            });

            // Requestor
            slide5.addText(`Requested by: ${decision.requestedByName || 'Unknown'}`, {
                x: 2, y: y + 0.5, w: 6, h: 0.3,
                fontSize: 9, color: COLORS.TEXT_LIGHT
            });
        });
    }

    // Slide 6: Warnings (AI Transparency)
    const warnings = content.warnings || [];
    if (warnings.length > 0) {
        const slide6 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
        slide6.addText('🔴 Attention Required', {
            x: 0.5, y: 0.3, w: 9, h: 0.6,
            fontSize: 24, bold: true, color: COLORS.DANGER
        });

        slide6.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: 0.5, y: 1, w: 9, h: 3,
            fill: { color: 'fef2f2' },
            line: { color: COLORS.DANGER, width: 2 }
        });

        warnings.forEach((warning, i) => {
            slide6.addText(`• ${warning}`, {
                x: 0.8, y: 1.2 + i * 0.5, w: 8.4, h: 0.4,
                fontSize: 12, color: COLORS.TEXT_DARK
            });
        });

        slide6.addText('AI Transparency: These warnings are automatically generated. AI never hides bad news.', {
            x: 0.5, y: 4.2, w: 9, h: 0.4,
            fontSize: 9, italic: true, color: COLORS.TEXT_LIGHT
        });
    }

    // Slide 7: Forecast & Milestones
    const slide7 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    slide7.addText('🔮 Forecast & Next Milestones', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, bold: true, color: COLORS.TEXT_DARK
    });

    const forecast = content.forecast || {};
    slide7.addText(forecast.forecastNarrative || 'No forecast available.', {
        x: 0.5, y: 1, w: 9, h: 0.8,
        fontSize: 12, color: COLORS.TEXT_DARK
    });

    const milestones = forecast.nextMilestones || [];
    if (milestones.length > 0) {
        slide7.addText('Upcoming Milestones:', {
            x: 0.5, y: 1.9, w: 9, h: 0.4,
            fontSize: 14, bold: true, color: COLORS.TEXT_DARK
        });

        milestones.slice(0, 5).forEach((milestone, i) => {
            const y = 2.4 + i * 0.5;
            const statusColor = RAG_COLORS[milestone.status] || COLORS.SUCCESS;

            slide7.addShape(pptx.shapes.OVAL, {
                x: 0.5, y: y + 0.05, w: 0.25, h: 0.25,
                fill: { color: statusColor }
            });
            slide7.addText(milestone.name || '', {
                x: 0.9, y, w: 5, h: 0.35,
                fontSize: 11, color: COLORS.TEXT_DARK
            });
            slide7.addText(milestone.plannedDate || 'TBD', {
                x: 6, y, w: 3, h: 0.35,
                fontSize: 11, color: COLORS.TEXT_LIGHT
            });
        });
    }
}

module.exports = PptxGeneratorService;

