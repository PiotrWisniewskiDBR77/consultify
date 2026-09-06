# Wywiad

Zrzut listy: `evidence/p10-karty-n/interview/interview-loaded.png`; stanowisko zwróciło 0 sesji, więc brak zrzutu karty realnego rekordu.

| sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga |
|---|---|---|---|---|---|
| Podgląd | `interviewCardContract.ts:66-90` | `InterviewWorkspace.tsx:2444`; brak rekordu | sesja/odpowiedzi → `InterviewController` | brak | kosmetyka |
| Pytania | `interviewCardContract.ts:91-115` | jw. | questions/answers → `InterviewController` | brak | kosmetyka |
| Notatki | `interviewCardContract.ts:116-140` | jw. | notes → `interview.routes.ts:433-443` | brak | kosmetyka |
| Pliki i linki | `interviewCardContract.ts:141-168` | jw. | attachment API → writer rozproszony | brak | kosmetyka |
| Fakty | `interviewCardContract.ts:169-193` | jw. | company facts → `OrganizationContextService.ts:411` | brak | kosmetyka |
| Interesariusze | `interviewCardContract.ts:194-211` | jw. | session context → `InterviewController` | brak | kosmetyka |
| Luki | `interviewCardContract.ts:212-242` | jw. | wyliczane z brakujących odpowiedzi | brak | kosmetyka |
| Podsumowanie | `interviewCardContract.ts:243-270` | jw. | summary → `interview.routes.ts:481-485` | brak | kosmetyka |
