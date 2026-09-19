import { FileText } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { DocumentCardMenu5 } from '@/components/standard/DocumentCardMenu5';
import { StandardArtifactShell } from '@/components/standard/StandardArtifactShell';
import type { ArtifactBreadcrumbItem } from '@/components/standard/ArtifactBreadcrumb';
import type { PrimaryActionSlot, StandardSekcjaDef } from '@/components/standard/StandardArtifactShell.types';
import type { KontekstArtefaktuAI } from '@/components/standard/PracujZAI.types';
import type { KartaNKey } from '@/components/standard/registry';

import type { ReportBuilderDocumentSection } from '@/types';

function ReportBuilderDocumentSectionBlock({ section }: { section: ReportBuilderDocumentSection }) {
  return (
    <article className="space-y-3" data-testid={`report-builder-document-section-${section.sectionKey}`}>
      <h2 className="text-lg font-semibold text-c-text">{section.title}</h2>
      <pre className="whitespace-pre-wrap rounded-xl border border-c-border-subtle bg-c-surface-raised p-4 text-sm leading-6 text-c-text-secondary">
        {section.editedContent || section.generatedContent}
      </pre>
    </article>
  );
}

export interface ReportBuilderDocumentLike {
  sections: ReportBuilderDocumentSection[];
}

export interface ReportBuilderDocumentViewerProps {
  document: ReportBuilderDocumentLike;
  artifactId: string;
  title: string;
  statusLabel?: string | null;
  statusTone?: 'draft' | 'review' | 'approved' | 'rejected' | 'neutral';
  onBack: () => void;
  rightPanel: any;
  panelAriaLabel: string;
  primaryActionReason: string;
  primaryAction?: PrimaryActionSlot;
  aiContext: KontekstArtefaktuAI;
  aiReadOnlyReason: string;
  onAskAi?: () => void;
  breadcrumb?: readonly ArtifactBreadcrumbItem[];
  karta?: KartaNKey;
}

export function ReportBuilderDocumentViewer({
  document,
  artifactId,
  title,
  statusLabel,
  statusTone = 'draft',
  onBack,
  rightPanel,
  panelAriaLabel,
  primaryActionReason,
  primaryAction,
  aiContext,
  aiReadOnlyReason,
  onAskAi,
  breadcrumb,
  karta = 'report-builder',
}: ReportBuilderDocumentViewerProps) {
  const visibleSections = document.sections.filter((section) => section.enabled !== false);
  const initialSection = visibleSections[0]?.sectionKey ?? 'report';
  const [activeSection, setActiveSection] = useState(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection, artifactId]);

  const sections: StandardSekcjaDef[] = useMemo(
    () =>
      visibleSections.map((section) => ({
        id: section.sectionKey,
        label: { pl: section.title, en: section.title },
        icon: FileText,
        iconName: 'FileText',
        component: <ReportBuilderDocumentSectionBlock section={section} />,
        aiContract: { none: true as const, reason: aiReadOnlyReason },
      })),
    [visibleSections, aiReadOnlyReason]
  );

  return (
    <div className="h-full min-h-0" data-testid="report-builder-document-viewer">
      <StandardArtifactShell
        karta={karta}
        klasa="L"
        breadcrumb={breadcrumb}
        header={{
          title,
          onTitleChange: () => undefined,
          titleReadOnly: true,
          artifactType: 'report',
          artifactId,
          onSave: () => undefined,
          saveState: 'saved',
          onClose: onBack,
          statusLabel: statusLabel || undefined,
          statusTone,
        }}
        primaryAction={primaryAction ?? { intentionallyNone: true, reason: primaryActionReason }}
        sections={sections}
        rightPanel={rightPanel}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        densityMode="n"
        onDensityModeChange={() => undefined}
        toolbar={
          <DocumentCardMenu5
            sections={sections}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            readMode
            ai={{
              onAnalizuj: onAskAi || (() => undefined),
              kontekstArtefaktu: aiContext,
              moznaEdytowac: false,
              powodTylkoOdczyt: aiReadOnlyReason,
            }}
          />
        }
        panelAriaLabel={panelAriaLabel}
      />
    </div>
  );
}

export default ReportBuilderDocumentViewer;
