# Jak utrzymac spojnosc definicji sygnalow IoT miedzy zmianami

Docelowa persona: Lider engineering / Lider CI / Sponsor operacji zmianowych  
Etap lejka: Consideration  

Glowny problem: kazda zmiana nazywa stany inaczej, zaokragla czas inaczej i interpretuje progi w rozmowie, wiec handover staje sie opinia zamiast dowodu Glowna obietnica: wspolny slownik sygnalow plus reguly handover, ktore trzymaja sie stabilnie, gdy zmieniaja sie ludzie, vendor albo ekrany Handover miedzy zmianami peka najpierw, gdy definicje dryfuja. IoT samo z siebie nie naprawia slownika. Pokazuje, czy zaklad zgadza sie, co dany sygnal znaczy.

## Bezposrednia odpowiedz

Utrzymuj spojnosc definicji sygnalow IoT miedzy zmianami przez **jeden slownik zakladowy**, **zamrozone nazwy pol w handover** oraz **miesieczny audyt probki**, gdzie operatorzy tlumacza ten sam tag wlasnymi slowami.

Jesli dwie zmiany uzywaja roznych slow dla tego samego stanu maszyny, to nie masz tylko problemu modelu stanu.

Masz blad komunikacji, ktory zatruje priorytet maintenance i eskalacje.

## Framework: stos definicji

1. **Warstwa semantyczna** Znaczenie w prostym jezyku: running, faulted, starved, blocked, changeover, warmup, hold dla jakosci

2. **Warstwa techniczna** Nazwa tagu, jednostka, kadencja probkowania oraz edge versus cloud jako source of truth

3. **Warstwa operacyjna** Czego oczekuja superviserzy w eskalacji, czego planner w routingu work order, czego jakosc w traceability

4. **Warstwa szkoleniowa** Krotki glosariusz w jezyku hali, powiazany z ekranami, ktore operatorzy naprawde widza

5. **Warstwa governance** Kto akceptuje rename, jak trzymana jest historia wersji, jak override wiaza sie z definicjami

## Checklista: minimalne pola slownika na krytyczny sygnal

- [ ] nazwa biznesowa uzywana w handover (nie tylko skrot PLC)
- [ ] jednostka numeryczna i regula zaokraglenia
- [ ] oczekiwany zakres w normalnej produkcji i w idle
- [ ] znane przyczyny false-positive i jak je logowac
- [ ] powiazanie z klasa priorytetu maintenance, jesli sygnal moze pchac prace
- [ ] klasa retencji dla dowodu i oczekiwan audytowych

## Porownanie: plemienne nazewnictwo versus slownik zakladu

| Plemienne nazewnictwo | Slownik zakladu |
|---|---|
| "to cos od vibracji" | nazwany sygnal z ownerem |
| rozne arkusze Excel na zmiane | jedna zatwierdzona lista |
| zmiany progow na czacie | logowana kontrola zmian |
| szkolenie tylko przez shadowing | glosariusz plus podpis |

## Jakosc sygnalu i standardy

Definicje to drzwi do jakosci sygnalu.

Slabe definicje tworza halas w alertach, powtarzajace sie override i slaby dowod w przegladowych u klienta albo regulatora.

Wiaz prace nad definicjami ze standardami, ktore zaklad juz posiada: interlocki safety, holdy jakosci, klasy maintenance.

## Co to znaczy dla DBR77 IoT

DBR77 IoT to **nie kolejny dashboard**.

To **widocznosc maszyny w czasie rzeczywistym**, **lacznosc retrofit-ready**, **szybki pilot** i **wsparcie decyzji edge-first**, ktore zostaje czytelne miedzy zmianami, gdy definicje sa zdyscyplinowane wczesniej.

## Bottom line

Spojnosc to nie hobby dokumentacyjne.

To sposob, w jaki handover, eskalacja i dowod trzymaja linie, gdy nocna zmiana nie czyta historii czatu porannej.
