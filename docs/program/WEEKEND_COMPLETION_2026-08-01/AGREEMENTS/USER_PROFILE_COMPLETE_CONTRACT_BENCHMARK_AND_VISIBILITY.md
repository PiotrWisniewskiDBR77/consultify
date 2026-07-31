---
document_id: USER-PROFILE-COMPLETE-CONTRACT-BENCHMARK
module: Settings
function: User Profile
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
sources_reviewed: 2026-07-31
---

# Profil użytkownika — kompletny kontrakt, benchmark i widoczność

## 1. Cel profilu

Profil ma pozwolić aplikacji i współpracownikom poprawnie odpowiedzieć:

- kim jest użytkownik i jak się do niego zwracać;
- gdzie i w jakiej roli pracuje;
- za co odpowiada w organizacji i projektach;
- kiedy oraz jak można z nim współpracować;
- jakie ma kompetencje i preferencje komunikacyjne;
- które informacje wolno pokazać danej osobie i Teresie.

Profil nie jest CV ani miejscem przyznawania uprawnień. Role aplikacyjne,
członkostwa, manager, dział i role projektowe mają kanonicznego właściciela w
Organization/Admin/Project Team. Profil pokazuje je jako read-only projection.

## 2. Wnioski z benchmarku

Analiza opiera się na oficjalnych materiałach:

- [Slack — Edit your profile](https://slack.com/help/articles/204092246-Edit-your-profile): full/display name, title, pronouns, pronunciation/recording,
  phone, timezone, custom i admin-locked fields oraz „View as”;
- [Atlassian — Profile and visibility](https://support.atlassian.com/atlassian-account/docs/update-your-profile-and-visibility-settings/): widoczność per pole `Anyone / Organization / Only you`, managed fields i public name;
- [Microsoft 365 — Profile cards](https://support.microsoft.com/en-US/Outlook/profile-cards-in-microsoft-365): contact, availability, working location, about, org chart, collaborators, shared files/events i dane zarządzane przez organizację;
- [Microsoft 365 — Skills](https://support.microsoft.com/en-us/people-skills/explore-what-you-can-do-with-your-skills): rozróżnienie umiejętności potwierdzonych, importowanych i sugerowanych przez AI;
- [Asana — Setting up your profile](https://help.asana.com/s/article/setting-up-your-asana-profile): photo/name, professional data, about, out-of-office, notifications i integracje;
- [OpenAI — Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq): jawne źródła personalizacji, poprawianie/usuwanie pamięci i Temporary Chat;
- [Anthropic — Personalization](https://support.anthropic.com/en/articles/10185728-understanding-claude-s-personalization-features): rozdzielenie account-wide profile preferences, project instructions i response styles.

Najważniejsza adaptacja: dane identyfikacyjne, organizacyjne, dostępność,
widoczność oraz personalizacja AI muszą być osobnymi warstwami, choć użytkownik
widzi je w jednym spójnym doświadczeniu.

## 3. Model danych profilu

### 3.1 Identity i sposób zwracania się

| Pole | Owner | Edycja | Widoczność |
| --- | --- | --- | --- |
| legal/full name | IdP/Admin lub user | zależnie od managed account | admin/org policy |
| display name | user w granicach polityki | user | per field |
| public/external name | user/Admin | zależnie od polityki | external/share contexts |
| pronouns | user, opcjonalne | user | per field |
| name pronunciation | user | user | org/private |
| name recording | user | user | org/private |
| avatar | user/Admin | user, chyba że locked | per field |
| preferred language | user | user | private/system |

Pronouns i nagranie wymowy są opcjonalne. Brak pola nie może być oceniany jako
„niekompletny profil”.

### 3.2 Kontakt i lokalizacja

- primary work email — verified, zwykle managed/read-only;
- dodatkowe emaile — typ, verified, visibility;
- telefon/telefony — typ, verified, preferred;
- preferred contact method;
- office/work location i working location today;
- miasto/kraj w stopniu dopuszczonym polityką;
- timezone oraz automatycznie wyliczony local time;
- linki zawodowe: LinkedIn, portfolio/website, opcjonalnie GitHub.

Emergency contact jest danym wysoce wrażliwym. Nie należy do zwykłej karty
profilu i jest widoczny tylko w wyraźnie uprawnionym procesie HR/safety.

### 3.3 Organizacja i odpowiedzialność

Pola read-only z Organization/Admin:

- organization/company;
- business unit, department i team;
- job title;
- manager/reporting line;
- location/office;
- employment status, jeśli potrzebny;
- app role;
- project memberships i project roles;
- obszary odpowiedzialności/ownership.

Użytkownik może zgłosić korektę. Nie może sam awansować się na managera,
przepisać do projektu ani zmienić uprawnienia.

### 3.4 Informacje zawodowe

- krótkie About me: rola, sposób pracy i jak najlepiej się kontaktować;
- areas of expertise;
- skills;
- certifications;
- languages i proficiency;
- education/work experience wyłącznie opcjonalnie, jeśli ma wartość dla
  konsultingu i staffing;
- portfolio/projects showcase jako dozwolone referencje do pracy, nie ręczna
  lista sukcesów bez evidence.

Skills mają provenance i status:

```text
self_declared -> manager/organization_confirmed -> inferred_by_AI -> expired
```

AI może zaproponować umiejętność na podstawie pracy, ale użytkownik lub
uprawniony manager ją potwierdza. Wnioskowana umiejętność nie jest pokazywana
innym jak fakt.

### 3.5 Dostępność i sposób pracy

- tygodniowe working hours per day;
- timezone;
- working days;
- out-of-office from/to i optional public note;
- current availability/status z expiry;
- working location;
- focus/DND i quiet hours;
- preferowane godziny spotkań;
- wyjątki dla pilnych alertów;
- calendar-derived next availability jako projekcja, nie ujawnienie kalendarza.

Istnieje jeden kanoniczny model working hours. Notification availability i
calendar availability korzystają z niego, ale mają własne wyjątki.

### 3.6 Personalizacja Teresy

Profil osobowy i profil AI są powiązane, ale rozdzielone:

- account-wide preferences: metody, terminologia, typowe scenariusze;
- response style: concise/formal/explanatory/custom;
- language i poziom szczegółowości;
- accessibility/communication needs;
- approved memories z source i scope;
- project instructions zarządzane na poziomie projektu;
- temporary/private session, która nie czyta i nie zapisuje pamięci.

Teresa widzi tylko dane profilu potrzebne do zadania oraz dozwolone przez
widoczność i scope. Nie używa danych wrażliwych do oceniania pracownika.

## 4. Widoczność per pole

Każde pole ma poziom:

- `only_me`;
- `direct_team`;
- `project_members`;
- `organization`;
- `external_collaborators`;
- `public`, wyłącznie dla świadomie publicznych scenariuszy.

Admin określa dozwolony zakres i pola obowiązkowo widoczne. Użytkownik może go
zawężać tylko tam, gdzie polityka pozwala. Email administracyjny pozostaje
dostępny administratorom niezależnie od karty współpracy.

## 5. „View as”

Profil musi mieć preview:

- widok własny;
- współpracownik z organizacji;
- członek projektu;
- external/partner;
- Teresa w aktualnym scope.

Preview używa tego samego policy resolvera co runtime, nie symulacji na
frontendzie. Pozwala zrozumieć, które pola i artefakty są rzeczywiście widoczne.

## 6. Karta użytkownika w aplikacji

Kliknięcie avatara/nazwy w Tasks, Decisions, Initiatives, Meeting i innych
modułach otwiera jedną wspólną kartę:

- identity i presence;
- title, team i project role w bieżącym kontekście;
- local time, availability i next available window;
- dozwolone kanały kontaktu;
- areas of expertise/confirmed skills;
- wspólne projekty oraz dozwolone wspólne artefakty;
- działania: message, schedule, open organization profile.

Karta nie ujawnia prywatnego telefonu, pełnej aktywności, ocen, obciążenia ani
plików, których viewer nie może otworzyć.

## 7. Profile completeness

Nie ma jednego marketingowego procentu. System pokazuje readiness według celu:

- collaboration ready;
- scheduling ready;
- project assignment ready;
- Teresa personalization ready;
- security ready.

Pola opcjonalne/wrażliwe nie obniżają wyniku. Completeness nie jest oceną
pracownika. Sugestia wyjaśnia korzyść i pozwala ją pominąć.

## 8. Lifecycle i synchronizacja

Profil ma `active/invited/suspended/deactivated/deleted`. Zmiana owner-controlled
field przez Admin/IdP propaguje się do jednej kanonicznej karty. Nie kopiujemy
nazwy, stanowiska i działu do każdego modułu; rekordy przechowują user ID i
wyświetlają aktualną projekcję, z historycznym snapshotem tylko tam, gdzie
wymaga tego audit.

## 9. MVP

MVP: full/display name, avatar, title/team projection, About me, confirmed skills,
work email, timezone/local time, working hours, OOO/status, preferred contact,
language, visibility per kluczowe pola, roles/projects read-only, View as oraz
spójna karta użytkownika. Education, pełne CV, name audio i portfolio mogą być
P1, jeśli nie są krytyczne dla staffingu.

## 10. Pytania właścicielskie

1. Czy Consultify ma być również bazą kompetencji do staffingu projektów?
2. Czy education/work experience zachowujemy, czy upraszczamy do expertise,
   skills i certifications?
3. Czy external/public profile jest potrzebny poza Partner Portalem?
4. Kto potwierdza skills: manager, project lead, HR/Admin czy kilka ról?
5. Czy profile completeness ma być widoczne wyłącznie użytkownikowi?
