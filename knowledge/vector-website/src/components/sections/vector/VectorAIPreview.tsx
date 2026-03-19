"use client";

import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";

const EXAMPLE_INDICES = [0, 1, 2];

const slideInLeft = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0 },
};

const slideInRight = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export function VectorAIPreview() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [activeExample, setActiveExample] = useState(0);
  const t = useTranslations("vector.home.aiPreview");

  return (
    <Section padding="lg">
      <div ref={ref}>
        <Container size="xl">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView ? "animate" : "initial"}
              className="flex flex-col gap-6"
            >
              <motion.p
                variants={slideInLeft}
                className="text-sm font-semibold uppercase tracking-widest text-iris-violet"
              >
                {t("label")}
              </motion.p>
              <motion.h2
                variants={slideInLeft}
                className={cn(
                  "text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                {t("title")}
              </motion.h2>
              <motion.p
                variants={slideInLeft}
                className={cn(
                  "text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                {t("subtitle")}
              </motion.p>

              <motion.div variants={staggerContainer} className="flex flex-col gap-3">
                {EXAMPLE_INDICES.map((index) => (
                  <motion.button
                    key={index}
                    variants={slideInLeft}
                    onClick={() => setActiveExample(index)}
                    className={cn(
                      "rounded-r-lg border-l-2 px-4 py-3 text-left text-sm transition-colors",
                      index === activeExample
                        ? "border-iris-purple bg-iris-purple/10 text-iris-violet"
                        : cn(
                            "border-transparent",
                            isLight
                              ? "bg-white text-slate-600 hover:bg-slate-50"
                              : "bg-navy-800/50 text-slate-300 hover:bg-navy-800/80"
                          )
                    )}
                  >
                    &ldquo;{t(`examples.${index}.user`)}&rdquo;
                  </motion.button>
                ))}
              </motion.div>

              <motion.p
                variants={slideInLeft}
                className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-500")}
              >
                {t("poweredBy")}
              </motion.p>
            </motion.div>

            <motion.div
              variants={slideInRight}
              initial="initial"
              animate={isInView ? "animate" : "initial"}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <div
                className={cn(
                  "rounded-2xl border p-6",
                  isLight
                    ? "border-slate-200 bg-white shadow-xl shadow-black/[0.08]"
                    : "border-white/5 bg-navy-900/90 shadow-xl shadow-black/20"
                )}
              >
                <div
                  className={cn(
                    "mb-4 flex items-center gap-3 border-b pb-4",
                    isLight ? "border-black/[0.08]" : "border-white/5"
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-iris-purple/20">
                    <span className="text-iris-violet text-lg">◆</span>
                  </div>
                  <div>
                    <p
                      className={cn(
                        "font-medium",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {t("chatHeader")}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        isLight ? "text-slate-500" : "text-slate-500"
                      )}
                    >
                      {t("chatSubheader")}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-end">
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl rounded-br-md bg-iris-purple/20 px-4 py-2.5 text-sm",
                        isLight ? "text-slate-600" : "text-slate-300"
                      )}
                    >
                      {t(`examples.${activeExample}.user`)}
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed",
                        isLight
                          ? "bg-slate-100 border border-black/[0.08] text-slate-600"
                          : "bg-navy-800 border border-white/5 text-slate-300"
                      )}
                    >
                      {t(`examples.${activeExample}.assistant`)}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </Container>
      </div>
    </Section>
  );
}
