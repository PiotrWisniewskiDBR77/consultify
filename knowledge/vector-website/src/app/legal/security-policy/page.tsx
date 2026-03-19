import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Policy | IRIS by DBR77",
  description:
    "IRIS Security Policy. Infrastructure security, data encryption, access control, incident response, compliance certifications, and responsible disclosure.",
};

export default function SecurityPolicyPage() {
  return (
    <>
      <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">Security Policy</h1>
      <p className="text-[var(--text-muted)] text-sm mb-12">Effective: [DATE]</p>

      <div className="space-y-8">
        <section>
          <p>
            At DBR77, security is foundational to everything we build. The IRIS AI-Native Plant Operating System handles critical industrial data, and we treat the protection of that data with the highest level of care. This Security Policy outlines the technical and organizational measures we implement to safeguard the IRIS platform and the data entrusted to us by our customers.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            1. Our Commitment
          </h2>
          <p>
            We are committed to maintaining the confidentiality, integrity, and availability of the IRIS platform and all Customer Data. Our security program is built on the principles of defense in depth, least privilege, and continuous improvement. We invest in security at every layer — from infrastructure and application design to employee training and incident response.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            2. Infrastructure Security
          </h2>
          <p className="mb-4">
            IRIS is hosted on enterprise-grade cloud infrastructure with the following safeguards:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Cloud hosting:</strong> production workloads run on SOC 2 and ISO 27001 certified cloud providers with data centers in the EU and the United States.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Network security:</strong> virtual private clouds (VPCs) with network segmentation, firewalls, intrusion detection systems (IDS), and DDoS protection.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Redundancy:</strong> multi-availability-zone deployments with automated failover to ensure high availability and disaster recovery.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Backups:</strong> automated, encrypted backups performed daily with point-in-time recovery capability. Backups are stored in geographically separate locations and tested regularly.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Container security:</strong> containerized workloads with image scanning, runtime protection, and immutable infrastructure practices.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            3. Data Encryption
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">In transit:</strong> all data transmitted between clients and the IRIS platform is encrypted using TLS 1.2 or higher (TLS 1.3 preferred). We enforce HSTS and use strong cipher suites.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">At rest:</strong> all Customer Data stored in databases, file storage, and backups is encrypted using AES-256 encryption. Encryption keys are managed through a dedicated key management service (KMS) with automatic key rotation.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Secrets management:</strong> API keys, credentials, and other secrets are stored in encrypted vaults and never committed to source code repositories.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            4. Access Control
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Authentication:</strong> JWT-based authentication with support for multi-factor authentication (MFA) and enterprise single sign-on (SSO) via SAML 2.0 and OpenID Connect.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Authorization:</strong> role-based access control (RBAC) with granular, field-level permissions. Customers can define custom roles tailored to their organizational structure.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Multi-tenancy:</strong> strict tenant isolation with row-level security policies ensuring that each customer&apos;s data is logically separated and inaccessible to other tenants.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Least privilege:</strong> internal access to production systems follows the principle of least privilege. Access is granted on a need-to-know basis, reviewed quarterly, and revoked promptly upon role change or departure.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">API security:</strong> API key management with rate limiting, IP allowlisting, and OAuth 2.0 scoped tokens for third-party integrations.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            5. Monitoring &amp; Logging
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Audit logging:</strong> comprehensive audit trails capture all user actions, administrative operations, and system events. Logs are immutable and retained for a minimum of 12 months.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Real-time monitoring:</strong> continuous monitoring of infrastructure, application performance, and security events with automated alerting for anomalies and potential threats.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">SIEM integration:</strong> security events are aggregated in a Security Information and Event Management (SIEM) system for correlation, analysis, and threat detection.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Uptime monitoring:</strong> 24/7 synthetic monitoring of all critical service endpoints with automated escalation procedures.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            6. Incident Response
          </h2>
          <p className="mb-4">
            We maintain a formal incident response plan that is tested and updated regularly. Our incident response process includes:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Detection:</strong> automated detection through monitoring, alerting, and anomaly detection systems.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Triage:</strong> incidents are classified by severity (P1–P4) and assigned to the appropriate response team.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Containment:</strong> immediate actions to contain the incident and prevent further impact.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Notification:</strong> affected customers are notified without undue delay and no later than 72 hours after becoming aware of a personal data breach, in accordance with GDPR Article 33. Notifications include the nature of the breach, likely consequences, and measures taken.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Remediation:</strong> root cause analysis, system remediation, and implementation of preventive measures.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Post-incident review:</strong> documented lessons learned and process improvements following every significant incident.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            7. Penetration Testing &amp; Vulnerability Management
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">External penetration testing:</strong> independent third-party penetration tests are conducted at least annually. Results and remediation plans are available to enterprise customers upon request under NDA.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Automated vulnerability scanning:</strong> continuous automated scanning of infrastructure, dependencies, and container images for known vulnerabilities.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Dependency management:</strong> automated monitoring of third-party libraries and dependencies for security advisories, with critical patches applied within 48 hours.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Secure development lifecycle:</strong> security reviews, code analysis, and threat modeling are integrated into our development process. All code changes undergo peer review before deployment.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            8. Compliance &amp; Certifications
          </h2>
          <p className="mb-4">
            We align our security program with recognized industry standards and frameworks:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">ISO 27001:</strong> our information security management system (ISMS) is aligned with ISO/IEC 27001 requirements. Certification status: [TO BE FILLED].
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">SOC 2 Type II:</strong> we are pursuing SOC 2 Type II certification covering security, availability, and confidentiality trust service criteria. Certification status: [TO BE FILLED].
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">IEC 62443:</strong> as an industrial automation platform, IRIS is designed with consideration for IEC 62443 (Industrial Automation and Control Systems Security) requirements, supporting customers in meeting their own compliance obligations.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">GDPR:</strong> full compliance with the EU General Data Protection Regulation, including data protection by design and by default.
            </li>
          </ul>
          <p className="mt-4">
            Copies of certifications and audit reports are available to enterprise customers upon request under NDA. Contact{" "}
            <a href="mailto:security@dbr77.com" className="text-iris-violet hover:underline">
              security@dbr77.com
            </a>{" "}
            for details.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            9. Responsible Disclosure
          </h2>
          <p className="mb-4">
            We welcome and appreciate responsible disclosure of security vulnerabilities. If you discover a potential security issue in the IRIS platform, please report it to us so we can address it promptly.
          </p>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">How to report:</strong> send a detailed report to{" "}
            <a href="mailto:security@dbr77.com" className="text-iris-violet hover:underline">
              security@dbr77.com
            </a>
            . Please include:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>A description of the vulnerability and its potential impact.</li>
            <li>Steps to reproduce the issue.</li>
            <li>Any proof-of-concept code or screenshots, if available.</li>
            <li>Your contact information for follow-up.</li>
          </ul>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Our commitment to reporters:</strong>
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>We will acknowledge receipt of your report within 48 hours.</li>
            <li>We will provide regular updates on the status of the investigation and remediation.</li>
            <li>We will not take legal action against researchers who report vulnerabilities in good faith and comply with this policy.</li>
            <li>We ask that you do not publicly disclose the vulnerability until we have had a reasonable opportunity to address it (typically 90 days).</li>
            <li>We ask that you do not access, modify, or delete data belonging to other users during your research.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            10. Contact
          </h2>
          <p className="mb-4">
            For security-related inquiries, vulnerability reports, or to request compliance documentation:
          </p>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">Security Team</strong><br />
            Email:{" "}
            <a href="mailto:security@dbr77.com" className="text-iris-violet hover:underline">
              security@dbr77.com
            </a>
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">DBR77 Sp. z o.o.</strong><br />
            ul. Legnicka 55, 54-203 Wrocław, Poland
          </p>
        </section>
      </div>
    </>
  );
}
