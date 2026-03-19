"use client";

import Image, {type ImageProps} from "next/image";
import {useLocale} from "next-intl";
import type {Locale} from "@/i18n/config";
import {useEffect, useState} from "react";

function deriveLocalizedSrc(src: string, locale: Locale) {
  if (locale === "en") return src;
  // Convention: `*-en.png`/`*-en.webp`/etc -> `*-<locale>.<ext>`
  return src.replace(/-en(\.[a-zA-Z0-9]+)$/i, `-${locale}$1`);
}

export function LocalizedImage(props: ImageProps) {
  const locale = useLocale() as Locale;
  const src = typeof props.src === "string" ? props.src : null;

  // For non-string src (StaticImport), just render as-is.
  if (!src) return <Image {...props} />;

  const localized = deriveLocalizedSrc(src, locale);
  const fallback = src;

  // If we didn't actually change anything, no need for error handling.
  if (localized === fallback) return <Image {...props} />;

  const [currentSrc, setCurrentSrc] = useState<string>(localized);

  useEffect(() => {
    setCurrentSrc(localized);
  }, [localized]);

  return (
    <Image
      {...props}
      src={currentSrc}
      onError={(e) => {
        if (currentSrc !== fallback) setCurrentSrc(fallback);
        props.onError?.(e);
      }}
    />
  );
}

