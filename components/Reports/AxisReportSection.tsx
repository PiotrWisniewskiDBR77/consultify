/**
 * AxisReportSection Component
 * 
 * Complete axis section for DRD Enterprise Reports.
 * Structure (per BCG/McKinsey standards):
 * 
 * 1. Axis Overview (summary stats)
 * 2. Area Matrix Table (9 areas × 7 levels)
 * 3. Detailed Area Analysis (for each of 9 areas)
 *    - Current state description
 *    - Interview notes
 *    - Target state requirements
 *    - Recommendations
 *    - Risks & KPIs
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaMatrixTable, AreaAssessment, BUSINESS_AREAS } from './AreaMatrixTable';
import { AreaDetailCard, AreaDetailData, InterviewData } from './AreaDetailCard';

// ============================================================================
// TYPES
// ============================================================================

export interface AxisInfo {
    id: string;
    name: string;
    namePl: string;
    icon: string;
    description?: string;
    descriptionPl?: string;
}

export interface AxisReportData {
    axisInfo: AxisInfo;
    overallCurrentLevel: number;
    overallTargetLevel: number;
    areaAssessments: AreaAssessment[];
    areaDetails: AreaDetailData[];
    benchmarkComparison?: {
        industryAvg: number;
        topPerformers: number;
        position: 'below' | 'average' | 'above';
    };
    summary?: string;
    keyInsights?: string[];
}

interface AxisReportSectionProps {
    data: AxisReportData;
    language?: 'pl' | 'en';
    showAnimation?: boolean;
    onAreaSelect?: (areaId: string) => void;
    expandAllAreas?: boolean;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const KeyTakeawaysBox: React.FC<{
    insights: string[];
    language: 'pl' | 'en';
}> = ({ insights, language }) => {
    const isPolish = language === 'pl';
    
    return (
        <div className="key-takeaways">
            <div className="takeaways-header">
                <span className="icon">💡</span>
                <h4>{isPolish ? 'Kluczowe wnioski' : 'Key Takeaways'}</h4>
            </div>
            <ul>
                {insights.map((insight, i) => (
                    <li key={i}>{insight}</li>
                ))}
            </ul>
            
            <style>{`
                .key-takeaways {
                    background: linear-gradient(135deg, #fef3c710, #fef9c320);
                    border: 1px solid #fde047;
                    border-radius: 12px;
                    padding: 16px 20px;
                    margin: 24px 0;
                }
                
                .takeaways-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                
                .takeaways-header .icon {
                    font-size: 24px;
                }
                
                .takeaways-header h4 {
                    margin: 0;
                    font-size: 15px;
                    font-weight: 600;
                    color: #854d0e;
                }
                
                .key-takeaways ul {
                    margin: 0;
                    padding-left: 20px;
                }
                
                .key-takeaways li {
                    margin-bottom: 8px;
                    color: #713f12;
                    font-size: 14px;
                    line-height: 1.5;
                }
            `}</style>
        </div>
    );
};

const BenchmarkComparison: React.FC<{
    current: number;
    target: number;
    benchmark: NonNullable<AxisReportData['benchmarkComparison']>;
    axisName: string;
    language: 'pl' | 'en';
}> = ({ current, target, benchmark, axisName, language }) => {
    const isPolish = language === 'pl';
    const maxLevel = 7;
    
    const positionLabel = {
        below: isPolish ? 'Poniżej średniej' : 'Below average',
        average: isPolish ? 'Na poziomie branży' : 'Industry average',
        above: isPolish ? 'Powyżej średniej' : 'Above average',
    }[benchmark.position];
    
    const positionColor = {
        below: '#ef4444',
        average: '#eab308',
        above: '#22c55e',
    }[benchmark.position];
    
    return (
        <div className="benchmark-comparison">
            <h4>🏭 {isPolish ? 'Pozycja względem branży' : 'Industry Position'}</h4>
            
            <div className="benchmark-bar-container">
                <div className="benchmark-bar">
                    {/* Industry average marker */}
                    <div 
                        className="marker industry-avg"
                        style={{ left: `${(benchmark.industryAvg / maxLevel) * 100}%` }}
                    >
                        <div className="marker-line"></div>
                        <div className="marker-label">{isPolish ? 'Średnia' : 'Avg'}: {benchmark.industryAvg}</div>
                    </div>
                    
                    {/* Top performers marker */}
                    <div 
                        className="marker top-performers"
                        style={{ left: `${(benchmark.topPerformers / maxLevel) * 100}%` }}
                    >
                        <div className="marker-line"></div>
                        <div className="marker-label">{isPolish ? 'Liderzy' : 'Leaders'}: {benchmark.topPerformers}</div>
                    </div>
                    
                    {/* Current position */}
                    <div 
                        className="current-position"
                        style={{ width: `${(current / maxLevel) * 100}%` }}
                    >
                        <span className="position-value">{current}</span>
                    </div>
                    
                    {/* Target marker */}
                    <div 
                        className="target-marker"
                        style={{ left: `${(target / maxLevel) * 100}%` }}
                    >
                        <div className="target-line"></div>
                        <div className="target-label">{isPolish ? 'Cel' : 'Target'}: {target}</div>
                    </div>
                </div>
                
                <div className="scale-labels">
                    {[1, 2, 3, 4, 5, 6, 7].map(n => (
                        <span key={n}>{n}</span>
                    ))}
                </div>
            </div>
            
            <div className="position-badge" style={{ background: `${positionColor}15`, color: positionColor }}>
                {positionLabel}
            </div>
            
            <style>{`
                .benchmark-comparison {
                    background: #f8fafc;
                    border-radius: 12px;
                    padding: 20px;
                    margin: 24px 0;
                }
                
                .benchmark-comparison h4 {
                    margin: 0 0 20px 0;
                    font-size: 15px;
                    font-weight: 600;
                    color: #1e1b4b;
                }
                
                .benchmark-bar-container {
                    position: relative;
                    margin: 40px 0 30px;
                }
                
                .benchmark-bar {
                    position: relative;
                    height: 32px;
                    background: #e5e7eb;
                    border-radius: 16px;
                    overflow: visible;
                }
                
                .current-position {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    background: linear-gradient(90deg, #3b82f6, #60a5fa);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding-right: 12px;
                    transition: width 0.5s ease;
                }
                
                .position-value {
                    font-weight: 700;
                    color: white;
                    font-size: 14px;
                }
                
                .marker {
                    position: absolute;
                    top: -25px;
                    transform: translateX(-50%);
                    z-index: 2;
                }
                
                .marker-line {
                    width: 2px;
                    height: 55px;
                    margin: 0 auto;
                }
                
                .marker-label {
                    font-size: 11px;
                    white-space: nowrap;
                    text-align: center;
                    margin-top: 4px;
                }
                
                .marker.industry-avg .marker-line {
                    background: #64748b;
                }
                
                .marker.industry-avg .marker-label {
                    color: #64748b;
                }
                
                .marker.top-performers .marker-line {
                    background: #22c55e;
                }
                
                .marker.top-performers .marker-label {
                    color: #22c55e;
                }
                
                .target-marker {
                    position: absolute;
                    top: 4px;
                    bottom: 4px;
                    transform: translateX(-50%);
                    z-index: 1;
                }
                
                .target-line {
                    width: 4px;
                    height: 100%;
                    background: #10b981;
                    border-radius: 2px;
                }
                
                .target-label {
                    position: absolute;
                    bottom: -22px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 11px;
                    color: #10b981;
                    white-space: nowrap;
                }
                
                .scale-labels {
                    display: flex;
                    justify-content: space-between;
                    padding: 0 4px;
                    margin-top: 8px;
                    font-size: 11px;
                    color: #94a3b8;
                }
                
                .position-badge {
                    display: inline-block;
                    padding: 6px 16px;
                    border-radius: 20px;
                    font-size: 13px;
                    font-weight: 600;
                    margin-top: 16px;
                }
            `}</style>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AxisReportSection: React.FC<AxisReportSectionProps> = ({
    data,
    language = 'pl',
    showAnimation = true,
    onAreaSelect,
    expandAllAreas = false,
}) => {
    const [selectedArea, setSelectedArea] = useState<string | null>(null);
    const isPolish = language === 'pl';
    
    // Calculate statistics
    const stats = useMemo(() => {
        const assessed = data.areaAssessments.filter(a => a.currentLevel > 0);
        const totalGap = assessed.reduce((sum, a) => sum + (a.targetLevel - a.currentLevel), 0);
        const criticalAreas = assessed.filter(a => (a.targetLevel - a.currentLevel) >= 3).length;
        const highPriorityAreas = assessed.filter(a => (a.targetLevel - a.currentLevel) >= 2).length;
        
        return {
            assessedCount: assessed.length,
            avgGap: assessed.length > 0 ? (totalGap / assessed.length).toFixed(1) : '0',
            criticalAreas,
            highPriorityAreas,
            totalGap,
        };
    }, [data.areaAssessments]);
    
    // Generate key insights if not provided
    const insights = data.keyInsights || [
        `${isPolish ? 'Oceniono' : 'Assessed'} ${stats.assessedCount}/9 ${isPolish ? 'obszarów' : 'areas'} ${isPolish ? 'w tej osi' : 'in this axis'}`,
        stats.criticalAreas > 0 
            ? `${stats.criticalAreas} ${isPolish ? 'obszarów wymaga pilnej uwagi (luka ≥3)' : 'areas require urgent attention (gap ≥3)'}`
            : `${isPolish ? 'Brak krytycznych luk transformacyjnych' : 'No critical transformation gaps'}`,
        `${isPolish ? 'Średnia luka transformacyjna' : 'Average transformation gap'}: ${stats.avgGap} ${isPolish ? 'poziomów' : 'levels'}`,
    ];
    
    const handleAreaClick = (areaId: string) => {
        setSelectedArea(areaId === selectedArea ? null : areaId);
        onAreaSelect?.(areaId);
    };
    
    // Sort areas by gap (highest priority first)
    const sortedAreaDetails = useMemo(() => {
        return [...data.areaDetails].sort((a, b) => {
            const gapA = a.targetLevel - a.currentLevel;
            const gapB = b.targetLevel - b.currentLevel;
            return gapB - gapA; // Descending by gap
        });
    }, [data.areaDetails]);
    
    return (
        <motion.div
            className="axis-report-section"
            initial={showAnimation ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            {/* Section Header */}
            <div className="section-header">
                <div className="header-content">
                    <span className="axis-icon">{data.axisInfo.icon}</span>
                    <div className="header-titles">
                        <h2>{isPolish ? data.axisInfo.namePl : data.axisInfo.name}</h2>
                        <p className="axis-description">
                            {isPolish ? data.axisInfo.descriptionPl : data.axisInfo.description}
                        </p>
                    </div>
                </div>
                
                <div className="level-summary">
                    <div className="level-card current">
                        <span className="value">{data.overallCurrentLevel.toFixed(1)}</span>
                        <span className="label">{isPolish ? 'Aktualny' : 'Current'}</span>
                    </div>
                    <span className="arrow">→</span>
                    <div className="level-card target">
                        <span className="value">{data.overallTargetLevel.toFixed(1)}</span>
                        <span className="label">{isPolish ? 'Docelowy' : 'Target'}</span>
                    </div>
                    <div className="level-card gap">
                        <span className="value">+{(data.overallTargetLevel - data.overallCurrentLevel).toFixed(1)}</span>
                        <span className="label">{isPolish ? 'Luka' : 'Gap'}</span>
                    </div>
                </div>
            </div>
            
            {/* Key Takeaways */}
            <KeyTakeawaysBox insights={insights} language={language} />
            
            {/* Area Matrix Table */}
            <AreaMatrixTable
                axisId={data.axisInfo.id}
                axisName={isPolish ? data.axisInfo.namePl : data.axisInfo.name}
                axisIcon={data.axisInfo.icon}
                areaAssessments={data.areaAssessments}
                onAreaClick={handleAreaClick}
                language={language}
                showAnimation={showAnimation}
            />
            
            {/* Benchmark Comparison (if available) */}
            {data.benchmarkComparison && (
                <BenchmarkComparison
                    current={data.overallCurrentLevel}
                    target={data.overallTargetLevel}
                    benchmark={data.benchmarkComparison}
                    axisName={isPolish ? data.axisInfo.namePl : data.axisInfo.name}
                    language={language}
                />
            )}
            
            {/* Summary */}
            {data.summary && (
                <div className="axis-summary">
                    <h4>{isPolish ? 'Podsumowanie osi' : 'Axis Summary'}</h4>
                    <p>{data.summary}</p>
                </div>
            )}
            
            {/* Detailed Area Analysis */}
            <div className="area-details-section">
                <h3>📋 {isPolish ? 'Szczegółowa analiza obszarów' : 'Detailed Area Analysis'}</h3>
                <p className="section-intro">
                    {isPolish 
                        ? 'Poniżej znajduje się szczegółowa analiza każdego z 9 obszarów biznesowych w kontekście tej osi transformacji cyfrowej. Kliknij na nagłówek obszaru, aby rozwinąć szczegóły.'
                        : 'Below is a detailed analysis of each of the 9 business areas in the context of this digital transformation axis. Click on an area header to expand details.'}
                </p>
                
                {/* Priority order indicator */}
                <div className="priority-order-note">
                    <span className="icon">⚡</span>
                    <span>{isPolish ? 'Obszary posortowane według priorytetu (największa luka najpierw)' : 'Areas sorted by priority (largest gap first)'}</span>
                </div>
                
                {sortedAreaDetails.map((areaData, index) => (
                    <AreaDetailCard
                        key={areaData.areaId}
                        data={areaData}
                        language={language}
                        initiallyExpanded={expandAllAreas || (selectedArea === areaData.areaId) || index < 3}
                    />
                ))}
            </div>
            
            <style>{`
                .axis-report-section {
                    background: white;
                    border-radius: 16px;
                    padding: 32px;
                    margin: 32px 0;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 24px;
                    padding-bottom: 24px;
                    border-bottom: 2px solid #e5e7eb;
                }
                
                .header-content {
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                }
                
                .axis-icon {
                    font-size: 48px;
                }
                
                .header-titles h2 {
                    margin: 0 0 8px 0;
                    font-size: 24px;
                    font-weight: 700;
                    color: #1e1b4b;
                }
                
                .axis-description {
                    margin: 0;
                    color: #64748b;
                    font-size: 14px;
                    max-width: 500px;
                }
                
                .level-summary {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .level-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 12px 20px;
                    border-radius: 12px;
                    min-width: 80px;
                }
                
                .level-card.current {
                    background: #3b82f610;
                    border: 2px solid #3b82f6;
                }
                
                .level-card.target {
                    background: #10b98110;
                    border: 2px solid #10b981;
                }
                
                .level-card.gap {
                    background: #f59e0b10;
                    border: 2px solid #f59e0b;
                }
                
                .level-card .value {
                    font-size: 28px;
                    font-weight: 700;
                }
                
                .level-card.current .value { color: #3b82f6; }
                .level-card.target .value { color: #10b981; }
                .level-card.gap .value { color: #f59e0b; }
                
                .level-card .label {
                    font-size: 12px;
                    color: #64748b;
                    margin-top: 4px;
                }
                
                .arrow {
                    color: #94a3b8;
                    font-size: 20px;
                    font-weight: bold;
                }
                
                .axis-summary {
                    background: #f8fafc;
                    border-radius: 12px;
                    padding: 20px;
                    margin: 24px 0;
                }
                
                .axis-summary h4 {
                    margin: 0 0 12px 0;
                    font-size: 15px;
                    font-weight: 600;
                    color: #1e1b4b;
                }
                
                .axis-summary p {
                    margin: 0;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #475569;
                }
                
                .area-details-section {
                    margin-top: 40px;
                    padding-top: 24px;
                    border-top: 2px solid #e5e7eb;
                }
                
                .area-details-section h3 {
                    margin: 0 0 12px 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: #1e1b4b;
                }
                
                .section-intro {
                    margin: 0 0 16px 0;
                    color: #64748b;
                    font-size: 14px;
                }
                
                .priority-order-note {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: #eff6ff;
                    border-radius: 8px;
                    font-size: 13px;
                    color: #3b82f6;
                    margin-bottom: 20px;
                }
                
                @media (max-width: 768px) {
                    .section-header {
                        flex-direction: column;
                        gap: 20px;
                    }
                    
                    .level-summary {
                        width: 100%;
                        justify-content: center;
                    }
                    
                    .level-card {
                        padding: 10px 16px;
                        min-width: 70px;
                    }
                    
                    .level-card .value {
                        font-size: 22px;
                    }
                }
                
                @media print {
                    .axis-report-section {
                        break-before: page;
                        box-shadow: none;
                        border: 1px solid #e5e7eb;
                    }
                }
            `}</style>
        </motion.div>
    );
};

export default AxisReportSection;

