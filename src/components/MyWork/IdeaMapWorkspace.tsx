/**
 * IdeaMapWorkspace — N-mode workspace for editing an idea with
 * recommendation map on the left and a standard Workspace tools panel
 * on the right.
 *
 * This is the canonical "Workspace" pattern. The tools panel reuses the
 * same shared sections (AI, Transform, Share) as the Notebook workspace.
 */
import { GitBranch, MessageSquare, PanelRightClose, PanelRightOpen, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { NModeAction, NModePropertyField, NModeSection } from '@/components/shared/NModeLayout';
import { NModeShell } from '@/components/shared/NModeLayout';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { buildArtifactCode } from '@/utils/artifactLinks';

import { IdeaRecommendationMap } from './IdeaRecommendationMap';
import { IdeaWorkspaceTools } from './IdeaWorkspaceTools';
import type { MyIdea } from './MyIdeasListContent';
import { buildAskAIMessage } from './shared/askAiHelper';

type IdeaMapWorkspaceProps = {
  ideaId: string;
  initialOpenMap?: boolean;
  onClose: () => void;
  onSaved: (idea: MyIdea) => void;
};

function safeTitleFromSeed(seedText: string, isPolish: boolean): string {
  const firstLine = String(seedText || '').trim().split('\n')[0]?.trim();
  return firstLine ? firstLine.slice(0, 120) : isPolish ? 'Nowe wyzwanie' : 'New challenge';
}

export const IdeaMapWorkspace: React.FC<IdeaMapWorkspaceProps> = ({
  ideaId,
  initialOpenMap,
  onClose,
  onSaved,
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

  const [activeSection, setActiveSection] = useState<'workspace'>('workspace');
  const [mapOpen, setMapOpen] = useState(Boolean(initialOpenMap));
  const [toolsPanelOpen, setToolsPanelOpen] = useState(true);

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
        } catch { /* best-effort */ }
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

  useEffect(() => { hydrate(); }, [hydrate]);

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
        await Api.convertMyIdea(realId, { target, options: { language: i18n.language } });
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

  const header = useMemo(
    () => ({
      title: title || (isPolish ? 'Wyzwanie' : 'Challenge'),
      onTitleChange: (v: string) => { setTitle(v); setDirty(true); },
      titleReadOnly: false,
      titlePlaceholder: { en: 'Name your challenge…', pl: 'Nazwij wyzwanie…' },
      artifactId: isDraft ? undefined : realId,
      artifactType: 'idea' as const,
      onSave: handleSave,
      saving,
      isDirty: dirty,
      onChat: openChat,
      onClose,
      draftSavedLabel,
      statusDotColor: 'bg-emerald-400',
    }),
    [dirty, draftSavedLabel, handleSave, isDraft, isPolish, onClose, openChat, realId, saving, title]
  );

  const properties = useMemo<NModePropertyField[]>(
    () => [
      {
        id: 'branch',
        label: { en: 'Branch', pl: 'Gałąź' },
        type: 'text',
        value: branch,
        onChange: (v) => { setBranch(v); setDirty(true); },
        placeholder: { en: 'e.g. Finance', pl: 'np. Finanse' },
      },
      {
        id: 'area',
        label: { en: 'Area', pl: 'Obszar' },
        type: 'text',
        value: area,
        onChange: (v) => { setArea(v); setDirty(true); },
        placeholder: { en: 'e.g. Ops', pl: 'np. Operacje' },
      },
      {
        id: 'priority',
        label: { en: 'Priority', pl: 'Priorytet' },
        type: 'select',
        value: String(Math.round(priority / 25) * 25),
        onChange: (v) => {
          const n = Number(v);
          setPriority(Number.isFinite(n) ? n : 50);
          setDirty(true);
        },
        options: [
          { value: '25', label: { en: 'Low', pl: 'Niski' } },
          { value: '50', label: { en: 'Medium', pl: 'Średni' } },
          { value: '75', label: { en: 'High', pl: 'Wysoki' } },
          { value: '100', label: { en: 'Critical', pl: 'Krytyczny' } },
        ],
      },
      {
        id: 'tools',
        label: { en: 'Tools', pl: 'Narzędzia' },
        type: 'custom',
        value: '',
        onChange: () => {},
        render: () => (
          <button
            onClick={() => setToolsPanelOpen((v) => !v)}
            className="w-full h-8 px-2.5 rounded-lg text-xs font-semibold bg-white dark:bg-navy-800 border border-slate-300/60 dark:border-navy-600/40 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            {toolsPanelOpen
              ? <><PanelRightClose size={12} />{isPolish ? 'Ukryj' : 'Hide'}</>
              : <><PanelRightOpen size={12} />{isPolish ? 'Pokaż' : 'Show'}</>}
          </button>
        ),
      },
    ],
    [area, branch, isPolish, priority, toolsPanelOpen]
  );

  const actions = useMemo<NModeAction[]>(
    () => [
      {
        id: 'ai',
        label: { en: 'AI propose', pl: 'AI: propozycje' },
        icon: Sparkles,
        variant: 'ai',
        onClick: () => {
          if (!isAccepted) {
            toast(isPolish ? 'Najpierw zaakceptuj wyzwanie.' : 'Accept the challenge first.');
            return;
          }
          toast(isPolish ? 'Wybierz gałąź na mapie, potem kliknij AI.' : 'Pick a branch on the map, then click AI.');
        },
      },
      {
        id: 'chat',
        label: { en: 'Chat', pl: 'Czat' },
        icon: MessageSquare,
        variant: 'neutral',
        onClick: openChat,
      },
      {
        id: 'tools',
        label: { en: 'Tools', pl: 'Narzędzia' },
        icon: toolsPanelOpen ? PanelRightClose : PanelRightOpen,
        variant: 'neutral',
        onClick: () => setToolsPanelOpen((v) => !v),
      },
    ],
    [isAccepted, isPolish, openChat, toolsPanelOpen]
  );

  const sections = useMemo<NModeSection[]>(
    () => [
      {
        id: 'workspace',
        icon: GitBranch,
        label: { en: 'Workspace', pl: 'Workspace' },
        component: (
          <div className="h-[72vh] min-h-[560px] flex">
            {/* Map fills available space */}
            <div className="flex-1 min-w-0 h-full">
              <IdeaRecommendationMap
                ideaId={realId}
                ideaTitle={title || safeTitleFromSeed(seedText, isPolish)}
                onClose={() => setMapOpen(false)}
                onCenterEdit={() => setToolsPanelOpen(true)}
                variant={mapOpen ? 'overlay' : 'embedded'}
                showClose={mapOpen}
                className={mapOpen ? '' : 'rounded-none'}
                locked={!isAccepted}
              />
            </div>

            {/* Tools panel — standard Workspace sidebar */}
            <IdeaWorkspaceTools
              open={toolsPanelOpen}
              onClose={() => setToolsPanelOpen(false)}
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
              onTitleChange={(v) => { setTitle(v); setDirty(true); }}
              onSeedTextChange={(v) => { setSeedText(v); setDirty(true); }}
              onBranchChange={(v) => { setBranch(v); setDirty(true); }}
              onAreaChange={(v) => { setArea(v); setDirty(true); }}
              onPriorityChange={(v) => { setPriority(v); setDirty(true); }}
              onSave={handleSave}
              onAcceptChallenge={handleAcceptChallenge}
              onConvert={handleConvert}
              onOpenChat={openChat}
            />
          </div>
        ),
      },
    ],
    [
      area,
      branch,
      draftSavedLabel,
      handleAcceptChallenge,
      handleConvert,
      handleSave,
      isAccepted,
      isDraft,
      isPolish,
      mapOpen,
      openChat,
      priority,
      realId,
      saving,
      seedText,
      stage,
      title,
      toolsPanelOpen,
    ]
  );

  return (
    <NModeShell
      header={header}
      properties={properties}
      sections={sections}
      actions={actions}
      actionsVisible={true}
      activeSection={activeSection}
      onSectionChange={(id) => setActiveSection(id as any)}
      presentationMode={'n'}
      onPresentationModeChange={() => {}}
      showModeSwitcher={false}
      buildArtifactCode={(type, id) => buildArtifactCode(type as any, id)}
      loading={loading}
    />
  );
};

export default IdeaMapWorkspace;
