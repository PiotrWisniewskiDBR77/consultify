import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Service Level Agreement | IRIS by DBR77",
  description:
    "IRIS Service Level Agreement. 99.9% uptime commitment, incident classification, response times, service credits, and maintenance windows.",
};

export default function SLAPage() {
  return (
    <>
      <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">
        Service Level Agreement
      </h1>
      <p className="text-[var(--text-muted)] text-sm mb-12">Effective: [DATE]</p>

      <div className="space-y-8">
        <section>
          <p>
            This Service Level Agreement (&quot;SLA&quot;) defines the service availability commitments, incident response standards, and remedies for the IRIS AI-Native Plant Operating System. This SLA applies to all customers with active, paid subscription plans (Professional and Enterprise tiers) and forms part of the Agreement between you and DBR77 Sp. z o.o.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            1. Service Availability
          </h2>
          <p className="mb-4">
            DBR77 commits to maintaining <strong className="text-[var(--text-primary)]">99.9% monthly uptime</strong> for the IRIS production Services (&quot;Uptime Commitment&quot;). Uptime is calculated as follows:
          </p>
          <p className="mb-4 bg-[var(--bg-secondary)] p-4 rounded-lg font-mono text-sm border border-[var(--border-color)]">
            Uptime % = ((Total Minutes in Month − Downtime Minutes) / Total Minutes in Month) × 100
          </p>
          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">&quot;Downtime&quot;</strong> means any period during which the IRIS core platform services (authentication, data ingestion, dashboard, API) are materially unavailable to all users, as measured by our external monitoring systems. A period of Downtime begins when DBR77 confirms the outage (or when our monitoring detects it, whichever is earlier) and ends when the service is restored.
          </p>
          <p>
            The 99.9% Uptime Commitment allows for a maximum of approximately 43 minutes of unplanned Downtime per month.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            2. Scheduled Maintenance
          </h2>
          <p className="mb-4">
            Scheduled maintenance is necessary to keep the Services secure, up to date, and performing optimally. The following terms apply:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Standard maintenance window:</strong> Sundays, 02:00–06:00 UTC. Most maintenance is performed during this window with zero or minimal downtime.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Advance notice:</strong> we provide at least 72 hours&apos; notice for scheduled maintenance that may cause service interruption, via email and in-app notification.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Emergency maintenance:</strong> critical security patches or urgent fixes may require maintenance outside the standard window. We will provide as much advance notice as reasonably possible (minimum 4 hours for non-critical emergencies).
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Exclusion:</strong> scheduled maintenance periods with proper advance notice are excluded from Downtime calculations.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            3. Incident Classification
          </h2>
          <p className="mb-4">
            Incidents are classified by severity to ensure appropriate prioritization and response:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse mb-4">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Severity</th>
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Definition</th>
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Examples</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">P1 — Critical</td>
                  <td className="py-3 pr-4">Complete service outage or critical functionality unavailable. Production operations severely impacted with no workaround.</td>
                  <td className="py-3 pr-4">Platform entirely down; data ingestion pipeline halted; authentication system failure.</td>
                </tr>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">P2 — High</td>
                  <td className="py-3 pr-4">Major feature significantly degraded or unavailable. Business operations impacted but a workaround exists.</td>
                  <td className="py-3 pr-4">Dashboard loading failures; API response times &gt;10× normal; report generation broken.</td>
                </tr>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">P3 — Medium</td>
                  <td className="py-3 pr-4">Minor feature impaired or intermittent issue. Limited business impact with an available workaround.</td>
                  <td className="py-3 pr-4">Intermittent UI errors; non-critical notification delays; minor display issues.</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">P4 — Low</td>
                  <td className="py-3 pr-4">General inquiry, documentation request, or enhancement suggestion. No immediate business impact.</td>
                  <td className="py-3 pr-4">Feature requests; how-to questions; cosmetic issues; documentation updates.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            4. Response and Resolution Times
          </h2>
          <p className="mb-4">
            Response and resolution targets vary by severity level and subscription tier:
          </p>

          <h3 className="text-xl font-medium text-[var(--text-primary)] mt-6 mb-3">
            Professional Tier
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse mb-6">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Severity</th>
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Initial Response</th>
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Status Updates</th>
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Target Resolution</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">P1</td>
                  <td className="py-3 pr-4">2 hours</td>
                  <td className="py-3 pr-4">Every 2 hours</td>
                  <td className="py-3 pr-4">8 hours</td>
                </tr>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">P2</td>
                  <td className="py-3 pr-4">8 hours</td>
                  <td className="py-3 pr-4">Every 8 hours</td>
                  <td className="py-3 pr-4">24 hours</td>
                </tr>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">P3</td>
                  <td className="py-3 pr-4">24 hours</td>
                  <td className="py-3 pr-4">Every 24 hours</td>
                  <td className="py-3 pr-4">5 business days</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">P4</td>
                  <td className="py-3 pr-4">48 hours</td>
                  <td className="py-3 pr-4">As needed</td>
                  <td className="py-3 pr-4">Best effort</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-xl font-medium text-[var(--text-primary)] mt-6 mb-3">
            Enterprise Tier
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse mb-4">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Severity</th>
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Initial Response</th>
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Status Updates</th>
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Target Resolution</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">P1</td>
                  <td className="py-3 pr-4">30 minutes</td>
                  <td className="py-3 pr-4">Every 1 hour</td>
                  <td className="py-3 pr-4">4 hours</td>
                </tr>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">P2</td>
                  <td className="py-3 pr-4">4 hours</td>
                  <td className="py-3 pr-4">Every 4 hours</td>
                  <td className="py-3 pr-4">12 hours</td>
                </tr>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">P3</td>
                  <td className="py-3 pr-4">8 hours</td>
                  <td className="py-3 pr-4">Every 12 hours</td>
                  <td className="py-3 pr-4">3 business days</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">P4</td>
                  <td className="py-3 pr-4">24 hours</td>
                  <td className="py-3 pr-4">As needed</td>
                  <td className="py-3 pr-4">Best effort</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-sm italic">
            Response times are measured during business hours (Monday–Friday, 08:00–18:00 CET) for P3 and P4 incidents. P1 and P2 incidents are covered 24/7 for Enterprise tier customers.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            5. Escalation
          </h2>
          <p className="mb-4">
            If you are not satisfied with the progress on an incident, you may escalate through the following channels:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Level 1 — Support Engineer:</strong> initial point of contact for all incidents. Available via the support portal and{" "}
              <a href="mailto:support@dbr77.com" className="text-iris-violet hover:underline">
                support@dbr77.com
              </a>.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Level 2 — Engineering Lead:</strong> escalation for P1/P2 incidents not resolved within target times, or when technical complexity requires senior involvement.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Level 3 — VP of Engineering:</strong> escalation for persistent P1 incidents or systemic issues affecting multiple customers.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Executive escalation:</strong> Enterprise customers may contact their designated Customer Success Manager or Account Executive for executive-level escalation.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            6. Service Credits
          </h2>
          <p className="mb-4">
            If we fail to meet the Uptime Commitment in any calendar month, you may be eligible for service credits as follows:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse mb-4">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Monthly Uptime</th>
                  <th className="py-3 pr-4 text-[var(--text-primary)] font-semibold">Service Credit (% of monthly fee)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-3 pr-4">99.0% – 99.9%</td>
                  <td className="py-3 pr-4">10%</td>
                </tr>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-3 pr-4">95.0% – 99.0%</td>
                  <td className="py-3 pr-4">25%</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Below 95.0%</td>
                  <td className="py-3 pr-4">50%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mb-4">
            <strong className="text-[var(--text-primary)]">How to claim:</strong> to receive service credits, you must submit a written request to{" "}
            <a href="mailto:support@dbr77.com" className="text-iris-violet hover:underline">
              support@dbr77.com
            </a>{" "}
            within thirty (30) days after the end of the month in which the Downtime occurred. The request must include the dates and times of the Downtime and a description of the impact.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Service credits are applied to future invoices and are not redeemable for cash.</li>
            <li>The maximum aggregate service credit for any single calendar month shall not exceed 50% of the monthly fee for the affected Services.</li>
            <li>Service credits are your sole and exclusive remedy for any failure to meet the Uptime Commitment.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            7. Exclusions
          </h2>
          <p className="mb-4">
            The Uptime Commitment and service credits do not apply to unavailability caused by:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Scheduled maintenance performed in accordance with Section 2.</li>
            <li>Force majeure events, including natural disasters, war, terrorism, pandemics, government actions, or widespread internet or utility failures.</li>
            <li>Actions or inactions of the Customer or its Authorized Users, including misconfiguration, unauthorized modifications, or excessive load beyond agreed capacity.</li>
            <li>Failures of third-party services, networks, or equipment not under DBR77&apos;s control.</li>
            <li>Free, trial, beta, or preview features and services.</li>
            <li>Customer-initiated downtime (e.g., requested data migrations, environment resets).</li>
            <li>DNS issues outside DBR77&apos;s managed infrastructure.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            8. Monitoring
          </h2>
          <p className="mb-4">
            We use the following monitoring practices to ensure service reliability:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">External synthetic monitoring:</strong> automated health checks from multiple geographic locations every 60 seconds.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Internal application monitoring:</strong> real-time metrics on latency, error rates, throughput, and resource utilization.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Status page:</strong> real-time service status is published at [TO BE FILLED — status page URL]. Customers can subscribe to email or webhook notifications for status updates.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Alerting:</strong> automated alerts trigger on-call response for any degradation detected by monitoring systems.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            9. Reporting
          </h2>
          <p className="mb-4">
            We provide the following reporting to help you track service performance:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Monthly uptime reports:</strong> available to all paid customers through the IRIS admin dashboard, showing monthly uptime percentage, incident history, and resolution details.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Incident post-mortems:</strong> for P1 and P2 incidents, we publish a root cause analysis (RCA) within five (5) business days of resolution, detailing the timeline, root cause, impact, and preventive measures.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Quarterly business reviews:</strong> Enterprise customers receive quarterly service reviews with their Customer Success Manager, covering SLA performance, support metrics, and roadmap updates.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            10. Contact
          </h2>
          <p className="mb-4">
            For support requests, incident reports, or SLA-related inquiries:
          </p>
          <p className="mb-2">
            <strong className="text-[var(--text-primary)]">Support</strong><br />
            Email:{" "}
            <a href="mailto:support@dbr77.com" className="text-iris-violet hover:underline">
              support@dbr77.com
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
