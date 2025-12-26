/**
 * AreaMatrixTable Component
 * 
 * Displays a comprehensive matrix of 9 business areas × 7 maturity levels
 * for a specific DRD axis. Shows current state, target state, and gaps.
 * 
 * Based on BCG/McKinsey report standards.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

// ============================================================================
// CONSTANTS
// ============================================================================

export const BUSINESS_AREAS = [
    { id: 'sales', name: 'Sales', namePl: 'Sprzedaż', icon: '💰' },
    { id: 'marketing', name: 'Marketing', namePl: 'Marketing', icon: '📣' },
    { id: 'technology', name: 'Technology (R&D)', namePl: 'Technologia (R&D)', icon: '🔬' },
    { id: 'purchasing', name: 'Purchasing', namePl: 'Zakupy', icon: '🛒' },
    { id: 'logistics', name: 'Logistics', namePl: 'Logistyka', icon: '🚚' },
    { id: 'production', name: 'Production', namePl: 'Produkcja', icon: '🏭' },
    { id: 'quality', name: 'Quality Control', namePl: 'Kontrola Jakości', icon: '✅' },
    { id: 'finance', name: 'Finance', namePl: 'Finanse', icon: '💵' },
    { id: 'hr', name: 'HR & Admin', namePl: 'HR i Administracja', icon: '👥' },
] as const;

export const MATURITY_LEVELS = [
    { level: 7, name: 'Autonomous', namePl: 'Autonomiczny', color: '#ec4899' },
    { level: 6, name: 'AI-Driven', namePl: 'AI-Driven', color: '#8b5cf6' },
    { level: 5, name: 'Optimized', namePl: 'Zoptymalizowany', color: '#3b82f6' },
    { level: 4, name: 'Automated', namePl: 'Zautomatyzowany', color: '#22c55e' },
    { level: 3, name: 'Integrated', namePl: 'Zintegrowany', color: '#eab308' },
    { level: 2, name: 'Digitized', namePl: 'Zdigitalizowany', color: '#f97316' },
    { level: 1, name: 'Basic/Manual', namePl: 'Podstawowy/Ręczny', color: '#ef4444' },
] as const;

// ============================================================================
// TYPES
// ============================================================================

export interface AreaAssessment {
    areaId: string;
    currentLevel: number;
    targetLevel: number;
    interviewNotes?: string;
    intervieweeName?: string;
    intervieweeRole?: string;
}

interface AreaMatrixTableProps {
    axisId: string;
    axisName: string;
    axisIcon?: string;
    areaAssessments: AreaAssessment[];
    onAreaClick?: (areaId: string) => void;
    language?: 'pl' | 'en';
    showAnimation?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const AreaMatrixTable: React.FC<AreaMatrixTableProps> = ({
    axisId,
    axisName,
    axisIcon = '📊',
    areaAssessments,
    onAreaClick,
    language = 'pl',
    showAnimation = true,
}) => {
    const isPolish = language === 'pl';
    
    // Calculate summary statistics
    const stats = useMemo(() => {
        const assessments = areaAssessments.filter(a => a.currentLevel > 0);
        if (assessments.length === 0) return { avgCurrent: 0, avgTarget: 0, avgGap: 0, maxGap: 0 };
        
        const totalCurrent = assessments.reduce((sum, a) => sum + a.currentLevel, 0);
        const totalTarget = assessments.reduce((sum, a) => sum + a.targetLevel, 0);
        const gaps = assessments.map(a => a.targetLevel - a.currentLevel);
        
        return {
            avgCurrent: (totalCurrent / assessments.length).toFixed(1),
            avgTarget: (totalTarget / assessments.length).toFixed(1),
            avgGap: ((totalTarget - totalCurrent) / assessments.length).toFixed(1),
            maxGap: Math.max(...gaps),
            assessed: assessments.length,
        };
    }, [areaAssessments]);
    
    // Get assessment for a specific area
    const getAreaAssessment = (areaId: string): AreaAssessment | undefined => {
        return areaAssessments.find(a => a.areaId === areaId);
    };
    
    // Get gap color based on size
    const getGapColor = (gap: number): string => {
        if (gap >= 3) return '#ef4444'; // Critical
        if (gap >= 2) return '#f59e0b'; // High
        if (gap >= 1) return '#eab308'; // Medium
        return '#22c55e'; // Low
    };
    
    // Get priority label
    const getPriorityLabel = (gap: number): string => {
        if (gap >= 3) return isPolish ? 'Krytyczny' : 'Critical';
        if (gap >= 2) return isPolish ? 'Wysoki' : 'High';
        if (gap >= 1) return isPolish ? 'Średni' : 'Medium';
        return isPolish ? 'Niski' : 'Low';
    };
    
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.03,
            },
        },
    };
    
    const cellVariants = {
        hidden: { opacity: 0, scale: 0.8 },
        visible: { opacity: 1, scale: 1 },
    };
    
    return (
        <motion.div
            className="area-matrix-container"
            initial={showAnimation ? "hidden" : "visible"}
            animate="visible"
            variants={containerVariants}
        >
            {/* Header with title and summary */}
            <div className="matrix-header">
                <div className="matrix-title">
                    <span className="axis-icon">{axisIcon}</span>
                    <h3>{isPolish ? 'Macierz Dojrzałości Obszarów' : 'Area Maturity Matrix'}: {axisName}</h3>
                </div>
                <div className="matrix-summary">
                    <div className="summary-card">
                        <span className="summary-value" style={{ color: '#3b82f6' }}>{stats.avgCurrent}</span>
                        <span className="summary-label">{isPolish ? 'Śr. Aktualny' : 'Avg Current'}</span>
                    </div>
                    <div className="summary-card">
                        <span className="summary-value" style={{ color: '#10b981' }}>{stats.avgTarget}</span>
                        <span className="summary-label">{isPolish ? 'Śr. Docelowy' : 'Avg Target'}</span>
                    </div>
                    <div className="summary-card">
                        <span className="summary-value" style={{ color: getGapColor(Number(stats.avgGap)) }}>+{stats.avgGap}</span>
                        <span className="summary-label">{isPolish ? 'Śr. Luka' : 'Avg Gap'}</span>
                    </div>
                    <div className="summary-card">
                        <span className="summary-value">{stats.assessed}/9</span>
                        <span className="summary-label">{isPolish ? 'Ocenionych' : 'Assessed'}</span>
                    </div>
                </div>
            </div>
            
            {/* Matrix Table */}
            <div className="matrix-table-wrapper">
                <table className="matrix-table">
                    <thead>
                        <tr>
                            <th className="level-header">{isPolish ? 'Poziom' : 'Level'}</th>
                            {BUSINESS_AREAS.map(area => (
                                <th 
                                    key={area.id} 
                                    className="area-header"
                                    onClick={() => onAreaClick?.(area.id)}
                                    style={{ cursor: onAreaClick ? 'pointer' : 'default' }}
                                >
                                    <span className="area-icon">{area.icon}</span>
                                    <span className="area-name">{isPolish ? area.namePl : area.name}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {/* Level rows (7 to 1) */}
                        {MATURITY_LEVELS.map(levelInfo => (
                            <motion.tr key={levelInfo.level} variants={cellVariants}>
                                <td 
                                    className="level-cell"
                                    style={{ 
                                        borderLeft: `4px solid ${levelInfo.color}`,
                                        background: `${levelInfo.color}10`,
                                    }}
                                >
                                    <span className="level-number">{levelInfo.level}.</span>
                                    <span className="level-name">{isPolish ? levelInfo.namePl : levelInfo.name}</span>
                                </td>
                                {BUSINESS_AREAS.map(area => {
                                    const assessment = getAreaAssessment(area.id);
                                    const isCurrent = assessment?.currentLevel === levelInfo.level;
                                    const isTarget = assessment?.targetLevel === levelInfo.level;
                                    
                                    return (
                                        <motion.td
                                            key={`${levelInfo.level}-${area.id}`}
                                            className={`matrix-cell ${isCurrent ? 'current' : ''} ${isTarget ? 'target' : ''}`}
                                            variants={cellVariants}
                                            onClick={() => onAreaClick?.(area.id)}
                                            style={{ cursor: onAreaClick ? 'pointer' : 'default' }}
                                        >
                                            {isCurrent && isTarget && (
                                                <span className="marker both">●○</span>
                                            )}
                                            {isCurrent && !isTarget && (
                                                <span className="marker current">●</span>
                                            )}
                                            {isTarget && !isCurrent && (
                                                <span className="marker target">○</span>
                                            )}
                                        </motion.td>
                                    );
                                })}
                            </motion.tr>
                        ))}
                        
                        {/* Separator */}
                        <tr className="separator-row">
                            <td colSpan={10}></td>
                        </tr>
                        
                        {/* Summary rows */}
                        <tr className="summary-row current-row">
                            <td className="summary-label-cell">{isPolish ? 'Aktualny' : 'Current'}</td>
                            {BUSINESS_AREAS.map(area => {
                                const assessment = getAreaAssessment(area.id);
                                return (
                                    <td key={`current-${area.id}`} className="summary-value-cell current">
                                        {assessment?.currentLevel || '-'}
                                    </td>
                                );
                            })}
                        </tr>
                        <tr className="summary-row target-row">
                            <td className="summary-label-cell">{isPolish ? 'Docelowy' : 'Target'}</td>
                            {BUSINESS_AREAS.map(area => {
                                const assessment = getAreaAssessment(area.id);
                                return (
                                    <td key={`target-${area.id}`} className="summary-value-cell target">
                                        {assessment?.targetLevel || '-'}
                                    </td>
                                );
                            })}
                        </tr>
                        <tr className="summary-row gap-row">
                            <td className="summary-label-cell">{isPolish ? 'Luka' : 'Gap'}</td>
                            {BUSINESS_AREAS.map(area => {
                                const assessment = getAreaAssessment(area.id);
                                const gap = assessment ? assessment.targetLevel - assessment.currentLevel : 0;
                                return (
                                    <td 
                                        key={`gap-${area.id}`} 
                                        className="summary-value-cell gap"
                                        style={{ color: getGapColor(gap) }}
                                    >
                                        {assessment ? (gap > 0 ? `+${gap}` : gap) : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                        <tr className="summary-row priority-row">
                            <td className="summary-label-cell">{isPolish ? 'Priorytet' : 'Priority'}</td>
                            {BUSINESS_AREAS.map(area => {
                                const assessment = getAreaAssessment(area.id);
                                const gap = assessment ? assessment.targetLevel - assessment.currentLevel : 0;
                                return (
                                    <td 
                                        key={`priority-${area.id}`} 
                                        className="summary-value-cell priority"
                                        style={{ 
                                            background: `${getGapColor(gap)}15`,
                                            color: getGapColor(gap),
                                        }}
                                    >
                                        {assessment ? getPriorityLabel(gap) : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
            
            {/* Legend */}
            <div className="matrix-legend">
                <div className="legend-item">
                    <span className="legend-marker current">●</span>
                    <span>{isPolish ? 'Stan aktualny' : 'Current state'}</span>
                </div>
                <div className="legend-item">
                    <span className="legend-marker target">○</span>
                    <span>{isPolish ? 'Cel docelowy' : 'Target state'}</span>
                </div>
                <div className="legend-separator">|</div>
                <div className="legend-item">
                    <span className="priority-dot" style={{ background: '#ef4444' }}></span>
                    <span>{isPolish ? 'Krytyczny (≥3)' : 'Critical (≥3)'}</span>
                </div>
                <div className="legend-item">
                    <span className="priority-dot" style={{ background: '#f59e0b' }}></span>
                    <span>{isPolish ? 'Wysoki (2)' : 'High (2)'}</span>
                </div>
                <div className="legend-item">
                    <span className="priority-dot" style={{ background: '#eab308' }}></span>
                    <span>{isPolish ? 'Średni (1)' : 'Medium (1)'}</span>
                </div>
                <div className="legend-item">
                    <span className="priority-dot" style={{ background: '#22c55e' }}></span>
                    <span>{isPolish ? 'Niski (0)' : 'Low (0)'}</span>
                </div>
            </div>
            
            <style>{`
                .area-matrix-container {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    margin: 24px 0;
                }
                
                .matrix-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                    gap: 16px;
                }
                
                .matrix-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .matrix-title .axis-icon {
                    font-size: 28px;
                }
                
                .matrix-title h3 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: #1e1b4b;
                }
                
                .matrix-summary {
                    display: flex;
                    gap: 16px;
                }
                
                .summary-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 8px 16px;
                    background: #f8fafc;
                    border-radius: 8px;
                }
                
                .summary-card .summary-value {
                    font-size: 20px;
                    font-weight: 700;
                }
                
                .summary-card .summary-label {
                    font-size: 11px;
                    color: #64748b;
                }
                
                .matrix-table-wrapper {
                    overflow-x: auto;
                }
                
                .matrix-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                    min-width: 900px;
                }
                
                .matrix-table th,
                .matrix-table td {
                    border: 1px solid #e5e7eb;
                    padding: 8px;
                    text-align: center;
                }
                
                .level-header {
                    background: #1e1b4b;
                    color: white;
                    font-weight: 600;
                    text-align: left !important;
                    padding: 12px !important;
                    min-width: 140px;
                }
                
                .area-header {
                    background: #1e1b4b;
                    color: white;
                    font-weight: 500;
                    padding: 10px 6px !important;
                    min-width: 85px;
                    transition: background 0.2s;
                }
                
                .area-header:hover {
                    background: #312e81;
                }
                
                .area-header .area-icon {
                    display: block;
                    font-size: 18px;
                    margin-bottom: 4px;
                }
                
                .area-header .area-name {
                    display: block;
                    font-size: 10px;
                    line-height: 1.2;
                }
                
                .level-cell {
                    text-align: left !important;
                    padding: 10px 12px !important;
                    font-weight: 500;
                }
                
                .level-cell .level-number {
                    font-weight: 700;
                    margin-right: 8px;
                }
                
                .level-cell .level-name {
                    font-size: 12px;
                }
                
                .matrix-cell {
                    height: 44px;
                    transition: background 0.2s;
                }
                
                .matrix-cell:hover {
                    background: #f1f5f9;
                }
                
                .matrix-cell.current {
                    background: #3b82f620;
                }
                
                .matrix-cell.target {
                    background: #10b98120;
                }
                
                .matrix-cell.current.target {
                    background: linear-gradient(135deg, #3b82f620 50%, #10b98120 50%);
                }
                
                .marker {
                    font-size: 16px;
                }
                
                .marker.current {
                    color: #3b82f6;
                }
                
                .marker.target {
                    color: #10b981;
                }
                
                .marker.both {
                    background: linear-gradient(90deg, #3b82f6 50%, #10b981 50%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                
                .separator-row td {
                    height: 4px;
                    background: #1e1b4b;
                    padding: 0 !important;
                    border: none;
                }
                
                .summary-row td {
                    font-weight: 600;
                    padding: 10px 8px !important;
                }
                
                .summary-label-cell {
                    background: #f8fafc;
                    text-align: left !important;
                }
                
                .summary-value-cell.current {
                    color: #3b82f6;
                    font-size: 15px;
                }
                
                .summary-value-cell.target {
                    color: #10b981;
                    font-size: 15px;
                }
                
                .summary-value-cell.gap {
                    font-size: 15px;
                    font-weight: 700;
                }
                
                .summary-value-cell.priority {
                    font-size: 11px;
                    font-weight: 600;
                    border-radius: 4px;
                }
                
                .matrix-legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 16px;
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid #e5e7eb;
                    font-size: 12px;
                    color: #64748b;
                }
                
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .legend-marker.current {
                    color: #3b82f6;
                    font-size: 14px;
                }
                
                .legend-marker.target {
                    color: #10b981;
                    font-size: 14px;
                }
                
                .legend-separator {
                    color: #e5e7eb;
                }
                
                .priority-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                }
                
                @media (max-width: 768px) {
                    .matrix-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    
                    .matrix-summary {
                        width: 100%;
                        justify-content: space-between;
                    }
                    
                    .area-header .area-name {
                        font-size: 9px;
                    }
                }
                
                @media print {
                    .area-matrix-container {
                        box-shadow: none;
                        border: 1px solid #e5e7eb;
                    }
                }
            `}</style>
        </motion.div>
    );
};

export default AreaMatrixTable;

