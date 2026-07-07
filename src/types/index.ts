/**
 * Types Index
 * Master export file for all TypeScript types
 *
 * Enterprise SaaS Architecture - Consultify
 */

// Core Enums and UI-specific types (Explicitly selected to avoid collisions)
export type {
  AdditionalAudit,
  Address,
  ADMAAssessmentData,
  ADMAPillarId,
  // Missing exports used across UI
  AIMessageHistory,
  AIProviderType,
  ApiKey,
  ApprovalChainStatus,
  AssessmentFrameworkId,
  AssessmentTab,
  AxisAssessment,
  AxisId,
  BenefitRange,
  BlockType,
  CalloutBlockContent,
  Certification,
  Challenge,
  // Additional missing types
  CMMIAssessmentData,
  CMMICategoryId,
  CommsPlanItem,
  CompanyProfile,
  CompanySize,
  Constraint,
  ContactEmail,
  ContactPhone,
  ContentAnalyticsDashboard,
  ContentAnalyticsEvent,
  ContentCategory,
  ContentComment,
  ContentReview,
  ContentReviewPriority,
  ContentReviewStatus,
  ContentTag,
  CostRange,
  CustomRole,
  DaySchedule,
  DBR77AssessmentData,
  DBR77ProcessAssessment,
  DBR77WorkstationAssessment,
  Document,
  DoNotDisturbHours,
  DRDAssessmentData,
  DRDAxis,
  DRDAxisId,
  DRDAxisScore,
  EconomicsSummary,
  Education,
  EmailPreferences,
  EmailTemplate,
  EmailTemplateStatus,
  EmergencyContact,
  ExtendedContactInfo,
  ExtendedSocialLinks,
  FreeSession,
  FullInitiative,
  FullReport,
  FullSession,
  GapForGeneration,
  GeneratedInitiative,
  GroupPermission,
  InitiativeComment,
  InitiativeGeneratorConstraints,
  InitiativeRiskLevel,
  InitiativeTeamMember,
  InitiativeTemplate,
  InitiativeVersion,
  Invitation,
  InvitationEvent,
  InvitationValidation,
  KeyboardShortcuts,
  KPITracking,
  Language,
  LegalDocType,
  LegalDocument,
  LinkedAccounts,
  ManagementReport,
  ManagementReportFilter,
  ManagementReportOptions,
  ManagementReportSchedule,
  ManagementReportScope,
  ManagementReportStatus,
  ManagementReportType,
  MaturityLevel,
  Notification,
  OrganizationOwnership,
  OrganizationProfile,
  OutOfOfficePeriod,
  OutOfOfficeSettings,
  OverallRAGStatus,
  OwnershipTransferRequest,
  PDFImportResult,
  PerformancePreferences,
  PermissionRequest,
  PermissionRequestPriority,
  PermissionRequestType,
  PlaybookEdge,
  PlaybookNode,
  PlaybookTemplateStats,
  PlaybookTemplateVersion,
  PlaybookTemplateVersionHistory,
  PMOProjectRole,
  PortfolioFilters,
  PortfolioHealthReportContent,
  PortfolioInitiative,
  PortfolioSortConfig,
  PortfolioViewMode,
  ProfileCompletion,
  ProfileVisibility,
  Quarter,
  QuietHoursSettings as QuietHoursSettingsType,
  RACIMatrix,
  RACIType,
  RAGStatus,
  RAGStatusItem,
  RaidReportContent,
  RelatedInitiative,
  Report,
  ReportApproval,
  ReportApprovalStatus,
  ReportBlock,
  ReportComment,
  ReportVersion,
  RiskRating,
  RolePermission,
  ShortcutAction,
  ShortcutCategory,
  ShortcutPreset,
  SIRIAssessmentData,
  SocialLinks,
  SpendingAlert,
  StakeholderImpact,
  StakeholderMapItem,
  StatusTransition,
  SteeringCommitteeReportContent,
  StrategicGoal,
  StrategicIntent,
  TableBlockContent,
  TeamMeetingReportContent,
  TemplateCategory,
  TemplateGraph,
  TemplateValidationError,
  TextBlockContent,
  UserGroup,
  UserProfileExtended,
  UserSkill,
  VersionComparisonResult,
  Wave,
  WorkExperience,
  WorkflowState,
  Workstream,
  WorkstreamStatus,
} from './core';
export {
  ACCOUNT_TYPES,
  AppView,
  // Enum values
  AssessmentStep,
  AuthStep,
  InitiativeStatus,
  InvitationStatus,
  InvitationType,
  AccountType as LegacyAccountType,
  ProjectRole as LegacyProjectRole,
  UserRole as LegacyUserRole,
  PlaybookNodeType,
  PROJECT_ROLES,
  ProjectRole,
  SCMSPhase,
  SessionMode,
  TaskStatus,
  TemplateStatus,
  UserRole,
} from './core';

// WorkingHours
export type { WorkingHours } from './core';

// API Types (Categorized)
export * from './api/requests';
export * from './api/responses';

// Domain Types (Categorized)
export * from './domain/ai';
export * from './domain/billing';
export * from './domain/pmo';
export * from './domain/project';
export * from './domain/user';

// UI Types
export * from './ui/index';

// Specialized types
export * from './AIContract';
export * from './artifactContent';
export * from './discovery';
export * from './myWork';
export * from './tablePlatform';
export * from './workspace';

// Initiative runtime values (const maps, helpers)
export { INITIATIVE_STATUS_METADATA } from './initiative';

// Re-export config types
export type { CardDocumentation } from '../config/cardDocumentation';
export type { FAQItem } from '../config/faqContent';
export type { VideoTutorial } from '../config/videoTutorialsContent';
