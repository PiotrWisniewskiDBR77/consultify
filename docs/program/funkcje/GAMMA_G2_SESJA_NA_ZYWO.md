---
doc_id: funkcje-gamma-g2-sesja
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# G-2: przejście procesu Gammy od środka — na koncie właściciela

Właściciel udostępnił swoje płatne konto (*„tam nie ma tajemnic"*) i poprosił:
*„zrób sobie prezentację sam o Consultify — zobacz, jak proces wygląda"*.
Wygenerowano deck o Consultify, 10 slajdów, polski, 16:9.

## ★ Odkrycie nr 1: Gamma ma DWA tryby projektowania slajdu

Ukryte pod przełącznikiem „Slide design mode" na ekranie generowania:

| tryb | opis Gammy (werbatim) |
| --- | --- |
| **Classic** | „Flexible slides with **editable text, images, and layout blocks**" |
| **Studio** | „Every slide is a **single image with embedded text**. **Edit by asking AI**" |

**To jest wyjaśnienie efektu „wow" i zagadki układów.** Właściciel mówił, że
formatów jest mało i się powtarzają — bo w trybie Studio **układ nie istnieje**:
slajd jest obrazem. Stąd swoboda kompozycji nieosiągalna dla żadnego silnika
układów, i stąd „agent, któremu mówisz, co zmienić" — bo zmiana to **regeneracja
obrazu**, nie edycja pola tekstowego.

**Konsekwencja dla nas:** nasz sufit (`pptxgenjs`: brak gradientów, brak osadzania
fontów) przestaje być głównym ograniczeniem, jeśli pójdziemy ścieżką „wypal slajd
jako obraz". Ale tracimy wtedy edytowalność w PowerPoint. **To jest realny wybór
produktowy, nie techniczny detal.**

## ★ Odkrycie nr 2: domyślne płótno to „Fluid", nie 16:9
Rozmiary: **Default (Fluid)** · Traditional (16:9) · Tall (4:3). Potwierdza
zastrzeżenie analityka, że jego pomiary nie były 16:9 — i wyjaśnia, dlaczego
prezentacje Gammy „przewijają się" jak strona, a nie jak slajdy.

## ★ Odkrycie nr 3: kolejność potwierdzona co do przycisku
Przycisk po wpisaniu polecenia nazywa się **„Generate outline"**, nie „Generate".
Gamma **najpierw napisała konspekt** — 10 tytułów z tezami, do przejrzenia i edycji
— i dopiero po zatwierdzeniu ruszyła produkcja slajdów. **Element 3 właściciela
potwierdzony mechanicznie**, nie z opisu.

Konspekt był rzeczowy i trafił w domenę: „Problem: doradztwo nie skaluje się",
„Diagnoza dojrzałości", „Realizacja i monitoring", „Przewaga dla partnera".

## ★ Odkrycie nr 4: obrazy generowane per slajd, dopasowane treścią I kolorem
Okładka dostała **wygenerowane zdjęcie hali przemysłowej z robotem** — w chłodnym
błękicie, który **zgadza się z paletą decku** (fiolet/granat/magenta). Dokładnie to,
o czym mówił właściciel: obraz pasuje tym, co pokazuje, **oraz** kolorem.

W trakcie generowania widać **szare pola z animacją** w miejscach obrazów — czyli
tekst i układ powstają pierwsze, obrazy dochodzą asynchronicznie.

## ★★ Odkrycie nr 5: Gamma generuje INFOGRAFIKI z wtopionym tekstem — po polsku
Slajd „Realizacja i monitoring" dostał **wygenerowaną grafikę informacyjną**: jasna
karta, rakieta, dashboardy, wykres, trzy strzałkowe kafle — **z poprawnym polskim
tekstem wypalonym w obrazie** („Śledzenie wdrożeń w czasie rzeczywistym",
„Kwantyfikacja wartości").

To jest funkcja reklamowana u nich jako **„Imagine: an AI canvas for graphic
design"**. I to jest **najtrudniejsza do dogonienia rzecz z całej Gammy** —
trudniejsza niż typografia i niż układy.

Uwaga metodyczna: dokumentacja Gammy sama ostrzega, że modele **dodają niechciany
tekst mimo zakazu**. Tu tekst jest **chciany i poprawny** — czyli mają nad tym
kontrolę, której mechanizmu **nie znamy**.

## Odkrycie nr 6: motyw należy do workspace'u, nie do decku
Deck powstał od razu w ciemnym motywie DBR77, **z logo w rogu**, bez pytania o
wygląd. Marka jest ustawiona raz, na poziomie przestrzeni roboczej.

## Zaobserwowane archetypy układu (deck Consultify + deck Dobot × DBR77)
1. **okładka**: tekst lewo ~60%, zdjęcie prawo ~40% pełnospadowe;
2. **tytuł + karty numerowane + zdjęcie z prawej** (karty mają obrys, nie cień);
3. **rząd pierścieni z ikonami liniowymi** — proces w czterech krokach;
4. **infografika z lewej + tekst z prawej**;
5. **rząd wielkich liczb** (`150+ / 4-6 wk / $0`) z etykietami pod spodem;
6. **pas wyniku** — zielone pole z jednym zdaniem konkluzji;
7. **siatka kafli produktowych** ze zdjęciami.

Zgadza się z tezą właściciela: **archetypów jest mało i wracają.**

## Co to zmienia w naszym planie
1. **Prototyp jasny był błędem kierunku** — Wasze decki są **ciemne**. Poprawiam.
2. **Decyzja do podjęcia: Classic czy Studio.** Czyli: slajd składany z bloków
   (edytowalny, nasz obecny sufit) kontra slajd wypalony jako obraz (swoboda
   kompozycji, brak edycji w PowerPoint). **To jest decyzja właściciela.**
3. **Kolejność budowy potwierdzona**: treść → układ → obraz → agent redagujący.
4. **Infografiki z tekstem to osobny, największy kamień.** Nie obiecywać ich
   w pierwszej fali.
