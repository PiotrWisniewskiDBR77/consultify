# MVP FINAL — zamrożenie modułu (jedna strona, dla właściciela)

**Po co to jest.** Odbierasz MVP moduł po module. Po Twoim „tak" moduł ma zostać taki,
jaki go zobaczyłeś — i nikt (człowiek ani agent) nie ma go już zmieniać. Do tej pory taka
obietnica żyła tylko w czyjejś pamięci. Teraz jest maszyną: **kod zamrożonego modułu
przestaje dać się zmienić**, dopóki ktoś świadomie nie napisze, że odmraża i na podstawie
której Twojej decyzji.

---

## 1. Co się dzieje po Twoim „tak"

Uruchamiamy jedną komendę, np.:

```
node scripts/mvp-final/zamroz.mjs --modul=13_CHAT --decyzja="Odbiór 05.09: tak, tak zostaje"
```

Ona robi cztery rzeczy:

1. **Wypisuje listę plików tego modułu** — nie z opisu, tylko z kodu: idzie od ekranów
   modułu po wszystkich importach i zbiera, co realnie ten moduł składa.
2. **Zapisuje zrzuty ekranów z dnia odbioru jako WZORCE** (`evidence/mvp-final/13_CHAT/`).
   To jest dowód „tak wyglądało, gdy powiedziałeś tak".
3. **Dopisuje wpis do rejestru** `docs/program/MVP_FINAL_ZAMROZONE.json` — z datą,
   Twoimi słowami i listą plików.
4. **Zakłada znacznik w historii (tag git)** `mvp-final-13_CHAT-<data>` — punkt, do którego
   zawsze można wrócić.

---

## 2. Co się dzieje, gdy ktoś potem tknie ten moduł

Próba zapisania zmiany w pliku zamrożonego modułu **kończy się odmową**:

```
⛔ COMMIT ZABLOKOWANY: ruszasz moduł ZAMROŻONY jako MVP final.
   Właściciel odebrał ten moduł i powiedział: „po zatwierdzeniu nie będziesz go już zmieniał".
   [13_CHAT] src/components/AIChat/UnifiedChatPanel.tsx
```

Blokada jest wpięta w mechanizm zapisu (hook `commit-msg`), więc działa u **każdego**, kto
pracuje w tym repozytorium — także u agentów, także w nocy, także gdy nikt nie pamięta,
że ten moduł był odbierany.

---

## 3. Odmrożenie — jedyna droga

Gdy zmiana jest naprawdę konieczna (np. znaleziony błąd, który trzeba naprawić przed
pokazaniem klientowi), autor zmiany musi napisać ją w opisie zapisu:

```
[ODMROZENIE 13_CHAT DEC-318]
```

gdzie `DEC-318` to numer **Twojej decyzji**. Bez numeru decyzji zapis dalej jest odrzucany.
Znacznik zostaje w historii na zawsze, więc:

- widać, **ile razy** wracaliśmy do modułu, który już odebrałeś,
- widać, **na czyją zgodę**,
- nikt nie może „przypadkiem" poprawić zamrożonego ekranu i o tym nie powiedzieć.

**Zasada:** brak decyzji = brak odmrożenia. Zmiana idzie na listę „po MVP", nie do kodu.

---

## 4. Czego zamrożenie NIE obejmuje (świadomie)

| Co | Dlaczego |
|---|---|
| **Testy** (`__tests__`, `*.test.tsx`) | Zamrażamy produkt, nie dowód. Testy wolno dopisywać zawsze. |
| **Dokumentacja i zrzuty** (`docs/`, `evidence/`) | Rejestr i dowody muszą dać się aktualizować. |
| **Elementy wspólne** (tabele, menu, przyciski — kanon UI) | Są dzielone przez wiele modułów, więc są zamrażane **osobno**: `--modul=WSPOLNE`. Dopóki nie są zamrożone, zmiana tam może zepsuć zamrożony ekran, i dlatego jest krok 5. |

Przy każdym zamrożeniu narzędzie mówi wprost, **ile plików modułu zostaje poza ochroną**
i że chroni je dopiero zamrożenie wspólnych. Nie udaje, że chroni wszystko.

---

## 5. Sprawdzenie, czy ekran nadal wygląda tak samo

Zamrożenie plików nie wystarcza — ekran można zepsuć zmianą w elemencie wspólnym.
Dlatego jest druga komenda, która **robi świeże zrzuty tych samych ekranów i porównuje
je z wzorcami z dnia odbioru**:

```
ODBIOR_AUTH_STATE=<plik logowania> node scripts/mvp-final/porownaj.mjs --modul=13_CHAT
```

Wynik to tabela: `ekran → ZGODNY / RÓŻNI SIĘ (% pikseli)` plus obraz `diff.png`
z zaznaczonymi na czerwono miejscami, które się zmieniły. Ekran, którego nie dało się
odtworzyć, jest oznaczony jako **NIE ZMIERZONO** — i to nie znaczy „zgodny".

---

## 6. Kolejność, którą proponuję na 05.09

1. Odbierasz moduł → mówisz „tak".
2. My: `zamroz.mjs --modul=<MODUL> --decyzja="<Twoje słowa>"`.
3. Powtarzamy dla kolejnych modułów.
4. Gdy odebrane są wszystkie: `zamroz.mjs --modul=WSPOLNE` — zamyka też kanon UI.
   (Wcześniej nie, bo zamrożenie wspólnych zablokowałoby pracę nad modułami, których
   jeszcze nie odebrałeś.)
5. Przed każdym pokazem: `porownaj.mjs` na modułach, żeby zobaczyć na obrazkach,
   że nic nie odjechało.

---

## 7. Gdzie co leży

| Rzecz | Ścieżka |
|---|---|
| Rejestr zamrożeń | `docs/program/MVP_FINAL_ZAMROZONE.json` |
| Wzorce (zrzuty z odbioru) | `evidence/mvp-final/<MODUL>/` |
| Zamrażanie | `scripts/mvp-final/zamroz.mjs` |
| Bezpiecznik (blokada) | `scripts/mvp-final/check-freeze.sh` → `.husky/commit-msg` |
| Porównanie ze wzorcem | `scripts/mvp-final/porownaj.mjs` |
| Testy bezpiecznika | `tests/unit/mvp-final/` (`npm run mvp-final:test`) |
