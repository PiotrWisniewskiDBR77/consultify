import {NextResponse, type NextRequest} from "next/server";
import {defaultLocale, isLocale, LOCALE_COOKIE, LOCALE_HEADER} from "./i18n/config";

function hasFileExtension(pathname: string) {
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function stripLocalePrefix(pathname: string) {
  const parts = pathname.split("/");
  const maybeLocale = parts[1];
  if (!isLocale(maybeLocale)) return pathname;

  const rest = "/" + parts.slice(2).join("/");
  return rest === "/" ? "/" : rest.replace(/\/+$/, "");
}

export function proxy(request: NextRequest) {
  const {pathname} = request.nextUrl;

  // Skip Next internals and public files.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    hasFileExtension(pathname)
  ) {
    return NextResponse.next();
  }

  const parts = pathname.split("/");
  const maybeLocale = parts[1];

  // If URL is prefixed with a locale, remove it via rewrite and expose locale to the app.
  if (isLocale(maybeLocale)) {
    const locale = maybeLocale;
    const unprefixedPath = stripLocalePrefix(pathname);

    // Canonicalize `/en/*` to `/*`.
    if (locale === defaultLocale) {
      const url = request.nextUrl.clone();
      url.pathname = unprefixedPath;
      return NextResponse.redirect(url);
    }

    const url = request.nextUrl.clone();
    url.pathname = unprefixedPath;

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(LOCALE_HEADER, locale);

    const res = NextResponse.rewrite(url, {request: {headers: requestHeaders}});
    res.cookies.set(LOCALE_COOKIE, locale);
    return res;
  }

  // If user previously picked a non-EN locale, keep URLs prefixed consistently.
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale) && cookieLocale !== defaultLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${cookieLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // Default to EN.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};

