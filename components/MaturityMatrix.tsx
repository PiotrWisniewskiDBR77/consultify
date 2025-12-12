import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuestionsForAxis } from '../services/drdStructure';
import { AxisId } from '../types';
import { ArrowRight, CheckCircle2, ChevronRight, Sparkles, Bot } from 'lucide-react';

interface MaturityMatrixProps {
    axisId: number;
    axisKey: AxisId;
    currentScores: { [areaId: string]: number[] | number }; // Allow legacy number
    onScoreSelect: (areaId: string, level: number) => void;
    onComplete: () => void;
    onDiagnose?: (areaId: string, input: string) => Promise<{ level: number, justification: string }>;
}

export const MaturityMatrix: React.FC<MaturityMatrixProps> = ({
    axisId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    axisKey,
    currentScores,
    onScoreSelect,
    onComplete,
    onDiagnose
}) => {
    const areas = getQuestionsForAxis(axisId);
    // Default select first area
    const [selectedAreaId, setSelectedAreaId] = useState<string | null>(areas[0]?.id || null);

    // AI State
    const [showAi, setShowAi] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState<{ level: number; justification: string } | null>(null);

    // Reset AI state when area changes
    React.useEffect(() => {
        setAiResult(null);
        setAiInput('');
        setShowAi(false);
    }, [selectedAreaId]);

    const handleAiDiagnose = async () => {
        if (!onDiagnose || !selectedAreaId || !aiInput) return;
        setAiLoading(true);
        try {
            const result = await onDiagnose(selectedAreaId, aiInput);
            setAiResult(result);
        } catch (e) {
            console.error("AI Error", e);
        } finally {
            setAiLoading(false);
        }
    };

    // Helper to get array of scores
    const getScoreArray = (areaId: string): number[] => {
        const val = currentScores[areaId];
        if (Array.isArray(val)) return val;
        if (typeof val === 'number') return [val];
        return [];
    };

    const isComplete = areas.every(area => getScoreArray(area.id).length > 0);
    const progressPercent = (Object.keys(currentScores).length / areas.length) * 100;

    const currentArea = areas.find(a => a.id === selectedAreaId);
    const currentAreaScores = selectedAreaId ? getScoreArray(selectedAreaId) : [];

    // Auto-advance logic (optional, but premium feel)
    const handleScore = (areaId: string, level: number) => {
        onScoreSelect(areaId, level);
        // Find next area index
        const idx = areas.findIndex(a => a.id === areaId);
        if (idx < areas.length - 1) {
            // Small delay for user to register the click
            // setTimeout(() => setSelectedAreaId(areas[idx + 1].id), 400); 
            // Actually, auto-advance can be annoying if they want to read. Let's keep manual but highlight next.
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0B1120] text-slate-100 font-sans selection:bg-blue-500/30">

            {/* 1. Top Bar: Progress & Context */}
            <div className="shrink-0 h-14 border-b border-white/5 flex items-center px-6 justify-between bg-[#0B1120]">
                <div className="flex items-center gap-4">
                    <div className="h-1.5 w-32 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}% ` }}
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-400"
                        />
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase">
                        {Object.keys(currentScores).length} of {areas.length} Areas Evaluated
                    </span>
                </div>

                {isComplete && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={onComplete}
                        className="flex items-center gap-2 px-4 py-1.5 bg-white text-[#0B1120] rounded-full text-xs font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-shadow"
                    >
                        Complete Assessment <ArrowRight size={14} />
                    </motion.button>
                )}
            </div>

            {/* 2. Main Content: Split Layout */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT: Agenda / Areas Navigation */}
                <div className="w-64 border-r border-white/5 bg-[#0F1629] overflow-y-auto custom-scrollbar">
                    <div className="p-4">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                            Assessment Areas
                        </h3>
                        <div className="space-y-0.5">
                            {areas.map((area, idx) => {
                                const isSelected = selectedAreaId === area.id;
                                const scores = getScoreArray(area.id);
                                const isScored = scores.length > 0;

                                return (
                                    <button
                                        key={area.id}
                                        onClick={() => setSelectedAreaId(area.id)}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all duration-200 group ${isSelected
                                            ? 'bg-blue-600/10 text-white shadow-sm ring-1 ring-blue-500/20'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${isScored
                                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                : isSelected
                                                    ? 'border-blue-400 text-blue-400'
                                                    : 'border-slate-700 text-slate-600'
                                                }`}>
                                                {isScored ? <CheckCircle2 size={10} /> : idx + 1}
                                            </div>
                                            <span className="text-xs font-medium truncate w-36">{area.name}</span>
                                        </div>
                                        {isSelected && <ChevronRight size={12} className="text-blue-500" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Detail & Selection */}
                <div className="flex-1 overflow-y-auto bg-gradient-to-br from-[#0B1120] to-[#111827] p-6 relative">
                    <AnimatePresence mode="wait">
                        {currentArea ? (
                            <motion.div
                                key={currentArea.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="max-w-4xl mx-auto"
                            >
                                {/* Area Title Block */}
                                <div className="mb-6">
                                    <div className="inline-flex items-center px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-[10px] font-semibold tracking-wider mb-2">
                                        AREA {currentArea.id}
                                    </div>
                                    <h2 className="text-xl font-light text-white mb-2">
                                        {currentArea.name}
                                    </h2>
                                    <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
                                        Assess your organization's capability in this specific domain by selecting all levels that apply to your current reality.
                                    </p>

                                    {/* AI DIAGNOSIS CHECKPOINTS */}
                                    <div className="mt-4">
                                        <button
                                            onClick={() => setShowAi(!showAi)}
                                            className="flex items-center gap-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors"
                                        >
                                            <Sparkles size={14} />
                                            {showAi ? 'Close AI Assistant' : 'Not sure? Ask AI to Diagnose'}
                                        </button>

                                        <AnimatePresence>
                                            {showAi && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                                        <h4 className="text-purple-300 font-semibold mb-2 flex items-center gap-1.5 text-xs">
                                                            <Bot size={14} /> Digital Pathfinder AI
                                                        </h4>

                                                        {!aiResult ? (
                                                            <>
                                                                <p className="text-[10px] text-purple-200/70 mb-2">
                                                                    Describe your current processes, tools, and challenges regarding {currentArea.name}.
                                                                </p>
                                                                <textarea
                                                                    value={aiInput}
                                                                    onChange={(e) => setAiInput(e.target.value)}
                                                                    placeholder="e.g. We currently use Excel for everything, but we are looking at..."
                                                                    className="w-full text-xs bg-[#0B1120] border border-purple-500/30 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-purple-500 h-20 mb-2"
                                                                />
                                                                <button
                                                                    onClick={handleAiDiagnose}
                                                                    disabled={aiLoading || !aiInput.trim()}
                                                                    className="px-3 py-1.5 bg-purple-600 text-white text-[10px] font-bold rounded-lg hover:bg-purple-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                                                                >
                                                                    {aiLoading ? <span className="animate-spin">⌛</span> : <Sparkles size={12} />}
                                                                    Diagnose Level
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <div className="animate-pulse-once">
                                                                <div className="flex items-start gap-3 mb-3">
                                                                    <div className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                                                                        {aiResult.level}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-purple-100 font-medium mb-0.5">
                                                                            Recommended Level: {aiResult.level}
                                                                        </p>
                                                                        <p className="text-[10px] text-purple-200 leading-relaxed italic">
                                                                            "{aiResult.justification}"
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            handleScore(currentArea.id, aiResult.level);
                                                                            setAiResult(null);
                                                                            setShowAi(false);
                                                                        }}
                                                                        className="px-2.5 py-1 bg-green-600/20 text-green-400 border border-green-600/50 rounded text-[10px] font-bold hover:bg-green-600/30"
                                                                    >
                                                                        Add Level {aiResult.level}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setAiResult(null)}
                                                                        className="px-2.5 py-1 text-slate-400 hover:text-white text-[10px]"
                                                                    >
                                                                        Try Again
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Levels Grid */}
                                <div className="grid grid-cols-1 gap-3">
                                    {currentArea.levels.map((level) => {
                                        const isSelected = currentAreaScores.includes(level.level);

                                        return (
                                            <motion.button
                                                key={level.level}
                                                onClick={() => handleScore(currentArea.id, level.level)}
                                                whileHover={{ scale: 1.002 }}
                                                whileTap={{ scale: 0.998 }}
                                                className={`group relative text-left p-4 rounded-xl border transition-all duration-300 w-full ${isSelected
                                                    ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.15)] z-10'
                                                    : 'bg-[#131B2E] border-white/5 hover:border-white/10 hover:bg-[#1A2338]'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    {/* Level Indicator */}
                                                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-colors duration-300 ${isSelected
                                                        ? 'bg-blue-500 text-white shadow-lg'
                                                        : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300'
                                                        }`}>
                                                        {level.level}
                                                    </div>

                                                    {/* Text Content */}
                                                    <div className="flex-1">
                                                        <h4 className={`text-sm font-bold mb-1 transition-colors ${isSelected ? 'text-blue-100' : 'text-slate-200 group-hover:text-white'
                                                            }`}>
                                                            {level.title}
                                                        </h4>
                                                        <p className={`text-xs leading-relaxed transition-colors ${isSelected ? 'text-blue-200/80' : 'text-slate-400 group-hover:text-slate-300'
                                                            }`}>
                                                            {level.description}
                                                        </p>
                                                    </div>

                                                    {/* Radio Check Visualization */}
                                                    <div className="mt-1 shrink-0">
                                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-600 group-hover:border-slate-500'
                                                            }`}>
                                                            {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </div>

                            </motion.div>
                        ) : (
                            <div className="flex h-full items-center justify-center text-slate-500">
                                Select an area to begin
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
