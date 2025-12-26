/**
 * AreaDetailCard Component
 * 
 * Displays detailed analysis of a single business area within a DRD axis.
 * Includes:
 * - Current and target level with gap
 * - Detailed description of current state
 * - Interview notes and quotes
 * - What current level means
 * - What target level requires
 * - Recommendations for development
 * - Risks and KPIs
 * 
 * Based on BCG/McKinsey consulting report standards.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BUSINESS_AREAS, MATURITY_LEVELS } from './AreaMatrixTable';

// ============================================================================
// TYPES
// ============================================================================

export interface InterviewData {
    intervieweeName: string;
    intervieweeRole: string;
    date: string;
    notes: string;
    keyQuote?: string;
    observations?: string[];
}

export interface AreaLevelInfo {
    name: string;
    namePl: string;
    description: string;
    descriptionPl: string;
    characteristics: string[];
    tools: string[];
    risks?: string[];
}

export interface AreaDetailData {
    areaId: string;
    axisId: string;
    currentLevel: number;
    targetLevel: number;
    currentLevelInfo: AreaLevelInfo;
    targetLevelInfo: AreaLevelInfo;
    interview?: InterviewData;
    recommendations?: Array<{
        title: string;
        description?: string;
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
        timeEstimate?: string;
        budgetEstimate?: string;
    }>;
    kpis?: Array<{
        name: string;
        unit: string;
        currentValue?: number | string;
        targetValue?: number | string;
        benchmark?: { low: number; medium: number; high: number };
    }>;
    risks?: string[];
}

interface AreaDetailCardProps {
    data: AreaDetailData;
    language?: 'pl' | 'en';
    onEdit?: (sectionId: string, content: string) => void;
    isEditable?: boolean;
    initiallyExpanded?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const AreaDetailCard: React.FC<AreaDetailCardProps> = ({
    data,
    language = 'pl',
    onEdit,
    isEditable = false,
    initiallyExpanded = true,
}) => {
    const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
    const [activeSection, setActiveSection] = useState<string | null>(null);
    
    const isPolish = language === 'pl';
    const area = BUSINESS_AREAS.find(a => a.id === data.areaId);
    const gap = data.targetLevel - data.currentLevel;
    
    // Priority based on gap
    const getPriorityInfo = (gap: number) => {
        if (gap >= 3) return { label: isPolish ? 'Krytyczny' : 'Critical', color: '#ef4444', bg: '#fef2f2' };
        if (gap >= 2) return { label: isPolish ? 'Wysoki' : 'High', color: '#f59e0b', bg: '#fffbeb' };
        if (gap >= 1) return { label: isPolish ? 'Średni' : 'Medium', color: '#eab308', bg: '#fefce8' };
        return { label: isPolish ? 'Niski' : 'Low', color: '#22c55e', bg: '#f0fdf4' };
    };
    
    const priority = getPriorityInfo(gap);
    const currentLevelMeta = MATURITY_LEVELS.find(l => l.level === data.currentLevel);
    const targetLevelMeta = MATURITY_LEVELS.find(l => l.level === data.targetLevel);
    
    const cardVariants = {
        collapsed: { height: 'auto' },
        expanded: { height: 'auto' },
    };
    
    const contentVariants = {
        hidden: { opacity: 0, height: 0 },
        visible: { opacity: 1, height: 'auto', transition: { duration: 0.3 } },
    };
    
    return (
        <motion.div
            className="area-detail-card"
            layout
            variants={cardVariants}
            initial="collapsed"
            animate={isExpanded ? 'expanded' : 'collapsed'}
        >
            {/* Header - Always Visible */}
            <div 
                className="card-header"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="header-left">
                    <span className="area-icon">{area?.icon || '📊'}</span>
                    <div className="header-titles">
                        <h3 className="area-name">{isPolish ? area?.namePl : area?.name}</h3>
                        <span className="area-description">
                            {isPolish ? data.currentLevelInfo.namePl : data.currentLevelInfo.name}
                        </span>
                    </div>
                </div>
                
                <div className="header-right">
                    {/* Level indicators */}
                    <div className="level-indicators">
                        <div className="level-badge current" style={{ borderColor: currentLevelMeta?.color }}>
                            <span className="level-value">{data.currentLevel}</span>
                            <span className="level-label">{isPolish ? 'Akt.' : 'Cur.'}</span>
                        </div>
                        <span className="arrow">→</span>
                        <div className="level-badge target" style={{ borderColor: targetLevelMeta?.color }}>
                            <span className="level-value">{data.targetLevel}</span>
                            <span className="level-label">{isPolish ? 'Cel' : 'Tgt.'}</span>
                        </div>
                        <div className="level-badge gap" style={{ background: priority.bg, color: priority.color }}>
                            <span className="level-value">+{gap}</span>
                            <span className="level-label">{isPolish ? 'Luka' : 'Gap'}</span>
                        </div>
                    </div>
                    
                    {/* Priority badge */}
                    <div className="priority-badge" style={{ background: priority.bg, color: priority.color }}>
                        {priority.label}
                    </div>
                    
                    {/* Expand toggle */}
                    <motion.span
                        className="expand-toggle"
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                    >
                        ▼
                    </motion.span>
                </div>
            </div>
            
            {/* Expandable Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        className="card-content"
                        variants={contentVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                    >
                        {/* Section 1: Current State Description */}
                        <section className="content-section current-state">
                            <div className="section-header">
                                <h4>📋 {isPolish ? 'Opis stanu aktualnego' : 'Current State Description'}</h4>
                                <span className="level-tag" style={{ background: `${currentLevelMeta?.color}20`, color: currentLevelMeta?.color }}>
                                    {isPolish ? 'Poziom' : 'Level'} {data.currentLevel}
                                </span>
                            </div>
                            <div className="section-body">
                                <p className="description">
                                    {isPolish ? data.currentLevelInfo.descriptionPl : data.currentLevelInfo.description}
                                </p>
                                
                                <div className="characteristics">
                                    <h5>{isPolish ? 'Charakterystyki obecnego poziomu' : 'Characteristics of Current Level'}:</h5>
                                    <ul>
                                        {data.currentLevelInfo.characteristics.map((char, i) => (
                                            <li key={i}>{char}</li>
                                        ))}
                                    </ul>
                                </div>
                                
                                <div className="tools">
                                    <h5>{isPolish ? 'Używane narzędzia' : 'Tools Used'}:</h5>
                                    <div className="tools-list">
                                        {data.currentLevelInfo.tools.map((tool, i) => (
                                            <span key={i} className="tool-badge">{tool}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                        
                        {/* Section 2: Interview Notes (if available) */}
                        {data.interview && (
                            <section className="content-section interview-notes">
                                <div className="section-header">
                                    <h4>📝 {isPolish ? 'Notatki z wywiadu' : 'Interview Notes'}</h4>
                                </div>
                                <div className="section-body">
                                    <div className="interview-meta">
                                        <div className="meta-item">
                                            <span className="meta-label">{isPolish ? 'Rozmówca' : 'Interviewee'}:</span>
                                            <span className="meta-value">{data.interview.intervieweeName}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">{isPolish ? 'Stanowisko' : 'Role'}:</span>
                                            <span className="meta-value">{data.interview.intervieweeRole}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">{isPolish ? 'Data' : 'Date'}:</span>
                                            <span className="meta-value">{data.interview.date}</span>
                                        </div>
                                    </div>
                                    
                                    {data.interview.keyQuote && (
                                        <blockquote className="key-quote">
                                            "{data.interview.keyQuote}"
                                        </blockquote>
                                    )}
                                    
                                    <div className="notes-content">
                                        <p>{data.interview.notes}</p>
                                    </div>
                                    
                                    {data.interview.observations && data.interview.observations.length > 0 && (
                                        <div className="observations">
                                            <h5>{isPolish ? 'Kluczowe obserwacje' : 'Key Observations'}:</h5>
                                            <ul>
                                                {data.interview.observations.map((obs, i) => (
                                                    <li key={i}>{obs}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                        
                        {/* Section 3: Target State */}
                        <section className="content-section target-state">
                            <div className="section-header">
                                <h4>🎯 {isPolish ? 'Aby osiągnąć poziom' : 'To Reach Level'} {data.targetLevel}: {isPolish ? data.targetLevelInfo.namePl : data.targetLevelInfo.name}</h4>
                                <span className="level-tag" style={{ background: `${targetLevelMeta?.color}20`, color: targetLevelMeta?.color }}>
                                    {isPolish ? 'Cel' : 'Target'}
                                </span>
                            </div>
                            <div className="section-body">
                                <p className="description">
                                    {isPolish ? data.targetLevelInfo.descriptionPl : data.targetLevelInfo.description}
                                </p>
                                
                                <div className="characteristics">
                                    <h5>{isPolish ? 'Wymagane charakterystyki' : 'Required Characteristics'}:</h5>
                                    <ul>
                                        {data.targetLevelInfo.characteristics.map((char, i) => (
                                            <li key={i}>{char}</li>
                                        ))}
                                    </ul>
                                </div>
                                
                                <div className="tools">
                                    <h5>{isPolish ? 'Przykładowe narzędzia' : 'Example Tools'}:</h5>
                                    <div className="tools-list">
                                        {data.targetLevelInfo.tools.map((tool, i) => (
                                            <span key={i} className="tool-badge target">{tool}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                        
                        {/* Section 4: Recommendations */}
                        {data.recommendations && data.recommendations.length > 0 && (
                            <section className="content-section recommendations">
                                <div className="section-header">
                                    <h4>🚀 {isPolish ? 'Rekomendacje rozwojowe' : 'Development Recommendations'}</h4>
                                </div>
                                <div className="section-body">
                                    <ol className="recommendations-list">
                                        {data.recommendations.map((rec, i) => (
                                            <li key={i} className={`recommendation-item priority-${rec.priority.toLowerCase()}`}>
                                                <div className="rec-header">
                                                    <strong>{rec.title}</strong>
                                                    <span className={`rec-priority ${rec.priority.toLowerCase()}`}>
                                                        {rec.priority === 'HIGH' ? (isPolish ? 'Wysoki' : 'High') :
                                                         rec.priority === 'MEDIUM' ? (isPolish ? 'Średni' : 'Medium') :
                                                         (isPolish ? 'Niski' : 'Low')}
                                                    </span>
                                                </div>
                                                {rec.description && <p className="rec-description">{rec.description}</p>}
                                                <div className="rec-meta">
                                                    {rec.timeEstimate && (
                                                        <span className="meta-tag">⏱️ {rec.timeEstimate}</span>
                                                    )}
                                                    {rec.budgetEstimate && (
                                                        <span className="meta-tag">💰 {rec.budgetEstimate}</span>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </section>
                        )}
                        
                        {/* Section 5: Risks */}
                        {data.risks && data.risks.length > 0 && (
                            <section className="content-section risks">
                                <div className="section-header">
                                    <h4>⚠️ {isPolish ? 'Ryzyka' : 'Risks'}</h4>
                                </div>
                                <div className="section-body">
                                    <ul className="risks-list">
                                        {data.risks.map((risk, i) => (
                                            <li key={i} className="risk-item">{risk}</li>
                                        ))}
                                    </ul>
                                </div>
                            </section>
                        )}
                        
                        {/* Section 6: KPIs */}
                        {data.kpis && data.kpis.length > 0 && (
                            <section className="content-section kpis">
                                <div className="section-header">
                                    <h4>📈 {isPolish ? 'KPI do monitorowania' : 'KPIs to Monitor'}</h4>
                                </div>
                                <div className="section-body">
                                    <div className="kpi-grid">
                                        {data.kpis.map((kpi, i) => (
                                            <div key={i} className="kpi-card">
                                                <div className="kpi-name">{kpi.name}</div>
                                                {kpi.currentValue !== undefined && (
                                                    <div className="kpi-values">
                                                        <span className="current">{kpi.currentValue} {kpi.unit}</span>
                                                        {kpi.targetValue !== undefined && (
                                                            <>
                                                                <span className="arrow">→</span>
                                                                <span className="target">{kpi.targetValue} {kpi.unit}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                                {kpi.benchmark && (
                                                    <div className="kpi-benchmark">
                                                        <span className="benchmark-label">Benchmark:</span>
                                                        <span className="benchmark-low">Low: {kpi.benchmark.low}{kpi.unit}</span>
                                                        <span className="benchmark-high">Best: {kpi.benchmark.high}{kpi.unit}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            
            <style>{`
                .area-detail-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    margin: 16px 0;
                    overflow: hidden;
                    border-left: 4px solid ${priority.color};
                }
                
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    cursor: pointer;
                    background: #f8fafc;
                    transition: background 0.2s;
                }
                
                .card-header:hover {
                    background: #f1f5f9;
                }
                
                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .area-icon {
                    font-size: 28px;
                }
                
                .header-titles {
                    display: flex;
                    flex-direction: column;
                }
                
                .area-name {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #1e1b4b;
                }
                
                .area-description {
                    font-size: 12px;
                    color: #64748b;
                }
                
                .header-right {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                
                .level-indicators {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .level-badge {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 6px 12px;
                    border-radius: 8px;
                    min-width: 50px;
                }
                
                .level-badge.current {
                    background: #3b82f610;
                    border: 2px solid #3b82f6;
                }
                
                .level-badge.target {
                    background: #10b98110;
                    border: 2px solid #10b981;
                }
                
                .level-badge.gap {
                    border: none;
                }
                
                .level-badge .level-value {
                    font-size: 18px;
                    font-weight: 700;
                }
                
                .level-badge .level-label {
                    font-size: 10px;
                    color: #64748b;
                }
                
                .arrow {
                    color: #94a3b8;
                    font-weight: bold;
                }
                
                .priority-badge {
                    padding: 4px 12px;
                    border-radius: 16px;
                    font-size: 12px;
                    font-weight: 600;
                }
                
                .expand-toggle {
                    color: #94a3b8;
                    font-size: 12px;
                }
                
                .card-content {
                    padding: 0 20px 20px;
                    overflow: hidden;
                }
                
                .content-section {
                    padding: 16px 0;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .content-section:last-child {
                    border-bottom: none;
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                
                .section-header h4 {
                    margin: 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: #1e1b4b;
                }
                
                .level-tag {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                }
                
                .section-body {
                    font-size: 14px;
                    line-height: 1.6;
                    color: #374151;
                }
                
                .description {
                    margin: 0 0 16px 0;
                }
                
                .characteristics h5,
                .tools h5,
                .observations h5 {
                    margin: 0 0 8px 0;
                    font-size: 13px;
                    color: #64748b;
                    font-weight: 600;
                }
                
                .characteristics ul {
                    margin: 0;
                    padding-left: 20px;
                }
                
                .characteristics li {
                    margin-bottom: 4px;
                }
                
                .tools-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                
                .tool-badge {
                    padding: 4px 10px;
                    background: #f1f5f9;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #475569;
                }
                
                .tool-badge.target {
                    background: #10b98115;
                    color: #059669;
                    border: 1px solid #10b98140;
                }
                
                /* Interview section */
                .interview-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 16px;
                    margin-bottom: 16px;
                    padding: 12px;
                    background: #f8fafc;
                    border-radius: 8px;
                }
                
                .meta-item {
                    display: flex;
                    gap: 6px;
                }
                
                .meta-label {
                    color: #64748b;
                    font-size: 13px;
                }
                
                .meta-value {
                    font-weight: 600;
                    font-size: 13px;
                }
                
                .key-quote {
                    margin: 16px 0;
                    padding: 16px 20px;
                    background: linear-gradient(135deg, #1e1b4b05, #3b82f610);
                    border-left: 4px solid #3b82f6;
                    border-radius: 0 8px 8px 0;
                    font-style: italic;
                    color: #1e1b4b;
                    font-size: 15px;
                }
                
                .notes-content {
                    margin-bottom: 16px;
                }
                
                .observations ul {
                    margin: 0;
                    padding-left: 20px;
                }
                
                /* Recommendations */
                .recommendations-list {
                    margin: 0;
                    padding-left: 20px;
                }
                
                .recommendation-item {
                    margin-bottom: 16px;
                    padding: 12px;
                    background: #f8fafc;
                    border-radius: 8px;
                    border-left: 3px solid #e5e7eb;
                }
                
                .recommendation-item.priority-high {
                    border-left-color: #f59e0b;
                }
                
                .recommendation-item.priority-medium {
                    border-left-color: #eab308;
                }
                
                .recommendation-item.priority-low {
                    border-left-color: #22c55e;
                }
                
                .rec-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .rec-priority {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                }
                
                .rec-priority.high {
                    background: #fef3c7;
                    color: #d97706;
                }
                
                .rec-priority.medium {
                    background: #fef9c3;
                    color: #ca8a04;
                }
                
                .rec-priority.low {
                    background: #dcfce7;
                    color: #16a34a;
                }
                
                .rec-description {
                    margin: 0 0 8px 0;
                    font-size: 13px;
                    color: #64748b;
                }
                
                .rec-meta {
                    display: flex;
                    gap: 12px;
                }
                
                .meta-tag {
                    font-size: 12px;
                    color: #64748b;
                }
                
                /* Risks */
                .risks-list {
                    margin: 0;
                    padding-left: 20px;
                }
                
                .risk-item {
                    margin-bottom: 8px;
                    color: #b45309;
                }
                
                /* KPIs */
                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 12px;
                }
                
                .kpi-card {
                    padding: 12px;
                    background: #f8fafc;
                    border-radius: 8px;
                }
                
                .kpi-name {
                    font-weight: 600;
                    font-size: 13px;
                    color: #1e1b4b;
                    margin-bottom: 8px;
                }
                
                .kpi-values {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                
                .kpi-values .current {
                    font-weight: 600;
                    color: #3b82f6;
                }
                
                .kpi-values .target {
                    font-weight: 600;
                    color: #10b981;
                }
                
                .kpi-benchmark {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    font-size: 11px;
                    color: #64748b;
                }
                
                .benchmark-low {
                    color: #ef4444;
                }
                
                .benchmark-high {
                    color: #22c55e;
                }
                
                @media (max-width: 768px) {
                    .card-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 12px;
                    }
                    
                    .header-right {
                        width: 100%;
                        justify-content: space-between;
                    }
                    
                    .level-indicators {
                        flex-wrap: wrap;
                    }
                }
                
                @media print {
                    .area-detail-card {
                        break-inside: avoid;
                        box-shadow: none;
                        border: 1px solid #e5e7eb;
                    }
                    
                    .card-header {
                        background: none;
                    }
                    
                    .expand-toggle {
                        display: none;
                    }
                }
            `}</style>
        </motion.div>
    );
};

export default AreaDetailCard;

