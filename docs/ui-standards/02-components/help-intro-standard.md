# Help + Intro — Standard UI/UX

> **Status:** PROPOSED (do adopcji jako standard)  
> **Ostatnia aktualizacja:** 2026-03-06  
> **Zakres:** Intro aplikacji, contextual help, entry points do AI, micro-guidance

## Cel

Zdefiniować **delikatny, nienachalny standard** dla:

- **Intro do aplikacji** — wyjaśnia logikę systemu i pomaga zacząć,
- **Help kontekstowego** — tłumaczy bieżący ekran,
- **AI entry points** — pomagają wykonać następną decyzję lub akcję,
- **micro-guidance** — wspiera bez zasłaniania interfejsu.

Ten standard ma sprawić, że użytkownik:

- rozumie **jak działa Consultify jako całość**,
- rozumie **po co istnieje bieżący ekran**,
- może **wejść głębiej tylko wtedy, gdy chce**,
- nie czuje się bombardowany onboardingiem, tooltipami ani modalami.

---

## Zasada nadrzędna

**Help wyjaśnia pracę. AI pomaga wykonać pracę.**

To są dwie różne role:

- **Intro / Help**: orientacja, zrozumienie, struktura, spokojne prowadzenie
- **AI**: interpretacja, podsumowanie, sugestia następnego kroku, wsparcie decyzji

**MUST:** nie mieszać tych ról w jeden agresywny onboarding.

---

## 1. Zasady UX (MUST)

### 1.1 Nienachalność

- **MUST:** żaden onboarding ani help nie może blokować wejścia do pracy dłużej niż 1 decyzję usera.
- **MUST NOT:** autoplay video, seria modali, forced wizard przy każdym wejściu.
- **MUST NOT:** zalew tooltipów na całym ekranie.
- **SHOULD:** help ma być zawsze dostępny, ale domyślnie spokojny i dyskretny.

### 1.2 Progressive disclosure

- **MUST:** najpierw pokazujemy minimum potrzebne do orientacji.
- **MUST:** szczegóły są rozwijane dopiero po kliknięciu `Pokaż więcej`, `Quick guide`, `FAQ`, `Zapytaj AI`.
- **SHOULD:** user ma dostać 1 trafną wskazówkę zamiast 8 średnich.

### 1.3 Context-first

- **MUST:** help opisuje **dokładnie ten ekran / tab / sub-tab**, na którym user aktualnie pracuje.
- **MUST NOT:** używać jednego ogólnego opisu dla całego modułu, jeśli user jest już wewnątrz konkretnej powierzchni roboczej.
- **SHOULD:** help ma odpowiadać na 3 pytania:
  - Po co jest ten ekran?
  - Co tu teraz robię?
  - Co powinno wydarzyć się dalej?

### 1.4 Quiet tone

- **MUST:** copy jest krótkie, konkretne, operacyjne.
- **MUST NOT:** ton marketingowy, infantilizujący, „wow”, „magic”.
- **SHOULD:** język spokojny, pewny, pomocniczy.

---

## 2. Architektura doświadczenia

System wsparcia użytkownika ma 4 warstwy:

1. **Intro systemowe** — „jak działa Consultify”
2. **Help ekranowy** — „po co jest ten ekran”
3. **Micro-help sytuacyjny** — „na co uważać tutaj”
4. **AI action entry** — „pomóż mi zrobić kolejny krok”

### Reguła:

- **Intro** = od ogółu do struktury
- **Help** = od struktury do bieżącego działania
- **AI** = od działania do decyzji / wykonania

---

## 3. Intro do aplikacji (KANON)

### 3.1 Rola intro

Intro nie jest szkoleniem.

Intro ma:

- dać użytkownikowi **mental model aplikacji**,
- pokazać **jak czytać system**,
- doprowadzić do **pierwszego sensownego kroku**.

### 3.2 Format intro

**MUST:** intro jest **soft welcome**, nie wizard.

Preferowany format:

- 1 lekka karta / panel startowy
- maks. 1 decyzja usera
- 3 ścieżki:
  - `Pokaż mi system`
  - `Zacznę sam`
  - `Zapytaj AI`

### 3.3 Treść intro (kolejność obowiązkowa)

1. **Mapa pracy w Consultify**
2. **5 etapów journey**
3. **4 moduły wspierające**
4. **Jak używać Help + AI**
5. **Pierwszy krok**

### 3.4 Copy intro (maksymalny zakres)

**MUST:** intro mieści się w:

- 1 nagłówku
- 1 krótkim akapicie
- 5 krótkich kartach / punktach journey
- 1 lekkim bloku „moduły wspierające”
- 1 CTA do pierwszego kroku

### 3.5 CTA intro

Intro ma prowadzić do działania, nie do czytania kolejnych ekranów.

Preferowane CTA:

- `Przejdź do Interview`
- `Pokaż mój obszar pracy`
- `Zapytaj AI, od czego zacząć`

---

## 4. Help ekranowy (KANON)

### 4.1 Struktura każdego helpa

Każdy ekran helpa powinien mieć stały układ:

1. **Po co jest ten ekran**
2. **Co tu robisz**
3. **Na co uważać**
4. **Co dalej**
5. **Ask AI**

### 4.2 Limity treści

**MUST:**

- sekcja `Po co` = 1 krótki akapit
- sekcja `Co tu robisz` = 2–4 punkty
- sekcja `Na co uważać` = 1–3 punkty
- sekcja `Co dalej` = 1 krótki akapit / 1 zdanie

**MUST NOT:**

- długie eseje,
- ściany tekstu,
- dokumentacja techniczna w pierwszym poziomie.

### 4.3 Kolejność informacji

User najpierw ma wiedzieć:

1. **dlaczego ekran istnieje**
2. **jaką ma teraz wykonać pracę**
3. **jakiego błędu uniknąć**
4. **gdzie pójść dalej**

Nie odwrotnie.

---

## 5. Micro-help (delikatne wsparcie)

### 5.1 Gdzie wolno go używać

Micro-help stosujemy tylko tam, gdzie user może realnie:

- nie rozumieć stanu pustego,
- popełnić kosztowny błąd,
- nie wiedzieć, co oznacza dany mechanizm,
- potrzebować interpretacji danych.

### 5.2 Dopuszczalne formy

- `Empty state hint`
- `Subtle callout`
- `Quiet inline hint`
- `Single warning before risky action`
- `Contextual Ask AI`

### 5.3 Niedopuszczalne formy

- seria tooltipów po całym ekranie,
- automatyczne otwieranie helpa przy każdym wejściu,
- pop-up „czy chcesz tutorial?” po każdej akcji,
- onboarding overlay zasłaniający workflow.

---

## 6. AI w helpie

### 6.1 Rola AI

AI ma pomagać **interpretować** i **ruszyć dalej**, a nie powtarzać dokumentację.

### 6.2 Standardowy przycisk

Preferowany label:

- `Ask AI about this screen`
- `Zapytaj AI o ten ekran`

### 6.3 Typy promptów

Dla każdego ekranu AI powinno umieć wykonać jedną z 4 ról:

1. **Explain** — „co tu jest najważniejsze?”
2. **Review** — „co wygląda podejrzanie?”
3. **Prepare** — „jaki powinien być bezpieczny kolejny krok?”
4. **Summarize** — „podsumuj to dla operatora”

### 6.4 Reguły UX

- **MUST:** AI entry point jest widoczny, ale nie dominuje nad helpem.
- **MUST NOT:** AI zastępuje podstawowy opis ekranu.
- **SHOULD:** prompt jest automatycznie kontekstowy dla bieżącego ekranu, roli i etapu.

---

## 7. Tone of voice

### MUST

- spokojny
- konkretny
- operacyjny
- bez nadmiaru słów
- bez marketingu

### SHOULD

- „tu ustawiasz…”
- „tu sprawdzasz…”
- „użyj tego ekranu, gdy…”
- „po tej zmianie zweryfikuj…”

### MUST NOT

- „ten niesamowity ekran pozwala…”
- „magicznie wygenerujesz…”
- „wystarczy tylko kliknąć…”

---

## 8. Wzorce treści

### 8.1 Template dla intro

**Nagłówek:**  
`Jak działa Consultify`

**Lead:**  
`Consultify prowadzi pracę od zrozumienia stanu obecnego do oceny realnych efektów.`

**Journey cards:**  
- `Interview` — zbierasz fakty i kontekst  
- `Tools + Assessments` — określasz jak powinno być  
- `Initiatives` — planujesz drogę zmiany  
- `Execution` — realizujesz zmianę  
- `Results` — oceniasz efekt

**Support modules:**  
- `My Work`
- `Ideas / Workplace / Notes`
- `Finance`
- `Reports / Presentations`

**CTA:**  
`Pokaż mi pierwszy krok`

### 8.2 Template dla helpa ekranowego

**Po co jest ten ekran**  
1 krótki akapit.

**Co tu robisz**
- punkt 1
- punkt 2
- punkt 3

**Na co uważać**
- punkt 1
- punkt 2

**Co dalej**  
1 krótkie zdanie.

**Ask AI**  
1 kontekstowy prompt.

---

## 9. Zachowania systemowe

### 9.1 Kiedy pokazać intro

**SHOULD:**

- przy pierwszym wejściu do aplikacji,
- po dużych zmianach w architekturze produktu,
- gdy user sam kliknie `Jak działa system?`

**MUST NOT:**

- przy każdym logowaniu,
- po każdej zmianie modułu,
- jako forced blocker przed pracą.

### 9.2 Kiedy automatycznie otwierać help

**Dopuszczalne tylko gdy:**

- user wchodzi na nowy, złożony ekran po raz pierwszy,
- ekran jest pusty i bez helpa niezrozumiały,
- wystąpił błąd, który wymaga kontekstu operacyjnego.

W pozostałych przypadkach help ma być dostępny, ale nie otwierać się sam.

---

## 10. Wzorce wizualne

### Intro

- spokojna karta / panel
- bez ciężkiego modala fullscreen, jeśli nie jest konieczny
- jedna dominująca myśl wizualna
- maks. 1 kolorowy akcent CTA

### Help

- panel boczny lub lekki drawer
- wyraźna hierarchia sekcji
- małe bloki tekstu
- brak agresywnych warningów, jeśli nie ma realnego ryzyka

### Micro-help

- inline
- mały
- semantyczny
- łatwy do zignorowania bez szkody dla flow

---

## 11. Antywzorce

- onboarding jako seria 5–7 modali
- autoplay filmów
- tooltip tour po całym UI
- help opisujący cały moduł, gdy user jest w sub-tabie
- AI button jako główna rzecz na ekranie
- help pisany jak dokumentacja administratora systemu ERP
- to samo copy powielone w 10 ekranach

---

## 12. Checklist dla implementacji

- [ ] Czy intro wyjaśnia logikę aplikacji, a nie tylko funkcje?
- [ ] Czy intro prowadzi do pierwszego kroku?
- [ ] Czy help odpowiada dokładnie bieżącemu ekranowi?
- [ ] Czy help ma układ: po co / co tu robisz / na co uważać / co dalej / AI?
- [ ] Czy treść jest krótka i operacyjna?
- [ ] Czy AI pomaga interpretować i działać, a nie zastępuje help?
- [ ] Czy nic nie otwiera się agresywnie bez wyraźnego powodu?
- [ ] Czy user może zignorować pomoc i dalej spokojnie pracować?

---

## 13. Rekomendacja dla Consultify

Docelowy model:

- **Intro** = mapa systemu i pierwszy krok
- **Help** = instrukcja bieżącego miejsca
- **AI** = partner do decyzji i wykonania następnej akcji

To ma tworzyć doświadczenie:

**spokojne, czytelne, wspierające, ale nigdy natarczywe.**
