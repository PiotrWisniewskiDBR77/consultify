/**
 * Shared dependencies and utilities for SuperAdmin domain controllers.
 * All domain controllers import from this module.
 */

import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import * as uuid from 'uuid';

import { config } from '../../config/index.js';
import { getDatabase } from '../../database/index.js';
import { activityService } from '../../services/ActivityService.js';
import adminSessionService from '../../services/adminSessionService.js';
import complianceService from '../../services/complianceService.js';
import integrationService from '../../services/integrationService.js';
import legalService from '../../services/legalService.js';
import permissionsMatrixService from '../../services/permissionsMatrixService.js';
import securityIncidentService from '../../services/securityIncidentService.js';
import threatIntelligenceService from '../../services/threatIntelligenceService.js';
import usageService from '../../services/usageService.js';
import webhookService from '../../services/WebhookService.js';
import { AppError, asyncHandler as catchAsync } from '../../utils/ErrorHandler.js';

export { AppError, catchAsync, crypto };
export type { NextFunction, Request, Response };

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    organizationId?: string;
  };
}

export interface UserRow {
  id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  last_login: string;
  created_at: string;
  password?: string;
}

export const deps: {
  db: ReturnType<typeof getDatabase>;
  ActivityService: typeof activityService;
  BillingService: any;
  UsageService: typeof usageService;
  RealtimeService: any;
  StorageService: any;
  LegalService: any;
  LegalEventLogger: any;
  AttributionService: any;
  jwt: typeof jwt;
  bcrypt: typeof bcrypt;
  config: typeof config;
  uuid: typeof uuid;
  InvitationService: any;
  RefreshTokenService: any;
  OrganizationMetadataService: any;
  OrganizationTagService: any;
  OrganizationHealthService: any;
  OrganizationRelationshipService: any;
  OrganizationSegmentService: any;
  OrganizationAnalyticsService: any;
  UserActivityService: any;
  UserSessionService: any;
  UserGroupService: any;
  UserLicenseService: any;
  IPWhitelistService: any;
  DeviceManagementService: any;
  PasswordPolicyService: any;
  SecurityEventService: any;
  SupportTicketService: any;
  CustomerSuccessService: any;
  FeedbackService: any;
  UserAdoptionService: any;
  DataRetentionService: any;
  ConsentManagementService: any;
  AutomationEngineService: any;
  EmailTemplateService: any;
  EmailCampaignService: any;
  SecurityIncidentService: any;
  ThreatIntelligenceService: any;
  DLPService: any;
  DashboardBuilderService: any;
  IntegrationService: any;
  WebhookService: any;
  AdminSessionService: any;
  ComplianceService: any;
  PermissionsMatrixService: any;
} = {
  db: getDatabase(),
  ActivityService: activityService,
  BillingService: null,
  UsageService: usageService,
  RealtimeService: { getGlobalStats: () => ({}) } as any,
  StorageService: {
    storeFile: async () => '',
    getGlobalUsage: async () => ({ breakdown: [] }),
    listFiles: async () => [],
    deleteFile: async () => true,
  } as any,
  LegalService: legalService as any,
  LegalEventLogger: {
    logEvent: async () => ({}),
    getEvents: async () => [],
    getEventStats: async () => ({}),
  } as any,
  AttributionService: null,
  jwt: jwt,
  bcrypt: bcrypt,
  config: config,
  uuid: uuid,
  InvitationService: { createOrgInvitation: async () => ({ token: '' }) } as any,
  RefreshTokenService: null as any,
  OrganizationMetadataService: {
    getMetadata: async () => [],
    setMetadata: async () => ({}),
  } as any,
  OrganizationTagService: {
    getTags: async () => [],
    addTag: async () => ({}),
    removeTag: async () => ({}),
  } as any,
  OrganizationHealthService: {
    calculateHealthScore: async (orgId: string) => {
      try {
        const svc = await import('../../services/behaviorIntelligenceService.js');
        return svc.calculateHealthScore(orgId);
      } catch {
        return { overallScore: 0, churnRisk: 'UNKNOWN', healthTrend: 'unknown', dimensions: {} };
      }
    },
  } as any,
  OrganizationRelationshipService: { getRelationships: async () => [] } as any,
  OrganizationSegmentService: { getSegments: async () => [] } as any,
  OrganizationAnalyticsService: { getAnalytics: async () => ({}) } as any,
  UserActivityService: null as any,
  UserSessionService: null as any,
  UserGroupService: { getGroups: async () => [] } as any,
  UserLicenseService: { getLicenses: async () => [] } as any,
  IPWhitelistService: { getWhitelist: async () => [], addIP: async () => ({}) } as any,
  DeviceManagementService: { getUserDevices: async () => [] } as any,
  PasswordPolicyService: { getPolicy: async () => ({}) } as any,
  SecurityEventService: { getEvents: async () => [] } as any,
  SupportTicketService: {
    getTickets: async () => [],
    createTicket: async () => ({ ticketNumber: 'T-123' }),
  } as any,
  CustomerSuccessService: { getNotes: async () => [] } as any,
  FeedbackService: null as any,
  UserAdoptionService: null as any,
  DataRetentionService: { getPolicy: async () => ({}) } as any,
  ConsentManagementService: { getConsents: async () => [] } as any,
  AutomationEngineService: { getRules: async () => [] } as any,
  EmailTemplateService: { getTemplates: async () => [] } as any,
  EmailCampaignService: { getCampaigns: async () => [] } as any,
  SecurityIncidentService: securityIncidentService,
  ThreatIntelligenceService: threatIntelligenceService as any,
  DLPService: { getPolicies: async () => [] } as any,
  DashboardBuilderService: { getDashboards: async () => [] } as any,
  IntegrationService: integrationService,
  WebhookService: webhookService,
  AdminSessionService: adminSessionService,
  ComplianceService: complianceService,
  PermissionsMatrixService: permissionsMatrixService,
};

export const getAttributionService = async () => {
  if (!deps.AttributionService) {
    const module = await import('../../services/attributionService.js');
    deps.AttributionService = module.default;
  }
  return deps.AttributionService;
};

export const getBillingService = async () => {
  if (!deps.BillingService) {
    const billingModule = await import('../../services/BillingService.js');
    deps.BillingService = (billingModule as any).default || billingModule;
  }
  return deps.BillingService;
};

export const setDependencies = (newDeps: Partial<typeof deps>): void => {
  Object.assign(deps, newDeps);
};

export const tableExists = async (tableName: string): Promise<boolean> => {
  const t = String(tableName || '').trim();
  if (!t) return false;

  return new Promise((resolve) => {
    deps.db.get(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
      [t],
      (sqliteErr: any, sqliteRow: any) => {
        if (!sqliteErr && sqliteRow) return resolve(true);
        deps.db.get(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
          [t],
          (pgErr: any, pgRow: any) => resolve(!pgErr && !!pgRow)
        );
      }
    );
  });
};
