import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal Notice / Imprint | IRIS by DBR77",
  description:
    "Legal notice and imprint for DBR77. Company registration details, VAT information, and contact details for Poland and US entities.",
};

export default function ImprintPage() {
  return (
    <>
      <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">
        Legal Notice / Imprint
      </h1>
      <p className="text-[var(--text-muted)] text-sm mb-12">Effective: [DATE]</p>

      <div className="space-y-8">
        <section>
          <p>
            The following information is provided in accordance with applicable legal requirements, including the EU e-Commerce Directive (2000/31/EC) and Polish law on the provision of electronic services (Ustawa o świadczeniu usług drogą elektroniczną). This page identifies the entities responsible for operating the IRIS AI-Native Plant Operating System and the website at iris.dbr77.com.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            DBR77 Sp. z o.o. (Poland)
          </h2>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">Registered office:</strong>
          </p>
          <p className="mb-4">
            ul. Legnicka 55<br />
            54-203 Wrocław<br />
            Poland
          </p>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">Registration:</strong>
          </p>
          <ul className="list-none space-y-1 mb-4">
            <li>Registered in the National Court Register (KRS) maintained by the District Court for Wrocław-Fabryczna, VI Commercial Division</li>
            <li>KRS number: [TO BE FILLED]</li>
            <li>NIP (Tax Identification Number): [TO BE FILLED]</li>
            <li>REGON (Statistical Number): [TO BE FILLED]</li>
          </ul>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">Share capital:</strong> [TO BE FILLED] PLN
          </p>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">Management Board:</strong> [TO BE FILLED]
          </p>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">VAT EU:</strong> PL[TO BE FILLED]
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">Contact:</strong><br />
            Email:{" "}
            <a href="mailto:legal@dbr77.com" className="text-iris-violet hover:underline">
              legal@dbr77.com
            </a><br />
            General inquiries:{" "}
            <a href="mailto:support@dbr77.com" className="text-iris-violet hover:underline">
              support@dbr77.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            DBR77 Inc. (United States)
          </h2>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">Registered office:</strong>
          </p>
          <p className="mb-4">
            1234 Innovation Drive<br />
            Charlotte, NC 28202<br />
            United States
          </p>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">Registration:</strong>
          </p>
          <ul className="list-none space-y-1 mb-4">
            <li>Incorporated in the State of [TO BE FILLED]</li>
            <li>EIN (Employer Identification Number): [TO BE FILLED]</li>
          </ul>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">Directors:</strong> [TO BE FILLED]
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">Contact:</strong><br />
            Email:{" "}
            <a href="mailto:legal@dbr77.com" className="text-iris-violet hover:underline">
              legal@dbr77.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            Responsible for Content
          </h2>
          <p>
            The person responsible for the content of this website within the meaning of applicable press and media law is:
          </p>
          <p className="mt-4">
            [TO BE FILLED — Name and title of responsible person]<br />
            DBR77 Sp. z o.o.<br />
            ul. Legnicka 55, 54-203 Wrocław, Poland<br />
            Email:{" "}
            <a href="mailto:legal@dbr77.com" className="text-iris-violet hover:underline">
              legal@dbr77.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            Data Protection Officer
          </h2>
          <p>
            Our Data Protection Officer can be reached at:
          </p>
          <p className="mt-4">
            Email:{" "}
            <a href="mailto:dpo@dbr77.com" className="text-iris-violet hover:underline">
              dpo@dbr77.com
            </a><br />
            DBR77 Sp. z o.o.<br />
            ul. Legnicka 55, 54-203 Wrocław, Poland
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            Dispute Resolution
          </h2>
          <p className="mb-4">
            The European Commission provides a platform for online dispute resolution (ODR) for consumers:{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-iris-violet hover:underline"
            >
              https://ec.europa.eu/consumers/odr
            </a>.
          </p>
          <p>
            DBR77 is not obligated and not willing to participate in dispute resolution proceedings before a consumer arbitration board. For any disputes arising from the use of our Services, please refer to the dispute resolution provisions in our{" "}
            <a href="/legal/terms" className="text-iris-violet hover:underline">
              Terms of Service
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            Liability for Content
          </h2>
          <p className="mb-4">
            As a service provider, we are responsible for our own content on these pages in accordance with general laws. However, we are not obligated to monitor transmitted or stored third-party information or to investigate circumstances that indicate illegal activity.
          </p>
          <p>
            Obligations to remove or block the use of information under general laws remain unaffected. Liability in this regard is only possible from the time we become aware of a specific legal violation. Upon becoming aware of such violations, we will remove the content immediately.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            Liability for Links
          </h2>
          <p className="mb-4">
            Our website may contain links to external third-party websites over whose content we have no influence. We cannot accept any liability for the content of these external sites. The respective provider or operator of the linked pages is always responsible for the content of those pages.
          </p>
          <p>
            The linked pages were checked for possible legal violations at the time of linking. No illegal content was identifiable at the time the links were created. Permanent monitoring of the content of linked pages is not reasonable without concrete evidence of a legal violation. Upon becoming aware of any legal violations, we will remove such links immediately.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            Copyright
          </h2>
          <p>
            The content and works created by the operators of these pages are subject to copyright law. Reproduction, editing, distribution, and any kind of use beyond the limits of copyright law require the written consent of the respective author or creator. Downloads and copies of this website are only permitted for private, non-commercial use. Insofar as the content on this site was not created by the operator, the copyrights of third parties are respected and such content is identified as third-party content.
          </p>
        </section>
      </div>
    </>
  );
}
