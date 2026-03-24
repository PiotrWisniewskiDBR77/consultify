"use client";

import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  ArrowRight,
  Leaf,
  Trash2,
  Zap,
  Droplets,
  FileCheck,
  Users,
  Building2,
  FileBarChart,
} from "lucide-react";

const FEATURES = [
  {
    icon: Leaf,
    title: "Carbon Footprint Tracking",
    description:
      "Measure Scope 1, 2, and 3 emissions with built-in GHG inventory management. Set reduction targets, model scenarios, and track carbon offsets and credits over time.",
  },
  {
    icon: Trash2,
    title: "Waste Management & Circular Economy",
    description:
      "Classify and track waste streams across every facility. Monitor recycling rates, disposal methods, and circular economy metrics to drive zero-waste initiatives.",
  },
  {
    icon: Zap,
    title: "Energy Monitoring & Optimization",
    description:
      "Track energy consumption by type, facility, and production line. Identify efficiency gaps, monitor renewable energy share, and benchmark against reduction targets.",
  },
  {
    icon: Droplets,
    title: "Water Consumption & Conservation",
    description:
      "Calculate your water footprint, monitor consumption patterns, and track conservation initiatives. Set water reduction targets and measure progress facility by facility.",
  },
  {
    icon: FileCheck,
    title: "Environmental Compliance",
    description:
      "Manage environmental permits, legal obligations, and regulatory deadlines in one place. Automated alerts ensure you never miss a renewal or reporting deadline.",
  },
  {
    icon: Users,
    title: "Social Impact Measurement",
    description:
      "Track diversity and inclusion metrics, employee well-being indicators, and community impact. Quantify your social responsibility with standardized measurement frameworks.",
  },
  {
    icon: Building2,
    title: "Governance Records & Policies",
    description:
      "Maintain governance records, manage corporate policies, and track compliance audits. Build a transparent governance framework that satisfies investors and regulators alike.",
  },
  {
    icon: FileBarChart,
    title: "ESG Reporting & Disclosures",
    description:
      "Generate investor-ready ESG reports with custom templates. Schedule automated disclosures, export in multiple formats, and maintain a complete audit trail.",
  },
];

const INTEGRATIONS = [
  {
    name: "MES",
    description: "Pull production data to calculate accurate carbon footprints per product and line.",
  },
  {
    name: "CMMS",
    description: "Correlate equipment data with energy consumption for efficiency analysis.",
  },
  {
    name: "HSE",
    description: "Combine safety and environmental data for unified compliance reporting.",
  },
  {
    name: "IoT",
    description: "Ingest real-time sensor data for energy, water, and emissions monitoring.",
  },
  {
    name: "KPI",
    description: "Surface sustainability KPIs alongside operational metrics in shared dashboards.",
  },
  {
    name: "DATA_AI",
    description: "Apply machine learning to forecast emissions trends and optimize resource usage.",
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
      delayChildren: 0.1,
    },
  },
};

export default function ESGModulePage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const refFeatures = useRef<HTMLDivElement>(null);
  const refAI = useRef<HTMLDivElement>(null);
  const refScreenshot = useRef<HTMLDivElement>(null);
  const refIntegrations = useRef<HTMLDivElement>(null);
  const refCTA = useRef<HTMLDivElement>(null);
  const inViewFeatures = useInView(refFeatures, { once: true, margin: "-80px" });
  const inViewAI = useInView(refAI, { once: true, margin: "-80px" });
  const inViewScreenshot = useInView(refScreenshot, { once: true, margin: "-80px" });
  const inViewIntegrations = useInView(refIntegrations, { once: true, margin: "-80px" });
  const inViewCTA = useInView(refCTA, { once: true, margin: "-80px" });

  return (
    <>
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-20 sm:pb-28",
          isLight ? "bg-white" : "bg-navy-950",
          !isLight && "bg-gradient-hero",
          !isLight && "grid-pattern"
        )}
      >
        <Image src="/images/modules/esg-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
        <Container size="lg" className="relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <Badge variant="outline" className="mb-6">
              Add-on Module
            </Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              ESG &amp; Sustainability
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Track your environmental footprint, measure social impact, and demonstrate governance
              excellence — with data that flows directly from your production floor.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <Button variant="primary" size="lg" href="/contact">
                Request a Demo
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="lg" href="/modules">
                All Modules
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Overview */}
      <Section variant="alternate">
        <Container>
          <div className="max-w-3xl mx-auto space-y-6">
            <p
              className={cn(
                "text-base sm:text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              The IRIS ESG module gives manufacturers a single source of truth for environmental,
              social, and governance performance. It connects directly to production systems — MES,
              IoT sensors, CMMS — so your sustainability data is calculated from actual operations,
              not spreadsheet estimates.
            </p>
            <p
              className={cn(
                "text-base sm:text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              From carbon footprint calculation across Scope 1, 2, and 3 emissions to waste
              classification, energy efficiency tracking, and water conservation metrics, the module
              covers the full spectrum of environmental management. Social impact and governance
              records round out the picture, ensuring you can report holistically to investors,
              regulators, and stakeholders.
            </p>
            <p
              className={cn(
                "text-base sm:text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Automated compliance tracking keeps you ahead of regulatory deadlines, while
              AI-powered forecasting helps you set realistic reduction targets and model the impact
              of sustainability initiatives before committing resources.
            </p>
          </div>
        </Container>
      </Section>

      {/* Key Features */}
      <Section variant="default">
        <Container>
          <div ref={refFeatures}>
            <SectionHeader
              label="Capabilities"
              title="Measure What Matters. Report With Confidence."
              description="End-to-end ESG management — from raw sensor data to investor-ready disclosures."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={inViewFeatures ? "animate" : "initial"}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <motion.div key={title} variants={fadeInUp}>
                  <Card variant="default" padding="md" className="h-full flex flex-col">
                    <div className="text-iris-violet mb-4">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3
                      className={cn(
                        "font-semibold text-base",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {title}
                    </h3>
                    <p
                      className={cn(
                        "mt-2 text-sm leading-relaxed flex-1",
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

      {/* AI Integration */}
      <Section variant="alternate">
        <Container>
          <div ref={refAI}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewAI ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-4xl mx-auto"
            >
              <SectionHeader
                label="Artificial Intelligence"
                title="AI That Drives Sustainability Forward"
                align="center"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  {
                    title: "Emissions Forecasting",
                    text: "Predict future carbon emissions based on production plans, seasonal patterns, and historical trends. Model the impact of process changes before implementation.",
                  },
                  {
                    title: "Resource Optimization",
                    text: "AI identifies energy and water consumption anomalies, recommends efficiency improvements, and quantifies the expected savings of each intervention.",
                  },
                  {
                    title: "Compliance Risk Detection",
                    text: "Automatically flag approaching permit deadlines, regulatory changes, and reporting obligations. Prioritize actions by risk severity and deadline proximity.",
                  },
                  {
                    title: "Target Scenario Modeling",
                    text: "Simulate different sustainability strategies — renewable energy adoption, waste reduction programs, process changes — and compare their projected impact on your ESG scores.",
                  },
                ].map((item) => (
                  <Card key={item.title} variant="default" padding="md">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-iris-violet flex-shrink-0 mt-0.5" />
                      <div>
                        <h4
                          className={cn(
                            "font-semibold",
                            isLight ? "text-slate-900" : "text-white"
                          )}
                        >
                          {item.title}
                        </h4>
                        <p
                          className={cn(
                            "mt-1 text-sm leading-relaxed",
                            isLight ? "text-slate-600" : "text-slate-400"
                          )}
                        >
                          {item.text}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Screenshot Placeholder */}
      <Section variant="default">
        <Container>
          <div ref={refScreenshot}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewScreenshot ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                title="See It in Action"
                description="The ESG dashboard consolidates carbon emissions, energy usage, waste metrics, and compliance status into a single, real-time view across all your facilities."
                align="center"
              />
              <div className={cn("rounded-2xl overflow-hidden border max-w-4xl mx-auto", isLight ? "border-black/[0.08]" : "border-white/10")}>
                <Image src="/images/modules/esg-hero.png" alt="ESG Module — sustainability and environmental dashboard" width={1920} height={1080} className="w-full h-auto" quality={90} />
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Integration Points */}
      <Section variant="alternate">
        <Container>
          <div ref={refIntegrations}>
            <SectionHeader
              label="Integrations"
              title="Sustainability Data From the Source"
              description="ESG metrics are only as good as the data behind them. IRIS connects your sustainability module directly to production, maintenance, and sensor systems."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={inViewIntegrations ? "animate" : "initial"}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto"
            >
              {INTEGRATIONS.map(({ name, description }) => (
                <motion.div key={name} variants={fadeInUp}>
                  <Card variant="default" padding="md" className="h-full">
                    <h4
                      className={cn(
                        "font-semibold",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {name}
                    </h4>
                    <p
                      className={cn(
                        "mt-1 text-sm leading-relaxed",
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
      <Section variant="default" padding="xl">
        <Container>
          <div ref={refCTA}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewCTA ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-center max-w-2xl mx-auto"
            >
              <h2
                className={cn(
                  "text-3xl sm:text-4xl font-bold tracking-tight",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                Make sustainability measurable
              </h2>
              <p
                className={cn(
                  "mt-4 text-base sm:text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                See how IRIS ESG turns production data into actionable sustainability insights —
                from carbon tracking to investor-ready reporting.
              </p>
              <div className="mt-8 flex flex-wrap gap-4 justify-center">
                <Button variant="primary" size="lg" href="/contact">
                  Schedule a Demo
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="lg" href="/pricing">
                  View Pricing
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
