import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | IRIS by DBR77",
  description:
    "Terms of Service for the IRIS Plant Operating System. Read our SaaS terms covering account registration, subscriptions, acceptable use, and more.",
};

export default function TermsPage() {
  return (
    <>
      <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">Terms of Service</h1>
      <p className="text-[var(--text-muted)] text-sm mb-12">Effective: [DATE]</p>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            1. Definitions
          </h2>
          <p className="mb-4">
            In these Terms of Service (&quot;Terms&quot;), the following definitions apply:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Agreement&quot;</strong> means these Terms together with any Order Form, Data Processing Agreement, and Service Level Agreement executed between you and DBR77.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Customer&quot;, &quot;you&quot;, or &quot;your&quot;</strong> means the entity or individual that registers for or uses the Services.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Customer Data&quot;</strong> means all data, files, and content that you or your Authorized Users upload, submit, or transmit through the Services, including operational plant data, sensor readings, and configuration files.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;DBR77&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;</strong> means DBR77 Sp. z o.o., a company registered in Poland, and where applicable, its affiliate DBR77 Inc., registered in Charlotte, North Carolina, USA.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;IRIS&quot; or &quot;Services&quot;</strong> means the IRIS AI-Native Plant Operating System, including all associated software, APIs, documentation, and support services provided by DBR77.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Authorized User&quot;</strong> means any individual whom you authorize to access and use the Services under your account.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Order Form&quot;</strong> means the ordering document or online subscription page that specifies the Services, subscription tier, fees, and term agreed upon by the parties.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&quot;Subscription Term&quot;</strong> means the period during which you have an active, paid subscription to the Services as specified in your Order Form.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            2. Acceptance of Terms
          </h2>
          <p className="mb-4">
            By accessing, registering for, or using the IRIS Services, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you are entering into these Terms on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms, and references to &quot;you&quot; or &quot;Customer&quot; shall refer to that organization.
          </p>
          <p>
            If you do not agree to these Terms, you must not access or use the Services. We reserve the right to refuse service to anyone for any reason at any time.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            3. Account Registration
          </h2>
          <p className="mb-4">
            To access the Services, you must create an account by providing accurate, current, and complete registration information. You agree to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Maintain and promptly update your account information to keep it accurate and complete.</li>
            <li>Keep your login credentials confidential and not share them with unauthorized third parties.</li>
            <li>Accept responsibility for all activities that occur under your account, whether or not authorized by you.</li>
            <li>Notify us immediately at{" "}
              <a href="mailto:support@dbr77.com" className="text-iris-violet hover:underline">
                support@dbr77.com
              </a>{" "}
              if you suspect any unauthorized access to or use of your account.
            </li>
            <li>Ensure that each Authorized User has a unique account. Shared or generic login credentials are not permitted.</li>
          </ul>
          <p className="mt-4">
            We reserve the right to suspend or terminate accounts that contain inaccurate information or that we reasonably believe are being used in violation of these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            4. Subscription Plans and Payments
          </h2>
          <p className="mb-4">
            The Services are offered under various subscription plans as described on our website or in your Order Form. The following terms apply to all paid subscriptions:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Fees.</strong> Subscription fees are specified in your Order Form or on our pricing page. All fees are quoted in the currency stated and are exclusive of applicable taxes unless otherwise specified.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Billing cycle.</strong> Fees are billed in advance on a monthly or annual basis according to the billing cycle selected at the time of purchase.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Payment method.</strong> You authorize us to charge your designated payment method for all fees due. If payment fails, we may suspend access to the Services until payment is received.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Renewal.</strong> Subscriptions automatically renew at the end of each Subscription Term for successive periods of the same duration, unless either party provides written notice of non-renewal at least thirty (30) days before the end of the then-current term.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Price changes.</strong> We may adjust pricing for subsequent renewal terms by providing at least sixty (60) days&apos; written notice before the start of the next renewal period.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Refunds.</strong> Fees are non-refundable except as expressly stated in these Terms or as required by applicable law. If you terminate for our material, uncured breach, you are entitled to a pro-rata refund of prepaid fees for the unused portion of the Subscription Term.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Taxes.</strong> You are responsible for all applicable taxes, levies, and duties (excluding taxes based on DBR77&apos;s net income). If we are required to collect or remit taxes on your behalf, such taxes will be invoiced to you.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            5. Acceptable Use
          </h2>
          <p className="mb-4">
            You agree to use the Services only for lawful purposes and in accordance with these Terms. You and your Authorized Users shall not:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the Services in any way that violates applicable local, national, or international laws or regulations.</li>
            <li>Attempt to gain unauthorized access to the Services, other accounts, computer systems, or networks connected to the Services.</li>
            <li>Interfere with, disrupt, or place an unreasonable burden on the Services or the infrastructure supporting them.</li>
            <li>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Services, except to the extent expressly permitted by applicable law.</li>
            <li>Use the Services to transmit viruses, malware, or other harmful code.</li>
            <li>Resell, sublicense, or make the Services available to third parties unless expressly authorized in your Order Form.</li>
            <li>Use automated means (bots, scrapers, crawlers) to access the Services except through our published APIs in accordance with their documentation and rate limits.</li>
            <li>Remove, alter, or obscure any proprietary notices, labels, or marks on the Services.</li>
            <li>Use the Services to store or process data subject to specific regulatory regimes (e.g., ITAR, EAR) without our prior written consent.</li>
          </ul>
          <p className="mt-4">
            We reserve the right to investigate and take appropriate action against any violation of this section, including suspending or terminating your access and reporting violations to law enforcement authorities.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            6. Intellectual Property
          </h2>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Our IP.</strong> The Services, including all software, algorithms, AI models, user interfaces, documentation, trademarks, and other materials provided by DBR77, are and remain the exclusive property of DBR77 and its licensors. These Terms do not grant you any ownership rights in the Services. We grant you a limited, non-exclusive, non-transferable, non-sublicensable, revocable license to access and use the Services solely for your internal business purposes during the Subscription Term.
          </p>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Your data.</strong> You retain all ownership rights in your Customer Data. By using the Services, you grant DBR77 a limited license to host, process, and display your Customer Data solely as necessary to provide and improve the Services. We will not access your Customer Data except as required to deliver the Services, provide support at your request, or comply with applicable law.
          </p>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Aggregated data.</strong> We may collect and use aggregated, anonymized, and de-identified data derived from your use of the Services for purposes such as improving the Services, conducting research, and generating benchmarks. Such aggregated data will not identify you or any individual.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">Feedback.</strong> If you provide suggestions, ideas, or feedback regarding the Services, you grant DBR77 an unrestricted, perpetual, irrevocable, royalty-free license to use and incorporate such feedback into the Services without obligation to you.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            7. Data Processing
          </h2>
          <p className="mb-4">
            Our collection and processing of personal data is governed by our{" "}
            <a href="/legal/privacy" className="text-iris-violet hover:underline">
              Privacy Policy
            </a>
            . Where we process personal data on your behalf as a data processor, the terms of our{" "}
            <a href="/legal/dpa" className="text-iris-violet hover:underline">
              Data Processing Agreement
            </a>{" "}
            apply and are incorporated into these Terms by reference.
          </p>
          <p className="mb-4">
            You are responsible for ensuring that your use of the Services complies with all applicable data protection laws, including obtaining any necessary consents from data subjects whose personal data you submit to the Services.
          </p>
          <p>
            We implement appropriate technical and organizational measures to protect Customer Data as described in our{" "}
            <a href="/legal/security-policy" className="text-iris-violet hover:underline">
              Security Policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            8. Service Levels and Support
          </h2>
          <p>
            For customers on paid subscription plans, service availability commitments and support response times are governed by our{" "}
            <a href="/legal/sla" className="text-iris-violet hover:underline">
              Service Level Agreement
            </a>
            . The SLA is incorporated into these Terms by reference and forms part of the Agreement.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            9. Warranties and Disclaimers
          </h2>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Our warranty.</strong> We warrant that the Services will perform materially in accordance with the applicable documentation during the Subscription Term. If the Services fail to conform to this warranty, your sole remedy is for us to use commercially reasonable efforts to correct the non-conformity, or, if we are unable to do so within a reasonable period, to terminate your subscription and provide a pro-rata refund of prepaid fees.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">Disclaimer.</strong> Except for the express warranty above, the Services are provided &quot;as is&quot; and &quot;as available.&quot; To the maximum extent permitted by applicable law, DBR77 disclaims all other warranties, whether express, implied, or statutory, including implied warranties of merchantability, fitness for a particular purpose, non-infringement, and any warranties arising from course of dealing or usage of trade. We do not warrant that the Services will be uninterrupted, error-free, or free of harmful components.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            10. Limitation of Liability
          </h2>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Exclusion of indirect damages.</strong> To the maximum extent permitted by applicable law, neither party shall be liable to the other for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, goodwill, or business opportunity, regardless of the cause of action or the theory of liability, even if advised of the possibility of such damages.
          </p>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Cap on liability.</strong> Each party&apos;s total aggregate liability under or in connection with these Terms shall not exceed the total fees paid or payable by you to DBR77 during the twelve (12) months immediately preceding the event giving rise to the claim.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">Exceptions.</strong> The limitations above do not apply to: (a) either party&apos;s indemnification obligations; (b) your payment obligations; (c) either party&apos;s breach of confidentiality obligations; (d) your violation of our intellectual property rights; or (e) liability that cannot be limited under applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            11. Indemnification
          </h2>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">By DBR77.</strong> We will defend, indemnify, and hold you harmless from any third-party claim that the Services, as provided by us and used in accordance with these Terms, infringe a third party&apos;s intellectual property rights, and we will pay any damages finally awarded or settlement amounts approved by us.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">By you.</strong> You will defend, indemnify, and hold DBR77 harmless from any third-party claim arising from: (a) your Customer Data; (b) your use of the Services in violation of these Terms; or (c) your violation of applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            12. Termination
          </h2>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Termination for convenience.</strong> Either party may terminate the subscription by providing written notice of non-renewal at least thirty (30) days before the end of the then-current Subscription Term. Termination takes effect at the end of the current term.
          </p>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Termination for cause.</strong> Either party may terminate the Agreement immediately upon written notice if the other party: (a) materially breaches the Agreement and fails to cure such breach within thirty (30) days of receiving written notice; or (b) becomes subject to insolvency, bankruptcy, receivership, or similar proceedings.
          </p>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Effect of termination.</strong> Upon termination or expiration: (a) your right to access and use the Services ceases immediately; (b) you must pay any outstanding fees for the period up to and including the termination date; (c) each party must return or destroy the other party&apos;s Confidential Information upon request.
          </p>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Data export.</strong> Upon your request made within thirty (30) days after termination, we will make your Customer Data available for export in a standard, machine-readable format. After this 30-day period, we may delete your Customer Data in accordance with our data retention policies unless applicable law requires otherwise.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">Survival.</strong> Sections relating to Definitions, Intellectual Property, Limitation of Liability, Indemnification, Governing Law, and any provisions that by their nature should survive, will survive termination of these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            13. Governing Law
          </h2>
          <p className="mb-4">
            These Terms and any disputes arising out of or in connection with them shall be governed by and construed in accordance with the laws of the Republic of Poland, without regard to its conflict of law provisions. The courts of Wrocław, Poland shall have exclusive jurisdiction over any disputes, subject to the arbitration provisions below.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">US customers.</strong> If the Customer is domiciled in the United States and has entered into an Order Form with DBR77 Inc., the Agreement shall be governed by the laws of the State of North Carolina, USA, without regard to its conflict of law provisions.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            14. Dispute Resolution
          </h2>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">Informal resolution.</strong> Before initiating formal proceedings, the parties agree to attempt to resolve any dispute through good-faith negotiation for a period of at least thirty (30) days following written notice of the dispute.
          </p>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">EU/EEA customers.</strong> If informal resolution is unsuccessful, disputes shall be submitted to the exclusive jurisdiction of the courts of Wrocław, Poland.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">US customers.</strong> If informal resolution is unsuccessful and the Customer is domiciled in the United States, any dispute shall be resolved by binding arbitration administered by the American Arbitration Association (&quot;AAA&quot;) under its Commercial Arbitration Rules. The arbitration shall take place in Charlotte, North Carolina. The arbitrator&apos;s award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction. Each party waives any right to a jury trial.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            15. Changes to These Terms
          </h2>
          <p className="mb-4">
            We may update these Terms from time to time. If we make material changes, we will notify you by email to the address associated with your account or by posting a prominent notice within the Services at least thirty (30) days before the changes take effect.
          </p>
          <p>
            Your continued use of the Services after the effective date of the revised Terms constitutes your acceptance of the changes. If you do not agree to the revised Terms, you must stop using the Services and may terminate your subscription in accordance with Section 12.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            16. General Provisions
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Entire agreement.</strong> These Terms, together with the Order Form, DPA, SLA, and Privacy Policy, constitute the entire agreement between you and DBR77 regarding the Services and supersede all prior agreements and understandings.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Severability.</strong> If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Waiver.</strong> No failure or delay by either party in exercising any right under these Terms shall constitute a waiver of that right.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Assignment.</strong> You may not assign or transfer these Terms without our prior written consent. We may assign these Terms in connection with a merger, acquisition, or sale of all or substantially all of our assets.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Force majeure.</strong> Neither party shall be liable for any failure or delay in performance due to causes beyond its reasonable control, including natural disasters, war, terrorism, pandemics, labor disputes, government actions, or internet or utility failures.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Notices.</strong> All notices under these Terms must be in writing and sent to the email addresses specified in the Order Form or, for DBR77, to{" "}
              <a href="mailto:legal@dbr77.com" className="text-iris-violet hover:underline">
                legal@dbr77.com
              </a>.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            17. Contact
          </h2>
          <p className="mb-4">
            For questions about these Terms of Service, please contact us:
          </p>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">DBR77 Sp. z o.o.</strong><br />
            ul. Legnicka 55, 54-203 Wrocław, Poland<br />
            Email:{" "}
            <a href="mailto:legal@dbr77.com" className="text-iris-violet hover:underline">
              legal@dbr77.com
            </a>
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">DBR77 Inc.</strong><br />
            1234 Innovation Drive, Charlotte, NC 28202, USA<br />
            Email:{" "}
            <a href="mailto:legal@dbr77.com" className="text-iris-violet hover:underline">
              legal@dbr77.com
            </a>
          </p>
        </section>
      </div>
    </>
  );
}
