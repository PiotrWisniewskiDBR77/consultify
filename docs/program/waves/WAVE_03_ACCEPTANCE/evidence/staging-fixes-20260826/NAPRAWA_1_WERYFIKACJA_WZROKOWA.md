# Naprawa 1 — weryfikacja wzrokowa (CLAUDE.md #7)

Data: 2026-08-26. Naprawiacz: sesja `codex/staging-fixes-20260826`.

## Harness

Dwa nowe ekrany dev-render mountują REALNE komponenty (nie atrapy) z
`seedRealisticSession()` (ustawia `isDemoMode: true` -> `shouldAllowDemoData()`
odblokowuje wbudowane dane demo bez potrzeby mockowania backendu):

- `dev-render/screens/staging-fixes-initiatives-i18n.tsx` — REALNY `<InitiativesHub>`
- `dev-render/screens/staging-fixes-execution-i18n.tsx` — REALNY `<ExecutionHub>`
- `dev-render/screens/org-identity-operating.tsx` — REALNY `<OrganizationView>` (już istniał, użyty bez zmian)

Zarejestrowane w `dev-render/main.tsx` SCREENS. Uruchomione lokalnie:
`npx vite --config dev-render/vite.config.ts --port 4530 --strictPort`.

## Wynik — ExecutionHub, Menu 3 (kluczowe znalezisko)

Prawdziwe źródło zgłoszonego mieszania PL/EN w module Realizacja: moduł-level
stała `EXECUTION_MENU3` (linia ~643 `ExecutionHub.tsx` przed naprawą) — statyczne,
angielskie etykiety zasilające pasek chipów Menu 3 (`StandardModuleBar`) na
KAŻDEJ zakładce (Realizacje/Praca/Zasoby/Sterowanie/Raporty). Potwierdzone
zrzutem PRZED naprawą (zakładka Sterowanie):

```
Needs action 4 · Critical 1 · Decisions 1 · Schedule 2 · Resources 2 · Cost 0
Risk 0 · Dependencies 0 · Adoption 0 · Outcome risk 0 · Verification overdue 0 · Resolved 0
```

PO naprawie (`getExecutionMenu3(t)`, ten sam ekran, `lang=pl`):

```
Wymaga działania 4 · Krytyczne 1 · Decyzje 1 · Harmonogram 2 · Zasoby 2 · Koszt 0
Ryzyko 0 · Zależności 0 · Adopcja 0 · Ryzyko efektu 0 · Weryfikacja przeterminowana 0 · Rozwiązane 0
```

Zakładka Raporty PRZED: `All 2 · Weekly 0 · Monthly 0 · On demand 0 · Sponsor 1 · Needs generation 0 · Needs review 1 · Partial/stale 0 · Published 0 · Failed 0 · Recent runs 0`

PO: `Wszystkie 2 · Tygodniowe 0 · Miesięczne 0 · Na żądanie 0 · Sponsorskie 1 · Wymaga wygenerowania 0 · Wymaga przeglądu 1 · Częściowe/nieaktualne 0 · Opublikowane 0 · Nieudane 0 · Ostatnie uruchomienia 0`

Zakładka Zasoby PO (light+dark, wizualnie sprawdzone): `Wszystkie 4 · Przeciążeni 1 · Nieprzypisana praca 1 · Braki kompetencji 0 · Niepotwierdzone przypisania 3 · Dostępność nieznana 1 · Ryzyko kosztowe 1 · Wymaga decyzji 1 · Wg zespo...`

Sprawdzone w light I dark theme (`&theme=light|dark`) — brak regresji, tokeny
`c-*` renderują się poprawnie w obu trybach.

## InitiativesHub

Potwierdzone wzrokowo (`get_page_text` + zrzuty light/dark):
- `common.sampleData` → „PRZYKŁADOWE DANE" (badge przy trybie demo)
- `initiatives.filters.priority` / `allPriorities` → „Priorytet" / „Wszystkie priorytety" (dropdown)
- Nagłówki/zakładki/CTA („Nowa inicjatywa") już były PL, bez regresji

## OrganizationView

Ekran `org-identity-operating` (istniejący harness) — pełny render PL,
sidebar/nagłówki/karty bez regresji, light+dark.

## Uczciwe zastrzeżenie — martwy kod

Podczas weryfikacji ustalono, że DWIE z zaplanowanych napraw dotyczą kodu,
który okazał się NIEOSIĄGALNY z żywego UI (superseded przez nowsze komponenty):

1. **InitiativesHub — modal „Nowa inicjatywa" z selektorem poziomu**
   (`INITIATIVE_LEVELS` → `getInitiativeLevels(t)`). Stan `showNewModal` nie
   ma już ŻADNEGO wywołania `setShowNewModal(true)` w kodzie — jedyny
   klikalny CTA „Nowa inicjatywa" otwiera `showInitiativeWizard`
   (`InitiativeCreationWizard`, osobny plik, NIE sprawdzany w tej naprawie).
   Fix jest poprawny mechanicznie (usuwa martwy hardkodowany angielski), ale
   nie wpływa na to, co widzi użytkownik. Rekomendacja: sprawdzić
   `InitiativeCreationWizard.tsx` pod tym samym kątem osobno, oraz rozważyć
   usunięcie martwego bloku `showNewModal` (dług techniczny).
2. **ExecutionHub — cały poddrzewo `renderReportsCatalog()`** (katalog
   raportów z kartami highlights „Progress/Blocked/Tasks/...", oraz
   `renderPortfolioHealth`/`renderTasksQueue`/`renderDecisionsBuckets`/
   `renderActionCenter`, każde z osobnym `failedDesc` Callout). Zweryfikowane
   PRECYZYJNIE (nie tylko wizualnie, ale i przez `grep` wszystkich wywołań
   nazw funkcji): `renderContent()` (linia 5354) ma DWA kolejne bloki
   `if (activeTab === 'reports') return ...` — pierwszy (linia ~5563) zwraca
   `<ExecutionReportsSurface>` (realny, żywy komponent — potwierdzone
   zrzutem: „Raporty | Definicje", „Generator raportu", „Nowa definicja" —
   te stringi żyją WYŁĄCZNIE w `ExecutionReportsSurface.tsx`, już po
   polsku), drugi (linia ~5669, `return renderReportsCatalog()`) jest przez
   to NIEOSIĄGALNY martwym kodem w JS (pierwszy `return` wygrywa zawsze).
   `renderPortfolioHealth`/`renderTasksQueue`/`renderDecisionsBuckets` są w
   ogóle NIGDZIE wywoływane (zdefiniowane, ale bez jednego call-site w całym
   pliku); `renderActionCenter` jest wywoływany WYŁĄCZNIE wewnątrz martwego
   `renderReportsCatalog()`. Skala: to nie kilka linii — to ~750 linii
   (3091–4934) rzeczywiście martwego, nigdy nie renderowanego kodu w
   `ExecutionHub.tsx`. Zgłoszone jako osobne zadanie sprzątające (zobacz
   `spawn_task` w tej samej sesji) — usunięcie wykracza poza zakres tej
   naprawy (ryzyko regresji przy jednym dużym cięciu bez osobnego review).

Dobra wiadomość: `EXECUTION_MENU3` → `getExecutionMenu3(t)` — GŁÓWNA i
najbardziej dotkliwa naprawa w tym pakiecie (Menu 3 na KAŻDEJ z 5 zakładek
Realizacji) — jest w 100% żywa i widoczna, potwierdzone zrzutem przed/po w
tym dokumencie (light+dark, zakładki Sterowanie/Zasoby/Raporty). To ona
adresuje realny, zgłoszony problem „mixed PL/EN on the same screen" dla
modułu Realizacja.
