/**
 * Generate Sample Reports and Initiatives Script
 * This script generates comprehensive reports and initiatives for demonstration
 */

const db = require('../server/database');
const { v4: uuidv4 } = require('uuid');

// Assessment data from DB
const SAMPLE_PROJECTS = [
    { projectId: 'f5dfa222-a9c9-4b20-a881-4fa0d1fffce7', name: 'Cyfryzacja Produkcji Q4 2024' },
    { projectId: 'e6b6bcb9-298a-436d-a2bf-055e1356274e', name: 'Bank Cyfrowy 2025' },
    { projectId: '4bea1cce-abdc-4679-828d-4a1696f0380b', name: 'Smart Factory Initiative' }
];

// DRD Axes mapping
const DRD_AXES = {
    processes: 'Cyfryzacja Procesów',
    digitalProducts: 'Produkty Cyfrowe',
    businessModels: 'Modele Biznesowe',
    dataManagement: 'Zarządzanie Danymi',
    culture: 'Kultura Cyfrowa',
    cybersecurity: 'Cyberbezpieczeństwo',
    aiMaturity: 'Dojrzałość AI'
};

async function getAssessment(projectId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT m.*, p.name as project_name, p.organization_id 
             FROM maturity_assessments m 
             JOIN projects p ON m.project_id = p.id 
             WHERE m.project_id = ?`,
            [projectId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

function generateComprehensiveReport(assessment) {
    const axisScores = JSON.parse(assessment.axis_scores || '{}');
    const projectName = assessment.project_name;
    
    // Generate HTML report
    let report = `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Raport DRD - ${projectName}</title>
    <style>
        :root {
            --primary: #1e3a8a;
            --secondary: #3b82f6;
            --accent: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
            --bg: #f8fafc;
            --card: #ffffff;
            --text: #1e293b;
        }
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            line-height: 1.6;
            color: var(--text);
            background: var(--bg);
            margin: 0;
            padding: 2rem;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            padding: 3rem;
            border-radius: 12px;
            margin-bottom: 2rem;
        }
        .header h1 { margin: 0 0 0.5rem 0; font-size: 2rem; }
        .header .meta { opacity: 0.9; font-size: 0.95rem; }
        .card {
            background: var(--card);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .card h2 {
            color: var(--primary);
            margin-top: 0;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid var(--secondary);
        }
        .scorecard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1rem;
        }
        .score-item {
            background: var(--bg);
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid var(--secondary);
        }
        .score-item.high-gap { border-left-color: var(--danger); }
        .score-item.medium-gap { border-left-color: var(--warning); }
        .score-item.low-gap { border-left-color: var(--accent); }
        .score-item h3 { margin: 0 0 0.5rem 0; color: var(--primary); }
        .score-bar {
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            margin: 0.5rem 0;
            position: relative;
        }
        .score-fill { height: 100%; border-radius: 4px; }
        .score-fill.actual { background: var(--secondary); }
        .score-fill.target { background: var(--accent); opacity: 0.3; }
        .metrics { display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.9rem; }
        .metric { padding: 0.25rem 0.75rem; background: var(--card); border-radius: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: var(--bg); color: var(--primary); font-weight: 600; }
        .priority-high { color: var(--danger); font-weight: 600; }
        .priority-medium { color: var(--warning); font-weight: 600; }
        .priority-low { color: var(--accent); font-weight: 600; }
        .recommendation {
            background: linear-gradient(135deg, #f0fdf4, #dcfce7);
            padding: 1.5rem;
            border-radius: 8px;
            margin: 1rem 0;
            border-left: 4px solid var(--accent);
        }
        .recommendation h4 { margin: 0 0 0.5rem 0; color: var(--primary); }
        .timeline {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        .timeline-item {
            display: flex;
            gap: 1rem;
        }
        .timeline-marker {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--secondary);
            margin-top: 4px;
            flex-shrink: 0;
        }
        .timeline-content { flex: 1; }
        .footer {
            text-align: center;
            padding: 2rem;
            color: #64748b;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Raport Oceny Dojrzałości Cyfrowej</h1>
            <div class="meta">
                <strong>${projectName}</strong><br>
                Wygenerowano: ${new Date().toLocaleDateString('pl-PL')} | 
                Ogólna dojrzałość: ${assessment.overall_as_is}/7.0 | 
                Cel: ${assessment.overall_to_be}/7.0 | 
                Luka: ${assessment.overall_gap}
            </div>
        </div>

        <!-- Executive Summary -->
        <div class="card">
            <h2>🎯 Podsumowanie Wykonawcze</h2>
            <p>
                <strong>${projectName}</strong> wykazuje ogólny poziom dojrzałości cyfrowej 
                <strong>${assessment.overall_as_is}/7.0</strong>, co plasuje organizację 
                ${assessment.overall_as_is < 3 ? 'na wczesnym etapie transformacji cyfrowej' : 
                  assessment.overall_as_is < 5 ? 'na średnim poziomie zaawansowania cyfrowego' : 
                  'na zaawansowanym poziomie cyfryzacji'}.
            </p>
            <p>
                Zidentyfikowana luka wynosi <strong>${assessment.overall_gap} punktu</strong> do celu 
                ${assessment.overall_to_be}/7.0. Wymaga to strategicznego podejścia obejmującego 
                ${Object.keys(axisScores).filter(k => {
                    const s = axisScores[k];
                    return s && (s.target - s.actual) >= 2;
                }).length} obszarów priorytetowych.
            </p>
            
            <h3>📈 Kluczowe Wskaźniki</h3>
            <table>
                <tr>
                    <th>Metryka</th>
                    <th>Wartość</th>
                    <th>Interpretacja</th>
                </tr>
                <tr>
                    <td>Średnia dojrzałość AS-IS</td>
                    <td><strong>${assessment.overall_as_is}</strong>/7.0</td>
                    <td>${assessment.overall_as_is >= 4 ? '✅ Powyżej średniej rynkowej' : '⚠️ Wymaga uwagi'}</td>
                </tr>
                <tr>
                    <td>Cel TO-BE</td>
                    <td><strong>${assessment.overall_to_be}</strong>/7.0</td>
                    <td>${assessment.overall_to_be >= 5 ? '🎯 Ambitny, ale realistyczny' : '📊 Konserwatywny'}</td>
                </tr>
                <tr>
                    <td>Całkowita luka transformacyjna</td>
                    <td><strong>${assessment.overall_gap}</strong></td>
                    <td>${assessment.overall_gap > 2 ? '🔴 Znacząca transformacja' : '🟢 Umiarkowane zmiany'}</td>
                </tr>
                <tr>
                    <td>Szacowany czas transformacji</td>
                    <td><strong>${Math.round(assessment.overall_gap * 6)}-${Math.round(assessment.overall_gap * 9)}</strong> miesięcy</td>
                    <td>📅 Przy pełnym zaangażowaniu zasobów</td>
                </tr>
            </table>
        </div>

        <!-- Detailed Axis Analysis -->
        <div class="card">
            <h2>📋 Szczegółowa Analiza Osi DRD</h2>
            <div class="scorecard">
`;

    // Generate score cards for each axis
    Object.entries(axisScores).forEach(([key, score]) => {
        if (!score) return;
        const gap = score.target - score.actual;
        const gapClass = gap >= 2 ? 'high-gap' : gap >= 1 ? 'medium-gap' : 'low-gap';
        const axisName = DRD_AXES[key] || key;
        
        report += `
                <div class="score-item ${gapClass}">
                    <h3>${axisName}</h3>
                    <div class="score-bar">
                        <div class="score-fill actual" style="width: ${(score.actual / 7) * 100}%"></div>
                    </div>
                    <div class="metrics">
                        <span class="metric">AS-IS: <strong>${score.actual}</strong>/7</span>
                        <span class="metric">TO-BE: <strong>${score.target}</strong>/7</span>
                        <span class="metric">Luka: <strong>${gap.toFixed(1)}</strong></span>
                    </div>
                    <p style="font-size: 0.9rem; color: #64748b; margin-top: 0.75rem;">
                        ${score.justification || 'Brak opisu'}
                    </p>
                </div>
`;
    });

    report += `
            </div>
        </div>

        <!-- Gap Prioritization -->
        <div class="card">
            <h2>⚡ Priorytetyzacja Luk</h2>
            <table>
                <thead>
                    <tr>
                        <th>Oś</th>
                        <th>AS-IS</th>
                        <th>TO-BE</th>
                        <th>Luka</th>
                        <th>Priorytet</th>
                        <th>Wpływ Biznesowy</th>
                    </tr>
                </thead>
                <tbody>
`;

    // Sort by gap descending
    const sortedAxes = Object.entries(axisScores)
        .filter(([_, s]) => s)
        .sort(([_, a], [__, b]) => (b.target - b.actual) - (a.target - a.actual));

    sortedAxes.forEach(([key, score], idx) => {
        const gap = score.target - score.actual;
        const priority = gap >= 2 ? 'WYSOKI' : gap >= 1 ? 'ŚREDNI' : 'NISKI';
        const priorityClass = gap >= 2 ? 'priority-high' : gap >= 1 ? 'priority-medium' : 'priority-low';
        const axisName = DRD_AXES[key] || key;
        const impact = gap >= 2 ? 'Krytyczny dla sukcesu transformacji' : 
                       gap >= 1 ? 'Istotny wpływ na konkurencyjność' : 
                       'Doskonalenie operacyjne';
        
        report += `
                    <tr>
                        <td><strong>${axisName}</strong></td>
                        <td>${score.actual}/7</td>
                        <td>${score.target}/7</td>
                        <td>${gap.toFixed(1)}</td>
                        <td class="${priorityClass}">${priority}</td>
                        <td>${impact}</td>
                    </tr>
`;
    });

    report += `
                </tbody>
            </table>
        </div>

        <!-- Strategic Recommendations -->
        <div class="card">
            <h2>💡 Rekomendacje Strategiczne</h2>
`;

    // Generate recommendations based on gaps
    let recNum = 1;
    sortedAxes.slice(0, 4).forEach(([key, score]) => {
        const gap = score.target - score.actual;
        const axisName = DRD_AXES[key] || key;
        
        let recommendation = '';
        let investment = '';
        let timeline = '';
        
        switch(key) {
            case 'processes':
                recommendation = 'Wdrożenie zaawansowanej automatyzacji procesów biznesowych z wykorzystaniem RPA i process mining. Priorytet: procesy o wysokiej powtarzalności i wartości.';
                investment = '250-500K PLN';
                timeline = '6-9 miesięcy';
                break;
            case 'digitalProducts':
                recommendation = 'Rozwój portfolio produktów cyfrowych z integracją IoT. Rekomendowane podejście MVP z iteracyjnym rozwojem.';
                investment = '400-800K PLN';
                timeline = '9-12 miesięcy';
                break;
            case 'businessModels':
                recommendation = 'Pilotaż nowych modeli biznesowych (subskrypcja, pay-per-use). Analiza customer lifetime value i optymalizacja monetyzacji.';
                investment = '150-300K PLN';
                timeline = '3-6 miesięcy';
                break;
            case 'dataManagement':
                recommendation = 'Budowa platformy danych z zaawansowaną analityką. Wdrożenie data governance i self-service BI.';
                investment = '300-600K PLN';
                timeline = '6-9 miesięcy';
                break;
            case 'culture':
                recommendation = 'Program transformacji kulturowej: szkolenia cyfrowe, digital champions, agile coaching dla liderów.';
                investment = '200-400K PLN';
                timeline = '12-18 miesięcy';
                break;
            case 'cybersecurity':
                recommendation = 'Rozbudowa SOC, implementacja Zero Trust Architecture, program security awareness.';
                investment = '350-700K PLN';
                timeline = '9-12 miesięcy';
                break;
            case 'aiMaturity':
                recommendation = 'Budowa AI Center of Excellence, pilotaże ML w kluczowych procesach, rozwój kompetencji data science.';
                investment = '500K-1M PLN';
                timeline = '12-18 miesięcy';
                break;
        }
        
        if (gap >= 1) {
            report += `
            <div class="recommendation">
                <h4>Rekomendacja ${recNum++}: ${axisName}</h4>
                <p><strong>Działanie:</strong> ${recommendation}</p>
                <p><strong>Luka do zamknięcia:</strong> ${gap.toFixed(1)} punktu (${score.actual} → ${score.target})</p>
                <p><strong>Szacowana inwestycja:</strong> ${investment}</p>
                <p><strong>Harmonogram:</strong> ${timeline}</p>
            </div>
`;
        }
    });

    report += `
        </div>

        <!-- Transformation Roadmap -->
        <div class="card">
            <h2>🗺️ Roadmapa Transformacji</h2>
            <div class="timeline">
                <div class="timeline-item">
                    <div class="timeline-marker" style="background: var(--danger)"></div>
                    <div class="timeline-content">
                        <h4>Faza 1: Fundamenty (Miesiące 1-6)</h4>
                        <p>Quick wins i budowa fundamentów. Priorytety: ${sortedAxes.slice(0, 2).map(([k]) => DRD_AXES[k]).join(', ')}.</p>
                        <ul>
                            <li>Audyt i mapowanie procesów krytycznych</li>
                            <li>Proof of Concept dla wybranych inicjatyw</li>
                            <li>Budowa zespołu transformacyjnego</li>
                            <li>Szybkie zwycięstwa dla budowania momentum</li>
                        </ul>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-marker" style="background: var(--warning)"></div>
                    <div class="timeline-content">
                        <h4>Faza 2: Transformacja (Miesiące 7-12)</h4>
                        <p>Główne wdrożenia i skalowanie. Fokus: ${sortedAxes.slice(2, 4).map(([k]) => DRD_AXES[k]).join(', ')}.</p>
                        <ul>
                            <li>Wdrożenie kluczowych platform technologicznych</li>
                            <li>Skalowanie pilotaży na całą organizację</li>
                            <li>Intensywne szkolenia i change management</li>
                            <li>Pierwsze mierzalne rezultaty biznesowe</li>
                        </ul>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-marker" style="background: var(--accent)"></div>
                    <div class="timeline-content">
                        <h4>Faza 3: Optymalizacja (Miesiące 13-24)</h4>
                        <p>Doskonalenie i innowacje. Obszary: ${sortedAxes.slice(4).map(([k]) => DRD_AXES[k]).join(', ') || 'wszystkie osie'}.</p>
                        <ul>
                            <li>Zaawansowana analityka i AI</li>
                            <li>Nowe modele biznesowe oparte na danych</li>
                            <li>Ciągłe doskonalenie procesów</li>
                            <li>Budowanie przewagi konkurencyjnej</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <!-- Investment Summary -->
        <div class="card">
            <h2>💰 Podsumowanie Inwestycji</h2>
            <table>
                <thead>
                    <tr>
                        <th>Kategoria</th>
                        <th>Zakres inwestycji</th>
                        <th>% Budżetu</th>
                        <th>Priorytet</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Technologia i platformy</td>
                        <td>800K - 1.5M PLN</td>
                        <td>40%</td>
                        <td class="priority-high">WYSOKI</td>
                    </tr>
                    <tr>
                        <td>Ludzie i kompetencje</td>
                        <td>400K - 800K PLN</td>
                        <td>25%</td>
                        <td class="priority-high">WYSOKI</td>
                    </tr>
                    <tr>
                        <td>Procesy i governance</td>
                        <td>300K - 500K PLN</td>
                        <td>15%</td>
                        <td class="priority-medium">ŚREDNI</td>
                    </tr>
                    <tr>
                        <td>Change management</td>
                        <td>200K - 400K PLN</td>
                        <td>12%</td>
                        <td class="priority-medium">ŚREDNI</td>
                    </tr>
                    <tr>
                        <td>Rezerwa i ryzyka</td>
                        <td>200K - 300K PLN</td>
                        <td>8%</td>
                        <td class="priority-low">STANDARDOWY</td>
                    </tr>
                    <tr style="background: #f0fdf4;">
                        <td><strong>RAZEM</strong></td>
                        <td><strong>1.9M - 3.5M PLN</strong></td>
                        <td><strong>100%</strong></td>
                        <td>-</td>
                    </tr>
                </tbody>
            </table>
            
            <h3>📊 Oczekiwany ROI</h3>
            <ul>
                <li><strong>Okres zwrotu:</strong> 18-24 miesięcy</li>
                <li><strong>ROI 3-letni:</strong> 150-250%</li>
                <li><strong>Redukcja kosztów operacyjnych:</strong> 15-25%</li>
                <li><strong>Wzrost przychodów cyfrowych:</strong> 20-40%</li>
            </ul>
        </div>

        <div class="footer">
            <p>
                📋 Raport wygenerowany przez Consultify AI | 
                Data: ${new Date().toLocaleString('pl-PL')} | 
                Projekt: ${projectName}
            </p>
            <p>© ${new Date().getFullYear()} DBR77 Digital Transformation Platform</p>
        </div>
    </div>
</body>
</html>
`;

    return report;
}

function generateInitiativesForAssessment(assessment) {
    const axisScores = JSON.parse(assessment.axis_scores || '{}');
    const initiatives = [];
    const projectId = assessment.project_id;
    const orgId = assessment.organization_id;

    // Priority mapping based on gaps
    const sortedAxes = Object.entries(axisScores)
        .filter(([_, s]) => s && (s.target - s.actual) >= 1)
        .sort(([_, a], [__, b]) => (b.target - b.actual) - (a.target - a.actual));

    // Generate initiatives for top gaps
    sortedAxes.forEach(([key, score], idx) => {
        const gap = score.target - score.actual;
        const axisName = DRD_AXES[key] || key;
        const priority = gap >= 2 ? 'HIGH' : gap >= 1.5 ? 'MEDIUM' : 'LOW';

        // Define initiatives per axis
        const axisInitiatives = getInitiativesForAxis(key, gap, score);
        
        axisInitiatives.forEach((init, initIdx) => {
            initiatives.push({
                id: uuidv4(),
                organization_id: orgId,
                project_id: projectId,
                name: init.name,
                description: init.description,
                axis: key,
                area: axisName,
                summary: init.summary,
                hypothesis: init.hypothesis,
                status: 'PROPOSED',
                current_stage: 'INITIATION',
                business_value: init.businessValue,
                cost_capex: init.costCapex,
                cost_opex: init.costOpex,
                expected_roi: init.expectedRoi,
                priority: priority,
                problem_statement: init.problemStatement,
                deliverables: JSON.stringify(init.deliverables || []),
                success_criteria: JSON.stringify(init.successCriteria || []),
                scope_in: JSON.stringify(init.scopeIn || []),
                scope_out: JSON.stringify(init.scopeOut || []),
                key_risks: JSON.stringify(init.keyRisks || []),
                value_driver: init.valueDriver,
                confidence_level: init.confidenceLevel,
                value_timing: init.valueTiming,
                planned_start_date: getPlannedStartDate(idx, initIdx),
                planned_end_date: getPlannedEndDate(idx, initIdx, init.durationMonths || 6),
                target_quarter: getTargetQuarter(idx),
                strategic_intent: init.strategicIntent,
                created_from: 'AI_GENERATED',
                gap_justification: `Luka ${gap.toFixed(1)} punktu w osi ${axisName}. ${score.justification}`
            });
        });
    });

    return initiatives;
}

function getInitiativesForAxis(axisKey, gap, score) {
    const initiatives = {
        processes: [
            {
                name: 'RPA Center of Excellence',
                description: 'Utworzenie centrum kompetencji automatyzacji procesów z wykorzystaniem robotyki programowej (RPA)',
                summary: 'Wdrożenie platformy RPA i automatyzacja 20 kluczowych procesów biznesowych w ciągu 12 miesięcy',
                hypothesis: 'Automatyzacja procesów o wysokiej powtarzalności przyniesie redukcję kosztów operacyjnych o 25-35%',
                problemStatement: 'Procesy manualne generują wysokie koszty operacyjne i są podatne na błędy ludzkie',
                businessValue: 'Redukcja kosztów operacyjnych o 1.2M PLN rocznie, skrócenie czasu obsługi o 60%',
                costCapex: 400000,
                costOpex: 80000,
                expectedRoi: 180,
                deliverables: [
                    'Platforma RPA (UiPath/Automation Anywhere)',
                    '20 zautomatyzowanych procesów',
                    'Zespół RPA (3 deweloperów)',
                    'Governance i standardy'
                ],
                successCriteria: [
                    'Automatyzacja 20 procesów w 12 miesięcy',
                    'ROI > 150% w 18 miesięcy',
                    'Redukcja błędów o 90%'
                ],
                scopeIn: ['Procesy finansowe', 'Procesy HR', 'Procesy operacyjne'],
                scopeOut: ['Procesy produkcyjne', 'Procesy wymagające decyzji'],
                keyRisks: [
                    { risk: 'Opór zespołów', probability: 'MEDIUM', impact: 'HIGH', mitigation: 'Change management' },
                    { risk: 'Złożoność integracji', probability: 'MEDIUM', impact: 'MEDIUM', mitigation: 'PoC dla każdego procesu' }
                ],
                valueDriver: 'EFFICIENCY',
                confidenceLevel: 'HIGH',
                valueTiming: 'MEDIUM_TERM',
                strategicIntent: 'Operacyjna doskonałość poprzez automatyzację',
                durationMonths: 12
            },
            {
                name: 'Process Mining & Optimization',
                description: 'Wdrożenie narzędzi process mining do identyfikacji nieefektywności i optymalizacji procesów',
                summary: 'Analiza i optymalizacja procesów biznesowych w oparciu o dane z systemów transakcyjnych',
                hypothesis: 'Analiza process mining ujawni 30% nieefektywności ukrytych w procesach',
                problemStatement: 'Brak widoczności rzeczywistego przebiegu procesów uniemożliwia ich optymalizację',
                businessValue: 'Identyfikacja oszczędności 800K PLN rocznie, skrócenie cykli o 25%',
                costCapex: 250000,
                costOpex: 50000,
                expectedRoi: 220,
                deliverables: ['Platforma Celonis/ProcessGold', 'Mapa 50 procesów', 'Rekomendacje optymalizacyjne'],
                successCriteria: ['Mapowanie 50 procesów', 'Identyfikacja 10 quick wins', 'Wdrożenie 5 optymalizacji'],
                valueDriver: 'EFFICIENCY',
                confidenceLevel: 'HIGH',
                valueTiming: 'SHORT_TERM',
                strategicIntent: 'Data-driven process optimization',
                durationMonths: 6
            }
        ],
        digitalProducts: [
            {
                name: 'Digital Product Platform',
                description: 'Budowa platformy do szybkiego rozwoju i wdrażania produktów cyfrowych',
                summary: 'Utworzenie środowiska technologicznego i metodycznego dla rozwoju produktów cyfrowych',
                hypothesis: 'Platforma produktowa skróci time-to-market nowych funkcji o 50%',
                problemStatement: 'Brak ustandaryzowanej platformy spowalnia rozwój produktów cyfrowych',
                businessValue: 'Przyspieszenie TTM o 50%, redukcja kosztów rozwoju o 30%',
                costCapex: 600000,
                costOpex: 120000,
                expectedRoi: 150,
                deliverables: ['Platform engineering', 'CI/CD pipelines', 'API Gateway', 'Developer portal'],
                successCriteria: ['TTM < 4 tygodnie', 'Deployment frequency > 1/tydzień', 'Lead time < 24h'],
                valueDriver: 'GROWTH',
                confidenceLevel: 'MEDIUM',
                valueTiming: 'MEDIUM_TERM',
                strategicIntent: 'Accelerated digital product delivery',
                durationMonths: 9
            },
            {
                name: 'IoT Product Enhancement',
                description: 'Wzbogacenie produktów fizycznych o komponenty IoT i cyfrowe usługi',
                summary: 'Integracja sensorów IoT i platformy danych z produktami dla nowych modeli przychodowych',
                hypothesis: 'Produkty IoT-enabled wygenerują 15% dodatkowych przychodów z usług',
                problemStatement: 'Produkty fizyczne nie generują przychodów po sprzedaży',
                businessValue: 'Nowe przychody z usług cyfrowych: 2M PLN/rok',
                costCapex: 800000,
                costOpex: 150000,
                expectedRoi: 180,
                deliverables: ['Sensory IoT w produktach', 'Platforma danych IoT', 'Aplikacja mobilna', 'Model subskrypcyjny'],
                successCriteria: ['IoT w 30% produktów', 'ARR > 1.5M PLN', 'NPS > 50'],
                valueDriver: 'REVENUE',
                confidenceLevel: 'MEDIUM',
                valueTiming: 'LONG_TERM',
                strategicIntent: 'Product-as-a-Service transformation',
                durationMonths: 12
            }
        ],
        businessModels: [
            {
                name: 'Subscription Business Pilot',
                description: 'Pilotaż modelu subskrypcyjnego dla wybranych produktów/usług',
                summary: 'Testowanie i walidacja modelu recurring revenue na wybranym segmencie',
                hypothesis: 'Model subskrypcyjny zwiększy LTV klienta o 40% i ustabilizuje przychody',
                problemStatement: 'Przychody jednorazowe są nieprzewidywalne i nie budują wartości długoterminowej',
                businessValue: 'ARR 3M PLN w 18 miesięcy, retention > 85%',
                costCapex: 200000,
                costOpex: 50000,
                expectedRoi: 250,
                deliverables: ['Model cenowy', 'Platforma billing', 'Proces onboarding', 'Success metrics'],
                successCriteria: ['1000 subskrybentów', 'Churn < 5%/miesiąc', 'NRR > 110%'],
                valueDriver: 'REVENUE',
                confidenceLevel: 'MEDIUM',
                valueTiming: 'MEDIUM_TERM',
                strategicIntent: 'Recurring revenue transformation',
                durationMonths: 6
            }
        ],
        dataManagement: [
            {
                name: 'Enterprise Data Platform',
                description: 'Budowa nowoczesnej platformy danych z Data Lakehouse i self-service analytics',
                summary: 'Unified data platform umożliwiająca demokratyzację dostępu do danych i zaawansowaną analitykę',
                hypothesis: 'Platforma danych skróci czas dostępu do insightów z tygodni do minut',
                problemStatement: 'Dane są rozproszone w silosach, dostęp wymaga IT, brak single source of truth',
                businessValue: 'Redukcja czasu raportowania o 80%, lepsze decyzje = 5% wzrost marży',
                costCapex: 500000,
                costOpex: 100000,
                expectedRoi: 200,
                deliverables: ['Data Lakehouse (Databricks/Snowflake)', 'Data Catalog', 'BI Self-service', 'Data Governance'],
                successCriteria: ['100% krytycznych danych w platformie', '50 aktywnych użytkowników BI', 'Query < 10s'],
                valueDriver: 'EFFICIENCY',
                confidenceLevel: 'HIGH',
                valueTiming: 'MEDIUM_TERM',
                strategicIntent: 'Data-driven organization',
                durationMonths: 9
            }
        ],
        culture: [
            {
                name: 'Digital Culture Transformation Program',
                description: 'Kompleksowy program transformacji kulturowej organizacji w kierunku cyfrowym',
                summary: 'Budowanie kultury cyfrowej poprzez szkolenia, digital champions i nowe sposoby pracy',
                hypothesis: 'Zmiana kulturowa jest warunkiem koniecznym skutecznej transformacji cyfrowej',
                problemStatement: 'Opór przed zmianami i brak kompetencji cyfrowych blokują transformację',
                businessValue: 'Przyspieszenie adopcji technologii o 50%, redukcja turnover o 20%',
                costCapex: 300000,
                costOpex: 100000,
                expectedRoi: 120,
                deliverables: ['Program Digital Champions', 'Akademia cyfrowa', 'Agile transformation', 'Leadership coaching'],
                successCriteria: ['100 digital champions', 'eNPS > 30', '80% pracowników przeszkolonych'],
                valueDriver: 'CAPABILITY',
                confidenceLevel: 'MEDIUM',
                valueTiming: 'LONG_TERM',
                strategicIntent: 'Building digital-first organization',
                durationMonths: 18
            }
        ],
        cybersecurity: [
            {
                name: 'Zero Trust Security Architecture',
                description: 'Wdrożenie architektury Zero Trust dla kompleksowej ochrony zasobów cyfrowych',
                summary: 'Transformacja bezpieczeństwa z modelu perimeter-based do Zero Trust',
                hypothesis: 'Zero Trust zredukuje ryzyko naruszenia bezpieczeństwa o 70%',
                problemStatement: 'Tradycyjne zabezpieczenia nie chronią przed zaawansowanymi atakami i insider threats',
                businessValue: 'Redukcja ryzyka o 70%, uniknięcie kosztów incydentów: ~5M PLN/rok',
                costCapex: 600000,
                costOpex: 120000,
                expectedRoi: 150,
                deliverables: ['Identity & Access Management', 'Micro-segmentation', 'SASE/SSE', 'Security monitoring'],
                successCriteria: ['Zero breaches', 'MTTR < 1h', '100% MFA adoption'],
                valueDriver: 'RISK_REDUCTION',
                confidenceLevel: 'HIGH',
                valueTiming: 'MEDIUM_TERM',
                strategicIntent: 'Security as business enabler',
                durationMonths: 12
            }
        ],
        aiMaturity: [
            {
                name: 'AI Center of Excellence',
                description: 'Utworzenie centrum kompetencji AI/ML z zespołem data science i platformą MLOps',
                summary: 'Budowa wewnętrznych kompetencji AI i infrastruktury do skalowania rozwiązań ML',
                hypothesis: 'Wewnętrzne AI CoE pozwoli na 10x szybsze wdrażanie rozwiązań AI',
                problemStatement: 'Brak kompetencji i infrastruktury AI uniemożliwia wykorzystanie potencjału danych',
                businessValue: 'Wartość z use case\'ów AI: 3M PLN/rok, przewaga konkurencyjna',
                costCapex: 800000,
                costOpex: 200000,
                expectedRoi: 180,
                deliverables: ['Zespół Data Science (5 osób)', 'MLOps platform', '5 wdrożonych modeli ML', 'AI governance'],
                successCriteria: ['5 modeli produkcyjnych', 'Model accuracy > 85%', 'Time to production < 4 tygodnie'],
                valueDriver: 'INNOVATION',
                confidenceLevel: 'MEDIUM',
                valueTiming: 'LONG_TERM',
                strategicIntent: 'AI-first competitive advantage',
                durationMonths: 12
            },
            {
                name: 'Predictive Analytics Quick Wins',
                description: 'Szybkie wdrożenia predykcyjnej analityki w kluczowych obszarach biznesowych',
                summary: 'Pilotaże ML w obszarach z najwyższym ROI: demand forecasting, predictive maintenance, churn prediction',
                hypothesis: 'Quick wins w AI zbudują momentum i uzasadnią większe inwestycje',
                problemStatement: 'Decyzje podejmowane reaktywnie zamiast proaktywnie',
                businessValue: 'Oszczędności 1.5M PLN/rok z lepszych prognoz i predykcji',
                costCapex: 300000,
                costOpex: 60000,
                expectedRoi: 300,
                deliverables: ['Demand forecasting model', 'Predictive maintenance PoC', 'Churn prediction model'],
                successCriteria: ['Forecast accuracy > 90%', 'Downtime reduction 30%', 'Churn reduction 20%'],
                valueDriver: 'EFFICIENCY',
                confidenceLevel: 'HIGH',
                valueTiming: 'SHORT_TERM',
                strategicIntent: 'Prove AI value fast',
                durationMonths: 6
            }
        ]
    };

    return initiatives[axisKey] || [];
}

function getPlannedStartDate(axisIdx, initIdx) {
    const baseDate = new Date();
    baseDate.setMonth(baseDate.getMonth() + (axisIdx * 3) + (initIdx * 2));
    return baseDate.toISOString().split('T')[0];
}

function getPlannedEndDate(axisIdx, initIdx, durationMonths) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() + (axisIdx * 3) + (initIdx * 2) + durationMonths);
    return startDate.toISOString().split('T')[0];
}

function getTargetQuarter(axisIdx) {
    const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
    const currentYear = new Date().getFullYear();
    const targetQuarter = ((currentQuarter + Math.floor(axisIdx / 2)) % 4) + 1;
    const targetYear = currentYear + Math.floor((currentQuarter + Math.floor(axisIdx / 2) - 1) / 4);
    return `Q${targetQuarter} ${targetYear}`;
}

async function saveReport(projectId, reportHtml, projectName) {
    const reportId = uuidv4();
    
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO assessment_reports (id, project_id, report_type, title, content, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [reportId, projectId, 'FULL_ASSESSMENT', `Raport DRD - ${projectName}`, reportHtml, 'GENERATED'],
            function(err) {
                if (err) {
                    // Table might not exist
                    console.log('Note: assessment_reports table may not exist, saving to file only');
                    resolve({ id: reportId, savedToDb: false });
                } else {
                    resolve({ id: reportId, savedToDb: true });
                }
            }
        );
    });
}

async function saveInitiatives(initiatives) {
    const results = [];
    
    for (const init of initiatives) {
        try {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR REPLACE INTO initiatives 
                     (id, organization_id, project_id, name, description, axis, area, summary, hypothesis, 
                      status, current_stage, business_value, cost_capex, cost_opex, expected_roi, priority,
                      problem_statement, deliverables, success_criteria, scope_in, scope_out, key_risks,
                      value_driver, confidence_level, value_timing, planned_start_date, planned_end_date,
                      target_quarter, strategic_intent, created_from, gap_justification, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                    [init.id, init.organization_id, init.project_id, init.name, init.description, 
                     init.axis, init.area, init.summary, init.hypothesis, init.status, init.current_stage,
                     init.business_value, init.cost_capex, init.cost_opex, init.expected_roi, init.priority,
                     init.problem_statement, init.deliverables, init.success_criteria, init.scope_in, init.scope_out,
                     init.key_risks, init.value_driver, init.confidence_level, init.value_timing,
                     init.planned_start_date, init.planned_end_date, init.target_quarter, init.strategic_intent,
                     init.created_from, init.gap_justification],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                    }
                );
            });
            results.push({ id: init.id, name: init.name, status: 'created' });
        } catch (err) {
            results.push({ id: init.id, name: init.name, status: 'error', error: err.message });
        }
    }
    
    return results;
}

async function main() {
    console.log('🚀 Starting Report & Initiative Generation...\n');
    
    const fs = require('fs');
    const path = require('path');
    const outputDir = path.join(__dirname, '../output/sample_reports');
    
    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    for (const project of SAMPLE_PROJECTS) {
        console.log(`\n📊 Processing: ${project.name}`);
        console.log('─'.repeat(50));
        
        try {
            // Get assessment
            const assessment = await getAssessment(project.projectId);
            
            if (!assessment) {
                console.log(`   ⚠️  No assessment found for project ${project.projectId}`);
                continue;
            }
            
            // Generate report
            console.log('   📝 Generating comprehensive report...');
            const reportHtml = generateComprehensiveReport(assessment);
            
            // Save report to file
            const reportFileName = `report_${project.projectId.slice(0, 8)}.html`;
            fs.writeFileSync(path.join(outputDir, reportFileName), reportHtml);
            console.log(`   ✅ Report saved: ${reportFileName}`);
            
            // Save to DB
            const reportResult = await saveReport(project.projectId, reportHtml, project.name);
            console.log(`   ${reportResult.savedToDb ? '✅' : 'ℹ️'} Report ${reportResult.savedToDb ? 'saved to DB' : 'generated'}: ${reportResult.id}`);
            
            // Generate initiatives
            console.log('   🎯 Generating initiatives...');
            const initiatives = generateInitiativesForAssessment(assessment);
            console.log(`   📋 Created ${initiatives.length} initiatives`);
            
            // Save initiatives
            const initResults = await saveInitiatives(initiatives);
            const successCount = initResults.filter(r => r.status === 'created').length;
            console.log(`   ✅ Saved ${successCount}/${initiatives.length} initiatives to database`);
            
            // List initiatives
            console.log('\n   📋 Generated Initiatives:');
            initiatives.forEach((init, idx) => {
                console.log(`      ${idx + 1}. ${init.name} (${init.axis}) - ${init.priority}`);
            });
            
        } catch (err) {
            console.error(`   ❌ Error processing ${project.name}:`, err.message);
        }
    }
    
    console.log('\n' + '═'.repeat(50));
    console.log('✅ Generation complete!');
    console.log(`📂 Reports saved to: ${outputDir}`);
    console.log('═'.repeat(50));
    
    // Close database
    db.close();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});









