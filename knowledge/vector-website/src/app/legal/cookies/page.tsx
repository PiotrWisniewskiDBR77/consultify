import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy | IRIS by DBR77",
  description:
    "Cookie Policy for IRIS. Learn about the types of cookies we use and how to manage your preferences.",
};

export default function CookiesPage() {
  return (
    <>
      <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">Cookie Policy</h1>
      <p className="text-[var(--text-muted)] text-sm mb-12">Effective: [DATE]</p>

      <div className="space-y-8">
        <section>
          <p>
            This Cookie Policy explains how DBR77 Sp. z o.o. (&quot;DBR77&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) uses cookies and similar tracking technologies when you visit our website at iris.dbr77.com or use the IRIS AI-Native Plant Operating System (collectively, the &quot;Services&quot;). This policy should be read alongside our{" "}
            <a href="/legal/privacy" className="text-iris-violet hover:underline">
              Privacy Policy
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            1. What Are Cookies?
          </h2>
          <p className="mb-4">
            Cookies are small text files that are placed on your device (computer, tablet, or mobile phone) when you visit a website. They are widely used to make websites work efficiently, provide information to site owners, and enhance the user experience.
          </p>
          <p>
            In addition to cookies, we may use similar technologies such as web beacons (pixel tags), local storage, and session storage. References to &quot;cookies&quot; in this policy include these similar technologies unless otherwise stated.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            2. Cookies We Use
          </h2>

          <h3 className="text-xl font-medium text-[var(--text-primary)] mt-6 mb-3">
            Essential Cookies
          </h3>
          <p className="mb-2">
            These cookies are strictly necessary for the Services to function. They enable core functionality such as authentication, session management, security, and load balancing. Without these cookies, the Services cannot operate properly.
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>
              <strong className="text-[var(--text-primary)]">Session cookies:</strong> maintain your authenticated session while you use the platform.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">CSRF tokens:</strong> protect against cross-site request forgery attacks.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Load balancer cookies:</strong> ensure consistent routing to the correct server instance.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Cookie consent cookie:</strong> stores your cookie preferences so we can respect your choices.
            </li>
          </ul>
          <p className="text-sm italic">
            Legal basis: Legitimate interest — these cookies are necessary for the operation of the Services. You cannot opt out of essential cookies without affecting functionality.
          </p>

          <h3 className="text-xl font-medium text-[var(--text-primary)] mt-6 mb-3">
            Analytics Cookies
          </h3>
          <p className="mb-2">
            Analytics cookies help us understand how visitors interact with our website and Services. They collect information about pages visited, time spent, navigation paths, and error messages. This data is aggregated and used to improve the user experience.
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>
              <strong className="text-[var(--text-primary)]">PostHog:</strong> product analytics platform used to understand feature usage and user journeys. Data is processed in the EU.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Plausible Analytics:</strong> privacy-friendly website analytics that does not use cookies for basic metrics. No personal data is collected.
            </li>
          </ul>
          <p className="text-sm italic">
            Legal basis: Consent — analytics cookies are only set after you provide consent through our cookie banner.
          </p>

          <h3 className="text-xl font-medium text-[var(--text-primary)] mt-6 mb-3">
            Functional Cookies
          </h3>
          <p className="mb-2">
            Functional cookies enable enhanced features and personalization. They remember your preferences and settings to provide a more tailored experience.
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>
              <strong className="text-[var(--text-primary)]">Language preference:</strong> remembers your selected language across sessions.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Theme preference:</strong> stores your light/dark mode selection.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Dashboard layout:</strong> remembers your customized dashboard configuration.
            </li>
          </ul>
          <p className="text-sm italic">
            Legal basis: Consent — functional cookies are set based on your consent. Disabling them may reduce the personalization of your experience.
          </p>

          <h3 className="text-xl font-medium text-[var(--text-primary)] mt-6 mb-3">
            Marketing Cookies
          </h3>
          <p className="mb-2">
            Marketing cookies are used to track visitors across websites and display relevant advertisements. They help measure the effectiveness of our marketing campaigns.
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>
              <strong className="text-[var(--text-primary)]">LinkedIn Insight Tag:</strong> measures conversion rates from LinkedIn advertising campaigns and enables retargeting.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Google Ads:</strong> tracks conversions from Google advertising campaigns.
            </li>
          </ul>
          <p className="text-sm italic">
            Legal basis: Consent — marketing cookies are only set after you provide explicit consent. You can withdraw consent at any time.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            3. Managing Cookies
          </h2>
          <p className="mb-4">
            You have several options for controlling and managing cookies:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">Cookie consent banner:</strong> when you first visit our website, you can accept or reject non-essential cookies through our consent banner. You can change your preferences at any time by clicking the &quot;Cookie Settings&quot; link in the website footer.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Browser settings:</strong> most web browsers allow you to control cookies through their settings. You can set your browser to block cookies, delete existing cookies, or notify you when a cookie is being set. Refer to your browser&apos;s help documentation for instructions:
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>Chrome: Settings → Privacy and Security → Cookies</li>
                <li>Firefox: Settings → Privacy &amp; Security → Cookies</li>
                <li>Safari: Preferences → Privacy → Cookies</li>
                <li>Edge: Settings → Cookies and Site Permissions</li>
              </ul>
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Opt-out tools:</strong> you can opt out of interest-based advertising through industry tools such as the{" "}
              <a href="https://optout.networkadvertising.org/" target="_blank" rel="noopener noreferrer" className="text-iris-violet hover:underline">
                Network Advertising Initiative (NAI)
              </a>{" "}
              or the{" "}
              <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-iris-violet hover:underline">
                Digital Advertising Alliance (DAA)
              </a>.
            </li>
          </ul>
          <p className="mt-4">
            Please note that blocking or deleting essential cookies may prevent you from using certain features of the Services or cause them to function incorrectly.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            4. Third-Party Cookies
          </h2>
          <p className="mb-4">
            Some cookies are placed by third-party services that appear on our pages. We do not control these third-party cookies. Each third party has its own privacy and cookie policy. The third-party services we use that may set cookies include:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-[var(--text-primary)]">PostHog</strong> (product analytics) —{" "}
              <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer" className="text-iris-violet hover:underline">
                Privacy Policy
              </a>
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">LinkedIn</strong> (marketing and conversion tracking) —{" "}
              <a href="https://www.linkedin.com/legal/cookie-policy" target="_blank" rel="noopener noreferrer" className="text-iris-violet hover:underline">
                Cookie Policy
              </a>
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Google</strong> (advertising and analytics) —{" "}
              <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer" className="text-iris-violet hover:underline">
                Cookie Policy
              </a>
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">HubSpot</strong> (CRM and marketing automation) —{" "}
              <a href="https://legal.hubspot.com/cookie-policy" target="_blank" rel="noopener noreferrer" className="text-iris-violet hover:underline">
                Cookie Policy
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            5. Updates to This Cookie Policy
          </h2>
          <p>
            We may update this Cookie Policy from time to time to reflect changes in the cookies we use, changes in technology, or changes in applicable law. When we make material changes, we will update the &quot;Effective&quot; date at the top of this page and, where appropriate, notify you through our cookie consent banner or by email. We encourage you to review this policy periodically.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4">
            6. Contact
          </h2>
          <p>
            If you have questions about our use of cookies or this Cookie Policy, please contact our Data Protection Officer at{" "}
            <a href="mailto:dpo@dbr77.com" className="text-iris-violet hover:underline">
              dpo@dbr77.com
            </a>{" "}
            or write to us at:
          </p>
          <p className="mt-4">
            <strong className="text-[var(--text-primary)]">DBR77 Sp. z o.o.</strong><br />
            ul. Legnicka 55, 54-203 Wrocław, Poland
          </p>
        </section>
      </div>
    </>
  );
}
