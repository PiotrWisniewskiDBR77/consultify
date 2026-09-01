# POMIAR R5 — kontrast tekstu (text-navy-900 / text-white bez wariantu drugiego motywu)

Pomiar wykonany 2026-09-01, wyłącznie odczyt (`git branch --show-current` = `codex/m03-admin-20260824`,
zero commitów, zero zmian plików kodu — jedyny utworzony plik to ten dokument).

## 0. Weryfikacja liczby 221 — WYNIK: liczba jest ZANIŻONA, nie zawyżona

Uruchomiłem dokładnie podaną komendę:

```
grep -rn --include='*.tsx' -e 'text-navy-900' -e 'text-white' src/components/settings src/components/admin
```

Wynik: **449 linii**, nie 221. Komenda wykonała się poprawnie (nie jest to pustka-błąd składni zsh —
sprawdzone: zwróciła 449 realnych linii z treścią). Skąd rozbieżność — nie wiem, nie mam dostępu do tego,
jak policzono 221; mogę tylko podać własny, zweryfikowany wynik.

**Ale 449 to też nie jest właściwa liczba defektów** — zawiera duplikaty: `grep -e 'text-white'` łapie
też `dark:text-white` (bo to podciąg), czyli PRAWIDŁOWO sparowany wariant ciemny zlicza się jako "wystąpienie
text-white". Po poprawce na granicę tokenu (dopasowanie `text-navy-900`/`text-white` jako całego
członu klasy Tailwind, nie jako podciągu wewnątrz `dark:text-...`) w `src/components/settings` +
`src/components/admin`:

**351 realnych wystąpień bazowej klasy** (nie licząc samego `dark:text-*`).

## 1. KRYTYCZNA KOREKTA LOKALIZACJI — 3 z 4 potwierdzonych defektów są POZA zakresem settings/admin

Sprawdziłem realne ścieżki plików z Twojej listy:

```
find src/components -iname 'SettingsCard.tsx' -o -iname 'SettingsToggle.tsx' -o -iname 'AuditLogViewer.tsx'
→ src/components/AISettings/AuditLogViewer.tsx
→ src/components/AISettings/SettingsToggle.tsx
→ src/components/AISettings/SettingsCard.tsx
→ src/components/governance/AuditLogViewer.tsx   (inny plik, ta sama nazwa)
```

`src/components/AISettings/` to **osobny katalog**, siostrzany wobec `src/components/settings/`, i **nie
wchodzi** w zakres `src/components/settings src/components/admin`, który podałeś jako komendę startową.
Innymi słowy: 3 z 4 potwierdzonych defektów (SettingsCard, SettingsToggle, AuditLogViewer) leżą fizycznie
POZA katalogami, które kazałeś przeszukać. Rozszerzyłem pomiar o `src/components/AISettings/` osobno
(patrz sekcja 3) — bez tego przeoczylibyśmy właśnie te pliki.

`SettingsToggle.tsx` — literalna linia to **58**, nie 56 (drobna rozbieżność, treść się zgadza:
`text-navy-900` bez wariantu w etykiecie przełącznika).

## 2. Metodologia klasyfikacji A/B/C — co faktycznie zweryfikowałem

Nie da się rzetelnie sklasyfikować 3427 wystąpień (351 + 9 + 3076, patrz niżej) czytając każdą linię
z osobna w tym budżecie. Zrobiłem to w trzech warstwach, każda oznaczona w tabeli:

1. **Automatyczna heureza tła** — skrypt szuka najbliższego tokenu `bg-*`/`dark:bg-*` w tym samym bloku
   komponentu (od wystąpienia w górę do najbliższej granicy `const X =`/`function X`), i sprawdza czy
   token jest ZMIENNY motywowo.
2. **Potwierdzenie źródłowe tokenów** — sprawdziłem realne wartości CSS custom properties w
   `src/index.css`:
   - `--c-surface`: `#ffffff` w jasnym (linia 48) → `#0f172a` w ciemnym (linia 270) — **realnie zmienia się z bieli na prawie-czerń**
   - `--c-surface-raised`: `#f8fafc` jasny (linia 50) → `#15213b` ciemny (linia 272)
   - `--c-accent-soft`: `rgba(133,24,47,0.08)` jasny (linia 70) → `rgba(200,50,74,0.14)` ciemny (linia 295) — półprzezroczysty, w ciemnym motywie ciemniejszy w efekcie
   - Kontrast: `bg-brand` (`#85182F`, tailwind.config.js:289) i skala `bg-navy-800/900` to STAŁE kolory
     (nie CSS-var), więc `text-white` na nich jest poprawne w OBU motywach → grupa B.
   - `--c-danger`: `#e80538` jasny / `#ed5565` ciemny (index.css:111,318) — obie nasycone czerwienie,
     kontrast z białym OK w obu → grupa B mimo że token jest "motywowy".
3. **Ręczne otwarcie pliku (sed/Read)** — zrobiłem to dla **48 z 85** niepewnych wystąpień w
   settings+admin+AISettings (te oznaczone `TAK` w kolumnie "ręcznie otwarte?"). Resztę (37) oznaczyłem
   przez analogię do dokładnie tego samego, potwierdzonego wzorca (najbliższy token = `bg-c-surface` lub
   `bg-c-surface-raised`) — **NIE otworzyłem tych linii pojedynczo**, klasyfikacja A wynika z tego, że
   wzorzec jest identyczny z liniami, które otworzyłem i potwierdziłem. Oznaczone `nie (auto, wzorzec)`.

### Odkrycie systemowe: trzecia współdzielona przyczyna

Poza `SettingsCard.tsx` i `SettingsToggle.tsx` (już znanymi), znalazłem **`SettingsSection.tsx`**
(`src/components/settings/shared/SettingsSection.tsx:90`) — kontener używany przez **32 inne pliki**
(`grep -rl SettingsSection src --include='*.tsx' | wc -l` = 32+1). Jego tło to:

```
'bg-c-surface-raised rounded-xl overflow-hidden'   // SettingsSection.tsx:90
```

`bg-c-surface-raised` = jasne `#f8fafc` / ciemne `#15213b` (patrz wyżej). Każdy plik, który renderuje
nagłówek `text-white` jako dziecko `<SettingsSection>`, jest niewidoczny w motywie JASNYM (biały tekst
na `#f8fafc`, prawie-biel). Potwierdziłem to dla: `AIAutomationSettings.tsx:197`, `AIPrivacySettings.tsx:150`,
`AIAutoCompleteSettings.tsx:169,184`, `KeyboardShortcutsSettings.tsx:448,514`,
`AIModelParametersSettings.tsx:233,301`, `VoiceSettings.tsx:268` — wszystkie importują `SettingsSection`
z `./shared` i renderują `text-white` bez własnego tła.

## 3. Tabela: settings + admin + AISettings (360 wystąpień razem)

Legenda grupy: **A** = defekt potwierdzony (tło zmienia się z motywem, tekst nie) · **B** = poprawne
(tło stałe) · **C** = niepewne · `PAIRED_OK` = w tej samej linii jest już właściwy wariant `dark:text-*`
(nie defekt — pominięte z tabeli szczegółowej, policzone tylko w podsumowaniu).

### 3a. Grupa A — potwierdzone defekty (65 z 360)

| Plik:linia | klasa | tło (dowód) | który motyw psuje | ręcznie otwarte? |
|---|---|---|---|---|
| AISettings/AuditLogViewer.tsx:174 | text-white | brak własnego tła w pliku; **potwierdzone przez Ciebie wzrokowo** jako defekt w tickecie | JASNY | TAK (dowód: obserwacja właściciela, nie plik) |
| AISettings/AuditLogViewer.tsx:235 | text-white | `bg-c-surface` (pole wyszukiwania) | JASNY | TAK |
| AISettings/AuditLogViewer.tsx:257 | text-white | `bg-c-surface` (select filtra) | JASNY | TAK |
| AISettings/AuditLogViewer.tsx:322 | text-white | `bg-c-surface` w pobliżu; **potwierdzone przez Ciebie wzrokowo** | JASNY | wzorzec (nie linia; potwierdzone przez Ciebie) |
| AISettings/ProactivitySelector.tsx:179 | text-navy-900 | `bg-c-surface` w pobliżu (nagłówek "AI Proactivity") | ciemny (wzorzec) | nie (wzorzec) |
| AISettings/ProactivitySelector.tsx:240 | text-navy-900 | `bg-c-surface-raised` karta niewybrana | CIEMNY | TAK |
| AISettings/SettingsCard.tsx:74 | text-navy-900 | `bg-c-surface-raised dark:bg-gradient-to-br` (para jasny/ciemny) — **potwierdzony defekt z ticketu** | CIEMNY | TAK |
| AISettings/SettingsToggle.tsx:58 | text-navy-900 | brak tła w pliku (komponent współdzielony, 18 konsumentów) — **potwierdzone przez Ciebie wzrokowo jako defekt** | CIEMNY | TAK (dowód: obserwacja właściciela) |
| admin/commandCenter/CommandCenterRetentionTab.tsx:286 | text-white | `bg-c-surface` w pobliżu | wzorzec | nie (wzorzec) |
| settings/AIAutoCompleteSettings.tsx:169 | text-white | dziecko `<SettingsSection>` (bg-c-surface-raised) | JASNY | TAK |
| settings/AIAutoCompleteSettings.tsx:184 | text-white | dziecko `<SettingsSection>` | JASNY | TAK |
| settings/AIAutomationSettings.tsx:197 | text-white | dziecko `<SettingsSection>` (SettingsSection.tsx:90) | JASNY | TAK |
| settings/AIModelParametersSettings.tsx:233 | text-white | dziecko `<SettingsSection>` | JASNY | TAK |
| settings/AIModelParametersSettings.tsx:301 | text-white | dziecko `<SettingsSection>` | JASNY | TAK |
| settings/AIPrivacySettings.tsx:150 | text-white | dziecko `<SettingsSection>` | JASNY | TAK |
| settings/AIUsageDashboard.tsx:464 | text-white | `bg-c-surface` (tooltip) | JASNY | TAK |
| settings/AdvancedSettings.tsx:324 | text-white | `bg-c-surface` w pobliżu | wzorzec | nie (wzorzec) |
| settings/BioAboutSection.tsx:135 | text-navy-900 | `bg-c-surface-raised` (inputClass) | CIEMNY | TAK |
| settings/BioAboutSection.tsx:140,147 | text-navy-900 | `bg-c-surface` w pobliżu | wzorzec | nie (wzorzec) ×2 |
| settings/BrandKitGovernanceSettings.tsx:225,228,236,458,476 | text-navy-900 | `bg-c-surface`/`bg-c-surface-raised` w pobliżu | wzorzec | nie (wzorzec) ×5 |
| settings/CloudDataSettings.tsx:270 | text-navy-900 | `bg-c-surface` w pobliżu | wzorzec | nie (wzorzec) |
| settings/ConnectedAccounts.tsx:66 | text-white | `bg-c-surface` w pobliżu | wzorzec | nie (wzorzec) |
| settings/DataPrivacySettings.tsx:185,206,220,361 | text-navy-900 | `bg-c-surface`/`bg-c-accent-soft` w pobliżu | wzorzec | nie (wzorzec) ×4 |
| settings/EmailCommunicationSettings.tsx:126 | text-navy-900 | `bg-c-surface-raised` (inputClass) | CIEMNY | TAK |
| settings/EmailCommunicationSettings.tsx:131,225,278,299,384 | text-navy-900 | `bg-c-surface`/`bg-c-accent-soft` w pobliżu | wzorzec | nie (wzorzec) ×5 |
| settings/KeyboardShortcutsSettings.tsx:448,514 | text-white | dziecko `<SettingsSection>` | JASNY | TAK ×2 |
| settings/OrganizationProfileForm.tsx:456 | text-navy-900 | `bg-c-surface-raised` stałe (nie tylko hover) | CIEMNY | TAK |
| settings/OrganizationSettings.tsx:199,217,296,337,342,543 | text-navy-900 | `bg-c-surface` w pobliżu | wzorzec | nie (wzorzec) ×6 |
| settings/OrganizationSettings.tsx:238 | text-navy-900 | `bg-c-surface-raised` (input pola nazwy) | CIEMNY | TAK |
| settings/OrganizationSettings.tsx:608 | text-navy-900 | `hover:bg-c-surface-raised` wiersz członka | CIEMNY (hover) | TAK |
| settings/PerformanceSettings.tsx:120,142,156,292 | text-navy-900 | `bg-c-surface`/`bg-c-accent-soft` w pobliżu | wzorzec | nie (wzorzec) ×4 |
| settings/ProfileSettings.tsx:1006,1014 | text-white | `bg-white` bez pary dark: | wzorzec | nie (wzorzec) ×2 |
| settings/ProfileSurveyNudge.tsx:379 | text-white | `bg-c-accent-soft` (para wykryta) | wzorzec | nie (wzorzec) |
| settings/ProfileVisibilitySettings.tsx:121,207,296,320 | text-navy-900 | `bg-c-surface`/`bg-c-accent-soft` w pobliżu | wzorzec | nie (wzorzec) ×4 |
| settings/QuietHoursSettings.tsx:100,102,124,160 | text-navy-900 | `bg-c-surface` w pobliżu | wzorzec | nie (wzorzec) ×4 |
| settings/VoiceSettings.tsx:268 | text-white | dziecko `<SettingsSection>` | JASNY | TAK |
| settings/modules/GeneralPreferencesSettings.tsx:175 | text-white | `bg-c-surface hover:bg-c-surface` (przycisk Save) — tło ZAWSZE białe w jasnym | JASNY (zawsze w tym motywie) | TAK |
| settings/security/WebAuthnSettings.tsx:339,360 | text-white | `bg-c-surface` (pole input) | JASNY | TAK / wzorzec |

**Uczciwie**: wiersze oznaczone "wzorzec" (37 z 65) NIE zostały otwarte pojedynczo — klasyfikacja A
wynika z identycznego automatycznie wykrytego najbliższego tokenu tła (`bg-c-surface` lub
`bg-c-surface-raised`), którego zmienność motywową potwierdziłem źródłowo w `src/index.css` i
zweryfikowałem ręcznie na kilkunastu innych liniach z tym samym wzorcem. Ryzyko błędu: niskie dla tego
konkretnego tokenu, ale niezerowe — zdarza się, że najbliższy wykryty token należy do rodzeństwa (sibling),
nie do faktycznego rodzica z tekstem (patrz sekcja 5, ograniczenia).

### 3b. Grupa B — poprawne (155 z 360, zbiorczo)

Reprezentatywne, ręcznie zweryfikowane przykłady:
- `bg-brand` (`#85182F`, stały kolor tailwind) — przyciski/plakietki, poprawne w obu motywach.
  Przykład: `CloudDataSettings.tsx:188`.
- `bg-navy-900/95`, `bg-black/50` — stałe ciemne nakładki/tooltipy, niezależne od motywu.
  Przykład: `FeatureFlagsDevToolsToggleButton.tsx:49`, `AvatarPhotoSettings.tsx:227`.
- `bg-c-danger` (`#e80538`/`#ed5565`) — mimo że to token motywowy, obie wartości to nasycone
  czerwienie, kontrast z białym OK w obu motywach. Przykład: `AdminBreakGlassPanel.tsx:155`,
  `AdminConfigurationVersionsPanel.tsx:349`.
- Kolorowe przyciski (`bg-pink-600`, `bg-emerald-600`, `bg-blue-600` itd.) — stałe, poprawne.

3 wystąpienia oznaczone **B?** (niepewne, prawdopodobnie poprawne, ale gradient z jednym zmiennym
stopem koloru nie w 100% jednoznaczny bez zrzutu ekranu):
`AvatarPhotoSettings.tsx:218`, `ModelSelector.tsx:215`, `VoiceSettingsPanel.tsx:261`,
`ai/AIBehaviorSettings.tsx:327`.

1 wystąpienie oznaczone **B\*** — poprawne w stanie normalnym, ale defekt w stanie DISABLED:
`CloudDataSettings.tsx:243` — przycisk „Connect” ma `bg-brand` gdy aktywny (OK), ale
`disabled:bg-c-surface-raised` (jasne `#f8fafc`) z tym samym `text-white` gdy wyłączony → w motywie
JASNYM, gdy przycisk jest disabled, biały tekst na prawie-białym tle.

### 3c. Grupa C — niepewne (6 z 360), z dokładnym opisem czego brakuje

| Plik:linia | klasa | czego brakuje |
|---|---|---|
| settings/CloudDataSettings.tsx:181 | text-navy-900 | nagłówek h3 bez własnego tła w tym pliku; trzeba sprawdzić tło strony/karty-rodzica, która renderuje ten komponent (poza zakresem pojedynczego pliku) |
| settings/OrganizationSettings.tsx:272 | text-navy-900 | j.w. — nagłówek h2 bez własnego tła |
| settings/QuickProfileCard.tsx:124 | text-white | `AvatarFallback` z gradientem `from-c-accent-soft to-c-accent-soft` (oba stopnie to półprzezroczysty crimson) — wymaga realnego zrzutu ekranu, nie da się ustalić z samego koloru rgba czy kontrast jest OK |
| settings/VoiceSettingsPanel.tsx:264 | text-navy-900 | nagłówek h3, komponent NIE używa `SettingsSection`/`SettingsCard`; trzeba sprawdzić, jaki komponent-rodzic go osadza |
| settings/modules/PersonalAnalyticsModule.tsx:104 | text-white | kolor tła ikony pochodzi z propa `color` przekazywanego przez wywołującego — nie do ustalenia bez sprawdzenia wszystkich wywołań `<StatCard color=... />` |
| AISettings/SettingsToggle.tsx:58 (por. sekcja 3a) | — | z samego pliku byłoby C (tło ustawia rodzic); podniesione do A wyłącznie dzięki Twojemu potwierdzeniu wzrokowemu z ticketu |

### 3d. Podsumowanie liczbowe — settings+admin+AISettings

| Obszar | razem (baza, bez dark:-prefiksu) | A | B (w tym B?/B\*) | C | już poprawne (PAIRED_OK) |
|---|---|---|---|---|---|
| `src/components/settings` + `src/components/admin` | 351 | 59 | 153 + 3(B?) + 1(B\*) = 157 | 5 | 130 |
| `src/components/AISettings` (poza zakresem Twojej komendy, dodane bo tu leżą 3/4 potwierdzonych błędów) | 9 | 6 | 1 + 1(B?) = 2 | 1 | 0 |
| **RAZEM (rdzeń pomiaru)** | **360** | **65** | **159** | **6** | **130** |

## 4. Zasięg „cała reszta” — src/components + src/views poza wyżej

**UWAGA UCZCIWOŚCIOWA: dla tego obszaru NIE zrobiłem manualnej weryfikacji pojedynczych linii.** To,
co niżej, to wyłącznie automatyczna heureza (ten sam skrypt co w sekcji 3, bez ręcznego otwierania plików)
— traktuj to jako pierwsze przesianie do dalszej pracy, nie jako gotową klasyfikację.

Poprawka techniczna po drodze: pierwszy przebieg policzył **3130** wystąpień, ale 54 z nich to
**artefakt pomiaru**, nie realne wystąpienia — `src/components/admin` i `src/components/Admin` to,
na tym systemie plików (case-insensitive APFS), **ten sam fizyczny katalog** (`ls -di` obu ścieżek
zwraca identyczny inode `462360537`; `git ls-files` śledzi go tylko pod jedną pisownią). Mój skrypt
przeszedł go dwa razy pod dwiema pisowniami. Po odjęciu duplikatu:

**3076 wystąpień** w `src/components` + `src/views` poza settings/admin/AISettings.

Automatyczny rozkład (NIE zweryfikowany ręcznie):
- `PAIRED_OK` (już mają `dark:text-*` w tej samej linii): 1308
- `B` (wzorzec: stałe tło): 1105
- `A?` (wzorzec: tło zmienne, brak pary) — **kandydaci na defekt, nieotwarci**: 321
- `C` (niejednoznaczne automatycznie): 342

### Pliki współdzielone z największą liczbą wystąpień (surowa częstość, sekcja żądana przez Ciebie)

To NIE jest to samo co „liczba potwierdzonych defektów A” — to surowa liczba wystąpień
`text-navy-900`/`text-white` w pliku. Duże pliki jednorazowych ekranów (np. `SynthesisSummary.tsx`)
mieszają się tu z realnie współdzielonymi komponentami:

| # wystąpień | plik |
|---|---|
| 32 | src/views/ContextBuilder/modules/SynthesisSummary.tsx |
| 29 | src/components/assessment/reports/templates/ADMAReportTemplate.tsx |
| 29 | src/components/assessment/reports/templates/SIRIReportTemplate.tsx |
| 29 | src/views/legal/ContactView.tsx |
| 27 | src/components/Import/UnifiedImportWizard.tsx |
| 24 | src/components/PMO/CharterBuilder.tsx |
| 21 | src/components/assessment/AssessmentQualityReviewPanel.tsx |
| 20 | src/components/assessment/ReportEditor.tsx |
| 18 | src/components/Portfolio/InitiativeSidePanel.tsx |
| 18 | src/views/PublicLandingPage.tsx |
| 17 | src/components/Landing/AnnaAssistantWidget.tsx |
| 17 | src/components/Execution/CorrectiveActions.tsx |
| 17 | src/components/Economics/BenefitsTrackingDashboard.tsx |
| 16 | src/components/Economics/ExcelImportWizard.tsx |
| 16 | src/components/Help/VideoPlayer.tsx |
| 16 | src/views/WelcomeView.tsx |

**Żadnego z powyższych plików nie sprawdziłem ręcznie.** Nie wiem, ile z tych wystąpień to realne A,
B czy C — to lista kandydatów do dalszego pomiaru, nie wynik.

## 5. Prawdziwie WSPÓŁDZIELONE komponenty (importowane przez wiele ekranów) — naprawiać PIERWSZE

To jest inna oś niż „lista plików z największą liczbą wystąpień" wyżej — sprawdziłem faktyczną liczbę
importujących (`grep -rl` po całym `src`), bo to ona decyduje, ile ekranów naprawia jedna poprawka:

| Plik | liczba importujących plików | potwierdzone A w nim | uwaga |
|---|---|---|---|
| `src/components/settings/shared/SettingsSection.tsx` | **32** | 0 (samo w sobie) | PRZYCZYNA SYSTEMOWA — sama nie ma defektu, ale jej `bg-c-surface-raised` (linia 90) tłumaczy defekty w co najmniej 8 plików-dzieci (patrz sekcja 2) |
| `src/components/AISettings/SettingsToggle.tsx` | 18 | 1 (linia 58, potwierdzone przez Ciebie) | etykiety przełączników, niewidoczne w ciemnym |
| `src/components/AISettings/SettingsCard.tsx` | 5 | 1 (linia 74, potwierdzony błąd z ticketu) | nagłówki kart, niewidoczne w ciemnym |
| `src/components/AISettings/AuditLogViewer.tsx` | 3 | 3-4 (174,235,257,322) | log audytu, niewidoczny w jasnym |

**Rekomendacja kolejności naprawy** (jedna poprawka zdejmuje najwięcej ekranów):
1. `SettingsSection.tsx` nie wymaga zmiany tła, ale KAŻDY plik renderujący w nim `text-white` bez
   `dark:text-navy-900` (lista w sekcji 3a, wpisy „dziecko `<SettingsSection>`") — 8 potwierdzonych,
   prawdopodobnie więcej wśród 37 „wzorzec" nieotworzonych pojedynczo.
2. `SettingsToggle.tsx:58` — 18 konsumentów, jedna linia.
3. `SettingsCard.tsx:74` — 5 konsumentów, jedna linia.
4. `AuditLogViewer.tsx` — 3 konsumentów, 4 linie.
5. Pozostałe pojedyncze ekrany z grupy A (głównie `OrganizationSettings.tsx` 8×, `EmailCommunicationSettings.tsx` 6× — ale to pliki JEDNORAZOWE, nie współdzielone, więc niższy priorytet mimo wysokiej liczby wystąpień).

## 6. Czego NIE zmierzyłem (uczciwie)

- Żadnej z 3076 linii w „całej reszcie" (sekcja 4) nie otworzyłem ręcznie — tylko automatyczna heureza.
- 37 z 65 potwierdzeń A w rdzeniu pomiaru (sekcja 3a) to klasyfikacja przez analogię do wzorca, nie
  pojedynczy odczyt linii — oznaczone „nie (wzorzec)" w tabeli.
- Nie renderowałem żadnego ekranu w przeglądarce — cała klasyfikacja jest statyczna (z tekstu plików +
  wartości CSS w `src/index.css`/`tailwind.config.js`), nie wizualna. Zgodnie z zasadą „przyrząd kłamie,
  a oko przywyka" — to WCIĄŻ wymaga faktycznego zrzutu ekranu w obu motywach przed uznaniem którejkolwiek
  linii za ostatecznie naprawioną.
- Nie sprawdziłem, czy `src/components/governance/AuditLogViewer.tsx` (inny plik o tej samej nazwie,
  znaleziony w sekcji 1) ma ten sam defekt — nie był częścią żadnego zakresu, zasygnalizowany tylko jako
  ciekawostka do sprawdzenia osobno.
- Nie sprawdziłem `src/views` w tej samej głębi co `src/components` dla przyczyn systemowych (odpowiednik
  `SettingsSection`) — możliwe, że są tam analogiczne współdzielone powłoki z tym samym wzorcem.
