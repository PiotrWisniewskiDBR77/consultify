import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { VoiceAssistant } from "@/components/voice/VoiceAssistant";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DBR77 Vector — Industrial AI Engine | DBR77",
  description:
    "DBR77 Vector is a proprietary industrial AI engine trained on real production and transformation cases. Deploy it on-premise, through a private API, or through shared access across the DBR77 ecosystem.",
  keywords: [
    "Industrial AI",
    "Private LLM",
    "Factory AI",
    "Digital transformation AI",
    "On-premise AI",
    "Industrial decision support",
    "Digital Twin AI",
    "Consultify",
    "DBR77",
  ],
  openGraph: {
    title: "DBR77 Vector — Industrial AI Engine",
    description: "Industrial AI trained on real transformation work and embedded across Consultify, Digital Twin, IoT, and Marketplace.",
    type: "website",
    siteName: "DBR77 Vector",
  },
};

const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('iris-theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch(e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <Navbar />
            <main className="min-h-screen">{children}</main>
            <Footer />
            <VoiceAssistant />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
