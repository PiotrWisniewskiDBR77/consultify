/**
 * IdeaMapConsolidatedPanel — Oś P (SPEC-A) consolidation of the Mind Map's
 * three legacy right-side drawers into ONE `<ArtifactRightPanel>` accordion.
 *
 * SSOT powłoki: Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md (SPEC-A,
 * archetyp A Canvas — prawy panel accordion). This is the artifact analogue of
 * the mels-canvas adapter: a pure "wrap" that DOES NOT lift or duplicate state.
 * It renders the three existing panel components as accordion-section children
 * with their `open` prop forced true, and forwards the exact prop bundles that
 * `IdeaMapWorkspace` already computes. No logic is reimplemented here.
 *
 * Gated by `isMindmapConsolidatedPanel()` (default OFF). When the flag is OFF
 * this component is never rendered and the three legacy drawers stay
 * byte-for-byte identical. Only the Mind Map tool uses this — Process Flow /
 * Whiteboard / Table keep their legacy drawers until Piotr signs off.
 *
 * ⚠ Crimson-safe: this file introduces no `primary-*` classes. The wrapped
 * children carry their own (unchanged) styling; `ArtifactRightPanel` itself is
 * `c-*`-only per its SSOT.
 */
import { ListChecks, Search, Sparkles } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';

import { IdeaAISuggestionsPanel } from './IdeaAISuggestionsPanel';
import { IdeaContextPanel } from './IdeaContextPanel';
import { IdeaWorkspaceTools } from './IdeaWorkspaceTools';

/**
 * We forward the wrapped panels' props verbatim. To avoid drifting three prop
 * lists out of sync with the source components we accept their prop objects as
 * opaque bundles (the caller — IdeaMapWorkspace — already builds them). Each
 * bundle is passed straight through; the `open`/`embedded`/`onClose` framing
 * props are overridden here so the panels render their content inline without
 * their own drawer chrome.
 */
export interface IdeaMapConsolidatedPanelProps {
  /** Which legacy panel key the workspace considers active (drives which section opens first). */
  activePanel: 'tools' | 'context' | 'ai_suggestions' | null;
  /** Close handler — same as the legacy drawers' onClose (sets activePanel = null). */
  onClose: () => void;
  /** Prop bundle for <IdeaWorkspaceTools> (minus open/embedded/onClose, supplied here). */
  toolsProps: Record<string, unknown>;
  /** Prop bundle for <IdeaContextPanel> (minus open/onClose, supplied here). */
  contextProps: Record<string, unknown>;
  /** Prop bundle for <IdeaAISuggestionsPanel> (minus open/onClose, supplied here). */
  aiSuggestionsProps: Record<string, unknown>;
}

export const IdeaMapConsolidatedPanel: React.FC<IdeaMapConsolidatedPanelProps> = ({
  activePanel,
  onClose,
  toolsProps,
  contextProps,
  aiSuggestionsProps,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const sections = useMemo<ArtifactRightPanelSection[]>(
    () => [
      {
        id: 'tools',
        label: isPl ? 'Właściwości i narzędzia' : 'Properties & tools',
        icon: ListChecks,
        // `embedded` drops the panel's own drawer chrome so it fills the
        // accordion body. `open` forced true renders its inner sections.
        children: (
          <IdeaWorkspaceTools
            {...(toolsProps as any)}
            open
            embedded
            onClose={onClose}
          />
        ),
        defaultOpen: activePanel === 'tools' || activePanel === null,
      },
      {
        id: 'context',
        label: isPl ? 'Kontekst' : 'Context',
        icon: Search,
        children: <IdeaContextPanel {...(contextProps as any)} open onClose={onClose} />,
        defaultOpen: activePanel === 'context',
      },
      {
        id: 'ai_suggestions',
        label: isPl ? 'Sugestie AI' : 'AI suggestions',
        icon: Sparkles,
        children: (
          <IdeaAISuggestionsPanel {...(aiSuggestionsProps as any)} open onClose={onClose} />
        ),
        defaultOpen: activePanel === 'ai_suggestions',
      },
    ],
    [isPl, activePanel, onClose, toolsProps, contextProps, aiSuggestionsProps]
  );

  return (
    <ArtifactRightPanel
      sections={sections}
      width={360}
      ariaLabel={isPl ? 'Panel artefaktu mapy' : 'Mind map artifact panel'}
    />
  );
};

export default IdeaMapConsolidatedPanel;
