/**
 * NarrativeEngineMetadata — G1/G2 Frontend
 *
 * Displays metadata about the Narrative Engine pipeline execution:
 * facts used, observations generated, and post-check pass/fail status.
 * Shown in the block footer when a section was generated via the V3 engine.
 */
import { AlertTriangle, CheckCircle2, Database, Eye, Lightbulb, XCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface NarrativeEngineMetadataProps {
  factsUsed?: number;
  observationsUsed?: number;
  postCheckPassed?: boolean;
  generationModel?: string;
  className?: string;
}

export const NarrativeEngineMetadata: React.FC<NarrativeEngineMetadataProps> = ({
  factsUsed,
  observationsUsed,
  postCheckPassed,
  generationModel,
  className = '',
}) => {
  const { t } = useTranslation();

  if (!generationModel || !generationModel.includes('narrative-engine')) return null;

  return (
    <div
      className={`flex items-center gap-3 px-2.5 py-1.5 rounded-lg bg-primary-500/5 border border-primary-500/10 text-[10px] ${className}`}
    >
      <span className="flex items-center gap-1 text-primary-400/80">
        <Lightbulb size={10} />
        V3 Engine
      </span>

      {factsUsed != null && (
        <span className="flex items-center gap-1 text-slate-600">
          <Database size={9} />
          {factsUsed} {t('reports.narrative.facts', 'facts')}
        </span>
      )}

      {observationsUsed != null && (
        <span className="flex items-center gap-1 text-slate-600">
          <Eye size={9} />
          {observationsUsed} {t('reports.narrative.observations', 'observations')}
        </span>
      )}

      {postCheckPassed != null && (
        <span
          className={`flex items-center gap-1 ${
            postCheckPassed ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          {postCheckPassed ? <CheckCircle2 size={9} /> : <AlertTriangle size={9} />}
          {postCheckPassed
            ? t('reports.narrative.checksPass', 'Checks passed')
            : t('reports.narrative.checksWarn', 'Checks flagged')}
        </span>
      )}
    </div>
  );
};

export default NarrativeEngineMetadata;
