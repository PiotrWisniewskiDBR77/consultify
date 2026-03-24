"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { useLocale } from "next-intl";
import { localizeHref } from "@/i18n/paths";
import type { Locale } from "@/i18n/config";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "link";
  size?: "sm" | "md" | "lg";
  href?: string;
  localeAware?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", href, localeAware = true, children, ...props },
    ref
  ) => {
    const base =
      "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-iris-purple/40 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-full";

    const variants = {
      primary: "bg-iris-purple hover:bg-iris-cyan text-white font-semibold",
      secondary:
        "border border-current/20 hover:border-current/40 hover:bg-current/[0.03] text-[var(--text-primary)] border-[var(--border-color)]",
      outline:
        "border border-iris-purple/30 text-iris-purple hover:bg-iris-purple/5 hover:border-iris-purple/50",
      ghost: "hover:bg-black/[0.03] text-[var(--text-secondary)]",
      link: "text-iris-magenta hover:text-iris-pink underline-offset-4 hover:underline p-0",
    };

    const sizes = {
      sm: "h-9 px-4 text-sm gap-2",
      md: "h-11 px-6 text-sm gap-2",
      lg: "h-13 px-8 text-base gap-3",
    };

    const locale = useLocale() as Locale;
    const resolvedHref = href && localeAware ? localizeHref(href, locale) : href;

    if (href) {
      return (
        <a
          href={resolvedHref}
          className={cn(base, variants[variant], sizes[size], className)}
        >
          {children}
        </a>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
export type { ButtonProps };
