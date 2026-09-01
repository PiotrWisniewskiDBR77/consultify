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

## Dlaczego tego nie widać w produkcie
Robotnik zmierzył: `ImageStylePreset` występuje **wyłącznie we własnym pliku typów
i we własnym komponencie**. Zero wołaczy z zewnątrz. Komponent **nie jest nigdzie
renderowany**.

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
