/**
 * InitiativeContext
 *
 * Provides shared state and actions to all initiative section components.
 * This is the "data bus" that replaces passing 30+ props through the component tree.
 */

import React, { createContext, useContext } from 'react';

import type { StatusAction } from '@/services/initiativeLifecycle';

import type {
  Attachment,
  Comment,
  LinkedItem,
  Stakeholder,
  StakeholderNotificationSettings,
  StakeholderRole,
  TaskDependency,
  WarningThresholds,
} from '../../MyWork/shared';
import type {
  EscalationRuleWithConfig,
  ReminderRuleWithDelivery,
} from '../../shared/NModeSections';
import type {
  BudgetItem,
  Decision,
  GateReadinessCheck,
  GateRoleAssignment,
  HistoryEvent,
  IntangibleAssetItem,
  PendingApproval,
  RaidItem,
  ResourceItem,
  StatusHistoryEntry,
  TaskItem,
  TimelineMilestone,
  TimelinePhase,
  ToolItem,
  UserInfo,
  Watcher,
} from './types';

export interface InitiativeContextValue {
  // Core data
  initiative: any;
  initiativeId: string;
  initiativeTemplate: any;
  isPolish: boolean;

  // Related data
  decisions: Decision[];
  setDecisions: React.Dispatch<React.SetStateAction<Decision[]>>;
  raidItems: RaidItem[];
  setRaidItems: React.Dispatch<React.SetStateAction<RaidItem[]>>;
  watchers: Watcher[];
  setWatchers: React.Dispatch<React.SetStateAction<Watcher[]>>;
  history: HistoryEvent[];
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  comments: Comment[];
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  linkedItems: LinkedItem[];
  setLinkedItems: React.Dispatch<React.SetStateAction<LinkedItem[]>>;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  stakeholders: Stakeholder[];
  setStakeholders: React.Dispatch<React.SetStateAction<Stakeholder[]>>;
  dependencies: TaskDependency[];
  setDependencies: React.Dispatch<React.SetStateAction<TaskDependency[]>>;
  tags: string[];
  setTags: React.Dispatch<React.SetStateAction<string[]>>;
  users: UserInfo[];
  pendingApprovals: PendingApproval[];

  // Gate governance
  gateRoles: GateRoleAssignment[];
  setGateRoles: React.Dispatch<React.SetStateAction<GateRoleAssignment[]>>;
  userGateRoles: string[]; // Current user's gate roles on this initiative
  statusHistory: StatusHistoryEntry[];
  gateReadiness: GateReadinessCheck | null;

  // Editable fields
  summary: string;
  setSummary: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  priority: string;
  setPriority: (v: any) => void;
  ownerId: string;
  setOwnerId: (v: string) => void;
  sponsorId: string;
  setSponsorId: (v: string) => void;
  targetDate: string;
  setTargetDate: (v: string) => void;
  startDate: string | null;
  setStartDate: (v: string | null) => void;
  endDate: string | null;
  setEndDate: (v: string | null) => void;
  reminders: ReminderRuleWithDelivery[];
  setReminders: React.Dispatch<React.SetStateAction<ReminderRuleWithDelivery[]>>;
  escalationRules: EscalationRuleWithConfig[];
  setEscalationRules: React.Dispatch<React.SetStateAction<EscalationRuleWithConfig[]>>;
  thresholds: WarningThresholds;
  setThresholds: React.Dispatch<React.SetStateAction<WarningThresholds>>;

  // Resources data (Team / Budget / Tools)
  resourceItems: ResourceItem[];
  setResourceItems: React.Dispatch<React.SetStateAction<ResourceItem[]>>;
  budgetItems: BudgetItem[];
  setBudgetItems: React.Dispatch<React.SetStateAction<BudgetItem[]>>;
  toolItems: ToolItem[];
  setToolItems: React.Dispatch<React.SetStateAction<ToolItem[]>>;
  handleAddResource: (data: Omit<ResourceItem, 'id'>) => Promise<void>;
  handleUpdateResource: (id: string, data: Partial<ResourceItem>) => Promise<void>;
  handleDeleteResource: (id: string) => Promise<void>;
  handleAddBudgetItem: (data: Omit<BudgetItem, 'id'>) => Promise<void>;
  handleUpdateBudgetItem: (id: string, data: Partial<BudgetItem>) => Promise<void>;
  handleDeleteBudgetItem: (id: string) => Promise<void>;
  handleAddTool: (data: Omit<ToolItem, 'id'>) => Promise<void>;
  handleUpdateTool: (id: string, data: Partial<ToolItem>) => Promise<void>;
  handleDeleteTool: (id: string) => Promise<void>;
  intangibleAssets: IntangibleAssetItem[];
  setIntangibleAssets: React.Dispatch<React.SetStateAction<IntangibleAssetItem[]>>;
  handleAddIntangibleAsset: (data: Omit<IntangibleAssetItem, 'id'>) => Promise<void>;
  handleUpdateIntangibleAsset: (id: string, data: Partial<IntangibleAssetItem>) => Promise<void>;
  handleDeleteIntangibleAsset: (id: string) => Promise<void>;

  // UI state
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
  isGeneratingAI: string | null;
  isMutating: boolean;
  currentUserId: string;

  // Timeline milestones & phases
  timelineMilestones: TimelineMilestone[];
  setTimelineMilestones: React.Dispatch<React.SetStateAction<TimelineMilestone[]>>;
  timelinePhases: TimelinePhase[];
  setTimelinePhases: React.Dispatch<React.SetStateAction<TimelinePhase[]>>;
  timelineLocked: boolean;
  baselineVersion: number | null;
  estimatedDurationMonths: number | null;
  setEstimatedDurationMonths: (v: number | null) => void;

  // Resources (budget/tools) drafts
  budgetDraft: string;
  setBudgetDraft: (v: string) => void;
  resourceTools: string[];
  setResourceTools: React.Dispatch<React.SetStateAction<string[]>>;

  // Computed values
  status: string;
  ownerName: string;
  sponsorName: string;
  tasksDone: number;
  tasksInProgress: number;
  milestones: TaskItem[];
  riskCount: number;
  issueCount: number;
  criticalRaids: number;
  isWatching: boolean;
  pendingGates: readonly { id: string; label: string; forStatus: string; pmoDomain: string }[];
  statusActions: StatusAction[];
  primaryActions: StatusAction[];

  // Actions
  handleSave: () => Promise<void>;
  handleStatusAction: (action: StatusAction) => Promise<void>;
  handleToggleWatch: () => Promise<void>;
  handleGenerateAI: (section: string) => Promise<any>;
  // Tasks AI actions (triggered from CTA)
  tasksAiRequest: { mode: 'analyze' | 'addOne'; nonce: number } | null;
  requestTasksAi: (mode: 'analyze' | 'addOne') => void;
  clearTasksAiRequest: () => void;
  // Decisions AI actions (triggered from CTA)
  decisionsAiRequest: { mode: 'analyze' | 'addOne'; nonce: number } | null;
  requestDecisionsAi: (mode: 'analyze' | 'addOne') => void;
  clearDecisionsAiRequest: () => void;
  // Resources AI actions (triggered from CTA)
  resourcesAiRequest: { nonce: number } | null;
  requestResourcesAi: () => void;
  clearResourcesAiRequest: () => void;
  // Team AI actions (triggered from CTA)
  teamAiRequest: { nonce: number } | null;
  requestTeamAi: () => void;
  clearTeamAiRequest: () => void;
  handleCreateTask: () => Promise<void>;
  handleCreateDecision: () => Promise<void>;
  handleRemoveDecision: (id: string) => Promise<void>;
  handleCreateRaid: () => Promise<void>;
  handleUpdateRaid: (id: string, updates: Partial<RaidItem>) => void;
  handleDeleteRaid: (id: string) => Promise<void>;
  handleAddComment: (content: string) => Promise<void>;
  handleRequestApproval: (role: 'owner' | 'sponsor', gateType: string) => Promise<void>;
  handleOpenChat: () => void;
  handleArchive: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleCopyLink: () => void;
  handleExportPDF: () => void;
  fetchAll: () => Promise<void>;

  // Task creation form state
  newTaskTitle: string;
  setNewTaskTitle: (v: string) => void;
  newTaskIsMilestone: boolean;
  setNewTaskIsMilestone: (v: boolean) => void;
  newTaskMilestoneDate: string;
  setNewTaskMilestoneDate: (v: string) => void;
  showCreateTask: boolean;
  setShowCreateTask: (v: boolean) => void;

  // Decision creation form state
  newDecisionTitle: string;
  setNewDecisionTitle: (v: string) => void;
  newDecisionType: string;
  setNewDecisionType: (v: string) => void;
  showCreateDecision: boolean;
  setShowCreateDecision: (v: boolean) => void;

  // RAID creation form state
  newRaidTitle: string;
  setNewRaidTitle: (v: string) => void;
  newRaidType: 'risk' | 'issue' | 'assumption' | 'dependency';
  setNewRaidType: (v: 'risk' | 'issue' | 'assumption' | 'dependency') => void;
  newRaidSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  setNewRaidSeverity: (v: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => void;
  newRaidDescription: string;
  setNewRaidDescription: (v: string) => void;
  showCreateRaid: boolean;
  setShowCreateRaid: (v: boolean) => void;

  // Menu state
  showMoreMenu: boolean;
  setShowMoreMenu: (v: boolean) => void;
  showStatusDropdown: boolean;
  setShowStatusDropdown: (v: boolean) => void;
  showPriorityDropdown: boolean;
  setShowPriorityDropdown: (v: boolean) => void;
  showPhaseDropdown: boolean;
  setShowPhaseDropdown: (v: boolean) => void;
  showApprovalWorkflow: boolean;
  setShowApprovalWorkflow: (v: boolean) => void;

  // Tags
  newTag: string;
  setNewTag: (v: string) => void;

  // Callbacks from parent
  onBack?: () => void;
  onStatusChange?: (newStatus: string) => void;
  onOpenTask?: (taskId: string) => void;
  onOpenDecision?: (decisionId: string) => void;
}

export const InitiativeContext = createContext<InitiativeContextValue | null>(null);

/**
 * Hook to consume the InitiativeContext.
 * Must be used within an InitiativeContext.Provider.
 */
export function useInitiativeContext(): InitiativeContextValue {
  const ctx = useContext(InitiativeContext);
  if (!ctx) {
    throw new Error('useInitiativeContext must be used within an InitiativeContext.Provider');
  }
  return ctx;
}
