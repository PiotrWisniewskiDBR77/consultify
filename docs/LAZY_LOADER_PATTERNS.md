# Lazy Loader Analysis Report

**Generated:** 2026-01-04T07:52:30.352Z

## Summary

- **Total lazy loaders:** 314
- **Simple patterns:** 313 (auto-convertible)
- **Wrapper patterns:** 0
- **Conditional patterns:** 0
- **Complex patterns:** 1
- **Critical services:** 19
- **Circular dependencies:** 1

## Pattern Categories

### Simple (Auto-convertible)

These are just re-exports with no logic. Can be automatically converted.

```
- server/src/services/EmailVerificationService.ts → ../../services/EmailVerificationService.js
- server/src/services/EscalationService.ts → ../../services/escalationService.js
- server/src/services/MFAService.ts → ../../services/MFAService.js
- server/src/services/WhatsAppService.ts → ../../services/whatsappService.js
- server/src/services/adminAuditService.ts → ../../services/adminAuditService.js
- server/src/services/adminSessionService.ts → ../../services/adminSessionService.js
- server/src/services/ai/abTesting.ts → ../../services/ai/abTesting.js
- server/src/services/ai/actionExecutor.ts → ../../services/ai/actionExecutor.js
- server/src/services/ai/adaptiveResponseService.ts → ../../services/ai/adaptiveResponseService.js
- server/src/services/ai/agents/agentCoordinator.ts → ../../services/ai/agents/agentCoordinator.js
... and 303 more
```

### Critical Services

These services are critical for application functionality and should be converted first.

```
- server/src/services/adminSessionService.ts → ../../services/adminSessionService.js
- server/src/services/ai/persistentSessionStore.ts → ../../services/ai/persistentSessionStore.js
- server/src/services/demoSessionService.ts → ../../services/demoSessionService.js
- server/src/services/facilityUserService.ts → ../../services/facilityUserService.js
- server/src/services/integrations/clickupUserIntegration.ts → ../../services/integrations/clickupUserIntegration.js
- server/src/services/integrations/jiraUserIntegration.ts → ../../../services/integrations/jiraUserIntegration.js
- server/src/services/integrations/slackUserIntegration.ts → ../../services/integrations/slackUserIntegration.js
- server/src/services/integrations/teamsUserIntegration.ts → ../../services/integrations/teamsUserIntegration.js
- server/src/services/oauthService.ts → ../../services/oauthService.js
- server/src/services/userGoals.ts → ../../services/userGoals.js
- server/src/services/userGroupService.ts → ../../services/userGroupService.js
- server/src/services/userIntegrationService.ts → ../../services/userIntegrationService.js
- server/src/services/userLicenseService.ts → ../../services/userLicenseService.js
- server/src/services/userNotificationPreferencesService.ts → ../../services/userNotificationPreferencesService.js
- server/src/services/userPreferencesService.ts → ../../services/userPreferencesService.js
- server/src/services/userProfileExtendedService.ts → ../../services/userProfileExtendedService.js
- server/src/services/userSessionService.ts → ../../services/userSessionService.js
- server/src/services/userStateMachine.ts → ../../services/userStateMachine.js
- server/src/services/webauthnService.ts → ../../services/webauthnService.js

```

## Circular Dependencies

```
- index.js: 6 TS files

```

## Conversion Strategy

1. **Phase 1:** Convert 313 simple patterns automatically
2. **Phase 2:** Convert 19 critical services manually
3. **Phase 3:** Handle 1 circular dependencies
4. **Phase 4:** Convert remaining 1 complex patterns
