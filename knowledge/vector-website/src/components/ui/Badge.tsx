"use client";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import type { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "purple" | "outline" | "blue" | "yellow";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const darkVariants = {
    default: "bg-white/[0.04] text-slate-300 border-slate-400/[0.08]",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/15",
    purple: "bg-iris-purple/10 text-iris-violet border-iris-purple/15",
    outline: "bg-transparent text-slate-400 border-slate-400/15",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/15",
    yellow: "bg-amber-500/10 text-amber-400 border-amber-500/15",
  };

  const lightVariants = {
    default: "bg-slate-100 text-slate-600 border-black/[0.06]",
    success: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
    purple: "bg-orange-50 text-orange-700 border-orange-300/60",
    outline: "bg-transparent text-slate-500 border-black/[0.08]",
    blue: "bg-blue-50 text-blue-600 border-blue-200/60",
    yellow: "bg-amber-50 text-amber-600 border-amber-200/60",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        isLight ? lightVariants[variant] : darkVariants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
