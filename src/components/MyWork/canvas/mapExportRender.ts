/**
 * mapExportRender — wspólny renderer eksportów WIZUALNYCH mapy (PNG / SVG / PDF).
 *
 * Powstał z odbioru właściciela („pod Export wystawia się piękna tabela, tylko
 * niestety nie działa wszystko") i z sekcji dowodowej na JEGO realnych plikach
 * (`Wej_cie_na_rynek_DACH___mapa_decyzji.pdf` / `.svg`, 2026-07-27). Trzy
 * potwierdzone defekty, które ten moduł usuwa u źródła:
 *
 * 1. KADR. Dotychczas `toPng(.react-flow)` łapało WIDOCZNY VIEWPORT razem z
 *    pustym płótnem i z chromem UI (panel „Zdrowie mapy", kontrolki zoomu).
 *    Skutek w pliku właściciela: mapa zajmowała ~1/4 kadru, a węzły wychodzące
 *    poza ekran były PO CICHU OBCIĘTE (górna krawędź grafu ucięta w poł. węzła).
 *    Tu kadrujemy do BOUNDING BOXA TREŚCI (węzły + krawędzie) i renderujemy
 *    `.react-flow__viewport` z własną transformacją — nic nie ginie i nic się
 *    nie marnuje.
 *
 * 2. MOTYW. Tło było zaszyte na `#ffffff`, więc w trybie ciemnym jasny tekst
 *    węzłów lądował na białym tle (nieczytelne). Tło czytamy z realnego
 *    `.react-flow`, więc eksport jest spójny z tym, co widać na ekranie.
 *
 * 3. WEKTOR. `toSvg` produkowało jeden `<foreignObject>` z surowym XHTML
 *    (9 MB, `<text>` = 0 sztuk). Przeglądarka to narysuje, ale Illustrator,
 *    Inkscape i Figma NIE — `foreignObject` z XHTML to poza przeglądarką
 *    martwy prostokąt. `buildVectorSvg` rysuje mapę PRAWDZIWYMI prymitywami
 *    SVG (`<rect>` / `<path>` / `<text>`), więc plik otwiera się w edytorach
 *    wektorowych i jest edytowalny.
 *
 * Geometria: React Flow v11 renderuje KAŻDY węzeł jako rodzeństwo w
 * `.react-flow__viewport` z `transform: translate(<absX>px, <absY>px)`, a
 * `d` krawędzi jest zapisane w tym samym układzie współrzędnych „flow".
 * Dzięki temu DOM jest wiarygodnym źródłem geometrii (łącznie z rozmiarami
 * zmierzonymi przez React Flow, których nie ma w samych danych grafu).
 */

/** Kod błędu → komunikat i18n po stronie UI. Bez cichych podmian formatu. */
export type MapExportErrorCode = 'canvas_not_found' | 'empty_map' | 'render_failed';

export class MapExportError extends Error {
  readonly code: MapExportErrorCode;

  constructor(code: MapExportErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options as ErrorOptions);
    this.name = 'MapExportError';
    this.code = code;
  }
}

export interface MapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Margines wokół treści, w jednostkach „flow" (px przy zoomie 1). */
const CONTENT_PADDING = 48;

/** Górny limit dłuższego boku rastra — trzyma PDF/PNG w rozsądnym rozmiarze. */
const MAX_RASTER_EDGE = 2400;

/** Dolny limit skali — małe mapy warto powiększyć, żeby tekst był ostry. */
const MAX_RASTER_SCALE = 3;

interface NodeBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  element: HTMLElement;
}

function parseTranslate(transform: string): { x: number; y: number } | null {
  const match = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/.exec(transform);
  if (!match) return null;
  const x = Number.parseFloat(match[1]);
  const y = Number.parseFloat(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** Węzły widoczne w DOM — zwinięte gałęzie świadomie NIE są eksportowane. */
function readNodeBoxes(viewport: HTMLElement): NodeBox[] {
  const boxes: NodeBox[] = [];
  viewport.querySelectorAll<HTMLElement>('.react-flow__node').forEach((element) => {
    const translate = parseTranslate(element.style.transform || '');
    if (!translate) return;
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (!width || !height) return;
    boxes.push({
      id: element.getAttribute('data-id') || '',
      x: translate.x,
      y: translate.y,
      width,
      height,
      element,
    });
  });
  return boxes;
}

function readEdgePaths(viewport: HTMLElement): SVGPathElement[] {
  const edgeLayer = viewport.querySelector('.react-flow__edges');
  if (!edgeLayer) return [];
  return Array.from(edgeLayer.querySelectorAll<SVGPathElement>('path'));
}

/**
 * Bounding box treści = węzły ∪ krawędzie, powiększony o margines.
 * `null` gdy na płótnie nie ma nic do wyeksportowania (pusta mapa).
 */
export function getContentBounds(viewport: HTMLElement): MapBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const box of readNodeBoxes(viewport)) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }

  for (const path of readEdgePaths(viewport)) {
    let bbox: DOMRect | null = null;
    try {
      bbox = path.getBBox();
    } catch {
      // getBBox rzuca dla elementów bez layoutu — taka krawędź po prostu nie
      // wpływa na kadr.
      bbox = null;
    }
    if (!bbox || (!bbox.width && !bbox.height)) continue;
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.width);
    maxY = Math.max(maxY, bbox.y + bbox.height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  if (maxX <= minX || maxY <= minY) return null;

  return {
    x: minX - CONTENT_PADDING,
    y: minY - CONTENT_PADDING,
    width: maxX - minX + CONTENT_PADDING * 2,
    height: maxY - minY + CONTENT_PADDING * 2,
  };
}

/** Realne tło płótna (zależne od motywu), z sensownym fallbackiem. */
export function readCanvasBackground(container: HTMLElement): string {
  const probe = (
    container.classList.contains('react-flow') ? container : container.querySelector('.react-flow')
  ) as HTMLElement | null;
  const raw = probe ? getComputedStyle(probe).backgroundColor : '';
  if (!raw || raw === 'transparent' || /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(raw)) {
    return '#ffffff';
  }
  return raw;
}

function resolveViewport(container: HTMLElement): HTMLElement {
  const viewport = container.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) {
    throw new MapExportError('canvas_not_found', 'React Flow viewport not found in container');
  }
  return viewport;
}

export interface RasterCapture {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  background: string;
  bounds: MapBounds;
}

/**
 * Raster (PNG) skadrowany do treści. Używany przez eksport PNG i PDF, żeby oba
 * dawały ten sam, sensownie wykadrowany obraz.
 */
export async function captureMapRaster(
  container: HTMLElement,
  options: { background?: string } = {}
): Promise<RasterCapture> {
  const viewport = resolveViewport(container);
  const bounds = getContentBounds(viewport);
  if (!bounds) {
    throw new MapExportError('empty_map', 'Nothing to export — the canvas has no visible content');
  }

  const background = options.background ?? readCanvasBackground(container);
  const scale = Math.min(
    MAX_RASTER_SCALE,
    Math.max(1, MAX_RASTER_EDGE / Math.max(bounds.width, bounds.height))
  );
  const widthPx = Math.round(bounds.width * scale);
  const heightPx = Math.round(bounds.height * scale);

  try {
    const { toPng } = await import('html-to-image');
    // Kanoniczny przepis React Flow „download image": renderujemy warstwę
    // viewportu z PODMIENIONĄ transformacją, tak żeby bounding box treści
    // wypełnił dokładnie kadr `widthPx × heightPx`.
    const dataUrl = await toPng(viewport, {
      backgroundColor: background,
      pixelRatio: 1,
      width: widthPx,
      height: heightPx,
      style: {
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        transform: `translate(${-bounds.x * scale}px, ${-bounds.y * scale}px) scale(${scale})`,
        transformOrigin: '0 0',
      },
    });
    if (!dataUrl || !dataUrl.startsWith('data:image/png')) {
      throw new MapExportError('render_failed', 'html-to-image returned an empty data URL');
    }
    return { dataUrl, widthPx, heightPx, background, bounds };
  } catch (error) {
    if (error instanceof MapExportError) throw error;
    throw new MapExportError('render_failed', (error as Error)?.message || 'Raster render failed', {
      cause: error,
    });
  }
}

// ── Kolory ──────────────────────────────────────────────────────────────────
// Edytory wektorowe bywają wybredne wobec `rgba()` w atrybutach prezentacji
// (SVG 1.1 go nie zna). Rozbijamy kolor na `#rrggbb` + osobną krycie.

interface SolidColor {
  hex: string;
  alpha: number;
}

function parseColor(raw: string | null | undefined): SolidColor | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || value === 'none' || value === 'transparent') return null;
  const match = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (match) {
    const parts = match[1]
      .split(/[,/\s]+/)
      .filter(Boolean)
      .map(Number);
    const [r, g, b] = parts;
    const alpha = parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1;
    if (![r, g, b].every(Number.isFinite)) return null;
    if (alpha <= 0) return null;
    const hex = `#${[r, g, b]
      .map((channel) =>
        Math.max(0, Math.min(255, Math.round(channel)))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')}`;
    return { hex, alpha };
  }
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return { hex: value.slice(0, 7), alpha: 1 };
  return null;
}

/**
 * Rozwija `var(--token)` na realną wartość.
 *
 * Gradienty krawędzi mają `stop-color="var(--c-tag-8)"`. W aplikacji to działa,
 * bo arkusz definiuje token na `:root`. W SAMODZIELNYM pliku SVG — a taki
 * własnie oddajemy — `var()` nie ma do czego sięgnąć: Illustrator, Inkscape i
 * Figma zobaczyłyby wartość nieprawidłową i narysowały krawędzie na czarno albo
 * wcale. Zamrażamy więc wyliczone wartości w pliku.
 */
function resolveCssVars(markup: string, scope: Element): string {
  if (!markup.includes('var(')) return markup;
  const style = getComputedStyle(scope);
  return markup.replace(
    /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g,
    (_full: string, name: string, fallback?: string) => {
      const resolved = style.getPropertyValue(name).trim();
      if (resolved) return resolved;
      return (fallback || '').trim() || '#94a3b8';
    }
  );
}

/**
 * Element, z którego bierzemy KRÓJ etykiety.
 *
 * `firstElementChild` węzła to kontener karty — ma domyślne 16 px i wagę 400,
 * a nie krój realnego napisu (zwykle ~11 px / 600). Branie stylu z kontenera
 * powiększało tekst w pliku i wymuszało ucinanie etykiet wielokropkiem.
 * Szukamy więc NAJGŁĘBSZEGO elementu, który faktycznie niesie etykietę.
 */
function findLabelStyleSource(nodeElement: HTMLElement, label: string): HTMLElement {
  const needle = label.replace(/\s+/g, ' ').trim().slice(0, 12).toLowerCase();
  if (needle) {
    const candidates = Array.from(nodeElement.querySelectorAll<HTMLElement>('*'));
    // Od końca = od najgłębszych/najpóźniejszych w dokumencie.
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const element = candidates[index];
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (text.startsWith(needle)) return element;
    }
  }
  return (nodeElement.firstElementChild as HTMLElement | null) ?? nodeElement;
}

/**
 * Element, z którego bierzemy WYPEŁNIENIE karty. Część węzłów ma przezroczysty
 * kontener, a tło rysuje dopiero warstwa niżej (np. karta notatki) — bez tego
 * taki węzeł wychodziłby w pliku jako pusta ramka.
 */
function findPaintSource(nodeElement: HTMLElement): HTMLElement {
  const root = (nodeElement.firstElementChild as HTMLElement | null) ?? nodeElement;
  const nodeWidth = nodeElement.offsetWidth || root.offsetWidth;
  const nodeHeight = nodeElement.offsetHeight || root.offsetHeight;
  let element = root;
  for (let depth = 0; depth < 2; depth += 1) {
    if (parseColor(getComputedStyle(element).backgroundColor)) return element;
    const child = element.firstElementChild as HTMLElement | null;
    // Schodzimy TYLKO do elementu, ktory realnie wypelnia wezel. Bez tego
    // wchodzilismy w ozdobny pasek akcentu karty notatki i braly stad kolor
    // oraz promien narozy calego prostokata.
    if (!child || child.offsetWidth < nodeWidth * 0.8 || child.offsetHeight < nodeHeight * 0.6) {
      break;
    }
    element = child;
  }
  return root;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstNumber(raw: string | null | undefined, fallback: number): number {
  const parsed = Number.parseFloat(String(raw ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Zawijanie etykiety. Szerokość znaku szacujemy (0.56 em) — bez pomiaru w
 * canvasie, bo i tak KAŻDY edytor podstawi własny krój i przełamie inaczej.
 */
function wrapLabel(text: string, maxWidthPx: number, fontPx: number, maxLines: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const charWidth = fontPx * 0.56;
  const maxChars = Math.max(4, Math.floor(maxWidthPx / charWidth));
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (lines.length >= maxLines) break;
    current = word.length > maxChars ? `${word.slice(0, Math.max(1, maxChars - 1))}…` : word;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines) {
    const consumed = lines.join(' ').length;
    if (consumed < clean.length) {
      const last = lines[maxLines - 1];
      lines[maxLines - 1] =
        last.length > 1 ? `${last.slice(0, Math.max(1, last.length - 1))}…` : `${last}…`;
    }
  }
  return lines;
}

export interface VectorSvgOptions {
  /** Etykiety z danych grafu (pewniejsze niż zdrapywanie tekstu z DOM). */
  labelsById?: Map<string, string>;
  title?: string;
  footer?: string;
  background?: string;
}

/**
 * PRAWDZIWY eksport wektorowy: `<rect>` / `<path>` / `<text>`, zero
 * `<foreignObject>`. Geometria i kolory pochodzą z wyrenderowanego DOM, więc
 * plik odpowiada temu, co widać, ale jest edytowalny w Illustratorze,
 * Inkscape i Figmie.
 */
export function buildVectorSvg(container: HTMLElement, options: VectorSvgOptions = {}): string {
  const viewport = resolveViewport(container);
  const bounds = getContentBounds(viewport);
  if (!bounds) {
    throw new MapExportError('empty_map', 'Nothing to export — the canvas has no visible content');
  }

  const background = options.background ?? readCanvasBackground(container);
  const backgroundColor = parseColor(background) ?? { hex: '#ffffff', alpha: 1 };
  const labels = options.labelsById ?? new Map<string, string>();

  // ── Definicje (gradienty krawędzi) ───────────────────────────────────────
  // UWAGA: warstwa krawędzi ma WIELE elementów `<defs>` (React Flow ma swój
  // własny, pusty, a każda krawędź gradientowa dokłada kolejny). Pobranie
  // tylko pierwszego przez `querySelector` dawało pusty `<defs>` i wszystkie
  // `stroke="url(#gradient-…)"` wskazywały w próżnię — krawędzie znikały.
  // Zbieramy WSZYSTKIE i pamiętamy, które identyfikatory naprawdę istnieją.
  const defs = resolveCssVars(
    Array.from(viewport.querySelectorAll('.react-flow__edges defs'))
      .map((node) => node.innerHTML)
      .join(''),
    viewport
  );
  const availableDefIds = new Set(
    Array.from(defs.matchAll(/\bid="([^"]+)"/g)).map((match) => match[1])
  );

  // ── Krawędzie ────────────────────────────────────────────────────────────
  // Każda krawędź renderuje kilka nałożonych ścieżek (strefa trafienia,
  // poświata hover, ścieżka główna, animowana kreska). Do pliku bierzemy
  // JEDNĄ, widoczną ścieżkę na unikalne `d`.
  const edgeMarkup: string[] = [];
  const seenPaths = new Set<string>();
  for (const path of readEdgePaths(viewport)) {
    const d = path.getAttribute('d');
    if (!d || seenPaths.has(d)) continue;
    const computed = getComputedStyle(path);
    const strokeRaw = computed.stroke;
    const strokeWidth = firstNumber(computed.strokeWidth, 1.5);
    // Strefa trafienia jest przezroczysta i gruba — pomijamy ją.
    if (strokeWidth > 8) continue;
    // `getComputedStyle` zwraca odwołanie do gradientu jako `url("#id")` —
    // cudzysłowy trzeba zdjąć, bo w atrybucie SVG obowiązuje `url(#id)`.
    const referencedId = /^url\(["']?#([^"')]+)["']?\)/.exec(strokeRaw)?.[1];
    // Gradient trafia do pliku tylko wtedy, gdy jego definicja NAPRAWDĘ tam
    // jest. Inaczej wolimy widoczną, jednolitą krawędź niż niewidzialną.
    const gradientId = referencedId && availableDefIds.has(referencedId) ? referencedId : null;
    const solid = gradientId
      ? null
      : (parseColor(strokeRaw) ?? (referencedId ? { hex: '#94a3b8', alpha: 1 } : null));
    if (!gradientId && !solid) continue;
    seenPaths.add(d);

    const strokeAttr = gradientId
      ? `stroke="url(#${escapeXml(gradientId)})"`
      : `stroke="${solid!.hex}"${solid!.alpha < 1 ? ` stroke-opacity="${solid!.alpha.toFixed(3)}"` : ''}`;
    const dash = computed.strokeDasharray;
    const dashAttr =
      dash && dash !== 'none' ? ` stroke-dasharray="${escapeXml(dash.replace(/px/g, ''))}"` : '';

    edgeMarkup.push(
      `<path d="${escapeXml(d)}" fill="none" ${strokeAttr} stroke-width="${strokeWidth}"${dashAttr} stroke-linecap="round"/>`
    );
  }

  // ── Węzły ────────────────────────────────────────────────────────────────
  const nodeMarkup: string[] = [];
  for (const box of readNodeBoxes(viewport)) {
    const card = findPaintSource(box.element);
    const computed = getComputedStyle(card);
    const fill = parseColor(computed.backgroundColor);
    const stroke = parseColor(computed.borderTopColor);
    const strokeWidth = firstNumber(computed.borderTopWidth, 0);
    const radius = Math.min(
      firstNumber(computed.borderTopLeftRadius, 8),
      box.width / 2,
      box.height / 2
    );

    const parts: string[] = [];
    parts.push(
      `<rect x="0" y="0" width="${box.width}" height="${box.height}" rx="${radius.toFixed(2)}" ry="${radius.toFixed(2)}"` +
        (fill
          ? ` fill="${fill.hex}"${fill.alpha < 1 ? ` fill-opacity="${fill.alpha.toFixed(3)}"` : ''}`
          : ' fill="none"') +
        (stroke && strokeWidth > 0
          ? ` stroke="${stroke.hex}" stroke-width="${strokeWidth}"${stroke.alpha < 1 ? ` stroke-opacity="${stroke.alpha.toFixed(3)}"` : ''}`
          : '') +
        `/>`
    );

    const label = labels.get(box.id) ?? (box.element.textContent || '').trim();
    if (label) {
      // Krój z elementu, ktory NAPRAWDE niesie napis — nie z kontenera karty.
      const labelStyle = getComputedStyle(findLabelStyleSource(box.element, label));
      const fontPx = Math.max(7, firstNumber(labelStyle.fontSize, 12));
      const fontWeight = labelStyle.fontWeight || '500';
      const fontFamily = labelStyle.fontFamily || 'Inter, Arial, Helvetica, sans-serif';
      const textColor = parseColor(labelStyle.color) ?? { hex: '#0f172a', alpha: 1 };
      const padX = Math.max(6, firstNumber(computed.paddingLeft, 10));
      const lineHeight = fontPx * 1.3;
      const maxLines = Math.max(1, Math.floor((box.height - 6) / lineHeight));
      const centered = (labelStyle.textAlign || computed.textAlign || '').includes('center');
      const lines = wrapLabel(label, box.width - padX * 2, fontPx, maxLines);

      if (lines.length) {
        const blockHeight = lines.length * lineHeight;
        const firstBaseline = (box.height - blockHeight) / 2 + fontPx * 0.9;
        const anchorX = centered ? box.width / 2 : padX;
        const tspans = lines
          .map(
            (line, index) =>
              `<tspan x="${anchorX.toFixed(2)}" y="${(firstBaseline + index * lineHeight).toFixed(2)}">${escapeXml(line)}</tspan>`
          )
          .join('');
        parts.push(
          `<text font-family="${escapeXml(fontFamily)}" font-size="${fontPx}" font-weight="${escapeXml(fontWeight)}" fill="${textColor.hex}"${textColor.alpha < 1 ? ` fill-opacity="${textColor.alpha.toFixed(3)}"` : ''} text-anchor="${centered ? 'middle' : 'start'}">${tspans}</text>`
        );
      }
    }

    nodeMarkup.push(
      `<g transform="translate(${box.x.toFixed(2)} ${box.y.toFixed(2)})" data-node-id="${escapeXml(box.id)}">${parts.join('')}</g>`
    );
  }

  if (!nodeMarkup.length && !edgeMarkup.length) {
    throw new MapExportError('empty_map', 'Nothing to export — the canvas has no visible content');
  }

  // ── Stopka ───────────────────────────────────────────────────────────────
  // Tekst SVG jest zapisany w UTF-8, więc polskie znaki są tu poprawne
  // „za darmo" — inaczej niż w PDF na standardowej Helvetice.
  const footerMarkup = options.footer
    ? `<text x="${(bounds.x + 8).toFixed(2)}" y="${(bounds.y + bounds.height - 10).toFixed(2)}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="12" fill="#64748b">${escapeXml(options.footer)}</text>`
    : '';

  const titleMarkup = options.title ? `<title>${escapeXml(options.title)}</title>` : '';

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `width="${Math.round(bounds.width)}" height="${Math.round(bounds.height)}" ` +
      `viewBox="${bounds.x.toFixed(2)} ${bounds.y.toFixed(2)} ${bounds.width.toFixed(2)} ${bounds.height.toFixed(2)}">`,
    titleMarkup,
    defs ? `<defs>${defs}</defs>` : '',
    `<rect x="${bounds.x.toFixed(2)}" y="${bounds.y.toFixed(2)}" width="${bounds.width.toFixed(2)}" height="${bounds.height.toFixed(2)}" fill="${backgroundColor.hex}"/>`,
    `<g data-layer="edges">${edgeMarkup.join('')}</g>`,
    `<g data-layer="nodes">${nodeMarkup.join('')}</g>`,
    footerMarkup,
    `</svg>`,
  ]
    .filter(Boolean)
    .join('\n');
}

export interface TextStrip {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
}

/**
 * Stopka PDF rysowana w `<canvas>` i wklejana jako obraz.
 *
 * DLACZEGO NIE `pdf.text()`: standardowe 14 krojów PDF (Helvetica i spółka)
 * mają `/Encoding /WinAnsiEncoding`, czyli jeden bajt na znak i BRAK polskich
 * diakrytyków. jsPDF, widząc znaki spoza Latin-1, zapisuje ciąg jako UTF-16BE
 * — ale font nadal deklaruje kodowanie jednobajtowe, więc czytnik bierze młodszy
 * bajt każdej pary. Dla „ś" (U+015B) to 0x5B, czyli `[` — dokładnie stąd
 * „Wej[cie na rynek DACH" w pliku właściciela.
 *
 * Alternatywą byłoby osadzenie TTF przez `addFileToVFS`/`addFont`, ale w repo
 * NIE MA żadnego pliku fontu (`grep addFileToVFS` = 0 trafień), a dorzucenie
 * ~300 KB base64 obciążyłoby bundle dla jednej linijki stopki na stronie, która
 * i tak jest rastrem. Rysowanie tekstu w canvasie daje poprawne glify w KAŻDYM
 * języku (również CJK) przy zerowym koszcie assetów. Kompromis: stopka nie jest
 * zaznaczalna — akceptowalne dla znaku wodnego pod obrazem.
 */
export function renderTextStrip(
  text: string,
  options: { color?: string; background?: string; fontPx?: number; scale?: number } = {}
): TextStrip | null {
  if (!text.trim()) return null;
  const fontPx = options.fontPx ?? 11;
  const scale = options.scale ?? 4;
  const font = `${fontPx * scale}px Inter, Arial, Helvetica, sans-serif`;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return null;
  measureCtx.font = font;
  const textWidth = Math.ceil(measureCtx.measureText(text).width);
  if (!textWidth) return null;

  const paddingX = Math.round(2 * scale);
  const widthPx = textWidth + paddingX * 2;
  const heightPx = Math.round(fontPx * scale * 1.6);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, widthPx, heightPx);
  }
  ctx.font = font;
  ctx.fillStyle = options.color ?? '#808080';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, paddingX, heightPx / 2);

  return { dataUrl: canvas.toDataURL('image/png'), widthPx, heightPx };
}

/**
 * Czy kolor jest ciemny — decyduje o kolorze stopki i o tym, czy strona PDF
 * dostaje tło motywu (żeby ciemny raster nie leżał na białej kartce).
 */
export function isDarkColor(color: string): boolean {
  const parsed = parseColor(color);
  if (!parsed) return false;
  const value = parsed.hex.slice(1);
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  // Luminancja wg BT.601 — wystarczająca do decyzji jasne/ciemne.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

export function toRgbTriplet(color: string): [number, number, number] {
  const parsed = parseColor(color) ?? { hex: '#ffffff', alpha: 1 };
  const value = parsed.hex.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}
