"use client";

import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  CheckCircle2,
  ArrowRight,
  Warehouse,
  PackageSearch,
  MapPin,
  Truck,
  ScanBarcode,
  Route,
  PackageCheck,
  LayoutGrid,
} from "lucide-react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const FEATURES = [
  {
    icon: PackageSearch,
    title: "Real-Time Inventory Tracking",
    description:
      "Know exactly what you have, where it is, and how it's moving — in real time. ABC/XYZ classification automatically prioritizes your most critical materials.",
  },
  {
    icon: MapPin,
    title: "Hierarchical Location Management",
    description:
      "Model your warehouse down to the shelf level: Warehouse → Zone → Aisle → Rack → Shelf. Slotting optimization ensures fast-moving items are always within reach.",
  },
  {
    icon: Route,
    title: "AI-Powered Picking Optimization",
    description:
      "Machine learning algorithms calculate the shortest picking routes, batch compatible orders together, and allocate resources to minimize travel time and maximize throughput.",
  },
  {
    icon: Truck,
    title: "Receiving & Shipping Operations",
    description:
      "Streamlined workflows from ASN processing and quality inspection at receiving, through to carrier integration, label generation, and shipment tracking at dispatch.",
  },
  {
    icon: ScanBarcode,
    title: "Barcode & QR Code Scanning",
    description:
      "Native barcode and QR code support across all operations — receiving, putaway, picking, and shipping. Mobile scanning for operators on the warehouse floor.",
  },
  {
    icon: LayoutGrid,
    title: "Wave & Batch Management",
    description:
      "Group orders into waves for efficient batch processing. Create picking waves by zone, priority, or carrier — then track execution progress in real time.",
  },
  {
    icon: PackageCheck,
    title: "Cycle Counting",
    description:
      "Schedule cycle counts by location, product category, or ABC classification. Handle discrepancies with built-in adjustment workflows and accuracy reporting.",
  },
  {
    icon: Warehouse,
    title: "Multi-Warehouse Support",
    description:
      "Manage multiple warehouses from a single platform. Each warehouse has its own location hierarchy, inventory pool, and operational workflows — with cross-warehouse visibility.",
  },
];

const INTEGRATIONS = [
  { name: "MES", description: "Material consumption from production orders and finished goods receipt back to warehouse" },
  { name: "QMS", description: "Quality inspection during receiving with non-conformance handling and certificate management" },
  { name: "MRP", description: "Material requirements flow into warehouse for demand planning and purchase order fulfillment" },
  { name: "IoT", description: "AGV/AMR telemetry and warehouse sensor data for environmental monitoring" },
  { name: "GEMBA", description: "Warehouse KPIs and operational alerts visible on the shop floor dashboard" },
  { name: "DATA_AI", description: "Inventory forecasting, demand prediction, and picking route optimization" },
];

export default function WMSModulePage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const heroRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);
  const integrationRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const overviewInView = useInView(overviewRef, { once: true, margin: "-80px" });
  const featuresInView = useInView(featuresRef, { once: true, margin: "-80px" });
  const aiInView = useInView(aiRef, { once: true, margin: "-80px" });
  const screenshotInView = useInView(screenshotRef, { once: true, margin: "-80px" });
  const integrationInView = useInView(integrationRef, { once: true, margin: "-80px" });
  const ctaInView = useInView(ctaRef, { once: true, margin: "-80px" });

  return (
    <>
      {/* Section 1 — Hero */}
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-20 sm:pb-28",
          isLight ? "bg-white" : "bg-navy-950",
          !isLight && "bg-gradient-hero"
        )}
      >
        <Image src="/images/modules/wms-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
        <Container size="lg" className="relative z-10">
          <div ref={heroRef} className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <Badge variant="yellow" className="mb-6">Add-on Module</Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              Warehouse Management System
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              From receiving dock to shipping lane. Optimize every movement, every location, every pick — with AI-powered intelligence.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <Button variant="primary" size="lg" href="/demo">
                Request a Demo
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="secondary" size="lg" href="/modules">
                All Modules
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Section 2 — Overview */}
      <Section variant="alternate">
        <Container size="md">
          <div ref={overviewRef}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={overviewInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="What It Does"
                title="Total Warehouse Visibility"
                align="center"
              />
              <div className="space-y-6">
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  The IRIS WMS module transforms warehouse operations from reactive to predictive. It provides complete control over inventory management, receiving, picking, shipping, and space utilization — all connected to your production and quality systems through the IRIS platform&apos;s shared data layer.
                </p>
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  Every item in your warehouse is tracked in real time with full location granularity — from warehouse and zone down to the individual shelf position. Receiving workflows handle ASN processing, discrepancy management, and quality inspection integration. Picking operations are optimized by AI algorithms that calculate the fastest routes, batch compatible orders, and balance workload across your team.
                </p>
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  The module scales from a single warehouse to a multi-site network, supporting 10 million+ inventory records and 100,000+ daily transactions. With native barcode/QR scanning, mobile operator interfaces, and real-time analytics, your warehouse team has everything they need to hit accuracy and throughput targets consistently.
                </p>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 3 — Key Features */}
      <Section variant="default">
        <Container>
          <div ref={featuresRef}>
            <SectionHeader
              label="Key Features"
              title="Every Square Meter, Optimized"
              description="Comprehensive warehouse management with AI-powered optimization — from receiving to shipping and everything in between."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={featuresInView ? "animate" : "initial"}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {FEATURES.map((feature) => (
                <motion.div key={feature.title} variants={fadeInUp}>
                  <Card variant="default" padding="lg" className="h-full">
                    <div className="text-iris-violet mb-4">
                      <feature.icon className="w-6 h-6" />
                    </div>
                    <h3
                      className={cn(
                        "font-semibold text-base mb-2",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {feature.title}
                    </h3>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      {feature.description}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 4 — AI Integration */}
      <Section variant="alternate">
        <Container size="md">
          <div ref={aiRef}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={aiInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="Artificial Intelligence"
                title="AI-Powered WMS"
                align="center"
              />
              <div className="space-y-6">
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  Warehouse optimization is a combinatorial problem — and that&apos;s exactly where AI excels. The IRIS WMS module uses machine learning to continuously improve three critical areas: picking route optimization, inventory demand forecasting, and slotting strategy.
                </p>
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  Picking routes are calculated in real time using algorithms that consider warehouse layout, current picker locations, order priorities, and batch compatibility. Demand forecasting models analyze historical consumption patterns, production schedules, and seasonal trends to recommend optimal safety stock levels and reorder points. Slotting optimization automatically suggests product placement changes that reduce average pick time based on actual movement data.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                  {[
                    { label: "Route Optimization", desc: "ML algorithms calculate the shortest picking paths, reducing travel time by up to 30%" },
                    { label: "Demand Forecasting", desc: "Predict inventory needs based on production schedules, historical trends, and seasonality" },
                    { label: "Smart Slotting", desc: "AI recommends product placement changes that minimize pick time and maximize space utilization" },
                  ].map((item) => (
                    <Card key={item.label} variant="default" padding="md">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-iris-violet flex-shrink-0 mt-0.5" />
                        <div>
                          <h4
                            className={cn(
                              "font-semibold text-sm mb-1",
                              isLight ? "text-slate-900" : "text-white"
                            )}
                          >
                            {item.label}
                          </h4>
                          <p
                            className={cn(
                              "text-sm leading-relaxed",
                              isLight ? "text-slate-600" : "text-slate-400"
                            )}
                          >
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 5 — Screenshot Placeholder */}
      <Section variant="default">
        <Container>
          <div ref={screenshotRef}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={screenshotInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <div className={cn(
                "rounded-2xl overflow-hidden border max-w-5xl mx-auto shadow-2xl",
                isLight ? "border-black/10 shadow-black/5" : "border-white/10 shadow-black/50"
              )}>
                <Image
                  src="/images/iris-ui/wms-storage.png"
                  alt="IRIS WMS — warehouse storage management with location tracking"
                  width={1920}
                  height={1080}
                  className="w-full h-auto"
                  quality={90}
                />
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 6 — Integration Points */}
      <Section variant="alternate">
        <Container>
          <div ref={integrationRef}>
            <SectionHeader
              label="Integration Points"
              title="Warehouse Meets Factory"
              description="WMS connects seamlessly with production, quality, and planning — ensuring materials flow without friction from dock to line to dispatch."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={integrationInView ? "animate" : "initial"}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {INTEGRATIONS.map((integration) => (
                <motion.div key={integration.name} variants={fadeInUp}>
                  <Card variant="default" padding="md" className="h-full">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="purple">{integration.name}</Badge>
                    </div>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      {integration.description}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 7 — CTA */}
      <Section variant="default" padding="xl">
        <Container>
          <div ref={ctaRef}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={ctaInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-center max-w-2xl mx-auto"
            >
              <h2
                className={cn(
                  "text-3xl sm:text-4xl font-bold tracking-tight",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                See WMS in Action
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                From receiving to dispatch — see how IRIS WMS optimizes every warehouse operation.
              </p>
              <div className="mt-8 flex flex-wrap gap-4 justify-center">
                <Button variant="primary" size="lg" href="/demo">
                  Request a Demo
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="secondary" size="lg" href="/modules">
                  Explore All Modules
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
