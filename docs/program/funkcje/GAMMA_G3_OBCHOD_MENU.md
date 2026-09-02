---
doc_id: funkcje-gamma-g3-obchod
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# G-3: obchód wszystkich menu Gammy — od środka, na koncie właściciela

Właściciel: *„przeklikaj jeszcze wszystkie menu dookoła, żeby poznać, jakie funkcje mają"*.

## ★★★ ODKRYCIE NAJWAŻNIEJSZE: mechanizm dopasowania koloru obrazu — ROZSTRZYGNIĘTY

Analityk G-1 zapisał to jako **nieustalone** i sam oznaczył swoją rekomendację
(duotone po generacji) jako **własną decyzję inżynierską, nie odtworzenie Gammy**.
Teraz wiemy, jak jest naprawdę.

**Motyw → zakładka „Images" → pole „Style prompt":**
> *„Give your AI images a consistent style. **These keywords will be appended to your
> prompts when generating AI images**."*

Treść tego pola w motywie `theme_DBR77` właściciela:
> *„Inspirational and vibrant with a high tech and futuristic appeal, **utilizing a
> gradient of fuchsia, pink, and royal blue** for a creative and aesthetic impact."*

**Czyli Gamma stosuje wariant A — paletę w poleceniu**, nazwaną słownie, doklejaną
do KAŻDEJ generacji obrazu w tym motywie. Nie duotone po fakcie. Prosto i skutecznie.

Pod spodem: **„Image styles"** — *„define named image styles — each with its own
prompt guidance **and reference images**. Once a theme has named styles, they replace
the style prompt."* Czyli styl może mieć **obrazy referencyjne**, nie tylko słowa.

Trzy przykłady pokazane w interfejsie na tym samym motywie (most Golden Gate):
`photo, professional photography, warm lighting, street photo` ·
`abstract shapes, illustration, playful, fun modern, startup, tech` ·
`claymation style, clay sculpture, clay art, play-doh, bright, colorful, upbeat`.

## ★★ Dwa tryby projektowania slajdu (przełącznik przy generowaniu)
- **Classic** — „flexible slides with editable text, images, and layout blocks";
- **Studio** — **„every slide is a single image with embedded text. Edit by asking AI"**.

Studio wyjaśnia i „wow", i to, że układów jest mało: **w Studio układ nie istnieje**.

## ★★ Edytor motywu — sześć zakładek. To jest wzorzec dla naszego martwego edytora
`Colors · Fonts · Logo · Design · Images · Charts`. Motyw `theme_DBR77` ma podpis:
**„367 gammas are using this theme"** — czyli jeden motyw obsługuje 367 prezentacji.

**Colors:** akcent podstawowy może być **gradientem** (`#581CA0 10%, #371C9C 90%`) ·
akcenty dodatkowe (dowolna liczba) · kolor nagłówka, treści, linku, przycisku ·
sekcja **Accessibility** z automatycznym sprawdzaniem kontrastu — przy każdym polu
znaczek `Aa` z zielonym potwierdzeniem.
**To jest dokładnie bramka kontrastu, którą analityk zalecał (≥4,5:1) — u nich
wbudowana w edytor, nie w proces.**

**Design:** trzy zakresy (`Slides` / `Blocks & content` / `Buttons & links`), a w nich
**zaokrąglenie** (4 stopnie) · **cień** (3 stopnie) · **obramowanie** (brak/cienkie/
średnie/grube) · kolor obramowania · **odstęp wewnętrzny** (S/M/L).

Właściciel ma **sześć motywów per linia biznesowa**: `theme_DBR77` (domyślny),
`_Consul…`, `_DT`, `_IoT`, `_IRIS`, `_Market…`.

## ★ Gamma ma API
Menu motywu: `Edit · Duplicate · Copy share link · **Copy themeId for API** · Archive`.
**To otwiera trzecią drogę, której nie rozważaliśmy: nie budować renderera, tylko
wołać Gammę.** Decyzja biznesowa (zależność od zewnętrznego dostawcy, koszt, dane
klientów wychodzą na zewnątrz) — nie techniczna. Do rozmowy z właścicielem.

## Biblioteka komponentów — cztery menu wstawiania

**Basic blocks:** Title, H1-H4, Blockquote, Label · tabele 2×2/3×3/4×4 · listy
punktowana/numerowana/zadaniowa · **ramki komunikatów**: Note, Info, Warning,
Caution, Success, Question.

**Images (11 źródeł):** Image upload/URL · Web image search · **AI images** ·
**AI infographics (BETA)** · Stock photos · GIFs · **Pictographic illustrations** ·
**Icons (classic)** · **Icons (modern)** · QR Code · **Accent images** · Gallery.

**Smart layouts:** kolumny 2-6 · **dwanaście rodzajów kafli** (Solid, Solid with
icons, Outline, Side line boxes, Side line text, Top line text, Top circle boxes,
Joined boxes, Joined boxes with icons, Leaf boxes, Labeled boxes, Alternating boxes)
· punktory duże/małe/strzałkowe. Podpowiedź w interfejsie: *„Drag and drop a smart
layout block to change layouts"* — **układ jest przeciągalnym klockiem, nie szablonem slajdu.**

**Smart diagrams (24+):** Semi circle road · Target · Minimal road · Linear venn ·
Linear venn filled · Diamonds · Minimal funnel · Connected circles · Concentric
circles · Funnel 3d · Road · Isometric building · Isometric globe · Isometric dashed
squares · Gears · Pillar · Orbit · Venn · Chain · Bullseye · Ribbon arrows · Ideas ·
Inputs · Quadrant…

**Charts (14 + 3 schematy):** liniowy, warstwowy, kolumnowy, kolumnowy skumulowany,
słupkowy, słupkowy skumulowany, kołowy, pierścieniowy, złożony, punktowy, bąbelkowy,
mapa cieplna, lejkowy, wodospadowy + Blank diagram, Weekly calendar, **Gantt**.

**Embed:** strona/aplikacja · Gamma embed · plik · Google Drive · Figma · Instagram ·
Tweet · Miro · Airtable · Amplitude · Office 365 · **PowerBI**.

## Agent redagujący — element 3 właściciela, zobaczony w działaniu
Panel `Agent` pokazuje **dziennik tego, co zrobił** („Created slide 1… 10"), a po
zakończeniu **sam proponuje następne ruchy**: „Add 2 more slides" · „Find related case
studies" · **„Visualize text-heavy slides"**. Pole: *„Ask me to edit, create, or style
anything"* + przycisk `Quick edits`.

## Co z tego bierzemy — kolejność bez zmian, ale z konkretami
1. **Style prompt w motywie** — najtańsza do skopiowania rzecz o największym efekcie.
   Jedno pole tekstowe doklejane do generacji obrazu. **Robimy to pierwsze.**
2. **Kontrast wbudowany w edytor**, nie w proces odbioru.
3. **Układ jako przeciągalny klocek**, nie szablon slajdu — inna architektura, niż
   zakładaliśmy.
4. **Nasz martwy edytor motywu** ma gotowy wzorzec sześciu zakładek.
5. **Studio kontra Classic** — decyzja właściciela, opisana w `GAMMA_G2_SESJA_NA_ZYWO.md`.
6. **API Gammy** — trzecia droga, do rozmowy.

## Higiena
Motyw właściciela otwarty w trybie edycji **i zamknięty przez `Cancel`** — żadna
zmiana nie została zapisana. Wygenerowano jeden deck testowy o Consultify (10
slajdów) na wyraźną prośbę właściciela.

---

# G-3 (ciąg dalszy) — menu dokumentu. Właściciel: *„poczekaj, to może jeszcze nie koniec"*

Miał rację. Pod przyciskiem `…` siedzi warstwa, której nie było w bocznych paskach.

## ★★★ NAJWAŻNIEJSZE: Gamma sama ostrzega, że PPTX się rozjedzie

Panel eksportu, na naszym własnym decku, **bez pytania**:

> ⚠ **„1 slide has overflowing content"** — *„Layouts may shift after exporting to
> PowerPoint and Google Slides"* — z przyciskiem **„Go to slides"**.

**To jest potwierdzenie z najlepszego możliwego źródła.** Analityk G-1 przewidział
ten problem („podmiana kroju zmienia złamania wierszy", „identyczny render w
PowerPoint/Keynote/Google Slides — NIEMOŻLIWE") i wpisał go jako największe ryzyko.
Teraz wiemy, że **Gamma, wzorzec, którego nie umiemy dogonić, ma dokładnie ten sam
problem — i nie udaje, że go nie ma.**

**Ich rozwiązanie do skopiowania 1:1:** wykryj przepełnienie **przed** eksportem,
powiedz o tym wprost, i **daj link do slajdu, który się nie mieści**. Nie milcz i nie
próbuj ratować autodopasowaniem (które i tak psuje typografię).

To zamyka też decyzję o formacie dystrybucji: **PDF dla odbiorcy, PPTX dla
edytujących** — bo tak działa nawet Gamma.

**Jakość eksportu** ma trzy stopnie: `Basic` (mniejszy plik, niższa jakość) ·
`Standard` (domyślny, rekomendowany) · `Detailed` (najlepsza jakość, duży plik).
**Formaty:** PDF · PowerPoint · Google Slides.

## ★★ Deck pamięta swoje źródło — „View source prompt"

Pozycja `View source prompt` **cofa do ekranu generowania z zachowanym poleceniem
ORAZ konspektem**. Czyli prezentacja niesie w sobie pełne pochodzenie: z jakiego
polecenia powstała i przez jaką narrację przeszła — i da się z tego wygenerować ponownie.

To jest wzorzec, który u nas ma **bezpośredni odpowiednik**: dyżur 207 wprowadził
`source_type='ai_chat_proposal'` i `source_id` przy zadaniach z czatu. **Ta sama
zasada, inny obiekt.** Warto ją rozciągnąć na dokumenty i decki.

## Pozostałe pozycje menu dokumentu
`Settings` · `Undo` · `Add to favorites` · **`Version history`** · `View source prompt` ·
**`Logo, colors, fonts`** (skrót do edytora motywu) · **`Page setup`** · `Export` ·
`Comments` · **`Analytics`** (kto oglądał i jak długo) · **`Publish to site`**
(prezentacja jako strona internetowa) · `Duplicate` · **`Create from this (Remix)`** ·
**`Save copy as template`** · `Delete`.

Dwie z nich opisują model pracy, którego u nas nie ma:
- **`Save copy as template`** — szablon powstaje **z gotowego, udanego decku**, a nie
  jest projektowany osobno. To odwrotność naszego `TemplateBuilder`.
- **`Publish to site`** — ten sam obiekt jest prezentacją i stroną. Stąd „Fluid" jako
  domyślne płótno.

## Koszt zmierzony
Licznik kredytów: **6 108 → 6 018**. Wygenerowanie decku 10 slajdów z obrazami
kosztowało **90 kredytów**.

## Higiena
Motyw zamknięty przez `Cancel` — zero zmian. Ekran generowania opuszczony przez
`Back` — **nie wygenerowano drugiego decku**. Nic nie pobrano, nic nie opublikowano.
