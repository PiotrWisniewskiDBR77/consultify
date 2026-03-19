"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Shield,
  Lock,
  KeyRound,
  ShieldCheck,
  Network,
  FileCheck,
  Cloud,
  Server,
  Factory,
  Award,
  FileText,
  Calendar,
  ShieldAlert,
  Bug,
  Users,
  AlertTriangle,
  Siren,
  Fingerprint,
} from "lucide-react";

const SECURITY_FEATURES = [
  {
    icon: Shield,
    title: "Multi-Tenant Isolation",
    description:
      "Row-level security ensures every tenant's data is completely isolated. No cross-tenant access is architecturally possible — ever.",
  },
  {
    icon: Lock,
    title: "AES-256 Encryption",
    description:
      "All data is encrypted at rest and in transit using AES-256. TLS 1.3 secures every connection between your browser, our APIs, and our databases.",
  },
  {
    icon: KeyRound,
    title: "Authentication & SSO",
    description:
      "JWT-based authentication with two-factor authentication (2FA). Google and LinkedIn SSO supported out of the box.",
  },
  {
    icon: Fingerprint,
    title: "Role-Based Access Control",
    description:
      "Granular RBAC with field-level permissions. Define exactly who can see, edit, or approve data — down to individual attributes.",
  },
  {
    icon: Network,
    title: "API Security",
    description:
      "API key management, rate limiting, and IP whitelisting. Every API call is authenticated, logged, and throttled to prevent abuse.",
  },
  {
    icon: FileCheck,
    title: "Audit Logging",
    description:
      "Immutable audit trail of every user action, data change, and system event. Full traceability for compliance and forensic analysis.",
  },
];

const COMPLIANCE_CARDS = [
  {
    icon: Award,
    title: "ISO 27001",
    description:
      "Certified information security management system. Independently audited annually.",
  },
  {
    icon: Award,
    title: "SOC 2 Type II",
    description:
      "Independent audit of security, availability, and confidentiality controls.",
  },
  {
    icon: Award,
    title: "GDPR Compliant",
    description:
      "Full compliance with EU data protection regulation. Data subject rights, DPO, and breach notification procedures in place.",
  },
  {
    icon: ShieldCheck,
    title: "IEC 62443",
    description:
      "Aligned with the international standard for industrial automation and control systems cybersecurity.",
  },
  {
    icon: Server,
    title: "Data Residency",
    description:
      "Choose where your data lives: EU, US, GCC, or Japan. Full control over data sovereignty.",
  },
];

const PROTECTION_FEATURES = [
  {
    icon: ShieldAlert,
    title: "DDoS Protection",
    description:
      "Multi-layer DDoS mitigation absorbs volumetric, protocol, and application-layer attacks before they reach your instance.",
  },
  {
    icon: Network,
    title: "Web Application Firewall",
    description:
      "WAF rules tuned for industrial SaaS workloads. Blocks OWASP Top 10 threats, SQL injection, XSS, and zero-day exploits.",
  },
  {
    icon: Bug,
    title: "Penetration Testing",
    description:
      "Regular third-party penetration tests and vulnerability assessments. Findings are remediated within defined SLA windows.",
  },
  {
    icon: Siren,
    title: "Incident Response",
    description:
      "Documented incident response procedures with defined escalation paths, communication protocols, and post-incident reviews.",
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export default function SecurityPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);
  const ref5 = useRef<HTMLDivElement>(null);
  const ref6 = useRef<HTMLDivElement>(null);
  const ref7 = useRef<HTMLDivElement>(null);
  const ref8 = useRef<HTMLDivElement>(null);
  const isInView1 = useInView(ref1, { once: true, margin: "-80px" });
  const isInView2 = useInView(ref2, { once: true, margin: "-80px" });
  const isInView3 = useInView(ref3, { once: true, margin: "-80px" });
  const isInView4 = useInView(ref4, { once: true, margin: "-80px" });
  const isInView5 = useInView(ref5, { once: true, margin: "-80px" });
  const isInView6 = useInView(ref6, { once: true, margin: "-80px" });
  const isInView7 = useInView(ref7, { once: true, margin: "-80px" });
  const isInView8 = useInView(ref8, { once: true, margin: "-80px" });

  return (
    <>
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-24 sm:pb-32",
          isLight ? "bg-white" : "bg-navy-950",
          !isLight && "bg-gradient-hero",
          !isLight && "grid-pattern"
        )}
      >
        <Image
          src="/images/platform/security-hero.png"
          alt=""
          role="presentation"
          fill
          className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")}
          quality={75}
          priority
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(147,51,234,0.2)_0%,transparent_60%)] pointer-events-none" />
        <Container size="lg" className="relative z-10">
          <div ref={ref1}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView1 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center max-w-4xl mx-auto"
            >
              <h1
                className={cn(
                  "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                Security Is Foundational, Not Optional.
              </h1>
              <p
                className={cn(
                  "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                Manufacturing is a high-value target. IRIS is built from the
                ground up with enterprise-grade security — so you can digitize
                operations without compromising on protection.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Badge variant="purple" className="text-sm px-4 py-1.5">
                  ISO 27001
                </Badge>
                <Badge variant="purple" className="text-sm px-4 py-1.5">
                  SOC 2
                </Badge>
                <Badge variant="purple" className="text-sm px-4 py-1.5">
                  GDPR
                </Badge>
                <Badge variant="purple" className="text-sm px-4 py-1.5">
                  IEC 62443
                </Badge>
                <Badge variant="purple" className="text-sm px-4 py-1.5">
                  AES-256
                </Badge>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Technical Security */}
      <Section variant="alternate">
        <Container>
          <div ref={ref2}>
            <SectionHeader
              label="Platform Security"
              title="Enterprise-Grade Architecture"
              description="Every layer of IRIS — from authentication to data storage — is designed with defense in depth. No shortcuts, no afterthoughts."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView2 ? "animate" : "initial"}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {SECURITY_FEATURES.map(({ icon: Icon, title, description }) => (
                <motion.div key={title} variants={fadeInUp}>
                  <Card variant="glow" padding="md" className="h-full">
                    <div className="text-iris-violet">
                      <Icon className="h-6 w-6" aria-hidden />
                    </div>
                    <h3
                      className={cn(
                        "font-semibold mt-3",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {title}
                    </h3>
                    <p
                      className={cn(
                        "text-sm leading-relaxed mt-2",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      {description}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Threat Protection */}
      <Section variant="default">
        <Container>
          <div ref={ref3}>
            <SectionHeader
              label="Active Defense"
              title="Proactive Threat Protection"
              description="We don't wait for incidents — we prevent them. Continuous monitoring, regular testing, and layered defenses keep your operations safe."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView3 ? "animate" : "initial"}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto"
            >
              {PROTECTION_FEATURES.map(
                ({ icon: Icon, title, description }) => (
                  <motion.div key={title} variants={fadeInUp}>
                    <Card variant="glow" padding="md" className="h-full">
                      <div className="text-iris-cyan">
                        <Icon className="h-6 w-6" aria-hidden />
                      </div>
                      <h3
                        className={cn(
                          "font-semibold mt-3",
                          isLight ? "text-slate-900" : "text-white"
                        )}
                      >
                        {title}
                      </h3>
                      <p
                        className={cn(
                          "text-sm leading-relaxed mt-2",
                          isLight ? "text-slate-600" : "text-slate-400"
                        )}
                      >
                        {description}
                      </p>
                    </Card>
                  </motion.div>
                )
              )}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Infrastructure */}
      <Section variant="alternate">
        <Container>
          <div ref={ref4}>
            <SectionHeader
              label="Infrastructure"
              title="Cloud-First. On-Premise When It Matters."
              description="Your data, your rules. Choose where it lives — and whether AI workloads stay entirely within your network."
              align="center"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView4 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-3xl mx-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card
                  variant="default"
                  padding="md"
                  className="flex items-start gap-3"
                >
                  <Cloud className="h-6 w-6 text-iris-cyan flex-shrink-0 mt-0.5" />
                  <div>
                    <h3
                      className={cn(
                        "font-semibold",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      Multi-Region Deployment
                    </h3>
                    <p
                      className={cn(
                        "text-sm mt-1",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      EU, US, GCC, Japan — choose where your data lives to meet
                      local regulations and latency requirements.
                    </p>
                  </div>
                </Card>
                <Card
                  variant="default"
                  padding="md"
                  className="flex items-start gap-3"
                >
                  <Shield className="h-6 w-6 text-iris-green flex-shrink-0 mt-0.5" />
                  <div>
                    <h3
                      className={cn(
                        "font-semibold",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      Tenant-Isolated Backups
                    </h3>
                    <p
                      className={cn(
                        "text-sm mt-1",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      Every tenant gets isolated, encrypted backups. Your
                      disaster recovery is independent of other customers.
                    </p>
                  </div>
                </Card>
                <Card
                  variant="default"
                  padding="md"
                  className="flex items-start gap-3 sm:col-span-2"
                >
                  <Server className="h-6 w-6 text-iris-violet flex-shrink-0 mt-0.5" />
                  <div>
                    <h3
                      className={cn(
                        "font-semibold",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      On-Premise LLM Deployment (LLMind)
                    </h3>
                    <p
                      className={cn(
                        "text-sm mt-1",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      Deploy IRIS AI models on your own infrastructure. Your
                      production data never leaves your network — full
                      sovereignty over AI workloads.
                    </p>
                  </div>
                </Card>
                <Card
                  variant="default"
                  padding="md"
                  className="flex items-start gap-3 sm:col-span-2"
                >
                  <Lock className="h-6 w-6 text-iris-purple flex-shrink-0 mt-0.5" />
                  <div>
                    <h3
                      className={cn(
                        "font-semibold",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      Data Residency Controls
                    </h3>
                    <p
                      className={cn(
                        "text-sm mt-1",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      Full control over where your production and analytics data
                      is stored and processed. Meet GDPR, local data protection
                      laws, and corporate policies.
                    </p>
                  </div>
                </Card>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Cybersecurity as a Process */}
      <Section variant="default">
        <Container>
          <div ref={ref5}>
            <SectionHeader
              label="Our Philosophy"
              title="Technology Alone Doesn't Protect Factories."
              description="Real cybersecurity is organizational maturity, process discipline, and continuous training. IRIS provides the technology foundation — but preparedness starts with people and culture."
              align="center"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView5 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto text-center"
            >
              <p className="text-xl font-medium text-iris-violet">
                Cyberattacks on manufacturing will only increase. Preparation is
                your competitive advantage.
              </p>
              <p
                className={cn(
                  "mt-6 leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                Security is not a feature you bolt on — it&apos;s a discipline
                you build. IRIS gives you the tools: encryption, access control,
                audit trails, and compliance frameworks. You bring the
                commitment to train your teams, enforce processes, and foster a
                security-first culture.
              </p>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* IoT / OT Security */}
      <Section variant="alternate">
        <Container>
          <div ref={ref6}>
            <SectionHeader
              label="OT Security"
              title="Securing the Shop Floor Connection"
              description="Connecting machines to the cloud introduces new attack surfaces. IRIS bridges IT and OT with purpose-built security controls."
              align="center"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView6 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <Card variant="glow" padding="md">
                <Factory className="h-6 w-6 text-iris-cyan mb-3" />
                <h3
                  className={cn(
                    "font-semibold",
                    isLight ? "text-slate-900" : "text-white"
                  )}
                >
                  IT/OT Bridge
                </h3>
                <p
                  className={cn(
                    "text-sm mt-2",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  Secure, encrypted bridge between IT and OT networks. Data
                  flows one way — from the shop floor to the cloud — minimizing
                  the attack surface.
                </p>
              </Card>
              <Card variant="glow" padding="md">
                <Server className="h-6 w-6 text-iris-violet mb-3" />
                <h3
                  className={cn(
                    "font-semibold",
                    isLight ? "text-slate-900" : "text-white"
                  )}
                >
                  Purpose-Built Edge Devices
                </h3>
                <p
                  className={cn(
                    "text-sm mt-2",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  Hardened edge hardware designed for industrial environments.
                  Tamper-resistant, remotely updatable, and isolated from the
                  corporate network.
                </p>
              </Card>
              <Card variant="glow" padding="md">
                <ShieldCheck className="h-6 w-6 text-iris-green mb-3" />
                <h3
                  className={cn(
                    "font-semibold",
                    isLight ? "text-slate-900" : "text-white"
                  )}
                >
                  End-to-End Sensor Encryption
                </h3>
                <p
                  className={cn(
                    "text-sm mt-2",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  Sensor data is encrypted from the moment it leaves the machine
                  to the moment it reaches your IRIS dashboard. No plaintext,
                  ever.
                </p>
              </Card>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Compliance */}
      <Section variant="default">
        <Container>
          <div ref={ref7}>
            <SectionHeader
              label="Compliance"
              title="Certifications & Standards"
              description="We hold ourselves to the highest standards — and prove it with independent audits and certifications."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView7 ? "animate" : "initial"}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto"
            >
              {COMPLIANCE_CARDS.map(({ icon: Icon, title, description }) => (
                <motion.div key={title} variants={fadeInUp}>
                  <Card variant="default" padding="md" className="h-full">
                    <div className="text-iris-violet">
                      <Icon className="h-6 w-6" aria-hidden />
                    </div>
                    <h3
                      className={cn(
                        "font-semibold mt-3",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {title}
                    </h3>
                    <p
                      className={cn(
                        "text-sm leading-relaxed mt-2",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      {description}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section variant="alternate" padding="xl">
        <Container>
          <div ref={ref8}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView8 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-center max-w-2xl mx-auto"
            >
              <h2
                className={cn(
                  "text-3xl sm:text-4xl font-bold tracking-tight",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                Ready for a Deep Dive?
              </h2>
              <p
                className={cn(
                  "mt-4 leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                Download our security whitepaper or schedule a dedicated review
                with our security team. We&apos;re happy to answer every
                question.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  className="min-w-[220px]"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Download Security Whitepaper
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="min-w-[220px]"
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  Schedule Security Review
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
