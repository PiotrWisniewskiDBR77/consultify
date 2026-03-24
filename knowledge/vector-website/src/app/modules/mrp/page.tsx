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
  Package,
  TrendingUp,
  Layers,
  Truck,
  BarChart3,
  ShoppingCart,
  FileText,
  RefreshCw,
} from "lucide-react";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Demand Forecasting",
    description:
      "AI-driven demand forecasting that combines historical data, seasonal patterns, and market signals to predict material needs with high accuracy.",
  },
  {
    icon: Layers,
    title: "BOM Management",
    description:
      "Multi-level bill of materials with version control, effectivity dates, and engineering change management. Support for configurable and phantom BOMs.",
  },
  {
    icon: Package,
    title: "Inventory Optimization",
    description:
      "Dynamic safety stock calculations, reorder point management, and ABC/XYZ classification to keep the right materials in the right quantities.",
  },
  {
    icon: ShoppingCart,
    title: "Procurement Automation",
    description:
      "Auto-generate purchase requisitions based on net requirements. Vendor selection, lead time tracking, and purchase order management in one flow.",
  },
  {
    icon: Truck,
    title: "Supply Chain Visibility",
    description:
      "End-to-end visibility from supplier to shop floor. Track inbound shipments, monitor lead times, and identify supply risks before they impact production.",
  },
  {
    icon: RefreshCw,
    title: "Net Requirements Calculation",
    description:
      "Explode demand through multi-level BOMs, net against on-hand inventory and open orders, and generate time-phased material plans automatically.",
  },
  {
    icon: BarChart3,
    title: "Material Analytics",
    description:
      "Track material consumption, forecast accuracy, supplier performance, and inventory turns. Identify waste and optimize your material strategy.",
  },
  {
    icon: FileText,
    title: "Production Order Planning",
    description:
      "Convert planned orders into production orders with full material reservation, component availability checks, and capacity verification.",
  },
];

const AI_CAPABILITIES = [
  "Forecasts material demand using machine learning models trained on your historical consumption and production data",
  "Detects supply risk early by monitoring supplier lead time trends and flagging potential shortages",
  "Optimizes safety stock levels dynamically based on demand variability, lead time uncertainty, and service level targets",
  "Recommends order consolidation opportunities to reduce procurement costs and minimize freight expenses",
  "Identifies slow-moving and obsolete inventory and suggests disposition strategies",
];

const INTEGRATIONS = [
  {
    module: "APS",
    description:
      "Production schedules from APS drive material requirements timing. MRP ensures materials are available exactly when the schedule needs them.",
  },
  {
    module: "MES",
    description:
      "Real-time material consumption from MES updates MRP inventory positions. Scrap and yield variances automatically adjust future requirements.",
  },
  {
    module: "WMS",
    description:
      "Warehouse stock levels, inbound receipts, and material movements flow directly into MRP calculations for accurate net requirements.",
  },
  {
    module: "QMS",
    description:
      "Quality inspection results affect material availability. Rejected lots trigger automatic re-procurement through MRP.",
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

export default function MRPPage() {
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
          !isLight && "bg-gradient-hero grid-pattern"
        )}
      >
        <Image src="/images/modules/mrp-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
        <Container size="lg" className="relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <Badge variant="outline" className="mb-6">
              Add-on Module
            </Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              Material Requirements Planning
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Never run out of materials. Never overstock. IRIS MRP uses
              AI-powered demand forecasting and real-time inventory data to ensure
              the right materials arrive at the right time.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <Button variant="primary" size="lg" href="/pricing">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="secondary" size="lg" href="/modules">
                All modules
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Overview */}
      <Section variant="alternate">
        <Container size="md">
          <div className="max-w-3xl mx-auto space-y-6">
            <p
              className={cn(
                "text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              The IRIS MRP module transforms material planning from a manual,
              error-prone process into an intelligent, automated system. It
              combines demand forecasting, multi-level BOM explosion, and
              real-time inventory tracking to generate precise, time-phased
              material plans that keep production running without excess stock.
            </p>
            <p
              className={cn(
                "text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              By integrating directly with APS for production schedules, MES for
              real-time consumption data, and WMS for warehouse inventory, MRP
              calculations always reflect the true state of your operations. No
              more planning in a vacuum — every material decision is grounded in
              live data.
            </p>
            <p
              className={cn(
                "text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              The result: fewer stockouts, lower inventory carrying costs,
              stronger supplier relationships, and the confidence that production
              will never stop waiting for materials.
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
              title="Material Planning, Reinvented"
              description="From demand forecasting to procurement automation — a complete material planning system that keeps your supply chain in sync with production."
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
                  <Card variant="default" padding="md" className="h-full">
                    <div className="text-iris-violet mb-4">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3
                      className={cn(
                        "font-semibold mb-2",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {title}
                    </h3>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
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
            <SectionHeader
              label="AI-Powered"
              title="Forecasting That Gets Smarter Every Cycle"
              description="IRIS AI analyzes consumption patterns, supplier behavior, and market signals to make your material plans more accurate with every planning run."
              align="center"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewAI ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto"
            >
              <Card variant="glow" padding="lg">
                <ul className="space-y-4">
                  {AI_CAPABILITIES.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-iris-violet flex-shrink-0 mt-0.5" />
                      <span
                        className={cn(
                          "text-sm leading-relaxed",
                          isLight ? "text-slate-600" : "text-slate-300"
                        )}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
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
              <div className={cn("rounded-2xl overflow-hidden border max-w-4xl mx-auto", isLight ? "border-black/[0.08]" : "border-white/10")}>
                <Image src="/images/modules/mrp-hero.png" alt="MRP Module — material requirements planning dashboard" width={1920} height={1080} className="w-full h-auto" quality={90} />
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
              label="Connected"
              title="Supply Chain Meets Shop Floor"
              description="MRP connects your supply chain to production reality — ensuring material plans are always grounded in live operational data."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={inViewIntegrations ? "animate" : "initial"}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-4xl mx-auto"
            >
              {INTEGRATIONS.map(({ module, description }) => (
                <motion.div key={module} variants={fadeInUp}>
                  <Card variant="default" padding="md" className="h-full">
                    <Badge variant="purple" className="mb-3">
                      {module}
                    </Badge>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
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
                Right materials. Right time. Right cost.
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                See how IRIS MRP can optimize your material planning and procurement.
              </p>
              <div className="mt-8 flex flex-wrap gap-4 justify-center">
                <Button variant="primary" size="lg" href="/pricing">
                  Get started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="secondary" size="lg" href="/modules">
                  Explore all modules
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
