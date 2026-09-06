# Wzorzec wywiadu (`interview-template`)

**Status:** PROPOZYCJA — do słowa właściciela. Pomiar 06.09.2026 z żywego stanowiska (backend
`127.0.0.1:4100`, własny vite `3103`, sesja `stanowisko-noc/auth.json`), zrzuty
`evidence/p10b8/03-interview-hub.png` … `06-interview-template-open.png` (+ `.json`, `bledyKonsoli: []`
na wszystkich, `url` nigdy `/login`).

## §0. Tożsamość

- Nazwa PL: **Wzorzec wywiadu** — edytor szablonu ankiety (metadane + lista pytań), z generowaniem
  i poprawą treści przez AI.
- Moduł: `02_INTERVIEW`. Archetyp: **D — Matryca** (inwentarz #13; w praktyce bliżej dokumentu —
  patrz §6, K16).
- Trasa: brak własnej trasy z `:id`. Otwarcie z dokumentu w ramach `/interview` (parametr
  `?tab=templates`, dokument `interview_template:<templateId>` zarządzany przez
  `InterviewHub.tsx` — stan dokumentu żyje w komponencie hosta, nie w adresie URL).
- Otwarcie: `/interview` → zakładka **Szablony** → wiersz → panel podglądu → „Otwórz”
  (`InterviewHub.tsx:6011`, montowanie `:6008-6013`) — potwierdzone na żywo, zrzut
  `06-interview-template-open.png`.
- Komponent aktywny: `src/components/Interview/TemplateBuilder.tsx:421` (3248 linii), prop
  `presentation="document"` (pełny ekran zamiast modala).
- Powłoka: **brak**. Własny `<div>` z ręcznym nagłówkiem (`:1798`, wysokość 40px, „Roboczy”/
  „Opublikowany” + X) i ręcznym stopką (`:2650`) — nie `StandardArtifactShell`, nie `NModeShell`,
  nie `ArtifactRightPanel`. Zero wpisu w `registry.ts` (`KartaNKey` go nie zna) i zero wpisu w
  `cardAnalysisRubric.ts`.

## §1. Sekcje (centrum ekranu)

Układ dwukolumnowy, nie lista nazwanych sekcji z kontraktu:

| obszar | po co użytkownikowi | źródło danych → writer | reguła pustki | S/L |
|---|---|---|---|---|
| Lewa kolumna „Metadane” (Temat, Opis, Biblioteka/widoczność, Formy odpowiedzi, Obszary, Liczba pytań, Tolerancja, Czas, Tryb runtime) | ustawia parametry ankiety | `template.*` → `PATCH /interview/templates/:id` (`server/src/routes/interview.routes.ts:296`, `InterviewController.updateTemplate`) | pola zawsze widoczne (formularz, nie odczyt) | L |
| Przycisk „Stwórz ankietę z AI” (`:2085-2096`) | generuje komplet pytań z opisu | `sendMessageToAI` (`TemplateBuilder.tsx:1160`) — model, bez trwałego zapisu do czasu „Zapisz” | disabled gdy `isApplicationTemplate` | — |
| Prawa kolumna „Pytania” (lista, drag&drop, edycja treści/typu/opcji) | buduje/porządkuje pytania | `questions[]` → `POST/PATCH/DELETE /interview/templates/:id/questions[/:questionId]` (`interview.routes.ts:346,353,360`) | pusty stan „Dodaj pierwsze pytanie” (niewidziany na żywo — próbka miała 3 pytania) | L |
| Przycisk „Popraw z AI” (`:2488`, `proposeQuestionImprovementsWithAI`) | otwiera modal propozycji AI (dodaj/usuń/przeformułuj/zmień kolejność) z osobnym „Zastosuj sugestie AI” (`:2483`) | `sendMessageToAI` (`:1423`) | modal znika po Zamknij/Zastosuj | — |
| Przycisk „Sprawdź jakość” (`:2662-2671`, `handleCheckQuality`) | ocena jakości pytań (`qualityResult`), baner „Teresa sprawdziła Twój szablon” (`:2571`) | `POST /interview/templates/evaluate-quality` (`interview.routes.ts:270`, `InterviewController.evaluateTemplateQuality`) | baner znika po „Odrzuć” | — |
| Import źródła (przycisk „Prześlij”, `:2524`) | wyciąga tekst z TXT/PDF do budowy pytań | `POST /interview/templates/import-source` (`:262`, multipart) | — | — |
| Podgląd jako respondent (`showRespondentPreview`) | pokazuje formularz oczami respondenta, read-only | renderuje `questions` lokalnie | modal znika po „Zamknij podgląd” | — |

Brak `KanonicznaKarta`/`StandardSekcjaDef` — sekcje nie są wyliczalną strukturą w kodzie, to stały
układ JSX (K1 ✗ formalnie).

## §2. Prawy panel

**Brak w ogóle.** Nie ma `ArtifactRightPanel`: żadnej z sekcji Akcje/Właściwości/Powiązania/Źródła
i założenia/Komentarze/Historia. Metadane (właściciel, kategoria, wersja, liczba użyć) żyją w
prawym panelu **listy** szablonów (`InterviewHub.tsx`, panel podglądu widoczny na
`05-interview-template-card.png`: „Kategoria: custom · Użycia: 0”), nie w samej karcie.
K6–K11 wszystkie ✗ z tego samego powodu — nie ma powłoki, która by je wyrenderowała.

## §3. Menu 5 i nawigacja

Brak „Sekcje ▾”, brak „Edycja/Podgląd” (edytowalność steruje `isApplicationTemplate`, cichy
disable pól, nie jawny przełącznik z powodem), brak paska modułu z pigułką otwartego dokumentu —
nagłówek to jeden 40px pasek ze statusem i „X” (K12 ✗, K14 ✗ formalnie — mechanizm istnieje,
tylko nienazwany kanonicznie, K19 ✗).

## §4. AI — trzy osobno nazwane przyciski zamiast jednego menu

Potwierdzone na żywo (`06-interview-template-open.png.json`, pole `tekst`): ekran pokazuje
dosłownie **„Stwórz ankietę z AI”**, **„Popraw z AI”** i **„Sprawdź jakość”** jako trzy niezależne,
inaczej nazwane przyciski — dokładnie zakazany wzorzec z K21 („Zakaz osobnych, inaczej nazwanych
przycisków AI per narzędzie”). Żadnego z nich nie renderuje `<PracujZAI>` — grep pliku potwierdza
zero importu tego komponentu.

| przycisk | co robi | zapis |
|---|---|---|
| Stwórz ankietę z AI (`:2085`) | generuje komplet pytań od zera z opisu | trafia do stanu `questions`, wymaga ręcznego „Zapisz wersję roboczą”/„Opublikuj” — brak jawnego „Zatwierdź” per-pole (K22 częściowo: cały dokument, nie propozycja punktowa) |
| Popraw z AI (`:2488`) | modal z listą zmian (dodaj/usuń/reorder), zaznaczane checkboxami, „Zastosuj sugestie AI” | najbliżej wzorca K22 (propozycja→zatwierdź), ale to własny modal, nie kanoniczny `PracujZAI` |
| Sprawdź jakość (`:2662`, ikona `TeresaMark`) | ocena 0–100 + lista uwag, baner „**Teresa** sprawdziła Twój szablon” | tylko do odczytu, brak zapisu |

`interview_template` nie ma wpisu w `cardAnalysisRubric.ts` ani w `registry.ts` (K21/K24 ✗
formalnie i faktycznie).

## §5. Czytelność

- `grep -c "primary-[0-9]"` = 0 (K17 ✓).
- Fokus: `focus:ring-c-focus`/`focus-visible:ring-c-focus` konsekwentnie (K18 ✓, próbka linii 1839,
  1858, 1931 itd.).
- i18n: próbka 9 kluczy `interview.templateBuilder.*` — 8/9 mają polskie tłumaczenie; jeden literał
  osadza słowo angielskie wewnątrz polskiej etykiety: **„Tryb runtime”**
  (`public/locales/pl/translation.json:runtimeMode`) — drobne, ale to dokładnie kształt „klucz
  istnieje ≠ przetłumaczony” (K25 częściowe naruszenie, kosmetyka).
- K19 pigułka modułu: ✗, potwierdzone zrzutem (§3).
- K20: zrzut 1440 (`06-interview-template-open.png`) bez poziomego przewijania strony.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak `KanonicznaKarta`/`StandardSekcjaDef`, układ JSX na sztywno |
| K2 kontrakt steruje renderem | n/d (kontraktu nie ma) | — |
| K3 sekcja→writer | ~ | metadane i pytania mają realne writery (§1); treść generowana AI nie ma trwałego klucza do czasu zapisu |
| K6–K11 prawy panel | ✗ (wszystkie) | brak `ArtifactRightPanel` w ogóle (§2) |
| K12 Menu 5 | ✗ | własny 40px pasek zamiast (§3) |
| K17 zero primary | ✓ | 0 trafień |
| K18 fokus c-focus | ✓ | próbka linii §5 |
| K19 pigułka modułu | ✗ | zrzut `06-interview-template-open.png` |
| K21 Pracuj z AI (3 pozycje, jeden komponent) | ✗ | trzy osobne, inaczej nazwane przyciski, potwierdzone zrzutem (§4) |
| K22 propozycja→Zatwierdź | ~ | „Popraw z AI” ma modal propozycji; „Stwórz ankietę” zapisuje wprost do stanu bez punktowego zatwierdzenia |
| K24 tabela AI per typ | ✗ | brak wpisu `interview_template` w `cardAnalysisRubric.ts`/`registry.ts` |
| K25 i18n bez angielskiego | ~ | 1 literał „Tryb runtime” (§5), reszta próbki czysta |
| K27 Teresa tylko Menu 1 | **✗** | „Teresa sprawdziła Twój szablon” (baner jakości) i ikona `TeresaMark` na przycisku „Sprawdź jakość” — oba w treści karty, poza Menu 1 |
| K28 zero UUID w DOM | ✓ (próbka) | zrzut nie pokazuje surowych identyfikatorów |
| K29 zero błędów konsoli | ✓ | `bledyKonsoli: []` na wszystkich 4 zrzutach |
| K30 zrzut 1440 z realnym rekordem | ✓ (ten pomiar) | `06-interview-template-open.png`, rekord „Customer Experience & Service”, 3 pytania |

## §7. Luki → naprawa

1. **Scalić trzy przyciski AI w jeden `<PracujZAI>`.** Wymaga najpierw decyzji, co odpowiada
   kanonicznym trzem pozycjom (Analizuj≈Sprawdź jakość, Uzupełnij tę sekcję≈Popraw z AI, Uzupełnij
   cały dokument≈Stwórz ankietę z AI) — mapowanie 1:1 istnieje, to nie jest praca od zera. Wymaga
   wpisu `interview_template` do `registry.ts`/`cardAnalysisRubric.ts` (K24) najpierw. Rozmiar: M.
2. **Usunąć markę Teresy z karty (DEC-404/419).** Zamienić `TeresaMark`+„Teresa sprawdziła…” na
   neutralny komunikat jakości AI, bez marki Teresy — wzorzec: `InitiativeDocumentView.tsx:162-168`.
   Rozmiar: S.
3. **Osadzić w `StandardArtifactShell`.** Największa pozycja — dziś ekran nie ma żadnej z sekcji
   K6–K11, żadnego Menu 5, żadnej pigułki modułu. To przepisanie hosta karty, nie łatka. Rozmiar: L;
   wymaga decyzji właściciela o archetypie (D „Matryca” z inwentarza czy B „Dokument” — treść to
   dziś jeden dokument z metadanymi + listą, bliżej dokumentu niż siatki rekordów).
4. **„Tryb runtime” → pełne PL.** Rozmiar: S (kosmetyka).

**Pytanie do właściciela (max 1):** czy `interview-template` ma dostać pełną powłokę
`StandardArtifactShell` (jak `meeting`/`zlecenie` w tej samej partii) w ramach osobnego zadania
inżynieryjnego, czy to świadomie pozostaje uproszczonym edytorem dokumentu (bez Menu 5/prawego
panelu) skoro nie jest to karta z cyklem życia, tylko wzorzec do wielokrotnego użycia? Rekomendacja:
pełna powłoka, bo wzorzec ma już realny cykl życia (roboczy→opublikowany→zarchiwizowany) i dzieli
z `meeting`/`zlecenie` ten sam wzorzec braku (był zbudowany przed standardem SPEC-A).

**STOP:** brak — wszystkie pozycje mają kierunek naprawy; jedynie kolejność (najpierw #3, bo #1 i #2
zyskują sens dopiero na kanonicznej powłoce) wymaga decyzji priorytetu, nie właściciela.
