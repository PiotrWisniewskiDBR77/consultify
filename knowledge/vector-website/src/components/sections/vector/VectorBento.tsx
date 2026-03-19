"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Blocks,
  FileSearch,
  GraduationCap,
  LockKeyhole,
  Server,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

const PAIN_ICONS = [FileSearch, Bot, LockKeyhole];
const TAB_META = [
  { icon: GraduationCap, href: "/training" },
  { icon: Server, href: "/deployment" },
  { icon: Blocks, href: "/products" },
  { icon: ShieldCheck, href: "/security-vector" },
];

function FeatureCard({
  stat,
  statLabel,
  title,
  description,
  isLight,
  bgImage,
}: {
  stat: string;
  statLabel: string;
  title: string;
  description: string;
  isLight: boolean;
  bgImage?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-8 flex flex-col justify-between",
        isLight
          ? "bg-white border-slate-200 shadow-md shadow-black/[0.05]"
          : "bg-navy-800/60 border-white/[0.06]"
      )}
    >
      {bgImage && (
        <div
          className="absolute inset-0 z-0 opacity-[0.07]"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <div className="relative z-10">
        <p className="text-5xl font-bold tracking-tight text-gradient sm:text-6xl">
          {stat}
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-iris-violet">
          {statLabel}
        </p>
      </div>
      <div className="relative z-10 mt-8">
        <h3
          className={cn(
            "text-lg font-semibold leading-snug",
            isLight ? "text-slate-900" : "text-white"
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "mt-2 text-sm leading-relaxed",
            isLight ? "text-slate-600" : "text-slate-400"
          )}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

function NavCard({
  icon: Icon,
  title,
  description,
  href,
  isLight,
  learnMore,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  isLight: boolean;
  learnMore: string;
}) {
  return (
    <Link href={href} className="group">
      <div
        className={cn(
          "h-full rounded-2xl border p-6 transition-all duration-300",
          isLight
            ? "bg-white border-slate-200 shadow-sm hover:border-iris-purple/20 hover:shadow-md hover:-translate-y-0.5"
            : "bg-navy-800/40 border-white/[0.06] hover:border-iris-purple/25 hover:bg-navy-700/40 hover:-translate-y-0.5"
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-iris-purple/10 text-iris-violet">
          <Icon className="h-5 w-5" />
        </div>
        <h4
          className={cn(
            "mt-4 text-base font-semibold",
            isLight ? "text-slate-900" : "text-white"
          )}
        >
          {title}
        </h4>
        <p
          className={cn(
            "mt-1.5 text-sm leading-relaxed",
            isLight ? "text-slate-500" : "text-slate-500"
          )}
        >
          {description}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-iris-violet transition-colors group-hover:text-iris-magenta">
          {learnMore} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

export function VectorBento() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("vector.home.bento");

  const tabs = TAB_META;

  return (
    <Section padding="lg">
      <Container size="xl">
        <SectionHeader
          label={t("label")}
          title={t("title")}
          description={t("description")}
          align="center"
        />

        {/* Bento grid */}
        <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2 lg:gap-5">
          {/* Large card — top left, spans 2 rows */}
          <div className="md:col-span-2 md:row-span-1">
            <FeatureCard
              stat={t("featureStats.casesValue")}
              statLabel={t("featureStats.casesLabel")}
              title={t("painPoints.0.title")}
              description={t("painPoints.0.description")}
              isLight={isLight}
              bgImage="/images/vector/ecosystem-architecture.png"
            />
          </div>

          {/* Nav card — Training */}
          <div>
            <NavCard
              icon={tabs[0].icon}
              title={t("pageTabs.0.title")}
              description={t("pageTabs.0.description")}
              href={tabs[0].href}
              isLight={isLight}
              learnMore={t("learnMore")}
            />
          </div>

          {/* Nav card — Deployment */}
          <div>
            <NavCard
              icon={tabs[1].icon}
              title={t("pageTabs.1.title")}
              description={t("pageTabs.1.description")}
              href={tabs[1].href}
              isLight={isLight}
              learnMore={t("learnMore")}
            />
          </div>

          {/* Large card — bottom right, spans 2 cols */}
          <div className="md:col-span-2 md:row-span-1">
            <FeatureCard
              stat={t("featureStats.securityValue")}
              statLabel={t("featureStats.securityLabel")}
              title={t("painPoints.2.title")}
              description={t("painPoints.2.description")}
              isLight={isLight}
            />
          </div>
        </div>

        {/* Second row: remaining nav cards + middle pain point */}
        <div className="mt-4 grid gap-4 md:grid-cols-3 lg:gap-5">
          <NavCard
            icon={tabs[2].icon}
            title={t("pageTabs.2.title")}
            description={t("pageTabs.2.description")}
            href={tabs[2].href}
            isLight={isLight}
            learnMore={t("learnMore")}
          />

          {(() => {
            const MiddleIcon = PAIN_ICONS[1];
            return (
              <div
                className={cn(
                  "flex flex-col justify-center rounded-2xl border p-8",
                  isLight
                    ? "bg-white border-slate-200 shadow-md shadow-black/[0.05]"
                    : "bg-navy-800/40 border-white/[0.06]"
                )}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-iris-purple/10 text-iris-violet">
                  <MiddleIcon className="h-6 w-6" />
                </div>
                <h3
                  className={cn(
                    "mt-4 text-lg font-semibold leading-snug",
                    isLight ? "text-slate-900" : "text-white"
                  )}
                >
                  {t("painPoints.1.title")}
                </h3>
                <p
                  className={cn(
                    "mt-2 text-sm leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  {t("painPoints.1.description")}
                </p>
              </div>
            );
          })()}

          <NavCard
            icon={tabs[3].icon}
            title={t("pageTabs.3.title")}
            description={t("pageTabs.3.description")}
            href={tabs[3].href}
            isLight={isLight}
            learnMore={t("learnMore")}
          />
        </div>
      </Container>
    </Section>
  );
}
