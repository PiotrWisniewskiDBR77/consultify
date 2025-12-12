import React, { useState } from 'react';
import { Api } from '../services/api';
import { ThumbsUp, ThumbsDown, MessageSquare, X, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AIFeedbackButtonProps {
    context: string; // e.g., "diagnosis", "recommendation"
    data?: any;      // The content being rated (optional)
    onFeedbackSubmit?: () => void;
}

export const AIFeedbackButton: React.FC<AIFeedbackButtonProps> = ({ context, data, onFeedbackSubmit }) => {
    const [showModal, setShowModal] = useState(false);
    const [rating, setRating] = useState<'positive' | 'negative' | null>(null);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!rating && !comment) return;

        setSubmitting(true);
        try {
            await Api.aiDetailFeedback({
                action: context,
                rating: rating === 'positive' ? 1 : -1,
                user_comment: comment,
                original_prompt: JSON.stringify(data)
            });
            toast.success('Thank you for your feedback!');
            setShowModal(false);
            setRating(null);
            setComment('');
            if (onFeedbackSubmit) onFeedbackSubmit();
        } catch {
            toast.error('Failed to submit feedback');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="flex gap-2">
                <button
                    onClick={() => { setRating('positive'); setShowModal(true); }}
                    className="p-1 hover:bg-green-500/10 rounded text-slate-400 hover:text-green-500 transition-colors"
                    title="Helpful"
                >
                    <ThumbsUp size={14} />
                </button>
                <button
                    onClick={() => { setRating('negative'); setShowModal(true); }}
                    className="p-1 hover:bg-red-500/10 rounded text-slate-400 hover:text-red-500 transition-colors"
                    title="Not Helpful"
                >
                    <ThumbsDown size={14} />
                </button>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <MessageSquare size={16} className="text-purple-400" />
                                Provide Feedback
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                        </div>

                        <div className="flex gap-4 justify-center mb-6">
                            <button
                                onClick={() => setRating('positive')}
                                className={`p-3 rounded-xl border transition-all ${rating === 'positive'
                                    ? 'bg-green-500/20 border-green-500 text-green-400'
                                    : 'bg-navy-950 border-white/5 text-slate-400 hover:border-green-500/50'}`}
                            >
                                <ThumbsUp size={24} />
                            </button>
                            <button
                                onClick={() => setRating('negative')}
                                className={`p-3 rounded-xl border transition-all ${rating === 'negative'
                                    ? 'bg-red-500/20 border-red-500 text-red-400'
                                    : 'bg-navy-950 border-white/5 text-slate-400 hover:border-red-500/50'}`}
                            >
                                <ThumbsDown size={24} />
                            </button>
                        </div>

                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Tell us more about your experience... (optional)"
                            className="w-full bg-navy-950 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-purple-500 outline-none h-24 mb-4 resize-none"
                        />

                        <button
                            onClick={handleSubmit}
                            disabled={submitting || (!rating && !comment)}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                        >
                            {submitting ? 'Sending...' : <><Send size={14} /> Send Feedback</>}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
