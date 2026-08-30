---
doc_id: grafika-stan-listy-poprawek
status: canonical
truth_type: measurement
established: 2026-08-30
mierzone_o: "17:40"
---

# Stan listy poprawek właściciela — pomiar 2026-08-30 17:40

## Powód powstania tego pliku

Właściciel przy przejęciu sesji powiedział: *„byłem przekonany, że od dwóch godzin
Twój poprzednik to naprawiał"*. **Nie naprawiał.** Ten plik jest trwałym zapisem
stanu faktycznego, żeby nikt więcej nie pracował na przekonaniu zamiast na liczbie.

## Pomiar

Źródło: `odbior.sqlite`, tabele `decyzje` (stan bieżący) i `poprawki` (zgłoszenia
napraw). Kryterium „ruszone": istnieje wpis w `poprawki` dla tego ekranu z
**późniejszym** znacznikiem czasu niż decyzja właściciela.

| | liczba |
| --- | --- |
| Uwag właściciela („poprawka" + „nie") | **63** |
| Ruszonych — czekają na ponowne kliknięcie właściciela | **8** |
| **Nietkniętych** | **55** |

Ostatnia decyzja właściciela: `2026-08-30T11:50`.
Ostatnia naprawa zgłoszona: `2026-08-30T15:07`.
Decyzji właściciela po 13:00: **0**.

### Ruszone (8)
karta-insight · karta-initiative · results-vnext-roi-full-tool · ideas-teresa-panel ·
mywork-notebook-rail-speca · excele-edytowalna-siatka · document-studio-resume-error ·
document-studio-template-resolve-error

### Co robiono zamiast listy (12:00–17:30)
Wspólny system prawego pasa (10 szyn), karty N dla ROI/wskaźnika/celu, wydawanie
i odbiór dyżurów toru funkcji 164–173. **Praca wartościowa, ale nie ta, na którą
właściciel czekał.** Rozjazd oczekiwania z pracą trwał ~2,5 godziny.

## Wniosek dla następcy

**Lista właściciela jest torem numer jeden i nie ustępuje niczemu innemu.** Praca
własna nadzorcy (prawy pas, kanony, karty N) idzie równolegle robotnikami, nigdy
zamiast. Po każdej partii napraw wołaj `odbior-poprawka.mjs` — inaczej właściciel
nie ma jak zobaczyć, że coś się stało, i słusznie zakłada, że nic się nie stało.
