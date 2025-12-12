import React, { useState } from 'react';
import { AdditionalAudit, Language } from '../../types';
import { Plus, Trash2, FileText, Link as LinkIcon, UploadCloud, Search } from 'lucide-react';

interface AssessmentAuditsWorkspaceProps {
    audits: AdditionalAudit[];
    onAddAudit: (audit: AdditionalAudit) => void;
    onRemoveAudit: (id: string) => void;
    language: Language;
}

export const AssessmentAuditsWorkspace: React.FC<AssessmentAuditsWorkspaceProps> = ({
    audits,
    onAddAudit,
    onRemoveAudit,
    language
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newAudit, setNewAudit] = useState<Partial<AdditionalAudit>>({});

    const handleAdd = () => {
        if (newAudit.name && newAudit.score) {
            onAddAudit({
                id: Date.now().toString(),
                name: newAudit.name,
                date: newAudit.date || new Date().toISOString().split('T')[0],
                score: newAudit.score,
                fileUrl: newAudit.fileUrl,
                mappedAxis: newAudit.mappedAxis
            });
            setNewAudit({});
            setIsAdding(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-navy-900 text-white p-8">
            <div className="mb-8">
                <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                    {language === 'PL' ? 'Dodatkowe Audyty' : 'Additional Audits'}
                    <span className="text-xs font-normal text-slate-500 border border-white/10 px-2 py-0.5 rounded ml-2">ADMA, SIRI, ISO, Lean</span>
                </h2>
                <p className="text-slate-400 text-sm">
                    {language === 'PL'
                        ? 'Wgraj wyniki innych audytów, aby AI mogło je zmapować na model DRD.'
                        : 'Upload results from other frameworks so AI can map them to the DRD model.'}
                </p>
            </div>

            {/* Audit List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {audits.map(audit => (
                    <div key={audit.id} className="bg-navy-950/50 border border-white/10 rounded-xl p-4 relative group hover:border-purple-500/30 transition-colors">
                        <button
                            onClick={() => onRemoveAudit(audit.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
                        >
                            <Trash2 size={16} />
                        </button>

                        <div className="flex items-start gap-3 mb-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                <FileText size={20} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">{audit.name}</h3>
                                <p className="text-xs text-slate-500">{audit.date}</p>
                            </div>
                        </div>

                        <div className="flex justify-between items-center bg-white/5 rounded px-3 py-2 mb-2">
                            <span className="text-xs text-slate-400">Score</span>
                            <span className="font-mono font-bold text-purple-300">{audit.score}</span>
                        </div>

                        {audit.mappedAxis && (
                            <div className="text-[10px] text-green-400 flex items-center gap-1">
                                <LinkIcon size={10} />
                                Mapped to: <span className="uppercase">{audit.mappedAxis}</span>
                            </div>
                        )}
                    </div>
                ))}

                {/* Add New Card */}
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="border border-dashed border-white/10 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-white hover:bg-white/5 transition-all min-h-[160px]"
                    >
                        <Plus size={32} />
                        <span className="text-sm font-medium">Add Audit Result</span>
                    </button>
                )}

                {/* Form Card */}
                {isAdding && (
                    <div className="bg-navy-800 border border-purple-500/50 rounded-xl p-4 shadow-lg shadow-purple-900/20">
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Audit Name (e.g. ADMA 2024)"
                                className="w-full bg-navy-900 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                                value={newAudit.name || ''}
                                onChange={e => setNewAudit({ ...newAudit, name: e.target.value })}
                            />
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    className="w-1/2 bg-navy-900 border border-white/10 rounded px-3 py-2 text-sm text-slate-300 focus:outline-none"
                                    value={newAudit.date || ''}
                                    onChange={e => setNewAudit({ ...newAudit, date: e.target.value })}
                                />
                                <input
                                    type="text"
                                    placeholder="Score"
                                    className="w-1/2 bg-navy-900 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none"
                                    value={newAudit.score || ''}
                                    onChange={e => setNewAudit({ ...newAudit, score: e.target.value })}
                                />
                            </div>

                            {/* File Upload Placeholder */}
                            <div className="border border-dashed border-white/10 bg-navy-900/50 rounded h-16 flex items-center justify-center text-xs text-slate-500 cursor-pointer hover:bg-navy-900 transition-colors">
                                <div className="flex items-center gap-2">
                                    <UploadCloud size={14} />
                                    <span>Upload Report (PDF)</span>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setIsAdding(false)} className="flex-1 px-3 py-2 rounded text-xs text-slate-400 hover:bg-white/5">Cancel</button>
                                <button onClick={handleAdd} className="flex-1 px-3 py-2 rounded text-xs bg-purple-600 text-white font-bold hover:bg-purple-500">Save</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};
