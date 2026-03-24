"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Play, ArrowRight, CheckCircle2, Mail, User2, Building2 } from "lucide-react";
import { useTranslations } from "next-intl";

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function IIoTDemoPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("iiotDemo");

  const heroRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  const heroInView = useInView(heroRef, { once: true, margin: "-40px" });
  const optionsInView = useInView(optionsRef, { once: true, margin: "-80px" });
  const featuresInView = useInView(featuresRef, { once: true, margin: "-80px" });

  const [form, setForm] = useState({
    fullName: "",
    company: "",
    email: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!form.fullName.trim()) newErrors.fullName = t("form.errors.fullNameRequired");
    if (!form.company.trim()) newErrors.company = t("form.errors.companyRequired");
    if (!form.email.trim()) {
      newErrors.email = t("form.errors.emailRequired");
    } else if (!validateEmail(form.email)) {
      newErrors.email = t("form.errors.emailInvalid");
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) setSubmitted(true);
  }

  const inputClasses = cn(
    "w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-iris-purple/30",
    isLight
      ? "bg-white border-black/[0.08] text-slate-900 placeholder:text-slate-400"
      : "bg-navy-800/50 border-white/[0.08] text-white placeholder:text-slate-500"
  );

  const labelClasses = cn("block text-sm font-medium mb-1.5", isLight ? "text-slate-700" : "text-slate-300");

  return (
    <>
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-16 sm:pb-20",
          isLight ? "bg-white" : "bg-navy-950",
          !isLight && "bg-gradient-hero",
          !isLight && "grid-pattern"
        )}
      >
        <Image
          src="/images/iiot/hero-bg.png"
          alt=""
          role="presentation"
          fill
          className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")}
          quality={75}
          priority
        />
        <Container size="lg" className="relative z-10">
          <div ref={heroRef}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center text-center max-w-4xl mx-auto"
            >
              <h1
                className={cn(
                  "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                {t("hero.title")}
              </h1>
              <p
                className={cn(
                  "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-300"
                )}
              >
                {t("hero.subtitle")}
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button variant="primary" size="lg" href="/pilot" className="min-w-[220px]">
                  {t("hero.cta.pilot")}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  href="/"
                  className={cn(
                    "min-w-[220px]",
                    isLight && "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  {t("hero.cta.back")}
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Two Options */}
      <Section variant="alternate" padding="lg">
        <Container>
          <div ref={optionsRef}>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={optionsInView ? "animate" : "initial"}
              className="grid grid-cols-1 gap-8 lg:grid-cols-2 max-w-5xl mx-auto"
            >
              {/* Video tour */}
              <motion.div variants={fadeInUp} transition={{ duration: 0.5 }}>
                <Card variant="glow" padding="lg" className="h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-iris-purple/10">
                      <Play className="h-5 w-5 text-iris-violet" aria-hidden />
                    </div>
                    <h2 className={cn("text-xl font-semibold", isLight ? "text-slate-900" : "text-white")}>
                      {t("options.video.title")}
                    </h2>
                  </div>
                  <p className={cn("text-sm leading-relaxed mb-6", isLight ? "text-slate-600" : "text-slate-400")}>
                    {t("options.video.description")}
                  </p>
                  <div
                    className={cn(
                      "relative flex-1 min-h-[220px] rounded-lg flex items-center justify-center cursor-pointer group transition-all",
                      isLight ? "bg-slate-100 border border-black/[0.06]" : "bg-navy-800/60 border border-white/[0.06]"
                    )}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-iris-purple/15 group-hover:bg-iris-purple/25 transition-colors">
                        <Play className="h-7 w-7 text-iris-violet ml-0.5" aria-hidden />
                      </div>
                      <span className={cn("text-sm font-medium", isLight ? "text-slate-500" : "text-slate-400")}>
                        {t("options.video.placeholder")}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Interactive demo */}
              <motion.div variants={fadeInUp} transition={{ duration: 0.5 }}>
                <Card variant="gradient-border" padding="lg" className="h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-iris-purple/10">
                      <Building2 className="h-5 w-5 text-iris-violet" aria-hidden />
                    </div>
                    <h2 className={cn("text-xl font-semibold", isLight ? "text-slate-900" : "text-white")}>
                      {t("options.interactive.title")}
                    </h2>
                  </div>
                  <p className={cn("text-sm leading-relaxed mb-6", isLight ? "text-slate-600" : "text-slate-400")}>
                    {t("options.interactive.description")}
                  </p>

                  {submitted ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      className="flex-1 flex flex-col items-center justify-center text-center py-8"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
                        <CheckCircle2 className="h-7 w-7 text-emerald-500" aria-hidden />
                      </div>
                      <h3 className={cn("text-lg font-semibold mb-2", isLight ? "text-slate-900" : "text-white")}>
                        {t("options.interactive.success.title")}
                      </h3>
                      <p className={cn("text-sm max-w-xs", isLight ? "text-slate-600" : "text-slate-400")}>
                        {t("options.interactive.success.description")}
                      </p>
                      <div className="mt-6">
                        <Button variant="primary" size="md" href="/pilot">
                          {t("options.interactive.success.cta")}
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                      <div className="space-y-4 flex-1">
                        <div>
                          <label className={labelClasses} htmlFor="fullName">
                            {t("form.labels.fullName")}
                          </label>
                          <div className="relative">
                            <User2
                              className={cn(
                                "absolute left-3 top-3.5 h-4 w-4",
                                isLight ? "text-slate-400" : "text-slate-500"
                              )}
                              aria-hidden
                            />
                            <input
                              id="fullName"
                              value={form.fullName}
                              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                              className={cn(
                                inputClasses,
                                "pl-10",
                                errors.fullName && "border-red-400/60 focus:ring-red-400/30"
                              )}
                              placeholder={t("form.placeholders.fullName")}
                            />
                          </div>
                          {errors.fullName && <p className="mt-1 text-xs text-red-400">{errors.fullName}</p>}
                        </div>

                        <div>
                          <label className={labelClasses} htmlFor="company">
                            {t("form.labels.company")}
                          </label>
                          <div className="relative">
                            <Building2
                              className={cn(
                                "absolute left-3 top-3.5 h-4 w-4",
                                isLight ? "text-slate-400" : "text-slate-500"
                              )}
                              aria-hidden
                            />
                            <input
                              id="company"
                              value={form.company}
                              onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                              className={cn(
                                inputClasses,
                                "pl-10",
                                errors.company && "border-red-400/60 focus:ring-red-400/30"
                              )}
                              placeholder={t("form.placeholders.company")}
                            />
                          </div>
                          {errors.company && <p className="mt-1 text-xs text-red-400">{errors.company}</p>}
                        </div>

                        <div>
                          <label className={labelClasses} htmlFor="email">
                            {t("form.labels.email")}
                          </label>
                          <div className="relative">
                            <Mail
                              className={cn(
                                "absolute left-3 top-3.5 h-4 w-4",
                                isLight ? "text-slate-400" : "text-slate-500"
                              )}
                              aria-hidden
                            />
                            <input
                              id="email"
                              type="email"
                              value={form.email}
                              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                              className={cn(
                                inputClasses,
                                "pl-10",
                                errors.email && "border-red-400/60 focus:ring-red-400/30"
                              )}
                              placeholder={t("form.placeholders.email")}
                            />
                          </div>
                          {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
                        </div>
                      </div>

                      <div className="mt-6 space-y-3">
                        <Button variant="primary" size="lg" type="submit" className="w-full">
                          {t("form.submit")}
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </Button>
                        <p className={cn("text-xs text-center", isLight ? "text-slate-400" : "text-slate-500")}>
                          {t("form.note.prefix")}{" "}
                          <a className="text-iris-violet hover:underline" href="/pilot">
                            {t("form.note.link")}
                          </a>
                          {t("form.note.suffix")}
                        </p>
                      </div>
                    </form>
                  )}
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* What you'll see */}
      <Section variant="default" padding="lg">
        <Container>
          <div ref={featuresRef}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={featuresInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <p className="text-sm font-semibold uppercase tracking-widest text-iris-violet mb-3">
                {t("see.label")}
              </p>
              <h2
                className={cn(
                  "text-3xl sm:text-4xl font-bold tracking-tight",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                {t("see.title")}
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg max-w-2xl mx-auto leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                {t("see.description")}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
              {[
                {
                  img: "/images/iiot/mobile-dashboard.png",
                  title: t("see.cards.mobile.title"),
                  desc: t("see.cards.mobile.description"),
                },
                {
                  img: "/images/iiot/tablet-modules.png",
                  title: t("see.cards.tablet.title"),
                  desc: t("see.cards.tablet.description"),
                },
              ].map((b) => (
                <Card key={b.title} variant="glow" padding="lg" className="h-full">
                  <div className="flex flex-col gap-4">
                    <div
                      className={cn(
                        "relative rounded-xl overflow-hidden border aspect-[16/10]",
                        isLight
                          ? "border-black/[0.08] bg-white"
                          : "border-white/[0.08] bg-navy-900/40"
                      )}
                    >
                      <Image src={b.img} alt={b.title} fill className="object-cover" />
                    </div>
                    <h3 className={cn("font-semibold", isLight ? "text-slate-900" : "text-white")}>{b.title}</h3>
                    <p className={cn("text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                      {b.desc}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

