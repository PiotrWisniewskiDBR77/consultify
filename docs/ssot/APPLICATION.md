---
doc_id: ssot-application-profile
truth_type: product-target
status: canonical
owner: product
last_reviewed: 2026-07-30
---

# Consultinity — karta aplikacji

## Obietnica

Consultinity jest systemem pracy doradczej i transformacyjnej. Łączy zebranie
kontekstu, diagnozę, decyzję, realizację, pomiar efektu i przygotowanie
materiałów. Teresa jest warstwą współpracy AI, a nie niezależnym właścicielem
danych biznesowych.

## Użytkownicy

- konsultant i analityk;
- manager transformacji / PMO;
- właściciel inicjatywy i wykonawca;
- respondent, reviewer i decydent;
- administrator organizacji;
- partner;
- operator platformy w oddzielnym SuperAdmin.

## Model działania

Podstawowy przepływ:

`Chat/My Work → Interview/Tools/Assessment/Audits → Initiatives → Execution →
Results → Finance → Materials`

Organization dostarcza kontekst. Admin Panel i Settings sterują zachowaniem.
Meeting ma realny, częściowy runtime, mimo że menu nadal pokazuje `soon`.
Docelowo jest wieloosobowym środowiskiem pracy, w którym Teresa aktywnie
facylituje spotkanie i orkiestruje narzędzia całej aplikacji. Finalne zadania,
decyzje, inicjatywy, KPI, finanse i materiały pozostają w modułach
właścicielskich.

## Menu użytkownika

Kanoniczne 16 pozycji:

1. Chat
2. My Work
3. Interview
4. Tools
5. Assessment
6. Initiatives
7. Execution
8. Results
9. Finance
10. Materials
11. Audits
12. Meeting
13. Organization
14. Admin Panel
15. Settings
16. Partner Portal

Kolejność i widoczność potwierdzają
`src/components/navigation/Sidebar/menuConfig.ts` oraz
`src/components/navigation/Sidebar/SidebarFooter.tsx`.

## Własność

Każdy obiekt ma jeden moduł właścicielski. Chat może zaproponować inicjatywę,
ale jej prawdę utrzymuje Initiatives. Materials może prezentować KPI, ale jego
prawdę utrzymuje Results. My Work agreguje działania, lecz nie duplikuje
statusu obiektu domenowego.

Handoff powinien zachować źródło, wynik, autora, czas, powód, akceptację i link
zwrotny.

## Stan produktu

- aktywne: Chat, My Work, Interview, Tools, Assessment, Initiatives, Execution,
  Settings;
- beta według menu: Results, Finance, Materials, Audits;
- realny/partial z niespójnym badge `soon`: Meeting;
- zależne od dostępu: Organization, Admin Panel, Partner Portal;
- techniczne/historyczne, nie menu: MCP IRIS, MCP Marketplace;
- osobny control plane: SuperAdmin.

Szczegółowy i uczciwy status każdej pozycji:
`docs/program/DOCUMENTATION_STATUS.md`.
