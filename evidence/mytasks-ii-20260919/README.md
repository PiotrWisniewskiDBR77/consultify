# mytasks-ii (Wpis 191/192, DEC-677) — zrzuty PRZED/PO

Ekran: `mywork-tasks` (MyTasks / personal tasks list), harness `dev-render`, 1440×900 @2x, lang=en.

## Twardy warunek (Wpis 192): PO == PRZED byte-identical

| motyw | sha256 (PRZED == PO) | cmp |
|-------|----------------------|-----|
| light | `a736d607dbee9a47015adca2d4682ce7f858541bf252b2024e21b25863165073` | IDENTICAL |
| dark  | `a710268612457e7d4955e8716dfe6761a6f59e3c4fa7fcc87771820f27f8e420` | IDENTICAL |

Obie strony renderują ten sam StandardTable: `EVAL {"rows":8,"hasTable":true}`, `bledyKonsoli=0`.

## Dlaczego freeze (ważne dla odtworzenia)

Komórka priorytetu w StandardTable zawiera kropkę `span.w-2.h-2.rounded-full.animate-pulse`
(bg-danger-500 / bg-blue-500). Tailwind `animate-pulse` oscyluje `opacity`, więc faza animacji
w chwili migawki jest LOSOWA — dwa zrzuty TYM SAMYM kodem różniły się o ~440 px w bbox
css x[965..973] y[349..414] (zmierzone `pngjs`). To NIE jest różnica od usunięcia starej tabeli;
to nondeterminizm przyrządu.

Rozwiązanie: deterministyczny freeze animacji wstrzyknięty przez `--eval` PRZED migawką
(identyczny dla PRZED i PO):

```js
(() => {
  const s = document.createElement("style");
  s.id = "__freeze__";
  s.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
  document.head.appendChild(s);
  return "frozen";
})()
```

Z freeze: dwa zrzuty tym samym kodem = byte-identical (zweryfikowane PO-vs-PO).
PRZED uchwycony z kodu bazowego (HEAD `6be676ff4f`, pliki `MyTasksListContent.tsx` +
`m03TasksStandardTableFlag.ts` przywrócone przez `git checkout HEAD --`), PO z kodu po usunięciu
starej tabeli i flagi. Oba z tym samym freeze → cmp IDENTICAL.

## Polecenie odtworzenia

```
DEV_RENDER_API_STUB_OK=1 npx vite --config dev-render/vite.config.ts --port 5410 --strictPort
node dev-render/shot.mjs <out.png> "http://localhost:5410/?screen=mywork-tasks&lang=en&theme=light|dark" \
  --w=1440 --h=900 --bez-chrome --eval='<FREEZE jw.>'
```
