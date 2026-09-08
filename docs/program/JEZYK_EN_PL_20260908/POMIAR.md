# POMIAR spójności językowej — 2026-09-08

Gałąź `mvp/inicjatywy-lancuch-20260907`, drzewo `/private/tmp/wt-fable-inicjatywy`.
Narzędzie: `scripts/i18n/pomiar-jezyka.mjs` (skan kodu) + `scripts/i18n/pomiar-jezyka-ekrany.mjs`
(skan wizualny, 16 zrzutów w EN). Wyjątki i słowniki: `scripts/i18n/pomiar-jezyka.wyjatki.json`.
Liczby bazowe (ratchet): `baseline.json` obok tego pliku.

---

## 0. NAJWAŻNIEJSZE USTALENIE — mechanika, nie liczba

`src/i18n.ts` ma **`fallbackLng: { en: ['en'] }`**. To znaczy:

> Brak klucza w `public/locales/en/translation.json` **NIE** spada na polski plik.
> Spada na **`defaultValue` z wywołania `t('klucz', 'Tekst')` w kodzie**, a gdy defaultu
> nie ma — na **surowy klucz** (`superadmin.settlements.title`).

Dlatego sam plik `en/translation.json` jest prawie czysty (**3** polskie wartości), a mimo to
użytkownik EN widzi polski. Prawdziwy kanał polskiego w wersji angielskiej to
**polskie wartości domyślne w kodzie**: **1 558** wywołań `t()` z polskim defaultem, z czego
**242** nie ma odpowiednika w `en/translation.json` — te są widoczne **na stałe**.

Do tego dochodzi drugi mechanizm, opisany w komentarzu w samym `src/i18n.ts`:
`react.useSuspense: false` maluje ekran **zanim** dojdzie plik tłumaczeń (1,8 MB EN / 2,0 MB PL),
więc do czasu jego wczytania `t()` zwraca `defaultValue`. Polskie defaulty **migają w EN nawet
tam, gdzie klucz EN jest poprawny**. To wyjaśnia zgłoszenie właściciela z 05.09 o „przeskakującym
języku" cytowane w tym pliku.

**Wniosek dla planu: naprawa wersji angielskiej to w pierwszej kolejności robota w `src/**`
(defaulty `t()`), a nie w `public/locales/en/`.**

---

## 1. Tabela: 16 modułów × kategorie (skan kodu)

Legenda kategorii:

| Kod | Znaczenie | Kogo boli |
| --- | --- | --- |
| K1 | polski tekst w `public/locales/en/*.json` | EN |
| K1def | polski `defaultValue` w `t()` | EN (miga zawsze, stale gdy brak klucza) |
| K1defWID | ⊂ K1def: brak klucza w EN → **EN widzi polski na stałe** | EN |
| K2 | angielski tekst w `public/locales/pl/*.json` | PL |
| K3a | klucz jest w PL, brak w EN | EN |
| K3aKLUCZ | ⊂ K3a: brak też defaultu → **EN widzi surowy klucz** | EN |
| K3b | klucz jest w EN, brak w PL | PL |
| K4pl | polski tekst na sztywno w JSX poza `t()` | EN |
| K4en | angielski tekst na sztywno w JSX poza `t()` | PL |
| K5pl | polskie zdania z serwera do UI | EN |
| K5en | angielskie zdania z serwera do UI | PL |
| K7 | daty/liczby/waluty bez locale albo z locale na sztywno | oba |

```
| Moduł                |     K1 |  K1def | K1defWID |     K2 |    K3a | K3aKLUCZ |    K3b |   K4pl |   K4en |   K5pl |   K5en |     K7 | RAZEM |
|----------------------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| 01 Chat              |      0 |    172 |     63 |      0 |     20 |      0 |      0 |     68 |     34 |      0 |     27 |     27 |   348 |
| 02 My Work           |      0 |    182 |     23 |      3 |      3 |      0 |      0 |     78 |     71 |      1 |     61 |     75 |   474 |
| 03 Interview         |      0 |      0 |      0 |      2 |      0 |      0 |      0 |      3 |      2 |      0 |     51 |      9 |    67 |
| 04 Tools             |      0 |     75 |      3 |      1 |     61 |      9 |      0 |     83 |     36 |     49 |    112 |      9 |   426 |
| 05 Assessment        |      0 |     35 |      2 |      0 |     26 |     12 |      0 |    188 |     43 |     97 |     76 |     30 |   495 |
| 06 Initiatives       |      0 |    131 |      4 |      3 |      0 |      0 |      0 |     43 |     32 |      2 |     97 |     40 |   348 |
| 07 Execution         |      1 |    209 |      2 |      1 |     38 |      0 |      0 |    119 |     86 |      0 |     63 |     35 |   552 |
| 08 Results           |      0 |     45 |      7 |      0 |      0 |      0 |      0 |      3 |      8 |      0 |     45 |     10 |   111 |
| 09 Finance           |      0 |    176 |      5 |      2 |    520 |     54 |      0 |    183 |     22 |      6 |    158 |     49 |  1116 |
| 10 Materials         |      0 |    231 |     42 |      1 |    634 |    215 |      4 |    165 |     89 |     19 |    223 |     67 |  1433 |
| 11 Audits            |      0 |      0 |      0 |      0 |      0 |      0 |      0 |      4 |      5 |     14 |     12 |      3 |    38 |
| 12 Meeting           |      0 |     22 |      0 |      0 |      0 |      0 |      0 |      4 |      0 |      0 |     12 |      0 |    38 |
| 13 Organization      |      0 |     29 |     27 |      0 |      0 |      0 |      0 |     53 |      7 |      1 |     64 |      6 |   160 |
| 14 Admin Panel       |      0 |     36 |     26 |      0 |      3 |      1 |      0 |     10 |    571 |     13 |     73 |    288 |   994 |
| 15 Settings          |      1 |      7 |      1 |      0 |    100 |     16 |      0 |     30 |    136 |     32 |    196 |     81 |   583 |
| 16 Partner Portal    |      0 |    131 |     30 |      0 |    167 |     19 |      0 |     24 |     21 |      3 |     29 |     34 |   409 |
| ZZ wspólne           |      1 |     77 |      7 |      2 |    284 |    103 |      3 |     72 |    233 |     21 |    523 |    141 |  1357 |
| RAZEM                |      3 |   1558 |    242 |     15 |   1856 |    429 |      7 |   1130 |   1396 |    258 |   1822 |    904 |  8949 |
```

**Trzy najgorsze moduły łącznie:** 10 Materials (1 433) · 09 Finance (1 116) · 14 Admin Panel (994).
**Trzy najgorsze dla wersji EN** (K1+K1def+K3a+K4pl+K5pl): 10 Materials (1 049) · 09 Finance (885) ·
07 Execution (367).

## 2. Top 12 najgorszych plików

```
  444  public/locales/pl/translation.json          (K3a: klucze bez pary w EN)
  135  src/components/Execution/ExecutionControlSurface.tsx
   95  src/views/partner/PartnerPortalView.tsx
   86  server/src/routes/document-studio.routes.ts
   61  server/src/routes/work-canvas.routes.ts
   60  src/components/AIChat/KimiWorkspace/SpreadsheetArtifactStudio.tsx
   56  src/views/legal/TermsOfServiceView.tsx
   55  src/components/Execution/ExecutionReportsSurface.tsx
   53  src/components/MyWork/panel/IdeaElementInspector.tsx
   53  src/components/assessment/report/AssessmentReportDocument.tsx
   52  src/components/Organization/redesign/OrganizationReadinessScreen.tsx
   51  server/src/routes/table-platform.routes.ts
```

## 3. Przykłady (po jednym na kategorię, więcej: `--przyklady 20`)

| Kat | Miejsce | Treść |
| --- | --- | --- |
| K1 | `en/translation.json:welcome.videoPerson` | „Paweł Bochniarz" |
| K1def | `src/components/AIChat/AIActionCard.tsx:209` | `t('aiActions.approve', 'Zatwierdź')` |
| K1defWID | jw., brak `aiActions.*` w EN | użytkownik EN widzi „Zatwierdź" |
| K2 | `pl/translation.json:myWork.hub.label51` | „Decyzje (pending)" |
| K3aKLUCZ | `pl/translation.json:presentations.wizard.modes.show` | EN pokaże `presentations.wizard.modes.show` |
| K4pl | `src/components/AIChat/AgentWorkshopControls.tsx:208` | „Schemat jest edytowalny. »Uruchom proces« zapisuje go…" |
| K4en | `src/components/AIChat/ActionCenter.tsx:296` | „Select an action to inspect who, what, when and why." |
| K5pl | `server/src/routes/adminP32.routes.ts:2811` | „Nie udało się trwale zapisać progów budżetowych." |
| K5en | `server/src/routes/access-control.routes.ts:447` | „This access code has been deactivated" |
| K7 | `src/components/AIChat/CanvasEditor/CanvasVersionHistory.tsx:28` | `toLocaleDateString()` bez locale |

---

## 4. Skan wizualny — 16 ekranów w wersji ANGIELSKIEJ

Warunki: konto `audyt@dbr77.local`, `UPDATE users SET language='en'` (przywrócone na `pl` po
pomiarze), `localStorage.i18nextLng='en'`, 1440×900, motyw jasny, API 4175 + Vite 3195, baza
`consultify_kopia_final`. Zrzuty: `evidence/jezyk-pomiar-0809/`, surowe liczby `_wynik.json`.

| # | Moduł | Trasa | linii tekstu | POLSKICH linii |
| --: | --- | --- | --: | --: |
| 01 | Chat | `/chat` | 30 | 0 |
| 02 | My Work | `/my-work` | 32 | 0 |
| 03 | Interview | `/interview` | 32 | 0 |
| 04 | Tools | `/discovery-tools` | 317 | 2 |
| 05 | Assessment | `/assessment/overview` | 46 | 0 |
| 06 | Initiatives | `/initiatives` | 988 | **130** |
| 07 | Execution | `/execution` | 75 | 4 |
| 08 | Results | `/results/kpi` | 59 | 4 |
| 09 | Finance | `/finance` | 40 | 1 |
| 10 | Materials | `/presentations` | 182 | 12 |
| 11 | Audits | `/audit-programs` | 37 | 1 |
| 12 | Meeting | `/meetings` | 15 | 0 |
| 13 | Organization | `/organization/profile` | 113 | **23** |
| 14 | Admin Panel | `/admin` | 203 | 10 |
| 15 | Settings | `/settings/profile` | 82 | 0 |
| 16 | Partner Portal | `/partner` | 51 | 0 |
| | **RAZEM** | | **2 302** | **187** |

### Co widać OCZAMI na dwóch najgorszych zrzutach

**`06-initiatives-en.png`** — jeden ekran, cztery języki naraz:
* Menu 1: **„Inicjatywy · Plan · Obciążenie"** (polski) obok przycisku **„New initiative"** (angielski).
* Chipy: **„Wszystkie 97"** obok **„Pending approval 8"** i **„In execution 12"**.
* Nagłówki kolumn: **INICJATYWA · NASTĘPNA BRAMKA · GOTOWOŚĆ · WŁAŚCICIEL · NASTĘPNE DZIAŁANIE ·
  OCZEKIWANY EFEKT** — i pomiędzy nimi **AREA / AXIS** po angielsku.
* Komórki: **„Nie oceniono" · „Zaplanuj realizację" · „Brak opisu problemu" · „Harmonogram"**.
* Kolumna „oczekiwany efekt": **`UNKNOWN` / „Pewność: Nieznana"** — surowy enum sklejony
  z polskim zdaniem. Dokładnie ten defekt, który właściciel wskazał w zleceniu.

**`13-organization-en.png`** — lewa nawigacja po angielsku („Identity & Operating Model",
„Goals & Metrics"), całe centrum i prawy panel po polsku: **„Tożsamość" · „Dodaj źródło" ·
„Zapisz zmiany" · „Opublikuj wersję kontekstu" · „STAN DANYCH" · „BRANŻA" · „KOD BRANŻY (PKD)" ·
„Pola uzupełnione" · „Zatwierdzone fakty" · „Ostatnia aktualizacja / 1 dni temu"**
(przy okazji błąd liczby mnogiej).

### Rozdzielenie: etykieta interfejsu vs dane

Trafienia na ekranach 07/08/09/11/14 to w większości **dane pokazowe**, nie etykiety UI:
„Piotr Wiśniewski", „System wizyjny kontroli jakości", „Grupa Kapitałowa CD PROJEKT",
„Audyt gotowości do robotyzacji". To kategoria K6 — naprawa idzie planem danych, nie kodem.
Realne defekty etykiet UI widać na **06 Initiatives** i **13 Organization**.

---

## 5. Kategorie mierzone poza skanerem

### K6 — etykiety z danych (tylko policzone, naprawa = plan danych)

Baza `consultify_kopia_final` (lokalna kopia; liczy **tylko** rekordy z polskimi diakrytykami,
więc to **dolna granica**):

| Tabela.kolumna | rekordów | z polskimi diakrytykami |
| --- | --: | --: |
| `initiatives.title` | 173 | 29 |
| `tasks.title` | 453 | 83 |
| `kpis.name` | 25 | 12 |
| `assessments.name` | 14 | 2 |
| `audit_programs.name` | 3 | 1 |
| `users.job_title` | 1 436 | 0 |
| `organizations.name` | 331 | 0 |

Osobno: **enumy renderowane surowo** (`UNKNOWN`, `SOLVER-1:SELECTED`) — widoczne na zrzucie
`06-initiatives-en.png`. To defekt **kodu** (brak słownika), nie danych; wchodzi do paczki J17.

### K8 — maile transakcyjne i dokumenty generowane

* **8 szablonów `.hbs`** w `server/src/templates/emails/` — **wszystkie tylko po angielsku**,
  zero wariantu PL, zero rozgałęzienia po języku.
* **7 serwisów mailowych** (`emailService`, `welcomeEmailService`, `emailVerificationService`,
  `partnerEmailService`, `AlertEmailService`, `email/transactionalEmailLayout`, `utils/authEmail`) —
  **treść zaszyta po angielsku, ani jedno odwołanie do `language`/`locale`/`lng`**.
* Wyjątek pozytywny: `server/src/routes/auth.routes.ts` **czyta `users.language`** przy mailu
  resetu hasła (migracja `20260726_users_language_preference.sql`) — czyli wzorzec istnieje
  w jednym miejscu i nie został rozciągnięty na resztę.
* PDF/DOCX: `server/src/services/report/drdReportHtml.ts` ma etykiety zaszyte po polsku
  (`generated: 'Wygenerowano'`).

### K9 — język odpowiedzi AI

* Istnieje **gotowy mechanizm**: `server/src/services/ai/responseLanguage.ts`
  (`resolveResponseLanguage` treść → żądanie → `'en'`, plus `withLanguageInstruction`).
* **Woła go 4 miejsca** (`routes/my-work.routes.ts`, `services/ideaAIGeneratorService.ts`,
  `services/ideaAISuggestionsService.ts`, front `src/services/ideaAIGenerator.ts`)
  przy **95 plikach budujących `systemPrompt`**. Pokrycie ≈ **4 %**.
* Zamiast tego **31 miejsc ma zaszyte „po polsku" / „in Polish"** w prompcie
  (np. `narrativeEngine/linguisticRealization.ts`: „BEZWZGLĘDNIE WAŻNE: Całą treść pisz po POLSKU,
  niezależnie od języka faktów źródłowych") i **24 miejsca zaszyte „in English"**.
  **Skutek: użytkownik EN dostaje z generatorów treść po polsku, niezależnie od ustawienia.**

---

## 6. Czego to narzędzie NIE potrafi — czytaj przed użyciem liczby

1. **Heurystyka słownikowa, nie parser języka.** Krótkie etykiety bez diakrytyków i bez słowa
   ze słownika (np. „Portfel", „Definicja", „Realizacja") **nie są łapane**. Liczby K1def/K4pl
   to **dolna granica**, nie górna.
2. **Nie odróżnia tekstu widocznego od martwego.** Polski default w komponencie, którego nikt
   nie renderuje, liczy się tak samo jak ten na ekranie startowym.
3. **Nie widzi danych ani odpowiedzi serwera** — dlatego jest drugi skaner, wizualny.
   Ale i on jest ślepy tam, gdzie **moduł jest pusty**: My Work, Chat, Meeting miały 15–32 linie
   tekstu, bo nie mają rekordów. **Zero polskich linii tam nie znaczy „moduł czysty".**
4. **Nie wchodzi głębiej niż pierwszy ekran modułu** — zakładki, modale, kreatory, kebaby
   i podglądy są niezmierzone.
5. **Nie mierzy tłumaczeń `de/es/ar/ja`** (istnieją w `public/locales/`) — poza zakresem zlecenia.
6. **K5 świadomie zawężone** do `routes/ · middleware/ · validators/ · schemas/ · controllers/`.
   Błędy z `services/` i `repositories/` bywają łapane i nigdy nie docierają do UI; liczenie ich
   zawyżałoby pomiar. Odwrotnie: część zdań z `services/` **jednak** dochodzi — te są niepoliczone.
7. **K3a ≠ dziura w EN w każdej sytuacji.** Klucz może być martwy. Rozbicie K3aKLUCZ (429)
   wskazuje przypadki, w których na ekranie EN pojawi się surowy klucz — te są zawsze błędem.
8. Formy mnogie i18next (`_few`/`_many` w PL vs `_one`/`_other` w EN) są sprowadzane do bazy
   klucza, żeby nie generować fałszywych braków. To ukrywa **prawdziwe** braki form mnogich
   w EN — osobny, niezmierzony dług.

## 7. Jak powtórzyć pomiar

```bash
node scripts/i18n/pomiar-jezyka.mjs                          # raport per moduł
node scripts/i18n/pomiar-jezyka.mjs --modul Materials         # jeden moduł
node scripts/i18n/pomiar-jezyka.mjs --kategoria K1def --przyklady 30
node scripts/i18n/pomiar-jezyka.mjs --json > nowy-baseline.json
node scripts/i18n/pomiar-jezyka.mjs --baseline docs/program/JEZYK_EN_PL_20260908/baseline.json
# skan wizualny (wymaga stanowiska API 4175 + Vite 3195 i language='en' na koncie audytowym)
node scripts/i18n/pomiar-jezyka-ekrany.mjs
```
