# Automatyzacja raportowania — `reporting-automation`

**Status:** PROPOZYCJA — do słowa właściciela. Karta #63 inwentarza, moduł `11_MATERIALS`.
Inwentarz już oznaczył to jako „do rozstrzygnięcia: konfiguracja, nie artefakt" — pomiar w tej
partii **potwierdza tę tezę kodem**.

## §0. Tożsamość i rozstrzygnięcie zakresu

- Nazwa PL: **Automatyzacja raportowania** — zarządzanie harmonogramami raportów cyklicznych i
  wyzwalanych zdarzeniami (komentarz nagłówkowy: „Full UI for managing automated recurring and
  event-triggered report schedules. Tabs: Schedules, Execution History.").
- Otwarcie: `ReportsHub.tsx:983` (zakładka wewnątrz hubu raportów, nie osobna trasa z `:id`).
- Komponent: `src/components/Reports/Management/ReportingAutomationWorkspace.tsx:1` (1113 linii).
  Zero powłoki standardu (`ArtifactRightPanel`/`ExecutiveModuleShell`/`NModeShell`).
- **Obiekt zarządzany to REGUŁA (harmonogram: interwał, wyzwalacz, typ raportu do wygenerowania),
  NIE dokument gotowy do przeczytania.** `selectedScheduleId` to stan lokalny (`:136`), brak trasy
  `/reports/automation/:scheduleId`. Backend MA identyfikator (`GET/POST
  /api/scheduled-reports/:scheduleId/*`, `:179,188,330`), ale — tak jak w `management-report.md`
  — front go nie eksponuje jako adres.
- **Test z `_wzorzec-raport-dokument.md` (karta B vs ekran generatora/konfiguracji) wypada tu
  na „NIE"**: harmonogram nie jest „migawką z własnym ID, którą da się otworzyć ponownie,
  zapisać, zatwierdzić, wyeksportować" w sensie DOKUMENTU — to reguła sterująca GENEROWANIEM
  przyszłych dokumentów (patrz precedens `execution-control-loop`/`execution-report-generator`
  w tym samym wzorcu-bazowym, uznane za „NIE karta N").

## §1–§6. Konsekwencja rozstrzygnięcia

Jeśli powyższe rozstrzygnięcie się utrzyma, sekcje K1–K30 kanonu karty N nie mają tu
zastosowania w tej samej formie co dla dokumentu/raportu — harmonogram jest bliżej „ekranu
ustawień modułu" (jak reguły automatyzacji w innych narzędziach) niż karty-obiektu. Nie
oznacza to braku standardów w ogóle: lista harmonogramów i tak powinna być `StandardTable`
(nie zmierzone w tej partii, czy tak jest), a panel edycji jednego harmonogramu — formularzem,
nie kartą N.

## §7. Do decyzji właściciela

**Czy `reporting-automation` w ogóle powinien być liczony jako karta N w rejestrze #63, czy
wypaść z inwentarza kart N i zostać skategoryzowany jako ekran konfiguracji modułu** (analogicznie
do trzech ekranów Realizacji już wykluczonych w `_wzorzec-raport-dokument.md`:
`execution-control-loop`, `execution-work-intelligence`, `execution-resources-capacity`,
`execution-report-generator`)? Rekomendacja: wykluczyć z rejestru kart N, zostawić jako
zarządzany ekran ustawień modułu Materiały — ale to zmienia liczbę „140 kart" z inwentarza
głównego, więc wymaga jawnej decyzji, nie cichej korekty w tym pliku.

Nie zmierzono w tej partii: czy lista harmonogramów używa `StandardTable`, stan czytelności
(`primary-[0-9]`, i18n), zrzutu żywego — priorytet poszedł do kart z jednoznacznym statusem karty
N (dokument/prezentacja/arkusz/sejf/raport-kreator).
