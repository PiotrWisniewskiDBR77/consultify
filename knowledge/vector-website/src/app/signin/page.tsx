"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { motion } from "framer-motion";
import { Mail, Lock, CheckCircle } from "lucide-react";

export default function SignInPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );
  const [submitted, setSubmitted] = useState(false);

  const inputClasses = cn(
    "w-full rounded-lg border px-4 py-3 pl-11 text-sm outline-none transition-colors focus:ring-2 focus:ring-iris-purple/30",
    isLight
      ? "bg-white border-black/[0.08] text-slate-900 placeholder:text-slate-400"
      : "bg-navy-800/50 border-white/[0.08] text-white placeholder:text-slate-500"
  );

  const labelClasses = cn(
    "block text-sm font-medium mb-1.5",
    isLight ? "text-slate-700" : "text-slate-300"
  );

  function validate(): boolean {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    else if (password.length < 6)
      next.password = "Password must be at least 6 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) setSubmitted(true);
  }

  const socialBtnClasses = cn(
    "flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
    isLight
      ? "border-black/[0.08] bg-white text-slate-700 hover:bg-slate-50"
      : "border-white/[0.08] bg-navy-800/50 text-slate-200 hover:bg-navy-700/50"
  );

  return (
    <Section variant="default" padding="xl">
      <Container size="sm">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-md"
        >
          <div className="mb-8 text-center">
            <h1
              className={cn(
                "text-3xl sm:text-4xl font-bold tracking-tight",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              Sign In
            </h1>
            <p
              className={cn(
                "mt-2 text-base",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Welcome back to IRIS
            </p>
          </div>

          <Card variant="default" padding="lg">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-8 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle className="h-7 w-7 text-emerald-500" />
                </div>
                <h2
                  className={cn(
                    "text-xl font-semibold",
                    isLight ? "text-slate-900" : "text-white"
                  )}
                >
                  Signed in successfully
                </h2>
                <p
                  className={cn(
                    "text-sm",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  Redirecting you to the dashboard&hellip;
                </p>
              </motion.div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div>
                    <label htmlFor="signin-email" className={labelClasses}>
                      Email
                    </label>
                    <div className="relative">
                      <Mail
                        className={cn(
                          "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2",
                          isLight ? "text-slate-400" : "text-slate-500"
                        )}
                        aria-hidden
                      />
                      <input
                        id="signin-email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                        }}
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? "signin-email-err" : undefined}
                        className={cn(
                          inputClasses,
                          errors.email && "border-red-500 focus:ring-red-400/30"
                        )}
                      />
                    </div>
                    {errors.email && (
                      <p id="signin-email-err" className="mt-1 text-xs text-red-500">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="signin-password" className={labelClasses}>
                        Password
                      </label>
                      <a
                        href="#"
                        className="text-xs text-iris-violet hover:underline"
                      >
                        Forgot password?
                      </a>
                    </div>
                    <div className="relative">
                      <Lock
                        className={cn(
                          "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2",
                          isLight ? "text-slate-400" : "text-slate-500"
                        )}
                        aria-hidden
                      />
                      <input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                        }}
                        aria-invalid={!!errors.password}
                        aria-describedby={errors.password ? "signin-password-err" : undefined}
                        className={cn(
                          inputClasses,
                          errors.password && "border-red-500 focus:ring-red-400/30"
                        )}
                      />
                    </div>
                    {errors.password && (
                      <p id="signin-password-err" className="mt-1 text-xs text-red-500">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    type="submit"
                    className="w-full"
                  >
                    Sign In
                  </Button>
                </form>

                <div className="relative my-6">
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center",
                      isLight ? "border-black/[0.06]" : "border-white/[0.06]"
                    )}
                  >
                    <span className={cn("w-full border-t", isLight ? "border-black/[0.08]" : "border-white/[0.08]")} />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span
                      className={cn(
                        "px-3",
                        isLight
                          ? "bg-white text-slate-400"
                          : "bg-navy-800/40 text-slate-500"
                      )}
                    >
                      or continue with
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button type="button" className={socialBtnClasses}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Google
                  </button>
                  <button type="button" className={socialBtnClasses}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </button>
                </div>
              </>
            )}
          </Card>

          {!submitted && (
            <p
              className={cn(
                "mt-6 text-center text-sm",
                isLight ? "text-slate-500" : "text-slate-400"
              )}
            >
              Don&apos;t have an account?{" "}
              <a
                href="/demo"
                className="font-medium text-iris-violet hover:underline"
              >
                Start a free trial
              </a>
            </p>
          )}
        </motion.div>
      </Container>
    </Section>
  );
}
