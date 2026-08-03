# DOKTRYNA GĘSTOŚCI — kanon użycia przestrzeni UI (SSOT)
**Status: APPROVED_SPEC (2026-08-02).** Doktryna jest kanoniczną podstawą oceny gęstości; automatyczne egzekwowanie wymaga osobnego zadania implementacyjnego.
Siostra `TRIADA_KANON.md` (kolory/tabele) i `ARTIFACT_ANATOMY_STANDARD.md` (artefakty). Tamte mówią JAK ma wyglądać; ta mówi ILE i GDZIE — czyli jak nie zamienić bogatego programu w ścianę elementów.

---

## 0. ZASADA NADRZĘDNA (nie negocjowalna)

**Bogactwo funkcji TAK — bo procesy doradcze są złożone. Ale ekran ma być GĘSTY informacyjnie i PŁYTKI nawigacyjnie, bez duplikatów i bez pustych połaci.**

Trzy choroby, które ta doktryna leczy (z audytu 07-11):
- **PUSTKA** — pół ekranu nie robi nic (wielka karta „Workflow status" na jeden pill „DRAFT").
- **DUBEL** — ta sama akcja/dane w 2+ miejscach (pasek węzła 19 ≈ kebab 40; lista inicjatyw w 3 hubach).
- **PŁASKI WYSYP** — wszystko wyłożone naraz, zero hierarchii (co ważne, co rzadkie, co destrukcyjne).

Reguła myślenia przy każdym ekranie: **„nie ile elementów, tylko ile na region i w ilu miejscach"**.

---

## 1. TIERING AKCJI — progressive disclosure (TWARDE)

Każda akcja MUSI mieć jeden z trzech poziomów. Zakaz „wszystko widoczne".
- **PRIMARY (widoczne, 1–3)**: akcje definiujące ekran / najczęstsze. Na pasku, nazwane.
- **SECONDARY (w „…" / menu)**: rzadsze, sensowne ale nie codzienne.
- **RZADKIE / DESTRUKCYJNE (kebab)**: konwersje, usuwanie, zaawansowane.

**Twarde wartości:**
- Toolbar: **≤ 5 widocznych akcji**. 6+ → obowiązkowy overflow „…". *(sprawdzalne hookiem)*
- **JEDNA AKCJA = JEDEN DOM.** Zakaz tej samej akcji na 2 powierzchniach (pasek + kebab). *(sprawdzalne: duplikat ID akcji)*
- Kebab/menu: pozycja renderuje się **tylko gdy ma realny handler** (wzór: `NotebookHamburgerMenu`). Zero „szarych" martwych pozycji. *(sprawdzalne)*
- Zero „N wejść do tego samego" (audyt: 5 wejść do AI na Mind Map) → jedno kanoniczne.

---

## 2. BUDŻET PRZESTRZENI — space economy (TWARDE + osąd)

- **Żaden panel/karta < 50% wypełnienia treścią.** Pół-pusta karta = błąd, nie „powietrze". *(osąd + heurystyka)*
- **Meta w jednym pasku, nie w blokach.** Created/Updated/Completion/Confidence/Mode → jeden kompaktowy rząd chipów, nie 6 wielkich pól z pustką (anty-wzór: karta „Workflow status" na screenie Piotra).
- **Status = wąski pasek, nie wielka karta.** Jeden pill „DRAFT" nie potrzebuje 200px wysokości.
- **Gęstość > rozstrzelenie.** Lepiej jeden gęsty, czytelny region niż trzy rzadkie.
- **Bez hero na ekranie roboczym.** Wielkie nagłówki/opisy „Assess your organization's capability…" → skróć do jednego zdania lub tooltipa.
- Puste kolumny/sloty grid → usuń lub zwęź; layout ma wypełniać szerokość sensownie (nie zostawiać martwej prawej połowy).

---

## 3. REUSE-FIRST — anty-duplikacja (TWARDE)

- **Zanim zbudujesz toolbar / panel / listę / hub — grep czy istnieje.** Jeśli tak → reużyj lub rozszerz. **Zakaz drugiej implementacji tego samego.** *(częściowo sprawdzalne)*
- **Ta sama encja = jeden kanoniczny komponent + filtr**, nie N kopii per moduł (anty-wzór: 3× „Portfolio" listy inicjatyw w Initiatives/Execution/Results).
- Zakaz dwóch komponentów-bliźniaków (anty-wzór: `IdeaWorkspaceToolbar` vs martwy `IdeaCanvasToolSelector`; dwa slash-menu w Notatniku).
- **Nowy komponent MUSI mieć callera w tym samym kroku/PR.** Bez callera = nie wchodzi. *(sprawdzalne: 0 importerów)*
- **Zero plików-duplikatów `* 2.tsx`.** *(sprawdzalne)*

---

## 4. ZAKŁADKI I HUBY (TWARDE)

- **Hub ≤ 6 zakładek.** 7+ → scal lub zamień na sub-tryby. *(sprawdzalne: liczba zakładek)*
- **Zakaz dwóch zakładek na ten sam dataset** (anty-wzór: `roi` + `roi_analysis`; `investment` = filtr `analysis`).
- **Redundantne widoki tych samych danych → jeden widok + przełącznik** (anty-wzór: Formularz/Tabela/Macierz = 3 warianty `answers.drd`). Przełącznik widoku (Edycja/Podgląd) ≠ osobna zakładka.
- Sub-tryby (KPI×4, Reports×5, drawer×9) też liczą się do „gęstości głębi" — nie chowaj przeładowania w zagnieżdżeniu.

---

## 5. GOVERNANCE PROPORCJONALNY (TWARDE)

- **Domyślny tryb = solo / lekki.** Konsultant ma zadziałać, nie zatwierdzać sobie.
- **Ciężki obieg (approval / review / role manager-admin) = OPCJONALNY, za flagą zespołową**, domyślnie UKRYTY.
- Anty-wzór: 6-stopniowy łańcuch Draft→Submit→Review→Approve→Generate blokujący solo-userowi własny raport („Blocked" bo brak roli).
- Panel edukacyjny/metodologiczny („canon intro") ≠ element ekranu roboczego → do help/tooltipa.

---

## 6. WIDOCZNOŚĆ WG GOTOWOŚCI (TWARDE)

- **Niegotowy moduł ukryty PRZED WSZYSTKIMI, w tym adminem/właścicielem**, do czasu gotowości (`BETA_ADMINS_EXEMPT=false`). Właściciel nie ma oglądać pustych modułów „bo admin".
- Badge „beta" tylko gdy realnie beta; moduł GA → bez badge.

---

## 7. LISTA CZEKOWANIA — „gęstość" (przy KAŻDYM ekranie, literalnie)

Odbiór ekranu = przejść to punkt po punkcie, oczami na zrzucie (jak część B TRIADY):

1. [ ] Toolbar ≤ 5 widocznych akcji, reszta w „…"?
2. [ ] Żadna akcja nie występuje w 2 miejscach (pasek ≠ kebab)?
3. [ ] Kebab/menu: każda pozycja ma realny handler (zero szarych martwych)?
4. [ ] Jedno wejście do AI / do danej funkcji (nie 3–5)?
5. [ ] Żaden panel/karta nie jest wypełniony w < 50%?
6. [ ] Meta (daty/status/completion) w jednym pasku, nie w wielkich blokach?
7. [ ] Brak wielkiego hero/opisu na ekranie roboczym?
8. [ ] Layout wypełnia szerokość — brak martwej prawej połowy?
9. [ ] Hub ≤ 6 zakładek?
10. [ ] Zero dwóch zakładek/widoków na ten sam dataset?
11. [ ] Reużyto istniejący komponent (grep sprawdzony) — nie zbudowano drugiego?
12. [ ] Zero martwych komponentów (0 importerów) i plików `* 2`?
13. [ ] Ciężki governance domyślnie ukryty dla solo?
14. [ ] Nowy element ma callera / miejsce użycia w tym kroku?
15. [ ] Wynik: ekran gęsty i płytki, nie płaski wysyp?

---

## 8. CO ZŁAPIE HOOK (mechanicznie) vs CO ZOSTAJE OSĄDEM

**`check-gestosc.sh` (twarda blokada / ostrzeżenie):**
- BLOK: zdublowane ID akcji na 2 powierzchniach (§1).
- BLOK: nowy komponent 0-importerów w diffie (§3).
- BLOK: plik `* 2.tsx/ts` w diffie (§3).
- OSTRZEŻENIE: toolbar > 5 akcji bez overflow (§1).
- OSTRZEŻENIE: hub > 6 zakładek (§4).
- OSTRZEŻENIE: dwie zakładki o zbliżonym id/dataset (§4, heurystyka).

**Zostaje osądem skilla + bramką zrzutu (hook NIE złapie):**
- „pół panelu puste" / budżet przestrzeni (§2),
- gęstość informacji, hero-na-roboczym,
- reuse-first w sensie „czy to naprawdę to samo",
- proporcjonalność governance.

→ Dlatego potrzebne OBIE warstwy: hook (regresje mechaniczne) + skill/odbiór (osąd przestrzeni).

---

## 9. ANTY-WZORCE (z audytu 07-11 — konkret, nie teoria)
Karta „Workflow status" pół-pusta · pasek węzła (19) ≈ kebab (40) w 70% · 3× lista inicjatyw · 4 ośrodki raportów · Billing ×3 · podwójny toolbar canvasa · `roi`+`roi_analysis` · 4 surface'y DRD · 6-stopniowy obieg solo · `BETA_ADMINS_EXEMPT=true` · 195× `* 2.tsx` · martwy `AssessmentWorkflowPanel` 949 lin.

## 10. WZORCE DOBRE (już w repo — „rób jak te")
`NotebookHamburgerMenu` (pozycje tylko z handlerem) · `NModeToolbar` (sloty warunkowe lewa/środek/prawa) · `ArtifactRightPanel` (3 sekcje w accordionie) · `NotebookRightRail` (4 panele → 2 taby) · Materials (4 wpisy → 1 hub) · `IdeaMapConsolidatedPanel` (3 drawery → 1 accordion).

---
*Powiązania: [[TRIADA_KANON]], [[ARTIFACT_ANATOMY_STANDARD]], `_AUDYT_NADMIAR_ELEMENTOW_2026-07-11.md`, `_PLAN_ODCHUDZANIA.html`. Po akcepcie Piotra: skill `consultify-gestosc` (pigułka dla robotnika) + hook `check-gestosc.sh` (blokada regresji).*
