# DOWÓD PACZKI J1 — moduł 01 Czat (AI Chat), spójność językowa EN/PL

Program: `docs/program/JEZYK_EN_PL_20260908/PLAN.md` (§2 zasady, §3 paczka J1).
Wzór dowodu: `evidence/jezyk-j7/` (paczka J7b, moduł 07 Realizacja).

Stanowisko: worktree `/Users/piotrwisniewski/Developer/wt/j1-czat`, gałąź
`mvp/j1-czat-0909` z bazy `d7c7f3e437`; API 4199 · Vite 3217 (`--mode test`) ·
baza `consultify_kopia_final` (docker `consultify-pg18`, port 54418);
konto `audyt@dbr77.local`, 1440×900, motyw jasny.

---

## 1. POMIAR — `node scripts/i18n/pomiar-jezyka.mjs --modul "01 Chat"`

| Kategoria | PRZED | PO | Uwaga |
| --- | --: | --: | --- |
| K1def — polski `defaultValue` w `t()` | **172** | **0** | |
| K1defWID — z tego bez klucza w EN (EN widział polski NA STAŁE) | **63** | **0** | |
| K3a — klucz jest w PL, brak w EN | **20** | **0** | cały `chat.governedHandoff.*` |
| K4pl — polski na sztywno w JSX | **68** | **0** | |
| K4en — angielski na sztywno w JSX | **34** | **2** | oba pozostałe to FAŁSZYWE trafienia (niżej) |
| K7 — daty/liczby bez locale albo z `'pl-PL'` | **27** | **0** | |
| K5en — angielskie zdania z serwera | 27 | 27 | **poza tą paczką** — należy do J17 (§3 PLANU) |
| **RAZEM (moduł)** | **348** | **53** | |

Baseline programu (`docs/program/JEZYK_EN_PL_20260908/baseline.json`) przeliczony
w tym samym commicie. **Zero wzrostów w KTÓRYMKOLWIEK module** — sprawdzone
per-moduł, nie tylko po sumie.

**Mutacja bramki** (dowód, że bramka działa, a nie tylko świeci na zielono):
obniżenie `01 Chat / K4en` z 2 na 1 w baseline → `pomiar-jezyka.mjs --baseline`
kończy się **kodem 1** i wypisuje `01 Chat / K4en: 1 -> 2 (+1)`. Mutacja cofnięta.

### Dwa pozostałe K4en to fałszywe trafienia — nie retuszuję ich kosmetyką

* `src/components/AIChat/Artifacts/ArtifactsPanel.tsx:52` — fragment mapy ikon
  (`document: <FileText size={16} />,`) złapany przez regex tekstu JSX;
* `src/components/AIChat/ChatHistorySidebar.tsx:1163` — komentarz
  `/* Search mode: … */` wewnątrz JSX.

Żadne z nich nie jest napisem, który ktokolwiek zobaczy.

---

## 2. DOWÓD WIZUALNY

`przed/` i `po/` — po 28 plików (14 ekranów × EN/PL) plus `<nazwa>.png.json`
z licznikiem obcych słów w `document.body.innerText`, wykrytym językiem powłoki
i wiadrem DANE.

Ekrany: czat pusty · menu Narzędzia AI · Dodaj pliki · tryb źródeł (Co-Thinker) ·
lista wątków (Historia) · kebab wątku · wątek z wiadomościami · ocena odpowiedzi ·
panel pracy/artefaktów · arkusz (Excele) · arkusz — Źródła · prezentacje ·
Action Center · Sesje badawcze.

### Najkrótszy dowód dla właściciela: `07-watek-en`

| | PRZED | PO |
| --- | --- | --- |
| pasek modułu | **Czat AI** | AI Chat |
| pigułka danych | **Dane** | Data |
| akcja pod odpowiedzią | **Otwórz jako dokument** | Open as document |
| plakietka źródeł | **Źródła: 7** | 7 sources |
| pole wpisu | **Zapytaj Teresę o swoją pracę…** | Ask Teresa about your work… |

To samo na `10-arkusz-en`: **Materiały / Arkusze / Nowy arkusz / Jak chcesz
zacząć arkusz? / Czysto / Z AI / Z szablonu** → Materials / Sheets / New sheet /
How do you want to start the spreadsheet? / Blank / With AI / From a template.

### Liczby PO, czytane uczciwie (nie sumą)

Suma z przyrządu to `EN=917 / PL=76`, ale **sama suma kłamie w obie strony** —
rozbijam ją, bo tylko rozbita jest prawdą:

* **Ekrany, na których powłoka NAPRAWDĘ stała w deklarowanym języku
  (`zgodnyJezyk: true`) i nie pokazywały rozmowy: 0 obcych słów interfejsu.**
  Dotyczy 04, 05, 06, 10, 11, 12, 13, 14 w EN oraz 01–06, 10, 11, 13 w PL.
* **295 „obcych słów" na `07/08/09-…-en` to TREŚĆ ROZMOWY POKAZOWEJ**, nie
  interfejs: 61 linii, wszystkie z polskiej odpowiedzi modelu zapisanej w
  `conversation_messages`. Obejrzane wszystkie 61 — zero z nich to napis
  produktu. To kategoria **K6 (dane pokazowe)**, czyli pytanie §5.4 PLANU,
  na które właściciel jeszcze nie odpowiedział.
* **10–12 słów na `01/02/03-…-en` i 16–23 na `07/09-…-pl` to WYŚCIG BOOTSTRAPU
  i18n**, nie defekt modułu: w tych zrzutach `zgodnyJezyk: false`, czyli powłoka
  stała w drugim języku mimo `users.language`. Zgłoszone jako STOP (§5).

### Kontrola języka powłoki — bo bez niej dowód by skłamał

Każdy zrzut zapisuje `jezykPowloki` i `zgodnyJezyk`, a przy rozjeździe robi jedno
przeładowanie. Dochodziłem do tego w trzech podejściach i **wszystkie trzy warte
są zapisania, bo każde kłamało inaczej**:

1. **Przełączanie języka w locie** (`UPDATE users.language` + `localStorage` +
   reload) — powłoka zostawała w poprzednim języku. Przyczyna: bootstrap czyta
   użytkownika odtworzonego z `localStorage`, a moduł Czatu ma **własny, lepki**
   wybór języka (`chatLanguage`: `consultify-preferred-chat-lang` +
   `chatLanguageByConversationId`), który przeżywa przeładowanie. Naprawa:
   **świeże logowanie w nowym kontekście przeglądarki na każdy język**.
2. **Sonda na `document.title`** — SKŁAMAŁA: tytuł zostawał z etykiety trasy
   („AI Chat") przy polskim wnętrzu. Naprawa: sonda czyta napisy renderowane
   przez sam produkt (placeholder pola wpisu, „Start by voice", „New
   conversation").
3. **Wiadro DANE porównywane linia-w-linię z bazą** — renderer markdown zjada
   znaczniki listy i pogrubienia, więc linia z ekranu nigdy nie równa się linii
   z `conversation_messages.content`. Naprawa: porównanie po znormalizowanym
   korpusie treści.

### Czego dowód NIE pokazuje (dziury, nie zamiatam ich)

* **`06-kebab-watku` powtarza ekran 05** w obu językach — kliknięcie w kebab
  wiersza rozmowy nie trafiło (menu pojawia się dopiero po najechaniu, a mój
  lokator go nie złapał). Ten zrzut **nie jest dowodem kebaba**.
* **`11-arkusz-zrodla` powtarza ekran 10** — zakładka „Źródła i założenia"
  w lewej szynie nie została kliknięta (arkusz startuje na ekranie wyboru trybu,
  gdzie szyny jeszcze nie ma).
* **Zrzuty PL w `przed/` od ekranu 03 wzwyż są SKAŻONE** — mój błąd: puściłem
  pomiar wizualny równolegle z pierwszym codemodem. Zrzuty **EN w `przed/` są
  czyste** (cały przebieg EN skończył się przed pierwszą zmianą), a to one są
  dowodem dla priorytetu właściciela.

## 3. TESTY

`npx vitest run src/components/AIChat tests/unit/chat tests/unit/ai`

* **PRZED** (na bazie `d7c7f3e437`, przywróconej `git checkout` po ścieżkach):
  13 plików / 39 testów czerwonych.
* **PO**: 13 plików / 38 testów czerwonych — **IDENTYCZNY zbiór nazw plików**,
  zero nowych czerwonych, jeden naprawiony.

Testy asertujące polskie napisy z dawnych defaultów przeniesione na nowy
angielski tekst. Podmiana jest **dosłowna i tylko dla całych literałów** — pierwsze
podejście podmieniało fragmenty i zrobiło `"Usuń wiersz"` → `"Delete wiersz"`;
zostało cofnięte i przepisane.

`SpreadsheetArtifactStudio.test.tsx` dostał **wierną atrapę `react-i18next`**:
bez niej `t()` w teście oddaje `defaultValue` z nietkniętym `{{name}}`, więc test
kazałby asertować napis `Sheet actions: {{name}}`, którego użytkownik nigdy nie
zobaczy (produkt interpoluje). Atrapa odtwarza dokładnie dwie rzeczy: default
zamiast klucza i podstawienie zmiennych.

**Bezpiecznik źródłowy**: `tests/unit/chat/jezykCzatu.source.test.ts` — cztery
testy (polski default w `t()`, polski napis poza `t()`, zaszyty język w prompcie
serwera, polska domyślka propozycji dokumentu). Detektor NIE stoi na samych
diakrytykach — używa TEGO SAMEGO słownika co `scripts/i18n/pomiar-jezyka.mjs`
(lekcja z J7b: „Kamienie milowe" to zdanie w pełni polskie bez ani jednego
ogonka). **Mutacja: 3 wstawki → 3/3 RED**, cofnięte.

`tsc -p server/tsconfig.json --noEmit`: **0 błędów**.
`tsc --noEmit` (front): **192 błędy** — bramka `≤ 192` dotrzymana co do jednego.
Po drodze było 237: dodałem `useTranslation` do plików, którym brakowało `t`
w zakresie (SharedConversationView, ActionCenter, AgentWorkshopControls,
ChartBlockView) — bez tego cztery ekrany wywaliłyby się w przeglądarce na
`ReferenceError: t is not defined`, a esbuild per plik tego NIE łapie.

---

## 4. ZNALEZISKA POZA POMIAREM (skaner ich NIE widzi)

Liczby zmierzone, nie oszacowane.

1. **879 trafień `isPolish ? 'polski' : 'English'` w 32 plikach modułu.**
   Równoległy, dwujęzyczny mechanizm poza słownikiem. Konto EN dostaje z niego
   angielski, więc cel „zero innego języka w EN" nie jest zagrożony — ale każdy
   trzeci język i każda zmiana kopii omija `public/locales`. Osobna paczka.
2. **Cały pasek narzędzi arkusza (Menu 3) mówił po polsku.**
   `spreadsheetArtifactCommands.ts` trzyma w polu o nazwie `labelKey` polski
   NAPIS, a Studio przepuszczało go wprost (`resolveLabel={(label) => label}`).
   Naprawione mapowaniem po `commandId` (26 komend) — rejestr nietknięty.
3. **`SpreadsheetArtifactStudio.tsx` (2570 linii) nie miał ANI JEDNEGO `t()`.**
   Skaner liczył z niego tylko 57 trafień K4pl, bo widzi wyłącznie tekst w JSX
   i atrybuty; realnie było ~110 napisów (etykiety w obiektach, `confirm()`,
   komunikaty błędów). Naprawione wszystkie — liczba z pomiaru była dolną granicą,
   dokładnie jak ostrzega §4.2 PLANU.
4. **Ramki SSE `type: 'status'` są martwe.** Dwa polskie zdania z
   `ai.routes.ts` zamienione na kody (`MULTI_AGENT_STARTED`,
   `MULTI_AGENT_UNAVAILABLE`) + klucze `chat.status.*` — ale `useAIStream`
   **nie obsługuje ramki `status`** (obsłużone są `deliverable`, `reasoning`,
   `tool_step`, `trust_bundle` i 16 innych), więc dziś nikt tych zdań nie widzi.
   Kod i klucz są po to, żeby po podłączeniu ramki nie wrócił polski.
