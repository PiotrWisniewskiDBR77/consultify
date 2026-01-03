/**
 * PPTXExportService
 * 
 * PowerPoint export for DRD Assessment Reports
 * Features:
 * - Title slide with branding
 * - Executive summary (1 slide)
 * - Key findings (2-3 slides with charts)
 * - Recommendations (1-2 slides)
 * - Next steps (1 slide)
 * - Appendix slides for data tables
 */

const PptxGenJS = require('pptxgenjs');

// DRD Brand Colors (hex without #)
const COLORS = {
    primary: '1e3a5f',       // Navy blue
    secondary: '3b82f6',     // Blue
    accent: '10b981',        // Green
    warning: 'f59e0b',       // Amber
    danger: 'ef4444',        // Red
    textDark: '1e293b',
    textMedium: '475569',
    textLight: '64748b',
    white: 'ffffff',
    bgLight: 'f8fafc'
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

class PPTXExportService {
    constructor(options = {}) {
        this.options = {
            lang: options.lang || 'pl',
            companyName: options.companyName || '',
            logoPath: options.logoPath || null,
            ...options
        };
    }

    /**
     * Generate PowerPoint presentation
     */
    async generatePresentation(reportData, sections, axisData) {
        const pptx = new PptxGenJS();
        const isPolish = this.options.lang === 'pl';

        // Set presentation properties
        pptx.author = 'DRD Assessment System';
        pptx.title = reportData.title || (isPolish ? 'Raport DRD' : 'DRD Report');
        pptx.subject = isPolish ? 'Diagnoza Gotowości Cyfrowej' : 'Digital Readiness Diagnosis';
        pptx.company = reportData.organizationName || '';

        // Define master slides
        this._defineMasterSlides(pptx);

        // 1. Title slide
        this._createTitleSlide(pptx, reportData, isPolish);

        // 2. Executive Summary
        const execSummary = sections.find(s => s.sectionType === 'executive_summary');
        if (execSummary) {
            this._createExecutiveSummarySlide(pptx, execSummary, axisData, isPolish);
        }

        // 3. Maturity Overview with chart
        if (axisData && Object.keys(axisData).length > 0) {
            this._createMaturityOverviewSlide(pptx, axisData, isPolish);
        }

        // 4. Gap Analysis slide
        const gapSection = sections.find(s => s.sectionType === 'gap_analysis');
        if (gapSection || axisData) {
            this._createGapAnalysisSlide(pptx, axisData, isPolish);
        }

        // 5. Key Recommendations
        const initiativesSection = sections.find(s => s.sectionType === 'initiatives');
        if (initiativesSection) {
            this._createRecommendationsSlide(pptx, initiativesSection, isPolish);
        }

        // 6. Roadmap
        const roadmapSection = sections.find(s => s.sectionType === 'roadmap');
        if (roadmapSection) {
            this._createRoadmapSlide(pptx, roadmapSection, isPolish);
        }

        // 7. Next Steps
        this._createNextStepsSlide(pptx, isPolish);

        // 8. Appendix - Detailed axis data
        this._createAppendixSlides(pptx, sections, axisData, isPolish);

        // 9. Thank you slide
        this._createThankYouSlide(pptx, reportData, isPolish);

        return pptx;
    }

    /**
     * Define master slides for consistent branding
     */
    _defineMasterSlides(pptx) {
        pptx.defineSlideMaster({
            title: 'DRD_MASTER',
            background: { color: COLORS.white },
            objects: [
                // Top accent bar
                { rect: { x: 0, y: 0, w: '100%', h: 0.1, fill: { color: COLORS.primary } } },
                // Bottom accent line
                { rect: { x: 0, y: 5.4, w: '100%', h: 0.02, fill: { color: COLORS.secondary } } },
                // Footer text
                { text: { 
                    text: 'DRD Assessment Report', 
                    options: { x: 0.5, y: 5.45, w: 4, h: 0.25, fontSize: 8, color: COLORS.textLight }
                }}
            ],
            slideNumber: { x: 9, y: 5.45, fontSize: 8, color: COLORS.textLight }
        });

        pptx.defineSlideMaster({
            title: 'DRD_TITLE',
            background: { color: COLORS.primary },
            objects: [
                // Accent bar
                { rect: { x: 0, y: 3.5, w: '100%', h: 0.1, fill: { color: COLORS.secondary } } }
            ]
        });
    }

    /**
     * Create title slide
     */
    _createTitleSlide(pptx, reportData, isPolish) {
        const slide = pptx.addSlide({ masterName: 'DRD_TITLE' });

        // Main title
        slide.addText(reportData.title || (isPolish ? 'Raport DRD' : 'DRD Report'), {
            x: 0.5,
            y: 1.5,
            w: 9,
            h: 1,
            fontSize: 44,
            fontFace: 'Arial',
            bold: true,
            color: COLORS.white
        });

        // Subtitle
        slide.addText(isPolish ? 'Diagnoza Gotowości Cyfrowej' : 'Digital Readiness Diagnosis', {
            x: 0.5,
            y: 2.5,
            w: 9,
            h: 0.5,
            fontSize: 24,
            fontFace: 'Arial',
            color: COLORS.textLight
        });

        // Organization name
        slide.addText(reportData.organizationName || '', {
            x: 0.5,
            y: 3.8,
            w: 9,
            h: 0.6,
            fontSize: 28,
            fontFace: 'Arial',
            bold: true,
            color: COLORS.white
        });

        // Date
        slide.addText(new Date().toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }), {
            x: 0.5,
            y: 4.5,
            w: 9,
            h: 0.4,
            fontSize: 14,
            fontFace: 'Arial',
            color: COLORS.textLight
        });
    }

    /**
     * Create executive summary slide
     */
    _createExecutiveSummarySlide(pptx, section, axisData, isPolish) {
        const slide = pptx.addSlide({ masterName: 'DRD_MASTER' });

        // Title
        slide.addText(isPolish ? 'Podsumowanie Wykonawcze' : 'Executive Summary', {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.6,
            fontSize: 28,
            fontFace: 'Arial',
            bold: true,
            color: COLORS.primary
        });

        // Calculate metrics
        let avgActual = 0, avgTarget = 0, totalGap = 0, count = 0;
        Object.values(axisData || {}).forEach(data => {
            if (data?.actual) {
                avgActual += data.actual;
                avgTarget += data.target || 0;
                totalGap += Math.max(0, (data.target || 0) - data.actual);
                count++;
            }
        });
        if (count > 0) {
            avgActual /= count;
            avgTarget /= count;
        }

        // Key metrics boxes
        const metricY = 1.1;
        const metrics = [
            { label: isPolish ? 'Aktualny poziom' : 'Current Level', value: avgActual.toFixed(1), color: COLORS.secondary },
            { label: isPolish ? 'Poziom docelowy' : 'Target Level', value: avgTarget.toFixed(1), color: COLORS.accent },
            { label: isPolish ? 'Całkowita luka' : 'Total Gap', value: totalGap.toFixed(0), color: COLORS.warning }
        ];

        metrics.forEach((metric, i) => {
            const x = 0.5 + i * 3.2;
            
            slide.addShape('rect', {
                x,
                y: metricY,
                w: 3,
                h: 1.2,
                fill: { color: COLORS.bgLight },
                line: { color: metric.color, width: 1 }
            });

            slide.addText(metric.value, {
                x,
                y: metricY + 0.15,
                w: 3,
                h: 0.6,
                fontSize: 36,
                fontFace: 'Arial',
                bold: true,
                color: metric.color,
                align: 'center'
            });

            slide.addText(metric.label, {
                x,
                y: metricY + 0.8,
                w: 3,
                h: 0.3,
                fontSize: 11,
                fontFace: 'Arial',
                color: COLORS.textMedium,
                align: 'center'
            });
        });

        // Content text (simplified)
        if (section.content) {
            const text = this._stripHtmlTags(section.content).substring(0, 800);
            slide.addText(text, {
                x: 0.5,
                y: 2.5,
                w: 9,
                h: 2.8,
                fontSize: 12,
                fontFace: 'Arial',
                color: COLORS.textDark,
                valign: 'top'
            });
        }
    }

    /**
     * Create maturity overview with bar chart
     */
    _createMaturityOverviewSlide(pptx, axisData, isPolish) {
        const slide = pptx.addSlide({ masterName: 'DRD_MASTER' });

        // Title
        slide.addText(isPolish ? 'Przegląd Dojrzałości Cyfrowej' : 'Digital Maturity Overview', {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.6,
            fontSize: 28,
            fontFace: 'Arial',
            bold: true,
            color: COLORS.primary
        });

        // Prepare chart data
        const labels = Object.entries(DRD_AXES).map(([id, config]) => 
            isPolish ? config.namePl : config.name
        );
        const actualData = Object.keys(DRD_AXES).map(id => axisData[id]?.actual || 0);
        const targetData = Object.keys(DRD_AXES).map(id => axisData[id]?.target || 0);

        // Add bar chart
        slide.addChart(pptx.ChartType.bar, [
            { name: isPolish ? 'Aktualny' : 'Current', labels, values: actualData },
            { name: isPolish ? 'Docelowy' : 'Target', labels, values: targetData }
        ], {
            x: 0.5,
            y: 1.1,
            w: 9,
            h: 4,
            chartColors: [COLORS.secondary, COLORS.accent],
            barDir: 'bar',
            barGrouping: 'clustered',
            catAxisTitle: '',
            valAxisTitle: isPolish ? 'Poziom' : 'Level',
            valAxisMaxVal: 7,
            showValue: true,
            dataLabelPosition: 'outEnd',
            dataLabelFontSize: 9,
            catAxisLabelFontSize: 10,
            legendPos: 't',
            legendFontSize: 10
        });
    }

    /**
     * Create gap analysis slide
     */
    _createGapAnalysisSlide(pptx, axisData, isPolish) {
        const slide = pptx.addSlide({ masterName: 'DRD_MASTER' });

        // Title
        slide.addText(isPolish ? 'Analiza Luk' : 'Gap Analysis', {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.6,
            fontSize: 28,
            fontFace: 'Arial',
            bold: true,
            color: COLORS.primary
        });

        // Create table data
        const tableData = [
            [
                { text: isPolish ? 'Oś' : 'Axis', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
                { text: isPolish ? 'Aktualny' : 'Current', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
                { text: isPolish ? 'Docelowy' : 'Target', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
                { text: isPolish ? 'Luka' : 'Gap', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
                { text: isPolish ? 'Priorytet' : 'Priority', options: { bold: true, fill: COLORS.primary, color: COLORS.white } }
            ]
        ];

        Object.entries(DRD_AXES).forEach(([id, config]) => {
            const data = axisData[id] || {};
            const actual = data.actual || 0;
            const target = data.target || 0;
            const gap = target - actual;
            const priority = gap >= 3 ? (isPolish ? 'WYSOKI' : 'HIGH') 
                           : gap >= 2 ? (isPolish ? 'ŚREDNI' : 'MEDIUM') 
                           : gap > 0 ? (isPolish ? 'NISKI' : 'LOW') 
                           : '-';
            const priorityColor = gap >= 3 ? COLORS.danger : gap >= 2 ? COLORS.warning : gap > 0 ? COLORS.accent : COLORS.textLight;

            tableData.push([
                { text: isPolish ? config.namePl : config.name },
                { text: actual.toFixed(1), options: { color: COLORS.secondary } },
                { text: target.toFixed(1), options: { color: COLORS.accent } },
                { text: gap > 0 ? `+${gap.toFixed(1)}` : '-', options: { color: gap > 0 ? COLORS.danger : COLORS.textLight } },
                { text: priority, options: { color: priorityColor, bold: true } }
            ]);
        });

        slide.addTable(tableData, {
            x: 0.5,
            y: 1.1,
            w: 9,
            colW: [3, 1.5, 1.5, 1.5, 1.5],
            fontSize: 11,
            fontFace: 'Arial',
            border: { pt: 0.5, color: COLORS.textLight },
            align: 'center',
            valign: 'middle'
        });
    }

    /**
     * Create recommendations slide
     */
    _createRecommendationsSlide(pptx, section, isPolish) {
        const slide = pptx.addSlide({ masterName: 'DRD_MASTER' });

        // Title
        slide.addText(isPolish ? 'Kluczowe Rekomendacje' : 'Key Recommendations', {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.6,
            fontSize: 28,
            fontFace: 'Arial',
            bold: true,
            color: COLORS.primary
        });

        // Parse content for bullet points
        const content = this._stripHtmlTags(section.content);
        const lines = content.split('\n').filter(l => l.trim()).slice(0, 6);

        lines.forEach((line, i) => {
            slide.addText(line.trim().substring(0, 150), {
                x: 0.5,
                y: 1.1 + i * 0.7,
                w: 9,
                h: 0.6,
                fontSize: 14,
                fontFace: 'Arial',
                color: COLORS.textDark,
                bullet: { type: 'bullet', color: COLORS.secondary }
            });
        });
    }

    /**
     * Create roadmap slide
     */
    _createRoadmapSlide(pptx, section, isPolish) {
        const slide = pptx.addSlide({ masterName: 'DRD_MASTER' });

        // Title
        slide.addText(isPolish ? 'Roadmapa Transformacji' : 'Transformation Roadmap', {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.6,
            fontSize: 28,
            fontFace: 'Arial',
            bold: true,
            color: COLORS.primary
        });

        // Phase boxes
        const phases = [
            { label: isPolish ? 'Fundamenty' : 'Foundation', period: 'Q1-Q2', color: COLORS.secondary },
            { label: 'Quick Wins', period: 'Q2-Q3', color: COLORS.accent },
            { label: isPolish ? 'Strategiczne' : 'Strategic', period: 'Q3-Q4', color: COLORS.warning },
            { label: isPolish ? 'Integracja AI' : 'AI Integration', period: 'Q4+', color: COLORS.primary }
        ];

        phases.forEach((phase, i) => {
            const x = 0.5 + i * 2.4;
            
            // Arrow shape
            slide.addShape('rect', {
                x,
                y: 2,
                w: 2.2,
                h: 1.5,
                fill: { color: phase.color }
            });

            // Arrow point (triangle on right side - simplified as we can't do complex arrows)
            
            slide.addText(phase.label, {
                x,
                y: 2.2,
                w: 2.2,
                h: 0.5,
                fontSize: 14,
                fontFace: 'Arial',
                bold: true,
                color: COLORS.white,
                align: 'center'
            });

            slide.addText(phase.period, {
                x,
                y: 2.8,
                w: 2.2,
                h: 0.4,
                fontSize: 11,
                fontFace: 'Arial',
                color: COLORS.white,
                align: 'center'
            });
        });

        // Content
        if (section.content) {
            const text = this._stripHtmlTags(section.content).substring(0, 600);
            slide.addText(text, {
                x: 0.5,
                y: 3.8,
                w: 9,
                h: 1.5,
                fontSize: 11,
                fontFace: 'Arial',
                color: COLORS.textDark,
                valign: 'top'
            });
        }
    }

    /**
     * Create next steps slide
     */
    _createNextStepsSlide(pptx, isPolish) {
        const slide = pptx.addSlide({ masterName: 'DRD_MASTER' });

        // Title
        slide.addText(isPolish ? 'Następne Kroki' : 'Next Steps', {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.6,
            fontSize: 28,
            fontFace: 'Arial',
            bold: true,
            color: COLORS.primary
        });

        const steps = isPolish ? [
            'Przegląd i walidacja wyników audytu z kluczowymi interesariuszami',
            'Priorytetyzacja inicjatyw transformacyjnych',
            'Opracowanie szczegółowego planu wdrożenia',
            'Przydzielenie zasobów i budżetu',
            'Uruchomienie pierwszych Quick Wins',
            'Regularne przeglądy postępów (co kwartał)'
        ] : [
            'Review and validate audit results with key stakeholders',
            'Prioritize transformation initiatives',
            'Develop detailed implementation plan',
            'Allocate resources and budget',
            'Launch first Quick Wins',
            'Regular progress reviews (quarterly)'
        ];

        steps.forEach((step, i) => {
            // Number circle
            slide.addShape('ellipse', {
                x: 0.5,
                y: 1.1 + i * 0.65,
                w: 0.4,
                h: 0.4,
                fill: { color: COLORS.secondary }
            });

            slide.addText(String(i + 1), {
                x: 0.5,
                y: 1.15 + i * 0.65,
                w: 0.4,
                h: 0.3,
                fontSize: 12,
                fontFace: 'Arial',
                bold: true,
                color: COLORS.white,
                align: 'center'
            });

            slide.addText(step, {
                x: 1.1,
                y: 1.15 + i * 0.65,
                w: 8.4,
                h: 0.5,
                fontSize: 14,
                fontFace: 'Arial',
                color: COLORS.textDark
            });
        });
    }

    /**
     * Create appendix slides
     */
    _createAppendixSlides(pptx, sections, axisData, isPolish) {
        // Axis detail slides
        const axisDetailSections = sections.filter(s => s.sectionType === 'axis_detail');
        
        if (axisDetailSections.length > 0) {
            const slide = pptx.addSlide({ masterName: 'DRD_MASTER' });

            slide.addText(isPolish ? 'Załącznik: Szczegóły Osi' : 'Appendix: Axis Details', {
                x: 0.5,
                y: 0.3,
                w: 9,
                h: 0.6,
                fontSize: 28,
                fontFace: 'Arial',
                bold: true,
                color: COLORS.primary
            });

            // Simplified table with axis details
            const tableData = [
                [
                    { text: isPolish ? 'Oś' : 'Axis', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
                    { text: isPolish ? 'Poziom Max' : 'Max Level', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
                    { text: isPolish ? 'Status' : 'Status', options: { bold: true, fill: COLORS.primary, color: COLORS.white } }
                ]
            ];

            Object.entries(DRD_AXES).forEach(([id, config]) => {
                const data = axisData[id] || {};
                const gap = (data.target || 0) - (data.actual || 0);
                const status = gap >= 3 ? (isPolish ? 'Wymaga uwagi' : 'Needs attention')
                             : gap >= 2 ? (isPolish ? 'Do poprawy' : 'To improve')
                             : gap > 0 ? (isPolish ? 'W trakcie' : 'In progress')
                             : (isPolish ? 'Dobry' : 'Good');

                tableData.push([
                    { text: isPolish ? config.namePl : config.name },
                    { text: String(config.maxLevel) },
                    { text: status }
                ]);
            });

            slide.addTable(tableData, {
                x: 0.5,
                y: 1.1,
                w: 9,
                colW: [5, 2, 2],
                fontSize: 11,
                fontFace: 'Arial',
                border: { pt: 0.5, color: COLORS.textLight },
                align: 'center',
                valign: 'middle'
            });
        }
    }

    /**
     * Create thank you slide
     */
    _createThankYouSlide(pptx, reportData, isPolish) {
        const slide = pptx.addSlide({ masterName: 'DRD_TITLE' });

        slide.addText(isPolish ? 'Dziękujemy' : 'Thank You', {
            x: 0.5,
            y: 1.8,
            w: 9,
            h: 1,
            fontSize: 48,
            fontFace: 'Arial',
            bold: true,
            color: COLORS.white,
            align: 'center'
        });

        slide.addText(isPolish 
            ? 'Jesteśmy gotowi omówić wyniki audytu i następne kroki.'
            : 'We are ready to discuss the audit results and next steps.', {
            x: 0.5,
            y: 3,
            w: 9,
            h: 0.6,
            fontSize: 18,
            fontFace: 'Arial',
            color: COLORS.textLight,
            align: 'center'
        });

        slide.addText(`${reportData.organizationName || ''}\n${new Date().getFullYear()}`, {
            x: 0.5,
            y: 4.5,
            w: 9,
            h: 0.8,
            fontSize: 14,
            fontFace: 'Arial',
            color: COLORS.textLight,
            align: 'center'
        });
    }

    /**
     * Strip HTML tags from content
     */
    _stripHtmlTags(html) {
        if (!html) return '';
        return html
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Save presentation to file or stream
     */
    async writeToStream(pptx, outputStream) {
        const buffer = await pptx.write({ outputType: 'nodebuffer' });
        outputStream.write(buffer);
        outputStream.end();
        return buffer;
    }
}

module.exports = PPTXExportService;

