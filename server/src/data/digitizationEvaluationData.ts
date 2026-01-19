// @ts-nocheck
/**
 * Digitization Evaluation Framework Data (CommonJS Version for Backend)
 *
 * Based on "Basic Digitization Project Evaluation Form.xlsx"
 * 6 main axes with 32 evaluation areas, each with 7 maturity levels
 */

// ============================================
// Level Name Templates (apply to all areas)
// ============================================
const LEVEL_NAMES = [
  { level: 1, name: 'Basic Data Registration', namePl: 'Rejestracja danych podstawowych' },
  { level: 2, name: 'Workstation Control', namePl: 'Kontrola stanowiska' },
  { level: 3, name: 'Process Control', namePl: 'Kontrola procesu' },
  { level: 4, name: 'Automation', namePl: 'Automatyzacja' },
  { level: 5, name: 'MES Integration', namePl: 'MES' },
  { level: 6, name: 'ERP Integration', namePl: 'ERP' },
  { level: 7, name: 'Algorithmic Support', namePl: 'Algorytmiczne wsparcie' },
];

// ============================================
// Helper function to generate generic levels
// ============================================
function generateGenericLevels(areaName, areaNamePl, contextEn, contextPl) {
  return LEVEL_NAMES.map((level) => ({
    level: level.level,
    name: level.name,
    namePl: level.namePl,
    description: `Level ${level.level} (${level.name}) for ${contextEn}. Organizations at this level demonstrate corresponding maturity in this area.`,
    descriptionPl: `Poziom ${level.level} (${level.namePl}) dla ${contextPl}. Organizacje na tym poziomie wykazują odpowiednią dojrzałość w tym obszarze.`,
    example: `Example of ${level.name} implementation in ${contextEn}.`,
    examplePl: `Przykład wdrożenia ${level.namePl} w zakresie ${contextPl}.`,
    question: `Has your organization achieved ${level.name} level in ${contextEn}?`,
    questionPl: `Czy Wasza organizacja osiągnęła poziom ${level.namePl} w zakresie ${contextPl}?`,
    initiative: `Initiative to achieve ${level.name} level in ${contextEn}.`,
    initiativePl: `Inicjatywa do osiągnięcia poziomu ${level.namePl} w zakresie ${contextPl}.`,
  }));
}

// ============================================
// AXIS 1: Digital Processes (Digitalne procesy)
// Areas: 1.1-1.9
// ============================================
const axis1Areas = [
  {
    id: 'area_1_1',
    code: '1.1',
    name: 'Sales',
    namePl: 'Sprzedaż',
    levels: [
      {
        level: 1,
        name: 'Basic Data Registration',
        namePl: 'Rejestracja danych podstawowych',
        description:
          'Basic data registration, sales process involves electronic registration of contracts and orders.',
        descriptionPl:
          'Rejestracja danych podstawowych, proces sprzedaży polega na elektronicznej rejestracji umów i zamówień.',
        example:
          'Sales employees use a dedicated system where they electronically create contracts and orders, ensuring precise registration and storage of data.',
        examplePl:
          'Pracownicy sprzedaży korzystają z dedykowanego systemu, gdzie elektronicznie tworzą umowy i zamówienia, zapewniając precyzyjną rejestrację i przechowywanie danych.',
        question:
          'Does your company electronically register contracts and orders in a dedicated system?',
        questionPl:
          'Czy obecnie Wasze przedsiębiorstwo elektronicznie rejestruje umowy i zamówienia w dedykowanym systemie?',
        initiative:
          'Implement a dedicated system for electronic registration and management of contracts and orders.',
        initiativePl:
          'Wdrożenie dedykowanego systemu do elektronicznej rejestracji i zarządzania umowami oraz zamówieniami.',
      },
      {
        level: 2,
        name: 'Workstation Control',
        namePl: 'Kontrola stanowiska',
        description:
          'At this level, there is a sales reporting system that enables monitoring and analyzing sales data.',
        descriptionPl:
          'Na tym poziomie, w procesie sprzedaży istnieje system raportowania, który umożliwia monitorowanie i analizowanie danych dotyczących sprzedaży.',
        example:
          'Use of a reporting tool that automatically generates sales reports including key indicators and sales statistics.',
        examplePl:
          'Wykorzystanie narzędzia raportowego, które automatycznie generuje raporty dotyczące sprzedaży, obejmujące kluczowe wskaźniki i statystyki sprzedażowe.',
        question:
          'Do you have a reporting system that enables real-time monitoring and analysis of sales data?',
        questionPl:
          'Czy posiadacie system raportowania, który umożliwia monitorowanie i analizowanie danych dotyczących sprzedaży w czasie rzeczywistym?',
        initiative:
          'Implement an advanced reporting tool that automatically generates reports on key sales indicators and statistics.',
        initiativePl:
          'Wdrożenie zaawansowanego narzędzia raportowego, które automatycznie generuje raporty dotyczące kluczowych wskaźników i statystyk sprzedażowych.',
      },
      {
        level: 3,
        name: 'Process Control',
        namePl: 'Kontrola procesu',
        description:
          'At this level, automatic budgeting is applied in the sales process, enabling planning and control of the sales budget.',
        descriptionPl:
          'Na tym poziomie, w procesie sprzedaży zastosowane jest automatyczne budżetowanie, które umożliwia planowanie i kontrolę budżetu sprzedażowego.',
        example:
          'Application of a system that automatically generates sales budget based on predefined parameters and sales indicators.',
        examplePl:
          'Zastosowanie systemu, który automatycznie generuje budżet sprzedażowy na podstawie wcześniej zdefiniowanych parametrów i wskaźników sprzedażowych.',
        question:
          'Has automatic budgeting been applied in your sales process for planning and budget control?',
        questionPl:
          'Czy w Waszym procesie sprzedaży zastosowano automatyczne budżetowanie, które umożliwia planowanie i kontrolę budżetu sprzedażowego?',
        initiative:
          'Implement an advanced system that automatically generates sales budget based on predefined parameters.',
        initiativePl:
          'Wdrożenie zaawansowanego systemu, który automatycznie generuje budżet sprzedażowy na podstawie wcześniej zdefiniowanych parametrów.',
      },
      {
        level: 4,
        name: 'Automation',
        namePl: 'Automatyzacja',
        description:
          'At this level, automation solutions such as online store, marketplace, or DIY platform have been implemented.',
        descriptionPl:
          'Na tym poziomie, w procesie sprzedaży zastosowano rozwiązania automatyzacji, takie jak sklep online, marketplace lub platforma DIY.',
        example:
          'Having an e-commerce platform where customers can browse and purchase products online without employee interaction.',
        examplePl:
          'Posiadanie platformy e-commerce, na której klienci mogą przeglądać i kupować produkty online, bez potrzeby interakcji z pracownikami.',
        question:
          'Does your company have an online store, marketplace, or DIY platform for online purchases?',
        questionPl:
          'Czy Wasze przedsiębiorstwo posiada sklep online, marketplace lub platformę DIY, która umożliwia klientom dokonywanie zakupów online?',
        initiative: 'Implement an e-commerce solution enabling customers to make online purchases.',
        initiativePl:
          'Wdrożenie rozwiązania e-commerce umożliwiającego klientom dokonywanie zakupów online.',
      },
      {
        level: 5,
        name: 'MES Integration',
        namePl: 'MES',
        description:
          'At this level, a supply chain reporting system is implemented for monitoring delivery and logistics data.',
        descriptionPl:
          'Na tym poziomie, w procesie sprzedaży zastosowano system raportowania w łańcuchu dostaw, który umożliwia monitorowanie danych dotyczących dostaw.',
        example:
          'Use of a system that generates delivery reports, tracks status, and provides shipment and delivery schedule information.',
        examplePl:
          'Wykorzystanie systemu, który generuje raporty dotyczące dostaw, śledzi ich status i zapewnia informacje na temat przesyłek i terminów dostaw.',
        question:
          'Does your company have a supply chain reporting system for monitoring delivery data?',
        questionPl:
          'Czy Wasze przedsiębiorstwo posiada system raportowania w łańcuchu dostaw, który umożliwia monitorowanie danych dotyczących dostaw?',
        initiative:
          'Implement a supply chain reporting system for monitoring and analyzing delivery and logistics data.',
        initiativePl:
          'Wdrożenie systemu raportowania w łańcuchu dostaw do monitorowania i analizowania danych dotyczących dostaw i logistyki.',
      },
      {
        level: 6,
        name: 'ERP Integration',
        namePl: 'ERP',
        description:
          'At this level, an integrated ERP solution is implemented covering key business processes including sales.',
        descriptionPl:
          'Na tym poziomie, w procesie sprzedaży zastosowano zintegrowane rozwiązanie typu ERP obejmujące zarządzanie kluczowymi procesami biznesowymi.',
        example:
          'Implementation of an ERP system integrating sales processes with other organizational areas like procurement, production, finance.',
        examplePl:
          'Wdrożenie systemu ERP, który integruje procesy sprzedażowe z innymi obszarami organizacji, takimi jak zakupy, produkcja, finanse.',
        question:
          'Does your company have an integrated ERP solution covering sales process management?',
        questionPl:
          'Czy Wasze przedsiębiorstwo posiada zintegrowane rozwiązanie typu ERP obejmujące zarządzanie procesami sprzedażowymi?',
        initiative: 'Implement an integrated ERP system consolidating key business processes.',
        initiativePl:
          'Wdrożenie zintegrowanego systemu ERP konsolidującego kluczowe procesy biznesowe.',
      },
      {
        level: 7,
        name: 'Algorithmic Support',
        namePl: 'Algorytmiczne wsparcie',
        description:
          'At this level, algorithms are used for offer personalization, bots, or GPT-based natural language processing for customer service.',
        descriptionPl:
          'Na tym poziomie, w procesie sprzedaży wykorzystuje się algorytmy do personalizacji oferty, działania botów czy technologii GPT do obsługi klienta.',
        example:
          'Using personalization algorithms that analyze customer preferences and propose customized purchase suggestions.',
        examplePl:
          'Stosowanie algorytmów personalizacji oferty, które analizują preferencje klientów i proponują spersonalizowane propozycje zakupowe.',
        question:
          'Does your company use algorithms for offer personalization, bots, or GPT technology in sales?',
        questionPl:
          'Czy Wasze przedsiębiorstwo wykorzystuje algorytmy do personalizacji oferty, działania botów lub technologii GPT w procesie sprzedaży?',
        initiative:
          'Implement AI-powered personalization algorithms and chatbots for enhanced customer experience.',
        initiativePl:
          'Wdrożenie algorytmów personalizacji opartych na AI oraz chatbotów dla lepszego doświadczenia klienta.',
      },
    ],
  },
  {
    id: 'area_1_2',
    code: '1.2',
    name: 'Marketing',
    namePl: 'Marketing',
    levels: [
      {
        level: 1,
        name: 'Basic Data Registration',
        namePl: 'Rejestracja danych podstawowych',
        description:
          'At this level, CRM system is used for basic customer data registration and management.',
        descriptionPl:
          'Na tym poziomie, w obszarze marketingu wykorzystywany jest system CRM do rejestracji i zarządzania danymi podstawowymi klientów.',
        example:
          'Using CRM system where customer contact data, interaction history, and marketing preferences are stored.',
        examplePl:
          'Wykorzystanie systemu CRM, w którym gromadzone są dane kontaktowe klientów, historia interakcji oraz preferencje marketingowe.',
        question:
          'Does your organization use a CRM system for basic customer data registration in marketing?',
        questionPl:
          'Czy Wasza organizacja wykorzystuje system CRM do rejestracji danych podstawowych klientów w obszarze marketingu?',
        initiative:
          'Implement a CRM system for effective customer data management and marketing personalization.',
        initiativePl:
          'Wdrożenie systemu CRM do skutecznego zarządzania danymi klientów i personalizacji działań marketingowych.',
      },
      {
        level: 2,
        name: 'Workstation Control',
        namePl: 'Kontrola stanowiska',
        description:
          'CRM tools combined with analytical KPIs are used for marketing effectiveness control.',
        descriptionPl:
          'W obszarze marketingu wykorzystywane są narzędzia CRM wraz z KPI analitycznymi do kontroli efektywności działań.',
        example:
          'CRM system integrated with analytical tools enabling analysis and tracking of key marketing KPIs.',
        examplePl:
          'System CRM zintegrowany z narzędziami analitycznymi, umożliwiający analizę i śledzenie kluczowych wskaźników marketingowych.',
        question:
          'Does your organization use CRM with analytical KPIs to control marketing effectiveness?',
        questionPl:
          'Czy Wasza organizacja wykorzystuje narzędzia CRM wraz z KPI analitycznymi do kontroli efektywności działań marketingowych?',
        initiative:
          'Integrate CRM with analytical tools to track key marketing performance indicators.',
        initiativePl:
          'Zintegrowanie narzędzi CRM z narzędziami analitycznymi do śledzenia kluczowych wskaźników wyników marketingowych.',
      },
      {
        level: 3,
        name: 'Process Control',
        namePl: 'Kontrola procesu',
        description:
          'SEO optimization and Google Analytics tools are used for marketing process control and online effectiveness analysis.',
        descriptionPl:
          'Wykorzystywane są narzędzia SEO oraz Google Analytics do kontroli procesów marketingowych i analizy efektywności online.',
        example:
          'Using SEO strategy to increase website visibility and Google Analytics for traffic and user behavior analysis.',
        examplePl:
          'Wykorzystanie strategii SEO do zwiększenia widoczności strony oraz analiza danych z Google Analytics.',
        question:
          'Does your organization use SEO and Google Analytics for marketing process control?',
        questionPl:
          'Czy Wasza organizacja wykorzystuje narzędzia SEO oraz Google Analytics do kontroli procesów marketingowych?',
        initiative:
          'Implement comprehensive SEO strategy and Google Analytics for online marketing effectiveness analysis.',
        initiativePl:
          'Wdrożenie kompleksowej strategii SEO oraz Google Analytics do analizy efektywności działań online.',
      },
      {
        level: 4,
        name: 'Automation',
        namePl: 'Automatyzacja',
        description:
          'E-marketing tools are used for marketing automation including newsletters, email campaigns, offer personalization.',
        descriptionPl:
          'Wykorzystuje się narzędzia e-marketingowe do automatyzacji działań marketingowych, wysyłki newsletterów, kampanii e-mail.',
        example:
          'E-marketing platform enabling automated email campaigns based on defined scenarios and customer segmentation.',
        examplePl:
          'Platforma e-marketingowa umożliwiająca automatyzację kampanii e-mailowych na podstawie zdefiniowanych scenariuszy.',
        question: 'Does your organization use e-marketing tools for marketing automation?',
        questionPl:
          'Czy Wasza organizacja wykorzystuje narzędzia e-marketingowe do automatyzacji działań marketingowych?',
        initiative:
          'Implement e-marketing platform for automated campaigns based on customer segmentation.',
        initiativePl:
          'Wdrożenie platformy e-marketingowej do automatyzacji kampanii opartych na segmentacji klientów.',
      },
      {
        level: 5,
        name: 'MES Integration',
        namePl: 'MES',
        description:
          'MES systems are used for conversion measurement in sales funnel and lead scoring.',
        descriptionPl:
          'Wykorzystuje się systemy MES do pomiaru konwersji w procesie sprzedażowym oraz scoringu leadów.',
        example:
          'MES tools tracking conversions at various sales funnel stages and assigning scores to leads based on activity.',
        examplePl:
          'Narzędzia MES śledzące konwersje w różnych etapach tunelu sprzedażowego oraz przypisujące punkty leadom.',
        question:
          'Does your organization use MES systems for conversion measurement and lead scoring?',
        questionPl:
          'Czy Wasza organizacja wykorzystuje systemy MES do pomiaru konwersji oraz scoringu leadów?',
        initiative: 'Implement MES systems for accurate conversion measurement and lead scoring.',
        initiativePl: 'Wdrożenie systemów MES do dokładnego pomiaru konwersji i scoringu leadów.',
      },
      {
        level: 6,
        name: 'ERP Integration',
        namePl: 'ERP',
        description:
          'Integrated ERP solution is used covering marketing processes and integration with other business areas.',
        descriptionPl:
          'Wykorzystuje się zintegrowane rozwiązanie ERP obejmujące procesy marketingowe oraz integrację z innymi obszarami.',
        example:
          'ERP system integrating marketing processes with other departments for effective campaign and customer data management.',
        examplePl:
          'System ERP integrujący procesy marketingowe z innymi działami do efektywnego zarządzania kampaniami i danymi klientów.',
        question: 'Does your organization use integrated ERP for marketing process management?',
        questionPl:
          'Czy Wasza organizacja wykorzystuje zintegrowane rozwiązanie ERP do zarządzania procesami marketingowymi?',
        initiative: 'Implement integrated ERP solution covering marketing process management.',
        initiativePl:
          'Wdrożenie zintegrowanego rozwiązania ERP obejmującego zarządzanie procesami marketingowymi.',
      },
      {
        level: 7,
        name: 'Algorithmic Support',
        namePl: 'Algorytmiczne wsparcie',
        description:
          'Algorithmic solutions like chatbots and GPT-based content generation support customer interaction and personalized content creation.',
        descriptionPl:
          'Wykorzystuje się algorytmiczne rozwiązania jak chat boty czy generowanie kontentu GPT do interakcji z klientami.',
        example:
          'Using chatbots for quick customer responses or GPT technology for generating personalized content.',
        examplePl:
          'Wykorzystanie chat botów do szybkich odpowiedzi klientom lub technologii GPT do generowania spersonalizowanego kontentu.',
        question:
          'Does your organization use algorithmic solutions like chatbots or GPT for marketing?',
        questionPl:
          'Czy Wasza organizacja wykorzystuje algorytmiczne rozwiązania jak chat boty czy GPT w marketingu?',
        initiative:
          'Implement AI chatbots and GPT-based content generation for enhanced customer engagement.',
        initiativePl:
          'Wdrożenie chatbotów AI i generowania kontentu GPT dla lepszego zaangażowania klientów.',
      },
    ],
  },
  {
    id: 'area_1_3',
    code: '1.3',
    name: 'Technology',
    namePl: 'Technologia',
    levels: [
      {
        level: 1,
        name: 'Basic Data Registration',
        namePl: 'Rejestracja danych podstawowych',
        description:
          'Design tools are used for basic data registration regarding technological solutions.',
        descriptionPl:
          'Wykorzystuje się narzędzia projektowania do rejestracji danych podstawowych dotyczących rozwiązań technologicznych.',
        example:
          'Using CAD software or other design tools for registering data about designed technological elements.',
        examplePl:
          'Wykorzystanie oprogramowania CAD lub innego narzędzia projektowego do rejestrowania danych o projektowanych elementach.',
        question:
          'Does your organization use design tools for basic technological solution data registration?',
        questionPl:
          'Czy Wasza organizacja wykorzystuje narzędzia projektowania do rejestracji danych o rozwiązaniach technologicznych?',
        initiative:
          'Implement design tools like CAD for precise technological solution documentation.',
        initiativePl:
          'Wdrożenie narzędzi projektowych jak CAD do precyzyjnej dokumentacji rozwiązań technologicznych.',
      },
      {
        level: 2,
        name: 'Workstation Control',
        namePl: 'Kontrola stanowiska',
        description: 'Digital simulation tools are used for technology design and testing.',
        descriptionPl:
          'Wykorzystuje się cyfrowe narzędzia symulacji do projektowania i testowania technologii.',
        example:
          'Using digital simulation tools for testing technological designs before physical implementation.',
        examplePl:
          'Wykorzystanie cyfrowych narzędzi symulacji do testowania projektów technologicznych przed fizyczną implementacją.',
        question: 'Does your organization use digital simulation tools for technology design?',
        questionPl:
          'Czy Wasza organizacja wykorzystuje cyfrowe narzędzia symulacji do projektowania technologii?',
        initiative: 'Implement digital simulation tools for testing technological designs.',
        initiativePl:
          'Wdrożenie cyfrowych narzędzi symulacji do testowania projektów technologicznych.',
      },
      {
        level: 3,
        name: 'Process Control',
        namePl: 'Kontrola procesu',
        description:
          'PLM (Product Lifecycle Management) systems are used for complete product lifecycle management.',
        descriptionPl: 'Wykorzystuje się systemy PLM do zarządzania pełnym cyklem życia produktu.',
        example: 'PLM system managing all product data from concept through production to service.',
        examplePl:
          'System PLM zarządzający wszystkimi danymi produktu od koncepcji przez produkcję do serwisu.',
        question: 'Does your organization use PLM systems for product lifecycle management?',
        questionPl:
          'Czy Wasza organizacja wykorzystuje systemy PLM do zarządzania cyklem życia produktu?',
        initiative: 'Implement PLM system for comprehensive product lifecycle management.',
        initiativePl: 'Wdrożenie systemu PLM do kompleksowego zarządzania cyklem życia produktu.',
      },
      {
        level: 4,
        name: 'Automation',
        namePl: 'Automatyzacja',
        description:
          'Automated testing and validation systems are implemented for technology development.',
        descriptionPl:
          'Wdrożono zautomatyzowane systemy testowania i walidacji dla rozwoju technologii.',
        example:
          'Automated test benches that validate designs against specifications without manual intervention.',
        examplePl:
          'Zautomatyzowane stanowiska testowe walidujące projekty względem specyfikacji bez interwencji manualnej.',
        question: 'Has your organization implemented automated testing and validation systems?',
        questionPl:
          'Czy Wasza organizacja wdrożyła zautomatyzowane systemy testowania i walidacji?',
        initiative:
          'Implement automated testing and validation systems for technology development.',
        initiativePl:
          'Wdrożenie zautomatyzowanych systemów testowania i walidacji dla rozwoju technologii.',
      },
      {
        level: 5,
        name: 'MES Integration',
        namePl: 'MES',
        description:
          'MES systems integrate design with production for real-time technology implementation tracking.',
        descriptionPl:
          'Systemy MES integrują projektowanie z produkcją do śledzenia wdrażania technologii w czasie rzeczywistym.',
        example: 'MES system providing real-time feedback from production to design team.',
        examplePl:
          'System MES zapewniający informację zwrotną z produkcji do zespołu projektowego w czasie rzeczywistym.',
        question: 'Is your design integrated with production through MES systems?',
        questionPl: 'Czy Wasze projektowanie jest zintegrowane z produkcją przez systemy MES?',
        initiative: 'Integrate design and production through MES systems for real-time feedback.',
        initiativePl:
          'Zintegrowanie projektowania i produkcji przez systemy MES dla informacji zwrotnej w czasie rzeczywistym.',
      },
      {
        level: 6,
        name: 'ERP Integration',
        namePl: 'ERP',
        description:
          'Full ERP integration connects technology development with all business processes.',
        descriptionPl:
          'Pełna integracja ERP łączy rozwój technologii ze wszystkimi procesami biznesowymi.',
        example:
          'ERP system connecting R&D, production, finance, and supply chain for technology projects.',
        examplePl:
          'System ERP łączący R&D, produkcję, finanse i łańcuch dostaw dla projektów technologicznych.',
        question: 'Is technology development integrated with all business processes through ERP?',
        questionPl:
          'Czy rozwój technologii jest zintegrowany ze wszystkimi procesami biznesowymi przez ERP?',
        initiative: 'Implement full ERP integration for technology development processes.',
        initiativePl: 'Wdrożenie pełnej integracji ERP dla procesów rozwoju technologii.',
      },
      {
        level: 7,
        name: 'Algorithmic Support',
        namePl: 'Algorytmiczne wsparcie',
        description:
          'AI and machine learning support technology development with predictive design and optimization.',
        descriptionPl:
          'AI i uczenie maszynowe wspierają rozwój technologii z predykcyjnym projektowaniem i optymalizacją.',
        example:
          'AI algorithms suggesting optimal designs based on performance requirements and constraints.',
        examplePl:
          'Algorytmy AI sugerujące optymalne projekty na podstawie wymagań wydajnościowych i ograniczeń.',
        question: 'Does your organization use AI for technology development optimization?',
        questionPl: 'Czy Wasza organizacja wykorzystuje AI do optymalizacji rozwoju technologii?',
        initiative: 'Implement AI-driven design optimization and predictive development tools.',
        initiativePl:
          'Wdrożenie optymalizacji projektowania opartej na AI i narzędzi predykcyjnego rozwoju.',
      },
    ],
  },
  {
    id: 'area_1_4',
    code: '1.4',
    name: 'Production',
    namePl: 'Produkcja',
    levels: generateGenericLevels(
      'Production',
      'Produkcja',
      'production processes',
      'procesów produkcyjnych'
    ),
  },
  {
    id: 'area_1_5',
    code: '1.5',
    name: 'Logistics',
    namePl: 'Logistyka',
    levels: generateGenericLevels(
      'Logistics',
      'Logistyka',
      'logistics processes',
      'procesów logistycznych'
    ),
  },
  {
    id: 'area_1_6',
    code: '1.6',
    name: 'Quality',
    namePl: 'Jakość',
    levels: generateGenericLevels(
      'Quality',
      'Jakość',
      'quality management',
      'zarządzania jakością'
    ),
  },
  {
    id: 'area_1_7',
    code: '1.7',
    name: 'Maintenance',
    namePl: 'Utrzymanie Ruchu',
    levels: generateGenericLevels(
      'Maintenance',
      'Utrzymanie Ruchu',
      'maintenance processes',
      'procesów utrzymania ruchu'
    ),
  },
  {
    id: 'area_1_8',
    code: '1.8',
    name: 'Finance',
    namePl: 'Finanse',
    levels: generateGenericLevels(
      'Finance',
      'Finanse',
      'financial processes',
      'procesów finansowych'
    ),
  },
  {
    id: 'area_1_9',
    code: '1.9',
    name: 'HR',
    namePl: 'HR',
    levels: generateGenericLevels('HR', 'HR', 'HR processes', 'procesów HR'),
  },
];

// ============================================
// AXIS 2: Digital Products (Digitalne produkty)
// Areas: 2.1-2.5
// ============================================
const axis2Areas = [
  {
    id: 'area_2_1',
    code: '2.1',
    name: 'Product Digitization',
    namePl: 'Digitalizacja produktu',
    levels: generateGenericLevels(
      'Product Digitization',
      'Digitalizacja produktu',
      'product digitization',
      'digitalizacji produktu'
    ),
  },
  {
    id: 'area_2_2',
    code: '2.2',
    name: 'IoT Integration',
    namePl: 'Integracja IoT',
    levels: generateGenericLevels(
      'IoT Integration',
      'Integracja IoT',
      'IoT integration',
      'integracji IoT'
    ),
  },
  {
    id: 'area_2_3',
    code: '2.3',
    name: 'Digital Services',
    namePl: 'Usługi cyfrowe',
    levels: generateGenericLevels(
      'Digital Services',
      'Usługi cyfrowe',
      'digital services',
      'usług cyfrowych'
    ),
  },
  {
    id: 'area_2_4',
    code: '2.4',
    name: 'Data Monetization',
    namePl: 'Monetyzacja danych',
    levels: generateGenericLevels(
      'Data Monetization',
      'Monetyzacja danych',
      'data monetization',
      'monetyzacji danych'
    ),
  },
  {
    id: 'area_2_5',
    code: '2.5',
    name: 'Digital Twin',
    namePl: 'Cyfrowy bliźniak',
    levels: generateGenericLevels(
      'Digital Twin',
      'Cyfrowy bliźniak',
      'digital twin implementation',
      'wdrożenia cyfrowego bliźniaka'
    ),
  },
];

// ============================================
// AXIS 3: Digital Business Models (Digitalne modele biznesowe)
// Areas: 3.1-3.5
// ============================================
const axis3Areas = [
  {
    id: 'area_3_1',
    code: '3.1',
    name: 'E-commerce',
    namePl: 'E-commerce',
    levels: generateGenericLevels(
      'E-commerce',
      'E-commerce',
      'e-commerce capabilities',
      'możliwości e-commerce'
    ),
  },
  {
    id: 'area_3_2',
    code: '3.2',
    name: 'Platform Business',
    namePl: 'Model platformowy',
    levels: generateGenericLevels(
      'Platform Business',
      'Model platformowy',
      'platform business model',
      'modelu platformowego'
    ),
  },
  {
    id: 'area_3_3',
    code: '3.3',
    name: 'Subscription Models',
    namePl: 'Modele subskrypcyjne',
    levels: generateGenericLevels(
      'Subscription Models',
      'Modele subskrypcyjne',
      'subscription models',
      'modeli subskrypcyjnych'
    ),
  },
  {
    id: 'area_3_4',
    code: '3.4',
    name: 'As-a-Service',
    namePl: 'As-a-Service',
    levels: generateGenericLevels(
      'As-a-Service',
      'As-a-Service',
      'as-a-service offerings',
      'oferty as-a-service'
    ),
  },
  {
    id: 'area_3_5',
    code: '3.5',
    name: 'Ecosystem Partnerships',
    namePl: 'Partnerstwa ekosystemowe',
    levels: generateGenericLevels(
      'Ecosystem Partnerships',
      'Partnerstwa ekosystemowe',
      'ecosystem partnerships',
      'partnerstw ekosystemowych'
    ),
  },
];

// ============================================
// AXIS 4: Big Data
// Areas: 4.1-4.3
// ============================================
const axis4Areas = [
  {
    id: 'area_4_1',
    code: '4.1',
    name: 'Data Collection',
    namePl: 'Zbieranie danych',
    levels: generateGenericLevels(
      'Data Collection',
      'Zbieranie danych',
      'data collection',
      'zbierania danych'
    ),
  },
  {
    id: 'area_4_2',
    code: '4.2',
    name: 'Data Analytics',
    namePl: 'Analityka danych',
    levels: generateGenericLevels(
      'Data Analytics',
      'Analityka danych',
      'data analytics',
      'analityki danych'
    ),
  },
  {
    id: 'area_4_3',
    code: '4.3',
    name: 'AI & Machine Learning',
    namePl: 'AI i uczenie maszynowe',
    levels: generateGenericLevels(
      'AI & ML',
      'AI i uczenie maszynowe',
      'AI and machine learning',
      'AI i uczenia maszynowego'
    ),
  },
];

// ============================================
// AXIS 5: Transformation Culture (Kultura transformacji)
// Areas: 5.1-5.5
// ============================================
const axis5Areas = [
  {
    id: 'area_5_1',
    code: '5.1',
    name: 'Leadership',
    namePl: 'Przywództwo',
    levels: generateGenericLevels(
      'Leadership',
      'Przywództwo',
      'digital leadership',
      'cyfrowego przywództwa'
    ),
  },
  {
    id: 'area_5_2',
    code: '5.2',
    name: 'Digital Skills',
    namePl: 'Kompetencje cyfrowe',
    levels: generateGenericLevels(
      'Digital Skills',
      'Kompetencje cyfrowe',
      'digital skills development',
      'rozwoju kompetencji cyfrowych'
    ),
  },
  {
    id: 'area_5_3',
    code: '5.3',
    name: 'Change Management',
    namePl: 'Zarządzanie zmianą',
    levels: generateGenericLevels(
      'Change Management',
      'Zarządzanie zmianą',
      'change management',
      'zarządzania zmianą'
    ),
  },
  {
    id: 'area_5_4',
    code: '5.4',
    name: 'Innovation Culture',
    namePl: 'Kultura innowacji',
    levels: generateGenericLevels(
      'Innovation Culture',
      'Kultura innowacji',
      'innovation culture',
      'kultury innowacji'
    ),
  },
  {
    id: 'area_5_5',
    code: '5.5',
    name: 'Agile Organization',
    namePl: 'Organizacja zwinna',
    levels: generateGenericLevels(
      'Agile Organization',
      'Organizacja zwinna',
      'organizational agility',
      'zwinności organizacyjnej'
    ),
  },
];

// ============================================
// AXIS 6: Cybersecurity (Cyberbezpieczeństwo)
// Areas: 6.1-6.5
// ============================================
const axis6Areas = [
  {
    id: 'area_6_1',
    code: '6.1',
    name: 'Security Policies',
    namePl: 'Polityki bezpieczeństwa',
    levels: generateGenericLevels(
      'Security Policies',
      'Polityki bezpieczeństwa',
      'security policies',
      'polityk bezpieczeństwa'
    ),
  },
  {
    id: 'area_6_2',
    code: '6.2',
    name: 'Access Control',
    namePl: 'Kontrola dostępu',
    levels: generateGenericLevels(
      'Access Control',
      'Kontrola dostępu',
      'access control',
      'kontroli dostępu'
    ),
  },
  {
    id: 'area_6_3',
    code: '6.3',
    name: 'Data Protection',
    namePl: 'Ochrona danych',
    levels: generateGenericLevels(
      'Data Protection',
      'Ochrona danych',
      'data protection',
      'ochrony danych'
    ),
  },
  {
    id: 'area_6_4',
    code: '6.4',
    name: 'Threat Detection',
    namePl: 'Wykrywanie zagrożeń',
    levels: generateGenericLevels(
      'Threat Detection',
      'Wykrywanie zagrożeń',
      'threat detection',
      'wykrywania zagrożeń'
    ),
  },
  {
    id: 'area_6_5',
    code: '6.5',
    name: 'Incident Response',
    namePl: 'Reagowanie na incydenty',
    levels: generateGenericLevels(
      'Incident Response',
      'Reagowanie na incydenty',
      'incident response',
      'reagowania na incydenty'
    ),
  },
];

// ============================================
// MAIN EXPORT: Complete Digitization Axes Data
// ============================================
const DIGITIZATION_AXES = [
  {
    id: 'digital_processes',
    number: 1,
    name: 'Digital Processes',
    namePl: 'Digitalne procesy',
    description:
      'Assessment of digital transformation in core business processes including sales, marketing, production, logistics, and support functions.',
    descriptionPl:
      'Ocena transformacji cyfrowej w podstawowych procesach biznesowych, w tym sprzedaży, marketingu, produkcji, logistyki i funkcji wsparcia.',
    icon: 'Workflow',
    color: '#3b82f6',
    areas: axis1Areas,
  },
  {
    id: 'digital_products',
    number: 2,
    name: 'Digital Products',
    namePl: 'Digitalne produkty',
    description:
      'Evaluation of product digitization, IoT integration, digital services, and digital twin capabilities.',
    descriptionPl:
      'Ocena digitalizacji produktów, integracji IoT, usług cyfrowych i możliwości cyfrowego bliźniaka.',
    icon: 'Package',
    color: '#8b5cf6',
    areas: axis2Areas,
  },
  {
    id: 'digital_business_models',
    number: 3,
    name: 'Digital Business Models',
    namePl: 'Digitalne modele biznesowe',
    description:
      'Assessment of digital business model innovation including e-commerce, platforms, subscriptions, and ecosystem partnerships.',
    descriptionPl:
      'Ocena innowacji modeli biznesowych obejmująca e-commerce, platformy, subskrypcje i partnerstwa ekosystemowe.',
    icon: 'Building',
    color: '#ec4899',
    areas: axis3Areas,
  },
  {
    id: 'big_data',
    number: 4,
    name: 'Big Data',
    namePl: 'Big Data',
    description:
      'Evaluation of data collection, analytics capabilities, and AI/ML implementation maturity.',
    descriptionPl:
      'Ocena zbierania danych, możliwości analitycznych oraz dojrzałości wdrożenia AI/ML.',
    icon: 'Database',
    color: '#f59e0b',
    areas: axis4Areas,
  },
  {
    id: 'transformation_culture',
    number: 5,
    name: 'Transformation Culture',
    namePl: 'Kultura transformacji',
    description:
      'Assessment of organizational culture including leadership, digital skills, change management, and innovation mindset.',
    descriptionPl:
      'Ocena kultury organizacyjnej obejmująca przywództwo, kompetencje cyfrowe, zarządzanie zmianą i nastawienie na innowacje.',
    icon: 'Users',
    color: '#10b981',
    areas: axis5Areas,
  },
  {
    id: 'cybersecurity',
    number: 6,
    name: 'Cybersecurity',
    namePl: 'Cyberbezpieczeństwo',
    description:
      'Evaluation of security policies, access control, data protection, threat detection, and incident response capabilities.',
    descriptionPl:
      'Ocena polityk bezpieczeństwa, kontroli dostępu, ochrony danych, wykrywania zagrożeń i reagowania na incydenty.',
    icon: 'Shield',
    color: '#ef4444',
    areas: axis6Areas,
  },
];

// ============================================
// Utility Helper Functions
// ============================================
const getAxisById = (id) => DIGITIZATION_AXES.find((axis) => axis.id === id);

const getAreaByCode = (code) => {
  for (const axis of DIGITIZATION_AXES) {
    const area = axis.areas.find((a) => a.code === code);
    if (area) return { axis, area };
  }
  return undefined;
};

const getTotalAreas = () => DIGITIZATION_AXES.reduce((sum, axis) => sum + axis.areas.length, 0);

const getLevelColor = (level) => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981'];
  return colors[Math.min(level - 1, colors.length - 1)] || '#64748b';
};

const calculateAxisScore = (areaScores) => {
  const scores = Object.values(areaScores);
  if (scores.length === 0) return 0;
  return scores.reduce((sum, s) => sum + s.currentLevel, 0) / scores.length;
};

// ============================================
// Exports
// ============================================
export {
  calculateAxisScore,
  DIGITIZATION_AXES,
  getAreaByCode,
  getAxisById,
  getLevelColor,
  getTotalAreas,
};
