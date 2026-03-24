"use client";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";

interface SectionHeaderProps {
  label?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeader({
  label,
  title,
  description,
  align = "center",
  className,
}: SectionHeaderProps) {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  return (
    <div
      className={cn(
        "mb-12 sm:mb-16",
        align === "center" && "text-center mx-auto max-w-3xl",
        align === "left" && "max-w-2xl",
        className
      )}
    >
      {label && (
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-iris-magenta">
          {label}
        </p>
      )}
      <h2 className={cn(
        "text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl",
        isLight ? "text-slate-900" : "text-white"
      )}>
        {title}
      </h2>
      {description && (
        <p className={cn(
          "mt-5 text-base leading-relaxed sm:text-lg",
          isLight ? "text-slate-600" : "text-slate-400"
        )}>
          {description}
        </p>
      )}
    </div>
  );
}
