/**
 * InitiativeTeamSection
 *
 * Initiative → Team management using canonical `TeamManagementPanel`.
 * AI proposals (add/update/remove) are triggered by `teamAiRequest` from `useInitiativeContext()`.
 */

import { Loader2, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type OrgUser as PanelOrgUser,
  TeamManagementPanel,
  type TeamMember as PanelTeamMember,
  type TeamRole as PanelTeamRole,
} from '@/components/assessment/manage/TeamManagementPanel';
import { Callout, EmptyStateInline } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';

import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

type TeamAiProposal = {
  add: Array<{ userId: string; role: PanelTeamRole; reason: string }>;
  update: Array<{ userId: string; role: PanelTeamRole; reason: string }>;
  remove: Array<{ userId: string; reason: string }>;
  note?: string;
};

function safeJsonParse(raw: string): any | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] || text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeRole(raw: any): PanelTeamRole {
  const v = String(raw || '')
    .toLowerCase()
    .trim();
  if (v === 'admin' || v === 'manager' || v === 'editor' || v === 'viewer') return v;
  return 'viewer';
}

function normalizeProposal(raw: any): TeamAiProposal {
  const addRaw = Array.isArray(raw?.add) ? raw.add : [];
  const updateRaw = Array.isArray(raw?.update) ? raw.update : [];
  const removeRaw = Array.isArray(raw?.remove) ? raw.remove : [];

  const add: TeamAiProposal['add'] = addRaw
    .map((a: any) => ({
      userId: String(a?.userId || '').trim(),
      role: normalizeRole(a?.role),
      reason: String(a?.reason || a?.why || '').trim(),
    }))
    .filter((a: any) => a.userId)
    .slice(0, 20);

  const update: TeamAiProposal['update'] = updateRaw
    .map((u: any) => ({
      userId: String(u?.userId || '').trim(),
      role: normalizeRole(u?.role),
      reason: String(u?.reason || '').trim(),
    }))
    .filter((u: any) => u.userId)
    .slice(0, 20);

  const remove: TeamAiProposal['remove'] = removeRaw
    .map((r: any) => ({
      userId: String(r?.userId || '').trim(),
      reason: String(r?.reason || '').trim(),
    }))
    .filter((r: any) => r.userId)
    .slice(0, 20);

  const note = raw?.note ? String(raw.note).trim() : undefined;
  return { add, update, remove, note };
}

export const InitiativeTeamSection: React.FC<InitiativeSectionProps> = () => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const { users, initiative, teamAiRequest, clearTeamAiRequest } = useInitiativeContext();

  const [members, setMembers] = useState<PanelTeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [showAIModal, setShowAIModal] = useState(false);
  const [isAIProposing, setIsAIProposing] = useState(false);
  const [isApplyingAiProposal, setIsApplyingAiProposal] = useState(false);
  const [aiProposal, setAiProposal] = useState<TeamAiProposal | null>(null);

  const [selectedAddIds, setSelectedAddIds] = useState<Record<string, boolean>>({});
  const [selectedUpdateIds, setSelectedUpdateIds] = useState<Record<string, boolean>>({});
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<Record<string, boolean>>({});

  const projectId = initiative?.projectId ? String(initiative.projectId) : null;

  const ensureProjectId = useCallback(async (): Promise<string> => {
    if (projectId) return projectId;

    const initiativeId = initiative?.id;
    const initiativeName = initiative?.name || initiative?.title || 'Untitled Initiative';
    if (!initiativeId)
      throw new Error(isPolish ? 'Brak ID inicjatywy' : 'Initiative ID is missing');

    const createRes: any = await Api.post('/projects', {
      name: initiativeName,
      description: isPolish
        ? `Projekt automatycznie utworzony dla inicjatywy "${initiativeName}"`
        : `Project auto-created for initiative "${initiativeName}"`,
    });
    const newProjectId = String(createRes?.id || '');
    if (!newProjectId)
      throw new Error(isPolish ? 'Nie udało się utworzyć projektu' : 'Failed to create project');

    await Api.post(`/initiatives/${initiativeId}/move`, {
      targetProjectId: newProjectId,
      moveTasks: true,
    });

    return newProjectId;
  }, [initiative?.id, initiative?.name, initiative?.title, isPolish, projectId]);

  const loadMembers = useCallback(
    async (pidOverride?: string) => {
      const pid = pidOverride || projectId;
      if (!pid) {
        setMembers([]);
        return;
      }
      try {
        setLoadingMembers(true);
        const res: any = await Api.get(`/projects/${pid}/members`);
        const arr = Array.isArray(res) ? res : Array.isArray(res?.members) ? res.members : [];
        setMembers(arr as PanelTeamMember[]);
      } catch (e) {
        console.error(e);
        setMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const orgUsers: PanelOrgUser[] = useMemo(() => {
    const raw = Array.isArray(users) ? users : [];
    return raw
      .map((u: any) => ({
        id: String(u?.id || ''),
        email: String(u?.email || u?.userEmail || ''),
        name: String(
          u?.name || `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.email || 'User'
        ),
      }))
      .filter((u: PanelOrgUser) => !!u.id);
  }, [users]);

  const onSearchUsers = useCallback(
    async (query: string): Promise<PanelOrgUser[]> => {
      const q = String(query || '')
        .trim()
        .toLowerCase();
      if (!q) return orgUsers.slice(0, 30);
      return orgUsers
        .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
        .slice(0, 30);
    },
    [orgUsers]
  );

  const onAddMember = useCallback(
    async (userId: string, role: PanelTeamRole) => {
      const pid = await ensureProjectId();
      await Api.post(`/projects/${pid}/members`, { userId, projectRole: role });
      await loadMembers(pid);
      toast.success(isPolish ? 'Dodano członka zespołu' : 'Team member added');
    },
    [ensureProjectId, isPolish, loadMembers]
  );

  const onUpdateMember = useCallback(
    async (userId: string, role: PanelTeamRole) => {
      const pid = await ensureProjectId();
      await Api.patch(`/projects/${pid}/members/${userId}`, { projectRole: role });
      await loadMembers(pid);
      toast.success(isPolish ? 'Zaktualizowano rolę' : 'Role updated');
    },
    [ensureProjectId, isPolish, loadMembers]
  );

  const onRemoveMember = useCallback(
    async (userId: string) => {
      const pid = await ensureProjectId();
      await Api.delete(`/projects/${pid}/members/${userId}`);
      await loadMembers(pid);
      toast.success(isPolish ? 'Usunięto członka zespołu' : 'Team member removed');
    },
    [ensureProjectId, isPolish, loadMembers]
  );

  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
  }, []);

  const proposeTeamWithAI = useCallback(async () => {
    if (isAIProposing) return;
    try {
      setIsAIProposing(true);
      const existingUserIds = new Set(members.map((m) => String(m.userId)));

      const context = {
        initiative: {
          id: initiative?.id,
          name: initiative?.name,
          status: initiative?.status,
          priority: initiative?.priority,
        },
        currentMembers: members.map((m) => ({
          userId: m.userId,
          userName: m.userName,
          userEmail: m.userEmail,
          role: m.role,
        })),
        orgUsers: orgUsers.slice(0, 60),
      };

      const system =
        'You propose improvements to an initiative team composition. ' +
        'Return STRICT JSON with keys: add[], update[], remove[], note. ' +
        'Each add/update item: { userId, role: admin|manager|editor|viewer, reason }. ' +
        'Each remove item: { userId, reason }. ' +
        'Prefer minimal, safe changes. If no changes, return empty arrays and a note.';

      const res: any = await Api.post('/ai/refine-text?timeoutMs=20000', {
        system,
        user: JSON.stringify(context),
        fieldLabel: 'Initiative team',
        artifactContext: {
          title: initiative?.name || '',
          status: initiative?.status || '',
          priority: initiative?.priority || '',
          type: 'initiative',
        },
        language: isPolish ? 'pl' : 'en',
      });

      const parsed = safeJsonParse(String(res?.text || res?.data?.text || '')) || {};
      const proposal = normalizeProposal(parsed);

      const hasAny =
        proposal.add.length > 0 || proposal.update.length > 0 || proposal.remove.length > 0;
      if (!hasAny) {
        proposal.note =
          proposal.note ||
          (isPolish
            ? 'AI nie proponuje zmian w zespole na podstawie dostępnego kontekstu.'
            : 'AI has no team changes to propose based on available context.');
      }

      setAiProposal(proposal);
      setShowAIModal(true);

      setSelectedAddIds(
        Object.fromEntries(proposal.add.map((a) => [a.userId, !existingUserIds.has(a.userId)]))
      );
      setSelectedUpdateIds(Object.fromEntries(proposal.update.map((u) => [u.userId, true])));
      setSelectedRemoveIds(Object.fromEntries(proposal.remove.map((r) => [r.userId, false])));
    } catch (e: any) {
      console.error(e);
      toast.error(
        e?.message ||
          (isPolish ? 'AI: nie udało się przygotować propozycji' : 'AI: failed to propose')
      );
    } finally {
      setIsAIProposing(false);
    }
  }, [
    initiative?.id,
    initiative?.name,
    initiative?.priority,
    initiative?.status,
    isAIProposing,
    isPolish,
    members,
    orgUsers,
  ]);

  useEffect(() => {
    if (!teamAiRequest) return;
    (async () => {
      await proposeTeamWithAI();
    })().finally(() => {
      clearTeamAiRequest();
    });
  }, [teamAiRequest, proposeTeamWithAI, clearTeamAiRequest]);

  const selectedAddCount = useMemo(
    () => (aiProposal?.add || []).reduce((sum, a) => sum + (selectedAddIds[a.userId] ? 1 : 0), 0),
    [aiProposal, selectedAddIds]
  );
  const selectedUpdateCount = useMemo(
    () =>
      (aiProposal?.update || []).reduce((sum, u) => sum + (selectedUpdateIds[u.userId] ? 1 : 0), 0),
    [aiProposal, selectedUpdateIds]
  );
  const selectedRemoveCount = useMemo(
    () =>
      (aiProposal?.remove || []).reduce((sum, r) => sum + (selectedRemoveIds[r.userId] ? 1 : 0), 0),
    [aiProposal, selectedRemoveIds]
  );

  const applyAiProposal = useCallback(async () => {
    if (!aiProposal || isApplyingAiProposal) return;
    try {
      setIsApplyingAiProposal(true);
      const pid = await ensureProjectId();

      const adds = aiProposal.add.filter((a) => selectedAddIds[a.userId]);
      const updates = aiProposal.update.filter((u) => selectedUpdateIds[u.userId]);
      const removes = aiProposal.remove.filter((r) => selectedRemoveIds[r.userId]);

      for (const u of updates) {
        await Api.patch(`/projects/${pid}/members/${u.userId}`, { projectRole: u.role });
      }
      for (const a of adds) {
        await Api.post(`/projects/${pid}/members`, { userId: a.userId, projectRole: a.role });
      }
      for (const r of removes) {
        await Api.delete(`/projects/${pid}/members/${r.userId}`);
      }

      await loadMembers(pid);
      toast.success(isPolish ? 'Zastosowano propozycje AI' : 'Applied AI proposals');
      closeAIModal();
    } catch (e: any) {
      console.error(e);
      toast.error(
        e?.message ||
          (isPolish ? 'Nie udało się zastosować propozycji AI' : 'Failed to apply AI proposals')
      );
    } finally {
      setIsApplyingAiProposal(false);
    }
  }, [
    aiProposal,
    closeAIModal,
    ensureProjectId,
    isApplyingAiProposal,
    isPolish,
    loadMembers,
    selectedAddIds,
    selectedRemoveIds,
    selectedUpdateIds,
  ]);

  return (
    <div className="space-y-3">
      {(isAIProposing || loadingMembers) && (
        <div className="flex items-center justify-end">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-navy-800/50 px-2 py-0.5 rounded-full">
            <Loader2 size={12} className="animate-spin" />
            {isAIProposing
              ? isPolish
                ? 'AI pracuje...'
                : 'AI working...'
              : isPolish
                ? 'Ładuję...'
                : 'Loading...'}
          </span>
        </div>
      )}

      <div className="p-0">
        <TeamManagementPanel
          assessmentId={String(initiative?.id || 'initiative')}
          assessmentType="INITIATIVE"
          uiLanguage={isPolish ? 'pl' : 'en'}
          members={members}
          assignments={[]}
          canManageTeam
          onRefresh={async () => {
            await loadMembers();
          }}
          onSearchUsers={onSearchUsers}
          onAddMember={onAddMember}
          onUpdateMember={onUpdateMember}
          onRemoveMember={onRemoveMember}
          onAssignArea={async () => {
            // unused
          }}
          onRemoveAssignment={async () => {
            // unused
          }}
        />
      </div>

      {showAIModal && aiProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-3xl rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Proponowane zmiany zespołu (AI)' : 'Proposed team changes (AI)'}
                </h3>
                {aiProposal.note ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {aiProposal.note}
                  </p>
                ) : null}
              </div>
              <button
                onClick={closeAIModal}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                title={isPolish ? 'Zamknij' : 'Close'}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto space-y-5">
              <Callout variant="purple" title={isPolish ? 'Plan' : 'Plan'} compact>
                <div className="space-y-1 text-xs">
                  <div>
                    {isPolish ? 'Dodajemy:' : 'Add:'}{' '}
                    <span className="font-semibold">{selectedAddCount}</span>
                  </div>
                  <div>
                    {isPolish ? 'Zmieniamy role:' : 'Update roles:'}{' '}
                    <span className="font-semibold">{selectedUpdateCount}</span>
                  </div>
                  <div>
                    {isPolish ? 'Usuwamy:' : 'Remove:'}{' '}
                    <span className="font-semibold">{selectedRemoveCount}</span>
                  </div>
                </div>
              </Callout>

              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {isPolish ? 'Do usunięcia' : 'To remove'} ({aiProposal.remove.length})
                </div>
                {aiProposal.remove.length === 0 ? (
                  <EmptyStateInline
                    message={isPolish ? 'Brak propozycji usunięć.' : 'No removals suggested.'}
                    hint={isPolish ? 'To dobry znak.' : 'Good sign.'}
                    className="p-4"
                  />
                ) : (
                  <div className="space-y-2">
                    {aiProposal.remove.map((r) => (
                      <label key={`remove:${r.userId}`} className="flex items-start gap-3 text-xs">
                        <input
                          type="checkbox"
                          checked={!!selectedRemoveIds[r.userId]}
                          onChange={(e) =>
                            setSelectedRemoveIds((p) => ({ ...p, [r.userId]: e.target.checked }))
                          }
                        />
                        <span className="min-w-0">
                          <span className="font-semibold">{r.userId}</span>
                          {r.reason ? <span className="text-slate-500"> — {r.reason}</span> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {isPolish ? 'Do dodania' : 'To add'} ({aiProposal.add.length})
                </div>
                {aiProposal.add.length === 0 ? (
                  <EmptyStateInline
                    message={isPolish ? 'Brak propozycji dodania.' : 'No additions suggested.'}
                    hint={isPolish ? 'Zespół jest już wystarczający.' : 'Team seems sufficient.'}
                    className="p-4"
                  />
                ) : (
                  <div className="space-y-2">
                    {aiProposal.add.map((a) => (
                      <label key={`add:${a.userId}`} className="flex items-start gap-3 text-xs">
                        <input
                          type="checkbox"
                          checked={!!selectedAddIds[a.userId]}
                          onChange={(e) =>
                            setSelectedAddIds((p) => ({ ...p, [a.userId]: e.target.checked }))
                          }
                        />
                        <span className="min-w-0">
                          <span className="font-semibold">{a.userId}</span>
                          <span className="text-slate-500"> — {a.role}</span>
                          {a.reason ? <span className="text-slate-500"> — {a.reason}</span> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {isPolish ? 'Do zmiany' : 'To change'} ({aiProposal.update.length})
                </div>
                {aiProposal.update.length === 0 ? (
                  <EmptyStateInline
                    message={isPolish ? 'Brak propozycji zmian.' : 'No changes suggested.'}
                    hint={isPolish ? 'Role wyglądają spójnie.' : 'Roles look consistent.'}
                    className="p-4"
                  />
                ) : (
                  <div className="space-y-2">
                    {aiProposal.update.map((u) => (
                      <label key={`update:${u.userId}`} className="flex items-start gap-3 text-xs">
                        <input
                          type="checkbox"
                          checked={!!selectedUpdateIds[u.userId]}
                          onChange={(e) =>
                            setSelectedUpdateIds((p) => ({ ...p, [u.userId]: e.target.checked }))
                          }
                        />
                        <span className="min-w-0">
                          <span className="font-semibold">{u.userId}</span>
                          <span className="text-slate-500"> — {u.role}</span>
                          {u.reason ? <span className="text-slate-500"> — {u.reason}</span> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-end gap-2">
              <button
                onClick={closeAIModal}
                disabled={isApplyingAiProposal}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors disabled:opacity-50"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={applyAiProposal}
                disabled={isApplyingAiProposal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
              >
                {isApplyingAiProposal ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                <span>{isPolish ? 'Zastosuj' : 'Apply'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
