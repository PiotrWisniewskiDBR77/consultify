import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuestionsForAxis, DRDLevel } from '../services/drdStructure';
import { AxisId } from '../types';
import { ArrowRight, CheckCircle2, ChevronRight, Info } from 'lucide-react';

interface MaturityMatrixProps {
    axisId: number;
    axisKey: AxisId;
    currentScores: { [areaId: string]: number };
    onScoreSelect: (areaId: string, level: number) => void;
    onComplete: () => void;
}

export const MaturityMatrix: React.FC<MaturityMatrixProps> = ({
    axisId,
    axisKey,
    currentScores,
    onScoreSelect,
    onComplete
}) => {
    const areas = getQuestionsForAxis(axisId);
    // Default select first area
    const [selectedAreaId, setSelectedAreaId] = useState<string | null>(areas[0]?.id || null);

    const isComplete = areas.every(area => currentScores[area.id] !== undefined && currentScores[area.id] > 0);
    const progressPercent = (Object.keys(currentScores).length / areas.length) * 100;

    const currentArea = areas.find(a => a.id === selectedAreaId);
    const currentAreaScore = selectedAreaId ? currentScores[selectedAreaId] : undefined;

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
            <div className="shrink-0 h-16 border-b border-white/5 flex items-center px-8 justify-between bg-[#0B1120]">
                <div className="flex items-center gap-4">
                    <div className="h-2 w-32 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-400"
                        />
                    </div>
                    <span className="text-xs font-medium text-slate-400 tracking-wider uppercase">
                        {Object.keys(currentScores).length} of {areas.length} Areas Evaluated
                    </span>
                </div>

                {isComplete && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={onComplete}
                        className="flex items-center gap-2 px-6 py-2 bg-white text-[#0B1120] rounded-full text-sm font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-shadow"
                    >
                        Complete Assessment <ArrowRight size={16} />
                    </motion.button>
                )}
            </div>

            {/* 2. Main Content: Split Layout */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT: Agenda / Areas Navigation */}
                <div className="w-80 border-r border-white/5 bg-[#0F1629] overflow-y-auto custom-scrollbar">
                    <div className="p-6">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                            Assessment Areas
                        </h3>
                        <div className="space-y-1">
                            {areas.map((area, idx) => {
                                const isSelected = selectedAreaId === area.id;
                                const score = currentScores[area.id];
                                const isScored = score !== undefined && score > 0;

                                return (
                                    <button
                                        key={area.id}
                                        onClick={() => setSelectedAreaId(area.id)}
                                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all duration-200 group ${isSelected
                                                ? 'bg-blue-600/10 text-white shadow-sm ring-1 ring-blue-500/20'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${isScored
                                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                    : isSelected
                                                        ? 'border-blue-400 text-blue-400'
                                                        : 'border-slate-700 text-slate-600'
                                                }`}>
                                                {isScored ? <CheckCircle2 size={12} /> : idx + 1}
                                            </div>
                                            <span className="text-sm font-medium truncate w-40">{area.name}</span>
                                        </div>
                                        {isSelected && <ChevronRight size={14} className="text-blue-500" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Detail & Selection */}
                <div className="flex-1 overflow-y-auto bg-gradient-to-br from-[#0B1120] to-[#111827] p-8 lg:p-12 relative">
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
                                <div className="mb-10">
                                    <div className="inline-flex items-center px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-semibold tracking-wider mb-4">
                                        AREA {currentArea.id}
                                    </div>
                                    <h2 className="text-3xl md:text-4xl font-light text-white mb-4">
                                        {currentArea.name}
                                    </h2>
                                    <p className="text-slate-400 text-lg leading-relaxed max-w-2xl">
                                        Assess your organization's capability in this specific domain by selecting the level that best matches your current reality.
                                    </p>
                                </div>

                                {/* Levels Grid */}
                                <div className="grid gap-4">
                                    {currentArea.levels.map((level) => {
                                        const isSelected = currentAreaScore === level.level;

                                        return (
                                            <motion.button
                                                key={level.level}
                                                onClick={() => handleScore(currentArea.id, level.level)}
                                                whileHover={{ scale: 1.005 }}
                                                whileTap={{ scale: 0.995 }}
                                                className={`group relative text-left p-6 rounded-xl border transition-all duration-300 w-full ${isSelected
                                                        ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.15)] z-10'
                                                        : 'bg-[#131B2E] border-white/5 hover:border-white/10 hover:bg-[#1A2338]'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-6">
                                                    {/* Level Indicator */}
                                                    <div className={`mt-1 w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-lg font-bold transition-colors duration-300 ${isSelected
                                                            ? 'bg-blue-500 text-white shadow-lg'
                                                            : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300'
                                                        }`}>
                                                        {level.level}
                                                    </div>

                                                    {/* Text Content */}
                                                    <div className="flex-1">
                                                        <h4 className={`text-lg font-semibold mb-2 transition-colors ${isSelected ? 'text-blue-100' : 'text-slate-200 group-hover:text-white'
                                                            }`}>
                                                            {level.title}
                                                        </h4>
                                                        <p className={`text-sm leading-relaxed transition-colors ${isSelected ? 'text-blue-200/80' : 'text-slate-400 group-hover:text-slate-300'
                                                            }`}>
                                                            {level.description}
                                                        </p>
                                                    </div>

                                                    {/* Radio Check Visualization */}
                                                    <div className="mt-2 shrink-0">
                                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-600 group-hover:border-slate-500'
                                                            }`}>
                                                            {isSelected && <CheckCircle2 size={16} className="text-white" />}
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
