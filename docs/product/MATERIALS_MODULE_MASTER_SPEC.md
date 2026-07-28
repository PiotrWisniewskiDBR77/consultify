# Moduł „Materiały" — master spec (mapa do kodowania) · 2026-06-24

> **Aktualizacja kanoniczna (2026-07-24):** decyzje o nawigacji, trzech trybach tworzenia, roli Excela i wspolnej bibliotece szablonow sa zebrane w [MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md](MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md). Ten dokument pozostaje szczegolowa specyfikacja modulu, ale nie nadpisuje nowszego kanonu.

> Konsolidacja rozmowy projektowej Piotr×CTO. Cel: **najlepszy konsultant na świecie** — każdy projekt w końcu trzeba pokazać światu; to moment, gdy konsultant składa wiedzę w Excel / PPT / raport. Moduły zbierają dane → ten moduł dzieli się wynikami. Musi: (1) współpracować z resztą systemu, (2) prezentować najlepsze dane najlepszym przekazem, (3) być piękny. Status: **spec do uzgodnienia przed kodowaniem.** Bazuje na: [`DELIVERABLE_STANDARDS_AND_TOOLING`](../qa/deliverables/DELIVERABLE_STANDARDS_AND_TOOLING.md) · [`DELIVERABLE_FORMATTING_SPEC`](DELIVERABLE_FORMATTING_SPEC.md) · [`BUSINESS_PLAN_GENERATOR_SPEC`](BUSINESS_PLAN_GENERATOR_SPEC.md).

## 0. Fundament — Artefakt (źródło prawdy)
**Artefakt = output innych modułów = warstwa wiedzy org.** Typy: insight z wywiadu · inicjatywa · decyzja · task · raport finansowy · tabela KPI · 4 typy idei (mapa myśli/proces/tabela/whiteboard) · notatki/notatnik. *(Otwarte na dokładanie.)*
Każdy materiał **binduje się do artefaktów** — to one są treścią. „Księga faktów": każda liczba na materiale = **referencja do faktu w artefakcie**, nie kopia → deck/raport/tabela o tym samym projekcie nigdy nie pokażą sprzecznych liczb.

## 1. Jeden moduł, trzy formaty
Konsolidacja 4 pozycji sidebara (Dokumenty/Prezentacje/Raporty/Tabele) → **jeden „Materiały"**. Format (deck/raport/tabela) = **wybór** (system podpowiada, user decyduje — bo treść tabeli ≠ treść decka), nie osobna aplikacja. Format = filtr/widok w bibliotece, nie nawigacja.
**Jednostka = jeden materiał** (jeden Word/Excel/PPT). Pakiet (jeden zestaw info → kilka materiałów) = przypadek opcjonalny, nie domyślny.

## 2. Trzy wejścia (ładowarki kontekstu → jeden silnik generacji)
1. **Czysty input (Gamma-style):** jedno zdanie → retrieval z org (projekty/inicjatywy/artefakty) → cedzi → układa w wybrany format.
   > ⚠️ 27.07: „czysty input" = TERESA, nie osobny byt/silnik. Nie budować drugiego pola tworzenia.
2. **Upload pliku:** zewnętrzny .docx/.pptx/.pdf → parsuje na części → buduje.
3. **In-place „Przygotuj narzędzie":** z dowolnego modułu (inicjatywa/idea/raport fin.) → przeskok do Materiałów z **zaznaczonym kontekstem** → wybór formatu/wielkości/zawartości. *(To most „moduły↔materiały".)*

## 3. Dwa triggery
- **Ad-hoc** — na żądanie (3 wejścia powyżej).
- **Harmonogram (subskrypcja raportu):** cron (np. pon 8:00) → template + format + treść z artefaktów → biblioteka **+ opcjonalnie e-mail** do wskazanych odbiorców. Definiujesz raz, leci w kółko.

## 4. Template × Motyw × Formatowanie (trzy ortogonalne osie)
- **Template = struktura:** ile slajdów/sekcji, co na każdej, hierarchia. Generowane w module, per format.
- **Motyw = paleta + para fontów** (Gamma-style, wymienny niezależnie od struktury). 5 par + 10 fontów (spec formatowania).
- **Formatowanie = typografia/listy/tabele** per format (Word/PPT/Excel) — spec osobna.
- **Brand klienta:** ingestion .pptx/.docx → ekstrakcja **palety+fontów** (teraz) → nadpisuje motyw. Pełne klonowanie layoutów = v2.

## 5. Źródła danych (cel: wyprzeć Power BI)
- **Konektory do baz** — linki do zewnętrznych DB (zasilają tabele).
- **Formularze** — generowane, share'owane linkiem; ludzie wypełniają → dane do tabel.
- Razem z artefaktami = pula danych, z której materiały czerpią.

## 6. Cykl życia + edycja (standard DMS)
`Draft → In review → Authorized (snapshot) → Sent (immutable)`.
- Edycja w Draft/Review; **Authorized** = zamrożony, zmiana = nowa wersja; **Sent** = auto-lock (nieedytowalny).
- **Kto co/kiedy = RBAC.** Harmonogram+wysyłka zewn. = rola uprzywilejowana (admin/owner org-wide; member własne).
- **Edycje warstwowo:** warstwa generowana + warstwa nadpisań usera → regeneracja/live **nie kasuje** ręcznych poprawek (merge, nie clobber).
- **Wersjonowanie** — każdy materiał ma historię; authorized-snapshoty i live współistnieją; rollback.

## 7. Tryb żywotności
- **Static** — zrobiony raz, zamrożony.
- **Live** — bind **DANYCH (nie narracji):** KPI/liczby, statusy, liczności, daty, wiersze tabel → odświeżane z artefaktów przy otwarciu. Proza statyczna (regen tylko na żądanie). Żywy deck/raport = przewaga (Office/BI tego nie robią).
- **Authorized** — zatwierdzony, zablokowany, bezpieczny do wysłania.

## 8. Trzy powierzchnie wyjścia
1. **Share-link** (online view, Gamma-style; może być **live**).
2. **Eksport natywny** — .docx / .pptx / .xlsx.
3. **In-app viewer** + share w platformie.
Jeden materiał (SPINE/artefakt) → render na 3 powierzchnie z jednego źródła.

## 9. Obrazy — Image Router (tierowany, monetyzowalny)
Router per typ treści × brand × tier, z VisionQA-gate + fallback. **Tier 0** stock (Unsplash/Pexels) · **T1** budget gen (FLUX Schnell/Qwen) · **T2** premium (FLUX.2 Pro/Imagen 4/GPT Image 2/nano-banana) · **T3** wyspecjalizowane (**Ideogram** = tekst na obrazie, **Recraft** = wektor/brand). Pakiet Lite (T0-1, w cenie) vs Pro (T2-3, kredyty).

## 10. Jakość — twarde bramki
- **Beauty gate (VisionQA):** czytelność/estetyka/brand → regen albo fallback. „Brzydkich nikt nie czyta" egzekwowane.
- **Content gate:** zero placeholderów, zero sprzecznych liczb (księga faktów), **provenance** na twierdzeniach (źródło/artefakt), CFO-review na finansach.

## 11. Pętla zwrotna (system się uczy)
Materiał → artefakty: finalne rekomendacje/decyzje z decka **wracają jako artefakty** (rekomendacja → śledzona inicjatywa). „Pokazanie światu" zasila organizację z powrotem.

## 12. Monetyzacja
Kredyty/tokeny, duże pakiety + dokup. Free = stock + standard tier. Premium = mózg premium + obrazy T2-3 + (opcjonalnie) live/harmonogram → kredyty.

## 13. Cięcie faz
- **MVP (fala 1):** jeden moduł + 3 wejścia + generacja ad-hoc + 3 formaty na **premium** (mózg ON) + share-link + eksport natywny + podstawowe template'y/motywy/fonty + beauty/content gate.
- **Fala 2:** live-binding · harmonogram+email · formularze+konektory · brand-ingestion · tiery routera obrazów · warianty audytorium · pętla zwrotna.

## Otwarte (do nodu Piotra)
- Nazwa: „Materiały" vs „Dokumenty" (skłaniam się „Materiały").
- Domyślny motyw: „Executive" (serif-head + sans-body)?
- Zestaw 10 fontów — OK czy dorzucić firmowy?
- Czy MVP-zakres (§13) akceptowalny jako pierwsza fala kodowania?
