#!/usr/bin/env node
/**
 * Premium DRD Report Generator
 * Generates 4 BCG/McKinsey-style reports from assessment data
 */

const fs = require('fs');
const path = require('path');
const enterpriseTemplates = require('../server/services/enterpriseReportTemplates');
const { DRD_AXES, INDUSTRY_BENCHMARKS } = enterpriseTemplates;

// Sample assessment data (from database: Cyfryzacja Produkcji Q4 2024)
const ASSESSMENT_DATA = {
    id: '04606ec2-b921-4d3e-a49e-7ef4672eb159',
    project_id: 'f5dfa222-a9c9-4b20-a881-4fa0d1fffce7',
    organization_name: 'DBR77 Manufacturing',
    project_name: 'Cyfryzacja Produkcji Q4 2024',
    industry: 'manufacturing',
    transformationContext: {
        industry: 'manufacturing',
        companySize: 'medium',
        region: 'Poland'
    },
    axisData: {
        processes: {
            actual: 4,
            target: 6,
            justification: "Procesy produkcyjne są w dużej mierze zautomatyzowane. System MES zintegrowany z ERP. Planowanie produkcji wspierane przez APS. Monitoring OEE w czasie rzeczywistym na 80% linii."
        },
        digitalProducts: {
            actual: 2,
            target: 4,
            justification: "Produkty fizyczne bez komponentów cyfrowych. Brak IoT w produktach końcowych. Dokumentacja techniczna nadal w formie papierowej. Portal klienta oferuje tylko podstawowe funkcje."
        },
        businessModels: {
            actual: 3,
            target: 5,
            justification: "Model biznesowy oparty na tradycyjnej sprzedaży produktów. Rozpoczęto transformację w kierunku modelu subskrypcyjnego dla części zamiennych. Brak przychodów z usług cyfrowych."
        },
        dataManagement: {
            actual: 3,
            target: 5,
            justification: "Dane produkcyjne zbierane z systemów SCADA i MES. Data Lake wdrożony, ale wykorzystanie analityczne ograniczone. Brak zaawansowanych dashboardów dla kierownictwa."
        },
        culture: {
            actual: 3,
            target: 5,
            justification: "Kultura produkcyjna nastawiona na efektywność operacyjną. Opór przed zmianami wśród starszych pracowników. Program szkoleń cyfrowych w fazie pilotażu."
        },
        cybersecurity: {
            actual: 5,
            target: 6,
            justification: "Dojrzały program bezpieczeństwa OT/IT. Segmentacja sieci przemysłowej. SOC działający 24/7. Regularne audyty bezpieczeństwa i testy penetracyjne."
        },
        aiMaturity: {
            actual: 1,
            target: 3,
            justification: "Brak wdrożonych rozwiązań AI/ML w produkcji. Dane historyczne dostępne, ale nieprzetworzone. Zespół nie posiada kompetencji Data Science."
        }
    }
};

// HTML wrapper with professional styling
function wrapInHtml(content, title) {
    return `<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background: #f8fafc;
        }
        
        .report-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px;
            background: white;
            min-height: 100vh;
        }
        
        h1, h2, h3, h4 {
            color: #1e293b;
            margin-bottom: 1rem;
        }
        
        h1 { font-size: 2.5rem; font-weight: 800; }
        h2 { font-size: 1.75rem; font-weight: 700; margin-top: 2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
        h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; }
        
        p { margin-bottom: 1rem; }
        
        ul, ol {
            margin-left: 1.5rem;
            margin-bottom: 1rem;
        }
        
        li { margin-bottom: 0.5rem; }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border: 1px solid #e5e7eb;
        }
        
        th {
            background: #1e1b4b;
            color: white;
            font-weight: 600;
        }
        
        .page-break {
            page-break-before: always;
            margin-top: 40px;
        }
        
        @media print {
            body { background: white; }
            .report-container { padding: 20px; max-width: 100%; }
            .page-break { page-break-before: always; }
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #64748b; }
    </style>
</head>
<body>
    <div class="report-container">
        ${content}
    </div>
</body>
</html>`;
}

// ============================================================
// REPORT 1: EXECUTIVE SUMMARY
// ============================================================
function generateExecutiveSummaryReport(assessment) {
    console.log('📊 Generating Executive Summary Report...');
    
    const coverPage = enterpriseTemplates.generateCoverPage(assessment, true);
    const executiveSummary = enterpriseTemplates.generateExecutiveSummary(assessment, true);
    
    const content = `
        ${coverPage}
        <div class="page-break"></div>
        ${executiveSummary}
        
        <div class="page-break"></div>
        <h2>📌 Następne Kroki</h2>
        <div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); padding: 24px; border-radius: 12px; margin: 20px 0;">
            <ol style="font-size: 16px; line-height: 2;">
                <li><strong>Warsztaty strategiczne (Tydzień 1-2):</strong> Prezentacja wyników dla zarządu i ustalenie priorytetów transformacji</li>
                <li><strong>Szczegółowa roadmapa (Tydzień 3-4):</strong> Opracowanie planu wdrożenia dla 3 priorytetowych osi</li>
                <li><strong>Quick wins (Miesiąc 1-3):</strong> Realizacja inicjatyw o najkrótszym czasie zwrotu</li>
                <li><strong>Program transformacji (Miesiąc 4+):</strong> Uruchomienie pełnego programu z dedykowanym PMO</li>
            </ol>
        </div>
        
        <div style="margin-top: 40px; padding: 20px; background: #f1f5f9; border-radius: 8px; text-align: center;">
            <p style="color: #64748b; font-size: 13px; margin: 0;">
                Raport wygenerowany przez <strong>Consultify AI</strong> | Metodologia DRD v2.0<br>
                © ${new Date().getFullYear()} DBR77 Manufacturing - Dokument poufny
            </p>
        </div>
    `;
    
    return wrapInHtml(content, 'Executive Summary - DRD Report');
}

// ============================================================
// REPORT 2: FULL ASSESSMENT (ALL AXES)
// ============================================================
function generateFullAssessmentReport(assessment) {
    console.log('📋 Generating Full Assessment Report...');
    
    const coverPage = enterpriseTemplates.generateCoverPage(assessment, true);
    const methodology = enterpriseTemplates.generateMethodology(true);
    
    // Generate all axis details
    const axisDetails = Object.keys(DRD_AXES).map(axisId => {
        return enterpriseTemplates.generateAxisDetail(axisId, assessment, true);
    }).join('');
    
    const content = `
        ${coverPage}
        
        <div class="page-break"></div>
        <h1 style="text-align: center; margin-bottom: 40px;">📖 Spis Treści</h1>
        <div style="max-width: 500px; margin: 0 auto; font-size: 16px;">
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                <span>1. Metodologia DRD</span>
                <span style="color: #64748b;">str. 3</span>
            </div>
            ${Object.values(DRD_AXES).map((axis, idx) => `
                <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span>${idx + 2}. ${axis.icon} ${axis.namePl}</span>
                    <span style="color: #64748b;">str. ${idx + 4}</span>
                </div>
            `).join('')}
        </div>
        
        <div class="page-break"></div>
        ${methodology}
        
        ${axisDetails}
        
        <div class="page-break"></div>
        <h2>📌 Podsumowanie i Rekomendacje</h2>
        <div style="background: linear-gradient(135deg, #1e1b4b, #312e81); color: white; padding: 32px; border-radius: 16px; margin: 20px 0;">
            <h3 style="color: white; margin-bottom: 20px;">🎯 Strategiczne priorytety transformacji</h3>
            <ol style="font-size: 16px; line-height: 2.2; padding-left: 24px;">
                <li><strong>AI Maturity (Priorytet #1):</strong> Budowa fundamentów dla AI w produkcji - rekrutacja Data Scientists, przygotowanie danych historycznych</li>
                <li><strong>Digital Products:</strong> IoT-yzacja produktów końcowych, rozbudowa portalu klienta</li>
                <li><strong>Data Management:</strong> Wdrożenie zaawansowanej analityki, dashboardy real-time dla kierownictwa</li>
                <li><strong>Business Models:</strong> Uruchomienie modelu subskrypcyjnego, monetyzacja danych serwisowych</li>
                <li><strong>Processes:</strong> Rozszerzenie monitoringu OEE na 100% linii, predykcyjne utrzymanie ruchu</li>
            </ol>
        </div>
        
        <div style="margin-top: 40px; padding: 20px; background: #f1f5f9; border-radius: 8px; text-align: center;">
            <p style="color: #64748b; font-size: 13px; margin: 0;">
                Pełny raport DRD | ${new Date().toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
                <strong>Consultify AI</strong> - Metodologia zgodna ze standardem SIRI
            </p>
        </div>
    `;
    
    return wrapInHtml(content, 'Full DRD Assessment Report');
}

// ============================================================
// REPORT 3: GAP ANALYSIS & TRANSFORMATION ROADMAP
// ============================================================
function generateGapAnalysisReport(assessment) {
    console.log('📉 Generating Gap Analysis & Roadmap Report...');
    
    const coverPage = enterpriseTemplates.generateCoverPage({
        ...assessment,
        project_name: 'Analiza Luk i Roadmapa Transformacji'
    }, true);
    
    const gapAnalysis = enterpriseTemplates.generateGapAnalysis(assessment, true);
    
    // Custom roadmap visualization
    const roadmapContent = generateCustomRoadmap(assessment);
    
    const content = `
        ${coverPage}
        
        <div class="page-break"></div>
        ${gapAnalysis}
        
        <div class="page-break"></div>
        <h2>🗺️ Roadmapa Transformacji</h2>
        ${roadmapContent}
        
        <div class="page-break"></div>
        <h2>💰 Szacunek Inwestycji i ROI</h2>
        ${generateInvestmentSummary(assessment)}
        
        <div class="page-break"></div>
        <h2>⚠️ Kluczowe Ryzyka Transformacji</h2>
        ${generateRiskMatrix(assessment)}
        
        <div style="margin-top: 40px; padding: 20px; background: #f1f5f9; border-radius: 8px; text-align: center;">
            <p style="color: #64748b; font-size: 13px; margin: 0;">
                Raport Gap Analysis & Roadmapa | ${new Date().toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
                <strong>Consultify AI</strong> - Strategic Transformation Planning
            </p>
        </div>
    `;
    
    return wrapInHtml(content, 'Gap Analysis & Transformation Roadmap');
}

function generateCustomRoadmap(assessment) {
    const { axisData } = assessment;
    const phases = [];
    
    // Sort by gap size
    const sortedAxes = Object.entries(axisData)
        .map(([id, data]) => ({
            id,
            name: DRD_AXES[id]?.namePl || id,
            icon: DRD_AXES[id]?.icon || '📊',
            color: DRD_AXES[id]?.color || '#3b82f6',
            gap: (data.target || 0) - (data.actual || 0),
            actual: data.actual,
            target: data.target
        }))
        .filter(a => a.gap > 0)
        .sort((a, b) => b.gap - a.gap);
    
    // Create timeline
    let currentMonth = 0;
    const timeline = sortedAxes.map((axis, idx) => {
        const duration = axis.gap * 3 + 3; // Base duration based on gap
        const start = currentMonth;
        currentMonth += Math.ceil(duration / 2); // Overlap for parallel execution
        
        return {
            ...axis,
            phase: idx + 1,
            start,
            duration,
            end: start + duration
        };
    });
    
    const totalMonths = timeline.length > 0 ? Math.max(...timeline.map(t => t.end)) : 0;
    
    return `
        <div style="margin: 24px 0;">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
                <div style="font-size: 48px; font-weight: 800; color: #1e1b4b;">${totalMonths}</div>
                <div>
                    <div style="font-size: 18px; font-weight: 600; color: #1e293b;">miesięcy całkowitego czasu transformacji</div>
                    <div style="font-size: 14px; color: #64748b;">przy założeniu równoległej realizacji faz</div>
                </div>
            </div>
            
            <!-- Gantt-style timeline -->
            <div style="background: #f8fafc; padding: 24px; border-radius: 12px; overflow-x: auto;">
                <!-- Month headers -->
                <div style="display: flex; margin-bottom: 16px; padding-left: 200px;">
                    ${Array.from({length: Math.ceil(totalMonths / 3) + 1}, (_, i) => `
                        <div style="min-width: ${100 * 3}px; font-size: 12px; color: #64748b; font-weight: 600;">
                            Q${(i % 4) + 1} ${2024 + Math.floor(i / 4)}
                        </div>
                    `).join('')}
                </div>
                
                <!-- Timeline bars -->
                ${timeline.map(item => `
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <div style="width: 200px; display: flex; align-items: center; gap: 8px; font-weight: 500;">
                            <span>${item.icon}</span>
                            <span style="font-size: 14px;">${item.name}</span>
                        </div>
                        <div style="flex: 1; position: relative; height: 32px;">
                            <div style="position: absolute; left: ${item.start * (100/3)}px; width: ${item.duration * (100/3)}px; height: 100%; background: ${item.color}; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                                <span style="color: white; font-size: 12px; font-weight: 600;">${item.actual} → ${item.target}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <!-- Phase details -->
            <h3 style="margin-top: 32px;">📋 Szczegóły faz transformacji</h3>
            <div style="display: grid; gap: 16px; margin-top: 16px;">
                ${timeline.map((item, idx) => `
                    <div style="background: white; border: 1px solid #e2e8f0; border-left: 4px solid ${item.color}; padding: 20px; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">FAZA ${item.phase}</div>
                                <div style="font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                    ${item.icon} ${item.name}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 24px; font-weight: 700; color: ${item.color};">+${item.gap}</div>
                                <div style="font-size: 12px; color: #64748b;">poziomów do zamknięcia</div>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                            <div>
                                <div style="font-size: 12px; color: #64748b;">Start</div>
                                <div style="font-weight: 600;">Miesiąc ${item.start + 1}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #64748b;">Czas trwania</div>
                                <div style="font-weight: 600;">${item.duration} miesięcy</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #64748b;">Zakończenie</div>
                                <div style="font-weight: 600;">Miesiąc ${item.end}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function generateInvestmentSummary(assessment) {
    const { axisData } = assessment;
    
    // Calculate investment estimates based on gaps
    const investments = Object.entries(axisData).map(([id, data]) => {
        const gap = (data.target || 0) - (data.actual || 0);
        const axis = DRD_AXES[id] || { namePl: id, icon: '📊' };
        
        // Rough investment estimate based on gap (in thousands PLN)
        let minInvestment = 0;
        let maxInvestment = 0;
        
        if (gap === 1) { minInvestment = 50; maxInvestment = 150; }
        else if (gap === 2) { minInvestment = 150; maxInvestment = 400; }
        else if (gap >= 3) { minInvestment = 400; maxInvestment = 1000; }
        
        return {
            id,
            name: axis.namePl,
            icon: axis.icon,
            gap,
            minInvestment,
            maxInvestment
        };
    }).filter(i => i.gap > 0);
    
    const totalMin = investments.reduce((sum, i) => sum + i.minInvestment, 0);
    const totalMax = investments.reduce((sum, i) => sum + i.maxInvestment, 0);
    
    return `
        <div style="margin: 24px 0;">
            <!-- Summary cards -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 32px;">
                <div style="background: linear-gradient(135deg, #10b98115, #10b98105); padding: 24px; border-radius: 16px; border: 2px solid #10b981;">
                    <div style="font-size: 14px; color: #065f46;">Szacowana inwestycja (min)</div>
                    <div style="font-size: 36px; font-weight: 800; color: #10b981;">${totalMin.toLocaleString()} tys. PLN</div>
                </div>
                <div style="background: linear-gradient(135deg, #3b82f615, #3b82f605); padding: 24px; border-radius: 16px; border: 2px solid #3b82f6;">
                    <div style="font-size: 14px; color: #1e40af;">Szacowana inwestycja (max)</div>
                    <div style="font-size: 36px; font-weight: 800; color: #3b82f6;">${totalMax.toLocaleString()} tys. PLN</div>
                </div>
                <div style="background: linear-gradient(135deg, #8b5cf615, #8b5cf605); padding: 24px; border-radius: 16px; border: 2px solid #8b5cf6;">
                    <div style="font-size: 14px; color: #5b21b6;">Szacowany ROI (3 lata)</div>
                    <div style="font-size: 36px; font-weight: 800; color: #8b5cf6;">180-250%</div>
                </div>
            </div>
            
            <!-- Investment breakdown -->
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #1e1b4b; color: white;">
                        <th style="padding: 14px; text-align: left;">Oś transformacji</th>
                        <th style="padding: 14px; text-align: center;">Luka</th>
                        <th style="padding: 14px; text-align: right;">Inwestycja (min)</th>
                        <th style="padding: 14px; text-align: right;">Inwestycja (max)</th>
                    </tr>
                </thead>
                <tbody>
                    ${investments.map((inv, idx) => `
                        <tr style="background: ${idx % 2 === 0 ? 'white' : '#f8fafc'};">
                            <td style="padding: 14px; border-bottom: 1px solid #e2e8f0;">
                                ${inv.icon} ${inv.name}
                            </td>
                            <td style="padding: 14px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                                <span style="display: inline-block; padding: 4px 12px; background: ${inv.gap >= 2 ? '#fef2f2' : '#fef3c7'}; color: ${inv.gap >= 2 ? '#991b1b' : '#92400e'}; border-radius: 20px; font-weight: 600;">
                                    +${inv.gap}
                                </span>
                            </td>
                            <td style="padding: 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">
                                ${inv.minInvestment.toLocaleString()} tys. PLN
                            </td>
                            <td style="padding: 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">
                                ${inv.maxInvestment.toLocaleString()} tys. PLN
                            </td>
                        </tr>
                    `).join('')}
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 14px;" colspan="2">RAZEM</td>
                        <td style="padding: 14px; text-align: right;">${totalMin.toLocaleString()} tys. PLN</td>
                        <td style="padding: 14px; text-align: right;">${totalMax.toLocaleString()} tys. PLN</td>
                    </tr>
                </tbody>
            </table>
            
            <div style="margin-top: 24px; padding: 20px; background: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                    <strong>⚠️ Uwaga:</strong> Powyższe szacunki są orientacyjne i mogą ulec zmianie po szczegółowej analizie technicznej. 
                    Faktyczne koszty zależą od wyboru dostawców, zakresu integracji z istniejącymi systemami oraz tempa wdrożenia.
                </p>
            </div>
        </div>
    `;
}

function generateRiskMatrix(assessment) {
    const risks = [
        { name: 'Opór pracowników przed zmianą', probability: 'Wysoka', impact: 'Średni', category: 'Organizacyjne', mitigation: 'Program change management, szkolenia, ambasadorzy zmiany' },
        { name: 'Brak kompetencji AI/Data Science', probability: 'Wysoka', impact: 'Wysoki', category: 'Kompetencje', mitigation: 'Zatrudnienie ekspertów, partnerstwo z firmą technologiczną' },
        { name: 'Przekroczenie budżetu', probability: 'Średnia', impact: 'Średni', category: 'Finansowe', mitigation: 'Etapowe finansowanie, regularne przeglądy budżetowe' },
        { name: 'Integracja z systemami legacy', probability: 'Średnia', impact: 'Wysoki', category: 'Techniczne', mitigation: 'API-first approach, warstwa middleware' },
        { name: 'Cyberbezpieczeństwo OT', probability: 'Niska', impact: 'Krytyczny', category: 'Bezpieczeństwo', mitigation: 'Zero Trust Architecture, audyty bezpieczeństwa' },
        { name: 'Opóźnienia dostawców technologii', probability: 'Średnia', impact: 'Średni', category: 'Zewnętrzne', mitigation: 'Multi-vendor strategy, kary umowne' }
    ];
    
    return `
        <div style="margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                    <tr style="background: #1e1b4b; color: white;">
                        <th style="padding: 14px; text-align: left;">Ryzyko</th>
                        <th style="padding: 14px; text-align: center;">Kategoria</th>
                        <th style="padding: 14px; text-align: center;">Prawdopodobieństwo</th>
                        <th style="padding: 14px; text-align: center;">Wpływ</th>
                        <th style="padding: 14px; text-align: left;">Mitygacja</th>
                    </tr>
                </thead>
                <tbody>
                    ${risks.map((risk, idx) => `
                        <tr style="background: ${idx % 2 === 0 ? 'white' : '#f8fafc'};">
                            <td style="padding: 14px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${risk.name}</td>
                            <td style="padding: 14px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                                <span style="font-size: 12px; color: #64748b;">${risk.category}</span>
                            </td>
                            <td style="padding: 14px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                                <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; background: ${risk.probability === 'Wysoka' ? '#fef2f2' : risk.probability === 'Średnia' ? '#fffbeb' : '#f0fdf4'}; color: ${risk.probability === 'Wysoka' ? '#dc2626' : risk.probability === 'Średnia' ? '#d97706' : '#16a34a'};">
                                    ${risk.probability}
                                </span>
                            </td>
                            <td style="padding: 14px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                                <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; background: ${risk.impact === 'Krytyczny' || risk.impact === 'Wysoki' ? '#fef2f2' : risk.impact === 'Średni' ? '#fffbeb' : '#f0fdf4'}; color: ${risk.impact === 'Krytyczny' || risk.impact === 'Wysoki' ? '#dc2626' : risk.impact === 'Średni' ? '#d97706' : '#16a34a'};">
                                    ${risk.impact}
                                </span>
                            </td>
                            <td style="padding: 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569;">${risk.mitigation}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <!-- Risk Matrix Visualization -->
            <h3>Macierz ryzyka (Impact vs Probability)</h3>
            <div style="display: grid; grid-template-columns: auto 1fr 1fr 1fr; gap: 2px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin-top: 16px;">
                <div style="background: #f1f5f9; padding: 16px; font-weight: 600;">Wpływ ↓ / Prawdop. →</div>
                <div style="background: #f1f5f9; padding: 16px; text-align: center; font-weight: 600;">Niska</div>
                <div style="background: #f1f5f9; padding: 16px; text-align: center; font-weight: 600;">Średnia</div>
                <div style="background: #f1f5f9; padding: 16px; text-align: center; font-weight: 600;">Wysoka</div>
                
                <div style="background: #f1f5f9; padding: 16px; font-weight: 600;">Krytyczny</div>
                <div style="background: #fef3c7; padding: 16px; text-align: center;">🟡</div>
                <div style="background: #fecaca; padding: 16px; text-align: center;">🔴</div>
                <div style="background: #fecaca; padding: 16px; text-align: center;">🔴🔴</div>
                
                <div style="background: #f1f5f9; padding: 16px; font-weight: 600;">Wysoki</div>
                <div style="background: #fef3c7; padding: 16px; text-align: center;">🟡</div>
                <div style="background: #fef3c7; padding: 16px; text-align: center;">🟡 (2)</div>
                <div style="background: #fecaca; padding: 16px; text-align: center;">🔴 (1)</div>
                
                <div style="background: #f1f5f9; padding: 16px; font-weight: 600;">Średni</div>
                <div style="background: #dcfce7; padding: 16px; text-align: center;">🟢</div>
                <div style="background: #fef3c7; padding: 16px; text-align: center;">🟡 (2)</div>
                <div style="background: #fef3c7; padding: 16px; text-align: center;">🟡 (1)</div>
            </div>
        </div>
    `;
}

// ============================================================
// REPORT 4: CEO STAKEHOLDER REPORT
// ============================================================
function generateCEOStakeholderReport(assessment) {
    console.log('👔 Generating CEO Stakeholder Report...');
    
    const { axisData, organization_name, project_name } = assessment;
    
    // Calculate key metrics
    let totalActual = 0, totalTarget = 0, count = 0;
    Object.values(axisData).forEach(data => {
        if (data?.actual) {
            totalActual += data.actual;
            totalTarget += data.target || 0;
            count++;
        }
    });
    
    const avgActual = count > 0 ? (totalActual / count).toFixed(1) : 0;
    const avgTarget = count > 0 ? (totalTarget / count).toFixed(1) : 0;
    const totalGap = Object.values(axisData).reduce((sum, d) => sum + Math.max(0, (d.target || 0) - (d.actual || 0)), 0);
    
    const content = `
        <div style="text-align: center; padding: 60px 40px; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%); color: white; border-radius: 16px; margin-bottom: 40px;">
            <div style="font-size: 14px; letter-spacing: 3px; opacity: 0.7; margin-bottom: 16px;">EXECUTIVE BRIEFING</div>
            <h1 style="font-size: 36px; font-weight: 800; margin: 0 0 16px 0;">📊 Digital Transformation Scorecard</h1>
            <h2 style="font-size: 24px; font-weight: 500; color: #94a3b8; margin: 0;">${organization_name}</h2>
            <p style="margin-top: 24px; font-size: 14px; color: #64748b;">${new Date().toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <h2>🎯 Kluczowe wskaźniki dla zarządu</h2>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 24px 0;">
            <div style="background: linear-gradient(135deg, #3b82f615, #3b82f605); padding: 24px; border-radius: 16px; text-align: center; border: 2px solid #3b82f6;">
                <div style="font-size: 48px; font-weight: 800; color: #3b82f6;">${avgActual}</div>
                <div style="font-size: 14px; color: #64748b; margin-top: 8px;">Aktualny poziom dojrzałości</div>
                <div style="font-size: 12px; color: #94a3b8;">/ 7 max</div>
            </div>
            <div style="background: linear-gradient(135deg, #10b98115, #10b98105); padding: 24px; border-radius: 16px; text-align: center; border: 2px solid #10b981;">
                <div style="font-size: 48px; font-weight: 800; color: #10b981;">${avgTarget}</div>
                <div style="font-size: 14px; color: #64748b; margin-top: 8px;">Docelowy poziom dojrzałości</div>
                <div style="font-size: 12px; color: #94a3b8;">/ 7 max</div>
            </div>
            <div style="background: linear-gradient(135deg, #f59e0b15, #f59e0b05); padding: 24px; border-radius: 16px; text-align: center; border: 2px solid #f59e0b;">
                <div style="font-size: 48px; font-weight: 800; color: #f59e0b;">${totalGap}</div>
                <div style="font-size: 14px; color: #64748b; margin-top: 8px;">Punktów do zamknięcia</div>
                <div style="font-size: 12px; color: #94a3b8;">łączna luka</div>
            </div>
            <div style="background: linear-gradient(135deg, #8b5cf615, #8b5cf605); padding: 24px; border-radius: 16px; text-align: center; border: 2px solid #8b5cf6;">
                <div style="font-size: 48px; font-weight: 800; color: #8b5cf6;">${Math.max(12, totalGap * 2)}</div>
                <div style="font-size: 14px; color: #64748b; margin-top: 8px;">Miesięcy transformacji</div>
                <div style="font-size: 12px; color: #94a3b8;">szacowany czas</div>
            </div>
        </div>
        
        <div class="page-break"></div>
        <h2>📈 Pozycja vs. Konkurencja</h2>
        <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin: 24px 0;">
            <p style="font-size: 16px; line-height: 1.8; margin-bottom: 16px;">
                Organizacja <strong>${organization_name}</strong> znajduje się na poziomie <strong>${avgActual}/7</strong> 
                w porównaniu do średniej branżowej <strong>3.5/7</strong>. 
                ${parseFloat(avgActual) >= 3.5 
                    ? '✅ <span style="color: #10b981;">Organizacja jest powyżej średniej branżowej.</span>'
                    : '⚠️ <span style="color: #f59e0b;">Wymagane działania, aby dogonić konkurencję.</span>'}
            </p>
            
            <!-- Simplified radar chart representation -->
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-top: 24px;">
                ${Object.entries(axisData).map(([id, data]) => {
                    const axis = DRD_AXES[id] || { namePl: id, icon: '📊', color: '#3b82f6' };
                    const percentage = ((data.actual || 0) / 7) * 100;
                    return `
                        <div style="text-align: center;">
                            <div style="font-size: 24px; margin-bottom: 8px;">${axis.icon}</div>
                            <div style="height: 120px; background: #e5e7eb; border-radius: 8px; position: relative; overflow: hidden;">
                                <div style="position: absolute; bottom: 0; left: 0; right: 0; height: ${percentage}%; background: ${axis.color}; transition: height 0.5s;"></div>
                            </div>
                            <div style="font-size: 11px; color: #64748b; margin-top: 8px; word-wrap: break-word;">${axis.namePl}</div>
                            <div style="font-weight: 700; color: ${axis.color};">${data.actual}/${data.target}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <h2>💼 TOP 3 Priorytety strategiczne</h2>
        <div style="display: grid; gap: 16px; margin: 24px 0;">
            <div style="display: flex; align-items: flex-start; gap: 16px; padding: 20px; background: linear-gradient(135deg, #fef2f2, #fee2e2); border-radius: 12px; border-left: 4px solid #ef4444;">
                <div style="font-size: 32px;">🤖</div>
                <div>
                    <div style="font-size: 18px; font-weight: 700; color: #991b1b;">1. AI Maturity - Fundamenty Sztucznej Inteligencji</div>
                    <p style="margin: 8px 0 0 0; color: #7f1d1d;">Organizacja nie wykorzystuje AI/ML. Konieczne: rekrutacja Data Scientists, przygotowanie danych, pilotażowe use cases.</p>
                    <div style="margin-top: 12px; display: flex; gap: 16px; font-size: 13px;">
                        <span style="padding: 4px 12px; background: #fecaca; border-radius: 20px; color: #7f1d1d;">Luka: +2 poziomy</span>
                        <span style="padding: 4px 12px; background: white; border-radius: 20px; color: #64748b;">Inwestycja: 200-400 tys. PLN</span>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; align-items: flex-start; gap: 16px; padding: 20px; background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; border-left: 4px solid #f59e0b;">
                <div style="font-size: 32px;">📦</div>
                <div>
                    <div style="font-size: 18px; font-weight: 700; color: #92400e;">2. Digital Products - IoT i Connected Products</div>
                    <p style="margin: 8px 0 0 0; color: #78350f;">Produkty bez komponentów cyfrowych. Konieczne: IoT w produktach końcowych, rozbudowany portal klienta.</p>
                    <div style="margin-top: 12px; display: flex; gap: 16px; font-size: 13px;">
                        <span style="padding: 4px 12px; background: #fde68a; border-radius: 20px; color: #78350f;">Luka: +2 poziomy</span>
                        <span style="padding: 4px 12px; background: white; border-radius: 20px; color: #64748b;">Inwestycja: 150-300 tys. PLN</span>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; align-items: flex-start; gap: 16px; padding: 20px; background: linear-gradient(135deg, #dbeafe, #bfdbfe); border-radius: 12px; border-left: 4px solid #3b82f6;">
                <div style="font-size: 32px;">💼</div>
                <div>
                    <div style="font-size: 18px; font-weight: 700; color: #1e40af;">3. Business Models - Subskrypcja i Monetyzacja Danych</div>
                    <p style="margin: 8px 0 0 0; color: #1e3a8a;">Tradycyjny model sprzedaży. Konieczne: rozwój modelu subskrypcyjnego, monetyzacja danych serwisowych.</p>
                    <div style="margin-top: 12px; display: flex; gap: 16px; font-size: 13px;">
                        <span style="padding: 4px 12px; background: #bfdbfe; border-radius: 20px; color: #1e3a8a;">Luka: +2 poziomy</span>
                        <span style="padding: 4px 12px; background: white; border-radius: 20px; color: #64748b;">Inwestycja: 200-400 tys. PLN</span>
                    </div>
                </div>
            </div>
        </div>
        
        <h2>⚡ Decyzje do podjęcia</h2>
        <div style="background: linear-gradient(135deg, #1e1b4b, #312e81); color: white; padding: 32px; border-radius: 16px; margin: 24px 0;">
            <div style="display: grid; gap: 24px;">
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <div style="min-width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">1</div>
                    <div>
                        <div style="font-weight: 600; font-size: 16px;">Zatwierdzenie budżetu transformacji</div>
                        <div style="color: #94a3b8; margin-top: 4px;">Szacowany zakres: 850-2,150 tys. PLN na 18 miesięcy</div>
                    </div>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <div style="min-width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">2</div>
                    <div>
                        <div style="font-weight: 600; font-size: 16px;">Powołanie Transformation Office</div>
                        <div style="color: #94a3b8; margin-top: 4px;">Dedykowany zespół PMO dla programu transformacji cyfrowej</div>
                    </div>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <div style="min-width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">3</div>
                    <div>
                        <div style="font-weight: 600; font-size: 16px;">Rekrutacja CDO / Head of Digital</div>
                        <div style="color: #94a3b8; margin-top: 4px;">Lider odpowiedzialny za całość transformacji cyfrowej</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 40px; padding: 20px; background: #f1f5f9; border-radius: 8px; text-align: center;">
            <p style="color: #64748b; font-size: 13px; margin: 0;">
                CEO Executive Briefing | ${new Date().toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
                <strong>Consultify AI</strong> - Prepared for: ${organization_name}
            </p>
        </div>
    `;
    
    return wrapInHtml(content, 'CEO Stakeholder Report - DRD');
}

// ============================================================
// MAIN EXECUTION
// ============================================================
async function main() {
    console.log('\n🚀 Starting Premium DRD Report Generation...\n');
    console.log('📋 Assessment: ' + ASSESSMENT_DATA.project_name);
    console.log('🏢 Organization: ' + ASSESSMENT_DATA.organization_name);
    console.log('🏭 Industry: ' + ASSESSMENT_DATA.industry + '\n');
    
    // Create output directory
    const outputDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate all 4 reports
    const reports = [
        {
            name: 'executive_summary',
            title: 'Executive Summary',
            generator: generateExecutiveSummaryReport
        },
        {
            name: 'full_assessment',
            title: 'Full Assessment',
            generator: generateFullAssessmentReport
        },
        {
            name: 'gap_analysis_roadmap',
            title: 'Gap Analysis & Roadmap',
            generator: generateGapAnalysisReport
        },
        {
            name: 'ceo_stakeholder',
            title: 'CEO Stakeholder Report',
            generator: generateCEOStakeholderReport
        }
    ];
    
    const generatedFiles = [];
    
    for (const report of reports) {
        try {
            const html = report.generator(ASSESSMENT_DATA);
            const filename = `drd_report_${report.name}_${new Date().toISOString().split('T')[0]}.html`;
            const filepath = path.join(outputDir, filename);
            
            fs.writeFileSync(filepath, html, 'utf-8');
            generatedFiles.push(filepath);
            console.log(`✅ ${report.title}: ${filename}`);
        } catch (err) {
            console.error(`❌ ${report.title}: ${err.message}`);
        }
    }
    
    console.log('\n📁 Reports saved to:', outputDir);
    console.log('\n🎉 All reports generated successfully!');
    console.log('\nTo view reports, open in browser:');
    generatedFiles.forEach(f => console.log(`  file://${f}`));
}

main().catch(console.error);








