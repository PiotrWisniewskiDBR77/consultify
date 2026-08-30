---
doc_id: grafika-kanon-z-odbiorow
status: canonical
truth_type: ui-standard-increment
established: 2026-08-30
---

# Kanon wywiedziony z odbiorów właściciela

**Po co ten plik.** Dokumentacja graficzna jest rozległa, ale niekompletna.
Za każdym razem, gdy właściciel **zatwierdza** ekran zawierający rozwiązanie,
którego standard nie opisuje — reguła ląduje tutaj. Dzięki temu przy kolejnych
modułach jest **coraz mniej pytań**, a każdy moduł ma większą autonomię.

**Format: jedna linia na regułę.** Data · reguła · ekran-źródło. Nie esej.
Reguła stąd ma **tę samą moc** co reguła z `docs/ui-standards/` — bo pochodzi
z bezpośredniego odbioru właściciela.

## Reguły

| Data | Reguła | Ekran-źródło |
| --- | --- | --- |
| 2026-08-30 | Status artefaktu to **pigułka z tekstem**, nigdy naga kropka — kropka zapada się do zera na wąskim ekranie | wzorzec `INS-2026-014` |
| 2026-08-30 | Znacznik zapisu („Zapisano 29.08, 14:07") stoi **osobno** od statusu cyklu życia i jest nieklikalny | wzorzec `INS-2026-014` |
| 2026-08-30 | Zakładki niosą **licznik postępu** (`3/6`, `2/4`), nie samą nazwę | wzorzec `INS-2026-014` |
| 2026-08-30 | Prawy panel ma **stałą kolejność**: Akcje · Właściwości · Powiązania · Źródła i założenia · Komentarze · Historia | wzorzec `INS-2026-014` |
| 2026-08-30 | Pewność wyniku nazywa się **wprost** („Niewystarczające · potrzebna walidacja"), nigdy nie jest ukrywana pod paskiem postępu | wzorzec `INS-2026-014` |
| 2026-08-30 | Teza modelu jest oznaczona jako **interpretacja, nie fakt**, i mówi, czego brakuje do rozstrzygnięcia | wzorzec `INS-2026-014` |
| 2026-08-30 | Braki są **wymienione z nazwy** — zakaz zbiorczego „brak danych" | wzorzec `INS-2026-014` |
| 2026-08-30 | Tam, gdzie widok jest ograniczony, ekran mówi wprost: **„liczba 0 nie oznacza braku działań"** | wzorzec `INS-2026-014` |
| 2026-08-30 | Uprawnienia pokazujemy jako **Możesz / Nie możesz** z zamkami, a nie przez ukrywanie kontrolek | wzorzec `INS-2026-014` |
| 2026-08-30 | Ograniczenie widoku podpisujemy jako **ograniczenie widoku**, nie jako stan danych | wzorzec `INS-2026-014` |
| 2026-08-30 | ★ **Nagie zero jest zakazane.** Licznik `0` wynikający z trybu widoku musi stać obok zdania, które mówi, że **liczba opisuje widok, nie obiekt**. Sekcja z takim zdaniem jest **rozwinięta** — zwinięta chowałaby dokładnie to, co miało przestać wprowadzać w błąd | karta Inicjatywy, sekcja „Akcje" w Podglądzie |
| 2026-08-30 | ★ **Ta reguła ZASTĘPUJE zakaz z 2026-07-24** („w Podglądzie sekcja zwinięta z licznikiem 0, bez komunikatu opisowego"). Zakaz dotyczył komunikatu o **trybie** po angielsku („Actions are hidden in preview mode"); nowa reguła wymaga komunikatu o **znaczeniu liczby**, po polsku | rozstrzygnięcie właściciela 2026-08-30 |

2026-08-30 | ★ **Ozdoba, która porusza się w czasie, kłamie na nieruchomym zrzucie.**
Krążąca crimsonowa smuga wokół pola pisania Teresy (`CHAT-OWN-012`) wygląda na
zrzucie jak rysa albo błąd renderowania — dwóch niezależnych robotników zgłosiło ją
jako defekt i żaden nie znalazł źródła, bo element **zmienia położenie między
zrzutami** i jest pseudo-elementem CSS, nie klasą w komponencie.
**Reguła:** zanim zgłosisz „linię nieznanego pochodzenia", zrób drugi zrzut z innym
czasem osiadania. Jeśli obiekt się przesunął — to animacja, nie defekt układu, i
szukaj go w `index.css`, nie w drzewie strony.
