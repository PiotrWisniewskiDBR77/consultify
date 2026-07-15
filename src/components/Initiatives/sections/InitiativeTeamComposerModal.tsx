import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Copy,
  Key,
  Loader2,
  Mail,
  Plus,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';
import { Api } from '@/services/api';

type TargetKey = { kind: 'user'; id: string } | { kind: 'consultant'; id: string };

export type InitiativeOrgUser = { id: string; email: string; name: string };

export type PendingConsultantAccess = {
  accessId: string;
  email: string;
  projectId: string;
  status: string;
  projectRole?: string | null;
  accessCode?: string | null;
  invitedAt?: string;
  acceptedAt?: string | null;
};

export type ProjectMemberLite = {
  userId: string;
  name: string;
  email: string;
  projectRole?: string | null;
};

type RoleDef = {
  key: string;
  labelEn: string;
  labelPl: string;
  descriptionEn: string;
  descriptionPl: string;
  icon: React.ElementType;
  tone: 'amber' | 'blue' | 'violet' | 'emerald' | 'slate' | 'pink' | 'cyan' | 'rose' | 'indigo';
};

const ROLE_DEFS: RoleDef[] = [
  {
    key: 'SPONSOR',
    labelEn: 'Sponsor',
    labelPl: 'Sponsor',
    descriptionEn: 'Owns business goal & approvals',
    descriptionPl: 'Odpowiada za cel biznesowy i zatwierdzenia',
    icon: Shield,
    tone: 'amber',
  },
  {
    key: 'PROJECT_LEADER',
    labelEn: 'Project Leader',
    labelPl: 'Project Leader',
    descriptionEn: 'Operational delivery lead',
    descriptionPl: 'Operacyjny lider delivery',
    icon: Shield,
    tone: 'blue',
  },
  {
    key: 'PORTFOLIO_OWNER',
    labelEn: 'Portfolio Owner',
    labelPl: 'Właściciel portfela',
    descriptionEn: 'Investment-level decisions',
    descriptionPl: 'Decyzje inwestycyjne',
    icon: Shield,
    tone: 'violet',
  },
  {
    key: 'STEERING_COMMITTEE',
    labelEn: 'Steering Board',
    labelPl: 'Komitet sterujący',
    descriptionEn: 'Strategic approvals & escalations',
    descriptionPl: 'Zatwierdzenia strategiczne i eskalacje',
    icon: Users,
    tone: 'slate',
  },
  {
    key: 'BUSINESS_OWNER',
    labelEn: 'Business Owner',
    labelPl: 'Właściciel biznesowy',
    descriptionEn: 'Owns benefits & KPIs',
    descriptionPl: 'Odpowiada za korzyści i KPI',
    icon: Shield,
    tone: 'indigo',
  },
  {
    key: 'PMO',
    labelEn: 'PMO',
    labelPl: 'PMO',
    descriptionEn: 'Governance & standards control',
    descriptionPl: 'Governance i kontrola standardów',
    icon: Shield,
    tone: 'violet',
  },
  {
    key: 'PMO_LEAD',
    labelEn: 'PMO Lead',
    labelPl: 'Szef PMO',
    descriptionEn: 'Execution coordination',
    descriptionPl: 'Koordynacja wykonania',
    icon: Shield,
    tone: 'violet',
  },
  {
    key: 'WORKSTREAM_OWNER',
    labelEn: 'Workstream Owner',
    labelPl: 'Właściciel strumienia',
    descriptionEn: 'Owns a workstream delivery',
    descriptionPl: 'Odpowiada za strumień pracy',
    icon: Shield,
    tone: 'cyan',
  },
  {
    key: 'INITIATIVE_OWNER',
    labelEn: 'Initiative Owner',
    labelPl: 'Właściciel inicjatywy',
    descriptionEn: 'Owns initiative delivery',
    descriptionPl: 'Odpowiada za realizację inicjatywy',
    icon: Users,
    tone: 'emerald',
  },
  {
    key: 'DECISION_OWNER',
    labelEn: 'Decision Owner',
    labelPl: 'Właściciel decyzji',
    descriptionEn: 'Approves decision stream',
    descriptionPl: 'Zatwierdza decyzje',
    icon: Shield,
    tone: 'rose',
  },
  {
    key: 'TEAM_MEMBER',
    labelEn: 'Team Member',
    labelPl: 'Członek zespołu',
    descriptionEn: 'Executes assigned work',
    descriptionPl: 'Wykonuje przypisaną pracę',
    icon: Users,
    tone: 'emerald',
  },
  {
    key: 'TASK_ASSIGNEE',
    labelEn: 'Assignee',
    labelPl: 'Wykonawca',
    descriptionEn: 'Executes tasks',
    descriptionPl: 'Wykonuje zadania',
    icon: Users,
    tone: 'emerald',
  },
  {
    key: 'SME',
    labelEn: 'SME',
    labelPl: 'Ekspert',
    descriptionEn: 'Subject matter expert',
    descriptionPl: 'Ekspert dziedzinowy',
    icon: UserCheck,
    tone: 'slate',
  },
  {
    key: 'REVIEWER',
    labelEn: 'Reviewer',
    labelPl: 'Recenzent',
    descriptionEn: 'Quality reviewer',
    descriptionPl: 'Recenzja jakości',
    icon: UserCheck,
    tone: 'slate',
  },
  {
    key: 'STAKEHOLDER',
    labelEn: 'Stakeholder',
    labelPl: 'Interesariusz',
    descriptionEn: 'Updates & notifications',
    descriptionPl: 'Aktualizacje i powiadomienia',
    icon: Mail,
    tone: 'slate',
  },
  {
    key: 'OBSERVER',
    labelEn: 'Observer',
    labelPl: 'Obserwator',
    descriptionEn: 'Read-only visibility',
    descriptionPl: 'Tylko podgląd',
    icon: Mail,
    tone: 'slate',
  },
  {
    key: 'CONSULTANT',
    labelEn: 'Consultant',
    labelPl: 'Konsultant',
    descriptionEn: 'External advisor',
    descriptionPl: 'Zewnętrzny doradca',
    icon: UserCheck,
    tone: 'pink',
  },
];

function toneClasses(tone: RoleDef['tone']) {
  switch (tone) {
    case 'amber':
      return {
        icon: 'text-amber-600 dark:text-amber-400',
        chip: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
        active: 'border-amber-300 dark:border-amber-500/50 bg-amber-50/80 dark:bg-amber-500/10',
      };
    case 'blue':
      return {
        icon: 'text-blue-600 dark:text-blue-400',
        chip: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
        active: 'border-blue-300 dark:border-blue-500/50 bg-blue-50/80 dark:bg-blue-500/10',
      };
    case 'violet':
      return {
        icon: 'text-c-info dark:text-c-info',
        chip: 'bg-c-info/10 dark:bg-c-info/10 border-c-info dark:border-c-info/30',
        active: 'border-c-info dark:border-c-info/50 bg-c-info/80 dark:bg-c-info/10',
      };
    case 'emerald':
      return {
        icon: 'text-emerald-600 dark:text-emerald-400',
        chip: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
        active:
          'border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/80 dark:bg-emerald-500/10',
      };
    case 'pink':
      return {
        icon: 'text-pink-600 dark:text-pink-400',
        chip: 'bg-pink-50 dark:bg-pink-500/10 border-pink-200 dark:border-pink-500/30',
        active: 'border-pink-300 dark:border-pink-500/50 bg-pink-50/80 dark:bg-pink-500/10',
      };
    case 'cyan':
      return {
        icon: 'text-blue-600 dark:text-blue-400',
        chip: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
        active: 'border-blue-300 dark:border-blue-500/50 bg-blue-50/80 dark:bg-blue-500/10',
      };
    case 'rose':
      return {
        icon: 'text-danger-600 dark:text-danger-400',
        chip: 'bg-danger-50 dark:bg-danger-500/10 border-danger-200 dark:border-danger-500/30',
        active: 'border-danger-300 dark:border-danger-500/50 bg-danger-50/80 dark:bg-danger-500/10',
      };
    case 'indigo':
      return {
        icon: 'text-indigo-600 dark:text-indigo-400',
        chip: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30',
        active: 'border-indigo-300 dark:border-indigo-500/50 bg-indigo-50/80 dark:bg-indigo-500/10',
      };
    default:
      return {
        icon: 'text-slate-600 dark:text-slate-400',
        chip: 'bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/30',
        active: 'border-slate-300 dark:border-slate-500/50 bg-slate-50/80 dark:bg-slate-500/10',
      };
  }
}

function displayRole(roleKey: string | null | undefined, isPl: boolean): string {
  const def = ROLE_DEFS.find((r) => r.key === String(roleKey || '').toUpperCase());
  if (!def)
    return roleKey ? String(roleKey) : i18n.t('initiatives.initiativeTeamComposerModal.noRole');
  return isPl ? def.labelPl : def.labelEn;
}

export function InitiativeTeamComposerModal(props: {
  isOpen: boolean;
  onClose: () => void;
  orgUsers: InitiativeOrgUser[];
  existingMembers: ProjectMemberLite[];
  pendingConsultants: PendingConsultantAccess[];
  ensureProjectId: () => Promise<string>;
  onAfterChange: (projectId: string) => Promise<void>;
  canInviteConsultant?: boolean;
}) {
  const {
    isOpen,
    onClose,
    orgUsers,
    existingMembers,
    pendingConsultants,
    ensureProjectId,
    onAfterChange,
    canInviteConsultant = true,
  } = props;
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedConsultants, setSelectedConsultants] = useState<string[]>([]);
  const [active, setActive] = useState<TargetKey | null>(null);
  const [busy, setBusy] = useState(false);

  // Consultant invite
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteGenerateCode, setInviteGenerateCode] = useState(true);
  const [inviteAccessCode, setInviteAccessCode] = useState('');
  const [inviteRole, setInviteRole] = useState('CONSULTANT');
  const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);

  const membersById = useMemo(() => {
    const m = new Map<string, ProjectMemberLite>();
    for (const mm of existingMembers || []) m.set(mm.userId, mm);
    return m;
  }, [existingMembers]);

  const consultantsByAccessId = useMemo(() => {
    const m = new Map<string, PendingConsultantAccess>();
    for (const c of pendingConsultants || []) m.set(c.accessId, c);
    return m;
  }, [pendingConsultants]);

  const availableUsers = useMemo(() => {
    const selected = new Set(selectedUsers);
    return (orgUsers || [])
      .filter((u) => !!u?.id)
      .filter((u) => !selected.has(u.id))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [orgUsers, selectedUsers]);

  const selectedUserCards = useMemo(() => {
    const byId = new Map((orgUsers || []).map((u) => [u.id, u]));
    return selectedUsers.map((id) => byId.get(id)).filter(Boolean) as InitiativeOrgUser[];
  }, [orgUsers, selectedUsers]);

  const selectedConsultantCards = useMemo(() => {
    return selectedConsultants
      .map((id) => consultantsByAccessId.get(id))
      .filter(Boolean) as PendingConsultantAccess[];
  }, [consultantsByAccessId, selectedConsultants]);

  const activeRole = useMemo(() => {
    if (!active) return null;
    if (active.kind === 'user') return membersById.get(active.id)?.projectRole || null;
    return consultantsByAccessId.get(active.id)?.projectRole || null;
  }, [active, consultantsByAccessId, membersById]);

  const onAddSelectedUser = () => {
    const id = String(selectedUserId || '').trim();
    if (!id) return;
    setSelectedUsers((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActive({ kind: 'user', id });
    setSelectedUserId('');
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('initiatives.initiativeTeamComposerModal.copied'));
    } catch {
      toast.error(t('initiatives.initiativeTeamComposerModal.copyFailed'));
    }
  };

  const assignRoleToActive = async (roleKey: string) => {
    if (!active) {
      toast.error(t('initiatives.initiativeTeamComposerModal.selectPersonOnLeft'));
      return;
    }
    const projectId = await ensureProjectId();
    setBusy(true);
    try {
      if (active.kind === 'user') {
        const existing = membersById.get(active.id);
        if (existing) {
          await Api.patch(`/projects/${projectId}/members/${active.id}`, { projectRole: roleKey });
        } else {
          await Api.post(`/projects/${projectId}/members`, {
            userId: active.id,
            projectRole: roleKey,
          });
        }
        toast.success(t('initiatives.initiativeTeamComposerModal.roleAssigned'));
      } else {
        await Api.put(`/consultant-project-access/${active.id}`, { projectRole: roleKey });
        toast.success(t('initiatives.initiativeTeamComposerModal.consultantRoleUpdated'));
      }
      await onAfterChange(projectId);
    } catch (e: any) {
      toast.error(
        e?.message || t('initiatives.initiativeTeamComposerModal.failedToAssignRole')
      );
    } finally {
      setBusy(false);
    }
  };

  const inviteConsultant = async () => {
    if (!canInviteConsultant) return;
    const email = String(inviteEmail || '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error(t('initiatives.initiativeTeamComposerModal.enterValidEmail'));
      return;
    }
    const projectId = await ensureProjectId();
    setBusy(true);
    setLastInviteCode(null);
    try {
      const res: any = await Api.post('/consultant-project-access', {
        email,
        projectId,
        projectRole: inviteRole || 'CONSULTANT',
        permissions: {},
        generateCode: inviteGenerateCode && !inviteAccessCode,
        accessCode: inviteGenerateCode ? undefined : inviteAccessCode || undefined,
      });
      const accessId = String(res?.id || '');
      const accessCode = res?.accessCode ? String(res.accessCode) : null;
      if (accessCode) setLastInviteCode(accessCode);
      if (accessId) {
        setSelectedConsultants((prev) => (prev.includes(accessId) ? prev : [...prev, accessId]));
        setActive({ kind: 'consultant', id: accessId });
      }
      await onAfterChange(projectId);
      toast.success(t('initiatives.initiativeTeamComposerModal.invitationSent'));
      setInviteEmail('');
      setInviteAccessCode('');
      setInviteGenerateCode(true);
      setShowInvite(false);
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.initiativeTeamComposerModal.failedToInvite'));
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 6 }}
        className="relative w-full max-w-5xl rounded-2xl bg-white dark:bg-navy-900 shadow-2xl overflow-hidden border border-slate-200/70 dark:border-navy-700/60"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/70 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-950/20">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-navy-900 text-white">
                  <Users size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t('initiatives.initiativeTeamComposerModal.teamComposer')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {t('initiatives.initiativeTeamComposerModal.pickPeopleAssignRoles')}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/70 dark:hover:bg-navy-800 transition-colors"
              title={t('initiatives.initiativeTeamComposerModal.close')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-0">
          {/* Left: people */}
          <div className="p-6 border-b md:border-b-0 md:border-r border-slate-200/70 dark:border-navy-700/60">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('initiatives.initiativeTeamComposerModal.people')}
                </div>
                {busy ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    {t('initiatives.initiativeTeamComposerModal.saving')}
                  </span>
                ) : null}
              </div>

              {/* Picker */}
              <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-950/20 p-3">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {t('initiatives.initiativeTeamComposerModal.organizationMembers')}
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="">
                      {t('initiatives.initiativeTeamComposerModal.selectAPerson')}
                    </option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={onAddSelectedUser}
                    disabled={!selectedUserId}
                    className="h-10 px-3 rounded-xl bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:bg-navy-900/40 dark:disabled:bg-[#F4F7FB]/50 text-white dark:text-navy-950 text-sm font-semibold transition-colors inline-flex items-center gap-2"
                  >
                    <Plus size={16} />
                    {t('initiatives.initiativeTeamComposerModal.add')}
                  </button>
                </div>
              </div>

              {/* Selected list (fits ~5 items, scroll after) */}
              <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50/60 dark:bg-navy-950/20 border-b border-slate-200/70 dark:border-navy-700/60 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {t('initiatives.initiativeTeamComposerModal.selected')} (
                  {selectedUsers.length + selectedConsultants.length})
                </div>
                <div className="max-h-[232px] overflow-auto p-2 space-y-2 bg-white dark:bg-navy-900">
                  {selectedUserCards.length === 0 && selectedConsultantCards.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      {t('initiatives.initiativeTeamComposerModal.addPeopleUsingPicker')}
                    </div>
                  ) : (
                    <>
                      {selectedUserCards.map((u) => {
                        const role = membersById.get(u.id)?.projectRole || null;
                        const isActive = active?.kind === 'user' && active.id === u.id;
                        return (
                          <button
                            key={`u:${u.id}`}
                            type="button"
                            onClick={() => setActive({ kind: 'user', id: u.id })}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-colors text-left ${
                              isActive
                                ? 'border-c-info/70 dark:border-c-info/40 bg-c-info/70 dark:bg-c-info/10'
                                : 'border-slate-200/70 dark:border-navy-700/60 hover:bg-slate-50/60 dark:hover:bg-navy-800/40'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {u.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {u.email}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-navy-700/60">
                                {displayRole(role, isPl)}
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedUsers((prev) => prev.filter((id) => id !== u.id));
                                  if (active?.kind === 'user' && active.id === u.id)
                                    setActive(null);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                                title={t('initiatives.initiativeTeamComposerModal.removeFromList')}
                              >
                                <X size={14} />
                              </span>
                            </div>
                          </button>
                        );
                      })}

                      {selectedConsultantCards.map((c) => {
                        const isActive = active?.kind === 'consultant' && active.id === c.accessId;
                        return (
                          <button
                            key={`c:${c.accessId}`}
                            type="button"
                            onClick={() => setActive({ kind: 'consultant', id: c.accessId })}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-colors text-left ${
                              isActive
                                ? 'border-pink-300/70 dark:border-pink-500/40 bg-pink-50/70 dark:bg-pink-500/10'
                                : 'border-slate-200/70 dark:border-navy-700/60 hover:bg-slate-50/60 dark:hover:bg-navy-800/40'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {c.email}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {t('initiatives.initiativeTeamComposerModal.externalConsultant')} •{' '}
                                {String(c.status || '').toUpperCase()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-pink-100/80 dark:bg-pink-500/15 text-pink-700 dark:text-pink-200 border border-pink-200/60 dark:border-pink-500/30">
                                {displayRole(c.projectRole || null, isPl)}
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedConsultants((prev) =>
                                    prev.filter((id) => id !== c.accessId)
                                  );
                                  if (active?.kind === 'consultant' && active.id === c.accessId)
                                    setActive(null);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                                title={t('initiatives.initiativeTeamComposerModal.removeFromList')}
                              >
                                <X size={14} />
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>

              {/* Consultant invite */}
              <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-950/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {t('initiatives.initiativeTeamComposerModal.externalConsultant')}
                  </div>
                  {canInviteConsultant ? (
                    <button
                      type="button"
                      onClick={() => setShowInvite((v) => !v)}
                      className="text-xs font-semibold text-c-info dark:text-c-info hover:text-c-info dark:hover:text-c-info"
                    >
                      {showInvite
                        ? t('initiatives.initiativeTeamComposerModal.hide')
                        : t('initiatives.initiativeTeamComposerModal.add')}
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t('initiatives.initiativeTeamComposerModal.noPermission')}
                    </span>
                  )}
                </div>

                <AnimatePresence>
                  {showInvite && canInviteConsultant ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="mt-3 space-y-3"
                    >
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Email
                        </label>
                        <input
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder={t(
                            'initiatives.initiativeTeamComposerModal.consultantEmailPlaceholder'
                          )}
                          className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/30 p-3">
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                            <Key size={14} className="text-slate-500 dark:text-slate-400" />
                            {t('initiatives.initiativeTeamComposerModal.accessCodeFreeSeat')}
                          </div>
                          <label className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 select-none">
                            <input
                              type="checkbox"
                              checked={inviteGenerateCode}
                              onChange={(e) => {
                                setInviteGenerateCode(e.target.checked);
                                if (e.target.checked) setInviteAccessCode('');
                              }}
                              className="rounded border-slate-300 dark:border-navy-600"
                            />
                            {t('initiatives.initiativeTeamComposerModal.autoGenerate')}
                          </label>
                          {!inviteGenerateCode ? (
                            <input
                              value={inviteAccessCode}
                              onChange={(e) => setInviteAccessCode(e.target.value.toUpperCase())}
                              placeholder={t(
                                'initiatives.initiativeTeamComposerModal.enterCodePlaceholder'
                              )}
                              className="mt-2 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white font-mono"
                            />
                          ) : null}
                        </div>

                        <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/30 p-3">
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                            <UserCheck size={14} className="text-slate-500 dark:text-slate-400" />
                            {t('initiatives.initiativeTeamComposerModal.projectRole')}
                          </div>
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="mt-2 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                          >
                            {ROLE_DEFS.map((r) => (
                              <option key={r.key} value={r.key}>
                                {isPl ? r.labelPl : r.labelEn}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {lastInviteCode ? (
                        <div className="rounded-xl border border-blue-200/60 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-500/10 p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-200">
                              {t('initiatives.initiativeTeamComposerModal.accessCode')}
                            </div>
                            <div className="text-sm font-mono text-blue-900 dark:text-blue-100 truncate">
                              {lastInviteCode}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copy(lastInviteCode)}
                            className="h-9 px-3 rounded-xl border border-blue-200/60 dark:border-blue-500/20 bg-white/70 dark:bg-navy-900/30 text-blue-700 dark:text-blue-200 text-xs font-semibold hover:bg-white transition-colors inline-flex items-center gap-2"
                          >
                            <Copy size={14} />
                            {t('initiatives.initiativeTeamComposerModal.copy')}
                          </button>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowInvite(false)}
                          className="h-10 px-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-900/30 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-white dark:hover:bg-navy-800 transition-colors"
                        >
                          {t('initiatives.initiativeTeamComposerModal.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={inviteConsultant}
                          disabled={busy || !inviteEmail}
                          className="h-10 px-4 rounded-xl bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:bg-navy-900/40 dark:disabled:bg-[#F4F7FB]/50 text-white dark:text-navy-950 text-sm font-semibold transition-colors inline-flex items-center gap-2"
                        >
                          {busy ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <UserPlus size={16} />
                          )}
                          {t('initiatives.initiativeTeamComposerModal.invite')}
                        </button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right: roles */}
          <div className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('initiatives.initiativeTeamComposerModal.projectRoles')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {active ? (
                    <>
                      {t('initiatives.initiativeTeamComposerModal.selectedLabel')}{' '}
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {active.kind === 'user'
                          ? selectedUserCards.find((u) => u.id === active.id)?.name || active.id
                          : consultantsByAccessId.get(active.id)?.email || active.id}
                      </span>
                      {activeRole ? (
                        <>
                          {' '}
                          • {t('initiatives.initiativeTeamComposerModal.roleLabel')}{' '}
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {displayRole(activeRole, isPl)}
                          </span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    t('initiatives.initiativeTeamComposerModal.clickPersonToAssignRole')
                  )}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <Shield size={14} />
                {t('initiatives.initiativeTeamComposerModal.clickRoleToAssign')}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ROLE_DEFS.map((r) => {
                const Icon = r.icon;
                const tone = toneClasses(r.tone);
                const isCurrent = String(activeRole || '').toUpperCase() === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => assignRoleToActive(r.key)}
                    disabled={busy}
                    className={`p-3 rounded-2xl border text-left transition-colors ${
                      isCurrent
                        ? `${tone.active} border-2`
                        : 'border-slate-200/70 dark:border-navy-700/60 hover:bg-slate-50/60 dark:hover:bg-navy-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl border ${tone.chip}`}>
                        <Icon size={16} className={tone.icon} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {isPl ? r.labelPl : r.labelEn}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isPl ? r.descriptionPl : r.descriptionEn}
                        </div>
                      </div>
                      {isCurrent ? (
                        <div className="ml-auto mt-1 text-emerald-600 dark:text-emerald-400">
                          <Check size={16} />
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
