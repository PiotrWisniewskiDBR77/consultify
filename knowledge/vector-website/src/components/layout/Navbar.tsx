"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

const NAV_ITEMS = [
  { key: "vector", href: "/" },
  { key: "training", href: "/training" },
  { key: "deployment", href: "/deployment" },
  { key: "products", href: "/products" },
  { key: "security", href: "/security-vector" },
] as const;

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggleTheme, mounted } = useThemeContext();
  const t = useTranslations("vector.nav");

  const isLight = theme === "light";

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? isLight
            ? "bg-white/95 backdrop-blur-xl border-b border-black/[0.08] shadow-sm"
            : "bg-navy-950/95 backdrop-blur-xl border-b border-slate-400/[0.06]"
          : "bg-transparent"
      )}
    >
      <Container size="xl">
        <nav className="flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 sm:gap-4 shrink-0" aria-label="DBR77 Vector">
            <a
              href="https://www.dbr77.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center shrink-0"
              aria-label="DBR77.com"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src="/images/logos/dbr77-color.png"
                alt="DBR77 Industrial Intelligence"
                width={280}
                height={80}
                className="w-auto h-14 object-contain dark:hidden"
                priority
              />
              <Image
                src="/images/logos/dbr77-white.png"
                alt="DBR77 Industrial Intelligence"
                width={280}
                height={80}
                className="w-auto h-14 object-contain hidden dark:block"
                priority
              />
            </a>
            <span className={cn(
              "hidden sm:block w-px h-8 shrink-0",
              isLight ? "bg-slate-300" : "bg-slate-600"
            )} />
            <span className={cn(
              "text-lg font-bold tracking-tight",
              isLight ? "text-slate-800" : "text-white"
            )}>
              Vector
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <div key={item.key} className="relative">
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors",
                    isLight
                      ? "text-slate-600 hover:text-slate-900"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {t(item.key)}
                </Link>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher isLight={isLight} variant="desktop" />

            {mounted && (
              <button
                onClick={toggleTheme}
                className={cn(
                  "hidden sm:flex items-center justify-center w-9 h-9 rounded-md transition-colors",
                  isLight
                    ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    : "text-slate-500 hover:text-white hover:bg-white/[0.03]"
                )}
                aria-label="Toggle theme"
              >
                {isLight ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
              </button>
            )}

            <Button variant="secondary" size="sm" href="/products" className="hidden sm:inline-flex text-sm">
              {t("exploreProducts")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              href="https://meetings.hubspot.com/piotr-wisniewski1"
              className="hidden sm:inline-flex text-sm"
            >
              {t("bookDemo")}
            </Button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={cn(
                "lg:hidden flex items-center justify-center w-9 h-9 transition-colors",
                isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-white"
              )}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>
      </Container>

      {mobileOpen && (
        <div
          className={cn(
            "lg:hidden backdrop-blur-xl border-t",
            isLight
              ? "bg-white/98 border-black/[0.08]"
              : "bg-navy-900/98 border-slate-400/[0.06]"
          )}
        >
          <Container>
            <div className="py-4 space-y-1">
              {NAV_ITEMS.map((item) => (
                <div key={item.key}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "block px-4 py-3 text-base font-medium transition-colors",
                      isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-white"
                    )}
                  >
                    {t(item.key)}
                  </Link>
                </div>
              ))}
              <div className={cn(
                "border-t pt-4 mt-4 flex flex-col gap-3 px-4",
                isLight ? "border-black/[0.08]" : "border-slate-400/[0.06]"
              )}>
                <LanguageSwitcher isLight={isLight} variant="mobile" />

                {mounted && (
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className={cn(
                      "inline-flex items-center justify-between w-full px-4 py-3 text-sm font-medium transition-colors rounded-lg",
                      isLight
                        ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                    )}
                    aria-label="Toggle theme"
                  >
                    <span>{t("theme")}</span>
                    <span className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-500")}>
                      {theme === "light" ? "☀️" : "🌙"}
                    </span>
                  </button>
                )}

                <Button variant="secondary" size="md" href="/products" className="w-full">
                  {t("exploreProducts")}
                </Button>
                <Button variant="primary" size="md" href="https://meetings.hubspot.com/piotr-wisniewski1" className="w-full">
                  {t("bookDemo")}
                </Button>
              </div>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
