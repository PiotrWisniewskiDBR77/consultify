"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Play, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export default function WalkthroughPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const heroRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true, margin: "-40px" });
  const contentInView = useInView(contentRef, { once: true, margin: "-80px" });

  return (
    <>
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-16 sm:pb-20",
          isLight ? "bg-white" : "bg-navy-950",
          !isLight && "bg-gradient-hero",
          !isLight && "grid-pattern"
        )}
      >
        <Container size="lg" className="relative z-10">
          <div ref={heroRef}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center text-center max-w-4xl mx-auto"
            >
              <h1
                className={cn(
                  "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                2‑Minute Walkthrough
              </h1>
              <p
                className={cn(
                  "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-300"
                )}
              >
                A fast overview of IRIS: the AI‑native Plant Operating System —
                including Tasking and communication in context.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button variant="primary" size="lg" href="/demo" className="min-w-[220px]">
                  Book a Demo
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  href="/trial"
                  className={cn(
                    "min-w-[220px]",
                    isLight && "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  Start 14‑Day Trial
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      <Section variant="alternate" padding="lg">
        <Container>
          <div ref={contentRef}>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={contentInView ? "animate" : "initial"}
              className="grid grid-cols-1 gap-8 lg:grid-cols-2 max-w-6xl mx-auto"
            >
              <motion.div variants={fadeInUp} transition={{ duration: 0.5 }}>
                <Card variant="glow" padding="lg" className="h-full flex flex-col">
                  <p className="text-sm font-semibold uppercase tracking-widest text-iris-violet mb-3">
                    Video
                  </p>
                  <h2
                    className={cn(
                      "text-2xl sm:text-3xl font-bold tracking-tight",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    Watch the overview
                  </h2>
                  <p className={cn("mt-4 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                    Replace this placeholder with your real video (YouTube/Vimeo/MP4). The page is here so all internal links stay consistent.
                  </p>

                  <div
                    className={cn(
                      "mt-6 relative flex-1 min-h-[260px] rounded-lg flex items-center justify-center cursor-pointer group transition-all",
                      isLight
                        ? "bg-slate-100 border border-black/[0.06]"
                        : "bg-navy-800/60 border border-white/[0.06]"
                    )}
                    role="presentation"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-iris-purple/15 group-hover:bg-iris-purple/25 transition-colors">
                        <Play className="h-7 w-7 text-iris-violet ml-0.5" aria-hidden />
                      </div>
                      <p className={cn("text-sm font-medium", isLight ? "text-slate-700" : "text-slate-300")}>
                        2‑minute walkthrough (placeholder)
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={fadeInUp} transition={{ duration: 0.5 }}>
                <Card variant="glow" padding="lg" className="h-full">
                  <p className="text-sm font-semibold uppercase tracking-widest text-iris-violet mb-3">
                    What you&apos;ll learn
                  </p>
                  <h2
                    className={cn(
                      "text-2xl sm:text-3xl font-bold tracking-tight",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    The loop from data to action
                  </h2>
                  <ul className="mt-6 space-y-3">
                    {[
                      "How IRIS connects IoT, execution modules, and planning in one model.",
                      "Where AI fits (reasoning, prediction, recommendations).",
                      "How Tasking closes the loop with accountability.",
                      "How Communicator keeps every conversation tied to operational context.",
                    ].map((t) => (
                      <li key={t} className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-iris-green mt-0.5 flex-shrink-0" aria-hidden />
                        <p className={cn("text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>
                          {t}
                        </p>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
                    <Button variant="primary" size="md" href="/platform" className="w-full sm:w-auto">
                      Platform Overview
                    </Button>
                    <Button variant="secondary" size="md" href="/modules" className="w-full sm:w-auto">
                      Browse Modules
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}

