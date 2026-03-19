"use client";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { useTranslations } from "next-intl";
import {
  Video,
  FileText,
  Shield,
  GraduationCap,
  Newspaper,
  Radio,
  ExternalLink,
  Download,
} from "lucide-react";

export default function ResourcesPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("resourcesPage");

  const resources = [
    {
      title: t("items.walkthrough.title"),
      description: t("items.walkthrough.description"),
      icon: Video,
      type: "video" as const,
    },
    {
      title: t("items.architecture.title"),
      description: t("items.architecture.description"),
      icon: FileText,
      type: "pdf" as const,
    },
    {
      title: t("items.security.title"),
      description: t("items.security.description"),
      icon: Shield,
      type: "pdf" as const,
    },
    {
      title: t("items.masterclass.title"),
      description: t("items.masterclass.description"),
      icon: GraduationCap,
      type: "external" as const,
      href: "https://masterclass.dbr77.com",
    },
    {
      title: t("items.blog.title"),
      description: t("items.blog.description"),
      icon: Newspaper,
      type: "external" as const,
      href: "https://dbr77.com/blog",
    },
    {
      title: t("items.factoryOnAir.title"),
      description: t("items.factoryOnAir.description"),
      icon: Radio,
      type: "external" as const,
      href: "https://dbr77.com/factory-on-air",
    },
  ];

  return (
    <>
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-20 sm:pb-24",
          isLight ? "bg-white" : "bg-navy-950",
          !isLight && "bg-gradient-hero",
          !isLight && "grid-pattern"
        )}
      >
        <Container size="lg" className="relative z-10">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <h1 className={cn("text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]", isLight ? "text-slate-900" : "text-white")}>
              {t("hero.title")}
            </h1>
            <p className={cn("mt-4 text-lg max-w-2xl", isLight ? "text-slate-600" : "text-slate-400")}>
              {t("hero.subtitle")}
            </p>
          </div>
        </Container>
      </section>

      {/* Content Grid */}
      <Section variant="alternate">
        <Container>
          <SectionHeader
            title={t("grid.title")}
            description={t("grid.description")}
            align="center"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.map(({ title, description, icon: Icon, type, href }) => (
              <Card
                key={title}
                variant="interactive"
                padding="lg"
                className="h-full"
              >
                {type === "external" && href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-full"
                  >
                    <div className="text-iris-violet">
                      <Icon className="h-8 w-8" aria-hidden />
                    </div>
                    <h3 className={cn("font-semibold mt-4", isLight ? "text-slate-900" : "text-white")}>{title}</h3>
                    <p className={cn("text-sm mt-2 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                      {description}
                    </p>
                    <span className="mt-4 inline-flex items-center text-sm text-iris-cyan">
                      {t("grid.visit")}
                      <ExternalLink className="h-4 w-4 ml-1" />
                    </span>
                  </a>
                ) : (
                  <div className="block h-full">
                    <div className="text-iris-violet">
                      <Icon className="h-8 w-8" aria-hidden />
                    </div>
                    <h3 className={cn("font-semibold mt-4", isLight ? "text-slate-900" : "text-white")}>{title}</h3>
                    <p className={cn("text-sm mt-2 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                      {description}
                    </p>
                    {type === "pdf" && (
                      <span className="mt-4 inline-flex items-center text-sm text-iris-cyan">
                        {t("grid.download")}
                        <Download className="h-4 w-4 ml-1" />
                      </span>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
