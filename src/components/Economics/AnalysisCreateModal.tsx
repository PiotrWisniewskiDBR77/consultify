/**
 * Analysis Create Modal
 *
 * Modal for creating new digitization analyses
 */

import { Briefcase, FileText, Tag, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { DigitizationAnalysis } from './types';

interface AnalysisCreateModalProps {
  onClose: () => void;
  onCreate: (analysis: DigitizationAnalysis) => void;
}

export const AnalysisCreateModal: React.FC<AnalysisCreateModalProps> = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    projectId: '',
    analysisType: 'financial',
  });
  const [projects, setProjects] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Api.getProjects().then(setProjects).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Enter name analysis');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await Api.createDigitizationAnalysis({
        name: formData.name,
        description: formData.description || undefined,
        projectId: formData.projectId || undefined,
        analysisType: formData.analysisType,
      });
      toast.success('Analiza utworzona!');
      onCreate(result);
    } catch (e) {
      toast.error('Failed to create analysis');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700
                rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
              <FileText size={24} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900 dark:text-white">Nowa analysis</h2>
              <p className="text-xs text-slate-600 dark:text-slate-500">
                Create financial or maturity analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              Nazwa analysis <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="np. Maturity Assessment Q1 2025"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700
                                dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              <Briefcase size={14} className="inline mr-1.5 -mt-0.5" />
              Link to project{' '}
              <span className="text-slate-600 dark:text-slate-500 font-normal">(opcjonalnie)</span>
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData((prev) => ({ ...prev, projectId: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700
                                dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            >
              <option value="">Bez projektu</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Analysis Type */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              Typ analysis
            </label>
            <select
              value={formData.analysisType}
              onChange={(e) => setFormData((prev) => ({ ...prev, analysisType: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700
                                dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            >
              <option value="financial">Analiza ekonomiczna</option>
              <option value="maturity">Maturity Assessment</option>
              <option value="combined">Combined</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              Opis{' '}
              <span className="text-slate-600 dark:text-slate-500 font-normal">(opcjonalnie)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this analysis purpose..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700
                                dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none transition-all"
            />
          </div>

          {/* Info */}
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4">
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              After creating analysis you will go to the appropriate workspace: maturity assessment
              or analysis ekonomicznej.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white
                                font-medium transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl
                                font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                shadow-lg shadow-emerald-600/20"
            >
              {isSubmitting ? 'Creating...' : 'Create analysis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AnalysisCreateModal;
