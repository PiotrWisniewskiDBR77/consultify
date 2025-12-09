
import { Language } from './types';

export const translations = {
  sidebar: {
    // Main Sections
    dashboard: { EN: 'Dashboard', PL: 'Pulpit', DE: 'Armaturenbrett', AR: 'لوحة القيادة' },
    quickAssessment: { EN: 'Quick Assessment', PL: 'Szybka Ocena', DE: 'Schnellbewertung', AR: 'التقييم السريع' },
    fullProject: { EN: 'Full Transformation', PL: 'Pełna Transformacja', DE: 'Volle Transformation', AR: 'التحول الكامل' },
    masterclass: { EN: 'Masterclass', PL: 'Masterclass', DE: 'Meisterklasse', AR: 'فئة رئيسية' },
    resources: { EN: 'Resources', PL: 'Zasoby', DE: 'Ressourcen', AR: 'موارد' },
    
    // Quick Steps
    quickStep1: { EN: 'Company & Expectations', PL: 'Firma i Oczekiwania', DE: 'Firma & Erwartungen', AR: 'الشركة والتوقعات' },
    quickStep2: { EN: 'Challenges & Profile Questions', PL: 'Wyzwania i Pytania Profilowe', DE: 'Herausforderungen & Profilfragen', AR: 'التحديات وأسئلة الملف الشخصي' },
    quickStep3: { EN: 'Recommendations', PL: 'Rekomendacje', DE: 'Empfehlungen', AR: 'توصيات' },

    // Full Steps
    fullStep1: { EN: 'Assessment (DRD)', PL: 'Ocena (DRD)', DE: 'Bewertung (DRD)', AR: 'تقييم (DRD)' },
    fullStep1_proc: { EN: 'Processes', PL: 'Procesy', DE: 'Prozesse', AR: 'العمليات' },
    fullStep1_prod: { EN: 'Digital Products', PL: 'Produkty Cyfrowe', DE: 'Digitale Produkte', AR: 'المنتجات الرقمية' },
    fullStep1_model: { EN: 'Business Models', PL: 'Modele Biznesowe', DE: 'Geschäftsmodelle', AR: 'نطاقات الأعمال' },
    fullStep1_data: { EN: 'Data Management', PL: 'Zarządzanie Danymi', DE: 'Datenmanagement', AR: 'إدارة البيانات' },
    fullStep1_cult: { EN: 'Culture', PL: 'Kultura', DE: 'Kultur', AR: 'ثقافة' },
    fullStep1_ai: { EN: 'AI Maturity', PL: 'Dojrzałość AI', DE: 'KI-Reife', AR: 'نضج الذكاء الاصطناعي' },

    fullStep2: { EN: 'Initiatives Generator', PL: 'Generator Inicjatyw', DE: 'Initiativen-Generator', AR: 'مولد المبادرات' },
    fullStep3: { EN: 'Transformation Roadmap', PL: 'Mapa Drogowa', DE: 'Transformations-Roadmap', AR: 'خارطة طريق التحول' },
    fullStep4: { EN: 'Economics & ROI', PL: 'Ekonomia i ROI', DE: 'Wirtschaft & ROI', AR: 'الاقتصاد وعائد الاستثمار' },
    fullStep5: { EN: 'Execution Dashboard', PL: 'Pulpit Wykonawczy', DE: 'Ausführungs-Dashboard', AR: 'لوحة القيادة للتنفيذ' },
    fullStep6: { EN: 'Reports', PL: 'Raporty', DE: 'Berichte', AR: 'التقارير' },

    // Actions
    newConversation: { EN: 'New Conversation', PL: 'Nowa Rozmowa', DE: 'Neues Gespräch', AR: 'محادثة جديدة' },
    settings: { EN: 'Settings', PL: 'Ustawienia', DE: 'Einstellungen', AR: 'الإعدادات' },
    mobileApp: { EN: 'Mobile App', PL: 'Aplikacja Mobilna', DE: 'Mobile App', AR: 'تطبيق الهاتف' },
    logOut: { EN: 'Log Out', PL: 'Wyloguj', DE: 'Abmelden', AR: 'تسجيل خروج' },
  },
  auth: {
    startQuick: { EN: 'Start Your Quick Assessment', PL: 'Rozpocznij Szybką Ocenę', DE: 'Starten Sie Ihre Schnellbewertung', AR: 'ابدأ التقييم السريع' },
    setupFull: { EN: 'Setup Your Full Account', PL: 'Załóż Pełne Konto', DE: 'Vollständiges Konto einrichten', AR: 'إعداد حسابك الكامل' },
    unlockFull: { EN: 'Unlock Full Transformation', PL: 'Odblokuj Pełną Transformację', DE: 'Vollständige Transformation freischalten', AR: 'فتح التحول الكامل' },
    enterCode: { EN: 'Enter the 6-digit access code provided by DBR77.', PL: 'Wprowadź 6-cyfrowy kod dostępu od DBR77.', DE: 'Geben Sie den 6-stelligen Zugangscode ein.', AR: 'أدخل رمز الوصول المكون من 6 أرقام.' },
    verifyCode: { EN: 'Verify Code', PL: 'Zweryfikuj Kod', DE: 'Code überprüfen', AR: 'تحقق من الرمز' },
    personalize: { EN: 'We need a few details to personalize your roadmap.', PL: 'Potrzebujemy kilku szczegółów, aby spersonalizować mapę drogową.', DE: 'Wir benötigen einige Details, um Ihre Roadmap zu personalisieren.', AR: 'نحتاج إلى بعض التفاصيل لتخصيص خارطة الطريق الخاصة بك.' },
    firstName: { EN: 'First Name', PL: 'Imię', DE: 'Vorname', AR: 'الاسم الأول' },
    lastName: { EN: 'Last Name', PL: 'Nazwisko', DE: 'Nachname', AR: 'اسم العائلة' },
    email: { EN: 'Work Email', PL: 'Email służbowy', DE: 'Arbeits-E-Mail', AR: 'البريد الإلكتروني للعمل' },
    phone: { EN: 'Phone Number', PL: 'Numer telefonu', DE: 'Telefonnummer', AR: 'رقم الهاتف' },
    company: { EN: 'Company Name', PL: 'Nazwa Firmy', DE: 'Firmenname', AR: 'اسم الشركة' },
    password: { EN: 'Password (min. 8 chars)', PL: 'Hasło (min. 8 znaków)', DE: 'Passwort (min. 8 Zeichen)', AR: 'كلمة المرور (8 أحرف كحد أدنى)' },
    createStart: { EN: 'Create Account & Start', PL: 'Utwórz Konto i Start', DE: 'Konto erstellen & Starten', AR: 'إنشاء حساب وابدأ' },
    haveAccount: { EN: 'Already have an account?', PL: 'Masz już konto?', DE: 'Haben Sie bereits ein Konto?', AR: 'هل لديك حساب بالفعل؟' },
    noAccount: { EN: "Don't have an account?", PL: 'Nie masz konta?', DE: 'Haben Sie kein Konto?', AR: 'ليس لديك حساب؟' },
    logIn: { EN: 'Log In', PL: 'Zaloguj się', DE: 'Einloggen', AR: 'تسجيل الدخول' },
    createOne: { EN: 'Create one', PL: 'Załóż je', DE: 'Erstellen', AR: 'أنشئ حساباً' },
    welcomeBack: { EN: 'Welcome Back!', PL: 'Witaj ponownie!', DE: 'Willkommen zurück!', AR: 'مرحبًا بعودتك!' },
    signInText: { EN: 'Sign in to continue your transformation journey.', PL: 'Zaloguj się, aby kontynuować transformację.', DE: 'Melden Sie sich an, um Ihre Transformationsreise fortzusetzen.', AR: 'سجل الدخول لمتابعة رحلة التحول الخاصة بك.' },
    backToStart: { EN: 'Back to Start Screen', PL: 'Wróć do ekranu startowego', DE: 'Zurück zum Startbildschirm', AR: 'العودة إلى شاشة البدء' },
  },
  step1: {
    title: { EN: 'Step 1 of 3 — Company & Expectations', PL: 'Krok 1 z 3 — Firma i Oczekiwania', DE: 'Schritt 1 von 3 — Unternehmen & Erwartungen', AR: 'الخطوة 1 من 3 — الشركة والتوقعات' },
    subtitle: { EN: 'Quick Assessment', PL: 'Szybka Ocena', DE: 'Schnellbewertung', AR: 'التقييم السريع' },
    profile: { EN: 'Company Profile', PL: 'Profil Firmy', DE: 'Unternehmensprofil', AR: 'ملف الشركة' },
    role: { EN: 'Role', PL: 'Rola', DE: 'Rolle', AR: 'الدور' },
    industry: { EN: 'Industry', PL: 'Branża', DE: 'Branche', AR: 'الصناعة' },
    size: { EN: 'Size', PL: 'Wielkość', DE: 'Größe', AR: 'الحجم' },
    country: { EN: 'Country', PL: 'Kraj', DE: 'Land', AR: 'البلد' },
    expectations: { EN: 'Challenges & Goals', PL: 'Wyzwania i Cele', DE: 'Herausforderungen & Ziele', AR: 'التحديات والأهداف' },
    mainChallenges: { EN: 'Main Challenges', PL: 'Główne Wyzwania', DE: 'Hauptherausforderungen', AR: 'التحديات الرئيسية' },
    mainGoal: { EN: 'Main Transformation Goal', PL: 'Główny Cel Transformacji', DE: 'Hauptziel der Transformation', AR: 'هدف التحول الرئيسي' },
    horizon: { EN: 'Time Horizon', PL: 'Horyzont Czasowy', DE: 'Zeithorizont', AR: 'الأفق الزمني' },
    nextStep: { EN: 'Go to Action Proposals (Step 2)', PL: 'Przejdź do Propozycji Działań (Krok 2)', DE: 'Zu den Aktionsvorschlägen (Schritt 2)', AR: 'الذهاب إلى مقترحات العمل (الخطوة 2)' },
    notSelected: { EN: 'Not selected yet...', PL: 'Jeszcze nie wybrano...', DE: 'Noch nicht ausgewählt...', AR: 'لم يتم التحديد بعد...' },
    toBeDefined: { EN: 'To be defined...', PL: 'Do zdefiniowania...', DE: 'Zu definieren...', AR: 'يجب تحديده...' },
    months: { EN: 'months', PL: 'miesięcy', DE: 'Monate', AR: 'أشهر' },
  },
  step3: {
    title: { EN: 'Step 3 of 3 — Recommendations', PL: 'Krok 3 z 3 — Rekomendacje', DE: 'Schritt 3 von 3 — Empfehlungen', AR: 'الخطوة 3 من 3 — توصيات' },
    snapshot: { EN: 'Company Snapshot', PL: 'Przegląd Firmy', DE: 'Unternehmensüberblick', AR: 'لمحة عن الشركة' },
    focusAreas: { EN: 'Recommended Focus Areas', PL: 'Rekomendowane Obszary', DE: 'Empfohlene Schwerpunkte', AR: 'مجالات التركيز الموصى بها' },
    quickWins: { EN: 'Actionable Quick Wins', PL: 'Szybkie Wygrane', DE: 'Umsetzbare Quick Wins', AR: 'مكاسب سريعة قابلة للتنفيذ' },
    startFull: { EN: 'Start Full Transformation Project', PL: 'Rozpocznij Pełny Projekt', DE: 'Starten Sie das volle Projekt', AR: 'بدء مشروع التحول الكامل' },
    download: { EN: 'Download Summary', PL: 'Pobierz Podsumowanie', DE: 'Zusammenfassung herunterladen', AR: 'تحميل الملخص' },
    revenue: { EN: 'Revenue', PL: 'Przychody', DE: 'Einnahmen', AR: 'إيرادات' },
    maturity: { EN: 'Digital Maturity', PL: 'Dojrzałość Cyfrowa', DE: 'Digitale Reife', AR: 'النضج الرقمي' },
  },
  chat: {
    header: { EN: 'Transformation Assistant', PL: 'Asystent Transformacji', DE: 'Transformationsassistent', AR: 'مساعد التحول' },
    subHeader: { EN: 'Step 1: Profiling', PL: 'Krok 1: Profilowanie', DE: 'Schritt 1: Profiling', AR: 'الخطوة 1: الملف الشخصي' },
    placeholder: { EN: 'Type your answer...', PL: 'Wpisz odpowiedź...', DE: 'Geben Sie Ihre Antwort ein...', AR: 'اكتب إجابتك...' },
    scripts: {
      intro: {
        EN: `Hello {name}. I am your Transformation Assistant.\n\nIn this Quick Assessment (Free), we will go through 3 steps:\n1. Company & expectations\n2. Challenges & profile questions\n3. Recommendations & quick wins.\n\nShall we start?`,
        PL: `Cześć {name}. Jestem Twoim Asystentem Transformacji.\n\nW tej Szybkiej Ocenie (Free) przejdziemy przez 3 kroki:\n1. Firma i oczekiwania\n2. Wyzwania i profil\n3. Rekomendacje i szybkie wygrane.\n\nZaczynamy?`,
        DE: `Hallo {name}. Ich bin Ihr Transformationsassistent.\n\nIn dieser Schnellbewertung gehen wir durch 3 Schritte:\n1. Unternehmen & Erwartungen\n2. Herausforderungen & Profil\n3. Empfehlungen & Quick Wins.\n\nSollen wir anfangen?`,
        AR: `مرحبًا {name}. أنا مساعد التحول الخاص بك.\n\nفي هذا التقييم السريع (المجاني)، سنمر بـ 3 خطوات:\n1. الشركة والتوقعات\n2. التحديات والملف الشخصي\n3. التوصيات والمكاسب السريعة.\n\nهل نبدأ؟`
      },
      role: {
        EN: "Great. Let's start with the basics.\n\nWhat is your role in the company?",
        PL: "Świetnie. Zacznijmy od podstaw.\n\nJaka jest Twoja rola w firmie?",
        DE: "Super. Fangen wir mit den Grundlagen an.\n\nWas ist Ihre Rolle im Unternehmen?",
        AR: "عظيم. لنبدأ بالأساسيات.\n\nما هو دورك في الشركة؟"
      },
      industry: {
        EN: "Nice to meet you, {role}. Perspective matters.\n\nWhat industry do you operate in?",
        PL: "Miło Cię poznać, {role}. Perspektywa ma znaczenie.\n\nW jakiej branży działacie?",
        DE: "Freut mich, {role}. Die Perspektive zählt.\n\nIn welcher Branche sind Sie tätig?",
        AR: "تشرفت بمقابلتك، {role}. المنظور مهم.\n\nفي أي صناعة تعمل؟"
      },
      industrySub: {
        EN: "Production. Got it. What kind specifically?",
        PL: "Produkcja. Rozumiem. Jaka konkretnie?",
        DE: "Produktion. Verstanden. Welche Art genau?",
        AR: "الإنتاج. فهمت. أي نوع بالتحديد؟"
      },
      size: {
        EN: "How many employees do you have roughly?",
        PL: "Ilu mniej więcej macie pracowników?",
        DE: "Wie viele Mitarbeiter haben Sie ungefähr?",
        AR: "كم عدد الموظفين لديك تقريبًا؟"
      },
      country: {
        EN: "Understood. Scale changes the available solutions.\n\nWhich country is your main operation in?",
        PL: "Zrozumiałem. Skala zmienia dostępne rozwiązania.\n\nW jakim kraju głównie działacie?",
        DE: "Verstanden. Die Größe ändert die verfügbaren Lösungen.\n\nIn welchem Land sind Sie hauptsächlich tätig?",
        AR: "فهمت. الحجم يغير الحلول المتاحة.\n\nفي أي بلد تعمل بشكل رئيسي؟"
      },
      challenges: {
        EN: "Great, let's explore your current challenges to build meaningful recommendations.\n\nWhat is your main operational pain point? (Select one or type)",
        PL: "Świetnie, przeanalizujmy Twoje wyzwania, aby zbudować sensowne rekomendacje.\n\nJaki jest Twój główny problem operacyjny?",
        DE: "Großartig, lassen Sie uns Ihre aktuellen Herausforderungen untersuchen.\n\nWas ist Ihr größtes operatives Problem?",
        AR: "عظيم، دعنا نستكشف تحدياتك الحالية.\n\nما هي نقطة الألم التشغيلية الرئيسية لديك؟"
      },
      goal: {
        EN: "Understood. Dealing with key challenges.\n\nNow, if we talk in 12 months, what would be the MAIN success statement you'd like to make?",
        PL: "Rozumiem. Zajmiemy się tymi wyzwaniami.\n\nGdybyśmy rozmawiali za 12 miesięcy, co byłoby GŁÓWNYM sukcesem?",
        DE: "Verstanden. Wir gehen die Herausforderungen an.\n\nWenn wir in 12 Monaten sprechen, was wäre die HAUPTAUSSAGE zum Erfolg?",
        AR: "فهمت. التعامل مع التحديات الرئيسية.\n\nالآن، إذا تحدثنا في غضون 12 شهرًا، ما هو بيان النجاح الرئيسي الذي تود الإدلاء به؟"
      },
      horizon: {
        EN: "Clear goal.\n\nWhen do you need to see the first tangible results?",
        PL: "Jasny cel.\n\nKiedy musisz zobaczyć pierwsze wymierne efekty?",
        DE: "Klares Ziel.\n\nWann müssen Sie die ersten greifbaren Ergebnisse sehen?",
        AR: "هدف واضح.\n\nمتى تحتاج إلى رؤية أول نتائج ملموسة؟"
      },
      summary: {
        EN: "Perfect. We have the profile.\n\nSummary:\n- Role: {role}\n- Sector: {industry}\n- Goal: {goal}\n\nI will now generate specific ideas for you.",
        PL: "Idealnie. Mamy profil.\n\nPodsumowanie:\n- Rola: {role}\n- Sektor: {industry}\n- Cel: {goal}\n\nTeraz wygeneruję dla Ciebie konkretne pomysły.",
        DE: "Perfekt. Wir haben das Profil.\n\nZusammenfassung:\n- Rolle: {role}\n- Sektor: {industry}\n- Ziel: {goal}\n\nIch werde jetzt spezifische Ideen für Sie generieren.",
        AR: "مثالي. لدينا الملف الشخصي.\n\nملخص:\n- الدور: {role}\n- القطاع: {industry}\n- الهدف: {goal}\n\nسأقوم الآن بتوليد أفكار محددة لك."
      },
      done: {
        EN: "Great! Please click the button on the right to view your Action Proposals.",
        PL: "Świetnie! Kliknij przycisk po prawej, aby zobaczyć Propozycje Działań.",
        DE: "Großartig! Bitte klicken Sie auf die Schaltfläche rechts, um Ihre Aktionsvorschläge anzuzeigen.",
        AR: "عظيم! يرجى النقر على الزر الموجود على اليمين لعرض مقترحات العمل الخاصة بك."
      },
      // Step 3 Scripts
      step3Intro: {
        EN: "Based on your answers, here is a quick snapshot of your situation and my recommendations.",
        PL: "Na podstawie Twoich odpowiedzi, oto szybki przegląd Twojej sytuacji i moje rekomendacje.",
        DE: "Basierend auf Ihren Antworten ist hier ein kurzer Überblick über Ihre Situation und meine Empfehlungen.",
        AR: "بناءً على إجاباتك، إليك لمحة سريعة عن وضعك وتوصياتي."
      },
      step3Summary: {
        EN: "Your company is in the {industry} sector with a clear goal to {goal}. The main challenge is {painPoint}.",
        PL: "Twoja firma działa w sektorze {industry} z jasnym celem {goal}. Głównym wyzwaniem jest {painPoint}.",
        DE: "Ihr Unternehmen ist im Sektor {industry} mit dem klaren Ziel {goal}. Die Hauptherausforderung ist {painPoint}.",
        AR: "شركتك في قطاع {industry} بهدف واضح وهو {goal}. التحدي الرئيسي هو {painPoint}."
      },
      step3Focus: {
        EN: "I recommend focusing immediately on these areas:",
        PL: "Rekomenduję natychmiastowe skupienie się na tych obszarach:",
        DE: "Ich empfehle, sich sofort auf diese Bereiche zu konzentrieren:",
        AR: "أوصي بالتركيز فوراً على هذه المجالات:"
      },
      step3Wins: {
        EN: "Here are some Quick Wins you can start next Monday:",
        PL: "Oto kilka Szybkich Wygranych, które możesz zacząć w najbliższy poniedziałek:",
        DE: "Hier sind einige Quick Wins, mit denen Sie nächsten Montag beginnen können:",
        AR: "إليك بعض المكاسب السريعة التي يمكنك البدء بها يوم الاثنين القادم:"
      },
      step3Upsell: {
        EN: "Would you like to move to the Full Transformation Project and build a full roadmap?",
        PL: "Czy chciałbyś przejść do Pełnego Projektu Transformacji i zbudować pełną mapę drogową?",
        DE: "Möchten Sie zum vollen Transformationsprojekt übergehen und eine vollständige Roadmap erstellen?",
        AR: "هل ترغب في الانتقال إلى مشروع التحول الكامل وبناء خارطة طريق كاملة؟"
      },
    },
    options: {
      start: { EN: "OK, let's start", PL: "OK, zaczynajmy", DE: "OK, lass uns anfangen", AR: "حسنا لنبدأ" },
      explain: { EN: "Explain process", PL: "Wyjaśnij proces", DE: "Prozess erklären", AR: "اشرح العملية" },
      // Roles
      ceo: { EN: "Owner / CEO", PL: "Właściciel / Prezes", DE: "Inhaber / CEO", AR: "المالك / الرئيس التنفيذي" },
      plant: { EN: "Plant Manager", PL: "Dyrektor Zakładu", DE: "Werksleiter", AR: "مدير المصنع" },
      coo: { EN: "COO", PL: "Dyrektor Operacyjny", DE: "COO", AR: "مدير العمليات" },
      // Industry
      mfg: { EN: "Production", PL: "Produkcja", DE: "Produktion", AR: "إنتاج" },
      log: { EN: "Logistics", PL: "Logistyka", DE: "Logistik", AR: "الخدمات اللوجستية" },
      // Pain Points (Step 2)
      inefficient: { EN: "Inefficient production processes", PL: "Nieefektywne procesy", DE: "Ineffiziente Prozesse", AR: "عمليات إنتاج غير فعالة" },
      lackData: { EN: "Lack of data / visibility", PL: "Brak danych / widoczności", DE: "Mangel an Daten", AR: "نقص البيانات / الرؤية" },
      manual: { EN: "Too many manual tasks", PL: "Zbyt wiele zadań ręcznych", DE: "Zu viele manuelle Aufgaben", AR: "الكثير من المهام اليدوية" },
      quality: { EN: "Problems with quality", PL: "Problemy z jakością", DE: "Qualitätsprobleme", AR: "مشاكل في الجودة" },
      automation: { EN: "Low automation level", PL: "Niski poziom automatyzacji", DE: "Geringe Automatisierung", AR: "مستوى أتمتة منخفض" },
      // Priority Areas
      proc: { EN: "Processes", PL: "Procesy", DE: "Prozesse", AR: "العمليات" },
      data: { EN: "Data", PL: "Dane", DE: "Daten", AR: "البيانات" },
      auto: { EN: "Automation", PL: "Automatyzacja", DE: "Automatisierung", AR: "الأتمتة" },
      culture: { EN: "Culture", PL: "Kultura", DE: "Kultur", AR: "الثقافة" },
      // Time
      m3: { EN: "3 months", PL: "3 miesiące", DE: "3 Monate", AR: "3 أشهر" },
      m6: { EN: "6 months", PL: "6 miesięcy", DE: "6 Monate", AR: "6 أشهر" },
      m12: { EN: "12 months", PL: "12 miesięcy", DE: "12 Monate", AR: "12 شهر" },
      confirm: { EN: "Looks correct", PL: "Zgadza się", DE: "Sieht korrekt aus", AR: "يبدو صحيحا" },
      edit: { EN: "Change something", PL: "Zmień coś", DE: "Etwas ändern", AR: "تغيير شيء ما" },
      // Upsell
      yesFull: { EN: "Yes, start Full Project", PL: "Tak, startuj Pełny Projekt", DE: "Ja, volles Projekt starten", AR: "نعم، ابدأ المشروع الكامل" },
      notNow: { EN: "Not now", PL: "Nie teraz", DE: "Nicht jetzt", AR: "ليس الآن" }
    }
  },
  fullAssessment: {
    intro: {
      EN: "Welcome to the Full Digital Readiness Diagnosis (DRD). We will assess 6 key axes of your business on a scale of 1-7. This will generate your Maturity Heatmap.",
      PL: "Witaj w Pełnej Diagnozie Gotowości Cyfrowej (DRD). Ocenimy 6 kluczowych osi Twojej firmy w skali 1-7. To wygeneruje Twoją Mapę Dojrzałości.",
      DE: "Willkommen zur vollständigen Digital Readiness Diagnosis (DRD). Wir bewerten 6 Schlüsselachsen Ihres Unternehmens auf einer Skala von 1-7.",
      AR: "مرحبًا بك في تشخيص الجاهزية الرقمية الكامل (DRD). سنقوم بتقييم 6 محاور رئيسية لعملك على مقياس من 1-7."
    },
    axisIntro: {
      EN: "Let's assess your {axis}. How mature are you in this area?",
      PL: "Oceńmy Twój obszar: {axis}. Jak dojrzały jesteś w tym aspekcie?",
      DE: "Lassen Sie uns Ihre {axis} bewerten. Wie reif sind Sie in diesem Bereich?",
      AR: "دعنا نقيم {axis}. ما مدى نضجك في هذا المجال؟"
    },
    startAxis: { EN: "Start Axis", PL: "Rozpocznij Oś", DE: "Achse starten", AR: "ابدأ المحور" },
    currentAxis: { EN: "Current Axis", PL: "Bieżąca Oś", DE: "Aktuelle Achse", AR: "المحور الحالي" },
    continue: { EN: "Continue", PL: "Kontynuuj", DE: "Weiter", AR: "متابعة" },
    completed: { EN: "Completed", PL: "Ukończono", DE: "Abgeschlossen", AR: "مكتمل" },
    score: { EN: "Score", PL: "Wynik", DE: "Punktzahl", AR: "النتيجة" },
    maturityOverview: { EN: "Maturity Overview", PL: "Przegląd Dojrzałości", DE: "Reifegradübersicht", AR: "نظرة عامة على النضج" },
    nextStep: { EN: "Go to Initiatives Generator (Step 2)", PL: "Przejdź do Generatora Inicjatyw (Krok 2)", DE: "Zum Initiativen-Generator (Schritt 2)", AR: "الذهاب إلى مولد المبادرات (الخطوة 2)" },
    summary: {
      EN: "Here is your digital maturity profile across 6 axes. Based on the scores, we should prioritize {weakest}.",
      PL: "Oto Twój profil dojrzałości cyfrowej w 6 osiach. Na podstawie wyników powinniśmy nadać priorytet: {weakest}.",
      DE: "Hier ist Ihr digitales Reifegradprofil über 6 Achsen. Basierend auf den Punktzahlen sollten wir {weakest} priorisieren.",
      AR: "إليك ملف تعريف النضج الرقمي الخاص بك عبر 6 محاور. بناءً على الدرجات، يجب أن نعطي الأولوية لـ {weakest}."
    },
    introMicrocopy: {
      EN: "This assessment evaluates your organization across 6 dimensions of the Digital Readiness Diagnosis (DRD) model. Scores range from 1 (Novice) to 7 (Leader).",
      PL: "Ta ocena ewaluuje Twoją organizację w 6 wymiarach modelu Digital Readiness Diagnosis (DRD). Wyniki wahają się od 1 (Nowicjusz) do 7 (Lider).",
      DE: "Diese Bewertung bewertet Ihr Unternehmen in 6 Dimensionen des Digital Readiness Diagnosis (DRD) -Modells. Die Werte reichen von 1 (Anfänger) bis 7 (Führer).",
      AR: "يقيم هذا التقييم مؤسستك عبر 6 أبعاد لنموذج تشخيص الجاهزية الرقمية (DRD). تتراوح الدرجات من 1 (مبتدئ) إلى 7 (قائد)."
    },
    descriptions: {
      processes: { EN: "Standardization & Efficiency", PL: "Standaryzacja i Efektywność", DE: "Standardisierung & Effizienz", AR: "التوحيد والكفاءة" },
      digitalProducts: { EN: "Connectivity & UX", PL: "Łączność i UX", DE: "Konnektivität & UX", AR: "الاتصال وتجربة المستخدم" },
      businessModels: { EN: "Scalability & Revenue", PL: "Skalowalność i Przychody", DE: "Skalierbarkeit & Umsatz", AR: "قابلية التوسع والإيرادات" },
      dataManagement: { EN: "Quality & Governance", PL: "Jakość i Zarządzanie", DE: "Qualität & Governance", AR: "الجودة والحوكمة" },
      culture: { EN: "Skills & Mindset", PL: "Umiejętności i Nastawienie", DE: "Fähigkeiten & Denkweise", AR: "المهارات والعقلية" },
      aiMaturity: { EN: "Adoption & Strategy", PL: "Adopcja i Strategia", DE: "Adoption & Strategie", AR: "التبني والاستراتيجية" }
    },
    // Mock questions for 6 axes
    questions: {
      processes: [
        { EN: "How standardized are your core production processes?", PL: "Jak ustandaryzowane są Twoje główne procesy produkcji?" },
        { EN: "How well are your processes measured and monitored?", PL: "Jak dobrze mierzone i monitorowane są procesy?" },
        { EN: "To what extent are your processes digitally supported?", PL: "W jakim stopniu procesy są wspierane cyfrowo?" }
      ],
      digitalProducts: [
        { EN: "Does your product portfolio include digital services?", PL: "Czy Twoje portfolio zawiera usługi cyfrowe?" },
        { EN: "How integrated are your products with IoT?", PL: "Jak zintegrowane są produkty z IoT?" },
        { EN: "Do you use customer usage data to improve products?", PL: "Czy używasz danych o użyciu do ulepszania produktów?" }
      ],
      businessModels: [
        { EN: "Are you shifting from CAPEX to OPEX models?", PL: "Czy przechodzisz z modeli CAPEX na OPEX?" },
        { EN: "Do you have digital ecosystem partnerships?", PL: "Czy masz partnerstwa w ekosystemie cyfrowym?" },
        { EN: "How scalable is your current business model?", PL: "Jak skalowalny jest obecny model biznesowy?" }
      ],
      dataManagement: [
        { EN: "Is there a single source of truth for key data?", PL: "Czy istnieje jedno źródło prawdy dla kluczowych danych?" },
        { EN: "How automated is data collection?", PL: "Jak zautomatyzowane jest zbieranie danych?" },
        { EN: "Do you use predictive analytics?", PL: "Czy używasz analityki predykcyjnej?" }
      ],
      culture: [
        { EN: "How open is the leadership to digital change?", PL: "Jak otwarte jest kierownictwo na zmiany cyfrowe?" },
        { EN: "Do employees have digital skills training?", PL: "Czy pracownicy mają szkolenia z umiejętności cyfrowych?" },
        { EN: "Is innovation rewarded in the company?", PL: "Czy innowacyjność jest nagradzana w firmie?" }
      ],
      aiMaturity: [
        { EN: "Are you piloting any AI solutions currently?", PL: "Czy pilotujesz obecnie jakieś rozwiązania AI?" },
        { EN: "Do you have data ready for AI training?", PL: "Czy masz dane gotowe do trenowania AI?" },
        { EN: "Is there an AI strategy in place?", PL: "Czy istnieje strategia AI?" }
      ]
    }
  },
  fullInitiatives: {
    intro: {
      EN: "Based on your maturity scores, I've generated a set of transformation initiatives. You can review and edit them in the table on the right.",
      PL: "Na podstawie Twoich wyników dojrzałości wygenerowałem zestaw inicjatyw transformacyjnych. Możesz je przejrzeć i edytować w tabeli po prawej.",
      DE: "Basierend auf Ihren Reifegradbewertungen habe ich eine Reihe von Transformationsinitiativen erstellt. Sie können diese in der Tabelle rechts überprüfen und bearbeiten.",
      AR: "بناءً على درجات نضجك، قمت بإنشاء مجموعة من مبادرات التحول. يمكنك مراجعتها وتعديلها في الجدول الموجود على اليمين."
    },
    tableHeader: {
      initiative: { EN: "Initiative Name", PL: "Nazwa Inicjatywy", DE: "Initiativenname", AR: "اسم المبادرة" },
      axis: { EN: "Axis", PL: "Oś", DE: "Achse", AR: "محور" },
      priority: { EN: "Priority", PL: "Priorytet", DE: "Priorität", AR: "أولوية" },
      complexity: { EN: "Complexity", PL: "Złożoność", DE: "Komplexität", AR: "تعقيد" },
      status: { EN: "Status", PL: "Status", DE: "Status", AR: "حالة" },
      notes: { EN: "Notes", PL: "Notatki", DE: "Notizen", AR: "ملاحظات" },
      actions: { EN: "Actions", PL: "Akcje", DE: "Aktionen", AR: "أجراءات" },
    },
    priorities: {
      High: { EN: 'High', PL: 'Wysoki', DE: 'Hoch', AR: 'مرتفع' },
      Medium: { EN: 'Medium', PL: 'Średni', DE: 'Mittel', AR: 'متوسط' },
      Low: { EN: 'Low', PL: 'Niski', DE: 'Niedrig', AR: 'منخفض' },
    },
    complexities: {
      High: { EN: 'High', PL: 'Wysoka', DE: 'Hoch', AR: 'مرتفع' },
      Medium: { EN: 'Medium', PL: 'Średnia', DE: 'Mittel', AR: 'متوسط' },
      Low: { EN: 'Low', PL: 'Niska', DE: 'Niedrig', AR: 'منخفض' },
    },
    statuses: {
      Draft: { EN: 'Draft', PL: 'Szkic', DE: 'Entwurf', AR: 'مسودة' },
      Ready: { EN: 'Ready', PL: 'Gotowe', DE: 'Bereit', AR: 'جاهز' },
      Archived: { EN: 'Archived', PL: 'Zarchiwizowane', DE: 'Archiviert', AR: 'مؤرشف' },
    },
    nextStep: { EN: "Go to Transformation Roadmap (Step 3)", PL: "Przejdź do Mapy Drogowej (Krok 3)", DE: "Zur Transformations-Roadmap (Schritt 3)", AR: "انتقل إلى خارطة طريق التحول (الخطوة 3)" }
  },
  fullRoadmap: {
    intro: {
      EN: "I have drafted a roadmap for you based on the priority and complexity of your initiatives. Foundational tasks (Data/Process) are scheduled earlier.",
      PL: "Przygotowałem dla Ciebie wstępną mapę drogową na podstawie priorytetu i złożoności inicjatyw. Zadania fundamentalne (Dane/Procesy) są zaplanowane wcześniej.",
      DE: "Ich habe basierend auf Priorität und Komplexität Ihrer Initiativen einen Roadmap-Entwurf erstellt. Grundlegende Aufgaben (Daten/Prozess) sind früher geplant.",
      AR: "لقد قمت بصياغة خارطة طريق لك بناءً على أولوية وتعقيد مبادراتك. المهام الأساسية (البيانات/العمليات) مجدولة في وقت مبكر."
    },
    tableHeader: {
      quarter: { EN: "Quarter", PL: "Kwartał", DE: "Quartal", AR: "ربع السنة" },
      wave: { EN: "Wave", PL: "Fala", DE: "Welle", AR: "موجة" },
    },
    workload: {
      title: { EN: "Workload Distribution", PL: "Rozkład Pracy", DE: "Arbeitslastverteilung", AR: "توزيع عبء العمل" },
      initiatives: { EN: "initiatives", PL: "inicjatyw", DE: "Initiativen", AR: "مبادرات" },
      overloaded: { EN: "Overloaded", PL: "Przeciążenie", DE: "Überlastet", AR: "مثقل" },
    },
    nextStep: { EN: "Go to Economics & ROI (Step 4)", PL: "Przejdź do Ekonomii i ROI (Krok 4)", DE: "Zu Wirtschaft & ROI (Schritt 4)", AR: "انتقل إلى الاقتصاد وعائد الاستثمار (الخطوة 4)" }
  },
  fullROI: {
    intro: {
      EN: "Now let's estimate the costs and benefits. You don't need to be precise – ranges and best guesses are ok for now.",
      PL: "Teraz oszacujmy koszty i korzyści. Nie musisz być precyzyjny – wystarczą rzędy wielkości.",
      DE: "Lassen Sie uns nun die Kosten und den Nutzen abschätzen. Sie müssen nicht genau sein – Größenordnungen reichen vorerst aus.",
      AR: "الآن دعونا نقدر التكاليف والفوائد. لا تحتاج إلى أن تكون دقيقًا - النطاقات والتخمينات جيدة في الوقت الحالي."
    },
    tableHeader: {
      cost: { EN: "Est. Cost (k$)", PL: "Szac. Koszt (tys.$)", DE: "Gesch. Kosten (k$)", AR: "التكلفة التقديرية (ألف دولار)" },
      benefit: { EN: "Est. Benefit (k$/yr)", PL: "Szac. Korzyść (tys.$/rok)", DE: "Gesch. Nutzen (k$/Jahr)", AR: "الفائدة التقديرية (ألف دولار/سنة)" },
    },
    summary: {
      totalCost: { EN: "Total Cost", PL: "Koszt Całkowity", DE: "Gesamtkosten", AR: "التكلفة الإجمالية" },
      totalBenefit: { EN: "Total Annual Benefit", PL: "Całkowita Korzyść Roczna", DE: "Jährlicher Gesamtnutzen", AR: "إجمالي الفائدة السنوية" },
      roi: { EN: "Overall ROI", PL: "Całkowite ROI", DE: "Gesamt-ROI", AR: "عائد الاستثمار الإجمالي" },
      payback: { EN: "Payback Period", PL: "Okres Zwrotu", DE: "Amortisationsdauer", AR: "فترة الاسترداد" },
      years: { EN: "years", PL: "lat", DE: "Jahre", AR: "سنوات" },
    },
    nextStep: { EN: "Go to Execution Dashboard (Step 5)", PL: "Przejdź do Pulpitu Wykonawczego (Krok 5)", DE: "Zum Ausführungs-Dashboard (Schritt 5)", AR: "انتقل إلى لوحة القيادة للتنفيذ (الخطوة 5)" }
  },
  fullExecution: {
    intro: {
      EN: "Welcome to Execution Mode. Here you can track progress, assign owners, and manage blockers. Drag or update statuses to move initiatives forward.",
      PL: "Witaj w Trybie Wykonawczym. Tutaj możesz śledzić postępy, przypisywać właścicieli i zarządzać blokadami.",
      DE: "Willkommen im Ausführungsmodus. Hier können Sie den Fortschritt verfolgen, Besitzer zuweisen und Blockaden verwalten.",
      AR: "مرحبًا بك في وضع التنفيذ. هنا يمكنك تتبع التقدم وتعيين المالكين وإدارة الحواجز."
    },
    columns: {
      todo: { EN: "To Do", PL: "Do Zrobienia", DE: "Zu Erledigen", AR: "للقيام به" },
      inProgress: { EN: "In Progress", PL: "W Toku", DE: "In Bearbeitung", AR: "في تَقَدم" },
      blocked: { EN: "Blocked", PL: "Zablokowane", DE: "Blockiert", AR: "مسدود" },
      done: { EN: "Done", PL: "Zrobione", DE: "Erledigt", AR: "منجز" },
    },
    kpi: {
      total: { EN: "Total Initiatives", PL: "Wszystkie Inicjatywy", DE: "Gesamtinitiativen", AR: "إجمالي المبادرات" },
      completion: { EN: "Completion Rate", PL: "Wskaźnik Ukończenia", DE: "Abschlussquote", AR: "معدل الإنجاز" },
    },
    fields: {
      owner: { EN: "Owner", PL: "Właściciel", DE: "Eigentümer", AR: "المالك" },
      dueDate: { EN: "Due Date", PL: "Termin", DE: "Fälligkeitsdatum", AR: "تاريخ الاستحقاق" },
      progress: { EN: "Progress", PL: "Postęp", DE: "Fortschritt", AR: "تقدم" },
    },
    nextStep: { EN: "Go to Final Report (Step 6)", PL: "Przejdź do Raportu Końcowego (Krok 6)", DE: "Zum Abschlussbericht (Schritt 6)", AR: "اذهب إلى التقرير النهائي (الخطوة 6)" }
  },
  fullReports: {
    header: { EN: "Transformation Report", PL: "Raport Transformacji", DE: "Transformationsbericht", AR: "تقرير التحول" },
    sections: {
      exec: { EN: "Executive Summary", PL: "Podsumowanie Zarządcze", DE: "Zusammenfassung", AR: "ملخص تنفيذي" },
      maturity: { EN: "Digital Maturity Profile", PL: "Profil Dojrzałości Cyfrowej", DE: "Digitales Reifegradprofil", AR: "ملف النضج الرقمي" },
      initiatives: { EN: "Key Initiatives", PL: "Kluczowe Inicjatywy", DE: "Schlüsselinitiativen", AR: "المبادرات الرئيسية" },
      roadmap: { EN: "Transformation Roadmap", PL: "Mapa Drogowa Transformacji", DE: "Transformations-Roadmap", AR: "خارطة طريق التحول" },
      economics: { EN: "Economics & ROI", PL: "Ekonomia i ROI", DE: "Wirtschaft & ROI", AR: "الاقتصاد وعائد الاستثمار" },
      execution: { EN: "Execution Status", PL: "Status Wykonania", DE: "Ausführungsstatus", AR: "حالة التنفيذ" },
    },
    cards: {
      maturity: { EN: "Maturity & Focus", PL: "Dojrzałość i Skupienie", DE: "Reife & Fokus", AR: "النضج والتركيز" },
      economics: { EN: "Project Economics", PL: "Ekonomia Projektu", DE: "Projektwirtschaft", AR: "اقتصاديات المشروع" },
      execution: { EN: "Execution Snapshot", PL: "Migawka Wykonania", DE: "Ausführungs-Momentaufnahme", AR: "لمحة سريعة عن التنفيذ" },
    },
    buttons: {
      export: { EN: "Export Report", PL: "Eksportuj Raport", DE: "Bericht exportieren", AR: "تصدير التقرير" },
      copy: { EN: "Copy Text", PL: "Kopiuj Tekst", DE: "Text kopieren", AR: "نسخ النص" },
    },
    labels: {
      strongest: { EN: "Strongest Asset", PL: "Najsilniejszy Atut", DE: "Stärkster Vermögenswert", AR: "أقوى الأصول" },
      weakest: { EN: "Critical Gap", PL: "Krytyczna Luka", DE: "Kritische Lücke", AR: "الفجوة الحرجة" },
      totalCost: { EN: "Total Cost", PL: "Koszt Całkowity", DE: "Gesamtkosten", AR: "التكلفة الإجمالية" },
      annualBenefit: { EN: "Annual Benefit", PL: "Roczna Korzyść", DE: "Jährlicher Nutzen", AR: "المنفعة السنوية" },
      roi: { EN: "ROI", PL: "ROI", DE: "ROI", AR: "العائد على الاستثمار" },
      payback: { EN: "Payback Period", PL: "Okres Zwrotu", DE: "Amortisationszeit", AR: "فترة الاسترداد" },
      completionRate: { EN: "Completion Rate", PL: "Wskaźnik Ukończenia", DE: "Abschlussquote", AR: "معدل الإنجاز" },
      initiatives: { EN: "Initiatives", PL: "Inicjatywy", DE: "Initiativen", AR: "مبادرات" },
      done: { EN: "Done", PL: "Gotowe", DE: "Erledigt", AR: "منجز" },
      inProg: { EN: "In Prog", PL: "W Toku", DE: "In Bearb.", AR: "في تَقَدم" },
      blocked: { EN: "Blocked", PL: "Zablok.", DE: "Blockiert", AR: "مسدود" }
    },
    reportTemplates: {
      execSummary: {
        EN: "{companyName} has embarked on a strategic digital transformation journey. Based on the comprehensive DRD assessment, the organization demonstrates strong maturity in {strongest} ({strongestScore}/7), while facing significant challenges in {weakest} ({weakestScore}/7).\n\nTo address these gaps, a tailored roadmap consisting of {initCount} strategic initiatives has been developed. The plan focuses on building foundational capabilities in the first 12 months before scaling advanced digital solutions.\n\nFrom an economic perspective, the transformation is projected to generate an annual benefit of ${benefit}k against a total investment of ${cost}k. This yields an attractive ROI of {roi}% with a payback period of {payback} years.",
        PL: "{companyName} rozpoczęła strategiczną podróż transformacji cyfrowej. Na podstawie kompleksowej oceny DRD organizacja wykazuje silną dojrzałość w obszarze {strongest} ({strongestScore}/7), jednocześnie napotykając znaczące wyzwania w obszarze {weakest} ({weakestScore}/7).\n\nAby zaradzić tym lukom, opracowano mapę drogową składającą się z {initCount} inicjatyw strategicznych. Plan koncentruje się na budowaniu fundamentalnych zdolności w ciągu pierwszych 12 miesięcy przed skalowaniem zaawansowanych rozwiązań cyfrowych.\n\nZ perspektywy ekonomicznej przewiduje się, że transformacja przyniesie roczne korzyści w wysokości ${benefit}k przy całkowitej inwestycji ${cost}k. Daje to atrakcyjne ROI na poziomie {roi}% z okresem zwrotu wynoszącym {payback} lat.",
        DE: "{companyName} hat eine strategische digitale Transformationsreise begonnen. Basierend auf der umfassenden DRD-Bewertung zeigt die Organisation eine starke Reife in {strongest} ({strongestScore}/7), steht jedoch vor erheblichen Herausforderungen in {weakest} ({weakestScore}/7).\n\nUm diese Lücken zu schließen, wurde eine maßgeschneiderte Roadmap bestehend aus {initCount} strategischen Initiativen entwickelt. Der Plan konzentriert sich auf den Aufbau grundlegender Fähigkeiten in den ersten 12 Monaten, bevor fortgeschrittene digitale Lösungen skaliert werden.\n\nAus wirtschaftlicher Sicht wird prognostiziert, dass die Transformation einen jährlichen Nutzen von ${benefit}k bei einer Gesamtinvestition von ${cost}k generieren wird. Dies ergibt einen attraktiven ROI von {roi}% bei einer Amortisationszeit von {payback} Jahren.",
        AR: "شرعت {companyName} في رحلة تحول رقمي استراتيجي. استنادًا إلى تقييم DRD الشامل، تظهر المنظمة نضجًا قويًا في {strongest} ({strongestScore}/7)، بينما تواجه تحديات كبيرة في {weakest} ({weakestScore}/7).\n\nولمعالجة هذه الفجوات، تم وضع خارطة طريق مخصصة تتكون من {initCount} مبادرة استراتيجية. تركز الخطة على بناء القدرات الأساسية في الأشهر الـ 12 الأولى قبل توسيع نطاق الحلول الرقمية المتقدمة.\n\nمن منظور اقتصادي، من المتوقع أن يولد التحول فائدة سنوية قدرها ${benefit} ألف مقابل استثمار إجمالي قدره ${cost} ألف. هذا يحقق عائدًا جذابًا على الاستثمار بنسبة {roi}% مع فترة استرداد تبلغ {payback} سنوات."
      },
      finding1: {
        EN: "{strongest} is your strongest asset, acting as a pillar for future growth.",
        PL: "{strongest} to Twój najsilniejszy atut, stanowiący filar przyszłego wzrostu.",
        DE: "{strongest} ist Ihr stärkstes Kapital und dient als Pfeiler für zukünftiges Wachstum.",
        AR: "{strongest} هو أقوى أصولك، ويعمل كركيزة للنمو المستقبلي."
      },
      finding2: {
        EN: "{weakest} requires immediate attention to prevent bottlenecks in scaling.",
        PL: "{weakest} wymaga natychmiastowej uwagi, aby zapobiec wąskim gardłom w skalowaniu.",
        DE: "{weakest} erfordert sofortige Aufmerksamkeit, um Engpässe bei der Skalierung zu vermeiden.",
        AR: "{weakest} يتطلب اهتمامًا فوريًا لمنع الاختناقات في التوسع."
      },
      finding3: {
        EN: "The organization is ready for {type} transformation.",
        PL: "Organizacja jest gotowa na {type} transformację.",
        DE: "Die Organisation ist bereit für eine {type} Transformation.",
        AR: "المنظمة جاهزة للتحول {type}."
      },
      aggressive: { EN: "aggressive", PL: "agresywną", DE: "aggressive", AR: "عدواني" },
      focused: { EN: "focused", PL: "skoncentrowaną", DE: "fokussierte", AR: "مركز" }
    }
  }
};
