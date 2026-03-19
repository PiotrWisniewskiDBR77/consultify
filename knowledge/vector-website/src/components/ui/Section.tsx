"use client";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import type { HTMLAttributes } from "react";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  variant?: "default" | "alternate" | "dark" | "gradient";
  padding?: "sm" | "md" | "lg" | "xl";
}

export function Section({
  className,
  variant = "default",
  padding = "lg",
  children,
  ...props
}: SectionProps) {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const darkVariants = {
    default: "bg-navy-950",
    alternate: "bg-navy-900/50",
    dark: "bg-navy-950",
    gradient: "bg-gradient-section",
  };

  const lightVariants = {
    default: "bg-white",
    alternate: "bg-[#FAFAFC]",
    dark: "bg-white",
    gradient: "bg-white",
  };

  const paddings = {
    sm: "py-12 sm:py-16",
    md: "py-16 sm:py-20",
    lg: "py-20 sm:py-28",
    xl: "py-28 sm:py-36",
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden",
        isLight ? lightVariants[variant] : darkVariants[variant],
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}
