"use client";

import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

const FAQ_INDICES = [0, 1, 2, 3, 4, 5, 6];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function VectorFAQ() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("vector.home.faq");

  return (
    <Section variant="alternate">
      <div ref={ref}>
        <Container>
          <motion.div
            initial="initial"
            animate={isInView ? "animate" : "initial"}
            variants={fadeInUp}
          >
            <SectionHeader
              label={t("label")}
              title={t("title")}
              align="center"
            />
          </motion.div>

          <motion.div
            initial="initial"
            animate={isInView ? "animate" : "initial"}
            variants={fadeInUp}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-3xl space-y-2"
          >
            {FAQ_INDICES.map((index) => (
              <div
                key={index}
                className={cn(
                  "rounded-xl border overflow-hidden",
                  isLight
                    ? "bg-white border-slate-200 shadow-sm"
                    : "border-white/5 bg-navy-800/50"
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenIndex(openIndex === index ? null : index)
                  }
                  className={cn(
                    "flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors",
                    isLight ? "hover:bg-slate-50" : "hover:bg-navy-700/30"
                  )}
                >
                  <span
                    className={cn(
                      "font-medium",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    {t(`items.${index}.q`)}
                  </span>
                  <motion.span
                    animate={{ rotate: openIndex === index ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "shrink-0",
                      isLight ? "text-slate-600" : "text-slate-400"
                    )}
                  >
                    <ChevronDown className="h-5 w-5" aria-hidden />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {openIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div
                        className={cn(
                          "border-t px-5 py-4",
                          isLight ? "border-black/[0.08]" : "border-white/5"
                        )}
                      >
                        <p
                          className={cn(
                            "leading-relaxed",
                            isLight ? "text-slate-600" : "text-slate-400"
                          )}
                        >
                          {t(`items.${index}.a`)}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        </Container>
      </div>
    </Section>
  );
}
