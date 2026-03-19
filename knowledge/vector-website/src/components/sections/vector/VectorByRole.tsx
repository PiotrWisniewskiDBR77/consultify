"use client";

import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { motion, useInView } from "framer-motion";
import { Crown, Gauge, Server, HardHat } from "lucide-react";
import { useRef } from "react";

const ROLE_ICONS = [Crown, Gauge, Server, HardHat];
const ROLE_INDICES = [0, 1, 2, 3];

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

export function VectorByRole() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("vector.home.byRole");

  return (
    <Section>
      <div ref={ref}>
        <Container>
          <SectionHeader
            label={t("label")}
            title={t("title")}
            align="center"
          />
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate={isInView ? "animate" : "initial"}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {ROLE_INDICES.map((index) => {
              const Icon = ROLE_ICONS[index];
              return (
                <motion.div key={index} variants={fadeInUp}>
                  <Card variant="interactive" padding="lg" className="h-full">
                    <div className="flex flex-col gap-4">
                      <div className="text-iris-violet">
                        <Icon className="h-8 w-8" aria-hidden />
                      </div>
                      <h3
                        className={cn(
                          "font-semibold text-lg",
                          isLight ? "text-slate-900" : "text-white"
                        )}
                      >
                        {t(`roles.${index}.role`)}
                      </h3>
                      <p
                        className={cn(
                          "leading-relaxed text-sm",
                          isLight ? "text-slate-600" : "text-slate-400"
                        )}
                      >
                        {t(`roles.${index}.description`)}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </Container>
      </div>
    </Section>
  );
}
