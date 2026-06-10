# Deliverables — docelowa specyfikacja doświadczenia („jak to ma działać, gdy jest idealnie")

> SSOT doświadczenia użytkownika dla tworzenia deliverables (dokument / prezentacja / arkusz).
> Nadrzędna doktryna techniczna: `DELIVERABLES_LIGHT_TARGET.md` (architektura) + V8.1 (runtime).
> Droga dojścia: `DELIVERABLES_NEXT_STEPS_EXECUTION_PLAN.md`. Wzorce: Kimi (czat↔artefakt),
> Claude (artefakty w rozmowie), Gamma (outline-gate, per-jednostka AI) — `docs/benchmarks/`.

---

## 0. Gwiazda północna

**Deliverable w Consultify nie jest plikiem, który piszesz — jest wynikiem rozmowy z Teresą,
ugruntowanym w danych Twojej organizacji, który składa się na Twoich oczach i sam wie,
skąd pochodzi każde zdanie.**

Trzy testy, które doświadczenie musi przechodzić zawsze:
1. **Test jednego zdania:** od intencji do pierwszej realnej treści — zero formularzy, zero nawigacji.
2. **Test uczciwości:** system nigdy nie udaje — brak treści ⇒ jasny błąd; brak danych ⇒ jawne założenie.
3. **Test moatu:** wynik korzysta z tego, czego Kimi/Claude nie mają — żywych danych organizacji.

## 1. Wejścia (wszystkie drogi prowadzą do tej samej pętli)

| Wejście | Zachowanie |
|---|---|
| **Czat (główne):** „napisz raport o…", „stwórz prezentację…", „przygotuj budżet…" | intercept rozpoznaje format (PL/EN, formy odmienione), startuje pętlę generacji w tej samej rozmowie |
| **Chip OUTPUT przy inpucie** (Documents/Tables/Presentations) | wymusza format dla następnej wiadomości — bez nawigacji |
| **Karta encji** (insight, notatka, inicjatywa, wynik wywiadu): „Zrób z tego → …" | otwiera czat z prefillem + encja jako źródło (sourceRefs) |
| **Artefakt → artefakt:** „zrób z tego dokumentu prezentację" | konwersja na wspólnym modelu bloków |
| **Outputs Library:** „Nowy → z opisu" | ten sam kontrakt; Library to dom artefaktów, nie kreator |

Anti-wejścia (świadomie NIE istnieją): formularz konfiguracyjny przed wartością, kreator
wieloekranowy, wymóg wyboru szablonu. Opcje (język, gęstość, odbiorca, ton) są **wnioskowane**
z intencji i kontekstu, korygowalne PO zobaczeniu planu/treści, nigdy wymagane PRZED.

## 2. Pętla generacji (każdy format, ten sam rytm)

```
zdanie użytkownika
   │
   ▼
PLAN (≤2 s, deterministyczny) ──────────► checklista w czacie + szkielet artefaktu w panelu
   │   • sekcje/karty/kolumny z intencji        (tytuł, struktura, „Teresa pisze…")
   │   • źródła: wskazane → potwierdzone;
   │     brak → auto-skan org (top-N propozycji)
   ▼
GENERATE (w tle, 5–30 s) ───────────────► sekcje pojawiają się KOLEJNO w panelu (streaming);
   │   • realna treść w języku wiadomości        checklista odhacza kroki
   │   • fakty TYLKO ze źródeł; braki = jawne
   │     założenia inline
   ▼
VALIDATE ───────────────────────────────► bramka anty-placeholder + walidacja struktury;
   │                                          porażka ⇒ czytelny błąd + „Spróbuj ponownie"
   ▼
DRAFT ──────────────────────────────────► artefakt aktywny w panelu, chip w transkrypcie,
                                              wpis w Outputs Library, finalna notka w czacie
```

Zasady rytmu:
- **Plan jest natychmiastowy** — użytkownik w <2 s widzi, że „coś się dzieje" i CO powstanie.
- **Checklista to kontrakt z użytkownikiem**, nie spinner: nazwane kroki, odhaczane na żywo,
  z liczbami (sekcji/slajdów/wierszy). Stan terminalny zostaje w historii rozmowy na zawsze.
- **Outline-gate (wzorzec Gamma):** plan w checkliście jest edytowalny (toggle sekcji, zmiana
  tytułu) zanim/while generacja biegnie; auto-start domyślnie, „zatrzymaj i popraw plan" zawsze dostępne.
- **Przerwanie nie gubi pracy:** reload strony w trakcie ⇒ generacja kończy się serwerowo,
  chip w transkrypcie otwiera wynik; podwójne żądanie ⇒ grzeczna odmowa („już trwa").

## 3. Anatomia ekranu (split-view, stały chrome)

```
┌────────────────────────────┬──────────────────────────────────────────┐
│ CZAT (lewo)                │ ARTEFAKT (prawo)                          │
│                            │ ┌──────────────────────────────────────┐ │
│ • wiadomość użytkownika    │ │ taby artefaktów tej rozmowy          │ │
│ • checklista postępu       │ ├──────────────────────────────────────┤ │
│   (żywa, potem trwała)     │ │ pasek: tytuł · status · Eksport ·    │ │
│ • chip artefaktu           │ │        Udostępnij · Otwórz w studio  │ │
│   [ikona] Tytuł  [Open]    │ ├──────────────────────────────────────┤ │
│ • dalsza rozmowa NAD       │ │ TREŚĆ (edytowalna inline):           │ │
│   artefaktem               │ │  doc: sekcje + chipy źródeł/założeń  │ │
│                            │ │  deck: karty + akcje per karta       │ │
│                            │ │  sheet: tabela + akcje kolumn        │ │
└────────────────────────────┴──────────────────────────────────────────┘
```

- **Czat nigdy nie znika** — artefakt nie zastępuje rozmowy, jest jej drugą połową.
- **Taby** = wiele artefaktów w jednej rozmowie (raport + deck z niego + budżet); ostatni
  aktywny zapamiętany per rozmowa.
- **Chrome artefaktu jest minimalny**: tytuł, status, 3 akcje. Governance (QA, approval,
  promote) pojawia się DOPIERO gdy artefakt wchodzi w cykl review — nie nad pustym szkicem.
- Pasek formatowania = edytor, nie panel sterowania modułu.

## 4. Grounding — serce przewagi

Trzy tryby, jawnie komunikowane w checkliście planu:
1. **Rozmowa wystarcza** (à la Gamma): intencja + kontekst konwersacji ⇒ pełnoprawna treść.
2. **Wskazane źródła:** sourceRefs z kart encji / wyboru w czacie — fakty tylko stamtąd.
3. **Auto-skan:** Teresa proponuje top-N encji (wywiady, insighty, inicjatywy, KPI):
   „Znalazłam 6 źródeł — użyć?". Jeden klik akceptuje, można odznaczać.

Reguły treści:
- **Fakt ≠ założenie, zawsze wizualnie rozróżnione.** Fakt niesie chip źródła (klik ⇒ otwiera
  encję w podglądzie). Założenie = bursztynowy chip „założenie — potwierdź": klik ⇒
  [Potwierdzam] / [Podepnij źródło] / [Usuń zdanie]. Potwierdzone założenie zmienia status, nie znika.
- Granularność v-final: chipy per sekcja (lista źródeł pod sekcją) + założenia per zdanie.
- **Dokument nigdy nie jest pusty z powodu braku źródeł** — pełna proza + założenia. Rusztowanie
  („sekcja czeka na treść") może istnieć tylko jako szkielet W TRAKCIE generacji.

## 5. Edycja-lekka (edytujesz to, co AI zrobiło — nie autorujesz od zera)

| Warstwa | Doc | Deck | Sheet |
|---|---|---|---|
| Inline | pełny edytor blokowy (TipTap): pisz, formatuj, przestawiaj | edycja tekstów na karcie | edycja komórek, dodawanie wierszy/kolumn |
| Zaznaczenie → AI | Skróć / Rozwiń / Zmień ton / Wyjaśnij — wynik jako **diff accept/reject** | j.w. na blokach karty | „przelicz/uzupełnij kolumnę" |
| Per jednostka (sekcja/karta/kolumna) | Rozwiń · Skróć · Podeprzyj danymi · **Regeneruj** | Regeneruj · Inny układ · Zmień obraz | Sortuj · Typ kolumny · Regeneruj wiersze |
| Rozmowa | „dopisz sekcję o ryzykach", „zmień rekomendację 2" — Teresa edytuje artefakt, zmiany widoczne na żywo z provenance per zmiana | j.w. | j.w. |

Każda zmiana AI: wpis w historii wersji (przywracalny) + ślad „kto/co/kiedy" (provenance).
Pełne studio (Deck Builder / Document Studio pro) = świadome „drzwi obok" dla power-userów,
nigdy wymagane.

## 6. Życie artefaktu po wygenerowaniu

- **Eksport:** doc → DOCX/PDF · deck → PPTX/PDF · sheet → XLSX/CSV. Jeden przycisk, bez konfiguracji.
- **Udostępnianie:** link publiczny (viewer bez logowania, rewokowalny) + udostępnienie w org.
- **Rejestr:** każdy artefakt automatycznie w Outputs Library (filtry: format, status, źródło,
  inicjatywa) i widoczny w panelu „Artefakty" powiązanej inicjatywy.
- **Adresowalność:** artefakt jest bytem w rozmowach na zawsze — „dopisz do wtorkowego raportu
  sekcję o ryzykach", „zrób deck z tego budżetu". Teresa odnajduje go po tytule/kontekście.
- **Żywe sekcje (faza E):** sekcja spięta z KPI/inicjatywą ma przycisk „Odśwież dane" i pokazuje
  diff zmian; **standing artifacts** — artefakt cykliczny (raport miesięczny), który Teresa
  aktualizuje sama i melduje zmiany w czacie.
- **Konwersje:** dokument ⇄ prezentacja ⇄ arkusz na wspólnym modelu bloków — „zrób z tego deck
  dla zarządu" zachowuje źródła i założenia.

## 7. Uczciwość i stany brzegowe (niełamalne)

1. Żaden wewnętrzny artefakt języka (placeholdery, nazwy trybów, etykiety techniczne) nie trafia
   do treści użytkownika. Strażnik: bramka anty-placeholder + przegląd copy.
2. Awaria LLM/walidacji ⇒ checklista pokazuje ❌ z ludzkim komunikatem i akcją „Spróbuj ponownie";
   szkic użytkownika nie jest nadpisywany wynikiem błędnym.
3. Język artefaktu = język wiadomości użytkownika (nie UI).
4. Edycje użytkownika > automatyka: żaden refresh/regeneracja nie nadpisuje ręcznych zmian bez diffu.
5. RBAC: generacja wymaga uprawnienia tworzenia; viewer widzi artefakty, nie tworzy. Izolacja org bezwzględna.
6. Flagi: całość za `ENABLE_DELIVERABLES_LIGHT`/`VITE_…` aż do GA; off ⇒ legacy nietknięte.

## 8. Metryki sukcesu (telemetria z fazy D2)

| Metryka | Cel |
|---|---|
| Time-to-first-content (intencja → pierwsza sekcja w panelu) | < 10 s (plan < 2 s) |
| Completion rate generacji (draft / requested) | > 95 % |
| Honest-failure rate (error pokazany / błędów faktycznych) | 100 % (zero cichych degradacji) |
| Udział artefaktów z groundingiem org (tryb 2/3) | > 50 % po fazie B |
| Eksport lub udostępnienie w ciągu sesji od utworzenia | > 40 % (proxy „użyteczności") |
| Wejścia legacy (formularz/redirect) po GA | → 0 (warunek L4 retire) |

## 9. Anti-scope (czego ŚWIADOMIE nie budujemy)

Parytet Notion/Airtable/Gamma w edytorach · realtime-multiplayer w v1 · szablon jako bramka
wejścia (szablony = akcelerator w tle) · osobne silniki narracji per format · ciężkie biblioteki
na boot (lazy przy eksporcie) · kreatory wieloekranowe w jakiejkolwiek formie.

## 10. Otwarte decyzje produktowe

| # | Decyzja | Rekomendacja |
|---|---|---|
| 1 | Umiejscowienie „Zrób z tego…" na kartach encji (kanon Menu 1/2/3) | Menu 3 (akcje karty/wiersza) |
| 2 | Auto-start generacji vs stop na outline-gate jako default | auto-start + łatwe „zatrzymaj"; zmierzyć |
| 3 | Auto-skan org: zawsze vs opt-in per generacja | zawsze, ograniczony do 4 typów encji |
| 4 | Los Document Studio po L4 | zostaje jako „tryb pro" + governance, znika z wejść |
