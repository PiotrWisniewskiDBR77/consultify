/**
 * InitiativeTeamSection
 *
 * Team management for initiatives.
 * Layout & functions: from Assessment TeamManagementPanel (roles, add member modal,
 *   permissions badges, role stats, inline role editing, member row).
 * Visual style: N-mode RACI pattern (rounded-2xl, backdrop-blur-xl, navy,
 *   collapsible header, nested rounded-xl cards).
 *
 * No DRD-specific Area Assignments — initiative-focused.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  Crown,
  Edit3,
  Eye,
  Globe,
  Handshake,
  Loader2,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { ElementType, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

// ==========================================
// TYPES (mirrored from Assessment TeamManagementPanel)
// ==========================================

type TeamRole =
  | 'SPONSOR'
  | 'PROJECT_LEADER'
  | 'INITIATIVE_OWNER'
  | 'TEAM_MEMBER'
  | 'PMO'
  | 'PORTFOLIO_OWNER'
  | 'BUSINESS_OWNER'
  | 'STEERING_COMMITTEE';

type ConsultantProfile = 'NONE' | 'EXTERNAL' | 'PARTNER' | 'INTERNAL';
type EngagementType = 'INTERNAL' | 'INVITED_BY_CLIENT' | 'CONSULTANT_LED_ONBOARDING';

interface TeamMember {
  id: string;
  userId: string;
  role: TeamRole;
  isInvoked?: boolean;
  consultantProfile?: ConsultantProfile;
  engagementType?: EngagementType;
  accountRole?: string | null;
  canEdit: boolean;
  canApprove: boolean;
  canManageTeam: boolean;
  canChangeStatus: boolean;
  canGenerateReport: boolean;
  canGenerateInitiatives: boolean;
  assignedAreas?: string[] | null;
  assignedAt?: string;
  userName?: string;
  userEmail?: string;
}

interface OrgUser {
  id: string;
  email: string;
  name: string;
}

type Confidence = 'high' | 'medium' | 'low';

type TeamAiProposal = {
  add: Array<{
    userId: string;
    role: TeamRole;
    projectFunction: string;
    confidence?: Confidence;
    why?: string;
    evidence?: string[];
  }>;
  update: Array<{
    userId: string;
    role?: TeamRole;
    projectFunction?: string;
    reason: string;
  }>;
  remove: Array<{
    userId: string;
    reason: string;
  }>;
  missingFunctions: Array<{
    projectFunction: string;
    why: string;
  }>;
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

// ==========================================
// ROLE CONFIG (from Assessment TeamManagementPanel)
// ==========================================

const ROLE_CONFIG: Record<
  TeamRole,
  {
    label: { en: string; pl: string };
    icon: ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    description: { en: string; pl: string };
    permissions: string[];
  }
> = {
  SPONSOR: {
    label: { en: 'Sponsor (Business Owner)', pl: 'Sponsor (Właściciel biznesowy)' },
    icon: Crown,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-500/30',
    description: { en: 'Investment decisions & go/no-go', pl: 'Decyzje inwestycyjne i go/no-go' },
    permissions: ['Approve'],
  },
  PROJECT_LEADER: {
    label: { en: 'Project Leader', pl: 'Project Leader' },
    icon: Briefcase,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    description: {
      en: 'Delivery leadership & coordination',
      pl: 'Dowodzenie delivery i koordynacja',
    },
    permissions: ['Edit', 'Manage', 'Status'],
  },
  INITIATIVE_OWNER: {
    label: { en: 'Initiative Owner', pl: 'Właściciel inicjatywy' },
    icon: Users,
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-500/10',
    borderColor: 'border-teal-200 dark:border-teal-500/30',
    description: { en: 'Owns initiative content & readiness', pl: 'Odpowiada za treść i gotowość' },
    permissions: ['Edit', 'Status'],
  },
  TEAM_MEMBER: {
    label: { en: 'Team Member', pl: 'Członek zespołu' },
    icon: Users,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-500/10',
    borderColor: 'border-green-200 dark:border-green-500/30',
    description: { en: 'Execution work', pl: 'Wykonanie pracy' },
    permissions: ['Edit'],
  },
  PMO: {
    label: { en: 'Project Office (PMO)', pl: 'Project Office (PMO)' },
    icon: ShieldCheck,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-500/10',
    borderColor: 'border-purple-200 dark:border-purple-500/30',
    description: { en: 'Standards & scheduling control', pl: 'Standardy i kontrola harmonogramu' },
    permissions: ['Manage', 'Status'],
  },
  PORTFOLIO_OWNER: {
    label: { en: 'Portfolio Owner', pl: 'Właściciel portfela' },
    icon: ShieldCheck,
    color: 'text-fuchsia-600 dark:text-fuchsia-400',
    bgColor: 'bg-fuchsia-50 dark:bg-fuchsia-500/10',
    borderColor: 'border-fuchsia-200 dark:border-fuchsia-500/30',
    description: { en: 'Investment-level escalation', pl: 'Eskalacje inwestycyjne' },
    permissions: ['Approve'],
  },
  BUSINESS_OWNER: {
    label: { en: 'Business Owner (Benefits)', pl: 'Business Owner (Korzyści)' },
    icon: ShieldCheck,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-500/10',
    borderColor: 'border-indigo-200 dark:border-indigo-500/30',
    description: { en: 'Benefits & KPI ownership', pl: 'Korzyści i KPI' },
    permissions: ['Approve', 'Edit'],
  },
  STEERING_COMMITTEE: {
    label: { en: 'Steering Committee', pl: 'Komitet sterujący' },
    icon: Eye,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    description: {
      en: 'Strategic approvals (optional)',
      pl: 'Zatwierdzenia strategiczne (opcjonalnie)',
    },
    permissions: ['Approve'],
  },
};

// Derive permissions from role
function getPermissionsForRole(
  role: TeamRole
): Omit<TeamMember, 'id' | 'userId' | 'role' | 'assignedAt' | 'userName' | 'userEmail'> {
  switch (role) {
    case 'SPONSOR':
      return {
        canEdit: false,
        canApprove: true,
        canManageTeam: false,
        canChangeStatus: false,
        canGenerateReport: false,
        canGenerateInitiatives: false,
      };
    case 'PROJECT_LEADER':
      return {
        canEdit: true,
        canApprove: false,
        canManageTeam: true,
        canChangeStatus: true,
        canGenerateReport: false,
        canGenerateInitiatives: false,
      };
    case 'INITIATIVE_OWNER':
      return {
        canEdit: true,
        canApprove: false,
        canManageTeam: false,
        canChangeStatus: true,
        canGenerateReport: false,
        canGenerateInitiatives: false,
      };
    case 'TEAM_MEMBER':
      return {
        canEdit: true,
        canApprove: false,
        canManageTeam: false,
        canChangeStatus: false,
        canGenerateReport: false,
        canGenerateInitiatives: false,
      };
    case 'PMO':
      return {
        canEdit: false,
        canApprove: false,
        canManageTeam: true,
        canChangeStatus: true,
        canGenerateReport: true,
        canGenerateInitiatives: false,
      };
    case 'PORTFOLIO_OWNER':
      return {
        canEdit: false,
        canApprove: true,
        canManageTeam: false,
        canChangeStatus: false,
        canGenerateReport: true,
        canGenerateInitiatives: false,
      };
    case 'BUSINESS_OWNER':
      return {
        canEdit: true,
        canApprove: true,
        canManageTeam: false,
        canChangeStatus: false,
        canGenerateReport: true,
        canGenerateInitiatives: false,
      };
    case 'STEERING_COMMITTEE':
      return {
        canEdit: false,
        canApprove: true,
        canManageTeam: false,
        canChangeStatus: false,
        canGenerateReport: true,
        canGenerateInitiatives: false,
      };
    default:
      return {
        canEdit: false,
        canApprove: false,
        canManageTeam: false,
        canChangeStatus: false,
        canGenerateReport: false,
        canGenerateInitiatives: false,
      };
  }
}

function getActivePermissions(member: TeamMember): string[] {
  const perms: string[] = [];
  if (member.canEdit) perms.push('Edit');
  if (member.canApprove) perms.push('Approve');
  if (member.canManageTeam) perms.push('Manage');
  if (member.canChangeStatus) perms.push('Status');
  if (member.canGenerateReport) perms.push('Report');
  if (member.canGenerateInitiatives) perms.push('Initiatives');
  return perms;
}

const TEAM_ROLE_ORDER: TeamRole[] = [
  'SPONSOR',
  'PROJECT_LEADER',
  'INITIATIVE_OWNER',
  'TEAM_MEMBER',
  'PMO',
  'PORTFOLIO_OWNER',
  'BUSINESS_OWNER',
  'STEERING_COMMITTEE',
];

// ==========================================
// ADD MEMBER MODAL — N-mode batch-add design
// ==========================================

interface PendingMember {
  id: string;
  role: TeamRole;
  // Internal user
  user?: OrgUser;
  // External invite
  isExternal?: boolean;
  email?: string;
  displayName?: string;
}

const AddMemberModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (args: {
    userId: string;
    role: TeamRole;
    isInvoked: boolean;
    consultantProfile: ConsultantProfile;
    engagementType: EngagementType;
  }) => Promise<void> | void;
  onInviteExternal: (args: {
    email: string;
    role: TeamRole;
    isInvoked: boolean;
    consultantProfile: ConsultantProfile;
    engagementType: EngagementType;
  }) => Promise<void> | void;
  onSearchUsers: (query: string) => Promise<OrgUser[]>;
  existingMemberIds: Set<string>;
  isPolish: boolean;
}> = ({ isOpen, onClose, onAdd, onInviteExternal, onSearchUsers, existingMemberIds, isPolish }) => {
  // ── State ──
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  // Consultant invite state
  const [showConsultantInvite, setShowConsultantInvite] = useState(false);
  const [externalEmail, setExternalEmail] = useState('');
  const [externalName, setExternalName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [consultantReady, setConsultantReady] = useState(false); // true = name filled, waiting for role click

  // IDs already in team + already in pending queue
  const allTakenIds = useMemo(() => {
    const s = new Set(existingMemberIds);
    pendingMembers.forEach((pm) => s.add(pm.id));
    return s;
  }, [existingMemberIds, pendingMembers]);

  const inviteEmailValid = useMemo(() => {
    const v = String(externalEmail || '')
      .trim()
      .toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
  }, [externalEmail]);

  const inviteLink = useMemo(() => {
    if (!inviteEmailValid || !inviteCode) return '';
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/login?invite=${encodeURIComponent(inviteCode)}&email=${encodeURIComponent(inviteEmailValid)}`;
  }, [inviteEmailValid, inviteCode]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setUsers([]);
      setSelectedUser(null);
      setPendingMembers([]);
      setShowConsultantInvite(false);
      setExternalEmail('');
      setExternalName('');
      setInviteCode('');
      setConsultantReady(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const search = async () => {
      setSearching(true);
      try {
        const results = await onSearchUsers(query);
        setUsers(results.filter((u) => !allTakenIds.has(u.id)));
      } catch {
        setUsers([]);
      } finally {
        setSearching(false);
      }
    };
    if (String(query || '').trim().length === 0) {
      void search();
      return;
    }
    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [isOpen, query, onSearchUsers, allTakenIds]);

  const generateInviteCode = useCallback(() => {
    const next = `CNS-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    setInviteCode(next);
  }, []);

  const copyToClipboard = useCallback(
    async (value: string, label: string) => {
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        toast.success(isPolish ? `${label} skopiowany` : `${label} copied`);
      } catch {
        toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
      }
    },
    [isPolish]
  );

  // ── Assign role to selected user OR ready consultant → add to pending queue ──
  const handleAssignRole = useCallback(
    (role: TeamRole) => {
      if (consultantReady && inviteEmailValid && externalName.trim()) {
        // Add external consultant to queue
        setPendingMembers((prev) => [
          ...prev.filter((pm) => pm.id !== `ext-${inviteEmailValid}`),
          {
            id: `ext-${inviteEmailValid}`,
            role,
            isExternal: true,
            email: inviteEmailValid,
            displayName: externalName.trim(),
          },
        ]);
        setConsultantReady(false);
        setExternalEmail('');
        setExternalName('');
        setInviteCode('');
        return;
      }
      if (!selectedUser) return;
      setPendingMembers((prev) => {
        const filtered = prev.filter((pm) => pm.id !== selectedUser.id);
        return [...filtered, { id: selectedUser.id, user: selectedUser, role }];
      });
      setSelectedUser(null);
      setQuery('');
    },
    [selectedUser, consultantReady, inviteEmailValid, externalName]
  );

  // ── Remove from pending queue ──
  const handleRemovePending = useCallback((id: string) => {
    setPendingMembers((prev) => prev.filter((pm) => pm.id !== id));
  }, []);

  // ── Submit all pending members ──
  const handleSubmitAll = async () => {
    if (pendingMembers.length === 0) return;
    setAdding(true);
    let successCount = 0;
    let errorCount = 0;
    for (const pm of pendingMembers) {
      try {
        if (pm.isExternal && pm.email) {
          await onInviteExternal({
            email: pm.email,
            role: pm.role,
            isInvoked: false,
            consultantProfile: 'EXTERNAL',
            engagementType: 'INVITED_BY_CLIENT',
          });
          successCount += 1;
        } else if (pm.user) {
          await onAdd({
            userId: pm.user.id,
            role: pm.role,
            isInvoked: false,
            consultantProfile: 'NONE',
            engagementType: 'INTERNAL',
          });
          successCount += 1;
        }
      } catch {
        errorCount += 1;
      }
    }
    if (errorCount === 0) {
      onClose();
    } else if (successCount > 0) {
      toast.error(
        isPolish
          ? `Dodano ${successCount}, nie dodano ${errorCount}`
          : `Added ${successCount}, failed ${errorCount}`
      );
      onClose();
    } else {
      toast.error(isPolish ? 'Nie udało się dodać' : 'Failed to add members');
    }
    setAdding(false);
  };

  // Can assign = either a user selected or consultant ready
  const canAssignRole = !!selectedUser || consultantReady;

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-3xl mx-4 bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 dark:border-navy-700/60 overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="px-5 py-3 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg">
                <UserPlus size={16} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Dodaj do zespołu' : 'Add to Team'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isPolish
                    ? 'Wybierz osobę, potem kliknij rolę aby przypisać'
                    : 'Select a person, then click a role to assign'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <X size={16} className="text-slate-400 dark:text-slate-500" />
            </button>
          </div>
        </div>

        {/* ── Content: 2-column layout ── */}
        <div className="flex max-h-[70vh]">
          {/* ══ LEFT COLUMN ══ */}
          <div className="flex-1 min-w-0 border-r border-slate-200/60 dark:border-navy-700/60 flex flex-col">
            {/* ── Search ── */}
            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setConsultantReady(false);
                  }}
                  placeholder={
                    isPolish ? 'Szukaj po nazwisku lub email...' : 'Search by name or email...'
                  }
                  autoComplete="off"
                  className="w-full h-9 pl-9 pr-4 rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/60 transition-colors"
                />
                {searching && (
                  <Loader2
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin"
                  />
                )}
              </div>

              {/* User list */}
              {users.length > 0 && !consultantReady && (
                <div className="mt-1.5 max-h-28 overflow-auto rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-800/80 divide-y divide-slate-100 dark:divide-navy-700/40">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setConsultantReady(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors ${
                        selectedUser?.id === user.id
                          ? 'bg-purple-50 dark:bg-purple-500/10'
                          : 'hover:bg-slate-50/80 dark:hover:bg-navy-700/50'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0">
                        {(user.name || user.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-xs font-medium text-slate-800 dark:text-white truncate">
                          {user.name}
                        </div>
                      </div>
                      {selectedUser?.id === user.id && (
                        <Check size={12} className="text-purple-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected user hint */}
              {selectedUser && !consultantReady && (
                <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/5 dark:bg-purple-500/10 border border-purple-200/40 dark:border-purple-500/20">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-[9px] font-semibold text-white flex-shrink-0">
                    {(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[11px] font-medium text-purple-700 dark:text-purple-300 truncate flex-1">
                    {selectedUser.name}
                  </span>
                  <span className="text-[10px] text-purple-500 dark:text-purple-400">
                    {isPolish ? '→ kliknij rolę' : '→ pick role'}
                  </span>
                </div>
              )}

              {/* Consultant ready hint */}
              {consultantReady && (
                <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/5 dark:bg-blue-500/10 border border-blue-200/40 dark:border-blue-500/20">
                  <Globe size={14} className="text-blue-500 flex-shrink-0" />
                  <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 truncate flex-1">
                    {externalName || inviteEmailValid}
                  </span>
                  <span className="text-[10px] text-blue-500 dark:text-blue-400">
                    {isPolish ? '→ kliknij rolę' : '→ pick role'}
                  </span>
                </div>
              )}
            </div>

            {/* ── Pending Members Queue ── */}
            <div className="flex-1 overflow-y-auto px-4 py-2 min-h-[80px]">
              {pendingMembers.length > 0 ? (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    {isPolish ? 'Do dodania' : 'To add'} ({pendingMembers.length})
                  </div>
                  <AnimatePresence>
                    {pendingMembers.map((pm) => {
                      const cfg = ROLE_CONFIG[pm.role];
                      const name = pm.isExternal
                        ? pm.displayName || pm.email || '?'
                        : pm.user?.name || pm.user?.email || '?';
                      const initial = name.charAt(0).toUpperCase();
                      return (
                        <motion.div
                          key={pm.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50/60 dark:bg-navy-800/40 border border-slate-200/40 dark:border-navy-700/40"
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0 ${
                              pm.isExternal
                                ? 'bg-gradient-to-br from-blue-400 to-cyan-500'
                                : 'bg-gradient-to-br from-blue-400 to-blue-600'
                            }`}
                          >
                            {initial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate block">
                              {name}
                            </span>
                            {pm.isExternal && pm.email && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block">
                                {pm.email}
                              </span>
                            )}
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap ${cfg.bgColor} ${cfg.color} ${cfg.borderColor} border`}
                          >
                            {isPolish ? cfg.label.pl : cfg.label.en}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePending(pm.id)}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-navy-600 transition-colors"
                          >
                            <X size={10} className="text-slate-400 dark:text-slate-500" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[11px] text-slate-400 dark:text-slate-500">
                  {isPolish ? 'Wybierz osobę i kliknij rolę →' : 'Select person & click role →'}
                </div>
              )}
            </div>

            {/* ── Consultant Invite (bottom-left) ── */}
            <div className="border-t border-slate-200/60 dark:border-navy-700/60">
              <button
                type="button"
                onClick={() => {
                  setShowConsultantInvite((v) => {
                    const next = !v;
                    if (next && !inviteCode) generateInviteCode();
                    return next;
                  });
                  setSelectedUser(null);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50/50 dark:hover:bg-navy-800/30 transition-colors"
              >
                <Handshake size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 flex-1">
                  {isPolish ? 'Zaproś konsultanta zewnętrznego' : 'Invite external consultant'}
                </span>
                <ChevronDown
                  size={12}
                  className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${showConsultantInvite ? 'rotate-180' : ''}`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-200 ease-out ${showConsultantInvite ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <div className="px-4 pb-3 pt-1 space-y-2.5">
                  {/* Email */}
                  <input
                    type="email"
                    value={externalEmail}
                    onChange={(e) => setExternalEmail(e.target.value)}
                    placeholder={isPolish ? 'Email konsultanta' : 'Consultant email'}
                    className="w-full h-8 px-3 rounded-lg border border-slate-200/60 dark:border-navy-700/60 bg-white/80 dark:bg-navy-900/70 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  {/* Name */}
                  <input
                    type="text"
                    value={externalName}
                    onChange={(e) => setExternalName(e.target.value)}
                    placeholder={isPolish ? 'Imię i nazwisko konsultanta' : 'Consultant full name'}
                    className="w-full h-8 px-3 rounded-lg border border-slate-200/60 dark:border-navy-700/60 bg-white/80 dark:bg-navy-900/70 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  {/* Invite code + link */}
                  <div className="rounded-lg border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/60 p-2 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span>{isPolish ? 'Kod logowania:' : 'Login code:'}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px]">{inviteCode || '—'}</span>
                        <button
                          type="button"
                          onClick={generateInviteCode}
                          className="text-[10px] text-purple-600 dark:text-purple-300 hover:underline"
                        >
                          {isPolish ? 'Nowy' : 'New'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>{isPolish ? 'Link:' : 'Link:'}</span>
                      <button
                        type="button"
                        disabled={!inviteLink}
                        onClick={() => copyToClipboard(inviteLink, 'Link')}
                        className="text-[10px] text-purple-600 dark:text-purple-300 hover:underline disabled:opacity-50"
                      >
                        {isPolish ? 'Kopiuj' : 'Copy'}
                      </button>
                    </div>
                    <div
                      className="text-[10px] text-slate-400 dark:text-slate-500 truncate"
                      title={inviteLink || undefined}
                    >
                      {inviteLink || '—'}
                    </div>
                  </div>
                  {/* Copy package */}
                  <button
                    type="button"
                    disabled={!inviteEmailValid || !inviteCode}
                    onClick={() => {
                      const payload = isPolish
                        ? `Dane dostępu konsultanta:\nEmail: ${inviteEmailValid}\nImię: ${externalName || '—'}\nKod logowania: ${inviteCode}\nLink logowania: ${inviteLink}`
                        : `Consultant access details:\nEmail: ${inviteEmailValid}\nName: ${externalName || '—'}\nLogin code: ${inviteCode}\nLogin link: ${inviteLink}`;
                      void copyToClipboard(payload, isPolish ? 'Pakiet dostępu' : 'Access package');
                    }}
                    className="w-full h-7 rounded-lg border border-purple-300/60 dark:border-purple-500/40 bg-purple-500/10 text-[11px] font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-500/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPolish ? 'Kopiuj pakiet (kod + link)' : 'Copy package (code + link)'}
                  </button>
                  {/* Ready: assign role */}
                  <button
                    type="button"
                    disabled={!inviteEmailValid || !externalName.trim()}
                    onClick={() => {
                      setConsultantReady(true);
                      setSelectedUser(null);
                      setShowConsultantInvite(false);
                    }}
                    className="w-full h-8 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-navy-700 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <UserPlus size={12} />
                    {isPolish ? 'Przypisz rolę w projekcie →' : 'Assign project role →'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ══ RIGHT COLUMN — Role Selection ══ */}
          <div className="w-[340px] flex-shrink-0 overflow-y-auto p-4">
            <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              {isPolish ? 'Kliknij rolę aby przypisać' : 'Click role to assign'}
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {TEAM_ROLE_ORDER.map((role) => {
                const cfg = ROLE_CONFIG[role];
                return (
                  <button
                    key={role}
                    type="button"
                    disabled={!canAssignRole}
                    onClick={() => handleAssignRole(role)}
                    className={`px-3 py-2 rounded-xl border text-left transition-all ${
                      canAssignRole
                        ? `border-slate-200/60 dark:border-navy-700/60 hover:${cfg.bgColor} hover:${cfg.borderColor} hover:shadow-sm active:scale-[0.98]`
                        : 'border-slate-200/40 dark:border-navy-700/40 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold whitespace-nowrap ${canAssignRole ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}
                      >
                        {isPolish ? cfg.label.pl : cfg.label.en}
                      </span>
                      {cfg.permissions.length > 0 && (
                        <div className="flex gap-1 ml-auto">
                          {cfg.permissions.map((perm) => (
                            <span
                              key={`${role}-${perm}`}
                              className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-100/80 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {isPolish ? cfg.description.pl : cfg.description.en}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60 bg-slate-50/30 dark:bg-navy-800/30 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 dark:text-slate-500">
            {pendingMembers.length > 0 ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-500" />
                {pendingMembers.length} {isPolish ? 'do dodania' : 'to add'}
              </span>
            ) : selectedUser || consultantReady ? (
              <span className="flex items-center gap-1 text-purple-500">
                <UserPlus size={12} />
                {isPolish ? 'Kliknij rolę po prawej →' : 'Click a role on the right →'}
              </span>
            ) : (
              <span>
                {isPolish
                  ? 'Wybierz osobę lub zaproś konsultanta'
                  : 'Select person or invite consultant'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              onClick={handleSubmitAll}
              disabled={pendingMembers.length === 0 || adding}
              className="px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-slate-200 dark:disabled:bg-navy-700 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {isPolish
                ? `Dodaj${pendingMembers.length > 0 ? ` (${pendingMembers.length})` : ''}`
                : `Add${pendingMembers.length > 0 ? ` (${pendingMembers.length})` : ''}`}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

// ==========================================
// MEMBER ROW (Assessment layout + RACI visual style)
// ==========================================

const TeamMemberRow: React.FC<{
  member: TeamMember;
  isPolish: boolean;
  isExternal: boolean;
  onUpdateRole: (userId: string, role: TeamRole) => Promise<void> | void;
  onRemove: (userId: string) => Promise<void> | void;
}> = ({ member, isPolish, isExternal, onUpdateRole, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TeamRole>(member.role);
  const [busy, setBusy] = useState(false);

  const roleConfig = ROLE_CONFIG[member.role];
  const activePermissions = getActivePermissions(member);

  const handleSaveRole = async () => {
    if (selectedRole === member.role) {
      setIsEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onUpdateRole(member.userId, selectedRole);
      setIsEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (
      !confirm(
        isPolish
          ? `Usunąć ${member.userName || member.userEmail}?`
          : `Remove ${member.userName || member.userEmail}?`
      )
    )
      return;
    setBusy(true);
    try {
      await onRemove(member.userId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group border-b border-slate-200/50 dark:border-navy-700/30 hover:bg-slate-50/50 dark:hover:bg-navy-800/30 transition-colors"
    >
      {/* MEMBER: avatar + name + email */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
            {(member.userName || member.userEmail || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {member.userName || member.userEmail || 'Unknown'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
              <Mail size={10} />
              {member.userEmail || '—'}
            </div>
          </div>
        </div>
      </td>

      {/* ROLE */}
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as TeamRole)}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs text-slate-900 dark:text-white"
            >
              {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                <option key={role} value={role}>
                  {isPolish ? config.label.pl : config.label.en}
                </option>
              ))}
            </select>
            <button
              onClick={handleSaveRole}
              disabled={busy}
              className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-300 transition-colors"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            </button>
            <button
              onClick={() => {
                setSelectedRole(member.role);
                setIsEditing(false);
              }}
              className="p-1.5 rounded-lg bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-navy-600 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div
            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${roleConfig.bgColor} ${roleConfig.color} ${roleConfig.borderColor} border`}
          >
            {isPolish ? roleConfig.label.pl : roleConfig.label.en}
          </div>
        )}
      </td>

      {/* PERMISSIONS */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {activePermissions.length > 0 ? (
            activePermissions.slice(0, 4).map((perm) => (
              <span
                key={perm}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              >
                {perm}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {isPolish ? 'Tylko odczyt' : 'View only'}
            </span>
          )}
          {activePermissions.length > 4 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400">
              +{activePermissions.length - 4}
            </span>
          )}
        </div>
      </td>

      {/* ORG PRESENCE */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {isExternal ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
              {isPolish ? 'Poza organizacją' : 'Outside org'}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              {isPolish ? 'W organizacji' : 'In org'}
            </span>
          )}
        </div>
      </td>

      {/* ADDED */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {member.assignedAt
            ? new Date(member.assignedAt).toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '—'}
        </span>
      </td>

      {/* ACTIONS */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setIsEditing(true)}
            disabled={isEditing || busy}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors disabled:opacity-50"
            title={isPolish ? 'Edytuj rolę' : 'Edit role'}
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={handleRemove}
            disabled={busy}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
            title={isPolish ? 'Usuń' : 'Remove'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const InitiativeTeamSection: React.FC<InitiativeSectionProps> = () => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const {
    users,
    initiative,
    tasks,
    decisions,
    raidItems,
    stakeholders,
    teamAiRequest,
    clearTeamAiRequest,
  } = useInitiativeContext();

  // State
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProposal, setAiProposal] = useState<TeamAiProposal | null>(null);
  const [selectedAddIds, setSelectedAddIds] = useState<Record<string, boolean>>({});
  const [selectedUpdateIds, setSelectedUpdateIds] = useState<Record<string, boolean>>({});
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<Record<string, boolean>>({});

  // projectId can be null initially; ensureProjectId will create one if needed
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(
    initiative?.projectId ? String(initiative.projectId) : null
  );
  const projectId = resolvedProjectId;
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Keep resolvedProjectId in sync when initiative reloads
  useEffect(() => {
    if (initiative?.projectId) {
      setResolvedProjectId(String(initiative.projectId));
    }
  }, [initiative?.projectId]);

  /**
   * Auto-create a project and link it to this initiative if one doesn't exist.
   * Returns the projectId (existing or newly created).
   */
  const ensureProjectId = useCallback(async (): Promise<string> => {
    if (projectId) return projectId;

    const initiativeId = initiative?.id;
    const initiativeName = initiative?.name || initiative?.title || 'Untitled Initiative';

    if (!initiativeId) {
      throw new Error(isPolish ? 'Brak ID inicjatywy' : 'Initiative ID is missing');
    }

    // 1. Create a project
    const createRes: any = await Api.post('/projects', {
      name: initiativeName,
      description: isPolish
        ? `Projekt automatycznie utworzony dla inicjatywy "${initiativeName}"`
        : `Project auto-created for initiative "${initiativeName}"`,
    });
    const newProjectId = String(createRes?.id || '');
    if (!newProjectId) {
      throw new Error(isPolish ? 'Nie udało się utworzyć projektu' : 'Failed to create project');
    }

    // 2. Link initiative to the new project
    await Api.post(`/initiatives/${initiativeId}/move`, {
      targetProjectId: newProjectId,
      moveTasks: true,
    });

    // 3. Update local state
    setResolvedProjectId(newProjectId);

    return newProjectId;
  }, [initiative?.id, initiative?.name, initiative?.title, isPolish, projectId]);

  const toTeamRole = useCallback((raw: unknown): TeamRole => {
    const r = String(raw || '')
      .trim()
      .toUpperCase();
    return (TEAM_ROLE_ORDER as string[]).includes(r) ? (r as TeamRole) : 'TEAM_MEMBER';
  }, []);

  const loadMembers = useCallback(
    async (overrideProjectId?: string) => {
      const pid = overrideProjectId || projectId;
      if (!pid) {
        setMembers([]);
        return;
      }
      setLoadingMembers(true);
      try {
        const res = await Api.get(`/projects/${pid}/members`);
        const rows = (res as any)?.members || [];
        const mapped: TeamMember[] = rows.map((m: any) => {
          const role = toTeamRole(m.projectRole);
          return {
            id: String(m.id),
            userId: String(m.userId),
            role,
            isInvoked: !!m.isInvoked,
            consultantProfile: (String(m.consultantProfile || 'NONE').toUpperCase() ||
              'NONE') as ConsultantProfile,
            engagementType: (String(m.engagementType || 'INTERNAL').toUpperCase() ||
              'INTERNAL') as EngagementType,
            accountRole: m.accountRole ?? null,
            ...getPermissionsForRole(role),
            assignedAreas: null,
            assignedAt: m.createdAt || m.updatedAt || null,
            userName: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email || '',
            userEmail: m.email || '',
          };
        });
        setMembers(mapped);
      } catch (e: any) {
        console.error(e);
        toast.error(
          e?.message || (isPolish ? 'Nie udało się pobrać zespołu' : 'Failed to load team')
        );
      } finally {
        setLoadingMembers(false);
      }
    },
    [isPolish, projectId, toTeamRole]
  );

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const existingMemberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const orgUserIds = useMemo(() => new Set(users.map((u) => String(u.id))), [users]);
  const orgEmailDomains = useMemo(() => {
    return new Set(
      users
        .map(
          (u) =>
            String(u.email || '')
              .toLowerCase()
              .split('@')[1] || ''
        )
        .filter((d) => d.length > 0)
    );
  }, [users]);

  const proposalRows = useMemo(() => {
    if (!aiProposal) return [];
    const userById = new Map(
      users.map((u: any) => [
        String(u.id),
        { name: `${u.firstName || ''} ${u.lastName || ''}`.trim(), email: String(u.email || '') },
      ])
    );
    const memberById = new Map(members.map((m) => [m.userId, m]));

    type Row = {
      key: string;
      kind: 'add' | 'update' | 'remove';
      userId: string;
      name: string;
      email: string;
      projectFunction?: string;
      role?: TeamRole;
      confidence?: Confidence;
      note: string;
      disabled?: boolean;
    };

    const rows: Row[] = [];

    aiProposal.add.forEach((a) => {
      const u = userById.get(a.userId) || { name: a.userId, email: '' };
      rows.push({
        key: `add:${a.userId}:${a.projectFunction}`,
        kind: 'add',
        userId: a.userId,
        name: u.name || a.userId,
        email: u.email || '',
        projectFunction: a.projectFunction,
        role: a.role,
        confidence: a.confidence,
        note: a.why || '',
        disabled: existingMemberIds.has(a.userId),
      });
    });

    aiProposal.update.forEach((u) => {
      const existing = memberById.get(u.userId);
      rows.push({
        key: `update:${u.userId}`,
        kind: 'update',
        userId: u.userId,
        name: existing?.userName || u.userId,
        email: existing?.userEmail || '',
        projectFunction: u.projectFunction,
        role: u.role,
        note: u.reason,
      });
    });

    aiProposal.remove.forEach((r) => {
      const existing = memberById.get(r.userId);
      rows.push({
        key: `remove:${r.userId}`,
        kind: 'remove',
        userId: r.userId,
        name: existing?.userName || r.userId,
        email: existing?.userEmail || '',
        note: r.reason,
      });
    });

    const rank = (k: Row['kind']) => (k === 'add' ? 10 : k === 'update' ? 20 : 30);
    return rows.sort((a, b) => {
      const ra = rank(a.kind);
      const rb = rank(b.kind);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [aiProposal, existingMemberIds, members, users]);

  const proposalMissingFunctions = useMemo(() => {
    return aiProposal?.missingFunctions || [];
  }, [aiProposal]);

  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
    setAiProposal(null);
    setSelectedAddIds({});
    setSelectedUpdateIds({});
    setSelectedRemoveIds({});
  }, []);

  const buildEvidenceByUser = useMemo(() => {
    const byUser: Record<
      string,
      {
        taskAssigneeCount: number;
        decisionOwnerCount: number;
        raci: Array<string>;
      }
    > = {};
    const bump = (userId: string) => {
      if (!byUser[userId]) {
        byUser[userId] = { taskAssigneeCount: 0, decisionOwnerCount: 0, raci: [] };
      }
      return byUser[userId];
    };

    tasks.forEach((t: any) => {
      const uid = String(t.assigneeId || '').trim();
      if (!uid) return;
      bump(uid).taskAssigneeCount += 1;
    });
    decisions.forEach((d: any) => {
      const uid = String(d.decisionMakerId || '').trim();
      if (!uid) return;
      bump(uid).decisionOwnerCount += 1;
    });
    stakeholders.forEach((s: any) => {
      const uid = String(s.userId || '').trim();
      if (!uid) return;
      const role = String(s.role || '').trim();
      if (role) bump(uid).raci.push(role);
    });

    return byUser;
  }, [tasks, decisions, stakeholders]);

  const analyzeTeamWithAI = useCallback(async () => {
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const orgUsers: OrgUser[] = users.map((u: any) => ({
        id: String(u.id),
        email: String(u.email || ''),
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      }));

      const existing = members.map((m) => ({
        userId: m.userId,
        role: m.role,
        areas: m.assignedAreas || [],
        name: m.userName || '',
        email: m.userEmail || '',
      }));

      const evidence = Object.entries(buildEvidenceByUser).map(([userId, e]) => ({
        userId,
        taskAssigneeCount: e.taskAssigneeCount,
        decisionOwnerCount: e.decisionOwnerCount,
        raci: e.raci,
      }));

      const systemInstruction = [
        `You are a senior PMO delivery lead.`,
        `Your job: propose a lean, sensible initiative team and system roles.`,
        ``,
        `OUTPUT LANGUAGE: English only. Translate any non-English context to English.`,
        ``,
        `Constraints:`,
        `- Keep it lean: core team 4–8 people, max 10 additions total.`,
        `- Use only the provided org users for userId. Never fabricate userId values.`,
        `- Separate project function from app role:`,
        `  - projectFunction = what the person does in the initiative (e.g., Delivery Lead, Process SME, Tech Lead, Change & Training, QA/UAT Lead, Ops/Hypercare, Security, Vendor Mgmt).`,
        `  - role = canonical project role (use exactly one of): SPONSOR | PROJECT_LEADER | INITIATIVE_OWNER | TEAM_MEMBER | PMO | PORTFOLIO_OWNER | BUSINESS_OWNER | STEERING_COMMITTEE.`,
        `- Prefer reusing people who already show evidence in this initiative (tasks/decisions/RACI).`,
        `- If the current team is already good, you may return add=[] remove=[] but still return update[] or missingFunctions[].`,
        `- Do NOT invent responsibilities that require unknown systems or facts.`,
        ``,
        `Return ONLY valid JSON (no markdown, no commentary).`,
        `Schema:`,
        `{`,
        `  "add": [{ "userId": string, "role": "SPONSOR"|"PROJECT_LEADER"|"INITIATIVE_OWNER"|"TEAM_MEMBER"|"PMO"|"PORTFOLIO_OWNER"|"BUSINESS_OWNER"|"STEERING_COMMITTEE", "projectFunction": string, "confidence"?: "high"|"medium"|"low", "why"?: string, "evidence"?: string[] }],`,
        `  "update": [{ "userId": string, "role"?: "SPONSOR"|"PROJECT_LEADER"|"INITIATIVE_OWNER"|"TEAM_MEMBER"|"PMO"|"PORTFOLIO_OWNER"|"BUSINESS_OWNER"|"STEERING_COMMITTEE", "projectFunction"?: string, "reason": string }],`,
        `  "remove": [{ "userId": string, "reason": string }],`,
        `  "missingFunctions": [{ "projectFunction": string, "why": string }],`,
        `  "note"?: string`,
        `}`,
      ].join('\n');

      const contextText = [
        `[INITIATIVE]`,
        `Name: ${String(initiative?.name || '')}`,
        `Status: ${String(initiative?.status || '')}`,
        `Priority: ${String(initiative?.priority || '')}`,
        `Summary: ${String(initiative?.summary || initiative?.description || '')}`,
        ``,
        `[CURRENT TEAM MEMBERS]`,
        JSON.stringify(existing, null, 2),
        ``,
        `[ORG USERS]`,
        JSON.stringify(orgUsers, null, 2),
        ``,
        `[EVIDENCE SIGNALS]`,
        `- tasks include assigneeId`,
        `- decisions include decisionMakerId`,
        `- stakeholders include RACI role`,
        JSON.stringify(evidence, null, 2),
        ``,
        `[RAID CONTEXT]`,
        JSON.stringify(
          (raidItems || []).slice(0, 20).map((r: any) => ({
            type: r.type,
            title: r.title,
            owner: r.owner || '',
          })),
          null,
          2
        ),
      ].join('\n');

      const res = await Api.post('/ai/refine-text', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Initiative team proposal',
        artifactContext: {
          title: initiative?.name || '',
          status: initiative?.status || '',
          priority: initiative?.priority || '',
          type: 'initiative',
        },
        language: 'en',
      });

      const parsed = safeJsonParse(String(res?.text || ''));
      const proposal: TeamAiProposal = {
        add: Array.isArray(parsed?.add) ? parsed.add : [],
        update: Array.isArray(parsed?.update) ? parsed.update : [],
        remove: Array.isArray(parsed?.remove) ? parsed.remove : [],
        missingFunctions: Array.isArray(parsed?.missingFunctions) ? parsed.missingFunctions : [],
        note: parsed?.note ? String(parsed.note) : undefined,
      };

      const orgUserIds = new Set(orgUsers.map((u) => u.id));
      proposal.add = proposal.add
        .map((a: any) => ({
          userId: String(a?.userId || '').trim(),
          role: toTeamRole(a?.role || 'TEAM_MEMBER'),
          projectFunction: String(a?.projectFunction || '').trim(),
          confidence: (String(a?.confidence || '').trim() as Confidence) || undefined,
          why: a?.why ? String(a.why).trim() : undefined,
          evidence: Array.isArray(a?.evidence) ? a.evidence.map((x: any) => String(x)) : undefined,
        }))
        .filter((a) => a.userId && orgUserIds.has(a.userId) && a.projectFunction)
        .slice(0, 12);

      proposal.update = proposal.update
        .map((u: any) => ({
          userId: String(u?.userId || '').trim(),
          role: u?.role ? toTeamRole(u.role) : undefined,
          projectFunction: u?.projectFunction ? String(u.projectFunction).trim() : undefined,
          reason: String(u?.reason || '').trim(),
        }))
        .filter((u) => u.userId && u.reason)
        .slice(0, 12);

      proposal.remove = proposal.remove
        .map((r: any) => ({
          userId: String(r?.userId || '').trim(),
          reason: String(r?.reason || '').trim(),
        }))
        .filter((r) => r.userId && r.reason)
        .slice(0, 8);

      proposal.missingFunctions = proposal.missingFunctions
        .map((m: any) => ({
          projectFunction: String(m?.projectFunction || '').trim(),
          why: String(m?.why || '').trim(),
        }))
        .filter((m) => m.projectFunction && m.why)
        .slice(0, 12);

      if (
        proposal.add.length === 0 &&
        proposal.update.length === 0 &&
        proposal.remove.length === 0 &&
        proposal.missingFunctions.length === 0
      ) {
        toast.error(isPolish ? 'AI nie zwróciło propozycji' : 'AI returned no proposals');
        return;
      }

      setAiProposal(proposal);
      setShowAIModal(true);
      setSelectedAddIds(
        Object.fromEntries(proposal.add.map((a) => [a.userId, !existingMemberIds.has(a.userId)]))
      );
      setSelectedUpdateIds(Object.fromEntries(proposal.update.map((u) => [u.userId, true])));
      setSelectedRemoveIds(Object.fromEntries(proposal.remove.map((r) => [r.userId, false])));
    } catch (e: any) {
      toast.error(e?.message || (isPolish ? 'Analiza AI nie powiodła się' : 'AI analysis failed'));
    } finally {
      setAiBusy(false);
    }
  }, [
    aiBusy,
    buildEvidenceByUser,
    decisions,
    existingMemberIds,
    initiative,
    isPolish,
    members,
    raidItems,
    stakeholders,
    tasks,
    users,
  ]);

  useEffect(() => {
    if (!teamAiRequest) return;
    const run = async () => {
      try {
        await analyzeTeamWithAI();
      } finally {
        clearTeamAiRequest();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamAiRequest?.nonce]);

  // Role stats
  const roleStats = useMemo(() => {
    const stats = TEAM_ROLE_ORDER.reduce(
      (acc, r) => {
        (acc as any)[r] = 0;
        return acc;
      },
      {} as Record<TeamRole, number>
    );
    members.forEach((m) => {
      if (stats[m.role] !== undefined) stats[m.role]++;
    });
    return stats;
  }, [members]);

  // Search users (uses org users list)
  const handleSearchUsers = useCallback(
    async (query: string): Promise<OrgUser[]> => {
      // Use locally available users from context as primary source
      const q = query.toLowerCase();
      const mapped = users.map((u) => ({
        id: u.id,
        email: u.email || '',
        name: `${u.firstName} ${u.lastName}`.trim(),
      }));
      if (!q) return mapped;
      return mapped.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    },
    [users]
  );

  // Add member (canonical project membership — auto-creates project if needed)
  const handleAddMember = useCallback(
    async (args: {
      userId: string;
      role: TeamRole;
      isInvoked: boolean;
      consultantProfile: ConsultantProfile;
      engagementType: EngagementType;
    }) => {
      const pid = await ensureProjectId();
      await Api.post(`/projects/${pid}/members`, {
        userId: args.userId,
        projectRole: args.role,
      });
      toast.success(isPolish ? 'Dodano członka zespołu' : 'Team member added');
      await loadMembers(pid);
    },
    [ensureProjectId, isPolish, loadMembers]
  );

  const handleInviteExternal = useCallback(
    async (args: {
      email: string;
      role: TeamRole;
      isInvoked: boolean;
      consultantProfile: ConsultantProfile;
      engagementType: EngagementType;
    }) => {
      const pid = await ensureProjectId();
      await Api.post(`/invitations/project`, {
        email: args.email,
        projectId: pid,
        projectRole: args.role,
        orgRole: 'USER',
        consultantProfile: args.consultantProfile,
        engagementType: args.engagementType,
        message: isPolish
          ? `Zaproszenie do projektu (inicjatywa: ${initiative?.name || initiative?.title || ''})`
          : `Project invite (initiative: ${initiative?.name || initiative?.title || ''})`,
      });
      toast.success(isPolish ? 'Wysłano zaproszenie' : 'Invitation sent');
    },
    [ensureProjectId, initiative?.name, initiative?.title, isPolish]
  );

  // Update role
  const handleUpdateRole = useCallback(
    async (userId: string, newRole: TeamRole) => {
      if (!projectId) return;
      await Api.patch(`/projects/${projectId}/members/${userId}`, { projectRole: newRole });
      toast.success(isPolish ? 'Rola zaktualizowana' : 'Role updated');
      await loadMembers();
    },
    [isPolish, loadMembers, projectId]
  );

  // Remove member
  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (!projectId) return;
      await Api.delete(`/projects/${projectId}/members/${userId}`);
      toast.success(isPolish ? 'Usunięto z zespołu' : 'Removed from team');
      await loadMembers();
    },
    [isPolish, loadMembers, projectId]
  );

  const isMemberExternal = useCallback(
    (member: TeamMember) => {
      if (member.consultantProfile && member.consultantProfile !== 'NONE') return true;
      if (orgUserIds.has(String(member.userId))) return false;
      const domain = String(member.userEmail || '')
        .toLowerCase()
        .split('@')[1];
      if (!domain) return true;
      if (orgEmailDomains.size === 0) return true;
      return !orgEmailDomains.has(domain);
    },
    [orgEmailDomains, orgUserIds]
  );

  const applyAiProposal = useCallback(async () => {
    if (!aiProposal) return;
    if (!projectId) {
      toast.error(isPolish ? 'Brak projektu dla inicjatywy' : 'Initiative has no project');
      return;
    }
    const adds = aiProposal.add.filter((a) => selectedAddIds[a.userId]);
    const updates = aiProposal.update.filter((u) => selectedUpdateIds[u.userId]);
    const removes = aiProposal.remove.filter((r) => selectedRemoveIds[r.userId]);

    if (adds.length === 0 && updates.length === 0 && removes.length === 0) {
      toast(isPolish ? 'Brak wybranych zmian' : 'No selected changes');
      return;
    }

    if (removes.length > 0) {
      const ok = window.confirm(
        isPolish
          ? `Usunąć ${removes.length} członków zespołu?`
          : `Remove ${removes.length} team members?`
      );
      if (!ok) return;
    }

    try {
      // updates
      for (const u of updates) {
        if (!u.role) continue;
        await Api.patch(`/projects/${projectId}/members/${u.userId}`, { projectRole: u.role });
      }
      // adds
      for (const a of adds) {
        await Api.post(`/projects/${projectId}/members`, {
          userId: a.userId,
          projectRole: a.role,
        });
      }
      // removes
      for (const r of removes) {
        await Api.delete(`/projects/${projectId}/members/${r.userId}`);
      }

      await loadMembers();
      toast.success(isPolish ? 'Zastosowano propozycje AI' : 'Applied AI proposals');
      closeAIModal();
    } catch (e: any) {
      console.error(e);
      toast.error(
        e?.message ||
          (isPolish ? 'Nie udało się zastosować propozycji AI' : 'Failed to apply AI proposals')
      );
    }
  }, [
    aiProposal,
    closeAIModal,
    isPolish,
    loadMembers,
    projectId,
    selectedAddIds,
    selectedRemoveIds,
    selectedUpdateIds,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
    >
      {/* Static Header (aligned with RACI section style) */}
      <div className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-3">
          <div className="text-left">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {isPolish ? 'Zarządzanie zespołem' : 'Team Management'}
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {members.length} {isPolish ? 'członków' : 'members'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Plus size={12} />
            {isPolish ? 'Dodaj członka' : 'Add Member'}
          </button>
          {members.length > 0 && (
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              {members.length}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div>
        {/* Role Stats Bar */}
        {members.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-200/50 dark:border-navy-700/30 bg-slate-50/30 dark:bg-navy-800/20">
            <div className="flex items-center gap-3 overflow-x-auto">
              {(Object.entries(ROLE_CONFIG) as [TeamRole, (typeof ROLE_CONFIG)[TeamRole]][]).map(
                ([role, config]) => {
                  const count = roleStats[role];
                  if (count === 0) return null;
                  return (
                    <div
                      key={role}
                      className={`flex items-center px-2.5 py-1 rounded-lg ${config.bgColor} ${config.borderColor} border`}
                    >
                      <span className={`text-xs font-medium ${config.color}`}>
                        {count} {isPolish ? config.label.pl : config.label.en}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* Members Table */}
        {members.length === 0 ? (
          <div className="text-center py-10">
            <div className="p-4 rounded-full bg-slate-100 dark:bg-navy-800 inline-block mb-3">
              <Users size={24} className="text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isPolish ? 'Brak członków zespołu' : 'No team members yet'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {isPolish
                ? 'Dodaj członków, aby rozpocząć współpracę'
                : 'Add members to start collaborating'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors mx-auto"
            >
              <Plus size={16} />
              {isPolish ? 'Dodaj pierwszego członka' : 'Add First Member'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 600 }}>
              <thead>
                <tr className="border-b border-slate-200/50 dark:border-navy-700/30 bg-slate-50/50 dark:bg-navy-800/30">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'CZŁONEK' : 'MEMBER'}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'ROLA' : 'ROLE'}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'UPRAWNIENIA' : 'PERMISSIONS'}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'ORGANIZACJA' : 'ORG'}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'DODANO' : 'ADDED'}
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'AKCJE' : 'ACTIONS'}
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {members.map((member) => (
                    <TeamMemberRow
                      key={member.id}
                      member={member}
                      isPolish={isPolish}
                      isExternal={isMemberExternal(member)}
                      onUpdateRole={handleUpdateRole}
                      onRemove={handleRemoveMember}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Footer: Role legend */}
        {members.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200/50 dark:border-navy-700/30 bg-slate-50/30 dark:bg-navy-800/20">
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400">
              {(Object.entries(ROLE_CONFIG) as [TeamRole, (typeof ROLE_CONFIG)[TeamRole]][]).map(
                ([role, config]) => (
                  <span key={role}>
                    {isPolish ? config.label.pl : config.label.en} —{' '}
                    {isPolish ? config.description.pl : config.description.en}
                  </span>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Team Proposal Modal */}
      {showAIModal && aiProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-navy-700/60 bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Propozycja zespołu (AI)' : 'Team proposal (AI)'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isPolish
                    ? 'Zaznacz zmiany do zastosowania. Funkcje projektu zapisujemy jako “Areas”.'
                    : 'Select changes to apply. Project functions are stored as “Areas”.'}
                </p>
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

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-4">
              {proposalMissingFunctions.length > 0 && (
                <div className="p-3 rounded-xl border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/5">
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                    {isPolish ? 'Brakujące funkcje' : 'Missing functions'} (
                    {proposalMissingFunctions.length})
                  </div>
                  <ul className="mt-2 space-y-1">
                    {proposalMissingFunctions.map((m) => (
                      <li
                        key={m.projectFunction}
                        className="text-xs text-amber-800/90 dark:text-amber-200"
                      >
                        <span className="font-semibold">{m.projectFunction}</span> — {m.why}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto overflow-y-visible rounded-xl border border-slate-200 dark:border-navy-700/40">
                <table className="w-full text-sm table-fixed" style={{ minWidth: 920 }}>
                  <colgroup>
                    <col style={{ width: 44 }} />
                    <col style={{ width: 96 }} />
                    <col style={{ width: 240 }} />
                    <col style={{ width: 210 }} />
                    <col style={{ width: 170 }} />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-200 dark:border-navy-700/40">
                      <th className="text-left py-2.5 pl-3 pr-2">
                        <span className="sr-only">{isPolish ? 'Wybór' : 'Select'}</span>
                      </th>
                      <th className="text-left py-2.5 pr-2">{isPolish ? 'Akcja' : 'Action'}</th>
                      <th className="text-left py-2.5 pr-2">{isPolish ? 'Osoba' : 'Member'}</th>
                      <th className="text-left py-2.5 pr-2">
                        {isPolish ? 'Funkcja (Areas)' : 'Project function (Areas)'}
                      </th>
                      <th className="text-left py-2.5 pr-2">{isPolish ? 'Rola' : 'Role'}</th>
                      <th className="text-left py-2.5 pr-3">
                        {isPolish ? 'Uzasadnienie' : 'Notes'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                    {proposalRows.map((row) => {
                      const checked =
                        row.kind === 'add'
                          ? !!selectedAddIds[row.userId]
                          : row.kind === 'update'
                            ? !!selectedUpdateIds[row.userId]
                            : !!selectedRemoveIds[row.userId];
                      const disabled = !!row.disabled;
                      const onToggle = (v: boolean) => {
                        if (row.kind === 'add')
                          setSelectedAddIds((p) => ({ ...p, [row.userId]: v }));
                        else if (row.kind === 'update')
                          setSelectedUpdateIds((p) => ({ ...p, [row.userId]: v }));
                        else setSelectedRemoveIds((p) => ({ ...p, [row.userId]: v }));
                      };

                      const actionBadge =
                        row.kind === 'add'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-400/30'
                          : row.kind === 'update'
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-400/30'
                            : 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-400/30';
                      const roleKey = String(row.role || '').toUpperCase() as TeamRole;
                      const roleCfg = ROLE_CONFIG[roleKey];
                      const actionLabel =
                        row.kind === 'add'
                          ? isPolish
                            ? 'Dodaj'
                            : 'Add'
                          : row.kind === 'update'
                            ? isPolish
                              ? 'Zmień'
                              : 'Update'
                            : isPolish
                              ? 'Usuń'
                              : 'Remove';

                      return (
                        <tr
                          key={row.key}
                          className={
                            row.kind === 'remove'
                              ? 'bg-amber-50/20 dark:bg-amber-500/5'
                              : 'hover:bg-slate-50/50 dark:hover:bg-navy-800/20'
                          }
                        >
                          <td className="py-2.5 pl-3 pr-2 align-middle">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={(e) => onToggle(e.target.checked)}
                            />
                          </td>
                          <td className="py-2.5 pr-2 align-middle">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${actionBadge}`}
                            >
                              {actionLabel}
                            </span>
                          </td>
                          <td className="py-2.5 pr-2 align-top">
                            <div className="min-w-0">
                              <div
                                className="text-sm font-medium text-slate-800 dark:text-white truncate"
                                title={row.name || row.userId}
                              >
                                {row.name || row.userId}
                              </div>
                              <div
                                className="text-[11px] text-slate-500 dark:text-slate-400 truncate"
                                title={row.email || '—'}
                              >
                                {row.email || '—'}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pr-2 align-top">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 truncate max-w-full"
                              title={row.projectFunction || '—'}
                            >
                              {row.projectFunction || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-2 align-top">
                            {roleCfg ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${roleCfg.bgColor} ${roleCfg.color} ${roleCfg.borderColor}`}
                                title={isPolish ? roleCfg.label.pl : roleCfg.label.en}
                              >
                                {isPolish ? roleCfg.label.pl : roleCfg.label.en}
                              </span>
                            ) : (
                              <span
                                className="text-xs text-slate-700 dark:text-slate-200 truncate block"
                                title={row.role || '—'}
                              >
                                {row.role || '—'}
                              </span>
                            )}
                            {row.confidence ? (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {isPolish ? 'Pewność' : 'Confidence'}: {row.confidence}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2.5 pr-3 align-top">
                            <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
                              {disabled
                                ? isPolish
                                  ? 'Już jest w zespole.'
                                  : 'Already in team.'
                                : row.note || '—'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {proposalRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                        >
                          {isPolish ? 'Brak propozycji zmian' : 'No proposed changes'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-end gap-2">
              <button
                onClick={closeAIModal}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={applyAiProposal}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors"
              >
                {isPolish ? 'Zastosuj' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddMemberModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onAdd={handleAddMember}
            onInviteExternal={handleInviteExternal}
            onSearchUsers={handleSearchUsers}
            existingMemberIds={existingMemberIds}
            isPolish={isPolish}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
