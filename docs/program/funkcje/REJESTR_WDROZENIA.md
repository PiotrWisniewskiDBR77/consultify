---
doc_id: funkcje-rejestr-wdrozenia
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# Rejestr wdrożenia — tor FUNKCJE

Jeden wiersz na funkcję. **Zapis w tej samej godzinie, w której powstał pomiar** —
rozmowa nie jest nośnikiem wiedzy (`00_ZASADY_PRACY.md`, reguła nr 5).

## Jak czytać kolumnę „stan"

| Stan | Znaczenie | Co dalej |
| --- | --- | --- |
| `NIEZBADANE` | nikt nie zmierzył czterech warstw | pomiar przed jakąkolwiek decyzją |
| `ISTNIEJE_NIEAKTYWNE` | kod jest, brak wołacza albo brak renderu | **najtańsza robota w programie** — podłączyć |
| `ZA_FLAGA` | kod jest, flaga domyślnie OFF | zmierzyć przy włączonej, potem decyzja o domyślnej |
| `DZIALA` | cztery warstwy zamknięte, łańcuch renderowania podany | odbiór adwersaryjny → ocena A/B |
| `DO_ZBUDOWANIA` | **dowód nieistnienia** pokazany komendami | dopiero teraz wolno budować |
| `ODLOZONE` | martwe albo poza rundą | wpis do `ODLOZONE.md`, kod zostaje |

## Cztery warstwy — bez nich wiersz nie wchodzi

`W1` typ/komponent · `W2` baza/backend · `W3` endpoint **i realny wołacz w `src/`** ·
`W4` **czy to się renderuje / wykonuje**.

**To nie są dowody:** sam `import` · wpis w rejestrze albo karcie odbioru ·
obecność w mapie widoczności · istnienie testu · nazwa katalogu · napis `CLOSED_FINAL`
w dokumentacji. W tym repozytorium `grep` systematycznie kłamie w stronę „działa".

## Ocena A–D (reguła nr 2 zasad pracy)

`A` działa przez interfejs, dowód mutacyjny w obie strony · `B` działa z **nazwanymi**
ograniczeniami · `C` nie działa albo dowód nie trzyma · `D` martwe / za flagą bez decyzji.
**Do właściciela idą wyłącznie `A` i `B`.**

---

## Rejestr

| Moduł | Funkcja | Trasa / serwis | Stan | Flaga (domyślna) | Dowód (ścieżka:linia) | Ocena | Werdykt właściciela |
| --- | --- | --- | --- | --- | --- | --- | --- |
| _(pusty — pomiar 16 modułów w toku, cztery tory równoległe, 2026-08-30)_ | | | | | | | |

---

## Pomiary w toku

| Tor | Moduły | Wydany | Stan |
| --- | --- | --- | --- |
| A | Chat · Moja praca · Wywiad · Narzędzia | 2026-08-30 | biegnie |
| B | Ocena · Inicjatywy · Realizacja · Wyniki | 2026-08-30 | biegnie |
| C | Finanse · Materiały · Audyty · Spotkania | 2026-08-30 | biegnie |
| D | Organizacja · Panel administratora · Ustawienia · Portal partnerski | 2026-08-30 | biegnie |

Wynik każdego toru wchodzi do rejestru **po przeliczeniu liczb przez nadzorcę**, nie
z raportu wykonawcy (reguła nr 3 — raport wykonawcy nie jest dowodem).

## Dyżury Codexa — tor funkcji

| Nr | Temat | Stan | Zastrzeżenie |
| --- | --- | --- | --- |
| 130 | Utrata danych — miejsca zapisu bez trwałości | biegnie u wykonawcy | klon `/private/tmp/cx-day130-utrata-danych` |
| 131 | Teresa i granice wiedzy | scalony po naprawie i odbiorze | **flagi `ENABLE_ORG_KNOWLEDGE_RETRIEVAL` nie wolno włączyć przed osobnym dyżurem** |
