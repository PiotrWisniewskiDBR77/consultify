/**
 * Report Content Service
 * Handles generation and management of DRD Audit Report content
 * Integrates with AI for intelligent content generation
 * 
 * Now uses Enterprise Templates for BCG/McKinsey-style reports
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const EnterpriseTemplates = require('./enterpriseReportTemplates');

// DRD Axis Configuration
const DRD_AXES = {
    processes: { 
        id: 'processes', 
        name: 'Digital Processes', 
        namePl: 'Procesy Cyfrowe',
        order: 1,
        maxLevel: 7,
        areas: ['1A', '1B', '1C', '1D', '1E', '1F', '1G', '1H', '1I']
    },
    digitalProducts: { 
        id: 'digitalProducts', 
        name: 'Digital Products', 
        namePl: 'Produkty Cyfrowe',
        order: 2,
        maxLevel: 5,
        areas: ['2A', '2B', '2C', '2D', '2E']
    },
    businessModels: { 
        id: 'businessModels', 
        name: 'Digital Business Models', 
        namePl: 'Cyfrowe Modele Biznesowe',
        order: 3,
        maxLevel: 5,
        areas: ['3A', '3B', '3C', '3D', '3E']
    },
    dataManagement: { 
        id: 'dataManagement', 
        name: 'Data Management', 
        namePl: 'Zarządzanie Danymi',
        order: 4,
        maxLevel: 7,
        areas: ['4A', '4B', '4C', '4D', '4E']
    },
    culture: { 
        id: 'culture', 
        name: 'Culture of Transformation', 
        namePl: 'Kultura Transformacji',
        order: 5,
        maxLevel: 5,
        areas: ['5A', '5B', '5C', '5D', '5E']
    },
    cybersecurity: { 
        id: 'cybersecurity', 
        name: 'Cybersecurity', 
        namePl: 'Cyberbezpieczeństwo',
        order: 6,
        maxLevel: 5,
        areas: ['6A', '6B', '6C', '6D', '6E']
    },
    aiMaturity: { 
        id: 'aiMaturity', 
        name: 'AI Maturity', 
        namePl: 'Dojrzałość AI',
        order: 7,
        maxLevel: 5,
        areas: ['7A', '7B', '7C', '7D', '7E']
    }
};

// Section type definitions
const SECTION_TYPES = {
    cover_page: { 
        title: 'Cover Page', 
        titlePl: 'Strona Tytułowa',
        hasData: false,
        aiSupported: false
    },
    executive_summary: { 
        title: 'Executive Summary', 
        titlePl: 'Podsumowanie Wykonawcze',
        hasData: true,
        aiSupported: true
    },
    methodology: { 
        title: 'DRD Methodology', 
        titlePl: 'Metodologia DRD',
        hasData: false,
        aiSupported: false
    },
    maturity_overview: { 
        title: 'Maturity Overview', 
        titlePl: 'Przegląd Dojrzałości',
        hasData: true,
        aiSupported: true
    },
    axis_detail: { 
        title: 'Axis Detail', 
        titlePl: 'Szczegóły Osi',
        hasData: true,
        aiSupported: true
    },
    area_detail: { 
        title: 'Area Detail', 
        titlePl: 'Szczegóły Obszaru',
        hasData: true,
        aiSupported: true
    },
    gap_analysis: { 
        title: 'Gap Analysis', 
        titlePl: 'Analiza Luk',
        hasData: true,
        aiSupported: true
    },
    initiatives: { 
        title: 'Recommended Initiatives', 
        titlePl: 'Rekomendowane Inicjatywy',
        hasData: true,
        aiSupported: true
    },
    roadmap: { 
        title: 'Transformation Roadmap', 
        titlePl: 'Roadmapa Transformacji',
        hasData: true,
        aiSupported: true
    },
    appendix: { 
        title: 'Appendix', 
        titlePl: 'Załączniki',
        hasData: true,
        aiSupported: false
    },
    custom: { 
        title: 'Custom Section', 
        titlePl: 'Sekcja Niestandardowa',
        hasData: false,
        aiSupported: true
    }
};

class ReportContentService {
    constructor() {
        this.drdAxes = DRD_AXES;
        this.sectionTypes = SECTION_TYPES;
    }

    /**
     * Get full report data with all sections
     */
    async getFullReport(reportId, organizationId) {
        return new Promise((resolve, reject) => {
            const reportSql = `
                SELECT 
                    r.*,
                    a.name as assessment_name,
                    a.axis_data,
                    a.progress,
                    a.is_complete,
                    p.name as project_name,
                    o.name as organization_name,
                    o.transformation_context
                FROM assessment_reports r
                LEFT JOIN assessments a ON r.assessment_id = a.id
                LEFT JOIN projects p ON r.project_id = p.id
                LEFT JOIN organizations o ON r.organization_id = o.id
                WHERE r.id = ? AND r.organization_id = ?
            `;

            db.get(reportSql, [reportId, organizationId], (err, report) => {
                if (err) return reject(err);
                if (!report) return resolve(null);

                // Get sections
                db.all(
                    'SELECT * FROM report_sections WHERE report_id = ? ORDER BY order_index',
                    [reportId],
                    (err, sections) => {
                        if (err) sections = [];

                        // Parse JSON fields
                        let axisData = {};
                        let transformationContext = {};
                        try {
                            axisData = report.axis_data ? JSON.parse(report.axis_data) : {};
                            transformationContext = report.transformation_context ? JSON.parse(report.transformation_context) : {};
                        } catch (e) {}

                        const parsedSections = (sections || []).map(s => ({
                            ...s,
                            dataSnapshot: s.data_snapshot ? JSON.parse(s.data_snapshot) : {},
                            isAiGenerated: s.is_ai_generated === 1
                        }));

                        resolve({
                            ...report,
                            axisData,
                            transformationContext,
                            sections: parsedSections
                        });
                    }
                );
            });
        });
    }

    /**
     * Generate complete report from assessment
     */
    async generateFullReport(reportId, assessmentId, options = {}) {
        const { templateId, language = 'pl', userId } = options;

        // Get assessment data
        const assessment = await this.getAssessmentData(assessmentId);
        if (!assessment) {
            throw new Error('Assessment not found');
        }

        // Get or create default template config
        const sectionConfig = await this.getTemplateSections(templateId);

        // Generate each section
        const sections = [];
        const now = new Date().toISOString();

        for (let i = 0; i < sectionConfig.length; i++) {
            const config = sectionConfig[i];
            const sectionId = uuidv4();

            const section = {
                id: sectionId,
                reportId,
                sectionType: config.type,
                axisId: config.axisId || null,
                areaId: config.areaId || null,
                title: this.getSectionTitle(config, language),
                content: this.generateSectionContent(config, assessment, language),
                dataSnapshot: this.createDataSnapshot(config, assessment),
                orderIndex: i,
                isAiGenerated: true,
                lastEditedBy: userId,
                createdAt: now,
                updatedAt: now
            };

            sections.push(section);
        }

        // Save sections to database
        await this.saveSections(reportId, sections);

        return {
            reportId,
            sectionsGenerated: sections.length,
            sections: sections.map(s => ({ id: s.id, type: s.sectionType, title: s.title }))
        };
    }

    /**
     * Get assessment data with all axis scores
     */
    async getAssessmentData(assessmentId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    a.*,
                    p.name as project_name,
                    o.name as organization_name,
                    o.transformation_context
                FROM assessments a
                LEFT JOIN projects p ON a.project_id = p.id
                LEFT JOIN organizations o ON a.organization_id = o.id
                WHERE a.id = ?
            `;

            db.get(sql, [assessmentId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                let axisData = {};
                let transformationContext = {};
                try {
                    axisData = row.axis_data ? JSON.parse(row.axis_data) : {};
                    transformationContext = row.transformation_context ? JSON.parse(row.transformation_context) : {};
                } catch (e) {}

                resolve({
                    ...row,
                    axisData,
                    transformationContext
                });
            });
        });
    }

    /**
     * Get template sections configuration
     */
    async getTemplateSections(templateId) {
        if (!templateId) {
            return this.getDefaultSections();
        }

        return new Promise((resolve, reject) => {
            db.get('SELECT section_config FROM report_templates WHERE id = ?', [templateId], (err, row) => {
                if (err || !row) {
                    return resolve(this.getDefaultSections());
                }
                try {
                    resolve(JSON.parse(row.section_config));
                } catch (e) {
                    resolve(this.getDefaultSections());
                }
            });
        });
    }

    /**
     * Get default section configuration
     */
    getDefaultSections() {
        return [
            { type: 'cover_page', title: 'Cover Page' },
            { type: 'executive_summary', title: 'Executive Summary' },
            { type: 'methodology', title: 'DRD Methodology' },
            { type: 'maturity_overview', title: 'Maturity Overview' },
            ...Object.entries(DRD_AXES).map(([id, config]) => ({
                type: 'axis_detail',
                axisId: id,
                title: `Axis ${config.order}: ${config.name}`
            })),
            { type: 'gap_analysis', title: 'Gap Analysis' },
            { type: 'initiatives', title: 'Recommended Initiatives' },
            { type: 'roadmap', title: 'Transformation Roadmap' },
            { type: 'appendix', title: 'Appendix' }
        ];
    }

    /**
     * Get localized section title
     */
    getSectionTitle(config, language) {
        const isPolish = language === 'pl';
        
        if (config.type === 'axis_detail' && config.axisId) {
            const axis = DRD_AXES[config.axisId];
            if (axis) {
                return isPolish 
                    ? `Oś ${axis.order}: ${axis.namePl}`
                    : `Axis ${axis.order}: ${axis.name}`;
            }
        }

        const typeConfig = SECTION_TYPES[config.type];
        return isPolish ? typeConfig?.titlePl : typeConfig?.title || config.title;
    }

    /**
     * Generate section content based on type
     * Uses Enterprise Templates for professional BCG/McKinsey-style output
     */
    generateSectionContent(config, assessment, language) {
        const isPolish = language === 'pl';
        const { axisData, transformationContext, organization_name, project_name } = assessment;

        // Use Enterprise Templates for professional output
        switch (config.type) {
            case 'cover_page':
                return EnterpriseTemplates.generateCoverPage(assessment, isPolish);
            case 'executive_summary':
                return EnterpriseTemplates.generateExecutiveSummary(assessment, isPolish);
            case 'methodology':
                return EnterpriseTemplates.generateMethodology(isPolish);
            case 'maturity_overview':
                return this.generateMaturityOverviewEnterprise(assessment, isPolish);
            case 'axis_detail':
                return EnterpriseTemplates.generateAxisDetail(config.axisId, assessment, isPolish);
            case 'gap_analysis':
                return EnterpriseTemplates.generateGapAnalysis(assessment, isPolish);
            case 'initiatives':
                return this.generateInitiativesEnterprise(assessment, isPolish);
            case 'roadmap':
                return this.generateRoadmapEnterprise(assessment, isPolish);
            case 'appendix':
                return this.generateAppendixEnterprise(assessment, isPolish);
            default:
                return isPolish ? '<div class="custom-section"><h2>Nowa Sekcja</h2><p><em>Treść do uzupełnienia...</em></p></div>' : '<div class="custom-section"><h2>New Section</h2><p><em>Content to be completed...</em></p></div>';
        }
    }

    /**
     * Create data snapshot for section
     */
    createDataSnapshot(config, assessment) {
        const { axisData } = assessment;
        const snapshot = {
            generatedAt: new Date().toISOString(),
            assessmentId: assessment.id
        };

        switch (config.type) {
            case 'maturity_overview':
            case 'gap_analysis':
                snapshot.axes = Object.entries(axisData || {}).map(([id, data]) => ({
                    id,
                    name: DRD_AXES[id]?.name || id,
                    namePl: DRD_AXES[id]?.namePl || id,
                    actual: data?.actual || 0,
                    target: data?.target || 0,
                    gap: (data?.target || 0) - (data?.actual || 0),
                    maxLevel: DRD_AXES[id]?.maxLevel || 7
                }));
                break;

            case 'axis_detail':
                if (config.axisId && axisData[config.axisId]) {
                    const axis = axisData[config.axisId];
                    snapshot.axis = {
                        id: config.axisId,
                        name: DRD_AXES[config.axisId]?.name,
                        namePl: DRD_AXES[config.axisId]?.namePl,
                        actual: axis.actual || 0,
                        target: axis.target || 0,
                        gap: (axis.target || 0) - (axis.actual || 0),
                        justification: axis.justification || '',
                        areaScores: axis.areaScores || {},
                        maxLevel: DRD_AXES[config.axisId]?.maxLevel || 7
                    };
                }
                break;

            case 'executive_summary':
                const metrics = this.calculateOverallMetrics(axisData);
                snapshot.overallMetrics = metrics;
                snapshot.context = assessment.transformationContext || {};
                break;
        }

        return snapshot;
    }

    /**
     * Calculate overall metrics from axis data
     */
    calculateOverallMetrics(axisData) {
        let totalActual = 0, totalTarget = 0, count = 0;
        const gaps = [];

        Object.entries(axisData || {}).forEach(([id, data]) => {
            if (data?.actual) {
                totalActual += data.actual;
                totalTarget += data.target || 0;
                count++;
                gaps.push({
                    axis: id,
                    gap: (data.target || 0) - (data.actual || 0)
                });
            }
        });

        gaps.sort((a, b) => b.gap - a.gap);

        return {
            averageActual: count > 0 ? (totalActual / count).toFixed(1) : '0',
            averageTarget: count > 0 ? (totalTarget / count).toFixed(1) : '0',
            averageGap: count > 0 ? ((totalTarget - totalActual) / count).toFixed(1) : '0',
            axesAssessed: count,
            largestGap: gaps[0] || null,
            smallestGap: gaps[gaps.length - 1] || null
        };
    }

    /**
     * Save sections to database
     */
    async saveSections(reportId, sections) {
        // Delete existing sections first
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM report_sections WHERE report_id = ?', [reportId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Insert new sections
        const stmt = db.prepare(`
            INSERT INTO report_sections 
            (id, report_id, section_type, axis_id, area_id, title, content, data_snapshot, order_index, is_ai_generated, last_edited_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const section of sections) {
            await new Promise((resolve, reject) => {
                stmt.run(
                    section.id,
                    section.reportId,
                    section.sectionType,
                    section.axisId,
                    section.areaId,
                    section.title,
                    section.content,
                    JSON.stringify(section.dataSnapshot),
                    section.orderIndex,
                    section.isAiGenerated ? 1 : 0,
                    section.lastEditedBy,
                    section.createdAt,
                    section.updatedAt,
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        stmt.finalize();
    }

    // =========================================================================
    // CONTENT GENERATION METHODS
    // =========================================================================

    generateCoverPage(assessment, isPolish) {
        const { organization_name, project_name } = assessment;
        const date = new Date().toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return `# ${isPolish ? 'Raport z Audytu DRD' : 'DRD Audit Report'}

## ${organization_name || (isPolish ? 'Nazwa Organizacji' : 'Organization Name')}

### ${isPolish ? 'Digital Readiness Diagnosis' : 'Digital Readiness Diagnosis'}
${isPolish ? 'Diagnoza Gotowości Cyfrowej' : 'Digital Maturity Assessment'}

---

**${isPolish ? 'Projekt' : 'Project'}:** ${project_name || '-'}

**${isPolish ? 'Data raportu' : 'Report Date'}:** ${date}

**${isPolish ? 'Wersja' : 'Version'}:** 1.0

**${isPolish ? 'Status' : 'Status'}:** ${isPolish ? 'Wersja robocza' : 'Draft'}

---

*${isPolish 
    ? 'Raport przygotowany zgodnie z metodologią Digital Readiness Diagnosis (DRD) opisaną w książce "Digital Pathfinder" autorstwa dr Piotra Wiśniewskiego.'
    : 'Report prepared according to the Digital Readiness Diagnosis (DRD) methodology described in the book "Digital Pathfinder" by Dr. Piotr Wisniewski.'}*

---

**${isPolish ? 'POUFNE' : 'CONFIDENTIAL'}**`;
    }

    generateExecutiveSummary(assessment, isPolish) {
        const { axisData, organization_name } = assessment;
        const metrics = this.calculateOverallMetrics(axisData);

        // Find strongest and weakest axes
        let strongest = { name: '-', score: 0 };
        let weakest = { name: '-', score: 10, gap: 0 };

        Object.entries(axisData || {}).forEach(([id, data]) => {
            const axis = DRD_AXES[id];
            if (data?.actual > strongest.score) {
                strongest = { name: isPolish ? axis?.namePl : axis?.name, score: data.actual };
            }
            const gap = (data?.target || 0) - (data?.actual || 0);
            if (gap > weakest.gap) {
                weakest = { name: isPolish ? axis?.namePl : axis?.name, gap, score: data?.actual || 0 };
            }
        });

        return `## ${isPolish ? 'Podsumowanie Wykonawcze' : 'Executive Summary'}

### ${isPolish ? 'Kontekst' : 'Context'}
${organization_name || (isPolish ? 'Organizacja' : 'Organization')} ${isPolish 
    ? 'przeprowadziła kompleksową diagnozę dojrzałości cyfrowej (DRD) obejmującą 7 osi transformacji cyfrowej oraz ponad 30 szczegółowych obszarów oceny.'
    : 'conducted a comprehensive Digital Readiness Diagnosis (DRD) covering 7 axes of digital transformation and over 30 detailed assessment areas.'}

### ${isPolish ? 'Kluczowe Wyniki' : 'Key Results'}

| ${isPolish ? 'Metryka' : 'Metric'} | ${isPolish ? 'Wartość' : 'Value'} |
|--------|---------|
| ${isPolish ? 'Ogólny poziom dojrzałości' : 'Overall Maturity Level'} | **${metrics.averageActual}** / 7 |
| ${isPolish ? 'Poziom docelowy' : 'Target Level'} | **${metrics.averageTarget}** / 7 |
| ${isPolish ? 'Średnia luka' : 'Average Gap'} | **${metrics.averageGap}** ${isPolish ? 'poziomów' : 'levels'} |
| ${isPolish ? 'Osi ocenionych' : 'Axes Assessed'} | ${metrics.axesAssessed} / 7 |

### ${isPolish ? 'Mocne Strony' : 'Strengths'}
- **${strongest.name}** - ${isPolish ? 'najwyższy poziom dojrzałości' : 'highest maturity level'} (${strongest.score}/7)
- ${isPolish ? 'Organizacja wykazuje solidne fundamenty w tym obszarze.' : 'Organization demonstrates solid foundations in this area.'}

### ${isPolish ? 'Obszary Priorytetowe' : 'Priority Areas'}
- **${weakest.name}** - ${isPolish ? 'największa luka do zamknięcia' : 'largest gap to close'} (${isPolish ? 'luka' : 'gap'}: ${weakest.gap})
- ${isPolish ? 'Wymaga strategicznej uwagi i dedykowanych zasobów.' : 'Requires strategic attention and dedicated resources.'}

### ${isPolish ? 'Rekomendacja Strategiczna' : 'Strategic Recommendation'}
${parseFloat(metrics.averageGap) > 2 
    ? (isPolish 
        ? 'Ze względu na znaczącą lukę między stanem obecnym a docelowym, zalecamy przyjęcie fazowego podejścia do transformacji, zaczynając od fundamentów (dane, governance) przed wdrożeniem bardziej zaawansowanych inicjatyw.'
        : 'Given the significant gap between current and target state, we recommend adopting a phased approach to transformation, starting with foundations (data, governance) before implementing more advanced initiatives.')
    : (isPolish
        ? 'Organizacja wykazuje dobrą dojrzałość cyfrową. Zalecamy skupienie się na inicjatywach typu "quick win" oraz systematyczne podnoszenie poziomu w obszarach z największymi lukami.'
        : 'Organization demonstrates good digital maturity. We recommend focusing on "quick win" initiatives and systematically raising the level in areas with the largest gaps.')}`;
    }

    generateMethodology(isPolish) {
        return `## ${isPolish ? 'Metodologia DRD' : 'DRD Methodology'}

### ${isPolish ? 'Czym jest DRD?' : 'What is DRD?'}
${isPolish 
    ? 'Digital Readiness Diagnosis (DRD) to kompleksowa metodologia oceny dojrzałości cyfrowej organizacji, opracowana na bazie wieloletniego doświadczenia w transformacji przedsiębiorstw produkcyjnych i usługowych. Metodologia opiera się na filozofii kontroli VDA 6.3 stosowanej w ocenie doskonałości procesów w firmach.'
    : 'Digital Readiness Diagnosis (DRD) is a comprehensive methodology for assessing organizational digital maturity, developed based on years of experience in transforming manufacturing and service enterprises. The methodology is based on the VDA 6.3 control philosophy used in assessing process excellence in companies.'}

### ${isPolish ? '7 Osi Transformacji Cyfrowej' : '7 Axes of Digital Transformation'}

| # | ${isPolish ? 'Oś' : 'Axis'} | ${isPolish ? 'Opis' : 'Description'} | ${isPolish ? 'Skala' : 'Scale'} |
|---|------|------|-------|
| 1 | ${isPolish ? 'Procesy Cyfrowe' : 'Digital Processes'} | ${isPolish ? 'Digitalizacja procesów operacyjnych' : 'Digitization of operational processes'} | 1-7 |
| 2 | ${isPolish ? 'Produkty Cyfrowe' : 'Digital Products'} | ${isPolish ? 'Produkty i usługi w formie elektronicznej' : 'Products and services in electronic form'} | 1-5 |
| 3 | ${isPolish ? 'Modele Biznesowe' : 'Business Models'} | ${isPolish ? 'Cyfrowe modele generowania wartości' : 'Digital value generation models'} | 1-5 |
| 4 | ${isPolish ? 'Zarządzanie Danymi' : 'Data Management'} | ${isPolish ? 'Big Data i analityka' : 'Big Data and analytics'} | 1-7 |
| 5 | ${isPolish ? 'Kultura Transformacji' : 'Culture'} | ${isPolish ? 'Gotowość organizacyjna do zmian' : 'Organizational readiness for change'} | 1-5 |
| 6 | ${isPolish ? 'Cyberbezpieczeństwo' : 'Cybersecurity'} | ${isPolish ? 'Ochrona zasobów cyfrowych' : 'Digital asset protection'} | 1-5 |
| 7 | ${isPolish ? 'Dojrzałość AI' : 'AI Maturity'} | ${isPolish ? 'Wykorzystanie sztucznej inteligencji' : 'AI utilization'} | 1-5 |

### ${isPolish ? 'Poziomy Dojrzałości (Oś 1 i 4)' : 'Maturity Levels (Axis 1 & 4)'}
1. **${isPolish ? 'Rejestracja danych' : 'Data Registration'}** - ${isPolish ? 'Podstawowe zbieranie danych' : 'Basic data collection'}
2. **${isPolish ? 'Kontrola stanowisk' : 'Workstation Control'}** - ${isPolish ? 'Cyfrowe narzędzia na stanowiskach' : 'Digital tools at workstations'}
3. **${isPolish ? 'Kontrola procesów' : 'Process Control'}** - ${isPolish ? 'Zintegrowane zarządzanie procesami' : 'Integrated process management'}
4. **${isPolish ? 'Automatyzacja' : 'Automation'}** - ${isPolish ? 'Automatyzacja powtarzalnych zadań' : 'Automation of repetitive tasks'}
5. **MES** - ${isPolish ? 'Systemy wykonawcze produkcji' : 'Manufacturing Execution Systems'}
6. **ERP** - ${isPolish ? 'Zintegrowane systemy zarządzania' : 'Integrated management systems'}
7. **${isPolish ? 'Wsparcie AI' : 'AI Support'}** - ${isPolish ? 'Algorytmy sztucznej inteligencji' : 'Artificial intelligence algorithms'}

### ${isPolish ? 'Poziomy Dojrzałości (Oś 2, 3, 5, 6, 7)' : 'Maturity Levels (Axis 2, 3, 5, 6, 7)'}
1. **${isPolish ? 'Podstawowy' : 'Basic'}**
2. **${isPolish ? 'Średnio-zaawansowany' : 'Intermediate'}**
3. **${isPolish ? 'Zaawansowany' : 'Advanced'}**
4. **${isPolish ? 'Interaktywny/Personalizowany' : 'Interactive/Personalized'}**
5. **${isPolish ? 'Ekspert' : 'Expert'}**

### ${isPolish ? 'Zasady Oceny' : 'Assessment Principles'}
- ${isPolish ? 'W razie wątpliwości wybierz niższy poziom' : 'When in doubt, choose the lower level'}
- ${isPolish ? 'Każda ocena wymaga uzasadnienia i dowodów' : 'Each assessment requires justification and evidence'}
- ${isPolish ? 'Audyt powinien być przeprowadzany co 3-12 miesięcy' : 'Audit should be conducted every 3-12 months'}`;
    }

    generateMaturityOverview(assessment, isPolish) {
        const { axisData } = assessment;
        const metrics = this.calculateOverallMetrics(axisData);

        const axisRows = Object.entries(DRD_AXES).map(([id, config]) => {
            const data = axisData[id] || {};
            const gap = (data.target || 0) - (data.actual || 0);
            const priority = gap >= 3 ? (isPolish ? 'WYSOKI' : 'HIGH') : gap >= 2 ? (isPolish ? 'ŚREDNI' : 'MEDIUM') : gap > 0 ? (isPolish ? 'NISKI' : 'LOW') : '-';
            return `| ${config.order} | ${isPolish ? config.namePl : config.name} | ${data.actual || '-'} | ${data.target || '-'} | ${gap || '-'} | ${priority} |`;
        }).join('\n');

        return `## ${isPolish ? 'Przegląd Dojrzałości' : 'Maturity Overview'}

### ${isPolish ? 'Metryki Zbiorcze' : 'Summary Metrics'}

| ${isPolish ? 'Metryka' : 'Metric'} | ${isPolish ? 'Wartość' : 'Value'} |
|--------|---------|
| ${isPolish ? 'Średnia dojrzałość' : 'Average Maturity'} | ${metrics.averageActual} |
| ${isPolish ? 'Średni cel' : 'Average Target'} | ${metrics.averageTarget} |
| ${isPolish ? 'Średnia luka' : 'Average Gap'} | ${metrics.averageGap} |

### ${isPolish ? 'Tabela 7 Osi' : '7 Axes Table'}

| # | ${isPolish ? 'Oś' : 'Axis'} | ${isPolish ? 'Aktualny' : 'Current'} | ${isPolish ? 'Docelowy' : 'Target'} | ${isPolish ? 'Luka' : 'Gap'} | ${isPolish ? 'Priorytet' : 'Priority'} |
|---|------|----------|---------|-----|----------|
${axisRows}

### ${isPolish ? 'Wizualizacja' : 'Visualization'}
*${isPolish ? 'Wykres radarowy pokazujący wszystkie 7 osi zostanie wygenerowany automatycznie w eksporcie PDF.' : 'Radar chart showing all 7 axes will be automatically generated in PDF export.'}*

---

**${isPolish ? 'Legenda priorytetów' : 'Priority Legend'}:**
- 🔴 ${isPolish ? 'WYSOKI' : 'HIGH'}: ${isPolish ? 'Luka ≥ 3 poziomów' : 'Gap ≥ 3 levels'}
- 🟡 ${isPolish ? 'ŚREDNI' : 'MEDIUM'}: ${isPolish ? 'Luka = 2 poziomy' : 'Gap = 2 levels'}
- 🟢 ${isPolish ? 'NISKI' : 'LOW'}: ${isPolish ? 'Luka = 1 poziom' : 'Gap = 1 level'}`;
    }

    generateAxisDetail(axisId, assessment, isPolish) {
        const { axisData } = assessment;
        const axisConfig = DRD_AXES[axisId];
        const axis = axisData[axisId] || {};

        if (!axisConfig) {
            return isPolish ? `## Oś nieznana\n\n*Brak danych*` : `## Unknown Axis\n\n*No data*`;
        }

        const gap = (axis.target || 0) - (axis.actual || 0);
        const priority = gap >= 3 ? (isPolish ? 'WYSOKI' : 'HIGH') : gap >= 2 ? (isPolish ? 'ŚREDNI' : 'MEDIUM') : gap > 0 ? (isPolish ? 'NISKI' : 'LOW') : '-';

        // Generate area scores table if available
        let areaTable = '';
        if (axis.areaScores && Object.keys(axis.areaScores).length > 0) {
            const areaRows = Object.entries(axis.areaScores).map(([areaId, scores]) => {
                const actual = Array.isArray(scores) ? scores[0] : scores.actual || 0;
                const target = Array.isArray(scores) ? scores[1] : scores.target || 0;
                return `| ${areaId} | ${actual || '-'} | ${target || '-'} | ${(target || 0) - (actual || 0)} |`;
            }).join('\n');

            areaTable = `
### ${isPolish ? 'Szczegóły Obszarów' : 'Area Details'}

| ${isPolish ? 'Obszar' : 'Area'} | ${isPolish ? 'Aktualny' : 'Current'} | ${isPolish ? 'Docelowy' : 'Target'} | ${isPolish ? 'Luka' : 'Gap'} |
|--------|----------|---------|-----|
${areaRows}`;
        }

        return `## ${isPolish ? `Oś ${axisConfig.order}: ${axisConfig.namePl}` : `Axis ${axisConfig.order}: ${axisConfig.name}`}

### ${isPolish ? 'Ocena Zbiorcza' : 'Summary Assessment'}

| ${isPolish ? 'Metryka' : 'Metric'} | ${isPolish ? 'Wartość' : 'Value'} |
|--------|---------|
| ${isPolish ? 'Poziom aktualny' : 'Current Level'} | **${axis.actual || '-'}** / ${axisConfig.maxLevel} |
| ${isPolish ? 'Poziom docelowy' : 'Target Level'} | **${axis.target || '-'}** / ${axisConfig.maxLevel} |
| ${isPolish ? 'Luka' : 'Gap'} | **${gap}** ${isPolish ? 'poziomów' : 'levels'} |
| ${isPolish ? 'Priorytet' : 'Priority'} | ${priority} |
| ${isPolish ? 'Szacowany czas' : 'Est. Time'} | ${gap > 0 ? `${gap * 3}-${gap * 4} ${isPolish ? 'miesięcy' : 'months'}` : '-'} |

### ${isPolish ? 'Uzasadnienie Oceny' : 'Assessment Justification'}
${axis.justification || (isPolish ? '*Brak uzasadnienia. Do uzupełnienia przez audytora.*' : '*No justification provided. To be completed by auditor.*')}
${areaTable}

### ${isPolish ? 'Ścieżka Dojścia (Pathway)' : 'Pathway'}
${gap > 0 
    ? (isPolish 
        ? `Aby osiągnąć poziom ${axis.target} z obecnego poziomu ${axis.actual}, organizacja powinna przejść przez następujące etapy:`
        : `To reach level ${axis.target} from current level ${axis.actual}, organization should go through the following stages:`)
    : (isPolish ? '*Cel osiągnięty lub brak zdefiniowanego celu.*' : '*Target achieved or no target defined.*')}

${gap > 0 ? Array.from({ length: gap }, (_, i) => {
    const fromLevel = (axis.actual || 0) + i;
    const toLevel = fromLevel + 1;
    return `**${isPolish ? 'Poziom' : 'Level'} ${fromLevel} → ${toLevel}:**\n*${isPolish ? 'Wymagane działania do uzupełnienia przez AI lub audytora...' : 'Required actions to be completed by AI or auditor...'}*`;
}).join('\n\n') : ''}

### ${isPolish ? 'Rekomendacje' : 'Recommendations'}
*${isPolish ? 'Do wygenerowania przez AI na podstawie analizy luk...' : 'To be generated by AI based on gap analysis...'}*`;
    }

    generateGapAnalysis(assessment, isPolish) {
        const { axisData } = assessment;

        // Calculate gaps and sort by size
        const gaps = Object.entries(DRD_AXES).map(([id, config]) => {
            const data = axisData[id] || {};
            const gap = (data.target || 0) - (data.actual || 0);
            return {
                id,
                name: isPolish ? config.namePl : config.name,
                actual: data.actual || 0,
                target: data.target || 0,
                gap,
                priority: gap >= 3 ? 'HIGH' : gap >= 2 ? 'MEDIUM' : gap > 0 ? 'LOW' : 'NONE',
                effort: gap > 0 ? `${gap * 3}-${gap * 4}` : '-'
            };
        }).sort((a, b) => b.gap - a.gap);

        const priorityGaps = gaps.filter(g => g.gap > 0);
        const highPriority = priorityGaps.filter(g => g.priority === 'HIGH');
        const mediumPriority = priorityGaps.filter(g => g.priority === 'MEDIUM');

        const gapRows = gaps.map(g => {
            const priorityIcon = g.priority === 'HIGH' ? '🔴' : g.priority === 'MEDIUM' ? '🟡' : g.priority === 'LOW' ? '🟢' : '⚪';
            return `| ${g.name} | ${g.actual} | ${g.target} | ${g.gap} | ${priorityIcon} ${isPolish ? (g.priority === 'HIGH' ? 'WYSOKI' : g.priority === 'MEDIUM' ? 'ŚREDNI' : g.priority === 'LOW' ? 'NISKI' : '-') : g.priority} | ${g.effort} ${isPolish ? 'mies.' : 'mo.'} |`;
        }).join('\n');

        return `## ${isPolish ? 'Analiza Luk' : 'Gap Analysis'}

### ${isPolish ? 'Podsumowanie Luk' : 'Gap Summary'}
- **${isPolish ? 'Osie z lukami' : 'Axes with gaps'}:** ${priorityGaps.length} / 7
- **${isPolish ? 'Wysokie priorytety' : 'High priorities'}:** ${highPriority.length}
- **${isPolish ? 'Średnie priorytety' : 'Medium priorities'}:** ${mediumPriority.length}

### ${isPolish ? 'Tabela Priorytetów' : 'Priority Table'}

| ${isPolish ? 'Oś' : 'Axis'} | ${isPolish ? 'Aktualny' : 'Current'} | ${isPolish ? 'Docelowy' : 'Target'} | ${isPolish ? 'Luka' : 'Gap'} | ${isPolish ? 'Priorytet' : 'Priority'} | ${isPolish ? 'Szac. czas' : 'Est. Time'} |
|------|----------|---------|-----|----------|-----------|
${gapRows}

### ${isPolish ? 'Interpretacja' : 'Interpretation'}

${highPriority.length > 0 
    ? `**${isPolish ? 'Obszary krytyczne' : 'Critical areas'} (${isPolish ? 'WYSOKI priorytet' : 'HIGH priority'}):**\n${highPriority.map(g => `- ${g.name}: ${isPolish ? 'luka' : 'gap'} ${g.gap} ${isPolish ? 'poziomów' : 'levels'}`).join('\n')}\n\n${isPolish ? 'Te obszary wymagają natychmiastowej uwagi i dedykowanych zasobów.' : 'These areas require immediate attention and dedicated resources.'}`
    : ''}

${mediumPriority.length > 0
    ? `\n**${isPolish ? 'Obszary do poprawy' : 'Areas for improvement'} (${isPolish ? 'ŚREDNI priorytet' : 'MEDIUM priority'}):**\n${mediumPriority.map(g => `- ${g.name}: ${isPolish ? 'luka' : 'gap'} ${g.gap} ${isPolish ? 'poziomów' : 'levels'}`).join('\n')}`
    : ''}

### ${isPolish ? 'Heat Map' : 'Heat Map'}
*${isPolish ? 'Wizualizacja heat map zostanie wygenerowana w eksporcie PDF.' : 'Heat map visualization will be generated in PDF export.'}*`;
    }

    generateInitiatives(assessment, isPolish) {
        const { axisData } = assessment;

        // Generate initiatives based on gaps
        const initiatives = [];
        Object.entries(DRD_AXES).forEach(([id, config]) => {
            const data = axisData[id] || {};
            const gap = (data.target || 0) - (data.actual || 0);
            if (gap > 0) {
                initiatives.push({
                    axis: isPolish ? config.namePl : config.name,
                    priority: gap >= 3 ? 'Critical' : gap >= 2 ? 'High' : 'Medium',
                    initiative: isPolish 
                        ? `Podniesienie poziomu ${config.namePl} z ${data.actual} do ${data.target}`
                        : `Raise ${config.name} level from ${data.actual} to ${data.target}`,
                    timeframe: `${gap * 3}-${gap * 4} ${isPolish ? 'mies.' : 'mo.'}`,
                    effort: gap >= 3 ? (isPolish ? 'Duży' : 'Major') : gap >= 2 ? (isPolish ? 'Znaczący' : 'Significant') : (isPolish ? 'Umiarkowany' : 'Moderate')
                });
            }
        });

        initiatives.sort((a, b) => {
            const priorityOrder = { Critical: 0, High: 1, Medium: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        const initiativeRows = initiatives.map((init, i) => 
            `| ${i + 1} | ${init.priority} | ${init.axis} | ${init.initiative} | ${init.timeframe} | ${init.effort} |`
        ).join('\n');

        return `## ${isPolish ? 'Rekomendowane Inicjatywy' : 'Recommended Initiatives'}

### ${isPolish ? 'Lista Inicjatyw' : 'Initiative List'}

| # | ${isPolish ? 'Priorytet' : 'Priority'} | ${isPolish ? 'Oś' : 'Axis'} | ${isPolish ? 'Inicjatywa' : 'Initiative'} | ${isPolish ? 'Czas' : 'Time'} | ${isPolish ? 'Nakład' : 'Effort'} |
|---|----------|------|------------|------|--------|
${initiativeRows || `| - | - | - | ${isPolish ? 'Brak luk do zamknięcia' : 'No gaps to close'} | - | - |`}

### ${isPolish ? 'Matryca Priorytetyzacji' : 'Prioritization Matrix'}

|  | ${isPolish ? 'Niski nakład' : 'Low Effort'} | ${isPolish ? 'Wysoki nakład' : 'High Effort'} |
|--|--------------|---------------|
| **${isPolish ? 'Wysoka wartość' : 'High Value'}** | 🌟 QUICK WINS | 🎯 ${isPolish ? 'STRATEGICZNE' : 'STRATEGIC'} |
| **${isPolish ? 'Niska wartość' : 'Low Value'}** | ✅ FILL-INS | ⏳ ${isPolish ? 'NISKI PRIORYTET' : 'LOW PRIORITY'} |

### ${isPolish ? 'Quick Wins' : 'Quick Wins'}
*${isPolish ? 'Inicjatywy o niskim nakładzie i szybkim efekcie - do zidentyfikowania na podstawie szczegółowej analizy.' : 'Low effort, quick impact initiatives - to be identified based on detailed analysis.'}*

### ${isPolish ? 'Inicjatywy Strategiczne' : 'Strategic Initiatives'}
*${isPolish ? 'Inicjatywy wymagające większych nakładów ale o wysokiej wartości biznesowej.' : 'Initiatives requiring larger investments but with high business value.'}*`;
    }

    generateRoadmap(assessment, isPolish) {
        const { axisData } = assessment;

        // Create phases based on gaps
        const phases = [
            { 
                name: isPolish ? 'Fundamenty' : 'Foundation', 
                period: '0-6', 
                focus: isPolish ? 'Dane, governance, cyberbezpieczeństwo' : 'Data, governance, cybersecurity',
                axes: ['dataManagement', 'cybersecurity']
            },
            { 
                name: 'Quick Wins', 
                period: '3-9', 
                focus: isPolish ? 'Procesy, automatyzacja, kultura' : 'Processes, automation, culture',
                axes: ['processes', 'culture']
            },
            { 
                name: isPolish ? 'Strategiczne' : 'Strategic', 
                period: '6-18', 
                focus: isPolish ? 'Produkty cyfrowe, modele biznesowe' : 'Digital products, business models',
                axes: ['digitalProducts', 'businessModels']
            },
            { 
                name: isPolish ? 'Integracja AI' : 'AI Integration', 
                period: '12-24', 
                focus: isPolish ? 'AI we wszystkich osiach' : 'AI across all axes',
                axes: ['aiMaturity']
            }
        ];

        const phaseRows = phases.map((phase, i) => 
            `| ${i + 1} | ${phase.name} | ${phase.period} ${isPolish ? 'mies.' : 'mo.'} | ${phase.focus} |`
        ).join('\n');

        // Calculate total transformation time based on gaps
        let maxTime = 0;
        Object.entries(axisData || {}).forEach(([id, data]) => {
            const gap = (data?.target || 0) - (data?.actual || 0);
            if (gap > 0) {
                maxTime = Math.max(maxTime, gap * 4);
            }
        });

        return `## ${isPolish ? 'Roadmapa Transformacji' : 'Transformation Roadmap'}

### ${isPolish ? 'Przegląd Faz' : 'Phase Overview'}

| # | ${isPolish ? 'Faza' : 'Phase'} | ${isPolish ? 'Okres' : 'Period'} | ${isPolish ? 'Fokus' : 'Focus'} |
|---|------|--------|-------|
${phaseRows}

### ${isPolish ? 'Szacowany czas transformacji' : 'Estimated Transformation Time'}
**${maxTime || 12} ${isPolish ? 'miesięcy' : 'months'}** ${isPolish ? '(przy założeniu równoległej realizacji niektórych inicjatyw)' : '(assuming parallel execution of some initiatives)'}

### ${isPolish ? 'Timeline' : 'Timeline'}

\`\`\`
${isPolish ? 'Miesiące' : 'Months'}:  0    3    6    9    12   15   18   21   24
           |    |    |    |    |    |    |    |    |
Faza 1:    [=========]
Faza 2:         [==========]
Faza 3:              [================]
Faza 4:                        [===============]
\`\`\`

### ${isPolish ? 'Kamienie milowe' : 'Milestones'}
1. **Q1:** ${isPolish ? 'Zakończenie audytu i zatwierdzenie roadmapy' : 'Audit completion and roadmap approval'}
2. **Q2:** ${isPolish ? 'Wdrożenie fundamentów danych' : 'Data foundations implementation'}
3. **Q3:** ${isPolish ? 'Pierwsze quick wins zrealizowane' : 'First quick wins delivered'}
4. **Q4:** ${isPolish ? 'Przegląd postępów i aktualizacja planu' : 'Progress review and plan update'}

### ${isPolish ? 'Diagram Gantta' : 'Gantt Chart'}
*${isPolish ? 'Szczegółowy diagram Gantta zostanie wygenerowany w eksporcie PDF.' : 'Detailed Gantt chart will be generated in PDF export.'}*`;
    }

    generateAppendix(assessment, isPolish) {
        return `## ${isPolish ? 'Załączniki' : 'Appendix'}

### A. ${isPolish ? 'Pełne Macierze Ocen' : 'Full Assessment Matrices'}
${isPolish ? 'Szczegółowe tabele ocen dla wszystkich 7 osi i ponad 30 obszarów są dostępne w eksporcie Excel.' : 'Detailed assessment tables for all 7 axes and over 30 areas are available in Excel export.'}

### B. ${isPolish ? 'Zespół Audytowy' : 'Audit Team'}
| ${isPolish ? 'Rola' : 'Role'} | ${isPolish ? 'Imię i nazwisko' : 'Name'} |
|------|------|
| ${isPolish ? 'Lead Auditor' : 'Lead Auditor'} | *${isPolish ? 'Do uzupełnienia' : 'To be completed'}* |
| ${isPolish ? 'Ekspert branżowy' : 'Industry Expert'} | *${isPolish ? 'Do uzupełnienia' : 'To be completed'}* |

### C. ${isPolish ? 'Lista Wywiadów' : 'Interview List'}
*${isPolish ? 'Lista osób, z którymi przeprowadzono wywiady podczas audytu.' : 'List of individuals interviewed during the audit.'}*

### D. ${isPolish ? 'Przeanalizowane Dokumenty' : 'Analyzed Documents'}
*${isPolish ? 'Lista dokumentów źródłowych wykorzystanych w analizie.' : 'List of source documents used in analysis.'}*

### E. ${isPolish ? 'Słownik Pojęć DRD' : 'DRD Glossary'}

| ${isPolish ? 'Termin' : 'Term'} | ${isPolish ? 'Definicja' : 'Definition'} |
|-------|-----------|
| DRD | Digital Readiness Diagnosis - ${isPolish ? 'Diagnoza Gotowości Cyfrowej' : 'Digital Maturity Assessment'} |
| ${isPolish ? 'Oś' : 'Axis'} | ${isPolish ? 'Główny wymiar oceny dojrzałości' : 'Main dimension of maturity assessment'} |
| ${isPolish ? 'Obszar' : 'Area'} | ${isPolish ? 'Szczegółowy element w ramach osi' : 'Detailed element within an axis'} |
| ${isPolish ? 'Luka' : 'Gap'} | ${isPolish ? 'Różnica między stanem aktualnym a docelowym' : 'Difference between current and target state'} |
| Pathway | ${isPolish ? 'Ścieżka dojścia do poziomu docelowego' : 'Path to reach target level'} |

### F. ${isPolish ? 'Bibliografia' : 'References'}
- Wisniewski, P. (2024). *Digital Pathfinder*. ${isPolish ? 'Książka o metodologii DRD.' : 'Book on DRD methodology.'}
- VDA 6.3 Process Audit Standard
- SIRI - Smart Industry Readiness Index (Singapore EDB)`;
    }

    // =========================================================================
    // ENTERPRISE-GRADE SECTION GENERATORS
    // =========================================================================

    generateMaturityOverviewEnterprise(assessment, isPolish) {
        const { axisData, transformationContext } = assessment;
        const metrics = this.calculateOverallMetrics(axisData);
        const industry = transformationContext?.industry || 'manufacturing';

        // Create radar chart data representation
        const axisScores = Object.entries(DRD_AXES).map(([id, config]) => {
            const data = axisData[id] || {};
            return {
                name: isPolish ? config.namePl : config.name,
                icon: config.icon || '',
                actual: data.actual || 0,
                target: data.target || 0,
                max: config.maxLevel
            };
        });

        return `
<div class="maturity-overview">
    <h2>📊 ${isPolish ? 'Przegląd Dojrzałości Cyfrowej' : 'Digital Maturity Overview'}</h2>
    
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 24px 0;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 24px; border-radius: 12px; color: white; text-align: center;">
            <div style="font-size: 48px; font-weight: 700;">${metrics.averageActual}</div>
            <div style="font-size: 14px; opacity: 0.9;">${isPolish ? 'Średni poziom aktualny' : 'Average Current Level'}</div>
            <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">/ 7 max</div>
        </div>
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 12px; color: white; text-align: center;">
            <div style="font-size: 48px; font-weight: 700;">${metrics.averageTarget}</div>
            <div style="font-size: 14px; opacity: 0.9;">${isPolish ? 'Średni poziom docelowy' : 'Average Target Level'}</div>
            <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">/ 7 max</div>
        </div>
        <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 24px; border-radius: 12px; color: white; text-align: center;">
            <div style="font-size: 48px; font-weight: 700;">${metrics.averageGap}</div>
            <div style="font-size: 14px; opacity: 0.9;">${isPolish ? 'Średnia luka' : 'Average Gap'}</div>
            <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">${isPolish ? 'poziomów' : 'levels'}</div>
        </div>
    </div>

    <h3>${isPolish ? 'Macierz Dojrzałości 7 Osi' : '7 Axes Maturity Matrix'}</h3>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
        <thead>
            <tr style="background: linear-gradient(135deg, #1e1b4b, #312e81); color: white;">
                <th style="padding: 14px; text-align: left; border: 1px solid #374151;">#</th>
                <th style="padding: 14px; text-align: left; border: 1px solid #374151;">${isPolish ? 'Oś Transformacji' : 'Transformation Axis'}</th>
                <th style="padding: 14px; text-align: center; border: 1px solid #374151; width: 80px;">${isPolish ? 'Aktualny' : 'Current'}</th>
                <th style="padding: 14px; text-align: center; border: 1px solid #374151; width: 80px;">${isPolish ? 'Docelowy' : 'Target'}</th>
                <th style="padding: 14px; text-align: center; border: 1px solid #374151; width: 80px;">${isPolish ? 'Luka' : 'Gap'}</th>
                <th style="padding: 14px; text-align: center; border: 1px solid #374151; width: 100px;">${isPolish ? 'Priorytet' : 'Priority'}</th>
                <th style="padding: 14px; text-align: left; border: 1px solid #374151; width: 250px;">${isPolish ? 'Wizualizacja' : 'Visualization'}</th>
            </tr>
        </thead>
        <tbody>
            ${axisScores.map((axis, i) => {
                const gap = axis.target - axis.actual;
                const priorityColor = gap >= 3 ? '#ef4444' : gap >= 2 ? '#f59e0b' : gap > 0 ? '#10b981' : '#94a3b8';
                const priorityText = gap >= 3 ? (isPolish ? 'WYSOKI' : 'HIGH') : gap >= 2 ? (isPolish ? 'ŚREDNI' : 'MEDIUM') : gap > 0 ? (isPolish ? 'NISKI' : 'LOW') : '-';
                const actualWidth = (axis.actual / axis.max) * 100;
                const targetPos = (axis.target / axis.max) * 100;

                return `
                    <tr style="background: ${i % 2 === 0 ? '#f8f9fa' : 'white'};">
                        <td style="padding: 14px; border: 1px solid #e5e7eb; font-weight: 700; color: #3b82f6;">${i + 1}</td>
                        <td style="padding: 14px; border: 1px solid #e5e7eb;">
                            <span style="margin-right: 8px; font-size: 18px;">${axis.icon}</span>
                            <strong>${axis.name}</strong>
                        </td>
                        <td style="padding: 14px; border: 1px solid #e5e7eb; text-align: center; font-size: 20px; font-weight: 700; color: #3b82f6;">${axis.actual}</td>
                        <td style="padding: 14px; border: 1px solid #e5e7eb; text-align: center; font-size: 20px; font-weight: 700; color: #10b981;">${axis.target}</td>
                        <td style="padding: 14px; border: 1px solid #e5e7eb; text-align: center;">
                            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; background: ${gap > 0 ? '#fef2f2' : '#ecfdf5'}; color: ${gap > 0 ? '#991b1b' : '#065f46'}; font-weight: 700;">
                                ${gap > 0 ? '+' : ''}${gap}
                            </span>
                        </td>
                        <td style="padding: 14px; border: 1px solid #e5e7eb; text-align: center;">
                            <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; background: ${priorityColor}; color: white; font-size: 11px; font-weight: 700;">
                                ${priorityText}
                            </span>
                        </td>
                        <td style="padding: 14px; border: 1px solid #e5e7eb;">
                            <div style="position: relative; height: 24px; background: #e5e7eb; border-radius: 12px; overflow: hidden;">
                                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${actualWidth}%; background: linear-gradient(90deg, #3b82f6, #60a5fa); border-radius: 12px;"></div>
                                <div style="position: absolute; left: ${targetPos}%; top: 2px; bottom: 2px; width: 3px; background: #10b981; border-radius: 2px;"></div>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    </table>

    <h3>${isPolish ? 'Interpretacja wyników' : 'Results Interpretation'}</h3>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0;">
        <div style="padding: 16px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
            <strong style="color: #991b1b;">🔴 ${isPolish ? 'Wysoki priorytet' : 'High Priority'}</strong>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #7f1d1d;">${isPolish ? 'Luka ≥3 poziomów. Wymaga natychmiastowej uwagi i dedykowanych zasobów. Ryzyko dla transformacji.' : 'Gap ≥3 levels. Requires immediate attention and dedicated resources. Transformation risk.'}</p>
        </div>
        <div style="padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <strong style="color: #92400e;">🟡 ${isPolish ? 'Średni priorytet' : 'Medium Priority'}</strong>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #78350f;">${isPolish ? 'Luka 2 poziomów. Planowane działania w ciągu 6-12 miesięcy. Ważne dla osiągnięcia celów.' : 'Gap of 2 levels. Planned actions within 6-12 months. Important for achieving goals.'}</p>
        </div>
        <div style="padding: 16px; background: #ecfdf5; border-radius: 8px; border-left: 4px solid #10b981;">
            <strong style="color: #065f46;">🟢 ${isPolish ? 'Niski priorytet / Cel osiągnięty' : 'Low Priority / Target Achieved'}</strong>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #064e3b;">${isPolish ? 'Luka ≤1 poziom lub cel osiągnięty. Ciągłe doskonalenie i utrzymanie.' : 'Gap ≤1 level or target achieved. Continuous improvement and maintenance.'}</p>
        </div>
    </div>

    <h3>${isPolish ? 'Kluczowe wnioski' : 'Key Takeaways'}</h3>
    <ul style="margin: 16px 0; padding-left: 20px; line-height: 1.8;">
        <li>${isPolish ? `Organizacja osiągnęła średni poziom dojrzałości <strong>${metrics.averageActual}/7</strong>, co plasuje ją w górnej połowie skali.` : `Organization achieved average maturity level of <strong>${metrics.averageActual}/7</strong>, placing it in the upper half of the scale.`}</li>
        <li>${isPolish ? `Do osiągnięcia stanu docelowego (<strong>${metrics.averageTarget}/7</strong>) wymagane jest zamknięcie luki ${metrics.averageGap} poziomów.` : `Reaching target state (<strong>${metrics.averageTarget}/7</strong>) requires closing a gap of ${metrics.averageGap} levels.`}</li>
        <li>${isPolish ? `${metrics.axesAssessed} z 7 osi zostało ocenionych w ramach audytu.` : `${metrics.axesAssessed} out of 7 axes were assessed in the audit.`}</li>
    </ul>
</div>`;
    }

    generateInitiativesEnterprise(assessment, isPolish) {
        const { axisData } = assessment;
        
        // Generate initiatives based on gaps with detailed descriptions
        const initiatives = [];
        Object.entries(DRD_AXES).forEach(([id, config]) => {
            const data = axisData[id] || {};
            const gap = (data.target || 0) - (data.actual || 0);
            if (gap > 0) {
                initiatives.push({
                    axis: isPolish ? config.namePl : config.name,
                    axisId: id,
                    icon: config.icon || '',
                    actual: data.actual,
                    target: data.target,
                    gap,
                    priority: gap >= 3 ? 'Critical' : gap >= 2 ? 'High' : 'Medium',
                    initiative: isPolish 
                        ? `Program podniesienia dojrzałości ${config.namePl} z poziomu ${data.actual} do ${data.target}`
                        : `${config.name} maturity improvement program from level ${data.actual} to ${data.target}`,
                    timeframe: `${gap * 3}-${gap * 4}`,
                    effort: gap >= 3 ? 'Major' : gap >= 2 ? 'Significant' : 'Moderate',
                    budget: gap >= 3 ? '500K-1M PLN' : gap >= 2 ? '200K-500K PLN' : '50K-200K PLN',
                    team: gap >= 3 ? '5-10 FTE' : gap >= 2 ? '3-5 FTE' : '1-3 FTE'
                });
            }
        });

        initiatives.sort((a, b) => b.gap - a.gap);

        // Group by priority
        const critical = initiatives.filter(i => i.priority === 'Critical');
        const high = initiatives.filter(i => i.priority === 'High');
        const medium = initiatives.filter(i => i.priority === 'Medium');

        return `
<div class="initiatives-section">
    <h2>🚀 ${isPolish ? 'Rekomendowane Inicjatywy Transformacyjne' : 'Recommended Transformation Initiatives'}</h2>
    
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 20px; border-radius: 12px; margin: 20px 0;">
        <p style="margin: 0; font-size: 15px; line-height: 1.7;">
            ${isPolish 
                ? `Na podstawie przeprowadzonej diagnozy DRD zidentyfikowaliśmy <strong>${initiatives.length} inicjatyw transformacyjnych</strong>, które pozwolą zamknąć luki między stanem obecnym a docelowym. Poniżej prezentujemy szczegółową analizę każdej inicjatywy wraz z szacowanymi zasobami i harmonogramem.`
                : `Based on the DRD diagnosis, we identified <strong>${initiatives.length} transformation initiatives</strong> that will close the gaps between current and target state. Below is a detailed analysis of each initiative with estimated resources and timeline.`}
        </p>
    </div>

    ${critical.length > 0 ? `
        <h3>🔴 ${isPolish ? 'Inicjatywy Krytyczne' : 'Critical Initiatives'}</h3>
        <p style="color: #991b1b; font-size: 14px;">${isPolish ? 'Wymagają natychmiastowego działania - luka ≥3 poziomów' : 'Require immediate action - gap ≥3 levels'}</p>
        ${this.renderInitiativeCards(critical, isPolish)}
    ` : ''}

    ${high.length > 0 ? `
        <h3>🟡 ${isPolish ? 'Inicjatywy Priorytetowe' : 'Priority Initiatives'}</h3>
        <p style="color: #92400e; font-size: 14px;">${isPolish ? 'Do realizacji w ciągu 6-12 miesięcy - luka 2 poziomów' : 'To be implemented within 6-12 months - gap of 2 levels'}</p>
        ${this.renderInitiativeCards(high, isPolish)}
    ` : ''}

    ${medium.length > 0 ? `
        <h3>🟢 ${isPolish ? 'Inicjatywy Rozwojowe' : 'Development Initiatives'}</h3>
        <p style="color: #065f46; font-size: 14px;">${isPolish ? 'Ciągłe doskonalenie - luka 1 poziomu' : 'Continuous improvement - gap of 1 level'}</p>
        ${this.renderInitiativeCards(medium, isPolish)}
    ` : ''}

    <h3>📊 ${isPolish ? 'Podsumowanie zasobów' : 'Resource Summary'}</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
            <tr style="background: #f1f5f9;">
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">${isPolish ? 'Kategoria' : 'Category'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">${isPolish ? 'Krytyczne' : 'Critical'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">${isPolish ? 'Priorytetowe' : 'Priority'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">${isPolish ? 'Rozwojowe' : 'Development'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700;">${isPolish ? 'RAZEM' : 'TOTAL'}</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Liczba inicjatyw' : 'Number of initiatives'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${critical.length}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${high.length}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${medium.length}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center; font-weight: 700;">${initiatives.length}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Szacowany czas' : 'Estimated time'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">9-12 ${isPolish ? 'mies.' : 'mo.'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">6-8 ${isPolish ? 'mies.' : 'mo.'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">3-4 ${isPolish ? 'mies.' : 'mo.'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center; font-weight: 700;">12-18 ${isPolish ? 'mies.' : 'mo.'}</td>
            </tr>
        </tbody>
    </table>

    <h3>💡 ${isPolish ? 'Rekomendacje wdrożeniowe' : 'Implementation Recommendations'}</h3>
    <ol style="margin: 16px 0; padding-left: 20px; line-height: 1.8;">
        <li>${isPolish ? '<strong>Powołanie PMO transformacji</strong> - dedykowany zespół zarządzający programem z jasno określonymi rolami i odpowiedzialnościami.' : '<strong>Establish Transformation PMO</strong> - dedicated team managing the program with clearly defined roles and responsibilities.'}</li>
        <li>${isPolish ? '<strong>Quick wins first</strong> - rozpoczęcie od inicjatyw o niskim nakładzie i szybkim efekcie dla budowania momentum.' : '<strong>Quick wins first</strong> - start with low-effort, quick-impact initiatives to build momentum.'}</li>
        <li>${isPolish ? '<strong>Fazowe wdrażanie</strong> - realizacja inicjatyw w falach z regularnymi checkpointami co 3 miesiące.' : '<strong>Phased implementation</strong> - execute initiatives in waves with regular 3-month checkpoints.'}</li>
        <li>${isPolish ? '<strong>Zarządzanie zmianą</strong> - kompleksowy program komunikacji i szkoleniowy dla pracowników.' : '<strong>Change management</strong> - comprehensive communication and training program for employees.'}</li>
    </ol>
</div>`;
    }

    renderInitiativeCards(initiatives, isPolish) {
        return `
            <div style="display: grid; gap: 16px; margin: 16px 0;">
                ${initiatives.map(init => `
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; border-left: 4px solid ${init.priority === 'Critical' ? '#ef4444' : init.priority === 'High' ? '#f59e0b' : '#10b981'};">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div>
                                <h4 style="margin: 0; font-size: 16px;">
                                    <span style="margin-right: 8px;">${init.icon}</span>
                                    ${init.initiative}
                                </h4>
                                <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">${init.axis}</p>
                            </div>
                            <span style="padding: 4px 12px; border-radius: 12px; background: ${init.priority === 'Critical' ? '#fef2f2' : init.priority === 'High' ? '#fef3c7' : '#ecfdf5'}; color: ${init.priority === 'Critical' ? '#991b1b' : init.priority === 'High' ? '#92400e' : '#065f46'}; font-size: 12px; font-weight: 600;">
                                ${init.priority}
                            </span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                            <div>
                                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">${isPolish ? 'Luka' : 'Gap'}</div>
                                <div style="font-size: 18px; font-weight: 700; color: #1e293b;">+${init.gap}</div>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">${isPolish ? 'Czas' : 'Time'}</div>
                                <div style="font-size: 18px; font-weight: 700; color: #1e293b;">${init.timeframe} ${isPolish ? 'mies.' : 'mo.'}</div>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">${isPolish ? 'Budżet' : 'Budget'}</div>
                                <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${init.budget}</div>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">${isPolish ? 'Zespół' : 'Team'}</div>
                                <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${init.team}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    generateRoadmapEnterprise(assessment, isPolish) {
        const { axisData } = assessment;
        
        // Calculate total transformation time
        let maxGap = 0;
        Object.values(axisData || {}).forEach(data => {
            const gap = (data?.target || 0) - (data?.actual || 0);
            if (gap > maxGap) maxGap = gap;
        });
        
        const totalMonths = Math.max(12, maxGap * 4);

        return `
<div class="roadmap-section">
    <h2>🗺️ ${isPolish ? 'Roadmapa Transformacji Cyfrowej' : 'Digital Transformation Roadmap'}</h2>
    
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 20px; border-radius: 12px; margin: 20px 0;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
            <div>
                <div style="font-size: 36px; font-weight: 700;">${totalMonths}</div>
                <div style="font-size: 13px; opacity: 0.8;">${isPolish ? 'Miesięcy do transformacji' : 'Months to Transformation'}</div>
            </div>
            <div>
                <div style="font-size: 36px; font-weight: 700;">4</div>
                <div style="font-size: 13px; opacity: 0.8;">${isPolish ? 'Fazy wdrożenia' : 'Implementation Phases'}</div>
            </div>
            <div>
                <div style="font-size: 36px; font-weight: 700;">7</div>
                <div style="font-size: 13px; opacity: 0.8;">${isPolish ? 'Osi do transformacji' : 'Axes to Transform'}</div>
            </div>
        </div>
    </div>

    <h3>${isPolish ? 'Fazy Transformacji' : 'Transformation Phases'}</h3>
    
    <div style="position: relative; margin: 40px 0;">
        <!-- Timeline base -->
        <div style="position: absolute; left: 40px; right: 40px; top: 60px; height: 4px; background: #e5e7eb; border-radius: 2px;"></div>
        
        <!-- Phases -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; position: relative;">
            <div style="text-align: center;">
                <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="font-size: 11px; opacity: 0.8;">FAZA 1</div>
                    <div style="font-weight: 700;">${isPolish ? 'Fundamenty' : 'Foundation'}</div>
                    <div style="font-size: 12px; opacity: 0.8;">0-6 ${isPolish ? 'mies.' : 'mo.'}</div>
                </div>
                <div style="width: 20px; height: 20px; background: #ef4444; border-radius: 50%; margin: 0 auto; border: 4px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
                <div style="font-size: 12px; color: #64748b; margin-top: 12px;">
                    ${isPolish ? 'Dane, governance, cyberbezpieczeństwo' : 'Data, governance, cybersecurity'}
                </div>
            </div>
            <div style="text-align: center;">
                <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="font-size: 11px; opacity: 0.8;">FAZA 2</div>
                    <div style="font-weight: 700;">Quick Wins</div>
                    <div style="font-size: 12px; opacity: 0.8;">3-9 ${isPolish ? 'mies.' : 'mo.'}</div>
                </div>
                <div style="width: 20px; height: 20px; background: #f59e0b; border-radius: 50%; margin: 0 auto; border: 4px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
                <div style="font-size: 12px; color: #64748b; margin-top: 12px;">
                    ${isPolish ? 'Procesy, automatyzacja, kultura' : 'Processes, automation, culture'}
                </div>
            </div>
            <div style="text-align: center;">
                <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="font-size: 11px; opacity: 0.8;">FAZA 3</div>
                    <div style="font-weight: 700;">${isPolish ? 'Strategiczne' : 'Strategic'}</div>
                    <div style="font-size: 12px; opacity: 0.8;">6-18 ${isPolish ? 'mies.' : 'mo.'}</div>
                </div>
                <div style="width: 20px; height: 20px; background: #3b82f6; border-radius: 50%; margin: 0 auto; border: 4px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
                <div style="font-size: 12px; color: #64748b; margin-top: 12px;">
                    ${isPolish ? 'Produkty cyfrowe, modele biznesowe' : 'Digital products, business models'}
                </div>
            </div>
            <div style="text-align: center;">
                <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="font-size: 11px; opacity: 0.8;">FAZA 4</div>
                    <div style="font-weight: 700;">${isPolish ? 'Integracja AI' : 'AI Integration'}</div>
                    <div style="font-size: 12px; opacity: 0.8;">12-24 ${isPolish ? 'mies.' : 'mo.'}</div>
                </div>
                <div style="width: 20px; height: 20px; background: #10b981; border-radius: 50%; margin: 0 auto; border: 4px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
                <div style="font-size: 12px; color: #64748b; margin-top: 12px;">
                    ${isPolish ? 'AI we wszystkich osiach' : 'AI across all axes'}
                </div>
            </div>
        </div>
    </div>

    <h3>📅 ${isPolish ? 'Diagram Gantta' : 'Gantt Chart'}</h3>
    <div style="overflow-x: auto; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; min-width: 800px;">
            <thead>
                <tr style="background: #1e1b4b; color: white;">
                    <th style="padding: 12px; text-align: left; border: 1px solid #374151; width: 200px;">${isPolish ? 'Faza / Inicjatywa' : 'Phase / Initiative'}</th>
                    ${Array.from({length: 8}, (_, i) => `<th style="padding: 8px; text-align: center; border: 1px solid #374151; width: 60px;">Q${Math.floor(i/2)+1}${i%2 === 0 ? 'a' : 'b'}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                <tr style="background: #fef2f2;">
                    <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">🔴 ${isPolish ? 'Faza 1: Fundamenty' : 'Phase 1: Foundation'}</td>
                    <td colspan="2" style="background: #ef4444; border: 1px solid #e5e7eb;"></td>
                    <td colspan="6" style="border: 1px solid #e5e7eb;"></td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e5e7eb; padding-left: 24px;">📊 ${isPolish ? 'Zarządzanie Danymi' : 'Data Management'}</td>
                    <td colspan="2" style="background: #fca5a5; border: 1px solid #e5e7eb;"></td>
                    <td colspan="6" style="border: 1px solid #e5e7eb;"></td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e5e7eb; padding-left: 24px;">🔒 ${isPolish ? 'Cyberbezpieczeństwo' : 'Cybersecurity'}</td>
                    <td colspan="2" style="background: #fca5a5; border: 1px solid #e5e7eb;"></td>
                    <td colspan="6" style="border: 1px solid #e5e7eb;"></td>
                </tr>
                <tr style="background: #fef3c7;">
                    <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">🟡 ${isPolish ? 'Faza 2: Quick Wins' : 'Phase 2: Quick Wins'}</td>
                    <td style="border: 1px solid #e5e7eb;"></td>
                    <td colspan="3" style="background: #f59e0b; border: 1px solid #e5e7eb;"></td>
                    <td colspan="4" style="border: 1px solid #e5e7eb;"></td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e5e7eb; padding-left: 24px;">⚙️ ${isPolish ? 'Procesy Cyfrowe' : 'Digital Processes'}</td>
                    <td style="border: 1px solid #e5e7eb;"></td>
                    <td colspan="3" style="background: #fcd34d; border: 1px solid #e5e7eb;"></td>
                    <td colspan="4" style="border: 1px solid #e5e7eb;"></td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e5e7eb; padding-left: 24px;">🎯 ${isPolish ? 'Kultura Transformacji' : 'Culture'}</td>
                    <td style="border: 1px solid #e5e7eb;"></td>
                    <td colspan="3" style="background: #fcd34d; border: 1px solid #e5e7eb;"></td>
                    <td colspan="4" style="border: 1px solid #e5e7eb;"></td>
                </tr>
                <tr style="background: #dbeafe;">
                    <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">🔵 ${isPolish ? 'Faza 3: Strategiczne' : 'Phase 3: Strategic'}</td>
                    <td colspan="2" style="border: 1px solid #e5e7eb;"></td>
                    <td colspan="4" style="background: #3b82f6; border: 1px solid #e5e7eb;"></td>
                    <td colspan="2" style="border: 1px solid #e5e7eb;"></td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e5e7eb; padding-left: 24px;">📦 ${isPolish ? 'Produkty Cyfrowe' : 'Digital Products'}</td>
                    <td colspan="2" style="border: 1px solid #e5e7eb;"></td>
                    <td colspan="4" style="background: #93c5fd; border: 1px solid #e5e7eb;"></td>
                    <td colspan="2" style="border: 1px solid #e5e7eb;"></td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e5e7eb; padding-left: 24px;">💼 ${isPolish ? 'Modele Biznesowe' : 'Business Models'}</td>
                    <td colspan="2" style="border: 1px solid #e5e7eb;"></td>
                    <td colspan="4" style="background: #93c5fd; border: 1px solid #e5e7eb;"></td>
                    <td colspan="2" style="border: 1px solid #e5e7eb;"></td>
                </tr>
                <tr style="background: #ecfdf5;">
                    <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">🟢 ${isPolish ? 'Faza 4: Integracja AI' : 'Phase 4: AI Integration'}</td>
                    <td colspan="4" style="border: 1px solid #e5e7eb;"></td>
                    <td colspan="4" style="background: #10b981; border: 1px solid #e5e7eb;"></td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e5e7eb; padding-left: 24px;">🤖 ${isPolish ? 'Dojrzałość AI' : 'AI Maturity'}</td>
                    <td colspan="4" style="border: 1px solid #e5e7eb;"></td>
                    <td colspan="4" style="background: #6ee7b7; border: 1px solid #e5e7eb;"></td>
                </tr>
            </tbody>
        </table>
    </div>

    <h3>🏁 ${isPolish ? 'Kamienie Milowe' : 'Milestones'}</h3>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0;">
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444;">
            <strong>Q1:</strong> ${isPolish ? 'Zakończenie audytu i zatwierdzenie roadmapy przez Zarząd' : 'Audit completion and roadmap approval by Board'}
        </div>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <strong>Q2:</strong> ${isPolish ? 'Wdrożenie fundamentów danych i cyberbezpieczeństwa' : 'Data and cybersecurity foundations implemented'}
        </div>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <strong>Q3:</strong> ${isPolish ? 'Pierwsze quick wins dostarczone i zmierzone' : 'First quick wins delivered and measured'}
        </div>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
            <strong>Q4:</strong> ${isPolish ? 'Przegląd postępów i aktualizacja planu' : 'Progress review and plan update'}
        </div>
    </div>

    <h3>⚠️ ${isPolish ? 'Czynniki Ryzyka' : 'Risk Factors'}</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
            <tr style="background: #f1f5f9;">
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">${isPolish ? 'Ryzyko' : 'Risk'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">${isPolish ? 'Prawdop.' : 'Prob.'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">${isPolish ? 'Wpływ' : 'Impact'}</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">${isPolish ? 'Mitygacja' : 'Mitigation'}</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Opór przed zmianą' : 'Resistance to change'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">🟡 ${isPolish ? 'Średnie' : 'Medium'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">🔴 ${isPolish ? 'Wysokie' : 'High'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Program zarządzania zmianą, komunikacja, szkolenia' : 'Change management program, communication, training'}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Niedobór kompetencji' : 'Skill shortage'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">🔴 ${isPolish ? 'Wysokie' : 'High'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">🟡 ${isPolish ? 'Średnie' : 'Medium'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Partnerzy zewnętrzni, program rozwoju talentów' : 'External partners, talent development program'}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Ograniczenia budżetowe' : 'Budget constraints'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">🟡 ${isPolish ? 'Średnie' : 'Medium'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">🟡 ${isPolish ? 'Średnie' : 'Medium'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Fazowanie inwestycji, szybkie ROI' : 'Phased investments, quick ROI'}</td>
            </tr>
        </tbody>
    </table>
</div>`;
    }

    generateAppendixEnterprise(assessment, isPolish) {
        const { organization_name, project_name } = assessment;
        const date = new Date().toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        return `
<div class="appendix-section">
    <h2>📎 ${isPolish ? 'Załączniki' : 'Appendix'}</h2>

    <h3>A. ${isPolish ? 'Metodyka Zbierania Danych' : 'Data Collection Methodology'}</h3>
    <div style="margin: 16px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
        <p style="margin: 0 0 12px 0;">${isPolish ? 'Diagnoza DRD została przeprowadzona z wykorzystaniem następujących metod:' : 'DRD diagnosis was conducted using the following methods:'}</p>
        <ul style="margin: 0; padding-left: 20px;">
            <li>${isPolish ? 'Wywiady strukturyzowane z kluczowymi interesariuszami (min. 2h na oś)' : 'Structured interviews with key stakeholders (min. 2h per axis)'}</li>
            <li>${isPolish ? 'Analiza dokumentacji operacyjnej i strategicznej' : 'Analysis of operational and strategic documentation'}</li>
            <li>${isPolish ? 'Obserwacja procesów w miejscu pracy (gemba walk)' : 'Workplace observation (gemba walk)'}</li>
            <li>${isPolish ? 'Przegląd systemów IT i infrastruktury' : 'Review of IT systems and infrastructure'}</li>
            <li>${isPolish ? 'Benchmark z danymi branżowymi' : 'Benchmark against industry data'}</li>
        </ul>
    </div>

    <h3>B. ${isPolish ? 'Zespół Audytowy' : 'Audit Team'}</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
            <tr style="background: #f1f5f9;">
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">${isPolish ? 'Rola' : 'Role'}</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">${isPolish ? 'Imię i nazwisko' : 'Name'}</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">${isPolish ? 'Kwalifikacje' : 'Qualifications'}</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">Lead Auditor</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;"><em>${isPolish ? 'Do uzupełnienia' : 'To be completed'}</em></td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">DRD Certified, 10+ lat doświadczenia</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Ekspert branżowy' : 'Industry Expert'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;"><em>${isPolish ? 'Do uzupełnienia' : 'To be completed'}</em></td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Specjalista branżowy' : 'Industry specialist'}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Ekspert IT' : 'IT Expert'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;"><em>${isPolish ? 'Do uzupełnienia' : 'To be completed'}</em></td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">Enterprise Architecture, Cloud, AI/ML</td>
            </tr>
        </tbody>
    </table>

    <h3>C. ${isPolish ? 'Lista Rozmówców' : 'Interviewee List'}</h3>
    <div style="margin: 16px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
        <p style="margin: 0; font-style: italic; color: #64748b;">
            ${isPolish 
                ? 'Lista osób, z którymi przeprowadzono wywiady podczas audytu. Szczegółowe notatki z wywiadów przechowywane są w systemie DRD i dostępne na żądanie.'
                : 'List of individuals interviewed during the audit. Detailed interview notes are stored in the DRD system and available upon request.'}
        </p>
    </div>

    <h3>D. ${isPolish ? 'Przeanalizowane Dokumenty' : 'Analyzed Documents'}</h3>
    <ul style="margin: 16px 0; padding-left: 20px; line-height: 1.8;">
        <li>${isPolish ? 'Strategia cyfrowa organizacji (jeśli dostępna)' : 'Organization digital strategy (if available)'}</li>
        <li>${isPolish ? 'Architektura IT i mapa systemów' : 'IT architecture and system map'}</li>
        <li>${isPolish ? 'Procesy operacyjne i dokumentacja SOP' : 'Operational processes and SOP documentation'}</li>
        <li>${isPolish ? 'Polityki bezpieczeństwa informacji' : 'Information security policies'}</li>
        <li>${isPolish ? 'Raporty z poprzednich audytów (jeśli dostępne)' : 'Previous audit reports (if available)'}</li>
    </ul>

    <h3>E. ${isPolish ? 'Słownik Pojęć DRD' : 'DRD Glossary'}</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
        <thead>
            <tr style="background: #1e1b4b; color: white;">
                <th style="padding: 12px; text-align: left; border: 1px solid #374151; width: 150px;">${isPolish ? 'Termin' : 'Term'}</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #374151;">${isPolish ? 'Definicja' : 'Definition'}</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">DRD</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">Digital Readiness Diagnosis - ${isPolish ? 'Kompleksowa metodologia oceny dojrzałości cyfrowej organizacji' : 'Comprehensive methodology for assessing organizational digital maturity'}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">${isPolish ? 'Oś' : 'Axis'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Jeden z 7 głównych wymiarów oceny dojrzałości cyfrowej' : 'One of 7 main dimensions of digital maturity assessment'}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">${isPolish ? 'Obszar' : 'Area'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Szczegółowy element oceny w ramach osi (oznaczony np. 1A, 1B)' : 'Detailed assessment element within an axis (e.g., 1A, 1B)'}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">${isPolish ? 'Luka' : 'Gap'}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Różnica między poziomem aktualnym a docelowym dojrzałości' : 'Difference between current and target maturity level'}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Pathway</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Ścieżka działań prowadząca do osiągnięcia poziomu docelowego' : 'Action path leading to target level achievement'}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">SIRI</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">Smart Industry Readiness Index - ${isPolish ? 'singapurski standard oceny gotowości przemysłu' : 'Singapore standard for industry readiness assessment'}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Quick Win</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${isPolish ? 'Inicjatywa o niskim nakładzie i szybkim efekcie biznesowym' : 'Low-effort initiative with quick business impact'}</td>
            </tr>
        </tbody>
    </table>

    <h3>F. ${isPolish ? 'Bibliografia i Standardy' : 'References and Standards'}</h3>
    <ul style="margin: 16px 0; padding-left: 20px; line-height: 1.8;">
        <li>Wisniewski, P. (2024). <em>Digital Pathfinder</em>. ${isPolish ? 'Kompleksowy przewodnik po transformacji cyfrowej.' : 'Comprehensive guide to digital transformation.'}</li>
        <li>VDA 6.3 Process Audit Standard (2023). German Association of the Automotive Industry.</li>
        <li>SIRI - Smart Industry Readiness Index. Singapore Economic Development Board (2024).</li>
        <li>Industry 4.0 Maturity Index. acatech - National Academy of Science and Engineering (2023).</li>
        <li>Digital Transformation Compass. McKinsey & Company (2024).</li>
    </ul>

    <div style="margin-top: 40px; padding: 20px; background: #f1f5f9; border-radius: 8px; text-align: center;">
        <p style="margin: 0; font-size: 13px; color: #64748b;">
            ${isPolish 
                ? `Raport wygenerowany: ${date} | Wersja: 1.0 | Status: Draft`
                : `Report generated: ${date} | Version: 1.0 | Status: Draft`}
        </p>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">
            ${isPolish ? 'POUFNE - Wyłącznie do użytku wewnętrznego' : 'CONFIDENTIAL - For internal use only'}
        </p>
    </div>
</div>`;
    }
}

// Export singleton
module.exports = new ReportContentService();
module.exports.DRD_AXES = DRD_AXES;
module.exports.SECTION_TYPES = SECTION_TYPES;

