# 4. Security & Compliance

## 4.1. Identity & Access Management (IAM)

### Authentication
-   **Standard**: Email/Password (Bcrypt hashed with salt, cost factor 12).
-   **Token Strategy**: JWT (JSON Web Tokens).
    -   `AccessToken`: Short-lived (15 min).
    -   `RefreshToken`: Long-lived (7 days), HttpOnly, Secure, SameSite cookie.
-   **MFA**: Optional Time-based One-Time Password (TOTP) available for Enterprise plans.
-   **SSO**: Support for SAML 2.0 / OIDC (Okta, Azure AD) restricted to Enterprise tier.

### Password Policy
-   Minimum 12 characters.
-   Must contain: Uppercase, Lowercase, Number, Special Character.
-   No reuse of last 3 passwords.
-   Account lockout after 5 failed attempts (15-minute freeze).

## 4.2. Data Security

### Encryption
-   **At Rest**: All database disks and backups are encrypted via AES-256. Sensitive fields (API keys, PII) are column-encrypted.
-   **In Transit**: TLS 1.2+ forced for all HTTP traffic. HSTS enabled with long max-age.

### Key Management
-   Secrets (DB credentials, API keys) are injected via Environment Variables (`.env`).
-   Production keys must be managed via a secrets manager (e.g., AWS Secrets Manager, Vault) and NEVER committed to Git.

### Audit Logs
For Enterprise tenants, every write action is logged:
-   **Who**: User ID + IP Address.
-   **What**: Action (e.g., `INITIATIVE_UPDATE`).
-   **When**: UTC Timestamp.
-   **Context**: Resource ID.

## 4.3. Compliance Standards

### GDPR (General Data Protection Regulation)
-   **Right to serve**: Data is stored in EU-West (Frankfurt/Dublin) by default for EU clients.
-   **Right to be forgotten**: Automated script `anonymize_user(userId)` replaces PII with hash values while preserving statistical data integrity.
-   **Data Processing Agreement (DPA)**: Standard automated DPA available for all Pro/Enterprise clients.

### ISO 27001 (Target State)
The platform is designed with controls to support future ISO 27001 certification:
-   Logical access controls.
-   Change management procedures (Git flow).
-   Incident management plans.

### SOC 2 Type II
(Planned for Q4 2026). Currently, we adhere to "Trust Services Criteria" best practices but do not hold the attestation.
