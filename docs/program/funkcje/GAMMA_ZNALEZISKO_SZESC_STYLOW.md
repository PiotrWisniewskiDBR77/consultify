---
doc_id: funkcje-gamma-szesc-stylow
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# „To już było przygotowywane w kodzie" — właściciel miał rację. Znaleźliśmy to.

Właściciel, 31.08: *„prezentacje mają wyglądać jak z gamma.app. **To już było
przygotowywane w kodzie**."* Rekonesans G-0 szukał tego w rendererach i stylerach
i znalazł tam sporo — ale **nie to**.

## Znalezione przy pisaniu instrukcji 228

`src/components/Presentations/wizard/types.ts:96` — **sześć presetów stylu obrazu**,
gotowych, nazwanych:

| preset | odpowiednik u Gammy |
| --- | --- |
| `corporate_photography` | photography |
| `abstract_geometric` | abstract |
| `flat_illustration` | illustration |
| `data_focused` | — (nasz własny, sensowny dla doradztwa) |
| `industry_realistic` | — (nasz własny, przemysł) |
| `minimal_no_images` | — (świadomy brak obrazu) |

Do tego gotowy komponent wyboru `ImageStyleSelector.tsx` z ikonami
(`Camera · Hexagon · Palette · BarChart3 · Factory · Type`) i strukturą
`ImageStyleInfo` z kluczami tłumaczeń.

**Sześć — dokładnie tyle, ile właściciel wskazał z pamięci** („z sześciu typów
obrazów"). Ktoś w tym zespole rozłożył Gammę na czynniki wcześniej niż my.

## ★ SPROSTOWANIE NADZORCY (w tej samej godzinie) — komponent JEST renderowany

Napisałem wyżej „komponent nie jest nigdzie renderowany". **To była nieprawda i
przyczyną był mój własny grep**: użyłem w powłoce `zsh` przełącznika, który
unieważnił wyszukiwanie, i dostałem pustkę interpretowaną jako „zero wołaczy".
**Ten sam błąd popełniłem dziś już raz** przy liczeniu twierdzeń w komentarzach —
wtedy dał „zero" przy 600 trafieniach.

Pomiar poprawny:
- `ImageStyleSelector` **jest wołany** — `SetupStep.tsx:291`, eksportowany też
  w `wizard/index.ts:3`;
- `SetupStep` **jest renderowany** — `PresentationWizard.tsx:300`.

**Czyli użytkownik ten wybór WIDZI i może go dokonać.**

## Gdzie przewód jest naprawdę przerwany

Zmierzone: wybrana wartość **nie pojawia się w żądaniu do backendu** — brak
jakiegokolwiek `imageStyle`/`image_style` w warstwie wysyłającej kreatora.
Po stronie serwera pole istnieje, ale **żyje własnym życiem**:
- `presentations.routes.ts:2155` ustawia `image_style_preset: 'minimal_no_images'`
  **na sztywno**;
- `presentationGeneratorService.ts:2073` podaje `imageStylePreset: v.styleHint || 'corporate'`
  — wartość spoza sześciu presetów kreatora;
- `presentationVisionQAService.ts:14,85` czyta `imageStylePreset` i wkleja go do
  polecenia dla modelu — **czyli ogniwo „styl trafia do polecenia" ISTNIEJE**.

**Wniosek jest mocniejszy niż pierwotny:** to nie jest martwy kod czekający na
zbudowanie. To **kompletny łańcuch z jednym przerwanym przewodem pośrodku** —
człowiek wybiera styl, model dostaje styl, ale **nie ten, który człowiek wybrał**,
tylko wartość zaszytą na sztywno.

Dyżur 228 robi się przez to **mniejszy i pewniejszy**: przeprowadzić wybór
użytkownika przez żądanie do miejsca, które już umie go użyć.

To jest **trzeci martwy kanał** wykryty w tej okolicy jednego dnia:
1. edytor krojów i kolorów — dane **giną przy zapisie** (backend nie odbiera pola);
2. trzynaście zestawów kolorystycznych — zapisywane, **nigdy nieczytane** przy eksporcie;
3. **sześć stylów obrazu — gotowe, nigdy niepodłączone**.

## Co to zmienia w dyżurze 228
Zadanie przestaje brzmieć „zbuduj wybór stylu obrazu". Brzmi: **„podłącz to, co już
jest, i dołóż brakujące ogniwo — doklejanie stylu do polecenia"**. Punkt dyspozycji
zmierzony: `deckVisualsService.ts::generateImageVisual` (okolice `:599`) — jedyne
wspólne miejsce, przez które przechodzi polecenie generowania obrazu.

Odpada za to hipoteza z rekonesansu, że punktem zaczepienia są
`deckImageResolverService.ts` i `iconSuggestionService.ts` — **oba mają
potwierdzone zero wołaczy i są martwym kodem**, nie fundamentem.

## Wzorzec, który się powtarza
Trzy razy w jednym module: **ktoś zbudował właściwą rzecz i nie podłączył ostatniego
przewodu.** To nie jest dług projektowy — to dług **integracyjny**, i jest tańszy do
spłacenia, niż wyglądał.
