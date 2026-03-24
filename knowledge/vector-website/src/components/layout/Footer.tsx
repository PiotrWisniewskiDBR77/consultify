"use client";

import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

const footerSections = [
  {
    id: "vector",
    links: [
      { label: "Overview", href: "/" },
      { label: "Training", href: "/training" },
      { label: "Deployment", href: "/deployment" },
      { label: "Security", href: "/security-vector" },
    ],
  },
  {
    id: "products",
    links: [
      { label: "All products", href: "/products" },
      { label: "Consultify", href: "https://consultify.ai", external: true },
      { label: "Digital Twin", href: "https://www.dbr77.com/en/digital_twin/", external: true },
      { label: "IoT", href: "https://www.dbr77.com/en/iiot", external: true },
      { label: "Marketplace", href: "https://www.dbr77.com/en/marketplace/", external: true },
    ],
  },
  {
    id: "company",
    links: [
      { label: "DBR77.com", href: "https://www.dbr77.com", external: true },
      { label: "Contact", href: "https://www.dbr77.com/contact", external: true },
      { label: "Book demo", href: "https://meetings.hubspot.com/piotr-wisniewski1", external: true },
      { label: "LinkedIn", href: "https://www.linkedin.com/company/dbr77/", external: true },
    ],
  },
  {
    id: "legal",
    links: [
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Cookies", href: "/legal/cookies" },
    ],
  },
] as const;

export function Footer() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  return (
    <footer className={cn(
      "border-t",
      isLight
        ? "bg-[#FAFAFC] border-black/[0.08]"
        : "bg-navy-950 border-slate-400/[0.06]"
    )}>
      <Container size="xl" className="py-14 sm:py-16">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-6 lg:gap-8">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <a
              href="https://www.dbr77.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center"
            >
              <Image
                src="/images/logos/dbr77-color.png"
                alt="DBR77 Industrial Intelligence"
                width={240}
                height={68}
                className="w-auto h-12 object-contain dark:hidden"
              />
              <Image
                src="/images/logos/dbr77-white.png"
                alt="DBR77 Industrial Intelligence"
                width={240}
                height={68}
                className="w-auto h-12 object-contain hidden dark:block"
              />
            </a>
            <p className={cn(
              "mt-3 text-sm leading-relaxed max-w-xs",
              isLight ? "text-slate-600" : "text-slate-500"
            )}>
              DBR77 Vector is the intelligence heart of the DBR77 ecosystem — an industrial AI trained on real factory transformations, available across Consultify, Digital Twin, IoT, and Marketplace.
            </p>

            <div className="mt-6 space-y-1.5">
              <p className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-500")}>
                <span className={cn("font-medium", isLight ? "text-slate-600" : "text-slate-400")}>
                  DBR77 Robotics Sp. z o.o.
                </span>
                <br />
                ul. Żółkiewskiego 31, 87-100 Toruń, Poland
              </p>
              <p className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-500")}>
                DBR77 USA Inc. — Charlotte, NC 28202, USA
                <br />
                DBR77 GmbH — 10707 Berlin, Germany
              </p>
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.id}>
              <h3 className={cn(
                "text-[11px] font-semibold tracking-[0.15em] mb-4",
                isLight ? "text-slate-500" : "text-slate-400"
              )}>
                {section.id.toUpperCase()}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "text-sm transition-colors inline-flex items-center gap-1",
                          isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-500 hover:text-white"
                        )}
                      >
                        {link.label}
                        <span className="text-[9px] opacity-50">&#8599;</span>
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className={cn(
                          "text-sm transition-colors",
                          isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-500 hover:text-white"
                        )}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={cn(
          "mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4",
          isLight ? "border-black/[0.08]" : "border-slate-400/[0.06]"
        )}>
          <p className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-600")}>
            &copy; {new Date().getFullYear()} DBR77 Vector. Powered by{" "}
            <a
              href="https://www.dbr77.com"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "transition-colors",
                isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-500 hover:text-white"
              )}
            >
              DBR77 Robotics
            </a>
          </p>

          <div className="flex items-center gap-5">
            {[
              { name: "LinkedIn", href: "https://www.linkedin.com/company/dbr77/" },
              { name: "YouTube", href: "https://www.youtube.com/@DBR77" },
              { name: "X", href: "https://x.com/dbr77_com" },
            ].map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "text-xs transition-colors",
                  isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-600 hover:text-white"
                )}
              >
                {social.name}
              </a>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
