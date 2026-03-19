import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Processing Agreement | IRIS by DBR77",
  description:
    "Data Processing Agreement (DPA) for IRIS. GDPR Article 28 compliant terms for processing personal data on behalf of customers.",
};

export default function DPAPage() {
  return (
    <>
      <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">
        Data Processing Agreement
      </h1>
      <p className="text-[var(--text-muted)] text-sm mb-12">Effective: [DATE]</p>

      <div className="space-y-8">
        <section>
          <p>
            This Data Processing Agreement (&quot;DPA&quot;) forms part of the Agreement between the Customer (&quot;Controller&quot;) and DBR77 Sp. z o.o. (&quot;Processor&quot;) for the provision of the IRIS AI-Native Plant Operating System (&quot;Services&quot;). This DPA is entered into pursuant to Article 28 of the EU General Data Protection Regulation (GDPR) and supplements the{" "}
            <a href="/legal/terms" className="text-iris-violet hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/legal/privacy" className="text-iris-violet hover:underline">
              Privacy Policy
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            1. Definitions
          </h2>
          <p className="mb-4">
            In this DPA, the following terms have the meanings set out below. Capitalized terms not defined here have the meanings given in the Terms of Service or the GDPR.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Controller&quot;</strong> means the Customer, who determines the purposes and means of processing Personal Data through the Services.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Processor&quot;</strong> means DBR77 Sp. z o.o., which processes Personal Data on behalf of the Controller in connection with the Services.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Personal Data&quot;</strong> means any information relating to an identified or identifiable natural person (&quot;Data Subject&quot;) that is processed by the Processor on behalf of the Controller through the Services.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Processing&quot;</strong> means any operation or set of operations performed on Personal Data, whether or not by automated means, including collection, recording, organization, structuring, storage, adaptation, alteration, retrieval, consultation, use, disclosure, dissemination, alignment, combination, restriction, erasure, or destruction.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Sub-processor&quot;</strong> means any third party engaged by the Processor to process Personal Data on behalf of the Controller.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Data Subject&quot;</strong> means the identified or identifiable natural person to whom the Personal Data relates.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Personal Data Breach&quot;</strong> means a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Personal Data.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Standard Contractual Clauses&quot; or &quot;SCCs&quot;</strong> means the standard contractual clauses for the transfer of personal data to processors established in third countries, as approved by the European Commission.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            2. Scope of Processing
          </h2>
          <p className="mb-4">
            The Processor shall process Personal Data on behalf of the Controller solely for the purpose of providing the Services as described in the Agreement. The details of processing are as follows:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Subject matter:</strong> provision of the IRIS AI-Native Plant Operating System, including data ingestion, processing, storage, analytics, and visualization of Customer Data.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Duration:</strong> the Subscription Term as defined in the Agreement, plus any post-termination data retention period.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Nature and purpose:</strong> hosting, processing, and analyzing Customer Data to provide the Services, including AI-driven analytics, alerting, and reporting.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Categories of Data Subjects:</strong> the Controller&apos;s employees, contractors, operators, plant personnel, and other individuals whose data is submitted to the Services.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Types of Personal Data:</strong> names, email addresses, job titles, employee identifiers, access logs, activity logs, and any other personal data the Controller submits to the Services.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            3. Obligations of the Processor
          </h2>
          <p className="mb-4">
            The Processor shall:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Process Personal Data only on documented instructions from the Controller, including with regard to transfers of Personal Data to a third country, unless required to do so by EU or Member State law — in which case the Processor shall inform the Controller of that legal requirement before processing, unless prohibited by law.</li>
            <li>Ensure that persons authorized to process Personal Data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality.</li>
            <li>Implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk, as described in Section 8 of this DPA and our{" "}
              <a href="/legal/security-policy" className="text-iris-violet hover:underline">
                Security Policy
              </a>.
            </li>
            <li>Respect the conditions for engaging Sub-processors as set out in Section 4.</li>
            <li>Assist the Controller, taking into account the nature of processing, by appropriate technical and organizational measures, insofar as possible, for the fulfillment of the Controller&apos;s obligation to respond to Data Subject requests.</li>
            <li>Assist the Controller in ensuring compliance with obligations under Articles 32 to 36 of the GDPR, taking into account the nature of processing and the information available to the Processor.</li>
            <li>At the choice of the Controller, delete or return all Personal Data to the Controller after the end of the provision of Services, and delete existing copies unless EU or Member State law requires storage of the Personal Data.</li>
            <li>Make available to the Controller all information necessary to demonstrate compliance with the obligations laid down in Article 28 of the GDPR and allow for and contribute to audits and inspections as set out in Section 9.</li>
            <li>Immediately inform the Controller if, in the Processor&apos;s opinion, an instruction infringes the GDPR or other EU or Member State data protection provisions.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            4. Sub-processors
          </h2>
          <p className="mb-4">
            The Controller provides general authorization for the Processor to engage Sub-processors to assist in providing the Services, subject to the following conditions:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The Processor shall maintain a current list of Sub-processors, which is available upon request by contacting{" "}
              <a href="mailto:dpo@dbr77.com" className="text-iris-violet hover:underline">
                dpo@dbr77.com
              </a>.
            </li>
            <li>The Processor shall notify the Controller at least thirty (30) days in advance of any intended addition or replacement of Sub-processors, giving the Controller the opportunity to object.</li>
            <li>If the Controller objects to a new Sub-processor on reasonable grounds related to data protection, the parties shall discuss the objection in good faith. If no resolution is reached within thirty (30) days, the Controller may terminate the affected Services without penalty.</li>
            <li>The Processor shall impose data protection obligations on each Sub-processor that are no less protective than those set out in this DPA, by way of a written contract.</li>
            <li>The Processor remains fully liable to the Controller for the performance of each Sub-processor&apos;s obligations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            5. Data Subject Rights
          </h2>
          <p className="mb-4">
            The Processor shall assist the Controller in fulfilling its obligations to respond to Data Subject requests under Chapter III of the GDPR (including rights of access, rectification, erasure, restriction, portability, and objection):
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The Processor shall promptly notify the Controller if it receives a request directly from a Data Subject, and shall not respond to such request except on the Controller&apos;s documented instructions or as required by applicable law.</li>
            <li>The Processor shall provide the Controller with self-service tools within the Services to facilitate Data Subject requests where technically feasible (e.g., data export, account deletion).</li>
            <li>Where self-service tools are insufficient, the Processor shall provide reasonable assistance to the Controller in responding to Data Subject requests within the timeframes required by the GDPR (typically one month).</li>
            <li>The Controller is responsible for the costs of any assistance beyond what is provided through standard self-service tools, unless the assistance is required due to the Processor&apos;s breach of this DPA.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            6. Data Transfers
          </h2>
          <p className="mb-4">
            The Processor shall not transfer Personal Data outside the European Economic Area (EEA) unless appropriate safeguards are in place:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Adequacy decisions:</strong> transfers to countries that have received an adequacy decision from the European Commission (Art. 45 GDPR).
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Standard Contractual Clauses:</strong> where no adequacy decision exists, the Processor shall enter into SCCs (Module 2: Controller to Processor or Module 3: Processor to Processor, as applicable) with the data importer.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Supplementary measures:</strong> where required by the Schrems II decision or subsequent guidance, the Processor shall implement supplementary technical and organizational measures to ensure an essentially equivalent level of protection.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">EU-US Data Privacy Framework:</strong> for transfers to the United States, the Processor may rely on the EU-US Data Privacy Framework where the data importer is certified.
            </li>
          </ul>
          <p className="mt-4">
            The Processor shall inform the Controller of the legal basis for any transfer and provide copies of relevant safeguards upon request.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            7. Personal Data Breach Notification
          </h2>
          <p className="mb-4">
            The Processor shall notify the Controller without undue delay, and in any event within 48 hours, after becoming aware of a Personal Data Breach. The notification shall include, to the extent known at the time:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>A description of the nature of the Personal Data Breach, including the categories and approximate number of Data Subjects and Personal Data records affected.</li>
            <li>The name and contact details of the Processor&apos;s point of contact for further information.</li>
            <li>A description of the likely consequences of the breach.</li>
            <li>A description of the measures taken or proposed to address the breach, including measures to mitigate its possible adverse effects.</li>
          </ul>
          <p className="mt-4">
            The Processor shall cooperate with the Controller and take reasonable steps to assist in the investigation, mitigation, and remediation of the breach. The Processor shall document all Personal Data Breaches, including the facts, effects, and remedial actions taken.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            8. Security Measures
          </h2>
          <p className="mb-4">
            The Processor implements and maintains the following technical and organizational security measures in accordance with Article 32 of the GDPR:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Encryption:</strong> AES-256 encryption at rest; TLS 1.2+ (TLS 1.3 preferred) in transit.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Access control:</strong> role-based access control (RBAC), multi-factor authentication (MFA), and single sign-on (SSO).
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Tenant isolation:</strong> row-level security ensuring logical separation of each Controller&apos;s data.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Network security:</strong> firewalls, intrusion detection, DDoS protection, and network segmentation.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Backup and recovery:</strong> automated encrypted backups with point-in-time recovery, stored in geographically separate locations.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Monitoring:</strong> continuous monitoring, audit logging, and SIEM-based threat detection.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Vulnerability management:</strong> regular penetration testing, automated vulnerability scanning, and timely patching.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Personnel:</strong> background checks for employees with access to Personal Data, mandatory security awareness training, and confidentiality agreements.
            </li>
          </ul>
          <p className="mt-4">
            Full details are available in our{" "}
            <a href="/legal/security-policy" className="text-iris-violet hover:underline">
              Security Policy
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            9. Audit Rights
          </h2>
          <p className="mb-4">
            The Controller has the right to audit the Processor&apos;s compliance with this DPA, subject to the following conditions:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The Controller shall provide at least thirty (30) days&apos; written notice of an audit request.</li>
            <li>Audits shall be conducted no more than once per twelve (12) month period, unless required by a supervisory authority or following a Personal Data Breach.</li>
            <li>The Processor may satisfy audit requests by providing: (a) copies of relevant third-party audit reports or certifications (e.g., SOC 2 Type II, ISO 27001); (b) responses to reasonable written questionnaires; or (c) access to the Processor&apos;s premises and systems during normal business hours.</li>
            <li>Audits shall be conducted in a manner that minimizes disruption to the Processor&apos;s operations and protects the confidentiality of other customers&apos; data.</li>
            <li>The Controller shall bear the costs of any audit, unless the audit reveals a material breach of this DPA by the Processor.</li>
            <li>Audit findings and reports shall be treated as Confidential Information of the Processor.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            10. Termination and Data Deletion
          </h2>
          <p className="mb-4">
            Upon termination or expiration of the Agreement:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The Processor shall, at the Controller&apos;s choice, return all Personal Data to the Controller in a standard, machine-readable format or delete all Personal Data, including all existing copies, within thirty (30) days of receiving the Controller&apos;s written instructions.</li>
            <li>If the Controller does not provide instructions within thirty (30) days of termination, the Processor shall delete all Personal Data and certify deletion in writing upon request.</li>
            <li>The Processor may retain Personal Data to the extent required by applicable EU or Member State law, in which case the Processor shall inform the Controller of the legal requirement and continue to protect the data in accordance with this DPA.</li>
            <li>The obligations under this DPA shall continue to apply to any Personal Data retained after termination.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            11. Liability
          </h2>
          <p className="mb-4">
            Each party&apos;s liability under this DPA is subject to the limitations of liability set out in the Agreement (Terms of Service), except that:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Nothing in this DPA limits either party&apos;s liability for breaches of data protection law to the extent such limitation is not permitted under applicable law.</li>
            <li>The Processor shall be liable for damage caused by processing only where it has not complied with obligations of the GDPR specifically directed to processors, or where it has acted outside of or contrary to the Controller&apos;s lawful instructions.</li>
            <li>Each party shall indemnify the other for any fines, penalties, or damages arising from the indemnifying party&apos;s breach of this DPA or applicable data protection law.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            12. Contact
          </h2>
          <p className="mb-4">
            For questions about this DPA, to request the Sub-processor list, or to exercise audit rights:
          </p>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">Data Protection Officer</strong><br />
            DBR77 Sp. z o.o.<br />
            ul. Legnicka 55, 54-203 Wrocław, Poland<br />
            Email:{" "}
            <a href="mailto:dpo@dbr77.com" className="text-iris-violet hover:underline">
              dpo@dbr77.com
            </a>
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">Legal inquiries:</strong>{" "}
            <a href="mailto:legal@dbr77.com" className="text-iris-violet hover:underline">
              legal@dbr77.com
            </a>
          </p>
        </section>
      </div>
    </>
  );
}
