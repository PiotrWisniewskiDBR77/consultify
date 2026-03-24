"use client";

import { BrainCircuit, Database, Factory, Cpu } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const pillarIcons = [BrainCircuit, Database, Factory, Cpu];

export function VectorIntro() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("vector.home.intro");

  return (
    <Section padding="lg">
      <Container size="xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-iris-violet">
            {t("label")}
          </p>
          <h2
            className={cn(
              "mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl",
              isLight ? "text-slate-900" : "text-white"
            )}
          >
            {t.rich("title", {
              gradient: (chunks) => (
                <span className="text-gradient">{chunks}</span>
              ),
            })}
          </h2>
          <p
            className={cn(
              "mt-6 text-lg leading-relaxed",
              isLight ? "text-slate-600" : "text-slate-400"
            )}
          >
            {t("subtitle")}
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-2">
          {pillarIcons.map((Icon, i) => (
            <div
              key={i}
              className={cn(
                "rounded-2xl border p-7",
                isLight
                  ? "bg-white border-slate-200 shadow-md shadow-black/[0.05]"
                  : "bg-navy-800/40 border-white/[0.06]"
              )}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-iris-purple/10 text-iris-violet">
                <Icon className="h-6 w-6" />
              </div>
              <h3
                className={cn(
                  "mt-4 text-lg font-semibold",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                {t(`pillars.${i}.title`)}
              </h3>
              <p
                className={cn(
                  "mt-2 text-sm leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                {t(`pillars.${i}.text`)}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
