/**
 * Types Index
 * Master export file for all TypeScript types
 *
 * Enterprise SaaS Architecture - Consultinity
 */

// Core Enums and UI-specific types (Explicitly selected to avoid collisions)
export {
    AppView,
    SCMSPhase,
    SessionMode,
    AuthStep,
    UserRole,
    ProjectRole,
    TaskStatus,
    InitiativeStatus,
    InvitationType,
    InvitationStatus,
    PlaybookNodeType,
    UserRole as LegacyUserRole,
    ProjectRole as LegacyProjectRole,
    AccountType as LegacyAccountType,
    PROJECT_ROLES,
    ACCOUNT_TYPES,
    // Enum values
    AssessmentStep,
    TemplateStatus
} from './core';

export type { 
    FullSession,
    FullInitiative,
    ChatMessage,
    AIMessageHistory,
    PlaybookTemplateVersion,
    ApiKey,
    Invitation,
    InvitationEvent,
    OrgAISettings,
    CompanySize,
    OrganizationProfile,
    DRDAxis,
    PortfolioInitiative,
    ContentTag,
    ContentCategory,
    Artifact,
    PlaybookNode,
    RAGStatus,
    RAGStatusItem,
    OverallRAGStatus,
    LegalDocType,
    LegalDocument,
    InvitationValidation,
    OrganizationOwnership,
    SuperAdminAISettings,
    LLMProvider,
    RiskRating,
    AIPreferences,
    AIProactivityMode,
    UserAIProvider,
    UserAISettings,
    QuietHoursSettings as QuietHoursSettingsType,
    AIGeneratedCharter,
    InitiativeTeamMember,
    MaturityLevel,
    Language,
    FreeSession,
    CompanyProfile,
    // Additional missing types
    ChatOption,
    ChatCitation,
    ThinkingStep,
    ChatResponseAction,
    AISettingsAuditEntry,
    ProactivityBehavior,
    AdditionalAudit,
    AxisAssessment,
    ADMAAssessmentData,
    ADMAPillarId,
    AICharterRequest,
    AIProviderType,
    Address,
    ApprovalChainStatus,
    AssessmentFrameworkId,
    AssessmentTab,
    AxisId,
    BenefitRange,
    BlockType,
    CMMIAssessmentData,
    CMMICategoryId,
    CalloutBlockContent,
    Certification,
    Challenge,
    CommsPlanItem,
    Constraint,
    ContactEmail,
    ContactPhone,
    ContentAnalyticsDashboard,
    ContentAnalyticsEvent,
    ContentComment,
    ContentReview,
    ContentReviewPriority,
    ContentReviewStatus,
    CostRange,
    CustomRole,
    DBR77AssessmentData,
    DBR77ProcessAssessment,
    DBR77WorkstationAssessment,
    DaySchedule,
    DoNotDisturbHours,
    Document,
    EconomicsSummary,
    Education,
    EffectiveAISettings,
    EmailTemplate,
    EmailTemplateStatus,
    EmergencyContact,
    ExtendedContactInfo,
    ExtendedSocialLinks,
    FullReport,
    GapForGeneration,
    GeneratedInitiative,
    GroupPermission,
    InitiativeComment,
    InitiativeGeneratorConstraints,
    InitiativeRiskLevel,
    InitiativeTemplate,
    InitiativeVersion,
    KPITracking,
    KeyboardShortcuts,
    LinkedAccounts,
    ManagementReport,
    ManagementReportScope,
    ManagementReportStatus,
    ManagementReportType,
    Notification,
    OutOfOfficePeriod,
    OutOfOfficeSettings,
    OwnershipTransferRequest,
    PDFImportResult,
    PerformancePreferences,
    PermissionRequest,
    PermissionRequestPriority,
    PermissionRequestType,
    PlaybookTemplateStats,
    PortfolioFilters,
    PortfolioSortConfig,
    PortfolioStats,
    PortfolioViewMode,
    ProfileCompletion,
    ProfileVisibility,
    Quarter,
    RACIMatrix,
    RelatedInitiative,
    Report,
    ReportApproval,
    ReportApprovalStatus,
    ReportBlock,
    ReportVersion,
    RolePermission,
    SIRIAssessmentData,
    ShortcutAction,
    ShortcutCategory,
    ShortcutPreset,
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
    ToolCallInfo,
    UserGroup,
    UserProfileExtended,
    UserSkill,
    VersionComparisonResult,
    Wave,
    WorkExperience,
    WorkflowState,
    Workstream,
    WorkstreamStatus,
    EmailPreferences,
    FocusMode,
    PMOProjectRole,
    RACIType,
    PlaybookEdge,
    ReportComment,
    PlaybookTemplateVersionHistory
} from './core';

// Create Artifact alias
export type { Artifact as AIArtifact, WorkingHours } from './core';

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
export * from './myWork';
export * from './workspace';

// Re-export config types
export type { FAQItem } from '../config/faqContent';
export type { VideoTutorial } from '../config/videoTutorialsContent';
export type { CardDocumentation } from '../config/cardDocumentation';
