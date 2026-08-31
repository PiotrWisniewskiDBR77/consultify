# CODEX DAY 123 — prototypy Decyzji i Insightu

Data: 2026-08-29  
Marker: `a1265154b73f57a43cbe468993e4317bb2e0f02b`  
Gałąź: `codex/day123-proto-dwa-20260829`  
Werdykt: **PROTOTYPY GOTOWE DO OCENY WŁAŚCICIELA — 2 z 2 HTML, 4 z 4 zrzuty, zero zmian produktu.**

## 1. Tożsamość wejścia

Wynik markera, dosłownie:

```text
MARKER OK
```

Wynik sanity, dosłownie:

```text
a1265154b73f57a43cbe468993e4317bb2e0f02b
```

`git status --short | head -3` nie zwrócił żadnego wiersza.

Tip `github-backup/codex/m03-admin-20260824` uciekł do przodu. Zgodnie z `DEC-2026-08-26-95` praca wystartowała dokładnie z markera. Rozjazd obejmował 7 commitów i m.in. późniejsze zmiany `InsightViewer.tsx`; scalenie pozostaje zadaniem nadzorcy.

Porty `6006`, `4912`, `4913` były wolne przed startem. Baza nie była potrzebna ani uruchamiana: zakres jest samodzielnym prototypem bez runtime produktu i bez zapisów. Lokalny serwer statyczny na `127.0.0.1:4912` służył wyłącznie do renderu HTML po tym, jak polityka przeglądarki odrzuciła `file://`.

## 2. Stan wejściowy i wzorzec

Obejrzano w całości:

- `/private/tmp/proto-zadanie-artefakty/prototyp-zadanie.html` — `83321` B;
- `/private/tmp/proto-zadanie-artefakty/render/light-full.png`;
- 12 zrzutów dyżuru 95 w `/private/tmp/cx-day95-spec-a-rekordy-artefakty/`.

Przeniesiono: tę samą geometrię Menu 1 i Menu 3, te same tokeny light/dark, układ centrum + panel, kolejność panelu `Akcje → Właściwości → Powiązania → Źródła i założenia → Komentarze → Historia`, stały przełącznik motywu, neutralny primary, denominatory, nazwane luki, jawne role i kontener `role="log"`.

Odstępstwa od wzorca Zadania:

1. Zmieniono treść centrum, kod/tytuł/status rekordu oraz fleksyjne etykiety artefaktu.
2. Decyzja ma jedyny czerwony blok wyłącznie dla realnej blokady kosztu energii.
3. Insight jest nazwany w polskim interfejsie „Wniosek”; nie pokazuje czerwonego `Failed` ani fałszywego `Akcje 0`.
4. Dane prawego panelu zachowują powłokę wzorca i pozostają demonstracyjne; nie są dowodem danych runtime.

## 3. Artefakty

| Artefakt | Rozmiar | SHA-256 |
|---|---:|---|
| `/private/tmp/cx-day123-proto-dwa-artefakty/prototyp-decyzja.html` | 61467 B | `a3ae5797c47afcfe70904c71e6c598ebb32f5c06fc420f57036ac98048412bd9` |
| `/private/tmp/cx-day123-proto-dwa-artefakty/prototyp-insight.html` | 61339 B | `16b75c9caf8afd7a770eb56b9568990cb27b472cf61854646d0c09d274dace51` |

Oba pliki mają wszystko inline, zero odwołań HTTP/HTTPS, przełącznik dwóch motywów i otwierają się jako samodzielny dokument HTML. Nie dotykają runtime ani produktu.

## 4. Pięć cech zaakceptowanego kierunku

### Decyzja — 5 z 5

| Cecha | Wynik | Dowód |
|---|---|---|
| Całość po polsku | TAK | Etykiety, daty, statusy i przyciski są polskie. |
| Mianowniki | TAK | `4 z 6`, `3 z 5`, `82 z 100`, horyzont `5 lat`. |
| Puste nazwane | TAK | Wymieniono gwarancję energii i warunek serwisowy wraz z właścicielami. |
| Uprawnienia wprost | TAK | Osobno „Możesz” i „Nie możesz” z przyczyną segregacji obowiązków. |
| Czerwień tylko przy blokadzie | TAK | Czerwień występuje na blokadzie kosztu energii i odpowiadającym jej statusie. |

### Insight / Wniosek — 5 z 5

| Cecha | Wynik | Dowód |
|---|---|---|
| Całość po polsku | TAK | Nazwa ekranowa „Wniosek”; brak `Failed` i angielskich etykiet. |
| Mianowniki | TAK | `6 z 6`, odpowiedzi `3 z 3`, ryzyka `2 z 2`, sygnały `2 z 2`, ustalenia `3 z 3`. |
| Puste nazwane | TAK | Nazwano pomiar maszynowy, miks produktów i odpowiedź nocnej zmiany. |
| Uprawnienia wprost | TAK | Zakaz podniesienia pewności bez dowodów i zatwierdzania jako właściciel procesu. |
| Czerwień tylko przy blokadzie | TAK | Insight nie pokazuje czerwieni; brak potwierdzonej blokady jest neutralny. |

Wartości fixture dyżuru 120 zachowano: odpowiedzi `3`, ryzyka `2`, sygnały `2`, ustalenia `3`, pewność `Niewystarczające`, akcje `0`. Ostatnią wartość pokazano semantycznie jako: „Tryb podglądu — akcje nie są dostępne w tym widoku; liczba 0 nie oznacza braku działań”.

## 5. DoD §18.1 — stosowalne 13 punktów

Obie karty: **7 z 13**.

| # | Decyzja | Insight | Dowód / granica |
|---:|---|---|---|
| 1 | TAK | TAK | Menu 1 ma breadcrumb/back, typ, tytuł, lifecycle, zapis, indeks i jeden primary z powodem niedostępności. |
| 2 | TAK | TAK | Powłoka archetypu Rekord pochodzi z zaakceptowanego wzorca. |
| 3 | TAK | TAK | Stała kolejność prawego panelu zachowana. |
| 4 | TAK | TAK | Powiązania są osobnym akordeonem. |
| 5 | NIE | NIE | AI jest w Menu 3 i w centrum; nie dodano osobnej sekcji AI do prawego panelu. |
| 6 | NIE | NIE | Samodzielny prototyp nie dowodzi lista → preview → open ani guarda niezapisanych zmian. |
| 7 | NIE | NIE | Nazwane luki są uczciwe, ale loading/error nie zostały zaprojektowane ani zmierzone. |
| 8 | TAK | TAK | Light/dark obejrzane; użyto tokenów wzorca. |
| 9 | TAK | TAK | Decyzja: czerwień tylko dla blokady; Insight: brak crimsona na statusie/badge/selection. |
| 10 | NIE | NIE | Nie wykonano pełnego cyklu Tab/Shift+Tab wszystkich kontrolek. |
| 11 | NIE | NIE | Nie wykonano warstwowego testu Esc. |
| 12 | NIE | NIE | Nie zweryfikowano widocznego fokusa na każdej kontrolce. |
| 13 | TAK | TAK | Oba centrum zawierają `role="log"`, `aria-live="polite"`, `aria-relevant="additions text"`. |

Punkty 14–16 są niestosowalne: oba ekrany to archetyp C Rekord, nie kreator ani Canvas.

## 6. Zrzuty — 4 z 4, obejrzane osobiście

| Zrzut | SHA-256 | Ocena wizualna |
|---|---|---|
| `render/decyzja-light-full.png` | `917a85414b82ebeb41e01e1021c03d4e32ed3ef92924fb5af0a9f96f0a563268` | Czytelny; brak ucięć centrum/panelu; blokada jednoznaczna. |
| `render/decyzja-dark-full.png` | `7fac4b57a2bd4db26c751661e46a54ff077b7032b4ef076642aa3fa64a4bf638` | Czytelny kontrast i hierarchia; czerwień ograniczona do blokady. |
| `render/insight-light-full.png` | `5558121ab977c1f32d4d293c358d8bcbebdaa8215bf2a3c5ae8e882621ced1d8` | Czytelny; realne wartości widoczne bez przewijania horyzontalnego. |
| `render/insight-dark-full.png` | `b1e693781bcfbadca79c4164343713063894a5e043036d120dc56cc9848654f2` | Czytelny; brak czerwonego statusu `Failed`; pewność pozostaje uczciwa. |

## 7. Korekty wobec instrukcji

1. `Z24` odwołuje się do `§0.4a`, lecz dokument 680-liniowy nie zawiera `§0.3` ani `§0.4a`. Bezpieczna interpretacja: samodzielnie zmierzono wszystkie pliki zmienione względem markera i zapisano wynik poniżej; nie przepisywano cudzej liczby.
2. Weryfikacja W1 nie podaje dosłownej komendy. Wykonano `rg` po realnych nazwach `Decision|Decyzj|Insight|Wgląd` w `src` i `server/src/Gateway.ts`; wynik potraktowano wyłącznie jako inwentarz read-only, nie dowód działania.
3. W3 zawiera placeholder `<sciezka-Twojego-seedera>`, a dyżur prototypowy nie ma seedera. Zmierzono wszystkie warunki `successful_migrations` w `server/scripts` i `scripts/dev`; nie uruchamiano bazy, bo nie ma zapisu ani runtime.
4. `B.3` nazywa rdzeń „dowodem mutacyjnym w obie strony” w tabeli STOP, choć treść B.3 wymaga zrzutów. Zastosowano bezpieczniejszą literalną treść B.3: dwa motywy przełączone i wyrenderowane w przeglądarce, bez mutacji produktu.

## 8. Twierdzenia niezweryfikowane

- Nie zweryfikowano akceptacji właściciela dla Decyzji ani Insightu; to pakiet do oceny, nie `OWNER_ACCEPTED`.
- Nie zweryfikowano pełnego sterowania klawiaturą, kolejności Esc, każdego focus-visible, breakpointów tablet/mobile ani kontrastu narzędziem pomiarowym.
- Nie zweryfikowano integracji z listą, preview, routerem, API, bazą ani trwałym zapisem. Prototypy świadomie nie dotykają runtime.
- Nie zweryfikowano, że demonstracyjne dane prawego panelu odpowiadają przyszłemu modelowi domenowemu obu kart.
- Nie wykonano pomiaru zasięgu testów z nieistniejącego `§0.4a`; brak tej sekcji uniemożliwia odtworzenie zamierzonego mianownika.

## 9. Rozłączność i stan repo

Do repo wchodzą wyłącznie ten raport i punktowa aktualizacja `modules/06_EXECUTION/MODULE_ACCEPTANCE.md`. HTML, PNG i pliki robocze pozostają poza repo w katalogach dozwolonych przez `Z13`.

Komenda:

```bash
git diff --name-only a1265154b73f57a43cbe468993e4317bb2e0f02b..HEAD
```

ma po commitach wykazać dokładnie dwa pliki dokumentacyjne. Nie zmieniono `src/**`, `server/**`, migracji, testów ani infrastruktury.

## 10. Z30

Nie ustawiono żadnej zmiennej SMTP ani flagi wysyłki. Nie uruchomiono bazy, `server/src/index.ts`, runtime produktu ani drenażu outboxu. Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.
