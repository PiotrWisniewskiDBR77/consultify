"use client";

import { useState } from "react";
import { Check, X, ChevronDown, Zap, Globe, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

const columnDefs = [
  { key: "vector" as const, icon: Zap, featured: true, itemType: "pros" as const, itemCount: 5 },
  { key: "generic" as const, icon: Globe, featured: false, itemType: "cons" as const, itemCount: 5 },
  { key: "consulting" as const, icon: Users, featured: false, itemType: "cons" as const, itemCount: 5 },
] as const;

const ROW_INDICES = [0, 1, 2, 3, 4, 5] as const;

export function VectorComparison() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const [tableOpen, setTableOpen] = useState(false);
  const t = useTranslations("vector.home.comparison");

  const columns = columnDefs.map((def) => {
    const colKey = def.key === "vector" ? "0" : def.key === "generic" ? "1" : "2";
    const items = Array.from({ length: def.itemCount }, (_, i) => {
      const listKey = def.featured ? "vectorPros" : def.key === "generic" ? "genericCons" : "consultingCons";
      return t(`${listKey}.${i}`);
    });
    return {
      ...def,
      name: t(`columns.${colKey}.name`),
      tagline: t(`columns.${colKey}.tagline`),
      items,
    };
  });

  return (
    <Section variant="alternate" padding="lg">
      <Container size="xl">
        <SectionHeader
          label={t("label")}
          title={t("title")}
          description={t("description")}
          align="center"
        />

        {/* 3-column cards */}
        <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
          {columns.map((col) => {
            const Icon = col.icon;
            return (
              <div
                key={col.key}
                className={cn(
                  "rounded-2xl border p-6 sm:p-8 transition-all duration-300",
                  col.featured
                    ? isLight
                      ? "bg-white border-iris-purple/25 shadow-lg shadow-iris-purple/[0.08] ring-1 ring-iris-purple/10 scale-[1.02] lg:scale-105"
                      : "bg-navy-800/70 border-iris-purple/20 shadow-lg shadow-iris-purple/5"
                    : isLight
                      ? "bg-white border-slate-200 opacity-80"
                      : "bg-navy-800/20 border-white/[0.04] opacity-70"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      col.featured
                        ? "bg-iris-purple/15 text-iris-violet"
                        : isLight
                          ? "bg-slate-100 text-slate-400"
                          : "bg-navy-700/60 text-slate-500"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3
                      className={cn(
                        "text-lg font-bold",
                        col.featured
                          ? isLight ? "text-slate-900" : "text-white"
                          : isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      {col.name}
                    </h3>
                    <p className={cn("text-xs", col.featured ? "text-iris-violet" : "text-slate-500")}>
                      {col.tagline}
                    </p>
                  </div>
                </div>

                <ul className="mt-6 space-y-3">
                  {col.items.map((item, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      {col.featured ? (
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-iris-violet" />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400/60" />
                      )}
                      <span
                        className={cn(
                          col.featured
                            ? isLight ? "text-slate-700" : "text-slate-300"
                            : "text-slate-500"
                        )}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Collapsed full table */}
        <div className="mt-10">
          <button
            onClick={() => setTableOpen(!tableOpen)}
            className={cn(
              "mx-auto flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all",
              isLight
                ? "border-black/[0.08] text-slate-600 hover:text-slate-900 hover:border-black/15"
                : "border-white/[0.08] text-slate-400 hover:text-white hover:border-white/15"
            )}
          >
            {tableOpen ? t("toggleButtonHide") : t("toggleButton")}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-300",
                tableOpen && "rotate-180"
              )}
            />
          </button>

          <div
            className={cn(
              "overflow-hidden transition-all duration-500 ease-in-out",
              tableOpen ? "mt-8 max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse overflow-hidden rounded-2xl text-sm">
                <thead>
                  <tr className={cn(isLight ? "bg-slate-100" : "bg-navy-800")}>
                    <th className={cn("px-4 py-4 text-left font-semibold", isLight ? "text-slate-700" : "text-slate-300")}>
                      {t("tableHeader")}
                    </th>
                    <th className="px-4 py-4 text-left font-semibold text-iris-violet">{t("columns.0.name")}</th>
                    <th className={cn("px-4 py-4 text-left font-semibold", isLight ? "text-slate-500" : "text-slate-400")}>
                      {t("columns.1.name")}
                    </th>
                    <th className={cn("px-4 py-4 text-left font-semibold", isLight ? "text-slate-500" : "text-slate-400")}>
                      {t("columns.2.name")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROW_INDICES.map((rowIdx) => {
                    const feature = t(`rows.${rowIdx}.feature`);
                    const cells = [
                      t(`rows.${rowIdx}.vector`),
                      t(`rows.${rowIdx}.generic`),
                      t(`rows.${rowIdx}.consulting`),
                    ];
                    return (
                      <tr
                        key={rowIdx}
                        className={cn(
                          "border-t",
                          isLight
                            ? rowIdx % 2 === 0 ? "bg-white border-black/[0.05]" : "bg-slate-50 border-black/[0.05]"
                            : rowIdx % 2 === 0 ? "bg-navy-900/40 border-white/[0.05]" : "bg-navy-900/20 border-white/[0.05]"
                        )}
                      >
                        <td className={cn("px-4 py-4 font-medium", isLight ? "text-slate-700" : "text-slate-300")}>{feature}</td>
                        {cells.map((cell, cellIndex) => {
                          const positive = cellIndex === 0;
                          return (
                            <td key={cellIndex} className="px-4 py-4 align-top">
                              <span className="flex gap-2">
                                {positive ? (
                                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-iris-violet" />
                                ) : (
                                  <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                                )}
                                <span className={cn(positive ? (isLight ? "text-slate-700" : "text-slate-300") : "text-slate-500")}>
                                  {cell}
                                </span>
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
