/**
 * PII Redactor Utility
 * Step 14: Governance, Security & Enterprise Controls
 *
 * Redacts personally identifiable information from audit logs and exports.
 * Ensures SOC2/ISO compliance for data privacy.
 */
export declare const DEFAULT_PII_FIELDS: readonly ["email", "name", "first_name", "firstName", "last_name", "lastName", "password", "token", "secret", "api_key", "apiKey", "access_token", "accessToken", "refresh_token", "refreshToken", "bearer", "authorization", "phone", "phone_number", "ssn", "credit_card", "creditCard"];
export declare const REDACTION_PLACEHOLDER = "[REDACTED]";
interface PiiRedactor {
    DEFAULT_PII_FIELDS: readonly string[];
    REDACTION_PLACEHOLDER: string;
    redact: <T>(obj: T, fieldsToRedact?: readonly string[]) => T;
    _redactRecursive: (obj: Record<string, unknown>, fieldsToRedact: readonly string[]) => void;
    redactEmails: (text: string) => string;
    redactTokens: (text: string) => string;
    redactKeys: <T extends Record<string, unknown>>(obj: T, keys: string[]) => T;
    createAuditSnapshot: (data: unknown) => string;
}
declare const PiiRedactor: PiiRedactor;
export default PiiRedactor;
//# sourceMappingURL=piiRedactor.d.ts.map