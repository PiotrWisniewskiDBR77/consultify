/**
 * FAQ Content
 *
 * Frequently asked questions organized by module.
 * Used by HelpSidePanel in the "FAQ" tab.
 */
export const FAQ_CONTENT = [
    // ==========================================
    // DASHBOARD FAQ
    // ==========================================
    {
        id: 'dashboard-1',
        question: 'How is my transformation maturity score calculated?',
        questionPl: 'Jak obliczany jest mój wskaźnik dojrzałości transformacji?',
        answer: 'Your maturity score is calculated as a weighted average across all completed assessments. Each assessment framework contributes to the overall score based on its coverage areas. The score updates automatically when assessments are completed or updated.',
        answerPl: 'Twój wskaźnik dojrzałości jest obliczany jako średnia ważona ze wszystkich ukończonych ocen. Każda rama oceny wnosi wkład do ogólnego wyniku na podstawie swoich obszarów pokrycia. Wynik aktualizuje się automatycznie po ukończeniu lub aktualizacji ocen.',
        moduleId: 'dashboard',
        tags: ['maturity', 'score', 'calculation']
    },
    {
        id: 'dashboard-2',
        question: 'Can I customize the dashboard widgets?',
        questionPl: 'Czy mogę dostosować widżety na dashboardzie?',
        answer: 'Yes, dashboard customization is available for Pro and Enterprise plans. You can drag and drop widgets, resize them, and choose which metrics to display. Click the customize button in the top right corner to enter edit mode.',
        answerPl: 'Tak, dostosowywanie dashboardu jest dostępne dla planów Pro i Enterprise. Możesz przeciągać i upuszczać widżety, zmieniać ich rozmiar i wybierać, które metryki wyświetlać. Kliknij przycisk dostosowywania w prawym górnym rogu, aby wejść w tryb edycji.',
        moduleId: 'dashboard',
        tags: ['customize', 'widgets', 'dashboard']
    },
    {
        id: 'dashboard-3',
        question: 'How often is dashboard data refreshed?',
        questionPl: 'Jak często odświeżane są dane na dashboardzie?',
        answer: 'Dashboard data is refreshed in real-time. When you or a team member completes an action, the dashboard updates within seconds. For aggregate metrics, recalculation happens within 5 minutes.',
        answerPl: 'Dane na dashboardzie są odświeżane w czasie rzeczywistym. Gdy Ty lub członek zespołu ukończysz akcję, dashboard aktualizuje się w ciągu sekund. Dla metryk zagregowanych przeliczenie następuje w ciągu 5 minut.',
        moduleId: 'dashboard',
        tags: ['refresh', 'real-time', 'data']
    },
    {
        id: 'dashboard-4',
        question: 'What does the snapshot view show?',
        questionPl: 'Co pokazuje widok snapshot?',
        answer: 'The snapshot view provides an executive-friendly summary of your transformation status. It\'s designed for quick review and can be exported as a PDF for board presentations or stakeholder updates.',
        answerPl: 'Widok snapshot zapewnia przyjazne dla kadry zarządzającej podsumowanie statusu Twojej transformacji. Jest zaprojektowany do szybkiego przeglądu i może być eksportowany jako PDF do prezentacji zarządowych lub aktualizacji dla interesariuszy.',
        moduleId: 'dashboard',
        tags: ['snapshot', 'executive', 'export']
    },
    {
        id: 'dashboard-5',
        question: 'Why are some metrics showing as N/A?',
        questionPl: 'Dlaczego niektóre metryki pokazują N/A?',
        answer: 'Metrics show N/A when there\'s insufficient data to calculate them. Complete at least one assessment and create some initiatives to populate all dashboard metrics. Organization context also needs to be configured for AI-powered insights.',
        answerPl: 'Metryki pokazują N/A, gdy brak jest wystarczających danych do ich obliczenia. Ukończ co najmniej jedną ocenę i stwórz kilka inicjatyw, aby wypełnić wszystkie metryki dashboardu. Kontekst organizacji również musi być skonfigurowany dla wniosków napędzanych AI.',
        moduleId: 'dashboard',
        tags: ['metrics', 'N/A', 'data']
    },
    // ==========================================
    // ASSESSMENT FAQ
    // ==========================================
    {
        id: 'assessment-1',
        question: 'Which assessment framework should I start with?',
        questionPl: 'Od której ramy oceny powinienem zacząć?',
        answer: 'For most organizations, we recommend starting with the DRD (Digital Readiness Diagnostic) as it provides broad coverage across 7 dimensions. If you have specific needs, SIRI is best for manufacturing, CMMI-DMM for data-focused initiatives, and Lean 4.0 for process optimization.',
        answerPl: 'Dla większości organizacji zalecamy zacząć od DRD (Digital Readiness Diagnostic), ponieważ zapewnia szerokie pokrycie w 7 wymiarach. Jeśli masz specyficzne potrzeby, SIRI jest najlepszy dla produkcji, CMMI-DMM dla inicjatyw zorientowanych na dane, a Lean 4.0 dla optymalizacji procesów.',
        moduleId: 'assessment',
        tags: ['framework', 'DRD', 'SIRI', 'CMMI', 'Lean']
    },
    {
        id: 'assessment-2',
        question: 'How long does a typical assessment take?',
        questionPl: 'Ile czasu trwa typowa ocena?',
        answer: 'A complete DRD assessment typically takes 2-4 hours spread over multiple sessions. You can save progress at any time and return later. AI assistance can significantly speed up the process by pre-filling answers based on uploaded documents.',
        answerPl: 'Kompletna ocena DRD zazwyczaj trwa 2-4 godziny rozłożone na wiele sesji. Możesz zapisać postęp w dowolnym momencie i wrócić później. Wsparcie AI może znacząco przyspieszyć proces, wstępnie wypełniając odpowiedzi na podstawie przesłanych dokumentów.',
        moduleId: 'assessment',
        tags: ['time', 'duration', 'assessment']
    },
    {
        id: 'assessment-3',
        question: 'Can I edit assessment answers after submission?',
        questionPl: 'Czy mogę edytować odpowiedzi w ocenie po przesłaniu?',
        answer: 'Yes, assessments can be edited until they\'re marked as finalized. Once finalized, a new version is created for any changes. This maintains an audit trail of your assessment history for compliance purposes.',
        answerPl: 'Tak, oceny mogą być edytowane do momentu oznaczenia jako sfinalizowane. Po sfinalizowaniu, dla wszelkich zmian tworzona jest nowa wersja. Utrzymuje to ścieżkę audytu historii Twoich ocen dla celów zgodności.',
        moduleId: 'assessment',
        tags: ['edit', 'finalize', 'audit']
    },
    {
        id: 'assessment-4',
        question: 'What types of evidence should I upload?',
        questionPl: 'Jakie rodzaje dowodów powinienem przesłać?',
        answer: 'Relevant evidence includes: strategy documents, process maps, system screenshots, organizational charts, policy documents, project reports, and metric dashboards. The AI analyzes these to suggest and validate assessment scores.',
        answerPl: 'Istotne dowody obejmują: dokumenty strategiczne, mapy procesów, zrzuty ekranu systemów, schematy organizacyjne, dokumenty polityk, raporty projektowe i dashboardy metryk. AI analizuje je, aby sugerować i walidować wyniki oceny.',
        moduleId: 'assessment',
        tags: ['evidence', 'documents', 'upload']
    },
    {
        id: 'assessment-5',
        question: 'How does the reviewer workflow function?',
        questionPl: 'Jak działa workflow recenzenta?',
        answer: 'When reviewer approval is enabled, completed assessments go to designated reviewers for quality check. Reviewers can approve, request changes, or add comments. This ensures assessment integrity and enables collaborative validation.',
        answerPl: 'Gdy zatwierdzanie przez recenzenta jest włączone, ukończone oceny trafiają do wyznaczonych recenzentów do kontroli jakości. Recenzenci mogą zatwierdzać, żądać zmian lub dodawać komentarze. Zapewnia to integralność oceny i umożliwia wspólną walidację.',
        moduleId: 'assessment',
        tags: ['reviewer', 'approval', 'workflow']
    },
    {
        id: 'assessment-6',
        question: 'What is the Gap Map and how do I use it?',
        questionPl: 'Czym jest Mapa Luk i jak jej używać?',
        answer: 'The Gap Map visualizes the difference between your current maturity level and your target state across all assessed dimensions. Red areas indicate significant gaps requiring attention, while green shows areas of strength. Use it to prioritize improvement initiatives.',
        answerPl: 'Mapa Luk wizualizuje różnicę między Twoim obecnym poziomem dojrzałości a stanem docelowym we wszystkich ocenianych wymiarach. Obszary czerwone wskazują znaczące luki wymagające uwagi, podczas gdy zielone pokazują obszary siły. Użyj jej do priorytetyzacji inicjatyw poprawy.',
        moduleId: 'assessment',
        tags: ['gap', 'visualization', 'priorities']
    },
    // ==========================================
    // INITIATIVES FAQ
    // ==========================================
    {
        id: 'initiatives-1',
        question: 'How does AI generate initiative suggestions?',
        questionPl: 'Jak AI generuje sugestie inicjatyw?',
        answer: 'AI analyzes your assessment gaps, organization context, industry benchmarks, and best practices to generate tailored initiative suggestions. Each suggestion includes rationale, expected impact, effort estimation, and implementation guidance.',
        answerPl: 'AI analizuje Twoje luki z oceny, kontekst organizacji, benchmarki branżowe i najlepsze praktyki, aby generować dopasowane sugestie inicjatyw. Każda sugestia zawiera uzasadnienie, oczekiwany wpływ, szacunek wysiłku i wskazówki implementacyjne.',
        moduleId: 'initiatives',
        tags: ['AI', 'generation', 'suggestions']
    },
    {
        id: 'initiatives-2',
        question: 'How should I prioritize competing initiatives?',
        questionPl: 'Jak powinienem priorytetyzować konkurujące inicjatywy?',
        answer: 'Use the impact vs. effort matrix to prioritize. Quick wins (high impact, low effort) should be tackled first. Major projects (high impact, high effort) go on the roadmap. Fill-ins (low impact, low effort) can be done opportunistically. Avoid thankless tasks (low impact, high effort).',
        answerPl: 'Użyj macierzy wpływ vs. wysiłek do priorytetyzacji. Szybkie zwycięstwa (wysoki wpływ, niski wysiłek) powinny być realizowane najpierw. Główne projekty (wysoki wpływ, wysoki wysiłek) trafiają na mapę drogową. Wypełniacze (niski wpływ, niski wysiłek) mogą być robione oportunistycznie. Unikaj niewdzięcznych zadań (niski wpływ, wysoki wysiłek).',
        moduleId: 'initiatives',
        tags: ['priority', 'matrix', 'effort']
    },
    {
        id: 'initiatives-3',
        question: 'Can I create initiatives manually without AI?',
        questionPl: 'Czy mogę tworzyć inicjatywy ręcznie bez AI?',
        answer: 'Absolutely. You can create initiatives manually using templates or from scratch. Manual initiatives can still be linked to assessment gaps and included in your roadmap. The AI is there to assist, not replace human judgment.',
        answerPl: 'Oczywiście. Możesz tworzyć inicjatywy ręcznie używając szablonów lub od zera. Ręczne inicjatywy wciąż mogą być powiązane z lukami z oceny i uwzględnione w mapie drogowej. AI jest po to, aby pomagać, a nie zastępować ludzki osąd.',
        moduleId: 'initiatives',
        tags: ['manual', 'create', 'templates']
    },
    {
        id: 'initiatives-4',
        question: 'How do initiative dependencies work?',
        questionPl: 'Jak działają zależności między inicjatywami?',
        answer: 'Dependencies link initiatives that must be completed in sequence. When you set Initiative B as dependent on Initiative A, the system will warn you if B is scheduled to start before A completes. The roadmap view visualizes these connections.',
        answerPl: 'Zależności łączą inicjatywy, które muszą być ukończone sekwencyjnie. Gdy ustawisz Inicjatywę B jako zależną od Inicjatywy A, system ostrzeże Cię, jeśli B jest zaplanowana do rozpoczęcia przed ukończeniem A. Widok mapy drogowej wizualizuje te połączenia.',
        moduleId: 'initiatives',
        tags: ['dependencies', 'sequence', 'roadmap']
    },
    {
        id: 'initiatives-5',
        question: 'What happens when I archive an initiative?',
        questionPl: 'Co się dzieje, gdy archiwizuję inicjatywę?',
        answer: 'Archived initiatives are hidden from active views but preserved for historical reference and reporting. They can be restored if needed. Associated tasks are also archived but can be individually reassigned.',
        answerPl: 'Zarchiwizowane inicjatywy są ukryte z aktywnych widoków, ale zachowane do historycznych odniesień i raportowania. Mogą być przywrócone w razie potrzeby. Powiązane zadania są również archiwizowane, ale mogą być indywidualnie przepisane.',
        moduleId: 'initiatives',
        tags: ['archive', 'restore', 'history']
    },
    // ==========================================
    // ROADMAP FAQ
    // ==========================================
    {
        id: 'roadmap-1',
        question: 'What\'s the difference between phases and milestones?',
        questionPl: 'Jaka jest różnica między fazami a kamieniami milowymi?',
        answer: 'Phases are time periods grouping related initiatives (e.g., "Foundation", "Acceleration"). Milestones are specific checkpoints marking significant achievements. Think of phases as containers and milestones as markers within them.',
        answerPl: 'Fazy to okresy czasowe grupujące powiązane inicjatywy (np. "Fundament", "Przyspieszenie"). Kamienie milowe to konkretne punkty kontrolne oznaczające znaczące osiągnięcia. Myśl o fazach jako kontenerach, a o kamieniach milowych jako znacznikach wewnątrz nich.',
        moduleId: 'roadmap',
        tags: ['phases', 'milestones', 'planning']
    },
    {
        id: 'roadmap-2',
        question: 'How do I handle resource conflicts in the roadmap?',
        questionPl: 'Jak radzić sobie z konfliktami zasobów w mapie drogowej?',
        answer: 'The roadmap shows resource utilization overlays. When capacity is exceeded, affected periods are highlighted red. You can either extend timelines, add resources, or reprioritize initiatives to resolve conflicts.',
        answerPl: 'Mapa drogowa pokazuje nakładki wykorzystania zasobów. Gdy pojemność jest przekroczona, dotknięte okresy są podświetlone na czerwono. Możesz rozszerzyć harmonogramy, dodać zasoby lub repriorytetyzować inicjatywy, aby rozwiązać konflikty.',
        moduleId: 'roadmap',
        tags: ['resources', 'capacity', 'conflicts']
    },
    {
        id: 'roadmap-3',
        question: 'Can stakeholders view the roadmap without editing rights?',
        questionPl: 'Czy interesariusze mogą przeglądać mapę drogową bez praw do edycji?',
        answer: 'Yes, you can share a read-only view of the roadmap with stakeholders. Export options include PDF, PowerPoint, and shareable links with optional password protection.',
        answerPl: 'Tak, możesz udostępnić widok tylko do odczytu mapy drogowej interesariuszom. Opcje eksportu obejmują PDF, PowerPoint i linki do udostępniania z opcjonalną ochroną hasłem.',
        moduleId: 'roadmap',
        tags: ['share', 'stakeholders', 'export']
    },
    {
        id: 'roadmap-4',
        question: 'How far ahead should I plan my roadmap?',
        questionPl: 'Jak daleko naprzód powinienem planować mapę drogową?',
        answer: 'We recommend a 12-18 month planning horizon. Near-term (0-3 months) should be detailed, mid-term (3-9 months) somewhat flexible, and long-term (9-18 months) directional. Review and adjust monthly.',
        answerPl: 'Zalecamy horyzont planowania 12-18 miesięcy. Krótkoterminowy (0-3 miesiące) powinien być szczegółowy, średnioterminowy (3-9 miesięcy) nieco elastyczny, a długoterminowy (9-18 miesięcy) kierunkowy. Przeglądaj i dostosowuj co miesiąc.',
        moduleId: 'roadmap',
        tags: ['horizon', 'planning', 'timeline']
    },
    {
        id: 'roadmap-5',
        question: 'What happens when initiatives slip their dates?',
        questionPl: 'Co się dzieje, gdy inicjatywy przesuwają swoje daty?',
        answer: 'When an initiative slips, dependent initiatives are automatically flagged for review. You can choose to cascade the delay, compress subsequent activities, or accept the risk. The system tracks variance from original plan.',
        answerPl: 'Gdy inicjatywa się przesuwa, zależne inicjatywy są automatycznie oznaczane do przeglądu. Możesz wybrać kaskadowanie opóźnienia, kompresję kolejnych działań lub akceptację ryzyka. System śledzi odchylenia od pierwotnego planu.',
        moduleId: 'roadmap',
        tags: ['delays', 'variance', 'dependencies']
    },
    // ==========================================
    // IMPLEMENTATION FAQ
    // ==========================================
    {
        id: 'implementation-1',
        question: 'What are the benefits of running a pilot first?',
        questionPl: 'Jakie są korzyści z uruchomienia najpierw pilotażu?',
        answer: 'Pilots reduce risk by testing changes in a controlled environment before full rollout. They help identify issues early, build organizational support through demonstrated success, and provide data for ROI validation.',
        answerPl: 'Pilotaże zmniejszają ryzyko, testując zmiany w kontrolowanym środowisku przed pełnym wdrożeniem. Pomagają wcześnie zidentyfikować problemy, budować wsparcie organizacyjne poprzez pokazany sukces i dostarczają danych do walidacji ROI.',
        moduleId: 'implementation',
        tags: ['pilot', 'risk', 'validation']
    },
    {
        id: 'implementation-2',
        question: 'How does the stage-gate process work?',
        questionPl: 'Jak działa proces stage-gate?',
        answer: 'Stage-gate divides implementation into phases with formal review points. At each gate, stakeholders evaluate progress against criteria and make go/no-go decisions. This ensures disciplined execution and early issue detection.',
        answerPl: 'Stage-gate dzieli implementację na fazy z formalnymi punktami przeglądu. Na każdej bramce interesariusze oceniają postęp względem kryteriów i podejmują decyzje go/no-go. Zapewnia to zdyscyplinowaną realizację i wczesne wykrywanie problemów.',
        moduleId: 'implementation',
        tags: ['stage-gate', 'gates', 'decisions']
    },
    {
        id: 'implementation-3',
        question: 'What is ADKAR and how does it help?',
        questionPl: 'Czym jest ADKAR i jak pomaga?',
        answer: 'ADKAR is a change management model: Awareness, Desire, Knowledge, Ability, Reinforcement. The system helps track these dimensions for each affected stakeholder group, ensuring successful adoption beyond just technical implementation.',
        answerPl: 'ADKAR to model zarządzania zmianą: Świadomość, Pragnienie, Wiedza, Zdolność, Wzmocnienie. System pomaga śledzić te wymiary dla każdej dotkniętej grupy interesariuszy, zapewniając udaną adopcję poza samą techniczną implementacją.',
        moduleId: 'implementation',
        tags: ['ADKAR', 'change', 'adoption']
    },
    {
        id: 'implementation-4',
        question: 'How do I track change requests during implementation?',
        questionPl: 'Jak śledzić żądania zmian podczas implementacji?',
        answer: 'All change requests are logged in the change request register. Each request captures the proposed change, business justification, impact assessment, and approval status. Changes are linked to their originating initiative for traceability.',
        answerPl: 'Wszystkie żądania zmian są rejestrowane w rejestrze żądań zmian. Każde żądanie zawiera proponowaną zmianę, uzasadnienie biznesowe, ocenę wpływu i status zatwierdzenia. Zmiany są powiązane z inicjatywą źródłową dla śledzenia.',
        moduleId: 'implementation',
        tags: ['change', 'requests', 'tracking']
    },
    {
        id: 'implementation-5',
        question: 'When should I escalate risks and issues?',
        questionPl: 'Kiedy powinienem eskalować ryzyka i problemy?',
        answer: 'Escalate when: risk probability or impact increases beyond tolerance, issues cannot be resolved at team level, timeline is threatened, or budget overrun is likely. The system provides templates for escalation communication.',
        answerPl: 'Eskaluj gdy: prawdopodobieństwo lub wpływ ryzyka wzrasta ponad tolerancję, problemy nie mogą być rozwiązane na poziomie zespołu, harmonogram jest zagrożony lub prawdopodobne jest przekroczenie budżetu. System dostarcza szablony do komunikacji eskalacji.',
        moduleId: 'implementation',
        tags: ['escalation', 'risks', 'issues']
    },
    // ==========================================
    // REPORTS FAQ
    // ==========================================
    {
        id: 'reports-1',
        question: 'How is ROI calculated for transformation initiatives?',
        questionPl: 'Jak obliczany jest ROI dla inicjatyw transformacyjnych?',
        answer: 'ROI is calculated based on defined benefits (cost savings, revenue increase, efficiency gains) vs. total investment (implementation cost, ongoing costs). The calculator supports NPV, payback period, and IRR methods.',
        answerPl: 'ROI jest obliczany na podstawie zdefiniowanych korzyści (oszczędności kosztów, wzrost przychodów, wzrost efektywności) vs. całkowita inwestycja (koszt implementacji, koszty bieżące). Kalkulator wspiera metody NPV, okresu zwrotu i IRR.',
        moduleId: 'reports',
        tags: ['ROI', 'calculation', 'benefits']
    },
    {
        id: 'reports-2',
        question: 'Can I schedule automatic report generation?',
        questionPl: 'Czy mogę zaplanować automatyczne generowanie raportów?',
        answer: 'Yes, you can schedule reports to be generated and emailed on a recurring basis (daily, weekly, monthly). Configure recipients, format preferences, and content scope in the report scheduling wizard.',
        answerPl: 'Tak, możesz zaplanować generowanie raportów i wysyłanie ich emailem cyklicznie (dziennie, tygodniowo, miesięcznie). Skonfiguruj odbiorców, preferencje formatu i zakres treści w kreatorze planowania raportów.',
        moduleId: 'reports',
        tags: ['schedule', 'automatic', 'email']
    },
    {
        id: 'reports-3',
        question: 'What\'s included in the executive summary report?',
        questionPl: 'Co zawiera raport podsumowania dla kadry zarządzającej?',
        answer: 'The executive summary includes: current maturity score with trend, key achievements since last report, active initiatives status, upcoming milestones, risks requiring attention, and next period priorities. All in a single-page format.',
        answerPl: 'Podsumowanie dla kadry zarządzającej zawiera: aktualny wskaźnik dojrzałości z trendem, kluczowe osiągnięcia od ostatniego raportu, status aktywnych inicjatyw, nadchodzące kamienie milowe, ryzyka wymagające uwagi i priorytety na następny okres. Wszystko w formacie jednej strony.',
        moduleId: 'reports',
        tags: ['executive', 'summary', 'format']
    },
    {
        id: 'reports-4',
        question: 'How do I compare assessments over time?',
        questionPl: 'Jak porównać oceny w czasie?',
        answer: 'Use the assessment comparison report to visualize changes between any two assessment versions. The report highlights improved, declined, and unchanged dimensions with delta values and trend indicators.',
        answerPl: 'Użyj raportu porównania ocen, aby wizualizować zmiany między dowolnymi dwoma wersjami oceny. Raport podświetla ulepszone, pogorszone i niezmienione wymiary z wartościami delta i wskaźnikami trendów.',
        moduleId: 'reports',
        tags: ['comparison', 'trends', 'assessments']
    },
    {
        id: 'reports-5',
        question: 'Are reports suitable for external auditors?',
        questionPl: 'Czy raporty są odpowiednie dla zewnętrznych audytorów?',
        answer: 'Yes, audit-ready reports include full evidence trails, timestamped activities, user attributions, and methodology documentation. They meet requirements for ISO audits, internal compliance reviews, and regulatory inspections.',
        answerPl: 'Tak, raporty gotowe do audytu zawierają pełne ścieżki dowodowe, aktywności z znacznikiem czasu, przypisania użytkowników i dokumentację metodologii. Spełniają wymagania audytów ISO, wewnętrznych przeglądów zgodności i inspekcji regulacyjnych.',
        moduleId: 'reports',
        tags: ['audit', 'compliance', 'evidence']
    },
    // ==========================================
    // MY WORK FAQ
    // ==========================================
    {
        id: 'mywork-1',
        question: 'What\'s the difference between My Work and the Dashboard?',
        questionPl: 'Jaka jest różnica między Moją Pracą a Dashboardem?',
        answer: 'Dashboard shows organization-wide metrics and status, while My Work focuses on your personal tasks and notifications. My Work is your action center for daily productivity.',
        answerPl: 'Dashboard pokazuje metryki i status w całej organizacji, podczas gdy Moja Praca koncentruje się na Twoich osobistych zadaniach i powiadomieniach. Moja Praca to Twoje centrum akcji dla codziennej produktywności.',
        moduleId: 'mywork',
        tags: ['dashboard', 'tasks', 'difference']
    },
    {
        id: 'mywork-2',
        question: 'How does Focus Mode work?',
        questionPl: 'Jak działa Tryb Skupienia?',
        answer: 'Focus Mode minimizes distractions by hiding navigation, muting notifications, and presenting a simplified interface. It\'s ideal for deep work like completing assessments or writing initiative plans. Exit anytime with the ESC key.',
        answerPl: 'Tryb Skupienia minimalizuje rozpraszacze, ukrywając nawigację, wyciszając powiadomienia i prezentując uproszczony interfejs. Jest idealny do głębokiej pracy jak wypełnianie ocen lub pisanie planów inicjatyw. Wyjdź w dowolnym momencie klawiszem ESC.',
        moduleId: 'mywork',
        tags: ['focus', 'productivity', 'distractions']
    },
    {
        id: 'mywork-3',
        question: 'How are tasks prioritized (P1-P4)?',
        questionPl: 'Jak są priorytetyzowane zadania (P1-P4)?',
        answer: 'P1 (Critical): Urgent, high impact - do immediately. P2 (High): Important but not urgent - plan this week. P3 (Medium): Normal priority - schedule appropriately. P4 (Low): Nice to have - do when time permits.',
        answerPl: 'P1 (Krytyczny): Pilny, wysoki wpływ - zrób natychmiast. P2 (Wysoki): Ważny ale nie pilny - zaplanuj na ten tydzień. P3 (Średni): Normalny priorytet - zaplanuj odpowiednio. P4 (Niski): Miło mieć - zrób, gdy czas pozwoli.',
        moduleId: 'mywork',
        tags: ['priority', 'P1', 'P2', 'P3', 'P4']
    },
    {
        id: 'mywork-4',
        question: 'Can I delegate tasks to others?',
        questionPl: 'Czy mogę delegować zadania innym?',
        answer: 'Yes, if you have appropriate permissions. Click on a task and use "Reassign" to transfer ownership. The original owner is notified and the task moves to the new assignee\'s My Work.',
        answerPl: 'Tak, jeśli masz odpowiednie uprawnienia. Kliknij na zadanie i użyj "Przepisz", aby przenieść właścicielstwo. Oryginalny właściciel jest powiadamiany, a zadanie przenosi się do Mojej Pracy nowego przypisanego.',
        moduleId: 'mywork',
        tags: ['delegate', 'reassign', 'permissions']
    },
    {
        id: 'mywork-5',
        question: 'What triggers inbox notifications?',
        questionPl: 'Co wyzwala powiadomienia w skrzynce odbiorczej?',
        answer: 'Inbox notifications are triggered by: task assignments, @mentions, review requests, approval workflows, deadline reminders, status changes on your items, and team updates you\'re subscribed to.',
        answerPl: 'Powiadomienia w skrzynce odbiorczej są wyzwalane przez: przypisania zadań, @wzmianki, żądania przeglądu, workflow zatwierdzeń, przypomnienia o terminach, zmiany statusu na Twoich elementach i aktualizacje zespołu, które subskrybujesz.',
        moduleId: 'mywork',
        tags: ['inbox', 'notifications', 'triggers']
    },
    // ==========================================
    // ORGANIZATION FAQ
    // ==========================================
    {
        id: 'organization-1',
        question: 'Why is organization context important for AI?',
        questionPl: 'Dlaczego kontekst organizacji jest ważny dla AI?',
        answer: 'Organization context enables AI to provide relevant, tailored recommendations. Without it, suggestions are generic. With detailed context, AI understands your industry, challenges, and strategic direction to offer specific guidance.',
        answerPl: 'Kontekst organizacji umożliwia AI dostarczanie trafnych, dopasowanych rekomendacji. Bez niego sugestie są generyczne. Ze szczegółowym kontekstem AI rozumie Twoją branżę, wyzwania i kierunek strategiczny, aby oferować konkretne wskazówki.',
        moduleId: 'organization',
        tags: ['AI', 'context', 'recommendations']
    },
    {
        id: 'organization-2',
        question: 'How often should I update organization context?',
        questionPl: 'Jak często powinienem aktualizować kontekst organizacji?',
        answer: 'Review and update context quarterly, or when significant changes occur (strategy shifts, market changes, new challenges, leadership changes). Major updates like company profile changes are less frequent.',
        answerPl: 'Przeglądaj i aktualizuj kontekst kwartalnie lub gdy występują znaczące zmiany (zmiany strategii, zmiany rynkowe, nowe wyzwania, zmiany przywództwa). Większe aktualizacje jak zmiany profilu firmy są rzadsze.',
        moduleId: 'organization',
        tags: ['update', 'frequency', 'changes']
    },
    {
        id: 'organization-3',
        question: 'Who can edit organization context?',
        questionPl: 'Kto może edytować kontekst organizacji?',
        answer: 'Only organization administrators can edit context information. This ensures strategic information remains accurate and controlled. Regular users can view context to understand organizational direction.',
        answerPl: 'Tylko administratorzy organizacji mogą edytować informacje kontekstowe. Zapewnia to, że informacje strategiczne pozostają dokładne i kontrolowane. Zwykli użytkownicy mogą przeglądać kontekst, aby rozumieć kierunek organizacyjny.',
        moduleId: 'organization',
        tags: ['permissions', 'edit', 'admin']
    },
    {
        id: 'organization-4',
        question: 'What megatrends should I track?',
        questionPl: 'Jakie megatrendy powinienem śledzić?',
        answer: 'Focus on megatrends impacting your industry: digitalization, sustainability, workforce changes, regulatory evolution, customer behavior shifts, technology disruptions (AI, IoT), and competitive dynamics.',
        answerPl: 'Skup się na megatrendach wpływających na Twoją branżę: cyfryzacja, zrównoważony rozwój, zmiany w sile roboczej, ewolucja regulacyjna, zmiany zachowań klientów, zakłócenia technologiczne (AI, IoT) i dynamika konkurencji.',
        moduleId: 'organization',
        tags: ['megatrends', 'strategy', 'industry']
    },
    {
        id: 'organization-5',
        question: 'Can I have multiple sites with different contexts?',
        questionPl: 'Czy mogę mieć wiele lokalizacji z różnymi kontekstami?',
        answer: 'Yes, multi-site organizations can define site-specific contexts while maintaining a unified organizational context. Each site can have unique challenges and assessments while sharing strategic goals.',
        answerPl: 'Tak, organizacje z wieloma lokalizacjami mogą definiować konteksty specyficzne dla lokalizacji, zachowując jednolity kontekst organizacyjny. Każda lokalizacja może mieć unikalne wyzwania i oceny, dzieląc cele strategiczne.',
        moduleId: 'organization',
        tags: ['multi-site', 'locations', 'context']
    },
    // ==========================================
    // SETTINGS FAQ
    // ==========================================
    {
        id: 'settings-1',
        question: 'How do I enable two-factor authentication?',
        questionPl: 'Jak włączyć uwierzytelnianie dwuskładnikowe?',
        answer: 'Go to Settings > Security and click "Enable 2FA". Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.) and enter the verification code. Save your backup codes securely.',
        answerPl: 'Przejdź do Ustawienia > Bezpieczeństwo i kliknij "Włącz 2FA". Zeskanuj kod QR aplikacją uwierzytelniającą (Google Authenticator, Authy, itp.) i wprowadź kod weryfikacyjny. Zapisz kody zapasowe w bezpiecznym miejscu.',
        moduleId: 'settings',
        tags: ['2FA', 'security', 'authentication']
    },
    {
        id: 'settings-2',
        question: 'Can I change my email address?',
        questionPl: 'Czy mogę zmienić swój adres email?',
        answer: 'Email changes require administrator approval in most organizations. Contact your admin to request an email change. Once approved, you\'ll receive verification emails at both old and new addresses.',
        answerPl: 'Zmiany emaila wymagają zatwierdzenia administratora w większości organizacji. Skontaktuj się z administratorem, aby poprosić o zmianę emaila. Po zatwierdzeniu otrzymasz emaile weryfikacyjne na stary i nowy adres.',
        moduleId: 'settings',
        tags: ['email', 'change', 'admin']
    },
    {
        id: 'settings-3',
        question: 'How do I connect Slack for notifications?',
        questionPl: 'Jak połączyć Slack dla powiadomień?',
        answer: 'Go to Settings > Integrations > Slack and click "Connect". Authorize the Consultify app in your Slack workspace. Then select which notification types should go to Slack and specify channels.',
        answerPl: 'Przejdź do Ustawienia > Integracje > Slack i kliknij "Połącz". Autoryzuj aplikację Consultify w swoim workspace Slack. Następnie wybierz, które typy powiadomień powinny iść do Slack i określ kanały.',
        moduleId: 'settings',
        tags: ['Slack', 'integration', 'notifications']
    },
    {
        id: 'settings-4',
        question: 'What AI behavior settings can I customize?',
        questionPl: 'Jakie ustawienia zachowania AI mogę dostosować?',
        answer: 'You can customize: response verbosity (concise/detailed), preferred language, AI persona style, citation preferences, automatic suggestion frequency, and which contexts the AI should consider.',
        answerPl: 'Możesz dostosować: szczegółowość odpowiedzi (zwięzła/szczegółowa), preferowany język, styl persony AI, preferencje cytowania, częstotliwość automatycznych sugestii i które konteksty AI powinien uwzględniać.',
        moduleId: 'settings',
        tags: ['AI', 'customization', 'preferences']
    },
    {
        id: 'settings-5',
        question: 'How do accessibility settings work?',
        questionPl: 'Jak działają ustawienia dostępności?',
        answer: 'Accessibility settings include: high contrast mode, reduced motion, screen reader optimization, font size adjustment, keyboard navigation enhancements, and focus indicators. They apply immediately upon saving.',
        answerPl: 'Ustawienia dostępności obejmują: tryb wysokiego kontrastu, zmniejszony ruch, optymalizację dla czytników ekranowych, dostosowanie rozmiaru czcionki, ulepszenia nawigacji klawiaturowej i wskaźniki focusu. Są stosowane natychmiast po zapisaniu.',
        moduleId: 'settings',
        tags: ['accessibility', 'contrast', 'motion']
    },
    // ==========================================
    // ADMIN FAQ
    // ==========================================
    {
        id: 'admin-1',
        question: 'How do I invite new users to my organization?',
        questionPl: 'Jak zaprosić nowych użytkowników do mojej organizacji?',
        answer: 'Go to Admin > Users > Invite. Enter email addresses (bulk paste supported), select roles, and optionally assign to projects. Users receive invitation emails with onboarding instructions.',
        answerPl: 'Przejdź do Admin > Użytkownicy > Zaproś. Wprowadź adresy email (obsługiwane wklejanie zbiorcze), wybierz role i opcjonalnie przypisz do projektów. Użytkownicy otrzymują emaile z zaproszeniem z instrukcjami wprowadzenia.',
        moduleId: 'admin',
        tags: ['invite', 'users', 'onboarding']
    },
    {
        id: 'admin-2',
        question: 'What are the different user roles?',
        questionPl: 'Jakie są różne role użytkowników?',
        answer: 'Available roles: Admin (full org control), Project Manager (project-level access), Team Member (contributor), Viewer (read-only), Consultant (external access). Each role has specific permissions documented in the admin guide.',
        answerPl: 'Dostępne role: Admin (pełna kontrola org), Project Manager (dostęp na poziomie projektu), Team Member (współtwórca), Viewer (tylko odczyt), Consultant (dostęp zewnętrzny). Każda rola ma specyficzne uprawnienia udokumentowane w przewodniku administratora.',
        moduleId: 'admin',
        tags: ['roles', 'permissions', 'users']
    },
    {
        id: 'admin-3',
        question: 'How do I set AI usage limits?',
        questionPl: 'Jak ustawić limity użycia AI?',
        answer: 'In Admin > AI Hub, you can set token limits per user, per project, or organization-wide. Configure soft limits (warnings) and hard limits (blocks). Monitor usage in the AI usage dashboard.',
        answerPl: 'W Admin > AI Hub możesz ustawić limity tokenów na użytkownika, projekt lub w całej organizacji. Skonfiguruj miękkie limity (ostrzeżenia) i twarde limity (blokady). Monitoruj użycie w dashboardzie użycia AI.',
        moduleId: 'admin',
        tags: ['AI', 'limits', 'tokens']
    },
    {
        id: 'admin-4',
        question: 'How do I upload documents to the knowledge base?',
        questionPl: 'Jak przesłać dokumenty do bazy wiedzy?',
        answer: 'Go to Admin > Knowledge Base > Upload. Drag and drop files or use the file picker. Supported formats: PDF, Word, Excel, PowerPoint, text files. Documents are processed and indexed for AI use.',
        answerPl: 'Przejdź do Admin > Baza Wiedzy > Prześlij. Przeciągnij i upuść pliki lub użyj wybieraka plików. Obsługiwane formaty: PDF, Word, Excel, PowerPoint, pliki tekstowe. Dokumenty są przetwarzane i indeksowane do użycia AI.',
        moduleId: 'admin',
        tags: ['knowledge', 'upload', 'documents']
    },
    {
        id: 'admin-5',
        question: 'How do I review user feedback?',
        questionPl: 'Jak przeglądać feedback użytkowników?',
        answer: 'Admin > Feedback shows all user-submitted feedback, AI quality ratings, and feature requests. Filter by type, date, or sentiment. Use this to identify pain points and improvement opportunities.',
        answerPl: 'Admin > Feedback pokazuje wszystkie przesłane przez użytkowników opinie, oceny jakości AI i prośby o funkcje. Filtruj według typu, daty lub sentymentu. Użyj tego do identyfikacji punktów bólu i możliwości poprawy.',
        moduleId: 'admin',
        tags: ['feedback', 'reviews', 'quality']
    },
    // ==========================================
    // SUPERADMIN FAQ
    // ==========================================
    {
        id: 'superadmin-1',
        question: 'How do I create a new organization?',
        questionPl: 'Jak utworzyć nową organizację?',
        answer: 'Super Admin > Organizations > Create New. Enter organization details, select subscription plan, configure limits, and create initial admin account. The organization is immediately available for use.',
        answerPl: 'Super Admin > Organizacje > Utwórz Nową. Wprowadź szczegóły organizacji, wybierz plan subskrypcji, skonfiguruj limity i utwórz początkowe konto administratora. Organizacja jest natychmiast dostępna do użycia.',
        moduleId: 'superadmin',
        tags: ['organization', 'create', 'setup']
    },
    {
        id: 'superadmin-2',
        question: 'What is user impersonation and when should I use it?',
        questionPl: 'Czym jest impersonacja użytkownika i kiedy jej używać?',
        answer: 'Impersonation lets you see the app as a specific user for debugging. Use it to troubleshoot issues, verify permissions, or assist users. All actions during impersonation are logged for audit purposes.',
        answerPl: 'Impersonacja pozwala zobaczyć aplikację jak konkretny użytkownik do debugowania. Użyj jej do rozwiązywania problemów, weryfikacji uprawnień lub pomocy użytkownikom. Wszystkie akcje podczas impersonacji są logowane do celów audytu.',
        moduleId: 'superadmin',
        tags: ['impersonation', 'debug', 'audit']
    },
    {
        id: 'superadmin-3',
        question: 'How do I configure SSO/SAML for an organization?',
        questionPl: 'Jak skonfigurować SSO/SAML dla organizacji?',
        answer: 'Go to Super Admin > SSO Config. Enter the identity provider metadata URL or upload the XML file. Map SAML attributes to Consultify user fields. Test the connection before enabling for users.',
        answerPl: 'Przejdź do Super Admin > Konfiguracja SSO. Wprowadź URL metadanych dostawcy tożsamości lub prześlij plik XML. Zmapuj atrybuty SAML na pola użytkownika Consultify. Przetestuj połączenie przed włączeniem dla użytkowników.',
        moduleId: 'superadmin',
        tags: ['SSO', 'SAML', 'configuration']
    },
    {
        id: 'superadmin-4',
        question: 'What does the White-label Studio configure?',
        questionPl: 'Co konfiguruje Studio White-label?',
        answer: 'White-label Studio customizes: logos (full, icon, favicon), colors (primary, secondary, accent), typography, login page design, custom domain, and email templates. Changes apply organization-wide.',
        answerPl: 'Studio White-label dostosowuje: logo (pełne, ikona, favicon), kolory (główny, dodatkowy, akcent), typografię, projekt strony logowania, własną domenę i szablony email. Zmiany obowiązują w całej organizacji.',
        moduleId: 'superadmin',
        tags: ['whitelabel', 'branding', 'customization']
    },
    {
        id: 'superadmin-5',
        question: 'How do I manage billing across organizations?',
        questionPl: 'Jak zarządzać rozliczeniami między organizacjami?',
        answer: 'Super Admin > Billing shows all organization subscriptions, invoices, and revenue metrics. You can adjust plans, apply discounts, generate invoices, and manage payment methods. Stripe integration handles payments.',
        answerPl: 'Super Admin > Rozliczenia pokazuje wszystkie subskrypcje organizacji, faktury i metryki przychodów. Możesz dostosowywać plany, stosować rabaty, generować faktury i zarządzać metodami płatności. Integracja Stripe obsługuje płatności.',
        moduleId: 'superadmin',
        tags: ['billing', 'subscriptions', 'invoices']
    },
    // ==========================================
    // AI TOOLS FAQ
    // ==========================================
    {
        id: 'ai-tools-1',
        question: 'How accurate are AI recommendations?',
        questionPl: 'Jak dokładne są rekomendacje AI?',
        answer: 'AI recommendations are based on assessment data, industry best practices, and your organizational context. Accuracy improves with better input data. Always review AI suggestions critically - they augment, not replace, human judgment.',
        answerPl: 'Rekomendacje AI są oparte na danych z oceny, najlepszych praktykach branżowych i kontekście Twojej organizacji. Dokładność poprawia się z lepszymi danymi wejściowymi. Zawsze krytycznie przeglądaj sugestie AI - wzmacniają, a nie zastępują, ludzki osąd.',
        moduleId: 'ai-tools',
        tags: ['accuracy', 'recommendations', 'AI']
    },
    {
        id: 'ai-tools-2',
        question: 'Can I provide feedback on AI suggestions?',
        questionPl: 'Czy mogę przekazać feedback na temat sugestii AI?',
        answer: 'Yes! Feedback helps improve AI quality. Rate suggestions (helpful/not helpful), add comments, and flag incorrect information. This feedback trains the system to provide better recommendations over time.',
        answerPl: 'Tak! Feedback pomaga poprawić jakość AI. Oceniaj sugestie (pomocne/niepomocne), dodawaj komentarze i oznaczaj niepoprawne informacje. Ten feedback trenuje system, aby dostarczać lepsze rekomendacje z czasem.',
        moduleId: 'ai-tools',
        tags: ['feedback', 'improvement', 'quality']
    },
    {
        id: 'ai-tools-3',
        question: 'What data does AI have access to?',
        questionPl: 'Do jakich danych ma dostęp AI?',
        answer: 'AI accesses: your organization context, completed assessments, uploaded knowledge base documents, and anonymized best practices from the platform. It does not access data from other organizations.',
        answerPl: 'AI ma dostęp do: kontekstu Twojej organizacji, ukończonych ocen, przesłanych dokumentów bazy wiedzy i zanonimizowanych najlepszych praktyk z platformy. Nie ma dostępu do danych innych organizacji.',
        moduleId: 'ai-tools',
        tags: ['data', 'access', 'privacy']
    },
    {
        id: 'ai-tools-4',
        question: 'What is the AI Action Advisor?',
        questionPl: 'Czym jest Doradca Akcji AI?',
        answer: 'The AI Action Advisor proactively suggests next steps based on your current transformation state. It identifies blockers, suggests optimizations, and recommends actions to accelerate progress.',
        answerPl: 'Doradca Akcji AI proaktywnie sugeruje kolejne kroki na podstawie aktualnego stanu Twojej transformacji. Identyfikuje blokady, sugeruje optymalizacje i rekomenduje akcje, aby przyspieszyć postęp.',
        moduleId: 'ai-tools',
        tags: ['advisor', 'proactive', 'suggestions']
    },
    {
        id: 'ai-tools-5',
        question: 'Can I use AI for what-if scenario analysis?',
        questionPl: 'Czy mogę użyć AI do analizy scenariuszy what-if?',
        answer: 'Yes, the AI can analyze hypothetical scenarios: "What if we delayed this initiative?", "What if we increased budget?". Results include impact projections and risk assessments for different scenarios.',
        answerPl: 'Tak, AI może analizować hipotetyczne scenariusze: "Co jeśli opóźnimy tę inicjatywę?", "Co jeśli zwiększymy budżet?". Wyniki obejmują projekcje wpływu i oceny ryzyka dla różnych scenariuszy.',
        moduleId: 'ai-tools',
        tags: ['scenarios', 'what-if', 'analysis']
    },
    // ==========================================
    // KNOWLEDGE FAQ
    // ==========================================
    {
        id: 'knowledge-1',
        question: 'What content is available in the Knowledge Base?',
        questionPl: 'Jaka treść jest dostępna w Bazie Wiedzy?',
        answer: 'The Knowledge Base includes: methodology guides (DRD, SIRI, etc.), assessment templates, initiative planning frameworks, change management resources, and best practice case studies from various industries.',
        answerPl: 'Baza Wiedzy zawiera: przewodniki metodologii (DRD, SIRI, itp.), szablony ocen, frameworki planowania inicjatyw, zasoby zarządzania zmianą i studia przypadków najlepszych praktyk z różnych branż.',
        moduleId: 'knowledge',
        tags: ['content', 'guides', 'templates']
    },
    {
        id: 'knowledge-2',
        question: 'Are the masterclass videos available in multiple languages?',
        questionPl: 'Czy filmy masterclass są dostępne w wielu językach?',
        answer: 'Currently, masterclass videos are primarily in English with Polish subtitles. Additional language support is being developed. Written materials are available in both English and Polish.',
        answerPl: 'Obecnie filmy masterclass są głównie w języku angielskim z polskimi napisami. Dodatkowe wsparcie językowe jest rozwijane. Materiały pisemne są dostępne zarówno w języku angielskim jak i polskim.',
        moduleId: 'knowledge',
        tags: ['languages', 'masterclass', 'subtitles']
    },
    {
        id: 'knowledge-3',
        question: 'Can I download templates for offline use?',
        questionPl: 'Czy mogę pobrać szablony do użytku offline?',
        answer: 'Yes, templates are downloadable in various formats (Excel, Word, PDF) depending on template type. Downloaded templates can be customized for your organization\'s specific needs.',
        answerPl: 'Tak, szablony są do pobrania w różnych formatach (Excel, Word, PDF) w zależności od typu szablonu. Pobrane szablony mogą być dostosowane do specyficznych potrzeb Twojej organizacji.',
        moduleId: 'knowledge',
        tags: ['download', 'templates', 'offline']
    },
    {
        id: 'knowledge-4',
        question: 'How do I suggest new knowledge base content?',
        questionPl: 'Jak zasugerować nową treść do bazy wiedzy?',
        answer: 'Use the feedback button on any knowledge base page to suggest new content, report issues, or request additional topics. Suggestions are reviewed by the content team and prioritized based on demand.',
        answerPl: 'Użyj przycisku feedback na dowolnej stronie bazy wiedzy, aby zasugerować nową treść, zgłosić problemy lub poprosić o dodatkowe tematy. Sugestie są przeglądane przez zespół ds. treści i priorytetyzowane na podstawie popytu.',
        moduleId: 'knowledge',
        tags: ['suggest', 'feedback', 'content']
    },
    {
        id: 'knowledge-5',
        question: 'Is knowledge base content updated regularly?',
        questionPl: 'Czy treść bazy wiedzy jest regularnie aktualizowana?',
        answer: 'Yes, the knowledge base is continuously updated with new frameworks, best practices, and case studies. Major updates are announced in the platform notifications. Check the "New" badges for recent additions.',
        answerPl: 'Tak, baza wiedzy jest stale aktualizowana o nowe frameworki, najlepsze praktyki i studia przypadków. Główne aktualizacje są ogłaszane w powiadomieniach platformy. Sprawdź znaczniki "Nowe" dla ostatnich dodatków.',
        moduleId: 'knowledge',
        tags: ['updates', 'new', 'content']
    },
    // ==========================================
    // TROUBLESHOOTING FAQ
    // ==========================================
    {
        id: 'troubleshoot-1',
        question: 'Why is my assessment not saving?',
        questionPl: 'Dlaczego moja ocena się nie zapisuje?',
        answer: 'Assessment save issues can occur due to network connectivity problems, session timeout, or browser cache issues. Try refreshing the page, checking your internet connection, or clearing browser cache. Your work is auto-saved every 30 seconds.',
        answerPl: 'Problemy z zapisywaniem oceny mogą wystąpić z powodu problemów z połączeniem sieciowym, wygaśnięcia sesji lub problemów z cache przeglądarki. Spróbuj odświeżyć stronę, sprawdź połączenie internetowe lub wyczyść cache przeglądarki. Twoja praca jest automatycznie zapisywana co 30 sekund.',
        moduleId: 'assessment',
        tags: ['troubleshooting', 'save', 'error']
    },
    {
        id: 'troubleshoot-2',
        question: 'AI recommendations seem irrelevant - what can I do?',
        questionPl: 'Rekomendacje AI wydają się nieistotne - co mogę zrobić?',
        answer: 'AI quality depends on context completeness. Ensure your organization context is fully configured (check completeness score), upload relevant documents to the knowledge base, and provide accurate assessment scores. Feedback on recommendations also helps improve future suggestions.',
        answerPl: 'Jakość AI zależy od kompletności kontekstu. Upewnij się, że kontekst organizacji jest w pełni skonfigurowany (sprawdź wynik kompletności), prześlij odpowiednie dokumenty do bazy wiedzy i podaj dokładne wyniki oceny. Feedback na temat rekomendacji również pomaga poprawić przyszłe sugestie.',
        moduleId: 'ai-tools',
        tags: ['troubleshooting', 'AI', 'relevance']
    },
    {
        id: 'troubleshoot-3',
        question: 'My dashboard shows stale data - how do I refresh?',
        questionPl: 'Mój dashboard pokazuje nieaktualne dane - jak odświeżyć?',
        answer: 'Use the refresh button in the top-right corner of the dashboard, or press F5 to reload the page. If data still seems stale, check that assessments and initiatives have been properly saved. Dashboard caches data for performance - new data appears within 5 minutes.',
        answerPl: 'Użyj przycisku odświeżania w prawym górnym rogu dashboardu lub naciśnij F5, aby przeładować stronę. Jeśli dane nadal wydają się nieaktualne, sprawdź, czy oceny i inicjatywy zostały prawidłowo zapisane. Dashboard cachuje dane dla wydajności - nowe dane pojawiają się w ciągu 5 minut.',
        moduleId: 'dashboard',
        tags: ['troubleshooting', 'refresh', 'cache']
    },
    {
        id: 'troubleshoot-4',
        question: 'I cannot upload documents - file rejected?',
        questionPl: 'Nie mogę przesłać dokumentów - plik odrzucony?',
        answer: 'File uploads may fail due to: file size exceeding limit (max 50MB), unsupported format (use PDF, Word, Excel, PowerPoint, or text), file corruption, or insufficient storage quota. Check file properties and try again with a smaller or different format file.',
        answerPl: 'Przesyłanie plików może się nie powieść z powodu: rozmiaru pliku przekraczającego limit (max 50MB), nieobsługiwanego formatu (użyj PDF, Word, Excel, PowerPoint lub tekst), uszkodzenia pliku lub niewystarczającego limitu przechowywania. Sprawdź właściwości pliku i spróbuj ponownie z mniejszym lub innym formatem.',
        moduleId: 'admin',
        tags: ['troubleshooting', 'upload', 'files']
    },
    {
        id: 'troubleshoot-5',
        question: 'Reports are not generating - what should I check?',
        questionPl: 'Raporty się nie generują - co powinienem sprawdzić?',
        answer: 'Report generation requires sufficient data. Ensure you have completed assessments and active initiatives. Check that you have permission to generate reports. Large reports may take several minutes - check the report queue for status.',
        answerPl: 'Generowanie raportów wymaga wystarczających danych. Upewnij się, że masz ukończone oceny i aktywne inicjatywy. Sprawdź, czy masz uprawnienia do generowania raportów. Duże raporty mogą trwać kilka minut - sprawdź kolejkę raportów dla statusu.',
        moduleId: 'reports',
        tags: ['troubleshooting', 'reports', 'generation']
    },
    {
        id: 'troubleshoot-6',
        question: 'My notifications are not arriving - how to fix?',
        questionPl: 'Moje powiadomienia nie docierają - jak naprawić?',
        answer: 'Check your notification preferences in Settings > Notifications. Verify email notifications are enabled and your email address is correct. For browser notifications, ensure they are allowed in browser settings. Check spam/junk folders for email notifications.',
        answerPl: 'Sprawdź preferencje powiadomień w Ustawienia > Powiadomienia. Zweryfikuj, czy powiadomienia email są włączone i czy Twój adres email jest poprawny. Dla powiadomień przeglądarki upewnij się, że są dozwolone w ustawieniach przeglądarki. Sprawdź foldery spam/śmieci dla powiadomień email.',
        moduleId: 'settings',
        tags: ['troubleshooting', 'notifications', 'email']
    },
    // ==========================================
    // SECURITY & COMPLIANCE FAQ
    // ==========================================
    {
        id: 'security-1',
        question: 'Is my data encrypted?',
        questionPl: 'Czy moje dane są szyfrowane?',
        answer: 'Yes, all data is encrypted both in transit (TLS 1.3) and at rest (AES-256). Database backups are also encrypted. API keys and sensitive credentials use additional envelope encryption.',
        answerPl: 'Tak, wszystkie dane są szyfrowane zarówno podczas przesyłania (TLS 1.3), jak i w spoczynku (AES-256). Kopie zapasowe bazy danych są również szyfrowane. Klucze API i wrażliwe poświadczenia używają dodatkowego szyfrowania kopertowego.',
        moduleId: 'settings',
        tags: ['security', 'encryption', 'data']
    },
    {
        id: 'security-2',
        question: 'How long is my session valid?',
        questionPl: 'Jak długo ważna jest moja sesja?',
        answer: 'Default session timeout is 8 hours of inactivity for regular users. Organization admins can configure shorter timeouts. Active sessions extend automatically with usage. You can view and terminate active sessions in Settings > Security.',
        answerPl: 'Domyślny czas wygaśnięcia sesji to 8 godzin braku aktywności dla zwykłych użytkowników. Administratorzy organizacji mogą skonfigurować krótsze limity. Aktywne sesje przedłużają się automatycznie przy użyciu. Możesz przeglądać i kończyć aktywne sesje w Ustawienia > Bezpieczeństwo.',
        moduleId: 'settings',
        tags: ['security', 'session', 'timeout']
    },
    {
        id: 'security-3',
        question: 'What happens if I lose my 2FA device?',
        questionPl: 'Co się stanie, jeśli zgubię urządzenie 2FA?',
        answer: 'Use one of your backup codes to login. If you have no backup codes, contact your organization administrator who can temporarily disable 2FA for your account. Platform super admins can assist if your admin is unavailable.',
        answerPl: 'Użyj jednego z kodów zapasowych, aby się zalogować. Jeśli nie masz kodów zapasowych, skontaktuj się z administratorem organizacji, który może tymczasowo wyłączyć 2FA dla Twojego konta. Super administratorzy platformy mogą pomóc, jeśli Twój admin jest niedostępny.',
        moduleId: 'settings',
        tags: ['security', '2FA', 'recovery']
    },
    {
        id: 'security-4',
        question: 'How is my data backed up?',
        questionPl: 'Jak wykonywane są kopie zapasowe moich danych?',
        answer: 'Data is backed up continuously with point-in-time recovery capability. Daily full backups are retained for 30 days, weekly backups for 90 days. Backups are stored in geographically separate locations for disaster recovery.',
        answerPl: 'Kopie zapasowe danych wykonywane są ciągle z możliwością odzyskania do punktu w czasie. Codzienne pełne kopie są przechowywane przez 30 dni, tygodniowe przez 90 dni. Kopie są przechowywane w geograficznie oddzielnych lokalizacjach dla odzyskiwania po awarii.',
        moduleId: 'superadmin',
        tags: ['security', 'backup', 'recovery']
    },
    {
        id: 'security-5',
        question: 'Is Consultify GDPR compliant?',
        questionPl: 'Czy Consultify jest zgodny z GDPR?',
        answer: 'Yes, Consultify is fully GDPR compliant. We provide data processing agreements (DPA), support data subject access requests (DSAR), enable data portability, and maintain processing records. The Compliance Center helps track your organization\'s compliance.',
        answerPl: 'Tak, Consultify jest w pełni zgodny z GDPR. Zapewniamy umowy o przetwarzanie danych (DPA), wspieramy żądania dostępu podmiotów danych (DSAR), umożliwiamy przenoszenie danych i prowadzimy rejestry przetwarzania. Centrum Zgodności pomaga śledzić zgodność Twojej organizacji.',
        moduleId: 'superadmin',
        tags: ['security', 'GDPR', 'compliance']
    },
    // ==========================================
    // INTEGRATION FAQ
    // ==========================================
    {
        id: 'integration-1',
        question: 'Can I integrate with my existing project management tools?',
        questionPl: 'Czy mogę zintegrować z moimi istniejącymi narzędziami do zarządzania projektami?',
        answer: 'Yes, Consultify integrates with popular tools like Jira, Asana, ClickUp, and Trello. Initiatives and tasks can be synced bidirectionally. Configure integrations in Settings > Integrations.',
        answerPl: 'Tak, Consultify integruje się z popularnymi narzędziami jak Jira, Asana, ClickUp i Trello. Inicjatywy i zadania mogą być synchronizowane dwukierunkowo. Skonfiguruj integracje w Ustawienia > Integracje.',
        moduleId: 'settings',
        tags: ['integration', 'Jira', 'sync']
    },
    {
        id: 'integration-2',
        question: 'How do I set up SSO with my identity provider?',
        questionPl: 'Jak skonfigurować SSO z moim dostawcą tożsamości?',
        answer: 'SSO setup is done by platform administrators. We support Google Workspace and SAML 2.0 providers (Okta, Azure AD, etc.). Contact your platform admin or see Super Admin > SSO Configuration for setup instructions.',
        answerPl: 'Konfiguracja SSO jest wykonywana przez administratorów platformy. Wspieramy Google Workspace i dostawców SAML 2.0 (Okta, Azure AD, itp.). Skontaktuj się z administratorem platformy lub zobacz Super Admin > Konfiguracja SSO dla instrukcji konfiguracji.',
        moduleId: 'superadmin',
        tags: ['integration', 'SSO', 'SAML']
    },
    {
        id: 'integration-3',
        question: 'Can I access Consultify data via API?',
        questionPl: 'Czy mogę uzyskać dostęp do danych Consultify przez API?',
        answer: 'Yes, a REST API is available for Enterprise plans. API access enables programmatic data retrieval, reporting automation, and integration with custom systems. API keys are managed in Admin > API Management.',
        answerPl: 'Tak, REST API jest dostępne dla planów Enterprise. Dostęp do API umożliwia programowe pobieranie danych, automatyzację raportowania i integrację z niestandardowymi systemami. Klucze API są zarządzane w Admin > Zarządzanie API.',
        moduleId: 'admin',
        tags: ['integration', 'API', 'automation']
    },
    {
        id: 'integration-4',
        question: 'How do webhooks work in Consultify?',
        questionPl: 'Jak działają webhooki w Consultify?',
        answer: 'Webhooks send real-time notifications to your systems when events occur (assessment completed, initiative created, etc.). Configure webhook endpoints in Admin > Webhooks. Each webhook includes event type, payload, and signature for verification.',
        answerPl: 'Webhooki wysyłają powiadomienia w czasie rzeczywistym do Twoich systemów, gdy występują zdarzenia (ukończenie oceny, utworzenie inicjatywy, itp.). Skonfiguruj endpointy webhooków w Admin > Webhooki. Każdy webhook zawiera typ zdarzenia, payload i podpis do weryfikacji.',
        moduleId: 'admin',
        tags: ['integration', 'webhooks', 'events']
    },
    // ==========================================
    // BILLING & SUBSCRIPTION FAQ
    // ==========================================
    {
        id: 'billing-1',
        question: 'How does token-based billing work?',
        questionPl: 'Jak działa rozliczanie oparte na tokenach?',
        answer: 'AI features consume tokens. Your plan includes a monthly token allocation. Token usage is tracked per feature (assessments, recommendations, chat). Exceeding your allocation results in usage-based charges or feature restrictions depending on your plan.',
        answerPl: 'Funkcje AI zużywają tokeny. Twój plan zawiera miesięczną alokację tokenów. Użycie tokenów jest śledzone per funkcję (oceny, rekomendacje, czat). Przekroczenie alokacji skutkuje opłatami bazowanymi na użyciu lub ograniczeniami funkcji w zależności od planu.',
        moduleId: 'settings',
        tags: ['billing', 'tokens', 'usage']
    },
    {
        id: 'billing-2',
        question: 'Can I upgrade or downgrade my plan?',
        questionPl: 'Czy mogę ulepszyć lub obniżyć mój plan?',
        answer: 'Yes, plan changes can be made anytime. Upgrades take effect immediately with prorated charges. Downgrades take effect at the next billing cycle. Some features may become unavailable when downgrading.',
        answerPl: 'Tak, zmiany planu mogą być wykonane w dowolnym momencie. Ulepszenia wchodzą w życie natychmiast z proporcjonalnymi opłatami. Obniżenia wchodzą w życie w następnym cyklu rozliczeniowym. Niektóre funkcje mogą stać się niedostępne przy obniżaniu.',
        moduleId: 'settings',
        tags: ['billing', 'plan', 'upgrade']
    },
    {
        id: 'billing-3',
        question: 'What payment methods are accepted?',
        questionPl: 'Jakie metody płatności są akceptowane?',
        answer: 'We accept major credit cards (Visa, MasterCard, American Express), bank transfers for annual plans, and invoicing for Enterprise customers. Payment processing is handled securely through Stripe.',
        answerPl: 'Akceptujemy główne karty kredytowe (Visa, MasterCard, American Express), przelewy bankowe dla planów rocznych i fakturowanie dla klientów Enterprise. Przetwarzanie płatności jest obsługiwane bezpiecznie przez Stripe.',
        moduleId: 'settings',
        tags: ['billing', 'payment', 'methods']
    },
    {
        id: 'billing-4',
        question: 'How do I request an invoice or receipt?',
        questionPl: 'Jak zamówić fakturę lub paragon?',
        answer: 'Invoices are automatically generated and emailed after each payment. Access invoice history in Settings > Billing > Invoices. For custom invoice requirements (VAT, specific details), contact billing support.',
        answerPl: 'Faktury są automatycznie generowane i wysyłane emailem po każdej płatności. Dostęp do historii faktur w Ustawienia > Rozliczenia > Faktury. Dla niestandardowych wymagań fakturowych (VAT, szczegółowe dane), skontaktuj się z wsparciem rozliczeń.',
        moduleId: 'settings',
        tags: ['billing', 'invoice', 'receipt']
    },
    // ==========================================
    // COLLABORATION FAQ
    // ==========================================
    {
        id: 'collab-1',
        question: 'How many users can I add to my organization?',
        questionPl: 'Ilu użytkowników mogę dodać do mojej organizacji?',
        answer: 'User limits depend on your subscription plan. Starter plans include 5 users, Professional includes 25, and Enterprise has no limits. Check your current plan in Settings > Billing for exact limits.',
        answerPl: 'Limity użytkowników zależą od planu subskrypcji. Plany Starter obejmują 5 użytkowników, Professional 25, a Enterprise nie ma limitów. Sprawdź aktualny plan w Ustawienia > Rozliczenia dla dokładnych limitów.',
        moduleId: 'admin',
        tags: ['users', 'limits', 'plan']
    },
    {
        id: 'collab-2',
        question: 'Can external consultants access my assessments?',
        questionPl: 'Czy zewnętrzni konsultanci mogą mieć dostęp do moich ocen?',
        answer: 'Yes, you can invite external consultants with limited, time-bound access. They can review assessments and provide recommendations without full platform access. Consultant invitations are managed in Admin > Consultants.',
        answerPl: 'Tak, możesz zapraszać zewnętrznych konsultantów z ograniczonym, czasowo ograniczonym dostępem. Mogą przeglądać oceny i dostarczać rekomendacje bez pełnego dostępu do platformy. Zaproszenia konsultantów są zarządzane w Admin > Konsultanci.',
        moduleId: 'admin',
        tags: ['collaboration', 'consultants', 'access']
    },
    {
        id: 'collab-3',
        question: 'How do I share reports with stakeholders?',
        questionPl: 'Jak udostępnić raporty interesariuszom?',
        answer: 'Reports can be shared via: PDF/PPT export for email, secure shareable links with optional password, scheduled email delivery, or direct platform access for users with Viewer role.',
        answerPl: 'Raporty mogą być udostępniane przez: eksport PDF/PPT do emaila, bezpieczne linki do udostępniania z opcjonalnym hasłem, zaplanowaną dostawę emailową lub bezpośredni dostęp do platformy dla użytkowników z rolą Viewer.',
        moduleId: 'reports',
        tags: ['collaboration', 'sharing', 'reports']
    },
    {
        id: 'collab-4',
        question: 'Can I work on assessments with my team simultaneously?',
        questionPl: 'Czy mogę pracować nad ocenami z moim zespołem jednocześnie?',
        answer: 'Yes, assessments support collaborative editing. Team members can work on different dimensions simultaneously. Real-time presence indicators show who is editing what. Conflicts are automatically resolved with last-save-wins for the same field.',
        answerPl: 'Tak, oceny wspierają wspólne edytowanie. Członkowie zespołu mogą pracować nad różnymi wymiarami jednocześnie. Wskaźniki obecności w czasie rzeczywistym pokazują, kto co edytuje. Konflikty są automatycznie rozwiązywane zasadą ostatni-zapis-wygrywa dla tego samego pola.',
        moduleId: 'assessment',
        tags: ['collaboration', 'team', 'editing']
    },
    // ==========================================
    // ONBOARDING FAQ
    // ==========================================
    {
        id: 'onboard-1',
        question: 'How long does it take to get started?',
        questionPl: 'Ile czasu zajmuje rozpoczęcie pracy?',
        answer: 'Basic setup takes about 15 minutes: profile setup, organization context, and first assessment. Full onboarding with a complete assessment and initiative generation typically takes 4-8 hours spread over several sessions.',
        answerPl: 'Podstawowa konfiguracja zajmuje około 15 minut: konfiguracja profilu, kontekst organizacji i pierwsza ocena. Pełne wprowadzenie z kompletną oceną i generowaniem inicjatyw zwykle trwa 4-8 godzin rozłożonych na kilka sesji.',
        moduleId: 'onboarding',
        tags: ['onboarding', 'time', 'setup']
    },
    {
        id: 'onboard-2',
        question: 'Do you offer training or onboarding support?',
        questionPl: 'Czy oferujecie szkolenia lub wsparcie przy wdrożeniu?',
        answer: 'Yes! Self-service training is available via the Masterclass library. Professional and Enterprise plans include dedicated onboarding sessions. Custom training programs are available for Enterprise customers.',
        answerPl: 'Tak! Szkolenia samoobsługowe są dostępne przez bibliotekę Masterclass. Plany Professional i Enterprise obejmują dedykowane sesje wdrożeniowe. Niestandardowe programy szkoleniowe są dostępne dla klientów Enterprise.',
        moduleId: 'onboarding',
        tags: ['onboarding', 'training', 'support']
    },
    {
        id: 'onboard-3',
        question: 'Can I import existing assessment data?',
        questionPl: 'Czy mogę zaimportować istniejące dane oceny?',
        answer: 'Yes, data import is available for migrating from other tools. Supported formats include Excel templates and standard assessment formats. Contact support for custom import assistance.',
        answerPl: 'Tak, import danych jest dostępny do migracji z innych narzędzi. Obsługiwane formaty obejmują szablony Excel i standardowe formaty oceny. Skontaktuj się z wsparciem dla pomocy z niestandardowym importem.',
        moduleId: 'onboarding',
        tags: ['onboarding', 'import', 'data']
    },
    // ==========================================
    // CONSULTANT MODULE FAQ
    // ==========================================
    {
        id: 'consultant-1',
        question: 'What can consultants access?',
        questionPl: 'Do czego konsultanci mają dostęp?',
        answer: 'Consultant access is configurable per invitation. Typically they can view assessments, add recommendations, and access relevant documents. They cannot modify organization settings, invite users, or access billing.',
        answerPl: 'Dostęp konsultanta jest konfigurowalny per zaproszenie. Zazwyczaj mogą przeglądać oceny, dodawać rekomendacje i mieć dostęp do odpowiednich dokumentów. Nie mogą modyfikować ustawień organizacji, zapraszać użytkowników ani mieć dostępu do rozliczeń.',
        moduleId: 'consultant',
        tags: ['consultant', 'access', 'permissions']
    },
    {
        id: 'consultant-2',
        question: 'How long does consultant access last?',
        questionPl: 'Jak długo trwa dostęp konsultanta?',
        answer: 'Consultant access duration is set when creating the invitation. Typical durations are 30, 60, or 90 days. Access automatically expires and can be extended or revoked anytime by organization admins.',
        answerPl: 'Czas trwania dostępu konsultanta jest ustawiany przy tworzeniu zaproszenia. Typowe okresy to 30, 60 lub 90 dni. Dostęp automatycznie wygasa i może być przedłużony lub cofnięty w dowolnym momencie przez administratorów organizacji.',
        moduleId: 'consultant',
        tags: ['consultant', 'duration', 'expiry']
    },
    // ==========================================
    // WORK MODE FAQ
    // ==========================================
    {
        id: 'workmode-1',
        question: 'What is Work Mode and how should I configure it?',
        questionPl: 'Czym jest Tryb Pracy i jak go skonfigurować?',
        answer: 'Work Mode defines how your organization structures work: Simple (no divisions), Location-Based (sites/facilities), Project-Based (projects), or Full (both). Choose based on your organizational structure. Most manufacturing companies use Location-Based, while consulting firms use Project-Based.',
        answerPl: 'Tryb Pracy określa, jak Twoja organizacja strukturyzuje pracę: Prosty (bez podziałów), Oparty na Lokalizacjach (placówki), Oparty na Projektach (projekty) lub Pełny (oba). Wybierz na podstawie struktury organizacji. Większość firm produkcyjnych używa Opartego na Lokalizacjach, podczas gdy firmy konsultingowe używają Opartego na Projektach.',
        moduleId: 'admin',
        tags: ['work-mode', 'configuration', 'structure']
    },
    {
        id: 'workmode-2',
        question: 'How do PMO roles work in projects?',
        questionPl: 'Jak działają role PMO w projektach?',
        answer: 'PMO roles (Project Executive, Project Manager, Team Manager, etc.) define responsibilities aligned with PRINCE2/PMBOK standards. Each role has specific capabilities for approvals, resource management, and decision-making. Assign roles when adding users to projects.',
        answerPl: 'Role PMO (Project Executive, Project Manager, Team Manager, itp.) definiują odpowiedzialności zgodne ze standardami PRINCE2/PMBOK. Każda rola ma specyficzne uprawnienia do zatwierdzeń, zarządzania zasobami i podejmowania decyzji. Przypisz role przy dodawaniu użytkowników do projektów.',
        moduleId: 'admin',
        tags: ['PMO', 'roles', 'PRINCE2']
    },
    {
        id: 'workmode-3',
        question: 'Can users belong to multiple locations or projects?',
        questionPl: 'Czy użytkownicy mogą należeć do wielu lokalizacji lub projektów?',
        answer: 'Yes, users can be assigned to multiple locations and projects simultaneously. Their effective capabilities are the union of capabilities from all assignments. Task visibility is filtered to show only tasks relevant to their assignments.',
        answerPl: 'Tak, użytkownicy mogą być przypisani do wielu lokalizacji i projektów jednocześnie. Ich efektywne uprawnienia są sumą uprawnień ze wszystkich przypisań. Widoczność zadań jest filtrowana, aby pokazywać tylko zadania istotne dla ich przypisań.',
        moduleId: 'admin',
        tags: ['assignments', 'locations', 'projects']
    }
];
/**
 * Get FAQs for a specific module
 */
export function getFAQsForModule(moduleId) {
    return FAQ_CONTENT.filter(faq => faq.moduleId === moduleId);
}
/**
 * Search FAQs by query
 */
export function searchFAQs(query, language = 'en') {
    const lowerQuery = query.toLowerCase();
    return FAQ_CONTENT.filter(faq => {
        const question = language === 'pl' ? faq.questionPl : faq.question;
        const answer = language === 'pl' ? faq.answerPl : faq.answer;
        return (question.toLowerCase().includes(lowerQuery) ||
            answer.toLowerCase().includes(lowerQuery) ||
            faq.tags.some(tag => tag.toLowerCase().includes(lowerQuery)));
    });
}
/**
 * Get all unique tags from FAQs
 */
export function getAllFAQTags() {
    const tags = new Set();
    FAQ_CONTENT.forEach(faq => faq.tags.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
}
//# sourceMappingURL=faqContent.js.map