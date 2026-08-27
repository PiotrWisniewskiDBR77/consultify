# Critical Services List

This generated document is a 2026-01-04 inventory of TypeScript application
service files and their conversion priority; it is not an infrastructure or
Railway service map. For deployment-critical environments and database targets,
use `docs/operations/RAILWAY_DB_TARGET_RULES.md`.

**Generated:** 2026-01-04T07:52:30.353Z

These services are critical for application functionality and should be converted with priority.

## Services

### adminSessionService

- **File:** `server/src/services/adminSessionService.ts`
- **Legacy:** `../../services/adminSessionService.js`
- **Pattern:** simple
- **Lines:** 15

### persistentSessionStore

- **File:** `server/src/services/ai/persistentSessionStore.ts`
- **Legacy:** `../../services/ai/persistentSessionStore.js`
- **Pattern:** simple
- **Lines:** 15

### demoSessionService

- **File:** `server/src/services/demoSessionService.ts`
- **Legacy:** `../../services/demoSessionService.js`
- **Pattern:** simple
- **Lines:** 15

### facilityUserService

- **File:** `server/src/services/facilityUserService.ts`
- **Legacy:** `../../services/facilityUserService.js`
- **Pattern:** simple
- **Lines:** 15

### clickupUserIntegration

- **File:** `server/src/services/integrations/clickupUserIntegration.ts`
- **Legacy:** `../../services/integrations/clickupUserIntegration.js`
- **Pattern:** simple
- **Lines:** 15

### jiraUserIntegration

- **File:** `server/src/services/integrations/jiraUserIntegration.ts`
- **Legacy:** `../../../services/integrations/jiraUserIntegration.js`
- **Pattern:** simple
- **Lines:** 15

### slackUserIntegration

- **File:** `server/src/services/integrations/slackUserIntegration.ts`
- **Legacy:** `../../services/integrations/slackUserIntegration.js`
- **Pattern:** simple
- **Lines:** 15

### teamsUserIntegration

- **File:** `server/src/services/integrations/teamsUserIntegration.ts`
- **Legacy:** `../../services/integrations/teamsUserIntegration.js`
- **Pattern:** simple
- **Lines:** 15

### oauthService

- **File:** `server/src/services/oauthService.ts`
- **Legacy:** `../../services/oauthService.js`
- **Pattern:** simple
- **Lines:** 15

### userGoals

- **File:** `server/src/services/userGoals.ts`
- **Legacy:** `../../services/userGoals.js`
- **Pattern:** simple
- **Lines:** 15

### userGroupService

- **File:** `server/src/services/userGroupService.ts`
- **Legacy:** `../../services/userGroupService.js`
- **Pattern:** simple
- **Lines:** 15

### userIntegrationService

- **File:** `server/src/services/userIntegrationService.ts`
- **Legacy:** `../../services/userIntegrationService.js`
- **Pattern:** simple
- **Lines:** 15

### userLicenseService

- **File:** `server/src/services/userLicenseService.ts`
- **Legacy:** `../../services/userLicenseService.js`
- **Pattern:** simple
- **Lines:** 15

### userNotificationPreferencesService

- **File:** `server/src/services/userNotificationPreferencesService.ts`
- **Legacy:** `../../services/userNotificationPreferencesService.js`
- **Pattern:** simple
- **Lines:** 15

### userPreferencesService

- **File:** `server/src/services/userPreferencesService.ts`
- **Legacy:** `../../services/userPreferencesService.js`
- **Pattern:** simple
- **Lines:** 15

### userProfileExtendedService

- **File:** `server/src/services/userProfileExtendedService.ts`
- **Legacy:** `../../services/userProfileExtendedService.js`
- **Pattern:** simple
- **Lines:** 15

### userSessionService

- **File:** `server/src/services/userSessionService.ts`
- **Legacy:** `../../services/userSessionService.js`
- **Pattern:** simple
- **Lines:** 15

### userStateMachine

- **File:** `server/src/services/userStateMachine.ts`
- **Legacy:** `../../services/userStateMachine.js`
- **Pattern:** simple
- **Lines:** 15

### webauthnService

- **File:** `server/src/services/webauthnService.ts`
- **Legacy:** `../../services/webauthnService.js`
- **Pattern:** simple
- **Lines:** 15

## Conversion Priority

1. Database-related services
2. Auth-related services
3. Billing/payment services
4. User/session services
5. Other critical services
