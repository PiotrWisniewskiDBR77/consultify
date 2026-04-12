export const atelierToysLeaderPL: Record<
  string,
  {
    title: string;
    department: string;
    focus: string;
  }
> = {
  'antoine-laurent': {
    title: 'CEO',
    department: 'Zarząd',
    focus: 'Przekształcić Atelier Forward w przewidywalny system operacyjny firmy.',
  },
  'claire-laurent': {
    title: 'CFO i Head of People',
    department: 'Finanse',
    focus: 'Chronić marżę i jednocześnie finansować rozwój SaaS oraz kompetencji zespołu.',
  },
  'julien-moreau': {
    title: 'CTO',
    department: 'Technologia',
    focus: 'Zamienić IRIS i Digital Twin w skalowalne, produktowe możliwości.',
  },
  'marc-dubois': {
    title: 'Dyrektor Zakładu',
    department: 'Operacje',
    focus: 'Podnieść OEE, ograniczyć problemy przezbrojeń i ustabilizować przepustowość.',
  },
  'isabelle-leroy': {
    title: 'Dyrektor Zakupów',
    department: 'Łańcuch dostaw',
    focus: 'Zmniejszyć zmienność cen surowców i ryzyko lead time po stronie dostawców.',
  },
  'luc-rousseau': {
    title: 'Lider Utrzymania Ruchu',
    department: 'Operacje',
    focus: 'Przenieść utrzymanie ruchu z reaktywnego gaszenia pożarów do predykcyjnej kontroli.',
  },
  'sophie-bernard': {
    title: 'Dyrektor Jakości',
    department: 'Jakość',
    focus: 'Domknąć pętlę między defektami, źródłowymi przyczynami i jakością wdrożeń.',
  },
  'thomas-viau': {
    title: 'VP Sales',
    department: 'Commercial',
    focus: 'Rozwijać przychód partnerski i poprawić attach rate subskrypcji.',
  },
  'camille-dubois': {
    title: 'Dyrektor Marketingu',
    department: 'Marketing',
    focus: 'Przełożyć Atelier Forward na wyraźną, rynkową historię kategorii.',
  },
  'jean-claude-laurent': {
    title: 'Senior Advisor',
    department: 'Rada doradcza',
    focus: 'Utrzymać ciągłość strategiczną przy jednoczesnej modernizacji modelu operacyjnego.',
  },
  'amelie-girard': {
    title: 'Dyrektor PMO',
    department: 'Biuro transformacji',
    focus: 'Utrzymywać rytm portfolio, jakość eskalacji i dyscyplinę wykonania.',
  },
  'nicolas-faure': {
    title: 'Head of Product',
    department: 'Produkt',
    focus: 'Spinać Atelier Core, Motion i Digital w jedną logikę portfolio.',
  },
  'lea-martin': {
    title: 'Lider Customer Success',
    department: 'Customer Success',
    focus: 'Zamieniać pilotażowe użycie w odnowienia, referencje i ekspansję.',
  },
  'paul-lambert': {
    title: 'Lider Danych Przemysłowych',
    department: 'Dane',
    focus: 'Podnieść zaufanie do telemetrii zakładu, definicji KPI i danych gotowych pod AI.',
  },
  'elise-robert': {
    title: 'Kontroler Finansowy',
    department: 'Finanse',
    focus: 'Śledzić capex, opex i zrealizowaną wartość względem baseline inicjatyw.',
  },
  'mathieu-chevalier': {
    title: 'Planista Łańcucha Dostaw',
    department: 'Łańcuch dostaw',
    focus: 'Stabilizować planowanie wobec ryzyka komponentów i zmiennych sygnałów popytu.',
  },
  'zoe-perrin': {
    title: 'Partner Program Manager',
    department: 'Kanał partnerski',
    focus: 'Przyspieszać aktywację partnerów i podnosić jakość wdrożenia nowych kohort.',
  },
  'hugo-bernard': {
    title: 'Analityk Transformacji',
    department: 'Biuro zarządu',
    focus: 'Przełożyć postęp, ryzyko i ROI na narrację gotową na zarząd i radę.',
  },
};

export const atelierToysProjectPL: Record<
  string,
  {
    name: string;
    description: string;
    goal: string;
    health: string;
  }
> = {
  'forward-pmo': {
    name: 'Atelier Forward PMO',
    description: 'Centralne sterowanie transformacją łączące operacje, wzrost cyfrowy i governance.',
    goal: 'Utrzymać całą transformację w jednym rytmie decyzji, zależności i realizacji.',
    health: 'amber',
  },
  'factory-excellence': {
    name: 'Doskonałość Operacyjna Zakładu',
    description: 'Program poprawy przepustowości, jakości i odporności operacyjnej.',
    goal: 'Podnieść przepustowość i stabilność produkcji bez pogarszania jakości.',
    health: 'amber',
  },
  'digital-growth': {
    name: 'Wzrost Cyfrowy',
    description: 'Portfolio wzrostu dla Atelier Digital, Motion i oferty subskrypcyjnej.',
    goal: 'Zwiększyć udział przychodów cyfrowych i attach rate w kanałach partnerskich.',
    health: 'green',
  },
  'quality-excellence': {
    name: 'Doskonałość Jakości',
    description: 'Inicjatywy domykające pętlę jakości i przyczyn źródłowych.',
    goal: 'Zmniejszyć powtarzalność defektów i przyspieszyć zamykanie działań korygujących.',
    health: 'amber',
  },
  'partner-expansion': {
    name: 'Rozwój Kanału Partnerskiego',
    description: 'Program aktywacji partnerów i wzrostu oferty cyfrowej.',
    goal: 'Skrócić czas do pierwszej sprzedaży bundla cyfrowego przez partnerów.',
    health: 'green',
  },
  'people-capability': {
    name: 'Kompetencje i Leadership',
    description: 'Program rozwoju liderów i rytmu zarządzania dla Atelier Forward.',
    goal: 'Zbudować nawyki zarządcze, które utrwalą zmianę operacyjną.',
    health: 'green',
  },
  'board-governance': {
    name: 'Governance Zarządczy',
    description: 'System przygotowania decyzji zarządu i rady w oparciu o żywe sygnały.',
    goal: 'Zamienić przygotowanie board packów w ciągły workflow oparty na dowodach.',
    health: 'amber',
  },
};

export const atelierToysInitiativePL: Record<string, any> = {
  'line-3-digital-twin': {
    name: 'Rollout Digital Twin dla Linii 3',
    area: 'Operacje',
    summary: 'Uruchomić pilotaż i skalowanie Digital Twin dla linii o największym wpływie na przepustowość.',
    currentStage: 'Skalowanie',
    deliverables: ['Model Digital Twin dla Linii 3', 'Dashboard telemetrii', 'Playbook dla supervisorów'],
    successCriteria: ['OEE +8 pkt', 'Mniej nieplanowanych postojów', 'Lepsza jakość przezbrojeń'],
    keyRisks: ['Niska jakość telemetrii', 'Brak adopcji supervisorów', 'Zbyt szeroki rollout'],
    tasks: {
      'line3-sensor-gap': {
        title: 'Domknąć luki czujników na Linii 3',
        description: 'Uzupełnić krytyczne punkty pomiarowe potrzebne do stabilnego modelu twin.',
        why: 'Bez pełnego sygnału model będzie wyglądał dobrze na demo, ale nie da zaufania operacyjnego.',
      },
      'line3-changeover-standard': {
        title: 'Ujednolicić standard przezbrojenia w twinie',
        description: 'Wpiąć sekwencję przezbrojeń do workflow i porównać ją ze zmianami brygad.',
        why: 'Największa część straty przepustowości nadal siedzi w przekazaniu zmiany i dyscyplinie.',
      },
      'line3-board-demo': {
        title: 'Przygotować board-ready demo twin dla zarządu',
        description: 'Pokazać wpływ na OEE, przestoje i decyzje inwestycyjne w jednej narracji.',
        why: 'Board musi zobaczyć związek między technologią a realną wartością biznesową.',
      },
    },
    decisions: {
      'line3-rollout-funding': {
        title: 'Zatwierdzić finansowanie rolloutu Digital Twin na Linie 3 i 4',
        rationale: 'Pilot pokazał potencjał, ale pełny rollout wymaga jawnej zgody na kolejną falę.',
      },
    },
    milestones: {
      'line3-data-live': {
        name: 'Telemetria live',
        description: 'Kluczowe sygnały z linii są dostępne w czasie rzeczywistym dla twin i dashboardów.',
      },
      'line3-supervisor-pilot': {
        name: 'Pilot supervisorów uruchomiony',
        description: 'Pierwsza grupa supervisorów pracuje na twinie i zgłasza jakość rekomendacji.',
      },
      'line3-board-gate': {
        name: 'Gate zarządczy dla skalowania',
        description: 'Board review potwierdza gotowość do przejścia z pilotażu do kolejnej fali.',
      },
    },
  },
  'procurement-control-tower': {
    name: 'Control Tower Zakupowy',
    area: 'Zakupy',
    summary: 'Uspójnić sygnały dostawców, ryzyka komponentów i decyzje zakupowe w jednym cockpitcie.',
    deliverables: ['Scorecards dostawców', 'War room zakupowy', 'Reguły eskalacji ryzyka'],
    successCriteria: ['Lepsza widoczność ryzyk', 'Szybsza reakcja na opóźnienia', 'Mniej zaskoczeń marżowych'],
    keyRisks: ['Niespójne dane dostawców', 'Słaba dyscyplina aktualizacji', 'Brak wspólnych progów ryzyka'],
    tasks: {
      'procurement-supplier-scorecards': {
        title: 'Uruchomić scorecards dla dostawców krytycznych',
        description: 'Zbudować wspólny widok lead time, jakości i ryzyka dla kluczowych partnerów.',
        why: 'Bez jednej wersji prawdy zakupy i operacje będą dalej reagować za późno.',
      },
      'procurement-war-room': {
        title: 'Uruchomić cotygodniowy war room zakupowy',
        description: 'Ustalić rytm przeglądu zagrożeń i decyzji cross-funkcyjnych.',
        why: 'Największa poprawa wynika z szybszych decyzji, nie z samego dashboardu.',
      },
    },
    decisions: {
      'procurement-dual-source': {
        title: 'Zatwierdzić dual sourcing dla komponentów wysokiego ryzyka',
        rationale: 'Drugi dostawca zwiększy koszt krótkoterminowy, ale obniży ryzyko marży i dostępności.',
      },
    },
    milestones: {
      'procurement-scorecards-live': {
        name: 'Scorecards live',
        description: 'Kluczowe scorecards dostawców są aktywne i wykorzystywane w review.',
      },
      'procurement-risk-review': {
        name: 'Review ryzyk dostawców',
        description: 'Pierwszy wspólny review dostarczył decyzje i właścicieli działań.',
      },
    },
  },
  'atelier-digital-growth': {
    name: 'Wzrost Atelier Digital',
    area: 'Wzrost',
    summary: 'Przełożyć historię Digital Twin i bundle cyfrowego na wyższy attach rate i odnowienia.',
    deliverables: ['Partner kit', 'Pakiet sygnałów renewal risk', 'Board pack wzrostowy'],
    successCriteria: ['Attach rate +7 pkt', 'Lepsza jakość pipeline', 'Silniejsza narracja odnowień'],
    keyRisks: ['Niespójny messaging', 'Brak dowodów adopcji', 'Rozjazd między produktem a sprzedażą'],
    tasks: {
      'digital-growth-partner-kit': {
        title: 'Zaktualizować partner kit pod historię hardware-to-SaaS',
        description: 'Wzmocnić narrację bundle i referencje dla partnerów pilotażowych.',
        why: 'Partnerzy sprzedają szybciej, gdy historia jest prosta i oparta na dowodach.',
      },
      'digital-growth-renewal-risk': {
        title: 'Zbudować sygnały ryzyka odnowień',
        description: 'Połączyć aktywację, usage i jakość onboardingu w jeden pakiet sygnałów.',
        why: 'Odnowienia nie mogą być zarządzane intuicją handlową, tylko sygnałem z użytkowania.',
      },
    },
    decisions: {
      'digital-growth-pricing': {
        title: 'Wybrać strategię cenową dla bundle cyfrowego',
        rationale: 'Kolejny etap wzrostu wymaga spójnej logiki ceny, attach i adopcji.',
      },
    },
    milestones: {
      'digital-growth-pipeline-review': {
        name: 'Review pipeline wzrostowego',
        description: 'Pipeline bundle cyfrowego jest przeglądany razem z dowodami adopcji.',
      },
      'digital-growth-board-pack': {
        name: 'Board pack wzrostowy gotowy',
        description: 'Zarząd ma spójną narrację wzrostu opartą o kanał partnerski i usage.',
      },
    },
  },
  'supplier-risk-war-room': {
    name: 'War Room Ryzyk Dostawców',
    area: 'Łańcuch dostaw',
    summary: 'Zrobić z ryzyka dostawców codzienny workflow decyzji zamiast miesięcznego raportu.',
    deliverables: ['Alerty ryzyka', 'Playbooki eskalacji', 'Polityka buforów'],
    successCriteria: ['Szybsza reakcja na zakłócenia', 'Mniej eskalacji ad hoc', 'Lepsza wiarygodność obietnic delivery'],
    keyRisks: ['Przeciążenie alertami', 'Brak właścicieli decyzji', 'Rozbieżne priorytety funkcji'],
    tasks: {
      'supplier-war-room-score': {
        title: 'Ujednolicić scoring ryzyka dostawców',
        description: 'Spiąć lead time, jakość i sygnały logistyczne w jedną ocenę.',
        why: 'Bez wspólnego scoringu każda funkcja będzie dalej czytać ryzyko inaczej.',
      },
      'supplier-war-room-alerts': {
        title: 'Uruchomić alerty dla krytycznych komponentów',
        description: 'Skonfigurować progi i routing dla opóźnień oraz zagrożeń dostępności.',
        why: 'Wczesny sygnał jest ważniejszy niż perfekcyjny raport po fakcie.',
      },
      'supplier-war-room-playbooks': {
        title: 'Przygotować playbooki odpowiedzi na zakłócenia',
        description: 'Ustalić warianty reakcji przy opóźnieniu, braku komponentów i wzroście kosztu.',
        why: 'War room musi prowadzić do decyzji, nie tylko do opisu problemu.',
      },
    },
    decisions: {
      'supplier-war-room-buffer-policy': {
        title: 'Potwierdzić politykę buforów dla komponentów krytycznych',
        rationale: 'Lepszy bufor może ograniczyć ryzyko utraty marży i wiarygodności wobec partnerów.',
      },
    },
    milestones: {
      'supplier-war-room-live': {
        name: 'War room działa',
        description: 'Nowy rytm ryzyka dostawców został uruchomiony i ma właścicieli działań.',
      },
      'supplier-war-room-policy': {
        name: 'Polityka ryzyka uzgodniona',
        description: 'Zespół uzgodnił progi eskalacji, scoring i zasady buforów.',
      },
    },
  },
  'qa-defect-closing-loop': {
    name: 'Domknięcie Pętli Defektów QA',
    area: 'Jakość',
    summary: 'Zmienić zarządzanie defektami z reakcji punktowych w powtarzalny system zamknięcia i weryfikacji.',
    deliverables: ['Taksonomia defektów', 'Board przyczyn źródłowych', 'Dashboard close-rate'],
    successCriteria: ['Mniej nawrotów defektów', 'Szybsze zamknięcie działań', 'Jeden właściciel engineeringowy dla wzorców cross-plant'],
    keyRisks: ['Brak domknięcia po pierwszym review', 'Słaby ownership engineeringu', 'Za dużo lokalnych obejść'],
    tasks: {
      'qa-defect-taxonomy': {
        title: 'Ujednolicić taksonomię defektów i eskalacji',
        description: 'Stworzyć wspólny język problemów jakościowych dla zakładu, QA i engineeringu.',
        why: 'Bez wspólnej klasyfikacji nie da się zobaczyć powtarzalności wzorców.',
      },
      'qa-root-cause-board': {
        title: 'Uruchomić board przyczyn źródłowych',
        description: 'Połączyć containment, źródłową przyczynę i status działań w jednym widoku.',
        why: 'Zespół potrzebuje jednego miejsca, w którym widać czy problem naprawdę został zamknięty.',
      },
      'qa-launch-checklist': {
        title: 'Domknąć checklistę jakościową dla bundle launch',
        description: 'Uspójnić readiness support, engineeringu i QA przed wdrożeniem.',
        why: 'Część problemów jakościowych zaczyna się od niesynchronizowanego launchu, nie od fabryki.',
      },
    },
    decisions: {
      'qa-escalation-thresholds': {
        title: 'Uzgodnić progi eskalacji dla defektów wysokiego wpływu',
        rationale: 'Zespół potrzebuje jasnego momentu, w którym problem przechodzi na poziom leadership review.',
      },
      'qa-engineering-ownership': {
        title: 'Przypisać jednego ownera engineeringowego do wzorców cross-plant',
        rationale: 'Bez centralnego ownera odpowiedzialność rozmywa się między lokalne zespoły.',
      },
    },
    milestones: {
      'qa-cockpit-alpha': {
        name: 'Cockpit jakości alpha',
        description: 'Pierwsza wersja cockpitu jakościowego zbiera sygnały z kilku źródeł.',
      },
      'qa-corrective-close-rate': {
        name: 'Close-rate działań korygujących widoczny',
        description: 'Leadership widzi już tempo i jakość zamykania działań korygujących.',
      },
    },
  },
  'product-roadmap-sync': {
    name: 'Synchronizacja Product Roadmap',
    area: 'Produkt',
    summary: 'Spiąć roadmapę produktu z sygnałami adopcji, operacji i kanału partnerskiego.',
    deliverables: ['Signal pack roadmapowy', 'Plan kwartalny', 'Review z partnerami'],
    successCriteria: ['Lepsze priorytety roadmapy', 'Mniej losowych próśb o wyjątki', 'Jasne trade-offy między adopcją a głębią analityki'],
    keyRisks: ['Chaos priorytetów', 'Brak wspólnych trade-offów', 'Rozjazd między produktem i growth'],
    tasks: {
      'product-roadmap-signal-pack': {
        title: 'Przygotować signal pack do priorytetyzacji roadmapy',
        description: 'Połączyć feedback klientów, partnerów, usage i potrzeby operacyjne.',
        why: 'Roadmapa musi odzwierciedlać realną wartość, a nie tylko najgłośniejszego sponsora.',
      },
      'product-roadmap-quarter-plan': {
        title: 'Uzgodnić kwartalny plan i trade-offy',
        description: 'Wybrać jeden główny zakład i jeden boczny eksperyment dla kolejnego cyklu.',
        why: 'Za dużo równoległych zakładów osłabia i delivery, i narrację dla rynku.',
      },
      'product-roadmap-partner-review': {
        title: 'Przeprowadzić review roadmapy z partnerami pilotażowymi',
        description: 'Sprawdzić czy najbliższe decyzje roadmapowe wspierają realny motion kanału.',
        why: 'Kanał partnerski jest dziś kluczowym miejscem potwierdzenia wartości produktu.',
      },
    },
    decisions: {
      'product-roadmap-bet': {
        title: 'Wybrać główny zakład roadmapowy na kolejny kwartał',
        rationale: 'Leadership musi świadomie wybrać między szybszą adopcją a głębszym insightem analitycznym.',
      },
    },
    milestones: {
      'product-roadmap-inputs-ready': {
        name: 'Sygnały wejściowe gotowe',
        description: 'Zespół ma już pełny pakiet sygnałów potrzebnych do wyboru priorytetów.',
      },
      'product-roadmap-quarter-gate': {
        name: 'Gate kwartalny roadmapy',
        description: 'Nowy plan kwartalny został uzgodniony i zakomunikowany.',
      },
    },
  },
  'partner-onboarding-excellence': {
    name: 'Doskonałość Onboardingu Partnerów',
    area: 'Kanał partnerski',
    summary: 'Skrócić czas od podpisania partnera do pierwszej sprzedaży bundle cyfrowego.',
    deliverables: ['Journey partnera', 'Scorecards aktywacji', 'Case pack'],
    successCriteria: ['Szybsza gotowość demo', 'Silniejsza aktywacja', 'Wyższa spójność sprzedaży partnerów'],
    keyRisks: ['Za długi onboarding', 'Brak jednej historii wartości', 'Słaba jakość pierwszego wdrożenia'],
    tasks: {
      'partner-onboarding-journey': {
        title: 'Zaprojektować nową ścieżkę onboardingu partnera',
        description: 'Ułożyć kroki od podpisania umowy do pierwszego warsztatu z klientem.',
        why: 'Pierwsze 30 dni przesądza o tym, czy partner naprawdę zacznie sprzedawać.',
      },
      'partner-onboarding-scorecards': {
        title: 'Uruchomić scorecards aktywacji partnerów',
        description: 'Mierzyć gotowość demo, pierwsze działania i jakość aktywacji.',
        why: 'Zespół potrzebuje sygnału, które kohorty są gotowe do skalowania, a które utknęły.',
      },
      'partner-onboarding-case-pack': {
        title: 'Spakować case Atelier Toys do story sprzedażowej partnera',
        description: 'Przygotować zestaw materiałów pokazujących efekt hardware-to-SaaS.',
        why: 'Najsilniejszym akceleratorem aktywacji partnerów jest realna historia klienta.',
      },
    },
    decisions: {
      'partner-onboarding-certification': {
        title: 'Zatwierdzić lekki próg certyfikacji partnera',
        rationale: 'Lżejsza certyfikacja ma podnieść spójność bez zabicia tempa aktywacji.',
      },
    },
    milestones: {
      'partner-onboarding-v1': {
        name: 'Onboarding v1 live',
        description: 'Pierwsza ustandaryzowana wersja onboardingu działa.',
      },
      'partner-onboarding-first-cohort': {
        name: 'Pierwsza kohorta oceniona',
        description: 'Zespół przejrzał pierwszą kohortę po nowym onboardingu i zebrał wnioski.',
      },
    },
  },
  'supervisor-capability-academy': {
    name: 'Akademia Kompetencji Supervisorów',
    area: 'Ludzie',
    summary: 'Wyposażyć supervisorów i liderów w rytm zarządzania potrzebny dla Atelier Forward.',
    deliverables: ['Program akademii', 'Checkpoints coachingowe', 'Dashboard adopcji'],
    successCriteria: ['Adherence do rutyn +25%', 'Lepsza jakość eskalacji', 'Wyższa pewność managerów'],
    keyRisks: ['Brak czasu liderów', 'Niespójne wsparcie sponsorów', 'Zbyt teoretyczny trening'],
    tasks: {
      'academy-curriculum': {
        title: 'Domknąć program akademii supervisorów',
        description: 'Połączyć daily management, eskalacje i review danych w praktyczny program.',
        why: 'Treść programu zdecyduje, czy to będzie zmiana zachowań, czy tylko kolejne szkolenie.',
      },
      'academy-cohort-1': {
        title: 'Uruchomić pierwszą kohortę akademii',
        description: 'Włączyć liderów zakładu i funkcji crossowych do pierwszej fali.',
        why: 'Widoczne zaangażowanie leadershipu jest warunkiem wiarygodności całego programu.',
      },
      'academy-adoption-dash': {
        title: 'Uruchomić dashboard adopcji akademii',
        description: 'Mierzyć frekwencję, działania po sesjach i dyscyplinę rutyn.',
        why: 'Board zapyta, czy capability uplift naprawdę zamienia się w nowe zachowania.',
      },
    },
    decisions: {
      'academy-scale': {
        title: 'Zdecydować o rozszerzeniu akademii na zespoły produktowe i customer teams',
        rationale: 'Skalowanie powinno nastąpić dopiero po potwierdzeniu realnej zmiany zachowań.',
      },
    },
    milestones: {
      'academy-cohort-live': {
        name: 'Pierwsza kohorta działa',
        description: 'Cross-funkcyjna kohorta rozpoczęła program akademii.',
      },
      'academy-first-retro': {
        name: 'Pierwsza retro zamknięta',
        description: 'Zespół ocenił adopcję, luki treści i kolejne ruchy.',
      },
    },
  },
  'board-value-tracking': {
    name: 'Board Value Tracking',
    area: 'Governance',
    summary: 'Uczynić wartość, ryzyko i follow-up po decyzjach widocznymi w każdym cyklu zarządczym.',
    deliverables: ['Board scorecard', 'Log follow-upów decyzji', 'Transformation score'],
    successCriteria: ['100% completeness follow-upów', 'Wyższa pewność ROI', 'Czas przygotowania board packa -35%'],
    keyRisks: ['Ręczny ciężar raportowania', 'Niespójne założenia', 'Słaby follow-through po decyzjach'],
    tasks: {
      'board-scorecard-v2': {
        title: 'Opublikować board scorecard v2',
        description: 'Połączyć finanse, operacje, digital i capability w jeden scorecard.',
        why: 'Zarząd potrzebuje jednego wspólnego języka postępu i ryzyka.',
      },
      'board-followup-log': {
        title: 'Uzupełnić ostatnie dwa cykle boardowe w logu follow-upów',
        description: 'Dopisać otwarte akcje, ownerów i terminy dla poprzednich decyzji.',
        why: 'Bez historii follow-upów cockpit zarządczy szybko traci wiarygodność.',
      },
      'board-roi-logic': {
        title: 'Odświeżyć logikę ROI dla 10 najważniejszych inicjatyw',
        description: 'Uzgodnić realized value, expected value i confidence bands.',
        why: 'To rdzeń wiarygodnej narracji transformacyjnej.',
      },
    },
    decisions: {
      'board-scorecard-standard': {
        title: 'Przyjąć board scorecard jako standardową miesięczną narrację executive',
        rationale: 'Rada chce jednego, powtarzalnego artefaktu do oceny transformacji.',
      },
    },
    milestones: {
      'board-scorecard-draft': {
        name: 'Draft board scorecard gotowy',
        description: 'CEO i CFO zreviewowali draft nowego scorecardu.',
      },
      'board-decision-pack': {
        name: 'Decision pack podpisany',
        description: 'Deck i decision pack są gotowe na kolejną sesję boardową.',
      },
    },
  },
  'atelier-motion-concept-lab': {
    name: 'Concept Lab Atelier Motion',
    area: 'Innowacja',
    summary: 'Zdefiniować nową generację zestawów motion-based STEM i przetestować pierwsze hipotezy.',
    currentStage: 'Discovery',
    deliverables: ['Concept brief', 'Pakiet insightów od nauczycieli', 'Pierwszy test desirability'],
    successCriteria: ['Zidentyfikowane top 3 ryzyka konceptu', '10 wywiadów z klientami', 'Wybrany jeden koncept do pilotażu'],
    keyRisks: ['Shiny-object bias', 'Słaba jakość sygnału klienta', 'Brak jasnej ścieżki monetyzacji'],
    tasks: {
      'motion-concept-interviews': {
        title: 'Przeprowadzić wywiady z nauczycielami o zastosowaniach motion-learning',
        description: 'Zebrać potrzeby, bóle i sygnały willingness-to-pay przed zamknięciem konceptu.',
        why: 'Koncept musi wynikać z dowodów, a nie tylko z intuicji produktowej.',
      },
      'motion-concept-brief': {
        title: 'Przygotować concept brief i drzewo hipotez',
        description: 'Podsumować segment, obietnicę wartości, trigger adopcji i miarę sukcesu.',
        why: 'To artefakt, który przenosi pomysł z inspiracji do realnej rozmowy portfolio.',
      },
    },
    decisions: {
      'motion-concept-go-no-go': {
        title: 'Wybrać czy concept lab przechodzi do business case',
        rationale: 'Zespół potrzebuje jasnego gate przed wejściem w design i obciążenie partnerów.',
      },
    },
    milestones: {
      'motion-concept-signal-pack': {
        name: 'Signal pack skonsolidowany',
        description: 'Feedback nauczycieli i partnerów jest gotowy do review konceptu.',
      },
    },
  },
  'ot-cyber-hardening': {
    name: 'OT Cyber Hardening',
    area: 'Cyberbezpieczeństwo',
    summary: 'Zatwierdzić bazowy standard bezpieczeństwa OT i przygotować pierwszą falę wdrożenia.',
    currentStage: 'Business Case',
    deliverables: ['Baseline kontroli OT', 'Plan segmentacji', 'Rejestr ryzyk gotowy do audytu'],
    successCriteria: ['Baseline zatwierdzony', 'Zakres pierwszego zakładu określony', 'Priorytety luk krytycznych ustalone'],
    keyRisks: ['Postrzeganie security jako czystego kosztu', 'Niejasny podział OT/IT', 'Obawy przed przestojem zakładu'],
    tasks: {
      'ot-cyber-baseline': {
        title: 'Domknąć baseline kontroli OT',
        description: 'Uzgodnić segmentację, dostęp uprzywilejowany i monitoring dla pierwszej fali.',
        why: 'Inicjatywa jest zatwierdzona, ale wdrożenie nie ruszy bez jednego uzgodnionego standardu.',
      },
    },
    decisions: {
      'ot-cyber-wave1': {
        title: 'Zatwierdzić pierwszą falę hardeningu dla Lyon East',
        rationale: 'Pierwsza fala została zatwierdzona, aby zmniejszyć ekspozycję przed dalszym rolloutem Digital Twin.',
      },
    },
    milestones: {
      'ot-cyber-approved': {
        name: 'Business case zatwierdzony',
        description: 'Hardening bezpieczeństwa przeszedł z analizy do finansowanego portfolio.',
      },
      'ot-cyber-implementation-plan': {
        name: 'Plan wdrożenia gotowy',
        description: 'Sekwencja wdrożeniowa dla pierwszego zakładu jest gotowa.',
      },
    },
  },
  'lyon-north-scheduler-pilot': {
    name: 'Pilot Schedulera w Lyon North',
    area: 'Planowanie',
    summary: 'Zaplanować pilot inteligentnego schedulera produkcji dla Lyon North.',
    currentStage: 'Przygotowanie pilota',
    deliverables: ['Logika pilota schedulera', 'Reguły wyjątków', 'Review symulacji zmian'],
    successCriteria: ['Pilot rusza na czas', 'Poprawa adherence planu', 'Wyższe zaufanie planistów'],
    keyRisks: ['Sceptycyzm planistów', 'Słabe dane master', 'Przestrzelenie pod jeden scenariusz'],
    tasks: {
      'scheduler-pilot-readiness': {
        title: 'Potwierdzić gotowość pilota i kompletność danych',
        description: 'Sprawdzić wejścia, constraints i sign-off planistów przed startem.',
        why: 'Nawet zaplanowany pilot może się wykoleić przy słabej pracy przygotowawczej.',
      },
    },
    decisions: {
      'scheduler-pilot-start': {
        title: 'Potwierdzić datę startu pilota schedulera',
        rationale: 'Zespół potrzebuje ostatniego readiness check przed otwarciem okna pilota.',
      },
    },
    milestones: {
      'scheduler-pilot-window': {
        name: 'Okno pilota zamknięte',
        description: 'Data startu i zakres pilota zostały ostatecznie ustalone.',
      },
    },
  },
  'atelier-core-onboarding-revamp': {
    name: 'Przebudowa Onboardingu Atelier Core',
    area: 'Customer Success',
    summary: 'Wdrożyć nową ścieżkę onboardingu Atelier Core i skrócić time-to-value.',
    currentStage: 'Rollout',
    deliverables: ['Journey onboardingu', 'Scorecard pierwszych 30 dni', 'Assets dla coachów'],
    successCriteria: ['Time-to-first-value -25%', 'Aktywacja +12 pkt', 'Niższe obciążenie supportu'],
    keyRisks: ['Rozjazd komunikacji między zespołami', 'Brak definicji usage triggera', 'Przeciążenie supportu podczas rolloutu'],
    tasks: {
      'core-onboarding-playbook': {
        title: 'Wdrożyć nowy playbook onboardingu dla zespołów customer-facing',
        description: 'Włączyć sprzedaż, success i support w jeden wspólny ruch.',
        why: 'Jakość wykonania zależy od jednej, spójnej ścieżki między zespołami.',
      },
      'core-onboarding-metrics': {
        title: 'Śledzić sygnały adopcji w pierwszych 30 dniach',
        description: 'Mierzyć aktywację, pierwsze działania i momenty wymagające wsparcia.',
        why: 'Bez sygnałów rollout bardzo szybko staje się anegdotyczny.',
      },
    },
    decisions: {
      'core-onboarding-scale': {
        title: 'Zdecydować czy nowa ścieżka stanie się standardem dla wszystkich nowych klientów',
        rationale: 'Pierwsza fala wdrożeniowa musi najpierw udowodnić wartość przed pełną standaryzacją.',
      },
    },
    milestones: {
      'core-onboarding-wave1': {
        name: 'Wave 1 działa',
        description: 'Pierwsza fala onboardingu jest aktywna dla wybranych kohort klientów.',
      },
    },
  },
  'warehouse-automation-wave1': {
    name: 'Automatyzacja Magazynu Wave 1',
    area: 'Logistyka',
    summary: 'Odblokować pierwszą falę automatyzacji magazynu po opóźnieniu przez layout i safety.',
    currentStage: 'Ryzyko wykonania',
    deliverables: ['Layout Wave 1', 'Review bezpieczeństwa', 'SOP-y automatyzacji'],
    successCriteria: ['Czas przemieszczania -18%', 'Błędy kompletacji -30%', '0 incydentów bezpieczeństwa'],
    keyRisks: ['Nierozwiązany conflict layoutu', 'Dostępność integratora', 'Opóźnienie safety sign-off'],
    tasks: {
      'warehouse-layout-rework': {
        title: 'Rozwiązać konflikt layoutu na inbound lane',
        description: 'Usunąć kolizję między komórkami automatyzacji a ścieżką wózków.',
        why: 'To główny blocker, który dziś zatrzymuje restart tej fali.',
      },
    },
    decisions: {
      'warehouse-wave1-unblock': {
        title: 'Zdecydować czy zawęzić scope Wave 1, aby odzyskać harmonogram',
        rationale: 'Leadership musi wybrać między pełnym zakresem a szybszym odzyskaniem momentum.',
      },
    },
    milestones: {
      'warehouse-wave1-blocker': {
        name: 'Review blockera zamknięty',
        description: 'Operacje i safety wspólnie oceniły główny problem layoutowy.',
      },
    },
  },
  'predictive-maintenance-rollout': {
    name: 'Rollout Predykcyjnego Utrzymania Ruchu',
    area: 'Niezawodność',
    summary: 'Śledzić zrealizowaną wartość z alertów predykcyjnych po pierwszej fali wdrożenia.',
    currentStage: 'Realizacja wartości',
    deliverables: ['Log tuningu alertów', 'Dashboard adopcji maintenance', 'Pakiet dowodów oszczędności'],
    successCriteria: ['Nieplanowane postoje -12%', 'Wyższa precyzja alertów', 'Dowody oszczędności gotowe na steering'],
    keyRisks: ['Słaba dyscyplina dowodowa', 'Powrót alert fatigue', 'Przeszacowanie savings'],
    tasks: {
      'predictive-maintenance-value-pack': {
        title: 'Przygotować pakiet dowodów zrealizowanej wartości',
        description: 'Pokazać realnie osiągnięte oszczędności i poziom pewności dowodów.',
        why: 'Faza tracking wymaga dowodów, a nie samej narracji sukcesu.',
      },
    },
    decisions: {
      'predictive-maintenance-scale': {
        title: 'Zdecydować czy skalować rollout na ostatni zakład',
        rationale: 'Skala powinna nastąpić dopiero po uznaniu wartości przez finanse i operacje.',
      },
    },
    milestones: {
      'predictive-maintenance-wave1-complete': {
        name: 'Wave 1 zakończona',
        description: 'Pierwsza fala rolloutu została zamknięta i jest już w trybie value tracking.',
      },
    },
  },
  'legacy-crm-retirement': {
    name: 'Wyłączenie Legacy CRM',
    area: 'Systemy',
    summary: 'Domknąć wyjście z legacy CRM po udanej migracji zespołu komercyjnego.',
    currentStage: 'Zamknięte',
    deliverables: ['Checklist decommissioningu', 'Log migracji danych', 'Playbook adopcji nowego CRM'],
    successCriteria: ['Stare licencje wyłączone', 'Stabilna jakość danych', 'Pełna migracja handlu'],
    keyRisks: ['Utrata danych historycznych', 'Shadow spreadsheets', 'Niejasny ownership supportu'],
    tasks: {
      'legacy-crm-closeout': {
        title: 'Zarchiwizować pakiet closeout i lessons learned',
        description: 'Udokumentować co zadziałało, co nie i co można powtórzyć przy kolejnych migracjach.',
        why: 'Zamknięte inicjatywy też muszą zostawiać wiedzę do ponownego użycia.',
      },
    },
    decisions: {
      'legacy-crm-close': {
        title: 'Potwierdzić formalny closeout wyłączenia legacy CRM',
        rationale: 'Cele migracji zostały osiągnięte, a stary stack jest w pełni wyłączony.',
      },
    },
    milestones: {
      'legacy-crm-retired': {
        name: 'Legacy CRM wyłączony',
        description: 'Stara platforma została zdekomisjonowana i zarchiwizowana.',
      },
    },
  },
  'classroom-community-app': {
    name: 'Aplikacja Classroom Community',
    area: 'Produkt',
    summary: 'Sprawdzić community companion app, a następnie zatrzymać temat z powodu słabego dopasowania do roadmapy.',
    currentStage: 'Zatrzymane',
    deliverables: ['Spec konceptu', 'Hipoteza adopcji', 'Notatka o scope pilota'],
    successCriteria: ['Potwierdzić silny popyt edukatorów', 'Sprawdzić fit z core roadmapą', 'Nie zwiększyć burden na support'],
    keyRisks: ['Słaby fit strategiczny', 'Rozproszenie uwagi roadmapy', 'Brak jasnego ownera po pilocie'],
    tasks: {
      'community-app-closeout': {
        title: 'Udokumentować dlaczego koncept został zatrzymany',
        description: 'Zapisać dowody i trade-offy stojące za decyzją o zatrzymaniu.',
        why: 'Anulowana praca też musi uczyć portfolio czego nie powtarzać.',
      },
    },
    decisions: {
      'community-app-cancel': {
        title: 'Zatrzymać koncept community app i realokować effort',
        rationale: 'Koncept miał słaby potencjał przychodowy i rozmywał fokus roadmapy.',
      },
    },
    milestones: {
      'community-app-stopped': {
        name: 'Koncept formalnie zatrzymany',
        description: 'Zespół zamknął temat i zarchiwizował wnioski.',
      },
    },
  },
};

export const atelierToysReportPL: Record<string, { title: string; content: string }> = {
  'board-qbr': {
    title: 'Board QBR: momentum Atelier Forward',
    content: 'Atelier Forward dowozi kluczowe kamienie milowe, ale jakość telemetrii i zmienność dostawców pozostają dwoma głównymi tematami dla boardu.',
  },
  'factory-weekly': {
    title: 'Tygodniowy Przegląd Operacji Zakładu',
    content: 'OEE wzrosło tydzień do tygodnia o 2,3 pkt. Największym obciążeniem pozostają mikroprzestoje heat-treatment i słaba dyscyplina przezbrojeń.',
  },
  'digital-growth-pulse': {
    title: 'Digital Growth Pulse',
    content: 'Attach rate Atelier Digital wzrósł o 7 pkt u partnerów pilotażowych, szczególnie tam, gdzie onboarding od początku opiera się o historię Digital Twin.',
  },
  'quality-monthly': {
    title: 'Miesięczny Review Jakości',
    content: 'Powtarzalne wzorce defektów zawężają się, ale cross-plant closure działań korygujących nadal jest zbyt wolny przy problemach o wysokim wpływie.',
  },
  'partner-cohort-review': {
    title: 'Review Kohorty Partnerskiej',
    content: 'Pierwsza kohorta szybciej osiąga gotowość demo i lepiej pozycjonuje bundle tam, gdzie case story pojawia się wcześnie.',
  },
  'academy-adoption-pulse': {
    title: 'Capability Academy Adoption Pulse',
    content: 'Managerowie dobrze angażują się w nowe rutyny, ale jakość eskalacji nadal silnie różni się między funkcjami.',
  },
  'board-pre-read': {
    title: 'Board pre-read: pakiet sygnałów wartości i ryzyka',
    content: 'Board powinien skupić się na skali Linii 3, ochronie marży wobec zmienności dostawców i wiarygodności dowodów pokazujących zrealizowaną wartość.',
  },
};

export const atelierToysKnowledgeDocPL: Record<string, { title: string; category: string; body: string }> = {
  'forward-charter': {
    title: 'Karta programu Atelier Forward',
    category: 'strategia',
    body: 'Atelier Forward łączy doskonałość fabryki, wzrost SaaS i governance leadershipu w jedno portfolio z jawnym ownershipem ROI i ryzyka.',
  },
  'line3-root-causes': {
    title: 'Analiza przyczyn źródłowych przestojów Linii 3',
    category: 'operacje',
    body: 'Największe źródła przestojów to mikrostop heat-treatment, opóźniony dispatch maintenance i niespójne handovery przezbrojeń między zmianami.',
  },
  'partner-growth-story': {
    title: 'Historia wzrostu partnerskiego dla Atelier Digital',
    category: 'wzrost',
    body: 'Partnerzy konwertują najlepiej, gdy historia przechodzi od sprzedaży hardware do recurring outcomes, usage data i wartości wspartej przez Digital Twin.',
  },
  'board-scorecard-logic': {
    title: 'Logika board scorecardu',
    category: 'governance',
    body: 'Board scorecard łączy zrealizowane ROI, przyszłą wartość ważoną pewnością, stabilność sygnałów operacyjnych i jakość follow-upów po decyzjach.',
  },
  'qa-defect-patterns': {
    title: 'Log wzorców defektów QA',
    category: 'jakość',
    body: 'Najczęstsze wzorce nawrotów dotyczą dryfu tolerancji pakowania, niedopasowania instrukcji onboardingu i rozjazdu między launch timingiem a gotowością hardware.',
  },
  'partner-objection-handling': {
    title: 'Notatki o obsłudze obiekcji partnerów',
    category: 'commercial',
    body: 'Najczęstsze obiekcje dotyczą pewności odnowień, aktywacji edukatorów i pytania czy Digital Twin jest dodatkiem premium czy rdzeniem propozycji wartości.',
  },
  'academy-retro-notes': {
    title: 'Retrospektywa akademii supervisorów',
    category: 'ludzie',
    body: 'Supervisorzy najlepiej reagują na rutyny powiązane z żywymi inicjatywami, realnymi eskalacjami i widocznymi scorecardami zamiast ogólnego materiału szkoleniowego.',
  },
  'supplier-risk-scenarios': {
    title: 'Scenariusze ryzyka dostawców',
    category: 'łańcuch-dostaw',
    body: 'Najwyższe ryzyko dotyczy braków sensorów ruchu, zakłóceń frachtu i opóźnień zmian projektowych dających fałszywe poczucie bezpieczeństwa w delivery promises.',
  },
  'product-roadmap-options': {
    title: 'Memo opcji dla product roadmapy',
    category: 'produkt',
    body: 'Opcje roadmapy porównują poprawę adopcji, głębię analityki i upgrade bundla z jawnymi trade-offami wysiłku i przychodu.',
  },
  'line3-pilot-retro': {
    title: 'Retrospektywa pilota Linii 3',
    category: 'operacje',
    body: 'Pilot potwierdził apetyt supervisorów na szybsze alerty, ale zaufanie zależy od ograniczenia hałaśliwych rekomendacji podczas handoverów zmianowych.',
  },
};

export const atelierToysPromptPL: Record<string, { name: string; context: string; template: string }> = {
  'ceo-brief': {
    name: 'Board Brief CEO',
    context: 'Streszczenie executive',
    template: 'Podsumuj Atelier Forward dla Antoine Laurent: postęp, ryzyka, ROI i to, co zarząd powinien zdecydować jako następne.',
  },
  'cfo-margin-risks': {
    name: 'Przegląd ryzyk marży CFO',
    context: 'Finanse',
    template: 'Działaj jako Claire Laurent i oceń źródła wycieku marży, zmienność dostawców oraz trade-offy alokacji kapitału.',
  },
  'cto-scale-plan': {
    name: 'Plan skalowania CTO',
    context: 'Technologia i produkt',
    template: 'Działaj jako Julien Moreau i przygotuj plan skalowania Digital Twin oraz Atelier Digital wraz z zależnościami i guardrailami.',
  },
  'plant-manager-bottlenecks': {
    name: 'Przegląd bottlenecków zakładu',
    context: 'Operacje',
    template: 'Działaj jako Marc Dubois i opisz trzy największe bottlenecki przepustowości, aktualne countermeasures i miejsca, gdzie potrzebne jest wsparcie leadershipu.',
  },
  'qa-close-loop': {
    name: 'Brief QA Close-the-Loop',
    context: 'Jakość',
    template: 'Działaj jako Sophie Bernard i podsumuj nawroty defektów, skuteczność działań korygujących i ryzyka jakościowe dla executive teamu.',
  },
  'partner-growth-coach': {
    name: 'Coach wzrostu partnerskiego',
    context: 'Commercial',
    template: 'Działaj jako Thomas Viau i coachuj zespół jak zwiększyć aktywację partnerów, attach rate i jakość obsługi obiekcji dla bundli Atelier Digital.',
  },
  'board-pre-read-copilot': {
    name: 'Copilot board pre-read',
    context: 'Governance',
    template: 'Przygotuj zwięzły board pre-read dla Antoine i Jean-Claude: sygnał wartości, sygnał ryzyka, otwarte decyzje i poziom pewności follow-upów.',
  },
  'supply-risk-simulator': {
    name: 'Symulator ryzyk dostaw',
    context: 'Łańcuch dostaw',
    template: 'Działaj jako Isabelle Leroy i zasymuluj co stanie się z delivery promises, marżą i wiarygodnością partnerów, jeśli lead time kluczowego komponentu wydłuży się o 21 dni.',
  },
  'academy-retro-coach': {
    name: 'Coach retro akademii',
    context: 'Ludzie',
    template: 'Działaj jako Claire Laurent i wyciągnij, co akademia zmienia w zachowaniach managerów, co nadal jest słabe i jaki kolejny ruch powinien nastąpić.',
  },
};

export const atelierToysToolCoveragePL: Record<string, any> = {
  'Executive overview': {
    tool: 'Executive overview',
    seededRecords: ['Board QBR', 'Projekt Forward PMO', 'Inicjatywy z ROI'],
    userGoal: 'Zobaczyć całą firmę na jednym ekranie.',
    ahaMoment: 'Strategia, operacje i finanse są połączone dowodami, a nie slajdami.',
    cta: 'Uruchom trial i odwzoruj ten board view na własnej organizacji.',
  },
  'Portfolio & PMO': {
    tool: 'Portfolio i PMO',
    seededRecords: ['7 projektów', '15 inicjatyw cross-funkcyjnych', 'Milestones, zależności i bramki decyzyjne'],
    userGoal: 'Zrozumieć dlaczego priorytet strategiczny się opóźnia i kto ma go odblokować.',
    ahaMoment: 'Zależności, decyzje i delivery są rozwiązywane w jednym workflow.',
    cta: 'Umów warsztat, aby odwzorować Twoje live portfolio w takim samym control towerze.',
  },
  'DRD assessment': {
    tool: 'Ocena DRD',
    seededRecords: ['Zatwierdzony baseline DRD', 'Executive assessment report', 'Sekcje rekomendacji priorytetów'],
    userGoal: 'Zrozumieć dojrzałość, największe luki i to, co warto sfinansować jako następne.',
    ahaMoment: 'Assessment nie jest statyczną ankietą, bo przechodzi bezpośrednio do inicjatyw, governance i value tracking.',
    cta: 'Uruchom ten sam baseline DRD dla swojego zespołu i zamień wyniki w żywe portfolio.',
  },
  'Factory operations': {
    tool: 'Operacje zakładu',
    seededRecords: ['Inicjatywa Line 3 Digital Twin', 'Raport operacyjny', 'Taski maintenance'],
    userGoal: 'Zrozumieć straty operacyjne i kolejny ruch o najwyższej dźwigni.',
    ahaMoment: 'Dane zakładowe stają się systemem decyzji biznesowych, a nie osobnym dashboardem.',
    cta: 'Uruchom guided assessment dla zakładu lub zespołu operacyjnego.',
  },
  'AI workspace': {
    tool: 'AI workspace',
    seededRecords: ['9 promptów dla ról', '10+ knowledge docs', 'Persony leadershipu i specjalistów'],
    userGoal: 'Zapytać system o odpowiedź dopasowaną do roli i osadzoną w kontekście firmy.',
    ahaMoment: 'AI odpowiada na bazie historii firmy i danych wykonawczych, a nie w próżni.',
    cta: 'Uruchom trial i wgraj własny kontekst, aby zbudować prywatny workspace.',
  },
  'Quality cockpit': {
    tool: 'Cockpit jakości',
    seededRecords: ['Inicjatywa QA defect', 'Miesięczny raport jakości', 'Dokumenty o wzorcach defektów'],
    userGoal: 'Zobaczyć gdzie ryzyko jakości wraca i które działania korygujące faktycznie się domykają.',
    ahaMoment: 'Jakość staje się częścią głównego systemu operacyjnego, a nie osobnym bocznym procesem.',
    cta: 'W trialu połącz własne incydenty, inicjatywy i review leadershipu.',
  },
  'Partner growth': {
    tool: 'Wzrost partnerski',
    seededRecords: ['Inicjatywa onboardingu partnerów', 'Raport kohorty partnerów', 'Commercial playbooki'],
    userGoal: 'Zrozumieć jak onboarding i enablement przekładają się na realny wzrost kanału.',
    ahaMoment: 'System łączy zachowania onboardingowe z wynikami ekspansji i referencjami.',
    cta: 'Poproś o custom demo skoncentrowane na Twoim motion partnerskim lub kanałowym.',
  },
  'Board governance': {
    tool: 'Governance zarządczy',
    seededRecords: ['Inicjatywa board value tracking', 'Raport pre-read', 'Artefakty follow-upów decyzji'],
    userGoal: 'Przygotowywać rozmowy zarządcze i boardowe na podstawie aktualnych sygnałów operacyjnych.',
    ahaMoment: 'Przygotowanie boardu staje się ciągłym workflow zamiast miesięcznej gorączki.',
    cta: 'Uruchom trial, aby zbudować własny board-ready control tower.',
  },
};

export const atelierToysScenarioPL: Record<string, { title: string; audience: string; persona: string }> = {
  'executive-overview': {
    title: 'Executive Overview',
    audience: 'CEO, CFO, rada',
    persona: 'Antoine Laurent (CEO)',
  },
  'factory-operations': {
    title: 'Operacje Zakładu',
    audience: 'Liderzy zakładu, operational excellence',
    persona: 'Marc Dubois (Plant Manager)',
  },
  'digital-growth': {
    title: 'Wzrost Produktu Cyfrowego',
    audience: 'Sprzedaż, marketing, produkt',
    persona: 'Camille Dubois (Marketing Director)',
  },
  'drd-baseline': {
    title: 'Baseline DRD',
    audience: 'Liderzy transformacji, doradcy, executive operations',
    persona: 'Antoine Laurent (CEO)',
  },
  'quality-cockpit': {
    title: 'Cockpit Jakości',
    audience: 'Jakość, operacje, engineering',
    persona: 'Sophie Bernard (QA Director)',
  },
  'partner-expansion': {
    title: 'Rozwój Partnerów',
    audience: 'Sprzedaż, kanał, customer success',
    persona: 'Thomas Viau (VP Sales)',
  },
  'board-governance': {
    title: 'Board Governance',
    audience: 'CEO, PMO, biuro zarządu',
    persona: 'Hugo Bernard (Transformation Analyst)',
  },
};
