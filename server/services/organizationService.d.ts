/**
 * Organization Service
 *
 * Handles core organization logic:
 * - Member management (RBAC source of truth)
 * - Billing status & Token balance management
 * - Organization details
 */
interface Database {
    serialize: (callback: () => void) => void;
    run: (sql: string, params: unknown[], callback?: (this: {
        changes: number;
    }, err: Error | null) => void) => void;
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
}
interface Dependencies {
    db: Database;
    uuidv4: () => string;
}
export interface CreateOrganizationParams {
    userId: string;
    name: string;
    email?: string;
    attribution?: unknown;
}
export interface CreateOrganizationResult {
    id: string;
    name: string;
    role: string;
}
export interface OrganizationDetails {
    id: string;
    name: string;
    status: string;
    billing_status: string;
    token_balance: number;
    created_at: string;
}
export interface AddMemberParams {
    organizationId: string;
    userId: string;
    role: string;
    invitedBy?: string;
}
export interface AddMemberResult {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
}
export interface OrganizationMember {
    id: string;
    user_id: string;
    role: string;
    status: string;
    created_at: string;
    first_name: string;
    last_name: string;
    email: string;
}
export interface UserOrganization {
    id: string;
    name: string;
    billing_status: string;
    role: string;
}
export interface BillingActivationResult {
    success: boolean;
    billingStatus: string;
    organizationType: string;
    tokensAdded: number;
}
export interface AISettings {
    ai_assertiveness_level: string;
    ai_autonomy_level: string;
}
export interface UpdateMemberRoleParams {
    organizationId: string;
    userId: string;
    role: string;
}
export interface UpdateMemberRoleResult {
    organizationId: string;
    userId: string;
    role: string;
}
export interface OrganizationServiceInterface {
    ROLES: {
        OWNER: string;
        ADMIN: string;
        MEMBER: string;
        CONSULTANT: string;
    };
    setDependencies: (newDeps?: Partial<Dependencies>) => void;
    createOrganization: (params: CreateOrganizationParams) => Promise<CreateOrganizationResult>;
    getOrganization: (orgId: string) => Promise<OrganizationDetails>;
    addMember: (params: AddMemberParams) => Promise<AddMemberResult>;
    getMembers: (orgId: string) => Promise<OrganizationMember[]>;
    getUserOrganizations: (userId: string) => Promise<UserOrganization[]>;
    activateBilling: (orgId: string) => Promise<BillingActivationResult>;
    updateAISettings: (orgId: string, settings: Partial<AISettings>) => Promise<void>;
    getAISettings: (orgId: string) => Promise<AISettings>;
    removeMember: (params: {
        organizationId: string;
        userId: string;
    }) => Promise<void>;
    updateMemberRole: (params: UpdateMemberRoleParams) => Promise<UpdateMemberRoleResult>;
    getMemberRole: (organizationId: string, userId: string) => Promise<string | null>;
}
declare const OrganizationService: OrganizationServiceInterface;
export default OrganizationService;
//# sourceMappingURL=organizationService.d.ts.map