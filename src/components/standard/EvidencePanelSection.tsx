/**
 * EvidencePanelSection — treść sekcji „Źródła i założenia" w `ArtifactRightPanel`.
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_RDZEN_2026-07-10.md §3.3 (gdzie kontrakt
 * jest WIDOCZNY — sekcja accordion ArtifactRightPanel ma naturalne miejsce).
 * Backend: server/src/routes/evidence.routes.ts + evidenceEnvelopeService.
 *
 * Ten komponent jest samowystarczalny (fetch własny, own loading/empty/error) —
 * `ArtifactRightPanel` renderuje sekcje synchronicznie, więc empty-state z
 * asynchronicznego fetcha nie może iść przez `section.isEmpty` (to pole jest
 * liczone przy budowie tablicy sections, przed odpowiedzią sieci).
 *
 * Wpięty jako PIERWSZY artefakt: Insight (`src/components/Interview/InsightViewer.tsx`).
 * Pozostałe typy artefaktów (initiative/report/deck/kpi/...) = TODO — interfejs
 * gotowy (przekaż inny `artifactType`), ale nikt jeszcze nie woła upsertEnvelope
 * dla tamtych ogniw (patrz TODO w evidenceEnvelopeService.ts).
 *
 * Zasady: wyłącznie tokeny `c-*`, zero crimson/primary-*. Fokus = c-focus.
 */
import { AlertTriangle, ExternalLink, FileText, Lightbulb, Link2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import type {
  EvidenceArtifactType,
  EvidenceAssumption,
  EvidenceAssumptionSourceType,
  EvidenceEnvelope,
  EvidenceSource,
} from '@/services/api/evidence.api';
import { fetchEvidenceEnvelope } from '@/services/api/evidence.api';

export interface EvidencePanelSectionProps {
  artifactType: EvidenceArtifactType;
  artifactId: string | undefined;
  isPolish: boolean;
}

const ASSUMPTION_BADGE: Record<
  EvidenceAssumptionSourceType,
  { tagClass: string; labelPl: string; labelEn: string }
> = {
  imported: { tagClass: 'bg-c-tag-1', labelPl: 'zaimportowane', labelEn: 'imported' },
  user: { tagClass: 'bg-c-tag-2', labelPl: 'użytkownik', labelEn: 'user' },
  teresa: { tagClass: 'bg-c-tag-3', labelPl: 'Teresa', labelEn: 'Teresa' },
  ai_assumed: { tagClass: 'bg-c-tag-4', labelPl: 'założenie AI', labelEn: 'AI assumed' },
  benchmark: { tagClass: 'bg-c-tag-5', labelPl: 'benchmark', labelEn: 'benchmark' },
};

const CONFIDENCE_TEXT_CLASS: Record<string, string> = {
  high: 'text-c-success',
  medium: 'text-c-warning',
  low: 'text-c-danger',
  unknown: 'text-c-text-muted',
};

function SourceRow({ source, isPolish }: { source: EvidenceSource; isPolish: boolean }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <FileText size={12} className="shrink-0 text-c-text-muted mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-c-text truncate">{source.type}</span>
          <span className="text-[11px] text-c-text-muted truncate">{source.ref}</span>
        </div>
        {source.snippet ? (
          <p className="text-[11px] text-c-text-muted italic line-clamp-2 mt-0.5">
            &ldquo;{source.snippet}&rdquo;
          </p>
        ) : null}
      </div>
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="p-1 rounded-md text-c-text-muted hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          title={isPolish ? 'Otwórz źródło' : 'Open source'}
        >
          <ExternalLink size={12} />
        </a>
      ) : null}
    </div>
  );
}

function AssumptionRow({
  assumption,
  isPolish,
}: {
  assumption: EvidenceAssumption;
  isPolish: boolean;
}) {
  const badge = ASSUMPTION_BADGE[assumption.source_type] ?? ASSUMPTION_BADGE.ai_assumed;
  const valueText =
    typeof assumption.value === 'object' ? JSON.stringify(assumption.value) : String(assumption.value);
  return (
    <div className="flex flex-col gap-1 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-c-text truncate">{assumption.key}</span>
        <span
          className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-medium text-c-tag-foreground shrink-0 ${badge.tagClass}`}
        >
          {isPolish ? badge.labelPl : badge.labelEn}
        </span>
      </div>
      <span className="text-[11px] text-c-text-muted truncate">{valueText}</span>
      {assumption.rationale ? (
        <span className="text-[11px] text-c-text-muted italic line-clamp-2">
          {assumption.rationale}
        </span>
      ) : null}
    </div>
  );
}

export const EvidencePanelSection: React.FC<EvidencePanelSectionProps> = ({
  artifactType,
  artifactId,
  isPolish,
}) => {
  const [envelope, setEnvelope] = useState<EvidenceEnvelope | null>(null);
  const [loading, setLoading] = useState<boolean>(!!artifactId);

  useEffect(() => {
    let cancelled = false;
    if (!artifactId) {
      setEnvelope(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchEvidenceEnvelope(artifactType, artifactId).then((env) => {
      if (!cancelled) {
        setEnvelope(env);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [artifactType, artifactId]);

  if (loading) {
    return <p className="text-xs text-c-text-muted py-1.5">{isPolish ? 'Ładowanie…' : 'Loading…'}</p>;
  }

  const hasSources = (envelope?.sources.length ?? 0) > 0;
  const hasAssumptions = (envelope?.assumptions.length ?? 0) > 0;
  const hasToVerify = (envelope?.toVerify.length ?? 0) > 0;

  if (!envelope || (!hasSources && !hasAssumptions && !hasToVerify)) {
    return (
      <p className="text-xs italic text-c-text-muted py-1.5">
        {isPolish
          ? 'Brak zarejestrowanych źródeł i założeń dla tego artefaktu.'
          : 'No sources or assumptions recorded for this artifact yet.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {envelope.confidence !== null ? (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-c-text-muted">
            {isPolish ? 'Pewność łańcucha' : 'Chain confidence'}
          </span>
          <span
            className={`text-xs font-semibold tabular-nums ${CONFIDENCE_TEXT_CLASS[envelope.confidenceLabel]}`}
          >
            {Math.round(envelope.confidence * 100)}%
          </span>
        </div>
      ) : null}

      {hasSources ? (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Link2 size={12} className="text-c-text-muted" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              {isPolish ? 'Źródła' : 'Sources'}
            </span>
          </div>
          <div className="flex flex-col divide-y divide-c-border-subtle">
            {envelope.sources.map((s, i) => (
              <SourceRow key={`${s.type}-${s.ref}-${i}`} source={s} isPolish={isPolish} />
            ))}
          </div>
        </div>
      ) : null}

      {hasAssumptions ? (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb size={12} className="text-c-text-muted" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              {isPolish ? 'Założenia' : 'Assumptions'}
            </span>
          </div>
          <div className="flex flex-col divide-y divide-c-border-subtle">
            {envelope.assumptions.map((a, i) => (
              <AssumptionRow key={`${a.key}-${i}`} assumption={a} isPolish={isPolish} />
            ))}
          </div>
        </div>
      ) : null}

      {hasToVerify ? (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={12} className="text-c-warning" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              {isPolish ? 'Do weryfikacji' : 'To verify'}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {envelope.toVerify.map((tv, i) => (
              <li key={`${tv.claim}-${i}`} className="flex flex-col gap-0.5">
                <span className="text-xs text-c-text">{tv.claim}</span>
                <span className="text-[11px] text-c-text-muted">{tv.why}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default EvidencePanelSection;
