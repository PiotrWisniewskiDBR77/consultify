"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const stats = [
  { value: 20, suffix: "B", key: 0 },
  { value: 1400, suffix: "+", key: 1 },
  { value: 60, suffix: " MB", key: 2 },
  { value: 60, suffix: "s", prefix: "<", key: 3 },
];

function AnimatedNumber({
  target,
  suffix,
  display,
  prefix,
  inView,
}: {
  target: number;
  suffix: string;
  display?: string;
  prefix?: string;
  inView: boolean;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (display) {
      setCurrent(target);
      return;
    }

    let start = 0;
    const duration = 1800;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.round(eased * target);
      setCurrent(start);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [inView, target, display]);

  const formatted = display ?? (current >= 1000 ? `${Math.floor(current / 1000)}\u00A0${String(current % 1000).padStart(3, "0")}` : String(current));

  return (
    <span>
      {prefix}{formatted}
      {suffix}
    </span>
  );
}

export function VectorStats() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const t = useTranslations("vector.home.stats");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "border-y py-16 sm:py-20",
        isLight ? "bg-slate-50 border-slate-200" : "bg-navy-900/40 border-white/[0.04]"
      )}
    >
      <Container size="xl">
        <div className="grid grid-cols-2 gap-8 sm:gap-12 lg:grid-cols-4">
          {stats.map(({ value, suffix, prefix, key }) => (
            <div key={key} className="text-center">
              <p className="text-4xl font-bold tracking-tight text-gradient sm:text-5xl lg:text-6xl">
                <AnimatedNumber
                  target={value}
                  suffix={suffix}
                  prefix={prefix}
                  inView={inView}
                />
              </p>
              <p
                className={cn(
                  "mt-2 text-sm leading-relaxed",
                  isLight ? "text-slate-500" : "text-slate-500"
                )}
              >
                {t(`items.${key}.label`)}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
