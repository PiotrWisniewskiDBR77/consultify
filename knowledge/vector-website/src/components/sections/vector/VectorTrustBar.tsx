"use client";

import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const TRUST_ITEM_KEYS = [0, 1, 2, 3, 4, 5] as const;

export function VectorTrustBar() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("vector.home.trustBar");

  return (
    <div
      className={cn(
        "border-y py-6",
        isLight ? "bg-slate-50 border-slate-200" : "bg-navy-900 border-slate-400/[0.06]"
      )}
    >
      <Container size="xl">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {TRUST_ITEM_KEYS.map((key, index) => (
            <Badge key={key} variant={index < 2 ? "purple" : "outline"} className="px-4 py-2 text-xs">
              {t(`items.${key}`)}
            </Badge>
          ))}
        </div>
      </Container>
    </div>
  );
}
