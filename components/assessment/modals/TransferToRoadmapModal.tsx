/**
 * TransferToRoadmapModal
 * 
 * Modal for transferring an approved initiative to the roadmap.
 * Allows selection of:
 * - Target quarter (Q1-Q4 for current and next year)
 * - Priority (optional)
 * - Additional notes
 */

import React, { useState, useEffect } from 'react';
import {
    X,
    MapPin,
    Calendar,
    AlertTriangle,
    Loader2,
    CheckCircle2,
    Target,
    Flag
} from 'lucide-react';

interface TransferToRoadmapModalProps {
    initiativeId: string;
    initiativeName: string;
    onClose: () => void;
    onTransferred: () => void;
}

// Generate quarters for current and next year
const generateQuarters = () => {
    const currentYear = new Date().getFullYear();
    const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
    
    const quarters: { value: string; label: string; isPast: boolean }[] = [];
    
    // Current year quarters
    for (let q = 1; q <= 4; q++) {
        quarters.push({
            value: `${currentYear}-Q${q}`,
            label: `Q${q} ${currentYear}`,
            isPast: q < currentQuarter
        });
    }
    
    // Next year quarters
    for (let q = 1; q <= 4; q++) {
        quarters.push({
            value: `${currentYear + 1}-Q${q}`,
            label: `Q${q} ${currentYear + 1}`,
            isPast: false
        });
    }
    
    return quarters;
};

const PRIORITY_OPTIONS = [
    { value: 'LOW', label: 'Niski', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    { value: 'MEDIUM', label: 'Średni', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    { value: 'HIGH', label: 'Wysoki', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    { value: 'CRITICAL', label: 'Krytyczny', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
];

export const TransferToRoadmapModal: React.FC<TransferToRoadmapModalProps> = ({
    initiativeId,
    initiativeName,
    onClose,
    onTransferred
}) => {
    const [quarters] = useState(generateQuarters);
    const [selectedQuarter, setSelectedQuarter] = useState<string>('');
    const [priority, setPriority] = useState<string>('MEDIUM');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Set default quarter to current + 1 (or first non-past quarter)
    useEffect(() => {
        const firstFuture = quarters.find(q => !q.isPast);
        if (firstFuture) {
            setSelectedQuarter(firstFuture.value);
        }
    }, [quarters]);

    // Handle transfer
    const handleTransfer = async () => {
        if (!selectedQuarter) {
            setError('Wybierz kwartał');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/initiatives/${initiativeId}/transfer-to-roadmap`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    quarter: selectedQuarter,
                    priority,
                    notes: notes.trim()
                })
            });

            if (response.ok) {
                setSuccess(true);
                setTimeout(() => {
                    onTransferred();
                    onClose();
                }, 1500);
            } else {
                const data = await response.json();
                setError(data.error || 'Nie udało się przenieść do roadmapy');
            }
        } catch (err) {
            console.error('[TransferToRoadmapModal] Transfer error:', err);
            setError('Błąd połączenia');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                                    Dodaj do Roadmapy
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                    {initiativeName}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-5">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-lg font-medium text-navy-900 dark:text-white">
                                Dodano do Roadmapy!
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Inicjatywa została zaplanowana
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Quarter Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                    <Calendar size={16} className="text-purple-500" />
                                    Docelowy kwartał <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {quarters.slice(0, 8).map((quarter) => (
                                        <button
                                            key={quarter.value}
                                            onClick={() => !quarter.isPast && setSelectedQuarter(quarter.value)}
                                            disabled={quarter.isPast}
                                            className={`
                                                px-3 py-2 rounded-lg text-sm font-medium transition-all border-2
                                                ${quarter.isPast
                                                    ? 'bg-slate-50 dark:bg-navy-950 text-slate-400 dark:text-slate-600 border-transparent cursor-not-allowed'
                                                    : selectedQuarter === quarter.value
                                                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-500'
                                                        : 'bg-white dark:bg-navy-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30'
                                                }
                                            `}
                                        >
                                            {quarter.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Priority Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                    <Flag size={16} className="text-amber-500" />
                                    Priorytet
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {PRIORITY_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setPriority(opt.value)}
                                            className={`
                                                px-3 py-2 rounded-lg text-xs font-medium transition-all border-2
                                                ${priority === opt.value
                                                    ? `${opt.color} border-current`
                                                    : 'bg-white dark:bg-navy-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                                                }
                                            `}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Notatki (opcjonalne)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Dodatkowe uwagi dotyczące planowania..."
                                    rows={3}
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                    <AlertTriangle size={16} />
                                    {error}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                {!success && (
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 rounded-lg font-medium hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={handleTransfer}
                                disabled={!selectedQuarter || submitting}
                                className={`
                                    flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
                                    ${selectedQuarter && !submitting
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                    }
                                `}
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Przenoszę...
                                    </>
                                ) : (
                                    <>
                                        <MapPin size={16} />
                                        Dodaj do Roadmapy
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

