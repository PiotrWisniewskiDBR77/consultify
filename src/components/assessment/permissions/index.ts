/**
 * Assessment Permissions Module
 *
 * Exports all permission-related components and hooks.
 */

export type { AssessmentPermissionContextValue } from './AssessmentPermissionContext';
export {
  AssessmentPermissionContext,
  AssessmentPermissionProvider,
  PermissionGate,
  useAssessmentPermissionContext,
} from './AssessmentPermissionContext';
export { RequestAccessModal } from './RequestAccessModal';
export type {
  AccessRequest,
  AssessmentPermissions,
  AssessmentRole,
  CreateAccessRequestParams,
  UseAssessmentPermissionsResult,
  UserRoleInfo,
} from './useAssessmentPermissions';
export {
  useAssessmentPermissions,
  default as useAssessmentPermissionsDefault,
} from './useAssessmentPermissions';
