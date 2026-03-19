"use client";

import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { Database, Cpu, Zap, CloudCog } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useTranslations } from "next-intl";

const STEP_ICONS = [Database, Cpu, Zap, CloudCog] as const;
const STEP_NUMBERS = ["01", "02", "03", "04"] as const;

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

export function VectorHowBuilt() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const t = useTranslations("vector.home.howBuilt");

  return (
    <Section variant="alternate" padding="lg">
      <div ref={ref}>
        <Container size="xl">
          <SectionHeader
            label={t("label")}
            title={t("title")}
            description={t("description")}
            align="center"
          />

          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate={isInView ? "animate" : "initial"}
            className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2"
          >
            {STEP_ICONS.map((Icon, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className={cn(
                  "relative rounded-2xl border p-7",
                  isLight
                    ? "bg-white border-slate-200 shadow-md shadow-black/[0.05]"
                    : "bg-navy-800/40 border-white/[0.06]"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-iris-purple/10">
                    <Icon className="h-6 w-6 text-iris-violet" />
                  </div>
                  <div>
                    <span className="text-xs font-bold tracking-[0.2em] text-iris-violet">
                      STEP {STEP_NUMBERS[index]}
                    </span>
                    <h3
                      className={cn(
                        "text-lg font-semibold",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {t(`steps.${index}.title`)}
                    </h3>
                  </div>
                </div>
                <p
                  className={cn(
                    "mt-4 text-sm leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  {t(`steps.${index}.description`)}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </div>
    </Section>
  );
}
