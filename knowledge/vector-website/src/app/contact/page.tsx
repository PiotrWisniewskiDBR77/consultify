"use client";

import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import {
  Mail,
  MapPin,
  Globe,
  Building2,
  Send,
  Calendar,
  Phone,
} from "lucide-react";

const OFFICES = [
  {
    city: "Warsaw, Poland",
    role: "R&D Headquarters",
    description:
      "Our engineering heart — where the IRIS platform is designed, built, and continuously evolved by a world-class team of software engineers and data scientists.",
    icon: Building2,
  },
  {
    city: "Charlotte, NC, USA",
    role: "Business & Sales",
    description:
      "North American operations hub. Enterprise sales, customer success, and strategic partnerships for the US and Latin American markets.",
    icon: Building2,
  },
  {
    city: "Munich, Germany",
    role: "Engineering & DACH",
    description:
      "European engineering office and DACH market presence. On-the-ground support for German, Austrian, and Swiss manufacturing clients.",
    icon: Building2,
  },
];

const REGIONS = [
  {
    region: "Europe",
    description: "Demos available in English, German, and Polish. On-site visits across the EU.",
    timezone: "CET / GMT+1",
  },
  {
    region: "United States",
    description: "East Coast and Central time demos. On-site available for enterprise accounts.",
    timezone: "EST / CST",
  },
  {
    region: "Saudi Arabia",
    description: "Arabic and English demos. Supporting Vision 2030 industrial transformation.",
    timezone: "AST / GMT+3",
  },
  {
    region: "Japan",
    description: "Japanese and English demos. Tailored for lean manufacturing environments.",
    timezone: "JST / GMT+9",
  },
];

const MODULE_OPTIONS = [
  "MES",
  "WMS",
  "QMS",
  "CMMS",
  "Gemba",
  "DATA_AI",
  "IoT",
  "Digital Twin",
  "APS",
  "KPI",
  "HRM",
  "HSE",
  "ESG",
  "MRP",
];

const COMPANY_SIZES = [
  "1–50 employees",
  "51–200 employees",
  "201–1,000 employees",
  "1,001–5,000 employees",
  "5,000+ employees",
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export default function ContactPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);
  const isInView1 = useInView(ref1, { once: true, margin: "-80px" });
  const isInView2 = useInView(ref2, { once: true, margin: "-80px" });
  const isInView3 = useInView(ref3, { once: true, margin: "-80px" });
  const isInView4 = useInView(ref4, { once: true, margin: "-80px" });

  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    companySize: "",
    message: "",
    modules: [] as string[],
  });

  type FormStatus = "idle" | "submitting" | "success" | "error";
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleModuleToggle(mod: string) {
    setForm((prev) => ({
      ...prev,
      modules: prev.modules.includes(mod)
        ? prev.modules.filter((m) => m !== mod)
        : [...prev.modules, mod],
    }));
  }

  function validateForm(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      errs.name = "Name is required (min 2 characters).";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Enter a valid email address.";
    if (!form.company.trim()) errs.company = "Company is required.";
    if (!form.message.trim() || form.message.trim().length < 10)
      errs.message = "Message is required (min 10 characters).";
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setFormStatus("submitting");
    setTimeout(() => {
      setFormStatus("success");
    }, 1500);
  }

  const inputClasses = cn(
    "w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-iris-purple/30",
    isLight
      ? "bg-white border-black/[0.08] text-slate-900 placeholder:text-slate-400"
      : "bg-navy-800/50 border-white/[0.08] text-white placeholder:text-slate-500"
  );

  const labelClasses = cn(
    "block text-sm font-medium mb-1.5",
    isLight ? "text-slate-700" : "text-slate-300"
  );

  function fieldInputClasses(field: string) {
    return cn(
      inputClasses,
      fieldErrors[field] && "border-red-500 focus:ring-red-400/30"
    );
  }

  return (
    <>
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-24 sm:pb-32",
          isLight ? "bg-white" : "bg-navy-950",
          !isLight && "bg-gradient-hero",
          !isLight && "grid-pattern"
        )}
      >
        <Container size="lg" className="relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              Let&apos;s Talk
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              Whether you&apos;re exploring IRIS for the first time or ready to
              scale across your plants — we&apos;re here to help you move
              forward.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
              <a
                href="mailto:sales@dbr77.com"
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors hover:text-iris-violet",
                  isLight ? "text-slate-600" : "text-slate-300"
                )}
              >
                <Mail className="h-4 w-4" aria-hidden />
                sales@dbr77.com
              </a>
              <a
                href="mailto:support@dbr77.com"
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors hover:text-iris-violet",
                  isLight ? "text-slate-600" : "text-slate-300"
                )}
              >
                <Phone className="h-4 w-4" aria-hidden />
                support@dbr77.com
              </a>
            </div>
          </div>
        </Container>
      </section>

      {/* Contact Form */}
      <Section variant="alternate">
        <Container>
          <div ref={ref1}>
            <SectionHeader
              label="GET IN TOUCH"
              title="Tell Us About Your Project"
              description="Fill out the form below and our team will get back to you within one business day."
              align="center"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView1 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto"
            >
              <Card variant="default" padding="lg">
                <AnimatePresence mode="wait">
                  {formStatus === "success" ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-4 py-12 text-center"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                        <Send className="h-7 w-7 text-emerald-500" />
                      </div>
                      <h3
                        className={cn(
                          "text-xl font-semibold",
                          isLight ? "text-slate-900" : "text-white"
                        )}
                      >
                        Thank you!
                      </h3>
                      <p
                        className={cn(
                          "text-sm max-w-sm",
                          isLight ? "text-slate-600" : "text-slate-400"
                        )}
                      >
                        We&apos;ll be in touch within 24 hours.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {formStatus === "error" && (
                        <div
                          role="alert"
                          className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500"
                        >
                          Something went wrong. Please try again.
                        </div>
                      )}
                      <form
                        onSubmit={handleSubmit}
                        className="space-y-5"
                        noValidate
                        aria-label="Contact form"
                      >
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                          <div>
                            <label htmlFor="contact-name" className={labelClasses}>
                              Full Name
                            </label>
                            <input
                              id="contact-name"
                              type="text"
                              required
                              placeholder="Jane Smith"
                              value={form.name}
                              onChange={(e) => {
                                setForm((p) => ({ ...p, name: e.target.value }));
                                if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: "" }));
                              }}
                              aria-invalid={!!fieldErrors.name}
                              aria-describedby={fieldErrors.name ? "contact-name-err" : undefined}
                              className={fieldInputClasses("name")}
                            />
                            {fieldErrors.name && (
                              <p id="contact-name-err" role="alert" className="mt-1 text-xs text-red-500">
                                {fieldErrors.name}
                              </p>
                            )}
                          </div>
                          <div>
                            <label htmlFor="contact-email" className={labelClasses}>
                              Work Email
                            </label>
                            <input
                              id="contact-email"
                              type="email"
                              required
                              placeholder="jane@company.com"
                              value={form.email}
                              onChange={(e) => {
                                setForm((p) => ({ ...p, email: e.target.value }));
                                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: "" }));
                              }}
                              aria-invalid={!!fieldErrors.email}
                              aria-describedby={fieldErrors.email ? "contact-email-err" : undefined}
                              className={fieldInputClasses("email")}
                            />
                            {fieldErrors.email && (
                              <p id="contact-email-err" role="alert" className="mt-1 text-xs text-red-500">
                                {fieldErrors.email}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor="contact-company"
                              className={labelClasses}
                            >
                              Company
                            </label>
                            <input
                              id="contact-company"
                              type="text"
                              required
                              placeholder="Acme Manufacturing"
                              value={form.company}
                              onChange={(e) => {
                                setForm((p) => ({ ...p, company: e.target.value }));
                                if (fieldErrors.company) setFieldErrors((p) => ({ ...p, company: "" }));
                              }}
                              aria-invalid={!!fieldErrors.company}
                              aria-describedby={fieldErrors.company ? "contact-company-err" : undefined}
                              className={fieldInputClasses("company")}
                            />
                            {fieldErrors.company && (
                              <p id="contact-company-err" role="alert" className="mt-1 text-xs text-red-500">
                                {fieldErrors.company}
                              </p>
                            )}
                          </div>
                          <div>
                            <label htmlFor="contact-size" className={labelClasses}>
                              Company Size
                            </label>
                            <select
                              id="contact-size"
                              value={form.companySize}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  companySize: e.target.value,
                                }))
                              }
                              className={inputClasses}
                            >
                              <option value="">Select size</option>
                              {COMPANY_SIZES.map((size) => (
                                <option key={size} value={size}>
                                  {size}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className={labelClasses}>
                            Modules of Interest
                          </label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {MODULE_OPTIONS.map((mod) => {
                              const selected = form.modules.includes(mod);
                              return (
                                <button
                                  key={mod}
                                  type="button"
                                  onClick={() => handleModuleToggle(mod)}
                                  className={cn(
                                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                                    selected
                                      ? "bg-iris-purple/10 border-iris-purple/30 text-iris-violet"
                                      : isLight
                                        ? "border-black/[0.08] text-slate-600 hover:border-iris-purple/20"
                                        : "border-white/[0.08] text-slate-400 hover:border-iris-purple/20"
                                  )}
                                >
                                  {mod}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label htmlFor="contact-message" className={labelClasses}>
                            Message
                          </label>
                          <textarea
                            id="contact-message"
                            rows={4}
                            required
                            placeholder="Tell us about your manufacturing challenges, current systems, and what you'd like to achieve with IRIS..."
                            value={form.message}
                            onChange={(e) => {
                              setForm((p) => ({ ...p, message: e.target.value }));
                              if (fieldErrors.message) setFieldErrors((p) => ({ ...p, message: "" }));
                            }}
                            aria-invalid={!!fieldErrors.message}
                            aria-describedby={fieldErrors.message ? "contact-message-err" : undefined}
                            className={cn(fieldInputClasses("message"), "resize-none")}
                          />
                          {fieldErrors.message && (
                            <p id="contact-message-err" role="alert" className="mt-1 text-xs text-red-500">
                              {fieldErrors.message}
                            </p>
                          )}
                        </div>

                        <Button
                          variant="primary"
                          size="lg"
                          type="submit"
                          className="w-full"
                          disabled={formStatus === "submitting"}
                          aria-disabled={formStatus === "submitting"}
                        >
                          {formStatus === "submitting" ? (
                            <>
                              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Sending…
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" aria-hidden />
                              Send Message
                            </>
                          )}
                        </Button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Offices */}
      <Section variant="default">
        <Container>
          <div ref={ref2}>
            <SectionHeader
              label="OUR OFFICES"
              title="Global Presence, Local Expertise"
              description="Three offices across two continents, serving manufacturing leaders worldwide."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView2 ? "animate" : "initial"}
              className="grid grid-cols-1 gap-6 md:grid-cols-3 max-w-5xl mx-auto"
            >
              {OFFICES.map(({ city, role, description, icon: Icon }) => (
                <motion.div key={city} variants={fadeInUp}>
                  <Card variant="glow" padding="lg" className="h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-iris-purple/10">
                        <Icon className="h-5 w-5 text-iris-violet" aria-hidden />
                      </div>
                      <div>
                        <h3
                          className={cn(
                            "font-semibold",
                            isLight ? "text-slate-900" : "text-white"
                          )}
                        >
                          {city}
                        </h3>
                        <Badge variant="purple" className="mt-0.5">
                          {role}
                        </Badge>
                      </div>
                    </div>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      {description}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Schedule a Demo */}
      <Section variant="alternate">
        <Container>
          <div ref={ref3}>
            <SectionHeader
              label="DEMO"
              title="Schedule a Demo in Your Region"
              description="Pick the region closest to you. We'll match you with a solutions engineer who understands your market and speaks your language."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView3 ? "animate" : "initial"}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto"
            >
              {REGIONS.map(({ region, description, timezone }) => (
                <motion.div key={region} variants={fadeInUp}>
                  <Card variant="interactive" padding="lg" className="h-full text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-iris-purple/10 mx-auto mb-4">
                      <Globe className="h-6 w-6 text-iris-violet" aria-hidden />
                    </div>
                    <h3
                      className={cn(
                        "font-semibold text-lg mb-1",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {region}
                    </h3>
                    <Badge variant="outline" className="mb-3">
                      {timezone}
                    </Badge>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      {description}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section variant="default" padding="xl">
        <Container>
          <div ref={ref4}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView4 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-center max-w-2xl mx-auto"
            >
              <h2
                className={cn(
                  "text-3xl sm:text-4xl font-bold tracking-tight",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                Prefer email?
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                Reach our sales team directly at{" "}
                <a
                  href="mailto:sales@dbr77.com"
                  className="text-iris-violet hover:underline"
                >
                  sales@dbr77.com
                </a>{" "}
                or get technical support at{" "}
                <a
                  href="mailto:support@dbr77.com"
                  className="text-iris-violet hover:underline"
                >
                  support@dbr77.com
                </a>
                .
              </p>
              <div className="mt-8">
                <Button variant="primary" size="lg" href="/modules" className="min-w-[200px]">
                  Explore IRIS Modules
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
