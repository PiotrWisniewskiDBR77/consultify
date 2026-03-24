"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { MapPin, ExternalLink } from "lucide-react";

const FOUNDER_PERSPECTIVES = [
  {
    role: "A CEO running global production",
    description:
      "Who lived through digital chaos — data trapped in silos, consultants delivering slide decks that never became action.",
  },
  {
    role: "An AI engineer from Nvidia's ecosystem",
    description:
      "Who saw what technology could truly deliver — and watched it get misapplied, oversold, and under-deployed in industry.",
  },
  {
    role: "A German industrial manufacturer",
    description:
      "Who knew the mid-market reality: tight budgets, legacy equipment, and zero tolerance for tools that don't work on day one.",
  },
];

const OFFICES = [
  { country: "Poland", city: "Wrocław", flag: "🇵🇱", label: "R&D Headquarters" },
  { country: "USA", city: "Charlotte, NC", flag: "🇺🇸", label: "US Operations" },
  { country: "Germany", city: "Stuttgart", flag: "🇩🇪", label: "Engineering" },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

export default function OurStoryPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);
  const ref5 = useRef<HTMLDivElement>(null);
  const ref6 = useRef<HTMLDivElement>(null);
  const isInView1 = useInView(ref1, { once: true, margin: "-80px" });
  const isInView2 = useInView(ref2, { once: true, margin: "-80px" });
  const isInView3 = useInView(ref3, { once: true, margin: "-80px" });
  const isInView4 = useInView(ref4, { once: true, margin: "-80px" });
  const isInView5 = useInView(ref5, { once: true, margin: "-80px" });
  const isInView6 = useInView(ref6, { once: true, margin: "-80px" });

  return (
    <>
      {/* Section 1 — Hero */}
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-24 sm:pb-32",
          isLight ? "bg-white" : "bg-navy-950",
          !isLight && "bg-gradient-hero",
          !isLight && "grid-pattern"
        )}
      >
        <Container size="lg" className="relative z-10">
          <div ref={ref1}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView1 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center max-w-4xl mx-auto"
            >
              <h1 className={cn("text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]", isLight ? "text-slate-900" : "text-white")}>
                We Didn&apos;t Start in a Server Room.{" "}
                <span className="text-iris-violet">We Started on the Shop Floor.</span>
              </h1>
              <p className={cn("mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                IRIS was born from a decade of running production lines in automotive — not from a whiteboard in Silicon Valley.
              </p>
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={isInView1 ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.3 }}
                className={cn("relative mt-12 w-full max-w-4xl mx-auto aspect-[21/9] rounded-xl overflow-hidden border", isLight ? "bg-slate-50 border-black/[0.08]" : "bg-navy-800/80 border-white/5")}
              >
                <Image
                  src="/images/our-story/hero-bg.png"
                  alt="Modern automotive production line with digital twin overlay"
                  fill
                  className="object-cover"
                  quality={90}
                />
              </motion.div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Section 2 — The Problem We Experienced */}
      <Section variant="alternate">
        <Container>
          <div ref={ref2}>
            <SectionHeader
              label="Where It Started"
              title="Three Perspectives. One Broken System."
              description="We came from different corners of industry — a CEO, an AI engineer, and a manufacturer — and kept running into the same wall: factories drowning in data but starving for insight."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView2 ? "animate" : "initial"}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {FOUNDER_PERSPECTIVES.map(({ role, description }) => (
                <motion.div key={role} variants={fadeInUp}>
                  <Card variant="glow" padding="lg" className="h-full">
                    <p className="text-xs font-semibold uppercase tracking-widest text-iris-violet mb-3">
                      {role}
                    </p>
                    <p className={cn("leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>{description}</p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 3 — The Decision */}
      <Section variant="default">
        <Container>
          <div ref={ref3}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView3 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-3xl mx-auto text-center"
            >
              <h2 className={cn("text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
                So We Built the Tool We Wished We Had.
              </h2>
              <p className={cn("mt-6 text-lg leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                We left corporate careers — not as consultants advising from the sidelines, but as
                builders creating the platform we knew manufacturing needed. We started with
                spreadsheets, evolved to custom tools, and ultimately engineered IRIS: a unified
                operating system for the entire plant. Our journey spans from Harvard&apos;s halls to
                automotive production lines in Poland, and now to the manufacturing heartland of the
                Carolinas.
              </p>
              <div className={cn("mt-12 max-w-4xl mx-auto rounded-2xl overflow-hidden border shadow-lg", isLight ? "border-black/[0.08] shadow-black/5" : "border-white/10 shadow-black/50")}>
                <Image
                  src="/images/homepage/built-by-operators.png"
                  alt="DBR77 founders — manufacturing leaders turned software innovators"
                  width={1600}
                  height={1200}
                  className="w-full h-auto"
                  quality={90}
                />
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 4 — The Vision */}
      <Section variant="alternate">
        <Container>
          <div ref={ref4}>
            <motion.blockquote
              initial={{ opacity: 0, y: 20 }}
              animate={isInView4 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-4xl mx-auto text-center"
            >
              <p className={cn("text-2xl sm:text-3xl lg:text-4xl font-semibold leading-snug", isLight ? "text-slate-900" : "text-white")}>
                &ldquo;Every factory deserves the intelligence that only the largest corporations
                could afford — until now.&rdquo;
              </p>
              <p className={cn("mt-6 text-base", isLight ? "text-slate-600" : "text-slate-400")}>
                Our mission: democratize industrial intelligence through the Measure, Optimize,
                Automate philosophy — part of the DBR77 Industrial Intelligence ecosystem.
              </p>
            </motion.blockquote>
          </div>
        </Container>
      </Section>

      {/* Section 5 — Global Presence */}
      <Section variant="default">
        <Container>
          <div ref={ref5}>
            <SectionHeader
              label="Where We Work"
              title="Global Presence"
              description="Three offices across two continents. One mission: bring industrial intelligence to every plant."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView5 ? "animate" : "initial"}
              className="grid grid-cols-1 sm:grid-cols-3 gap-6"
            >
              {OFFICES.map(({ country, city, flag, label }) => (
                <motion.div key={country} variants={fadeInUp}>
                  <Card variant="default" padding="lg" className="h-full flex flex-col items-center text-center">
                    <span className="text-4xl mb-3" role="img" aria-label={country}>
                      {flag}
                    </span>
                    <h3 className={cn("font-semibold", isLight ? "text-slate-900" : "text-white")}>{country}</h3>
                    <p className="text-sm text-iris-cyan mt-1">{label}</p>
                    <p className={cn("text-sm mt-1 flex items-center gap-1.5", isLight ? "text-slate-600" : "text-slate-400")}>
                      <MapPin className="h-3.5 w-3.5" />
                      {city}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={isInView5 ? { opacity: 1 } : {}}
              transition={{ delay: 0.4 }}
              className={cn("mt-8 text-center", isLight ? "text-slate-600" : "text-slate-400")}
            >
              SIRI assessment certified. On-site demos available in the Carolinas.
            </motion.p>
          </div>
        </Container>
      </Section>

      {/* Section 6 — CTA */}
      <Section variant="alternate" padding="xl">
        <Container>
          <div ref={ref6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView6 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <h2 className={cn("text-2xl sm:text-3xl font-bold tracking-tight mb-4", isLight ? "text-slate-900" : "text-white")}>
                Ready to See IRIS in Action?
              </h2>
              <p className={cn("mb-8 max-w-xl mx-auto", isLight ? "text-slate-600" : "text-slate-400")}>
                Book a personalized demo and discover how IRIS can transform your plant operations.
              </p>
              <Button variant="primary" size="lg" href="/demo" className="min-w-[220px]">
                Book a Demo
                <ExternalLink className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
