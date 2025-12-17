import React, { useState, useRef } from 'react';
import { DRDAxis, AxisAssessment } from '../../types';
import { ArrowRight, BarChart2, TrendingUp, Sparkles, Edit2, Save, MessageSquare, Plus, Loader2, X, Settings, Smartphone, Briefcase, Database, Users, Lock, BrainCircuit, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AssessmentMatrixCard } from './AssessmentMatrixCard';
import { sendMessageToAIStream, AIMessageHistory } from '../../services/ai/gemini';
import { getQuestionsForAxis, DRD_STRUCTURE } from '../../services/drdStructure';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface AssessmentSummaryWorkspaceProps {
    assessment: Partial<Record<DRDAxis, AxisAssessment>>;
    onNavigate: (axis: DRDAxis) => void;
}

interface Comment {
    id: string;
    text: string;
    date: Date;
    author: string;
}

export const AssessmentSummaryWorkspace: React.FC<AssessmentSummaryWorkspaceProps> = ({
    assessment,
    onNavigate
}) => {
    const { t: translate } = useTranslation();
    const tSidebar = translate('sidebar', { returnObjects: true }) as any;
    const componentRef = useRef<HTMLDivElement>(null);

    const [summary, setSummary] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');

    const labels: Record<DRDAxis, string> = {
        processes: tSidebar.fullStep1_proc,
        digitalProducts: tSidebar.fullStep1_prod,
        businessModels: tSidebar.fullStep1_model,
        dataManagement: tSidebar.fullStep1_data,
        culture: tSidebar.fullStep1_cult,
        cybersecurity: "Cybersecurity",
        aiMaturity: tSidebar.fullStep1_ai,
    };

    const axes: DRDAxis[] = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];

    // Calculate generic stats
    const totalGap = axes.reduce((acc, axis) => {
        const data = assessment[axis];
        if (data && data.actual && data.target) {
            return acc + Math.max(0, data.target - data.actual);
        }
        return acc;
    }, 0);

    const avgMaturity = (axes.reduce((acc, axis) => acc + (assessment[axis]?.actual || 0), 0) / 7).toFixed(1);

    const handleGenerateSummary = async () => {
        setIsGenerating(true);
        setSummary(''); // Clear previous summary

        // Construct prompt context with detailed scores
        const context = axes.map(axis => {
            const data = assessment[axis];
            return `- ${labels[axis]}: Actual Level ${data?.actual || 0} -> Target Level ${data?.target || 0}`;
        }).join('\n');

        const prompt = `
            Act as a Senior Digital Transformation Consultant specialized in the DRD 2.0 (Digital Readiness Dashboard) methodology.
            
            Analyze the following Digital Readiness Assessment results for a client:
            ${context}
            
            Total Gap Points: ${totalGap}
            Average Maturity Level: ${avgMaturity}

            Based on the DRD 2.0 methodology, providing a strategic executive summary that covers:
            1. **Overall Assessment**: A high-level view of the organization's digital maturity.
            2. **Critical Gaps**: Identify the axes with the largest gaps between Actual and Target states. These are the primary bottlenecks.
            3. **Strategic Coherence**: Comment on the balance between different axes. Are they developing evenly? (e.g., Is 'Culture' lagging behind 'Technology'? Is 'Cybersecurity' neglected?)
            4. **Recommendations**: Suggest 2-3 high-impact focus areas to prioritize innovation and stability.

            Tone: Professional, insightful, and action-oriented.
            Format: Use clear Markdown with headings, bullet points, and bold text for emphasis.
            Length: Approximately 200-250 words.
        `;

        const history: AIMessageHistory[] = [];

        await sendMessageToAIStream(
            history,
            prompt,
            (chunk) => setSummary(prev => prev + chunk),
            () => setIsGenerating(false)
        );
    };

    const handleDownloadPDF = async () => {
        if (!componentRef.current) return;

        try {
            const canvas = await html2canvas(componentRef.current, {
                scale: 2, // Higher quality
                useCORS: true,
                logging: false,
                backgroundColor: '#0f172a' // Match navy-900
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`DRD_Assessment_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            // In a real app, show a toast notification here
        }
    };

    const handleAddComment = () => {
        if (!newComment.trim()) return;

        const comment: Comment = {
            id: Date.now().toString(),
            text: newComment,
            date: new Date(),
            author: 'User' // In a real app, get from auth context
        };

        setComments([...comments, comment]);
        setNewComment('');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-900 text-navy-900 dark:text-white p-8 overflow-y-auto" ref={componentRef}>

            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
                        <TrendingUp className="text-purple-500" />
                        Gap Map Analysis
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Summary of digital maturity. These gaps will directly drive initiative generation.
                    </p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-navy-900 dark:text-white rounded-lg text-sm font-semibold transition-colors border border-slate-300 dark:border-white/10"
                        title="Download Report as PDF"
                    >
                        <Download size={16} />
                        Export PDF
                    </button>
                    <div className="bg-white dark:bg-navy-950/50 p-3 rounded-xl border border-slate-200 dark:border-white/5 text-center min-w-[100px]">
                        <div className="text-2xl font-bold text-blue-400">{avgMaturity}</div>
                        <div className="text-[10px] uppercase text-slate-500 font-bold">Avg Actual</div>
                    </div>
                    <div className="bg-white dark:bg-navy-950/50 p-3 rounded-xl border border-slate-200 dark:border-white/5 text-center min-w-[100px]">
                        <div className="text-2xl font-bold text-red-400">{totalGap}</div>
                        <div className="text-[10px] uppercase text-slate-500 font-bold">Total Gap Points</div>
                    </div>
                </div>
            </div>

            {/* Main Chart / Table */}
            <div className="bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-between mb-6 border-b border-slate-200 dark:border-white/5 pb-4">
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white">Wizualizacja Luk (Gap Map)</h3>
                    <div className="flex gap-4 text-xs font-mono">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded-sm"></div> Obecny</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-500/20 border border-purple-500 rounded-sm"></div> Docelowy</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500/20 border border-dashed border-red-500 rounded-sm"></div> Luka</div>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-4 mb-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center border-b border-slate-200 dark:border-white/5 pb-2">
                    {axes.map(axis => <div key={axis}>{labels[axis]}</div>)}
                </div>

                {/* Visual Bars */}
                <div className="grid grid-cols-7 gap-4 h-64 items-end pb-4">
                    {axes.map(axis => {
                        const data = assessment[axis];
                        const actual = data?.actual || 0;
                        const target = data?.target || 0;
                        const gap = Math.max(0, target - actual);

                        return (
                            <div key={axis} className="flex flex-col items-center justify-end h-full gap-1 group relative">
                                {/* Tooltip */}
                                <div className="absolute -top-12 opacity-0 group-hover:opacity-100 bg-white text-navy-900 text-xs p-2 rounded shadow-lg transition-opacity z-10 pointer-events-none whitespace-nowrap">
                                    Actual: {actual} → Target: {target}
                                </div>

                                {/* Gap Bar (Top) */}
                                {gap > 0 && (
                                    <div
                                        style={{ height: `${gap * 10}%` }}
                                        className="w-full bg-red-500/10 border border-dashed border-red-500/30 rounded-t relative overflow-hidden"
                                    >
                                    </div>
                                )}

                                {/* Actual Bar (Bottom) */}
                                <div
                                    style={{ height: `${actual * 10}%` }}
                                    className={`w-full rounded-b transition-all ${!data ? 'bg-slate-200 dark:bg-slate-800' : 'bg-gradient-to-t from-blue-900 to-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]'
                                        }`}
                                ></div>

                                <div className="mt-2 text-xs font-mono text-slate-400">
                                    {actual} <span className="text-slate-600">/</span> <span className="text-purple-400 font-bold">{target}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* NEW: 7 Matrices Summary */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-6 flex items-center gap-2">
                    <BarChart2 className="text-blue-400" />
                    Szczegółowa Analiza Macierzy (Matrix Deep Dive)
                </h2>
                <div className="grid grid-cols-1 gap-6">
                    {axes.map(axis => {
                        // Map axis to icon
                        const iconMap: Record<DRDAxis, React.ReactNode> = {
                            processes: <Settings size={18} />,
                            digitalProducts: <Smartphone size={18} />,
                            businessModels: <Briefcase size={18} />,
                            dataManagement: <Database size={18} />,
                            culture: <Users size={18} />,
                            cybersecurity: <Lock size={18} />,
                            aiMaturity: <BrainCircuit size={18} />,
                        };

                        const axisIdMap: Record<string, number> = {
                            'processes': 1,
                            'digitalProducts': 2,
                            'businessModels': 3,
                            'dataManagement': 4,
                            'culture': 5,
                            'cybersecurity': 6,
                            'aiMaturity': 7
                        };
                        const realAreas = getQuestionsForAxis(axisIdMap[axis]);

                        // Calculate detailed averages from area scores
                        let totalActual = 0;
                        let totalTarget = 0;
                        let areaCount = 0;

                        realAreas.forEach(area => {
                            const scores = assessment[axis]?.areaScores?.[area.id] || [0, 0];
                            const actualBitmask = scores[0];
                            const targetBitmask = scores[1];

                            // Convert bitmask to highest level
                            // Level 1 = bit 0 (1), Level 5 = bit 4 (16)
                            // Math.log2(0) is -Infinity, so handle 0 case
                            const actualLevel = actualBitmask > 0 ? Math.floor(Math.log2(actualBitmask)) + 1 : 0;
                            const targetLevel = targetBitmask > 0 ? Math.floor(Math.log2(targetBitmask)) + 1 : 0;

                            totalActual += actualLevel;
                            totalTarget += targetLevel;
                            areaCount++;
                        });

                        const calculatedActual = areaCount > 0 ? Number((totalActual / areaCount).toFixed(1)) : 0;
                        const calculatedTarget = areaCount > 0 ? Number((totalTarget / areaCount).toFixed(1)) : 0;

                        return (
                            <AssessmentMatrixCard
                                key={axis}
                                title={labels[axis]}
                                icon={iconMap[axis]}
                                actual={calculatedActual}
                                target={calculatedTarget}
                                areas={realAreas}
                                scores={assessment[axis]?.areaScores}
                                onNavigate={() => onNavigate(axis)}
                            />
                        );
                    })}
                </div>
            </div>

            {/* AI Summary Section - Refactored */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-500/20 rounded-xl p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex gap-4 items-center">
                        <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg text-purple-600 dark:text-purple-400">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-purple-900 dark:text-purple-200 text-lg">AI Assessment Summary</h3>
                            <p className="text-xs text-purple-600/60 dark:text-purple-400/60">Powered by Gemini AI</p>
                        </div>
                    </div>
                    <div className="flex gap-2" data-html2canvas-ignore>
                        {!summary && !isGenerating && (
                            <button
                                onClick={handleGenerateSummary}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-purple-900/30"
                            >
                                <Sparkles size={16} />
                                Generate Summary
                            </button>
                        )}
                        {summary && !isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors"
                                title="Edit Summary"
                            >
                                <Edit2 size={18} />
                            </button>
                        )}
                        {summary && isEditing && (
                            <button
                                onClick={() => setIsEditing(false)}
                                className="p-2 hover:bg-green-500/20 rounded-lg text-green-400 transition-colors"
                                title="Save Changes"
                            >
                                <Save size={18} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="pl-[56px]">
                    {isGenerating && (
                        <div className="flex items-center gap-2 text-purple-300 animate-pulse py-4">
                            <Loader2 className="animate-spin" size={18} />
                            Generating expert analysis...
                        </div>
                    )}

                    {!summary && !isGenerating && (
                        <div className="text-slate-500 italic py-4 border-l-2 border-slate-300 dark:border-slate-700 pl-4">
                            No summary generated yet. Click the button above to analyze your assessment results.
                        </div>
                    )}

                    {summary && isEditing ? (
                        <textarea
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            className="w-full h-40 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg p-4 text-navy-900 dark:text-slate-200 text-sm focus:outline-none focus:border-purple-500/50 transition-colors resize-none mb-4"
                            autoFocus
                        />
                    ) : (
                        summary && (
                            <div className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300">
                                <div className="whitespace-pre-wrap leading-relaxed">{summary}</div>
                            </div>
                        )
                    )}

                    {/* Comments Section */}
                    {summary && (
                        <div className="mt-8 pt-6 border-t border-purple-200 dark:border-white/5">
                            <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                                <MessageSquare size={16} />
                                Comments ({comments.length})
                            </h4>

                            <div className="space-y-4 mb-4">
                                {comments.map(comment => (
                                    <div key={comment.id} className="bg-white dark:bg-navy-950/30 rounded-lg p-3 border border-slate-200 dark:border-white/5">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{comment.author}</span>
                                            <span className="text-[10px] text-slate-500">{comment.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className="text-sm text-navy-900 dark:text-slate-300">{comment.text}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                    placeholder="Add a comment or observation..."
                                    className="flex-1 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm text-navy-900 dark:text-white focus:outline-none focus:border-purple-500/50"
                                />
                                <button
                                    onClick={handleAddComment}
                                    disabled={!newComment.trim()}
                                    className="p-2 bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 text-white rounded-lg transition-colors"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};



                        </div >
                    );
};
