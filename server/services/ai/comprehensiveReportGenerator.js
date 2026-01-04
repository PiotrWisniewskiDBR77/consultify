/**
 * Comprehensive Report Generator
 * 
 * Orchestrates the generation of complete, executive-ready DRD assessment reports
 * by combining:
 * - Assessment data and gap analysis
 * - Company profile and industry context
 * - Web research (benchmarks, case studies, trends)
 * - AI-generated analysis and recommendations
 * 
 * Pipeline stages:
 * 1. GATHER CONTEXT - Load and enrich assessment data
 * 2. RESEARCH - Conduct web research for industry context
 * 3. ANALYZE - AI analysis of gaps with context
 * 4. GENERATE - Create comprehensive report sections
 * 5. REFINE - Consistency check and final synthesis
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { contextBuilder, INDUSTRY_PROFILES, DRD_AXES } from './aiContext.js';
import { webResearchService } from './webResearchService.js';
import { memoryManager } from './memoryManager.js';
import db from '../../database.js';

// Report section definitions
const REPORT_SECTIONS = {
    coverPage: { order: 1, aiGenerated: false },
    executiveSummary: { order: 2, aiGenerated: true, maxTokens: 2000 },
    methodology: { order: 3, aiGenerated: false },
    maturityOverview: { order: 4, aiGenerated: true, maxTokens: 1500 },
    axisAnalysis: { order: 5, aiGenerated: true, maxTokens: 3000, perAxis: true },
    gapAnalysis: { order: 6, aiGenerated: true, maxTokens: 2000 },
    initiatives: { order: 7, aiGenerated: true, maxTokens: 4000 },
    roadmap: { order: 8, aiGenerated: true, maxTokens: 2000 },
    riskRegister: { order: 9, aiGenerated: true, maxTokens: 1500 },
    appendix: { order: 10, aiGenerated: false }
};

// Comprehensive prompts for each section type
const SECTION_PROMPTS = {
    executiveSummary: `# ROLE: Senior Partner at McKinsey/BCG writing for the Board

You are creating the Executive Summary for a Digital Readiness Diagnosis (DRD) report.
This is the MOST IMPORTANT section - it will be read by C-level executives and Board members.

## CONTEXT
{context}

## ASSESSMENT DATA
{assessmentData}

## INDUSTRY BENCHMARKS (from research)
{industryBenchmarks}

## REQUIREMENTS

Write a compelling, insight-rich Executive Summary that:

1. **Opening Hook** (2-3 sentences)
   - State the organization's digital maturity position clearly
   - Compare to industry benchmark
   - Create urgency or confidence depending on position

2. **Key Findings** (bullet points)
   - 3-4 most critical insights from the assessment
   - Each with specific data points
   - "So what" implication for each

3. **Strategic Priorities** (numbered, 3 items)
   - Prioritized areas requiring action
   - Expected impact if addressed
   - Risk if ignored

4. **Recommended Next Steps** (actionable)
   - Immediate actions (next 30 days)
   - Quick wins (next 90 days)
   - Strategic initiatives (next 12 months)

5. **Investment Perspective**
   - High-level budget indication
   - Expected ROI timeframe
   - Risk/reward assessment

## FORMAT
- Professional business Polish language
- Use data and percentages where available
- Be specific, not generic
- Maximum 800 words
- Use markdown formatting

## OUTPUT
Generate the Executive Summary section in Polish:`,

    axisAnalysis: `# ROLE: Digital Transformation Expert analyzing a specific maturity axis

You are writing the detailed analysis for the "{axisName}" axis of a DRD assessment.
This section must be COMPREHENSIVE and ACTIONABLE.

## CONTEXT
{context}

## AXIS DATA
Current Score: {currentScore}/{maxLevel}
Target Score: {targetScore}/{maxLevel}
Gap: {gap} levels
Justification from Assessment: {justification}

## INDUSTRY RESEARCH
{industryResearch}

## LEADER PRACTICES
{leaderPractices}

## CASE STUDIES
{caseStudies}

## REQUIREMENTS

Write a comprehensive axis analysis that includes:

1. **Current State Diagnosis** (3-4 paragraphs)
   - What the current score means in practical terms
   - Specific capabilities present at this level
   - Gaps compared to higher levels
   - Connect to organization's specific context

2. **Industry Positioning** (with data)
   - How organization compares to industry benchmark
   - Position: Leader / Above Average / Average / Below Average / Laggard
   - Specific statistics from research

3. **What Leaders Do Differently** (real examples)
   - 2-3 specific examples from industry leaders
   - Concrete practices and technologies they use
   - Results they achieve

4. **Transformation Pathway** (step by step)
   - From current level to target level
   - For each level transition:
     - Key actions required
     - Expected timeline
     - Investment indication
     - Critical success factors

5. **Recommendations** (prioritized)
   - 3-5 specific, actionable recommendations
   - Each with:
     - What to do
     - Why it matters
     - Expected impact
     - Owner/responsible role
     - Timeline

6. **KPIs to Monitor**
   - 3-4 key metrics for this axis
   - Current baseline (if known)
   - Target values
   - Measurement frequency

7. **Risks and Dependencies**
   - Key risks in transformation
   - Dependencies on other axes
   - Mitigation strategies

## FORMAT
- Professional business Polish language
- Rich in specific details and examples
- Use tables where appropriate
- Use markdown formatting
- 1200-1500 words

## OUTPUT
Generate the complete axis analysis in Polish:`,

    initiatives: `# ROLE: Program Director designing transformation initiatives

You are creating the Initiatives section of a DRD report.
These initiatives must be COMPREHENSIVE, FEASIBLE, and IMPACTFUL.

## CONTEXT
{context}

## GAP ANALYSIS
{gapAnalysis}

## INDUSTRY CONTEXT
{industryContext}

## CASE STUDIES & BENCHMARKS
{researchData}

## REQUIREMENTS

Design 5-7 strategic initiatives to close the identified gaps. For each initiative:

1. **Initiative Card**
   - Name (action-oriented)
   - Strategic objective
   - Primary axis addressed
   - Secondary axes impacted

2. **Description** (2-3 paragraphs)
   - What the initiative involves
   - Why it's needed (link to gap)
   - Expected outcomes

3. **Scope and Deliverables**
   - Key deliverables (5-7 items)
   - Out of scope (clarity)

4. **Implementation Approach**
   - High-level phases
   - Key milestones
   - Dependencies

5. **Resource Requirements**
   - Team composition (FTEs)
   - Technology/tools needed
   - External support needed

6. **Investment & ROI**
   - CAPEX estimate range
   - OPEX estimate range
   - Expected ROI (with assumptions)
   - Payback period

7. **Risk Assessment**
   - Top 3 risks
   - Mitigation strategies

8. **Success Criteria**
   - Measurable KPIs
   - Target values
   - Timeline

## PRIORITIZATION
After defining initiatives, create a prioritization matrix:
- Strategic Impact (High/Medium/Low)
- Implementation Complexity (High/Medium/Low)
- Quick Win potential

## FORMAT
- Use structured markdown with clear headers
- Include an initiative summary table
- Polish language
- 2000-2500 words total

## OUTPUT
Generate the complete initiatives section in Polish:`,

    roadmap: `# ROLE: Transformation Program Manager

Create a detailed transformation roadmap based on the initiatives.

## CONTEXT
{context}

## INITIATIVES
{initiatives}

## CONSTRAINTS
{constraints}

## REQUIREMENTS

Create a comprehensive 18-24 month roadmap:

1. **Phasing Overview**
   - Phase 1: Foundation (months 1-6)
   - Phase 2: Build (months 7-12)
   - Phase 3: Scale (months 13-18)
   - Phase 4: Optimize (months 19-24)

2. **For Each Phase**
   - Key initiatives active
   - Major milestones
   - Required investments
   - Expected outcomes

3. **Dependencies Map**
   - Initiative dependencies
   - Critical path
   - Parallel workstreams

4. **Governance Model**
   - Steering committee structure
   - Review cadence
   - Escalation paths
   - Success metrics

5. **Risk Timeline**
   - Key decision points
   - Risk windows
   - Contingency triggers

6. **Resource Loading**
   - Quarterly resource needs
   - Peak periods
   - External vs internal

## FORMAT
- Include visual timeline representation (text-based Gantt)
- Polish language
- Use tables for clarity
- 800-1000 words

## OUTPUT
Generate the roadmap section in Polish:`
};

class ComprehensiveReportGenerator {
    constructor() {
        this.genAI = null;
        this.model = null;
        this._initializeAI();
    }

    _initializeAI() {
        const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ 
                model: 'gemini-1.5-pro',
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.9,
                    maxOutputTokens: 4096
                }
            });
        }
    }

    /**
     * Generate a complete comprehensive report
     */
    async generateReport(assessmentId, options = {}) {
        const startTime = Date.now();
        const { language = 'pl', includeResearch = true, stakeholderRole = 'CEO' } = options;
        
        console.log(`[ComprehensiveReport] Starting generation for assessment ${assessmentId}`);
        
        try {
            // Stage 1: GATHER CONTEXT
            console.log('[ComprehensiveReport] Stage 1: Gathering context...');
            const context = await this._gatherContext(assessmentId);
            
            if (!context) {
                throw new Error('Failed to gather context - assessment not found');
            }
            
            // Stage 2: RESEARCH
            console.log('[ComprehensiveReport] Stage 2: Conducting research...');
            const research = includeResearch 
                ? await this._conductResearch(context)
                : this._getMinimalResearch(context);
            
            // Stage 3: ANALYZE
            console.log('[ComprehensiveReport] Stage 3: Analyzing gaps...');
            const analysis = await this._analyzeGaps(context, research);
            
            // Stage 4: GENERATE SECTIONS
            console.log('[ComprehensiveReport] Stage 4: Generating sections...');
            const sections = await this._generateAllSections(context, research, analysis, options);
            
            // Stage 5: REFINE
            console.log('[ComprehensiveReport] Stage 5: Refining report...');
            const finalReport = await this._refineReport(sections, context);
            
            const duration = Date.now() - startTime;
            console.log(`[ComprehensiveReport] Generation complete in ${duration}ms`);
            
            return {
                success: true,
                assessmentId,
                generatedAt: new Date().toISOString(),
                duration,
                language,
                sections: finalReport.sections,
                metadata: {
                    organizationName: context.company.name,
                    industry: context.industry.key,
                    averageMaturity: context.maturity.summary.averageMaturity,
                    totalGaps: context.gaps.totalGaps,
                    researchSources: research.sources || [],
                    aiModel: 'gemini-1.5-pro'
                }
            };
        } catch (error) {
            console.error('[ComprehensiveReport] Generation failed:', error);
            return {
                success: false,
                assessmentId,
                error: error.message,
                generatedAt: new Date().toISOString()
            };
        }
    }

    // =========================================================================
    // STAGE 1: GATHER CONTEXT
    // =========================================================================

    async _gatherContext(assessmentId) {
        try {
            const context = await contextBuilder.buildReportContext({ assessmentId });
            
            if (!context || !context.assessment) {
                console.error('[ComprehensiveReport] No context returned for assessment');
                return null;
            }
            
            return context;
        } catch (error) {
            console.error('[ComprehensiveReport] Context gathering error:', error);
            return null;
        }
    }

    // =========================================================================
    // STAGE 2: RESEARCH
    // =========================================================================

    async _conductResearch(context) {
        const industry = context.industry?.key || 'manufacturing';
        const assessmentData = context.maturity?.axes || [];
        
        // Convert axes to format expected by research service
        const axisData = {};
        assessmentData.forEach(axis => {
            axisData[axis.id] = {
                actual: axis.actual,
                target: axis.target
            };
        });
        
        try {
            const research = await webResearchService.conductFullResearch(industry, axisData);
            
            return {
                success: research.success,
                industryOverview: research.data?.industryOverview,
                benchmarks: research.data?.benchmarks || [],
                caseStudies: research.data?.caseStudies,
                trends: research.data?.trends,
                leaderPractices: research.data?.leaderPractices,
                sources: this._extractSources(research),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[ComprehensiveReport] Research error:', error);
            return this._getMinimalResearch(context);
        }
    }

    _getMinimalResearch(context) {
        const industry = context.industry?.key || 'manufacturing';
        const industryProfile = INDUSTRY_PROFILES[industry] || INDUSTRY_PROFILES.manufacturing;
        
        return {
            success: false,
            industryOverview: {
                summary: `Analysis based on ${industryProfile.name} industry profile.`,
                source: 'internal'
            },
            benchmarks: [],
            caseStudies: null,
            trends: { trends: industryProfile.keyTransformationAreas },
            leaderPractices: { leaders: [], practices: industryProfile.typicalChallenges },
            sources: ['Internal industry database'],
            timestamp: new Date().toISOString()
        };
    }

    _extractSources(research) {
        const sources = new Set();
        
        if (research.data?.benchmarks) {
            research.data.benchmarks.forEach(b => {
                if (b.citations) b.citations.forEach(c => sources.add(c.url || c.title || 'Unknown'));
            });
        }
        if (research.data?.caseStudies?.citations) {
            research.data.caseStudies.citations.forEach(c => sources.add(c.url || c.title || 'Unknown'));
        }
        
        return [...sources].slice(0, 10);
    }

    // =========================================================================
    // STAGE 3: ANALYZE
    // =========================================================================

    async _analyzeGaps(context, research) {
        const gaps = context.gaps;
        const positioning = context.positioning;
        
        // Enrich gaps with research data
        const enrichedGaps = gaps.allGaps.map(gap => {
            const benchmark = research.benchmarks?.find(b => b.axisId === gap.axis);
            
            return {
                ...gap,
                industryBenchmark: benchmark?.data || null,
                researchInsights: benchmark?.summary || null
            };
        });
        
        // AI-powered pattern detection
        const patterns = this._detectPatterns(enrichedGaps, context);
        
        return {
            enrichedGaps,
            positioning,
            patterns,
            strategicPriorities: this._determineStrategicPriorities(enrichedGaps, patterns),
            transformationScope: this._assessTransformationScope(gaps, positioning)
        };
    }

    _detectPatterns(gaps, context) {
        const patterns = [];
        
        // Pattern 1: Foundation gaps (data + cybersecurity)
        const foundationGaps = gaps.filter(g => 
            ['dataManagement', 'cybersecurity'].includes(g.axis) && g.gap >= 2
        );
        if (foundationGaps.length > 0) {
            patterns.push({
                type: 'FOUNDATION_WEAKNESS',
                severity: 'HIGH',
                description: 'Słabe fundamenty cyfrowe (dane i cyberbezpieczeństwo) mogą blokować transformację w innych obszarach.',
                recommendation: 'Priorytetyzuj wzmocnienie fundamentów przed zaawansowanymi inicjatywami.'
            });
        }
        
        // Pattern 2: AI without data
        const aiGap = gaps.find(g => g.axis === 'aiMaturity');
        const dataGap = gaps.find(g => g.axis === 'dataManagement');
        if (aiGap && dataGap && aiGap.current > dataGap.current + 1) {
            patterns.push({
                type: 'AI_DATA_MISMATCH',
                severity: 'MEDIUM',
                description: 'Ambicje AI przewyższają dojrzałość zarządzania danymi.',
                recommendation: 'Zrównoważ inwestycje w AI z rozwojem infrastruktury danych.'
            });
        }
        
        // Pattern 3: Culture lagging technology
        const cultureGap = gaps.find(g => g.axis === 'culture');
        const processGap = gaps.find(g => g.axis === 'processes');
        if (cultureGap && processGap && cultureGap.current < processGap.current - 1) {
            patterns.push({
                type: 'CULTURE_LAG',
                severity: 'HIGH',
                description: 'Kultura organizacyjna nie nadąża za digitalizacją procesów.',
                recommendation: 'Wzmocnij program zarządzania zmianą i rozwój kompetencji cyfrowych.'
            });
        }
        
        // Pattern 4: Ambitious targets
        const ambitiousGaps = gaps.filter(g => g.gap >= 4);
        if (ambitiousGaps.length >= 2) {
            patterns.push({
                type: 'OVERAMBITIOUS_TARGETS',
                severity: 'MEDIUM',
                description: `${ambitiousGaps.length} osi ma lukę ≥4 poziomów - bardzo ambitne cele.`,
                recommendation: 'Rozważ fazowanie celów z interim milestones co 12-18 miesięcy.'
            });
        }
        
        return patterns;
    }

    _determineStrategicPriorities(gaps, patterns) {
        const priorities = [];
        
        // Foundation first if pattern detected
        const foundationPattern = patterns.find(p => p.type === 'FOUNDATION_WEAKNESS');
        if (foundationPattern) {
            priorities.push({
                rank: 1,
                area: 'Fundamenty cyfrowe',
                axes: ['dataManagement', 'cybersecurity'],
                rationale: foundationPattern.description
            });
        }
        
        // Then largest gaps
        const topGaps = gaps
            .filter(g => !['dataManagement', 'cybersecurity'].includes(g.axis) || !foundationPattern)
            .slice(0, 3);
        
        topGaps.forEach((gap, index) => {
            priorities.push({
                rank: priorities.length + 1,
                area: gap.axisName,
                axes: [gap.axis],
                rationale: `Luka ${gap.gap} poziomów wymaga priorytetowego działania.`
            });
        });
        
        return priorities;
    }

    _assessTransformationScope(gaps, positioning) {
        const totalGap = gaps.totalGapPoints;
        const criticalCount = gaps.criticalGaps?.length || 0;
        
        if (totalGap <= 5 && criticalCount === 0) {
            return {
                scope: 'INCREMENTAL',
                description: 'Optymalizacja i ciągłe doskonalenie',
                typicalDuration: '6-12 miesięcy',
                effort: 'Niski do średniego'
            };
        } else if (totalGap <= 12 && criticalCount <= 1) {
            return {
                scope: 'TARGETED',
                description: 'Ukierunkowana transformacja w kluczowych obszarach',
                typicalDuration: '12-18 miesięcy',
                effort: 'Średni'
            };
        } else if (totalGap <= 20) {
            return {
                scope: 'COMPREHENSIVE',
                description: 'Kompleksowa transformacja cyfrowa',
                typicalDuration: '18-24 miesiące',
                effort: 'Znaczny'
            };
        } else {
            return {
                scope: 'FUNDAMENTAL',
                description: 'Fundamentalna przebudowa zdolności cyfrowych',
                typicalDuration: '24-36 miesięcy',
                effort: 'Bardzo wysoki'
            };
        }
    }

    // =========================================================================
    // STAGE 4: GENERATE SECTIONS
    // =========================================================================

    async _generateAllSections(context, research, analysis, options) {
        const sections = {};
        const { language = 'pl' } = options;
        
        // Generate static sections
        sections.coverPage = this._generateCoverPage(context, language);
        sections.methodology = this._generateMethodology(language);
        sections.appendix = this._generateAppendix(context, research, language);
        
        // Generate AI sections
        sections.executiveSummary = await this._generateAISection(
            'executiveSummary',
            context, research, analysis, options
        );
        
        sections.maturityOverview = await this._generateMaturityOverview(context, research, language);
        
        // Generate per-axis analysis
        sections.axisAnalyses = await this._generateAxisAnalyses(context, research, analysis, options);
        
        sections.gapAnalysis = await this._generateGapAnalysisSection(context, analysis, language);
        
        sections.initiatives = await this._generateAISection(
            'initiatives',
            context, research, analysis, options
        );
        
        sections.roadmap = await this._generateAISection(
            'roadmap',
            context, research, analysis, options
        );
        
        sections.riskRegister = await this._generateRiskRegister(context, analysis, language);
        
        return sections;
    }

    async _generateAISection(sectionType, context, research, analysis, options) {
        if (!this.model) {
            return this._getFallbackSection(sectionType, context, analysis);
        }
        
        const promptTemplate = SECTION_PROMPTS[sectionType];
        if (!promptTemplate) {
            return { error: 'Unknown section type', content: '' };
        }
        
        const prompt = this._buildPrompt(promptTemplate, {
            context: this._formatContextForPrompt(context),
            assessmentData: this._formatAssessmentForPrompt(context),
            industryBenchmarks: this._formatBenchmarksForPrompt(research),
            gapAnalysis: this._formatGapsForPrompt(analysis),
            industryContext: this._formatIndustryForPrompt(context, research),
            researchData: this._formatResearchForPrompt(research),
            initiatives: analysis.strategicPriorities || [],
            constraints: context.company?.constraints || {}
        });
        
        try {
            const result = await this.model.generateContent(prompt);
            const content = result.response.text();
            
            return {
                type: sectionType,
                content,
                generatedAt: new Date().toISOString(),
                aiGenerated: true
            };
        } catch (error) {
            console.error(`[ComprehensiveReport] AI generation error for ${sectionType}:`, error);
            return this._getFallbackSection(sectionType, context, analysis);
        }
    }

    async _generateAxisAnalyses(context, research, analysis, options) {
        const axes = context.maturity?.axes || [];
        const analyses = [];
        
        for (const axis of axes) {
            if (axis.actual === 0) continue; // Skip unassessed axes
            
            const axisResearch = research.benchmarks?.find(b => b.axisId === axis.id);
            const leaderPractices = research.leaderPractices;
            const caseStudies = research.caseStudies;
            
            const prompt = this._buildAxisPrompt(axis, context, axisResearch, leaderPractices, caseStudies);
            
            try {
                if (this.model) {
                    const result = await this.model.generateContent(prompt);
                    analyses.push({
                        axisId: axis.id,
                        axisName: axis.namePl,
                        content: result.response.text(),
                        generatedAt: new Date().toISOString(),
                        aiGenerated: true
                    });
                } else {
                    analyses.push(this._getFallbackAxisAnalysis(axis, context));
                }
            } catch (error) {
                console.error(`[ComprehensiveReport] Axis analysis error for ${axis.id}:`, error);
                analyses.push(this._getFallbackAxisAnalysis(axis, context));
            }
            
            // Small delay between axes to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return analyses;
    }

    _buildAxisPrompt(axis, context, axisResearch, leaderPractices, caseStudies) {
        const template = SECTION_PROMPTS.axisAnalysis;
        
        return template
            .replace('{axisName}', axis.namePl)
            .replace('{context}', this._formatContextForPrompt(context))
            .replace('{currentScore}', axis.actual)
            .replace('{maxLevel}', axis.maxLevel)
            .replace('{targetScore}', axis.target)
            .replace('{gap}', axis.gap)
            .replace('{justification}', axis.justification || 'Brak uzasadnienia w danych źródłowych.')
            .replace('{industryResearch}', axisResearch?.summary || 'Brak dostępnych danych z badań.')
            .replace('{leaderPractices}', JSON.stringify(leaderPractices?.practices || [], null, 2))
            .replace('{caseStudies}', JSON.stringify(caseStudies?.caseStudies || caseStudies?.summary || 'Brak case studies.', null, 2));
    }

    // =========================================================================
    // HELPER SECTIONS
    // =========================================================================

    _generateCoverPage(context, language) {
        const date = new Date().toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        
        return {
            type: 'coverPage',
            content: {
                title: language === 'pl' ? 'Raport Diagnozy Gotowości Cyfrowej (DRD)' : 'Digital Readiness Diagnosis Report',
                subtitle: language === 'pl' ? 'Kompleksowa Analiza Dojrzałości Cyfrowej' : 'Comprehensive Digital Maturity Analysis',
                organizationName: context.company?.name || 'Organizacja',
                projectName: context.assessment?.name || 'Assessment',
                date,
                version: '1.0',
                confidential: true
            },
            generatedAt: new Date().toISOString(),
            aiGenerated: false
        };
    }

    _generateMethodology(language) {
        return {
            type: 'methodology',
            content: language === 'pl' 
                ? this._getPolishMethodology()
                : this._getEnglishMethodology(),
            generatedAt: new Date().toISOString(),
            aiGenerated: false
        };
    }

    _getPolishMethodology() {
        return `# Metodologia DRD

## Digital Readiness Diagnosis (DRD)

DRD to kompleksowa metodologia oceny dojrzałości cyfrowej organizacji, opracowana w oparciu o:
- Standard SIRI (Smart Industry Readiness Index) Singapore EDB
- Filozofię audytu VDA 6.3
- Najlepsze praktyki transformacji cyfrowej

## 7 Osi Transformacji

| # | Oś | Skala | Opis |
|---|-----|-------|------|
| 1 | Procesy Cyfrowe | 1-7 | Digitalizacja i automatyzacja procesów operacyjnych |
| 2 | Produkty Cyfrowe | 1-5 | Cyfrowe produkty i usługi |
| 3 | Modele Biznesowe | 1-5 | Innowacyjne modele generowania wartości |
| 4 | Zarządzanie Danymi | 1-7 | Strategia danych i analityka |
| 5 | Kultura Transformacji | 1-5 | Gotowość organizacji do zmian |
| 6 | Cyberbezpieczeństwo | 1-5 | Ochrona zasobów cyfrowych |
| 7 | Dojrzałość AI | 1-5 | Wykorzystanie sztucznej inteligencji |

## Zasady Oceny

1. **Zasada ostrożności** - W razie wątpliwości wybierz niższy poziom
2. **Dowody** - Każda ocena poparta konkretnymi dowodami
3. **Kontekst** - Uwzględnienie specyfiki branży i organizacji`;
    }

    _getEnglishMethodology() {
        return `# DRD Methodology

## Digital Readiness Diagnosis (DRD)

DRD is a comprehensive methodology for assessing organizational digital maturity, based on:
- SIRI (Smart Industry Readiness Index) by Singapore EDB
- VDA 6.3 audit philosophy
- Digital transformation best practices

## 7 Transformation Axes

| # | Axis | Scale | Description |
|---|------|-------|-------------|
| 1 | Digital Processes | 1-7 | Digitization and automation of operational processes |
| 2 | Digital Products | 1-5 | Digital products and services |
| 3 | Business Models | 1-5 | Innovative value generation models |
| 4 | Data Management | 1-7 | Data strategy and analytics |
| 5 | Culture | 1-5 | Organizational readiness for change |
| 6 | Cybersecurity | 1-5 | Digital asset protection |
| 7 | AI Maturity | 1-5 | Artificial intelligence utilization |`;
    }

    async _generateMaturityOverview(context, research, language) {
        const axes = context.maturity?.axes || [];
        const summary = context.maturity?.summary || {};
        
        const axisTable = axes.map(a => ({
            name: a.namePl,
            actual: a.actual,
            target: a.target,
            gap: a.gap,
            priority: a.gap >= 3 ? 'WYSOKI' : a.gap >= 2 ? 'ŚREDNI' : a.gap > 0 ? 'NISKI' : '-'
        }));
        
        return {
            type: 'maturityOverview',
            content: {
                summary: {
                    averageMaturity: summary.averageMaturity,
                    averageTarget: summary.averageTarget,
                    averageGap: summary.averageGap,
                    axesAssessed: summary.axesAssessed
                },
                axisTable,
                highlights: context.maturity?.highlights,
                industryComparison: {
                    benchmark: context.industry?.averageMaturity?.global,
                    position: context.positioning?.positioning,
                    positionLabel: context.positioning?.positioningLabel
                }
            },
            generatedAt: new Date().toISOString(),
            aiGenerated: false
        };
    }

    async _generateGapAnalysisSection(context, analysis, language) {
        return {
            type: 'gapAnalysis',
            content: {
                totalGaps: analysis.enrichedGaps.length,
                transformationScope: analysis.transformationScope,
                patterns: analysis.patterns,
                strategicPriorities: analysis.strategicPriorities,
                gapDetails: analysis.enrichedGaps.map(g => ({
                    axis: g.axisName,
                    current: g.current,
                    target: g.target,
                    gap: g.gap,
                    priority: g.priority,
                    estimatedMonths: g.estimatedMonths,
                    complexity: g.complexity
                }))
            },
            generatedAt: new Date().toISOString(),
            aiGenerated: false
        };
    }

    async _generateRiskRegister(context, analysis, language) {
        const risks = [];
        
        // Generate risks based on patterns
        analysis.patterns.forEach(pattern => {
            risks.push({
                category: 'Transformacyjne',
                risk: pattern.description,
                probability: pattern.severity === 'HIGH' ? 'Wysoka' : 'Średnia',
                impact: 'Wysoki',
                mitigation: pattern.recommendation
            });
        });
        
        // Add standard transformation risks
        const standardRisks = [
            { category: 'Organizacyjne', risk: 'Opór przed zmianą wśród pracowników', probability: 'Wysoka', impact: 'Wysoki', mitigation: 'Program zarządzania zmianą, komunikacja, quick wins' },
            { category: 'Techniczne', risk: 'Integracja z systemami legacy', probability: 'Średnia', impact: 'Wysoki', mitigation: 'API-first approach, etapowa migracja' },
            { category: 'Zasobowe', risk: 'Niedobór kompetencji cyfrowych', probability: 'Wysoka', impact: 'Średni', mitigation: 'Szkolenia, partnerzy zewnętrzni, rekrutacja' },
            { category: 'Budżetowe', risk: 'Przekroczenie budżetu transformacji', probability: 'Średnia', impact: 'Średni', mitigation: 'Fazowanie, MVP approach, regularne przeglądy' }
        ];
        
        return {
            type: 'riskRegister',
            content: {
                risks: [...risks, ...standardRisks].slice(0, 10),
                riskSummary: {
                    total: risks.length + standardRisks.length,
                    highProbability: risks.filter(r => r.probability === 'Wysoka').length + 2,
                    highImpact: risks.filter(r => r.impact === 'Wysoki').length + 2
                }
            },
            generatedAt: new Date().toISOString(),
            aiGenerated: false
        };
    }

    _generateAppendix(context, research, language) {
        return {
            type: 'appendix',
            content: {
                dataSources: research.sources || ['Internal assessment data'],
                methodology: 'DRD v2.0',
                assessmentDate: context.assessment?.completedAt || new Date().toISOString(),
                reportGeneratedAt: new Date().toISOString(),
                glossary: this._getGlossary(language)
            },
            generatedAt: new Date().toISOString(),
            aiGenerated: false
        };
    }

    _getGlossary(language) {
        return [
            { term: 'DRD', definition: 'Digital Readiness Diagnosis - Diagnoza Gotowości Cyfrowej' },
            { term: 'Oś', definition: 'Główny wymiar oceny dojrzałości cyfrowej' },
            { term: 'Luka', definition: 'Różnica między stanem aktualnym a docelowym' },
            { term: 'Quick Win', definition: 'Inicjatywa o niskim nakładzie i szybkim efekcie' },
            { term: 'Pathway', definition: 'Ścieżka transformacji od obecnego do docelowego poziomu' }
        ];
    }

    // =========================================================================
    // STAGE 5: REFINE
    // =========================================================================

    async _refineReport(sections, context) {
        // Compile all sections in order
        const orderedSections = [
            sections.coverPage,
            sections.executiveSummary,
            sections.methodology,
            sections.maturityOverview,
            ...(sections.axisAnalyses || []),
            sections.gapAnalysis,
            sections.initiatives,
            sections.roadmap,
            sections.riskRegister,
            sections.appendix
        ].filter(Boolean);
        
        // Add section numbers and table of contents
        const tableOfContents = orderedSections.map((section, index) => ({
            number: index + 1,
            title: this._getSectionTitle(section.type || section.axisName),
            type: section.type || 'axisAnalysis'
        }));
        
        return {
            tableOfContents,
            sections: orderedSections,
            metadata: {
                totalSections: orderedSections.length,
                aiGeneratedSections: orderedSections.filter(s => s.aiGenerated).length,
                generatedAt: new Date().toISOString()
            }
        };
    }

    _getSectionTitle(type) {
        const titles = {
            coverPage: 'Strona Tytułowa',
            executiveSummary: 'Streszczenie Wykonawcze',
            methodology: 'Metodologia DRD',
            maturityOverview: 'Przegląd Dojrzałości',
            axisAnalysis: 'Analiza Osi',
            gapAnalysis: 'Analiza Luk',
            initiatives: 'Inicjatywy Transformacyjne',
            roadmap: 'Roadmapa Transformacji',
            riskRegister: 'Rejestr Ryzyk',
            appendix: 'Załączniki'
        };
        return titles[type] || type;
    }

    // =========================================================================
    // FALLBACKS
    // =========================================================================

    _getFallbackSection(sectionType, context, analysis) {
        return {
            type: sectionType,
            content: `[Sekcja ${sectionType} - wymaga ręcznego uzupełnienia lub połączenia z AI]`,
            generatedAt: new Date().toISOString(),
            aiGenerated: false,
            fallback: true
        };
    }

    _getFallbackAxisAnalysis(axis, context) {
        return {
            axisId: axis.id,
            axisName: axis.namePl,
            content: `# ${axis.namePl}\n\n**Poziom aktualny:** ${axis.actual}/${axis.maxLevel}\n**Poziom docelowy:** ${axis.target}/${axis.maxLevel}\n**Luka:** ${axis.gap} poziomów\n\n*Szczegółowa analiza wymaga uzupełnienia.*`,
            generatedAt: new Date().toISOString(),
            aiGenerated: false,
            fallback: true
        };
    }

    // =========================================================================
    // PROMPT HELPERS
    // =========================================================================

    _buildPrompt(template, data) {
        let prompt = template;
        for (const [key, value] of Object.entries(data)) {
            const placeholder = `{${key}}`;
            const replacement = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
            prompt = prompt.replace(new RegExp(placeholder, 'g'), replacement);
        }
        return prompt;
    }

    _formatContextForPrompt(context) {
        return `Organizacja: ${context.company?.name || 'Nieznana'}
Branża: ${context.industry?.namePl || context.industry?.name || 'Nieznana'}
Wielkość: ${context.company?.sizeProfile?.range || 'Nieznana'} pracowników
Lokalizacja: ${context.company?.location || 'Polska'}
Średnia dojrzałość: ${context.maturity?.summary?.averageMaturity || 'N/A'}/7
Cel średni: ${context.maturity?.summary?.averageTarget || 'N/A'}/7
Pozycja vs branża: ${context.positioning?.positioningLabel || 'Nieznana'}`;
    }

    _formatAssessmentForPrompt(context) {
        const axes = context.maturity?.axes || [];
        return axes.map(a => 
            `- ${a.namePl}: ${a.actual}/${a.maxLevel} (cel: ${a.target}, luka: ${a.gap})`
        ).join('\n');
    }

    _formatBenchmarksForPrompt(research) {
        if (!research.benchmarks || research.benchmarks.length === 0) {
            return 'Brak dostępnych benchmarków z badań.';
        }
        
        return research.benchmarks.map(b => 
            `${b.axisId}: ${b.summary || 'Brak szczegółów'}`
        ).join('\n\n');
    }

    _formatGapsForPrompt(analysis) {
        const gaps = analysis.enrichedGaps || [];
        return gaps.map(g => 
            `- ${g.axisName}: luka ${g.gap} poziomów (${g.current} → ${g.target}), priorytet: ${g.priority}`
        ).join('\n');
    }

    _formatIndustryForPrompt(context, research) {
        const industry = context.industry || {};
        return `Branża: ${industry.namePl || industry.name || 'Nieznana'}
Średnia branżowa: ${industry.averageMaturity?.global || 'N/A'}
Liderzy branży: ${industry.averageMaturity?.leader || 'N/A'}
Kluczowe trendy: ${(research.trends?.trends || industry.keyTransformationAreas || []).join(', ')}`;
    }

    _formatResearchForPrompt(research) {
        const parts = [];
        
        if (research.industryOverview?.summary) {
            parts.push(`Przegląd branży: ${research.industryOverview.summary}`);
        }
        
        if (research.caseStudies?.summary) {
            parts.push(`Case studies: ${research.caseStudies.summary}`);
        }
        
        if (research.leaderPractices?.practices) {
            parts.push(`Praktyki liderów: ${research.leaderPractices.practices.join('; ')}`);
        }
        
        return parts.join('\n\n') || 'Brak dodatkowych danych z badań.';
    }

    /**
     * Get generator status
     */
    getStatus() {
        return {
            aiAvailable: !!this.model,
            supportedSections: Object.keys(REPORT_SECTIONS),
            webResearchStatus: webResearchService.getStatus()
        };
    }
}

// Export singleton
const comprehensiveReportGenerator = new ComprehensiveReportGenerator();

export {
ComprehensiveReportGenerator,
    comprehensiveReportGenerator,
    REPORT_SECTIONS
};

export default {
    ComprehensiveReportGenerator,
    comprehensiveReportGenerator,
    REPORT_SECTIONS
};

