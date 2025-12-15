import React from 'react';
import { FullSession } from '../types';
import { Flag, CheckSquare, BookOpen, Lock } from 'lucide-react';

interface RolloutClosureTabProps {
    data: FullSession['rollout'];
    onUpdate: (data: FullSession['rollout']) => void;
    onCloseProgram: () => void;
}

export const RolloutClosureTab: React.FC<RolloutClosureTabProps> = ({ data, onUpdate, onCloseProgram }) => {

    // Mock checklist logic
    const checklist = data?.closure?.checklist || [
        { item: 'All Initiatives Completed', completed: false },
        { item: 'KPI Targets Reviewed', completed: false },
        { item: 'Documentation Archived', completed: false },
        { item: 'Handover Owner Assigned', completed: false },
        { item: 'Final Budget Reconciliation', completed: false }
    ];

    const toggleCheck = (index: number) => {
        const newChecklist = [...checklist];
        newChecklist[index].completed = !newChecklist[index].completed;
        onUpdate({
            ...data,
            closure: { ...data?.closure, checklist: newChecklist, isClosed: false, lessonsLearned: [] } // Simple update
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Flag className="text-slate-500" />
                        Program Closure
                    </h2>
                    <p className="text-slate-500">Final review, lessons learned, and handover.</p>
                </div>
                {/* Close Button */}
                <button
                    onClick={onCloseProgram}
                    className="bg-navy-800 hover:bg-navy-900 border border-slate-700 text-slate-300 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                >
                    <Lock size={16} /> Close Program
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Closure Checklist */}
                <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <CheckSquare className="text-green-500" size={20} /> Readiness Checklist
                    </h3>
                    <div className="space-y-3">
                        {checklist.map((item, i) => (
                            <label key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-950 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={item.completed}
                                    onChange={() => toggleCheck(i)}
                                    className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                />
                                <span className={`font-medium ${item.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {item.item}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* 2. Lessons Learned */}
                <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <BookOpen className="text-blue-500" size={20} /> Lessons Learned
                    </h3>
                    <div className="text-center py-8 text-slate-400 italic">
                        No lessons recorded yet.
                    </div>
                    <button className="w-full py-2 border border-dashed border-slate-300 dark:border-white/20 rounded text-slate-500 hover:text-blue-500 font-bold transition-colors">
                        + Add Lesson
                    </button>
                </div>
            </div>
        </div>
    );
};
