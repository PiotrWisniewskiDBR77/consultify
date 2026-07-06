import { AlertOctagon, BookOpen, Brain, GitBranch, Lightbulb, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FullInitiative } from '../types';
import { Button } from './ui/primitives/Button';

interface Props {
  initiative: FullInitiative;
  onChange: (updates: Partial<FullInitiative>) => void;
}

export const InitiativeIntelligenceTab: React.FC<Props> = ({ initiative, onChange }) => {
  const { t } = useTranslation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initiative }),
      });
      if (!res.ok) throw new Error('Analysis failed');

      const data = await res.json();
      onChange({
        patternTags: data.patternTags || [],
        lessonsLearned: data.lessonsLearned,
        strategicSurprises: data.strategicSurprises,
        nextTimeAvoid: data.nextTimeAvoid,
      });
    } catch (error) {
      console.error(error);
      alert('Failed to generate insights.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-8 h-full">
      {/* Left Column: Retrospective */}
      <div className="space-y-6 overflow-y-auto pr-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-c-text font-bold flex items-center gap-2">
            <BookOpen size={18} className="text-primary-400" /> {t('intelligence.title')}
          </h3>
          <Button
            size="sm"
            variant="ghost"
            className="text-primary-400 hover:text-primary-300"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          >
            <Sparkles size={14} className={isAnalyzing ? 'animate-spin' : ''} />
            {isAnalyzing ? t('intelligence.analyzing') : t('intelligence.autoGenerate')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="bg-c-surface-raised rounded-xl p-4 border border-c-border-subtle group focus-within:border-primary-500/50 transition-colors">
            <label className="flex items-center gap-2 text-sm font-bold text-green-400 mb-2">
              <Lightbulb size={16} /> {t('intelligence.learnedTitle')}
            </label>
            <textarea
              className="w-full bg-transparent text-c-text text-sm focus:outline-none resize-none min-h-[100px]"
              placeholder={t('intelligence.learnedPlaceholder')}
              value={initiative.lessonsLearned || ''}
              onChange={(e) => onChange({ lessonsLearned: e.target.value })}
            />
          </div>

          <div className="bg-c-surface-raised rounded-xl p-4 border border-c-border-subtle group focus-within:border-amber-500/50 transition-colors">
            <label className="flex items-center gap-2 text-sm font-bold text-amber-400 mb-2">
              <AlertOctagon size={16} /> {t('intelligence.surprisedTitle')}
            </label>
            <textarea
              className="w-full bg-transparent text-c-text text-sm focus:outline-none resize-none min-h-[100px]"
              placeholder={t('intelligence.surprisedPlaceholder')}
              value={initiative.strategicSurprises || ''}
              onChange={(e) => onChange({ strategicSurprises: e.target.value })}
            />
          </div>

          <div className="bg-c-surface-raised rounded-xl p-4 border border-c-border-subtle group focus-within:border-danger-500/50 transition-colors">
            <label className="flex items-center gap-2 text-sm font-bold text-danger-400 mb-2">
              <GitBranch size={16} /> {t('intelligence.differentlyTitle')}
            </label>
            <textarea
              className="w-full bg-transparent text-c-text text-sm focus:outline-none resize-none min-h-[100px]"
              placeholder={t('intelligence.differentlyPlaceholder')}
              value={initiative.nextTimeAvoid || ''}
              onChange={(e) => onChange({ nextTimeAvoid: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Right Column: Pattern Recognition */}
      <div className="space-y-6">
        <div className="bg-c-surface-raised rounded-xl p-6 border border-c-border-subtle h-full flex flex-col">
          <h3 className="text-c-text font-bold flex items-center gap-2 mb-6">
            <Brain size={18} className="text-blue-400" /> {t('intelligence.patternsTitle')}
          </h3>

          <div className="flex-1">
            {!initiative.patternTags || initiative.patternTags.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500 dark:text-slate-400 gap-3 text-center">
                <GitBranch size={32} className="opacity-20" />
                <p className="text-sm">
                  {t('intelligence.noPatterns')}
                  <br />
                  {t('intelligence.noPatternsDesc')}
                </p>
                <Button size="sm" variant="outline" onClick={handleAnalyze}>
                  {t('intelligence.detectPatterns')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-500 uppercase font-bold tracking-wider">
                  {t('intelligence.detectedPatternsLabel')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {initiative.patternTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="bg-blue-500/10 text-blue-300 border border-blue-500/20 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 group hover:bg-blue-500/20 cursor-default transition-colors"
                    >
                      <GitBranch size={12} /> {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-8 p-4 bg-blue-900/10 rounded-lg border border-blue-500/10">
                  <h4 className="text-xs font-bold text-blue-400 mb-2 uppercase">
                    {t('intelligence.knowledgeGraphTitle')}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-500 leading-relaxed">
                    {t('intelligence.knowledgeGraphSharing')}{' '}
                    <span className="text-c-text font-bold">85%</span>{' '}
                    {t('intelligence.knowledgeGraphSimilarity')}{' '}
                    <span className="italic text-c-text-muted">Project Alpha (2024)</span>. Consider
                    reviewing their " stakeholder engagement plan".
                  </p>
                  <button className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline">
                    {t('intelligence.viewRelated')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
