"use client";

import {useMemo, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {usePathname, useSearchParams} from "next/navigation";
import {ChevronDown} from "lucide-react";
import {cn} from "@/lib/utils";
import {locales, defaultLocale, type Locale} from "@/i18n/config";
import {stripLocaleFromPathname} from "@/i18n/paths";

function buildTargetUrl(basePathname: string, targetLocale: Locale, search: string) {
  const prefix = targetLocale === defaultLocale ? "" : `/${targetLocale}`;
  return `${prefix}${basePathname}${search}`;
}

export function LanguageSwitcher({
  isLight,
  variant = "desktop",
}: {
  isLight: boolean;
  variant?: "desktop" | "mobile";
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";

  const [open, setOpen] = useState(false);

  const basePathname = useMemo(() => stripLocaleFromPathname(pathname), [pathname]);
  const currentLabel = t(`languages.${locale}`);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          variant === "desktop"
            ? "hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors rounded-md"
            : "inline-flex lg:hidden w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors rounded-lg",
          isLight
            ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
        )}
        aria-label={t("common.language")}
      >
        <span>{currentLabel}</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className={cn(
            variant === "desktop"
              ? "absolute right-0 top-full mt-1 min-w-40 rounded-lg backdrop-blur-xl p-1.5 shadow-2xl z-50"
              : "absolute left-0 right-0 top-full mt-2 rounded-lg backdrop-blur-xl p-1.5 shadow-2xl z-50",
            isLight
              ? "bg-white border border-black/[0.08] shadow-black/5"
              : "bg-navy-800/95 border border-slate-400/[0.08] shadow-black/50"
          )}
        >
          {locales.map((l) => {
            const href = buildTargetUrl(basePathname, l, search);
            const isActive = l === locale;
            return (
              <a
                key={l}
                href={href}
                onClick={() => {
                  document.cookie = `NEXT_LOCALE=${l}; Path=/; Max-Age=31536000; SameSite=Lax`;
                  setOpen(false);
                }}
                className={cn(
                  variant === "desktop"
                    ? "block px-3 py-2 text-[13px] rounded-md transition-colors"
                    : "block px-3 py-2.5 text-sm rounded-md transition-colors",
                  isLight
                    ? "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.03]",
                  isActive && (isLight ? "bg-slate-50 text-slate-900" : "bg-white/[0.04] text-white")
                )}
              >
                {t(`languages.${l}`)}
                {""}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

