import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | IRIS by DBR77",
  description:
    "Privacy Policy for IRIS. Learn how we collect, use, and protect your data. GDPR compliant.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">Privacy Policy</h1>
      <p className="text-[var(--text-muted)] text-sm mb-12">Effective: February 1, 2026</p>

      <div className="space-y-8">
        <section>
          <p>
            This Privacy Policy explains how DBR77 Sp. z o.o. (&quot;DBR77&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, discloses, and protects personal data when you use the IRIS AI-Native Plant Operating System and our website at iris.dbr77.com (collectively, the &quot;Services&quot;). We are committed to protecting your privacy and processing your data in compliance with the EU General Data Protection Regulation (GDPR), the Polish Act on the Protection of Personal Data, and other applicable data protection laws.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            1. Data Controller
          </h2>
          <p className="mb-4">
            The data controller responsible for processing your personal data is:
          </p>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">DBR77 Sp. z o.o.</strong><br />
            ul. Legnicka 55, 54-203 Wrocław, Poland<br />
            KRS: 0000860440<br />
            NIP: 8792725331
          </p>
          <p>
            If you are a customer of DBR77 Inc. (our US entity), DBR77 Inc. may act as a joint controller for certain processing activities. In such cases, DBR77 Sp. z o.o. remains the lead controller for GDPR purposes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            2. Data We Collect
          </h2>
          <p className="mb-4">
            We collect the following categories of personal data:
          </p>

          <h3 className="text-xl font-medium text-[var(--text-primary)] mt-6 mb-3">
            Information you provide directly
          </h3>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>
              <strong className="text-[var(--text-primary)]">Account information:</strong> name, email address, job title, company name, phone number, and password when you register for an account.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Billing information:</strong> billing address, payment method details (processed by our payment processor — we do not store full payment card numbers).
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Communications:</strong> information you provide when you contact our support team, submit feedback, or participate in surveys.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Customer Data:</strong> operational plant data, sensor readings, configuration files, and other content you upload to the Services.
            </li>
          </ul>

          <h3 className="text-xl font-medium text-[var(--text-primary)] mt-6 mb-3">
            Information collected automatically
          </h3>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>
              <strong className="text-[var(--text-primary)]">Usage data:</strong> pages visited, features used, actions taken, timestamps, frequency and duration of use.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Device and technical data:</strong> IP address, browser type and version, operating system, device identifiers, screen resolution, and language preferences.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Log data:</strong> server logs, error reports, and performance metrics.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Cookies and similar technologies:</strong> as described in our{" "}
              <a href="/legal/cookies" className="text-iris-violet hover:underline">
                Cookie Policy
              </a>.
            </li>
          </ul>

          <h3 className="text-xl font-medium text-[var(--text-primary)] mt-6 mb-3">
            Information from third parties
          </h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Single sign-on providers:</strong> if you authenticate using Google, Microsoft, or another SSO provider, we receive your name, email, and profile picture from that provider.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Business partners:</strong> we may receive contact information from partners who refer you to our Services.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            3. Legal Basis for Processing (GDPR)
          </h2>
          <p className="mb-4">
            For individuals in the European Economic Area (EEA), we process personal data on the following legal bases:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Performance of a contract (Art. 6(1)(b) GDPR):</strong> processing necessary to provide the Services, manage your account, process payments, and deliver customer support.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Legitimate interests (Art. 6(1)(f) GDPR):</strong> processing necessary for our legitimate interests, including improving the Services, ensuring security, preventing fraud, conducting analytics, and marketing our products to existing customers. We balance these interests against your rights and freedoms.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Consent (Art. 6(1)(a) GDPR):</strong> where we rely on your consent, such as for non-essential cookies, marketing communications, or processing of special categories of data. You may withdraw consent at any time.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Legal obligation (Art. 6(1)(c) GDPR):</strong> processing necessary to comply with legal obligations, such as tax reporting, regulatory requirements, or responding to lawful requests from public authorities.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            4. How We Use Your Data
          </h2>
          <p className="mb-4">
            We use personal data for the following purposes:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Service delivery:</strong> to provide, operate, maintain, and improve the IRIS platform and related services.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Account management:</strong> to create and manage your account, authenticate users, and process transactions.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Communication:</strong> to send you service-related notices, respond to your inquiries, and provide customer support.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Analytics and improvement:</strong> to understand how the Services are used, identify trends, and improve functionality and user experience.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Security:</strong> to detect, prevent, and respond to fraud, abuse, security incidents, and technical issues.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Marketing:</strong> to send you information about products, features, and events that may be of interest (with your consent where required). You can opt out at any time.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Legal compliance:</strong> to comply with applicable laws, regulations, and legal processes.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Aggregated insights:</strong> to create anonymized, aggregated data for benchmarking, research, and product development. This data does not identify any individual.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            5. Data Sharing and Disclosure
          </h2>
          <p className="mb-4">
            We do not sell your personal data. We may share personal data with the following categories of recipients:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Affiliates:</strong> DBR77 Inc. and other DBR77 group entities, subject to this Privacy Policy.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Service providers:</strong> third-party vendors who assist us in operating the Services (e.g., cloud hosting, payment processing, analytics, customer support tools). These providers are bound by data processing agreements and may only process data on our behalf and in accordance with our instructions.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Professional advisors:</strong> lawyers, auditors, and consultants where necessary for the operation of our business.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Law enforcement and regulators:</strong> where required by applicable law, regulation, legal process, or governmental request.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Business transfers:</strong> in connection with a merger, acquisition, reorganization, or sale of assets, your data may be transferred to the acquiring entity.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            6. International Data Transfers
          </h2>
          <p className="mb-4">
            Your personal data may be transferred to and processed in countries outside the European Economic Area (EEA), including the United States. When we transfer data outside the EEA, we ensure appropriate safeguards are in place, including:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>European Commission adequacy decisions (Art. 45 GDPR).</li>
            <li>Standard Contractual Clauses (SCCs) approved by the European Commission (Art. 46(2)(c) GDPR).</li>
            <li>Binding Corporate Rules where applicable.</li>
            <li>The EU-US Data Privacy Framework, where the recipient is certified.</li>
          </ul>
          <p className="mt-4">
            You may request a copy of the safeguards we use by contacting our Data Protection Officer at{" "}
            <a href="mailto:dpo@dbr77.com" className="text-iris-violet hover:underline">
              dpo@dbr77.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            7. Data Retention
          </h2>
          <p className="mb-4">
            We retain personal data only for as long as necessary to fulfill the purposes for which it was collected, or as required by applicable law. Our general retention periods are:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Account data:</strong> retained for the duration of your account and for up to 12 months after account closure for legitimate business purposes (e.g., resolving disputes, enforcing agreements).
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Customer Data:</strong> retained for the duration of your subscription. Upon termination, Customer Data is available for export for 30 days and then deleted, unless applicable law requires otherwise.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Billing records:</strong> retained for the period required by applicable tax and accounting laws (typically 5–10 years).
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Usage and log data:</strong> retained for up to 24 months for analytics and security purposes, then anonymized or deleted.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Marketing data:</strong> retained until you withdraw consent or opt out, plus a suppression record to honor your preference.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            8. Your Rights (GDPR)
          </h2>
          <p className="mb-4">
            If you are located in the EEA or the UK, you have the following rights under the GDPR:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Right of access (Art. 15):</strong> request a copy of the personal data we hold about you.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to rectification (Art. 16):</strong> request correction of inaccurate or incomplete personal data.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to erasure (Art. 17):</strong> request deletion of your personal data where there is no compelling reason for continued processing.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to restriction (Art. 18):</strong> request that we restrict processing of your personal data in certain circumstances.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to data portability (Art. 20):</strong> receive your personal data in a structured, commonly used, machine-readable format.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to object (Art. 21):</strong> object to processing based on legitimate interests or for direct marketing purposes.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to withdraw consent (Art. 7(3)):</strong> withdraw consent at any time where processing is based on consent, without affecting the lawfulness of prior processing.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to lodge a complaint:</strong> file a complaint with a supervisory authority. The lead supervisory authority for DBR77 is the President of the Personal Data Protection Office (UODO) in Poland.
            </li>
          </ul>
          <p className="mt-4">
            To exercise any of these rights, please contact our Data Protection Officer at{" "}
            <a href="mailto:dpo@dbr77.com" className="text-iris-violet hover:underline">
              dpo@dbr77.com
            </a>
            . We will respond to your request within one (1) month, or inform you if an extension is needed.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            9. Cookies
          </h2>
          <p>
            We use cookies and similar tracking technologies on our website and within the Services. For detailed information about the types of cookies we use, their purposes, and how to manage your preferences, please see our{" "}
            <a href="/legal/cookies" className="text-iris-violet hover:underline">
              Cookie Policy
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            10. Children&apos;s Privacy
          </h2>
          <p>
            The Services are not directed to individuals under the age of 16, and we do not knowingly collect personal data from children. If we become aware that we have collected personal data from a child under 16 without verification of parental consent, we will take steps to delete that information promptly. If you believe we may have collected data from a child, please contact us at{" "}
            <a href="mailto:dpo@dbr77.com" className="text-iris-violet hover:underline">
              dpo@dbr77.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            11. Changes to This Privacy Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. If we make material changes, we will notify you by email or by posting a prominent notice on our website at least thirty (30) days before the changes take effect. We encourage you to review this page periodically. The &quot;Effective&quot; date at the top indicates when this policy was last revised.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            12. Contact &amp; Data Protection Officer
          </h2>
          <p className="mb-4">
            If you have questions about this Privacy Policy or wish to exercise your data protection rights, please contact:
          </p>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Data Protection Officer</strong><br />
            DBR77 Sp. z o.o.<br />
            ul. Legnicka 55, 54-203 Wrocław, Poland<br />
            Email:{" "}
            <a href="mailto:dpo@dbr77.com" className="text-iris-violet hover:underline">
              dpo@dbr77.com
            </a>
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">General inquiries:</strong>{" "}
            <a href="mailto:legal@dbr77.com" className="text-iris-violet hover:underline">
              legal@dbr77.com
            </a>
          </p>
        </section>
      </div>
    </>
  );
}
