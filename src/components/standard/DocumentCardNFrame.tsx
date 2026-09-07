import { ChevronDown } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { NModeMenu2 } from '@/components/shared/NModeLayout/NModeMenu2';

import { ArtifactPropertiesTable, type ArtifactPropertyRow } from './ArtifactPropertiesTable';
import { ArtifactRightPanel, type ArtifactRightPanelSection } from './ArtifactRightPanel';
import { PracujZAI } from './PracujZAI';
import type { ZrodloUzupelnienia } from './PracujZAI.types';
import {
  getDocumentCardMainSections,
  getDocumentCardRightSections,
  type DocumentCardNType,
} from './documentCardContracts';

export interface DocumentCardNFrameProps {
  type: DocumentCardNType;
  title: string;
  children: React.ReactNode;
  properties: ArtifactPropertyRow[];
  actions?: React.ReactNode;
  relations?: React.ReactNode;
  evidence?: React.ReactNode;
  comments?: React.ReactNode;
  history?: React.ReactNode;
  isPolish: boolean;
  editable?: boolean;
  activeSection?: string | null;
  onActiveSectionChange?: (id: string) => void;
  onAnalyze: () => void;
  analysisBusy?: boolean;
  fillSection?: ZrodloUzupelnienia;
  fillDocument?: ZrodloUzupelnienia;
  className?: string;
}

const empty = (pl: string, en: string, isPolish: boolean) => (
  <p className="text-xs text-c-text-muted">{isPolish ? pl : en}</p>
);

/** Shared Menu 5 + canonical right panel for the P14-B document/creator family. */
export const DocumentCardNFrame: React.FC<DocumentCardNFrameProps> = ({
  type,
  title,
  children,
  properties,
  actions,
  relations,
  evidence,
  comments,
  history,
  isPolish,
  editable = true,
  activeSection,
  onActiveSectionChange,
  onAnalyze,
  analysisBusy,
  fillSection,
  fillDocument,
  className = '',
}) => {
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [readMode, setReadMode] = useState(false);
  const mainSections = getDocumentCardMainSections(type);
  const rightContract = getDocumentCardRightSections(type);

  const contentById: Record<string, React.ReactNode> = {
    actions: actions ?? empty('Brak dodatkowych akcji.', 'No additional actions.', isPolish),
    properties: (
      <ArtifactPropertiesTable
        rows={properties}
        propertyLabel={isPolish ? 'Właściwość' : 'Property'}
        valueLabel={isPolish ? 'Wartość' : 'Value'}
      />
    ),
    relations: relations ?? empty('Brak powiązań.', 'No relations.', isPolish),
    evidence:
      evidence ?? empty('Brak zapisanych źródeł i założeń.', 'No sources or assumptions recorded.', isPolish),
    comments: comments ?? empty('Brak komentarzy.', 'No comments.', isPolish),
    history: history ?? empty('Brak zapisanej historii.', 'No history recorded.', isPolish),
  };

  const panelSections = useMemo<ArtifactRightPanelSection[]>(
    () =>
      rightContract.map((section) => ({
        id: section.id,
        label: isPolish ? section.label.pl : section.label.en,
        defaultOpen: section.id === 'actions' || section.id === 'properties',
        children: contentById[section.id],
      })),
    // content nodes intentionally track the caller payload on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rightContract, isPolish, actions, properties, relations, evidence, comments, history]
  );

  return (
    <div className={`flex min-h-0 flex-1 flex-col bg-c-bg ${className}`} data-card-n-type={type}>
      <div className="sticky top-0 z-20 px-4 pt-3">
        <NModeMenu2
          isPolish={isPolish}
          readMode={readMode}
          onReadModeChange={editable ? setReadMode : undefined}
          sectionsMenu={
            <div className="relative">
              <button
                type="button"
                aria-expanded={sectionsOpen}
                onClick={() => setSectionsOpen((open) => !open)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-c-border-subtle px-2.5 text-xs font-medium text-c-text-secondary hover:bg-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {isPolish ? 'Sekcje' : 'Sections'} <ChevronDown size={13} />
              </button>
              {sectionsOpen ? (
                <div className="absolute left-0 top-10 z-40 min-w-56 rounded-xl border border-c-border-subtle bg-c-surface p-1 shadow-lg">
                  {mainSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => {
                        onActiveSectionChange?.(section.id);
                        setSectionsOpen(false);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-xs text-c-text-secondary hover:bg-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      {isPolish ? section.label.pl : section.label.en}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          }
          aiButton={
            <PracujZAI
              isPolish={isPolish}
              onAnalizuj={onAnalyze}
              analizaWToku={analysisBusy}
              aktywnaSekcja={activeSection ?? mainSections[0]?.id ?? null}
              kontekstArtefaktu={{ title, type }}
              moznaEdytowac={editable && !readMode}
              powodTylkoOdczyt={
                isPolish ? 'karta jest otwarta tylko do odczytu' : 'the card is read-only'
              }
              uzupelnijSekcje={fillSection}
              uzupelnijDokument={fillDocument}
            />
          }
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_var(--ntype-right-panel-width,320px)] gap-4 overflow-hidden p-4">
        <div className="min-w-0 overflow-auto" data-card-n-content>
          {children}
        </div>
        <ArtifactRightPanel
          sections={panelSections}
          width="100%"
          className="h-full"
          ariaLabel={isPolish ? 'Panel karty' : 'Card panel'}
        />
      </div>
    </div>
  );
};

export default DocumentCardNFrame;
