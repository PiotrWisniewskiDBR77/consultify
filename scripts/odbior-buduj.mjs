/**
 * Buduje PARTIĘ ODBIORU (2026-07-23) z dwóch stron naraz:
 *   B) pozycje w `rejestr/3-DO-ODBIORU/<ID>.md` — SSOT, historia decyzji w gicie
 *   A) fragment HTML galerii („Odbiór") z miniaturami wklejonymi jako data-URI
 *      (CSP artefaktu nie wpuszcza zewnętrznych obrazów) → `rejestr/_zrzuty/_galeria.html`
 *
 * Werdykty wracają przez `window.claude.downloads` (JSON) — jedyny dostępny
 * kanał artefakt→dysk; nadzorca czyta plik i przenosi pozycje do 4-ODEBRANE /
 * 5-ODRZUCONE. Artefakty NIE mają trwałego stanu ani callbacku.
 *
 * Użycie: node scripts/odbior-buduj.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ZRZUTY = path.resolve('rejestr/_zrzuty');
const MINI = path.join(ZRZUTY, 'mini');
const DO_ODBIORU = path.resolve('rejestr/3-DO-ODBIORU');
const PARTIA = '2026-07-23';

/** Jedna pozycja odbioru = jedna rzecz, na którą Piotr mówi tak/nie/popraw. */
const POZYCJE = [
  {
    id: 'ODB-EXCEL-01',
    tytul: 'Gen. Excel — zakładka „Generator szablonów Excel" (7 wzorców)',
    narzedzie: 'Gen. Excel',
    flaga: 'ff_workbook_templates (domyślnie OFF — czeka na Twój flip)',
    zmiana: 'Nowe wejście w hubie Materiałów: rejestr parametrycznych wzorców arkuszy. Rejestr urósł z 1 do 7 modeli z ŻYWYMI formułami (P&L 3 scenariusze, budżet 12M, DCF, próg rentowności, cashflow 12M, unit economics SaaS, harmonogram kredytu).',
    sprawdz: 'Czy to jest wejście, którego oczekujesz dla „generatora arkuszy"? Czy nazwa zakładki i opisy wzorców są zrozumiałe dla konsultanta?',
    ryzyko: 'Flaga OFF — dziś nikt tego nie widzi. Flip = natychmiast +Menu/+Nawigacja dla Gen. Excel.',
  },
  {
    id: 'ODB-EXCEL-02',
    tytul: 'Gen. Excel — formularz parametrów + zapis presetu',
    narzedzie: 'Gen. Excel',
    flaga: 'ff_excele (istniejąca, ON)',
    zmiana: 'Parametry pogrupowane (Ogólne / Przychody / Koszty / Koszty stałe) z wartościami domyślnymi. Nowość: „Zapisz zestaw parametrów" → nazwany preset zapisywany lokalnie, wczytywany jednym kliknięciem, kasowalny.',
    sprawdz: 'Czy preset parametrów to realna oszczędność w Twojej pracy? Czy zapis lokalny (per przeglądarka) wystarcza, czy ma być współdzielony w organizacji?',
    ryzyko: 'ZNANY BŁĄD (nie z tej nocy): pola procentowe pokazują wartość ×100 (3% → „300"). Do naprawy osobno — powiedz czy priorytetowo.',
  },
  {
    id: 'ODB-EXCEL-03',
    tytul: 'Gen. Excel — wynik: mini-wykres + siatka formuł + badge jakości',
    narzedzie: 'Gen. Excel',
    flaga: 'ff_excele (istniejąca, ON)',
    zmiana: 'Po zbudowaniu skoroszytu widzisz OD RAZU: badge jakości z krytyka (wynik/100 + uwagi), mini-wykres słupkowy z danych liczbowych, siatkę komórek z ŻYWYMI formułami (=y1*1.12, =SUM(...)) w foncie mono. Wcześniej był tylko link do pobrania.',
    sprawdz: 'Czy podgląd „przed pobraniem" daje Ci zaufanie do modelu? Czy wykres jest potrzebny, czy zbędny ozdobnik?',
    ryzyko: 'Zakładki arkuszy pokazują „Sheet 1/2" zamiast nazw („Założenia"/„Podsumowanie") — drobiazg do poprawy.',
  },
  {
    id: 'ODB-DECK-01',
    tytul: 'Gen. Deck — Architekt: sylwetki slajdów + wskazówki + briefing',
    narzedzie: 'Gen. Deck',
    flaga: 'ff_deck_architect (istniejąca, ON)',
    zmiana: 'Każdy slajd ma: sylwetkę layoutu (podgląd układu zależny od typu slajdu), edytowalne „Content guidance" (wskazówki treści) oraz pola briefingu — Teza / Dane do zebrania / Sugerowana wizualizacja. Wszystko edytowalne w szkicu i zapisywane z szablonem.',
    sprawdz: 'Czy to jest poziom prowadzenia autora, którego oczekujesz od „generatora szablonów"? Czy brakuje jakiegoś pola?',
    ryzyko: 'Pola opisują STRUKTURĘ (co zebrać), świadomie nie zmyślają liczb — szablon ma być wielokrotnego użytku.',
  },
  {
    id: 'ODB-DECK-02',
    tytul: 'Gen. Deck — chipy wizualizacji + wycofanie szkicu',
    narzedzie: 'Gen. Deck',
    flaga: 'ff_deck_architect (istniejąca, ON)',
    zmiana: 'Nad listą slajdów: „Suggested visualizations" i „Mandatory slides" jako chipy (czytelne na pierwszy rzut oka). Nowa akcja „Withdraw / delete draft" (czerwona = semantyka krytyczna) — tylko dla szkiców, pyta o powód, zatwierdzone wymagają klonowania.',
    sprawdz: 'Czy czerwień na „Withdraw/delete" jest OK (to jedyne dozwolone użycie crimson)? Czy chipy powinny być po polsku?',
    ryzyko: 'Etykiety chipów po angielsku — do spolszczenia razem z resztą i18n.',
  },
  {
    id: 'ODB-DECK-03',
    tytul: 'Deck — badge jakości na wyniku kreatora',
    narzedzie: 'Deck',
    flaga: 'ENABLE_DECK_QUALITY_GATES (ON)',
    zmiana: 'Po wygenerowaniu decka: nie-blokujący, zwijany badge „Jakość: N ostrzeżeń" + „Score N/100" z krytyka kompozycji i walidacji strukturalnej. Przy okazji naprawiony realny błąd: odpowiedź generacji gubiła te ostrzeżenia (stary snapshot zmiennej) — liczyły się „do szuflady".',
    sprawdz: 'Czy chcesz widzieć wynik jakości od razu po generacji? Czy score/100 to dobra forma, czy wolisz słowny werdykt?',
    ryzyko: 'Świadomie NIE blokuje pobrania decka — to informacja, nie bramka.',
  },
  {
    id: 'ODB-WORD-01',
    tytul: 'Gen. Word — Architekt: wskazówki + briefing edytowalny (szkic)',
    narzedzie: 'Gen. Word',
    flaga: 'ff_tpl_editor (istniejąca, ON)',
    zmiana: 'Każda sekcja szablonu ma edytowalne: Content guidance, Key message, Data needed, Suggested evidence. Odpowiednik briefingu z Decka, spięty z zapisem struktury szablonu.',
    sprawdz: 'Czy zestaw pól (teza / dane / typ dowodu) pokrywa to, czego potrzebuje autor dokumentu?',
    ryzyko: 'ETYKIETY PO ANGIELSKU (Key message, Data needed…) — brak kluczy PL. Do spolszczenia; powiedz czy blokuje akcept.',
  },
  {
    id: 'ODB-WORD-02',
    tytul: 'Gen. Word — podgląd struktury dokumentu',
    narzedzie: 'Gen. Word',
    flaga: 'ff_tpl_editor (istniejąca, ON)',
    zmiana: 'Przyklejony panel „Structure preview": sylwetka dokumentu — wcięcie wg poziomu nagłówka, liczba linii proporcjonalna do oczekiwanej długości sekcji, kropka przy sekcjach obowiązkowych. Pokazuje „kształt" dokumentu bez zmyślania treści.',
    sprawdz: 'Czy sylwetka pomaga ocenić proporcje dokumentu przed generacją? Czy powinna pokazywać też tytuły sekcji?',
    ryzyko: 'Świadomie bez tekstu — tylko geometria, żeby nie sugerować nieistniejącej treści.',
  },
  {
    id: 'ODB-WORD-03',
    tytul: 'Word — badge fabrykacji w panelu QA',
    narzedzie: 'Word',
    flaga: 'bez flagi (sygnał liczy się zawsze)',
    zmiana: 'Panel QA pokazuje wynik detektora fabrykacji: „Zweryfikowane — brak niepopartych liczb" albo „Zdegradowane (N nieoznaczonych liczb)" z rozwijaną listą podejrzanych wartości. Sygnał istniał, ale nie był widoczny.',
    sprawdz: 'Czy to jest ostrzeżenie, które chcesz widzieć przed wysłaniem dokumentu klientowi? Czy próg (precyzyjne liczby bez „(założenie)") jest dobrze ustawiony?',
    ryzyko: 'Nie blokuje pracy; twarda bramka eksportu partnerskiego działa osobno i bez zmian.',
  },
];

function b64(file) {
  return fs.readFileSync(file).toString('base64');
}

function md(p) {
  return `---
id: ${p.id}
tytul: ${p.tytul}
typ: odbior-wizualny
waga: srednia
obszar: DOK
stan: do-odbioru
wlasciciel: piotr
partia: ${PARTIA}
narzedzie: ${p.narzedzie}
flaga: ${p.flaga}
zrzut: rejestr/_zrzuty/${p.id}.png
zrzut_dark: rejestr/_zrzuty/${p.id}-dark.png
utworzone: ${PARTIA}
---

## 1. CO SIĘ ZMIENIŁO

${p.zmiana}

## 2. NA CO PATRZEĆ

${p.sprawdz}

## 3. RYZYKO / ZNANE OGRANICZENIA

${p.ryzyko}

## 4. JAK ZWERYFIKOWANO

Zrzut wykonany automatem (\`scripts/odbior-zrzuty.mjs\`) z harnessu dev-render na mock-danych — bez logowania, bez bazy.
Oba motywy (light + dark) zrzucone i obejrzane przez nadzorcę PRZED pokazaniem właścicielowi (CLAUDE.md reguła #7).
Zero błędów konsoli. Pełne zrzuty: \`rejestr/_zrzuty/${p.id}.png\` oraz \`-dark.png\`.

## 5. ODBIÓR

- **werdykt:** _(do wypełnienia: akceptuję / poprawka / odrzucam)_
- **komentarz:** _(tu wpisz uwagi — albo wypełnij w zakładce „Odbiór" w raporcie i pobierz JSON)_
- **data:**
`;
}

function karta(p) {
  const img = path.join(MINI, `${p.id}.jpg`);
  const data = fs.existsSync(img) ? `data:image/jpeg;base64,${b64(img)}` : '';
  return `
  <article class="odb-card" data-id="${p.id}">
    <header class="odb-head">
      <div>
        <span class="odb-id">${p.id}</span>
        <h3 class="odb-title">${p.tytul}</h3>
      </div>
      <span class="odb-flag">${p.flaga}</span>
    </header>
    <div class="odb-body">
      <div class="odb-shot"><img src="${data}" alt="${p.id}" loading="lazy" /></div>
      <div class="odb-meta">
        <div class="odb-sec"><span class="odb-lbl">Co się zmieniło</span><p>${p.zmiana}</p></div>
        <div class="odb-sec"><span class="odb-lbl">Na co patrzeć</span><p>${p.sprawdz}</p></div>
        <div class="odb-sec"><span class="odb-lbl">Ryzyko / ograniczenia</span><p class="odb-risk">${p.ryzyko}</p></div>
        <div class="odb-verdict">
          <label><input type="radio" name="v-${p.id}" value="akceptuje"> Akceptuję</label>
          <label><input type="radio" name="v-${p.id}" value="poprawka"> Poprawka</label>
          <label><input type="radio" name="v-${p.id}" value="odrzucam"> Odrzucam</label>
        </div>
        <textarea class="odb-comment" data-for="${p.id}" rows="2" placeholder="Komentarz do ${p.id} — co poprawić, co przeszkadza…"></textarea>
      </div>
    </div>
  </article>`;
}

fs.mkdirSync(DO_ODBIORU, { recursive: true });
POZYCJE.forEach((p) => {
  fs.writeFileSync(path.join(DO_ODBIORU, `${p.id}.md`), md(p));
});

const fragment = POZYCJE.map(karta).join('\n');
fs.writeFileSync(path.join(ZRZUTY, '_galeria.html'), fragment);

const kb = Math.round(Buffer.byteLength(fragment) / 1024);
console.log(`✓ ${POZYCJE.length} pozycji → rejestr/3-DO-ODBIORU/`);
console.log(`✓ fragment galerii → rejestr/_zrzuty/_galeria.html (${kb} KB z obrazami)`);
