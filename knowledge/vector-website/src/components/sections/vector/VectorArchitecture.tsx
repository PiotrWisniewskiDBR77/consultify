"use client";

import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const STEP_INDICES = [0, 1, 2, 3, 4, 5, 6];

const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export function VectorArchitecture() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const t = useTranslations("vector.home.architecture");

  return (
    <Section padding="lg">
      <div ref={ref}>
        <Container size="xl">
          <SectionHeader
            label={t("label")}
            title={t("title")}
            description={t("description")}
            align="center"
          />

          <motion.div
            initial="initial"
            animate={isInView ? "animate" : "initial"}
            variants={fadeIn}
            transition={{ delay: 0.15 }}
            className="mx-auto mt-12 max-w-5xl"
          >
            {/* Desktop: horizontal flow */}
            <div className="hidden lg:flex lg:items-center lg:gap-1">
              {STEP_INDICES.map((index) => (
                <div key={index} className="flex items-center gap-1">
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border px-4 py-5 text-center min-w-[130px]",
                      isLight
                        ? "bg-white border-slate-200 shadow-md shadow-black/[0.05]"
                        : "bg-navy-800/60 border-white/[0.06]"
                    )}
                  >
                    <p
                      className={cn(
                        "text-xs font-bold leading-tight",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {t(`steps.${index}.label`)}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-[10px] leading-tight",
                        isLight ? "text-slate-500" : "text-slate-500"
                      )}
                    >
                      {t(`steps.${index}.sublabel`)}
                    </p>
                  </div>
                  {index < STEP_INDICES.length - 1 && (
                    <ArrowRight className="h-4 w-4 shrink-0 text-iris-violet" />
                  )}
                </div>
              ))}
            </div>

            {/* Mobile/Tablet: vertical flow */}
            <div className="flex flex-col items-center gap-2 lg:hidden">
              {STEP_INDICES.map((index) => (
                <div key={index} className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex w-full max-w-xs flex-col items-center justify-center rounded-xl border px-5 py-4 text-center",
                      isLight
                        ? "bg-white border-slate-200 shadow-md shadow-black/[0.05]"
                        : "bg-navy-800/60 border-white/[0.06]"
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-bold",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {t(`steps.${index}.label`)}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-xs",
                        isLight ? "text-slate-500" : "text-slate-500"
                      )}
                    >
                      {t(`steps.${index}.sublabel`)}
                    </p>
                  </div>
                  {index < STEP_INDICES.length - 1 && (
                    <ArrowRight className="my-1 h-4 w-4 rotate-90 text-iris-violet" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </Container>
      </div>
    </Section>
  );
}
