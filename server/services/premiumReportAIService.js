/**
 * Premium Report AI Service
 * 
 * McKinsey/BCG-grade content generation using Pyramid Principle
 * and professional consulting frameworks.
 */

const AiService = require('./aiService');
const db = require('../database');

class PremiumReportAIService {
    constructor() {
        this.aiService = AiService;
    }

    /**
     * System prompt for McKinsey-grade content
     */
    getSystemPrompt() {
        return `Jesteś senior partnerem w wiodącej firmie konsultingowej (McKinsey, BCG, Bain).
Tworzysz raporty oceny dojrzałości cyfrowej dla kadry zarządzającej (CEO, CTO, Board).

ZASADY KOMUNIKACJI:
1. **Pyramid Principle** - Zawsze zacznij od głównej konkluzji, potem podaj argumenty wspierające
2. **MECE** - Strukturyzuj treści: Mutually Exclusive, Collectively Exhaustive
3. **Action Titles** - Każda sekcja ma tytuł akcji (co zrobić, nie co jest)
4. **So-What Test** - Każde stwierdzenie musi odpowiadać na pytanie "i co z tego?"
5. **Quantify Impact** - Podawaj liczby, procenty, ROI gdzie możliwe

STYL:
- Pewny, ale nie arogancki
- Strategiczny, nie techniczny (unikaj żargonu IT)
- Konkretny z rekomendacjami (kto, co, kiedy)
- Executive-level language (zwięźle, na temat)

FORMAT ODPOWIEDZI:
- Używaj markdown
- Nagłówki: ## dla głównych sekcji, ### dla podsekcji
- Listy numerowane dla kroków/rekomendacji
- **Pogrubienie** dla kluczowych wniosków
- Tabele dla porównań i metryk`;
    }

    /**
     * Generate Executive Summary
     */
    async generateExecutiveSummary(assessmentId, options = {}) {
        const assessment = await this.getAssessmentData(assessmentId);

        const prompt = `Na podstawie poniższych danych z oceny dojrzałości cyfrowej, 
napisz Executive Summary dla zarządu (maksymalnie 400 słów).

DANE ASSESSMENT:
- Organizacja: ${assessment.organizationName}
- Średnia dojrzałość: ${assessment.avgActual}/7
- Cel dojrzałości: ${assessment.avgTarget}/7  
- Całkowita luka: ${assessment.totalGap} punktów

WYNIKI PO OSIACH:
${assessment.axes.map(a => `- ${a.name}: ${a.actual}/7 (cel: ${a.target}, luka: ${a.gap})`).join('\n')}

STRUKTURA ODPOWIEDZI:
1. **Główna konkluzja** (1-2 zdania) - najważniejszy wniosek
2. **Kluczowe odkrycia** (3 bullet points) - co wykazała analiza
3. **Strategiczne priorytety** (3 numerowane) - gdzie skupić wysiłki, z szacowanym ROI
4. **Rekomendowany następny krok** (1 zdanie) - konkretne działanie z timeline`;

        const response = await this.aiService.generateText({
            systemPrompt: this.getSystemPrompt(),
            userPrompt: prompt,
            temperature: 0.7,
            maxTokens: 1500
        });

        return {
            content: response.text,
            keyInsights: this.extractKeyInsights(response.text),
            metrics: assessment.metrics
        };
    }

    /**
     * Generate Gap Analysis section
     */
    async generateGapAnalysis(assessmentId, options = {}) {
        const assessment = await this.getAssessmentData(assessmentId);

        // Sort axes by gap (descending)
        const sortedAxes = [...assessment.axes].sort((a, b) => b.gap - a.gap);
        const criticalGaps = sortedAxes.filter(a => a.gap >= 1.5);
        const moderateGaps = sortedAxes.filter(a => a.gap >= 0.5 && a.gap < 1.5);

        const prompt = `Napisz sekcję Analiza Luk dla raportu oceny dojrzałości cyfrowej.

DANE:
Krytyczne luki (>1.5 pkt):
${criticalGaps.map(a => `- ${a.name}: luka ${a.gap.toFixed(1)} pkt (${a.actual}→${a.target})`).join('\n')}

Umiarkowane luki (0.5-1.5 pkt):
${moderateGaps.map(a => `- ${a.name}: luka ${a.gap.toFixed(1)} pkt`).join('\n')}

STRUKTURA:
1. **Podsumowanie sytuacji** - 2-3 zdania o ogólnym stanie
2. **Krytyczne obszary** - szczegółowa analiza największych luk, implikacje biznesowe
3. **Obszary do obserwacji** - umiarkowane luki, potencjalne ryzyka
4. **Mocne strony** - obszary z małą luką jako fundament transformacji
5. **Priorytetyzacja** - rekomendowana kolejność działań (Quick Wins vs Strategic)`;

        const response = await this.aiService.generateText({
            systemPrompt: this.getSystemPrompt(),
            userPrompt: prompt,
            temperature: 0.7,
            maxTokens: 2000
        });

        return {
            content: response.text,
            criticalGaps,
            moderateGaps
        };
    }

    /**
     * Generate Strategic Recommendations
     */
    async generateRecommendations(assessmentId, options = {}) {
        const assessment = await this.getAssessmentData(assessmentId);
        const { maxRecommendations = 10 } = options;

        const prompt = `Wygeneruj ${maxRecommendations} strategicznych rekomendacji dla transformacji cyfrowej.

KONTEKST:
Organizacja: ${assessment.organizationName}
Główne luki: ${assessment.axes.slice(0, 3).map(a => a.name).join(', ')}
Cel: podniesienie dojrzałości z ${assessment.avgActual.toFixed(1)} do ${assessment.avgTarget.toFixed(1)}

DLA KAŻDEJ REKOMENDACJI PODAJ:
1. **Tytuł akcji** (co zrobić, np. "Wdrożyć centralną platformę danych")
2. **Opis** (2-3 zdania - co dokładnie i dlaczego)
3. **Priorytet**: Krytyczny / Wysoki / Średni / Niski
4. **Wpływ**: Wysoki / Średni / Niski
5. **Nakład pracy**: Duży / Średni / Mały
6. **Timeline**: Q1/Q2/Q3/Q4 2025 lub konkretny okres
7. **Szacowany ROI**: orientacyjny % lub "znaczący"
8. **Właściciel**: rola odpowiedzialna (CTO, COO, CDO, etc.)

FORMAT: Użyj markdown z numeracją 1-${maxRecommendations}`;

        const response = await this.aiService.generateText({
            systemPrompt: this.getSystemPrompt(),
            userPrompt: prompt,
            temperature: 0.7,
            maxTokens: 3000
        });

        return {
            content: response.text,
            recommendations: this.parseRecommendations(response.text)
        };
    }

    /**
     * Generate Transformation Roadmap
     */
    async generateRoadmap(assessmentId, options = {}) {
        const assessment = await this.getAssessmentData(assessmentId);
        const { horizonMonths = 18 } = options;

        const prompt = `Stwórz ${horizonMonths}-miesięczną roadmapę transformacji cyfrowej.

KONTEKST:
Organizacja: ${assessment.organizationName}
Start: Styczeń 2025
Cel: Dojrzałość ${assessment.avgTarget.toFixed(1)}/7

GŁÓWNE LUKI DO ZAMKNIĘCIA:
${assessment.axes.sort((a, b) => b.gap - a.gap).slice(0, 5).map(a => `- ${a.name}: +${a.gap.toFixed(1)} pkt`).join('\n')}

STRUKTURA ROADMAPY:

## Faza 1: Fundamenty (Miesiące 1-4)
- Cele tej fazy
- Kluczowe inicjatywy (2-3)
- Kamienie milowe

## Faza 2: Budowanie Zdolności (Miesiące 5-10)
- Cele tej fazy
- Kluczowe inicjatywy (3-4)
- Kamienie milowe

## Faza 3: Skalowanie (Miesiące 11-18)
- Cele tej fazy
- Kluczowe inicjatywy (2-3)
- Kamienie milowe

## Governance
- Struktura zarządzania zmianą
- Częstotliwość przeglądów
- KPIs do monitorowania`;

        const response = await this.aiService.generateText({
            systemPrompt: this.getSystemPrompt(),
            userPrompt: prompt,
            temperature: 0.7,
            maxTokens: 2500
        });

        return {
            content: response.text,
            phases: this.parseRoadmapPhases(response.text)
        };
    }

    /**
     * Generate ROI Analysis
     */
    async generateROIAnalysis(assessmentId, options = {}) {
        const assessment = await this.getAssessmentData(assessmentId);

        const prompt = `Przygotuj analizę ROI dla transformacji cyfrowej.

KONTEKST:
Organizacja: ${assessment.organizationName}
Luka do zamknięcia: ${assessment.totalGap.toFixed(1)} punktów dojrzałości
Horyzont: 18 miesięcy

STRUKTURA:

## Szacowane Korzyści
- Redukcja kosztów operacyjnych
- Wzrost przychodów / produktywności
- Redukcja ryzyka
- Poprawa satysfakcji klientów

## Wymagane Inwestycje
- Technologia i infrastruktura
- Ludzie i kompetencje
- Procesy i zmiana organizacyjna
- Szkolenia i zarządzanie zmianą

## Analiza Zwrotu
- Break-even point
- 3-letni ROI
- Payback period

## Ryzyka i Mitygacja
- Główne ryzyka programu
- Strategie mitygacji

Podaj konkretne liczby (nawet szacunkowe) dla większej wiarygodności.`;

        const response = await this.aiService.generateText({
            systemPrompt: this.getSystemPrompt(),
            userPrompt: prompt,
            temperature: 0.7,
            maxTokens: 2000
        });

        return {
            content: response.text
        };
    }

    /**
     * Generate custom section based on prompt
     */
    async generateCustomSection(assessmentId, customPrompt, options = {}) {
        const assessment = await this.getAssessmentData(assessmentId);

        const contextPrompt = `KONTEKST ASSESSMENT:
Organizacja: ${assessment.organizationName}
Średnia dojrzałość: ${assessment.avgActual.toFixed(1)}/7 (cel: ${assessment.avgTarget.toFixed(1)})
Osie: ${assessment.axes.map(a => `${a.name}(${a.actual.toFixed(1)})`).join(', ')}

ŻĄDANIE UŻYTKOWNIKA:
${customPrompt}

Napisz profesjonalną sekcję raportu zgodnie z powyższym żądaniem.`;

        const response = await this.aiService.generateText({
            systemPrompt: this.getSystemPrompt(),
            userPrompt: contextPrompt,
            temperature: 0.7,
            maxTokens: 2000
        });

        return {
            content: response.text
        };
    }

    /**
     * Get assessment data for AI context
     */
    async getAssessmentData(assessmentId) {
        // Get assessment
        const assessment = await new Promise((resolve, reject) => {
            db.get(
                `SELECT a.*, o.name as organization_name 
         FROM assessments a
         LEFT JOIN organizations o ON a.organization_id = o.id
         WHERE a.id = ?`,
                [assessmentId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!assessment) {
            throw new Error(`Assessment ${assessmentId} not found`);
        }

        // Get axis ratings
        const axisRatings = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM assessment_axis_ratings WHERE assessment_id = ?`,
                [assessmentId],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        // Format axes
        const axisNames = {
            processes: 'Procesy',
            digitalProducts: 'Produkty Cyfrowe',
            businessModels: 'Modele Biznesowe',
            dataManagement: 'Zarządzanie Danymi',
            culture: 'Kultura Organizacyjna',
            cybersecurity: 'Cyberbezpieczeństwo',
            aiMaturity: 'Dojrzałość AI'
        };

        const axes = axisRatings.map(ar => ({
            id: ar.axis_id,
            name: axisNames[ar.axis_id] || ar.axis_id,
            actual: ar.actual_level || 0,
            target: ar.target_level || 0,
            gap: Math.max(0, (ar.target_level || 0) - (ar.actual_level || 0))
        }));

        // Calculate aggregates
        const avgActual = axes.length > 0
            ? axes.reduce((sum, a) => sum + a.actual, 0) / axes.length
            : 0;
        const avgTarget = axes.length > 0
            ? axes.reduce((sum, a) => sum + a.target, 0) / axes.length
            : 0;
        const totalGap = axes.reduce((sum, a) => sum + a.gap, 0);

        return {
            id: assessment.id,
            name: assessment.name,
            organizationName: assessment.organization_name || 'Organizacja',
            axes: axes.sort((a, b) => b.gap - a.gap),
            avgActual,
            avgTarget,
            totalGap,
            metrics: {
                overallMaturity: avgActual.toFixed(1),
                targetMaturity: avgTarget.toFixed(1),
                totalGapPoints: totalGap.toFixed(1),
                estimatedROI: `${Math.round(120 + totalGap * 15)}%`
            }
        };
    }

    /**
     * Extract key insights from generated text
     */
    extractKeyInsights(text) {
        const insights = [];
        const lines = text.split('\n');

        for (const line of lines) {
            if (line.match(/^[\-\*]\s*\*\*/) || line.match(/^\d+\.\s*\*\*/)) {
                insights.push(line.replace(/^[\-\*\d\.]+\s*/, '').replace(/\*\*/g, '').trim());
            }
        }

        return insights.slice(0, 5);
    }

    /**
     * Parse recommendations from generated text
     */
    parseRecommendations(text) {
        const recommendations = [];
        const sections = text.split(/\n(?=\d+\.\s)/);

        for (const section of sections) {
            if (!section.match(/^\d+\./)) continue;

            const lines = section.split('\n');
            const titleMatch = lines[0].match(/^\d+\.\s*\*\*(.+?)\*\*/);

            if (titleMatch) {
                recommendations.push({
                    title: titleMatch[1].trim(),
                    description: lines.slice(1).join(' ').substring(0, 200),
                    priority: section.includes('Krytyczny') ? 'critical' :
                        section.includes('Wysoki') ? 'high' : 'medium'
                });
            }
        }

        return recommendations;
    }

    /**
     * Parse roadmap phases from generated text
     */
    parseRoadmapPhases(text) {
        const phases = [];
        const phaseMatches = text.matchAll(/##\s*Faza\s*(\d+)[:\s]*(.+?)(?=##|$)/gs);

        for (const match of phaseMatches) {
            phases.push({
                number: parseInt(match[1]),
                title: match[2].split('\n')[0].trim(),
                content: match[2].trim()
            });
        }

        return phases;
    }
}

module.exports = new PremiumReportAIService();
