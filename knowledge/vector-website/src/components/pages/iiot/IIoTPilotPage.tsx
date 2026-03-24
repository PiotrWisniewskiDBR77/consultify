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
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  User2,
  ClipboardList,
  Factory,
  Wifi,
} from "lucide-react";

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

export default function IIoTPilotPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("iiotPilot");

  const heroRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const heroInView = useInView(heroRef, { once: true, margin: "-40px" });
  const contentInView = useInView(contentRef, { once: true, margin: "-80px" });
  const formInView = useInView(formRef, { once: true, margin: "-80px" });

  const [form, setForm] = useState({
    fullName: "",
    company: "",
    workEmail: "",
    phone: "",
    plantLocation: "",
    machinesRange: "",
    goal: "",
    connectivity: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!form.fullName.trim()) newErrors.fullName = t("form.errors.fullNameRequired");
    if (!form.company.trim()) newErrors.company = t("form.errors.companyRequired");
    if (!form.workEmail.trim()) newErrors.workEmail = t("form.errors.emailRequired");
    if (form.workEmail && !validateEmail(form.workEmail)) newErrors.workEmail = t("form.errors.emailInvalid");
    if (!form.machinesRange.trim()) newErrors.machinesRange = t("form.errors.scaleRequired");
    if (!form.goal.trim()) newErrors.goal = t("form.errors.goalRequired");

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
                <Button variant="primary" size="lg" href="#pilot-form" className="min-w-[220px]">
                  {t("hero.cta.primary")}
                </Button>
                <Button variant="secondary" size="lg" href="/demo" className="min-w-[220px]">
                  {t("hero.cta.secondary")}
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* What you get + timeline */}
      <Section variant="alternate" padding="lg">
        <Container>
          <div ref={contentRef}>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={contentInView ? "animate" : "initial"}
              className="grid grid-cols-1 gap-8 lg:grid-cols-2 max-w-6xl mx-auto"
            >
              <motion.div variants={fadeInUp} transition={{ duration: 0.5 }}>
                <Card variant="glow" padding="lg" className="h-full">
                  <p className="text-sm font-semibold uppercase tracking-widest text-iris-violet mb-3">
                    {t("whatYouGet.label")}
                  </p>
                  <h2
                    className={cn(
                      "text-2xl sm:text-3xl font-bold tracking-tight",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    {t("whatYouGet.title")}
                  </h2>
                  <ul className="mt-6 space-y-3">
                    {[
                      t("whatYouGet.items.i1"),
                      t("whatYouGet.items.i2"),
                      t("whatYouGet.items.i3"),
                      t("whatYouGet.items.i4"),
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-iris-green mt-0.5 flex-shrink-0" aria-hidden />
                        <p className={cn("text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>
                          {item}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8 grid grid-cols-2 gap-4">
                    {[
                      { icon: ClipboardList, label: t("whatYouGet.badges.checklist") },
                      { icon: Factory, label: t("whatYouGet.badges.scope") },
                      { icon: Wifi, label: t("whatYouGet.badges.connectivity") },
                      { icon: ArrowRight, label: t("whatYouGet.badges.report") },
                    ].map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
                          isLight
                            ? "border-black/[0.08] bg-white text-slate-700"
                            : "border-white/[0.08] bg-navy-800/40 text-slate-300"
                        )}
                      >
                        <Icon className="h-4 w-4 text-iris-violet" aria-hidden />
                        {label}
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={fadeInUp} transition={{ duration: 0.5 }}>
                <Card variant="gradient-border" padding="lg" className="h-full">
                  <p className="text-sm font-semibold uppercase tracking-widest text-iris-violet mb-3">
                    {t("timeline.label")}
                  </p>
                  <h2
                    className={cn(
                      "text-2xl sm:text-3xl font-bold tracking-tight",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    {t("timeline.title")}
                  </h2>
                  <ol className="mt-6 space-y-4">
                    {[
                      { title: t("timeline.steps.s1.title"), desc: t("timeline.steps.s1.description") },
                      { title: t("timeline.steps.s2.title"), desc: t("timeline.steps.s2.description") },
                      { title: t("timeline.steps.s3.title"), desc: t("timeline.steps.s3.description") },
                      { title: t("timeline.steps.s4.title"), desc: t("timeline.steps.s4.description") },
                      { title: t("timeline.steps.s5.title"), desc: t("timeline.steps.s5.description") },
                    ].map((s, idx) => (
                      <li key={s.title} className="flex gap-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-iris-purple/15 text-iris-violet text-sm font-semibold">
                          {idx + 1}
                        </div>
                        <div>
                          <p className={cn("font-semibold", isLight ? "text-slate-900" : "text-white")}>{s.title}</p>
                          <p className={cn("text-sm mt-1 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                            {s.desc}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <p className={cn("mt-8 text-sm", isLight ? "text-slate-600" : "text-slate-400")}>
                    {t("timeline.note.prefix")}{" "}
                    <a className="text-iris-violet hover:underline" href="/demo">
                      {t("timeline.note.link")}
                    </a>
                    {t("timeline.note.suffix")}
                  </p>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Form */}
      <Section variant="default" padding="lg">
        <Container>
          <div ref={formRef} id="pilot-form">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={formInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-5xl mx-auto"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card variant="glow" padding="lg" className="h-full">
                  <p className="text-sm font-semibold uppercase tracking-widest text-iris-violet mb-3">
                    {t("checklist.label")}
                  </p>
                  <h2 className={cn("text-2xl font-bold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
                    {t("checklist.title")}
                  </h2>
                  <ul className="mt-6 space-y-3">
                    {[
                      t("checklist.items.i1"),
                      t("checklist.items.i2"),
                      t("checklist.items.i3"),
                      t("checklist.items.i4"),
                      t("checklist.items.i5"),
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-iris-green mt-0.5 flex-shrink-0" aria-hidden />
                        <p className={cn("text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>
                          {item}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { icon: MapPin, text: t("checklist.badges.location") },
                      { icon: Factory, text: t("checklist.badges.scope") },
                      { icon: Wifi, text: t("checklist.badges.connectivity") },
                    ].map(({ icon: Icon, text }) => (
                      <div
                        key={text}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
                          isLight
                            ? "border-black/[0.08] bg-white text-slate-700"
                            : "border-white/[0.08] bg-navy-800/40 text-slate-300"
                        )}
                      >
                        <Icon className="h-4 w-4 text-iris-violet" aria-hidden />
                        {text}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card variant="gradient-border" padding="lg">
                  <p className="text-sm font-semibold uppercase tracking-widest text-iris-violet mb-3">
                    {t("form.title")}
                  </p>

                  {submitted ? (
                    <div className="py-10 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-iris-green/15 mb-5">
                        <CheckCircle2 className="h-7 w-7 text-iris-green" aria-hidden />
                      </div>
                      <h3 className={cn("text-xl font-semibold", isLight ? "text-slate-900" : "text-white")}>
                        {t("form.success.title")}
                      </h3>
                      <p className={cn("mt-2 text-sm", isLight ? "text-slate-600" : "text-slate-400")}>
                        {t("form.success.description")}
                      </p>
                      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Button variant="primary" size="md" href="/demo">
                          {t("form.success.ctaDemo")}
                        </Button>
                        <Button variant="secondary" size="md" href="/">
                          {t("form.success.ctaProduct")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="mt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className={labelClasses} htmlFor="fullName">
                            {t("form.labels.fullName")}
                          </label>
                          <div className="relative">
                            <User2 className={cn("absolute left-3 top-3.5 h-4 w-4", isLight ? "text-slate-400" : "text-slate-500")} aria-hidden />
                            <input
                              id="fullName"
                              value={form.fullName}
                              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                              className={cn(inputClasses, "pl-10", errors.fullName && "border-red-400/60 focus:ring-red-400/30")}
                              placeholder={t("form.placeholders.fullName")}
                            />
                          </div>
                          {errors.fullName && <p className="mt-1 text-xs text-red-400">{errors.fullName}</p>}
                        </div>

                        <div className="sm:col-span-2">
                          <label className={labelClasses} htmlFor="company">
                            {t("form.labels.company")}
                          </label>
                          <div className="relative">
                            <Building2 className={cn("absolute left-3 top-3.5 h-4 w-4", isLight ? "text-slate-400" : "text-slate-500")} aria-hidden />
                            <input
                              id="company"
                              value={form.company}
                              onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                              className={cn(inputClasses, "pl-10", errors.company && "border-red-400/60 focus:ring-red-400/30")}
                              placeholder={t("form.placeholders.company")}
                            />
                          </div>
                          {errors.company && <p className="mt-1 text-xs text-red-400">{errors.company}</p>}
                        </div>

                        <div className="sm:col-span-2">
                          <label className={labelClasses} htmlFor="workEmail">
                            {t("form.labels.workEmail")}
                          </label>
                          <div className="relative">
                            <Mail className={cn("absolute left-3 top-3.5 h-4 w-4", isLight ? "text-slate-400" : "text-slate-500")} aria-hidden />
                            <input
                              id="workEmail"
                              value={form.workEmail}
                              onChange={(e) => setForm((p) => ({ ...p, workEmail: e.target.value }))}
                              className={cn(inputClasses, "pl-10", errors.workEmail && "border-red-400/60 focus:ring-red-400/30")}
                              placeholder={t("form.placeholders.workEmail")}
                            />
                          </div>
                          {errors.workEmail && <p className="mt-1 text-xs text-red-400">{errors.workEmail}</p>}
                        </div>

                        <div>
                          <label className={labelClasses} htmlFor="phone">
                            {t("form.labels.phone")}
                          </label>
                          <div className="relative">
                            <Phone className={cn("absolute left-3 top-3.5 h-4 w-4", isLight ? "text-slate-400" : "text-slate-500")} aria-hidden />
                            <input
                              id="phone"
                              value={form.phone}
                              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                              className={cn(inputClasses, "pl-10")}
                              placeholder={t("form.placeholders.phone")}
                            />
                          </div>
                        </div>

                        <div>
                          <label className={labelClasses} htmlFor="plantLocation">
                            {t("form.labels.plantLocation")}
                          </label>
                          <div className="relative">
                            <MapPin className={cn("absolute left-3 top-3.5 h-4 w-4", isLight ? "text-slate-400" : "text-slate-500")} aria-hidden />
                            <input
                              id="plantLocation"
                              value={form.plantLocation}
                              onChange={(e) => setForm((p) => ({ ...p, plantLocation: e.target.value }))}
                              className={cn(inputClasses, "pl-10")}
                              placeholder={t("form.placeholders.plantLocation")}
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label className={labelClasses} htmlFor="machinesRange">
                            {t("form.labels.scale")}
                          </label>
                          <select
                            id="machinesRange"
                            value={form.machinesRange}
                            onChange={(e) => setForm((p) => ({ ...p, machinesRange: e.target.value }))}
                            className={cn(inputClasses, errors.machinesRange && "border-red-400/60 focus:ring-red-400/30")}
                          >
                            <option value="">{t("form.scaleOptions.placeholder")}</option>
                            <option value="1-10">{t("form.scaleOptions.o1")}</option>
                            <option value="11-50">{t("form.scaleOptions.o2")}</option>
                            <option value="51-200">{t("form.scaleOptions.o3")}</option>
                            <option value="200+">{t("form.scaleOptions.o4")}</option>
                          </select>
                          {errors.machinesRange && <p className="mt-1 text-xs text-red-400">{errors.machinesRange}</p>}
                        </div>

                        <div className="sm:col-span-2">
                          <label className={labelClasses} htmlFor="connectivity">
                            {t("form.labels.connectivity")}
                          </label>
                          <select
                            id="connectivity"
                            value={form.connectivity}
                            onChange={(e) => setForm((p) => ({ ...p, connectivity: e.target.value }))}
                            className={inputClasses}
                          >
                            <option value="">{t("form.connectivityOptions.placeholder")}</option>
                            <option value="wifi">{t("form.connectivityOptions.wifi")}</option>
                            <option value="ethernet">{t("form.connectivityOptions.ethernet")}</option>
                            <option value="sim">{t("form.connectivityOptions.sim")}</option>
                            <option value="lorawan">{t("form.connectivityOptions.lorawan")}</option>
                            <option value="unknown">{t("form.connectivityOptions.unknown")}</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className={labelClasses} htmlFor="goal">
                            {t("form.labels.goal")}
                          </label>
                          <textarea
                            id="goal"
                            value={form.goal}
                            onChange={(e) => setForm((p) => ({ ...p, goal: e.target.value }))}
                            className={cn(
                              inputClasses,
                              "min-h-[120px] resize-none",
                              errors.goal && "border-red-400/60 focus:ring-red-400/30"
                            )}
                            placeholder={t("form.placeholders.goal")}
                          />
                          {errors.goal && <p className="mt-1 text-xs text-red-400">{errors.goal}</p>}
                        </div>
                      </div>

                      <div className="mt-6 space-y-3">
                        <Button variant="primary" size="lg" type="submit" className="w-full">
                          {t("form.submit")}
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </Button>
                        <p className={cn("text-xs text-center", isLight ? "text-slate-400" : "text-slate-500")}>
                          {t("form.privacy.prefix")}{" "}
                          <a className="text-iris-violet hover:underline" href="/legal/privacy">
                            {t("form.privacy.link")}
                          </a>
                          {t("form.privacy.suffix")}
                        </p>
                      </div>
                    </form>
                  )}
                </Card>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}

