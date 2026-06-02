# Light Mode Readability Standard

> **Status:** Canonical  
> **Scope:** Wszystkie ekrany light mode w Consultify, ze szczególnym naciskiem na listy, tabele, badge'e statusów, metadata i helper surfaces.

---

## 1. Cel

Light mode ma być projektowany jako osobny, pełnoprawny wariant UI.

Nie kopiujemy wprost proporcji kontrastu z dark mode. W light mode:

- czytelność wygrywa z "lekkością",
- metadata ma pozostać czytelna bez wysiłku,
- semantyczne kolory muszą wspierać znaczenie, a nie rozmywać tekst.

---

## 2. Hierarchia kontrastu

W light mode obowiązują tylko 4 podstawowe poziomy tekstu:

- **Primary text:** `text-slate-900`
- **Secondary text:** `text-slate-700`
- **Supportive text:** `text-slate-600`
- **Metadata / placeholder:** `text-slate-500`

### Zakazy

- Nie używać `text-slate-400` dla treści użytkowej.
- Nie używać `text-blue-400`, `text-amber-400`, `text-purple-400`, `text-emerald-400` na jasnym tle dla badge'y, statusów, meta i CTA.
- Nie obniżać czytelności przez `opacity` jako główne narzędzie budowania hierarchii.

### Dodatkowe reguły

- Tekst poniżej `14px` musi mieć kontrast co najmniej poziomu `text-slate-600`.
- Uppercase helper labels i mikroetykiety nie mogą być jaśniejsze niż `*-700` przy tintowanych powierzchniach.

---

## 3. Surface hierarchy

W light mode stosujemy trzy czytelne warstwy:

- **App background:** `bg-slate-50`
- **Primary surface:** `bg-white border-slate-200`
- **Secondary / nested surface:** `bg-slate-50 border-slate-200`

### Zasady

- Każdy ważny kontener musi mieć czytelną separację przez tło, border albo oba.
- Hover ma zmieniać tło i/lub border, nie tylko kolor tekstu.
- Selected state ma być widoczny bez zgadywania: `bg-primary-50 border-primary-200 ring-primary-200`.

### Zakazy

- Nie używać `bg-white` na wszystkim bez separacji.
- Nie używać ultra-subtelnych borderów typu `border-*/10` dla kart informacyjnych w light mode.

---

## 4. Semantic surfaces

W light mode semantic UI budujemy na wzorcu:

- **info:** `bg-blue-50 border-blue-200 text-blue-800 icon-blue-600`
- **success:** `bg-emerald-50 border-emerald-200 text-emerald-800 icon-emerald-600`
- **warning:** `bg-amber-50 border-amber-200 text-amber-800 icon-amber-600`
- **danger:** `bg-red-50 border-red-200 text-red-800 icon-red-600`
- **primary:** `bg-primary-50 border-primary-200 text-primary-800 icon-primary-600`

### Zakazy

- `bg-*-500/20 text-*-400`
- `bg-*-500/10 text-*-300`
- pastelowy tekst na pastelowym tle

---

## 5. Status chips i badge taxonomy

Status badge w light mode musi zawierać:

- pełne tło `50` lub `100`,
- border `200`,
- tekst `700` lub `800`,
- opcjonalny dot w kolorze `500` lub `600`.

### Kanoniczne mapowanie

- **assigned / neutral:** `bg-slate-100 border-slate-200 text-slate-700`
- **in progress / info:** `bg-blue-100 border-blue-200 text-blue-700`
- **submitted / review / warning:** `bg-amber-100 border-amber-200 text-amber-800`
- **sent back / rejected / danger:** `bg-red-100 border-red-200 text-red-800`
- **approved / completed / success:** `bg-emerald-100 border-emerald-200 text-emerald-800`

### Implementation rule

Jeśli badge ma działać w obu trybach, light mode i dark mode muszą mieć osobne klasy, a nie jeden kompromisowy zestaw.

---

## 6. Lists, tables, inboxes

Dla list i tabel obowiązuje:

- tytuł wiersza: `text-slate-900 font-medium`
- meta wiersza: `text-slate-600`
- trzeciorzędne info: `text-slate-500`
- header kolumn: `text-slate-600`
- empty states: `text-slate-600` dla głównego komunikatu

### Dodatkowe reguły

- Nie opieramy rozpoznania statusu wyłącznie na kolorze tekstu.
- Progress track nie może zlewać się z tłem.
- Count chips i filter chips muszą mieć wyraźny stan aktywny i nieaktywny.

---

## 7. Forms i helper content

W formularzach i runtime workspaces:

- pytanie / tytuł: `text-slate-900`
- helper text: `text-slate-600`
- additional context / supporting copy: `text-slate-600`
- input: `bg-white border-slate-300 text-slate-900 placeholder-slate-400`
- focus: `ring-2 ring-primary-300 border-primary-400`

Callouty typu `Hint`, `What we look for`, `Expected format` muszą używać semantic surfaces z ciemnym tekstem.

---

## 8. Navigation i sidebar

W light mode:

- aktywny item: `bg-primary-50 text-primary-700`
- nieaktywny item: `text-slate-700`
- supporting meta: `text-slate-500`
- ikony nieaktywne: `text-slate-500`

Sidebar nie może wyglądać jak placeholder ani "wypłowiała wersja dark mode".

---

## 9. Accessibility baseline

- Standardowy tekst: minimum WCAG AA 4.5:1
- Duży tekst i badge text: minimum 3:1, preferencyjnie wyżej
- Kolor nigdy nie może być jedynym nośnikiem statusu
- Małe etykiety 11-12px wymagają wyższego kontrastu niż standardowe body text

---

## 10. Review checklist

Każdy nowy lub poprawiany ekran light mode sprawdzamy pod kątem:

1. Czy nazwa/treść główna jest natychmiast czytelna?
2. Czy metadata nadal jest czytelna bez wytężania wzroku?
3. Czy badge statusu da się odczytać bez dark mode?
4. Czy hover i selected są widoczne przez tło/border?
5. Czy helper surfaces mają ciemny tekst na jasnym tintowanym tle?
6. Czy nie pojawił się `text-slate-400` jako tekst roboczy?

---

## 11. Definition of done

Ekran w light mode jest gotowy tylko wtedy, gdy:

- statusy są czytelne bez zoomu,
- metadata i helper text nie znikają na białym tle,
- semantic surfaces mają poprawną relację tła, borderu i tekstu,
- projekt nie korzysta z zakazanych zestawów typu `bg-*/20 + text-*/400`.
