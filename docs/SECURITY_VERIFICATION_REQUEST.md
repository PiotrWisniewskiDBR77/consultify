# Security Verification Request (Penetration Testing Scope)

**Project Name**: Consultinity Platform (Pre-Fork)
**Type**: Black/Grey Box Penetration Test
**Target Environment**: Staging (Cluster A)
**Codebase**: Node.js (Express), React, PostgreSQL, Redis

## 1. Objective
Perform a comprehensive security assessment to certify the platform for "Enterprise Readiness" and GDPR compliance before the planned application fork.

## 2. Scope

### A. Public Endpoints (Unauthenticated)
-   **Authentication**:
    -   `POST /api/auth/register` (Account creation)
    -   `POST /api/auth/login` (Credential handling, Rate Limiting)
    -   `POST /api/auth/forgot-password` (Token enumeration)
-   **Public Content**:
    -   `GET /api/public/demo` (Demo mode isolation)
    -   `GET /api/health/*` (Information disclosure)

### B. Authenticated Endpoints (Grey Box)
_Tester provided with: `User`, `Admin`, `SuperAdmin` credentials._

1.  **Multi-Tenancy Isolation**:
    -   Attempt to access `Organization B` data with `Organization A` token.
    -   Attempt to access `Project X` (private) as an unrelated user.
2.  **RBAC Enforcement**:
    -   Attempt vertical privilege escalation (User -> Admin).
    -   Attempt horizontal privilege escalation (User A -> User B).
3.  **Data Protection**:
    -   `POST /api/gdpr/export` (Verify PII leakage in export packages).
    -   `POST /api/gdpr/erase` (Verify implementation of "Right to be Forgotten").
4.  **Financial Integrity**:
    -   `POST /api/billing/subscription` (Attempt parameter tampering to bypass payment).

## 3. Flagged Risk Areas
-   **JWT Handling**: Verify token signing, expiration, and refresh rotation.
-   **AI Prompt Injection**: Test `/api/ai/*` endpoints for prompt leakage or unauthorized command execution.
-   **File Uploads**: Test profile picture and document uploaders for malware/RCE.

## 4. Deliverables
-   **Vulnerability Report**: CVSS scored findings (Critical, High, Medium, Low).
-   **Remediation Guidance**: Specific code fixes for identified issues.
-   **Re-test Certification**: "Clean" status after fixes.

## 5. Constraints
-   Testing must strictly observe the `Staging` environment.
-   No destructive testing (DoS) on shared infrastructure.
-   Testing Window: [Date TBD] - [Date TBD].
