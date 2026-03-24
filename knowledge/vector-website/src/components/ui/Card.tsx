"use client";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glow" | "interactive" | "gradient-border" | "dark-always";
  padding?: "sm" | "md" | "lg";
}

export function Card({
  className,
  variant = "default",
  padding = "md",
  children,
  ...props
}: CardProps) {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const base = "rounded-xl transition-all duration-300";

  const darkAlways = "bg-navy-800 border border-slate-400/[0.08] text-white";

  const darkVariants = {
    default: "bg-navy-800/40 border border-slate-400/[0.08]",
    glow: "bg-navy-800/40 border border-iris-purple/[0.14] hover:border-iris-purple/30",
    interactive:
      "bg-navy-800/40 border border-slate-400/[0.08] hover:border-iris-purple/25 hover:bg-navy-700/40 cursor-pointer hover:-translate-y-0.5",
    "gradient-border":
      "relative bg-navy-800/60 before:absolute before:inset-0 before:rounded-xl before:p-[1px] before:bg-gradient-to-br before:from-iris-purple/25 before:via-iris-magenta/10 before:to-transparent before:-z-10",
    "dark-always": darkAlways,
  };

  const lightVariants = {
    default: "bg-white border border-black/[0.08] shadow-sm shadow-black/[0.02]",
    glow: "bg-white border border-iris-purple/[0.12] hover:border-iris-purple/25 shadow-sm shadow-black/[0.02]",
    interactive:
      "bg-white border border-black/[0.08] hover:border-iris-purple/20 cursor-pointer hover:-translate-y-0.5 shadow-sm shadow-black/[0.02] hover:shadow-md hover:shadow-black/[0.04]",
    "gradient-border":
      "bg-white border border-iris-purple/[0.12] shadow-sm shadow-black/[0.02]",
    "dark-always": darkAlways,
  };

  const paddings = {
    sm: "p-4 sm:p-5",
    md: "p-5 sm:p-6",
    lg: "p-6 sm:p-8",
  };

  return (
    <div
      className={cn(
        base,
        isLight ? lightVariants[variant] : darkVariants[variant],
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
