"use client";

import { ArrowRight, LockKeyhole, Server, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const CARD_ICONS = [LockKeyhole, Server, GitBranch];
const CARD_INDICES = [0, 1, 2];

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

export function VectorSecurityHighlights() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const t = useTranslations("vector.home.securityHighlights");

  return (
    <Section variant="alternate" padding="md">
      <div ref={ref}>
        <Container size="xl">
          <SectionHeader
            label={t("label")}
            title={t("title")}
            align="center"
          />

          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate={isInView ? "animate" : "initial"}
            className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3"
          >
            {CARD_INDICES.map((index) => {
              const Icon = CARD_ICONS[index];
              return (
                <motion.div key={index} variants={fadeInUp}>
                  <Card variant="glow" padding="lg" className="h-full">
                    <div className="flex flex-col gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-iris-purple/10 text-iris-violet">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3
                        className={cn(
                          "text-base font-semibold",
                          isLight ? "text-slate-900" : "text-white"
                        )}
                      >
                        {t(`cards.${index}.title`)}
                      </h3>
                      <p
                        className={cn(
                          "text-sm leading-relaxed",
                          isLight ? "text-slate-600" : "text-slate-400"
                        )}
                      >
                        {t(`cards.${index}.description`)}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

          <div className="mt-10 text-center">
            <Button variant="secondary" size="md" href="/security-vector">
              {t("linkText")} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Container>
      </div>
    </Section>
  );
}
