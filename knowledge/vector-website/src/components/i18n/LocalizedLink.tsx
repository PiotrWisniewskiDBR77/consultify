"use client";

import type React from "react";
import Link, {type LinkProps} from "next/link";
import {useLocale} from "next-intl";
import type {Locale} from "@/i18n/config";
import {localizeHref} from "@/i18n/paths";

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  Omit<LinkProps, "href"> & {
    href: string;
  };

export function LocalizedLink({href, ...props}: Props) {
  const locale = useLocale() as Locale;
  return <Link href={localizeHref(href, locale)} {...props} />;
}

