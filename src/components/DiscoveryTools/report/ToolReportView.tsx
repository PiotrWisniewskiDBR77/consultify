/**
 * Deterministyczny widok Report / Presentation dla Tool Outputu.
 *
 * ZASADY (decyzja koordynatora 2026-08-13):
 *  - renderuje ZATWIERDZONY Artifact, nigdy zrzut ekranu;
 *  - ten sam dokument + ta sama wersja renderera = ten sam wynik;
 *  - Presentation usuwa kontrolki i skraca treść, ale NIE zmienia znaczenia;
 *  - Light = Executive Paper, Dark = Executive Night; oba przechodzą MPQ osobno.
 *
 * KANON UI:
 *  - wyłącznie tokeny `c-*`; crimson NIGDY nie służy jako kolor danych —
 *    serie i kategorie biorą paletę `c-tag-*`, sygnały `c-success/warning/info`;
 *  - action title jest WNIOSKIEM, nie etykietą sekcji;
 *  - argument → dowód → implikacja;
 *  - kontrolowana przestrzeń, minimalne granice, brak cieni „SaaS dashboard".
 */

import React from 'react';
import { useTranslation, type TFunction } from 'react-i18next';

import type {
  EvidenceKind,
  ReportBlock,
  ToolReportDocument,
} from '@/toolOutputs/types';

/** Etykiety typu dowodu — hipoteza NIGDY nie udaje faktu. */
function etykietyDowodu(t: TFunction): Record<EvidenceKind, { label: string; tone: string }> {
  return {
    fact: { label: t('discoveryTools.swot.evidence.fact', 'fact'), tone: 'text-c-success' },
    observation: { label: t('discoveryTools.swot.evidence.observation', 'observation'), tone: 'text-c-info' },
    hypothesis: { label: t('discoveryTools.swot.evidence.hypothesis', 'hypothesis'), tone: 'text-c-warning' },
  };
}

/** Postawa napięcia — kolory z palety danych `c-tag-*`. */
const POSTURE_DOT: Record<string, string> = {
  attack: 'bg-c-tag-3',
  repair: 'bg-c-tag-5',
  defend: 'bg-c-tag-7',
  protect: 'bg-c-tag-9',
};

/** Słownik enumu postawy napięcia (PLAN §2 pkt 6). */
function etykietyPostawy(t: TFunction): Record<string, string> {
  return {
    attack: t('discoveryTools.report.posture.attack', 'Attack the opportunity'),
    repair: t('discoveryTools.report.posture.repair', 'Repair to reach it'),
    defend: t('discoveryTools.report.posture.defend', 'Defend with strength'),
    protect: t('discoveryTools.report.posture.protect', 'Protect the exposure'),
  };
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
      {children}
    </div>
  );
}

/**
 * Wyeksportowany dla `SlideDeckView` (Slide Mode) — jedno źródło rendera
 * bloku, żeby slajdy i przewijany dokument NIGDY nie rozjechały się w
 * interpretacji tej samej treści (zero zduplikowanej logiki renderowania).
 */
export function BlockView({ block }: { block: ReportBlock }) {
  const { t } = useTranslation();
  const EVIDENCE_LABEL = etykietyDowodu(t);
  const POSTURE_LABEL = etykietyPostawy(t);
  switch (block.kind) {
    case 'action-title':
      return <h3 className="text-lg font-semibold text-c-text">{block.text}</h3>;

    case 'paragraph':
      return <p className="text-sm leading-relaxed text-c-text-secondary">{block.text}</p>;

    case 'evidence-list':
      return (
        <section className="space-y-2">
          <Eyebrow>{t('discoveryTools.report.evidence', 'Evidence')}</Eyebrow>
          <ul className="space-y-1.5">
            {block.items.map((it, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm text-c-text-secondary">
                <span className="mt-[2px] h-1.5 w-1.5 shrink-0 rounded-full bg-c-border-strong" />
                <span className="flex-1">{it.label}</span>
                <span
                  className={`shrink-0 text-[10px] uppercase tracking-[0.14em] ${
                    EVIDENCE_LABEL[it.evidenceKind].tone
                  }`}
                >
                  {EVIDENCE_LABEL[it.evidenceKind].label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      );

    case 'tension-list':
      return (
        <section className="space-y-2">
          <Eyebrow>{t('discoveryTools.report.strategicTensions', 'Strategic tensions')}</Eyebrow>
          <ul className="divide-y divide-c-border-subtle">
            {block.items.map((tension, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    POSTURE_DOT[tension.posture] ?? 'bg-c-border-strong'
                  }`}
                />
                <span className="flex-1 text-sm text-c-text">{tension.title}</span>
                <span className="text-[11px] text-c-text-muted">
                  {POSTURE_LABEL[tension.posture] ?? tension.posture}
                </span>
                {/* Waga pochodzi z silnika — to jest K1, nie ocena redakcyjna. */}
                <span className="w-8 text-right text-xs tabular-nums text-c-text-secondary">
                  {tension.priority}
                </span>
              </li>
            ))}
          </ul>
        </section>
      );

    case 'conclusion':
      return (
        <section className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-4">
          <div className="space-y-3">
            <div>
              <Eyebrow>{t('discoveryTools.report.whatIs', 'What it is')}</Eyebrow>
              <p className="mt-1 text-sm font-medium text-c-text">{block.k1Fact}</p>
            </div>
            <div>
              <Eyebrow>{t('discoveryTools.report.whatItMeans', 'What it means')}</Eyebrow>
              <p className="mt-1 text-sm leading-relaxed text-c-text-secondary">{block.k2Meaning}</p>
            </div>
            <div>
              <Eyebrow>{t('discoveryTools.report.whatToDoFirst', 'What to do first')}</Eyebrow>
              <ol className="mt-1 space-y-1">
                {block.k3Actions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm text-c-text">
                    <span className="tabular-nums text-c-text-muted">{i + 1}.</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <Eyebrow>Jaki efekt</Eyebrow>
              <p className="mt-1 text-sm text-c-text-secondary">{block.k4Effect}</p>
            </div>

            {/* Trade-off jest OBOWIĄZKOWY w W2 — bez niego nie było decyzji. */}
            <div className="rounded-lg border border-c-border-subtle bg-c-surface p-3">
              <Eyebrow>Trade-off</Eyebrow>
              <dl className="mt-1.5 space-y-1 text-[13px]">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-c-text-muted">Wybrane</dt>
                  <dd className="text-c-text">{block.tradeoff.chosen}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-c-text-muted">Odrzucone</dt>
                  <dd className="text-c-text">{block.tradeoff.rejected || '—'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-c-text-muted">Dlaczego</dt>
                  <dd className="text-c-text-secondary">{block.tradeoff.why || '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      );

    case 'signature-visual':
      return <SignatureVisual archetype={block.archetype} payload={block.payload} />;

    default:
      return null;
  }
}

/** Geometria sygnaturowa — pole 2×2 z napięciami dla Dynamic SWOT. */
function SignatureVisual({ archetype, payload }: { archetype: string; payload: unknown }) {
  const { t } = useTranslation();
  const data = payload as {
    items?: Array<{ id: string; label: string; bucket: string }>;
    tensions?: Array<{ posture: string; sourceItemIds: [string, string] }>;
  };
  if (archetype !== 'dynamic-swot') return null;

  const QUADRANTS: Array<{ key: string; label: string }> = [
    { key: 'strengths', label: t('discoveryTools.swot.strengths', 'Strengths') },
    { key: 'weaknesses', label: t('discoveryTools.swot.weaknesses', 'Weaknesses') },
    { key: 'opportunities', label: t('discoveryTools.swot.opportunities', 'Szanse') },
    { key: 'threats', label: t('discoveryTools.swot.threats', 'Threats') },
  ];

  return (
    <section className="space-y-2">
      <Eyebrow>{t('discoveryTools.swot.strategicField', 'Strategic field')}</Eyebrow>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-c-border-subtle bg-c-border-subtle">
        {QUADRANTS.map((q) => {
          const inQ = (data.items ?? []).filter((i) => i.bucket === q.key);
          return (
            <div key={q.key} className="min-h-[92px] bg-c-surface p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                {q.label}
              </div>
              <ul className="mt-1.5 space-y-1">
                {inQ.map((i) => (
                  <li key={i.id} className="text-[13px] leading-snug text-c-text">
                    {i.label}
                  </li>
                ))}
                {inQ.length === 0 && <li className="text-[13px] text-c-text-muted">—</li>}
              </ul>
            </div>
          );
        })}
      </div>
      {/* Napięcia łączą ćwiartki — bez nich to tylko cztery listy. */}
      <div className="text-[11px] text-c-text-muted">
        {t('discoveryTools.swot.tensionsCount', '{{count}} tensions connect the quadrants', {
          count: (data.tensions ?? []).length,
        })}
      </div>
    </section>
  );
}

export interface ToolReportViewProps {
  doc: ToolReportDocument;
  /** Presentation View usuwa kontrolki — tryb prezentacyjny. */
  presentationMode?: boolean;
}

export function ToolReportView({ doc, presentationMode = false }: ToolReportViewProps) {
  const { t } = useTranslation();
  const isDeck = doc.kind === 'presentation';

  return (
    <article
      data-testid="tool-report-view"
      data-renderer-version={doc.rendererVersion}
      data-content-hash={doc.contentHash}
      className="mx-auto w-full max-w-3xl bg-c-bg p-8 text-c-text"
    >
      <header className="mb-6 border-b border-c-border-subtle pb-4">
        <Eyebrow>
          {isDeck
            ? t('discoveryTools.report.execPresentation', 'Prezentacja wykonawcza')
            : t('discoveryTools.report.title', 'Report')}
        </Eyebrow>
        <h1 className="mt-1.5 text-2xl font-semibold leading-tight text-c-text">{doc.title}</h1>
        {!presentationMode && (
          <p className="mt-2 text-xs text-c-text-muted">
            {t('discoveryTools.report.rendererInfo', 'Renderer {{version}} · sources: {{count}}', {
              version: doc.rendererVersion,
              count: doc.sourceOutputIds.length,
            })}
          </p>
        )}
      </header>

      <div className="space-y-8">
        {doc.sections.map((section) => (
          <section key={section.id} className="space-y-4">
            {/* Action title = wniosek. Jeden dominujący komunikat na sekcję. */}
            <h2 className="text-base font-semibold leading-snug text-c-text">
              {section.actionTitle}
            </h2>
            {section.blocks.map((block, i) => (
              <BlockView key={i} block={block} />
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}

export default ToolReportView;
