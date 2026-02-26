# UI/UX Standard dla Modułów Consultinity

> **Złoty standard referencyjny: ClickUp**

## Struktura Ekranu Modułu

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Module > Surface/Tool                      [System] [LLM] [AI] [User]          │
├─────────────────────────────────────────────────────────────────────────────────┤
│  🔍 │ [Tab 1] [Tab 2] [Tab 3]      │ [AI] [+New] ≡ ⊞ │ [Filters…]              │
├─────────────────────────────────────────────────────────────────────────────────┤
│  [≡ List] [Doc 1 ●] [Doc 2 ●] [Doc 3 ●]                    (dynamic tabs)       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  TYPE ▼    NAME                 CATEGORY    STATUS ▼   PROGRESS   UPDATED       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ...       ...                  ...         ...        ...        ...           │
│            (content area - table/kanban/matrix/timeline)                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Nagłówek (Breadcrumbs)

- **Lokalizacja:** Lewy górny róg
- **Zawartość (KANON v3):** `Module > Surface/Tool`  
  Przykłady:
  - `My Work > Ideas`
  - `Tools > Strategic Analysis`
  - `Reports > Builder`
- **❌ NIE MA:** Dużego napisu z nazwą modułu - informacja już jest w breadcrumbs

---

## 2. Pasek Nawigacji Głównej

### Lewa strona:

| Element         | Opis                                                 |
| --------------- | ---------------------------------------------------- |
| **🔍 Lupa**     | Mała ikona, po kliknięciu rozwija panel wyszukiwania |
| **Główne taby** | Przyciski nawigacji do rodzajów danych w module      |

**Przykłady tabów dla różnych modułów:**

| Moduł               | Taby                                               |
| ------------------- | -------------------------------------------------- |
| **Discovery Tools** | Discovery, Reports, Initiatives                    |
| **Assessment**      | Assessment, Reports, Initiatives                   |
| **Initiatives**     | Draft, Planning, Review, Approved, Executing, Done |
| **Execution**       | Initiatives, Tasks, Decisions, Reports             |
| **Benefits**        | Completed, KPIs, ROI Analysis                      |

### Prawa strona:

| Element              | Opis                                                           |
| -------------------- | -------------------------------------------------------------- |
| **AI context**       | Kanoniczny przycisk “AI w kontekście” — otwiera lewy panel czatu dla bieżącego kontekstu |
| **Primary CTA**      | “+ New …” (kontekstowy)                                        |
| **View Toggle**      | Przełącznik formatu: ≡ Table, ⊞ Grid, Kanban, Matrix, Timeline |
| **Filters**          | Filtry kontekstowe (np. All/Read/Unread)                       |

### Kolejność elementów topbara (KANON v3)

W module hub (w tym samym rzędzie), zawsze trzymamy kolejność:

- **Lewa strona**: Search toggle → Main tabs (od lewej do prawej, zgodnie z Operating Model v3)
- **Prawa strona (wyrównane do prawej)**: **AI context** → **Primary CTA (+New)** → **View modes** → **Filters**

**Przykłady category buttons:**

| Moduł               | Przyciski                                       |
| ------------------- | ----------------------------------------------- |
| **Discovery Tools** | Strategy, Operations, Digital, Process Auto     |
| **Assessment**      | + New Assessment (otwiera modal z frameworkami) |
| **Initiatives**     | AI Generate, + New Initiative                   |

---

## 3. Pasek Dynamicznych Kart (Dynamic Tabs)

- **Lokalizacja:** Pod główną nawigacją
- **Zawartość:** Otwarte dokumenty/strony w kontekście modułu
- **Elementy:**
  - `[≡ List]` - przycisk powrotu do listy
  - `[SWT Sales Process S... ●]` - otwarta karta z kodem typu i statusem (kropka kolorowa)
- **Zachowanie:**
  - Można otworzyć wiele kart jednocześnie
  - Aktywna karta = **fioletowa ramka**
  - Karty można zamykać (×)
  - Max ~6 widocznych, reszta w overflow menu (+N)

---

## 4. Tabela Danych

### Nagłówki kolumn z filtrami:

| Kolumna  | Filtrowalna   | Sortowalna |
| -------- | ------------- | ---------- |
| TYPE     | ✅ (dropdown) | ❌         |
| NAME     | ❌            | ✅         |
| CATEGORY | ✅ (dropdown) | ❌         |
| STATUS   | ✅ (dropdown) | ❌         |
| PROGRESS | ❌            | ✅         |
| UPDATED  | ❌            | ✅         |
| ACTIONS  | ❌            | ❌         |

### Filtry w nagłówkach:

- Kliknięcie na ▼ otwiera dropdown z opcjami
- Checkbox multiselect
- Przyciski Clear / Apply

---

## 5. Formaty Prezentacji Danych

| Format       | Ikona | Użycie                             |
| ------------ | ----- | ---------------------------------- |
| **Table**    | ≡     | Domyślny, lista z kolumnami        |
| **Grid**     | ⊞     | Karty w siatce                     |
| **Kanban**   | ▭▭▭   | Kolumny statusów (Draft → Done)    |
| **Matrix**   | ⊞⊞    | Macierz 2D (np. priority × impact) |
| **Timeline** | ━━━   | Gantt-style timeline               |

---

## 6. Kolorystyka i Stany

### Aktywny element:

```css
/* Fioletowa ramka + lekkie tło */
border: 1px solid #8b5cf6;
background: rgba(139, 92, 246, 0.1);
```

### Nieaktywny element:

```css
/* Szara ramka */
border: 1px solid #374151;
background: transparent;
```

### Statusy (kropki kolorowe):

| Status    | Kolor           |
| --------- | --------------- |
| Draft     | ⚫ Szary        |
| In Review | 🟠 Pomarańczowy |
| Approved  | 🟢 Zielony      |
| Completed | 🟢 Zielony      |
| Blocked   | 🔴 Czerwony     |
| Executing | 🔵 Cyan         |

---

## 7. Wyszukiwanie

### Kompaktowa lupa:

- Mała ikona 🔍 po lewej stronie
- Kliknięcie rozwija pole `Search...`
- Wyszukiwanie globalne w module

### Filtry w tabeli:

- Dropdown w nagłówkach kolumn
- Multiselect z checkboxami
- Apply/Clear buttons

---

## Standard tabel aplikacji (Golden Standard)

Jeśli ekran jest “hubem tabelarycznym” (listy, zarządzanie, admin tools), obowiązuje **App Table Standard**:

- Dokument: `docs/ui-standards/03-modules/app-table-standard.md`
- Wzór: “Decisions” (My Work)
- Referencyjna adopcja: “Report Templates” (Admin)

---

## 8. Responsywność

- **Desktop (>1024px):** Pełny layout
- **Tablet (768-1024px):** Zwinięte category buttons, mniejsze odstępy
- **Mobile (<768px):** Bottom navigation, uproszczone taby

---

## 9. Moduły z tym standardem

| Moduł           | Status              |
| --------------- | ------------------- |
| Discovery Tools | ✅ Zaimplementowany |
| Assessment      | ✅ Zaimplementowany |
| Initiatives     | 🔄 Do aktualizacji  |
| Execution       | 🔄 Do aktualizacji  |
| Benefits        | 🔄 Do aktualizacji  |
| Economics       | 🔄 Do aktualizacji  |
| Reports         | 🔄 Do aktualizacji  |

---

## 10. Wyjątki

### Moduły BEZ tego standardu:

- **AI Chat** - pełnoekranowy interfejs czatu
- **Settings** - własny layout ustawień
- **Admin** - własny layout administracyjny
- **SuperAdmin** - własny layout

---

## Referencje

- **Złoty standard:** [ClickUp](https://clickup.com)
- **Komponenty:** `src/components/shared/ModuleHub/`
- **Przykład implementacji:** `src/components/Discovery/DiscoveryToolsHub.tsx`
