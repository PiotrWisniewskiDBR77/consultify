export interface FAQItem {
  id: string;
  moduleId: string;
  question: string;
  questionPl?: string;
  questionDe?: string;
  questionAr?: string;
  questionJa?: string;
  questionEs?: string;
  answer: string;
  answerPl?: string;
  answerDe?: string;
  answerAr?: string;
  answerJa?: string;
  answerEs?: string;
  tags?: string[];
}

export function getLocalizedQuestion(faq: FAQItem, lang: string): string {
  if (lang === 'pl' && faq.questionPl) return faq.questionPl;
  if (lang === 'de' && faq.questionDe) return faq.questionDe;
  if (lang === 'ar' && faq.questionAr) return faq.questionAr;
  if (lang === 'ja' && faq.questionJa) return faq.questionJa;
  if (lang === 'es' && faq.questionEs) return faq.questionEs;
  return faq.question;
}

export function getLocalizedAnswer(faq: FAQItem, lang: string): string {
  if (lang === 'pl' && faq.answerPl) return faq.answerPl;
  if (lang === 'de' && faq.answerDe) return faq.answerDe;
  if (lang === 'ar' && faq.answerAr) return faq.answerAr;
  if (lang === 'ja' && faq.answerJa) return faq.answerJa;
  if (lang === 'es' && faq.answerEs) return faq.answerEs;
  return faq.answer;
}

// Default FAQs that apply to all modules
const DEFAULT_FAQS: FAQItem[] = [
  {
    id: 'default-1',
    moduleId: '_default',
    question: 'How do I get started with Consultify?',
    questionPl: 'Jak zacząć korzystać z Consultify?',
    answer:
      'Start by completing your profile setup, then run your first assessment to understand your digital maturity level. The dashboard will guide you through the key features and next steps.',
    answerPl:
      'Zacznij od uzupełnienia profilu, a następnie przeprowadź pierwszą ocenę, aby poznać poziom dojrzałości cyfrowej. Dashboard poprowadzi Cię przez kluczowe funkcje i kolejne kroki.',
    tags: ['getting-started', 'onboarding'],
  },
  {
    id: 'default-2',
    moduleId: '_default',
    question: 'How can I contact support?',
    questionPl: 'Jak mogę skontaktować się ze wsparciem?',
    answer:
      'You can reach our support team via the Feedback button in the sidebar, or email us at support@consultify.app. For urgent issues, use the "Critical" severity option in the feedback form.',
    answerPl:
      'Możesz skontaktować się z zespołem wsparcia przez przycisk Feedback w sidebarze lub wysłać email na support@consultify.app. W pilnych sprawach użyj opcji "Krytyczny" w formularzu.',
    tags: ['support', 'contact'],
  },
  {
    id: 'default-3',
    moduleId: '_default',
    question: 'What keyboard shortcuts are available?',
    questionPl: 'Jakie skróty klawiszowe są dostępne?',
    answer:
      'Press Cmd/Ctrl + K to open command palette, Cmd/Ctrl + / to toggle AI chat, and ? to open this help panel. You can customize shortcuts in Settings > Preferences.',
    answerPl:
      'Naciśnij Cmd/Ctrl + K aby otworzyć paletę poleceń, Cmd/Ctrl + / aby przełączyć chat AI, oraz ? aby otworzyć panel pomocy. Skróty możesz dostosować w Ustawienia > Preferencje.',
    tags: ['shortcuts', 'productivity'],
  },
  {
    id: 'default-4',
    moduleId: '_default',
    question: 'How do I use the AI Assistant?',
    questionPl: 'Jak korzystać z Asystenta AI?',
    answer:
      'The AI Assistant can answer questions about the platform, help analyze your data, and provide recommendations. Click the AI tab in this help panel or use Cmd/Ctrl + / to start a conversation.',
    answerPl:
      'Asystent AI odpowiada na pytania o platformę, pomaga analizować dane i udziela rekomendacji. Kliknij zakładkę AI w tym panelu lub użyj Cmd/Ctrl + / aby rozpocząć rozmowę.',
    tags: ['ai', 'assistant'],
  },
  {
    id: 'default-5',
    moduleId: '_default',
    question: 'Can I export my data?',
    questionPl: 'Czy mogę eksportować swoje dane?',
    answer:
      'Yes! Most views have an Export button that lets you download data as PDF, Excel, or CSV. Reports can also be shared via public links or downloaded for offline use.',
    answerPl:
      'Tak! Większość widoków ma przycisk Eksport pozwalający pobrać dane jako PDF, Excel lub CSV. Raporty można też udostępniać przez publiczne linki lub pobierać offline.',
    tags: ['export', 'data'],
  },
];

// Module-specific FAQs
const MODULE_FAQS: FAQItem[] = [
  // Dashboard FAQs
  {
    id: 'dashboard-1',
    moduleId: 'dashboard',
    question: 'What do the dashboard metrics mean?',
    questionPl: 'Co oznaczają metryki na dashboardzie?',
    answer:
      'The maturity score shows your overall digital readiness (0-100). Initiative progress tracks active projects. The activity feed shows recent actions by your team.',
    answerPl:
      'Wskaźnik dojrzałości pokazuje ogólną gotowość cyfrową (0-100). Postęp inicjatyw śledzi aktywne projekty. Feed aktywności pokazuje ostatnie działania zespołu.',
    tags: ['dashboard', 'metrics'],
  },
  {
    id: 'dashboard-2',
    moduleId: 'dashboard',
    question: 'How often are dashboard metrics updated?',
    questionPl: 'Jak często aktualizowane są metryki?',
    answer:
      'Metrics are updated in real-time as your team works. Assessment scores update after each completed evaluation. You can also manually refresh using the refresh button.',
    answerPl:
      'Metryki są aktualizowane w czasie rzeczywistym. Wyniki ocen aktualizują się po każdej ukończonej ewaluacji. Możesz też odświeżyć ręcznie przyciskiem.',
    tags: ['dashboard', 'realtime'],
  },
  // Assessment FAQs
  {
    id: 'assessment-1',
    moduleId: 'assessment',
    question: 'Which assessment framework should I choose?',
    questionPl: 'Który framework oceny wybrać?',
    answer:
      'DRD is best for general digital readiness. SIRI focuses on Industry 4.0 manufacturing. CMMI is ideal for software development maturity. Your consultant can recommend the best fit.',
    answerPl:
      'DRD jest najlepszy dla ogólnej gotowości cyfrowej. SIRI skupia się na produkcji Przemysłu 4.0. CMMI idealny dla dojrzałości wytwarzania oprogramowania.',
    tags: ['assessment', 'frameworks'],
  },
  {
    id: 'assessment-2',
    moduleId: 'assessment',
    question: 'How long does an assessment take?',
    questionPl: 'Ile trwa przeprowadzenie oceny?',
    answer:
      'A quick assessment takes 15-30 minutes. Full assessments with all axes can take 2-4 hours. You can save progress and continue later.',
    answerPl:
      'Szybka ocena trwa 15-30 minut. Pełne oceny ze wszystkimi osiami mogą zająć 2-4 godziny. Możesz zapisać postęp i kontynuować później.',
    tags: ['assessment', 'time'],
  },
  // Initiatives FAQs
  {
    id: 'initiatives-1',
    moduleId: 'initiatives',
    question: 'How do I create an initiative from assessment results?',
    questionPl: 'Jak utworzyć inicjatywę z wyników oceny?',
    answer:
      'After completing an assessment, click "Generate Initiatives" to create recommended projects based on identified gaps. You can also create initiatives manually from the + button.',
    answerPl:
      'Po ukończeniu oceny kliknij "Generuj Inicjatywy" aby utworzyć rekomendowane projekty na podstawie zidentyfikowanych luk. Możesz też utworzyć inicjatywy ręcznie.',
    tags: ['initiatives', 'assessment'],
  },
  {
    id: 'initiatives-2',
    moduleId: 'initiatives',
    question: 'What are stage gates?',
    questionPl: 'Czym są stage gates?',
    answer:
      'Stage gates are approval checkpoints in the initiative lifecycle. Each gate requires review and sign-off before the project can proceed to the next phase.',
    answerPl:
      'Stage gates to punkty kontrolne zatwierdzania w cyklu życia inicjatywy. Każda brama wymaga przeglądu i akceptacji przed przejściem do kolejnej fazy.',
    tags: ['initiatives', 'governance'],
  },
  // Settings FAQs
  {
    id: 'settings-1',
    moduleId: 'settings',
    question: 'How do I change my notification preferences?',
    questionPl: 'Jak zmienić preferencje powiadomień?',
    answer:
      'Go to Settings > Notifications to configure email, in-app, and push notification preferences. You can set different rules for different types of events.',
    answerPl:
      'Przejdź do Ustawienia > Powiadomienia aby skonfigurować preferencje email, w aplikacji i push. Możesz ustawić różne reguły dla różnych typów zdarzeń.',
    tags: ['settings', 'notifications'],
  },
  {
    id: 'settings-2',
    moduleId: 'settings',
    question: 'How do I enable dark mode?',
    questionPl: 'Jak włączyć tryb ciemny?',
    answer:
      'Click your avatar in the sidebar and select "Dark Mode", or go to Settings > Appearance. You can also set it to follow your system preferences.',
    answerPl:
      'Kliknij swój avatar w sidebarze i wybierz "Tryb ciemny", lub przejdź do Ustawienia > Wygląd. Możesz też ustawić śledzenie preferencji systemowych.',
    tags: ['settings', 'theme'],
  },
  // Admin FAQs
  {
    id: 'admin-1',
    moduleId: 'admin',
    question: 'How do I invite team members?',
    questionPl: 'Jak zaprosić członków zespołu?',
    answer:
      'Go to Admin > Team and click "Invite User". Enter their email address and select their role. They will receive an invitation email to join your organization.',
    answerPl:
      'Przejdź do Admin > Zespół i kliknij "Zaproś użytkownika". Wprowadź adres email i wybierz rolę. Otrzymają zaproszenie email do dołączenia do organizacji.',
    tags: ['admin', 'team'],
  },
  {
    id: 'admin-2',
    moduleId: 'admin',
    question: 'How do I manage user permissions?',
    questionPl: 'Jak zarządzać uprawnieniami użytkowników?',
    answer:
      'In Admin > Team, click on a user to edit their role. Roles include Viewer, Member, Manager, and Admin. Each role has different access levels to features and data.',
    answerPl:
      'W Admin > Zespół kliknij użytkownika aby edytować jego rolę. Role to Przeglądający, Członek, Menedżer i Admin. Każda rola ma różne poziomy dostępu.',
    tags: ['admin', 'permissions'],
  },
  // Reports FAQs
  {
    id: 'reports-1',
    moduleId: 'reports',
    question: 'How do I create a custom report?',
    questionPl: 'Jak utworzyć własny raport?',
    answer:
      'Click "New Report" and select the data sources you want to include. Use the drag-and-drop builder to add charts, tables, and text sections. Save as template for reuse.',
    answerPl:
      'Kliknij "Nowy Raport" i wybierz źródła danych. Użyj buildera drag-and-drop aby dodać wykresy, tabele i sekcje tekstowe. Zapisz jako szablon do ponownego użycia.',
    tags: ['reports', 'customization'],
  },
  {
    id: 'reports-2',
    moduleId: 'reports',
    question: 'Can I share reports with external stakeholders?',
    questionPl: 'Czy mogę udostępniać raporty zewnętrznym interesariuszom?',
    answer:
      'Yes! Generate a public link for view-only access, or export as PDF. Public links can be password-protected and set to expire after a certain date.',
    answerPl:
      'Tak! Wygeneruj publiczny link do tylko-podglądu lub eksportuj jako PDF. Linki publiczne mogą być chronione hasłem i mieć datę wygaśnięcia.',
    tags: ['reports', 'sharing'],
  },
];

export const FAQ_CONTENT: FAQItem[] = [...DEFAULT_FAQS, ...MODULE_FAQS];

export function getFAQsForModule(id: string): FAQItem[] {
  // Get module-specific FAQs plus default FAQs
  const moduleFaqs = FAQ_CONTENT.filter((faq) => faq.moduleId === id);
  const defaultFaqs = FAQ_CONTENT.filter((faq) => faq.moduleId === '_default');

  // If no module-specific FAQs, return defaults
  if (moduleFaqs.length === 0) {
    return defaultFaqs;
  }

  // Return module FAQs first, then defaults
  return [...moduleFaqs, ...defaultFaqs];
}

export function searchFAQs(query: string, lang?: string): FAQItem[] {
  const lowerQuery = query.toLowerCase();
  return FAQ_CONTENT.filter((faq) => {
    const questionToSearch = getLocalizedQuestion(faq, lang || 'en');
    const answerToSearch = getLocalizedAnswer(faq, lang || 'en');
    return (
      questionToSearch.toLowerCase().includes(lowerQuery) ||
      answerToSearch.toLowerCase().includes(lowerQuery) ||
      faq.question.toLowerCase().includes(lowerQuery) ||
      (faq.tags && faq.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)))
    );
  });
}

export function getDefaultFAQs(): FAQItem[] {
  return FAQ_CONTENT.filter((faq) => faq.moduleId === '_default');
}
