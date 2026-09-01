# POMIAR: luka i18n `pl` vs `en` — `translation.json`

**Zakres:** czysto pomiarowe, read-only. Nie zmieniono żadnego pliku kodu.
**Worktree:** `/private/tmp/m03`, gałąź `codex/m03-admin-20260824`.
**Punkty w czasie pomiaru:** start 2026-09-01 14:21:22 CEST, koniec (kontrola stabilności) 2026-09-01 14:28:33 CEST.
Plik `pl` był w stanie roboczym zmodyfikowany (`git status` pokazuje `M public/locales/pl/translation.json` —
niescommitowane zmiany na dysku), więc liczby odzwierciedlają aktualny stan PLIKU NA DYSKU w worktree, nie
ostatni commit.

Metoda liczenia liści: rekurencyjne zejście po JSON, licząc każdy klucz-string (i klucz wskazujący na pustą
tablicę/obiekt jako 1) jako pojedynczy „liść". Elementy tablic (np. `landing.aiOs.items[0].title`) liczone
są jako osobne liście z indeksem w nawiasie kwadratowym w nazwie klucza.

## 1. Rozbieżność w liczbie kluczy — TRZY różne pomiary, trzy różne liczby

| Pomiar | pl | en | różnica |
|---|---|---|---|
| Mój (2026-09-01 14:21:22 CEST) | **34 414** | **32 341** | **2 073** |
| Twój wcześniejszy (podany w zleceniu) | 34 390 | 32 317 | 2 073 |
| Innego robotnika (podany w zleceniu) | 33 539 | 31 610 | 1 929 |

Różnica między moim pomiarem a Twoim poprzednim jest niewielka (24 kluczy w każdym pliku) — mieści się w zakresie
normalnej edycji w toku (kilka commitów/zmian roboczych między pomiarami). Różnica względem pomiaru
„innego robotnika" (~875 kluczy) jest dużo większa i prawdopodobnie odzwierciedla stan sprzed kilku
sesji/commitów wstecz, a nie błąd metody — obie metody dają tę samą **różnicę bezwzględną 2073** w moim
i Twoim pomiarze, co sugeruje spójną metodologię licząca liście-stringi.

Kontrola stabilności o 14:28:33 CEST (7 minut później): **pl = 34 414, en = 32 341 — bez zmian.** W oknie
mojego pomiaru pliki nie były edytowane równolegle.

## 2. Rozkład brakujących w `en` (obecne w `pl`, brak w `en`) — 2089 kluczy razem

Z 2089 kluczy obecnych tylko w `pl`: **1931 to zwykłe klucze-stringi**, **158 to elementy tablic**
(`something.items[N].pole` — osobna kategoria, patrz sekcja 5).

Rozkład po pierwszym segmencie klucza (malejąco, tylko klucze zwykłe + tablicowe razem = 2089):

| segment | liczba |
|---|---|
| presentations | 440 |
| finance | 298 |
| billing | 153 |
| security | 145 |
| documentStudio | 142 |
| partner | 134 |
| v8 | 129 |
| vector | 92 |
| excele | 74 |
| rap | 73 |
| feedback | 49 |
| valuation | 49 |
| notebook | 47 |
| assessment | 42 |
| execution | 40 |
| landing | 27 |
| pricing | 22 |
| myWork | 21 |
| interview | 20 |
| demo | 16 |
| myWorkMindmap | 12 |
| mels | 9 |
| myWorkTable | 8 |
| settings | 8 |
| admin | 6 |
| canvas | 6 |
| ideas | 6 |
| myWorkIdeas | 6 |
| notificationDropdown | 4 |
| sharedComponents | 4 |
| vault | 3 |
| shared | 2 |
| decisions | 1 |
| sidebar | 1 |
| **suma** | **2089** |

`security` i `vector` (razem 237 kluczy) to niemal wyłącznie tablice ze stron marketingowych
(`security.pillars.items`, `vector.pipeline.steps` itd. — patrz sekcja 5), nie osobne teksty UI.

## 3. Klasyfikacja użycia w `src/` — metoda i twarde liczby

Narzędzie: skrypt Python skanujący wszystkie pliki `.ts`/`.tsx` w `src/` (4833 plików) pod kątem wywołań
`t(...)`, z parserem odpornym na wieloliniowe wywołania i trzeci argument (obiekt interpolacji, np.
`t('key', 'default', { count })`). **Pierwsza wersja skryptu miała błąd regex** (odwołanie do złej grupy
przechwytującej przy dopasowywaniu cudzysłowu zamykającego), który przy wywołaniach z trzecim argumentem
powodował wyłapanie tekstu z kolejnych, niepowiązanych linii kodu jako rzekomej wartości domyślnej. Błąd
wykryty ręczną weryfikacją jednego wpisu (`billing.analytics.activeSubscriptions` — wartość „domyślna"
ciągnęła się przez 9 linii aż do zupełnie innego wywołania `t()`). Naprawiono (parser ręczny z liczeniem
głębi nawiasów zamiast czystego regexu) i przeliczono wszystko od nowa — **liczby poniżej pochodzą z
poprawionej wersji**, potwierdzonej na tym konkretnym przypadku.

Dla 1931 zwykłych kluczy (bez elementów tablic):

| kategoria | liczba | opis |
|---|---:|---|
| **SAFE_EN** | 1302 | statyczne dopasowanie `t('klucz', 'tekst')`, drugi argument to string wyglądający na angielski |
| **SAFE_BUT_POLISH_DEFAULT** | 134 | statyczne dopasowanie, ALE drugi argument to literał zawierający polskie znaki diakrytyczne (ą/ć/ę/ł/ń/ó/ś/ź/ż) — user EN zobaczy POLSKI tekst, nie angielski i nie surowy klucz |
| **SAFE_EXPR** | 22 | statyczne dopasowanie, drugi argument to wyrażenie JS (zmienna/property), nie literał — np. `t(\`prefix.${x}\`, x)` |
| **DANGEROUS_RAW** (surowy klucz na ekranie) | **0** | statyczne dopasowanie znalezione, ale ZEROWY drugi argument |
| UNDETERMINED | 187 | klucz nie ma statycznego dopasowania, ale pasuje do prefiksu dynamicznego wywołania `t(\`prefix.${zmienna}\`)` — nie da się rozstrzygnąć bez śledzenia runtime |
| UNUSED | 286 | brak jakiegokolwiek dopasowania (statycznego ani dynamicznego z niepustym prefiksem) w `src/` |

**Suma kontrolna:** 1302+134+22+0+187+286 = 1931. Zgadza się.

### Ważne zastrzeżenie uczciwościowe — czego NIE rozstrzygnąłem

- **263 wywołania `t(zmienna)`** w całym `src/` używają klucza całkowicie z JS-owej zmiennej (bez żadnego
  literału ani nawet fragmentu szablonu) — te są matematycznie nierozstrzygalne statycznie i NIE są ujęte
  w powyższej tabeli w żaden sposób poza tym, że mogą tłumaczyć część z 286 kluczy „UNUSED".
- **448 wywołań dynamicznych z PUSTYM prefiksem statycznym** (np. `t(\`${prefix}.title\`)`, gdzie `prefix`
  jest zmienną od samego początku) — również nierozstrzygalne, wykluczone z liczenia UNDETERMINED (żeby nie
  zawyżać sztucznie „dopasowań" każdego klucza do każdego takiego wywołania).
- Dla WSZYSTKICH 187 kluczy UNDETERMINED sprawdziłem: przynajmniej jedno pasujące wywołanie dynamiczne ma
  jakiś drugi argument (literał lub wyrażenie) — **zero przypadków z zerowym fallbackiem** wśród nich też.
  Nie znaczy to, że są bezpieczne — oznacza, że nie znalazłem dowodu na to, że SĄ niebezpieczne.
- **286 kluczy „UNUSED"** to martwe wpisy w słowniku ALBO klucze osiągane przez jeden z dwóch
  nierozstrzygalnych mechanizmów powyżej. Nie twierdzę, że są martwe — twierdzę, że nie znalazłem wołania.

## 4. Wynik dla żądanej klasyfikacji GROŹNE (surowy klucz na ekranie)

**Nie znalazłem ani jednego statycznie potwierdzonego przypadku „surowy klucz i18n dosłownie na ekranie".**
To zaskakujący, ale realny wynik — sprzeczny z hipotezą ze zlecenia. Powód: w tej bazie kodu panuje bardzo
konsekwentny zwyczaj podawania DRUGIEGO argumentu do `t()` (czy to literału, czy zmiennej z sensowną
wartością), nawet przy kluczach dynamicznych. Sprawdziłem to na 1931 zwykłych kluczach + 187 kluczach
osiąganych dynamicznie = 2118 z 2089 kluczy tylko-w-pl (niektóre dynamiczne dopasowują się do więcej niż
jednego wzorca).

### Prawdziwy, potwierdzony problem: 134 przypadki „SAFE_BUT_POLISH_DEFAULT"

To NIE jest scenariusz z zamówienia (surowy klucz), ale jest to **realny, zmierzony defekt tej samej
rodziny**: użytkownik z interfejsem angielskim (`en` bez wpisu, fallback `en:['en']` — brak dalszego
fallbacku) zobaczy **polski tekst zaszyty jako "wartość domyślna" w kodzie**, bo autor komponentu napisał
`t('klucz', 'polski tekst')` zamiast `t('klucz', 'English text')`. Efekt dla użytkownika identyczny w
duchu do zgłoszenia: interfejs EN pokazuje język niepasujący do wybranego.

Rozkład 134 przypadków po segmencie: excele 37, partner 25, billing 23, rap 19, documentStudio 15,
valuation 5, v8 4, presentations 3, finance 2, assessment 1.

### 20 przykładów SAFE_BUT_POLISH_DEFAULT w widocznych miejscach (nagłówki/etykiety/komunikaty)

| klucz | plik:linia | polski tekst (= to, co zobaczy user EN) |
|---|---|---|
| `documentStudio.tri.heading` | `src/components/DocumentStudio/DocumentStudioView.tsx:959` | „Jak chcesz zacząć dokument?" |
| `documentStudio.tri.subheading` | `src/components/DocumentStudio/DocumentStudioView.tsx:960` | „Wybierz tryb — wszystkie trzy są równorzędne." |
| `documentStudio.tri.aiDesc` | `src/components/DocumentStudio/DocumentStudioView.tsx:973` | „Opisz dokument — Studio zaplanuje strukturę i pierwszą wersję." |
| `documentStudio.tri.templateDesc` | `src/components/DocumentStudio/DocumentStudioView.tsx:980` | „Zacznij od zatwierdzonego szablonu i dostosuj treść." |
| `documentStudio.view.backToLibrary` | `src/components/DocumentStudio/DocumentStudioView.tsx:1021` | „Wróć do Biblioteki wzorców" |
| `documentStudio.view.artifactNotFound` | `src/components/DocumentStudio/DocumentStudioView.tsx:338` | „Nie znaleziono tego dokumentu. Mógł zostać usunięty albo link prowadzi gdzie indziej." |
| `documentStudio.view.artifactLoadFailedGeneric` | `src/components/DocumentStudio/DocumentStudioView.tsx:343` | „Nie udało się załadować dokumentu. Spróbuj ponownie za chwilę." |
| `documentStudio.outline.saveFailed` | `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx:2318` | „Nie udało się zapisać struktury." |
| `documentStudio.panel.contextTools` | `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx:3606` | „Narzędzia dokumentu" |
| `documentStudio.panel.chipQaReview` | `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx:2761` | „QA i przegląd" |
| `documentStudio.aiEntry.placeholderTitle` | `src/components/DocumentStudio/DocumentStudioAiEntryPanel.tsx:156` | „Twój dokument pojawi się tutaj" |
| `documentStudio.aiEntry.placeholderHint` | `src/components/DocumentStudio/DocumentStudioAiEntryPanel.tsx:159` | „Opisz w oknie obok, jaki dokument potrzebujesz — Teresa zaplanuje strukturę." |
| `billing.analytics.customerValueMetrics` | `src/components/billing/SubscriptionAnalytics.tsx:537` | „Wskaźniki wartości klienta" |
| `billing.analytics.arrLabel` | `src/components/billing/SubscriptionAnalytics.tsx:285` | „Roczny przychód cykliczny (ARR)" |
| `billing.analytics.mrrLabel` | `src/components/billing/SubscriptionAnalytics.tsx:253` | „Miesięczny przychód cykliczny (MRR)" |
| `billing.analytics.churnRate` | `src/components/billing/SubscriptionAnalytics.tsx:305` | „Wskaźnik rezygnacji" |
| `billing.analytics.revenueByPlan` | `src/components/billing/SubscriptionAnalytics.tsx:369` | „Przychód według planu" |
| `billing.analytics.loadError` | `src/components/billing/SubscriptionAnalytics.tsx:169` | „Nie udało się załadować danych analitycznych" |
| `billing.usage.resetsOn` | `src/components/billing/UsageMeters.tsx:174` | „Limit odnowi się {{date}}" |
| `assessment.preview.aiPlanned` | `src/components/assessment/AssessmentHub.tsx:2254` | „Planowane — wymaga klucza dostawcy AI, którego nie ma w tym środowisku." |

Wszystkie powyższe znajdują się w widocznych miejscach ekranu (nagłówki sekcji, etykiety kart KPI, komunikaty
błędu, placeholdery) — nie w ukrytych tooltipach. `SubscriptionAnalytics.tsx` (billing/analytics) jest
szczególnie zagęszczony — 20 z 23 kluczy `billing.*` z tej kategorii pochodzi z tego jednego pliku, sugerując,
że cały ekran analityki subskrypcji był pisany z polskimi „defaultValue" od początku.

## 5. Klucze-elementy tablic (158 z 2089) — osobny mechanizm ryzyka

158 kluczy tylko-w-pl to elementy tablic JSON (`landing.aiOs.items[0].title`, `security.pillars.items[2].body`
itd.) z 14 unikalnych tablic-rodziców, wszystkie na stronach marketingowych/publicznych
(`landing`, `pricing`, `security`, `vector`).

**Sprawdziłem bezpośrednio strukturę `en/translation.json`: wszystkie 14 tablic-rodziców są CAŁKOWICIE
NIEOBECNE w `en`** (nie tylko krótsze — nieobecne jako klucz w ogóle), poza `landing.narrativeCta.points`,
która w `en` istnieje ale jako **obiekt**, nie tablica (inna struktura danych niż w `pl`).

Sprawdziłem sposób wywołania na przykładzie `security.pillars.items` w `src/views/legal/SecurityView.tsx:337-340`:

```tsx
{AI_SECURITY_PILLARS.map((pillar, idx) => (
  ...
  {t(`security.pillars.items.${idx}.title`, pillar.title)}
  {t(`security.pillars.items.${idx}.body`, pillar.body)}
  ...
))}
```

`AI_SECURITY_PILLARS` to lokalna stała JS z angielskim tekstem źródłowym, użyta jako wartość domyślna.
**Ten konkretny przypadek jest bezpieczny** — brak wpisu w `en` nie powoduje ani surowego klucza, ani
crasha, tylko cichy powrót do zakodowanego na sztywno angielskiego tekstu w komponencie. Nie sprawdziłem
pozostałych 13 tablic-rodziców (`landing.aiOs.items`, `pricing.*`, `vector.*`) z tą samą dokładnością —
prawdopodobnie ten sam wzorzec (strony marketingowe zwykle mają dane źródłowe w JS + i18n jako nakładkę),
ale to NIE zostało zweryfikowane linia po linii dla każdej z nich. Traktuj to jako wysokie
prawdopodobieństwo, nie dowód.

## 6. Kierunek odwrotny: klucze w `en`, brak w `pl`

**16 kluczy** obecnych w `en`, nieobecnych w `pl` (mniej niż żądane 15 przykładów istnieje w ogóle — podaję
wszystkie 16):

| klucz | wartość w `en` | plik:linia wołania (jeśli statycznie znalezione) |
|---|---|---|
| `landing.narrativeCta.points.0` | „Anna explains fit, pricing, and security before you commit to a path." | `src/components/Landing/LandingNarrativeCtaBand.tsx:75` |
| `landing.narrativeCta.points.1` | „The demo shows the Consulting Intelligence Platform on seeded, read-only data." | `src/components/Landing/LandingNarrativeCtaBand.tsx:79` |
| `landing.narrativeCta.points.2` | (tekst o starcie triala) | `src/components/Landing/LandingNarrativeCtaBand.tsx:83` |
| `myWorkMindmap.health.gapEmptyBranch_other` | „{{count}} branches with no ideas" | brak statycznego (klucz pluralizowany, i18next dokleja `_other` sam) |
| `myWorkMindmap.health.gapIsolated_other` | „{{count}} elements linked to nothing" | jw. |
| `myWorkMindmap.health.gapNoEvidence_other` | „{{count}} branches without evidence" | jw. |
| `myWorkMindmap.health.gapNoLabel_other` | „{{count}} nodes without a label" | jw. |
| `myWorkMindmap.health.gapShallowBranch_other` | „{{count}} branches with no depth" | jw. |
| `myWorkMindmap.health.gapsCount_other` | „{{count}} gaps to fill" | jw. |
| `presentations.comingSoon` | „Coming soon" | brak statycznego dopasowania w `src/` |
| `presentations.minimalPreview` | „Minimal preview — full editor coming soon" | brak statycznego dopasowania |
| `presentations.previewPlaceholder` | „Deck preview will be rendered here." | brak statycznego dopasowania |
| `presentations.sourceType.unknown` | „Unknown" | brak statycznego dopasowania |
| `sharedComponents.filterableTable.daysAgo_other` | „{{count}} days ago" | klucz pluralizowany (jw.) |
| `sharedComponents.filterableTable.hoursAgo_other` | „{{count}} hours ago" | klucz pluralizowany (jw.) |
| `vault.safes.indexingErrorsCount` | „{{count}} error(s)" | `src/views/vault/VaultSafesTable.tsx:320` |

**Ważne wyjaśnienie dot. `_other`:** 8 z 16 kluczy to formy liczby mnogiej ICU (`_other` = domyślna forma
angielska). Kod woła bazowy klucz (np. `t('myWorkMindmap.health.gapsCount', {count})`) bez przyrostka —
i18next sam dokleja `_other`/`_few`/`_many` zależnie od `count` i reguł danego języka. **To, że w `pl` brakuje
`_other`, samo w sobie nie jest błędem** (polski nie używa formy `_other` w typowych regułach CLDR dla liczb
całkowitych — polski ma `_one/_few/_many/_other` gdzie `_other` włącza się tylko dla ułamków). Realne pytanie
brzmi, czy w `pl` ISTNIEJĄ warianty `_few`/`_many`/`_one` dla tych samych kluczy — **tego nie sprawdziłem
osobno w tym pomiarze** (skupiłem się na literalnym dopasowaniu kluczy z sufiksem, a nie na kompletności
zestawu form pluralizacji). To realna luka w moim pomiarze, wypisuję ją uczciwie.

Pozostałe 4 klucze `presentations.*` (comingSoon, minimalPreview, previewPlaceholder, sourceType.unknown)
nie mają żadnego statycznego dopasowania w `src/` — albo są martwe, albo wołane dynamicznie (nie
zweryfikowałem które).

Dla `pl` fallback łańcuch to `pl: ['pl', 'en']` — więc polski użytkownik trafiający na te 16 kluczy zobaczy
**angielski tekst** (dokładnie ten defekt, który jest głównym zgłaszanym problemem: klient PL widzi
angielski UI). Ale skala tego kierunku (16 kluczy) jest o **~130x mniejsza** niż kierunek odwrotny (2089
kluczy).

## 7. PODSUMOWANIE

- **Realnie groźnych przypadków w sensie dosłownym „surowy klucz i18n na ekranie" (np.
  `reports.toast.reportGenerated` widoczny jako tekst): 0 potwierdzonych, statycznie zweryfikowanych.**
  To zaskakujący wynik, sprzeczny z hipotezą ze zlecenia — zweryfikowany na 1931 zwykłych kluczach + 187
  kluczach dynamicznych. Powód: bardzo konsekwentny wzorzec `t(klucz, wartość_domyślna)` w tej bazie kodu.
- **Realny, potwierdzony defekt tej samej rodziny co zgłoszenie: 134 klucze, gdzie „wartość domyślna" w
  kodzie jest PO POLSKU, nie po angielsku.** Użytkownik z interfejsem EN zobaczy polski tekst. Skupione w
  4 obszarach: `excele` (37), `partner` (25), `billing` (23, głównie jeden plik `SubscriptionAnalytics.tsx`),
  `rap` (19), `documentStudio` (15).
- **286 kluczy nie ma żadnego znalezionego wołania w `src/`** — mogą być martwe albo wołane w sposób,
  którego nie potrafię statycznie rozstrzygnąć (263 wywołania `t(zmienna)` + 448 wywołań z całkowicie
  dynamicznym prefiksem istnieją w kodzie i mogą teoretycznie trafiać w te klucze).
- **187 kluczy jest osiąganych wyłącznie przez klucze dynamiczne** (`t(\`prefix.${x}\`)`) — nie da się
  statycznie potwierdzić ani wykluczyć ryzyka bez śledzenia wartości `x` w runtime.
- **158 kluczy to elementy 14 tablic marketingowych** (`landing`/`pricing`/`security`/`vector`), z czego
  wszystkie tablice-rodzice są całkowicie nieobecne w `en`. Zweryfikowałem jeden przypadek
  (`security.pillars.items`) — bezpieczny (fallback na dane JS), pozostałych 13 NIE zweryfikowałem
  linia po linii.
- Kierunek odwrotny (`en` bez `pl`, klient PL widzi angielski) to tylko 16 kluczy — realny, ale znacznie
  mniejszy problem niż kierunek `pl`→brak w `en`.

### Rekomendacja: NIE jest to pilna sprawa typu „użytkownik widzi surowy klucz na produkcji"

Hipoteza ze zlecenia (surowy klucz i18n na ekranie EN) **nie została potwierdzona ani jednym statycznym
przypadkiem** w tym pomiarze. Rzeczywisty, zmierzony problem jest innej natury i mniej dramatyczny wizualnie,
ale wciąż realny: **134 miejsca z polskim tekstem jako fallback dla użytkownika EN** — to wygląda dla klienta
jak niedokończone tłumaczenie, nie jak crash czy błąd techniczny. Priorytet: średni, nie krytyczny/pilny.
Warto naprawić najpierw skupisko w `SubscriptionAnalytics.tsx` (ekran rozliczeń — widoczny dla partnerów/adminów
płacących realne pieniądze) oraz `DocumentStudio*` (rdzeń produktu), niż rozpraszać się na 286 „unused"
kluczy o niepewnym statusie.

**Czego NIE zmierzyłem i trzeba by dociągnąć przed ostatecznym zamknięciem tematu:**
1. Czy 263 wywołania `t(zmienna)` i 448 wywołań z pustym prefiksem dynamicznym trafiają w którykolwiek
   z 2089 kluczy tylko-w-pl (wymaga śledzenia wartości w runtime albo ręcznego audytu każdego miejsca).
2. Kompletność form pluralizacji (`_few`/`_many`/`_one`) w `pl` dla kluczy, gdzie w `en` istnieje tylko
   `_other`.
3. Pozostałe 13 z 14 tablic marketingowych — czy mają fallback JS jak `security.pillars.items`, czy nie.
4. Czy 286 kluczy „UNUSED" to faktycznie martwe wpisy w słowniku, czy tylko niewidoczne dla mojej metody.
