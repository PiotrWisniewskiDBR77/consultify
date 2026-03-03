/**
 * IdeaMapWorkspace — fullscreen workspace for editing an idea.
 * Recommendation map fills all available space, tools panel is a
 * collapsible sidebar on the right (controlled by parent via props).
 *
 * This is the canonical "Workspace" pattern. No NModeShell wrapper —
 * the workspace occupies the entire content area below the dynamic tabs.
 */
import { Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { WorkspacePanelStrip, type WorkspacePanelKey } from '@/components/shared/WorkspacePanelStrip';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';

import { IdeaCanvasToolSelector, type CanvasToolType } from './IdeaCanvasToolSelector';
import { IdeaAISuggestionsPanel } from './IdeaAISuggestionsPanel';
import { IdeaContextPanel } from './IdeaContextPanel';
import { IdeaRecommendationMap } from './IdeaRecommendationMap';
import { IdeaTableTool } from './IdeaTableTool';
import { IdeaWorkspaceTools } from './IdeaWorkspaceTools';
import type { MyIdea } from './MyIdeasListContent';
import { buildAskAIMessage } from './shared/askAiHelper';

type IdeaMapWorkspaceProps = {
  ideaId: string;
  initialOpenMap?: boolean;
  onClose: () => void;
  onSaved: (idea: MyIdea) => void;
  toolsOpen?: boolean;
  onToolsOpenChange?: (open: boolean) => void;
};

function safeTitleFromSeed(seedText: string, isPolish: boolean): string {
  const firstLine = String(seedText || '')
    .trim()
    .split('\n')[0]
    ?.trim();
  return firstLine ? firstLine.slice(0, 120) : isPolish ? 'Nowe wyzwanie' : 'New challenge';
}

export const IdeaMapWorkspace: React.FC<IdeaMapWorkspaceProps> = ({
  ideaId,
  initialOpenMap,
  onClose,
  onSaved,
  toolsOpen: toolsOpenProp,
  onToolsOpenChange,
}) => {
  const { i18n } = useTranslation();
  const isPolish = useMemo(() => i18n.language?.startsWith('pl'), [i18n.language]);
  const isNewInitial = useMemo(() => ideaId.startsWith('new-idea-'), [ideaId]);
  const { setChatKickoffMessage, isChatCollapsed, toggleChatCollapse } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [realId, setRealId] = useState(ideaId);
  const [title, setTitle] = useState('');
  const [seedText, setSeedText] = useState('');
  const [stage, setStage] = useState<string>('seed');
  const [branch, setBranch] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [priority, setPriority] = useState<number>(50);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const [mapOpen, setMapOpen] = useState(Boolean(initialOpenMap));

  const [activeTool, setActiveTool] = useState<CanvasToolType>('mindmap');
  const [activePanel, setActivePanel] = useState<WorkspacePanelKey>(toolsOpenProp ? 'tools' : null);
  const [mapRefreshToken, setMapRefreshToken] = useState(0);
  const userSelectedToolRef = React.useRef(false);

  useEffect(() => {
    if (typeof toolsOpenProp !== 'boolean') return;
    if (toolsOpenProp) {
      setActivePanel('tools');
      return;
    }
    setActivePanel((prev) => (prev === 'tools' ? null : prev));
  }, [toolsOpenProp]);

  const handlePanelChange = useCallback(
    (next: WorkspacePanelKey) => {
      setActivePanel(next);
      onToolsOpenChange?.(next === 'tools');
    },
    [onToolsOpenChange]
  );

  const toolsPanelOpen = activePanel === 'tools';
  const contextPanelOpen = activePanel === 'context';
  const aiPanelOpen = activePanel === 'ai_suggestions';

  const isDraft = useMemo(() => isNewInitial && realId === ideaId, [ideaId, isNewInitial, realId]);
  const isAccepted = useMemo(() => {
    const s = String(stage || '').toLowerCase();
    return !(s === '' || s === 'seed' || s === 'spark');
  }, [stage]);

  const hydrate = useCallback(async () => {
    setLoading(true);
    try {
      if (isNewInitial) {
        const created = await Api.createMyIdea({
          title: isPolish ? 'Nowe wyzwanie' : 'New challenge',
          body: '',
          tags: [],
          sourceType: 'manual',
        });
        const nextId = String(created?.id || ideaId);
        setRealId(nextId);
        setTitle(String(created?.title || (isPolish ? 'Nowe wyzwanie' : 'New challenge')));
        setSeedText(String(created?.seed_text || created?.seedText || created?.body || ''));
        setStage(String(created?.stage || 'seed'));
        setBranch(String(created?.branch || ''));
        setArea(String(created?.area || ''));
        setPriority(Number.isFinite(Number(created?.priority)) ? Number(created.priority) : 50);
        onSaved(created as MyIdea);
        setDirty(true);

        try {
          const res = await Api.getMyIdeaMap(nextId, { language: i18n.language });
          const map = res?.map || {};
          const nodes = Array.isArray(map.nodes) ? map.nodes : [];
          const edges = Array.isArray(map.edges) ? map.edges : [];
          await Api.saveMyIdeaMap(nextId, { nodes, edges });
        } catch {
          /* best-effort */
        }
      } else {
        const idea = (await Api.getMyIdea(ideaId)) as any;
        setRealId(String(idea?.id || ideaId));
        setTitle(String(idea?.title || ''));
        setSeedText(String(idea?.seed_text || idea?.seedText || idea?.body || ''));
        setStage(String(idea?.stage || 'seed'));
        setBranch(String(idea?.branch || ''));
        setArea(String(idea?.area || ''));
        setPriority(Number.isFinite(Number(idea?.priority)) ? Number(idea.priority) : 50);
        setDirty(false);
        setLastSavedAt(idea?.updatedAt ? new Date(idea.updatedAt).getTime() : null);
      }
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Nie udało się wczytać' : 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, isNewInitial, isPolish, onSaved]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const openChat = useCallback(() => {
    setChatKickoffMessage(
      buildAskAIMessage({
        type: 'idea',
        title: title || seedText?.slice(0, 80) || (isPolish ? 'Wyzwanie' : 'Challenge'),
        description: seedText || undefined,
      })
    );
    if (isChatCollapsed) toggleChatCollapse();
  }, [isChatCollapsed, isPolish, seedText, setChatKickoffMessage, title, toggleChatCollapse]);

  const handleSave = useCallback(async () => {
    if (isDraft) return;
    setSaving(true);
    try {
      const payload: any = {
        title: (title || safeTitleFromSeed(seedText, isPolish)).trim().slice(0, 255),
        body: seedText,
        branch: branch || null,
        area: area || null,
        priority: Number.isFinite(priority) ? priority : 50,
      };
      const updated = await Api.updateMyIdea(realId, payload);
      onSaved(updated as MyIdea);
      setStage(String((updated as any)?.stage || stage || 'seed'));
      setDirty(false);
      setLastSavedAt(Date.now());
      toast.success(isPolish ? 'Zapisano' : 'Saved', { duration: 900 });
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Nie udało się zapisać' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }, [area, branch, isDraft, isPolish, onSaved, priority, realId, seedText, stage, title]);

  const handleAcceptChallenge = useCallback(async () => {
    if (isDraft) return;
    const nextTitle = (title || safeTitleFromSeed(seedText, isPolish)).trim().slice(0, 255);
    if (!seedText.trim()) {
      toast(isPolish ? 'Najpierw opisz wyzwanie.' : 'Describe the challenge first.');
      return;
    }
    setSaving(true);
    try {
      const updated = await Api.updateMyIdea(realId, {
        title: nextTitle,
        body: seedText,
        stage: 'incubating',
      });
      setTitle(String((updated as any)?.title || nextTitle));
      setStage(String((updated as any)?.stage || 'incubating'));
      onSaved(updated as MyIdea);
      setDirty(false);
      setLastSavedAt(Date.now());
      toast.success(isPolish ? 'Wyzwanie zaakceptowane' : 'Challenge accepted', { duration: 1100 });
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Nie udało się' : 'Failed'));
    } finally {
      setSaving(false);
    }
  }, [isDraft, isPolish, onSaved, realId, seedText, title]);

  const handleConvert = useCallback(
    async (target: 'initiative' | 'task_set' | 'decision' | 'team_chat') => {
      if (isDraft) return;
      setSaving(true);
      try {
        trackFunnelEvent('mywork_convert_clicked', { from: 'idea', to: target });
        const result = await Api.convertMyIdea(realId, {
          target,
          options: { language: i18n.language },
        });
        trackFunnelEvent('mywork_convert_completed', {
          from: 'idea',
          toType: target,
          has_source: Boolean(result?.sourceSessionId),
        });
        if (result?.sourceSessionId) {
          trackFunnelEvent('mywork_session_materialized', {
            source: 'idea_convert',
            sourceEntityId: realId,
            target,
            sessionId: result.sourceSessionId,
          });
        }
        toast.success(isPolish ? 'Gotowe' : 'Done');
      } catch (err: any) {
        toast.error(err?.message || (isPolish ? 'Nie udało się' : 'Failed'));
      } finally {
        setSaving(false);
      }
    },
    [i18n.language, isDraft, isPolish, realId]
  );

  const draftSavedLabel = useMemo(() => {
    if (saving) return isPolish ? 'Zapisuję…' : 'Saving…';
    if (!lastSavedAt) return 'Draft';
    const sec = Math.max(1, Math.round((Date.now() - lastSavedAt) / 1000));
    return isPolish ? `Zapisano ${sec}s temu` : `Saved ${sec}s ago`;
  }, [isPolish, lastSavedAt, saving]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-navy-950">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex overflow-hidden bg-white dark:bg-navy-950">
      {/* Map fills all available space */}
      <div className="flex-1 min-w-0 h-full relative">
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          <IdeaCanvasToolSelector
            activeTool={activeTool}
            onToolChange={(next) => {
              userSelectedToolRef.current = true;
              setActiveTool(next);
            }}
            disabledTools={['process_flow', 'whiteboard']}
          />
          <WorkspacePanelStrip value={activePanel} onChange={handlePanelChange} />
        </div>

        {activeTool === 'mindmap' ? (
          <IdeaRecommendationMap
            key={`${realId}:${mapRefreshToken}`}
            ideaId={realId}
            ideaTitle={title || safeTitleFromSeed(seedText, isPolish)}
            onClose={() => setMapOpen(false)}
            onCenterEdit={() => handlePanelChange('tools')}
            preferredTool={activeTool}
            extensions={{}}
            onPreferredToolLoaded={(tool) => {
              if (!tool) return;
              if (userSelectedToolRef.current) return;
              setActiveTool(tool);
            }}
            variant={mapOpen ? 'overlay' : 'embedded'}
            showClose={mapOpen}
            className={mapOpen ? '' : 'rounded-none'}
            locked={!isAccepted}
          />
        ) : activeTool === 'table' ? (
          <IdeaTableTool
            open
            ideaId={realId}
            locked={!isAccepted}
            refreshToken={mapRefreshToken}
            onSaved={() => setMapRefreshToken((v) => v + 1)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            {isPolish ? 'Narzędzie w przygotowaniu' : 'Tool coming soon'}
          </div>
        )}
      </div>

      {/* Tools panel sidebar */}
      <IdeaWorkspaceTools
        open={toolsPanelOpen}
        onClose={() => handlePanelChange(null)}
        ideaId={realId}
        title={title}
        seedText={seedText}
        stage={stage}
        branch={branch}
        area={area}
        priority={priority}
        isDraft={isDraft}
        isAccepted={isAccepted}
        saving={saving}
        draftSavedLabel={draftSavedLabel}
        onTitleChange={(v) => {
          setTitle(v);
          setDirty(true);
        }}
        onSeedTextChange={(v) => {
          setSeedText(v);
          setDirty(true);
        }}
        onBranchChange={(v) => {
          setBranch(v);
          setDirty(true);
        }}
        onAreaChange={(v) => {
          setArea(v);
          setDirty(true);
        }}
        onPriorityChange={(v) => {
          setPriority(v);
          setDirty(true);
        }}
        onSave={handleSave}
        onAcceptChallenge={handleAcceptChallenge}
        onConvert={handleConvert}
        onOpenChat={openChat}
      />

      <IdeaContextPanel
        open={contextPanelOpen}
        onClose={() => handlePanelChange(null)}
        ideaId={realId}
        title={title || safeTitleFromSeed(seedText, isPolish)}
      />

      <IdeaAISuggestionsPanel
        open={aiPanelOpen}
        onClose={() => handlePanelChange(null)}
        title={title || safeTitleFromSeed(seedText, isPolish)}
        onSendToChat={openChat}
      />
    </div>
  );
};

export default IdeaMapWorkspace;
