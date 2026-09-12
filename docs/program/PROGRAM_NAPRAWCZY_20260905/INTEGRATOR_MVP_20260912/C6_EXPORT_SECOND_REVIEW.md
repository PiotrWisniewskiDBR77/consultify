# Drugi przegląd eksportu C6 — root, 12.09.2026

Badany commit056841ea1ad61fa0fa1f75da3288740899912d99. Odczyt organizationLifecycleService.ts95–310, bez nowego runtime/PG. HOLD do reprodukcji i naprawy poniższych źródłowych ustaleń. Autor otrzymał pełną wiadomość.

1. FK-BFS używa SELECTchild WHERE FK IN(parentkeys) bez rewalidacji organization_id child. Userwspółdzielony A/B może być parentem danych obu organizacji. Wymagany rzeczywisty testshareduser i graph-expansion zA doB, legalneA zachowane; nie wystarczy rozłączny foreignfixture.
2. SECURITY_TABLE_PATTERN sessions? wycina nie tylko authsession, ale interview_sessions/assessment_sessions i inne merytoryczne sesje. Wymagane jawne securityclasses i zachowanie businesssession+children w pełnym eksporcie. Manifestsecurity nie usprawiedliwia wyłączenia materiałów biznesowych.
3. SECURITY_COLUMN_PATTERN ma granice początku/końca/underscore, więc camelCase JSON apiKey/accessToken/clientSecret może przejść. Wymagany test rzeczywistych struktur+canaries, bez usunięcia całego payloadu biznesowego.

To weryfikowalne source findings, nie deklaracja nowego RED realPG. C6 pozostaje aktywny; nie integrować eksportu jako accepted na podstawie dotychczasowego UI/20ktest.
