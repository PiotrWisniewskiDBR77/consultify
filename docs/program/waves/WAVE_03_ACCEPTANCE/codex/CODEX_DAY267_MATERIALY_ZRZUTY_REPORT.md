# CODEX DAY267 — MATERIAŁY: KOMPLET ZRZUTÓW POD WERDYKT

Data: 2026-09-01  
Gałąź: `codex/day267-materialy-zrzuty-20260901`  
Baza: marker `df7f13056f`, bez rebase  
Zakres: wyłącznie pomiar i materiał wizualny; zero napraw produktu.

## Wynik

**DOSTARCZONO MATERIAŁ DO WERDYKTU, NIE WERDYKT PRODUKTOWY.** Powstało 61 PNG:
20 bazowych par hubu (5 zakładek × pełny/pusty × jasny/ciemny), 10 podglądów
po kliknięciu, 5 otwartych kebabów, 16 kadrów obu kroków launcherów, 8 pełnych
widoków dokumentu/prezentacji/arkusza/architekta oraz 2 kadry mutacja→cofnięcie.
Katalog: `/private/tmp/cx-day267-materialy-zrzuty-artefakty`.
Pełna lista: `screenshots.txt`; sumy: `SHA256SUMS.txt`.

## Wejście i bezpieczeństwo

Wynik markera i sanity, dosłownie:

```text
MARKER OK
df7f13056fa24995be07f64b0e8c877b3faeab45
git status --short: brak wpisów
```

Tip gałęzi bazowej uciekł do przodu. Zgodnie z DEC-2026-08-26-95 wystartowałem
dokładnie z markera; pełny log i lista plików różnicy są w
`tip-divergence-log.txt` i `tip-divergence-files.txt`.

- Przed startem było 10 GiB, po utworzeniu worktree 8.1 GiB wolnego.
- Porty 6274, 5254 i 5255 były wolne.
- Kontener `cx-day267-pg`, baza `cx267`, port 6274; pełne migracje przeszły,
  drugi przebieg zastosował 0 migracji (`migrate-1.txt`, `migrate-2.txt`).
- `settings WHERE key LIKE 'smtp%'`: 0 wierszy; brak zmiennych pocztowych.
- Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
  zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
  żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.
- Środowisko zrzutu: `BRAK KLUCZA LLM W SRODOWISKU ZRZUTU` (`safety-env.txt`).
  Żaden model językowy nie został wywołany.

## R1 — inwentarz

| Ekran | Implementacja podglądu | Stan | Motywy | Podgląd w kadrze | Klucz LLM |
|---|---|---|---|---|---|
| Wszystkie | kanon `StandardTable` + `StandardPreview` | pełny/pusty | jasny/ciemny | tak, po kliknięciu | mieszany; DOC/PPT: brak |
| Dokumenty | kanon `ReportsTabContent` + `StandardPreview` | pełny/pusty | jasny/ciemny | tak, po kliknięciu | brak; zastępnik awaryjny |
| Prezentacje | kanon `PresentationsTabContent` + `StandardPreview` | pełny/pusty | jasny/ciemny | tak, po kliknięciu | brak; zastępnik awaryjny |
| Arkusze | wrapper bespoke `SheetsTabContent`, ale szczegóły deleguje do kanonicznego `OutputsAggregateTabContent` + `StandardPreview` | pełny/pusty | jasny/ciemny | tak, po kliknięciu | nie wymaga |
| Biblioteka wzorców | kanon `TemplatesTabContent` + `StandardPreview` | pełny/pusty | jasny/ciemny | tak, po kliknięciu | nie dotyczy listy |
| Launcher materiału | realny `CreateFormatModeLauncher`, krok format→tryb | oba kroki | jasny/ciemny | nie jest listą | DOC/PPT AI: brak |
| Launcher szablonu | realny `CreateFormatModeLauncher`, krok format→tryb | oba kroki | jasny/ciemny | nie jest listą | Word/PPT AI: brak |
| Dokument/Prezentacja/Arkusz | realne istniejące harnessy Day235 | pełny | jasny/ciemny | workspace | DOC/PPT: brak; XLSX: nie wymaga |

`StandardPreview.tsx` nie zawiera `fixed`, `absolute`, `inset-0`, `z-50` ani
`z-[`; podgląd jest panelem bocznym, dlatego zgodnie z instrukcją wykonano po
dwa kadry po kliknięciu (jasny/ciemny), nie cztery jak dla nakładki.

Własne przeliczenie rejestru arkuszy: **9 identyfikatorów**, w tym
`cashflow12m`; dowód `workbook-template-count.txt`. Nie przepisano liczby z instrukcji.

## R2 — harness i KSZTALT_21

Nowy harness montuje realny `<ReportsAndPresentationsHub />` i obsługuje
`tab=outputs_all|outputs_documents|presentations|outputs_sheets|templates`
oraz `state=ready|empty|loading|error`. `check-devrender-main-final.txt`:

```text
✓ parsuje sie
✓ struktura spisu ekranow poprawna (kazdy wpis domkniety)
✓ wszystkie lazy-importy wskazuja na istniejace pliki
✓ brak zdublowanych kluczy
✓ kazdy leniwy import ma wpis w spisie
✓ kazdy wpis w spisie ma leniwy import
✓ liczba ekranow: 260 (podloga 259)
  • podloga podniesiona do 260
```

Kontrola kształtu atrapy:

- realny endpoint listy: `server/src/routes/artifacts.routes.ts:396-461`;
- mapowanie rekordu serwera: `server/src/services/v8/artifactRegistryService.ts:496-535`;
- fixture: `dev-render/screens/day267-materialy-hub-zrzuty.tsx:24-142`.

Pola kluczowe są zgodne: `artifactId`, `artifactFamily`, `outputType`,
`originRuntime`, `originRecordId`, `deliveryState`, `createdAt`,
`lastTransitionAt`, `originSummary`; odpowiedź ma kopertę `{ data }`. Kontrola
wyłapała przed finalnym renderem dwie rozbieżności autora harnessu
(`artifactFamily: workbook` dla arkusza i `template_library` jako runtime
szablonu). Obie skorygowano do kontraktu serwera (`sheet` oraz
`report_template|presentation_template|sheet_template`) przed ponownym
wykonaniem par. Finalnie brak blokującej różnicy kształtu.

## R3 — zrzuty i kontrola realności

Każdy plik pełnego dokumentu/prezentacji ma `noLLMkey` w nazwie. Dla każdego
takiego pliku obowiązuje adnotacja: **„Zrzut pokazuje awaryjny zastępnik przy
braku klucza LLM w środowisku; nie pokazuje realnie wygenerowanej treści i nie
jest dowodem jakości treści.”** Dotyczy wszystkich plików z wzorcami:

```text
outputs_all-ready-*-noLLMkey.png
outputs_documents-ready-*-noLLMkey.png
presentations-ready-*-noLLMkey.png
launcher-*-document-*-noLLMkey.png
launcher-*-presentation-*-noLLMkey.png
launcher-templates-step2-word-*-noLLMkey.png
document-full-noLLMkey-*.png
presentation-full-noLLMkey-*.png
```

Arkusz `sheet-full-light.png` / `sheet-full-dark.png` nie zależy od LLM.

Strażnik `checkScreenshotPairState`: **10/10 par PASS** (pełny/pusty dla pięciu
zakładek), wymóg wyniku w obu wariantach dla stanu pełnego spełniony. Pełne
jasności i werdykty: `pair-verdict.json`. Podgląd po kliknięciu został
mechanicznie potwierdzony przez `asideCount=1` dla wszystkich 10 kadrów.
Kebab: `menuCount=1` dla wszystkich pięciu zakładek.

Mutacja: tytuł wiersza zmieniono na `MUTACJA DAY267 — ekran dowodowy`, selektor
znalazł 1 element i powstał `mutation-visible-light.png`; po cofnięciu selektor
mutacji dał 0, oryginalny tytuł 1, `git diff` pliku był pusty
(`mutation-restore.txt`, `mutation-restored-light.png`).

## Testy i zasięg nazw

Pakiet finalny: **4/4 PASS, 0 FAIL, `--retry=0`**, JSON `day267-pakiet.json`.
Pełne nazwy są w `po-nazwy.txt`; diff w `nazwy.diff`.

Przed zmianą licencjonowany plik testu nie istniał, więc `przed-nazwy.txt`
zawiera jawne `BRAK`, a nie fałszywe zero PASS. Pierwsza komenda z głównym
`vitest.config.ts` zebrała 0 testów (jego `include` nie obejmuje `scripts/dev`),
co nie zostało zaliczone. Finalny pomiar użył wąskiego configu poza repo w
scratch i zebrał wszystkie cztery pełne nazwy.

Pułapki Z33: pakiet jest statyczno-plikowy i obrazowy, nie montuje Gateway,
nie dotyka DB ani tras; (a) `ENABLE_V8_GLOBAL`, (b) beta visibility,
(c) SQLite/Postgres i (d) auth bypass nie leżą na jego ścieżce. Pułapka (e)
jest wyłączona przez bezwzględny zakaz LLM oraz jawne `noLLMkey`; pakiet nie
twierdzi nic o jakości wygenerowanej treści.

## R4 — niefotografowalne i niezweryfikowane

### Niefotografowalne

- Realnie wygenerowany dokument i prezentacja: brak klucza LLM oraz Z15.
- Jakość treści DOCX/PPTX/XLSX: poza zakresem, zakaz oceny.
- Dane aktywnego realnego tenanta: zrzuty są lokalnym harness-em werdyktowym,
  nie dowodem ścieżki API/PG ani danych produkcyjnych.

### Twierdzenia niezweryfikowane

- Nie zweryfikowano jakości realnej generacji LLM.
- Nie zweryfikowano eksportu plików ani spójności bramek jakości — tylko opisano
  zastany pomiar 1.09.
- Nie zweryfikowano zachowania pełnego runtime z realnym ApiGateway; nie jest to
  zakres dyżuru zrzutowego.

### Korekty wobec instrukcji

1. Komenda (2b) oczekiwała trafienia `Preview` w `SheetsTabContent.tsx`, ale
   dała zero. Odczyt pliku pokazał, że arkusze delegują listę i podgląd do
   `OutputsAggregateTabContent`, który używa `StandardPreview`; to wynik, nie STOP.
2. Główny `vitest.config.ts` nie zbiera testów `scripts/dev/**/*.mjs`; zero testów
   nie zostało uznane za PASS. Użyto wąskiego configu w scratch, bez zmiany
   globalnej infrastruktury testowej.
3. Harness początkowo miał dwa pola niezgodne z kontraktem serwera; kontrola
   KSZTALT_21 je wykryła, skorygowano fixture i ponowiono finalne zrzuty.

## Pliki repo zmienione w dyżurze

```text
dev-render/main.tsx
dev-render/screens/day267-materialy-hub-zrzuty.tsx
scripts/dev/day267-materialy-zrzuty-werdykt.mjs
scripts/dev/__tests__/day267-materialy-zrzuty-werdykt.test.mjs
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY267_MATERIALY_ZRZUTY_REPORT.md
```
