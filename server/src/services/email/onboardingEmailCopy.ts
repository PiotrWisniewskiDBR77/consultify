/**
 * Copy dictionary for the first-contact onboarding emails (DEC-461): welcome
 * email, email-verification email, and the admin-IAM invitation email
 * (create + resend). English is the source language; Polish is the
 * translation. See `onboardingEmailLocale.ts` for how the language is picked
 * per recipient.
 *
 * Flat `Record<string, string>` keyed dictionaries (same shape as
 * `server/src/services/signals/i18n/dictionary.ts`) rather than a typed
 * interface, so a deleted/renamed key fails at RUNTIME (falls back to the
 * key itself, caught by the "no missing key" test) — not just at compile
 * time — matching how the rest of the codebase tests translation parity.
 */
import type { OnboardingEmailLang } from './onboardingEmailLocale.js';

const en: Record<string, string> = {
  'welcome.subject.base': 'Welcome to Consultify',
  'welcome.subject.demoSuffix': ' (demo account)',
  'welcome.header.title': 'Welcome to Consultify! 🎉',
  'welcome.header.subtitle': 'Your AI-powered consulting platform is ready',
  'welcome.demoBadge': 'Demo account',
  'welcome.greeting': 'Hi {firstName},',
  'welcome.intro': "Thanks for joining Consultify. We're glad to have {companyName} with us.",
  'welcome.demoNote.title': '🧪 Demo account',
  'welcome.demoNote.body':
    "You're using a demo account with sample data. Click around freely — every feature is available.",
  'welcome.whatYouCanDo': 'What you can do here:',
  'welcome.feature.assessments.title': 'Run assessments',
  'welcome.feature.assessments.body':
    'Assess projects, teams and processes with AI-assisted analysis',
  'welcome.feature.ai.title': 'AI Assistant',
  'welcome.feature.ai.body': 'Get insights and recommendations from your AI advisor',
  'welcome.feature.dashboard.title': 'Analytics dashboard',
  'welcome.feature.dashboard.body': 'Track progress and measure impact across the organization',
  'welcome.feature.team.title': 'Team collaboration',
  'welcome.feature.team.body': 'Work together on initiatives and decisions',
  'welcome.cta.dashboard': 'Go to dashboard →',
  'welcome.help.title': 'Need help getting started?',
  'welcome.help.center': 'Visit the Help Center',
  'welcome.help.inviteTeam': 'Invite people from your team',
  'welcome.help.contact': 'Contact our support',
  'welcome.signoff.line': "We're here to help.",
  'welcome.signoff.closing': 'Best regards,',
  'welcome.team': 'The Consultify Team',
  'welcome.footer.rights': 'All rights reserved.',
  'welcome.footer.settings': 'Settings',
  'welcome.footer.help': 'Help',
  'welcome.footer.contact': 'Contact',
  'welcome.footer.address': 'DBR77 Consultify Sp. z o.o. | Warsaw, Poland',

  'verify.subject': 'Verify your email',
  'verify.greeting': 'Hi {firstName},',
  'verify.intro': 'Please verify your email by clicking the link below:',
  'verify.disclaimer': "If you didn't create an account with Consultify, ignore this message.",

  'invite.create.subject': "You've been invited to Consultify",
  'invite.resent.subject': 'Your Consultify invitation (resent)',
  'invite.create.heading': 'Join your team on Consultify',
  'invite.resent.heading': 'Your invitation to Consultify',
  'invite.create.intro': "You've been invited to collaborate in Consultify.",
  'invite.resent.intro': "We're sending your invitation link again.",
  'invite.cta': 'Accept invitation',
};

const pl: Record<string, string> = {
  'welcome.subject.base': 'Witamy w Consultify',
  'welcome.subject.demoSuffix': ' (konto pokazowe)',
  'welcome.header.title': 'Witamy w Consultify! 🎉',
  'welcome.header.subtitle': 'Twoja platforma doradcza z AI jest gotowa',
  'welcome.demoBadge': 'Konto pokazowe',
  'welcome.greeting': 'Cześć {firstName},',
  'welcome.intro':
    'Dziękujemy za dołączenie do Consultify. Cieszymy się, że jest z nami {companyName}.',
  'welcome.demoNote.title': '🧪 Konto pokazowe',
  'welcome.demoNote.body':
    'Korzystasz z konta pokazowego z przykładowymi danymi. Klikaj swobodnie — wszystkie funkcje są dostępne.',
  'welcome.whatYouCanDo': 'Co możesz tu zrobić:',
  'welcome.feature.assessments.title': 'Prowadź oceny',
  'welcome.feature.assessments.body': 'Oceniaj projekty, zespoły i procesy z pomocą analizy AI',
  'welcome.feature.ai.title': 'Asystent AI',
  'welcome.feature.ai.body': 'Otrzymuj wnioski i rekomendacje od swojego doradcy AI',
  'welcome.feature.dashboard.title': 'Pulpit analityczny',
  'welcome.feature.dashboard.body': 'Śledź postęp i mierz efekty w całej organizacji',
  'welcome.feature.team.title': 'Praca zespołowa',
  'welcome.feature.team.body': 'Pracujcie razem nad inicjatywami i decyzjami',
  'welcome.cta.dashboard': 'Przejdź do pulpitu →',
  'welcome.help.title': 'Potrzebujesz pomocy na start?',
  'welcome.help.center': 'Zajrzyj do Centrum pomocy',
  'welcome.help.inviteTeam': 'Zaproś osoby ze swojego zespołu',
  'welcome.help.contact': 'Napisz do naszego wsparcia',
  'welcome.signoff.line': 'Jesteśmy po to, żeby Ci pomóc.',
  'welcome.signoff.closing': 'Pozdrawiamy,',
  'welcome.team': 'Zespół Consultify',
  'welcome.footer.rights': 'Wszelkie prawa zastrzeżone.',
  'welcome.footer.settings': 'Ustawienia',
  'welcome.footer.help': 'Pomoc',
  'welcome.footer.contact': 'Kontakt',
  'welcome.footer.address': 'DBR77 Consultify Sp. z o.o. | Warszawa, Polska',

  'verify.subject': 'Potwierdź swój adres e-mail',
  'verify.greeting': 'Cześć {firstName},',
  'verify.intro': 'Potwierdź swój adres e-mail, klikając poniższy link:',
  'verify.disclaimer': 'Jeśli to nie Ty zakładałeś konto w Consultify, zignoruj tę wiadomość.',

  'invite.create.subject': 'Zaproszenie do Consultify',
  'invite.resent.subject': 'Twoje zaproszenie do Consultify (ponownie)',
  'invite.create.heading': 'Dołącz do zespołu w Consultify',
  'invite.resent.heading': 'Twoje zaproszenie do Consultify',
  'invite.create.intro': 'Zaproszono Cię do wspólnej pracy w Consultify.',
  'invite.resent.intro': 'Wysyłamy Twój link z zaproszeniem jeszcze raz.',
  'invite.cta': 'Przyjmij zaproszenie',
};

const DICTIONARIES: Record<OnboardingEmailLang, Record<string, string>> = { en, pl };

/**
 * Every key that MUST exist in both dictionaries. Kept separate from the
 * dictionaries themselves so a key removed from one side (but not the
 * other) is caught explicitly, rather than silently falling back to the
 * English string inside a Polish email.
 */
export const ONBOARDING_EMAIL_COPY_KEYS: string[] = Object.keys(en);

/**
 * Translate one onboarding-email copy key for the given language.
 * Unknown keys resolve to the key itself (loud — visible in a snapshot —
 * rather than throwing and killing email delivery).
 */
export function t(
  lang: OnboardingEmailLang,
  key: string,
  params: Record<string, string> = {}
): string {
  const dictionary = DICTIONARIES[lang] || en;
  const template = dictionary[key] ?? key;
  return template.replace(/\{([^}]+)\}/g, (_, name: string) => params[name] ?? `{${name}}`);
}
